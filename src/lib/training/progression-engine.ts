/* ════════════════════════════════════════════════════════════════════════
   PROGRESSION + ANTI-PLATEAU ENGINE
   ------------------------------------------------------------------------
   Pure, side-effect-free logic that decides — per movement — whether to keep,
   push, rotate, or back off, based on real logged exposures. It never invents
   performance history: when no exposure exists it returns a clean baseline
   state ("Baseline exposure — log top set today").

   Training programming only. No medical, dosing, or supplement guidance.
   ════════════════════════════════════════════════════════════════════════ */

import type { SplitKey } from "./workout-templates";

/* ─── Phase-based programming ────────────────────── */
export type MesoPhase = "accumulation" | "intensification" | "specialization" | "deload" | "peak";

export type PhaseProfile = {
  phase: MesoPhase;
  label: string;
  note: string;
  /** Multiplier applied to programmed working sets (deload trims volume). */
  setBias: number;
  /** Human-readable loading bias for the phase. */
  loadBias: string;
  failureAllowed: boolean;
};

/** Map the current mesocycle week (1-based) to its phase profile. Default block = 8 weeks. */
export function getPhaseForWeek(week: number, totalWeeks = 8): PhaseProfile {
  const w = Math.max(1, Math.min(totalWeeks, Math.round(week)));
  if (w <= 2) return { phase: "accumulation", label: "Accumulation", note: "Build clean volume. Moderate load, perfect execution.", setBias: 1, loadBias: "moderate load · rep quality", failureAllowed: false };
  if (w <= 4) return { phase: "intensification", label: "Intensification", note: "Push the primary lifts. Heavier top sets, controlled back-off volume.", setBias: 1, loadBias: "heavier top sets", failureAllowed: false };
  if (w <= 6) return { phase: "specialization", label: "Specialization", note: "Prioritize weak points. Priority muscle gets earlier, extra volume.", setBias: 1.1, loadBias: "weak-point volume", failureAllowed: true };
  if (w === 7) return { phase: "deload", label: "Deload", note: "Trim sets and load. No failure work — manage fatigue and restore output.", setBias: 0.6, loadBias: "reduced load + sets", failureAllowed: false };
  return { phase: "peak", label: "Peak / Expression", note: "Emphasize priority lifts. Controlled volume, clean output expression.", setBias: 0.85, loadBias: "priority lifts · clean output", failureAllowed: false };
}

/** Apply a phase's set bias to a programmed set count (never below 1). */
export function adjustSetsForPhase(sets: number, phase: PhaseProfile): number {
  return Math.max(1, Math.round(sets * phase.setBias));
}

/* ─── Movement exposure + assessment ─────────────── */
export type MovementExposure = {
  /** Top working set of the most recent exposure. */
  lastTopLoad: number;
  lastTopReps: number;
  /** Consecutive exposures (most recent first) summarised as top-set reps at the same/higher load. */
  recentTopReps: number[];
  /** Number of times this exact movement has run consecutively. */
  consecutiveExposures: number;
  painFlag?: boolean;
};

export type PlateauStatus =
  | "baseline"      // no data yet
  | "progressing"   // improving — keep
  | "hold"          // flat once — focus reps
  | "stalled"       // flat 2 exposures — push rep target
  | "rotate"        // stalled 3+ — rotate movement
  | "pain"          // discomfort logged — swap pattern
  | "deload";       // recovery says back off

export type MovementAssessment = {
  status: PlateauStatus;
  /** Short, coach-style target line for the next exposure. */
  progressionTarget: string;
  /** What the system recommends doing about the movement itself. */
  recommendation: string;
  rotateSuggested: boolean;
  /** 0 (stale) … 100 (fresh). */
  freshnessScore: number;
};

export type RecoverySignal = "good" | "moderate" | "low";

/** Freshness decays as a movement is run for many consecutive exposures. */
export function freshnessScore(consecutiveExposures: number): number {
  if (consecutiveExposures <= 0) return 100;
  // ~ -14 pts/exposure, floored at 10.
  return Math.max(10, 100 - consecutiveExposures * 14);
}

/**
 * Assess a single movement. With no exposure → baseline (no fake history).
 * Recovery and adherence context can override toward a back-off.
 */
