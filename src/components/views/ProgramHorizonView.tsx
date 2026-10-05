"use client";

/* ════════════════════════════════════════════════════════════════════════
   PROGRAM HORIZON — every week of the block, as an instrument.

   Three regions, never more than four:

     hero      which week is running, three reads, one gold action (adjust
               the live week, return to it, or choose a protocol)
     block     the instrument: phases with their weeks, then the selected
               week's targets and its seven days as rows
     changes   only when the program was revised — one row per revision
     details   ONE closed disclosure: why Reserve selected this block, each
               phase's objective, the selected week's rationale, and the
               original projection of a revised week

   The current week stays gold; future weeks are labelled PROJECTED and
   revised weeks REVISED. No guarantees, no medical claims.
   ════════════════════════════════════════════════════════════════════════ */

import { ArrowRight, Compass } from "lucide-react";
import { useMemo, useState } from "react";

import { AdjustDayFlow } from "@/components/schedule/AdjustDayFlow";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { ReserveButton, ReserveDisclosure, ReserveSectionHeader } from "@/components/ui/reserve";
import { useAthleteDashboardStore } from "@/lib/athlete-store";
import { RESERVE, alpha } from "@/lib/design/tokens";
import { useActiveProgram } from "@/lib/hooks/useActiveProgram";
import { resolveHorizonPrimaryAction, type HorizonPrimaryAction } from "@/lib/horizon/primary-action";
import type { ProjectedProgramWeek } from "@/lib/horizon/types";
import { getProtocol } from "@/lib/protocol/library";
import { explainWithMemberSplit } from "@/lib/training/member-split-explanation";

import { ViewShell } from "./ViewShell";

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const WEEK_COLOR = {
  projected: RESERVE.slate,
  active: RESERVE.gold,
  revised: RESERVE.amber,
  completed: RESERVE.green,
  deload: RESERVE.steel,
  assessment: RESERVE.violet,
} as const;

const DISCLAIMER =
  "Projections change as your readiness, performance and schedule do. Organizational planning only — not medical guidance.";

function weekStatusLabel(week: ProjectedProgramWeek, isCurrent: boolean): string {
  if (isCurrent) return "This week";
  if (week.status === "completed") return "Completed";
  if (week.status === "revised") return "Revised";
  if (week.status === "deload") return "Deload · projected";
  if (week.status === "assessment") return "Assessment · projected";
  return "Projected";
}

/** "105% of the protocol's baseline weekly volume" reads as "105% of baseline"; anything else stays whole. */
function shortVolume(relativeLoad: string): string {
  const percent = /^\s*(\d+(?:\.\d+)?%)/.exec(relativeLoad)?.[1];
  return percent && /baseline/i.test(relativeLoad) ? `${percent} of baseline` : relativeLoad;
}

