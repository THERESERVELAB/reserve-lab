import { existsSync } from "node:fs";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { RESERVE_MOTION } from "@/lib/cinematic/environments";
import { LOOP_PLAYBACK_RATE } from "@/lib/cinematic/loop-crossfade";

import { LIBRARY_IMAGES } from "../library";

import {
  VISUAL_ASSETS,
  effectiveLoopSeconds,
  hasDaypartPlates,
  mobileCropShotList,
  productionLoop,
  productionPlate,
  type AssetStatus,
  type Daypart,
  type VisualAsset,
  type VisualLoop,
} from "../asset-manifest";

/** The plates that carry an approved loop. */
const LOOP_ROOMS = ["apex-command", "training-command", "recovery-chamber", "nutrition-command", "schedule-command"] as const;

/* A registry fixture, removed after every test. It borrows a real approved
   plate so only the fields under test differ from production data. */
const FIXTURE = "loop-gate-fixture";

const APPROVED_LOOP: VisualLoop = {
  desktopSrc: "/brand/loops/fixture-desktop.mp4",
  mobileSrc: "/brand/loops/fixture-mobile.mp4",
  status: "APPROVED",
  loopSeconds: 16,
};

const NOT_APPROVED: AssetStatus[] = ["DRAFT", "REVIEW", "RETIRED"];

function register(over: Partial<VisualAsset>): void {
  VISUAL_ASSETS[FIXTURE] = { ...VISUAL_ASSETS["apex-command"], id: FIXTURE, ...over };
}

afterEach(() => {
  delete VISUAL_ASSETS[FIXTURE];
});

/* ═══ Loop gate ══════════════════════════════════════════════════════════ */

describe("production loop gate", () => {
  it("serves an approved loop on an approved plate", () => {
    register({ loop: APPROVED_LOOP });
    expect(productionLoop(FIXTURE, "desktop")).toEqual({
      src: "/brand/loops/fixture-desktop.mp4",
      loopSeconds: 16,
    });
    expect(productionLoop(FIXTURE, "mobile")).toEqual({
      src: "/brand/loops/fixture-mobile.mp4",
      loopSeconds: 16,
    });
  });

  it("refuses every loop on a plate that is not approved", () => {
    for (const status of NOT_APPROVED) {
      register({ status, loop: APPROVED_LOOP });
      expect(productionLoop(FIXTURE, "desktop")).toBeNull();
      expect(productionLoop(FIXTURE, "mobile")).toBeNull();
    }
  });

  it("refuses a loop that is not approved itself, while its approved plate still ships", () => {
    for (const status of NOT_APPROVED) {
      register({ loop: { ...APPROVED_LOOP, status } });
      expect(productionPlate(FIXTURE, "desktop")).not.toBeNull();
      expect(productionLoop(FIXTURE, "desktop")).toBeNull();
      expect(productionLoop(FIXTURE, "mobile")).toBeNull();
    }
  });

  it("never serves the desktop loop to a phone", () => {
    register({ loop: { ...APPROVED_LOOP, mobileSrc: null } });
    expect(productionLoop(FIXTURE, "desktop")?.src).toBe("/brand/loops/fixture-desktop.mp4");
    expect(productionLoop(FIXTURE, "mobile")).toBeNull();
    // The phone keeps its still.
    expect(productionPlate(FIXTURE, "mobile")).not.toBeNull();
  });

  it("refuses a viewport the loop has no source for", () => {
    register({ loop: { ...APPROVED_LOOP, desktopSrc: null } });
    expect(productionLoop(FIXTURE, "desktop")).toBeNull();
    expect(productionLoop(FIXTURE, "mobile")?.src).toBe("/brand/loops/fixture-mobile.mp4");
  });

  it("returns null for a plate without a loop and for an unknown asset", () => {
    // The fixture copies the Apex plate, which now carries a real loop, so strip it.
    register({ loop: undefined });
    expect(productionLoop(FIXTURE, "desktop")).toBeNull();
    expect(productionLoop("no-such-asset", "desktop")).toBeNull();
  });
});

