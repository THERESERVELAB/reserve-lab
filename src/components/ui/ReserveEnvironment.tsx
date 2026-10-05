"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";

import {
  productionLoop,
  productionPlate,
  type Daypart,
  type ProductionLoop,
  type ProductionPlate,
  type VisualAsset,
  visualAsset,
} from "@/lib/brand/asset-manifest";
import { plateSizes, servedAspectRatio } from "@/lib/brand/plate-sizes";
import {
  LOOP_ELEMENT_IDLE,
  LOOP_FADE_MS,
  RESERVE_MOTION,
  isLoopFailure,
  resolveLoopLayer,
  type LoopElementState,
  type CinematicEnvironmentConfig,
  type PlaybackDecision,
} from "@/lib/cinematic/environments";
import {
  CROSSFADE_IDLE,
  LOOP_CROSSFADE_EASING,
  LOOP_CROSSFADE_LEAD_MS,
  LOOP_CROSSFADE_MS,
  LOOP_LAYER_IDS,
  crossfadeLayer,
  loopDualLayerAllowed,
  loopPlaybackRate,
  otherLoopLayer,
  settleCrossfade,
  shouldStartCrossfade,
  startCrossfade,
  type CrossfadeState,
  type LoopLayerId,
} from "@/lib/cinematic/loop-crossfade";
import { LOOP_IDLE_TIMEOUT_MS, phoneLoopDataAllowed, type LoopConnection } from "@/lib/cinematic/loop-network";
import { LOOP_SEAM_MS, isLoopRestart, loopSeamDelayMs } from "@/lib/cinematic/loop-seam";
import { resolveEnvironmentOverlays } from "@/lib/cinematic/overlays";
import { ROOM_CROSSFADE_MS } from "@/lib/cinematic/room-light";

/* ════════════════════════════════════════════════════════════════════════
   RESERVE ENVIRONMENT — the one plate renderer.

   Before this component, environment imagery was painted with CSS
   `background-image` in three separate places, each with its own scrim and
   its own idea of the focal point. `next/image` was used nowhere in the
   product, so no plate was ever responsive, prioritised, or sized.

   The contract:

     - The plate is an ENVIRONMENT, never interface. No UI is baked in.
     - The focal point is read from the asset manifest, never guessed, and
       differs between desktop and mobile.
     - A DRAFT or REVIEW asset renders NOTHING. `productionPlate` is the gate.
     - The scrim is the plate's own responsibility. A screen must never have
       to hand-roll contrast protection for its own background.
     - Reduced motion and low power resolve to a still. The plate never
       animates on its own; the shell decides whether anything moves.
     - Motion is a layer ON the still, never a replacement for it. The plate
       stays the poster and the LCP element. An approved loop
       (`productionLoop`: same id, same viewport) mounts over it only on the
       client, and only when the caller's playback decision plays. Without
       both there is no <video> element and no request.
     - A loop never ends. It runs slowed, and it is carried over its own last
       frame by a second layer of the same clip dissolving in over the first
       (`lib/cinematic/loop-crossfade`), so there is no wrap to see. A device
       that cannot afford two decoders keeps one layer and the seam fade.
     - A plate that changes (a new daypart, a new viewport source) is never a
       hard swap. The new plate waits for its pixels, then cross-fades in over
       the old one, which unmounts once covered (Bible §09: felt, over ≥1s).
     - A loop belongs to the day plate it was cut from. A night or dawn plate
       is always a still.

   ════════════════════════════════════════════════════════════════════════ */

/**
 * Viewport for art direction. Falls back to a media query when the caller has
 * no opinion — so a surface can drop in the renderer without also wiring up
 * viewport plumbing. `null` on the server and until the first client read:
 * guessing `desktop` made a phone download the 16:9 plate and then its 9:16
 * one, so no plate is requested until this is known.
 */
function useViewport(): "desktop" | "mobile" | null {
  const [viewport, setViewport] = useState<"desktop" | "mobile" | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const sync = () => setViewport(mq.matches ? "mobile" : "desktop");
    sync();
    mq.addEventListener("change", sync);
    /* matchMedia does not fire for every viewport change (programmatic metric
       overrides and some mobile chrome resizes are silent). */
    window.addEventListener("resize", sync);
    return () => {
      mq.removeEventListener("change", sync);
      window.removeEventListener("resize", sync);
    };
  }, []);

  return viewport;
}

