import { test, expect, type Locator, type Page } from "@playwright/test";

import { SAFETY_ACK_VERSION } from "../../src/lib/safety/acknowledgement";

/**
 * EVERY FORM KEEPS WHAT WAS TYPED.
 *
 * Owner report: a click outside a form closed it and lost the entry. The rule,
 * app wide (PR #50 fixed Compound Command; this sweep covers the rest):
 *
 *   · an outside click never closes a form the member has changed
 *   · Escape (and X / Cancel) asks first: "Discard what you entered?" with
 *     Keep Editing and Discard; an untouched form closes at once
 *   · on a phone, dragging a changed bottom sheet down asks first too
 *
 * Covered here at 1280 and 390: the meal confirmation drawer, Measurements,
 * a women's sheet (Cycle dates), the cycle check-in, the week rail's day
 * editor, the observation sheet, and Adjust Today (a read-only sheet: it
 * still closes on an outside click).
 * All records are synthetic.
 */

const KEY = "final-boss-athlete-settings";
/** Tuesday 15 September 2026, 4:12 PM local — the pre-workout meal window is due. */
const AFTERNOON = new Date(2026, 8, 15, 16, 12, 0);

const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 900 },
  { name: "phone", width: 390, height: 844 },
] as const;

const discardBar = (page: Page) => page.getByRole("alertdialog", { name: "Discard unsaved changes" });

/**
 * A bottom sheet slides in, and its content can still arrive after that. A
 * bottom-anchored sheet that grows moves its own header UP, so a handle box
 * measured too early sent the press a hundred pixels below the header: the
 * sheet never saw the gesture, and a different form failed each run.
 *
 * One pair of matching samples was not enough — the observation sheet settled,
 * grew again, and settled a second time. Hold out for several in a row.
 */
const SETTLED_SAMPLES = 4;

/**
 * A sheet whose form lives in a child reports dirty back up through an effect,
 * so the guard is armed a render after the typing. A member could never close
 * a form inside that window; a test can, and did — the sheet closed on an
 * outside click with the change still in it. Give the report its frame.
 */
async function guardArmed(page: Page) {
  await page.waitForTimeout(100);
}

async function settledBox(page: Page, locator: Locator) {
  let last = await locator.boundingBox();
  let stable = 0;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    await page.waitForTimeout(50);
    const next = await locator.boundingBox();
    const same = last && next && Math.abs(next.y - last.y) < 0.5 && Math.abs(next.height - last.height) < 0.5;
    stable = same ? stable + 1 : 0;
    last = next;
    if (stable >= SETTLED_SAMPLES) return next!;
  }
  return last!;
}

function localKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return localKey(date);
}

/* ── Boots ─────────────────────────────────────────────────────────────── */

