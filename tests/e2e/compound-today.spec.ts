import { test, expect, type Page } from "@playwright/test";

import { goldActions } from "./support/gold-action";
import { heavySeed } from "./support/compound-heavy-seed";
import { BROAD_RULE, nestedSurfaces } from "./support/surface-nesting";

/**
 * COMPOUND COMMAND · TODAY — the day as an instrument, not a list.
 *
 * Owner, 2026-09-17: "it looks like a list that never ends … the logged list
 * sits right under the need-logging list", then "Separate my heroes from my
 * add-ons."
 *
 * A heavy member at 4:12 PM: four main compounds (one logged with no site log
 * yet, one due, one missed, one tonight) and eleven add-ons (four logged, one
 * skipped, three due, the rest tonight).
 *
 *   · the main compounds are instruments inside the room hero, above every
 *     add-on, and all of them sit in the first phone viewport however many
 *     add-ons there are
 *   · the entry the one gold action logs is the one marked "Up next"
 *   · logging an add-on keeps its marker in place and flips its state; the
 *     progress line advances; the mark is a neutral "Logged"
 *   · skip, site log, edit and the compound's full sheet are one tap from a marker
 *   · moving an entry between tiers is the member's choice and persists
 *   · a height budget for Today at 390
 */

const KEY = "final-boss-athlete-settings";
/** Tuesday 15 September 2026, 4:12 PM local. */
const WHEN = new Date(2026, 8, 15, 16, 12, 0);

async function boot(page: Page) {
  await page.clock.setFixedTime(WHEN);
  const seed = JSON.stringify(heavySeed(WHEN));
  await page.addInitScript(({ k, v }) => {
    /* Seed once: a reload must read what the member saved, not the seed again. */
    if (window.sessionStorage.getItem("compound-today-seeded")) return;
    window.sessionStorage.setItem("compound-today-seeded", "1");
    window.localStorage.setItem("fba-preview-view", "supplements");
    window.localStorage.setItem(k, v);
  }, { k: KEY, v: seed });
  await page.goto("/", { waitUntil: "domcontentloaded", timeout: 120_000 });
  /* The dev server's issue badge sits over a phone sheet's footer (as in phone-shell / phone-feel); it does not exist in production. */
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await expect(page.locator('[data-record="compound-command"]')).toBeVisible({ timeout: 120_000 });
  await expect(page.locator('[data-compound="today"]')).toBeVisible({ timeout: 60_000 });
}

const heroes = (page: Page) => page.locator('[data-today-tier="hero"] [data-today-entry]');
const addOns = (page: Page) => page.locator('[data-today-tier="add-on"] [data-today-entry]');
const marker = (page: Page, name: string) => page.locator("[data-today-entry]", { hasText: name }).first();
/* Add-ons sit in daypart rows; only the next daypart with anything to mark is open. The total is the progress line's. */
const addOnTotal = (page: Page, total: number) => expect(page.locator('[data-compound="today-progress"]')).toContainText(`of ${total} logged`);
async function openDaypart(page: Page, daypart: "morning" | "midday" | "evening" | "night") {
  const row = page.locator(`[data-daypart="${daypart}"]`);
  if ((await row.getAttribute("data-open")) !== "true") await row.locator("> button").click();
  await expect(row).toHaveAttribute("data-open", "true");
}

/** Wait until React has wired a control, so the first click is not lost to hydration. */
async function wired(locator: ReturnType<Page["locator"]>) {
  await expect(locator).toBeVisible({ timeout: 60_000 });
  await expect.poll(() => locator.evaluate((el) => Object.keys(el).some((key) => key.startsWith("__reactProps"))), { timeout: 60_000 }).toBe(true);
}

