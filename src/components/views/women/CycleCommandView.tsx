"use client";

import { CircleDot } from "lucide-react";
import { useMemo, useState } from "react";

import { GlassPanel } from "@/components/ui/GlassPanel";
import { ReserveButton, ReserveSectionHeader } from "@/components/ui/reserve";
import { useAthleteDashboardStore } from "@/lib/athlete-store";
import { RESERVE } from "@/lib/design/tokens";
import {
  CYCLE_PHASE_META,
  cycleBasis,
  estimatePhaseOn,
  formatDateShort,
  groupByEstimatedPhase,
  observedIntervals,
  predictCycle,
} from "@/lib/women/cycle";
import { isRequirementMet, resolveCycleCommand } from "@/lib/women/primary-actions";
import { dayFacts, phaseDaysRead } from "@/lib/women/summaries";

import { PhysiquePhasePanel } from "@/components/women/phase-panels";

import { RecordHero } from "../records/RecordHero";
import { ViewShell } from "../ViewShell";
import { CareRouting, PhaseRows, PhaseTrack, WOMENS_ACCENT, WomensRequirements, heroAction, plural, useWomensModel, useWomensRunner, WList, WRow } from "./ui";

const SHOWN_DAYS = 14;

/**
 * CYCLE COMMAND — a Record. The member's own period starts and logged days,
 * and a calendar estimate built only from them. Newest first.
 */
