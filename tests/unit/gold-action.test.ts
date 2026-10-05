import { describe, expect, it } from "vitest";
import { RESERVE } from "@/lib/design/tokens";
import { GOLD_KIT_SOURCE, gold, type GoldKit } from "../e2e/support/gold-action";

/*
 * The colour reader behind every "exactly one gold action" check. The oklab,
 * oklch, lab, lch and color() strings below are Chromium's own serialisations
 * of the brand tokens (color-mix(in <space>, #d5b15f 100%, transparent)), and
 * the expected sRGB is what Chromium painted for them on a canvas.
 */

const rgb255 = (colour: string) => {
  const c = gold.toSrgb(colour);
  if (!c) throw new Error(`unreadable: ${colour}`);
  return { rgb: [c.r, c.g, c.b].map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255)), a: c.a };
};

describe("toSrgb reads every CSS colour format", () => {
  const GOLD_RGB = [213, 177, 95];
  const cases: [format: string, colour: string, rgb: number[], alpha: number][] = [
    ["rgb comma", "rgb(213, 177, 95)", GOLD_RGB, 1],
    ["rgba comma", "rgba(213, 177, 95, 0.5)", GOLD_RGB, 0.5],
    ["rgb space + % alpha", "rgb(213 177 95 / 40%)", GOLD_RGB, 0.4],
    ["rgb percentages", "rgb(100% 0% 50%)", [255, 0, 128], 1],
    ["hex #rrggbb", "#d5b15f", GOLD_RGB, 1],
    ["hex #rrggbbaa", "#d5b15f80", GOLD_RGB, 128 / 255],
    ["hex #rgb", "#fc0", [255, 204, 0], 1],
    ["hex #rgba", "#fc08", [255, 204, 0], 0x88 / 255],
    ["hsl space", "hsl(42 58% 60%)", [212, 177, 94], 1],
    ["hsla comma", "hsla(42, 58%, 60%, 0.25)", [212, 177, 94], 0.25],
    ["hsl turn hue", "hsl(0.1167turn 58% 60%)", [212, 177, 94], 1],
    ["hwb", "hwb(42 37% 16%)", [214, 178, 94], 1],
    ["hwb grey", "hwb(42 60% 60%)", [128, 128, 128], 1],
    ["oklab", "oklab(0.775526 0.00756922 0.109159)", GOLD_RGB, 1],
    ["oklab alpha", "oklab(0.775526 0.00756922 0.109159 / 0.3)", GOLD_RGB, 0.3],
    ["oklab percentages", "oklab(77.5526% 1.892305% 27.28975%)", GOLD_RGB, 1],
    ["oklch", "oklch(0.775526 0.109421 86.0334)", GOLD_RGB, 1],
    ["oklch authored", "oklch(0.78 0.11 85)", [216, 178, 96], 1],
    ["lab (D50)", "lab(74.1997 6.33806 46.4918)", GOLD_RGB, 1],
    ["lch (D50)", "lch(74.1997 46.9218 82.2369)", GOLD_RGB, 1],
    ["lch authored", "lch(75 45 80)", [217, 178, 102], 1],
    ["color(srgb)", "color(srgb 0.835294 0.694118 0.372549)", GOLD_RGB, 1],
    ["color(srgb-linear)", "color(srgb-linear 0.665387 0.439657 0.114435)", GOLD_RGB, 1],
    ["color(display-p3)", "color(display-p3 0.812614 0.699378 0.42006)", GOLD_RGB, 1],
    ["color(rec2020)", "color(rec2020 0.752471 0.669338 0.371705)", GOLD_RGB, 1],
    ["color(a98-rgb)", "color(a98-rgb 0.793479 0.688267 0.392609)", GOLD_RGB, 1],
    ["color(prophoto-rgb)", "color(prophoto-rgb 0.690519 0.643821 0.363743)", GOLD_RGB, 1],
    ["color(xyz-d65)", "color(xyz-d65 0.452307 0.46417 0.17401)", GOLD_RGB, 1],
    ["color(xyz)", "color(xyz 0.452307 0.46417 0.17401)", GOLD_RGB, 1],
    ["color(xyz-d50)", "color(xyz-d50 0.475857 0.470155 0.133658)", GOLD_RGB, 1],
    ["color(srgb) alpha", "color(srgb 1 1 1 / 0.06)", [255, 255, 255], 0.06],
    ["color-mix oklab", "color-mix(in oklab, #d5b15f 60%, #e8c87a)", [221, 186, 106], 1],
    ["color-mix srgb", "color-mix(in srgb, #d5b15f 50%, #5fb7d5)", [154, 180, 154], 1],
    ["color-mix to transparent", "color-mix(in oklab, #d5b15f 30%, transparent)", GOLD_RGB, 0.3],
    ["color-mix weights under 100%", "color-mix(in srgb, #fff 20%, #000 20%)", [128, 128, 128], 0.4],
    ["named", "goldenrod", [218, 165, 32], 1],
    ["transparent", "transparent", [0, 0, 0], 0],
  ];
  for (const [format, colour, rgb, alpha] of cases) {
    it(`${format}: ${colour}`, () => {
      const read = rgb255(colour);
      read.rgb.forEach((v, i) => expect(Math.abs(v - rgb[i]), `channel ${i} of ${colour}: ${read.rgb}`).toBeLessThanOrEqual(1));
      expect(read.a).toBeCloseTo(alpha, 3);
    });
  }

  it("returns null for what it cannot read", () => {
    expect(gold.toSrgb("currentcolor")).toBeNull();
    expect(gold.toSrgb("color(foo 1 1 1)")).toBeNull();
    expect(gold.toSrgb("#zzzzzz")).toBeNull();
  });
});

