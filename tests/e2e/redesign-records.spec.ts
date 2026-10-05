import { test, expect, type Page } from "@playwright/test";

import { SAFETY_ACK_VERSION } from "../../src/lib/safety/acknowledgement";
import { BORDERED_PANEL_RULE, nestedSurfaces } from "./support/surface-nesting";
import { goldActions as findGoldActions } from "./support/gold-action";

/**
 * REDESIGN — RECORD AND PHYSIQUE SCREENS (wave 1, agent C).
 *
 * The nine screens this pass owns, at 1440×1000 and at 390×844 with touch,
 * seeded as a Reserve Black member with real entries. Each screen asserts
 * the redesign contract:
 *
 *   · exactly one visible <h1> — one hero, never two (typography.md)
 *   · exactly one gold primary action (Bible §11: the gold CTA is scarce)
 *   · no bordered, rounded panel nested inside another anywhere in <main>
 *     (constitution components.md rule 1 — measured from computed border and
 *     radius, not from class names)
 *   · no horizontal overflow (responsive.md)
 *   · no hydration errors — a mismatch does not fail visibly, so it is
 *     asserted rather than hoped for
 *
 * Plus the honesty checks this wave exists for: the Physique Cockpit carries
 * no projection, and the Journal carries no sample entry.
 *
 * ONE DOCUMENTED EXCEPTION to the single gold action: before a member has
 * accepted the safety acknowledgement, `SafetyAcknowledgementGate` puts its
 * own gold "Continue" on the clinical screens. That gate is a shipped
 * compliance surface and its prominence is the point, so these runs seed the
 * acknowledgement and assert the screen's own single action. The gate is
 * covered by cycle-safety.spec.ts and owner-mode.spec.ts.
 *
 * NOT asserted, deliberately: a global 11px type floor. `.type-whisper` is
 * 7–9px uppercase mono by design and the constitution (typography.md)
 * outranks the redesign spec on that point; the 11px floor belongs to the
 * §13 horizon strip, which no screen here renders. The mobile 16px input
 * floor IS asserted — accessibility.md makes that one non-negotiable.
 */

const KEY = "final-boss-athlete-settings";

type Screen = {
  name: string;
  view: string;
  /** Present only once THIS screen's hero has rendered. */
  hero: string;
};

const SCREENS: Screen[] = [
  { name: "Bloodwork", view: "bloodwork", hero: '[data-record="bloodwork"]' },
  { name: "Measurements", view: "measurements", hero: '[data-record="measurements"]' },
  { name: "Progress Photos", view: "progress-photos", hero: '[data-record="progress-photos"]' },
  { name: "Physique Command", view: "physique", hero: '[data-record="physique"]' },
  { name: "Physique Cockpit", view: "physique-intelligence", hero: '[data-record="physique-intelligence"]' },
  { name: "Biomarker Cockpit", view: "biomarker-intelligence", hero: '[data-record="biomarker-intelligence"]' },
  { name: "Peak Physique", view: "peak-physique", hero: '[data-record="peak-physique"]' },
  { name: "Journal", view: "journal", hero: '[data-record="journal"]' },
  { name: "Enhanced Monitor", view: "enhanced-monitor", hero: '[data-record="enhanced-monitor"]' },
];

