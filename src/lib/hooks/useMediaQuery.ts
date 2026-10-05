"use client";

import { useCallback, useSyncExternalStore } from "react";

/** Reserve's phone breakpoint: below Tailwind `md`. */
export const PHONE_QUERY = "(max-width: 767px)";

/**
 * Live media-query match.
 *
 * Reports `false` on the server and during hydration, then the real value —
 * so it never causes a hydration mismatch. Use CSS breakpoints for layout that
 * must be right on the first paint; use this only where rendering both
 * variants would duplicate an interactive element (for example, one gold
 * action that docks on phones and sits inline on desktop).
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

export function useIsPhone(): boolean {
  return useMediaQuery(PHONE_QUERY);
}
