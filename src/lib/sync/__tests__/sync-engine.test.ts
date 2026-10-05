import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/* The real sync engine, the real store and the real change ledger, against a
   fake member_state table. "Device B" is simulated by writing the cloud row
   directly, exactly as another phone or computer would. */

const env = vi.hoisted(() => {
  class MemoryStorage {
    private map = new Map<string, string>();
    get length() {
      return this.map.size;
    }
    key(i: number) {
      return [...this.map.keys()][i] ?? null;
    }
    getItem(k: string) {
      return this.map.has(k) ? this.map.get(k)! : null;
    }
    setItem(k: string, v: string) {
      this.map.set(k, String(v));
    }
    removeItem(k: string) {
      this.map.delete(k);
    }
    clear() {
      this.map.clear();
    }
  }
  const g = globalThis as Record<string, unknown>;
  const storage = new MemoryStorage();
  const windowTarget = new EventTarget();
  const documentTarget = new EventTarget();
  g.localStorage = storage;
  g.window = globalThis;
  g.addEventListener = windowTarget.addEventListener.bind(windowTarget);
  g.removeEventListener = windowTarget.removeEventListener.bind(windowTarget);
  g.dispatchEvent = windowTarget.dispatchEvent.bind(windowTarget);
  const doc = {
    visibilityState: "visible",
    addEventListener: documentTarget.addEventListener.bind(documentTarget),
    removeEventListener: documentTarget.removeEventListener.bind(documentTarget),
    dispatchEvent: documentTarget.dispatchEvent.bind(documentTarget),
  };
  g.document = doc;
  Object.defineProperty(globalThis.navigator, "onLine", { value: true, configurable: true });

  type Row = { user_id: string; state: unknown; schema_version: number; updated_at: string };
  const db = {
    row: null as Row | null,
    tick: Date.parse("2026-09-18T12:00:00.000Z"),
    writes: [] as Array<{ op: string; ok: boolean }>,
    now(): string {
      db.tick += 1_000;
      return new Date(db.tick).toISOString();
    },
  };

  class Query {
    private op: "select" | "update" | "insert" = "select";
    private cols = "*";
    private payload: Record<string, unknown> = {};
    private filters: Array<[string, unknown]> = [];
    select(cols: string) {
      this.cols = cols;
      return this;
    }
    update(payload: Record<string, unknown>) {
      this.op = "update";
      this.payload = payload;
      return this;
    }
    insert(payload: Record<string, unknown>) {
      this.op = "insert";
      this.payload = payload;
      return this;
    }
    eq(col: string, value: unknown) {
      this.filters.push([col, value]);
      return this;
    }
    maybeSingle() {
      return Promise.resolve(this.exec());
    }
    single() {
      return Promise.resolve(this.exec());
    }
    private pick(row: Row) {
      if (this.cols === "*") return { ...row };
      const out: Record<string, unknown> = {};
      for (const c of this.cols.split(",").map((s) => s.trim())) out[c] = (row as Record<string, unknown>)[c];
      return JSON.parse(JSON.stringify(out));
    }
    private matches(row: Row) {
      return this.filters.every(([c, v]) => (row as Record<string, unknown>)[c] === v);
    }
    private exec(): { data: unknown; error: unknown } {
      if (this.op === "select") {
        return { data: db.row && this.matches(db.row) ? this.pick(db.row) : null, error: null };
      }
      if (this.op === "update") {
        if (!db.row || !this.matches(db.row)) {
          db.writes.push({ op: "update", ok: false });
          return { data: null, error: null };
        }
        db.row = { ...db.row, ...(JSON.parse(JSON.stringify(this.payload)) as object), updated_at: db.now() } as Row;
        db.writes.push({ op: "update", ok: true });
        return { data: this.pick(db.row), error: null };
      }
      if (db.row) return { data: null, error: { code: "23505", message: "duplicate key" } };
      db.row = { ...(JSON.parse(JSON.stringify(this.payload)) as Row), updated_at: db.now() };
      db.writes.push({ op: "insert", ok: true });
      return { data: this.pick(db.row), error: null };
    }
  }
  const client = { from: () => new Query() };
  return { storage, db, client, doc };
});

