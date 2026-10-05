"use client";

/* ════════════════════════════════════════════════════════════════════════
   RESPONSE EVENT LOG — real Response Model history.

   Every entry here happened. Nothing is seeded, defaulted, or illustrative:
   when Reserve has learned nothing yet, this says so.
   ════════════════════════════════════════════════════════════════════════ */

import { useMemo } from "react";

import { useAthleteDashboardStore } from "@/lib/athlete-store";
import { useResponseModel } from "@/lib/hooks/useResponseModel";
import { formatAffectedWeeks, formatLogDay, localizeWeightRate } from "@/lib/response-model/event-log-format";
import { CONFIDENCE_LABEL } from "@/lib/response-model/confidence";
import { DOMAIN_LABEL, RESPONSE_EVENT_LABEL, type ResponseEventType } from "@/lib/response-model/types";

const EVENT_TONE: Record<ResponseEventType, string> = {
  "insight-emerged": "text-sky-200",
  "insight-strengthened": "text-emerald-200",
  "insight-weakened": "text-amber-200",
  "insight-conflicted": "text-amber-200",
  "insight-superseded": "text-white/50",
  "insight-expired": "text-white/40",
  "insight-archived": "text-white/40",
  "recommendation-created": "text-white",
  "recommendation-accepted": "text-emerald-200",
  "recommendation-declined": "text-white/60",
  "recommendation-deferred": "text-white/50",
  "program-revised": "text-emerald-100",
};

export function ResponseEventLog() {
  const { events } = useResponseModel();
  /* The engine works in kg; the member reads their own unit. */
  const units = useAthleteDashboardStore((state) => state.settings.units);

  const ordered = useMemo(() => [...events].reverse().slice(0, 25), [events]);

  return (
    /* No surface of its own: this renders inside the screen's panel, and a
       bordered rounded box here is card-in-card (components.md rule 1). The
       panel supplies the section label. */
    <section>
      {ordered.length === 0 ? (
        <p className="text-[12px] leading-6 text-white/40">
          Nothing yet. Entries appear here when Reserve observes a pattern in your completed training,
          proposes a change, or you decide on one. This log is never pre-populated.
        </p>
      ) : (
        <ul className="space-y-3">
          {ordered.map((event) => (
            <li key={event.id} className="border-l border-white/[0.1] pl-3.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`font-mono text-[9px] uppercase tracking-[0.18em] ${EVENT_TONE[event.type]}`}>
                  {RESPONSE_EVENT_LABEL[event.type]}
                </span>
                <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/25">
                  {formatLogDay(new Date(event.at))}
                </span>
                {event.domain && (
                  <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/25">
                    {DOMAIN_LABEL[event.domain]}
                  </span>
                )}
                <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/25">
                  {CONFIDENCE_LABEL[event.confidence]}
                </span>
              </div>
              <p className="mt-1.5 text-[12px] leading-6 text-white/70">{localizeWeightRate(event.observation, units)}</p>
              <p className="mt-0.5 text-[11px] leading-5 text-white/40">
                {localizeWeightRate(event.decision, units)} — {localizeWeightRate(event.reason, units)}
              </p>
              {event.affectedWeeks.length > 0 && (
                <p data-event-weeks className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-white/25">
                  {formatAffectedWeeks(event.affectedWeeks)}
                  {event.athleteDecision ? ` · ${event.athleteDecision}` : ""}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
