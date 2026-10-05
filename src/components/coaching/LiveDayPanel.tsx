"use client";

/* ════════════════════════════════════════════════════════════════════════
   LIVE DAY STATUS — the athlete's flagship live-day surface.

   Shows today's operating plan, detects the original/live state, runs the
   ADJUST TODAY flow (report → deterministic rebuild → preview → apply /
   keep / send to coach), reviews coach overrides, and resolves conflicts.
   Reserve salvages the day while it is still happening.
   ════════════════════════════════════════════════════════════════════════ */

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarClock, ChevronDown, ChevronUp } from "lucide-react";

import { buildAdaptedDay, type AdaptedDayResult } from "@/lib/coaching/live-day/engine";
import { buildPlannedDay } from "@/lib/coaching/live-day/day-plan";
import { formatTime, minutesToTime, todayKey } from "@/lib/coaching/ids";
import { useCoachingStore } from "@/lib/coaching/store";
import type { DayPlanVersion, LiveDayReason } from "@/lib/coaching/types";
import type { MealWindow } from "@/lib/schedule/types";
import { ConflictResolver, DayTimelineView, LiveDayEventLog, OriginalLiveToggle, OverrideDetails } from "./LiveDayShared";
import { CommandButton, DiffRow, Field, MicroLabel, Panel, PanelHeader, SegmentedControl, StatusChip, inputClass } from "./ui";

const REASON_OPTIONS: Array<{ value: LiveDayReason; label: string }> = [
  { value: "late_wake", label: "Woke up late" },
  { value: "training_time_change", label: "Training time changed" },
  { value: "training_canceled", label: "Training canceled" },
  { value: "missed_meal", label: "Missed a meal" },
  { value: "poor_sleep", label: "Poor sleep" },
  { value: "sleep_interrupted", label: "Sleep interrupted" },
  { value: "low_readiness", label: "Low energy" },
  { value: "stress_elevated", label: "Stress elevated" },
  { value: "pain_observation", label: "Pain or discomfort" },
  { value: "work_change", label: "Work schedule changed" },
  { value: "travel_delay", label: "Travel delay" },
  { value: "family_commitment", label: "Family commitment added" },
  { value: "equipment_change", label: "Equipment unavailable" },
  { value: "grocery_incomplete", label: "Grocery run incomplete" },
  { value: "meal_prep_unavailable", label: "Prepped meals unavailable" },
  { value: "restaurant_meal", label: "Restaurant meal required" },
  { value: "custom", label: "Something else" },
];

