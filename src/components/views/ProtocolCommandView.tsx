"use client";

import { ArrowRight, Target } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { GlassPanel } from "@/components/ui/GlassPanel";
import {
  DETAIL_BAND_BLEED,
  ReserveBottomSheet,
  ReserveButton,
  ReserveDetailImage,
  ReserveDisclosure,
  ReserveSectionHeader,
  ReserveSelect,
  useDirtySnapshot,
} from "@/components/ui/reserve";
import { ProtocolChooserSheet } from "@/components/protocol/ProtocolChooserSheet";
import {
  CommandRow,
  ProtocolReasoningDetail,
  ProtocolRecommendationPanel,
  ProtocolSubHead,
  useProtocolReasoning,
  type ProtocolReasoning,
} from "@/components/protocol/ProtocolRecommendationPanel";
import { RESERVE, alpha } from "@/lib/design/tokens";
import {
  resolveProtocolPrimaryAction,
  type ProtocolPrimaryAction,
  type ProtocolPrimaryPlan,
} from "@/lib/protocol/primary-action";
import { chooserStartStep, profileInputsLine, targetDateLabel, weekLine, type ChooserStep } from "@/lib/protocol/personal-command";
import { useActiveProgram } from "@/lib/hooks/useActiveProgram";
import { useMemberSplit } from "@/lib/hooks/useMemberSplit";
import type { ProgramPhase } from "@/lib/horizon/types";
import { memberSplitWeekStructure } from "@/lib/training/member-split";
import { ViewShell } from "./ViewShell";
import { useAthleteDashboardStore, type DashboardView } from "@/lib/athlete-store";
import { resolveFocusArchitecture } from "@/lib/protocol/architecture";
import {
  EVENT_TYPE_LABEL,
  computeCommandCompleteness,
  computeProtocolProgress,
  getProtocol,
  planDeadline,
  protocolProduct,
  type EventType,
} from "@/lib/protocol/library";

/* ════════════════════════════════════════════════════════════════════════
   PERSONAL COMMAND — the protocol everything else in Reserve organizes around.

   A command center, not a document. Three regions:

     hero        the member's state in one sentence, at most three reads,
                 and one gold action from a pure resolver
     rows        no protocol: the recommendation — one protocol, why it
                 fits, two alternatives, the library, the missing inputs.
                 Running: your block — phase, week, target, priorities,
                 protocol, inputs, and the pause / complete controls
     details     ONE closed disclosure holding every explanation — the full
                 reasoning and, when running, the protocol's phases

   The chooser (goal → activities → focus → protocol) and the target date are
   sheets opened from the gold action or a row.
   ════════════════════════════════════════════════════════════════════════ */

const EVENT_TYPES: EventType[] = ["none", "vacation", "beach-trip", "wedding", "photoshoot", "birthday", "competition", "milestone"];

/* Completeness label → the command surface that resolves it. */
const COMPLETENESS_LINK: Record<string, DashboardView | null> = {
  Schedule: "schedule-command",
  Goal: null,
  Protocol: null,
  "Gym environment": "training",
  "Equipment access": "training",
  "Weak point focus": "physique",
  "Nutrition preference": "nutrition",
  "Meal timing": "schedule-command",
  "Recovery target": "recovery",
  "Check-in cadence": null,
};

