/* ════════════════════════════════════════════════════════════════════════
   PEAK SIGNATURES — Reserve's signature plates for each Peak Mode look.

   Every plate is whole foods with gram weights, and its macros are COMPUTED
   from a per-100 g food table (standard USDA FoodData Central values,
   rounded) — never typed in by hand. Portions scale to the member's own
   targets for that meal.

   Compound areas: when the member's compounds affect cholesterol, heart and
   blood pressure, or blood sugar, plates that fit the public guidance for
   that area come first (low saturated fat and soluble fiber for cholesterol, the
   DASH pattern for blood pressure, fiber and no added sugar for blood
   sugar). All compounds count together. This is food that fits guidance for
   a body area — never a diet designed around a compound, and never a claim
   that food offsets what a compound does.
   ════════════════════════════════════════════════════════════════════════ */

import type { ProfileSource } from "@/lib/compound-intelligence/risk-profiles";
import type { SupportArea } from "@/lib/compound-intelligence/support-options";

import type { DetailedIngredient, FuelMacros, IngredientGroup, MealSlot } from "./fuel-plan";
import type { PeakLook } from "./peak-mode";

/* ─── Food table: per 100 g as eaten (cooked unless marked dry) ─────────── */

type Per100 = { kcal: number; p: number; c: number; f: number };

