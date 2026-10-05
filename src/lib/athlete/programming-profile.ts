/* ════════════════════════════════════════════════════════════════════════
   ATHLETE PROGRAMMING PROFILE — deterministic athlete analysis.

   Turns the raw AthleteContextSnapshot into the structured programming
   judgements the suitability engine and horizon generator reason on:
   capacity, tolerance, priorities, conflicts, and a defensible frequency
   range.

   This is a DETERMINISTIC layer, not free-form AI text. Every judgement is
   traceable to snapshot fields, and every judgement made without data is
   recorded as an assumption.

   Hard rules honoured here:
     • Body weight alone never decides anything. It is always interpreted
       with height, composition, training age, goal, and conditioning history.
     • BMI may be computed as context; it is never the decision engine.
     • No diagnosis, no medical inference, no assumptions from sex or age
       beyond capacity arithmetic the athlete can see and override.
   ════════════════════════════════════════════════════════════════════════ */

import {
  bmi,
  weightTrendLabel,
  type AthleteContextSnapshot,
  type SnapshotConfidence,
} from "./snapshot";

export type CapacityBand = "very-low" | "low" | "moderate" | "high" | "very-high";
export type PriorityBand = "low" | "moderate" | "high" | "critical";

export type AthleteProgrammingProfile = {
  bodyCompositionContext: string;
  trainingCapacity: CapacityBand;
  recoveryCapacity: CapacityBand;
  scheduleCapacity: CapacityBand;
  impactTolerance: CapacityBand;
  conditioningTolerance: CapacityBand;
  volumeTolerance: CapacityBand;
  complexityTolerance: CapacityBand;

  goalConflicts: string[];
  majorConstraints: string[];
  majorOpportunities: string[];

  preferredFrequencyRange: [number, number];
  recommendedSessionDurationRange?: [number, number];

  muscleRetentionPriority: PriorityBand;
  strengthPriority: PriorityBand;
  hypertrophyPriority: PriorityBand;
  conditioningPriority: PriorityBand;
  recoveryPriority: PriorityBand;

  assumptions: string[];
  confidence: SnapshotConfidence;
};

/* ─── Small helpers ───────────────────────────────────────────────────── */

const BAND_ORDER: CapacityBand[] = ["very-low", "low", "moderate", "high", "very-high"];

function band(score: number): CapacityBand {
  if (score <= -2) return "very-low";
  if (score <= -1) return "low";
  if (score >= 3) return "very-high";
  if (score >= 1) return "high";
  return "moderate";
}

function clampBand(b: CapacityBand, min: CapacityBand, max: CapacityBand): CapacityBand {
  const i = BAND_ORDER.indexOf(b);
  const lo = BAND_ORDER.indexOf(min);
  const hi = BAND_ORDER.indexOf(max);
  return BAND_ORDER[Math.min(hi, Math.max(lo, i))];
}

export function bandRank(b: CapacityBand): number {
  return BAND_ORDER.indexOf(b);
}

/* A phrase like "keeping strength" or "without losing muscle" states a
   RETENTION constraint, not a training objective. Matching it as an objective
   routes a fat-loss athlete to a strength protocol, which is the opposite of
   what they asked for. */
const RETENTION_QUALIFIER = /(keep|keeping|retain|retaining|preserv\w*|hold|holding|maintain\w*|without losing|not lose|no loss of)\s+(my\s+)?(the\s+)?\w*\s*(strength|muscle|mass|size|lean)/i;

/** Strip retention clauses so they cannot read as objectives. */
function objectiveText(raw: string): string {
  return raw.replace(new RegExp(RETENTION_QUALIFIER.source, "gi"), " ");
}

