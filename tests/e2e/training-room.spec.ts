import { test, expect, type Page } from "@playwright/test";
import { goldActions } from "./support/gold-action";

/**
 * TRAINING ROOM — the Training screen's first-screen contract (DESIGN_BIBLE.md §08 / §11 / §13).
 *
 * Seeds a realistic training-day member at a fixed clock and asserts the rules
 * the Pit Wall treatment of Training exists to keep:
 *
 *   · Start Session is inside the first screen, idle and in pre-session
 *   · exactly one gold action on the screen (the gold CTA is scarce)
 *   · the hero prints no hardcoded metric — a real read, or "Evidence needed"
 *   · every horizon block that opens something is a real 44px control
 *   · live, the horizon holds completely still
 *   · one h1, no horizontal overflow, no hydration errors
 *
 * Seeding follows apex-pit-wall.spec.ts: the first load lets the app write its
 * own full persisted state, and the patch is applied by an init script BEFORE
 * the app boots on reload. Patching localStorage from a running page races the
 * store's own persist writes and silently loses the seed.
 */

const KEY = "final-boss-athlete-settings";
/** Tuesday 15 September 2026, 4:12 PM local — a Pull day, session planned for 5:30 PM. */
const WHEN = new Date(2026, 8, 15, 16, 12, 0);

async function completeOnboarding(page: Page) {
  await page.addInitScript((k) => {
    window.localStorage.setItem("fba-preview-view", "training");
    const raw = window.localStorage.getItem(k);
    const parsed = raw ? JSON.parse(raw) : { state: {}, version: 0 };
    parsed.state = {
      ...parsed.state,
      onboarding: { ...(parsed.state.onboarding || {}), status: "complete", currentStep: 99, startedAt: "2026-09-01T12:00:00.000Z" },
    };
    window.localStorage.setItem(k, JSON.stringify(parsed));
  }, KEY);
}

async function bootTrainingRoom(page: Page, { recoveryLogs = true }: { recoveryLogs?: boolean } = {}) {
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
    ({ k, iso, logs }) => {
      const now = new Date(iso);
      const dayKey = (offset: number) => {
        const d = new Date(now);
        d.setDate(d.getDate() - offset);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      };
      const parsed = JSON.parse(window.localStorage.getItem(k) as string);
      const s = parsed.state;
      s.recoveryCommand = logs
        ? {
            ...s.recoveryCommand,
            sleepLogs: [7.2, 6.8, 7.6, 8.1, 7.0, 7.9, 7.4].map((hours, i) => ({ date: dayKey(7 - i), hours })),
            hydrationLogs: [{ date: dayKey(0), oz: 64 }],
            stressCheckIns: [{ date: dayKey(0), stress: 2, energy: 4, mood: 4 }],
          }
        : { ...s.recoveryCommand, sleepLogs: [], hydrationLogs: [], mobilityLogs: [], stressCheckIns: [] };
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
    { k: KEY, iso: WHEN.toISOString(), logs: recoveryLogs },
  );
  await page.addInitScript(({ k, v }) => window.localStorage.setItem(k, v), { k: KEY, v: patched });
  await page.reload({ waitUntil: "domcontentloaded", timeout: 120_000 });

  await expect(page.locator('[data-training="hero"]').filter({ visible: true })).toBeVisible({ timeout: 60_000 });
}

const startSession = (page: Page) => page.locator('[data-training="primary-action"] button').filter({ visible: true });

/** ReserveButton's primary tier is the only control painted in #0a0b10 text (read in any colour format). */
async function countGoldActions(page: Page) {
  return (await goldActions(page, { selector: "button", match: "text" })).length;
}

async function expectStartSessionInFirstScreen(page: Page, vp: { name: string; height: number }) {
  await expect(page.locator("h1").filter({ visible: true })).toHaveCount(1);

  const start = startSession(page);
  await expect(start).toHaveCount(1);
  await expect(start).toHaveText(/^start session$/i);
  const box = await start.boundingBox();
  expect(box, `Start Session has a box at ${vp.name}`).not.toBeNull();
  expect(box!.y, `Start Session is not above the screen at ${vp.name}`).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height, `Start Session sits inside the first screen at ${vp.name}`).toBeLessThanOrEqual(vp.height);

  expect(await countGoldActions(page), `exactly one gold action at ${vp.name}`).toBe(1);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `sideways scroll at ${vp.name}`).toBeLessThanOrEqual(1);
}

/** The server-rendered button can take a click before hydration and drop it; retry until the stage changes. */
async function enterPreSession(page: Page) {
  await expect(async () => {
    await startSession(page).click();
    await expect(page.getByRole("heading", { name: "Pre-Session Command" })).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 60_000 });
}

const VIEWPORTS = [
  { name: "1440x1000", width: 1440, height: 1000, touch: false },
  { name: "390x844", width: 390, height: 844, touch: true },
] as const;

