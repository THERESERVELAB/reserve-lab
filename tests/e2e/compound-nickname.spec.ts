import { test, expect } from "@playwright/test";

/**
 * THE MEMBER'S NAME LEADS. Owner report: searching "Masteron" saved the
 * compound as Drostanolone. A name searched as an alias stays the name the
 * member sees; the official name is kept alongside.
 */

test.describe("compound nickname", () => {
  test.setTimeout(240_000);

  test("searching Masteron keeps Masteron as the display name", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("fba-preview-view", "supplements");
      window.localStorage.setItem(
        "final-boss-athlete-settings",
        JSON.stringify({ state: { subscriptionTier: "elite", onboarding: { status: "complete", currentStep: 99, startedAt: new Date().toISOString() } }, version: 0 }),
      );
    });
    await page.goto("/", { waitUntil: "domcontentloaded", timeout: 120_000 });
    await page.getByRole("button", { name: /Add Compound/ }).first().click({ timeout: 120_000 });
    const editor = page.getByRole("dialog", { name: "Compound editor" });
    await expect(editor).toBeVisible();

    await editor.getByRole("button", { name: "Official compound (optional)" }).click();
    await editor.getByPlaceholder("Search official names or aliases").fill("masteron");
    await editor.getByRole("button", { name: /^Drostanolone\s*AAS/ }).first().click();

    await expect(editor.getByPlaceholder("e.g. Retatrutide")).toHaveValue("Masteron");
  });
});
