import type { Locator, Page } from "@playwright/test";

/**
 * One shared "gold action" detector.
 *
 * Bible §11: the gold CTA is scarce — one per screen. ReserveButton's primary
 * tier paints it: a gold → amber gradient (`RESERVE.gold` #d5b15f →
 * `RESERVE.amber` #e8c87a) under near-black ink (#0a0b10, computed
 * `rgb(10, 11, 16)`).
 *
 * Every spec used to carry its own copy of the count, and every copy compared
 * computed colours as `rgb()` strings: `color === "rgb(10, 11, 16)"`, a
 * `rgba?\(` regex over the fill, or `includes("rgb(213, 177, 95)")`. A gold
 * fill or ink that computes to oklab / oklch / lab / color() (Tailwind v4
 * utilities, `color-mix()`, a display-p3 token) slipped past every one of them.
 *
 * This module converts ANY CSS colour to sRGB and decides by colour, not by
 * string:
 *   · gold paint — hue 37°–49°, saturation ≥ 40 %, lightness 40–85 %, alpha ≥ 0.5.
 *     The brand gold (41.7°, 58 %, 60 %) and its gradient partner amber
 *     (42.6°, 70 %, 69 %) sit in the middle. Kept out on purpose: the "bronze
 *     light" hairline rgb(196, 150, 84) (35.4°), orange-amber signals #e8a24a
 *     (33.4°) / #ef9f62 / #e8954a, bronze #b06038 / #a04e30, alert red #ef7d55,
 *     ivory #f2eee6 / #fff7e6 (lightness > 90 %) and gold tints under alpha 0.5.
 *   · a gradient (any background-image) is gold paint when ANY colour stop is gold.
 *   · ink — within 2/255 per channel of rgb(10, 11, 16), alpha ≥ 0.9 (the
 *     environment #07080c, 3–4/255 away, is not ink).
 *   · dark text — relative luminance under 80/255 (the "text this dark only sits
 *     on a filled accent" test redesign-foundation uses).
 *
 * Colour formats read: transparent · named (black, white, gold, goldenrod) ·
 * #rgb #rgba #rrggbb #rrggbbaa · rgb() rgba() hsl() hsla() hwb() in comma and
 * space syntax with number / % / none channels and deg / rad / grad / turn hues ·
 * lab() lch() (CIE D50 → Bradford → D65) · oklab() oklch() ·
 * color(srgb | srgb-linear | display-p3 | a98-rgb | rec2020 | prophoto-rgb |
 * xyz | xyz-d65 | xyz-d50) · color-mix(in <space>, A [p%], B [q%]), mixed
 * premultiplied in oklab (oklab / oklch / lab / lch), linear sRGB (srgb-linear /
 * xyz*) or gamma sRGB (everything else) — best effort, recursive.
 *
 * A colour the reader cannot parse (currentcolor, an unknown function) counts
 * as gold paint AND as ink: a parser gap must over-count and fail an "exactly
 * one" assertion loudly, never hide a gold action.
 *
 * `goldKit` must stay self-contained (no outer references): it is shipped into
 * the page as source text and rebuilt there ({@link GOLD_KIT_SOURCE}).
 */
