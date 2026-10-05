import { test, expect, type Page } from "@playwright/test";

import { SAFETY_ACK_VERSION } from "../../src/lib/safety/acknowledgement";
import { ANY_BOX_RULE, BROAD_RULE, boxesWithin, nestedSurfaces } from "./support/surface-nesting";
import { GOLD_KIT_SOURCE, type GoldKit } from "./support/gold-action";
import { settleAnimations } from "./support/settle";

/**
 * WAVE: TRAINING — the Training room held to the simplified Apex bar.
 *
 * For an ACTIVE member (split chosen, recovery logs, a logged cycle with the
 * safety acknowledgement accepted) and a FRESH member (no split, no logs), at
 * 1280×900 and 390×844 with touch:
 *
 *   · exactly one h1
 *   · exactly one gold action, by BOTH detections: near-black text on the
 *     primary tier, and a gold background fill (a gold-filled control whose
 *     text is not #0a0b10 used to slip past the first check)
 *   · no surface inside another under the BROAD rule — a rounded element with
 *     a border OR a non-transparent background OR a box-shadow, inside another
 *     such element. Content behind a closed disclosure is not on screen and is
 *     not counted.
 *   · no paragraph over 240 characters, no sideways scroll
 *   · a text budget for the whole room (Apex is ~1.9k; this was 20k)
 *   · nothing on a phone ends up behind the tab bar
 *   · the honesty line says what built today's session, and the old
 *     "No executable Program Horizon" contradiction is gone
 *   · Start Session still reaches the live cockpit (active); the fresh gold
 *     action opens the split chooser
 */

const KEY = "final-boss-athlete-settings";
/** Tuesday 15 September 2026, 4:12 PM local — a Pull day for a PPL + Upper/Lower member. */
const WHEN = new Date(2026, 8, 15, 16, 12, 0);

type MemberState = "active" | "fresh";

const VIEWPORTS = [
  { name: "1280", width: 1280, height: 900, touch: false },
  { name: "390", width: 390, height: 844, touch: true },
] as const;

/** Visible text in `main`, whitespace collapsed. Active measured 20,286 before the first wave and
    ~1,980 before the command-center pass; Apex reads ~1,920, and Training stays at or under it. */
const TEXT_BUDGET: Record<MemberState, number> = { active: 1920, fresh: 1000 };

/** First-level regions: hero, the instrument (horizon + week), today's session, Details — plus
    the member's own cycle section when they logged one (active). */
const REGION_BUDGET: Record<MemberState, number> = { active: 5, fresh: 4 };

async function boot(page: Page, member: MemberState) {
  await page.clock.setFixedTime(WHEN);
  await page.addInitScript(
    ({ k }) => {
      window.localStorage.setItem("fba-preview-view", "training");
      const raw = window.localStorage.getItem(k);
      const parsed = raw ? JSON.parse(raw) : { state: {}, version: 0 };
      parsed.state = {
        ...parsed.state,
        onboarding: { ...(parsed.state.onboarding || {}), status: "complete", currentStep: 99, startedAt: "2026-09-01T12:00:00.000Z" },
      };
      window.localStorage.setItem(k, JSON.stringify(parsed));
    },
    { k: KEY },
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
    ({ k, iso, member, ackVersion }) => {
      const now = new Date(iso);
      const stamp = now.toISOString();
      const dayKey = (offset: number) => {
        const d = new Date(now);
        d.setDate(d.getDate() + offset);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      };
      const parsed = JSON.parse(window.localStorage.getItem(k) as string);
      const s = parsed.state;
      s.activeView = "training";
      s.subscriptionTier = "elite";
      const steps: string[] = (s.setupProfile?.completedSteps ?? []).filter((step: string) => step !== "schedule");
      s.setupProfile = { ...s.setupProfile, setupComplete: true, completedAt: stamp, completedSteps: [...steps, "schedule"] };

      if (member === "active") {
        s.recoveryCommand = {
          ...s.recoveryCommand,
          sleepLogs: [7.2, 6.8, 7.6, 8.1, 7.0, 7.9, 7.4].map((hours, i) => ({ date: dayKey(i - 7), hours })),
          hydrationLogs: [{ date: dayKey(0), oz: 64 }],
          mobilityLogs: [{ date: dayKey(-1), kind: "recovery", minutes: 10, focus: "Reset" }],
          stressCheckIns: [{ date: dayKey(0), stress: 2, energy: 4, mood: 4 }],
        };
        s.scheduleProfile = {
          ...s.scheduleProfile,
          wakeTime: "06:30",
          sleepTarget: "22:30",
          trainingWindow: "evening",
          preferredTrainingStart: "17:30",
          preferredTrainingEnd: "19:00",
        };
        s.splitSystem = { ...(s.splitSystem || {}), key: "ppl-ul", source: "member", selectedAt: stamp };
        s.trainingSession = {
          ...s.trainingSession,
          enhancementLog: [
            {
              id: "e2e-test", name: "Testosterone Cypionate", officialName: "Testosterone Cypionate", compoundClass: "hormones_testosterone",
              category: "hormone", doseAmount: "200", doseUnit: "mg", frequency: "", timingPreference: "", goalAssociation: [], isActive: true,
              createdAt: stamp, updatedAt: stamp,
            },
          ],
        };
        s.cyclePeriods = [
          {
            id: "e2e-cycle", name: "Autumn block", startDate: dayKey(-38), plannedWeeks: 12, compoundIds: ["e2e-test"], clinicianOversight: true,
            checkpoints: [{ id: "e2e-cp", date: dayKey(10), label: "Mid-cycle panel", setBy: "clinician" }], createdAt: stamp, updatedAt: stamp,
          },
        ];
        s.cycleCheckIns = [{ id: "e2e-checkin", cycleId: "e2e-cycle", date: dayKey(-2), createdAt: stamp, ratings: {}, symptoms: ["insomnia"] }];
        s.safetyAcknowledgement = { acknowledgedAt: stamp, version: ackVersion, adultConfirmedAt: stamp };
      }
      return JSON.stringify(parsed);
    },
    { k: KEY, iso: WHEN.toISOString(), member, ackVersion: SAFETY_ACK_VERSION },
  );
  await page.addInitScript(({ k, v }) => window.localStorage.setItem(k, v), { k: KEY, v: patched });
  await page.reload({ waitUntil: "domcontentloaded", timeout: 120_000 });
  await expect(page.locator('[data-training="hero"]').filter({ visible: true })).toBeVisible({ timeout: 60_000 });
}

