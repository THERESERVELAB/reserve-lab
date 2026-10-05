/* ════════════════════════════════════════════════════════════════════════
   VIEW → CINEMATIC ENVIRONMENT.

   The ambient background system already knew which "room" a view belonged to.
   What it did not know was anything the cinematic contract defines: the
   environment's mobile focal point, whether motion should quiet during an
   active task, or what low power should do.

   This module is the bridge. It is pure — no React, no store — so the
   mapping and the resulting playback decision are both testable without
   mounting the app.
   ════════════════════════════════════════════════════════════════════════ */

import type { DashboardView } from "@/lib/athlete-store";
import { productionLoop, type Daypart } from "@/lib/brand/asset-manifest";

import {
  cinematicConfig,
  resolvePlayback,
  type CinematicEnvironment,
  type MotionPreference,
  type PlaybackDecision,
} from "./environments";

/**
 * Which of the ten cinematic environments a member view belongs to.
 *
 * Views not listed fall back to `personal-command`, which is the neutral
 * command atmosphere — a missing entry must never crash the shell or leave a
 * view with no environment.
 */
export const VIEW_ENVIRONMENT: Partial<Record<DashboardView, CinematicEnvironment>> = {
  dashboard: "personal-command",
  "my-coach": "coach-operations",

  training: "training-command",
  "mesocycle-planner": "training-command",
  "performance-intelligence": "training-command",
  "program-horizon": "training-command",

  nutrition: "nutrition-atelier",

  recovery: "recovery-chamber",

  "protocol-command": "protocol-foundry",
  "lifestyle-builder": "protocol-foundry",

  bloodwork: "biomarker-vault",
  "biomarker-intelligence": "biomarker-vault",
  supplements: "biomarker-vault",
  "enhanced-monitor": "biomarker-vault",

  "response-profile": "response-intelligence",
  "ai-strategist": "response-intelligence",

  /* Reserve Women — mapped by domain so each keeps a coherent atmosphere. */
};

export function environmentForView(view: DashboardView): CinematicEnvironment {
  return VIEW_ENVIRONMENT[view] ?? "personal-command";
}

/* ─── Shell decision ──────────────────────────────────────────────────── */

export type ShellCinematicInput = {
  view: DashboardView;
  /**
   * Manifest id of the plate the shell is rendering, or null for a room with
   * no plate. The loop is looked up by THIS id, never by environment, so the
   * motion on screen can only be the motion of the still on screen.
   */
  assetId: string | null;
  /**
   * The member's hour. The loop is looked up for THIS daypart as well as this
   * id, because a room's night clip and its day clip are different files: a
   * decision resolved at "day" would name the day loop, the renderer would
   * resolve the night one, and `resolveLoopLayer` refuses a decision that does
   * not name the loop it would mount — so night motion would silently never
   * play. Defaults to "day", which is also what `productionPlate` falls back
   * to when a variant is unapproved.
   */
  daypart?: Daypart;
  /** True while the athlete is logging sets in a live session. */
  liveSessionActive: boolean;
  motionPreference: MotionPreference;
  lowPower: boolean;
  /** Browser tab or route hidden. */
  offscreen: boolean;
  viewport: "desktop" | "mobile";
};

export type ShellCinematic = {
  environment: CinematicEnvironment;
  /** Handed to the renderer, which mounts a loop only when this plays. */
  playback: PlaybackDecision;
  /** CSS background-position for the plate — 9:16 is NOT a desktop centre crop. */
  focalPoint: string;
  /** Plate opacity after quieting. 0 when the environment has no plate. */
  plateOpacity: number;
  /**
   * The quieting multiplier ALONE, independent of whether this environment
   * happens to own a poster.
   *
   * `plateOpacity` conflates two questions — "how loud should the plate be?"
   * and "does this environment have one?" — which is fine while the plate and
   * the environment come from the same place. They no longer do: the shell now
   * resolves its plate through the visual asset manifest, which covers views
   * this module has no environment entry for. Those views were previously
   * rendering a plate at an opacity computed for a DIFFERENT environment.
   *
   * Callers that source their own plate should multiply by this and let the
   * renderer decide whether an asset exists.
   */
  plateQuieting: number;
  /** Whether decorative motion (drift, breath, motifs) should run. */
  animate: boolean;
  /**
   * True when a live session stills this environment outright (its active-task
   * behaviour is "paused" or "poster-only"). A living room reads this to hold
   * its light: no daypart cross-fade, no energy shift, no tint change until the
   * session ends.
   */
  stilledByTask: boolean;
};

