"use client";

/* REVIEW QUEUE — check-ins waiting for the coach, newest first; reviewed
   ones stay one tap away behind a disclosure. */

import { useCallback, useEffect, useState } from "react";

import { ReserveDisclosure } from "@/components/ui/reserve";
import { useCoachingStore } from "@/lib/coaching/store";
import type { PrescriptionCategory } from "@/lib/coaching/types";
import { resolveReviewsBrief } from "@/lib/coaching/workspace-brief";
import { CheckInCard } from "./CheckInReview";
import { clearCoachIntent, peekCoachIntent, useCoachDecisionInput } from "./coach-actions";
import { PrescriptionComposer, type ComposerSeed } from "./PrescriptionComposer";
import { CoachHero, CoachPage, CoachSection, EmptyState } from "./ui";

export function ReviewQueueView() {
  const db = useCoachingStore((s) => s.db);
  const clients = useCoachingStore((s) => s.clients);
  const input = useCoachDecisionInput();
  const [composer, setComposer] = useState<ComposerSeed | null>(null);
  const [start, setStart] = useState<{ id: string; nonce: number } | null>(() => {
    const intent = peekCoachIntent("review-check-in");
    return intent ? { id: intent.checkInId, nonce: 0 } : null;
  });
  const closeComposer = useCallback(() => setComposer(null), []);

  useEffect(() => {
    clearCoachIntent("review-check-in");
  }, []);

  const clientIds = new Set(clients.map((c) => c.athleteId));
  const nameOf = (athleteId: string) => db.members.find((m) => m.id === athleteId)?.name ?? "Client";
  const reviewed = db.checkIns
    .filter((c) => clientIds.has(c.athleteId) && db.reviews.some((r) => r.id === c.reviewId && r.completedAt))
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  const waiting = input.checkInsAwaiting
    .map((item) => db.checkIns.find((c) => c.id === item.id))
    .filter((c): c is NonNullable<typeof c> => Boolean(c));

  const brief = resolveReviewsBrief(input, reviewed.length);

  const openComposer = (athleteId: string, category: PrescriptionCategory, checkInId: string) =>
    setComposer({ category, athleteId, sourceCheckInId: checkInId });

  return (
    <CoachPage screen="reviews">
      <CoachHero
        title="Reviews"
        brief={brief}
        reads={[
          { label: "Waiting", value: String(waiting.length) },
          { label: "Reviewed", value: String(reviewed.length) },
        ]}
        onPrimary={() => {
          const action = brief.primary;
          if (action?.kind === "review-check-in") setStart((prev) => ({ id: action.checkInId, nonce: (prev?.nonce ?? 0) + 1 }));
        }}
      />

      <CoachSection label={`Waiting · ${waiting.length}`}>
        {waiting.length === 0 ? (
          <EmptyState
            title={clients.length === 0 ? "No check-ins yet" : "Nothing waiting"}
            body={clients.length === 0 ? "Check-ins arrive once a client connects." : "Every check-in has a review."}
            requirements={clients.length === 0 ? ["An active client", "Their weekly check-in"] : undefined}
          />
        ) : (
          <ul className="flex flex-col gap-4">
            {waiting.map((checkIn) => (
              <li key={`${checkIn.id}-${start?.id === checkIn.id ? start.nonce : "idle"}`}>
                <CheckInCard
                  checkIn={checkIn}
                  viewer="coach"
                  athleteName={nameOf(checkIn.athleteId)}
                  startReview={start?.id === checkIn.id}
                  onAdjust={(category, checkInId) => openComposer(checkIn.athleteId, category, checkInId)}
                />
              </li>
            ))}
          </ul>
        )}
      </CoachSection>

      {reviewed.length > 0 && (
        <CoachSection label="Reviewed">
          <ReserveDisclosure summary={`Reviewed check-ins · ${reviewed.length}`}>
            <ul className="flex flex-col gap-4">
              {reviewed.map((checkIn) => (
                <li key={checkIn.id}>
                  <CheckInCard checkIn={checkIn} viewer="coach" athleteName={nameOf(checkIn.athleteId)} />
                </li>
              ))}
            </ul>
          </ReserveDisclosure>
        </CoachSection>
      )}

      {composer && <PrescriptionComposer seed={composer} onClose={closeComposer} />}
    </CoachPage>
  );
}
