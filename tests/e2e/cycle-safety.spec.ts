import { test, expect, type Page } from "@playwright/test";

import { SAFETY_ACK_VERSION } from "../../src/lib/safety/acknowledgement";

/**
 * CYCLE & SAFETY — end to end in the real app.
 *
 *   1. A Quest-style lab PDF is read on-device, reviewed, saved, and flagged
 *      against the ranges printed on it — with the critical result escalated.
 *   2. A member plans a cycle, sees known risks for the compound in it, and a
 *      red-flag symptom routes straight to a working tap-to-call 911 link.
 *
 * The PDF is synthetic and built in memory: one text object per table cell,
 * positioned the way a lab report lays out its columns. No real patient data.
 */

function buildLabPdf(rows: string[][], columnX: number[]): Buffer {
  const escape = (text: string) => text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  const ops: string[] = [];
  let y = 740;
  for (const row of rows) {
    row.forEach((cell, index) => {
      if (cell) ops.push(`BT /F1 10 Tf ${columnX[index]} ${y} Td (${escape(cell)}) Tj ET`);
    });
    y -= 18;
  }
  const stream = ops.join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefAt = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
}

const QUEST_PDF = buildLabPdf(
  [
    ["Quest Diagnostics"],
    ["Patient: TEST PATIENT"],
    ["Collected: 09/01/2026"],
    ["Test Name", "Result", "Flag", "Reference Range", "Units"],
    ["HEMATOCRIT", "52.1", "H", "38.5-50.0", "%"],
    ["POTASSIUM", "6.9", "HH", "3.5-5.3", "mmol/L"],
    ["HDL CHOLESTEROL", "32", "L", "> OR = 40", "mg/dL"],
    ["GLUCOSE", "88", "", "65-99", "mg/dL"],
  ],
  [40, 220, 270, 310, 420],
);

function localDateKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

