import { test, expect } from "@playwright/test";

/**
 * SETTINGS · PEAK MODE — one Peak Mode. Settings sets the same look the
 * Compound Command Peak Mode reads; the old Special Mode picker, which nothing
 * read, is gone.
 */
test.describe("settings peak mode", () => {
  test.setTimeout(240_000);

  test("picking a look saves it, and Off clears it", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("fba-preview-view", "settings");
      window.localStorage.setItem(
        "final-boss-athlete-settings",
        JSON.stringify({ state: { subscriptionTier: "elite", onboarding: { status: "complete", currentStep: 99, startedAt: new Date().toISOString() } }, version: 0 }),
      );
    });
    await page.goto("/", { waitUntil: "domcontentloaded", timeout: 120_000 });

    const group = page.getByRole("group", { name: "Peak Mode" });
    await expect(group).toBeVisible({ timeout: 120_000 });
    await expect(page.getByText("Special mode", { exact: true })).toHaveCount(0);
    await expect(group.getByRole("button", { name: /^Off/ })).toHaveAttribute("aria-pressed", "true");

    await group.getByRole("button", { name: /Lean · dry · hard/ }).click();
    await expect(group.getByRole("button", { name: /Lean · dry · hard/ })).toHaveAttribute("aria-pressed", "true");
    await expect(group).toContainText("Fuel goal: Shred / Cut");
    expect(await page.evaluate(() => window.localStorage.getItem("final-boss-athlete-settings") ?? "")).toContain('"peakLook":"lean-hard"');

    await group.getByRole("button", { name: /^Off/ }).click();
    expect(await page.evaluate(() => window.localStorage.getItem("final-boss-athlete-settings") ?? "")).toContain('"peakLook":null');
  });
});
