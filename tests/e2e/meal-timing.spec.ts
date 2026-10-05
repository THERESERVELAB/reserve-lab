import { test, expect, type Page } from "@playwright/test";

/**
 * MEAL TIMING THAT KNOWS A REAL DAY — the owner's member, end to end.
 *
 * Wakes 4:45 AM, trains 5:15–8:15 AM, is home at 9:00, sleeps 9:30 PM.
 * Asserts, through the real screens:
 *
 *   · no full meal before the session: the only item before 5:15 is the
 *     optional pre-workout shake, and it is food only
 *   · meal #1 — the post-workout breakfast — lands at the 9:00 home time
 *   · the day's last meal is in the evening, before the sleep lock
 *   · Nutrition, Schedule and Apex name the same next meal
 *
 * Seeding is two-phase, as in nutrition-room.spec.ts: the first load lets the
 * app write its own persisted state, and the patch is applied by an init
 * script BEFORE the app boots on reload. The view is carried in
 * sessionStorage so one seeded day can be read on several screens.
 */

const KEY = "final-boss-athlete-settings";
/** Tuesday 15 September 2026 (a Pull day), 4:58 AM — awake, the session starts at 5:15. */
const BEFORE_SESSION = new Date(2026, 8, 15, 4, 58, 0);
/** The same day, 8:50 AM — the session is over, the member is on the way home. */
const HEADING_HOME = new Date(2026, 8, 15, 8, 50, 0);

const SUPPLEMENT_WORDS = /creatine|citrulline|arginine|caffeine|powder|scoop|capsule|pre-?workout (?:mix|formula|blend)|electrolyte/i;

type View = "nutrition" | "schedule-command" | "dashboard";