const GOAL_PATTERNS = {
  /* Verb phrasings matter as much as nouns. "Get stronger" and "Lose fat" are
     among the most common ways a member states a goal, and matching only the
     nouns ("strength", "fat loss") left those athletes with NO goal signal at
     all — the recommendation then fell through to constraint-driven defaults. */
  fatLoss: /fat[\s-]?loss|cut|shred|lean out|los(e|ing) (weight|fat|body ?fat)|drop (weight|fat)|leaner|tighten/i,
  leanGain: /lean[\s-]?(bulk|gain|mass)|gain (size|muscle|mass)|bulk|build (muscle|size)|add (muscle|size|mass)|size/i,
  strength: /strength|stronger|powerlift|1rm|max(imal)? (lift|strength)|squat|bench|deadlift/i,
  endurance: /endurance|marathon|half|10k|5k|distance|running|triathlon|cycling/i,
  hybrid: /hybrid|both .*(and|plus)|physique and (distance|endurance|conditioning)|run and lift/i,
  physique: /physique|classic|proportion|symmetry|shape|aesthetic|sculpt/i,
  contest: /contest|stage|compet|show prep|peak week|prep/i,
  recomp: /recomp|body composition|reshape/i,
  performance: /performance|athletic|sport|tactical|power|speed|explosive/i,
  general: /general|health|consistency|routine|habit|foundation|start|get in shape|in shape/i,
};

export type GoalSignals = {
  fatLoss: boolean;
  leanGain: boolean;
  strength: boolean;
  endurance: boolean;
  hybrid: boolean;
  physique: boolean;
  contest: boolean;
  recomp: boolean;
  performance: boolean;
  general: boolean;
};

export function readGoalSignals(snapshot: AthleteContextSnapshot): GoalSignals {
  const strengths = goalSignalStrength(snapshot);
  const out = {} as GoalSignals;
  for (const key of Object.keys(GOAL_PATTERNS) as GoalKey[]) {
    out[key] = strengths[key] > 0;
  }
  return out;
}

type GoalKey = keyof GoalSignals;

/** Weight applied to a signal depending on where it came from. */
const SIGNAL_WEIGHT = { primary: 1, secondary: 0.6, phase: 0.45 } as const;

/**
 * How strongly each goal signal is present, weighted by its SOURCE.
 *
 * The athlete's stated primary goal outranks everything. Secondary goals count
 * for less, and the active nutrition phase is supporting context rather than a
 * co-equal objective — without this, an athlete whose goal is "classic
 * physique" while eating in a lean-gain phase gets recommended a bulk protocol
 * because the phase scored as loudly as the goal they actually typed.
 */
export function goalSignalStrength(snapshot: AthleteContextSnapshot): Record<GoalKey, number> {
  // Retention clauses are stripped so "fat loss while keeping strength" reads
  // as a fat-loss objective rather than a strength one.
  const primary = objectiveText(snapshot.objectives.primaryGoal);
  const secondary = objectiveText(snapshot.objectives.secondaryGoals.join(" "));
  const phase = snapshot.nutrition.phase.toLowerCase();

  const out = {} as Record<GoalKey, number>;
  for (const [key, re] of Object.entries(GOAL_PATTERNS) as Array<[GoalKey, RegExp]>) {
    let strength = 0;
    if (re.test(primary)) strength = Math.max(strength, SIGNAL_WEIGHT.primary);
    if (secondary && re.test(secondary)) strength = Math.max(strength, SIGNAL_WEIGHT.secondary);
    out[key] = strength;
  }

  const fromPhase = (key: GoalKey) => { out[key] = Math.max(out[key], SIGNAL_WEIGHT.phase); };
  if (/cut|deficit|shred|fat/.test(phase)) fromPhase("fatLoss");
  if (/surplus|bulk|gain/.test(phase)) fromPhase("leanGain");
  if (/recomp/.test(phase)) fromPhase("recomp");

  return out;
}

/* ─── Body-composition context ────────────────────────────────────────── */

/**
 * Interpret body weight in context. A 220 lb athlete at 32% body fat, a
 * 220 lb muscular athlete, and a 220 lb strength athlete are three different
 * programming cases — so weight is never read on its own.
 */
