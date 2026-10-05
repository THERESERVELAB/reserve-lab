import { test, expect, type Page } from "@playwright/test";
import { PAINTED_PANEL_RULE, nestedSurfaces } from "./support/surface-nesting";
import { goldActions as findGoldActions } from "./support/gold-action";
import { settleAnimations } from "./support/settle";

/**
 * WOMEN'S ROOMS — the three Reserve Women screens (program redesign, wave F).
 *
 * The women's nav group opens when `womens.enabled` is true, the gender
 * identity is female, or the profile path is womens-performance
 * (`useMemberNavGroups`). These runs seed `womens.enabled` on the lowest tier
 * each screen is sold at: Reserve Signature ("core") for six screens, and
 * Reserve Black for Fertility and Pregnancy, which keep the shipped
 * LockedPremiumModule for Signature members (asserted under "tiers").
 *
 * Each screen is booted twice in one test, at 1280×900 and at 375×812 with
 * touch:
 *
 *   BARE     a member who has logged nothing. The screen must still earn
 *            its first screen: it names its requirements with real "0 of N"
 *            progress, offers exactly one gold action, and prints no number
 *            that is not a count of her own logs (no sample scores, no
 *            percentages, no reference targets).
 *   SEEDED   dated cycle notes, sleep, water, meals and check-ins, shaped
 *            exactly like real entries.
 *
 * Both states assert the screen recipe:
 *   · exactly one visible <h1>
 *   · exactly one gold primary action in <main>
 *   · no panel (border, fill or shadow) nested inside another (computed styles)
 *   · no paragraph of 240 characters or more
 *   · no horizontal overflow
 *   · on a phone, nothing — the gold action or the last line — sits behind
 *     the tab bar
 *   · no hydration errors
 *   · inputs are at least 16px on a phone
 */

const KEY = "final-boss-athlete-settings";
/** Tuesday 15 September 2026, 4:12 PM local. */
const WHEN = new Date(2026, 8, 15, 16, 12, 0);
const STAMP = "2026-09-01T12:00:00.000Z";

/** Fertility and Pregnancy are Reserve Black features ("pro" in saas-config); the rest are open to Reserve Signature. */
type Screen = { name: string; view: string; tier: "core" | "elite" };

/* Was eight. Performance, Training, Nutrition, Recovery and Physique only
   re-sorted data that already had a home — a woman saw "Training Command"
   twice in her sidebar — so they were removed and the phase lens they existed
   for now renders inside the commands that own the data. These three have
   subjects of their own and moved into Foundation with every other command. */
const SCREENS: Screen[] = [
  { name: "Cycle Command", view: "womens-cycle", tier: "core" },
  { name: "Fertility Command", view: "womens-fertility", tier: "elite" },
  { name: "Pregnancy Command", view: "womens-pregnancy", tier: "elite" },
];

const VIEWPORTS = [
  { name: "1280×900", width: 1280, height: 900, touch: false },
  { name: "375×812", width: 375, height: 812, touch: true },
] as const;

/** Values the old screens printed as the member's own with nothing logged. */
const OLD_SAMPLES = [
  "Readiness Score",
  "Fertile Window",
  "Performance Reserve",
  "Momentum",
  "Photos / month",
  "Measure / week",
  "130g",
  "2.8L",
  "28g",
  "Reference target",
  "Cycle-Friendly",
  "phase match",
  "Upcoming Milestones",
  "Adherence Readouts",
];

async function bootBare(page: Page, view: string, tier: "core" | "elite" = "core", ready = `[data-record="${view}"]`) {
  await page.clock.setFixedTime(WHEN);
  await page.addInitScript(
    ({ k, v, stamp, t }) => {
      window.localStorage.setItem("fba-preview-view", v);
      if (!window.localStorage.getItem(k)) {
        window.localStorage.setItem(
          k,
          JSON.stringify({
            state: {
              subscriptionTier: t,
              onboarding: { status: "complete", currentStep: 99, startedAt: stamp },
              setupProfile: { setupComplete: true, completedAt: stamp, completedSteps: [] },
              womens: { enabled: true },
            },
            version: 0,
          }),
        );
      }
    },
    { k: KEY, v: view, stamp: STAMP, t: tier },
  );
  /* `domcontentloaded`: the dev server's HMR socket keeps networkidle from settling. */
  await page.goto("/", { waitUntil: "domcontentloaded", timeout: 120_000 });
  await expect(page.locator(ready).first()).toBeVisible({ timeout: 120_000 });
  await page.waitForFunction(
    (k) => {
      const raw = window.localStorage.getItem(k);
      const state = raw ? JSON.parse(raw).state : null;
      return Boolean(state?.recoveryCommand && state?.nutritionPrefs && state?.physiqueCommand && state?.womens?.cycle);
    },
    KEY,
    { timeout: 30_000 },
  );
}

