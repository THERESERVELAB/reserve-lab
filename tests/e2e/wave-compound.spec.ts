import { test, expect, type Locator, type Page } from "@playwright/test";

import { SAFETY_ACK_VERSION } from "../../src/lib/safety/acknowledgement";
import { BROAD_RULE, nestedSurfaces } from "./support/surface-nesting";
import { GOLD_KIT_SOURCE, type GoldKit } from "./support/gold-action";

/**
 * WAVE: COMPOUND COMMAND — held to the simplified Apex bar.
 *
 * Two members at 1280×900 and 390×844 (touch):
 *
 *   active  three logged compounds (one due now, one logged this morning, one
 *           later tonight), a 12-week cycle at week 6 with a checkpoint, a
 *           flagged lab, and the current safety acknowledgement
 *   fresh   a Reserve Black member who has logged nothing
 *
 * Every state and width:
 *   · exactly one h1
 *   · exactly one gold action, by text colour rgb(10, 11, 16) AND by gold
 *     fill (tel: / sms: links are the escalation ladder, not actions)
 *   · no surface inside another under the BROAD rule (border OR background OR
 *     shadow), closed disclosures skipped
 *   · no paragraph over 240 characters, no sideways scroll, no unnamed buttons
 *
 * ONE DOCUMENTED EXCEPTION: the Cycle Brief (`components/cycle/**`) is owned
 * by the safety session and is not edited by this wave. Its own inner
 * "Warning signs" block and care options sit inside its glass panel, so its
 * subtree is excluded from the nesting and paragraph checks and reported to
 * the owner. Everything around it is held to the rule.
 *
 * Plus: the room has FOUR destinations and no more — Today, Plan, Cycle &
 * Safety and More, with five places listed under More. Registry, Schedule,
 * Inventory, the Injection Map and Dose Math were five separate lists of the
 * same entries; they are now Plan's two views and a compound's own sheet.
 * The Cycle Brief still leads Today and its buttons still land somewhere
 * sensible; Dose Math still calculates; the gold action logs what is due, or
 * opens the editor.
 *
 * With RESERVE_E2E_SAFETY_TOOLS=off the Cycle Brief assertions skip.
 */

const KEY = "final-boss-athlete-settings";
/** Tuesday 15 September 2026, 4:12 PM local. */
const WHEN = new Date(2026, 8, 15, 16, 12, 0);
const SWITCH_OFF = process.env.RESERVE_E2E_SAFETY_TOOLS === "off";
const SHOTS = process.env.WAVE_COMPOUND_SHOTS;

type Member = "active" | "fresh";

