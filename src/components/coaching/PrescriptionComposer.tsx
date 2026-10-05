"use client";

/* Prescription composer — structured draft builders for training,
   nutrition, and schedule prescriptions, in a Reserve sheet.

   The sheet is portaled above every shell (so a phone tab bar can never
   cover Save), and it is guarded: an outside click never discards a draft,
   and X, Cancel or Escape ask first once anything was typed. */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { ReserveBottomSheet, ReserveSheetClose, useDirtySnapshot } from "@/components/ui/reserve";
import { useCoachingStore } from "@/lib/coaching/store";
import { todayKey } from "@/lib/coaching/ids";
import type {
  CoachPrescription,
  NutritionPrescription,
  PrescribedMeal,
  PrescriptionCategory,
  PrescriptionPayload,
  ScheduleBlock,
  SchedulePrescription,
  TrainingPrescription,
  TrainingPrescriptionDay,
} from "@/lib/coaching/types";
import {
  CommandButton,
  Field,
  MicroLabel,
  SegmentedControl,
  inputClass,
} from "./ui";

/* ─── Blank payloads ──────────────────────────────────────────────────── */

function blankTraining(): TrainingPrescription {
  return {
    programName: "", durationWeeks: 8, splitName: "", daysPerWeek: 4,
    days: [blankDay("Day 1")], progressionStrategy: "Double progression", deloadWeek: null,
  };
}
function blankDay(label: string): TrainingPrescriptionDay {
  return { dayLabel: label, title: "", focus: "", demand: "standard", exercises: [] };
}
/* Targets start empty: the coach enters every number. Reserve never proposes one. */
function blankNutrition(): NutritionPrescription {
  return {
    planName: "", mode: "hybrid",
    trainingDay: { kcal: 0, protein: 0, carbs: 0, fat: 0, mealCount: 4 },
    restDay: { kcal: 0, protein: 0, carbs: 0, fat: 0, mealCount: 4 },
    meals: [],
  };
}
function blankSchedule(): SchedulePrescription {
  return {
    planName: "", wakeTarget: "06:30", bedTarget: "22:30", trainingTime: "17:30",
    trainingDays: ["Mon", "Tue", "Thu", "Fri"], checkInDay: "Sunday", photoDay: null,
    blocks: [
      { id: "blk-wake", label: "Wake", kind: "wake", time: "06:30" },
      { id: "blk-train", label: "Training", kind: "training", time: "17:30", durationMinutes: 75 },
      { id: "blk-bed", label: "Bedtime", kind: "bed", time: "22:30" },
    ],
  };
}

export type ComposerSeed = {
  category: PrescriptionCategory;
  athleteId: string;
  /** Editing an existing draft. */
  editing?: CoachPrescription;
  /** Revising a rejected/revision-requested prescription. */
  revisingFrom?: CoachPrescription;
  /** Starting payload (from a template or an active plan). */
  initialPayload?: PrescriptionPayload;
  /** Links a new draft back to the check-in review that created it. */
  sourceCheckInId?: string;
};

const CATEGORY_NOUN: Record<PrescriptionCategory, string> = {
  training: "program",
  nutrition: "nutrition plan",
  schedule: "schedule",
};

const TRASH =
  "grid min-h-[44px] min-w-[44px] shrink-0 place-items-center rounded-md text-white/45 transition-colors hover:text-[#ef7d55]";

