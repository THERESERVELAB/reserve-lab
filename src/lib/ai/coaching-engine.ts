import {
  aiBriefResponseSchema,
  type AiBriefRequest,
  type AiBriefResponse,
  type AiServiceResponse,
  type IntelligenceQuery,
  type ProjectionRequest,
  type RetentionCoachingRequest,
  type TrainingIntelligenceRequest,
  type UpgradePersuasionRequest,
} from "@/lib/schemas/ai";
import { createOpenAIClient } from "@/lib/ai/openai";
import { buildDailyBriefPrompt } from "@/lib/ai/prompts";
import type { DailyMission, NutritionMission, PhysiqueCritique, ProjectionReport, ProjectionSnapshot, RecoveryDecision, TrainingSessionPlan } from "@/lib/contracts/product";
import { serverEnv } from "@/lib/env/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/database/types";
import { generateReserveMethodTrainingSessionPlan } from "@/lib/training/intelligence";

const FALLBACK_BRIEF: AiBriefResponse = {
  title: "Command brief ready",
  summary: "Review today's readiness, complete one high-signal log, and keep the day focused on consistent execution.",
  watchItems: ["Readiness trend", "Training completion", "Nutrition adherence"],
  trainingFocus: "Keep the session aligned to the plan you already selected and log performance signals after training.",
  retentionNote: "A simple check-in today keeps the transformation record current and easier to review later.",
  upgradeTeaser: "Advanced trend views unlock deeper comparisons while staying tracking-only and non-medical.",
  safetyNote: "This is health-awareness and performance tracking only. Review clinical concerns with a qualified clinician.",
};

export const AI_SERVICE_SAFETY_NOTE = "Observational performance tracking only. No medical advice, diagnosis, protocols, or dosage guidance. Review clinical concerns with a qualified clinician.";

type PersistenceResult =
  | { persisted: true; mode: "supabase" }
  | { persisted: false; mode: "local_fallback"; reason: "anonymous" | "not_configured" | "write_failed" };

function fallbackModelName() {
  return serverEnv.OPENAI_API_KEY ? serverEnv.OPENAI_MODEL ?? "gpt-4o-mini" : "premium_fallback";
}

export async function generateDailyBrief(input: AiBriefRequest): Promise<AiBriefResponse> {
  if (!serverEnv.OPENAI_API_KEY) {
    return FALLBACK_BRIEF;
  }

  try {
    const client = createOpenAIClient();
    if (!client) return FALLBACK_BRIEF;

    const response = await client.responses.create({
      model: serverEnv.OPENAI_MODEL ?? "gpt-4o-mini",
      input: buildDailyBriefPrompt(input),
      text: {
        format: {
          type: "json_schema",
          name: "daily_brief",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              title: { type: "string" },
              summary: { type: "string" },
              watchItems: { type: "array", items: { type: "string" }, maxItems: 5 },
              trainingFocus: { type: "string" },
              retentionNote: { type: "string" },
              upgradeTeaser: { type: "string" },
              safetyNote: { type: "string" },
            },
            required: ["title", "summary", "watchItems", "trainingFocus", "retentionNote", "upgradeTeaser", "safetyNote"],
          },
        },
      },
    });

    const parsed = aiBriefResponseSchema.safeParse(JSON.parse(response.output_text));
    return parsed.success ? parsed.data : FALLBACK_BRIEF;
  } catch (error) {
    console.warn(
      "AI brief fell back to local safe response.",
      error instanceof Error ? error.message : error,
    );
    return FALLBACK_BRIEF;
  }
}

export async function persistAiAnalysis(userId: string, output: AiBriefResponse) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { persisted: false, mode: "local_fallback" as const, reason: "not_configured" as const };
  }

  const { error } = await admin.from("ai_analysis_outputs").insert({
    user_id: userId,
    analysis_type: "daily-brief",
    model: serverEnv.OPENAI_API_KEY ? serverEnv.OPENAI_MODEL ?? "gpt-4o-mini" : "fallback",
    output: output as unknown as Json,
    safety_notes: output.safetyNote,
  });

  if (error) {
    console.warn("AI output was not persisted because Supabase write failed.", error.message);
    return { persisted: false, mode: "local_fallback" as const, reason: "write_failed" as const };
  }

  return { persisted: true, mode: "supabase" as const };
}

