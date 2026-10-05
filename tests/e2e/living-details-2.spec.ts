import { test, expect, type Page } from "@playwright/test";

import { SAFETY_ACK_VERSION } from "../../src/lib/safety/acknowledgement";
import { BROAD_UNROUNDED_RULE, nestedSurfaces as findNestedSurfaces } from "./support/surface-nesting";
import { goldActions as findGoldActions } from "./support/gold-action";

/**
 * LIVING DETAILS · SECOND SET — one detail band per page, below the hero.
 *
 * AI Strategist, Build Studio, Bloodwork, Biomarker Cockpit, Peak Physique,
 * Education and My Coach, at 1280×900 and
 * 375×812 (touch), in each state that moves the band:
 *
 *   · the band's image decoded, and the right variant: the 4:5 below 768px,
 *     a 16:9 above it (never the 4:5)
 *   · decorative: aria-hidden, alt=""
 *   · exactly one band on the page, and it sits below the h1 AND below the
 *     hero (statement and gold action), never above either
 *   · with no data, the band sits at the top of the requirements panel
 *   · exactly one visible h1, at most one gold action (rgb(10, 11, 16) text
 *     or a gold fill), no surface inside a surface (the broad check: border,
 *     tinted background or shadow), no sideways scroll
 *
 * Journal carries journal-desk at the top of Entries (owner approved
 * 2026-09-16, brand name on the dial kept by owner decision).
 *
 * Seeding follows each page's own spec: wave-plan-intel (Strategist, Build
 * Studio, Peak, Education), wave-clinical-records (Bloodwork, Biomarker),
 * redesign-records (Journal), redesign-utility (My Coach), womens-rooms.
 * Screenshots are written only when LIVING_SHOTS names a directory.
 */

const KEY = "final-boss-athlete-settings";
const WHEN = new Date(2026, 8, 15, 16, 12, 0);
const STAMP = "2026-09-01T12:00:00.000Z";
const SHOTS = process.env.LIVING_SHOTS;

