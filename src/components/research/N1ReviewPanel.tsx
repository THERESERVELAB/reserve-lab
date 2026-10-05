"use client";

import { Flag } from "lucide-react";
import { useMemo, useState } from "react";

import { GlassPanel } from "@/components/ui/GlassPanel";
import { useAthleteDashboardStore } from "@/lib/athlete-store";
import { RESERVE, alpha } from "@/lib/design/tokens";
import { OBSERVATION_LABEL } from "@/lib/history/summaries";
import type { Observation } from "@/lib/history/types";
import { RESEARCH_COPY } from "@/lib/research/copy";
import { buildN1Review, labMarkerIdOf } from "@/lib/research/n1-review";

import { formatDay } from "./format";

const EMPTY: Observation[] = [];

const TOGGLE =
  "inline-flex min-h-[44px] items-center gap-1.5 rounded-[12px] border px-3 text-[12.5px] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#5fb7d5]";

export function N1ReviewPanel({ onOpenMarker, hasMarker }: { onOpenMarker: (id: string) => void; hasMarker: (id: string) => boolean }) {
  const observations = useAthleteDashboardStore((s) => s.observations) ?? EMPTY;
  const toggleObservationReview = useAthleteDashboardStore((s) => s.toggleObservationReview);
  const [onlyMarked, setOnlyMarked] = useState(false);
  const groups = useMemo(() => buildN1Review(observations, { onlyMarked }), [observations, onlyMarked]);

  return (
    <GlassPanel accent={RESERVE.steel}>
      <section aria-label={RESEARCH_COPY.n1Review} className="flex flex-col gap-5">
        <div>
          <h3 className="type-section-title" style={{ color: RESERVE.ivory }}>{RESEARCH_COPY.n1Review}</h3>
          <p className="type-supporting mt-1.5 max-w-[620px] text-[12.5px]">{RESEARCH_COPY.n1Explainer}</p>
        </div>

        {observations.length === 0 ? (
          <p className="text-[13px] text-white/60">{RESEARCH_COPY.n1Empty}</p>
        ) : (
          <>
            <div>
              <button
                type="button"
                aria-pressed={onlyMarked}
                onClick={() => setOnlyMarked((value) => !value)}
                className={TOGGLE}
                style={{ borderColor: alpha(RESERVE.steel, onlyMarked ? 0.6 : 0.2), color: onlyMarked ? RESERVE.ivory : alpha(RESERVE.ivory, 0.7) }}
              >
                Only marked for review
              </button>
            </div>

            {groups.length === 0 ? (
              <p className="text-[13px] text-white/60">{RESEARCH_COPY.n1NoneMarked}</p>
            ) : (
              <ul aria-label="Observation groups" className="flex flex-col gap-3">
                {groups.map((group) => (
                  <li key={group.key} className="rounded-2xl bg-white/[0.02] px-4 py-3.5">
                    <p className="font-mono text-[9px] uppercase tracking-[0.16em]" style={{ color: alpha(RESERVE.steel, 0.9) }}>{OBSERVATION_LABEL}</p>
                    <h4 className="mt-0.5 break-words text-[14px] font-semibold" style={{ color: RESERVE.ivory }}>Changed: {group.changed.label}</h4>
                    <p className="tnum text-[12px] text-white/50">
                      {group.count} {group.count === 1 ? "observation" : "observations"} · {group.markedCount} marked
                    </p>
                    <ul className="mt-2 flex flex-col divide-y divide-white/[0.05]">
                      {group.observations.map((observation) => {
                        const marked = Boolean(observation.markedForReviewAt);
                        const markerId = labMarkerIdOf(observation);
                        return (
                          <li key={observation.id} className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-start">
                            <div className="min-w-0 flex-1">
                              <p className="break-words text-[13px] text-white/80">
                                <span className="tnum text-white/50">{formatDay(observation.date)} · </span>Noticed: {observation.noticed.label}
                              </p>
                              {observation.note && <p className="mt-0.5 whitespace-pre-wrap break-words text-[12.5px] text-white/60">{observation.note}</p>}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {markerId && hasMarker(markerId) && (
                                <button
                                  type="button"
                                  onClick={() => onOpenMarker(markerId)}
                                  className={TOGGLE}
                                  style={{ borderColor: alpha(RESERVE.steel, 0.2), color: alpha(RESERVE.ivory, 0.75) }}
                                >
                                  Open in Lab Response
                                </button>
                              )}
                              <button
                                type="button"
                                aria-pressed={marked}
                                aria-label={`Mark for review: ${observation.noticed.label} on ${formatDay(observation.date)}`}
                                onClick={() => toggleObservationReview(observation.id)}
                                className={TOGGLE}
                                style={{ borderColor: alpha(RESERVE.amber, marked ? 0.6 : 0.2), color: marked ? RESERVE.amber : alpha(RESERVE.ivory, 0.75) }}
                              >
                                <Flag size={13} aria-hidden="true" />
                                {marked ? "Marked for review" : "Mark for review"}
                              </button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>
    </GlassPanel>
  );
}
