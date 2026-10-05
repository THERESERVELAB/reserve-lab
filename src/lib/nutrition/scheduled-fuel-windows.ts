/* ════════════════════════════════════════════════════════════════════════
   SCHEDULED FUEL WINDOWS — the schedule engine's meal plan, shaped for the
   fuel plan.

   `buildMealPlan` (lib/schedule/engine) is the one source of today's meal
   times, labels and slots. Every fuel plan — Nutrition's (useTodayFuelPlan),
   Apex's fuel lane, Schedule's hero — hands its meals to buildDailyFuelPlan
   through this, so no surface re-reads the member's stored window times,
   labels or on/off switches on its own and drifts from the others.
   ════════════════════════════════════════════════════════════════════════ */

import type { PlannedMeal } from "@/lib/schedule/engine";

import type { MealWindowInput } from "./fuel-plan";

export function fuelWindowsFromPlan(scheduled: readonly PlannedMeal[]): MealWindowInput[] {
  return scheduled.map((m) => ({
    id: m.id,
    label: m.label,
    time: m.time,
    enabled: true,
    slot: m.slot,
    optional: m.optional,
    kind: m.kind,
    shakeStyle: m.shakeStyle,
  }));
}
