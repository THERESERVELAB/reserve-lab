import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/* ════════════════════════════════════════════════════════════════════════
   LOG SOUND — the member's switch for the sounds a log makes.

   A per-device preference, like the ambient-motion pause: this browser's
   localStorage under its own key, never the athlete store or the sync
   contract. On by default, and on an iPhone heard through the ring/silent
   switch by default too — a member who hears nothing cannot tell a quiet app
   from a broken one. Both are switches, so the phone can have the last word
   whenever the member wants it.
   ════════════════════════════════════════════════════════════════════════ */

type LogSoundStore = {
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  /**
   * iPhone: play even with the ring/silent switch on (Safari's "playback"
   * audio session). On by default; turning it off hands the phone the call,
   * which is what a member who keeps music running from another app wants.
   */
  throughSilent: boolean;
  setThroughSilent: (throughSilent: boolean) => void;
};

/* v1, once: the house went silent on devices that had saved a switch here, so
   a saved-before-v1 device is handed the sounds back — on, and heard through
   the ring/silent switch. Both stay switches from then on. */
export function migrateLogSound(saved: unknown, from: number): LogSoundStore {
  const state = (saved ?? {}) as LogSoundStore;
  return from < 1 ? { ...state, enabled: true, throughSilent: true } : state;
}

export const useLogSoundStore = create<LogSoundStore>()(
  persist(
    (set) => ({
      enabled: true,
      setEnabled: (enabled) => set({ enabled }),
      throughSilent: true,
      setThroughSilent: (throughSilent) => set({ throughSilent }),
    }),
    {
      name: "fba-log-sound",
      storage: createJSONStorage(() => localStorage),
      version: 1,
      migrate: migrateLogSound,
      /* Rehydrated after mount by the host, so server and first client render agree. */
      skipHydration: true,
    },
  ),
);
