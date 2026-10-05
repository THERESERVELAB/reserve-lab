"use client";

/* ════════════════════════════════════════════════════════════════════════
   SCHEDULE INTELLIGENCE — Reserve reads the member's week back to them.

   Weekly exposure (every muscle group + pattern, side activities included),
   the deterministic audit with ranked alternatives, week-variant assignment
   (standard / travel / deload / event weeks), planned-vs-actual truth, and
   repeated-inconsistency detection. Everything here is read + propose:
   accepting a proposal creates a NEW schedule version — the original is
   never touched.
   ════════════════════════════════════════════════════════════════════════ */

import { AlertTriangle, BrainCircuit, CalendarCheck2, Info, ShieldAlert } from "lucide-react";
import { useMemo, useState } from "react";

import { useAthleteDashboardStore } from "@/lib/athlete-store";
import { MUSCLE_GROUPS, MUSCLE_GROUP_LABELS } from "@/lib/lifestyle/activity-load";
import { deriveWeeklyExposure } from "@/lib/lifestyle/exposure-engine";
import { auditSchedule } from "@/lib/lifestyle/audit-engine";
import { compareWeek, detectAdherencePatterns } from "@/lib/lifestyle/adherence-engine";
import {
  RECOMMENDATION_CATEGORY_LABELS,
  TRAINING_ACTIVITY_TYPES,
  WEEK_KIND_LABELS,
  isoWeekKey,
  lifestyleId,
  rotationDayLabel,
  type AuditSeverity,
  type LifestyleSchedule,
  type RecommendationCategory,
  type WeekKind,
} from "@/lib/lifestyle/types";
import { ReserveSelect } from "@/components/ui/reserve";
import { markActivityDay } from "@/components/ui/reserve/log-moment/recorders";
import { localDateKey } from "@/lib/dates/local-day";

const GOLD = "#d5b15f";
const TEAL = "#5fb7d5";
const GREEN = "#79e3b5";
const RED = "#ef7d55";
const AMBER = "#e8c87a";

const SEVERITY_META: Record<AuditSeverity, { color: string; icon: typeof Info; label: string }> = {
  info: { color: TEAL, icon: Info, label: "Observation" },
  attention: { color: AMBER, icon: AlertTriangle, label: "Attention" },
  conflict: { color: RED, icon: ShieldAlert, label: "Conflict" },
};

const CATEGORY_COLORS: Record<RecommendationCategory, string> = {
  "best-fit": GREEN,
  "strong-alternative": TEAL,
  specialized: GOLD,
  "limited-fit": AMBER,
  "avoid-today": RED,
};

const WEEK_KINDS = Object.keys(WEEK_KIND_LABELS) as WeekKind[];