/** Two-phase seed: the patch lands in an init script before the app boots on reload. */
async function seed(page: Page, view: string) {
  const patched = await page.evaluate(
    ({ k, v, stamp }) => {
      const parsed = JSON.parse(window.localStorage.getItem(k) as string);
      const s = parsed.state;
      s.activeView = v;
      s.womens = {
        ...s.womens,
        enabled: true,
        cycle: { ...s.womens.cycle, lastPeriodStart: "2026-09-07", averageCycleLengthDays: 29, averagePeriodLengthDays: 5, lengthsEnteredAt: stamp },
        cycleLogs: [
          { id: "w-1", date: "2026-08-11", isPeriodDay: true, flow: "medium", energy: "low", trainingPerformance: "down", symptoms: ["cramps"] },
          { id: "w-2", date: "2026-08-20", energy: "high", stress: "low", trainingPerformance: "up", symptoms: [] },
          { id: "w-3", date: "2026-09-08", isPeriodDay: true, flow: "light", energy: "moderate", symptoms: ["cravings"], notes: "Slept badly, felt fine by noon." },
          { id: "w-4", date: "2026-09-10", energy: "moderate", stress: "moderate", trainingPerformance: "steady", symptoms: [] },
          { id: "w-5", date: "2026-09-14", energy: "high", stress: "low", trainingPerformance: "up", symptoms: [] },
        ],
        fertility: { ...s.womens.fertility, enabled: true, focusAreas: ["sleep", "hydration"] },
        pregnancy: { ...s.womens.pregnancy, enabled: true, stage: "second-trimester" },
      };
      s.recoveryCommand = {
        ...s.recoveryCommand,
        sleepLogs: [
          { date: "2026-09-09", hours: 7.1 },
          { date: "2026-09-10", hours: 6.8 },
          { date: "2026-09-12", hours: 7.9 },
          { date: "2026-09-14", hours: 7.4 },
        ],
        hydrationLogs: [{ date: "2026-09-14", oz: 64 }],
      };
      s.nutritionPrefs = {
        ...s.nutritionPrefs,
        loggedMealIds: ["breakfast"],
        nutritionLogDate: "2026-09-15",
        nutritionLogHistory: { "2026-09-10": ["breakfast", "lunch"], "2026-09-14": ["breakfast"] },
      };
      s.physiqueCommand = {
        ...s.physiqueCommand,
        entries: [
          { id: "p-1", date: "2026-08-12", bodyWeightLb: 141.2, measurements: { waist: 27.5 }, notes: "Morning, fasted." },
          { id: "p-2", date: "2026-09-09", bodyWeightLb: 140.6, measurements: { waist: 27.2 } },
        ],
        photoCheckIns: [{ id: "ph-1", date: "2026-09-09", poses: ["front-relaxed", "side-relaxed"], consistencyScore: 70 }],
      };
      return JSON.stringify(parsed);
    },
    { k: KEY, v: view, stamp: STAMP },
  );
  await page.addInitScript(({ k, v }) => window.localStorage.setItem(k, v), { k: KEY, v: patched });
  await page.reload({ waitUntil: "domcontentloaded", timeout: 120_000 });
  await expect(page.locator(`[data-record="${view}"]`).first()).toBeVisible({ timeout: 120_000 });
}

/**
 * Panels nested inside one another in <main>, by the broad site-audit rule:
 * a panel is any sized element with a visible border, a non-transparent
 * background (colour or image) or a box-shadow. Controls, dialogs and
 * decorative aria-hidden layers are not panels.
 */
async function nestedPanels(page: Page): Promise<string[]> {
  return nestedSurfaces(page, PAINTED_PANEL_RULE);
}

/** Gold primaries, counted by the gold fill OR the primary's near-black text colour, in any colour format. */
async function goldActions(page: Page): Promise<string[]> {
  return findGoldActions(page, { selector: "main button", match: "either", label: 200 });
}

