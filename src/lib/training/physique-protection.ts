/* ════════════════════════════════════════════════════════════════════════
   RESERVE ATHLETE — PHYSIQUE PROTECTION SYSTEM
   docs/RESERVE_ATHLETE_INTELLIGENCE.md § 3.5 — "Muscle always wins."

   Evaluates whether today's athletic ambition is safe for the physique.
   Guardrails are hard constraints: the decision engine treats an
   "intervene" verdict as a veto on any authorization to push conditioning
   or athletic load, no matter how primed readiness looks.

   Pure + deterministic. Every flag is grounded in a real signal or reads
   honestly as "not logged" — no invented trends. Observational framing
   only — no medical claims, no dosing.
   ════════════════════════════════════════════════════════════════════════ */

import type { MesoPhase } from "@/lib/training/progression-engine";

export type PhysiqueProtectionSeverity = "info" | "watch" | "high";

export type PhysiqueProtectionFlag = {
  id: string;
  label: string;
  detail: string;
  severity: PhysiqueProtectionSeverity;
};

export type PhysiqueProtectionVerdict = "protected" | "watch" | "intervene";

export type PhysiqueProtectionResult = {
  flags: PhysiqueProtectionFlag[];
  verdict: PhysiqueProtectionVerdict;
  rule: "Muscle always wins.";
};

export type PhysiqueProtectionTrends = {
  /** Bodyweight trend from physique/engine.ts buildPhysiqueGuidance. */
  weightTrend?: "up" | "down" | "stable" | "data-limited";
  weightDeltaLb?: number;
  /** Physique momentum — "stalling" reads as a leg/physique-growth stall signal. */
  physiqueMomentum?: "improving" | "holding" | "needs-data" | "stalling";
  /** True when today's architecture is a lower-body / leg-growth priority week. */
  legGrowthWeek?: boolean;
  hasRecoveryData: boolean;
  recoveryReserve: number | null;
  mesoPhase?: MesoPhase | null;
  /** Not tracked yet anywhere in the app — always surfaces as "not logged". */
  runningVolumeTrend?: "rising" | "stable" | "falling" | null;
  strengthTrend?: "declining" | "stable" | "improving" | null;
};

export function evaluatePhysiqueProtection(trends: PhysiqueProtectionTrends): PhysiqueProtectionResult {
  const flags: PhysiqueProtectionFlag[] = [];

  // Bodyweight dropping too fast → reduce expenditure.
  if (trends.weightTrend === "down" && (trends.weightDeltaLb ?? 0) <= -2) {
    flags.push({
      id: "bodyweight-drop",
      label: "Bodyweight dropping fast",
      detail: `Down ${Math.abs(trends.weightDeltaLb ?? 0)} lb across the logged window — expenditure should come down before it costs muscle.`,
      severity: "high",
    });
  }

  // Recovery insufficient → cap conditioning.
  if (trends.hasRecoveryData && trends.recoveryReserve !== null && trends.recoveryReserve < 62) {
    flags.push({
      id: "recovery-insufficient",
      label: "Recovery insufficient for added load",
      detail: trends.recoveryReserve < 45
        ? "Reserve is compromised — conditioning yields entirely today."
        : "Reserve is in the watch zone — conditioning stays capped so lifting stays protected.",
      severity: trends.recoveryReserve < 45 ? "high" : "watch",
    });
  }

  // Leg growth stalling → reduce endurance volume.
  if (trends.legGrowthWeek && trends.physiqueMomentum === "stalling") {
    flags.push({
      id: "leg-growth-stalling",
      label: "Leg growth stalling",
      detail: "A leg-priority block is active and physique momentum is stalling — endurance volume steps back to protect the stimulus.",
      severity: "watch",
    });
  }

  // Peak / deload — athletic work yields to the physique regardless of readiness.
  if (trends.mesoPhase === "deload" || trends.mesoPhase === "peak") {
    flags.push({
      id: "phase-yields",
      label: trends.mesoPhase === "deload" ? "Deload week active" : "Peak block active",
      detail: trends.mesoPhase === "deload"
        ? "Deload week — athletic work yields to restoration."
        : "Peak block — athletic work yields to clean physique expression.",
      severity: "watch",
    });
  }

  // Running volume rising too far → reduce mileage. Not tracked yet — honest placeholder.
  if (trends.runningVolumeTrend === "rising") {
    flags.push({
      id: "running-volume-rising",
      label: "Running volume rising",
      detail: "Mileage trend is rising — reduce running volume before it competes with lifting recovery.",
      severity: "watch",
    });
  }

  // Strength declining → reduce conditioning before reducing lifting. No source yet.
  if (trends.strengthTrend === "declining") {
    flags.push({
      id: "strength-declining",
      label: "Strength trend declining",
      detail: "Logged strength trend is declining — conditioning is the first thing to reduce, never the lift.",
      severity: "high",
    });
  }

  const verdict: PhysiqueProtectionVerdict = flags.some((f) => f.severity === "high")
    ? "intervene"
    : flags.length > 0
      ? "watch"
      : "protected";

  return { flags, verdict, rule: "Muscle always wins." };
}
