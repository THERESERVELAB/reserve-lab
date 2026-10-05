import { describe, expect, it } from "vitest";
import { colorAlpha, isTransparentColor } from "../e2e/support/surface-nesting";

/* The colour reader behind every "no card in a card" check. A format it cannot read must never read as transparent. */
describe("colorAlpha", () => {
  const cases: [string, number][] = [
    ["transparent", 0],
    ["", 0],
    ["none", 0],
    ["currentcolor", 1],
    ["white", 1],
    /* rgb / rgba, comma and space syntax */
    ["rgb(10, 11, 16)", 1],
    ["rgb(255, 200, 0)", 1],
    ["rgb(0, 0, 0)", 1],
    ["rgba(255, 255, 255, 0.05)", 0.05],
    ["rgba(0, 0, 0, 0)", 0],
    ["rgb(255 255 255 / 0.04)", 0.04],
    ["rgb(255 255 255 / 40%)", 0.4],
    /* hsl / hwb */
    ["hsla(40, 50%, 60%, 0.25)", 0.25],
    ["hsl(40 50% 60% / 0.3)", 0.3],
    ["hwb(40 10% 20% / 0.6)", 0.6],
    /* hex */
    ["#d5b15f", 1],
    ["#fff", 1],
    ["#ffffff0d", 13 / 255],
    ["#fff8", 0x88 / 255],
    /* Tailwind v4's computed colours */
    ["oklab(1 0 0 / 0.05)", 0.05],
    ["oklab(0.999994 0.0000455678 0.0000200868 / 0.05)", 0.05],
    ["oklab(0.5 0.1 -0.1)", 1],
    ["oklch(0.8 0.1 85 / 0.12)", 0.12],
    ["oklch(0.8 0.1 85 / 12%)", 0.12],
    ["oklch(0.8 0.1 none / none)", 0],
    ["lab(50 20 30 / 0.5)", 0.5],
    ["lch(50 20 30)", 1],
    ["color(srgb 1 1 1 / 0.06)", 0.06],
    ["color(display-p3 0.8 0.7 0.4)", 1],
    /* color-mix */
    ["color-mix(in oklab, rgb(255, 255, 255) 10%, transparent)", 0.1],
    ["color-mix(in srgb, oklab(1 0 0 / 0.5) 50%, transparent)", 0.25],
    ["color-mix(in oklab, #fff, transparent)", 0.5],
    ["color-mix(in oklab, 30% #fff, rgba(0, 0, 0, 0.5) 70%)", 0.65],
    ["color-mix(in srgb, #fff 20%, #000 20%)", 0.4],
    ["color-mix(in oklab, currentcolor 8%, transparent)", 0.08],
  ];
  for (const [colour, expected] of cases) {
    it(`reads ${colour || "(empty)"} as ${expected.toFixed(3)}`, () => {
      expect(colorAlpha(colour)).toBeCloseTo(expected, 5);
    });
  }

  it("never reads an opaque colour whose last channel is 0 as transparent", () => {
    expect(isTransparentColor("rgb(255, 200, 0)")).toBe(false);
    expect(isTransparentColor("oklab(0.5 0.1 0)")).toBe(false);
    expect(isTransparentColor("oklab(1 0 0 / 0)")).toBe(true);
  });

  it("is self-contained, so it can be rebuilt in the page from its source", () => {
    const rebuilt = new Function(`return (${colorAlpha.toString()})`)() as typeof colorAlpha;
    expect(rebuilt("oklab(1 0 0 / 0.05)")).toBeCloseTo(0.05, 5);
    expect(rebuilt("color-mix(in oklab, #fff 10%, transparent)")).toBeCloseTo(0.1, 5);
  });
});
