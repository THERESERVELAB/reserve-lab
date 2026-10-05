import { test, expect, type Page } from "@playwright/test";

import { SAFETY_ACK_VERSION } from "../../src/lib/safety/acknowledgement";

/**
 * HARDASS PREP — choosing the coach voice puts today's standard on Apex.
 *
 *   · the section is absent unless the member chose Hardass Prep
 *   · chosen: the standard renders from the member's own logs, Apex keeps
 *     exactly one gold action, and nothing is a card inside a card
 *   · the On a Cycle headline appears only when entries are active in the
 *     Logbook; the cycle week renders only behind the launch switch AND a
 *     current safety acknowledgement
 *   · 375×812 touch: no sideways scroll, and every control in the section is
 *     the element at its own centre — not under the tab bar or the action bar
 *   · Settings names the option "Hardass Prep" and explains it when chosen
 *
 * Seeding is the two-phase pattern the room specs use (enhanced-rooms.spec.ts).
 */

const KEY = "final-boss-athlete-settings";
/** Tuesday 15 September 2026, 4:12 PM local — a training day. */
const WHEN = new Date(2026, 8, 15, 16, 12, 0);
const SWITCH_OFF = process.env.RESERVE_E2E_SAFETY_TOOLS === "off";
/** Screenshots are written only when HARDASS_SHOTS names a directory. */
const SHOTS = process.env.HARDASS_SHOTS;

type Seed = { style: string; enhanced: boolean; acknowledged: boolean; view?: string };

const NOT_OURS = ['[data-testid$="-response-context"]', '[data-testid$="-response-context"] *'].join(", ");

