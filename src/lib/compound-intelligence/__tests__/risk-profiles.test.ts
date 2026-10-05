import { describe, expect, it } from "vitest";

import { COMPOUND_CATALOG, findCatalogEntry } from "@/lib/enhancement/catalog";
import { isMarkerKey } from "@/lib/labs/markers";
import { buildLabSafetyBrief } from "@/lib/labs/lab-safety";
import { SAFETY_ACK_POINTS } from "@/lib/safety/acknowledgement";
import { buildClinicianSummary } from "@/lib/safety/clinician-summary";
import { EMERGENCY_COPY, ESCALATION_LABEL, buildEscalation } from "@/lib/safety/escalation";
import { bannedLanguageIn } from "@/lib/safety/__tests__/compliance-language";
import { resolveCycleState, type CyclePeriod } from "@/lib/cycle/cycle-period";

import {
  RED_FLAGS,
  RISK_PROFILES,
  RISK_PROFILE_VERSION,
  buildCompoundRiskBrief,
  profilesForCompound,
} from "../risk-profiles";

describe("risk profile library integrity", () => {
  it("covers every compound in the catalog", () => {
    const uncovered = COMPOUND_CATALOG.filter((entry) => profilesForCompound({ name: entry.officialName }).length === 0);
    expect(uncovered.map((e) => e.officialName)).toEqual([]);
  });

  it("targets only compounds that exist in the catalog", () => {
    for (const profile of RISK_PROFILES) {
      for (const name of profile.appliesTo.compounds ?? []) {
        expect(findCatalogEntry(name)?.officialName, `${profile.key}: "${name}"`).toBe(name);
      }
    }
  });

  it("uses only real markers and red flags, cites sources, and awaits clinician review", () => {
    const keys = new Set<string>();
    for (const profile of RISK_PROFILES) {
      expect(keys.has(profile.key), `duplicate ${profile.key}`).toBe(false);
      keys.add(profile.key);
      for (const marker of profile.monitoredMarkers) expect(isMarkerKey(marker), `${profile.key}: ${marker}`).toBe(true);
      for (const flag of profile.redFlags) expect(RED_FLAGS[flag], `${profile.key}: ${flag}`).toBeTruthy();
      expect(profile.sources.length, profile.key).toBeGreaterThan(0);
      expect(profile.review).toEqual({ status: "pending-clinician-review", version: RISK_PROFILE_VERSION });
    }
  });
});

describe("compliance — Reserve describes risk and routes to a human", () => {
  it("no profile, red flag, acknowledgement or escalation label gives amounts or instructions", () => {
    const copy = [
      ...RISK_PROFILES.flatMap((p) => [p.title, p.summary, p.regulatoryNote, ...p.systems.map((s) => s.note), ...p.interactions]),
      ...Object.values(RED_FLAGS).map((f) => f.label),
      ...Object.values(EMERGENCY_COPY),
      ...Object.values(ESCALATION_LABEL),
      ...SAFETY_ACK_POINTS,
    ];
    const violations = copy.flatMap((text) => bannedLanguageIn(text).map((pattern) => `${pattern} in "${text}"`));
    expect(violations).toEqual([]);
  });
});

describe("profilesForCompound", () => {
  it("resolves aliases and puts compound-specific risks first", () => {
    expect(profilesForCompound({ name: "Anavar" }).map((p) => p.key)).toEqual(["oral-17aa-steroids", "anabolic-steroids"]);
    expect(profilesForCompound({ name: "Test Cyp" }).map((p) => p.key)).toEqual(["testosterone"]);
    expect(profilesForCompound({ name: "Reta" }).map((p) => p.key)).toEqual(["glp-1-agonists"]);
    expect(profilesForCompound({ name: "Creatine" }).map((p) => p.key)).toEqual(["creatine", "dietary-supplements"]);
  });

  it("falls back to the entry's own class for custom names", () => {
    expect(profilesForCompound({ name: "My research peptide", compoundClass: "peptides_healing" }).map((p) => p.key)).toEqual(["healing-peptides"]);
  });
});

