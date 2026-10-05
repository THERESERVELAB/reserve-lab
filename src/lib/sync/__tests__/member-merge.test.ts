import { describe, expect, it } from "vitest";

import {
  LEDGER_SLICE_KEY,
  collectEntities,
  mergeLocalLogs,
  mergeMemberSlices,
  recordChanges,
  tombstonesFromChangeHistory,
} from "@/lib/sync/member-merge";
import { SYNC_COLLECTIONS } from "@/lib/sync/sync-collections";
import { EMPTY_SYNC_LEDGER, mergeLedgers, readLedger, type SyncLedger } from "@/lib/sync/sync-ledger";
import { MEMBER_STATE_KEYS } from "@/lib/sync/state-contract";

/* Two devices, one member. Every scenario here is a way the old whole-state
   last-write-wins sync lost a member's records. */

const NOW = new Date("2026-09-18T20:00:00.000Z");
const at = (iso: string) => new Date(iso);

type Entry = { id: string; name: string; createdAt: string; updatedAt: string; category?: string; doseAmount?: string };

const entry = (id: string, name: string, createdAt: string, extra: Partial<Entry> = {}): Entry => ({
  id,
  name,
  createdAt,
  updatedAt: createdAt,
  category: "supplement",
  ...extra,
});

function state(log: Entry[], extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { trainingSession: { enhancementLog: log, activeTab: "log" }, changeHistory: [], ...extra };
}

/** Apply a member edit the way the store does, letting the ledger record it. */
function edit(before: Record<string, unknown>, after: Record<string, unknown>, when: Date): Record<string, unknown> {
  const ledger = recordChanges(before, after, MEMBER_STATE_KEYS, readLedger(before[LEDGER_SLICE_KEY]), when);
  return ledger ? { ...after, [LEDGER_SLICE_KEY]: ledger } : after;
}

const logOf = (slices: Record<string, unknown>) =>
  ((slices.trainingSession as { enhancementLog: Entry[] }).enhancementLog ?? []) as Entry[];
const idsOf = (slices: Record<string, unknown>) => logOf(slices).map((e) => e.id).sort();

function merge(local: Record<string, unknown>, cloud: Record<string, unknown>, envelopePref: "local" | "cloud" = "cloud", changedAt: { local?: string | null; cloud?: string | null } = {}) {
  return mergeMemberSlices({
    local: { slices: local, changedAt: changedAt.local ?? null },
    cloud: { slices: cloud, changedAt: changedAt.cloud ?? null },
    envelopePref,
    now: NOW,
  });
}

