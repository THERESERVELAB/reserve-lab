/* ════════════════════════════════════════════════════════════════════════
   PROGRAM HORIZON GENERATION

   Reads Protocol DNA + the athlete snapshot + the derived programming
   profile and produces EVERY week of the block at activation.

   The three things that make this a real projection rather than a copied
   week renamed:

     1. Phases are distributed across the real block length, and each phase
        carries its own volume multiplier, effort target, and conditioning
        multiplier from DNA.
     2. Weekly set targets are computed per week from the protocol's set
        ranges, the phase multiplier, and a within-phase ramp — so Week 8
        genuinely differs from Week 1.
     3. The weekly STRUCTURE is resolved through the same blueprint resolver
        the live week uses, at the athlete's real frequency, with the week
        number passed through — so the horizon and Training Command cannot
        disagree.

   Pure and deterministic. No store access, no medical content.
   ════════════════════════════════════════════════════════════════════════ */

import type { AthleteProgrammingProfile } from "@/lib/athlete/programming-profile";
import type { AthleteContextSnapshot } from "@/lib/athlete/snapshot";
import { getProtocol } from "@/lib/protocol/library";
import { resolveWeeklyBlueprint, type BlueprintDay } from "@/lib/training/split-blueprints";
import { buildProtocolExplanation } from "@/lib/training/protocol-explanation";
import { scoreProtocolSuitability, type ProtocolSuitability } from "@/lib/training/protocol-suitability";
import { getProtocolDNA, isConditioningDay, type ProgramPhaseDefinition, type ProtocolDNA } from "@/lib/training/protocol-dna";
import {
  PROGRAM_HORIZON_VERSION,
  type ProgramHorizon,
  type ProgramPhase,
  type ProjectedProgramWeek,
  type ProjectedWeekStatus,
} from "./types";

/* ─── Phase distribution ──────────────────────────────────────────────── */

/**
 * Distribute the DNA's phase sequence across the real block length.
 * Fixed-week phases (deload, assessment) always get exactly their weeks;
 * the remainder is shared by weight. Every phase gets at least one week —
 * a phase sequence that cannot fit is truncated from the middle, never
 * silently collapsed into an identical block.
 */
export function distributePhases(defs: ProgramPhaseDefinition[], totalWeeks: number): ProgramPhase[] {
  if (totalWeeks <= 0 || defs.length === 0) return [];

  // If the block is shorter than the phase count, drop the most droppable
  // middle phases (specialization first, then consolidation) until it fits.
  let working = [...defs];
  const droppableOrder: Array<ProgramPhaseDefinition["kind"]> = ["specialization", "consolidation", "taper", "intensification"];
  let guard = 0;
  while (working.length > totalWeeks && guard < 20) {
    guard += 1;
    const kind = droppableOrder.find((k) => working.some((p) => p.kind === k));
    if (!kind) break;
    const idx = working.findIndex((p) => p.kind === kind);
    working.splice(idx, 1);
  }
  if (working.length > totalWeeks) working = working.slice(0, totalWeeks);

  const fixed = working.filter((p) => p.fixedWeeks != null);
  const fixedTotal = fixed.reduce((s, p) => s + (p.fixedWeeks ?? 0), 0);
  const flexible = working.filter((p) => p.fixedWeeks == null);
  const flexibleBudget = Math.max(flexible.length, totalWeeks - fixedTotal);

  const weightTotal = flexible.reduce((s, p) => s + p.weight, 0) || 1;
  const allocation = new Map<string, number>();
  let assigned = 0;
  flexible.forEach((p, i) => {
    const raw = (p.weight / weightTotal) * flexibleBudget;
    const weeks = i === flexible.length - 1 ? flexibleBudget - assigned : Math.max(1, Math.round(raw));
    allocation.set(p.id, Math.max(1, weeks));
    assigned += Math.max(1, weeks);
  });

  // Reconcile any drift caused by rounding / the minimum-one-week floor.
  let allocated = working.reduce((s, p) => s + (p.fixedWeeks ?? allocation.get(p.id) ?? 1), 0);
  let drift = allocated - totalWeeks;
  const shrinkOrder = [...flexible].sort((a, b) => (allocation.get(b.id) ?? 0) - (allocation.get(a.id) ?? 0));
  guard = 0;
  while (drift > 0 && guard < 100) {
    guard += 1;
    const target = shrinkOrder.find((p) => (allocation.get(p.id) ?? 1) > 1);
    if (!target) break;
    allocation.set(target.id, (allocation.get(target.id) ?? 1) - 1);
    drift -= 1;
  }
  if (drift < 0 && flexible.length > 0) {
    // Extra weeks go to the largest accumulation-style phase.
    const grow = shrinkOrder[0];
    allocation.set(grow.id, (allocation.get(grow.id) ?? 1) - drift);
    drift = 0;
  }
  allocated = working.reduce((s, p) => s + (p.fixedWeeks ?? allocation.get(p.id) ?? 1), 0);

  const out: ProgramPhase[] = [];
  let week = 1;
  for (const p of working) {
    const span = p.fixedWeeks ?? allocation.get(p.id) ?? 1;
    const start = week;
    const end = Math.min(totalWeeks, week + span - 1);
    if (start > totalWeeks) break;
    out.push({
      id: p.id, name: p.name, kind: p.kind, objective: p.objective,
      weekStart: start, weekEnd: end,
      expectedAdaptation: p.expectedAdaptation,
      entryCriteria: p.entryCriteria,
      exitCriteria: p.exitCriteria,
    });
    week = end + 1;
  }
  // Make sure the last phase reaches the final week.
  if (out.length > 0 && out[out.length - 1].weekEnd < totalWeeks) {
    out[out.length - 1].weekEnd = totalWeeks;
  }
  return out;
}