/** The plate opacity the shell uses when nothing is quieting it. */
/* Owner 2026-09-18: the room and its loop must read through the glass. */
const BASE_PLATE_OPACITY = 0.72;

/**
 * Whether a live session stills this view's room outright — the same answer
 * `resolveShellCinematic` returns as `stilledByTask`, without needing a plate.
 *
 * It exists because the shell has an ordering problem: a living room holds its
 * LIGHT while a session is live, the light carries the daypart, and from
 * 2026-09-24 the daypart chooses which plate is cast. Asking the full decision
 * first would mean asking it for a plate that has not been chosen yet. This
 * question depends only on the view and the session, so it can be answered
 * before the clock and the cycle never forms.
 */
export function taskStillsRoom(view: DashboardView, liveSessionActive: boolean): boolean {
  const behavior = cinematicConfig(environmentForView(view)).activeTaskBehavior;
  return liveSessionActive && (behavior === "paused" || behavior === "poster-only");
}

/**
 * One decision for the whole shell. Quieting is deliberately layered: an
 * active task dims the plate AND stops decorative motion, because a moving
 * background behind set logging is the thing most likely to make execution
 * feel slower.
 */
export function resolveShellCinematic(input: ShellCinematicInput): ShellCinematic {
  const environment = environmentForView(input.view);
  const config = cinematicConfig(environment);

  /* Policy comes from the environment; the loop comes from the plate. The
     manifest resolves it for the same viewport AND the same daypart the
     decision is made for, so a phone can never be handed the desktop loop and
     no hour can be handed another hour's. */
  const loop = input.assetId
    ? productionLoop(input.assetId, input.viewport, input.daypart ?? "day")
    : null;

  const playback = resolvePlayback(
    config,
    {
      motionPreference: input.motionPreference,
      lowPower: input.lowPower,
      offscreen: input.offscreen,
      activeTask: input.liveSessionActive,
      viewport: input.viewport,
    },
    loop,
  );

  const focalPoint =
    input.viewport === "mobile" ? config.focalPoint.mobile : config.focalPoint.desktop;

  const hasPlate = playback.poster.length > 0;

  /* Motion stops for a static preference, for low power, and whenever the
     environment declares that an active task should pause or flatten it.
     `taskStillsRoom` is the same question asked without a plate; both read the
     one config field, so they cannot drift apart. */
  const quietedByTask = taskStillsRoom(input.view, input.liveSessionActive);

  const animate =
    !quietedByTask &&
    !input.offscreen &&
    !(input.lowPower && config.lowPowerBehavior === "poster-only") &&
    input.motionPreference !== "static" &&
    !(input.motionPreference === "reduced" && config.reducedMotionBehavior === "static");

  /* The decision's own opacity is deliberately NOT applied here. It belongs to
     the loop layer, which sits INSIDE the plate's layer: multiplying it in here
     as well would dim a dimmed loop twice, and would darken the poster behind
     a loop that failed or never started. */
  const plateQuieting = BASE_PLATE_OPACITY * (input.liveSessionActive ? 0.45 : 1);

  const plateOpacity = hasPlate ? plateQuieting : 0;

  return {
    environment,
    playback,
    focalPoint,
    plateOpacity,
    plateQuieting,
    animate,
    stilledByTask: quietedByTask,
  };
}