/* Client-only signal: false on the server and through hydration, true from
   the first client render after it. No effect, no extra state. */
const subscribeToNothing = () => () => {};

function useMounted(): boolean {
  return useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );
}

export type ReserveEnvironmentProps = {
  /** Asset id from the manifest. Unknown or unapproved ids render nothing. */
  assetId: string;
  /** Omit to let the renderer resolve it from the viewport itself. */
  viewport?: "desktop" | "mobile";
  /** 0–1. The shell quiets this during live sessions and active tasks, and scales it with room light. */
  opacity: number;
  /**
   * Above-the-fold environments set this so the plate is not lazy-loaded
   * into the LCP. Exactly one plate is visible at a time, so this is safe
   * to set on the shell's environment.
   */
  priority?: boolean;
  /**
   * The surface's playback decision (`resolvePlayback`). Omit it and the
   * environment is a still, whatever the manifest holds.
   *
   * Resolve it from MEASURED client conditions — viewport, reduced motion,
   * save-data, visibility — never from server-render defaults, or a phone or
   * a reduced-motion viewer could start a download before the truth is known.
   */
  playback?: PlaybackDecision;
  /**
   * Time of day. An approved daypart variant in the manifest replaces the day
   * plate; without one the day plate serves. Resolve it on the client — the
   * server does not know the member's clock.
   */
  daypart?: Daypart;
  /**
   * Motion laid over this room's plate and loop, under its scrim, inside the
   * same opacity and focal layer (the Apex rotation). Rendered only while the
   * plate is.
   */
  motionOverlay?: ReactNode;
  /**
   * A surface that renders through its own cinematic config passes it here.
   * The renderer then paints that config's `overlays` at its
   * `contentContrastMode` (`resolveEnvironmentOverlays`) in place of the
   * manifest's scrim, for the same viewport as the plate. If none of the
   * declared overlays has a recipe, the manifest scrim stays.
   */
  environment?: Pick<CinematicEnvironmentConfig, "overlays" | "contentContrastMode">;
};

/** Scrim per overlay mode. Interface contrast is the plate's job, not the screen's. */
const SCRIM: Record<VisualAsset["overlay"], string> = {
  /* Content sits over the lower half — protect it hardest there. */
  "vertical-scrim":
    "linear-gradient(180deg, rgba(7,8,12,0.42) 0%, rgba(7,8,12,0.16) 34%, rgba(7,8,12,0.38) 72%, rgba(7,8,12,0.74) 100%)",
  /* Recovery: low contrast everywhere, nothing sharp. */
  "soft-scrim-full":
    "linear-gradient(180deg, rgba(7,8,12,0.5) 0%, rgba(7,8,12,0.32) 50%, rgba(7,8,12,0.7) 100%)",
  /* Entrance: keep the centre readable, darken only the edges. */
  "vignette-only":
    "radial-gradient(ellipse at center, rgba(7,8,12,0.28) 30%, rgba(7,8,12,0.82) 100%)",
};

/* ─── Loop ────────────────────────────────────────────────────────────────
   The <video> half of the renderer. Every decision about the element comes
   from `resolveLoopLayer`; this component only carries it out and reports
   back what the element actually did. */
/* The Network Information API, read on the client only. The server snapshot
   is "not allowed", so nothing is ever requested before the truth is known. */
type NavigatorConnection = LoopConnection & EventTarget;
const readConnection = () => (navigator as Navigator & { connection?: NavigatorConnection }).connection;
const subscribeConnection = (onChange: () => void) => {
  const connection = readConnection();
  connection?.addEventListener?.("change", onChange);
  return () => connection?.removeEventListener?.("change", onChange);
};

function usePhoneLoopDataAllowed(): boolean {
  return useSyncExternalStore(
    subscribeConnection,
    () => phoneLoopDataAllowed(readConnection()),
    () => false,
  );
}

