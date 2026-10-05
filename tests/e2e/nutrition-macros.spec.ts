import { test, expect, type Page } from "@playwright/test";
import { goldActions } from "./support/gold-action";
import { BROAD_RULE, nestedSurfaces } from "./support/surface-nesting";

/**
 * NUTRITION · MACRO DIALS AND A VARIED DAY
 *
 * Seeds the owner's own nutrition profile (typos and all: "gress fed ribeye",
 * "thilapia", allergy "shell fish", batch prep, Peak Mode on with its kitchen
 * answers) and asserts:
 *
 *   · a fresh day shows the four targets on empty tracks — never zeros painted
 *     as progress — and says to log a meal
 *   · logged meals show logged vs target on Protein, Carbs, Fat and Calories,
 *     with what is left said plainly ("62 g to go", "On target", "12 g over")
 *   · confirming a meal advances the dials when the log moment lands, and
 *     under reduced motion they show the final values with nothing animating
 *   · the day's plates are varied: distinct dishes, no shellfish, not every
 *     plate lemon-herb
 *   · the bar: one h1, one gold action, the h1 and gold action inside the
 *     first screen, no surface inside a surface, no sideways scroll
 *   · phones (375 and 390): four dials in one row, inside the screen, clear of
 *     the tab bar
 *
 * Seeding is two-phase (see nutrition-room.spec.ts). The clock is shifted with
 * a Date-only shim, as in nutrition-moment.spec.ts, so the moment's motion runs.
 */

const KEY = "final-boss-athlete-settings";
/** Tuesday 15 September 2026, 1:05 PM local — a training day, lunch due. */
const WHEN = new Date(2026, 8, 15, 13, 5, 0);
const SHOTS = process.env.RESERVE_SHOTS_DIR ?? null;

const OWNER_PREFS = {
  dietStyle: "high-protein",
  prepPreference: "batch",
  dairyAllowed: true,
  allergies: ["shell fish"],
  favoriteProteinSources: ["gress fed ribeye", "ground beef (grass-fed)", "thilapia", "tuna", "chicken breast", "NY steak (grass-fed)", "pasture-raised eggs", "lean ground chicken"],
  favoriteCarbSources: ["jasmine rice", "gold russet potatoes"],
  peakLook: "lean-hard",
  peakKitchen: {
    proteins: ["chicken", "turkey", "ground-beef", "sirloin", "tilapia", "white-fish", "salmon"],
    carbs: ["basmati-rice", "gold-potato", "protein-pasta", "rice", "sweet-potato"],
    avoid: ["shellfish", "pork", "soy", "nuts", "gluten"],
    answeredAt: "2026-09-10T12:00:00.000Z",
  },
};

