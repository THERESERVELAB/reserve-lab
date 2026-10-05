import { test, expect, type Page } from "@playwright/test";
import { colorAlpha } from "./support/surface-nesting";
import { gold, goldActions as findGoldActions } from "./support/gold-action";

/**
 * APEX PIT WALL — the command-center contract (DESIGN_BIBLE.md §11 / §13, V1.1).
 *
 * Seeds a realistic training-day member at a fixed clock and asserts the rules
 * the redesign exists to keep:
 *
 *   · condition, next move and risk share the first screen at every size
 *   · exactly one gold action on the screen (the gold CTA is scarce); behind
 *     "Full briefing", the Weekly Challenge's Mark Done is secondary
 *   · the gold action does what it says — logging the due meal advances the move
 *   · one h1, no horizontal overflow, no hydration errors
 *   · on a member's real clock, the screen is painted, not only present
 *
 * Seeding is two-phase on purpose: the first load lets the app write its own
 * full persisted state, and the patch is applied by an init script BEFORE the
 * app boots on reload. Patching localStorage from a running page races the
 * store's own persist writes and silently loses the seed.
 */

const KEY = "final-boss-athlete-settings";
/** Tuesday 15 September 2026, 4:12 PM local — the pre-workout meal window is due. */
const WHEN = new Date(2026, 8, 15, 16, 12, 0);

async function completeOnboarding(page: Page) {
  await page.addInitScript((k) => {
    window.localStorage.setItem("fba-preview-view", "dashboard");
    const raw = window.localStorage.getItem(k);
    const parsed = raw ? JSON.parse(raw) : { state: {}, version: 0 };
    parsed.state = {
      ...parsed.state,
      onboarding: { ...(parsed.state.onboarding || {}), status: "complete", currentStep: 99, startedAt: "2026-09-01T12:00:00.000Z" },
    };
    window.localStorage.setItem(k, JSON.stringify(parsed));
  }, KEY);
}

async function bootTrainingDay(page: Page) {
  await page.clock.setFixedTime(WHEN);
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
    ({ k, iso }) => {
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
        sleepLogs: [7.2, 6.8, 7.6, 8.1, 7.0, 7.9, 7.4].map((hours, i) => ({ date: dayKey(7 - i), hours })),
        hydrationLogs: [{ date: dayKey(0), oz: 64 }],
        stressCheckIns: [{ date: dayKey(0), stress: 2, energy: 4, mood: 4 }],
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
      s.splitSystem = { ...(s.splitSystem || {}), key: "ppl-ul", source: "member", selectedAt: now.toISOString() };
      return JSON.stringify(parsed);
    },
    { k: KEY, iso: WHEN.toISOString() },
  );
  await page.addInitScript(({ k, v }) => window.localStorage.setItem(k, v), { k: KEY, v: patched });
  await page.reload({ waitUntil: "domcontentloaded", timeout: 120_000 });

  await expect(page.locator('[data-apex="next-move-title"]').filter({ visible: true }).first()).toHaveText("Pre-Workout Meal", {
    timeout: 60_000,
  });
}

const VIEWPORTS = [
  { name: "1440x1000", width: 1440, height: 1000, touch: false },
  { name: "390x844", width: 390, height: 844, touch: true },
  { name: "375x812", width: 375, height: 812, touch: true },
] as const;