describe("gold paint", () => {
  it("the brand gold and its amber gradient partner are gold, in the tokens module and globals", () => {
    expect(gold.isGoldColor(RESERVE.gold)).toBe(true);
    expect(gold.isGoldColor(RESERVE.amber)).toBe(true);
    expect(gold.isGoldColor("rgb(213, 177, 95)")).toBe(true);
  });

  it("is gold in every format", () => {
    for (const colour of [
      "#d5b15f",
      "rgb(213 177 95)",
      "hsl(42 58% 60%)",
      "oklab(0.775526 0.00756922 0.109159)",
      "oklch(0.775526 0.109421 86.0334)",
      "lab(74.1997 6.33806 46.4918)",
      "lch(74.1997 46.9218 82.2369)",
      "color(srgb 0.835294 0.694118 0.372549)",
      "color(display-p3 0.812614 0.699378 0.42006)",
      "color-mix(in oklab, #d5b15f 60%, #e8c87a)",
    ]) {
      expect(gold.isGoldColor(colour), colour).toBe(true);
    }
  });

  it("never counts the other warm or neutral tokens, or a gold tint", () => {
    const notGold: [string, string][] = [
      ["bronze light hairline", "rgb(196, 150, 84)"],
      ["bronze", "#b06038"],
      ["deep bronze", "#a04e30"],
      ["orange amber signal", "#e8a24a"],
      ["orange amber", "#e8954a"],
      ["peach", "#ef9f62"],
      ["alert red", RESERVE.red],
      ["ivory", RESERVE.ivory],
      ["foreground ivory", RESERVE.foreground],
      ["warm white", "#fff7e6"],
      ["steel", RESERVE.steel],
      ["green", RESERVE.green],
      ["violet", RESERVE.violet],
      ["slate", RESERVE.slate],
      ["card", RESERVE.card],
      ["ink", "#0a0b10"],
      ["secondary tier tint (gold at 8%)", "#d5b15f14"],
      ["gold tint at 30% in oklab", "oklab(0.775526 0.00756922 0.109159 / 0.3)"],
      ["gold mixed toward steel", "color-mix(in srgb, #d5b15f 50%, #5fb7d5)"],
    ];
    for (const [name, colour] of notGold) expect(gold.isGoldColor(colour), `${name} ${colour}`).toBe(false);
  });

  it("a gradient is gold when any stop is gold, in any format", () => {
    expect(gold.paintIsGold("linear-gradient(135deg, rgb(213, 177, 95) 0%, rgb(232, 200, 122) 100%)")).toBe(true);
    expect(gold.paintIsGold("linear-gradient(135deg, oklch(0.775526 0.109421 86.0334) 0%, rgba(0, 0, 0, 0) 100%)")).toBe(true);
    expect(gold.paintIsGold("linear-gradient(in oklab 90deg, rgb(95, 183, 213), color(display-p3 0.812614 0.699378 0.42006))")).toBe(true);
    expect(gold.paintIsGold("radial-gradient(circle, color-mix(in oklab, #d5b15f 60%, #e8c87a), transparent)")).toBe(true);
    expect(gold.paintIsGold("linear-gradient(90deg, transparent, rgba(196, 150, 84, 0.55) 30%, rgba(236, 206, 140, 0.3) 62%, transparent)")).toBe(false);
    expect(gold.paintIsGold("url(\"data:image/svg+xml,rgb(213,177,95)\"), linear-gradient(red, blue)")).toBe(false);
    expect(gold.paintIsGold("none")).toBe(false);
    expect(gold.paintIsGold("rgba(0, 0, 0, 0)")).toBe(false);
  });

  it("finds every colour token in a gradient, nested color-mix included", () => {
    expect(gold.paintColors("linear-gradient(90deg, color-mix(in oklab, rgb(1, 2, 3) 20%, transparent) 0%, #fff 50%, oklab(0.5 0 0 / 0.2))")).toEqual([
      "color-mix(in oklab, rgb(1, 2, 3) 20%, transparent)",
      "#fff",
      "oklab(0.5 0 0 / 0.2)",
    ]);
  });

  it("over-counts a colour it cannot read", () => {
    expect(gold.isGoldColor("color(unknown 1 1 1)")).toBe(true);
    expect(gold.isInk("currentcolor")).toBe(true);
  });
});

