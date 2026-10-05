"use client";

/* ════════════════════════════════════════════════════════════════════════
   useTodayFuelPlan — today's fuel plan, built one way.

   The Nutrition hero, its fuel horizon and the fuel log below it
   (FuelCommandPanel) all read this, so the meal a member logs from the hero
   carries the same id, time and macros as the card it ticks in the log.
   Times come from the schedule engine, so no meal lands past the sleep target.

   `now` is the screen's clock. Without one it reads the wall clock, which is
   how FuelCommandPanel has always built it.
   ════════════════════════════════════════════════════════════════════════ */

import { useCallback, useMemo } from "react";

import { useAthleteDashboardStore } from "@/lib/athlete-store";
import { resolveMemberBodyweight } from "@/lib/profile/bodyweight";
import { buildMealPlan, localScheduleDateKey } from "@/lib/schedule/engine";
import { weekDateKeys } from "@/lib/training/split-customization";
import { useTodayTrainingDay } from "@/lib/training/useTodayTrainingDay";

import { buildDailyFuelPlan, fuelGoalFromString, purposeToSlot, type PlanFavoriteInput } from "./fuel-plan";
import { personalizationFromPrefs } from "./fuel-personalization";
import { planCoversDay } from "./member-meal-plan";
import { buildMemberPlanDay } from "./member-plan-fuel";
import { PEAK_LOOKS, isPeakLook } from "./peak-mode";
import { fuelWindowsFromPlan } from "./scheduled-fuel-windows";
import { useNutritionAlignment } from "./useNutritionAlignment";

