/* ════════════════════════════════════════════════════════════════════════
   LOOP SEAM — carrying a loop across its own join.

   Every room loop is generated with the day plate as its first AND last
   frame, but a generated last frame is never pixel-identical to the first
   (Training's differs in about 7% of pixels). A hard wrap shows that as a
   jolt once every cycle.

   The plate is already painted under the loop, and the loop's first frame IS
   that plate. So the seam needs no second video and no canvas: shortly before
   the end the loop fades out to the plate, the element wraps while hidden,
   and it fades back in on frame 0, which matches the plate exactly. The only
   visible change is last frame → plate, spread over SEAM_MS.

   One timer per cycle, scheduled from the element's own clock, and nothing
   at all while the loop is paused or resolved to a still.
   ════════════════════════════════════════════════════════════════════════ */

/** The fade out to the plate before the wrap, and back in after it. */
export const LOOP_SEAM_MS = 400;

/**
 * Milliseconds from now until the fade out should begin, or null when no seam
 * should be scheduled (unknown or too short a duration, or a stopped clock).
 */
export function loopSeamDelayMs(duration: number, currentTime: number, playbackRate = 1): number | null {
  if (!Number.isFinite(duration) || duration * 1000 <= LOOP_SEAM_MS * 2) return null;
  if (!Number.isFinite(currentTime) || !(playbackRate > 0)) return null;
  const remainingMs = ((duration - currentTime) * 1000) / playbackRate;
  return Math.max(0, remainingMs - LOOP_SEAM_MS);
}

/**
 * Whether the clock went backwards by more than jitter: the element wrapped to
 * the start (or was sent there). A playing clock never runs backwards otherwise.
 */
export function isLoopRestart(previousTime: number, currentTime: number): boolean {
  return currentTime + 0.5 < previousTime;
}