export function describeBodyComposition(snapshot: AthleteContextSnapshot): string {
  const { weightKg, heightCm, bodyFatPercent, estimatedLeanMassKg } = snapshot.profile;
  const exp = snapshot.training.experienceLevel;

  if (!weightKg) {
    return "Body weight has not been logged, so Reserve is programming from goal, training age, schedule, and recovery only.";
  }

  const bodyMassIndex = bmi(weightKg, heightCm);
  const parts: string[] = [];

  if (bodyFatPercent != null && estimatedLeanMassKg != null) {
    parts.push(
      `At ${Math.round(weightKg)} kg and roughly ${bodyFatPercent}% body fat, the estimated lean mass is about ${Math.round(estimatedLeanMassKg)} kg`,
    );
    if (bodyFatPercent >= 25) {
      parts.push("which points to composition change rather than added training load as the main lever");
    } else if (bodyFatPercent <= 12) {
      parts.push("which is already lean, so muscle and strength retention outrank further deficit aggression");
    } else {
      parts.push("which supports either a controlled gain or a controlled deficit depending on the stated goal");
    }
  } else if (heightCm) {
    parts.push(
      `At ${Math.round(weightKg)} kg and ${Math.round(heightCm)} cm${bodyMassIndex ? ` (BMI ${bodyMassIndex}, context only)` : ""}, body composition has not been measured`,
    );
    parts.push(`so Reserve reads this alongside a ${exp} training history rather than treating the scale as the whole picture`);
  } else {
    parts.push(`At ${Math.round(weightKg)} kg with no height on file, Reserve reads weight alongside training age and goal rather than in isolation`);
  }

  return `${parts.join(", ")}.`;
}

/* ─── The derivation ──────────────────────────────────────────────────── */

