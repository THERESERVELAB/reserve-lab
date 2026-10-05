import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { RESERVE_MOTION } from "@/lib/cinematic/environments";
import { LOOP_PLAYBACK_RATE } from "@/lib/cinematic/loop-crossfade";

import { DETAIL_IMAGES, VISUAL_ASSETS, effectiveLoopSeconds } from "../asset-manifest";
import { LIBRARY_CLIPS, LIBRARY_IMAGES, libraryClips } from "../library";

const PUBLIC = join(process.cwd(), "public");
const onDisk = (src: string) => join(PUBLIC, ...src.split("/").filter(Boolean));

/** Width and height from a WebP header (VP8, VP8L or VP8X). */
function webpSize(file: string): { width: number; height: number } {
  const b = readFileSync(file);
  const chunk = b.toString("ascii", 12, 16);
  if (chunk === "VP8X") return { width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3) };
  if (chunk === "VP8L") {
    const bits = b.readUInt32LE(21);
    return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >> 14) & 0x3fff) };
  }
  return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
}

/** Movie duration, track shapes and whether an audio track exists. */
function mp4Info(file: string): { seconds: number; tracks: { width: number; height: number }[]; audio: boolean } {
  const b = readFileSync(file);
  const mvhd = b.indexOf("mvhd");
  const v1 = b[mvhd + 4] === 1;
  const timescale = v1 ? b.readUInt32BE(mvhd + 24) : b.readUInt32BE(mvhd + 16);
  const duration = v1 ? Number(b.readBigUInt64BE(mvhd + 28)) : b.readUInt32BE(mvhd + 20);
  const tracks: { width: number; height: number }[] = [];
  for (let at = b.indexOf("tkhd"); at >= 0; at = b.indexOf("tkhd", at + 4)) {
    const base = at + 4 + (b[at + 4] === 1 ? 88 : 76);
    tracks.push({ width: b.readUInt32BE(base) / 65536, height: b.readUInt32BE(base + 4) / 65536 });
  }
  return { seconds: duration / timescale, tracks, audio: b.indexOf("soun") >= 0 };
}

const entries = Object.entries(LIBRARY_IMAGES);

/* The one frame WebP cannot bring under the byte budget at 2400w without
   visible blocking. It is registered, never served, and must be re-cut before
   it is cast — recorded here so the exception cannot spread silently. */
const OVER_BUDGET = new Set(["glacier-aerial"]);

/* Plates cut from a clip's own frame 0 because no high-resolution master of
   that composition was delivered. They are honest native resolution rather
   than an upscale, and must be re-cut from a master before being cast. */
const NATIVE_1080 = new Set(["penthouse-vista"]);

/* The library was a 2026-09-17 landscape set; the rooms arrived a day later
   in the same delivery as the loops. */
const LATER_SOURCE = new Set(["plunge-suite", "penthouse-vista"]);

