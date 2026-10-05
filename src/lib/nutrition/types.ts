/* ════════════════════════════════════════════════════════════════════════
   RESERVE NUTRITION ENGINE — shared types
   ------------------------------------------------------------------------
   Performance meal-planning support only. No medical advice, no diagnosis,
   no compound/supplement timing recommendations. Compound timing rules are
   member/provider-entered and consumed read-only by the conflict engine.
   ════════════════════════════════════════════════════════════════════════ */

export type DietStyleKey =
  | "standard"
  | "high-protein"
  | "animal-based"
  | "carnivore"
  | "pescatarian"
  | "mediterranean"
  | "vegetarian"
  | "vegan"
  | "paleo"
  | "keto"
  | "low-fat"
  | "gluten-free"
  | "dairy-free"
  | "halal"
  | "kosher"
  | "custom";

export type MacroRole = "protein" | "carb" | "fat" | "produce" | "sauce" | "snack";

export type DayType = "training" | "rest";

/**
 * Carnivore strictness ladder (member preference, not medical advice):
 *  - strict        → meat, fish, eggs, animal fats, bone broth, salt only
 *  - dairy_allowed → strict + butter/ghee/cheese/Greek yogurt/whey
 *  - animal_based_flex → dairy + fruit, honey, white rice, potatoes
 */
export type CarnivoreStrictness = "strict" | "dairy_allowed" | "animal_based_flex";

export type GoalKey = "cut" | "lean-bulk" | "recomp" | "maintenance" | "performance" | "prep";

export type BudgetLevel = "lean" | "standard" | "premium";

/* ─── Food model ─────────────────────────────────── */
export type FoodOption = {
  id: string;
  name: string;
  role: MacroRole;
  /** Diet styles this food is allowed in. "all" = every style except where excluded by exclusion tags. */
  styles: DietStyleKey[] | "all";
  /** Exclusion tags so allergy/diet filters can remove it (e.g. "dairy", "gluten", "fish", "egg"). */
  tags: string[];
};

/* ─── Macro targets ──────────────────────────────── */
export type MacroTargets = {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  hydrationMl: number;
  basis: string; // human-readable note ("Estimated nutrition target based on member profile.")
};

/* ─── Schedule ───────────────────────────────────── */
export type DailySchedule = {
  wakeTime: string;          // "HH:MM"
  sleepTime: string;         // "HH:MM"
  workStartTime?: string;
  workEndTime?: string;
  commuteStartTime?: string;
  commuteEndTime?: string;
  trainingStartTime?: string;
  trainingEndTime?: string;
  preferredMealCount?: number;
  minimumMealSpacingMinutes?: number;
  maximumMealSpacingMinutes?: number;
  lastMealBeforeBedHours?: number;
};

/* ─── Compound timing rules (member/provider-entered, read-only) ─── */
export type CompoundTimingRule = {
  compoundId: string;
  compoundName: string;
  /** Optional planned clock time for the item, "HH:MM". */
  plannedTime?: string;
  withFood?: boolean;
  emptyStomach?: boolean;
  avoidFoodBeforeMinutes?: number;
  avoidFoodAfterMinutes?: number;
  preTrainingMinutes?: number;
  postTrainingMinutes?: number;
  beforeBedMinutes?: number;
  afterLastMealMinutes?: number;
  separateFromMealsMinutes?: number;
  customTimingNote?: string;
};

/* ─── Meals ──────────────────────────────────────── */
export type MealPurpose =
  | "morning-anchor"
  | "work-meal"
  | "midday-meal"
  | "pre-workout"
  | "post-workout"
  | "night-recovery"
  | "rest-day-anchor"
  | "snack";

export type MealStatus = "planned" | "logged" | "skipped" | "missed";

export type MealFood = {
  role: MacroRole;
  name: string;
  foodId: string;
};

export type MealConflictFlag = {
  conflictId: string;
  severity: ConflictSeverity;
  message: string;
};

export type Meal = {
  id: string;
  name: string;
  order: number;
  timeWindow: string;     // "7:00 AM"
  timeMinutes: number;    // minutes from midnight
  purpose: MealPurpose;
  foods: MealFood[];
  /** Premium coach-built dish name, e.g. "Cast-Iron Ribeye with Tallow & Sea Salt". */
  dishName: string;
  /** Presentation only — e.g. "Cast-Iron Seared". Never changes macros or food rules. */
  cookingStyle: string;
  /** Presentation only — e.g. "Steakhouse". */
  flavorProfile: string;
  macros: { calories: number; proteinG: number; carbsG: number; fatG: number };
  dietStyle: DietStyleKey;
  status: MealStatus;
  swapOptions: Record<string, string[]>; // foodId -> alternative names
  prepNote: string;
  conflictFlags: MealConflictFlag[];
};

/* ─── Conflicts ──────────────────────────────────── */
export type ConflictSeverity = "info" | "warning" | "critical";
export type ConflictCategory = "meal" | "compound" | "training" | "sleep" | "work" | "diet";

export type Conflict = {
  id: string;
  severity: ConflictSeverity;
  category: ConflictCategory;
  message: string;
  affectedItems: string[];
  possibleActions: string[];
};

/* ─── Daily plan ─────────────────────────────────── */
export type MealPlan = {
  date: string;
  dayType: DayType;
  trainingSplit: string;
  dietStyle: DietStyleKey;
  meals: Meal[];
  totalMacros: MacroTargets;
  completedMeals: number;
  remainingMacros: { calories: number; proteinG: number; carbsG: number; fatG: number };
  nextMeal: Meal | null;
  conflicts: Conflict[];
  groceryPreview: Record<MacroRole, string[]>;
  prepNotes: string[];
  setupNeeded: string[]; // graceful empty-state CTAs when data is missing
};

/* ─── Engine input ───────────────────────────────── */
export type AppetiteLevel = "low" | "normal" | "high";

export type NutritionEngineInput = {
  date?: string;
  dayType: DayType;
  trainingSplit?: string;
  goal: GoalKey;
  /** The member's weight, or null — the macro engine then uses the disclosed reference weight. */
  bodyweightLb: number | null;
  dietStyle: DietStyleKey;
  /** Only meaningful when dietStyle === "carnivore". Defaults to "strict". */
  carnivoreStrictness?: CarnivoreStrictness;
  schedule: DailySchedule;
  preferredFoods?: string[];
  dislikedFoods?: string[];
  excludedFoods?: string[];
  allergies?: string[];      // tags, e.g. ["dairy","gluten","shellfish"]
  budget?: BudgetLevel;
  compoundRules?: CompoundTimingRule[];
  /** ids of meals already logged today (status reflection). */
  loggedMealIds?: string[];
  /** Variety controls. */
  favoriteFoods?: string[];
  appetiteLevel?: AppetiteLevel;
  /** Deterministic rotation offset so day-to-day plans vary without breaking macros. */
  rotationSeed?: number;
  /** Pre-resolved macro target (e.g. the protocol-aligned today macros). When set,
      the daily plan uses it verbatim instead of recomputing from goal/bodyweight,
      so the meals on the plate match the macros shown on the alignment card. Food
      selection, filtering, and per-meal carb timing are all unchanged. */
  macroTargetOverride?: MacroTargets;
};

/* ─── Meal quality / adherence fit score ─────────── */
export type MealQualityLabel = "Optimized" | "Strong" | "Acceptable" | "Needs Review";
export type MealQuality = {
  score: number; // 0-100
  label: MealQualityLabel;
  factors: string[];
};