export function deriveProgrammingProfile(snapshot: AthleteContextSnapshot): AthleteProgrammingProfile {
  const goals = readGoalSignals(snapshot);
  const assumptions = [...snapshot.evidence.assumptions];
  const constraints: string[] = [];
  const opportunities: string[] = [];
  const conflicts: string[] = [];

  const exp = snapshot.training.experienceLevel;
  const expScore = exp === "beginner" ? -2 : exp === "novice" ? -1 : exp === "intermediate" ? 0 : exp === "advanced" ? 1 : 2;

  const sleep = snapshot.recovery.averageSleepHours;
  const pain = snapshot.recovery.currentPain ?? [];
  const lifestyle = (snapshot.recovery.lifestyleDemand ?? "").toLowerCase();
  const days = snapshot.training.availableDays;
  const duration = snapshot.training.sessionDurationMinutes;

  /* ── Recovery capacity ───────────────────────────────────────────────── */
  let recoveryScore = snapshot.recovery.recoveryCapacity === "high" ? 1 : snapshot.recovery.recoveryCapacity === "low" ? -1 : 0;
  if (sleep != null) {
    if (sleep < 5.5) { recoveryScore -= 2; constraints.push(`Sleep is averaging about ${sleep} hours — the plan is built to stay recoverable at that level rather than assume you will sleep more.`); }
    else if (sleep < 6.5) { recoveryScore -= 1; constraints.push(`Sleep is averaging about ${sleep} hours, which caps how much high-demand work the week can hold.`); }
    else if (sleep >= 7.5) { recoveryScore += 1; opportunities.push(`Sleep is averaging about ${sleep} hours, which supports a higher weekly training load.`); }
  }
  if (lifestyle.includes("physical")) { recoveryScore -= 1; constraints.push("A physically demanding job already spends recovery before training starts."); }
  else if (lifestyle.includes("sedentary")) { recoveryScore += 1; opportunities.push("A desk-based day leaves recovery headroom for training volume."); }
  if (snapshot.recovery.readinessScore != null && snapshot.recovery.readinessScore < 55) {
    recoveryScore -= 1;
    constraints.push("Current readiness is running low — the opening weeks are deliberately conservative.");
  }
  if (pain.length > 0) {
    recoveryScore -= 1;
    constraints.push(`Reported discomfort in ${pain.map((p) => p.region).join(", ")} is recorded and routed around in exercise selection. Reserve does not assess or treat it — review anything persistent with a clinician.`);
  }
  const recoveryCapacity = band(recoveryScore);

  /* ── Schedule capacity ───────────────────────────────────────────────── */
  const activityLoad = snapshot.environment.recurringActivities.length;
  let scheduleScore = days >= 6 ? 2 : days >= 5 ? 1 : days >= 4 ? 0 : days >= 3 ? -1 : -2;
  if (duration != null) {
    if (duration < 40) { scheduleScore -= 1; constraints.push(`Sessions are capped near ${duration} minutes, so the week is built from shorter, denser sessions.`); }
    else if (duration >= 75) { scheduleScore += 1; opportunities.push(`Sessions can run to about ${duration} minutes, which supports fuller sessions at lower frequency.`); }
  }
  if (activityLoad >= 2) {
    scheduleScore -= 1;
    constraints.push(`${activityLoad} recurring outside activities already occupy the week — Reserve plans around them rather than on top of them.`);
  }
  const scheduleCapacity = band(scheduleScore);

  /* ── Impact + conditioning tolerance ─────────────────────────────────── */
  const running = (snapshot.training.runningBackground ?? "").toLowerCase();
  const conditioningBg = (snapshot.training.conditioningBackground ?? "").toLowerCase();
  const hasRunningHistory = /regular|experienced|year|marathon|10k|5k|weekly|consistent/.test(running);
  const noRunningHistory = /none|never|new|limited|little|beginner/.test(running) || !running;
  const bf = snapshot.profile.bodyFatPercent;
  const weightKg = snapshot.profile.weightKg;
  const heightCm = snapshot.profile.heightCm;
  const bodyMassIndex = bmi(weightKg, heightCm);

  let impactScore = 0;
  if (hasRunningHistory) { impactScore += 2; opportunities.push("An established running background supports real outdoor distance work from the first block."); }
  if (noRunningHistory && running) impactScore -= 1;
  // Higher mass raises joint cost per impact stride. This is a load argument,
  // not a judgement about the athlete — and it never fires on weight alone.
  if (bodyMassIndex != null && bodyMassIndex >= 30 && !hasRunningHistory) {
    impactScore -= 2;
    constraints.push("Combined body mass and limited running history mean impact conditioning is introduced gradually — low-impact modalities carry the early expenditure instead.");
  } else if (bodyMassIndex != null && bodyMassIndex >= 27 && !hasRunningHistory) {
    impactScore -= 1;
  }
  if (pain.some((p) => /knee|ankle|shin|hip|foot|achilles|calf/i.test(p.region))) {
    impactScore -= 2;
    constraints.push("Reported lower-limb discomfort keeps impact conditioning conservative until it settles.");
  }
  const impactTolerance = clampBand(band(impactScore), "very-low", "very-high");

  let conditioningScore = impactScore * 0.5;
  if (/regular|athlete|sport|high|good/.test(conditioningBg)) conditioningScore += 1;
  if (goals.endurance || goals.performance) conditioningScore += 1;
  if (recoveryCapacity === "very-low" || recoveryCapacity === "low") conditioningScore -= 1;
  const conditioningTolerance = band(Math.round(conditioningScore));

  /* ── Volume + complexity tolerance ───────────────────────────────────── */
  let volumeScore = expScore + bandRank(recoveryCapacity) - 2;
  if (goals.fatLoss && snapshot.nutrition.weightTrend === "falling-fast") {
    volumeScore -= 1;
    conflicts.push("Weight is falling quickly, which reduces how much training volume can be recovered from — volume is held, not raised.");
  }
  if (days <= 3) volumeScore -= 1;
  const volumeTolerance = band(volumeScore);

  const complexityTolerance = band(expScore + (duration != null && duration >= 60 ? 1 : 0));

  /* ── Training capacity — the composite ───────────────────────────────── */
  const trainingCapacity = band(
    Math.round((bandRank(recoveryCapacity) + bandRank(scheduleCapacity) + bandRank(volumeTolerance) - 6) / 1.5),
  );

  /* ── Frequency range — bounded by availability, never above it ───────── */
  let freqMin = Math.max(2, Math.min(days, 3));
  let freqMax = days;
  if (recoveryCapacity === "very-low") freqMax = Math.min(freqMax, 4);
  else if (recoveryCapacity === "low") freqMax = Math.min(freqMax, 5);
  if (exp === "beginner") { freqMax = Math.min(freqMax, 4); freqMin = Math.min(freqMin, 3); }
  else if (exp === "novice") freqMax = Math.min(freqMax, 5);
  if (activityLoad >= 2) freqMax = Math.max(freqMin, freqMax - 1);
  if (freqMax < freqMin) freqMax = freqMin;

  const sessionRange: [number, number] | undefined =
    duration != null ? [Math.max(25, duration - 15), duration] : undefined;

  /* ── Priorities ──────────────────────────────────────────────────────── */
  const inDeficit = goals.fatLoss || /cut|deficit/.test(snapshot.nutrition.phase.toLowerCase());
  const muscleRetentionPriority: PriorityBand =
    inDeficit && (bf != null && bf <= 15 ? true : exp === "advanced" || exp === "elite") ? "critical"
      : inDeficit ? "high"
        : goals.recomp ? "high"
          : "moderate";

  const strengthPriority: PriorityBand =
    goals.strength ? "critical" : goals.performance ? "high" : goals.physique || goals.leanGain ? "moderate" : "low";

  const hypertrophyPriority: PriorityBand =
    goals.physique || goals.leanGain || goals.contest ? "critical"
      : goals.recomp || inDeficit ? "high"
        : goals.strength ? "moderate"
          : "moderate";

  const conditioningPriority: PriorityBand =
    goals.endurance ? "critical"
      : inDeficit || goals.performance ? "high"
        : goals.leanGain ? "low"
          : "moderate";

  const recoveryPriority: PriorityBand =
    recoveryCapacity === "very-low" ? "critical"
      : recoveryCapacity === "low" || pain.length > 0 ? "high"
        : "moderate";

  /* ── Goal conflicts ──────────────────────────────────────────────────── */
  if (goals.fatLoss && goals.leanGain) {
    conflicts.push("Fat loss and size gain are both listed. Reserve is treating this as a recomposition case and will judge progress on strength retention and measurements, not the scale alone.");
  }
  if (goals.endurance && goals.leanGain) {
    conflicts.push("Endurance progression and maximum size gain compete for the same recovery. The plan protects resistance quality first and progresses distance in controlled steps.");
  }
  if (goals.contest && (exp === "beginner" || exp === "novice")) {
    conflicts.push("Contest-style preparation was requested at an early training age. Reserve will build the base first — that is the faster route to the same look.");
  }
  if (goals.strength && inDeficit) {
    conflicts.push("Maximal strength progress and an active deficit pull against each other. Primary-lift exposure is protected and accessory volume absorbs the reduction.");
  }
  if (sleep != null && sleep < 6 && days >= 6) {
    conflicts.push(`Six or more training days were requested on about ${sleep} hours of sleep. Reserve is capping the recommended frequency until sleep improves.`);
  }

  /* ── Opportunities ───────────────────────────────────────────────────── */
  if (snapshot.training.weakPoints?.length) {
    opportunities.push(`Declared priority areas (${snapshot.training.weakPoints.join(", ")}) give the week a clear specialization target.`);
  }
  if (snapshot.nutrition.weightTrend !== "unknown") {
    opportunities.push(`Body weight is ${weightTrendLabel(snapshot.nutrition.weightTrend)}, so Reserve can adjust on real trend data rather than guesswork.`);
  }
  if (snapshot.training.strengthMarkers && Object.keys(snapshot.training.strengthMarkers).length > 0) {
    opportunities.push("Logged strength markers allow progression to be judged on performance, not on feel.");
  }

  /* ── Assumptions for anything we had to default ──────────────────────── */
  if (snapshot.profile.bodyFatPercent == null && (goals.fatLoss || goals.recomp)) {
    assumptions.push("Without a body-fat estimate, composition targets are tracked through weight trend, measurements, and strength retention instead.");
  }
  if (!snapshot.training.runningBackground && (goals.endurance || goals.performance)) {
    assumptions.push("Running history was not provided — conditioning starts at a conservative, low-impact entry point and progresses on tolerance.");
  }

  return {
    bodyCompositionContext: describeBodyComposition(snapshot),
    trainingCapacity,
    recoveryCapacity,
    scheduleCapacity,
    impactTolerance,
    conditioningTolerance,
    volumeTolerance,
    complexityTolerance,
    goalConflicts: conflicts,
    majorConstraints: constraints,
    majorOpportunities: opportunities,
    preferredFrequencyRange: [freqMin, freqMax],
    recommendedSessionDurationRange: sessionRange,
    muscleRetentionPriority,
    strengthPriority,
    hypertrophyPriority,
    conditioningPriority,
    recoveryPriority,
    assumptions,
    confidence: snapshot.evidence.confidence,
  };
}
