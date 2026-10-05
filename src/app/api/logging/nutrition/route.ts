/**
 * POST /api/logging/nutrition
 * Log a nutrition day (full day or quick meal add).
 * Offline-safe: returns local_only if unauthenticated or Supabase unavailable.
 *
 * GET /api/logging/nutrition
 * Retrieve recent nutrition logs.
 * Query params: ?date=YYYY-MM-DD | ?limit=7
 */

import { NextResponse } from "next/server";

import { dateLimitQuerySchema, nutritionDayLogSchema, quickNutritionMealLogSchema } from "@/lib/logging/schemas";
import { computeNutritionTotals } from "@/lib/logging/schemas";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const LOCAL_ONLY_RESPONSE = {
  ok: true,
  mode: "local_only" as const,
  message: "Nutrition log saved locally. Will sync when authenticated.",
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Request body is required." }, { status: 400 });
  }

  // Support both single-meal quick-add and full day log
  const isQuickMeal = "name" in body && "protein" in body && !("meals" in body);

  let parsedDate: string;
  let parsedPayload: ReturnType<typeof nutritionDayLogSchema.parse> | null = null;
  let parsedQuickMeal: ReturnType<typeof quickNutritionMealLogSchema.parse> | null = null;

  if (isQuickMeal) {
    const meal = quickNutritionMealLogSchema.safeParse({
      ...body,
      loggedAt: body.loggedAt ?? new Date().toISOString(),
    });
    if (!meal.success) {
      return NextResponse.json(
        { error: "Invalid meal log payload.", issues: meal.error.flatten() },
        { status: 400 },
      );
    }
    parsedQuickMeal = meal.data;
    parsedDate = meal.data.date ?? new Date().toISOString().split("T")[0]!;
  } else {
    const parsed = nutritionDayLogSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid nutrition day log payload.", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }
    parsedPayload = parsed.data;
    parsedDate = parsed.data.date;
  }

  // Compute totals for full day logs
  if (parsedPayload) {
    const totals = computeNutritionTotals(parsedPayload.meals);
    Object.assign(parsedPayload, totals);
  }

  // Attempt Supabase persistence
  try {
    const supabase = createServerSupabaseClient();
    if (!supabase) throw new Error("Supabase not configured");
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user && (parsedPayload || parsedQuickMeal)) {
      const meals = parsedPayload?.meals ?? (parsedQuickMeal ? [parsedQuickMeal] : []);
      const totals = parsedPayload
        ? {
          totalCalories: parsedPayload.totalCalories,
          totalProtein: parsedPayload.totalProtein,
          totalCarbs: parsedPayload.totalCarbs,
          totalFat: parsedPayload.totalFat,
        }
        : computeNutritionTotals(meals);
      const { data: log, error } = await supabase
        .from("nutrition_logs")
        .upsert(
          {
            user_id: user.id,
            calories: totals.totalCalories,
            protein_g: totals.totalProtein,
            carbs_g: totals.totalCarbs,
            fat_g: totals.totalFat,
            adherence_score: parsedPayload?.adherenceScore ?? null,
            day_type: parsedPayload?.dayType ?? "training",
            meals,
            water_liters: parsedPayload?.waterLiters ?? null,
            notes: parsedPayload?.notes ?? null,
            source: parsedPayload?.source ?? "quick-log",
            logged_at: parsedDate,
          },
          { onConflict: "user_id,logged_at" },
        )
        .select()
        .single();

      if (error) throw error;

      return NextResponse.json({
        ok: true,
        id: log?.id as string | undefined,
        mode: "persisted",
        message: "Nutrition log saved.",
      });
    }
  } catch {
    // Fall through to local_only
  }

  return NextResponse.json({ ...LOCAL_ONLY_RESPONSE, id: `local-${Date.now()}` });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = dateLimitQuerySchema.safeParse(Object.fromEntries(url.searchParams.entries()));

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid nutrition log query.", issues: parsed.error.flatten() },
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
        .from("nutrition_logs")
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
