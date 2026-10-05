"use client";

import { useId, useState } from "react";

import { EscalationList } from "@/components/safety/EscalationList";
import { markCycleCheckInLogged } from "@/components/ui/reserve/log-moment/recorders";
import { ReserveBottomSheet, ReserveButton, ReserveSegmented, ReserveSheetClose, useDirtySnapshot } from "@/components/ui/reserve";
import { useAthleteDashboardStore } from "@/lib/athlete-store";
import { isDateKey } from "@/lib/cycle/cycle-period";
import {
  CHECK_IN_RATING_LABEL,
  CHECK_IN_SYMPTOMS,
  escalatingSymptoms,
  type CheckInRating,
  type CheckInRatingKey,
  type CheckInSymptomKey,
} from "@/lib/cycle-review/types";
import { RESERVE, alpha } from "@/lib/design/tokens";
import { escalationForSymptoms, type EscalationItem } from "@/lib/safety/escalation";

const INPUT =
  "mt-1 min-h-[44px] w-full rounded-[12px] border border-white/[0.08] bg-black/30 px-3 text-[16px] text-[#f2eee6] outline-none placeholder:text-white/25 focus:border-[#5fb7d5]/60 sm:text-[13px]";

const RATING_ORDER: CheckInRatingKey[] = ["training", "recovery", "sleepQuality", "mood", "libido", "appetite"];
const SYMPTOM_KEYS = Object.keys(CHECK_IN_SYMPTOMS) as CheckInSymptomKey[];
const CARE_SYMPTOMS = SYMPTOM_KEYS.filter((k) => CHECK_IN_SYMPTOMS[k].escalateTo);
const OTHER_SYMPTOMS = SYMPTOM_KEYS.filter((k) => !CHECK_IN_SYMPTOMS[k].escalateTo);

type RatingValue = "" | "1" | "2" | "3" | "4" | "5";
const RATING_SEGMENTS: Array<{ value: RatingValue; label: string }> = [
  { value: "", label: "—" },
  { value: "1", label: "1" },
  { value: "2", label: "2" },
  { value: "3", label: "3" },
  { value: "4", label: "4" },
  { value: "5", label: "5" },
];

function num(value: string, min: number, max: number): number | undefined {
  const n = Number(value);
  return value.trim() !== "" && Number.isFinite(n) && n >= min && n <= max ? n : undefined;
}

