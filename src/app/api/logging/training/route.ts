/**
 * POST /api/logging/training
 * Log a training session (full or quick).
 * Offline-safe: returns local_only if Supabase is unconfigured or auth is unavailable.
 * Auth integration: Phase 4 (Supabase auth not yet wired).
 *
 * GET /api/logging/training
 * Retrieve recent training sessions.
 * Query params: ?date=YYYY-MM-DD | ?limit=7
 */

import { NextResponse } from "next/server";

import { computeSessionVolume, dateLimitQuerySchema, quickTrainingLogSchema, trainingSessionLogSchema } from "@/lib/logging/schemas";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const LOCAL_ONLY = (extra?: Record<string, unknown>) =>
  NextResponse.json({
    ok: true,
    mode: "local_only" as const,
    message: "Training log validated. Saved locally — will sync when authentication is active.",
    ...extra,
  });

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Request body is required." }, { status: 400 });
  }

  // Support both quick-log and full session log payloads
  const isQuickLog = !("exerciseLogs" in body);

  const parsed = isQuickLog
    ? quickTrainingLogSchema.safeParse(body)
    : trainingSessionLogSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid training log payload.", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // Compute derived volume/set totals for full session logs
  let totalVolumeLbs: number | null = null;
  let totalSetsCompleted: number | null = null;
  if (!isQuickLog && "exerciseLogs" in parsed.data) {
    const computed = computeSessionVolume(parsed.data.exerciseLogs);
    totalVolumeLbs = computed.totalVolumeLbs;
    totalSetsCompleted = computed.totalSetsCompleted;
  }

  // Attempt Supabase persistence. Client local storage remains the source of truth until auth is fully live.
  const supabase = createServerSupabaseClient();
  if (supabase) {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const log = parsed.data;
        const exerciseLogs = "exerciseLogs" in log ? log.exerciseLogs : [];
        const { data: session, error } = await supabase
          .from("training_sessions")
          .upsert(
            {
              user_id: user.id,
              training_style: "Reserve Method",
              focus: log.focus ?? null,
              readiness_score: "readinessScore" in log ? log.readinessScore ?? null : null,
              perceived_effort: log.perceivedEffort ?? null,
              notes: log.notes ?? null,
              performed_at: log.date,
              split_day: "splitDay" in log ? log.splitDay ?? null : null,
              cardio_minutes: log.cardioMinutes ?? null,
              sauna_minutes: log.saunaMinutes ?? null,
              total_volume_lbs: totalVolumeLbs ?? ("estimatedVolumeLbs" in log ? log.estimatedVolumeLbs ?? null : null),
              total_sets_completed: totalSetsCompleted ?? ("completedSets" in log ? log.completedSets ?? null : null),
              status: "status" in log ? log.status : "completed",
              source: "source" in log ? log.source : "quick-log",
              exercise_logs: exerciseLogs,
            },
            { onConflict: "user_id,performed_at" },
          )
          .select()
          .single();

        if (error) throw error;

        return NextResponse.json({
          ok: true,
          id: session?.id as string | undefined,
          mode: "persisted",
          message: "Training log saved.",
          totalVolumeLbs,
          totalSetsCompleted,
        });
      }
    } catch {
      // Fall through to local-only response.
    }
  }

  return LOCAL_ONLY({
    id: `local-training-${Date.now()}`,
    totalVolumeLbs,
    totalSetsCompleted,
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = dateLimitQuerySchema.safeParse(Object.fromEntries(url.searchParams.entries()));

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid training log query.", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { date, limit } = parsed.data;

  try {
    const supabase = createServerSupabaseClient();
    if (!supabase) throw new Error("Supabase not configured");
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      let query = supabase
        .from("training_sessions")
        .select("*")
        .eq("user_id", user.id)
        .order("performed_at", { ascending: false })
        .limit(limit);

      if (date) {
        query = query.eq("performed_at", date);
      }

      const { data, error } = await query;
      if (error) throw error;

      return NextResponse.json({
        ok: true,
        mode: "remote",
        sessions: data ?? [],
        count: data?.length ?? 0,
      });
    }
  } catch {
    // Fall through to local-only response.
  }

  return NextResponse.json({
    ok: true,
    mode: "local_only" as const,
    sessions: [],
    count: 0,
    query: { date: date ?? null, limit },
    message: "Fetch training logs from client localStorage. Server sync active in Phase 4.",
  });
}
