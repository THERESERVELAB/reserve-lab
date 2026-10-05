/* ────────────────────────────────────────────────────────────────────────────
   WORKOUT DEMAND — the member's chosen session-depth tier.

   Selected in Personal Command, persisted + cloud-synced, and consumed by
   workout generation: exercise count, working sets, loading bias, rest,
   intensity techniques, and weekly volume all scale from this tier — but
   always clamped by the gate below (training age, readiness, recovery,
   pain, phase). A beginner cannot select their way into contest-prep
   volume, and low readiness pulls any tier down.
   ──────────────────────────────────────────────────────────────────────── */

export type WorkoutDemandLevel = "precision" | "high-output" | "elite-volume" | "contest-prep";

export const WORKOUT_DEMAND_META: Record<
  WorkoutDemandLevel,
  {
    label: string;
    tagline: string;
    /** Multipliers the session builder applies to the authored baseline. */
    /* Every field below is read by `applyWorkoutDemand` in workout-templates.ts.
       They were once description only — the engine had its own hard-coded rules
       and an Elite Volume session promised "added angles" it never built. If a
       number changes here, the session changes. */
    /** Movements drawn from the split's specialization pool, on top of the
        authored session. Negative trims detail work. */
    exerciseDelta: number;
    /** Applied to every working set, then rounded and capped. */
    setMultiplier: number;
    restBias: "full" | "standard" | "compressed";
    /** Ceiling on drop-sets / rest-pause finishes carried into the session. */
    intensityTechniques: number;
    minTrainingAge: "beginner" | "intermediate" | "advanced";
  }
> = {
  precision: {
    label: "Precision",
    tagline: "Essential stimulus, immaculate execution. Every set has a reason.",
    exerciseDelta: -1, // one detail-work movement comes off

    setMultiplier: 0.85,
    restBias: "full",
    intensityTechniques: 0,
    minTrainingAge: "beginner",
  },
  "high-output": {
    label: "High Output",
    tagline: "The standard Reserve session — full working volume with progression pressure.",
    exerciseDelta: 0,
    setMultiplier: 1.0,
    restBias: "standard",
    intensityTechniques: 1,
    minTrainingAge: "beginner",
  },
  "elite-volume": {
    label: "Elite Volume",
    tagline: "Extended stimulus — an added angle, heavier working volume, tighter rest.",
    exerciseDelta: 1,
    setMultiplier: 1.25,
    restBias: "compressed",
    intensityTechniques: 2,
    minTrainingAge: "intermediate",
  },
  "contest-prep": {
    label: "Contest Prep",
    tagline: "Peak-phase depth — a specialization angle and a pump finisher on top, tightest rest.",
    exerciseDelta: 2,
    setMultiplier: 1.35,
    restBias: "compressed",
    intensityTechniques: 3,
    minTrainingAge: "advanced",
  },
};

export const WORKOUT_DEMAND_ORDER: WorkoutDemandLevel[] = [
  "precision",
  "high-output",
  "elite-volume",
  "contest-prep",
];

type TrainingAge = "beginner" | "intermediate" | "advanced";

const AGE_RANK: Record<TrainingAge, number> = { beginner: 0, intermediate: 1, advanced: 2 };

export type DemandGateContext = {
  trainingAge: TrainingAge;
  /** 0–100 composite readiness; null = no data (treated conservatively). */
  readiness: number | null;
  /** Active pain/restriction reports touching today's target tissue. */
  activePainFlags: number;
  /** True during a deload / recovery-limited phase. */
  deload: boolean;
};

export type DemandGateResult = {
  effective: WorkoutDemandLevel;
  requested: WorkoutDemandLevel;
  limited: boolean;
  reason: string | null;
};

/**
 * Clamp the requested demand to what the member can productively recover
 * from TODAY. Deterministic and explainable — the UI shows the reason.
 */
export function gateWorkoutDemand(
  requested: WorkoutDemandLevel,
  ctx: DemandGateContext,
): DemandGateResult {
  let effective = requested;
  let reason: string | null = null;

  // Training age floor: never above what the member's experience supports.
  const meta = WORKOUT_DEMAND_META[requested];
  if (AGE_RANK[ctx.trainingAge] < AGE_RANK[meta.minTrainingAge]) {
    effective = ctx.trainingAge === "beginner" ? "high-output" : "elite-volume";
    // Beginners cap at high-output; intermediates cap at elite-volume.
    if (ctx.trainingAge === "beginner" && requested !== "precision") effective = "high-output";
    reason = `Capped for your current training age — depth scales as your history builds.`;
  }

  // Deload weeks pull everything to precision.
  if (ctx.deload && effective !== "precision") {
    effective = "precision";
    reason = "Deload phase — volume intentionally reduced this week.";
  }

  // Low readiness steps the tier down one notch (never below precision).
  if (ctx.readiness !== null && ctx.readiness < 55) {
    const idx = WORKOUT_DEMAND_ORDER.indexOf(effective);
    if (idx > 0) {
      effective = WORKOUT_DEMAND_ORDER[idx - 1];
      reason = `Readiness ${ctx.readiness}% — session depth stepped down to protect recovery.`;
    }
  }

  // Active pain reports step down as well.
  if (ctx.activePainFlags > 0) {
    const idx = WORKOUT_DEMAND_ORDER.indexOf(effective);
    if (idx > 0) {
      effective = WORKOUT_DEMAND_ORDER[idx - 1];
      reason = "Active discomfort report — reduced demand while the area is protected.";
    }
  }

  return { effective, requested, limited: effective !== requested, reason };
}

/**
 * Where a member starts before they have opened the picker.
 *
 * It used to hand an advanced member High Output — the middle of four tiers —
 * so somebody with years of training under them got the standard session
 * unless they went looking for the control. Their history is the evidence for
 * depth, so it sets the depth: advanced opens on Elite Volume, and the picker
 * in Today’s Session says so and dials it back in one tap.
 *
 * Contest Prep stays a deliberate choice — it is a peak-phase posture, not a
 * resting state. And nothing here escapes `gateWorkoutDemand`: low readiness,
 * an active discomfort report and a deload week still pull the tier down on
 * the day, with the reason on screen.
 */
export function defaultWorkoutDemand(trainingAge: TrainingAge): WorkoutDemandLevel {
  return trainingAge === "advanced" ? "elite-volume" : trainingAge === "intermediate" ? "high-output" : "precision";
}
