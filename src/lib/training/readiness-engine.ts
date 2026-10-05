/* ════════════════════════════════════════════════════════════════════════
   RESERVE ATHLETE — DAILY READINESS ENGINE
   docs/RESERVE_ATHLETE_INTELLIGENCE.md § 2, § 3.1

   Graceful-scaling signal model: every input is optional. The score is a
   weighted composite over whichever signals are PRESENT today; missing
   signals don't count against the score, only against coverage/confidence.
   New signals (wearables) drop in by adding a key + weight — no rewrite.

   Pure + deterministic. No store access. Observational framing only — no
   medical claims, no dosing, no diagnosis.
   ════════════════════════════════════════════════════════════════════════ */

export type ReadinessSignalKey =
  | "sleepDuration" | "sleepQuality" | "recoveryReserve" | "recoveryCompletion"
  | "trainingLoad" | "runningLoad" | "lowerFatigue" | "upperFatigue" | "soreness"
  | "restingHR" | "hrv" | "calories" | "protein" | "hydration" | "steps"
  | "stress" | "mood" | "bodyweightTrend";

/** Each provided signal is a 0..100 readiness contribution (higher = more ready) + weight. */
export type ReadinessSignal = { key: ReadinessSignalKey; label: string; score: number; weight: number; note?: string };

export type ReadinessBand = "primed" | "ready" | "moderate" | "compromised" | "depleted";

export type ReadinessResult = {
  score: number; // 0..100 weighted over PRESENT signals
  band: ReadinessBand;
  coverage: number; // 0..1 fraction of canonical signal weight present
  confidence: "high" | "moderate" | "limited";
  drivers: { positive: ReadinessSignal[]; negative: ReadinessSignal[] };
  missing: ReadinessSignalKey[]; // what would sharpen the score (wearable upsell honesty)
};

/** Canonical registry — key → default weight + label. Defines total coverage. */
export const READINESS_SIGNALS: Record<ReadinessSignalKey, { label: string; weight: number }> = {
  recoveryReserve: { label: "Recovery Reserve", weight: 3 },
  sleepQuality: { label: "Sleep Quality", weight: 2.5 },
  sleepDuration: { label: "Sleep Duration", weight: 2 },
  trainingLoad: { label: "Recent Training Load", weight: 2 },
  lowerFatigue: { label: "Lower-Body Fatigue", weight: 1.5 },
  upperFatigue: { label: "Upper-Body Fatigue", weight: 1 },
  stress: { label: "Stress Load", weight: 1.5 },
  recoveryCompletion: { label: "Recovery Suite Completion", weight: 1 },
  runningLoad: { label: "Running Load", weight: 1 },
  soreness: { label: "Soreness", weight: 1 },
  hydration: { label: "Hydration", weight: 1 },
  bodyweightTrend: { label: "Bodyweight Trend", weight: 1 },
  // Wearable-ready — pre-declared, light up when the signal source exists.
  restingHR: { label: "Resting Heart Rate", weight: 1.5 },
  hrv: { label: "HRV", weight: 2 },
  calories: { label: "Calorie Adherence", weight: 0.75 },
  protein: { label: "Protein Adherence", weight: 0.75 },
  steps: { label: "Step Trend", weight: 0.5 },
  mood: { label: "Mood", weight: 0.5 },
};

const TOTAL_CANONICAL_WEIGHT = Object.values(READINESS_SIGNALS).reduce((s, v) => s + v.weight, 0);

function bandFor(score: number): ReadinessBand {
  if (score >= 85) return "primed";
  if (score >= 70) return "ready";
  if (score >= 55) return "moderate";
  if (score >= 40) return "compromised";
  return "depleted";
}

/** Compose the weighted readiness score from whatever signals are present. */
export function computeReadiness(signals: ReadinessSignal[]): ReadinessResult {
  const presentKeys = new Set(signals.map((s) => s.key));
  const missing = (Object.keys(READINESS_SIGNALS) as ReadinessSignalKey[]).filter((k) => !presentKeys.has(k));

  if (signals.length === 0) {
    return {
      score: 0,
      band: "moderate",
      coverage: 0,
      confidence: "limited",
      drivers: { positive: [], negative: [] },
      missing,
    };
  }

  const presentWeight = signals.reduce((s, sig) => s + sig.weight, 0);
  const weightedScore = signals.reduce((s, sig) => s + sig.score * sig.weight, 0) / presentWeight;
  const coverage = Math.min(1, presentWeight / TOTAL_CANONICAL_WEIGHT);
  const confidence: ReadinessResult["confidence"] = coverage >= 0.55 ? "high" : coverage >= 0.3 ? "moderate" : "limited";

  const sorted = [...signals].sort((a, b) => b.score - a.score);
  const positive = sorted.filter((s) => s.score >= 65).slice(0, 3);
  const negative = [...sorted].reverse().filter((s) => s.score <= 45).slice(0, 3);

  return {
    score: Math.round(weightedScore),
    band: bandFor(weightedScore),
    coverage: Math.round(coverage * 100) / 100,
    confidence,
    drivers: { positive, negative },
    missing,
  };
}

