import { test, expect, type Page } from "@playwright/test";

import { SAFETY_ACK_VERSION } from "@/lib/safety/acknowledgement";

/**
 * CYCLE BRIEF — a member running Masteron and testosterone opens Compound
 * Command and sees, first, everything to know while on the cycle: what gets
 * watched (a flagged hematocrit first), what the compounds affect, warning
 * signs, harm-reduction facts and who can review it. Never what to take.
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

test.describe("cycle brief", () => {
  test.setTimeout(240_000);

  for (const vp of [{ name: "phone", width: 390, height: 844 }, { name: "desktop", width: 1280, height: 900 }]) {
    test(`leads Compound Command with everything to know — ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await boot(page, true);

      const brief = page.getByRole("region", { name: "Cycle Brief" });
      await expect(brief).toBeVisible({ timeout: 120_000 });
      await expect(brief).toContainText("Masteron");
      await expect(brief).toContainText("What gets watched · 1 outside range");
      await expect(brief).toContainText("53.1 % · outside your report's range");
      await expect(brief).toContainText("PSA");
      await expect(brief).toContainText("Not tested");
      await expect(brief).toContainText("What these compounds affect");
      await expect(brief).toContainText("Call 911:");
      await expect(brief).toContainText("Call or text 988:");
      await expect(brief).toContainText("Never what to take, how much or when");
      await brief.getByText("Harm-reduction facts").click();
      await expect(brief).toContainText("Sharing needles, syringes or multi-use vials spreads HIV");
      await page.screenshot({ path: `test-results/cycle-brief/${vp.name}.png` });

      await brief.getByRole("button", { name: "Evidence for your cycle" }).click();
      await expect(page.getByRole("region", { name: "Evidence for your cycle" })).toBeVisible({ timeout: 60_000 });
    });
  }

  test("waits for the safety acknowledgement before showing risk content", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await boot(page, false);
    await expect(page.getByText("Your Cycle Brief opens after the safety acknowledgement in Cycle & Safety.")).toBeVisible({ timeout: 120_000 });
    await expect(page.getByRole("region", { name: "Cycle Brief" })).toHaveCount(0);
  });
});