describe("two devices, per-record merge", () => {
  const base = state([entry("enh-a", "Retatrutide", "2026-09-01T10:00:00.000Z")]);

  it("A adds X, stale B adds Y → both survive", () => {
    const a = edit(base, state([entry("enh-x", "X", "2026-09-15T10:00:00.000Z"), ...logOf(base)]), at("2026-09-15T10:00:00.000Z"));
    const b = edit(base, state([entry("enh-y", "Y", "2026-09-17T10:00:00.000Z"), ...logOf(base)]), at("2026-09-17T10:00:00.000Z"));

    const { slices, report } = merge(b, a);
    expect(idsOf(slices)).toEqual(["enh-a", "enh-x", "enh-y"]);
    expect(report.keptFromCloud).toContain("trainingSession.enhancementLog|enh-x");
    expect(report.keptFromLocal).toContain("trainingSession.enhancementLog|enh-y");
    // Symmetric: whichever device merges, the answer is the same.
    expect(idsOf(merge(a, b).slices)).toEqual(["enh-a", "enh-x", "enh-y"]);
  });

  it("A deletes X (tombstone), stale B still has X → X stays deleted", () => {
    const withX = edit(base, state([entry("enh-x", "X", "2026-09-15T10:00:00.000Z"), ...logOf(base)]), at("2026-09-15T10:00:00.000Z"));
    const aDeleted = edit(withX, state(logOf(base), { [LEDGER_SLICE_KEY]: withX[LEDGER_SLICE_KEY] }), at("2026-09-16T10:00:00.000Z"));
    expect(readLedger(aDeleted[LEDGER_SLICE_KEY]).deletions["trainingSession.enhancementLog|enh-x"]).toBe("2026-09-16T10:00:00.000Z");

    const bStale = withX; // B synced while X existed and never saw the removal
    const { slices, report } = merge(bStale, aDeleted);
    expect(idsOf(slices)).toEqual(["enh-a"]);
    expect(report.removedByTombstone).toEqual(["trainingSession.enhancementLog|enh-x"]);
    expect(idsOf(merge(aDeleted, bStale).slices)).toEqual(["enh-a"]);
  });

  it("an edit made after the deletion keeps the record (edit wins over an older removal)", () => {
    const withX = edit(base, state([entry("enh-x", "X", "2026-09-15T10:00:00.000Z"), ...logOf(base)]), at("2026-09-15T10:00:00.000Z"));
    const aDeleted = edit(withX, state(logOf(base), { [LEDGER_SLICE_KEY]: withX[LEDGER_SLICE_KEY] }), at("2026-09-16T10:00:00.000Z"));
    const bEdited = edit(
      withX,
      state([entry("enh-x", "X", "2026-09-15T10:00:00.000Z", { doseAmount: "2", updatedAt: "2026-09-17T09:00:00.000Z" }), ...logOf(base)], { [LEDGER_SLICE_KEY]: withX[LEDGER_SLICE_KEY] }),
      at("2026-09-17T09:00:00.000Z"),
    );
    expect(idsOf(merge(bEdited, aDeleted).slices)).toEqual(["enh-a", "enh-x"]);
  });

  it("concurrent edits to the same record → the newer edit wins", () => {
    const withX = state([entry("enh-x", "X", "2026-09-15T10:00:00.000Z"), ...logOf(base)]);
    const a = state([entry("enh-x", "X", "2026-09-15T10:00:00.000Z", { doseAmount: "A", updatedAt: "2026-09-16T08:00:00.000Z" }), ...logOf(base)]);
    const b = state([entry("enh-x", "X", "2026-09-15T10:00:00.000Z", { doseAmount: "B", updatedAt: "2026-09-16T09:00:00.000Z" }), ...logOf(base)]);
    void withX;
    const pick = (s: Record<string, unknown>) => logOf(s).find((e) => e.id === "enh-x")?.doseAmount;
    expect(pick(merge(a, b, "local").slices)).toBe("B");
    expect(pick(merge(b, a, "local").slices)).toBe("B");
  });

  it("a ledger clock outranks an older updatedAt (records whose edits don't stamp updatedAt)", () => {
    const before = state([{ id: "enh-x", name: "X", createdAt: "2026-09-15T10:00:00.000Z", updatedAt: "2026-09-15T10:00:00.000Z", doseAmount: "1" }]);
    // The member's edit on B leaves updatedAt alone; the ledger clocks it.
    const b = edit(before, state([{ id: "enh-x", name: "X", createdAt: "2026-09-15T10:00:00.000Z", updatedAt: "2026-09-15T10:00:00.000Z", doseAmount: "2" }]), at("2026-09-17T10:00:00.000Z"));
    const a = state([{ id: "enh-x", name: "X", createdAt: "2026-09-15T10:00:00.000Z", updatedAt: "2026-09-16T10:00:00.000Z", doseAmount: "3" }]);
    const pick = (s: Record<string, unknown>) => logOf(s)[0].doseAmount;
    expect(pick(merge(a, b, "local").slices)).toBe("2");
  });

  it("equal clocks and different content fall back to the envelope preference", () => {
    const a = state([entry("enh-x", "X", "2026-09-15T10:00:00.000Z", { doseAmount: "A" })]);
    const b = state([entry("enh-x", "X", "2026-09-15T10:00:00.000Z", { doseAmount: "B" })]);
    expect(logOf(merge(a, b, "local").slices)[0].doseAmount).toBe("A");
    expect(logOf(merge(a, b, "cloud").slices)[0].doseAmount).toBe("B");
  });

  it("keeps newest-first order after a union", () => {
    const a = state([entry("enh-3", "3", "2026-09-17T00:00:00.000Z"), entry("enh-1", "1", "2026-09-15T00:00:00.000Z")]);
    const b = state([entry("enh-4", "4", "2026-09-18T00:00:00.000Z"), entry("enh-2", "2", "2026-09-16T00:00:00.000Z"), entry("enh-1", "1", "2026-09-15T00:00:00.000Z")]);
    expect(logOf(merge(a, b).slices).map((e) => e.id)).toEqual(["enh-4", "enh-3", "enh-2", "enh-1"]);
  });

  it("never mutates its inputs", () => {
    const a = state([entry("enh-x", "X", "2026-09-15T10:00:00.000Z")]);
    const b = state([entry("enh-y", "Y", "2026-09-16T10:00:00.000Z")]);
    const snapshot = JSON.stringify([a, b]);
    merge(a, b);
    expect(JSON.stringify([a, b])).toBe(snapshot);
  });

  it("a duplicate id collapses to the first copy but never drops the other side's records", () => {
    const dup = state([entry("enh-x", "X", "2026-09-15T10:00:00.000Z"), entry("enh-x", "X2", "2026-09-15T11:00:00.000Z")]);
    const other = state([entry("enh-y", "Y", "2026-09-16T10:00:00.000Z")]);
    // A duplicate id on one side used to make the merge replace the whole list
    // with the slice winner's copy — dropping the other side's records. Now the
    // duplicate collapses to its first copy and both sides survive, whichever
    // side the slice preference favours.
    expect(logOf(merge(dup, other, "local").slices).map((e) => e.name).sort()).toEqual(["X", "Y"]);
    expect(logOf(merge(dup, other, "cloud").slices).map((e) => e.name).sort()).toEqual(["X", "Y"]);
  });
});

