"use client";

import { motion } from "framer-motion";
import { ArrowRight, Check } from "lucide-react";
import React, { useCallback, useMemo, useState } from "react";

import { recordRecoveryLog } from "@/components/recovery/record-recovery-log";
import { useRecoveryClock, RECOVERY_REFERENCE_CLOCK } from "@/components/recovery/useRecoveryClock";
import { focusRecoverySleepLog } from "@/components/recovery/sleep-log-anchor";
import { CareOptions } from "@/components/safety/CareOptions";
import { GlassPanel } from "@/components/ui/GlassPanel";
import {
  DETAIL_BAND_BLEED,
  ReserveBottomSheet,
  ReserveButton,
  ReserveDetailImage,
  ReserveSectionHeader,
  ReserveSheetClose,
  useDirtySnapshot,
} from "@/components/ui/reserve";
import type { DetailImageId } from "@/lib/brand/asset-manifest";
import { useAthleteDashboardStore } from "@/lib/athlete-store";
import { RESERVE, alpha } from "@/lib/design/tokens";
import { localDateKey } from "@/lib/dates/local-day";
import { buildRecoverySnapshot } from "@/lib/recovery/engine";
import { NO_CLINICIAN_LINE } from "@/lib/safety/care-options";
import { useTodayTrainingDay } from "@/lib/training/useTodayTrainingDay";
import { useAmbientMotion } from "@/lib/ui/use-ambient-motion";
import {
  ASSUMED_DAYS_BETWEEN_STARTS,
  ASSUMED_PERIOD_DAYS,
  CYCLE_PHASE_META,
  DAYS_BETWEEN_STARTS_RANGE,
  PERIOD_DAYS_RANGE,
  TRAINING_FELT_LABEL,
  cycleBasis,
  isISODate,
  periodStarts,
  phaseSpans,
  planDayLog,
} from "@/lib/women/cycle";
import { buildWomensEvidence } from "@/lib/women/evidence";
import { isRequirementMet, type WomensAction, type WomensRequirement } from "@/lib/women/primary-actions";
import {
  PREGNANCY_STAGE_LABELS,
  type CycleFlow,
  type CycleLogEntry,
  type CycleSymptom,
  type EnergyLevel,
  type PregnancyStage,
  type StressLevel,
  type TrainingPerformanceTrend,
} from "@/lib/women/types";

import type { HeroAction } from "../records/RecordHero";

/* ════════════════════════════════════════════════════════════════════════
   RESERVE WOMEN — THE SHARED KIT.

   The eight women's screens are built from the same parts the redesigned
   rooms and records use (RecordHero, GlassPanel phone="flush") plus rimless rows,
   plus the few things only this track needs:

     useWomensModel    the member's real logs → evidence, once per screen
     useWomensRunner   runs a resolver's action: a sheet, a log, or a room
     the three sheets  cycle dates · a day's log · pregnancy stage
     PhaseTrack        where today sits in the calendar estimate
     WomensRequirements what a screen needs, with real counts and a way in
     CareRouting       who to reach, 911 / 988 first

   The palette is the closed Reserve palette. The old champagne-rose accent
   was a hue outside it (constitution color.md) and is gone.
   ════════════════════════════════════════════════════════════════════════ */

export const WOMENS_ACCENT = RESERVE.violet;

/* The phase lens moved to components/women/phase-lens so the core commands
   can render it without pulling this module's recovery engine, training-day
   hook and motion layer into their bundles. Re-exported so every existing
   import from "./ui" keeps working and there is one implementation. */
import { PhaseRows, WList, WRow } from "@/components/women/phase-lens";
export { PhaseRows, WList, WRow };

const FIELD =
  "w-full rounded-lg border border-white/[0.12] bg-white/[0.03] px-3 py-2.5 text-[16px] font-semibold text-[#f2eee6] outline-none placeholder:text-white/25 focus:border-[#a78bfa]/60 sm:text-[13px]";
const LABEL = "mb-1.5 block font-mono text-[11px] uppercase tracking-[0.16em] text-white/55";

/* ─── Model ─────────────────────────────────────────────────────────────── */

