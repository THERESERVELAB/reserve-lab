import { describe, expect, it } from "vitest";

import { DEMO_IDS, ensureDemoScenario } from "../fixtures";
import { todayKey } from "../ids";
import { ensureOperationsDemo } from "../operations/fixtures";
import {
  deriveBehavioralMomentum,
  deriveExecutionReadiness,
  deriveOperatingPriorities,
  deriveOperationalTimeline,
} from "../operations/overview";
import { CoachingStore, MemoryAdapter } from "../storage";

function seeded() {
  const store = new CoachingStore(new MemoryAdapter());
  ensureDemoScenario(store);
  ensureOperationsDemo(store);
  return store;
}

describe("operations overview derivations", () => {
  it("ranks decisions above monitoring and routes each priority to its section", () => {
    const store = seeded();
    store.write((db) => {
      const protocol = db.supplementProtocols.find((p) => p.id === "prot-anthony")!;
      protocol.status = "revision_requested";
    });
    const priorities = deriveOperatingPriorities(store.read(), DEMO_IDS.anthony);
    expect(priorities.length).toBeGreaterThan(0);
    expect(priorities[0].kind).toBe("decision_required");
    expect(priorities[0].section).toBe("protocols");
    // Ranks are non-decreasing — decisions always lead.
    for (let i = 1; i < priorities.length; i += 1) {
      expect(priorities[i].rank).toBeGreaterThanOrEqual(priorities[i - 1].rank);
    }
  });

  it("surfaces awaiting-athlete items and open grocery for Jasmine", () => {
    const store = seeded();
    const priorities = deriveOperatingPriorities(store.read(), DEMO_IDS.jasmine);
    const kinds = priorities.map((p) => p.kind);
    expect(kinds).toContain("awaiting_athlete"); // meal plan v2 is sent
    expect(kinds).toContain("grocery_incomplete");
  });

  it("reports supply running low from the active protocol", () => {
    const store = seeded();
    const priorities = deriveOperatingPriorities(store.read(), DEMO_IDS.anthony);
    const low = priorities.find((p) => p.kind === "supply_low");
    expect(low).toBeTruthy();
    expect(low!.detail).toContain("Magnesium");
  });

  it("readiness distinguishes established, attention, and absent systems", () => {
    const store = seeded();
    const anthony = deriveExecutionReadiness(store.read(), DEMO_IDS.anthony);
    expect(anthony.find((r) => r.id === "protocol")!.state).toBe("ready");
    expect(anthony.find((r) => r.id === "nutrition")!.state).toBe("ready");
    const luis = deriveExecutionReadiness(store.read(), DEMO_IDS.luis);
    expect(luis.find((r) => r.id === "protocol")!.state).toBe("not_established");
  });

  it("momentum records the win and stays non-empty even when quiet", () => {
    const store = seeded();
    const anthony = deriveBehavioralMomentum(store.read(), DEMO_IDS.anthony);
    expect(anthony.some((n) => n.kind === "win")).toBe(true);
    const noah = deriveBehavioralMomentum(store.read(), DEMO_IDS.noah);
    expect(noah.length).toBeGreaterThan(0);
  });

  it("timeline is future-dated, ascending, and capped", () => {
    const store = seeded();
    const today = todayKey();
    const timeline = deriveOperationalTimeline(store.read(), DEMO_IDS.anthony, today);
    expect(timeline.length).toBeGreaterThan(0);
    expect(timeline.length).toBeLessThanOrEqual(6);
    for (const entry of timeline) expect(entry.date >= today).toBe(true);
    for (let i = 1; i < timeline.length; i += 1) {
      expect(timeline[i].date >= timeline[i - 1].date).toBe(true);
    }
    // Luis: clinician-directed monitoring reminders appear.
    const luis = deriveOperationalTimeline(store.read(), DEMO_IDS.luis, today);
    expect(luis.some((e) => e.kind === "monitoring" || e.kind === "follow_up")).toBe(true);
  });

  it("is deterministic for the same snapshot", () => {
    const store = seeded();
    const db = store.read();
    expect(deriveOperatingPriorities(db, DEMO_IDS.jasmine, "2026-07-20"))
      .toEqual(deriveOperatingPriorities(db, DEMO_IDS.jasmine, "2026-07-20"));
  });
});
