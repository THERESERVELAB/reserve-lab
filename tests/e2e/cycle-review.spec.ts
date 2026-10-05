import { test, expect, type Page } from "@playwright/test";

import { SAFETY_ACK_VERSION } from "../../src/lib/safety/acknowledgement";

/**
 * CYCLE REVIEW — end to end in the real app.
 *
 * A member on a three-compound cycle with labs drawn before and during it:
 *   1. sets the cycle's goal, a priority and a compound's purpose
 *   2. sees lab trends against the cycle, shared loads, and questions built
 *      from their own numbers — with missing amounts left visibly missing
 *   3. logs a check-in with a warning sign, is routed to 911, and the review
 *      steps aside until they choose to see it
 *   4. saves the clinician summary to the cycle's review history
 *
 * All records are synthetic. Dates are relative to the run so the cycle is
 * always ten weeks in.
 */

function localDateKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return localDateKey(date);
}

async function bootTo(page: Page, view: string, extraState: Record<string, unknown>) {
  await page.addInitScript(
    ({ v, extra }) => {
      window.localStorage.setItem("fba-preview-view", v);
      const KEY = "final-boss-athlete-settings";
      if (!window.localStorage.getItem(KEY)) {
        window.localStorage.setItem(
          KEY,
          JSON.stringify({
            state: {
              ...extra,
              subscriptionTier: "elite",
              onboarding: { status: "complete", currentStep: 99, startedAt: new Date().toISOString() },
            },
            version: 0,
          }),
        );
      }
    },
    { v: view, extra: extraState },
  );
  await page.goto("/", { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.locator("main").waitFor({ state: "visible", timeout: 120_000 });
}

function memberState() {
  const stamp = new Date().toISOString();
  const entry = { doseUnit: "mg", timingPreference: "", goalAssociation: [], isActive: true, createdAt: stamp, updatedAt: stamp };
  return {
    trainingSession: {
      enhancementLog: [
        { ...entry, id: "e2e-test", name: "Testosterone Cypionate", officialName: "Testosterone Cypionate", compoundClass: "hormones_testosterone", category: "hormone", doseAmount: "", frequency: "", startDate: daysAgo(70) },
        { ...entry, id: "e2e-oxa", name: "Oxandrolone", officialName: "Oxandrolone", compoundClass: "aas", category: "hormone", doseAmount: "20", frequency: "daily", startDate: daysAgo(70) },
        { ...entry, id: "e2e-nand", name: "Nandrolone Decanoate", officialName: "Nandrolone Decanoate", compoundClass: "aas", category: "hormone", doseAmount: "", frequency: "", startDate: daysAgo(35) },
      ],
    },
    cyclePeriods: [
      { id: "e2e-cycle", name: "Fall cycle", startDate: daysAgo(70), plannedWeeks: 16, compoundIds: ["e2e-test", "e2e-oxa", "e2e-nand"], clinicianOversight: false, checkpoints: [], createdAt: stamp, updatedAt: stamp },
    ],
    bloodworkLogs: [
      {
        id: "e2e-lab-1",
        testDate: daysAgo(80),
        createdAt: stamp,
        markers: [
          { name: "ApoB", value: "92", unit: "mg/dL", referenceRange: "40-130", markerKey: "apob" },
          { name: "HDL Cholesterol", value: "48", unit: "mg/dL", referenceRange: "> OR = 40", markerKey: "hdl" },
          { name: "Hematocrit", value: "45", unit: "%", referenceRange: "38.5-50.0", markerKey: "hematocrit" },
        ],
      },
      {
        id: "e2e-lab-2",
        testDate: daysAgo(40),
        createdAt: stamp,
        markers: [
          { name: "ApoB", value: "108", unit: "mg/dL", referenceRange: "40-130", markerKey: "apob" },
          { name: "HDL Cholesterol", value: "39", unit: "mg/dL", referenceRange: "> OR = 40", labFlag: "L", markerKey: "hdl" },
          { name: "Hematocrit", value: "49.5", unit: "%", referenceRange: "38.5-50.0", markerKey: "hematocrit" },
        ],
      },
      { id: "e2e-lab-3", testDate: daysAgo(9), createdAt: stamp, markers: [{ name: "ApoB", value: "124", unit: "mg/dL", referenceRange: "40-130", markerKey: "apob" }] },
    ],
  };
}

test.describe("cycle review on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test.setTimeout(240_000);

  test("recomposes without horizontal overflow", async ({ page }) => {
    const stamp = new Date().toISOString();
    await bootTo(page, "supplements", {
      ...memberState(),
      safetyAcknowledgement: { acknowledgedAt: stamp, version: SAFETY_ACK_VERSION, adultConfirmedAt: stamp },
      cycleGoals: { "e2e-cycle": { primaryGoal: "lean-mass", priorities: ["minimize-cardiovascular-risk"], compoundPurposes: { "e2e-test": { kind: "lean-mass" } }, updatedAt: stamp } },
    });
    await page.getByRole("tab", { name: "Cycle & Safety", exact: true }).click({ timeout: 120_000 });
    await page.getByRole("button", { name: "Review my cycle" }).click();
    await expect(page.getByRole("heading", { name: "Lean mass", exact: true })).toBeVisible();

    const overflow = await page.evaluate(() => {
      const main = document.querySelector("main");
      return {
        document: document.documentElement.scrollWidth - window.innerWidth,
        main: main ? main.scrollWidth - main.clientWidth : 0,
      };
    });
    expect(overflow.document).toBeLessThanOrEqual(1);
    expect(overflow.main).toBeLessThanOrEqual(1);

    await page.getByRole("heading", { name: "Lean mass", exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: "test-results/cycle-review/mobile-top.png" });
    await page.getByRole("region", { name: "Lab trends" }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: "test-results/cycle-review/mobile-lab-trends.png" });
    await page.getByRole("region", { name: "Body systems" }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: "test-results/cycle-review/mobile-systems.png" });
  });
});

