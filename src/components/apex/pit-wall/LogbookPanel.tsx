"use client";

import { GlassPanel } from "@/components/ui/GlassPanel";
import { ReserveButton, ReserveStatusChip, type ReserveStatus } from "@/components/ui/reserve";
import type { ApexAction, ApexItemStatus, ApexLane } from "@/lib/apex/today-types";
import { RESERVE } from "@/lib/design/tokens";
import { STATUS_WORD } from "./format";

const CHIP_STATUS: Partial<Record<ApexItemStatus, ReserveStatus>> = {
  "due-now": "due-now",
  "due-next": "due-next",
  "past-due": "past-due",
  completed: "completed",
  skipped: "skipped",
};

/* ════════════════════════════════════════════════════════════════════════
   LOGBOOK — the member's own entries, below the day.

   Log-only content never sits above the fold (Bible §13), so these rows are
   not a lane on the timeline. Each shows exactly what the member entered — a
   name, a planned time, a status — and nothing Reserve could be read as
   recommending: no amounts, no routes, no sites on this screen.
   ════════════════════════════════════════════════════════════════════════ */

export function LogbookPanel({ lane, onAction }: { lane: ApexLane; onAction: (action: ApexAction) => void }) {
  return (
    <GlassPanel accent={RESERVE.slate}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 className="font-mono text-[9px] uppercase tracking-[0.26em] text-white/55">Logbook · user-entered</h2>
        <ReserveStatusChip status="log-only" />
      </div>

      {lane.items.length === 0 ? (
        <p className="mt-3 text-[12.5px] text-white/50">{lane.empty?.message ?? "No timed entries today"}</p>
      ) : (
        <ul className="mt-2 flex flex-col">
          {lane.items.map((item, i) => {
            const chip = CHIP_STATUS[item.status];
            return (
              <li
                key={item.id}
                className={`flex flex-wrap items-center gap-x-4 gap-y-2 py-2.5 ${i > 0 ? "border-t border-white/[0.05]" : ""}`}
              >
                <span className="tnum w-[64px] shrink-0 font-mono text-[11px] text-white/55">{item.timeLabel}</span>
                <span className="min-w-0 flex-1 break-words text-[13px] font-semibold text-[#f2eee6]">{item.label}</span>
                {chip ? (
                  <ReserveStatusChip status={chip} />
                ) : (
                  <span className="font-mono text-[8px] uppercase tracking-[0.16em] text-white/40">{STATUS_WORD[item.status]}</span>
                )}
                {item.action && (
                  <ReserveButton tier="secondary" size="sm" accent={RESERVE.slate} onClick={() => onAction(item.action!)}>
                    {item.action.label}
                  </ReserveButton>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-3 text-[11px] leading-[1.55] text-white/40">
        Log-only · user-entered schedule. Reserve does not recommend compounds, supplements, vitamins, amounts, or sites.
      </p>
    </GlassPanel>
  );
}