/* ─── Weekly set targets ──────────────────────────────────────────────── */

/**
 * Per-week working sets for each region. Combines the protocol's authored
 * range, the phase's volume multiplier, and a ramp WITHIN the phase — so
 * consecutive weeks in an accumulation phase are not identical either.
 */
export function weekSetTargets(
  dna: ProtocolDNA,
  phaseDef: ProgramPhaseDefinition,
  phaseWeek: number,
  phaseLength: number,
  volumeScale: number,
): Record<string, number> {
  const out: Record<string, number> = {};
  // Ramp from the bottom of the phase's band to the top across its weeks.
  // A single-week phase (deload, assessment) sits mid-band rather than at the
  // top — otherwise an assessment week can out-volume the accumulation week
  // that preceded it, which is backwards.
  const ramp = phaseLength <= 1 ? 0.5 : (phaseWeek - 1) / (phaseLength - 1);
  for (const [region, [lo, hi]] of Object.entries(dna.stimulus.weeklySetRanges)) {
    const base = lo + (hi - lo) * ramp;
    const sets = base * phaseDef.volumeMultiplier * volumeScale;
    out[region] = Math.max(1, Math.round(sets));
  }
  return out;
}

/* ─── Conditioning target ─────────────────────────────────────────────── */

function conditioningTarget(
  dna: ProtocolDNA,
  week: BlueprintDay[],
  phaseDef: ProgramPhaseDefinition,
  weekNumber: number,
  profile: AthleteProgrammingProfile,
): ProjectedProgramWeek["conditioningTarget"] | undefined {
  const conditioningDays = week.filter(isConditioningDay);
  if (conditioningDays.length === 0) return undefined;

  const outdoor = conditioningDays.filter((d) => d.archetype === "outdoor-distance").length;
  const impactLimited = profile.impactTolerance === "very-low" || profile.impactTolerance === "low";

  // Base duration grows with the phase multiplier and the week's position.
  const baseMinutes = outdoor > 0 ? 35 : 25;
  const growth = 1 + Math.min(0.5, (weekNumber - 1) * 0.04);
  const duration = Math.round(baseMinutes * phaseDef.conditioningMultiplier * growth);

  const type = outdoor > 0
    ? impactLimited
      ? "Low-impact distance (cycling, incline walking, or rowing)"
      : "Outdoor distance"
    : "Structured conditioning";

  const target: NonNullable<ProjectedProgramWeek["conditioningTarget"]> = {
    type,
    frequency: conditioningDays.length,
    duration,
    intensity: phaseDef.kind === "deload" || phaseDef.kind === "taper"
      ? "Easy — conversational"
      : phaseDef.kind === "intensification"
        ? "Moderate to hard on the quality exposure, easy on the rest"
        : "Mostly easy with one controlled harder exposure",
  };

  // Distance is only projected when the athlete has the history to make a
  // distance figure meaningful. Otherwise duration is the honest unit.
  if (outdoor > 0 && !impactLimited && dna.fatigue.impactDemand === "high") {
    target.distance = Math.round((duration / 60) * 8 * 10) / 10; // ~8 km/h reference pace
  }
  return target;
}

/* ─── Week generation ─────────────────────────────────────────────────── */