test.describe("support plan", () => {
  test.use({ viewport: { width: 1280, height: 900 } });
  test.setTimeout(240_000);

  test("member builds, edits and keeps a support plan with honest checks", async ({ page }) => {
    const stamp = new Date().toISOString();
    const state = memberState();
    state.trainingSession.enhancementLog.push({
      doseUnit: "", timingPreference: "", goalAssociation: [], isActive: true, createdAt: stamp, updatedAt: stamp,
      id: "e2e-electrolytes", name: "Electrolytes", officialName: "Electrolytes", compoundClass: "supplements", category: "supplement", doseAmount: "", frequency: "", startDate: daysAgo(20),
    });
    await bootTo(page, "supplements", {
      ...state,
      safetyAcknowledgement: { acknowledgedAt: stamp, version: SAFETY_ACK_VERSION, adultConfirmedAt: stamp },
      cycleGoals: { "e2e-cycle": { primaryGoal: "fat-loss", priorities: ["minimize-cardiovascular-risk"], compoundPurposes: {}, updatedAt: stamp } },
    });
    const openReview = async () => {
      await page.getByRole("tab", { name: "Cycle & Safety", exact: true }).click({ timeout: 120_000 });
      await page.getByRole("button", { name: "Review my cycle" }).click();
      await expect(page.getByRole("heading", { name: "Fat loss", exact: true })).toBeVisible();
    };
    await openReview();

    const plan = page.getByRole("region", { name: "Support plan" });
    await expect(plan.getByText(/No supplement has been shown to offset harm from anabolic steroids/)).toBeVisible();
    await expect(plan.getByText(/cannot make a cycle risk-free/)).toBeVisible();
    await expect(plan.getByText(/No supplements selected/)).toBeVisible();
    await plan.getByRole("button", { name: "Browse supplements" }).click();

    // Personalized library: every linked option says why
    const library = page.getByRole("dialog", { name: "Supplement library" });
    // Psyllium is listed under every purpose it has evidence for.
    await expect(library.getByRole("button", { name: /^Psyllium husk/ }).first()).toBeVisible();
    await library.getByRole("button", { name: /^Psyllium husk/ }).first().click();

    const detail = page.getByRole("dialog", { name: "Psyllium husk" });
    await expect(detail.getByRole("region", { name: "Why you're seeing this" }).getByText("Your ApoB changed from 92 mg/dL to 124 mg/dL.")).toBeVisible();
    await expect(detail.getByRole("region", { name: "What it does not address" })).toContainText("HDL cholesterol");
    await expect(detail.getByRole("region", { name: "Relevant markers" })).toContainText("124 mg/dL ↑");
    const check = detail.getByRole("region", { name: "Safety check" });
    await expect(check.getByText("Review before using")).toBeVisible();
    await expect(check).toContainText("Oxandrolone");
    await expect(check).toContainText("Based on the information currently entered.");
    await page.screenshot({ path: "test-results/cycle-review/support-option-detail.png" });
    await detail.getByRole("button", { name: "Add to my support plan" }).click();
    await expect(detail.getByText("Added", { exact: true })).toBeVisible();
    await detail.getByRole("button", { name: "All supplements" }).click();

    // Full library holds supplements only
    await library.getByRole("tab", { name: "All options" }).click();
    await expect(library.getByText("Nothing here has been studied in people using anabolic steroids. Joint pain that follows an injury, or that does not settle, is worth having seen at urgent care, a telehealth visit or a clinician.")).toBeVisible();
    for (const drug of ["Metformin", "Tadalafil", "Anastrozole", "Tamoxifen"]) await expect(library.getByText(drug)).toHaveCount(0);

    await library.getByRole("button", { name: /^Multivitamin/ }).click();
    await page.getByRole("dialog", { name: "Multivitamin" }).getByRole("button", { name: "Add to my support plan" }).click();
    await page.getByRole("dialog", { name: "Multivitamin" }).getByRole("button", { name: "All supplements" }).click();
    await library.getByRole("button", { name: /^Vitamin D3/ }).first().click();
    const vitaminD = page.getByRole("dialog", { name: "Vitamin D3" });
    await expect(vitaminD.getByRole("region", { name: "Safety check" })).toContainText("Possible duplicate intake of vitamin D");
    await vitaminD.getByRole("button", { name: "Add to my support plan" }).click();
    await page.keyboard.press("Escape");

    // The plan
    await expect(plan.getByText("selected", { exact: true })).toBeVisible();
    await expect(plan.locator(".type-metric")).toHaveText("3");
    await expect(plan.getByText("Possible duplicate intake", { exact: true })).toBeVisible();
    await expect(plan.getByText(/Supplements don.t address/)).toBeVisible();
    await expect(plan.getByText(/Hematocrit changes\. No supplement lowers them/)).toBeVisible();
    const coverage = page.getByRole("region", { name: "Health support" });
    await expect(coverage.getByText("No proven supplement support").first()).toBeVisible();
    await expect(coverage).toContainText(/No supplement has been shown to restore natural testosterone production/);
    await plan.scrollIntoViewIfNeeded();
    await page.screenshot({ path: "test-results/cycle-review/support-plan.png" });

    // Member-entered details
    await plan.getByRole("button", { name: "Details for Psyllium husk" }).click();
    const details = page.getByRole("dialog", { name: "Psyllium husk — your details" });
    await expect(details.getByText("Member entered")).toBeVisible();
    await details.getByLabel("Amount").fill("1");
    await details.getByLabel("Unit").fill("teaspoon");
    await details.getByLabel("Frequency").fill("daily");
    await details.getByRole("button", { name: "Save details" }).click();
    await expect(plan.getByText("Member entered: 1 teaspoon · daily")).toBeVisible();
    await expect(plan.getByText("Details not entered.").first()).toBeVisible();

    // Remove, then persist across a reload
    await plan.getByRole("button", { name: "Remove Multivitamin" }).click();
    await expect(plan.locator(".type-metric")).toHaveText("2");
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator("main").waitFor({ state: "visible", timeout: 120_000 });
    await openReview();
    const reloaded = page.getByRole("region", { name: "Support plan" });
    await expect(reloaded.locator(".type-metric")).toHaveText("2");
    await expect(reloaded.getByText("Member entered: 1 teaspoon · daily")).toBeVisible();
    await page.getByRole("region", { name: "Health support" }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: "test-results/cycle-review/health-support.png" });
  });
});

