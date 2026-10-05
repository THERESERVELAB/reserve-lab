"use client";

/* ════════════════════════════════════════════════════════════════════════
   SCHEDULE BUILDER — the member builds their real week.

   Full lifestyle editor: any activity type on any day (track Monday, gym
   Tuesday–Sunday, pickleball Saturday — Reserve never forces a shape),
   7-day calendars or rotating cycles, fixed vs flexible blocks, versioning
   with restore, and plug-and-play Reserve templates that always land as
   editable drafts. Edits save automatically; versions are explicit.
   ════════════════════════════════════════════════════════════════════════ */

import { motion } from "framer-motion";
import {
  Archive, ArchiveRestore, CalendarRange, Check, ChevronDown, ChevronUp,
  Copy, GitBranch, Plus, Sparkles, Trash2,
} from "lucide-react";
import { useState } from "react";

import { useAthleteDashboardStore } from "@/lib/athlete-store";
import {
  ACTIVITY_TYPE_LABELS,
  lifestyleId,
  rotationDayLabel,
  type ActivityIntensity,
  type LifestyleActivity,
  type LifestyleActivityType,
  type LifestyleSchedule,
} from "@/lib/lifestyle/types";
import { LIFESTYLE_TEMPLATES, blankSchedule, scheduleFromTemplate } from "@/lib/lifestyle/templates";
import { ReserveSelect } from "@/components/ui/reserve";

const GOLD = "#d5b15f";
const TEAL = "#5fb7d5";
const GREEN = "#79e3b5";
const RED = "#ef7d55";

const inputCls =
  "w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[16px] text-[#f2eee6] outline-none transition-colors focus:border-[#d5b15f]/40 placeholder:text-white/18";
const fieldCls =
  "rounded-xl border border-white/[0.08] bg-[#14161d] px-2.5 py-2 text-[16px] text-[#f2eee6] outline-none transition-colors focus:border-[#d5b15f]/40";

const ACTIVITY_TYPE_OPTIONS = Object.entries(ACTIVITY_TYPE_LABELS) as Array<[LifestyleActivityType, string]>;
const INTENSITIES: ActivityIntensity[] = ["low", "moderate", "high", "max"];

function emptyActivity(dayIndex: number): LifestyleActivity {
  return {
    id: lifestyleId("act"),
    dayIndex,
    type: "strength",
    title: "Training Session",
    fixed: false,
    intensity: "moderate",
    durationMinutes: 60,
  };
}