export type GenerateHorizonInput = {
  protocolId: string;
  snapshot: AthleteContextSnapshot;
  profile: AthleteProgrammingProfile;
  /** Override the block length; otherwise taken from suitability. */
  totalWeeks?: number;
  /** Override the frequency; otherwise taken from suitability. */
  frequency?: number;
  startDate?: string;
  /** Set when the athlete picked this protocol against the recommendation. */
  athleteChoseManually?: boolean;
  /** Additional resolver context (activity stack, weak points, recovery pref). */
  resolveExtras?: {
    activityStack?: string | null;
    activitySport?: string | null;
    recoveryPreference?: string | null;
  };
  now?: Date;
};

export function generateProgramHorizon(input: GenerateHorizonInput): ProgramHorizon | null {
  const dna = getProtocolDNA(input.protocolId);
  if (!dna) return null;
  const def = getProtocol(input.protocolId);

  const { snapshot, profile } = input;
  const suitability: ProtocolSuitability = scoreProtocolSuitability(dna, snapshot, profile);
  const frequency = input.frequency ?? suitability.recommendedFrequency;
  const totalWeeks = Math.max(1, input.totalWeeks ?? suitability.recommendedDurationWeeks);
  const now = input.now ?? new Date();
  const generatedAt = now.toISOString();
  const startDate = input.startDate ?? generatedAt.slice(0, 10);

  const phases = distributePhases(dna.phases, totalWeeks);
  const phaseDefById = new Map(dna.phases.map((p) => [p.id, p]));

  // Volume scale from the athlete's own tolerance — a recovery-limited
  // athlete runs the same architecture at a genuinely lower set count.
  const volumeScale =
    profile.volumeTolerance === "very-low" ? 0.7
      : profile.volumeTolerance === "low" ? 0.85
        : profile.volumeTolerance === "very-high" ? 1.12
          : profile.volumeTolerance === "high" ? 1.05
            : 1;

  const weeks: ProjectedProgramWeek[] = [];
  for (let weekNumber = 1; weekNumber <= totalWeeks; weekNumber += 1) {
    const phase = phases.find((p) => weekNumber >= p.weekStart && weekNumber <= p.weekEnd) ?? phases[phases.length - 1];
    if (!phase) break;
    const phaseDef = phaseDefById.get(phase.id);
    if (!phaseDef) continue;
    const phaseLength = phase.weekEnd - phase.weekStart + 1;
    const phaseWeek = weekNumber - phase.weekStart + 1;

    const { week: structure } = resolveWeeklyBlueprint({
      protocolId: dna.protocolId,
      category: def?.category ?? null,
      trainingDaysTarget: frequency,
      activityStack: input.resolveExtras?.activityStack ?? null,
      activitySport: input.resolveExtras?.activitySport ?? null,
      recoveryPreference: input.resolveExtras?.recoveryPreference ?? null,
      musclePriority: snapshot.training.weakPoints ?? [],
      weekNumber,
    });

    const setTargets = weekSetTargets(dna, phaseDef, phaseWeek, phaseLength, volumeScale);
    const status: ProjectedWeekStatus =
      phaseDef.kind === "deload" ? "deload"
        : phaseDef.kind === "assessment" ? "assessment"
          : "projected";

    weeks.push({
      weekNumber,
      phaseId: phase.id,
      phaseName: phase.name,
      phaseWeek,
      objective: phase.objective,
      expectedAdaptation: phase.expectedAdaptation,
      weeklyStructure: structure,
      volumeTarget: {
        relativeLoad: `${Math.round(phaseDef.volumeMultiplier * volumeScale * 100)}% of the protocol's baseline weekly volume`,
        setTargets,
      },
      intensityTarget: {
        effortRange: phaseDef.effortRange,
        primaryLiftExposure: dna.stimulus.primaryLiftPolicy
          ? primaryLiftExposureFor(phaseDef, phaseWeek, phaseLength)
          : undefined,
      },
      conditioningTarget: conditioningTarget(dna, structure, phaseDef, weekNumber, profile),
      recoveryTarget: recoveryTargetFor(dna, phaseDef, profile),
      nutritionDemand: nutritionDemandFor(dna, phaseDef),
      athleteRationale: weekRationale(dna, phaseDef, phase, phaseWeek, phaseLength, weekNumber, totalWeeks, snapshot, profile),
      entryCriteria: phaseWeek === 1 ? phase.entryCriteria : [`Week ${weekNumber - 1} completed`],
      exitCriteria: phaseWeek === phaseLength ? phase.exitCriteria : [`Week ${weekNumber} volume and effort targets met`],
      status,
    });
  }

  const explanation = buildProtocolExplanation(dna, suitability, snapshot, profile, {
    protocolName: def?.name ?? dna.protocolId,
    athleteChoseManually: input.athleteChoseManually,
  });

  return {
    programId: `horizon-${dna.protocolId}-${Date.parse(generatedAt)}`,
    athleteId: snapshot.athleteId,
    protocolId: dna.protocolId,
    protocolName: def?.name ?? dna.protocolId,
    architectureVersion: dna.architectureVersion,
    horizonVersion: PROGRAM_HORIZON_VERSION,
    athleteSnapshotVersion: snapshot.snapshotVersion,
    athleteSnapshot: snapshot,
    totalWeeks,
    frequency,
    phases,
    weeks,
    originalWeeks: weeks.map(cloneWeek),
    revisions: [],
    protocolSuitability: suitability,
    personalizedExplanation: explanation,
    assumptions: [...new Set([...snapshot.evidence.assumptions, ...profile.assumptions])],
    generatedAt,
    startDate,
  };
}