/* ═══ Registry ═══════════════════════════════════════════════════════════ */

describe("visual asset registry", () => {
  it("ships the five room loops, each viewport its own cut, and every other plate as a still", () => {
    // 16:9: Apex (2026-09-14), Training, Recovery, Nutrition, Schedule (2026-09-16). 9:16: all five (2026-09-16).
    for (const id of LOOP_ROOMS) {
      expect(productionLoop(id, "desktop")).toEqual({ src: `/brand/loops/${id}-16x9.mp4`, loopSeconds: 8 });
      expect(productionLoop(id, "mobile")).toEqual({ src: `/brand/loops/${id}-9x16.mp4`, loopSeconds: 8 });
    }
    for (const asset of Object.values(VISUAL_ASSETS)) {
      if ((LOOP_ROOMS as readonly string[]).includes(asset.id)) continue;
      /* The Compound wellness suite is the sixth room with motion, and the
         only one that is 16:9-only: no phone composition of it exists, so a
         phone is served its still and never the wide clip. */
      if (asset.id === "compound-suite") {
        expect(productionLoop(asset.id, "desktop")).toEqual({
          src: "/brand/loops/compound-suite-16x9.mp4",
          loopSeconds: 8,
        });
        expect(productionLoop(asset.id, "mobile")).toBeNull();
        continue;
      }
      /* The one other clip is the chef kitchen take, registered in REVIEW. */
      if (asset.id === "chef-kitchen") expect(asset.loop?.status).toBe("REVIEW");
      else expect(asset.loop).toBeUndefined();
      expect(productionLoop(asset.id, "desktop")).toBeNull();
      expect(productionLoop(asset.id, "mobile")).toBeNull();
    }
  });

  it("gives every approved plate its own 9:16 on disk, and serves it to a phone", () => {
    // 2026-09-15: every room extended to 9:16 with Adobe generative expand.
    const all = Object.values(VISUAL_ASSETS).filter((asset) => asset.status === "APPROVED");
    // 9 rooms, the five empty-room plates cast 2026-09-17, and the Compound
    // wellness suite cast 2026-09-24 — which is the one that still owes a
    // phone composition, so it is held to the shot list below instead.
    expect(all.length).toBe(15);
    const approved = all.filter((asset) => asset.id !== "compound-suite");
    expect(approved.length).toBe(14);
    for (const asset of approved) {
      expect(asset.mobileSrc, asset.id).toMatch(/-9x16\.webp$/);
      expect(existsSync(join(process.cwd(), "public", asset.mobileSrc!)), asset.mobileSrc!).toBe(true);
      expect(asset.mobileSrc).not.toBe(asset.desktopSrc);
      expect(productionPlate(asset.id, "mobile")).toMatchObject({
        src: asset.mobileSrc,
        focalPoint: asset.focalPoint.mobile,
        daypart: "day",
      });
      expect(productionPlate(asset.id, "desktop")?.src).toBe(asset.desktopSrc);
    }
    /* The shot list is the honest record of what a phone is still owed. It
       was empty until the wellness suite was cast; the room is worth having
       on a phone as a still today rather than withheld until its 9:16 exists,
       and the list is what stops that being forgotten. */
    expect(mobileCropShotList().map((asset) => asset.id)).toEqual(["compound-suite"]);
    /* A phone is still served the room — the 16:9 plate at the mobile focal
       point — and never the 16:9 CLIP. */
    expect(productionPlate("compound-suite", "mobile")).toMatchObject({
      src: VISUAL_ASSETS["compound-suite"].desktopSrc,
      focalPoint: VISUAL_ASSETS["compound-suite"].focalPoint.mobile,
    });
    expect(productionLoop("compound-suite", "mobile")).toBeNull();
  });

  it("gives every night plate of a room with a 9:16 its own night 9:16", () => {
    for (const asset of Object.values(VISUAL_ASSETS)) {
      if (!asset.mobileSrc) continue;
      for (const [daypart, variant] of Object.entries(asset.dayparts ?? {})) {
        if (!variant) continue;
        expect(variant.mobileSrc, `${asset.id} ${daypart}`).toMatch(/-(night|dawn)-9x16\.webp$/);
        expect(variant.mobileSrc, `${asset.id} ${daypart}`).toContain(`-${daypart}-`);
        expect(variant.mobileSrc).not.toBe(asset.mobileSrc);
        /* A file on disk is still held to the naming above, but only an
           APPROVED variant is served. training-floor's night was retired
           2026-09-24 and must fall back to the day plate, not render. */
        const served = productionPlate(asset.id, "mobile", daypart as Daypart)?.src;
        if (variant.status === "APPROVED") expect(served, `${asset.id} ${daypart}`).toBe(variant.mobileSrc);
        else expect(served, `${asset.id} ${daypart} is ${variant.status}`).toBe(asset.mobileSrc);
      }
    }
  });

  it("keeps every registered loop inside the ambient window, measured as it plays on screen", () => {
    // The loop brief is 6–20 seconds of motion the member sees. Loops play slowed
    // (LOOP_PLAYBACK_RATE, 0.6×), so the window is held against loopSeconds / rate.
    const { ambientMinimum, ambientMaximum } = RESERVE_MOTION.cinematic;
    const loops = [
      ...Object.values(VISUAL_ASSETS).flatMap((asset) => [
        asset.loop,
        ...Object.values(asset.dayparts ?? {}).map((variant) => variant?.loop),
      ]),
      ...Object.values(LIBRARY_IMAGES).map((image) => image.loop),
    ].filter((loop): loop is VisualLoop => Boolean(loop));
    expect(loops.length).toBeGreaterThan(5);
    for (const loop of loops) {
      const seconds = effectiveLoopSeconds(loop, LOOP_PLAYBACK_RATE);
      expect(seconds, loop.desktopSrc ?? "").toBeGreaterThanOrEqual(ambientMinimum);
      expect(seconds, loop.desktopSrc ?? "").toBeLessThanOrEqual(ambientMaximum);
    }
  });

  it("measures effective duration by the loop's own rate, else the shared slowed rate", () => {
    expect(effectiveLoopSeconds({ loopSeconds: 5 }, 0.6)).toBeCloseTo(8.333, 2);
    expect(effectiveLoopSeconds({ loopSeconds: 8 }, 0.6)).toBeCloseTo(13.333, 2);
    expect(effectiveLoopSeconds({ loopSeconds: 5, playbackRate: 1 }, 0.6)).toBe(5);
    // A 5s clip at full speed would sit below the window; slowed, it sits inside it.
    expect(effectiveLoopSeconds({ loopSeconds: 5, playbackRate: 1 }, 0.6)).toBeLessThan(RESERVE_MOTION.cinematic.ambientMinimum);
    expect(effectiveLoopSeconds({ loopSeconds: 5 }, LOOP_PLAYBACK_RATE)).toBeGreaterThanOrEqual(RESERVE_MOTION.cinematic.ambientMinimum);
    // A nonsense rate falls back to the shared one rather than dividing by zero.
    expect(effectiveLoopSeconds({ loopSeconds: 5, playbackRate: 0 }, 0.6)).toBeCloseTo(8.333, 2);
  });
});

