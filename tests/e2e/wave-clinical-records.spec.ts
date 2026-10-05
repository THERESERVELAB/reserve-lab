import { test, expect, type Page } from "@playwright/test";

import { SAFETY_ACK_VERSION } from "../../src/lib/safety/acknowledgement";
import { BROAD_RULE, nestedSurfaces as findNestedSurfaces } from "./support/surface-nesting";
import { GOLD_KIT_SOURCE, type GoldKit } from "./support/gold-action";
import { settleAnimations } from "./support/settle";

/**
 * CLINICAL RECORDS WAVE — Bloodwork Log, Biomarker Cockpit and Enhanced
 * Monitor brought to the simplified Apex bar, at 1280×900 and 390×844 with
 * touch, in two states:
 *
 *   active  a logged compound, a 12-week cycle at week 6 with a checkpoint,
 *           two lab panels (Hematocrit flagged H by the lab), measurement and
 *           photo check-ins, and the current safety acknowledgement
 *   fresh   a Reserve Black member who has logged nothing and accepted nothing
 *
 * Every screen, both states, both widths:
 *   · exactly one visible h1
 *   · at most one gold action — counted by text colour rgb(10, 11, 16) AND by
 *     a gold background fill, because either alone has missed real golds
 *   · no surface nested in another (border OR background OR shadow), the broad
 *     check, not only the bordered one
 *   · no horizontal overflow and no paragraph over 240 characters
 *
 * Active only:
 *   · 911 / 988 visible, and flagged rows show the report's range and flag
 *   · the symptom check is one row that opens an aria-modal dialog
 *
 * Plus a critical-lab + reported-warning-sign state, where 911 / 988 must be
 * visible on all three screens.
 *
 * ONE DOCUMENTED EXCEPTION to "at most one gold": fresh Bloodwork shows the
 * shipped `SafetyAcknowledgementGate` and its own gold "Continue" (see
 * redesign-records.spec.ts). Controls inside that gate are excluded by name.
 *
 * The launch switch is respected: with RESERVE_E2E_SAFETY_TOOLS=off these
 * tests skip, because every enhanced row is correctly hidden.
 */

const KEY = "final-boss-athlete-settings";
/** Tuesday 15 September 2026, 4:12 PM local. */
const WHEN = new Date(2026, 8, 15, 16, 12, 0);
const SWITCH_OFF = process.env.RESERVE_E2E_SAFETY_TOOLS === "off";
const SHOTS = process.env.WAVE_CLINICAL_SHOTS;

type Screen = { name: string; view: string; hero: string };
const SCREENS: Screen[] = [
  { name: "Bloodwork", view: "bloodwork", hero: '[data-record="bloodwork"]' },
  { name: "Biomarker Cockpit", view: "biomarker-intelligence", hero: '[data-record="biomarker-intelligence"]' },
  { name: "Enhanced Monitor", view: "enhanced-monitor", hero: '[data-record="enhanced-monitor"]' },
];

type Seed = "active" | "fresh" | "critical";

async function boot(page: Page, view: string, seed: Seed) {
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
  /* `domcontentloaded`: the dev server's HMR socket keeps networkidle from settling. */
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
    ({ k, iso, v, seed, ackVersion }) => {
      const now = new Date(iso);
      const dayKey = (offset: number) => {
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

      if (seed !== "fresh") {
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
              ...(seed === "critical" ? [{ name: "Potassium", value: "6.8", unit: "mmol/L", referenceRange: "3.5-5.3", labFlag: "HH" }] : []),
            ],
          },
        ];
        s.physiqueCommand = {
          ...s.physiqueCommand,
          entries: [
            { id: "seed-a", date: "2026-07-11", bodyWeightLb: 192.4, measurements: { waist: 34.5 }, notes: "Baseline check-in." },
            { id: "seed-b", date: "2026-09-12", bodyWeightLb: 188.1, measurements: { waist: 33.2 }, notes: "Same conditions." },
          ],
          photoCheckIns: [{ id: "seed-photo", date: "2026-09-10", poses: ["front-relaxed"], consistencyScore: 67, notes: "" }],
        };
        if (seed === "critical") {
          s.redFlagReports = [{ id: "e2e-flag", reportedAt: new Date(now.getTime() - 3_600_000).toISOString(), flags: ["chest-pain"] }];
        }
      }
      return JSON.stringify(parsed);
    },
    { k: KEY, iso: WHEN.toISOString(), v: view, seed, ackVersion: SAFETY_ACK_VERSION },
  );
  await page.addInitScript(({ k, v }) => window.localStorage.setItem(k, v), { k: KEY, v: patched });
  await page.reload({ waitUntil: "domcontentloaded", timeout: 120_000 });
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