export function goldKit() {
  type Rgba = { r: number; g: number; b: number; a: number };
  type M3 = number[][];

  const mul = (m: M3, v: number[]) => m.map((row) => row[0] * v[0] + row[1] * v[1] + row[2] * v[2]);
  const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

  /* sRGB transfer (sign-preserving, so out-of-gamut values survive to the clamp). */
  const srgbEncode = (v: number) => {
    const s = Math.sign(v);
    const x = Math.abs(v);
    return s * (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055);
  };
  const srgbDecode = (v: number) => {
    const s = Math.sign(v);
    const x = Math.abs(v);
    return s * (x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4));
  };

  const XYZ65_TO_LSRGB: M3 = [
    [3.2409699419045226, -1.537383177570094, -0.4986107602930034],
    [-0.9692436362808796, 1.8759675015077202, 0.04155505740717559],
    [0.05563007969699366, -0.20397695888897652, 1.0569715142428786],
  ];
  const D50_TO_D65: M3 = [
    [0.9554734527042182, -0.023098536874261423, 0.0632593086610217],
    [-0.028369706963208136, 1.0099954580058226, 0.021041398966943008],
    [0.012314001688319899, -0.020507696433477912, 1.3303659366080753],
  ];
  const P3_TO_XYZ65: M3 = [
    [0.4865709486482162, 0.26566769316909306, 0.1982172852343625],
    [0.2289745640697488, 0.6917385218365064, 0.079286914093745],
    [0, 0.04511338185890264, 1.043944368900976],
  ];
  const A98_TO_XYZ65: M3 = [
    [0.5766690429101305, 0.1855582379065463, 0.1882286462349947],
    [0.29734497525053605, 0.6273635662554661, 0.08073335699413793],
    [0.02703136138641234, 0.07068885253582723, 0.9913375368376388],
  ];
  const REC2020_TO_XYZ65: M3 = [
    [0.6369580483012914, 0.14461690358620832, 0.1688809751641721],
    [0.2627002120112671, 0.6779980715188708, 0.05930171646986196],
    [0, 0.028072693049087428, 1.060985057710791],
  ];
  const PROPHOTO_TO_XYZ50: M3 = [
    [0.7977604896723027, 0.13518583717574031, 0.0313493495815248],
    [0.2880711282292934, 0.7118432178101014, 0.00008565396060525902],
    [0, 0, 0.8251046025104601],
  ];

  const fromLinear = (lin: number[], a: number): Rgba => ({ r: srgbEncode(lin[0]), g: srgbEncode(lin[1]), b: srgbEncode(lin[2]), a });
  const fromXyz65 = (xyz: number[], a: number) => fromLinear(mul(XYZ65_TO_LSRGB, xyz), a);
  const fromXyz50 = (xyz: number[], a: number) => fromXyz65(mul(D50_TO_D65, xyz), a);

  const oklabToLinear = (L: number, A: number, B: number) => {
    const l = Math.pow(L + 0.3963377774 * A + 0.2158037573 * B, 3);
    const m = Math.pow(L - 0.1055613458 * A - 0.0638541728 * B, 3);
    const s = Math.pow(L - 0.0894841775 * A - 1.291485548 * B, 3);
    return [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
    ];
  };
  const linearToOklab = (lin: number[]) => {
    const l = Math.cbrt(0.4122214708 * lin[0] + 0.5363325363 * lin[1] + 0.0514459929 * lin[2]);
    const m = Math.cbrt(0.2119034982 * lin[0] + 0.6806995451 * lin[1] + 0.1073969566 * lin[2]);
    const s = Math.cbrt(0.0883024619 * lin[0] + 0.2817188376 * lin[1] + 0.6299787005 * lin[2]);
    return [
      0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
      1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
      0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
    ];
  };
  const labToXyz50 = (L: number, A: number, B: number) => {
    const kappa = 24389 / 27;
    const eps = 216 / 24389;
    const fy = (L + 16) / 116;
    const fx = fy + A / 500;
    const fz = fy - B / 200;
    const x = Math.pow(fx, 3) > eps ? Math.pow(fx, 3) : (116 * fx - 16) / kappa;
    const y = L > kappa * eps ? Math.pow(fy, 3) : L / kappa;
    const z = Math.pow(fz, 3) > eps ? Math.pow(fz, 3) : (116 * fz - 16) / kappa;
    return [x * (0.3457 / 0.3585), y, z * ((1 - 0.3457 - 0.3585) / 0.3585)];
  };

  const hslToRgb = (h: number, s: number, l: number): number[] => {
    const hue = ((h % 360) + 360) % 360;
    const f = (n: number) => {
      const k = (n + hue / 30) % 12;
      const a = s * Math.min(l, 1 - l);
      return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    };
    return [f(0), f(8), f(4)];
  };

  const NAMED: Record<string, Rgba> = {
    transparent: { r: 0, g: 0, b: 0, a: 0 },
    black: { r: 0, g: 0, b: 0, a: 1 },
    white: { r: 1, g: 1, b: 1, a: 1 },
    gold: { r: 1, g: 215 / 255, b: 0, a: 1 },
    goldenrod: { r: 218 / 255, g: 165 / 255, b: 32 / 255, a: 1 },
  };

  /* Split a function body on top-level separators; tokens after a top-level "/" are the alpha. */
  const tokenize = (body: string) => {
    const channels: string[] = [];
    let alpha: string | null = null;
    let slash = false;
    let commas = 0;
    let depth = 0;
    let current = "";
    const flush = () => {
      const t = current.trim();
      if (t) {
        if (slash) alpha = t;
        else channels.push(t);
      }
      current = "";
    };
    for (const ch of body) {
      if (ch === "(") depth++;
      if (ch === ")") depth--;
      if (depth === 0 && (ch === " " || ch === "," || ch === "/" || ch === "\t" || ch === "\n")) {
        flush();
        if (ch === "/") slash = true;
        if (ch === ",") commas++;
        continue;
      }
      current += ch;
    }
    flush();
    if (!slash && commas > 0 && channels.length === 4) alpha = channels.pop() as string;
    return { channels, alpha };
  };

  const num = (token: string | undefined, percentScale: number) => {
    if (token === undefined || token === "none") return 0;
    if (token.endsWith("%")) return (parseFloat(token) / 100) * percentScale;
    return parseFloat(token);
  };
  const hueOf = (token: string | undefined) => {
    if (token === undefined || token === "none") return 0;
    const v = parseFloat(token);
    if (token.endsWith("grad")) return v * 0.9;
    if (token.endsWith("rad")) return (v * 180) / Math.PI;
    if (token.endsWith("turn")) return v * 360;
    return v;
  };
  const alphaOf = (token: string | null) => (token === null ? 1 : clamp01(num(token, 1)));

  const toSrgb = (input: string): Rgba | null => {
    const c = input.trim().toLowerCase();
    if (!c) return null;
    if (NAMED[c]) return NAMED[c];
    if (c.startsWith("#")) {
      const hex = c.slice(1);
      if (!/^[0-9a-f]+$/.test(hex)) return null;
      const full = hex.length <= 4 ? [...hex].map((h) => h + h).join("") : hex;
      if (full.length !== 6 && full.length !== 8) return null;
      const at = (i: number) => parseInt(full.slice(i, i + 2), 16) / 255;
      return { r: at(0), g: at(2), b: at(4), a: full.length === 8 ? at(6) : 1 };
    }
    const open = c.indexOf("(");
    if (open < 0 || !c.endsWith(")")) return null;
    const fn = c.slice(0, open).trim();
    const body = c.slice(open + 1, -1);

    if (fn === "color-mix") return mix(body);

    const { channels: ch, alpha } = tokenize(body);
    const a = alphaOf(alpha);
    const bad = (values: number[]) => values.some((v) => Number.isNaN(v));

    switch (fn) {
      case "rgb":
      case "rgba": {
        const v = ch.slice(0, 3).map((t) => (t.endsWith("%") ? num(t, 1) : num(t, 1) / 255));
        return ch.length < 3 || bad(v) ? null : { r: v[0], g: v[1], b: v[2], a };
      }
      case "hsl":
      case "hsla": {
        const s = ch[1]?.endsWith("%") ? num(ch[1], 1) : num(ch[1], 1) / 100;
        const l = ch[2]?.endsWith("%") ? num(ch[2], 1) : num(ch[2], 1) / 100;
        const v = hslToRgb(hueOf(ch[0]), clamp01(s), clamp01(l));
        return ch.length < 3 || bad(v) ? null : { r: v[0], g: v[1], b: v[2], a };
      }
      case "hwb": {
        const w = ch[1]?.endsWith("%") ? num(ch[1], 1) : num(ch[1], 1) / 100;
        const bk = ch[2]?.endsWith("%") ? num(ch[2], 1) : num(ch[2], 1) / 100;
        if (w + bk >= 1) {
          const grey = w / (w + bk);
          return { r: grey, g: grey, b: grey, a };
        }
        const base = hslToRgb(hueOf(ch[0]), 1, 0.5);
        const v = base.map((x) => x * (1 - w - bk) + w);
        return ch.length < 3 || bad(v) ? null : { r: v[0], g: v[1], b: v[2], a };
      }
      case "lab": {
        const v = [num(ch[0], 100), num(ch[1], 125), num(ch[2], 125)];
        return ch.length < 3 || bad(v) ? null : fromXyz50(labToXyz50(v[0], v[1], v[2]), a);
      }
      case "lch": {
        const L = num(ch[0], 100);
        const C = num(ch[1], 150);
        const H = (hueOf(ch[2]) * Math.PI) / 180;
        const v = [L, C * Math.cos(H), C * Math.sin(H)];
        return ch.length < 3 || bad(v) ? null : fromXyz50(labToXyz50(v[0], v[1], v[2]), a);
      }
      case "oklab": {
        const v = [num(ch[0], 1), num(ch[1], 0.4), num(ch[2], 0.4)];
        return ch.length < 3 || bad(v) ? null : fromLinear(oklabToLinear(v[0], v[1], v[2]), a);
      }
      case "oklch": {
        const L = num(ch[0], 1);
        const C = num(ch[1], 0.4);
        const H = (hueOf(ch[2]) * Math.PI) / 180;
        const v = [L, C * Math.cos(H), C * Math.sin(H)];
        return ch.length < 3 || bad(v) ? null : fromLinear(oklabToLinear(v[0], v[1], v[2]), a);
      }
      case "color": {
        const space = ch[0];
        const v = ch.slice(1, 4).map((t) => num(t, 1));
        if (ch.length < 4 || bad(v)) return null;
        switch (space) {
          case "srgb":
            return { r: v[0], g: v[1], b: v[2], a };
          case "srgb-linear":
            return fromLinear(v, a);
          case "display-p3":
            return fromXyz65(mul(P3_TO_XYZ65, v.map(srgbDecode)), a);
          case "a98-rgb":
            return fromXyz65(mul(A98_TO_XYZ65, v.map((x) => Math.sign(x) * Math.pow(Math.abs(x), 563 / 256))), a);
          case "rec2020": {
            const alpha2020 = 1.09929682680944;
            const beta2020 = 0.018053968510807;
            const decode = (x: number) => {
              const s = Math.sign(x);
              const ax = Math.abs(x);
              return s * (ax < beta2020 * 4.5 ? ax / 4.5 : Math.pow((ax + alpha2020 - 1) / alpha2020, 1 / 0.45));
            };
            return fromXyz65(mul(REC2020_TO_XYZ65, v.map(decode)), a);
          }
          case "prophoto-rgb": {
            const decode = (x: number) => {
              const s = Math.sign(x);
              const ax = Math.abs(x);
              return s * (ax <= 16 / 512 ? ax / 16 : Math.pow(ax, 1.8));
            };
            return fromXyz50(mul(PROPHOTO_TO_XYZ50, v.map(decode)), a);
          }
          case "xyz":
          case "xyz-d65":
            return fromXyz65(v, a);
          case "xyz-d50":
            return fromXyz50(v, a);
          default:
            return null;
        }
      }
      default:
        return null;
    }
  };

  /* color-mix(in <space> [<hue-method> hue], A [p%], B [q%]) — premultiplied, best effort. */
  function mix(body: string): Rgba | null {
    const parts: string[] = [];
    let depth = 0;
    let start = 0;
    for (let i = 0; i < body.length; i++) {
      if (body[i] === "(") depth++;
      else if (body[i] === ")") depth--;
      else if (body[i] === "," && depth === 0) {
        parts.push(body.slice(start, i).trim());
        start = i + 1;
      }
    }
    parts.push(body.slice(start).trim());
    if (parts.length !== 3) return null;
    const space = parts[0].replace(/^in\s+/, "").split(/\s+/)[0];
    const stops = parts.slice(1).map((arg) => {
      const pct = arg.match(/\s(-?[\d.]+)%\s*$|^(-?[\d.]+)%\s/);
      const weight = pct ? parseFloat(pct[1] ?? pct[2]) / 100 : null;
      return { color: toSrgb(pct ? arg.replace(pct[0], " ").trim() : arg), weight };
    });
    const [s0, s1] = stops;
    if (!s0.color || !s1.color) return null;
    let [p, q] = [s0.weight, s1.weight];
    if (p === null && q === null) [p, q] = [0.5, 0.5];
    else if (p === null) p = 1 - (q as number);
    else if (q === null) q = 1 - p;
    const sum = (p as number) + (q as number);
    if (sum <= 0) return { r: 0, g: 0, b: 0, a: 0 };
    const w0 = (p as number) / sum;
    const w1 = (q as number) / sum;

    const perceptual = ["oklab", "oklch", "lab", "lch"].includes(space);
    const linear = ["srgb-linear", "xyz", "xyz-d65", "xyz-d50"].includes(space);
    const into = (c: Rgba) => {
      const lin = [c.r, c.g, c.b].map(srgbDecode);
      return perceptual ? linearToOklab(lin) : linear ? lin : [c.r, c.g, c.b];
    };
    const a0 = s0.color.a;
    const a1 = s1.color.a;
    const alpha = a0 * w0 + a1 * w1;
    const v0 = into(s0.color);
    const v1 = into(s1.color);
    const out = [0, 1, 2].map((i) => (alpha === 0 ? 0 : (v0[i] * a0 * w0 + v1[i] * a1 * w1) / alpha));
    const finalAlpha = clamp01(sum < 1 ? alpha * sum : alpha);
    if (perceptual) return fromLinear(oklabToLinear(out[0], out[1], out[2]), finalAlpha);
    if (linear) return fromLinear(out, finalAlpha);
    return { r: out[0], g: out[1], b: out[2], a: finalAlpha };
  }

  /* Hue (deg), saturation and lightness (0–1) of an sRGB colour, clamped into gamut first. */
  const hsl = (c: Rgba) => {
    const [r, g, b] = [c.r, c.g, c.b].map(clamp01);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    const d = max - min;
    if (d === 0) return { h: 0, s: 0, l };
    const s = d / (1 - Math.abs(2 * l - 1));
    let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
    return { h, s, l };
  };

  /** The gold family: the brand gold and its amber gradient partner, opaque enough to read as a fill. */
  const GOLD = { hueMin: 37, hueMax: 49, satMin: 0.4, lightMin: 0.4, lightMax: 0.85, alphaMin: 0.5 };
  const INK = { r: 10, g: 11, b: 16, tolerance: 2, alphaMin: 0.9 };

  const isGoldColor = (color: string) => {
    const c = toSrgb(color);
    if (!c) return true;
    const { h, s, l } = hsl(c);
    return c.a >= GOLD.alphaMin && h >= GOLD.hueMin && h <= GOLD.hueMax && s >= GOLD.satMin && l >= GOLD.lightMin && l <= GOLD.lightMax;
  };

  const isInk = (color: string) => {
    const c = toSrgb(color);
    if (!c) return true;
    const close = (v: number, target: number) => Math.abs(clamp01(v) * 255 - target) <= INK.tolerance;
    return c.a >= INK.alphaMin && close(c.r, INK.r) && close(c.g, INK.g) && close(c.b, INK.b);
  };

  /** Text this dark only ever sits on a filled accent (luminance under 80/255). */
  const isDarkText = (color: string) => {
    const c = toSrgb(color);
    if (!c) return true;
    const [r, g, b] = [c.r, c.g, c.b].map((v) => clamp01(v) * 255);
    return c.a >= 0.5 && 0.2126 * r + 0.7152 * g + 0.0722 * b < 80;
  };

  /** Every colour token in a computed paint value (background-color, background-image, gradients). url() contents are skipped. */
  const paintColors = (value: string): string[] => {
    const text = (value || "").toLowerCase();
    const out: string[] = [];
    const pattern = /(?<![\w-])(url|color-mix|rgba?|hsla?|hwb|oklab|oklch|lab|lch|color)\(|#[0-9a-f]{3,8}(?![0-9a-z])|(?<![\w-])(transparent|black|white|goldenrod|gold)(?![\w-])/g;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text))) {
      if (match[0].startsWith("#") || match[2]) {
        out.push(match[0]);
        continue;
      }
      let depth = 0;
      let end = match.index + match[0].length - 1;
      for (; end < text.length; end++) {
        if (text[end] === "(") depth++;
        else if (text[end] === ")" && --depth === 0) break;
      }
      if (match[1] !== "url") out.push(text.slice(match.index, end + 1));
      pattern.lastIndex = end + 1;
    }
    return out;
  };

  /** A paint is gold when any colour in it is gold: a flat fill, or any stop of a gradient. */
  const paintIsGold = (value: string) => paintColors(value).some(isGoldColor);

  return { toSrgb, isGoldColor, isInk, isDarkText, paintColors, paintIsGold, GOLD, INK };
}

