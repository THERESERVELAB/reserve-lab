import type { AmbientMotion } from "@/lib/ui/ambient-motion";

/* ════════════════════════════════════════════════════════════════════════
   LIVING NUMERALS — the arithmetic behind ReserveLiveNumber.

   A number that changes because the member just logged something counts from
   its old value to its new one (450ms). It never animates:
     - on its first render (there is no "old" value to count from);
     - when the change was not a member's log (clock ticks, cloud restore,
       hydration) — only within LIVE_NUMBER_SIGNAL_WINDOW_MS of a signal;
     - under reduced or static motion (it simply shows the new value).
   The final value is always what React renders; the tween only paints the
   frames in between.

   A replay counts again from a value the caller names, once per replay id:
   a moment that lands after the change (the Nutrition meal moment fires when
   the confirmation drawer has closed) counts in front of the member instead
   of behind the drawer. Replays obey the same motion gate.
   ════════════════════════════════════════════════════════════════════════ */

export const LIVE_NUMBER_MS = 450;
/** A change counts as the result of a log only this soon after the signal. */
export const LIVE_NUMBER_SIGNAL_WINDOW_MS = 1500;

export type LiveNumberPlan = { animate: false } | { animate: true; from: number; to: number };

export function planLiveNumber({
  previous,
  next,
  motion,
  msSinceSignal,
  replayFrom = null,
}: {
  /** Null on the first render. */
  previous: number | null;
  next: number;
  motion: AmbientMotion;
  msSinceSignal: number;
  /** A new replay: count from this value to `next`. Null when there is none. */
  replayFrom?: number | null;
}): LiveNumberPlan {
  if (replayFrom !== null && previous !== null) {
    if (motion !== "full" || !Number.isFinite(replayFrom) || !Number.isFinite(next) || replayFrom === next) return { animate: false };
    return { animate: true, from: replayFrom, to: next };
  }
  if (previous === null) return { animate: false };
  if (previous === next || !Number.isFinite(previous) || !Number.isFinite(next)) return { animate: false };
  if (motion !== "full") return { animate: false };
  if (!(msSinceSignal <= LIVE_NUMBER_SIGNAL_WINDOW_MS)) return { animate: false };
  return { animate: true, from: previous, to: next };
}

export const easeOutCubic = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

/** The value painted `elapsedMs` into a tween. */
export function tweenLiveNumber(from: number, to: number, elapsedMs: number, durationMs = LIVE_NUMBER_MS): number {
  return from + (to - from) * easeOutCubic(elapsedMs / durationMs);
}

export function formatLiveNumber(value: number, decimals: number): string {
  return value.toFixed(decimals);
}
