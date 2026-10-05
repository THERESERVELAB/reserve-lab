import type { DashboardView } from "@/lib/athlete-store";

/* ════════════════════════════════════════════════════════════════════════
   SIGNAL BUS — the system acknowledging a member's own log.

   Fired ONLY from the store actions a member's tap runs (logHydration,
   confirmMealLog, logSleep, closeOutTrainingSession …). Hydration, persist
   rehydration and cloud sync write state with setState and never call those
   actions, so they can never raise a signal: the acknowledgement is always of
   something the member did in this session.

   A signal names what was logged and the room it landed in. It carries no
   value, score or interpretation, so the shell cannot say more than "Water
   logged".

   In-memory and synchronous by design: nothing here is persisted or synced.
   ════════════════════════════════════════════════════════════════════════ */

export type SignalKind =
  | "meal"
  | "water"
  | "sleep"
  | "mobility"
  | "check-in"
  | "training"
  | "measurement"
  | "photo"
  | "bloodwork";

export const SIGNAL_SPEC: Record<SignalKind, { label: string; room: DashboardView }> = {
  meal: { label: "Meal logged", room: "nutrition" },
  water: { label: "Water logged", room: "recovery" },
  sleep: { label: "Sleep logged", room: "recovery" },
  mobility: { label: "Mobility logged", room: "recovery" },
  "check-in": { label: "Check-in logged", room: "recovery" },
  training: { label: "Session saved", room: "training" },
  measurement: { label: "Measurements logged", room: "measurements" },
  photo: { label: "Photo check-in saved", room: "progress-photos" },
  bloodwork: { label: "Bloodwork logged", room: "bloodwork" },
};

export type Signal = {
  /** Increments per signal: a key that restarts the trace for a repeat log. */
  id: number;
  kind: SignalKind;
  label: string;
  room: DashboardView;
  /** `performance.now()`-style monotonic milliseconds. */
  at: number;
  /** True when the screen already announces this log itself (the recovery log moment). */
  announced: boolean;
};

type Listener = (signal: Signal) => void;

const listeners = new Set<Listener>();
let sequence = 0;
let latest: Signal | null = null;

const clock = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

/** Raise a signal for a log the member just made. Call from store actions only. */
export function emitSignal(kind: SignalKind): Signal {
  const signal: Signal = { id: ++sequence, kind, ...SIGNAL_SPEC[kind], at: clock(), announced: false };
  latest = signal;
  for (const listener of Array.from(listeners)) {
    try {
      listener(signal);
    } catch {
      /* An acknowledgement must never break the log that raised it. */
    }
  }
  return signal;
}

export function subscribeSignals(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * The screen already announced the latest signal (for example the recovery
 * log moment, which is its own polite live region). Listeners that defer their
 * announcement to a microtask read this and stay quiet.
 */
export function markLatestSignalAnnounced(): void {
  if (latest) latest.announced = true;
}

/** Milliseconds since the last signal, or Infinity when there has been none. */
export function msSinceLastSignal(now: number = clock()): number {
  return latest ? now - latest.at : Number.POSITIVE_INFINITY;
}

/** Test-only reset. */
export function resetSignalBusForTests(): void {
  listeners.clear();
  sequence = 0;
  latest = null;
}
