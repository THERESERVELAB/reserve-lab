import { test, expect, type Page } from "@playwright/test";

/**
 * NUTRITION MEAL MOMENT — the room answers a logged meal.
 *
 *   · confirming a meal lands the moment once the confirmation closes: the
 *     words name the meal and the count, the hero's protein is true
 *   · Undo on the row reverses it, with the smaller "cleared" moment
 *   · the last meal of the day is the "Day fueled." milestone
 *   · a second log straight after the first replaces the first cleanly
 *   · reduced motion: the words, and nothing animated or drawn
 *   · static motion (paused): the same still words, nothing animated, drawn
 *     or vibrated
 *   · the words' plate never covers a Log/Undo control or the gold button,
 *     and takes no clicks
 *   · at 390 the words sit above the tab bar and nothing scrolls sideways
 *
 * Seeding is two-phase (see nutrition-room.spec.ts). The clock is shifted with
 * a Date-only shim: Playwright's clock also moves performance.now against the
 * document timeline, which would stall the motion under test.
 */

const KEY = "final-boss-athlete-settings";
/** Tuesday 15 September 2026, 4:12 PM local — a training day. */
const WHEN = new Date(2026, 8, 15, 16, 12, 0);

const DESKTOP = { width: 1280, height: 800 };
const PHONE = { width: 390, height: 844 };

