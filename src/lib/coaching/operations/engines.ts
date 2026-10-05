/* ════════════════════════════════════════════════════════════════════════
   PERFORMANCE OPERATIONS ENGINES — deterministic, explainable services.

   Grocery consolidation, preparation quantity/sequence planning, schedule
   constraint detection, and the Daily Directive composer. Pure functions:
   same inputs, same outputs. No external AI calls — "AI-assisted" drafts
   are deterministic syntheses the coach edits and approves.
   ════════════════════════════════════════════════════════════════════════ */

import { newId, timeToMinutes } from "../ids";
import type {
  CoachAIDraft,
  DailyDirective,
  DirectivePreference,
  GroceryItem,
  LifestyleEvent,
  Meal,
  MealPlan,
  MealPrepSession,
  PantryItem,
  PrepStep,
  ScheduleConstraint,
} from "./types";

/* ─── Grocery consolidation ───────────────────────────────────────────── */

function normalizeIngredientName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Consolidates every ingredient across the selected meals (× servings) into
 * one categorized list. Quantities are kept as coach-entered text and merged
 * as "portion × N" — Reserve never pretends to parse arbitrary units.
 * Pantry items the athlete already owns are marked instead of dropped.
 */
export function consolidateGrocery(
  plan: MealPlan,
  servingsByMeal: Record<string, number>,
  pantry: PantryItem[],
): GroceryItem[] {
  const owned = new Set(pantry.filter((p) => !p.runningLow).map((p) => normalizeIngredientName(p.name)));
  const merged = new Map<string, GroceryItem & { count: number; portion: string }>();

  for (const meal of plan.meals) {
    const servings = servingsByMeal[meal.id] ?? 0;
    if (servings <= 0) continue;
    for (const ingredient of meal.ingredients) {
      const key = `${normalizeIngredientName(ingredient.name)}|${ingredient.portion}`;
      const existing = merged.get(key);
      if (existing) {
        existing.count += servings;
        if (!existing.usedIn.includes(meal.name)) existing.usedIn.push(meal.name);
      } else {
        merged.set(key, {
          id: newId("gi"),
          name: ingredient.name,
          portion: ingredient.portion,
          count: servings,
          quantity: "",
          category: ingredient.groceryCategory,
          usedIn: [meal.name],
          addedBy: "plan",
          required: false,
          state: owned.has(normalizeIngredientName(ingredient.name)) ? "purchased" : "needed",
          carryover: false,
        });
      }
    }
  }

  const categoryOrder = [
    "protein", "produce", "carbohydrates", "fats", "dairy_alternatives",
    "frozen", "pantry", "hydration", "seasonings", "supplements", "prep_supplies",
  ];
  return [...merged.values()]
    .map(({ count, portion, ...item }) => ({
      ...item,
      quantity: count === 1 ? portion : `${portion} × ${count}`,
    }))
    .sort(
      (a, b) =>
        categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category) ||
        a.name.localeCompare(b.name),
    );
}

/* ─── Meal-prep quantities + preparation sequence ─────────────────────── */

export function prepQuantities(
  plan: MealPlan,
  session: Pick<MealPrepSession, "servingsByMeal">,
): Array<{ meal: Meal; servings: number }> {
  return plan.meals
    .map((meal) => ({ meal, servings: session.servingsByMeal[meal.id] ?? 0 }))
    .filter((entry) => entry.servings > 0);
}

/** Deterministic kitchen sequence: preheat → longest cooks → proteins →
    starches → vegetables → portion → cool → store → clean down. */
