import { test, expect, type Page } from "@playwright/test";

import { SAFETY_ACK_VERSION } from "../../src/lib/safety/acknowledgement";
import { BORDERED_PANEL_RULE, nestedSurfaces } from "./support/surface-nesting";
import { goldActions as findGoldActions } from "./support/gold-action";

/**
 * ENHANCED ROOMS — the daily rooms recognise a member's own logged enhanced
 * context (program redesign, owner finding #3), at 1440×1000 and 390×844 with
 * touch, plus the phone overlay fix at 375×812.
 *
 *   · no enhanced records → no enhanced section in any room
 *   · a logged compound, an active cycle and a current acknowledgement → each
 *     room shows its context, with the week counted from the member's own
 *     dates, still exactly one gold action and no card inside a card
 *   · acknowledgement not yet accepted → only the live part, and a line naming
 *     where the acknowledgement lives
 *   · launch switch OFF → only the live part (the logged entries by name). This
 *     needs a server started with NEXT_PUBLIC_ENABLE_SAFETY_TOOLS=false and
 *     RESERVE_E2E_SAFETY_TOOLS=off; it is skipped otherwise, and the switch-on
 *     tests skip against that server.
 *   · 375×812 touch: every control in the rooms' fixed overlays is the element
 *     at its own centre — the tab bar no longer covers a Save or confirm.
 *
 * Seeding is the two-phase pattern the room specs use: the first load lets the
 * app write its persisted state, then the patch lands in an init script before
 * the app boots on reload. Every seeded date is relative to WHEN, so the cycle
 * is always day 39 of a 12-week plan: week 6 of 12.
 *
 * Screenshots are written only when ENHANCED_ROOMS_SHOTS names a directory.
 */

const KEY = "final-boss-athlete-settings";
/** Tuesday 15 September 2026, 4:12 PM local — a training day. */
const WHEN = new Date(2026, 8, 15, 16, 12, 0);
const SWITCH_OFF = process.env.RESERVE_E2E_SAFETY_TOOLS === "off";
const SHOTS = process.env.ENHANCED_ROOMS_SHOTS;

type Room = { name: string; slug: "apex" | "training" | "nutrition" | "recovery"; view: string; ready: string };

const ROOMS: Room[] = [
  { name: "Apex", slug: "apex", view: "dashboard", ready: '[data-apex="next-move-title"]' },
  { name: "Training", slug: "training", view: "training", ready: '[data-training="hero"]' },
  { name: "Nutrition", slug: "nutrition", view: "nutrition", ready: '[data-nutrition="hero"]' },
  { name: "Recovery", slug: "recovery", view: "recovery", ready: '[data-recovery="hero"]' },
];

const VIEWPORTS = [
  { name: "1440x1000", width: 1440, height: 1000, touch: false },
  { name: "390x844", width: 390, height: 844, touch: true },
] as const;

/** Wave-1 agent B's response panels; excluded from nesting exactly as redesign-rooms-depth does. */
const NOT_OURS = ['[data-testid$="-response-context"]', '[data-testid$="-response-context"] *'].join(", ");

type Seed = { enhanced: boolean; acknowledged: boolean };

async function bootRoom(page: Page, room: Room, seed: Seed) {
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
    { k: KEY, v: room.view },
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
      s.recoveryCommand = {
        ...s.recoveryCommand,
        sleepLogs: [7.2, 6.8, 7.6, 8.1, 7.0, 7.9, 7.4].map((hours, i) => ({ date: dayKey(i - 7), hours })),
        hydrationLogs: [{ date: dayKey(0), oz: 64 }],
        mobilityLogs: [{ date: dayKey(-1), kind: "recovery", minutes: 10, focus: "Reset" }],
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
            /* A member-recorded amount — the rooms must never show it. */
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
            /* Day 39 of the member's own plan → week 6 of 12. */
            startDate: dayKey(-38),
            plannedWeeks: 12,
            compoundIds: ["e2e-test"],
            clinicianOversight: true,
            checkpoints: [{ id: "e2e-cp", date: dayKey(10), label: "Mid-cycle panel", setBy: "clinician" }],
            createdAt: stamp,
            updatedAt: stamp,
          },
        ];
        s.bloodworkLogs = [
          {
            id: "e2e-lab",
            testDate: dayKey(-14),
            createdAt: stamp,
            markers: [{ name: "Hematocrit", value: "52.1", unit: "%", referenceRange: "38.5-50.0", labFlag: "H", markerKey: "hematocrit" }],
          },
        ];
        s.cycleCheckIns = [{ id: "e2e-checkin", cycleId: "e2e-cycle", date: dayKey(-2), createdAt: stamp, ratings: {}, symptoms: ["insomnia"] }];
      }
      if (seed.acknowledged) {
        s.safetyAcknowledgement = { acknowledgedAt: stamp, version: ackVersion, adultConfirmedAt: stamp };
      }
      return JSON.stringify(parsed);
    },
    { k: KEY, iso: WHEN.toISOString(), v: room.view, seed, ackVersion: SAFETY_ACK_VERSION },
  );
  await page.addInitScript(({ k, v }) => window.localStorage.setItem(k, v), { k: KEY, v: patched });
  await page.reload({ waitUntil: "domcontentloaded", timeout: 120_000 });

  /* `visible`: Apex renders the Next Move twice — phone and desktop. */
  await expect(page.locator(room.ready).filter({ visible: true }).first(), `the ${room.view} room rendered`).toBeVisible({ timeout: 60_000 });
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

