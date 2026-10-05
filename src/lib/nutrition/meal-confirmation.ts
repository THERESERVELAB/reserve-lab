/* ════════════════════════════════════════════════════════════════════════
   MEAL CONFIRMATION + LIVE SMART MEAL BRIEF — pure engine

   Turns a "log this meal" intent into a controlled command event:
   schedule-fit classification, before → meal → after macro impact, safe
   ingredient insights, and a goal/context-aware smart brief. No meal counts
   until the UI confirms. Performance meal-planning support only — no medical
   claims, no dosing, no compound advice, no unsupported ingredient claims.
   ════════════════════════════════════════════════════════════════════════ */

import type { GoalKey, Meal, MealPlan, MealPurpose } from "./types";
import { detectSleepConflict, formatTime12, timeToMinutes } from "@/lib/schedule/engine";
import type { MemberScheduleProfile } from "@/lib/schedule/types";

export type ConfMacros = { calories: number; proteinG: number; carbsG: number; fatG: number };

/* ─── Slot labels ─────────────────────────────────────────────────────── */
const SLOT_LABEL: Record<MealPurpose, string> = {
  "morning-anchor": "Morning Protein Anchor",
  "rest-day-anchor": "Morning Anchor",
  "work-meal": "Work Meal",
  "midday-meal": "Midday Meal",
  "pre-workout": "Pre-Workout Meal",
  "post-workout": "Post-Workout Meal",
  "night-recovery": "Night Recovery Meal",
  snack: "Extra Meal",
};

export function slotLabelForPurpose(purpose: MealPurpose): string {
  return SLOT_LABEL[purpose] ?? "Meal";
}

/* ─── Schedule fit ────────────────────────────────────────────────────── */
export type MealScheduleFitState =
  | "on-time"
  | "early"
  | "late"
  | "outside-window"
  | "conflict"
  | "after-sleep"
  | "before-training-complete"
  | "data-limited";

export type MealScheduleFit = {
  state: MealScheduleFitState;
  label: string;
  message: string;
  tone: "good" | "watch" | "bad";
  /** When true, the UI emphasizes a confirm-before-counting warning. */
  warn: boolean;
};

const FIT_LABEL: Record<MealScheduleFitState, string> = {
  "on-time": "On Time",
  early: "Early",
  late: "Late",
  "outside-window": "Outside Window",
  conflict: "Schedule Conflict",
  "after-sleep": "After Sleep Target",
  "before-training-complete": "Before Training Complete",
  "data-limited": "Data Limited",
};

/** Planned window (minutes-from-midnight range) for a meal, from the schedule. */
function plannedWindow(purpose: MealPurpose, s: MemberScheduleProfile): { start: number; end: number } | null {
  const wake = timeToMinutes(s.wakeTime);
  const trainStart = timeToMinutes(s.preferredTrainingStart);
  const trainEnd = timeToMinutes(s.preferredTrainingEnd);
  switch (purpose) {
    case "morning-anchor":
    case "rest-day-anchor":
      return { start: wake, end: wake + 180 };
    case "pre-workout":
      return { start: trainStart - 150, end: trainStart };
    case "post-workout":
      return { start: trainEnd, end: trainEnd + 120 };
    case "midday-meal":
    case "work-meal":
      return { start: 11 * 60, end: 15 * 60 };
    case "night-recovery":
      return { start: trainEnd, end: timeToMinutes(s.sleepTarget) };
    case "snack":
      return null; // anytime
  }
}

export type ScheduleFitInput = {
  purpose: MealPurpose;
  plannedMinutes: number;
  actualMinutes: number;
  schedule: MemberScheduleProfile;
  /** Whether the training session is marked complete (from the store). */
  trainingComplete: boolean;
};

