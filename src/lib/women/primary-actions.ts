/* ════════════════════════════════════════════════════════════════════════
   RESERVE WOMEN — WHAT EACH SCREEN SAYS FIRST, AND ITS ONE GOLD ACTION.

   One resolver per screen. Each reads the member's own evidence and returns:

     statement     one plain line about her current state on this screen
     support       one or two lines of context, never a verdict
     action        THE gold primary — the first thing actually missing
     secondary     an optional real alternative (never gold)
     requirements  what the screen needs, with real counts of her own logs

   Nothing here is sample data and nothing is a score she didn't earn.
   Cycle phase is always an estimate from dates she entered. Nothing times
   conception, predicts fertility, guides contraception, or tells anyone
   what to take, start, stop or change. Pregnancy training and nutrition
   route to a clinician, midwife or OB.

   Pure: no React, no store.
   ════════════════════════════════════════════════════════════════════════ */

import { CYCLE_PHASE_META, ASSUMED_DAYS_BETWEEN_STARTS } from "./cycle";
import type { CyclePhase, PregnancyStage } from "./types";
import { PREGNANCY_STAGE_LABELS } from "./types";

/** Screens a women's action may land on. Every one is a real logger or record. */
export type WomensTargetView =
  | "training"
  | "nutrition"
  | "recovery"
  | "physique"
  | "progress-photos"
  | "womens-cycle";

export const WOMENS_WATER_OZ = 16;

export type WomensAction =
  | { kind: "open-cycle-dates"; label: string }
  | { kind: "open-day-log"; label: string }
  | { kind: "open-sleep-log"; label: string }
  | { kind: "log-water"; label: string; oz: number }
  | { kind: "open-view"; label: string; view: WomensTargetView }
  | { kind: "enable-fertility"; label: string }
  | { kind: "choose-areas"; label: string }
  | { kind: "enable-pregnancy"; label: string }
  | { kind: "open-stage"; label: string };

export type WomensRequirement = {
  id: string;
  label: string;
  /** Her own count. Never a guess. */
  have: number;
  need: number;
  noun: string;
  detail: string;
  action: WomensAction;
};

export type WomensResolution = {
  statement: string;
  support: string;
  action: WomensAction;
  secondary?: WomensAction;
  requirements: WomensRequirement[];
};

export type WomensCycleRead = {
  entered: boolean;
  dayOfCycle: number | null;
  phase: CyclePhase | null;
  beyondEstimate: boolean;
  /** She entered her own days between periods and period days. */
  basisEntered: boolean;
  daysBetweenStarts: number;
};

/** Everything the resolvers read. Each field is a count or a fact from her own logs. */
export type WomensEvidence = {
  cycle: WomensCycleRead;
  loggedDays: number;
  dayLoggedToday: boolean;
  trainingFeltDays: number;
  trainingFeltToday: boolean;
  trainingPlannedToday: boolean;
  sessionTitle: string | null;
  sleepNights: number;
  sleepLoggedToday: boolean;
  waterLoggedToday: boolean;
  recoveryLabel: string | null;
  mealsToday: number;
  mealDays: number;
  checkIns: number;
  photoCheckIns: number;
  fertilityEnabled: boolean;
  fertilityAreas: number;
  pregnancyEnabled: boolean;
  pregnancyStage: PregnancyStage | null;
};

export const EMPTY_WOMENS_EVIDENCE: WomensEvidence = {
  cycle: { entered: false, dayOfCycle: null, phase: null, beyondEstimate: false, basisEntered: false, daysBetweenStarts: ASSUMED_DAYS_BETWEEN_STARTS },
  loggedDays: 0,
  dayLoggedToday: false,
  trainingFeltDays: 0,
  trainingFeltToday: false,
  trainingPlannedToday: false,
  sessionTitle: null,
  sleepNights: 0,
  sleepLoggedToday: false,
  waterLoggedToday: false,
  recoveryLabel: null,
  mealsToday: 0,
  mealDays: 0,
  checkIns: 0,
  photoCheckIns: 0,
  fertilityEnabled: false,
  fertilityAreas: 0,
  pregnancyEnabled: false,
  pregnancyStage: null,
};

/* ─── Shared pieces ─────────────────────────────────────────────────────── */

const ENTER_PERIOD_START: WomensAction = { kind: "open-cycle-dates", label: "Enter Period Start" };
const LOG_TODAY: WomensAction = { kind: "open-day-log", label: "Log Today" };
const LOG_SLEEP: WomensAction = { kind: "open-sleep-log", label: "Log Last Night's Sleep" };
const LOG_WATER: WomensAction = { kind: "log-water", label: `Log ${WOMENS_WATER_OZ} oz Water`, oz: WOMENS_WATER_OZ };

