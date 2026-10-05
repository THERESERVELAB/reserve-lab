/* ════════════════════════════════════════════════════════════════════════
   PERSONALIZED PROTOCOL EXPLANATION

   Turns the athlete snapshot, the derived programming profile, and the
   protocol's DNA into an explanation written about THIS athlete.

   The contract:
     • Every sentence traces to a real snapshot field or a stated assumption.
     • Nothing is invented. Missing data becomes "Reserve does not know X yet",
       never a plausible-sounding number.
     • No guarantees, no medical claims, no diagnosis.
     • It must not read like a generic fitness article — if a sentence would
       be true for any athlete, it does not belong here.
   ════════════════════════════════════════════════════════════════════════ */

import {
  readGoalSignals,
  type AthleteProgrammingProfile,
} from "@/lib/athlete/programming-profile";
import {
  weightTrendLabel,
  type AthleteContextSnapshot,
  type SnapshotConfidence,
} from "@/lib/athlete/snapshot";
import { FAMILY_LABEL, isConditioningDay, type ProtocolDNA } from "./protocol-dna";
import type { ProtocolSuitability } from "./protocol-suitability";

export type PersonalizedProtocolExplanation = {
  headline: string;
  summary: string;

  athleteContext: string[];
  whyThisProtocol: string[];
  whatThisSplitDoes: string[];
  weeklyLogic: string[];
  bodyCompositionStrategy: string[];
  recoveryStrategy: string[];
  nutritionStrategy: string[];
  whatReserveWillMonitor: string[];
  changeConditions: string[];

  confidence: SnapshotConfidence;
  assumptions: string[];
};

const NUM_WORD = ["zero", "one", "two", "three", "four", "five", "six", "seven"];

function numWord(n: number): string {
  return NUM_WORD[n] ?? String(n);
}

/** "a" / "an" — the experience bands include "intermediate" and "advanced". */
function article(word: string): string {
  return /^[aeiou]/i.test(word) ? "an" : "a";
}

/** Sentence describing the frequency in athlete terms. */
function frequencySentence(suitability: ProtocolSuitability, snapshot: AthleteContextSnapshot): string {
  const freq = suitability.recommendedFrequency;
  const available = snapshot.training.availableDays;
  const duration = snapshot.training.sessionDurationMinutes;

  if (freq < available) {
    return `You told Reserve you have ${numWord(available)} days available, and the plan uses ${numWord(freq)} of them. The remaining day is left open deliberately — at your current recovery capacity, the ${numWord(freq)}th session would cost more than it returns.`;
  }
  if (freq === available) {
    return `The plan uses all ${numWord(available)} of the days you said you have${duration ? `, at about ${duration} minutes each` : ""}. Nothing is scheduled that you have not told Reserve you can actually reach.`;
  }
  return `This architecture wants ${numWord(freq)} days and you have ${numWord(available)}. That gap is the main compromise in running it.`;
}

