import { test, expect, type Locator, type Page } from "@playwright/test";

import { settleAnimations } from "./support/settle";

/**
 * PHONE FEEL — how the daily path behaves in the hand, not only whether it fits.
 *
 * At 390×844 with touch, iPhone safe areas (47px top, 34px home indicator) emulated
 * through CDP, and an iOS-style keyboard: the visual viewport shrinks, the layout
 * viewport does not, exactly as Safari opens the keys over a page.
 *
 *   · a sheet rides above the keyboard: the Log Set logger's Reps field and Log Set
 *     button, and the measurements sheet's last field and Save, stay above the keys
 *   · the measurement fields carry keyboard hints (next / done)
 *   · the meal confirmation drawer clears the status bar and the home indicator, its
 *     controls are 44px, and its time field is 16px so iOS does not zoom on focus
 *   · the close-out sheet's last choice clears the home indicator and is 44px
 *   · the tab bar pads the home indicator; Apex's gold action and the live Log Set
 *     sit in the thumb zone (the lower 40% of the screen)
 *   · Recovery's quick logs (+ Log 16 oz, the mobility reset) take a 44px tap
 *   · a moment's plate lands without shifting the room
 */

const KEY = "final-boss-athlete-settings";
/** Tuesday 15 September 2026, 4:12 PM local — a Pull day for a PPL + Upper/Lower member. */
const WHEN = new Date(2026, 8, 15, 16, 12, 0);
const W = 390;
const H = 844;
const SAFE = { top: 47, bottom: 34 };
const KEYBOARD = 336;

type Patch = (s: Record<string, any>, day: (offset: number) => string) => void; // eslint-disable-line @typescript-eslint/no-explicit-any

/** An on-screen keyboard the test can open: only the visual viewport shrinks. */
function installKeyboard() {
  const real = window.visualViewport;
  if (!real) return;
  const events = new EventTarget();
  let keyboard = 0;
  real.addEventListener("resize", () => events.dispatchEvent(new Event("resize")));
  real.addEventListener("scroll", () => events.dispatchEvent(new Event("scroll")));
  const fake = {
    addEventListener: events.addEventListener.bind(events),
    removeEventListener: events.removeEventListener.bind(events),
    dispatchEvent: events.dispatchEvent.bind(events),
    get height() { return real.height - keyboard; },
    get width() { return real.width; },
    get offsetTop() { return real.offsetTop; },
    get offsetLeft() { return real.offsetLeft; },
    get pageTop() { return real.pageTop; },
    get pageLeft() { return real.pageLeft; },
    get scale() { return real.scale; },
  };
  Object.defineProperty(window, "visualViewport", { configurable: true, get: () => fake });
  (window as unknown as { __keyboard: (px: number) => void }).__keyboard = (px: number) => {
    keyboard = px;
    events.dispatchEvent(new Event("resize"));
  };
}