export function useWomensModel() {
  const live = useRecoveryClock();
  const clock = live ?? RECOVERY_REFERENCE_CLOCK;
  const womens = useAthleteDashboardStore((s) => s.womens);
  const recoveryCommand = useAthleteDashboardStore((s) => s.recoveryCommand);
  const nutritionPrefs = useAthleteDashboardStore((s) => s.nutritionPrefs);
  const physiqueCommand = useAthleteDashboardStore((s) => s.physiqueCommand);
  const { trainingPlanned, today: session } = useTodayTrainingDay(clock);

  const today = localDateKey(clock);
  const recovery = useMemo(() => buildRecoverySnapshot(recoveryCommand, clock), [recoveryCommand, clock]);
  const starts = useMemo(() => periodStarts(womens.cycle, womens.cycleLogs), [womens.cycle, womens.cycleLogs]);
  const evidence = useMemo(
    () =>
      buildWomensEvidence({
        now: clock,
        cycle: womens.cycle,
        cycleLogs: womens.cycleLogs,
        fertility: womens.fertility,
        pregnancy: womens.pregnancy,
        sleepLogs: recoveryCommand.sleepLogs,
        hydrationLogs: recoveryCommand.hydrationLogs,
        recoveryLabel: recovery.hasData ? recovery.reserveLabel : null,
        loggedMealIds: nutritionPrefs.loggedMealIds,
        nutritionLogDate: nutritionPrefs.nutritionLogDate,
        nutritionLogHistory: nutritionPrefs.nutritionLogHistory ?? {},
        checkIns: physiqueCommand.entries,
        photoCheckIns: physiqueCommand.photoCheckIns,
        trainingPlannedToday: trainingPlanned,
        sessionTitle: session?.displayTitle ?? session?.title ?? null,
      }),
    [clock, womens, recoveryCommand, recovery, nutritionPrefs, physiqueCommand, trainingPlanned, session],
  );

  return { clock, today, womens, starts, evidence, recovery, recoveryCommand, nutritionPrefs, physiqueCommand };
}

/* ─── Running an action ─────────────────────────────────────────────────── */

type SheetKind = "dates" | "day" | "stage";

/** Anchor for "Choose What to Track" on the Fertility screen. */
export const FERTILITY_AREAS_ID = "womens-fertility-areas";

export function useWomensRunner(today: string) {
  const [sheet, setSheet] = useState<SheetKind | null>(null);
  const [dayDate, setDayDate] = useState<string | null>(null);
  const close = useCallback(() => {
    setSheet(null);
    setDayDate(null);
  }, []);
  /** Opens the day log on a date already logged, for editing. */
  const editDay = useCallback((date: string) => {
    setDayDate(date);
    setSheet("day");
  }, []);
  const setActiveView = useAthleteDashboardStore((s) => s.setActiveView);
  const logHydration = useAthleteDashboardStore((s) => s.logHydration);
  const updateFertilityModule = useAthleteDashboardStore((s) => s.updateFertilityModule);
  const updatePregnancyModule = useAthleteDashboardStore((s) => s.updatePregnancyModule);

  const run = useCallback(
    (action: WomensAction) => {
      switch (action.kind) {
        case "open-cycle-dates":
          setSheet("dates");
          break;
        case "open-day-log":
          setSheet("day");
          break;
        case "open-stage":
          setSheet("stage");
          break;
        case "open-view":
          setActiveView(action.view);
          break;
        case "log-water":
          recordRecoveryLog("water", () => logHydration({ date: localDateKey(), oz: action.oz }));
          break;
        case "enable-fertility":
          updateFertilityModule({ enabled: true });
          break;
        case "enable-pregnancy":
          updatePregnancyModule({ enabled: true });
          break;
        case "choose-areas": {
          const host = document.getElementById(FERTILITY_AREAS_ID);
          if (!host) break;
          const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          host.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
          host.querySelector<HTMLElement>("button")?.focus({ preventScroll: true });
          break;
        }
        case "open-sleep-log": {
          /* Recovery owns the Sleep Log. Open it there once the room has mounted. */
          setActiveView("recovery");
          const deadline = Date.now() + 5000;
          const seek = () => {
            if (focusRecoverySleepLog()) return;
            if (Date.now() < deadline) window.setTimeout(seek, 120);
          };
          window.setTimeout(seek, 60);
          break;
        }
      }
    },
    [setActiveView, logHydration, updateFertilityModule, updatePregnancyModule],
  );

  const sheets = (
    <>
      {sheet === "dates" && <CycleDatesSheet onClose={close} today={today} />}
      {sheet === "day" && <DayLogSheet onClose={close} today={today} initialDate={dayDate ?? today} />}
      {sheet === "stage" && <StageSheet onClose={close} />}
    </>
  );

  return { run, sheets, editDay };
}