for (const vp of VIEWPORTS) {
  test.describe(`viewport ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.touch, isMobile: vp.touch });

    test("Start Session is the one gold action inside the first screen", async ({ page }) => {
      const pageErrors: string[] = [];
      page.on("pageerror", (e) => pageErrors.push(e.message));

      await bootTrainingRoom(page);
      await expectStartSessionInFirstScreen(page, vp);

      /* The hero's reads are real: the seeded recovery logs produce a derived number, and
         the session read is the plan's own estimate. The old hardcoded tiles are gone. */
      const hero = page.locator('[data-training="hero"]').filter({ visible: true });
      await expect(hero).not.toContainText("84%");
      await expect(hero).not.toContainText("72%");
      await expect(hero.locator('[data-training="readiness"]')).toContainText(/\d/);
      await expect(hero.locator('[data-training="readiness"]')).not.toContainText("Evidence needed");
      await expect(hero.locator('[data-training="session-metric"]')).toContainText(/min|sets/);

      expect(pageErrors.filter((e) => /Hydration/i.test(e)), `hydration errors at ${vp.name}`).toEqual([]);
    });

    test("pre-session keeps Start Session as the one gold action in the first screen", async ({ page }) => {
      const pageErrors: string[] = [];
      page.on("pageerror", (e) => pageErrors.push(e.message));

      await bootTrainingRoom(page);
      await enterPreSession(page);
      await expectStartSessionInFirstScreen(page, vp);

      expect(pageErrors.filter((e) => /Hydration/i.test(e)), `hydration errors at ${vp.name}`).toEqual([]);
    });
  });
}

test.describe("no evidence, no number", () => {
  test.use({ viewport: { width: 1440, height: 1000 } });

  test("without recovery logs the hero asks for a check-in instead of printing a readiness", async ({ page }) => {
    await bootTrainingRoom(page, { recoveryLogs: false });
    const readiness = page.locator('[data-training="readiness"]').filter({ visible: true });
    await expect(readiness).toContainText("Evidence needed");
    await expect(readiness.getByRole("button", { name: /log check-in/i })).toBeVisible();
    await expect(readiness).not.toContainText(/\d/);
    await expect(page.locator('[data-training="hero"]').filter({ visible: true })).not.toContainText("84%");
    /* Honesty pass: Session Demand is the member's real tier, never a fixed score. */
    await expect(page.locator("main")).not.toContainText("8.9 / 10");
  });
});

test.describe("the horizon", () => {
  test.use({ viewport: { width: 1440, height: 1000 } });

  test("blocks are real 44px controls with readable labels", async ({ page }) => {
    await bootTrainingRoom(page);
    const horizon = page.locator('[data-training="horizon"]').filter({ visible: true });
    await expect(horizon).toBeVisible();

    const blocks = horizon.getByRole("button").filter({ visible: true });
    expect(await blocks.count(), "the horizon has at least one control").toBeGreaterThan(0);
    for (const block of await blocks.all()) {
      const box = await block.boundingBox();
      // Rounded: a transformed control can measure 43.99997px, which is 44 CSS px.
      expect(Math.round(box!.height), "every horizon control keeps a 44px hit area").toBeGreaterThanOrEqual(44);
    }

    /* Block labels, times and status words — the strip itself, not the section whisper above it. */
    const smallest = await horizon.locator('ol[aria-label="Session blocks"]').evaluateAll((lists) => {
      let min = Infinity;
      for (const list of lists) {
        for (const el of list.querySelectorAll("*")) {
          const ownText = [...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? "").trim().length > 0);
          const r = el.getBoundingClientRect();
          if (!ownText || r.width === 0 || r.height === 0 || el.closest(".sr-only")) continue;
          min = Math.min(min, parseFloat(getComputedStyle(el).fontSize));
        }
      }
      return min;
    });
    expect(smallest, "no horizon block text below 11px").toBeGreaterThanOrEqual(11);
  });

  test("live, the horizon and the hero hold completely still", async ({ page }) => {
    await bootTrainingRoom(page);
    await enterPreSession(page);
    await expect(async () => {
      await startSession(page).click();
      await expect(page.locator('[data-training="horizon"]').filter({ visible: true })).toContainText(/live/i, { timeout: 2_000 });
    }).toPass({ timeout: 60_000 });

    /* No gold Start Session while live — the cockpit owns the actions. */
    await expect(startSession(page)).toHaveCount(0);
    await expect(page.locator(".fba-horizon-flow")).toHaveCount(0);

    const moving = await page.evaluate(() =>
      ['[data-training="horizon"]', '[data-training="hero"]'].map((selector) =>
        [...document.querySelectorAll(selector)].reduce(
          (sum, root) =>
            sum +
            root.getAnimations({ subtree: true }).length +
            [root, ...root.querySelectorAll("*")].filter((el) => getComputedStyle(el).transitionDuration.split(",").some((d) => parseFloat(d) > 0)).length,
          0,
        ),
      ),
    );
    expect(moving, "animations or transitions on [horizon, hero] while live").toEqual([0, 0]);
  });
});
