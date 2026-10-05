/* ════════════════════════════════════════════════════════════════════════
   CINEMATIC ENVIRONMENT SYSTEM.

   One configuration per environment, so cinematic behaviour is declared in a
   single place rather than re-invented per screen. The rules that matter:

     - The functional shell never waits on optional media.
     - A poster renders first, always. Video is an enhancement.
     - Reduced motion, low power, and active-task states are first-class
       behaviours, not afterthoughts.
     - Nothing here invents an asset. `status` is derived from the visual
       asset manifest, which records what is ACTUALLY on disk and approved.

   This module owns playback POLICY, not media. A loop lives in the visual
   asset manifest, on the plate it animates and under that plate's id. The
   config used to carry its own `desktopAsset`/`mobileAsset` fields: a second
   map of media that could disagree with the plate on screen, which is the
   defect the shell once had with focal points. Those fields are gone, and
   `resolvePlayback` is handed the manifest's gated loop instead.

   Asset reality at the time of writing (verified against public/brand):
     9 static 16:9 WebP plates exist. There are ZERO video loops and ZERO
     mobile 9:16 crops. Every environment therefore renders poster-only in
     practice, and the loop layer below stays dormant until the manifest
     approves a loop.
   ════════════════════════════════════════════════════════════════════════ */

import {
  VISUAL_ASSETS,
  productionLoop,
  productionPlate,
  type ProductionLoop,
} from "@/lib/brand/asset-manifest";
import { ENVIRONMENT_PLATES } from "@/lib/brand/visuals";

/* ─── Motion tokens (Phase 22) ────────────────────────────────────────── */

export type ReserveMotionTokens = {
  micro: { fast: number; standard: number };
  interface: { enter: number; exit: number; route: number };
  cinematic: { ambientMinimum: number; ambientMaximum: number; activationReveal: number };
  easing: { precise: string; cinematic: string; exit: string };
};

/** Milliseconds, except the ambient loop bounds which are seconds. */
export const RESERVE_MOTION: ReserveMotionTokens = {
  micro: { fast: 120, standard: 200 },
  interface: { enter: 260, exit: 220, route: 520 },
  cinematic: { ambientMinimum: 6, ambientMaximum: 20, activationReveal: 1800 },
  easing: {
    precise: "cubic-bezier(0.2, 0, 0, 1)",
    cinematic: "cubic-bezier(0.16, 1, 0.3, 1)",
    exit: "cubic-bezier(0.4, 0, 1, 1)",
  },
};

export type MotionPreference = "full" | "balanced" | "reduced" | "static";

/**
 * Scales a token for the athlete's motion preference. Reduced motion stays
 * premium — it shortens and calms movement rather than disabling it — and
 * static removes it entirely.
 */
export function scaleDuration(ms: number, preference: MotionPreference): number {
  switch (preference) {
    case "full":
      return ms;
    case "balanced":
      return Math.round(ms * 0.75);
    case "reduced":
      return Math.round(ms * 0.5);
    case "static":
      return 0;
  }
}

/* ─── Environments ────────────────────────────────────────────────────── */

export type CinematicEnvironment =
  | "reserve-gate"
  | "profile-activation"
  | "personal-command"
  | "protocol-foundry"
  | "training-command"
  | "nutrition-atelier"
  | "recovery-chamber"
  | "biomarker-vault"
  | "coach-operations"
  | "response-intelligence";

export const CINEMATIC_ENVIRONMENTS: CinematicEnvironment[] = [
  "reserve-gate",
  "profile-activation",
  "personal-command",
  "protocol-foundry",
  "training-command",
  "nutrition-atelier",
  "recovery-chamber",
  "biomarker-vault",
  "coach-operations",
  "response-intelligence",
];

export type ReducedMotionBehavior = "static" | "crossfade" | "subtle-opacity";
export type LowPowerBehavior = "poster-only" | "reduced-frame-rate";
export type ActiveTaskBehavior = "ambient" | "dimmed" | "paused" | "poster-only";

