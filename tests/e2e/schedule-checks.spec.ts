import { test, expect } from "@playwright/test";

/**
 * SCHEDULE CHECKS — a member sets zinc an hour after doxycycline and a
 * pre-workout late in the evening. Today names both clashes with a source,
 * and never says what time to use instead.
 */

test("Today names the clashes in the times the member set", async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 390, height: 844 });
  const stamp = new Date().toISOString();
  await page.addInitScript((stamp) => {
    window.localStorage.setItem("fba-preview-view", "supplements");
    const entry = (id: string, name: string, category: string, time: string) => ({
      id, name, category, doseAmount: "", doseUnit: "", frequency: "daily", frequencyType: "daily", timingPreference: "", timeOfDayPreference: "custom", customTime: time,
      goalAssociation: [], isActive: true, createdAt: stamp, updatedAt: stamp,
    });
    window.localStorage.setItem(
      "final-boss-athlete-settings",
      JSON.stringify({
        state: {
          subscriptionTier: "elite",
          supportPlan: [{ id: "plan-fish", optionKey: "fish-oil", addedAt: stamp }],
          onboarding: { status: "complete", currentStep: 99, startedAt: stamp },
          trainingSession: {
            schedulePlan: { workoutTime: "17:30", commuteMinutes: 20, prepMinutes: 25, wakeTime: "06:00", sleepTime: "22:30", preferFasted: false },
            enhancementLog: [
              entry("dox", "Doxycycline", "medication", "08:00"),
              entry("zinc", "Zinc", "supplement", "09:00"),
              entry("pre", "Pre-workout", "supplement", "19:00"),
            ],
          },
        },
        version: 0,
      }),
    );
  }, stamp);
  await page.goto("/", { waitUntil: "domcontentloaded", timeout: 120_000 });

  const checks = page.getByRole("region", { name: "Checks on your schedule" });
  await expect(checks).toBeVisible({ timeout: 120_000 });
  await expect(checks).toContainText("2 clashes to look at");
  await expect(checks).toContainText("Minerals near a tetracycline antibiotic");
  await expect(checks).toContainText("Doxycycline");
  await expect(checks).toContainText("A stimulant close to your bedtime");
  await expect(checks).toContainText("You set these times.");
  await checks.scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/schedule-checks/phone.png" });

  /* The support plan item lands on the schedule untimed, and the member sets the time. */
  await expect(checks).toContainText("From your support plan, on your schedule without a time.");
  await expect(checks).toContainText("Fish Oil");
  await checks.getByRole("button", { name: "Set time" }).click();
  await expect(page.getByRole("dialog").first()).toBeVisible();
  const stored = await page.evaluate(() => window.localStorage.getItem("final-boss-athlete-settings") ?? "");
  expect(stored).toContain('"supportPlanItemId":"plan-fish"');
});
