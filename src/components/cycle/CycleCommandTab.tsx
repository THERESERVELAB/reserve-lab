"use client";

import { CalendarClock, ClipboardCopy, LifeBuoy, Printer, ScanSearch, Trash2 } from "lucide-react";
import { useCallback, useId, useMemo, useState } from "react";

import { OwnerPendingReviewNote } from "@/components/authz/OwnerResearchMode";
import { CycleReviewView } from "@/components/cycle-review/CycleReviewView";
import { CareOptions } from "@/components/safety/CareOptions";
import { EscalationList } from "@/components/safety/EscalationList";
import { usePrintSummary } from "@/components/safety/PrintableSummary";
import { RedFlagCheck } from "@/components/safety/RedFlagCheck";
import { RiskProfileCard } from "@/components/safety/RiskProfileCard";
import { SafetyAcknowledgementGate } from "@/components/safety/SafetyAcknowledgementGate";
import { SupportOptionsSheet } from "@/components/safety/SupportOptionsSheet";
import { useClientNow } from "@/components/safety/useClientNow";
import { compoundIdentity, useSafetyContext, type SafetyContext } from "@/components/safety/useSafetyContext";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { ReserveButton, ReserveDisclosure, ReserveLoading, ReserveNotice } from "@/components/ui/reserve";
import { useAthleteDashboardStore, type EnhancementEntry } from "@/lib/athlete-store";
import { buildCompoundRiskBrief } from "@/lib/compound-intelligence/risk-profiles";
import { supportAreasForBrief, type SupportArea } from "@/lib/compound-intelligence/support-options";
import {
  CYCLE_MAX_WEEKS,
  CYCLE_PHASE_LABEL,
  dateKeyOf,
  isDateKey,
  validateCycleInput,
  type CheckpointStatus,
  type CycleEndReason,
  type CycleInput,
  type CyclePeriod,
  type CycleState,
} from "@/lib/cycle/cycle-period";
import { RESERVE, alpha } from "@/lib/design/tokens";
import { buildClinicianSummaryDocument } from "@/lib/safety/clinician-summary";
import { renderSummaryText, summaryFileTitle } from "@/lib/safety/summary-document";

/* ════════════════════════════════════════════════════════════════════════
   CYCLE & SAFETY — the member's own plan, and everything Reserve can do to
   keep them safe inside it.

     1. Escalations first — anything that needs a human now
     2. The plan: week X of Y, the end date the member committed to
     3. Bloodwork checkpoints the member or clinician chose
     4. A symptom check that routes to 911 / 988 / same-day care
     5. Known risks for the compounds in the cycle, with sources — and, for
        each affected area, the support options that exist and what the
        evidence honestly shows. The member chooses; nothing is ranked.
     6. A summary to hand to a clinician

   Nothing here suggests a compound, an amount, a length or whether to
   continue. The plan is entered by the member, never proposed.
   ════════════════════════════════════════════════════════════════════════ */

const INPUT =
  "mt-1 min-h-[44px] w-full rounded-[12px] border border-white/[0.1] bg-black/30 px-3 text-[16px] text-[#f2eee6] outline-none placeholder:text-white/25 focus:border-[#5fb7d5]/60 sm:text-[13px]";

