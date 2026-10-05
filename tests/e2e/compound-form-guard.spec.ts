import { test, expect, type Page } from "@playwright/test";

/**
 * COMPOUND FORMS KEEP WHAT WAS TYPED.
 *
 * Owner report: adding a product in the registry, a click outside the box
 * closed the editor and lost the entry. A form never closes on an outside
 * click; X, Cancel and Escape close at once when nothing was typed and ask
 * first when something was.
 */

async function bootToCompoundCommand(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("fba-preview-view", "supplements");
    const KEY = "final-boss-athlete-settings";
    if (!window.localStorage.getItem(KEY)) {
      window.localStorage.setItem(
        KEY,
        JSON.stringify({ state: { subscriptionTier: "elite", onboarding: { status: "complete", currentStep: 99, startedAt: new Date().toISOString() } }, version: 0 }),
      );
    }
  });
  await page.goto("/", { waitUntil: "domcontentloaded", timeout: 120_000 });
}

const editor = (page: Page) => page.getByRole("dialog", { name: "Compound editor" });

async function openEditor(page: Page) {
  await page.getByRole("button", { name: /Add Compound/ }).first().click({ timeout: 120_000 });
  await expect(editor(page)).toBeVisible();
}

for (const viewport of [
  { name: "desktop", width: 1280, height: 900 },
  { name: "phone", width: 390, height: 844 },
]) {
  test.describe(`compound editor keeps the draft (${viewport.name})`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });
    test.setTimeout(240_000);

    test("an outside click does not close the form or lose the entry", async ({ page }) => {
      await bootToCompoundCommand(page);
      await openEditor(page);
      const name = editor(page).getByPlaceholder("e.g. Retatrutide");
      await name.fill("My test compound");

      await page.mouse.click(4, 4);
      await expect(editor(page)).toBeVisible();
      await expect(name).toHaveValue("My test compound");
    });

    test("closing with typed text asks first; Keep Editing keeps it, Discard closes", async ({ page }) => {
      await bootToCompoundCommand(page);
      await openEditor(page);
      const name = editor(page).getByPlaceholder("e.g. Retatrutide");
      await name.fill("My test compound");

      await page.keyboard.press("Escape");
      const confirm = page.getByRole("alertdialog", { name: "Discard unsaved changes" });
      await expect(confirm).toBeVisible();
      await confirm.getByRole("button", { name: "Keep Editing" }).click();
      await expect(confirm).toHaveCount(0);
      await expect(name).toHaveValue("My test compound");

      await editor(page).getByRole("button", { name: "Cancel" }).click();
      await page.getByRole("alertdialog", { name: "Discard unsaved changes" }).getByRole("button", { name: "Discard" }).click();
      await expect(editor(page)).toHaveCount(0);
    });

    test("an untouched form closes straight away", async ({ page }) => {
      await bootToCompoundCommand(page);
      await openEditor(page);
      await page.keyboard.press("Escape");
      await expect(editor(page)).toHaveCount(0);
    });
  });
}