export function isRequirementMet(r: WomensRequirement): boolean {
  return r.have >= r.need;
}

export function firstUnmetRequirement(requirements: readonly WomensRequirement[]): WomensRequirement | null {
  return requirements.find((r) => !isRequirementMet(r)) ?? null;
}

function periodStartRequirement(e: WomensEvidence): WomensRequirement {
  return {
    id: "period-start",
    label: "Your last period start",
    have: e.cycle.entered ? 1 : 0,
    need: 1,
    noun: "date",
    detail: "The one date every phase estimate on this track counts from.",
    action: ENTER_PERIOD_START,
  };
}

function loggedDaysRequirement(e: WomensEvidence): WomensRequirement {
  return {
    id: "logged-days",
    label: "Two logged days",
    have: Math.min(e.loggedDays, 2),
    need: 2,
    noun: "days",
    detail: "Energy, sleep, stress and how training felt, in your own words. Two days start the record.",
    action: LOG_TODAY,
  };
}

/** "Cycle day 12 · Follicular (est.)" — or null without an estimate. */
export function cycleDayLine(c: WomensCycleRead): string | null {
  if (!c.entered || c.dayOfCycle === null) return null;
  if (c.beyondEstimate || !c.phase) return `Day ${c.dayOfCycle} since your last period start`;
  return `Cycle day ${c.dayOfCycle} · ${CYCLE_PHASE_META[c.phase].label} (est.)`;
}

function basisClause(c: WomensCycleRead): string {
  return c.basisEntered
    ? `and the ${c.daysBetweenStarts} days between periods you entered`
    : `and an assumed ${ASSUMED_DAYS_BETWEEN_STARTS} days between periods until you enter yours`;
}

const NO_PHASE_CHANGE = "Reserve never changes a session because of a phase.";

/* ─── Performance Command — the track's front door ──────────────────────── */

export function overviewRequirements(e: WomensEvidence): WomensRequirement[] {
  return [
    periodStartRequirement(e),
    loggedDaysRequirement(e),
    {
      id: "sleep",
      label: "A night of sleep logged",
      have: Math.min(e.sleepNights, 1),
      need: 1,
      noun: "night",
      detail: "Recovery on this track reads the sleep you log in the Recovery room.",
      action: LOG_SLEEP,
    },
    {
      id: "check-in",
      label: "A physique check-in",
      have: Math.min(e.checkIns, 1),
      need: 1,
      noun: "check-in",
      detail: "Weight and measurements, dated, so each entry can sit beside its estimated phase.",
      action: { kind: "open-view", label: "Log a Check-In", view: "physique" },
    },
  ];
}

export function resolveWomensOverview(e: WomensEvidence): WomensResolution {
  const requirements = overviewRequirements(e);
  const unmet = firstUnmetRequirement(requirements);
  const c = e.cycle;

  const statement = !c.entered
    ? "Cycle dates not entered"
    : c.beyondEstimate || !c.phase
      ? `Day ${c.dayOfCycle} since your last period start`
      : `Cycle day ${c.dayOfCycle} · ${CYCLE_PHASE_META[c.phase].label}`;

  const support = !c.entered
    ? "Enter the first day of your last period and Reserve estimates where you are in your cycle. Everything else here reads what you log."
    : c.beyondEstimate || !c.phase
      ? "That is past the estimate, so no phase is shown. Enter your latest period start when it comes."
      : `Estimated from the period start you entered ${basisClause(c)}. ${NO_PHASE_CHANGE}`;

  let action: WomensAction;
  if (unmet) action = unmet.action;
  else if (!e.dayLoggedToday) action = LOG_TODAY;
  else if (e.trainingPlannedToday) action = { kind: "open-view", label: "Open Today's Session", view: "training" };
  else action = { kind: "open-view", label: "Review Your Cycle Record", view: "womens-cycle" };

  return { statement, support, action, requirements };
}

/* ─── Cycle Command — the record ────────────────────────────────────────── */

export function cycleRequirements(e: WomensEvidence): WomensRequirement[] {
  return [
    periodStartRequirement(e),
    loggedDaysRequirement(e),
    {
      id: "timing",
      label: "Your usual timing",
      have: e.cycle.basisEntered ? 1 : 0,
      need: 1,
      noun: "entry",
      detail: `Days from one period start to the next, and how many period days. Until then Reserve assumes ${ASSUMED_DAYS_BETWEEN_STARTS} and says so.`,
      action: { kind: "open-cycle-dates", label: "Enter Your Usual Timing" },
    },
  ];
}