vi.mock("@/lib/supabase/client", () => ({
  getBrowserSupabaseClient: () => env.client,
  isSupabaseBrowserConfigured: () => true,
}));

import { hydrateMemberState, resetMemberStateToDefaults, serializeMemberState, useAthleteDashboardStore, type EnhancementEntry } from "@/lib/athlete-store";
import { requestSyncFlush } from "@/lib/sync/flush-signal";
import { listBackups } from "@/lib/sync/local-backup";
import { startMemberSync, stopMemberSync } from "@/lib/sync/sync-engine";
import { CLOUD_SCHEMA_VERSION } from "@/lib/sync/state-contract";
import { useSyncStatusStore } from "@/lib/sync/sync-status";

const USER = "11111111-2222-3333-4444-555555555555";

type Log = EnhancementEntry[];
const logNow = (): Log => useAthleteDashboardStore.getState().trainingSession.enhancementLog ?? [];
const namesNow = () => logNow().map((e) => e.name).sort();
const cloudSlices = () => (env.db.row?.state as { slices: Record<string, unknown> }).slices;
const cloudLog = (): Log => ((cloudSlices().trainingSession as { enhancementLog?: Log }).enhancementLog ?? []);
const cloudNames = () => cloudLog().map((e) => e.name).sort();

const compound = (id: string, name: string, createdAt: string): EnhancementEntry =>
  ({ id, name, category: "hormone", isActive: true, createdAt, updatedAt: createdAt }) as unknown as EnhancementEntry;

/** Another device writes the row: takes the current cloud slices, changes them, bumps updated_at. */
function deviceBWrites(change: (slices: Record<string, unknown>) => Record<string, unknown>) {
  const slices = env.db.row ? cloudSlices() : {};
  env.db.row = {
    user_id: USER,
    schema_version: CLOUD_SCHEMA_VERSION,
    state: { envelope: CLOUD_SCHEMA_VERSION, storeVersion: 19, serializedAt: new Date().toISOString(), slices: change(JSON.parse(JSON.stringify(slices))) },
    updated_at: env.db.now(),
  };
}

function withLog(slices: Record<string, unknown>, log: Log): Record<string, unknown> {
  const ts = (slices.trainingSession ?? {}) as Record<string, unknown>;
  return { ...slices, trainingSession: { ...ts, enhancementLog: log } };
}

const flushed = () => vi.waitFor(() => expect(useSyncStatusStore.getState().status).toBe("saved"), { timeout: 2_000 });

beforeEach(async () => {
  await stopMemberSync({ flush: false });
  env.storage.clear();
  env.db.row = null;
  env.db.writes = [];
  resetMemberStateToDefaults();
  useSyncStatusStore.setState({ status: "local-only", lastSavedAt: null, detail: null });
  env.doc.visibilityState = "visible";
});

afterEach(async () => {
  await stopMemberSync({ flush: false });
});

