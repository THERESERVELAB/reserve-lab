"use client";

import { Minus, Plus } from "lucide-react";

import type { CompoundDoseAnchor, CompoundDoseTiming } from "@/lib/athlete-store";
import { RESERVE, alpha } from "@/lib/design/tokens";
import {
  DOSE_MEAL_SLOTS,
  MAX_DOSES_PER_DAY,
  MEAL_OFFSET_CHOICES,
  WINDOW_PREFIX,
  describeDose,
  type DoseAnchors,
} from "@/lib/enhancement/dose-timing";

/* ════════════════════════════════════════════════════════════════════════
   DOSE TIMING EDITOR — "When you take it", one row per dose.

   The member sets every part: how many times on a scheduled day (1–4), and
   for each, a clock time, a time relative to one of their meals, on waking,
   before bed, or before their training start. Each row shows where the rule lands today ("1 h before
   breakfast · 8:00 AM") from the member's own meal plan and schedule, so a
   moved meal moves the time. Nothing here suggests a timing, a count or an
   order; every choice is listed plainly and none is marked.
   ════════════════════════════════════════════════════════════════════════ */

const STEEL = RESERVE.steel;

export const DOSE_TIMING_COPY = {
  heading: "When you take it",
  perDay: "Times per scheduled day",
  dose: (n: number) => `Time ${n}`,
  anchors: { clock: "Clock time", meal: "Relative to a meal", wake: "On waking", bed: "Before bed", training: "Before training" } satisfies Record<CompoundDoseAnchor, string>,
  meal: "Meal",
  offset: "Offset",
  custom: "Other offset",
  minutes: "Minutes",
  before: "Before",
  after: "After",
  afterWaking: "Minutes after waking",
  beforeSleep: "Minutes before your sleep target",
  beforeTraining: "Minutes before your training start",
  time: "Time",
  follows: "Times set against a meal, waking, bed or training follow your schedule and meal plan. A time set before training shows only on days you train.",
} as const;

const ANCHORS: CompoundDoseAnchor[] = ["clock", "meal", "wake", "bed", "training"];

function Chip({ active, onClick, children, label }: { active: boolean; onClick: () => void; children: React.ReactNode; label?: string }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={label}
      onClick={onClick}
      className="min-h-[36px] rounded-lg border px-2.5 text-[11.5px] leading-none transition-colors"
      style={{
        borderColor: active ? alpha(STEEL, 0.55) : "rgba(255,255,255,0.08)",
        background: active ? alpha(STEEL, 0.12) : "rgba(255,255,255,0.022)",
        color: active ? "#e8f2fb" : "rgba(255,255,255,0.62)",
      }}
    >
      {children}
    </button>
  );
}

const INPUT = "w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[12px] text-[#f2eee6] outline-none focus:border-white/20";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-mono text-[7.5px] uppercase tracking-[0.22em] text-white/35">{label}</span>
      {children}
    </label>
  );
}

/** A fresh dose row: a clock time left for the member to set. Never a suggested time. */
function blankDose(): CompoundDoseTiming {
  return { anchor: "clock", time: "" };
}