export function resolveCycleCommand(e: WomensEvidence): WomensResolution {
  const c = e.cycle;
  const requirements = cycleRequirements(e);

  const statement = !c.entered
    ? "No cycle dates entered"
    : c.beyondEstimate || !c.phase
      ? `Day ${c.dayOfCycle} since your last period start`
      : `Day ${c.dayOfCycle} of your cycle`;

  const support = !c.entered
    ? "Enter the first day of your last period. Reserve estimates your phase from the dates you enter. It is a calendar estimate, not a prediction."
    : c.beyondEstimate || !c.phase
      ? `That is past the ${c.daysBetweenStarts} days between periods ${c.basisEntered ? "you entered" : "Reserve assumes"}, so no phase is estimated. Enter your latest period start when it comes.`
      : `${CYCLE_PHASE_META[c.phase].label} phase, estimated from the period start you entered ${basisClause(c)}.`;

  let action: WomensAction;
  if (!c.entered) action = ENTER_PERIOD_START;
  else if (!e.dayLoggedToday) action = LOG_TODAY;
  else if (!c.basisEntered) action = { kind: "open-cycle-dates", label: "Enter Your Usual Timing" };
  else action = { kind: "open-day-log", label: "Edit Today's Log" };

  const secondary: WomensAction | undefined =
    c.entered && action.kind !== "open-cycle-dates" ? { kind: "open-cycle-dates", label: "Edit Cycle Dates" } : undefined;

  return { statement, support, action, secondary, requirements };
}

/* ─── Training Command ──────────────────────────────────────────────────── */

export function trainingRequirements(e: WomensEvidence): WomensRequirement[] {
  return [
    periodStartRequirement(e),
    {
      id: "training-felt",
      label: "How training felt, on two days",
      have: Math.min(e.trainingFeltDays, 2),
      need: 2,
      noun: "days",
      detail: "Harder than usual, about usual or better. Your answers are what this screen sorts by phase.",
      action: { kind: "open-day-log", label: "Log How Training Felt" },
    },
  ];
}

export function resolveWomensTraining(e: WomensEvidence): WomensResolution {
  const requirements = trainingRequirements(e);
  const statement = e.trainingPlannedToday ? `${e.sessionTitle ?? "A session"} today` : "No session planned today";
  const line = cycleDayLine(e.cycle);
  const support = line
    ? `${line}. ${NO_PHASE_CHANGE} Below is how training felt in each phase, from your logs.`
    : `${NO_PHASE_CHANGE} Log how training felt and Reserve sorts your answers by estimated phase.`;

  let action: WomensAction;
  let secondary: WomensAction | undefined;
  if (e.trainingPlannedToday && !e.trainingFeltToday) {
    action = { kind: "open-view", label: "Open Today's Session", view: "training" };
    secondary = { kind: "open-day-log", label: "Log How It Felt" };
  } else if (!e.trainingPlannedToday && !e.cycle.entered) {
    action = ENTER_PERIOD_START;
  } else if (!e.trainingPlannedToday && !e.dayLoggedToday) {
    action = LOG_TODAY;
  } else {
    action = { kind: "open-view", label: "Open Training", view: "training" };
  }
  return { statement, support, action, secondary, requirements };
}

/* ─── Recovery Command ──────────────────────────────────────────────────── */

export function recoveryRequirements(e: WomensEvidence): WomensRequirement[] {
  return [
    {
      id: "sleep-nights",
      label: "Three nights of sleep",
      have: Math.min(e.sleepNights, 3),
      need: 3,
      noun: "nights",
      detail: "Three logged nights give the Recovery room its first consistency read, and give each phase nights to sort.",
      action: LOG_SLEEP,
    },
    periodStartRequirement(e),
    loggedDaysRequirement(e),
  ];
}

