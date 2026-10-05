import type {
  ActiveWorkoutSession,
  DigitalAthleteSnapshot,
  MovementSwap,
  NutritionCommand,
  PhysiqueCheckIn,
  ProgressionSnapshot,
  RecoveryCommand,
  SessionCompletion,
  SetCompletion,
  TodaysCommand,
} from "@/lib/contracts/product";
import type { Json } from "@/lib/database/types";
import { AI_SERVICE_SAFETY_NOTE, generateDailyMission, generateNutritionMission, generatePremiumTrainingPlan } from "@/lib/ai/coaching-engine";
import { NUTRITION_COMBOS, buildQuickRestDay, buildQuickTrainingDay, getComboById } from "@/lib/logging/nutrition-combos";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type {
  PhysiqueCheckInRequest,
  QuickNutritionRequest,
  SessionCompleteRequest,
  SessionSetRequest,
  SessionStartRequest,
  SessionSwapRequest,
  ValueEngineQuery,
} from "@/lib/schemas/value-engine";
import { localDateKey } from "@/lib/dates/local-day";

type PersistenceResult =
  | { persisted: true; mode: "supabase" }
  | { persisted: false; mode: "local_fallback"; reason: "anonymous" | "not_configured" | "write_failed" };

const anonymousPersistence: PersistenceResult = { persisted: false, mode: "local_fallback", reason: "anonymous" };

function persistenceUnavailable(): PersistenceResult {
  return { persisted: false, mode: "local_fallback", reason: "not_configured" };
}

function writeFailed(error: unknown): PersistenceResult {
  console.warn("Value engine persistence fell back locally.", error instanceof Error ? error.message : error);
  return { persisted: false, mode: "local_fallback", reason: "write_failed" };
}

type SupabaseWriteResult = { error: { message?: string } | null };

async function persistWithFallback(action: () => PromiseLike<SupabaseWriteResult>): Promise<PersistenceResult> {
  try {
    const { error } = await action();
    return error ? writeFailed(error) : { persisted: true, mode: "supabase" };
  } catch (error) {
    return writeFailed(error);
  }
}

export function generateRecoveryCommand(input: Partial<ValueEngineQuery> = {}): RecoveryCommand {
  /* No readiness reached the service: no decision is made from missing data. */
  const readiness = input.readinessScore ?? null;
  if (readiness === null) {
    return {
      title: "Recovery command",
      decision: null,
      nervousSystemReadiness: "No readiness logged. Reserve does not rate today's output from missing data.",
      jointWarning: "No joint feedback logged.",
      sleepDebt: "No sleep logged.",
      failurePermission: "Follow the reps-in-reserve targets written in today's plan.",
      cardioIntensityRecommendation: "Post-lift cardio at an easy, conversational pace.",
      saunaRecommendation: "Only if already tolerated, with hydration tracked.",
      coachNote: "Log readiness in the recovery check to see today's recovery read.",
      safetyNote: AI_SERVICE_SAFETY_NOTE,
    };
  }
  const decision: NonNullable<RecoveryCommand["decision"]> = readiness < 55 ? "recover today" : readiness < 72 ? "train modified" : "train hard";

  return {
    title: "Recovery command",
    decision,
    nervousSystemReadiness: readiness >= 72 ? "Logged readiness supports a normal output window." : readiness >= 55 ? "Logged readiness is usable, but cap intensity." : "Logged readiness is low; prioritize recovery work.",
    jointWarning: decision === "train hard" ? "No joint feedback logged. Log it after training." : "Watch joints closely and avoid grinding reps.",
    sleepDebt: "No sleep logged. Log sleep to include it in this read.",
    failurePermission: decision === "train hard" ? "Isolation work only may approach technical failure." : "No failure work today.",
    cardioIntensityRecommendation: decision === "recover today" ? "Easy Zone 2 only, conversational pace." : "Post-lift cardio at easy to moderate pace.",
    saunaRecommendation: "Only if already tolerated, with hydration tracked.",
    coachNote: "Use this as performance guidance only. Log sleep, joint feedback, and session output after training.",
    safetyNote: AI_SERVICE_SAFETY_NOTE,
  };
}