describe("owner regression — four compounds on one device, 13 supplements on a stale device", () => {
  const base: Entry[] = [
    entry("enh-reta", "Retatrutide", "2026-09-10T12:00:00.000Z"),
    entry("enh-s1", "Creatine", "2026-09-10T12:01:00.000Z"),
    entry("enh-s2", "Fish Oil", "2026-09-10T12:02:00.000Z"),
    entry("enh-s3", "Magnesium", "2026-09-10T12:03:00.000Z"),
  ];
  const compounds: Entry[] = [
    entry("enh-1789510439098-vnduu", "Testosterone Enanthate", "2026-09-15T22:13:00.000Z", { category: "hormone" }),
    entry("enh-1789514525470-33xxb", "Somatropin", "2026-09-15T23:22:00.000Z", { category: "peptide" }),
    entry("enh-1789526595954-x3qz0", "Drostanolone Enanthate", "2026-09-16T02:43:00.000Z", { category: "hormone" }),
    entry("enh-1789589215736-wcbs6", "Testosterone Enanthate", "2026-09-16T20:06:00.000Z", { category: "hormone" }),
  ];
  const supplements: Entry[] = Array.from({ length: 13 }, (_, i) =>
    entry(`enh-17896124566${30 + i}`, `Supplement ${i + 1}`, "2026-09-17T02:34:16.000Z"),
  );
  const added = (e: Entry) => ({
    id: `chg-${e.id}`,
    at: e.createdAt,
    date: e.createdAt.slice(0, 10),
    subject: { kind: "compound", id: e.id, name: e.name },
    action: "added",
    changes: [],
  });
  const cycle = {
    id: "cycle-1",
    name: "Fall cycle",
    startDate: "2026-09-15",
    plannedWeeks: 16,
    compoundIds: ["enh-1789510439098-vnduu", "enh-1789514525470-33xxb"],
    clinicianOversight: false,
    checkpoints: [],
    createdAt: "2026-09-15T23:30:00.000Z",
    updatedAt: "2026-09-15T23:30:00.000Z",
  };

  // Legacy data: neither device has a sync ledger yet.
  const desktop = {
    trainingSession: { enhancementLog: [...compounds].reverse().concat(base) },
    changeHistory: compounds.map(added).reverse(),
    cyclePeriods: [cycle],
  };
  const phone = {
    trainingSession: { enhancementLog: [...supplements, ...base] },
    changeHistory: supplements.map(added),
    cyclePeriods: [],
  };

  it("the stale phone's write merges instead of erasing — all 21 entries remain", () => {
    const { slices } = mergeMemberSlices({
      local: { slices: phone, changedAt: "2026-09-17T02:34:17.000Z" },
      cloud: { slices: desktop, changedAt: "2026-09-16T20:06:05.000Z" },
      envelopePref: "local",
      now: NOW,
    });
    const log = logOf(slices);
    expect(log).toHaveLength(21);
    for (const c of compounds) expect(log.some((e) => e.id === c.id)).toBe(true);
    for (const s of supplements) expect(log.some((e) => e.id === s.id)).toBe(true);
    // The cycle still points at entries that exist.
    const cycles = slices.cyclePeriods as Array<typeof cycle>;
    expect(cycles).toHaveLength(1);
    for (const id of cycles[0].compoundIds) expect(log.some((e) => e.id === id)).toBe(true);
    // Both devices' change history is kept.
    expect((slices.changeHistory as unknown[]).length).toBe(17);
  });

  it("merging the other way round gives the same records", () => {
    const { slices } = mergeMemberSlices({
      local: { slices: desktop, changedAt: "2026-09-16T20:06:05.000Z" },
      cloud: { slices: phone, changedAt: "2026-09-17T02:34:17.000Z" },
      envelopePref: "cloud",
      now: NOW,
    });
    expect(logOf(slices)).toHaveLength(21);
  });
});

