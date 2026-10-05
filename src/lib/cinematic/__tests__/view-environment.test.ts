import { afterEach, describe, expect, it } from "vitest";

import type { DashboardView } from "@/lib/athlete-store";
import { VISUAL_ASSETS, type VisualLoop } from "@/lib/brand/asset-manifest";

import { cinematicConfig } from "../environments";
import {
  VIEW_ENVIRONMENT,
  environmentForView,
  resolveShellCinematic,
  type ShellCinematicInput,
} from "../view-environment";

function input(over: Partial<ShellCinematicInput> = {}): ShellCinematicInput {
  return {
    view: "dashboard",
    // The plate the shell draws for the dashboard.
    assetId: "apex-command",
    liveSessionActive: false,
    motionPreference: "full",
    lowPower: false,
    offscreen: false,
    viewport: "desktop",
    ...over,
  };
}

/* ═══ Mapping ════════════════════════════════════════════════════════════ */

describe("view to environment mapping", () => {
  it("maps the core member views to their environments", () => {
    expect(environmentForView("dashboard")).toBe("personal-command");
    expect(environmentForView("training")).toBe("training-command");
    expect(environmentForView("nutrition")).toBe("nutrition-atelier");
    expect(environmentForView("recovery")).toBe("recovery-chamber");
    expect(environmentForView("bloodwork")).toBe("biomarker-vault");
    expect(environmentForView("protocol-command")).toBe("protocol-foundry");
    expect(environmentForView("response-profile")).toBe("response-intelligence");
    expect(environmentForView("my-coach")).toBe("coach-operations");
  });

  it("falls back to a neutral environment rather than crashing on an unmapped view", () => {
    expect(environmentForView("journal" as DashboardView)).toBe("personal-command");
    expect(environmentForView("totally-unknown" as DashboardView)).toBe("personal-command");
  });

  it("only ever maps to environments that have a configuration", () => {
    for (const env of Object.values(VIEW_ENVIRONMENT)) {
      expect(cinematicConfig(env!).id).toBe(env);
    }
  });
});

/* ═══ Mobile composition ═════════════════════════════════════════════════ */

describe("mobile is not a desktop centre crop", () => {
  it("uses a different focal point on a phone", () => {
    const desktop = resolveShellCinematic(input({ viewport: "desktop" }));
    const mobile = resolveShellCinematic(input({ viewport: "mobile" }));
    expect(mobile.focalPoint).not.toBe(desktop.focalPoint);
  });

  it("gives every mapped view its own mobile focal point", () => {
    for (const view of Object.keys(VIEW_ENVIRONMENT) as DashboardView[]) {
      const r = resolveShellCinematic(input({ view, viewport: "mobile" }));
      expect(r.focalPoint).toBeTruthy();
      expect(r.focalPoint).toBe(cinematicConfig(environmentForView(view)).focalPoint.mobile);
    }
  });
});

/* ═══ Active-task quieting ═══════════════════════════════════════════════ */

describe("logging sets quiets the environment", () => {
  it("stops decorative motion during a live training session", () => {
    const idle = resolveShellCinematic(input({ view: "training" }));
    const live = resolveShellCinematic(input({ view: "training", liveSessionActive: true }));
    expect(idle.animate).toBe(true);
    expect(live.animate).toBe(false);
  });

  it("dims the plate during a live session", () => {
    const idle = resolveShellCinematic(input({ view: "training" }));
    const live = resolveShellCinematic(input({ view: "training", liveSessionActive: true }));
    expect(live.plateOpacity).toBeLessThan(idle.plateOpacity);
    expect(live.plateOpacity).toBeGreaterThan(0);
  });

  it("keeps the plate visible rather than blanking the screen", () => {
    const live = resolveShellCinematic(input({ view: "training", liveSessionActive: true }));
    // Quieting must never look like a broken or empty background.
    expect(live.playback.poster).toBeTruthy();
  });

  it("stills the training room outright during a live session, but not Apex or Recovery", () => {
    expect(resolveShellCinematic(input({ view: "training" })).stilledByTask).toBe(false);
    expect(resolveShellCinematic(input({ view: "training", liveSessionActive: true })).stilledByTask).toBe(true);
    for (const view of ["dashboard", "recovery"] as DashboardView[]) {
      expect(resolveShellCinematic(input({ view, liveSessionActive: true })).stilledByTask).toBe(false);
    }
  });

  it("quiets the foundry and the vault too, where precision matters", () => {
    for (const view of ["protocol-command", "bloodwork"] as DashboardView[]) {
      expect(resolveShellCinematic(input({ view, liveSessionActive: true })).animate).toBe(false);
    }
  });
});

