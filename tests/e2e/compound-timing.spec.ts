import { test, expect, type Locator, type Page } from "@playwright/test";

import { heavySeed } from "./support/compound-heavy-seed";
import { goldActions } from "./support/gold-action";
import { BROAD_RULE, nestedSurfaces } from "./support/surface-nesting";
import { settleAnimations } from "./support/settle";

/**
 * COMPOUND TIMING — member-set cadence and dose times.
 *
 * Owner, 2026-09-18: "The HGH should also allow the schedule to pick 2 days on
 * 1 day off, or twice in the selected days, like post food 1 hour or pre food
 * 1 hour / breakfast / dinner … compound timing is very sensitive."
 *
 *   · the member sets an HGH entry to 2 days on / 1 day off, with two times:
 *     "1 h before breakfast" and "before bed"; the editor shows where each
 *     lands today, from the member's own meal plan and sleep target
 *   · the editor's 7-day preview reads on, on, off, on, on, off, on
 *   · Today, the Day Timeline and Apex all show both times, from one resolver
 *   · each dose logs or skips on its own
 *   · heavy member at 390: the add-on panel stays under budget
 */

const KEY = "final-boss-athlete-settings";
const SHOTS = process.env.COMPOUND_TIMING_SHOTS ?? "test-results/compound-timing";
/** Friday 18 September 2026, 6:10 AM local. */
const WHEN = new Date(2026, 8, 18, 6, 10, 0);
const TODAY = "2026-09-18";

function hghSeed() {
  const stamp = WHEN.toISOString();
  return {
    state: {
      subscriptionTier: "elite",
      activeView: "supplements",
      onboarding: { status: "complete", currentStep: 99, startedAt: stamp },
      setupProfile: { age: 34, setupComplete: true },
      trainingSession: {
        enhancementLog: [
          {
            id: "hgh", name: "Somatropin", officialName: "Somatropin", compoundClass: "growth_hormone", category: "peptide",
            route: "injectable", injectionType: "subq", doseAmount: "", doseUnit: "", frequency: "daily", frequencyType: "daily",
            scheduleRule: { type: "daily" }, timingPreference: "", timeOfDayPreference: "custom", customTime: "08:00",
            goalAssociation: [], isActive: true, createdAt: stamp, updatedAt: stamp,
          },
        ],
        enhancementAdherence: [],
        injectionLogs: [],
        compoundSupportLinks: [],
        schedulePlan: { wakeTime: "06:30", sleepTime: "22:30", workoutTime: "17:30" },
      },
    },
    version: 0,
  };
}

async function boot(page: Page, seed: unknown, flag: string) {
  await page.clock.setFixedTime(WHEN);
  await page.addInitScript(({ k, v, f }) => {
    /* Seed once: a reload must read what the member saved, not the seed again. */
    if (window.sessionStorage.getItem(f)) return;
    window.sessionStorage.setItem(f, "1");
    window.localStorage.setItem("fba-preview-view", "supplements");
    window.localStorage.setItem(k, v);
  }, { k: KEY, v: JSON.stringify(seed), f: flag });
  await page.goto("/", { waitUntil: "domcontentloaded", timeout: 120_000 });
  /* The dev server's issue badge sits over a phone sheet's footer; it does not exist in production. */
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await expect(page.locator('[data-compound="today"], [data-today-tier="hero"]').first()).toBeVisible({ timeout: 120_000 });
}

async function wired(locator: ReturnType<Page["locator"]>) {
  await expect(locator).toBeVisible({ timeout: 60_000 });
  await expect.poll(() => locator.evaluate((el) => Object.keys(el).some((key) => key.startsWith("__reactProps"))), { timeout: 60_000 }).toBe(true);
}

const hghTiles = (page: Page) => page.locator('[data-today-tier="hero"] [data-today-entry]', { hasText: "Somatropin" });
/** "8:00 AM" out of "1 h before breakfast · 8:00 AM". */
const clockOf = (text: string) => text.match(/(\d{1,2}:\d{2})\s?([AP]M)/)!.slice(1).join(" ");

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

