import { test, expect, type Page } from "@playwright/test";

/**
 * FIELD OP — Schedule's lifestyle mission. A 34-year-old with a resting heart
 * rate logged gets a walk with duration, distance and a heart-rate range, and
 * can run it live. A stage 2 blood pressure takes the target away and routes
 * the reading to care.
 */

function dayKey(offset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function boot(page: Page, checkIn: { systolic: number; diastolic: number; restingHr: number }) {
  const stamp = new Date().toISOString();
  await page.addInitScript(
    ({ stamp, checkIn, date }) => {
      window.localStorage.setItem("fba-preview-view", "schedule-command");
      window.localStorage.setItem(
        "final-boss-athlete-settings",
        JSON.stringify({
          state: {
            subscriptionTier: "elite",
            onboarding: { status: "complete", currentStep: 99, startedAt: stamp },
            setupProfile: { age: 34 },
            cycleCheckIns: [{ id: "ci-1", cycleId: null, date, createdAt: stamp, ...checkIn, ratings: {}, symptoms: [] }],
          },
          version: 0,
        }),
      );
    },
    { stamp, checkIn, date: dayKey(-1) },
  );
  await page.goto("/", { waitUntil: "domcontentloaded", timeout: 120_000 });
}

test.describe("field op", () => {
  test.setTimeout(240_000);
  test.use({ viewport: { width: 375, height: 812 } });

  test("a walk with duration, distance and heart-rate range, run live and logged", async ({ page }) => {
    await boot(page, { systolic: 122, diastolic: 78, restingHr: 62 });
    const card = page.getByRole("region", { name: "Field Op" });
    await expect(card).toBeVisible({ timeout: 120_000 });
    await expect(card).toContainText(/walk · \d+ min · ~\d+(\.\d)? mi/);
    await expect(card).toContainText(/Keep heart rate 1\d\d–1\d\d bpm/);
    await expect(card).toContainText("resting heart rate in your latest check-in");
    await expect(card).toContainText("min of daylight");
    await expect(card).toContainText("Wind down at");
    await expect(card).toContainText("Steps · 8,000–10,000 a day");
    await expect(card).toContainText(/Today.s walk is about \d,\d00 steps/);
    await card.getByLabel("Steps today").fill("3500");
    await card.getByRole("button", { name: "Save" }).click();
    await expect(card).toContainText("3,500 of 8,000–10,000 steps");
    await expect(card.getByRole("progressbar", { name: "Steps toward the lower end of the range" })).toHaveAttribute("aria-valuenow", "44");
    await card.scrollIntoViewIfNeeded();
    const box = await card.boundingBox();
    expect(box!.x + box!.width).toBeLessThanOrEqual(375);
    await page.screenshot({ path: "test-results/field-op/card.png" });

    await card.getByRole("button", { name: "Start op" }).click();
    const live = page.getByRole("dialog", { name: "Field Op · live" });
    await expect(live).toBeVisible();
    await live.getByRole("button", { name: "Start the clock" }).click();
    await live.getByLabel("Check a reading from your watch").fill("120");
    await expect(live.getByRole("status")).toHaveText("In your range");
    await page.screenshot({ path: "test-results/field-op/live.png" });
    await live.getByRole("button", { name: /Finish and log/ }).click();

    await expect(page.locator('[data-log-moment="status"]')).toContainText("Walk logged");
    const stored = await page.evaluate(() => window.localStorage.getItem("final-boss-athlete-settings") ?? "");
    expect(stored).toContain('"kind":"walk"');
  });

  test("a stage 2 blood pressure takes the heart-rate target away and routes the reading", async ({ page }) => {
    await boot(page, { systolic: 148, diastolic: 92, restingHr: 70 });
    const card = page.getByRole("region", { name: "Field Op" });
    await expect(card).toBeVisible({ timeout: 120_000 });
    await expect(card).toContainText("Easy walk");
    await expect(card).toContainText("148/92");
    await expect(card).toContainText("telehealth");
    await expect(card).not.toContainText("Keep heart rate");
  });
});
