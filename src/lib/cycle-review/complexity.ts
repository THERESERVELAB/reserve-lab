/* ════════════════════════════════════════════════════════════════════════
   CYCLE COMPLEXITY — how much a plan asks of the body, and of monitoring.

   This is not a quality score and never a percentage. It is a band — low,
   moderate, high, very high — and every band states its reasons in the
   member's own terms: how many compounds, which loads they share, how long
   the plan runs, what monitoring is missing, which labs have moved, which
   symptoms were entered.

   It also challenges "kitchen sink" design. More compounds with the same
   role, compounds with no recorded purpose, or overlapping loads alongside
   moving labs all raise a complexity review. Reserve never says which
   compound to change — only what is worth reviewing, and with whom.
   ════════════════════════════════════════════════════════════════════════ */

import { BURDENS, burdensForCompound, findBurdenOverlaps, type BurdenKey, type BurdenOverlap } from "@/lib/compound-intelligence/burdens";
import { profilesForCompound, type CompoundIdentity } from "@/lib/compound-intelligence/risk-profiles";
import { daysBetween, type CycleState } from "@/lib/cycle/cycle-period";
import type { UntestedMarker } from "@/lib/labs/lab-safety";
import { markerDef } from "@/lib/labs/markers";

import type { MarkerTrend } from "./lab-trends";
import { inSentence, listNames, listOr } from "./text";
import {
  CHECK_IN_SYMPTOMS,
  COMPOUND_PURPOSE_LABEL,
  CYCLE_GOAL_LABEL,
  CYCLE_PRIORITY_LABEL,
  PRIORITY_BURDENS,
  type CheckInSymptomKey,
  type CompoundPurpose,
  type CyclePrimaryGoal,
  type CyclePriority,
} from "./types";

export type ComplexityLevel = "low" | "moderate" | "high" | "very-high";

export const COMPLEXITY_LEVEL_LABEL: Record<ComplexityLevel, string> = {
  low: "Low",
  moderate: "Moderate",
  high: "High",
  "very-high": "Very high",
};

export type ComplexityReviewState = "no-concern" | "worth-reviewing" | "review-soon";

export const COMPLEXITY_REVIEW_LABEL: Record<ComplexityReviewState, string> = {
  "no-concern": "No review items",
  "worth-reviewing": "Worth reviewing",
  "review-soon": "Get this reviewed",
};

export type ReviewCompound = CompoundIdentity & {
  id: string;
  purpose?: CompoundPurpose;
  /** YYYY-MM-DD, member-entered. */
  startDate?: string;
};

export type OverlapFinding = BurdenOverlap & {
  /** Lab trends on this load's markers that moved or sit outside the range. */
  movingMarkers: MarkerTrend[];
  /** Days since the most recent result on any of this load's markers; undefined when none. */
  latestResultAgeDays?: number;
  /** What monitoring shows for this load — empty when current and unmoved. */
  monitoringNote: string;
  /** The full sentence: shared load, compounds, then the monitoring note. */
  text: string;
};

export type PriorityConflict = { priority: CyclePriority; burdens: BurdenKey[]; compoundNames: string[]; text: string };

export type CycleComplexity = {
  level: ComplexityLevel;
  reasons: string[];
  overlaps: OverlapFinding[];
  review: { state: ComplexityReviewState; reasons: string[] };
  priorityConflicts: PriorityConflict[];
  /** Compounds counted — supplements are left out. */
  countedCompounds: number;
};

const MOVING: ReadonlySet<MarkerTrend["status"]> = new Set(["trend", "changed", "outside-range", "clinician-review"]);
/** A load's newest result older than this is called out beside an overlap. */
export const STALE_RESULT_DAYS = 56;


const NUMBER_WORD = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];
function countWord(n: number): string {
  return NUMBER_WORD[n] ?? String(n);
}

function isSupplementOnly(compound: CompoundIdentity): boolean {
  const profiles = profilesForCompound(compound);
  return profiles.length > 0 && profiles.every((p) => p.regulatory === "supplement");
}

function weeksText(days: number): string {
  const weeks = Math.round(days / 7);
  return weeks <= 1 ? `${days} ${days === 1 ? "day" : "days"}` : `${weeks} weeks`;
}

