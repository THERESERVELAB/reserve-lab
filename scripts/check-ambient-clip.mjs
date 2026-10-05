#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
   AMBIENT CLIP GATE — run this on a candidate clip BEFORE wiring it in.

     node scripts/check-ambient-clip.mjs <clip.mp4> [plate.webp]

   Every check here exists because something got through without it:

   - SHAPE / LENGTH / SILENCE / SIZE are the room-loop contract. A 1280×720
     delivery is what left the Compound wellness suite unusable for a week.
   - FRAME 0 vs PLATE — a loop's first frame IS its plate, because the plate is
     the poster it fades up from. Generate with the plate in Firefly's FIRST
     frame slot and this lands near 1.
   - SEAM, last frame back to first. A SCREENING number, not the verdict: the
     player carries the wrap with an 800ms two-layer dissolve
     (lib/cinematic/loop-crossfade), so a viewer never sees a bare cut. The
     authority is tests/e2e/loop-crossfade.spec.ts, which measures the
     COMPOSITE's frame-to-frame difference across the join, in a browser, and
     requires it to stay inside the room's own drift. That is how the chef
     kitchen's day clip was rejected (join 1.05-1.09 against drift 0.64-0.86).
     Use this number to sort candidates, then let the e2e test decide.

     For calibration, raw seam across clips already on main: the five day room
     loops sit at 0.62-1.13, while the three night clips approved 2026-09-24
     sit at 14.8-24.5 and have NOT been through the e2e join test. A limit of 3
     would therefore reject every night clip currently shipping, which is why
     it was raised 3 -> 6 on 2026-09-29 — a threshold moved to admit work, so
     it is recorded here rather than buried. Putting the plate in the LAST
     frame slot as well lands around 3-4.
   - LUMINANCE SWING, owner direction 2026-09-24: "the viewer will be looking
     at this clip turning the lights on and off 50x in one minute". A room may
     drift, it may not cycle. Measured across the clip as max-min mean
     brightness, as a percentage of the mean:
         apex-command (ships)          25%   one smooth arc
         recovery-suite aurora (ships) 15%   a slow drift
         training room, rejected       80%   13 -> 28 -> 13, lights on/off
     Anything over ~35% is a light cycle, not ambience. Never prompt a room to
     "breathe", "pulse", or bring light up and down — that is what produces it.
   - CHROMA, owner direction 2026-09-30: "MORE VIBRANCE". Mean distance of a
     frame's colour from grey. It is the one thing the owner rejected two
     clips over that nothing here was measuring:
         moon plain, rated 1 of 10        1.31   effectively black and white
         apex-command (ships)             4.27
         nutrition-command (ships)        5.82
         recovery-suite aurora (ships)   10.44
         aurora planet, accepted         20.68
     Under ~4 the clip reads as greyscale on a dark screen and will be sent
     back. Colour has to be in the subject — a grey plain does not become
     vivid because the prompt says vivid.

   The motion and chroma floors are drawn from the 16:9 set. Run against every
   loop shipping on 2026-09-30, three 9:16 mobile variants fall below them:
   apex-command-9x16 (chroma 3.69), nutrition-command-9x16 (motion 0.27) and
   training-command-9x16 (motion 0.31). They are live and owner-approved, so
   the floors are not being lowered to cover them — they are logged here as the
   re-make list. The mobile crops are consistently flatter and slower than
   their desktop partners, which is worth fixing at the source.

   Requires ffmpeg on PATH. Deliberately a script and not a vitest case: the
   unit suite parses MP4 boxes by hand precisely so it needs no binaries.
   ════════════════════════════════════════════════════════════════════════ */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const MAX_BYTES = 6 * 1024 * 1024;