describe("ink and dark text", () => {
  it("ink is rgb(10, 11, 16) in any format", () => {
    for (const colour of [
      "rgb(10, 11, 16)",
      "#0a0b10",
      "rgb(10 11 16 / 1)",
      "color(srgb 0.0392157 0.0431373 0.0627451)",
      "oklab(0.150937 0.00117578 -0.0108031)",
      "oklch(0.150937 0.0108669 276.21)",
    ]) {
      expect(gold.isInk(colour), colour).toBe(true);
    }
  });

  it("other dark or translucent colours are not ink", () => {
    for (const colour of ["rgb(0, 0, 0)", "rgb(30, 30, 30)", "rgba(10, 11, 16, 0.5)", RESERVE.base, "rgb(213, 177, 95)", RESERVE.gold]) {
      expect(gold.isInk(colour), colour).toBe(false);
    }
  });

  it("dark text is luminance under 80, in any format", () => {
    expect(gold.isDarkText("oklab(0.150937 0.00117578 -0.0108031)")).toBe(true);
    expect(gold.isDarkText("rgb(60, 60, 60)")).toBe(true);
    expect(gold.isDarkText(RESERVE.gold)).toBe(false);
    expect(gold.isDarkText("oklab(1 0 0)")).toBe(false);
  });
});

it("is self-contained, so it can be rebuilt in the page from its source", () => {
  const rebuilt = new Function(`return (${GOLD_KIT_SOURCE})()`)() as GoldKit;
  expect(rebuilt.isGoldColor("oklch(0.775526 0.109421 86.0334)")).toBe(true);
  expect(rebuilt.isInk("color(srgb 0.0392157 0.0431373 0.0627451)")).toBe(true);
});