async function boot(page: Page, loggedSelector: (ids: string[]) => string[]): Promise<string[]> {
  await page.addInitScript((iso) => {
    const base = new Date(iso).getTime();
    const origin = performance.now();
    const RealDate = Date;
    class FixedDate extends RealDate {
      constructor(...args: ConstructorParameters<typeof Date> | []) {
        if (args.length === 0) super(base + (performance.now() - origin));
        else super(...(args as ConstructorParameters<typeof Date>));
      }
      static now() {
        return base + (performance.now() - origin);
      }
    }
    window.Date = FixedDate as DateConstructor;
  }, WHEN.toISOString());
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
      const state = JSON.parse(window.localStorage.getItem(k) ?? "{}")?.state;
      return Boolean(state?.recoveryCommand && state?.nutritionPrefs && state?.scheduleProfile && state?.setupProfile);
    },
    KEY,
    { timeout: 30_000 },
  );

  const patch = (logged: string[]) =>
    page.evaluate(
      ({ k, iso, logged, prefs }) => {
        const now = new Date(iso);
        const localKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
        const stamp = now.toISOString();
        const parsed = JSON.parse(window.localStorage.getItem(k) as string);
        const s = parsed.state;
        s.activeView = "nutrition";
        s.recoveryCommand = { ...s.recoveryCommand, hydrationTargetOz: 120, hydrationLogs: [] };
        s.nutritionPrefs = { ...s.nutritionPrefs, ...prefs, loggedMealIds: logged, latestMealLog: null, nutritionLogDate: localKey };
        s.scheduleProfile = { ...s.scheduleProfile, wakeTime: "06:30", sleepTarget: "22:30", trainingWindow: "evening", preferredTrainingStart: "17:30", preferredTrainingEnd: "19:00" };
        const steps: string[] = (s.setupProfile?.completedSteps ?? []).filter((step: string) => step !== "schedule");
        s.setupProfile = { ...s.setupProfile, setupComplete: true, completedAt: stamp, completedSteps: [...steps, "schedule"] };
        s.splitSystem = { ...(s.splitSystem || {}), key: "ppl-ul", source: "member", selectedAt: stamp };
        return JSON.stringify(parsed);
      },
      { k: KEY, iso: WHEN.toISOString(), logged, prefs: OWNER_PREFS },
    );

  /* Learn today's meal ids from the room itself, then seed which are logged. */
  const first = await patch([]);
  await page.addInitScript(({ k, v }) => window.localStorage.setItem(k, v), { k: KEY, v: first });
  await page.reload({ waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.locator("[data-meal-row]").first().waitFor({ timeout: 60_000 });
  const ids = await page.locator("[data-meal-row]").evaluateAll((els) => els.map((el) => el.getAttribute("data-meal-row") as string));
  expect(ids.length, "a planned meal day").toBeGreaterThanOrEqual(3);

  const seeded = await patch(loggedSelector(ids));
  await page.addInitScript(({ k, v }) => window.localStorage.setItem(k, v), { k: KEY, v: seeded });
  await page.reload({ waitUntil: "domcontentloaded", timeout: 120_000 });
  await expect(heroAction(page)).toBeVisible({ timeout: 60_000 });
  await page.waitForFunction(
    () => {
      const el = document.querySelector("[data-meal-row] [data-fuel='log-meal'] button");
      return Boolean(el && Object.keys(el).some((key) => key.startsWith("__reactProps")));
    },
    undefined,
    { timeout: 60_000 },
  );
  return ids;
}

const heroAction = (page: Page) => page.locator('[data-nutrition="primary-action"] button').filter({ visible: true }).first();
const dials = (page: Page) => page.locator('[data-nutrition="macros"] [data-macro]').filter({ visible: true });
const dial = (page: Page, key: "protein" | "carbs" | "fat" | "calories") => page.locator(`[data-nutrition="macros"] [data-macro="${key}"]`).filter({ visible: true }).first();
const shownNumber = async (page: Page, key: "protein" | "carbs" | "fat" | "calories") =>
  Number(((await dial(page, key).locator("[data-live-number]").textContent()) ?? "").replace(/,/g, ""));
const row = (page: Page, id: string) => page.locator(`[data-meal-row="${id}"]`).filter({ visible: true }).first();

/** The plan's estimate for one meal row: "42g protein" and "616 kcal". */
async function rowMacros(page: Page, id: string): Promise<{ protein: number; kcal: number }> {
  const text = (await row(page, id).textContent()) ?? "";
  return { protein: Number(/(\d+)g protein/.exec(text)?.[1]), kcal: Number(/(\d+) kcal/.exec(text)?.[1]) };
}

async function confirmMeal(page: Page, id: string) {
  await row(page, id).locator('[data-fuel="log-meal"] button').click();
  const drawer = page.getByRole("dialog", { name: /meal confirmation/i });
  await expect(drawer).toBeVisible();
  await drawer.getByRole("button", { name: /confirm log meal/i }).click();
  await drawer.getByRole("button", { name: /^done$/i }).click();
  await expect(drawer).toHaveCount(0, { timeout: 10_000 });
}

async function shoot(page: Page, name: string) {
  if (!SHOTS) return;
  await page.screenshot({ path: `${SHOTS}/${name}.png` });
  await page.locator('[data-nutrition="hero"]').filter({ visible: true }).first().screenshot({ path: `${SHOTS}/${name}-hero.png` });
}

test.describe("macro dials at 1440", () => {
  test.use({ viewport: { width: 1440, height: 1000 } });

  test("a fresh day shows the four targets on empty tracks, never zeros", async ({ page }) => {
    test.setTimeout(240_000);
    await boot(page, () => []);
    await expect(dials(page)).toHaveCount(4);
    for (const key of ["protein", "carbs", "fat", "calories"] as const) {
      await expect(dial(page, key)).toHaveAttribute("data-state", "empty");
      await expect(dial(page, key).locator("[data-ring-face]")).toContainText(/target/i);
      await expect(dial(page, key).locator("[data-ring-arc]")).toHaveCount(0);
    }
    await expect(page.locator('[data-nutrition="macros"] [data-macro-remaining]')).toHaveCount(0);
    await expect(page.locator('[data-nutrition="macros-caption"]').filter({ visible: true })).toContainText(/nothing logged yet today · log a meal/i);
    await expect(page.locator('[data-nutrition="protein"]').filter({ visible: true })).toContainText("0 of");
    await shoot(page, "desktop-fresh-day");
  });

  test("logged meals show logged vs target and what is left, plainly", async ({ page }) => {
    test.setTimeout(240_000);
    const ids = await boot(page, (all) => all.slice(0, 2));
    const a = await rowMacros(page, ids[0]);
    const b = await rowMacros(page, ids[1]);

    await expect.poll(() => shownNumber(page, "protein")).toBe(a.protein + b.protein);
    await expect.poll(() => shownNumber(page, "calories")).toBe(a.kcal + b.kcal);
    for (const key of ["protein", "carbs", "fat", "calories"] as const) {
      await expect(dial(page, key)).toHaveAttribute("data-state", /^(under|on-target|over)$/);
      await expect(dial(page, key).locator("[data-ring-face]")).toContainText(/of [\d,]+/);
      await expect(dial(page, key).locator("[data-macro-remaining]")).toHaveText(key === "calories" ? /^([\d,]+ to go|On target|[\d,]+ over)$/ : /^(\d+ g to go|On target|\d+ g over)$/);
      await expect(dial(page, key)).toHaveAttribute("aria-label", /estimated/i);
    }
    /* "to go" is the target minus what was logged. */
    const faceTarget = Number(((await dial(page, "protein").locator("[data-ring-face]").textContent()) ?? "").match(/of ([\d,]+)/)?.[1].replace(/,/g, ""));
    const left = faceTarget - (a.protein + b.protein);
    if (Math.abs(left) > Math.max(5, faceTarget * 0.05) && left > 0) await expect(dial(page, "protein").locator("[data-macro-remaining]")).toHaveText(`${left} g to go`);
    await expect(page.locator('[data-nutrition="macros-caption"]').filter({ visible: true })).toContainText(`2 of ${ids.length} meals logged · est.`);
    await shoot(page, "desktop-two-logged");
  });

  test("confirming a meal advances the dials when the light lands", async ({ page }) => {
    test.setTimeout(240_000);
    const ids = await boot(page, (all) => all.slice(0, 1));
    const before = await shownNumber(page, "protein");
    const beforeKcal = await shownNumber(page, "calories");
    const next = await rowMacros(page, ids[1]);

    await confirmMeal(page, ids[1]);
    await expect.poll(() => shownNumber(page, "protein"), { timeout: 10_000 }).toBe(before + next.protein);
    await expect.poll(() => shownNumber(page, "calories"), { timeout: 10_000 }).toBe(beforeKcal + next.kcal);
    await expect(page.locator('[data-nutrition="macros-caption"]').filter({ visible: true })).toContainText(`2 of ${ids.length}`);
    await shoot(page, "desktop-after-confirm");
  });

  test("the bar: one h1, one gold action, the fold, no card in a card, no gold dial", async ({ page }) => {
    test.setTimeout(240_000);
    await boot(page, (all) => all.slice(0, 2));
    await expectBar(page, 1000);
  });

  test("the day's plates are varied, with no shellfish and not every plate lemon-herb", async ({ page }) => {
    test.setTimeout(240_000);
    await boot(page, () => []);
    const names = await page.locator("[data-meal-row]").filter({ visible: true }).evaluateAll((els) =>
      els.map((el) => el.querySelector(".truncate")?.textContent ?? "").filter(Boolean),
    );
    expect(names.length).toBeGreaterThanOrEqual(3);
    expect(new Set(names).size, "no dish twice in a day").toBe(names.length);
    for (const name of names) expect(name).not.toMatch(/shrimp|scallop|prawn|lobster|crab/i);
    expect(names.filter((n) => /lemon-herb/i.test(n)).length, "not every plate lemon-herb").toBeLessThanOrEqual(1);
    expect(names.filter((n) => /salmon/i.test(n)).length, "not salmon at every turn").toBeLessThanOrEqual(1);
  });
});

test.describe("macro dials · reduced motion", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("a confirmed meal shows the final values at once, with nothing animating in the dials", async ({ page }) => {
    test.setTimeout(240_000);
    await page.emulateMedia({ reducedMotion: "reduce" });
    const ids = await boot(page, (all) => all.slice(0, 1));
    const before = await shownNumber(page, "protein");
    const next = await rowMacros(page, ids[1]);
    await confirmMeal(page, ids[1]);
    await expect.poll(() => shownNumber(page, "protein"), { timeout: 3_000 }).toBe(before + next.protein);
    const running = await page.evaluate(() =>
      document.getAnimations().filter((a) => {
        const target = (a.effect as KeyframeEffect | null)?.target;
        return a.playState === "running" && target instanceof Element && Boolean(target.closest('[data-nutrition="macros"]'));
      }).length,
    );
    expect(running, "no animation inside the dials").toBe(0);
  });
});

