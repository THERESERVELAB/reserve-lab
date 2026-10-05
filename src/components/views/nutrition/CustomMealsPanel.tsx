"use client";

import { motion } from "framer-motion";
import { CheckCircle2, ChefHat, Plus, Star, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";

import { useAthleteDashboardStore } from "@/lib/athlete-store";
import {
  newCustomMealId,
  newIngredientId,
  type CustomMeal,
  type CustomMealIngredient,
} from "@/lib/nutrition/custom-meals";
import {
  COOKING_METHODS,
  estimateMealMacros,
  type CookingMethod,
} from "@/lib/nutrition/ingredient-estimator";
import { addMealToDay, todayDate } from "@/lib/logging/store";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { ReserveSelect } from "@/components/ui/reserve";

const GOLD = "#d5b15f";
const GREEN = "#79e3b5";
const AMBER = "#e8c87a";
const RED = "#ef7d55";

const inputCls =
  "w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[13px] text-[#f2eee6] outline-none transition-colors focus:border-[#d5b15f]/40 placeholder:text-white/18";

type DraftIngredient = CustomMealIngredient;

type Draft = {
  id: string;
  name: string;
  ingredients: DraftIngredient[];
  method: CookingMethod;
  servings: number;
};

function newDraft(): Draft {
  return {
    id: newCustomMealId(),
    name: "",
    ingredients: [
      { id: newIngredientId(), name: "", grams: null },
      { id: newIngredientId(), name: "", grams: null },
    ],
    method: "pan-seared",
    servings: 1,
  };
}

/** Member-authored meals — build from your own ingredients, get estimated
    macros, save favorites, and log eaten meals into the daily record.
    All numbers are estimates, never medical nutrition guidance. */
export function CustomMealsPanel() {
  const customMeals = useAthleteDashboardStore((s) => s.customMeals);
  const saveCustomMeal = useAthleteDashboardStore((s) => s.saveCustomMeal);
  const deleteCustomMeal = useAthleteDashboardStore((s) => s.deleteCustomMeal);
  const toggleCustomMealFavorite = useAthleteDashboardStore((s) => s.toggleCustomMealFavorite);

  const [builderOpen, setBuilderOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => newDraft());
  const [justLoggedId, setJustLoggedId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const estimate = useMemo(
    () => estimateMealMacros(draft.ingredients.filter((i) => i.name.trim()), draft.method, draft.servings),
    [draft],
  );

  function patchDraft(patch: Partial<Draft>) {
    setDraft((d) => ({ ...d, ...patch }));
  }

  function saveDraft() {
    if (!draft.name.trim() || estimate.ingredients.length === 0) return;
    const now = new Date().toISOString();
    const meal: CustomMeal = {
      id: draft.id,
      name: draft.name.trim(),
      ingredients: draft.ingredients.filter((i) => i.name.trim()),
      method: draft.method,
      servings: Math.max(1, draft.servings),
      est: estimate.perServing,
      favorite: false,
      createdAt: now,
      updatedAt: now,
    };
    saveCustomMeal(meal);
    setDraft(newDraft());
    setBuilderOpen(false);
  }

  function logMeal(meal: CustomMeal) {
    // Writes into the offline nutrition day log (syncable) so the meal counts
    // in daily history. Estimated macros only.
    addMealToDay(todayDate(), {
      id: `${meal.id}-${Date.now()}`,
      name: `${meal.name} (custom)`,
      protein: meal.est.proteinG,
      carbs: meal.est.carbsG,
      fat: meal.est.fatG,
      calories: meal.est.calories,
      timing: null,
      foods: meal.ingredients.map((i) => i.name),
      isQuickAdd: false,
      comboId: null,
      loggedAt: new Date().toISOString(),
    });
    setJustLoggedId(meal.id);
    setTimeout(() => setJustLoggedId((v) => (v === meal.id ? null : v)), 2600);
  }

  const favorites = customMeals.filter((m) => m.favorite);
  const rest = customMeals.filter((m) => !m.favorite);

  return (
    <GlassPanel accent={AMBER}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ChefHat size={13} style={{ color: AMBER }} />
            <p className="font-mono text-[9px] uppercase tracking-[0.26em]" style={{ color: `${AMBER}cc` }}>Your Meals · Custom Kitchen</p>
          </div>
          <p className="mt-1.5 max-w-xl text-[11.5px] leading-[1.55] text-white/45">
            Build meals from your own ingredients — Reserve estimates the macros from what you cook and how you cook it.
            Estimates only, not medical nutrition guidance.
          </p>
        </div>
        <motion.button
          type="button"
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => setBuilderOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 font-mono text-[9px] uppercase tracking-[0.18em]"
          style={{ borderColor: `${GOLD}40`, background: `${GOLD}12`, color: GOLD }}
        >
          {builderOpen ? <X size={12} /> : <Plus size={12} />}
          {builderOpen ? "Close Builder" : "New Meal"}
        </motion.button>
      </div>

      {/* Builder */}
      {builderOpen && (
        <div className="mt-4 rounded-2xl bg-black/20 p-4">
          <label className="block">
            <span className="font-mono text-[8px] uppercase tracking-[0.2em] text-white/30">Meal name</span>
            <input
              value={draft.name}
              onChange={(e) => patchDraft({ name: e.target.value })}
              maxLength={60}
              placeholder="e.g. Beef + jasmine rice bowl"
              className={`mt-1.5 ${inputCls}`}
            />
          </label>

          <p className="mt-4 font-mono text-[8px] uppercase tracking-[0.2em] text-white/30">Ingredients</p>
          <div className="mt-2 grid gap-2">
            {draft.ingredients.map((ing) => (
              <div key={ing.id} className="grid grid-cols-[minmax(0,1fr)_92px_auto] items-center gap-2">
                <input
                  value={ing.name}
                  onChange={(e) => patchDraft({ ingredients: draft.ingredients.map((x) => (x.id === ing.id ? { ...x, name: e.target.value } : x)) })}
                  placeholder="e.g. ground beef, jasmine rice, cilantro"
                  className={inputCls}
                />
                <input
                  value={ing.grams ?? ""}
                  onChange={(e) => patchDraft({ ingredients: draft.ingredients.map((x) => (x.id === ing.id ? { ...x, grams: e.target.value === "" ? null : Math.max(0, Number(e.target.value) || 0) } : x)) })}
                  placeholder="grams"
                  inputMode="numeric"
                  className={`${inputCls} text-center`}
                />
                <button
                  type="button"
                  onClick={() => patchDraft({ ingredients: draft.ingredients.filter((x) => x.id !== ing.id) })}
                  className="rounded-lg border border-white/[0.07] p-1.5 text-white/25 transition hover:text-[#ef7d55]"
                  aria-label="Remove ingredient"
                >
                  <X size={11} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => patchDraft({ ingredients: [...draft.ingredients, { id: newIngredientId(), name: "", grams: null }] })}
              className="inline-flex w-fit items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-1.5 font-mono text-[8px] uppercase tracking-[0.16em] text-white/45 transition hover:text-white/75"
            >
              <Plus size={10} />Add ingredient
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-end gap-3">
            <label className="block">
              <span className="font-mono text-[8px] uppercase tracking-[0.2em] text-white/30">Cooking method</span>
              <ReserveSelect
                srLabel="Cooking method"
                value={draft.method}
                /* The note becomes a hint line rather than being em-dashed onto
                   the label — a native <option> had nowhere else to put it. */
                options={COOKING_METHODS.map((m) => ({ value: m.value, label: m.label, hint: m.note }))}
                onChange={(v) => patchDraft({ method: v as CookingMethod })}
              />
            </label>
            <label className="block">
              <span className="font-mono text-[8px] uppercase tracking-[0.2em] text-white/30">Servings</span>
              <input
                value={draft.servings}
                onChange={(e) => patchDraft({ servings: Math.max(1, Math.min(12, Number(e.target.value) || 1)) })}
                inputMode="numeric"
                className={`mt-1.5 w-20 ${inputCls} text-center`}
              />
            </label>
          </div>

          {/* Live estimate */}
          <div className="mt-4 rounded-xl px-3.5 py-3" style={{ borderColor: `${GREEN}24`, background: `${GREEN}06` }}>
            <p className="font-mono text-[8px] uppercase tracking-[0.2em]" style={{ color: `${GREEN}cc` }}>Estimated · per serving</p>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
              <span className="text-[13px] font-bold text-[#f2eee6]">{estimate.perServing.calories} kcal</span>
              <span className="text-[13px] font-bold" style={{ color: GREEN }}>{estimate.perServing.proteinG}g protein</span>
              <span className="text-[13px] font-semibold text-white/60">{estimate.perServing.carbsG}g carbs</span>
              <span className="text-[13px] font-semibold text-white/60">{estimate.perServing.fatG}g fat</span>
            </div>
            {estimate.unmatched.length > 0 && (
              <p className="mt-2 text-[10.5px] leading-4" style={{ color: `${RED}cc` }}>
                Not recognized (excluded from the estimate): {estimate.unmatched.join(", ")}
              </p>
            )}
            <p className="mt-2 text-[9.5px] leading-4 text-white/28">
              {estimate.methodNote} · Typical-value estimates from your ingredient list — not a lab measurement, not medical advice.
            </p>
          </div>

          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            onClick={saveDraft}
            disabled={!draft.name.trim() || estimate.ingredients.length === 0}
            className="mt-4 rounded-xl px-5 py-2.5 font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-black transition disabled:cursor-not-allowed disabled:opacity-30"
            style={{ background: `linear-gradient(160deg, ${AMBER}, ${GOLD})` }}
          >
            Save Meal
          </motion.button>
        </div>
      )}

      {/* Saved meals */}
      {customMeals.length === 0 && !builderOpen ? (
        <div className="mt-4 px-6 py-6 text-center">
          <p className="text-[13px] font-bold text-[#f2eee6]">No custom meals yet</p>
          <p className="mx-auto mt-1.5 max-w-md text-[11.5px] leading-[1.5] text-white/40">
            Log the meals you actually cook — ground beef and jasmine rice counts. Reserve estimates the protein for you.
          </p>
        </div>
      ) : (
        customMeals.length > 0 && (
          <div className="mt-4 divide-y divide-white/[0.05]">
            {[...favorites, ...rest].map((meal) => (
              <div key={meal.id} className="flex flex-wrap items-center gap-2 py-2.5">
                <button
                  type="button"
                  onClick={() => toggleCustomMealFavorite(meal.id)}
                  className="flex-shrink-0"
                  aria-label={meal.favorite ? "Unfavorite" : "Favorite"}
                >
                  <Star size={14} style={{ color: meal.favorite ? GOLD : "rgba(255,255,255,0.2)", fill: meal.favorite ? GOLD : "none" }} />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-bold text-[#f2eee6]">{meal.name}</p>
                  <p className="mt-0.5 font-mono text-[8px] uppercase tracking-[0.14em] text-white/32">
                    est. {meal.est.calories} kcal · <span style={{ color: `${GREEN}cc` }}>{meal.est.proteinG}g protein</span> · {meal.ingredients.length} ingredients
                  </p>
                </div>
                {justLoggedId === meal.id ? (
                  <span className="inline-flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.16em]" style={{ color: GREEN }}>
                    <CheckCircle2 size={12} />Logged
                  </span>
                ) : (
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.96 }}
                    onClick={() => logMeal(meal)}
                    className="rounded-xl border px-3 py-1.5 font-mono text-[8px] uppercase tracking-[0.16em]"
                    style={{ borderColor: `${GREEN}38`, background: `${GREEN}0e`, color: GREEN }}
                  >
                    Log Eaten
                  </motion.button>
                )}
                {confirmDeleteId === meal.id ? (
                  <button type="button" onClick={() => { deleteCustomMeal(meal.id); setConfirmDeleteId(null); }} className="rounded-xl border px-2.5 py-1.5 font-mono text-[8px] uppercase tracking-[0.14em]" style={{ borderColor: `${RED}45`, background: `${RED}14`, color: RED }}>
                    Confirm
                  </button>
                ) : (
                  <button type="button" onClick={() => setConfirmDeleteId(meal.id)} className="rounded-lg border border-white/[0.07] p-1.5 text-white/25 transition hover:text-[#ef7d55]" aria-label="Delete meal">
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )
      )}
    </GlassPanel>
  );
}
