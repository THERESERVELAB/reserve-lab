import { test, expect, type Page } from "@playwright/test";

/**
 * OWNER MODE STAGE 2 — for everyone: the Support Plan in Support Stack (behind
 * the safety acknowledgement), custom supplements, and the Timeline with notes
 * and observations. Runs against a local server with the launch switch OFF.
 *
 *   RESERVE_E2E_OWNER_MODE=member (or owner) → skipped otherwise.
 */

const MODE = process.env.RESERVE_E2E_OWNER_MODE;

async function boot(page: Page, view: string) {
  const stamp = new Date().toISOString();
  await page.addInitScript(
    ({ v, state }) => {
      window.localStorage.setItem("fba-preview-view", v);
      const KEY = "final-boss-athlete-settings";
      if (!window.localStorage.getItem(KEY)) window.localStorage.setItem(KEY, JSON.stringify({ state, version: 0 }));
    },
    {
      v: view,
      state: {
        subscriptionTier: "elite",
        onboarding: { status: "complete", currentStep: 99, startedAt: stamp },
        trainingSession: {
          enhancementLog: [
            {
              id: "s2-test",
              name: "Testosterone Cypionate",
              officialName: "Testosterone Cypionate",
              compoundClass: "hormones_testosterone",
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
        bloodworkLogs: [
          {
            id: "s2-lab",
            testDate: "2026-09-01",
            createdAt: stamp,
            markers: [{ name: "Hematocrit", value: "52.1", unit: "%", referenceRange: "38.5-50.0", labFlag: "H", markerKey: "hematocrit" }],
          },
        ],
      },
    },
  );
  await page.goto("/", { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.locator("main").waitFor({ state: "visible", timeout: 120_000 });
}

test.describe("owner mode stage 2 — for every member", () => {
  test.skip(MODE !== "member" && MODE !== "owner", "Needs a local server with the launch switch off.");
  test.use({ viewport: { width: 1280, height: 900 } });
  test.setTimeout(300_000);

  test("support plan behind the acknowledgement, a custom supplement, and the timeline", async ({ page }) => {
    await boot(page, "supplements");
    await page.getByRole("tab", { name: "More", exact: true }).click({ timeout: 120_000 });
    await page.getByRole("button", { name: /^Support Stack/ }).click({ timeout: 60_000 });

    // The acknowledgement, including 18+, stands in front of the Support Plan.
    await expect(page.getByRole("heading", { name: "How Reserve helps keep you safe" })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole("region", { name: "Support plan" })).toHaveCount(0);
    await page.getByLabel(/I understand Reserve is not medical care/).check();
    await page.getByLabel("I am 18 or older.").check();
    await page.getByRole("button", { name: "Continue" }).click();

    const plan = page.getByRole("region", { name: "Support plan" });
    await expect(plan).toBeVisible({ timeout: 60_000 });
    await plan.getByRole("button", { name: "Browse supplements" }).first().click();

    const library = page.getByRole("dialog", { name: "Supplement library" });
    await expect(library).toBeVisible();
    await expect(library.getByRole("button", { name: "Add supplement" })).toBeDisabled();
    await library.getByLabel("Not in the library? Add your own").fill("Nordic Fish Oil Blend");
    await library.getByRole("button", { name: "Add supplement" }).click();
    await page.keyboard.press("Escape");

    /* The room shows a row per supplement; removing it lives in its details sheet. */
    const custom = plan.getByRole("button", { name: "Details for Nordic Fish Oil Blend" });
    await expect(custom).toBeVisible();
    await expect(plan.getByText("No evidence grade: Reserve has no reviewed evidence for it.").first()).toBeVisible();
    await custom.scrollIntoViewIfNeeded();
    await page.screenshot({ path: "test-results/owner-mode-stage-2/support-plan-custom.png" });

    // The Timeline recorded the change as it happened.
    await page.getByRole("tab", { name: "More", exact: true }).click({ timeout: 120_000 });
    await page.getByRole("button", { name: /^Timeline/ }).click({ timeout: 60_000 });
    const entries = page.getByRole("list", { name: "Timeline entries" });
    await expect(entries.getByText("Added Nordic Fish Oil Blend")).toBeVisible();

    // A dated note in the member's own words.
    await page.getByRole("button", { name: "Add note" }).click();
    await expect(page.getByRole("button", { name: "Save note" })).toBeDisabled();
    await page.getByLabel("Note", { exact: true }).fill("Moved training to mornings this week.");
    await page.getByRole("button", { name: "Save note" }).click();
    await expect(entries.getByText("Moved training to mornings this week.")).toBeVisible();

    // An observation: two things the member chose, side by side in time.
    await page.getByRole("button", { name: "Add observation" }).click();
    const sheet = page.getByRole("dialog", { name: "Add an observation" });
    await expect(sheet.getByText(/Reserve adds no analysis/)).toBeVisible();
    await sheet.getByLabel("What changed").selectOption({ label: "Testosterone Cypionate" });
    await sheet.getByLabel("What you noticed").selectOption({ label: "Sleep" });
    await sheet.getByRole("button", { name: "Save observation" }).click();
    await expect(sheet).toHaveCount(0);

    await expect(entries.getByText("Your observation · timing only")).toBeVisible();
    await expect(entries.getByText("Changed: Testosterone Cypionate")).toBeVisible();
    await expect(entries.getByText("Noticed: Sleep")).toBeVisible();
    await page.screenshot({ path: "test-results/owner-mode-stage-2/timeline.png" });

    // Everything stays in the member's synced record after a reload.
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByRole("tab", { name: "More", exact: true }).click({ timeout: 120_000 });
    await page.getByRole("button", { name: /^Timeline/ }).click({ timeout: 60_000 });
    await expect(page.getByRole("list", { name: "Timeline entries" }).getByText("Changed: Testosterone Cypionate")).toBeVisible({ timeout: 60_000 });
  });
});