describe("visual library", () => {
  it("is not cast: no library id is a plate or a detail image", () => {
    for (const id of Object.keys(LIBRARY_IMAGES)) {
      expect(VISUAL_ASSETS[id], id).toBeUndefined();
      expect(DETAIL_IMAGES[id as never], id).toBeUndefined();
    }
  });

  it.each(entries)("%s: both variants on disk at their declared shapes", (id, image) => {
    expect(image.id).toBe(id);
    expect(image.src).toBe(`/brand/library/${id}.webp`);
    expect(image.src1200).toBe(`/brand/library/${id}-1200.webp`);
    for (const src of [image.src, image.src1200]) {
      expect(existsSync(onDisk(src)), `${src} on disk`).toBe(true);
    }
    expect(webpSize(onDisk(image.src))).toEqual(
      NATIVE_1080.has(id) ? { width: 1920, height: 1080 } : { width: 2400, height: 1350 },
    );
    expect(webpSize(onDisk(image.src1200))).toEqual({ width: 1200, height: 675 });
  });

  it.each(entries)("%s: inside the byte budget", (id, image) => {
    expect(statSync(onDisk(image.src1200)).size).toBeLessThanOrEqual(160_000);
    if (OVER_BUDGET.has(id)) {
      expect(statSync(onDisk(image.src)).size).toBeLessThanOrEqual(260_000);
      return;
    }
    expect(statSync(onDisk(image.src)).size).toBeLessThanOrEqual(160_000);
  });

  it.each(entries)("%s: carries a blur placeholder, alt text and its source", (id, image) => {
    expect(image.blurDataURL).toMatch(/^data:image\/webp;base64,[A-Za-z0-9+/]+=*$/);
    expect(image.blurDataURL.length).toBeLessThan(1000);
    expect(image.alt.trim().length).toBeGreaterThan(20);
    expect(image.source).toBe(
      LATER_SOURCE.has(id)
        ? "Adobe Firefly (Gemini 3.1), owner-generated 2026-09-18"
        : "Adobe Firefly (Gemini 3.1), owner-generated 2026-09-17",
    );
  });

  it("holds the two rooms apart from the landscape set", () => {
    /* A room is a candidate ENVIRONMENT, not a picture to hang in one, so the
       distinction has to survive in the data rather than in a comment. */
    const rooms = entries.filter(([, image]) => image.set === "room").map(([id]) => id).sort();
    expect(rooms).toEqual(["penthouse-vista", "plunge-suite"]);
    for (const id of rooms) {
      expect(LIBRARY_IMAGES[id].loop?.status, id).toBe("APPROVED");
      /* Not cast anywhere: which screen a room belongs to is the owner's call. */
      expect(VISUAL_ASSETS[id], id).toBeUndefined();
    }
  });

  it("keeps the deep field out of use after the owner rejected it", () => {
    expect(LIBRARY_IMAGES["deep-field"].status).toBe("RETIRED");
  });

  it("registers six ambient clips: three rotating, two rooms, and the retired delta", () => {
    const clips = libraryClips();
    expect(clips.map((c) => c.id).sort()).toEqual([
      "cloud-inversion",
      "ice-cave",
      "penthouse-vista",
      "plunge-suite",
      "river-delta",
      "salt-flat-mirror",
    ]);
    for (const { id, loop } of clips) {
      expect(loop.status, id).toBe(id === "river-delta" ? "RETIRED" : "APPROVED");
    }
  });

  it("keeps the river delta's truncated clip out of use while its picture stands", () => {
    /* 0.21s of video in a 6.8MB file, registered as 5s. The picture is fine
       and stays APPROVED; only the motion is withdrawn. */
    const delta = LIBRARY_IMAGES["river-delta"];
    expect(delta.status).toBe("APPROVED");
    expect(delta.loop?.status).toBe("RETIRED");
    const info = mp4Info(onDisk(delta.loop!.desktopSrc!));
    expect(info.seconds).toBeLessThan(1);
  });

  it.each(libraryClips())("$id: a silent 16:9 file on disk, with no phone cut yet", ({ id, loop }) => {
    expect(loop.desktopSrc).toBe(`/brand/loops/${id}-16x9.mp4`);
    /* 16:9 only. A phone keeps the still until a 9:16 exists —
       `productionLoop` never falls back to the desktop cut. */
    expect(loop.mobileSrc).toBeNull();
    const file = onDisk(loop.desktopSrc!);
    expect(existsSync(file)).toBe(true);
    const info = mp4Info(file);
    expect(info.audio, "no audio track").toBe(false);
    const video = info.tracks.find((track) => track.width > 0 && track.height > 0);
    expect(video).toEqual({ width: 1920, height: 1080 });
  });

  it("declares every clip's real length, and plays inside the ambient window once slowed", () => {
    /* At the shared 0.6× rate a 5.04s clip is ~8.4s on screen and an 8s clip
       ~13.3s, both inside RESERVE_MOTION's 6–20s window. The declared length
       is checked against the FILE, so a truncated export cannot pass by
       agreeing with itself — which is exactly how the river delta shipped. */
    for (const { id, loop } of libraryClips()) {
      const seconds = effectiveLoopSeconds(loop, LOOP_PLAYBACK_RATE);
      expect(seconds, id).toBeGreaterThanOrEqual(RESERVE_MOTION.cinematic.ambientMinimum);
      expect(seconds, id).toBeLessThanOrEqual(RESERVE_MOTION.cinematic.ambientMaximum);
      if (loop.status === "RETIRED") continue;
      const info = mp4Info(onDisk(loop.desktopSrc!));
      expect(Math.abs(info.seconds - loop.loopSeconds), `${id} declared vs file`).toBeLessThan(0.1);
    }
  });

  it("keeps every servable clip inside the loop byte budget", () => {
    /* The ice cave predates this check and sits 16KB (0.26%) over. It is the
       owner's approved benchmark — "glacier clip is perfect", 2026-09-17 — and
       it plays in the Apex rotation, so it is recorded here rather than
       re-encoded on an agent's judgement. Re-encoding it is a one-line change
       the day the owner says so; until then the exception is visible instead
       of the budget being quietly raised for everything. */
    const LEGACY_OVER_BUDGET = new Map([["ice-cave", 6_320_000]]);
    for (const { id, loop } of libraryClips()) {
      if (loop.status === "RETIRED") continue;
      expect(statSync(onDisk(loop.desktopSrc!)).size, id).toBeLessThan(
        LEGACY_OVER_BUDGET.get(id) ?? 6 * 1024 * 1024,
      );
    }
  });
});

describe("clips without a still", () => {
  it("is empty: the wellness suite found its plate and became a room", () => {
    /* It held the 1280×720 / 720×1280 Compound Command pair, which was below
       the 1920×1080 every room loop is held to and had no plate to open on.
       A 1920×1080 take of that room arrived with its own frame 0 as a plate,
       and moved into the asset manifest. */
    expect(Object.keys(LIBRARY_CLIPS)).toEqual([]);
    expect(VISUAL_ASSETS["compound-suite"]).toBeDefined();
    expect(VISUAL_ASSETS["compound-suite"].loop?.status).toBe("APPROVED");
  });

  it("left no orphaned 720p files behind", () => {
    for (const src of ["/brand/loops/compound-suite-9x16.mp4"]) {
      expect(existsSync(onDisk(src)), src).toBe(false);
    }
  });

  /* Kept as a contract for whatever lands here next: a clip registered
     without a still is on disk, silent, and inside the ambient window. */
  it.each(Object.values(LIBRARY_CLIPS))("%s: a silent file on disk, inside the ambient window", (clip) => {
    const file = onDisk(clip.loop.desktopSrc!);
    expect(existsSync(file)).toBe(true);
    expect(statSync(file).size).toBeLessThan(6 * 1024 * 1024);
    expect(mp4Info(file).audio, "no audio track").toBe(false);
    const seconds = effectiveLoopSeconds(clip.loop, LOOP_PLAYBACK_RATE);
    expect(seconds).toBeGreaterThanOrEqual(RESERVE_MOTION.cinematic.ambientMinimum);
    expect(seconds).toBeLessThanOrEqual(RESERVE_MOTION.cinematic.ambientMaximum);
  });
});