test("2 on / 1 off with two meal- and bed-anchored times: correct days, one set of times everywhere, each dose marked on its own", async ({ page }) => {
  test.setTimeout(300_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await boot(page, hghSeed(), "timing-seeded");

  /* Open the editor from the entry's own marker. */
  const first = hghTiles(page).first();
  await wired(first);
  await first.click();
  await page.getByRole("dialog", { name: "Somatropin" }).getByRole("button", { name: "Edit entry" }).click();
  const editor = page.getByRole("dialog", { name: "Compound editor" });
  await expect(editor).toBeVisible();

  /* Cadence: 2 days on, 1 day off, from today. */
  await editor.getByRole("button", { name: /Days on \/ days off/ }).click();
  const cycle = editor.locator('[data-compound="on-off-cycle"]');
  await cycle.getByLabel("Days on").fill("2");
  await cycle.getByLabel("Days off").fill("1");
  await cycle.getByLabel("Anchor date").fill(TODAY);
  await expect.poll(() => editor.locator("[data-preview-status]").evaluateAll((els) => els.map((el) => el.getAttribute("data-preview-status")))).toEqual(["Due", "Due", "Clear", "Due", "Due", "Clear", "Due"]);

  /* Times: two per scheduled day, set by the member. */
  const when = editor.locator('[data-compound="when-you-take-it"]');
  await when.getByRole("tab", { name: "Set each time" }).click();
  await when.getByRole("button", { name: "One more time" }).click();
  await expect(when.locator("[data-dose-count]")).toHaveText("2");
  const dose1 = when.locator('[data-dose-row="1"]');
  await dose1.getByRole("button", { name: "Relative to a meal" }).click();
  await dose1.getByRole("button", { name: "1 h before" }).click();
  await dose1.getByRole("button", { name: "Breakfast", exact: true }).click();
  const dose2 = when.locator('[data-dose-row="2"]');
  await dose2.getByRole("button", { name: "Before bed" }).click();

  const rule1 = (await dose1.locator("[data-dose-resolved]").innerText()).trim();
  const rule2 = (await dose2.locator("[data-dose-resolved]").innerText()).trim();
  expect(rule1).toMatch(/^1 h before breakfast · \d{1,2}:\d{2}\s?[AP]M$/);
  expect(rule2).toMatch(/^Before bed · 10:30\s?PM$/);
  const t1 = clockOf(rule1);
  const t2 = clockOf(rule2);
  await editor.screenshot({ path: `${SHOTS}/editor-dose-times-390.png` });
  await editor.getByRole("button", { name: "Update Compound" }).click();
  await expect(editor).toHaveCount(0);

  /* Today: two tiles for the one entry, each with its own time and the member's rule. */
  await expect(hghTiles(page)).toHaveCount(2);
  await expect(hghTiles(page).nth(0)).toContainText(t1.replace(" ", " ").length ? /./ : /./);
  const tileTexts = await hghTiles(page).allInnerTexts();
  expect(tileTexts[0]).toContain("1 h before breakfast");
  expect(tileTexts[0].replace(/\s/g, "")).toContain(t1.replace(/\s/g, ""));
  expect(tileTexts[1]).toContain("Before bed");
  expect(tileTexts[1].replace(/\s/g, "")).toContain(t2.replace(/\s/g, ""));

  /* The Day Timeline reads the same two times. */
  const day = page.getByRole("region", { name: "Your day" });
  await expect(day).toBeVisible();
  const dayMarks = await day.locator('[data-day-mark="compound"]').evaluateAll((els) => els.map((el) => el.getAttribute("aria-label") ?? ""));
  const hgh = dayMarks.filter((m) => m.startsWith("Somatropin"));
  expect(hgh.map((m) => m.replace(/\s/g, ""))).toEqual([`Somatropinat${t1}`, `Somatropinat${t2}`].map((m) => m.replace(/\s/g, "")));
  await page.screenshot({ path: `${SHOTS}/today-two-doses-390.png`, fullPage: true });

  /* Log the breakfast dose: an injectable opens the site log, which records that dose only. */
  await hghTiles(page).nth(0).click();
  await page.getByRole("dialog", { name: "Somatropin" }).getByRole("button", { name: "Log Taken" }).click();
  const siteLog = page.getByRole("dialog", { name: "Injection log" });
  await expect(siteLog).toBeVisible();
  await siteLog.getByRole("button", { name: "Save Site Log" }).click();
  await expect(siteLog).toHaveCount(0);
  await expect(hghTiles(page).nth(0)).toHaveAttribute("data-state", "logged");
  await expect(hghTiles(page).nth(1)).not.toHaveAttribute("data-state", "logged");

  /* Apex reads the same two slots; skip the bed dose there. */
  await page.evaluate(() => window.localStorage.setItem("fba-preview-view", "dashboard"));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  const apexTiles = page.locator('[data-apex="heroes"] [data-apex-hero]').filter({ hasText: "Somatropin" });
  await expect(apexTiles).toHaveCount(2, { timeout: 120_000 });
  expect((await apexTiles.nth(1).getAttribute("aria-label"))?.replace(/\s/g, "")).toContain(t2.replace(/\s/g, ""));
  await wired(apexTiles.nth(1));
  await apexTiles.nth(1).click();
  await page.getByRole("dialog", { name: "Somatropin" }).getByRole("button", { name: "Skip" }).click();
  await expect(apexTiles.nth(1)).toHaveAttribute("aria-label", /Skipped/);
  await expect(apexTiles.nth(0)).toHaveAttribute("aria-label", /Logged/);
  await page.screenshot({ path: `${SHOTS}/apex-two-doses-390.png`, fullPage: true });

  /* Two marks, one per dose, keyed by entry + day + planned time. */
  const marks = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) as string).state.trainingSession.enhancementAdherence, KEY);
  const hghMarks = (marks as Array<{ entryId: string; date: string; plannedTime: string; takenStatus: string }>).filter((m) => m.entryId === "hgh");
  expect(hghMarks.map((m) => m.takenStatus).sort()).toEqual(["skipped", "taken"]);
  expect(new Set(hghMarks.map((m) => m.plannedTime)).size).toBe(2);
  expect(hghMarks.every((m) => m.date === TODAY)).toBe(true);

  /* The bar: one gold in the room, no card in a card. */
  const gold = await goldActions(page.locator("main"), { match: "either", exclude: 'a[href^="tel:"], a[href^="sms:"]', visible: "rendered" });
  expect(gold.length, "gold actions on Apex").toBeLessThanOrEqual(1);
  expect(errors, "console errors").toEqual([]);
});