export function PrescriptionComposer({ seed, onClose }: { seed: ComposerSeed; onClose: () => void }) {
  const run = useCoachingStore((s) => s.run);
  const actorId = useCoachingStore((s) => s.actorId);
  const athleteName = useCoachingStore(
    (s) => s.db.members.find((m) => m.id === seed.athleteId)?.name ?? "Athlete",
  );

  /* The sheet re-focuses its panel whenever onClose changes identity; hold the caller's in a ref. */
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });
  const close = useCallback(() => onCloseRef.current(), []);

  const base = seed.editing?.payload ?? seed.revisingFrom?.payload ?? seed.initialPayload;
  const [title, setTitle] = useState(seed.editing?.title ?? seed.revisingFrom?.title ?? "");
  const [reason, setReason] = useState(seed.editing?.reason ?? "");
  const [summary, setSummary] = useState((seed.editing?.summaryOfChanges ?? []).join("\n"));
  const [effectiveDate, setEffectiveDate] = useState(seed.editing?.effectiveDate ?? todayKey());

  const [training, setTraining] = useState<TrainingPrescription>(() =>
    base?.category === "training" ? structuredClone(base.training) : blankTraining());
  const [nutrition, setNutrition] = useState<NutritionPrescription>(() =>
    base?.category === "nutrition" ? structuredClone(base.nutrition) : blankNutrition());
  const [schedule, setSchedule] = useState<SchedulePrescription>(() =>
    base?.category === "schedule" ? structuredClone(base.schedule) : blankSchedule());

  const dirty = useDirtySnapshot({ title, reason, summary, effectiveDate, training, nutrition, schedule });

  const payload: PrescriptionPayload = useMemo(() => {
    if (seed.category === "training") return { category: "training", training };
    if (seed.category === "nutrition") return { category: "nutrition", nutrition };
    return { category: "schedule", schedule };
  }, [seed.category, training, nutrition, schedule]);

  const valid =
    title.trim().length > 1 &&
    reason.trim().length > 1 &&
    (seed.category !== "training" || training.days.length > 0);

  const save = async () => {
    const summaryOfChanges = summary.split("\n").map((s) => s.trim()).filter(Boolean);
    if (seed.editing) {
      await run((r) =>
        r.prescriptions.updateDraft(seed.editing!.id, actorId, {
          title, reason, summaryOfChanges, payload, effectiveDate,
        }),
      );
    } else {
      await run((r) =>
        r.prescriptions.createDraft({
          coachId: actorId,
          athleteId: seed.athleteId,
          category: seed.category,
          title, reason, summaryOfChanges, payload, effectiveDate,
          previousVersionId: seed.revisingFrom?.id,
          linkedCheckInId: seed.sourceCheckInId,
        }),
      );
    }
    close();
  };

  const heading = seed.editing
    ? `Edit ${CATEGORY_NOUN[seed.category]} draft`
    : seed.revisingFrom
      ? `Revise ${CATEGORY_NOUN[seed.category]} (v${seed.revisingFrom.version})`
      : `New ${CATEGORY_NOUN[seed.category]}`;

  return (
    <ReserveBottomSheet
      open
      onClose={close}
      title={`${heading} · ${athleteName}`}
      dirty={dirty}
      footer={
        <div data-coach="composer-footer" className="flex flex-col gap-2">
          <div className="flex gap-2">
            <ReserveSheetClose fallback={close}>
              {(requestClose) => <CommandButton variant="ghost" onClick={requestClose}>Cancel</CommandButton>}
            </ReserveSheetClose>
            <CommandButton
              className="flex-1"
              disabled={!valid}
              disabledReason="Title, reason, and at least one training day are required"
              onClick={() => void save()}
            >
              {seed.editing ? "Save draft" : "Create draft"}
            </CommandButton>
          </div>
          <p className="text-center text-[11px] text-white/50">A draft never changes the athlete&apos;s active plan.</p>
        </div>
      }
    >
      <div className="flex flex-col gap-3 pb-2">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Title">
            <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Plan name" />
          </Field>
          <Field label="Effective date">
            <input className={inputClass} type="date" value={effectiveDate ?? ""} onChange={(e) => setEffectiveDate(e.target.value)} />
          </Field>
        </div>
        <Field label="Reason" hint="Why this plan or change exists. The athlete sees it.">
          <input className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Weekly average below the planned band" />
        </Field>
        <Field label="Summary of changes" hint="One change per line.">
          <textarea className={`${inputClass} min-h-[56px] resize-none`} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder={"Training-day carbs +25 g\nMeal 4 moved after training"} />
        </Field>

        {seed.category === "training" && <TrainingEditor value={training} onChange={setTraining} />}
        {seed.category === "nutrition" && <NutritionEditor value={nutrition} onChange={setNutrition} />}
        {seed.category === "schedule" && <ScheduleEditor value={schedule} onChange={setSchedule} />}
      </div>
    </ReserveBottomSheet>
  );
}

