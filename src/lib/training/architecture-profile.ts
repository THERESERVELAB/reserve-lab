/* ════════════════════════════════════════════════════════════════════════
   ARCHITECTURE FINGERPRINTS + CAPACITY SCORING

   A structured "fingerprint" for every protocol architecture — derived once
   from the existing ProtocolDefinition (trainingDays, difficulty, commitment,
   category, gymFit, trainingEmphasis). It ANNOTATES the library; it never
   duplicates it.

   The fingerprint lets the recommender reason about an athlete's real
   capacity — training frequency, session length, recovery, weak-point
   specialization, occupation load, injury — instead of goal keywords alone,
   so two same-goal athletes with different capacity diverge to different
   architectures.

   Pure, deterministic, type-only dependency on the library (no runtime cycle).
   Coaching/organization support only — no medical, dosing, or rehab content.
   ════════════════════════════════════════════════════════════════════════ */

import type { GymEnvironment } from "./gym-environment";
import type { ProtocolCategory, ProtocolDefinition } from "@/lib/protocol/library";

export type RecoveryDemand = "low" | "moderate" | "high";
export type SessionLoad = "short" | "standard" | "long";
export type RecoveryCapacity = "low" | "moderate" | "high";
export type OccupationLoad = "sedentary" | "active" | "physical";

export type IntentMix = { strength: number; hypertrophy: number; conditioning: number };

export type ArchitectureFingerprint = {
  /** Range of weekly training days this architecture reads well at. */
  idealFrequency: { min: number; max: number };
  /** How much recovery the structure demands from the athlete. */
  recoveryDemand: RecoveryDemand;
  /** Typical session length the structure implies. */
  sessionLoad: SessionLoad;
  /** Fractional emphasis across the three training intents (sums ≈ 1). */
  intentMix: IntentMix;
  /** True when the architecture can carry a weak-point specialization focus. */
  weakPointCapable: boolean;
  /** Environment the architecture is authored for. */
  environmentFit: ProtocolDefinition["gymFit"];
};

/** Capacity inputs — the athlete traits that selection scores against.
    All optional so existing callers stay behaviourally unchanged until they
    opt in (Phase 5 wires onboarding capture). */
export type CapacityInput = {
  trainingDaysPerWeek?: number | null;
  sessionDurationMin?: number | null;
  recoveryCapacity?: RecoveryCapacity | null;
  /** Weak points are a stated PRIORITY (structural), not just present. */
  weakPointFocus?: boolean;
  occupationLoad?: OccupationLoad | null;
  /** Disclosed injury/pain regions — nudges selection away from high-demand
      structures (movement-level avoidance lives in the prescription engine). */
  injuryRegions?: string[] | null;
};

/* ─── Intent mix by category ──────────────────────────────────────────── */

const INTENT_BY_CATEGORY: Record<ProtocolCategory, IntentMix> = {
  "shred-cut": { strength: 0.15, hypertrophy: 0.4, conditioning: 0.45 },
  "vacation-prep": { strength: 0.15, hypertrophy: 0.4, conditioning: 0.45 },
  transformation: { strength: 0.3, hypertrophy: 0.6, conditioning: 0.1 },
  "lean-bulk": { strength: 0.35, hypertrophy: 0.6, conditioning: 0.05 },
  "classic-physique": { strength: 0.3, hypertrophy: 0.65, conditioning: 0.05 },
  "premium-advanced": { strength: 0.35, hypertrophy: 0.6, conditioning: 0.05 },
  recomp: { strength: 0.35, hypertrophy: 0.4, conditioning: 0.25 },
  "athletic-performance": { strength: 0.4, hypertrophy: 0.3, conditioning: 0.3 },
  "reserve-athlete": { strength: 0.4, hypertrophy: 0.35, conditioning: 0.25 },
  "hybrid-performance": { strength: 0.3, hypertrophy: 0.4, conditioning: 0.3 },
  "womens-performance": { strength: 0.3, hypertrophy: 0.55, conditioning: 0.15 },
  "lifestyle-reset": { strength: 0.4, hypertrophy: 0.2, conditioning: 0.4 },
  "fertility-lifestyle": { strength: 0.4, hypertrophy: 0.2, conditioning: 0.4 },
  "pregnancy-lifestyle": { strength: 0.4, hypertrophy: 0.15, conditioning: 0.45 },
  "at-home": { strength: 0.35, hypertrophy: 0.45, conditioning: 0.2 },
  "enhanced-log-only": { strength: 0.34, hypertrophy: 0.33, conditioning: 0.33 },
  powerbuilding: { strength: 0.5, hypertrophy: 0.42, conditioning: 0.08 },
  strength: { strength: 0.75, hypertrophy: 0.2, conditioning: 0.05 },
  "tactical-hybrid": { strength: 0.35, hypertrophy: 0.2, conditioning: 0.45 },
  "endurance-physique": { strength: 0.15, hypertrophy: 0.25, conditioning: 0.6 },
  foundation: { strength: 0.45, hypertrophy: 0.35, conditioning: 0.2 },
  "recovery-constrained": { strength: 0.4, hypertrophy: 0.4, conditioning: 0.2 },
  specialization: { strength: 0.2, hypertrophy: 0.72, conditioning: 0.08 },
};