export function ScheduleBuilderPanel({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const schedules = useAthleteDashboardStore((s) => s.lifestyleSchedules);
  const activeId = useAthleteDashboardStore((s) => s.activeLifestyleScheduleId);
  const save = useAthleteDashboardStore((s) => s.saveLifestyleSchedule);
  const saveVersion = useAthleteDashboardStore((s) => s.saveLifestyleScheduleVersion);
  const remove = useAthleteDashboardStore((s) => s.deleteLifestyleSchedule);
  const archive = useAthleteDashboardStore((s) => s.archiveLifestyleSchedule);
  const setActive = useAthleteDashboardStore((s) => s.setActiveLifestyleSchedule);

  const [showTemplates, setShowTemplates] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [expandedDay, setExpandedDay] = useState<number | null>(null);

  const visible = schedules.filter((s) => s.status !== "archived");
  const archived = schedules.filter((s) => s.status === "archived");
  const selected = schedules.find((s) => s.id === selectedId) ?? null;

  function patch(schedule: LifestyleSchedule, updates: Partial<LifestyleSchedule>) {
    save({ ...schedule, ...updates });
  }

  function patchActivity(schedule: LifestyleSchedule, id: string, updates: Partial<LifestyleActivity>) {
    patch(schedule, {
      activities: schedule.activities.map((a) => (a.id === id ? { ...a, ...updates } : a)),
    });
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <CalendarRange size={13} style={{ color: GOLD }} />
            <p className="font-mono text-[9px] uppercase tracking-[0.26em]" style={{ color: `${GOLD}cc` }}>
              Build Your Week · Lifestyle Schedules
            </p>
          </div>
          <p className="mt-1.5 max-w-xl text-[11.5px] leading-[1.55] text-white/45">
            Your week, your shape — track Mondays, two-a-days, 8-day rotations, night shifts. Reserve analyzes
            whatever you build and never rearranges it without you. Edits save automatically.
          </p>
        </div>
        <div className="flex gap-2">
          <motion.button
            type="button" whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }}
            onClick={() => setShowTemplates((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 font-mono text-[9px] uppercase tracking-[0.18em]"
            style={{ borderColor: `${TEAL}40`, background: `${TEAL}10`, color: TEAL }}
          >
            <Sparkles size={12} />Reserve Templates
          </motion.button>
          <motion.button
            type="button" whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }}
            onClick={() => {
              const s = blankSchedule("My Week");
              save(s);
              onSelect(s.id);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 font-mono text-[9px] uppercase tracking-[0.18em]"
            style={{ borderColor: `${GOLD}40`, background: `${GOLD}12`, color: GOLD }}
          >
            <Plus size={12} />New Schedule
          </motion.button>
        </div>
      </div>

      {/* ── Plug-and-play templates (always land as editable drafts) ── */}
      {showTemplates && (
        <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {LIFESTYLE_TEMPLATES.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => {
                const s = scheduleFromTemplate(t);
                save(s);
                onSelect(s.id);
                setShowTemplates(false);
              }}
              className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 text-left transition hover:border-[#5fb7d5]/35 hover:bg-[#5fb7d5]/[0.05]"
            >
              <p className="text-[13px] font-bold text-[#f2eee6]">{t.name}</p>
              <p className="mt-1 text-[10.5px] leading-4 text-white/40">{t.tagline}</p>
              <p className="mt-2 font-mono text-[8px] uppercase tracking-[0.18em]" style={{ color: TEAL }}>
                {t.rotationLengthDays}-day {t.rotationLengthDays === 7 ? "week" : "rotation"} · adopt as draft
              </p>
            </button>
          ))}
        </div>
      )}

      {/* ── Saved schedules ── */}
      {visible.length === 0 && !showTemplates ? (
        <div className="mt-4 py-6 text-center">
          <p className="text-[13px] font-bold text-[#f2eee6]">No schedules yet</p>
          <p className="mx-auto mt-1.5 max-w-md text-[11.5px] leading-[1.5] text-white/40">
            Start from scratch or adopt a Reserve template — then shape every day until it matches your real life.
          </p>
        </div>
      ) : (
        <div className="mt-4 grid gap-2.5">
          {visible.map((s) => {
            const isSelected = selectedId === s.id;
            const isActive = activeId === s.id;
            return (
              <div
                key={s.id}
                className="border-t first:border-t-0"
                style={{
                  borderColor: isActive ? `${GOLD}38` : isSelected ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.06)",
                }}
              >
                <div className="flex flex-wrap items-center gap-2 py-3.5">
                  <button type="button" onClick={() => onSelect(isSelected ? null : s.id)} className="min-w-0 flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-[14px] font-bold text-[#f2eee6]">{s.name}</p>
                      <span className="rounded-full border border-white/[0.1] px-2 py-0.5 font-mono text-[7px] uppercase tracking-[0.16em] text-white/40">
                        v{s.version}
                      </span>
                      {isActive && (
                        <span className="rounded-full border px-2 py-0.5 font-mono text-[7px] uppercase tracking-[0.16em]" style={{ borderColor: `${GOLD}45`, background: `${GOLD}14`, color: GOLD }}>
                          Active
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 font-mono text-[8px] uppercase tracking-[0.16em] text-white/30">
                      {s.rotationLengthDays}-day {s.rotationLengthDays === 7 ? "week" : "rotation"} · {s.activities.length} activities · {s.source.replace(/-/g, " ")}
                    </p>
                  </button>
                  <div className="flex items-center gap-1.5">
                    {!isActive && (
                      <button
                        type="button"
                        onClick={() => setActive(s.id)}
                        className="rounded-lg border px-2.5 py-1.5 font-mono text-[8px] uppercase tracking-[0.14em]"
                        style={{ borderColor: `${GREEN}40`, color: GREEN }}
                      >
                        Set Active
                      </button>
                    )}
                    <button
                      type="button"
                      title="Save a new version of this schedule"
                      onClick={() => saveVersion(s)}
                      className="rounded-lg border border-white/[0.1] p-1.5 text-white/45 transition hover:text-white/80"
                    >
                      <GitBranch size={13} />
                    </button>
                    <button
                      type="button"
                      title="Duplicate as a new schedule"
                      onClick={() => {
                        const now = new Date().toISOString();
                        const id = lifestyleId("sched");
                        save({
                          ...s, id, lineageId: id, name: `${s.name} (copy)`, version: 1,
                          parentVersionId: undefined, status: "draft",
                          activities: s.activities.map((a) => ({ ...a, id: lifestyleId("act") })),
                          source: "member-created", createdAt: now, updatedAt: now,
                        });
                      }}
                      className="rounded-lg border border-white/[0.1] p-1.5 text-white/45 transition hover:text-white/80"
                    >
                      <Copy size={13} />
                    </button>
                    <button
                      type="button"
                      title="Archive (restorable)"
                      onClick={() => archive(s.id, true)}
                      className="rounded-lg border border-white/[0.1] p-1.5 text-white/45 transition hover:text-white/80"
                    >
                      <Archive size={13} />
                    </button>
                    {confirmDeleteId === s.id ? (
                      <button
                        type="button"
                        onClick={() => { remove(s.id); setConfirmDeleteId(null); if (isSelected) onSelect(null); }}
                        className="rounded-lg border px-2.5 py-1.5 font-mono text-[8px] uppercase tracking-[0.14em]"
                        style={{ borderColor: `${RED}55`, background: `${RED}14`, color: RED }}
                      >
                        Confirm Delete
                      </button>
                    ) : (
                      <button
                        type="button"
                        title="Delete permanently"
                        onClick={() => setConfirmDeleteId(s.id)}
                        className="rounded-lg border border-white/[0.1] p-1.5 text-white/45 transition hover:text-[#ef7d55]"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>

                {/* ── Day-by-day editor ── */}
                {isSelected && selected && (
                  <div className="border-t border-white/[0.05] py-3.5">
                    <div className="flex flex-wrap items-center gap-3">
                      <input
                        value={selected.name}
                        onChange={(e) => patch(selected, { name: e.target.value })}
                        className={`${inputCls} max-w-xs`}
                        placeholder="Schedule name"
                      />
                      <ReserveSelect
                        label="Rotation"
                        className="w-[190px] shrink-0"
                        value={String(selected.rotationLengthDays)}
                        options={[4, 5, 6, 7, 8, 9, 10].map((n) => ({
                          value: String(n),
                          label: n === 7 ? "7-day week" : `${n}-day rotation`,
                        }))}
                        onChange={(v) => {
                          const len = Number(v);
                          patch(selected, {
                            rotationLengthDays: len,
                            /* Shortening the rotation must not orphan activities
                               on days that no longer exist. */
                            activities: selected.activities.filter((a) => a.dayIndex < len),
                          });
                        }}
                      />
                    </div>

                    <div className="mt-3 grid gap-2">
                      {Array.from({ length: selected.rotationLengthDays }, (_, dayIdx) => {
                        const dayActivities = selected.activities
                          .filter((a) => a.dayIndex === dayIdx)
                          .sort((a, b) => (a.startTime ?? "99").localeCompare(b.startTime ?? "99"));
                        const isOpen = expandedDay === dayIdx;
                        return (
                          <div key={dayIdx} className="border-b border-white/[0.05] last:border-b-0">
                            <button
                              type="button"
                              onClick={() => setExpandedDay(isOpen ? null : dayIdx)}
                              className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
                            >
                              <div className="flex min-w-0 items-center gap-2.5">
                                <span className="w-12 shrink-0 font-mono text-[9px] uppercase tracking-[0.18em]" style={{ color: GOLD }}>
                                  {rotationDayLabel(selected, dayIdx)}
                                </span>
                                <span className="truncate text-[12px] text-white/70">
                                  {dayActivities.length === 0
                                    ? "Rest / unplanned"
                                    : dayActivities.map((a) => a.title).join(" · ")}
                                </span>
                              </div>
                              {isOpen ? <ChevronUp size={14} className="shrink-0 text-white/35" /> : <ChevronDown size={14} className="shrink-0 text-white/35" />}
                            </button>

                            {isOpen && (
                              <div className="border-t border-white/[0.05] p-3">
                                {dayActivities.map((a) => (
                                  <div key={a.id} className="mb-2.5 border-l-2 border-white/[0.08] py-1 pl-3">
                                    <div className="grid gap-2 sm:grid-cols-2">
                                      <input
                                        value={a.title}
                                        onChange={(e) => patchActivity(selected, a.id, { title: e.target.value })}
                                        className={inputCls}
                                        placeholder="Activity name"
                                      />
                                      <ReserveSelect
                                        srLabel="Activity type"
                                        className="w-[160px] shrink-0"
                                        value={a.type}
                                        options={ACTIVITY_TYPE_OPTIONS.map(([value, label]) => ({ value, label }))}
                                        onChange={(v) => patchActivity(selected, a.id, { type: v as LifestyleActivityType })}
                                      />
                                    </div>
                                    <div className="mt-2 flex flex-wrap items-center gap-2">
                                      <label className="flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.14em] text-white/35">
                                        Start
                                        <input
                                          type="time" value={a.startTime ?? ""}
                                          onChange={(e) => patchActivity(selected, a.id, { startTime: e.target.value || undefined })}
                                          className={`${fieldCls} py-1.5`}
                                        />
                                      </label>
                                      <label className="flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.14em] text-white/35">
                                        End
                                        <input
                                          type="time" value={a.endTime ?? ""}
                                          onChange={(e) => patchActivity(selected, a.id, { endTime: e.target.value || undefined })}
                                          className={`${fieldCls} py-1.5`}
                                        />
                                      </label>
                                      <label className="flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.14em] text-white/35">
                                        Min
                                        <input
                                          type="number" min={5} max={480} value={a.durationMinutes ?? ""}
                                          onChange={(e) => patchActivity(selected, a.id, { durationMinutes: e.target.value ? Number(e.target.value) : undefined })}
                                          className={`${fieldCls} w-20 py-1.5`}
                                        />
                                      </label>
                                      <ReserveSelect
                                        srLabel="Intensity"
                                        className="w-[130px] shrink-0"
                                        value={a.intensity ?? "moderate"}
                                        options={INTENSITIES.map((i) => ({
                                          value: i,
                                          /* Capitalised here rather than with a CSS
                                             transform: an uncontrolled uppercase label
                                             is one of the drift patterns being removed. */
                                          label: i.charAt(0).toUpperCase() + i.slice(1),
                                        }))}
                                        onChange={(v) => patchActivity(selected, a.id, { intensity: v as ActivityIntensity })}
                                      />
                                      <ReserveSelect
                                        srLabel="Move to another day"
                                        className="w-[150px] shrink-0"
                                        value={String(a.dayIndex)}
                                        options={Array.from({ length: selected.rotationLengthDays }, (_, i) => ({
                                          value: String(i),
                                          label: rotationDayLabel(selected, i),
                                        }))}
                                        onChange={(v) => patchActivity(selected, a.id, { dayIndex: Number(v) })}
                                      />
                                      <button
                                        type="button"
                                        onClick={() => patchActivity(selected, a.id, { fixed: !a.fixed })}
                                        className="rounded-lg border px-2.5 py-1.5 font-mono text-[8px] uppercase tracking-[0.14em]"
                                        style={a.fixed
                                          ? { borderColor: `${GOLD}45`, background: `${GOLD}10`, color: GOLD }
                                          : { borderColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.45)" }}
                                        title={a.fixed ? "Fixed: Reserve never proposes moving this" : "Flexible: Reserve may propose better placement"}
                                      >
                                        {a.fixed ? "Fixed" : "Flexible"}
                                      </button>
                                      <button
                                        type="button"
                                        title="Duplicate activity"
                                        onClick={() => patch(selected, { activities: [...selected.activities, { ...a, id: lifestyleId("act") }] })}
                                        className="rounded-lg border border-white/[0.1] p-1.5 text-white/45 transition hover:text-white/80"
                                      >
                                        <Copy size={12} />
                                      </button>
                                      <button
                                        type="button"
                                        title="Remove activity"
                                        onClick={() => patch(selected, { activities: selected.activities.filter((x) => x.id !== a.id) })}
                                        className="rounded-lg border border-white/[0.1] p-1.5 text-white/45 transition hover:text-[#ef7d55]"
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    </div>
                                    <input
                                      value={a.notes ?? ""}
                                      onChange={(e) => patchActivity(selected, a.id, { notes: e.target.value || undefined })}
                                      className={`${inputCls} mt-2`}
                                      placeholder="Notes (location, equipment, alternate time…)"
                                    />
                                  </div>
                                ))}
                                <button
                                  type="button"
                                  onClick={() => patch(selected, { activities: [...selected.activities, emptyActivity(dayIdx)] })}
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.1] px-3 py-1.5 font-mono text-[8px] uppercase tracking-[0.16em] text-white/50 transition hover:text-white/80"
                                >
                                  <Plus size={11} />Add Activity
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-3 flex items-center gap-2 text-white/30">
                      <Check size={12} style={{ color: GREEN }} />
                      <p className="font-mono text-[8px] uppercase tracking-[0.16em]">
                        Saved automatically · use the branch icon to freeze a restorable version
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Archived (restorable) ── */}
      {archived.length > 0 && (
        <div className="mt-4 border-t border-white/[0.05] pt-3.5">
          <p className="font-mono text-[8px] uppercase tracking-[0.2em] text-white/30">Archived Versions</p>
          <div className="mt-2 grid gap-1.5">
            {archived.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-2">
                <p className="truncate text-[12px] text-white/45">
                  {s.name} <span className="font-mono text-[9px] text-white/25">v{s.version}</span>
                </p>
                <button
                  type="button"
                  onClick={() => archive(s.id, false)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.1] px-2.5 py-1 font-mono text-[8px] uppercase tracking-[0.14em] text-white/50 transition hover:text-white/85"
                >
                  <ArchiveRestore size={11} />Restore
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
