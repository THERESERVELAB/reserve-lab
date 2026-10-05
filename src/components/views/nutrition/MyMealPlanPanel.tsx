"use client";

import { motion } from "framer-motion";
import { ClipboardList, Pencil, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";

import { GlassPanel } from "@/components/ui/GlassPanel";
import { useAthleteDashboardStore } from "@/lib/athlete-store";
import { canAccessView } from "@/lib/apex/source-to-view";
import { mealPlanFromPreset, MEAL_PLAN_PRESETS, type MealPlanPreset } from "@/lib/nutrition/meal-plan-presets";
import { useTodayFuelPlan } from "@/lib/nutrition/useTodayFuelPlan";
import {
  emptyMemberMealPlan,
  planDayTotals,
  planMealsFor,
  WEIGH_IN_LABEL,
  type MemberMealPlan,
} from "@/lib/nutrition/member-meal-plan";

import { MealPlanEditor } from "./MealPlanEditor";

/* ════════════════════════════════════════════════════════════════════════
   MY MEAL PLAN — the member's own plan, running instead of the generated one.

   While a plan is active, Nutrition, the Apex fuel lane, the Schedule hero
   and meal logging all read it: the meals the member wrote, at the times
   their schedule gives, with the day's target set by the plan's own totals.

   Loading a preset copies food only. Supplements are never loaded, never
   auto-added, and never carry an amount from Reserve — a member adds those
   themselves in Support Stack, in their own words.
   ════════════════════════════════════════════════════════════════════════ */

const GOLD = "#d5b15f";
const GREEN = "#79e3b5";
const AMBER = "#e8c87a";
const RED = "#ef7d55";

function DayLine({ plan, training }: { plan: MemberMealPlan; training: boolean }) {
  const meals = planMealsFor(plan, training);
  if (meals.length === 0) {
    return (
      <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-white/25">
        {training ? "Training" : "Rest"} day · not written yet
      </p>
    );
  }
  const t = planDayTotals(meals);
  return (
    <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-white/32">
      {training ? "Training" : "Rest"} day · {meals.length} meals · est. {Math.round(t.calories)} kcal ·{" "}
      <span style={{ color: `${GREEN}cc` }}>{Math.round(t.proteinG)}g protein</span>
    </p>
  );
}

export function MyMealPlanPanel() {
  const plans = useAthleteDashboardStore((s) => s.memberMealPlans);
  const activeId = useAthleteDashboardStore((s) => s.activeMemberMealPlanId);
  const savePlan = useAthleteDashboardStore((s) => s.saveMemberMealPlan);
  const deletePlan = useAthleteDashboardStore((s) => s.deleteMemberMealPlan);
  const setActivePlan = useAthleteDashboardStore((s) => s.setActiveMemberMealPlan);
  const updateRecoveryTargets = useAthleteDashboardStore((s) => s.updateRecoveryTargets);
  const setActiveView = useAthleteDashboardStore((s) => s.setActiveView);
  const tier = useAthleteDashboardStore((s) => s.subscriptionTier);

  const [editing, setEditing] = useState<MemberMealPlan | null>(null);
  const [presetOpen, setPresetOpen] = useState<MealPlanPreset | null>(null);
  const [applyWater, setApplyWater] = useState(true);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const canOpenSupport = canAccessView(tier, "supplements");
  const { planUnwrittenDay } = useTodayFuelPlan();

  function loadPreset(preset: MealPlanPreset) {
    const plan = mealPlanFromPreset(preset);
    savePlan(plan);
    setActivePlan(plan.id);
    if (applyWater && preset.waterTargetOz) updateRecoveryTargets({ hydrationTargetOz: preset.waterTargetOz });
    setPresetOpen(null);
  }

  return (
    <GlassPanel accent={AMBER}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ClipboardList size={13} style={{ color: AMBER }} />
            <p className="font-mono text-[9px] uppercase tracking-[0.26em]" style={{ color: `${AMBER}cc` }}>Your Plan · My Meal Plan</p>
          </div>
          <p className="mt-1.5 max-w-xl text-[11.5px] leading-[1.55] text-white/45">
            Write the plan you actually eat — a training-day set and a rest-day set, with the amounts on each item. While a
            plan is running it replaces the generated meals everywhere. Macros are estimates from your own amounts.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* One preset opens straight away; more than one has to be chosen,
              or every preset after the first is unreachable. */}
          {MEAL_PLAN_PRESETS.map((preset) => (
            <button
              key={preset.key}
              type="button"
              onClick={() => { setApplyWater(true); setPresetOpen(preset); }}
              className="rounded-xl border border-white/[0.08] px-3.5 py-2 font-mono text-[9px] uppercase tracking-[0.16em] text-white/55 transition hover:text-white/85"
            >
              {MEAL_PLAN_PRESETS.length === 1 ? "Start from a preset" : preset.name}
            </button>
          ))}
          <motion.button
            type="button"
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setEditing(emptyMemberMealPlan(""))}
            className="inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 font-mono text-[9px] uppercase tracking-[0.18em]"
            style={{ borderColor: `${GOLD}40`, background: `${GOLD}12`, color: GOLD }}
          >
            <Plus size={12} />New Plan
          </motion.button>
        </div>
      </div>

      {/* Preset */}
      {presetOpen && (
        <div className="mt-4 rounded-2xl bg-black/20 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[13px] font-bold text-[#f2eee6]">{presetOpen.name}</p>
              <p className="mt-1 max-w-xl text-[11.5px] leading-[1.5] text-white/45">{presetOpen.summary}</p>
            </div>
            <button
              type="button"
              onClick={() => setPresetOpen(null)}
              className="rounded-lg border border-white/[0.07] p-1.5 text-white/25 transition hover:text-white/60"
              aria-label="Close preset"
            >
              <X size={11} />
            </button>
          </div>

          <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
            {([["Training day", presetOpen.trainingDay], ["Rest day", presetOpen.restDay]] as const).map(([label, meals]) => (
              <div key={label} className="rounded-xl border border-white/[0.06] p-3">
                <p className="font-mono text-[8px] uppercase tracking-[0.2em] text-white/30">{label}</p>
                <ul className="mt-2 grid gap-1">
                  {meals.map((m) => (
                    <li key={m.name} className="text-[11px] leading-[1.45] text-white/55">
                      <span className="text-[#f2eee6]">{m.name}</span> · {m.items.map((i) => `${i[1]} ${i[0]}`).join(", ")}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {presetOpen.waterTargetOz && (
            <label className="mt-3 flex cursor-pointer items-start gap-2.5">
              <input
                type="checkbox"
                checked={applyWater}
                onChange={(e) => setApplyWater(e.target.checked)}
                className="mt-0.5 h-3.5 w-3.5 accent-[#d5b15f]"
              />
              <span className="text-[11.5px] leading-[1.5] text-white/55">
                Also set my water target to {presetOpen.waterTargetOz} oz. <span className="text-white/35">{presetOpen.waterNote}</span>
              </span>
            </label>
          )}

          <p className="mt-3 text-[11px] leading-[1.5] text-white/35">
            This loads food only. Supplements are yours to add — nothing is added to your stack, and nothing here carries an
            amount from Reserve.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={() => loadPreset(presetOpen)}
              className="rounded-xl px-5 py-2.5 font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-black"
              style={{ background: `linear-gradient(160deg, ${AMBER}, ${GOLD})` }}
            >
              Load &amp; Run This Plan
            </motion.button>
            <button
              type="button"
              disabled={!canOpenSupport}
              title={canOpenSupport ? undefined : "Support Stack opens with Reserve Black"}
              onClick={() => setActiveView("supplements")}
              className="rounded-xl border border-white/[0.08] px-4 py-2.5 font-mono text-[9px] uppercase tracking-[0.16em] text-white/50 transition hover:text-white/80 disabled:cursor-not-allowed disabled:opacity-35"
            >
              {canOpenSupport ? "Open Support Stack" : "Support Stack · Reserve Black"}
            </button>
          </div>
        </div>
      )}

      {/* Editor */}
      {editing && (
        <MealPlanEditor
          plan={editing}
          onCancel={() => setEditing(null)}
          onSave={(plan) => { savePlan(plan); setEditing(null); }}
        />
      )}

      {/* Plans */}
      {plans.length === 0 && !editing && !presetOpen ? (
        <div className="mt-4 px-6 py-6 text-center">
          <p className="text-[13px] font-bold text-[#f2eee6]">No plan of your own yet</p>
          <p className="mx-auto mt-1.5 max-w-md text-[11.5px] leading-[1.5] text-white/40">
            Reserve is generating your meals. Write your own plan and it runs instead — the same meals, every day, at the
            times your schedule already knows.
          </p>
        </div>
      ) : (
        plans.length > 0 && (
          <div className="mt-4 divide-y divide-white/[0.05]">
            {plans.map((plan) => {
              const active = plan.id === activeId;
              return (
                <div key={plan.id} className="flex flex-wrap items-center gap-2 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-[13px] font-bold text-[#f2eee6]">{plan.name}</p>
                      {active && (
                        planUnwrittenDay ? (
                          <span className="rounded-full px-2 py-0.5 font-mono text-[8px] uppercase tracking-[0.16em]" style={{ background: `${AMBER}16`, color: AMBER }}>
                            Not today
                          </span>
                        ) : (
                          <span className="rounded-full px-2 py-0.5 font-mono text-[8px] uppercase tracking-[0.16em]" style={{ background: `${GREEN}16`, color: GREEN }}>
                            Running
                          </span>
                        )
                      )}
                      <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-white/25">{WEIGH_IN_LABEL[plan.weighIn]}</span>
                    </div>
                    <div className="mt-1 grid gap-0.5">
                      <DayLine plan={plan} training />
                      <DayLine plan={plan} training={false} />
                    </div>
                  </div>
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.96 }}
                    onClick={() => setActivePlan(active ? null : plan.id)}
                    className="rounded-xl border px-3 py-1.5 font-mono text-[8px] uppercase tracking-[0.16em]"
                    style={active
                      ? { borderColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)" }
                      : { borderColor: `${GREEN}38`, background: `${GREEN}0e`, color: GREEN }}
                  >
                    {active ? "Stop Running" : "Run This Plan"}
                  </motion.button>
                  <button
                    type="button"
                    onClick={() => setEditing(plan)}
                    className="rounded-lg border border-white/[0.07] p-1.5 text-white/25 transition hover:text-white/70"
                    aria-label={`Edit ${plan.name}`}
                  >
                    <Pencil size={12} />
                  </button>
                  {confirmDeleteId === plan.id ? (
                    <button
                      type="button"
                      onClick={() => { deletePlan(plan.id); setConfirmDeleteId(null); }}
                      className="rounded-xl border px-2.5 py-1.5 font-mono text-[8px] uppercase tracking-[0.14em]"
                      style={{ borderColor: `${RED}45`, background: `${RED}14`, color: RED }}
                    >
                      Confirm
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(plan.id)}
                      className="rounded-lg border border-white/[0.07] p-1.5 text-white/25 transition hover:text-[#ef7d55]"
                      aria-label={`Delete ${plan.name}`}
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}

      {activeId && (
        planUnwrittenDay ? (
          <p className="mt-3 text-[10.5px] leading-4" style={{ color: `${AMBER}bb` }}>
            Your plan has no {planUnwrittenDay} day written, so Reserve is generating today&apos;s meals instead. Add meals to
            the {planUnwrittenDay} day and your plan carries it.
          </p>
        ) : (
          <p className="mt-3 text-[10.5px] leading-4 text-white/28">
            Your plan is running, so Reserve is not generating meals or adding snacks. Stop it any time and the generated plan
            comes back.
          </p>
        )
      )}
    </GlassPanel>
  );
}
