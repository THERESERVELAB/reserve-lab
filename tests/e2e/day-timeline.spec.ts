import { test, expect } from "@playwright/test";

/**
 * THE DAY ON ONE TRACK — a member running compounds opens Compound Command
 * and sees the day as a line with the moment on it, not a list. A mark names
 * itself when tapped, and a compound that is due can be logged from where it
 * sits.
 */
test.describe("day timeline", () => {
  test.setTimeout(240_000);

  for (const vp of [{ name: "phone", width: 390, height: 844 }, { name: "desktop", width: 1280, height: 900 }]) {
    test(`the day reads as a track, and a mark logs from it — ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      const stamp = new Date().toISOString();
      await page.addInitScript((s) => {
        window.localStorage.setItem("fba-preview-view", "supplements");
        const compound = (id: string, name: string, time: string) => ({
          id, name, officialName: name, compoundClass: "hormones_testosterone", category: "hormone", route: "injectable", injectionType: "im",
          doseAmount: "", doseUnit: "", frequency: "daily", frequencyType: "daily", scheduleRule: { type: "daily" },
          timingPreference: "", timeOfDayPreference: "custom", customTime: time, goalAssociation: [], isActive: true, createdAt: s, updatedAt: s,
        });
        window.localStorage.setItem(
          "final-boss-athlete-settings",
          JSON.stringify({
            state: {
              subscriptionTier: "elite",
              onboarding: { status: "complete", currentStep: 99, startedAt: s },
              setupProfile: { age: 34, setupComplete: true },
              trainingSession: {
                enhancementLog: [compound("t1", "Masteron", "08:00"), compound("t2", "Testosterone", "20:30")],
                enhancementAdherence: [], injectionLogs: [], compoundSupportLinks: [],
                schedulePlan: { wakeTime: "06:30", sleepTime: "22:30", workoutTime: "17:30" },
              },
            },
            version: 0,
          }),
        );
      }, stamp);
      await page.goto("/", { waitUntil: "domcontentloaded", timeout: 120_000 });

      const day = page.getByRole("region", { name: "Your day" });
      await expect(day).toBeVisible({ timeout: 120_000 });
      await expect(day).toContainText(/of 2 logged/);
      await expect(day.locator("[data-day-now]")).toBeVisible();
      await expect(day.locator('[data-day-mark="compound"]')).toHaveCount(2);
      /* The night and the wake mark put the compounds in a day, not on a bare bar. */
      await expect(day.locator('[data-day-mark="sleep"]')).toHaveCount(1);
      await expect(day.locator('[data-day-mark="wind-down"]')).toHaveCount(1);
      await expect(day).toContainText(/Next: |Nothing left on the clock today/);

      /* A mark names itself, and a compound logs from where it sits. */
      await day.getByRole("button", { name: /Masteron at/ }).click();
      await expect(day.locator("[data-day-headline]")).toHaveText("Masteron");
      await page.screenshot({ path: `test-results/day-timeline/${vp.name}.png` });
      await day.getByRole("button", { name: /^Log Masteron$/ }).click();
      await expect(page.locator("[data-log-moment]").first()).toBeVisible();
      await expect(day).toContainText(/1 of 2 logged/);
    });
  }
});