/** The kit in Node (unit tests, specs that read a colour outside the page). */
export const gold = goldKit();

/** The kit's source, for rebuilding it inside a page: `new Function(\`return (${GOLD_KIT_SOURCE})()\`)()`. */
export const GOLD_KIT_SOURCE = goldKit.toString();

export type GoldKit = ReturnType<typeof goldKit>;

/**
 * Which paint makes a control a gold action.
 *   "text"      ink text (rgb(10, 11, 16) in any format)
 *   "fill"      gold paint (background-color or any background-image stop)
 *   "either"    ink text OR gold paint
 *   "both"      ink text AND gold paint
 *   "dark-fill" gold paint AND dark text (luminance < 80) — a gold TINT behind gold or ivory text is a state, not an action
 */
export type GoldMatch = "text" | "fill" | "either" | "both" | "dark-fill";

export type GoldScan = {
  /** Controls to consider (default "button"). */
  selector?: string;
  match?: GoldMatch;
  /** Controls matching this are never counted (e.g. the escalation ladder's tel:/sms: links). */
  exclude?: string;
  /**
   * When a control is on screen enough to count.
   *   "box"       non-zero bounding box
   *   "rendered"  non-zero box, not visibility:hidden, not display:none
   *   "laid-out"  offsetParent !== null
   */
  visible?: "box" | "rendered" | "laid-out";
  /** Skip controls inside a closed <details>. */
  skipClosedDisclosures?: boolean;
  /** Label length (default 40). Whitespace is collapsed. */
  label?: number;
};