export function LiveDayPanel({
  scheduleProfile,
}: {
  /** The member's real schedule (from the athlete store) — used to establish
      today's plan when no coaching-day plan exists yet. */
  scheduleProfile?: {
    wakeTime: string;
    sleepTarget: string;
    preferredTrainingStart: string;
    mealWindows: MealWindow[];
  };
}) {
  const run = useCoachingStore((s) => s.run);
  const actorId = useCoachingStore((s) => s.actorId);
  const date = todayKey();
  const day = useCoachingStore((s) =>
    s.db.activeDayPlans.find((p) => p.athleteId === s.actorId && p.date === date) ?? null,
  );
  const liveDayOverrides = useCoachingStore((s) => s.db.liveDayOverrides);
  const overrides = useMemo(
    () => liveDayOverrides.filter((o) => o.athleteId === actorId && o.date === date),
    [liveDayOverrides, actorId, date],
  );
  const relationship = useCoachingStore((s) =>
    s.db.relationships.find((r) => r.athleteId === s.actorId && r.status === "active") ?? null,
  );
  const [adjusting, setAdjusting] = useState(false);
  const [recalibrated, setRecalibrated] = useState(false);
  const [logOpen, setLogOpen] = useState(false);

  const pendingOverride =
    overrides.find((o) => o.id === day?.activeOverrideId && o.status === "proposed") ?? null;

  const establishDay = async () => {
    const planned: DayPlanVersion = buildPlannedDay({
      wakeTime: scheduleProfile?.wakeTime ?? "06:30",
      bedTime: scheduleProfile?.sleepTarget ?? "22:30",
      trainingTime: scheduleProfile?.preferredTrainingStart ?? "17:30",
      sessionTitle: "Today's session",
      sessionDemand: "standard",
      mealTimes: (scheduleProfile?.mealWindows ?? [])
        .filter((w) => w.enabled)
        .map((w) => ({ label: w.label, time: w.time })),
    });
    if (planned.entries.filter((e) => e.kind === "meal").length === 0) {
      planned.entries.push(
        { id: "seed-m1", kind: "meal", label: "Meal 1", time: "08:00" },
        { id: "seed-m2", kind: "meal", label: "Meal 2", time: "12:30" },
        { id: "seed-m3", kind: "meal", label: "Meal 3", time: "18:30" },
      );
      planned.entries.sort((a, b) => a.time.localeCompare(b.time));
    }
    await run((r) => r.liveDay.ensureActiveDay(actorId, date, planned));
  };

  return (
    <Panel glow>
      <PanelHeader
        label="Live day status"
        title="Today's operating plan"
        right={
          !day ? (
            <StatusChip tone="neutral">Not established</StatusChip>
          ) : day.status === "original" ? (
            <StatusChip tone="green">On plan</StatusChip>
          ) : day.status === "awaiting_approval" ? (
            <StatusChip tone="teal" pulse>Awaiting approval</StatusChip>
          ) : day.status === "conflict" ? (
            <StatusChip tone="red">Conflict</StatusChip>
          ) : (
            <StatusChip tone="teal">Recalibrated</StatusChip>
          )
        }
      />
      <div className="flex flex-col gap-3.5 p-4">
        {!day ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <CalendarClock size={20} className="text-[#d5b15f]/40" />
            <p className="max-w-sm text-[11px] leading-5 text-white/45">
              Establish today&apos;s operating plan from your schedule. Once live, Reserve can rebuild
              the day the moment reality changes.
            </p>
            <CommandButton onClick={() => void establishDay()}>Establish today&apos;s plan</CommandButton>
          </div>
        ) : (
          <>
            {/* Status facts */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <StatusFact label="Original wake" value={formatTime(day.originalVersion.wakeTime)} />
              <StatusFact
                label="Actual wake"
                value={formatTime(day.liveVersion.wakeTime)}
                changed={day.liveVersion.wakeTime !== day.originalVersion.wakeTime}
              />
              <StatusFact label="Original training" value={formatTime(day.originalVersion.trainingTime)} />
              <StatusFact
                label="Training now"
                value={formatTime(day.liveVersion.trainingTime)}
                changed={day.liveVersion.trainingTime !== day.originalVersion.trainingTime}
              />
            </div>

            <AnimatePresence>
              {recalibrated && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="border-l-2 border-[#5fb7d5]/40 p-4 text-center"
                >
                  <MicroLabel tone="teal">Your day has been recalibrated</MicroLabel>
                  <div className="mt-2 flex justify-center gap-4 text-[10px] text-white/60">
                    <span>Training preserved</span>
                    <span>Nutrition redistributed</span>
                    <span>Recovery protected</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {day.status === "conflict" ? (
              <ConflictResolver day={day} overrides={overrides} />
            ) : pendingOverride ? (
              <OverrideDetails
                override={pendingOverride}
                viewer="athlete"
                onAfterAction={() => setRecalibrated(true)}
              />
            ) : (
              <OriginalLiveToggle day={day} />
            )}

            {/* Adjust today */}
            {!adjusting ? (
              <div className="flex flex-wrap gap-1.5">
                <CommandButton variant="teal" onClick={() => setAdjusting(true)}>
                  Adjust today
                </CommandButton>
                {day.status !== "original" && (
                  <CommandButton
                    variant="ghost"
                    onClick={() => void run((r) => r.liveDay.revertToOriginal(actorId, date, actorId))}
                  >
                    Restore original day
                  </CommandButton>
                )}
              </div>
            ) : (
              <AdjustTodayFlow
                day={day}
                hasCoach={Boolean(relationship)}
                onClose={() => setAdjusting(false)}
                onApplied={() => {
                  setAdjusting(false);
                  setRecalibrated(true);
                }}
              />
            )}

            {/* Operational timeline */}
            <button
              type="button"
              onClick={() => setLogOpen((v) => !v)}
              className="flex items-center gap-1.5 self-start font-mono text-[9px] uppercase tracking-[0.16em] text-white/30 transition-colors hover:text-white/60"
            >
              {logOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />} Why today changed
            </button>
            {logOpen && <LiveDayEventLog athleteId={actorId} date={date} />}
          </>
        )}
      </div>
    </Panel>
  );
}

function StatusFact({ label, value, changed = false }: { label: string; value: string; changed?: boolean }) {
  return (
    <div className={`rounded-lg border px-3 py-2 ${changed ? "border-[#5fb7d5]/25 bg-[#5fb7d5]/[0.04]" : "border-white/[0.04] bg-white/[0.015]"}`}>
      <MicroLabel>{label}</MicroLabel>
      <div className={`mt-0.5 font-mono text-[13px] font-bold tabular-nums ${changed ? "text-[#5fb7d5]" : "text-[#f2eee6]"}`}>
        {value}
      </div>
    </div>
  );
}

/* ─── ADJUST TODAY ────────────────────────────────────────────────────── */

function AdjustTodayFlow({
  day,
  hasCoach,
  onClose,
  onApplied,
}: {
  day: { originalVersion: DayPlanVersion; liveVersion: DayPlanVersion; date: string; athleteId: string };
  hasCoach: boolean;
  onClose: () => void;
  onApplied: () => void;
}) {
  const run = useCoachingStore((s) => s.run);
  const actorId = useCoachingStore((s) => s.actorId);
  const [reason, setReason] = useState<LiveDayReason>("late_wake");
  const [wake, setWake] = useState(day.liveVersion.wakeTime);
  const [trainingTime, setTrainingTime] = useState(day.liveVersion.trainingTime ?? "17:30");
  const [keepTraining, setKeepTraining] = useState(true);
  const [eaten, setEaten] = useState<string[]>([]);
  const [energy, setEnergy] = useState<"low" | "ok" | "good">("ok");
  const [bedFixed, setBedFixed] = useState<"fixed" | "flexible">("flexible");
  const [note, setNote] = useState("");
  const [previewed, setPreviewed] = useState(false);

  const meals = day.liveVersion.entries.filter((e) => e.kind === "meal" && !e.completed);

  const result: AdaptedDayResult = useMemo(
    () =>
      buildAdaptedDay({
        original: day.liveVersion,
        nowTime: minutesToTime(new Date().getHours() * 60 + new Date().getMinutes()),
        reason,
        actualWakeTime: wake !== day.liveVersion.wakeTime ? wake : undefined,
        newTrainingTime: keepTraining
          ? trainingTime !== day.liveVersion.trainingTime ? trainingTime : undefined
          : null,
        completedEntryIds: eaten,
        energyLevel: energy,
        bedtimeFixed: bedFixed === "fixed",
        createdBy: "athlete",
        customNote: note.trim() || undefined,
      }),
    [day.liveVersion, reason, wake, trainingTime, keepTraining, eaten, energy, bedFixed, note],
  );

  const submit = async (intent: "propose" | "apply") => {
    await run((r) =>
      r.liveDay.proposeOverride({
        athleteId: actorId,
        date: day.date,
        source: "athlete",
        actorId,
        reason,
        originalSnapshot: day.originalVersion,
        proposedSnapshot: result.proposed,
        explanation: result.explanation,
        impactSummary: result.impactSummary,
        warnings: result.warnings,
        intent,
      }),
    );
    if (intent === "apply") onApplied();
    else onClose();
  };

  return (
    <div className="flex flex-col gap-3.5 border-l-2 border-[#5fb7d5]/40 p-4">
      <MicroLabel tone="teal">Adjust today</MicroLabel>

      <div>
        <MicroLabel className="mb-1.5">What changed?</MicroLabel>
        <div className="flex flex-wrap gap-1.5">
          {REASON_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setReason(option.value)}
              className={`rounded-md px-2.5 py-1.5 font-mono text-[8px] uppercase tracking-[0.1em] transition-colors ${
                reason === option.value ? "bg-[#5fb7d5]/14 text-[#5fb7d5]" : "bg-white/[0.03] text-white/40 hover:text-white/70"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <Field label="Actual wake time">
          <input className={inputClass} type="time" value={wake} onChange={(e) => setWake(e.target.value)} />
        </Field>
        <Field label="Training today">
          <SegmentedControl
            size="xs"
            options={[{ value: "keep", label: "Keep" }, { value: "skip", label: "Can't train" }]}
            value={keepTraining ? "keep" : "skip"}
            onChange={(v) => setKeepTraining(v === "keep")}
          />
          {keepTraining && (
            <input className={`${inputClass} mt-1.5`} type="time" value={trainingTime} onChange={(e) => setTrainingTime(e.target.value)} />
          )}
        </Field>
      </div>

      {meals.length > 0 && (
        <div>
          <MicroLabel className="mb-1.5">Already eaten</MicroLabel>
          <div className="flex flex-wrap gap-1.5">
            {meals.map((meal) => {
              const checked = eaten.includes(meal.id);
              return (
                <button
                  key={meal.id}
                  type="button"
                  onClick={() => setEaten((prev) => (checked ? prev.filter((id) => id !== meal.id) : [...prev, meal.id]))}
                  className={`rounded-md px-2.5 py-1.5 font-mono text-[8px] uppercase tracking-[0.1em] ${
                    checked ? "bg-[#6ee7b7]/14 text-[#6ee7b7]" : "bg-white/[0.03] text-white/40"
                  }`}
                >
                  {meal.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <MicroLabel className="mb-1.5">Current energy</MicroLabel>
          <SegmentedControl
            size="xs"
            options={[{ value: "low", label: "Low" }, { value: "ok", label: "OK" }, { value: "good", label: "Good" }]}
            value={energy}
            onChange={setEnergy}
          />
        </div>
        <div>
          <MicroLabel className="mb-1.5">Bedtime tonight</MicroLabel>
          <SegmentedControl
            size="xs"
            options={[{ value: "flexible", label: "Flexible" }, { value: "fixed", label: "Fixed" }]}
            value={bedFixed}
            onChange={setBedFixed}
          />
        </div>
      </div>

      {reason === "custom" && (
        <Field label="What happened?">
          <input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      )}

      {!previewed ? (
        <CommandButton variant="teal" onClick={() => setPreviewed(true)}>
          Rebuild my day
        </CommandButton>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="border-t border-white/[0.06] p-3.5">
            <MicroLabel tone="teal" className="mb-2">Your rebuilt day</MicroLabel>
            {result.changes.length > 0 && (
              <div className="mb-2.5 flex flex-col gap-1">
                {result.changes.map((change) => (
                  <DiffRow
                    key={`${change.label}-${change.from}`}
                    label={change.label}
                    from={/^\d{2}:\d{2}$/.test(change.from) ? formatTime(change.from) : change.from}
                    to={/^\d{2}:\d{2}$/.test(change.to) ? formatTime(change.to) : change.to}
                    removed={change.kind === "removed"}
                  />
                ))}
              </div>
            )}
            <DayTimelineView plan={result.proposed} compact />
            {result.explanation.length > 0 && (
              <ul className="mt-2.5 flex flex-col gap-1 border-t border-white/[0.05] pt-2">
                {result.explanation.map((line) => (
                  <li key={line} className="flex items-start gap-2 text-[10px] leading-4 text-white/50">
                    <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-[#5fb7d5]/60" />
                    {line}
                  </li>
                ))}
              </ul>
            )}
            {result.warnings.map((warning) => (
              <p key={warning} className="mt-2 border-l-2 border-[#e8c87a]/40 px-2.5 py-1.5 text-[10px] leading-4 text-[#e8c87a]/80">
                {warning}
              </p>
            ))}
            {result.tomorrowImpact.length > 0 && (
              <div className="mt-2 border-t border-white/[0.05] pt-2">
                <MicroLabel className="mb-1">Impact on tomorrow</MicroLabel>
                {result.tomorrowImpact.map((line) => (
                  <p key={line} className="text-[10px] leading-4 text-white/45">{line}</p>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <CommandButton variant="teal" onClick={() => void submit("apply")}>Apply live plan</CommandButton>
            <CommandButton variant="ghost" onClick={onClose}>Keep original</CommandButton>
            {hasCoach && (
              <CommandButton onClick={() => void submit("propose")}>Send to coach</CommandButton>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
