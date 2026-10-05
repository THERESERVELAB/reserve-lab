import { test, expect, type Page } from "@playwright/test";

import { SAFETY_ACK_VERSION } from "../../src/lib/safety/acknowledgement";

/**
 * CLINICIAN SUMMARY — print or save as PDF, on the member's device.
 *
 * window.print is replaced with a spy so the test can see what the dialog
 * would print: the dated document title (the suggested PDF file name), the
 * print marker, and the summary page. Playwright then renders a real PDF from
 * print media, and afterprint restores the page.
 */

type PrintSpy = { __prints: Array<{ title: string; marker: string | null; text: string }> };

function localDateKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return localDateKey(date);
}

function memberState() {
  const stamp = new Date().toISOString();
  const entry = { doseUnit: "mg", timingPreference: "", goalAssociation: [], isActive: true, createdAt: stamp, updatedAt: stamp };
  return {
    safetyAcknowledgement: { acknowledgedAt: stamp, version: SAFETY_ACK_VERSION, adultConfirmedAt: stamp },
    trainingSession: {
      enhancementLog: [
        { ...entry, id: "p-test", name: "Testosterone Cypionate", officialName: "Testosterone Cypionate", compoundClass: "hormones_testosterone", category: "hormone", doseAmount: "", frequency: "", startDate: daysAgo(70) },
        { ...entry, id: "p-oxa", name: "Oxandrolone", officialName: "Oxandrolone", compoundClass: "aas", category: "hormone", doseAmount: "20", frequency: "daily", startDate: daysAgo(70) },
      ],
    },
    cyclePeriods: [
      { id: "p-cycle", name: "Fall cycle", startDate: daysAgo(70), plannedWeeks: 16, compoundIds: ["p-test", "p-oxa"], clinicianOversight: false, checkpoints: [], createdAt: stamp, updatedAt: stamp },
    ],
    cycleGoals: { "p-cycle": { primaryGoal: "fat-loss", priorities: ["minimize-cardiovascular-risk"], compoundPurposes: {}, updatedAt: stamp } },
    bloodworkLogs: [
      {
        id: "p-lab-1",
        testDate: daysAgo(40),
        createdAt: stamp,
        markers: [
          { name: "HDL Cholesterol", value: "39", unit: "mg/dL", referenceRange: "> OR = 40", labFlag: "L", markerKey: "hdl" },
          { name: "Hematocrit", value: "49.5", unit: "%", referenceRange: "38.5-50.0", markerKey: "hematocrit" },
        ],
      },
    ],
  };
}

async function bootToCycleSafety(page: Page) {
  await page.addInitScript((state) => {
    const spy = window as unknown as PrintSpy;
    spy.__prints = [];
    window.print = () => {
      spy.__prints.push({
        title: document.title,
        marker: document.documentElement.getAttribute("data-reserve-printing"),
        text: document.querySelector(".reserve-print-summary")?.textContent ?? "",
      });
    };
    window.localStorage.setItem("fba-preview-view", "supplements");
    const KEY = "final-boss-athlete-settings";
    if (!window.localStorage.getItem(KEY)) {
      window.localStorage.setItem(
        KEY,
        JSON.stringify({ state: { ...state, subscriptionTier: "elite", onboarding: { status: "complete", currentStep: 99, startedAt: new Date().toISOString() } }, version: 0 }),
      );
    }
  }, memberState());
  await page.goto("/", { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.getByRole("tab", { name: "Cycle & Safety", exact: true }).click({ timeout: 120_000 });
}

function printButtonNear(page: Page, heading: string) {
  return page
    .getByRole("heading", { name: heading })
    .locator("xpath=ancestor::div[.//button[contains(normalize-space(.), 'Print or save as PDF')]][1]")
    .getByRole("button", { name: "Print or save as PDF" });
}

const prints = (page: Page) => page.evaluate(() => (window as unknown as PrintSpy).__prints);

test.describe("clinician summary — print or save as PDF", () => {
  test.use({ viewport: { width: 1280, height: 900 } });
  test.setTimeout(240_000);

  test("the Cycle Review card prints its summary under a dated title, then restores the page", async ({ page }) => {
    await bootToCycleSafety(page);
    await page.getByRole("button", { name: "Review my cycle" }).click();
    const title = await page.title();

    await printButtonNear(page, "Your cycle, organized for review").click();
    await expect.poll(async () => (await prints(page)).length).toBe(1);
    const [job] = await prints(page);
    expect(job.title).toBe(`Reserve cycle review ${localDateKey()}`);
    expect(job.marker).toBe("summary");
    expect(job.text).toContain("CYCLE REVIEW — FOR CLINICIAN");
    expect(job.text).toContain("Oxandrolone — amount: 20 mg");
    expect(job.text).toContain("Not a clinical assessment.");
    await expect(page.getByText("To keep a file, choose Save as PDF in the print dialog.")).toBeVisible();

    await page.pdf({ path: "test-results/clinician-summary/cycle-review.pdf", format: "Letter" });

    await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
    await expect(page.locator(".reserve-print-summary")).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.getAttribute("data-reserve-printing"))).toBeNull();
    expect(await page.title()).toBe(title);
  });

  test("the Share your records panel prints the health record summary", async ({ page }) => {
    await bootToCycleSafety(page);

    await printButtonNear(page, "Share your records").click();
    await expect.poll(async () => (await prints(page)).length).toBe(1);
    const [job] = await prints(page);
    expect(job.title).toBe(`Reserve health record summary ${localDateKey()}`);
    expect(job.text).toContain("MEMBER HEALTH RECORD SUMMARY");
    expect(job.text).toContain("HDL cholesterol: 39 mg/dL");

    await page.pdf({ path: "test-results/clinician-summary/health-record.pdf", format: "Letter" });
    await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
    await expect(page.locator(".reserve-print-summary")).toHaveCount(0);
  });
});