describe("legacy tombstones from the change history", () => {
  const removed = (id: string, when: string, action = "removed") => ({
    id: `chg-${id}-${action}-${when}`,
    at: when,
    date: when.slice(0, 10),
    subject: { kind: "support-plan", id, name: id },
    action,
    changes: [],
  });

  it("a recorded removal counts as a tombstone", () => {
    expect(tombstonesFromChangeHistory([removed("support-1", "2026-09-18T01:00:00.000Z")])).toEqual({
      "supportPlan|support-1": "2026-09-18T01:00:00.000Z",
    });
  });

  it("a later restore or re-add cancels it", () => {
    const history = [removed("support-1", "2026-09-18T02:00:00.000Z", "restored"), removed("support-1", "2026-09-18T01:00:00.000Z")];
    expect(tombstonesFromChangeHistory(history)).toEqual({});
  });

  it("drops a record the other device still holds, when the member removed it (Collagen Peptides on 09-18)", () => {
    const item = { id: "support-1", optionKey: "collagen", addedAt: "2026-09-10T00:00:00.000Z" };
    const local = { supportPlan: [], changeHistory: [removed("support-1", "2026-09-18T01:00:00.000Z")] };
    const cloud = { supportPlan: [item], changeHistory: [] };
    const { slices } = mergeMemberSlices({ local: { slices: local, changedAt: null }, cloud: { slices: cloud, changedAt: null }, envelopePref: "cloud", now: NOW });
    expect(slices.supportPlan).toEqual([]);
  });
});

describe("slices that are not record lists", () => {
  it("each slice goes to the side that changed it most recently", () => {
    const base = { settings: { units: "lb" }, profile: { name: "T" } };
    const a = edit(base, { ...base, settings: { units: "kg" } }, at("2026-09-17T10:00:00.000Z"));
    const b = edit(base, { ...base, profile: { name: "Tony" } }, at("2026-09-17T11:00:00.000Z"));
    const { slices, report } = merge(a, b, "cloud");
    expect(slices.settings).toEqual({ units: "kg" });
    expect(slices.profile).toEqual({ name: "Tony" });
    expect(report.sliceWinners.settings).toBe("local");
    expect(report.sliceWinners.profile).toBe("cloud");
  });

  it("with no clocks on either side, the envelope preference decides", () => {
    const a = { settings: { units: "kg" } };
    const b = { settings: { units: "lb" } };
    expect(merge(a, b, "local").slices.settings).toEqual({ units: "kg" });
    expect(merge(a, b, "cloud").slices.settings).toEqual({ units: "lb" });
  });

  it("a clocked slice against a legacy side compares with that side's envelope time", () => {
    const base = { settings: { units: "lb" } };
    const a = edit(base, { settings: { units: "kg" } }, at("2026-09-17T10:00:00.000Z"));
    const legacyCloud = { settings: { units: "st" } };
    expect(merge(a, legacyCloud, "cloud", { cloud: "2026-09-17T09:00:00.000Z" }).slices.settings).toEqual({ units: "kg" });
    expect(merge(a, legacyCloud, "local", { cloud: "2026-09-17T12:00:00.000Z" }).slices.settings).toEqual({ units: "st" });
  });

  it("record lists nested in a slice still merge when the other side wins the slice's scalars", () => {
    const a = { trainingSession: { activeTab: "log", enhancementLog: [entry("enh-x", "X", "2026-09-15T00:00:00.000Z")] } };
    const b = { trainingSession: { activeTab: "stack", enhancementLog: [entry("enh-y", "Y", "2026-09-16T00:00:00.000Z")] } };
    const { slices } = merge(a, b, "cloud");
    expect((slices.trainingSession as { activeTab: string }).activeTab).toBe("stack");
    expect(idsOf(slices)).toEqual(["enh-x", "enh-y"]);
  });
});

