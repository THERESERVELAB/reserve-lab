/* ════════════════════════════════════════════════════════════════════════
   PLATE CATALOGUE — the foods Reserve builds a day's plates from.

   Whole foods only: proteins, carbs, vegetables, a fat and a finish. Macros
   are per 100 g as eaten (cooked unless `dry`), rounded planning values in
   line with standard food composition tables. They are estimates, labelled
   as such wherever a plate shows them. No supplements, no medical claims.

   Tags carry what a member may need to avoid (shellfish, dairy, gluten …) so
   allergies, the Peak Mode avoid list and the diet style can hard-exclude a
   food, a finish or a cooking fat by what it is, not by how it is spelled.
   ════════════════════════════════════════════════════════════════════════ */

export type FoodTag =
  | "red-meat" | "poultry" | "fish" | "shellfish" | "egg" | "dairy" | "pork"
  | "gluten" | "oats" | "soy" | "nuts" | "sesame" | "legume" | "plant";

export type Per100 = { p: number; c: number; f: number };

/** How a protein is cooked and named. Four cooking methods each, so a week can rotate them. */
export type ProteinKind = "steak" | "ground" | "poultry" | "fish" | "egg" | "dairy" | "plant";

/** Protein family for same-day rotation. */
export type RotationGroup = "beef" | "poultry" | "fish" | "egg" | "dairy" | "plant" | "pork";

export type ProteinFood = {
  id: string;
  label: string;
  kind: ProteinKind;
  group: RotationGroup;
  per100: Per100;
  tags: FoodTag[];
  /** How the member might write it. The matcher is forgiving of spelling on top of these. */
  aliases: string[];
  /** Name on a shopping list, before any qualifier. */
  grocery: string;
  /** Food-coverage tags (micronutrient-coverage.ts keys). */
  covers: string[];
  /** A rich plate kept away from the meal nearest sleep. */
  heavy?: true;
  /** Holds well cooked once and eaten over a few days. */
  batch?: true;
  /** Cooking-method overrides for a food whose class names read oddly. */
  methods?: [string, string, string, string];
};

export type CarbFood = {
  id: string;
  label: string;
  /** Short name used in a dish name ("Jasmine Rice"). */
  short: string;
  /** At breakfast, how the carb reads ("Gold Potato Hash"). */
  breakfastShort?: string;
  per100: Per100;
  tags: FoodTag[];
  aliases: string[];
  grocery: string;
  covers: string[];
  /** Weighed dry (oats, cream of rice). */
  dry?: true;
  /** Low in fibre and fat — sits well close to training. */
  fast?: true;
  /** Reads naturally on a savoury breakfast plate. */
  breakfast?: true;
  /** Goes in a sweet breakfast bowl. */
  sweet?: true;
  /** Largest sensible portion, grams. */
  max: number;
};

export type ProduceFood = {
  id: string;
  label: string;
  per100: Per100;
  covers: string[];
  breakfast?: true;
  sweet?: true;
};

export type FatCarrierId = "olive-oil" | "avocado" | "butter" | "sesame-oil" | "chia";

export type FatCarrier = { id: FatCarrierId; label: string; per100: Per100; tags: FoodTag[]; max: number; step: number };

export type Finish = {
  id: string;
  label: string;
  /** "prefix": "Chipotle-Lime Grilled Chicken". "with": "Grilled Chicken with Chimichurri". */
  pattern: "prefix" | "with";
  kinds: ProteinKind[];
  carrier: FatCarrierId;
  /** What goes on the plate, as the ingredient line reads. */
  finish: string;
  tags: FoodTag[];
};

/* ─── Proteins ───────────────────────────────────────────────────────────── */