/** A resolver action as RecordHero's action shape. */
export function heroAction(action: WomensAction, run: (a: WomensAction) => void, withArrow = false): HeroAction {
  return {
    label: action.label,
    onClick: () => run(action),
    iconAfter: withArrow || action.kind === "open-view" || action.kind === "open-sleep-log" ? ArrowRight : undefined,
  };
}

/* ─── Sheet: cycle dates ────────────────────────────────────────────────── */

function CycleDatesSheet({ onClose, today }: { onClose: () => void; today: string }) {
  const cycle = useAthleteDashboardStore((s) => s.womens.cycle);
  const updateCycleProfile = useAthleteDashboardStore((s) => s.updateCycleProfile);
  const basis = cycleBasis(cycle);

  const [start, setStart] = useState(cycle.lastPeriodStart ?? "");
  const [between, setBetween] = useState(basis.entered ? String(basis.daysBetweenStarts) : "");
  const [period, setPeriod] = useState(basis.entered ? String(basis.periodDays) : "");
  const dirty = useDirtySnapshot({ start, between, period });

  const startValid = isISODate(start) && start <= today;
  const betweenN = Number(between);
  const periodN = Number(period);
  const lengthsBlank = between.trim() === "" && period.trim() === "";
  const betweenValid = Number.isInteger(betweenN) && betweenN >= DAYS_BETWEEN_STARTS_RANGE.min && betweenN <= DAYS_BETWEEN_STARTS_RANGE.max;
  const periodValid = Number.isInteger(periodN) && periodN >= PERIOD_DAYS_RANGE.min && periodN <= PERIOD_DAYS_RANGE.max;
  const lengthsValid = lengthsBlank || (betweenValid && periodValid);

  const reason = !startValid
    ? "Enter the first day of your last period, today or earlier"
    : !lengthsValid
      ? `Enter both: ${DAYS_BETWEEN_STARTS_RANGE.min}–${DAYS_BETWEEN_STARTS_RANGE.max} days between starts and ${PERIOD_DAYS_RANGE.min}–${PERIOD_DAYS_RANGE.max} period days, or leave both blank`
      : null;

  const save = () => {
    if (reason) return;
    updateCycleProfile({
      lastPeriodStart: start,
      ...(lengthsBlank
        ? { lengthsEnteredAt: null, averageCycleLengthDays: ASSUMED_DAYS_BETWEEN_STARTS, averagePeriodLengthDays: ASSUMED_PERIOD_DAYS }
        : { lengthsEnteredAt: new Date().toISOString(), averageCycleLengthDays: betweenN, averagePeriodLengthDays: periodN }),
    });
    onClose();
  };

  return (
    <ReserveBottomSheet
      open
      onClose={onClose}
      title="Cycle dates"
      accent={WOMENS_ACCENT}
      dirty={dirty}
      footer={
        <div className="flex items-center justify-between gap-3">
          <ReserveSheetClose fallback={onClose}>
            {(requestClose) => (
              <ReserveButton tier="quiet" size="md" onClick={requestClose}>
                Cancel
              </ReserveButton>
            )}
          </ReserveSheetClose>
          {reason ? (
            <ReserveButton tier="primary" size="md" disabled disabledReason={reason}>
              Save Dates
            </ReserveButton>
          ) : (
            <ReserveButton tier="primary" size="md" onClick={save}>
              Save Dates
            </ReserveButton>
          )}
        </div>
      }
    >
      <label className="block">
        <span className={LABEL}>First day of your last period</span>
        <input type="date" value={start} max={today} onChange={(e) => setStart(e.target.value)} className={FIELD} />
      </label>

      <p className="mb-2 mt-5 font-mono text-[11px] uppercase tracking-[0.16em] text-white/55">Your usual timing · optional</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className={LABEL}>Days from one start to the next</span>
          <input
            type="number"
            inputMode="numeric"
            min={DAYS_BETWEEN_STARTS_RANGE.min}
            max={DAYS_BETWEEN_STARTS_RANGE.max}
            value={between}
            onChange={(e) => setBetween(e.target.value)}
            placeholder="Not sure"
            className={FIELD}
          />
        </label>
        <label className="block">
          <span className={LABEL}>Period days</span>
          <input
            type="number"
            inputMode="numeric"
            min={PERIOD_DAYS_RANGE.min}
            max={PERIOD_DAYS_RANGE.max}
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            placeholder="Not sure"
            className={FIELD}
          />
        </label>
      </div>
      <p className="mt-3 text-[12.5px] leading-[1.55] text-white/55">
        Until you enter your own, Reserve assumes {ASSUMED_DAYS_BETWEEN_STARTS} days between starts and {ASSUMED_PERIOD_DAYS} period days, and labels every estimate that way.
        These are calendar estimates, not predictions.
      </p>
    </ReserveBottomSheet>
  );
}

