/* ════════════════════════════════════════════════════════════════════════
   CINEMATIC OVERLAYS — the renderer's reading of a config's `overlays` and
   `contentContrastMode`.

   Every cinematic config has declared its overlays and content contrast
   since the environment system was written, and until this module nothing
   read either field: the plate renderer painted the manifest's one scrim per
   plate whatever the environment asked for. This resolves the declared names
   into scrim layers so a surface that renders through its own config gets
   the contrast that config specifies.

   Honest scope: only overlays that are pure contrast scrims have a recipe.
   The hue washes (`cool-tint`, `radial-warm-centre`, `grid-tint`) are
   reported back as unsupported rather than guessed at, and a surface whose
   overlays resolve to nothing keeps the manifest scrim.

   Pure: no React, no DOM.
   ════════════════════════════════════════════════════════════════════════ */

import type { CinematicEnvironmentConfig } from "./environments";

export type OverlayViewport = "desktop" | "mobile";
export type ContentContrastMode = "muted" | "standard" | "elevated";

/** How hard the scrims press, per content contrast mode. */
export const CONTRAST_STRENGTH: Record<ContentContrastMode, number> = {
  muted: 0.85,
  standard: 1,
  elevated: 1.12,
};

export type OverlayLayer = {
  /** The overlay name as the config declares it. */
  name: string;
  /** A CSS background value. */
  background: string;
};

export type ResolvedOverlays = {
  layers: OverlayLayer[];
  /** Declared names with no recipe. Surfaced, never silently invented. */
  unsupported: string[];
};

/* The base colour of every scrim: the closed palette's `#07080c`. */
const BASE = "7,8,12";

type Stop = readonly [positionPct: number, alpha: number];

/* Content sits over the lower band. A phone stacks more of it, so the
   protection rises further up the frame there. */
const VERTICAL_SCRIM_BOTTOM: Record<OverlayViewport, readonly Stop[]> = {
  desktop: [
    [0, 0.12],
    [36, 0.1],
    [58, 0.46],
    [78, 0.82],
    [100, 0.94],
  ],
  mobile: [
    [0, 0.18],
    [20, 0.14],
    [42, 0.56],
    [64, 0.86],
    [100, 0.96],
  ],
};

const SOFT_SCRIM_FULL: readonly Stop[] = [
  [0, 0.72],
  [50, 0.6],
  [100, 0.86],
];

function scale(value: number, strength: number): number {
  return Math.round(Math.min(1, Math.max(0, value * strength)) * 1000) / 1000;
}

function vertical(stops: readonly Stop[], strength: number): string {
  const body = stops.map(([position, value]) => `rgba(${BASE},${scale(value, strength)}) ${position}%`);
  return `linear-gradient(180deg, ${body.join(", ")})`;
}

const RECIPES: Record<string, (viewport: OverlayViewport, strength: number) => string> = {
  "vertical-scrim-bottom": (viewport, strength) => vertical(VERTICAL_SCRIM_BOTTOM[viewport], strength),
  "soft-scrim-full": (_viewport, strength) => vertical(SOFT_SCRIM_FULL, strength),
  /* Edges only. The centre of the frame stays the room. */
  vignette: (viewport, strength) =>
    `radial-gradient(${viewport === "mobile" ? "150% 100%" : "120% 95%"} at 50% 40%, rgba(${BASE},0) 48%, rgba(${BASE},${scale(0.6, strength)}) 100%)`,
};

/** Unknown modes read as standard, so a typo can never remove protection. */
export function contrastMode(value: string): ContentContrastMode {
  return value === "muted" || value === "elevated" ? value : "standard";
}

export function resolveEnvironmentOverlays(
  config: Pick<CinematicEnvironmentConfig, "overlays" | "contentContrastMode">,
  viewport: OverlayViewport,
): ResolvedOverlays {
  const strength = CONTRAST_STRENGTH[contrastMode(config.contentContrastMode)];
  const layers: OverlayLayer[] = [];
  const unsupported: string[] = [];

  for (const name of config.overlays) {
    const recipe = RECIPES[name];
    if (recipe) layers.push({ name, background: recipe(viewport, strength) });
    else unsupported.push(name);
  }

  return { layers, unsupported };
}
