"use client";

import { ChevronDown, ChevronUp, Plus, X } from "lucide-react";
import { useMemo, useState } from "react";

import { ReserveSegmented, ReserveSelect } from "@/components/ui/reserve";
import { INGREDIENT_GROUP_LABEL, SLOT_LABEL, type IngredientGroup, type MealSlot } from "@/lib/nutrition/fuel-plan";
import {
  estimatePlanMeal,
  newPlanItemId,
  newPlanMealId,
  planDayTotals,
  WEIGH_IN_LABEL,
  type MemberMealPlan,
  type MemberPlanMeal,
  type PlanWeighIn,
} from "@/lib/nutrition/member-meal-plan";

/* ════════════════════════════════════════════════════════════════════════
   MEAL PLAN EDITOR — the member writes their own plan here.

   A training-day set and a rest-day set, each a list of meals, each meal a
   list of items with the amount written on it. Every estimate updates as
   they type, and an item Reserve cannot price says so rather than counting
   as nothing.
   ════════════════════════════════════════════════════════════════════════ */

const GOLD = "#d5b15f";
const GREEN = "#79e3b5";
const AMBER = "#e8c87a";
const RED = "#ef7d55";

const inputCls =
  "w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[13px] text-[#f2eee6] outline-none transition-colors focus:border-[#d5b15f]/40 placeholder:text-white/18";

const SLOT_OPTIONS: Array<{ value: MealSlot; label: string }> = (
  ["breakfast", "lunch", "pre-workout", "post-workout", "dinner", "snack"] as MealSlot[]
).map((s) => ({ value: s, label: SLOT_LABEL[s] }));

const GROUP_OPTIONS: Array<{ value: IngredientGroup; label: string }> = (
  ["protein", "carb", "produce", "fat", "finish"] as IngredientGroup[]
).map((g) => ({ value: g, label: INGREDIENT_GROUP_LABEL[g] }));

function newMeal(order: number): MemberPlanMeal {
  return {
    id: newPlanMealId(),
    name: `Meal ${order + 1}`,
    slot: "lunch",
    order,
    items: [{ id: newPlanItemId(), name: "", display: "", grams: null, group: "protein" }],
  };
}

function reorder(meals: MemberPlanMeal[]): MemberPlanMeal[] {
  return meals.map((m, i) => ({ ...m, order: i }));
}

