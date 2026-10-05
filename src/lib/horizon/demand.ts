/* ════════════════════════════════════════════════════════════════════════
   HORIZON-DERIVED NUTRITION + RECOVERY DEMAND

   Nutrition and Recovery must read the SAME active week the training
   surfaces read — the protocol title alone was never enough to describe what
   a given week actually costs.

   Both derivations account for the real drivers: resistance volume,
   conditioning volume and distance, session timing, the block phase, the
   body-composition direction, current body weight in context, and any
   activity the athlete has added.

   Demand CLASSES and explicit assumptions, never invented calorie numbers.
   No medical claims, no dosing, no supplement guidance.
   ════════════════════════════════════════════════════════════════════════ */

import type { AthleteContextSnapshot } from "@/lib/athlete/snapshot";
import { isConditioningDay } from "@/lib/training/protocol-dna";
import type { ProgramHorizon, ProjectedProgramWeek } from "./types";

export type DemandClass = "low" | "moderate" | "high" | "very-high";

export type WeekNutritionDemand = {
  weekNumber: number;
  phaseName: string;
  demandClass: DemandClass;
  /** One-line summary for the Nutrition surface header. */
  headline: string;
  /** Day-type guidance, driven by the week's real structure. */
  trainingDayPattern: string;
  recoveryDayPattern: string;
  /** Concrete, non-numeric cues tied to this week's actual sessions. */
  cues: string[];
  /** What Reserve could not compute without more data. */
  assumptions: string[];
};

export type WeekRecoveryDemand = {
  weekNumber: number;
  phaseName: string;
  demandClass: DemandClass;
  headline: string;
  /** Named fatigue drivers Reserve can actually see in this week. */
  localFatigue: string[];
  systemicFatigue: string[];
  /** Impact accumulation, lower-body interference, and stacked hard days. */
  loadWarnings: string[];
  /** Honest states when data is missing — never a fabricated score. */
  unknowns: string[];
};

export type DayNutritionDemand = {
  dayIndex: number;
  dayTitle: string;
  demandClass: DemandClass;
  reasons: string[];
  preTrainingSupport: string;
  postTrainingSupport: string;
  hydrationPriority: string;
  recoveryDayPosture: string;
  conditioningSupport: string;
  assumptions: string[];
};

export type DayRecoveryContext = {
  dayIndex: number;
  dayTitle: string;
  systemicDemand: DemandClass;
  localFatigueEmphasis: string[];
  lowerBodyInterference: string | null;
  impactAccumulation: string | null;
  nextHighDemandSession: string | null;
  nextRecoveryOpportunity: string | null;
  currentRecoveryPriority: string;
  sleepContext: string;
  painContext: string;
};

const CLASS_RANK: Record<DemandClass, number> = { low: 0, moderate: 1, high: 2, "very-high": 3 };
const RANK_CLASS: DemandClass[] = ["low", "moderate", "high", "very-high"];

function shift(base: DemandClass, by: number): DemandClass {
  return RANK_CLASS[Math.max(0, Math.min(3, CLASS_RANK[base] + by))];
}

function baseClassFrom(text: string): DemandClass {
  const t = text.toLowerCase();
  if (t.startsWith("very-high") || t.includes("elevated above very-high")) return "very-high";
  if (t.includes("very-high")) return "very-high";
  if (t.includes("high")) return "high";
  if (t.includes("low")) return "low";
  return "moderate";
}

/* ─── Nutrition ───────────────────────────────────────────────────────── */

