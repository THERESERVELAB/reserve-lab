"use client";

import { useMemo } from "react";

import { compoundIdentity, RECENT_SYMPTOM_HOURS, useSafetyContext } from "@/components/safety/useSafetyContext";
import { useAthleteDashboardStore } from "@/lib/athlete-store";
import { dateKeyOf } from "@/lib/cycle/cycle-period";
import { buildCycleReview, type CycleReviewInput, type PlanCompound } from "@/lib/cycle-review/report";
import { buildTrainingRecovery } from "@/lib/cycle-review/training-recovery";
import { useNutritionAlignment } from "@/lib/nutrition/useNutritionAlignment";

/**
 * Reads every record the cycle review needs and runs the engine once.
 * Values the member never entered stay undefined — the nutrition store's
 * default bodyweight, for example, is not treated as the member's weight.
 */
export function useCycleReview(now: Date) {
  const ctx = useSafetyContext(now);
  const cycleGoals = useAthleteDashboardStore((s) => s.cycleGoals);
  const cycleCheckIns = useAthleteDashboardStore((s) => s.cycleCheckIns);
  const sleepLogs = useAthleteDashboardStore((s) => s.recoveryCommand.sleepLogs);
  const physiqueEntries = useAthleteDashboardStore((s) => s.physiqueCommand.entries);
  const sessions = useAthleteDashboardStore((s) => s.trainingSession.executionHistory);
  const setupProfile = useAthleteDashboardStore((s) => s.setupProfile);
  const supportPlan = useAthleteDashboardStore((s) => s.supportPlan);
  const coachingProfile = useAthleteDashboardStore((s) => s.profile.coachingProfile);
  const allergies = useAthleteDashboardStore((s) => s.nutritionPrefs.allergies);
  const alignment = useNutritionAlignment();
  const nutritionPhase = alignment.resolution.nutritionPhase;
  const todayMacros = alignment.todayMacros;

  return useMemo(() => {
    const state = ctx.cycleState;
    if (!state) return null;
    const today = dateKeyOf(now);
    const goalSetup = cycleGoals[state.cycle.id] ?? null;

    const compounds: PlanCompound[] = ctx.compounds
      .filter((entry) => state.cycle.compoundIds.includes(entry.id))
      .map((entry) => {
        const identity = compoundIdentity(entry);
        return {
          id: entry.id,
          name: identity.name,
          officialName: identity.officialName,
          compoundClass: identity.compoundClass,
          amount: entry.doseAmount,
          unit: entry.doseUnit,
          frequency: entry.frequency,
          route: entry.route,
          sourceType: entry.sourceType,
          startDate: entry.startDate,
          isActive: entry.isActive,
          pausedAt: entry.pausedAt,
        };
      });

    const checkIns = cycleCheckIns.filter((c) => !c.cycleId || c.cycleId === state.cycle.id);
    const sleep = (sleepLogs ?? []).map((log) => ({ date: log.date.slice(0, 10), hours: log.hours }));
    const entries = [...(physiqueEntries ?? [])].sort((a, b) => a.date.localeCompare(b.date));
    const latestEntry = entries.at(-1);
    const restingHrEntries = entries
      .filter((e) => typeof e.restingHeartRate === "number")
      .map((e) => ({ date: e.date.slice(0, 10), bpm: e.restingHeartRate! }));
    const cutoff = now.getTime() - RECENT_SYMPTOM_HOURS * 3_600_000;

    const input: CycleReviewInput = {
      today,
      member: {
        age: setupProfile?.age,
        sex: setupProfile?.sex,
        heightIn: setupProfile?.heightIn,
        weightLb: latestEntry?.bodyWeightLb ?? setupProfile?.baselineWeightLb,
        bodyFatPct: latestEntry?.bodyFatPct,
      },
      cycleState: state,
      goalSetup,
      compounds,
      labBrief: ctx.labBrief,
      markerLinks: ctx.riskBrief.markerLinks,
      escalation: ctx.escalation,
      recentRedFlagCount: ctx.redFlagReports.filter((r) => Date.parse(r.reportedAt) >= cutoff).length,
      checkIns,
      sleepLogs: sleep,
      weights: entries.map((e) => ({ date: e.date.slice(0, 10), weightLb: e.bodyWeightLb })),
      nutritionPhase,
      todayMacros,
      training: buildTrainingRecovery({
        sessions: sessions ?? [],
        sleepLogs: sleep,
        checkIns,
        restingHrEntries,
        cycleStart: state.cycle.startDate,
        today,
      }),
      supportPlan: supportPlan ?? [],
      logged: ctx.compounds.map((entry) => {
        const identity = compoundIdentity(entry);
        return {
          name: identity.name,
          officialName: identity.officialName,
          compoundClass: identity.compoundClass,
          category: entry.category,
          route: entry.route,
          isActive: entry.isActive && !entry.pausedAt,
        };
      }),
      medicationsText: coachingProfile?.medications ?? "",
      healthContext: coachingProfile?.healthContext ?? [],
      allergies: allergies ?? [],
    };

    return { input, review: buildCycleReview(input), goalSetup, cycleState: state, compounds };
  }, [ctx, cycleGoals, cycleCheckIns, sleepLogs, physiqueEntries, sessions, setupProfile, nutritionPhase, todayMacros, supportPlan, coachingProfile, allergies, now]);
}

export type CycleReviewModel = NonNullable<ReturnType<typeof useCycleReview>>;