export type CinematicEnvironmentConfig = {
  id: CinematicEnvironment;
  label: string;

  /* No loop paths. A loop belongs to the plate it animates, in the visual
     asset manifest; `resolvePlayback` receives the one that applies. */

  /** Poster is REQUIRED. Empty string means the poster is missing too. */
  desktopPoster: string;
  mobilePoster: string;

  /**
   * The cycle length a loop for this environment is commissioned at. The
   * delivered file's real length is the manifest's `loop.loopSeconds`.
   */
  ambientLoopDurationSeconds?: number;

  focalPoint: { desktop: string; mobile: string };
  overlays: string[];
  contentContrastMode: string;

  reducedMotionBehavior: ReducedMotionBehavior;
  lowPowerBehavior: LowPowerBehavior;
  activeTaskBehavior: ActiveTaskBehavior;
};

const P = ENVIRONMENT_PLATES;

/**
 * Policy and composition only. Posters point at the real WebP plates where
 * one exists, and are empty where none does. No loop is declared here.
 */
export const CINEMATIC_CONFIG: Record<CinematicEnvironment, CinematicEnvironmentConfig> = {
  "reserve-gate": {
    id: "reserve-gate",
    label: "Reserve Gate",
    desktopPoster: P.entranceGallery,
    mobilePoster: P.entranceGallery,
    ambientLoopDurationSeconds: 14,
    focalPoint: { desktop: "50% 45%", mobile: "50% 50%" },
    overlays: ["vertical-scrim-bottom", "vignette"],
    contentContrastMode: "elevated",
    reducedMotionBehavior: "static",
    lowPowerBehavior: "poster-only",
    // Authentication must never wait on, or be obscured by, the cinematic.
    activeTaskBehavior: "dimmed",
  },
  "profile-activation": {
    id: "profile-activation",
    label: "Profile Activation",
    desktopPoster: "",
    mobilePoster: "",
    ambientLoopDurationSeconds: 10,
    focalPoint: { desktop: "50% 50%", mobile: "50% 42%" },
    overlays: ["radial-warm-centre", "vignette"],
    contentContrastMode: "elevated",
    reducedMotionBehavior: "crossfade",
    lowPowerBehavior: "poster-only",
    activeTaskBehavior: "ambient",
  },
  "personal-command": {
    id: "personal-command",
    label: "Personal Command",
    desktopPoster: P.apexCommand,
    mobilePoster: P.apexCommand,
    ambientLoopDurationSeconds: 18,
    focalPoint: { desktop: "50% 40%", mobile: "50% 32%" },
    overlays: ["vertical-scrim-bottom"],
    contentContrastMode: "standard",
    reducedMotionBehavior: "subtle-opacity",
    lowPowerBehavior: "poster-only",
    activeTaskBehavior: "ambient",
  },
  "protocol-foundry": {
    id: "protocol-foundry",
    label: "Protocol Foundry",
    desktopPoster: "",
    mobilePoster: "",
    ambientLoopDurationSeconds: 16,
    focalPoint: { desktop: "50% 50%", mobile: "50% 40%" },
    overlays: ["vertical-scrim-bottom", "grid-tint"],
    contentContrastMode: "elevated",
    reducedMotionBehavior: "static",
    lowPowerBehavior: "poster-only",
    // Editing is precision work — the environment must go quiet.
    activeTaskBehavior: "poster-only",
  },
  "training-command": {
    id: "training-command",
    label: "Training Command",
    desktopPoster: P.trainingCommand,
    mobilePoster: P.trainingCommand,
    ambientLoopDurationSeconds: 12,
    focalPoint: { desktop: "50% 45%", mobile: "50% 35%" },
    overlays: ["vertical-scrim-bottom", "vignette"],
    contentContrastMode: "elevated",
    reducedMotionBehavior: "static",
    lowPowerBehavior: "poster-only",
    // No continuous motion while the athlete is logging sets.
    activeTaskBehavior: "paused",
  },
  "nutrition-atelier": {
    id: "nutrition-atelier",
    label: "Nutrition Atelier",
    desktopPoster: P.nutritionCommand,
    mobilePoster: P.nutritionCommand,
    ambientLoopDurationSeconds: 16,
    focalPoint: { desktop: "50% 48%", mobile: "50% 38%" },
    overlays: ["vertical-scrim-bottom"],
    contentContrastMode: "standard",
    reducedMotionBehavior: "subtle-opacity",
    lowPowerBehavior: "poster-only",
    activeTaskBehavior: "poster-only",
  },
  "recovery-chamber": {
    id: "recovery-chamber",
    label: "Recovery Chamber",
    desktopPoster: P.recoveryChamber,
    mobilePoster: P.recoveryChamber,
    ambientLoopDurationSeconds: 20,
    focalPoint: { desktop: "50% 50%", mobile: "50% 45%" },
    overlays: ["soft-scrim-full", "vignette"],
    contentContrastMode: "muted",
    reducedMotionBehavior: "subtle-opacity",
    lowPowerBehavior: "reduced-frame-rate",
    activeTaskBehavior: "ambient",
  },
  "biomarker-vault": {
    id: "biomarker-vault",
    label: "Biomarker Vault",
    desktopPoster: P.biomarkersLab,
    mobilePoster: P.biomarkersLab,
    ambientLoopDurationSeconds: 18,
    focalPoint: { desktop: "50% 45%", mobile: "50% 38%" },
    overlays: ["vertical-scrim-bottom", "cool-tint"],
    contentContrastMode: "elevated",
    reducedMotionBehavior: "static",
    lowPowerBehavior: "poster-only",
    // Clinical information must never compete with motion.
    activeTaskBehavior: "poster-only",
  },
  "coach-operations": {
    id: "coach-operations",
    label: "Coach Operations",
    desktopPoster: "",
    mobilePoster: "",
    ambientLoopDurationSeconds: 20,
    focalPoint: { desktop: "50% 40%", mobile: "50% 34%" },
    overlays: ["vertical-scrim-bottom", "grid-tint"],
    contentContrastMode: "elevated",
    reducedMotionBehavior: "static",
    lowPowerBehavior: "poster-only",
    // Roster readability outranks atmosphere.
    activeTaskBehavior: "poster-only",
  },
  "response-intelligence": {
    id: "response-intelligence",
    label: "Response Intelligence",
    desktopPoster: P.intelligenceCommand,
    mobilePoster: P.intelligenceCommand,
    ambientLoopDurationSeconds: 18,
    focalPoint: { desktop: "50% 45%", mobile: "50% 38%" },
    overlays: ["vertical-scrim-bottom"],
    contentContrastMode: "standard",
    reducedMotionBehavior: "subtle-opacity",
    lowPowerBehavior: "poster-only",
    activeTaskBehavior: "dimmed",
  },
};