export function buildPrepSequence(
  plan: MealPlan,
  session: Pick<MealPrepSession, "servingsByMeal">,
): PrepStep[] {
  const entries = prepQuantities(plan, session);
  if (entries.length === 0) return [];
  const byCategory = (categories: string[]) =>
    entries.filter((e) =>
      e.meal.ingredients.some((i) => categories.includes(i.groceryCategory)),
    );
  const proteins = byCategory(["protein", "frozen"]);
  const starches = byCategory(["carbohydrates", "pantry"]);
  const produce = byCategory(["produce"]);

  const steps: PrepStep[] = [];
  let order = 1;
  steps.push({ order: order++, phase: "preheat", instruction: "Preheat oven and clear working surfaces." });
  const longest = entries.find((e) => e.meal.prepInstructions?.toLowerCase().includes("oven"))
    ?? proteins[0] ?? entries[0];
  steps.push({
    order: order++,
    phase: "long_cook",
    instruction: `Begin the longest-cooking item first: ${longest.meal.name} (${longest.servings} serving${longest.servings === 1 ? "" : "s"}).`,
  });
  for (const p of proteins.filter((e) => e !== longest)) {
    steps.push({ order: order++, phase: "protein", instruction: `Prepare protein for ${p.meal.name} — ${p.servings} serving${p.servings === 1 ? "" : "s"}.` });
  }
  for (const s of starches) {
    steps.push({ order: order++, phase: "starch", instruction: `Prepare starches for ${s.meal.name} — ${s.servings} serving${s.servings === 1 ? "" : "s"}.` });
  }
  for (const v of produce) {
    steps.push({ order: order++, phase: "vegetable", instruction: `Prepare vegetables for ${v.meal.name}.` });
  }
  steps.push({ order: order++, phase: "portion", instruction: `Portion all meals into containers (${entries.reduce((s, e) => s + e.servings, 0)} total servings).` });
  steps.push({ order: order++, phase: "cool", instruction: "Cool portions uncovered before sealing." });
  steps.push({ order: order++, phase: "store", instruction: "Store per meal guidance — near-term servings refrigerated, later servings frozen." });
  steps.push({ order: order++, phase: "clean", instruction: "Clean down and note anything that ran short for the grocery carryover." });
  return steps;
}

/* ─── Schedule constraint detection ───────────────────────────────────── */

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Calm, factual observations — never a wall of red alerts. */
export function detectScheduleConstraints(events: LifestyleEvent[]): ScheduleConstraint[] {
  const constraints: ScheduleConstraint[] = [];
  const mk = (
    kind: ScheduleConstraint["kind"],
    day: string,
    headline: string,
    detail: string,
    eventIds: string[],
    severity: ScheduleConstraint["severity"] = "observation",
  ) => constraints.push({ id: `sc:${kind}:${day}:${eventIds.join(".")}`, kind, day, headline, detail, severity, eventIds });

  for (const day of DAYS) {
    const dayEvents = events
      .filter((e) => e.day === day)
      .sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
    if (dayEvents.length === 0) continue;

    /* Overlaps + transitions */
    for (let i = 1; i < dayEvents.length; i += 1) {
      const prev = dayEvents[i - 1];
      const cur = dayEvents[i];
      const gap = timeToMinutes(cur.start) - timeToMinutes(prev.end);
      const needed = (cur.travelBufferMinutes ?? 0) + (cur.prepBufferMinutes ?? 0);
      if (gap < 0) {
        mk("timing_conflict", day, "Timing Conflict",
          `${prev.title} and ${cur.title} overlap by ${Math.abs(gap)} minutes.`,
          [prev.id, cur.id], "attention");
      } else if (gap < needed) {
        mk("insufficient_transition", day, "Insufficient Transition Time",
          `${cur.title} allows ${gap} minutes after ${prev.title}; ${needed} minutes of travel/preparation are planned.`,
          [prev.id, cur.id]);
      }
    }

    /* Training near bedtime + post-training nutrition + sleep opportunity */
    const bedtime = dayEvents.find((e) => e.category === "bedtime");
    const training = dayEvents.filter((e) => e.category === "training");
    for (const t of training) {
      if (bedtime && timeToMinutes(bedtime.start) - timeToMinutes(t.end) < 150) {
        mk("compressed_recovery_window", day, "Compressed Recovery Window",
          `${t.title} ends ${timeToMinutes(bedtime.start) - timeToMinutes(t.end)} minutes before bedtime.`,
          [t.id, bedtime.id]);
      }
      const postMeal = dayEvents.find(
        (e) => e.category === "meal" &&
          timeToMinutes(e.start) >= timeToMinutes(t.end) &&
          timeToMinutes(e.start) - timeToMinutes(t.end) <= 90,
      );
      if (!postMeal) {
        mk("missing_post_training_nutrition", day, "Missing Post-Training Nutrition",
          `No meal is scheduled within 90 minutes after ${t.title}.`, [t.id]);
      }
    }
    const wake = dayEvents.find((e) => e.category === "wake");
    if (wake && bedtime) {
      const sleepOpportunity = 24 * 60 - timeToMinutes(bedtime.start) + timeToMinutes(wake.start);
      if (sleepOpportunity < 7 * 60) {
        mk("insufficient_sleep_opportunity", day, "Insufficient Sleep Opportunity",
          `${Math.floor(sleepOpportunity / 60)}h ${sleepOpportunity % 60}m between bedtime and wake.`,
          [bedtime.id, wake.id], "attention");
      }
    }

    /* Density + prep conflicts */
    const required = dayEvents.filter((e) => e.required);
    if (required.length >= 9) {
      mk("schedule_density_elevated", day, "Schedule Density Elevated",
        `${required.length} required commitments on one day — execution risk rises with density.`,
        required.map((e) => e.id));
    }
    const prep = dayEvents.filter((e) => e.category === "meal_prep");
    for (const p of prep) {
      const clash = dayEvents.find(
        (e) => e.id !== p.id && e.required && e.category !== "meal" &&
          timeToMinutes(e.start) < timeToMinutes(p.end) && timeToMinutes(e.end) > timeToMinutes(p.start),
      );
      if (clash) {
        mk("meal_prep_conflict", day, "Meal-Prep Conflict",
          `${p.title} overlaps ${clash.title} — preparation is unlikely to complete.`,
          [p.id, clash.id], "attention");
      }
    }
  }
  return constraints;
}