export async function persistIntelligenceOutput(userId: string | undefined, outputType: string, output: unknown): Promise<PersistenceResult> {
  if (!userId) {
    return { persisted: false, mode: "local_fallback", reason: "anonymous" };
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { persisted: false, mode: "local_fallback", reason: "not_configured" };
  }

  const { error } = await admin.from("intelligence_outputs").insert({
    user_id: userId,
    output_type: outputType,
    model: fallbackModelName(),
    output: output as Json,
    safety_notes: AI_SERVICE_SAFETY_NOTE,
  });

  if (error) {
    console.warn("Intelligence output was not persisted.", error.message);
    return { persisted: false, mode: "local_fallback", reason: "write_failed" };
  }

  return { persisted: true, mode: "supabase" };
}

export async function persistTrainingPrescription(userId: string | undefined, plan: TrainingSessionPlan): Promise<PersistenceResult> {
  if (!userId) {
    return { persisted: false, mode: "local_fallback", reason: "anonymous" };
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { persisted: false, mode: "local_fallback", reason: "not_configured" };
  }

  const { error } = await admin.from("training_prescriptions").insert({
    user_id: userId,
    plan_id: plan.id,
    title: plan.title,
    split_name: plan.splitName ?? "Reserve Method",
    split_day: plan.splitDay ?? null,
    focus: plan.focus,
    plan: plan as unknown as Json,
    safety_notes: AI_SERVICE_SAFETY_NOTE,
  });

  if (error) {
    console.warn("Training prescription was not persisted.", error.message);
    return { persisted: false, mode: "local_fallback", reason: "write_failed" };
  }

  return { persisted: true, mode: "supabase" };
}

export function generateTrainingIntelligence(input: TrainingIntelligenceRequest): AiServiceResponse {
  const weakPointText = input.weakPoints.length > 0 ? input.weakPoints.slice(0, 3).join(", ") : "current focus areas";

  return {
    title: "Training intelligence ready",
    summary: "Use the latest readiness and logged weak-point signals to keep the next training block legible and easy to review.",
    bullets: [
      `Primary observation: ${weakPointText}.`,
      `Readiness context: ${input.readinessScore ?? "not logged"}.`,
      "Keep session notes specific enough to compare volume, effort, and recovery trends.",
    ],
    safetyNote: AI_SERVICE_SAFETY_NOTE,
  };
}

export function generatePremiumTrainingPlan(input: Partial<IntelligenceQuery> = {}): TrainingSessionPlan {
  return generateReserveMethodTrainingSessionPlan(input);
}

export function generateDailyMission(input: Partial<IntelligenceQuery> = {}): DailyMission {
  const trainingMission = generatePremiumTrainingPlan(input);
  /* Only what the member sent: no bodyweight means no protein figure, no adherence means no completion percent. */
  const bodyweight = input.bodyweight ?? null;
  const completionPercent = input.adherenceScore == null ? null : Math.max(0, Math.min(100, Math.round(input.adherenceScore)));
  const gateStatus = trainingMission.recoveryGate?.status ?? "green";

  return {
    title: `${trainingMission.athleteName ?? "Athlete"} daily mission`,
    trainingMission,
    bodyGroups: Array.from(new Set(trainingMission.blocks?.flatMap((block) => block.bodyGroups) ?? [])),
    proteinTarget: bodyweight === null
      ? "No bodyweight logged. Log a weigh-in to see a protein target."
      : `${Math.round(bodyweight * 1.1)}g protein target from your logged weight`,
    hydrationTarget: "4.0-4.5L water logged across the day",
    steps: gateStatus === "red" ? 8000 : 10000,
    cardioMinutes: trainingMission.cardioMinutes ?? 20,
    saunaMinutes: trainingMission.saunaMinutes ?? 15,
    sleepTarget: "7.5-8.5 hours",
    completionPercent,
    priorityWarning: gateStatus === "red"
      ? "Readiness gate is red. Keep today recovery-priority and log symptoms or joint stress for trend review."
      : gateStatus === "yellow"
        ? "Readiness is moderate. Execute the plan, but hold back from failure and protect joint quality."
        : "Main risk is adding extra work after the plan. Finish the mission, log it, and leave.",
    missionIntensity: gateStatus === "red" ? "recovery" : trainingMission.splitDay === 7 ? "moderate" : "elite",
    coachNote: `${trainingMission.title}: execute the written plan, hit cardio and sauna, then log performance, pump, soreness, and appetite signals.`,
    safetyNote: AI_SERVICE_SAFETY_NOTE,
  };
}