/** Fast weekly check-in. A warning-sign symptom routes straight to care. */
export function CycleCheckInSheet({
  open,
  onClose,
  cycleId,
  today,
}: {
  open: boolean;
  onClose: () => void;
  cycleId: string;
  today: string;
}) {
  const addCycleCheckIn = useAthleteDashboardStore((s) => s.addCycleCheckIn);
  const addRedFlagReport = useAthleteDashboardStore((s) => s.addRedFlagReport);
  const [date, setDate] = useState(today);
  const [weight, setWeight] = useState("");
  const [systolic, setSystolic] = useState("");
  const [diastolic, setDiastolic] = useState("");
  const [restingHr, setRestingHr] = useState("");
  const [sleepHours, setSleepHours] = useState("");
  const [ratings, setRatings] = useState<Partial<Record<CheckInRatingKey, RatingValue>>>({});
  const [symptoms, setSymptoms] = useState<CheckInSymptomKey[]>([]);
  const [newMedications, setNewMedications] = useState("");
  const [outsideChanges, setOutsideChanges] = useState("");
  const [care, setCare] = useState<EscalationItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const errorId = useId();
  /* Once saved (the care screen), nothing is left to lose. */
  const changed = useDirtySnapshot(
    { date, weight, systolic, diastolic, restingHr, sleepHours, ratings: Object.fromEntries(Object.entries(ratings).filter(([, v]) => v)), symptoms, newMedications, outsideChanges },
    open,
  );
  const dirty = open && care === null && changed;

  const carePreview = escalationForSymptoms(escalatingSymptoms(symptoms));

  const toggle = (key: CheckInSymptomKey) =>
    setSymptoms((current) => (current.includes(key) ? current.filter((s) => s !== key) : [...current, key]));

  const reset = () => {
    setWeight("");
    setSystolic("");
    setDiastolic("");
    setRestingHr("");
    setSleepHours("");
    setRatings({});
    setSymptoms([]);
    setNewMedications("");
    setOutsideChanges("");
    setCare(null);
    setError(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const save = () => {
    if (!isDateKey(date) || date > today) {
      setError("Choose today or an earlier date.");
      return;
    }
    const sys = num(systolic, 60, 260);
    const dia = num(diastolic, 30, 160);
    if ((systolic || diastolic) && (!sys || !dia)) {
      setError("Enter both blood pressure numbers, for example 124 and 80.");
      return;
    }
    const numericRatings = Object.fromEntries(
      Object.entries(ratings).filter(([, v]) => v).map(([k, v]) => [k, Number(v) as CheckInRating]),
    ) as Partial<Record<CheckInRatingKey, CheckInRating>>;
    addCycleCheckIn({
      cycleId,
      date,
      bodyweightLb: num(weight, 50, 700),
      systolic: sys,
      diastolic: dia,
      restingHr: num(restingHr, 25, 220),
      sleepHours: num(sleepHours, 0, 24),
      ratings: numericRatings,
      symptoms,
      newMedications,
      outsideChanges,
    });
    const flags = escalatingSymptoms(symptoms);
    if (flags.length > 0) {
      addRedFlagReport(flags);
      setCare(escalationForSymptoms(flags));
      return;
    }
    /* Only on the ordinary path: when the check-in routes to care, the room
       answers with the escalation, never with a logging moment. */
    markCycleCheckInLogged({ symptomCount: symptoms.length, date });
    close();
  };

  return (
    <ReserveBottomSheet open={open} onClose={close} title={care ? "Get care first" : "Weekly check-in"} accent={RESERVE.steel} dirty={dirty}>
      {care ? (
        <div className="flex flex-col gap-4">
          <p className="text-[13px] leading-[1.55] text-white/75">
            Your check-in is saved. What you entered needs medical attention before anything else — the cycle review can wait.
          </p>
          <EscalationList items={care} label="What to do now" />
          <div>
            <ReserveButton tier="secondary" onClick={close}>
              Close check-in
            </ReserveButton>
          </div>
        </div>
      ) : (
        <form
          className="flex flex-col gap-6"
          aria-describedby={error ? errorId : undefined}
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <p className="text-[12.5px] leading-[1.55] text-white/55">About a minute. Leave anything you don&apos;t track blank — blanks stay blank.</p>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="text-[11.5px] text-white/55">Date</span>
              <input className={INPUT} type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
            </label>
            <label className="block">
              <span className="text-[11.5px] text-white/55">Bodyweight (lb)</span>
              <input className={INPUT} inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} />
            </label>
            <label className="block">
              <span className="text-[11.5px] text-white/55">Resting heart rate (bpm)</span>
              <input className={INPUT} inputMode="numeric" value={restingHr} onChange={(e) => setRestingHr(e.target.value)} />
            </label>
            <fieldset className="col-span-2 sm:col-span-2">
              <legend className="text-[11.5px] text-white/55">Average blood pressure this week</legend>
              <div className="flex items-center gap-2">
                <input className={INPUT} inputMode="numeric" aria-label="Systolic" placeholder="Top" value={systolic} onChange={(e) => setSystolic(e.target.value)} />
                <span className="mt-1 text-white/35" aria-hidden="true">/</span>
                <input className={INPUT} inputMode="numeric" aria-label="Diastolic" placeholder="Bottom" value={diastolic} onChange={(e) => setDiastolic(e.target.value)} />
              </div>
            </fieldset>
            <label className="block">
              <span className="text-[11.5px] text-white/55">Sleep (hours a night)</span>
              <input className={INPUT} inputMode="decimal" value={sleepHours} onChange={(e) => setSleepHours(e.target.value)} />
            </label>
          </div>

          <fieldset className="flex flex-col gap-3">
            <legend className="text-[12px] font-semibold text-white/70">This week, 1 = poor · 5 = strong</legend>
            {RATING_ORDER.map((key) => (
              <div key={key} className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-[12.5px] text-white/70">{CHECK_IN_RATING_LABEL[key]}</span>
                <ReserveSegmented<RatingValue>
                  label={CHECK_IN_RATING_LABEL[key]}
                  size="sm"
                  accent={RESERVE.steel}
                  value={ratings[key] ?? ""}
                  onChange={(value) => setRatings((current) => ({ ...current, [key]: value }))}
                  segments={RATING_SEGMENTS}
                />
              </div>
            ))}
          </fieldset>

          <fieldset>
            <legend className="text-[12px] font-semibold" style={{ color: RESERVE.red }}>Needs care now</legend>
            <p className="mt-0.5 text-[11.5px] text-white/50">Selecting any of these shows who to contact immediately.</p>
            <div className="mt-2 grid gap-1 sm:grid-cols-2">
              {CARE_SYMPTOMS.map((key) => (
                <SymptomOption key={key} label={CHECK_IN_SYMPTOMS[key].label} checked={symptoms.includes(key)} onChange={() => toggle(key)} tone={RESERVE.red} />
              ))}
            </div>
            {carePreview.length > 0 && (
              <div className="mt-3 flex flex-col gap-2">
                <p className="text-[12.5px] leading-[1.5] text-white/75">Don&apos;t wait on this check-in. Save to record it, and act on this now:</p>
                <EscalationList items={carePreview} label="What to do now" />
              </div>
            )}
          </fieldset>

          <fieldset>
            <legend className="text-[12px] font-semibold text-white/70">Anything else this week</legend>
            <div className="mt-2 grid gap-1 sm:grid-cols-2">
              {OTHER_SYMPTOMS.map((key) => (
                <SymptomOption key={key} label={CHECK_IN_SYMPTOMS[key].label} checked={symptoms.includes(key)} onChange={() => toggle(key)} tone={RESERVE.steel} />
              ))}
            </div>
          </fieldset>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-[11.5px] text-white/55">New medications or supplements</span>
              <input className={INPUT} value={newMedications} maxLength={200} onChange={(e) => setNewMedications(e.target.value)} />
            </label>
            <label className="block">
              <span className="text-[11.5px] text-white/55">Plan changes made outside Reserve</span>
              <input className={INPUT} value={outsideChanges} maxLength={200} onChange={(e) => setOutsideChanges(e.target.value)} />
            </label>
          </div>

          {error && (
            <p id={errorId} role="alert" className="text-[12.5px]" style={{ color: RESERVE.red }}>
              {error}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <ReserveButton tier="primary" type="submit">
              Save check-in
            </ReserveButton>
            <ReserveSheetClose fallback={close}>
              {(requestClose) => (
                <ReserveButton tier="quiet" onClick={requestClose}>
                  Cancel
                </ReserveButton>
              )}
            </ReserveSheetClose>
          </div>
        </form>
      )}
    </ReserveBottomSheet>
  );
}

function SymptomOption({ label, checked, onChange, tone }: { label: string; checked: boolean; onChange: () => void; tone: string }) {
  return (
    <label
      className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-[12px] px-3 py-2 text-[12.5px] transition focus-within:ring-2 focus-within:ring-white/40"
      style={{ background: checked ? alpha(tone, 0.1) : "transparent", color: checked ? RESERVE.ivory : "rgba(255,255,255,0.66)" }}
    >
      <input type="checkbox" checked={checked} onChange={onChange} className="h-4 w-4 shrink-0" style={{ accentColor: tone }} />
      {label}
    </label>
  );
}
