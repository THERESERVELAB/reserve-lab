import { test, expect, type Page } from "@playwright/test";

/**
 * OWNER MODE STAGE 3 — the Research tab for every member: Lab Response,
 * Burden Map and N=1 Review, behind the safety acknowledgement. Runs against
 * a local server with the launch switch OFF.
 *
 *   RESERVE_E2E_OWNER_MODE=member (or owner) → skipped otherwise.
 */

const MODE = process.env.RESERVE_E2E_OWNER_MODE;

async function boot(page: Page) {
  const stamp = new Date().toISOString();
  await page.addInitScript(
    ({ state }) => {
      window.localStorage.setItem("fba-preview-view", "supplements");
      const KEY = "final-boss-athlete-settings";
      if (!window.localStorage.getItem(KEY)) window.localStorage.setItem(KEY, JSON.stringify({ state, version: 0 }));
    },
    {
      state: {
        subscriptionTier: "elite",
        onboarding: { status: "complete", currentStep: 99, startedAt: stamp },
        trainingSession: {
          enhancementLog: [
            {
              id: "s3-test",
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
            id: "s3-lab-1",
            testDate: "2026-06-01",
            labName: "Quest",
            createdAt: stamp,
            markers: [{ name: "Hematocrit", value: "48.0", unit: "%", referenceRange: "38.5-50.0", markerKey: "hematocrit" }],
          },
          {
            id: "s3-lab-2",
            testDate: "2026-09-01",
            labName: "Quest",
            createdAt: stamp,
            markers: [{ name: "Hematocrit", value: "52.1", unit: "%", referenceRange: "38.5-50.0", labFlag: "H", markerKey: "hematocrit" }],
          },
        ],
        changeHistory: [
          {
            id: "s3-change",
            at: "2026-07-15T15:00:00.000Z",
            date: "2026-07-15",
            subject: { kind: "compound", id: "s3-test", name: "Testosterone Cypionate" },
            action: "added",
            changes: [],
          },
        ],
        observations: [
          {
            id: "s3-observation",
            date: "2026-08-20",
            changed: { kind: "compound", ref: "s3-test", label: "Testosterone Cypionate" },
            noticed: { kind: "marker", ref: "hematocrit", label: "Hematocrit" },
            createdAt: stamp,
          },
        ],
      },
    },
  );
  await page.goto("/", { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.locator("main").waitFor({ state: "visible", timeout: 120_000 });
}

function segment(page: Page, name: string) {
  return page.getByRole("radio", { name }).or(page.getByRole("tab", { name })).or(page.getByRole("button", { name, exact: true })).first();
}

test.describe("owner mode stage 3 — research for every member", () => {
  test.skip(MODE !== "member" && MODE !== "owner", "Needs a local server with the launch switch off.");
  test.use({ viewport: { width: 1280, height: 900 } });
  test.setTimeout(300_000);

  test("lab response, burden map and n=1 review behind the acknowledgement", async ({ page }) => {
    await boot(page);
    await page.getByRole("tab", { name: "More", exact: true }).click({ timeout: 120_000 });
    await page.getByRole("button", { name: /^Research/ }).click({ timeout: 60_000 });

    // The acknowledgement, including 18+, stands in front of the Research tab.
    await expect(page.getByRole("heading", { name: "How Reserve helps keep you safe" })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole("region", { name: "Lab Response" })).toHaveCount(0);
    await page.getByLabel(/I understand Reserve is not medical care/).check();
    await page.getByLabel("I am 18 or older.").check();
    await page.getByRole("button", { name: "Continue" }).click();

    // Lab Response: every result, plan changes on the same dates, and the finding routed to a clinician.
    const lab = page.getByRole("region", { name: "Lab Response" });
    await expect(lab).toBeVisible({ timeout: 60_000 });
    await expect(lab.getByLabel("Marker")).toHaveValue("hematocrit");
    await expect(lab.getByRole("img", { name: "Hematocrit results over time" })).toBeVisible();
    await expect(lab.getByRole("cell", { name: /52\.1/ })).toBeVisible();
    await expect(lab.getByRole("list", { name: "Plan changes and check-ins" }).getByText("Added Testosterone Cypionate")).toBeVisible();
    await expect(lab.getByRole("list", { name: "Results to review" })).toBeVisible();
    await lab.getByRole("img", { name: "Hematocrit results over time" }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: "test-results/owner-mode-stage-3/lab-response.png" });

    // Burden Map: running compounds with their cited evidence grade, pending review.
    await segment(page, "Burden Map").click();
    const map = page.getByRole("region", { name: "Burden Map" });
    await expect(map.getByText("Pending clinician review")).toBeVisible();
    const blood = map.getByRole("region", { name: "Blood" });
    await expect(blood.getByText("Testosterone Cypionate")).toBeVisible();
    await expect(map.getByText(/\((Established|Supported|Limited evidence|Not shown in trials|Uncertain)\)/).first()).toBeVisible();
    await expect(blood.getByRole("list", { name: "Markers watched for Blood" })).toContainText("52.1");
    await map.getByRole("list", { name: "Body systems" }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: "test-results/owner-mode-stage-3/burden-map.png" });

    // N=1 Review: mark an observation, filter to marked, open its marker in Lab Response.
    await segment(page, "N=1 Review").click();
    const review = page.getByRole("region", { name: "N=1 Review" });
    const mark = review.getByRole("button", { name: /^Mark for review: Hematocrit/ });
    await expect(mark).toHaveAttribute("aria-pressed", "false");
    await mark.click();
    await expect(mark).toHaveAttribute("aria-pressed", "true");
    await review.getByRole("button", { name: "Only marked for review" }).click();
    await expect(review.getByText("Changed: Testosterone Cypionate")).toBeVisible();
    await page.screenshot({ path: "test-results/owner-mode-stage-3/n1-review.png" });

    await review.getByRole("button", { name: "Open in Lab Response" }).click();
    await expect(page.getByRole("region", { name: "Lab Response" }).getByLabel("Marker")).toHaveValue("hematocrit");

    // The mark stays in the member's record after a reload.
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByRole("tab", { name: "More", exact: true }).click({ timeout: 120_000 });
    await page.getByRole("button", { name: /^Research/ }).click({ timeout: 60_000 });
    await segment(page, "N=1 Review").click({ timeout: 60_000 });
    await expect(page.getByRole("button", { name: /^Mark for review: Hematocrit/ })).toHaveAttribute("aria-pressed", "true");
  });
});
