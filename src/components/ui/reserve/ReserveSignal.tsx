"use client";

import { useEffect, useState } from "react";

import type { DashboardView } from "@/lib/athlete-store";
import { useAmbientMotion } from "@/lib/ui/use-ambient-motion";
import { subscribeSignals, type Signal } from "@/lib/ui/signal-bus";

/* ════════════════════════════════════════════════════════════════════════
   SIGNAL RECEIVED — the system acknowledging a member's log.

   One thin bronze light runs along a hairline (the top of the viewport from
   md up, the top edge of the phone tab bar), the room the record landed in
   glows once in the navigation, and a polite live region names what was
   logged. That is the whole response: no toast, no number, no praise.

     full      trace 600ms · room glow 900ms
     reduced   no trace; the room holds a still glow for 900ms (a state, not
               motion — the global reduced-motion block covers any animation)
     static    same as reduced

   Nothing renders until a signal arrives, and signals come only from a
   member's own log in this session (signal-bus.ts).
   ════════════════════════════════════════════════════════════════════════ */

export const SIGNAL_TRACE_MS = 600;
export const SIGNAL_GLOW_MS = 900;
const ANNOUNCE_CLEAR_MS = 2400;

/** The latest signal, held for `holdMs` after it fires, then null. */
export function useSignal(holdMs: number): Signal | null {
  const [signal, setSignal] = useState<Signal | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = subscribeSignals((next) => {
      setSignal(next);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setSignal(null), holdMs);
    });
    return () => {
      unsubscribe();
      if (timer) clearTimeout(timer);
    };
  }, [holdMs]);

  return signal;
}

/**
 * The light trace. `edge` sits absolutely on its positioned parent's top edge
 * (the phone tab bar); `viewport` is fixed to the top of the screen.
 */
export function ReserveSignalTrace({ placement, className = "" }: { placement: "edge" | "viewport"; className?: string }) {
  const signal = useSignal(SIGNAL_TRACE_MS + 50);
  const motion = useAmbientMotion();
  if (!signal || motion !== "full") return null;

  return (
    <span
      aria-hidden="true"
      data-signal="trace"
      /* 4px tall so the hairline's glow is not clipped; the light itself is 1px. */
      className={`pointer-events-none left-0 right-0 top-0 z-[60] h-1 overflow-hidden ${placement === "viewport" ? "fixed" : "absolute"} ${className}`}
    >
      <span key={signal.id} className="fba-signal-trace absolute left-0 top-0 h-px w-[30%]" />
    </span>
  );
}

/** A once-only glow on the navigation item for the room a log landed in. */
export function ReserveSignalGlow({ matches, className = "" }: { matches: (room: DashboardView) => boolean; className?: string }) {
  const signal = useSignal(SIGNAL_GLOW_MS);
  const motion = useAmbientMotion();
  if (!signal || !matches(signal.room)) return null;

  return (
    <span
      key={signal.id}
      aria-hidden="true"
      data-signal="glow"
      className={`pointer-events-none absolute rounded-full ${motion === "full" ? "fba-signal-glow" : "opacity-60"} ${className}`}
      style={{ background: "radial-gradient(circle, rgba(213,177,95,0.42) 0%, rgba(213,177,95,0.12) 45%, transparent 70%)" }}
    />
  );
}

/** One polite live region for the shell: "Water logged". */
export function ReserveSignalAnnouncer() {
  const [message, setMessage] = useState<{ id: number; label: string } | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = subscribeSignals((signal) => {
      /* Deferred one microtask, so a surface that announces the same log
         itself (the recovery log moment) can say so first. */
      queueMicrotask(() => {
        if (signal.announced) return;
        setMessage({ id: signal.id, label: signal.label });
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => setMessage(null), ANNOUNCE_CLEAR_MS);
      });
    });
    return () => {
      unsubscribe();
      if (timer) clearTimeout(timer);
    };
  }, []);

  return (
    <p role="status" aria-live="polite" data-signal="announcer" className="sr-only">
      {message ? <span key={message.id}>{message.label}</span> : null}
    </p>
  );
}