/** Gold by text colour OR gold paint. The acknowledgement gate's own Continue is the documented exception. */
function goldActions(page: Page) {
  return page.evaluate((kitSource) => {
    /* The shared gold reader (support/gold-action), rebuilt in the page: any colour format. */
    const kit = new Function(`return (${kitSource})()`)() as GoldKit;
    const goldish = kit.paintIsGold;
    return [...document.querySelectorAll("main button, main a, main [role=button]")]
      .filter((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return false;
        /* EscalationList's tap-to-call links are filled with Reserve red (#ef7d55),
           which the gold paint heuristic also matches. They are the escalation
           ladder, not a primary action. */
        if (el.matches('a[href^="tel:"], a[href^="sms:"]')) return false;
        const cs = getComputedStyle(el);
        if (!(kit.isInk(cs.color) || goldish(cs.backgroundColor) || goldish(cs.backgroundImage))) return false;
        const gate = [...document.querySelectorAll("main h2")].find((h) => h.textContent?.includes("How Reserve helps keep you safe"));
        const gateRoot = gate?.closest("div.flex.flex-col.gap-4");
        return !(gateRoot && gateRoot.contains(el) && el.textContent?.trim() === "Continue");
      })
      .map((el) => (el.textContent ?? "").trim().slice(0, 40));
  }, GOLD_KIT_SOURCE);
}

/** Rounded + (visible border OR tinted background OR shadow) surfaces inside one another, dialogs excluded. */
function nestedSurfaces(page: Page) {
  /* The broad rule as this wave shipped it: closed disclosures are measured too. */
  return findNestedSurfaces(page, { ...BROAD_RULE, skipClosedDisclosures: false });
}

function longParagraphs(page: Page) {
  return page.evaluate(() => {
    const main = document.querySelector("main");
    if (!main) return ["no main"];
    const BLOCK = new Set(["block", "list-item", "flex", "grid", "table", "table-cell", "flow-root"]);
    const out: string[] = [];
    for (const el of main.querySelectorAll("p, div, li, dd, blockquote, span, td")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const d = getComputedStyle(el).display;
      if (!BLOCK.has(d) && el.tagName !== "P") continue;
      if ([...el.querySelectorAll("*")].some((c) => BLOCK.has(getComputedStyle(c).display) || c.tagName === "P")) continue;
      const t = (el as HTMLElement).innerText.replace(/\s+/g, " ").trim();
      if (t.length > 240) out.push(t.slice(0, 80));
    }
    return out;
  });
}

async function expectEmergencyLine(page: Page, name: string) {
  const line = page.locator('main [data-record="emergency-line"]').filter({ visible: true }).first();
  await expect(line, `${name}: 911 / 988 on screen`).toBeVisible();
  await expect(line.getByRole("link", { name: /call 911/i })).toHaveAttribute("href", "tel:911");
  await expect(line.getByRole("link", { name: /988/ })).toHaveAttribute("href", "tel:988");
}

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
}