async function boot(page: Page, member: Member) {
  await page.clock.setFixedTime(WHEN);
  await page.addInitScript(
    ({ k }) => {
      window.localStorage.setItem("fba-preview-view", "supplements");
      const raw = window.localStorage.getItem(k);
      const parsed = raw ? JSON.parse(raw) : { state: {}, version: 0 };
      parsed.state = {
        ...parsed.state,
        subscriptionTier: "elite",
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
      return Boolean(state?.trainingSession && state?.setupProfile && state?.recoveryCommand);
    },
    KEY,
    { timeout: 60_000 },
  );

  const patched = await page.evaluate(
    ({ k, iso, member, ackVersion }) => {
      const now = new Date(iso);
      const stamp = now.toISOString();
      const dayKey = (offset: number) => {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      };
      const parsed = JSON.parse(window.localStorage.getItem(k) as string);
      const s = parsed.state;
      s.activeView = "supplements";
      s.subscriptionTier = "elite";
      const steps: string[] = (s.setupProfile?.completedSteps ?? []).filter((step: string) => step !== "schedule");
      s.setupProfile = { ...s.setupProfile, age: 34, setupComplete: true, completedAt: stamp, completedSteps: [...steps, "schedule"] };
      s.cyclePeriods = [];
      s.bloodworkLogs = [];
      s.cycleCheckIns = [];
      s.redFlagReports = [];
      s.supportPlan = [];
      s.safetyAcknowledgement = null;
      s.trainingSession = { ...s.trainingSession, enhancementLog: [], enhancementAdherence: [], injectionLogs: [], compoundSupportLinks: [] };

      if (member === "active") {
        const entry = (id: string, name: string, extra: Record<string, unknown>) => ({
          id, name, doseAmount: "", doseUnit: "", frequency: "daily", frequencyType: "daily", scheduleRule: { type: "daily" },
          timingPreference: "", timeOfDayPreference: "custom", goalAssociation: [], isActive: true, createdAt: stamp, updatedAt: stamp, ...extra,
        });
        s.trainingSession.enhancementLog = [
          entry("e2e-test", "Testosterone Cypionate", {
            officialName: "Testosterone Cypionate", compoundClass: "hormones_testosterone", category: "hormone", route: "injectable", injectionType: "im", customTime: "08:00",
          }),
          entry("e2e-creatine", "Creatine", { category: "supplement", route: "oral", customTime: "16:00" }),
          entry("e2e-magnesium", "Magnesium", { category: "supplement", route: "oral", customTime: "21:00" }),
        ];
        s.trainingSession.enhancementAdherence = [
          { id: "e2e-adh", entryId: "e2e-test", date: dayKey(0), plannedTime: "08:00", takenStatus: "taken", actualTime: "08:05", createdAt: stamp },
        ];
        s.cyclePeriods = [
          {
            id: "e2e-cycle", name: "Autumn block", startDate: dayKey(-38), plannedWeeks: 12, compoundIds: ["e2e-test"], clinicianOversight: true,
            checkpoints: [{ id: "e2e-cp", date: dayKey(10), label: "Mid-cycle panel", setBy: "clinician" }], createdAt: stamp, updatedAt: stamp,
          },
        ];
        s.bloodworkLogs = [
          {
            id: "seed-lab", testDate: dayKey(-14), labName: "Quest", createdAt: stamp,
            markers: [{ name: "Hematocrit", value: "52.1", unit: "%", referenceRange: "38.5-50.0", labFlag: "H", markerKey: "hematocrit" }],
          },
        ];
        s.safetyAcknowledgement = { acknowledgedAt: stamp, version: ackVersion, adultConfirmedAt: stamp };
      }
      return JSON.stringify(parsed);
    },
    { k: KEY, iso: WHEN.toISOString(), member, ackVersion: SAFETY_ACK_VERSION },
  );
  await page.addInitScript(({ k, v }) => window.localStorage.setItem(k, v), { k: KEY, v: patched });
  await page.reload({ waitUntil: "domcontentloaded", timeout: 120_000 });
  await expect(page.locator('[data-record="compound-command"]')).toBeVisible({ timeout: 90_000 });
  await expect(page.locator('[data-compound="nav"]')).toBeVisible();
}

async function scrollThrough(page: Page) {
  await page.evaluate(async () => {
    const step = Math.round(window.innerHeight * 0.8);
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 100));
    }
    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 300));
  });
}

/** The screen's structure, from computed styles. The Cycle Brief subtree is the documented exception. */
async function measure(page: Page) {
  const nested = await nestedSurfaces(page, BROAD_RULE);
  const rest = await page.evaluate((kitSource) => {
    /* The shared gold reader (support/gold-action), rebuilt in the page: any colour format. */
    const kit = new Function(`return (${kitSource})()`)() as GoldKit;
    const main = document.querySelector("main")!;
    const brief = main.querySelector('[data-compound="cycle-brief"]');
    const owned = (el: Element) => !brief || !brief.contains(el);
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return false;
      const cs = getComputedStyle(el);
      return cs.visibility !== "hidden" && cs.display !== "none";
    };
    const shown = (el: Element) => {
      for (let d = el.closest("details"); d; d = d.parentElement?.closest("details") ?? null) {
        if (!(d as HTMLDetailsElement).open) return false;
      }
      return true;
    };

    const h1 = [...document.querySelectorAll("main h1")].filter(visible).length;

    const goldish = kit.paintIsGold;
    const controls = [...main.querySelectorAll("button, a, [role=button]")].filter(
      (el) => visible(el) && !el.matches('a[href^="tel:"], a[href^="sms:"]'),
    );
    const goldText = controls.filter((el) => kit.isInk(getComputedStyle(el).color)).map((el) => (el.textContent ?? "").trim());
    const goldFill = controls
      .filter((el) => {
        const cs = getComputedStyle(el);
        return goldish(cs.backgroundColor) || goldish(cs.backgroundImage);
      })
      .map((el) => (el.textContent ?? "").trim());

    const describe = (el: Element) =>
      `${el.tagName.toLowerCase()}.${String(el.getAttribute("class") ?? "").split(/\s+/).filter(Boolean).slice(0, 3).join(".")} "${(el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 36)}"`;

    const BLOCK = new Set(["block", "list-item", "flex", "grid", "table", "table-cell", "flow-root"]);
    const longParagraphs: string[] = [];
    for (const el of main.querySelectorAll("p, div, li, dd, blockquote, span, td")) {
      if (!visible(el) || !shown(el) || !owned(el)) continue;
      if (!BLOCK.has(getComputedStyle(el).display) && el.tagName !== "P") continue;
      if ([...el.querySelectorAll("*")].some((c) => c.tagName === "P" || BLOCK.has(getComputedStyle(c).display))) continue;
      const text = (el as HTMLElement).innerText.replace(/\s+/g, " ").trim();
      if (text.length > 240) longParagraphs.push(`${text.length}: ${text.slice(0, 80)}`);
    }

    const unnamed = [...main.querySelectorAll("button, a[href], [role=button], [role=tab]")]
      .filter((el) => visible(el) && shown(el) && !(el as HTMLElement).innerText.trim() && !el.getAttribute("aria-label") && !el.getAttribute("aria-labelledby") && !el.getAttribute("title"))
      .map(describe);

    return {
      h1,
      goldText,
      goldFill,
      longParagraphs,
      unnamed,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  }, GOLD_KIT_SOURCE);
  return { ...rest, nested };
}

