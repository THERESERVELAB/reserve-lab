"use client";

/* ════════════════════════════════════════════════════════════════════════
   CUSTOM WORKOUT BUILDER — slot-driven sessions with ranked movements.

   The member owns every decision: pick a slot, see Reserve's options ranked
   best-fit → avoid-today with plain-language reasons, choose ANY of them
   (lower-ranked picks are recorded, not resisted), or type a custom
   exercise. Sets / reps / RIR / RPE / tempo / rest / techniques /
   substitutions are all member-controlled. A saved template can be assigned
   to a schedule day and launched as a REAL immutable Reserve session.
   ════════════════════════════════════════════════════════════════════════ */

import { motion } from "framer-motion";
import {
  ArrowDown, ArrowUp, Dumbbell, GitBranch, Play, Plus, Trash2, X,
} from "lucide-react";
import { useMemo, useState } from "react";

import { useAthleteDashboardStore } from "@/lib/athlete-store";
import {
  INTENSITY_TECHNIQUE_LABELS,
  RECOMMENDATION_CATEGORY_LABELS,
  lifestyleId,
  rotationDayLabel,
  type CustomWorkoutMovement,
  type CustomWorkoutTemplate,
  type IntensityTechnique,
  type RecommendationCategory,
} from "@/lib/lifestyle/types";
import {
  SLOT_ROLES,
  rankMovementsForSlot,
  slotRoleById,
  type SlotRole,
} from "@/lib/lifestyle/movement-ranking";
import { MOVEMENT_LIBRARY } from "@/lib/training/prescription-engine";
import { ReserveSelect } from "@/components/ui/reserve";

const GOLD = "#d5b15f";
const TEAL = "#5fb7d5";
const GREEN = "#79e3b5";
const RED = "#ef7d55";
const AMBER = "#e8c87a";

const CATEGORY_COLORS: Record<RecommendationCategory, string> = {
  "best-fit": GREEN,
  "strong-alternative": TEAL,
  specialized: GOLD,
  "limited-fit": AMBER,
  "avoid-today": RED,
};

const PAIN_AREAS = ["elbow", "shoulder", "knee", "hip", "spine", "ankle"] as const;
const TECHNIQUES = Object.keys(INTENSITY_TECHNIQUE_LABELS) as IntensityTechnique[];
const LIB_BY_ID = new Map(MOVEMENT_LIBRARY.map((e) => [e.id, e]));

const inputCls =
  "w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[16px] text-[#f2eee6] outline-none transition-colors focus:border-[#d5b15f]/40 placeholder:text-white/18";
const selectCls =
  "rounded-xl border border-white/[0.08] bg-[#14161d] px-2.5 py-2 text-[16px] text-[#f2eee6] outline-none transition-colors focus:border-[#d5b15f]/40";
const numCls = `${selectCls} w-[70px] py-1.5`;

function emptyTemplate(): CustomWorkoutTemplate {
  const now = new Date().toISOString();
  const id = lifestyleId("cwt");
  return {
    id, lineageId: id, name: "My Session", version: 1, status: "draft",
    sessionObjective: "Build the session around my goal",
    targetMuscles: [], painObservations: [], movements: [],
    source: "member", createdAt: now, updatedAt: now,
  };
}

function movementName(mv: CustomWorkoutMovement): string {
  return mv.exerciseId ? LIB_BY_ID.get(mv.exerciseId)?.name ?? "Unknown" : mv.customExerciseName ?? "Custom";
}

