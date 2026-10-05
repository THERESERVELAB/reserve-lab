import { test, expect, type Page } from "@playwright/test";
import { BORDERED_PANEL_RULE, nestedSurfaces } from "./support/surface-nesting";
import { goldActions as findGoldActions } from "./support/gold-action";

/**
 * PLAN AND INTELLIGENCE SCREENS — the program-redesign contract
 * (docs/superpowers/specs/2026-09-15-program-redesign.md, wave 1 agent B).
 *
 * Seven screens, each at 1440×1000 and 390×844 (touch), with a tier seeded
 * that unlocks every one of them. Each screen must show:
 *
 *   · exactly one visible h1 — the screen name, never two heroes
 *   · exactly one gold action — the hero's. Every other CTA is demoted.
 *   · no bordered rounded panel nested inside another, across the hero and
 *     the two sections after it. Scoped the same way the shipped
 *     phone-rooms.spec.ts scopes it: a closed disclosure's contents are
 *     display:none and are legitimately not measured, and the deep editor
 *     internals of Build Studio's builders are a documented follow-up.
 *   · no horizontal overflow, and no hydration error
 *   · on touch, no form control below the 16px iOS-zoom floor
 *
 * Deliberately NOT asserted: a minimum type size. `.type-whisper` is 7–9px
 * uppercase mono by design (constitution typography.md); the 11px floor in
 * DESIGN_BIBLE §13 applies to the Apex horizon strip only, which no screen
 * here owns.
 */

const KEY = "final-boss-athlete-settings";

type Screen = {
  view: string;
  /** The h1 this screen must render. */
  title: RegExp;
};

const SCREENS: Screen[] = [
  { view: "protocol-command", title: /^personal command$/i },
  { view: "program-horizon", title: /^program horizon$/i },
  { view: "response-profile", title: /^response model$/i },
  { view: "lifestyle-builder", title: /^build studio$/i },
  { view: "mesocycle-planner", title: /^mesocycle planner$/i },
  { view: "ai-strategist", title: /^ai strategist$/i },
  { view: "performance-intelligence", title: /^decision log$/i },
];

const VIEWPORTS = [
  { name: "1440x1000", width: 1440, height: 1000, touch: false },
  { name: "390x844", width: 390, height: 844, touch: true },
] as const;

/**
 * Seed before the app boots: onboarding complete so the wizard overlay does
 * not cover the screen, and the Reserve Black tier so the Signature-gated
 * screens render their real content instead of LockedPremiumModule.
 */
async function boot(page: Page, view: string) {
  await page.addInitScript(
    ({ k, v }) => {
      window.localStorage.setItem("fba-preview-view", v);
      const raw = window.localStorage.getItem(k);
      const parsed = raw ? JSON.parse(raw) : { state: {}, version: 0 };
      parsed.state = {
        ...parsed.state,
        activeView: v,
        /* Internal rank for the public Reserve Black plan. */
        subscriptionTier: "elite",
        onboarding: {
          ...(parsed.state.onboarding || {}),
          status: "complete",
          currentStep: 99,
          startedAt: "2026-09-01T12:00:00.000Z",
        },
      };
      window.localStorage.setItem(k, JSON.stringify(parsed));
    },
    { k: KEY, v: view },
  );

  /* `domcontentloaded`: the dev server's HMR socket keeps networkidle from settling. */
  await page.goto("/", { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.locator("main h1").first().waitFor({ timeout: 120_000 });
}

/** Gold is the FILLED primary — the scarce CTA (Bible §11). Measured from
    computed paint, so a hand-rolled gold button counts exactly like a
    ReserveButton primary and a demotion cannot be faked with class names.

    The signature is gold paint plus near-black text, which is the only
    pairing the Bible allows to read as "do this". A gold TINT behind gold or
    ivory text — a selected chip, an active filter, a highlighted option — is
    a state, not a call to action, and is deliberately not counted. */
async function goldActions(page: Page): Promise<string[]> {
  /* Gold paint and near-black text, both read in any colour format (support/gold-action). */
  return findGoldActions(page, { selector: "main button, main a[href]", visible: "laid-out", match: "dark-fill" });
}

/** Bordered AND rounded ≥8px, big enough to read as a surface. Controls are
    not panels. Mirrors the shipped phone-rooms.spec.ts detector. */
async function nestedPanels(page: Page): Promise<string[]> {
  /* The hero plus the two sections after it; a tab strip (ReserveSegmented) is a control with a rim, not a surface. */
  return nestedSurfaces(page, { ...BORDERED_PANEL_RULE, controls: `${BORDERED_PANEL_RULE.controls}, [role=tablist]` }, { sections: 3, classes: 4 });
}

for (const vp of VIEWPORTS) {
  test.describe(`plan and intelligence screens at ${vp.name}`, () => {
    test.use({
      viewport: { width: vp.width, height: vp.height },
      hasTouch: vp.touch,
      isMobile: vp.touch,
    });

    for (const screen of SCREENS) {
      test(`${screen.view} composes correctly`, async ({ page }) => {
        test.setTimeout(180_000);

        const pageErrors: string[] = [];
        page.on("pageerror", (e) => pageErrors.push(e.message));

        await boot(page, screen.view);

        /* ── One h1, and it is this screen ─────────────────────────── */
        const h1s = page.locator("main h1").filter({ visible: true });
        await expect(h1s.first()).toHaveText(screen.title, { timeout: 60_000 });
        await expect(h1s, `${screen.view} must have exactly one visible h1`).toHaveCount(1);

        /* ── Exactly one gold action ───────────────────────────────── */
        const gold = await goldActions(page);
        expect(gold, `${screen.view} gold actions at ${vp.name}: ${JSON.stringify(gold)}`).toHaveLength(1);

        /* ── No card inside a card ─────────────────────────────────── */
        const offenders = await nestedPanels(page);
        expect(offenders, `${screen.view} nested panels at ${vp.name}`).toEqual([]);

        /* ── No horizontal overflow ────────────────────────────────── */
        const overflow = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        }));
        expect(
          overflow.scrollWidth,
          `${screen.view} scrolls sideways at ${vp.name}`,
        ).toBeLessThanOrEqual(overflow.clientWidth + 1);

        /* ── Touch: no form control below the iOS-zoom floor ───────── */
        if (vp.touch) {
          const tooSmall = await page.evaluate(() => {
            const bad: string[] = [];
            document.querySelectorAll<HTMLElement>("main input, main textarea, main select").forEach((el) => {
              if (el.offsetParent === null) return;
              const size = parseFloat(getComputedStyle(el).fontSize);
              if (size < 16) bad.push(`${el.tagName.toLowerCase()} @ ${size}px`);
            });
            return bad;
          });
          expect(tooSmall, `${screen.view} has sub-16px form text`).toEqual([]);
        }

        /* ── Hydration ─────────────────────────────────────────────── */
        expect(
          pageErrors.filter((e) => /Hydration/i.test(e)),
          `${screen.view} failed hydration at ${vp.name}`,
        ).toEqual([]);
      });
    }
  });
}
