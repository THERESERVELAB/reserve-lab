import { create } from "zustand";

/* ════════════════════════════════════════════════════════════════════════
   SHELL UI STATE — chrome state for this screen, right now.

   Deliberately a separate, NON-persisted store. Whether the phone navigation
   is open is not member data: it must never reach localStorage, the
   member_state sync contract, or another device. Keeping it out of the
   athlete store makes that impossible rather than merely avoided.
   ════════════════════════════════════════════════════════════════════════ */

type ShellStore = {
  /** The phone navigation overlay (below the `md` breakpoint). */
  navOpen: boolean;
  setNavOpen: (open: boolean) => void;
};

export const useShellStore = create<ShellStore>((set) => ({
  navOpen: false,
  setNavOpen: (navOpen) => set({ navOpen }),
}));