export function WorkoutBuilderPanel() {
  const templates = useAthleteDashboardStore((s) => s.customWorkoutTemplates);
  const save = useAthleteDashboardStore((s) => s.saveCustomWorkoutTemplate);
  const saveTemplateVersion = useAthleteDashboardStore((s) => s.saveCustomWorkoutTemplateVersion);
  const remove = useAthleteDashboardStore((s) => s.deleteCustomWorkoutTemplate);
  const recordSelection = useAthleteDashboardStore((s) => s.recordMovementSelection);
  const startFromTemplate = useAthleteDashboardStore((s) => s.startSessionFromCustomTemplate);
  const setActiveView = useAthleteDashboardStore((s) => s.setActiveView);
  const liveSession = useAthleteDashboardStore((s) => s.trainingSession.sessionMode === "live");
  const profile = useAthleteDashboardStore((s) => s.userTrainingProfile);
  const preferences = useAthleteDashboardStore((s) => s.movementPreferences);
  const feedback = useAthleteDashboardStore((s) => s.movementFeedback);
  const sessionHistory = useAthleteDashboardStore((s) => s.trainingSession.sessionHistory);
  const schedules = useAthleteDashboardStore((s) => s.lifestyleSchedules);
  const activeScheduleId = useAthleteDashboardStore((s) => s.activeLifestyleScheduleId);
  const saveSchedule = useAthleteDashboardStore((s) => s.saveLifestyleSchedule);

  const [openId, setOpenId] = useState<string | null>(null);
  const [slotPickerId, setSlotPickerId] = useState<string | null>(null);
  const [pickedSlot, setPickedSlot] = useState<SlotRole | null>(null);
  const [customName, setCustomName] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [startNote, setStartNote] = useState<string | null>(null);

  const open = templates.find((t) => t.id === openId) ?? null;
  const activeSchedule = schedules.find((s) => s.id === activeScheduleId) ?? null;
  const recentMovementNames = useMemo(
    () => (sessionHistory ?? []).slice(0, 6).map((c) => c.improved).filter(Boolean) as string[],
    [sessionHistory],
  );

  const ranked = useMemo(() => {
    if (!pickedSlot || !open) return [];
    return rankMovementsForSlot(pickedSlot, {
      profile,
      preferences,
      feedback,
      painObservations: open.painObservations,
      timeAvailableMin: open.timeAvailableMin ?? null,
      recentMovementNames,
    });
  }, [pickedSlot, open, profile, preferences, feedback, recentMovementNames]);

  function patch(t: CustomWorkoutTemplate, updates: Partial<CustomWorkoutTemplate>) {
    save({ ...t, ...updates });
  }

  function patchMovement(t: CustomWorkoutTemplate, id: string, updates: Partial<CustomWorkoutMovement>) {
    patch(t, { movements: t.movements.map((m) => (m.id === id ? { ...m, ...updates } : m)) });
  }

  function addMovement(t: CustomWorkoutTemplate, mv: Omit<CustomWorkoutMovement, "id" | "order">) {
    patch(t, {
      movements: [...t.movements, { ...mv, id: lifestyleId("cwm"), order: t.movements.length }],
    });
  }

  function moveMovement(t: CustomWorkoutTemplate, id: string, dir: -1 | 1) {
    const sorted = [...t.movements].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex((m) => m.id === id);
    const swap = sorted[idx + dir];
    if (!swap) return;
    patch(t, {
      movements: sorted.map((m, i) =>
        i === idx ? { ...m, order: idx + dir } : i === idx + dir ? { ...m, order: idx } : { ...m, order: i },
      ),
    });
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Dumbbell size={13} style={{ color: GOLD }} />
            <p className="font-mono text-[9px] uppercase tracking-[0.26em]" style={{ color: `${GOLD}cc` }}>
              Build Your Sessions · Custom Workouts
            </p>
          </div>
          <p className="mt-1.5 max-w-xl text-[11.5px] leading-[1.55] text-white/45">
            Build from movement slots — Reserve ranks every option best-fit to avoid-today and explains why. Pick
            anything, including lower-ranked options: your choice is recorded and respected, never overwritten.
          </p>
        </div>
        <motion.button
          type="button" whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }}
          onClick={() => {
            const t = emptyTemplate();
            save(t);
            setOpenId(t.id);
          }}
          className="inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 font-mono text-[9px] uppercase tracking-[0.18em]"
          style={{ borderColor: `${GOLD}40`, background: `${GOLD}12`, color: GOLD }}
        >
          <Plus size={12} />New Session
        </motion.button>
      </div>

      {templates.length === 0 ? (
        <div className="mt-4 py-6 text-center">
          <p className="text-[13px] font-bold text-[#f2eee6]">No custom sessions yet</p>
          <p className="mx-auto mt-1.5 max-w-md text-[11.5px] leading-[1.5] text-white/40">
            Create a session, add movement slots, and let Reserve rank the options — or build every movement yourself.
          </p>
        </div>
      ) : (
        <div className="mt-4 grid gap-2.5">
          {templates.map((t) => {
            const isOpen = openId === t.id;
            const sorted = [...t.movements].sort((a, b) => a.order - b.order);
            return (
              <div
                key={t.id}
                className="border-t first:border-t-0"
                style={{
                  borderColor: isOpen ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.06)",
                }}
              >
                <div className="flex flex-wrap items-center gap-2 p-3.5">
                  <button type="button" onClick={() => { setOpenId(isOpen ? null : t.id); setSlotPickerId(null); setPickedSlot(null); }} className="min-w-0 flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-[14px] font-bold text-[#f2eee6]">{t.name}</p>
                      <span className="rounded-full border border-white/[0.1] px-2 py-0.5 font-mono text-[7px] uppercase tracking-[0.16em] text-white/40">
                        v{t.version}
                      </span>
                    </div>
                    <p className="mt-0.5 font-mono text-[8px] uppercase tracking-[0.16em] text-white/30">
                      {t.movements.length} movements · {t.movements.reduce((s, m) => s + m.workingSets, 0)} working sets
                    </p>
                  </button>
                  <div className="flex items-center gap-1.5">
                    <motion.button
                      type="button" whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }}
                      disabled={liveSession || t.movements.length === 0}
                      title={
                        liveSession ? "A live session is running — close it out first"
                        : t.movements.length === 0 ? "Add at least one movement to launch"
                        : "Start this as today's real Reserve session"
                      }
                      onClick={() => {
                        const ok = startFromTemplate(t.id);
                        if (ok) {
                          setActiveView("training");
                        } else {
                          setStartNote("Could not start — a live session is already running. Close it out in Training Command first.");
                        }
                      }}
                      className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 font-mono text-[8px] font-bold uppercase tracking-[0.16em] disabled:cursor-not-allowed disabled:opacity-35"
                      style={{ borderColor: `${GREEN}45`, background: `${GREEN}12`, color: GREEN }}
                    >
                      <Play size={11} />Start Session
                    </motion.button>
                    <button
                      type="button" title="Save a new version"
                      onClick={() => saveTemplateVersion(t)}
                      className="rounded-lg border border-white/[0.1] p-1.5 text-white/45 transition hover:text-white/80"
                    >
                      <GitBranch size={13} />
                    </button>
                    {confirmDeleteId === t.id ? (
                      <button
                        type="button"
                        onClick={() => { remove(t.id); setConfirmDeleteId(null); if (isOpen) setOpenId(null); }}
                        className="rounded-lg border px-2.5 py-1.5 font-mono text-[8px] uppercase tracking-[0.14em]"
                        style={{ borderColor: `${RED}55`, background: `${RED}14`, color: RED }}
                      >
                        Confirm Delete
                      </button>
                    ) : (
                      <button
                        type="button" title="Delete"
                        onClick={() => setConfirmDeleteId(t.id)}
                        className="rounded-lg border border-white/[0.1] p-1.5 text-white/45 transition hover:text-[#ef7d55]"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t border-white/[0.05] p-3.5">
                    {/* ── Session context (drives ranking) ── */}
                    <div className="grid gap-2 sm:grid-cols-2">
                      <input
                        value={t.name}
                        onChange={(e) => patch(t, { name: e.target.value })}
                        className={inputCls}
                        placeholder="Session name"
                      />
                      <input
                        value={t.sessionObjective}
                        onChange={(e) => patch(t, { sessionObjective: e.target.value })}
                        className={inputCls}
                        placeholder="Session objective (e.g. Upper-chest focus)"
                      />
                    </div>
                    <div className="mt-2.5 flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[8px] uppercase tracking-[0.16em] text-white/35">Joint observations:</span>
                      {PAIN_AREAS.map((area) => {
                        const on = t.painObservations.includes(area);
                        return (
                          <button
                            key={area} type="button"
                            onClick={() =>
                              patch(t, {
                                painObservations: on
                                  ? t.painObservations.filter((p) => p !== area)
                                  : [...t.painObservations, area],
                              })
                            }
                            className="rounded-full border px-2.5 py-1 font-mono text-[8px] uppercase tracking-[0.14em] transition"
                            style={on
                              ? { borderColor: `${AMBER}50`, background: `${AMBER}12`, color: AMBER }
                              : { borderColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.4)" }}
                            title="Observation only — re-ranks options toward lower joint demand"
                          >
                            {area}
                          </button>
                        );
                      })}
                      <label className="ml-auto flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.14em] text-white/35">
                        Time available
                        <input
                          type="number" min={15} max={240}
                          value={t.timeAvailableMin ?? ""}
                          placeholder="min"
                          onChange={(e) => patch(t, { timeAvailableMin: e.target.value ? Number(e.target.value) : undefined })}
                          className={numCls}
                        />
                      </label>
                    </div>

                    {/* ── Movements ── */}
                    <div className="mt-3 grid gap-2">
                      {sorted.map((mv, i) => {
                        const slot = slotRoleById(mv.slotRole);
                        return (
                          <div key={mv.id} className="border-l-2 border-white/[0.08] py-1 pl-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-[10px] font-bold text-white/30">{i + 1}</span>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-[13px] font-bold text-[#f2eee6]">{movementName(mv)}</p>
                                {slot && (
                                  <p className="font-mono text-[7.5px] uppercase tracking-[0.16em]" style={{ color: `${TEAL}aa` }}>
                                    {slot.label}
                                  </p>
                                )}
                              </div>
                              <button type="button" title="Move up" disabled={i === 0} onClick={() => moveMovement(t, mv.id, -1)} className="rounded-lg border border-white/[0.1] p-1.5 text-white/45 transition hover:text-white/80 disabled:opacity-25">
                                <ArrowUp size={12} />
                              </button>
                              <button type="button" title="Move down" disabled={i === sorted.length - 1} onClick={() => moveMovement(t, mv.id, 1)} className="rounded-lg border border-white/[0.1] p-1.5 text-white/45 transition hover:text-white/80 disabled:opacity-25">
                                <ArrowDown size={12} />
                              </button>
                              <button type="button" title="Remove movement" onClick={() => patch(t, { movements: t.movements.filter((m) => m.id !== mv.id) })} className="rounded-lg border border-white/[0.1] p-1.5 text-white/45 transition hover:text-[#ef7d55]">
                                <Trash2 size={12} />
                              </button>
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
                              <label className="flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.12em] text-white/35">
                                Warm-up
                                <input type="number" min={0} max={5} value={mv.warmupSets ?? 0} onChange={(e) => patchMovement(t, mv.id, { warmupSets: Number(e.target.value) || undefined })} className={numCls} />
                              </label>
                              <label className="flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.12em] text-white/35">
                                Sets
                                <input type="number" min={1} max={10} value={mv.workingSets} onChange={(e) => patchMovement(t, mv.id, { workingSets: Math.max(1, Number(e.target.value) || 1) })} className={numCls} />
                              </label>
                              <label className="flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.12em] text-white/35">
                                Reps
                                <input type="number" min={1} max={50} value={mv.repMin ?? ""} placeholder="min" onChange={(e) => patchMovement(t, mv.id, { repMin: e.target.value ? Number(e.target.value) : undefined })} className={numCls} />
                                –
                                <input type="number" min={1} max={50} value={mv.repMax ?? ""} placeholder="max" onChange={(e) => patchMovement(t, mv.id, { repMax: e.target.value ? Number(e.target.value) : undefined })} className={numCls} />
                              </label>
                              <label className="flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.12em] text-white/35">
                                RIR
                                <input type="number" min={0} max={5} value={mv.rirTarget ?? ""} onChange={(e) => patchMovement(t, mv.id, { rirTarget: e.target.value ? Number(e.target.value) : undefined })} className={numCls} />
                              </label>
                              <label className="flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.12em] text-white/35">
                                Rest s
                                <input type="number" min={15} max={600} step={15} value={mv.restSeconds ?? ""} onChange={(e) => patchMovement(t, mv.id, { restSeconds: e.target.value ? Number(e.target.value) : undefined })} className={numCls} />
                              </label>
                              <label className="flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.12em] text-white/35">
                                Load lb
                                <input type="number" min={0} max={2000} step={5} value={mv.loadTarget ?? ""} placeholder="—" onChange={(e) => patchMovement(t, mv.id, { loadTarget: e.target.value ? Number(e.target.value) : undefined })} className={numCls} />
                              </label>
                              <label className="flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.12em] text-white/35">
                                Tempo
                                <input value={mv.tempo ?? ""} placeholder="3-1-1" onChange={(e) => patchMovement(t, mv.id, { tempo: e.target.value || undefined })} className={`${selectCls} w-[80px] py-1.5`} />
                              </label>
                              <ReserveSelect
                                srLabel={`Intensity technique for ${movementName(mv)}`}
                                className="w-[190px]"
                                value={mv.intensityTechnique ?? "straight-sets"}
                                options={TECHNIQUES.map((k) => ({ value: k, label: INTENSITY_TECHNIQUE_LABELS[k] }))}
                                onChange={(v) => patchMovement(t, mv.id, { intensityTechnique: v as IntensityTechnique })}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* ── Slot picker + ranked options ── */}
                    {slotPickerId === t.id ? (
                      <div className="mt-3 border-l-2 py-1 pl-3.5" style={{ borderColor: `${TEAL}40` }}>
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-mono text-[8px] uppercase tracking-[0.2em]" style={{ color: TEAL }}>
                            {pickedSlot ? `Ranked Options · ${pickedSlot.label}` : "Choose a Movement Slot"}
                          </p>
                          <button type="button" onClick={() => { setSlotPickerId(null); setPickedSlot(null); }} className="rounded-lg border border-white/[0.1] p-1 text-white/45">
                            <X size={12} />
                          </button>
                        </div>

                        {!pickedSlot ? (
                          <div className="mt-2.5 flex flex-wrap gap-1.5">
                            {SLOT_ROLES.map((slot) => (
                              <button
                                key={slot.id} type="button"
                                onClick={() => setPickedSlot(slot)}
                                title={slot.description}
                                className="rounded-full border border-white/[0.1] px-3 py-1.5 font-mono text-[8px] uppercase tracking-[0.14em] text-white/55 transition hover:border-[#5fb7d5]/40 hover:text-white/90"
                              >
                                {slot.label}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <>
                            <div className="mt-2.5 grid gap-2">
                              {ranked.map((r) => {
                                const color = CATEGORY_COLORS[r.category];
                                return (
                                  <div key={r.id} className="border-t border-white/[0.05] py-3 first:border-t-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="font-mono text-[10px] font-bold" style={{ color }}>#{r.rank}</span>
                                      <p className="min-w-0 flex-1 truncate text-[12.5px] font-bold text-[#f2eee6]">{r.candidate.name}</p>
                                      <span className="rounded-full border px-2 py-0.5 font-mono text-[7px] uppercase tracking-[0.14em]" style={{ borderColor: `${color}45`, background: `${color}10`, color }}>
                                        {RECOMMENDATION_CATEGORY_LABELS[r.category]}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          addMovement(t, {
                                            exerciseId: r.candidate.id,
                                            slotRole: pickedSlot.id,
                                            workingSets: 3, repMin: 8, repMax: 12,
                                            rirTarget: 2, restSeconds: 120,
                                            substitutionExerciseIds: ranked
                                              .filter((x) => x.candidate.id !== r.candidate.id && x.category !== "avoid-today")
                                              .slice(0, 2)
                                              .map((x) => x.candidate.id),
                                          });
                                          recordSelection({
                                            templateId: t.id,
                                            slotRole: pickedSlot.id,
                                            chosenExerciseId: r.candidate.id,
                                            chosenName: r.candidate.name,
                                            chosenCategory: r.category,
                                            rejectedExerciseIds: ranked
                                              .filter((x) => x.rank < r.rank)
                                              .map((x) => x.candidate.id),
                                          });
                                          setSlotPickerId(null);
                                          setPickedSlot(null);
                                        }}
                                        className="rounded-lg border px-2.5 py-1.5 font-mono text-[8px] font-bold uppercase tracking-[0.14em]"
                                        style={{ borderColor: `${GOLD}45`, background: `${GOLD}10`, color: GOLD }}
                                      >
                                        Choose
                                      </button>
                                    </div>
                                    {r.reasons.length > 0 && (
                                      <ul className="mt-1.5 grid gap-0.5">
                                        {r.reasons.slice(0, 3).map((reason) => (
                                          <li key={reason} className="flex items-start gap-1.5 text-[10px] leading-4 text-white/45">
                                            <span className="mt-0.5 shrink-0" style={{ color: GREEN }}>+</span>{reason}
                                          </li>
                                        ))}
                                      </ul>
                                    )}
                                    {r.tradeoffs.length > 0 && (
                                      <ul className="mt-0.5 grid gap-0.5">
                                        {r.tradeoffs.slice(0, 2).map((tr) => (
                                          <li key={tr} className="flex items-start gap-1.5 text-[10px] leading-4 text-white/40">
                                            <span className="mt-0.5 shrink-0" style={{ color: AMBER }}>−</span>{tr}
                                          </li>
                                        ))}
                                      </ul>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                            {/* Custom exercise entry — full member control */}
                            <div className="mt-2.5 flex flex-wrap items-center gap-2">
                              <input
                                value={customName}
                                onChange={(e) => setCustomName(e.target.value)}
                                className={`${inputCls} max-w-xs`}
                                placeholder="Or type your own exercise…"
                              />
                              <button
                                type="button"
                                disabled={!customName.trim()}
                                onClick={() => {
                                  addMovement(t, {
                                    customExerciseName: customName.trim(),
                                    slotRole: pickedSlot.id,
                                    workingSets: 3, repMin: 8, repMax: 12, rirTarget: 2,
                                    restSeconds: 120, substitutionExerciseIds: [],
                                  });
                                  recordSelection({
                                    templateId: t.id,
                                    slotRole: pickedSlot.id,
                                    chosenExerciseId: null,
                                    chosenName: customName.trim(),
                                    chosenCategory: "specialized",
                                    rejectedExerciseIds: ranked.map((x) => x.candidate.id),
                                  });
                                  setCustomName("");
                                  setSlotPickerId(null);
                                  setPickedSlot(null);
                                }}
                                className="rounded-xl border px-3.5 py-2 font-mono text-[9px] uppercase tracking-[0.16em] disabled:cursor-not-allowed disabled:opacity-35"
                                style={{ borderColor: `${GOLD}40`, background: `${GOLD}10`, color: GOLD }}
                              >
                                Add Custom
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => { setSlotPickerId(t.id); setPickedSlot(null); }}
                        className="mt-3 inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 font-mono text-[9px] uppercase tracking-[0.16em]"
                        style={{ borderColor: `${TEAL}40`, background: `${TEAL}0c`, color: TEAL }}
                      >
                        <Plus size={12} />Add Movement Slot
                      </button>
                    )}

                    {/* ── Assign to a schedule day ── */}
                    {activeSchedule && (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[8px] uppercase tracking-[0.16em] text-white/35">
                          Assign to a day on “{activeSchedule.name}”:
                        </span>
                        <ReserveSelect
                          srLabel={`Assign ${t.name} to a day on ${activeSchedule.name}`}
                          className="w-[260px]"
                          value={activeSchedule.activities.find((a) => a.workoutTemplateId === t.id)?.id ?? ""}
                          options={[
                            { value: "", label: "Not assigned" },
                            ...activeSchedule.activities
                              .filter((a) => a.type === "strength" || a.type === "hypertrophy")
                              .map((a) => ({
                                value: a.id,
                                label: `${rotationDayLabel(activeSchedule, a.dayIndex)} — ${a.title}`,
                              })),
                          ]}
                          onChange={(v) => {
                            saveSchedule({
                              ...activeSchedule,
                              /* A template lives on exactly one day: assigning it
                                 clears whatever day previously held it. */
                              activities: activeSchedule.activities.map((a) => {
                                if (a.id === v) return { ...a, workoutTemplateId: t.id };
                                if (a.workoutTemplateId === t.id) return { ...a, workoutTemplateId: undefined };
                                return a;
                              }),
                            });
                          }}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {startNote && (
        <div className="mt-3 border-l-2 py-1 pl-3.5" style={{ borderColor: `${AMBER}45` }}>
          <p className="text-[11.5px] leading-[1.5]" style={{ color: AMBER }}>{startNote}</p>
        </div>
      )}

      <p className="mt-4 text-[9.5px] leading-4 text-white/25">
        Rankings are organizational fit against your equipment, history, and observations — not medical guidance.
        Joint observations only re-order options. Your selections persist exactly as you made them.
      </p>
    </div>
  );
}
