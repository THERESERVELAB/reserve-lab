import { test, expect, type Page } from "@playwright/test";
import { goldActions as findGoldActions } from "./support/gold-action";

/**
 * RECOVERY ROOM — the Recovery screen's fold contract (DESIGN_BIBLE.md §11 / §13,
 * the Pit Wall treatment applied to Recovery).
 *
 * Seeds a member at a fixed clock and asserts:
 *
 *   · the hero's action sits inside the first screen at 1440×1000 and 390×844,
 *     with logged evidence and with none
 *   · exactly one gold action on the screen (the gold CTA is scarce)
 *   · tonight's horizon renders its items as real buttons that open a sheet
 *   · after sleep lock the horizon is quiet, not an empty track
 *   · one h1, no horizontal overflow, no hydration errors
 *
 * Seeding is two-phase, as in apex-pit-wall.spec.ts: the first load lets the
 * app write its own persisted state, and the patch is applied by an init
 * script BEFORE the app boots on reload.
 */

const KEY = "final-boss-athlete-settings";
/** Tuesday 15 September 2026, 4:12 PM local. */
const AFTERNOON = new Date(2026, 8, 15, 16, 12, 0);
/** The same day, after the 10:30 PM sleep lock. */
const AFTER_SLEEP_LOCK = new Date(2026, 8, 15, 23, 5, 0);

async function completeOnboarding(page: Page) {
  await page.addInitScript((k) => {
    window.localStorage.setItem("fba-preview-view", "recovery");
    const raw = window.localStorage.getItem(k);
    const parsed = raw ? JSON.parse(raw) : { state: {}, version: 0 };
    parsed.state = {
      ...parsed.state,
      onboarding: { ...(parsed.state.onboarding || {}), status: "complete", currentStep: 99, startedAt: "2026-09-01T12:00:00.000Z" },
    };
    window.localStorage.setItem(k, JSON.stringify(parsed));
  }, KEY);
}

