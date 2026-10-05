/* ════════════════════════════════════════════════════════════════════════
   CONFLICT ENGINE
   ------------------------------------------------------------------------
   Detects schedule conflicts between meals, training, sleep, work, diet, and
   member/provider-entered compound timing rules. Reserve organizes schedule
   conflicts only — it never recommends compound timing or doses.
   ════════════════════════════════════════════════════════════════════════ */

import { parseHM } from "./meal-timing";
import type {
  Conflict,
  CompoundTimingRule,
  DailySchedule,
  Meal,
} from "./types";

let _seq = 0;
function cid(prefix: string): string { _seq += 1; return `${prefix}-${_seq}`; }

export function detectConflicts(input: {
  meals: Meal[];
  schedule: DailySchedule;
  compoundRules?: CompoundTimingRule[];
  trainingStartMinutes?: number | null;
}): Conflict[] {
  _seq = 0;
  const conflicts: Conflict[] = [];
  const { meals, schedule } = input;
  const rules = input.compoundRules ?? [];

  let sleep = parseHM(schedule.sleepTime) ?? 23 * 60;
  const wake = parseHM(schedule.wakeTime) ?? 7 * 60;
  if (sleep <= wake) sleep += 1440;
  const bedBufferH = schedule.lastMealBeforeBedHours ?? 2;
  const trainStart = input.trainingStartMinutes ?? parseHM(schedule.trainingStartTime);

  const minSpacing = schedule.minimumMealSpacingMinutes ?? 120;

  // 1. No eating window available (work + commute span the whole day with no meals)
  if (meals.length === 0) {
    conflicts.push({
      id: cid("no-window"),
      severity: "warning",
      category: "work",
      message: "No meal windows could be placed — schedule data may be incomplete.",
      affectedItems: [],
      possibleActions: ["Add wake/sleep times", "Set preferred meal count"],
    });
  }

  // 2. Meal spacing too tight
  for (let i = 1; i < meals.length; i += 1) {
    const gap = meals[i].timeMinutes - meals[i - 1].timeMinutes;
    if (gap > 0 && gap < Math.min(minSpacing, 90)) {
      conflicts.push({
        id: cid("spacing"),
        severity: "info",
        category: "meal",
        message: `${meals[i - 1].name} and ${meals[i].name} are packed close together.`,
        affectedItems: [meals[i - 1].id, meals[i].id],
        possibleActions: ["Spread meals further apart", "Reduce meal count"],
      });
    }
  }

  // 3. Last full meal too close to bedtime
  const nightMeals = meals.filter((m) => m.purpose === "night-recovery" || m.purpose === "rest-day-anchor");
  const lastMeal = meals.reduce<Meal | null>((latest, m) => (!latest || m.timeMinutes > latest.timeMinutes ? m : latest), null);
  if (lastMeal && lastMeal.timeMinutes > sleep - bedBufferH * 60 && lastMeal.purpose !== "post-workout") {
    conflicts.push({
      id: cid("bedtime"),
      severity: "warning",
      category: "sleep",
      message: `${lastMeal.name} lands close to sleep — keep it lighter and digestion-friendly.`,
      affectedItems: [lastMeal.id],
      possibleActions: ["Move the meal earlier", "Reduce the meal size"],
    });
  }
  void nightMeals;

  // 4/5. Pre-workout timing relative to training
  if (trainStart !== null && trainStart !== undefined) {
    const pre = meals.find((m) => m.purpose === "pre-workout");
    if (pre) {
      const lead = trainStart - pre.timeMinutes;
      if (lead < 60) {
        conflicts.push({ id: cid("pre-close"), severity: "warning", category: "training", message: "Pre-workout meal is too close to training.", affectedItems: [pre.id], possibleActions: ["Move the pre-workout meal earlier"] });
      } else if (lead > 180) {
        conflicts.push({ id: cid("pre-far"), severity: "info", category: "training", message: "Pre-workout meal is far from training — consider a closer top-up.", affectedItems: [pre.id], possibleActions: ["Add a small pre-workout top-up"] });
      }
    }
    // Post-workout too late relative to sleep
    const post = meals.find((m) => m.purpose === "post-workout");
    if (post && post.timeMinutes > sleep - 45) {
      conflicts.push({ id: cid("post-late"), severity: "warning", category: "sleep", message: "Post-workout meal lands very close to sleep — keep it light and protein-forward.", affectedItems: [post.id], possibleActions: ["Trim the meal", "Shift sleep slightly later if possible"] });
    }
  }

  // 6. Compound timing rules vs meals (member/provider-entered — schedule conflict only)
  for (const rule of rules) {
    const rt = parseHM(rule.plannedTime);
    if (rt === null) continue;

    // Empty-stomach window: flag meals inside ±avoidFood window around the compound time.
    if (rule.emptyStomach || rule.avoidFoodBeforeMinutes || rule.avoidFoodAfterMinutes) {
      const before = rule.avoidFoodBeforeMinutes ?? (rule.emptyStomach ? 60 : 0);
      const after = rule.avoidFoodAfterMinutes ?? (rule.emptyStomach ? 30 : 0);
      const windowStart = rt - before;
      const windowEnd = rt + after;
      for (const meal of meals) {
        if (meal.timeMinutes >= windowStart && meal.timeMinutes <= windowEnd) {
          conflicts.push({
            id: cid("compound-empty"),
            severity: "critical",
            category: "compound",
            message: `${meal.name} conflicts with the entered empty-stomach window for ${rule.compoundName}.`,
            affectedItems: [meal.id, rule.compoundId],
            possibleActions: [`Move ${meal.name} earlier or later`, "Review the compound timing rule"],
          });
        }
      }
    }

    // After-last-meal rule
    if (rule.afterLastMealMinutes && lastMeal) {
      const earliest = lastMeal.timeMinutes + rule.afterLastMealMinutes;
      if (rt < earliest) {
        conflicts.push({
          id: cid("compound-after-meal"),
          severity: "warning",
          category: "compound",
          message: `${rule.compoundName} timing is closer to the last meal than the entered ${rule.afterLastMealMinutes}-min rule.`,
          affectedItems: [rule.compoundId, lastMeal.id],
          possibleActions: ["Review timing — schedule conflicts with the entered rule"],
        });
      }
    }

    // Overlaps training
    if ((rule.preTrainingMinutes || rule.postTrainingMinutes) && (trainStart !== null && trainStart !== undefined)) {
      if (Math.abs(rt - trainStart) < 20) {
        conflicts.push({
          id: cid("compound-train"),
          severity: "info",
          category: "compound",
          message: `${rule.compoundName} timing overlaps the training window.`,
          affectedItems: [rule.compoundId],
          possibleActions: ["Review timing relative to training"],
        });
      }
    }
  }

  // 12/13. Diet conflicts surfaced from meal flags (set during meal build)
  for (const meal of meals) {
    for (const flag of meal.conflictFlags) {
      conflicts.push({
        id: cid("diet"),
        severity: flag.severity,
        category: "diet",
        message: flag.message,
        affectedItems: [meal.id],
        possibleActions: ["Swap the food", "Update diet style or excluded foods"],
      });
    }
  }

  return conflicts;
}
