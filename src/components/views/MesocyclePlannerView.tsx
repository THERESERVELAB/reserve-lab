"use client";

/* ════════════════════════════════════════════════════════════════════════
   MESOCYCLE PLANNER — the projected block, phase by phase.

   A Plan screen (program redesign spec): the hero states which week is
   actually running, gives three real readouts, and carries exactly one gold
   action. Changing a week happens in Program Horizon, so the live-week
   action routes there rather than pretending this surface can edit.

   Future weeks stay labelled as projections. Execution evidence stays
   separate from the plan — a projected week is never reported as work done.
   ════════════════════════════════════════════════════════════════════════ */

import { ArrowRight, CalendarRange, Layers, RotateCw, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";

import { GlassPanel } from "@/components/ui/GlassPanel";
import { ReserveButton, ReserveSectionHeader } from "@/components/ui/reserve";
import { useAthleteDashboardStore } from "@/lib/athlete-store";
import { RESERVE, alpha } from "@/lib/design/tokens";
import { useActiveProgram } from "@/lib/hooks/useActiveProgram";
import { resolveMesocyclePrimaryAction, type HorizonPrimaryAction } from "@/lib/horizon/primary-action";
import { getProtocol } from "@/lib/protocol/library";

import { ViewShell } from "./ViewShell";

const STATUS_COLOR = {
  projected: RESERVE.slate,
  active: RESERVE.gold,
  revised: RESERVE.amber,
  completed: RESERVE.green,
  deload: RESERVE.steel,
  assessment: RESERVE.violet,
} as const;

function List({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-white/45">{label}</p>
      <ul className="mt-1.5 space-y-1">
        {items.map((item) => (
          <li key={item} className="text-[12px] leading-5 text-white/55">
            · {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A readout with no surface of its own — a row in the hero, never a tile. */
function Read({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="font-mono text-[9px] uppercase tracking-[0.22em] text-white/60">{label}</dt>
      <dd className="mt-1.5 text-[13px] font-semibold leading-snug text-[#f2eee6]">{value}</dd>
    </div>
  );
}

const DISCLAIMER =
  "Program architecture view. It reflects the active Program Horizon and your logged execution; it is not medical guidance.";

export function MesocyclePlannerView() {
  const { horizon, resolution, assumptions, ranking } = useActiveProgram();
  const weekExecutionSummaries = useAthleteDashboardStore((state) => state.trainingSession.weekExecutionSummaries);
  const setActiveView = useAthleteDashboardStore((state) => state.setActiveView);
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);

  const weekNumber = horizon
    ? Math.max(1, Math.min(horizon.totalWeeks, selectedWeek ?? resolution?.currentWeekNumber ?? 1))
    : 1;
  const week = horizon?.weeks.find((candidate) => candidate.weekNumber === weekNumber) ?? null;
  const original = horizon?.originalWeeks.find((candidate) => candidate.weekNumber === weekNumber) ?? null;
  const phase = horizon?.phases.find((candidate) => candidate.id === week?.phaseId) ?? null;
  const revisionIds = useMemo(
    () =>
      horizon?.revisions
        .filter((revision) => revision.affectedWeeks.includes(weekNumber))
        .map((revision) => revision.id) ?? [],
    [horizon, weekNumber],
  );
  const nextDeload =
    horizon?.weeks.find(
      (candidate) => candidate.weekNumber >= (resolution?.currentWeekNumber ?? 1) && candidate.status === "deload",
    ) ?? null;
  const nextAssessment =
    horizon?.weeks.find(
      (candidate) => candidate.weekNumber >= (resolution?.currentWeekNumber ?? 1) && candidate.status === "assessment",
    ) ?? null;
  const executionSummary =
    weekExecutionSummaries.find(
      (summary) => summary.programId === horizon?.programId && summary.weekNumber === weekNumber,
    ) ?? null;

  const plan = resolveMesocyclePrimaryAction({
    hasHorizon: Boolean(horizon && resolution && week && phase && original),
    protocolName: horizon?.protocolName ?? null,
    totalWeeks: horizon?.totalWeeks ?? 0,
    currentWeek: resolution?.currentWeekNumber ?? 1,
    viewingWeek: weekNumber,
    phaseName: resolution?.currentPhaseName ?? null,
  });

  function run(action: HorizonPrimaryAction) {
    switch (action.kind) {
      case "choose-protocol":
        setActiveView("protocol-command");
        break;
      case "return-to-current-week":
        setSelectedWeek(null);
        break;
      case "open-program-horizon":
        setActiveView("program-horizon");
        break;
      case "adjust-day":
        /* This surface never edits a week; the resolver never returns it here. */
        setActiveView("program-horizon");
        break;
    }
  }

  const hero = (
    <GlassPanel accent={RESERVE.gold} noPad phone="flush" className="md:overflow-hidden">
      <section aria-label="Block status" data-mesocycle="hero" className="relative pb-5 pt-4 md:p-6 lg:px-8 lg:py-6">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-x-3 inset-y-0 max-md:[mask-image:linear-gradient(180deg,#000_55%,transparent)] md:inset-x-0"
          style={{
            background: `radial-gradient(110% 90% at 0% 15%, ${alpha(RESERVE.steel, 0.07)}, transparent 55%), radial-gradient(80% 70% at 100% 100%, ${alpha(RESERVE.gold, 0.05)}, transparent 60%)`,
          }}
        />
        <div className="relative grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)] lg:items-end lg:gap-12">
          <div className="min-w-0">
            <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-white/60">
              {horizon ? `Active block · ${horizon.protocolName}` : "No active block"}
            </p>
            <h2
              data-room-statement
              className="mt-2.5 font-display text-[28px] font-black uppercase leading-[0.95] tracking-[-0.02em] text-[#f2eee6] [hyphens:none] sm:text-[34px] lg:text-[42px]"
            >
              {plan.statement}
            </h2>
            <p className="mt-3 max-w-[58ch] text-[13px] leading-[1.55] text-white/70">{plan.reason}</p>
          </div>

          <div className="min-w-0">
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Read
                label="Phase"
                value={resolution?.currentPhaseName ?? "Evidence needed"}
              />
              <Read
                label="Next deload"
                value={nextDeload ? `Week ${nextDeload.weekNumber}` : "None projected"}
              />
              <Read
                label="Next assessment"
                value={nextAssessment ? `Week ${nextAssessment.weekNumber}` : "None projected"}
              />
            </dl>
            <p data-mesocycle="action-title" className="mt-4 text-[14px] font-semibold leading-snug text-[#f2eee6] [text-wrap:balance]">
              {plan.title}
            </p>
            {/* The screen's one gold action (Bible §11). */}
            <div data-mesocycle="primary-action" className="mt-3 min-w-0 max-sm:w-full sm:inline-block">
              <ReserveButton tier="primary" size="md" fullWidth iconAfter={ArrowRight} onClick={() => run(plan.primary)}>
                {plan.primary.label}
              </ReserveButton>
            </div>
          </div>
        </div>
      </section>
    </GlassPanel>
  );

  if (!horizon || !resolution || !week || !phase || !original) {
    return (
      <ViewShell
        label="Training Intelligence"
        title="Mesocycle Planner"
        icon={Layers}
        accentColor={RESERVE.steel}
        badge="Reserve Black"
        roomHero
        command="Your block laid out phase by phase, projected from today."
        disclaimer={DISCLAIMER}
      >
        {hero}

        {/* An unlocked member never gets a near-empty page: the block Reserve
            would build is real data it already has, shown as rows. */}
        <GlassPanel noPad phone="flush" className="md:p-5">
          <ReserveSectionHeader label="The Block Reserve Would Build" accent={RESERVE.gold} />
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Read label="Protocol" value={getProtocol(ranking.recommended.protocolId)?.name ?? ranking.recommended.protocolId} />
            <Read label="Frequency" value={`${ranking.recommended.recommendedFrequency} days a week`} />
            <Read label="Length" value={`${ranking.recommended.recommendedDurationWeeks} weeks`} />
            <Read label="Fit" value={ranking.recommended.classification.replaceAll("-", " ")} />
          </dl>
          <div className="mt-4">
            <List label="Why it fits you" items={ranking.recommended.whyItFits.slice(0, 3)} />
          </div>
        </GlassPanel>

        <GlassPanel noPad phone="flush" className="md:p-5">
          <ReserveSectionHeader label="What Activates The Planner" accent={RESERVE.steel} />
          <ul className="divide-y divide-white/[0.05]">
            {[
              "Activate a protocol in Personal Command — that generates the projected block.",
              "Complete the athlete setup fields the programming profile reads.",
              assumptions[0] ?? "Return here to inspect the real projected, revised and completed weeks.",
            ].map((line) => (
              <li key={line} className="py-2.5 text-[12.5px] leading-[1.55] text-white/60">
                {line}
              </li>
            ))}
          </ul>
        </GlassPanel>
      </ViewShell>
    );
  }

  const selectedRevision = revisionIds.length > 0 || week.status === "revised";
  const quickWeeks = [1, 4, 8, 12, horizon.totalWeeks].filter(
    (value, index, all) => value <= horizon.totalWeeks && all.indexOf(value) === index,
  );

  return (
    <ViewShell
      label="Training Intelligence"
      title="Mesocycle Planner"
      icon={Layers}
      accentColor={RESERVE.steel}
      badge="Reserve Black"
      roomHero
      command="Your block laid out phase by phase, projected from today."
      disclaimer={DISCLAIMER}
    >
      {hero}

      <GlassPanel noPad phone="flush" className="md:p-5">
        <ReserveSectionHeader
          label="Projected Block"
          accent={RESERVE.steel}
          action={
            <div className="flex flex-wrap gap-1.5">
              {quickWeeks.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSelectedWeek(value)}
                  className="min-h-[44px] px-2 font-mono text-[8px] uppercase tracking-[0.18em] text-white/50 transition hover:text-white/85"
                >
                  W{value}
                </button>
              ))}
            </div>
          }
        />
        <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6 lg:grid-cols-12">
          {horizon.weeks.map((candidate) => {
            const active = candidate.weekNumber === weekNumber;
            const revised = horizon.revisions.some((revision) => revision.affectedWeeks.includes(candidate.weekNumber));
            const status = revised ? "revised" : candidate.status;
            const color = STATUS_COLOR[status];
            return (
              <button
                key={candidate.weekNumber}
                type="button"
                onClick={() => setSelectedWeek(candidate.weekNumber)}
                title={`${candidate.phaseName} · ${status}`}
                aria-current={active ? "true" : undefined}
                className="min-h-[44px] rounded-xl px-2 py-2 text-left transition"
                style={{ background: active ? alpha(color, 0.16) : alpha(color, 0.05) }}
              >
                <span className="tnum block font-mono text-[8px] uppercase tracking-[0.16em]" style={{ color }}>
                  W{candidate.weekNumber}
                </span>
                <span className="mt-1 block truncate text-[11px] text-white/45">{candidate.phaseName}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-[12px] leading-5 text-white/40">
          Future weeks are projections. They change as your readiness, performance and schedule do.
        </p>
      </GlassPanel>

      <GlassPanel noPad phone="flush" className="md:p-5">
        <ReserveSectionHeader
          label={`Week ${week.weekNumber} · ${week.phaseName}`}
          accent={STATUS_COLOR[selectedRevision ? "revised" : week.status]}
          action={
            <span
              className="font-mono text-[8px] uppercase tracking-[0.2em]"
              style={{ color: STATUS_COLOR[selectedRevision ? "revised" : week.status] }}
            >
              {selectedRevision ? "revised" : week.status}
            </span>
          }
        />
        <p className="text-[13px] leading-[1.55] text-white/65">{week.objective}</p>

        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <Read label="Volume posture" value={week.volumeTarget.relativeLoad} />
          <Read label="Intensity posture" value={week.intensityTarget.effortRange} />
        </dl>

        <div className="mt-4 divide-y divide-white/[0.05]">
          {week.weeklyStructure.map((day, index) => (
            <div key={`${day.title}-${index}`} className="flex items-center gap-3 py-2.5">
              <span className="w-9 shrink-0 font-mono text-[8px] uppercase tracking-[0.18em] text-white/35">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][index]}
              </span>
              <span className="min-w-0 flex-1 truncate text-[12.5px] text-white/65">{day.title}</span>
              <span className="shrink-0 font-mono text-[8px] uppercase tracking-[0.18em] text-white/35">
                {day.intent}
              </span>
            </div>
          ))}
        </div>
      </GlassPanel>

      <GlassPanel noPad phone="flush" className="md:p-5">
        <ReserveSectionHeader
          label="Week Execution Evidence"
          accent={executionSummary?.status === "completed" ? RESERVE.green : RESERVE.gold}
        />
        {executionSummary ? (
          <>
            <dl className="grid grid-cols-3 gap-4">
              <Read label="Complete" value={String(executionSummary.completedSessionCount)} />
              <Read
                label="Partial"
                value={String(executionSummary.partialSessionCount + executionSummary.abandonedSessionCount)}
              />
              <Read
                label="Skipped"
                value={String(executionSummary.skippedSessionCount + executionSummary.replacedSessionCount)}
              />
            </dl>
            <p className="mt-3 text-[12.5px] font-semibold text-white/60">
              {executionSummary.completionPercent}% of planned session work recorded ·{" "}
              {executionSummary.status.replaceAll("-", " ")}
            </p>
            {executionSummary.majorDeviations.length > 0 && (
              <div className="mt-3">
                <List label="Deviation summary" items={executionSummary.majorDeviations} />
              </div>
            )}
            {executionSummary.unresolvedSessionCount > 0 && (
              <p className="mt-2 text-[12px] leading-5" style={{ color: alpha(RESERVE.gold, 0.7) }}>
                {executionSummary.unresolvedSessionCount} session
                {executionSummary.unresolvedSessionCount === 1 ? " remains" : "s remain"} unresolved. Reserve has not
                marked them skipped.
              </p>
            )}
          </>
        ) : (
          <p className="text-[12.5px] leading-5 text-white/45">
            No execution record has resolved this projected week yet. The plan stays separate from completion history.
          </p>
        )}
      </GlassPanel>

      <GlassPanel noPad phone="flush" className="md:p-5">
        <ReserveSectionHeader label="Phase Criteria" accent={RESERVE.violet} />
        <div className="grid gap-4 sm:grid-cols-2">
          <List label="Entry criteria" items={phase.entryCriteria} />
          <List label="Exit criteria" items={phase.exitCriteria} />
        </div>
        <div className="mt-4">
          <List label="Expected adaptation" items={phase.expectedAdaptation} />
        </div>
      </GlassPanel>

      <GlassPanel noPad phone="flush" className="md:p-5">
        <ReserveSectionHeader
          label="Original Versus Current"
          accent={selectedRevision ? RESERVE.amber : RESERVE.green}
          action={
            selectedRevision ? (
              <RotateCw size={12} style={{ color: RESERVE.amber }} aria-hidden="true" />
            ) : (
              <ShieldCheck size={12} style={{ color: RESERVE.green }} aria-hidden="true" />
            )
          }
        />
        {selectedRevision ? (
          <>
            <p className="text-[12.5px] leading-5 text-white/55">
              {week.revisionReason ??
                `${revisionIds.length} revision record${revisionIds.length === 1 ? "" : "s"} applies to this week.`}
            </p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <List
                label="Original projection"
                items={original.weeklyStructure.map((day, index) => `${index + 1}. ${day.title}`)}
              />
              <List
                label="Current projection"
                items={week.weeklyStructure.map((day, index) => `${index + 1}. ${day.title}`)}
              />
            </div>
          </>
        ) : (
          <p className="text-[12.5px] leading-5 text-white/45">
            This week still matches the activation-time projection. No revision has replaced it.
          </p>
        )}
      </GlassPanel>

      <GlassPanel noPad phone="flush" className="md:p-5">
        <ReserveSectionHeader label="Block Overview" accent={RESERVE.steel} />
        <div className="flex items-center gap-2">
          <CalendarRange size={13} style={{ color: RESERVE.steel }} aria-hidden="true" />
          <p className="tnum text-[12.5px] text-white/60">
            Week {resolution.currentWeekNumber} of {horizon.totalWeeks} · phase weeks {phase.weekStart}–{phase.weekEnd}
            {resolution.revisionIds.length > 0 ? ` · ${resolution.revisionIds.length} revision applied` : ""}
          </p>
        </div>
        <p className="mt-2 text-[12.5px] leading-[1.55] text-white/55">{phase.objective}</p>
      </GlassPanel>
    </ViewShell>
  );
}
