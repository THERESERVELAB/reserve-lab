import { test, expect, type Page } from "@playwright/test";

import { SAFETY_ACK_VERSION } from "@/lib/safety/acknowledgement";

/**
 * FIELD MANUAL — under the Cycle Brief, a member running Masteron and testosterone
 * sees how to eat, the daily habits with evidence and the kit to watch their
 * own numbers, each cited, lit up where their compounds touch the same area.
 */

function dayKey(offset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function boot(page: Page, acknowledged: boolean) {
  const stamp = new Date().toISOString();
  await page.addInitScript(
    ({ stamp, ack, acknowledged, labDate }) => {
      window.localStorage.setItem("fba-preview-view", "supplements");
      const compound = (id: string, name: string, officialName: string) => ({
        id, name, officialName, compoundClass: "aas", category: "hormone", doseAmount: "", doseUnit: "mg", frequency: "", timingPreference: "", goalAssociation: [], isActive: true, createdAt: stamp, updatedAt: stamp,
      });
      window.localStorage.setItem(
        "final-boss-athlete-settings",
        JSON.stringify({
          state: {
            subscriptionTier: "elite",
            onboarding: { status: "complete", currentStep: 99, startedAt: stamp },
            setupProfile: { age: 34 },
            ...(acknowledged ? { safetyAcknowledgement: { acknowledgedAt: stamp, version: ack, adultConfirmedAt: stamp } } : {}),
            trainingSession: { enhancementLog: [compound("e2e-mast", "Masteron", "Drostanolone"), compound("e2e-test-e", "Testosterone Enanthate", "Testosterone Enanthate")] },
            bloodworkLogs: [
              { id: "brief-lab", testDate: labDate, labName: "Quest", createdAt: stamp, markers: [{ name: "Hematocrit", value: "53.1", unit: "%", referenceRange: "38.5-50.0", labFlag: "H", markerKey: "hematocrit" }] },
            ],
          },
          version: 0,
        }),
      );
    },
    { stamp, ack: SAFETY_ACK_VERSION, acknowledged, labDate: dayKey(-10) },
  );
  await page.goto("/", { waitUntil: "domcontentloaded", timeout: 120_000 });
}

test.describe("field manual", () => {
  test.setTimeout(240_000);

  for (const vp of [{ name: "phone", width: 390, height: 844 }, { name: "desktop", width: 1280, height: 900 }]) {
    test(`eat, habits and kit, lit up by the member's compounds — ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await boot(page, true);

      const manual = page.getByRole("region", { name: "Field Manual" });
      await expect(manual).toBeVisible({ timeout: 120_000 });
      /* On Today the manual is one line until it is asked for. */
      await expect(manual).toContainText(/[0-9]+ cited items on eating, daily habits and the kit/);
      await manual.getByRole("button", { name: "Open the manual" }).click();
      await expect(manual).toContainText("Added sugar");
      await expect(manual).toContainText("Brown sugar, raw sugar, honey");
      await expect(manual).toContainText("Monk fruit and stevia");
      await expect(manual).toContainText("Almond and oat milk");
      await expect(manual.locator('[data-manual-item="saturated-fat"]')).toContainText("Cholesterol");
      await expect(manual.locator('[data-manual-item="saturated-fat"]')).toContainText("Masteron");

      await manual.getByRole("tab", { name: "Daily habits" }).click();
      await expect(manual).toContainText("Cardio, every week");
      await expect(manual).toContainText("Sauna");
      await manual.getByRole("tab", { name: "Kit" }).click();
      await expect(manual).toContainText("An upper-arm blood pressure cuff");
      await expect(manual).toContainText("validatebp.org");
      await manual.scrollIntoViewIfNeeded();
      const box = await manual.boundingBox();
      expect(box!.x + box!.width).toBeLessThanOrEqual(vp.width);
      await page.screenshot({ path: `test-results/field-manual/${vp.name}.png`, fullPage: false });

      /* The button names the library, so the library is what opens. */
      await manual.getByRole("button", { name: "Supplement library, A–Z" }).click();
      await expect(page.getByRole("dialog", { name: "Supplement library" })).toBeVisible({ timeout: 60_000 });
    });
  }

  test("folds back to one line when the member closes it", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await boot(page, true);
    const manual = page.getByRole("region", { name: "Field Manual" });
    await expect(manual).toBeVisible({ timeout: 120_000 });
    await manual.getByRole("button", { name: "Open the manual" }).click();
    await expect(manual).toContainText("Added sugar");
    await manual.getByRole("button", { name: "Close the manual" }).click();
    await expect(page.locator("[data-field-manual=\"compact\"]")).toBeVisible();
    await expect(manual).not.toContainText("Added sugar");
  });

  test("waits for the safety acknowledgement", async ({ page }) => {
    await boot(page, false);
    await expect(page.getByText("Your Cycle Brief opens after the safety acknowledgement")).toBeVisible({ timeout: 120_000 });
    await expect(page.getByRole("region", { name: "Field Manual" })).toHaveCount(0);
  });
});