export const PLATE_PROTEINS: ProteinFood[] = [
  { id: "ribeye", label: "Ribeye", kind: "steak", group: "beef", per100: { p: 24, c: 0, f: 17 }, tags: ["red-meat"], aliases: ["ribeye", "rib eye", "rib-eye", "ribeye steak", "delmonico"], grocery: "ribeye steak", covers: ["iron", "zinc", "protein"], heavy: true },
  { id: "strip", label: "NY Strip", kind: "steak", group: "beef", per100: { p: 26, c: 0, f: 11 }, tags: ["red-meat"], aliases: ["ny strip", "new york strip", "ny steak", "new york steak", "strip steak", "strip loin", "striploin", "kansas city strip"], grocery: "NY strip steak", covers: ["iron", "zinc", "protein"] },
  { id: "sirloin", label: "Top Sirloin", kind: "steak", group: "beef", per100: { p: 29, c: 0, f: 7 }, tags: ["red-meat"], aliases: ["sirloin", "top sirloin", "sirloin steak", "steak"], grocery: "top sirloin steak", covers: ["iron", "zinc", "protein"] },
  { id: "filet", label: "Filet", kind: "steak", group: "beef", per100: { p: 28, c: 0, f: 9 }, tags: ["red-meat"], aliases: ["filet", "filet mignon", "beef tenderloin", "tenderloin steak"], grocery: "beef tenderloin filet", covers: ["iron", "zinc", "protein"] },
  { id: "flank", label: "Flank Steak", kind: "steak", group: "beef", per100: { p: 28, c: 0, f: 8 }, tags: ["red-meat"], aliases: ["flank", "flank steak"], grocery: "flank steak", covers: ["iron", "zinc", "protein"] },
  { id: "ground-beef", label: "Ground Beef", kind: "ground", group: "beef", per100: { p: 26, c: 0, f: 9 }, tags: ["red-meat"], aliases: ["ground beef", "lean ground beef", "beef mince", "minced beef", "hamburger", "93/7 ground beef", "90/10 ground beef"], grocery: "93/7 ground beef", covers: ["iron", "zinc", "protein"], batch: true },
  { id: "ground-bison", label: "Ground Bison", kind: "ground", group: "beef", per100: { p: 25, c: 0, f: 10 }, tags: ["red-meat"], aliases: ["ground bison", "bison"], grocery: "90/10 ground bison", covers: ["iron", "zinc", "protein"], batch: true },
  { id: "chicken-breast", label: "Chicken Breast", kind: "poultry", group: "poultry", per100: { p: 31, c: 0, f: 3.6 }, tags: ["poultry"], aliases: ["chicken breast", "chicken breasts", "chicken", "grilled chicken", "chicken tenders", "chicken tenderloins"], grocery: "chicken breast", covers: ["protein"], batch: true },
  { id: "chicken-thigh", label: "Chicken Thigh", kind: "poultry", group: "poultry", per100: { p: 26, c: 0, f: 8 }, tags: ["poultry"], aliases: ["chicken thigh", "chicken thighs", "boneless thighs"], grocery: "skinless chicken thighs", covers: ["protein", "zinc"], batch: true },
  { id: "ground-chicken", label: "Ground Chicken", kind: "ground", group: "poultry", per100: { p: 26, c: 0, f: 7 }, tags: ["poultry"], aliases: ["ground chicken", "lean ground chicken", "chicken mince"], grocery: "lean ground chicken", covers: ["protein"], batch: true },
  { id: "ground-turkey", label: "Ground Turkey", kind: "ground", group: "poultry", per100: { p: 28, c: 0, f: 5 }, tags: ["poultry"], aliases: ["ground turkey", "lean ground turkey", "turkey mince", "99% lean ground turkey", "93/7 ground turkey"], grocery: "lean ground turkey", covers: ["protein", "zinc"], batch: true },
  { id: "turkey-breast", label: "Turkey Breast", kind: "poultry", group: "poultry", per100: { p: 30, c: 0, f: 2 }, tags: ["poultry"], aliases: ["turkey breast", "turkey", "roast turkey"], grocery: "turkey breast", covers: ["protein", "zinc"], batch: true },
  { id: "tilapia", label: "Tilapia", kind: "fish", group: "fish", per100: { p: 26, c: 0, f: 2.7 }, tags: ["fish"], aliases: ["tilapia"], grocery: "tilapia fillets", covers: ["protein"] },
  { id: "cod", label: "Cod", kind: "fish", group: "fish", per100: { p: 23, c: 0, f: 0.9 }, tags: ["fish"], aliases: ["cod", "white fish", "whitefish", "haddock"], grocery: "cod fillets", covers: ["protein"] },
  { id: "salmon", label: "Salmon", kind: "fish", group: "fish", per100: { p: 25, c: 0, f: 8 }, tags: ["fish"], aliases: ["salmon", "sockeye", "sockeye salmon", "atlantic salmon", "coho", "king salmon"], grocery: "salmon fillet", covers: ["protein", "omega-3", "vitamin-d"] },
  { id: "tuna", label: "Ahi Tuna", kind: "fish", group: "fish", per100: { p: 29, c: 0, f: 1 }, tags: ["fish"], aliases: ["tuna", "ahi", "ahi tuna", "yellowfin", "tuna steak"], grocery: "ahi tuna steaks", covers: ["protein", "omega-3"], methods: ["Seared", "Grilled", "Pan-Seared", "Broiled"] },
  { id: "mahi", label: "Mahi-Mahi", kind: "fish", group: "fish", per100: { p: 24, c: 0, f: 1 }, tags: ["fish"], aliases: ["mahi", "mahi mahi", "mahi-mahi"], grocery: "mahi-mahi fillets", covers: ["protein"] },
  { id: "shrimp", label: "Shrimp", kind: "fish", group: "fish", per100: { p: 24, c: 0, f: 0.3 }, tags: ["shellfish"], aliases: ["shrimp", "prawn", "prawns"], grocery: "shrimp", covers: ["protein"], methods: ["Garlic-Seared", "Grilled", "Sautéed", "Broiled"] },
  { id: "pork-tenderloin", label: "Pork Tenderloin", kind: "poultry", group: "pork", per100: { p: 26, c: 0, f: 3.5 }, tags: ["pork"], aliases: ["pork tenderloin", "pork loin", "pork"], grocery: "pork tenderloin", covers: ["protein", "zinc"] },
  { id: "eggs", label: "Eggs", kind: "egg", group: "egg", per100: { p: 12.6, c: 0.7, f: 9.5 }, tags: ["egg"], aliases: ["eggs", "egg", "whole eggs", "egg whites"], grocery: "whole eggs", covers: ["protein", "vitamin-d", "zinc"] },
  { id: "greek-yogurt", label: "Greek Yogurt", kind: "dairy", group: "dairy", per100: { p: 10, c: 3.6, f: 0.4 }, tags: ["dairy"], aliases: ["greek yogurt", "yogurt", "yoghurt", "skyr"], grocery: "nonfat Greek yogurt", covers: ["protein", "calcium"] },
  { id: "cottage-cheese", label: "Cottage Cheese", kind: "dairy", group: "dairy", per100: { p: 11, c: 3.4, f: 1 }, tags: ["dairy"], aliases: ["cottage cheese"], grocery: "1% cottage cheese", covers: ["protein", "calcium"] },
  { id: "tofu", label: "Tofu", kind: "plant", group: "plant", per100: { p: 17, c: 3, f: 9 }, tags: ["soy", "plant"], aliases: ["tofu", "extra firm tofu"], grocery: "extra-firm tofu", covers: ["protein", "calcium", "iron"] },
  { id: "tempeh", label: "Tempeh", kind: "plant", group: "plant", per100: { p: 20, c: 8, f: 11 }, tags: ["soy", "plant"], aliases: ["tempeh"], grocery: "tempeh", covers: ["protein", "fiber", "iron"] },
];