/** Walk the whole page so every section below the fold has entered and laid out. */
async function scrollThrough(page: Page) {
  await page.evaluate(async () => {
    const main = document.querySelector("main");
    const scroller = main && ["auto", "scroll"].includes(getComputedStyle(main).overflowY) ? main : null;
    const height = scroller ? scroller.scrollHeight : document.body.scrollHeight;
    const step = Math.round(window.innerHeight * 0.8);
    for (let y = 0; y < height; y += step) {
      if (scroller) scroller.scrollTo(0, y);
      else window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 100));
    }
    if (scroller) scroller.scrollTo(0, 0);
    else window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 300));
  });
}

/** The room's structure, measured from computed styles rather than class names. */
async function measure(page: Page) {
  /* The broad nesting rule lives in ./support/surface-nesting (one colour reader for rgb, oklab, oklch, color(), color-mix). */
  const nested = await nestedSurfaces(page, BROAD_RULE);
  const rest = await page.evaluate((kitSource) => {
    /* The shared gold reader (support/gold-action), rebuilt in the page: any colour format. */
    const kit = new Function(`return (${kitSource})()`)() as GoldKit;
    const main = document.querySelector("main")!;
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return false;
      const cs = getComputedStyle(el);
      return cs.visibility !== "hidden" && cs.display !== "none";
    };
    /* A closed <details> body is not on screen, but asking for its geometry lays it out anyway. */
    const shown = (el: Element) => {
      for (let d = el.closest("details"); d; d = d.parentElement?.closest("details") ?? null) {
        if (!(d as HTMLDetailsElement).open) return false;
      }
      return true;
    };

    const h1 = [...document.querySelectorAll("h1")].filter(visible).length;

    const goldText = [...document.querySelectorAll("button, a")]
      .filter((b) => visible(b) && kit.isInk(getComputedStyle(b).color))
      .map((b) => (b.textContent ?? "").trim().slice(0, 40));
    const goldish = kit.paintIsGold;
    const goldFill = [...main.querySelectorAll("button, a, [role=button]")]
      .filter((b) => {
        if (!visible(b)) return false;
        const cs = getComputedStyle(b);
        return goldish(cs.backgroundColor) || goldish(cs.backgroundImage);
      })
      .map((b) => (b.textContent ?? "").trim().slice(0, 40));

    const BLOCK = new Set(["block", "list-item", "flex", "grid", "table", "table-cell", "flow-root"]);
    const longParagraphs: string[] = [];
    for (const el of main.querySelectorAll("p, div, li, dd, blockquote, span, td")) {
      if (!visible(el) || !shown(el)) continue;
      if (!BLOCK.has(getComputedStyle(el).display) && el.tagName !== "P") continue;
      if ([...el.querySelectorAll("*")].some((c) => c.tagName === "P" || BLOCK.has(getComputedStyle(c).display))) continue;
      const text = (el as HTMLElement).innerText.replace(/\s+/g, " ").trim();
      if (text.length > 240) longParagraphs.push(`${text.length}: ${text.slice(0, 80)}`);
    }

    return {
      h1,
      goldText,
      goldFill,
      longParagraphs,
      chars: main.innerText.replace(/\s+/g, " ").trim().length,
      /* Command-center shape: first-level regions of the page (after its header), and the
         closed disclosures at the top level of the screen — at most one "Details". */
      ...(() => {
        const pageEl = document.querySelector("main .fba-page");
        const flatten = (parent: Element): Element[] =>
          [...parent.children].flatMap((child) => (child.matches("[data-room-sections]") ? flatten(child) : [child]));
        const regions = pageEl
          ? flatten(pageEl)
              .filter((el) => !el.matches("header, footer") && !el.querySelector("header"))
              .filter((el) => {
                const r = el.getBoundingClientRect();
                return r.width > 0 && r.height > 4;
              }).length
          : 0;
        /* The member's own cycle section carries its own standing note, and the week rail folds its
           seven days on a phone ("Full week"): neither is this screen's explanation disclosure. */
        const details = [...main.querySelectorAll("details")].filter(
          (d) =>
            !d.parentElement?.closest("details") &&
            !d.closest('[data-enhanced-room], [data-training="instrument"]') &&
            (d as HTMLElement).offsetParent !== null,
        ).length;
        return { regions, details };
      })(),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  }, GOLD_KIT_SOURCE);
  return { ...rest, nested };
}