/* ═══ Accessibility and power ════════════════════════════════════════════ */

describe("motion accessibility", () => {
  it("stops all decorative motion for a static preference", () => {
    for (const view of Object.keys(VIEW_ENVIRONMENT) as DashboardView[]) {
      expect(resolveShellCinematic(input({ view, motionPreference: "static" })).animate).toBe(false);
    }
  });

  it("stops motion on reduced preference where the environment declares static", () => {
    // training-command declares reducedMotionBehavior: "static".
    expect(
      resolveShellCinematic(input({ view: "training", motionPreference: "reduced" })).animate,
    ).toBe(false);
  });

  it("keeps the plate at full strength under reduced motion", () => {
    const full = resolveShellCinematic(input({ view: "training" }));
    const reduced = resolveShellCinematic(input({ view: "training", motionPreference: "reduced" }));
    // Reduced motion should still look premium — it calms movement, not the art.
    expect(reduced.plateOpacity).toBe(full.plateOpacity);
  });

  it("stops motion when the tab or route is hidden", () => {
    expect(resolveShellCinematic(input({ offscreen: true })).animate).toBe(false);
  });

  it("stops motion in low-power mode", () => {
    expect(resolveShellCinematic(input({ view: "training", lowPower: true })).animate).toBe(false);
  });

  it("plays video only for plates with an approved loop, each viewport its own cut", () => {
    // Every view, over every plate the shell could draw, on both viewports. The five
    // room loops (Apex, Training, Recovery, Nutrition, Schedule) each have a 16:9 and
    // a 9:16 cut. The Compound wellness suite is 16:9 only — a phone gets its still.
    const looped = new Set(["apex-command", "training-command", "recovery-chamber", "nutrition-command", "schedule-command"]);
    for (const view of Object.keys(VIEW_ENVIRONMENT) as DashboardView[]) {
      for (const assetId of Object.keys(VISUAL_ASSETS)) {
        for (const viewport of ["desktop", "mobile"] as const) {
          const playback = resolveShellCinematic(input({ view, assetId, viewport })).playback;
          const plays = assetId === "compound-suite" ? viewport === "desktop" : looped.has(assetId);
          expect(playback.playVideo, `${assetId} ${viewport}`).toBe(plays);
          if (playback.playVideo) {
            const shape = assetId === "compound-suite" ? "16x9" : viewport === "mobile" ? "9x16" : "16x9";
            expect(playback.source).toBe(`/brand/loops/${assetId}-${shape}.mp4`);
          }
        }
      }
    }
  });

  it("plays each hour's own clip, and never another hour's", () => {
    /* The decision is resolved for a daypart because the renderer resolves the
       loop for the SAME daypart and refuses a decision that names a different
       file. A decision stuck at "day" would silently kill all night motion. */
    /* From the manifest, not by hand: all three rooms named here had their
       night clips pulled on 2026-10-01, and a hand-written list would have
       asserted motion that is no longer served. Whatever is APPROVED is what
       is held to the contract. */
    const nights = Object.keys(VISUAL_ASSETS)
      .filter((id) => VISUAL_ASSETS[id as keyof typeof VISUAL_ASSETS].dayparts?.night?.loop?.status === "APPROVED")
      .map((id) => [id, VISUAL_ASSETS[id as keyof typeof VISUAL_ASSETS].dayparts!.night!.loop!.desktopSrc] as const);
    expect(nights.length, "night clips to check").toBeGreaterThan(0);
    for (const [assetId, src] of nights) {
      const atNight = resolveShellCinematic(input({ assetId, daypart: "night" })).playback;
      expect(atNight.playVideo, assetId).toBe(true);
      expect(atNight.source, assetId).toBe(src);
      /* A room with a night clip and NO day clip of its own stays still by
         day. Rooms that have both (training-command, training-floor) move at
         both hours, each from its own file — which is the rule this test is
         really about, so it checks the file rather than the stillness. */
      const dayLoop = VISUAL_ASSETS[assetId as keyof typeof VISUAL_ASSETS].loop;
      const byDay = resolveShellCinematic(input({ assetId, daypart: "day" })).playback;
      if (dayLoop?.status === "APPROVED") {
        expect(byDay.source, assetId).toBe(dayLoop.desktopSrc);
        expect(byDay.source, assetId).not.toBe(src);
      } else {
        expect(byDay.playVideo, assetId).toBe(false);
        expect(resolveShellCinematic(input({ assetId })).playback.playVideo, assetId).toBe(false);
      }
    }
  });

  it("holds a room with no clip for this hour on a still, not on another hour's motion", () => {
    /* Compound has an approved dawn PLATE and no dawn clip — every night
       gained one on 2026-09-30, dawn still has none anywhere. The rule is
       unchanged: the right room without motion, never the day loop over
       another hour's plate. */
    const atDawn = resolveShellCinematic(input({ assetId: "compound-suite", daypart: "dawn" })).playback;
    expect(atDawn.playVideo).toBe(false);
    expect(atDawn.source).toBeUndefined();
    expect(resolveShellCinematic(input({ assetId: "compound-suite" })).playback.playVideo).toBe(true);
  });
});

