import type { Locator, Page } from "@playwright/test";

/**
 * One shared, correct "no card in a card" check.
 *
 * Every redesign wave held its screens to a nesting rule, but each spec carried
 * its own copy of the detector, and most copies read a colour's alpha with a
 * regex that only understood `rgb()` / `rgba()`. Tailwind v4 computes
 * `bg-white/5` to `oklab(1 0 0 / 0.05)`, so those copies read every oklab,
 * oklch, lab, color() and color-mix() fill or border as transparent — a box
 * the check could not see. The border-only copies had the opposite slip: their
 * "transparent" regex matched any colour ending in `, 0)`, so an opaque
 * `rgb(255, 200, 0)` rim counted as invisible.
 *
 * This module holds the one colour reader ({@link colorAlpha}) and the one
 * detector ({@link surfaceReport}). Specs pick a documented rule preset; no
 * spec re-implements the measure.
 *
 * Colour formats read (the computed forms Chrome serialises, plus authored ones):
 *   transparent · currentcolor (opaque) · none / empty (0)
 *   rgb() rgba() hsl() hsla() hwb() — comma and space syntax, alpha as number or %
 *   #rgb #rgba #rrggbb #rrggbbaa
 *   lab() lch() oklab() oklch() — `/ a` alpha, number or %
 *   color(srgb | display-p3 | … / a)
 *   color-mix(in <space>, A [p%], B [q%]) — premultiplied weights, recursive
 *   named colours (opaque)
 *   anything unrecognised reads as opaque: a parser gap must over-count, never hide a box.
 *
 * `colorAlpha` must stay self-contained (no outer references): it is shipped
 * into the page as source text and rebuilt there.
 */
export function colorAlpha(input: string): number {
  const read = (raw: string): number => {
    const c = raw.trim().toLowerCase();
    if (!c || c === "none" || c === "transparent") return 0;
    if (c === "currentcolor" || c === "inherit" || c === "initial" || c === "unset") return 1;

    const clamp = (n: number) => (Number.isNaN(n) ? 1 : Math.min(1, Math.max(0, n)));
    const number = (token: string) => {
      const t = token.trim();
      if (t === "none") return 0;
      return t.endsWith("%") ? parseFloat(t) / 100 : parseFloat(t);
    };

    if (c.startsWith("#")) {
      const hex = c.slice(1);
      if (hex.length === 4) return clamp(parseInt(hex[3] + hex[3], 16) / 255);
      if (hex.length === 8) return clamp(parseInt(hex.slice(6, 8), 16) / 255);
      return 1;
    }

    const open = c.indexOf("(");
    if (open < 0 || !c.endsWith(")")) return 1; /* a named colour */
    const fn = c.slice(0, open).trim();
    const body = c.slice(open + 1, -1);

    /* Split on commas that are not inside nested parentheses. */
    const topLevel = (text: string, separator: string) => {
      const parts: string[] = [];
      let depth = 0;
      let start = 0;
      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (ch === "(") depth++;
        else if (ch === ")") depth--;
        else if (ch === separator && depth === 0) {
          parts.push(text.slice(start, i));
          start = i + 1;
        }
      }
      parts.push(text.slice(start));
      return parts.map((p) => p.trim()).filter(Boolean);
    };

    if (fn === "color-mix") {
      /* color-mix(in oklab, A p%, B q%): alpha is the weighted sum, scaled when p+q < 100%. */
      const args = topLevel(body, ",");
      const stops = args.slice(1).map((arg) => {
        const pct = arg.match(/\s(-?[\d.]+)%\s*$|^(-?[\d.]+)%\s/);
        const weight = pct ? parseFloat(pct[1] ?? pct[2]) / 100 : null;
        const color = pct ? arg.replace(pct[0], " ").trim() : arg;
        return { alpha: read(color), weight };
      });
      if (stops.length !== 2) return 1;
      let [a, b] = [stops[0].weight, stops[1].weight];
      if (a === null && b === null) [a, b] = [0.5, 0.5];
      else if (a === null) a = 1 - (b as number);
      else if (b === null) b = 1 - a;
      const sum = (a as number) + (b as number);
      if (sum <= 0) return 0;
      const mixed = (stops[0].alpha * (a as number) + stops[1].alpha * (b as number)) / sum;
      return clamp(sum < 1 ? mixed * sum : mixed);
    }

    /* Modern space syntax: everything after a top-level "/" is the alpha. */
    const slash = topLevel(body, "/");
    if (slash.length === 2) return clamp(number(slash[1]));

    /* Legacy comma syntax: rgba(r, g, b, a) / hsla(h, s, l, a). */
    const commas = topLevel(body, ",");
    if ((fn === "rgb" || fn === "rgba" || fn === "hsl" || fn === "hsla") && commas.length === 4) return clamp(number(commas[3]));

    return 1;
  };
  return read(input);
}