for (const vp of VIEWPORTS) {
  test.describe(`training room at ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.touch, isMobile: vp.touch });

    for (const member of ["active", "fresh"] as const) {
      test(`${member}: one h1, one gold, no nesting, short paragraphs, inside the text budget`, async ({ page }) => {
        test.setTimeout(240_000);
        const pageErrors: string[] = [];
        page.on("pageerror", (e) => pageErrors.push(e.message));

        await boot(page, member);
        await scrollThrough(page);
        const m = await measure(page);

        expect(m.h1, "visible h1 count").toBe(1);
        expect(m.goldText, "gold actions by text colour").toHaveLength(1);
        expect(m.goldFill, "gold actions by background fill").toHaveLength(1);
        expect(m.goldFill[0]).toBe(m.goldText[0]);
        expect(m.nested, "surfaces nested inside another surface (broad rule)").toEqual([]);
        expect(m.longParagraphs, "paragraphs over 240 characters").toEqual([]);
        expect(m.overflow, "sideways scroll").toBeLessThanOrEqual(1);
        expect(m.chars, `text in main (budget ${TEXT_BUDGET[member]})`).toBeLessThanOrEqual(TEXT_BUDGET[member]);
        expect(m.regions, `first-level regions (budget ${REGION_BUDGET[member]})`).toBeLessThanOrEqual(REGION_BUDGET[member]);
        expect(m.details, "one closed disclosure on the screen").toBe(1);
        /* Behind the disclosures too: no surface inside a surface under the tightened faint limit
           (fill >= 0.012, border >= 0.02). Opened for the check, then closed again. */
        const opened = await page.evaluate(() => {
          const closed = [...document.querySelectorAll("main details:not([open])")] as HTMLDetailsElement[];
          closed.forEach((d) => {
            d.setAttribute("data-e2e-opened", "");
            d.open = true;
          });
          return closed.length;
        });
        expect(await nestedSurfaces(page, BROAD_RULE), `nested surfaces with ${opened} disclosure(s) opened`).toEqual([]);
        await page.evaluate(() =>
          document.querySelectorAll<HTMLDetailsElement>("main details[data-e2e-opened]").forEach((d) => {
            d.removeAttribute("data-e2e-opened");
            d.open = false;
          }),
        );

        /* The honesty fix: one line says what built today's session, and nothing contradicts it. */
        const main = page.locator("main");
        await expect(main).not.toContainText(/No executable Program Horizon/i);
        await expect(main).not.toContainText(/did not create a generic workout/i);
        await expect(main).not.toContainText(/Active program resolution/i);
        await expect(main).not.toContainText(/Execute today/i);
        /* Command center: no intent sentence, no phases row (the horizon has them), no five stacked disclosures. */
        await expect(main).not.toContainText(/Today's intent/i);
        await expect(main).not.toContainText(/Pre-session checks|Before and after|Reserve Calendar Intelligence|Performance Itinerary/i);
        const source = page.locator('[data-training="program-source"]').filter({ visible: true });
        if (member === "active") {
          await expect(source).toContainText(/Built from your split/i);
          await expect(page.locator("[data-room-statement]").filter({ visible: true })).toHaveText(/^Pull\.$/i);
        } else {
          await expect(source).toContainText(/No plan set/i);
          await expect(page.locator("[data-room-statement]").filter({ visible: true })).toHaveText(/^No plan yet\.$/i);
        }

        if (vp.touch) {
          /* The last thing on the page scrolls clear of the tab bar. */
          const clear = await page.evaluate(async () => {
            const bar = document.querySelector('nav[data-shell="tab-bar"]');
            const footer = [...document.querySelectorAll("main footer")].pop();
            if (!bar || !footer) return { ok: true, detail: "no tab bar or footer" };
            window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" });
            await new Promise((r) => setTimeout(r, 200));
            window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" });
            await new Promise((r) => setTimeout(r, 400));
            const barTop = bar.getBoundingClientRect().top;
            const bottom = footer.getBoundingClientRect().bottom;
            return { ok: bottom <= barTop + 1, detail: `footer bottom ${bottom} · tab bar top ${barTop}` };
          });
          expect(clear.ok, clear.detail).toBe(true);
        }

        expect(pageErrors.filter((e) => /Hydration/i.test(e)), "hydration errors").toEqual([]);
      });
    }

    test("active: Start Session reaches the live cockpit", async ({ page }) => {
      test.setTimeout(240_000);
      await boot(page, "active");
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
      await expect(start).toHaveCount(0);
      await expect(page.locator('[data-training="program-source"]').filter({ visible: true })).toContainText(/This session · built from/i);
    });

    test("active: the movements are on screen, and conditioning opens its choices in a sheet", async ({ page }) => {
      test.setTimeout(240_000);
      await boot(page, "active");
      const today = page.locator('[data-training="today"]').filter({ visible: true });
      await expect(today.locator('ol[aria-label="Today\'s movements"] li').first()).toBeVisible();
      const cardio = today.locator("#training-conditioning");
      const before = (await cardio.innerText()).trim();
      await expect(async () => {
        await cardio.click();
        await expect(page.getByRole("dialog", { name: /conditioning/i })).toBeVisible({ timeout: 2_000 });
      }).toPass({ timeout: 60_000 });
      const sheet = page.getByRole("dialog", { name: /conditioning/i });
      const other = sheet.locator('button[aria-pressed="false"]').first();
      const name = (await other.locator("span span").first().innerText()).trim();
      await other.click();
      await expect(sheet).toHaveCount(0);
      await expect(cardio).toContainText(name);
      expect(before).not.toContain(name);
    });

    test("fresh: the gold action opens the split chooser", async ({ page }) => {
      test.setTimeout(240_000);
      await boot(page, "fresh");
      const choose = page.locator('[data-training="primary-action"] button').filter({ visible: true });
      await expect(choose).toHaveText(/^choose your split$/i);
      await expect(async () => {
        await choose.click();
        await expect(page.locator("#training-split-architect")).toBeVisible({ timeout: 2_000 });
      }).toPass({ timeout: 60_000 });
    });
  });
}

/* ══ LIVE AND CLOSE-OUT — the same bar, mid-set and after ═══════════════════
   Live, the member sees the movement, set N of M, reps / load / effort, the
   rest clock, one gold Log Set, the next movement and End Workout. Everything
   else sits behind one "Session tools" disclosure or a sheet. After close-out:
   the numbers, how it was logged, the meal window, the next session, one gold. */

/** Live measured ~6,900 chars across 15 regions before this pass; after close-out ~6,500 across 10. */
const LIVE_TEXT_BUDGET = 1500;
const POST_TEXT_BUDGET = 1300;
/** Hero, cockpit, the session clock, Details, and the member's own cycle section. */
const LIVE_REGION_BUDGET = 5;
/** Hero, close-out, Details, and the member's own cycle section. */
const POST_REGION_BUDGET = 4;

const discard = (page: Page) => page.getByRole("alertdialog", { name: "Discard unsaved changes" });

async function enterLive(page: Page) {
  const start = page.locator('[data-training="primary-action"] button').filter({ visible: true });
  await expect(async () => {
    await start.click();
    await expect(page.getByRole("heading", { name: "Pre-Session Command" })).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 60_000 });
  await expect(async () => {
    await start.click();
    await expect(page.locator("#training-cockpit")).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 60_000 });
}

/** Opens the logger from the cockpit and types 10 reps. */
async function openLoggerWithTenReps(page: Page) {
  const cockpit = page.locator("#training-cockpit");
  await cockpit.getByRole("button", { name: /^Log Set \d+ of \d+$/ }).click();
  const logger = page.getByRole("dialog", { name: /^Log set · / });
  await expect(logger).toBeVisible();
  const reps = logger.getByRole("textbox", { name: "Reps" });
  await reps.fill("10");
  await expect(reps).toHaveValue("10");
  const logButton = logger.getByRole("button", { name: /^Log Set$/ });
  await expect(logButton).toBeVisible();
  return { logger, logButton, reps };
}

/** Every visible control in main carries a name. */
function unnamedControls(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll("main button, main a[href], main summary, main [role=button]")]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && !(el.getAttribute("aria-label") || el.textContent || el.getAttribute("title") || "").trim();
      })
      .map((el) => el.outerHTML.slice(0, 80)),
  );
}

/** On a phone, the screen's gold action and the page's last line both clear the tab bar. */
function phoneClearance(page: Page, selector: string) {
  return page.evaluate(async (sel) => {
    const bar = document.querySelector('nav[data-shell="tab-bar"]');
    if (!bar) return { ok: true, detail: "no tab bar" };
    const action = document.querySelector(sel);
    action?.scrollIntoView({ block: "center", behavior: "instant" });
    await new Promise((r) => setTimeout(r, 300));
    const barTop = bar.getBoundingClientRect().top;
    const actionBottom = action ? action.getBoundingClientRect().bottom : 0;
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" });
    await new Promise((r) => setTimeout(r, 400));
    const footer = [...document.querySelectorAll("main footer")].pop();
    const footerBottom = footer ? footer.getBoundingClientRect().bottom : 0;
    window.scrollTo({ top: 0, behavior: "instant" });
    return {
      ok: Boolean(action) && actionBottom <= barTop + 1 && footerBottom <= barTop + 1,
      detail: `action bottom ${actionBottom} · footer bottom ${footerBottom} · tab bar top ${barTop}`,
    };
  }, selector);
}

for (const vp of VIEWPORTS) {
  test.describe(`training live and close-out at ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.touch, isMobile: vp.touch });

    test("live: one h1, one gold Log Set, no nesting, inside the budget, nothing behind the tab bar", async ({ page }) => {
      test.setTimeout(300_000);
      const pageErrors: string[] = [];
      page.on("pageerror", (e) => pageErrors.push(e.message));
      await boot(page, "active");
      await enterLive(page);
      await scrollThrough(page);
      const m = await measure(page);

      expect(m.h1, "visible h1 count").toBe(1);
      expect(m.goldText, "gold actions by text colour").toHaveLength(1);
      expect(m.goldText[0]).toMatch(/^Log Set 1 of \d+$/);
      expect(m.goldFill, "gold actions by background fill").toEqual(m.goldText);
      expect(m.nested, "surfaces nested inside another surface (broad rule)").toEqual([]);
      expect(m.longParagraphs, "paragraphs over 240 characters").toEqual([]);
      expect(m.overflow, "sideways scroll").toBeLessThanOrEqual(1);
      expect(m.chars, `text in main (budget ${LIVE_TEXT_BUDGET})`).toBeLessThanOrEqual(LIVE_TEXT_BUDGET);
      expect(m.regions, `first-level regions (budget ${LIVE_REGION_BUDGET})`).toBeLessThanOrEqual(LIVE_REGION_BUDGET);
      expect(m.details, "one closed disclosure on the screen").toBe(1);
      expect(await unnamedControls(page), "controls without a name").toEqual([]);

      const cockpit = page.locator("#training-cockpit");
      await expect(cockpit.locator('[data-training="set-count"]')).toContainText(/^Set\s*1\/\d+/);
      await expect(cockpit.locator('[data-training="rest-timer"]')).toContainText(/between sets/i);
      await expect(cockpit.getByRole("button", { name: /^End Workout$/ })).toBeVisible();
      await expect(page.locator("main")).not.toContainText(
        /Coach Light Mode|Reserve Anatomy HUD|Session Demand|Stack Status|Execution Status|Mission Runway|Live Workout Mode|Session Architecture/i,
      );

      if (vp.touch) {
        const clear = await phoneClearance(page, '[data-training="log-set"]');
        expect(clear.ok, clear.detail).toBe(true);
      }
      expect(pageErrors, "page errors").toEqual([]);
    });

    test("live: a set logs end to end, the typed set survives an outside click, and the rest timer runs", async ({ page }) => {
      test.setTimeout(300_000);
      await boot(page, "active");
      await enterLive(page);
      const { logger, logButton, reps } = await openLoggerWithTenReps(page);

      /* The form guard: an outside click keeps the entry; Escape and the X ask first. */
      await page.mouse.click(6, 6);
      await page.waitForTimeout(300);
      await expect(logger).toBeVisible();
      await expect(reps, "the entered reps are kept").toHaveValue("10");
      await page.keyboard.press("Escape");
      await expect(discard(page)).toBeVisible();
      await discard(page).getByRole("button", { name: "Keep Editing" }).click();
      await expect(reps).toHaveValue("10");
      await logger.getByRole("button", { name: "Close" }).click();
      await expect(discard(page)).toBeVisible();
      await discard(page).getByRole("button", { name: "Keep Editing" }).click();
      await expect(reps).toHaveValue("10");

      /* Log Set closes straight back to the cockpit: no second "logged" screen. */
      await logButton.click();
      await expect(logger).toHaveCount(0);

      const cockpit = page.locator("#training-cockpit");
      await expect(cockpit.locator('[data-training="set-confirm"]')).toContainText(/^Set 1 logged · .* × 10$/);
      await expect(cockpit.locator('[data-training="set-count"]')).toContainText(/^Set\s*2\/\d+/);
      await expect(cockpit).toContainText(/× 10/);
      await expect(cockpit.locator('[data-training="rest-timer"]')).toContainText(/\d:\d\d\s*(left of|over)/);
      await expect(page.locator('[data-training="session-metric"]').filter({ visible: true })).toContainText(/^Sets logged/i);

      /* The queue and coaching open as sheets; picking a movement makes it current. */
      await cockpit.getByRole("button", { name: "All Movements" }).click();
      const queue = page.getByRole("dialog", { name: "All movements" });
      await expect(queue).toBeVisible();
      const second = queue.getByRole("listitem").nth(1).getByRole("button");
      const secondName = (await second.locator("span span").first().innerText()).trim();
      await second.click();
      await expect(queue).toHaveCount(0);
      await expect(cockpit.getByRole("heading", { level: 3 })).toHaveText(secondName);
      await cockpit.getByRole("button", { name: "Coaching" }).click();
      await expect(page.getByRole("dialog", { name: /^Coaching · / })).toBeVisible();
    });

    test("logger: prefilled values log in two taps — one gold, no boxes, named controls, clear of the tab bar", async ({ page }) => {
      test.setTimeout(300_000);
      const pageErrors: string[] = [];
      page.on("pageerror", (e) => pageErrors.push(e.message));
      await boot(page, "active");
      await enterLive(page);
      const cockpit = page.locator("#training-cockpit");
      await expect(cockpit.locator('[data-training="set-count"]')).toContainText(/^Set\s*1\/\d+/);

      /* Tap 1: open. */
      await cockpit.getByRole("button", { name: /^Log Set 1 of \d+$/ }).click();
      const logger = page.getByRole("dialog", { name: /^Log set · / });
      await expect(logger).toBeVisible();
      const reps = logger.getByRole("textbox", { name: "Reps" });
      await expect(reps, "reps are prefilled").toHaveValue(/^\d+$/);
      await expect(logger.getByRole("textbox", { name: "Load" })).toBeVisible();
      await expect(logger.getByRole("tablist", { name: "Reps in reserve" })).toBeVisible();
      /* Coaching lives in its sheet: no brief, no load chips, no plate math, no second step. */
      await expect(logger).not.toContainText(/Brief|Load Recommendation|Plate Math|Calibration Required|Edit Mistakes/i);

      /* The logger's controls scale in; measure them where they come to rest. */
      await settleAnimations(page);
      const bar = await logger.evaluate((dialog, kitSource) => {
        const kit = new Function(`return (${kitSource})()`)() as GoldKit;
        const visible = (el: Element) => {
          const r = el.getBoundingClientRect();
          const cs = getComputedStyle(el);
          return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none";
        };
        const controls = [...dialog.querySelectorAll("button, input, [role=tab]")].filter(visible);
        const gold = controls.filter((c) => kit.isInk(getComputedStyle(c).color));
        return {
          gold: gold.map((c) => (c.textContent ?? "").trim()),
          unnamed: controls
            .filter((c) => !((c.getAttribute("aria-label") || c.textContent || c.getAttribute("title") || "").trim()) && !(c.id && dialog.querySelector(`label[for="${c.id}"]`)))
            .map((c) => c.outerHTML.slice(0, 80)),
          small: controls
            .filter((c) => {
              const r = c.getBoundingClientRect();
              return r.width < 44 || r.height < 44;
            })
            .map((c) => `${(c.getAttribute("aria-label") || c.textContent || "").trim()} ${Math.round(c.getBoundingClientRect().width)}×${Math.round(c.getBoundingClientRect().height)}`),
          smallInputs: [...dialog.querySelectorAll("input")].filter((i) => parseFloat(getComputedStyle(i).fontSize) < 16).map((i) => i.id),
          keyboards: [...dialog.querySelectorAll("input")].map((i) => i.inputMode),
          chars: (dialog as HTMLElement).innerText.replace(/\s+/g, " ").trim().length,
          goldBottom: gold[0]?.getBoundingClientRect().bottom ?? Infinity,
          viewport: window.innerHeight,
        };
      }, GOLD_KIT_SOURCE);
      expect(bar.gold, "one gold action in the logger").toEqual(["Log Set"]);
      /* The broad rule inside the sheet: the sheet is the root, so the dialog skip does not apply to its own contents. */
      const loggerNested = await nestedSurfaces(logger, { ...BROAD_RULE, skipClosedDisclosures: false, insideControls: ":not(*)" });
      expect(loggerNested, "surfaces nested inside the logger sheet (broad rule)").toEqual([]);
      expect(bar.unnamed, "logger controls without a name").toEqual([]);
      expect(bar.small, "logger touch targets under 44px").toEqual([]);
      expect(bar.smallInputs, "logger inputs under 16px").toEqual([]);
      expect(bar.keyboards, "numeric keyboards for reps and load").toEqual(["numeric", "decimal"]);
      expect(bar.chars, "text in the logger").toBeLessThanOrEqual(220);
      expect(bar.goldBottom, "Log Set is on screen").toBeLessThanOrEqual(bar.viewport);
      if (vp.touch) {
        await expect(page.locator('nav[data-shell="tab-bar"]'), "the tab bar steps aside for the sheet").toBeHidden();
      }
      const prefilled = await reps.inputValue();

      /* Tap 2: log. The sheet closes, the cockpit confirms, the rest clock runs. */
      await logger.getByRole("button", { name: /^Log Set$/ }).click();
      await expect(logger).toHaveCount(0);
      await expect(cockpit.locator('[data-training="set-count"]')).toContainText(/^Set\s*2\/\d+/);
      const line = new RegExp(`^Set 1 logged · .* × ${prefilled}$`);
      await expect(cockpit.locator('[data-training="set-confirm"]')).toContainText(line);
      await expect(cockpit.getByRole("status")).toHaveText(line);
      await expect(cockpit.locator('[data-training="rest-timer"]')).toContainText(/\d:\d\d\s*(left of|over)/);
      await expect(cockpit.locator('[data-training="set-confirm"]'), "the moment passes").toHaveCount(0, { timeout: 6_000 });
      const stored = await page.evaluate(() => {
        const state = JSON.parse(window.localStorage.getItem("final-boss-athlete-settings") ?? "{}").state;
        return Object.values((state?.trainingSession?.workoutSets ?? {}) as Record<string, unknown[]>).flat().length;
      });
      expect(stored, "sets in the store").toBe(1);

      /* Reopen: the logged set is editable, and Undo Last puts its numbers back in the fields. */
      await cockpit.getByRole("button", { name: /^Log Set 2 of \d+$/ }).click();
      await expect(logger).toBeVisible();
      await expect(logger.getByRole("button", { name: /^Edit set 1 · / })).toBeVisible();
      await logger.getByRole("button", { name: "Undo Last" }).click();
      await expect(logger.getByRole("button", { name: /^Edit set 1 · / })).toHaveCount(0);
      await expect(logger.getByRole("textbox", { name: "Reps" })).toHaveValue(prefilled);
      await page.keyboard.press("Escape");
      await expect(logger).toHaveCount(0);
      await expect(cockpit.locator('[data-training="set-count"]')).toContainText(/^Set\s*1\/\d+/);
      expect(pageErrors, "page errors").toEqual([]);
    });

    test("logger: under reduced motion the logged set confirms with no animation", async ({ page }) => {
      test.setTimeout(300_000);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await boot(page, "active");
      await enterLive(page);
      const cockpit = page.locator("#training-cockpit");
      await cockpit.getByRole("button", { name: /^Log Set 1 of \d+$/ }).click();
      const logger = page.getByRole("dialog", { name: /^Log set · / });
      await logger.getByRole("button", { name: /^Log Set$/ }).click();
      await expect(logger).toHaveCount(0);
      const confirm = cockpit.locator('[data-training="set-confirm"]');
      await expect(confirm).toBeVisible();
      await expect(confirm).toHaveAttribute("data-motion", "reduced");
      const still = await cockpit.locator('[data-training="rest-timer"]').evaluate((row) => ({
        running: row.getAnimations({ subtree: true }).length,
        styled: [...row.querySelectorAll("[style]")].filter((el) => /opacity|transform|pathLength|stroke-dash/i.test(el.getAttribute("style") ?? "")).length,
      }));
      expect(still, "no animations and no animated styles on the confirmation").toEqual({ running: 0, styled: 0 });
    });

    test("session tools: opened, nothing is boxed, and every tool still works", async ({ page }) => {
      test.setTimeout(300_000);
      await boot(page, "active");
      await enterLive(page);
      const details = page.locator('[data-training="details"]').filter({ visible: true });
      const summary = details.locator("summary");
      await expect(summary).toHaveText(/Session tools/i);
      await expect(async () => {
        await summary.click();
        await expect(details.getByRole("button", { name: "Add Movement" })).toBeVisible({ timeout: 2_000 });
      }).toPass({ timeout: 30_000 });

      const opened = await details.evaluate((root) => {
        const longLines = [...root.querySelectorAll("p, span, dd, li")]
          .filter((el) => el.children.length === 0)
          .map((el) => (el as HTMLElement).innerText.replace(/\s+/g, " ").trim())
          .filter((t) => t.length > 140);
        const smallFields = [...root.querySelectorAll("input, textarea")].filter((f) => parseFloat(getComputedStyle(f).fontSize) < 16).map((f) => f.getAttribute("aria-label"));
        return { longLines, smallFields, chars: (root as HTMLElement).innerText.replace(/\s+/g, " ").trim().length };
      });
      /* Stricter than the broad rule: any rounded (≥6px) element with a border, fill or shadow counts, at any size. */
      const toolBoxes = await boxesWithin(details, { ...ANY_BOX_RULE, controls: "button, a, input, select, textarea, summary, label, img, svg, video, canvas" });
      expect(toolBoxes, "boxes drawn inside Session tools").toEqual([]);
      expect(opened.longLines, "explanatory lines over 140 characters").toEqual([]);
      expect(opened.smallFields, "fields under 16px").toEqual([]);
      expect(opened.chars, "text in Session tools").toBeLessThanOrEqual(1000);
      await expect(details).not.toContainText(/Session Execution Ledger|Original plan preserved|Started snapshot frozen|Skip current movement|dosing/i);

      /* Every tool still works: key sets, notes, add movement and log its set, the cardio sheet. */
      const logging = details.getByRole("region", { name: "Logging" });
      await logging.getByRole("button", { name: "Turn On" }).click();
      await expect(logging.getByRole("button", { name: "Turn Off" })).toBeVisible();

      await details.getByRole("textbox", { name: "Session execution notes" }).fill("Left elbow warm by set two.");
      await details.getByRole("button", { name: "Save" }).click();
      await expect
        .poll(() => page.evaluate(() => JSON.parse(window.localStorage.getItem("final-boss-athlete-settings") ?? "{}").state?.trainingSession?.executionRecord?.sessionMetrics?.athleteNotes ?? ""))
        .toBe("Left elbow warm by set two.");

      await details.getByRole("button", { name: "Add Movement" }).click();
      await details.getByRole("textbox", { name: "Added movement name" }).fill("Face Pull");
      await details.getByRole("textbox", { name: "Added movement reps" }).fill("15");
      await details.getByRole("button", { name: "Add Movement" }).click();
      await expect(details).toContainText(/Face Pull · added/);
      await details.getByRole("button", { name: "Log a set · Face Pull" }).click();
      await expect(details.getByRole("listitem").filter({ hasText: "Face Pull" })).toContainText(/1 sets/);

      await details.getByRole("button", { name: /^Cardio/ }).click();
      await expect(page.getByRole("dialog", { name: /conditioning/i })).toBeVisible();
    });

    test("after: close-out saves, and the close-out screen holds the bar", async ({ page }) => {
      test.setTimeout(300_000);
      const pageErrors: string[] = [];
      page.on("pageerror", (e) => pageErrors.push(e.message));
      await boot(page, "active");
      await enterLive(page);
      const { logger, logButton } = await openLoggerWithTenReps(page);
      await logButton.click();
      await expect(logger).toHaveCount(0);

      await page.locator("#training-cockpit").getByRole("button", { name: /^End Workout$/ }).click();
      const closeout = page.getByRole("dialog", { name: "Close out session" });
      await closeout.getByRole("button", { name: /fully accurate/i }).click();
      await closeout.getByRole("button", { name: /completed as planned/i }).click();
      await expect(closeout).toHaveCount(0);

      const panel = page.locator('[data-training="closeout"]').filter({ visible: true });
      await expect(panel).toBeVisible({ timeout: 30_000 });
      await expect(panel).toContainText(/Volume/);
      await expect(panel).toContainText(/Fully Accurate · Completed As Planned/i);
      await expect(panel).toContainText(/Next session/i);
      /* Saved: the durable training log carries the set. */
      const saved = await page.evaluate(() => (window.localStorage.getItem("fba.logs.training.v1") ?? "").includes('"reps":10'));
      expect(saved, "the closed session is in the durable training log").toBe(true);

      await scrollThrough(page);
      const m = await measure(page);
      expect(m.h1, "visible h1 count").toBe(1);
      expect(m.goldText, "gold actions by text colour").toEqual(["Log Recovery Meal"]);
      expect(m.goldFill, "gold actions by background fill").toEqual(["Log Recovery Meal"]);
      expect(m.nested, "surfaces nested inside another surface (broad rule)").toEqual([]);
      expect(m.longParagraphs, "paragraphs over 240 characters").toEqual([]);
      expect(m.overflow, "sideways scroll").toBeLessThanOrEqual(1);
      expect(m.chars, `text in main (budget ${POST_TEXT_BUDGET})`).toBeLessThanOrEqual(POST_TEXT_BUDGET);
      expect(m.regions, `first-level regions (budget ${POST_REGION_BUDGET})`).toBeLessThanOrEqual(POST_REGION_BUDGET);
      expect(m.details, "one closed disclosure on the screen").toBe(1);
      expect(await unnamedControls(page), "controls without a name").toEqual([]);
      await expect(page.locator("main")).not.toContainText(/Post-Workout Handoff|Mission Completion Review|Reserve Night Brief|Phase Completion|Session Rating/i);

      if (vp.touch) {
        const clear = await phoneClearance(page, '[data-training="closeout"] button');
        expect(clear.ok, clear.detail).toBe(true);
      }

      /* The session record, opened: rows only, read-only, and Reset Day is there. */
      const record = page.locator('[data-training="details"]').filter({ visible: true });
      await expect(async () => {
        await record.locator("summary").click();
        await expect(record.getByRole("region", { name: "Planned versus done" })).toBeVisible({ timeout: 2_000 });
      }).toPass({ timeout: 30_000 });
      const boxes = await boxesWithin(record, { ...ANY_BOX_RULE, controls: "button, a, input, select, textarea, summary, label, img, svg" });
      expect(boxes, "boxes drawn inside the session record").toEqual([]);
      await expect(record.getByRole("button", { name: "Add Movement" }), "a locked record takes no new work").toHaveCount(0);
      await expect(record.getByRole("button", { name: /Reset Day/ })).toBeVisible();
      expect(pageErrors, "page errors").toEqual([]);
    });
  });
}