export function buildProtocolExplanation(
  dna: ProtocolDNA,
  suitability: ProtocolSuitability,
  snapshot: AthleteContextSnapshot,
  profile: AthleteProgrammingProfile,
  opts: { protocolName?: string; athleteChoseManually?: boolean } = {},
): PersonalizedProtocolExplanation {
  const goals = readGoalSignals(snapshot);
  const name = opts.protocolName ?? dna.protocolId;
  const exp = snapshot.training.experienceLevel;
  const freq = suitability.recommendedFrequency;
  const week = dna.topology.canonicalWeek;
  const trainingDays = week.filter((d) => !d.recovery);
  const conditioningDays = trainingDays.filter(isConditioningDay);
  const twicePlus = Object.entries(dna.stimulus.muscleFrequency)
    .filter(([, n]) => n >= 2)
    .map(([m]) => m);

  /* ── Athlete context — only what Reserve actually knows ─────────────── */
  const athleteContext: string[] = [];
  const weightKg = snapshot.profile.weightKg;
  const heightCm = snapshot.profile.heightCm;
  const bf = snapshot.profile.bodyFatPercent;

  if (weightKg && heightCm && bf != null) {
    athleteContext.push(
      `You are ${Math.round(weightKg)} kg at ${Math.round(heightCm)} cm with an estimated ${bf}% body fat, which puts your lean mass near ${Math.round(snapshot.profile.estimatedLeanMassKg ?? 0)} kg.`,
    );
  } else if (weightKg && heightCm) {
    athleteContext.push(`You are ${Math.round(weightKg)} kg at ${Math.round(heightCm)} cm. Body composition has not been measured, so Reserve reads that weight alongside your training history rather than on its own.`);
  } else if (weightKg) {
    athleteContext.push(`You are ${Math.round(weightKg)} kg. Without a height or composition figure, Reserve reads that alongside your training history rather than drawing conclusions from it.`);
  } else {
    athleteContext.push("Body weight has not been logged yet, so nothing in this plan is driven by the scale.");
  }

  athleteContext.push(
    `You are training at ${article(exp)} ${exp} level${snapshot.training.trainingAgeYears != null ? ` with ${snapshot.training.trainingAgeYears} year${snapshot.training.trainingAgeYears === 1 ? "" : "s"} logged` : ""}, prioritising ${snapshot.objectives.primaryGoal.toLowerCase()}.`,
  );

  if (snapshot.recovery.averageSleepHours != null) {
    athleteContext.push(
      `You are averaging about ${snapshot.recovery.averageSleepHours} hours of sleep, which is what sets the ceiling on how many high-demand days this week can hold.`,
    );
  }
  if (snapshot.environment.recurringActivities.length > 0) {
    const titles = snapshot.environment.recurringActivities.map((a) => a.title).join(", ");
    athleteContext.push(`${titles} already sit${snapshot.environment.recurringActivities.length === 1 ? "s" : ""} in your week, and the plan is built around that rather than on top of it.`);
  }
  if (snapshot.nutrition.weightTrend !== "unknown") {
    athleteContext.push(
      `Your body weight is ${weightTrendLabel(snapshot.nutrition.weightTrend)}${snapshot.nutrition.weightTrendKgPerWeek != null ? ` at about ${Math.abs(snapshot.nutrition.weightTrendKgPerWeek)} kg per week` : ""}.`,
    );
  }

  /* ── Why this protocol ─────────────────────────────────────────────── */
  const whyThisProtocol: string[] = [];
  if (opts.athleteChoseManually) {
    whyThisProtocol.push(`You selected ${name} yourself. Reserve has kept your choice and adapted it to your profile rather than substituting a different protocol.`);
  }
  whyThisProtocol.push(...suitability.whyItFits);
  whyThisProtocol.push(frequencySentence(suitability, snapshot));

  // Why this topology and not the obvious alternatives.
  const topologyReason = topologyJustification(dna, snapshot, profile, freq);
  if (topologyReason) whyThisProtocol.push(topologyReason);

  if (suitability.classification === "conditional-fit" || suitability.classification === "poor-fit") {
    whyThisProtocol.push(
      `Reserve rates this a conditional fit rather than its first recommendation. ${suitability.compromises[0] ?? "The compromises are listed below."}`,
    );
  }

  /* ── What the split does ───────────────────────────────────────────── */
  const whatThisSplitDoes: string[] = [dna.identity.primaryObjective];
  if (twicePlus.length > 0) {
    whatThisSplitDoes.push(
      `Across the week, ${twicePlus.slice(0, 5).join(", ")} each get at least two exposures. That repeated exposure is where most of the development actually comes from.`,
    );
  }
  if (conditioningDays.length > 0) {
    whatThisSplitDoes.push(
      `${numWord(conditioningDays.length).replace(/^./, (c) => c.toUpperCase())} conditioning exposure${conditioningDays.length === 1 ? "" : "s"} sit${conditioningDays.length === 1 ? "s" : ""} in the week, placed so they add expenditure without stealing recovery from the lifting days.`,
    );
  } else {
    whatThisSplitDoes.push("There is no standalone conditioning day. Every session in this week is resistance work, because that is what the goal needs right now.");
  }
  whatThisSplitDoes.push(dna.stimulus.proximityToFailurePolicy);
  if (dna.stimulus.primaryLiftPolicy) whatThisSplitDoes.push(dna.stimulus.primaryLiftPolicy);

  /* ── Weekly logic ──────────────────────────────────────────────────── */
  const weeklyLogic: string[] = [
    ...dna.topology.schedulingPriorities.map((s) => `${s}.`),
  ];
  if (freq < trainingDays.length) {
    weeklyLogic.push(
      `Running at ${numWord(freq)} days rather than the authored ${numWord(trainingDays.length)}: ${dna.topology.compressionRules[0] ?? "the lowest-priority days become recovery."}`,
    );
  }
  if (dna.fatigue.lowerBodyInterference === "high") {
    weeklyLogic.push("Lower-body work and conditioning are separated deliberately — stacking them is the most common way this architecture stops working.");
  }

  /* ── Body composition strategy ─────────────────────────────────────── */
  const bodyCompositionStrategy: string[] = [profile.bodyCompositionContext, dna.nutrition.bodyCompositionSupport];
  if (goals.fatLoss) {
    bodyCompositionStrategy.push(
      `Because fat loss is the priority, ${profile.muscleRetentionPriority === "critical" ? "muscle retention is treated as the constraint the whole plan is built around" : "muscle retention is protected through the resistance work rather than assumed"}. Strength retention is the honesty check on whether the rate is right.`,
    );
  } else if (goals.leanGain) {
    bodyCompositionStrategy.push("Because size is the priority, progress is judged on whether the surplus is showing up in the lifts — not only on the scale.");
  } else if (goals.recomp) {
    bodyCompositionStrategy.push("Because this is a recomposition, a stable scale is the expected outcome, not a failure. Progress is read from strength, measurements, and photographs together.");
  }
  if (snapshot.profile.bodyFatPercent == null) {
    bodyCompositionStrategy.push("Reserve does not have a body-fat figure for you, so composition is tracked through weight trend, measurements, and strength retention instead of an estimate it would have to invent.");
  }

  /* ── Recovery strategy ─────────────────────────────────────────────── */
  const recoveryStrategy: string[] = [
    `This architecture carries ${dna.fatigue.recoveryDemand} recovery demand. Your recovery capacity currently reads ${profile.recoveryCapacity}.`,
    dna.fatigue.localFatiguePattern,
  ];
  for (const c of profile.majorConstraints.slice(0, 3)) recoveryStrategy.push(c);
  if (dna.fatigue.impactDemand === "high" || dna.fatigue.impactDemand === "moderate") {
    recoveryStrategy.push(
      profile.impactTolerance === "very-low" || profile.impactTolerance === "low"
        ? "Impact work is introduced gradually and on a low-impact modality first, because your current impact tolerance does not support the authored version yet."
        : "Impact accumulation is tracked across the week so joint load does not quietly stack.",
    );
  }

  /* ── Nutrition strategy ────────────────────────────────────────────── */
  const nutritionStrategy: string[] = [
    `Nutrition demand for this architecture reads ${dna.nutrition.demandClass}.`,
    dna.nutrition.trainingDayPattern,
    dna.nutrition.recoveryDayPattern,
  ];
  if (dna.nutrition.conditioningSupport) nutritionStrategy.push(dna.nutrition.conditioningSupport);
  if (snapshot.training.preferredTrainingTime && /^0?[3-7]:/.test(snapshot.training.preferredTrainingTime)) {
    nutritionStrategy.push("Your sessions start early, so pre-session fuel is kept light and easily digested with the fuller meal moved to after training.");
  }
  if (snapshot.nutrition.calories == null) {
    nutritionStrategy.push("Reserve does not have your calorie intake on file, so this stays a demand class and a timing pattern rather than a number it would be guessing at.");
  }

  /* ── What Reserve will monitor ─────────────────────────────────────── */
  const whatReserveWillMonitor: string[] = [
    "Weekly body-weight trend, read as a trend and never as a single weigh-in.",
    "Strength retention on the primary movements — the clearest early signal that the plan is or is not working.",
    "Session quality and completion against what was planned.",
  ];
  if (snapshot.recovery.averageSleepHours != null || snapshot.recovery.readinessScore != null) {
    whatReserveWillMonitor.push("Sleep consistency and readiness, which gate every volume increase in this plan.");
  }
  if (conditioningDays.length > 0) whatReserveWillMonitor.push("How you recover from the conditioning work, including joint response.");
  if (dna.fatigue.impactDemand === "high") whatReserveWillMonitor.push("Impact accumulation across the week and any change in joint comfort.");
  whatReserveWillMonitor.push("Adherence — a plan you are completing 60% of is not the plan you are on.");

  /* ── Change conditions ─────────────────────────────────────────────── */
  const changeConditions: string[] = [
    ...dna.adaptation.bodyWeightTrendRules.slice(0, 2),
    ...dna.adaptation.performanceTrendRules.slice(0, 1),
    ...dna.adaptation.readinessRules.slice(0, 1),
    ...dna.adaptation.scheduleChangeRules.slice(0, 1),
  ];
  if (snapshot.environment.recurringActivities.length > 0) {
    changeConditions.push("A change to your recurring activities re-plans the future weeks around the new load. Completed weeks are never rewritten.");
  }

  /* ── Headline + summary ────────────────────────────────────────────── */
  const headline = `${name} · ${numWord(freq)} days · ${FAMILY_LABEL[dna.identity.family]}`;
  const summary = buildSummary(dna, suitability, snapshot, profile, freq, twicePlus, conditioningDays.length);

  return {
    headline,
    summary,
    athleteContext,
    whyThisProtocol,
    whatThisSplitDoes,
    weeklyLogic,
    bodyCompositionStrategy,
    recoveryStrategy,
    nutritionStrategy,
    whatReserveWillMonitor,
    changeConditions,
    confidence: profile.confidence,
    assumptions: profile.assumptions,
  };
}