function Lines({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="space-y-1.5 text-[12.5px] leading-relaxed text-white/65">
      {items.map((t, i) => (
        <li key={i} className="flex gap-2.5">
          <span className="mt-[8px] h-1 w-1 shrink-0 rounded-full bg-white/30" aria-hidden="true" />
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

function SubHead({ children }: { children: React.ReactNode }) {
  return <p className="mb-1.5 mt-4 font-mono text-[10px] uppercase tracking-[0.16em] text-white/50 first:mt-0">{children}</p>;
}

/** A readout with no surface of its own — a row in the hero, never a tile. */
function Read({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="font-mono text-[9px] uppercase tracking-[0.22em] text-white/60">{label}</dt>
      <dd className="tnum mt-1.5 text-[14px] font-semibold leading-snug text-[#f2eee6] first-letter:uppercase">{value}</dd>
    </div>
  );
}

export function ProgramHorizonView() {
  const { horizon, currentWeek, ranking, snapshot, memberSplit } = useActiveProgram();
  const setActiveView = useAthleteDashboardStore((s) => s.setActiveView);
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [adjustOpen, setAdjustOpen] = useState(false);

  const activeWeekNumber = selectedWeek ?? currentWeek;
  const week = useMemo(
    () => horizon?.weeks.find((w) => w.weekNumber === activeWeekNumber) ?? null,
    [horizon, activeWeekNumber],
  );
  const originalWeek = useMemo(
    () => horizon?.originalWeeks.find((w) => w.weekNumber === activeWeekNumber) ?? null,
    [horizon, activeWeekNumber],
  );
  const currentPhase = useMemo(
    () => horizon?.phases.find((p) => currentWeek >= p.weekStart && currentWeek <= p.weekEnd) ?? null,
    [horizon, currentWeek],
  );

  const plan = resolveHorizonPrimaryAction({
    hasHorizon: Boolean(horizon),
    protocolName: horizon?.protocolName ?? null,
    totalWeeks: horizon?.totalWeeks ?? 0,
    currentWeek,
    viewingWeek: activeWeekNumber,
    phaseName: currentPhase?.name ?? null,
  });

  function run(action: HorizonPrimaryAction) {
    switch (action.kind) {
      case "choose-protocol":
        setActiveView("protocol-command");
        break;
      case "return-to-current-week":
        setSelectedWeek(null);
        break;
      case "adjust-day":
        setAdjustOpen(true);
        break;
      case "open-program-horizon":
        break;
    }
  }

  const missing = snapshot.evidence.missingFields.length;
  const confidence = horizon ? horizon.personalizedExplanation.confidence : snapshot.evidence.confidence;
  const confidenceValue = missing > 0 && confidence !== "high" ? `${confidence} · ${missing} missing` : confidence;

  const reads = horizon ? (
    <dl className="grid grid-cols-3 gap-4">
      <Read label="Frequency" value={`${horizon.frequency} days`} />
      <Read label="Block" value={`${horizon.totalWeeks} weeks`} />
      <Read label="Confidence" value={confidenceValue} />
    </dl>
  ) : (
    <dl className="grid grid-cols-2 gap-4">
      {/* What Reserve would run, in two reads. Choosing and its reasons live on Personal Command. */}
      <Read label="Reserve recommends" value={getProtocol(ranking.recommended.protocolId)?.name ?? ranking.recommended.protocolId} />
      <Read label="Cadence" value={`${ranking.recommended.recommendedFrequency} days · ${ranking.recommended.recommendedDurationWeeks} weeks`} />
    </dl>
  );

  const hero = (
    <GlassPanel accent={RESERVE.gold} noPad phone="flush" className="md:overflow-hidden">
      <section aria-label="Block status" data-horizon="hero" className="relative pb-5 pt-4 md:p-6 lg:px-8 lg:py-6">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-x-3 inset-y-0 max-md:[mask-image:linear-gradient(180deg,#000_55%,transparent)] md:inset-x-0"
          style={{
            background: `radial-gradient(110% 90% at 0% 15%, ${alpha(RESERVE.gold, 0.08)}, transparent 55%), radial-gradient(80% 70% at 100% 100%, ${alpha(RESERVE.steel, 0.045)}, transparent 60%)`,
          }}
        />
        <div className="relative grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)] lg:items-end lg:gap-12">
          <h2
            data-room-statement
            className="min-w-0 font-display text-[28px] font-black uppercase leading-[0.95] tracking-[-0.02em] text-[#f2eee6] [hyphens:none] sm:text-[34px] lg:text-[42px]"
          >
            {plan.statement}
          </h2>

          <div className="min-w-0">
            {reads}
            {/* The screen's one gold action (Bible §11). */}
            <div data-horizon="primary-action" className="mt-4 min-w-0 max-sm:w-full sm:inline-block">
              <ReserveButton
                tier="primary"
                size="md"
                fullWidth
                iconAfter={plan.primary.kind === "choose-protocol" ? ArrowRight : undefined}
                onClick={() => run(plan.primary)}
              >
                {plan.primary.label}
              </ReserveButton>
            </div>
          </div>
        </div>
      </section>
    </GlassPanel>
  );

  /* ── No program yet ───────────────────────────────────────────────── */
  if (!horizon) {
    return (
      <ViewShell label="Program Horizon" title="Program Horizon" icon={Compass} accentColor={RESERVE.gold} roomHero disclaimer={DISCLAIMER}>
        {hero}
      </ViewShell>
    );
  }

  /* A chosen split sets the days, so the explanation describes that split. */
  const explanation = memberSplit
    ? explainWithMemberSplit(horizon.personalizedExplanation, {
        split: memberSplit,
        programName: horizon.protocolName,
        availableDays: snapshot.evidence.missingFields.includes("availableDays") ? null : snapshot.training.availableDays,
        weekNumber: currentWeek,
      })
    : horizon.personalizedExplanation;
  const deloadWeeks = horizon.weeks.filter((w) => w.status === "deload").map((w) => `W${w.weekNumber}`);
  const assessmentWeeks = horizon.weeks.filter((w) => w.status === "assessment").map((w) => `W${w.weekNumber}`);
  const isCurrentWeek = week?.weekNumber === currentWeek;

  return (
    <ViewShell label="Program Horizon" title="Program Horizon" icon={Compass} accentColor={RESERVE.gold} roomHero disclaimer={DISCLAIMER}>
      {hero}

      {/* ── The block: phases and weeks, then the selected week ─────────── */}
      <GlassPanel noPad phone="flush" className="md:p-5">
        <section aria-label="Block" data-horizon="block">
          <ReserveSectionHeader
            label={`Block · ${horizon.totalWeeks} weeks`}
            accent={RESERVE.steel}
            action={
              <span className="tnum shrink-0 font-mono text-[9px] uppercase tracking-[0.16em] text-white/50">
                {[deloadWeeks.length ? `Deload ${deloadWeeks.join(", ")}` : null, assessmentWeeks.length ? `Assess ${assessmentWeeks.join(", ")}` : null]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            }
          />

          <div className="flex flex-wrap gap-x-6 gap-y-3" data-horizon="weeks">
            {horizon.phases.map((p) => {
              const phaseNow = currentWeek >= p.weekStart && currentWeek <= p.weekEnd;
              const weeks = horizon.weeks.filter((w) => w.weekNumber >= p.weekStart && w.weekNumber <= p.weekEnd);
              return (
                <div key={p.id} className="min-w-0">
                  <p className="truncate font-mono text-[9px] uppercase tracking-[0.18em]" style={{ color: phaseNow ? RESERVE.gold : "rgba(255,255,255,0.5)" }}>
                    {p.name}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {weeks.map((w) => {
                      const isCurrent = w.weekNumber === currentWeek;
                      const isSelected = w.weekNumber === activeWeekNumber;
                      const color = WEEK_COLOR[w.status];
                      return (
                        <button
                          key={w.weekNumber}
                          type="button"
                          onClick={() => setSelectedWeek(w.weekNumber)}
                          aria-current={isCurrent ? "true" : undefined}
                          aria-pressed={isSelected}
                          aria-label={`Week ${w.weekNumber} · ${p.name} · ${weekStatusLabel(w, isCurrent)}`}
                          className="tnum grid h-11 w-11 place-items-center rounded-xl text-[12px] transition"
                          style={{
                            background: isSelected ? alpha(color, 0.24) : alpha(color, 0.07),
                            color: isSelected ? RESERVE.ivory : alpha(color, 0.9),
                            fontWeight: isCurrent ? 800 : 500,
                          }}
                        >
                          {w.weekNumber}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {week && (
            <div className="mt-5 border-t border-white/[0.06] pt-4" data-horizon="week">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-[15px] font-semibold text-[#f2eee6]">
                  Week {week.weekNumber} · {week.phaseName}
                </h3>
                <span className="font-mono text-[9px] uppercase tracking-[0.2em]" style={{ color: isCurrentWeek ? RESERVE.gold : WEEK_COLOR[week.status] }}>
                  {weekStatusLabel(week, isCurrentWeek)}
                </span>
              </div>
              {week.status === "revised" && week.revisionReason && (
                <p className="mt-1 text-[12px] text-white/55">Revised · {week.revisionReason}</p>
              )}

              <dl className="mt-3 grid grid-cols-3 gap-4">
                <Read label="Volume" value={shortVolume(week.volumeTarget.relativeLoad)} />
                <Read label="Effort" value={week.intensityTarget.effortRange} />
                <Read
                  label="Conditioning"
                  value={week.conditioningTarget ? `${week.conditioningTarget.frequency}× · ${week.conditioningTarget.duration} min` : "None"}
                />
              </dl>

              {/* Seven days: rows on a phone, one line of columns from md. */}
              <ol aria-label={`Week ${week.weekNumber} days`} className="mt-3 divide-y divide-white/[0.05] md:grid md:grid-cols-7 md:gap-3 md:divide-y-0">
                {week.weeklyStructure.map((d, i) => (
                  <li key={i} className="flex min-h-[40px] items-center gap-3 py-2 md:block md:min-h-0 md:border-t md:border-white/[0.06] md:pt-2">
                    <span className="w-9 shrink-0 font-mono text-[9px] uppercase tracking-[0.18em] text-white/45 md:block md:w-auto">{DAY_NAMES[i]}</span>
                    <span className={`min-w-0 flex-1 truncate text-[13px] md:mt-1 md:block ${d.recovery ? "text-white/45" : "text-white/85"}`}>{d.title}</span>
                    {d.emphasis.includes("reduced-volume") && (
                      <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.18em] md:mt-0.5 md:block" style={{ color: RESERVE.amber }}>
                        Eased
                      </span>
                    )}
                  </li>
                ))}
              </ol>
              {memberSplit && (
                <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.16em] text-white/45">
                  Days · {memberSplit.architecture.name}
                </p>
              )}
            </div>
          )}
        </section>
      </GlassPanel>

      {/* ── Revisions, only when there are any ─────────────────────────── */}
      {horizon.revisions.length > 0 && (
        <GlassPanel noPad phone="flush" className="md:p-5">
          <section aria-label="Changes to this program" data-horizon="changes">
            <ReserveSectionHeader label={`Changes · ${horizon.revisions.length}`} accent={RESERVE.amber} />
            <ul className="divide-y divide-white/[0.05]">
              {horizon.revisions.map((r) => (
                <li
                  key={r.id}
                  className="py-2.5 first:pt-0"
                  title={
                    r.responseMetadata
                      ? `Response ${r.responseMetadata.responseModelVersion} · insight ${r.responseMetadata.insightIds.join(", ")} · recommendation ${r.responseMetadata.recommendationId} · revision ${r.id}`
                      : `Revision ${r.id}`
                  }
                >
                  <p className="text-[13px] text-white/80">{r.reason}</p>
                  <p className="tnum mt-0.5 text-[12px] text-white/45">
                    From week {r.effectiveWeek} · {r.source === "athlete" ? "your change" : "Reserve"} ·{" "}
                    {r.athleteConfirmed ? "confirmed" : "pending confirmation"} · {r.affectedWeeks.length} week
                    {r.affectedWeeks.length === 1 ? "" : "s"}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        </GlassPanel>
      )}

      {/* ── Details: every explanation, closed ─────────────────────────── */}
      <div data-horizon="details">
        <ReserveDisclosure summary="Details">
          {memberSplit && <SubHead>How your plan is built</SubHead>}
          <p className="text-[13px] leading-relaxed text-white/75">{explanation.summary}</p>
          <SubHead>What this split is designed to do</SubHead>
          <Lines items={explanation.whatThisSplitDoes} />
          <SubHead>Why this frequency fits</SubHead>
          <Lines items={explanation.whyThisProtocol} />
          <SubHead>How it supports your goal</SubHead>
          <Lines items={explanation.bodyCompositionStrategy} />
          <SubHead>Weekly logic</SubHead>
          <Lines items={explanation.weeklyLogic} />
          <SubHead>Recovery and nutrition</SubHead>
          <Lines items={[...explanation.recoveryStrategy, ...explanation.nutritionStrategy]} />
          <SubHead>What Reserve will watch</SubHead>
          <Lines items={explanation.whatReserveWillMonitor} />
          <SubHead>What could change it</SubHead>
          <Lines items={explanation.changeConditions} />
          {explanation.assumptions.length > 0 && (
            <>
              <SubHead>Assumptions Reserve is making</SubHead>
              <Lines items={explanation.assumptions} />
            </>
          )}
          <SubHead>Phases</SubHead>
          <Lines
            items={horizon.phases.map(
              (p) => `${p.name} · ${p.weekStart === p.weekEnd ? `week ${p.weekStart}` : `weeks ${p.weekStart}–${p.weekEnd}`} · ${p.objective}`,
            )}
          />
          {week && (
            <>
              <SubHead>Week {week.weekNumber}</SubHead>
              <Lines
                items={[
                  week.objective,
                  `Volume: ${week.volumeTarget.relativeLoad}.`,
                  ...week.athleteRationale.whyThisWeekFitsNow,
                  ...week.athleteRationale.whatThisWeekShouldDo,
                  ...(week.intensityTarget.primaryLiftExposure ? [week.intensityTarget.primaryLiftExposure] : []),
                  ...(week.conditioningTarget
                    ? [`Conditioning: ${week.conditioningTarget.type}, ${week.conditioningTarget.frequency}× this week, about ${week.conditioningTarget.duration} minutes each. ${week.conditioningTarget.intensity}.`]
                    : []),
                  `Nutrition: ${week.nutritionDemand}`,
                ]}
              />
              {week.athleteRationale.watchItems.length > 0 && (
                <>
                  <SubHead>Watch items</SubHead>
                  <Lines items={week.athleteRationale.watchItems} />
                </>
              )}
              <SubHead>Recovery</SubHead>
              <Lines items={week.recoveryTarget} />
              {week.status === "revised" && originalWeek && (
                <>
                  <SubHead>Original projection</SubHead>
                  <Lines items={originalWeek.weeklyStructure.map((d, i) => `${DAY_NAMES[i]} · ${d.title}`)} />
                </>
              )}
            </>
          )}
        </ReserveDisclosure>
      </div>

      <AdjustDayFlow open={adjustOpen} onClose={() => setAdjustOpen(false)} />
    </ViewShell>
  );
}
