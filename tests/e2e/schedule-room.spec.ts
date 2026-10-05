import { test, expect, type Page } from "@playwright/test";
import { goldActions as findGoldActions } from "./support/gold-action";

/**
 * SCHEDULE ROOM — the Schedule screen's fold contract (DESIGN_BIBLE.md §08 / §09 / §11 / §13,
 * the living-room treatment applied to Schedule, V1.6).
 *
 * Seeds a member at a fixed clock and asserts:
 *
 *   · the h1 and the hero's gold action sit inside the first screen at 1440×1000
 *     and 390×844, with a set schedule and without one
 *   · exactly one gold action on the screen (the gold CTA is scarce)
 *   · without a set schedule the one action is "Set Your Day", the horizon says the
 *     day is not set, and the action brings the wake time into focus
 *   · the gold action never logs a meal by itself: it opens the meal confirmation
 *   · today's plan horizon renders its items as real 44px buttons that open a
 *     sheet, which closes on Escape
 *   · after sleep lock the horizon is quiet, not an empty track
 *   · the day status agrees with the seeded split day, and with training moved away
 *   · one h1, no horizontal overflow, no hydration errors
 *
 * Seeding is two-phase, as in nutrition-room.spec.ts: the first load lets the app
 * write its own persisted state, and the patch is applied by an init script
 * BEFORE the app boots on reload.
 */

const KEY = "final-boss-athlete-settings";
/** Tuesday 15 September 2026, 4:12 PM local — a Pull day, the pre-workout meal planned for 4:00 PM. */
const AFTERNOON = new Date(2026, 8, 15, 16, 12, 0);
/** The same day, after the 10:30 PM sleep lock. */
const AFTER_SLEEP_LOCK = new Date(2026, 8, 15, 23, 5, 0);

async function completeOnboarding(page: Page) {
  await page.addInitScript((k) => {
    window.localStorage.setItem("fba-preview-view", "schedule-command");
    const raw = window.localStorage.getItem(k);
    const parsed = raw ? JSON.parse(raw) : { state: {}, version: 0 };
    parsed.state = {
      ...parsed.state,
      onboarding: { ...(parsed.state.onboarding || {}), status: "complete", currentStep: 99, startedAt: "2026-09-01T12:00:00.000Z" },
    };
    window.localStorage.setItem(k, JSON.stringify(parsed));
  }, KEY);
}

type Boot = { when: Date; scheduleSet: boolean; movedAway?: boolean };

