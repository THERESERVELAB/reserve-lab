import { test, expect, type Page } from "@playwright/test";

import { SAFETY_ACK_VERSION } from "@/lib/safety/acknowledgement";

/**
 * LABEL CHECK — a member brings a "gut detox and performance" drink they
 * already use. Pasted or photographed, Reserve reads what the label lists and
 * says what it knows, with sources — and never judges the product.
 */

const LABEL = `Supplement Facts
Biotin 5000 mcg
Zinc 15 mg
Proprietary Gut Detox Blend 3 g
Dandelion Root, Ginger Root, Turmeric Root Extract, Green Tea Extract
Caffeine Anhydrous, Taurine`;

async function openLabelCheck(page: Page, viewport: { width: number; height: number }) {
  await page.setViewportSize(viewport);
  const stamp = new Date().toISOString();
  await page.addInitScript(
    ({ stamp, ack }) => {
      window.localStorage.setItem("fba-preview-view", "supplements");
      window.localStorage.setItem(
        "final-boss-athlete-settings",
        JSON.stringify({
          state: {
            subscriptionTier: "elite",
            onboarding: { status: "complete", currentStep: 99, startedAt: stamp },
            setupProfile: { age: 34 },
            safetyAcknowledgement: { acknowledgedAt: stamp, version: ack, adultConfirmedAt: stamp },
          },
          version: 0,
        }),
      );
    },
    { stamp, ack: SAFETY_ACK_VERSION },
  );
  await page.goto("/", { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.getByRole("tab", { name: "More", exact: true }).click({ timeout: 120_000 });
  await page.getByRole("button", { name: /^Support Stack/ }).click({ timeout: 60_000 });
  await page.getByRole("button", { name: "Browse supplements" }).click({ timeout: 60_000 });
  await page.getByRole("button", { name: /Check a product label/ }).click();
  await expect(page.getByRole("dialog", { name: "Check a product label" })).toBeVisible();
}

test.describe("label check", () => {
  test.setTimeout(240_000);

  test("reads a pasted label and says what is in it, with sources", async ({ page }) => {
    await openLabelCheck(page, { width: 375, height: 812 });
    const dialog = page.getByRole("dialog", { name: "Check a product label" });

    await expect(dialog.getByRole("button", { name: "Check this label" })).toBeDisabled();
    await dialog.getByLabel("Product name").fill("Morning Gut Detox + Performance");
    await dialog.getByLabel("Ingredients").fill(LABEL);
    await dialog.getByRole("button", { name: "Check this label" }).click();

    const results = dialog.locator('[data-label-check="results"]');
    await expect(results).toBeVisible();
    await expect(results.getByRole("region", { name: "Known hazards in these ingredients" })).toContainText("Turmeric or curcumin");
    await expect(results.getByRole("region", { name: "Known hazards in these ingredients" })).toContainText("Green tea extract");
    await expect(results.getByRole("region", { name: "Known hazards in these ingredients" })).toContainText("Caffeine");
    await expect(results.getByRole("region", { name: "Changes lab results" })).toContainText("Biotin");
    await expect(results.getByRole("region", { name: "About this label" })).toContainText("Proprietary blend");
    await expect(results.getByRole("region", { name: "About this label" })).toContainText("no compelling research");
    await expect(results.getByRole("region", { name: "In Reserve's library" })).toContainText("Taurine");
    await expect(results.getByRole("region", { name: "Not reviewed by Reserve" })).toContainText("Dandelion Root");
    await expect(results).toContainText("does not judge the product");
    await expect(results.getByRole("link", { name: /Detoxes and Cleanses/ })).toBeVisible();
    await page.screenshot({ path: "test-results/label-check/phone-results.png", fullPage: false });

    /* Only the product name is kept, and only when the member adds it. */
    await results.getByRole("button", { name: /add it to my support plan/ }).click();
    await expect(results.getByText("Added to your support plan by name. The label itself is not saved.")).toBeVisible();
    const stored = await page.evaluate(() => window.localStorage.getItem("final-boss-athlete-settings") ?? "");
    expect(stored).toContain("Morning Gut Detox + Performance");
    expect(stored).not.toContain("Dandelion Root");
  });

  test("reads a photographed label on the device", async ({ page }) => {
    await openLabelCheck(page, { width: 1280, height: 900 });
    const dialog = page.getByRole("dialog", { name: "Check a product label" });

    const photo = await page.context().newPage();
    await photo.setViewportSize({ width: 900, height: 360 });
    await photo.setContent(`<body style="margin:0;background:#fff;font-family:Arial,sans-serif;color:#000">
      <div id="label" style="padding:28px 36px;width:820px;font-size:30px;line-height:1.5">
        <b>Supplement Facts</b><br>Caffeine Anhydrous<br>Yohimbine HCl<br>Taurine
      </div></body>`);
    const buffer = await photo.locator("#label").screenshot();
    await photo.close();

    await dialog.locator('input[type="file"]').setInputFiles({ name: "label.png", mimeType: "image/png", buffer });
    await expect(dialog.getByText(/Read on your device/)).toBeVisible({ timeout: 150_000 });
    await expect(dialog.getByLabel("Ingredients")).toHaveValue(/Yohimbine/i);
    await dialog.getByRole("button", { name: "Check this label" }).click();
    await expect(dialog.getByRole("region", { name: "Known hazards in these ingredients" })).toContainText("Yohimbe or yohimbine");
  });
});
