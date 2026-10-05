/* ════════════════════════════════════════════════════════════════════════
   PRE-WORKOUT SHAKE SLOT — food only.

   The optional slot the schedule engine offers before a session the member
   trains fasted or light (see buildMealPlan). It is built from kitchen food
   only: water, a pinch of salt, citrus, coconut water, beet juice, and — only
   when the member chose "light" — a little honey or fruit. Food amounts are
   shown like any other plate in the app.

   Compliance (CLAUDE.md): no supplement, compound or powder is ever named,
   suggested, amounted or timed here. The one line about the member's own
   Supplement Logbook says only that what they already log is their own call.
   ════════════════════════════════════════════════════════════════════════ */

export type PreWorkoutShakeStyle = "fasted" | "light";

export type PreWorkoutShake = {
  id: string;
  name: string;
  style: PreWorkoutShakeStyle;
  ingredients: string[];
  ingredientsDetailed: Array<{ name: string; amount: string; group?: "carb" | "produce" | "finish"; note?: string }>;
  macros: { calories: number; proteinG: number; carbsG: number; fatG: number };
  smartRead: string;
};

/** Said once, neutrally, on every shake: no suggestion, no amount, no timing. */
export const OWN_LOG_LINE = "Anything already in your Supplement Logbook is your own call — Reserve doesn't add to it or time it.";

const SALTED_CITRUS_WATER: PreWorkoutShake = {
  id: "salted-citrus-water",
  name: "Salted Citrus Water",
  style: "fasted",
  ingredients: ["cold water", "pinch of sea salt", "squeeze of lemon or lime"],
  ingredientsDetailed: [
    { name: "cold water", amount: "16 oz" },
    { name: "pinch of sea salt", amount: "pinch", group: "finish" },
    { name: "lemon or lime", amount: "½ fruit, squeezed", group: "produce" },
  ],
  macros: { calories: 5, proteinG: 0, carbsG: 1, fatG: 0 },
  smartRead: `You train fasted, so nothing here is a meal. Cold water with a pinch of salt and citrus is here if you want something before the session — skip it and nothing is missed. ${OWN_LOG_LINE}`,
};

const BEET_COCONUT_SHAKE: PreWorkoutShake = {
  id: "beet-coconut-shake",
  name: "Beet & Coconut Water Shake",
  style: "light",
  ingredients: ["coconut water", "beet juice", "squeeze of lime", "pinch of sea salt", "honey or ½ banana"],
  ingredientsDetailed: [
    { name: "coconut water", amount: "12 oz", group: "carb" },
    { name: "beet juice", amount: "4 oz", group: "produce", note: "or ½ cooked beet, blended" },
    { name: "lime", amount: "½ fruit, squeezed", group: "produce" },
    { name: "pinch of sea salt", amount: "pinch", group: "finish" },
    { name: "honey or ripe banana", amount: "1 tsp honey or ½ banana", group: "carb" },
  ],
  macros: { calories: 130, proteinG: 2, carbsG: 30, fatG: 0 },
  smartRead: `A light, food-only shake: coconut water and beet juice, citrus, a pinch of salt, and a little honey or banana. Blend with ice. Skip it and nothing is missed. ${OWN_LOG_LINE}`,
};

/** Citrus water stands in when the member avoids a food in the light shake. */
const LIGHT_WITHOUT_COCONUT: PreWorkoutShake = {
  ...BEET_COCONUT_SHAKE,
  id: "beet-citrus-shake",
  name: "Beet & Citrus Water Shake",
  ingredients: ["cold water", "beet juice", "squeeze of lime", "pinch of sea salt", "honey or ½ banana"],
  ingredientsDetailed: [
    { name: "cold water", amount: "12 oz" },
    ...BEET_COCONUT_SHAKE.ingredientsDetailed.slice(1),
  ],
  macros: { calories: 85, proteinG: 1, carbsG: 20, fatG: 0 },
};

export const PRE_WORKOUT_SHAKES: readonly PreWorkoutShake[] = [SALTED_CITRUS_WATER, BEET_COCONUT_SHAKE, LIGHT_WITHOUT_COCONUT];

function avoids(avoid: readonly string[], ingredients: readonly string[]): boolean {
  const norm = (s: string) => s.toLowerCase().trim();
  return avoid.some((a) => a.trim() && ingredients.some((ing) => norm(ing).includes(norm(a))));
}

/** The shake for the member's pre-workout choice, honouring foods they avoid. */
export function buildPreWorkoutShake(
  style: PreWorkoutShakeStyle,
  personalization: { allergies?: string[]; dislikedFoods?: string[] } = {},
): PreWorkoutShake {
  if (style === "fasted") return SALTED_CITRUS_WATER;
  const avoid = [...(personalization.allergies ?? []), ...(personalization.dislikedFoods ?? [])];
  if (!avoids(avoid, BEET_COCONUT_SHAKE.ingredients)) return BEET_COCONUT_SHAKE;
  if (!avoids(avoid, LIGHT_WITHOUT_COCONUT.ingredients)) return LIGHT_WITHOUT_COCONUT;
  return SALTED_CITRUS_WATER;
}