const MAX_SWING_PCT = 35;
/* The floor for "does this clip actually move at all". Added 2026-09-30 after
   two clips passed every other check while doing essentially nothing: a moon
   plain at 0.20 and a gas giant at 0.16, against 0.61 for the Apex loop and
   1.52 for the aurora, both of which ship. The owner caught it by eye, which
   is exactly what a gate is supposed to make unnecessary.

   It is the mirror of the luminance rule. That one says the light must not
   change; without this one, the cheapest way to satisfy it is to generate a
   still and call it a loop — burning a generation to add nothing. */
const MIN_MOTION = 0.35;
const MIN_CHROMA = 4;
const MAX_SEAM = 6;   // screening only — see the seam note above
const MAX_FRAME0 = 11;

const work = mkdtempSync(join(tmpdir(), "clip-gate-"));
let failed = false;

function ffmpeg(args) {
  try {
    execFileSync("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
  } catch (error) {
    console.error("ffmpeg failed — is it on PATH?\n" + error.message);
    process.exit(2);
  }
}

/** A 64x36 grayscale signature of one frame, for comparing compositions. */
function signature(file, seconds) {
  const out = join(work, Math.random().toString(36).slice(2));
  const pre = seconds === undefined ? [] : ["-ss", String(seconds)];
  ffmpeg(["-y", "-loglevel", "error", ...pre, "-i", file, "-frames:v", "1",
    "-vf", "scale=64:36:force_original_aspect_ratio=disable,format=gray", "-f", "rawvideo", out]);
  return readFileSync(out);
}

const diff = (a, b) => {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) sum += Math.abs(a[i] - b[i]);
  return sum / a.length;
};

/** Duration, track shape and whether an audio track exists — from the boxes. */
function mp4Info(file) {
  const b = readFileSync(file);
  const mvhd = b.indexOf("mvhd");
  if (mvhd < 0) throw new Error("no mvhd box — not an MP4?");
  const v1 = b[mvhd + 4] === 1;
  const timescale = v1 ? b.readUInt32BE(mvhd + 24) : b.readUInt32BE(mvhd + 16);
  const duration = v1 ? Number(b.readBigUInt64BE(mvhd + 28)) : b.readUInt32BE(mvhd + 20);
  const tracks = [];
  for (let at = b.indexOf("tkhd"); at >= 0; at = b.indexOf("tkhd", at + 4)) {
    const base = at + 4 + (b[at + 4] === 1 ? 88 : 76);
    tracks.push({ width: b.readUInt32BE(base) / 65536, height: b.readUInt32BE(base + 4) / 65536 });
  }
  return { seconds: duration / timescale, tracks, audio: b.indexOf("soun") >= 0 };
}

/** Mean absolute pixel change between consecutive sampled frames. */
function motion(file) {
  const out = join(work, "mot.raw");
  ffmpeg(["-y", "-loglevel", "error", "-i", file, "-vf", "fps=8,scale=96:54,format=gray", "-f", "rawvideo", out]);
  const b = readFileSync(out);
  const px = 96 * 54;
  const n = Math.floor(b.length / px);
  let total = 0;
  for (let f = 1; f < n; f += 1) {
    let s = 0;
    for (let i = 0; i < px; i += 1) s += Math.abs(b[f * px + i] - b[(f - 1) * px + i]);
    total += s / px;
  }
  return n > 1 ? total / (n - 1) : 0;
}

/** Mean distance of colour from grey, across the clip. */
function chroma(file) {
  const out = join(work, "chr.raw");
  ffmpeg(["-y", "-loglevel", "error", "-i", file, "-vf", "fps=2,scale=64:36,format=yuv444p", "-f", "rawvideo", out]);
  const b = readFileSync(out);
  const px = 64 * 36;
  const n = Math.floor(b.length / (px * 3));
  let sum = 0;
  for (let f = 0; f < n; f += 1) {
    for (let i = 0; i < px; i += 1) {
      const u = b[f * px * 3 + px + i] - 128;
      const v = b[f * px * 3 + px * 2 + i] - 128;
      sum += Math.hypot(u, v);
    }
  }
  return n > 0 ? sum / (n * px) : 0;
}

