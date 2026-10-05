import { test, expect, type Page } from "@playwright/test";

import { SAFETY_ACK_VERSION } from "../../src/lib/safety/acknowledgement";
import { BROAD_UNROUNDED_RULE, nestedSurfaces as findNestedSurfaces } from "./support/surface-nesting";
import { goldActions as findGoldActions } from "./support/gold-action";

/**
 * WAVE — PLAN & INTELLIGENCE, AT THE APEX BAR.
 *
 * AI Strategist, Build Studio, Decision Log, Physique Cockpit, Peak Physique
 * and Education — plus, since the final audit, Mesocycle Planner, Physique
 * Command, Progress Photos, Measurements, Journal, Settings and Community —
 * at 1280×900 and 390×844 (touch), each in two states:
 *
 *   · fresh  — a Reserve Black member who has logged nothing
 *   · active — seven nights of sleep, hydration, a check-in, two physique
 *              check-ins and a photo set, on a fixed clock
 *
 * Every screen, every state, every width:
 *
 *   · exactly one visible h1
 *   · at most one gold action, counted two ways: the near-black text a gold
 *     fill carries (rgb(10, 11, 16)) AND any control painted gold. The second
 *     catches a gold button whose text colour is not the spec colour.
 *   · no surface inside a surface — the BROAD check: any element with a
 *     visible border, a tinted background or a shadow, inside another such
 *     element. Controls are not surfaces.
 *   · no horizontal overflow, no paragraph over 240 characters
 *   · on a phone, the end of the page scrolls clear of the tab bar
 *
 * DOCUMENTED ZERO-GOLD SCREENS: Education (no lesson exists to start), the
 * Decision Log once it holds history (a record, with no honest next step) and
 * Community (nothing to join yet; the hero says so).
 *
 * COMMAND-CENTER SCREENS (Program Horizon, Response Model) also hold a shape:
 * at most `budget.regions` first-level regions, at most `budget.chars` of text
 * (Apex reads ~1.9k), and at most one closed Details disclosure.
 *
 * Plus the fixes this wave exists for: the Strategist statement agrees with
 * its own watch list, the Decision Log prints dates and the member's unit,
 * Build Studio's gold opens the week canvas, Peak Physique fits a phone.
 */

const KEY = "final-boss-athlete-settings";
const WHEN = new Date(2026, 8, 15, 16, 12, 0);

