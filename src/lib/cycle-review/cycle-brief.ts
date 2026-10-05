/* ════════════════════════════════════════════════════════════════════════
   CYCLE BRIEF — everything to know while on a cycle, on one screen.

   Built from the member's own running compounds, cycle, labs and the cited
   risk profiles:
     · the cycle at a glance
     · what the compounds affect, system by system, with the latest result
     · what is commonly watched, and when each marker was last tested
     · warning signs, grouped by where they send the member
     · known interactions
     · harm-reduction facts, cited
     · what is known about recovery after use

   It never says what to take, how much or when, never judges the member's
   plan and never clears anyone. Everything routes to a person.
   ════════════════════════════════════════════════════════════════════════ */

import {
  RED_FLAGS,
  RISK_SYSTEM_LABEL,
  type CompoundRiskBrief,
  type ProfileSource,
  type RedFlagAction,
  type RiskSystem,
} from "@/lib/compound-intelligence/risk-profiles";
import type { CycleState } from "@/lib/cycle/cycle-period";
import { daysBetween } from "@/lib/cycle/cycle-period";
import type { LabSafetyBrief } from "@/lib/labs/lab-safety";
import { markerDef, type MarkerKey } from "@/lib/labs/markers";

export const CYCLE_BRIEF_VERSION = "2026.09.16";

/** Systems that describe handling, not the body — covered by the harm-reduction facts. */
const HANDLING: ReadonlySet<RiskSystem> = new Set(["sourcing", "injection"]);

/** A marker counts as recently tested within this many days. */
export const BRIEF_RECENT_DAYS = 90;

export type BriefMarker = {
  key: MarkerKey;
  label: string;
  status: "flagged" | "recent" | "stale" | "never";
  latest?: { valueText: string; unit?: string; date: string; daysAgo: number };
};

export type BriefSystem = {
  system: RiskSystem;
  label: string;
  compoundNames: string[];
  notes: string[];
  markers: BriefMarker[];
};

export type BriefFact = { title: string; text: string; source: ProfileSource };

export type CycleBrief = {
  glance: {
    compoundNames: string[];
    cycle: { name: string; weekNumber: number; totalWeeks: number; daysRemaining: number; pastEnd: boolean } | null;
    flaggedResults: number;
    neverTested: number;
    nextCheckpoint: { label: string; date: string } | null;
  };
  systems: BriefSystem[];
  watch: BriefMarker[];
  warningSigns: Record<RedFlagAction, string[]>;
  interactions: string[];
  harmReduction: BriefFact[];
  afterCycle: string[];
};

export const HARM_REDUCTION_FACTS: BriefFact[] = [
  {
    title: "Needles and vials",
    text: "Sharing needles, syringes or multi-use vials spreads HIV, hepatitis B and hepatitis C. A new sterile needle and syringe each time removes that route.",
    source: { label: "CDC: HIV and viral hepatitis risk from sharing injection equipment" },
  },
  {
    title: "Injection sites",
    text: "Hot, spreading redness, pus, a hard painful lump or fever after an injection can be a serious infection that needs care the same day.",
    source: { label: "Pope HG Jr, et al. Adverse health consequences of performance-enhancing drugs: an Endocrine Society scientific statement. Endocrine Reviews, 2014." },
  },
  {
    title: "What is in the vial",
    text: "Products made outside regulated pharmacies are often mislabeled, under- or over-strength, or contaminated, so the label may not match what is inside.",
    source: { label: "FDA warning on body-building products containing selective androgen receptor modulators (SARMs), 2017" },
  },
  {
    title: "Blood pressure at home",
    text: "Anabolic steroids commonly raise blood pressure, often without symptoms. A home cuff reading, logged in your check-in, is the direct way to see it.",
    source: { label: "Pope HG Jr, et al. Adverse health consequences of performance-enhancing drugs: an Endocrine Society scientific statement. Endocrine Reviews, 2014." },
  },
  {
    title: "Sleep and breathing",
    text: "Loud snoring, gasping or pauses in breathing during sleep can be sleep apnea, which testosterone can worsen and which raises blood pressure. It is diagnosed with a sleep study.",
    source: { label: "NIH National Heart, Lung, and Blood Institute: Sleep Apnea", url: "https://www.nhlbi.nih.gov/health/sleep-apnea" },
  },
];

type BriefInput = {
  today: string;
  compoundNames: string[];
  brief: CompoundRiskBrief;
  labBrief: LabSafetyBrief | null;
  cycleState: CycleState | null;
};

