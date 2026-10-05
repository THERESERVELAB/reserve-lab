/* ════════════════════════════════════════════════════════════════════════
   useNutritionAlignment — single source of nutrition-alignment truth for the UI.

   Reads the member + protocol + focus + activity stack + today's training day
   from the store, runs the protocol↔nutrition alignment engine, and returns a
   resolution + macro targets + today's day-kind. Apex and Nutrition Command
   both call this so they can never disagree. Organization only — no medical
   claims, no guaranteed outcomes.
   ════════════════════════════════════════════════════════════════════════ */

import { useMemo } from "react";

import { useAthleteDashboardStore } from "@/lib/athlete-store";
import { useTodayTrainingDay } from "@/lib/training/useTodayTrainingDay";
import { computeProtocolProgress, getProtocol } from "@/lib/protocol/library";
import { architectureFingerprint } from "@/lib/training/architecture-profile";
import { phaseForProtocolWeek, type TrainingPhase } from "@/lib/training/workout-templates";
import { useActiveProgram } from "@/lib/hooks/useActiveProgram";
import { resolveMemberBodyweight } from "@/lib/profile/bodyweight";
import { trainingPhaseFromHorizon } from "@/lib/horizon/training-adapter";
import {
  resolveProtocolNutritionBias,
  resolveMacroTargets,
  buildMealPlanGuardrails,
  macrosForDay,
  type DayKind,
  type ProtocolNutritionResolution,
  type ResolvedMacroTargets,
  type MealPlanGuardrails,
} from "./protocol-alignment";
import type { MacroTargets, DietStyleKey } from "./types";

export type NutritionAlignment = {
  resolution: ProtocolNutritionResolution;
  macros: ResolvedMacroTargets;
  guardrails: MealPlanGuardrails;
  /** Today's macro set, picked by day kind. */
  todayMacros: MacroTargets | null;
  dayKind: DayKind;
  dayLabel: string;
  protocolName: string | null;
  sessionName: string;
  isRecoveryDay: boolean;
  /** Long-protocol training phase the macros are tuned for (null = no active week). */
  trainingPhase: TrainingPhase | null;
  /** One-line note on how this phase's nutrition differs across the 12–24 week block. */
  phaseProgressionNote: string;
  /** "tdee" when sex/height/age personalized calories, else "bodyweight". */
  calorieBasis: "tdee" | "bodyweight";
};

const DAY_LABEL: Record<DayKind, string> = {
  training: "Training Day",
  rest: "Rest Day",
  "lower-body": "Lower-Body Day",
  "high-output": "High-Output Day",
  conditioning: "Conditioning Day",
  recovery: "Recovery Day",
};

const LOWER_TRANSFORMS = new Set([
  "glute-strength", "quad-volume", "glute-shape",
  "glute-strength-waist", "quad-shape-glute-support", "glute-hamstring-shape",
]);