export function deriveWeekNutritionDemand(
  horizon: ProgramHorizon,
  week: ProjectedProgramWeek,
  snapshot: AthleteContextSnapshot,
): WeekNutritionDemand {
  const training = week.weeklyStructure.filter((d) => !d.recovery);
  const conditioning = training.filter(isConditioningDay);
  const outdoor = training.filter((d) => d.archetype === "outdoor-distance");
  const totalSets = Object.values(week.volumeTarget.setTargets).reduce((a, b) => a + b, 0);

  let demandClass = baseClassFrom(week.nutritionDemand);
  // The week's real content adjusts the class the protocol declared.
  if (conditioning.length >= 3 || outdoor.length >= 2) demandClass = shift(demandClass, 1);
  if (training.length <= 3 && conditioning.length === 0) demandClass = shift(demandClass, -1);
  if (week.status === "deload") demandClass = shift(demandClass, -1);

  const cues: string[] = [];
  const assumptions: string[] = [];

  cues.push(
    `${training.length} training day${training.length === 1 ? "" : "s"} and about ${totalSets} working sets this week — that is the resistance load the fuel has to cover.`,
  );

  if (conditioning.length > 0 && week.conditioningTarget) {
    cues.push(
      `${conditioning.length} conditioning exposure${conditioning.length === 1 ? "" : "s"} at roughly ${week.conditioningTarget.duration} minutes each. Carbohydrate availability matters most around ${outdoor.length > 0 ? "the distance work" : "these sessions"}.`,
    );
  }

  const trainTime = snapshot.training.preferredTrainingTime;
  if (trainTime && /^0?[3-7]:/.test(trainTime)) {
    cues.push(
      `Your sessions start around ${trainTime}. Keep pre-session fuel light and easily digested, and move the fuller meal to after training.`,
    );
  }

  const addedEarly = training.some((d) => /class|run|conditioning/i.test(d.title));
  if (addedEarly && outdoor.length > 0) {
    cues.push("Long outdoor sessions carry a hydration and electrolyte requirement the gym days do not.");
  }

  // Body composition — read in context, never from the scale alone.
  const bf = snapshot.profile.bodyFatPercent;
  const weightKg = snapshot.profile.weightKg;
  if (snapshot.nutrition.weightTrend === "falling-fast") {
    cues.push("Your weight is falling quickly. Protein is the priority that protects the muscle this week's training is meant to keep.");
  }
  if (weightKg == null) {
    assumptions.push("Body weight is not logged, so Reserve is giving demand classes and timing rather than portion or calorie figures it would be inventing.");
  }
  if (bf == null) {
    assumptions.push("Body composition is not on file, so composition guidance follows the weight trend and your measurements instead of an estimate.");
  }
  if (snapshot.nutrition.calories == null) {
    assumptions.push("Calorie intake is not on file. Reserve will not prescribe a number it cannot verify — this stays a demand class and a timing pattern.");
  }

  const headline = `Week ${week.weekNumber} · ${week.phaseName} · ${demandClass.replace("-", " ")} fuel demand`;

  return {
    weekNumber: week.weekNumber,
    phaseName: week.phaseName,
    demandClass,
    headline,
    trainingDayPattern: week.nutritionDemand,
    recoveryDayPattern:
      week.status === "deload"
        ? "Protein holds; carbohydrate drops with the training demand."
        : "Protein constant; carbohydrate toward the lower end, hydration maintained.",
    cues,
    assumptions,
  };
}

/** Day-level fuel posture layered on the already-derived weekly demand. */
export function deriveDayNutritionDemand(
  horizon: ProgramHorizon,
  week: ProjectedProgramWeek,
  snapshot: AthleteContextSnapshot,
  dayIndex: number,
): DayNutritionDemand {
  const weekly = deriveWeekNutritionDemand(horizon, week, snapshot);
  const safeIndex = Math.max(0, Math.min(6, Math.round(dayIndex)));
  const day = week.weeklyStructure[safeIndex] ?? week.weeklyStructure[0];
  const signal = `${day.title} ${day.archetype} ${day.intent} ${day.emphasis.join(" ")}`.toLowerCase();
  const recovery = Boolean(day.recovery) || day.intent === "recovery" || day.intent === "mobility";
  const conditioning = isConditioningDay(day);
  const outdoor = day.archetype === "outdoor-distance";
  const lower = LOWER_TOKENS.test(signal);

  let demandClass: DemandClass = weekly.demandClass;
  if (recovery) demandClass = "low";
  else if (outdoor || /full-body|sport|sprint|explosive/.test(signal)) demandClass = shift(weekly.demandClass, 1);
  else if (!conditioning && !lower) demandClass = shift(weekly.demandClass, -1);

  const reasons = recovery
    ? [`${day.title} is a recovery exposure inside a ${weekly.demandClass.replace("-", " ")} weekly load.`]
    : [
        `${day.title} carries ${day.intent} intent with ${day.emphasis.length ? day.emphasis.join(", ") : "general"} emphasis.`,
        `${week.volumeTarget.relativeLoad}; effort target ${week.intensityTarget.effortRange}.`,
      ];
  if (conditioning && week.conditioningTarget) {
    reasons.push(
      `${week.conditioningTarget.type} contributes about ${week.conditioningTarget.duration ?? "an unlogged duration of"} minutes to the day.`,
    );
  }

  const trainingTime = snapshot.training.preferredTrainingTime;
  const assumptions: string[] = [];
  if (!trainingTime) assumptions.push("Training time is not on file, so meal support is described relative to the session rather than by clock time.");
  if (snapshot.profile.weightKg == null) assumptions.push("Body weight is not logged; no calorie or portion figure is inferred.");

  return {
    dayIndex: safeIndex,
    dayTitle: day.title,
    demandClass,
    reasons,
    preTrainingSupport: recovery
      ? "No training window is scheduled. Keep the normal meal rhythm rather than creating a performance meal for a session that is not happening."
      : trainingTime && /^0?[3-7]:/.test(trainingTime)
        ? "Early session: use a light, easily digested pre-training meal and place the fuller meal after training."
        : "Place a familiar protein-and-carbohydrate meal before the session without inventing a new daily calorie target.",
    postTrainingSupport: recovery
      ? "Protein stays consistent; overall fuel follows the reduced training demand."
      : lower || outdoor || conditioning
        ? "Prioritize the post-training meal because this session carries lower-body or conditioning demand."
        : "Return to the normal meal rhythm with protein anchored after training.",
    hydrationPriority: outdoor
      ? "High: outdoor distance adds duration and environmental exposure beyond the resistance work."
      : conditioning
        ? "Elevated: conditioning adds fluid demand to the training day."
        : recovery
          ? "Maintain the member's normal logged hydration target."
          : "Moderate: support the resistance session and the next training window.",
    recoveryDayPosture: recovery
      ? "Protein holds while carbohydrate follows the lower output demand; the overall nutrition phase does not change."
      : weekly.recoveryDayPattern,
    conditioningSupport: conditioning
      ? "Carbohydrate availability and hydration matter around this exposure; the weekly nutrition phase remains unchanged."
      : "No separate conditioning support is required for this day.",
    assumptions,
  };
}