/** Whole eggs on an egg plate are counted, the rest is egg whites. Per egg (about 50 g). */
export const WHOLE_EGG = { grams: 50, p: 6.3, c: 0.35, f: 4.8 } as const;
export const EGG_WHITES: Per100 = { p: 11, c: 0.7, f: 0.2 };

/* ─── Carbs ──────────────────────────────────────────────────────────────── */

export const PLATE_CARBS: CarbFood[] = [
  { id: "jasmine-rice", label: "jasmine rice", short: "Jasmine Rice", per100: { p: 2.7, c: 28, f: 0.3 }, tags: [], aliases: ["jasmine rice", "jasmine", "white rice", "rice"], grocery: "jasmine rice", covers: [], fast: true, max: 480 },
  { id: "basmati-rice", label: "basmati rice", short: "Basmati Rice", per100: { p: 3.5, c: 25, f: 0.4 }, tags: [], aliases: ["basmati", "basmati rice"], grocery: "basmati rice", covers: [], fast: true, max: 480 },
  { id: "brown-rice", label: "brown rice", short: "Brown Rice", per100: { p: 2.6, c: 23, f: 0.9 }, tags: [], aliases: ["brown rice"], grocery: "brown rice", covers: ["fiber", "magnesium"], max: 480 },
  { id: "gold-potato", label: "roasted gold potatoes", short: "Gold Potatoes", breakfastShort: "Gold Potato Hash", per100: { p: 2, c: 17, f: 0.1 }, tags: [], aliases: ["gold potato", "gold potatoes", "yukon gold", "yukon gold potatoes", "russet", "russet potato", "russet potatoes", "gold russet potatoes", "potato", "potatoes", "baked potato"], grocery: "gold potatoes", covers: ["potassium"], fast: true, breakfast: true, max: 450 },
  { id: "red-potato", label: "roasted red potatoes", short: "Red Potatoes", breakfastShort: "Red Potato Hash", per100: { p: 2, c: 16, f: 0.2 }, tags: [], aliases: ["red potato", "red potatoes", "baby potatoes"], grocery: "red potatoes", covers: ["potassium"], fast: true, breakfast: true, max: 450 },
  { id: "sweet-potato", label: "roasted sweet potato", short: "Sweet Potato", breakfastShort: "Sweet Potato Hash", per100: { p: 1.6, c: 20, f: 0.1 }, tags: [], aliases: ["sweet potato", "sweet potatoes", "yam", "yams"], grocery: "sweet potatoes", covers: ["potassium", "fiber"], breakfast: true, max: 450 },
  { id: "protein-pasta", label: "chickpea protein pasta", short: "Protein Pasta", per100: { p: 8.5, c: 25, f: 2.7 }, tags: ["legume"], aliases: ["protein pasta", "chickpea pasta", "banza", "lentil pasta"], grocery: "chickpea protein pasta", covers: ["fiber", "iron"], max: 400 },
  { id: "pasta", label: "pasta", short: "Pasta", per100: { p: 5.8, c: 31, f: 0.9 }, tags: ["gluten"], aliases: ["pasta", "spaghetti", "penne", "whole wheat pasta"], grocery: "pasta", covers: [], max: 400 },
  { id: "quinoa", label: "quinoa", short: "Quinoa", per100: { p: 4.4, c: 21, f: 1.9 }, tags: [], aliases: ["quinoa"], grocery: "quinoa", covers: ["fiber", "magnesium"], max: 450 },
  { id: "rice-noodles", label: "rice noodles", short: "Rice Noodles", per100: { p: 1.8, c: 25, f: 0.2 }, tags: [], aliases: ["rice noodles"], grocery: "rice noodles", covers: [], fast: true, max: 450 },
  { id: "corn-tortillas", label: "corn tortillas", short: "Corn Tortillas", per100: { p: 6, c: 45, f: 3 }, tags: [], aliases: ["corn tortillas", "tortillas", "corn tortilla"], grocery: "corn tortillas", covers: ["fiber"], max: 200 },
  { id: "sourdough", label: "sourdough toast", short: "Sourdough", per100: { p: 9, c: 51, f: 1.5 }, tags: ["gluten"], aliases: ["sourdough", "toast", "bread", "sourdough bread"], grocery: "sourdough bread", covers: [], breakfast: true, max: 160 },
  { id: "oats", label: "rolled oats", short: "Oats", per100: { p: 13, c: 66, f: 7 }, tags: ["oats"], aliases: ["oats", "oatmeal", "rolled oats"], grocery: "rolled oats", covers: ["fiber", "magnesium"], dry: true, breakfast: true, sweet: true, max: 110 },
  { id: "cream-of-rice", label: "cream of rice", short: "Cream of Rice", per100: { p: 6, c: 80, f: 0.5 }, tags: [], aliases: ["cream of rice"], grocery: "cream of rice", covers: [], dry: true, fast: true, breakfast: true, sweet: true, max: 110 },
  { id: "banana", label: "banana", short: "Banana", per100: { p: 1.1, c: 23, f: 0.3 }, tags: [], aliases: ["banana", "bananas"], grocery: "bananas", covers: ["potassium", "fruit-veg"], fast: true, sweet: true, max: 250 },
];

