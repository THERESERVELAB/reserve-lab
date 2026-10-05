import { test, expect, type Locator, type Page } from "@playwright/test";
import { BROAD_RULE, nestedSurfaces as findNestedSurfaces } from "./support/surface-nesting";
import { goldActions as findGoldActions } from "./support/gold-action";

/**
 * WAVE: APEX + RECOVERY — the clean-up that brings Apex and Recovery to the
 * strict bar, and closes the form-guard gaps the #57 sweep could not reach.
 *
 *   · Apex at 1280, 1440 and 390: exactly one gold action by BOTH detections
 *     (near-black primary text, and a gold background fill — "Mark Done" in
 *     the Weekly Challenge used to be a second gold fill), and zero buttons
 *     without an accessible name
 *   · Recovery at 1280 and 390: no surface inside another under the broad rule
 *     (border OR fill OR shadow), with its disclosures closed AND open, and
 *     zero unnamed buttons
 *   · Training: a set being entered survives an outside click, and Escape asks
 *     before discarding it; the live flow still reaches the review, and the
 *     session save still fires the ambient signal
 *   · the week rail's day inspector: a picked change survives an outside click
 *
 * Unnamed buttons are counted two ways, because the audit's first count was
 * wrong in an instructive way: `innerText` is empty for content inside a
 * CLOSED <details>, so every named control behind Apex's "Full briefing" read
 * as nameless. The as-rendered count skips closed disclosures (nothing there
 * is on screen); the second count opens every disclosure and reads again, so
 * a control that really has no name cannot hide behind one.
 */

const KEY = "final-boss-athlete-settings";
/** Tuesday 15 September 2026, 4:12 PM local — a Pull day, the pre-workout meal due. */
const WHEN = new Date(2026, 8, 15, 16, 12, 0);

const discardBar = (page: Page) => page.getByRole("alertdialog", { name: "Discard unsaved changes" });

async function boot(page: Page, view: string, ready: string) {
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
      s.activeView = v;
      s.recoveryCommand = {
        ...s.recoveryCommand,
        sleepLogs: [7.2, 6.8, 7.6, 8.1, 7.0, 7.9, 7.4].map((hours, i) => ({ date: dayKey(7 - i), hours })),
        hydrationLogs: [{ date: dayKey(0), oz: 64 }],
        mobilityLogs: [{ date: dayKey(1), kind: "recovery", minutes: 10, focus: "Reset" }],
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
  await expect(page.locator(ready).filter({ visible: true }).first()).toBeVisible({ timeout: 60_000 });
}

/** Walk the whole page so every section below the fold has entered and laid out. */
async function scrollThrough(page: Page) {
  await page.evaluate(async () => {
    const step = Math.round(window.innerHeight * 0.8);
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 120));
    }
    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 300));
  });
}

async function openEveryDisclosure(page: Page) {
  await page.evaluate(() => document.querySelectorAll("main details").forEach((d) => ((d as HTMLDetailsElement).open = true)));
  await page.waitForTimeout(600);
}

/** Visible controls in main and the shell dock with no text, aria-label, aria-labelledby or title. */
function unnamedButtons(page: Page) {
  return page.evaluate(() => {
    const inClosed = (el: Element) => {
      for (let d = el.closest("details"); d; d = d.parentElement?.closest("details") ?? null) {
        if (!(d as HTMLDetailsElement).open) return true;
      }
      return false;
    };
    return [...document.querySelectorAll("main, #reserve-slot-dock")]
      .flatMap((root) => [...root.querySelectorAll("button, a[href], [role=button], [role=tab], [role=radio]")])
      .filter((b) => {
        const r = b.getBoundingClientRect();
        const cs = getComputedStyle(b);
        return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && !inClosed(b);
      })
      .filter(
        (b) =>
          !((b as HTMLElement).innerText ?? "").trim() &&
          !b.getAttribute("aria-label") &&
          !b.getAttribute("aria-labelledby") &&
          !b.getAttribute("title"),
      )
      .map((b) => b.outerHTML.replace(/\s+/g, " ").slice(0, 160));
  });
}

const GOLD_FILL_SCOPE = "main button, main a, main [role=button], #reserve-slot-dock button, #reserve-slot-dock a, #reserve-slot-dock [role=button]";

/** The two gold detections of redesign-rooms-depth.spec.ts, the dock included, in any colour format. */
async function goldActions(page: Page) {
  return {
    text: await findGoldActions(page, { selector: "button", match: "text" }),
    fill: await findGoldActions(page, { selector: GOLD_FILL_SCOPE, match: "fill" }),
  };
}

/** The broad nesting rule: a rounded surface (border OR fill OR shadow) inside another. */
function nestedSurfaces(page: Page) {
  /* Response context panels (src/components/response/**) are owned elsewhere: skipped as nested, still an ancestor. */
  return findNestedSurfaces(page, BROAD_RULE, { exclude: '[data-testid$="-response-context"]', classes: 4 });
}