function formatDay(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function Kicker({ children, color = "rgba(255,255,255,0.4)" }: { children: React.ReactNode; color?: string }) {
  return (
    <p className="font-mono text-[9px] uppercase tracking-[0.22em]" style={{ color }}>
      {children}
    </p>
  );
}

export function CycleCommandTab() {
  const now = useClientNow();
  if (!now) return <ReserveLoading label="Loading cycle" />;
  return (
    <SafetyAcknowledgementGate>
      <CycleCommand now={now} />
    </SafetyAcknowledgementGate>
  );
}

function CycleCommand({ now }: { now: Date }) {
  const ctx = useSafetyContext(now);
  const cyclePeriods = useAthleteDashboardStore((s) => s.cyclePeriods);
  const [editing, setEditing] = useState<CyclePeriod | "new" | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const state = ctx.cycleState;

  /* Risks for the compounds in the cycle; with no cycle, for everything active. */
  const riskBrief = useMemo(() => {
    const source = state && state.cycle.compoundIds.length > 0
      ? ctx.compounds.filter((entry) => state.cycle.compoundIds.includes(entry.id))
      : ctx.activeCompounds;
    return buildCompoundRiskBrief(source.map(compoundIdentity));
  }, [ctx.compounds, ctx.activeCompounds, state]);

  const supportAreas = useMemo(() => new Set(supportAreasForBrief(riskBrief).map((entry) => entry.area)), [riskBrief]);
  const [supportArea, setSupportArea] = useState<SupportArea | null>(null);
  const closeSupport = useCallback(() => setSupportArea(null), []);

  const pastCycles = cyclePeriods.filter((cycle) => cycle.endedOn);

  if (reviewing && state) {
    return <CycleReviewView now={now} onBack={() => setReviewing(false)} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <OwnerPendingReviewNote />
      <EscalationList items={ctx.escalation} />

      {editing ? (
        <CycleForm
          initial={editing === "new" ? null : editing}
          compounds={ctx.compounds}
          today={dateKeyOf(now)}
          onDone={() => setEditing(null)}
        />
      ) : state ? (
        <CycleOverview state={state} onEdit={() => setEditing(state.cycle)} onReview={() => setReviewing(true)} today={dateKeyOf(now)} />
      ) : (
        <NoCycle onPlan={() => setEditing("new")} />
      )}

      {state && !editing && <CheckpointsPanel state={state} today={dateKeyOf(now)} />}

      <RedFlagCheck relevant={riskBrief.redFlags} />

      <section aria-label="Known compound risks" className="flex flex-col gap-3">
        <div className="px-1">
          <Kicker color={alpha(RESERVE.steel, 0.85)}>What Reserve knows</Kicker>
          <h2 className="mt-1 text-[17px] font-bold" style={{ color: RESERVE.ivory }}>
            Known risks for {state && state.cycle.compoundIds.length > 0 ? "this cycle" : "your active compounds"}
          </h2>
          <p className="mt-1 max-w-[640px] text-[12.5px] leading-[1.55] text-white/55">
            From public scientific statements, FDA prescribing information and NIH resources. Reserve never suggests amounts, timing or combinations.
          </p>
        </div>
        {riskBrief.profiles.length === 0 && riskBrief.unprofiledNames.length === 0 ? (
          <GlassPanel accent={RESERVE.slate}>
            <p className="text-[12.5px] text-white/55">
              Add compounds in Registry{state ? " and link them to your cycle" : ""} to see what they are known to affect.
            </p>
          </GlassPanel>
        ) : (
          riskBrief.profiles.map(({ profile, compoundNames }) => (
            <RiskProfileCard
              key={profile.key}
              profile={profile}
              compoundNames={compoundNames}
              supportAreas={supportAreas}
              onSupport={setSupportArea}
            />
          ))
        )}
        {supportAreas.has("general") && (
          <GlassPanel accent={RESERVE.slate}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-[14px] font-bold" style={{ color: RESERVE.ivory }}>
                  General nutrition
                </h3>
                <p className="mt-0.5 text-[12px] text-white/50">Options that cover basic nutrition gaps, with what the research shows.</p>
              </div>
              <ReserveButton tier="quiet" size="sm" icon={LifeBuoy} onClick={() => setSupportArea("general")}>
                Support options
              </ReserveButton>
            </div>
          </GlassPanel>
        )}
        <SupportOptionsSheet area={supportArea} brief={riskBrief} onClose={closeSupport} />
        {riskBrief.unprofiledNames.length > 0 && (
          <ReserveNotice tone="stale" title="No profile yet">
            <p>
              Reserve doesn&apos;t have a risk profile for {riskBrief.unprofiledNames.join(", ")} yet. A pharmacist, a telehealth visit or a clinician can go through known risks with you.
            </p>
          </ReserveNotice>
        )}
      </section>

      <GlassPanel accent={RESERVE.steel}>
        <CareOptions />
      </GlassPanel>

      <ClinicianSummaryPanel ctx={ctx} now={now} />

      {pastCycles.length > 0 && <PastCycles cycles={pastCycles} />}
    </div>
  );
}

/* ─── No cycle ────────────────────────────────────────────────────────── */

function NoCycle({ onPlan }: { onPlan: () => void }) {
  return (
    <GlassPanel accent={RESERVE.gold}>
      <div className="flex flex-col gap-3">
        <div>
          <Kicker color={alpha(RESERVE.gold, 0.85)}>Cycle</Kicker>
          <h2 className="mt-1 text-[17px] font-bold" style={{ color: RESERVE.ivory }}>
            Tell Reserve about your plan
          </h2>
          <p className="mt-1.5 max-w-[620px] text-[12.5px] leading-[1.6] text-white/60">
            Add when it starts, how many weeks you intend to run it, and which compounds from your log belong to it. Reserve tracks where you are, notices if you go past your own end date, and keeps your labs and clinician in the loop.
          </p>
        </div>
        <div>
          <ReserveButton tier="primary" icon={CalendarClock} onClick={onPlan}>
            Plan a cycle
          </ReserveButton>
        </div>
      </div>
    </GlassPanel>
  );
}

/* ─── Form ────────────────────────────────────────────────────────────── */

function CycleForm({
  initial,
  compounds,
  today,
  onDone,
}: {
  initial: CyclePeriod | null;
  compounds: EnhancementEntry[];
  today: string;
  onDone: () => void;
}) {
  const addCyclePeriod = useAthleteDashboardStore((s) => s.addCyclePeriod);
  const updateCyclePeriod = useAthleteDashboardStore((s) => s.updateCyclePeriod);
  const [name, setName] = useState(initial?.name ?? "");
  const [startDate, setStartDate] = useState(initial?.startDate ?? today);
  const [weeks, setWeeks] = useState(initial ? String(initial.plannedWeeks) : "");
  const [compoundIds, setCompoundIds] = useState<string[]>(initial?.compoundIds ?? []);
  const [clinicianOversight, setClinicianOversight] = useState(initial?.clinicianOversight ?? false);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const clinicianId = useId();

  const toggleCompound = (id: string) =>
    setCompoundIds((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));

  const save = () => {
    const input: CycleInput = {
      name,
      startDate,
      plannedWeeks: Number(weeks),
      compoundIds,
      clinicianOversight,
      notes,
    };
    const problem = validateCycleInput(input);
    if (problem) {
      setError(problem);
      return;
    }
    if (initial) updateCyclePeriod(initial.id, input);
    else addCyclePeriod(input);
    onDone();
  };

  return (
    <GlassPanel accent={RESERVE.gold}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div>
          <Kicker color={alpha(RESERVE.gold, 0.85)}>{initial ? "Edit plan" : "New plan"}</Kicker>
          <h2 className="mt-1 text-[17px] font-bold" style={{ color: RESERVE.ivory }}>
            Your cycle, as you plan it
          </h2>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block sm:col-span-3">
            <span className="text-[11.5px] text-white/50">Name</span>
            <input className={INPUT} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="e.g. Fall cycle" />
          </label>
          <label className="block">
            <span className="text-[11.5px] text-white/50">Start date</span>
            <input className={INPUT} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </label>
          <label className="block">
            <span className="text-[11.5px] text-white/50">Planned length (weeks)</span>
            <input
              className={INPUT}
              type="number"
              inputMode="numeric"
              min={1}
              max={CYCLE_MAX_WEEKS}
              step={1}
              value={weeks}
              onChange={(e) => setWeeks(e.target.value)}
            />
          </label>
        </div>

        <fieldset>
          <legend className="text-[11.5px] text-white/50">Compounds in this cycle</legend>
          {compounds.length === 0 ? (
            <p className="mt-1.5 text-[12px] text-white/45">Your compound log is empty. Add compounds in Registry — you can link them to this plan later.</p>
          ) : (
            <div className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
              {compounds.map((entry) => {
                const checked = compoundIds.includes(entry.id);
                return (
                  <label
                    key={entry.id}
                    className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-[12px] px-3 py-2 text-[12.5px]"
                    style={{
                      border: `1px solid ${checked ? alpha(RESERVE.gold, 0.5) : "rgba(255,255,255,0.07)"}`,
                      background: checked ? alpha(RESERVE.gold, 0.08) : "rgba(255,255,255,0.02)",
                      color: checked ? RESERVE.ivory : "rgba(255,255,255,0.7)",
                    }}
                  >
                    <input type="checkbox" checked={checked} onChange={() => toggleCompound(entry.id)} className="h-4 w-4 shrink-0 accent-[#d5b15f]" />
                    <span className="min-w-0 flex-1">{compoundIdentity(entry).name}</span>
                    {!entry.isActive && <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-white/35">Inactive</span>}
                  </label>
                );
              })}
            </div>
          )}
        </fieldset>

        <label htmlFor={clinicianId} className="flex min-h-[44px] cursor-pointer items-center gap-3 text-[13px] text-white/75">
          <input
            id={clinicianId}
            type="checkbox"
            checked={clinicianOversight}
            onChange={(e) => setClinicianOversight(e.target.checked)}
            className="h-5 w-5 shrink-0 accent-[#5fb7d5]"
          />
          A clinician is overseeing this cycle
        </label>

        <label className="block">
          <span className="text-[11.5px] text-white/50">Notes (optional)</span>
          <input className={INPUT} value={notes} maxLength={200} onChange={(e) => setNotes(e.target.value)} />
        </label>

        {error && (
          <p role="alert" className="text-[12.5px]" style={{ color: RESERVE.red }}>
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <ReserveButton tier="primary" type="submit">
            Save plan
          </ReserveButton>
          <ReserveButton tier="quiet" onClick={onDone}>
            Cancel
          </ReserveButton>
        </div>
      </form>
    </GlassPanel>
  );
}

/* ─── Overview ────────────────────────────────────────────────────────── */

function phaseLine(state: CycleState): string {
  switch (state.phase) {
    case "upcoming":
      return `Starts ${formatDay(state.cycle.startDate)} · in ${state.daysUntilStart} ${state.daysUntilStart === 1 ? "day" : "days"}`;
    case "on-cycle":
      return state.daysRemaining === 0
        ? `Your planned end is today (${formatDay(state.plannedEnd)})`
        : `${state.daysRemaining} ${state.daysRemaining === 1 ? "day" : "days"} to your planned end on ${formatDay(state.plannedEnd)}`;
    case "past-planned-end":
      return `${state.daysPastPlannedEnd} ${state.daysPastPlannedEnd === 1 ? "day" : "days"} past your planned end on ${formatDay(state.plannedEnd)}`;
    case "ended":
      return `Ended ${state.cycle.endedOn ? formatDay(state.cycle.endedOn) : ""}`;
  }
}

function CycleOverview({ state, onEdit, onReview, today }: { state: CycleState; onEdit: () => void; onReview: () => void; today: string }) {
  const endCyclePeriod = useAthleteDashboardStore((s) => s.endCyclePeriod);
  const updateCyclePeriod = useAthleteDashboardStore((s) => s.updateCyclePeriod);
  const removeCyclePeriod = useAthleteDashboardStore((s) => s.removeCyclePeriod);
  const [ending, setEnding] = useState(false);
  const clinicianId = useId();
  const { cycle } = state;
  const pastEnd = state.phase === "past-planned-end";

  const end = (reason: CycleEndReason) => {
    endCyclePeriod(cycle.id, reason, today);
    setEnding(false);
  };

  return (
    <GlassPanel accent={pastEnd ? RESERVE.amber : RESERVE.gold}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <Kicker color={alpha(pastEnd ? RESERVE.amber : RESERVE.gold, 0.9)}>{CYCLE_PHASE_LABEL[state.phase]}</Kicker>
            <h2 className="mt-1 text-[20px] font-bold leading-tight" style={{ color: RESERVE.ivory }}>
              {cycle.name}
            </h2>
            <p className="mt-1 text-[12.5px] text-white/55">{phaseLine(state)}</p>
          </div>
          {state.phase !== "upcoming" && (
            <p className="tnum text-right">
              <span className="block font-mono text-[9px] uppercase tracking-[0.2em] text-white/40">Week</span>
              <span className="text-[28px] font-bold leading-none" style={{ color: pastEnd ? RESERVE.amber : RESERVE.gold }}>
                {state.weekNumber}
              </span>
              <span className="text-[14px] text-white/45"> / {state.totalWeeks}</span>
            </p>
          )}
        </div>

        <div
          className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]"
          role="progressbar"
          aria-label="Progress through planned cycle"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(state.progress * 100)}
        >
          <div className="h-full rounded-full" style={{ width: `${Math.round(state.progress * 100)}%`, background: pastEnd ? RESERVE.amber : RESERVE.gold }} />
        </div>
        <p className="tnum -mt-2 font-mono text-[9px] uppercase tracking-[0.16em] text-white/35">
          {formatDay(cycle.startDate)} → {formatDay(state.plannedEnd)} · {state.totalWeeks} weeks planned
        </p>

        <div>
          <Kicker>Compounds in this cycle</Kicker>
          {state.compounds.length > 0 ? (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {state.compounds.map((compound) => {
                const flagged = state.activePastEndNames.includes(compound.name);
                return (
                  <span
                    key={compound.id}
                    className="rounded-[8px] px-2 py-1 text-[11.5px]"
                    style={{
                      border: `1px solid ${flagged ? alpha(RESERVE.amber, 0.45) : "rgba(255,255,255,0.08)"}`,
                      color: flagged ? RESERVE.amber : "rgba(255,255,255,0.7)",
                    }}
                  >
                    {compound.name}
                    {compound.pausedAt ? " · paused" : !compound.isActive ? " · inactive" : ""}
                  </span>
                );
              })}
            </div>
          ) : (
            <p className="mt-1 text-[12px] text-white/45">No compounds linked yet. Edit the plan to link them.</p>
          )}
          {state.missingCompoundIds.length > 0 && (
            <p className="mt-1.5 text-[11.5px] text-white/45">
              {state.missingCompoundIds.length} linked {state.missingCompoundIds.length === 1 ? "compound was" : "compounds were"} removed from your log.
            </p>
          )}
        </div>

        <label htmlFor={clinicianId} className="flex min-h-[44px] cursor-pointer items-center gap-3 text-[13px] text-white/75">
          <input
            id={clinicianId}
            type="checkbox"
            checked={cycle.clinicianOversight}
            onChange={(e) => updateCyclePeriod(cycle.id, { clinicianOversight: e.target.checked })}
            className="h-5 w-5 shrink-0 accent-[#5fb7d5]"
          />
          A clinician is overseeing this cycle
        </label>

        {ending ? (
          <div className="flex flex-col gap-2 rounded-[14px] border border-white/[0.08] p-3">
            <p className="text-[12.5px] text-white/70">{state.phase === "upcoming" ? "Cancel this plan?" : "How did this cycle end?"}</p>
            <div className="flex flex-wrap gap-2">
              {state.phase === "upcoming" ? (
                <ReserveButton tier="danger" size="sm" onClick={() => removeCyclePeriod(cycle.id)}>
                  Delete plan
                </ReserveButton>
              ) : (
                <>
                  <ReserveButton tier="secondary" size="sm" onClick={() => end("completed")}>
                    Finished as planned
                  </ReserveButton>
                  <ReserveButton tier="secondary" size="sm" onClick={() => end("ended-early")}>
                    Ended early
                  </ReserveButton>
                </>
              )}
              <ReserveButton tier="quiet" size="sm" onClick={() => setEnding(false)}>
                Back
              </ReserveButton>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {/* Secondary: the room's one gold action is the hero's, and two golds is no hierarchy at all. */}
            <ReserveButton tier="secondary" icon={ScanSearch} onClick={onReview}>
              Review my cycle
            </ReserveButton>
            <ReserveButton tier="secondary" size="sm" onClick={onEdit}>
              Edit plan
            </ReserveButton>
            <ReserveButton tier="secondary" size="sm" onClick={() => setEnding(true)}>
              {state.phase === "upcoming" ? "Cancel plan" : "End cycle"}
            </ReserveButton>
          </div>
        )}
      </div>
    </GlassPanel>
  );
}

/* ─── Checkpoints ─────────────────────────────────────────────────────── */

const CHECKPOINT_STATUS: Record<CheckpointStatus, { label: (days: number, labDate?: string) => string; color: string }> = {
  met: { label: (_d, labDate) => `Lab logged ${labDate ? formatDay(labDate) : ""}`, color: RESERVE.green },
  upcoming: { label: (days) => `In ${days} ${days === 1 ? "day" : "days"}`, color: RESERVE.slate },
  due: { label: () => "Due now", color: RESERVE.amber },
  overdue: { label: () => "Overdue", color: RESERVE.amber },
};

function CheckpointsPanel({ state, today }: { state: CycleState; today: string }) {
  const addCycleCheckpoint = useAthleteDashboardStore((s) => s.addCycleCheckpoint);
  const removeCycleCheckpoint = useAthleteDashboardStore((s) => s.removeCycleCheckpoint);
  const [date, setDate] = useState(today);
  const [label, setLabel] = useState("");
  const [setBy, setSetBy] = useState<"member" | "clinician">("member");

  const add = () => {
    addCycleCheckpoint(state.cycle.id, { date, label, setBy });
    setLabel("");
  };

  return (
    <GlassPanel accent={RESERVE.steel}>
      <div className="flex flex-col gap-3">
        <div>
          <Kicker color={alpha(RESERVE.steel, 0.85)}>Bloodwork checkpoints</Kicker>
          <p className="mt-1 max-w-[620px] text-[12.5px] leading-[1.55] text-white/55">
            Add the lab dates you or your clinician chose. Reserve matches each one to labs you log from a week before to two weeks after.
          </p>
        </div>

        {state.checkpoints.length > 0 && (
          <ul className="flex flex-col divide-y divide-white/[0.06]">
            {state.checkpoints.map((checkpoint) => {
              const status = CHECKPOINT_STATUS[checkpoint.status];
              return (
                <li key={checkpoint.id} className="flex min-h-[48px] items-center gap-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold" style={{ color: RESERVE.ivory }}>
                      {checkpoint.label}
                    </p>
                    <p className="text-[11.5px] text-white/45">
                      {formatDay(checkpoint.date)} · set by {checkpoint.setBy === "clinician" ? "your clinician" : "you"}
                    </p>
                  </div>
                  <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.14em]" style={{ color: status.color }}>
                    {status.label(checkpoint.daysFromToday, checkpoint.metByLabDate)}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeCycleCheckpoint(state.cycle.id, checkpoint.id)}
                    aria-label={`Remove ${checkpoint.label} checkpoint`}
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px] text-white/35 transition hover:text-white/75"
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <div className="grid gap-2 sm:grid-cols-[auto_1fr]">
          <label className="block">
            <span className="text-[11.5px] text-white/50">Date</span>
            <input className={INPUT} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="block">
            <span className="text-[11.5px] text-white/50">Label</span>
            <input className={INPUT} value={label} maxLength={40} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Mid-cycle labs" />
          </label>
        </div>
        {/* Two plain chips rather than a segmented control: inside a card, the control's own
            frame reads as a second card, and the room allows only one. */}
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Who set this checkpoint">
          {([
            { value: "member", label: "Set by me" },
            { value: "clinician", label: "Set by my clinician" },
          ] as const).map((option) => {
            const on = setBy === option.value;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={on}
                onClick={() => setSetBy(option.value)}
                className="min-h-[40px] rounded-full px-3.5 text-[12.5px] transition"
                style={{
                  background: on ? alpha(RESERVE.steel, 0.14) : "rgba(255,255,255,0.03)",
                  boxShadow: `inset 0 0 0 1px ${on ? alpha(RESERVE.steel, 0.45) : "rgba(255,255,255,0.08)"}`,
                  color: on ? RESERVE.ivory : "rgba(255,255,255,0.7)",
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        <div>
          {isDateKey(date) ? (
            <ReserveButton tier="secondary" size="sm" onClick={add}>
              Add checkpoint
            </ReserveButton>
          ) : (
            <ReserveButton tier="secondary" size="sm" disabled disabledReason="Choose a date first.">
              Add checkpoint
            </ReserveButton>
          )}
        </div>
      </div>
    </GlassPanel>
  );
}

/* ─── Clinician summary ───────────────────────────────────────────────── */

function ClinicianSummaryPanel({ ctx, now }: { ctx: SafetyContext; now: Date }) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed" | "printing">("idle");
  const { print, printElement } = usePrintSummary();
  const summary = useMemo(
    () =>
      buildClinicianSummaryDocument({
        generatedAt: now,
        cycleState: ctx.cycleState,
        compounds: ctx.compounds.map((entry) => ({
          name: compoundIdentity(entry).name,
          officialName: compoundIdentity(entry).officialName,
          compoundClass: compoundIdentity(entry).compoundClass,
          route: entry.route,
          amount: entry.doseAmount,
          unit: entry.doseUnit,
          frequency: entry.frequency,
          startDate: entry.startDate,
          isActive: entry.isActive && !entry.pausedAt,
        })),
        labBrief: ctx.hasLabs ? ctx.labBrief : null,
        redFlagReports: ctx.redFlagReports,
      }),
    [ctx, now],
  );
  const text = useMemo(() => renderSummaryText(summary), [summary]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  };

  return (
    <GlassPanel accent={RESERVE.steel}>
      <div className="flex flex-col gap-3">
        <div>
          <Kicker color={alpha(RESERVE.steel, 0.85)}>For any visit</Kicker>
          <h3 className="mt-1 text-[15px] font-bold" style={{ color: RESERVE.ivory }}>
            Share your records
          </h3>
          <p className="mt-1 max-w-[620px] text-[12.5px] leading-[1.55] text-white/55">
            A plain-text summary for any visit: your plan, compounds, what is commonly watched with your latest results, questions to ask, flagged labs and symptoms. It stays on this device until you paste or print it.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ReserveButton tier="secondary" size="sm" icon={ClipboardCopy} onClick={copy}>
            Copy summary
          </ReserveButton>
          <ReserveButton
            tier="secondary"
            size="sm"
            icon={Printer}
            onClick={() => {
              print(summary, summaryFileTitle("Reserve health record summary", now));
              setCopyState("printing");
            }}
          >
            Print or save as PDF
          </ReserveButton>
          <span role="status" className="text-[12px]" style={{ color: copyState === "failed" ? RESERVE.amber : RESERVE.green }}>
            {copyState === "copied"
              ? "Copied"
              : copyState === "printing"
                ? "To keep a file, choose Save as PDF in the print dialog."
                : copyState === "failed"
                  ? "Copying isn't available here — select the preview text instead."
                  : ""}
          </span>
        </div>
        <ReserveDisclosure summary="Preview" accent={RESERVE.steel}>
          <pre className="max-h-[360px] overflow-auto whitespace-pre-wrap rounded-[12px] bg-black/30 p-3 font-mono text-[11px] leading-[1.6] text-white/65">
            {text}
          </pre>
        </ReserveDisclosure>
      </div>
      {printElement}
    </GlassPanel>
  );
}

/* ─── History ─────────────────────────────────────────────────────────── */

function PastCycles({ cycles }: { cycles: CyclePeriod[] }) {
  const reopenCyclePeriod = useAthleteDashboardStore((s) => s.reopenCyclePeriod);
  const removeCyclePeriod = useAthleteDashboardStore((s) => s.removeCyclePeriod);
  return (
    <GlassPanel accent={RESERVE.slate}>
      <ReserveDisclosure summary={`Past cycles (${cycles.length})`} accent={RESERVE.slate}>
        <ul className="flex flex-col divide-y divide-white/[0.06]">
          {cycles.map((cycle) => (
            <li key={cycle.id} className="flex flex-wrap items-center gap-2 py-2">
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold" style={{ color: RESERVE.ivory }}>
                  {cycle.name}
                </p>
                <p className="text-[11.5px] text-white/45">
                  {formatDay(cycle.startDate)} → {cycle.endedOn ? formatDay(cycle.endedOn) : ""} · {cycle.plannedWeeks} weeks planned ·{" "}
                  {cycle.endReason === "ended-early" ? "ended early" : "finished as planned"}
                </p>
              </div>
              <ReserveButton tier="quiet" size="sm" onClick={() => reopenCyclePeriod(cycle.id)}>
                Reopen
              </ReserveButton>
              <ReserveButton tier="quiet" size="sm" onClick={() => removeCyclePeriod(cycle.id)}>
                Delete
              </ReserveButton>
            </li>
          ))}
        </ul>
      </ReserveDisclosure>
    </GlassPanel>
  );
}