export function cinematicConfig(id: CinematicEnvironment): CinematicEnvironmentConfig {
  return CINEMATIC_CONFIG[id];
}

/* ─── Playback resolution ─────────────────────────────────────────────── */

export type PlaybackContext = {
  motionPreference: MotionPreference;
  lowPower: boolean;
  /** Route hidden, or browser tab hidden. */
  offscreen: boolean;
  /** The athlete is logging sets, editing a protocol, or similar. */
  activeTask: boolean;
  viewport: "desktop" | "mobile";
};

export type PlaybackDecision = {
  /** Whether a video element should play at all. */
  playVideo: boolean;
  /** The poster to paint immediately. Empty when no asset exists. */
  poster: string;
  /** The loop source, when one exists AND should play. */
  source?: string;
  /**
   * 0–1 opacity for the LOOP layer, over its poster. It never dims the
   * poster: a loop that is paused, refused or broken leaves the room exactly
   * as bright as it was, so every still resolves to 1.
   */
  opacity: number;
  reason: string;
};

/**
 * The single decision every cinematic surface asks. Poster-first is not
 * optional: the poster is returned in every branch, including the ones that
 * refuse to play video.
 *
 * `loop` is `productionLoop(assetId, ctx.viewport)` for the plate actually on
 * screen: the manifest's gated answer, resolved for the SAME viewport as
 * `ctx`. Null is today's answer everywhere, and it resolves to a still.
 */