export const PEAK_FOODS = {
  "chicken breast": { kcal: 165, p: 31, c: 0, f: 3.6 },
  "99% lean ground turkey": { kcal: 130, p: 28, c: 0, f: 2 },
  /* "wild salmon" is wild coho; pink is leaner, farmed Atlantic fattier. Cooked, dry heat. */
  "wild pink salmon": { kcal: 153, p: 24.6, c: 0, f: 5.3 },
  "wild salmon": { kcal: 182, p: 25, c: 0, f: 8 },
  "farmed Atlantic salmon": { kcal: 206, p: 22.1, c: 0, f: 12.4 },
  cod: { kcal: 105, p: 23, c: 0, f: 0.9 },
  shrimp: { kcal: 99, p: 24, c: 0.2, f: 0.3 },
  tilapia: { kcal: 128, p: 26, c: 0, f: 2.7 },
  /* Steak cuts, lean trimmed, broiled — leanest to fattiest. */
  "eye of round steak": { kcal: 158, p: 28.8, c: 0, f: 4 },
  "top round steak": { kcal: 170, p: 31.5, c: 0, f: 4.2 },
  "top sirloin, trimmed": { kcal: 160, p: 30, c: 0, f: 4.5 },
  "flank steak": { kcal: 192, p: 27.7, c: 0, f: 8.2 },
  "tenderloin filet": { kcal: 196, p: 28.5, c: 0, f: 8.4 },
  "strip steak": { kcal: 199, p: 27.5, c: 0, f: 9.1 },
  "ribeye steak": { kcal: 291, p: 24, c: 0, f: 21 },
  bison: { kcal: 143, p: 28, c: 0, f: 2.4 },
  "egg whites": { kcal: 52, p: 11, c: 0.7, f: 0.2 },
  "whole eggs": { kcal: 143, p: 13, c: 0.7, f: 9.5 },
  "nonfat Greek yogurt": { kcal: 59, p: 10, c: 3.6, f: 0.4 },
  "1% cottage cheese": { kcal: 72, p: 12, c: 2.7, f: 1 },
  "whey isolate": { kcal: 370, p: 86, c: 3, f: 1.5 },
  "cream of rice (dry)": { kcal: 370, p: 6, c: 82, f: 0.5 },
  "rolled oats (dry)": { kcal: 379, p: 13, c: 68, f: 6.5 },
  "jasmine rice": { kcal: 130, p: 2.7, c: 28, f: 0.3 },
  "chickpea protein pasta (dry)": { kcal: 340, p: 20, c: 57, f: 6 },
  "brown rice": { kcal: 123, p: 2.7, c: 26, f: 1 },
  "basmati rice": { kcal: 121, p: 3.5, c: 25, f: 0.4 },
  pasta: { kcal: 158, p: 5.8, c: 31, f: 0.9 },
  "whole wheat pasta": { kcal: 149, p: 6, c: 30, f: 1.7 },
  couscous: { kcal: 112, p: 3.8, c: 23, f: 0.2 },
  "rice noodles": { kcal: 108, p: 1.8, c: 24, f: 0.2 },
  "corn tortillas": { kcal: 218, p: 5.7, c: 45, f: 2.9 },
  "red potatoes": { kcal: 89, p: 2.3, c: 20, f: 0.2 },
  /* Ground meats by lean-to-fat ratio, cooked and pan-browned. */
  "96/4 ground beef": { kcal: 160, p: 27.5, c: 0, f: 5.5 },
  "93% lean ground beef": { kcal: 196, p: 27, c: 0, f: 9.7 },
  "90/10 ground beef": { kcal: 217, p: 26.1, c: 0, f: 11.7 },
  "85/15 ground beef": { kcal: 250, p: 25.9, c: 0, f: 15.6 },
  "80/20 ground beef": { kcal: 272, p: 25.9, c: 0, f: 17.9 },
  "90/10 ground bison": { kcal: 179, p: 25.4, c: 0, f: 8.6 },
  "85/15 ground bison": { kcal: 238, p: 23.8, c: 0, f: 15.2 },
  "93/7 ground turkey": { kcal: 213, p: 27.1, c: 0, f: 11.6 },
  "chicken drumsticks, skinless": { kcal: 172, p: 28.3, c: 0, f: 5.7 },
  "chicken thighs, skinless": { kcal: 179, p: 24.8, c: 0, f: 8.2 },
  "chicken thighs, skin on": { kcal: 232, p: 23, c: 0, f: 15.5 },
  "pork tenderloin": { kcal: 143, p: 26, c: 0, f: 3.5 },
  "pork loin chop": { kcal: 190, p: 27, c: 0, f: 8.6 },
  "ground pork": { kcal: 297, p: 25.7, c: 0, f: 20.8 },
  "ahi tuna": { kcal: 130, p: 29, c: 0, f: 0.6 },
  "extra-firm tofu": { kcal: 144, p: 17.3, c: 2.8, f: 8.7 },
  tempeh: { kcal: 192, p: 20.3, c: 7.6, f: 10.8 },
  quinoa: { kcal: 120, p: 4.4, c: 21, f: 1.9 },
  "sweet potato": { kcal: 90, p: 2, c: 21, f: 0.2 },
  "gold potatoes": { kcal: 93, p: 2.5, c: 21, f: 0.1 },
  sourdough: { kcal: 260, p: 10, c: 50, f: 2 },
  "rice cakes": { kcal: 387, p: 8, c: 82, f: 3 },
  "black beans": { kcal: 132, p: 8.9, c: 24, f: 0.5 },
  lentils: { kcal: 116, p: 9, c: 20, f: 0.4 },
  banana: { kcal: 89, p: 1.1, c: 23, f: 0.3 },
  blueberries: { kcal: 57, p: 0.7, c: 14, f: 0.3 },
  strawberries: { kcal: 32, p: 0.7, c: 7.7, f: 0.3 },
  raspberries: { kcal: 52, p: 1.2, c: 12, f: 0.7 },
  apple: { kcal: 52, p: 0.3, c: 14, f: 0.2 },
  pineapple: { kcal: 50, p: 0.5, c: 13, f: 0.1 },
  mango: { kcal: 60, p: 0.8, c: 15, f: 0.4 },
  kiwi: { kcal: 61, p: 1.1, c: 15, f: 0.5 },
  "medjool dates": { kcal: 277, p: 1.8, c: 75, f: 0.2 },
  spinach: { kcal: 23, p: 2.9, c: 3.6, f: 0.4 },
  broccoli: { kcal: 35, p: 2.4, c: 7, f: 0.4 },
  asparagus: { kcal: 22, p: 2.4, c: 4, f: 0.2 },
  "bell peppers": { kcal: 26, p: 1, c: 6, f: 0.3 },
  "mixed greens": { kcal: 20, p: 1.5, c: 3.5, f: 0.3 },
  zucchini: { kcal: 17, p: 1.2, c: 3, f: 0.3 },
  avocado: { kcal: 160, p: 2, c: 8.5, f: 14.7 },
  "extra virgin olive oil": { kcal: 884, p: 0, c: 0, f: 100 },
  almonds: { kcal: 579, p: 21, c: 22, f: 50 },
  walnuts: { kcal: 654, p: 15, c: 14, f: 65 },
  "chia seeds": { kcal: 486, p: 17, c: 42, f: 31 },
  honey: { kcal: 304, p: 0.3, c: 82, f: 0 },
  /* Unsweetened cocoa powder and plain peanut butter (USDA FoodData Central). */
  "unsweetened cocoa powder": { kcal: 228, p: 19.6, c: 57.9, f: 13.7 },
  "peanut butter": { kcal: 588, p: 25, c: 20, f: 50 },
  "coconut aminos": { kcal: 100, p: 0, c: 20, f: 0 },
  salsa: { kcal: 36, p: 1.5, c: 7, f: 0.2 },
} satisfies Record<string, Per100>;

export type PeakFood = keyof typeof PEAK_FOODS;

/** `fixed` keeps a counted food whole (eggs, slices, cakes) when the plate scales. */
type Portion = { food: PeakFood; grams: number; group: IngredientGroup; note?: string; fixed?: true } | { name: string; amount: string; group: IngredientGroup };

/* ─── Areas food guidance speaks to ─────────────────────────────────────── */

export type FitArea = Extract<SupportArea, "lipids" | "cardiovascular" | "metabolic">;

export const FIT_SOURCES: Record<FitArea, ProfileSource[]> = {
  lipids: [
    { label: "American Heart Association: Saturated fat", url: "https://www.heart.org/en/healthy-living/healthy-eating/eat-smart/fats/saturated-fats" },
    { label: "U.S. Departments of Agriculture and Health and Human Services: Dietary Guidelines for Americans, 2020–2025", url: "https://www.dietaryguidelines.gov" },
  ],
  cardiovascular: [
    { label: "NIH National Heart, Lung, and Blood Institute: DASH eating plan", url: "https://www.nhlbi.nih.gov/education/dash-eating-plan" },
  ],
  metabolic: [
    { label: "U.S. Departments of Agriculture and Health and Human Services: Dietary Guidelines for Americans, 2020–2025", url: "https://www.dietaryguidelines.gov" },
  ],
};