/* ─── Recovery ────────────────────────────────────────────────────────── */

const LOWER_TOKENS = /quad|hamstring|glute|calf|calve|leg|lower|posterior|hip|adductor|abductor/i;
const UPPER_TOKENS = /chest|back|lat|delt|shoulder|arm|bicep|tricep|trap|upper|push|pull|press/i;

export function deriveWeekRecoveryDemand(
  horizon: ProgramHorizon,
  week: ProjectedProgramWeek,
  snapshot: AthleteContextSnapshot,
): WeekRecoveryDemand {
  const structure = week.weeklyStructure;
  const training = structure.filter((d) => !d.recovery);
  const conditioning = training.filter(isConditioningDay);
  const outdoor = training.filter((d) => d.archetype === "outdoor-distance");

  const localFatigue: string[] = [];
  const systemicFatigue: string[] = [];
  const loadWarnings: string[] = [];
  const unknowns: string[] = [];

  const lowerDays = training.filter((d) => LOWER_TOKENS.test([d.title, ...d.emphasis].join(" ")));
  const upperDays = training.filter((d) => UPPER_TOKENS.test([d.title, ...d.emphasis].join(" ")));

  if (lowerDays.length > 0) {
    localFatigue.push(`Lower body is loaded ${lowerDays.length} time${lowerDays.length === 1 ? "" : "s"} this week (${lowerDays.map((d) => d.title).join(", ")}).`);
  }
  if (upperDays.length > 0) {
    localFatigue.push(`Upper body is loaded ${upperDays.length} time${upperDays.length === 1 ? "" : "s"} this week.`);
  }

  let demandClass: DemandClass =
    training.length >= 6 ? "very-high" : training.length >= 5 ? "high" : training.length >= 4 ? "moderate" : "low";
  if (week.status === "deload") demandClass = shift(demandClass, -2);
  if (conditioning.length >= 3) demandClass = shift(demandClass, 1);

  systemicFatigue.push(
    `${training.length} training day${training.length === 1 ? "" : "s"} and ${structure.length - training.length} recovery day${structure.length - training.length === 1 ? "" : "s"} in this week.`,
  );
  if (week.status === "deload") {
    systemicFatigue.push("This is a planned deload — the week is designed to clear fatigue rather than hold output.");
  }

  /* ── Stacked hard days and inadequate recovery windows ── */
  for (let i = 0; i < structure.length - 1; i += 1) {
    const a = structure[i];
    const b = structure[i + 1];
    if (a.recovery || b.recovery) continue;
    const aLower = LOWER_TOKENS.test([a.title, ...a.emphasis].join(" "));
    const bLower = LOWER_TOKENS.test([b.title, ...b.emphasis].join(" "));
    if (aLower && bLower) {
      loadWarnings.push(`${a.title} and ${b.title} sit back to back — that is two lower-body exposures without a recovery day between them.`);
    }
  }

  /* ── Impact accumulation ── */
  if (outdoor.length > 0) {
    const impactTolerant = !/none|never|limited|little/i.test(snapshot.training.runningBackground ?? "none");
    loadWarnings.push(
      outdoor.length >= 2
        ? `${outdoor.length} distance exposures this week. Impact accumulates across them, not just within one.`
        : "One distance exposure this week. Watch joint response the day after.",
    );
    if (!impactTolerant) {
      loadWarnings.push("Your running history is limited or not on file, so distance work should progress on tolerance rather than on the calendar.");
    }
  }

  /* ── Lower-body interference ── */
  if (lowerDays.length >= 2 && outdoor.length >= 1) {
    loadWarnings.push("Lower-body lifting and distance work share the same recovery. Their spacing in this week is deliberate and should not be collapsed.");
  }

  /* ── Added activity from a revision ── */
  if (week.status === "revised") {
    loadWarnings.push(week.revisionReason ?? "This week has been adjusted, so its load differs from the original projection.");
  }

  /* ── Honest unknowns — no fabricated recovery score ── */
  if (snapshot.recovery.readinessScore == null) {
    unknowns.push("No readiness score is on file for this week. Reserve is not generating one — log readiness and it will start gating volume decisions.");
  }
  if (snapshot.recovery.averageSleepHours == null) {
    unknowns.push("Sleep duration is not on file, so recovery guidance here is based on the training load alone.");
  }
  if (snapshot.recovery.hrv == null && snapshot.recovery.restingHeartRate == null) {
    unknowns.push("No resting heart rate or HRV data is connected.");
  }

  const headline = `Week ${week.weekNumber} · ${week.phaseName} · ${demandClass.replace("-", " ")} recovery demand`;

  return {
    weekNumber: week.weekNumber,
    phaseName: week.phaseName,
    demandClass,
    headline,
    localFatigue,
    systemicFatigue,
    loadWarnings,
    unknowns,
  };
}