type GoldInPageArgs = GoldScan & { kitSource: string; hasRoot: boolean };

function goldInPage(root: Element | null, o: GoldInPageArgs): string[] {
  const kit = new Function(`return (${o.kitSource})()`)() as GoldKit;
  const scope: ParentNode = o.hasRoot && root ? root : document;
  const visible = (el: Element) => {
    const mode = o.visible ?? "box";
    if (mode === "laid-out") return (el as HTMLElement).offsetParent !== null;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    if (mode === "box") return true;
    const cs = getComputedStyle(el);
    return cs.visibility !== "hidden" && cs.display !== "none";
  };
  const closed = (el: Element) => {
    for (let d = el.closest("details"); d; d = d.parentElement?.closest("details") ?? null) {
      if (!(d as HTMLDetailsElement).open) return true;
    }
    return false;
  };
  return [...scope.querySelectorAll(o.selector ?? "button")]
    .filter((el) => visible(el) && !(o.exclude && el.matches(o.exclude)) && !(o.skipClosedDisclosures && closed(el)))
    .filter((el) => {
      const cs = getComputedStyle(el);
      const ink = () => kit.isInk(cs.color);
      const fill = () => kit.paintIsGold(cs.backgroundColor) || kit.paintIsGold(cs.backgroundImage);
      switch (o.match ?? "either") {
        case "text":
          return ink();
        case "fill":
          return fill();
        case "both":
          return ink() && fill();
        case "dark-fill":
          return fill() && kit.isDarkText(cs.color);
        default:
          return ink() || fill();
      }
    })
    .map((el) => (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, o.label ?? 40));
}

const isPage = (target: Page | Locator): target is Page => typeof (target as Page).goto === "function";

/**
 * Gold actions, labelled. Pass a Page (controls anywhere in the document that
 * match `selector`) or a Locator (controls inside that element).
 */
export async function goldActions(target: Page | Locator, scan: GoldScan = {}): Promise<string[]> {
  const source = goldInPage.toString();
  const args: GoldInPageArgs = { ...scan, kitSource: GOLD_KIT_SOURCE, hasRoot: false };
  if (isPage(target)) {
    return target.evaluate(([src, a]) => (new Function("a", `return (${src})(null, a)`) as (a: unknown) => string[])(a), [source, args] as const);
  }
  return target.evaluate(
    (root, [src, a]) => (new Function("root", "a", `return (${src})(root, a)`) as (r: Element, a: unknown) => string[])(root, a),
    [source, { ...args, hasRoot: true }] as const,
  );
}
