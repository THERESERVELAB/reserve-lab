import { test, expect, type Locator, type Page } from "@playwright/test";

/**
 * SPLIT CUSTOMIZATION — the member owns the week.
 *
 * Drives the real 7-day rail on Daily Command: open a day, change it, and
 * confirm the change is shown, survives a reload, and can be taken back.
 *
 * Sunday is used throughout because in a Monday-first week it is always today
 * or ahead — never a past day, which the editor correctly refuses to change.
 */

async function bootToDashboard(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("fba-preview-view", "dashboard");
    const KEY = "final-boss-athlete-settings";
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : { state: {}, version: 0 };
    parsed.state = {
      ...parsed.state,
      onboarding: { status: "complete", currentStep: 99, startedAt: new Date().toISOString() },
    };
    window.localStorage.setItem(KEY, JSON.stringify(parsed));
  });
  await page.goto("/", { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.locator("main").waitFor({ state: "visible", timeout: 120_000 });
}

function sundayColumn(page: Page) {
  return page
    .getByRole("group", { name: "Seven day training split" })
    .getByRole("button", { name: /^Sun/ });
}

/**
 * The rail is server-rendered, so a day button exists before the page hydrates,
 * and a click in that gap is silently lost under load. Retry until the day
 * inspector actually opens.
 */
async function openDay(page: Page, day: Locator) {
  await expect(async () => {
    await day.click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 60_000 });
}

test.describe("split customization", () => {
  test.use({ viewport: { width: 1280, height: 900 } });
  test.setTimeout(240_000);

  test("move a day to legs every week, keep it across reloads, then take it back", async ({ page }) => {
    await bootToDashboard(page);
    const sunday = sundayColumn(page);
    await sunday.waitFor({ timeout: 120_000 });

    await openDay(page, sunday);
    await page.getByRole("tab", { name: /^Every Sun/ }).click();
    await page.getByRole("button", { name: "Legs", exact: true }).click();
    await page.getByRole("button", { name: /^Every Sun.*: Legs$/ }).click();

    await expect(sunday).toHaveAccessibleName(/Legs.*changed by you/);

    // Persisted, not component state.
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(sundayColumn(page)).toHaveAccessibleName(/Legs.*changed by you/, { timeout: 120_000 });

    await openDay(page, sundayColumn(page));
    await page.getByRole("button", { name: "Back to plan" }).click();
    await expect(sundayColumn(page)).not.toHaveAccessibleName(/changed by you/);
  });

  test("a 5:45 AM group class stands in for the day", async ({ page }) => {
    await bootToDashboard(page);
    const sunday = sundayColumn(page);
    await sunday.waitFor({ timeout: 120_000 });

    await openDay(page, sunday);
    await page.getByRole("button", { name: "Group Class", exact: true }).click();
    await page.getByLabel("Start time (optional)").fill("05:45");
    await page.getByRole("button", { name: /^This Sun.*Group Class/ }).click();

    await expect(sunday).toHaveAccessibleName(/Group Class.*changed by you/);
  });

  test("a track day replaces the planned session without a template prompt", async ({ page }) => {
    await bootToDashboard(page);
    const sunday = sundayColumn(page);
    await sunday.waitFor({ timeout: 120_000 });
    await openDay(page, sunday);
    await page.getByRole("button", { name: "Track Session", exact: true }).click();
    await page.getByRole("button", { name: /Track Session$/ }).last().click();
    await expect(sunday).toHaveAccessibleName(/Track Session/);
    await expect(page.getByText("Workout template missing")).toHaveCount(0);
  });

  test("today becomes a track day with the member's own 3 mi goal", async ({ page }) => {
    await bootToDashboard(page);
    const today = todayColumn(page);
    await today.waitFor({ timeout: 120_000 });

    await openDay(page, today);
    const sheet = page.getByRole("dialog");
    await sheet.getByRole("button", { name: "Track Session", exact: true }).click();
    await sheet.getByLabel("Distance goal (optional)").fill("3");
    await sheet.getByRole("button", { name: /^This .*: Track Session$/ }).click();

    await expect(today).toHaveAccessibleName(/Track Session · Today · 3 mi.*changed by you/);
  });

  test("move today's lifting session to tomorrow and run track today", async ({ page }) => {
    await bootToDashboard(page);
    const today = todayColumn(page);
    await today.waitFor({ timeout: 120_000 });

    // Make today a known lifting day first, whatever the plan says.
    await openDay(page, today);
    const sheet = page.getByRole("dialog");
    await sheet.getByRole("button", { name: "Push", exact: true }).click();
    await sheet.getByRole("button", { name: /^This .*: Push$/ }).click();
    await expect(today).toHaveAccessibleName(/Push · Today/);

    await openDay(page, today);
    await sheet.getByRole("button", { name: "Move Push to tomorrow" }).click();
    await sheet.getByRole("button", { name: "Track Session", exact: true }).click();
    await sheet.getByLabel("Distance goal (optional)").fill("3");
    await expect(sheet.getByText(/moves off the plan for that day|becomes Push for that day/)).toBeVisible();
    await sheet.getByRole("button", { name: "Today: Track Session · Tomorrow: Push" }).click();

    await expect(today).toHaveAccessibleName(/Track Session · Today · 3 mi.*changed by you/);
    // Sunday's tomorrow is next week's Monday, which this rail does not show;
    // the week-boundary case is covered by the unit suite.
    const todayIndex = (new Date().getDay() + 6) % 7;
    if (todayIndex < 6) {
      await expect(dayColumn(page, WEEKDAY_SHORT[todayIndex + 1])).toHaveAccessibleName(/Push.*changed by you/);
    }
  });
});

const WEEKDAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function dayColumn(page: Page, short: string) {
  return page
    .getByRole("group", { name: "Seven day training split" })
    .getByRole("button", { name: new RegExp(`^${short}`) });
}

function todayColumn(page: Page) {
  return dayColumn(page, WEEKDAY_SHORT[(new Date().getDay() + 6) % 7]);
}
