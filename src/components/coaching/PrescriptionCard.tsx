"use client";

/* Prescription rendering + lifecycle surfaces, shared by coach and athlete.
   The athlete "preview" the coach sees is literally this same payload view,
   in a Reserve sheet portaled above every shell — so on a phone no tab bar
   can sit over its controls. */

import { useCallback, useState } from "react";
import { ChevronDown, ChevronUp, Eye } from "lucide-react";

import { ReserveBottomSheet } from "@/components/ui/reserve";
import { startsOnLaterDay } from "@/lib/coaching/effective-date";
import { canManage } from "@/lib/coaching/permissions";
import { useCoachingStore } from "@/lib/coaching/store";
import type {
  CoachPrescription,
  NutritionPrescription,
  PrescriptionPayload,
  SchedulePrescription,
  TrainingPrescription,
} from "@/lib/coaching/types";
import { formatTime } from "@/lib/coaching/ids";
import {
  CommandButton,
  Field,
  MicroLabel,
  Panel,
  StatusChip,
  dayLabel,
  inputClass,
  relativeTime,
} from "./ui";

export const STATUS_TONE: Record<CoachPrescription["status"], { tone: "neutral" | "champagne" | "teal" | "green" | "amber" | "red"; label: string }> = {
  draft: { tone: "neutral", label: "Draft" },
  ready_for_review: { tone: "neutral", label: "Ready to send" },
  sent: { tone: "teal", label: "Awaiting athlete" },
  accepted: { tone: "green", label: "Accepted" },
  active: { tone: "green", label: "Active" },
  rejected: { tone: "red", label: "Declined" },
  revision_requested: { tone: "amber", label: "Revision requested" },
  replaced: { tone: "neutral", label: "Replaced" },
  archived: { tone: "neutral", label: "Archived" },
};

const CATEGORY_LABEL: Record<CoachPrescription["category"], string> = {
  training: "Program",
  nutrition: "Nutrition plan",
  schedule: "Schedule",
};

