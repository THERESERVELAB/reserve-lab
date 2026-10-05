/* ════════════════════════════════════════════════════════════════════════
   LOOP CROSSFADE — carrying a room loop over its own end, invisibly.

   A room loop is eight seconds of a still room breathing. Its last frame and
   its first frame are close but never identical, so a bare wrap reads as a
   cut: "it looks like it repeats instead of just flowing over and over."
   The seam fade (loop-seam) hid that cut behind the plate, which traded the
   cut for a pulse — the room dimming to a still and lifting again, once a
   cycle. Both are events. A room should have none.

   So the loop is carried by TWO layers of the same clip. While layer A runs
   out its last second, layer B — already seeked to frame 0 — starts at full
   opacity UNDERNEATH A, and A thins away above it. The composite is
   `a·A + (1−a)·B`: a true dissolve, with no dip in brightness and no double
   exposure, because exactly one of the two is ever partly transparent. Then
   the roles swap: A is parked back at frame 0, paused, waiting to be the
   incoming layer next time.

   It is the OUTGOING layer that animates, never the incoming one. A layer at
   `opacity: 0` is not painted, and a browser will not start an opacity
   transition on an unpainted element until it has composited it — measured
   here as a dissolve that sat pending for most of a second and then cut. The
   layer fading out has been on screen all along, so its fade starts on the
   next frame, every time.

   Nothing here touches the DOM. It answers three questions for the renderer:
   WHEN the dissolve starts, WHICH layer leads, and what the two layers'
   opacities and stacking are — so all of it is testable without a browser.

   Calm is the other half. Loops play slowed (`LOOP_PLAYBACK_RATE`, per-room
   override in the manifest) because fast is not smooth: smooth is slow.
   ════════════════════════════════════════════════════════════════════════ */

/**
 * The dissolve, in wall-clock milliseconds. Long enough to read as drift
 * rather than a transition, short enough that the two layers only ever
 * overlap on the loop's quietest second.
 */
export const LOOP_CROSSFADE_MS = 800;

/**
 * Symmetric ease-in-out. A dissolve has no arrival and no departure — it is
 * the same gesture in both directions, so it cannot borrow the interface's
 * ease-out curves without leaning to one side.
 */
export const LOOP_CROSSFADE_EASING = "cubic-bezier(0.45, 0, 0.55, 1)";

/**
 * Wall-clock margin between the end of the dissolve and the outgoing layer's
 * own end. The handover is triggered from the element's clock and the fade is
 * run by the browser, and both can be a few frames late; this is the room
 * they are given, so that the layer being thinned away is always gone before
 * it reaches the end it was hired to hide.
 */
export const LOOP_CROSSFADE_LEAD_MS = 500;

/**
 * Playback rate for every room loop unless the manifest overrides it. A room
 * is atmosphere, not footage: at 0.6× the camera drifts rather than moves.
 */
export const LOOP_PLAYBACK_RATE = 0.6;

/**
 * The rate a room actually plays at: its own, when the manifest gives it one,
 * and the shared slowed rate otherwise. A rate of 0 or less would stop the
 * room, which is a still, not a loop — the shared rate serves instead.
 */
export function loopPlaybackRate(override: number | undefined): number {
  if (typeof override !== "number" || !Number.isFinite(override) || override <= 0) return LOOP_PLAYBACK_RATE;
  return override;
}

/** Two layers of one clip. Their names never change; their roles swap. */
export type LoopLayerId = "a" | "b";

export const LOOP_LAYER_IDS: readonly LoopLayerId[] = ["a", "b"];

export function otherLoopLayer(layer: LoopLayerId): LoopLayerId {
  return layer === "a" ? "b" : "a";
}

export type CrossfadeTiming = {
  /** Wall-clock length of the dissolve. */
  fadeMs?: number;
  /** Wall-clock margin left after the dissolve. */
  leadMs?: number;
  /** The rate both layers play at. */
  playbackRate?: number;
};

const timingOf = ({ fadeMs = LOOP_CROSSFADE_MS, leadMs = LOOP_CROSSFADE_LEAD_MS, playbackRate = LOOP_PLAYBACK_RATE }: CrossfadeTiming) => ({
  fadeMs,
  leadMs,
  playbackRate,
});

/**
 * The point on the outgoing layer's own clock where the incoming layer
 * starts, in media seconds.
 *
 * Wall-clock time is converted to media time by the playback rate: at 0.6×,
 * an 800ms dissolve consumes 0.48s of the clip. `null` when no crossfade can
 * be scheduled — an unknown or stopped clock, or a clip too short to give the
 * dissolve and its margin a quiet run at the end.
 */