for (const vp of [
  { name: "1280", width: 1280, height: 900, touch: false },
  { name: "390", width: 390, height: 844, touch: true },
] as const) {
  test.describe(`compound today at ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.touch, isMobile: vp.touch });

    test("main compounds lead as instruments; the gold logs the one marked Up next", async ({ page }) => {
      test.setTimeout(240_000);
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
      await boot(page);

      /* Four main compounds in the hero, in time order; eleven add-ons below. */
      await expect(heroes(page)).toHaveCount(4);
      expect((await heroes(page).allInnerTexts()).map((t) => t.match(/Testosterone|BPC-157|Oxandrolone|Tirzepatide/)?.[0])).toEqual([
        "Testosterone", "Oxandrolone", "BPC-157", "Tirzepatide",
      ]);
      await addOnTotal(page, 11);
      /* Morning is all logged and folds to one line; Midday (the next with anything to mark) is open. */
      await expect(page.locator('[data-daypart="morning"]')).toHaveAttribute("data-open", "false");
      await expect(page.locator('[data-daypart="morning"]')).toContainText("3 of 3 logged");
      await expect(page.locator('[data-daypart="midday"]')).toHaveAttribute("data-open", "true");
      const heroBottom = await heroes(page).evaluateAll((els) => Math.max(...els.map((el) => el.getBoundingClientRect().bottom)));
      const addOnTop = await addOns(page).evaluateAll((els) => Math.min(...els.map((el) => el.getBoundingClientRect().top)));
      expect(heroBottom, "every main compound sits above every add-on").toBeLessThan(addOnTop);

      /* Each hero carries its own state and time. */
      await expect(marker(page, "Testosterone Cypionate")).toHaveAttribute("data-state", "logged");
      await expect(marker(page, "Testosterone Cypionate")).toContainText("Site log needed");
      await expect(marker(page, "Oxandrolone")).toHaveAttribute("data-state", "missed");
      await expect(marker(page, "Tirzepatide")).toContainText("9:00 PM");

      /* A due main compound is Up next, ahead of the add-on due at the same time; the gold logs it. */
      const upNext = page.locator('[data-up-next="true"]');
      await expect(upNext).toHaveCount(1);
      await expect(upNext).toContainText("BPC-157");
      await expect(upNext).toContainText("Up next");
      await expect(page.locator('[data-record="compound-command"] [data-record-action] button')).toHaveText(/^log next due$/i);

      /* One gold in the room, and no card in a card (the peer-owned Cycle Brief is the documented exception). */
      const gold = await goldActions(page.locator("main"), { match: "either", exclude: 'a[href^="tel:"], a[href^="sms:"]', visible: "rendered" });
      expect(gold, "gold actions").toHaveLength(1);
      expect(await nestedSurfaces(page, BROAD_RULE, { exclude: '[data-compound="cycle-brief"]' }), "nested surfaces").toEqual([]);

      /* Every marker is a named 44px target. */
      const small = await page.locator("[data-today-entry]").evaluateAll((els) =>
        els.filter((el) => { const r = el.getBoundingClientRect(); return r.height < 44 || r.width < 44 || !el.getAttribute("aria-label"); }).map((el) => el.textContent),
      );
      expect(small, "markers under 44px or unnamed").toEqual([]);
      expect(errors, "console errors").toEqual([]);
    });

    test("logging an add-on keeps it in place, flips its state and advances the count — a neutral mark", async ({ page }) => {
      test.setTimeout(240_000);
      await boot(page);
      const progress = page.locator('[data-compound="today-progress"]');
      await expect(progress).toContainText("3 of 11 logged · 1 skipped");
      const orderBefore = await addOns(page).allInnerTexts();

      const creatine = marker(page, "Creatine");
      await expect(creatine).toHaveAttribute("data-state", "due");
      await wired(creatine);
      await creatine.click();
      const sheet = page.getByRole("dialog", { name: "Creatine" });
      await expect(sheet).toBeVisible();
      await sheet.getByRole("button", { name: "Log Taken" }).click();
      await expect(sheet).toHaveCount(0);

      await expect(creatine).toHaveAttribute("data-state", "logged");
      await expect(progress).toContainText("4 of 11 logged · 1 skipped");
      /* In place: the same markers in the same order, and no second list of logged rows. */
      expect((await addOns(page).allInnerTexts()).map((t) => t.split("\n")[0])).toEqual(orderBefore.map((t) => t.split("\n")[0]));
      await expect(page.getByText(/Completed Today/i)).toHaveCount(0);

      /* The compound mark is neutral: Logged, no milestone, no headline. */
      const status = page.locator('[data-log-moment="status"]');
      await expect(status).toHaveAttribute("data-kind", "compound");
      await expect(status).toHaveAttribute("data-milestone", "");
      await expect(page.locator('[data-log-moment="lead"]')).toHaveText("Logged");
      await expect(page.locator('[data-log-moment="headline"]')).toHaveCount(0);
    });

    test("skip, site log, edit and the full sheet are one tap from a marker", async ({ page }) => {
      test.setTimeout(240_000);
      await boot(page);

      /* Skip. */
      await openDaypart(page, "evening");
      await wired(marker(page, "Citrulline"));
      await marker(page, "Citrulline").click();
      await page.getByRole("dialog", { name: "Citrulline" }).getByRole("button", { name: "Skip" }).click();
      await expect(marker(page, "Citrulline")).toHaveAttribute("data-state", "skipped");

      /* A logged injectable with no site log yet opens the site log. */
      await marker(page, "Testosterone Cypionate").click();
      const testSheet = page.getByRole("dialog", { name: "Testosterone Cypionate" });
      await expect(testSheet).toContainText("Site log needed.");
      await testSheet.getByRole("button", { name: "Add Site Log" }).click();
      const siteLog = page.getByRole("dialog", { name: "Injection log" });
      await expect(siteLog).toBeVisible();
      await siteLog.getByRole("button", { name: "Close site log" }).click();
      await expect(siteLog).toHaveCount(0);

      /* Edit opens the editor. */
      await marker(page, "Tirzepatide").click();
      await page.getByRole("dialog", { name: "Tirzepatide" }).getByRole("button", { name: "Edit entry" }).click();
      const editor = page.getByRole("dialog", { name: "Compound editor" });
      await expect(editor).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(editor).toHaveCount(0);

      /* All details opens the compound's own sheet, and Dose Math is one more tap. */
      await openDaypart(page, "night");
      await marker(page, "Magnesium").click();
      await page.getByRole("dialog", { name: "Magnesium" }).getByRole("button", { name: "All details" }).click();
      const details = page.getByRole("dialog", { name: "Magnesium" });
      await expect(details.locator('[data-compound="compound-sheet"]')).toBeVisible();
      await details.getByRole("button", { name: "Dose Math" }).click();
      await expect(page.getByRole("dialog", { name: "Dose Math" })).toBeVisible();
    });

    test("moving an entry between tiers is the member's choice, and it persists", async ({ page }) => {
      test.setTimeout(240_000);
      await boot(page);
      await expect(page.locator('[data-today-tier="hero"]').getByText("Creatine")).toHaveCount(0);

      await wired(marker(page, "Creatine"));
      await marker(page, "Creatine").click();
      const sheet = page.getByRole("dialog", { name: "Creatine" });
      await sheet.getByRole("tab", { name: "Compounds" }).click();
      await expect(sheet.getByRole("tab", { name: "Compounds" })).toHaveAttribute("aria-selected", "true");
      await page.keyboard.press("Escape");

      await expect(heroes(page)).toHaveCount(5);
      await expect(page.locator('[data-today-tier="hero"]')).toContainText("Creatine");
      await addOnTotal(page, 10);

      await page.reload({ waitUntil: "domcontentloaded" });
      await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
      await expect(page.locator('[data-compound="today"]')).toBeVisible({ timeout: 120_000 });
      await expect(page.locator('[data-today-tier="hero"]')).toContainText("Creatine");
      const stored = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) as string).state.trainingSession.enhancementLog.find((e: { id: string }) => e.id === "a-creatine")?.todayTier, KEY);
      expect(stored).toBe("hero");

      /* And back: a main compound can be an add-on too. */
      await wired(marker(page, "Creatine"));
      await marker(page, "Creatine").click();
      await page.getByRole("dialog", { name: "Creatine" }).getByRole("tab", { name: "Add-ons" }).click();
      await page.keyboard.press("Escape");
      await expect(heroes(page)).toHaveCount(4);
      await addOnTotal(page, 11);
    });

    if (vp.touch) {
      test("budget at 390: eleven add-ons never push a main compound out of the first viewport", async ({ page }) => {
        test.setTimeout(240_000);
        await boot(page);
        const m = await page.evaluate(() => {
          const bar = document.querySelector('nav[data-shell="tab-bar"]');
          const fold = bar ? bar.getBoundingClientRect().top : window.innerHeight;
          const heroBottoms = [...document.querySelectorAll('[data-today-tier="hero"] [data-today-entry]')].map((el) => el.getBoundingClientRect().bottom + window.scrollY);
          const height = (sel: string) => { const el = document.querySelector(sel); return el ? el.getBoundingClientRect().height : 0; };
          const peer = height('[data-compound="cycle-brief"]') + height("[data-day-timeline]");
          return {
            fold,
            heroBottom: Math.max(...heroBottoms),
            addOnPanel: height('[data-compound="today"]'),
            page: document.documentElement.scrollHeight,
            ownPage: document.documentElement.scrollHeight - peer,
            todayChars: (document.querySelector('[data-compound="today"]') as HTMLElement).innerText.replace(/\s+/g, " ").length,
          };
        });
        expect(m.heroBottom, "last main compound inside the first viewport").toBeLessThanOrEqual(m.fold);
        /* Before: a 1,500px status-grouped list with a second list of logged rows. */
        expect(m.addOnPanel, "add-on tier height").toBeLessThanOrEqual(520);
        expect(m.todayChars, "add-on tier reading length").toBeLessThanOrEqual(450);
        /* The page less the peer-owned Cycle Brief and Day Timeline. */
        expect(m.ownPage, `page height without the peer sections (${JSON.stringify(m)})`).toBeLessThanOrEqual(2_600);
      });
    }
  });
}