async function bootWith(page: Page, view: string, extra: Record<string, unknown>) {
  await page.addInitScript(
    ({ k, v, state }) => {
      window.localStorage.setItem("fba-preview-view", v);
      if (!window.localStorage.getItem(k)) {
        window.localStorage.setItem(
          k,
          JSON.stringify({
            state: {
              ...state,
              subscriptionTier: "elite",
              onboarding: { status: "complete", currentStep: 99, startedAt: new Date().toISOString() },
            },
            version: 0,
          }),
        );
      }
    },
    { k: KEY, v: view, state: extra },
  );
  await page.goto("/", { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.locator("main").waitFor({ state: "visible", timeout: 120_000 });
}

function cycleMember() {
  const stamp = new Date().toISOString();
  const entry = { doseUnit: "mg", timingPreference: "", goalAssociation: [], isActive: true, createdAt: stamp, updatedAt: stamp };
  return {
    safetyAcknowledgement: { acknowledgedAt: stamp, version: SAFETY_ACK_VERSION, adultConfirmedAt: stamp },
    trainingSession: {
      enhancementLog: [
        { ...entry, id: "fg-test", name: "Testosterone Cypionate", officialName: "Testosterone Cypionate", compoundClass: "hormones_testosterone", category: "hormone", doseAmount: "", frequency: "", startDate: daysAgo(70) },
      ],
    },
    cyclePeriods: [
      { id: "fg-cycle", name: "Fall cycle", startDate: daysAgo(70), plannedWeeks: 16, compoundIds: ["fg-test"], clinicianOversight: false, checkpoints: [], createdAt: stamp, updatedAt: stamp },
    ],
    cycleGoals: { "fg-cycle": { primaryGoal: "lean-mass", priorities: [], compoundPurposes: {}, updatedAt: stamp } },
  };
}

/** Nutrition at 4:12 PM with water logged, so the gold action is the pre-workout meal. */
async function bootNutrition(page: Page) {
  await page.clock.setFixedTime(AFTERNOON);
  await page.addInitScript((k) => {
    window.localStorage.setItem("fba-preview-view", "nutrition");
    const raw = window.localStorage.getItem(k);
    const parsed = raw ? JSON.parse(raw) : { state: {}, version: 0 };
    parsed.state = {
      ...parsed.state,
      onboarding: { ...(parsed.state.onboarding || {}), status: "complete", currentStep: 99, startedAt: "2026-09-01T12:00:00.000Z" },
    };
    window.localStorage.setItem(k, JSON.stringify(parsed));
  }, KEY);
  await page.goto("/", { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.locator("main h1").first().waitFor({ timeout: 120_000 });
  await page.waitForFunction(
    (k) => {
      const raw = window.localStorage.getItem(k);
      const state = raw ? JSON.parse(raw).state : null;
      return Boolean(state?.recoveryCommand && state?.nutritionPrefs && state?.scheduleProfile);
    },
    KEY,
    { timeout: 30_000 },
  );
  const patched = await page.evaluate(
    ({ k, iso }) => {
      const now = new Date(iso);
      const day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const parsed = JSON.parse(window.localStorage.getItem(k) as string);
      const s = parsed.state;
      s.recoveryCommand = { ...s.recoveryCommand, hydrationLogs: [{ date: now.toISOString().slice(0, 10), oz: 64 }] };
      s.nutritionPrefs = { ...s.nutritionPrefs, loggedMealIds: [], latestMealLog: null, nutritionLogDate: day };
      s.scheduleProfile = { ...s.scheduleProfile, wakeTime: "06:30", sleepTarget: "22:30", trainingWindow: "evening", preferredTrainingStart: "17:30", preferredTrainingEnd: "19:00" };
      s.setupProfile = { ...s.setupProfile, setupComplete: true, completedAt: now.toISOString() };
      s.splitSystem = { ...(s.splitSystem || {}), key: "ppl-ul", source: "member", selectedAt: now.toISOString() };
      return JSON.stringify(parsed);
    },
    { k: KEY, iso: AFTERNOON.toISOString() },
  );
  await page.addInitScript(({ k, v }) => window.localStorage.setItem(k, v), { k: KEY, v: patched });
  await page.reload({ waitUntil: "domcontentloaded", timeout: 120_000 });
  await expect(page.locator('[data-nutrition="primary-action"] button').filter({ visible: true }).first()).toBeVisible({ timeout: 60_000 });
}

/** Apex on a training day, where the timeline carries Adjust Today. */
async function bootApex(page: Page) {
  await page.clock.setFixedTime(AFTERNOON);
  await page.addInitScript((k) => {
    window.localStorage.setItem("fba-preview-view", "dashboard");
    const raw = window.localStorage.getItem(k);
    const parsed = raw ? JSON.parse(raw) : { state: {}, version: 0 };
    parsed.state = {
      ...parsed.state,
      onboarding: { ...(parsed.state.onboarding || {}), status: "complete", currentStep: 99, startedAt: "2026-09-01T12:00:00.000Z" },
      setupProfile: { ...(parsed.state.setupProfile || {}), setupComplete: true, completedAt: "2026-09-01T12:00:00.000Z" },
    };
    window.localStorage.setItem(k, JSON.stringify(parsed));
  }, KEY);
  await page.goto("/", { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.locator("main h1").first().waitFor({ timeout: 120_000 });
}

/* ── The guard contract ───────────────────────────────────────────────── */

type GuardedForm = {
  name: string;
  boot: (page: Page) => Promise<void>;
  open: (page: Page) => Promise<Locator>;
  /** Changes one field and returns it with the value it now holds. */
  change: (dialog: Locator) => Promise<{ field: Locator; value: string }>;
  /** A bottom sheet (drag-to-dismiss on phones). */
  sheet: boolean;
};

/** Clicks a point outside the dialog, if the dialog leaves one (a phone drawer can fill the screen). */
async function clickOutside(page: Page, dialog: Locator): Promise<boolean> {
  const box = (await dialog.boundingBox())!;
  const viewport = page.viewportSize()!;
  const points = [
    { x: 6, y: 6 },
    { x: viewport.width - 6, y: 6 },
    { x: 6, y: viewport.height / 2 },
  ];
  const outside = points.find((p) => p.x < box.x || p.x > box.x + box.width || p.y < box.y || p.y > box.y + box.height);
  if (!outside) return false;
  await page.mouse.click(outside.x, outside.y);
  return true;
}

const FORMS: GuardedForm[] = [
  {
    name: "meal confirmation drawer",
    boot: bootNutrition,
    open: async (page) => {
      await page.locator('[data-nutrition="primary-action"] button').filter({ visible: true }).first().dispatchEvent("click");
      const drawer = page.getByRole("dialog", { name: "Meal confirmation" });
      await expect(drawer).toBeVisible();
      return drawer;
    },
    change: async (dialog) => {
      const field = dialog.locator('input[type="time"]');
      await field.fill("15:05");
      return { field, value: "15:05" };
    },
    sheet: false,
  },
  {
    name: "measurements",
    boot: (page) => bootWith(page, "measurements", {}),
    open: async (page) => {
      const sheet = page.getByRole("dialog", { name: "Log measurements" });
      /* The record renders before hydration; retry the tap until the handler is live. */
      await expect(async () => {
        await page.getByRole("button", { name: "Log Measurements" }).filter({ visible: true }).first().click({ timeout: 10_000 });
        await expect(sheet).toBeVisible({ timeout: 2_000 });
      }).toPass({ timeout: 120_000 });
      return sheet;
    },
    change: async (dialog) => {
      const field = dialog.getByPlaceholder("e.g. 185.2");
      await field.fill("182.4");
      return { field, value: "182.4" };
    },
    sheet: true,
  },
  {
    name: "women's cycle dates",
    boot: async (page) => {
      await page.clock.setFixedTime(AFTERNOON);
      await bootWith(page, "womens-cycle", { womens: { enabled: true }, setupProfile: { setupComplete: true, completedAt: "2026-09-01T12:00:00.000Z", completedSteps: [] } });
      await expect(page.locator('[data-record="womens-cycle"]').first()).toBeVisible({ timeout: 120_000 });
    },
    open: async (page) => {
      await page.locator("main [data-record-action] button").first().click();
      const sheet = page.getByRole("dialog", { name: "Cycle dates" });
      await expect(sheet).toBeVisible();
      return sheet;
    },
    change: async (dialog) => {
      const field = dialog.locator('input[type="date"]');
      await field.fill("2026-09-07");
      return { field, value: "2026-09-07" };
    },
    sheet: true,
  },
  {
    name: "cycle check-in",
    boot: async (page) => {
      await bootWith(page, "supplements", cycleMember());
      await page.getByRole("tab", { name: "Cycle & Safety", exact: true }).click({ timeout: 120_000 });
      await page.getByRole("button", { name: "Review my cycle" }).click({ timeout: 60_000 });
      await expect(page.getByRole("heading", { name: "Lean mass", exact: true })).toBeVisible({ timeout: 60_000 });
    },
    open: async (page) => {
      await page.getByRole("button", { name: "Log this week's check-in" }).click();
      const sheet = page.getByRole("dialog", { name: "Weekly check-in" });
      await expect(sheet).toBeVisible();
      return sheet;
    },
    change: async (dialog) => {
      const field = dialog.getByLabel("Systolic");
      await field.fill("128");
      return { field, value: "128" };
    },
    sheet: true,
  },
  {
    /* ReserveWeekRail's day inspector holds DayEditor; the sheet takes `dirty`
       from it (useReportDirty). Wednesday is ahead of the fixed Tuesday and in
       the rail at both widths (all seven on desktop, a three-day window on phones). */
    name: "week rail day editor",
    boot: bootApex,
    open: async (page) => {
      const wednesday = page.getByRole("button", { name: /^Wed · .*Open details\.$/ }).filter({ visible: true }).first();
      await wednesday.scrollIntoViewIfNeeded();
      const sheet = page.getByRole("dialog", { name: /^Wed · / });
      await expect(async () => {
        await wednesday.click({ timeout: 10_000 });
        await expect(sheet).toBeVisible({ timeout: 2_000 });
      }).toPass({ timeout: 120_000 });
      return sheet;
    },
    change: async (dialog) => {
      await dialog.getByRole("group", { name: "Activities" }).getByRole("button").first().click();
      const field = dialog.getByLabel("Minutes");
      await field.fill("45");
      return { field, value: "45" };
    },
    sheet: true,
  },
  {
    name: "observation sheet",
    boot: async (page) => {
      await bootWith(page, "supplements", cycleMember());
      await page.getByRole("tab", { name: "More", exact: true }).click({ timeout: 120_000 });
      await page.getByRole("button", { name: /^Timeline/ }).click({ timeout: 60_000 });
      await expect(page.getByRole("button", { name: "Add observation" })).toBeVisible({ timeout: 60_000 });
    },
    open: async (page) => {
      await page.getByRole("button", { name: "Add observation" }).click();
      const sheet = page.getByRole("dialog", { name: "Add an observation" });
      await expect(sheet).toBeVisible();
      return sheet;
    },
    change: async (dialog) => {
      const field = dialog.getByLabel("Note (optional)");
      await field.fill("Slept better after moving training earlier.");
      return { field, value: "Slept better after moving training earlier." };
    },
    sheet: true,
  },
];

for (const viewport of VIEWPORTS) {
  test.describe(`forms keep what was typed (${viewport.name})`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });
    test.setTimeout(300_000);

    for (const form of FORMS) {
      test(`${form.name}: outside click keeps it, Escape asks, Keep Editing keeps, Discard closes`, async ({ page }) => {
        await form.boot(page);
        let dialog = await form.open(page);
        const { field, value } = await form.change(dialog);
        await guardArmed(page);

        if (await clickOutside(page, dialog)) {
          await page.waitForTimeout(300);
          await expect(dialog).toBeVisible();
          await expect(field).toHaveValue(value);
        }

        await page.keyboard.press("Escape");
        await expect(discardBar(page)).toBeVisible();
        await expect(discardBar(page).getByRole("button", { name: "Keep Editing" })).toBeFocused();
        await discardBar(page).getByRole("button", { name: "Keep Editing" }).click();
        await expect(discardBar(page)).toHaveCount(0);
        await expect(dialog).toBeVisible();
        await expect(field).toHaveValue(value);

        await page.keyboard.press("Escape");
        await discardBar(page).getByRole("button", { name: "Discard" }).click();
        await expect(dialog).toHaveCount(0);

        /* Untouched, it closes at once. */
        dialog = await form.open(page);
        await page.keyboard.press("Escape");
        await expect(dialog).toHaveCount(0);
        await expect(discardBar(page)).toHaveCount(0);
      });

      if (viewport.name === "phone" && form.sheet) {
        test(`${form.name}: dragging a changed sheet down asks first`, async ({ page }) => {
          await form.boot(page);
          const dialog = await form.open(page);
          const { field, value } = await form.change(dialog);
          await guardArmed(page);

          const handle = dialog.locator("[data-sheet-drag]");
          const box = (await settledBox(page, handle))!;
          const x = box.x + box.width / 2;
          const y = box.y + box.height / 2;
          await page.mouse.move(x, y);
          await page.mouse.down();
          /* `steps` dispatches every move in one go, and the sheet reads a drag
             across frames. One move per frame is the same drag, seen. */
          for (let step = 1; step <= 12; step += 1) {
            await page.mouse.move(x, y + (360 * step) / 12);
            await page.waitForTimeout(16);
          }
          await page.mouse.up();

          await expect(discardBar(page)).toBeVisible();
          await page.waitForTimeout(500);
          await expect(dialog).toBeVisible();
          await expect(field).toHaveValue(value);
          /* It sprang back rather than leaving: the handle is no lower than where
             the drag began (the discard bar can only make the sheet taller). */
          const after = (await settledBox(page, handle))!;
          expect(after.y).toBeLessThanOrEqual(box.y + 8);
        });
      }
    }

    test("lab intake keeps the draft when hidden, and Cancel asks before discarding it", async ({ page }) => {
      await bootWith(page, "bloodwork", {});
      const sheet = page.getByRole("dialog", { name: "New lab record" });
      await expect(async () => {
        await page.getByRole("button", { name: "New Lab Record" }).filter({ visible: true }).first().click({ timeout: 10_000 });
        await expect(sheet).toBeVisible({ timeout: 2_000 });
      }).toPass({ timeout: 120_000 });
      const notes = sheet.getByPlaceholder(/Fasted draw/);
      await notes.fill("Morning draw");

      /* Escape hides it and keeps the draft (the intake's own rule). */
      await page.keyboard.press("Escape");
      await expect(sheet).toHaveCount(0);
      await page.getByRole("button", { name: "New Lab Record" }).filter({ visible: true }).first().click();
      await expect(notes).toHaveValue("Morning draw");

      /* Cancel discards, so it asks. */
      await sheet.getByRole("button", { name: "Cancel", exact: true }).last().click();
      await expect(discardBar(page)).toBeVisible();
      await discardBar(page).getByRole("button", { name: "Keep Editing" }).click();
      await expect(notes).toHaveValue("Morning draw");
      await sheet.getByRole("button", { name: "Cancel", exact: true }).last().click();
      await discardBar(page).getByRole("button", { name: "Discard" }).click();
      await expect(sheet).toHaveCount(0);
      await page.getByRole("button", { name: "New Lab Record" }).filter({ visible: true }).first().click();
      await expect(notes).toHaveValue("");
    });

    test("Adjust Today is read-only: it still closes on an outside click and on Escape", async ({ page }) => {
      test.skip(viewport.name === "phone", "The day timeline that carries Adjust Today is a desktop surface.");
      await bootApex(page);
      const adjust = page.getByRole("button", { name: "Adjust Today" }).filter({ visible: true }).first();
      await adjust.scrollIntoViewIfNeeded({ timeout: 120_000 });
      await adjust.click();
      const sheet = page.getByRole("dialog", { name: "Adjust Today" });
      await expect(sheet).toBeVisible();
      expect(await clickOutside(page, sheet)).toBe(true);
      await expect(sheet).toHaveCount(0);

      await adjust.click();
      await expect(sheet).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(sheet).toHaveCount(0);
      await expect(discardBar(page)).toHaveCount(0);
    });
  });
}