/* ─── Vegetables and fruit ───────────────────────────────────────────────── */

export const PLATE_PRODUCE: ProduceFood[] = [
  { id: "asparagus", label: "asparagus", per100: { p: 2.4, c: 4, f: 0.2 }, covers: ["folate", "fruit-veg"] },
  { id: "broccoli", label: "broccoli", per100: { p: 2.4, c: 7, f: 0.4 }, covers: ["vitamin-c", "fiber", "folate", "fruit-veg"] },
  { id: "green-beans", label: "green beans", per100: { p: 1.8, c: 7, f: 0.2 }, covers: ["fiber", "fruit-veg"] },
  { id: "zucchini", label: "zucchini", per100: { p: 1.2, c: 3, f: 0.3 }, covers: ["potassium", "fruit-veg"] },
  { id: "spinach", label: "baby spinach", per100: { p: 2.9, c: 3.6, f: 0.4 }, covers: ["folate", "iron", "magnesium", "fruit-veg"], breakfast: true },
  { id: "bell-peppers", label: "bell peppers", per100: { p: 1, c: 6, f: 0.3 }, covers: ["vitamin-c", "fruit-veg"], breakfast: true },
  { id: "mixed-greens", label: "mixed greens", per100: { p: 1.5, c: 3, f: 0.3 }, covers: ["folate", "fruit-veg"] },
  { id: "carrots", label: "roasted carrots", per100: { p: 0.8, c: 8, f: 0.2 }, covers: ["fiber", "fruit-veg"] },
  { id: "brussels", label: "brussels sprouts", per100: { p: 3.4, c: 9, f: 0.3 }, covers: ["vitamin-c", "fiber", "fruit-veg"] },
  { id: "tomato-cucumber", label: "tomato & cucumber", per100: { p: 0.8, c: 3.5, f: 0.2 }, covers: ["vitamin-c", "fruit-veg"], breakfast: true },
  { id: "mushrooms", label: "mushrooms", per100: { p: 3, c: 3.3, f: 0.3 }, covers: ["fruit-veg"], breakfast: true },
  { id: "mixed-berries", label: "mixed berries", per100: { p: 0.7, c: 12, f: 0.3 }, covers: ["vitamin-c", "fiber", "fruit-veg"], sweet: true },
];

