import type { Page } from "@playwright/test";

/* ════════════════════════════════════════════════════════════════════════
   THE DEVICE A SPEC IS DESCRIBING.

   Reserve composes itself around the machine it is running on. The clearest
   case is the room loop: `loopDualLayerAllowed` (lib/cinematic/loop-crossfade)
   returns `hardwareConcurrency > 4`, so a modest device gets ONE layer and no
   crossfade, and the light trace thins out the same way. That is correct
   behaviour — a two-core laptop should not be asked to decode two 1080p
   layers to fade between them.

   It also means a spec that never says which device it is describing inherits
   whatever the runner happens to be. A developer machine reports 20 cores and
   composes two layers; a GitHub runner reports 2 and composes one. Eleven
   crossfade and seam tests failed on CI for that reason alone, and no amount
   of local reproduction could show it — the assertions were fine, the machine
   was different.

   So a spec about the full composition declares the device it means. The
   tests that are ABOUT degradation keep overriding this with their own lower
   value after boot, and still describe exactly what they did before.

   Set before any app script runs, so the first render already sees it.
   ════════════════════════════════════════════════════════════════════════ */

/** Cores a desktop-class Reserve member is assumed to have. Must stay above
 *  the `> 4` gate in loopDualLayerAllowed, or the dual-layer composition the
 *  crossfade specs describe never mounts. */
export const DESKTOP_CORES = 8;

/**
 * Present the page as a desktop-class machine, so composition is a property
 * of the spec rather than of the runner that happened to execute it.
 *
 * Call it BEFORE `page.goto`. It does not touch viewport — a phone-width
 * viewport on a desktop-class device is a real and intended combination, and
 * several specs rely on exactly that.
 */
export async function asDesktopDevice(page: Page, cores?: number): Promise<void> {
  const value = cores ?? DESKTOP_CORES;
  await page.addInitScript((v) => {
    Object.defineProperty(navigator, "hardwareConcurrency", {
      configurable: true,
      get: () => v,
    });
  }, value);
}