/* ─── Daily Directive composer ────────────────────────────────────────── */

export type DirectiveInputs = {
  athleteFirstName: string;
  goal: string;
  phase: string;
  todaySummary: string[]; // e.g. ["Training 6:00 AM — Chest/Back", "5 meals planned"]
  recentAdherencePct: number | null;
  recoveryPosture: "stable" | "declining" | "improving" | "unknown";
  missedActions: string[];
  recentWins: string[];
  friction: string[];
  liveDayChanged: boolean;
  date: string;
};

const TONE_OPENERS: Record<DirectivePreference["tone"], string> = {
  measured: "Today is about exact execution, not intensity for its own sake.",
  stoic: "The plan does not require your enthusiasm. It requires your attendance.",
  direct: "The work today is defined. Do it as written.",
  reassuring: "You are further along than the hard days make it feel. Today only asks for the next step.",
  competitive: "Someone with your goal is executing today. Be the one who executes better.",
  reflective: "Consider what last week rewarded: not heroics — completion.",
  high_accountability: "You set this standard. Today you either meet it or you renegotiate it with yourself honestly.",
};

const FOCUS_LINES: Record<DirectivePreference["focus"], string> = {
  training_execution: "Protect the training window and finish every planned working set with honest effort.",
  nutrition_discipline: "The meals are already decided. Eat what is planned, when it is planned, without negotiation.",
  recovery: "Recovery is the assignment. The disciplined decision is to preserve output for the next block rather than force an unproductive session.",
  consistency: "The week does not require reinvention. It requires completion.",
  confidence: "Execute today like someone who has done this before — because you have.",
  schedule_control: "Own the transitions. The plan fails between commitments, not during them.",
  competition_preparation: "Every choice today either serves the date on the calendar or it does not.",
  lifestyle_order: "Order in the day produces freedom in the training. Keep the anchors fixed.",
};

/**
 * Deterministic composition — synthesizes the athlete's real situation into
 * concise direction. No recycled quotations by default; nothing medical,
 * physique-critical, or shame-based is ever used as leverage.
 */