/* ─── Signal builders — map existing systems into ReadinessSignal[] ──────── */

export type ReadinessSourceInput = {
  /** Recovery Command snapshot (recovery/engine.ts buildRecoverySnapshot). */
  recovery: {
    hasData: boolean;
    reserve: number;
    sleepAvg7: number;
    sleepConsistency: "strong" | "variable" | "data-limited";
    stressLoad: "low" | "moderate" | "elevated" | "high" | "data-limited";
    mobilityThisWeek: number;
    mobilityWeeklyTarget: number;
    hydrationStatus: "on-target" | "behind-pace" | "data-limited";
  };
  sleepTargetHours: number;
  /** Yesterday's session load — heavier load lowers today's training-load contribution. */
  yesterdayLoadReadiness?: number | null; // 0..100, caller maps SessionLoadType → score
  /** Optional member-logged fatigue (0 fresh .. 100 fatigued) — inverted into a readiness score. */
  lowerFatigue?: number | null;
  upperFatigue?: number | null;
  bodyweightTrend?: "up" | "down" | "stable" | "data-limited";
};

const STRESS_SCORE: Record<ReadinessSourceInput["recovery"]["stressLoad"], number> = {
  low: 90, moderate: 70, elevated: 45, high: 20, "data-limited": 50,
};

/** Build the present ReadinessSignal[] from systems Reserve Athlete already has today. */
export function buildReadinessSignals(input: ReadinessSourceInput): ReadinessSignal[] {
  const { recovery } = input;
  const signals: ReadinessSignal[] = [];

  if (recovery.hasData) {
    signals.push({ key: "recoveryReserve", label: READINESS_SIGNALS.recoveryReserve.label, score: recovery.reserve, weight: READINESS_SIGNALS.recoveryReserve.weight });

    const sleepAdherence = input.sleepTargetHours > 0 ? Math.min(100, (recovery.sleepAvg7 / input.sleepTargetHours) * 100) : 50;
    signals.push({ key: "sleepDuration", label: READINESS_SIGNALS.sleepDuration.label, score: Math.round(sleepAdherence), weight: READINESS_SIGNALS.sleepDuration.weight, note: `${recovery.sleepAvg7}h avg vs ${input.sleepTargetHours}h target` });

    if (recovery.sleepConsistency !== "data-limited") {
      signals.push({ key: "sleepQuality", label: READINESS_SIGNALS.sleepQuality.label, score: recovery.sleepConsistency === "strong" ? 88 : 55, weight: READINESS_SIGNALS.sleepQuality.weight });
    }

    if (recovery.stressLoad !== "data-limited") {
      signals.push({ key: "stress", label: READINESS_SIGNALS.stress.label, score: STRESS_SCORE[recovery.stressLoad], weight: READINESS_SIGNALS.stress.weight });
    }

    if (recovery.hydrationStatus !== "data-limited") {
      signals.push({ key: "hydration", label: READINESS_SIGNALS.hydration.label, score: recovery.hydrationStatus === "on-target" ? 85 : 45, weight: READINESS_SIGNALS.hydration.weight });
    }

    if (recovery.mobilityWeeklyTarget > 0) {
      const mobilityAdherence = Math.min(100, (recovery.mobilityThisWeek / recovery.mobilityWeeklyTarget) * 100);
      signals.push({ key: "recoveryCompletion", label: READINESS_SIGNALS.recoveryCompletion.label, score: Math.round(mobilityAdherence), weight: READINESS_SIGNALS.recoveryCompletion.weight });
    }
  }

  if (input.yesterdayLoadReadiness != null) {
    signals.push({ key: "trainingLoad", label: READINESS_SIGNALS.trainingLoad.label, score: input.yesterdayLoadReadiness, weight: READINESS_SIGNALS.trainingLoad.weight });
  }
  if (input.lowerFatigue != null) {
    signals.push({ key: "lowerFatigue", label: READINESS_SIGNALS.lowerFatigue.label, score: Math.max(0, 100 - input.lowerFatigue), weight: READINESS_SIGNALS.lowerFatigue.weight });
  }
  if (input.upperFatigue != null) {
    signals.push({ key: "upperFatigue", label: READINESS_SIGNALS.upperFatigue.label, score: Math.max(0, 100 - input.upperFatigue), weight: READINESS_SIGNALS.upperFatigue.weight });
  }
  if (input.bodyweightTrend && input.bodyweightTrend !== "data-limited") {
    signals.push({ key: "bodyweightTrend", label: READINESS_SIGNALS.bodyweightTrend.label, score: input.bodyweightTrend === "stable" ? 80 : 60, weight: READINESS_SIGNALS.bodyweightTrend.weight });
  }

  return signals;
}
