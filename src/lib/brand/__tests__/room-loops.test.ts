import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { VISUAL_ASSETS, castRoomPlate, productionLoop, productionPlate } from "../asset-manifest";

const PUBLIC = join(process.cwd(), "public");
const onDisk = (src: string) => join(PUBLIC, ...src.split("/").filter(Boolean));

/** Reads an MP4's movie duration and its track dimensions from the mvhd and tkhd boxes. */
function mp4Info(file: string): { seconds: number; tracks: { width: number; height: number }[]; audio: boolean } {
  const b = readFileSync(file);
  const mvhd = b.indexOf("mvhd");
  expect(mvhd, "mvhd box").toBeGreaterThan(0);
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

/* The loops that ship. A clip still in REVIEW is registered on its plate but
   is not a room loop yet; it is held to its own contract below. */
const looped = Object.values(VISUAL_ASSETS).filter((asset) => asset.loop?.status === "APPROVED");
const pending = Object.values(VISUAL_ASSETS).filter((asset) => asset.loop && asset.loop.status !== "APPROVED");

describe("approved room loops", () => {
  it("covers Apex, Training, Recovery, Nutrition, Schedule and the Compound wellness suite", () => {
    expect(looped.map((asset) => asset.id).sort()).toEqual(
      [
        "apex-command",
        "compound-suite",
        "nutrition-command",
        "recovery-chamber",
        "schedule-command",
        "training-command",
      ],
    );
  });

  /* A 16:9-only clip has no 9:16 cut to check: the phone keeps the still. */
  const cuts = looped.flatMap((asset) => [
    [asset.id, "16:9", asset] as const,
    ...(asset.loop!.mobileSrc ? [[asset.id, "9:16", asset] as const] : []),
  ]);

  it.each(cuts)("%s %s: file on disk, under 6MB, silent, its declared length, at its own shape", (id, shape, asset) => {
    const loop = asset.loop!;
    expect(loop.status).toBe("APPROVED");
    const src = shape === "16:9" ? loop.desktopSrc : loop.mobileSrc;
    expect(src).toBe(`/brand/loops/${id}-${shape === "16:9" ? "16x9" : "9x16"}.mp4`);
    const file = onDisk(src!);
    expect(existsSync(file)).toBe(true);
    expect(statSync(file).size).toBeLessThan(6 * 1024 * 1024);

    const info = mp4Info(file);
    expect(info.audio, "no audio track").toBe(false);
    expect(Math.abs(info.seconds - loop.loopSeconds)).toBeLessThan(0.1);
    const video = info.tracks.find((track) => track.width > 0 && track.height > 0);
    expect(video).toEqual(shape === "16:9" ? { width: 1920, height: 1080 } : { width: 1080, height: 1920 });
  });

  it.each(cuts)("%s %s: cut from its approved DAY plate of the same shape", (id, shape, asset) => {
    /* The loop hangs off the base (day) plate, never a daypart variant, and it
       ships only while that day plate does. Frame 0 is that plate. */
    const viewport = shape === "16:9" ? "desktop" : "mobile";
    expect(asset.status).toBe("APPROVED");
    expect(shape === "16:9" ? asset.desktopAspectRatio : asset.mobileAspectRatio).toBe(shape);
    const plateSrc = shape === "16:9" ? asset.desktopSrc : asset.mobileSrc;
    expect(plateSrc).toBeTruthy();
    expect(existsSync(onDisk(plateSrc!))).toBe(true);
    /* A variant may RECORD a clip of its own plate; it is never the one served. */
    for (const variant of Object.values(asset.dayparts ?? {})) {
      if (variant?.loop) expect(productionLoop(id, viewport)?.src).not.toBe(variant.loop.desktopSrc);
    }
    const day = productionPlate(id, viewport, "day");
    expect(day?.daypart).toBe("day");
    expect(day?.src).toBe(plateSrc);
    expect(productionLoop(id, viewport)?.src).toBe(viewport === "desktop" ? asset.loop!.desktopSrc : asset.loop!.mobileSrc);
  });

  it("never serves a 16:9 loop to a phone or a 9:16 loop to a desktop", () => {
    for (const asset of looped) {
      if (asset.loop!.mobileSrc === null) expect(productionLoop(asset.id, "mobile")).toBeNull();
      else expect(productionLoop(asset.id, "mobile")?.src).toMatch(/-9x16\.mp4$/);
      expect(productionLoop(asset.id, "desktop")?.src).toMatch(/-16x9\.mp4$/);
    }
  });
});

describe("clips registered but not approved", () => {
  it("is exactly the chef kitchen's slow take, in review, and nothing serves it", () => {
    expect(pending.map((asset) => asset.id)).toEqual(["chef-kitchen"]);
    const loop = pending[0].loop!;
    expect(loop.status).toBe("REVIEW");
    expect(loop.desktopSrc).toBe("/brand/loops/chef-kitchen-16x9.mp4");
    expect(loop.mobileSrc).toBeNull();
    const file = onDisk(loop.desktopSrc!);
    expect(statSync(file).size).toBeLessThan(6 * 1024 * 1024);
    const info = mp4Info(file);
    expect(info.audio, "no audio track").toBe(false);
    expect(Math.abs(info.seconds - loop.loopSeconds)).toBeLessThan(0.1);
    expect(info.tracks.find((track) => track.width > 0 && track.height > 0)).toEqual({ width: 1920, height: 1080 });
    expect(productionLoop("chef-kitchen", "desktop")).toBeNull();
    expect(productionLoop("chef-kitchen", "mobile")).toBeNull();
  });

});

/* Approved 2026-09-24. A night plate used to be a still by rule, which meant
   these three clips could never reach a member no matter what status they
   carried. `productionLoop` now takes a daypart and serves the clip of the
   plate actually on screen, so a room follows the clock AND keeps moving. */
describe("approved night loops", () => {
  /* Read from the manifest, never listed by hand. Three rooms were named here
     and all three were pulled on 2026-10-01 for their join; a hand-written
     list would have gone stale and a NEW night clip could have shipped with no
     coverage at all — which is how eight of them did. Whatever is APPROVED is
     what gets held to the contract. */
  const nights = Object.keys(VISUAL_ASSETS)
    .filter((id) => VISUAL_ASSETS[id as keyof typeof VISUAL_ASSETS].dayparts?.night?.loop?.status === "APPROVED")
    .map((id) => [id, VISUAL_ASSETS[id as keyof typeof VISUAL_ASSETS].dayparts!.night!.loop!.desktopSrc ?? ""] as const)
    .filter(([, src]) => src !== "");

  it("has night loops to check at all", () => {
    /* If every night clip is ever pulled this file would silently assert
       nothing, so it says so instead. */
    expect(nights.length).toBeGreaterThan(0);
  });

  it.each(nights)("%s: serves its night clip at night, to the same contract as a day loop", (id, src) => {
    const night = VISUAL_ASSETS[id as keyof typeof VISUAL_ASSETS].dayparts?.night;
    expect(night?.status).toBe("APPROVED");
    expect(night?.loop?.status).toBe("APPROVED");
    expect(night?.loop?.desktopSrc).toBe(src);
    expect(night?.loop?.mobileSrc).toBeNull();
    const file = onDisk(src);
    expect(existsSync(file)).toBe(true);
    expect(statSync(file).size).toBeLessThan(6 * 1024 * 1024);
    const info = mp4Info(file);
    expect(info.audio, "no audio track").toBe(false);
    expect(Math.abs(info.seconds - night!.loop!.loopSeconds)).toBeLessThan(0.1);
    expect(info.tracks.find((track) => track.width > 0 && track.height > 0)).toEqual({ width: 1920, height: 1080 });

    /* The night clip is served at night and ONLY at night. */
    expect(productionLoop(id as keyof typeof VISUAL_ASSETS, "desktop", "night")?.src).toBe(src);
    expect(productionLoop(id, "desktop", "day")?.src).not.toBe(src);
    expect(productionLoop(id, "desktop")?.src).not.toBe(src);
    /* 16:9 only — a phone keeps the 9:16 night still. */
    expect(productionLoop(id, "mobile", "night")).toBeNull();
    /* The plate under it is that room's night plate, never the day one. */
    expect(productionPlate(id, "desktop", "night")?.daypart).toBe("night");
  });

  it("casts each room to the plate whose light belongs to this hour", () => {
    /* By day the older plate carries the light; by night the newer one does.
       Both are the same room in the product — only the light differs. */
    const pairs = [
      ["command-room", "apex-command"],
      ["chef-kitchen", "nutrition-command"],
      ["recovery-suite", "recovery-chamber"],
    ] as const;
    for (const [preferred, fallback] of pairs) {
      expect(castRoomPlate(preferred, fallback, "day")).toBe(fallback);
      expect(productionLoop(castRoomPlate(preferred, fallback, "day"), "desktop", "day")).not.toBeNull();

      /* Night. This used to assert the PREFERRED plate was always the one
         cast, which stopped being true when eight night clips were pulled on
         2026-10-01 for their join (see asset-manifest): two of these three
         pairs now flip to the sibling whose clip still measures clean, which
         is precisely what scoring motion as a tie-breaker is for.

         What must hold either way is the LIGHT. A pull may cost a room its
         movement; it may never cost it the hour. */
      const night = castRoomPlate(preferred, fallback, "night");
      expect(productionPlate(night, "desktop", "night")?.daypart).toBe("night");

      /* And while either plate of the pair still has a night clip, the one
         cast is a plate that moves — never the still one beside a moving one. */
      const movers = [preferred, fallback].filter((id) => productionLoop(id, "desktop", "night"));
      if (movers.length > 0) expect(movers).toContain(night);
    }
  });

  it("reaches a daypart plate that has no clip, rather than a moving day plate", () => {
    /* The defect the night clips had, in its other form. `castRoomPlate` used
       to rank on motion alone, so a plate with the right light but no clip
       could never be cast, however right its light was.

       The penthouse study's dawn is the live case: approved, on disk, and
       still without a clip of its own. It is cast anyway, and it is cast over
       a schedule-command plate that WOULD have moved — the hour wins. */
    expect(productionLoop("penthouse-study", "desktop", "dawn")).toBeNull();
    expect(productionLoop("schedule-command", "desktop", "dawn")).not.toBeNull();
    expect(castRoomPlate("penthouse-study", "schedule-command", "dawn")).toBe("penthouse-study");
    expect(productionPlate("penthouse-study", "desktop", "dawn")?.daypart).toBe("dawn");
  });

  it("still prefers motion between two plates that both own the hour", () => {
    /* Day: both rooms have a day plate, only the older one has a day clip. */
    expect(castRoomPlate("command-room", "apex-command", "day")).toBe("apex-command");
    expect(castRoomPlate("recovery-suite", "recovery-chamber", "day")).toBe("recovery-chamber");
  });

  it("gives all five living rooms a first light, and prefers it over day motion", () => {
    /* Owner casting 2026-09-24. Every pair now owns dawn on its newer plate,
       so dawn is the hour where the scoring is most visible: the preferred
       plate has the right light and no clip, the fallback has a day clip that
       would happily play, and the right light wins. */
    const pairs = [
      ["command-room", "apex-command"],
      ["training-floor", "training-command"],
      ["chef-kitchen", "nutrition-command"],
      ["recovery-suite", "recovery-chamber"],
      ["penthouse-study", "schedule-command"],
    ] as const;
    for (const [preferred, fallback] of pairs) {
      expect(productionPlate(preferred, "desktop", "dawn")?.daypart, preferred).toBe("dawn");
      expect(productionPlate(preferred, "mobile", "dawn")?.src, preferred).toMatch(/-dawn-9x16\.webp$/);
      expect(productionLoop(preferred, "desktop", "dawn"), `${preferred} has no dawn clip yet`).toBeNull();
      expect(productionLoop(fallback, "desktop", "dawn"), `${fallback} would move`).not.toBeNull();
      expect(castRoomPlate(preferred, fallback, "dawn"), preferred).toBe(preferred);
    }
  });

  it("keeps the retired storm off Training's night", () => {
    /* Owner direction 2026-09-24: "no useless storms". The supercell was cast
       as training-floor's night in 2026-09-17 and rejected the first time the
       unpinned clock actually put it on screen. Nature and cosmos stay — this
       is about weather with nothing behind it, not about sky.

       2026-09-30: the daypart is APPROVED again, on a glacier front rather
       than weather, and the storm clip is gone from disk. What this test
       protects is the subject, not the status, so it now asserts that no room
       plays the storm rather than that Training plays nothing. */
    const storms = Object.values(VISUAL_ASSETS).flatMap((asset) =>
      Object.values(asset.dayparts ?? {}).map((d) => d.loop?.desktopSrc ?? ""),
    );
    expect(storms.filter((src) => /storm|supercell|tornado/i.test(src))).toEqual([]);
    /* Training's night is the glacier, and Training Command's is the fissure. */
    expect(productionPlate("training-floor", "desktop", "night")?.daypart).toBe("night");
    expect(productionLoop("training-floor", "desktop", "night")?.src).toContain("training-floor-night");
    expect(productionPlate("training-command", "desktop", "night")?.src).toContain("training-command-night");
  });

  it("leaves a room with no clip for this hour on the right plate, still", () => {
    /* Every night plate carries a clip as of 2026-09-30; dawn still carries
       none for any room, so dawn is what this rule is checked against now.
       The rule is unchanged: the RIGHT room without motion — never the day
       loop over another hour's plate. */
    expect(productionPlate("compound-suite", "desktop", "dawn")?.daypart).toBe("dawn");
    expect(productionLoop("compound-suite", "desktop", "dawn")).toBeNull();
    expect(productionLoop("compound-suite", "desktop", "day")).not.toBeNull();
  });
});

describe("room casting", () => {
  it("keeps every living room on a plate that moves until the newer plate's own clip is approved", () => {
    const pairs = [
      ["command-room", "apex-command"],
      ["training-floor", "training-command"],
      ["chef-kitchen", "nutrition-command"],
      ["recovery-suite", "recovery-chamber"],
      ["penthouse-study", "schedule-command"],
    ] as const;
    for (const [preferred, fallback] of pairs) {
      const cast = castRoomPlate(preferred, fallback);
      expect(productionLoop(cast, "desktop"), `${preferred} → ${cast}`).not.toBeNull();
      expect(cast).toBe(productionLoop(preferred, "desktop") ? preferred : fallback);
    }
  });

  it("keeps every room on its previous plate while no new plate has an approved clip", () => {
    expect(castRoomPlate("command-room", "apex-command")).toBe("apex-command");
    expect(castRoomPlate("training-floor", "training-command")).toBe("training-command");
    expect(castRoomPlate("chef-kitchen", "nutrition-command")).toBe("nutrition-command");
    expect(castRoomPlate("recovery-suite", "recovery-chamber")).toBe("recovery-chamber");
    expect(castRoomPlate("penthouse-study", "schedule-command")).toBe("schedule-command");
  });

  it("casts the newer plate as soon as its clip is approved, 16:9 on desktop and the still on a phone", () => {
    const asset = VISUAL_ASSETS["chef-kitchen"];
    const original = asset.loop!.status;
    try {
      asset.loop!.status = "APPROVED";
      expect(castRoomPlate("chef-kitchen", "nutrition-command")).toBe("chef-kitchen");
      expect(productionLoop("chef-kitchen", "desktop")?.src).toBe("/brand/loops/chef-kitchen-16x9.mp4");
      /* No 9:16 clip: the phone is not refused the room, it keeps the 9:16 still. */
      expect(productionLoop("chef-kitchen", "mobile")).toBeNull();
      expect(productionPlate("chef-kitchen", "mobile")?.src).toBe(asset.mobileSrc);
    } finally {
      asset.loop!.status = original;
    }
    expect(castRoomPlate("chef-kitchen", "nutrition-command")).toBe("nutrition-command");
  });
});
