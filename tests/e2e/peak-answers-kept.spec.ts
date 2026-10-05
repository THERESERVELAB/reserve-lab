import { test, expect, type Page } from "@playwright/test";

import { SAFETY_ACK_VERSION } from "@/lib/safety/acknowledgement";

/**
 * PEAK MODE — an answer is kept the moment it is given.
 *
 * The food questions used to hold every pick in component state until the
 * member found the button. Close the sheet halfway through and the answers
 * were gone. Now each pick is written as it is made, and the button only
 * says "these are my answers" — so leaving mid-question costs nothing, and
 * editing later saves without a round trip.
 */

function boot(page: Page) {
  const stamp = new Date().toISOString();
  return page.addInitScript(
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
                { id: "e2e-test-e", name: "Testosterone Enanthate", officialName: "Testosterone Enanthate", compoundClass: "aas", category: "hormone", doseAmount: "", doseUnit: "mg", frequency: "", timingPreference: "", goalAssociation: [], isActive: true, createdAt: stamp, updatedAt: stamp },
              ],
            },
          },
          version: 0,
        }),
      );
    },
    { stamp, ack: SAFETY_ACK_VERSION },
  );
}

const kitchen = (page: Page) =>
  page.evaluate(() => {
    const raw = window.localStorage.getItem("final-boss-athlete-settings");
    const state = raw ? JSON.parse(raw).state : {};
    return state?.nutritionPrefs?.peakKitchen ?? null;
  });

test.describe("peak mode answers", () => {
  test.setTimeout(240_000);
  test.use({ viewport: { width: 390, height: 844 } });

  test("a pick is kept when the member leaves mid-question, and the day still waits for them", async ({ page }) => {
    await boot(page);
    await page.goto("/", { waitUntil: "domcontentloaded", timeout: 120_000 });

    await page.getByRole("button", { name: "Enter Peak Mode" }).click({ timeout: 120_000 });
    const sheet = page.getByRole("dialog", { name: "Peak Mode" });
    await expect(sheet).toBeVisible();
    await sheet.getByRole("button", { name: /Lean · dry · hard/ }).click();

    const questions = sheet.getByRole("region", { name: "Build your plates" });
    await expect(questions).toBeVisible();
    await questions.getByRole("group", { name: "Carbs you like" }).getByRole("button", { name: "Sweet potatoes" }).click();

    /* Written the moment it was picked — not on a button, not on close. */
    await expect.poll(async () => (await kitchen(page))?.carbs ?? []).toContain("sweet-potato");
    /* And not yet counted as answered: the questions still own the screen. */
    expect((await kitchen(page))?.answeredAt, "an unfinished answer carries no stamp").toBe("");

    /* Leave the sheet in the middle of answering. */
    await page.keyboard.press("Escape");
    await expect(sheet).toHaveCount(0);

    /* The launcher reads "Open Peak Mode" once a look is chosen. */
    await page.getByRole("button", { name: /(Enter|Open) Peak Mode/ }).click();
    const again = page.getByRole("dialog", { name: "Peak Mode" });
    const backToQuestions = again.getByRole("region", { name: "Build your plates" });
    await expect(backToQuestions).toBeVisible();
    await expect(backToQuestions.getByRole("button", { name: "Sweet potatoes" })).toHaveAttribute("aria-pressed", "true");

    /* Finishing stamps the answer, and the day arrives. */
    await backToQuestions.getByRole("button", { name: "Build my plates" }).click();
    await expect(again.getByRole("region", { name: "Peak Mode meals" })).toBeVisible();
    expect((await kitchen(page))?.answeredAt, "a finished answer is stamped").not.toBe("");
  });

  test("editing answers later saves each pick as it is made", async ({ page }) => {
    await boot(page);
    await page.goto("/", { waitUntil: "domcontentloaded", timeout: 120_000 });
    await page.getByRole("button", { name: "Enter Peak Mode" }).click({ timeout: 120_000 });
    const sheet = page.getByRole("dialog", { name: "Peak Mode" });
    await sheet.getByRole("button", { name: /Lean · dry · hard/ }).click();
    const questions = sheet.getByRole("region", { name: "Build your plates" });
    await questions.getByRole("group", { name: "Proteins you like" }).getByRole("button", { name: "Chicken breast" }).click();
    await questions.getByRole("button", { name: "Build my plates" }).click();
    await expect(sheet.getByRole("region", { name: "Peak Mode meals" })).toBeVisible();
    const stamped = (await kitchen(page))?.answeredAt;

    await sheet.getByRole("button", { name: "Edit food answers" }).click();
    const editing = sheet.getByRole("region", { name: "Build your plates" });
    await expect(editing).toBeVisible();
    await expect(editing.getByText("Saved as you pick.")).toBeVisible();
    await editing.getByRole("group", { name: "Carbs you like" }).getByRole("button", { name: "White or jasmine rice" }).click();

    /* Saved without pressing anything, and still counted as answered. */
    await expect.poll(async () => (await kitchen(page))?.carbs ?? []).toContain("rice");
    expect((await kitchen(page))?.answeredAt, "editing does not un-answer the questions").toBe(stamped);
  });
});
