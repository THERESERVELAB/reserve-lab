"use client";

import { useEffect, useRef, useState } from "react";

import type { AmbientMotion } from "@/lib/ui/ambient-motion";
import {
  LIGHT_FLOW_SURGE_CLEAR_MS,
  passStrokes,
  resolveSurge,
  rgba,
  surgePath,
  type LightFlowPalette,
  type LightFlowPlan,
  type LightPoint,
  type LightSeam,
  type SurgeRail,
} from "@/lib/ui/light-flow";
import { planLogMoment } from "@/lib/ui/log-moment";
import { subscribeSignals } from "@/lib/ui/signal-bus";
import { useLogMomentStore } from "../log-moment/log-moment-store";

/* ════════════════════════════════════════════════════════════════════════
   LIGHT FLOW SURGE — the room answering a log the member just made.

   One log, one answer. The log moment already runs its own light from the
   row to the readout for the daily anchors, and this layer must never run a
   second light across the same beat: when the moment owns the flow, the room
   only brightens its hero seam once, AFTER the moment has landed. For a
   mark-tier log — or a room with no moment at all — this traveller is the
   answer, and it leaves at once.

   Event-scoped and self-terminating, which is the shape the shipped log
   moment's own canvas uses: nothing is mounted until a member logs, and the
   element is taken down when its single pass ends. Both endpoints are
   measured ONCE, at the log; nothing here reads layout again.
   ════════════════════════════════════════════════════════════════════════ */

type Surge = {
  id: number;
  seam: LightSeam | null;
  brighten: boolean;
};

/** The last place the member pressed: where a surge's light leaves from. */
function useLastPress() {
  const press = useRef<LightPoint | null>(null);
  useEffect(() => {
    const onPress = (event: PointerEvent) => {
      press.current = { x: event.clientX, y: event.clientY };
    };
    window.addEventListener("pointerdown", onPress, { capture: true, passive: true });
    return () => window.removeEventListener("pointerdown", onPress, { capture: true });
  }, []);
  return press;
}