export function resolveWomensRecovery(e: WomensEvidence): WomensResolution {
  const requirements = recoveryRequirements(e);
  const statement = e.recoveryLabel
    ? `Recovery · ${e.recoveryLabel}`
    : e.sleepNights === 0
      ? "No sleep logged yet"
      : "Recovery evidence needed";
  const line = cycleDayLine(e.cycle);
  const support = line
    ? `${line}. Your own sleep and energy, sorted by estimated phase. Behavioral tracking only.`
    : "Recovery here reads the sleep, water and check-ins you log. Enter a period start to sort them by estimated phase.";

  let action: WomensAction;
  if (!e.sleepLoggedToday) action = LOG_SLEEP;
  else if (!e.waterLoggedToday) action = LOG_WATER;
  else if (!e.dayLoggedToday) action = LOG_TODAY;
  else action = { kind: "open-view", label: "Open Recovery", view: "recovery" };
  return { statement, support, action, requirements };
}

/* ─── Nutrition Command ─────────────────────────────────────────────────── */

export function nutritionRequirements(e: WomensEvidence): WomensRequirement[] {
  return [
    {
      id: "meal-days",
      label: "Meals logged on two days",
      have: Math.min(e.mealDays, 2),
      need: 2,
      noun: "days",
      detail: "Meals come from the Nutrition room's log. Two days start the by-phase record.",
      action: { kind: "open-view", label: "Log a Meal", view: "nutrition" },
    },
    periodStartRequirement(e),
    loggedDaysRequirement(e),
  ];
}

export function resolveWomensNutrition(e: WomensEvidence): WomensResolution {
  const requirements = nutritionRequirements(e);
  const statement = e.mealsToday > 0 ? `${e.mealsToday} meal${e.mealsToday === 1 ? "" : "s"} logged today` : "No meals logged today";
  const line = cycleDayLine(e.cycle);
  const support = line
    ? `${line}. Your logged meal days and the cravings you noted, sorted by estimated phase.`
    : "Meals come from the Nutrition room's log. Enter a period start to sort your logged days by estimated phase.";

  let action: WomensAction;
  if (e.mealsToday === 0) action = { kind: "open-view", label: "Log a Meal", view: "nutrition" };
  else if (!e.dayLoggedToday) action = LOG_TODAY;
  else action = { kind: "open-view", label: "Log Your Next Meal", view: "nutrition" };
  return { statement, support, action, requirements };
}

/* ─── Physique Command ──────────────────────────────────────────────────── */

export function physiqueRequirements(e: WomensEvidence): WomensRequirement[] {
  return [
    {
      id: "check-ins",
      label: "Two check-ins",
      have: Math.min(e.checkIns, 2),
      need: 2,
      noun: "check-ins",
      detail: "A change needs two dated entries. With one there is a value, never a change.",
      action: { kind: "open-view", label: "Log a Check-In", view: "physique" },
    },
    {
      id: "photos",
      label: "A photo check-in",
      have: Math.min(e.photoCheckIns, 1),
      need: 1,
      noun: "photo check-in",
      detail: "A dated set beside the numbers. Reserve records the date and poses. It never reads the image.",
      action: { kind: "open-view", label: "Add Progress Photo", view: "progress-photos" },
    },
    periodStartRequirement(e),
  ];
}

export function resolveWomensPhysique(e: WomensEvidence): WomensResolution {
  const requirements = physiqueRequirements(e);
  const statement = e.checkIns === 0 ? "No check-ins on file" : e.checkIns === 1 ? "One check-in on file" : `${e.checkIns} check-ins on file`;
  const support = e.cycle.entered
    ? "Each check-in shows the phase estimated for its date, so you can compare entries from the same phase."
    : "Enter a period start and each check-in shows the phase estimated for its date.";
  const unmet = firstUnmetRequirement(requirements);
  const action = unmet ? unmet.action : { kind: "open-view" as const, label: "Log a Check-In", view: "physique" as const };
  return { statement, support, action, requirements };
}

/* ─── Fertility Command (optional) ──────────────────────────────────────── */

export const FERTILITY_BOUNDARY =
  "It does not time conception, predict fertility or guide contraception.";

export function fertilityRequirements(e: WomensEvidence): WomensRequirement[] {
  return [
    {
      id: "module",
      label: "Fertility tracking on",
      have: e.fertilityEnabled ? 1 : 0,
      need: 1,
      noun: "switch",
      detail: "Optional. Off until you turn it on, and it can be turned off at any time.",
      action: { kind: "enable-fertility", label: "Turn On Fertility Tracking" },
    },
    periodStartRequirement(e),
    {
      id: "areas",
      label: "A lifestyle area to track",
      have: Math.min(e.fertilityAreas, 1),
      need: 1,
      noun: "area",
      detail: "Sleep, water, stress, meals or recovery. Each one reads a log you already keep.",
      action: { kind: "choose-areas", label: "Choose What to Track" },
    },
    loggedDaysRequirement(e),
  ];
}

