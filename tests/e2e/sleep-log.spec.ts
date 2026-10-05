import { test, expect } from "@playwright/test";
import { colorAlpha } from "./support/surface-nesting";

/**
 * SLEEP LOG — a member drags to when they fell asleep and woke, sees the night
 * as "7h 30m", and saves it. No typing, no arithmetic, and on a phone the Save
 * button is reachable.
 */

for (const vp of [{ name: "phone", width: 375, height: 812 }, { name: "desktop", width: 1280, height: 900 }]) {
  test(`drag to log a night — ${vp.name}`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.addInitScript(() => {
      window.localStorage.setItem("fba-preview-view", "recovery");
      window.localStorage.setItem(
        "final-boss-athlete-settings",
        JSON.stringify({ state: { subscriptionTier: "elite", onboarding: { status: "complete", currentStep: 99, startedAt: new Date().toISOString() } }, version: 0 }),
      );
    });
    await page.goto("/", { waitUntil: "domcontentloaded", timeout: 120_000 });

    const asleep = page.getByRole("slider", { name: /Fell asleep/ });
    const woke = page.getByRole("slider", { name: /Woke up/ });
    await asleep.waitFor({ timeout: 120_000 });
    await asleep.scrollIntoViewIfNeeded();

    const save = page.getByRole("button", { name: "Save Sleep" });
    await expect(save).toBeDisabled();
    await expect(page.getByText("Slide to when you fell asleep and when you woke up.")).toBeVisible();

    // 11:30 PM is 270 minutes into the bedtime track (from 7 PM); 7:00 AM is 240 into the wake track (from 3 AM).
    await asleep.fill("270");
    await woke.fill("240");

    await expect(page.getByText("7h 30m", { exact: true })).toBeVisible();
    await expect(page.getByText(/11:30 PM → 7:00 AM/).first()).toBeVisible();
    await expect(save).toBeEnabled();

    await save.scrollIntoViewIfNeeded();
    const box = await save.boundingBox();
    const hit = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.textContent ?? "", [box!.x + box!.width / 2, box!.y + box!.height / 2]);
    expect(hit).toContain("Save Sleep");
    await page.screenshot({ path: `test-results/sleep-log/${vp.name}.png` });

    await save.click();
    await expect(page.getByText("Night saved")).toBeVisible();
    const stored = await page.evaluate(() => window.localStorage.getItem("final-boss-athlete-settings") ?? "");
    expect(stored).toContain('"bedtime":"23:30"');
    expect(stored).toContain('"wakeTime":"07:00"');
    expect(stored).toContain('"hours":7.5');
  });
}

/**
 * The same logger in Schedule's bottom sheet keeps the #57 form guard: a night
 * being set survives an outside click, Escape asks before discarding it, and
 * the saved state is plain text — no tinted box inside the logger.
 */
const KEY = "final-boss-athlete-settings";
/** Tuesday 15 September 2026, 6:32 AM local: just after the 6:30 wake, last night not logged. */
const MORNING = new Date(2026, 8, 15, 6, 32, 0);

for (const vp of [{ name: "phone", width: 390, height: 844, touch: true }, { name: "desktop", width: 1280, height: 900, touch: false }]) {
  test.describe(`sleep log sheet — ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.touch, isMobile: vp.touch });

    test("keeps the night on an outside click, asks on Escape, and saves untinted", async ({ page }) => {
      test.setTimeout(240_000);
      await page.clock.setFixedTime(MORNING);
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
        ({ k, iso }) => {
          const now = new Date(iso);
          const parsed = JSON.parse(window.localStorage.getItem(k) as string);
          const s = parsed.state;
          s.recoveryCommand = { ...s.recoveryCommand, sleepLogs: [], hydrationLogs: [] };
          s.scheduleProfile = { ...s.scheduleProfile, wakeTime: "06:30", sleepTarget: "22:30", trainingWindow: "evening", preferredTrainingStart: "17:30", preferredTrainingEnd: "19:00" };
          const steps: string[] = (s.setupProfile?.completedSteps ?? []).filter((step: string) => step !== "schedule");
          s.setupProfile = { ...s.setupProfile, setupComplete: true, completedAt: now.toISOString(), completedSteps: [...steps, "schedule"] };
          s.splitSystem = { ...(s.splitSystem || {}), key: "ppl-ul", source: "member", selectedAt: now.toISOString() };
          return JSON.stringify(parsed);
        },
        { k: KEY, iso: MORNING.toISOString() },
      );
      await page.addInitScript(({ k, v }) => window.localStorage.setItem(k, v), { k: KEY, v: patched });
      await page.reload({ waitUntil: "domcontentloaded", timeout: 120_000 });

      /* The horizon's Wake item offers the log while last night is open. */
      const wake = page.locator('[data-schedule="horizon"] button[aria-haspopup="dialog"]').filter({ visible: true }).filter({ hasText: /wake/i }).first();
      const logIt = page.getByRole("dialog").getByRole("button", { name: /log last night's sleep/i });
      await expect(async () => {
        await wake.click();
        await expect(logIt).toBeVisible({ timeout: 2_000 });
      }).toPass({ timeout: 90_000 });
      await logIt.click();
      const sheet = page.getByRole("dialog", { name: "Sleep Log" });
      await expect(sheet).toBeVisible();

      const asleep = sheet.getByRole("slider", { name: /Fell asleep/ });
      await asleep.fill("270");
      await expect(asleep).toHaveAttribute("aria-valuetext", "11:30 PM");
      /* The logger reports the change to the sheet from an effect, one render after the slider shows it.
         An outside click that lands in between meets a sheet that still reads clean and closes it —
         the old 2-in-4 flake. Wait until the guard itself holds the change. */
      await expect(sheet).toHaveAttribute("data-form-dirty", "true");

      const box = (await sheet.boundingBox())!;
      if (box.y > 12) {
        await page.mouse.click(vp.width / 2, 6);
        await page.waitForTimeout(300);
        await expect(sheet, "a night being set stays open").toBeVisible();
        await expect(asleep).toHaveAttribute("aria-valuetext", "11:30 PM");
      }

      const discard = page.getByRole("alertdialog", { name: "Discard unsaved changes" });
      await page.keyboard.press("Escape");
      await expect(discard).toBeVisible();
      await discard.getByRole("button", { name: "Keep Editing" }).click();
      await expect(asleep).toHaveAttribute("aria-valuetext", "11:30 PM");

      await sheet.getByRole("slider", { name: /Woke up/ }).fill("240");
      await sheet.getByRole("button", { name: "Save Sleep" }).click();
      const saved = sheet.getByRole("status").filter({ hasText: "Night saved" });
      await expect(saved).toBeVisible();
      const paint = await saved.evaluate((el) => getComputedStyle(el).backgroundColor);
      expect(colorAlpha(paint), `the saved state is text, not a tinted box: ${paint}`).toBe(0);
    });
  });
}
