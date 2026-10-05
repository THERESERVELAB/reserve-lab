import { afterEach, describe, expect, it } from "vitest";

import {
  VISUAL_ASSETS,
  productionLoop,
  type ProductionLoop,
  type VisualAsset,
  type VisualLoop,
} from "@/lib/brand/asset-manifest";

import {
  CINEMATIC_ENVIRONMENTS,
  LOOP_ELEMENT_IDLE,
  LOOP_FADE_MS,
  RESERVE_MOTION,
  buildAssetManifest,
  cinematicConfig,
  formatAssetManifest,
  isLoopFailure,
  resolveLoopLayer,
  resolvePlayback,
  scaleDuration,
  type CinematicEnvironment,
  type LoopElementState,
  type LoopLayerInput,
  type MotionPreference,
  type PlaybackContext,
} from "../environments";

function ctx(over: Partial<PlaybackContext> = {}): PlaybackContext {
  return {
    motionPreference: "full",
    lowPower: false,
    offscreen: false,
    activeTask: false,
    viewport: "desktop",
    ...over,
  };
}

/** A loop exactly as `productionLoop` hands it over. */
const LOOP: ProductionLoop = { src: "/fake-loop.mp4", loopSeconds: 16 };

/* Registry fixture for the tests that need the real manifest to hold a loop.
   It borrows an approved plate and is removed after every test. */
const FIXTURE = "cinematic-loop-fixture";

const APPROVED_LOOP: VisualLoop = {
  desktopSrc: "/desktop.mp4",
  mobileSrc: "/mobile.mp4",
  status: "APPROVED",
  loopSeconds: 16,
};

function registerFixture(over: Partial<VisualAsset>): void {
  VISUAL_ASSETS[FIXTURE] = { ...VISUAL_ASSETS["apex-command"], id: FIXTURE, ...over };
}

afterEach(() => {
  delete VISUAL_ASSETS[FIXTURE];
});

/* ═══ Configuration completeness ═════════════════════════════════════════ */

describe("cinematic environments", () => {
  it("configures all ten environments", () => {
    expect(CINEMATIC_ENVIRONMENTS).toHaveLength(10);
    for (const id of CINEMATIC_ENVIRONMENTS) {
      expect(cinematicConfig(id).id).toBe(id);
    }
  });

  it("declares a reduced-motion, low-power and active-task behaviour for every environment", () => {
    for (const id of CINEMATIC_ENVIRONMENTS) {
      const c = cinematicConfig(id);
      expect(c.reducedMotionBehavior).toBeTruthy();
      expect(c.lowPowerBehavior).toBeTruthy();
      expect(c.activeTaskBehavior).toBeTruthy();
    }
  });

  it("declares no loop media, because loops belong to the asset manifest", () => {
    // A second map of media is how the plate and its focal point once disagreed.
    for (const id of CINEMATIC_ENVIRONMENTS) {
      expect(cinematicConfig(id)).not.toHaveProperty("desktopAsset");
      expect(cinematicConfig(id)).not.toHaveProperty("mobileAsset");
    }
  });

  it("declares separate desktop and mobile focal points", () => {
    for (const id of CINEMATIC_ENVIRONMENTS) {
      const c = cinematicConfig(id);
      expect(c.focalPoint.desktop).toBeTruthy();
      expect(c.focalPoint.mobile).toBeTruthy();
      // A mobile 9:16 composition is not the desktop centre crop.
      expect(c.focalPoint.mobile).not.toBe(c.focalPoint.desktop);
    }
  });

  it("keeps ambient loops inside the token bounds", () => {
    for (const id of CINEMATIC_ENVIRONMENTS) {
      const d = cinematicConfig(id).ambientLoopDurationSeconds;
      if (d == null) continue;
      expect(d).toBeGreaterThanOrEqual(RESERVE_MOTION.cinematic.ambientMinimum);
      expect(d).toBeLessThanOrEqual(RESERVE_MOTION.cinematic.ambientMaximum);
    }
  });

  it("quiets motion for the surfaces where it would harm the task", () => {
    // Logging sets, editing a protocol, and reading clinical data must not
    // compete with a moving background.
    expect(cinematicConfig("training-command").activeTaskBehavior).toBe("paused");
    expect(cinematicConfig("protocol-foundry").activeTaskBehavior).toBe("poster-only");
    expect(cinematicConfig("biomarker-vault").activeTaskBehavior).toBe("poster-only");
    expect(cinematicConfig("coach-operations").activeTaskBehavior).toBe("poster-only");
  });
});

