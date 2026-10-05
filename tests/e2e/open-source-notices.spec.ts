import { test, expect } from "@playwright/test";

/**
 * OPEN-SOURCE NOTICES — the page renders every listed project, links the
 * full Apache License text, and the served OCR files carry their licenses.
 */

test.describe("open-source notices", () => {
  test.setTimeout(180_000);

  test("lists the software Reserve is built with and serves the license texts", async ({ page, request }) => {
    await page.goto("/open-source", { waitUntil: "domcontentloaded", timeout: 120_000 });
    await expect(page.getByRole("heading", { name: "Open-source notices", level: 1 })).toBeVisible();
    const device = page.getByRole("region", { name: "Runs on your device" });
    await expect(device.getByRole("heading", { name: "Tesseract.js" })).toBeVisible();
    await expect(device.getByRole("heading", { name: "PDF.js" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Runs on Reserve’s servers" }).getByRole("heading", { name: "Stripe Node.js library" })).toBeVisible();

    const apache = await request.get("/licenses/Apache-2.0.txt");
    expect(apache.ok()).toBe(true);
    expect(await apache.text()).toContain("Apache License");

    const ocrLicense = await request.get("/ocr/LICENSE-tesseract.js.txt");
    expect(ocrLicense.ok()).toBe(true);

    const all = page.getByRole("region", { name: "All production packages" });
    await all.getByText(/^Show all \d+ packages$/).click();
    await expect(all.getByRole("cell", { name: "tesseract.js-core", exact: true })).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await page.screenshot({ path: "test-results/open-source/notices-phone.png" });
  });
});