export function resolvePlayback(
  config: CinematicEnvironmentConfig,
  ctx: PlaybackContext,
  loop: ProductionLoop | null,
): PlaybackDecision {
  const poster = ctx.viewport === "mobile" ? config.mobilePoster : config.desktopPoster;
  const source = loop?.src;

  const still = (opacity: number, reason: string): PlaybackDecision => ({
    playVideo: false,
    poster,
    opacity,
    reason,
  });

  if (!source) return still(1, "No motion asset exists for this environment; poster only.");
  if (ctx.offscreen) return still(1, "Route or tab is hidden; playback is paused.");
  if (ctx.motionPreference === "static") return still(1, "Motion preference is static.");
  /* Every reduced-motion behaviour resolves the LOOP to a still, not only
     `static`. `crossfade` and `subtle-opacity` describe what a still may do;
     neither is a moving camera. Design Bible §08 kills all motion under
     prefers-reduced-motion, and the global kill block in globals.css cannot
     reach a playing <video>, so this decision has to. */
  if (ctx.motionPreference === "reduced") {
    return still(1, "Reduced motion resolves this environment to a still.");
  }
  if (ctx.lowPower && config.lowPowerBehavior === "poster-only") {
    return still(1, "Low-power mode resolves this environment to a still.");
  }
  if (ctx.activeTask) {
    switch (config.activeTaskBehavior) {
      case "paused":
        return still(1, "Active task pauses cinematic motion.");
      case "poster-only":
        return still(1, "Active task resolves this environment to a still.");
      case "dimmed":
        return { playVideo: true, poster, source, opacity: 0.35, reason: "Active task dims motion." };
      case "ambient":
        break;
    }
  }

  return { playVideo: true, poster, source, opacity: 1, reason: "Ambient playback." };
}

/* ─── Loop layer ──────────────────────────────────────────────────────────
   What a renderer does with a decision, expressed as data. ReserveEnvironment
   owns the <video> element; every choice about that element lives here, so
   each one is testable without a DOM.

   The lifecycle:
     - Nothing renders on the server or before mount. No loop byte is ever
       requested on the strength of a server-render default.
     - An element mounts only when the decision plays AND the manifest serves
       a loop, and only when both name the same source.
     - It stays invisible until the element reports `playing`, then fades in
       over its poster. Its first frame is the plate, so the hand-off is felt
       rather than seen.
     - When the decision turns to a still it pauses and fades out, and stays
       mounted so it can resume without a second download. An element that
       never reached `playing` has nothing on screen to fade, so it unmounts.
     - A failure is final for that source. The poster stays, and nothing
       retries behind the member's back. */

/** The crossfade between a loop and its poster. Bible §09: felt, over ≥1s. */
export const LOOP_FADE_MS = RESERVE_MOTION.cinematic.activationReveal;

/** `HTMLMediaElement.HAVE_FUTURE_DATA`, restated so this module needs no DOM. */
const HAVE_FUTURE_DATA = 3;

export type LoopElementState = {
  /** The element has reported `playing` at least once for this source. */
  played: boolean;
  /** It is playing right now. */
  playing: boolean;
  /** It errored or stalled. Final for this source. */
  failed: boolean;
};

export const LOOP_ELEMENT_IDLE: LoopElementState = {
  played: false,
  playing: false,
  failed: false,
};

export type LoopLayerInput = {
  /** True only on the client, after mount. */
  mounted: boolean;
  /** The surface's playback decision. Absent means the surface never plays motion. */
  decision: PlaybackDecision | undefined;
  /** `productionLoop(assetId, viewport)` for the plate being rendered. */
  loop: ProductionLoop | null;
  element: LoopElementState;
};

export type LoopLayer = {
  /** Whether a <video> element exists at all. False: no element, no request. */
  render: boolean;
  /** Play (true) or pause (false) the mounted element. */
  play: boolean;
  /** Target opacity. The CSS transition supplies the fade, in both directions. */
  opacity: number;
};

export function resolveLoopLayer({
  mounted,
  decision,
  loop,
  element,
}: LoopLayerInput): LoopLayer {
  if (!mounted || !loop) return { render: false, play: false, opacity: 0 };

  /* The decision must name the loop this renderer would mount. A decision
     resolved against another plate's loop is refused rather than trusted:
     that disagreement is exactly what one asset id exists to prevent. */
  if (element.failed || decision?.playVideo !== true || decision.source !== loop.src) {
    /* A loop that has been on screen stays mounted to pause and fade out.
       One that never played unmounts; there is nothing to fade. */
    return { render: element.played, play: false, opacity: 0 };
  }

  return { render: true, play: true, opacity: element.playing ? decision.opacity : 0 };
}

