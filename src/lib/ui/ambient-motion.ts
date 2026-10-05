/* ════════════════════════════════════════════════════════════════════════
   AMBIENT MOTION GATE — one answer to "may this move right now?"

   Every ambient effect (the signal trace, living numerals, awake light,
   systems online) reads this single decision instead of asking the platform
   on its own, so no effect can disagree with another about the member's
   motion settings.

     static   the member paused background motion (WCAG 2.2.2), or the tab
              is hidden: nothing moves and no loop runs.
     reduced  the operating system asks for reduced motion: opacity fades of
              200ms or less, nothing travels, nothing loops.
     full     everything the effect is designed to do.

   Pause outranks reduced motion: a paused member asked for stillness, and
   stillness is the stricter of the two. Content is visible at rest in every
   mode; motion only ever describes a change.
   ════════════════════════════════════════════════════════════════════════ */

export type AmbientMotion = "full" | "reduced" | "static";

export type AmbientMotionInput = {
  /** `prefers-reduced-motion: reduce`. */
  reducedMotion: boolean;
  /** The member's pause control (top bar on desktop, More on phones). */
  paused: boolean;
  /** `document.visibilityState === "hidden"`. */
  hidden: boolean;
};

export function resolveAmbientMotion({ reducedMotion, paused, hidden }: AmbientMotionInput): AmbientMotion {
  if (paused || hidden) return "static";
  if (reducedMotion) return "reduced";
  return "full";
}

/** The longest a reduced-motion fade may run. */
export const REDUCED_FADE_MAX_MS = 200;