export function generateNutritionMission(input: Partial<IntelligenceQuery> = {}): NutritionMission {
  /* No bodyweight means no macro figures; no adherence means none reported. */
  const bodyweight = input.bodyweight ?? null;

  return {
    title: "Nutrition mission",
    trainingDayMacros: bodyweight === null ? null : {
      calories: Math.round(bodyweight * 15),
      proteinG: Math.round(bodyweight * 1.1),
      carbsG: Math.round(bodyweight * 1.7),
      fatG: Math.round(bodyweight * 0.35),
    },
    restDayMacros: bodyweight === null ? null : {
      calories: Math.round(bodyweight * 13),
      proteinG: Math.round(bodyweight * 1.1),
      carbsG: Math.round(bodyweight * 1.1),
      fatG: Math.round(bodyweight * 0.4),
    },
    highDay: "Use high-day carbs around Reserve Method chest/back, legs, and upper-specialization sessions.",
    lowDay: "Use lower-carb structure on recovery day while keeping protein and hydration consistent.",
    preWorkoutTiming: "Eat a protein-and-carb meal 90-150 minutes before training when schedule allows.",
    postWorkoutPriority: "Log the session, then prioritize protein, carbs, fluids, and a calm digestion window.",
    hydration: "Track fluids through the day and log intake to see it against your plan. Not a medical directive.",
    sodiumStrategyPlaceholder: "Track sodium consistency for performance context only; review health concerns with a clinician.",
    bodyweightTrendAdjustment: bodyweight === null
      ? "No bodyweight logged. Log weigh-ins to see the trend."
      : "If 7-day bodyweight trend is flat and adherence is high, flag for coach review before changing intake.",
    adherenceScore: input.adherenceScore == null ? null : Math.round(input.adherenceScore),
    digestionNotes: "Log bloating, appetite, meal timing, and food tolerance as trend observations.",
    coachNote: "The win today is boring precision: hit protein, place carbs near training, and keep hydration visible.",
    safetyNote: AI_SERVICE_SAFETY_NOTE,
  };
}

export function generateRecoveryDecision(input: Partial<IntelligenceQuery> = {}): RecoveryDecision {
  /* No readiness reached the service: no decision or stress level is made up. */
  const readiness = input.readinessScore ?? null;
  if (readiness === null) {
    return {
      title: "Recovery decision",
      decision: null,
      failurePermission: "Follow the reps-in-reserve targets written in today's plan.",
      jointStress: null,
      cnsStress: null,
      volumeAdjustment: "Run the plan as written. Log readiness to see a recovery decision.",
      cardioRecommendation: "Easy, conversational pace after lifting.",
      saunaRecommendation: "Only if already tolerated, with hydration logged.",
      coachNote: "No readiness logged. Log sleep, soreness, joint stress, and session output to see a recovery decision.",
      safetyNote: AI_SERVICE_SAFETY_NOTE,
    };
  }
  const decision: NonNullable<RecoveryDecision["decision"]> = readiness < 55 ? "recovery priority" : readiness < 72 ? "train moderate" : "train hard";

  return {
    title: "Recovery decision",
    decision,
    failurePermission: decision === "train hard"
      ? "Only isolation work may approach technical failure; compounds stay inside the target RIR limits."
      : decision === "train moderate"
        ? "No failure work today. Keep clean reps in reserve and protect tomorrow's readiness."
        : "No failure work. Treat movement as recovery, skill, and circulation.",
    jointStress: readiness < 60 ? "high" : readiness < 75 ? "moderate" : "low",
    cnsStress: readiness < 55 ? "high" : readiness < 72 ? "moderate" : "low",
    volumeAdjustment: decision === "train hard"
      ? "Run planned volume."
      : decision === "train moderate"
        ? "Remove one hard set from each priority block and keep rest windows longer."
        : "Replace heavy work with mobility, posing, easy cardio, and logging.",
    cardioRecommendation: decision === "recovery priority" ? "20-25 minutes easy Zone 2 or incline walk." : "15-25 minutes after lifting, conversational pace.",
    saunaRecommendation: decision === "recovery priority" ? "15-20 minutes if already tolerated and hydration is logged." : "15-20 minutes after cardio as a recovery ritual.",
    coachNote: "Decision is based on the readiness you logged. Log sleep, soreness, joint stress, and session output after the mission.",
    safetyNote: AI_SERVICE_SAFETY_NOTE,
  };
}