async function bootSchedule(page: Page, { when, scheduleSet, movedAway = false }: Boot) {
  await page.clock.setFixedTime(when);
  await completeOnboarding(page);

  /* `domcontentloaded`: the dev server's HMR socket keeps networkidle from settling. */
  await page.goto("/", { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.locator("main h1").first().waitFor({ timeout: 120_000 });
  await page.waitForFunction(
    (k) => {
      const raw = window.localStorage.getItem(k);
      const state = raw ? JSON.parse(raw).state : null;
      return Boolean(state?.recoveryCommand && state?.nutritionPrefs && state?.scheduleProfile && state?.setupProfile);
    },
    KEY,
    { timeout: 30_000 },
  );

  const patched = await page.evaluate(
    ({ k, iso, scheduleSet, movedAway }) => {
      const now = new Date(iso);
      const localKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const parsed = JSON.parse(window.localStorage.getItem(k) as string);
      const s = parsed.state;
      s.recoveryCommand = { ...s.recoveryCommand, hydrationLogs: [], sleepLogs: [] };
      s.nutritionPrefs = { ...s.nutritionPrefs, loggedMealIds: [], latestMealLog: null, nutritionLogDate: localKey };
      s.scheduleProfile = {
        ...s.scheduleProfile,
        wakeTime: "06:30",
        sleepTarget: "22:30",
        trainingWindow: "evening",
        preferredTrainingStart: "17:30",
        preferredTrainingEnd: "19:00",
      };
      const steps: string[] = (s.setupProfile?.completedSteps ?? []).filter((step: string) => step !== "schedule");
      s.setupProfile = {
        ...s.setupProfile,
        setupComplete: true,
        completedAt: now.toISOString(),
        completedSteps: scheduleSet ? [...steps, "schedule"] : steps,
      };
      s.splitSystem = { ...(s.splitSystem || {}), key: "ppl-ul", source: "member", selectedAt: now.toISOString() };
      s.trainingOverrides = movedAway
        ? {
            [localKey]: {
              id: "e2e-moved-away",
              action: "rescheduled",
              status: "active",
              originalDate: localKey,
              originalSessionTitle: "Pull",
              targetDate: "2026-09-17",
              reason: "Travel",
              createdAt: now.toISOString(),
              updatedAt: now.toISOString(),
            },
          }
        : {};
      return JSON.stringify(parsed);
    },
    { k: KEY, iso: when.toISOString(), scheduleSet, movedAway },
  );
  await page.addInitScript(({ k, v }) => window.localStorage.setItem(k, v), { k: KEY, v: patched });
  await page.reload({ waitUntil: "domcontentloaded", timeout: 120_000 });

  await expect(page.locator("main h1").filter({ visible: true }).first()).toHaveText(/schedule command/i, { timeout: 60_000 });
  await expect(heroAction(page)).toBeVisible({ timeout: 60_000 });
  /* The real clock has mounted: the horizon prints the seeded time, not the server reference. */
  await expect(page.locator('[data-schedule="horizon"]').getByText(/now \d{1,2}:\d{2} (AM|PM)/i)).toBeVisible({ timeout: 60_000 });
}

const heroAction = (page: Page) => page.locator('[data-schedule="primary-action"] button').filter({ visible: true }).first();
const dayStatus = (page: Page) => page.locator('[data-schedule="day-status"]').filter({ visible: true }).first();

async function expectFoldContract(page: Page, vp: { name: string; height: number }) {
  await expect(page.locator("h1").filter({ visible: true }), `one h1 at ${vp.name}`).toHaveCount(1);

  for (const locator of [page.locator("main h1").filter({ visible: true }).first(), heroAction(page)]) {
    const box = await locator.boundingBox();
    expect(box, `has a box at ${vp.name}`).not.toBeNull();
    expect(box!.y, `is not above the screen at ${vp.name}`).toBeGreaterThanOrEqual(0);
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

for (const vp of VIEWPORTS) {
  test.describe(`schedule room at ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.touch, isMobile: vp.touch });

    test("with a set schedule, the hero leads with the open meal window inside the first screen", async ({ page }) => {
      const pageErrors: string[] = [];
      page.on("pageerror", (e) => pageErrors.push(e.message));

      await bootSchedule(page, { when: AFTERNOON, scheduleSet: true });

      await expect(heroAction(page)).toHaveText(/^log pre-workout meal$/i);
      /* One day across the screen: the member's PPL-UL Tuesday is Pull, as on Training and Nutrition. */
      await expect(dayStatus(page)).toHaveText(/day status · training day · pull$/i);
      await expect(page.locator("main")).not.toContainText(/recovery day ·/i);
      await expect(page.locator('[data-schedule="times"]').filter({ visible: true })).toHaveText(
        "Wake 6:30 AM · Training 5:30 PM to 7:00 PM · Sleep lock 10:30 PM",
      );
      await expectFoldContract(page, vp);
      expect(pageErrors.filter((e) => /hydrat/i.test(e)), `hydration errors at ${vp.name}`).toEqual([]);
    });

    test("without a set schedule, Set Your Day is the one gold action and the horizon says the day is not set", async ({ page }) => {
      const pageErrors: string[] = [];
      page.on("pageerror", (e) => pageErrors.push(e.message));

      await bootSchedule(page, { when: AFTERNOON, scheduleSet: false });

      await expect(heroAction(page)).toHaveText(/^set your day$/i);
      const horizon = page.locator('[data-schedule="horizon"]');
      await expect(horizon.getByText("No plan drawn yet")).toBeVisible();
      await expect(horizon.locator('button[aria-haspopup="dialog"]').filter({ visible: true })).toHaveCount(0);
      await expect(page.locator('[data-schedule="times"]').filter({ visible: true })).toHaveText(/no operating times set yet/i);
      await expectFoldContract(page, vp);
      expect(pageErrors.filter((e) => /hydrat/i.test(e)), `hydration errors at ${vp.name}`).toEqual([]);

      /* A DOM click: the button, handler and editor are all real (see nutrition-room.spec.ts). */
      await heroAction(page).dispatchEvent("click");
      await expect
        .poll(() => page.evaluate(() => (document.activeElement as HTMLElement | null)?.dataset.scheduleField ?? null), { timeout: 5_000 })
        .toBe("wakeTime");
    });

    test("the gold action opens the meal confirmation and logs nothing by itself", async ({ page }) => {
      await bootSchedule(page, { when: AFTERNOON, scheduleSet: true });

      await heroAction(page).dispatchEvent("click");
      const drawer = page.getByRole("dialog", { name: /meal confirmation/i });
      await expect(drawer).toBeVisible();
      const logged = await page.evaluate((k) => JSON.parse(window.localStorage.getItem(k) as string).state.nutritionPrefs.loggedMealIds, KEY);
      expect(logged, "opening the confirmation logs nothing").toEqual([]);
      await page.keyboard.press("Escape");
      await expect(drawer).toHaveCount(0);
      await expect(heroAction(page)).toHaveText(/^log pre-workout meal$/i);
    });

    test("today's plan horizon items are real 44px buttons that open a sheet and close on Escape", async ({ page }) => {
      await bootSchedule(page, { when: AFTERNOON, scheduleSet: true });

      const horizon = page.locator('[data-schedule="horizon"]');
      const items = horizon.locator('button[aria-haspopup="dialog"]').filter({ visible: true });
      await expect(items.first()).toBeVisible({ timeout: 30_000 });
      expect(await items.count(), "meals, the training window and sleep lock").toBeGreaterThanOrEqual(3);

      const box = await items.first().boundingBox();
      // Rounded: a transformed control can measure a hair under 44 CSS px.
      expect(Math.round(box!.height), "44px hit area").toBeGreaterThanOrEqual(44);
      expect(Math.round(box!.width), "44px hit area").toBeGreaterThanOrEqual(44);

      await items.first().click();
      const sheet = page.getByRole("dialog");
      await expect(sheet).toBeVisible();
      await expect(sheet.getByRole("button").filter({ hasText: /log|undo|start|review|adjust/i }).first()).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(sheet).toHaveCount(0);
    });

    test("after sleep lock the horizon is quiet, not an empty track", async ({ page }) => {
      await bootSchedule(page, { when: AFTER_SLEEP_LOCK, scheduleSet: true });

      const horizon = page.locator('[data-schedule="horizon"]');
      await expect(horizon.getByText("Past sleep lock")).toBeVisible({ timeout: 30_000 });
      await expect(horizon.locator('button[aria-haspopup="dialog"]').filter({ visible: true })).toHaveCount(0);
      await expect(heroAction(page)).toHaveText(/if eaten$/i);
      await expectFoldContract(page, vp);
    });

    test("with the session moved away, the day status and the plan agree it is a recovery day", async ({ page }) => {
      await bootSchedule(page, { when: AFTERNOON, scheduleSet: true, movedAway: true });

      await expect(dayStatus(page)).toHaveText(/day status · recovery day · pull moved to thu, sep 17$/i);
      await expect(page.locator('[data-schedule="times"]').filter({ visible: true })).toHaveText("Wake 6:30 AM · Sleep lock 10:30 PM");
      const horizon = page.locator('[data-schedule="horizon"]');
      await expect(horizon.locator('button[aria-haspopup="dialog"]').filter({ visible: true }).first()).toBeVisible({ timeout: 30_000 });
      await expect(horizon.locator('button[aria-label^="Pull,"], button:has-text("Pull")').filter({ visible: true })).toHaveCount(0);
      await expect(heroAction(page)).not.toHaveText(/session/i);
      await expectFoldContract(page, vp);
    });
  });
}