export function crossfadeStartSeconds(duration: number, timing: CrossfadeTiming = {}): number | null {
  const { fadeMs, leadMs, playbackRate } = timingOf(timing);
  if (!Number.isFinite(duration) || duration <= 0) return null;
  if (!(playbackRate > 0) || !(fadeMs >= 0) || !(leadMs >= 0)) return null;
  const windowSeconds = ((fadeMs + leadMs) / 1000) * playbackRate;
  /* The dissolve may never take more than half the clip, or the two layers
     would be on screen together more often than not. */
  if (windowSeconds * 2 >= duration) return null;
  return duration - windowSeconds;
}

/**
 * Whether the dissolve should begin now. True from the start point onward, so
 * a late reading (a throttled tab, a browser without per-frame callbacks)
 * still triggers it rather than skipping the wrap.
 */
export function shouldStartCrossfade(duration: number, currentTime: number, timing: CrossfadeTiming = {}): boolean {
  const start = crossfadeStartSeconds(duration, timing);
  if (start === null) return false;
  if (!Number.isFinite(currentTime)) return false;
  return currentTime >= start;
}

/**
 * Which layer is on screen, and whether the other one is currently dissolving
 * in over it. `incoming` is the layer that most recently took over, held only
 * for the length of the dissolve.
 */
export type CrossfadeState = {
  primary: LoopLayerId;
  incoming: LoopLayerId | null;
};

export const CROSSFADE_IDLE: CrossfadeState = { primary: "a", incoming: null };

/** Hand over to the other layer: it becomes primary, and it is the one fading in. */
export function startCrossfade(state: CrossfadeState): CrossfadeState {
  const next = otherLoopLayer(state.primary);
  return { primary: next, incoming: next };
}

/** The dissolve has finished: the new primary stands alone. */
export function settleCrossfade(state: CrossfadeState): CrossfadeState {
  return { primary: state.primary, incoming: null };
}

/** Whether the renderer may hand over at all right now. */
export function canCrossfade(state: CrossfadeState, ready: boolean): boolean {
  return ready && state.incoming === null;
}

export type CrossfadeLayerView = {
  /** Target opacity. The CSS transition supplies the dissolve itself. */
  opacity: number;
  /** Stacking. The layer fading out stays on top until it is gone. */
  zIndex: number;
  /** Whether this layer's element should be running. */
  playing: boolean;
  /** Whether this layer's opacity change is the dissolve (and so transitions). */
  fading: boolean;
  role: "primary" | "incoming" | "outgoing" | "parked";
};

/**
 * The two opacities, as data.
 *
 * Idle: the primary is opaque on top and running; the other is transparent,
 * parked at frame 0 and paused — one decoder's worth of work, not two.
 *
 * Dissolving: the incoming layer is opaque and running BENEATH the outgoing
 * one, which thins from 1 to 0 above it. Only the outgoing layer transitions
 * (`fading`), so the two are never both part-way and the room never dims.
 * They exchange stacking once the fade is done, which nothing can see: by
 * then the layer that was on top is fully transparent.
 */
export function crossfadeLayer(state: CrossfadeState, layer: LoopLayerId): CrossfadeLayerView {
  const dissolving = state.incoming !== null;
  const leads = state.primary === layer;

  if (dissolving) {
    return leads
      ? { opacity: 1, zIndex: 1, playing: true, fading: false, role: "incoming" }
      : { opacity: 0, zIndex: 2, playing: true, fading: true, role: "outgoing" };
  }
  return leads
    ? { opacity: 1, zIndex: 2, playing: true, fading: false, role: "primary" }
    : { opacity: 0, zIndex: 1, playing: false, fading: false, role: "parked" };
}

/**
 * Whether this device gets two decoders.
 *
 * Two layers of a 4MB clip is two video decoders and two composited surfaces.
 * A four-core phone spends that on frames it cannot afford, so it keeps one
 * layer and the seam fade (loop-seam) instead. A browser that reports nothing
 * is not assumed to be small — the same rule loop-network applies to
 * connection hints.
 */
export function loopDualLayerAllowed(hardwareConcurrency: number | undefined): boolean {
  if (typeof hardwareConcurrency !== "number" || !Number.isFinite(hardwareConcurrency)) return true;
  return hardwareConcurrency > 4;
}