export function generateTodaysCommand(input: Partial<ValueEngineQuery> = {}): TodaysCommand {
  const dailyMission = generateDailyMission(input);
  const nutritionMission = generateNutritionMission(input);
  const recoveryCommand = generateRecoveryCommand(input);
  const absBlock = dailyMission.trainingMission.blocks?.find((block) => block.title.includes("Abs"));

  return {
    title: "Today's command",
    trainingMission: dailyMission.trainingMission,
    nutritionMission,
    recoveryDecision: recoveryCommand,
    cardioMission: {
      minutes: dailyMission.cardioMinutes,
      intensity: recoveryCommand.decision === "recover today" ? "easy" : "moderate",
      modality: "Incline treadmill, bike, or stairs",
      note: "Keep the cardio mission logged as performance context, not punishment.",
    },
    saunaMission: {
      minutes: dailyMission.saunaMinutes,
      hydrationReminder: dailyMission.hydrationTarget,
      note: "Use sauna as a recovery ritual only if it is already tolerated.",
    },
    absMission: {
      movements: absBlock?.exercises ?? [],
      priority: "mandatory",
      note: "Abs are part of the daily physique mission, not optional finishers.",
    },
    completionPercent: dailyMission.completionPercent,
    topWarning: dailyMission.priorityWarning,
    nextBestAction: recoveryCommand.decision === null
      ? "Log readiness in the recovery check, then start the session."
      : recoveryCommand.decision === "recover today"
        ? "Open recovery check and log readiness."
        : "Start the session and execute the first priority block.",
    startSessionCta: "Start session",
    logMealCta: "Log meal",
    recoveryCheckCta: "Recovery check",
    safetyNote: AI_SERVICE_SAFETY_NOTE,
  };
}

export function startWorkoutSession(input: SessionStartRequest): ActiveWorkoutSession {
  const plan = generatePremiumTrainingPlan({
    userId: input.userId,
    splitDay: input.splitDay,
    readinessScore: input.readinessScore,
  });
  const exercises = plan.exercises.map((exercise, index) => ({
    exerciseId: exercise.exerciseId ?? `exercise-${index + 1}`,
    exerciseName: exercise.name,
    prescribedSets: exercise.sets,
    completedSets: 0,
    currentSet: 1,
    targetReps: exercise.reps ?? exercise.repRange,
    targetRir: exercise.rir?.label ?? exercise.intensityTarget ?? "2-3 reps left in reserve",
    loadAdjustment: "Start with last clean working load; adjust only if rep quality or joint feedback changes.",
    swapOptions: exercise.substitutionOptions ?? [],
    status: index === 0 ? "active" as const : "pending" as const,
  }));

  return {
    sessionId: `session-${Date.now()}`,
    userId: input.userId,
    planId: input.planId ?? plan.id,
    title: input.title ?? plan.title,
    startedAt: new Date().toISOString(),
    status: "active",
    currentExerciseId: exercises[0]?.exerciseId ?? null,
    exercises,
    restTimer: null,
    offlineSafe: true,
  };
}

export function completeSessionSet(input: SessionSetRequest): SetCompletion {
  const restSeconds = input.rir !== null && input.rir !== undefined && input.rir <= 1 ? 150 : 90;
  return {
    sessionId: input.sessionId,
    exerciseId: input.exerciseId,
    setNumber: input.setNumber,
    load: input.load ?? null,
    reps: input.reps,
    rir: input.rir ?? null,
    completedAt: new Date().toISOString(),
    loadAdjustment: input.rir !== null && input.rir !== undefined && input.rir >= 3
      ? "Next set can add a small load or one clean rep if form stays locked."
      : "Hold load and protect rep quality next set.",
    restTimer: {
      startedAt: new Date().toISOString(),
      prescribedSeconds: restSeconds,
      remainingSeconds: restSeconds,
      nextAction: "Start next set when breathing and target muscle control are back.",
    },
  };
}

