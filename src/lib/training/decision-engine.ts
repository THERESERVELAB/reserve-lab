/* ════════════════════════════════════════════════════════════════════════
   RESERVE ATHLETE — ADAPTIVE DECISION ENGINE
   docs/RESERVE_ATHLETE_INTELLIGENCE.md § 3.2

   Asks "can today be improved?" instead of just reading the calendar.
   Composes ReadinessResult + PhysiqueProtectionResult + today's session
   shape into an ordered list of adaptations. Protection is a hard
   constraint: an "intervene" verdict vetoes any authorization to push
   conditioning or athletic load, regardless of how primed readiness looks.

   Pure + deterministic. Observational coaching language only.
   ════════════════════════════════════════════════════════════════════════ */

import type { ReadinessResult } from "@/lib/training/readiness-engine";
import type { PhysiqueProtectionResult } from "@/lib/training/physique-protection";
import type { SessionLoadType } from "@/lib/training/recovery-engine";

export type DayAdaptationTarget = "training" | "conditioning" | "recovery" | "nutrition";

export type DayAdaptation = {
  id: string;
  action: string;
  headline: string;
  reason: string;
  appliesTo: DayAdaptationTarget;
  protectsPhysique: boolean;
};

export type AdaptTodayInput = {
  readiness: ReadinessResult;
  protection: PhysiqueProtectionResult;
  todayLoadType: SessionLoadType;
  yesterdayLoadType: SessionLoadType | null;
  /** True once nutrition timing is confirmed adequate before a performance day. Undefined = not logged. */
  fueledForPerformance?: boolean;
};

const HIGH_OUTPUT: SessionLoadType[] = ["sprint-power", "conditioning"];

/** True when sleep specifically (not the composite) is dragging readiness down. */
function sleepIsTheDriver(readiness: ReadinessResult): boolean {
  return readiness.drivers.negative.some((s) => s.key === "sleepDuration" || s.key === "sleepQuality");
}

export function adaptToday(input: AdaptTodayInput): DayAdaptation[] {
  const { readiness, protection, todayLoadType, yesterdayLoadType, fueledForPerformance } = input;
  const adaptations: DayAdaptation[] = [];
  const intervene = protection.verdict === "intervene";

  // Protection is evaluated first and stated up front when it's binding.
  if (intervene) {
    const lead = protection.flags.find((f) => f.severity === "high");
    adaptations.push({
      id: "protection-override",
      action: "Cap conditioning and athletic load",
      headline: "Physique protection is active — muscle wins today.",
      reason: lead?.detail ?? "A protection guardrail is active.",
      appliesTo: "conditioning",
      protectsPhysique: true,
    });
  }

  // Heavy lower yesterday + sprint/conditioning today → swap intervals for Zone 2.
  const legsCarriedYesterday = yesterdayLoadType === "heavy-lower" && HIGH_OUTPUT.includes(todayLoadType);
  if (legsCarriedYesterday) {
    adaptations.push({
      id: "swap-intervals-zone2",
      action: "Swap intervals for Zone 2",
      headline: "Legs carried yesterday's heavy load — protect them today.",
      reason: "Heavy lower work yesterday plus high-output work today risks the legs. Zone 2 keeps the conditioning slot without the impact cost.",
      appliesTo: "conditioning",
      protectsPhysique: true,
    });
  }

  // Readiness compromised/depleted + lifting today → reduce accessory volume, keep the lifts.
  if ((readiness.band === "compromised" || readiness.band === "depleted") && !HIGH_OUTPUT.includes(todayLoadType)) {
    adaptations.push({
      id: "reduce-accessory",
      action: "Reduce accessory volume, keep the primary lifts",
      headline: readiness.band === "depleted" ? "Readiness is depleted — the lift stays, the extras go." : "Readiness is compromised — trim the accessory work.",
      reason: "The compound lifts still earn their exposure. Accessory volume is what yields when readiness is low.",
      appliesTo: "training",
      protectsPhysique: true,
    });
  }

  // Poor sleep specifically → keep lifting, cut conditioning.
  if (sleepIsTheDriver(readiness) && !intervene) {
    adaptations.push({
      id: "sleep-cut-conditioning",
      action: "Keep the lift, cut conditioning",
      headline: "Sleep is the limiter today.",
      reason: "Sleep is driving readiness down. The lift is protected — conditioning is what gets trimmed.",
      appliesTo: "conditioning",
      protectsPhysique: true,
    });
  }

  if (!intervene) {
    // Readiness primed + hypertrophy today → authorize extra volume.
    if (readiness.band === "primed" && todayLoadType === "hypertrophy") {
      adaptations.push({
        id: "authorize-extra-volume",
        action: "Authorize extra hypertrophy volume",
        headline: "Readiness is primed — take the extra set.",
        reason: "Recovery is fully banked and today is a hypertrophy day. The output is there to use.",
        appliesTo: "training",
        protectsPhysique: false,
      });
    }

    // Readiness primed + sprint day → authorize the sprint session (unless the
    // legs-carried-yesterday guardrail already swapped it for Zone 2).
    if (readiness.band === "primed" && todayLoadType === "sprint-power" && !legsCarriedYesterday) {
      adaptations.push({
        id: "authorize-sprint",
        action: "Authorize the sprint session",
        headline: "Readiness is primed — the athletic session is cleared.",
        reason: "No protection flag is active and readiness is fully banked. Today's athletic capacity work is authorized as planned.",
        appliesTo: "training",
        protectsPhysique: false,
      });
    }
  }

  // High fatigue (either side) → increase the recovery prescription.
  const highFatigue = readiness.drivers.negative.some((s) => s.key === "lowerFatigue" || s.key === "upperFatigue");
  if (highFatigue) {
    adaptations.push({
      id: "increase-recovery",
      action: "Extend today's recovery prescription",
      headline: "Fatigue is elevated — recovery gets more of the day.",
      reason: "Logged fatigue is a top negative driver on readiness. Widening the recovery block protects tomorrow's output.",
      appliesTo: "recovery",
      protectsPhysique: true,
    });
  }

  // Low fuel + a performance day → fuel before performance work.
  if (fueledForPerformance === false && HIGH_OUTPUT.includes(todayLoadType)) {
    adaptations.push({
      id: "fuel-before-performance",
      action: "Fuel before the performance work",
      headline: "Today asks for output — fuel it first.",
      reason: "Performance days need the tank full. Eat the pre-session meal before the athletic block starts.",
      appliesTo: "nutrition",
      protectsPhysique: false,
    });
  }

  if (adaptations.length === 0) {
    adaptations.push({
      id: "hold-plan",
      action: "Run today's session as planned",
      headline: "No adaptation needed — the plan already fits today.",
      reason: "Readiness and protection are both clear. Today's plan stands as written.",
      appliesTo: "training",
      protectsPhysique: false,
    });
  }

  return adaptations;
}