/** True when a computed colour paints nothing. */
export const isTransparentColor = (color: string) => colorAlpha(color) === 0;

/**
 * What the detector counts as a surface, and what it deliberately skips.
 * Every skip is an explicit option so a preset reads as its own documentation.
 */
export type SurfaceRule = {
  /** Which paint makes an element a surface. "broad": border OR fill OR shadow. "border": a visible border only. */
  paint: "broad" | "border";
  /** A border counts when its alpha is AT OR ABOVE this and above 0 (0 = any visible colour). */
  borderAlpha: number;
  /** A background colour counts when its alpha is AT OR ABOVE this and above 0 (0 = any visible colour). */
  fillAlpha: number;
  /** Also count url() background images as fill (gradients always count). */
  imagesFill: boolean;
  /** A border only boxes the element when at least this many sides are drawn (3 = a one-sided hairline or left rule is a separator). */
  minBorderSides: number;
  /** Smallest element that reads as a surface. */
  minWidth: number;
  minHeight: number;
  /** Radius the element needs (0 = none needed). */
  minRadius: number;
  /** "top-left" reads border-top-left-radius; "any" takes the largest corner. */
  radiusCorner: "top-left" | "any";
  /** Count display:inline elements too (a padded inline chip still paints a box). Hidden and display:none never count. */
  includeInline: boolean;
  /** Skip content inside a closed <details> (a member has not opened it). */
  skipClosedDisclosures: boolean;
  /** Skip pointer-events:none layers (decorative glows and scrims). */
  skipInert: boolean;
  /** Skip elements with no text (image frames, bars, empty decorative layers). */
  requireText: boolean;
  /** Controls are never surfaces: buttons, links, fields, segmented tab tracks. */
  controls: string;
  /** Anything inside these is never a surface: dialogs and sheets are their own layer. */
  insideControls: string;
};

const CONTROLS = "button, a, input, select, textarea, summary, label, img, svg, video, canvas";

/**
 * The broad nesting rule the redesign waves enforce: inside a panel, no nested
 * rounded (≥8px) element of 120×48 or more that carries text and draws a
 * border (alpha ≥ 0.02), a tinted background (alpha ≥ 0.012, or any gradient)
 * or any visible shadow. Closed disclosures, inert decorative layers, controls
 * and dialogs are skipped. sr-only text is 1×1px and falls under the size floor.
 *
 * Tightened 2026-09-17: the limit was fill > 0.02 and border > 0.03, so a
 * `bg-white/[0.02]` tile inside a panel passed while still reading as a card.
 * A white fill of 0.012 over the #07080c environment lifts it about 3/255 —
 * the faintest step that still reads as a lighter box; below that is noise.
 */
export const BROAD_RULE: SurfaceRule = {
  paint: "broad",
  borderAlpha: 0.02,
  fillAlpha: 0.012,
  imagesFill: false,
  minBorderSides: 1,
  minWidth: 120,
  minHeight: 48,
  minRadius: 8,
  radiusCorner: "top-left",
  includeInline: false,
  skipClosedDisclosures: true,
  skipInert: true,
  requireText: true,
  controls: CONTROLS,
  insideControls: '[role="dialog"]',
};

/**
 * wave-plan-intel's variant: any radius, but a border must box three or more
 * sides (a hairline or left rule is a separator), and tab strips, listboxes,
 * progress bars and anything inside a button are controls.
 */
export const BROAD_UNROUNDED_RULE: SurfaceRule = {
  ...BROAD_RULE,
  minBorderSides: 3,
  minRadius: 0,
  skipClosedDisclosures: false,
  skipInert: false,
  controls: `${CONTROLS}, [role=tablist], [role=listbox], [role=progressbar]`,
  insideControls: '[role="dialog"], [role="tablist"], [role="listbox"], button',
};

/** The original border-only panel rule: a visible border on an element rounded ≥8px on any corner, 64×40 or more. */
export const BORDERED_PANEL_RULE: SurfaceRule = {
  paint: "border",
  borderAlpha: 0,
  fillAlpha: 0,
  imagesFill: false,
  minBorderSides: 1,
  minWidth: 64,
  minHeight: 40,
  minRadius: 8,
  radiusCorner: "any",
  includeInline: false,
  skipClosedDisclosures: false,
  skipInert: false,
  requireText: false,
  controls: "button, a, input, select, textarea, summary",
  insideControls: '[role="dialog"]',
};

