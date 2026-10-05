"use client";

import { useEffect, useSyncExternalStore } from "react";

import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import { useAmbientMotionStore } from "@/lib/ui/ambient-motion-store";
import { resolveAmbientMotion, type AmbientMotion } from "@/lib/ui/ambient-motion";

const subscribeVisibility = (onChange: () => void) => {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
};
const readHidden = () => document.visibilityState === "hidden";
const readServerHidden = () => false;

/**
 * The one motion gate for ambient effects: `"full" | "reduced" | "static"`.
 *
 * Built from `prefers-reduced-motion`, the member's pause control and tab
 * visibility (see `resolveAmbientMotion`). During server render and hydration
 * the media query reads false, so an effect must never START on the first
 * render: every consumer acts on a later change, never on mount.
 */
export function useAmbientMotion(): AmbientMotion {
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const paused = useAmbientMotionStore((state) => state.paused);
  const hidden = useSyncExternalStore(subscribeVisibility, readHidden, readServerHidden);

  /* The pause choice lives in this device's localStorage and is rehydrated
     after mount (idempotent: the background and the entrance do the same). */
  useEffect(() => {
    void useAmbientMotionStore.persist.rehydrate();
  }, []);

  return resolveAmbientMotion({ reducedMotion, paused, hidden });
}
