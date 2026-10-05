import { expect, test } from "@playwright/test";
import { BORDERED_PANEL_RULE, BROAD_RULE, BROAD_UNROUNDED_RULE, boxesWithin, colorAlpha, nestedSurfaces } from "./support/surface-nesting";

/**
 * Self-test for the shared nesting detector, on fixture HTML in real Chromium:
 * every colour format the browser computes must be read, so no box hides from
 * the check again. Needs no app — the page is set directly.
 */

const FORMATS: [name: string, css: string][] = [
  ["rgba fill", "background-color: rgba(255, 255, 255, 0.05)"],
  ["space rgb fill", "background-color: rgb(255 255 255 / 5%)"],
  ["hex alpha fill", "background-color: #ffffff0d"],
  ["oklab fill (bg-white/5)", "background-color: oklab(1 0 0 / 0.05)"],
  ["oklch fill", "background-color: oklch(0.8 0.1 85 / 0.1)"],
  ["lab fill", "background-color: lab(90 5 10 / 0.1)"],
  ["color(srgb) fill", "background-color: color(srgb 1 1 1 / 0.06)"],
  ["color(display-p3) fill", "background-color: color(display-p3 1 1 1 / 0.06)"],
  ["color-mix fill", "background-color: color-mix(in oklab, white 10%, transparent)"],
  ["color-mix currentColor fill", "color: white; background-color: color-mix(in oklab, currentColor 8%, transparent)"],
  ["gradient fill", "background-image: linear-gradient(180deg, oklab(1 0 0 / 0.04), transparent)"],
  ["url then gradient fill", "background-image: url(data:image/gif;base64,R0lGODlhAQABAAAAACw=), linear-gradient(red, blue)"],
  ["oklab border", "border: 1px solid oklab(1 0 0 / 0.08)"],
  ["hairline oklch border", "border: 0.5px solid oklch(1 0 0 / 0.2)"],
  ["opaque rgb border ending in 0", "border: 1px solid rgb(255, 200, 0)"],
  ["oklab shadow", "box-shadow: 0 10px 30px oklab(0 0 0 / 0.4)"],
  /* The tightened limit: fill at or above 0.012, border at or above 0.02, any visible shadow. */
  ["fill at exactly 0.02 (bg-white/[0.02])", "background-color: oklab(1 0 0 / 0.02)"],
  ["fill at the 0.012 limit", "background-color: oklab(1 0 0 / 0.012)"],
  ["border at the 0.02 limit", "border: 1px solid oklab(1 0 0 / 0.02)"],
  ["faint inset ring shadow", "box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.01)"],
];

const CLEAN: [name: string, css: string][] = [
  ["transparent", "background-color: transparent"],
  ["oklab alpha 0", "background-color: oklab(1 0 0 / 0)"],
  ["fill below threshold", "background-color: oklab(1 0 0 / 0.01)"],
  ["fill just under the 0.012 limit", "background-color: oklab(1 0 0 / 0.011)"],
  ["border under the 0.02 limit", "border: 1px solid oklab(1 0 0 / 0.015)"],
  ["url image only", "background-image: url(data:image/gif;base64,R0lGODlhAQABAAAAACw=)"],
  ["transparent shadow layers", "box-shadow: 0 0 0 0 rgba(0, 0, 0, 0), 0 0 #0000"],
  ["transparent border", "border: 1px solid oklab(1 0 0 / 0)"],
];

/** The nested element of an offender line (its ancestor is described after " inside "). */
const child = (offender: string) => offender.split(" inside ")[0];

const box = (id: string, css: string) =>
  `<div data-case="${id}" style="border-radius:16px;padding:24px;width:320px;${css}"><p>Nested ${id}</p><p>line two</p></div>`;