export function CycleCommandView() {
  const { clock, today, womens, starts, evidence } = useWomensModel();
  const { run, sheets, editDay } = useWomensRunner(today);
  const removeCycleEntry = useAthleteDashboardStore((s) => s.removeCycleEntry);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  const plan = resolveCycleCommand(evidence);
  const basis = cycleBasis(womens.cycle);
  const prediction = useMemo(() => predictCycle(womens.cycle, clock, womens.cycleLogs), [womens.cycle, clock, womens.cycleLogs]);
  const logs = useMemo(() => [...womens.cycleLogs].sort((a, b) => b.date.localeCompare(a.date)), [womens.cycleLogs]);
  const groups = useMemo(() => groupByEstimatedPhase(womens.cycleLogs, womens.cycle, starts), [womens.cycleLogs, womens.cycle, starts]);
  const intervals = useMemo(() => observedIntervals(starts), [starts]);
  const c = evidence.cycle;
  const currentStart = starts.filter((s) => s <= today).at(-1) ?? null;

  return (
    <ViewShell
      label="Reserve Women · Record"
      title="Cycle Command"
      icon={CircleDot}
      accentColor={WOMENS_ACCENT}
      roomHero
      command="Your own dates and logged days, and a calendar estimate built from them."
      disclaimer="Phases and dates here are calendar estimates from dates you entered, not a medical prediction, a fertility window or contraceptive guidance. Review changes in your cycle with a clinician."
    >
      <RecordHero
        testId="womens-cycle"
        accent={WOMENS_ACCENT}
        eyebrow="Cycle · your record"
        statement={plan.statement}
        support={plan.support}
        reads={[
          {
            label: "Phase",
            value: c.phase ? CYCLE_PHASE_META[c.phase].label : null,
            provenance: "est.",
            detail: c.phase ? (basis.entered ? "From your dates" : "Assumed timing") : undefined,
            empty: c.entered ? "No estimate past your timing" : "Evidence needed · enter a period start",
          },
          {
            label: "Next period",
            value: prediction.nextPeriodDate ? formatDateShort(prediction.nextPeriodDate) : null,
            provenance: "est.",
            detail: prediction.daysUntilNextPeriod !== null ? `In about ${plural(prediction.daysUntilNextPeriod, "day")}` : undefined,
            empty: "Evidence needed",
          },
          {
            label: "Days logged",
            value: evidence.loggedDays > 0 ? String(evidence.loggedDays) : null,
            detail: logs[0] ? `Last ${formatDateShort(logs[0].date)}` : undefined,
            empty: "Nothing logged yet",
          },
        ]}
        action={heroAction(plan.action, run)}
        secondary={plan.secondary ? heroAction(plan.secondary, run) : undefined}
      />

      {!plan.requirements.every(isRequirementMet) && (
        <WomensRequirements
          purpose="Cycle Command keeps your period starts and the days you log, then sorts those days by the phase estimated for each date. It needs one date to start and your own words to read."
          requirements={plan.requirements}
          run={run}
        />
      )}

      {c.entered && currentStart && (
        <GlassPanel accent={WOMENS_ACCENT} phone="flush">
          <ReserveSectionHeader label="This cycle · estimate" accent={WOMENS_ACCENT} />
          <p className="tnum mb-4 max-w-[72ch] text-[13.5px] leading-[1.6] text-white/70">
            Counted from {formatDateShort(currentStart)}, the period start {starts.length > 1 ? "most recently entered or logged" : "you entered"}.{" "}
            {basis.entered
              ? `Timing you entered: ${basis.daysBetweenStarts} days between starts, ${basis.periodDays} period days.`
              : `Assumed timing: ${basis.daysBetweenStarts} days between starts and ${basis.periodDays} period days, until you enter yours.`}
          </p>
          {c.beyondEstimate ? (
            <p className="tnum text-[13.5px] leading-[1.6] text-white/70">
              Today is day {c.dayOfCycle}, past the {basis.daysBetweenStarts}-day estimate. No phase is shown until you enter your latest period start.
            </p>
          ) : (
            <PhaseTrack daysBetweenStarts={basis.daysBetweenStarts} periodDays={basis.periodDays} day={c.dayOfCycle} basisEntered={basis.entered} />
          )}
        </GlassPanel>
      )}

      <GlassPanel accent={RESERVE.slate} phone="flush">
        <ReserveSectionHeader label={`Days you logged · ${evidence.loggedDays}`} accent={RESERVE.slate} />
        {logs.length === 0 ? (
          <p className="max-w-[64ch] text-[13px] leading-[1.6] text-white/60">
            Nothing logged yet. A day holds whether it was a period day, your energy and stress, how training felt, and anything you noticed.
          </p>
        ) : (
          <WList label="Logged days, newest first">
            {logs.slice(0, SHOWN_DAYS).map((entry) => {
              const phase = estimatePhaseOn(entry.date, womens.cycle, starts).phase;
              const facts = dayFacts(entry);
              return (
                <WRow key={entry.id}>
                  <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                    <div className="min-w-0 flex-1 basis-[220px]">
                      <p className="tnum text-[14.5px] font-semibold text-[#f2eee6]">
                        {formatDateShort(entry.date)}
                        <span className="ml-2.5 font-mono text-[11px] font-normal uppercase tracking-[0.14em] text-white/50">
                          {phase ? `${CYCLE_PHASE_META[phase].label} · est.` : "No estimate for this date"}
                        </span>
                      </p>
                      {facts.length > 0 && <p className="mt-1 text-[13px] leading-[1.55] text-white/70">{facts.join(" · ")}</p>}
                      {entry.notes && <p className="mt-1 break-words text-[12.5px] leading-[1.55] text-white/50">“{entry.notes}”</p>}
                    </div>
                    <div className="flex items-center gap-1">
                      <ReserveButton tier="quiet" size="sm" onClick={() => editDay(entry.date)}>
                        Edit
                      </ReserveButton>
                      {confirmRemove === entry.id ? (
                        <ReserveButton
                          tier="danger"
                          size="sm"
                          onClick={() => {
                            removeCycleEntry(entry.id);
                            setConfirmRemove(null);
                          }}
                        >
                          Confirm Remove
                        </ReserveButton>
                      ) : (
                        <ReserveButton tier="quiet" size="sm" onClick={() => setConfirmRemove(entry.id)}>
                          Remove
                        </ReserveButton>
                      )}
                    </div>
                  </div>
                </WRow>
              );
            })}
          </WList>
        )}
        {logs.length > SHOWN_DAYS && (
          <p className="tnum mt-3 font-mono text-[11px] uppercase tracking-[0.14em] text-white/45">
            Showing the newest {SHOWN_DAYS} of {logs.length}
          </p>
        )}
      </GlassPanel>

      <GlassPanel accent={WOMENS_ACCENT} phone="flush">
        <ReserveSectionHeader label="Your days, by estimated phase" accent={WOMENS_ACCENT} />
        {c.entered ? (
          <PhaseRows label="Logged days by estimated phase" groups={groups} need={2} noun="days" read={phaseDaysRead} />
        ) : (
          <p className="max-w-[64ch] text-[13px] leading-[1.6] text-white/60">Enter a period start and your logged days are sorted here by the phase estimated for each date.</p>
        )}
      </GlassPanel>

      {starts.length > 0 && (
        <GlassPanel accent={RESERVE.slate} phone="flush">
          <ReserveSectionHeader label={`Period starts · ${starts.length}`} accent={RESERVE.slate} />
          <WList label="Period starts, newest first">
            {[...starts].reverse().map((start) => {
              const interval = intervals.find((i) => i.to === start);
              return (
                <WRow key={start}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <p className="tnum text-[14.5px] font-semibold text-[#f2eee6]">{formatDateShort(start)}</p>
                    <p className="tnum text-[12.5px] text-white/55">
                      {interval ? `${plural(interval.days, "day")} after the previous start` : "Earliest start on file"}
                    </p>
                  </div>
                </WRow>
              );
            })}
          </WList>
        </GlassPanel>
      )}

      {/* Check-ins by estimated phase — the one read from the retired Women's
          Physique room. It lives here, not in Physique Command: that command is
          Reserve Black and this read has always been core, so folding it there
          would move a capability she already has behind a paywall. */}
      <PhysiquePhasePanel />

      <CareRouting reviewLine="Review changes in your cycle, or anything that worries you, with a clinician." />
      {sheets}
    </ViewShell>
  );
}
