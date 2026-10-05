"use client";

import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { ReserveBottomSheet, ReserveButton, ReserveSelect } from "@/components/ui/reserve";
import { SLOT_LABEL, type MealSlot } from "@/lib/nutrition/fuel-plan";
import {
  BOWL_GRAMS_MAX,
  BOWL_STARTERS,
  BOWL_NAME_MAX,
  BOWL_PROBLEM_TEXT,
  bowlProblem,
  newBowlId,
  type BowlIngredient,
  type CustomBowl,
} from "@/lib/nutrition/peak-bowls";
import { PEAK_FOODS, type PeakFood } from "@/lib/nutrition/peak-signatures";
import { RESERVE, alpha } from "@/lib/design/tokens";

const FOODS = (Object.keys(PEAK_FOODS) as PeakFood[]).sort((a, b) => a.localeCompare(b));
const SLOTS: MealSlot[] = ["breakfast", "pre-workout", "post-workout", "lunch", "dinner", "snack"];

const INPUT =
  "min-h-[44px] w-full rounded-[12px] border border-white/[0.1] bg-black/30 px-3 text-[16px] text-[#f2eee6] outline-none placeholder:text-white/25 focus:border-white/30 sm:text-[13px]";

/** Calories and macros for what is in the bowl right now, at the weights entered. */
function totals(ingredients: BowlIngredient[]) {
  return ingredients.reduce(
    (sum, i) => {
      const f = PEAK_FOODS[i.food];
      const g = Number.isFinite(i.grams) ? i.grams : 0;
      return {
        calories: sum.calories + (f.kcal * g) / 100,
        proteinG: sum.proteinG + (f.p * g) / 100,
        carbsG: sum.carbsG + (f.c * g) / 100,
        fatG: sum.fatG + (f.f * g) / 100,
      };
    },
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );
}

/**
 * BUILD YOUR OWN BOWL — the meal a member already eats, in their ingredients
 * and their weights. Reserve scales it to the meal's targets like any plate
 * and never rewrites what is in it.
 */
export function BowlBuilder({ open, onClose, onSave }: { open: boolean; onClose: () => void; onSave: (bowl: CustomBowl) => void }) {
  return (
    <ReserveBottomSheet open={open} onClose={onClose} title="Build a meal" accent={RESERVE.gold}>
      {open && <BowlForm onClose={onClose} onSave={onSave} />}
    </ReserveBottomSheet>
  );
}