export type PeakSignature = {
  id: string;
  name: string;
  slot: MealSlot;
  looks: PeakLook[];
  portions: Portion[];
  /** Why the plate fits public guidance for an area — shown only when the member's compounds affect it. */
  fits: Partial<Record<FitArea, string>>;
  smartRead: string;
};

const ALL: PeakLook[] = ["lean-hard", "full-hard", "recomp"];
const t = (name: string, group: IngredientGroup = "finish") => ({ name, amount: "to taste", group });

export const PEAK_SIGNATURES: readonly PeakSignature[] = [
  /* ── Breakfast ── */
  {
    id: "peak-oats-whey-berries", name: "Oats, Whey & Blueberries", slot: "breakfast", looks: ALL,
    portions: [{ food: "rolled oats (dry)", grams: 60, group: "carb" }, { food: "whey isolate", grams: 30, group: "protein", note: "stirred in after cooking" }, { food: "blueberries", grams: 100, group: "produce" }, { food: "chia seeds", grams: 10, group: "fat" }, t("cinnamon")],
    fits: { lipids: "oats carry soluble fiber, which lowers LDL cholesterol", metabolic: "whole-grain oats and fruit, no added sugar" },
    smartRead: "Slow oats and fast whey: steady carbs for the morning with a full protein hit.",
  },
  {
    id: "peak-egg-white-scramble", name: "Egg White & Spinach Scramble", slot: "breakfast", looks: ["lean-hard", "recomp"],
    portions: [{ food: "egg whites", grams: 250, group: "protein" }, { food: "whole eggs", grams: 50, group: "protein", note: "1 egg", fixed: true }, { food: "spinach", grams: 60, group: "produce" }, { food: "bell peppers", grams: 60, group: "produce" }, { food: "sourdough", grams: 45, group: "carb", note: "1 slice", fixed: true }, { food: "strawberries", grams: 100, group: "produce" }],
    fits: { lipids: "mostly egg whites, so saturated fat stays low", cardiovascular: "vegetables and fruit on the plate, the DASH pattern" },
    smartRead: "High protein, low fat, a single slice of sourdough — built for a deficit.",
  },
  {
    id: "peak-cream-of-rice-morning", name: "Cream of Rice Morning Build", slot: "breakfast", looks: ["full-hard"],
    portions: [{ food: "cream of rice (dry)", grams: 60, group: "carb" }, { food: "egg whites", grams: 200, group: "protein" }, { food: "whole eggs", grams: 100, group: "protein", note: "2 eggs", fixed: true }, { food: "banana", grams: 120, group: "produce" }, { food: "honey", grams: 10, group: "finish" }, t("cinnamon")],
    fits: {},
    smartRead: "Easy-digesting carbs and eggs to start a high-carb day full.",
  },
  {
    id: "peak-steak-eggs-potatoes", name: "Steak & Eggs with Gold Potatoes", slot: "breakfast", looks: ["full-hard"],
    portions: [{ food: "top sirloin, trimmed", grams: 150, group: "protein" }, { food: "whole eggs", grams: 100, group: "protein", note: "2 eggs", fixed: true }, { food: "gold potatoes", grams: 200, group: "carb" }, { food: "spinach", grams: 60, group: "produce" }, { food: "extra virgin olive oil", grams: 5, group: "fat" }, t("sea salt and pepper")],
    fits: { cardiovascular: "potassium-rich potatoes and greens, with nothing salty added" },
    smartRead: "The classic full-look breakfast: whole eggs and steak with a real carb behind them.",
  },
  {
    id: "peak-protein-french-toast", name: "Protein French Toast & Banana", slot: "breakfast", looks: ["full-hard", "recomp"],
    portions: [{ food: "sourdough", grams: 90, group: "carb", note: "2 slices", fixed: true }, { food: "egg whites", grams: 150, group: "protein" }, { food: "whole eggs", grams: 50, group: "protein", note: "1 egg", fixed: true }, { food: "banana", grams: 120, group: "produce" }, { food: "honey", grams: 15, group: "finish" }, t("cinnamon and vanilla")],
    fits: {},
    smartRead: "Sourdough soaked in egg, cooked like French toast, with banana and a little honey for the carbs.",
  },
  {
    id: "peak-breakfast-burrito-bowl", name: "Breakfast Burrito Bowl", slot: "breakfast", looks: ["full-hard", "recomp"],
    portions: [{ food: "99% lean ground turkey", grams: 150, group: "protein" }, { food: "whole eggs", grams: 100, group: "protein", note: "2 eggs", fixed: true }, { food: "corn tortillas", grams: 60, group: "carb", note: "2 tortillas", fixed: true }, { food: "bell peppers", grams: 60, group: "produce" }, { food: "avocado", grams: 30, group: "fat" }, { food: "salsa", grams: 40, group: "finish" }],
    fits: { lipids: "lean turkey with avocado as the fat" },
    smartRead: "Savory start with peppers and salsa, built around eggs and lean turkey.",
  },
  {
    id: "peak-oat-pancakes", name: "Oat Pancakes & Greek Yogurt", slot: "breakfast", looks: ["full-hard", "recomp"],
    portions: [{ food: "rolled oats (dry)", grams: 80, group: "carb" }, { food: "egg whites", grams: 200, group: "protein" }, { food: "nonfat Greek yogurt", grams: 150, group: "protein" }, { food: "blueberries", grams: 80, group: "produce" }, { food: "honey", grams: 10, group: "finish" }, t("cinnamon")],
    fits: { lipids: "oats carry soluble fiber, which lowers LDL cholesterol", metabolic: "whole-grain oats and fruit rather than a sugary pancake mix" },
    smartRead: "Blend the oats and whites into a batter; yogurt and berries go on top instead of syrup.",
  },
  {
    id: "peak-yogurt-walnut-kiwi", name: "Greek Yogurt, Walnuts & Kiwi", slot: "breakfast", looks: ["lean-hard", "recomp"],
    portions: [{ food: "nonfat Greek yogurt", grams: 300, group: "protein" }, { food: "walnuts", grams: 15, group: "fat" }, { food: "kiwi", grams: 150, group: "produce" }, { food: "chia seeds", grams: 8, group: "fat" }],
    fits: { lipids: "walnuts and chia bring plant omega-3 fats with little saturated fat", metabolic: "fiber from kiwi and chia, no added sugar" },
    smartRead: "No-cook, high protein, with fats that lean unsaturated.",
  },

  /* ── Lunch ── */
  {
    id: "peak-pineapple-chicken-jasmine", name: "Pineapple Chicken & Jasmine Rice", slot: "lunch", looks: ALL,
    portions: [{ food: "chicken breast", grams: 180, group: "protein" }, { food: "jasmine rice", grams: 180, group: "carb" }, { food: "pineapple", grams: 100, group: "produce" }, { food: "bell peppers", grams: 75, group: "produce" }, { food: "coconut aminos", grams: 15, group: "finish" }],
    fits: { lipids: "lean poultry keeps saturated fat low", cardiovascular: "coconut aminos season it with less sodium than soy sauce" },
    smartRead: "Lean chicken and rice with pineapple and peppers for vitamin C.",
  },
  {
    id: "peak-turkey-sweet-potato", name: "Turkey & Sweet Potato Power Bowl", slot: "lunch", looks: ["lean-hard", "recomp"],
    portions: [{ food: "99% lean ground turkey", grams: 200, group: "protein" }, { food: "sweet potato", grams: 200, group: "carb" }, { food: "broccoli", grams: 120, group: "produce" }, { food: "avocado", grams: 30, group: "fat" }, { food: "salsa", grams: 40, group: "finish" }],
    fits: { lipids: "very lean turkey with avocado's unsaturated fat", cardiovascular: "sweet potato and broccoli are potassium-rich, the DASH pattern" },
    smartRead: "Big volume for the calories: lean turkey, sweet potato and a full serving of greens.",
  },
  {
    id: "peak-bison-quinoa", name: "Bison, Quinoa & Black Bean Bowl", slot: "lunch", looks: ["full-hard", "recomp"],
    portions: [{ food: "bison", grams: 200, group: "protein" }, { food: "quinoa", grams: 200, group: "carb" }, { food: "black beans", grams: 80, group: "carb" }, { food: "bell peppers", grams: 75, group: "produce" }, { food: "avocado", grams: 40, group: "fat" }],
    fits: { lipids: "bison is leaner than most beef, and beans add soluble fiber", metabolic: "beans and quinoa bring fiber that slows carb absorption" },
    smartRead: "Red meat iron and zinc with a lean profile, and slow carbs for a long afternoon.",
  },
  {
    id: "peak-chicken-lentils", name: "Lemon Chicken & Lentil Plate", slot: "lunch", looks: ["lean-hard"],
    portions: [{ food: "chicken breast", grams: 180, group: "protein" }, { food: "lentils", grams: 150, group: "carb" }, { food: "spinach", grams: 60, group: "produce" }, { food: "extra virgin olive oil", grams: 5, group: "fat" }, t("lemon and herbs")],
    fits: { lipids: "lentils carry soluble fiber; olive oil is the fat", metabolic: "lentils are high-fiber, slow carbs", cardiovascular: "legumes, greens and olive oil, the DASH pattern" },
    smartRead: "Lentils do double duty as carb and extra protein, with fiber that keeps you full on a cut.",
  },

  /* ── Pre-workout ── */
  {
    id: "peak-rice-cakes-banana", name: "Rice Cakes, Banana, Honey & Whey", slot: "pre-workout", looks: ALL,
    portions: [{ food: "rice cakes", grams: 27, group: "carb", note: "3 cakes", fixed: true }, { food: "banana", grams: 120, group: "produce" }, { food: "honey", grams: 10, group: "finish" }, { food: "whey isolate", grams: 30, group: "protein", note: "shaken with water" }],
    fits: {},
    smartRead: "Fast carbs and fast protein with almost no fat or fiber, so it sits light before a session.",
  },
  {
    id: "peak-cream-of-rice-pre", name: "Cream of Rice & Dates Pre-Session", slot: "pre-workout", looks: ["full-hard"],
    portions: [{ food: "cream of rice (dry)", grams: 50, group: "carb" }, { food: "egg whites", grams: 150, group: "protein" }, { food: "medjool dates", grams: 30, group: "produce", note: "about 1–2 dates" }],
    fits: {},
    smartRead: "A bigger carb load for a full-look training day, still easy on the stomach.",
  },

  /* ── Post-workout ── */
  {
    id: "peak-cream-of-rice-recovery-bowl", name: "Cream of Rice Recovery Bowl", slot: "post-workout", looks: ALL,
    portions: [{ food: "cream of rice (dry)", grams: 50, group: "carb", note: "cooked" }, { food: "nonfat Greek yogurt", grams: 170, group: "protein" }, { food: "whey isolate", grams: 30, group: "protein", note: "stirred in once the rice cools slightly" }, { food: "blueberries", grams: 80, group: "produce", note: "frozen" }, { food: "banana", grams: 120, group: "produce" }, { food: "honey", grams: 10, group: "finish" }, t("cinnamon")],
    fits: {},
    smartRead: "Fast carbs and fast protein with almost no fat, so it digests quickly after training.",
  },
  {
    id: "peak-pineapple-shrimp", name: "Pineapple Shrimp & Jasmine Bowl", slot: "post-workout", looks: ["lean-hard", "recomp"],
    portions: [{ food: "shrimp", grams: 200, group: "protein" }, { food: "jasmine rice", grams: 200, group: "carb" }, { food: "pineapple", grams: 120, group: "produce" }, { food: "bell peppers", grams: 60, group: "produce" }, { food: "coconut aminos", grams: 15, group: "finish" }],
    fits: { lipids: "shrimp is very low in saturated fat", cardiovascular: "seasoned with coconut aminos instead of soy sauce" },
    smartRead: "Near-zero-fat seafood and white rice: a fast, light refuel.",
  },
  {
    id: "peak-sirloin-potato-mango", name: "Sirloin, Gold Potatoes & Mango", slot: "post-workout", looks: ["full-hard"],
    portions: [{ food: "top sirloin, trimmed", grams: 200, group: "protein" }, { food: "gold potatoes", grams: 300, group: "carb" }, { food: "asparagus", grams: 100, group: "produce" }, { food: "mango", grams: 120, group: "produce" }],
    fits: { cardiovascular: "potatoes are potassium-rich, and nothing salty is added" },
    smartRead: "A big carb refill with trimmed red meat for iron and zinc.",
  },

  /* ── Dinner ── */
  {
    id: "peak-salmon-jasmine-asparagus", name: "Salmon, Jasmine Rice & Asparagus", slot: "dinner", looks: ["full-hard", "recomp"],
    portions: [{ food: "wild salmon", grams: 170, group: "protein" }, { food: "jasmine rice", grams: 150, group: "carb" }, { food: "asparagus", grams: 120, group: "produce" }, t("lemon and dill")],
    fits: { lipids: "fatty fish brings omega-3 fats with little saturated fat", cardiovascular: "fish, a grain and vegetables, the DASH pattern" },
    smartRead: "Omega-3 fats from salmon with a moderate carb serving to close the day.",
  },
  {
    id: "peak-cod-sweet-potato", name: "Cod, Sweet Potato & Greens", slot: "dinner", looks: ["lean-hard", "recomp"],
    portions: [{ food: "cod", grams: 220, group: "protein" }, { food: "sweet potato", grams: 150, group: "carb" }, { food: "mixed greens", grams: 80, group: "produce" }, { food: "extra virgin olive oil", grams: 7, group: "fat" }],
    fits: { lipids: "white fish with olive oil keeps saturated fat low", cardiovascular: "potassium-rich sweet potato and greens" },
    smartRead: "Very lean protein and a modest carb — light before bed.",
  },
  {
    id: "peak-tilapia-quinoa", name: "Tilapia, Quinoa & Zucchini", slot: "dinner", looks: ["lean-hard", "recomp"],
    portions: [{ food: "tilapia", grams: 200, group: "protein" }, { food: "quinoa", grams: 120, group: "carb" }, { food: "zucchini", grams: 150, group: "produce" }, { food: "extra virgin olive oil", grams: 5, group: "fat" }],
    fits: { lipids: "lean fish and olive oil", metabolic: "quinoa is a whole grain with fiber" },
    smartRead: "Lean and simple, with a whole grain that holds you through the night.",
  },
  {
    id: "peak-turkey-rice-dinner", name: "Turkey, Rice & Broccoli", slot: "dinner", looks: ["full-hard"],
    portions: [{ food: "99% lean ground turkey", grams: 200, group: "protein" }, { food: "jasmine rice", grams: 220, group: "carb" }, { food: "broccoli", grams: 120, group: "produce" }, { food: "avocado", grams: 40, group: "fat" }],
    fits: { lipids: "very lean turkey with avocado as the fat" },
    smartRead: "Carbs stay high into the evening to keep the full look.",
  },

  {
    id: "peak-cream-rice-drip-breakfast", name: "Cream of Rice Protein Bowl, Protein Drip", slot: "breakfast", looks: ALL,
    portions: [
      { food: "cream of rice (dry)", grams: 55, group: "carb", note: "cooked loose, not stiff" },
      { food: "whey isolate", grams: 35, group: "protein", note: "whisked with water into a thin drip, poured over once the bowl stops steaming" },
      { food: "banana", grams: 100, group: "produce", note: "sliced on top" },
      { food: "blueberries", grams: 80, group: "produce", note: "frozen, stirred through" },
      { food: "honey", grams: 10, group: "finish" },
      t("cinnamon"),
      t("sea salt"),
    ],
    fits: {},
    smartRead: "The daily bowl: cream of rice cooked loose, a thin protein drip poured over off the heat so it stays smooth, fruit and a little honey.",
  },
  {
    id: "peak-cream-rice-drip-post", name: "Post-Workout Cream of Rice, Protein Drip", slot: "post-workout", looks: ALL,
    portions: [
      { food: "cream of rice (dry)", grams: 60, group: "carb", note: "cooked loose" },
      { food: "whey isolate", grams: 40, group: "protein", note: "whisked thin and drizzled over once it cools slightly" },
      { food: "banana", grams: 120, group: "produce" },
      { food: "honey", grams: 12, group: "finish" },
      t("sea salt"),
    ],
    fits: {},
    smartRead: "Fast carbs and a protein drip straight after a session, with salt back on board.",
  },

  /* ── Snack ── */
  {
    id: "peak-cottage-pineapple", name: "Cottage Cheese, Pineapple & Cinnamon", slot: "snack", looks: ["lean-hard", "recomp"],
    portions: [{ food: "1% cottage cheese", grams: 225, group: "protein" }, { food: "pineapple", grams: 100, group: "produce" }, t("cinnamon")],
    fits: { lipids: "low-fat dairy keeps saturated fat low" },
    smartRead: "Slow casein protein with a little fruit.",
  },
  {
    id: "peak-yogurt-almond-strawberry", name: "Greek Yogurt, Almonds & Strawberries", slot: "snack", looks: ["full-hard", "recomp"],
    portions: [{ food: "nonfat Greek yogurt", grams: 250, group: "protein" }, { food: "almonds", grams: 20, group: "fat" }, { food: "strawberries", grams: 120, group: "produce" }, { food: "honey", grams: 8, group: "finish" }],
    fits: { lipids: "almonds' fats are mostly unsaturated" },
    smartRead: "Protein, crunch and fruit between meals.",
  },
  {
    id: "peak-choc-cream-rice-bowl", name: "Chocolate Cream of Rice Protein Bowl", slot: "snack", looks: ALL,
    portions: [
      { food: "cream of rice (dry)", grams: 40, group: "carb", note: "cooked with water" },
      { food: "whey isolate", grams: 30, group: "protein", note: "chocolate, stirred in off the heat" },
      { food: "unsweetened cocoa powder", grams: 6, group: "finish" },
      { food: "banana", grams: 60, group: "produce", note: "sliced on top" },
      t("sea salt"),
    ],
    fits: {},
    smartRead: "Warm, chocolate and fast-digesting: a between-meals bowl that eats like dessert.",
  },
  {
    id: "peak-apple-cinnamon-cream-rice", name: "Apple Cinnamon Cream of Rice", slot: "snack", looks: ALL,
    portions: [
      { food: "cream of rice (dry)", grams: 40, group: "carb", note: "cooked with water" },
      { food: "whey isolate", grams: 25, group: "protein", note: "vanilla, stirred in off the heat" },
      { food: "apple", grams: 120, group: "produce", note: "diced and warmed" },
      t("cinnamon"),
    ],
    fits: {},
    smartRead: "Warm apple and cinnamon over a light, quick carb with protein folded in.",
  },
  {
    id: "peak-blueberry-protein-oats", name: "Blueberry Cinnamon Protein Oats", slot: "snack", looks: ALL,
    portions: [
      { food: "rolled oats (dry)", grams: 40, group: "carb", note: "cooked or overnight" },
      { food: "whey isolate", grams: 25, group: "protein", note: "stirred in once cooked" },
      { food: "blueberries", grams: 80, group: "produce", note: "frozen" },
      t("cinnamon"),
    ],
    fits: { lipids: "oats' soluble fiber lowers LDL cholesterol" },
    smartRead: "Slow oats, berries and protein: steady energy between meals.",
  },
  {
    id: "peak-pb-banana-oats", name: "Peanut Butter Banana Protein Oats", slot: "snack", looks: ["full-hard", "recomp"],
    portions: [
      { food: "rolled oats (dry)", grams: 50, group: "carb" },
      { food: "whey isolate", grams: 25, group: "protein", note: "stirred in once cooked" },
      { food: "banana", grams: 100, group: "produce" },
      { food: "peanut butter", grams: 16, group: "fat", note: "1 level tablespoon" },
    ],
    fits: {},
    smartRead: "A fuller bowl for the full look: oats, banana and a measured spoon of peanut butter.",
  },
  {
    id: "peak-choc-yogurt-pudding", name: "Chocolate Greek Yogurt Pudding", slot: "snack", looks: ["lean-hard", "recomp"],
    portions: [
      { food: "nonfat Greek yogurt", grams: 200, group: "protein" },
      { food: "whey isolate", grams: 15, group: "protein", note: "chocolate, whisked in" },
      { food: "unsweetened cocoa powder", grams: 6, group: "finish" },
      { food: "strawberries", grams: 100, group: "produce" },
    ],
    fits: { lipids: "nonfat dairy keeps saturated fat low" },
    smartRead: "Thick, chocolate and high in protein, with almost no fat.",
  },
  {
    id: "peak-berry-yogurt-parfait", name: "Greek Yogurt Berry Parfait", slot: "snack", looks: ALL,
    portions: [
      { food: "nonfat Greek yogurt", grams: 220, group: "protein" },
      { food: "blueberries", grams: 60, group: "produce" },
      { food: "raspberries", grams: 60, group: "produce" },
      { food: "chia seeds", grams: 10, group: "fat" },
      { food: "honey", grams: 8, group: "finish" },
    ],
    fits: { lipids: "chia adds fiber and unsaturated fat" },
    smartRead: "Layered yogurt, berries and chia: protein and fiber that hold you to the next meal.",
  },
  {
    id: "peak-rice-cake-pb-honey", name: "Rice Cakes, Peanut Butter & Honey", slot: "snack", looks: ["full-hard"],
    portions: [
      { food: "rice cakes", grams: 27, group: "carb", note: "3 cakes", fixed: true },
      { food: "peanut butter", grams: 16, group: "fat", note: "1 level tablespoon" },
      { food: "honey", grams: 8, group: "finish" },
      { food: "nonfat Greek yogurt", grams: 170, group: "protein", note: "on the side" },
    ],
    fits: {},
    smartRead: "Crunchy, sweet and quick to put together, with the protein on the side.",
  },
];