function dayKey(offset: number): string {
  const d = new Date(WHEN);
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const STAMP = "2026-09-01T12:00:00.000Z";

function freshState() {
  return {
    subscriptionTier: "elite",
    onboarding: { status: "complete", currentStep: 99, startedAt: STAMP },
    setupProfile: { setupComplete: true, completedAt: STAMP, completedSteps: ["schedule"] },
  };
}

function activeState() {
  return {
    ...freshState(),
    safetyAcknowledgement: { acknowledgedAt: STAMP, version: SAFETY_ACK_VERSION, adultConfirmedAt: STAMP },
    recoveryCommand: {
      sleepLogs: [7.2, 6.8, 7.6, 8.1, 7.0, 7.9, 7.4].map((hours, i) => ({ date: dayKey(i - 7), hours })),
      hydrationLogs: [{ date: dayKey(0), oz: 64 }],
      mobilityLogs: [{ date: dayKey(-1), kind: "recovery", minutes: 10, focus: "Reset" }],
      stressCheckIns: [{ date: dayKey(0), stress: 2, energy: 4, mood: 4 }],
      sleepTargetHours: 8,
      hydrationTargetOz: 100,
      mobilityWeeklyTarget: 4,
      suiteCompletedToday: [],
      suiteDate: null,
    },
    physiqueCommand: {
      goal: "recomp",
      checkInIntervalDays: 7,
      weakPoints: ["delts"],
      focus: { primary: null, secondary: [], support: [], track: null, updatedAt: null },
      entries: [
        { id: "seed-a", date: "2026-07-11", bodyWeightLb: 192.4, measurements: { waist: 34.5, chest: 43, arms: 16 }, notes: "Baseline check-in, measured fasted." },
        { id: "seed-b", date: "2026-09-12", bodyWeightLb: 188.1, measurements: { waist: 33.2, chest: 43.2, arms: 16.3 }, notes: "Same conditions as the baseline." },
      ],
      photoCheckIns: [{ id: "seed-photo", date: "2026-09-10", poses: ["front-relaxed", "side-relaxed"], consistencyScore: 67, notes: "Flat morning light." }],
    },
  };
}

type State = "fresh" | "active";

type Screen = {
  name: string;
  view: string;
  hero: string;
  /** The most gold this screen may show in each state. */
  gold: Record<State, 0 | 1>;
  /** Command-center screens: region and text budgets, and at most one Details disclosure. */
  budget?: { regions: number; chars: number };
};

const SCREENS: Screen[] = [
  { name: "AI Strategist", view: "ai-strategist", hero: '[data-strategist="hero"]', gold: { fresh: 1, active: 1 } },
  { name: "Build Studio", view: "lifestyle-builder", hero: '[data-lifestyle="hero"]', gold: { fresh: 1, active: 1 } },
  { name: "Decision Log", view: "performance-intelligence", hero: '[data-optimization="hero"]', gold: { fresh: 1, active: 1 } },
  { name: "Physique Cockpit", view: "physique-intelligence", hero: '[data-record="physique-intelligence"]', gold: { fresh: 1, active: 1 } },
  { name: "Peak Physique", view: "peak-physique", hero: '[data-record="peak-physique"]', gold: { fresh: 1, active: 1 } },
  { name: "Education", view: "education", hero: '[data-utility="education"]', gold: { fresh: 0, active: 0 } },
  /* Added by the final redesign audit (2026-09-16): screens that had no broad-rule
     spec. Their own specs (redesign-foundation, redesign-records, redesign-utility)
     check border-only nesting; these rows hold them to the same bar as the rest. */
  { name: "Mesocycle Planner", view: "mesocycle-planner", hero: '[data-mesocycle="hero"]', gold: { fresh: 1, active: 1 } },
  { name: "Physique Command", view: "physique", hero: '[data-record="physique"]', gold: { fresh: 1, active: 1 } },
  { name: "Progress Photos", view: "progress-photos", hero: '[data-record="progress-photos"]', gold: { fresh: 1, active: 1 } },
  { name: "Measurements", view: "measurements", hero: '[data-record="measurements"]', gold: { fresh: 1, active: 1 } },
  { name: "Journal", view: "journal", hero: '[data-record="journal"]', gold: { fresh: 1, active: 1 } },
  { name: "Settings", view: "settings", hero: '[data-utility="settings"]', gold: { fresh: 1, active: 1 } },
  { name: "Community", view: "community", hero: '[data-utility="community"]', gold: { fresh: 0, active: 0 } },
  { name: "Program Horizon", view: "program-horizon", hero: '[data-horizon="hero"]', gold: { fresh: 1, active: 1 }, budget: { regions: 4, chars: 1000 } },
  { name: "Response Model", view: "response-profile", hero: '[data-response="hero"]', gold: { fresh: 1, active: 1 }, budget: { regions: 4, chars: 1000 } },
];

/** First-level regions of the page after its header, and top-level disclosures in `main`. */
async function commandShape(page: Page): Promise<{ regions: number; details: number; chars: number }> {
  return page.evaluate(() => {
    const main = document.querySelector("main");
    const pageEl = document.querySelector("main .fba-page");
    if (!main || !pageEl) return { regions: -1, details: -1, chars: -1 };
    const flatten = (parent: Element): Element[] =>
      [...parent.children].flatMap((child) => (child.matches("[data-room-sections]") ? flatten(child) : [child]));
    const regions = flatten(pageEl)
      .filter((el) => !el.matches("header, footer") && !el.querySelector("header"))
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 4;
      }).length;
    const details = [...main.querySelectorAll("details")].filter((d) => !d.parentElement?.closest("details") && (d as HTMLElement).offsetParent !== null).length;
    return { regions, details, chars: (main as HTMLElement).innerText.replace(/\s+/g, " ").trim().length };
  });
}