/* ─── Training editor ─────────────────────────────────────────────────── */

function TrainingEditor({ value, onChange }: { value: TrainingPrescription; onChange: (t: TrainingPrescription) => void }) {
  const set = (patch: Partial<TrainingPrescription>) => onChange({ ...value, ...patch });
  const setDay = (i: number, patch: Partial<TrainingPrescriptionDay>) => {
    const days = value.days.map((d, idx) => (idx === i ? { ...d, ...patch } : d));
    onChange({ ...value, days });
  };
  return (
    <div className="flex flex-col gap-3 border-t border-white/[0.06] pt-3">
      <MicroLabel tone="champagne">Program structure</MicroLabel>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="Duration (wks)">
          <input className={inputClass} type="number" min={1} max={52} value={value.durationWeeks}
            onChange={(e) => set({ durationWeeks: Number(e.target.value) || 1 })} />
        </Field>
        <Field label="Days / week">
          <input className={inputClass} type="number" min={1} max={7} value={value.daysPerWeek}
            onChange={(e) => set({ daysPerWeek: Number(e.target.value) || 1 })} />
        </Field>
        <Field label="Deload week">
          <input className={inputClass} type="number" min={0} value={value.deloadWeek ?? 0}
            onChange={(e) => set({ deloadWeek: Number(e.target.value) || null })} />
        </Field>
        <Field label="Split name">
          <input className={inputClass} value={value.splitName} onChange={(e) => set({ splitName: e.target.value })} placeholder="e.g. Upper / Lower" />
        </Field>
      </div>
      <Field label="Progression strategy">
        <input className={inputClass} value={value.progressionStrategy} onChange={(e) => set({ progressionStrategy: e.target.value })} />
      </Field>

      {value.days.map((day, i) => (
        <div key={i} className="border-l-2 border-white/[0.1] pl-3">
          <div className="flex items-center justify-between gap-2">
            <MicroLabel>{day.dayLabel}</MicroLabel>
            <div className="flex items-center gap-1.5">
              <SegmentedControl
                size="xs"
                label={`${day.dayLabel} demand`}
                options={[
                  { value: "recovery", label: "Rec" }, { value: "standard", label: "Std" },
                  { value: "high", label: "High" }, { value: "elite", label: "Elite" },
                ]}
                value={day.demand}
                onChange={(demand) => setDay(i, { demand })}
              />
              <button type="button" aria-label={`Remove ${day.dayLabel}`} onClick={() => onChange({ ...value, days: value.days.filter((_, idx) => idx !== i) })} className={TRASH}>
                <Trash2 size={13} aria-hidden="true" />
              </button>
            </div>
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <input className={inputClass} aria-label={`${day.dayLabel} session title`} value={day.title} onChange={(e) => setDay(i, { title: e.target.value })} placeholder="Session title" />
            <input className={inputClass} aria-label={`${day.dayLabel} focus`} value={day.focus} onChange={(e) => setDay(i, { focus: e.target.value })} placeholder="Focus" />
          </div>
          <div className="mt-2 flex flex-col gap-1.5">
            {day.exercises.map((exercise, ei) => (
              <div key={ei} className="grid grid-cols-[1fr_52px_64px_44px] items-center gap-1.5 sm:grid-cols-[1fr_52px_64px_72px_44px]">
                <input className={inputClass} aria-label="Exercise" value={exercise.name} placeholder="Exercise"
                  onChange={(e) => setDay(i, { exercises: day.exercises.map((x, idx) => idx === ei ? { ...x, name: e.target.value } : x) })} />
                <input className={inputClass} aria-label="Sets" type="number" min={1} value={exercise.sets}
                  onChange={(e) => setDay(i, { exercises: day.exercises.map((x, idx) => idx === ei ? { ...x, sets: Number(e.target.value) || 1 } : x) })} />
                <input className={inputClass} aria-label="Rep range" value={exercise.reps} placeholder="Reps"
                  onChange={(e) => setDay(i, { exercises: day.exercises.map((x, idx) => idx === ei ? { ...x, reps: e.target.value } : x) })} />
                <input className={`${inputClass} max-sm:order-last max-sm:col-span-3`} aria-label="Effort target" value={exercise.rir ?? ""} placeholder="RIR/RPE"
                  onChange={(e) => setDay(i, { exercises: day.exercises.map((x, idx) => idx === ei ? { ...x, rir: e.target.value || undefined } : x) })} />
                <button type="button" aria-label={`Remove ${exercise.name || "exercise"}`} onClick={() => setDay(i, { exercises: day.exercises.filter((_, idx) => idx !== ei) })} className={TRASH}>
                  <Trash2 size={13} aria-hidden="true" />
                </button>
              </div>
            ))}
            <CommandButton variant="ghost" className="self-start" onClick={() => setDay(i, { exercises: [...day.exercises, { name: "", sets: 3, reps: "8-10" }] })}>
              <Plus size={11} aria-hidden="true" /> Exercise
            </CommandButton>
          </div>
          <input className={`${inputClass} mt-2`} aria-label={`${day.dayLabel} cardio`} value={day.cardio ?? ""} placeholder="Cardio (optional)"
            onChange={(e) => setDay(i, { cardio: e.target.value || undefined })} />
        </div>
      ))}
      <CommandButton variant="ghost" className="self-start" onClick={() => onChange({ ...value, days: [...value.days, blankDay(`Day ${value.days.length + 1}`)] })}>
        <Plus size={11} aria-hidden="true" /> Add training day
      </CommandButton>
      <Field label="Coaching notes (optional)">
        <textarea className={`${inputClass} min-h-[48px] resize-none`} value={value.coachingNotes ?? ""}
          onChange={(e) => set({ coachingNotes: e.target.value || undefined })} />
      </Field>
    </div>
  );
}