/** ReserveButton's primary tier is the only control painted in #0a0b10 text (read in any colour format). */
function goldActions(page: Page) {
  return findGoldActions(page, { selector: "button", match: "text" });
}

/** The same nesting measure as redesign-rooms-depth: computed border + radius ancestry inside main. */
function nestedPanels(page: Page) {
  return nestedSurfaces(page, BORDERED_PANEL_RULE, { exclude: NOT_OURS, classes: 4 });
}

async function shot(page: Page, name: string, target?: ReturnType<Page["locator"]>) {
  if (!SHOTS) return;
  if (target) await target.scrollIntoViewIfNeeded();
  /* Fixed time slows framer-motion entry fades: give them room to finish. */
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${SHOTS}/${name}.png` });
}

const section = (page: Page) => page.locator("[data-enhanced-room]").filter({ visible: true });

/* ── Switch on ─────────────────────────────────────────────────────────── */

for (const vp of VIEWPORTS) {
  test.describe(`enhanced rooms at ${vp.name}`, () => {
    test.skip(SWITCH_OFF, "Runs against a server with the launch switch on.");
    test.use({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.touch, isMobile: vp.touch });

    for (const room of ROOMS) {
      test(`${room.name}: no enhanced records, no enhanced section`, async ({ page }) => {
        test.setTimeout(240_000);
        await bootRoom(page, room, { enhanced: false, acknowledged: true });
        await scrollThrough(page);
        await expect(page.locator("[data-enhanced-room]")).toHaveCount(0);
        expect(await goldActions(page), `exactly one gold action in ${room.name}`).toHaveLength(1);
        if (room.slug === "training" && vp.touch) await shot(page, `training-390-without-context`);
      });

      test(`${room.name}: the member's own cycle, still one gold action and no card in a card`, async ({ page }) => {
        test.setTimeout(240_000);
        await bootRoom(page, room, { enhanced: true, acknowledged: true });
        await scrollThrough(page);

        const ctx = section(page);
        await expect(ctx).toHaveCount(1);
        await expect(ctx).toHaveAttribute("data-enhanced-part", "gated");
        const text = (await ctx.innerText()).replace(/\s+/g, " ");

        if (room.slug === "nutrition") {
          expect(text).toContain("Mid-cycle panel");
          expect(text).toContain("set by your clinician");
          expect(text).toContain("Hematocrit");
          expect(text).toContain("Range on your report 38.5-50.0 %");
          expect(text).toContain("The lab flagged this High");
          expect(text).toContain("Get this reviewed");
        } else {
          expect(text).toContain("Autumn block · Week 6 of 12");
        }
        if (room.slug === "training" || room.slug === "recovery") {
          expect(text).toContain("Testosterone Cypionate");
          expect(text).toContain("Trouble sleeping");
          await expect(ctx.getByRole("button", { name: "Open Symptom Check" })).toBeVisible();
          await expect(ctx.getByRole("link", { name: /call 911/i })).toHaveAttribute("href", "tel:911");
        }
        if (room.slug === "apex") {
          expect(text).toContain("next lab checkpoint");
          await expect(ctx.getByRole("button")).toHaveCount(1);
        }

        /* The member recorded an amount; no room repeats it. */
        expect(text).not.toMatch(/\b\d+\s?(mg|mcg|iu|ml)\b/i);
        expect(text).not.toMatch(/\b200\b/);

        expect(await goldActions(page), `exactly one gold action in ${room.name}`).toHaveLength(1);
        expect(await nestedPanels(page), `bordered rounded panels nested in ${room.name}`).toEqual([]);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, `sideways scroll in ${room.name}`).toBeLessThanOrEqual(1);

        await shot(page, `${room.slug}-${vp.width}-enhanced`, ctx);
      });
    }
  });
}

test.describe("acknowledgement not yet accepted", () => {
  test.skip(SWITCH_OFF, "Runs against a server with the launch switch on.");
  test.use({ viewport: { width: 1440, height: 1000 } });

  test("Training shows only the live part and says where the acknowledgement lives", async ({ page }) => {
    test.setTimeout(240_000);
    await bootRoom(page, ROOMS[1], { enhanced: true, acknowledged: false });
    await scrollThrough(page);
    const ctx = section(page);
    await expect(ctx).toHaveAttribute("data-enhanced-part", "live");
    await expect(ctx).toContainText("Testosterone Cypionate");
    await expect(ctx).toContainText("once you accept the safety acknowledgement");
    await expect(ctx).not.toContainText("Week 6 of 12");
    await expect(ctx.getByRole("button", { name: "Open Symptom Check" })).toHaveCount(0);
    /* The section never asks for the acknowledgement itself: its Continue would be a second gold action. */
    expect(await goldActions(page)).toHaveLength(1);
  });
});

