"use client";

/* ════════════════════════════════════════════════════════════════════════
   RESPONSE MODEL — how your body responds, learned from your own training.

   An Intelligence screen, so the evidence still comes before any finding:
   the hero says what the model is built from, then states the strongest
   pattern. With nothing settled it says so.

   A command center, not a report:

     hero        evidence line, the strongest finding, three counts, one gold
     decisions   only when a recommendation waits on the member — one row each
     patterns    every current pattern as ONE row (area · finding · confidence);
                 a row opens its evidence in a sheet: what was observed, what
                 supports and contradicts it, what was excluded, the limits.
                 With no pattern yet, the rows say what would establish one.
     details     ONE closed disclosure: what Reserve does not know, patterns
                 no longer current, recent decisions, the weekly reviews

   Nothing is projected and no recommendation is applied without the member.
   ════════════════════════════════════════════════════════════════════════ */

import { ArrowRight, Brain, ChevronRight } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { RecommendationReview } from "@/components/response/RecommendationReview";
import { WeeklyResponseReviewPanel } from "@/components/response/WeeklyResponseReviewPanel";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { ReserveBottomSheet, ReserveButton, ReserveDisclosure, ReserveSectionHeader } from "@/components/ui/reserve";
import { useAthleteDashboardStore } from "@/lib/athlete-store";
import { RESERVE, alpha } from "@/lib/design/tokens";
import { useResponseModel } from "@/lib/hooks/useResponseModel";
import { CONFIDENCE_LABEL } from "@/lib/response-model/confidence";
import {
  evidenceSpanLine,
  headlineInsight,
  resolveResponsePrimaryAction,
  type ResponsePrimaryAction,
} from "@/lib/response-model/primary-action";
import {
  DOMAIN_LABEL,
  type ResponseConfidence,
  type ResponseInsight,
  type ResponseRecommendation,
} from "@/lib/response-model/types";

import { ViewShell } from "./ViewShell";

const CONFIDENCE_COLOR: Record<ResponseConfidence, string> = {
  insufficient: RESERVE.slate,
  emerging: RESERVE.steel,
  moderate: RESERVE.green,
  established: RESERVE.green,
};

const CONFIDENCE_RANK: Record<ResponseConfidence, number> = { established: 0, moderate: 1, emerging: 2, insufficient: 3 };

const PAIN_NOTE =
  "Reserve records what you report. It does not assess or interpret it. Anything persistent, severe or escalating is a conversation for a qualified clinician.";

/** Display-only — a <span>, never something that looks interactive. */
function ConfidenceChip({ confidence }: { confidence: ResponseConfidence }) {
  return (
    <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.18em]" style={{ color: CONFIDENCE_COLOR[confidence] }}>
      {CONFIDENCE_LABEL[confidence]}
    </span>
  );
}

function Lines({ items }: { items: string[] }) {
  if (items.length === 0) return <p className="text-[12.5px] text-white/40">Nothing recorded.</p>;
  return (
    <ul className="space-y-1.5 text-[12.5px] leading-relaxed text-white/65">
      {items.map((text, i) => (
        <li key={i} className="flex gap-2.5">
          <span className="mt-[8px] h-1 w-1 shrink-0 rounded-full bg-white/30" aria-hidden="true" />
          <span>{text}</span>
        </li>
      ))}
    </ul>
  );
}

function SubHead({ children, tone }: { children: React.ReactNode; tone?: string }) {
  return (
    <p className="mb-1 mt-4 font-mono text-[10px] uppercase tracking-[0.16em] first:mt-0" style={{ color: tone ?? "rgba(255,255,255,0.5)" }}>
      {children}
    </p>
  );
}

/** A readout with no surface of its own — a row in the hero, never a tile. */
function Read({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="min-w-0">
      <dt className="font-mono text-[9px] uppercase tracking-[0.22em] text-white/60">{label}</dt>
      <dd className="tnum mt-1.5 font-display text-[26px] font-black leading-none text-[#f2eee6] sm:text-[30px]">{value}</dd>
    </div>
  );
}

const areaLabel = (insight: ResponseInsight) => (insight.domain === "pain" ? "Reported discomfort" : DOMAIN_LABEL[insight.domain]);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/* ─── The evidence behind one pattern, in a sheet ───────────────────────── */

