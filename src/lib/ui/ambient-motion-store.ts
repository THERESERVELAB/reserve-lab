import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/* ════════════════════════════════════════════════════════════════════════
   AMBIENT MOTION — the member's pause switch for background motion.

   WCAG 2.2.2: motion that starts on its own and runs longer than five
   seconds needs a way to stop it. Reduced motion already stops it for
   members who set that in their operating system; this is the in-product
   control for everyone else.

   `paused` is a per-device viewing preference, like reduced motion itself,
   so it lives in this browser's localStorage under its own key: never in the
   athlete store, the member_state sync contract, or another device.
   `available` is not persisted. The shell reports whether anything would
   move right now, so the control only appears when it does something.
   ════════════════════════════════════════════════════════════════════════ */

type AmbientMotionStore = {
  paused: boolean;
  available: boolean;
  togglePaused: () => void;
  setAvailable: (available: boolean) => void;
};

export const useAmbientMotionStore = create<AmbientMotionStore>()(
  persist(
    (set) => ({
      paused: false,
      available: false,
      togglePaused: () => set((state) => ({ paused: !state.paused })),
      setAvailable: (available) => set({ available }),
    }),
    {
      name: "fba-ambient-motion",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ paused: state.paused }),
      /* Rehydrated after mount by the shell, so the server render and the
         first client render agree. */
      skipHydration: true,
    },
  ),
);
