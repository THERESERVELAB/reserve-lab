"use client";

import { useId } from "react";

import { HORIZON, horizonTicks, laneYPx, projectMinute, type HorizonFrame } from "@/lib/apex/horizon-projection";
import { RESERVE } from "@/lib/design/tokens";

import type { HorizonLook } from "./horizon-look";

/**
 * The floor under a horizon: the lived part of the day behind the gate, the
 * floor light receding toward the far end, hourly ticks, one light line per
 * lane, sleep lock and the now gate. Drawn in real pixels from the measured
 * track, so nothing is stretched. Decorative: the controls sit above it.
 */
export function HorizonFloor({
  frame,
  accents,
  sleepLockMin,
  nowVisible,
  flow,
  look,
}: {
  frame: HorizonFrame;
  /** One accent per lane, top to bottom. */
  accents: readonly string[];
  /** Sleep lock's minute, or null when the horizon has none. */
  sleepLockMin: number | null;
  /** Now falls inside the window: draw the gate. */
  nowVisible: boolean;
  /** The lane light may flow (not reduced, not paused, not live). */
  flow: boolean;
  look: HorizonLook["floor"];
}) {
  const gid = `hz${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const n = Math.max(1, accents.length);
  const w = frame.trackPx;
  const h = laneYPx(n, 1);
  const gx = frame.gate * w;
  const nearTop = laneYPx(0, 1);
  const nearBottom = laneYPx(n, 1);
  const farTop = laneYPx(0, 0);
  const farBottom = laneYPx(n, 0);
  const sleep =
    sleepLockMin !== null && sleepLockMin >= frame.startMin && sleepLockMin <= frame.endMin ? projectMinute(sleepLockMin, frame) : null;

  return (
    <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`${gid}-floor`} gradientUnits="userSpaceOnUse" x1={gx} y1="0" x2={w} y2="0">
          <stop offset="0" stopColor={look.accent} stopOpacity={look.opacity} />
          <stop offset="1" stopColor={look.accent} stopOpacity="0" />
        </linearGradient>
        {look.gateGlow !== null && (
          <linearGradient id={`${gid}-gate`} gradientUnits="userSpaceOnUse" x1={gx - 28} y1="0" x2={gx + 44} y2="0">
            <stop offset="0" stopColor={look.gate} stopOpacity="0" />
            <stop offset="0.39" stopColor={look.gate} stopOpacity={look.gateGlow} />
            <stop offset="1" stopColor={look.gate} stopOpacity="0" />
          </linearGradient>
        )}
      </defs>

      {/* Behind the gate: the part of the day already lived, a shade quieter. */}
      {gx > 0 && <rect x={0} y={nearTop} width={gx} height={nearBottom - nearTop} fill={RESERVE.base} fillOpacity={0.22} />}
      {/* The floor, receding toward the far end. */}
      {gx < w && <polygon points={`${gx},${nearTop} ${w},${farTop} ${w},${farBottom} ${gx},${nearBottom}`} fill={`url(#${gid}-floor)`} />}

      {horizonTicks(frame).map((tick) => (
        <line
          key={tick.min}
          x1={tick.x * w}
          x2={tick.x * w}
          y1={laneYPx(0, tick.depth)}
          y2={laneYPx(n, tick.depth)}
          stroke="#ffffff"
          strokeOpacity={0.035 + 0.045 * tick.depth}
        />
      ))}

      {accents.map((accent, i) => {
        const near = laneYPx(i + 0.5, 1);
        const far = laneYPx(i + 0.5, 0);
        return (
          <g key={i}>
            {gx > 0 && <line x1={0} y1={near} x2={gx} y2={near} stroke={accent} strokeOpacity={0.12} />}
            {gx < w && <line x1={gx} y1={near} x2={w} y2={far} stroke={accent} strokeOpacity={0.2} />}
            {gx < w && (flow || look.dashesWhenStill) && (
              <line
                x1={gx}
                y1={near}
                x2={w}
                y2={far}
                stroke={accent}
                strokeOpacity={0.5}
                strokeWidth={1.6}
                strokeLinecap="round"
                strokeDasharray="2 22"
                className={flow ? "fba-horizon-flow" : undefined}
              />
            )}
          </g>
        );
      })}

      {sleep && (
        <line
          x1={sleep.x * w}
          x2={sleep.x * w}
          y1={laneYPx(0, sleep.depth)}
          y2={laneYPx(n, sleep.depth)}
          stroke={RESERVE.violet}
          strokeOpacity={0.7}
          strokeWidth={2}
        />
      )}

      {nowVisible && (
        <>
          {look.gateGlow !== null && <rect x={gx - 28} y={nearTop} width={72} height={nearBottom - nearTop} fill={`url(#${gid}-gate)`} />}
          <line x1={gx} x2={gx} y1={HORIZON.ticksPx - 6} y2={nearBottom} stroke={look.gate} strokeOpacity={0.18} strokeWidth={8} />
          <line x1={gx} x2={gx} y1={HORIZON.ticksPx - 6} y2={nearBottom} stroke={look.gate} strokeWidth={2} />
        </>
      )}
    </svg>
  );
}