describe("maps and composite keys", () => {
  it("day overrides (a map) union by date and honor removals", () => {
    const base = { trainingOverrides: { "2026-09-17": { id: "o1", action: "rest", updatedAt: "2026-09-16T00:00:00.000Z" } } };
    const a = edit(base, { trainingOverrides: {} }, at("2026-09-17T08:00:00.000Z")); // cleared on A
    const b = edit(base, { trainingOverrides: { ...base.trainingOverrides, "2026-09-18": { id: "o2", action: "swap", updatedAt: "2026-09-17T09:00:00.000Z" } } }, at("2026-09-17T09:00:00.000Z"));
    const { slices } = merge(a, b);
    expect(Object.keys(slices.trainingOverrides as object)).toEqual(["2026-09-18"]);
  });

  it("a re-logged taken mark (new id, same compound/day/time) does not duplicate", () => {
    const mark = (id: string, status: string, createdAt: string) => ({ id, entryId: "enh-x", date: "2026-09-17", plannedTime: "08:00", takenStatus: status, createdAt });
    const a = { trainingSession: { enhancementAdherence: [mark("adh-1", "taken", "2026-09-17T08:05:00.000Z")] } };
    const b = { trainingSession: { enhancementAdherence: [mark("adh-2", "skipped", "2026-09-17T09:00:00.000Z")] } };
    const marks = (merge(a, b).slices.trainingSession as { enhancementAdherence: Array<{ id: string }> }).enhancementAdherence;
    expect(marks.map((m) => m.id)).toEqual(["adh-2"]);
  });
});

describe("recordChanges — the ledger the store subscription keeps", () => {
  const when = at("2026-09-17T10:00:00.000Z");

  it("stamps changed slices and added records, and nothing when nothing changed", () => {
    const before = state([]);
    const after = state([entry("enh-x", "X", "2026-09-17T10:00:00.000Z")]);
    const ledger = recordChanges(before, after, MEMBER_STATE_KEYS, EMPTY_SYNC_LEDGER, when)!;
    expect(ledger.slices.trainingSession).toBe(when.toISOString());
    expect(ledger.entities["trainingSession.enhancementLog|enh-x"]).toBe(when.toISOString());
    expect(recordChanges(after, { ...after }, MEMBER_STATE_KEYS, ledger, when)).toBeNull();
  });

  it("a re-added id clears its tombstone", () => {
    const x = entry("enh-x", "X", "2026-09-17T10:00:00.000Z");
    const removed = recordChanges(state([x]), state([]), MEMBER_STATE_KEYS, EMPTY_SYNC_LEDGER, when)!;
    expect(removed.deletions["trainingSession.enhancementLog|enh-x"]).toBeDefined();
    const readded = recordChanges(state([]), state([x]), MEMBER_STATE_KEYS, removed, at("2026-09-17T11:00:00.000Z"))!;
    expect(readded.deletions["trainingSession.enhancementLog|enh-x"]).toBeUndefined();
  });

  it("never records its own slice", () => {
    const before = { [LEDGER_SLICE_KEY]: EMPTY_SYNC_LEDGER };
    const after = { [LEDGER_SLICE_KEY]: { ...EMPTY_SYNC_LEDGER, slices: { x: "y" } } };
    expect(recordChanges(before, after, MEMBER_STATE_KEYS, EMPTY_SYNC_LEDGER, when)).toBeNull();
  });

  it("a single removal still tombstones (a real member delete)", () => {
    const a = entry("enh-a", "A", "2026-09-10T10:00:00.000Z");
    const b = entry("enh-b", "B", "2026-09-11T10:00:00.000Z");
    const ledger = recordChanges(state([a, b]), state([a]), MEMBER_STATE_KEYS, EMPTY_SYNC_LEDGER, when)!;
    expect(ledger.deletions["trainingSession.enhancementLog|enh-b"]).toBeDefined();
    expect(ledger.deletions["trainingSession.enhancementLog|enh-a"]).toBeUndefined();
  });

  it("a bulk disappearance (2+ at once) stamps NO tombstone — a system wipe is not a member deletion", () => {
    const a = entry("enh-a", "A", "2026-09-10T10:00:00.000Z");
    const b = entry("enh-b", "B", "2026-09-11T10:00:00.000Z");
    const c = entry("enh-c", "C", "2026-09-12T10:00:00.000Z");
    const wiped = recordChanges(state([a, b, c]), state([]), MEMBER_STATE_KEYS, EMPTY_SYNC_LEDGER, when);
    // The whole list emptying in one transition writes a slice clock but no deletions.
    expect(Object.keys(wiped?.deletions ?? {})).toEqual([]);
  });
});