describe("buildCompoundRiskBrief", () => {
  const brief = buildCompoundRiskBrief([
    { name: "Testosterone Cypionate" },
    { name: "Oxandrolone" },
    { name: "Mystery blend" },
  ]);

  it("links each marker to the logged compounds it is watched for", () => {
    expect(brief.markerLinks.hematocrit).toEqual(["Testosterone Cypionate", "Oxandrolone"]);
    expect(brief.markerLinks.alt).toEqual(["Oxandrolone"]);
    expect(brief.markerLinks.psa).toEqual(["Testosterone Cypionate", "Oxandrolone"]);
  });

  it("collects red flags and names compounds without a profile", () => {
    expect(brief.redFlags).toContain("jaundice");
    expect(brief.unprofiledNames).toEqual(["Mystery blend"]);
  });
});

describe("escalation ladder", () => {
  const cycle: CyclePeriod = {
    id: "c1",
    name: "Fall cycle",
    startDate: "2026-09-14",
    plannedWeeks: 12,
    compoundIds: ["t"],
    clinicianOversight: false,
    checkpoints: [{ id: "mid", date: "2026-10-12", label: "Mid-cycle", setBy: "member" }],
    createdAt: "",
    updatedAt: "",
  };
  const now = new Date(2026, 11, 10);
  const cycleState = resolveCycleState(cycle, { now, compounds: [{ id: "t", name: "Testosterone Cypionate", isActive: true }] });
  const labBrief = buildLabSafetyBrief({
    records: [{
      id: "r",
      testDate: "2026-12-01",
      markers: [
        { name: "Potassium", value: "6.9", unit: "mmol/L", referenceRange: "3.5-5.3", labFlag: "HH" },
        { name: "Hematocrit", value: "53", unit: "%", referenceRange: "38.5-50.0", labFlag: "H" },
      ],
    }],
    markerLinks: buildCompoundRiskBrief([{ name: "Testosterone Cypionate" }]).markerLinks,
    now,
  });
  const items = buildEscalation({ labBrief, cycleState, recentRedFlags: ["jaundice", "chest-pain", "self-harm-thoughts"] });

  it("puts crisis and emergencies first, then clinician contact", () => {
    expect(items.map((i) => i.level).slice(0, 4)).toEqual(["crisis", "emergency", "emergency", "contact-clinician-today"]);
    expect(items[0].body).toMatch(/988/);
    expect(items[1].body).toMatch(/911/);
  });

  it("raises the planned end date, overdue labs and a missing clinician", () => {
    const ids = items.map((i) => i.id);
    expect(ids).toContain("cycle-past-end");
    expect(ids).toContain("cycle-checkpoint-mid");
    expect(ids).toContain("cycle-no-clinician");
    expect(ids).toContain("lab-discuss");
  });

  it("never instructs the member", () => {
    for (const item of items) {
      expect(bannedLanguageIn(`${item.title} ${item.body}`), item.id).toEqual([]);
    }
  });

  it("produces a clinician summary from the same records", () => {
    const summary = buildClinicianSummary({
      generatedAt: now,
      cycleState,
      compounds: [{ name: "Testosterone Cypionate", isActive: true }],
      labBrief,
      redFlagReports: [{ id: "x", reportedAt: "2026-12-09T10:00:00.000Z", flags: ["jaundice"] }],
    });
    expect(summary).toMatch(/Fall cycle: 2026-09-14 to 2026-12-06 \(12 weeks planned\)/);
    expect(summary).toMatch(/Potassium: 6\.9 mmol\/L \(ref 3\.5-5\.3\) \[lab flag: Critical high\]/);
    expect(summary).toMatch(/Yellowing of the skin/);
    expect(summary).toMatch(/not a clinical assessment/);
  });
});