/** womens-rooms: any radius; a border, ANY fill (images included) or a shadow; decorative aria-hidden layers and control contents skipped. */
export const PAINTED_PANEL_RULE: SurfaceRule = {
  ...BORDERED_PANEL_RULE,
  paint: "broad",
  imagesFill: true,
  minRadius: 0,
  controls: "button, a, input, select, textarea, summary, label",
  insideControls: '[role="dialog"], button, a, [aria-hidden="true"]',
};

/** Stricter than the broad rule, for "nothing is boxed in here": any rounded (≥6px) painted element at any size, inline or not, with or without text. */
export const ANY_BOX_RULE: SurfaceRule = {
  ...BROAD_RULE,
  minWidth: 0,
  minHeight: 0,
  minRadius: 6,
  includeInline: true,
  skipClosedDisclosures: false,
  skipInert: false,
  requireText: false,
  controls: "button, a, input, select, textarea, summary, img, svg, video, canvas",
  insideControls: ":not(*)",
};

/**
 * Surfaces owned by a peer session that this suite may not edit. Each one is
 * skipped as a nested offender only (it still counts as an ancestor) and is
 * reported to its owner, not fixed here. Keep every entry narrow.
 *
 *   Cycle Brief (`src/components/cycle/**`, safety session): its "Warning
 *   signs" escalation block is a tinted rounded group inside the brief's
 *   glass panel. Measured true under the corrected check on 2026-09-17
 *   (Compound Command, active member, 1280 and 390).
 */
export type SurfaceScope = {
  /** Root selector (default "main"). Surfaces are looked for inside it; the ancestor walk stops at it. */
  root?: string;
  /** "nested": a surface inside another surface. "any": every surface below the root. */
  mode?: "nested" | "any";
  /** Elements (and their subtrees) owned elsewhere: never reported, still counted as an ancestor. */
  exclude?: string;
  /** Only the first N page sections of `.fba-page` (flattening [data-room-sections]); headers skipped. */
  sections?: number;
  /** Describe with this many class names (default 3). */
  classes?: number;
};

export type SurfaceReport = { offenders: string[]; sections: number };

type InPageArgs = SurfaceRule & SurfaceScope & { alphaSource: string; hasRoot: boolean };