export function useTodayFuelPlan(now?: Date) {
  const profile = useAthleteDashboardStore((s) => s.profile);
  const scheduleProfile = useAthleteDashboardStore((s) => s.scheduleProfile);
  const activeProtocol = useAthleteDashboardStore((s) => s.activeProtocol);
  const prefs = useAthleteDashboardStore((s) => s.nutritionPrefs);
  const memberMealPlans = useAthleteDashboardStore((s) => s.memberMealPlans);
  const activeMemberMealPlanId = useAthleteDashboardStore((s) => s.activeMemberMealPlanId);
  const weighIns = useAthleteDashboardStore((s) => s.physiqueCommand.entries);
  const baselineWeightLb = useAthleteDashboardStore((s) => s.setupProfile.baselineWeightLb);

  /* The member's real bodyweight, or none. With none, the plan's targets are a
     disclosed reference estimate (targets.basis === "reference-weight"). */
  const memberBodyweight = useMemo(
    () => resolveMemberBodyweight({ weighIns, baselineWeightLb, profileBodyweightLb: prefs.bodyweightLb }),
    [weighIns, baselineWeightLb, prefs.bodyweightLb],
  );

  /** Consolidated personalization from prefs — passed to plan + swap engines. Apex reads the same. */
  const personalization = useMemo(
    () =>
      personalizationFromPrefs({
        dislikedFoods: prefs.dislikedFoods,
        allergies: prefs.allergies,
        excludedFoods: prefs.excludedFoods,
        favoriteProteinSources: prefs.favoriteProteinSources,
        favoriteCarbSources: prefs.favoriteCarbSources,
        prepPreference: prefs.prepPreference,
        cookingEquipment: prefs.cookingEquipment,
        dietStyle: prefs.dietStyle,
        dairyAllowed: prefs.dairyAllowed,
        peakLook: prefs.peakLook,
        peakKitchen: prefs.peakKitchen,
      }),
    [prefs.dislikedFoods, prefs.allergies, prefs.excludedFoods, prefs.favoriteProteinSources, prefs.favoriteCarbSources, prefs.prepPreference, prefs.cookingEquipment, prefs.dietStyle, prefs.dairyAllowed, prefs.peakLook, prefs.peakKitchen],
  );

  /* Member favorites mapped into the plan's input shape (influences generation). */
  const favoriteInputs: PlanFavoriteInput[] = useMemo(
    () => (prefs.signatureMeals ?? []).filter((m) => m.favorite).map((m) => ({
      id: m.id,
      name: m.name,
      slot: purposeToSlot(m.purpose),
      macros: m.macros ? { calories: m.macros.calories, proteinG: m.macros.proteinG, carbsG: m.macros.carbsG, fatG: m.macros.fatG } : null,
      ingredients: m.ingredients.map((i) => (i.amount != null && i.unit ? `${i.amount}${i.unit} ${i.name}` : i.name)),
    })),
    [prefs.signatureMeals],
  );

  /* Peak Mode: the look the member picked sets the goal every Nutrition surface builds from. */
  const peakLook = isPeakLook(prefs.peakLook) ? prefs.peakLook : null;
  const goal = useMemo(
    () => (peakLook ? PEAK_LOOKS[peakLook].goal : fuelGoalFromString(activeProtocol?.goal ?? profile.goal)),
    [peakLook, activeProtocol?.goal, profile.goal],
  );

  /* The protocol↔nutrition engine's macros for today, already picked by day kind.
     The generated plate day scales to these so the meals obey the protocol, its
     phase and today's training — the single source Apex and Nutrition show.
     Peak Mode keeps its own look-driven goal, so the override steps aside there;
     with no bodyweight on file the engine returns null and the estimate stands. */
  const alignment = useNutritionAlignment(now);
  const macroTarget = useMemo(
    () => (peakLook ? null : alignment.todayMacros),
    [peakLook, alignment.todayMacros],
  );

  /* Today's day from the resolver Apex and Training read — never a parallel week. */
  const { dailyContext, today: resolvedToday, trainingContext, trainingPlanned } = useTodayTrainingDay(now);
  const today = useMemo(() => ({ ...resolvedToday, sessionName: resolvedToday.displayTitle }), [resolvedToday]);
  const trainingWeek = useMemo(
    () => dailyContext.weeklyPlan.map((d) => ({ day: d.day, sessionName: d.displayTitle, recovery: d.recovery })),
    [dailyContext.weeklyPlan],
  );

  /* Schedule-engine-computed times — applies bedtime-aware adjustments so the
     raw stored window times (e.g. 23:10 post-workout) are never used directly.

     The context alone is NOT the answer to "does today train": `trainingPlanned`
     on a raw schedule context is true whenever nothing was moved, including on a
     recovery day. Passing it straight through gave a plain recovery day a
     pre-workout meal on Nutrition and Schedule, fuelling a session that does not
     exist. The resolved day (`trainingPlanned`, which folds in `today.recovery`)
     is the one rule every surface reads, so the meal windows follow it too. */
  const scheduledMeals = useMemo(
    () => buildMealPlan(scheduleProfile, { trainingPlanned, direction: trainingContext.direction }),
    [scheduleProfile, trainingPlanned, trainingContext.direction],
  );

  /* The plan's date: the day's plates rotate by it, so they hold still all day and change tomorrow. */
  const dateKey = localScheduleDateKey(now);
  const loggedMealIds = prefs.loggedMealIds;
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the week re-keys when the date changes
  const weekKeys = useMemo(() => weekDateKeys(now ?? new Date()), [now, dateKey]);

  /* The member's own plan, when one is running. A plan with no meals for
     today's day type does not take the day over — an empty rest-day set
     would otherwise blank Nutrition on a rest day. */
  const activePlan = useMemo(
    () => memberMealPlans.find((p) => p.id === activeMemberMealPlanId) ?? null,
    [memberMealPlans, activeMemberMealPlanId],
  );
  const planRunsToday = activePlan !== null && planCoversDay(activePlan, trainingPlanned);
  /* A plan that is running but has nothing written for today's day type. The
     generated plan carries the day instead — every surface that says the plan
     is running has to say this too, or the member is told their plan is in
     control on a day it is not. */
  const planDayUnwritten = activePlan !== null && !planRunsToday;

  const dailyPlan = useMemo(() => {
    if (activePlan && planCoversDay(activePlan, trainingPlanned)) {
      return buildMemberPlanDay({
        plan: activePlan,
        goal,
        isTrainingDay: trainingPlanned,
        sessionName: trainingPlanned ? today.sessionName : "Recovery Day",
        mealWindows: fuelWindowsFromPlan(scheduledMeals),
        sleepTarget: scheduleProfile.sleepTarget,
        wakeTime: scheduleProfile.wakeTime,
      });
    }
    return buildDailyFuelPlan({
      goal,
      isTrainingDay: trainingPlanned,
      sessionName: trainingPlanned ? today.sessionName : "Recovery Day",
      /* The engine's meals as they are: times, labels, slots and the optional shake. */
      mealWindows: fuelWindowsFromPlan(scheduledMeals),
      bodyweightLb: memberBodyweight?.lb ?? null,
      favorites: favoriteInputs,
      personalization,
      sleepTarget: scheduleProfile.sleepTarget,
      wakeTime: scheduleProfile.wakeTime,
      date: dateKey,
      loggedMealIds,
      macroTarget,
    });
  }, [activePlan, goal, today.sessionName, trainingPlanned, scheduleProfile, favoriteInputs, personalization, scheduledMeals, memberBodyweight, dateKey, loggedMealIds, macroTarget]);

  /* Any other day's plan, built the same way (the weekly fuel plan's lead plates read this). */
  const planForDate = useCallback(
    (date: string, isTrainingDay: boolean, sessionName: string) => {
      if (activePlan && planCoversDay(activePlan, isTrainingDay)) {
        return buildMemberPlanDay({
          plan: activePlan,
          goal,
          isTrainingDay,
          sessionName: isTrainingDay ? sessionName : "Recovery Day",
          mealWindows: fuelWindowsFromPlan(buildMealPlan(scheduleProfile, { trainingPlanned: isTrainingDay, direction: "unchanged" })),
          sleepTarget: scheduleProfile.sleepTarget,
          wakeTime: scheduleProfile.wakeTime,
        });
      }
      return buildDailyFuelPlan({
        goal,
        isTrainingDay,
        sessionName: isTrainingDay ? sessionName : "Recovery Day",
        mealWindows: fuelWindowsFromPlan(buildMealPlan(scheduleProfile, { trainingPlanned: isTrainingDay, direction: "unchanged" })),
        bodyweightLb: memberBodyweight?.lb ?? null,
        favorites: favoriteInputs,
        personalization,
        sleepTarget: scheduleProfile.sleepTarget,
        wakeTime: scheduleProfile.wakeTime,
        date,
      });
    },
    [activePlan, goal, scheduleProfile, memberBodyweight, favoriteInputs, personalization],
  );

  return {
    goal,
    personalization,
    favoriteInputs,
    trainingWeek,
    today,
    trainingContext,
    /** A session is planned today: not a recovery day, not moved away. */
    trainingPlanned,
    dailyPlan,
    /** The member's own plan, when one is running today. Null means the generated plan. */
    activeMealPlan: planRunsToday ? activePlan : null,
    /** The active plan has no meals for today's day type, so the generated plan carries the day. */
    planDayUnwritten,
    /** The day type the active plan left empty, for the surface that has to say so. */
    planUnwrittenDay: planDayUnwritten ? (trainingPlanned ? ("training" as const) : ("rest" as const)) : null,
    /** Today's date key, and the week's (Monday first), for the plans that rotate by date. */
    dateKey,
    weekDateKeys: weekKeys,
    planForDate,
    /** Null when no bodyweight is on file — the targets then use a disclosed reference. */
    memberBodyweight,
  };
}
