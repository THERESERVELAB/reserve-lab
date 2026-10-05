import { test, expect, type Page } from "@playwright/test";

/**
 * PAYWALL INTEGRITY — the regression that must never return.
 *
 * Every in-app upgrade CTA once called `setSubscriptionTier(tier)`, a plain
 * local store write. One click granted the $79 plan for free, persisted it,
 * and — because `subscriptionTier` is in MEMBER_STATE_KEYS — synced it to
 * public.member_state so it followed the member across devices. Nothing in the
 * product reached /api/stripe/checkout at all.
 *
 * These assertions are cheap and they are the only thing standing between a
 * future copy-paste of a neighbouring button and giving the product away.
 */

async function boot(page: Page, view: string) {
  await page.addInitScript((v) => {
    window.localStorage.setItem("fba-preview-view", v);
    const KEY = "final-boss-athlete-settings";
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : { state: {}, version: 0 };
    parsed.state = {
      ...parsed.state,
      subscriptionTier: "core",
      onboarding: { status: "complete", currentStep: 99, startedAt: new Date().toISOString() },
    };
    window.localStorage.setItem(KEY, JSON.stringify(parsed));
  }, view);
  await page.goto("/", { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.locator("main").waitFor({ timeout: 120_000 });
  await page.waitForTimeout(2500);
}

const tierOf = (page: Page) =>
  page.evaluate(() => {
    const raw = window.localStorage.getItem("final-boss-athlete-settings");
    return raw ? JSON.parse(raw)?.state?.subscriptionTier : null;
  });

test("clicking upgrade does NOT grant the tier", async ({ page }) => {
  // A gated Reserve Black surface renders the locked module.
  await boot(page, "ai-strategist");

  expect(await tierOf(page), "precondition: member is on core").toBe("core");

  const upgrade = page.getByRole("button", { name: /upgrade to/i }).first();
  await upgrade.waitFor({ timeout: 20_000 });

  const label = await upgrade.innerText();
  await upgrade.click();
  await page.waitForTimeout(2500);

  const after = await tierOf(page);
  console.log(`PAYWALL >> button="${label.replace(/\s+/g, " ").trim()}" tierAfterClick=${after}`);

  expect(after, "clicking upgrade must not change the member's tier").toBe("core");
  // Still on the app — no silent navigation, and no free unlock.
  expect(page.url()).toMatch(/127.0.0.1|localhost/);
});

test("upgrade CTA states its price and fails honestly", async ({ page }) => {
  await boot(page, "ai-strategist");
  const upgrade = page.getByRole("button", { name: /upgrade to/i }).first();
  await upgrade.waitFor({ timeout: 20_000 });

  // Names the price rather than promising a free "preview".
  await expect(upgrade).toContainText(/\$\d/);

  await upgrade.click();
  // Stripe is unconfigured locally, so the member must be told — not left
  // staring at a button that did nothing.
  const alert = page.getByRole("alert").first();
  await alert.waitFor({ timeout: 15_000 });
  console.log(`HONEST >> "${(await alert.innerText()).trim()}"`);
});
