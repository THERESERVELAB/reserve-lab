"use client";

import React, { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

/* ════════════════════════════════════════════════════════════════════════
   RESERVE SHELL SLOTS — where a page may place content into the shell.

   Two slots, both rendered by AppShell on every view and empty by default:

     topbar  the centre of the top bar. A page that fills it replaces the
             shell's default status chips — it never stacks beside them.
     dock    the true bottom of the screen, below <main> and above the home
             indicator. Phone action bars live here, so a docked action is
             never cut short by the scroll container or hidden behind chrome.

   A portal rather than lifted state: the page keeps owning its data, and the
   shell never has to know which page is speaking.
   ════════════════════════════════════════════════════════════════════════ */

export type ReserveShellSlot = "topbar" | "dock";

export const RESERVE_SHELL_SLOT_ID: Record<ReserveShellSlot, string> = {
  topbar: "reserve-slot-topbar",
  dock: "reserve-slot-dock",
};

/* The slot element never changes identity while the shell is mounted, so
   there is nothing to subscribe to. React re-reads the snapshot after the
   commit that mounts the slot, which is what makes a first-load portal land. */
const subscribeToNothing = () => () => undefined;

export function ReserveShellPortal({
  slot,
  children,
}: {
  slot: ReserveShellSlot;
  children: React.ReactNode;
}) {
  const host = useSyncExternalStore(
    subscribeToNothing,
    () => document.getElementById(RESERVE_SHELL_SLOT_ID[slot]),
    () => null,
  );
  return host ? createPortal(children, host) : null;
}