export function DoseTimingEditor({
  doses,
  anchors,
  onChange,
}: {
  doses: CompoundDoseTiming[];
  anchors: DoseAnchors;
  onChange: (doses: CompoundDoseTiming[]) => void;
}) {
  const setCount = (n: number) => {
    const next = doses.slice(0, n);
    while (next.length < n) next.push(blankDose());
    onChange(next);
  };
  const setDose = (index: number, dose: CompoundDoseTiming) => onChange(doses.map((d, i) => (i === index ? dose : d)));
  /* Named meals on today's plan beyond breakfast / lunch / dinner, by the plan's own label. */
  const namedMeals = anchors.meals.filter((m) => !DOSE_MEAL_SLOTS.some((s) => s.value === m.slot));

  return (
    <div data-compound="dose-timing" className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-[7.5px] uppercase tracking-[0.22em] text-white/35">{DOSE_TIMING_COPY.perDay}</span>
        <div className="flex items-center gap-1.5" role="group" aria-label={DOSE_TIMING_COPY.perDay}>
          <button
            type="button"
            aria-label="One fewer time"
            disabled={doses.length <= 1}
            onClick={() => setCount(doses.length - 1)}
            className="grid h-9 w-9 place-items-center rounded-lg border border-white/[0.08] text-white/60 disabled:opacity-35"
          >
            <Minus size={13} aria-hidden="true" />
          </button>
          <span className="tnum w-6 text-center text-[14px] font-semibold text-[#f2eee6]" data-dose-count={doses.length}>{doses.length}</span>
          <button
            type="button"
            aria-label="One more time"
            disabled={doses.length >= MAX_DOSES_PER_DAY}
            onClick={() => setCount(doses.length + 1)}
            className="grid h-9 w-9 place-items-center rounded-lg border border-white/[0.08] text-white/60 disabled:opacity-35"
          >
            <Plus size={13} aria-hidden="true" />
          </button>
        </div>
      </div>

      <ol className="grid gap-3">
        {doses.map((dose, index) => {
          const offset = dose.offsetMin ?? 0;
          const preset = MEAL_OFFSET_CHOICES.some((c) => c.value === offset);
          return (
            <li key={index} data-dose-row={index + 1} className="grid gap-2 border-t border-white/[0.06] pt-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-mono text-[8px] uppercase tracking-[0.2em] text-white/50">{DOSE_TIMING_COPY.dose(index + 1)}</span>
                <span className="tnum text-[12px] text-white/70" data-dose-resolved>{describeDose(dose, anchors)}</span>
              </div>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label={`${DOSE_TIMING_COPY.dose(index + 1)} timing`}>
                {ANCHORS.map((anchor) => (
                  <Chip
                    key={anchor}
                    active={dose.anchor === anchor}
                    onClick={() =>
                      setDose(index, anchor === "clock" ? { anchor, time: dose.time ?? "" } : anchor === "meal" ? { anchor, meal: dose.meal, offsetMin: 0 } : { anchor, offsetMin: 0 })
                    }
                  >
                    {DOSE_TIMING_COPY.anchors[anchor]}
                  </Chip>
                ))}
              </div>

              {dose.anchor === "clock" && (
                <Field label={DOSE_TIMING_COPY.time}>
                  <input type="time" aria-label={`${DOSE_TIMING_COPY.dose(index + 1)} clock time`} value={dose.time ?? ""} onChange={(e) => setDose(index, { ...dose, time: e.target.value })} className={INPUT} />
                </Field>
              )}

              {dose.anchor === "meal" && (
                <>
                  <div className="flex flex-wrap gap-1.5" role="group" aria-label={`${DOSE_TIMING_COPY.dose(index + 1)} offset`}>
                    {MEAL_OFFSET_CHOICES.map((choice) => (
                      <Chip key={choice.value} active={offset === choice.value} onClick={() => setDose(index, { ...dose, offsetMin: choice.value })}>
                        {choice.label}
                      </Chip>
                    ))}
                    <Chip active={!preset} onClick={() => setDose(index, { ...dose, offsetMin: preset ? -15 : offset })}>
                      {DOSE_TIMING_COPY.custom}
                    </Chip>
                  </div>
                  {!preset && (
                    <div className="grid grid-cols-2 gap-2">
                      <Field label={DOSE_TIMING_COPY.minutes}>
                        <input
                          type="number"
                          min={1}
                          max={720}
                          value={Math.abs(offset)}
                          onChange={(e) => {
                            const m = Math.max(1, Math.min(720, Math.round(Number(e.target.value) || 1)));
                            setDose(index, { ...dose, offsetMin: offset < 0 ? -m : m });
                          }}
                          className={INPUT}
                        />
                      </Field>
                      <div className="flex items-end gap-1.5">
                        <Chip active={offset < 0} onClick={() => setDose(index, { ...dose, offsetMin: -Math.abs(offset) })}>{DOSE_TIMING_COPY.before}</Chip>
                        <Chip active={offset > 0} onClick={() => setDose(index, { ...dose, offsetMin: Math.abs(offset) })}>{DOSE_TIMING_COPY.after}</Chip>
                      </div>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-1.5" role="group" aria-label={`${DOSE_TIMING_COPY.dose(index + 1)} ${DOSE_TIMING_COPY.meal.toLowerCase()}`}>
                    {DOSE_MEAL_SLOTS.map((slot) => (
                      <Chip key={slot.value} active={dose.meal === slot.value} onClick={() => setDose(index, { ...dose, meal: slot.value })}>
                        {slot.label}
                      </Chip>
                    ))}
                    {namedMeals.map((meal) => (
                      <Chip key={meal.id} active={dose.meal === `${WINDOW_PREFIX}${meal.id}`} onClick={() => setDose(index, { ...dose, meal: `${WINDOW_PREFIX}${meal.id}` })}>
                        {meal.label}
                      </Chip>
                    ))}
                  </div>
                </>
              )}

              {(dose.anchor === "wake" || dose.anchor === "bed" || dose.anchor === "training") && (
                <Field label={dose.anchor === "wake" ? DOSE_TIMING_COPY.afterWaking : dose.anchor === "bed" ? DOSE_TIMING_COPY.beforeSleep : DOSE_TIMING_COPY.beforeTraining}>
                  <input
                    type="number"
                    min={0}
                    max={720}
                    value={offset}
                    onChange={(e) => setDose(index, { ...dose, offsetMin: Math.max(0, Math.min(720, Math.round(Number(e.target.value) || 0))) })}
                    className={INPUT}
                  />
                </Field>
              )}
            </li>
          );
        })}
      </ol>
      <p className="text-[10.5px] leading-[1.5] text-white/42">{DOSE_TIMING_COPY.follows}</p>
    </div>
  );
}