/* ─── Macros and portions ───────────────────────────────────────────────── */

const isFood = (p: Portion): p is Extract<Portion, { food: PeakFood }> => "food" in p;

/**
 * A plate scales on three dials: the protein foods, the carb foods (grains,
 * starches, fruit and vegetables) and the fat foods (oils, nuts, finishes).
 * Three targets — protein, carbs and fat — need three dials; fewer can only
 * ever hit some of them.
 */
export type PlateScale = { protein: number; carb: number; fat: number };

/**
 * Which dial a food rides, from what the food actually is rather than where it
 * sits on the plate: honey is a carb even though it is a finish, and avocado is
 * a fat even though it is produce.
 */
export function dialOf(food: PeakFood): keyof PlateScale {
  const f = PEAK_FOODS[food];
  const fromProtein = f.p * 4;
  const fromCarb = f.c * 4;
  const fromFat = f.f * 9;
  if (fromProtein >= fromCarb && fromProtein >= fromFat) return "protein";
  return fromFat > fromCarb ? "fat" : "carb";
}

export function scaleOf(scale: number | PlateScale, food: PeakFood): number {
  return typeof scale === "number" ? scale : scale[dialOf(food)];
}

export function signatureMacros(sig: PeakSignature, scale: number | PlateScale = 1): FuelMacros {
  const sum = sig.portions.filter(isFood).reduce(
    (acc, p) => {
      const food: Per100 = PEAK_FOODS[p.food];
      const g = (p.fixed ? p.grams : scaledGrams(p.grams, scaleOf(scale, p.food))) / 100;
      return { kcal: acc.kcal + food.kcal * g, p: acc.p + food.p * g, c: acc.c + food.c * g, f: acc.f + food.f * g };
    },
    { kcal: 0, p: 0, c: 0, f: 0 },
  );
  return { calories: Math.round(sum.kcal), proteinG: Math.round(sum.p), carbsG: Math.round(sum.c), fatG: Math.round(sum.f) };
}