/** Member records. Synthetic, dated, and shaped exactly like real entries. */
function seededState() {
  const stamp = "2026-09-01T12:00:00.000Z";
  return {
    subscriptionTier: "elite",
    onboarding: { status: "complete", currentStep: 99, startedAt: stamp },
    /* Accepted, so the screens under test show their own single action rather
       than the acknowledgement gate's. */
    safetyAcknowledgement: { acknowledgedAt: stamp, version: SAFETY_ACK_VERSION, adultConfirmedAt: stamp },
    physiqueCommand: {
      goal: "recomp",
      checkInIntervalDays: 7,
      weakPoints: ["delts"],
      focus: { primary: null, secondary: [], support: [], track: null, updatedAt: null },
      entries: [
        {
          id: "seed-a",
          date: "2026-07-11",
          bodyWeightLb: 192.4,
          measurements: { waist: 34.5, chest: 43, arms: 16 },
          notes: "Baseline check-in, measured fasted.",
        },
        {
          id: "seed-b",
          date: "2026-09-12",
          bodyWeightLb: 188.1,
          measurements: { waist: 33.2, chest: 43.2, arms: 16.3 },
          notes: "Same conditions as the baseline.",
        },
      ],
      photoCheckIns: [
        { id: "seed-photo", date: "2026-09-10", poses: ["front-relaxed", "side-relaxed"], consistencyScore: 67, notes: "Flat morning light." },
      ],
    },
    bloodworkLogs: [
      {
        id: "seed-lab-1",
        testDate: "2026-06-26",
        labName: "Quest",
        createdAt: "2026-06-26T12:00:00.000Z",
        markers: [
          { name: "Hematocrit", value: "45", unit: "%", referenceRange: "38.5-50.0" },
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
          { name: "Hematocrit", value: "52.1", unit: "%", referenceRange: "38.5-50.0", labFlag: "H" },
          { name: "Glucose", value: "91", unit: "mg/dL", referenceRange: "65-99" },
        ],
      },
    ],
  };
}