function dayKey(offset: number): string {
  const d = new Date(WHEN);
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/* ─── Seeds ─────────────────────────────────────────────────────────────── */

type Seed = "fresh" | "active" | "clinical-fresh" | "clinical-active" | "utility" | "records" | "womens-bare" | "womens-seeded";

function planFresh() {
  return {
    subscriptionTier: "elite",
    onboarding: { status: "complete", currentStep: 99, startedAt: STAMP },
    setupProfile: { setupComplete: true, completedAt: STAMP, completedSteps: ["schedule"] },
  };
}

function planActive() {
  return {
    ...planFresh(),
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

function utilityState() {
  return {
    subscriptionTier: "elite",
    onboarding: { status: "complete", currentStep: 99, startedAt: STAMP },
    setupProfile: { setupComplete: true, completedAt: STAMP, completedSteps: [] },
  };
}

function recordsState() {
  return {
    subscriptionTier: "elite",
    onboarding: { status: "complete", currentStep: 99, startedAt: STAMP },
    safetyAcknowledgement: { acknowledgedAt: STAMP, version: SAFETY_ACK_VERSION, adultConfirmedAt: STAMP },
    trainingSession: { trainingJournal: [] },
    physiqueCommand: {
      goal: "recomp",
      checkInIntervalDays: 7,
      weakPoints: ["delts"],
      focus: { primary: null, secondary: [], support: [], track: null, updatedAt: null },
      entries: [{ id: "seed-a", date: "2026-07-11", bodyWeightLb: 192.4, measurements: { waist: 34.5 }, notes: "Baseline check-in, measured fasted." }],
      photoCheckIns: [],
    },
  };
}

/** Single-phase: the state is written before the app first boots (wave-plan-intel, redesign-utility, redesign-records). */
async function bootInitial(page: Page, view: string, state: Record<string, unknown>) {
  await page.clock.setFixedTime(WHEN);
  await page.addInitScript(
    ({ k, v, s }) => {
      window.localStorage.setItem("fba-preview-view", v);
      if (!window.localStorage.getItem(k)) {
        window.localStorage.setItem(k, JSON.stringify({ state: { ...s, activeView: v }, version: 0 }));
      }
    },
    { k: KEY, v: view, s: state },
  );
  /* `domcontentloaded`: the dev server's HMR socket keeps networkidle from settling. */
  await page.goto("/", { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.locator("main").waitFor({ state: "visible", timeout: 120_000 });
}

/** Two-phase clinical seed (wave-clinical-records): labs, a cycle and a compound, or none. */
async function bootClinical(page: Page, view: string, active: boolean) {
  await page.clock.setFixedTime(WHEN);
  await page.addInitScript(
    ({ k, v }) => {
      window.localStorage.setItem("fba-preview-view", v);
      const raw = window.localStorage.getItem(k);
      const parsed = raw ? JSON.parse(raw) : { state: {}, version: 0 };
      parsed.state = {
        ...parsed.state,
        subscriptionTier: "elite",
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
      return Boolean(state?.trainingSession && state?.physiqueCommand && state?.setupProfile);
    },
    KEY,
    { timeout: 60_000 },
  );
  const patched = await page.evaluate(
    ({ k, iso, v, active, ackVersion }) => {
      const now = new Date(iso);
      const offsetKey = (offset: number) => {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      };
      const stamp = now.toISOString();
      const parsed = JSON.parse(window.localStorage.getItem(k) as string);
      const s = parsed.state;
      s.activeView = v;
      s.subscriptionTier = "elite";
      const steps: string[] = (s.setupProfile?.completedSteps ?? []).filter((step: string) => step !== "schedule");
      s.setupProfile = { ...s.setupProfile, setupComplete: true, completedAt: stamp, completedSteps: [...steps, "schedule"] };
      s.trainingSession = { ...s.trainingSession, enhancementLog: [] };
      s.cyclePeriods = [];
      s.bloodworkLogs = [];
      s.cycleCheckIns = [];
      s.redFlagReports = [];
      s.safetyAcknowledgement = null;
      s.physiqueCommand = { ...s.physiqueCommand, entries: [], photoCheckIns: [] };
      if (active) {
        s.safetyAcknowledgement = { acknowledgedAt: stamp, version: ackVersion, adultConfirmedAt: stamp };
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
            startDate: offsetKey(-38),
            plannedWeeks: 12,
            compoundIds: ["e2e-test"],
            clinicianOversight: true,
            checkpoints: [{ id: "e2e-cp", date: offsetKey(10), label: "Mid-cycle panel", setBy: "clinician" }],
            createdAt: stamp,
            updatedAt: stamp,
          },
        ];
        s.bloodworkLogs = [
          {
            id: "seed-lab-1",
            testDate: "2026-06-26",
            labName: "Quest",
            createdAt: "2026-06-26T12:00:00.000Z",
            markers: [
              { name: "Hematocrit", value: "45", unit: "%", referenceRange: "38.5-50.0", markerKey: "hematocrit" },
              { name: "Glucose", value: "88", unit: "mg/dL", referenceRange: "65-99" },
            ],
          },
          {
            id: "seed-lab-2",
            testDate: "2026-09-01",
            labName: "Quest",
            createdAt: "2026-09-01T12:00:00.000Z",
            notes: "Fasted draw before the next review.",
            markers: [
              { name: "Hematocrit", value: "52.1", unit: "%", referenceRange: "38.5-50.0", labFlag: "H", markerKey: "hematocrit" },
              { name: "Glucose", value: "91", unit: "mg/dL", referenceRange: "65-99" },
            ],
          },
        ];
      }
      return JSON.stringify(parsed);
    },
    { k: KEY, iso: WHEN.toISOString(), v: view, active, ackVersion: SAFETY_ACK_VERSION },
  );
  await page.addInitScript(({ k, v }) => window.localStorage.setItem(k, v), { k: KEY, v: patched });
  await page.reload({ waitUntil: "domcontentloaded", timeout: 120_000 });
}

/** Women's rooms (womens-rooms.spec): the nav group opens on womens.enabled; seeded adds a cycle and logs. */
async function bootWomens(page: Page, view: string, seeded: boolean) {
  await page.clock.setFixedTime(WHEN);
  await page.addInitScript(
    ({ k, v, stamp }) => {
      window.localStorage.setItem("fba-preview-view", v);
      if (!window.localStorage.getItem(k)) {
        window.localStorage.setItem(
          k,
          JSON.stringify({
            state: {
              subscriptionTier: "core",
              onboarding: { status: "complete", currentStep: 99, startedAt: stamp },
              setupProfile: { setupComplete: true, completedAt: stamp, completedSteps: [] },
              womens: { enabled: true },
            },
            version: 0,
          }),
        );
      }
    },
    { k: KEY, v: view, stamp: STAMP },
  );
  await page.goto("/", { waitUntil: "domcontentloaded", timeout: 120_000 });
  await expect(page.locator(`[data-record="${view}"]`).first()).toBeVisible({ timeout: 120_000 });
  await page.waitForFunction(
    (k) => {
      const raw = window.localStorage.getItem(k);
      const state = raw ? JSON.parse(raw).state : null;
      return Boolean(state?.recoveryCommand && state?.nutritionPrefs && state?.physiqueCommand && state?.womens?.cycle);
    },
    KEY,
    { timeout: 30_000 },
  );
  if (!seeded) return;
  const patched = await page.evaluate(
    ({ k, v, stamp }) => {
      const parsed = JSON.parse(window.localStorage.getItem(k) as string);
      const s = parsed.state;
      s.activeView = v;
      s.womens = {
        ...s.womens,
        enabled: true,
        cycle: { ...s.womens.cycle, lastPeriodStart: "2026-09-07", averageCycleLengthDays: 29, averagePeriodLengthDays: 5, lengthsEnteredAt: stamp },
        cycleLogs: [
          { id: "w-1", date: "2026-08-11", isPeriodDay: true, flow: "medium", energy: "low", trainingPerformance: "down", symptoms: ["cramps"] },
          { id: "w-2", date: "2026-08-20", energy: "high", stress: "low", trainingPerformance: "up", symptoms: [] },
          { id: "w-3", date: "2026-09-08", isPeriodDay: true, flow: "light", energy: "moderate", symptoms: ["cravings"] },
          { id: "w-4", date: "2026-09-10", energy: "moderate", stress: "moderate", trainingPerformance: "steady", symptoms: [] },
          { id: "w-5", date: "2026-09-14", energy: "high", stress: "low", trainingPerformance: "up", symptoms: [] },
          { id: "w-6", date: "2026-09-15", energy: "high", stress: "low", trainingPerformance: "steady", symptoms: [] },
        ],
      };
      s.recoveryCommand = {
        ...s.recoveryCommand,
        sleepLogs: [
          { date: "2026-09-09", hours: 7.1 },
          { date: "2026-09-10", hours: 6.8 },
          { date: "2026-09-12", hours: 7.9 },
          { date: "2026-09-14", hours: 7.4 },
        ],
        hydrationLogs: [{ date: "2026-09-14", oz: 64 }],
      };
      return JSON.stringify(parsed);
    },
    { k: KEY, v: view, stamp: STAMP },
  );
  await page.addInitScript(({ k, v }) => window.localStorage.setItem(k, v), { k: KEY, v: patched });
  await page.reload({ waitUntil: "domcontentloaded", timeout: 120_000 });
}

async function boot(page: Page, view: string, seed: Seed) {
  switch (seed) {
    case "fresh":
      return bootInitial(page, view, planFresh());
    case "active":
      return bootInitial(page, view, planActive());
    case "utility":
      return bootInitial(page, view, utilityState());
    case "records":
      return bootInitial(page, view, recordsState());
    case "clinical-fresh":
      return bootClinical(page, view, false);
    case "clinical-active":
      return bootClinical(page, view, true);
    case "womens-bare":
      return bootWomens(page, view, false);
    case "womens-seeded":
      return bootWomens(page, view, true);
  }
}

/* ─── Pages ─────────────────────────────────────────────────────────────── */

type Case = {
  name: string;
  view: string;
  seed: Seed;
  hero: string;
  /** The detail image, or null for a page that must show none. */
  image: string | null;
  /** The band must sit in the requirements panel. */
  inRequirements?: boolean;
  /** The band sits in the section with this selector. */
  inSection?: string;
  gold: 0 | 1;
  /** A nesting that predates this change and is not the band's (reported, not fixed here). */
  knownNesting?: RegExp;
};

const CASES: Case[] = [
  { name: "AI Strategist (no data)", view: "ai-strategist", seed: "fresh", hero: '[data-strategist="hero"]', image: "strategist-command", gold: 1 },
  { name: "AI Strategist", view: "ai-strategist", seed: "active", hero: '[data-strategist="hero"]', image: "strategist-command", inSection: '[data-strategist="watch-list"]', gold: 1 },
  { name: "Build Studio", view: "lifestyle-builder", seed: "active", hero: '[data-lifestyle="hero"]', image: "build-studio", inSection: '[data-lifestyle="build"]', gold: 1 },
  { name: "Bloodwork", view: "bloodwork", seed: "clinical-active", hero: '[data-record="bloodwork"]', image: "labs-clinic", gold: 1 },
  { name: "Biomarker Cockpit (no labs)", view: "biomarker-intelligence", seed: "clinical-fresh", hero: '[data-record="biomarker-intelligence"]', image: "labs-clinic", inRequirements: true, gold: 1 },
  { name: "Biomarker Cockpit", view: "biomarker-intelligence", seed: "clinical-active", hero: '[data-record="biomarker-intelligence"]', image: "labs-clinic", inSection: '[data-record="marker-table"]', gold: 1 },
  { name: "Peak Physique", view: "peak-physique", seed: "active", hero: '[data-record="peak-physique"]', image: "peak-stage", inRequirements: true, gold: 1 },
  { name: "Education", view: "education", seed: "utility", hero: '[data-utility="education"]', image: "education-library", gold: 0 },
  { name: "My Coach", view: "my-coach", seed: "utility", hero: '[data-utility="my-coach"]', image: "coach-suite", gold: 1 },
  { name: "Journal", view: "journal", seed: "records", hero: '[data-record="journal"]', image: "journal-desk", gold: 1 },
];

const VIEWPORTS = [
  { name: "1280", width: 1280, height: 900, touch: false },
  { name: "375", width: 375, height: 812, touch: true },
] as const;

/* ─── Measures ──────────────────────────────────────────────────────────── */

const bands = (page: Page) => page.locator("main [data-detail-image]").filter({ visible: true });

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

/** Gold, counted by text colour and by paint (wave-plan-intel), in any colour format. */
function goldActions(page: Page): Promise<string[]> {
  return findGoldActions(page, { selector: "main button, main a, main [role=button]", visible: "rendered", match: "either" });
}

/** The broad nesting check (wave-plan-intel): border, tinted background or shadow, inside another. */
function nestedSurfaces(page: Page): Promise<string[]> {
  return findNestedSurfaces(page, BROAD_UNROUNDED_RULE);
}

async function shots(page: Page, name: string) {
  if (!SHOTS) return;
  const band = bands(page).first();
  /* The page in context: the hero's end and the band. */
  await band.evaluate((el) => {
    const r = el.getBoundingClientRect();
    window.scrollBy(0, r.top - window.innerHeight * 0.35);
  });
  await page.waitForTimeout(1600);
  await page.screenshot({ path: `${SHOTS}/${name}-page.png`, animations: "disabled" });
  /* The band's panel on its own, fixed chrome hidden so it cannot paint over it. */
  await page.addStyleTag({ content: "[data-living-shot-hide] { visibility: hidden !important; }" });
  await page.evaluate(() => {
    for (const node of document.querySelectorAll("body *")) {
      const pos = getComputedStyle(node).position;
      if ((pos === "fixed" || pos === "sticky") && !node.closest("main [data-detail-image]")) node.setAttribute("data-living-shot-hide", "");
    }
  });
  await band.locator("xpath=..").screenshot({ path: `${SHOTS}/${name}-panel.png`, animations: "disabled" });
  await page.evaluate(() => document.querySelectorAll("[data-living-shot-hide]").forEach((n) => n.removeAttribute("data-living-shot-hide")));
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

/* ─── Tests ─────────────────────────────────────────────────────────────── */

for (const vp of VIEWPORTS) {
  test.describe(`living details, second set, at ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.touch, isMobile: vp.touch });

    for (const c of CASES) {
      test(`${c.name}: one band below the hero, right variant, one h1, gold kept, no nesting`, async ({ page }) => {
        test.setTimeout(240_000);
        const pageErrors: string[] = [];
        page.on("pageerror", (error) => pageErrors.push(error.message));

        await boot(page, c.view, c.seed);
        const hero = page.locator(c.hero).filter({ visible: true }).first();
        await expect(hero, `${c.name} rendered its hero`).toBeVisible({ timeout: 90_000 });
        await page.waitForTimeout(800);
        await scrollThrough(page);

        await expect(page.locator("main h1").filter({ visible: true }), "exactly one h1").toHaveCount(1);

        if (c.image === null) {
          await expect(page.locator("main [data-detail-image]"), `${c.name} shows no detail image`).toHaveCount(0);
        } else {
          await expect(bands(page), `${c.name}: exactly one band`).toHaveCount(1, { timeout: 30_000 });
          const band = bands(page).first();
          await expect(band).toHaveAttribute("data-detail-image", c.image);
          await expect(band).toHaveAttribute("aria-hidden", "true");
          await expect(band.locator("img")).toHaveAttribute("alt", "");

          await band.scrollIntoViewIfNeeded();
          await expect
            .poll(() => band.locator("img").evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0), {
              message: `${c.image} decoded`,
              timeout: 30_000,
            })
            .toBe(true);
          const served = await band.locator("img").evaluate((img: HTMLImageElement) => img.currentSrc);
          if (vp.width < 768) {
            expect(served, `${c.image} phone variant`).toContain(`/brand/details/${c.image}-4x5.webp`);
          } else {
            expect(served, `${c.image} desktop variant`).not.toContain("-4x5");
            expect(served, `${c.image} desktop variant`).toContain(`/brand/details/${c.image}`);
          }

          /* Below the h1 and below the whole hero (its statement and its gold). */
          const order = await page.evaluate(
            ({ heroSel }) => {
              const top = (el: Element | null | undefined) => (el ? el.getBoundingClientRect().top + window.scrollY : NaN);
              const bottom = (el: Element | null | undefined) => (el ? el.getBoundingClientRect().bottom + window.scrollY : NaN);
              const visible = (el: Element) => el.getBoundingClientRect().height > 0;
              const band = [...document.querySelectorAll("main [data-detail-image]")].find(visible);
              const h1 = [...document.querySelectorAll("main h1")].find(visible);
              const hero = [...document.querySelectorAll(heroSel)].find(visible);
              const statement = [...document.querySelectorAll("main [data-room-statement]")].find(visible);
              return { band: top(band), h1: bottom(h1), hero: bottom(hero), statement: bottom(statement ?? hero) };
            },
            { heroSel: c.hero },
          );
          expect(order.band, `band below the h1 (${JSON.stringify(order)})`).toBeGreaterThanOrEqual(order.h1);
          expect(order.band, `band below the hero (${JSON.stringify(order)})`).toBeGreaterThanOrEqual(order.hero - 1);
          expect(order.band, `band below the hero statement (${JSON.stringify(order)})`).toBeGreaterThanOrEqual(order.statement);

          /* Band at the top of its panel: only the panel's own decorative edge light comes before it. */
          const before = await band.evaluate((el) => {
            const out: string[] = [];
            for (let prev = el.previousElementSibling; prev; prev = prev.previousElementSibling) {
              if (!(prev.getAttribute("aria-hidden") === "true" && getComputedStyle(prev).position === "absolute")) {
                out.push(`${prev.tagName.toLowerCase()} "${(prev.textContent ?? "").trim().slice(0, 30)}"`);
              }
            }
            return out;
          });
          expect(before, "nothing sits above the band in its panel").toEqual([]);

          if (c.inRequirements) {
            await expect(band.locator("xpath=..")).toContainText(/What (this needs|peak week runs on)/);
          }
          if (c.inSection) {
            const inSection = await band.evaluate(
              (el, sel) => Boolean(el.closest(sel) || el.parentElement?.querySelector(sel)),
              c.inSection,
            );
            expect(inSection, `band belongs to ${c.inSection}`).toBe(true);
          }
        }

        const gold = await goldActions(page);
        expect(gold.length, `${c.name} gold: ${gold.join(" | ")}`).toBeLessThanOrEqual(c.gold);

        const nested = (await nestedSurfaces(page)).filter((offender) => !c.knownNesting?.test(offender));
        expect(nested, `${c.name} surfaces nested in main`).toEqual([]);

        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, `${c.name} scrolls sideways`).toBeLessThanOrEqual(0);

        expect(pageErrors.filter((error) => /Hydration/i.test(error)), `${c.name} hydration`).toEqual([]);

        if (c.image) await shots(page, `${slug(c.name)}-${vp.name}`);
      });
    }
  });
}