/** Clicks a point outside the dialog, if the dialog leaves one. */
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

/* ── Apex ─────────────────────────────────────────────────────────────── */

const APEX_VIEWPORTS = [
  { name: "1280", width: 1280, height: 900, touch: false },
  { name: "1440", width: 1440, height: 1000, touch: false },
  { name: "390", width: 390, height: 844, touch: true },
] as const;

for (const vp of APEX_VIEWPORTS) {
  test.describe(`Apex at ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.touch, isMobile: vp.touch });

    test("exactly one gold action by both detections, and every button has a name", async ({ page }) => {
      test.setTimeout(240_000);
      await boot(page, "dashboard", '[data-apex="next-move-title"]');
      await scrollThrough(page);

      const gold = await goldActions(page);
      expect(gold.text, `one gold action by text colour at ${vp.name}`).toHaveLength(1);
      expect(gold.fill, `one gold action by fill at ${vp.name}`).toHaveLength(1);
      expect(await unnamedButtons(page), `unnamed buttons as rendered at ${vp.name}`).toEqual([]);

      /* Behind "Full briefing": still one gold fill, still every control named, and no surface inside a
         surface under the tightened faint limit (the Smart Brief, Log Summary and Biomarker rows are rules now). */
      await openEveryDisclosure(page);
      expect(await nestedSurfaces(page), `nested surfaces with every disclosure open at ${vp.name}`).toEqual([]);
      expect((await goldActions(page)).fill, `one gold fill with every disclosure open at ${vp.name}`).toHaveLength(1);
      expect(await unnamedButtons(page), `unnamed buttons with every disclosure open at ${vp.name}`).toEqual([]);
      await expect(page.getByRole("button", { name: /mark done/i })).toBeVisible();
    });
  });
}

/* ── Recovery ─────────────────────────────────────────────────────────── */

for (const vp of [
  { name: "1280", width: 1280, height: 900, touch: false },
  { name: "390", width: 390, height: 844, touch: true },
] as const) {
  test.describe(`Recovery at ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.touch, isMobile: vp.touch });

    test("no surface inside another, and every button has a name", async ({ page }) => {
      test.setTimeout(240_000);
      await boot(page, "recovery", '[data-recovery="hero"]');
      await scrollThrough(page);

      expect(await nestedSurfaces(page), `nested surfaces at ${vp.name}`).toEqual([]);
      expect(await unnamedButtons(page), `unnamed buttons as rendered at ${vp.name}`).toEqual([]);
      const gold = await goldActions(page);
      expect(gold.text, `one gold action by text colour at ${vp.name}`).toHaveLength(1);
      expect(gold.fill, `one gold action by fill at ${vp.name}`).toHaveLength(1);

      await openEveryDisclosure(page);
      expect(await nestedSurfaces(page), `nested surfaces with every disclosure open at ${vp.name}`).toEqual([]);
      expect(await unnamedButtons(page), `unnamed buttons with every disclosure open at ${vp.name}`).toEqual([]);

      /* The three former boxes are still there, grouped by light instead. */
      await expect(page.getByText("One Move That Matters")).toBeVisible();
      await expect(page.getByText("Night Routine Window")).toBeVisible();
      await expect(page.getByText("Last night", { exact: true })).toBeVisible();
    });
  });
}

/* ── Training: the set logger and closeout ─────────────────────────────── */

async function startLiveSession(page: Page) {
  await boot(page, "training", '[data-training="hero"]');
  const start = page.locator('[data-training="primary-action"] button').filter({ visible: true });
  await expect(start).toHaveText(/^start session$/i);
  /* The server-rendered button can take a click before hydration and drop it; retry until the step changes. */
  await expect(async () => {
    await start.click();
    await expect(page.getByRole("heading", { name: "Pre-Session Command" })).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 60_000 });
  await expect(async () => {
    await start.click();
    await expect(page.locator('[data-training="horizon"]').filter({ visible: true })).toContainText(/live/i, { timeout: 2_000 });
  }).toPass({ timeout: 60_000 });
  await expect(page.locator("#training-cockpit")).toBeVisible();
}