export function buildCycleComplexity(input: {
  compounds: ReviewCompound[];
  cycleState: CycleState | null;
  primaryGoal?: CyclePrimaryGoal;
  priorities: CyclePriority[];
  trends: MarkerTrend[];
  untested: UntestedMarker[];
  recentSymptoms: CheckInSymptomKey[];
  recentRedFlagCount: number;
  today: string;
}): CycleComplexity {
  const counted = input.compounds.filter((c) => !isSupplementOnly(c));
  const trendByKey = new Map(input.trends.map((t) => [t.key, t]));
  const reasons: string[] = [];
  let points = 0;

  /* Compound count */
  if (counted.length >= 3) {
    points += counted.length >= 7 ? 3 : counted.length >= 5 ? 2 : 1;
    reasons.push(`${countWord(counted.length)} compounds in the current plan.`);
  }

  /* Shared loads */
  const overlaps: OverlapFinding[] = findBurdenOverlaps(counted).map((overlap) => {
    const def = BURDENS[overlap.burden];
    const markerTrends = def.markers.map((m) => trendByKey.get(m)).filter((t): t is MarkerTrend => Boolean(t));
    const movingMarkers = markerTrends.filter((t) => MOVING.has(t.status));
    const latest = markerTrends.map((t) => t.current?.date).filter((d): d is string => Boolean(d)).sort().at(-1);
    const latestResultAgeDays = latest ? daysBetween(latest, input.today) : undefined;
    const names = overlap.compounds.map((c) => c.name);
    const notes: string[] = [];
    if (def.markers.length > 0) {
      if (latestResultAgeDays === undefined) notes.push(`No ${listOr(def.markers.slice(0, 3).map((m) => inSentence(markerDef(m).label)))} result is logged.`);
      else if (latestResultAgeDays > STALE_RESULT_DAYS) notes.push(`Your most recent related result is ${weeksText(latestResultAgeDays)} old.`);
    }
    if (movingMarkers.length > 0) notes.push(`${listNames(movingMarkers.map((t) => t.label))} ${movingMarkers.length === 1 ? "has" : "have"} moved.`);
    const monitoringNote = notes.join(" ");
    const lead = `${countWord(names.length)} compounds in your plan ${def.phrase.replace(/^is /, "are ")}: ${listNames(names)}.`;
    return { ...overlap, movingMarkers, latestResultAgeDays, monitoringNote, text: monitoringNote ? `${lead} ${monitoringNote}` : lead };
  })
    /* Loads whose markers have already moved come first; the rest keep the evidence order. */
    .map((overlap, index) => ({ overlap, index }))
    .sort((a, b) => Number(b.overlap.movingMarkers.length > 0) - Number(a.overlap.movingMarkers.length > 0) || a.index - b.index)
    .map(({ overlap }) => overlap);
  const overlapSystems = new Set(overlaps.map((o) => BURDENS[o.burden].system));
  if (overlapSystems.size > 0) {
    points += Math.min(3, overlapSystems.size);
    reasons.push(overlaps[0].text);
  }

  /* Duration */
  const state = input.cycleState;
  if (state) {
    if (state.totalWeeks > 16) {
      points += 1;
      reasons.push(`The plan runs ${state.totalWeeks} weeks.`);
    }
    if (state.stillActivePastEnd) {
      points += 1;
      reasons.push(`${listNames(state.activePastEndNames)} ${state.activePastEndNames.length === 1 ? "is" : "are"} still active past your planned end.`);
    }
  }

  /* Monitoring */
  const cycleNames = new Set(counted.map((c) => c.name));
  const untested = input.untested.filter((u) => u.compounds.some((name) => cycleNames.has(name)));
  if (untested.length > 0) {
    points += 1;
    reasons.push(`${listNames(untested.slice(0, 4).map((u) => u.label))} ${untested.length === 1 ? "is" : "are"} commonly watched for this plan but not in your recent labs.`);
  }
  if (state && state.phase !== "upcoming" && state.dayNumber > 42) {
    const anySinceStart = input.trends.some((t) => t.current && t.current.date >= state.cycle.startDate);
    if (!anySinceStart) {
      points += 1;
      reasons.push("No labs are logged since this cycle started.");
    }
  }

  /* Labs */
  const reviewMarkers = input.trends.filter((t) => t.status === "clinician-review");
  const movingLinked = input.trends.filter((t) => (t.status === "trend" || t.status === "outside-range") && t.linkedCompounds.length > 0);
  if (reviewMarkers.length > 0) {
    points += 2;
    reasons.push(`${listNames(reviewMarkers.map((t) => t.label))} ${reviewMarkers.length === 1 ? "needs" : "need"} clinician review.`);
  } else if (movingLinked.length > 0) {
    points += 1;
    reasons.push(`${listNames(movingLinked.map((t) => t.label))} ${movingLinked.length === 1 ? "has" : "have"} moved on markers commonly watched for this plan.`);
  }

  /* Symptoms */
  const symptoms = [...new Set(input.recentSymptoms)];
  if (input.recentRedFlagCount > 0 || symptoms.length >= 2) {
    points += 1;
    reasons.push(
      input.recentRedFlagCount > 0
        ? "Warning-sign symptoms were reported recently."
        : `Recent check-ins include ${listNames(symptoms.slice(0, 3).map((k) => CHECK_IN_SYMPTOMS[k].label.toLowerCase()))}.`,
    );
  }

  const level: ComplexityLevel = points >= 6 ? "very-high" : points >= 4 ? "high" : points >= 2 ? "moderate" : "low";

  /* Complexity review — "more is not always better" */
  const reviewReasons: string[] = [];
  let strong = false;

  const noPurpose = counted.filter((c) => !c.purpose);
  if (noPurpose.length > 0) {
    reviewReasons.push(`No purpose is recorded for ${listNames(noPurpose.map((c) => c.name))}.`);
  }

  if (input.primaryGoal && input.primaryGoal !== "other") {
    const offGoal = counted.filter(
      (c) => c.purpose && c.purpose.kind !== input.primaryGoal && c.purpose.kind !== "managing-effects" && c.purpose.kind !== "other" && c.purpose.kind !== "clinician-managed-therapy",
    );
    for (const compound of offGoal) {
      reviewReasons.push(
        `${compound.name} is recorded for ${COMPOUND_PURPOSE_LABEL[compound.purpose!.kind].toLowerCase()}, but your current goal is ${CYCLE_GOAL_LABEL[input.primaryGoal].toLowerCase()}.`,
      );
    }
  }

  const byPurpose = new Map<string, ReviewCompound[]>();
  for (const compound of counted) {
    if (!compound.purpose || compound.purpose.kind === "other") continue;
    byPurpose.set(compound.purpose.kind, [...(byPurpose.get(compound.purpose.kind) ?? []), compound]);
  }
  for (const [kind, group] of byPurpose) {
    if (group.length < 2) continue;
    if (kind === "managing-effects") {
      reviewReasons.push(`${countWord(group.length)} compounds are recorded as managing the effects of others: ${listNames(group.map((c) => c.name))}.`);
      continue;
    }
    const ids = new Set(group.map((c) => c.id));
    const shared = overlaps.filter((o) => o.compounds.filter((c) => ids.has(c.id)).length >= 2);
    if (shared.length > 0) {
      reviewReasons.push(
        `${listNames(group.map((c) => c.name))} are all recorded for ${COMPOUND_PURPOSE_LABEL[kind as CompoundPurpose["kind"]].toLowerCase()}, and share ${listNames(shared.map((o) => BURDENS[o.burden].label.toLowerCase()))}.`,
      );
    }
  }

  if (state) {
    const added = counted.filter((c) => c.startDate && c.startDate > state.cycle.startDate);
    if (added.length >= 2) {
      reviewReasons.push(`${countWord(added.length)} compounds were added after this cycle started.`);
    }
  }

  for (const overlap of overlaps) {
    if (overlap.movingMarkers.length > 0) {
      strong = true;
      reviewReasons.push(
        `${BURDENS[overlap.burden].label} is shared by ${listNames(overlap.compounds.map((c) => c.name))}, and ${listNames(overlap.movingMarkers.map((t) => t.label))} ${overlap.movingMarkers.length === 1 ? "has" : "have"} moved.`,
      );
    }
  }

  const reviewState: ComplexityReviewState = strong ? "review-soon" : reviewReasons.length > 0 ? "worth-reviewing" : "no-concern";

  /* Priorities the plan works against */
  const priorityConflicts: PriorityConflict[] = [];
  for (const priority of input.priorities) {
    const watched = new Set(PRIORITY_BURDENS[priority]);
    if (watched.size === 0) continue;
    const hits = counted
      .map((c) => ({ name: c.name, burdens: burdensForCompound(c).map((b) => b.burden).filter((b) => watched.has(b)) }))
      .filter((c) => c.burdens.length > 0);
    if (hits.length === 0) continue;
    const burdens = [...new Set(hits.flatMap((h) => h.burdens))];
    const names = hits.map((h) => h.name);
    priorityConflicts.push({
      priority,
      burdens,
      compoundNames: names,
      text: `You set "${CYCLE_PRIORITY_LABEL[priority]}" as a priority. ${listNames(names)} ${names.length === 1 ? "is" : "are"} linked to ${listNames(burdens.map((b) => BURDENS[b].label.toLowerCase()))}.`,
    });
  }

  return {
    level,
    reasons,
    overlaps,
    review: { state: reviewState, reasons: reviewReasons },
    priorityConflicts,
    countedCompounds: counted.length,
  };
}
