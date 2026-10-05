import { describe, expect, it } from "vitest";

import { burdensForCompound, BURDENS } from "@/lib/compound-intelligence/burdens";
import type { CyclePeriod } from "@/lib/cycle/cycle-period";
import { SYSTEM_ORDER } from "@/lib/cycle-review/body-systems";
import type { CycleCheckIn } from "@/lib/cycle-review/types";
import { makeChangeEvent } from "@/lib/history/change-events";
import type { Observation } from "@/lib/history/types";
import { buildLabSafetyBrief } from "@/lib/labs/lab-safety";
import { bannedLanguageIn } from "@/lib/safety/__tests__/compliance-language";

import { buildBurdenMap } from "../burden-map";
import { RESEARCH_COPY } from "../copy";
import { buildLabResponse, listLabMarkers } from "../lab-response";
import { buildN1Review, labMarkerIdOf } from "../n1-review";

const CAUSE_WORDS = /\b(caus\w*|because|due to|led to|leads to|resulted in|results in|fixed|improv\w*|worsen\w*|helped|hurt|effect of|so that|correlat\w*|response to|in response|reduce|stop|increase your|decrease your|best)\b/i;

const brief = buildLabSafetyBrief({
  now: new Date(2026, 8, 15, 12),
  records: [
    { id: "r0", testDate: "2025-01-01", markers: [{ name: "Hematocrit", value: "0.45", unit: "L/L", referenceRange: "0.385-0.500", markerKey: "hematocrit" }] },
    { id: "r1", testDate: "2026-06-01", labName: "Quest", markers: [{ name: "Hematocrit", value: "48.0", unit: "%", referenceRange: "38.5-50.0", markerKey: "hematocrit" }] },
    {
      id: "r2",
      testDate: "2026-09-01",
      labName: "Quest",
      markers: [
        { name: "Hematocrit", value: "52.1", unit: "%", referenceRange: "38.5-50.0", labFlag: "H", markerKey: "hematocrit" },
        { name: "LDL Cholesterol", value: "131", unit: "mg/dL", referenceRange: "<100", labFlag: "H", markerKey: "ldl" },
      ],
    },
  ],
});

const cycle: CyclePeriod = {
  id: "c1",
  name: "Fall cycle",
  startDate: "2026-07-01",
  plannedWeeks: 12,
  compoundIds: [],
  clinicianOversight: false,
  checkpoints: [],
  endedOn: "2026-09-20",
  createdAt: "",
  updatedAt: "",
};

const checkIns: CycleCheckIn[] = [
  { id: "k1", cycleId: null, date: "2026-08-01", createdAt: "", systolic: 128, diastolic: 82, restingHr: 64, bodyweightLb: 205, ratings: {}, symptoms: [] },
  { id: "k2", cycleId: null, date: "2026-08-08", createdAt: "", ratings: {}, symptoms: [] },
];

describe("lab response", () => {
  it("lists every logged marker alphabetically", () => {
    const markers = listLabMarkers(brief);
    expect(markers.map((m) => m.id).sort()).toEqual(["hematocrit", "ldl"]);
    expect(markers.map((m) => m.label)).toEqual([...markers.map((m) => m.label)].sort((a, b) => a.localeCompare(b)));
  });

  it("draws the latest unit oldest first, lists other units, and works out only the change from the previous result", () => {
    const response = buildLabResponse({ labBrief: brief, markerId: "hematocrit", changeHistory: [], cycles: [], checkIns: [] })!;
    expect(response.points.map((p) => p.date)).toEqual(["2026-06-01", "2026-09-01"]);
    expect(response.otherUnit.map((p) => p.date)).toEqual(["2025-01-01"]);
    expect(response.range).toMatchObject({ low: 38.5, high: 50 });
    expect(response.points[1]).toMatchObject({ labFlag: "H", position: "above", labName: "Quest" });
    expect(response.changeFromPrevious!.delta).toBeCloseTo(4.1);
    expect(response.changeFromPrevious!.pct).toBeCloseTo(8.54, 1);
    expect(response.findings.length).toBeGreaterThan(0);
    expect(response.findings.every((f) => f.id === "hematocrit")).toBe(true);
  });

  it("places plan changes, cycle dates and check-ins on the same dates, within the span of the results", () => {
    const inside = makeChangeEvent({ at: new Date(2026, 6, 15, 10), subject: { kind: "compound", id: "e1", name: "Testosterone Cypionate" }, action: "added" });
    const outside = makeChangeEvent({ at: new Date(2023, 0, 1, 10), subject: { kind: "compound", id: "e2", name: "Old entry" }, action: "added" });
    const response = buildLabResponse({ labBrief: brief, markerId: "hematocrit", changeHistory: [inside, outside], cycles: [cycle], checkIns })!;
    expect(response.events.map((e) => `${e.date} ${e.label}`)).toEqual([
      "2026-07-01 Started Fall cycle",
      "2026-07-15 Added Testosterone Cypionate",
      "2026-08-01 Check-in",
      "2026-09-20 Ended Fall cycle",
    ]);
    expect(response.events[2].details).toEqual(["Blood pressure 128/82", "Resting heart rate 64 bpm", "Weight 205 lb"]);
  });

  it("returns nothing for a marker with no results", () => {
    expect(buildLabResponse({ labBrief: brief, markerId: "alt", changeHistory: [], cycles: [], checkIns: [] })).toBeNull();
  });
});

