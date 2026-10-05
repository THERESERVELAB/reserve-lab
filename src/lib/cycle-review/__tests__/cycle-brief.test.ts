import { describe, expect, it } from "vitest";

import { buildCompoundRiskBrief } from "@/lib/compound-intelligence/risk-profiles";
import { buildLabSafetyBrief } from "@/lib/labs/lab-safety";
import { bannedLanguageIn } from "@/lib/safety/__tests__/compliance-language";

import { HARM_REDUCTION_FACTS, buildCycleBrief } from "../cycle-brief";

/**
 * Everything to know while on a cycle, from the member's own compounds and
 * labs — never what to take, how much or when.
 */
describe("cycle brief", () => {
  const brief = buildCompoundRiskBrief([{ name: "Masteron" }, { name: "Testosterone Enanthate" }]);
  const labBrief = buildLabSafetyBrief({
    records: [
      {
        id: "lab-1",
        testDate: "2026-09-01",
        markers: [
          { name: "Hematocrit", markerKey: "hematocrit", value: "53.1", unit: "%", referenceRange: "38.5-50.0", flag: "H" },
          { name: "HDL Cholesterol", markerKey: "hdl", value: "41", unit: "mg/dL", referenceRange: ">39" },
        ],
      },
    ] as never,
    markerLinks: brief.markerLinks,
    now: new Date(2026, 8, 16),
  });
  const result = buildCycleBrief({ today: "2026-09-16", compoundNames: ["Masteron", "Testosterone Enanthate"], brief, labBrief, cycleState: null })!;

  it("shows the affected systems with the compounds that affect them", () => {
    const labels = result.systems.map((s) => s.system);
    expect(labels).toEqual(expect.arrayContaining(["cardiovascular", "blood", "lipids", "prostate", "skin", "fertility"]));
    expect(labels).not.toContain("sourcing");
    const blood = result.systems.find((s) => s.system === "blood")!;
    expect(blood.compoundNames).toEqual(expect.arrayContaining(["Masteron", "Testosterone Enanthate"]));
  });

  it("puts flagged and never-tested markers first, with the latest result", () => {
    expect(result.watch[0]).toMatchObject({ key: "hematocrit", status: "flagged", latest: { valueText: "53.1", daysAgo: 15 } });
    expect(result.watch.find((m) => m.key === "hdl")?.status).toBe("recent");
    expect(result.watch.find((m) => m.key === "psa")?.status).toBe("never");
    expect(result.glance.flaggedResults).toBe(1);
  });

  it("groups warning signs by where they send the member", () => {
    expect(result.warningSigns.emergency.join(" ")).toMatch(/Chest pain/);
    expect(result.warningSigns.crisis.length).toBeGreaterThan(0);
  });

  it("is empty with no running compounds or only supplements", () => {
    expect(buildCycleBrief({ today: "2026-09-16", compoundNames: [], brief: buildCompoundRiskBrief([]), labBrief: null, cycleState: null })).toBeNull();
    expect(buildCycleBrief({ today: "2026-09-16", compoundNames: ["Creatine"], brief: buildCompoundRiskBrief([{ name: "Creatine Monohydrate" }]), labBrief: null, cycleState: null })).toBeNull();
  });

  it("never says what to take, how much or when, and cites every harm-reduction fact", () => {
    for (const fact of HARM_REDUCTION_FACTS) expect(fact.source.label).toBeTruthy();
    const text = [...result.harmReduction.flatMap((f) => [f.title, f.text]), ...result.afterCycle, ...result.interactions, ...result.systems.flatMap((s) => s.notes)];
    for (const t of text) expect(bannedLanguageIn(t), t).toEqual([]);
  });
});