/** The readout a surge lands on: a tagged one, or the room's own statement. */
function readoutPoint(): LightPoint | null {
  if (typeof document === "undefined") return null;
  const tagged = [...document.querySelectorAll<HTMLElement>("[data-light-flow-readout]")].find((node) => {
    const rect = node.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && rect.top < window.innerHeight && rect.bottom > 0;
  });
  const node = tagged ?? document.querySelector<HTMLElement>("[data-room-statement]");
  if (!node) return null;
  const rect = node.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

/** The horizontal run of the hero seam — the rail a surge travels. */
function railOf(seam: LightSeam): SurgeRail | null {
  const y = seam.points[seam.points.length - 1].y;
  const along = seam.points.filter((point) => Math.abs(point.y - y) < 1.5);
  if (along.length < 2) return null;
  const xs = along.map((point) => point.x);
  return { y, x0: Math.min(...xs), x1: Math.max(...xs) };
}

export function LightFlowSurge({
  plan,
  motion,
  palette,
  size,
  heroSeam,
  onBoomChange,
}: {
  plan: LightFlowPlan;
  motion: AmbientMotion;
  palette: LightFlowPalette;
  size: { width: number; height: number };
  heroSeam: LightSeam | null;
  onBoomChange: (boom: boolean) => void;
}) {
  const press = useLastPress();
  const [surge, setSurge] = useState<Surge | null>(null);
  /* Timers that have not fired yet, and the one that takes the answer down.
     They are kept apart because the room going dark must cancel a pending
     answer WITHOUT cancelling the take-down of one already on screen. */
  const pending = useRef<number[]>([]);
  const teardown = useRef<number | null>(null);
  const sequence = useRef(0);

  /* The room goes quiet while a full log moment plays its own light. */
  const fired = useLogMomentStore((state) => state.fired);
  useEffect(() => {
    onBoomChange(Boolean(fired) && planLogMoment(fired!, motion).boom);
  }, [fired, motion, onBoomChange]);

  /* Read through a ref so the subscription is made once and never re-made:
     a re-subscribe on every plan change could drop the signal of a log made
     in the same tick. The ref is written in an effect and read a microtask
     after a signal, by which time the effect has run. */
  const latest = useRef({ plan, motion, heroSeam });
  useEffect(() => {
    latest.current = { plan, motion, heroSeam };
  }, [plan, motion, heroSeam]);

  useEffect(() => {
    const clearPending = () => {
      for (const timer of pending.current) window.clearTimeout(timer);
      pending.current = [];
    };

    const unsubscribe = subscribeSignals(() => {
      /* The signal is raised INSIDE the store action; the moment it belongs
         to is staged immediately after it. A microtask puts this after both,
         so the decision is made against the moment that actually exists. */
      queueMicrotask(() => {
        const { plan: current, motion: currentMotion, heroSeam: seam } = latest.current;
        const moment = useLogMomentStore.getState().pending ?? useLogMomentStore.getState().fired;
        const momentPlan = moment ? planLogMoment(moment, currentMotion) : null;
        const decision = resolveSurge({
          plan: current,
          momentFlow: Boolean(momentPlan?.flow),
          momentArrivalMs: momentPlan?.arrivalMs,
        });
        if (!decision.traveller && !decision.heroBrighten) return;

        /* A second log replaces the first outright: moments never stack, and
           neither does the room's answer to them. */
        clearPending();
        pending.current.push(
          window.setTimeout(() => {
            const id = (sequence.current += 1);
            /* The rail the room's hero already sits on: the surge climbs
               into it rather than cutting across the panels. */
            const rail = seam ? railOf(seam) : null;
            const path = decision.traveller ? surgePath(press.current, readoutPoint(), rail) : null;
            /* Nothing to draw at all — no path and no hero seam on screen. */
            if (!path && !(decision.heroBrighten && seam)) return;
            setSurge({ id, seam: path, brighten: decision.heroBrighten && Boolean(seam) });
            if (teardown.current !== null) window.clearTimeout(teardown.current);
            teardown.current = window.setTimeout(
              () => setSurge((live) => (live?.id === id ? null : live)),
              LIGHT_FLOW_SURGE_CLEAR_MS,
            );
          }, decision.delayMs),
        );
      });
    });

    return () => {
      unsubscribe();
      clearPending();
      if (teardown.current !== null) window.clearTimeout(teardown.current);
    };
  }, [press]);

  /* The layer went dark under it (a session started, the tab was hidden, the
     member paused). An answer that has not left yet never will; one already on
     screen is hidden by the guard below and taken down by its own timer. */
  useEffect(() => {
    if (plan.active) return;
    for (const timer of pending.current) window.clearTimeout(timer);
    pending.current = [];
  }, [plan.active]);

  if (!surge || !plan.active || size.width === 0) return null;

  const strokes = surge.seam ? passStrokes(surge.seam.length) : [];
  return (
    <svg
      key={surge.id}
      data-light-flow="surge"
      className="absolute inset-0"
      width={size.width}
      height={size.height}
      viewBox={`0 0 ${size.width} ${size.height}`}
      fill="none"
      focusable="false"
      aria-hidden="true"
    >
      {surge.brighten && heroSeam && (
        /* The hero seam lights along its whole length for one beat: a bloom
           carrying the light off the hairline, and the hairline itself. */
        <g className="fba-lf-brighten" data-light-flow-part="brighten">
          <path d={heroSeam.d} fill="none" stroke={rgba(palette.warm, 0.1 * plan.alpha)} strokeWidth="7" strokeLinecap="round" />
          <path d={heroSeam.d} fill="none" stroke={rgba(palette.warm, 0.55 * plan.alpha)} strokeWidth="1.5" strokeLinecap="round" />
        </g>
      )}
      {surge.seam &&
        strokes.map((stroke, i) => (
          <path
            key={`${stroke.role}-${i}`}
            className="fba-lf-surge"
            data-light-flow-part="traveller"
            data-light-flow-stroke={stroke.role}
            d={surge.seam!.d}
            fill="none"
            stroke={rgba(stroke.role === "core" ? palette.core : palette.warm, stroke.alpha * Math.min(1, plan.alpha + 0.2))}
            strokeWidth={stroke.width}
            strokeLinecap="round"
            strokeDasharray={`${stroke.dash} ${surge.seam!.length + stroke.dash}`}
            style={
              {
                "--lf-from": `${stroke.from}px`,
                "--lf-to": `${stroke.to}px`,
              } as React.CSSProperties
            }
          />
        ))}
    </svg>
  );
}