async function boot(page: Page, view: string, patch: Patch = () => {}, { fixedClock = false } = {}) {
  if (fixedClock) await page.clock.setFixedTime(WHEN);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setSafeAreaInsetsOverride", { insets: SAFE });
  await page.addInitScript(installKeyboard);
  await page.addInitScript(
    ({ k, v }) => {
      window.localStorage.setItem("fba-preview-view", v);
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
      const s = raw ? JSON.parse(raw).state : null;
      return Boolean(s?.recoveryCommand && s?.physiqueCommand && s?.nutritionPrefs && s?.scheduleProfile && s?.setupProfile && s?.trainingSession);
    },
    KEY,
    { timeout: 60_000 },
  );
  const seeded = await page.evaluate(
    ({ k, v, src }) => {
      const pad = (n: number) => String(n).padStart(2, "0");
      const day = (offset: number) => {
        const d = new Date();
        d.setDate(d.getDate() + offset);
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      };
      const parsed = JSON.parse(window.localStorage.getItem(k) as string);
      const s = parsed.state;
      const stamp = new Date().toISOString();
      s.activeView = v;
      s.subscriptionTier = "elite";
      const steps: string[] = (s.setupProfile?.completedSteps ?? []).filter((step: string) => step !== "schedule");
      s.setupProfile = { ...s.setupProfile, setupComplete: true, completedAt: stamp, completedSteps: [...steps, "schedule"] };
      s.scheduleProfile = { ...s.scheduleProfile, wakeTime: "06:30", sleepTarget: "22:30", trainingWindow: "evening", preferredTrainingStart: "17:30", preferredTrainingEnd: "19:00" };
      s.splitSystem = { ...(s.splitSystem || {}), key: "ppl-ul", source: "member", selectedAt: stamp };
      new Function("s", "day", `(${src})(s, day);`)(s, day);
      return JSON.stringify(parsed);
    },
    { k: KEY, v: view, src: patch.toString() },
  );
  await page.addInitScript(({ k, v }) => window.localStorage.setItem(k, v), { k: KEY, v: seeded });
  await page.reload({ waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.locator("main h1").filter({ visible: true }).first().waitFor({ timeout: 120_000 });
  /* The dev server's own indicator floats over the bottom-left corner. It does not exist in production. */
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  return cdp;
}

/** Wait until React has wired a control, so the first tap is not lost to hydration. */
async function wired(locator: Locator) {
  await expect(locator).toBeVisible({ timeout: 60_000 });
  await expect
    .poll(() => locator.evaluate((el) => Object.keys(el).some((key) => key.startsWith("__reactProps"))), { timeout: 60_000 })
    .toBe(true);
}

const openKeyboard = (page: Page, px: number) =>
  page.evaluate((n) => (window as unknown as { __keyboard: (px: number) => void }).__keyboard(n), px);

async function box(locator: Locator) {
  const b = await locator.boundingBox();
  expect(b, "element has a box").not.toBeNull();
  return { top: b!.y, bottom: b!.y + b!.height, height: b!.height, width: b!.width, centreY: b!.y + b!.height / 2 };
}

/** Above the keyboard, and under the status bar's clear line. */
async function expectAboveKeyboard(page: Page, locator: Locator, what: string) {
  await expect
    .poll(async () => (await box(locator)).bottom, { message: `${what} clears the keyboard`, timeout: 5_000 })
    .toBeLessThanOrEqual(H - KEYBOARD + 1);
  expect((await box(locator)).top, `${what} is on screen`).toBeGreaterThanOrEqual(0);
}

async function enterLive(page: Page) {
  const start = page.locator('[data-training="primary-action"] button').filter({ visible: true });
  await wired(start.first());
  await expect(async () => {
    await start.first().tap();
    await expect(page.getByRole("heading", { name: "Pre-Session Command" })).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 60_000 });
  await expect(async () => {
    await start.first().tap();
    await expect(page.locator("#training-cockpit")).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 60_000 });
}

test.describe("phone feel at 390x844", () => {
  test.use({ viewport: { width: W, height: H }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 });

  test("the tab bar pads the home indicator and Apex's gold action sits in the thumb zone", async ({ page }) => {
    await boot(page, "dashboard");
    const bar = page.locator('nav[data-shell="tab-bar"]');
    await expect(bar).toBeVisible({ timeout: 60_000 });
    expect(await bar.evaluate((el) => getComputedStyle(el).paddingBottom), "tab bar pads the home indicator").toBe(`${SAFE.bottom}px`);
    for (const tab of await bar.getByRole("button").all()) {
      expect((await box(tab)).bottom, "tab clears the home indicator").toBeLessThanOrEqual(H - SAFE.bottom + 1);
    }
    const top = await box(page.locator("header").first());
    expect(top.top).toBe(0);
    const gold = page.locator("#reserve-slot-dock button").first();
    await expect(gold).toBeVisible({ timeout: 60_000 });
    expect((await box(gold)).centreY, "Apex's gold action is in the thumb zone").toBeGreaterThanOrEqual(H * 0.6);
  });

  test("Log Set: the logger rides above the keyboard, then close-out clears the home indicator", async ({ page }) => {
    test.setTimeout(240_000);
    await boot(page, "training", () => {}, { fixedClock: true });
    await enterLive(page);

    const cockpit = page.locator("#training-cockpit");
    const logSet = cockpit.getByRole("button", { name: /^Log Set \d+ of \d+$/ });
    await wired(logSet);
    expect((await box(logSet)).centreY, "Log Set is in the thumb zone").toBeGreaterThanOrEqual(H * 0.6);
    /* The sticky gold rides 8px above the tab bar — the bar already carries the
       home indicator, so counting the inset twice pushed it a thumb's width up. */
    const clearance = await page.evaluate(() => {
      const action = document.querySelector('[data-training="log-set"]')!.getBoundingClientRect();
      const stack = document.querySelector('[data-shell="bottom-stack"]')!.getBoundingClientRect();
      return Math.round(stack.top - action.bottom);
    });
    expect(clearance, "Log Set clears the tab bar without counting the home indicator twice").toBeGreaterThanOrEqual(0);
    expect(clearance).toBeLessThanOrEqual(12);
    await logSet.tap();

    const logger = page.getByRole("dialog", { name: /^Log set · / });
    await expect(logger).toBeVisible();
    const reps = logger.getByRole("textbox", { name: "Reps" });
    const logButton = logger.getByRole("button", { name: /^Log Set$/ });
    await expect(reps).toHaveAttribute("inputmode", "numeric");
    /* The sheet slides up; a box read mid-slide belongs to the animation. */
    await settleAnimations(page);
    expect((await box(logButton)).bottom, "Log Set clears the home indicator").toBeLessThanOrEqual(H - SAFE.bottom + 1);

    /* Before the keys: both sit low in the sheet, where a keyboard would cover them. */
    expect((await box(logButton)).bottom).toBeGreaterThan(H - KEYBOARD);
    await reps.tap();
    await reps.fill("10");
    await openKeyboard(page, KEYBOARD);
    await expectAboveKeyboard(page, logButton, "Log Set");
    await expectAboveKeyboard(page, reps, "the Reps field");
    const sheetTop = await logger.evaluate((el) => el.getBoundingClientRect().top);
    expect(sheetTop, "the sheet stays under the status bar's clear line").toBeGreaterThanOrEqual(0);

    /* Keys down: the sheet settles back to the bottom. */
    await openKeyboard(page, 0);
    await expect.poll(async () => (await box(logButton)).bottom, { timeout: 5_000 }).toBeGreaterThan(H - KEYBOARD);
    await logButton.tap();
    await expect(logger).toHaveCount(0);

    const end = cockpit.getByRole("button", { name: /^End Workout$/ });
    await end.tap();
    const closeout = page.getByRole("dialog", { name: "Close out session" });
    await expect(closeout).toBeVisible();
    await page.waitForTimeout(500);
    for (const button of await closeout.getByRole("button").all()) {
      const b = await box(button);
      expect(b.bottom, "close-out choice clears the home indicator").toBeLessThanOrEqual(H - SAFE.bottom + 1);
      expect(Math.round(b.height), "close-out choice is a 44px target").toBeGreaterThanOrEqual(44);
    }
  });

  test("measurements: the last field and Save stay above the keyboard, and the fields hint the keys", async ({ page }) => {
    await boot(page, "measurements", (s, day) => {
      s.physiqueCommand = { ...s.physiqueCommand, entries: [{ id: "seed-1", date: day(-7), bodyWeightLb: 190.4, measurements: { waist: 33 } }], photoCheckIns: [] };
    });
    const open = page.getByRole("button", { name: "Log Measurements" }).filter({ visible: true }).first();
    await wired(open);
    await open.tap();
    const sheet = page.getByRole("dialog", { name: "Log measurements" });
    await expect(sheet).toBeVisible();

    const weight = sheet.getByPlaceholder("e.g. 185.2");
    await expect(weight).toHaveAttribute("enterkeyhint", "next");
    await expect(weight).toHaveAttribute("inputmode", "decimal");
    const notes = sheet.getByPlaceholder(/Conditions, hydration/);
    await expect(notes).toHaveAttribute("enterkeyhint", "done");
    const save = sheet.getByRole("button", { name: "Save Check-In" });

    await weight.tap();
    await weight.fill("188.1");
    await notes.tap();
    await openKeyboard(page, KEYBOARD);
    await expectAboveKeyboard(page, notes, "the Notes field");
    await expectAboveKeyboard(page, save, "Save Check-In");
    const header = await box(sheet.getByRole("button", { name: "Close" }).first());
    expect(header.top, "the sheet's close control clears the status bar").toBeGreaterThanOrEqual(SAFE.top - 1);

    /* A layout-viewport resize (Android's resizes-content) keeps the field in view too. */
    await openKeyboard(page, 0);
    await page.setViewportSize({ width: W, height: H - KEYBOARD });
    await expect.poll(async () => (await box(notes)).bottom, { timeout: 5_000 }).toBeLessThanOrEqual(H - KEYBOARD + 1);
    await expect.poll(async () => (await box(save)).bottom, { timeout: 5_000 }).toBeLessThanOrEqual(H - KEYBOARD + 1);
  });

  test("the meal confirmation drawer clears the status bar and home indicator, with 44px controls and a 16px time field", async ({ page }) => {
    await boot(page, "nutrition", (s, day) => {
      s.nutritionPrefs = { ...s.nutritionPrefs, loggedMealIds: [], latestMealLog: null, nutritionLogDate: day(0) };
    }, { fixedClock: true });
    const rowLog = page.locator('[data-fuel="log-meal"] button').filter({ visible: true }).first();
    await wired(rowLog);
    await rowLog.scrollIntoViewIfNeeded();
    await rowLog.tap();
    const drawer = page.getByRole("dialog", { name: /meal confirmation/i });
    await expect(drawer).toBeVisible();
    await page.waitForTimeout(500);

    const expectClear = async (phase: string) => {
      for (const button of await drawer.getByRole("button").filter({ visible: true }).all()) {
        const b = await box(button);
        const name = (await button.getAttribute("aria-label")) || (await button.innerText());
        expect(b.top, `${phase}: ${name} clears the status bar`).toBeGreaterThanOrEqual(SAFE.top - 1);
        expect(b.bottom, `${phase}: ${name} clears the home indicator`).toBeLessThanOrEqual(H - SAFE.bottom + 1);
        expect(Math.round(b.height), `${phase}: ${name} is a 44px target`).toBeGreaterThanOrEqual(44);
      }
    };
    await expectClear("confirm");
    const time = drawer.locator('input[type="time"]');
    expect(await time.evaluate((el) => parseFloat(getComputedStyle(el).fontSize)), "no iOS focus zoom").toBeGreaterThanOrEqual(16);
    expect(Math.round((await box(time)).height)).toBeGreaterThanOrEqual(44);

    await drawer.getByRole("button", { name: /confirm log meal/i }).tap();
    await expect(drawer.getByRole("button", { name: /^done$/i })).toBeVisible();
    await expectClear("logged");
  });

  test("Recovery's quick logs take a 44px tap, and the moment's plate shifts nothing", async ({ page }) => {
    await boot(page, "recovery", (s, day) => {
      s.recoveryCommand = {
        ...s.recoveryCommand,
        sleepTargetHours: 8,
        hydrationTargetOz: 120,
        sleepLogs: [1, 2, 3, 4].map((d) => ({ date: day(-d), hours: 7.2 })),
        hydrationLogs: [{ date: day(0), oz: 32 }],
        mobilityLogs: [],
        stressCheckIns: [],
      };
    });
    const water = page.getByRole("button", { name: /^\+ log 16 oz$/i }).filter({ visible: true }).first();
    /* Mobility Command folded into Recovery detail when the room was cut back,
       so its log button sits behind a closed disclosure — out of reach for a tap
       and out of the accessibility tree for a name. Open it first. */
    await page.locator("summary", { hasText: /recovery detail/i }).first().click();
    const reset = page.getByRole("button", { name: /^\+ log .*reset/i }).filter({ visible: true }).first();
    for (const [name, control] of [["+ Log 16 oz", water], ["mobility reset", reset]] as const) {
      await control.evaluate((el) => el.scrollIntoView({ block: "center", behavior: "instant" }));
      await page.waitForTimeout(300);
      const hits = await control.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const x = r.left + r.width / 2;
        const middle = r.top + r.height / 2;
        const probe = (y: number) => {
          const hit = document.elementFromPoint(x, y);
          return Boolean(hit && (hit === el || el.contains(hit)));
        };
        return { up: probe(middle - 21), down: probe(middle + 21) };
      });
      expect(hits, `${name} answers a tap across 44px`).toEqual({ up: true, down: true });
    }

    await wired(water);
    await water.scrollIntoViewIfNeeded();
    await page.evaluate(() => {
      const w = window as unknown as { __shift: number };
      w.__shift = 0;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as Array<PerformanceEntry & { value: number; hadRecentInput: boolean }>) {
          if (!entry.hadRecentInput) w.__shift += entry.value;
        }
      }).observe({ type: "layout-shift" });
    });
    await water.tap();
    await expect(page.locator('[data-log-moment="status"]')).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(2_000);
    const shift = await page.evaluate(() => (window as unknown as { __shift: number }).__shift);
    expect(shift, "layout shift while the moment lands").toBeLessThan(0.01);
  });
});