/**
 * Whether a media event ends the loop for its source.
 *
 * `error` always does. `stalled` only means the network has gone quiet, which
 * matters only when playback cannot continue from what is already buffered.
 * A short loop is often fully buffered, and fading a healthy loop back to its
 * poster because the network idled would be a flicker for nothing.
 */
export function isLoopFailure(event: "error" | "stalled", readyState: number): boolean {
  return event === "error" || readyState < HAVE_FUTURE_DATA;
}

/* ─── Asset manifest (Phase 25) ───────────────────────────────────────── */

export type CinematicAssetStatus =
  | "available"
  | "temporary"
  | "missing"
  | "needs-mobile-crop"
  | "needs-poster";

export type CinematicAssetRequirement = {
  environment: CinematicEnvironment;
  status: CinematicAssetStatus;
  desktopAspectRatio: string;
  mobileAspectRatio: "9:16";
  sceneDescription: string;
  movementDescription: string;
  safeTextAreas: string[];
  forbiddenElements: string[];
  loopRequirements: string[];
  fallbackRequirements: string[];
};

const FORBIDDEN_EVERYWHERE = [
  "No real athlete, coach, or federation names or likenesses",
  "No readable brand marks",
  "No text baked into the plate",
  "No medical or clinical imagery",
  "No guaranteed-results implication",
];

const LOOP_BASE = [
  "Seamless loop with no visible cut",
  "6–20 seconds",
  "No audio track",
  "No flashing or rapid camera movement",
];

const FALLBACK_BASE = [
  "Poster frame exported from frame 0",
  "Poster must render before any video byte is requested",
  "Failed media falls back to poster without layout shift",
];

const SCENES: Record<CinematicEnvironment, { scene: string; movement: string }> = {
  "reserve-gate": {
    scene:
      "Architectural darkness — stone and brushed metal threshold, a single controlled light source raking across the surface. Deep shadow, restrained emerald atmospheric haze.",
    movement: "Slow forward camera approach, roughly 3% travel. Light drifts, geometry does not.",
  },
  "profile-activation": {
    scene:
      "A dark chamber resolving into focus as a single warm key light rises. Glass and stone, no furniture, no figures.",
    movement: "Illumination bloom from centre, settling. One directional reveal, no loop-back jerk.",
  },
  "personal-command": {
    scene:
      "Wide command room at low light — horizontal architecture, glass planes, distant depth. Calm and institutional.",
    movement: "Barely-there parallax drift and a slow ambient light shift.",
  },
  "protocol-foundry": {
    scene:
      "A precision workshop rendered in metal and shadow — drafting surfaces, machined edges, cool directional light. Construction and versioning, not manufacturing noise.",
    movement: "Slow lateral drift across the surface. Motion must stop dead when editing begins.",
  },
  "training-command": {
    scene:
      "Dark training floor, hard raking light on textured surfaces. Higher contrast and energy than the other rooms without becoming busy.",
    movement: "Subtle heat-shimmer and light flicker only. No camera travel.",
  },
  "nutrition-atelier": {
    scene:
      "Abstract culinary materials under controlled light — stone counter, steel, water, raw texture. Precise and premium, never a food stock shot.",
    movement: "Slow light travel across the surface; a single slow liquid or steam element.",
  },
  "recovery-chamber": {
    scene:
      "Quiet architectural depth, very low contrast, cool darkness with one soft warm source. Space to breathe.",
    movement: "Breath-like illumination cycle, roughly 20 seconds. Nothing else moves.",
  },
  "biomarker-vault": {
    scene:
      "A private vault of cool glass and dark metal. Precise, clinical in geometry but never medical in imagery.",
    movement: "Slow cool-light drift. Absolutely no pulsing or alarm-like rhythm.",
  },
  "coach-operations": {
    scene:
      "A professional operations room — long horizontal surfaces, restrained light, multiple depth planes suggesting oversight of many.",
    movement: "Minimal ambient drift. Must never reduce roster legibility.",
  },
  "response-intelligence": {
    scene:
      "Deep dark space with structured light forms suggesting accumulated knowledge. Abstract, architectural, not data-visual.",
    movement: "Slow structural light resolve, as if something is becoming known.",
  },
};

