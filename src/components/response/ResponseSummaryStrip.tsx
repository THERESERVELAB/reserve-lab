"use client";

/* ════════════════════════════════════════════════════════════════════════
   RESPONSE SUMMARY — the restrained Personal Command surface.

   What Reserve currently understands, the strongest pattern, the current
   recovery constraint, and any pending recommendation. Deliberately NOT a
   second Response Profile — it points at one.
   ════════════════════════════════════════════════════════════════════════ */

import { useAthleteDashboardStore } from "@/lib/athlete-store";
import { useResponseModel } from "@/lib/hooks/useResponseModel";
import { CONFIDENCE_LABEL } from "@/lib/response-model/confidence";
import { resolveResponseSurface } from "@/lib/response-model/surfaces";

export function ResponseSummaryStrip() {
  const { model, stillLearning } = useResponseModel();
  const setActiveView = useAthleteDashboardStore((s) => s.setActiveView);
  const resolution = resolveResponseSurface(model);
  const activeInsights = resolution.relevantInsights;
  const pendingRecommendations = model.pendingRecommendations;

  const strongest = resolution.strongestCurrentInsight ?? null;

  const constraint = activeInsights.find(
    (i) => (i.domain === "recovery" || i.domain === "conditioning" || i.domain === "pain") && i.magnitude?.direction === "negative",
  ) ?? null;

  const latestAccepted = resolution.latestAppliedRecommendation ?? null;

  return (
    /* No surface of its own: this renders inside Personal Command's panel, and
       a bordered rounded box here is card-in-card (components.md rule 1). */
    <section>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-white/35">Reserve Response Model</p>
          <h2 className="mt-1.5 font-[family-name:var(--font-display)] text-xl font-semibold tracking-tight text-white">
            {stillLearning ? "Reserve is learning how you respond." : "What Reserve currently understands"}
          </h2>
        </div>
        <span className="rounded-full bg-white/[0.07] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/60">
          {CONFIDENCE_LABEL[resolution.confidence]}
        </span>
      </div>

      {stillLearning && activeInsights.length === 0 ? (
        <p className="mt-3 text-sm leading-relaxed text-white/55">
          {model.dataQuality.finalizedSessions} closed session
          {model.dataQuality.finalizedSessions === 1 ? "" : "s"} so far. Reserve needs comparable exposures
          before it will tell you anything about how you respond.
        </p>
      ) : (
        <dl className="mt-4 space-y-3">
          {strongest && (
            <div>
              <dt className="text-[10px] uppercase tracking-[0.14em] text-white/35">Strongest pattern</dt>
              <dd className="mt-0.5 text-sm leading-relaxed text-white/80">{strongest.finding}</dd>
            </div>
          )}
          {constraint && (
            <div>
              <dt className="text-[10px] uppercase tracking-[0.14em] text-amber-200/60">Current constraint</dt>
              <dd className="mt-0.5 text-sm leading-relaxed text-amber-100/75">{constraint.finding}</dd>
            </div>
          )}
          {latestAccepted && (
            <div>
              <dt className="text-[10px] uppercase tracking-[0.14em] text-white/35">Latest adjustment</dt>
              <dd className="mt-0.5 text-sm leading-relaxed text-white/65">
                {latestAccepted.summary}
                {latestAccepted.decidedAt ? ` · ${latestAccepted.decidedAt.slice(0, 10)}` : ""}
              </dd>
            </div>
          )}
        </dl>
      )}

      {pendingRecommendations.length > 0 && (
        <p className="mt-4 border-l-2 border-white/20 py-1 pl-3 text-sm text-white/75">
          {pendingRecommendations.length} recommendation
          {pendingRecommendations.length === 1 ? "" : "s"} waiting on your decision.
        </p>
      )}

      <button
        type="button"
        onClick={() => setActiveView("response-profile")}
        className="mt-4 rounded-full border border-white/20 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/75 transition-colors hover:border-white/45 hover:text-white"
      >
        Open your response profile
      </button>
    </section>
  );
}