describe("a wiped device never deletes the compounds that still live in the cloud", () => {
  const a = entry("enh-a", "Testosterone", "2026-09-10T10:00:00.000Z");
  const b = entry("enh-b", "Semaglutide", "2026-09-11T10:00:00.000Z");
  const c = entry("enh-c", "Retatrutide", "2026-09-12T10:00:00.000Z");

  it("a local bulk-wipe merged against a full cloud keeps every compound", () => {
    // The device had all three, then something emptied the list in one go.
    const wipedLocal = edit(state([a, b, c]), state([]), at("2026-09-18T10:00:00.000Z"));
    const cloud = state([a, b, c]);
    const { slices, report } = merge(wipedLocal, cloud);
    expect(idsOf(slices)).toEqual(["enh-a", "enh-b", "enh-c"]);
    expect(report.removedByTombstone).toEqual([]);
  });
});

describe("ledger housekeeping", () => {
  it("merges keep the newest time per key", () => {
    const a: SyncLedger = { v: 1, slices: { s: "2026-09-17T00:00:00.000Z" }, entities: {}, deletions: { k: "2026-09-10T00:00:00.000Z" } };
    const b: SyncLedger = { v: 1, slices: { s: "2026-09-16T00:00:00.000Z" }, entities: {}, deletions: { k: "2026-09-12T00:00:00.000Z" } };
    const merged = mergeLedgers(a, b, NOW);
    expect(merged.slices.s).toBe("2026-09-17T00:00:00.000Z");
    expect(merged.deletions.k).toBe("2026-09-12T00:00:00.000Z");
  });

  it("every registered collection sits under a synced slice", () => {
    const keys = new Set<string>(MEMBER_STATE_KEYS);
    for (const spec of SYNC_COLLECTIONS) expect(keys.has(spec.path.split(".")[0])).toBe(true);
    expect(keys.has(LEDGER_SLICE_KEY)).toBe(true);
  });

  it("collectEntities indexes every registered record", () => {
    const keys = [...collectEntities(state([entry("enh-x", "X", "2026-09-17T00:00:00.000Z")], { cycleGoals: { "cycle-1": { updatedAt: "x" } } })).keys()];
    expect(keys).toEqual(expect.arrayContaining(["trainingSession.enhancementLog|enh-x", "cycleGoals|cycle-1"]));
  });
});

describe("day logs", () => {
  it("union by date; a day both sides logged keeps every meal", () => {
    const meal = (id: string, protein: number) => ({ id, name: id, protein, carbs: 0, fat: 0, calories: protein * 4, loggedAt: null });
    const day = (meals: ReturnType<typeof meal>[]) => ({ date: "2026-09-17", meals, totalProtein: 0, totalCarbs: 0, totalFat: 0, totalCalories: 0 });
    const local = { training: {}, nutrition: { "2026-09-17": day([meal("m1", 40)]) }, recovery: { "2026-09-16": { date: "2026-09-16" } }, pendingSync: [] };
    const cloud = { training: { "2026-09-15": { date: "2026-09-15" } }, nutrition: { "2026-09-17": day([meal("m2", 30)]) }, recovery: {}, pendingSync: [] };
    const merged = mergeLocalLogs(local as never, cloud as never, "local");
    expect(Object.keys(merged.training)).toEqual(["2026-09-15"]);
    expect(Object.keys(merged.recovery)).toEqual(["2026-09-16"]);
    const nutrition = merged.nutrition["2026-09-17"];
    expect(nutrition.meals.map((m) => m.id).sort()).toEqual(["m1", "m2"]);
    expect(nutrition.totalProtein).toBe(70);
  });
});
