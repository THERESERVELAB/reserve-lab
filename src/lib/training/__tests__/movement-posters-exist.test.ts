import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { MOVEMENT_VISUAL_REGISTRY } from "../movement-visuals";

/**
 * A movement that says it has a poster really has one.
 *
 * A seed marked ready renders an <img> at a fixed path. If the file was never
 * committed — a typo in the slug, an asset left behind in a worktree — the
 * dashboard shows a broken image rather than falling back to the pending
 * state, because the fallback only triggers on `ready: false`. Nothing else in
 * the suite would catch it: the data is internally consistent, it just points
 * at nothing.
 *
 * This walks every ready variant and checks the file on disk.
 */

const PUBLIC_DIR = join(process.cwd(), "public");

describe("movement posters", () => {
  const readyVariants = Object.values(MOVEMENT_VISUAL_REGISTRY)
    // The registry maps aliases to the same object; dedupe by identity.
    .filter((v, i, all) => all.findIndex((o) => o.movementId === v.movementId) === i)
    .flatMap((visual) =>
      visual.variants
        .filter((variant) => variant.ready && variant.image?.desktop)
        .map((variant) => ({
          movement: visual.movementName,
          gender: variant.gender,
          src: variant.image!.desktop!,
        })),
    );

  it("has at least one shipped poster to check", () => {
    expect(readyVariants.length).toBeGreaterThan(0);
  });

  it.each(readyVariants)("$movement ($gender) resolves to a file on disk", ({ src }) => {
    // Paths are web-absolute ("/movements/...") and served from public/.
    expect(existsSync(join(PUBLIC_DIR, src)), `missing asset: public${src}`).toBe(true);
  });

  it("ships at least one female poster, the case the model could not express before", () => {
    expect(readyVariants.some((v) => v.gender === "female")).toBe(true);
  });
});