async function openPlace(page: Page, name: string) {
  const tab = page.getByRole("tab", { name, exact: true });
  await tab.click();
  await expect(tab).toHaveAttribute("aria-selected", "true");
  /* The old place animates out first; measure only once the new one is alone on screen. */
  await expect(page.getByRole("tabpanel")).toHaveCount(1);
  await expect(page.getByRole("tabpanel", { name: name === "More" ? "Tools & records" : name })).toBeVisible();
}

async function openTool(page: Page, name: string) {
  await openPlace(page, "More");
  await page.locator('[data-compound="tools"]').getByRole("button", { name: new RegExp(`^${name.replace(/[/]/g, "\\/")}`) }).click();
  await expect(page.getByRole("tabpanel")).toHaveCount(1);
  await expect(page.getByRole("tabpanel", { name })).toBeVisible();
}

/** Everything a member can reach as a place of its own: the nav, plus the rows under More. */
async function destinations(page: Page) {
  const tabs = await page.locator('[data-compound="nav"] [role="tab"]').allInnerTexts();
  await openPlace(page, "More");
  const tools = await page.locator('[data-compound="tools"] button').allInnerTexts();
  /* The segmented control uppercases its labels in CSS, so compare the words, not the case. */
  return { tabs: tabs.map((t) => t.trim().toLowerCase()), tools: tools.map((t) => t.split("\n")[0].trim().toLowerCase()) };
}

/** How much a member has to read before the screen has said its piece. */
async function textBudget(page: Page) {
  return page.evaluate(() => (document.querySelector("main") as HTMLElement).innerText.replace(/\s+/g, " ").trim().length);
}

/** Close an open sheet and wait for it to be gone, retrying the key once. */
async function closeSheet(page: Page, sheet: Locator) {
  await page.keyboard.press("Escape");
  if (await sheet.isVisible().catch(() => false)) {
    await page.keyboard.press("Escape");
  }
  await expect(sheet).toBeHidden({ timeout: 15_000 });
}

async function assertBar(page: Page, label: string) {
  await scrollThrough(page);
  const m = await measure(page);
  expect(m.h1, `${label}: visible h1`).toBe(1);
  expect(m.goldText, `${label}: gold by text colour`).toHaveLength(1);
  expect(m.goldFill, `${label}: gold by fill`).toHaveLength(1);
  expect(m.goldFill[0]).toBe(m.goldText[0]);
  expect(m.nested, `${label}: nested surfaces`).toEqual([]);
  expect(m.longParagraphs, `${label}: paragraphs over 240`).toEqual([]);
  expect(m.unnamed, `${label}: unnamed buttons`).toEqual([]);
  expect(m.overflow, `${label}: sideways scroll`).toBeLessThanOrEqual(0);
  return m;
}

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
}