export function generatePhysiqueCritique(input: Partial<IntelligenceQuery> = {}): PhysiqueCritique {
  /* No image analysis, no symmetry score and no judgment of the body (DESIGN_BIBLE §02).
     Weak points are only the focus the member typed; everything else stays empty. */
  const focus = input.primaryFocus?.trim() || null;
  const weakPoints = focus
    ? focus.split(/[,;]/).map((part) => part.trim()).filter(Boolean).slice(0, 6)
    : [];

  return {
    title: "Physique critique",
    weakPoints,
    dominantBodyParts: [],
    visualBottlenecks: [],
    specializationRecommendation: focus
      ? `Keep ${focus} as the priority you set, and log sets to see volume trends.`
      : "Select weak points in Physique to set a priority.",
    symmetryScore: null,
    nextFocusBlock: focus ? `Priority you set: ${focus}.` : "No priority set yet.",
    coachNote: "Reserve does not analyze images or score symmetry. Priorities come only from the focus you set.",
    safetyNote: AI_SERVICE_SAFETY_NOTE,
  };
}

export function generateProjectionReport(input: Partial<IntelligenceQuery> = {}): ProjectionReport {
  /* Reserve does not forecast body change or adherence. The report keeps its
     three checkpoints as review dates, with nothing estimated. */
  const weighInNote = input.bodyweight
    ? "Compare against your logged weigh-ins."
    : "Log weigh-ins to see your own trend.";
  const checkpoint = (week: ProjectionSnapshot["week"], coachNote: string): ProjectionSnapshot => ({
    week,
    estimatedBodyweight: `Not projected. ${weighInNote}`,
    estimatedAdherence: null,
    visualSummary: "Review checkpoint: compare photos, measurements, and training logs taken under the same conditions.",
    riskNote: "Reserve does not forecast body change.",
    coachNote,
  });

  return {
    title: "Review checkpoints",
    snapshots: [
      checkpoint(4, "Keep photos, bodyweight, and training logs captured under consistent conditions."),
      checkpoint(8, "Review trend direction in your own logs before changing calories or volume."),
      checkpoint(12, "Review photos, measurements, performance logs, and recovery notes together."),
    ],
    safetyNote: AI_SERVICE_SAFETY_NOTE,
  };
}

export function generateProjectionBrief(input: ProjectionRequest): AiServiceResponse {
  return {
    title: "Projection scaffold ready",
    summary: `Track the path toward ${input.goalState ?? "the selected goal state"} with repeatable photos, measurements, and training adherence signals.`,
    bullets: [
      "Use consistent capture conditions for progress photos and body metrics.",
      "Compare week-over-week trend direction before interpreting any single data point.",
      "Treat projections as planning context, not guaranteed outcomes.",
    ],
    safetyNote: AI_SERVICE_SAFETY_NOTE,
  };
}

export function generateRetentionCoaching(input: RetentionCoachingRequest): AiServiceResponse {
  const risk = input.churnRiskScore ?? 0;
  return {
    title: risk >= 60 ? "Retention watch active" : "Retention loop active",
    summary: "Keep the next action small, trackable, and tied to a visible streak or review ritual.",
    bullets: [
      `Current streak: ${input.currentStreak}.`,
      `Adherence signal: ${input.adherenceScore ?? "not logged"}.`,
      "Prompt one meaningful check-in before asking for a large behavior change.",
    ],
    safetyNote: AI_SERVICE_SAFETY_NOTE,
  };
}

export function generateUpgradePersuasion(input: UpgradePersuasionRequest): AiServiceResponse {
  return {
    title: `${input.requiredTier.toUpperCase()} signal captured`,
    summary: "Frame the upgrade around clearer tracking, deeper review surfaces, and saved effort rather than pressure or unsupported outcomes.",
    bullets: [
      `Locked feature: ${input.featureKey}.`,
      "Lead with the specific workflow the athlete already tried to open.",
      "Keep biomarker and enhanced-athlete value props observational and clinician-review friendly.",
    ],
    safetyNote: AI_SERVICE_SAFETY_NOTE,
  };
}
