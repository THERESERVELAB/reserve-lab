"use client";

/* Weekly check-in rendering + the coach review workflow. Reviews are dated,
   versioned records; adjust decisions can launch prescription drafts.
   Rimless: labelled values and light-separated rows inside one surface. */

import { useEffect, useState } from "react";

import { useCoachingStore } from "@/lib/coaching/store";
import type { CoachReviewDecision, PrescriptionCategory, WeeklyCheckIn } from "@/lib/coaching/types";
import { CommandButton, Field, MicroLabel, Panel, StatusChip, dayLabel, inputClass, relativeTime } from "./ui";

const SCALE_FIELDS: Array<{ key: keyof WeeklyCheckIn; label: string }> = [
  { key: "sleepQuality", label: "Sleep" },
  { key: "energy", label: "Energy" },
  { key: "recovery", label: "Recovery" },
  { key: "stress", label: "Stress" },
  { key: "hunger", label: "Hunger" },
  { key: "digestion", label: "Digestion" },
];

export function CheckInCard({
  checkIn,
  viewer,
  onAdjust,
  athleteName,
  startReview = false,
}: {
  checkIn: WeeklyCheckIn;
  viewer: "coach" | "athlete";
  onAdjust?: (category: PrescriptionCategory, checkInId: string) => void;
  /** Shown on lists that span clients. */
  athleteName?: string;
  /** Open the review form on mount (a gold action landed here). */
  startReview?: boolean;
}) {
  const run = useCoachingStore((s) => s.run);
  const actorId = useCoachingStore((s) => s.actorId);
  const review = useCoachingStore((s) => s.db.reviews.find((r) => r.id === checkIn.reviewId) ?? null);
  const [reviewing, setReviewing] = useState(startReview && viewer === "coach" && !review?.completedAt);
  const [decisions, setDecisions] = useState<CoachReviewDecision[]>([]);
  const [summary, setSummary] = useState("");
  const [athleteNote, setAthleteNote] = useState("");
  const anchor = `checkin-${checkIn.id}`;

  useEffect(() => {
    if (!startReview) return;
    requestAnimationFrame(() => {
      const host = document.getElementById(anchor);
      if (!host) return;
      host.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
      host.querySelector<HTMLElement>("[data-review-form] button")?.focus({ preventScroll: true });
    });
  }, [startReview, anchor]);

  const toggleDecision = (d: CoachReviewDecision) =>
    setDecisions((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));

  const completeReview = async () => {
    await run(async (r) => {
      const saved = await r.tracking.saveReview({
        checkInId: checkIn.id,
        coachId: actorId,
        athleteId: checkIn.athleteId,
        completedAt: new Date().toISOString(),
        decisions: decisions.length > 0 ? decisions : ["keep_plan"],
        summary,
        athleteVisibleNote: athleteNote,
        linkedPrescriptionIds: [],
      }, actorId);
      if (summary.trim()) {
        await r.tracking.addNote({
          coachId: actorId,
          athleteId: checkIn.athleteId,
          category: "check-in",
          body: summary.trim(),
          visibility: "private",
          linkedCheckInId: checkIn.id,
        }, actorId);
      }
      return saved;
    });
    setReviewing(false);
  };

  return (
    <Panel as="article" className="md:p-5">
      <div id={anchor} tabIndex={-1} className="flex scroll-mt-24 flex-col gap-3 outline-none" data-coach="check-in">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <MicroLabel>{athleteName ? `${athleteName} · ` : ""}Week of {dayLabel(checkIn.weekOf)}</MicroLabel>
            <h3 className="mt-0.5 text-[14px] font-semibold text-[#f2eee6]">Check-in · sent {relativeTime(checkIn.submittedAt).toLowerCase()}</h3>
          </div>
          {review?.completedAt ? (
            <StatusChip tone="green">Reviewed</StatusChip>
          ) : viewer === "coach" ? (
            <StatusChip tone="champagne">Awaiting review</StatusChip>
          ) : (
            <StatusChip tone="neutral">Sent</StatusChip>
          )}
        </div>

        {/* Numbers */}
        <dl className="grid grid-cols-3 gap-x-4 gap-y-2 sm:grid-cols-5">
          <Metric label="Weight" value={checkIn.weightLb !== null ? `${checkIn.weightLb} lb` : "Not sent"} />
          <Metric label="Week avg" value={checkIn.weeklyAvgWeightLb !== null ? `${checkIn.weeklyAvgWeightLb} lb` : "Not sent"} />
          <Metric label="Training" value={`${checkIn.trainingAdherencePct}%`} />
          <Metric label="Nutrition" value={`${checkIn.nutritionAdherencePct}%`} />
          <Metric label="Steps avg" value={checkIn.stepsAvg !== null ? checkIn.stepsAvg.toLocaleString() : "Not sent"} />
        </dl>
        <dl className="grid grid-cols-3 gap-x-4 gap-y-2 border-t border-white/[0.05] pt-2.5 sm:grid-cols-6">
          {SCALE_FIELDS.map((field) => {
            const value = checkIn[field.key] as number | null;
            return <Metric key={field.key} label={field.label} value={value === null ? "Not answered" : `${value}/5`} />;
          })}
        </dl>

        {checkIn.update && <p className="text-[12.5px] leading-[1.55] text-white/75">{checkIn.update}</p>}
        {checkIn.painObservations && checkIn.painObservations !== "None to report" && (
          <p className="border-l-2 border-[#e8c87a]/40 pl-3 text-[12px] text-white/75">
            <span className="text-[#e8c87a]">Pain noted:</span> {checkIn.painObservations}
          </p>
        )}
        {checkIn.questionsForCoach && (
          <p className="border-l-2 border-[#5fb7d5]/40 pl-3 text-[12px] text-white/75">
            <span className="text-[#5fb7d5]">Question:</span> {checkIn.questionsForCoach}
          </p>
        )}
        <p className="text-[11.5px] text-white/55">Cardio: {checkIn.cardioCompleted || "Not sent"}</p>

        {/* Completed review record */}
        {review?.completedAt && (
          <div className="border-t border-white/[0.05] pt-2.5">
            <MicroLabel tone="champagne" className="mb-1">Coach review · {relativeTime(review.completedAt)}</MicroLabel>
            <p className="text-[12px] text-white/65">{review.decisions.map((d) => d.replace(/_/g, " ")).join(" · ")}</p>
            {(viewer === "coach" ? review.summary : review.athleteVisibleNote) && (
              <p className="mt-1 text-[12.5px] leading-[1.5] text-white/70">
                {viewer === "coach" ? review.summary : review.athleteVisibleNote}
              </p>
            )}
            {review.linkedPrescriptionIds.length > 0 && (
              <MicroLabel className="mt-2">
                {review.linkedPrescriptionIds.length} linked plan{review.linkedPrescriptionIds.length === 1 ? "" : "s"}
              </MicroLabel>
            )}
          </div>
        )}

        {/* Review workflow (coach) */}
        {viewer === "coach" && !review?.completedAt && (
          !reviewing ? (
            <CommandButton className="self-start" onClick={() => setReviewing(true)}>Begin review</CommandButton>
          ) : (
            <div data-review-form className="flex flex-col gap-3 border-l-2 border-[#d5b15f]/30 pl-3.5">
              <MicroLabel tone="champagne">Your decision</MicroLabel>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Review decisions">
                {([
                  ["keep_plan", "Keep plan"],
                  ["adjust_training", "Adjust training"],
                  ["adjust_nutrition", "Adjust nutrition"],
                  ["adjust_schedule", "Adjust schedule"],
                  ["request_info", "Ask for more"],
                ] as Array<[CoachReviewDecision, string]>).map(([decision, label]) => (
                  <button
                    key={decision}
                    type="button"
                    aria-pressed={decisions.includes(decision)}
                    onClick={() => {
                      toggleDecision(decision);
                      if (decision === "adjust_training") onAdjust?.("training", checkIn.id);
                      if (decision === "adjust_nutrition") onAdjust?.("nutrition", checkIn.id);
                      if (decision === "adjust_schedule") onAdjust?.("schedule", checkIn.id);
                    }}
                    className={`min-h-[40px] rounded-md border px-2.5 font-mono text-[9px] uppercase tracking-[0.1em] transition-colors ${
                      decisions.includes(decision)
                        ? "border-white/25 bg-white/[0.08] text-[#f2eee6]"
                        : "border-white/[0.08] text-white/60 hover:text-white/85"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <Field label="Private summary (only you see this)">
                <textarea className={`${inputClass} min-h-[48px] resize-none`} value={summary} onChange={(e) => setSummary(e.target.value)} />
              </Field>
              <Field label="Note to the athlete">
                <textarea className={`${inputClass} min-h-[48px] resize-none`} value={athleteNote} onChange={(e) => setAthleteNote(e.target.value)} />
              </Field>
              <div className="flex gap-2">
                <CommandButton variant="ghost" onClick={() => setReviewing(false)}>Cancel</CommandButton>
                <CommandButton className="flex-1" onClick={() => void completeReview()}>Complete review</CommandButton>
              </div>
            </div>
          )
        )}
      </div>
    </Panel>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/50">{label}</dt>
      <dd className="tnum mt-0.5 truncate text-[13px] font-bold text-[#f2eee6]">{value}</dd>
    </div>
  );
}