export function resolveFertility(e: WomensEvidence): WomensResolution {
  const requirements = fertilityRequirements(e);
  if (!e.fertilityEnabled) {
    return {
      statement: "Fertility tracking is off",
      support: `An optional private record of your cycle dates and the lifestyle areas you choose to log. ${FERTILITY_BOUNDARY}`,
      action: { kind: "enable-fertility", label: "Turn On Fertility Tracking" },
      requirements,
    };
  }
  const statement = e.fertilityAreas === 0 ? "Choose what to track" : `Tracking ${e.fertilityAreas} lifestyle area${e.fertilityAreas === 1 ? "" : "s"}`;
  const support = `Estimated from your dates and read from your own logs. ${FERTILITY_BOUNDARY} Questions about conceiving belong with a clinician.`;
  let action: WomensAction;
  if (!e.cycle.entered) action = ENTER_PERIOD_START;
  else if (e.fertilityAreas === 0) action = { kind: "choose-areas", label: "Choose What to Track" };
  else if (!e.dayLoggedToday) action = LOG_TODAY;
  else action = { kind: "open-view", label: "Review Your Cycle Record", view: "womens-cycle" };
  return { statement, support, action, requirements };
}

/* ─── Pregnancy Command (optional) ──────────────────────────────────────── */

export const PREGNANCY_CARE_LINE =
  "Reserve does not adjust training or nutrition for pregnancy. Check any change with your clinician, midwife or OB first.";

export function pregnancyRequirements(e: WomensEvidence): WomensRequirement[] {
  return [
    {
      id: "module",
      label: "Pregnancy tracking on",
      have: e.pregnancyEnabled ? 1 : 0,
      need: 1,
      noun: "switch",
      detail: "Optional. Off until you turn it on, and it can be turned off at any time.",
      action: { kind: "enable-pregnancy", label: "Turn On Pregnancy Tracking" },
    },
    {
      id: "stage",
      label: "Your stage",
      have: e.pregnancyStage ? 1 : 0,
      need: 1,
      noun: "entry",
      detail: "The trimester you enter. Reserve does not calculate it.",
      action: { kind: "open-stage", label: "Enter Your Stage" },
    },
    {
      id: "sleep",
      label: "A night of sleep logged",
      have: Math.min(e.sleepNights, 1),
      need: 1,
      noun: "night",
      detail: "Logged in the Recovery room, read here.",
      action: LOG_SLEEP,
    },
    {
      id: "meals",
      label: "Meals logged on a day",
      have: Math.min(e.mealDays, 1),
      need: 1,
      noun: "day",
      detail: "Logged in the Nutrition room, read here.",
      action: { kind: "open-view", label: "Log a Meal", view: "nutrition" },
    },
  ];
}

export function resolvePregnancy(e: WomensEvidence): WomensResolution {
  const requirements = pregnancyRequirements(e);
  if (!e.pregnancyEnabled) {
    return {
      statement: "Pregnancy tracking is off",
      support: `An optional private record of the stage you enter and the sleep, water and meals you log. ${PREGNANCY_CARE_LINE}`,
      action: { kind: "enable-pregnancy", label: "Turn On Pregnancy Tracking" },
      requirements,
    };
  }
  if (!e.pregnancyStage) {
    return {
      statement: "Stage not entered",
      support: `Enter the trimester you are in. ${PREGNANCY_CARE_LINE}`,
      action: { kind: "open-stage", label: "Enter Your Stage" },
      requirements,
    };
  }
  let action: WomensAction;
  if (!e.sleepLoggedToday) action = LOG_SLEEP;
  else if (!e.waterLoggedToday) action = LOG_WATER;
  else if (e.mealsToday === 0) action = { kind: "open-view", label: "Log a Meal", view: "nutrition" };
  else action = { kind: "open-view", label: "Open Recovery", view: "recovery" };
  return {
    statement: PREGNANCY_STAGE_LABELS[e.pregnancyStage],
    support: "The stage you entered, with what you logged this week. Care decisions stay with your clinician, midwife or OB.",
    action,
    secondary: { kind: "open-stage", label: "Change Stage" },
    requirements,
  };
}

/** Every fixed line above, for the banned-language suite. */
export const WOMENS_FIXED_COPY: readonly string[] = [
  FERTILITY_BOUNDARY,
  PREGNANCY_CARE_LINE,
  NO_PHASE_CHANGE,
  ...Object.values(CYCLE_PHASE_META).map((m) => m.definition),
];