export function ProtocolCommandView() {
  const activeProtocol = useAthleteDashboardStore((s) => s.activeProtocol);
  const resumeProtocol = useAthleteDashboardStore((s) => s.resumeProtocol);
  const setActiveView = useAthleteDashboardStore((s) => s.setActiveView);
  const userTrainingProfile = useAthleteDashboardStore((s) => s.userTrainingProfile);
  const physiqueCommand = useAthleteDashboardStore((s) => s.physiqueCommand);
  const scheduleProfile = useAthleteDashboardStore((s) => s.scheduleProfile);
  const nutritionPrefs = useAthleteDashboardStore((s) => s.nutritionPrefs);
  const recoveryCommand = useAthleteDashboardStore((s) => s.recoveryCommand);
  const reasoning = useProtocolReasoning();
  /* The program's own phases — the ones Program Horizon, Training and the ticker name. */
  const { horizon, resolution } = useActiveProgram();

  /* ── Profile completeness ── */
  const completeness = useMemo(() => {
    const signals: Record<string, boolean> = {
      protocol: !!activeProtocol,
      goal: !!activeProtocol?.goal,
      schedule: !!(scheduleProfile.preferredTrainingStart && scheduleProfile.sleepTarget),
      gymEnvironment: userTrainingProfile.configured,
      equipment: userTrainingProfile.equipment.length > 0,
      weakPoints: physiqueCommand.weakPoints.length > 0,
      nutrition: nutritionPrefs.dietStyle !== "standard",
      mealTiming: scheduleProfile.mealWindows.some((m) => m.enabled),
      recovery: recoveryCommand.sleepTargetHours > 0,
      checkIn: !!activeProtocol?.checkInCadence,
    };
    return computeCommandCompleteness(signals);
  }, [activeProtocol, scheduleProfile, userTrainingProfile, physiqueCommand, nutritionPrefs, recoveryCommand]);

  /* The one gold action, from a pure resolver with its own unit tests. */
  const progress = useMemo(() => (activeProtocol ? computeProtocolProgress(activeProtocol) : null), [activeProtocol]);
  const plan = resolveProtocolPrimaryAction({ active: activeProtocol, progress, completeness });

  /* ── The chooser and the target-date sheet ── */
  const [chooser, setChooser] = useState<{ step: ChooserStep; protocolId: string | null } | null>(null);
  const [deadlineOpen, setDeadlineOpen] = useState(false);
  const closeChooser = useCallback(() => setChooser(null), []);
  const closeDeadline = useCallback(() => setDeadlineOpen(false), []);
  const openChooser = useCallback((opts: { protocolId?: string | null; browse?: boolean } = {}) => {
    setChooser({ step: chooserStartStep(opts), protocolId: opts.protocolId ?? null });
  }, []);

  function runPrimary(action: ProtocolPrimaryAction) {
    switch (action.kind) {
      case "choose-protocol":
        openChooser();
        break;
      case "choose-next-protocol":
        /* Running the next protocol replaces this one; closing the chooser keeps it. */
        openChooser({ browse: true });
        break;
      case "resume-protocol":
        resumeProtocol();
        break;
      case "set-target-date":
        setDeadlineOpen(true);
        break;
      case "complete-profile": {
        const view = COMPLETENESS_LINK[action.missing];
        if (view) setActiveView(view);
        else setDeadlineOpen(true);
        break;
      }
      case "open-program-horizon":
        setActiveView("program-horizon");
        break;
    }
  }

  return (
    <ViewShell
      label="Personal Command"
      title="Personal Command"
      icon={Target}
      accentColor={RESERVE.gold}
      roomHero
      disclaimer="Organization only. No guaranteed outcomes, and no medical, dosage, supplement or compound guidance."
    >
      <PersonalCommandHero
        plan={plan}
        progress={progress}
        phaseName={resolution?.currentPhaseName ?? progress?.phase?.label ?? progress?.timelineLabel ?? null}
        completeness={completeness}
        onRun={runPrimary}
      />

      {activeProtocol && progress ? (
        <YourBlock
          missingCount={reasoning.subject.missingInformation.length}
          onTargetDate={() => setDeadlineOpen(true)}
          onPriorities={() => openChooser()}
          onChange={() => openChooser({ browse: true })}
        />
      ) : (
        <ProtocolRecommendationPanel
          reasoning={reasoning}
          onActivate={(protocolId) => openChooser({ protocolId })}
          onBrowse={() => openChooser({ browse: true })}
        />
      )}

      <PersonalCommandDetails
        reasoning={reasoning}
        programPhases={activeProtocol && horizon ? horizon.phases : null}
        currentPhaseId={resolution?.currentPhaseId ?? null}
      />

      <ProtocolChooserSheet
        open={chooser !== null}
        onClose={closeChooser}
        startStep={chooser?.step ?? "goal"}
        startProtocolId={chooser?.protocolId ?? null}
      />
      {activeProtocol && <DeadlineSheet open={deadlineOpen} onClose={closeDeadline} />}
    </ViewShell>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   HERO — the member's current state, and the one gold action
   ════════════════════════════════════════════════════════════════════════ */

/** A readout with no surface of its own — a row in the hero, never a tile. */
function HeroRead({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/55">{label}</dt>
      <dd className="tnum mt-1.5 truncate text-[15px] font-semibold capitalize leading-snug text-[#f2eee6]">{value}</dd>
    </div>
  );
}

function PersonalCommandHero({
  plan,
  progress,
  phaseName,
  completeness,
  onRun,
}: {
  plan: ProtocolPrimaryPlan;
  progress: ReturnType<typeof computeProtocolProgress> | null;
  phaseName: string | null;
  completeness: ReturnType<typeof computeCommandCompleteness>;
  onRun: (action: ProtocolPrimaryAction) => void;
}) {
  return (
    <GlassPanel accent={RESERVE.gold} noPad phone="flush" className="md:overflow-hidden">
      <section aria-label="Your protocol" data-protocol="hero" className="relative pb-5 pt-4 md:p-6 lg:px-8 lg:py-6">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-x-3 inset-y-0 max-md:[mask-image:linear-gradient(180deg,#000_55%,transparent)] md:inset-x-0"
          style={{
            background: `radial-gradient(110% 90% at 0% 15%, ${alpha(RESERVE.gold, 0.09)}, transparent 55%), radial-gradient(80% 70% at 100% 100%, ${alpha(RESERVE.violet, 0.04)}, transparent 60%)`,
          }}
        />

        <div className="relative grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)] lg:items-end lg:gap-12">
          <h2
            data-room-statement
            className="min-w-0 font-display text-[28px] font-black uppercase leading-[0.95] tracking-[-0.02em] text-[#f2eee6] [hyphens:none] [text-wrap:balance] sm:text-[34px] lg:text-[42px]"
          >
            {plan.statement}
          </h2>

          <div className="min-w-0">
            <dl className="grid grid-cols-3 gap-4">
              {progress ? (
                <>
                  <HeroRead label="Complete" value={`${progress.percentComplete}%`} />
                  {/* The statement already names the week, so the second read is the phase. */}
                  <HeroRead label="Phase" value={phaseName ?? progress.timelineLabel} />
                  <HeroRead label="Confidence" value={completeness.confidence} />
                </>
              ) : (
                <HeroRead label="Confidence" value={completeness.confidence} />
              )}
            </dl>

            {/* The screen's one gold action (Bible §11). */}
            <div data-protocol="primary-action" className="mt-4 min-w-0 max-sm:w-full sm:inline-block">
              <ReserveButton tier="primary" size="md" fullWidth iconAfter={ArrowRight} onClick={() => onRun(plan.primary)}>
                {plan.primary.label}
              </ReserveButton>
            </div>
          </div>
        </div>
      </section>
    </GlassPanel>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   YOUR BLOCK — a running protocol, as rows
   ════════════════════════════════════════════════════════════════════════ */

function YourBlock({
  missingCount,
  onTargetDate,
  onPriorities,
  onChange,
}: {
  missingCount: number;
  onTargetDate: () => void;
  onPriorities: () => void;
  onChange: () => void;
}) {
  const active = useAthleteDashboardStore((s) => s.activeProtocol)!;
  const focus = useAthleteDashboardStore((s) => s.physiqueCommand.focus);
  const womensEnabled = useAthleteDashboardStore((s) => s.womens.enabled);
  const setActiveView = useAthleteDashboardStore((s) => s.setActiveView);
  const pauseProtocol = useAthleteDashboardStore((s) => s.pauseProtocol);
  const resumeProtocol = useAthleteDashboardStore((s) => s.resumeProtocol);
  const completeProtocol = useAthleteDashboardStore((s) => s.completeProtocol);
  const progress = useMemo(() => computeProtocolProgress(active), [active]);
  const architecture = resolveFocusArchitecture(focus, { womensActive: womensEnabled });
  const memberSplit = useMemberSplit();
  const [confirmComplete, setConfirmComplete] = useState(false);

  const target = active.eventDate ?? active.targetDate;
  /* A chosen split sets the days, so the week reads as that split and its rest days. */
  const week = weekLine({
    split: memberSplit
      ? {
          name: memberSplit.architecture.name,
          restDays: memberSplitWeekStructure(memberSplit, progress.currentWeek).flatMap((d, i) => (d.recovery ? [i] : [])),
        }
      : null,
    trainingDays: active.trainingDays,
    cardioDays: active.cardioDays,
    mobilityDays: active.mobilityDays,
    checkInCadence: active.checkInCadence,
  });

  return (
    <GlassPanel accent={RESERVE.violet} phone="flush">
      <section aria-label="Your block" data-protocol="block">
        <ReserveDetailImage id="protocol-blueprint" size="strip" className={DETAIL_BAND_BLEED} />
        <ReserveSectionHeader
          label="Your block"
          accent={RESERVE.violet}
          action={
            <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-white/55">
              {active.status === "active" ? "Active" : active.status === "paused" ? "Paused" : active.status === "completed" ? "Completed" : "Needs review"}
            </span>
          }
        />
        <div className="divide-y divide-white/[0.06]">
          <CommandRow label="Week" value={week} action="Horizon" onClick={() => setActiveView("program-horizon")} data="week" />
          <CommandRow label="Target" value={targetDateLabel(target, active.eventName)} onClick={onTargetDate} action={target ? "Change" : "Set"} haspopup />
          <CommandRow label="Priorities" value={architecture.active ? architecture.focusLabel : "Balanced"} onClick={onPriorities} action="Change" haspopup />
          <CommandRow label="Protocol" value={active.protocolName} onClick={onChange} action="Change" haspopup />
          <CommandRow
            label="Inputs"
            value={profileInputsLine({ missingCount })}
            action="Settings"
            onClick={() => setActiveView("settings")}
            data="profile-inputs"
          />
          {progress.pace === "short-timeline" && <CommandRow label="Pace" value="Short timeline · consistency first" />}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-3">
          {active.status === "active" && <ReserveButton tier="quiet" size="sm" onClick={pauseProtocol}>Pause Protocol</ReserveButton>}
          {active.status === "paused" && <ReserveButton tier="quiet" size="sm" onClick={resumeProtocol}>Resume Protocol</ReserveButton>}
          {active.status !== "completed" && (
            <ReserveButton tier="quiet" size="sm" onClick={() => setConfirmComplete(true)}>
              Complete Protocol
            </ReserveButton>
          )}
        </div>
      </section>

      {/* Completing ends the block, so the member sees what that means before it happens. */}
      <ReserveBottomSheet open={confirmComplete} onClose={() => setConfirmComplete(false)} title="Complete Protocol">
        <p className="text-[14px] leading-[1.55] text-[#f2eee6]">
          End {active.protocolName} at week {progress.currentWeek} of {progress.totalWeeks}?
        </p>
        <p className="mt-2 text-[12.5px] leading-[1.55] text-white/60">
          The block stops here and Reserve asks you to choose your next protocol. Your logged sessions, meals and check-ins stay.
        </p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <ReserveButton tier="quiet" size="md" onClick={() => setConfirmComplete(false)}>
            Keep Running
          </ReserveButton>
          <ReserveButton
            tier="secondary"
            size="md"
            onClick={() => {
              completeProtocol();
              setConfirmComplete(false);
            }}
          >
            Complete Protocol
          </ReserveButton>
        </div>
      </ReserveBottomSheet>
    </GlassPanel>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   DETAILS — the screen's one closed disclosure
   ════════════════════════════════════════════════════════════════════════ */

function PersonalCommandDetails({
  reasoning,
  programPhases,
  currentPhaseId,
}: {
  reasoning: ProtocolReasoning;
  /** The running program's phases, when Program Horizon has them. */
  programPhases: ProgramPhase[] | null;
  currentPhaseId: string | null;
}) {
  const active = useAthleteDashboardStore((s) => s.activeProtocol);
  const setActiveView = useAthleteDashboardStore((s) => s.setActiveView);
  const progress = useMemo(() => (active ? computeProtocolProgress(active) : null), [active]);
  const def = active ? getProtocol(active.protocolId) : null;
  const product = active ? protocolProduct(active.protocolId) : null;
  /* One set of phase names across the app: the program's, falling back to the protocol's outline. */
  const phases = programPhases?.length
    ? programPhases.map((ph) => ({ key: ph.id, label: ph.name, weekStart: ph.weekStart, weekEnd: ph.weekEnd, focus: ph.objective, now: ph.id === currentPhaseId }))
    : (progress?.phases ?? []).map((ph) => ({ key: String(ph.index), label: ph.label, weekStart: ph.weekStart, weekEnd: ph.weekEnd, focus: ph.focus, now: progress?.phase?.index === ph.index }));

  return (
    <div data-protocol="details">
      <ReserveDisclosure summary="Details">
        {product && <p className="mb-4 text-[13px] leading-relaxed text-white/70">{product.outcomeVision}</p>}
        {/* Names and weeks only — each phase's objective lives in Program Horizon. */}
        {phases.length > 0 && (
          <div className="mb-4">
            <ProtocolSubHead>Phases</ProtocolSubHead>
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
              {phases.map((ph) => (
                <li key={ph.key}>
                  <span className={ph.now ? "font-semibold text-[#f2eee6]" : "text-white/70"}>{ph.label}</span>
                  <span className="tnum text-white/45">
                    {ph.weekStart === ph.weekEnd ? ` ${ph.weekStart}` : ` ${ph.weekStart}–${ph.weekEnd}`}
                    {ph.now ? " · now" : ""}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <ProtocolReasoningDetail reasoning={reasoning} />
        {active && (
          <div className="mt-4">
            <ReserveButton tier="quiet" size="sm" iconAfter={ArrowRight} onClick={() => setActiveView("program-horizon")}>
              Week-by-week reasoning in Program Horizon
            </ReserveButton>
          </div>
        )}
        {def?.safetyNote && <p className="mt-3 text-[12px] text-white/50">{def.safetyNote}</p>}
      </ReserveDisclosure>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   TARGET DATE — a small form in a sheet
   ════════════════════════════════════════════════════════════════════════ */

function DeadlineSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  /* One session per opening: the draft starts from the saved protocol each time. */
  return open ? <DeadlineForm onDone={onClose} /> : null;
}

function DeadlineForm({ onDone }: { onDone: () => void }) {
  const active = useAthleteDashboardStore((s) => s.activeProtocol)!;
  const updateActiveProtocol = useAthleteDashboardStore((s) => s.updateActiveProtocol);
  const [draft, setDraft] = useState({
    eventName: active.eventName ?? "",
    eventType: (active.eventType ?? "none") as EventType,
    eventDate: active.eventDate ?? active.targetDate ?? "",
  });
  const dirty = useDirtySnapshot(draft);
  const plan = useMemo(() => planDeadline(draft.eventDate || null), [draft.eventDate]);
  const field =
    "mt-1.5 min-h-[44px] w-full rounded-lg border border-white/[0.1] bg-black/30 px-3 py-2 text-[16px] text-[#f2eee6] outline-none placeholder:text-white/30 focus:border-white/[0.25]";

  function save() {
    const eventDate = draft.eventDate || null;
    updateActiveProtocol({
      eventName: draft.eventName.trim() || null,
      eventType: draft.eventType !== "none" ? draft.eventType : null,
      eventDate,
      targetDate: eventDate ?? active.targetDate,
    });
    onDone();
  }

  return (
    <ReserveBottomSheet open onClose={onDone} title="Target Date" dirty={dirty}>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block min-w-0">
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/55">Target date</span>
          <input type="date" value={draft.eventDate} onChange={(e) => setDraft({ ...draft, eventDate: e.target.value })} className={field} />
        </label>
        <label className="block min-w-0">
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/55">Event name</span>
          <input type="text" value={draft.eventName} placeholder="Optional" onChange={(e) => setDraft({ ...draft, eventName: e.target.value })} className={field} />
        </label>
      </div>
      <div className="mt-3">
        <ReserveSelect
          label="Event type"
          value={draft.eventType}
          options={EVENT_TYPES.map((t) => ({ value: t, label: EVENT_TYPE_LABEL[t] }))}
          onChange={(v) => setDraft({ ...draft, eventType: v as EventType })}
        />
      </div>
      <p className="mt-3 text-[12.5px] leading-[1.5] text-white/60">
        {plan.weeksRemaining != null ? `${plan.weeksRemaining} weeks · ${plan.urgencyLabel} · ` : ""}
        {plan.note}
      </p>
      <div className="mt-5 flex justify-end">
        <ReserveButton tier="primary" size="md" onClick={save}>
          Save Target Date
        </ReserveButton>
      </div>
    </ReserveBottomSheet>
  );
}
