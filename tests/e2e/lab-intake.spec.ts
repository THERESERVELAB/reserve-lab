import { test, expect, type Page } from "@playwright/test";

/**
 * LAB REPORT INTAKE — photos, pasted results and unreadable formats, end to
 * end in the real app. The photo is a synthetic lab table rendered in the
 * browser, then read by the on-device OCR engine served from /ocr. No real
 * patient data.
 */

async function bootToBloodwork(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("fba-preview-view", "bloodwork");
    const KEY = "final-boss-athlete-settings";
    if (!window.localStorage.getItem(KEY)) {
      window.localStorage.setItem(
        KEY,
        JSON.stringify({ state: { subscriptionTier: "elite", onboarding: { status: "complete", currentStep: 99, startedAt: new Date().toISOString() } }, version: 0 }),
      );
    }
  });
  await page.goto("/", { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.locator('[data-record="bloodwork"]').waitFor({ timeout: 120_000 });
  await page.getByRole("button", { name: "New Lab Record" }).first().click();
  /* The intake opens in a sheet (clinical records wave). */
  await page.getByRole("dialog", { name: "New lab record" }).waitFor({ timeout: 30_000 });
}

async function renderLabPhoto(page: Page): Promise<Buffer> {
  const rows = [
    ["HEMATOCRIT", "52.1", "H", "38.5-50.0", "%"],
    ["GLUCOSE", "88", "", "65-99", "mg/dL"],
    ["ALT", "41", "", "9-46", "U/L"],
  ];
  const photo = await page.context().newPage();
  await photo.setViewportSize({ width: 1000, height: 400 });
  await photo.setContent(`
    <body style="margin:0;background:#fff;font-family:Arial,Helvetica,sans-serif;color:#000">
      <div id="report" style="padding:28px 36px;width:900px">
        <p style="font-size:22px;margin:0 0 6px">Collected: 09/01/2026</p>
        <table style="font-size:26px;border-collapse:collapse;width:100%">
          ${rows.map((r) => `<tr>${r.map((c, i) => `<td style="padding:10px 14px 10px 0;${i === 0 ? "width:300px" : ""}">${c}</td>`).join("")}</tr>`).join("")}
        </table>
      </div>
    </body>`);
  const buffer = await photo.locator("#report").screenshot();
  await photo.close();
  return buffer;
}

test.describe("lab report intake", () => {
  test.use({ viewport: { width: 1280, height: 900 } });
  test.setTimeout(240_000);

  test("reads a photographed report on the device and flags rows to check", async ({ page }) => {
    await bootToBloodwork(page);
    const photo = await renderLabPhoto(page);
    await page.locator('input[type="file"]').setInputFiles({ name: "report-photo.png", mimeType: "image/png", buffer: photo });

    await expect(page.getByText(/Read \d+ results? from your photos\./)).toBeVisible({ timeout: 150_000 });
    await expect(page.getByText(/Photos can be misread — check every digit/)).toBeVisible();
    await expect(page.getByText("Recognized as Hematocrit · Lab flag: High · Read from a photo — check every digit")).toBeVisible();
    await expect(page.getByLabel("Test name").first()).toHaveValue("HEMATOCRIT");
    await expect(page.getByText("What this measures: The share of your blood volume made up of red blood cells.")).toBeVisible();
    await expect(page.locator('input[type="date"]').first()).toHaveValue("2026-09-01");

    // OCR output can vary. If ALT (printed 41, range 9-46, no flag) was misread, its row must say so.
    const alt = page.getByRole("region", { name: "Liver" }).locator("div.rounded-xl").filter({ has: page.locator('input[value="ALT"]') });
    const altValue = await alt.getByLabel("Result").inputValue();
    if (altValue !== "41") {
      await expect(alt.getByText(/^Check this row against your report — /)).toBeVisible();
      await expect(page.getByText(/rows? (is|are) marked to check\./)).toBeVisible();
      await alt.scrollIntoViewIfNeeded();
      await page.screenshot({ path: "test-results/lab-intake/photo-reading-check.png" });
      await page.evaluate(() => document.querySelector("main")?.scrollTo(0, 0));
    }
    await page.screenshot({ path: "test-results/lab-intake/photo-review.png" });
  });

  test("reads pasted results, lets the member match an unrecognized test, and keeps the match", async ({ page }) => {
    await bootToBloodwork(page);
    await page.getByRole("button", { name: "Paste results instead" }).click();
    await page.getByLabel("Paste results from your patient portal").fill(
      ["Collection Date: 2026-08-15", "HEMOGLOBIN 17.4 H 13.2-17.1 g/dL", "HCT PERCENT 52.1 H 38.5-50.0 %", "HEPATITIS C ANTIBODY NON-REACTIVE NON-REACTIVE"].join("\n"),
    );
    await page.getByRole("button", { name: "Read pasted results" }).click();

    await expect(page.getByText("Read 3 results from the pasted text. Check every value against your report before saving.")).toBeVisible();
    await expect(page.getByRole("region", { name: "Not recognized" })).toContainText("Not recognized — saved as written");
    await page.getByLabel("Match HCT PERCENT to a known test").selectOption({ label: "Hematocrit" });
    await expect(page.getByRole("region", { name: "Blood count" }).getByText(/Matched as Hematocrit/)).toBeVisible();
    await expect(page.getByLabel("Result").nth(2)).toHaveValue("NON-REACTIVE");
    await page.screenshot({ path: "test-results/lab-intake/paste-review.png" });

    await page.getByRole("button", { name: "Save Lab Record" }).click();
    const stored = await page.evaluate(() => window.localStorage.getItem("final-boss-athlete-settings") ?? "");
    expect(stored).toContain('"name":"HCT PERCENT"');
    expect(stored).toContain('"markerKey":"hematocrit"');
    expect(stored).not.toContain("Collection Date: 2026-08-15");
  });

  test("marks a row whose result and lab flag don't agree, and clears it once the member corrects the result", async ({ page }) => {
    await bootToBloodwork(page);
    await page.getByRole("button", { name: "Paste results instead" }).click();
    await page.getByLabel("Paste results from your patient portal").fill(["HEMOGLOBIN 1.74 H 13.2-17.1 g/dL", "GLUCOSE 88 65-99 mg/dL"].join("\n"));
    await page.getByRole("button", { name: "Read pasted results" }).click();

    await expect(page.getByText("Read 2 results from the pasted text. 1 row is marked to check. Check every value against your report before saving.")).toBeVisible();
    const message = page.getByText("Check this row against your report — the result and the lab flag don't agree.");
    await expect(message).toHaveCount(1);
    await page.getByLabel("Result").first().fill("17.4");
    await expect(message).toHaveCount(0);
  });

  test("says what can move a reading, next to the result and again on the saved record", async ({ page }) => {
    await bootToBloodwork(page);
    await page.getByRole("button", { name: "Paste results instead" }).click();
    await page.getByLabel("Paste results from your patient portal").fill(
      ["Collection Date: 2026-09-01", "CREATININE 1.42 H 0.76-1.27 mg/dL", "TSH 2.10 0.45-4.50 uIU/mL"].join("\n"),
    );
    await page.getByRole("button", { name: "Read pasted results" }).click();

    // The confound belongs beside the number, where the member reads it.
    await expect(page.getByText(/^What can change this reading: Creatine supplements and a large amount of muscle/)).toBeVisible();
    await expect(page.getByText(/^What can change this reading: Biotin, in hair, skin and nail products/)).toBeVisible();
    await page.screenshot({ path: "test-results/lab-intake/reading-notes.png" });

    await page.getByRole("button", { name: "Save Lab Record" }).click();

    // And again on the saved record, with the citation behind it.
    await page.getByText("What these tests measure").first().click();
    const guide = page.getByText("What can change a reading");
    await expect(guide).toBeVisible();
    await expect(page.getByRole("link", { name: /NIDDK: Estimating Glomerular Filtration Rate/ }).first()).toBeVisible();
    await expect(page.getByText(/FDA safety communication: biotin may interfere with lab tests/).first()).toBeVisible();
  });

  test("explains files it cannot read instead of failing silently", async ({ page }) => {
    await bootToBloodwork(page);
    await page.locator('input[type="file"]').setInputFiles({ name: "IMG_0042.HEIC", mimeType: "image/heic", buffer: Buffer.from("not a real image") });
    await expect(page.getByText("IMG_0042.HEIC: HEIC photos can't be read in the browser. Save or share the photo as JPEG or PNG, then add it.")).toBeVisible();
    await expect(page.getByRole("button", { name: /Add your lab report/ })).toBeVisible();
  });
});
