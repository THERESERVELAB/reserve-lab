"use client";

import { useLayoutEffect, useRef, type CSSProperties } from "react";

import { useAmbientMotion } from "@/lib/ui/use-ambient-motion";
import {
  LIVE_NUMBER_MS,
  formatLiveNumber,
  planLiveNumber,
  tweenLiveNumber,
} from "@/lib/ui/live-number";
import { msSinceLastSignal } from "@/lib/ui/signal-bus";

/* ════════════════════════════════════════════════════════════════════════
   RESERVE LIVE NUMBER — a numeral that counts to its new value after a log.

   React always renders the true final value as this span's only text, so the
   accessible name, a screenshot at rest and a no-JS paint all read the real
   number. When a member's log changes it, a bounded 450ms frame loop paints
   the in-between values into that same text node before first paint of the
   change, then stops. Tabular figures keep the width steady while it counts.

   No animation on first render, on changes that are not a member's log, or
   under reduced / static motion (src/lib/ui/live-number.ts).
   ════════════════════════════════════════════════════════════════════════ */

export function ReserveLiveNumber({
  value,
  decimals = 0,
  className = "",
  style,
  replay = null,
  countMs = LIVE_NUMBER_MS,
}: {
  value: number;
  decimals?: number;
  className?: string;
  style?: CSSProperties;
  /** Count again from `from` to `value`, once per `id` (see live-number.ts). */
  replay?: { id: number; from: number } | null;
  /** How long a count takes. The default is the log count (450ms); a dial drawing in slowly counts with it. */
  countMs?: number;
}) {
  const motion = useAmbientMotion();
  const ref = useRef<HTMLSpanElement>(null);
  /** The value last painted (mid-tween, the in-between value). Null before mount. */
  const painted = useRef<number | null>(null);
  const frame = useRef<number | null>(null);
  const replayed = useRef<number | null>(null);
  const replayId = replay?.id ?? null;
  const replayFrom = replay?.from ?? null;

  useLayoutEffect(() => {
    const el = ref.current;
    const freshReplay = replayId !== null && replayId !== replayed.current;
    replayed.current = replayId;
    const plan = planLiveNumber({
      previous: painted.current,
      next: value,
      motion,
      msSinceSignal: msSinceLastSignal(),
      replayFrom: freshReplay ? replayFrom : null,
    });
    if (frame.current !== null) {
      cancelAnimationFrame(frame.current);
      frame.current = null;
    }
    const text = el?.firstChild;
    if (!plan.animate || !text || text.nodeType !== Node.TEXT_NODE) {
      painted.current = value;
      /* An interrupted count may have left an in-between value painted. */
      if (text && text.nodeType === Node.TEXT_NODE) text.nodeValue = formatLiveNumber(value, decimals);
      return;
    }

    const { from, to } = plan;
    const write = (n: number) => {
      painted.current = n;
      text.nodeValue = formatLiveNumber(n, decimals);
    };
    const start = performance.now();
    write(from);
    const step = (now: number) => {
      const elapsed = now - start;
      if (elapsed >= countMs) {
        write(to);
        frame.current = null;
        return;
      }
      write(tweenLiveNumber(from, to, elapsed, countMs));
      frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
    /* A hidden tab suspends frames: land on the true value regardless. */
    const settle = window.setTimeout(() => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = null;
      write(to);
    }, countMs + 120);

    return () => {
      window.clearTimeout(settle);
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = null;
      /* Interrupted mid-count: the next run counts on from what is painted,
         and re-syncs the text to React's value when it does not animate. */
    };
  }, [value, decimals, motion, replayId, replayFrom, countMs]);

  return (
    <span ref={ref} data-live-number="" className={`tnum ${className}`} style={{ fontVariantNumeric: "tabular-nums", ...style }}>
      {formatLiveNumber(value, decimals)}
    </span>
  );
}
