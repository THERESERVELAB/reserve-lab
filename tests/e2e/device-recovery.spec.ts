import { test, expect } from "@playwright/test";

/**
 * SETTINGS · RECOVER FROM THIS DEVICE — a compound that only survives in one of
 * this device's safety copies is listed, restored only when the member picks
 * it, and merged back in beside what they have now.
 */
const TEST_E = {
  id: "enh-1789510439098-vnduu",
  name: "Testosterone Enanthate",
  category: "hormone",
  isActive: true,
  startDate: "2026-09-15",
  createdAt: "2026-09-15T22:13:00.000Z",
  updatedAt: "2026-09-15T22:13:00.000Z",
};
const RETA = { id: "enh-reta", name: "Retatrutide", category: "peptide", isActive: true, createdAt: "2026-09-10T12:00:00.000Z", updatedAt: "2026-09-10T12:00:00.000Z" };

test.describe("recover from this device", () => {
  test.setTimeout(240_000);

  test("lists the missing compound and restores it only when chosen", async ({ page }) => {
    await page.addInitScript(
      ({ testE, reta }) => {
        if (window.sessionStorage.getItem("seeded")) return;
        window.sessionStorage.setItem("seeded", "1");
        const onboarding = { status: "complete", currentStep: 99, startedAt: new Date().toISOString() };
        window.localStorage.setItem("fba-preview-view", "settings");
        window.localStorage.setItem(
          "final-boss-athlete-settings",
          JSON.stringify({ state: { subscriptionTier: "elite", onboarding, trainingSession: { enhancementLog: [reta] } }, version: 0 }),
        );
        window.localStorage.setItem(
          "fba-backup:pre-hydrate:2026-09-18T19:41:04.581Z",
          JSON.stringify({
            athleteStore: JSON.stringify({ state: { onboarding, trainingSession: { enhancementLog: [testE, reta] } }, version: 19 }),
            logs: {},
          }),
        );
      },
      { testE: TEST_E, reta: RETA },
    );
    await page.goto("/", { waitUntil: "domcontentloaded", timeout: 120_000 });

    const check = page.getByRole("button", { name: "Check this device" });
    await expect(check).toBeVisible({ timeout: 120_000 });
    await check.click();

    const option = page.getByRole("checkbox", { name: /Testosterone Enanthate/ });
    await expect(option).toBeVisible();
    await expect(page.getByText("Added Sep 15, 2026 · Start date Sep 15, 2026", { exact: false })).toBeVisible();
    // Nothing comes back on its own.
    expect(await page.evaluate(() => window.localStorage.getItem("final-boss-athlete-settings") ?? "")).not.toContain("vnduu");
    await expect(page.getByRole("button", { name: "Restore selected" })).toBeDisabled();

    await option.check();
    await page.getByRole("button", { name: "Restore 1 record" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Restored 1 record." })).toBeVisible();

    const persisted = await page.evaluate(() => window.localStorage.getItem("final-boss-athlete-settings") ?? "");
    expect(persisted).toContain("enh-1789510439098-vnduu");
    expect(persisted).toContain("enh-reta");
    expect(persisted).toContain('"action":"restored"');
    await expect(page.getByText("Nothing to recover on this device.", { exact: false })).toBeVisible();
  });
});
