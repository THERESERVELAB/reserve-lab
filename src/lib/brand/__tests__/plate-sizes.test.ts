import { describe, expect, it } from "vitest";

import { VISUAL_ASSETS, productionPlate, type VisualAsset } from "../asset-manifest";
import { plateSizes, servedAspectRatio } from "../plate-sizes";

const ROOM: VisualAsset = {
  id: "test-room",
  name: "Test Room",
  environment: "test",
  desktopSrc: "/day-16x9.webp",
  mobileSrc: "/day-9x16.webp",
  desktopAspectRatio: "16:9",
  mobileAspectRatio: "9:16",
  focalPoint: { desktop: "50% 50%", mobile: "50% 40%" },
  uiSafe: { desktop: "centre-band", mobile: "centre-band" },
  intendedScreens: [],
  overlay: "vertical-scrim",
  status: "APPROVED",
  version: 1,
  dayparts: {
    night: { desktopSrc: "/night-16x9.webp", mobileSrc: "/night-9x16.webp", focalPoint: { desktop: "50% 50%", mobile: "50% 40%" }, status: "APPROVED" },
    dawn: { desktopSrc: "/dawn-16x9.webp", mobileSrc: null, focalPoint: { desktop: "50% 50%", mobile: "50% 40%" }, status: "APPROVED" },
  },
};

describe("plateSizes", () => {
  it("asks for the width a cover crop paints at", () => {
    expect(plateSizes("16:9")).toBe("max(100vw, 177.78vh)");
    expect(plateSizes("9:16")).toBe("max(100vw, 56.25vh)");
    expect(plateSizes("nonsense")).toBe("max(100vw, 178vh)");
  });
});

describe("servedAspectRatio", () => {
  it("follows the source actually served, day plate and dayparts alike", () => {
    expect(servedAspectRatio(ROOM, "/day-16x9.webp")).toBe("16:9");
    expect(servedAspectRatio(ROOM, "/day-9x16.webp")).toBe("9:16");
    expect(servedAspectRatio(ROOM, "/night-9x16.webp")).toBe("9:16");
    /* No 9:16 at dawn: a phone is served the 16:9, so it is sized as one. */
    expect(servedAspectRatio(ROOM, "/dawn-16x9.webp")).toBe("16:9");
    expect(servedAspectRatio(null, "/anything.webp")).toBe("16:9");
  });

  it("agrees with the manifest for every approved plate on both viewports", () => {
    for (const asset of Object.values(VISUAL_ASSETS)) {
      const desktop = productionPlate(asset.id, "desktop");
      const mobile = productionPlate(asset.id, "mobile");
      if (!desktop || !mobile) continue;
      expect(servedAspectRatio(asset, desktop.src)).toBe(asset.desktopAspectRatio);
      expect(servedAspectRatio(asset, mobile.src)).toBe(
        mobile.src === asset.desktopSrc ? asset.desktopAspectRatio : asset.mobileAspectRatio,
      );
    }
  });
});