async function boot(page: Page, seed: Seed) {
  const view = seed.view ?? "dashboard";
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

  await page.goto("/", { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.locator("main h1").first().waitFor({ timeout: 120_000 });
  await page.waitForFunction(
    (k) => {
      const raw = window.localStorage.getItem(k);
      const state = raw ? JSON.parse(raw).state : null;
      return Boolean(state?.recoveryCommand && state?.nutritionPrefs && state?.scheduleProfile && state?.setupProfile && state?.profile);
    },
    KEY,
    { timeout: 30_000 },
  );

  const patched = await page.evaluate(
    ({ k, iso, v, seed, ackVersion }) => {
      const now = new Date(iso);
      const dayKey = (offset: number) => {
        const d = new Date(now);
        d.setDate(d.getDate() + offset);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      };
      const stamp = now.toISOString();
      const parsed = JSON.parse(window.localStorage.getItem(k) as string);
      const s = parsed.state;
      s.activeView = v;
      s.subscriptionTier = "elite";
      s.profile = { ...s.profile, aiCoachStyle: seed.style };
      s.recoveryCommand = {
        ...s.recoveryCommand,
        sleepTargetHours: 8,
        hydrationTargetOz: 120,
        /* Nothing filed under today: last night's sleep is a miss. */
        sleepLogs: [7.2, 6.8, 7.6, 8.1, 7.0, 7.9, 7.4].map((hours, i) => ({ date: dayKey(i - 7), hours })),
        hydrationLogs: [{ date: dayKey(0), oz: 64 }],
        mobilityLogs: [],
        stressCheckIns: [],
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
      s.setupProfile = { ...s.setupProfile, setupComplete: true, completedAt: stamp, completedSteps: [...steps, "schedule"] };
      s.splitSystem = { ...(s.splitSystem || {}), key: "ppl-ul", source: "member", selectedAt: stamp };

      s.trainingSession = { ...s.trainingSession, enhancementLog: [] };
      s.cyclePeriods = [];
      s.bloodworkLogs = [];
      s.cycleCheckIns = [];
      s.redFlagReports = [];
      s.safetyAcknowledgement = null;

      if (seed.enhanced) {
        s.trainingSession.enhancementLog = [
          {
            id: "e2e-test",
            name: "Testosterone Cypionate",
            officialName: "Testosterone Cypionate",
            compoundClass: "hormones_testosterone",
            category: "hormone",
            doseAmount: "200",
            doseUnit: "mg",
            frequency: "",
            timingPreference: "",
            goalAssociation: [],
            isActive: true,
            createdAt: stamp,
            updatedAt: stamp,
          },
        ];
        s.cyclePeriods = [
          {
            id: "e2e-cycle",
            name: "Autumn block",
            startDate: dayKey(-38),
            plannedWeeks: 12,
            compoundIds: ["e2e-test"],
            clinicianOversight: true,
            checkpoints: [{ id: "e2e-cp", date: dayKey(10), label: "Mid-cycle panel", setBy: "clinician" }],
            createdAt: stamp,
            updatedAt: stamp,
          },
        ];
      }
      if (seed.acknowledged) {
        s.safetyAcknowledgement = { acknowledgedAt: stamp, version: ackVersion, adultConfirmedAt: stamp };
      }
      return JSON.stringify(parsed);
    },
    { k: KEY, iso: WHEN.toISOString(), v: view, seed, ackVersion: SAFETY_ACK_VERSION },
  );
  await page.addInitScript(({ k, v }) => window.localStorage.setItem(k, v), { k: KEY, v: patched });
  await page.reload({ waitUntil: "domcontentloaded", timeout: 120_000 });

  if (view === "dashboard") {
    await expect(page.locator('[data-apex="next-move-title"]').filter({ visible: true }).first()).toBeVisible({ timeout: 60_000 });
  } else {
    await page.locator("main h1").first().waitFor({ timeout: 60_000 });
  }
}

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

/** ReserveButton's primary tier is the only control painted in #0a0b10 text. */
function goldActions(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .filter((b) => {
        const r = b.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && getComputedStyle(b).color === "rgb(10, 11, 16)";
      })
      .map((b) => (b.textContent ?? "").trim().slice(0, 40)),
  );
}

/** The redesign-rooms-depth nesting measure: computed border + radius ancestry inside main. */
function nestedPanels(page: Page) {
  return page.evaluate((notOurs) => {
    const main = document.querySelector("main");
    if (!main) return ["no main"];
    const foreign = new Set(document.querySelectorAll(notOurs));
    const transparent = (color: string) => color === "transparent" || /,\s*0\)$/.test(color) || /\/\s*0\)$/.test(color);
    const isPanel = (el: Element) => {
      if (el.matches("button, a, input, select, textarea, summary") || el.closest('[role="dialog"]')) return false;
      const r = el.getBoundingClientRect();
      if (r.width < 64 || r.height < 40) return false;
      const cs = getComputedStyle(el);
      if (cs.display === "inline" || cs.display === "none" || cs.visibility === "hidden") return false;
      const bordered = (["top", "right", "bottom", "left"] as const).some(
        (side) =>
          parseFloat(cs.getPropertyValue(`border-${side}-width`)) >= 1 &&
          cs.getPropertyValue(`border-${side}-style`) !== "none" &&
          !transparent(cs.getPropertyValue(`border-${side}-color`)),
      );
      const rounded = (
        ["border-top-left-radius", "border-top-right-radius", "border-bottom-right-radius", "border-bottom-left-radius"] as const
      ).some((corner) => parseFloat(cs.getPropertyValue(corner)) >= 8);
      return bordered && rounded;
    };
    const describe = (el: Element) =>
      `${el.tagName.toLowerCase()}.${String(el.getAttribute("class") ?? "").split(/\s+/).filter(Boolean).slice(0, 4).join(".")} "${(el.textContent ?? "").trim().slice(0, 36)}"`;
    const offenders: string[] = [];
    for (const el of main.querySelectorAll("*")) {
      if (foreign.has(el) || !isPanel(el)) continue;
      for (let up = el.parentElement; up && up !== main; up = up.parentElement) {
        if (isPanel(up)) {
          offenders.push(`${describe(el)} inside ${describe(up)}`);
          break;
        }
      }
    }
    return [...new Set(offenders)];
  }, NOT_OURS);
}

const standard = (page: Page) => page.locator("[data-hardass-prep]");

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  const section = standard(page);
  await section.scrollIntoViewIfNeeded();
  await page.waitForTimeout(2500);
  await section.screenshot({ path: `${SHOTS}/${name}.png` });
}