async function bootTo(page: Page, view: string, extraState: Record<string, unknown> = {}) {
  await page.addInitScript(
    ({ v, extra }) => {
      window.localStorage.setItem("fba-preview-view", v);
      const KEY = "final-boss-athlete-settings";
      const raw = window.localStorage.getItem(KEY);
      const parsed = raw ? JSON.parse(raw) : { state: {}, version: 0 };
      if (!raw) {
        parsed.state = {
          ...parsed.state,
          ...extra,
          subscriptionTier: "elite",
          onboarding: { status: "complete", currentStep: 99, startedAt: new Date().toISOString() },
        };
        window.localStorage.setItem(KEY, JSON.stringify(parsed));
      }
    },
    { v: view, extra: extraState },
  );
  await page.goto("/", { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.locator("main").waitFor({ state: "visible", timeout: 120_000 });
}

async function acknowledgeSafety(page: Page) {
  await page.getByLabel(/I understand Reserve is not medical care/).check();
  await page.getByLabel("I am 18 or older.").check();
  await page.getByRole("button", { name: "Continue" }).click();
}

test.describe("cycle and safety", () => {
  test.use({ viewport: { width: 1280, height: 900 } });
  test.setTimeout(240_000);

  test("a Quest PDF is read on-device, reviewed, and flagged against its own ranges", async ({ page }) => {
    await bootTo(page, "bloodwork");
    /* The intake lives in a sheet now; the hidden file input stays on the page and opens it. */
    await page.locator('[data-record="bloodwork"]').waitFor({ timeout: 120_000 });

    await page.locator('input[type="file"]').setInputFiles({ name: "quest-report.pdf", mimeType: "application/pdf", buffer: QUEST_PDF });

    await expect(page.getByText(/Read 4 results/)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByLabel("Test name")).toHaveCount(4);
    await expect(page.getByLabel("Test name").first()).toHaveValue("HEMATOCRIT");
    await expect(page.getByLabel("Reference range").first()).toHaveValue("38.5-50.0");
    await expect(page.getByText("Recognized as Hematocrit")).toBeVisible();
    await expect(page.locator('input[type="date"]').first()).toHaveValue("2026-09-01");

    await page.getByRole("button", { name: "Save Lab Record" }).click();

    await acknowledgeSafety(page);
    await expect(page.getByRole("heading", { name: "3 results to have reviewed" })).toBeVisible();
    await expect(page.getByText("Potassium: marked critical by the lab")).toBeVisible();
    await page.getByRole("heading", { name: "3 results to have reviewed" }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: "test-results/cycle-safety/bloodwork-flags.png" });

    // Only confirmed marker rows are stored — never the report's patient lines.
    const stored = await page.evaluate(() => window.localStorage.getItem("final-boss-athlete-settings") ?? "");
    expect(stored).toContain("38.5-50.0");
    expect(stored).not.toContain("TEST PATIENT");
  });

  test("the safety tools open only after the member also confirms they are 18 or older", async ({ page }) => {
    await bootTo(page, "supplements");
    await page.getByRole("tab", { name: "Cycle & Safety", exact: true }).click({ timeout: 120_000 });

    await expect(page.getByText("Cycle monitoring, compound risk information and lab flags are for adults 18 and older.")).toBeVisible();
    await page.getByLabel(/I understand Reserve is not medical care/).check();
    await expect(page.getByRole("button", { name: "Continue" })).toBeDisabled();
    await page.getByLabel("I am 18 or older.").check();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("button", { name: "Plan a cycle" })).toBeVisible();

    const stored = await page.evaluate(() => window.localStorage.getItem("final-boss-athlete-settings") ?? "");
    expect(stored).toContain('"adultConfirmedAt"');
  });

  test("a profile age under 18 keeps the safety tools closed, even after an earlier acknowledgement", async ({ page }) => {
    const stamp = new Date().toISOString();
    await bootTo(page, "supplements", {
      setupProfile: { setupComplete: true, completedAt: stamp, completedSteps: [], age: 16 },
      safetyAcknowledgement: { acknowledgedAt: stamp, version: SAFETY_ACK_VERSION, adultConfirmedAt: stamp },
    });
    await page.getByRole("tab", { name: "Cycle & Safety", exact: true }).click({ timeout: 120_000 });

    await expect(page.getByRole("heading", { name: "For adults 18 and older" })).toBeVisible();
    await expect(page.getByText(/Your profile lists your age as 16/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Plan a cycle" })).toHaveCount(0);
    await page.screenshot({ path: "test-results/cycle-safety/under-age.png" });
  });

  test("a member can correct their age in Settings, and an age under 18 closes the safety tools", async ({ page }) => {
    await bootTo(page, "settings");
    const age = page.getByLabel("Age", { exact: true });
    await age.fill("abc");
    await expect(page.getByText("Enter your age as a whole number between 1 and 120.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Save age" })).toBeDisabled();

    await age.fill("16");
    await page.getByRole("button", { name: "Save age" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Age saved." })).toContainText("closed for members under 18");
    const stored = await page.evaluate(() => window.localStorage.getItem("final-boss-athlete-settings") ?? "");
    expect(stored).toContain('"age":16');

    await page.getByRole("button", { name: /Open Module/ }).click();
    await page.getByRole("tab", { name: "Cycle & Safety", exact: true }).click({ timeout: 120_000 });
    await expect(page.getByRole("heading", { name: "For adults 18 and older" })).toBeVisible();
  });

  test("without a clinician, the member still sees who can review things and gets a visit-ready summary", async ({ page }) => {
    const stamp = new Date().toISOString();
    await page.setViewportSize({ width: 390, height: 844 });
    await bootTo(page, "supplements", {
      trainingSession: {
        enhancementLog: [
          { id: "e2e-mast", name: "Masteron", officialName: "Drostanolone", compoundClass: "aas", category: "hormone", doseAmount: "", doseUnit: "mg", frequency: "", timingPreference: "", goalAssociation: [], isActive: true, createdAt: stamp, updatedAt: stamp },
        ],
      },
    });
    await page.getByRole("tab", { name: "Cycle & Safety", exact: true }).click({ timeout: 120_000 });
    await acknowledgeSafety(page);

    await page.getByText("No clinician? Who can review this").click();
    const options = page.getByRole("list", { name: "Who can review this" });
    await expect(options).toContainText("Urgent care");
    await expect(options).toContainText("A telehealth visit");
    await expect(options).toContainText("A pharmacist");
    await expect(options).toContainText("Order your own labs");
    await options.scrollIntoViewIfNeeded();
    await page.screenshot({ path: "test-results/cycle-safety/care-options.png" });

    await expect(page.getByText("For any visit", { exact: true })).toBeVisible();
    await page.locator("summary", { hasText: "Preview" }).last().click();
    const preview = page.locator("pre").filter({ hasText: "MEMBER HEALTH RECORD SUMMARY" });
    await expect(preview).toContainText("WHAT TO WATCH AND WHAT TO ASK");
    await expect(preview).toContainText("PSA: not tested");
    await expect(preview).toContainText("Ask: What are the treatment options for acne or hair loss");
    await expect(preview).toContainText("urgent care, a telehealth visit or a pharmacist");
    await preview.scrollIntoViewIfNeeded();
    await page.screenshot({ path: "test-results/cycle-safety/visit-summary.png" });
  });

  test("a planned cycle shows its known risks, and a red flag routes to 911", async ({ page }) => {
    const stamp = new Date().toISOString();
    await bootTo(page, "supplements", {
      trainingSession: {
        enhancementLog: [
          {
            id: "e2e-test-cyp",
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
    });

    await page.getByRole("tab", { name: "Cycle & Safety", exact: true }).click({ timeout: 120_000 });
    await acknowledgeSafety(page);

    await page.getByRole("button", { name: "Plan a cycle" }).click();
    await page.getByLabel("Name").fill("Fall cycle");
    await page.getByLabel("Start date").fill(localDateKey());
    await page.getByLabel("Planned length (weeks)").fill("12");
    await page.getByLabel("Testosterone Cypionate").check();
    await page.getByRole("button", { name: "Save plan" }).click();

    await expect(page.getByRole("heading", { name: "Fall cycle" })).toBeVisible();
    // The plan's date line — the clinician summary preview repeats the phrase.
    await expect(page.getByText(/→ .+ · 12 weeks planned/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Testosterone", exact: true })).toBeVisible();
    await page.screenshot({ path: "test-results/cycle-safety/cycle-tab.png", fullPage: false });

    // Support options: honest evidence for an affected area; the member chooses.
    await page.getByRole("button", { name: "Support options for Blood" }).click();
    const bloodSheet = page.getByRole("dialog");
    await expect(bloodSheet.getByText("No supplement is known to lower hematocrit or hemoglobin.")).toBeVisible();
    await expect(bloodSheet.getByRole("button", { name: "Add to my log" })).toHaveCount(0);
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: "Support options for Heart & blood pressure" }).click();
    const heartSheet = page.getByRole("dialog");
    await expect(heartSheet.getByText(/No supplement has been shown to offset/)).toBeVisible();
    const fishOil = heartSheet.getByRole("listitem").filter({ hasText: "Fish oil (omega-3)" });
    await expect(fishOil.getByText("Limited evidence").first()).toBeVisible();
    await fishOil.getByRole("button", { name: "Add to my support plan" }).click();
    await expect(fishOil.getByText("Added", { exact: true })).toBeVisible();
    await page.screenshot({ path: "test-results/cycle-safety/support-options.png" });
    await page.keyboard.press("Escape");

    await page.getByLabel("Chest pain, pressure or tightness").check();
    await page.getByRole("button", { name: "See what to do" }).click();
    const call911 = page.getByRole("link", { name: "Call 911" }).first();
    await expect(call911).toHaveAttribute("href", "tel:911");
    await call911.scrollIntoViewIfNeeded();
    await page.screenshot({ path: "test-results/cycle-safety/symptom-escalation.png" });
  });
});