for (const vp of [
  { name: "1280x900", width: 1280, height: 900, touch: false },
  { name: "390x844", width: 390, height: 844, touch: true },
] as const) {
  test.describe(`clinical records at ${vp.name}`, () => {
    test.skip(SWITCH_OFF, "Runs against a server with the launch switch on.");
    test.use({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.touch, isMobile: vp.touch });

    for (const seed of ["active", "fresh"] as const) {
      for (const screen of SCREENS) {
        test(`${screen.name} (${seed}) meets the Apex bar`, async ({ page }) => {
          test.setTimeout(240_000);
          const errors: string[] = [];
          page.on("pageerror", (error) => errors.push(error.message));
          await boot(page, screen.view, seed);
          await expect(page.locator(screen.hero).first()).toBeVisible({ timeout: 90_000 });
          if (seed === "active") await expect(page.locator('[data-record="symptom-check"]').first()).toBeVisible({ timeout: 30_000 });
          await scrollThrough(page);

          await expect(page.locator("main h1").filter({ visible: true }), "exactly one h1").toHaveCount(1);
          const gold = await goldActions(page);
          expect(gold.length, `${screen.name} gold: ${gold.join(" | ")}`).toBeLessThanOrEqual(1);
          expect(gold.length, `${screen.name} has its gold action`).toBe(1);
          expect(await nestedSurfaces(page), "surfaces nested in main").toEqual([]);
          expect(await longParagraphs(page), "paragraphs over 240 characters").toEqual([]);
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
          expect(overflow, "horizontal overflow").toBeLessThanOrEqual(0);
          expect(errors.filter((e) => /Hydration/i.test(e)), "hydration").toEqual([]);

          const text = (await page.locator("main").innerText()).replace(/\s+/g, " ");
          /* A member-recorded amount is never repeated on these screens. */
          expect(text).not.toMatch(/\b200 ?mg\b/i);

          if (seed === "active") {
            await expectEmergencyLine(page, screen.name);
            /* The checklist lives in a sheet; its row stays on the page. */
            await expect(page.getByRole("checkbox", { name: "Chest pain, pressure or tightness" })).toHaveCount(0);
          }

          if (screen.view === "bloodwork" && seed === "active") {
            await expect(page.getByRole("heading", { name: "Log a lab result" })).toHaveCount(0);
            const finding = page.locator('[data-record="lab-finding"]').filter({ hasText: "Hematocrit" });
            await expect(finding).toContainText("52.1 %");
            await expect(finding).toContainText("Range 38.5-50.0 on your report");
            await expect(finding).toContainText("Lab flag High");
            await expect(finding).toContainText("was 45 % on Jun 26, 2026");
            await expect(page.locator('[data-record="lab-safety"]')).toContainText("Commonly watched for Testosterone Cypionate");
            await expect(page.locator('[data-record="lab-route"]')).toContainText("Get this reviewed");
            await expect(page.locator('[data-record="lab-route"]')).toContainText("No clinician? Urgent care, a telehealth visit or a pharmacist can review this with you.");
            await expect(page.locator('[data-record="cycle-context"]')).toContainText("Autumn block · week 6 of 12 · checkpoint Sep 25");
          }

          if (screen.view === "biomarker-intelligence" && seed === "active") {
            await expect(page.locator("[data-record-statement]")).toHaveText("2 lab records over 67 days · 1 outside your lab's range");
            const row = page.locator("li").filter({ has: page.locator('[data-record="marker-row"]', { hasText: "Hematocrit" }) });
            await expect(row).toContainText("45 → 52.1 %");
            await expect(row).toContainText("Range on your report 38.5-50.0");
            await expect(row).toContainText("Your lab flagged this High · Get this reviewed");
            await expect(page.locator('[data-record="marker-route"]')).toContainText("No clinician?");
            for (const gone of ["Evidence", "Keep an eye on", "Reading this with your clinician"]) {
              await expect(page.locator("main").getByText(gone, { exact: true })).toHaveCount(0);
            }
          }

          if (screen.view === "enhanced-monitor" && seed === "active") {
            await expect(page.locator("[data-record-statement]")).toHaveText("7 records on file · last logged Sep 12");
            await expect(page.locator("main").getByRole("button", { name: "Open Compound Log" })).toHaveCount(1);
            await expect(page.locator('[data-record="escalation-lab-discuss"]')).toContainText("Get this reviewed");
            await expect(page.locator('[data-record="cycle-context"]').getByRole("button")).toContainText("Open Compound Command");
            await expect(page.locator('[data-record="commonly-watched"]').getByRole("button")).toContainText("Open Bloodwork Log");
          }

          if (seed === "fresh" && screen.view === "biomarker-intelligence") {
            await expect(page.locator("main")).toContainText(/\d+ of \d+ [a-z]/i);
          }

          await shot(page, `${screen.view}-${seed}-${vp.width}`);
        });
      }
    }

    test("the symptom check opens as an aria-modal dialog, and 911 stays one tap away", async ({ page }) => {
      test.setTimeout(240_000);
      await boot(page, "biomarker-intelligence", "active");
      const row = page.locator('[data-record="symptom-check"]').first();
      await expect(row).toBeVisible({ timeout: 90_000 });
      await expect(row).toContainText("Are you having any of these right now?");
      await expect(row).toContainText("17 warning signs");
      await row.getByRole("button", { name: /^Check/ }).click();

      const dialog = page.getByRole("dialog", { name: "Symptom check" });
      await expect(dialog).toBeVisible();
      await expect(dialog).toHaveAttribute("aria-modal", "true");
      await expect(dialog.getByRole("checkbox")).toHaveCount(17);
      await expect(dialog.getByRole("link", { name: /call 911/i })).toHaveAttribute("href", "tel:911");
      await settleAnimations(page);
      if (vp.touch) {
        const cover = await dialog.getByRole("link", { name: /call 911/i }).evaluate((el) => {
          el.scrollIntoView({ block: "center" });
          const r = el.getBoundingClientRect();
          const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          return at && (at === el || el.contains(at)) ? null : at?.tagName ?? "nothing";
        });
        expect(cover, "the 911 link in the sheet is not covered").toBeNull();
      }
      await shot(page, `symptom-sheet-${vp.width}`);

      await dialog.getByLabel("Chest pain, pressure or tightness").check();
      await dialog.getByRole("button", { name: "See what to do" }).click();
      await expect(dialog.getByRole("link", { name: "Call 911" }).first()).toHaveAttribute("href", "tel:911");
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      /* The report now sits on the page's own escalation ladder. */
      await expect(page.locator("main").getByRole("link", { name: "Call 911" }).first()).toBeVisible();
    });

    test("New Lab Record opens the intake sheet with the on-device notice", async ({ page }) => {
      test.setTimeout(240_000);
      await boot(page, "bloodwork", "active");
      await expect(page.locator('[data-record="bloodwork"]')).toBeVisible({ timeout: 90_000 });
      await page.locator("[data-record-action]").getByRole("button", { name: "New Lab Record" }).click();
      const sheet = page.getByRole("dialog", { name: "New lab record" });
      await expect(sheet).toHaveAttribute("aria-modal", "true");
      await expect(sheet).toContainText("Read on this device");
      await expect(sheet.getByRole("button", { name: /Add your lab report/ })).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
    });
  });
}

test.describe("critical lab and a reported warning sign", () => {
  test.skip(SWITCH_OFF, "Runs against a server with the launch switch on.");
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  for (const screen of SCREENS) {
    test(`${screen.name} keeps 911 / 988 and the urgent ladder visible`, async ({ page }) => {
      test.setTimeout(240_000);
      await boot(page, screen.view, "critical");
      await expect(page.locator(screen.hero).first()).toBeVisible({ timeout: 90_000 });
      await expect(page.locator('[data-record="symptom-check"]').first()).toBeVisible({ timeout: 30_000 });
      await scrollThrough(page);
      await expectEmergencyLine(page, screen.name);
      /* The reported warning sign's ladder is on the page, not in a disclosure or sheet. */
      const ladder = page.locator("main").getByRole("link", { name: "Call 911" }).first();
      await expect(ladder).toBeVisible();
      if (screen.view === "bloodwork") {
        await expect(page.getByText("Potassium: marked critical by the lab")).toBeVisible();
      }
      if (screen.view === "biomarker-intelligence") {
        await expect(page.locator('[data-record="marker-route"]')).toContainText("Get a medical review today");
      }
      expect((await goldActions(page)).length).toBeLessThanOrEqual(1);
    });
  }
});