export function useNutritionAlignment(now?: Date): NutritionAlignment {
  const activeProtocol = useAthleteDashboardStore((s) => s.activeProtocol);
  const physiqueCommand = useAthleteDashboardStore((s) => s.physiqueCommand);
  const nutritionPrefs = useAthleteDashboardStore((s) => s.nutritionPrefs);
  const setupProfile = useAthleteDashboardStore((s) => s.setupProfile);
  const activityStack = useAthleteDashboardStore((s) => s.activityStack);
  const activeProgram = useActiveProgram();
  const activeResolution = activeProgram.resolution;
  /* Today's day from the resolver Apex and Training read, with the member's
     chosen split and own day edits, so the header never names another day. */
  const { today, trainingContext } = useTodayTrainingDay(now);

  return useMemo(() => {
    const focus = physiqueCommand.focus;
    const goal = activeProtocol?.goal ?? null;


    // Day-kind from today's resolved session signal. Recovery/rest stay controlled;
    // explicit conditioning / sport days use conditioning macros; heavy lower / glute
    // days keep the lower-body bump; genuinely athletic sessions read high-output;
    // everything else is a standard training day.
    const daySignal = `${today.archetype ?? ""} ${today.transform ?? ""} ${today.displayTitle ?? ""} ${today.goal ?? ""}`.toLowerCase();
    const isLowerBody = LOWER_TRANSFORMS.has(today.transform) || today.splitKey === "legs" || today.splitKey === "lower" || today.splitKey === "lower-posterior";
    let dayKind: DayKind = "training";
    if (!trainingContext.trainingPlanned) dayKind = "recovery";
    else if (trainingContext.direction === "moved-here") dayKind = "training";
    else if (today.recovery) dayKind = "recovery";
    else if (/conditioning|sport-condition|zone ?2|\bsport\b/.test(daySignal)) dayKind = "conditioning";
    else if (isLowerBody) dayKind = "lower-body";
    else if (/athletic|sprint|explosive|full-body-athletic|high.?output|\bpower\b/.test(daySignal)) dayKind = "high-output";

    // Long-protocol week → training phase (read-only training context), so nutrition
    // evolves across the 12–24 week block instead of staying static.
    const prog = activeProtocol ? computeProtocolProgress(activeProtocol, now ?? new Date()) : null;
    const trainingPhase: TrainingPhase | null = activeResolution
      ? trainingPhaseFromHorizon(activeResolution.currentPhaseKind, activeResolution.activeWeek.phaseWeek)
      : prog && prog.totalWeeks > 0 ? phaseForProtocolWeek(prog.currentWeek, prog.totalWeeks) : null;

    const resolution = resolveProtocolNutritionBias({
      protocolId: activeProtocol?.protocolId ?? null,
      protocolCategory: activeProtocol?.category ?? null,
      goal,
      primaryFocus: focus?.primary ?? null,
      secondaryFocus: focus?.secondary ?? null,
      womensTrack: focus?.track ?? null,
      activityStack,
      hasBodyData: Boolean(setupProfile.baselineWeightLb),
    });

    // Training architecture load → nutrition follows training.
    const archDef = activeProtocol ? getProtocol(activeProtocol.protocolId) : null;
    const trainingLoad = archDef
      ? { intentMix: architectureFingerprint(archDef).intentMix, trainingDaysPerWeek: setupProfile.trainingDaysPerWeek ?? 4 }
      : null;

    const macros = resolveMacroTargets({
      phase: resolution.nutritionPhase,
      /* The member's real weight, resolved as the fuel log does (latest weigh-in, then baseline, then setup). */
      bodyweightLb: resolveMemberBodyweight({
        weighIns: physiqueCommand.entries,
        baselineWeightLb: setupProfile.baselineWeightLb,
        profileBodyweightLb: nutritionPrefs.bodyweightLb,
      })?.lb ?? null,
      dietStyle: (nutritionPrefs.dietStyle as DietStyleKey) ?? "standard",
      hasConfirmedBodyData: Boolean(setupProfile.baselineWeightLb),
      bodyProfile: {
        sex: setupProfile.sex,
        heightIn: setupProfile.heightIn,
        age: setupProfile.age,
        trainingDaysPerWeek: setupProfile.trainingDaysPerWeek,
      },
      trainingPhase,
      trainingLoad,
    });

    return {
      resolution,
      macros,
      guardrails: buildMealPlanGuardrails(resolution),
      todayMacros: macrosForDay(macros, dayKind),
      dayKind,
      dayLabel: DAY_LABEL[dayKind],
      protocolName: activeResolution?.protocolName ?? activeProtocol?.protocolName ?? null,
      sessionName: !trainingContext.trainingPlanned
        ? `Recovery day · session moved to ${trainingContext.targetDate ?? "another day"}`
        : today.displayTitle,
      isRecoveryDay: dayKind === "recovery",
      trainingPhase,
      phaseProgressionNote: macros.phaseProgressionNote,
      calorieBasis: macros.calorieBasis,
    };
  }, [activeProtocol, activeResolution, physiqueCommand, nutritionPrefs, setupProfile, activityStack, today, trainingContext, now]);
}