async function assertRecipe(page: Page, screen: Screen, viewport: (typeof VIEWPORTS)[number], state: string) {
  const label = `${screen.name} · ${state} · ${viewport.name}`;

  await expect(page.locator("main h1").filter({ visible: true }), `${label}: one h1`).toHaveCount(1);

  const gold = await goldActions(page);
  expect(gold, `${label}: gold actions ${gold.join(" | ")}`).toHaveLength(1);

  expect(await nestedPanels(page), `${label}: nested bordered panels`).toEqual([]);

  /* Prose stays scannable: no paragraph or list line of 240 characters or more. */
  const long = await page.evaluate(() =>
    [...document.querySelectorAll("main p, main li")]
      .filter((el) => el.getBoundingClientRect().height > 0 && !el.querySelector("p, li"))
      .map((el) => (el.textContent ?? "").replace(/s+/g, " ").trim())
      .filter((text) => text.length >= 240),
  );
  expect(long, `${label}: paragraphs under 240 characters`).toEqual([]);

  const width = await page.evaluate(() => `${window.innerWidth}/${document.documentElement.scrollWidth}`);
  expect(width, `${label}: no horizontal overflow`).toBe(`${viewport.width}/${viewport.width}`);

  if (!viewport.touch) return;

  const small = await page.evaluate(() =>
    [...document.querySelectorAll("main input, main textarea, main select")]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && parseFloat(getComputedStyle(el).fontSize) < 16;
      })
      .map((el) => el.tagName.toLowerCase()),
  );
  expect(small, `${label}: phone inputs ≥ 16px`).toEqual([]);

  /* Nothing behind the tab bar: the gold action at the top, the last line at the bottom. */
  const bar = page.getByRole("navigation", { name: "Rooms" });
  await expect(bar, `${label}: the tab bar is showing`).toBeVisible();
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  const top = await page.evaluate(() => {
    const barTop = document.querySelector('nav[aria-label="Rooms"]')!.getBoundingClientRect().top;
    const action = document.querySelector("main [data-record-action] button")!.getBoundingClientRect();
    return { barTop, actionBottom: action.bottom };
  });
  expect(top.actionBottom, `${label}: the gold action clears the tab bar`).toBeLessThanOrEqual(top.barTop);

  /* The document scrolls on phones; `html` is smooth-scrolled, so jump instantly. */
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
  await expect
    .poll(() => page.evaluate(() => Math.ceil(window.scrollY + window.innerHeight) >= document.documentElement.scrollHeight - 1), { timeout: 10_000 })
    .toBe(true);
  const bottom = await page.evaluate(() => {
    const barTop = document.querySelector('nav[aria-label="Rooms"]')!.getBoundingClientRect().top;
    const pageEl = document.querySelector("main .fba-page")!;
    const last = [...pageEl.children].filter((el) => el.getBoundingClientRect().height > 0).at(-1)!;
    return { barTop, lastBottom: last.getBoundingClientRect().bottom, text: (last.textContent ?? "").slice(0, 40) };
  });
  expect(bottom.lastBottom, `${label}: the last line "${bottom.text}" clears the tab bar`).toBeLessThanOrEqual(bottom.barTop + 1);
}

