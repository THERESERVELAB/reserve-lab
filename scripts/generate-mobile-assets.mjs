#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
   MOBILE ASSET SOURCES — the Reserve mark, drawn rather than dropped in.

   Writes the five source files `cap-assets` needs into mobile/assets/.
   Run it, then `npm run mobile:assets` to fan them out into every icon and
   splash density inside android/ and ios/.

       node scripts/generate-mobile-assets.mjs

   ── Why this is a script and not five PNGs ──────────────────────────────
   An app icon cannot be changed without a store review, and it is the most
   visible brand surface either store will ever show. Keeping it as geometry
   means the mark is diffable, re-renderable at any size, and adjustable by
   editing numbers here rather than by re-exporting from a tool nobody else
   has. The PNGs it writes are committed too — the build must not depend on
   this script having been run.

   ── The mark ────────────────────────────────────────────────────────────
   A geometric R: a stem, a bowl, and a leg, built from three stroked paths
   on a 100×100 grid. It is drawn, not typeset, so it carries no font
   dependency — librsvg inside sharp would silently fall back to Arial if
   this were text, and the icon would change depending on the machine that
   rendered it.

   Colour is the product's own: base #07080c, and the gold ramp #d5b15f →
   #e8c87a used exactly as the UI uses it — a single precise accent, never
   a flood fill.

   ── Store constraints these files must satisfy ──────────────────────────
   - icon.png carries NO alpha. Apple rejects an icon with an alpha channel,
     so it is flattened onto the base colour here.
   - icon-foreground.png keeps the mark inside the centre 66%, because
     Android launchers crop the adaptive icon to circles, squircles and
     other masks.
   - splash.png is square and centred: it is cropped to every device aspect,
     so nothing meaningful may sit outside the centre square.
   ════════════════════════════════════════════════════════════════════════ */

import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "mobile", "assets");

const BASE = "#07080c";
const GOLD = "#d5b15f";
const AMBER = "#e8c87a";

/**
 * The mark on a 100×100 grid, centred, drawn with stroked paths.
 * `scale` shrinks it within its square — the adaptive-icon foreground needs
 * the mark well inside the safe centre, the flat icon can sit larger.
 */
function markSVG(size) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${AMBER}"/>
      <stop offset="1" stop-color="${GOLD}"/>
    </linearGradient>
  </defs>
  <!-- Terminals are FLAT and joins are mitred, not rounded. That single
       choice is what separates an instrument from a friendly app icon, and
       it is the one detail carrying the brand: rounded caps made the same
       skeleton read as a generic bold R. -->
  <g fill="none" stroke="url(#g)" stroke-width="12" stroke-linecap="butt" stroke-linejoin="miter">
    <!-- Stem and bowl are ONE path, so the join is a real mitred corner
         rather than two terminals meeting and leaving a notch at small sizes. -->
    <path d="M33 82 V18 H51 A16 16 0 0 1 51 52 H33"/>
    <!-- The leg springs from inside the bowl's bottom bar. Starting it clear
         of the stem made it read as a detached slash on a P at 48px. -->
    <path d="M46 52 L68 82"/>
  </g>
</svg>`);
}

/** A flat field, used for the Android adaptive background layer. */
function fieldSVG(size, colour) {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" fill="${colour}"/></svg>`,
  );
}

/**
 * Place the mark dead-centre on a square canvas, at `fraction` of its width.
 *
 * The mark is MEASURED rather than positioned by hand: it is rendered on a
 * transparent field, trimmed to its true ink bounds, then composited on the
 * centre. Flat terminals and mitred joins extend past the path coordinates by
 * amounts that change whenever the geometry does, so a hand-tuned offset is
 * correct exactly once. This stays centred through any edit to the paths.
 */
async function centredMark({ size, fraction, background }) {
  /* Render large, then trim: trimming a big raster keeps the edge accurate. */
  const rendered = await sharp(markSVG(2048)).png().toBuffer();
  const tight = await sharp(rendered).trim({ threshold: 1 }).png().toBuffer();
  const { width, height } = await sharp(tight).metadata();

  /* Fit the longest side to the requested fraction, so a tall mark and a wide
     one both sit inside the same safe area. */
  const target = Math.round(size * fraction);
  const scale = target / Math.max(width, height);
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  const resized = await sharp(tight).resize(w, h).png().toBuffer();

  const base = background
    ? sharp({ create: { width: size, height: size, channels: 4, background } })
    : sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } });

  return base
    .composite([{ input: resized, left: Math.round((size - w) / 2), top: Math.round((size - h) / 2) }])
    .png()
    .toBuffer();
}

async function write(name, buffer, { alpha }) {
  const file = path.join(OUT, name);
  let img = sharp(buffer);
  /* Apple rejects any alpha channel on the icon, so it is flattened onto the
     product surface rather than left transparent. */
  if (!alpha) img = img.flatten({ background: BASE });
  await img.png({ compressionLevel: 9 }).toFile(file);
  return file;
}

async function main() {
  await mkdir(OUT, { recursive: true });

  const written = [];

  // iOS + the shared square icon: opaque, mark large on the base colour.
  written.push(await write("icon.png", await centredMark({ size: 1024, fraction: 0.66, background: BASE }), { alpha: false }));

  // Android adaptive foreground: transparent, mark held inside the centre 66%.
  written.push(await write("icon-foreground.png", await centredMark({ size: 1024, fraction: 0.44 }), { alpha: true }));

  // Android adaptive background: the flat product surface.
  written.push(await write("icon-background.png", fieldSVG(1024, BASE), { alpha: false }));

  // Splash: cropped to every aspect, so the mark stays small and centred.
  const splash = await centredMark({ size: 2732, fraction: 0.22, background: BASE });
  written.push(await write("splash.png", splash, { alpha: false }));
  /* Reserve is dark-only, so the dark splash is the same picture. It is
     written as its own file because cap-assets expects one, and a missing
     dark splash silently falls back to the light one on some densities. */
  written.push(await write("splash-dark.png", splash, { alpha: false }));

  for (const f of written) console.log(`[mobile-assets] wrote ${path.relative(ROOT, f)}`);
  console.log("\nNext: npm run mobile:assets");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
