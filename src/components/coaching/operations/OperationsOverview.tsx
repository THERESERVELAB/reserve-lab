"use client";

/* ════════════════════════════════════════════════════════════════════════
   OPERATIONS COMMAND — the executive surface of Performance Operations.

   Not a module grid: a deliberate hierarchy. Operating Priorities lead,
   Execution Readiness and Behavioral Momentum support, the Operational
   Timeline closes. Every element is derived from the live database by
   pure functions and every row routes to the section where the decision
   is made.
   ════════════════════════════════════════════════════════════════════════ */

import { useMemo } from "react";
import { ArrowRight, CalendarClock, Signal } from "lucide-react";

import { todayKey } from "@/lib/coaching/ids";
import {
  deriveBehavioralMomentum,
  deriveExecutionReadiness,
  deriveOperatingPriorities,
  deriveOperationalTimeline,
  type OperationsSectionId,
  type ReadinessState,
} from "@/lib/coaching/operations/overview";
import { useCoachingStore } from "@/lib/coaching/store";
import { MicroLabel, Panel, PanelHeader, StatusChip, relativeTime } from "../ui";

const READINESS_TONE: Record<ReadinessState, { color: string; label: string }> = {
  ready: { color: "#6ee7b7", label: "Ready" },
  attention: { color: "#e8c87a", label: "Attention" },
  not_established: { color: "rgba(255,255,255,0.35)", label: "Not established" },
};