function nextIndex(
  week: ProjectedProgramWeek,
  from: number,
  predicate: (day: ProjectedProgramWeek["weeklyStructure"][number]) => boolean,
): number | null {
  for (let offset = 1; offset <= week.weeklyStructure.length; offset += 1) {
    const index = (from + offset) % week.weeklyStructure.length;
    if (predicate(week.weeklyStructure[index])) return index;
  }
  return null;
}

/** Recovery context for the active day without manufacturing health metrics. */
export function deriveDayRecoveryContext(
  horizon: ProgramHorizon,
  week: ProjectedProgramWeek,
  snapshot: AthleteContextSnapshot,
  dayIndex: number,
): DayRecoveryContext {
  const weekly = deriveWeekRecoveryDemand(horizon, week, snapshot);
  const safeIndex = Math.max(0, Math.min(6, Math.round(dayIndex)));
  const day = week.weeklyStructure[safeIndex] ?? week.weeklyStructure[0];
  const signal = `${day.title} ${day.archetype} ${day.emphasis.join(" ")}`;
  const lower = LOWER_TOKENS.test(signal);
  const impact = day.archetype === "outdoor-distance" || /run|sprint|sport/i.test(signal);
  const highIndex = nextIndex(
    week,
    safeIndex,
    (candidate) => !candidate.recovery && candidate.priority <= 2,
  );
  const recoveryIndex = nextIndex(
    week,
    safeIndex,
    (candidate) => Boolean(candidate.recovery) || candidate.intent === "recovery" || candidate.intent === "mobility",
  );
  const pain = snapshot.recovery.currentPain ?? [];

  return {
    dayIndex: safeIndex,
    dayTitle: day.title,
    systemicDemand: weekly.demandClass,
    localFatigueEmphasis: day.recovery
      ? ["No local training emphasis is scheduled today."]
      : day.emphasis.length
        ? [...day.emphasis]
        : ["General training demand"],
    lowerBodyInterference: lower && weekly.loadWarnings.some((warning) => /lower-body|lower body/i.test(warning))
      ? "This lower-body exposure shares recovery with other lower-body or distance work in the active week."
      : null,
    impactAccumulation: impact
      ? weekly.loadWarnings.find((warning) => /impact|distance/i.test(warning)) ?? "This exposure adds impact to the active week's recovery demand."
      : null,
    nextHighDemandSession: highIndex == null ? null : week.weeklyStructure[highIndex].title,
    nextRecoveryOpportunity: recoveryIndex == null ? null : week.weeklyStructure[recoveryIndex].title,
    currentRecoveryPriority: day.recovery
      ? "Use the planned recovery opportunity and preserve the next high-demand session."
      : week.recoveryTarget[0] ?? "Protect the spacing already built into the active week.",
    sleepContext: snapshot.recovery.averageSleepHours == null
      ? "Sleep duration is not logged. Reserve is not estimating it."
      : `The athlete snapshot records an average of ${snapshot.recovery.averageSleepHours} hours of sleep; review it beside the active week's demand.`,
    painContext: pain.length === 0
      ? "No athlete-reported pain record is attached to this Horizon snapshot."
      : `Athlete-reported pain is logged for ${pain.map((record) => record.region).join(", ")}. Keep it visible during session review; Reserve does not diagnose it.`,
  };
}