test.describe("Hardass Prep at 1440×1000", () => {
  test.skip(SWITCH_OFF, "Runs against a server with the launch switch on.");
  test.use({ viewport: { width: 1440, height: 1000 } });

  test("another coach voice: no standard on Apex", async ({ page }) => {
    test.setTimeout(240_000);
    await boot(page, { style: "elite-coach", enhanced: true, acknowledged: true });
    await scrollThrough(page);
    await expect(standard(page)).toHaveCount(0);
    expect(await goldActions(page)).toHaveLength(1);
  });

  test("chosen, not enhanced: the standard from the member's own logs, one gold action, no card in a card", async ({ page }) => {
    test.setTimeout(240_000);
    await boot(page, { style: "hardass-prep", enhanced: false, acknowledged: true });
    await scrollThrough(page);

    const section = standard(page);
    await expect(section).toHaveCount(1);
    await expect(section).toHaveAttribute("data-on-cycle", "false");
    await expect(section.locator('[data-hardass="headline"]')).toHaveText("The standard is today. No excuses.");
    await expect(section).not.toContainText("On a cycle");

    await expect(section.locator('[data-hardass-check="sleep"]')).toHaveAttribute("data-status", "missed");
    await expect(section.locator('[data-hardass-check="sleep"]')).toContainText("No sleep logged last night. That's a miss.");
    await expect(section.locator('[data-hardass-check="water"]')).toContainText("64 of your 120 oz Recovery target logged. Still open.");
    await expect(section.locator('[data-hardass-check="training"]')).toHaveAttribute("data-status", "open");
    await expect(section.getByRole("button", { name: "Log Sleep" })).toBeVisible();

    expect(await goldActions(page), "exactly one gold action on Apex").toHaveLength(1);
    expect(await nestedPanels(page), "bordered rounded panels nested on Apex").toEqual([]);
  });

  test("a secondary action opens the real logger: water logs on tap", async ({ page }) => {
    test.setTimeout(240_000);
    await boot(page, { style: "hardass-prep", enhanced: false, acknowledged: true });
    const section = standard(page);
    const water = section.locator('[data-hardass-check="water"]');
    await water.scrollIntoViewIfNeeded();
    await water.getByRole("button", { name: /^Log \d+ oz$/ }).click();
    await expect(water).toContainText("80 of your 120 oz Recovery target logged.");
  });

  test("chosen, on a cycle, acknowledged: zero grace and the member's own cycle week", async ({ page }) => {
    test.setTimeout(240_000);
    await boot(page, { style: "hardass-prep", enhanced: true, acknowledged: true });
    await scrollThrough(page);

    const section = standard(page);
    await expect(section).toHaveAttribute("data-on-cycle", "true");
    await expect(section).toHaveAttribute("data-hardass-part", "gated");
    await expect(section.locator('[data-hardass="headline"]')).toHaveText("On a cycle. Every day counts — in the gym and outside it.");
    await expect(section).toContainText("You're on a cycle. The standard is every day.");
    await expect(section).toContainText("Owed today");
    await expect(section).toContainText("Autumn block · Week 6 of 12");
    await expect(section).toContainText("Mid-cycle panel");
    await expect(section).toContainText("Anything unusual gets a medical review today.");
    await expect(section.getByRole("link", { name: /call 911/i })).toHaveAttribute("href", "tel:911");

    const text = (await section.innerText()).replace(/\s+/g, " ");
    expect(text).not.toMatch(/\b\d+\s?(mg|mcg|iu|ml)\b/i);
    expect(text).not.toMatch(/\b200\b/);
    await shot(page, "hardass-1440-on-cycle");

    expect(await goldActions(page), "exactly one gold action on Apex").toHaveLength(1);
    expect(await nestedPanels(page), "bordered rounded panels nested on Apex").toEqual([]);
  });

  test("on a cycle, acknowledgement not accepted: the headline changes, the cycle stays behind the gate", async ({ page }) => {
    test.setTimeout(240_000);
    await boot(page, { style: "hardass-prep", enhanced: true, acknowledged: false });
    const section = standard(page);
    await expect(section).toHaveAttribute("data-on-cycle", "true");
    await expect(section).toHaveAttribute("data-hardass-part", "live");
    await expect(section.locator('[data-hardass="headline"]')).toHaveText("On a cycle. Every day counts — in the gym and outside it.");
    for (const hidden of ["Week 6", "Autumn block", "Mid-cycle panel", "clinician", "911"]) {
      await expect(section, `"${hidden}" stays behind the gate`).not.toContainText(hidden);
    }
  });
});

