"use client";

import { useCallback, useSyncExternalStore } from "react";

/* ════════════════════════════════════════════════════════════════════════
   KEYBOARD VIEWPORT — how much of the screen the on-screen keyboard covers.

   iOS Safari (and Android Chrome's default `resizes-visual`) open the
   keyboard over the page: the layout viewport keeps its height, so anything
   fixed to the bottom — a sheet's Save button, the field being typed into —
   sits under the keys. Only the visual viewport shrinks. The difference is
   the keyboard.

   A pinch zoom also shrinks the visual viewport, so a zoomed page reports no
   keyboard; so does a sliver (the URL bar collapsing), which is never a
   keyboard's height.
   ════════════════════════════════════════════════════════════════════════ */

/** Smaller than any on-screen keyboard; larger than a collapsing URL bar. */
const MIN_KEYBOARD_PX = 120;

export type VisualViewportLike = { height: number; offsetTop: number; scale?: number };

export type KeyboardViewport = {
  /** Pixels at the bottom of the layout viewport hidden behind the keyboard. */
  inset: number;
  /** The visible height above the keyboard. */
  visibleHeight: number;
};

export const NO_KEYBOARD: KeyboardViewport = { inset: 0, visibleHeight: 0 };

export function keyboardViewportFrom(layoutHeight: number, vv: VisualViewportLike | null | undefined): KeyboardViewport {
  if (!vv || layoutHeight <= 0) return NO_KEYBOARD;
  if ((vv.scale ?? 1) > 1.01) return NO_KEYBOARD;
  const inset = Math.round(layoutHeight - vv.height - vv.offsetTop);
  if (inset < MIN_KEYBOARD_PX) return { inset: 0, visibleHeight: Math.round(vv.height) };
  return { inset, visibleHeight: Math.round(vv.height) };
}

/* useSyncExternalStore needs a primitive snapshot to stay stable between renders. */
const readKey = () => {
  const { inset, visibleHeight } = keyboardViewportFrom(window.innerHeight, window.visualViewport);
  return `${inset}:${visibleHeight}`;
};
const readServerKey = () => "0:0";

/**
 * The keyboard's cover while `active` (a sheet is open). Inactive, it reads
 * nothing and subscribes to nothing.
 */
export function useKeyboardViewport(active: boolean): KeyboardViewport {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const vv = active && typeof window !== "undefined" ? window.visualViewport : null;
      if (!vv) return () => undefined;
      vv.addEventListener("resize", onChange);
      vv.addEventListener("scroll", onChange);
      window.addEventListener("resize", onChange);
      return () => {
        vv.removeEventListener("resize", onChange);
        vv.removeEventListener("scroll", onChange);
        window.removeEventListener("resize", onChange);
      };
    },
    [active],
  );
  const key = useSyncExternalStore(subscribe, active ? readKey : readServerKey, readServerKey);
  const [inset, visibleHeight] = key.split(":").map(Number);
  return { inset, visibleHeight };
}

/** A control that raises the keyboard (and so must stay in view above it). */
export function isTextEntry(el: Element | null): el is HTMLElement {
  if (!el || !(el instanceof HTMLElement)) return false;
  if (el.isContentEditable || el instanceof HTMLTextAreaElement) return true;
  if (!(el instanceof HTMLInputElement)) return false;
  return !["range", "checkbox", "radio", "button", "submit", "reset", "color", "file", "hidden", "image"].includes(el.type);
}
