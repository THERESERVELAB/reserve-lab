import { test, expect, type Page } from "@playwright/test";
import { goldActions } from "./support/gold-action";
import { BROAD_RULE, nestedSurfaces } from "./support/surface-nesting";

/**
 * APEX · TODAY'S SCORES — the dials, the system row and the day's line.
 *
 *   · the dials read the member's own values: readiness equals the statement's
 *     "N% ready", sleep is the hours logged, fuel is empty until a meal is logged
 *   · each dial opens a sheet that says what it is made of ("derived", "est.")
 *   · a fresh member sees honest empty dials — prompts, never a zero
 *   · a meal logged here lands on the Fuel dial: it holds, then fills
 *   · reduced motion shows the final arcs at once, with nothing animating
 *   · one gold action, no surface inside a surface, and the phone fits
 */

const KEY = "final-boss-athlete-settings";
/** Tuesday 15 September 2026, 4:12 PM local — the pre-workout meal window is due. */
const WHEN = new Date(2026, 8, 15, 16, 12, 0);

type Seed = "active" | "fresh";

async function boot(page: Page, seed: Seed) {
  await page.clock.setFixedTime(WHEN);
  await page.addInitScript((k) => {
    window.localStorage.setItem("fba-preview-view", "dashboard");
    const raw = window.localStorage.getItem(k);
    const parsed = raw ? JSON.parse(raw) : { state: {}, version: 0 };
    parsed.state = {
      ...parsed.state,
      onboarding: { ...(parsed.state.onboarding || {}), status: "complete", currentStep: 99, startedAt: "2026-09-01T12:00:00.000Z" },
    };
    window.localStorage.setItem(k, JSON.stringify(parsed));
  }, KEY);

  /* `domcontentloaded`: the dev server's HMR socket keeps networkidle from settling. */
  await page.goto("/", { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.locator("main h1").first().waitFor({ timeout: 120_000 });
  await page.waitForFunction((k) => Boolean(JSON.parse(window.localStorage.getItem(k) ?? "{}").state?.recoveryCommand), KEY, { timeout: 30_000 });

  const patched = await page.evaluate(
    ({ k, iso, seed }) => {
      const now = new Date(iso);
      const dayKey = (offset: number) => {
        const d = new Date(now);
        d.setDate(d.getDate() - offset);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      };
      const parsed = JSON.parse(window.localStorage.getItem(k) as string);
      const s = parsed.state;
      s.scheduleProfile = { ...s.scheduleProfile, wakeTime: "06:30", sleepTarget: "22:30", trainingWindow: "evening", preferredTrainingStart: "17:30", preferredTrainingEnd: "19:00" };
      s.setupProfile = { ...s.setupProfile, setupComplete: true, completedAt: now.toISOString() };
      s.splitSystem = { ...(s.splitSystem || {}), key: "ppl-ul", source: "member", selectedAt: now.toISOString() };
      s.nutritionPrefs = { ...s.nutritionPrefs, loggedMealIds: [], latestMealLog: null, nutritionLogDate: dayKey(0) };
      s.recoveryCommand =
        seed === "active"
          ? {
              ...s.recoveryCommand,
              sleepTargetHours: 8,
              /* Oldest first; the last is last night (dated this morning). */
              sleepLogs: [7.2, 6.8, 7.6, 8.1, 7.0, 7.9, 7.4].map((hours, i) => ({ date: dayKey(6 - i), hours })),
              hydrationLogs: [{ date: dayKey(0), oz: 64 }],
              stressCheckIns: [{ date: dayKey(0), stress: 2, energy: 4, mood: 4 }],
            }
          : { ...s.recoveryCommand, sleepLogs: [], hydrationLogs: [], mobilityLogs: [], stressCheckIns: [] };
      return JSON.stringify(parsed);
    },
    { k: KEY, iso: WHEN.toISOString(), seed },
  );
  await page.addInitScript(({ k, v }) => window.localStorage.setItem(k, v), { k: KEY, v: patched });
  await page.reload({ waitUntil: "domcontentloaded", timeout: 120_000 });
  await expect(page.locator('[data-apex="next-move-title"]').filter({ visible: true }).first()).toBeVisible({ timeout: 60_000 });
  await expect(page.locator("[data-day-scores]")).toHaveAttribute("data-arrival", /^(draw|still)$/, { timeout: 30_000 });
}

const dial = (page: Page, id: "readiness" | "sleep" | "fuel") => page.locator(`[data-day-ring="${id}"]`).filter({ visible: true }).first();
const face = (page: Page, id: "readiness" | "sleep" | "fuel") => dial(page, id).locator("[data-ring-face]");

const VIEWPORTS = [
  { name: "1280", width: 1280, height: 900, touch: false },
  { name: "390", width: 390, height: 844, touch: true },
] as const;

for (const vp of VIEWPORTS) {
  test.describe(`today's scores at ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.touch, isMobile: vp.touch });

    test("the dials read the member's own values, and each opens what it is made of", async ({ page }) => {
      test.setTimeout(240_000);
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await boot(page, "active");

      /* Readiness is the same derived number the statement reads. */
      const command = await page.locator("main h1 + p").first().innerText();
      const ready = /You are (\d+)% ready/.exec(command)?.[1];
      expect(ready, "the statement names a readiness").toBeTruthy();
      await expect(face(page, "readiness")).toContainText(ready!);
      await expect(face(page, "readiness")).toContainText("derived");
      /* Last night, 7.4 h, logged this morning. */
      await expect(face(page, "sleep")).toContainText("7.4");
      await expect(dial(page, "sleep")).toHaveAttribute("aria-label", /Sleep 7\.4 hours, last night, against your 8 hour target: close/);
      /* No meal logged yet: an empty dial that asks, never "0 g". */
      await expect(dial(page, "fuel")).toHaveAttribute("data-empty", "");
      await expect(face(page, "fuel")).toHaveText(/log meal/i);

      /* The row answers the systems the dials do not. */
      const systems = page.locator('[data-apex="systems"] li').filter({ visible: true });
      await expect(systems).toHaveText([/Training\s*Staged/, /Recovery\s*\w+/, /Hydration\s*Behind/, /Schedule\s*\w+/]);
      await expect(page.locator('[data-apex="motivation"]').filter({ visible: true })).toHaveText(/\S/);

      for (const [id, words] of [
        ["readiness", /Derived from your own recovery logs[\s\S]*not a health reading/],
        ["sleep", /7\.4 h against your 8 h target/],
        ["fuel", /Est\. 0 of \d+ g protein/],
      ] as const) {
        await dial(page, id).click();
        const sheet = page.getByRole("dialog", { name: new RegExp(`^${id}$`, "i") });
        await expect(sheet, `${id} opens its sheet`).toBeVisible();
        await expect(sheet).toContainText(words);
        await expect(sheet.getByRole("button", { name: /open|log sleep/i }).last()).toBeVisible();
        expect((await goldActions(sheet, { selector: "button", match: "either" })).length, `${id} sheet has no gold action`).toBe(0);
        await page.keyboard.press("Escape");
        await expect(sheet).toHaveCount(0);
      }

      /* The bar: one h1, one gold action, no surface inside a surface, named 44px dials. */
      await expect(page.locator("h1").filter({ visible: true })).toHaveCount(1);
      expect(await goldActions(page, { selector: "button", match: "either" }), `one gold action at ${vp.name}`).toHaveLength(1);
      expect(await nestedSurfaces(page.locator("[data-day-scores]").first(), BROAD_RULE), "the instrument sits on the hero").toEqual([]);
      for (const id of ["readiness", "sleep", "fuel"] as const) {
        const box = await dial(page, id).boundingBox();
        expect(box!.height, `${id} target height`).toBeGreaterThanOrEqual(44);
        expect(box!.width, `${id} target width`).toBeGreaterThanOrEqual(44);
      }
      expect(errors).toEqual([]);
    });

    test("a fresh member sees honest empty dials, never a zero", async ({ page }) => {
      test.setTimeout(240_000);
      await boot(page, "fresh");
      for (const [id, prompt] of [["readiness", /check in/i], ["sleep", /log sleep/i], ["fuel", /log meal/i]] as const) {
        await expect(dial(page, id), `${id} is empty`).toHaveAttribute("data-empty", "");
        await expect(face(page, id)).toContainText(prompt);
        /* No number on screen: the numeral waits, hidden, for the first log. */
        await expect(face(page, id).locator("[data-live-number]")).toBeHidden();
        expect(await face(page, id).evaluate((el) => (el as HTMLElement).innerText)).not.toMatch(/\d/);
        await expect(dial(page, id).locator("[data-ring-arc]")).toHaveCount(0);
      }
      await expect(page.locator('[data-apex="systems"] [data-system="recovery"]').filter({ visible: true })).toContainText("No data");
      await expect(page.locator('[data-apex="systems"] [data-system="hydration"]').filter({ visible: true })).toContainText("No log");

      await dial(page, "readiness").click();
      const sheet = page.getByRole("dialog", { name: /^readiness$/i });
      await expect(sheet).toContainText("Evidence needed");
      await expect(sheet).toContainText(/never counted as zero/);
    });
  });
}

test.describe("a log lands on its dial", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("the Fuel dial holds while the light travels, then fills", async ({ page }) => {
    test.setTimeout(240_000);
    await boot(page, "active");
    await expect(dial(page, "fuel")).toHaveAttribute("data-empty", "");

    await page.getByRole("button", { name: /^log meal$/i }).filter({ visible: true }).first().click();
    const drawer = page.getByRole("dialog", { name: /meal confirmation/i });
    await drawer.getByRole("button", { name: /confirm log meal/i }).click();
    /* The confirmation still covers the room: the dial has not moved yet. */
    await expect(dial(page, "fuel")).toHaveAttribute("data-empty", "");
    await drawer.getByRole("button", { name: /^done/i }).click();

    /* The moment fires and travels: the dial holds its old reading… */
    await expect(page.locator('[data-log-moment="overlay"]')).toHaveAttribute("data-kind", "meal");
    await expect(dial(page, "fuel")).toHaveAttribute("data-empty", "");
    /* …then takes the new one when the light lands. */
    await expect(dial(page, "fuel")).not.toHaveAttribute("data-empty", "", { timeout: 5_000 });
    await expect(dial(page, "fuel")).toHaveAttribute("aria-label", /Fuel, estimated: \d+ of \d+ grams of protein from 1 of \d+ meals logged/);
    await expect(face(page, "fuel")).toContainText("est.");
  });
});

test.describe("reduced motion", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("the dials show their final values at once, and nothing animates", async ({ page }) => {
    test.setTimeout(240_000);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await boot(page, "active");
    await expect(page.locator("[data-day-scores]")).toHaveAttribute("data-arrival", "still");
    const state = await page.evaluate(() => {
      const arcs = [...document.querySelectorAll<SVGCircleElement>("[data-day-scores] [data-ring-arc]")];
      return {
        arcs: arcs.map((arc) => ({ attr: Number(arc.getAttribute("stroke-dashoffset")), computed: parseFloat(getComputedStyle(arc).strokeDashoffset) })),
        running: document.getAnimations().filter((a) => {
          const target = (a.effect as KeyframeEffect | null)?.target;
          return target instanceof Element && Boolean(target.closest("[data-day-scores]"));
        }).length,
      };
    });
    expect(state.arcs.length).toBeGreaterThan(0);
    for (const arc of state.arcs) expect(arc.computed, "each arc is drawn to its value").toBeCloseTo(arc.attr, 1);
    expect(state.running, "no animation inside the instrument").toBe(0);
    await expect(face(page, "sleep")).toContainText("7.4");
  });
});

test.describe("phone fit", () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });

  test("three dials in one row at 375, clear of the docked action", async ({ page }) => {
    test.setTimeout(240_000);
    await boot(page, "active");
    const boxes = await Promise.all((["readiness", "sleep", "fuel"] as const).map(async (id) => (await dial(page, id).boundingBox())!));
    expect(Math.max(...boxes.map((b) => b.y)) - Math.min(...boxes.map((b) => b.y)), "one row").toBeLessThanOrEqual(1);
    /* Inside the page's own gutter, the one the statement sits on. */
    const gutter = (await page.locator("main h1").first().boundingBox())!.x;
    for (const b of boxes) {
      expect(b.x).toBeGreaterThanOrEqual(gutter - 1);
      expect(b.x + b.width).toBeLessThanOrEqual(375 - gutter + 1);
    }
    const bar = await page.locator(".fba-so-action").filter({ visible: true }).first().boundingBox();
    const systems = await page.locator('[data-apex="systems"]').filter({ visible: true }).first().boundingBox();
    expect(bar).not.toBeNull();
    expect(systems!.y + systems!.height, "the instrument clears the docked action").toBeLessThanOrEqual(bar!.y);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