async function bootTo(page: Page, view: string, state: State) {
  await page.clock.setFixedTime(WHEN);
  await page.addInitScript(
    ({ k, v, s }) => {
      window.localStorage.setItem("fba-preview-view", v);
      if (!window.localStorage.getItem(k)) {
        window.localStorage.setItem(k, JSON.stringify({ state: { ...s, activeView: v }, version: 0 }));
      }
    },
    { k: KEY, v: view, s: state === "active" ? activeState() : freshState() },
  );
  /* `domcontentloaded`: the dev server's HMR socket keeps networkidle from settling. */
  await page.goto("/", { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.locator("main").waitFor({ state: "visible", timeout: 120_000 });
}

/** Gold, counted by text colour and by paint, in any colour format. Returns each gold control once. */
async function goldActions(page: Page): Promise<string[]> {
  return findGoldActions(page, { selector: "main button, main a, main [role=button]", visible: "rendered", match: "either" });
}

/**
 * The broad nesting check. A surface is anything that draws one — a visible
 * border, a tinted background or a shadow — at a size that reads as a panel
 * and carrying text. Controls (buttons, inputs, tab strips, summaries,
 * listboxes) are not surfaces. A surface inside a surface is card-in-card.
 */
function nestedSurfaces(page: Page): Promise<string[]> {
  return findNestedSurfaces(page, BROAD_UNROUNDED_RULE);
}

/** Leaf text blocks longer than 240 characters. */
async function longParagraphs(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const main = document.querySelector("main");
    if (!main) return ["no <main>"];
    const BLOCK = new Set(["block", "list-item", "flex", "grid", "table", "table-cell", "flow-root"]);
    const long: string[] = [];
    for (const el of main.querySelectorAll("p, div, li, dd, blockquote, span, td")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const display = getComputedStyle(el).display;
      if (!BLOCK.has(display) && el.tagName !== "P") continue;
      const hasBlockChild = [...el.querySelectorAll("*")].some((c) => BLOCK.has(getComputedStyle(c).display) || c.tagName === "P");
      if (hasBlockChild) continue;
      const text = (el as HTMLElement).innerText.replace(/\s+/g, " ").trim();
      if (text.length > 240) long.push(`${text.length}: ${text.slice(0, 80)}`);
    }
    return long;
  });
}

