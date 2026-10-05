"use client";

import { CheckCircle2, ChevronDown, Clock3 } from "lucide-react";

import { useResponseModel } from "@/lib/hooks/useResponseModel";
import type { WeeklyResponseReview } from "@/lib/response-model/types";

function Lines({ items, empty }: { items: string[]; empty: string }) {
  if (items.length === 0) return <p className="text-[10px] text-white/30">{empty}</p>;
  return <ul className="space-y-1 text-[10.5px] leading-[1.55] text-white/55">{items.map((item) => <li key={item}>· {item}</li>)}</ul>;
}

function Review({ review }: { review: WeeklyResponseReview }) {
  const completed = Boolean(review.completedAt);
  return (
    /* A hairline-separated row, not a card inside the panel. */
    <article data-testid={`weekly-response-review-${review.weekNumber}`} className="border-t border-white/[0.06] py-3.5 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {completed ? <CheckCircle2 size={12} className="text-[#6ee7b7]" /> : <Clock3 size={12} className="text-[#e8c87a]" />}
          <p className="text-[11px] font-semibold text-white/75">Week {review.weekNumber}</p>
          <span className="font-mono text-[7px] uppercase tracking-[0.14em] text-white/30">{completed ? "Completed" : "Provisional"}</span>
        </div>
        <span className="font-mono text-[7px] uppercase tracking-[0.14em] text-white/30">{review.confidence}</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {[
          ["Completed", review.evidenceSummary.completedSessions],
          ["Partial", review.evidenceSummary.partialSessions],
          ["Skipped", review.evidenceSummary.skippedSessions],
          ["Replaced", review.evidenceSummary.replacementActivities],
          ["Comparable", review.evidenceSummary.comparableObservations],
        ].map(([label, value]) => (
          <div key={label} className="py-1">
            <p className="font-mono text-[6.5px] uppercase tracking-[0.12em] text-white/25">{label}</p>
            <p className="mt-0.5 font-mono text-[13px] text-white/65">{value}</p>
          </div>
        ))}
      </div>
      <details className="group mt-3 border-t border-white/[0.05] pt-2">
        <summary className="flex cursor-pointer list-none items-center justify-between font-mono text-[7.5px] uppercase tracking-[0.16em] text-white/38">
          Review evidence and decisions <ChevronDown size={11} className="transition group-open:rotate-180" />
        </summary>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div><p className="mb-1 font-mono text-[7px] uppercase tracking-[0.14em] text-[#6ee7b7]/60">Stable / maintain</p><Lines items={[...review.stablePatterns, ...review.maintainDecisions]} empty="No stable maintain decision yet." /></div>
          <div><p className="mb-1 font-mono text-[7px] uppercase tracking-[0.14em] text-[#e8c87a]/60">Emerging / monitor</p><Lines items={review.emergingPatterns} empty="No emerging pattern this week." /></div>
          <div><p className="mb-1 font-mono text-[7px] uppercase tracking-[0.14em] text-[#ef7d55]/60">Contradictions</p><Lines items={review.contradictedPatterns} empty="No contradicted pattern recorded." /></div>
          <div><p className="mb-1 font-mono text-[7px] uppercase tracking-[0.14em] text-[#7dd3ee]/60">Eligible recommendations</p><Lines items={review.recommendations} empty="No eligible recommendation." /></div>
        </div>
        <div className="mt-3 border-l border-white/[0.08] pl-3">
          <p className="mb-1 font-mono text-[7px] uppercase tracking-[0.14em] text-white/30">Missing information</p>
          <Lines items={review.missingData} empty="No material information gap recorded." />
        </div>
      </details>
    </article>
  );
}

export function WeeklyResponseReviewPanel() {
  const { weeklyReviews, model } = useResponseModel();
  if (weeklyReviews.length === 0) return null;
  const ordered = [...weeklyReviews].sort((a, b) => b.weekNumber - a.weekNumber);
  return (
    <section data-testid="weekly-response-review" data-model-version={model.modelVersion} className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 sm:p-5">
      <div>
        <p className="font-mono text-[8px] uppercase tracking-[0.22em] text-white/35">Weekly Response Review</p>
        <h3 className="mt-1 text-[16px] font-semibold text-white/80">What this week added to your response profile</h3>
        <p className="mt-1 text-[10px] leading-[1.5] text-white/38">Active weeks remain provisional. A completed review is preserved as history and is never rewritten by a future revision.</p>
      </div>
      <div className="mt-4 space-y-2.5">{ordered.slice(0, 4).map((review) => <Review key={`${review.programId}:${review.weekNumber}`} review={review} />)}</div>
    </section>
  );
}