async function bootDay(page: Page, when: Date, view: View) {
  await page.clock.setFixedTime(when);
  await page.addInitScript(
    ({ k, v }) => {
      window.localStorage.setItem("fba-preview-view", window.sessionStorage.getItem("e2e-view") ?? v);
      const raw = window.localStorage.getItem(k);
      const parsed = raw ? JSON.parse(raw) : { state: {}, version: 0 };
      parsed.state = {
        ...parsed.state,
        onboarding: { ...(parsed.state.onboarding || {}), status: "complete", currentStep: 99, startedAt: "2026-09-01T12:00:00.000Z" },
      };
      window.localStorage.setItem(k, JSON.stringify(parsed));
    },
    { k: KEY, v: view },
  );

  /* `domcontentloaded`: the dev server's HMR socket keeps networkidle from settling. */
  await page.goto("/", { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.locator("main h1").first().waitFor({ timeout: 120_000 });
  await page.waitForFunction(
    (k) => {
      const raw = window.localStorage.getItem(k);
      const state = raw ? JSON.parse(raw).state : null;
      return Boolean(state?.recoveryCommand && state?.nutritionPrefs && state?.scheduleProfile && state?.setupProfile);
    },
    KEY,
    { timeout: 30_000 },
  );

  const patched = await page.evaluate(
    ({ k, iso }) => {
      const now = new Date(iso);
      const localKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const parsed = JSON.parse(window.localStorage.getItem(k) as string);
      const s = parsed.state;
      s.recoveryCommand = { ...s.recoveryCommand, hydrationLogs: [], sleepLogs: [{ date: localKey, hours: 7 }] };
      s.nutritionPrefs = { ...s.nutritionPrefs, loggedMealIds: [], latestMealLog: null, nutritionLogDate: localKey };
      s.scheduleProfile = {
        ...s.scheduleProfile,
        wakeTime: "04:45",
        sleepTarget: "21:30",
        trainingWindow: "morning",
        preferredTrainingStart: "05:15",
        preferredTrainingEnd: "08:15",
        preWorkoutFuel: null,
        postWorkoutHomeMinutes: null,
        /* The windows onboarding derives for a morning trainer. */
        mealWindows: [
          { id: "morning-anchor", label: "Morning Hydration / Light Fuel", time: "04:55", enabled: true },
          { id: "pre-workout", label: "Pre-Workout Meal", time: "05:00", enabled: true },
          { id: "post-workout", label: "Post-Workout Meal", time: "08:30", enabled: true },
          { id: "midday", label: "Midday Meal", time: "12:30", enabled: true },
          { id: "night", label: "Evening Recovery Meal", time: "20:00", enabled: false },
        ],
      };
      const steps: string[] = (s.setupProfile?.completedSteps ?? []).filter((step: string) => step !== "schedule");
      s.setupProfile = { ...s.setupProfile, setupComplete: true, completedAt: now.toISOString(), completedSteps: [...steps, "schedule"] };
      s.splitSystem = { ...(s.splitSystem || {}), key: "ppl-ul", source: "member", selectedAt: now.toISOString() };
      s.trainingOverrides = {};
      return JSON.stringify(parsed);
    },
    { k: KEY, iso: when.toISOString() },
  );
  await page.addInitScript(({ k, v }) => window.localStorage.setItem(k, v), { k: KEY, v: patched });
  await page.reload({ waitUntil: "domcontentloaded", timeout: 120_000 });
}

async function openView(page: Page, view: View) {
  await page.evaluate((v) => window.sessionStorage.setItem("e2e-view", v), view);
  await page.reload({ waitUntil: "domcontentloaded", timeout: 120_000 });
}

const nutritionTitle = (page: Page) => page.locator('[data-nutrition="action-title"]').filter({ visible: true }).first();
const scheduleTitle = (page: Page) => page.locator('[data-schedule="action-title"]').filter({ visible: true }).first();
const apexTitle = (page: Page) => page.locator('[data-apex="next-move-title"]').filter({ visible: true }).first();

/** The fuel log's rows as { time, text }, in order. */
async function fuelRows(page: Page) {
  const rows = page.locator("[data-meal-row]");
  await expect(rows.first()).toBeVisible({ timeout: 60_000 });
  return rows.evaluateAll((els) =>
    els.map((el) => ({ id: el.getAttribute("data-meal-row") ?? "", text: (el.textContent ?? "").replace(/\s+/g, " ").trim() })),
  );
}

function clockMinutes(text: string): number {
  const m = text.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!m) return -1;
  let h = parseInt(m[1], 10) % 12;
  if (m[3].toUpperCase() === "PM") h += 12;
  return h * 60 + parseInt(m[2], 10);
}

test.use({ viewport: { width: 1440, height: 1000 } });

test("an early fasted session: no meal before training, meal 1 at home, meals into the evening", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));

  await bootDay(page, BEFORE_SESSION, "nutrition");
  await expect(page.locator("main h1").filter({ visible: true }).first()).toHaveText(/nutrition command/i, { timeout: 60_000 });

  /* Before the session the next thing to eat is meal #1 at home, not breakfast at 5 AM. */
  await expect(nutritionTitle(page)).toHaveText("Next · Meal 1 · Post-Workout Breakfast at 9:00 AM", { timeout: 60_000 });

  const rows = await fuelRows(page);
  const beforeSession = rows.filter((r) => clockMinutes(r.text) >= 0 && clockMinutes(r.text) < 5 * 60 + 15);
  expect(beforeSession, "only the optional shake sits before the 5:15 session").toHaveLength(1);
  expect(beforeSession[0].text).toMatch(/optional pre-workout shake/i);
  expect(beforeSession[0].text).toMatch(/salted citrus water/i);

  const breakfast = rows.find((r) => /breakfast/i.test(r.text) && clockMinutes(r.text) >= 0)!;
  expect(clockMinutes(breakfast.text), "meal 1 lands at the 9:00 home time").toBe(9 * 60);

  /* The last timed row is in the evening, before the 8:45 PM sleep lock (9:30 PM less 45 min). */
  const timed = rows.filter((r) => clockMinutes(r.text) >= 0);
  const last = clockMinutes(timed[timed.length - 1].text);
  expect(last).toBeGreaterThanOrEqual(18 * 60 + 30);
  expect(last).toBeLessThanOrEqual(21 * 60 + 30 - 45);

  /* The shake is food only: open it and read the plate. */
  await page.locator(`[data-meal-row="${beforeSession[0].id}"] button[aria-haspopup="dialog"]`).first().click();
  const sheet = page.getByRole("dialog").filter({ hasText: /salted citrus water/i });
  await expect(sheet).toBeVisible();
  await expect(sheet).toContainText(/cold water/i);
  await expect(sheet).toContainText(/sea salt/i);
  await expect(sheet).not.toContainText(SUPPLEMENT_WORDS);
  /* A fixed food-only slot: nothing to swap into a plate. */
  await expect(sheet.getByRole("button", { name: /^swap$/i })).toHaveCount(0);

  expect(pageErrors.filter((e) => /hydrat/i.test(e))).toEqual([]);
});

test("Nutrition, Schedule and Apex agree: meal 1 is due when the member is home", async ({ page }) => {
  /* This one boots three rooms and reads all of them. Its individual waits are
     generous already; what ran out on CI was the TEST's own 30s budget, not any
     assertion — a two-core runner compiling routes beside two workers simply
     needs longer to do three boots. The other heavy specs here carry the same
     allowance. */
  test.setTimeout(240_000);
  await bootDay(page, HEADING_HOME, "nutrition");
  await expect(nutritionTitle(page)).toHaveText("Meal 1 · Post-Workout Breakfast is due · 9:00 AM", { timeout: 60_000 });
  await expect(page.locator('[data-nutrition="primary-action"] button').filter({ visible: true }).first()).toHaveText(
    /^log meal 1 · post-workout breakfast$/i,
  );

  await openView(page, "schedule-command");
  await expect(page.locator("main h1").filter({ visible: true }).first()).toHaveText(/schedule command/i, { timeout: 60_000 });
  await expect(scheduleTitle(page)).toHaveText("Meal 1 · Post-Workout Breakfast is due · 9:00 AM", { timeout: 60_000 });
  /* The meal window plan runs in the day's order and ends with dinner at 7:30 PM. */
  const plan = page.locator("h2", { hasText: /meal window plan/i }).locator("xpath=../..");
  await expect(plan).toContainText("Meal 1 · Post-Workout Breakfast");
  await expect(plan).toContainText("Dinner");
  await expect(plan).toContainText("7:30 PM");

  await openView(page, "dashboard");
  await expect(apexTitle(page)).toHaveText("Meal 1 · Post-Workout Breakfast", { timeout: 60_000 });
});