export function swapSessionMovement(input: SessionSwapRequest): MovementSwap {
  return {
    sessionId: input.sessionId,
    exerciseId: input.exerciseId,
    originalExercise: input.originalExercise,
    replacementExercise: input.replacementExercise,
    reason: input.reason ?? "Movement swapped for equipment, setup, or joint-feedback fit.",
    preservesStimulus: input.preservesStimulus ?? "Same target muscle and stimulus intent.",
    swappedAt: new Date().toISOString(),
  };
}

export function completeWorkoutSession(input: SessionCompleteRequest): SessionCompletion {
  return {
    sessionId: input.sessionId,
    completedAt: new Date().toISOString(),
    completedExercises: input.completedExercises,
    completedSets: input.completedSets,
    estimatedVolume: input.estimatedVolume,
    status: input.status,
    coachNote: "Session complete. Log pump, joint feedback, cardio, sauna, and appetite so tomorrow's command has better context.",
  };
}

export function generateProgressionSnapshot(input: Partial<ValueEngineQuery> = {}): ProgressionSnapshot {
  const readiness = input.readinessScore ?? null;
  const adherence = input.adherenceScore ?? null;
  return {
    title: "Progression command",
    /* No session history reaches this service, so it never claims a week was beaten or reps were added. */
    beatLastWeek: null,
    addedReps: null,
    addedLoad: readiness === null
      ? "No readiness logged. Hold load until your logged top sets earn the next step."
      : readiness >= 78 ? "Add the smallest practical load on one priority lift if top-set reps stay clean." : "Hold load and earn cleaner reps first.",
    volumeProgression: adherence === null
      ? "No adherence logged. Hold volume until your logs show the trend."
      : adherence >= 85 ? "Logged adherence supports a small priority-muscle volume increase." : "Hold volume until adherence stabilizes.",
    bodyweightTrend: input.bodyweight ? `${input.bodyweight} lb logged as today's context.` : "No bodyweight logged.",
    recoveryTrend: readiness === null
      ? "No readiness logged."
      : readiness >= 72 ? "Logged readiness supports planned overload." : "Logged readiness suggests a modified overload target.",
    plateauDetection: readiness === null && adherence === null
      ? null
      : (readiness !== null && readiness < 60) || (adherence !== null && adherence < 65) ? "watch" : "none",
    nextOverloadTarget: "Beat your last logged top set by one clean rep before adding sets.",
    coachNote: "Progression is earned through clean reps, repeatable load, and recovery trend stability.",
    safetyNote: AI_SERVICE_SAFETY_NOTE,
  };
}

export function generateDigitalAthleteSnapshot(input: Partial<ValueEngineQuery> = {}): DigitalAthleteSnapshot {
  const plan = generatePremiumTrainingPlan(input);
  /* Reserve does not score, rank or judge a physique (DESIGN_BIBLE §02). Lagging,
     dominant and priority areas come only from the member's own weak-point
     selections, which this service does not receive — so those lists stay empty. */
  return {
    title: "Digital athlete intelligence",
    todaysHighlightedMuscles: Array.from(new Set(plan.muscleTargets?.filter((target) => target.role === "priority").map((target) => target.exactMuscle) ?? [])),
    laggingMuscles: [],
    dominantMuscles: [],
    recoveryZones: [],
    symmetryConcerns: [],
    musclePriorityScore: [],
    physiqueStatusSummary: "Reserve does not score your physique. Priority areas come from the weak points you select in Physique.",
    safetyNote: AI_SERVICE_SAFETY_NOTE,
  };
}

export function buildPhysiqueCheckIn(input: PhysiqueCheckInRequest): PhysiqueCheckIn {
  /* A check-in is a dated record. Photos are never analyzed, scored or judged (DESIGN_BIBLE §02). */
  return {
    id: `physique-checkin-${Date.now()}`,
    userId: input.userId,
    checkInDate: input.checkInDate ?? localDateKey(),
    photos: input.photos,
    aiCritiquePlaceholder: "Reserve does not analyze or score photos. The check-in is saved as a dated entry.",
    laggingBodyParts: [],
    strengths: [],
    posingFeedback: "Capture front, side, and back under the same lighting each time.",
    nextFocusBlock: "Focus comes from the weak points you select in Physique.",
    transformationNote: input.notes ?? "Check-in saved as a dated entry.",
    safetyNote: AI_SERVICE_SAFETY_NOTE,
  };
}