/**
 * The dayparts animate open. Headless suspends the frames that would carry
 * that transition to its end, so the panel sat 4.9px short of where it comes
 * to rest — and the next reading, after a screenshot had quietly finished the
 * animation, read as a layout jump on the log. The log moves nothing.
 *
 * Finish what is running, then measure, so both readings are of a panel at
 * rest rather than one caught mid-transition.
 */
async function settledHeight(page: Page, locator: Locator): Promise<number> {
  await settleAnimations(page);
  let last = await locator.evaluate((el) => el.getBoundingClientRect().height);
  let stable = 0;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await page.waitForTimeout(50);
    const next = await locator.evaluate((el) => el.getBoundingClientRect().height);
    stable = Math.abs(next - last) < 0.5 ? stable + 1 : 0;
    last = next;
    if (stable >= 3) return next;
  }
  return last;
}

test("heavy member at 390: add-ons fold by daypart, well under the old 428px", async ({ page }) => {
  test.setTimeout(240_000);
  const heavyWhen = new Date(2026, 8, 15, 16, 12, 0);
  await page.clock.setFixedTime(heavyWhen);
  await page.addInitScript(({ k, v }) => {
    if (window.sessionStorage.getItem("heavy-seeded")) return;
    window.sessionStorage.setItem("heavy-seeded", "1");
    window.localStorage.setItem("fba-preview-view", "supplements");
    window.localStorage.setItem(k, v);
  }, { k: KEY, v: JSON.stringify(heavySeed(heavyWhen)) });
  await page.goto("/", { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  const panel = page.locator('[data-compound="today"]');
  await expect(panel).toBeVisible({ timeout: 120_000 });
  await expect(page.locator('[data-compound="today-progress"]')).toContainText("3 of 11 logged · 1 skipped");

  /* Morning is all logged: one line. Midday holds what is due: open. Evening and Night: one tap away. */
  await expect(page.locator("[data-daypart]")).toHaveCount(4);
  await expect(page.locator('[data-daypart="morning"]')).toHaveAttribute("data-open", "false");
  await expect(page.locator('[data-daypart="morning"] [data-daypart-line]')).toHaveText("3 of 3 logged");
  await expect(page.locator('[data-daypart="midday"]')).toHaveAttribute("data-open", "true");
  await expect(page.locator('[data-daypart="evening"]')).toHaveAttribute("data-open", "false");
  await expect(page.locator('[data-daypart="night"]')).toHaveAttribute("data-open", "false");

  const height = await settledHeight(page, panel);
  console.log(`ADD_ON_PANEL_HEIGHT ${height}`);
  expect(height, "add-on panel height at 390 (was ~428)").toBeLessThanOrEqual(340);
  await panel.screenshot({ path: `${SHOTS}/addons-after-390.png` });

  /* Logging a chip keeps every marker where it sits: no layout jump. */
  const creatine = page.locator("[data-today-entry]", { hasText: "Creatine" }).first();
  await wired(creatine);
  const boxBefore = await creatine.boundingBox();
  const panelBefore = height;
  await creatine.click();
  await page.getByRole("dialog", { name: "Creatine" }).getByRole("button", { name: "Log Taken" }).click();
  await expect(creatine).toHaveAttribute("data-state", "logged");
  const boxAfter = await creatine.boundingBox();
  expect(boxAfter?.y).toBeCloseTo(boxBefore!.y, 0);
  expect(boxAfter?.height).toBeCloseTo(boxBefore!.height, 0);
  expect(await settledHeight(page, panel)).toBeCloseTo(panelBefore, 0);
  await expect(page.locator('[data-daypart="midday"]')).toHaveAttribute("data-open", "true");

  /* A folded daypart opens with one tap. */
  await page.locator('[data-daypart="evening"] > button').click();
  await expect(page.locator('[data-daypart="evening"]')).toHaveAttribute("data-open", "true");
  await expect(page.locator('[data-daypart="evening"] [data-today-entry]')).toHaveCount(3);

  /* The bar. */
  const gold = await goldActions(page.locator("main"), { match: "either", exclude: 'a[href^="tel:"], a[href^="sms:"]', visible: "rendered" });
  expect(gold, "gold actions").toHaveLength(1);
  expect(await nestedSurfaces(page, BROAD_RULE, { exclude: '[data-compound="cycle-brief"]' }), "nested surfaces").toEqual([]);
  const small = await page.locator("[data-today-entry], [data-daypart] > button").evaluateAll((els) =>
    els.filter((el) => { const r = el.getBoundingClientRect(); return r.height < 44 || r.width < 44; }).map((el) => el.textContent),
  );
  expect(small, "targets under 44px").toEqual([]);
});
