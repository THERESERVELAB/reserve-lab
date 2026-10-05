import { test, expect, type Page } from "@playwright/test";

import { SAFETY_ACK_VERSION } from "../../src/lib/safety/acknowledgement";
import { BROAD_RULE, nestedSurfaces } from "./support/surface-nesting";
import { GOLD_KIT_SOURCE, type GoldKit } from "./support/gold-action";

/**
 * WAVE: NUTRITION + PERSONAL COMMAND — both screens held to the simplified Apex bar.
 *
 * For an ACTIVE member (split chosen, recovery logs, a logged cycle with the
 * safety acknowledgement accepted) and a FRESH member (no split, no logs), at
 * 1280×900 and 390×844 with touch:
 *
 *   · exactly one h1
 *   · exactly one gold action, by BOTH detections: near-black text, and a gold
 *     background fill
 *   · no surface inside another under the BROAD rule — a rounded element with
 *     a border OR a non-transparent background OR a box-shadow, inside another
 *     such element. Content behind a closed disclosure is not on screen.
 *   · no paragraph over 240 characters, no sideways scroll
 *   · a text budget (Apex is ~1.9k; Nutrition was 18.9k, Personal Command 23.1k)
 *   · nothing on a phone ends up behind the tab bar
 *
 * And the behaviour the redesign must keep:
 *   · Nutrition: a meal row's Log still opens the meal confirmation, and the
 *     meal counts only once confirmed; the row's detail opens in a sheet
 *   · Personal Command: the gold action opens the chooser as an aria-modal
 *     sheet (it used to scroll a 6,000px page), and a changed chooser keeps its
 *     draft on an outside click; running a protocol from it sets the statement
 */

const KEY = "final-boss-athlete-settings";
/** Tuesday 15 September 2026, 4:12 PM local — a Pull day, the pre-workout meal planned for 4:00 PM. */
const WHEN = new Date(2026, 8, 15, 16, 12, 0);

/** `running`: the active member with a protocol three weeks into its block. */
type MemberState = "active" | "fresh" | "running";
type Screen = { view: "nutrition" | "protocol-command"; name: string; ready: string };

const SCREENS: Screen[] = [
  { view: "nutrition", name: "nutrition", ready: '[data-nutrition="hero"]' },
  { view: "protocol-command", name: "personal command", ready: '[data-protocol="hero"]' },
];

const VIEWPORTS = [
  { name: "1280", width: 1280, height: 900, touch: false },
  { name: "390", width: 390, height: 844, touch: true },
] as const;

const TEXT_BUDGET = 6000;

/** Personal Command as a command center: Apex reads ~1.9k characters; this screen stays under 1k, in at most three regions. */
const PERSONAL_COMMAND = { chars: 1000, regions: 3 };

