import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { APEX_ROTATION, nextRotationIndex } from "../apex-rotation";
import { LIBRARY_IMAGES } from "../library";

const file = (src: string) => join(process.cwd(), "public", src);

describe("apex rotation", () => {
  it("uses only approved library images, and every file exists", () => {
    for (const item of APEX_ROTATION) {
      expect(LIBRARY_IMAGES[item.id]?.status, item.id).toBe("APPROVED");
      expect(existsSync(file(item.src)), item.src).toBe(true);
      if (item.kind === "clip") {
        expect(LIBRARY_IMAGES[item.id].loop?.status, item.id).toBe("APPROVED");
        expect(existsSync(file(item.poster)), item.poster).toBe(true);
      } else {
        expect(existsSync(file(item.srcSmall)), item.srcSmall).toBe(true);
      }
    }
  });

  it("alternates an earth clip with a cosmic still, and ends on the cosmos", () => {
    /* The river delta was pulled from the seventh slot 2026-09-24 (its clip is
       a truncated 0.21s export), so the round is three clips and the tail is
       two stills rather than one. Every clip still sits on an even index and
       every still is cosmic. */
    expect(APEX_ROTATION.map((item) => item.kind)).toEqual([
      "clip",
      "still",
      "clip",
      "still",
      "clip",
      "still",
      "still",
    ]);
    APEX_ROTATION.forEach((item) => {
      if (item.kind === "still") expect(LIBRARY_IMAGES[item.id].set).toBe("cosmic");
    });
  });

  it("carries no retired motion", () => {
    /* The defect the delta shipped with: a clip cast here while its own
       registration said it could not be served. */
    for (const item of APEX_ROTATION) {
      if (item.kind === "clip") expect(LIBRARY_IMAGES[item.id].loop?.status, item.id).toBe("APPROVED");
    }
    expect(APEX_ROTATION.some((item) => item.id === "river-delta" && item.kind === "clip")).toBe(false);
  });

  it("returns to the room after the last item", () => {
    expect(nextRotationIndex(-1)).toBe(0);
    expect(nextRotationIndex(APEX_ROTATION.length - 1)).toBe(-1);
  });
});