export function PrescriptionCard({
  prescription,
  viewer,
  onEdit,
  onRevise,
  athleteName,
}: {
  prescription: CoachPrescription;
  viewer: "coach" | "athlete";
  onEdit?: (rx: CoachPrescription) => void;
  onRevise?: (rx: CoachPrescription) => void;
  /** Shown on coach lists that span clients. */
  athleteName?: string;
}) {
  const run = useCoachingStore((s) => s.run);
  const actorId = useCoachingStore((s) => s.actorId);
  const relationship = useCoachingStore((s) =>
    s.db.relationships.find(
      (r) => r.coachId === prescription.coachId && r.athleteId === prescription.athleteId && r.status === "active",
    ) ?? null,
  );
  const [expanded, setExpanded] = useState(false);
  const [preview, setPreview] = useState(false);
  const [responseNote, setResponseNote] = useState("");
  const [responding, setResponding] = useState<"reject" | "revise" | null>(null);
  const closePreview = useCallback(() => setPreview(false), []);

  const status = STATUS_TONE[prescription.status];
  const isEditable = prescription.status === "draft" || prescription.status === "ready_for_review";
  const mayApplyNow = viewer === "coach" && canManage(relationship, prescription.category);
  const detailsId = `rx-details-${prescription.id}`;

  return (
    <Panel className="p-0 md:p-5" as="article">
      <div id={`rx-${prescription.id}`} tabIndex={-1} className="flex scroll-mt-24 flex-col gap-2 py-1 outline-none" data-coach="prescription">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/55">
                {athleteName ? `${athleteName} · ` : ""}
                {CATEGORY_LABEL[prescription.category]} · v{prescription.version}
              </span>
              <StatusChip tone={status.tone}>{status.label}</StatusChip>
            </p>
            <h3 className="mt-1 text-[15px] font-semibold text-[#f2eee6]">{prescription.title}</h3>
            <p className="mt-0.5 text-[12px] leading-[1.45] text-white/60">
              {prescription.reason} · Updated {relativeTime(prescription.updatedAt).toLowerCase()}
              {prescription.effectiveDate && ` · From ${dayLabel(prescription.effectiveDate)}`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-controls={detailsId}
            aria-label={expanded ? `Hide ${prescription.title} details` : `Show ${prescription.title} details`}
            className="grid min-h-[44px] min-w-[44px] shrink-0 place-items-center rounded-lg text-white/55 transition-colors hover:text-white/90"
          >
            {expanded ? <ChevronUp size={15} aria-hidden="true" /> : <ChevronDown size={15} aria-hidden="true" />}
          </button>
        </div>

        {prescription.summaryOfChanges.length > 0 && (
          <ul className="flex flex-col gap-0.5">
            {prescription.summaryOfChanges.map((change) => (
              <li key={change} className="flex items-start gap-2 text-[12px] text-white/65">
                <span aria-hidden="true" className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-[#5fb7d5]/60" />
                {change}
              </li>
            ))}
          </ul>
        )}

        {prescription.athleteResponseNote && (
          <p className="border-l-2 border-[#e8c87a]/40 pl-3 text-[12px] text-[#e8c87a]">
            Athlete: “{prescription.athleteResponseNote}”
          </p>
        )}

        {expanded && (
          <div id={detailsId} className="mt-1">
            <PrescriptionPayloadView payload={prescription.payload} />
            <div className="mt-3 border-t border-white/[0.05] pt-2">
              <MicroLabel className="mb-1">Version history</MicroLabel>
              {prescription.audit.map((entry, i) => (
                <div key={i} className="flex items-center justify-between gap-3 py-0.5 text-[11px]">
                  <span className="text-white/60">{entry.event.replace(/_/g, " ")}{entry.detail ? ` — ${entry.detail}` : ""}</span>
                  <span className="tnum font-mono text-white/45">{relativeTime(entry.at)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Lifecycle actions */}
        <div className="mt-1 flex flex-wrap gap-1.5">
          {viewer === "coach" && (
            <>
              <CommandButton variant="ghost" onClick={() => setPreview(true)}>
                <Eye size={12} aria-hidden="true" /> Athlete view
              </CommandButton>
              {isEditable && onEdit && (
                <CommandButton variant="ghost" onClick={() => onEdit(prescription)}>Edit draft</CommandButton>
              )}
              {prescription.status === "draft" && (
                <CommandButton
                  variant="ghost"
                  onClick={() => void run((r) => r.prescriptions.markReadyForReview(prescription.id, actorId))}
                >
                  Mark ready
                </CommandButton>
              )}
              {prescription.status === "ready_for_review" && (
                <CommandButton
                  variant="teal"
                  onClick={() => void run((r) => r.prescriptions.publish(prescription.id, actorId, "send_for_approval"))}
                >
                  Send for approval
                </CommandButton>
              )}
              {isEditable && (
                <CommandButton
                  disabled={!mayApplyNow}
                  disabledReason="Applying directly needs full management access for this category"
                  onClick={() => void run((r) => r.prescriptions.publish(prescription.id, actorId, "apply_now"))}
                >
                  Apply now
                </CommandButton>
              )}
              {(prescription.status === "rejected" || prescription.status === "revision_requested") && onRevise && (
                <CommandButton onClick={() => onRevise(prescription)}>Create revision</CommandButton>
              )}
              {prescription.status !== "archived" && !isEditable && prescription.status !== "active" && (
                <CommandButton
                  variant="ghost"
                  onClick={() => void run((r) => r.prescriptions.archive(prescription.id, actorId))}
                >
                  Archive
                </CommandButton>
              )}
            </>
          )}

          {viewer === "athlete" && prescription.status === "sent" && (
            <>
              <CommandButton
                onClick={() => void run((r) => r.prescriptions.accept(prescription.id, actorId))}
              >
                {startsOnLaterDay(prescription.effectiveDate) ? "Accept plan" : "Accept & activate"}
              </CommandButton>
              <CommandButton variant="ghost" onClick={() => setResponding("revise")}>Request revision</CommandButton>
              <CommandButton variant="danger" onClick={() => setResponding("reject")}>Decline</CommandButton>
            </>
          )}
        </div>

        {responding && (
          <div className="mt-1 flex flex-col gap-2 border-l-2 border-white/[0.12] pl-3.5">
            <Field label={responding === "reject" ? "Why are you declining? (optional)" : "What should change?"}>
              <input
                className={inputClass}
                value={responseNote}
                onChange={(e) => setResponseNote(e.target.value)}
                placeholder={responding === "reject" ? "Optional note to your coach" : "Tell your coach what to revise"}
              />
            </Field>
            <div className="flex gap-2">
              <CommandButton
                variant={responding === "reject" ? "danger" : "primary"}
                disabled={responding === "revise" && !responseNote.trim()}
                disabledReason="Describe the revision you need"
                onClick={() => {
                  if (responding === "reject") {
                    void run((r) => r.prescriptions.reject(prescription.id, actorId, responseNote.trim() || undefined));
                  } else {
                    void run((r) => r.prescriptions.requestRevision(prescription.id, actorId, responseNote.trim()));
                  }
                  setResponding(null);
                  setResponseNote("");
                }}
              >
                {responding === "reject" ? "Confirm decline" : "Send revision request"}
              </CommandButton>
              <CommandButton variant="ghost" onClick={() => setResponding(null)}>Cancel</CommandButton>
            </div>
          </div>
        )}
      </div>

      {/* Athlete-experience preview */}
      <ReserveBottomSheet
        open={preview}
        onClose={closePreview}
        title={`Athlete view · ${prescription.title}`}
        footer={
          <CommandButton className="w-full" variant="ghost" onClick={closePreview}>
            Close preview
          </CommandButton>
        }
      >
        <p className="mb-3 text-[12px] text-white/60">{prescription.reason}</p>
        <PrescriptionPayloadView payload={prescription.payload} />
      </ReserveBottomSheet>
    </Panel>
  );
}

/* ─── Payload rendering ───────────────────────────────────────────────── */

export function PrescriptionPayloadView({ payload }: { payload: PrescriptionPayload }) {
  if (payload.category === "training") return <TrainingPayload training={payload.training} />;
  if (payload.category === "nutrition") return <NutritionPayload nutrition={payload.nutrition} />;
  return <SchedulePayload schedule={payload.schedule} />;
}

function Facts({ items }: { items: Array<string | false | null | undefined> }) {
  return (
    <p className="tnum text-[12px] text-white/65">{items.filter(Boolean).join(" · ")}</p>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="border-l-2 border-[#d5b15f]/30 pl-3 text-[12px] leading-[1.5] text-white/70">{children}</p>;
}

function TrainingPayload({ training }: { training: TrainingPrescription }) {
  return (
    <div className="flex flex-col gap-2">
      <Facts
        items={[
          `${training.durationWeeks} weeks`,
          `${training.daysPerWeek} days/week`,
          training.splitName,
          training.deloadWeek ? `Deload week ${training.deloadWeek}` : null,
        ]}
      />
      <p className="text-[12px] text-white/60">Progression: {training.progressionStrategy}</p>
      <ul className="flex flex-col [&>li+li]:border-t [&>li+li]:border-white/[0.05]">
        {training.days.map((day) => (
          <li key={day.dayLabel} className="py-2.5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <MicroLabel>{day.dayLabel}</MicroLabel>
                <p className="text-[13px] font-semibold text-[#f2eee6]">{day.title}</p>
                <p className="text-[11.5px] text-white/55">{day.focus}</p>
              </div>
              <StatusChip tone="neutral">{day.demand}</StatusChip>
            </div>
            {day.exercises.length > 0 && (
              <div className="mt-1.5 flex flex-col">
                {day.exercises.map((exercise) => (
                  <div key={exercise.name} className="flex items-baseline justify-between gap-2 py-0.5 text-[11.5px]">
                    <span className="text-white/70">
                      {exercise.name}
                      {exercise.substitution && <span className="text-white/45"> · sub: {exercise.substitution}</span>}
                    </span>
                    <span className="tnum whitespace-nowrap font-mono text-white/55">
                      {exercise.sets}×{exercise.reps}
                      {exercise.rir ? ` · ${exercise.rir}` : ""}
                      {exercise.tempo ? ` · ${exercise.tempo}` : ""}
                      {exercise.restSeconds ? ` · ${exercise.restSeconds}s` : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {day.cardio && <p className="mt-1 text-[11.5px] text-[#5fb7d5]">Cardio: {day.cardio}</p>}
          </li>
        ))}
      </ul>
      {training.coachingNotes && <Note>{training.coachingNotes}</Note>}
    </div>
  );
}

function NutritionPayload({ nutrition }: { nutrition: NutritionPrescription }) {
  const target = (label: string, t: NutritionPrescription["trainingDay"]) => (
    <div>
      <MicroLabel className="mb-1">{label}</MicroLabel>
      <dl className="grid grid-cols-4 gap-2">
        {([["kcal", t.kcal], ["Protein", t.protein], ["Carbs", t.carbs], ["Fat", t.fat]] as const).map(([l, v]) => (
          <div key={l}>
            <dt className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/50">{l}</dt>
            <dd className="tnum text-[14px] font-bold text-[#f2eee6]">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-1 text-[11px] text-white/50">
        {t.mealCount} meals{t.fiber ? ` · ${t.fiber}g fiber` : ""}{t.waterLiters ? ` · ${t.waterLiters}L water` : ""}
      </p>
    </div>
  );
  return (
    <div className="flex flex-col gap-3">
      <Facts items={[`Mode: ${nutrition.mode.replace(/_/g, " ")}`]} />
      <div className="grid gap-3 sm:grid-cols-2">
        {target("Training day", nutrition.trainingDay)}
        {target("Rest day", nutrition.restDay)}
      </div>
      {nutrition.meals.length > 0 && (
        <ul className="flex flex-col [&>li+li]:border-t [&>li+li]:border-white/[0.05]">
          {nutrition.meals.map((meal) => (
            <li key={meal.name} className="py-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[12.5px] font-semibold text-[#f2eee6]">{meal.name}</p>
                <span className="tnum font-mono text-[10px] text-white/55">{meal.timeWindow}</span>
              </div>
              <p className="mt-0.5 text-[11.5px] text-white/65">{meal.foods.map((f) => `${f.food} ${f.portion}`.trim()).join(" · ")}</p>
              {(meal.estMacros || (meal.tags ?? []).length > 0) && (
                <p className="tnum mt-0.5 font-mono text-[10px] text-white/50">
                  {meal.estMacros ? `~${meal.estMacros.kcal} kcal · ${meal.estMacros.protein}P/${meal.estMacros.carbs}C/${meal.estMacros.fat}F` : ""}
                  {meal.estMacros && (meal.tags ?? []).length > 0 ? " · " : ""}
                  {(meal.tags ?? []).join(" · ")}
                </p>
              )}
              {meal.substitutions && meal.substitutions.length > 0 && (
                <p className="mt-0.5 text-[11px] text-white/50">Swaps: {meal.substitutions.join(", ")}</p>
              )}
            </li>
          ))}
        </ul>
      )}
      {nutrition.coachingNotes && <Note>{nutrition.coachingNotes}</Note>}
      <p className="text-[11px] text-white/50">Food structure and timing only. Nothing here is medical guidance.</p>
    </div>
  );
}

function SchedulePayload({ schedule }: { schedule: SchedulePrescription }) {
  return (
    <div className="flex flex-col gap-2">
      <Facts
        items={[
          `Wake ${formatTime(schedule.wakeTarget)}`,
          `Train ${formatTime(schedule.trainingTime)}`,
          `Bed ${formatTime(schedule.bedTarget)}`,
          `Check-in ${schedule.checkInDay}`,
          schedule.photoDay ? `Photos ${schedule.photoDay}` : null,
        ]}
      />
      <p className="text-[12px] text-white/60">
        Training days: {schedule.trainingDays.join(" · ")}
        {schedule.stepsTarget ? ` · ${schedule.stepsTarget.toLocaleString()} steps/day` : ""}
      </p>
      <ul className="flex flex-col [&>li+li]:border-t [&>li+li]:border-white/[0.05]">
        {[...schedule.blocks]
          .sort((a, b) => a.time.localeCompare(b.time))
          .map((block) => (
            <li key={block.id} className="flex items-center gap-3 py-1.5">
              <span className="tnum w-16 shrink-0 font-mono text-[11px] text-white/60">{formatTime(block.time)}</span>
              <span className="text-[12px] text-white/75">{block.label}</span>
              {block.detail && <span className="ml-auto text-[11px] text-white/50">{block.detail}</span>}
            </li>
          ))}
      </ul>
      {schedule.cardioNote && <p className="text-[12px] text-[#5fb7d5]">Cardio: {schedule.cardioNote}</p>}
      {schedule.coachingNotes && <Note>{schedule.coachingNotes}</Note>}
    </div>
  );
}