for (const vp of [
  { name: "1280", width: 1280, height: 900, touch: false },
  { name: "390", width: 390, height: 844, touch: true },
] as const) {
  test.describe(`Training at ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.touch, isMobile: vp.touch });

    test("a set being entered survives an outside click; Escape asks; the session still saves and signals", async ({ page }) => {
      test.setTimeout(300_000);
      await startLiveSession(page);

      await page.locator("#training-cockpit").getByRole("button", { name: /^log (first )?set/i }).first().click();
      const logger = page.getByRole("dialog", { name: /^Log set · / });
      await expect(logger).toBeVisible();

      /* Untouched: Escape closes at once. */
      await page.keyboard.press("Escape");
      await expect(logger).toHaveCount(0);
      await expect(discardBar(page)).toHaveCount(0);

      await page.locator("#training-cockpit").getByRole("button", { name: /^log (first )?set/i }).first().click();
      await expect(logger).toBeVisible();
      const reps = logger.getByRole("textbox", { name: "Reps" });
      const typed = String(Number(await reps.inputValue()) + 2);
      const more = logger.getByRole("button", { name: "One more rep" });
      await more.click();
      await more.click();
      await expect(reps).toHaveValue(typed);
      const logButton = logger.getByRole("button", { name: /^Log Set$/ });
      await expect(logButton).toBeVisible();

      if (await clickOutside(page, logger)) {
        await page.waitForTimeout(300);
        await expect(logger).toBeVisible();
        await expect(reps, "the entered reps are kept").toHaveValue(typed);
      }

      await page.keyboard.press("Escape");
      await expect(discardBar(page)).toBeVisible();
      await expect(discardBar(page).getByRole("button", { name: "Keep Editing" })).toBeFocused();
      await discardBar(page).getByRole("button", { name: "Keep Editing" }).click();
      await expect(discardBar(page)).toHaveCount(0);
      await expect(reps).toHaveValue(typed);

      /* Log it: the set is recorded and the logger closes back to the cockpit, which confirms it. */
      await logButton.click();
      await expect(logger).toHaveCount(0);
      await expect(page.locator('#training-cockpit [data-training="set-confirm"]')).toContainText(new RegExp(`× ${typed}$`));

      /* Close out: step 1's answer is held, so an outside click keeps it. */
      await page.locator("#training-cockpit").getByRole("button", { name: /end workout/i }).first().click();
      const closeout = page.getByRole("dialog", { name: "Close out session" });
      await expect(closeout).toBeVisible();
      await closeout.getByRole("button", { name: /fully accurate/i }).click();
      await expect(closeout.getByText("Log accuracy locked")).toBeVisible();
      if (await clickOutside(page, closeout)) {
        await page.waitForTimeout(300);
        await expect(closeout.getByText("Log accuracy locked")).toBeVisible();
      }
      await page.keyboard.press("Escape");
      await expect(discardBar(page)).toBeVisible();
      await discardBar(page).getByRole("button", { name: "Keep Editing" }).click();

      const announcer = page.locator('[data-signal="announcer"]');
      await closeout.getByRole("button", { name: /completed as planned/i }).click();
      await expect(closeout).toHaveCount(0);
      /* The log moment announces the close-out itself; the shell's line stays quiet. */
      await expect(page.locator('[data-log-moment="announcer"]')).toContainText("Session saved", { timeout: 5_000 });
      await expect(announcer).toHaveText("");
      await expect(page.locator('[data-training="closeout"]').filter({ visible: true })).toBeVisible({ timeout: 30_000 });
    });
  });
}

/* ── The week rail's day inspector ─────────────────────────────────────── */

test.describe("week rail day inspector", () => {
  test.use({ viewport: { width: 1440, height: 1000 } });

  test("a picked change survives an outside click, and Escape asks", async ({ page }) => {
    test.setTimeout(240_000);
    await boot(page, "dashboard", '[data-apex="next-move-title"]');

    /* Thursday is ahead of the seeded Tuesday, so it can be changed. */
    const thursday = page.getByRole("button", { name: /^Thu · .*Open details\.$/ }).filter({ visible: true }).first();
    await thursday.scrollIntoViewIfNeeded();
    const sheet = page.getByRole("dialog", { name: /^Thu · / });
    await expect(async () => {
      await thursday.click();
      await expect(sheet).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 60_000 });

    /* Untouched: an outside click still closes it. */
    await clickOutside(page, sheet);
    await expect(sheet).toHaveCount(0);

    await thursday.click();
    await expect(sheet).toBeVisible();
    const rest = sheet.getByRole("button", { name: "Rest day" });
    await rest.click();
    await expect(rest).toHaveAttribute("aria-pressed", "true");

    expect(await clickOutside(page, sheet), "the sheet leaves room to click outside at 1440").toBe(true);
    await page.waitForTimeout(300);
    await expect(sheet, "a changed day editor stays open").toBeVisible();
    await expect(rest).toHaveAttribute("aria-pressed", "true");

    await page.keyboard.press("Escape");
    await expect(discardBar(page)).toBeVisible();
    await discardBar(page).getByRole("button", { name: "Discard" }).click();
    await expect(sheet).toHaveCount(0);

    /* Nothing was saved. */
    const edits = await page.evaluate((k) => JSON.parse(window.localStorage.getItem(k) ?? "{}").state?.splitCustomization, KEY);
    expect(JSON.stringify(edits ?? {})).not.toContain('"rest"');
  });
});