describe("sync engine — merge instead of overwrite", () => {
  it("a brand-new member creates the row", async () => {
    await startMemberSync(USER);
    expect(env.db.row).not.toBeNull();
    expect(env.db.writes).toEqual([{ op: "insert", ok: true }]);
  });

  it("first upload of real local progress keeps this device's copy over a blank cloud row", async () => {
    hydrateMemberState({ onboarding: { status: "complete" }, profile: { ...useAthleteDashboardStore.getState().profile, name: "Tony" } });
    deviceBWrites(() => ({ ...serializeMemberState(), syncLedger: undefined, onboarding: { status: "not-started" }, profile: { name: "" } }));
    await startMemberSync(USER);
    await flushed();
    expect(useAthleteDashboardStore.getState().profile.name).toBe("Tony");
    expect((cloudSlices().profile as { name: string }).name).toBe("Tony");
  });

  it("hydrate with both sides populated merges them (and backs both up)", async () => {
    // This device logged Testosterone; the cloud has Somatropin from another device.
    useAthleteDashboardStore.getState().addEnhancementEntry({ name: "Testosterone Enanthate", category: "hormone", isActive: true } as never);
    env.storage.setItem("fba-sync-meta", JSON.stringify({ userId: USER, lastSyncedAt: "2026-09-10T00:00:00.000Z", lastLocalChangeAt: new Date().toISOString() }));
    deviceBWrites((s) => withLog({ ...s, onboarding: { status: "complete" } }, [compound("enh-hgh", "Somatropin", "2026-09-15T23:22:00.000Z")]));

    await startMemberSync(USER);
    await flushed();

    expect(namesNow()).toEqual(["Somatropin", "Testosterone Enanthate"]);
    expect(cloudNames()).toEqual(["Somatropin", "Testosterone Enanthate"]);
    const tags = listBackups().map((b) => b.tag);
    expect(tags).toEqual(expect.arrayContaining(["pre-hydrate", "cloud-pre-merge"]));
  });

  it("a push that finds the cloud advanced merges first — the other device's record survives", async () => {
    await startMemberSync(USER);
    // Device B adds Masteron after our last sync.
    deviceBWrites((s) => withLog(s, [compound("enh-mast", "Drostanolone Enanthate", "2026-09-16T02:43:00.000Z")]));
    // We add a supplement and flush.
    useAthleteDashboardStore.getState().addEnhancementEntry({ name: "Creatine", category: "supplement", isActive: true } as never);
    requestSyncFlush("manual");
    await flushed();

    expect(cloudNames()).toEqual(["Creatine", "Drostanolone Enanthate"]);
    expect(namesNow()).toEqual(["Creatine", "Drostanolone Enanthate"]);
    // The first conditional write was refused, then the merged write landed.
    expect(env.db.writes.filter((w) => w.op === "update")).toEqual([{ op: "update", ok: false }, { op: "update", ok: true }]);
  });

  it("owner regression: a stale device adding 13 supplements keeps all four compounds", async () => {
    const base = [compound("enh-reta", "Retatrutide", "2026-09-10T12:00:00.000Z")];
    const compounds = [
      compound("enh-1789510439098-vnduu", "Testosterone Enanthate", "2026-09-15T22:13:00.000Z"),
      compound("enh-1789514525470-33xxb", "Somatropin", "2026-09-15T23:22:00.000Z"),
      compound("enh-1789526595954-x3qz0", "Drostanolone Enanthate", "2026-09-16T02:43:00.000Z"),
      compound("enh-1789589215736-wcbs6", "Testosterone Enanthate (2)", "2026-09-16T20:06:00.000Z"),
    ];
    // The phone synced when only Retatrutide existed…
    deviceBWrites((s) => withLog({ ...s, onboarding: { status: "complete" } }, base));
    const phoneSyncedAt = env.db.row!.updated_at;
    hydrateMemberState(cloudSlices());
    env.storage.setItem("fba-sync-meta", JSON.stringify({ userId: USER, lastSyncedAt: phoneSyncedAt, lastLocalChangeAt: null }));
    // …then the desktop added the four compounds.
    deviceBWrites((s) => withLog(s, [...compounds].reverse().concat(base)));

    // The phone (this device) comes back online with its stale copy and adds 13 supplements.
    const add = useAthleteDashboardStore.getState().addEnhancementEntry;
    for (let i = 1; i <= 13; i += 1) add({ name: `Supplement ${String(i).padStart(2, "0")}`, category: "supplement", isActive: true } as never);
    await startMemberSync(USER);
    await flushed();

    expect(cloudLog()).toHaveLength(18); // 1 + 4 + 13
    for (const c of compounds) expect(cloudLog().some((e) => e.id === c.id)).toBe(true);
    expect(logNow()).toHaveLength(18);
  });
});

