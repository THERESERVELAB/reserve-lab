import { test, expect, type Page } from "@playwright/test";
import { BORDERED_PANEL_RULE, surfaceReport } from "./support/surface-nesting";

/**
 * PHONE ROOMS — the five living rooms at 390×844 (DESIGN_BIBLE.md §06 / §11,
 * reserve-design-constitution components.md rules 1 and 4, typography.md).
 *
 * Seeds a training-day member at a fixed clock and, in each room, asserts:
 *
 *   · one big headline: the room's statement (`data-room-statement`) is larger
 *     than the page h1, which is a title line on phones. On Apex the h1 IS the
 *     statement, and there is no page title above it.
 *   · no bordered, rounded panel sits inside another bordered, rounded panel
 *     in the room's first two sections — measured from computed border and
 *     radius, not from class names. Controls (buttons, inputs) are not panels.
 *   · horizon items are still 44px controls, and where they open a sheet,
 *     they still open it and it closes on Escape.
 *
 * Sections are the page's own children, in order, after the page header. A
 * container marked `data-room-sections` (the Pit Wall, the Recovery stack) is
 * a stack of sections itself, so its children count instead.
 */

const KEY = "final-boss-athlete-settings";
/** Tuesday 15 September 2026, 4:12 PM local — a Pull day, the pre-workout meal due. */
const WHEN = new Date(2026, 8, 15, 16, 12, 0);

type Room = {
  name: string;
  view: string;
  /** The horizon's phone list. */
  horizon: string;
  /** Its rows open a sheet. Training's rows go straight to their section. */
  sheet: boolean;
  /** Present only once this room, not another, has rendered. */
  ready: string;
};

const ROOMS: Room[] = [
  { name: "Apex", view: "dashboard", horizon: '[data-apex="now-spine"]', sheet: true, ready: '[data-apex="next-move-title"]' },
  { name: "Training", view: "training", horizon: '[data-training="horizon"]', sheet: false, ready: '[data-training="hero"]' },
  { name: "Nutrition", view: "nutrition", horizon: '[data-nutrition="horizon"]', sheet: true, ready: '[data-nutrition="hero"]' },
  { name: "Recovery", view: "recovery", horizon: '[data-recovery="horizon"]', sheet: true, ready: '[data-recovery="hero"]' },
  { name: "Schedule", view: "schedule-command", horizon: '[data-schedule="horizon"]', sheet: true, ready: '[data-schedule="hero"]' },
];

async function bootRoom(page: Page, { view, ready }: Pick<Room, "view" | "ready">) {
  await page.clock.setFixedTime(WHEN);
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
      const state = raw ? JSON.parse(raw).state : null;
      return Boolean(state?.recoveryCommand && state?.nutritionPrefs && state?.scheduleProfile && state?.setupProfile);
    },
    KEY,
    { timeout: 30_000 },
  );

  /* Two-phase seed, as in the room specs: the patch lands before the app boots on reload. */
  const patched = await page.evaluate(
    ({ k, iso, v }) => {
      const now = new Date(iso);
      const dayKey = (offset: number) => {
        const d = new Date(now);
        d.setDate(d.getDate() - offset);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      };
      const parsed = JSON.parse(window.localStorage.getItem(k) as string);
      const s = parsed.state;
      /* The snapshot can carry the view the first load settled on; the room under test wins. */
      s.activeView = v;
      s.recoveryCommand = {
        ...s.recoveryCommand,
        sleepLogs: [7.2, 6.8, 7.6, 8.1, 7.0, 7.9, 7.4].map((hours, i) => ({ date: dayKey(7 - i), hours })),
        hydrationLogs: [{ date: dayKey(0), oz: 64 }],
        stressCheckIns: [{ date: dayKey(0), stress: 2, energy: 4, mood: 4 }],
      };
      s.nutritionPrefs = { ...s.nutritionPrefs, loggedMealIds: [], latestMealLog: null, nutritionLogDate: dayKey(0) };
      s.scheduleProfile = {
        ...s.scheduleProfile,
        wakeTime: "06:30",
        sleepTarget: "22:30",
        trainingWindow: "evening",
        preferredTrainingStart: "17:30",
        preferredTrainingEnd: "19:00",
      };
      const steps: string[] = (s.setupProfile?.completedSteps ?? []).filter((step: string) => step !== "schedule");
      s.setupProfile = { ...s.setupProfile, setupComplete: true, completedAt: now.toISOString(), completedSteps: [...steps, "schedule"] };
      s.splitSystem = { ...(s.splitSystem || {}), key: "ppl-ul", source: "member", selectedAt: now.toISOString() };
      return JSON.stringify(parsed);
    },
    { k: KEY, iso: WHEN.toISOString(), v: view },
  );
  await page.addInitScript(({ k, v }) => window.localStorage.setItem(k, v), { k: KEY, v: patched });
  await page.reload({ waitUntil: "domcontentloaded", timeout: 120_000 });

  await expect(page.locator(ready).filter({ visible: true }).first(), `the ${view} room rendered`).toBeVisible({ timeout: 60_000 });
  await expect(page.locator("main [data-room-statement]").filter({ visible: true }).first()).toBeVisible({ timeout: 60_000 });
}

