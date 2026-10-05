"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";

import {
  APEX_CLIP_MAX_MS,
  APEX_ROOM_HOLD_MS,
  APEX_ROTATION,
  APEX_ROTATION_FADE_MS,
  APEX_STILL_HOLD_MS,
  nextRotationIndex,
  type ApexRotationItem,
} from "@/lib/brand/apex-rotation";
import { LOOP_PLAYBACK_RATE } from "@/lib/cinematic/loop-crossfade";

/* ════════════════════════════════════════════════════════════════════════
   The Apex rotation layer. It sits over the command room's plate and loop,
   under the room's scrim, and is empty while the room itself is showing.

   It runs only while `active` — the room's own playback decision — so the
   ambient pause, reduced motion, Save-Data, a hidden tab and a live session
   all return Apex to its room and stop every download here. At most two
   items are mounted: the one on screen and the one fading out, stacked
   above the room's own two loop layers (z-10); the next is
   fetched only when its turn begins, and every item fades in only once it
   can paint, so a slow network holds the current picture instead of
   flashing the void.
   ════════════════════════════════════════════════════════════════════════ */

type Props = { active: boolean; viewport: "desktop" | "mobile" };

export function ApexRotation({ active, viewport }: Props) {
  /* -1 is the room: nothing of ours on screen. */
  const [index, setIndex] = useState(-1);
  const [leaving, setLeaving] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  const advance = () => {
    setLeaving(index);
    setReady(false);
    setIndex(nextRotationIndex(index));
  };
  const advanceLater = useEffectEvent(() => advance());

  /* Inactive: back to the room, nothing mounted, nothing fetched. */
  const [wasActive, setWasActive] = useState(active);
  if (wasActive !== active) {
    setWasActive(active);
    if (!active) {
      setIndex(-1);
      setLeaving(null);
      setReady(false);
    }
  }

  /* The room and the stills advance on a timer; a clip advances when it has
     played once through (or at its cap), handled by its own element. */
  useEffect(() => {
    if (!active) return;
    const item = index >= 0 ? APEX_ROTATION[index] : null;
    if (item?.kind === "clip") {
      if (!ready) return;
      const cap = setTimeout(advanceLater, APEX_CLIP_MAX_MS);
      return () => clearTimeout(cap);
    }
    if (item && !ready) return;
    const hold = setTimeout(advanceLater, item ? APEX_STILL_HOLD_MS : APEX_ROOM_HOLD_MS);
    return () => clearTimeout(hold);
  }, [active, index, ready]);

  /* The outgoing item unmounts once the fade has finished. */
  useEffect(() => {
    if (leaving === null) return;
    const done = setTimeout(() => setLeaving(null), APEX_ROTATION_FADE_MS + 200);
    return () => clearTimeout(done);
  }, [leaving]);

  if (!active) return null;

  const layers: { i: number; shown: boolean }[] = [];
  if (leaving !== null && leaving >= 0 && leaving !== index) layers.push({ i: leaving, shown: false });
  if (index >= 0) layers.push({ i: index, shown: ready });

  return (
    <div data-apex-rotation={index >= 0 ? APEX_ROTATION[index].id : "room"} className="absolute inset-0 z-10" aria-hidden="true">
      {layers.map(({ i, shown }) => (
        <RotationLayer
          key={APEX_ROTATION[i].id}
          item={APEX_ROTATION[i]}
          viewport={viewport}
          shown={shown}
          current={i === index}
          onReady={() => setReady(true)}
          onDone={advance}
        />
      ))}
    </div>
  );
}

function RotationLayer({
  item,
  viewport,
  shown,
  current,
  onReady,
  onDone,
}: {
  item: ApexRotationItem;
  viewport: "desktop" | "mobile";
  shown: boolean;
  current: boolean;
  onReady: () => void;
  onDone: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  /* Each layer hands off exactly once: timeupdate fires several times inside
     the fade window, and an error can follow a hand-off. */
  const handedOff = useRef(false);
  const handOff = () => {
    if (handedOff.current) return;
    handedOff.current = true;
    onDone();
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = LOOP_PLAYBACK_RATE;
  }, []);

  const fade = { opacity: shown ? 1 : 0, transition: `opacity ${APEX_ROTATION_FADE_MS}ms ease-in-out` };
  const small = viewport === "mobile";

  if (item.kind === "clip") {
    return (
      <div className="absolute inset-0" style={fade} data-rotation-item={item.id}>
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover"
          src={item.src}
          poster={small ? item.posterSmall : item.poster}
          muted
          playsInline
          autoPlay
          preload="auto"
          disablePictureInPicture
          onPlaying={current ? onReady : undefined}
          onLoadedMetadata={(event) => {
            event.currentTarget.playbackRate = LOOP_PLAYBACK_RATE;
          }}
          onTimeUpdate={
            current
              ? (event) => {
                  const v = event.currentTarget;
                  /* Hand off before the last frame, so the clip never wraps
                     and never freezes on screen: the fade covers the end. */
                  const leftMs = ((v.duration - v.currentTime) / (v.playbackRate || 1)) * 1000;
                  if (Number.isFinite(leftMs) && leftMs <= APEX_ROTATION_FADE_MS * 0.6) handOff();
                }
              : undefined
          }
          /* A clip that cannot play is skipped, never left as a black frame. */
          onError={current ? handOff : undefined}
        />
      </div>
    );
  }

  return (
    <div className="absolute inset-0 overflow-hidden" style={fade} data-rotation-item={item.id}>
      {/* eslint-disable-next-line @next/next/no-img-element -- a full-bleed decorative still, sized by CSS; next/image adds nothing here */}
      <img
        className="fba-slow-push absolute inset-0 h-full w-full object-cover"
        src={small ? item.srcSmall : item.src}
        alt=""
        decoding="async"
        ref={(img) => {
          /* A cached still can finish before React listens for load. */
          if (img?.complete && img.naturalWidth > 0 && current) onReady();
        }}
        onLoad={current ? onReady : undefined}
        onError={current ? handOff : undefined}
      />
    </div>
  );
}
