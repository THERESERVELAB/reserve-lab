"use client";

import { GlassPanel } from "@/components/ui/GlassPanel";
import { ReserveButton } from "@/components/ui/reserve";
import { APEX_HORIZON_LOOK, HORIZON_SPINE_ROWS, HorizonSpine } from "@/components/ui/reserve/horizon";
import type { ApexAction, ApexLaneItem, ApexToday } from "@/lib/apex/today-types";
import { RESERVE, alpha } from "@/lib/design/tokens";
import { LANE_ACCENT, clockLabel } from "./format";

/* ════════════════════════════════════════════════════════════════════════
   NOW SPINE — the day timeline recomposed for a phone.

   Not a squeezed Gantt: the same lanes merged into one vertical line of time
   (the shared `HorizonSpine`, Apex look), starting one item before now. Five
   rows by default, the whole day on request. Logbook entries are not here —
   log-only content renders below the day, never in the first screen
   (Bible §13). On phones it is a flush section, not a card.
   ════════════════════════════════════════════════════════════════════════ */

export function NowSpine({
  today,
  onOpenItems,
  onAction,
  className = "",
}: {
  today: ApexToday;
  onOpenItems: (items: ApexLaneItem[]) => void;
  onAction: (action: ApexAction) => void;
  className?: string;
}) {
  const dayItems = today.lanes
    .filter((l) => l.id !== "logbook")
    .flatMap((l) => l.items)
    .sort((a, b) => a.startMin - b.startMin);
  const trainingEmpty = today.lanes.find((l) => l.id === "training")?.empty ?? null;
  const trainingEmptyAction = trainingEmpty?.action ?? null;

  return (
    <GlassPanel accent={RESERVE.gold} phone="flush" className={className}>
      <p className="font-mono text-[8.5px] uppercase tracking-[0.26em]" style={{ color: alpha(RESERVE.gold, 0.8) }}>
        Mission timeline · now {clockLabel(today.nowMin)}
      </p>

      {trainingEmpty && (
        <div className="mt-3 flex flex-wrap items-center gap-x-3">
          <span className="text-[12px] text-white/55">{trainingEmpty.message}</span>
          {trainingEmptyAction && (
            <ReserveButton tier="quiet" size="sm" onClick={() => onAction(trainingEmptyAction)}>
              {trainingEmptyAction.label}
            </ReserveButton>
          )}
        </div>
      )}

      <HorizonSpine
        className="mt-3"
        hook={{ "data-apex": "now-spine" }}
        label="Today, from now"
        items={dayItems}
        look={APEX_HORIZON_LOOK}
        accentOf={(item) => LANE_ACCENT[item.lane]}
        opens={() => true}
        onOpen={(item) => onOpenItems([item])}
        footer={(state) => (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <span className="tnum font-mono text-[8.5px] uppercase tracking-[0.16em] text-white/65">
              {state.hiddenAfter > 0 ? `+${state.hiddenAfter} more today · ` : ""}Sleep lock {today.sleepLock.label}
            </span>
            {state.total > HORIZON_SPINE_ROWS && (
              <ReserveButton tier="quiet" size="sm" onClick={state.toggle}>
                {state.expanded ? "Show less" : "Show full day"}
              </ReserveButton>
            )}
          </div>
        )}
      />
    </GlassPanel>
  );
}
