import { describe, expect, it } from "vitest";

import type { DashboardView } from "@/lib/athlete-store";
import { isFeatureEnabled } from "@/lib/saas-config";

import { PHONE_TAB_ROOMS, resolvePhoneNavigation } from "../phone-tabs";
import { RESERVE_MODULES, resolveNavGroups, viewLabel, type ModuleContext } from "../registry";

/* Exhaustive by type: adding a DashboardView without listing it here fails tsc. */
const ALL_VIEWS: Record<DashboardView, true> = {
  dashboard: true,
  "my-coach": true,
  training: true,
  nutrition: true,
  physique: true,
  recovery: true,
  "progress-photos": true,
  measurements: true,
  "enhanced-monitor": true,
  bloodwork: true,
  supplements: true,
  journal: true,
  education: true,
  settings: true,
  "schedule-command": true,
  "protocol-command": true,
  "program-horizon": true,
  "response-profile": true,
  "lifestyle-builder": true,
  "physique-intelligence": true,
  "mesocycle-planner": true,
  "biomarker-intelligence": true,
  "performance-intelligence": true,
  "peak-physique": true,
  "ai-strategist": true,
  community: true,
  "womens-cycle": true,
  "womens-fertility": true,
  "womens-pregnancy": true,
};

const CORE_MEMBER: ModuleContext = {
  tier: "core",
  profilePath: "mens-performance",
  womensEnabled: false,
  enhancedLogOnly: false,
  overrides: {},
};

describe("viewLabel", () => {
  it("names every view from the module registry", () => {
    for (const view of Object.keys(ALL_VIEWS) as DashboardView[]) {
      const entry = RESERVE_MODULES.find((m) => m.view === view);
      expect(entry, `${view} has a registry entry`).toBeDefined();
      expect(viewLabel(view)).toBe(entry!.label);
    }
  });

  it("never prints a raw id, even for a view missing from the registry", () => {
    expect(viewLabel("schedule-command")).toBe("Schedule Command");
    expect(viewLabel("future-room-view")).toBe("Future Room View");
    for (const view of Object.keys(ALL_VIEWS)) expect(viewLabel(view)).not.toMatch(/[a-z]+-[a-z]+/);
  });
});

describe("resolvePhoneNavigation", () => {
  it("puts the five rooms in tab order and everything else in More, once", () => {
    const groups = resolveNavGroups(CORE_MEMBER, isFeatureEnabled);
    const { tabs, moreGroups } = resolvePhoneNavigation(groups);

    expect(tabs.map((t) => t.tabLabel)).toEqual(["Apex", "Training", "Fuel", "Recovery", "Schedule"]);
    expect(tabs.map((t) => t.view)).toEqual(["dashboard", "training", "nutrition", "recovery", "schedule-command"]);
    expect(tabs.every((t) => !t.locked)).toBe(true);

    const moreIds = moreGroups.flatMap((g) => g.items.map((i) => i.id));
    const allIds = groups.flatMap((g) => g.items.map((i) => i.id));
    expect(new Set(moreIds).size).toBe(moreIds.length);
    expect([...tabs.map((t) => t.id), ...moreIds].sort()).toEqual([...allIds].sort());
    expect(moreGroups.every((g) => g.items.length > 0)).toBe(true);
  });

  it("keeps a locked room as a locked tab, the same as the Sidebar", () => {
    const groups = resolveNavGroups(CORE_MEMBER, (tier, feature) => feature !== "training" && isFeatureEnabled(tier, feature));
    const training = resolvePhoneNavigation(groups).tabs.find((t) => t.id === "training");
    expect(training?.locked).toBe(true);
  });

  it("omits a room the member cannot see instead of showing a dead tab", () => {
    const groups = resolveNavGroups(CORE_MEMBER, isFeatureEnabled).map((g) => ({
      ...g,
      items: g.items.filter((i) => i.id !== "recovery"),
    }));
    const { tabs, moreGroups } = resolvePhoneNavigation(groups);
    expect(tabs.map((t) => t.id)).not.toContain("recovery");
    expect(tabs).toHaveLength(PHONE_TAB_ROOMS.length - 1);
    expect(moreGroups.flatMap((g) => g.items.map((i) => i.id))).not.toContain("recovery");
  });
});