/* ─── Why this topology and not the obvious alternative ───────────────── */

function topologyJustification(
  dna: ProtocolDNA,
  snapshot: AthleteContextSnapshot,
  profile: AthleteProgrammingProfile,
  freq: number,
): string | null {
  const exp = snapshot.training.experienceLevel;
  switch (dna.identity.family) {
    case "beginner":
      return "A full-body and upper/lower rotation was chosen over a split because at your training age the same pattern repeated three times a week produces more than six days of fragmented volume.";
    case "recovery-constrained":
      return `A spaced, low-systemic-cost structure was chosen over a conventional split because your recovery capacity reads ${profile.recoveryCapacity} — the limiting factor is not motivation or availability.`;
    case "strength":
      return "A one-primary-lift-per-session structure was chosen over push/pull/legs because strength is a skill: fewer lifts practised more specifically is what moves the number.";
    case "powerbuilding":
      return "Each primary pattern gets its own day rather than being grouped by body region, so the accessories can be chosen to support that specific lift rather than just adding volume.";
    case "grand-touring":
      return `A hybrid rotation was chosen over a pure physique split because ${snapshot.objectives.secondaryGoals.length ? "your secondary objectives include capacity work" : "your goal includes both muscular development and distance capacity"}. The lifting days stay the priority and the distance work is placed where it does not compromise them.`;
    case "endurance-physique":
      return "Endurance sessions lead the week rather than sit around the lifting, because when endurance is the primary goal the aerobic work has to get the fresh legs.";
    case "fat-loss":
      return `Resistance training leads and conditioning supports, rather than the reverse. At ${exp} level in a deficit, the resistance work is what keeps the muscle you already built — conditioning only adds expenditure.`;
    case "weak-point-specialization":
      return "The base architecture stays a credible upper/lower week with two priority exposures layered on. Renaming every day after the weak point would cost the rest of the physique for nothing.";
    case "contest-preparation":
      return "Volume peaks early while fuel is highest, then descends by design as recovery capacity falls with calories. That descent is the plan, not a failure of it.";
    case "tactical-hybrid":
      return "Carries, repeated-effort work, and loaded distance replace conventional bodybuilding volume because the goal is output that repeats tomorrow, not a single peak today.";
    case "home-gym":
      return "Progression runs on reps, tempo, range, and density rather than load, because with your equipment load has a ceiling and those four do not.";
    case "balanced-hypertrophy":
      return freq >= 5
        ? "Every region gets two exposures across the week rather than one high-volume day each, because spreading the same volume across two sessions is more of it you can actually recover from."
        : "A composite upper/lower structure was chosen so that at this frequency every region still gets touched twice a week.";
    default:
      return null;
  }
}