/* ═══ Daypart plates ═════════════════════════════════════════════════════ */

describe("daypart plates", () => {
  it("serves the approved Apex night plate, with its own 9:16 on a phone", () => {
    expect(productionPlate("apex-command", "desktop", "night")).toMatchObject({
      src: "/brand/backgrounds/apex-command-night.webp",
      daypart: "night",
    });
    expect(productionPlate("apex-command", "mobile", "night")).toMatchObject({
      src: "/brand/backgrounds/apex-command-night-9x16.webp",
      daypart: "night",
    });
    expect(hasDaypartPlates("apex-command")).toBe(true);
  });

  it("serves the approved Recovery night plate, with its own 9:16 on a phone", () => {
    // Owner-approved 2026-09-14 with the Training + Recovery rooms direction.
    expect(VISUAL_ASSETS["recovery-chamber"].dayparts?.night?.status).toBe("APPROVED");
    expect(productionPlate("recovery-chamber", "desktop", "night")).toMatchObject({
      src: "/brand/backgrounds/recovery-chamber-night.webp",
      focalPoint: "50% 50%",
      overlay: "soft-scrim-full",
      daypart: "night",
    });
    expect(productionPlate("recovery-chamber", "mobile", "night")).toMatchObject({
      src: "/brand/backgrounds/recovery-chamber-night-9x16.webp",
      focalPoint: "50% 45%",
      daypart: "night",
    });
    expect(hasDaypartPlates("recovery-chamber")).toBe(true);
    // No dawn plate: dawn is a tint over the day plate.
    expect(productionPlate("recovery-chamber", "desktop", "dawn")).toMatchObject({
      src: "/brand/backgrounds/recovery-chamber.webp",
      daypart: "day",
    });
  });

  it("refuses the Recovery night variant when it is not approved", () => {
    const night = VISUAL_ASSETS["recovery-chamber"].dayparts?.night;
    expect(night).toBeDefined();
    for (const status of NOT_APPROVED) {
      register({ ...VISUAL_ASSETS["recovery-chamber"], id: FIXTURE, dayparts: { night: { ...night!, status } } });
      expect(productionPlate(FIXTURE, "mobile", "night")).toMatchObject({
        src: "/brand/backgrounds/recovery-chamber-9x16.webp",
        daypart: "day",
      });
      expect(hasDaypartPlates(FIXTURE)).toBe(false);
    }
  });

  it("gives daypart plates to the living rooms, the empty-room set and the clinical room", () => {
    const clockBound = Object.values(VISUAL_ASSETS)
      .filter((asset) => hasDaypartPlates(asset.id))
      .map((asset) => asset.id)
      .sort();
    /* Every room in the registry, as of the second dawn set on 2026-09-24.
       It began as the five original rooms; the empty-room plates joined it
       2026-09-17 with the clinical room, and the last five — Compound,
       Physique, Strategist, Community and Bloodwork's dawn — joined when the
       dawn set filled the gaps. training-floor is here on its dawn alone: its
       supercell night was retired the same day. */
    expect(clockBound).toEqual([
      "apex-command",
      "biomarkers-lab",
      "chef-kitchen",
      "command-room",
      "compound-suite",
      "entrance-gallery",
      "intelligence-command",
      "nutrition-command",
      "penthouse-study",
      "physique-scanner",
      "recovery-chamber",
      "recovery-suite",
      "schedule-command",
      "training-command",
      "training-floor",
    ]);
    expect(productionPlate("training-command", "desktop", "night")).toMatchObject({
      src: "/brand/backgrounds/training-command-night.webp",
      daypart: "night",
    });
    expect(productionPlate("training-command", "mobile", "night")).toMatchObject({
      src: "/brand/backgrounds/training-command-night-9x16.webp",
      daypart: "night",
    });
  });

  it("falls back to the day plate for dawn, for day, and for rooms without variants", () => {
    expect(productionPlate("apex-command", "desktop", "dawn")).toMatchObject({
      src: "/brand/backgrounds/apex-command.webp",
      daypart: "day",
    });
    expect(productionPlate("apex-command", "desktop")).toMatchObject({ daypart: "day" });
    /* The penthouse study has a dawn and no night variant at all, so night
       falls back to day. Training's night used to stand here, while its
       daypart was RETIRED over the storm; it carries a glacier now. */
    expect(productionPlate("penthouse-study", "desktop", "night")).toMatchObject({ daypart: "day" });
    expect(hasDaypartPlates("no-such-asset")).toBe(false);
  });

  it("leaves no room without a daypart of its own", () => {
    /* True as of the second dawn set, 2026-09-24: every room in the registry
       now changes with the member's clock at least once a day. The assertion
       exists so that adding a room without one is a deliberate act. */
    const flat = Object.values(VISUAL_ASSETS)
      .filter((asset) => asset.status === "APPROVED" && !hasDaypartPlates(asset.id))
      .map((asset) => asset.id);
    expect(flat).toEqual([]);
  });

  it("serves the approved Nutrition night plate, with its own 9:16 on a phone", () => {
    // Owner-approved 2026-09-15 with the Nutrition room; the night 9:16 is the day 9:16 graded to match.
    expect(VISUAL_ASSETS["nutrition-command"].dayparts?.night?.status).toBe("APPROVED");
    expect(productionPlate("nutrition-command", "desktop", "night")).toEqual({
      src: "/brand/backgrounds/nutrition-command-night.webp",
      focalPoint: "50% 48%",
      overlay: "vertical-scrim",
      daypart: "night",
    });
    expect(productionPlate("nutrition-command", "mobile", "night")).toEqual({
      src: "/brand/backgrounds/nutrition-command-night-9x16.webp",
      focalPoint: "50% 50%",
      overlay: "vertical-scrim",
      daypart: "night",
    });
    expect(hasDaypartPlates("nutrition-command")).toBe(true);
    // No dawn plate: dawn is a tint over the day plate.
    expect(productionPlate("nutrition-command", "desktop", "dawn")).toMatchObject({
      src: "/brand/backgrounds/nutrition-command.webp",
      daypart: "day",
    });
  });

  it("serves the approved Schedule night plate, with its own 9:16 on a phone", () => {
    // Owner-approved 2026-09-15 with the Schedule room; the night 9:16 is the day 9:16 graded to match.
    expect(VISUAL_ASSETS["schedule-command"].dayparts?.night?.status).toBe("APPROVED");
    expect(productionPlate("schedule-command", "desktop", "night")).toEqual({
      src: "/brand/backgrounds/schedule-command-night.webp",
      focalPoint: "50% 42%",
      overlay: "vertical-scrim",
      daypart: "night",
    });
    expect(productionPlate("schedule-command", "mobile", "night")).toEqual({
      src: "/brand/backgrounds/schedule-command-night-9x16.webp",
      focalPoint: "50% 50%",
      overlay: "vertical-scrim",
      daypart: "night",
    });
    expect(hasDaypartPlates("schedule-command")).toBe(true);
    // No dawn plate: dawn is a tint over the day plate.
    expect(productionPlate("schedule-command", "desktop", "dawn")).toMatchObject({
      src: "/brand/backgrounds/schedule-command.webp",
      daypart: "day",
    });
  });

  it("has every approved daypart plate on disk", () => {
    for (const asset of Object.values(VISUAL_ASSETS)) {
      for (const variant of Object.values(asset.dayparts ?? {})) {
        if (!variant || variant.status !== "APPROVED") continue;
        for (const src of [variant.desktopSrc, variant.mobileSrc].filter((s): s is string => Boolean(s))) {
          expect(existsSync(join(process.cwd(), "public", src)), src).toBe(true);
        }
      }
    }
  });

  it("refuses an unapproved variant, and every variant on an unapproved plate", () => {
    const night = VISUAL_ASSETS["apex-command"].dayparts?.night;
    expect(night).toBeDefined();
    for (const status of NOT_APPROVED) {
      register({ dayparts: { night: { ...night!, status } } });
      expect(productionPlate(FIXTURE, "desktop", "night")).toMatchObject({ daypart: "day" });
      expect(hasDaypartPlates(FIXTURE)).toBe(false);

      register({ status });
      expect(productionPlate(FIXTURE, "desktop", "night")).toBeNull();
      expect(hasDaypartPlates(FIXTURE)).toBe(false);
    }
  });
});