test.describe("the five rooms on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  for (const room of ROOMS) {
    test(`${room.name}: one headline, no card in a card, and the horizon still opens`, async ({ page }) => {
      test.setTimeout(180_000);
      await bootRoom(page, room);
      const horizon = page.locator(room.horizon).filter({ visible: true }).first();
      /* The real clock has mounted: the room shows the seeded minute, not the server reference. */
      await expect(page.locator("main")).toContainText("4:12 PM", { timeout: 60_000 });

      /* ── One big headline ─────────────────────────────────────────── */
      await expect(page.locator("h1").filter({ visible: true }), "one h1").toHaveCount(1);
      const type = await page.evaluate(() => {
        const visible = (el: Element) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        };
        const h1 = [...document.querySelectorAll("main h1")].find(visible) ?? null;
        const statement = [...document.querySelectorAll("main [data-room-statement]")].find(visible) ?? null;
        const px = (el: Element | null) => (el ? parseFloat(getComputedStyle(el).fontSize) : null);
        const name = (el: Element | null) =>
          el ? `${el.tagName.toLowerCase()} "${(el.textContent ?? "").trim().slice(0, 32)}" [${el.getAttribute("class") ?? ""}]` : "none";
        return {
          h1: px(h1),
          statement: px(statement),
          same: h1 !== null && h1 === statement,
          width: `${window.innerWidth}/${document.documentElement.scrollWidth}`,
          detail: `h1 ${name(h1)} · statement ${name(statement)}`,
        };
      });
      expect(type.width, "the layout is phone width, with no sideways overflow").toBe("390/390");
      expect(type.h1, "the page has an h1").not.toBeNull();
      expect(type.statement, "the room has a statement").not.toBeNull();
      if (room.name === "Apex") {
        expect(type.same, "on Apex the h1 is the statement").toBe(true);
      } else {
        expect(type.statement!, `the statement outranks the title line · ${type.detail}`).toBeGreaterThan(type.h1!);
        expect(type.h1!, "the h1 is a title line on phones").toBeLessThanOrEqual(22);
      }

      /* ── No card in a card in the first two sections ──────────────── */
      const nesting = await surfaceReport(page, BORDERED_PANEL_RULE, { sections: 2, classes: 4 });
      expect(nesting.sections, "found the first two sections").toBe(2);
      expect(nesting.offenders, "bordered rounded panels nested in the first two sections").toEqual([]);

      /* ── The horizon still opens ──────────────────────────────────── */
      await expect(horizon).toBeVisible();
      const rows = horizon.locator(room.sheet ? 'ol button[aria-haspopup="dialog"]' : "ol button").filter({ visible: true });
      await expect(rows.first()).toBeVisible({ timeout: 30_000 });
      for (const row of await rows.all()) {
        const box = await row.boundingBox();
        // Rounded: a transformed control can measure a hair under 44 CSS px.
        expect(Math.round(box!.height), "44px hit area").toBeGreaterThanOrEqual(44);
      }
      if (room.sheet) {
        await rows.first().click();
        const sheet = page.getByRole("dialog");
        await expect(sheet).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(sheet).toHaveCount(0);
      }
    });
  }
});