/* ── Switch off ────────────────────────────────────────────────────────── */

test.describe("launch switch off", () => {
  test.skip(!SWITCH_OFF, "Needs a server started with NEXT_PUBLIC_ENABLE_SAFETY_TOOLS=false.");
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  for (const room of ROOMS) {
    test(`${room.name}: only the member's logged entries, nothing from the cycle and safety system`, async ({ page }) => {
      test.setTimeout(240_000);
      await bootRoom(page, room, { enhanced: true, acknowledged: true });
      await scrollThrough(page);
      const ctx = section(page);
      await expect(ctx).toHaveCount(1);
      await expect(ctx).toHaveAttribute("data-enhanced-part", "live");
      await expect(ctx).toContainText("Testosterone Cypionate");
      for (const hidden of ["Week 6", "Autumn block", "Mid-cycle panel", "Hematocrit", "Range on your report", "Trouble sleeping", "acknowledgement"]) {
        await expect(ctx, `"${hidden}" stays behind the switch`).not.toContainText(hidden);
      }
      await expect(page.locator('[data-enhanced-part="gated"]')).toHaveCount(0);
      expect(await goldActions(page)).toHaveLength(1);
      await shot(page, `${room.slug}-390-switch-off`, ctx);
    });
  }
});

/* ── Phone overlays ────────────────────────────────────────────────────── */

/** Every visible control in the open dialog is the element at its own centre, and the tab bar has stepped aside. */
async function expectDialogReachable(page: Page, name: RegExp) {
  const dialog = page.getByRole("dialog", { name });
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('nav[data-shell="tab-bar"]')).toBeHidden();

  const buttons = dialog.locator("button").filter({ visible: true });
  const count = await buttons.count();
  expect(count, `controls in ${name}`).toBeGreaterThan(0);
  const blocked: string[] = [];
  for (let i = 0; i < count; i++) {
    const button = buttons.nth(i);
    await button.scrollIntoViewIfNeeded();
    const hit = await button.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;
      if (y < 0 || y > window.innerHeight) return "off-screen";
      const at = document.elementFromPoint(x, y);
      return at && (at === el || el.contains(at)) ? null : `${(el.textContent ?? "").trim().slice(0, 30)} → ${at?.tagName.toLowerCase()}.${String(at?.getAttribute("class") ?? "").slice(0, 40)}`;
    });
    if (hit) blocked.push(hit);
  }
  expect(blocked, `controls covered in ${name}`).toEqual([]);
  return dialog;
}

test.describe("phone overlays at 375×812", () => {
  test.skip(SWITCH_OFF, "Runs against a server with the launch switch on.");
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });

  test("Training: set logger, substitution and not-ready sheets sit above the tab bar", async ({ page }) => {
    test.setTimeout(300_000);
    await bootRoom(page, ROOMS[1], { enhanced: false, acknowledged: false });

    const start = page.locator('[data-training="primary-action"] button').filter({ visible: true });
    await expect(async () => {
      await start.click();
      await expect(page.getByRole("heading", { name: "Pre-Session Command" })).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 60_000 });
    await expect(async () => {
      await start.click();
      await expect(page.locator('[data-training="horizon"]').filter({ visible: true })).toContainText(/live/i, { timeout: 2_000 });
    }).toPass({ timeout: 60_000 });

    await page.getByRole("button", { name: /^Log Set \d+ of \d+/ }).first().click();
    await expectDialogReachable(page, /^Log set/);
    await shot(page, "overlay-fix-375-training-log-set");
    await page.getByRole("dialog", { name: /^Log set/ }).getByRole("button", { name: "Close" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.locator('nav[data-shell="tab-bar"]')).toBeVisible();

    await page.getByRole("button", { name: "Swap Movement" }).first().click();
    await expectDialogReachable(page, /^Substitute/);
    await page.getByRole("dialog", { name: /^Substitute/ }).getByRole("button", { name: "Close" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await page.getByRole("button", { name: /End Workout/ }).first().click();
    await expectDialogReachable(page, /^Not starting yet$/);
  });

  test("Nutrition: Fuel Command swap and configure drawers sit above the tab bar", async ({ page }) => {
    test.setTimeout(300_000);
    await bootRoom(page, ROOMS[2], { enhanced: false, acknowledged: false });

    /* Swap and Configure live inside a meal's sheet, opened from its row. */
    const openMeal = async () => {
      const row = page.locator('[data-nutrition="meals"] button[aria-haspopup="dialog"]').filter({ visible: true }).first();
      await row.scrollIntoViewIfNeeded();
      await row.click();
    };
    await openMeal();
    await page.getByRole("dialog").getByRole("button", { name: /^Swap$/ }).click();
    await expectDialogReachable(page, /^Swap Meal$/);
    await page.getByRole("dialog", { name: /^Swap Meal$/ }).getByRole("button", { name: "Close" }).last().click();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await openMeal();
    await page.getByRole("dialog").getByRole("button", { name: /^Configure$/ }).click();
    await expectDialogReachable(page, /^Configure Meal$/);
    await shot(page, "overlay-fix-375-nutrition-configure");
  });
});