/* ═══ Missing assets ═════════════════════════════════════════════════════ */

describe("environments without a plate", () => {
  it("reports zero plate opacity rather than rendering a broken image", () => {
    // protocol-foundry and coach-operations have no plate on disk.
    for (const view of ["protocol-command", "my-coach"] as DashboardView[]) {
      const r = resolveShellCinematic(input({ view }));
      expect(r.playback.poster).toBe("");
      expect(r.plateOpacity).toBe(0);
    }
  });

  it("still resolves a focal point so layout stays stable", () => {
    const r = resolveShellCinematic(input({ view: "my-coach" }));
    expect(r.focalPoint).toBeTruthy();
  });
});

/* ═══ Loops ══════════════════════════════════════════════════════════════ */

describe("the shell's loop is the loop of the plate on screen", () => {
  /* A registry fixture borrowing an approved plate, removed after every test. */
  const FIXTURE = "shell-loop-fixture";
  const APPROVED: VisualLoop = {
    desktopSrc: "/desktop.mp4",
    mobileSrc: "/mobile.mp4",
    status: "APPROVED",
    loopSeconds: 18,
  };

  function registerLoop(loop: VisualLoop): void {
    VISUAL_ASSETS[FIXTURE] = { ...VISUAL_ASSETS["apex-command"], id: FIXTURE, loop };
  }

  afterEach(() => {
    delete VISUAL_ASSETS[FIXTURE];
  });

  it("plays the approved loop registered on the shell's asset, per viewport", () => {
    registerLoop(APPROVED);
    expect(resolveShellCinematic(input({ assetId: FIXTURE })).playback.source).toBe("/desktop.mp4");
    expect(
      resolveShellCinematic(input({ assetId: FIXTURE, viewport: "mobile" })).playback.source,
    ).toBe("/mobile.mp4");
  });

  it("never borrows a loop registered on a different plate", () => {
    registerLoop(APPROVED);
    // Same view and same environment policy, but the plate on screen has no loop.
    expect(resolveShellCinematic(input({ assetId: "biomarkers-lab" })).playback.playVideo).toBe(false);
    // A plate with its own loop plays its own source, never the fixture's.
    expect(resolveShellCinematic(input({ assetId: "training-command" })).playback.source).toBe("/brand/loops/training-command-16x9.mp4");
    expect(resolveShellCinematic(input({ assetId: null })).playback.playVideo).toBe(false);
  });

  it("keeps a phone on its still when only a desktop loop exists", () => {
    registerLoop({ ...APPROVED, mobileSrc: null });
    const phone = resolveShellCinematic(input({ assetId: FIXTURE, viewport: "mobile" }));
    expect(phone.playback.playVideo).toBe(false);
    expect(phone.plateOpacity).toBeGreaterThan(0);
  });

  it("stops the loop for a live session where the environment pauses", () => {
    registerLoop(APPROVED);
    const live = resolveShellCinematic(
      input({ view: "training", assetId: FIXTURE, liveSessionActive: true }),
    );
    expect(live.playback.playVideo).toBe(false);
  });

  it("dims a loop without dimming the poster beneath it", () => {
    // response-profile belongs to response-intelligence, which dims during an active task.
    registerLoop(APPROVED);
    const live = input({ view: "response-profile", assetId: FIXTURE, liveSessionActive: true });
    const withLoop = resolveShellCinematic(live);
    const withoutLoop = resolveShellCinematic({ ...live, assetId: null });
    expect(withLoop.playback.playVideo).toBe(true);
    expect(withLoop.playback.opacity).toBe(0.35);
    expect(withLoop.plateQuieting).toBe(withoutLoop.plateQuieting);
  });
});