/** The detector, run in the page. Self-contained: Playwright ships it as source. */
function inPage(given: Element | null, o: InPageArgs): SurfaceReport {
  const root = o.hasRoot ? given : document.querySelector(o.root ?? "main");
  if (!root) return { offenders: [`no ${o.root ?? "main"}`], sections: 0 };
  const alpha = new Function(`return (${o.alphaSource})`)() as (c: string) => number;
  const foreign = o.exclude ? new Set(document.querySelectorAll(`${o.exclude}, ${o.exclude.split(",").map((s) => `${s.trim()} *`).join(", ")}`)) : new Set<Element>();

  const closedDisclosure = (el: Element) => {
    for (let d = el.closest("details"); d; d = d.parentElement?.closest("details") ?? null) {
      if (!(d as HTMLDetailsElement).open) return true;
    }
    return false;
  };
  const SIDES = ["top", "right", "bottom", "left"];
  /* A paint counts at or above its limit, and never when fully transparent. */
  const paints = (value: number, limit: number) => value > 0 && value >= limit;
  const CORNERS = ["border-top-left-radius", "border-top-right-radius", "border-bottom-right-radius", "border-bottom-left-radius"];
  /* A box-shadow draws only when one of its layers has a visible colour. */
  const shadowed = (value: string) => {
    if (!value || value === "none") return false;
    let depth = 0;
    let start = 0;
    const layers: string[] = [];
    for (let i = 0; i < value.length; i++) {
      if (value[i] === "(") depth++;
      else if (value[i] === ")") depth--;
      else if (value[i] === "," && depth === 0) {
        layers.push(value.slice(start, i));
        start = i + 1;
      }
    }
    layers.push(value.slice(start));
    return layers.some((layer) => {
      const colour = layer.match(/[a-z-]+\((?:[^()]|\([^()]*\))*\)|#[0-9a-f]{3,8}\b|\btransparent\b/i);
      return colour ? alpha(colour[0]) > 0 : true;
    });
  };
  const isSurface = (el: Element) => {
    if (el.matches(o.controls) || el.closest(o.insideControls)) return false;
    if (o.skipClosedDisclosures && closedDisclosure(el)) return false;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0 || r.width < o.minWidth || r.height < o.minHeight) return false;
    const cs = getComputedStyle(el);
    if ((cs.display === "inline" && !o.includeInline) || cs.display === "none" || cs.visibility === "hidden") return false;
    if (o.minRadius > 0) {
      const radius = o.radiusCorner === "top-left" ? parseFloat(cs.borderTopLeftRadius) : Math.max(...CORNERS.map((c) => parseFloat(cs.getPropertyValue(c)) || 0));
      if (!(radius >= o.minRadius)) return false;
    }
    if (o.skipInert && cs.pointerEvents === "none") return false;
    if (o.requireText && !(el.textContent ?? "").trim()) return false;
    const sides = SIDES.filter(
      (side) =>
        parseFloat(cs.getPropertyValue(`border-${side}-width`)) > 0 &&
        cs.getPropertyValue(`border-${side}-style`) !== "none" &&
        cs.getPropertyValue(`border-${side}-style`) !== "hidden" &&
        paints(alpha(cs.getPropertyValue(`border-${side}-color`)), o.borderAlpha),
    ).length;
    const bordered = sides >= Math.max(1, o.minBorderSides);
    if (o.paint === "border") return bordered;
    const image = cs.backgroundImage;
    const filled = paints(alpha(cs.backgroundColor), o.fillAlpha) || /gradient\(/.test(image) || (o.imagesFill && image !== "none" && image !== "");
    return bordered || filled || shadowed(cs.boxShadow);
  };
  const describe = (el: Element) =>
    `${el.tagName.toLowerCase()}${el.getAttribute("data-testid") ? `[data-testid=${el.getAttribute("data-testid")}]` : ""}.${String(el.getAttribute("class") ?? "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, o.classes ?? 3)
      .join(".")} "${(el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 36)}"`;

  let scopes: Element[] = [root];
  let sections = 0;
  let walkStop: Element = root;
  if (o.sections) {
    const pageEl = root.matches(".fba-page") ? root : root.querySelector(".fba-page");
    if (!pageEl) return { offenders: ["no .fba-page"], sections: 0 };
    const flatten = (parent: Element): Element[] =>
      [...parent.children].flatMap((child) => (child.matches("[data-room-sections]") ? flatten(child) : [child]));
    scopes = flatten(pageEl)
      .filter((el) => !el.matches("header") && !el.querySelector("header"))
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      })
      .slice(0, o.sections);
    sections = scopes.length;
    walkStop = pageEl;
  }

  const offenders: string[] = [];
  for (const scope of scopes) {
    const candidates = o.sections ? [scope, ...scope.querySelectorAll("*")] : [...scope.querySelectorAll("*")];
    for (const el of candidates) {
      if (foreign.has(el) || !isSurface(el)) continue;
      if (o.mode === "any") {
        offenders.push(describe(el));
        continue;
      }
      for (let up = el.parentElement; up && up !== walkStop; up = up.parentElement) {
        if (isSurface(up)) {
          offenders.push(`${describe(el)} inside ${describe(up)}`);
          break;
        }
      }
    }
  }
  return { offenders: [...new Set(offenders)], sections };
}

/**
 * Surfaces found under a rule. Pass a Page (the root is `scope.root`, default
 * `main`) or a Locator (the root is that element).
 */
export async function surfaceReport(target: Page | Locator, rule: SurfaceRule = BROAD_RULE, scope: SurfaceScope = {}): Promise<SurfaceReport> {
  /* Playwright ships a function by its source text, so the detector cannot close over this module:
     both it and the colour reader travel as source and are rebuilt in the page. */
  const source = inPage.toString();
  const args: InPageArgs = { ...rule, ...scope, alphaSource: colorAlpha.toString(), hasRoot: false };
  if (isPage(target)) {
    return target.evaluate(
      ([src, a]) => (new Function("a", `return (${src})(null, a)`) as (a: unknown) => SurfaceReport)(a),
      [source, args] as const,
    );
  }
  return target.evaluate(
    (root, [src, a]) => (new Function("root", "a", `return (${src})(root, a)`) as (r: Element, a: unknown) => SurfaceReport)(root, a),
    [source, { ...args, hasRoot: true }] as const,
  );
}

const isPage = (target: Page | Locator): target is Page => typeof (target as Page).goto === "function";

/** Nested surfaces (card in card) under a rule. */
export async function nestedSurfaces(target: Page | Locator, rule: SurfaceRule = BROAD_RULE, scope: SurfaceScope = {}): Promise<string[]> {
  return (await surfaceReport(target, rule, { ...scope, mode: "nested" })).offenders;
}

/** Every surface below the root under a rule ("nothing is boxed in here"). */
export async function boxesWithin(target: Page | Locator, rule: SurfaceRule = ANY_BOX_RULE, scope: SurfaceScope = {}): Promise<string[]> {
  return (await surfaceReport(target, rule, { ...scope, mode: "any" })).offenders;
}