for (const vp of VIEWPORTS) {
  test.describe(`viewport ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.touch, isMobile: vp.touch });

    test("condition, next move and risk share the first screen", async ({ page }) => {
      const pageErrors: string[] = [];
      page.on("pageerror", (e) => pageErrors.push(e.message));

      await bootTrainingDay(page);

      expect(pageErrors.filter((e) => /Hydration/i.test(e)), `hydration errors at ${vp.name}`).toEqual([]);
      await expect(page.locator("h1").filter({ visible: true })).toHaveCount(1);

      for (const selector of ["main h1", '[data-apex="readiness"]', '[data-apex="next-move-title"]', '[data-apex="risk"]']) {
        const el = page.locator(selector).filter({ visible: true }).first();
        await expect(el, `${selector} visible at ${vp.name}`).toBeVisible();
        const box = await el.boundingBox();
        expect(box, `${selector} has a box at ${vp.name}`).not.toBeNull();
        expect(box!.y + box!.height, `${selector} sits inside the first screen at ${vp.name}`).toBeLessThanOrEqual(vp.height);
      }

      /* ReserveButton's primary tier is the only control painted in #0a0b10 text (read in any colour format). */
      const goldActions = (await findGoldActions(page, { selector: "button", match: "text" })).length;
      expect(goldActions, `exactly one gold action at ${vp.name}`).toBe(1);

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `sideways scroll at ${vp.name}`).toBeLessThanOrEqual(1);
    });
  });
}

test.describe("the gold action does what it says", () => {
  test.use({ viewport: { width: 1440, height: 1000 } });

  test("logging the due meal advances the next move", async ({ page }) => {
    await bootTrainingDay(page);
    const title = page.locator('[data-apex="next-move-title"]').filter({ visible: true }).first();
    await expect(title).toHaveText("Pre-Workout Meal");

    await page.getByRole("button", { name: /^log meal$/i }).filter({ visible: true }).first().click();

    /* Honesty pass: Log Meal opens the meal confirmation. Nothing counts on tap. */
    const drawer = page.getByRole("dialog", { name: /meal confirmation/i });
    await expect(drawer).toBeVisible();
    await expect(title).toHaveText("Pre-Workout Meal");
    await drawer.getByRole("button", { name: /confirm log meal/i }).click();
    await drawer.getByRole("button", { name: /^done$/i }).click();
    await expect(drawer).toHaveCount(0);

    /* The meal is logged, so the next item in the day — the pre-session command — becomes the move. */
    await expect(title).toHaveText("Pre-Session Command");
  });

  test("the Weekly Challenge's Mark Done is secondary, never a second gold fill", async ({ page }) => {
    await bootTrainingDay(page);
    const briefing = page.locator("main details").filter({ has: page.locator("summary", { hasText: "Full briefing" }) }).first();
    await briefing.locator("summary").click();
    const markDone = page.getByRole("button", { name: /^mark done$/i });
    await expect(markDone).toBeVisible();
    const paint = await markDone.evaluate((b) => {
      const cs = getComputedStyle(b);
      return { color: cs.color, background: `${cs.backgroundColor} ${cs.backgroundImage}` };
    });
    expect(gold.isInk(paint.color), `not the primary tier's near-black text: ${paint.color}`).toBe(false);
    expect(paint.background, "no gradient fill").not.toContain("gradient");
    expect(gold.paintIsGold(paint.background), `not a gold fill in any colour format: ${paint.background}`).toBe(false);
    /* The secondary tier's fill is the accent at 8% — a tint, not a gold fill. */
    /* Every colour in the fill, in any format Chromium computes (rgba, oklab, oklch, color(), color-mix). */
    const colours = [...paint.background.matchAll(/(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix)\((?:[^()]|\([^()]*\))*\)|#[0-9a-f]{3,8}/gi)].map((m) => m[0]);
    expect(colours.length, `fill is readable: ${paint.background}`).toBeGreaterThan(0);
    expect(colours.every((c) => colorAlpha(c) < 0.5), `fill stays a tint: ${paint.background}`).toBe(true);
  });
});

/* A bounding box cannot tell present from painted: a fixed-clock capture once showed the
   whole desktop Pit Wall at opacity 0 while every box check above passed. Playwright's
   emulated clocks also slow or stall the view's entry fade, so painting is checked here,
   on the clock a member actually has. */
test.describe("the screen is painted, not only present", () => {
  for (const vp of [VIEWPORTS[0], VIEWPORTS[1]]) {
    test(`on a real clock at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await completeOnboarding(page);
      await page.goto("/", { waitUntil: "domcontentloaded", timeout: 120_000 });
      await page.locator("main h1").first().waitFor({ timeout: 120_000 });

      await expect
        .poll(
          () =>
            page.evaluate(() => {
              const hero = [...document.querySelectorAll("main h1")].find((el) => el.getBoundingClientRect().width > 0);
              let opacity = hero ? 1 : 0;
              for (let el: Element | null = hero ?? null; el; el = el.parentElement) {
                opacity *= Number(getComputedStyle(el).opacity);
              }
              return opacity;
            }),
          { message: `the Apex hero is painted at ${vp.name}`, timeout: 10_000 },
        )
        .toBe(1);
    });
  }
});

/* WCAG 2.2.2: background motion that starts on its own must be pausable, and the
   pause must actually stop it and survive a reload on this device. */
test.describe("background motion can be paused", () => {
  test.use({ viewport: { width: 1440, height: 1000 } });

  test("the top bar pause stops ambient motion and is remembered", async ({ page }) => {
    await completeOnboarding(page);
    await page.goto("/", { waitUntil: "domcontentloaded", timeout: 120_000 });
    await page.locator("main h1").first().waitFor({ timeout: 120_000 });

    const pause = page.getByRole("button", { name: "Pause background motion" });
    await expect(pause).toBeVisible({ timeout: 30_000 });
    await expect(page.locator(".fba-ambient-a")).toHaveCount(1);

    await pause.click();
    await expect(page.getByRole("button", { name: "Play background motion" })).toBeVisible();
    await expect(page.locator(".fba-ambient-a")).toHaveCount(0);
    /* A loop may stay mounted while it fades out; what must hold is that nothing plays. */
    await expect
      .poll(() => page.evaluate(() => [...document.querySelectorAll("video")].every((video) => video.paused)), {
        message: "no background video is playing while paused",
      })
      .toBe(true);

    await page.reload({ waitUntil: "domcontentloaded", timeout: 120_000 });
    await expect(page.getByRole("button", { name: "Play background motion" })).toBeVisible({ timeout: 30_000 });
    await expect(page.locator(".fba-ambient-a")).toHaveCount(0);
  });
});
