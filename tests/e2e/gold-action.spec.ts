import { expect, test } from "@playwright/test";
import { gold, goldActions } from "./support/gold-action";

/**
 * Self-test for the shared gold-action detector, on fixture HTML in real
 * Chromium: a gold fill or ink text is found in whatever format the browser
 * computes it, and the other warm surfaces (bronze, orange amber, ivory, a gold
 * tint) are never counted. Needs no app — the page is set directly.
 */

const INK_OKLAB = "oklab(0.150937 0.00117578 -0.0108031)";

/* name, style — every one is a gold fill under ink text. */
const GOLD: [name: string, css: string][] = [
  ["rgb gradient (ReserveButton primary)", "background-image: linear-gradient(135deg, rgb(213, 177, 95) 0%, rgb(232, 200, 122) 100%); color: rgb(10, 11, 16)"],
  ["hex fill", "background-color: #d5b15f; color: #0a0b10"],
  ["oklab fill, oklab ink", `background-color: oklab(0.775526 0.00756922 0.109159); color: ${INK_OKLAB}`],
  ["oklch fill", "background-color: oklch(0.775526 0.109421 86.0334); color: #0a0b10"],
  ["color(srgb) fill, color(srgb) ink", "background-color: color(srgb 0.835294 0.694118 0.372549); color: color(srgb 0.0392157 0.0431373 0.0627451)"],
  ["display-p3 fill", "background-color: color(display-p3 0.812614 0.699378 0.42006); color: #0a0b10"],
  ["lch fill", "background-color: lch(74.1997 46.9218 82.2369); color: #0a0b10"],
  ["oklch gradient, one gold stop", "background-image: linear-gradient(in oklab 90deg, oklch(0.2 0.02 260), oklch(0.775526 0.109421 86.0334)); color: #0a0b10"],
  ["color-mix fill", "background-color: color-mix(in oklab, #d5b15f 60%, #e8c87a); color: #0a0b10"],
];

/* Warm or neutral surfaces that are NOT the gold action. Ivory or gold text, never ink. */
const NOT_GOLD: [name: string, css: string][] = [
  ["bronze fill", "background-color: #b06038; color: #f2eee6"],
  ["bronze light hairline gradient", "background-image: linear-gradient(90deg, transparent, rgba(196, 150, 84, 0.55) 30%, transparent); color: #f2eee6"],
  ["orange amber fill", "background-color: oklch(0.76 0.13 65); color: #f2eee6"],
  ["ivory fill", "background-color: #f2eee6; color: #d5b15f"],
  ["secondary tier: gold tint under gold text", "background-color: color-mix(in oklab, #d5b15f 8%, transparent); color: #d5b15f"],
  ["steel fill", "background-color: oklab(0.74 -0.07 -0.06); color: #f2eee6"],
];

const button = (id: string, css: string) => `<button data-case="${id}" style="display:block;margin:8px;padding:12px 20px;border:0;${css}">${id}</button>`;

test.describe("shared gold-action detector", () => {
  test("gold fill and ink text are found in every format Chromium computes; bronze, amber, ivory and tints are not", async ({ page }) => {
    await page.setContent(
      `<body style="background:#07080c;color:#fff"><main>${GOLD.map(([, css], i) => button(`gold-${i}`, css)).join("")}${NOT_GOLD.map(([, css], i) => button(`warm-${i}`, css)).join("")}</main></body>`,
    );

    const computed: Record<string, { fill: string; color: string }> = await page.evaluate(() =>
      Object.fromEntries(
        [...document.querySelectorAll("[data-case]")].map((el) => {
          const cs = getComputedStyle(el);
          return [el.getAttribute("data-case"), { fill: `${cs.backgroundColor} ${cs.backgroundImage}`, color: cs.color }];
        }),
      ),
    );
    /* The browser really serialises the modern formats, so the reader is exercised on them. */
    const fills = Object.values(computed).map((c) => c.fill);
    for (const prefix of ["oklab(", "oklch(", "color(srgb", "color(display-p3", "lch("]) {
      expect(fills.some((f) => f.includes(prefix)), `a fill computes to ${prefix}`).toBe(true);
    }
    expect(computed["gold-2"].color.startsWith("oklab("), `ink computes to oklab: ${computed["gold-2"].color}`).toBe(true);

    /* The rgb-only copies this replaces missed these. */
    expect(computed["gold-2"].color === "rgb(10, 11, 16)", "the old string check could not see oklab ink").toBe(false);

    const either = await goldActions(page, { selector: "main button", match: "either" });
    const fill = await goldActions(page, { selector: "main button", match: "fill" });
    const text = await goldActions(page, { selector: "main button", match: "text" });
    const both = await goldActions(page, { selector: "main button", match: "both" });
    const darkFill = await goldActions(page, { selector: "main button", match: "dark-fill" });

    GOLD.forEach(([name], i) => {
      const id = `gold-${i}`;
      const info = JSON.stringify(computed[id]);
      expect(fill, `${name} is a gold fill · ${info}`).toContain(id);
      expect(text, `${name} carries ink · ${info}`).toContain(id);
      expect(both, `${name} is ink on gold · ${info}`).toContain(id);
      expect(darkFill, `${name} is dark text on gold · ${info}`).toContain(id);
      expect(either).toContain(id);
    });
    NOT_GOLD.forEach(([name], i) => {
      const id = `warm-${i}`;
      expect(either, `${name} is not a gold action · ${JSON.stringify(computed[id])}`).not.toContain(id);
    });
    expect(either).toHaveLength(GOLD.length);

    /* Node and the page agree on the computed strings. */
    expect(gold.paintIsGold(computed["gold-3"].fill), computed["gold-3"].fill).toBe(true);
    expect(gold.isInk(computed["gold-2"].color), computed["gold-2"].color).toBe(true);
  });

  test("scope, exclusions, visibility and closed disclosures", async ({ page }) => {
    const primary = "background-image: linear-gradient(135deg, oklch(0.775526 0.109421 86.0334), #e8c87a); color: #0a0b10";
    await page.setContent(`<body style="background:#07080c;color:#fff">
      <header>${button("outside-main", primary)}</header>
      <main>
        ${button("in-main", primary)}
        <a href="tel:911" data-case="call" style="display:block;${primary}">Call</a>
        <details><summary>More</summary>${button("closed", primary)}</details>
        <details open><summary>Open</summary>${button("open", primary)}</details>
        <div style="visibility:hidden">${button("hidden", primary)}</div>
        ${button("zero", `${primary};width:0;height:0;padding:0;overflow:hidden`)}
      </main></body>`);

    expect(await goldActions(page, { selector: "button" })).toEqual(["outside-main", "in-main", "closed", "open", "hidden"]);
    expect(await goldActions(page, { selector: "main button", visible: "rendered" })).toEqual(["in-main", "closed", "open"]);
    expect(await goldActions(page, { selector: "main button", visible: "rendered", skipClosedDisclosures: true })).toEqual(["in-main", "open"]);
    expect(await goldActions(page, { selector: "main button, main a", visible: "rendered", skipClosedDisclosures: true })).toEqual(["in-main", "Call", "open"]);
    expect(await goldActions(page, { selector: "main button, main a", visible: "rendered", skipClosedDisclosures: true, exclude: 'a[href^="tel:"]' })).toEqual(["in-main", "open"]);
    expect(await goldActions(page.locator("details[open]"))).toEqual(["open"]);
  });
});