test.describe("cycle review", () => {
  test.use({ viewport: { width: 1280, height: 900 } });
  test.setTimeout(240_000);

  test("reviews a cycle against its goal, routes a warning sign to care, and saves a clinician summary", async ({ page }) => {
    await bootTo(page, "supplements", memberState());
    await page.getByRole("tab", { name: "Cycle & Safety", exact: true }).click({ timeout: 120_000 });
    await page.getByLabel(/I understand Reserve is not medical care/).check();
    await page.getByLabel("I am 18 or older.").check();
    await page.getByRole("button", { name: "Continue" }).click();

    await page.getByRole("button", { name: "Review my cycle" }).click();

    // 1. Goal setup
    await expect(page.getByRole("heading", { name: "What is this cycle for?" })).toBeVisible();
    await page.locator("label", { hasText: /^Fat loss$/ }).click();
    await page.getByRole("checkbox", { name: "Maintain fertility" }).check();
    await page.getByRole("button", { name: "Purpose for Oxandrolone" }).click();
    await page.getByRole("option", { name: "Fat loss" }).click();
    await page.getByRole("button", { name: "Save and review" }).click();

    // 2. The review
    await expect(page.getByRole("heading", { name: "Fat loss", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Log this week's check-in" })).toBeVisible();

    const trends = page.getByRole("region", { name: "Lab trends" });
    await expect(trends.getByText("ApoB", { exact: true })).toBeVisible();
    await expect(trends.getByText("Trend worth reviewing").first()).toBeVisible();
    await expect(trends.getByText("Nandrolone Decanoate added")).toBeVisible();

    const complexity = page.getByRole("region", { name: "Cycle complexity" });
    await expect(complexity.getByText("Potential overlap")).toBeVisible();
    // Shared loads whose markers already moved lead the list; the rest wait behind a disclosure.
    await expect(complexity.getByText("Red blood cell increase", { exact: true })).toBeVisible();
    await expect(complexity.getByText("Cholesterol changes", { exact: true })).toBeVisible();
    await complexity.getByText(/more shared loads/).click();
    await expect(complexity.getByText("Natural testosterone suppression", { exact: true })).toBeVisible();
    await expect(complexity.getByText(/No purpose is recorded for Testosterone Cypionate and Nandrolone Decanoate\./)).toBeVisible();
    await expect(complexity.getByText(/You set "Maintain fertility" as a priority\./)).toBeVisible();
    await complexity.getByText("Your plan as entered").click();
    await expect(complexity.getByText(/Amount: Unknown \/ not entered/).first()).toBeVisible();
    await expect(complexity.getByText(/Amount: 20 mg/)).toBeVisible();

    const questions = page.getByRole("region", { name: "Questions to ask at a visit" });
    await expect(questions.getByText(/My ApoB went from 92 mg\/dL to 124 mg\/dL/)).toBeVisible();
    await expect(page.getByText(/caused/i)).toHaveCount(0);

    await page.getByRole("heading", { name: "Fat loss", exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: "test-results/cycle-review/review-top.png" });
    await trends.scrollIntoViewIfNeeded();
    await page.screenshot({ path: "test-results/cycle-review/lab-trends.png" });
    await complexity.scrollIntoViewIfNeeded();
    await page.screenshot({ path: "test-results/cycle-review/complexity.png" });

    // 3. A check-in with a warning sign routes to care before anything else
    await page.getByRole("button", { name: "Log this week's check-in" }).click();
    const sheet = page.getByRole("dialog", { name: "Weekly check-in" });
    await sheet.getByLabel("Systolic").fill("138");
    await sheet.getByLabel("Diastolic").fill("88");
    await sheet.getByRole("checkbox", { name: "Chest pain, pressure or discomfort" }).check();
    await expect(sheet.getByRole("link", { name: "Call 911" }).first()).toHaveAttribute("href", "tel:911");
    await sheet.getByRole("button", { name: "Save check-in" }).click();
    const care = page.getByRole("dialog", { name: "Get care first" });
    await expect(care.getByText(/Your check-in is saved/)).toBeVisible();
    await page.screenshot({ path: "test-results/cycle-review/check-in-care.png" });
    await care.getByRole("button", { name: "Close check-in" }).click();

    await expect(page.getByRole("heading", { name: "Get care before reviewing your cycle" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Lab trends" })).toHaveCount(0);
    await page.getByRole("button", { name: "Show the review anyway" }).click();
    await expect(page.getByRole("region", { name: "Lab trends" })).toBeVisible();

    // 4. Bring this to your clinician
    await expect(
      page
        .getByRole("heading", { name: "Your cycle, organized for review" })
        .locator("xpath=ancestor::div[.//button[contains(normalize-space(.), 'Print or save as PDF')]][1]")
        .getByRole("button", { name: "Print or save as PDF" }),
    ).toBeEnabled();
    await page.getByRole("button", { name: "Save to review history" }).click();
    await expect(page.getByText("Saved to this cycle's review history")).toBeVisible();
    await expect(page.getByText("Review history (1)")).toBeVisible();
    await page.getByText("Review history (1)").scrollIntoViewIfNeeded();
    await page.screenshot({ path: "test-results/cycle-review/clinician-card.png" });

    const stored = await page.evaluate(() => window.localStorage.getItem("final-boss-athlete-settings") ?? "");
    expect(stored).toContain("CYCLE REVIEW — FOR CLINICIAN");
    expect(stored).toContain('"primaryGoal":"fat-loss"');
  });
});
