import { test, expect, type Page } from "@playwright/test";

/* ════════════════════════════════════════════════════════════════════════
   WATER, POURED — the member picks a pour size, logs it, sees the bottle and
   the count move, can take a mistaken pour back, and sets their own water and
   mobility targets.
   ════════════════════════════════════════════════════════════════════════ */

const KEY = "final-boss-athlete-settings";
/** Tuesday 15 September 2026, 4:12 PM local. */
const AFTERNOON = new Date(2026, 8, 15, 16, 12, 0);

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


test.describe("water logger and the member's own targets", () => {
  for (const vp of [{ name: "phone", width: 390, height: 844 }, { name: "desktop", width: 1440, height: 1000 }]) {
    test(`pour, undo and set targets — ${vp.name}`, async ({ page }) => {
      test.setTimeout(240_000);
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await bootRecovery(page, { when: AFTERNOON, evidence: true });

      const logger = page.locator("[data-water-logger]");
      await logger.scrollIntoViewIfNeeded();
      const readout = logger.locator('[data-log-readout="water"]');
      await expect(readout).toContainText("64");
      await expect(readout).toContainText("/ 120 oz");
      await expect(logger.locator("[data-water-status]")).toHaveText("56 oz to go");

      /* A bigger pour, remembered as the member's size. */
      await logger.getByRole("button", { name: "32 oz", exact: true }).click();
      await expect(logger.getByRole("button", { name: "32 oz", exact: true })).toHaveAttribute("aria-pressed", "true");
      await logger.getByRole("button", { name: /^\+ log 32 oz$/i }).click();
      await expect(readout).toContainText("96");
      await expect(logger.locator("[data-water-status]")).toHaveText("Three quarters in");

      /* A mistaken pour comes back off — and this happens BEFORE the
         screenshot on purpose. Undo is a six-second window (WaterLogger's own
         timer), and a full-page screenshot on a loaded two-core runner can eat
         most of it: the control had simply expired by the time the click went
         looking for it, and the test hung until its own timeout. The picture
         is an artifact, not an assertion, so it waits. */
      await logger.getByRole("button", { name: "Undo" }).click();
      await expect(readout).toContainText("64");
      await page.screenshot({ path: `test-results/water-logger/${vp.name}-poured.png` });

      /* The member's own targets. */
      await logger.getByRole("button", { name: "Edit target" }).click();
      const sheet = page.getByRole("dialog", { name: "Your targets" });
      await expect(sheet).toBeVisible();
      await sheet.getByRole("button", { name: "80 oz", exact: true }).click();
      await sheet.getByRole("button", { name: "Lower mobility target" }).click();
      await sheet.getByRole("button", { name: "Save targets" }).click();
      await expect(sheet).toBeHidden();
      await expect(readout).toContainText("/ 80 oz");
      /* The mobility target reads on the room's readout row (its detail sits behind "Recovery detail"). */
      await expect(page.locator('[data-log-readout="mobility"]').filter({ visible: true }).first()).toContainText("/ 4");

      const saved = await page.evaluate((k) => JSON.parse(window.localStorage.getItem(k) as string).state.recoveryCommand, KEY);
      expect(saved.hydrationTargetOz).toBe(80);
      expect(saved.mobilityWeeklyTarget).toBe(4);
      expect(saved.waterPourOz).toBe(32);
    });
  }
});