describe("burden map", () => {
  const compounds = [
    { id: "b", name: "Testosterone Enanthate", officialName: "Testosterone Enanthate", compoundClass: "hormones_testosterone", isActive: true },
    { id: "a", name: "Testosterone Cypionate", officialName: "Testosterone Cypionate", compoundClass: "hormones_testosterone", isActive: true },
    { id: "p", name: "Testosterone Propionate", officialName: "Testosterone Propionate", compoundClass: "hormones_testosterone", isActive: true, pausedAt: "2026-09-01" },
  ];
  const map = buildBurdenMap({ compounds, labBrief: brief, today: "2026-09-15" });

  it("lists every system once, loaded systems first, compounds alphabetical and never paused ones", () => {
    expect(map).toHaveLength(SYSTEM_ORDER.length);
    const loadedSystems = new Set(burdensForCompound(compounds[1]).map((load) => BURDENS[load.burden].system));
    expect(loadedSystems.size).toBeGreaterThan(0);
    const firstUnloaded = map.findIndex((row) => row.compounds.length === 0);
    expect(map.slice(0, firstUnloaded === -1 ? map.length : firstUnloaded).map((row) => row.system).sort()).toEqual([...loadedSystems].sort());
    for (const row of map.filter((r) => r.compounds.length > 0)) {
      expect(row.compounds.map((c) => c.name)).toEqual(["Testosterone Cypionate", "Testosterone Enanthate"]);
      for (const compound of row.compounds) for (const load of compound.loads) expect(load.gradeLabel).toBeTruthy();
    }
  });

  it("shows the latest result and its age for watched markers, or not tested", () => {
    const blood = map.find((row) => row.system === "blood")!;
    expect(blood.markers.find((m) => m.key === "hematocrit")).toMatchObject({ latest: { date: "2026-09-01", labFlag: "H" }, ageDays: 14 });
    expect(blood.markers.find((m) => m.key === "hemoglobin")).toMatchObject({ latest: null, ageDays: null });
  });
});

describe("n=1 review", () => {
  const observation = (id: string, date: string, changed: Observation["changed"], marked = false): Observation => ({
    id,
    date,
    changed,
    noticed: { kind: "marker", ref: "hematocrit", label: "Hematocrit" },
    createdAt: `${date}T10:00:00.000Z`,
    ...(marked ? { markedForReviewAt: "2026-09-15T10:00:00.000Z" } : {}),
  });
  const list = [
    observation("o1", "2026-08-01", { kind: "compound", ref: "e1", label: "Testosterone Cypionate" }),
    observation("o2", "2026-09-10", { kind: "compound", ref: "e1", label: "Testosterone Cypionate" }, true),
    observation("o3", "2026-08-20", { kind: "text", label: "Moved training to mornings" }),
    observation("o4", "2026-07-01", { kind: "text", label: "moved training to mornings " }, true),
  ];

  it("groups by what changed, newest first, with counts", () => {
    const groups = buildN1Review(list);
    expect(groups.map((g) => [g.key, g.count, g.markedCount])).toEqual([
      ["compound:e1", 2, 1],
      ["text:moved training to mornings", 2, 1],
    ]);
    expect(groups[0].observations.map((o) => o.id)).toEqual(["o2", "o1"]);
    expect(labMarkerIdOf(list[0])).toBe("hematocrit");
  });

  it("filters to marked observations", () => {
    expect(buildN1Review(list, { onlyMarked: true }).flatMap((g) => g.observations.map((o) => o.id))).toEqual(["o2", "o4"]);
  });
});

describe("research words", () => {
  it("never use banned, cause or directive wording", () => {
    for (const text of Object.values(RESEARCH_COPY)) {
      expect(bannedLanguageIn(text), text).toEqual([]);
      expect(text, text).not.toMatch(CAUSE_WORDS);
    }
  });
});