function InsightEvidenceSheet({ insight, onClose }: { insight: ResponseInsight | null; onClose: () => void }) {
  return (
    <ReserveBottomSheet open={insight !== null} onClose={onClose} title={insight ? `${areaLabel(insight)} · ${insight.targetLabel}` : "Evidence"} accent={RESERVE.steel}>
      {insight && (
        <div data-response="evidence-sheet" className="text-[13px] leading-relaxed">
          <div className="flex items-start justify-between gap-3">
            <p className="text-white/85">{insight.finding}</p>
            <ConfidenceChip confidence={insight.confidence} />
          </div>
          <p className="mt-2 text-[12.5px] text-white/60">{insight.interpretation}</p>
          {insight.domain === "pain" && (
            <p className="mt-2 text-[12.5px]" style={{ color: alpha(RESERVE.amber, 0.85) }}>
              {PAIN_NOTE}
            </p>
          )}

          <SubHead>What Reserve observed</SubHead>
          <p className="tnum text-[12.5px] text-white/70">
            {evidenceSpanLine({
              comparableObservations: insight.sample.comparableObservations,
              weeks: insight.sample.weeksRepresented.length,
              firstObservedAt: insight.sample.firstObservedAt,
              lastObservedAt: insight.sample.lastObservedAt,
            })}
          </p>

          <SubHead>Supporting</SubHead>
          <p className="tnum text-[12.5px] text-white/70">{plural(insight.sample.supportingObservations, "observation")} point this way.</p>

          {insight.sample.contradictingObservations > 0 && (
            <>
              <SubHead tone={alpha(RESERVE.amber, 0.8)}>Contradicting</SubHead>
              <p className="tnum text-[12.5px]" style={{ color: alpha(RESERVE.amber, 0.85) }}>
                {plural(insight.sample.contradictingObservations, "observation")} point the other way. Reserve keeps them in view.
              </p>
            </>
          )}

          {insight.evidence.excludedEvidenceIds.length > 0 && (
            <>
              <SubHead>Excluded from the comparison</SubHead>
              <Lines items={Object.values(insight.evidence.exclusionReasons)} />
            </>
          )}

          <SubHead>Limits</SubHead>
          <Lines items={insight.limitations} />

          {!insight.recommendationEligibility.eligible && (
            <>
              <SubHead>What Reserve recommends</SubHead>
              <p className="text-[12.5px] text-white/60">Nothing yet — {insight.recommendationEligibility.reason.toLowerCase()}</p>
            </>
          )}
        </div>
      )}
    </ReserveBottomSheet>
  );
}