async function boot(page: Page, screen: Screen, member: MemberState) {
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
    { k: KEY, v: screen.view },
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
    ({ k, iso, member, view, ackVersion }) => {
      const now = new Date(iso);
      const stamp = now.toISOString();
      const dayKey = (offset: number) => {
        const d = new Date(now);
        d.setDate(d.getDate() + offset);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      };
      const parsed = JSON.parse(window.localStorage.getItem(k) as string);
      const s = parsed.state;
      s.activeView = view;
      s.subscriptionTier = "elite";
      const steps: string[] = (s.setupProfile?.completedSteps ?? []).filter((step: string) => step !== "schedule");
      s.setupProfile = { ...s.setupProfile, setupComplete: true, completedAt: stamp, completedSteps: [...steps, "schedule"] };
      s.nutritionPrefs = { ...s.nutritionPrefs, loggedMealIds: [], latestMealLog: null, nutritionLogDate: dayKey(0) };

      if (member === "active" || member === "running") {
        s.recoveryCommand = {
          ...s.recoveryCommand,
          sleepLogs: [7.2, 6.8, 7.6, 8.1, 7.0, 7.9, 7.4].map((hours, i) => ({ date: dayKey(i - 7), hours })),
          hydrationLogs: [{ date: now.toISOString().slice(0, 10), oz: 64 }],
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
        /* The audit's member: women's module on, no sex set. The women's architecture stays closed to them. */
        s.womens = { ...(s.womens || {}), enabled: true };
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
      if (member === "running") {
        s.activeProtocol = {
          protocolId: "ultimate-summer-shred", protocolName: "Ultimate Summer Shred", category: "shred-cut", selectedDate: dayKey(-22), startDate: dayKey(-22),
          targetDate: dayKey(62), durationWeeks: 12, commitmentLevel: "high", trainingDays: 5, cardioDays: 4, mobilityDays: 3, checkInCadence: "Weekly",
          nutritionFocus: "Calorie control, high protein, grocery structure", recoveryFocus: "Sleep + hydration protection", goal: "Fat loss + visible tightening",
          eventName: null, eventType: null, eventDate: null, status: "active", notes: "",
        };
      }
      return JSON.stringify(parsed);
    },
    { k: KEY, iso: WHEN.toISOString(), member, view: screen.view, ackVersion: SAFETY_ACK_VERSION },
  );
  await page.addInitScript(({ k, v }) => window.localStorage.setItem(k, v), { k: KEY, v: patched });
  await page.reload({ waitUntil: "domcontentloaded", timeout: 120_000 });
  await expect(page.locator(screen.ready).filter({ visible: true })).toBeVisible({ timeout: 60_000 });
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

/** The screen's structure, measured from computed styles rather than class names. */
async function measure(page: Page) {
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
        /* The member's own cycle section carries its own standing note; it is not this screen's disclosure. */
        const details = [...main.querySelectorAll("details")].filter(
          (d) => !d.parentElement?.closest("details") && !d.closest("[data-enhanced-room]") && (d as HTMLElement).offsetParent !== null,
        ).length;
        return { regions, details };
      })(),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  }, GOLD_KIT_SOURCE);
  return { ...rest, nested };
}