/** Portions scale within this band: enough to reach a big day's targets, not so far that a plate stops being itself. */
export const SCALE_MIN = 0.4;
export const SCALE_MAX = 2.2;

function scaledGrams(grams: number, scale: number): number {
  return Math.max(5, Math.round((grams * scale) / 5) * 5);
}

export function signatureIngredients(sig: PeakSignature, scale: number | PlateScale = 1): DetailedIngredient[] {
  return sig.portions.map((p) =>
    isFood(p)
      ? { name: p.food, amount: p.fixed && p.note ? p.note : `${scaledGrams(p.grams, scaleOf(scale, p.food))}g`, group: p.group, ...(p.note && !p.fixed ? { note: p.note } : {}) }
      : { name: p.name, amount: p.amount, group: p.group },
  );
}

/** The scale that brings a plate near a target calorie count, clamped. */
export function scaleFor(sig: PeakSignature, targetCalories: number | null): number {
  const base = signatureMacros(sig).calories;
  if (!targetCalories || base <= 0) return 1;
  return clampScale(targetCalories / base);
}

const clampScale = (s: number) => Math.min(SCALE_MAX, Math.max(SCALE_MIN, s));

export type MacroTarget = { calories: number; proteinG: number; carbsG?: number; fatG?: number };

/** The three parts of a plate, by what each food is, so each dial can be measured on its own. */
function parts(sig: PeakSignature) {
  const pick = (dial: keyof PlateScale) => ({ ...sig, portions: sig.portions.filter((p) => "food" in p && dialOf(p.food) === dial) });
  return { protein: signatureMacros(pick("protein")), carb: signatureMacros(pick("carb")), fat: signatureMacros(pick("fat")) };
}

