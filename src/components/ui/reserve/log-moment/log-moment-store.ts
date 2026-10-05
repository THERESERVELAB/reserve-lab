"use client";

import { create } from "zustand";

import { useAthleteDashboardStore, type DashboardView } from "@/lib/athlete-store";
import type { LogMomentContent } from "@/lib/ui/log-moment";
import { markLatestSignalAnnounced } from "@/lib/ui/signal-bus";

import { installLogSoundUnlock } from "./log-sound-engine";

/* ════════════════════════════════════════════════════════════════════════
   LOG MOMENT STORE — a member's log, waiting to land in the room.

   Every logging control that plays a moment goes through `recordLogMoment`:
   the store write runs first and untouched, then the moment is resolved from
   the member's real before/after state. A moment is only ever an
   acknowledgement of a write that already happened.

   A moment is `pending` while a dialog still covers the room (a logger sheet
   that stays open on its own confirmation), and `fired` once the room is
   visible again, so the member sees it land. `arrived` is the beat where the
   light reaches the readout and the figures count.

   One store for the whole shell, so moments never stack: a new log replaces
   whatever the last one was still drawing.

   In memory only. Nothing here is persisted or synced, and a moment is never
   raised by hydration or cloud restore: only by the member's own tap.
   ════════════════════════════════════════════════════════════════════════ */

/** Where the moment finds its row, its control and the readout it lands on (CSS selectors). */
export type LogMomentTargets = {
  /** The logged row: pressed, swept, and the light leaves from it. */
  source?: string;
  /** Inside `source`: the control whose check draws itself (its svg), and where the light starts. */
  control?: string;
  /** Swept instead when the row is not on screen (a hero's gold action). */
  fallbackSource?: string;
  /** The readout the light lands on, when it is on screen. Otherwise it lands on the plate. */
  readout?: string;
  /** A meter that flares when the light lands. */
  meter?: string;
  /** Controls the plate must never cover, beyond the row's own. */
  guard?: string;
};

export type StagedLogMoment = LogMomentContent & {
  id: number;
  /** Identity of the thing logged: an Undo of the same key before the room saw the log cancels both. */
  key: string;
  targets: LogMomentTargets;
  /** The room it was logged in; leaving that room drops the moment. */
  view: DashboardView | null;
  /** Where the member's pointer last pressed, when the row itself has gone (a closed sheet). */
  origin: { x: number; y: number } | null;
  /** The control the member pressed (or focused and activated), when no source row is named. */
  pressed: Element | null;
  /** The tagged row ([data-log-row]) the pressed control sat in when the member logged. */
  pressedRow: Element | null;
  /** Legacy test hooks: "meal" also tags the moment's elements data-meal-moment. */
  legacy: "meal" | null;
};

type LogMomentState = {
  pending: StagedLogMoment | null;
  fired: StagedLogMoment | null;
  arrived: StagedLogMoment | null;
  /** The polite announcement, set the instant the member logs. */
  announcement: StagedLogMoment | null;
  stage: (moment: StagedLogMoment) => void;
  fire: () => void;
  arrive: (id: number) => void;
  settle: (id: number) => void;
  reset: () => void;
};

let sequence = 0;

/** A value safe inside a double-quoted CSS attribute selector. */
export function cssAttr(value: string): string {
  return value.replace(/["\\]/g, (ch) => `\\${ch}`);
}

export const useLogMomentStore = create<LogMomentState>((set, get) => ({
  pending: null,
  fired: null,
  arrived: null,
  announcement: null,
  stage: (moment) => {
    const { pending } = get();
    /* Undo inside a confirmation, before the room ever saw the log: the two
       cancel out, and the room has nothing to show. */
    if (pending && pending.tone === "log" && moment.tone === "clear" && pending.key === moment.key) {
      set({ pending: null, announcement: moment });
      return;
    }
    set({ pending: moment, announcement: moment });
  },
  fire: () => {
    const { pending } = get();
    if (pending) set({ pending: null, fired: pending, arrived: null });
  },
  arrive: (id) => {
    const { fired } = get();
    if (fired?.id === id) set({ arrived: fired });
  },
  settle: (id) => {
    const { fired } = get();
    if (fired?.id === id) set({ fired: null, arrived: null });
  },
  reset: () => set({ pending: null, fired: null, arrived: null, announcement: null }),
}));

/* The last place the member pressed, so a log made in a sheet that has since
   closed still has somewhere for its light to leave from. */
let lastPress: { x: number; y: number; at: number; target: Element | null } | null = null;
let pressListening = false;

function listenForPresses() {
  if (pressListening || typeof window === "undefined") return;
  pressListening = true;
  window.addEventListener(
    "pointerdown",
    (event) => {
      const target = event.target instanceof Element ? event.target.closest('button, [role="button"], a, label') : null;
      lastPress = { x: event.clientX, y: event.clientY, at: Date.now(), target };
    },
    { capture: true, passive: true },
  );
  /* Sound unlocks on every kind of gesture, a phone's release included. */
  installLogSoundUnlock();
}

/** Start remembering presses (the host calls this on mount). */
export function trackLogMomentPresses(): void {
  listenForPresses();
}

function recentPress(): { x: number; y: number } | null {
  if (!lastPress || Date.now() - lastPress.at > 8000) return null;
  return { x: lastPress.x, y: lastPress.y };
}

/** The control that raised this log: the one just pressed, or the focused button a key activated. */
function pressedControl(): Element | null {
  if (typeof document === "undefined") return null;
  const active = document.activeElement;
  const focused = active && active !== document.body && active.matches('button, [role="button"]') ? active : null;
  if (lastPress && Date.now() - lastPress.at < 1500 && lastPress.target?.isConnected) return lastPress.target;
  return focused;
}

export type LogMomentStageInput = LogMomentContent & {
  key: string;
  targets?: LogMomentTargets;
  legacy?: "meal" | null;
};

/** Stage a resolved moment. Most callers use `recordLogMoment`. */
export function stageLogMoment(input: LogMomentStageInput): void {
  /* The moment announces itself (its own polite region), so the shell's
     one-word signal stays quiet instead of saying it twice. */
  if (input.tone === "log") markLatestSignalAnnounced();
  const pressed = pressedControl();
  let view: DashboardView | null = null;
  try {
    view = useAthleteDashboardStore.getState().activeView;
  } catch {
    view = null;
  }
  useLogMomentStore.getState().stage({
    ...input,
    targets: input.targets ?? {},
    legacy: input.legacy ?? null,
    id: ++sequence,
    view,
    origin: recentPress(),
    pressed,
    pressedRow: pressed?.closest("[data-log-row]") ?? null,
  });
}

/**
 * Run a member's log, then stage its moment. The write always happens exactly
 * as before; `resolve` reads the real before/after and returns the moment, or
 * null when this log does not earn one (nothing changed). A resolver that
 * throws never breaks the log that raised it.
 */
export function recordLogMoment<T>(input: {
  read: () => T;
  write: () => void;
  resolve: (before: T, after: T) => LogMomentStageInput | null;
}): void {
  let before: T | undefined;
  try {
    before = input.read();
  } catch {
    before = undefined;
  }
  input.write();
  if (before === undefined) return;
  let moment: LogMomentStageInput | null = null;
  try {
    moment = input.resolve(before, input.read());
  } catch {
    return;
  }
  if (moment) stageLogMoment(moment);
}