/* ═══ Playback ═══════════════════════════════════════════════════════════ */

describe("playback resolution", () => {
  it("never plays video when no motion asset exists", () => {
    // No approved loop is the current state of the entire repository.
    for (const id of CINEMATIC_ENVIRONMENTS) {
      const d = resolvePlayback(cinematicConfig(id), ctx(), null);
      expect(d.playVideo).toBe(false);
      expect(d.source).toBeUndefined();
      expect(d.opacity).toBe(1);
      expect(d.reason).toContain("No motion asset");
    }
  });

  it("always returns a poster, in every branch", () => {
    const contexts: PlaybackContext[] = [
      ctx(),
      ctx({ offscreen: true }),
      ctx({ lowPower: true }),
      ctx({ activeTask: true }),
      ctx({ motionPreference: "static" }),
      ctx({ motionPreference: "reduced" }),
      ctx({ viewport: "mobile" }),
    ];
    for (const id of CINEMATIC_ENVIRONMENTS) {
      const c = cinematicConfig(id);
      for (const context of contexts) {
        for (const loop of [null, LOOP]) {
          const d = resolvePlayback(c, context, loop);
          const expected = context.viewport === "mobile" ? c.mobilePoster : c.desktopPoster;
          expect(d.poster).toBe(expected);
        }
      }
    }
  });

  it("pauses when the route or tab is hidden", () => {
    const d = resolvePlayback(cinematicConfig("personal-command"), ctx({ offscreen: true }), LOOP);
    expect(d.playVideo).toBe(false);
    expect(d.opacity).toBe(1);
  });

  it("honours a static motion preference", () => {
    const d = resolvePlayback(
      cinematicConfig("personal-command"),
      ctx({ motionPreference: "static" }),
      LOOP,
    );
    expect(d.playVideo).toBe(false);
    expect(d.reason).toContain("static");
  });

  it("resolves a reduced-motion static environment to a still", () => {
    const c = cinematicConfig("training-command");
    expect(c.reducedMotionBehavior).toBe("static");
    expect(resolvePlayback(c, ctx({ motionPreference: "reduced" }), LOOP).playVideo).toBe(false);
  });

  it("resolves the loop to a still under reduced motion in every environment", () => {
    // Bible §08: all motion dies under prefers-reduced-motion. `crossfade` and
    // `subtle-opacity` describe the still, never a moving loop.
    for (const id of CINEMATIC_ENVIRONMENTS) {
      const d = resolvePlayback(cinematicConfig(id), ctx({ motionPreference: "reduced" }), LOOP);
      expect(d.playVideo).toBe(false);
      expect(d.opacity).toBe(1);
    }
  });

  it("resolves a poster-only environment to a still in low-power mode", () => {
    const c = cinematicConfig("personal-command");
    expect(c.lowPowerBehavior).toBe("poster-only");
    const d = resolvePlayback(c, ctx({ lowPower: true }), LOOP);
    expect(d.playVideo).toBe(false);
    expect(d.reason).toContain("Low-power");
  });

  it("stops motion during an active task on training command", () => {
    const c = cinematicConfig("training-command");
    expect(c.activeTaskBehavior).toBe("paused");
    const d = resolvePlayback(c, ctx({ activeTask: true }), LOOP);
    expect(d.playVideo).toBe(false);
    expect(d.opacity).toBe(1);
    expect(d.reason).toContain("Active task");
  });

  it("resolves a poster-only active task to a still", () => {
    const c = cinematicConfig("biomarker-vault");
    expect(c.activeTaskBehavior).toBe("poster-only");
    expect(resolvePlayback(c, ctx({ activeTask: true }), LOOP).playVideo).toBe(false);
  });

  it("dims rather than stops where the task allows ambient motion", () => {
    const c = cinematicConfig("reserve-gate");
    expect(c.activeTaskBehavior).toBe("dimmed");
    const d = resolvePlayback(c, ctx({ activeTask: true }), LOOP);
    expect(d.playVideo).toBe(true);
    expect(d.source).toBe("/fake-loop.mp4");
    expect(d.opacity).toBe(0.35);
  });

  it("plays ambiently when nothing blocks it", () => {
    const d = resolvePlayback(cinematicConfig("personal-command"), ctx(), LOOP);
    expect(d.playVideo).toBe(true);
    expect(d.source).toBe("/fake-loop.mp4");
    expect(d.opacity).toBe(1);
  });

  it("uses the mobile loop on a mobile viewport rather than the desktop one", () => {
    registerFixture({ loop: APPROVED_LOOP });
    const d = resolvePlayback(
      cinematicConfig("personal-command"),
      ctx({ viewport: "mobile" }),
      productionLoop(FIXTURE, "mobile"),
    );
    expect(d.source).toBe("/mobile.mp4");
  });

  it("does not fall back to the desktop loop when a mobile loop is absent", () => {
    registerFixture({ loop: { ...APPROVED_LOOP, mobileSrc: null } });
    const d = resolvePlayback(
      cinematicConfig("personal-command"),
      ctx({ viewport: "mobile" }),
      productionLoop(FIXTURE, "mobile"),
    );
    expect(d.playVideo).toBe(false);
  });
});