/**
 * The dials for a meal's targets, solved together.
 *
 * Each part of the plate carries some protein, some carbs and some fat, so the
 * dials are one small system of equations — three unknowns, one row per macro.
 * Solved by elimination, then clamped so a plate stays recognisable; a clamped
 * dial hands what is left to the others.
 */
export function scalesFor(sig: PeakSignature, target: MacroTarget | null): PlateScale {
  if (!target || target.calories <= 0) return { protein: 1, carb: 1, fat: 1 };
  const part = parts(sig);
  const wanted = {
    proteinG: target.proteinG,
    carbsG: target.carbsG ?? null,
    fatG: target.fatG ?? null,
  };

  /* Rows: protein, carbs, fat (when asked for) and calories as the backstop. */
  const rows: Array<[number, number, number, number]> = [];
  rows.push([part.protein.proteinG, part.carb.proteinG, part.fat.proteinG, wanted.proteinG]);
  if (wanted.carbsG !== null) rows.push([part.protein.carbsG, part.carb.carbsG, part.fat.carbsG, wanted.carbsG]);
  if (wanted.fatG !== null) rows.push([part.protein.fatG, part.carb.fatG, part.fat.fatG, wanted.fatG]);
  if (rows.length < 3) rows.push([part.protein.calories, part.carb.calories, part.fat.calories, target.calories]);

  const solved = solve3(rows);
  const base = {
    protein: part.protein.calories > 0 ? target.calories / (part.protein.calories + part.carb.calories + part.fat.calories) : 1,
    carb: 1,
    fat: 1,
  };
  const protein = clampScale(solved ? solved[0] : base.protein);
  const carb = clampScale(solved ? solved[1] : base.protein);
  const fat = clampScale(solved ? solved[2] : base.protein);
  return { protein, carb, fat };
}