for (const viewport of VIEWPORTS) {
  test.describe(`women's rooms at ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height }, hasTouch: viewport.touch, isMobile: viewport.touch });

    for (const screen of SCREENS) {
      test(`${screen.name}: bare then seeded`, async ({ page }) => {
        test.setTimeout(240_000);
        const hydration: string[] = [];
        page.on("pageerror", (error) => {
          if (/hydrat/i.test(error.message)) hydration.push(error.message);
        });
        page.on("console", (msg) => {
          if (msg.type() === "error" && /hydrat/i.test(msg.text())) hydration.push(msg.text());
        });

        /* ── BARE ── */
        await bootBare(page, screen.view, screen.tier);
        await assertRecipe(page, screen, viewport, "bare");

        const bare = (await page.locator("main .fba-page").innerText()).replace(/\s+/g, " ");
        expect(bare, `${screen.name}: names its requirements with real progress`).toMatch(/0 of \d+ ready/i);
        const requirementActions = await page.evaluate(() => document.querySelectorAll('main [aria-label="What this screen needs"] button').length);
        expect(requirementActions, `${screen.name}: each missing requirement has a way in`).toBeGreaterThanOrEqual(2);
        for (const sample of OLD_SAMPLES) expect(bare.toLowerCase(), `${screen.name}: "${sample}" is gone`).not.toContain(sample.toLowerCase());
        /* Every number left is a count of her own logs, a care number, or the one water amount the gold action logs. */
        const stripped = bare
          .replace(/\b\d+ of \d+\b/gi, "")
          .replace(/\b(?:911|988)\b/g, "")
          .replace(/\b16 oz\b/gi, "")
          /* A named assumption, never shown as hers: "Reserve assumes 28 and says so". */
          .replace(/\bassumes 28\b/gi, "")
          /* Section counts of her own entries, at zero: "Days you logged · 0". */
          .replace(/· 0\b/g, "");
        expect(stripped, `${screen.name}: no invented numbers with nothing logged`).not.toMatch(/\d/);

        /* ── SEEDED ── */
        await seed(page, screen.view);
        await assertRecipe(page, screen, viewport, "seeded");

        expect(hydration, `${screen.name}: hydration`).toEqual([]);
      });
    }
  });
}

test.describe("women's rooms behave", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("entering a period start turns Cycle Command into a labelled estimate", async ({ page }) => {
    test.setTimeout(240_000);
    await bootBare(page, "womens-cycle");
    await page.locator("main [data-record-action] button").click();
    const sheet = page.getByRole("dialog", { name: "Cycle dates" });
    await expect(sheet).toBeVisible();
    await sheet.locator('input[type="date"]').fill("2026-09-07");
    await sheet.getByRole("button", { name: "Save Dates" }).click();
    await expect(sheet).toHaveCount(0);

    const statement = page.locator("main [data-record-statement]");
    await expect(statement).toHaveText(/Day 9 of your cycle/i);
    const text = (await page.locator("main").innerText()).replace(/\s+/g, " ");
    expect(text).toMatch(/assumed 28 days between periods/i);
    expect(text).toMatch(/est\./i);
    expect(text.toLowerCase()).not.toContain("fertile");
    /* The next gold action is the next missing thing: today's log. */
    await expect(page.locator("main [data-record-action] button")).toHaveText(/Log Today/);
  });

  test("a day log saves once per date and shows in the record", async ({ page }) => {
    test.setTimeout(240_000);
    await bootBare(page, "womens-cycle");
    await seed(page, "womens-cycle");
    await page.locator("main [data-record-action] button").click();
    const sheet = page.getByRole("dialog", { name: /your day/i });
    await expect(sheet).toBeVisible();
    await sheet.getByRole("button", { name: "High" }).first().click();
    await sheet.getByRole("button", { name: "Better than usual" }).click();
    await sheet.getByRole("button", { name: "Save Day" }).click();
    await expect(sheet).toHaveCount(0);
    await expect(page.locator('main [aria-label="Logged days, newest first"] li').first()).toContainText("Energy high");
    await expect(page.locator("main [data-record-action] button")).toHaveText(/Edit Today's Log/);
  });

  test("fertility tracking turns on without inventing a score or a window", async ({ page }) => {
    test.setTimeout(240_000);
    await bootBare(page, "womens-fertility", "elite");
    await expect(page.locator("main [data-record-action] button")).toHaveText(/Turn On Fertility Tracking/);
    await page.locator("main [data-record-action] button").click();
    await expect(page.locator("main [data-record-statement]")).toHaveText(/Choose what to track/i);
    const text = (await page.locator("main").innerText()).replace(/\s+/g, " ").toLowerCase();
    expect(text).toContain("does not time conception");
    expect(text).not.toMatch(/fertile window|readiness|\d+%/);
  });
});

test.describe("tiers", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("Fertility and Pregnancy keep the shipped Reserve Black lock for a Reserve Signature member", async ({ browser }) => {
    test.setTimeout(240_000);
    for (const [view, title] of [
      ["womens-fertility", "Fertility Command"],
      ["womens-pregnancy", "Pregnancy Command"],
    ] as const) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      const page = await context.newPage();
      await bootBare(page, view, "core", `main h1:has-text("${title}")`);
      await expect(page.locator(`[data-record="${view}"]`)).toHaveCount(0);
      await expect(page.locator("main")).toContainText("Reserve Black");
      await expect(page.locator("main h1").filter({ visible: true })).toHaveCount(1);
      await context.close();
    }
  });
});

test.describe("women's sheets on a phone", () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });

  test("the day log is a labelled modal dialog, the tab bar steps aside, and Save is reachable", async ({ page }) => {
    test.setTimeout(240_000);
    await bootBare(page, "womens-cycle");
    await seed(page, "womens-cycle");
    await page.locator("main [data-record-action] button").click();
    const sheet = page.getByRole("dialog", { name: /your day/i });
    await expect(sheet).toBeVisible();
    await expect(sheet).toHaveAttribute("aria-modal", "true");
    await expect(page.getByRole("navigation", { name: "Rooms" })).toBeHidden();
    await settleAnimations(page);
    const save = await sheet.getByRole("button", { name: "Save Day" }).boundingBox();
    expect(save!.y + save!.height).toBeLessThanOrEqual(812);
    const small = await sheet.evaluate((el) =>
      [...el.querySelectorAll("input")].filter((i) => parseFloat(getComputedStyle(i).fontSize) < 16).length,
    );
    expect(small, "sheet inputs ≥ 16px").toBe(0);
    await page.keyboard.press("Escape");
    await expect(sheet).toHaveCount(0);
  });
});