export function classifyMealScheduleFit(input: ScheduleFitInput): MealScheduleFit {
  const { purpose, actualMinutes, schedule, trainingComplete } = input;
  const sleep = timeToMinutes(schedule.sleepTarget);
  const sleepAdj = sleep < 360 ? sleep + 1440 : sleep;
  const trainEnd = timeToMinutes(schedule.preferredTrainingEnd);
  const actualAdj = actualMinutes < 360 ? actualMinutes + 1440 : actualMinutes;

  const mk = (state: MealScheduleFitState, message: string, tone: MealScheduleFit["tone"], warn: boolean): MealScheduleFit =>
    ({ state, label: FIT_LABEL[state], message, tone, warn });

  if (!schedule.preferredTrainingStart || !schedule.sleepTarget) {
    return mk("data-limited", "Set your daily schedule to improve meal-timing fit.", "watch", false);
  }

  // After the sleep target — always a confirm-first warning.
  if (actualAdj >= sleepAdj) {
    return mk("after-sleep", "This meal is after the sleep target. Keep this intentional and avoid making it the default pattern.", "bad", true);
  }

  // Post-workout meal before training is marked complete.
  if (purpose === "post-workout" && !trainingComplete && actualMinutes < trainEnd) {
    return mk("before-training-complete", "Training is not marked complete yet. Confirm this is intentional.", "watch", true);
  }

  // Late post-workout meal that lands in a sleep-compression conflict.
  const sleepConflict = detectSleepConflict(schedule);
  if (purpose === "post-workout" && sleepConflict.conflict && actualMinutes >= trainEnd) {
    return mk("conflict", "Schedule conflict — the late session compresses sleep. Keep this log light and intentional.", "watch", true);
  }

  const win = plannedWindow(purpose, schedule);
  if (!win) return mk("on-time", "Flexible meal — fits whenever macros allow.", "good", false);

  if (actualMinutes < win.start - 45) return mk("outside-window", "This meal is outside the planned window. Confirm before counting it toward today.", "watch", true);
  if (actualMinutes > win.end + 60) return mk("outside-window", "This meal is well after its planned window. Confirm before counting it toward today.", "watch", true);
  if (actualMinutes < win.start) return mk("early", "A little early for this window — still useful.", "good", false);
  if (actualMinutes > win.end) return mk("late", "This meal is late but still useful.", "watch", false);
  return mk("on-time", "This meal is on time for its window.", "good", false);
}

/* ─── Macro impact (before → meal → after) ────────────────────────────── */
export type MealMacroImpact = {
  targets: ConfMacros;
  before: ConfMacros;
  meal: ConfMacros;
  after: ConfMacros;
  statusLines: string[];
  proteinPctAfter: number;
};

const clamp0 = (n: number) => Math.max(0, Math.round(n));

export function buildMealMacroImpact(plan: MealPlan, meal: Meal): MealMacroImpact {
  const targets: ConfMacros = {
    calories: plan.totalMacros.calories,
    proteinG: plan.totalMacros.proteinG,
    carbsG: plan.totalMacros.carbsG,
    fatG: plan.totalMacros.fatG,
  };
  const before: ConfMacros = {
    calories: clamp0(targets.calories - plan.remainingMacros.calories),
    proteinG: clamp0(targets.proteinG - plan.remainingMacros.proteinG),
    carbsG: clamp0(targets.carbsG - plan.remainingMacros.carbsG),
    fatG: clamp0(targets.fatG - plan.remainingMacros.fatG),
  };
  const mealM: ConfMacros = {
    calories: clamp0(meal.macros.calories),
    proteinG: clamp0(meal.macros.proteinG),
    carbsG: clamp0(meal.macros.carbsG),
    fatG: clamp0(meal.macros.fatG),
  };
  const after: ConfMacros = {
    calories: before.calories + mealM.calories,
    proteinG: before.proteinG + mealM.proteinG,
    carbsG: before.carbsG + mealM.carbsG,
    fatG: before.fatG + mealM.fatG,
  };

  const line = (label: string, a: number, t: number): string => {
    const gap = t - a;
    if (gap > 8) return `${label} still short by ${gap}g`;
    if (gap >= -5) return `${label} ${gap <= 0 ? "on target" : "nearly complete"}`;
    return `${label} over by ${Math.abs(gap)}g`;
  };
  const statusLines = [
    line("Protein", after.proteinG, targets.proteinG),
    line("Carbs", after.carbsG, targets.carbsG),
    line("Fats", after.fatG, targets.fatG),
  ];
  const proteinPctAfter = targets.proteinG > 0 ? Math.round((after.proteinG / targets.proteinG) * 100) : 0;

  return { targets, before, meal: mealM, after, statusLines, proteinPctAfter };
}

/* ─── Ingredient insight light (safe, careful language only) ───────────── */
export type MealIngredientInsight = { name: string; note: string };

const INGREDIENT_NOTES: Array<{ match: RegExp; name: string; note: string }> = [
  { match: /pineapple/i, name: "Pineapple", note: "Pineapple adds quick carbs and contains bromelain, an enzyme associated with protein digestion support. It can fit well as a light post-workout snack while the full meal is being prepared." },
  { match: /egg white/i, name: "Egg Whites", note: "Egg whites add lean protein without much added fat." },
  { match: /\begg/i, name: "Eggs", note: "Eggs add protein and fats, making them a strong anchor for satiety and meal structure." },
  { match: /sweet potato/i, name: "Sweet Potato", note: "Sweet potato adds training-friendly carbohydrates and fits well around performance windows." },
  { match: /cottage cheese/i, name: "Cottage Cheese", note: "Cottage cheese adds protein and works well in slower-digesting meal structures." },
  { match: /electrolyte/i, name: "Electrolytes", note: "Electrolytes support the hydration routine. Track serving count for restock accuracy." },
  { match: /espresso|coffee/i, name: "Coffee", note: "Coffee fits the morning routine. Keep timing aligned with sleep protection." },
  { match: /jam|preserve/i, name: "Strawberry Jam", note: "Adds quick carbs and flavor. Track added sugar if that matters to the day's target." },
  { match: /parmesan|parmigiano/i, name: "Parmesan", note: "Adds flavor, fats, and protein in small amounts. Track portion size for accuracy." },
  { match: /sourdough|toast|bread/i, name: "Sourdough", note: "Adds carbohydrates and structure to the meal. Track portion for accuracy." },
  { match: /oats|oatmeal/i, name: "Oats", note: "Oats add slower-digesting carbohydrates that fit well earlier in the day." },
  { match: /white rice|jasmine rice|\brice/i, name: "Rice", note: "Rice adds easy-digesting carbohydrates that fit well around training windows." },
  { match: /salmon/i, name: "Salmon", note: "Salmon adds protein and fats and fits a recovery-friendly meal structure." },
];

