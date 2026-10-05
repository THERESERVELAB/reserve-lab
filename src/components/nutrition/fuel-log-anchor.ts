/* Today's fuel log on the Nutrition screen. The hero's "Review Today's Fuel Log"
   brings it into view instead of pretending there is more to log. */

export const NUTRITION_FUEL_LOG_ID = "nutrition-fuel-log";

/** Scrolls today's fuel log into view and moves focus to it. False when it is not on the page. */
export function focusNutritionFuelLog(): boolean {
  if (typeof document === "undefined") return false;
  const host = document.getElementById(NUTRITION_FUEL_LOG_ID);
  if (!host) return false;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  host.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  host.focus({ preventScroll: true });
  return true;
}