test.describe("shared surface-nesting detector", () => {
  test("every colour format Chromium computes is read", async ({ page }) => {
    await page.setContent(`<body style="background:#0a0b10;color:#fff"><main>${[...FORMATS, ...CLEAN]
      .map(([, css], i) => `<section style="border-radius:24px;padding:24px;width:420px;background-color:oklab(1 0 0 / 0.04)">${box(`c${i}`, css)}</section>`)
      .join("")}</main></body>`);

    const computed = await page.evaluate(() =>
      [...document.querySelectorAll("[data-case]")].map((el) => {
        const cs = getComputedStyle(el);
        return `${cs.backgroundColor} | ${cs.borderTopColor} | ${cs.boxShadow}`;
      }),
    );
    /* The browser really serialises the modern formats, so the parser is exercised on them. */
    expect(computed.some((c) => c.startsWith("oklab("))).toBe(true);
    expect(computed.some((c) => c.startsWith("oklch("))).toBe(true);
    expect(computed.some((c) => c.startsWith("color(srgb"))).toBe(true);

    const nested = await nestedSurfaces(page);
    FORMATS.forEach(([name], i) => {
      expect(nested.some((n) => child(n).includes(`"Nested c${i}line`)), `${name} is a nested surface · ${computed[i]}`).toBe(true);
    });
    CLEAN.forEach(([name], j) => {
      const i = FORMATS.length + j;
      expect(nested.some((n) => child(n).includes(`"Nested c${i}line`)), `${name} is not a surface · ${computed[i]}`).toBe(false);
    });

    /* Parser and browser agree on the computed strings, in Node too. */
    expect(colorAlpha(computed[3].split(" | ")[0])).toBeCloseTo(0.05, 3);
  });

  test("the documented skips hold, and nothing else is skipped", async ({ page }) => {
    const fill = "background-color:oklab(1 0 0 / 0.06)";
    await page.setContent(`<body style="background:#0a0b10;color:#fff"><main>
      <section style="border-radius:24px;padding:24px;width:480px;${fill}">
        <details><summary>More</summary>${box("closed", fill)}</details>
        <details open><summary>Open</summary>${box("open", fill)}</details>
        <button style="border-radius:16px;width:300px;height:60px;${fill}">A control</button>
        <div role="tablist" style="border-radius:16px;width:300px;height:60px;border:1px solid oklab(1 0 0 / 0.1)"><span role="tab">Tab</span></div>
        <div aria-hidden="true" style="pointer-events:none;border-radius:16px;width:300px;height:60px;${fill}">glow</div>
        <div role="dialog" style="border-radius:16px;${fill}">${box("dialog", fill)}</div>
        <div style="border-top:1px solid oklab(1 0 0 / 0.2);border-radius:12px;width:300px;height:60px">hairline row</div>
        ${box("square", `${fill};border-radius:0`)}
      </section></main></body>`);

    const broad = await nestedSurfaces(page, BROAD_RULE);
    expect(broad.some((n) => child(n).includes("Nested closed")), "closed disclosure skipped").toBe(false);
    expect(broad.some((n) => child(n).includes("Nested open")), "opened disclosure measured").toBe(true);
    expect(broad.some((n) => child(n).startsWith("button")), "buttons are controls").toBe(false);
    expect(broad.some((n) => child(n).includes('"glow"')), "inert decorative layer skipped").toBe(false);
    expect(broad.some((n) => child(n).includes("Nested dialog")), "dialogs are their own layer").toBe(false);
    expect(broad.some((n) => child(n).includes("hairline row")), "a rounded hairline row still draws a border under the broad rule").toBe(true);
    expect(broad.some((n) => child(n).includes("Nested square")), "unrounded fills are outside the broad rule").toBe(false);

    const unrounded = await nestedSurfaces(page, BROAD_UNROUNDED_RULE);
    expect(unrounded.some((n) => child(n).includes("hairline row")), "a one-sided rule is a separator").toBe(false);
    expect(unrounded.some((n) => child(n).includes("Nested square")), "any radius counts").toBe(true);
    expect(unrounded.some((n) => child(n).includes('"Tab"')), "tab strips are controls").toBe(false);

    const bordered = await nestedSurfaces(page, BORDERED_PANEL_RULE);
    expect(bordered, "border-only rule ignores fills").toEqual([]);

    const boxes = await boxesWithin(page.locator("details[open]"));
    expect(boxes.some((b) => b.includes("Nested open"))).toBe(true);
  });
});
