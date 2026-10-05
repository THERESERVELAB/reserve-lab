/* ════════════════════════════════════════════════════════════════════════
   SHEET DRAG — when a downward drag on a bottom sheet's handle dismisses it.

   Two ways out, as on the hardware:
     distance  the sheet has travelled a quarter of its height (capped, so a
               tall sheet does not ask for a long drag)
     fling     a short, quick flick downward

   Anything less springs back. Pure, so the thresholds are testable.
   ════════════════════════════════════════════════════════════════════════ */

export const SHEET_DRAG = {
  /** Share of the sheet's height that dismisses on release. */
  distanceRatio: 0.25,
  /** The distance threshold never asks for more than this. */
  maxDistancePx: 140,
  /** A fling must still travel this far, so a tap-jitter never closes. */
  minFlingPx: 24,
  /** Release speed (px per ms) that counts as a fling. */
  flingVelocity: 0.5,
  /** Samples older than this are ignored when measuring release speed. */
  velocityWindowMs: 100,
} as const;

export function sheetDismissDistance(sheetHeightPx: number): number {
  return Math.min(SHEET_DRAG.maxDistancePx, Math.max(0, sheetHeightPx) * SHEET_DRAG.distanceRatio);
}

export function shouldDismissSheet({
  offsetPx,
  velocityPxPerMs,
  sheetHeightPx,
}: {
  offsetPx: number;
  velocityPxPerMs: number;
  sheetHeightPx: number;
}): boolean {
  if (!Number.isFinite(offsetPx) || offsetPx <= 0) return false;
  if (offsetPx >= sheetDismissDistance(sheetHeightPx)) return true;
  return offsetPx >= SHEET_DRAG.minFlingPx && velocityPxPerMs >= SHEET_DRAG.flingVelocity;
}

/** Release speed from pointer samples, newest last. Downward is positive. */
export function releaseVelocity(samples: ReadonlyArray<{ y: number; t: number }>): number {
  if (samples.length < 2) return 0;
  const last = samples[samples.length - 1];
  const first =
    samples.find((sample) => last.t - sample.t <= SHEET_DRAG.velocityWindowMs) ?? samples[samples.length - 2];
  const dt = last.t - first.t;
  return dt > 0 ? (last.y - first.y) / dt : 0;
}