const SAFE_AREAS_DESKTOP = [
  "Top 18% clear for the environment title",
  "Left 45% clear for primary content",
  "Bottom 12% clear for action bars",
];

const SAFE_AREAS_MOBILE = [
  "Top 15% clear of detail for the header",
  "Centre 55% low-detail for content panels",
  "Bottom 20% clear for navigation and the home indicator",
];

/**
 * The approved plate for an environment, read through the manifest's own gate
 * so that an unapproved plate can never count toward a status.
 */
function productionAssetFor(environment: CinematicEnvironment) {
  return (
    Object.values(VISUAL_ASSETS).find(
      (asset) =>
        asset.environment === environment && productionPlate(asset.id, "desktop") !== null,
    ) ?? null
  );
}

/**
 * The honest state of every environment's assets. Derived from the visual
 * asset manifest, so it cannot drift from what the product actually renders.
 */
export function buildAssetManifest(): CinematicAssetRequirement[] {
  return CINEMATIC_ENVIRONMENTS.map((id) => {
    const config = CINEMATIC_CONFIG[id];
    const scene = SCENES[id];

    /* Status is computed, never hand-written, and computed from the manifest
       the renderer reads rather than from this config, so it cannot claim
       more than production serves. "available" is a finished cinematic: an
       approved plate with its own 9:16 crop and an approved loop for BOTH
       viewports. A real plate short of that still owes its mobile
       composition. */
    const asset = productionAssetFor(id);
    let status: CinematicAssetStatus;
    if (!asset) {
      status = "missing";
    } else if (
      asset.mobileSrc !== null &&
      productionLoop(asset.id, "desktop") !== null &&
      productionLoop(asset.id, "mobile") !== null
    ) {
      status = "available";
    } else {
      status = "needs-mobile-crop";
    }

    return {
      environment: id,
      status,
      desktopAspectRatio: "16:9",
      mobileAspectRatio: "9:16",
      sceneDescription: scene.scene,
      movementDescription: scene.movement,
      safeTextAreas: [...SAFE_AREAS_DESKTOP, ...SAFE_AREAS_MOBILE],
      forbiddenElements: FORBIDDEN_EVERYWHERE,
      loopRequirements: [
        ...LOOP_BASE,
        `Target loop ${config.ambientLoopDurationSeconds ?? 12}s`,
        `Desktop focal point ${config.focalPoint.desktop}; mobile focal point ${config.focalPoint.mobile}`,
      ],
      fallbackRequirements: [
        ...FALLBACK_BASE,
        `Reduced motion: ${config.reducedMotionBehavior}`,
        `Low power: ${config.lowPowerBehavior}`,
        `Active task: ${config.activeTaskBehavior}`,
      ],
    };
  });
}

export function formatAssetManifest(manifest = buildAssetManifest()): string {
  const lines: string[] = ["═══ RESERVE CINEMATIC ASSET MANIFEST ═══"];
  const missing = manifest.filter((m) => m.status === "missing");
  const needsCrop = manifest.filter((m) => m.status === "needs-mobile-crop");
  const available = manifest.filter((m) => m.status === "available");

  lines.push(
    `Environments: ${manifest.length} · available ${available.length} · needs-mobile-crop ${needsCrop.length} · missing ${missing.length}`,
  );
  /* Derived like the statuses: the note disappears the day a loop enters the
     manifest, instead of lingering as a claim nobody re-checks. */
  if (!Object.values(VISUAL_ASSETS).some((asset) => asset.loop)) {
    lines.push("NOTE: the repository currently contains no video assets. Every");
    lines.push("environment renders poster-only until loops are produced.");
  }
  lines.push("");

  for (const m of manifest) {
    lines.push(`── ${m.environment} [${m.status}]`);
    lines.push(`   scene:    ${m.sceneDescription}`);
    lines.push(`   movement: ${m.movementDescription}`);
    lines.push(`   loop:     ${m.loopRequirements.join(" · ")}`);
    lines.push("");
  }

  return lines.join("\n");
}