function BowlForm({ onClose, onSave }: { onClose: () => void; onSave: (bowl: CustomBowl) => void }) {
  const [name, setName] = useState("");
  const [slot, setSlot] = useState<MealSlot>("breakfast");
  const [ingredients, setIngredients] = useState<BowlIngredient[]>(BOWL_STARTERS.breakfast);
  const [edited, setEdited] = useState(false);
  const [touched, setTouched] = useState(false);

  /* Picking the meal reshapes an untouched starting point — a lunch opens as a
     plate rather than a bowl — and never overwrites rows the member set. */
  const pickSlot = (next: MealSlot) => {
    setSlot(next);
    if (!edited) setIngredients(BOWL_STARTERS[next]);
  };

  const problem = bowlProblem({ name, ingredients });
  const macros = useMemo(() => totals(ingredients), [ingredients]);

  const setRow = (index: number, patch: Partial<BowlIngredient>) => {
    setEdited(true);
    setIngredients((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const add = () => {
    const next = FOODS.find((f) => !ingredients.some((i) => i.food === f));
    if (!next) return;
    setEdited(true);
    setIngredients((rows) => [...rows, { food: next, grams: 50 }]);
  };

  return (
    <form
      className="flex flex-col gap-4"
      data-bowl-builder
      onSubmit={(e) => {
        e.preventDefault();
        setTouched(true);
        if (problem) return;
        onSave({ id: newBowlId(), name: name.trim().slice(0, BOWL_NAME_MAX), slot, ingredients, createdAt: new Date().toISOString() });
        onClose();
      }}
    >
      <p className="text-[12.5px] leading-[1.55] text-white/60">
        The meal you already eat — a lunch, a bowl, anything. Pick the meal it stands in for, then your ingredients from Reserve&apos;s food list. Reserve scales the weights to that meal&apos;s targets, writes the steps, and leaves your ingredients alone.
      </p>

      <label className="block">
        <span className="text-[11.5px] text-white/55">Name it</span>
        <input
          className={`mt-1 ${INPUT}`}
          value={name}
          maxLength={BOWL_NAME_MAX}
          placeholder="Chicken, rice and broccoli"
          onChange={(e) => setName(e.target.value)}
        />
      </label>

      <label className="block">
        <span className="text-[11.5px] text-white/55">Which meal it stands in for</span>
        <div className="mt-1">
          <ReserveSelect
            srLabel="Meal"
            value={slot}
            options={SLOTS.map((s) => ({ value: s, label: SLOT_LABEL[s] }))}
            onChange={(v) => pickSlot(v as MealSlot)}
          />
        </div>
      </label>

      <div>
        <p className="text-[11.5px] text-white/55">What goes in it</p>
        <ul className="mt-1 flex flex-col gap-2">
          {ingredients.map((row, index) => (
            <li key={`${row.food}-${index}`} className="flex items-end gap-2" data-bowl-row>
              <div className="min-w-0 flex-1">
                <ReserveSelect
                  srLabel={`Ingredient ${index + 1}`}
                  value={row.food}
                  options={FOODS.map((f) => ({ value: f, label: f.replace(" (dry)", "") }))}
                  onChange={(v) => setRow(index, { food: v as PeakFood })}
                />
              </div>
              <label className="shrink-0">
                <span className="sr-only">Grams for ingredient {index + 1}</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={BOWL_GRAMS_MAX}
                  value={Number.isFinite(row.grams) ? row.grams : ""}
                  onChange={(e) => setRow(index, { grams: Number(e.target.value) })}
                  className={`w-[84px] text-center ${INPUT}`}
                />
              </label>
              <ReserveButton
                tier="quiet"
                size="sm"
                icon={Trash2}
                onClick={() => {
                  setEdited(true);
                  setIngredients((rows) => rows.filter((_, i) => i !== index));
                }}
              >
                <span className="sr-only">Remove {row.food}</span>
              </ReserveButton>
            </li>
          ))}
        </ul>
        <div className="mt-2">
          <ReserveButton tier="quiet" size="sm" icon={Plus} onClick={add}>
            Add ingredient
          </ReserveButton>
        </div>
      </div>

      <p className="tnum text-[12px] text-white/55" data-bowl-macros>
        As entered: {Math.round(macros.calories)} kcal · {Math.round(macros.proteinG)}P {Math.round(macros.carbsG)}C {Math.round(macros.fatG)}F
      </p>

      {touched && problem && (
        <p role="alert" className="text-[12.5px]" style={{ color: RESERVE.red }}>{BOWL_PROBLEM_TEXT[problem]}</p>
      )}

      <div className="flex flex-wrap gap-2">
        <ReserveButton tier="primary" type="submit">Save bowl</ReserveButton>
        <ReserveButton tier="quiet" onClick={onClose}>Cancel</ReserveButton>
      </div>
    </form>
  );
}

/** The member's saved bowls, with the slot each one stands in for. */
export function YourBowls({ bowls, onBuild, onRemove }: { bowls: readonly CustomBowl[]; onBuild: () => void; onRemove: (id: string) => void }) {
  return (
    <section aria-label="Your meals" className="mt-4 border-t border-white/[0.06] pt-3" data-peak-bowls>
      <p className="type-whisper" style={{ color: alpha(RESERVE.gold, 0.9) }}>Your meals</p>
      <p className="mt-1 text-[11.5px] leading-[1.5] text-white/45">
        {bowls.length === 0
          ? "Build the lunch, bowl or plate you already eat, and it joins the options for that meal — with its own recipe and a line on why each item is there."
          : "Yours are offered first for the meal they stand in for, and you can swap one in on any day."}
      </p>
      {bowls.length > 0 && (
        <ul className="mt-2 flex flex-col divide-y divide-white/[0.05]">
          {bowls.map((bowl) => (
            <li key={bowl.id} className="flex items-center gap-3 py-2" data-peak-bowl={bowl.id}>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-semibold" style={{ color: RESERVE.ivory }}>{bowl.name}</span>
                <span className="block text-[11.5px] text-white/45">
                  {SLOT_LABEL[bowl.slot]} · {bowl.ingredients.map((i) => i.food.replace(" (dry)", "")).join(", ")}
                </span>
              </span>
              <ReserveButton tier="quiet" size="sm" onClick={() => onRemove(bowl.id)}>
                Remove<span className="sr-only"> {bowl.name}</span>
              </ReserveButton>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2">
        <ReserveButton tier="secondary" size="sm" icon={Plus} onClick={onBuild}>
          Build a meal
        </ReserveButton>
      </div>
    </section>
  );
}
