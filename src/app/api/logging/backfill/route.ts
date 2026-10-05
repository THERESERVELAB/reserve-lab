/**
 * POST /api/logging/backfill
 *
 * Log data for a previous date (yesterday, or any past date).
 * Supports all three log types: training, nutrition, recovery.
 *
 * Body shape: BackfillRequest — discriminated union on logType.
 * Offline-safe: returns local_only when unauthenticated or offline.
 *
 * GET /api/logging/backfill
 * Returns a list of dates that have logged data across all types.
 * Useful for showing a calendar heatmap of adherence.
 */

import { NextResponse } from "next/server";

import { backfillCalendarQuerySchema, backfillRequestSchema } from "@/lib/logging/schemas";
import { computeNutritionTotals, computeSessionVolume } from "@/lib/logging/schemas";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Request body is required." }, { status: 400 });
  }

  const parsed = backfillRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid backfill payload.", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { logType, targetDate, data } = parsed.data;

  if (data.date !== targetDate) {
    return NextResponse.json(
      { error: "Backfill targetDate must match data.date.", targetDate, dataDate: data.date },
      { status: 400 },
    );
  }

  // Validate that targetDate is not in the future
  const today = new Date().toISOString().split("T")[0]!;
  if (targetDate > today) {
    return NextResponse.json(
      { error: "Cannot backfill a future date.", targetDate },
      { status: 400 },
    );
  }

  // Attempt Supabase persistence
  try {
    const supabase = createServerSupabaseClient();
    if (!supabase) throw new Error("Supabase not configured");
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      if (logType === "training") {
        const sessionData = data;
        const { totalVolumeLbs, totalSetsCompleted } = computeSessionVolume(
          sessionData.exerciseLogs,
        );

        const { data: session, error } = await supabase
          .from("training_sessions")
          .upsert(
            {
              user_id: user.id,
              training_style: "Reserve Method",
              focus: sessionData.focus ?? null,
              readiness_score: sessionData.readinessScore ?? null,
              perceived_effort: sessionData.perceivedEffort ?? null,
              notes: sessionData.notes ?? null,
              performed_at: targetDate,
            },
            { onConflict: "user_id,performed_at" },
          )
          .select()
          .single();

        if (error) throw error;

        if (sessionData.exerciseLogs.length > 0 && session) {
          await supabase.from("exercise_logs").insert(
            sessionData.exerciseLogs.map((ex) => ({
              session_id: session.id as string,
              user_id: user.id,
              exercise_name: ex.exerciseName,
              muscle_groups: [ex.bodyGroup ?? ""].filter(Boolean),
              sets: ex.sets,
              notes: ex.notes ?? null,
            })),
          );
        }

        return NextResponse.json({
          ok: true,
          mode: "persisted",
          logType,
          targetDate,
          id: session?.id as string | undefined,
          message: `Training session backfilled for ${targetDate}. ${totalSetsCompleted ?? 0} sets, ${Math.round(totalVolumeLbs ?? 0).toLocaleString()} lbs volume.`,
        });
      }

      if (logType === "nutrition") {
        const nutritionData = data;
        const totals = computeNutritionTotals(nutritionData.meals);

        const { data: log, error } = await supabase
          .from("nutrition_logs")
          .upsert(
            {
              user_id: user.id,
              calories: totals.totalCalories,
              protein_g: totals.totalProtein,
              carbs_g: totals.totalCarbs,
              fat_g: totals.totalFat,
              adherence_score: nutritionData.adherenceScore ?? null,
              logged_at: targetDate,
            },
            { onConflict: "user_id,logged_at" },
          )
          .select()
          .single();

        if (error) throw error;

        return NextResponse.json({
          ok: true,
          mode: "persisted",
          logType,
          targetDate,
          id: log?.id as string | undefined,
          message: `Nutrition backfilled for ${targetDate}. ${totals.totalProtein}g protein, ${totals.totalCalories} kcal.`,
        });
      }

      if (logType === "recovery") {
        const recoveryData = data;
        const { data: savedLog, error: recoveryLogError } = await supabase
          .from("recovery_logs")
          .upsert(
            {
              user_id: user.id,
              logged_at: targetDate,
              hrv: recoveryData.hrv,
              resting_hr: recoveryData.restingHr,
              sleep_hours: recoveryData.sleepHours,
              sleep_quality: recoveryData.sleepQuality,
              readiness_score: recoveryData.readinessScore,
              mood_score: recoveryData.moodScore,
              joint_feedback: recoveryData.jointFeedback,
              cns_feeling: recoveryData.cnsFeeling,
              notes: recoveryData.notes,
              source: "backfill",
            },
            { onConflict: "user_id,logged_at" },
          )
          .select()
          .single();

        if (recoveryLogError) throw recoveryLogError;

        const metrics: Array<{ metric_key: string; value: number; unit: string }> = [];

        if (recoveryData.hrv !== null) metrics.push({ metric_key: "hrv_ms", value: recoveryData.hrv!, unit: "ms" });
        if (recoveryData.restingHr !== null) metrics.push({ metric_key: "resting_hr", value: recoveryData.restingHr!, unit: "bpm" });
        if (recoveryData.sleepHours !== null) metrics.push({ metric_key: "sleep_hours", value: recoveryData.sleepHours!, unit: "hours" });
        if (recoveryData.readinessScore !== null) metrics.push({ metric_key: "readiness_score", value: recoveryData.readinessScore!, unit: "score" });
        if (recoveryData.moodScore !== null) metrics.push({ metric_key: "mood_score", value: recoveryData.moodScore!, unit: "score" });

        if (metrics.length > 0) {
          const inserts = metrics.map((m) => ({
            user_id: user.id,
            metric_key: m.metric_key,
            value: m.value,
            unit: m.unit,
            measured_at: targetDate,
            notes: recoveryData.notes ?? null,
          }));

          const { error } = await supabase.from("body_metrics").insert(inserts);
          if (error) throw error;
        }

        return NextResponse.json({
          ok: true,
          mode: "persisted",
          logType,
          targetDate,
          id: (savedLog?.id as string | undefined) ?? `recovery-${targetDate}`,
          message: `Recovery backfilled for ${targetDate}. ${metrics.length} metrics saved.`,
        });
      }
    }
  } catch {
    // Fall through to local_only
  }

  return NextResponse.json({
    ok: true,
    mode: "local_only",
    logType,
    targetDate,
    id: `local-${logType}-${targetDate}`,
    message: `${logType} log backfilled locally for ${targetDate}. Will sync when authenticated.`,
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = backfillCalendarQuerySchema.safeParse(Object.fromEntries(url.searchParams.entries()));

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid backfill calendar query.", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { days } = parsed.data;

  try {
    const supabase = createServerSupabaseClient();
    if (!supabase) throw new Error("Supabase not configured");
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      const since = cutoff.toISOString().split("T")[0]!;

      const [trainingSessions, nutritionLogs, recoveryLogs] = await Promise.all([
        supabase
          .from("training_sessions")
          .select("performed_at")
          .eq("user_id", user.id)
          .gte("performed_at", since),
        supabase
          .from("nutrition_logs")
          .select("logged_at")
          .eq("user_id", user.id)
          .gte("logged_at", since),
        supabase
          .from("recovery_logs")
          .select("logged_at")
          .eq("user_id", user.id)
          .gte("logged_at", since),
      ]);

      const trainingDates = new Set(
        (trainingSessions.data ?? []).map((s) => s.performed_at as string),
      );
      const nutritionDates = new Set(
        (nutritionLogs.data ?? []).map((n) => n.logged_at as string),
      );
      const recoveryDates = new Set(
        (recoveryLogs.data ?? []).map((r) => r.logged_at as string),
      );

      // Build a calendar view
      const calendar: Array<{
        date: string;
        hasTraining: boolean;
        hasNutrition: boolean;
        hasRecovery: boolean;
        complete: boolean;
      }> = [];

      for (let i = 0; i < days; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split("T")[0]!;
        const hasTraining = trainingDates.has(dateStr);
        const hasNutrition = nutritionDates.has(dateStr);
        const hasRecovery = recoveryDates.has(dateStr);
        calendar.push({
          date: dateStr,
          hasTraining,
          hasNutrition,
          hasRecovery,
          complete: hasTraining && hasNutrition && hasRecovery,
        });
      }

      return NextResponse.json({
        ok: true,
        mode: "remote",
        calendar,
        completeDays: calendar.filter((d) => d.complete).length,
        trainingDays: calendar.filter((d) => d.hasTraining).length,
        nutritionDays: calendar.filter((d) => d.hasNutrition).length,
        recoveryDays: calendar.filter((d) => d.hasRecovery).length,
      });
    }
  } catch {
    // Fall through
  }

  return NextResponse.json({
    ok: true,
    mode: "local_only",
    calendar: [],
    completeDays: 0,
    trainingDays: 0,
    nutritionDays: 0,
    recoveryDays: 0,
    message: "Offline mode.",
  });
}
