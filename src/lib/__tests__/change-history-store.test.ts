import { beforeEach, describe, expect, it } from "vitest";

import { ENHANCEMENT_LOG_LIMIT, hydrateMemberState, resetMemberStateToDefaults, useAthleteDashboardStore, type EnhancementEntry } from "@/lib/athlete-store";
import { needsATime, timePatch } from "@/lib/compound-command/give-it-a-time";
import { supportOptionByKey } from "@/lib/compound-intelligence/support-options";
import { CHANGE_HISTORY_LIMIT } from "@/lib/history/change-events";
import { OBSERVATION_LIMIT, TIMELINE_NOTE_LIMIT } from "@/lib/history/types";
import { MEMBER_STATE_KEYS } from "@/lib/sync/state-contract";

/**
 * Change history is written by the store actions that change a plan — never
 * by hydration, cloud sync or a reset — and notes, observations and custom
 * supplements are member records like any other.
 */

const store = () => useAthleteDashboardStore.getState();
const actions = () => store().changeHistory.map((e) => `${e.subject.kind}:${e.action}`);

const newCompound: Omit<EnhancementEntry, "id" | "createdAt" | "updatedAt"> = {
  name: "Oxandrolone",
  officialName: "Oxandrolone",
  category: "hormone",
  doseAmount: "20",
  doseUnit: "mg",
  frequency: "daily",
  timingPreference: "",
  goalAssociation: [],
  isActive: true,
};

beforeEach(() => {
  resetMemberStateToDefaults();
});

describe("change history from store actions", () => {
  it("records adding, editing, pausing, resuming, deactivating and removing a compound", () => {
    store().addEnhancementEntry(newCompound);
    const id = store().trainingSession.enhancementLog[0].id;
    store().updateEnhancementEntry(id, { doseAmount: "25" });
    store().updateEnhancementEntry(id, { pausedAt: "2026-09-15" });
    store().updateEnhancementEntry(id, { pausedAt: undefined });
    store().toggleEnhancementEntryActive(id);
    store().removeEnhancementEntry(id);

    expect(actions()).toEqual(["compound:removed", "compound:deactivated", "compound:resumed", "compound:paused", "compound:edited", "compound:added"]);
    const edit = store().changeHistory.find((e) => e.action === "edited")!;
    expect(edit.subject.name).toBe("Oxandrolone");
    expect(edit.changes).toEqual([{ field: "doseAmount", label: "Amount", from: "20", to: "25" }]);
  });

  it("records edits made through the legacy log aliases too", () => {
    store().addEnhancementLogEntry(newCompound);
    const id = store().trainingSession.enhancementLog[0].id;
    store().updateEnhancementLogEntry(id, { frequency: "weekly" });
    store().removeEnhancementLogEntry(id);
    expect(actions()).toEqual(["compound:removed", "compound:edited", "compound:added"]);
  });

  it("records a cycle's life: added, edited, checkpoints, ended, reopened, removed", () => {
    const id = store().addCyclePeriod({ name: "Fall cycle", startDate: "2026-07-01", plannedWeeks: 12, compoundIds: [], clinicianOversight: false });
    store().updateCyclePeriod(id, { plannedWeeks: 16 });
    store().addCycleCheckpoint(id, { date: "2026-08-01", label: "Mid labs", setBy: "member" });
    const checkpointId = store().cyclePeriods[0].checkpoints[0].id;
    store().removeCycleCheckpoint(id, checkpointId);
    store().endCyclePeriod(id, "completed", "2026-09-15");
    store().reopenCyclePeriod(id);
    store().removeCyclePeriod(id);

    expect(actions()).toEqual([
      "cycle:removed",
      "cycle:reopened",
      "cycle:ended",
      "cycle:checkpoint-removed",
      "cycle:checkpoint-added",
      "cycle:edited",
      "cycle:added",
    ]);
    expect(store().changeHistory.every((e) => e.subject.name === "Fall cycle")).toBe(true);
  });

  it("records support plan choices under the supplement's own name", () => {
    const title = supportOptionByKey("vitamin-d3")!.title;
    store().addSupportPlanItem("vitamin-d3");
    const id = store().supportPlan[0].id;
    store().updateSupportPlanItem(id, { amount: "2000", unit: "IU" });
    store().removeSupportPlanItem(id);
    expect(actions()).toEqual(["support-plan:removed", "support-plan:edited", "support-plan:added"]);
    expect(store().changeHistory.every((e) => e.subject.name === title)).toBe(true);
  });

  it("adds custom supplements by name, once, and records them", () => {
    expect(store().addCustomSupportPlanItem("  Tongkat ali ")).toEqual({ planItemId: expect.any(String), entryId: expect.any(String), name: "Tongkat ali" });
    expect(store().addCustomSupportPlanItem("tongkat ALI")).toBeNull();
    expect(store().addCustomSupportPlanItem("   ")).toBeNull();
    expect(store().supportPlan).toEqual([expect.objectContaining({ optionKey: "custom", customTitle: "Tongkat ali" })]);
    expect(actions()).toEqual(["support-plan:added"]);
    expect(store().changeHistory[0].subject.name).toBe("Tongkat ali");
  });

  it("never records history from hydration or cloud sync, and ignores garbage history", () => {
    hydrateMemberState({
      trainingSession: { enhancementLog: [{ ...newCompound, id: "synced", createdAt: "x", updatedAt: "x" }] },
      cyclePeriods: [{ id: "c", name: "Synced", startDate: "2026-07-01", plannedWeeks: 12, compoundIds: [], clinicianOversight: false, checkpoints: [], createdAt: "", updatedAt: "" }],
      changeHistory: "not a list",
      timelineNotes: { nope: true },
      observations: 42,
    });
    expect(store().changeHistory).toEqual([]);
    expect(store().timelineNotes).toEqual([]);
    expect(store().observations).toEqual([]);
  });

  it("keeps history to its limit and clears everything at the account boundary", () => {
    store().addEnhancementEntry(newCompound);
    const id = store().trainingSession.enhancementLog[0].id;
    for (let i = 0; i < CHANGE_HISTORY_LIMIT + 5; i += 1) store().toggleEnhancementEntryActive(id);
    expect(store().changeHistory).toHaveLength(CHANGE_HISTORY_LIMIT);
    // Starts active; an odd number of toggles ends deactivated.
    expect(store().changeHistory[0].action).toBe("deactivated");
    store().addTimelineNote({ date: "2026-09-15", text: "Note" });
    resetMemberStateToDefaults();
    expect(store().changeHistory).toEqual([]);
    expect(store().timelineNotes).toEqual([]);
    expect(store().observations).toEqual([]);
  });
});