/* ─── Nutrition editor ────────────────────────────────────────────────── */

function NutritionEditor({ value, onChange }: { value: NutritionPrescription; onChange: (n: NutritionPrescription) => void }) {
  const set = (patch: Partial<NutritionPrescription>) => onChange({ ...value, ...patch });
  const targetEditor = (key: "trainingDay" | "restDay", label: string) => {
    const t = value[key];
    const setT = (patch: Partial<typeof t>) => set({ [key]: { ...t, ...patch } } as Partial<NutritionPrescription>);
    return (
      <div className="border-l-2 border-white/[0.1] pl-3">
        <MicroLabel className="mb-2">{label}</MicroLabel>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {([["kcal", "kcal"], ["protein", "Protein g"], ["carbs", "Carbs g"], ["fat", "Fat g"], ["mealCount", "Meals"]] as const).map(([field, fieldLabel]) => (
            <Field key={field} label={fieldLabel}>
              <input className={inputClass} type="number" min={0} value={t[field]}
                onChange={(e) => setT({ [field]: Number(e.target.value) || 0 } as Partial<typeof t>)} />
            </Field>
          ))}
        </div>
      </div>
    );
  };
  const setMeal = (i: number, patch: Partial<PrescribedMeal>) =>
    set({ meals: value.meals.map((m, idx) => (idx === i ? { ...m, ...patch } : m)) });

  return (
    <div className="flex flex-col gap-3 border-t border-white/[0.06] pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <MicroLabel tone="champagne">Nutrition mode</MicroLabel>
        <SegmentedControl
          size="xs"
          label="Nutrition mode"
          options={[
            { value: "macro", label: "Macro" }, { value: "exact_meals", label: "Exact" },
            { value: "meal_template", label: "Template" }, { value: "hybrid", label: "Hybrid" },
          ]}
          value={value.mode}
          onChange={(mode) => set({ mode })}
        />
      </div>
      {targetEditor("trainingDay", "Training-day targets")}
      {targetEditor("restDay", "Rest-day targets")}

      {value.mode !== "macro" && (
        <>
          {value.meals.map((meal, i) => (
            <div key={i} className="border-l-2 border-white/[0.1] pl-3">
              <div className="flex items-center justify-between gap-2">
                <input className={inputClass} aria-label="Meal name" value={meal.name} placeholder="Meal name"
                  onChange={(e) => setMeal(i, { name: e.target.value })} />
                <button type="button" aria-label={`Remove ${meal.name || "meal"}`} onClick={() => set({ meals: value.meals.filter((_, idx) => idx !== i) })} className={TRASH}>
                  <Trash2 size={13} aria-hidden="true" />
                </button>
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <input className={inputClass} aria-label="Time window" value={meal.timeWindow} placeholder="Time window (e.g. 7:00–7:45 AM)"
                  onChange={(e) => setMeal(i, { timeWindow: e.target.value })} />
                <input className={inputClass} aria-label="Foods"
                  value={meal.foods.map((f) => `${f.food} ${f.portion}`.trim()).join(", ")}
                  placeholder="Foods (comma-separated: Oats 100 g, Whey 40 g)"
                  onChange={(e) =>
                    setMeal(i, {
                      foods: e.target.value.split(",").map((chunk) => {
                        const parts = chunk.trim().split(/\s+(?=\d)/);
                        return { food: parts[0] ?? chunk.trim(), portion: parts.slice(1).join(" ") };
                      }).filter((f) => f.food),
                    })
                  } />
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(["pre-training", "post-training", "flexible"] as const).map((tag) => {
                  const active = (meal.tags ?? []).includes(tag);
                  return (
                    <button key={tag} type="button" aria-pressed={active}
                      onClick={() => setMeal(i, { tags: active ? (meal.tags ?? []).filter((t) => t !== tag) : [...(meal.tags ?? []), tag] })}
                      className={`min-h-[36px] rounded-md px-2.5 font-mono text-[9px] uppercase tracking-[0.1em] ${active ? "bg-[#5fb7d5]/14 text-[#5fb7d5]" : "text-white/55"}`}>
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <CommandButton variant="ghost" className="self-start"
            onClick={() => set({ meals: [...value.meals, { name: `Meal ${value.meals.length + 1}`, timeWindow: "", foods: [] }] })}>
            <Plus size={11} aria-hidden="true" /> Add meal
          </CommandButton>
        </>
      )}
      <Field label="Coaching notes (optional)">
        <textarea className={`${inputClass} min-h-[48px] resize-none`} value={value.coachingNotes ?? ""}
          onChange={(e) => set({ coachingNotes: e.target.value || undefined })} />
      </Field>
    </div>
  );
}

/* ─── Schedule editor ─────────────────────────────────────────────────── */

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const BLOCK_KINDS: Array<ScheduleBlock["kind"]> = [
  "wake", "meal", "training", "cardio", "work", "steps", "mobility", "recovery",
  "check-in", "photos", "travel", "activity", "appointment", "bed",
];

function ScheduleEditor({ value, onChange }: { value: SchedulePrescription; onChange: (s: SchedulePrescription) => void }) {
  const set = (patch: Partial<SchedulePrescription>) => onChange({ ...value, ...patch });
  const setBlock = (i: number, patch: Partial<ScheduleBlock>) =>
    set({ blocks: value.blocks.map((b, idx) => (idx === i ? { ...b, ...patch } : b)) });
  return (
    <div className="flex flex-col gap-3 border-t border-white/[0.06] pt-3">
      <MicroLabel tone="champagne">Weekly anchors</MicroLabel>
      <div className="grid grid-cols-3 gap-2">
        <Field label="Wake target"><input className={inputClass} type="time" value={value.wakeTarget} onChange={(e) => set({ wakeTarget: e.target.value })} /></Field>
        <Field label="Training time"><input className={inputClass} type="time" value={value.trainingTime} onChange={(e) => set({ trainingTime: e.target.value })} /></Field>
        <Field label="Bed target"><input className={inputClass} type="time" value={value.bedTarget} onChange={(e) => set({ bedTarget: e.target.value })} /></Field>
      </div>
      <div>
        <MicroLabel className="mb-1.5">Training days</MicroLabel>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Training days">
          {WEEKDAYS.map((day) => {
            const active = value.trainingDays.includes(day);
            return (
              <button key={day} type="button" aria-pressed={active}
                onClick={() => set({ trainingDays: active ? value.trainingDays.filter((d) => d !== day) : [...value.trainingDays, day] })}
                className={`min-h-[40px] min-w-[44px] rounded-md px-2.5 font-mono text-[9px] uppercase tracking-[0.1em] ${active ? "bg-white/[0.1] text-[#f2eee6]" : "text-white/55"}`}>
                {day}
              </button>
            );
          })}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Field label="Check-in day">
          <select className={inputClass} value={value.checkInDay} onChange={(e) => set({ checkInDay: e.target.value })}>
            {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((d) => <option key={d}>{d}</option>)}
          </select>
        </Field>
        <Field label="Photo day">
          <select className={inputClass} value={value.photoDay ?? ""} onChange={(e) => set({ photoDay: e.target.value || null })}>
            <option value="">None</option>
            {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((d) => <option key={d}>{d}</option>)}
          </select>
        </Field>
        <Field label="Steps target">
          <input className={inputClass} type="number" min={0} step={500} value={value.stepsTarget ?? 0}
            onChange={(e) => set({ stepsTarget: Number(e.target.value) || undefined })} />
        </Field>
      </div>

      <MicroLabel className="mt-1">Day blocks</MicroLabel>
      <div className="flex flex-col gap-1.5">
        {value.blocks.map((block, i) => (
          <div key={block.id} className="grid grid-cols-[92px_1fr_44px] items-center gap-1.5 sm:grid-cols-[92px_110px_1fr_44px]">
            <input className={inputClass} aria-label="Block time" type="time" value={block.time} onChange={(e) => setBlock(i, { time: e.target.value })} />
            <select className={`${inputClass} max-sm:order-last max-sm:col-span-2`} aria-label="Block kind" value={block.kind} onChange={(e) => setBlock(i, { kind: e.target.value as ScheduleBlock["kind"] })}>
              {BLOCK_KINDS.map((kind) => <option key={kind} value={kind}>{kind}</option>)}
            </select>
            <input className={inputClass} aria-label="Block label" value={block.label} placeholder="Label" onChange={(e) => setBlock(i, { label: e.target.value })} />
            <button type="button" aria-label={`Remove ${block.label || "block"}`} onClick={() => set({ blocks: value.blocks.filter((_, idx) => idx !== i) })} className={TRASH}>
              <Trash2 size={13} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
      <CommandButton variant="ghost" className="self-start"
        onClick={() => set({ blocks: [...value.blocks, { id: `blk-${Date.now()}`, label: "", kind: "meal", time: "12:00" }] })}>
        <Plus size={11} aria-hidden="true" /> Add block
      </CommandButton>
      <Field label="Cardio note (optional)">
        <input className={inputClass} value={value.cardioNote ?? ""} onChange={(e) => set({ cardioNote: e.target.value || undefined })} />
      </Field>
    </div>
  );
}