export function ResponseProfileView() {
  const { model, activeInsights, pendingRecommendations, stillLearning, weeklyReviews } = useResponseModel();
  const setActiveView = useAthleteDashboardStore((s) => s.setActiveView);
  const [reviewing, setReviewing] = useState<ResponseRecommendation | null>(null);
  const [evidenceFor, setEvidenceFor] = useState<ResponseInsight | null>(null);
  const closeEvidence = useCallback(() => setEvidenceFor(null), []);

  /* Every current pattern, strongest first. Reported discomfort always leads. */
  const patterns = useMemo(
    () =>
      [...activeInsights].sort(
        (a, b) => Number(b.domain === "pain") - Number(a.domain === "pain") || CONFIDENCE_RANK[a.confidence] - CONFIDENCE_RANK[b.confidence],
      ),
    [activeInsights],
  );

  /* Only a finding with more than insufficient evidence may headline. */
  const strongest = headlineInsight(activeInsights);
  const recoveryInsights = activeInsights.filter((i) => i.domain === "recovery" || i.domain === "conditioning");
  const recoveryConstraint = recoveryInsights.find((i) => i.magnitude?.direction === "negative") ?? recoveryInsights[0] ?? null;
  const quality = model.dataQuality;

  const plan = resolveResponsePrimaryAction({
    finalizedSessions: quality.finalizedSessions,
    comparableObservations: quality.comparableExerciseObservations,
    completedWeeks: quality.completedWeeks,
    /* Insufficient patterns still list below, but they are not a settled pattern to act on. */
    activeInsights: activeInsights.filter((i) => i.confidence !== "insufficient").length,
    pendingRecommendations: pendingRecommendations.length,
    strongestFinding: strongest?.finding ?? null,
  });

  function run(action: ResponsePrimaryAction) {
    switch (action.kind) {
      case "review-recommendation":
        if (pendingRecommendations[0]) setReviewing(pendingRecommendations[0]);
        break;
      case "open-training":
        setActiveView("training");
        break;
      case "review-evidence":
        if (strongest) setEvidenceFor(strongest);
        break;
    }
  }

  /* What would establish a pattern — real thresholds, never a guess. */
  const needs: { label: string; value: string }[] = [];
  if (quality.finalizedSessions < 2) needs.push({ label: "Sessions", value: `${Math.max(0, 2 - quality.finalizedSessions)} more completed and closed` });
  if (quality.comparableExerciseObservations < 2) needs.push({ label: "Movements", value: "One more comparable exposure to the same movement" });
  if (quality.completedWeeks < 2) needs.push({ label: "Weeks", value: "One more completed training week" });
  if (quality.sleepObservations === 0) needs.push({ label: "Sleep", value: "Sleep entries, for recovery patterns" });
  if (quality.bodyWeightObservations < 2) needs.push({ label: "Weigh-ins", value: "A few more, for body-composition patterns" });

  const showPatterns = !(stillLearning && activeInsights.length === 0);

  return (
    <ViewShell
      label="Reserve Response Model"
      title="Response Model"
      icon={Brain}
      accentColor={RESERVE.steel}
      roomHero
      disclaimer="Observations are built from your own logged training. They are not medical advice, and Reserve never changes your program without your decision."
    >
      {/* ── HERO — evidence first, then the finding it supports (Bible §12 rule 3). */}
      <GlassPanel accent={RESERVE.steel} noPad phone="flush" className="md:overflow-hidden">
        <section aria-label="Current response" data-response="hero" className="relative pb-5 pt-4 md:p-6 lg:px-8 lg:py-6">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -inset-x-3 inset-y-0 max-md:[mask-image:linear-gradient(180deg,#000_55%,transparent)] md:inset-x-0"
            style={{ background: `radial-gradient(110% 90% at 0% 15%, ${alpha(RESERVE.steel, 0.08)}, transparent 55%)` }}
          />

          <div className="relative grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)] lg:items-end lg:gap-12">
            <div className="min-w-0">
              <p data-response="evidence" className="tnum font-mono text-[9px] uppercase tracking-[0.22em] text-white/60">
                {plan.evidence}
              </p>
              <h2
                data-room-statement
                className="mt-2.5 font-display text-[26px] font-black uppercase leading-[1] tracking-[-0.02em] text-[#f2eee6] [hyphens:none] sm:text-[30px] lg:text-[34px]"
              >
                {plan.statement}
              </h2>
              {recoveryConstraint && (
                <p className="mt-3 text-[13px] text-white/70">Constraint · {recoveryConstraint.targetLabel.toLowerCase()}</p>
              )}
            </div>

            <div className="min-w-0">
              <dl className="grid grid-cols-3 gap-4">
                <Read label="Sessions" value={quality.finalizedSessions} />
                <Read label="Comparable" value={quality.comparableExerciseObservations} />
                <Read label="Weeks" value={quality.completedWeeks} />
              </dl>
              {/* The screen's one gold action (Bible §11). */}
              <div data-response="primary-action" className="mt-4 min-w-0 max-sm:w-full sm:inline-block">
                <ReserveButton
                  tier="primary"
                  size="md"
                  fullWidth
                  iconAfter={plan.primary.kind === "open-training" ? ArrowRight : undefined}
                  onClick={() => run(plan.primary)}
                >
                  {plan.primary.label}
                </ReserveButton>
              </div>
            </div>
          </div>
        </section>
      </GlassPanel>

      {/* ── Decisions waiting on the member ───────────────────────────── */}
      {pendingRecommendations.length > 0 && (
        <GlassPanel accent={RESERVE.gold} noPad phone="flush" className="md:p-5">
          <section aria-label="Decisions" data-response="decisions">
            <ReserveSectionHeader label={`Your decision · ${pendingRecommendations.length}`} accent={RESERVE.gold} />
            <ul className="divide-y divide-white/[0.05]">
              {pendingRecommendations.slice(0, 3).map((rec) => (
                <li key={rec.id} className="flex min-h-[48px] items-center gap-3 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-semibold text-white">{rec.summary}</span>
                    <ConfidenceChip confidence={rec.confidence} />
                  </span>
                  <ReserveButton tier="secondary" size="sm" onClick={() => setReviewing(rec)}>
                    Review
                  </ReserveButton>
                </li>
              ))}
            </ul>
          </section>
        </GlassPanel>
      )}

      {/* ── Patterns, one row each — or what would establish one ──────── */}
      <GlassPanel noPad phone="flush" className="md:p-5">
        {showPatterns ? (
          <section aria-label="Patterns" data-response="patterns">
            <ReserveSectionHeader label={`Patterns · ${patterns.length}`} accent={RESERVE.steel} />
            {patterns.length === 0 ? (
              <p className="text-[13px] text-white/55">No settled pattern yet.</p>
            ) : (
              <ul className="divide-y divide-white/[0.05]">
                {patterns.map((insight) => (
                  <li key={insight.id}>
                    <button
                      type="button"
                      aria-haspopup="dialog"
                      onClick={() => setEvidenceFor(insight)}
                      className="flex min-h-[52px] w-full items-center gap-3 py-2.5 text-left transition-colors hover:text-white"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold text-[#f2eee6]">{insight.targetLabel}</span>
                        <span className="mt-0.5 block font-mono text-[9px] uppercase tracking-[0.16em]">
                          <span style={{ color: insight.domain === "pain" ? alpha(RESERVE.amber, 0.85) : "rgba(255,255,255,0.5)" }}>{areaLabel(insight)}</span>
                          <span className="text-white/30"> · </span>
                          <span style={{ color: CONFIDENCE_COLOR[insight.confidence] }}>{CONFIDENCE_LABEL[insight.confidence]}</span>
                        </span>
                        {/* The strongest finding is already the statement above; others read here. */}
                        {insight.id !== strongest?.id && (
                          <span className="mt-0.5 line-clamp-2 block text-[12px] leading-snug text-white/60">{insight.finding}</span>
                        )}
                      </span>
                      <ChevronRight size={14} className="shrink-0 text-white/35" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : (
          <section aria-label="What would establish a pattern" data-response="needs">
            <ReserveSectionHeader label="To establish a pattern" accent={RESERVE.steel} />
            <dl className="divide-y divide-white/[0.05]">
              {needs.map((n) => (
                <div key={n.label} className="flex min-h-[44px] items-center gap-3 py-2">
                  <dt className="w-[92px] shrink-0 font-mono text-[10px] uppercase tracking-[0.16em] text-white/50">{n.label}</dt>
                  <dd className="min-w-0 flex-1 text-[13px] text-white/80">{n.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}
      </GlassPanel>

      {/* ── Details: everything that explains, closed ─────────────────── */}
      {(model.assumptions.length > 0 || model.archivedInsights.length > 0 || model.resolvedRecommendations.length > 0 || weeklyReviews.length > 0) && (
      <div data-response="details">
        <ReserveDisclosure summary="Details">
          {model.assumptions.length > 0 && (
            <>
              <SubHead>What Reserve does not know</SubHead>
              <Lines items={model.assumptions} />
            </>
          )}
          {model.archivedInsights.length > 0 && (
            <>
              <SubHead>No longer current</SubHead>
              <Lines items={model.archivedInsights.map((i) => `${i.targetLabel} — ${i.finding} ${i.archiveReason ?? "Archived."}`)} />
            </>
          )}
          {model.resolvedRecommendations.length > 0 && (
            <>
              <SubHead>Recent decisions</SubHead>
              <Lines
                items={model.resolvedRecommendations
                  .slice(-6)
                  .reverse()
                  .map((rec) => {
                    const outcome =
                      rec.decision === "applied"
                        ? "applied to your future weeks"
                        : rec.decision === "accepted"
                          ? "acknowledged"
                          : rec.decision === "declined"
                            ? "you kept the current plan"
                            : rec.decision === "expired"
                              ? "expired without a decision"
                              : rec.decision;
                    return `${rec.summary} · ${outcome}${rec.decidedAt ? ` · ${rec.decidedAt.slice(0, 10)}` : ""}`;
                  })}
              />
            </>
          )}
          <div className="mt-4">
            <WeeklyResponseReviewPanel />
          </div>
        </ReserveDisclosure>
      </div>
      )}

      <InsightEvidenceSheet insight={evidenceFor} onClose={closeEvidence} />
      {reviewing && <RecommendationReview recommendation={reviewing} onClose={() => setReviewing(null)} />}
    </ViewShell>
  );
}
