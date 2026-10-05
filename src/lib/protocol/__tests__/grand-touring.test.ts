import { describe, expect, it } from "vitest";

import {
  getProtocol,
  protocolProduct,
  activateProtocol,
  PROTOCOL_LIBRARY,
  CATEGORY_LABEL,
} from "@/lib/protocol/library";
import { resolveWeeklyBlueprint } from "@/lib/training/split-blueprints";
import { resolveDailyTrainingContext } from "@/lib/training/daily-context";
import { DEFAULT_PHYSIQUE_FOCUS } from "@/lib/physique/types";

const GT_ID = "reserve-grand-touring";

/* ─── Brand rule: private performance house, never creator-led ─────────────── */

const FORBIDDEN = [
  /founder/i, /owner'?s\b/i, /creator/i, /personal split/i, /personal routine/i,
  /my (personal )?(split|routine|program|week)/i, /bodybuilding \+ track/i,
  /built by/i, /celebrity/i,
];

function allGtText(): string {
  const def = getProtocol(GT_ID)!;
  const prod = protocolProduct(GT_ID)!;
  return JSON.stringify({ def, prod });
}

describe("Reserve Grand Touring — brand compliance", () => {
  it("exposes no founder / owner / creator / personal-split language", () => {
    const text = allGtText();
    for (const re of FORBIDDEN) {
      expect(re.test(text), `forbidden pattern ${re} appeared in Grand Touring copy`).toBe(false);
    }
  });

  it("renders the private-performance identity", () => {
    const def = getProtocol(GT_ID)!;
    expect(def.name).toBe("Reserve Grand Touring");
    expect(def.category).toBe("hybrid-performance");
    expect(CATEGORY_LABEL["hybrid-performance"]).toBe("Hybrid Performance");
    expect(def.tagline).toMatch(/Physique precision\. Distance capacity\./);
    const prod = protocolProduct(GT_ID)!;
    expect(prod.nutritionBias.intent).toBe("high-output-hybrid");
    expect(prod.weeklyStructure.length).toBeGreaterThanOrEqual(3);
  });
});

/* ─── Runtime sync: selecting Grand Touring drives the live week ───────────── */

function gtWeekTitles(over: Partial<Parameters<typeof resolveDailyTrainingContext>[0]> = {}) {
  const ap = activateProtocol(getProtocol(GT_ID)!);
  const ctx = resolveDailyTrainingContext({
    now: new Date("2026-07-21T12:00:00"),
    focus: DEFAULT_PHYSIQUE_FOCUS,
    weakPoints: [],
    protocolName: ap.protocolName,
    protocolArchitectureName: ap.protocolName,
    womensActive: false,
    protocolId: ap.protocolId,
    protocolCategory: ap.category,
    trainingDaysTarget: 6,
    recoveryPreference: "Balanced",
    weekNumber: 1,
    splitSystemChosen: false,
    ...over,
  });
  return ctx.weeklyPlan.map((d) => d.displayTitle);
}

describe("Reserve Grand Touring — runtime week synchronization", () => {
  it("drives a hybrid week (push / pull / lower + conditioning + outdoor distance)", () => {
    const titles = gtWeekTitles();
    const joined = titles.join(" | ").toLowerCase();
    expect(joined).toMatch(/outdoor distance/);
    expect(joined).toMatch(/push/);
    expect(joined).toMatch(/pull/);
    expect(joined).toMatch(/conditioning/);
    expect(joined).toMatch(/posterior/);
  });

  it("never opens on a chest/back combo day — even with a CHEST focus set", () => {
    const titles = gtWeekTitles({
      focus: { ...DEFAULT_PHYSIQUE_FOCUS, primary: "chest", secondary: [] },
      weakPoints: ["Chest"],
    });
    // The bug: a chest focus used to force the legacy "Chest / Back A" skeleton.
    for (const t of titles) {
      expect(/chest\s*\/\s*back/i.test(t)).toBe(false);
    }
    // And the hybrid identity survives.
    expect(titles.join(" ").toLowerCase()).toMatch(/outdoor distance/);
  });

  it("a stale saved split no longer overrides it (selection is authoritative)", () => {
    // splitSystemChosen=false models selectProtocol having cleared the manual override.
    const titles = gtWeekTitles({ splitSystemChosen: false, splitSystemKey: "chest-priority" });
    expect(titles.join(" ").toLowerCase()).toMatch(/outdoor distance/);
  });
});

/* ─── Adaptive variants: the resolver adapts GT to real capacity ───────────── */

describe("Reserve Grand Touring — adaptive variants", () => {
  const build = (target: number) =>
    resolveWeeklyBlueprint({ protocolId: GT_ID, category: "hybrid-performance", trainingDaysTarget: target, recoveryPreference: "Balanced" })
      .week.map((d) => ({ title: d.title, recovery: Boolean(d.recovery) }));

  it("6-session week keeps outdoor + conditioning + core lifts", () => {
    const w = build(6);
    const training = w.filter((d) => !d.recovery);
    expect(training.length).toBe(6);
    const joined = training.map((d) => d.title).join(" ").toLowerCase();
    expect(joined).toMatch(/outdoor|distance/);
    expect(joined).toMatch(/conditioning/);
    expect(joined).toMatch(/push/);
    expect(joined).toMatch(/pull/);
  });

  it("4-session week preserves the hybrid identity (outdoor/conditioning retained, extra volume dropped)", () => {
    const w = build(4);
    expect(w.filter((d) => !d.recovery).length).toBe(4);
    // Still not a chest/back physique week.
    expect(w.some((d) => /chest\s*\/\s*back/i.test(d.title))).toBe(false);
  });

  it("differs from a physique protocol's week (real divergence, not a rename)", () => {
    const gt = build(6).map((d) => d.title).join("|");
    const physique = resolveWeeklyBlueprint({ protocolId: "12-week-physique", category: "transformation", trainingDaysTarget: 5 })
      .week.map((d) => d.title).join("|");
    expect(gt).not.toBe(physique);
  });
});

/* ─── Library integrity ───────────────────────────────────────────────────── */

describe("Reserve Grand Touring — library integrity", () => {
  it("is discoverable and distinct in the library", () => {
    expect(PROTOCOL_LIBRARY.some((d) => d.id === GT_ID)).toBe(true);
    expect(PROTOCOL_LIBRARY.filter((d) => d.category === "hybrid-performance")).toHaveLength(1);
  });
});