export function generateNutritionCommand(input: Partial<ValueEngineQuery> = {}): NutritionCommand {
  const bodyweight = input.bodyweight ?? null;
  const adherence = input.adherenceScore ?? null;

  return {
    title: "Nutrition command",
    repeatYesterday: "Use yesterday's logged meals as today's shell when schedule is tight.",
    copyTrainingDay: "Copy the full training-day combo plan for hard Reserve Method sessions.",
    copyRestDay: "Copy the rest-day combo plan on recovery or low-output days.",
    oneClickCombos: NUTRITION_COMBOS.slice(0, 5).map((combo) => combo.name),
    restaurantEstimate: "Use a high-protein entree estimate, log it as approximate, and tighten the next meal.",
    adherenceScore: adherence === null ? null : Math.round(adherence),
    /* Meal logs never reach this service, so it cannot see a missed meal or a protein gap. */
    missedMealWarning: "Meal logs stay in your fuel log. Open it to see today's meals.",
    proteinGap: bodyweight === null
      ? "No bodyweight logged. Log a weigh-in to see a protein target."
      : `Protein target estimate ${Math.round(bodyweight * 1.1)}g from your logged ${bodyweight} lb. Your fuel log shows what you logged.`,
    hydrationGap: "Log today's water to see a hydration gap.",
    coachNote: "Nutrition command is about adherence visibility and repeatable decisions, not perfect tracking theater.",
    safetyNote: AI_SERVICE_SAFETY_NOTE,
  };
}

export function buildQuickNutritionAction(input: QuickNutritionRequest) {
  const today = input.date ?? localDateKey();
  const combos = input.mode === "copy-rest-day" ? buildQuickRestDay() : buildQuickTrainingDay();
  const selectedCombo = input.comboId ? getComboById(input.comboId) : combos[0] ?? NUTRITION_COMBOS[0];

  if (input.mode === "restaurant-estimate") {
    return {
      id: `quick-nutrition-${Date.now()}`,
      date: today,
      mode: input.mode,
      action: "restaurant-estimate",
      meal: {
        name: input.mealName ?? `${input.restaurantName ?? "Restaurant"} high-protein estimate`,
        protein: 45,
        carbs: 55,
        fat: 18,
        calories: 562,
      },
      message: "Restaurant estimate created. Treat numbers as approximate and tighten the next logged meal.",
      safetyNote: AI_SERVICE_SAFETY_NOTE,
    };
  }

  return {
    id: `quick-nutrition-${Date.now()}`,
    date: today,
    mode: input.mode,
    action: input.mode === "combo" ? "add-combo" : input.mode,
    combos: input.mode === "combo" ? [selectedCombo?.name] : combos.map((combo) => combo.name),
    message: "Quick nutrition action validated. Client can save locally and sync later.",
    safetyNote: AI_SERVICE_SAFETY_NOTE,
  };
}

export async function persistTodaysCommand(userId: string | undefined, output: TodaysCommand): Promise<PersistenceResult> {
  if (!userId) return anonymousPersistence;
  const admin = createSupabaseAdminClient();
  if (!admin) return persistenceUnavailable();
  return persistWithFallback(() =>
    admin
      .from("todays_commands")
      .upsert(
        { user_id: userId, command: output as unknown as Json, safety_notes: output.safetyNote },
        { onConflict: "user_id,command_date" },
      ),
  );
}

export async function persistActiveSession(userId: string | undefined, output: ActiveWorkoutSession): Promise<PersistenceResult> {
  if (!userId) return anonymousPersistence;
  const admin = createSupabaseAdminClient();
  if (!admin) return persistenceUnavailable();
  return persistWithFallback(() =>
    admin
      .from("active_sessions")
      .upsert(
        {
          user_id: userId,
          session_id: output.sessionId,
          plan_id: output.planId,
          title: output.title,
          status: output.status,
          session: output as unknown as Json,
          started_at: output.startedAt,
        },
        { onConflict: "user_id,session_id" },
      ),
  );
}