export function getIngredientInsights(foods: Array<{ name: string }>, max = 3): MealIngredientInsight[] {
  const out: MealIngredientInsight[] = [];
  const seen = new Set<string>();
  for (const f of foods) {
    for (const rule of INGREDIENT_NOTES) {
      if (rule.match.test(f.name) && !seen.has(rule.name)) {
        seen.add(rule.name);
        out.push({ name: rule.name, note: rule.note });
        break;
      }
    }
    if (out.length >= max) break;
  }
  return out;
}

/* ─── Smart Meal Brief (goal + context aware) ─────────────────────────── */
export type MealSmartBrief = {
  mealName: string;
  slotLabel: string;
  whatItDid: string;
  macroImpact: string;
  trainingSupport: string;
  recoverySupport: string;
  physiqueSignal: string;
  ingredientInsights: MealIngredientInsight[];
  nextAction: string;
  onTrack: "behind" | "on-track" | "complete";
  onTrackLabel: string;
};

const WHAT_IT_DID: Record<MealPurpose, string> = {
  "morning-anchor": "started the day with structure and moved protein onto the board.",
  "rest-day-anchor": "anchored the rest day and moved protein onto the board.",
  "pre-workout": "placed fuel before the session so training doesn't start under-fueled.",
  "post-workout": "closed the session with nutrition and moved protein closer to target.",
  "midday-meal": "kept meal timing consistent and carried the daily macros forward.",
  "work-meal": "kept meal timing consistent through the workday.",
  "night-recovery": "added recovery nutrition into the evening window.",
  snack: "topped up the day's macros.",
};

const CONTEXT_COPY: Record<MealPurpose, { training: string; recovery: string; physique: string }> = {
  "morning-anchor": {
    training: "Starts the day with structure ahead of the session.",
    recovery: "Helps stabilize the morning routine.",
    physique: "Protein early supports the day's adherence target.",
  },
  "rest-day-anchor": {
    training: "Keeps structure on a non-training day.",
    recovery: "Supports a consistent recovery-day rhythm.",
    physique: "Protein early supports the day's adherence target.",
  },
  "pre-workout": {
    training: "Supports the training window by placing fuel before the session.",
    recovery: "Keeps the session from starting under-fueled.",
    physique: "Helps protect training quality, which supports the physique plan.",
  },
  "post-workout": {
    training: "Closes the session with nutrition instead of leaving the window open.",
    recovery: "Protein and carbs support the recovery plan.",
    physique: "Keeps the day aligned with the physique target.",
  },
  "midday-meal": {
    training: "Holds energy steady through the day.",
    recovery: "Keeps fueling consistent between sessions.",
    physique: "Consistent timing supports the adherence target.",
  },
  "work-meal": {
    training: "Holds energy steady through the workday.",
    recovery: "Keeps fueling consistent across the day.",
    physique: "Consistent timing supports the adherence target.",
  },
  "night-recovery": {
    training: "Caps the day's fueling after the session.",
    recovery: "Fits the recovery plan if it does not compete with sleep.",
    physique: "Keeps the day aligned without overrunning late.",
  },
  snack: {
    training: "Bridges a gap between planned meals.",
    recovery: "Keeps macros moving without a full meal.",
    physique: "Use only if the day's macros allow it.",
  },
};

function goalPhysiqueNuance(goal: GoalKey): string {
  switch (goal) {
    case "recomp": return "On a recomp, protein adherence is the lever that matters most.";
    case "cut": return "On a cut, controlled calories with high protein protect lean mass.";
    case "lean-bulk": return "On a lean bulk, carbs around training support the surplus.";
    case "prep": return "For prep, day-to-day consistency keeps the plan on track.";
    case "performance": return "For performance, this fueling supports output and recovery.";
    default: return "For maintenance, steady meal timing keeps things stable.";
  }
}