export function assessMovement(
  exposure: MovementExposure | undefined,
  ctx?: { recovery?: RecoverySignal; phase?: MesoPhase; adherenceLow?: boolean },
): MovementAssessment {
  const phase = ctx?.phase;
  const recovery = ctx?.recovery ?? "good";

  // No history → clean baseline state.
  if (!exposure) {
    return {
      status: "baseline",
      progressionTarget: "Baseline exposure — log top set today.",
      recommendation: "Collect performance data. Pick a load you can own for the full rep range.",
      rotateSuggested: false,
      freshnessScore: 100,
    };
  }

  const fresh = freshnessScore(exposure.consecutiveExposures);

  // Pain overrides everything.
  if (exposure.painFlag) {
    return {
      status: "pain",
      progressionTarget: "Discomfort logged — switch to a joint-friendly pattern.",
      recommendation: "Swap to a machine or neutral-grip substitution. Re-test the original later.",
      rotateSuggested: true,
      freshnessScore: fresh,
    };
  }

  // Low recovery → hold/back off, don't push load.
  if (recovery === "low" || phase === "deload") {
    return {
      status: "deload",
      progressionTarget: "Hold load. Keep clean reps in reserve.",
      recommendation: "Recovery is limited — keep load stable or trim a set. No failure work.",
      rotateSuggested: false,
      freshnessScore: fresh,
    };
  }

  // Stall detection from recent top-set reps (most recent first).
  const reps = exposure.recentTopReps;
  const improving = reps.length >= 2 && reps[0] > reps[1];
  const flatRuns = countLeadingFlat(reps);

  if (improving) {
    return {
      status: "progressing",
      progressionTarget: "Beat last week by 1 clean rep on the top set.",
      recommendation: "Progressing — keep the movement and continue overload.",
      rotateSuggested: false,
      freshnessScore: fresh,
    };
  }
  if (flatRuns >= 3) {
    return {
      status: "rotate",
      progressionTarget: "Stalled 3 exposures — rotate to a fresh substitution.",
      recommendation: "Top set has stalled. Rotate to a pool substitution to refresh the stimulus.",
      rotateSuggested: true,
      freshnessScore: Math.min(fresh, 30),
    };
  }
  if (flatRuns === 2) {
    return {
      status: "stalled",
      progressionTarget: "Stalled — chase +1 rep at the same load.",
      recommendation: "Hold load and focus the rep target. Rotate next week if it stalls again.",
      rotateSuggested: false,
      freshnessScore: fresh,
    };
  }
  if (ctx?.adherenceLow) {
    return {
      status: "hold",
      progressionTarget: "Hold and simplify — repeat last week cleanly.",
      recommendation: "Adherence is low — hold volume and rebuild consistency before pushing.",
      rotateSuggested: false,
      freshnessScore: fresh,
    };
  }
  return {
    status: "hold",
    progressionTarget: "Match last week, then add 1 clean rep.",
    recommendation: "Repeat the load and earn the rep target before progressing.",
    rotateSuggested: false,
    freshnessScore: fresh,
  };
}

function countLeadingFlat(reps: number[]): number {
  // Counts how many of the most recent exposures are flat/declining vs the one before.
  let run = 0;
  for (let i = 0; i < reps.length - 1; i += 1) {
    if (reps[i] <= reps[i + 1]) run += 1;
    else break;
  }
  return run;
}

/* ─── Split-aware support phases (P4–P7) ─────────── */
export type SupportPhaseHint = {
  key: "core" | "conditioning" | "recovery" | "handoff";
  phaseNumber: 4 | 5 | 6 | 7;
  label: string;
  prescription: string;
  status: "recommended" | "optional" | "required" | "reduced";
};

const UPPER_SPLITS: SplitKey[] = ["upper-specialization", "push", "pull", "arms-delts", "chest-back"];

/** Core / conditioning / recovery / handoff guidance matched to the split + goal + recovery. */
export function getSupportPhaseHints(
  splitKey: SplitKey,
  ctx?: { goal?: string; recovery?: RecoverySignal },
): SupportPhaseHint[] {
  const isUpper = UPPER_SPLITS.includes(splitKey);
  const recovery = ctx?.recovery ?? "good";
  const goal = (ctx?.goal ?? "").toLowerCase();
  const fatLoss = goal.includes("cut") || goal.includes("lean") || goal.includes("fat");

  const core: SupportPhaseHint = isUpper
    ? { key: "core", phaseNumber: 4, label: "Core Command", prescription: "Anti-extension + loaded flexion — cable crunch, ab wheel, brace work.", status: "recommended" }
    : { key: "core", phaseNumber: 4, label: "Core Command", prescription: "Loaded carries + anti-rotation — Pallof press, suitcase carry, dead bug.", status: "recommended" };

  const conditioning: SupportPhaseHint = recovery === "low"
    ? { key: "conditioning", phaseNumber: 5, label: "Conditioning Reserve", prescription: "Cooldown only — easy incline walk. Protect recovery.", status: "reduced" }
    : fatLoss
      ? { key: "conditioning", phaseNumber: 5, label: "Conditioning Reserve", prescription: "Moderate Zone 2 — 20–30 min incline walk or bike.", status: "recommended" }
      : { key: "conditioning", phaseNumber: 5, label: "Conditioning Reserve", prescription: "Short Zone 2 cooldown — 12–15 min, protect output.", status: "optional" };

  const recoveryPhase: SupportPhaseHint = {
    key: "recovery", phaseNumber: 6, label: "Reserve Recovery Suite",
    prescription: isUpper ? "Shoulders / t-spine mobility · optional sauna · breathwork." : "Hips / hamstrings / calves mobility · optional sauna · breathwork.",
    status: "optional",
  };

  const handoff: SupportPhaseHint = {
    key: "handoff", phaseNumber: 7, label: "Post-Session Handoff",
    prescription: "Log the session · post-workout meal · hydration · sleep target · tomorrow readiness.",
    status: "required",
  };

  return [core, conditioning, recoveryPhase, handoff];
}