export function cloneWeek(w: ProjectedProgramWeek): ProjectedProgramWeek {
  return {
    ...w,
    weeklyStructure: w.weeklyStructure.map((d) => ({ ...d, emphasis: [...d.emphasis] })),
    volumeTarget: { ...w.volumeTarget, setTargets: { ...w.volumeTarget.setTargets } },
    intensityTarget: { ...w.intensityTarget },
    conditioningTarget: w.conditioningTarget ? { ...w.conditioningTarget } : undefined,
    recoveryTarget: [...w.recoveryTarget],
    expectedAdaptation: [...w.expectedAdaptation],
    athleteRationale: {
      whyThisWeekFitsNow: [...w.athleteRationale.whyThisWeekFitsNow],
      whatThisWeekShouldDo: [...w.athleteRationale.whatThisWeekShouldDo],
      watchItems: [...w.athleteRationale.watchItems],
    },
    entryCriteria: [...w.entryCriteria],
    exitCriteria: [...w.exitCriteria],
  };
}

/* ─── Per-week detail builders ────────────────────────────────────────── */

function primaryLiftExposureFor(phaseDef: ProgramPhaseDefinition, phaseWeek: number, phaseLength: number): string {
  switch (phaseDef.kind) {
    case "foundation":
      return "Technique-standard top set at a repeatable load — no maximal attempts.";
    case "accumulation":
      return `Top set in the 5–8 rep range, ${phaseWeek === 1 ? "opening the phase conservatively" : "progressing from last week's logged result"}.`;
    case "intensification":
      return `Top set in the 3–5 rep range${phaseWeek >= phaseLength ? " at the phase's heaviest planned exposure" : ", stepping up from last week"}.`;
    case "realization":
      return "Heavy single or triple at the technique standard — this is the week the block's strength is expressed.";
    case "deload":
      return "Top set held at roughly 70% of the previous week's load. No progression attempted.";
    case "assessment":
      return "Tested top set under standard conditions and recorded.";
    default:
      return "Top set logged and progressed on measured performance.";
  }
}

function recoveryTargetFor(
  dna: ProtocolDNA,
  phaseDef: ProgramPhaseDefinition,
  profile: AthleteProgrammingProfile,
): string[] {
  const out: string[] = [];
  if (phaseDef.kind === "deload") {
    out.push("This is a deload — the goal is to arrive at next week with fatigue cleared, not to hold output.");
  } else if (phaseDef.kind === "intensification" || phaseDef.kind === "realization") {
    out.push("The hardest training of the block sits here. Sleep and post-session recovery carry more weight than usual this week.");
  } else {
    out.push(`Recovery demand this week reads ${dna.fatigue.recoveryDemand}.`);
  }
  if (profile.recoveryPriority === "critical" || profile.recoveryPriority === "high") {
    out.push("Your recovery capacity is the limiting factor in this plan, so a readiness decline pauses progression rather than being pushed through.");
  }
  if (dna.fatigue.lowerBodyInterference === "high") {
    out.push("Lower-body work and conditioning are separated — the spacing is doing real work and should not be collapsed.");
  }
  return out;
}

function nutritionDemandFor(dna: ProtocolDNA, phaseDef: ProgramPhaseDefinition): string {
  const base = dna.nutrition.demandClass;
  // The phase sets the LEVEL; the protocol sets the DIRECTION. Both belong in
  // the line, otherwise a deficit block and a surplus block read identically
  // on the same phase kind.
  const direction = dna.nutrition.bodyCompositionSupport;
  const phaseLine =
    phaseDef.kind === "deload" || phaseDef.kind === "taper"
      ? `Reduced from ${base} — training demand drops this week, so fuel demand drops with it while protein holds.`
      : phaseDef.kind === "intensification" || phaseDef.kind === "realization"
        ? `Elevated above ${base} — this is the block's highest training demand and underfuelling shows up here first.`
        : phaseDef.kind === "assessment"
          ? `${base}, with carbohydrate available before the tested sessions so the result reflects training rather than fuelling.`
          : `${base} — ${dna.nutrition.trainingDayPattern}`;
  return `${phaseLine} ${direction}`;
}

