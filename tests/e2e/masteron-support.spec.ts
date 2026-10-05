import { test, expect } from "@playwright/test";

import { SAFETY_ACK_VERSION } from "@/lib/safety/acknowledgement";

/**
 * A member logs Masteron and opens Support Stack. Before compound-specific
 * profiles existed, every steroid produced the same areas, so adding one
 * changed nothing on screen. This is the check that it no longer does.
 */
test.describe("support stack for a specific compound", () => {
  test.use({ viewport: { width: 1280, height: 900 } });
  test.setTimeout(180_000);

  test("Masteron opens the areas it affects, with options and the honest note", async ({ page }) => {
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
              trainingSession: {
                enhancementLog: [
                  {
                    id: "e2e-masteron",
                    name: "Masteron",
                    officialName: "Drostanolone",
                    compoundClass: "aas",
                    category: "hormone",
                    doseAmount: "",
                    doseUnit: "mg",
                    frequency: "",
                    timingPreference: "",
                    goalAssociation: [],
                    isActive: true,
                    createdAt: stamp,
                    updatedAt: stamp,
                  },
                ],
              },
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

    /* The room keeps its statement, rows and three actions; the systems this
       compound loads and the evidence behind them read together in one sheet. */
    await page.getByRole("button", { name: "Coverage by system" }).click({ timeout: 60_000 });
    const sheet = page.getByRole("dialog", { name: "Coverage by system" });
    await expect(sheet).toBeVisible({ timeout: 60_000 });

    /* The systems this compound loads, against the member's own labs. */
    const systems = sheet.getByRole("region", { name: "Monitoring and support, by system" });
    await expect(systems.getByText("Prostate", { exact: true })).toBeVisible({ timeout: 60_000 });
    await expect(systems.getByText("Skin & hair", { exact: true })).toBeVisible();
    await expect(systems.getByText(/No PSA result logged yet/)).toBeVisible();
    await expect(systems.getByText(/Nothing here has been shown to address skin or hair changes driven by androgens/)).toBeVisible();
    await systems.getByText("Prostate", { exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: "test-results/masteron/systems.png" });

    /* And under them: what the evidence shows for every area Masteron affects. */
    const evidence = sheet.getByRole("region", { name: "Evidence for your cycle" });
    await expect(evidence).toBeVisible({ timeout: 60_000 });
    await expect(evidence).toContainText("Psyllium husk");
    await expect(evidence).toContainText("Established");
    await expect(evidence).toContainText("Milk thistle");
    await expect(evidence).toContainText("Not shown in trials");
    await expect(evidence).toContainText("Dangerous with some blood pressure medicines");
    await expect(evidence).toContainText("Nothing has been shown to help");
    await expect(evidence).toContainText("Turmeric, green tea extract, ashwagandha and kava");
    await evidence.scrollIntoViewIfNeeded();
    await page.screenshot({ path: "test-results/masteron/evidence-map.png", fullPage: false });

    /* Back to the room, and into the library from there. */
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden({ timeout: 30_000 });
    await page.getByRole("button", { name: "Browse supplements" }).click({ timeout: 60_000 });

    // Areas the purpose groups never rendered before, now with options in them.
    await expect(page.getByText("Prostate", { exact: true }).first()).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText("Saw palmetto").first()).toBeVisible();
    await expect(page.getByText("Beetroot (dietary nitrate)").first()).toBeVisible();
    await expect(page.getByText("Taurine").first()).toBeVisible();
    await expect(page.getByText("Collagen peptides").first()).toBeVisible();
    await page.screenshot({ path: "test-results/masteron/support-stack.png", fullPage: true });
  });
});
