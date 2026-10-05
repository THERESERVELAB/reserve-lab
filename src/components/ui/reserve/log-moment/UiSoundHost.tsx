"use client";

import { useEffect } from "react";

import { useAthleteDashboardStore } from "@/lib/athlete-store";
import { soundRoomOf, uiSoundCue, type UiSoundKind } from "@/lib/ui/log-sound";
import { useLogSoundStore } from "@/lib/ui/log-sound-store";

import { useLogMomentStore } from "./log-moment-store";
import { playLogSound, setLogSoundThroughSilent } from "./log-sound-engine";

/* ════════════════════════════════════════════════════════════════════════
   UI SOUND — the interface's own voice, in one place.

   One delegated listener for the whole shell, so no control has to opt in
   and none can be missed. A click is classified after React has handled it
   (and the DOM has settled one tick), by what it actually did:

     it logged something     silent here: the log moment plays its own sound
     it changed the room     the new room's chord, rolled on a piano
     it opened a dialog      the lift; closing one: the settle
     it was a switch         two notes, rising on, falling off
     it was a tab            the select tick
     any other control       the tap: a softer water tick on the room's note

   Every room has its own key (log-sound ROOM_CHORDS), so moving through the
   house never repeats the same sound twice.

   Never for a disabled control or a text field. Rate-limited so a fast run
   of taps stays a texture, never a clatter. The Settings switch turns it off
   with the log sounds; a hidden tab is always silent.
   ════════════════════════════════════════════════════════════════════════ */

const CONTROL = 'button, a[href], [role="button"], [role="tab"], [role="switch"], [role="menuitem"], [role="option"], [role="radio"], label, summary';
const MIN_GAP_MS = 45;

const modalCount = () => document.querySelectorAll('[aria-modal="true"]').length;

function kindOf(control: Element): UiSoundKind {
  const role = control.getAttribute("role");
  const input = control instanceof HTMLLabelElement ? control.querySelector<HTMLInputElement>('input[type="checkbox"]') : null;
  if (role === "switch" || input || control.hasAttribute("aria-pressed")) {
    const state = control.getAttribute("aria-checked") ?? control.getAttribute("aria-pressed");
    const on = input ? input.checked : state === "true";
    return on ? "toggle-on" : "toggle-off";
  }
  if (role === "tab" || role === "option" || role === "radio" || control.closest('[role="tablist"], [role="radiogroup"]')) return "select";
  return "tap";
}

type Snapshot = { view: string; modals: number; announced: number | null };

export function UiSoundHost() {
  /* The member's silent-switch choice (iPhone): applied now and whenever it changes. */
  const throughSilent = useLogSoundStore((s) => s.enabled && s.throughSilent);
  useEffect(() => {
    setLogSoundThroughSilent(throughSilent);
  }, [throughSilent]);

  useEffect(() => {
    let last = 0;
    const play = (kind: UiSoundKind) => {
      if (document.visibilityState === "hidden" || !useLogSoundStore.getState().enabled) return;
      const now = performance.now();
      if (now - last < MIN_GAP_MS) return;
      last = now;
      /* In the key of the room the member is in now: after a room change, the new one. */
      playLogSound(uiSoundCue(kind, soundRoomOf(useAthleteDashboardStore.getState().activeView)));
    };

    /* What the page looked like when the press began. */
    let before: Snapshot | null = null;
    const onCapture = () => {
      before = {
        view: useAthleteDashboardStore.getState().activeView,
        modals: modalCount(),
        announced: useLogMomentStore.getState().announcement?.id ?? null,
      };
    };
    const onBubble = (event: MouseEvent) => {
      const snapshot = before;
      before = null;
      const target = event.target instanceof Element ? event.target : null;
      const control = target?.closest(CONTROL) ?? null;
      if (!snapshot || !control) return;
      if (control.matches(':disabled, [aria-disabled="true"]')) return;
      /* A label wrapping a text field is typing, not a touch. */
      if (control instanceof HTMLLabelElement && control.querySelector('input:not([type="checkbox"]):not([type="radio"]), textarea, select')) return;
      /* Let React and the DOM settle, then read what the click did. */
      window.setTimeout(() => {
        if ((useLogMomentStore.getState().announcement?.id ?? null) !== snapshot.announced) return;
        if (useAthleteDashboardStore.getState().activeView !== snapshot.view) return play("room");
        const modals = modalCount();
        if (modals > snapshot.modals) return play("open");
        if (modals < snapshot.modals) return play("close");
        play(kindOf(control));
      }, 0);
    };

    document.addEventListener("click", onCapture, { capture: true });
    window.addEventListener("click", onBubble);
    return () => {
      document.removeEventListener("click", onCapture, { capture: true });
      window.removeEventListener("click", onBubble);
    };
  }, []);

  return null;
}
