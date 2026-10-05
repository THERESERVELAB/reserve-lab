"use client";

import { ArrowLeftRight, CheckCircle2, ChevronRight, Sliders, Star } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { GlassPanel } from "@/components/ui/GlassPanel";
import { ReserveBottomSheet, ReserveButton, ReserveSectionHeader } from "@/components/ui/reserve";
import { useAthleteDashboardStore } from "@/lib/athlete-store";
import { NUTRITION_FUEL_LOG_ID } from "@/components/nutrition/fuel-log-anchor";
import { momentMeals, recordMealChange } from "@/components/nutrition/meal-moment/meal-moment-store";
import { useTodayFuelPlan } from "@/lib/nutrition/useTodayFuelPlan";
import { MealConfirmationDrawer } from "@/components/views/nutrition/MealConfirmationDrawer";
import { goalKeyFromString } from "@/lib/nutrition/adapter";
import { fuelPlanForConfirmation, mealWindowMissed } from "@/lib/nutrition/nutrition-room";
import type { DietStyleKey } from "@/lib/nutrition/types";
import { RESERVE } from "@/lib/design/tokens";
import { formatTime12, localScheduleDateKey } from "@/lib/schedule/engine";
import {
  applyMealConfig,
  buildNightCloseout,
  buildWeeklyFuelPlan,
  INGREDIENT_GROUP_LABEL,
  MACRO_ESTIMATE_NOTE,
  MEAL_CONFIGS,
  plateComposition,
  SLOT_LABEL,
  summarizeLoggedProtein,
  WEIGHT_NOTE,
  type MealConfigKey,
  type MealSlot,
  type PlannedFuelMeal,
} from "@/lib/nutrition/fuel-plan";
import { getMealSwaps, type SwapOption } from "@/lib/nutrition/meal-swap";
import type { SignatureIngredientRole, SignatureMeal, SignatureMealPurpose } from "@/lib/nutrition/signature-meals";
import type { GroceryCategory } from "@/lib/nutrition/grocery-engine";
import {
  buildNutritionCoverage,
  coverageSummary,
  COVERAGE_STATUS_LABEL,
  OMEGA3_FISH_OPTIONS,
} from "@/lib/nutrition/micronutrient-coverage";

/* ════════════════════════════════════════════════════════════════════════
   TODAY'S MEALS — the Nutrition room's dominant region.

   A timeline of rows: time · meal · protein and calories · Log. Five full
   meal cards used to stack here, each with macro tiles, a paragraph of
   rationale and four buttons. The plate, the macros and the reasoning are
   real and kept: they open in a sheet from the row, and Swap, Configure and
   Save live inside that sheet.

   "Log" never logs on tap. It opens the same meal confirmation the hero
   opens, and nothing counts until the member confirms.
   ════════════════════════════════════════════════════════════════════════ */

const IVORY = "#f2eee6";

/* Classify a food ingredient string for the signature-meal converter. */
function classifyIngredient(s: string): { role: SignatureIngredientRole; grocery: GroceryCategory } {
  const t = s.toLowerCase();
  if (/egg|chicken|beef|steak|turkey|salmon|tuna|fish|shrimp|trout|sardine|cod|mackerel|yogurt|whey|cottage|tofu|protein|jerky|ground/.test(t)) return { role: "protein", grocery: "protein" };
  if (/avocado|nut butter|peanut|almond|olive oil|\boil\b|sesame|chia|flax|seeds|\bbutter\b/.test(t)) return { role: "fat", grocery: "fat" };
  if (/spinach|greens|broccoli|pepper|cucumber|asparagus|tomato|edamame|beans|lettuce|romaine|salsa|garlic/.test(t)) return { role: "produce", grocery: "vegetable" };
  if (/berry|berries|orange|citrus|kiwi|strawberr|banana|pineapple|fruit|apple|jelly|honey|lemon/.test(t)) return { role: "produce", grocery: "fruit" };
  if (/rice|sourdough|bread|potato|\boat|granola|cream of rice|rice cake|pasta|tortilla|grain/.test(t)) return { role: "carb", grocery: "carb" };
  return { role: "snack", grocery: "carb" };
}

