"use client";

import type { ReactNode, Ref } from "react";

import { useLogMomentStore } from "@/components/ui/reserve/log-moment/log-moment-store";
import { alpha } from "@/lib/design/tokens";
import { resolveAmbientMotion } from "@/lib/ui/ambient-motion";
import type { LogMomentKind } from "@/lib/ui/log-moment";
import { springSamples } from "@/lib/ui/log-moment";
import { useAmbientMotion } from "@/lib/ui/use-ambient-motion";

/* ════════════════════════════════════════════════════════════════════════
   RESERVE DIAL — the watch-face ring Apex's day scores and Nutrition's
   macro dials share: a thin arc on a hairline track inside a faint hour
   ring, and the motion that moves it.

   Motion (Bible §08): a dial holds its old reading while a member's log
   moment is still travelling, then moves on a slow, over-damped spring when
   the light lands. Under reduced or paused motion it simply shows the value.
   ════════════════════════════════════════════════════════════════════════ */

/* Slow and calm: an over-damped spring (no overshoot), ~1.1s to 95%. */
export const DIAL_DRAW_SPRING = { stiffness: 24, damping: 10.5, maxMs: 2400 } as const;
export const DIAL_R = 44;

/** Keyframes for a dial's arc moving from `from` to `to` (fractions), on the draw spring. */
export function dialArcFrames(from: number, to: number): Keyframe[] {
  const samples = springSamples({ from, to, ...DIAL_DRAW_SPRING });
  return samples.map((v, i) => ({ offset: i / (samples.length - 1), strokeDashoffset: String(100 - Math.max(0, Math.min(1, v)) * 100) }));
}

/** How long the draw spring takes between two fractions. */
export const dialSpringMs = (from: number, to: number) => ((springSamples({ from, to, ...DIAL_DRAW_SPRING }).length - 1) / 60) * 1000;

/** The ambient gate read now, straight from the platform — safe inside a mount effect during hydration. */
export function dialMotionNow() {
  let paused = false;
  try {
    const raw = window.localStorage.getItem("fba-ambient-motion");
    paused = Boolean(raw && JSON.parse(raw)?.state?.paused);
  } catch {
    paused = false;
  }
  return resolveAmbientMotion({
    reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    paused,
    hidden: document.visibilityState === "hidden",
  });
}

/**
 * Whether a member's log moment that feeds this dial is still travelling. Under
 * full motion the dial holds its old reading until the light lands, then moves
 * with it; `landed` is the moment's id at that beat, used once per moment.
 */
export function useDialMomentHold(kinds: readonly LogMomentKind[]): { holding: boolean; landed: number | null } {
  const motion = useAmbientMotion();
  const pending = useLogMomentStore((s) => s.pending);
  const fired = useLogMomentStore((s) => s.fired);
  const arrived = useLogMomentStore((s) => s.arrived);
  if (motion !== "full") return { holding: false, landed: null };
  const feeds = (kind: LogMomentKind | undefined) => Boolean(kind && kinds.includes(kind));
  if (pending && feeds(pending.kind) && pending.tone === "log") return { holding: true, landed: null };
  if (fired && feeds(fired.kind)) {
    if (arrived?.id === fired.id) return { holding: false, landed: fired.id };
    return { holding: true, landed: null };
  }
  return { holding: false, landed: null };
}

/**
 * The ring itself. `fraction` null draws the empty, dotted track (no reading
 * yet). Extra marks (a glint) go in as children, drawn above the arc.
 */
export function ReserveDialRing({
  fraction,
  color,
  arcRef,
  children,
}: {
  fraction: number | null;
  color: string;
  arcRef?: Ref<SVGCircleElement>;
  children?: ReactNode;
}) {
  const shown = fraction !== null;
  return (
    <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
      {/* The hour ring: twelve hairlines inside the track. */}
      {Array.from({ length: 12 }, (_, i) => (
        <line key={i} x1="50" y1="9.5" x2="50" y2={i % 3 === 0 ? "12.5" : "11.5"} stroke="white" strokeOpacity={i % 3 === 0 ? 0.16 : 0.08} strokeWidth="0.8" transform={`rotate(${i * 30} 50 50)`} />
      ))}
      <circle cx="50" cy="50" r={DIAL_R} fill="none" stroke="white" strokeOpacity={shown ? 0.07 : 0.22} strokeWidth={shown ? 3.2 : 1.6} strokeLinecap="round" strokeDasharray={shown ? undefined : "0.01 2"} pathLength={shown ? undefined : 100} />
      {shown && (
        <circle
          ref={arcRef}
          data-ring-arc=""
          cx="50"
          cy="50"
          r={DIAL_R}
          fill="none"
          stroke={color}
          strokeWidth="3.2"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray="100 100"
          strokeDashoffset={100 - Math.max(0, Math.min(1, fraction)) * 100}
          transform="rotate(-90 50 50)"
          style={{ filter: `drop-shadow(0 0 3px ${alpha(color, 0.45)})`, transition: "stroke 600ms ease" }}
        />
      )}
      {children}
    </svg>
  );
}
