import { describe, expect, it } from "vitest";

import { visualAsset } from "@/lib/brand/asset-manifest";

import { cinematicConfig } from "../environments";
import { contrastMode, resolveEnvironmentOverlays } from "../overlays";

function alphas(background: string): number[] {
  return Array.from(background.matchAll(/rgba\(7,8,12,([\d.]+)\)/g), (match) => Number(match[1]));
}

describe("cinematic overlays", () => {
  it("resolves every overlay the reserve gate declares, in order", () => {
    for (const viewport of ["desktop", "mobile"] as const) {
      const resolved = resolveEnvironmentOverlays(cinematicConfig("reserve-gate"), viewport);
      expect(resolved.unsupported).toEqual([]);
      expect(resolved.layers.map((layer) => layer.name)).toEqual(["vertical-scrim-bottom", "vignette"]);
    }
  });

  it("protects the lower band far harder than the top of the frame", () => {
    for (const viewport of ["desktop", "mobile"] as const) {
      const [scrim] = resolveEnvironmentOverlays(cinematicConfig("reserve-gate"), viewport).layers;
      const values = alphas(scrim.background);
      expect(values[0]).toBeLessThanOrEqual(0.25);
      expect(values[values.length - 1]).toBeGreaterThanOrEqual(0.9);
      expect(values.every((value) => value >= 0 && value <= 1)).toBe(true);
    }
  });

  it("presses harder for elevated content contrast than for muted", () => {
    const base = { overlays: ["vertical-scrim-bottom"] };
    const mid = (mode: string) =>
      alphas(resolveEnvironmentOverlays({ ...base, contentContrastMode: mode }, "desktop").layers[0].background)[2];
    expect(mid("elevated")).toBeGreaterThan(mid("standard"));
    expect(mid("standard")).toBeGreaterThan(mid("muted"));
  });

  it("reports hue washes it has no recipe for instead of inventing one", () => {
    const resolved = resolveEnvironmentOverlays(cinematicConfig("biomarker-vault"), "desktop");
    expect(resolved.layers.map((layer) => layer.name)).toEqual(["vertical-scrim-bottom"]);
    expect(resolved.unsupported).toEqual(["cool-tint"]);
  });

  it("reads an unknown contrast mode as standard", () => {
    expect(contrastMode("loud")).toBe("standard");
    expect(contrastMode("elevated")).toBe("elevated");
  });

  it("keeps the gate's focal points in step with the entrance plate the renderer serves", () => {
    expect(cinematicConfig("reserve-gate").focalPoint).toEqual(visualAsset("entrance-gallery")?.focalPoint);
  });
});