const SLOT_TO_PURPOSE: Record<MealSlot, SignatureMealPurpose> = {
  breakfast: "morning-anchor", "pre-workout": "pre-workout", "post-workout": "post-workout",
  dinner: "night-recovery", lunch: "custom", snack: "macro-rescue",
};

export function favoriteName(meal: PlannedFuelMeal): string {
  return meal.config ? `${meal.name} (${meal.config})` : meal.name;
}

export function plannedToSignature(meal: PlannedFuelMeal): Omit<SignatureMeal, "id" | "createdAt"> {
  return {
    name: favoriteName(meal),
    purpose: SLOT_TO_PURPOSE[meal.slot] ?? "custom",
    ingredients: meal.ingredients.map((name, i) => {
      const c = classifyIngredient(name);
      return { id: `ing-${i}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 24)}`, name, role: c.role, groceryCategory: c.grocery };
    }),
    manualMacros: true,
    macros: { calories: meal.macros.calories, proteinG: meal.macros.proteinG, carbsG: meal.macros.carbsG, fatG: meal.macros.fatG },
    frequencyPerWeek: 0,
    favorite: true,
    addedToday: false,
    inRotation: false,
    notes: meal.smartRead,
  };
}

function timeLabel(time: string | null): string {
  return time ? formatTime12(time) : "Any time";
}

type SheetMode = "detail" | "swap" | "configure";