test.describe("Hardass Prep at 375×812 touch", () => {
  test.skip(SWITCH_OFF, "Runs against a server with the launch switch on.");
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });

  test("no sideways scroll, one gold action, and nothing in the section sits behind the tab bar", async ({ page }) => {
    test.setTimeout(240_000);
    await boot(page, { style: "hardass-prep", enhanced: true, acknowledged: true });
    await scrollThrough(page);

    const section = standard(page);
    await expect(section).toHaveCount(1);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, "sideways scroll on Apex").toBeLessThanOrEqual(1);
    expect(await goldActions(page), "exactly one gold action on Apex").toHaveLength(1);
    expect(await nestedPanels(page), "bordered rounded panels nested on Apex").toEqual([]);

    const blocked = await section.evaluate(async (host) => {
      const targets = [...host.querySelectorAll<HTMLElement>("button, a, [data-hardass-check] p")].filter((el) => el.getBoundingClientRect().width > 0);
      const out: string[] = [];
      const probe = (el: HTMLElement) => {
        const r = el.getBoundingClientRect();
        const x = r.left + Math.min(r.width / 2, 40);
        const y = r.top + r.height / 2;
        const at = document.elementFromPoint(x, y);
        return { ok: Boolean(at && (at === el || el.contains(at) || at.contains(el))), at, y };
      };
      for (const el of targets) {
        /* Scroll until the element settles at the centre: entry motion can shift layout under the first scroll. */
        let hit = probe(el);
        for (let attempt = 0; attempt < 4; attempt++) {
          el.scrollIntoView({ block: "center", behavior: "instant" });
          await new Promise((r) => setTimeout(r, 200));
          hit = probe(el);
          if (hit.ok) break;
        }
        if (!hit.ok) {
          out.push(`${(el.textContent ?? "").trim().slice(0, 30)} @${Math.round(hit.y)} → ${hit.at?.tagName.toLowerCase()}.${String(hit.at?.getAttribute("class") ?? "").slice(0, 40)}`);
        }
      }
      return out;
    });
    expect(blocked, "controls or lines covered in the Hardass Prep section").toEqual([]);
    await shot(page, "hardass-375-on-cycle");

    /* The last line of the section clears the tab bar when scrolled to the end of the viewport. */
    const clearance = await section.evaluate(async (host) => {
      host.scrollIntoView({ block: "end", behavior: "instant" });
      await new Promise((r) => setTimeout(r, 200));
      const bar = document.querySelector('nav[data-shell="tab-bar"]');
      if (!bar || getComputedStyle(bar).display === "none") return null;
      return { sectionBottom: host.getBoundingClientRect().bottom, barTop: bar.getBoundingClientRect().top, scrolled: window.scrollY };
    });
    if (clearance) {
      /* When the document can scroll the section's end above the bar, it does. */
      const canScroll = await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight);
      if (canScroll) expect(clearance.sectionBottom, "section end above the tab bar").toBeLessThanOrEqual(clearance.barTop + 1);
    }
  });
});

test.describe("Settings", () => {
  test.use({ viewport: { width: 1440, height: 1000 } });

  test("names the option Hardass Prep and explains the On a Cycle behaviour when chosen", async ({ page }) => {
    test.setTimeout(240_000);
    await boot(page, { style: "hardass-prep", enhanced: false, acknowledged: false, view: "settings" });
    const option = page.getByRole("button", { name: /Hardass Prep/ });
    await option.first().scrollIntoViewIfNeeded();
    await expect(option.first()).toContainText("No excuses. Every miss called out.");
    await expect(page.locator('[data-settings="hardass-prep-note"]')).toContainText("On a cycle");
    await expect(page.getByText("Accountability Prep")).toHaveCount(0);
  });
});