/**
 * Two decoders are the cost of an invisible wrap, so this is measured rather
 * than assumed: a four-core device keeps one layer and the seam fade.
 */
function useDualLayerAllowed(): boolean {
  return useSyncExternalStore(
    subscribeToNothing,
    () => loopDualLayerAllowed(navigator.hardwareConcurrency),
    () => false,
  );
}

function EnvironmentLoop({
  loop,
  decision,
  viewport,
}: {
  loop: ProductionLoop;
  decision: PlaybackDecision;
  viewport: "desktop" | "mobile";
}) {
  const mounted = useMounted();
  const layerA = useRef<HTMLVideoElement>(null);
  const layerB = useRef<HTMLVideoElement>(null);
  const layerRef = (id: LoopLayerId) => (id === "a" ? layerA : layerB);
  const [element, setElement] = useState<LoopElementState>(LOOP_ELEMENT_IDLE);

  /* ── Phones: data first, the plate first ─────────────────────────────
     A phone mounts no <video> (so requests nothing) under Save-Data or a
     connection slower than 4G, and otherwise only once its 9:16 plate has
     decoded and the page is idle, so the plate stays the LCP element. Until
     then the decision is withheld, which resolves to a still. */
  const phone = viewport === "mobile";
  const dataAllowed = usePhoneLoopDataAllowed();
  const probeRef = useRef<HTMLSpanElement>(null);
  const [armed, setArmed] = useState(false);
  const wantsPhoneLoop = phone && mounted && dataAllowed && decision.playVideo && !armed;

  useEffect(() => {
    const probe = probeRef.current;
    if (!wantsPhoneLoop || !probe) return;
    let cancelled = false;
    let idleHandle: number | null = null;
    let timerHandle: number | null = null;
    const arm = () => {
      if (!cancelled) setArmed(true);
    };
    const whenIdle = () => {
      if (cancelled) return;
      if (typeof window.requestIdleCallback === "function") {
        idleHandle = window.requestIdleCallback(arm, { timeout: LOOP_IDLE_TIMEOUT_MS });
      } else {
        timerHandle = window.setTimeout(arm, LOOP_IDLE_TIMEOUT_MS / 2);
      }
    };
    /* The plate is the next/image <img> in the same layer as this loop. */
    const img = probe.parentElement?.querySelector("img");
    if (!img || img.complete) {
      (img?.decode?.() ?? Promise.resolve()).catch(() => undefined).then(whenIdle);
    } else {
      img.addEventListener("load", whenIdle, { once: true });
      img.addEventListener("error", whenIdle, { once: true });
    }
    return () => {
      cancelled = true;
      img?.removeEventListener("load", whenIdle);
      img?.removeEventListener("error", whenIdle);
      if (idleHandle !== null) window.cancelIdleCallback?.(idleHandle);
      if (timerHandle !== null) window.clearTimeout(timerHandle);
    };
  }, [wantsPhoneLoop]);

  const phoneReady = !phone || (dataAllowed && armed);
  const { render, play, opacity } = resolveLoopLayer({
    mounted,
    decision: phoneReady ? decision : undefined,
    loop,
    element,
  });

  /* ── The wrap ─────────────────────────────────────────────────────────
     The room's rate is the manifest's or the shared slowed one; the second
     layer exists only on a device that can afford it, only once the first
     has actually played, and never for a loop that is not running. A second
     layer that fails takes the room back to one layer and the seam, not to a
     still: the room is still the room. */
  const rate = loopPlaybackRate(loop.playbackRate);
  const dualAllowed = useDualLayerAllowed();
  const [secondFailed, setSecondFailed] = useState(false);
  const [secondReady, setSecondReady] = useState(false);
  const [phase, setPhase] = useState<CrossfadeState>(CROSSFADE_IDLE);
  const dual = dualAllowed && !secondFailed;
  const secondMounted = render && play && dual && element.played;
  /* Roles are only real while two layers are actually on screen and running.
     A still room, or one that has released its second layer, is layer A alone
     — derived here rather than written back, so no state has to be unwound
     when the room quiets. */
  const stage = play && secondMounted ? phase : CROSSFADE_IDLE;

  /* Both layers run slowed, and a browser that resets the rate on load (or on
     a new source) is corrected the moment it does. */
  useEffect(() => {
    for (const id of LOOP_LAYER_IDS) {
      const video = layerRef(id).current;
      if (!video) continue;
      video.defaultPlaybackRate = rate;
      video.playbackRate = rate;
    }
  });

  /* `autoPlay` starts the first run. This carries every later turn of the
     decision: a pause the moment it becomes a still (tab hidden, a live
     session, reduced motion), and play again when that lifts — and, while
     playing, it holds each layer in the role the crossfade gave it. */
  useEffect(() => {
    if (!render) return;
    const videos = LOOP_LAYER_IDS.map((id) => ({ id, video: layerRef(id).current })).filter(
      (entry): entry is { id: LoopLayerId; video: HTMLVideoElement } => entry.video !== null,
    );
    if (!play) {
      for (const { video } of videos) video.pause();
      return;
    }
    for (const { id, video } of videos) {
      const view = crossfadeLayer(stage, id);
      if (view.playing) {
        video.play().catch(() => {
          /* Refused (an autoplay policy, a power-saving mode) or interrupted by a
             pause. Neither is worth surfacing: the poster simply stays. */
        });
        continue;
      }
      /* Parked: paused on frame 0 — which is the plate — ready for its turn. */
      if (!video.paused) video.pause();
      if (video.currentTime !== 0) video.currentTime = 0;
    }
  }, [render, play, stage]);

  /* The handover. Watched on the layer that is on screen, per rendered frame
     where the browser offers that (`requestVideoFrameCallback`) and on
     `timeupdate` everywhere, so the wrap cannot be missed. Never while a
     dissolve is already running, and never before the incoming layer has
     enough of the clip to show frame 0. */
  useEffect(() => {
    if (!secondMounted || !secondReady || !play || stage.incoming !== null) return;
    const leading = layerRef(stage.primary).current;
    const incoming = layerRef(otherLoopLayer(stage.primary)).current;
    if (!leading || !incoming) return;

    const frames = leading as unknown as {
      requestVideoFrameCallback?: (callback: () => void) => number;
      cancelVideoFrameCallback?: (handle: number) => void;
    };
    let cancelled = false;
    let frameHandle: number | null = null;

    const check = () => {
      if (cancelled) return;
      const timing = { fadeMs: LOOP_CROSSFADE_MS, leadMs: LOOP_CROSSFADE_LEAD_MS, playbackRate: rate };
      if (!leading.paused && shouldStartCrossfade(leading.duration, leading.currentTime, timing)) {
        cancelled = true;
        incoming.currentTime = 0;
        incoming.playbackRate = rate;
        incoming.play().catch(() => undefined);
        setPhase(startCrossfade);
        return;
      }
      watch();
    };
    const watch = () => {
      if (cancelled || typeof frames.requestVideoFrameCallback !== "function") return;
      frameHandle = frames.requestVideoFrameCallback(check);
    };

    leading.addEventListener("timeupdate", check);
    watch();
    return () => {
      cancelled = true;
      leading.removeEventListener("timeupdate", check);
      if (frameHandle !== null) frames.cancelVideoFrameCallback?.(frameHandle);
    };
  }, [secondMounted, secondReady, play, stage, rate]);

  /* The dissolve is over when the browser says the fade finished, not when a
     timer guesses it did — a transition that starts a frame late must still be
     allowed to finish, or the layer it was thinning would be cut away. The
     timer is only the backstop for a browser that never reports the end. */
  useEffect(() => {
    if (stage.incoming === null) return;
    const outgoing = layerRef(otherLoopLayer(stage.primary)).current;
    const settle = () => setPhase(settleCrossfade);
    outgoing?.addEventListener("transitionend", settle);
    const handle = window.setTimeout(settle, LOOP_CROSSFADE_MS * 2);
    return () => {
      outgoing?.removeEventListener("transitionend", settle);
      window.clearTimeout(handle);
    };
  }, [stage]);

  /* Detaching a <video> does not stop its download; clearing its source does.
     Only a genuinely detached element is cleared — Strict Mode's rehearsal
     unmount leaves the node in the document, and must not strip its source. */
  useEffect(() => {
    const video = layerA.current;
    if (!render || !video) return;
    return () => {
      if (video.isConnected) return;
      video.removeAttribute("src");
      video.load();
    };
  }, [render]);

  /* The second layer is released the moment the loop stops, so a still room
     holds one decoder at most and a closed room holds none. */
  useEffect(() => {
    const video = layerB.current;
    if (!secondMounted || !video) return;
    return () => {
      setSecondReady(false);
      if (video.isConnected) return;
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, [secondMounted]);

  /* The seam (lib/cinematic/loop-seam): the single-layer fallback's wrap —
     fade to the plate just before it, fade back in on frame 0. A single timer
     per cycle, only while playing; a still or paused loop clears it and never
     schedules one. Two layers make it unnecessary, so it is never armed. */
  const seamTimer = useRef<number | null>(null);
  const lastTime = useRef(0);
  const [seamOpen, setSeamOpen] = useState(false);
  const clearSeam = () => {
    if (seamTimer.current === null) return;
    window.clearTimeout(seamTimer.current);
    seamTimer.current = null;
  };
  const scheduleSeam = (video: HTMLVideoElement) => {
    clearSeam();
    if (dual || !play || video.paused) return;
    const delay = loopSeamDelayMs(video.duration, video.currentTime, video.playbackRate);
    if (delay === null) return;
    seamTimer.current = window.setTimeout(() => {
      seamTimer.current = null;
      setSeamOpen(true);
    }, delay);
  };
  const restarted = (video: HTMLVideoElement) => {
    setSeamOpen(false);
    scheduleSeam(video);
  };
  useEffect(() => {
    const stop = () => {
      if (seamTimer.current === null) return;
      window.clearTimeout(seamTimer.current);
      seamTimer.current = null;
    };
    if (!play || dual) stop();
    return stop;
  }, [play, dual]);
  const seamHidden = play && seamOpen && !dual;

  if (!render) return wantsPhoneLoop ? <span ref={probeRef} hidden /> : null;

  const fail = () => {
    layerA.current?.pause();
    setElement((current) => ({ ...current, playing: false, failed: true }));
  };
  /* A layer pausing is only the loop pausing when no layer is left running:
     every handover pauses the layer it just left. */
  const anyPlaying = () => LOOP_LAYER_IDS.some((id) => layerRef(id).current?.paused === false);

  const layers: LoopLayerId[] = secondMounted ? [...LOOP_LAYER_IDS] : ["a"];

  return (
    /* The seam layer: its own short fade, independent of the loop's ≥1s
       reveal on the stack, so the two never fight over one opacity. */
    <div
      data-loop-seam={seamHidden ? "open" : "closed"}
      className="absolute inset-0"
      style={{ opacity: seamHidden ? 0 : 1, transition: `opacity ${LOOP_SEAM_MS}ms ease-in-out` }}
    >
      {/* The stack: the loop's own reveal over its plate, and its quieting
          during a task. The layers inside dissolve within it, so a handover
          never touches this opacity and this opacity never interrupts one. */}
      <div
        data-loop-stack={dual ? "crossfade" : "seam"}
        className="absolute inset-0"
        style={{ opacity, transition: `opacity ${LOOP_FADE_MS}ms ${RESERVE_MOTION.easing.cinematic}` }}
      >
        {layers.map((id) => {
          const view = crossfadeLayer(stage, id);
          const lead = id === "a";
          return (
            <video
              key={id}
              ref={layerRef(id)}
              data-environment-loop={loop.src}
              data-loop-layer={id}
              data-loop-role={dual ? view.role : "single"}
              src={loop.src}
              muted
              loop
              playsInline
              /* Desktop: mounted only to play, so buffer the loop rather than its
                 metadata. Phone: nothing is fetched ahead of the play() call above,
                 which a low-power mode may refuse, leaving the still. The second
                 layer is the same URL the first already holds, so it is served
                 from cache and asks the network for nothing. */
              autoPlay={lead && !phone}
              preload={lead && phone ? "none" : "auto"}
              controls={false}
              disablePictureInPicture
              disableRemotePlayback
              aria-hidden="true"
              tabIndex={-1}
              /* `.fba-plate` is shared on purpose: object-fit cover and the SAME
                 `--fba-focal` object-position as the still, so the loop can never be
                 anchored anywhere the plate is not. */
              className="fba-plate absolute inset-0 h-full w-full"
              /* A style prop is safe here, unlike on the <Image>: this element never
                 exists in server HTML, so there is no server render to disagree with.
                 With one layer the stack above owns the reveal and this stays opaque;
                 with two, this is the dissolve itself. */
              style={{
                opacity: dual ? view.opacity : 1,
                zIndex: view.zIndex,
                /* Only the layer being thinned away transitions. The one
                   arriving underneath it is opaque at once, so the two are
                   never both part-way and the room never dips. */
                transition: dual && view.fading ? `opacity ${LOOP_CROSSFADE_MS}ms ${LOOP_CROSSFADE_EASING}` : undefined,
              }}
              onLoadedMetadata={(event) => {
                event.currentTarget.defaultPlaybackRate = rate;
                event.currentTarget.playbackRate = rate;
              }}
              onCanPlay={lead ? undefined : () => setSecondReady(true)}
              onPlaying={(event) => {
                setElement((current) => ({ ...current, played: true, playing: true }));
                if (lead) scheduleSeam(event.currentTarget);
              }}
              onPause={() => {
                if (lead) clearSeam();
                if (anyPlaying()) return;
                setElement((current) => ({ ...current, playing: false }));
              }}
              /* A wrap under `loop` seeks back to the start; timeupdate is the backstop
                 for a browser that wraps without a seek event. Only the single-layer
                 fallback cares: with two layers the wrap is the handover. */
              onSeeked={(event) => {
                const video = event.currentTarget;
                if (!lead || dual) return;
                lastTime.current = video.currentTime;
                restarted(video);
              }}
              onTimeUpdate={(event) => {
                const video = event.currentTarget;
                if (!lead || dual) return;
                if (isLoopRestart(lastTime.current, video.currentTime)) restarted(video);
                lastTime.current = video.currentTime;
              }}
              onError={lead ? fail : () => setSecondFailed(true)}
              onStalled={(event) => {
                if (!isLoopFailure("stalled", event.currentTarget.readyState)) return;
                if (lead) fail();
                else setSecondFailed(true);
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

/* ─── Plate layer ─────────────────────────────────────────────────────────
   One still. An entering layer stays transparent until its image has
   decoded, then fades in; the renderer drops the layer beneath once the fade
   ends. The layer's wrapper carries the focal point and the animation, so
   next/image's own inline style is never touched. */
function PlateLayer({
  plate,
  sizes,
  priority = false,
  entering = false,
  onEntered,
  children,
}: {
  plate: ProductionPlate;
  /** From the served source's aspect ratio (`plateSizes`). */
  sizes: string;
  priority?: boolean;
  entering?: boolean;
  onEntered?: () => void;
  children?: ReactNode;
}) {
  const [loaded, setLoaded] = useState(!entering);
  const phase = !entering ? "" : loaded ? "fba-plate-in" : "opacity-0";

  return (
    <div
      className={`absolute inset-0 ${phase}`}
      style={{ ["--fba-focal" as string]: plate.focalPoint }}
      onAnimationEnd={
        entering
          ? (event) => {
              if (event.target === event.currentTarget) onEntered?.();
            }
          : undefined
      }
    >
      <Image
        src={plate.src}
        alt=""
        fill
        /* The plate is one full-bleed cover crop; it never shares the
           viewport. A 16:9 source paints about 178vh wide on a phone, a 9:16
           source about 56vh (its screen width), so `sizes` follows the source
           actually served. A fixed 178vh sent a phone's 9:16 plate to the
           3840px variant. */
        sizes={sizes}
        priority={priority}
        /* Not `loading="lazy"` when priority — next/image handles the pair.
           Styling is entirely by class; NO style prop may be added here. */
        className="fba-plate"
        /* Decorative. Screen readers must never announce the room. */
        aria-hidden="true"
        onLoad={entering ? () => setLoaded(true) : undefined}
      />
      {children}
    </div>
  );
}

type PlateFade = { shown: ProductionPlate | null; leaving: ProductionPlate | null };

export function ReserveEnvironment({
  assetId,
  viewport,
  opacity,
  priority = false,
  playback,
  daypart = "day",
  environment,
  motionOverlay,
}: ReserveEnvironmentProps) {
  const detected = useViewport();
  /* No plate is requested until the viewport is known (the caller's, or the
     one measured here). The plate is an absolute, decorative layer, so
     arriving a moment after first paint shifts nothing. */
  const resolvedViewport = viewport ?? detected;
  /* Owner direction 2026-09-24: the room is ALWAYS the member's real hour, and
     it moves whenever that hour has a clip of its own. This replaces the
     2026-09-18 rule, which pinned any room with a day loop to its day plate
     around the clock — that bought motion by showing a lit room at midnight,
     and left every approved night plate in the manifest unrenderable. An hour
     with no clip is now a still of the right room instead. */
  const plate = resolvedViewport ? productionPlate(assetId, resolvedViewport, daypart) : null;
  const sizesFor = (served: ProductionPlate) => plateSizes(servedAspectRatio(visualAsset(assetId), served.src));
  const cinematicScrim = environment && resolvedViewport ? resolveEnvironmentOverlays(environment, resolvedViewport).layers : [];
  /* Same id, same viewport, same manifest AND the same daypart as the plate —
     so the loop can only ever be the motion of the still underneath it.
     `productionPlate` may fall back to day when a variant is unapproved, so
     the loop is asked for the daypart the plate actually served, never the
     one the clock requested. */
  const loop =
    plate && resolvedViewport ? productionLoop(assetId, resolvedViewport, plate.daypart) : null;

  /* When the plate's source changes, the old one is kept beneath until the
     new one has faded in. Adjusted during render, not in an effect, so the
     outgoing plate never leaves the screen for a frame. */
  const [fade, setFade] = useState<PlateFade>({ shown: plate, leaving: null });
  if ((plate?.src ?? null) !== (fade.shown?.src ?? null)) {
    setFade({ shown: plate, leaving: plate && fade.shown ? fade.shown : null });
  }
  const leaving = fade.leaving && plate && fade.leaving.src !== plate.src ? fade.leaving : null;
  const settle = () => setFade((current) => ({ shown: current.shown, leaving: null }));

  /* Unapproved, retired, or unknown → no environment. The screen still
     works; it simply sits on the void. That is the correct failure mode for
     a decorative layer. */
  if (!plate || opacity <= 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div
        className="absolute inset-0 transition-opacity"
        /* Quieting and room light change over the room's cross-fade, never as a jump. */
        style={{ opacity, transitionDuration: `${ROOM_CROSSFADE_MS}ms` }}
      >
        {leaving && <PlateLayer key={leaving.src} plate={leaving} sizes={sizesFor(leaving)} />}
        {/* A self-measured plate always arrives after first paint, so it
            fades in once decoded rather than popping onto the void. */}
        <PlateLayer
          key={plate.src}
          plate={plate}
          sizes={sizesFor(plate)}
          priority={priority}
          entering={leaving !== null || viewport === undefined}
          onEntered={settle}
        >
          {/* The loop sits above the plate and below the scrim, inside the layer
              that carries the focal point. Keyed by source, so a different loop
              never inherits another's played or failed state. */}
          {loop && playback && resolvedViewport && (
            <EnvironmentLoop key={loop.src} loop={loop} decision={playback} viewport={resolvedViewport} />
          )}
          {motionOverlay}
        </PlateLayer>
      </div>
      {cinematicScrim.length > 0 ? (
        cinematicScrim.map((layer) => (
          <div key={layer.name} className="absolute inset-0" style={{ background: layer.background }} />
        ))
      ) : (
        <div className="absolute inset-0" style={{ background: SCRIM[plate.overlay] }} />
      )}
    </div>
  );
}