async function bootRecovery(page: Page, { when, evidence }: { when: Date; evidence: boolean }) {
  await page.clock.setFixedTime(when);
  await completeOnboarding(page);

  /* `domcontentloaded`: the dev server's HMR socket keeps networkidle from settling. */
  await page.goto("/", { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.locator("main h1").first().waitFor({ timeout: 120_000 });
  await page.waitForFunction(
    (k) => {
      const raw = window.localStorage.getItem(k);
      return Boolean(raw && JSON.parse(raw).state?.recoveryCommand);
    },
    KEY,
    { timeout: 30_000 },
  );

  const patched = await page.evaluate(
    ({ k, iso, evidence }) => {
      const now = new Date(iso);
      const dayKey = (offset: number) => {
        const d = new Date(now);
        d.setDate(d.getDate() - offset);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      };
      const parsed = JSON.parse(window.localStorage.getItem(k) as string);
      const s = parsed.state;
      s.recoveryCommand = {
        ...s.recoveryCommand,
        /* Seven nights under an 8h target: the engine's next action is to protect sleep. */
        sleepLogs: evidence ? [7.2, 6.8, 7.6, 8.1, 7.0, 7.9, 7.4].map((hours, i) => ({ date: dayKey(7 - i), hours })) : [],
        hydrationLogs: evidence ? [{ date: dayKey(0), oz: 64 }] : [],
        mobilityLogs: [],
        stressCheckIns: evidence ? [{ date: dayKey(0), stress: 2, energy: 4, mood: 4 }] : [],
        suiteCompletedToday: [],
        suiteDate: null,
      };
      s.scheduleProfile = {
        ...s.scheduleProfile,
        wakeTime: "06:30",
        sleepTarget: "22:30",
        trainingWindow: "evening",
        preferredTrainingStart: "17:30",
        preferredTrainingEnd: "19:00",
      };
      s.setupProfile = { ...s.setupProfile, setupComplete: true, completedAt: now.toISOString() };
      return JSON.stringify(parsed);
    },
    { k: KEY, iso: when.toISOString(), evidence },
  );
  await page.addInitScript(({ k, v }) => window.localStorage.setItem(k, v), { k: KEY, v: patched });
  await page.reload({ waitUntil: "domcontentloaded", timeout: 120_000 });

  await expect(page.locator("main h1").filter({ visible: true }).first()).toHaveText(/recovery command/i, { timeout: 60_000 });
  await expect(page.locator('[data-recovery="primary-action"] button').filter({ visible: true }).first()).toBeVisible({ timeout: 60_000 });
}

const heroAction = (page: Page) => page.locator('[data-recovery="primary-action"] button').filter({ visible: true }).first();

async function expectFoldContract(page: Page, vp: { name: string; height: number }) {
  await expect(page.locator("h1").filter({ visible: true }), `one h1 at ${vp.name}`).toHaveCount(1);

  for (const locator of [page.locator("main h1").filter({ visible: true }).first(), heroAction(page)]) {
    const box = await locator.boundingBox();
    expect(box, `has a box at ${vp.name}`).not.toBeNull();
    expect(box!.y + box!.height, `sits inside the first screen at ${vp.name}`).toBeLessThanOrEqual(vp.height);
  }

  /* ReserveButton's primary tier is the only control painted in #0a0b10 text (read in any colour format). */
  const goldActions = (await findGoldActions(page, { selector: "button", match: "text" })).length;
  expect(goldActions, `exactly one gold action at ${vp.name}`).toBe(1);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `sideways scroll at ${vp.name}`).toBeLessThanOrEqual(1);
}

const VIEWPORTS = [
  { name: "1440x1000", width: 1440, height: 1000, touch: false },
  { name: "390x844", width: 390, height: 844, touch: true },
] as const;

test.describe("the sleep log records only what the member sets", () => {
  test.use({ viewport: { width: 1440, height: 1000 } });

  test("saves nothing until the times are set or the schedule is confirmed", async ({ page }) => {
    await bootRecovery(page, { when: AFTERNOON, evidence: false });
    const save = page.getByRole("button", { name: /^save sleep$/i }).filter({ visible: true }).first();
    await save.scrollIntoViewIfNeeded();
    /* Was pre-filled 10:30 PM → 6:00 AM and could be saved untouched. */
    await expect(save).toBeDisabled();
    await page.getByRole("button", { name: /same as my schedule/i }).filter({ visible: true }).first().click();
    await expect(save).toBeEnabled();
  });
});

for (const vp of VIEWPORTS) {
  test.describe(`recovery room at ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.touch, isMobile: vp.touch });

    test("with logged evidence, the hero action is inside the first screen", async ({ page }) => {
      const pageErrors: string[] = [];
      page.on("pageerror", (e) => pageErrors.push(e.message));

      await bootRecovery(page, { when: AFTERNOON, evidence: true });

      await expect(heroAction(page)).toHaveText(/log sleep protection/i);
      await expectFoldContract(page, vp);
      expect(pageErrors.filter((e) => /hydrat/i.test(e)), `hydration errors at ${vp.name}`).toEqual([]);
    });

    test("with no evidence, the hero still leads with a real log inside the first screen", async ({ page }) => {
      const pageErrors: string[] = [];
      page.on("pageerror", (e) => pageErrors.push(e.message));

      await bootRecovery(page, { when: AFTERNOON, evidence: false });

      await expect(page.locator('[data-recovery="action-title"]').filter({ visible: true }).first()).toHaveText(/start with last night's sleep/i);
      await expect(heroAction(page)).toHaveText(/log last night's sleep/i);
      await expectFoldContract(page, vp);
      expect(pageErrors.filter((e) => /hydrat/i.test(e)), `hydration errors at ${vp.name}`).toEqual([]);
    });

    test("tonight's horizon items are real buttons that open a sheet", async ({ page }) => {
      await bootRecovery(page, { when: AFTERNOON, evidence: true });

      const horizon = page.locator('[data-recovery="horizon"]');
      await expect(horizon).toBeVisible();
      const items = horizon.locator('button[aria-haspopup="dialog"]').filter({ visible: true });
      await expect(items.first()).toBeVisible({ timeout: 30_000 });

      const box = await items.first().boundingBox();
      // Rounded: a transformed control can measure a hair under 44 CSS px.
      expect(Math.round(box!.height), "44px hit area").toBeGreaterThanOrEqual(44);
      expect(Math.round(box!.width), "44px hit area").toBeGreaterThanOrEqual(44);

      await items.first().click();
      const sheet = page.getByRole("dialog");
      await expect(sheet).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(sheet).toHaveCount(0);
    });

    test("after sleep lock the horizon is quiet, not an empty track", async ({ page }) => {
      await bootRecovery(page, { when: AFTER_SLEEP_LOCK, evidence: true });

      const horizon = page.locator('[data-recovery="horizon"]');
      await expect(horizon.getByText("Past sleep lock")).toBeVisible({ timeout: 30_000 });
      await expect(horizon.locator('button[aria-haspopup="dialog"]').filter({ visible: true })).toHaveCount(0);
    });
  });
}