describe("sync engine — live across devices", () => {
  it("an edit on another device appears here when the tab regains focus", async () => {
    await startMemberSync(USER);
    await flushed();
    deviceBWrites((s) => withLog(s, [compound("enh-hgh", "Somatropin", "2026-09-18T12:00:00.000Z")]));
    expect(namesNow()).toEqual([]);

    // Focus arrives later than the focus-pull throttle after start-up.
    const later = Date.now() + 10_000;
    const clock = vi.spyOn(Date, "now").mockReturnValue(later);
    try {
      window.dispatchEvent(new Event("focus"));
      await vi.waitFor(() => expect(namesNow()).toEqual(["Somatropin"]), { timeout: 2_000 });
    } finally {
      clock.mockRestore();
    }
    // Nothing on this device was missing from the cloud, so nothing is written
    // back (hydration's own normalization is not a member change) — and a
    // second pull finds nothing new either.
    const writesAfterFirstPull = env.db.writes.length;
    expect(env.db.writes.filter((w) => w.op === "update" && w.ok)).toHaveLength(0);
    const clock2 = vi.spyOn(Date, "now").mockReturnValue(later + 60_000);
    try {
      window.dispatchEvent(new Event("focus"));
      await new Promise((resolve) => setTimeout(resolve, 50));
    } finally {
      clock2.mockRestore();
    }
    expect(env.db.writes.length).toBe(writesAfterFirstPull);
  });

  it("the visible tab polls on an interval and backs off when nothing changes", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    try {
      await startMemberSync(USER);
      deviceBWrites((s) => withLog(s, [compound("enh-mast", "Drostanolone Enanthate", "2026-09-18T12:00:00.000Z")]));
      await vi.advanceTimersByTimeAsync(60_000);
      expect(namesNow()).toEqual(["Drostanolone Enanthate"]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("a hidden tab does not poll", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    try {
      await startMemberSync(USER);
      env.doc.visibilityState = "hidden";
      document.dispatchEvent(new Event("visibilitychange"));
      await vi.advanceTimersByTimeAsync(0);
      deviceBWrites((s) => withLog(s, [compound("enh-mast", "Drostanolone Enanthate", "2026-09-18T12:00:00.000Z")]));
      await vi.advanceTimersByTimeAsync(5 * 60_000);
      expect(namesNow()).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("a deletion here sticks even though the other device still has the record", async () => {
    await startMemberSync(USER);
    useAthleteDashboardStore.getState().addEnhancementEntry({ name: "Collagen Peptides", category: "supplement", isActive: true } as never);
    requestSyncFlush("manual");
    await flushed();
    const id = logNow()[0].id;
    // Device B made an unrelated change while still holding Collagen.
    deviceBWrites((s) => ({ ...s, settings: { ...(s.settings as object), theme: "b" } }));
    useAthleteDashboardStore.getState().removeEnhancementEntry(id);
    requestSyncFlush("manual");
    await flushed();
    expect(cloudLog()).toEqual([]);
    expect(logNow()).toEqual([]);
  });
});

describe("sync engine — clock skew", () => {
  it("a cloud updated_at within SKEW_MS of our last sync is not treated as a newer cloud", async () => {
    // Legacy data (no ledgers). Local changed the settings after the last sync;
    // the cloud row's time is only 1s past the sync mark (server/device skew).
    hydrateMemberState({ onboarding: { status: "complete" }, settings: { ...useAthleteDashboardStore.getState().settings, units: "kg" } });
    const lastSync = "2026-09-18T12:00:00.000Z";
    env.storage.setItem("fba-sync-meta", JSON.stringify({ userId: USER, lastSyncedAt: lastSync, lastLocalChangeAt: "2026-09-18T12:00:00.500Z" }));
    env.db.row = {
      user_id: USER,
      schema_version: CLOUD_SCHEMA_VERSION,
      state: { envelope: CLOUD_SCHEMA_VERSION, storeVersion: 19, serializedAt: lastSync, slices: { ...serializeMemberState(), syncLedger: undefined, settings: { ...useAthleteDashboardStore.getState().settings, units: "lb" } } },
      updated_at: "2026-09-18T12:00:01.000Z",
    };
    await startMemberSync(USER);
    await flushed();
    expect((useAthleteDashboardStore.getState().settings as unknown as { units: string }).units).toBe("kg");
    expect((cloudSlices().settings as { units: string }).units).toBe("kg");
  });
});