/** Gaussian elimination with partial pivoting. Null when the rows do not pin the dials down. */
function solve3(rows: Array<[number, number, number, number]>): [number, number, number] | null {
  const m = rows.slice(0, 3).map((r) => [...r]);
  if (m.length < 3) return null;
  for (let col = 0; col < 3; col += 1) {
    let pivot = col;
    for (let r = col + 1; r < 3; r += 1) if (Math.abs(m[r][col]) > Math.abs(m[pivot][col])) pivot = r;
    if (Math.abs(m[pivot][col]) < 1e-6) return null;
    [m[col], m[pivot]] = [m[pivot], m[col]];
    for (let r = 0; r < 3; r += 1) {
      if (r === col) continue;
      const factor = m[r][col] / m[col][col];
      for (let c = col; c < 4; c += 1) m[r][c] -= factor * m[col][c];
    }
  }
  const out: [number, number, number] = [m[0][3] / m[0][0], m[1][3] / m[1][1], m[2][3] / m[2][2]];
  return out.every((x) => Number.isFinite(x)) ? out : null;
}

/* ─── Choosing a plate ──────────────────────────────────────────────────── */

export function isFitArea(area: string): area is FitArea {
  return area === "lipids" || area === "cardiovascular" || area === "metabolic";
}

/**
 * The plate for a slot and look. Plates that fit guidance for more of the
 * member's compound areas come first; among equals the day rotates them, so
 * the week has variety. Null when no plate covers the slot for that look.
 */
export function pickSignature(slot: MealSlot, look: PeakLook, areas: ReadonlySet<FitArea>, dayIndex: number, exclude: ReadonlySet<string> = new Set()): PeakSignature | null {
  const pool = PEAK_SIGNATURES.filter((s) => s.slot === slot && s.looks.includes(look) && !exclude.has(s.id));
  if (pool.length === 0) return null;
  const score = (s: PeakSignature) => (Object.keys(s.fits) as FitArea[]).filter((a) => areas.has(a)).length;
  const best = Math.max(...pool.map(score));
  const top = pool.filter((s) => score(s) === best);
  return top[((dayIndex % top.length) + top.length) % top.length];
}

/** The member's compound areas this plate fits, with the reason and sources. */
export function fitsFor(sig: PeakSignature, areas: ReadonlySet<FitArea>): Array<{ area: FitArea; reason: string; sources: ProfileSource[] }> {
  return (Object.entries(sig.fits) as Array<[FitArea, string]>).filter(([area]) => areas.has(area)).map(([area, reason]) => ({ area, reason, sources: FIT_SOURCES[area] }));
}