async function bootTo(page: Page, view: string, state: Record<string, unknown>) {
  await page.addInitScript(
    ({ k, v, s }) => {
      window.localStorage.setItem("fba-preview-view", v);
      if (!window.localStorage.getItem(k)) {
        window.localStorage.setItem(k, JSON.stringify({ state: s, version: 0 }));
      }
    },
    { k: KEY, v: view, s: state },
  );
  /* `domcontentloaded`: the dev server's HMR socket keeps networkidle from settling. */
  await page.goto("/", { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.locator("main").waitFor({ state: "visible", timeout: 120_000 });
}

/**
 * Bordered + rounded panels nested inside one another, anywhere in <main>.
 *
 * Controls are not panels: a button, an input, a native select, a summary —
 * and a <label> wrapping a checkbox, which the safety symptom check renders
 * as a bordered row. Those are form controls that happen to carry a rim,
 * not a second surface level.
 */
async function nestedPanels(page: Page): Promise<string[]> {
  return nestedSurfaces(page, { ...BORDERED_PANEL_RULE, controls: `${BORDERED_PANEL_RULE.controls}, label` });
}

/** Buttons painted gold (a gold fill, or any gold stop in a gradient, in any colour format) — the one primary action per screen. */
async function goldActions(page: Page): Promise<string[]> {
  return findGoldActions(page, { selector: "main button", match: "fill", label: 200 });
}

for (const viewport of [
  { name: "1440x1000", width: 1440, height: 1000, touch: false },
  { name: "390x844", width: 390, height: 844, touch: true },
] as const) {
  test.describe(`record screens at ${viewport.name}`, () => {
    test.use({
      viewport: { width: viewport.width, height: viewport.height },
      hasTouch: viewport.touch,
      isMobile: viewport.touch,
    });

    for (const screen of SCREENS) {
      test(`${screen.name} composes correctly`, async ({ page }) => {
        test.setTimeout(180_000);
        const pageErrors: string[] = [];
        page.on("pageerror", (error) => pageErrors.push(error.message));

        await bootTo(page, screen.view, seededState());
        await expect(page.locator(screen.hero).first(), `${screen.name} rendered its hero`).toBeVisible({ timeout: 90_000 });

        /* ── One hero ── */
        await expect(page.locator("main h1").filter({ visible: true }), "exactly one h1").toHaveCount(1);

        /* ── One gold action ── */
        const gold = await goldActions(page);
        expect(gold, `${screen.name} gold actions: ${gold.join(" | ")}`).toHaveLength(1);

        /* ── No card in a card ── */
        expect(await nestedPanels(page), "bordered rounded panels nested in main").toEqual([]);

        /* ── No sideways overflow ── */
        const width = await page.evaluate(() => `${window.innerWidth}/${document.documentElement.scrollWidth}`);
        expect(width, "no horizontal overflow").toBe(`${viewport.width}/${viewport.width}`);

        /* ── Hydration ── */
        expect(pageErrors.filter((error) => /Hydration/i.test(error)), `${screen.name} hydration`).toEqual([]);

        /* ── iOS zooms any input under 16px, which breaks the rimless illusion ── */
        if (viewport.touch) {
          const small = await page.evaluate(() =>
            [...document.querySelectorAll("main input, main textarea, main select")]
              .filter((el) => {
                const rect = el.getBoundingClientRect();
                return rect.width > 0 && rect.height > 0 && parseFloat(getComputedStyle(el).fontSize) < 16;
              })
              .map((el) => `${el.tagName.toLowerCase()}[${el.getAttribute("aria-label") ?? el.getAttribute("type") ?? ""}]`),
          );
          expect(small, "inputs are at least 16px on a phone").toEqual([]);
        }
      });
    }
  });
}

test.describe("honesty", () => {
  test.use({ viewport: { width: 1440, height: 1000 } });

  test("the Physique Cockpit carries no projection, target, ETA or symmetry score", async ({ page }) => {
    test.setTimeout(180_000);
    await bootTo(page, "physique-intelligence", seededState());
    await expect(page.locator('[data-record="physique-intelligence"]').first()).toBeVisible({ timeout: 90_000 });

    const text = (await page.locator("main").innerText()).replace(/\s+/g, " ");
    for (const banned of ["ETA", "Projected", "Target 185", "Bilateral Balance", "Symmetry Index", "Lagging Group"]) {
      expect(text, `"${banned}" must be gone from the Physique Cockpit`).not.toContain(banned);
    }
    // What replaced it: the member's own evidence, stated before any reading.
    // It now rides in the hero eyebrow, which is uppercased in CSS.
    expect(text).toMatch(/check-ins over/i);
  });

  test("the Journal shows the member's own notes and none of the old samples", async ({ page }) => {
    test.setTimeout(180_000);
    await bootTo(page, "journal", seededState());
    await expect(page.locator('[data-record="journal"]').first()).toBeVisible({ timeout: 90_000 });

    const text = (await page.locator("main").innerText()).replace(/\s+/g, " ");
    for (const sample of ["Sleep was solid at 8.2h", "Legs still sore from Saturday squats", "W6 D2 — Upper Push"]) {
      expect(text, `sample entry "${sample}" must be gone`).not.toContain(sample);
    }
    expect(text, "the member's own note is shown").toContain("Same conditions as the baseline.");
    expect(text).toContain("Fasted draw before the next review.");
  });

  test("a cockpit with no data names what it needs, with real progress and a way in", async ({ page }) => {
    test.setTimeout(240_000);
    /* A Reserve Black member who has logged nothing at all — the state the
       owner measured as "not much info in there". */
    const bare = { subscriptionTier: "elite", onboarding: { status: "complete", currentStep: 99, startedAt: "2026-09-01T12:00:00.000Z" } };

    for (const view of ["physique-intelligence", "biomarker-intelligence", "peak-physique", "physique"]) {
      const fresh = await page.context().newPage();
      await bootTo(fresh, view, bare);
      await expect(fresh.locator(`[data-record="${view}"]`).first()).toBeVisible({ timeout: 90_000 });

      /* `innerText` returns rendered text, and these labels are uppercased in
         CSS — so the match is case-insensitive by necessity, not by laziness. */
      const text = (await fresh.locator("main").innerText()).replace(/\s+/g, " ");
      // Real progress against a named requirement, e.g. "0 of 2 check-ins".
      expect(text, `${view} states requirement progress`).toMatch(/\d+ of \d+ [a-z]/i);
      expect(text, `${view} states what is still needed`).toMatch(/of \d+ ready|nothing logged yet/i);

      // And one gold action that lands on a real logger.
      const gold = await goldActions(fresh);
      expect(gold, `${view} offers exactly one way in: ${gold.join(" | ")}`).toHaveLength(1);

      // Every requirement row offers its own control — no dead list.
      const controls = await fresh.evaluate(() =>
        [...document.querySelectorAll('main [aria-label="What this cockpit needs"] button')].length,
      );
      expect(controls, `${view} requirement rows are actionable`).toBeGreaterThanOrEqual(2);
      await fresh.close();
    }
  });
});