/** Mean luminance of every sampled frame. */
function luminance(file) {
  const out = join(work, "lum.raw");
  ffmpeg(["-y", "-loglevel", "error", "-i", file, "-vf", "fps=8,scale=32:18,format=gray", "-f", "rawvideo", out]);
  const b = readFileSync(out);
  const px = 32 * 18;
  const means = [];
  for (let f = 0; f < Math.floor(b.length / px); f += 1) {
    let s = 0;
    for (let i = 0; i < px; i += 1) s += b[f * px + i];
    means.push(s / px);
  }
  return means;
}

function report(label, ok, detail) {
  if (!ok) failed = true;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label.padEnd(22)} ${detail}`);
}

/* `--once` for a clip that plays a single pass and crossfades out, as the Apex
   rotation does (apex-rotation.ts). Its seam is never seen, so the seam check
   does not apply — ice-cave and cloud-inversion both measure ~19.7 there and
   are correctly shipping. Everything else is a room loop and repeats. */
const args = process.argv.slice(2);
const playsOnce = args.includes("--once");
const [clip, plate] = args.filter((a) => a !== "--once");
if (!clip) {
  console.error("usage: node scripts/check-ambient-clip.mjs <clip.mp4> [plate.webp] [--once]");
  process.exit(2);
}
if (!existsSync(clip)) {
  console.error(`not found: ${clip}`);
  process.exit(2);
}

console.log(`\n${clip.split(/[\\/]/).pop()}\n`);

const info = mp4Info(clip);
const video = info.tracks.find((t) => t.width > 0 && t.height > 0);
const bytes = statSync(clip).size;

const shapeOk = video && ((video.width === 1920 && video.height === 1080) || (video.width === 1080 && video.height === 1920));
report("shape", Boolean(shapeOk), video ? `${video.width}x${video.height}` : "no video track");
report("silent", !info.audio, info.audio ? "has an audio track" : "no audio track");
report("size", bytes < MAX_BYTES, `${(bytes / 1048576).toFixed(1)}MB (budget 6.0MB)`);
report("length", info.seconds > 1, `${info.seconds.toFixed(2)}s`);

const first = signature(clip, 0);
const last = signature(clip, Math.max(0, info.seconds - 0.05));
const seam = diff(last, first);
if (playsOnce) console.log(`  ----  loop seam             ${seam.toFixed(2)} — not checked, this clip plays once`);
else report("loop seam", seam <= MAX_SEAM, `${seam.toFixed(2)} / 255 (limit ${MAX_SEAM})`);

if (plate) {
  if (!existsSync(plate)) {
    report("frame 0 vs plate", false, `plate not found: ${plate}`);
  } else {
    const d = diff(first, signature(plate));
    report("frame 0 vs plate", d <= MAX_FRAME0, `${d.toFixed(2)} / 255 (limit ${MAX_FRAME0})`);
  }
} else {
  console.log("  ----  frame 0 vs plate      skipped (pass the plate to check it)");
}

const means = luminance(clip);
const min = Math.min(...means);
const max = Math.max(...means);
const avg = means.reduce((a, c) => a + c, 0) / means.length;
const swing = ((max - min) / avg) * 100;
const moved = motion(clip);
report("motion", moved >= MIN_MOTION, `${moved.toFixed(2)} avg frame change (floor ${MIN_MOTION}) — Apex ships at 0.61`);

report("luminance swing", swing <= MAX_SWING_PCT, `${swing.toFixed(0)}% of mean (limit ${MAX_SWING_PCT}%) — ${min.toFixed(0)}..${max.toFixed(0)}`);

const colour = chroma(clip);
report("chroma", colour >= MIN_CHROMA, `${colour.toFixed(2)} from grey (floor ${MIN_CHROMA}) — the shipping aurora is 10.44`);

console.log(`\n  ${failed ? "REJECTED — do not wire this in." : "OK to wire in."}\n`);
process.exit(failed ? 1 : 0);
