import { describe, expect, expectTypeOf, it } from "vitest";

import type { SourceSystem } from "@/lib/ai-strategist/types";
import type { DashboardView } from "@/lib/athlete-store";
import { RESERVE_MODULES } from "@/lib/modules/registry";
import { isFeatureEnabled, VIEW_FEATURE_MAP, type SubscriptionTier } from "@/lib/saas-config";

import { canAccessView, isDashboardView, sourceToView } from "../source-to-view";

const TIERS: SubscriptionTier[] = ["core", "pro", "elite"];

/* Every value `SourceSystem` can take, spelled the way the strategist emits it.
   A Record, so a new source fails the typecheck here until its link is decided. */
const SOURCE_VIEWS: Record<SourceSystem, DashboardView | null> = {
  Schedule: "schedule-command",
  Training: "training",
  Nutrition: "nutrition",
  Recovery: "recovery",
  Physique: "physique",
  Strategist: null,
  Bloodwork: "bloodwork",
  Compound: "supplements",
  "Women's Performance": null,
  Cycle: null,
  Fertility: null,
  Pregnancy: null,
};

/* Every case the mapping handles, keyed as it matches (trimmed, lowercase). */
const CASES: [key: string, view: DashboardView][] = [
  ["training", "training"],
  ["nutrition", "nutrition"],
  ["recovery", "recovery"],
  ["schedule", "schedule-command"],
  ["physique", "physique"],
  ["bloodwork", "bloodwork"],
  ["supplements", "supplements"],
  ["compound", "supplements"],
  ["compounds", "supplements"],
];

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

describe("sourceToView", () => {
  it("routes every SourceSystem value as the strategist spells it", () => {
    for (const [source, view] of Object.entries(SOURCE_VIEWS)) {
      expect(sourceToView(source), source).toBe(view);
    }
  });

  it("matches the capitalised and the lowercase spelling of every case", () => {
    for (const [key, view] of CASES) {
      expect(sourceToView(key), key).toBe(view);
      expect(sourceToView(capitalise(key)), capitalise(key)).toBe(view);
    }
  });

  it("ignores surrounding whitespace and letter case", () => {
    expect(sourceToView("  Bloodwork ")).toBe("bloodwork");
    expect(sourceToView("COMPOUNDS")).toBe("supplements");
  });

  it("returns null for a source without a command view", () => {
    for (const source of ["", "   ", "unknown", "Strategy"]) {
      expect(sourceToView(source), JSON.stringify(source)).toBeNull();
    }
  });
});

describe("canAccessView — the check ViewRouter makes before rendering a view", () => {
  it("opens Compound Command (supplements) only to the Reserve Black ranks", () => {
    expect(canAccessView("core", "supplements")).toBe(false);
    expect(canAccessView("pro", "supplements")).toBe(true);
    expect(canAccessView("elite", "supplements")).toBe(true);
  });

  it("follows each view's feature tier", () => {
    for (const tier of TIERS) expect(canAccessView(tier, "dashboard"), tier).toBe(true);
    expect(canAccessView("core", "bloodwork")).toBe(false);
    expect(canAccessView("pro", "ai-strategist")).toBe(false);
    expect(canAccessView("elite", "ai-strategist")).toBe(true);
  });

  it("agrees with the sidebar lock for every registered module at every tier", () => {
    for (const entry of RESERVE_MODULES) {
      for (const tier of TIERS) {
        expect(canAccessView(tier, entry.view), `${entry.id} · ${tier}`).toBe(isFeatureEnabled(tier, entry.feature));
      }
    }
  });
});

describe("isDashboardView", () => {
  it("accepts every view the router maps to a feature", () => {
    expectTypeOf<keyof typeof VIEW_FEATURE_MAP>().toEqualTypeOf<DashboardView>();
    for (const view of Object.keys(VIEW_FEATURE_MAP)) {
      expect(isDashboardView(view), view).toBe(true);
    }
  });

  it("rejects strings that are not views, including inherited object keys", () => {
    for (const value of ["", "Training", "compound", "toString", "__proto__"]) {
      expect(isDashboardView(value), value).toBe(false);
    }
  });
});