for (const viewport of [
  { name: "1280x900", width: 1280, height: 900, touch: false },
  { name: "390x844", width: 390, height: 844, touch: true },
] as const) {
  test.describe(`plan & intelligence wave at ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height }, hasTouch: viewport.touch, isMobile: viewport.touch });

    for (const state of ["fresh", "active"] as const) {
      for (const screen of SCREENS) {
        test(`${screen.name} (${state}) meets the Apex bar`, async ({ page }) => {
          test.setTimeout(180_000);
          const pageErrors: string[] = [];
          page.on("pageerror", (error) => pageErrors.push(error.message));

          await bootTo(page, screen.view, state);
          await expect(page.locator(screen.hero).first(), `${screen.name} rendered its hero`).toBeVisible({ timeout: 90_000 });
          await page.waitForTimeout(800);

          await expect(page.locator("main h1").filter({ visible: true }), "exactly one h1").toHaveCount(1);

          const gold = await goldActions(page);
          expect(gold.length, `${screen.name} gold: ${gold.join(" | ")}`).toBeLessThanOrEqual(screen.gold[state]);

          expect(await nestedSurfaces(page), `${screen.name} surfaces nested in main`).toEqual([]);

          const overflow = await page.evaluate(() => ({
            doc: document.documentElement.scrollWidth - document.documentElement.clientWidth,
            main: (() => {
              const main = document.querySelector("main");
              return main ? main.scrollWidth - main.clientWidth : 0;
            })(),
          }));
          expect(overflow, `${screen.name} scrolls sideways`).toEqual({ doc: 0, main: 0 });

          expect(await longParagraphs(page), `${screen.name} paragraphs over 240 characters`).toEqual([]);

          if (screen.budget) {
            const shape = await commandShape(page);
            expect(shape.regions, `${screen.name} first-level regions`).toBeLessThanOrEqual(screen.budget.regions);
            expect(shape.chars, `${screen.name} text (budget ${screen.budget.chars})`).toBeLessThanOrEqual(screen.budget.chars);
            expect(shape.details, `${screen.name} top-level disclosures`).toBeLessThanOrEqual(1);
          }

          if (viewport.touch) {
            /* The end of the page scrolls clear of the phone tab bar. */
            const clear = await page.evaluate(async () => {
              const main = document.querySelector("main");
              const scroller = main && ["auto", "scroll"].includes(getComputedStyle(main).overflowY) ? main : null;
              /* Twice: a late layout (a chart measuring itself) can grow the page after the first scroll. */
              for (let pass = 0; pass < 2; pass += 1) {
                /* `instant`: the page sets scroll-behavior: smooth, and a long page (Settings)
                   is still gliding when the check reads it. */
                if (scroller) scroller.scrollTo({ top: scroller.scrollHeight, behavior: "instant" });
                else window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" });
                await new Promise((resolve) => setTimeout(resolve, 600));
              }
              const bar = [...document.querySelectorAll(".fba-shell-bottom")].find((el) => el.getBoundingClientRect().height > 0);
              const page = document.querySelector("main .fba-page");
              const last = page?.lastElementChild;
              if (!bar || !last) return { ok: true, detail: "no tab bar" };
              const barTop = bar.getBoundingClientRect().top;
              const lastBottom = last.getBoundingClientRect().bottom;
              return { ok: lastBottom <= barTop + 1, detail: `content ends ${Math.round(lastBottom)} · tab bar ${Math.round(barTop)}` };
            });
            expect(clear.ok, `${screen.name} ends behind the tab bar: ${clear.detail}`).toBe(true);
          }

          expect(pageErrors.filter((error) => /Hydration/i.test(error)), `${screen.name} hydration`).toEqual([]);
        });
      }
    }
  });
}

test.describe("the fixes", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("AI Strategist: the statement agrees with its own ranked watch list", async ({ page }) => {
    test.setTimeout(180_000);
    await bootTo(page, "ai-strategist", "active");
    const hero = page.locator('[data-strategist="hero"]');
    await expect(hero).toBeVisible({ timeout: 90_000 });
    const list = page.locator('[data-strategist="watch-list"] li[data-watch-kind]');
    await expect(list.first()).toBeVisible();

    const kinds = await list.evaluateAll((items) => items.map((item) => item.getAttribute("data-watch-kind")));
    const statement = (await hero.locator("[data-room-statement]").innerText()).trim();
    if (kinds.includes("hurting")) {
      expect(statement, "a listed debt and 'nothing is limiting' cannot share a screen").not.toMatch(/nothing/i);
      expect(statement).toMatch(/is your limiter/i);
      // Hurting ranks first.
      expect(kinds.indexOf("helping") === -1 || kinds.lastIndexOf("hurting") < kinds.indexOf("helping")).toBe(true);
      // Gold goes to the limiting room.
      const source = (await list.first().locator("span").first().innerText()).split("·").pop()?.trim().toLowerCase() ?? "";
      const gold = page.locator('[data-strategist="primary-action"] button');
      if (source === "recovery") await expect(gold).toHaveText(/Recovery Command/i);
    }

    // System signals and questions wait behind their lines.
    await expect(page.getByText(/All systems · \d+ on track/i)).toBeVisible();
    await expect(page.locator('[data-strategist="systems"]')).toBeHidden();
    await expect(page.locator('[data-strategist="brief"]')).toHaveCount(1);
    await expect(page.locator("main")).not.toContainText(/Open a system/i);
    await page.getByText(/Ask the strategist · 3 questions/i).click();
    const questions = page.locator('[data-strategist="brief"] button[aria-pressed]');
    await expect(questions).toHaveCount(3);
    await questions.first().click();
    await expect(page.locator('[data-strategist="answer"]')).toBeVisible();
  });

  test("Decision Log: dates instead of raw week keys, and the member's own unit", async ({ page }) => {
    test.setTimeout(180_000);
    await bootTo(page, "performance-intelligence", "active");
    await expect(page.locator('[data-optimization="hero"]')).toBeVisible({ timeout: 90_000 });
    await page.waitForTimeout(1500);
    const text = (await page.locator("main").innerText()).replace(/\s+/g, " ");
    expect(text, "no raw calendar week keys").not.toMatch(/weeks? \d{4}/i);
    expect(text, "an imperial member never reads kg").not.toMatch(/kg per week/i);
    const weeks = page.locator("[data-event-weeks]");
    for (const line of await weeks.allInnerTexts()) {
      expect(line).toMatch(/^(weeks? of [a-z]{3} \d{1,2}|program weeks? \d)/i);
    }
    if (/per week/i.test(text)) expect(text).toMatch(/lb per week/i);
  });

  test("Build Studio: gold opens the week canvas, and the page is one week of rows", async ({ page }) => {
    test.setTimeout(180_000);
    await bootTo(page, "lifestyle-builder", "fresh");
    await expect(page.locator('[data-lifestyle="hero"]')).toBeVisible({ timeout: 90_000 });

    const ownership = page.getByRole("tablist", { name: "Who owns the system" });
    await expect(ownership.getByRole("tab")).toHaveText([/Reserve/i, /Hybrid/i, /Member/i]);
    await ownership.getByRole("tab", { name: /Hybrid/i }).click();
    await expect(ownership.getByRole("tab", { name: /Hybrid/i })).toHaveAttribute("aria-selected", "true");

    // Only this week's controls are on screen; the next three wait behind a line.
    await expect(page.getByText(/Plan ahead · 3 weeks/i)).toBeVisible();
    await expect(page.locator('[data-lifestyle="this-week"] summary', { hasText: /Add a note/i })).toBeVisible();
    await expect(page.getByPlaceholder("Week notes").filter({ visible: true })).toHaveCount(0);

    const canvas = page.locator("#build-studio-week details");
    expect(await canvas.evaluate((el) => (el as HTMLDetailsElement).open)).toBe(false);
    await page.locator('[data-lifestyle="primary-action"] button').click();
    await expect.poll(() => canvas.evaluate((el) => (el as HTMLDetailsElement).open)).toBe(true);
    await expect(page.getByRole("button", { name: /New Schedule/i })).toBeVisible();
    const focusedInCanvas = await page.evaluate(() => Boolean(document.activeElement?.closest("#build-studio-week")));
    expect(focusedInCanvas, "focus lands inside the week canvas").toBe(true);
  });

  test("Physique Cockpit: evidence in the eyebrow, one limits line", async ({ page }) => {
    test.setTimeout(180_000);
    await bootTo(page, "physique-intelligence", "active");
    const hero = page.locator('[data-record="physique-intelligence"]');
    await expect(hero).toBeVisible({ timeout: 90_000 });
    await expect(hero).toContainText(/2 check-ins over \d+ days/i);
    const main = page.locator("main");
    await expect(main.locator("h2", { hasText: /^Evidence$/i })).toHaveCount(0);
    await expect(main).not.toContainText(/What this cockpit will not do$/im);
    const limits = page.locator('[data-physique-cockpit="limits"] details');
    await expect(limits).toHaveCount(1);
    expect(await limits.evaluate((el) => (el as HTMLDetailsElement).open)).toBe(false);
  });

  test("Education: tabs filter to one area and definitions open on tap", async ({ page }) => {
    test.setTimeout(180_000);
    await bootTo(page, "education", "fresh");
    await expect(page.locator('[data-utility="education"]')).toBeVisible({ timeout: 90_000 });
    await expect(page.locator("[data-education-area]")).toHaveCount(1);
    const tabs = page.getByRole("tablist", { name: "Glossary areas" });
    await tabs.getByRole("tab", { name: /Recovery/i }).click();
    await expect(page.locator('[data-education-area="recovery"]')).toBeVisible();
    await expect(page.locator("[data-education-note]")).toHaveCount(1);
    const first = page.locator('[data-education-area="recovery"] details').first();
    expect(await first.evaluate((el) => (el as HTMLDetailsElement).open)).toBe(false);
    await first.locator("summary").click();
    await expect.poll(() => first.evaluate((el) => (el as HTMLDetailsElement).open)).toBe(true);
    const chars = (await page.locator("main").innerText()).replace(/\s+/g, " ").length;
    expect(chars, "Education reads at about 1,500 characters").toBeLessThan(2000);
  });
});

test.describe("command center: Program Horizon and Response Model", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("Program Horizon with a running block: one instrument, weeks select, one Details", async ({ page }) => {
    test.setTimeout(180_000);
    await page.clock.setFixedTime(WHEN);
    await page.addInitScript(
      ({ k, s }) => {
        window.localStorage.setItem("fba-preview-view", "program-horizon");
        if (!window.localStorage.getItem(k)) window.localStorage.setItem(k, JSON.stringify({ state: { ...s, activeView: "program-horizon" }, version: 0 }));
      },
      {
        k: KEY,
        s: {
          ...activeState(),
          activeProtocol: {
            protocolId: "ultimate-summer-shred", protocolName: "Ultimate Summer Shred", category: "shred-cut", selectedDate: dayKey(-22), startDate: dayKey(-22),
            targetDate: dayKey(62), durationWeeks: 12, commitmentLevel: "high", trainingDays: 5, cardioDays: 4, mobilityDays: 3, checkInCadence: "Weekly",
            nutritionFocus: "Calorie control, high protein, grocery structure", recoveryFocus: "Sleep + hydration protection", goal: "Fat loss + visible tightening",
            eventName: null, eventType: null, eventDate: null, status: "active", notes: "",
          },
        },
      },
    );
    await page.goto("/", { waitUntil: "domcontentloaded", timeout: 120_000 });
    const hero = page.locator('[data-horizon="hero"]');
    await expect(hero).toBeVisible({ timeout: 90_000 });
    await expect(hero.locator("[data-room-statement]")).toHaveText(/^Week \d+ of 12 on Ultimate Summer Shred/);
    await expect(page.locator('[data-horizon="block"]')).toBeVisible();

    const shape = await commandShape(page);
    expect(shape.regions, "regions").toBeLessThanOrEqual(4);
    expect(shape.details, "one Details").toBe(1);
    expect(shape.chars, "text budget").toBeLessThanOrEqual(1000);
    await expect(page.locator("main")).not.toContainText(/Why Reserve Selected This|What Would Sharpen This|Week Timeline/i);

    /* Reading another week moves the gold action back to this week. */
    const gold = page.locator('[data-horizon="primary-action"] button');
    await expect(gold).toHaveText(/adjust this week/i);
    await expect(async () => {
      await page.getByRole("button", { name: /^Week 9 ·/ }).click();
      await expect(page.locator('[data-horizon="week"] h3')).toHaveText(/^Week 9/, { timeout: 2_000 });
    }).toPass({ timeout: 60_000 });
    await expect(gold).toHaveText(/return to this week/i);
    await gold.click();
    await expect(gold).toHaveText(/adjust this week/i);

    await page.locator('[data-horizon="details"] summary').click();
    await expect(page.locator('[data-horizon="details"]')).toContainText(/What Reserve will watch/i);
  });

  test("Response Model: a pattern row opens its evidence in a sheet", async ({ page }) => {
    test.setTimeout(180_000);
    await bootTo(page, "response-profile", "active");
    await expect(page.locator('[data-response="hero"]')).toBeVisible({ timeout: 90_000 });
    const rows = page.locator('[data-response="patterns"] button[aria-haspopup="dialog"]');
    await expect(rows.first()).toBeVisible();
    await expect(page.locator("main")).not.toContainText(/Patterns by area|Current response/i);
    await expect(async () => {
      await rows.first().click();
      await expect(page.getByRole("dialog")).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 60_000 });
    await expect(page.locator('[data-response="evidence-sheet"]')).toContainText(/What Reserve observed/i);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});

test.describe("Peak Physique on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("the requirements header wraps instead of running 48px off the screen", async ({ page }) => {
    test.setTimeout(180_000);
    await bootTo(page, "peak-physique", "fresh");
    const hero = page.locator('[data-record="peak-physique"]');
    await expect(hero).toBeVisible({ timeout: 90_000 });
    await expect(hero).toContainText("Not set");
    const overflow = await page.evaluate(() => {
      const main = document.querySelector("main")!;
      return main.scrollWidth - main.clientWidth;
    });
    expect(overflow).toBe(0);
    const header = page.locator('[data-peak="requirements"] h2');
    const box = await header.boundingBox();
    expect(box && box.x + box.width).toBeLessThanOrEqual(390);
  });
});
