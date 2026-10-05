/**
 * POST /api/logging/recovery
 * Log a recovery snapshot (HRV, sleep, readiness, joint feedback, mood).
 * Offline-safe: returns local_only if unauthenticated or Supabase unavailable.
 *
 * GET /api/logging/recovery
 * Retrieve recent recovery logs.
 * Query params: ?date=YYYY-MM-DD | ?limit=14
 */

import { NextResponse } from "next/server";

import { dateLimitQuerySchema, recoveryLogSchema } from "@/lib/logging/schemas";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const LOCAL_ONLY_RESPONSE = {
  ok: true,
  mode: "local_only" as const,
  message: "Recovery log saved locally. Will sync when authenticated.",
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Request body is required." }, { status: 400 });
  }

  const parsed = recoveryLogSchema.safeParse({
    ...body,
    date: body.date ?? new Date().toISOString().split("T")[0],
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid recovery log payload.", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const log = parsed.data;

  // Attempt Supabase persistence — store into body_metrics (one row per metric)
  try {
    const supabase = createServerSupabaseClient();
    if (!supabase) throw new Error("Supabase not configured");
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: savedLog, error: recoveryLogError } = await supabase
        .from("recovery_logs")
        .upsert(
          {
            user_id: user.id,
            logged_at: log.date,
            hrv: log.hrv,
            resting_hr: log.restingHr,
            sleep_hours: log.sleepHours,
            sleep_quality: log.sleepQuality,
            readiness_score: log.readinessScore,
            mood_score: log.moodScore,
            joint_feedback: log.jointFeedback,
            cns_feeling: log.cnsFeeling,
            notes: log.notes,
            source: log.source,
          },
          { onConflict: "user_id,logged_at" },
        )
        .select()
        .single();

      if (recoveryLogError) throw recoveryLogError;

      const metrics: Array<{ metric_key: string; value: number; unit: string }> = [];

      if (log.hrv !== null) metrics.push({ metric_key: "hrv_ms", value: log.hrv, unit: "ms" });
      if (log.restingHr !== null) metrics.push({ metric_key: "resting_hr", value: log.restingHr, unit: "bpm" });
      if (log.sleepHours !== null) metrics.push({ metric_key: "sleep_hours", value: log.sleepHours, unit: "hours" });
      if (log.readinessScore !== null) metrics.push({ metric_key: "readiness_score", value: log.readinessScore, unit: "score" });
      if (log.moodScore !== null) metrics.push({ metric_key: "mood_score", value: log.moodScore, unit: "score" });

      if (metrics.length > 0) {
        const inserts = metrics.map((m) => ({
          user_id: user.id,
          metric_key: m.metric_key,
          value: m.value,
          unit: m.unit,
          measured_at: log.date,
          notes: log.notes ?? null,
        }));

        const { error } = await supabase.from("body_metrics").insert(inserts);
        if (error) throw error;
      }

      return NextResponse.json({
        ok: true,
        id: (savedLog?.id as string | undefined) ?? `recovery-${log.date}`,
        mode: "persisted",
        message: "Recovery log saved.",
      });
    }
  } catch {
    // Fall through to local_only
  }

  return NextResponse.json({ ...LOCAL_ONLY_RESPONSE, id: `local-recovery-${log.date}` });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = dateLimitQuerySchema.safeParse(Object.fromEntries(url.searchParams.entries()));

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid recovery log query.", issues: parsed.error.flatten() },
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
        .from("recovery_logs")
        .select("*")
        .eq("user_id", user.id)
        .order("logged_at", { ascending: false })
        .limit(limit);

      if (date) {
        query = query.eq("logged_at", date);
      }

      const { data, error } = await query;
      if (error) throw error;

      return NextResponse.json({
        ok: true,
        mode: "remote",
        logs: data ?? [],
        count: data?.length ?? 0,
      });
    }
  } catch {
    // Fall through
  }

  return NextResponse.json({
    ok: true,
    mode: "local_only",
    logs: [],
    count: 0,
    query: { date: date ?? null, limit },
    message: "Offline mode — fetch from client localStorage.",
  });
}