export type SmartBriefInput = {
  meal: Meal;
  goal: GoalKey;
  impact: MealMacroImpact;
  fit: MealScheduleFit;
  ingredientInsights: MealIngredientInsight[];
};

export function buildMealSmartBrief(input: SmartBriefInput): MealSmartBrief {
  const { meal, goal, impact, fit, ingredientInsights } = input;
  const ctx = CONTEXT_COPY[meal.purpose];
  const m = impact.meal;
  const macroImpact = `+${m.proteinG}P · +${m.carbsG}C · +${m.fatG}F`;

  // On-track read from the post-log macro picture.
  const t = impact.targets;
  const a = impact.after;
  const onTrack: MealSmartBrief["onTrack"] =
    a.calories >= t.calories * 0.97 && a.proteinG >= t.proteinG * 0.95 ? "complete"
      : a.proteinG < t.proteinG * 0.6 ? "behind"
        : "on-track";
  const onTrackLabel = onTrack === "complete" ? "Day Complete" : onTrack === "behind" ? "Behind Pace" : "On Track";

  const proteinGap = t.proteinG - a.proteinG;
  let nextAction: string;
  if (fit.state === "after-sleep") nextAction = "Protect the sleep window — avoid making late meals the default.";
  else if (proteinGap > 12) nextAction = `Keep protein moving — about ${proteinGap}g to target.`;
  else if (a.calories >= t.calories) nextAction = "Calories are on target — keep the next meal clean.";
  else nextAction = "Finish hydration and keep the next meal clean.";

  // Physique signal blends the slot context with a distinct goal-aware clause.
  const physique = `${ctx.physique} ${goalPhysiqueNuance(goal)}`;

  return {
    mealName: meal.dishName || meal.foods[0]?.name || meal.name,
    slotLabel: slotLabelForPurpose(meal.purpose),
    whatItDid: `This meal ${WHAT_IT_DID[meal.purpose]}`,
    macroImpact,
    trainingSupport: ctx.training,
    recoverySupport: ctx.recovery,
    physiqueSignal: physique,
    ingredientInsights,
    nextAction,
    onTrack,
    onTrackLabel,
  };
}

/* ─── System update + logged event ────────────────────────────────────── */
export type NutritionSystemUpdate = { lines: string[] };

/** Only lines that are true after every log. "Apex Next Move updated" and "AI
    Strategist nutrition signal updated" were removed: Apex's move changes only
    when this meal was the move, and the strategist does not read meal logs. */
export function buildNutritionSystemUpdate(impact: MealMacroImpact, brief: MealSmartBrief): NutritionSystemUpdate {
  const caloriesOver = impact.after.calories > impact.targets.calories;
  return {
    lines: [
      "Meal logged",
      `Protein target now ${Math.min(100, impact.proteinPctAfter)}% complete`,
      caloriesOver ? "Calories over today's target" : "Calories remain on target",
      `Next nutrition action: ${brief.nextAction.replace(/\.$/, "").toLowerCase()}`,
    ],
  };
}

export type LoggedMealEvent = {
  mealId: string;
  mealName: string;
  slotLabel: string;
  plannedTime: string;
  actualTime: string;
  scheduleFitState: MealScheduleFitState;
  mealMacros: ConfMacros;
  proteinPctAfter: number;
  onTrack: MealSmartBrief["onTrack"];
  nextAction: string;
  timestamp: number;
};

/* ─── Slot picker options ─────────────────────────────────────────────── */
export type MealSlotOption = {
  mealId: string;
  slotLabel: string;
  mealName: string;
  plannedTime: string;
  plannedMinutes: number;
  logged: boolean;
  macros: ConfMacros;
  bestFit: boolean;
};

export function buildMealSlotOptions(plan: MealPlan, loggedIds: string[]): MealSlotOption[] {
  const nextId = plan.nextMeal?.id;
  return plan.meals.map((meal) => ({
    mealId: meal.id,
    slotLabel: slotLabelForPurpose(meal.purpose),
    mealName: meal.dishName || meal.foods[0]?.name || meal.name,
    plannedTime: meal.timeWindow,
    plannedMinutes: meal.timeMinutes,
    logged: loggedIds.includes(meal.id),
    macros: {
      calories: clamp0(meal.macros.calories),
      proteinG: clamp0(meal.macros.proteinG),
      carbsG: clamp0(meal.macros.carbsG),
      fatG: clamp0(meal.macros.fatG),
    },
    bestFit: meal.id === nextId,
  }));
}

/** "7:08 AM" from minutes-from-midnight. */
export function minutesToClockLabel(mins: number): string {
  const m = ((mins % 1440) + 1440) % 1440;
  const hh = String(Math.floor(m / 60)).padStart(2, "0");
  const mm = String(m % 60).padStart(2, "0");
  return formatTime12(`${hh}:${mm}`);
}