export function MealPlanEditor({
  plan,
  onSave,
  onCancel,
}: {
  plan: MemberMealPlan;
  onSave: (plan: MemberMealPlan) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<MemberMealPlan>(plan);
  const [dayType, setDayType] = useState<"training" | "rest">("training");

  const isTraining = dayType === "training";
  const meals = isTraining ? draft.trainingDay : draft.restDay;

  function setMeals(next: MemberPlanMeal[]) {
    const ordered = reorder(next);
    setDraft((d) => (isTraining ? { ...d, trainingDay: ordered } : { ...d, restDay: ordered }));
  }
  function patchMeal(id: string, patch: Partial<MemberPlanMeal>) {
    setMeals(meals.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }

  const totals = useMemo(() => planDayTotals(meals), [meals]);
  const nameValid = draft.name.trim().length > 0;
  const hasAnyMeal = draft.trainingDay.length > 0 || draft.restDay.length > 0;

  return (
    <div className="mt-4 rounded-2xl bg-black/20 p-4">
      <div className="flex flex-wrap items-end gap-4">
        <label className="block min-w-[220px] flex-1">
          <span className="font-mono text-[8px] uppercase tracking-[0.2em] text-white/30">Plan name</span>
          <input
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            maxLength={60}
            placeholder="e.g. Five Meal Standard"
            className={`mt-1.5 ${inputCls}`}
          />
        </label>
        <label className="block">
          <span className="font-mono text-[8px] uppercase tracking-[0.2em] text-white/30">Amounts are</span>
          <div className="mt-1.5">
            <ReserveSelect<PlanWeighIn>
              srLabel="How the amounts on this plan were weighed"
              value={draft.weighIn}
              options={[
                { value: "cooked", label: WEIGH_IN_LABEL.cooked, hint: "How the estimates read" },
                { value: "raw", label: WEIGH_IN_LABEL.raw, hint: "Labels the plan — estimates unchanged" },
              ]}
              onChange={(weighIn) => setDraft((d) => ({ ...d, weighIn }))}
            />
          </div>
        </label>
      </div>
      <p className="mt-2 text-[10.5px] leading-4 text-white/30">
        This says how you weighed your food, so you know which number you are reading. Reserve does not convert one into the
        other — the estimates come from the amounts exactly as you enter them.
      </p>

      <div className="mt-4">
        <ReserveSegmented<"training" | "rest">
          label="Which day to edit"
          value={dayType}
          onChange={setDayType}
          segments={[
            { value: "training", label: `Training day · ${draft.trainingDay.length}` },
            { value: "rest", label: `Rest day · ${draft.restDay.length}` },
          ]}
        />
      </div>

      <div className="mt-4 grid gap-3">
        {meals.map((meal, index) => {
          const est = estimatePlanMeal(meal);
          const unpriced = [...est.unmatched, ...est.uncounted];
          return (
            <div key={meal.id} className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-3">
              <div className="flex flex-wrap items-end gap-2">
                <label className="block min-w-[130px] flex-1">
                  <span className="font-mono text-[8px] uppercase tracking-[0.2em] text-white/30">Meal</span>
                  <input
                    value={meal.name}
                    onChange={(e) => patchMeal(meal.id, { name: e.target.value })}
                    maxLength={40}
                    placeholder="Meal 1"
                    className={`mt-1.5 ${inputCls}`}
                  />
                </label>
                <label className="block min-w-[150px]">
                  <span className="font-mono text-[8px] uppercase tracking-[0.2em] text-white/30">When</span>
                  <div className="mt-1.5">
                    <ReserveSelect<MealSlot>
                      srLabel={`When ${meal.name || "this meal"} is eaten`}
                      value={meal.slot}
                      options={SLOT_OPTIONS}
                      onChange={(slot) => patchMeal(meal.id, { slot })}
                    />
                  </div>
                </label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={index === 0}
                    title={index === 0 ? "Already the first meal of the day" : "Move earlier"}
                    onClick={() => { const n = [...meals]; [n[index - 1], n[index]] = [n[index], n[index - 1]]; setMeals(n); }}
                    className="rounded-lg border border-white/[0.07] p-1.5 text-white/30 transition hover:text-white/70 disabled:cursor-not-allowed disabled:opacity-25"
                    aria-label={`Move ${meal.name || "meal"} earlier`}
                  >
                    <ChevronUp size={11} />
                  </button>
                  <button
                    type="button"
                    disabled={index === meals.length - 1}
                    title={index === meals.length - 1 ? "Already the last meal of the day" : "Move later"}
                    onClick={() => { const n = [...meals]; [n[index], n[index + 1]] = [n[index + 1], n[index]]; setMeals(n); }}
                    className="rounded-lg border border-white/[0.07] p-1.5 text-white/30 transition hover:text-white/70 disabled:cursor-not-allowed disabled:opacity-25"
                    aria-label={`Move ${meal.name || "meal"} later`}
                  >
                    <ChevronDown size={11} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setMeals(meals.filter((m) => m.id !== meal.id))}
                    className="rounded-lg border border-white/[0.07] p-1.5 text-white/25 transition hover:text-[#ef7d55]"
                    aria-label={`Remove ${meal.name || "meal"}`}
                  >
                    <X size={11} />
                  </button>
                </div>
              </div>

              <div className="mt-2.5 grid gap-2">
                {meal.items.map((item) => (
                  <div key={item.id} className="grid grid-cols-[minmax(0,1fr)_80px_74px_auto] items-center gap-2">
                    <input
                      value={item.name}
                      onChange={(e) => patchMeal(meal.id, { items: meal.items.map((x) => (x.id === item.id ? { ...x, name: e.target.value } : x)) })}
                      placeholder="e.g. 93/7 Ground Beef"
                      aria-label="Food"
                      className={inputCls}
                    />
                    <input
                      value={item.display}
                      onChange={(e) => patchMeal(meal.id, { items: meal.items.map((x) => (x.id === item.id ? { ...x, display: e.target.value } : x)) })}
                      placeholder="150g"
                      aria-label="Amount shown"
                      className={`${inputCls} text-center`}
                    />
                    <input
                      value={item.grams ?? ""}
                      onChange={(e) => patchMeal(meal.id, { items: meal.items.map((x) => (x.id === item.id ? { ...x, grams: e.target.value === "" ? null : Math.max(0, Number(e.target.value) || 0) } : x)) })}
                      placeholder="grams"
                      inputMode="numeric"
                      aria-label="Grams counted"
                      className={`${inputCls} text-center`}
                    />
                    <div className="flex items-center gap-1">
                      <div className="w-[104px]">
                        <ReserveSelect<IngredientGroup>
                          srLabel={`What ${item.name || "this food"} is`}
                          value={item.group}
                          options={GROUP_OPTIONS}
                          onChange={(group) => patchMeal(meal.id, { items: meal.items.map((x) => (x.id === item.id ? { ...x, group } : x)) })}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => patchMeal(meal.id, { items: meal.items.filter((x) => x.id !== item.id) })}
                        className="rounded-lg border border-white/[0.07] p-1.5 text-white/25 transition hover:text-[#ef7d55]"
                        aria-label={`Remove ${item.name || "food"}`}
                      >
                        <X size={11} />
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => patchMeal(meal.id, { items: [...meal.items, { id: newPlanItemId(), name: "", display: "", grams: null, group: "protein" }] })}
                  className="inline-flex w-fit items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-1.5 font-mono text-[8px] uppercase tracking-[0.16em] text-white/45 transition hover:text-white/75"
                >
                  <Plus size={10} />Add food
                </button>
              </div>

              <input
                value={meal.note ?? ""}
                onChange={(e) => patchMeal(meal.id, { note: e.target.value || undefined })}
                maxLength={120}
                placeholder="Note — e.g. an hour before training"
                aria-label={`Note for ${meal.name || "this meal"}`}
                className={`mt-2 ${inputCls}`}
              />

              <p className="mt-2 font-mono text-[8px] uppercase tracking-[0.14em] text-white/32">
                est. {est.macros.calories} kcal · <span style={{ color: `${GREEN}cc` }}>{est.macros.proteinG}g protein</span> · {est.macros.carbsG}g carbs · {est.macros.fatG}g fat
              </p>
              {unpriced.length > 0 && (
                <p className="mt-1 text-[10.5px] leading-4" style={{ color: `${RED}cc` }}>
                  No estimate for {unpriced.join(", ")} — left out of the numbers rather than counted as nothing.
                </p>
              )}
            </div>
          );
        })}

        <button
          type="button"
          onClick={() => setMeals([...meals, newMeal(meals.length)])}
          className="inline-flex w-fit items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3.5 py-2 font-mono text-[9px] uppercase tracking-[0.16em] text-white/50 transition hover:text-white/80"
        >
          <Plus size={11} />Add meal to {isTraining ? "training" : "rest"} day
        </button>
      </div>

      <div className="mt-4 rounded-xl px-3.5 py-3" style={{ background: `${GREEN}06` }}>
        <p className="font-mono text-[8px] uppercase tracking-[0.2em]" style={{ color: `${GREEN}cc` }}>
          {isTraining ? "Training" : "Rest"} day total · estimated
        </p>
        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
          <span className="text-[13px] font-bold text-[#f2eee6]">{Math.round(totals.calories)} kcal</span>
          <span className="text-[13px] font-bold" style={{ color: GREEN }}>{Math.round(totals.proteinG)}g protein</span>
          <span className="text-[13px] font-semibold text-white/60">{Math.round(totals.carbsG)}g carbs</span>
          <span className="text-[13px] font-semibold text-white/60">{Math.round(totals.fatG)}g fat</span>
        </div>
        <p className="mt-2 text-[9.5px] leading-4 text-white/28">
          Typical-value estimates from the amounts you entered, {WEIGH_IN_LABEL[draft.weighIn].toLowerCase()}. Not a lab
          measurement, not medical advice.
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onSave({ ...draft, name: draft.name.trim() })}
          disabled={!nameValid || !hasAnyMeal}
          title={!nameValid ? "Give the plan a name first" : !hasAnyMeal ? "Add at least one meal first" : undefined}
          className="rounded-xl px-5 py-2.5 font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-black transition disabled:cursor-not-allowed disabled:opacity-30"
          style={{ background: `linear-gradient(160deg, ${AMBER}, ${GOLD})` }}
        >
          Save Plan
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-white/[0.08] px-4 py-2.5 font-mono text-[9px] uppercase tracking-[0.16em] text-white/50 transition hover:text-white/80"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