/* ═══ Loop layer ═════════════════════════════════════════════════════════ */

describe("loop layer", () => {
  const PLAYS = resolvePlayback(cinematicConfig("personal-command"), ctx(), LOOP);
  const STILL = resolvePlayback(cinematicConfig("personal-command"), ctx({ offscreen: true }), LOOP);
  const DIMMED = resolvePlayback(cinematicConfig("reserve-gate"), ctx({ activeTask: true }), LOOP);

  const PLAYING: LoopElementState = { played: true, playing: true, failed: false };

  function layer(over: Partial<LoopLayerInput> = {}) {
    return resolveLoopLayer({
      mounted: true,
      decision: PLAYS,
      loop: LOOP,
      element: LOOP_ELEMENT_IDLE,
      ...over,
    });
  }

  it("renders nothing on the server or before mount", () => {
    expect(layer({ mounted: false })).toEqual({ render: false, play: false, opacity: 0 });
  });

  it("renders nothing without an approved loop or without a decision", () => {
    expect(layer({ loop: null }).render).toBe(false);
    expect(layer({ decision: undefined }).render).toBe(false);
  });

  it("renders nothing while the decision is a still", () => {
    expect(layer({ decision: STILL })).toEqual({ render: false, play: false, opacity: 0 });
  });

  it("refuses a decision resolved against a different loop", () => {
    expect(layer({ loop: { src: "/another-room.mp4", loopSeconds: 12 } }).render).toBe(false);
  });

  it("mounts invisible and shows the loop only once it is actually playing", () => {
    expect(layer()).toEqual({ render: true, play: true, opacity: 0 });
    expect(layer({ element: PLAYING }).opacity).toBe(1);
  });

  it("carries a dimmed decision's opacity into the loop layer", () => {
    expect(layer({ decision: DIMMED, element: PLAYING }).opacity).toBe(0.35);
  });

  it("pauses and fades out, still mounted, when a playing loop's decision turns to a still", () => {
    expect(layer({ decision: STILL, element: PLAYING })).toEqual({
      render: true,
      play: false,
      opacity: 0,
    });
  });

  it("unmounts a loop that never played when its decision turns to a still", () => {
    expect(layer({ decision: STILL, element: LOOP_ELEMENT_IDLE }).render).toBe(false);
  });

  it("stays on the poster after a failure and never retries that source", () => {
    const failedLoading: LoopElementState = { played: false, playing: false, failed: true };
    const failedOnScreen: LoopElementState = { played: true, playing: false, failed: true };
    expect(layer({ element: failedLoading })).toEqual({ render: false, play: false, opacity: 0 });
    // Once on screen, it stays mounted just long enough to fade to the poster.
    expect(layer({ element: failedOnScreen })).toEqual({ render: true, play: false, opacity: 0 });
  });

  it("treats every error as a failure, and a stall only when playback cannot continue", () => {
    expect(isLoopFailure("error", 4)).toBe(true);
    expect(isLoopFailure("stalled", 0)).toBe(true); // HAVE_NOTHING
    expect(isLoopFailure("stalled", 2)).toBe(true); // HAVE_CURRENT_DATA
    expect(isLoopFailure("stalled", 3)).toBe(false); // HAVE_FUTURE_DATA
    expect(isLoopFailure("stalled", 4)).toBe(false); // HAVE_ENOUGH_DATA
  });

  it("fades over at least a second, as environment changes must", () => {
    expect(LOOP_FADE_MS).toBeGreaterThanOrEqual(1000);
  });
});

/* ═══ Motion tokens ══════════════════════════════════════════════════════ */