export function composeDailyDirective(
  inputs: DirectiveInputs,
  prefs: DirectivePreference,
): Pick<DailyDirective, "body" | "basis" | "tone" | "focus"> {
  const basis: string[] = [];
  const lines: string[] = [];

  lines.push(TONE_OPENERS[prefs.tone]);
  basis.push(`Tone: ${prefs.tone}`);

  if (inputs.liveDayChanged) {
    lines.push("Your day has already been recalibrated once — treat the live plan as the plan.");
    basis.push("Live Day changed today");
  }

  lines.push(FOCUS_LINES[prefs.focus]);
  basis.push(`Focus: ${prefs.focus}`);

  if (inputs.todaySummary.length > 0 && prefs.length === "standard") {
    lines.push(`Today holds: ${inputs.todaySummary.slice(0, 3).join(" · ")}.`);
    basis.push("Today's schedule");
  }

  if (inputs.missedActions.length > 0) {
    const softened = prefs.athleteSensitivity === "gentle"
      ? `Yesterday left ${inputs.missedActions.length} item${inputs.missedActions.length === 1 ? "" : "s"} unfinished — today simply picks them back up.`
      : `Close what was left open: ${inputs.missedActions[0]}.`;
    lines.push(softened);
    basis.push("Missed actions");
  } else if (inputs.recentWins.length > 0 && prefs.length === "standard") {
    lines.push(`Momentum is real — ${inputs.recentWins[0]}. Bank another day like it.`);
    basis.push("Recent win");
  }

  if (inputs.recoveryPosture === "declining" && prefs.focus !== "recovery") {
    lines.push("Recovery is trending down. Finish with enough restraint to preserve tomorrow.");
    basis.push("Recovery posture declining");
  }

  const body = (prefs.length === "brief" ? lines.slice(0, 3) : lines.slice(0, 5)).join(" ");
  return { body, basis, tone: prefs.tone, focus: prefs.focus };
}

/* ─── Coach AI drafts (deterministic, editable, approval-required) ────── */

export function draftAdherenceSummary(
  athleteName: string,
  trainingPct: number | null,
  nutritionPct: number | null,
  protocolMarks: { taken: number; skipped: number; unavailable: number },
  mealMarks: { completed: number; partial: number; missed: number },
): Pick<CoachAIDraft, "title" | "body" | "basis"> {
  const lines: string[] = [];
  lines.push(`${athleteName} — adherence summary (drafted for coach review).`);
  if (trainingPct !== null) lines.push(`Training adherence reported at ${trainingPct}%.`);
  if (nutritionPct !== null) lines.push(`Nutrition adherence reported at ${nutritionPct}%.`);
  const totalProtocol = protocolMarks.taken + protocolMarks.skipped + protocolMarks.unavailable;
  if (totalProtocol > 0) {
    lines.push(
      `Protocol log: ${protocolMarks.taken} taken, ${protocolMarks.skipped} skipped, ${protocolMarks.unavailable} unavailable across ${totalProtocol} entries.`,
    );
  }
  const totalMeals = mealMarks.completed + mealMarks.partial + mealMarks.missed;
  if (totalMeals > 0) {
    lines.push(`Meal log: ${mealMarks.completed} completed, ${mealMarks.partial} partial, ${mealMarks.missed} missed.`);
  }
  if (totalProtocol === 0 && totalMeals === 0) lines.push("No operational logs recorded this period.");
  return {
    title: `Adherence summary — ${athleteName}`,
    body: lines.join("\n"),
    basis: ["Check-in adherence", "Protocol adherence entries", "Meal completion log"],
  };
}

export function draftScheduleFriction(
  athleteName: string,
  constraints: ScheduleConstraint[],
): Pick<CoachAIDraft, "title" | "body" | "basis"> {
  const lines =
    constraints.length === 0
      ? [`${athleteName}'s week shows no structural friction — the schedule is executable as written.`]
      : [
          `${athleteName} — schedule friction (drafted for coach review).`,
          ...constraints.slice(0, 6).map((c) => `${c.day}: ${c.headline} — ${c.detail}`),
        ];
  return {
    title: `Schedule friction — ${athleteName}`,
    body: lines.join("\n"),
    basis: ["Lifestyle week", "Constraint detection"],
  };
}
