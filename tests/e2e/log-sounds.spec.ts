import { test, expect, type Page } from "@playwright/test";
import { attributeValuesSeen, watchAttribute } from "./support/transient";

/**
 * LOG SOUNDS — a log lands with a tone, from the member's own gesture.
 *
 *   · sleep (full): a thump at impact, then the chord when the light lands
 *   · a glass of water (mark): one tick
 *   · the Settings switch off: the moment plays, nothing sounds
 *   · reduced motion: one sound, at once
 *
 * The engine records every cue it plays on <html data-log-sound>, so the
 * suite reads what sounded without a microphone. Chromium runs with
 * autoplay allowed, so the gesture gate is open here.
 */

const KEY = "final-boss-athlete-settings";

async function boot(page: Page, view: string, sound = true) {
  await page.addInitScript(
    ({ k, v, sound }) => {
      window.localStorage.setItem("fba-preview-view", v);
      /* Version 1: a device that has already chosen. Version 0 is handed the sounds back. */
      window.localStorage.setItem("fba-log-sound", JSON.stringify({ state: { enabled: sound, throughSilent: false }, version: 1 }));
      const raw = window.localStorage.getItem(k);
      const parsed = raw ? JSON.parse(raw) : { state: {}, version: 0 };
      parsed.state = {
        ...parsed.state,
        onboarding: { ...(parsed.state.onboarding || {}), status: "complete", currentStep: 99, startedAt: "2026-09-01T12:00:00.000Z" },
      };
      window.localStorage.setItem(k, JSON.stringify(parsed));
    },
    { k: KEY, v: view, sound },
  );
  await page.goto("/", { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.locator("main h1").first().waitFor({ timeout: 120_000 });
  await page.waitForFunction(
    (k) => {
      const raw = window.localStorage.getItem(k);
      const state = raw ? JSON.parse(raw).state : null;
      return Boolean(state?.recoveryCommand && state?.engagement);
    },
    KEY,
    { timeout: 60_000 },
  );
  const seeded = await page.evaluate(
    ({ k, v }) => {
      const pad = (n: number) => String(n).padStart(2, "0");
      const day = (offset: number) => {
        const d = new Date();
        d.setDate(d.getDate() + offset);
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      };
      const parsed = JSON.parse(window.localStorage.getItem(k) as string);
      parsed.state.activeView = v;
      parsed.state.recoveryCommand = {
        ...parsed.state.recoveryCommand,
        sleepTargetHours: 8,
        hydrationTargetOz: 120,
        sleepLogs: [1, 2, 3, 4].map((d) => ({ date: day(-d), hours: 7.2 })),
        hydrationLogs: [],
        mobilityLogs: [],
        stressCheckIns: [],
      };
      return JSON.stringify(parsed);
    },
    { k: KEY, v: view },
  );
  await page.addInitScript(({ k, v }) => window.localStorage.setItem(k, v), { k: KEY, v: seeded });
  await page.reload({ waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.locator("main h1").first().waitFor({ timeout: 120_000 });
}

async function wired(page: Page, locator: ReturnType<Page["locator"]>) {
  await expect(locator).toBeVisible({ timeout: 60_000 });
  await expect
    .poll(() => locator.evaluate((el) => Object.keys(el).some((key) => key.startsWith("__reactProps"))), { timeout: 60_000 })
    .toBe(true);
}

async function logSleep(page: Page) {
  const asleep = page.getByRole("slider", { name: /Fell asleep/ });
  await asleep.waitFor({ timeout: 120_000 });
  await asleep.scrollIntoViewIfNeeded();
  await asleep.fill("270");
  await page.getByRole("slider", { name: /Woke up/ }).fill("240");
  const save = page.getByRole("button", { name: "Save Sleep" });
  await wired(page, save);
  await save.click();
}

const sounded = (page: Page) => page.locator("html");
const count = (page: Page) => page.evaluate(() => Number(document.documentElement.dataset.logSoundCount ?? 0));

test.describe("log sounds", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("sleep: a thump at impact, then the chord when the light lands", async ({ page }) => {
    test.setTimeout(240_000);
    await boot(page, "recovery");
    await logSleep(page);
    await expect(page.locator('[data-log-moment="status"]')).toHaveAttribute("data-kind", "sleep");
    await expect(sounded(page)).toHaveAttribute("data-log-sound", "thump", { timeout: 5_000 });
    await expect(sounded(page)).toHaveAttribute("data-log-sound", "chord", { timeout: 5_000 });
    expect(await count(page)).toBe(2);
  });

  test("a glass of water: one tick", async ({ page }) => {
    test.setTimeout(240_000);
    await boot(page, "recovery");
    const glass = page.getByRole("button", { name: /^\+ log 16 oz$/i }).filter({ visible: true }).first();
    await glass.scrollIntoViewIfNeeded();
    await wired(page, glass);
    await glass.click();
    await expect(page.locator('[data-log-moment="status"]')).toHaveAttribute("data-kind", "water");
    await expect(sounded(page)).toHaveAttribute("data-log-sound", "tick", { timeout: 5_000 });
    await page.waitForTimeout(1_200);
    expect(await count(page)).toBe(1);
  });

  test("the switch off: the moment plays, nothing sounds", async ({ page }) => {
    test.setTimeout(240_000);
    await boot(page, "recovery", false);
    await logSleep(page);
    await expect(page.locator('[data-log-moment="status"]')).toHaveAttribute("data-kind", "sleep");
    await page.waitForTimeout(1_500);
    expect(await count(page)).toBe(0);
    await expect(sounded(page)).not.toHaveAttribute("data-log-sound", /.+/);
  });

  test("reduced motion: the landing sounds once, at once", async ({ page }) => {
    test.setTimeout(240_000);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await boot(page, "recovery");
    await logSleep(page);
    await expect(sounded(page)).toHaveAttribute("data-log-sound", "chord", { timeout: 5_000 });
    await page.waitForTimeout(1_200);
    expect(await count(page)).toBe(1);
  });

  test("moving to another room plays the room swell, not a tap", async ({ page }) => {
    test.setTimeout(240_000);
    await boot(page, "recovery");
    const nav = page.getByRole("button", { name: /Training Command/ }).filter({ visible: true }).first();
    await wired(page, nav);
    await nav.click();
    await expect(sounded(page)).toHaveAttribute("data-log-sound", "ui-room", { timeout: 5_000 });
    expect(await count(page)).toBe(1);
  });

  test("a switch sounds its new state; turning Sound off is the last thing heard", async ({ page }) => {
    test.setTimeout(240_000);
    await boot(page, "settings");
    const notifications = page.getByRole("switch", { name: "Notifications" }).or(page.getByRole("checkbox", { name: "Notifications" })).first();
    await wired(page, notifications);
    const wasOn = (await notifications.getAttribute("aria-checked")) === "true";
    await notifications.click();
    await expect(sounded(page)).toHaveAttribute("data-log-sound", wasOn ? "ui-toggle-off" : "ui-toggle-on", { timeout: 5_000 });
    const heard = await count(page);
    const sound = page.getByRole("switch", { name: "Sound" }).or(page.getByRole("checkbox", { name: "Sound" })).first();
    await sound.click();
    await page.waitForTimeout(500);
    expect(await count(page), "turning sound off is silent").toBe(heard);
  });

  test("a phone: a touch tap unlocks sound, and the log lands with it", async ({ browser }) => {
    test.setTimeout(240_000);
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    await boot(page, "recovery");
    const glass = page.getByRole("button", { name: /^\+ log 16 oz$/i }).filter({ visible: true }).first();
    await glass.scrollIntoViewIfNeeded();
    await wired(page, glass);
    await glass.tap();
    await expect(sounded(page)).toHaveAttribute("data-log-sound", "tick", { timeout: 5_000 });
    await context.close();
  });

  test("Test sound plays a chord and says what the browser did", async ({ page }) => {
    test.setTimeout(240_000);
    await boot(page, "settings");
    const button = page.getByRole("button", { name: "Test sound" });
    await wired(page, button);
    /* data-log-sound names the sound that just played, so it holds only the
       LAST one — and the UI's own tap can land after the chord. Asserting its
       current value asks "what played most recently" rather than "did the
       chord play", and the order of those two is not fixed on a loaded
       machine. Recorded from before the click instead. */
    await watchAttribute(page, "html", "data-log-sound");
    await button.click();
    await expect
      .poll(() => attributeValuesSeen(page, "html", "data-log-sound"), { timeout: 10_000, message: "the chord played" })
      .toContain("ui-room");
    await expect(page.locator('[data-settings="sound-result"]')).toContainText("Sound is playing from this page");
  });

  test("the Settings switch is real, and remembered on this device", async ({ page }) => {
    test.setTimeout(240_000);
    await boot(page, "settings");
    const toggle = page.getByRole("switch", { name: "Sound" }).or(page.getByRole("checkbox", { name: "Sound" })).first();
    await wired(page, toggle);
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    await expect
      .poll(() => page.evaluate(() => JSON.parse(window.localStorage.getItem("fba-log-sound") ?? "{}").state?.enabled))
      .toBe(false);
  });
});