/* ─── Sheet: a day's log ────────────────────────────────────────────────── */

const FLOW_OPTIONS: { value: CycleFlow; label: string }[] = [
  { value: "spotting", label: "Spotting" },
  { value: "light", label: "Light" },
  { value: "medium", label: "Medium" },
  { value: "heavy", label: "Heavy" },
];
const LEVEL_OPTIONS: { value: EnergyLevel & StressLevel; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "moderate", label: "Moderate" },
  { value: "high", label: "High" },
];
const FELT_OPTIONS: { value: TrainingPerformanceTrend; label: string }[] = (["down", "steady", "up"] as const).map((value) => ({
  value,
  label: TRAINING_FELT_LABEL[value],
}));

export const SYMPTOM_LABELS: Record<Exclude<CycleSymptom, "none">, string> = {
  cramps: "Cramps",
  bloating: "Bloating",
  headache: "Headache",
  fatigue: "Fatigue",
  "mood-shift": "Mood shift",
  "breast-tenderness": "Breast tenderness",
  "low-back": "Low back",
  cravings: "Cravings",
  "poor-sleep": "Poor sleep",
};

function Choice<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T | undefined;
  onChange: (value: T | undefined) => void;
}) {
  return (
    <fieldset className="mt-4">
      <legend className={LABEL}>{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const on = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? undefined : option.value)}
              className="min-h-[44px] rounded-lg border px-3.5 text-[13px] font-semibold transition"
              style={{
                borderColor: on ? alpha(WOMENS_ACCENT, 0.6) : "rgba(255,255,255,0.1)",
                background: on ? alpha(WOMENS_ACCENT, 0.14) : "rgba(255,255,255,0.02)",
                color: on ? RESERVE.ivory : "rgba(255,255,255,0.6)",
              }}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function DayLogSheet({ onClose, today, initialDate }: { onClose: () => void; today: string; initialDate: string }) {
  const cycle = useAthleteDashboardStore((s) => s.womens.cycle);
  const logs = useAthleteDashboardStore((s) => s.womens.cycleLogs);
  const logCycleEntry = useAthleteDashboardStore((s) => s.logCycleEntry);
  const removeCycleEntry = useAthleteDashboardStore((s) => s.removeCycleEntry);
  const updateCycleProfile = useAthleteDashboardStore((s) => s.updateCycleProfile);

  const existing = (date: string) => logs.find((l) => l.date === date);
  const [date, setDate] = useState(initialDate);
  const [draft, setDraft] = useState<Omit<CycleLogEntry, "id" | "date">>(() => fromEntry(existing(initialDate)));
  const dirty = useDirtySnapshot({ date, draft });

  const changeDate = (next: string) => {
    setDate(next);
    if (isISODate(next)) setDraft(fromEntry(existing(next)));
  };

  const hasAnything =
    draft.isPeriodDay !== undefined ||
    Boolean(draft.energy || draft.stress || draft.trainingPerformance || draft.notes?.trim()) ||
    draft.symptoms.length > 0;
  const dateValid = isISODate(date) && date <= today;
  const reason = !dateValid ? "Choose today or an earlier date" : !hasAnything ? "Answer at least one question to save the day" : null;

  const save = () => {
    if (reason) return;
    const entry: Omit<CycleLogEntry, "id"> = {
      date,
      symptoms: draft.symptoms,
      ...(draft.isPeriodDay !== undefined ? { isPeriodDay: draft.isPeriodDay } : {}),
      ...(draft.isPeriodDay && draft.flow ? { flow: draft.flow } : {}),
      ...(draft.energy ? { energy: draft.energy } : {}),
      ...(draft.stress ? { stress: draft.stress } : {}),
      ...(draft.trainingPerformance ? { trainingPerformance: draft.trainingPerformance } : {}),
      ...(draft.notes?.trim() ? { notes: draft.notes.trim() } : {}),
    };
    const plan = planDayLog(entry, cycle, logs);
    plan.replaceIds.forEach((id) => removeCycleEntry(id));
    logCycleEntry(entry);
    if (plan.newPeriodStart) updateCycleProfile({ lastPeriodStart: plan.newPeriodStart });
    onClose();
  };

  const toggleSymptom = (symptom: CycleSymptom) =>
    setDraft((d) => ({ ...d, symptoms: d.symptoms.includes(symptom) ? d.symptoms.filter((s) => s !== symptom) : [...d.symptoms.filter((s) => s !== "none"), symptom] }));

  return (
    <ReserveBottomSheet
      open
      onClose={onClose}
      title={existing(date) ? "Edit your day" : "Log your day"}
      accent={WOMENS_ACCENT}
      dirty={dirty}
      footer={
        <div className="flex items-center justify-between gap-3">
          <ReserveSheetClose fallback={onClose}>
            {(requestClose) => (
              <ReserveButton tier="quiet" size="md" onClick={requestClose}>
                Cancel
              </ReserveButton>
            )}
          </ReserveSheetClose>
          {reason ? (
            <ReserveButton tier="primary" size="md" disabled disabledReason={reason}>
              Save Day
            </ReserveButton>
          ) : (
            <ReserveButton tier="primary" size="md" onClick={save}>
              Save Day
            </ReserveButton>
          )}
        </div>
      }
    >
      <label className="block">
        <span className={LABEL}>Date</span>
        <input type="date" value={date} max={today} onChange={(e) => changeDate(e.target.value)} className={FIELD} />
      </label>

      <Choice
        label="Period day"
        options={[
          { value: "yes", label: "Yes" },
          { value: "no", label: "No" },
        ]}
        value={draft.isPeriodDay === undefined ? undefined : draft.isPeriodDay ? "yes" : "no"}
        onChange={(v) => setDraft((d) => ({ ...d, isPeriodDay: v === undefined ? undefined : v === "yes", flow: v === "yes" ? d.flow : undefined }))}
      />
      {draft.isPeriodDay && (
        <Choice label="Flow" options={FLOW_OPTIONS} value={draft.flow} onChange={(v) => setDraft((d) => ({ ...d, flow: v }))} />
      )}
      <Choice label="Energy" options={LEVEL_OPTIONS} value={draft.energy} onChange={(v) => setDraft((d) => ({ ...d, energy: v }))} />
      <Choice label="Stress" options={LEVEL_OPTIONS} value={draft.stress} onChange={(v) => setDraft((d) => ({ ...d, stress: v }))} />
      <Choice
        label="How training felt"
        options={FELT_OPTIONS}
        value={draft.trainingPerformance}
        onChange={(v) => setDraft((d) => ({ ...d, trainingPerformance: v }))}
      />

      <fieldset className="mt-4">
        <legend className={LABEL}>Symptoms you noticed · optional</legend>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(SYMPTOM_LABELS) as Exclude<CycleSymptom, "none">[]).map((symptom) => {
            const on = draft.symptoms.includes(symptom);
            return (
              <button
                key={symptom}
                type="button"
                aria-pressed={on}
                onClick={() => toggleSymptom(symptom)}
                className="min-h-[44px] rounded-lg border px-3 text-[13px] font-medium transition"
                style={{
                  borderColor: on ? alpha(WOMENS_ACCENT, 0.6) : "rgba(255,255,255,0.1)",
                  background: on ? alpha(WOMENS_ACCENT, 0.14) : "rgba(255,255,255,0.02)",
                  color: on ? RESERVE.ivory : "rgba(255,255,255,0.6)",
                }}
              >
                {SYMPTOM_LABELS[symptom]}
              </button>
            );
          })}
        </div>
      </fieldset>

      <label className="mt-4 block">
        <span className={LABEL}>Note · optional</span>
        <input
          type="text"
          value={draft.notes ?? ""}
          maxLength={140}
          onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
          placeholder="Anything worth remembering"
          className={FIELD}
        />
      </label>
      <p className="mt-3 text-[12.5px] leading-[1.55] text-white/55">
        A record in your own words. Reserve sorts it by estimated phase and does not interpret it. Sleep is logged in the Recovery room.
      </p>
    </ReserveBottomSheet>
  );
}