describe("timeline notes and observations", () => {
  it("adds, edits and removes dated notes, rejecting blanks and bad dates", () => {
    const id = store().addTimelineNote({ date: "2026-09-15", text: "  Started logging sleep  " });
    expect(id).toEqual(expect.any(String));
    expect(store().addTimelineNote({ date: "2026-09-15", text: "   " })).toBeNull();
    expect(store().addTimelineNote({ date: "15/09/2026", text: "Bad date" })).toBeNull();
    expect(store().timelineNotes).toEqual([expect.objectContaining({ date: "2026-09-15", text: "Started logging sleep" })]);

    store().updateTimelineNote(id!, { text: "Started logging sleep nightly" });
    expect(store().timelineNotes[0].text).toBe("Started logging sleep nightly");
    store().removeTimelineNote(id!);
    expect(store().timelineNotes).toEqual([]);
  });

  it("adds structured observations exactly as the member chose them", () => {
    const id = store().addObservation({
      date: "2026-09-15",
      changed: { kind: "compound", ref: "e1", label: "Oxandrolone" },
      noticed: { kind: "marker", ref: "hdl", label: "HDL cholesterol" },
      note: "  Noticed on my last report  ",
    });
    expect(id).toEqual(expect.any(String));
    expect(store().observations[0]).toMatchObject({
      changed: { kind: "compound", ref: "e1", label: "Oxandrolone" },
      noticed: { kind: "marker", ref: "hdl", label: "HDL cholesterol" },
      note: "Noticed on my last report",
    });
    expect(store().addObservation({ date: "2026-09-15", changed: { kind: "text", label: " " }, noticed: { kind: "text", label: "Sleep" } })).toBeNull();
    store().removeObservation(id!);
    expect(store().observations).toEqual([]);
  });

  it("keeps notes and observations to their limits, newest first", () => {
    for (let i = 0; i < TIMELINE_NOTE_LIMIT + 3; i += 1) store().addTimelineNote({ date: "2026-09-15", text: `Note ${i}` });
    expect(store().timelineNotes).toHaveLength(TIMELINE_NOTE_LIMIT);
    expect(store().timelineNotes[0].text).toBe(`Note ${TIMELINE_NOTE_LIMIT + 2}`);
    for (let i = 0; i < OBSERVATION_LIMIT + 3; i += 1) {
      store().addObservation({ date: "2026-09-15", changed: { kind: "text", label: `Change ${i}` }, noticed: { kind: "text", label: "Energy" } });
    }
    expect(store().observations).toHaveLength(OBSERVATION_LIMIT);
  });

  it("syncs the new records with the member's own data", () => {
    for (const key of ["changeHistory", "timelineNotes", "observations"]) expect(MEMBER_STATE_KEYS).toContain(key);
  });
});

