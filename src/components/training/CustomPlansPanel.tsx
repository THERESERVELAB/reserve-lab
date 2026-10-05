"use client";

import { motion } from "framer-motion";
import { CheckCircle2, ChevronDown, ChevronUp, ClipboardList, Plus, Sparkles, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";

import { useAthleteDashboardStore } from "@/lib/athlete-store";
import {
  DAY_INDEX_LABELS,
  analyzeCustomPlan,
  newDayId,
  newExerciseId,
  newPlanId,
  type CustomPlanDay,
  type CustomWorkoutPlan,
} from "@/lib/custom/workout-plans";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { ReserveSelect } from "@/components/ui/reserve";
import { markCustomSessionComplete as markCustomSessionMoment } from "@/components/ui/reserve/log-moment/recorders";

const GOLD = "#d5b15f";
const STEEL = "#7dd3ee";
const GREEN = "#79e3b5";
const RED = "#ef7d55";

function emptyPlan(): CustomWorkoutPlan {
  const now = new Date().toISOString();
  return { id: newPlanId(), name: "My Training Plan", days: [], createdAt: now, updatedAt: now };
}

function emptyDay(dayIndex: number | null): CustomPlanDay {
  return { id: newDayId(), dayIndex, title: "Training Day", exercises: [] };
}

const inputCls =
  "w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[13px] text-[#f2eee6] outline-none transition-colors focus:border-[#d5b15f]/40 placeholder:text-white/18";

/** Member-authored training plans — create, edit, run, and complete custom
    sessions that count toward the same game-plan progress. */
export function CustomPlansPanel({ todayIndex }: { todayIndex: number }) {
  const customPlans = useAthleteDashboardStore((s) => s.customPlans);
  const activeCustomPlanId = useAthleteDashboardStore((s) => s.activeCustomPlanId);
  const saveCustomPlan = useAthleteDashboardStore((s) => s.saveCustomPlan);
  const deleteCustomPlan = useAthleteDashboardStore((s) => s.deleteCustomPlan);
  const setActiveCustomPlan = useAthleteDashboardStore((s) => s.setActiveCustomPlan);
  const markCustomSessionComplete = useAthleteDashboardStore((s) => s.markCustomSessionComplete);
  const sessionHistory = useAthleteDashboardStore((s) => s.trainingSession.sessionHistory);

  const [openPlanId, setOpenPlanId] = useState<string | null>(null);
  const [analyzePlanId, setAnalyzePlanId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const todayKey = new Date().toDateString();
  const completedTodayTitles = useMemo(
    () => new Set((sessionHistory ?? []).filter((c) => new Date(c.date).toDateString() === todayKey).map((c) => c.sessionName)),
    [sessionHistory, todayKey],
  );

  function patchPlan(plan: CustomWorkoutPlan, patch: Partial<CustomWorkoutPlan>) {
    saveCustomPlan({ ...plan, ...patch });
  }

  return (
    <GlassPanel accent={STEEL}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ClipboardList size={13} style={{ color: STEEL }} />
            <p className="font-mono text-[9px] uppercase tracking-[0.26em]" style={{ color: `${STEEL}cc` }}>Your Plans · Custom Training</p>
          </div>
          <p className="mt-1.5 max-w-xl text-[11.5px] leading-[1.55] text-white/45">
            Bring your own system. Author a plan, run it alongside or instead of the Reserve split — completed custom sessions
            count toward your week like any Reserve session. Saved automatically.
          </p>
        </div>
        <motion.button
          type="button"
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => {
            const plan = emptyPlan();
            saveCustomPlan(plan);
            setOpenPlanId(plan.id);
          }}
          className="inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 font-mono text-[9px] uppercase tracking-[0.18em]"
          style={{ borderColor: `${GOLD}40`, background: `${GOLD}12`, color: GOLD }}
        >
          <Plus size={12} />New Plan
        </motion.button>
      </div>

      {customPlans.length === 0 ? (
        <div className="mt-4 px-6 py-6 text-center">
          <p className="text-[13px] font-bold text-[#f2eee6]">No custom plans yet</p>
          <p className="mx-auto mt-1.5 max-w-md text-[11.5px] leading-[1.5] text-white/40">
            Build your own split — days, movements, sets, and reps — and Reserve will organize it, track it, and keep you accountable to it.
          </p>
        </div>
      ) : (
        <div className="mt-4 grid gap-3">
          {customPlans.map((plan) => {
            const isOpen = openPlanId === plan.id;
            const isActive = activeCustomPlanId === plan.id;
            const analysis = analyzePlanId === plan.id ? analyzeCustomPlan(plan) : null;
            const todayDay = plan.days.find((d) => d.dayIndex === todayIndex);
            const todayDone = todayDay ? completedTodayTitles.has(todayDay.title || "Custom Session") : false;
            return (
              <div
                key={plan.id}
                className="overflow-hidden rounded-2xl"
                style={{
                  borderColor: isActive ? `${GOLD}38` : "rgba(255,255,255,0.06)",
                  background: isActive ? `linear-gradient(165deg, ${GOLD}0c, transparent)` : "rgba(255,255,255,0.015)",
                }}
              >
                <div className="flex flex-wrap items-center gap-2 p-3.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-[14px] font-bold text-[#f2eee6]">{plan.name}</p>
                      {isActive && (
                        <span className="rounded-full border px-2 py-0.5 font-mono text-[7px] uppercase tracking-[0.16em]" style={{ borderColor: `${GOLD}45`, background: `${GOLD}14`, color: GOLD }}>
                          Running
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 font-mono text-[8px] uppercase tracking-[0.18em] text-white/32">
                      {plan.days.length} day{plan.days.length === 1 ? "" : "s"} · {plan.days.reduce((s, d) => s + d.exercises.length, 0)} exercises
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveCustomPlan(isActive ? null : plan.id)}
                    className="rounded-xl border px-3 py-1.5 font-mono text-[8px] uppercase tracking-[0.16em] transition"
                    style={{
                      borderColor: isActive ? `${GOLD}45` : "rgba(255,255,255,0.1)",
                      background: isActive ? `${GOLD}14` : "rgba(255,255,255,0.03)",
                      color: isActive ? GOLD : "rgba(255,255,255,0.5)",
                    }}
                  >
                    {isActive ? "Stop Running" : "Run This Plan"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAnalyzePlanId(analyzePlanId === plan.id ? null : plan.id); }}
                    className="inline-flex items-center gap-1 rounded-xl border border-[#7dd3ee]/28 bg-[#7dd3ee]/[0.07] px-3 py-1.5 font-mono text-[8px] uppercase tracking-[0.16em] text-[#7dd3ee]"
                  >
                    <Sparkles size={10} />Analyze
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpenPlanId(isOpen ? null : plan.id)}
                    className="rounded-xl border border-white/[0.1] bg-white/[0.03] p-2 text-white/50 transition hover:text-white/80"
                    aria-label={isOpen ? "Close editor" : "Edit plan"}
                  >
                    {isOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  </button>
                  {confirmDeleteId === plan.id ? (
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => { deleteCustomPlan(plan.id); setConfirmDeleteId(null); }} className="rounded-xl border px-2.5 py-1.5 font-mono text-[8px] uppercase tracking-[0.14em]" style={{ borderColor: `${RED}45`, background: `${RED}14`, color: RED }}>
                        Confirm
                      </button>
                      <button type="button" onClick={() => setConfirmDeleteId(null)} className="rounded-xl border border-white/[0.1] p-1.5 text-white/40" aria-label="Cancel delete"><X size={12} /></button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setConfirmDeleteId(plan.id)} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-2 text-white/35 transition hover:text-[#ef7d55]" aria-label="Delete plan">
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>

                {/* Today's custom session — one-tap completion */}
                {isActive && todayDay && (
                  <div className="mx-3.5 mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2.5" style={{ borderColor: `${GREEN}26`, background: `${GREEN}07` }}>
                    <div className="min-w-0">
                      <p className="font-mono text-[7.5px] uppercase tracking-[0.2em]" style={{ color: `${GREEN}cc` }}>Today · {DAY_INDEX_LABELS[todayIndex]}</p>
                      <p className="mt-0.5 text-[12.5px] font-bold text-[#f2eee6]">{todayDay.title} · {todayDay.exercises.length} exercises</p>
                    </div>
                    {todayDone ? (
                      <span className="inline-flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.16em]" style={{ color: GREEN }}>
                        <CheckCircle2 size={12} />Completed
                      </span>
                    ) : (
                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.96 }}
                        onClick={() => {
                          markCustomSessionComplete(plan.id, todayDay.id);
                          markCustomSessionMoment(todayDay.title);
                        }}
                        className="rounded-xl px-3.5 py-2 font-mono text-[8.5px] font-bold uppercase tracking-[0.16em] text-black"
                        style={{ background: `linear-gradient(160deg, ${GREEN}, #5fc99a)` }}
                      >
                        Mark Complete
                      </motion.button>
                    )}
                  </div>
                )}

                {/* Reserve enhance — deterministic analysis, advisory only */}
                {analysis && (
                  <div className="mx-3.5 mb-3 rounded-xl bg-[#7dd3ee]/[0.05] p-3.5">
                    <p className="font-mono text-[8px] uppercase tracking-[0.22em] text-[#7dd3ee]">Reserve Read · {analysis.headline}</p>
                    <div className="mt-2 grid gap-1.5">
                      {analysis.findings.map((f) => (
                        <p key={f} className="text-[11.5px] leading-[1.5] text-white/55">· {f}</p>
                      ))}
                    </div>
                    {analysis.progressionSuggestions.length > 0 && (
                      <>
                        <p className="mt-3 font-mono text-[7.5px] uppercase tracking-[0.2em] text-white/32">Add progression</p>
                        <div className="mt-1.5 grid gap-1.5">
                          {analysis.progressionSuggestions.map((sug) => (
                            <p key={sug} className="text-[11.5px] leading-[1.5]" style={{ color: `${GOLD}cc` }}>· {sug}</p>
                          ))}
                        </div>
                      </>
                    )}
                    <p className="mt-3 text-[9.5px] leading-4 text-white/28">Advisory read of your authored structure — your plan is never overwritten.</p>
                  </div>
                )}

                {/* Editor */}
                {isOpen && (
                  <div className="border-t border-white/[0.05] p-3.5">
                    <label className="block">
                      <span className="font-mono text-[8px] uppercase tracking-[0.2em] text-white/30">Plan name</span>
                      <input
                        value={plan.name}
                        onChange={(e) => patchPlan(plan, { name: e.target.value })}
                        maxLength={48}
                        className={`mt-1.5 ${inputCls}`}
                      />
                    </label>

                    <div className="mt-4 grid gap-3">
                      {plan.days.map((day) => (
                        <div key={day.id} className="rounded-xl bg-black/20 p-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <input
                              value={day.title}
                              onChange={(e) => patchPlan(plan, { days: plan.days.map((d) => (d.id === day.id ? { ...d, title: e.target.value } : d)) })}
                              maxLength={40}
                              placeholder="Day title (e.g. Upper Strength)"
                              className={`${inputCls} flex-1 min-w-[160px]`}
                            />
                            <ReserveSelect
                              srLabel={`Day for ${day.title}`}
                              className="w-[150px] shrink-0"
                              value={day.dayIndex === null || day.dayIndex === undefined ? "" : String(day.dayIndex)}
                              options={[
                                { value: "", label: "Flex day" },
                                ...DAY_INDEX_LABELS.map((label, idx) => ({ value: String(idx), label })),
                              ]}
                              onChange={(v) =>
                                patchPlan(plan, {
                                  days: plan.days.map((d) =>
                                    d.id === day.id ? { ...d, dayIndex: v === "" ? null : Number(v) } : d,
                                  ),
                                })
                              }
                            />
                            <button
                              type="button"
                              onClick={() => patchPlan(plan, { days: plan.days.filter((d) => d.id !== day.id) })}
                              className="rounded-xl border border-white/[0.08] p-2 text-white/30 transition hover:text-[#ef7d55]"
                              aria-label="Remove day"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>

                          <div className="mt-3 grid gap-2">
                            {day.exercises.map((ex) => (
                              <div key={ex.id} className="grid grid-cols-[minmax(0,1.6fr)_64px_76px_76px_auto] items-center gap-2">
                                <input
                                  value={ex.name}
                                  onChange={(e) => patchPlan(plan, { days: plan.days.map((d) => (d.id === day.id ? { ...d, exercises: d.exercises.map((x) => (x.id === ex.id ? { ...x, name: e.target.value } : x)) } : d)) })}
                                  placeholder="Exercise"
                                  className={inputCls}
                                />
                                <input
                                  value={ex.sets || ""}
                                  onChange={(e) => patchPlan(plan, { days: plan.days.map((d) => (d.id === day.id ? { ...d, exercises: d.exercises.map((x) => (x.id === ex.id ? { ...x, sets: Math.max(0, Math.min(12, Number(e.target.value) || 0)) } : x)) } : d)) })}
                                  placeholder="Sets"
                                  inputMode="numeric"
                                  className={`${inputCls} text-center`}
                                />
                                <input
                                  value={ex.reps}
                                  onChange={(e) => patchPlan(plan, { days: plan.days.map((d) => (d.id === day.id ? { ...d, exercises: d.exercises.map((x) => (x.id === ex.id ? { ...x, reps: e.target.value } : x)) } : d)) })}
                                  placeholder="Reps"
                                  className={`${inputCls} text-center`}
                                />
                                <input
                                  value={ex.rest ?? ""}
                                  onChange={(e) => patchPlan(plan, { days: plan.days.map((d) => (d.id === day.id ? { ...d, exercises: d.exercises.map((x) => (x.id === ex.id ? { ...x, rest: e.target.value } : x)) } : d)) })}
                                  placeholder="Rest"
                                  className={`${inputCls} text-center`}
                                />
                                <button
                                  type="button"
                                  onClick={() => patchPlan(plan, { days: plan.days.map((d) => (d.id === day.id ? { ...d, exercises: d.exercises.filter((x) => x.id !== ex.id) } : d)) })}
                                  className="rounded-lg border border-white/[0.07] p-1.5 text-white/25 transition hover:text-[#ef7d55]"
                                  aria-label="Remove exercise"
                                >
                                  <X size={11} />
                                </button>
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={() => patchPlan(plan, { days: plan.days.map((d) => (d.id === day.id ? { ...d, exercises: [...d.exercises, { id: newExerciseId(), name: "", sets: 3, reps: "8-12" }] } : d)) })}
                              className="inline-flex w-fit items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-1.5 font-mono text-[8px] uppercase tracking-[0.16em] text-white/45 transition hover:text-white/75"
                            >
                              <Plus size={10} />Add exercise
                            </button>
                          </div>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => patchPlan(plan, { days: [...plan.days, emptyDay(plan.days.length <= 6 ? plan.days.length : null)] })}
                        className="inline-flex w-fit items-center gap-1.5 rounded-xl border px-3.5 py-2 font-mono text-[8.5px] uppercase tracking-[0.18em]"
                        style={{ borderColor: `${STEEL}35`, background: `${STEEL}0c`, color: STEEL }}
                      >
                        <Plus size={11} />Add training day
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </GlassPanel>
  );
}
