import { test, expect, type Page } from "@playwright/test";

import { SAFETY_ACK_VERSION } from "../../src/lib/safety/acknowledgement";

/**
 * OWNER MODE — end to end against a local server with the launch switch OFF.
 *
 *   RESERVE_E2E_OWNER_MODE=owner  → server started with RESERVE_DEV_OWNER=true
 *   RESERVE_E2E_OWNER_MODE=member → the same server without it
 *
 * Skipped otherwise, so the normal suite is unaffected. Local mode has no real
 * sign-in; the dev owner flag stands in for a verified allowlisted account.
 */

const MODE = process.env.RESERVE_E2E_OWNER_MODE;

async function boot(page: Page, view: string, extra: Record<string, unknown> = {}) {
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
              id: "o-test",
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
            id: "o-lab",
            testDate: "2026-09-01",
            createdAt: stamp,
            markers: [{ name: "Hematocrit", value: "52.1", unit: "%", referenceRange: "38.5-50.0", labFlag: "H", markerKey: "hematocrit" }],
          },
        ],
        ...extra,
      },
    },
  );
  await page.goto("/", { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.locator("main").waitFor({ state: "visible", timeout: 120_000 });
}

test.describe("owner mode — owner account", () => {
  test.skip(MODE !== "owner", "Needs the dev-owner server with the launch switch off.");
  test.use({ viewport: { width: 1280, height: 900 } });
  test.setTimeout(240_000);

  test("5, 6, 7. the owner uses Cycle & Safety with the switch off, and every safeguard still applies", async ({ page }) => {
    const capabilities = await (await page.request.get("/api/account/capabilities")).json();
    expect(capabilities).toMatchObject({ role: "owner", source: "dev-owner" });

    await boot(page, "supplements");
    await expect(page.getByText("Reserve Stack · Owner research mode")).toBeVisible({ timeout: 60_000 });
    await page.getByRole("tab", { name: "Cycle & Safety", exact: true }).click();

    // The safety acknowledgement, including 18+, still stands in front of the owner.
    await expect(page.getByRole("heading", { name: "How Reserve helps keep you safe" })).toBeVisible();
    await page.getByLabel(/I understand Reserve is not medical care/).check();
    await page.getByLabel("I am 18 or older.").check();
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByText(/pending clinician and counsel review and are hidden for members/)).toBeVisible();

    // Emergency symptom handling still routes to 911.
    await page.getByLabel("Chest pain, pressure or tightness").check();
    await page.getByRole("button", { name: "See what to do" }).click();
    await expect(page.getByRole("link", { name: "Call 911" }).first()).toHaveAttribute("href", "tel:911");
    await page.screenshot({ path: "test-results/owner-mode/owner-cycle-safety.png" });
  });

  test("6. lab flags still show for the owner in Bloodwork", async ({ page }) => {
    const stamp = new Date().toISOString();
    await boot(page, "bloodwork", { safetyAcknowledgement: { acknowledgedAt: stamp, version: SAFETY_ACK_VERSION, adultConfirmedAt: stamp } });
    await expect(page.getByText(/results? to have reviewed/).first()).toBeVisible({ timeout: 60_000 });
    await page.getByText(/results? to have reviewed/).first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: "test-results/owner-mode/owner-bloodwork-flags.png" });
  });
});

test.describe("owner mode — member account", () => {
  test.skip(MODE !== "member", "Needs the member server with the launch switch off.");
  test.use({ viewport: { width: 1280, height: 900 } });
  test.setTimeout(240_000);

  test("2, 3, 8. a member sees no owner UI and no review-pending tools, even with forged owner claims", async ({ page }) => {
    const response = await page.request.get("/api/account/capabilities?role=owner", { headers: { "x-reserve-role": "owner" } });
    expect(await response.json()).toEqual({ role: "member", capabilities: [], source: "default" });

    await boot(page, "supplements", { role: "owner", isOwner: true, ownerModeEnabled: true, capabilities: ["review-pending-safety-tools"] });
    await expect(page.getByRole("tab", { name: "Plan", exact: true })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText(/Owner research mode/)).toHaveCount(0);
    await expect(page.getByRole("tab", { name: "Cycle & Safety", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Cycle & Safety", exact: true })).toHaveCount(0);
    await page.screenshot({ path: "test-results/owner-mode/member-compound-command.png" });
  });
});