async function boot(page: Page, loggedSelector: (ids: string[]) => string[]): Promise<string[]> {
  await page.addInitScript((iso) => {
    const base = new Date(iso).getTime();
    const origin = performance.now();
    const RealDate = Date;
    class FixedDate extends RealDate {
      constructor(...args: ConstructorParameters<typeof Date> | []) {
        if (args.length === 0) super(base + (performance.now() - origin));
        else super(...(args as ConstructorParameters<typeof Date>));
      }
      static now() {
        return base + (performance.now() - origin);
      }
    }
    window.Date = FixedDate as DateConstructor;
  }, WHEN.toISOString());
  await page.addInitScript((k) => {
    window.localStorage.setItem("fba-preview-view", "nutrition");
    const raw = window.localStorage.getItem(k);
    const parsed = raw ? JSON.parse(raw) : { state: {}, version: 0 };
    parsed.state = {
      ...parsed.state,
      onboarding: { ...(parsed.state.onboarding || {}), status: "complete", currentStep: 99, startedAt: "2026-09-01T12:00:00.000Z" },
    };
    window.localStorage.setItem(k, JSON.stringify(parsed));
  }, KEY);

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

  const patch = (logged: string[]) =>
    page.evaluate(
      ({ k, iso, logged }) => {
        const now = new Date(iso);
        const localKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
        const stamp = now.toISOString();
        const parsed = JSON.parse(window.localStorage.getItem(k) as string);
        const s = parsed.state;
        s.activeView = "nutrition";
        s.recoveryCommand = { ...s.recoveryCommand, hydrationTargetOz: 120, hydrationLogs: [] };
        s.nutritionPrefs = { ...s.nutritionPrefs, loggedMealIds: logged, latestMealLog: null, nutritionLogDate: localKey };
        s.scheduleProfile = {
          ...s.scheduleProfile,
          wakeTime: "06:30",
          sleepTarget: "22:30",
          trainingWindow: "evening",
          preferredTrainingStart: "17:30",
          preferredTrainingEnd: "19:00",
        };
        const steps: string[] = (s.setupProfile?.completedSteps ?? []).filter((step: string) => step !== "schedule");
        s.setupProfile = { ...s.setupProfile, setupComplete: true, completedAt: stamp, completedSteps: [...steps, "schedule"] };
        s.splitSystem = { ...(s.splitSystem || {}), key: "ppl-ul", source: "member", selectedAt: stamp };
        return JSON.stringify(parsed);
      },
      { k: KEY, iso: WHEN.toISOString(), logged },
    );

  /* Learn today's meal ids from the room itself, then seed which are logged. */
  const first = await patch([]);
  await page.addInitScript(({ k, v }) => window.localStorage.setItem(k, v), { k: KEY, v: first });
  await page.reload({ waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.locator("[data-meal-row]").first().waitFor({ timeout: 60_000 });
  const ids = await page.locator("[data-meal-row]").evaluateAll((els) => els.map((el) => el.getAttribute("data-meal-row") as string));
  expect(ids.length, "a planned meal day").toBeGreaterThanOrEqual(3);

  const seeded = await patch(loggedSelector(ids));
  await page.addInitScript(({ k, v }) => window.localStorage.setItem(k, v), { k: KEY, v: seeded });
  await page.reload({ waitUntil: "domcontentloaded", timeout: 120_000 });
  await expect(page.locator('[data-nutrition="primary-action"] button').filter({ visible: true }).first()).toBeVisible({ timeout: 60_000 });
  await page.waitForFunction(
    () => {
      const el = document.querySelector("[data-meal-row] [data-fuel='log-meal'] button");
      return Boolean(el && Object.keys(el).some((key) => key.startsWith("__reactProps")));
    },
    undefined,
    { timeout: 60_000 },
  );
  return ids;
}

const row = (page: Page, id: string) => page.locator(`[data-meal-row="${id}"]`).filter({ visible: true }).first();
const status = (page: Page) => page.locator('[data-meal-moment="status"]');

async function confirmMeal(page: Page, id: string) {
  await row(page, id).locator('[data-fuel="log-meal"] button').click();
  const drawer = page.getByRole("dialog", { name: /meal confirmation/i });
  await expect(drawer).toBeVisible();
  await drawer.getByRole("button", { name: /confirm log meal/i }).click();
  /* The room is still covered: the moment waits. */
  await expect(status(page)).toHaveCount(0);
  await drawer.getByRole("button", { name: /^done$/i }).click();
  await expect(drawer).toHaveCount(0, { timeout: 10_000 });
}

/** Meal-moment animations still running: Web Animations tagged by the effects, and anything inside the overlay. */
const runningMomentAnimations = (page: Page) =>
  page.evaluate(() =>
    document
      .getAnimations()
      .filter((a) => {
        if (a.playState !== "running") return false;
        const target = (a.effect as KeyframeEffect | null)?.target as Element | null;
        return String(a.id).startsWith("meal-moment") || Boolean(target?.closest("[data-meal-moment]"));
      })
      .map((a) => a.id || "animation"),
  );

/** The plate covers no visible Log/Undo control or gold button, and takes no clicks. */
async function expectPlateClear(page: Page) {
  const report = await page.evaluate(() => {
    const plate = document.querySelector('[data-meal-moment="status"]') as HTMLElement | null;
    if (!plate) return { present: false, pointer: "", covered: [] as string[] };
    const p = plate.getBoundingClientRect();
    const covered = Array.from(document.querySelectorAll<HTMLElement>('[data-fuel="log-meal"] button, [data-nutrition="primary-action"] button'))
      .filter((b) => {
        const r = b.getBoundingClientRect();
        if (r.width === 0 || r.height === 0 || r.bottom <= 0 || r.top >= window.innerHeight) return false;
        return r.left < p.right && r.right > p.left && r.top < p.bottom && r.bottom > p.top;
      })
      .map((b) => b.textContent?.trim() ?? "button");
    return { present: true, pointer: getComputedStyle(plate).pointerEvents, covered };
  });
  expect(report.present, "the plate shows").toBe(true);
  expect(report.pointer, "the plate takes no clicks").toBe("none");
  expect(report.covered, "the plate covers no meal control").toEqual([]);
}

test.describe("meal moment · full motion", () => {
  test.use({ viewport: DESKTOP });

  test("confirming a meal lands the moment: the words, the count and the true protein; Undo reverses it", async ({ page }) => {
    test.setTimeout(240_000);
    const pageErrors: string[] = [];
    page.on("pageerror", (e) => pageErrors.push(e.message));
    const ids = await boot(page, (all) => all.slice(0, 2));
    const total = ids.length;

    await confirmMeal(page, ids[2]);
    await expect(status(page)).toHaveCount(1);
    await expect(status(page)).toHaveAttribute("data-tone", "log");
    await expect(status(page)).toContainText(/logged/);
    await expect(page.locator('[data-meal-moment="detail"]')).toContainText(new RegExp(`^3 of ${total} · est\\. \\d+ g protein today$`, "i"));
    /* Full motion draws the light, behind the words' plate. */
    await expect(page.locator('[data-meal-moment="canvas"]')).toHaveCount(1);
    await expectPlateClear(page);
    /* The shell's "Meal logged" stays quiet; the moment announces itself. */
    await expect(page.locator('[data-meal-moment="announcer"]')).toContainText(`3 of ${total}`);

    /* The numbers land true: the words and the hero agree once it has arrived. */
    const detail = page.locator('[data-meal-moment="detail"] [data-live-number]');
    const hero = page.locator('[data-nutrition="protein"] [data-live-number]').filter({ visible: true }).first();
    await expect.poll(async () => (await detail.textContent()) === (await hero.textContent()), { timeout: 3_000 }).toBe(true);
    await expect(page.locator('[data-nutrition="protein"]').filter({ visible: true }).first()).toContainText(`3 of ${total}`);

    /* The effects clean up after themselves. */
    await expect(page.locator('[data-meal-moment="canvas"]')).toHaveCount(0, { timeout: 4_000 });
    await expect(status(page)).toHaveCount(0, { timeout: 6_000 });

    /* Undo on the row: the smaller moment, and the count goes back. */
    await row(page, ids[2]).locator('[data-fuel="log-meal"] button').click();
    await expect(status(page)).toHaveAttribute("data-tone", "clear");
    await expect(status(page)).toContainText(/cleared/);
    await expect(page.locator('[data-meal-moment="detail"]')).toContainText(new RegExp(`^2 of ${total}`));
    await expect(row(page, ids[2]).locator('[data-fuel="log-meal"] button')).toHaveText(/^log/i);
    await expect(page.locator('[data-nutrition="protein"]').filter({ visible: true }).first()).toContainText(`2 of ${total}`);
    /* A clear has no boom. */
    await expect(page.locator('[data-meal-moment="bloom"]')).toHaveCount(0);

    expect(pageErrors, "no page errors").toEqual([]);
  });

  test("the last meal of the day is the Day fueled milestone", async ({ page }) => {
    test.setTimeout(240_000);
    const ids = await boot(page, (all) => all.slice(0, all.length - 1));
    await confirmMeal(page, ids[ids.length - 1]);
    await expect(status(page)).toHaveAttribute("data-milestone", "day-fueled");
    await expect(page.locator('[data-meal-moment="headline"]')).toHaveText("Day fueled.");
    await expect(page.locator('[data-meal-moment="detail"]')).toContainText(`${ids.length} of ${ids.length}`);
  });

  test("a second log right after the first replaces it cleanly", async ({ page }) => {
    test.setTimeout(240_000);
    const ids = await boot(page, (all) => all.slice(0, 1));
    const total = ids.length;

    await confirmMeal(page, ids[1]);
    await expect(status(page)).toContainText(new RegExp(`2 of ${total}`));
    /* Straight into the next log while the first is still landing. */
    await confirmMeal(page, ids[2]);
    await expect(status(page)).toHaveCount(1);
    await expect(page.locator('[data-meal-moment="detail"]')).toContainText(new RegExp(`^3 of ${total}`));
    await expect(page.locator('[data-meal-moment="canvas"]')).toHaveCount(1);
    await expect(page.locator('[data-nutrition="protein"]').filter({ visible: true }).first()).toContainText(`3 of ${total}`);
    await expect(row(page, ids[1]).locator('[data-fuel="log-meal"] button')).toHaveText(/undo/i);
    await expect(row(page, ids[2]).locator('[data-fuel="log-meal"] button')).toHaveText(/undo/i);
  });

  test.describe("at 390", () => {
    test.use({ viewport: PHONE, hasTouch: true, isMobile: true });

    test("the words sit above the tab bar and nothing scrolls sideways", async ({ page }) => {
      test.setTimeout(240_000);
      const ids = await boot(page, () => []);
      await confirmMeal(page, ids[0]);
      await expect(status(page)).toHaveAttribute("data-milestone", "first-meal");
      await expect(page.locator('[data-meal-moment="headline"]')).toHaveText("Fuel day open.");

      const tabBar = page.locator('[data-shell="bottom-stack"]');
      await expect(tabBar).toBeVisible();
      const words = await status(page).boundingBox();
      const bar = await tabBar.boundingBox();
      expect(words && bar && words.y + words.height <= bar.y + 1, "the words clear the tab bar").toBe(true);
      expect(words && words.x >= 0 && words.x + words.width <= PHONE.width + 1, "the words fit 390").toBe(true);
      await expectPlateClear(page);

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(1);
    });
  });
});

test.describe("meal moment · reduced motion", () => {
  test.use({ viewport: DESKTOP });

  test("the words and a still check; nothing animated, nothing drawn", async ({ page }) => {
    test.setTimeout(240_000);
    await page.emulateMedia({ reducedMotion: "reduce" });
    const ids = await boot(page, (all) => all.slice(0, 2));

    await confirmMeal(page, ids[2]);
    await expect(status(page)).toHaveCount(1);
    await expect(page.locator('[data-meal-moment="overlay"]')).toHaveAttribute("data-motion", "reduced");
    await expect(page.locator('[data-meal-moment="detail"]')).toContainText(`3 of ${ids.length}`);
    await expect(page.locator('[data-meal-moment="canvas"]')).toHaveCount(0);
    await expect(page.locator('[data-meal-moment="sweep"]')).toHaveCount(0);
    await expect(page.locator('[data-meal-moment="bloom"]')).toHaveCount(0);
    expect(await runningMomentAnimations(page)).toEqual([]);
    await page.waitForTimeout(900);
    expect(await runningMomentAnimations(page)).toEqual([]);
    await expect(page.locator('[data-meal-moment="canvas"]')).toHaveCount(0);

    /* The numbers are simply true. */
    const detail = await page.locator('[data-meal-moment="detail"] [data-live-number]').textContent();
    const hero = await page.locator('[data-nutrition="protein"] [data-live-number]').filter({ visible: true }).first().textContent();
    expect(detail).toBe(hero);
  });
});

test.describe("meal moment · static motion", () => {
  test.use({ viewport: DESKTOP });

  test("paused motion still shows the words, with nothing animated, drawn or vibrated", async ({ page }) => {
    test.setTimeout(240_000);
    await page.addInitScript(() => {
      window.localStorage.setItem("fba-ambient-motion", JSON.stringify({ state: { paused: true }, version: 0 }));
      (window as unknown as { __vibrations: number }).__vibrations = 0;
      navigator.vibrate = () => {
        (window as unknown as { __vibrations: number }).__vibrations += 1;
        return true;
      };
    });
    const ids = await boot(page, (all) => all.slice(0, 2));

    await confirmMeal(page, ids[2]);
    await expect(page.locator('[data-meal-moment="overlay"]')).toHaveAttribute("data-motion", "static");
    await expect(status(page)).toHaveCount(1);
    await expect(status(page)).toContainText(/logged/);
    await expect(page.locator('[data-meal-moment="detail"]')).toContainText(`3 of ${ids.length}`);
    await expect(page.locator('[data-meal-moment="announcer"]')).toContainText(`3 of ${ids.length}`);
    await expectPlateClear(page);
    await expect(page.locator('[data-meal-moment="canvas"]')).toHaveCount(0);
    await expect(page.locator('[data-meal-moment="sweep"]')).toHaveCount(0);
    await expect(page.locator('[data-meal-moment="bloom"]')).toHaveCount(0);
    expect(await runningMomentAnimations(page)).toEqual([]);
    await page.waitForTimeout(900);
    expect(await runningMomentAnimations(page)).toEqual([]);
    expect(await page.evaluate(() => (window as unknown as { __vibrations: number }).__vibrations)).toBe(0);

    const detail = await page.locator('[data-meal-moment="detail"] [data-live-number]').textContent();
    const hero = await page.locator('[data-nutrition="protein"] [data-live-number]').filter({ visible: true }).first().textContent();
    expect(detail).toBe(hero);

    /* The words still leave on their own. */
    await expect(status(page)).toHaveCount(0, { timeout: 6_000 });
  });
});
