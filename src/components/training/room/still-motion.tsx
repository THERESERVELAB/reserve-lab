"use client";

import { motion } from "framer-motion";
import { createContext, createElement, forwardRef, useContext, type ReactNode } from "react";

/* ════════════════════════════════════════════════════════════════════════
   STILL MOTION — one switch that holds Training's decorative loops still.

   The live cockpit is where the member reads loads and rest windows between
   sets. Nothing decorative may move there (Bible §08: nothing competes with
   reading), and nothing may move for a member who paused background motion
   or asked the OS for reduced motion.

   The loops were written as `motion.*` elements with `repeat: Infinity`.
   Rather than thread a prop through every scene, a component reads
   `useStillMotion()` and renders `M.g` instead of `motion.g`. While still,
   `M` is a drop-in namespace of plain elements: the animation props are
   dropped and the element renders at its authored resting attributes.
   ════════════════════════════════════════════════════════════════════════ */

const MOTION_ONLY_PROPS = new Set([
  "animate",
  "custom",
  "drag",
  "exit",
  "initial",
  "layout",
  "layoutId",
  "onAnimationComplete",
  "onAnimationStart",
  "transition",
  "variants",
  "viewport",
  "whileDrag",
  "whileFocus",
  "whileHover",
  "whileInView",
  "whileTap",
]);

const stillTags = new Map<string, unknown>();

function stillTag(tag: string) {
  const cached = stillTags.get(tag);
  if (cached) return cached;
  const Still = forwardRef<Element, Record<string, unknown>>(function Still(props, ref) {
    const rest: Record<string, unknown> = {};
    for (const key of Object.keys(props)) {
      if (!MOTION_ONLY_PROPS.has(key)) rest[key] = props[key];
    }
    return createElement(tag, { ...rest, ref });
  });
  Still.displayName = `Still.${tag}`;
  stillTags.set(tag, Still);
  return Still;
}

/** A `motion`-shaped namespace whose elements never animate. Identities are cached per tag. */
const stillMotion = new Proxy(
  {},
  { get: (_target, tag) => (typeof tag === "string" ? stillTag(tag) : undefined) },
) as typeof motion;

const StillContext = createContext(false);

export function StillMotionProvider({ still, children }: { still: boolean; children: ReactNode }) {
  return <StillContext.Provider value={still}>{children}</StillContext.Provider>;
}

/** True while Training's decorative motion must hold still. */
export function useIsStill(): boolean {
  return useContext(StillContext);
}

/** `motion`, or its still twin while the room holds still. */
export function useStillMotion(): typeof motion {
  return useContext(StillContext) ? stillMotion : motion;
}
