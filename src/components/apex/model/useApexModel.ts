"use client";

/* ════════════════════════════════════════════════════════════════════════
   APEX MODEL — every read the home screen makes, in one hook.

   The derivations moved here from the retired ApexCommandV2 unchanged —
   engines, thresholds and copy are the ones that shipped. Two things are new,
   and both make the screen agree with itself:

   · `trainingContext` — moved, skipped or reset sessions reach the engines,
     the meal plan and the day timeline alike.
   · `todayResolved` — the day the week rail shows, including the member's own
     day edits, drives every member-facing decision.
   ════════════════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useState } from "react";

import { buildMealPlan, localScheduleDateKey, resolveTrainingScheduleContext } from "@/lib/schedule/engine";
import { buildRecoverySnapshot } from "@/lib/recovery/engine";
import { useAthleteDashboardStore } from "@/lib/athlete-store";
import { useProgramWeek } from "@/lib/program/useProgramWeek";
import { getSplitSystem } from "@/lib/training/split-architect";
import { getArchitectureForSystem } from "@/lib/training/split-architectures";
import {
  getEnhancementDailySchedule,
  summarizeEnhancementSchedule,
  type EnhancementScheduleSlot,
} from "@/lib/enhancement/schedule";
import { buildApexView } from "@/lib/apex/engine";
import {
  buildBiomarkerCommand,
  buildEnhancedCommand,
  buildEvidenceWatch,
  buildMeasurementReview,
  buildPhotoReview,
  type BiomarkerCommand,
  type EnhancedCommand,
  type EvidenceItem,
  type MeasurementReview,
  type PhotoReview,
} from "@/lib/apex/command-intelligence";
import { readinessStatement } from "@/lib/apex/statement";
import { computeProtocolProgress, getProtocol } from "@/lib/protocol/library";
import { resolveTrainingArchitecture, resolveFocusArchitecture } from "@/lib/protocol/architecture";
import { buildProjectedWeekResolvedWeek, resolveDailyTrainingContext, toApexWeekDays } from "@/lib/training/daily-context";
import { isReserveAthlete } from "@/lib/training/reserve-athlete";
import { isTrainingPlannedToday } from "@/lib/training/training-planned";
import { getBlueprintForProtocol } from "@/lib/training/split-blueprints";
import { completedSplitDaysThisWeek, resolveGamePlanWeek } from "@/lib/training/game-plan";
import { protocolIntensityTier, type IntensityTier } from "@/lib/training/workout-templates";
import {
  buildExplicitFallbackWeek,
  buildProtocolWeek,
  getTemplateForDay,
  getTodayTrainingWeekDay,
} from "@/lib/training/weekly-split";
import {
  buildDailyFuelPlan,
  fuelGoalFromString,
  type MealPersonalization,
  type PlanFavoriteInput,
  purposeToSlot,
} from "@/lib/nutrition/fuel-plan";
import { personalizationFromPrefs } from "@/lib/nutrition/fuel-personalization";
import { PEAK_LOOKS, isPeakLook } from "@/lib/nutrition/peak-mode";
import { fuelWindowsFromPlan } from "@/lib/nutrition/scheduled-fuel-windows";
import { doseAnchorsFrom } from "@/lib/enhancement/dose-timing";
import { useNutritionAlignment } from "@/lib/nutrition/useNutritionAlignment";
import { useActiveProgram } from "@/lib/hooks/useActiveProgram";
import { resolveMemberBodyweight } from "@/lib/profile/bodyweight";
import { DOW_BY_SHORT, FIXED_NOON, formatClock, hmToMinutes } from "./apex-format";

export function useApexModel() {
  const profile = useAthleteDashboardStore((s) => s.profile);
  const schedule = useAthleteDashboardStore((s) => s.scheduleProfile);
  const recovery = useAthleteDashboardStore((s) => s.recoveryCommand);
  const physique = useAthleteDashboardStore((s) => s.physiqueCommand);
  const womens = useAthleteDashboardStore((s) => s.womens);
  const enhancedLogOnly = useAthleteDashboardStore((s) => s.modulePreferences.enhancedLogOnly);
  const trainingSessionMode = useAthleteDashboardStore((s) => s.trainingSession.sessionMode);
  const enhancementLog = useAthleteDashboardStore((s) => s.trainingSession.enhancementLog);
  const enhancementAdherence = useAthleteDashboardStore((s) => s.trainingSession.enhancementAdherence);
  const injectionLogs = useAthleteDashboardStore((s) => s.trainingSession.injectionLogs);
  const activeProtocol = useAthleteDashboardStore((s) => s.activeProtocol);
  const splitSystem = useAthleteDashboardStore((s) => s.splitSystem);
  const activityStack = useAthleteDashboardStore((s) => s.activityStack);
  const activitySport = useAthleteDashboardStore((s) => s.activitySport);
  const nutritionPrefs = useAthleteDashboardStore((s) => s.nutritionPrefs);
  const bloodworkLogs = useAthleteDashboardStore((s) => s.bloodworkLogs);
  const setupProfile = useAthleteDashboardStore((s) => s.setupProfile);
  const onboardingCompletedAt = useAthleteDashboardStore((s) => s.onboarding.completedAt);
  const setEnhancedLogOnly = useAthleteDashboardStore((s) => s.setEnhancedLogOnly);
  const setActiveView = useAthleteDashboardStore((s) => s.setActiveView);
  const trainingOverrides = useAthleteDashboardStore((s) => s.trainingOverrides);
  const splitCustomization = useAthleteDashboardStore((s) => s.splitCustomization);
  /* ONE clock drives Apex: greeting, the now-marker, due states and counters
     all derive from this state. Ticks are aligned to the wall-clock minute so
     every "closes at" reads true the moment it changes. */
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    // setTimeout (not rAF): rAF suspends in background/headless tabs and would
    // leave the whole dashboard on the SSR fallback clock.
    const boot = setTimeout(() => setNow(new Date()), 0);
    let interval: ReturnType<typeof setInterval> | null = null;
    const msToNextMinute = (60 - new Date().getSeconds()) * 1000 - new Date().getMilliseconds() + 50;
    const align = setTimeout(() => {
      setNow(new Date());
      interval = setInterval(() => setNow(new Date()), 60_000);
    }, Math.max(250, msToNextMinute));
    return () => { clearTimeout(boot); clearTimeout(align); if (interval) clearInterval(interval); };
  }, []);

  /* Moved, skipped or reset sessions reach every schedule read on this screen —
     the engines, the day timeline and the fuel plan see the same day. */
  const trainingContext = useMemo(
    () => resolveTrainingScheduleContext(trainingOverrides, localScheduleDateKey(now ?? FIXED_NOON)),
    [trainingOverrides, now],
  );
  const recoverySnapshot = useMemo(() => buildRecoverySnapshot(recovery, now ?? FIXED_NOON), [recovery, now]);
  /* The member's program week, so the Pit Wall rail shows the days Training
     Command will actually load (lib/program/resolved-week). FIXED_NOON before
     hydration, like every other clock read here. */
  const programWeek = useProgramWeek(now ?? FIXED_NOON);

  const apex = useMemo(
    () => buildApexView({ schedule, recovery, physique, womens, enhancedLogOnly, trainingSessionMode, now: now ?? FIXED_NOON, trainingContext }),
    [schedule, recovery, physique, womens, enhancedLogOnly, trainingSessionMode, now, trainingContext],
  );
  const protocolProgress = useMemo(
    () => (activeProtocol ? computeProtocolProgress(activeProtocol, now ?? FIXED_NOON) : null),
    [activeProtocol, now],
  );
  /* Game-plan week — the SAME resolver Training Command uses, so the two
     surfaces rotate the week identically. */
  const gamePlanWeek = useMemo(
    () => resolveGamePlanWeek(activeProtocol, onboardingCompletedAt, now ?? FIXED_NOON),
    [activeProtocol, onboardingCompletedAt, now],
  );
  const activeProgram = useActiveProgram({ now: now ?? FIXED_NOON });
  const activeResolution = activeProgram.resolution;
  const executionWeekNumber = activeResolution?.currentWeekNumber ?? gamePlanWeek.week;
  const executionTimelineLabel = activeResolution
    ? `Week ${activeResolution.currentWeekNumber} / ${activeResolution.horizon.totalWeeks}`
    : protocolProgress?.timelineLabel ?? "No active program";
  const executionPhaseLabel = activeResolution?.currentPhaseName ?? protocolProgress?.phase?.label ?? null;
  /* Real completed-session records — honest done / missed day states. */
  const sessionHistory = useAthleteDashboardStore((s) => s.trainingSession.sessionHistory);
  const completedSplitDays = useMemo(
    () => completedSplitDaysThisWeek((sessionHistory ?? []).map((c) => c.date), now ?? FIXED_NOON),
    [sessionHistory, now],
  );
  const { briefing, heroMetrics, mission } = apex;
  const roi = briefing.highestRoiAction;

  /* Training-week identity (honest — derived from the Reserve split + templates) */
  const intensityTier = useMemo<IntensityTier>(() => {
    if (!activeProtocol) return "standard";
    const def = getProtocol(activeProtocol.protocolId);
    return protocolIntensityTier({ category: activeProtocol.category, difficulty: def?.difficulty, logOnly: def?.logOnly });
  }, [activeProtocol]);

  /* Protocol Architecture 2.0 — the active protocol drives the weekly identity,
     adapted to the member's availability, activity layers, priority, recovery. */
  const blueprintResolve = useMemo(
    () => ({
      protocolId: activeProtocol?.protocolId ?? null,
      category: activeProtocol?.category ?? null,
      trainingDaysTarget: setupProfile.trainingDaysPerWeek ?? null,
      activityStack,
      activitySport,
      recoveryPreference:
        profile.recoveryAggression === "conservative"
          ? "Protective"
          : profile.recoveryAggression === "aggressive"
            ? "Aggressive"
            : "Balanced",
      musclePriority: physique.weakPoints ?? [],
      weekNumber: executionWeekNumber,
    }),
    [activeProtocol?.protocolId, activeProtocol?.category, setupProfile.trainingDaysPerWeek, activityStack, activitySport, profile.recoveryAggression, physique.weakPoints, executionWeekNumber],
  );

  /* Shared training-week source of truth (matches Training Command). A valid
     Horizon bypasses blueprint regeneration completely. */
  const trainingWeek = useMemo(
    () => activeResolution
      ? toApexWeekDays(
          buildProjectedWeekResolvedWeek(activeResolution.activeWeek.weeklyStructure),
          now ?? FIXED_NOON,
          completedSplitDays,
        )
      : activeProtocol
        ? buildProtocolWeek({ tier: intensityTier, now: now ?? FIXED_NOON, resolve: blueprintResolve, completedSplitDays })
        : buildExplicitFallbackWeek(now ?? FIXED_NOON),
    [activeResolution, activeProtocol, intensityTier, now, blueprintResolve, completedSplitDays],
  );
  const todaySession = useMemo(() => getTodayTrainingWeekDay(trainingWeek), [trainingWeek]);

  /* Personalized coaching read — composed from real engine + template data. */
  const weakPointLabels = (physique.weakPoints ?? []).map((w) => w.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())).slice(0, 4);
  const physiqueEvidence = (physique.entries?.length ?? 0) + (physique.photoCheckIns?.length ?? 0);
  const checkInCadence = activeProtocol?.checkInCadence ?? "Weekly";

  /* ── Greeting (time-aware) ─────────────────────────────────────────────── */
  const clock = now ?? FIXED_NOON;
  const greetWord = clock.getHours() >= 5 && clock.getHours() < 12
    ? "Good Morning"
    : clock.getHours() >= 12 && clock.getHours() < 17
      ? "Good Afternoon"
      : "Good Evening";
  const memberName = (profile.name ?? "").trim();

  /* ── Active architecture — the SELECTED PROTOCOL is the source of truth.
        The protocol family resolves the visible architecture + session
        language so a Women's / Senior / Lifestyle / Home member never sees
        default bodybuilding copy. Physique families keep the member's own
        split name (sacred copy). ── */
  const chosenSplitSystem = getSplitSystem(splitSystem.key);
  const customSplitName = profile.trainingStyle?.trim() || "";
  const arch = useMemo(
    () => resolveTrainingArchitecture({
      activeProtocol,
      def: activeProtocol ? getProtocol(activeProtocol.protocolId) : null,
      week: trainingWeek,
      today: todaySession,
      customSplitName,
      chosenSplitSystemName: chosenSplitSystem?.name ?? null,
      hasCycleData: Boolean(womens.cycle?.lastPeriodStart),
      blueprintDriven: Boolean(activeProtocol),
    }),
    [activeProtocol, trainingWeek, todaySession, customSplitName, chosenSplitSystem?.name, womens.cycle?.lastPeriodStart],
  );
  /* Member Muscle Priority (Focus Engine) — the member-selected focus drives a
     focus-aware architecture name for the split identity. */
  const focusArch = useMemo(
    () => resolveFocusArchitecture(physique.focus, { womensActive: arch.family === "women_performance" }),
    [physique.focus, arch.family],
  );
  // Structural hybrid architectures (Reserve Athlete, Grand Touring) own the week
  // from their blueprint; the member's focus emphasizes INSIDE them. So the focus
  // does not drive the weekly STRUCTURE or its narrative here — only its label.
  const isStructuralArchitecture = Boolean(
    activeProtocol && (isReserveAthlete(activeProtocol.category, activeProtocol.protocolId) || activeProtocol.category === "hybrid-performance"),
  );
  const focusDrivesWeek = !activeResolution && focusArch.active && !isStructuralArchitecture;
  // Focus-aware architecture name overrides the protocol split label when set —
  // but never for a structural hybrid, whose blueprint name owns the label.
  const focusArchitectureName = focusDrivesWeek ? focusArch.architectureName : null;

  /* Unified daily training context — the SAME resolver Training Command uses,
     so Apex and Training can never disagree on today's session or the week. */
  const dailyContext = useMemo(
    () => resolveDailyTrainingContext({
      now: now ?? FIXED_NOON,
      focus: physique.focus,
      weakPoints: physique.weakPoints,
      protocolName: activeResolution?.protocolName ?? activeProtocol?.protocolName ?? null,
      protocolArchitectureName: activeResolution?.architectureName ?? arch.architectureName,
      womensActive: arch.family === "women_performance",
      // Pass the protocol so a hybrid / blueprint architecture (Grand Touring,
      // Reserve Athlete) drives the 7-Day Split rail here the same way it drives
      // Training Command — Apex and Training can never disagree on the week.
      protocolId: blueprintResolve.protocolId,
      protocolCategory: blueprintResolve.category,
      trainingDaysTarget: blueprintResolve.trainingDaysTarget,
      activityStack: blueprintResolve.activityStack,
      activitySport: blueprintResolve.activitySport,
      recoveryPreference: blueprintResolve.recoveryPreference,
      weekNumber: executionWeekNumber,
      activeHorizonWeek: activeResolution?.activeWeek.weeklyStructure,
      requireActiveHorizon: !activeResolution && !activeProtocol,
      splitSystemKey: splitSystem.key,
      splitSystemChosen: Boolean(splitSystem.selectedAt),
      splitRestDayIndex: splitSystem.restDayIndex,
      splitCustomization,
      programWeek,
    }),
    [programWeek, now, physique.focus, physique.weakPoints, activeProtocol, activeResolution, arch.architectureName, arch.family, blueprintResolve, executionWeekNumber, splitSystem.key, splitSystem.selectedAt, splitSystem.restDayIndex, splitCustomization],
  );
  /* Today's workout comes from the day the member actually trains — their
     split, rest day and own edits included — never from the weekday. */
  const todayTemplate = useMemo(
    () => getTemplateForDay(dailyContext.todaySession, intensityTier),
    [dailyContext.todaySession, intensityTier],
  );
  // A member-saved architecture uses the resolved week rail (same as Training)
  // even though its architectureKind stays "balanced".
  const memberArchitectureActive = Boolean(splitSystem.selectedAt && getArchitectureForSystem(splitSystem.key));
  /* A chosen split, or any day change the member made, must drive the rail.
     Structural hybrids resolve to "balanced" kind but still drive a blueprint
     week, so they use the resolved rail too. */
  const memberEditsActive = dailyContext.weeklyPlan.some((d) => d.memberEdit);
  const specializedWeek =
    Boolean(activeResolution) ||
    /* A program the member authored states every day of the week explicitly,
       so its week is the one to render. Without this the Pit Wall fell back
       to the canonical split and showed a different Tuesday than the one
       Training Command was about to load. */
    Boolean(programWeek?.length) ||
    memberArchitectureActive ||
    memberEditsActive ||
    (Boolean(activeProtocol) && (dailyContext.architectureKind !== "balanced" || isStructuralArchitecture));
  // 7-day rail: resolved week for specialized architectures; rich canonical otherwise.
  const apexWeek = useMemo(
    () => (specializedWeek ? toApexWeekDays(dailyContext.weeklyPlan, now ?? FIXED_NOON, completedSplitDays) : arch.weeklySplit),
    [specializedWeek, dailyContext.weeklyPlan, arch.weeklySplit, now, completedSplitDays],
  );
  /* THE DAY THE MEMBER SEES. `todaySession` comes from the program week, which
     never receives the member's own day edits; the rail's week does. Every
     member-facing decision below reads this edit-aware day, so a day the member
     set to rest is never offered as a session. */
  const todayResolved = useMemo(() => {
    const day = getTodayTrainingWeekDay(apexWeek);
    /* The resolved week carries no durations (`toApexWeekDays` leaves them null).
       When it is the same session the program week planned, that template's
       duration is still true; a different session gets none rather than a guess. */
    return day.durationMin == null && day.sessionName === todaySession.sessionName
      ? { ...day, durationMin: todaySession.durationMin }
      : day;
  }, [apexWeek, todaySession]);
  /* Same rule as useTodayTrainingDay: a session moved onto a recovery day still trains. */
  const trainingPlanned = isTrainingPlannedToday(trainingContext, todayResolved.recovery);
  /* Specialized families assert the family architecture; physique families
     keep the member's sacred custom split name. A structural hybrid's blueprint
     name owns the label (its week no longer matches a focus-derived split name). */
  const splitIdentity = activeResolution
    ? activeResolution.architectureName
    : isStructuralArchitecture
    ? getBlueprintForProtocol(activeProtocol!.protocolId, activeProtocol!.category).name
    : focusArchitectureName
      ?? (arch.hasProtocol
        ? arch.architectureName
        : customSplitName
          || chosenSplitSystem?.name
          || activeProtocol?.protocolName?.trim()
          || todaySession?.sessionName?.trim()
          || null);

  /* ── Intake schedule — user-entered compounds/supplements/vitamins (log-only) ── */
  const trainingDow = useMemo(() => {
    const days = trainingWeek
      .filter((d) => !d.recovery)
      .map((d) => DOW_BY_SHORT[d.day.slice(0, 3)])
      .filter((n): n is number => n !== undefined);
    return days.length ? days : undefined;
  }, [trainingWeek]);

  /* Schedule-engine-computed times — prevents raw stored window times (e.g.
     23:10 post-workout) from appearing as planned meals after bedtime. */
  const scheduledMeals = useMemo(
    () => buildMealPlan(schedule, { trainingPlanned, direction: trainingContext.direction }),
    [schedule, trainingPlanned, trainingContext.direction],
  );

  /* Dose rules set against a meal, waking or bed resolve against the same day Compound Command reads (useDoseAnchors). */
  const doseAnchors = useMemo(() => doseAnchorsFrom(schedule, fuelWindowsFromPlan(scheduledMeals), trainingPlanned), [schedule, scheduledMeals, trainingPlanned]);

  const intakeSlots = useMemo(() => {
    const entries = (enhancementLog ?? []).filter((e) => e.isActive && !e.pausedAt);
    if (!entries.length) return [] as EnhancementScheduleSlot[];
    return getEnhancementDailySchedule({
      entries,
      adherence: enhancementAdherence ?? [],
      isTrainingDay: trainingPlanned,
      trainingDaysOfWeek: trainingDow,
      wakeTime: schedule.wakeTime,
      sleepTime: schedule.sleepTarget,
      preferredGymTime: schedule.preferredTrainingStart,
      anchors: doseAnchors,
    });
  }, [enhancementLog, enhancementAdherence, trainingPlanned, trainingDow, schedule.wakeTime, schedule.sleepTarget, schedule.preferredTrainingStart, doseAnchors]);

  const intakeSummary = useMemo(() => summarizeEnhancementSchedule(intakeSlots), [intakeSlots]);

  /* ── Nutrition alignment — protocol-matched macro truth (shared w/ Nutrition Command) ── */
  const nutritionAlignment = useNutritionAlignment();

  /* ── Fuel plan — personalization mirrors FuelCommandPanel exactly ── */
  /* The goal Nutrition builds from (useTodayFuelPlan): Peak Mode's look when one is picked, else the
     protocol's goal, else the member's own — so Apex's Fuel sheet reads the same four targets. */
  const nutritionGoal = isPeakLook(nutritionPrefs.peakLook)
    ? PEAK_LOOKS[nutritionPrefs.peakLook].goal
    : fuelGoalFromString(activeProtocol?.goal ?? profile.goal);

  /** Same personalization shape as FuelCommandPanel so Apex shows the same meals. */
  const nutritionPersonalization = useMemo<MealPersonalization>(
    () =>
      personalizationFromPrefs({
        dislikedFoods: nutritionPrefs.dislikedFoods,
        allergies: nutritionPrefs.allergies,
        excludedFoods: nutritionPrefs.excludedFoods,
        favoriteProteinSources: nutritionPrefs.favoriteProteinSources,
        favoriteCarbSources: nutritionPrefs.favoriteCarbSources,
        prepPreference: nutritionPrefs.prepPreference,
        cookingEquipment: nutritionPrefs.cookingEquipment,
        dietStyle: nutritionPrefs.dietStyle,
        dairyAllowed: nutritionPrefs.dairyAllowed,
        peakLook: nutritionPrefs.peakLook,
        peakKitchen: nutritionPrefs.peakKitchen,
      }),
    [
      nutritionPrefs.dislikedFoods,
      nutritionPrefs.allergies,
      nutritionPrefs.excludedFoods,
      nutritionPrefs.favoriteProteinSources,
      nutritionPrefs.favoriteCarbSources,
      nutritionPrefs.prepPreference,
      nutritionPrefs.cookingEquipment,
      nutritionPrefs.dietStyle,
      nutritionPrefs.dairyAllowed,
      nutritionPrefs.peakLook,
      nutritionPrefs.peakKitchen,
    ],
  );

  /** Favorite meals shaped for the plan engine — same as FuelCommandPanel. */
  const nutritionFavorites = useMemo<PlanFavoriteInput[]>(
    () =>
      (nutritionPrefs.signatureMeals ?? [])
        .filter((m) => m.favorite)
        .map((m) => ({
          id: m.id,
          name: m.name,
          slot: purposeToSlot(m.purpose),
          macros: m.macros
            ? { calories: m.macros.calories, proteinG: m.macros.proteinG, carbsG: m.macros.carbsG, fatG: m.macros.fatG }
            : null,
          ingredients: m.ingredients.map((i) => (i.amount != null && i.unit ? `${i.amount}${i.unit} ${i.name}` : i.name)),
        })),
    [nutritionPrefs.signatureMeals],
  );


  /* True when any user-entered compound/peptide/hormone slot is in the evening
     window near the sleep target. Used only for a safe log-only copy note. */
  const hasEveningLog = useMemo(() => {
    const sleepMins = hmToMinutes(schedule.sleepTarget) ?? 22 * 60;
    return intakeSlots.some((s) => {
      if (!s.plannedTime || s.plannedTime === "—") return false;
      const mins = hmToMinutes(s.plannedTime);
      return mins !== null && mins >= 18 * 60 && mins <= sleepMins + 30;
    });
  }, [intakeSlots, schedule.sleepTarget]);

  /* The member's real bodyweight, or none — never a silent default. */
  const memberBodyweight = useMemo(
    () => resolveMemberBodyweight({ weighIns: physique.entries, baselineWeightLb: setupProfile.baselineWeightLb, profileBodyweightLb: nutritionPrefs.bodyweightLb }),
    [physique.entries, setupProfile.baselineWeightLb, nutritionPrefs.bodyweightLb],
  );

  const nutritionDateKey = localScheduleDateKey(clock);
  const nutritionPlan = useMemo(() => {
    return buildDailyFuelPlan({
      goal: nutritionGoal,
      isTrainingDay: trainingPlanned,
      sessionName: todayResolved.sessionName,
      /* The schedule engine's meals, shaped the one way Nutrition and Schedule shape them. */
      mealWindows: fuelWindowsFromPlan(scheduledMeals),
      bodyweightLb: memberBodyweight?.lb ?? null,
      favorites: nutritionFavorites,
      personalization: nutritionPersonalization,
      sleepTarget: schedule.sleepTarget,
      wakeTime: schedule.wakeTime,
      hasEveningLog,
      /* The same date and logs Nutrition builds from, so both show (and log) the same plates. */
      date: nutritionDateKey,
      loggedMealIds: nutritionPrefs.loggedMealIds,
    });
  }, [nutritionGoal, trainingPlanned, todayResolved.sessionName, schedule, scheduledMeals, nutritionFavorites, nutritionPersonalization, hasEveningLog, memberBodyweight, nutritionDateKey, nutritionPrefs.loggedMealIds]);

  const loggedMealIds = nutritionPrefs.loggedMealIds;

  /* ── Member intelligence layer — biomarkers, evidence, reviews, enhanced ──
     All log-only and deterministic: built from member-entered records.   ── */
  const biomarkers = useMemo<BiomarkerCommand>(
    () => buildBiomarkerCommand({ logs: bloodworkLogs, setup: setupProfile, now: clock }),
    [bloodworkLogs, setupProfile, clock],
  );
  const recoveryHasData = (recovery.sleepLogs?.length ?? 0) > 0 || (recovery.stressCheckIns?.length ?? 0) > 0;
  const evidence = useMemo<EvidenceItem[]>(
    () => buildEvidenceWatch({
      bloodwork: biomarkers,
      entries: physique.entries ?? [],
      photoCheckIns: physique.photoCheckIns ?? [],
      checkInIntervalDays: physique.checkInIntervalDays ?? 7,
      recoveryHasData,
      now: clock,
    }),
    [biomarkers, physique.entries, physique.photoCheckIns, physique.checkInIntervalDays, recoveryHasData, clock],
  );
  const measurementReview = useMemo<MeasurementReview>(
    () => buildMeasurementReview({
      entries: physique.entries ?? [],
      checkInIntervalDays: physique.checkInIntervalDays ?? 7,
      goalLabel: physique.goal ?? "current",
      now: clock,
    }),
    [physique.entries, physique.checkInIntervalDays, physique.goal, clock],
  );
  const photoReview = useMemo<PhotoReview>(
    () => buildPhotoReview({
      checkIns: physique.photoCheckIns ?? [],
      checkInIntervalDays: physique.checkInIntervalDays ?? 7,
      now: clock,
    }),
    [physique.photoCheckIns, physique.checkInIntervalDays, clock],
  );
  const enhanced = useMemo<EnhancedCommand>(
    () => buildEnhancedCommand({
      entries: enhancementLog ?? [],
      adherence: enhancementAdherence ?? [],
      injectionLogs: injectionLogs ?? [],
      biomarkers,
      experienceLevel: profile.experienceLevel,
      now: clock,
    }),
    [enhancementLog, enhancementAdherence, injectionLogs, biomarkers, profile.experienceLevel, clock],
  );

  /* ── Reserve Smart Brief — seven specific lines, all from today's real data ── */
  const smartBrief = useMemo(() => {
    const proto = todayResolved.protocol;
    const missionLine = todayResolved.recovery
      ? `Restore the reserve — ${proto.recoveryNote.toLowerCase().replace(/\.$/, "")}. Posing and mobility are today's output.`
      : todayResolved.intent ?? todayTemplate?.sessionIntent
        ?? `Drive ${todayResolved.sessionName} output clean — no junk volume after the planned sets.`;
    const limiterLine = briefing.primaryLimiter.startsWith("None")
      ? `No hard limiter — protect the ${formatClock(schedule.sleepTarget)} sleep target and execute as planned.`
      : briefing.primaryLimiter;
    return {
      mission: missionLine,
      highRoi: `${roi.title}. ${roi.reason}`,
      limiter: limiterLine,
      protect: mission.recovery,
      avoid: todayResolved.recovery
        ? "Heavy systemic load on a recovery day."
        : todayResolved.advanced
          ? "Junk volume after the planned sets — the plan is already high-output."
          : "Adding extra work beyond the plan.",
      afterTraining: todayResolved.recovery
        ? `${proto.afterSession} — then close the day early.`
        : `Log the post-workout meal, then: ${proto.afterSession}.`,
      nextEvidence: evidence.length
        ? evidence.slice(0, 2).map((e) => e.detail).join(" ")
        : `Evidence current — the ${checkInCadence.toLowerCase()} check-in cadence keeps trend confidence high.`,
    };
  }, [todayResolved, todayTemplate, briefing.primaryLimiter, roi, mission.recovery, evidence, checkInCadence, schedule.sleepTarget]);

  /* ── The statement — readiness-derived, Bible §05 thresholds ── */
  const readinessValue = heroMetrics.find((m) => /readi/i.test(m.label))?.value ?? "—";
  const readinessNum = Number.isFinite(parseInt(readinessValue, 10)) ? parseInt(readinessValue, 10) : null;
  const sleepCompressed = heroMetrics.find((m) => m.label === "Schedule Risk")?.value === "Sleep Compression";
  const statement = readinessStatement({ readiness: readinessNum, recoveryDay: todayResolved.recovery, conflict: sleepCompressed });

  /* Projected session quality — deterministic, derived from real signals
     (readiness reserve, mapped fuel timing, sleep compression, watch severity).
     Labeled "derived" so it never reads as a measured value. */
  const fuelMapped = heroMetrics.find((m) => m.label === "Fuel Status")?.value === "Meal Timing Set";
  const projectedQuality = readinessNum === null || !trainingPlanned
    ? null
    : Math.max(35, Math.min(98, readinessNum + (fuelMapped ? 6 : -4) - (sleepCompressed ? 8 : 0) - (briefing.hurting.some((h) => h.severity === "high") ? 6 : 0)));

  return {
    // Clock + identity
    now,
    clock,
    greetWord,
    memberName,
    statement,
    projectedQuality,
    splitIdentity,
    activeProtocol,
    activeResolution,
    executionPhaseLabel,
    executionTimelineLabel,
    // The day
    schedule,
    trainingContext,
    trainingOverrides,
    todayResolved,
    trainingSessionMode,
    apexWeek,
    nutritionPlan,
    loggedMealIds,
    intakeSlots,
    recovery,
    recoverySnapshot,
    // Briefing
    briefing,
    evidence,
    smartBrief,
    intakeSummary,
    mission,
    weakPointLabels,
    checkInCadence,
    physiqueEvidence,
    biomarkers,
    measurementReview,
    photoReview,
    enhanced,
    enhancedLogOnly,
    nutritionAlignment,
    // Actions
    setActiveView,
    setEnhancedLogOnly,
  };
}

export type ApexModel = ReturnType<typeof useApexModel>;