describe("support plan items on the schedule", () => {
  it("puts a chosen supplement on the schedule untimed, once, without a second timeline event", () => {
    store().addSupportPlanItem("vitamin-d3");
    const log = store().trainingSession.enhancementLog;
    const entry = log.find((e) => e.supportPlanItemId === store().supportPlan[0].id)!;
    expect(entry).toMatchObject({ name: "Vitamin D3", category: "vitamin", timeOfDayPreference: "unspecified", isActive: true });
    expect(entry.scheduleReviewReason).toMatch(/Set when and how often/);
    expect(actions()).toEqual(["support-plan:added"]);
    expect(store().syncSupportPlanToSchedule()).toEqual({ added: 0, skippedFull: 0 });
  });

  it("hands back the entry it created, so the member can be asked when they take it", () => {
    const added = store().addSupportPlanItem("creatine");
    expect(added).toMatchObject({ name: "Creatine Monohydrate", entryId: expect.any(String) });
    const entry = store().trainingSession.enhancementLog.find((e) => e.id === added!.entryId)!;
    /* Untimed, so it lands on no day until the member answers. */
    expect(needsATime(entry)).toBe(true);

    store().updateEnhancementEntry(entry.id, timePatch("custom", "16:00")!);
    const timed = store().trainingSession.enhancementLog.find((e) => e.id === added!.entryId)!;
    expect(timed).toMatchObject({ timeOfDayPreference: "custom", customTime: "16:00", scheduleRule: { type: "daily" } });
    expect(needsATime(timed)).toBe(false);
  });

  it("has nothing to ask about when the option is already in the plan", () => {
    expect(store().addSupportPlanItem("creatine")).not.toBeNull();
    expect(store().addSupportPlanItem("creatine")).toBeNull();
  });

  it("does not duplicate something already logged under the same name", () => {
    store().addEnhancementEntry({ ...newCompound, name: "Tongkat ali", officialName: undefined, category: "supplement" });
    store().addCustomSupportPlanItem("tongkat ALI");
    expect(store().trainingSession.enhancementLog.filter((e) => e.name.toLowerCase() === "tongkat ali")).toHaveLength(1);
  });

  it("catches up plan items added before, and never pushes anything out of a full log", () => {
    useAthleteDashboardStore.setState((s) => ({
      supportPlan: [{ id: "old-plan", optionKey: "fish-oil", addedAt: "2026-09-01T00:00:00.000Z" }],
      trainingSession: { ...s.trainingSession, enhancementLog: Array.from({ length: ENHANCEMENT_LOG_LIMIT }, (_, i) => ({ ...newCompound, name: `Compound ${i}`, id: `c${i}`, createdAt: "", updatedAt: "" })) },
    }));
    expect(store().syncSupportPlanToSchedule()).toEqual({ added: 0, skippedFull: 1 });
    expect(store().trainingSession.enhancementLog).toHaveLength(ENHANCEMENT_LOG_LIMIT);
    useAthleteDashboardStore.setState((s) => ({ trainingSession: { ...s.trainingSession, enhancementLog: s.trainingSession.enhancementLog.slice(0, ENHANCEMENT_LOG_LIMIT - 1) } }));
    expect(store().syncSupportPlanToSchedule()).toEqual({ added: 1, skippedFull: 0 });
    expect(store().trainingSession.enhancementLog[0]).toMatchObject({ name: "Fish Oil", supportPlanItemId: "old-plan" });
  });
});
