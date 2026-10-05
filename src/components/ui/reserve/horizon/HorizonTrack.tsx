"use client";

import type { CSSProperties, ReactNode } from "react";

import { clockLabel, hourLabel } from "@/components/apex/pit-wall/format";
import {
  HORIZON,
  chipMetrics,
  horizonFrame,
  horizonTicks,
  layoutHorizonLane,
  type HorizonChip,
  type HorizonFrame,
} from "@/lib/apex/horizon-projection";
import { RESERVE, alpha } from "@/lib/design/tokens";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import { useAmbientMotionStore } from "@/lib/ui/ambient-motion-store";

import { HorizonFloor } from "./HorizonFloor";
import type { HorizonLook } from "./horizon-look";
import {
  HORIZON_LABEL_COL_PX,
  chipFace,
  describeHorizonItems,
  horizonTrackHeightPx,
  isSettledStatus,
  type HorizonItem,
} from "./horizon-model";
import { useTrackWidth } from "./useTrackWidth";

/* ════════════════════════════════════════════════════════════════════════
   HORIZON TRACK — lanes on a perspective floor (md and up).

   Now is a light gate near the viewer; the rest of the window recedes. Only
   the floor has perspective: lane names, tick labels and chips stay flat and
   upright. Every item that opens something is a real button with a 44px hit
   area, items closer than a hit area collapse into one control, and DOM order
   is lane by lane, item by item. An item with nothing to open is text.

   It moves with the minute clock. The one loop is the lane light flow
   (`fba-horizon-flow`, 12s), which stops under reduced motion and when the top
   bar pauses background motion.
   ════════════════════════════════════════════════════════════════════════ */

export type HorizonLane<T extends HorizonItem> = {
  id: string;
  /** Printed in the lane column. */
  name: string;
  accent: string;
  /** The lane's accessible group name, e.g. "Fuel today". */
  ariaLabel: string;
  items: readonly T[];
  /** Said from the gate when the lane has nothing on the track. Null says nothing. */
  empty: ReactNode | null;
};

export function HorizonTrack<T extends HorizonItem>({
  window,
  nowMin,
  sleepLockMin,
  lanes,
  look,
  opens,
  onOpen,
  nowPill = false,
  className = "",
}: {
  window: { startMin: number; endMin: number };
  nowMin: number;
  sleepLockMin: number | null;
  lanes: readonly HorizonLane<T>[];
  look: HorizonLook;
  /** A chip is a button when any of its items opens something. */
  opens: (items: readonly T[]) => boolean;
  onOpen: (items: T[]) => void;
  /** Print "Now 4:12 PM" under the gate. */
  nowPill?: boolean;
  className?: string;
}) {
  const [trackRef, trackPx] = useTrackWidth();
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  /* The top bar's pause stops the lane light flow too, not just the room. */
  const motionPaused = useAmbientMotionStore((state) => state.paused);
  const frame = horizonFrame(window, nowMin, trackPx);
  const nowVisible = nowMin >= window.startMin && nowMin <= window.endMin;

  return (
    <div className={`relative ${className}`} style={{ height: horizonTrackHeightPx(lanes.length) }}>
      {/* The floor, hour ticks, sleep lock and the now gate — one overlay over
          the track column, behind the items. */}
      <div ref={trackRef} className="pointer-events-none absolute inset-y-0 right-0" style={{ left: HORIZON_LABEL_COL_PX }} aria-hidden="true">
        <HorizonFloor
          frame={frame}
          accents={lanes.map((lane) => lane.accent)}
          sleepLockMin={sleepLockMin}
          nowVisible={nowVisible}
          flow={!reducedMotion && !motionPaused}
          look={look.floor}
        />
        <HorizonTicks frame={frame} look={look} />
        {nowPill && nowVisible && (
          <HorizonNowPill
            className="-bottom-5 py-px text-[8.5px] tracking-[0.14em]"
            style={{ left: `${frame.gate * 100}%` }}
            nowMin={nowMin}
          />
        )}
      </div>

      <div className="relative grid" style={{ gridTemplateColumns: `${HORIZON_LABEL_COL_PX}px minmax(0, 1fr)`, paddingTop: HORIZON.ticksPx }}>
        {lanes.map((lane, index) => (
          <LaneRow key={lane.id} lane={lane} laneIndex={index} frame={frame} look={look} opens={opens} onOpen={onOpen} />
        ))}
      </div>
    </div>
  );
}

/** Hour labels along the top of the track, where each has room to be read. */
export function HorizonTicks({ frame, look, minPx = 0 }: { frame: HorizonFrame; look: HorizonLook; minPx?: number }) {
  return (
    <>
      {horizonTicks(frame)
        .filter((tick) => tick.labelled && tick.x * frame.trackPx > minPx)
        .map((tick) => (
          <span
            key={tick.min}
            className={`absolute top-0 -translate-x-1/2 whitespace-nowrap ${look.tick.className}`}
            style={{
              left: `${tick.x * 100}%`,
              fontSize: look.tick.fontPx ? look.tick.fontPx(tick.depth) : undefined,
              color: `rgba(255,255,255,${look.tick.alpha(tick.depth).toFixed(2)})`,
            }}
          >
            {hourLabel(tick.min)}
          </span>
        ))}
    </>
  );
}

