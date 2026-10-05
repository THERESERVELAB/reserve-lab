import { test, expect, type Page } from "@playwright/test";

/**
 * LOG RANK — a member with two days on the record logs last night's sleep.
 * The third day ranks them up: the shell's log moment lands with the rank as
 * its milestone, and leaves on its own. Saving the same night again is a
 * quiet mark with no milestone.
 */

function dayKey(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function boot(page: Page) {
  const days = [dayKey(-2), dayKey(-1)];
  await page.addInitScript((logged) => {
    window.localStorage.setItem("fba-preview-view", "recovery");
    window.localStorage.setItem(
      "final-boss-athlete-settings",
      JSON.stringify({
        state: {
          subscriptionTier: "elite",
          onboarding: { status: "complete", currentStep: 99, startedAt: new Date().toISOString() },
          recoveryCommand: {
            sleepLogs: logged.map((date) => ({ date, hours: 7.5, bedtime: "23:00", wakeTime: "06:30" })),
            hydrationLogs: [],
            mobilityLogs: [],
            stressCheckIns: [],
            sleepTargetHours: 8,
            hydrationTargetOz: 100,
            mobilityWeeklyTarget: 4,
            suiteCompletedToday: [],
            suiteDate: null,
          },
        },
        version: 0,
      }),
    );
  }, days);
  await page.goto("/", { waitUntil: "domcontentloaded", timeout: 120_000 });
}

for (const vp of [{ name: "phone", width: 375, height: 812 }, { name: "desktop", width: 1280, height: 900 }]) {
  test(`rank up on the third logged day — ${vp.name}`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await boot(page);

    const asleep = page.getByRole("slider", { name: /Fell asleep/ });
    await asleep.waitFor({ timeout: 120_000 });
    await asleep.scrollIntoViewIfNeeded();
    await asleep.fill("270");
    await page.getByRole("slider", { name: /Woke up/ }).fill("240");
    await page.getByRole("button", { name: "Save Sleep" }).click();

    /* The rank rides the log moment as its milestone: a plate, not a takeover. */
    const moment = page.locator('[data-log-moment="status"]');
    await expect(moment).toBeVisible();
    await expect(moment).toHaveAttribute("data-milestone", "rank-operator");
    await expect(page.locator('[data-log-moment="headline"]')).toHaveText("Operator rank.");
    await expect(moment).toContainText("Sleep logged");
    await expect(moment).toContainText("3 nights in a row");
    expect(await moment.evaluate((el) => getComputedStyle(el).pointerEvents)).toBe("none");
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `test-results/log-rank/${vp.name}-rank-up.png` });

    /* It leaves on its own. */
    await expect(moment).toHaveCount(0, { timeout: 6_000 });

    /* Saving the same night again is a quiet mark, never a second milestone. */
    await page.getByRole("button", { name: "Save Sleep" }).click({ timeout: 10_000 }).catch(() => undefined);
    const again = page.locator('[data-log-moment="status"]');
    if (await again.count()) {
      await expect(again).toHaveAttribute("data-milestone", "");
      await expect(again).toHaveAttribute("data-tier", "mark");
    }
  });
}

test("appears without motion when the member prefers reduced motion", async ({ page }) => {
  test.setTimeout(180_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1280, height: 900 });
  await boot(page);
  const asleep = page.getByRole("slider", { name: /Fell asleep/ });
  await asleep.waitFor({ timeout: 120_000 });
  await asleep.fill("270");
  await page.getByRole("slider", { name: /Woke up/ }).fill("240");
  await page.getByRole("button", { name: "Save Sleep" }).click();
  const moment = page.locator('[data-log-moment="status"]');
  await expect(moment).toBeVisible();
  await expect(moment).toHaveAttribute("data-milestone", "rank-operator");
  await expect(page.locator('[data-log-moment="canvas"]')).toHaveCount(0);
  await expect(page.locator('[data-log-moment="announcer"]')).toContainText("Operator rank.");
});