export function FuelCommandPanel() {
  const scheduleProfile = useAthleteDashboardStore((s) => s.scheduleProfile);
  const prefs = useAthleteDashboardStore((s) => s.nutritionPrefs);
  const loggedMealIds = prefs.loggedMealIds;
  const toggleLoggedMeal = useAthleteDashboardStore((s) => s.toggleLoggedMeal);
  const confirmMealLog = useAthleteDashboardStore((s) => s.confirmMealLog);
  const undoLastMealLog = useAthleteDashboardStore((s) => s.undoLastMealLog);
  const fuelProfileGoal = useAthleteDashboardStore((s) => s.profile.goal);
  const fuelSessionMode = useAthleteDashboardStore((s) => s.trainingSession.sessionMode);
  const setActiveView = useAthleteDashboardStore((s) => s.setActiveView);
  const addSignatureMeal = useAthleteDashboardStore((s) => s.addSignatureMeal);

  /* Per-meal overrides from Swap / Configure (session-local). */
  const [overrides, setOverrides] = useState<Record<string, PlannedFuelMeal>>({});
  const [sheet, setSheet] = useState<{ mealId: string; mode: SheetMode } | null>(null);
  const [coverageOpen, setCoverageOpen] = useState(false);
  const closeSheet = useCallback(() => setSheet(null), []);
  const closeCoverage = useCallback(() => setCoverageOpen(false), []);

  /* Today's fuel plan, built once for the whole room: the hero, its fuel horizon
     and this log read the same meals, so a meal logged anywhere ticks here. */
  const { goal, personalization, favoriteInputs, today, dailyPlan, activeMealPlan } = useTodayFuelPlan();
  const renderMeal = useCallback((m: PlannedFuelMeal): PlannedFuelMeal => overrides[m.id] ?? m, [overrides]);

  /* "Log" opens the same confirmation the Nutrition hero opens: nothing
     counts until the member confirms. The date is taken when it opens. */
  const [confirm, setConfirm] = useState<{ mealId: string; date: string } | null>(null);
  const closeConfirm = useCallback(() => setConfirm(null), []);
  const confirmPlan = useMemo(
    () =>
      fuelPlanForConfirmation({
        plan: { ...dailyPlan, meals: dailyPlan.meals.map((meal) => overrides[meal.id] ?? meal) },
        loggedMealIds,
        dietStyle: prefs.dietStyle as DietStyleKey,
        date: confirm?.date ?? "",
      }),
    [dailyPlan, overrides, loggedMealIds, prefs.dietStyle, confirm?.date],
  );
  const confirmTarget = confirm ? (confirmPlan.meals.find((meal) => meal.id === confirm.mealId) ?? null) : null;
  const existingFavNames = useMemo(() => new Set((prefs.signatureMeals ?? []).map((m) => m.name)), [prefs.signatureMeals]);

  /* Every meal log or clear here lands as the room's meal moment. It reads the
     same plan meals the hero's protein readout reads. */
  const recordMeal = (write: () => void) =>
    recordMealChange({ meals: momentMeals(dailyPlan.meals), proteinTargetG: dailyPlan.targets.proteinG, write });

  function logOrUndo(mealId: string) {
    if (!loggedMealIds.includes(mealId)) {
      setConfirm({ mealId, date: localScheduleDateKey(new Date()) });
      return;
    }
    if (prefs.latestMealLog?.mealId === mealId) recordMeal(() => undoLastMealLog());
    else recordMeal(() => toggleLoggedMeal(mealId));
  }

  function applySwap(orig: PlannedFuelMeal, opt: SwapOption) {
    setOverrides((prev) => ({
      ...prev,
      [orig.id]: {
        id: orig.id, slot: orig.slot, windowLabel: orig.windowLabel, time: orig.time,
        name: opt.name, ingredients: opt.ingredients, ingredientsDetailed: opt.ingredientsDetailed,
        macros: opt.macros, prep: opt.prep, covers: opt.covers,
        smartRead: `${opt.reason} ${opt.macroDirection}.`, isSnack: false, fromFavorite: opt.fromFavorite,
      },
    }));
    setSheet({ mealId: orig.id, mode: "detail" });
  }
  function applyConfig(orig: PlannedFuelMeal, key: MealConfigKey) {
    setOverrides((prev) => ({ ...prev, [orig.id]: applyMealConfig(renderMeal(orig), key) }));
    setSheet({ mealId: orig.id, mode: "detail" });
  }

  const coverage = useMemo(() => {
    const coveredKeys = Array.from(new Set(dailyPlan.meals.flatMap((m) => (overrides[m.id] ?? m).covers).concat(["protein"])));
    return buildNutritionCoverage({ coveredKeys, loggedCount: loggedMealIds.length, hasPlan: true });
  }, [dailyPlan, overrides, loggedMealIds.length]);
  const covSummary = coverageSummary(coverage);
  const watchSignals = coverage.filter((s) => s.status === "low" || s.status === "watch").slice(0, 4);

  /* The clock arrives after mount so server and first client render agree. */
  const [nowMin, setNowMin] = useState<number | null>(null);
  useEffect(() => {
    const t = setTimeout(() => {
      const d = new Date();
      setNowMin(d.getHours() * 60 + d.getMinutes());
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const proteinLogged = summarizeLoggedProtein(dailyPlan.meals, loggedMealIds, overrides);
  /* Night closeout: late in the day a passed, unlogged window reads as missed, not as a live action. */
  const closeout = useMemo(() => buildNightCloseout({
    nowMinutes: nowMin ?? 12 * 60,
    sleepTarget: scheduleProfile.sleepTarget,
    meals: dailyPlan.meals,
    loggedMealIds,
    proteinLogged,
    proteinTarget: dailyPlan.targets.proteinG,
  }), [nowMin, scheduleProfile.sleepTarget, dailyPlan.meals, dailyPlan.targets.proteinG, loggedMealIds, proteinLogged]);

  const loggedCount = dailyPlan.meals.filter((m) => loggedMealIds.includes(m.id)).length;
  const sheetBase = sheet ? dailyPlan.meals.find((m) => m.id === sheet.mealId) ?? null : null;
  const sheetMeal = sheetBase ? renderMeal(sheetBase) : null;
  const sheetTitle = !sheet || !sheetMeal ? "Meal" : sheet.mode === "swap" ? "Swap Meal" : sheet.mode === "configure" ? "Configure Meal" : sheetMeal.name;

  return (
    <GlassPanel accent={RESERVE.gold} noPad phone="flush" className="md:overflow-hidden">
      {/* The hero's "Review Today's Fuel Log" brings this into view. */}
      <section
        id={NUTRITION_FUEL_LOG_ID}
        tabIndex={-1}
        aria-label="Today's meals"
        data-nutrition="meals"
        className="scroll-mt-4 pb-2 pt-4 outline-none md:px-6 md:py-5"
      >
        <ReserveSectionHeader
          label="Today's meals"
          accent={RESERVE.gold}
          action={
            dailyPlan.meals.length > 0 ? (
              <span className="tnum shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-white/55">
                {loggedCount} of {dailyPlan.meals.length} logged
              </span>
            ) : undefined
          }
        />

        {dailyPlan.meals.length === 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 py-2">
            <p className="text-[13px] text-white/65">No meal windows are set for today. Meal windows come from your schedule.</p>
            <ReserveButton tier="secondary" size="sm" onClick={() => setActiveView("schedule-command")}>Set Meal Windows</ReserveButton>
          </div>
        ) : (
          <ol className="divide-y divide-white/[0.06]">
            {dailyPlan.meals.map((base) => {
              const m = renderMeal(base);
              const logged = loggedMealIds.includes(base.id);
              const missed = mealWindowMissed({ logged, isSnack: base.isSnack, closeoutActive: closeout.active, mealTime: base.time, nowMin });
              return (
                <li key={base.id} data-meal-row={base.id} className="flex items-center gap-2 py-1.5 sm:gap-3">
                  <button
                    type="button"
                    aria-haspopup="dialog"
                    onClick={() => setSheet({ mealId: base.id, mode: "detail" })}
                    className="group flex min-h-[52px] min-w-0 flex-1 items-center gap-3 rounded-lg text-left transition-colors hover:bg-white/[0.02]"
                  >
                    <span className="tnum w-[58px] shrink-0 font-mono text-[11px] text-white/60 sm:w-[68px]">{timeLabel(base.time)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-mono text-[9px] uppercase tracking-[0.18em] text-white/50">
                        {base.optional ? base.windowLabel : SLOT_LABEL[m.slot]}
                        {logged ? " · Logged" : missed ? " · Missed" : ""}
                      </span>
                      <span className={`block truncate text-[14px] font-semibold ${logged ? "text-white/60" : "text-[#f2eee6]"}`}>{m.name}</span>
                    </span>
                    <span className="tnum hidden shrink-0 text-right text-[12px] leading-tight text-white/65 sm:block">
                      {m.macros.proteinG}g protein
                      <span className="block text-white/45">{m.macros.calories} kcal</span>
                    </span>
                    <span className="tnum shrink-0 text-[12px] text-white/60 sm:hidden">{m.macros.proteinG}g</span>
                    <ChevronRight size={14} className="shrink-0 text-white/30 transition-colors group-hover:text-white/60" aria-hidden="true" />
                  </button>
                  <span data-fuel="log-meal" className="shrink-0">
                    <ReserveButton
                      tier={logged ? "quiet" : "secondary"}
                      size="sm"
                      accent={logged ? RESERVE.green : RESERVE.gold}
                      icon={logged ? CheckCircle2 : undefined}
                      onClick={() => logOrUndo(base.id)}
                    >
                      {logged ? "Undo" : missed ? "Log If Eaten" : "Log"}
                    </ReserveButton>
                  </span>
                </li>
              );
            })}
          </ol>
        )}

        {/* Food coverage, as one row. The detail opens in a sheet. */}
        {dailyPlan.meals.length > 0 && (
          <button
            type="button"
            aria-haspopup="dialog"
            data-nutrition="coverage"
            onClick={() => setCoverageOpen(true)}
            className="mt-1 flex min-h-[48px] w-full items-center gap-3 border-t border-white/[0.06] pt-1 text-left text-[12.5px] text-white/65 transition-colors hover:text-white/85"
          >
            <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/50">Food coverage</span>
            <span className="min-w-0 flex-1 truncate">
              {watchSignals.length === 0
                ? "Core food groups covered today"
                : `${covSummary.low} low · ${covSummary.watch} to watch · ${covSummary.strong} covered`}
            </span>
            <ChevronRight size={14} className="shrink-0 text-white/30" aria-hidden="true" />
          </button>
        )}
      </section>

      {/* ── The meal: plate, macros, the reasoning, and Swap / Configure / Save ── */}
      <ReserveBottomSheet open={Boolean(sheet && sheetMeal)} onClose={closeSheet} title={sheetTitle}>
        {sheet && sheetMeal && sheetBase && (
          <MealSheetBody
            meal={sheetMeal}
            mode={sheet.mode}
            logged={loggedMealIds.includes(sheetBase.id)}
            saved={existingFavNames.has(favoriteName(sheetMeal))}
            swaps={
              sheet.mode === "swap"
                ? getMealSwaps({ currentName: sheetMeal.name, currentMacros: sheetMeal.macros, slot: sheetMeal.slot, goal, isTrainingDay: !today.recovery, favorites: favoriteInputs, personalization })
                : []
            }
            ownPlanName={activeMealPlan?.name ?? null}
            onMode={(mode) => setSheet({ mealId: sheetBase.id, mode })}
            onLog={() => {
              setSheet(null);
              logOrUndo(sheetBase.id);
            }}
            onSave={() => addSignatureMeal(plannedToSignature(sheetMeal))}
            onSwap={(opt) => applySwap(sheetBase, opt)}
            onConfig={(key) => applyConfig(sheetBase, key)}
          />
        )}
      </ReserveBottomSheet>

      <ReserveBottomSheet open={coverageOpen} onClose={closeCoverage} title="Food coverage">
        <p className="text-[12px] leading-[1.55] text-white/60">
          Estimated from the foods in today&apos;s plan. Not a medical assessment; review lab results or concerns with a qualified clinician.
        </p>
        <ul className="mt-3 divide-y divide-white/[0.06]">
          {watchSignals.length === 0 ? (
            <li className="py-3 text-[13px] text-white/70">Today&apos;s plan covers the core food groups.</li>
          ) : (
            watchSignals.map((s) => (
              <li key={s.key} className="py-3">
                <p className="flex items-baseline justify-between gap-3 text-[13px] font-semibold text-[#f2eee6]">
                  {s.label}
                  <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.14em] text-white/50">{COVERAGE_STATUS_LABEL[s.status]}</span>
                </p>
                <p className="mt-1 text-[12px] leading-[1.5] text-white/65">{s.foodSuggestion}</p>
              </li>
            ))
          )}
        </ul>
        {watchSignals.some((s) => s.key === "omega-3") && (
          <p className="mt-2 text-[12px] leading-[1.5] text-white/60">
            Omega-3 food options · {OMEGA3_FISH_OPTIONS.slice(0, 3).map((f) => f.name).join(" · ")}
          </p>
        )}
      </ReserveBottomSheet>

      {/* Portalled to the body so no glass panel becomes the drawer's containing block. */}
      {nowMin !== null && typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          {confirmTarget && (
            <MealConfirmationDrawer
              key={`fuel-meal-confirm-${confirmTarget.id}`}
              target={confirmTarget}
              plan={confirmPlan}
              schedule={scheduleProfile}
              goal={goalKeyFromString(fuelProfileGoal)}
              trainingComplete={fuelSessionMode === "complete" || fuelSessionMode === "closed"}
              loggedIds={loggedMealIds}
              nowMinutes={nowMin}
              onConfirm={(event) => recordMeal(() => confirmMealLog(event))}
              onUndo={() => recordMeal(() => undoLastMealLog())}
              onClose={closeConfirm}
              onPickMeal={(id) => setConfirm((prev) => (prev ? { ...prev, mealId: id } : prev))}
            />
          )}
        </AnimatePresence>,
        document.body,
      )}
    </GlassPanel>
  );
}

/* ─── The meal sheet ─────────────────────────────────────────────────────── */

function MealSheetBody({
  meal,
  mode,
  logged,
  saved,
  swaps,
  onMode,
  onLog,
  onSave,
  ownPlanName,
  onSwap,
  onConfig,
}: {
  meal: PlannedFuelMeal;
  mode: SheetMode;
  logged: boolean;
  saved: boolean;
  swaps: SwapOption[];
  /** The member's own meal plan, when one is running. Swap and Configure would fight it. */
  ownPlanName: string | null;
  onMode: (mode: SheetMode) => void;
  onLog: () => void;
  onSave: () => void;
  onSwap: (opt: SwapOption) => void;
  onConfig: (key: MealConfigKey) => void;
}) {
  if (mode === "swap") {
    return (
      <div>
        <p className="text-[12px] text-white/55">{SLOT_LABEL[meal.slot]} · replacing {meal.name}</p>
        <ul className="mt-2 divide-y divide-white/[0.06]">
          {swaps.map((opt) => (
            <li key={opt.id}>
              <button type="button" onClick={() => onSwap(opt)} className="block min-h-[44px] w-full py-3 text-left transition-colors hover:bg-white/[0.02]">
                <span className="block text-[13px] font-semibold text-[#f2eee6]">
                  {opt.name}
                  {opt.fromFavorite && <span className="ml-2 font-mono text-[9px] uppercase tracking-[0.14em] text-white/50">Favorite</span>}
                </span>
                <span className="mt-0.5 block text-[12px] leading-snug text-white/60">{opt.reason}</span>
                <span className="tnum mt-1 block font-mono text-[10px] uppercase tracking-[0.1em] text-white/50">
                  {opt.macros.proteinG}g protein · {opt.macros.calories} kcal · {opt.macroDirection}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-3">
          <ReserveButton tier="quiet" size="sm" onClick={() => onMode("detail")}>Back to Meal</ReserveButton>
        </div>
      </div>
    );
  }

  if (mode === "configure") {
    return (
      <div>
        <p className="text-[12px] text-white/55">Portions adjust as estimates. Ingredients you have not chosen do not change.</p>
        <ul className="mt-2 divide-y divide-white/[0.06]">
          {MEAL_CONFIGS.map((cfg) => {
            const preview = applyMealConfig(meal, cfg.key);
            return (
              <li key={cfg.key}>
                <button type="button" onClick={() => onConfig(cfg.key)} className="block min-h-[44px] w-full py-3 text-left transition-colors hover:bg-white/[0.02]">
                  <span className="flex items-baseline justify-between gap-3 text-[13px] font-semibold text-[#f2eee6]">
                    {cfg.label}
                    <span className="tnum shrink-0 font-mono text-[10px] text-white/55">{preview.macros.proteinG}g · {preview.macros.calories} kcal</span>
                  </span>
                  <span className="mt-0.5 block text-[12px] leading-snug text-white/60">{cfg.note}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="mt-3">
          <ReserveButton tier="quiet" size="sm" onClick={() => onMode("detail")}>Back to Meal</ReserveButton>
        </div>
      </div>
    );
  }

  const rows = plateComposition(meal.ingredientsDetailed);
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/55">
        {SLOT_LABEL[meal.slot]} · {meal.windowLabel} · {timeLabel(meal.time)}
        {meal.config ? ` · ${meal.config}` : ""}
      </p>

      <dl className="tnum mt-3 grid grid-cols-4 gap-2">
        {([
          ["Calories", `${meal.macros.calories}`],
          ["Protein", `${meal.macros.proteinG}g`],
          ["Carbs", `${meal.macros.carbsG}g`],
          ["Fat", `${meal.macros.fatG}g`],
        ] as const).map(([k, v]) => (
          <div key={k} className="min-w-0">
            <dt className="font-mono text-[9px] uppercase tracking-[0.14em] text-white/50">{k}</dt>
            <dd className="mt-0.5 text-[17px] font-bold" style={{ color: IVORY }}>{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.12em] text-white/40">{MACRO_ESTIMATE_NOTE}</p>

      <div className="mt-4 border-t border-white/[0.06] pt-3">
        {rows.length === 0 ? (
          <p className="text-[12.5px] leading-[1.5] text-white/70">{meal.ingredients.length ? meal.ingredients.join(" · ") : "Your saved recipe"}</p>
        ) : (
          <dl className="space-y-1.5">
            {rows.map((row) => (
              <div key={row.group} className="flex items-baseline gap-3">
                <dt className="w-[64px] shrink-0 font-mono text-[9px] uppercase tracking-[0.14em] text-white/50">{INGREDIENT_GROUP_LABEL[row.group]}</dt>
                <dd className="min-w-0 flex-1 text-[12.5px] leading-[1.5] text-white/75">
                  {row.items.map((it) => [it.amount && it.amount !== "to taste" && it.amount !== "pinch" ? `${it.amount} ${it.name}` : it.name, it.note ? `(${it.note})` : ""].filter(Boolean).join(" ")).join(" · ")}
                </dd>
              </div>
            ))}
          </dl>
        )}
        {meal.ingredientsDetailed?.length ? <p className="mt-1.5 font-mono text-[9px] uppercase tracking-[0.12em] text-white/40">{WEIGHT_NOTE}</p> : null}
      </div>

      <p className="mt-4 border-t border-white/[0.06] pt-3 text-[12.5px] leading-[1.55] text-white/65">{meal.smartRead}</p>
      {meal.prep.length > 0 && <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-white/50">Prep · {meal.prep.join(" · ")}</p>}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <ReserveButton tier="secondary" size="sm" icon={logged ? CheckCircle2 : undefined} onClick={onLog}>
          {logged ? "Undo Log" : "Log This Meal"}
        </ReserveButton>
        {/* The optional pre-workout shake is a fixed food-only slot: nothing to swap, configure or save as a plate. */}
        {!meal.optional && (
          <>
            {/* A meal from the member's own plan is theirs — Reserve does not swap
                it out or rescale it behind their back. Edit the plan instead. */}
            {ownPlanName ? (
              <>
                <ReserveButton tier="quiet" size="sm" icon={ArrowLeftRight} disabled disabledReason={`${ownPlanName} sets this meal — edit it in My Meal Plan`}>Swap</ReserveButton>
                <ReserveButton tier="quiet" size="sm" icon={Sliders} disabled disabledReason={`${ownPlanName} sets this meal — edit it in My Meal Plan`}>Configure</ReserveButton>
              </>
            ) : (
              <>
                <ReserveButton tier="quiet" size="sm" icon={ArrowLeftRight} onClick={() => onMode("swap")}>Swap</ReserveButton>
                <ReserveButton tier="quiet" size="sm" icon={Sliders} onClick={() => onMode("configure")}>Configure</ReserveButton>
              </>
            )}
            {saved ? (
              <span className="inline-flex min-h-[44px] items-center gap-1.5 px-2 font-mono text-[10px] uppercase tracking-[0.12em] text-white/55">
                <Star size={12} aria-hidden="true" /> Saved
              </span>
            ) : (
              <ReserveButton tier="quiet" size="sm" icon={Star} onClick={onSave}>Save</ReserveButton>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Week & prep: the weekly fuel plan, as rows ─────────────────────────── */

export function WeeklyFuelPlanList() {
  const { goal, trainingWeek, weekDateKeys, planForDate } = useTodayFuelPlan();
  const weeklyPlan = useMemo(() => {
    /* Each day's lead plate from that day's own rotation: dinner (or the last plate) on a
       training day, breakfast on a recovery day. The week runs Monday first, like the dates. */
    const leads = trainingWeek.map((d, i) => {
      const date = weekDateKeys[i];
      if (!date) return null;
      const plates = planForDate(date, !d.recovery, d.sessionName).meals.filter((m) => !m.isSnack);
      const lead = d.recovery ? plates[0] : (plates.find((m) => m.slot === "dinner") ?? plates[plates.length - 1]);
      return lead?.name ?? null;
    });
    return buildWeeklyFuelPlan(trainingWeek.map((d) => ({ day: d.day, sessionName: d.sessionName, recovery: d.recovery })), goal, leads);
  }, [trainingWeek, goal, weekDateKeys, planForDate]);
  return (
    <GlassPanel accent={RESERVE.gold} phone="flush">
      <ReserveSectionHeader label="Weekly fuel plan" accent={RESERVE.gold} />
      <p className="text-[12px] text-white/55">Aligned to your training week, projected from your current split.</p>
      <ol className="mt-2 divide-y divide-white/[0.06]">
        {weeklyPlan.map((d) => (
          <li key={d.day} className="grid grid-cols-[44px_minmax(0,1fr)] gap-x-3 py-2.5 sm:grid-cols-[52px_minmax(0,1fr)_auto]">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/55">{d.day}</span>
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-semibold text-[#f2eee6]">{d.sessionName}</span>
              <span className="block text-[12px] leading-snug text-white/55">{d.emphasis}</span>
            </span>
            <span className="col-start-2 font-mono text-[10px] uppercase tracking-[0.12em] text-white/50 sm:col-start-auto sm:text-right">{d.carbCue} · {d.leadMeal}</span>
          </li>
        ))}
      </ol>
    </GlassPanel>
  );
}

/* ─── Week & prep: favorite meals, as rows ──────────────────────────────── */

export function FavoriteMealsList() {
  const prefs = useAthleteDashboardStore((s) => s.nutritionPrefs);
  const toggleSignatureMealToday = useAthleteDashboardStore((s) => s.toggleSignatureMealToday);
  const favorites = (prefs.signatureMeals ?? []).filter((m) => m.favorite);
  return (
    <GlassPanel accent={RESERVE.violet} phone="flush">
      <ReserveSectionHeader label="Favorite meals" accent={RESERVE.violet} />
      {favorites.length === 0 ? (
        <p className="text-[12.5px] text-white/60">No favorites yet. Save a meal from today&apos;s plan, or star one in your signature meals.</p>
      ) : (
        <ul className="divide-y divide-white/[0.06]">
          {favorites.slice(0, 6).map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 py-2">
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-semibold text-[#f2eee6]">{m.name}</span>
                {m.macros && <span className="tnum block font-mono text-[10px] uppercase tracking-[0.12em] text-white/50">{m.macros.proteinG}g protein · {m.macros.calories} kcal</span>}
              </span>
              <ReserveButton
                tier={m.addedToday ? "quiet" : "secondary"}
                size="sm"
                accent={RESERVE.violet}
                icon={m.addedToday ? CheckCircle2 : undefined}
                onClick={() => toggleSignatureMealToday(m.id)}
              >
                {m.addedToday ? "On Today" : "Add to Today"}
              </ReserveButton>
            </li>
          ))}
        </ul>
      )}
    </GlassPanel>
  );
}
