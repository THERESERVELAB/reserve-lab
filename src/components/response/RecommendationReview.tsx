"use client";

/* ════════════════════════════════════════════════════════════════════════
   RECOMMENDATION REVIEW

   The athlete keeps agency. Reserve states what it observed, what would
   change, what would stay the same, how confident it is, and from which week
   — then gets out of the way.

   No manipulative language. No auto-accept. Declining is presented as an
   equally legitimate answer, because it is.
   ════════════════════════════════════════════════════════════════════════ */

import { useState } from "react";
import { X } from "lucide-react";

import { useResponseModel } from "@/lib/hooks/useResponseModel";
import { CONFIDENCE_LABEL } from "@/lib/response-model/confidence";
import type { ResponseRecommendation } from "@/lib/response-model/types";

function Section({ title, items, tone = "default" }: { title: string; items: string[]; tone?: "default" | "warn" }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className={`text-[10px] uppercase tracking-[0.14em] ${tone === "warn" ? "text-amber-200/70" : "text-white/35"}`}>{title}</p>
      <ul className="mt-1.5 space-y-1.5 text-sm leading-relaxed text-white/70">
        {items.map((text, i) => (
          <li key={i} className="flex gap-2.5">
            <span className="mt-[8px] h-1 w-1 shrink-0 rounded-full bg-white/30" />
            <span>{text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RecommendationReview({
  recommendation,
  onClose,
}: {
  recommendation: ResponseRecommendation;
  onClose: () => void;
}) {
  const { accept, decline, defer, model } = useResponseModel();
  const [showEvidence, setShowEvidence] = useState(false);
  const [result, setResult] = useState<{ tone: "ok" | "error"; message: string } | null>(null);

  const insights = model.activeInsights.filter((i) => recommendation.insightIds.includes(i.id));

  const handle = (action: "accept" | "decline" | "defer") => {
    const outcome =
      action === "accept" ? accept(recommendation.id)
        : action === "decline" ? decline(recommendation.id)
          : defer(recommendation.id);

    if (outcome.blocked) {
      setResult({ tone: "error", message: outcome.blockedReason ?? "Reserve could not apply that." });
      return;
    }
    setResult({
      tone: "ok",
      message:
        action === "accept"
          ? outcome.revision
            ? `Applied from week ${outcome.revision.effectiveWeek}. Your completed and in-progress weeks are unchanged, and the original projection is still there to compare against.`
            : "Noted. Nothing in your program changed."
          : action === "decline"
            ? "Kept your current plan. Reserve has recorded the decision and will keep collecting evidence."
            : "Left for later. Reserve will raise it again once there is more to go on.",
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label="Reserve recommendation">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border border-white/12 bg-[#0b0d12] p-5 sm:rounded-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-white/35">Reserve recommends</p>
            <h2 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight text-white">
              {recommendation.summary}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-2 text-white/45 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        {result ? (
          <div className="mt-5 space-y-4">
            <p className={`text-sm leading-relaxed ${result.tone === "error" ? "text-rose-100" : "text-white/75"}`}>
              {result.message}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-white px-5 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-black"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="mt-5 space-y-5">
            <div>
              <p className="text-[10px] uppercase tracking-[0.14em] text-white/35">Why</p>
              <p className="mt-1.5 text-sm leading-relaxed text-white/75">{recommendation.reason}</p>
            </div>

            <Section title="What changes" items={recommendation.whatChanges} />
            <Section title="What stays the same" items={recommendation.whatRemainsUnchanged} />
            <Section title="What this should do" items={recommendation.expectedEffect} />
            <Section title="Tradeoffs" items={recommendation.tradeoffs} tone="warn" />

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-white/10 bg-black/25 p-3">
                <p className="text-[10px] uppercase tracking-[0.14em] text-white/35">Confidence</p>
                <p className="mt-1 text-sm text-white">{CONFIDENCE_LABEL[recommendation.confidence]}</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/25 p-3">
                <p className="text-[10px] uppercase tracking-[0.14em] text-white/35">Effective week</p>
                <p className="mt-1 text-sm text-white">
                  {recommendation.effectiveWeek != null
                    ? `From week ${recommendation.effectiveWeek}`
                    : "Nothing in the program changes"}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowEvidence((v) => !v)}
              aria-expanded={showEvidence}
              className="text-[11px] uppercase tracking-[0.14em] text-white/45 underline-offset-4 transition-colors hover:text-white/80 hover:underline"
            >
              {showEvidence ? "Hide the evidence" : "Review the evidence"}
            </button>

            {showEvidence && (
              <div className="space-y-3 rounded-lg border border-white/10 bg-black/30 p-3.5">
                {insights.map((item) => (
                  <div key={item.id}>
                    <p className="text-sm text-white/80">{item.finding}</p>
                    <p className="mt-1 text-xs text-white/45">
                      {item.sample.comparableObservations} comparable observation
                      {item.sample.comparableObservations === 1 ? "" : "s"} across{" "}
                      {item.sample.weeksRepresented.length} week
                      {item.sample.weeksRepresented.length === 1 ? "" : "s"}
                      {item.sample.contradictingObservations > 0
                        ? `, with ${item.sample.contradictingObservations} pointing the other way`
                        : ""}
                      .
                    </p>
                    {item.limitations.length > 0 && (
                      <p className="mt-1 text-xs text-white/35">{item.limitations[0]}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-2 border-t border-white/10 pt-4">
              <button
                type="button"
                onClick={() => handle("accept")}
                className="rounded-full bg-white px-5 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-black"
              >
                Apply change
              </button>
              <button
                type="button"
                onClick={() => handle("decline")}
                className="rounded-full border border-white/25 px-5 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-white/80 transition-colors hover:border-white/50"
              >
                Keep current plan
              </button>
              <button
                type="button"
                onClick={() => handle("defer")}
                className="rounded-full border border-white/15 px-5 py-2 text-xs uppercase tracking-[0.14em] text-white/55 transition-colors hover:border-white/35"
              >
                Decide later
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