export function buildCycleBrief(input: BriefInput): CycleBrief | null {
  if (input.compoundNames.length === 0) return null;
  const profiles = input.brief.profiles.filter(({ profile }) => profile.regulatory !== "supplement");
  if (profiles.length === 0) return null;

  const history = input.labBrief?.history ?? {};
  const flaggedKeys = new Set((input.labBrief?.findings ?? []).map((f) => f.markerKey).filter(Boolean));

  const markerStatus = (key: MarkerKey): BriefMarker => {
    const latest = history[key]?.[0];
    const label = markerDef(key).label;
    if (!latest) return { key, label, status: "never" };
    const daysAgo = daysBetween(latest.date, input.today);
    return {
      key,
      label,
      status: flaggedKeys.has(key) ? "flagged" : daysAgo <= BRIEF_RECENT_DAYS ? "recent" : "stale",
      latest: { valueText: latest.valueText, unit: latest.unit, date: latest.date, daysAgo },
    };
  };

  /* Systems, in the order the profiles introduce them. */
  const bySystem = new Map<RiskSystem, { names: Set<string>; notes: string[]; markers: Set<MarkerKey> }>();
  for (const { profile, compoundNames } of profiles) {
    for (const { system, note } of profile.systems) {
      if (HANDLING.has(system)) continue;
      const entry = bySystem.get(system) ?? { names: new Set<string>(), notes: [], markers: new Set<MarkerKey>() };
      compoundNames.forEach((n) => entry.names.add(n));
      if (!entry.notes.includes(note)) entry.notes.push(note);
      bySystem.set(system, entry);
    }
  }
  /* Attach each profile's watched markers to the systems that marker belongs to. */
  const MARKER_SYSTEM: Partial<Record<string, RiskSystem>> = {
    blood: "blood", hormones: "hormonal", prostate: "prostate", lipids: "lipids", liver: "liver", kidney: "kidney", metabolic: "metabolic", thyroid: "thyroid", electrolytes: "cardiovascular",
  };
  for (const { profile } of profiles) {
    for (const key of profile.monitoredMarkers) {
      const target = MARKER_SYSTEM[markerDef(key).system];
      const system = target === "hormonal" && !bySystem.has("hormonal") && bySystem.has("fertility") ? "fertility" : target;
      if (system && bySystem.has(system)) bySystem.get(system)!.markers.add(key);
    }
  }

  const systems: BriefSystem[] = [...bySystem.entries()].map(([system, entry]) => ({
    system,
    label: RISK_SYSTEM_LABEL[system],
    compoundNames: [...entry.names],
    notes: entry.notes,
    markers: [...entry.markers].map(markerStatus),
  }));

  const watchKeys = [...new Set(profiles.flatMap(({ profile }) => profile.monitoredMarkers))];
  const order: Record<BriefMarker["status"], number> = { flagged: 0, never: 1, stale: 2, recent: 3 };
  const watch = watchKeys.map(markerStatus).sort((a, b) => order[a.status] - order[b.status] || a.label.localeCompare(b.label));

  const warningSigns: Record<RedFlagAction, string[]> = { emergency: [], crisis: [], urgent: [] };
  for (const flag of input.brief.redFlags) {
    const def = RED_FLAGS[flag];
    if (def && !warningSigns[def.action].includes(def.label)) warningSigns[def.action].push(def.label);
  }

  const interactions = [...new Set(profiles.flatMap(({ profile }) => profile.interactions))];
  const afterCycle = [...new Set(profiles.flatMap(({ profile }) => profile.systems.filter((s) => s.system === "fertility").map((s) => s.note)))];

  const cycle = input.cycleState;
  return {
    glance: {
      compoundNames: input.compoundNames,
      cycle: cycle
        ? { name: cycle.cycle.name, weekNumber: cycle.weekNumber, totalWeeks: cycle.totalWeeks, daysRemaining: cycle.daysRemaining, pastEnd: cycle.daysPastPlannedEnd > 0 }
        : null,
      flaggedResults: watch.filter((m) => m.status === "flagged").length,
      neverTested: watch.filter((m) => m.status === "never").length,
      nextCheckpoint: cycle?.nextCheckpoint ? { label: cycle.nextCheckpoint.label, date: cycle.nextCheckpoint.date } : null,
    },
    systems,
    watch,
    warningSigns,
    interactions,
    harmReduction: HARM_REDUCTION_FACTS,
    afterCycle,
  };
}