/* ─── Cooking fats ───────────────────────────────────────────────────────── */

export const FAT_CARRIERS: Record<FatCarrierId, FatCarrier> = {
  "olive-oil": { id: "olive-oil", label: "olive oil", per100: { p: 0, c: 0, f: 100 }, tags: [], max: 15, step: 5 },
  avocado: { id: "avocado", label: "avocado", per100: { p: 2, c: 9, f: 15 }, tags: [], max: 100, step: 10 },
  butter: { id: "butter", label: "butter", per100: { p: 0.9, c: 0.1, f: 81 }, tags: ["dairy"], max: 15, step: 5 },
  "sesame-oil": { id: "sesame-oil", label: "toasted sesame oil", per100: { p: 0, c: 0, f: 100 }, tags: ["sesame"], max: 10, step: 5 },
  chia: { id: "chia", label: "chia seeds", per100: { p: 17, c: 42, f: 31 }, tags: [], max: 20, step: 5 },
};

/* ─── Finishes (the flavour of the plate) ────────────────────────────────── */

export const PLATE_FINISHES: Finish[] = [
  { id: "chimichurri", label: "Chimichurri", pattern: "with", kinds: ["steak", "ground", "poultry", "fish"], carrier: "olive-oil", finish: "chimichurri (parsley, garlic, red wine vinegar)", tags: [] },
  { id: "cracked-pepper", label: "Cracked-Pepper", pattern: "prefix", kinds: ["steak"], carrier: "olive-oil", finish: "cracked black pepper crust", tags: [] },
  { id: "smoked-paprika", label: "Smoked Paprika", pattern: "prefix", kinds: ["steak", "ground", "poultry", "egg", "plant"], carrier: "olive-oil", finish: "smoked paprika & garlic rub", tags: [] },
  { id: "chipotle-lime", label: "Chipotle-Lime", pattern: "prefix", kinds: ["steak", "ground", "poultry", "fish", "plant"], carrier: "avocado", finish: "chipotle-lime seasoning", tags: [] },
  { id: "garlic-butter", label: "Garlic-Herb Butter", pattern: "with", kinds: ["steak", "fish"], carrier: "butter", finish: "garlic-herb butter", tags: ["dairy"] },
  { id: "rosemary-garlic", label: "Rosemary-Garlic", pattern: "prefix", kinds: ["steak", "poultry"], carrier: "olive-oil", finish: "rosemary, garlic & sea salt", tags: [] },
  { id: "fajita", label: "Fajita-Spiced", pattern: "prefix", kinds: ["steak", "ground", "poultry"], carrier: "avocado", finish: "fajita spice with charred onions", tags: [] },
  { id: "harissa", label: "Harissa", pattern: "prefix", kinds: ["steak", "ground", "poultry", "fish", "plant"], carrier: "olive-oil", finish: "harissa paste", tags: [] },
  { id: "korean-bbq", label: "Korean BBQ", pattern: "prefix", kinds: ["steak", "ground", "poultry"], carrier: "sesame-oil", finish: "gochujang-soy glaze", tags: ["soy", "gluten", "sesame"] },
  { id: "ginger-soy", label: "Ginger-Soy", pattern: "prefix", kinds: ["poultry", "fish", "ground", "plant"], carrier: "sesame-oil", finish: "ginger-soy glaze", tags: ["soy", "gluten", "sesame"] },
  { id: "ginger-garlic", label: "Ginger-Garlic", pattern: "prefix", kinds: ["poultry", "fish", "ground", "plant"], carrier: "olive-oil", finish: "fresh ginger & garlic glaze", tags: [] },
  { id: "lemon-herb", label: "Lemon-Herb", pattern: "prefix", kinds: ["poultry", "fish"], carrier: "olive-oil", finish: "lemon, parsley & thyme", tags: [] },
  { id: "cajun", label: "Cajun", pattern: "prefix", kinds: ["poultry", "fish", "ground"], carrier: "olive-oil", finish: "cajun spice blend", tags: [] },
  { id: "mediterranean", label: "Mediterranean", pattern: "prefix", kinds: ["poultry", "fish", "ground", "egg", "plant"], carrier: "olive-oil", finish: "oregano, lemon & garlic", tags: [] },
  { id: "mango-salsa", label: "Mango Salsa", pattern: "with", kinds: ["fish", "poultry"], carrier: "avocado", finish: "mango salsa (mango, red onion, cilantro, lime)", tags: [] },
  { id: "lemon-dill", label: "Lemon-Dill", pattern: "prefix", kinds: ["fish"], carrier: "olive-oil", finish: "lemon & fresh dill", tags: [] },
  { id: "honey-garlic", label: "Honey-Garlic", pattern: "prefix", kinds: ["poultry", "fish", "ground"], carrier: "olive-oil", finish: "honey-garlic glaze", tags: [] },
  { id: "salsa-verde", label: "Salsa Verde", pattern: "with", kinds: ["poultry", "fish", "steak"], carrier: "olive-oil", finish: "salsa verde (tomatillo, jalapeño, cilantro)", tags: [] },
  { id: "tzatziki", label: "Tzatziki", pattern: "with", kinds: ["poultry", "ground"], carrier: "olive-oil", finish: "tzatziki (Greek yogurt, cucumber, dill)", tags: ["dairy"] },
  { id: "citrus-chili", label: "Citrus-Chili", pattern: "prefix", kinds: ["fish", "poultry"], carrier: "olive-oil", finish: "orange, lime & chili", tags: [] },
  { id: "blackened", label: "Blackened", pattern: "prefix", kinds: ["fish", "poultry"], carrier: "olive-oil", finish: "blackening spice", tags: [] },
  { id: "pico-lime", label: "Pico & Lime", pattern: "with", kinds: ["ground", "poultry", "fish"], carrier: "avocado", finish: "pico de gallo & lime", tags: [] },
  { id: "smoky-bbq", label: "Smoky BBQ", pattern: "prefix", kinds: ["steak", "ground", "poultry"], carrier: "olive-oil", finish: "smoky dry rub", tags: [] },
  { id: "italian-herb", label: "Italian Herb", pattern: "prefix", kinds: ["ground", "poultry"], carrier: "olive-oil", finish: "basil, oregano & crushed tomato", tags: [] },
  { id: "ranchero", label: "Ranchero", pattern: "prefix", kinds: ["egg"], carrier: "avocado", finish: "salsa ranchera", tags: [] },
  { id: "herb-chive", label: "Herb & Chive", pattern: "prefix", kinds: ["egg"], carrier: "olive-oil", finish: "chives & parsley", tags: [] },
  { id: "southwest", label: "Southwest", pattern: "prefix", kinds: ["egg", "ground"], carrier: "avocado", finish: "peppers, onion & cumin", tags: [] },
  { id: "spinach-feta", label: "Spinach & Feta", pattern: "prefix", kinds: ["egg"], carrier: "olive-oil", finish: "crumbled feta", tags: ["dairy"] },
  { id: "everything", label: "Everything-Seasoned", pattern: "prefix", kinds: ["egg"], carrier: "avocado", finish: "everything seasoning", tags: ["sesame"] },
  { id: "berries-honey", label: "Berries & Honey", pattern: "prefix", kinds: ["dairy"], carrier: "chia", finish: "honey drizzle", tags: [] },
  { id: "cinnamon-banana", label: "Cinnamon-Banana", pattern: "prefix", kinds: ["dairy"], carrier: "chia", finish: "cinnamon", tags: [] },
  { id: "tropical", label: "Tropical", pattern: "prefix", kinds: ["dairy"], carrier: "chia", finish: "mango & pineapple", tags: [] },
  { id: "vanilla-berry", label: "Vanilla-Berry", pattern: "prefix", kinds: ["dairy"], carrier: "chia", finish: "vanilla bean", tags: [] },
];