function deriveRecoveryDemand(def: ProtocolDefinition): RecoveryDemand {
  let s = 0;
  s += def.difficulty === "elite" ? 3 : def.difficulty === "advanced" ? 2 : def.difficulty === "intermediate" ? 1 : 0;
  s += def.commitment === "very-high" ? 2 : def.commitment === "high" ? 1 : 0;
  s += def.trainingDays >= 6 ? 2 : def.trainingDays >= 5 ? 1 : 0;
  return s >= 5 ? "high" : s >= 3 ? "moderate" : "low";
}

function deriveSessionLoad(def: ProtocolDefinition): SessionLoad {
  if (def.difficulty === "accessible") return "short";
  if (def.trainingDays >= 6) return "standard"; // more frequency → shorter sessions
  if (def.difficulty === "elite") return "long";
  if (def.difficulty === "advanced" && def.trainingDays <= 4) return "long";
  return "standard";
}

function deriveWeakPointCapable(def: ProtocolDefinition): boolean {
  return (
    /weak[\s-]?point|special/i.test(def.trainingEmphasis) ||
    def.category === "classic-physique" ||
    def.category === "premium-advanced"
  );
}

export function architectureFingerprint(def: ProtocolDefinition): ArchitectureFingerprint {
  const days = def.trainingDays || 4;
  return {
    idealFrequency: { min: Math.max(2, days - 1), max: Math.min(7, days + 1) },
    recoveryDemand: deriveRecoveryDemand(def),
    sessionLoad: deriveSessionLoad(def),
    intentMix: INTENT_BY_CATEGORY[def.category] ?? INTENT_BY_CATEGORY["enhanced-log-only"],
    weakPointCapable: deriveWeakPointCapable(def),
    environmentFit: def.gymFit,
  };
}

/* ─── Capacity scoring ────────────────────────────────────────────────── */

export type ScoreFactor = { label: string; delta: number };

const DEMAND_RANK: Record<RecoveryDemand, number> = { low: 0, moderate: 1, high: 2 };
const CAPACITY_RANK: Record<RecoveryCapacity, number> = { low: 0, moderate: 1, high: 2 };

function sessionBand(min: number): SessionLoad {
  if (min < 45) return "short";
  if (min > 70) return "long";
  return "standard";
}
const LOAD_RANK: Record<SessionLoad, number> = { short: 0, standard: 1, long: 2 };

/**
 * Score how well an architecture fits the athlete's CAPACITY (beyond goal).
 * Returns named factors so the selection can explain itself. Every term is
 * zero when its input is absent, so callers that don't supply capacity data
 * are scored exactly as before.
 */
export function capacityScore(fp: ArchitectureFingerprint, input: CapacityInput): { score: number; factors: ScoreFactor[] } {
  const factors: ScoreFactor[] = [];
  const push = (label: string, delta: number) => { if (delta !== 0) factors.push({ label, delta }); };

  /* Frequency fit — the single strongest capacity signal. */
  if (input.trainingDaysPerWeek != null) {
    const d = input.trainingDaysPerWeek;
    if (d >= fp.idealFrequency.min && d <= fp.idealFrequency.max) push("Frequency matches", 3);
    else {
      const gap = d < fp.idealFrequency.min ? fp.idealFrequency.min - d : d - fp.idealFrequency.max;
      push(gap >= 2 ? "Frequency far off" : "Frequency slightly off", gap >= 2 ? -3 : -1);
    }
  }

  /* Recovery fit — demand vs the athlete's recovery capacity. */
  if (input.recoveryCapacity != null) {
    const gap = DEMAND_RANK[fp.recoveryDemand] - CAPACITY_RANK[input.recoveryCapacity];
    if (gap >= 2) push("Recovery demand exceeds capacity", -3);
    else if (gap === 1) push("Recovery demand above capacity", -1);
    else if (gap <= -1 && fp.recoveryDemand !== "low") push("Recovery headroom carries it", 1);
    else push("Recovery demand matches", 1);
  }

  /* Duration fit — session load vs the athlete's session window. */
  if (input.sessionDurationMin != null) {
    const band = sessionBand(input.sessionDurationMin);
    const gap = LOAD_RANK[fp.sessionLoad] - LOAD_RANK[band];
    if (gap >= 2) push("Sessions run longer than the window", -2);
    else if (gap === 1) push("Sessions slightly long for the window", -1);
    else push("Session length fits", 1);
  }

  /* Weak-point specialization — structural, only when it's a stated priority. */
  if (input.weakPointFocus && fp.weakPointCapable) push("Carries weak-point specialization", 3);
  else if (input.weakPointFocus && !fp.weakPointCapable) push("Cannot specialize weak points", -1);

  /* Occupation load — physical jobs subtract recovery; sedentary tolerates volume. */
  if (input.occupationLoad === "physical" && fp.recoveryDemand === "high") push("Physical occupation limits recovery", -2);
  else if (input.occupationLoad === "sedentary" && fp.recoveryDemand !== "high" && DEMAND_RANK[fp.recoveryDemand] >= 1) push("Desk occupation leaves recovery room", 1);

  /* Injury/pain — nudge away from the most demanding structures (movement-level
     avoidance is handled in the prescription engine, not here). */
  if (input.injuryRegions && input.injuryRegions.length > 0 && fp.recoveryDemand === "high") push("High-demand structure with disclosed injury", -2);

  return { score: factors.reduce((a, f) => a + f.delta, 0), factors };
}

/* Re-exported for callers that need the environment type without importing
   the library module directly. */
export type { GymEnvironment };