export function ScheduleIntelligencePanel({ schedule }: { schedule: LifestyleSchedule }) {
  const templates = useAthleteDashboardStore((s) => s.customWorkoutTemplates);
  const trainingExperience = useAthleteDashboardStore((s) => s.trainingExperience);
  const scheduleProfile = useAthleteDashboardStore((s) => s.scheduleProfile);
  const sleepLogCount = useAthleteDashboardStore((s) => s.recoveryCommand.sleepLogs.length);
  const saveVersion = useAthleteDashboardStore((s) => s.saveLifestyleScheduleVersion);
  const schedules = useAthleteDashboardStore((s) => s.lifestyleSchedules);
  const weekAssignments = useAthleteDashboardStore((s) => s.weekAssignments);
  const assignWeek = useAthleteDashboardStore((s) => s.assignWeek);
  const clearWeekAssignment = useAthleteDashboardStore((s) => s.clearWeekAssignment);
  const actualWeeks = useAthleteDashboardStore((s) => s.actualWeeks);
  const recordActual = useAthleteDashboardStore((s) => s.recordActualActivity);

  const [dismissed, setDismissed] = useState<string[]>([]);
  const [acceptedNote, setAcceptedNote] = useState<string | null>(null);

  const exposure = useMemo(() => deriveWeeklyExposure(schedule, templates), [schedule, templates]);
  const audit = useMemo(
    () =>
      auditSchedule(schedule, exposure, templates, {
        trainingAge: (["beginner", "intermediate", "advanced"].includes(trainingExperience)
          ? trainingExperience
          : "intermediate") as "beginner" | "intermediate" | "advanced",
        sleepTarget: scheduleProfile.sleepTarget || null,
        hasRecoveryData: sleepLogCount > 0,
      }),
    [schedule, exposure, templates, trainingExperience, scheduleProfile.sleepTarget, sleepLogCount],
  );

  const thisWeekKey = isoWeekKey(new Date());
  const thisWeekAssignment = weekAssignments.find((w) => w.weekKey === thisWeekKey);
  const actualThisWeek = actualWeeks.find((w) => w.weekKey === thisWeekKey);
  const weekComparison = useMemo(
    () => (actualThisWeek ? compareWeek(schedule, actualThisWeek) : null),
    [schedule, actualThisWeek],
  );
  const adherence = useMemo(
    () => detectAdherencePatterns(schedule, actualWeeks),
    [schedule, actualWeeks],
  );

  const maxDirect = Math.max(1, ...MUSCLE_GROUPS.map((g) => exposure.perMuscle[g].directSets + exposure.perMuscle[g].activityLoad));
  const todayIso = localDateKey();

  return (
    <div>
      <div className="flex items-center gap-2">
        <BrainCircuit size={13} style={{ color: TEAL }} />
        <p className="font-mono text-[9px] uppercase tracking-[0.26em]" style={{ color: `${TEAL}cc` }}>
          Reserve Intelligence · {schedule.name} v{schedule.version}
        </p>
      </div>

      {/* ── Week-variant assignment ── */}
      <div className="mt-4 border-t border-white/[0.06] pt-3.5">
        <div className="flex items-center gap-2">
          <CalendarCheck2 size={12} style={{ color: GOLD }} />
          <p className="font-mono text-[8px] uppercase tracking-[0.2em] text-white/40">This Calendar Week · {thisWeekKey}</p>
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <ReserveSelect
            srLabel="Schedule for this week"
            className="min-w-[240px] flex-1"
            value={thisWeekAssignment?.scheduleId ?? ""}
            options={[
              { value: "", label: "No explicit assignment", hint: "Active schedule runs" },
              ...schedules
                .filter((s) => s.status !== "archived")
                .map((s) => ({ value: s.id, label: s.name, hint: `v${s.version}` })),
            ]}
            onChange={(v) => {
              if (!v) clearWeekAssignment(thisWeekKey);
              else assignWeek({ weekKey: thisWeekKey, scheduleId: v, kind: thisWeekAssignment?.kind ?? "standard" });
            }}
          />
          <ReserveSelect
            srLabel="Week kind"
            className="min-w-[180px]"
            value={thisWeekAssignment?.kind ?? "standard"}
            options={WEEK_KINDS.map((k) => ({ value: k, label: WEEK_KIND_LABELS[k] }))}
            onChange={(v) =>
              assignWeek({
                weekKey: thisWeekKey,
                scheduleId: thisWeekAssignment?.scheduleId ?? schedule.id,
                kind: v as WeekKind,
              })
            }
          />
        </div>
        <p className="mt-2 text-[10px] leading-4 text-white/30">
          Run a different program any week — standard, travel, deload, event, or a one-off — without touching your saved schedules.
        </p>
      </div>

      {/* ── Planned vs actual ── */}
      <div className="mt-3 border-t border-white/[0.06] pt-3.5">
        <p className="font-mono text-[8px] uppercase tracking-[0.2em] text-white/40">Planned vs Actual · This Week</p>
        <div className="mt-2.5 grid gap-1.5">
          {Array.from({ length: schedule.rotationLengthDays }, (_, dayIdx) => {
            const planned = schedule.activities.filter(
              (a) => a.dayIndex === dayIdx && TRAINING_ACTIVITY_TYPES.has(a.type),
            );
            const dayState = weekComparison?.days[dayIdx];
            return (
              <div key={dayIdx} className="flex flex-wrap items-center gap-2 border-b border-white/[0.04] py-2 last:border-b-0">
                <span className="w-12 shrink-0 font-mono text-[9px] uppercase tracking-[0.18em]" style={{ color: GOLD }}>
                  {rotationDayLabel(schedule, dayIdx)}
                </span>
                <span className="min-w-0 flex-1 truncate text-[11.5px] text-white/60">
                  {planned.length === 0 ? "—" : planned.map((p) => p.title).join(" · ")}
                </span>
                {dayState && dayState.state !== "quiet" && (
                  <span
                    className="rounded-full border px-2 py-0.5 font-mono text-[7px] uppercase tracking-[0.14em]"
                    style={{
                      borderColor: dayState.state === "matched" ? `${GREEN}45` : dayState.state === "missed" ? `${RED}45` : `${AMBER}45`,
                      color: dayState.state === "matched" ? GREEN : dayState.state === "missed" ? RED : AMBER,
                    }}
                  >
                    {dayState.state}
                  </span>
                )}
                {planned.map((p) => (
                  <span key={p.id} className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        recordActual(thisWeekKey, schedule.id, {
                          date: todayIso, plannedActivityId: p.id, type: p.type, title: p.title, status: "completed",
                        });
                        markActivityDay({ key: `${todayIso}:${p.id}`, label: p.title, status: "done" });
                      }}
                      className="rounded-lg border px-2 py-1 font-mono text-[7px] uppercase tracking-[0.12em]"
                      style={{ borderColor: `${GREEN}35`, color: GREEN }}
                      title="Mark done today"
                    >
                      Done
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        recordActual(thisWeekKey, schedule.id, {
                          date: todayIso, plannedActivityId: p.id, type: p.type, title: p.title, status: "skipped",
                        });
                        markActivityDay({ key: `${todayIso}:${p.id}`, label: p.title, status: "skipped" });
                      }}
                      className="rounded-lg border border-white/[0.1] px-2 py-1 font-mono text-[7px] uppercase tracking-[0.12em] text-white/40"
                      title="Mark skipped today"
                    >
                      Skip
                    </button>
                  </span>
                ))}
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-[10px] leading-4 text-white/30">
          {weekComparison && weekComparison.plannedCount > 0
            ? `${weekComparison.completedCount} of ${weekComparison.plannedCount} planned training blocks completed${weekComparison.unplannedCount > 0 ? ` · ${weekComparison.unplannedCount} off-plan` : ""}. Closed Reserve sessions check in automatically.`
            : "Check activities off as the week happens — closed Reserve sessions check in automatically."}
        </p>
      </div>

      {/* ── Repeated inconsistencies ── */}
      {adherence.patterns.length > 0 && (
        <div className="mt-3 border-l-2 py-1 pl-3.5" style={{ borderColor: `${AMBER}45` }}>
          <p className="font-mono text-[8px] uppercase tracking-[0.2em]" style={{ color: AMBER }}>Pattern Detected</p>
          {adherence.patterns.map((p) => (
            <div key={p.id} className="mt-2">
              <p className="text-[12.5px] font-bold text-[#f2eee6]">{p.title}</p>
              <p className="mt-0.5 text-[11px] leading-4.5 text-white/45">{p.detail}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Weekly exposure ── */}
      <div className="mt-3 border-t border-white/[0.06] pt-3.5">
        <p className="font-mono text-[8px] uppercase tracking-[0.2em] text-white/40">
          Weekly Exposure · ~{exposure.estimatedWeeklyWorkingSets} estimated working sets
        </p>
        <div className="mt-2.5 grid gap-1.5">
          {MUSCLE_GROUPS.map((g) => {
            const m = exposure.perMuscle[g];
            const width = Math.round(((m.directSets + m.activityLoad) / maxDirect) * 100);
            const flagColor = m.flag === "high" ? AMBER : m.flag === "untouched" ? RED : m.flag === "light" ? "rgba(255,255,255,0.35)" : GREEN;
            return (
              <div key={g} className="flex items-center gap-2.5">
                <span className="w-24 shrink-0 text-[10.5px] text-white/55">{MUSCLE_GROUP_LABELS[g]}</span>
                <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-white/[0.04]">
                  <div className="h-full rounded-full" style={{ width: `${width}%`, background: `linear-gradient(90deg, ${TEAL}88, ${TEAL}cc)` }} />
                </div>
                <span className="w-24 shrink-0 text-right font-mono text-[8px] uppercase tracking-[0.1em] text-white/35">
                  {m.frequency}×/wk{m.directSets > 0 ? ` · ${Math.round(m.directSets)} sets` : m.activityLoad > 0 ? " · activity" : ""}
                </span>
                <span className="w-16 shrink-0 text-right font-mono text-[8px] uppercase tracking-[0.1em]" style={{ color: flagColor }}>
                  {m.flag}{m.backToBack ? " · b2b" : ""}
                </span>
              </div>
            );
          })}
        </div>
        {exposure.patterns.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {exposure.patterns.slice(0, 8).map((p) => (
              <span key={p.pattern} className="rounded-full border border-white/[0.08] px-2.5 py-1 font-mono text-[8px] uppercase tracking-[0.12em] text-white/40">
                {p.pattern} ×{p.count}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── Audit findings ── */}
      <div className="mt-3 grid gap-2">
        {audit.findings.map((f) => {
          const meta = SEVERITY_META[f.severity];
          const Icon = meta.icon;
          return (
            <div key={f.id} className="border-l-2 py-1 pl-3.5" style={{ borderColor: `${meta.color}45` }}>
              <div className="flex items-center gap-2">
                <Icon size={12} style={{ color: meta.color }} />
                <span className="font-mono text-[8px] uppercase tracking-[0.18em]" style={{ color: meta.color }}>{meta.label}</span>
              </div>
              <p className="mt-1.5 text-[13px] font-bold text-[#f2eee6]">{f.title}</p>
              <p className="mt-1 text-[11.5px] leading-[1.5] text-white/45">{f.detail}</p>
            </div>
          );
        })}
      </div>

      {/* ── Ranked recommendations ── */}
      {audit.recommendations.filter((r) => !dismissed.includes(r.id)).length > 0 && (
        <div className="mt-3">
          <p className="font-mono text-[8px] uppercase tracking-[0.2em] text-white/40">
            Ranked Options · best fit → weakest fit · you decide
          </p>
          <div className="mt-2 grid gap-2">
            {audit.recommendations
              .filter((r) => !dismissed.includes(r.id))
              .map((r) => {
                const color = CATEGORY_COLORS[r.category];
                return (
                  <div key={r.id} className="border-t border-white/[0.06] pt-3.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[10px] font-bold" style={{ color }}>#{r.rank}</span>
                      <span className="rounded-full border px-2 py-0.5 font-mono text-[7px] uppercase tracking-[0.16em]" style={{ borderColor: `${color}45`, background: `${color}10`, color }}>
                        {RECOMMENDATION_CATEGORY_LABELS[r.category]}
                      </span>
                      <p className="w-full text-[13px] font-bold text-[#f2eee6] sm:w-auto sm:flex-1">{r.candidate.title}</p>
                    </div>
                    <p className="mt-1.5 text-[11.5px] leading-[1.5] text-white/45">{r.candidate.detail}</p>
                    {r.reasons.length > 0 && (
                      <ul className="mt-2 grid gap-1">
                        {r.reasons.map((reason) => (
                          <li key={reason} className="flex items-start gap-1.5 text-[10.5px] leading-4 text-white/45">
                            <span className="mt-0.5 shrink-0" style={{ color: GREEN }}>+</span>{reason}
                          </li>
                        ))}
                      </ul>
                    )}
                    {r.tradeoffs.length > 0 && (
                      <ul className="mt-1 grid gap-1">
                        {r.tradeoffs.map((t) => (
                          <li key={t} className="flex items-start gap-1.5 text-[10.5px] leading-4 text-white/40">
                            <span className="mt-0.5 shrink-0" style={{ color: AMBER }}>−</span>{t}
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      {r.candidate.action?.kind === "swap-days" && (
                        <button
                          type="button"
                          onClick={() => {
                            const { dayA, dayB } = r.candidate.action!;
                            saveVersion({
                              ...schedule,
                              name: schedule.name,
                              activities: schedule.activities.map((a) =>
                                a.dayIndex === dayA ? { ...a, dayIndex: dayB, id: lifestyleId("act") }
                                : a.dayIndex === dayB ? { ...a, dayIndex: dayA, id: lifestyleId("act") }
                                : { ...a, id: lifestyleId("act") },
                              ),
                            });
                            setAcceptedNote(`Saved as a new version of “${schedule.name}” — your original is untouched. Select the new version to review or activate it.`);
                            setDismissed((d) => [...d, r.id]);
                          }}
                          className="rounded-xl border px-3.5 py-2 font-mono text-[9px] font-bold uppercase tracking-[0.16em]"
                          style={{ borderColor: `${GREEN}45`, background: `${GREEN}12`, color: GREEN }}
                        >
                          Accept as New Version
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setDismissed((d) => [...d, r.id])}
                        className="rounded-xl border border-white/[0.12] px-3.5 py-2 font-mono text-[9px] uppercase tracking-[0.16em] text-white/55 transition hover:bg-white/[0.04]"
                      >
                        Keep My Original
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {acceptedNote && (
        <div className="mt-3 border-l-2 py-1 pl-3.5" style={{ borderColor: `${GREEN}45` }}>
          <p className="text-[11.5px] leading-[1.5]" style={{ color: GREEN }}>{acceptedNote}</p>
        </div>
      )}

      <p className="mt-4 text-[9.5px] leading-4 text-white/25">
        Organizational analysis over your own schedule data — estimates, not measurements. Reserve proposes; you decide.
        Nothing here changes your schedule without an explicit action, and accepted changes always land as a new version.
      </p>
    </div>
  );
}