export async function persistSessionSet(userId: string | undefined, output: SetCompletion): Promise<PersistenceResult> {
  if (!userId) return anonymousPersistence;
  const admin = createSupabaseAdminClient();
  if (!admin) return persistenceUnavailable();
  return persistWithFallback(() =>
    admin.from("session_sets").insert({
      user_id: userId,
      session_id: output.sessionId,
      exercise_id: output.exerciseId,
      set_number: output.setNumber,
      load: output.load,
      reps: output.reps,
      rir: output.rir,
      metadata: output as unknown as Json,
      completed_at: output.completedAt,
    }),
  );
}

export async function persistSessionSwap(userId: string | undefined, output: MovementSwap): Promise<PersistenceResult> {
  if (!userId) return anonymousPersistence;
  const admin = createSupabaseAdminClient();
  if (!admin) return persistenceUnavailable();
  return persistWithFallback(() =>
    admin.from("session_swaps").insert({
      user_id: userId,
      session_id: output.sessionId,
      exercise_id: output.exerciseId,
      original_exercise: output.originalExercise,
      replacement_exercise: output.replacementExercise,
      reason: output.reason,
      preserves_stimulus: output.preservesStimulus,
      swapped_at: output.swappedAt,
      metadata: output as unknown as Json,
    }),
  );
}

export async function persistSessionCompletion(userId: string | undefined, output: SessionCompletion): Promise<PersistenceResult> {
  if (!userId) return anonymousPersistence;
  const admin = createSupabaseAdminClient();
  if (!admin) return persistenceUnavailable();
  return persistWithFallback(() =>
    admin
      .from("active_sessions")
      .update({
        status: output.status,
        completed_at: output.completedAt,
        session: output as unknown as Json,
      })
      .eq("user_id", userId)
      .eq("session_id", output.sessionId),
  );
}

export async function persistProgressionSnapshot(userId: string | undefined, output: ProgressionSnapshot): Promise<PersistenceResult> {
  if (!userId) return anonymousPersistence;
  const admin = createSupabaseAdminClient();
  if (!admin) return persistenceUnavailable();
  return persistWithFallback(() => admin.from("progression_snapshots").insert({ user_id: userId, snapshot: output as unknown as Json, safety_notes: output.safetyNote }));
}

export async function persistDigitalAthleteSnapshot(userId: string | undefined, output: DigitalAthleteSnapshot): Promise<PersistenceResult> {
  if (!userId) return anonymousPersistence;
  const admin = createSupabaseAdminClient();
  if (!admin) return persistenceUnavailable();
  return persistWithFallback(() => admin.from("digital_athlete_snapshots").insert({ user_id: userId, snapshot: output as unknown as Json, safety_notes: output.safetyNote }));
}

export async function persistPhysiqueCheckIn(userId: string | undefined, output: PhysiqueCheckIn): Promise<PersistenceResult> {
  if (!userId) return anonymousPersistence;
  const admin = createSupabaseAdminClient();
  if (!admin) return persistenceUnavailable();
  return persistWithFallback(() =>
    admin.from("physique_checkins").insert({
      user_id: userId,
      check_in_date: output.checkInDate,
      photos: output.photos as unknown as Json,
      critique: output as unknown as Json,
      safety_notes: output.safetyNote,
    }),
  );
}

export async function persistNutritionCommand(userId: string | undefined, output: NutritionCommand): Promise<PersistenceResult> {
  if (!userId) return anonymousPersistence;
  const admin = createSupabaseAdminClient();
  if (!admin) return persistenceUnavailable();
  return persistWithFallback(() =>
    admin
      .from("nutrition_commands")
      .upsert(
        { user_id: userId, command: output as unknown as Json, safety_notes: output.safetyNote },
        { onConflict: "user_id,command_date" },
      ),
  );
}

export async function persistRecoveryCommand(userId: string | undefined, output: RecoveryCommand): Promise<PersistenceResult> {
  if (!userId) return anonymousPersistence;
  const admin = createSupabaseAdminClient();
  if (!admin) return persistenceUnavailable();
  return persistWithFallback(() =>
    admin
      .from("recovery_commands")
      .upsert(
        { user_id: userId, command: output as unknown as Json, safety_notes: output.safetyNote },
        { onConflict: "user_id,command_date" },
      ),
  );
}