for (const vp of [
  { name: "1280", width: 1280, height: 900, touch: false },
  { name: "390", width: 390, height: 844, touch: true },
] as const) {
  test.describe(`compound command at ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.touch, isMobile: vp.touch });

    test("active: statement, readouts and the one gold action on Today", async ({ page }) => {
      test.setTimeout(240_000);
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await boot(page, "active");

      const hero = page.locator('[data-record="compound-command"]');
      await expect(hero.locator("[data-record-statement]")).toHaveText("1 compound · 2 add-ons · 1 due now");
      await expect(hero).toContainText("Due now");
      await expect(hero).toContainText("Creatine");
      await expect(hero).toContainText("Logged today");
      await expect(hero).toContainText("of 3");
      /* One word, one meaning: the statement counts the log, the readout counts today. */
      await expect(hero.locator("[data-record-statement]")).not.toContainText(/logged/i);
      /* The checkpoint is the Cycle Brief's line, and one fact is printed once. */
      await expect(hero).not.toContainText("Next checkpoint");
      if (!SWITCH_OFF) {
        await expect(page.getByRole("region", { name: "Cycle Brief" })).toContainText("Mid-cycle panel");
      }
      await expect(hero.locator("[data-record-action] button")).toHaveText(/^log next due$/i);
      /* No KPI tile wall, no twelve-tab strip. */
      await expect(page.getByText("Inventory Alerts", { exact: true })).toHaveCount(0);
      await expect(page.locator('[data-compound="nav"] [role="tab"]')).toHaveCount(SWITCH_OFF ? 3 : 4);

      await expect(page.getByRole("region", { name: "Checks on your schedule" })).toBeVisible();
      /* Two today slots on screen (the main compound, the midday add-on); the night add-on is folded into its daypart row. */
      await expect(page.locator('[data-compound-row="today-slot"]')).toHaveCount(2);
      await expect(page.locator('[data-daypart="night"]')).toHaveAttribute("data-open", "false");

      await assertBar(page, "active Today");
      expect(errors.filter((e) => /Hydration/i.test(e)), "hydration").toEqual([]);
      await shot(page, `active-today-${vp.name}`);

      if (vp.touch) {
        const clear = await page.evaluate(async () => {
          const bar = document.querySelector('nav[data-shell="tab-bar"]');
          const footer = [...document.querySelectorAll("main footer")].pop();
          if (!bar || !footer) return { ok: true, detail: "no tab bar or footer" };
          window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" });
          await new Promise((r) => setTimeout(r, 400));
          const barTop = bar.getBoundingClientRect().top;
          const bottom = footer.getBoundingClientRect().bottom;
          return { ok: bottom <= barTop + 1, detail: `footer bottom ${bottom} · tab bar top ${barTop}` };
        });
        expect(clear.ok, clear.detail).toBe(true);
      }
      /* The folded night row opens with one tap, to the third slot. */
      await page.locator('[data-daypart="night"] > button').click();
      await expect(page.locator('[data-compound-row="today-slot"]')).toHaveCount(3);

      /* The gold action logs what is due now. */
      await hero.locator("[data-record-action] button").click();
      await expect(page.getByRole("status").filter({ hasText: /Logged Creatine at/ })).toBeVisible();
      await expect(hero.locator("[data-record-statement]")).toHaveText("1 compound · 2 add-ons · nothing due now");
      await expect(hero.locator("[data-record-action] button")).toHaveText(/^add compound$/i);
    });

    test("fresh: honest statement and Add Compound opens the editor", async ({ page }) => {
      test.setTimeout(240_000);
      await boot(page, "fresh");
      const hero = page.locator('[data-record="compound-command"]');
      await expect(hero.locator("[data-record-statement]")).toHaveText("Nothing tracked yet");
      await assertBar(page, "fresh Today");
      await shot(page, `fresh-today-${vp.name}`);

      await hero.locator("[data-record-action] button").click();
      const editor = page.getByRole("dialog", { name: "Compound editor" });
      await expect(editor).toBeVisible();
      await expect(editor).toHaveAttribute("aria-modal", "true");
      await page.keyboard.press("Escape");
      await expect(editor).toHaveCount(0);
    });

    test("active: every place meets the bar", async ({ page }) => {
      test.setTimeout(300_000);
      await boot(page, "active");
      await openPlace(page, "Plan");
      await assertBar(page, "Plan");
      await shot(page, `active-plan-${vp.name}`);
      /* Plan's second view is the week that used to be a place of its own. */
      await page.getByRole("tab", { name: "Week", exact: true }).click();
      await expect(page.locator('[data-compound="plan-week"]')).toBeVisible();
      await assertBar(page, "Plan week");
      /* The board pages four weeks ahead, which is what the old thirty-day list scrolled. */
      const week = page.locator('[data-compound="plan-week"]');
      await expect(week).toContainText("Next 7 days");
      await expect(page.getByRole("button", { name: "Earlier" })).toBeDisabled();
      await page.getByRole("button", { name: "Later" }).click();
      await expect(week).not.toContainText("Next 7 days");
      await expect(page.getByRole("button", { name: "Earlier" })).toBeEnabled();
      await page.getByRole("button", { name: "Earlier" }).click();
      await expect(week).toContainText("Next 7 days");
      await shot(page, `active-plan-week-${vp.name}`);

      await openPlace(page, "More");
      await assertBar(page, "More");
      await shot(page, `active-more-${vp.name}`);
      for (const tool of ["Labs / Review", "Education"]) {
        await openTool(page, tool);
        await assertBar(page, tool);
        await shot(page, `active-${tool.toLowerCase().replace(/[^a-z]+/g, "-")}-${vp.name}`);
      }
      /* Cycle & Safety now meets the same bar as every other place. */
      if (!SWITCH_OFF) {
        await openPlace(page, "Cycle & Safety");
        await assertBar(page, "Cycle & Safety");
        await shot(page, `active-cycle-safety-${vp.name}`);
      }

      /* Support Stack is a room too: empty, then with a supplement tracked. */
      await openTool(page, "Support Stack");
      await expect(page.locator("[data-support-statement]")).toHaveText("No supplements tracked");
      await assertBar(page, "Support Stack");
      expect(await textBudget(page), "Support Stack reading length").toBeLessThan(2_500);
      await page.getByRole("button", { name: "Browse supplements" }).click();
      const library = page.getByRole("dialog", { name: "Supplement library" });
      await library.getByLabel("Not in the library? Add your own").fill("Nordic Fish Oil Blend");
      await library.getByRole("button", { name: "Add supplement" }).click();
      /* Wait for the sheet to actually go: at desktop width the first Escape can land
         while focus is still inside the field, and a sheet left open swallows the next click. */
      await closeSheet(page, library);
      await expect(page.locator("[data-support-statement]")).toHaveText("1 supplement tracked · no alerts");
      await expect(page.getByRole("button", { name: "Details for Nordic Fish Oil Blend" })).toBeVisible();
      await assertBar(page, "Support Stack, one tracked");
      expect(await textBudget(page), "Support Stack reading length").toBeLessThan(2_500);
      await shot(page, `active-support-stack-${vp.name}`);
      /* Detail and paperwork live in sheets. */
      await page.getByRole("button", { name: "Coverage by system" }).click();
      await expect(page.getByRole("dialog", { name: "Coverage by system" })).toBeVisible();
      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: "Link two entries" }).click();
      await expect(page.getByRole("dialog", { name: "Link two entries" })).toBeVisible();
      await page.keyboard.press("Escape");

      /* Owned elsewhere (timeline, research): reachable, one h1, no overflow. */
      for (const tool of ["Timeline", "Research"]) {
        await openTool(page, tool);
        await expect(page.locator("main h1").filter({ visible: true })).toHaveCount(1);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, `${tool}: sideways scroll`).toBeLessThanOrEqual(0);
      }
    });

    test("the room has four destinations, and one compound has one sheet", async ({ page }) => {
      test.setTimeout(300_000);
      await boot(page, "active");

      /* Thirteen destinations became four, with five places listed under More. */
      const { tabs, tools } = await destinations(page);
      expect(tabs).toEqual(SWITCH_OFF ? ["today", "plan", "more"] : ["today", "plan", "cycle & safety", "more"]);
      expect(tools).toEqual(["labs / review", "support stack", "timeline", "research", "education"]);
      expect(tabs.length + tools.length).toBeLessThanOrEqual(9);
      /* None of these is a place of its own any more. */
      for (const gone of ["registry", "schedule", "inventory", "injection map", "dose math"]) {
        expect(tabs, `${gone} is not a tab`).not.toContain(gone);
        expect(tools, `${gone} is not a row under More`).not.toContain(gone);
      }

      /* Text budget: a place says its piece without becoming a book. */
      await openPlace(page, "Today");
      expect(await textBudget(page), "Today reading length").toBeLessThan(5_000);
      await openPlace(page, "Plan");
      expect(await textBudget(page), "Plan reading length").toBeLessThan(2_500);
      await openPlace(page, "More");
      expect(await textBudget(page), "More reading length").toBeLessThan(1_500);

      /* Everything about one compound is in that compound's sheet. */
      await openPlace(page, "Plan");
      const plan = page.locator('[data-compound="plan"]');
      await expect(plan.locator('[data-compound-row="plan-entry"]')).toHaveCount(3);
      await plan.locator('[data-compound-row="plan-entry"]').first().getByRole("button", { name: "Open" }).click();
      const sheet = page.getByRole("dialog", { name: "Testosterone Cypionate" });
      await expect(sheet).toBeVisible();
      await expect(sheet).toHaveAttribute("aria-modal", "true");
      for (const section of ["Schedule", "What is left", "Sites you logged", "Markers to raise with a clinician"]) {
        await expect(sheet, `sheet section: ${section}`).toContainText(section);
      }
      await expect(sheet.getByRole("button", { name: "Edit entry" })).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(sheet).toHaveCount(0);
    });

    test("Plan says what today is, in the same words the hero and Today use", async ({ page }) => {
      test.setTimeout(240_000);
      await boot(page, "active");
      const hero = page.locator('[data-record="compound-command"]');
      await expect(hero).toContainText("Due now");

      await openPlace(page, "Plan");
      const plan = page.locator('[data-compound="plan"]');
      /* Creatine is due now on Today and in the hero; Plan must not call it "next due". */
      const creatine = plan.locator('[data-compound-row="plan-entry"]').filter({ hasText: "Creatine" });
      await expect(creatine).toContainText("Today");
      await expect(creatine).toContainText("Due");
      await expect(creatine).not.toContainText("Next");
      /* The line beside the view switch never repeats the hero's due/missed counts. */
      const line = page.getByText(/scheduled in the next 7 days/);
      await expect(line).toBeVisible();
      await expect(line).not.toContainText("due now");
      await expect(line).not.toContainText("missed");
    });

    test("Dose Math is reachable and calculates from the member's own numbers", async ({ page }) => {
      test.setTimeout(240_000);
      await boot(page, "fresh");
      /* Dose Math is a row in Plan and a sheet, not a thirteenth destination. */
      await openPlace(page, "Plan");
      await page.locator('[data-compound="plan"]').getByRole("button", { name: /^Dose Math/ }).click();
      const sheet = page.getByRole("dialog", { name: "Dose Math" });
      await expect(sheet).toBeVisible();
      const place = page.locator('[data-compound="dose-math"]');
      await expect(place).toContainText("10 units = 0.5 mg");
      await place.getByLabel("Units per log").fill("20");
      await expect(place).toContainText("20 units = 1 mg");
      await page.keyboard.press("Escape");
      await expect(sheet).toHaveCount(0);
    });

    test("the Cycle Brief leads Today and its buttons land on their places", async ({ page }) => {
      test.skip(SWITCH_OFF, "The Cycle Brief is hidden with the launch switch off.");
      test.setTimeout(300_000);
      await boot(page, "active");
      const panel = page.getByRole("tabpanel", { name: "Today" });
      const brief = page.getByRole("region", { name: "Cycle Brief" });
      await expect(brief).toBeVisible({ timeout: 60_000 });
      /* First thing in Today. */
      const first = await panel.evaluate((el) => el.firstElementChild?.getAttribute("data-compound"));
      expect(first).toBe("cycle-brief");

      /* `sheet`: a button that names a sheet rather than a place lands inside it,
         so the promise it made is kept the moment the member arrives. */
      const landings: Array<{ button: string; tab: string; panel: string; sheet?: string }> = [
        { button: "Log or review labs", tab: "More", panel: "Labs / Review" },
        { button: "Evidence for your cycle", tab: "More", panel: "Support Stack", sheet: "Coverage by system" },
        { button: "Visit summary", tab: "Cycle & Safety", panel: "Cycle & Safety" },
        /* The injection log moved inside a compound's own sheet: the key lands on Plan. */
        { button: "Injection site log", tab: "Plan", panel: "Plan" },
      ];
      for (const landing of landings) {
        await openPlace(page, "Today");
        await brief.getByRole("button", { name: landing.button }).click();
        await expect(page.getByRole("tabpanel", { name: landing.panel })).toBeVisible();
        await expect(page.getByRole("tab", { name: landing.tab, exact: true })).toHaveAttribute("aria-selected", "true");
        if (landing.sheet) {
          const sheet = page.getByRole("dialog", { name: landing.sheet });
          await expect(sheet).toBeVisible({ timeout: 30_000 });
          await closeSheet(page, sheet);
        }
      }
    });
  });
}