/* ─── The summary paragraph ───────────────────────────────────────────── */

function buildSummary(
  dna: ProtocolDNA,
  suitability: ProtocolSuitability,
  snapshot: AthleteContextSnapshot,
  profile: AthleteProgrammingProfile,
  freq: number,
  twicePlus: string[],
  conditioningCount: number,
): string {
  const goals = readGoalSignals(snapshot);
  const exp = snapshot.training.experienceLevel;
  const parts: string[] = [];

  // Sentence 1 — who the athlete is, in their own data.
  const compositionClause = snapshot.profile.weightKg
    ? snapshot.profile.bodyFatPercent != null
      ? `at ${Math.round(snapshot.profile.weightKg)} kg and roughly ${snapshot.profile.bodyFatPercent}% body fat`
      : `at ${Math.round(snapshot.profile.weightKg)} kg`
    : "with body weight not yet logged";
  parts.push(
    `You are training at ${exp} level ${compositionClause}, currently prioritising ${snapshot.objectives.primaryGoal.toLowerCase()}.`,
  );

  // Sentence 2 — the capacity constraint that actually set the frequency.
  const constraint =
    profile.recoveryCapacity === "very-low" || profile.recoveryCapacity === "low"
      ? `your current recovery capacity does not support more than ${numWord(freq)} demanding days`
      : snapshot.training.availableDays <= freq
        ? `your schedule supports ${numWord(snapshot.training.availableDays)} sessions`
        : `${numWord(freq)} sessions is what your recovery supports out of the ${numWord(snapshot.training.availableDays)} you have available`;
  parts.push(`Your schedule and recovery together mean ${constraint}.`);

  // Sentence 3 — what the structure does about it.
  const exposureClause = twicePlus.length
    ? `gives ${twicePlus.slice(0, 4).join(", ")} two exposures each`
    : "covers every region once at a frequency you can recover from";
  const conditioningClause = conditioningCount > 0
    ? ` while leaving recovery space for ${numWord(conditioningCount)} conditioning session${conditioningCount === 1 ? "" : "s"}`
    : " with no conditioning competing for that recovery";
  parts.push(`The ${dna.topology.blueprintName.toLowerCase()} ${exposureClause}${conditioningClause}.`);

  // Sentence 4 — the intent, in outcome terms. Hybrid is checked before
  // endurance: an athlete asking for both should not be told the plan is
  // about only one of them.
  parts.push(
    goals.hybrid
      ? "This is intended to develop both halves at once — muscular development and distance capacity — without either one paying for the other."
      : goals.fatLoss
        ? "This is intended to reduce body fat while preserving strength and lean tissue."
        : goals.leanGain
          ? "This is intended to add size while keeping fat gain controlled."
          : goals.strength
            ? "This is intended to move the primary lifts measurably while keeping the muscle around them."
            : goals.endurance
              ? "This is intended to progress endurance capacity without spending the physique to get it."
              : `This is intended to ${dna.identity.primaryObjective.toLowerCase().replace(/\.$/, "")}.`,
  );

  // Sentence 5 — what would change it.
  parts.push(
    `Reserve will monitor your weekly weight trend, strength retention, sleep, ${conditioningCount > 0 ? "joint response, " : ""}and adherence before ${goals.fatLoss ? "increasing conditioning or reducing training volume" : "increasing volume or intensity"}.`,
  );

  return parts.join(" ");
}
