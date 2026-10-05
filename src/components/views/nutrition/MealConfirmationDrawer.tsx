"use client";

import { motion } from "framer-motion";
import {
  AlertTriangle, ArrowRight, Check, ChevronDown, Clock, Dumbbell,
  Heart, Leaf, RotateCcw, Sparkles, Target, Utensils, X,
} from "lucide-react";
import { useMemo, useState } from "react";

import { DiscardChangesBar, useDirtySnapshot, useFormCloseGuard } from "@/components/ui/reserve/FormCloseGuard";

import type { GoalKey, Meal, MealPlan } from "@/lib/nutrition/types";
import type { MemberScheduleProfile } from "@/lib/schedule/types";
import {
  buildMealMacroImpact, buildMealSmartBrief, buildMealSlotOptions, buildNutritionSystemUpdate,
  classifyMealScheduleFit, getIngredientInsights, minutesToClockLabel, slotLabelForPurpose,
  type LoggedMealEvent, type MealScheduleFit,
} from "@/lib/nutrition/meal-confirmation";

const GOLD = "#d5b15f";
const GOLD_BRIGHT = "#e8c87a";
const STEEL = "#5fb7d5";
const TEAL = "#6ee7b7";
const AMBER = "#e8c87a";
const ORANGE = "#ef7d55";
const VIOLET = "#a78bfa";
const SOFT = "#f2eee6";

const FIT_TONE: Record<MealScheduleFit["tone"], string> = { good: TEAL, watch: AMBER, bad: ORANGE };