describe("motion tokens", () => {
  it("keeps every token inside its documented range", () => {
    expect(RESERVE_MOTION.micro.fast).toBeGreaterThanOrEqual(120);
    expect(RESERVE_MOTION.micro.standard).toBeLessThanOrEqual(220);
    expect(RESERVE_MOTION.interface.enter).toBeGreaterThanOrEqual(220);
    expect(RESERVE_MOTION.interface.route).toBeLessThanOrEqual(800);
    expect(RESERVE_MOTION.cinematic.activationReveal).toBeGreaterThanOrEqual(1200);
    expect(RESERVE_MOTION.cinematic.activationReveal).toBeLessThanOrEqual(2500);
  });

  it("collapses every duration to zero for a static preference", () => {
    expect(scaleDuration(500, "static")).toBe(0);
  });

  it("shortens rather than removes motion when reduced", () => {
    const reduced = scaleDuration(400, "reduced");
    expect(reduced).toBeGreaterThan(0);
    expect(reduced).toBeLessThan(400);
  });

  it("scales monotonically across preferences", () => {
    const prefs: MotionPreference[] = ["full", "balanced", "reduced", "static"];
    const values = prefs.map((p) => scaleDuration(400, p));
    for (let i = 1; i < values.length; i += 1) {
      expect(values[i]).toBeLessThanOrEqual(values[i - 1]);
    }
  });
});

/* ═══ Asset manifest ═════════════════════════════════════════════════════ */

describe("asset manifest", () => {
  const manifest = buildAssetManifest();

  it("covers every environment", () => {
    expect(manifest).toHaveLength(CINEMATIC_ENVIRONMENTS.length);
  });

  it("marks an environment with no poster as missing", () => {
    const missing = manifest.filter((m) => m.status === "missing").map((m) => m.environment);
    // These three have no plate on disk today.
    expect(missing).toEqual(
      expect.arrayContaining<CinematicEnvironment>([
        "profile-activation",
        "protocol-foundry",
        "coach-operations",
      ]),
    );
  });

  it("reports available only where an approved plate has approved loops on both viewports", () => {
    // Truthfulness check: since 2026-09-16 the five rooms with 16:9 AND 9:16 loops are
    // finished cinematics; nothing else may claim to be one.
    const finished = new Set(
      Object.values(VISUAL_ASSETS)
        .filter((a) => a.status === "APPROVED" && a.mobileSrc && productionLoop(a.id, "desktop") && productionLoop(a.id, "mobile"))
        .map((a) => a.environment),
    );
    expect(finished.size).toBeGreaterThan(0);
    for (const m of manifest) {
      expect(m.status === "available", m.environment).toBe(finished.has(m.environment));
    }
  });

  it("derives status from the visual asset manifest, not from this config", () => {
    const status = () =>
      buildAssetManifest().find((m) => m.environment === "profile-activation")?.status;
    const finished = {
      environment: "profile-activation",
      mobileSrc: "/fixture-9x16.webp",
      loop: APPROVED_LOOP,
    };

    // No plate on disk today.
    expect(status()).toBe("missing");

    // An approved plate with its 9:16 crop and approved loops for both viewports.
    registerFixture(finished);
    expect(status()).toBe("available");

    // A loop still in draft does not finish it.
    registerFixture({ ...finished, loop: { ...APPROVED_LOOP, status: "DRAFT" } });
    expect(status()).toBe("needs-mobile-crop");

    // Nor does anything on a plate still in review.
    registerFixture({ ...finished, status: "REVIEW" });
    expect(status()).toBe("missing");
  });

  it("requires a 9:16 mobile composition for every environment", () => {
    for (const m of manifest) {
      expect(m.mobileAspectRatio).toBe("9:16");
      expect(m.safeTextAreas.join(" ")).toContain("home indicator");
    }
  });

  it("forbids real names and baked-in text everywhere", () => {
    for (const m of manifest) {
      const forbidden = m.forbiddenElements.join(" ").toLowerCase();
      expect(forbidden).toContain("federation");
      expect(forbidden).toContain("text baked");
    }
  });

  it("requires a silent, non-flashing loop and a poster fallback", () => {
    for (const m of manifest) {
      const loop = m.loopRequirements.join(" ").toLowerCase();
      expect(loop).toContain("no audio");
      expect(loop).toContain("no flashing");
      expect(m.fallbackRequirements.join(" ").toLowerCase()).toContain("poster");
    }
  });

  it("no longer claims there is no video once the Apex loop is registered", () => {
    expect(formatAssetManifest(manifest)).not.toContain("no video assets");
  });

  it("stops saying so once a loop enters the manifest", () => {
    registerFixture({ loop: { ...APPROVED_LOOP, status: "DRAFT" } });
    expect(formatAssetManifest()).not.toContain("no video assets");
  });
});
