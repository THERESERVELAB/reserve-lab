import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { DETAIL_IMAGES, productionDetail, type DetailImageId } from "../asset-manifest";

const PUBLIC = join(process.cwd(), "public");
const onDisk = (src: string) => join(PUBLIC, ...src.split("/").filter(Boolean));

/** Width and height from a WebP header (VP8, VP8L or VP8X). */
function webpSize(file: string): { width: number; height: number } {
  const b = readFileSync(file);
  expect(b.toString("ascii", 0, 4)).toBe("RIFF");
  expect(b.toString("ascii", 8, 12)).toBe("WEBP");
  const chunk = b.toString("ascii", 12, 16);
  if (chunk === "VP8X") return { width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3) };
  if (chunk === "VP8L") {
    const bits = b.readUInt32LE(21);
    return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >> 14) & 0x3fff) };
  }
  return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
}

const entries = Object.entries(DETAIL_IMAGES);

/** The second set, wired 2026-09-16 after PR #46. */
const SECOND_SET = [
  "build-studio",
  "coach-suite",
  "education-library",
  "journal-desk",
  "labs-clinic",
  "peak-stage",
  "strategist-command",
  "women-studio",
  "women-wellness",
];

/** The third set, wired 2026-09-17 with the Firefly room and object stills. */
const THIRD_SET = ["community-lounge", "measurements-suite", "vault-door", "decision-table"];

const SOURCES = [
  "Adobe Firefly (Gemini 3.1), owner-generated 2026-09-16",
  "Adobe Firefly (Gemini 3.1), owner-generated 2026-09-17",
];

describe("detail images", () => {
  it("registers the first set, Protocol Blueprint, the nine second-set and the four third-set images, and neither the rejected schedule desk nor a compound suite", () => {
    expect(Object.keys(DETAIL_IMAGES).sort()).toEqual(
      [
        "dawn-gym",
        "fuel-prep",
        "hydration-bar",
        "posing-room",
        "prep-journal",
        "protocol-blueprint",
        "recovery-plunge",
        "sleep-suite",
        "strength-floor",
        ...SECOND_SET,
        ...THIRD_SET,
      ].sort(),
    );
    /* Schedule's band was rejected 2026-09-16 and its replacement has not been
       generated; the Compound room's wellness suite exists only as video. */
    for (const name of ["schedule-desk", "compound-suite"]) {
      for (const file of [`${name}.webp`, `${name}-1200.webp`, `${name}-4x5.webp`]) {
        expect(existsSync(join(PUBLIC, "brand", "details", file)), file).toBe(false);
      }
    }
  });

  it.each(entries)("%s: all three variants exist on disk at their declared shapes", (id, image) => {
    expect(image.id).toBe(id);
    expect(image.src).toBe(`/brand/details/${id}.webp`);
    expect(image.src1200).toBe(`/brand/details/${id}-1200.webp`);
    expect(image.src4x5).toBe(`/brand/details/${id}-4x5.webp`);
    for (const src of [image.src, image.src1200, image.src4x5]) {
      expect(existsSync(onDisk(src)), `${src} on disk`).toBe(true);
    }

    const wide = webpSize(onDisk(image.src));
    const mid = webpSize(onDisk(image.src1200));
    const phone = webpSize(onDisk(image.src4x5));
    expect(wide.width).toBe(2400);
    expect(mid.width).toBe(1200);
    expect(Math.abs(wide.width / wide.height - 16 / 9)).toBeLessThan(0.02);
    expect(Math.abs(mid.width / mid.height - 16 / 9)).toBeLessThan(0.02);
    expect(phone).toEqual({ width: 1080, height: 1350 });
  });

  it.each(entries)("%s: stays inside the phone and desktop byte budgets", (_id, image) => {
    /* A phone is served only the 4:5; nothing a phone downloads may pass ~160KB. */
    expect(statSync(onDisk(image.src4x5)).size).toBeLessThanOrEqual(160_000);
    expect(statSync(onDisk(image.src1200)).size).toBeLessThanOrEqual(160_000);
    expect(statSync(onDisk(image.src)).size).toBeLessThanOrEqual(160_000);
  });

  it.each(entries)("%s: carries a blur placeholder and alt text or a decorative mark", (_id, image) => {
    expect(image.blurDataURL).toMatch(/^data:image\/webp;base64,[A-Za-z0-9+/]+=*$/);
    expect(image.blurDataURL.length).toBeLessThan(1000);
    expect(image.decorative || image.alt.trim().length > 0).toBe(true);
    /* Kept even when decorative, so a meaningful use has it. */
    expect(image.alt.trim().length).toBeGreaterThan(20);
  });

  it.each(entries)("%s: approved, sourced, and cropped with valid focal points", (id, image) => {
    expect(image.status).toBe("APPROVED");
    expect(SOURCES).toContain(image.source);
    expect(image.intendedSections.length).toBeGreaterThan(0);
    for (const crop of [image.crop.desktop, image.crop.mobile]) {
      expect(crop.focalPoint).toMatch(/^\d{1,3}% \d{1,3}%$/);
      if (crop.zoom !== undefined) expect(crop.zoom).toBeGreaterThanOrEqual(1);
    }
    expect(productionDetail(id as DetailImageId)).toBe(image);
  });

  it.each([...SECOND_SET, ...THIRD_SET])("%s: decorative, alt kept, and its placeholder is its own", (id) => {
    const image = DETAIL_IMAGES[id as DetailImageId];
    expect(image.decorative).toBe(true);
    expect(image.alt.trim().length).toBeGreaterThan(20);
    expect(SOURCES).toContain(image.source);
    const others = entries.filter(([other]) => other !== id).map(([, o]) => o.blurDataURL);
    expect(others).not.toContain(image.blurDataURL);
  });

  it("the old blur JSON was folded into the manifest and removed", () => {
    expect(existsSync(join(process.cwd(), "details-blur-2.json"))).toBe(false);
  });

  it("hydration-bar crops away the back bar at far left on both frames", () => {
    const { desktop, mobile } = DETAIL_IMAGES["hydration-bar"].crop;
    expect(parseFloat(desktop.focalPoint)).toBe(100);
    expect(desktop.zoom ?? 1).toBeGreaterThanOrEqual(1.6);
    expect(mobile.focalPoint.endsWith("100%")).toBe(true);
    expect(mobile.zoom ?? 1).toBeGreaterThan(1);
  });

  it("the gate refuses an image that is not approved", () => {
    const image = DETAIL_IMAGES["posing-room"];
    const original = image.status;
    try {
      for (const status of ["DRAFT", "REVIEW", "RETIRED"] as const) {
        (image as { status: string }).status = status;
        expect(productionDetail("posing-room")).toBeNull();
      }
    } finally {
      (image as { status: string }).status = original;
    }
  });
});
