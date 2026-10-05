/* Reserve Nutrition Engine — public surface (pure engine). */
export * from "./types";
export { DIET_STYLES, dietStyleMeta, FOOD_POOLS, getFoodsForStyle, getSwapOptions, foodIsExcluded, styleAllowsFood, carnivoreFoodAllowed } from "./diet-styles";
export { composeDish, type DishPresentation } from "./meal-library";
export {
  SIGNATURE_PURPOSES, SIGNATURE_INGREDIENT_ROLES, SIG_PURPOSE_TO_MEAL,
  computeSignatureMacros, signatureIngredientSummary, applySignatureToMeal, sigRoleToMacroRole,
  type SignatureMeal, type SignatureIngredient, type SignatureMealPurpose,
  type SignatureIngredientRole, type IngredientMacros,
} from "./signature-meals";
export { computeMacroTargets, carbTargetFeasibilityNote } from "./macro-engine";
export { buildMealWindows, parseHM, formatHM, type MealWindow } from "./meal-timing";
export { detectConflicts } from "./conflict-engine";
export { buildTodaysMealPlan } from "./meal-plan";

/* Flavor + variety + smoothie layers */
export {
  FLAVOR_PROFILES, flavorProfile, getFlavorOptionsForStyle, flavoredMealName,
  type FlavorProfile, type FlavorProfileKey,
} from "./flavor-profiles";
export {
  macroMatchedSwaps, tallyWeekFoods, detectFoodFatigue, dailyVarietyStatus,
  buildWeeklyRotation, applyDislike, toggleFavorite, scoreMeal,
  type FatigueWarning, type WeekFoodTally, type WeeklyRotation,
  type FoodMemory, type DislikeAction,
} from "./variety-engine";
export {
  SMOOTHIE_TEMPLATES, SMOOTHIE_FLAVORS, smoothiesForStyle, smoothieAllowed, suggestMacroRescue,
  type SmoothieTemplate, type SmoothieRole, type SmoothieStatus, type SmoothieFlavorKey,
  type MacroRescueResult, type MacroRescueInput,
} from "./smoothie-engine";

/* Units + grocery / inventory / restock layer */
export { convert, canConvert, canonicalUnit, unitDimension, type CanonicalUnit, type UnitDimension } from "./units";
export {
  STORES, INVENTORY_STATUS_LABEL, storeTier,
  buildGroceryList, buildSignatureGroceryItems, mergeGroceryItems, computeInventory, buildBudgetSummary, summarizeGrocery,
  type GroceryCategory, type StoreKey, type StoreTier, type QualityPreference, type StorePreferences,
  type CaffeineStyle, type BeveragePreferences, type GroceryItem, type PurchaseLog,
  type InventoryStatus, type InventoryItem, type BudgetSummary, type GrocerySummary,
  type GroceryListInput, type RestockPriority,
} from "./grocery-engine";