function pad(n: number) { return String(n).padStart(2, "0"); }
function minutesToInput(mins: number) { const m = ((mins % 1440) + 1440) % 1440; return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`; }
function inputToMinutes(v: string) { const [h, m] = v.split(":").map((x) => parseInt(x, 10)); return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0); }

export function MealConfirmationDrawer({
  target, plan, schedule, goal, trainingComplete, loggedIds, nowMinutes,
  onConfirm, onUndo, onClose, onPickMeal,
}: {
  target: Meal;
  plan: MealPlan;
  schedule: MemberScheduleProfile;
  goal: GoalKey;
  trainingComplete: boolean;
  loggedIds: string[];
  nowMinutes: number;
  onConfirm: (event: LoggedMealEvent) => void;
  onUndo: () => void;
  onClose: () => void;
  onPickMeal: (mealId: string) => void;
}) {
  const [actualMinutes, setActualMinutes] = useState<number>(nowMinutes);
  const [showPicker, setShowPicker] = useState(false);
  const [phase, setPhase] = useState<"confirm" | "logged">("confirm");
  /* Escape, X and Cancel close the drawer, like every other Reserve sheet —
     but a changed log time asks first, and an outside click keeps it. */
  const timeChanged = useDirtySnapshot(actualMinutes);
  const guard = useFormCloseGuard(phase === "confirm" && timeChanged, onClose, { backdropClosesWhenClean: true });
  // Frozen at confirm time so the post-log brief never recomputes off the
  // mutated plan (which would double-count the just-logged meal).
  const [snapshot, setSnapshot] = useState<{ impact: ReturnType<typeof buildMealMacroImpact>; brief: ReturnType<typeof buildMealSmartBrief>; systemUpdate: ReturnType<typeof buildNutritionSystemUpdate> } | null>(null);

  const liveImpact = useMemo(() => buildMealMacroImpact(plan, target), [plan, target]);
  const fit = useMemo(
    () => classifyMealScheduleFit({ purpose: target.purpose, plannedMinutes: target.timeMinutes, actualMinutes, schedule, trainingComplete }),
    [target.purpose, target.timeMinutes, actualMinutes, schedule, trainingComplete],
  );
  const ingredientInsights = useMemo(() => getIngredientInsights(target.foods), [target.foods]);
  const liveBrief = useMemo(() => buildMealSmartBrief({ meal: target, goal, impact: liveImpact, fit, ingredientInsights }), [target, goal, liveImpact, fit, ingredientInsights]);
  const slotOptions = useMemo(() => buildMealSlotOptions(plan, loggedIds), [plan, loggedIds]);

  // Confirm phase reads live values; logged phase reads the frozen snapshot.
  const impact = phase === "logged" && snapshot ? snapshot.impact : liveImpact;
  const brief = phase === "logged" && snapshot ? snapshot.brief : liveBrief;
  const systemUpdate = snapshot?.systemUpdate ?? buildNutritionSystemUpdate(liveImpact, liveBrief);

  const slotLabel = slotLabelForPurpose(target.purpose);
  const fitColor = FIT_TONE[fit.tone];

  function confirm() {
    const event: LoggedMealEvent = {
      mealId: target.id,
      mealName: liveBrief.mealName,
      slotLabel,
      plannedTime: target.timeWindow,
      actualTime: minutesToClockLabel(actualMinutes),
      scheduleFitState: fit.state,
      mealMacros: liveImpact.meal,
      proteinPctAfter: liveImpact.proteinPctAfter,
      onTrack: liveBrief.onTrack,
      nextAction: liveBrief.nextAction,
      timestamp: Date.now(),
    };
    setSnapshot({ impact: liveImpact, brief: liveBrief, systemUpdate: buildNutritionSystemUpdate(liveImpact, liveBrief) });
    onConfirm(event);
    setPhase("logged");
  }

  const onTrackColor = brief.onTrack === "complete" ? TEAL : brief.onTrack === "behind" ? AMBER : STEEL;

  return (
    <>
      {/* The scrim is deliberately NOT a presence-tracked animation.
          AnimatePresence unmounts a child only once EVERY animation inside it
          has finished, so a second animated element is a second thing that can
          stall. On a CPU-starved device this one did: the panel finished
          sliding out while the scrim sat at full opacity, and the whole
          overlay stayed in the DOM for tens of seconds — a dimmed, inert
          screen the member could not dismiss. It fades in with CSS instead,
          so the drawer's removal waits on the panel and nothing else. */}
      <div
        className="fba-scrim-in fixed inset-0 z-40 bg-black/55"
        onClick={() => guard.requestCloseFrom("backdrop")}
      />
      <motion.div
        role="dialog" aria-modal="true" aria-label="Meal confirmation"
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-white/[0.08]"
        style={{ background: "linear-gradient(180deg, #0e0f15 0%, #08090d 100%)" }}
        initial={{ x: "100%" }} animate={{ x: 0 }} transition={{ type: "tween", ease: [0.22, 1, 0.36, 1], duration: 0.32 }}
      >
        {/* Header. Full height on a phone: the header clears the status bar and
            each footer clears the home indicator. */}
        <div className="flex items-center justify-between border-b border-white/[0.07] px-5 pb-3.5 pt-[calc(0.875rem+env(safe-area-inset-top,0px))]">
          <div className="flex items-center gap-2">
            <Utensils size={13} style={{ color: GOLD }} />
            <p className="font-mono text-[8px] uppercase tracking-[0.24em]" style={{ color: `${GOLD}c0` }}>{phase === "confirm" ? "Confirm Meal Log" : "Live Fuel Brief"}</p>
          </div>
          <button type="button" onClick={guard.requestClose} aria-label="Close meal confirmation" className="-m-3 grid h-11 w-11 place-items-center text-white/40 transition hover:text-white/75"><X size={16} /></button>
        </div>
        <DiscardChangesBar guard={guard} />

        {phase === "confirm" ? (
          <>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {/* Meal + slot */}
              <p className="font-mono text-[7.5px] uppercase tracking-[0.2em] text-white/35">Log this meal?</p>
              <h3 className="font-display mt-1 text-[20px] font-bold leading-tight" style={{ color: SOFT }}>{brief.mealName}</h3>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="rounded-md border px-2 py-0.5 font-mono text-[7.5px] uppercase tracking-[0.14em]" style={{ borderColor: `${GOLD}40`, background: `${GOLD}10`, color: GOLD }}>{slotLabel}</span>
                <span className="rounded-md border px-2 py-0.5 font-mono text-[7.5px] uppercase tracking-[0.14em]" style={{ borderColor: `${fitColor}45`, background: `${fitColor}12`, color: fitColor }}>{fit.label}</span>
              </div>

              {/* Choose different meal */}
              <button type="button" onClick={() => setShowPicker((v) => !v)}
                className="mt-1 inline-flex min-h-[44px] items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.16em] text-white/45 transition hover:text-white/75">
                Choose a different meal <ChevronDown size={11} className={showPicker ? "rotate-180 transition" : "transition"} />
              </button>
              {showPicker && (
                <div className="mt-2 space-y-1.5 rounded-xl bg-white/[0.015] p-2">
                  {slotOptions.map((o) => (
                    <button key={o.mealId} type="button" onClick={() => { onPickMeal(o.mealId); setShowPicker(false); }}
                      className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left transition hover:bg-white/[0.04]"
                      style={o.mealId === target.id ? { background: `${GOLD}12` } : undefined}>
                      <div className="min-w-0">
                        <p className="truncate text-[11.5px] font-semibold" style={{ color: SOFT }}>{o.slotLabel}{o.bestFit && <span className="ml-1.5 font-mono text-[7px] uppercase tracking-[0.14em]" style={{ color: TEAL }}>Best fit</span>}</p>
                        <p className="text-[9.5px] text-white/40">{o.plannedTime} · {o.macros.proteinG}P · {o.macros.carbsG}C · {o.macros.fatG}F{o.logged ? " · logged" : ""}</p>
                      </div>
                      {o.mealId === target.id && <Check size={13} style={{ color: GOLD }} />}
                    </button>
                  ))}
                </div>
              )}

              {/* Times */}
              <div className="mt-2 grid grid-cols-2 gap-2.5">
                <div className="rounded-xl bg-white/[0.02] p-3">
                  <p className="font-mono text-[7px] uppercase tracking-[0.16em] text-white/40">Planned</p>
                  <p className="mt-1 text-[14px] font-bold" style={{ color: SOFT }}>{target.timeWindow}</p>
                </div>
                <label className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
                  <span className="flex items-center gap-1 font-mono text-[7px] uppercase tracking-[0.16em] text-white/40"><Clock size={9} /> Log Time</span>
                  <input type="time" value={minutesToInput(actualMinutes)} onChange={(e) => setActualMinutes(inputToMinutes(e.target.value))}
                    /* 16px on a phone: smaller type makes iOS zoom the page on focus. */
                    className="mt-1 min-h-[44px] w-full rounded-md border border-white/[0.08] bg-black/30 px-2 py-1 text-[16px] font-bold sm:min-h-0 sm:text-[13px] text-[#f2eee6] outline-none focus:border-white/[0.25]" />
                </label>
              </div>

              {/* Schedule fit warning */}
              {fit.warn && (
                <div className="mt-3 flex items-start gap-2 rounded-xl px-3 py-2.5" style={{ borderColor: `${fitColor}33`, background: `${fitColor}0c` }}>
                  <AlertTriangle size={13} className="mt-0.5 shrink-0" style={{ color: fitColor }} />
                  <p className="text-[10.5px] leading-[1.4] text-white/65">{fit.message}</p>
                </div>
              )}
              {!fit.warn && (
                <p className="mt-3 text-[10.5px] leading-[1.4] text-white/45">{fit.message}</p>
              )}

              {/* Macro impact: before → meal → after */}
              <p className="mt-5 font-mono text-[8px] uppercase tracking-[0.2em] text-white/35">Macro Impact</p>
              <div className="mt-2 overflow-hidden rounded-xl">
                <div className="grid grid-cols-[1.2fr_1fr_1fr_1fr] bg-white/[0.03] px-3 py-1.5 font-mono text-[7px] uppercase tracking-[0.12em] text-white/35">
                  <span></span><span className="text-right">Before</span><span className="text-right" style={{ color: GOLD }}>Meal</span><span className="text-right">After</span>
                </div>
                {([
                  { k: "Calories", b: impact.before.calories, m: impact.meal.calories, a: impact.after.calories, t: impact.targets.calories, u: "" },
                  { k: "Protein", b: impact.before.proteinG, m: impact.meal.proteinG, a: impact.after.proteinG, t: impact.targets.proteinG, u: "g" },
                  { k: "Carbs", b: impact.before.carbsG, m: impact.meal.carbsG, a: impact.after.carbsG, t: impact.targets.carbsG, u: "g" },
                  { k: "Fats", b: impact.before.fatG, m: impact.meal.fatG, a: impact.after.fatG, t: impact.targets.fatG, u: "g" },
                ]).map((r) => (
                  <div key={r.k} className="grid grid-cols-[1.2fr_1fr_1fr_1fr] items-center border-t border-white/[0.05] px-3 py-2 text-[11px] tabular-nums">
                    <span className="font-semibold text-white/70">{r.k}</span>
                    <span className="text-right text-white/45">{r.b.toLocaleString()}{r.u}</span>
                    <span className="text-right font-bold" style={{ color: GOLD_BRIGHT }}>+{r.m.toLocaleString()}{r.u}</span>
                    <span className="text-right font-bold" style={{ color: r.a > r.t ? ORANGE : SOFT }}>{r.a.toLocaleString()}<span className="text-white/30"> / {r.t.toLocaleString()}{r.u}</span></span>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {impact.statusLines.map((l) => (
                  <span key={l} className="rounded-md border border-white/[0.07] bg-white/[0.02] px-2 py-1 text-[9.5px] text-white/55">{l}</span>
                ))}
              </div>

              {/* Brief preview */}
              <p className="mt-5 font-mono text-[8px] uppercase tracking-[0.2em] text-white/35">Brief Preview</p>
              <p className="mt-1.5 text-[11.5px] leading-[1.45] text-white/60">{brief.whatItDid}</p>
            </div>

            {/* Footer (sticky) */}
            <div className="border-t border-white/[0.08] px-5 pb-[calc(0.875rem+env(safe-area-inset-bottom,0px))] pt-3.5">
              <button type="button" onClick={confirm}
                className="flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-[13px] font-bold uppercase tracking-[0.1em] text-black transition hover:brightness-110"
                style={{ background: GOLD }}>
                <Check size={15} /> Confirm Log Meal
              </button>
              <div className="mt-2 flex items-center gap-2">
                <button type="button" onClick={guard.requestClose} className="min-h-[44px] flex-1 rounded-xl border border-white/[0.12] bg-white/[0.02] px-4 py-2.5 font-mono text-[9px] uppercase tracking-[0.16em] text-white/55 transition hover:bg-white/[0.05]">Cancel</button>
                <button type="button" onClick={() => setActualMinutes(nowMinutes)} className="min-h-[44px] flex-1 rounded-xl border border-white/[0.12] bg-white/[0.02] px-4 py-2.5 font-mono text-[9px] uppercase tracking-[0.16em] text-white/55 transition hover:bg-white/[0.05]">Reset Time</button>
              </div>
              <p className="mt-2 text-center font-mono text-[7.5px] uppercase tracking-[0.14em] text-white/25">Nothing counts toward today until you confirm.</p>
            </div>
          </>
        ) : (
          /* ── PHASE: LOGGED — Live Fuel Brief ── */
          <>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <div className="flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ borderColor: `${TEAL}33`, background: `${TEAL}0c` }}>
                <Check size={14} style={{ color: TEAL }} />
                <p className="text-[11.5px] font-semibold" style={{ color: SOFT }}>Logged · {brief.mealName}</p>
              </div>

              <p className="mt-4 font-mono text-[7.5px] uppercase tracking-[0.2em] text-white/35">What it did</p>
              <p className="mt-1 text-[12px] leading-[1.45] text-white/65">{brief.whatItDid}</p>

              <div className="mt-3 flex items-center justify-between rounded-xl bg-white/[0.02] px-3.5 py-2.5">
                <span className="font-mono text-[8px] uppercase tracking-[0.16em] text-white/40">Macro Impact</span>
                <span className="font-mono text-[12px] font-bold" style={{ color: GOLD_BRIGHT }}>{brief.macroImpact}</span>
              </div>

              {[
                { icon: Dumbbell, label: "Training Support", text: brief.trainingSupport, color: GOLD },
                { icon: Heart, label: "Recovery Support", text: brief.recoverySupport, color: STEEL },
                { icon: Sparkles, label: "Physique Signal", text: brief.physiqueSignal, color: VIOLET },
              ].map((row) => {
                const Icon = row.icon;
                return (
                  <div key={row.label} className="mt-2 rounded-xl bg-white/[0.02] p-3">
                    <div className="flex items-center gap-1.5"><Icon size={11} style={{ color: row.color }} /><p className="font-mono text-[7.5px] uppercase tracking-[0.16em]" style={{ color: row.color }}>{row.label}</p></div>
                    <p className="mt-1 text-[11px] leading-[1.45] text-white/60">{row.text}</p>
                  </div>
                );
              })}

              {brief.ingredientInsights.length > 0 && (
                <>
                  <p className="mt-4 font-mono text-[7.5px] uppercase tracking-[0.2em] text-white/35">Ingredient Notes</p>
                  {brief.ingredientInsights.map((ins) => (
                    <div key={ins.name} className="mt-2 rounded-xl bg-white/[0.02] p-3">
                      <div className="flex items-center gap-1.5"><Leaf size={11} style={{ color: TEAL }} /><p className="text-[11px] font-bold" style={{ color: SOFT }}>{ins.name}</p></div>
                      <p className="mt-1 text-[10.5px] leading-[1.45] text-white/55">{ins.note}</p>
                    </div>
                  ))}
                </>
              )}

              {/* Next move + on-track */}
              <div className="mt-4 flex items-center gap-2 rounded-xl px-3.5 py-2.5" style={{ borderColor: `${GOLD}33`, background: `${GOLD}0a` }}>
                <Target size={13} style={{ color: GOLD }} />
                <div className="min-w-0">
                  <p className="font-mono text-[7.5px] uppercase tracking-[0.16em]" style={{ color: GOLD }}>Next Move</p>
                  <p className="text-[11.5px] font-semibold" style={{ color: SOFT }}>{brief.nextAction}</p>
                </div>
                <span className="ml-auto shrink-0 rounded-md border px-2 py-0.5 font-mono text-[7.5px] uppercase tracking-[0.12em]" style={{ borderColor: `${onTrackColor}45`, color: onTrackColor }}>{brief.onTrackLabel}</span>
              </div>

              {/* System update */}
              <p className="mt-4 font-mono text-[7.5px] uppercase tracking-[0.2em] text-white/35">System Update</p>
              <ul className="mt-1.5 space-y-1">
                {systemUpdate.lines.map((l) => (
                  <li key={l} className="flex items-center gap-2 text-[10.5px] text-white/55"><span className="h-1 w-1 rounded-full" style={{ background: TEAL }} />{l}</li>
                ))}
              </ul>
            </div>

            <div className="border-t border-white/[0.08] px-5 pb-[calc(0.875rem+env(safe-area-inset-bottom,0px))] pt-3.5">
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => { onUndo(); onClose(); }}
                  className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl border px-4 py-2.5 font-mono text-[9px] uppercase tracking-[0.16em] transition hover:brightness-110"
                  style={{ borderColor: `${ORANGE}40`, background: `${ORANGE}10`, color: ORANGE }}>
                  <RotateCcw size={12} /> Undo Log
                </button>
                <button type="button" onClick={onClose}
                  className="flex min-h-[44px] flex-[1.4] items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-[12px] font-bold uppercase tracking-[0.1em] text-black transition hover:brightness-110"
                  style={{ background: GOLD }}>
                  Done <ArrowRight size={13} />
                </button>
              </div>
            </div>
          </>
        )}
      </motion.div>
    </>
  );
}