/* ─── Cooking methods ────────────────────────────────────────────────────── */

type MethodDef = { label: string; prep: string[] };

/** Four per class, so the same protein on nearby days is never cooked the same way. */
export const METHODS: Record<ProteinKind, [MethodDef, MethodDef, MethodDef, MethodDef]> = {
  steak: [
    { label: "Cast-Iron", prep: ["pan-seared", "stovetop"] },
    { label: "Grilled", prep: ["grilled", "grill pan on the stovetop"] },
    { label: "Reverse-Seared", prep: ["oven", "pan-seared"] },
    { label: "Broiled", prep: ["oven", "broiled"] },
  ],
  ground: [
    { label: "Skillet", prep: ["stovetop", "skillet"] },
    { label: "Patties", prep: ["grilled", "pan", "stovetop"] },
    { label: "Meatballs", prep: ["oven", "baked"] },
    { label: "Stir-Fry", prep: ["stovetop", "pan"] },
  ],
  poultry: [
    { label: "Grilled", prep: ["grilled", "grill pan on the stovetop"] },
    { label: "Pan-Seared", prep: ["pan-seared", "stovetop"] },
    { label: "Oven-Roasted", prep: ["oven", "roasted"] },
    { label: "Air-Fried", prep: ["air fryer", "oven"] },
  ],
  fish: [
    { label: "Pan-Seared", prep: ["pan-seared", "stovetop"] },
    { label: "Oven-Roasted", prep: ["oven", "roasted"] },
    { label: "Grilled", prep: ["grilled", "grill pan on the stovetop"] },
    { label: "Broiled", prep: ["oven", "broiled"] },
  ],
  egg: [
    { label: "Soft-Scrambled", prep: ["stovetop", "non-stick"] },
    { label: "Sunny-Side", prep: ["stovetop", "non-stick"] },
    { label: "Omelette", prep: ["stovetop", "non-stick"] },
    { label: "Frittata", prep: ["oven", "stovetop"] },
  ],
  dairy: [
    { label: "Bowl", prep: ["no-cook", "assemble"] },
    { label: "Parfait", prep: ["no-cook", "assemble"] },
    { label: "Whipped", prep: ["no-cook", "assemble"] },
    { label: "Morning Bowl", prep: ["no-cook", "assemble"] },
  ],
  plant: [
    { label: "Crispy", prep: ["oven", "air fryer"] },
    { label: "Pan-Seared", prep: ["pan-seared", "stovetop"] },
    { label: "Baked", prep: ["oven", "baked"] },
    { label: "Grilled", prep: ["grilled", "grill pan on the stovetop"] },
  ],
};

/* ─── Lookups ────────────────────────────────────────────────────────────── */

const PROTEIN_BY_ID = new Map(PLATE_PROTEINS.map((p) => [p.id, p]));
const CARB_BY_ID = new Map(PLATE_CARBS.map((c) => [c.id, c]));
const PRODUCE_BY_ID = new Map(PLATE_PRODUCE.map((p) => [p.id, p]));
const FINISH_BY_ID = new Map(PLATE_FINISHES.map((f) => [f.id, f]));

export const proteinById = (id: string): ProteinFood | undefined => PROTEIN_BY_ID.get(id);
export const carbById = (id: string): CarbFood | undefined => CARB_BY_ID.get(id);
export const produceById = (id: string): ProduceFood | undefined => PRODUCE_BY_ID.get(id);
export const finishById = (id: string): Finish | undefined => FINISH_BY_ID.get(id);