async function expectRoomBar(page: Page, touch: boolean) {
  await scrollThrough(page);
  const m = await measure(page);

  expect(m.h1, "visible h1 count").toBe(1);
  expect(m.goldText, "gold actions by text colour").toHaveLength(1);
  expect(m.goldFill, "gold actions by background fill").toHaveLength(1);
  expect(m.goldFill[0]).toBe(m.goldText[0]);
  expect(m.nested, "surfaces nested inside another surface (broad rule)").toEqual([]);
  expect(m.longParagraphs, "paragraphs over 240 characters").toEqual([]);
  expect(m.overflow, "sideways scroll").toBeLessThanOrEqual(1);
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
  expect(m.chars, `text in main (budget ${TEXT_BUDGET})`).toBeLessThanOrEqual(TEXT_BUDGET);

  if (touch) {
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
  return m;
}

const gold = (page: Page, attr: "nutrition" | "protocol") =>
  page.locator(`[data-${attr}="primary-action"] button`).filter({ visible: true }).first();

for (const vp of VIEWPORTS) {
  test.describe(`wave nutrition + personal command at ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.touch, isMobile: vp.touch });

    for (const screen of SCREENS) {
      for (const member of ["active", "fresh"] as const) {
        test(`${screen.name} · ${member}: one h1, one gold, no nesting, short paragraphs, inside the text budget`, async ({ page }) => {
          test.setTimeout(240_000);
          const pageErrors: string[] = [];
          page.on("pageerror", (e) => pageErrors.push(e.message));

          await boot(page, screen, member);
          const m = await expectRoomBar(page, vp.touch);

          const main = page.locator("main");
          if (screen.view === "nutrition") {
            /* The honesty fix: one line says what set today's targets; the old "nothing available" panel is gone. */
            await expect(main).not.toContainText(/No active Program Horizon is available/i);
            await expect(main).not.toContainText(/Fuel the system/i);
            await expect(page.locator('[data-nutrition="fuel-source"]').filter({ visible: true })).toContainText(/no Program Horizon set|Program Horizon · Week/);
            if (member === "active") {
              await expect(page.locator("[data-room-statement]").filter({ visible: true })).toHaveText(/pre-workout meal is due · 4:00 PM/i);
              await expect(gold(page, "nutrition")).toHaveText(/^log pre-workout meal$/i);
            }
          } else {
            await expect(page.locator("[data-room-statement]").filter({ visible: true })).toHaveText(/^No protocol is set\.$/);
            await expect(gold(page, "protocol")).toHaveText(/^choose your protocol$/i);
            await expect(main).not.toContainText(/What would sharpen this recommendation/i);
            await expect(main).not.toContainText(/Choose Your Priority/i);
            await expect(page.locator('[data-protocol="recommendation"] [data-detail-image="protocol-blueprint"]')).toHaveCount(1);
            /* A command center: no explanation paragraphs on the screen, every one behind the one Details. */
            expect(m.chars, `personal command text (budget ${PERSONAL_COMMAND.chars})`).toBeLessThanOrEqual(PERSONAL_COMMAND.chars);
            expect(m.regions, "personal command first-level regions").toBeLessThanOrEqual(PERSONAL_COMMAND.regions);
            expect(m.details, "one closed Details disclosure").toBe(1);
            await expect(main).not.toContainText(/The full reasoning|Choose the protocol Reserve organizes around/i);
          }

          expect(pageErrors.filter((e) => /Hydration/i.test(e)), "hydration errors").toEqual([]);
        });
      }
    }

    test("nutrition: a meal row's Log still opens the confirmation, and the meal counts once confirmed", async ({ page }) => {
      test.setTimeout(240_000);
      await boot(page, SCREENS[0], "active");
      const protein = page.locator('[data-nutrition="protein"]').filter({ visible: true });
      await expect(protein).toContainText("0 of");

      const row = page.locator('[data-nutrition="meals"] li').filter({ hasText: /pre-workout/i }).first();
      await row.scrollIntoViewIfNeeded();
      /* The row's detail opens in a sheet, and nothing is logged by opening it. */
      await expect(async () => {
        await row.locator('button[aria-haspopup="dialog"]').click();
        await expect(page.getByRole("dialog")).toBeVisible({ timeout: 2_000 });
      }).toPass({ timeout: 60_000 });
      await expect(page.getByRole("dialog").getByRole("button", { name: /^swap$/i })).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);

      await row.locator('[data-fuel="log-meal"] button').click();
      const drawer = page.getByRole("dialog", { name: /meal confirmation/i });
      await expect(drawer).toBeVisible();
      await expect(protein).toContainText("0 of");
      await drawer.getByRole("button", { name: /confirm log meal/i }).click();
      await drawer.getByRole("button", { name: /^done$/i }).click();
      await expect(drawer).toHaveCount(0);

      await expect(protein).toContainText("1 of");
      await expect(row.locator('[data-fuel="log-meal"] button')).toHaveText(/undo/i);
      await expect(gold(page, "nutrition")).toHaveText(/^log post-workout meal$/i);
    });

    test("personal command: the chooser opens as an aria-modal sheet and keeps a draft on outside click", async ({ page }) => {
      test.setTimeout(240_000);
      await boot(page, SCREENS[1], "active");

      await expect(async () => {
        await gold(page, "protocol").click();
        await expect(page.getByRole("dialog", { name: /choose your protocol/i })).toBeVisible({ timeout: 2_000 });
      }).toPass({ timeout: 60_000 });
      const sheet = page.getByRole("dialog", { name: /choose your protocol/i });
      await expect(sheet).toHaveAttribute("aria-modal", "true");
      /* A member with no sex set is not shown the women's architecture. */
      await expect(sheet).not.toContainText(/Runway Shape|Glute Ascend/i);

      const firstGoal = sheet.getByRole("radio").first();
      const goalName = (await firstGoal.innerText()).split("\n")[0];
      await firstGoal.click();
      await expect(firstGoal).toHaveAttribute("aria-checked", "true");

      /* An outside click on the backdrop: the sheet stays, and so does the choice. */
      await page.mouse.click(8, 8);
      await expect(sheet).toBeVisible();
      await expect(sheet.getByRole("radio", { name: new RegExp(goalName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) }).first()).toHaveAttribute("aria-checked", "true");

      /* Escape asks before discarding the draft. */
      await page.keyboard.press("Escape");
      await expect(page.getByRole("alertdialog", { name: "Discard unsaved changes" })).toBeVisible();
    });

    test("personal command · running: the block is rows, one Details, inside the budget", async ({ page }) => {
      test.setTimeout(240_000);
      await boot(page, SCREENS[1], "running");
      const m = await expectRoomBar(page, vp.touch);
      await expect(page.locator("[data-room-statement]").filter({ visible: true })).toHaveText(/^Week \d+ of 12 on Ultimate Summer Shred\.$/);
      expect(m.chars, `personal command text (budget ${PERSONAL_COMMAND.chars})`).toBeLessThanOrEqual(PERSONAL_COMMAND.chars);
      expect(m.regions, "personal command first-level regions").toBeLessThanOrEqual(PERSONAL_COMMAND.regions);
      expect(m.details, "one closed Details disclosure").toBe(1);

      const block = page.locator('[data-protocol="block"]').filter({ visible: true });
      await expect(block.locator('[data-detail-image="protocol-blueprint"]')).toHaveCount(1);
      /* The recommendation panel is for choosing; a running block does not repeat it. */
      await expect(page.locator('[data-protocol="recommendation"]')).toHaveCount(0);
      /* The target date row opens its form sheet; the protocol row opens the library. */
      await expect(async () => {
        await block.getByRole("button", { name: /^Target/ }).click();
        await expect(page.getByRole("dialog", { name: /target date/i })).toBeVisible({ timeout: 2_000 });
      }).toPass({ timeout: 60_000 });
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await block.getByRole("button", { name: /^Protocol/ }).click();
      await expect(page.getByRole("dialog", { name: /choose your protocol/i })).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);

      /* Completing ends the block, so it asks first — and Keep Running changes nothing. */
      await block.getByRole("button", { name: /^Complete Protocol$/ }).click();
      const confirm = page.getByRole("dialog", { name: /complete protocol/i });
      await expect(confirm).toContainText(/End Ultimate Summer Shred at week \d+ of 12\?/);
      await confirm.getByRole("button", { name: /^Keep Running$/ }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(page.locator("[data-room-statement]").filter({ visible: true })).toHaveText(/^Week \d+ of 12 on Ultimate Summer Shred\.$/);

      /* Details keeps why the block fits and hands the week-by-week reasoning to Program Horizon. */
      await page.locator('[data-protocol="details"] summary').click();
      const details = page.locator('[data-protocol="details"]');
      await expect(details).toContainText(/Why it fits/i);
      await expect(details.getByText(/^(Recovery demand|Nutrition demand|What the split will do|Aligns)$/i)).toHaveCount(0);
      await expect(details.getByRole("button", { name: /Program Horizon/ })).toBeVisible();
    });

    test("personal command: running a protocol from the chooser sets the statement and keeps the bar", async ({ page }) => {
      test.setTimeout(240_000);
      await boot(page, SCREENS[1], "fresh");

      await expect(async () => {
        await gold(page, "protocol").click();
        await expect(page.getByRole("dialog", { name: /choose your protocol/i })).toBeVisible({ timeout: 2_000 });
      }).toPass({ timeout: 60_000 });
      const sheet = page.getByRole("dialog", { name: /choose your protocol/i });
      /* Straight to the protocol step: the priorities are optional. */
      await sheet.getByRole("button", { name: /^Step 4: Protocol$/ }).click();
      const pick = sheet.locator("[data-chooser-protocol]").first();
      const name = (await pick.getAttribute("data-chooser-protocol")) ?? "";
      await pick.click();
      await sheet.getByRole("button", { name: /run this protocol/i }).click();
      await expect(sheet).toHaveCount(0);

      await expect(page.locator("[data-room-statement]").filter({ visible: true })).toContainText(name);
      await expectRoomBar(page, vp.touch);
    });
  });
}