/** "Now 4:12 PM" on the gate. Position and size come from the caller. */
export function HorizonNowPill({ nowMin, className, style }: { nowMin: number; className: string; style: CSSProperties }) {
  return (
    <span
      className={`tnum absolute -translate-x-1/2 whitespace-nowrap rounded-full px-2 font-mono uppercase ${className}`}
      style={{ color: RESERVE.amber, background: RESERVE.base, boxShadow: `inset 0 0 0 1px ${alpha(RESERVE.gold, 0.5)}`, ...style }}
    >
      Now {clockLabel(nowMin)}
    </span>
  );
}

function LaneRow<T extends HorizonItem>({
  lane,
  laneIndex,
  frame,
  look,
  opens,
  onOpen,
}: {
  lane: HorizonLane<T>;
  laneIndex: number;
  frame: HorizonFrame;
  look: HorizonLook;
  opens: (items: readonly T[]) => boolean;
  onOpen: (items: T[]) => void;
}) {
  const chips = layoutHorizonLane(lane.items, laneIndex, frame);

  return (
    <>
      <div className={look.lane.rowClass}>
        <span className={look.lane.nameClass} style={{ color: alpha(lane.accent, 0.95) }}>
          {lane.name}
        </span>
      </div>
      <div className="relative h-14" role="group" aria-label={lane.ariaLabel}>
        {chips.length === 0 && lane.empty ? (
          /* An empty lane speaks from the gate, where the rest of the day begins. */
          <div className="flex h-full min-w-0 items-center gap-2" style={{ paddingLeft: `calc(${frame.gate * 100}% + 12px)` }}>
            {lane.empty}
          </div>
        ) : (
          chips.map((chip) => <HorizonChipControl key={chip.key} chip={chip} accent={lane.accent} look={look} opens={opens} onOpen={onOpen} />)
        )}
      </div>
    </>
  );
}

function HorizonChipControl<T extends HorizonItem>({
  chip,
  accent,
  look,
  opens,
  onOpen,
}: {
  chip: HorizonChip<T>;
  accent: string;
  look: HorizonLook;
  opens: (items: readonly T[]) => boolean;
  onOpen: (items: T[]) => void;
}) {
  const items = chip.items;
  if (items.length === 0) return null;
  const metrics = chipMetrics(chip.depth);
  const hot = items.some((item) => item.status === "due-now");
  const next = items.some((item) => item.status === "due-next");
  const settled = items.every((item) => isSettledStatus(item.status));
  const face = chipFace(chip, metrics.fontPx, look.chip.fitLabels);
  const range = chip.mode === "range";

  /* A static ring on rooms; the Pit Wall's due chip glows. */
  const ring = hot ? look.chip.hotRing : next ? look.chip.nextRing : undefined;
  /* The lane converges toward the horizon; the control stays flat. */
  const style: CSSProperties = { ...face.position, top: `calc(50% + ${chip.shiftPx}px)`, zIndex: hot ? 3 : 2 };
  const frameClass = `group absolute flex h-11 min-w-[44px] -translate-y-1/2 items-center rounded-[10px] ${face.dot ? "-translate-x-1/2 justify-center" : ""} ${!face.dot && chip.mode === "end" ? "justify-end" : ""}`;
  const tint = alpha(accent, (range ? look.chip.rangeFill : look.chip.fill) * metrics.fill);
  const labelBox = look.chip.fitLabels ? `whitespace-nowrap ${range ? "w-full overflow-hidden" : ""}` : range ? "w-full" : "max-w-full";

  const faceNode = face.dot ? (
    <span
      aria-hidden="true"
      className="grid place-items-center rounded-full transition-transform duration-200 group-hover:scale-125"
      style={{
        width: metrics.dotPx,
        height: metrics.dotPx,
        /* The hit area may step aside for its neighbour; the dot stays on its minute. */
        transform: face.dotShiftPx ? `translateX(${face.dotShiftPx}px)` : undefined,
        background: alpha(accent, settled ? 0.35 : 0.5 + 0.4 * chip.depth),
        boxShadow: ring,
      }}
    />
  ) : (
    <span
      aria-hidden="true"
      className={`flex min-w-0 items-center gap-1.5 rounded-[8px] px-2.5 text-left font-semibold leading-none text-[#f2eee6] transition-[filter] duration-200 group-hover:brightness-125 ${labelBox} ${hot && look.chip.hotPulse ? "fba-glow-pulse" : ""}`}
      style={{
        height: metrics.heightPx,
        fontSize: metrics.fontPx,
        /* Opaque base under the tint, so the lane line never strikes through the label. */
        background: `linear-gradient(${tint}, ${tint}), ${RESERVE.base}`,
        opacity: settled ? look.chip.settledOpacity : 1,
        boxShadow: ring,
      }}
    >
      {face.tick && <span>✓</span>}
      <span className={look.chip.fitLabels ? undefined : "truncate"}>{face.label}</span>
    </span>
  );

  if (!opens(items)) {
    return (
      <span className={frameClass} style={style}>
        {faceNode}
        <span className="sr-only">{describeHorizonItems(items)}</span>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onOpen([...items])}
      aria-haspopup="dialog"
      aria-label={describeHorizonItems(items)}
      className={`${frameClass} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e8c87a]`}
      style={style}
    >
      {faceNode}
    </button>
  );
}