function fromEntry(entry: CycleLogEntry | undefined): Omit<CycleLogEntry, "id" | "date"> {
  if (!entry) return { symptoms: [] };
  return {
    isPeriodDay: entry.isPeriodDay,
    flow: entry.flow,
    energy: entry.energy,
    stress: entry.stress,
    trainingPerformance: entry.trainingPerformance,
    notes: entry.notes,
    symptoms: entry.symptoms.filter((s) => s !== "none"),
  };
}

/* ─── Sheet: pregnancy stage ────────────────────────────────────────────── */

const STAGES: PregnancyStage[] = ["first-trimester", "second-trimester", "third-trimester"];

function StageSheet({ onClose }: { onClose: () => void }) {
  const stage = useAthleteDashboardStore((s) => s.womens.pregnancy.stage);
  const updatePregnancyModule = useAthleteDashboardStore((s) => s.updatePregnancyModule);
  const [choice, setChoice] = useState<PregnancyStage | null>(stage ?? null);
  const dirty = useDirtySnapshot(choice);

  return (
    <ReserveBottomSheet
      open
      onClose={onClose}
      title="Your stage"
      accent={WOMENS_ACCENT}
      dirty={dirty}
      footer={
        <div className="flex items-center justify-between gap-3">
          <ReserveSheetClose fallback={onClose}>
            {(requestClose) => (
              <ReserveButton tier="quiet" size="md" onClick={requestClose}>
                Cancel
              </ReserveButton>
            )}
          </ReserveSheetClose>
          {choice ? (
            <ReserveButton
              tier="primary"
              size="md"
              onClick={() => {
                updatePregnancyModule({ stage: choice });
                onClose();
              }}
            >
              Save Stage
            </ReserveButton>
          ) : (
            <ReserveButton tier="primary" size="md" disabled disabledReason="Choose the trimester you are in">
              Save Stage
            </ReserveButton>
          )}
        </div>
      }
    >
      <div role="radiogroup" aria-label="Trimester" className="flex flex-col gap-2">
        {STAGES.map((s) => {
          const on = choice === s;
          return (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setChoice(s)}
              className="flex min-h-[48px] items-center justify-between rounded-lg border px-4 text-left text-[14px] font-semibold transition"
              style={{
                borderColor: on ? alpha(WOMENS_ACCENT, 0.6) : "rgba(255,255,255,0.1)",
                background: on ? alpha(WOMENS_ACCENT, 0.14) : "rgba(255,255,255,0.02)",
                color: on ? RESERVE.ivory : "rgba(255,255,255,0.65)",
              }}
            >
              {PREGNANCY_STAGE_LABELS[s]}
              {on && <Check size={15} aria-hidden="true" />}
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-[12.5px] leading-[1.55] text-white/55">
        Reserve records the stage you choose. It does not calculate a due date or adjust anything for pregnancy.
      </p>
    </ReserveBottomSheet>
  );
}

/* ─── Rows ──────────────────────────────────────────────────────────────
   A list that separates with light, not borders. The hairline is its own
   1px decorative element, so no row carries a border or a fill and nothing
   in a panel reads as a second surface (components.md rule 1). */

/* ─── Requirements ──────────────────────────────────────────────────────── */

export function WomensRequirements({
  purpose,
  requirements,
  run,
  accent = WOMENS_ACCENT,
  detail,
}: {
  purpose: string;
  requirements: WomensRequirement[];
  run: (action: WomensAction) => void;
  accent?: string;
  /** The room's detail image, as a band at the top, when this panel is the room's first section. */
  detail?: DetailImageId;
}) {
  const met = requirements.filter(isRequirementMet).length;
  const readiness = met === 0 ? `Evidence needed · 0 of ${requirements.length} ready` : met === requirements.length ? `All ${met} ready` : `${met} of ${requirements.length} ready`;
  return (
    <GlassPanel accent={accent} phone="flush">
      {detail && <ReserveDetailImage id={detail} className={DETAIL_BAND_BLEED} />}
      <ReserveSectionHeader label="What this needs" accent={accent} />
      <p className="tnum font-mono text-[11px] uppercase tracking-[0.14em] text-white/60">{readiness}</p>
      <p className="mt-2 max-w-[72ch] text-[13.5px] leading-[1.6] text-white/70">{purpose}</p>
      <WList label="What this screen needs" className="mt-3.5">
        {requirements.map((r) => {
          const done = isRequirementMet(r);
          const fraction = r.need <= 0 ? 1 : Math.min(1, r.have / r.need);
          const progress = `${Math.min(r.have, r.need)} of ${r.need} ${r.noun}`;
          return (
            <WRow key={r.id}>
              <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                <div className="min-w-0 flex-1 basis-[220px]">
                  <div className="flex flex-wrap items-baseline gap-x-2.5">
                    <p className="text-[14.5px] font-semibold text-[#f2eee6]">{r.label}</p>
                    <span className="tnum font-mono text-[11px] uppercase tracking-[0.14em]" style={{ color: done ? alpha(RESERVE.green, 0.9) : "rgba(255,255,255,0.55)" }}>
                      {done && <Check size={11} className="mr-1 inline align-[-1px]" aria-hidden="true" />}
                      {progress}
                    </span>
                  </div>
                  <div
                    className="mt-2 h-[3px] w-full max-w-[280px] overflow-hidden rounded-full bg-white/[0.07]"
                    role="progressbar"
                    aria-label={`${r.label}: ${progress}`}
                    aria-valuemin={0}
                    aria-valuemax={r.need}
                    aria-valuenow={Math.min(r.have, r.need)}
                  >
                    <div className="h-full rounded-full" style={{ width: `${Math.round(fraction * 100)}%`, background: done ? alpha(RESERVE.green, 0.7) : alpha(accent, 0.7) }} />
                  </div>
                  <p className="mt-2 max-w-[64ch] text-[12.5px] leading-[1.55] text-white/55">{r.detail}</p>
                </div>
                {!done && (
                  <ReserveButton tier="quiet" size="sm" onClick={() => run(r.action)}>
                    {r.action.label}
                  </ReserveButton>
                )}
              </div>
            </WRow>
          );
        })}
      </WList>
    </GlassPanel>
  );
}

/* ─── Phase track ───────────────────────────────────────────────────────── */

/**
 * Where today sits in the calendar model: one bar, four spans, one marker.
 * The spans are the model's definitions for the basis in use — the member's
 * own figures or the named assumption.
 */
export function PhaseTrack({
  daysBetweenStarts,
  periodDays,
  day,
  basisEntered,
}: {
  daysBetweenStarts: number;
  periodDays: number;
  day: number | null;
  basisEntered: boolean;
}) {
  const motion_ = useAmbientMotion();
  const spans = phaseSpans({ daysBetweenStarts, periodDays, entered: basisEntered });
  const current = day !== null ? spans.find((s) => day >= s.firstDay && day <= s.lastDay)?.phase ?? null : null;
  const markerLeft = day !== null && current ? ((day - 0.5) / daysBetweenStarts) * 100 : null;

  return (
    <div>
      <div className="relative pt-5">
        {markerLeft !== null && (
          <div className="absolute top-0 -translate-x-1/2" style={{ left: `${markerLeft}%` }} aria-hidden="true">
            <span className="tnum block whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.12em] text-white/75">Day {day}</span>
          </div>
        )}
        <div className="relative flex h-2.5 w-full gap-[3px]" role="img" aria-label={current && day !== null ? `Day ${day} of ${daysBetweenStarts}, ${CYCLE_PHASE_META[current].label} phase, estimated` : `A ${daysBetweenStarts}-day calendar estimate`}>
          {spans.map((span) => {
            const on = span.phase === current;
            const width = ((span.lastDay - span.firstDay + 1) / daysBetweenStarts) * 100;
            return (
              <span
                key={span.phase}
                className="h-full rounded-full"
                style={{ width: `${width}%`, background: alpha(CYCLE_PHASE_META[span.phase].color, on ? 0.75 : 0.22) }}
              />
            );
          })}
          {markerLeft !== null && (
            <motion.span
              aria-hidden="true"
              className="absolute top-1/2 h-4 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{ left: `${markerLeft}%`, background: RESERVE.ivory, boxShadow: `0 0 10px ${alpha(RESERVE.ivory, 0.6)}` }}
              animate={motion_ === "full" ? { opacity: [1, 0.55, 1] } : { opacity: 1 }}
              transition={motion_ === "full" ? { duration: 4.2, repeat: Infinity, ease: "easeInOut" } : { duration: 0 }}
            />
          )}
        </div>
        <div className="tnum mt-1.5 flex justify-between font-mono text-[11px] uppercase tracking-[0.12em] text-white/40">
          <span>Day 1</span>
          <span>Day {daysBetweenStarts}</span>
        </div>
      </div>

      <ul className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2" aria-label="Phases in this estimate">
        {spans.map((span) => {
          const meta = CYCLE_PHASE_META[span.phase];
          const on = span.phase === current;
          return (
            <li key={span.phase} className="flex items-start gap-2.5">
              <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: meta.color }} aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-[13.5px] font-semibold" style={{ color: on ? RESERVE.ivory : "rgba(255,255,255,0.7)" }}>
                  {meta.label}
                  <span className="tnum ml-2 font-mono text-[11px] font-normal uppercase tracking-[0.12em] text-white/45">
                    {span.firstDay === span.lastDay ? `Day ${span.firstDay}` : `Days ${span.firstDay}–${span.lastDay}`}
                  </span>
                  {on && <span className="ml-2 font-mono text-[11px] font-normal uppercase tracking-[0.12em] text-white/60">· today, est.</span>}
                </p>
                <p className="mt-0.5 text-[12px] leading-[1.5] text-white/50">{meta.definition}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ─── By-phase rows ─────────────────────────────────────────────────────── */

/** One row per phase. `read` returns the facts for that phase, or null for "Evidence needed". */
/* ─── Track rows (the hub) ──────────────────────────────────────────────── */

export function TrackRow({
  name,
  value,
  detail,
  actionLabel,
  onOpen,
}: {
  name: string;
  value: string;
  detail?: string;
  actionLabel: string;
  onOpen: () => void;
}) {
  return (
    <WRow>
      <div className="flex items-center justify-between gap-3">
        <div className="grid min-w-0 flex-1 grid-cols-1 gap-x-4 gap-y-0.5 sm:grid-cols-[150px_minmax(0,1fr)] sm:items-baseline">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/55">{name}</p>
          <div className="min-w-0">
            <p className="tnum text-[14.5px] font-semibold text-[#f2eee6]">{value}</p>
            {detail && <p className="mt-0.5 text-[12px] leading-[1.5] text-white/50">{detail}</p>}
          </div>
        </div>
        <ReserveButton tier="quiet" size="sm" iconAfter={ArrowRight} onClick={onOpen}>
          {actionLabel}
        </ReserveButton>
      </div>
    </WRow>
  );
}

/* ─── Care routing ──────────────────────────────────────────────────────── */

export function CareRouting({ reviewLine }: { reviewLine: string }) {
  return (
    <GlassPanel accent={RESERVE.steel} phone="flush">
      <ReserveSectionHeader label="Care and questions" accent={RESERVE.steel} />
      <WList label="Who to reach">
        <WRow>
          <p className="text-[14px] font-semibold" style={{ color: RESERVE.red }}>
            Emergency
          </p>
          <p className="mt-0.5 text-[13px] leading-[1.55] text-white/70">Call 911. If you are thinking about harming yourself, call or text 988.</p>
        </WRow>
        <WRow>
          <p className="text-[14px] font-semibold text-[#f2eee6]">Anything that concerns you</p>
          <p className="mt-0.5 text-[13px] leading-[1.55] text-white/70">{reviewLine}</p>
          <p className="mt-1 text-[12.5px] leading-[1.55] text-white/50">{NO_CLINICIAN_LINE}</p>
        </WRow>
      </WList>
      <div className="mt-3">
        <CareOptions />
      </div>
    </GlassPanel>
  );
}

/* ─── Small formatters ──────────────────────────────────────────────────── */

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}
