"use client";

import { Activity, Brain, ShieldCheck } from "lucide-react";

import { useResponseSurfaceResolution } from "@/lib/hooks/useResponseSurfaceResolution";
import { selectTrainingSurfaceInsights } from "@/lib/response-model/surfaces";
import type { ResponseInsight } from "@/lib/response-model/types";

function labelFor(insight: ResponseInsight): string {
  if (insight.domain === "conditioning") return "Recovery note";
  if (insight.domain === "recovery") return "Observed spacing";
  if (insight.domain === "exercise") return "Exercise response";
  if (insight.domain === "volume" || insight.domain === "frequency") return "Response-adapted";
  if (insight.domain === "pain") return "Professional review";
  return "Response context";
}

export function TrainingResponseContext({
  currentDate,
  currentWeek,
  focusAreas,
  exercises,
  movementPatterns = [],
  lowerBody,
  frozen,
}: {
  currentDate: string;
  currentWeek?: number;
  focusAreas: string[];
  exercises: string[];
  movementPatterns?: string[];
  lowerBody: boolean;
  frozen: boolean;
}) {
  const resolution = useResponseSurfaceResolution({
    currentDate,
    currentWeek,
    muscles: focusAreas,
    exercises,
    movementPatterns,
    domains: ["volume", "frequency", "exercise", "recovery", ...(lowerBody ? ["conditioning" as const] : []), "pain"],
    recoveryContexts: lowerBody
      ? ["session-spacing", "conditioning-proximity", "sleep", "local-fatigue", "pain"]
      : ["session-spacing", "sleep", "local-fatigue", "pain"],
  });

  // A started session is an immutable ledger snapshot. Response intelligence
  // can explain future sessions, but it never rewrites or overlays this one.
  if (frozen || resolution.relevantInsights.length === 0) return null;

  const insights = selectTrainingSurfaceInsights(resolution);
  const adapted = resolution.latestAppliedRecommendation;
  return (
    <section
      data-testid="training-response-context"
      data-model-version={resolution.modelVersion}
      data-insight-ids={insights.map((insight) => insight.id).join(",")}
      /* A leading accent rail, not a second card: this sits inside Training's
         own panel, and a bordered rounded box here is card-in-card
         (constitution components.md rule 1). */
      className="border-l-2 border-[#5fb7d5]/40 bg-[#5fb7d5]/[0.04] py-3.5 pl-4 pr-3.5 sm:pr-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Brain size={13} className="text-[#7dd3ee]" />
          <p className="font-mono text-[8px] uppercase tracking-[0.22em] text-[#7dd3ee]/75">
            {adapted ? "Response-adapted" : labelFor(insights[0])}
          </p>
        </div>
        <span className="rounded-full border border-white/[0.08] px-2 py-0.5 font-mono text-[7px] uppercase tracking-[0.14em] text-white/35">
          {resolution.confidence}
        </span>
      </div>
      {adapted && (
        <div className="mt-2 flex items-start gap-2 text-[10.5px] leading-5 text-[#b6e5f5]/65">
          <ShieldCheck size={12} className="mt-1 shrink-0" />
          <p>{adapted.summary} Future unstarted sessions carry revision {adapted.appliedRevisionId}.</p>
        </div>
      )}
      <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
        {insights.map((insight) => (
          <div key={insight.id} className="min-w-0 border-l border-white/[0.08] pl-3">
            <p className="flex items-center gap-1.5 font-mono text-[7px] uppercase tracking-[0.16em] text-white/35">
              <Activity size={9} /> {labelFor(insight)}
            </p>
            <p className="mt-1.5 text-[11px] leading-[1.55] text-white/68">{insight.finding}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