function weekRationale(
  dna: ProtocolDNA,
  phaseDef: ProgramPhaseDefinition,
  phase: ProgramPhase,
  phaseWeek: number,
  phaseLength: number,
  weekNumber: number,
  totalWeeks: number,
  snapshot: AthleteContextSnapshot,
  profile: AthleteProgrammingProfile,
): ProjectedProgramWeek["athleteRationale"] {
  const whyThisWeekFitsNow: string[] = [];
  const whatThisWeekShouldDo: string[] = [...phaseDef.expectedAdaptation];
  const watchItems: string[] = [];

  whyThisWeekFitsNow.push(
    `Week ${weekNumber} of ${totalWeeks} — week ${phaseWeek} of ${phaseLength} in ${phase.name}. ${phase.objective}`,
  );

  if (phaseDef.kind === "foundation" && weekNumber <= 2) {
    whyThisWeekFitsNow.push("Early weeks establish the loads everything after them is measured against. Going hard here costs the rest of the block.");
  }
  if (phaseDef.kind === "deload") {
    whyThisWeekFitsNow.push("This week is planned, not a setback. Fatigue has accumulated to the point where clearing it is worth more than another hard week.");
  }
  if (phaseDef.kind === "assessment") {
    whyThisWeekFitsNow.push("This week measures what the block actually produced, so the next one starts from evidence rather than from assumption.");
  }
  if (phaseWeek === phaseLength && phaseDef.kind === "accumulation") {
    whyThisWeekFitsNow.push("This is the top of the accumulation band — volume does not go higher inside this phase.");
  }

  // Athlete-specific: tie the week to their actual constraints.
  if (profile.recoveryCapacity === "low" || profile.recoveryCapacity === "very-low") {
    whyThisWeekFitsNow.push(
      `Volume this week is scaled down from the protocol's authored figure because your recovery capacity reads ${profile.recoveryCapacity}.`,
    );
  }
  if (snapshot.nutrition.weightTrend === "falling-fast" && phaseDef.kind === "intensification") {
    watchItems.push("Your weight is falling quickly going into the block's hardest phase. If strength drops, the deficit is the first thing to review — not the training.");
  }

  watchItems.push(...phaseDef.exitCriteria.map((c) => `Exit check: ${c}`));
  if (dna.fatigue.impactDemand === "high" && (profile.impactTolerance === "low" || profile.impactTolerance === "very-low")) {
    watchItems.push("Joint response to the conditioning work — this is the signal that decides whether distance progresses next week.");
  }

  return { whyThisWeekFitsNow, whatThisWeekShouldDo, watchItems };
}

/* ─── Reading the horizon ─────────────────────────────────────────────── */

/** 1-based current week for a horizon, from its start date. */
export function currentWeekNumber(horizon: ProgramHorizon, now: Date = new Date()): number {
  const start = Date.parse(`${horizon.startDate}T00:00:00`);
  if (Number.isNaN(start)) return 1;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const weeks = Math.floor((today - start) / (7 * 86_400_000));
  return Math.max(1, Math.min(horizon.totalWeeks, weeks + 1));
}

/** The horizon with `active` / `completed` statuses applied for a given date. */
export function withLiveStatus(horizon: ProgramHorizon, now: Date = new Date()): ProgramHorizon {
  const current = currentWeekNumber(horizon, now);
  return {
    ...horizon,
    weeks: horizon.weeks.map((w) => {
      if (w.weekNumber < current) return { ...w, status: "completed" as const };
      if (w.weekNumber === current) return { ...w, status: "active" as const };
      // Preserve deload / assessment / revised labelling on future weeks.
      return w.status === "completed" || w.status === "active" ? { ...w, status: "projected" as const } : w;
    }),
  };
}

export function getWeek(horizon: ProgramHorizon, weekNumber: number): ProjectedProgramWeek | null {
  return horizon.weeks.find((w) => w.weekNumber === weekNumber) ?? null;
}

export function getOriginalWeek(horizon: ProgramHorizon, weekNumber: number): ProjectedProgramWeek | null {
  return horizon.originalWeeks.find((w) => w.weekNumber === weekNumber) ?? null;
}