for (const vp of [{ width: 375, height: 812 }, { width: 390, height: 844 }]) {
  test.describe(`phone fit at ${vp.width}`, () => {
    test.use({ viewport: vp, hasTouch: true, isMobile: true });

    test("four dials in one row, inside the screen and clear of the tab bar", async ({ page }) => {
      test.setTimeout(240_000);
      await boot(page, (all) => all.slice(0, 2));
      await expect(dials(page)).toHaveCount(4);
      const boxes = await Promise.all((["protein", "carbs", "fat", "calories"] as const).map(async (k) => (await dial(page, k).boundingBox())!));
      const top = boxes[0].y;
      for (const box of boxes) {
        expect(Math.abs(box.y - top), "one row").toBeLessThanOrEqual(2);
        expect(box.x, "inside the screen").toBeGreaterThanOrEqual(0);
        expect(box.x + box.width, "inside the screen").toBeLessThanOrEqual(vp.width + 1);
      }
      /* Each remaining line fits its dial: nothing truncated. */
      const clipped = await page.locator('[data-nutrition="macros"] [data-macro-remaining]').evaluateAll((els) => els.filter((el) => el.scrollWidth > el.clientWidth + 1).length);
      expect(clipped, "no remaining line cut off").toBe(0);
      const tabBar = await page.locator('[data-shell="bottom-stack"]').boundingBox();
      if (tabBar) for (const box of boxes) expect(box.y + box.height, "clear of the tab bar").toBeLessThanOrEqual(tabBar.y + 1);
      await expectBar(page, vp.height);
      await shoot(page, `phone-${vp.width}-two-logged`);
    });
  });
}

async function expectBar(page: Page, height: number) {
  await expect(page.locator("h1").filter({ visible: true }), "one h1").toHaveCount(1);
  for (const locator of [page.locator("main h1").filter({ visible: true }).first(), heroAction(page)]) {
    const box = await locator.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height, "inside the first screen").toBeLessThanOrEqual(height);
  }
  expect((await goldActions(page, { selector: "button", match: "text" })).length, "exactly one gold action").toBe(1);
  expect(await nestedSurfaces(page.locator('[data-nutrition="macros"]').filter({ visible: true }).first(), BROAD_RULE), "the dials sit on the hero").toEqual([]);
  /* The dials are strokes on a track, never a gold fill. */
  const fills = await page.locator('[data-nutrition="macros"] [data-ring-arc]').evaluateAll((els) => els.map((el) => getComputedStyle(el).fill));
  for (const fill of fills) expect(fill).toBe("none");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, "no sideways scroll").toBeLessThanOrEqual(1);
}
