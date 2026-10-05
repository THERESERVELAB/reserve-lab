"use client";

import { GlassPanel } from "@/components/ui/GlassPanel";
import { ReserveButton } from "@/components/ui/reserve";
import { APEX_HORIZON_LOOK, HorizonTrack, type HorizonLane } from "@/components/ui/reserve/horizon";
import type { ApexAction, ApexLaneItem, ApexToday } from "@/lib/apex/today-types";
import { RESERVE, alpha } from "@/lib/design/tokens";
import { LANE_ACCENT, LANE_NAME, clockLabel } from "./format";

/* ════════════════════════════════════════════════════════════════════════
   DAY TIMELINE — the dominant region. Today on one clock, as a horizon.

   Now is a light gate near the viewer; the rest of the day recedes toward
   sleep lock (Bible §13, V1.2). The track is the shared horizon
   (`HorizonTrack`, Apex look): only the track has perspective, every item is
   a 44px button in list order, and depth compresses on narrow tracks. Where
   each minute lands comes from `horizon-projection.ts`, which is pure and
   tested — this file only names the lanes and carries the header.

   Motion: the gate holds still and items advance with the minute clock. The
   one loop is a slow light flow along each lane toward the gate, in the
   atmosphere band, and it stops under reduced motion.
   ════════════════════════════════════════════════════════════════════════ */

export function DayTimeline({
  today,
  dayLabel,
  headline,
  flexNotice,
  onOpenItems,
  onAction,
  onAdjust,
  className = "",
}: {
  today: ApexToday;
  dayLabel: string;
  headline: string;
  flexNotice: string | null;
  onOpenItems: (items: ApexLaneItem[]) => void;
  onAction: (action: ApexAction) => void;
  onAdjust: () => void;
  className?: string;
}) {
  const { window: win, nowMin, sleepLock, earlier } = today;
  /* Log-only entries never sit above the fold (Bible §13) — the logbook renders below the day. */
  const lanes: HorizonLane<ApexLaneItem>[] = today.lanes
    .filter((lane) => lane.id !== "logbook")
    .map((lane) => {
      const empty = lane.empty;
      const emptyAction = empty?.action ?? null;
      return {
        id: lane.id,
        name: LANE_NAME[lane.id],
        accent: LANE_ACCENT[lane.id],
        ariaLabel: lane.label,
        items: lane.items,
        empty: empty ? (
          <>
            <span className="truncate text-[11.5px] text-white/60">{empty.message}</span>
            {emptyAction && (
              <ReserveButton tier="quiet" size="sm" onClick={() => onAction(emptyAction)}>
                {emptyAction.label}
              </ReserveButton>
            )}
          </>
        ) : null,
      };
    });

  return (
    <GlassPanel accent={RESERVE.gold} noPad className={className}>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 px-5 pt-5 sm:px-6">
        <div className="min-w-0">
          {/* "Now" reads here rather than on the track's pill: the shared pill is
              drawn at 8.5px, under the §13 floor for the horizon strip, and its
              class belongs to the horizon primitive. The header sits outside the
              strip and has room to say it. */}
          <p className="font-mono text-[8.5px] uppercase tracking-[0.28em]" style={{ color: alpha(RESERVE.gold, 0.8) }}>
            Mission timeline · {dayLabel} · <span className="tnum">now {clockLabel(nowMin)}</span>
            <span className="sr-only">. Sleep lock {sleepLock.label}.</span>
          </p>
          <h2 className="mt-1.5 truncate font-display text-[20px] font-extrabold leading-tight tracking-[-0.01em] text-[#f2eee6]">
            {headline}
          </h2>
          {flexNotice && <p className="mt-1 max-w-[70ch] text-[11.5px] leading-[1.5] text-white/50">{flexNotice}</p>}
        </div>
        <div className="flex items-center gap-4">
          {earlier.total > 0 && (
            <span className="tnum font-mono text-[9px] uppercase tracking-[0.16em] text-white/65">
              Earlier · {earlier.done} of {earlier.total} done
            </span>
          )}
          <ReserveButton tier="quiet" size="sm" onClick={onAdjust}>
            Adjust Today
          </ReserveButton>
        </div>
      </div>

      <div data-apex="day-timeline" className="relative px-5 pb-6 pt-2 sm:px-6">
        <HorizonTrack
          window={win}
          nowMin={nowMin}
          sleepLockMin={sleepLock.min}
          lanes={lanes}
          look={APEX_HORIZON_LOOK}
          opens={() => true}
          onOpen={onOpenItems}
        />
      </div>
    </GlassPanel>
  );
}