export function OperationsOverview({
  athleteId,
  athleteName,
  phaseLabel,
  onNavigate,
}: {
  athleteId: string;
  athleteName: string;
  phaseLabel: string;
  onNavigate: (section: OperationsSectionId) => void;
}) {
  const db = useCoachingStore((s) => s.db);
  const today = todayKey();

  const priorities = useMemo(() => deriveOperatingPriorities(db, athleteId, today), [db, athleteId, today]);
  const readiness = useMemo(() => deriveExecutionReadiness(db, athleteId, today), [db, athleteId, today]);
  const momentum = useMemo(() => deriveBehavioralMomentum(db, athleteId, today), [db, athleteId, today]);
  const timeline = useMemo(() => deriveOperationalTimeline(db, athleteId, today), [db, athleteId, today]);

  const decisions = priorities.filter((p) => p.rank <= 2).length;
  const stateLine =
    priorities.length === 0
      ? "The operation is executing as designed. Nothing needs your hand today."
      : decisions > 0
        ? `${decisions} item${decisions === 1 ? "" : "s"} need${decisions === 1 ? "s" : ""} a decision; the rest is monitoring.`
        : "No decisions pending — a few operational items are worth a look.";

  return (
    <div className="flex flex-col gap-4">
      {/* Command header */}
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-white/[0.06] pb-4">
        <div>
          <MicroLabel tone="champagne">Performance Operations · {today}</MicroLabel>
          <h2 className="type-section-title mt-1 text-[#f2eee6]">
            {athleteName.split(" ")[0]}&apos;s operation — {phaseLabel}
          </h2>
          <p className="mt-1 max-w-xl text-[11px] leading-5 text-white/45">{stateLine}</p>
        </div>
        {priorities[0] && (
          <button
            type="button"
            onClick={() => onNavigate(priorities[0].section)}
            className="border-l-2 border-[#d5b15f]/40 px-3.5 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[#d5b15f] outline-none transition-colors hover:bg-[#d5b15f]/18 focus-visible:ring-2 focus-visible:ring-[#d5b15f]/40"
          >
            {priorities[0].action}
          </button>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        {/* Operating Priorities — the dominant region */}
        <Panel glow={decisions > 0}>
          <PanelHeader
            label="What matters now"
            title="Operating Priorities"
            right={
              decisions > 0 ? (
                <StatusChip tone="champagne" pulse>{decisions} decision{decisions === 1 ? "" : "s"}</StatusChip>
              ) : (
                <StatusChip tone="green">Clear</StatusChip>
              )
            }
          />
          <div className="flex flex-col p-2">
            {priorities.length === 0 ? (
              <p className="px-3 py-8 text-center text-[11px] leading-5 text-white/40">
                Every system is either active or intentionally idle. Priorities appear here the
                moment something needs your judgment — approvals, conflicts, supply, adherence.
              </p>
            ) : (
              priorities.map((priority, index) => (
                <button
                  key={priority.id}
                  type="button"
                  onClick={() => onNavigate(priority.section)}
                  className={`group flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left outline-none transition-colors hover:bg-white/[0.03] focus-visible:ring-2 focus-visible:ring-[#d5b15f]/40 ${
                    index > 0 ? "border-t border-white/[0.04]" : ""
                  }`}
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <span
                      className="mt-0.5 font-mono text-[10px] tabular-nums"
                      style={{ color: priority.rank <= 2 ? "#d5b15f" : "rgba(255,255,255,0.3)" }}
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0">
                      <div className={`text-[11px] font-bold uppercase tracking-wide ${priority.rank <= 2 ? "text-[#d5b15f]" : "text-white/70"}`}>
                        {priority.headline}
                      </div>
                      <p className="truncate text-[10px] leading-4 text-white/45">{priority.detail}</p>
                    </div>
                  </div>
                  <span className="flex shrink-0 items-center gap-1 font-mono text-[8px] uppercase tracking-[0.14em] text-white/30 transition-colors group-hover:text-white/60">
                    {priority.action} <ArrowRight size={10} />
                  </span>
                </button>
              ))
            )}
          </div>
        </Panel>

        <div className="flex flex-col gap-4">
          {/* Execution Readiness */}
          <Panel>
            <PanelHeader label="Systems" title="Execution Readiness" />
            <div className="flex flex-col gap-1 p-3">
              {readiness.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate(item.section)}
                  className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left outline-none transition-colors hover:bg-white/[0.03] focus-visible:ring-2 focus-visible:ring-[#d5b15f]/40"
                >
                  <span className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: READINESS_TONE[item.state].color }} aria-hidden />
                    <span className="text-[10px] text-white/55">{item.label}</span>
                  </span>
                  <span className="font-mono text-[9px] uppercase tracking-wide" style={{ color: READINESS_TONE[item.state].color }}>
                    {item.value}
                  </span>
                </button>
              ))}
            </div>
          </Panel>

          {/* Behavioral Momentum */}
          <Panel>
            <PanelHeader label="Pattern" title="Behavioral Momentum" right={<Signal size={12} className="text-white/25" />} />
            <div className="flex flex-col gap-2 p-4">
              {momentum.map((note, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <span
                    className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{
                      background: note.kind === "win" ? "#6ee7b7" : note.kind === "friction" ? "#e8c87a" : "#5fb7d5",
                    }}
                    aria-hidden
                  />
                  <p className="text-[10px] leading-4 text-white/55">{note.text}</p>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>

      {/* Operational Timeline */}
      <Panel>
        <PanelHeader
          label="Ahead"
          title="Operational Timeline"
          right={<CalendarClock size={12} className="text-white/25" />}
        />
        {timeline.length === 0 ? (
          <p className="px-4 py-6 text-[10px] text-white/35">
            Nothing dated is approaching — reviews, prep sessions, grocery windows, and monitoring
            reminders will appear here.
          </p>
        ) : (
          <div className="flex flex-col p-2 sm:flex-row sm:flex-wrap sm:gap-2 sm:p-4">
            {timeline.map((entry, i) => (
              <button
                key={`${entry.kind}-${i}`}
                type="button"
                onClick={() => onNavigate(entry.section)}
                className="flex items-center gap-3 rounded-xl border border-transparent px-3 py-2 text-left outline-none transition-colors hover:border-white/[0.06] hover:bg-white/[0.02] focus-visible:ring-2 focus-visible:ring-[#d5b15f]/40 sm:border-white/[0.05] sm:bg-white/[0.015]"
              >
                <span className="font-mono text-[10px] tabular-nums text-[#d5b15f]/80">
                  {entry.date === todayKey() ? "Today" : entry.date.slice(5).replace("-", "/")}
                </span>
                <span className="text-[10px] text-white/55">{entry.label}</span>
              </button>
            ))}
          </div>
        )}
      </Panel>

      <p className="px-1 text-[9px] text-white/25">
        Derived from the live operation — every row opens the section where the decision is made.
        Updated {relativeTime(new Date().toISOString())}.
      </p>
    </div>
  );
}
