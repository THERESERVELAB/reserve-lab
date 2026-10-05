import { test, expect, type Page } from "@playwright/test";
import { BORDERED_PANEL_RULE, nestedSurfaces } from "./support/surface-nesting";
import { goldActions as findGoldActions } from "./support/gold-action";

/**
 * REDESIGN — UTILITY SCREENS (wave 2, agent E).
 *
 * Settings, My Coach, Community, Education and Build Studio, at 1440×1000
 * and at 390×844 with touch, seeded as an onboarded Reserve Black member.
 * Each screen asserts the redesign contract:
 *
 *   · exactly one visible <h1>
 *   · the gold primary action count — 1, or 0 where the screen is honestly
 *     read-only (documented per screen below)
 *   · no bordered, rounded panel nested inside another in <main>
 *   · no horizontal overflow
 *   · no hydration errors
 *   · inputs are at least 16px on a phone
 *
 * DOCUMENTED ZERO-GOLD SCREENS:
 *   · Community — reading and posting are not built, so there is nothing to
 *     do. The hero says so instead of offering a button that goes nowhere.
 *   · Education — no lessons are written, so there is no lesson to start.
 *     The screen is a read-only glossary of real, shipped definitions.
 *
 * Plus: the Build Studio deep editors (day editor, import review) stay
 * de-boxed when opened, Community carries none of the old invented social
 * content, and — at 375×812 with touch — every fixed overlay this wave fixed
 * puts its confirm button on top, where a finger can reach it, rather than
 * under the phone tab bar.
 */

const KEY = "final-boss-athlete-settings";
const STAMP = "2026-09-01T12:00:00.000Z";

type Screen = { name: string; view: string; hero: string; gold: 0 | 1 };

const SCREENS: Screen[] = [
  { name: "Settings", view: "settings", hero: '[data-utility="settings"]', gold: 1 },
  { name: "My Coach", view: "my-coach", hero: '[data-utility="my-coach"]', gold: 1 },
  { name: "Community", view: "community", hero: '[data-utility="community"]', gold: 0 },
  { name: "Education", view: "education", hero: '[data-utility="education"]', gold: 0 },
  { name: "Build Studio", view: "lifestyle-builder", hero: '[data-lifestyle="hero"]', gold: 1 },
];

function seededState() {
  return {
    subscriptionTier: "elite",
    onboarding: { status: "complete", currentStep: 99, startedAt: STAMP },
    setupProfile: { setupComplete: true, completedAt: STAMP, completedSteps: [] },
  };
}

async function bootTo(page: Page, view: string, state: Record<string, unknown> = seededState(), coachingActor?: string) {
  await page.addInitScript(
    ({ k, v, s, actor }) => {
      window.localStorage.setItem("fba-preview-view", v);
      if (!window.localStorage.getItem(k)) {
        window.localStorage.setItem(k, JSON.stringify({ state: s, version: 0 }));
      }
      if (actor && !window.localStorage.getItem("reserve-coaching-ui")) {
        window.localStorage.setItem(
          "reserve-coaching-ui",
          JSON.stringify({ state: { actorId: actor, workspace: "personal", coachView: "command", activeClientId: null }, version: 0 }),
        );
      }
    },
    { k: KEY, v: view, s: state, actor: coachingActor ?? null },
  );
  /* `domcontentloaded`: the dev server's HMR socket keeps networkidle from settling. */
  await page.goto("/", { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.locator("main").waitFor({ state: "visible", timeout: 120_000 });
}

/** Bordered + rounded panels nested inside one another in <main>. Controls are not panels. */
async function nestedPanels(page: Page, scope = "main"): Promise<string[]> {
  const roots = await page.locator(scope).all();
  if (roots.length === 0) return [`nothing matches ${scope}`];
  /* A tab strip (ReserveSegmented) is a control with a rim, not a surface. */
  const rule = { ...BORDERED_PANEL_RULE, controls: `${BORDERED_PANEL_RULE.controls}, label, [role=tablist]` };
  return (await Promise.all(roots.map((root) => nestedSurfaces(root, rule)))).flat();
}

/** Buttons painted gold (a gold fill, or any gold stop in a gradient, in any colour format) — the one primary action per screen. */
async function goldActions(page: Page): Promise<string[]> {
  return findGoldActions(page, { selector: "main button", match: "fill", label: 200 });
}

for (const viewport of [
  { name: "1440x1000", width: 1440, height: 1000, touch: false },
  { name: "390x844", width: 390, height: 844, touch: true },
] as const) {
  test.describe(`utility screens at ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height }, hasTouch: viewport.touch, isMobile: viewport.touch });

    for (const screen of SCREENS) {
      test(`${screen.name} composes correctly`, async ({ page }) => {
        test.setTimeout(180_000);
        const pageErrors: string[] = [];
        page.on("pageerror", (error) => pageErrors.push(error.message));

        await bootTo(page, screen.view);
        await expect(page.locator(screen.hero).first(), `${screen.name} rendered its hero`).toBeVisible({ timeout: 90_000 });

        await expect(page.locator("main h1").filter({ visible: true }), "exactly one h1").toHaveCount(1);

        const gold = await goldActions(page);
        expect(gold, `${screen.name} gold actions: ${gold.join(" | ")}`).toHaveLength(screen.gold);
        if (screen.gold === 0) {
          // A read-only hero says why there is nothing to do.
          await expect(page.locator(`${screen.hero} [data-utility-no-action]`)).toBeVisible();
        }

        expect(await nestedPanels(page), "bordered rounded panels nested in main").toEqual([]);

        const width = await page.evaluate(() => `${window.innerWidth}/${document.documentElement.scrollWidth}`);
        expect(width, "no horizontal overflow").toBe(`${viewport.width}/${viewport.width}`);

        expect(pageErrors.filter((error) => /Hydration/i.test(error)), `${screen.name} hydration`).toEqual([]);

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

test.describe("honesty and behaviour", () => {
  test.use({ viewport: { width: 1440, height: 1000 } });

  test("Community carries none of the invented posts, ranks or counts", async ({ page }) => {
    test.setTimeout(180_000);
    await bootTo(page, "community");
    await expect(page.locator('[data-utility="community"]')).toBeVisible({ timeout: 90_000 });
    const text = (await page.locator("main").innerText()).replace(/\s+/g, " ");
    for (const invented of [
      "Hit a new PR on incline today",
      "285×4",
      "247 members online",
      "Posts Today",
      "Members Online",
      "38 participating",
      "Avg Adherence",
      "Atlas_M",
      "LEGEND",
      "COMPETITOR",
      "Command Active",
      "Elite",
    ]) {
      expect(text, `"${invented}" must be gone from Community`).not.toContain(invented);
    }
    expect(text).toMatch(/Community is not open yet/i);
    await expect(page.locator("main textarea, main input")).toHaveCount(0);
  });

  test("Education lists no unwritten lessons and teaches only real definitions", async ({ page }) => {
    test.setTimeout(180_000);
    await bootTo(page, "education");
    await expect(page.locator('[data-utility="education"]')).toBeVisible({ timeout: 90_000 });
    const text = (await page.locator("main").innerText()).replace(/\s+/g, " ");
    for (const promised of ["Hormone Basics", "Supplementation Evidence", "Ready to log"]) {
      expect(text, `"${promised}" must be gone from Education`).not.toContain(promised);
    }
    expect(text).toMatch(/No lessons are written yet/i);
    expect(text).toMatch(/Reps Left in Reserve/i);
  });

  test("Settings' gold action lands in the age field, and the age correction still works", async ({ page }) => {
    test.setTimeout(180_000);
    await bootTo(page, "settings");
    const hero = page.locator('[data-utility="settings"]');
    await expect(hero).toBeVisible({ timeout: 90_000 });
    await hero.getByRole("button", { name: "Add Your Age" }).click();
    await expect(page.getByLabel("Age", { exact: true })).toBeFocused();
    await page.getByLabel("Age", { exact: true }).fill("34");
    await page.getByRole("button", { name: "Save age" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Age saved." })).toBeVisible();
    // With the age in, the next missing detail is the name.
    await expect(hero.getByRole("button", { name: "Add Your Name" })).toBeVisible();
  });

  test("My Coach's gold action lands in the connection field", async ({ page }) => {
    test.setTimeout(180_000);
    await bootTo(page, "my-coach");
    const hero = page.locator('[data-utility="my-coach"]');
    await expect(hero).toBeVisible({ timeout: 90_000 });
    await expect(hero).toContainText("No coach is connected.");
    await hero.getByRole("button", { name: "Connect With a Coach" }).click();
    await expect(page.getByPlaceholder("RSV-XXXX or @coachhandle")).toBeFocused();
  });

  test("a connected member's My Coach reads the real relationship and keeps one gold action", async ({ page }) => {
    test.setTimeout(180_000);
    /* The development demo scenario connects this member to a coach. */
    await bootTo(page, "my-coach", seededState(), "member-anthony-rivera");
    const hero = page.locator('[data-utility="my-coach"]');
    await expect(hero).toBeVisible({ timeout: 90_000 });
    test.skip(!/Connected to/i.test(await hero.innerText()), "No demo coaching relationship in this environment");
    const gold = await goldActions(page);
    expect(gold, `connected gold actions: ${gold.join(" | ")}`).toHaveLength(1);
    /* Only this screen's own sections are held to the no-nesting rule here.
       Live day, coach plans, operations and the chat thread are shared coach
       workspace components (src/components/coaching/**, wave 3) and still
       nest tiles inside their own panels. */
    const ownSections = '[data-utility="my-coach"], #my-coach-requests, #my-coach-connection, #my-coach-check-in, section[aria-label="Daily weight"]';
    expect(await nestedPanels(page, ownSections), "My Coach's own sections are de-boxed").toEqual([]);
    // The honesty rules of the weekly check-in are intact.
    const start = page.getByRole("button", { name: "Start check-in" });
    if (await start.count()) {
      await start.click();
      await expect(page.getByText("Scales you leave unset reach your coach as not answered.")).toBeVisible();
      await expect(page.getByRole("button", { name: "Submit check-in" })).toBeDisabled();
      await expect(page.getByText("Not set").first()).toBeVisible();
    }
  });

  test("Build Studio's day editor and import review stay de-boxed when open", async ({ page }) => {
    test.setTimeout(240_000);
    await bootTo(page, "lifestyle-builder");
    await expect(page.locator('[data-lifestyle="hero"]')).toBeVisible({ timeout: 90_000 });

    /* The editors are rows that open in place; open the program canvas and the import row. */
    await page.locator("#build-studio-program summary").click();
    await page.getByRole("button", { name: "Reserve Template", exact: true }).click();
    await page.getByRole("button", { name: "Edit This Day" }).click();
    await page.getByRole("button", { name: "Add Movement" }).click();
    await expect(page.getByText("Choose Change Scope")).toBeVisible();
    await page.getByRole("button", { name: "Compare with Reserve Original" }).click();
    await page.getByRole("button", { name: "Day History" }).click();
    await page.getByRole("button", { name: "Let Reserve Review This Day" }).click();

    await page.locator("#build-studio-import summary").click();
    await page.getByRole("button", { name: "Paste My Program" }).click();
    await page.getByRole("button", { name: "Parse into Review Draft" }).click();
    await expect(page.getByText("Import Review")).toBeVisible();

    expect(await nestedPanels(page), "no card in a card with the deep editors open").toEqual([]);
    const width = await page.evaluate(() => `${window.innerWidth}/${document.documentElement.scrollWidth}`);
    expect(width).toBe("1440/1440");
  });
});

/* ── Overlays on a phone: the confirm button must be the element under a finger ── */

async function hitsItself(page: Page, name: string | RegExp) {
  const dialog = page.getByRole("dialog").last();
  await expect(dialog).toBeVisible({ timeout: 30_000 });
  const button = dialog.getByRole("button", { name }).last();
  await button.scrollIntoViewIfNeeded();
  await expect(button).toBeVisible();
  const result = await button.evaluate((el) => {
    const rect = el.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return {
      ok: Boolean(hit && (hit === el || el.contains(hit))),
      hit: hit ? `${hit.tagName.toLowerCase()}.${String(hit.getAttribute("class") ?? "").slice(0, 60)}` : "nothing",
    };
  });
  expect(result.ok, `"${String(name)}" is covered by ${result.hit}`).toBe(true);
}

test.describe("overlays at 375x812", () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });

  test("Build Studio confirmation sheet", async ({ page }) => {
    test.setTimeout(240_000);
    await bootTo(page, "lifestyle-builder");
    await expect(page.locator('[data-lifestyle="hero"]')).toBeVisible({ timeout: 90_000 });
    await page.locator("#build-studio-program summary").click();
    await page.getByRole("button", { name: "Reserve Template", exact: true }).click();
    await page.getByRole("button", { name: /^Archive$/ }).first().click();
    await hitsItself(page, "Archive Program");
    await expect(page.locator(".fba-shell-bottom").first()).toBeHidden();
    await page.screenshot({ path: "test-results/redesign-utility/overlay-build-studio-375.png" });
  });

  test("Personal Command protocol drawer", async ({ page }) => {
    test.setTimeout(240_000);
    await bootTo(page, "protocol-command");
    /* Activate opens the chooser on that protocol's confirmation. */
    await page.locator('[data-protocol="recommendation"] button', { hasText: /^Activate$/ }).first().click({ timeout: 90_000 });
    await hitsItself(page, /Run This Protocol/);
    await page.screenshot({ path: "test-results/redesign-utility/overlay-protocol-375.png" });
  });

  test("Physique check-in sheet", async ({ page }) => {
    test.setTimeout(240_000);
    await bootTo(page, "physique");
    await page.locator('[data-record="physique"] [data-record-action] button').click({ timeout: 90_000 });
    await hitsItself(page, "Save Check-In");
  });

  test("My Coach access sheet", async ({ page }) => {
    test.setTimeout(240_000);
    /* The development demo scenario connects this member to a coach. */
    await bootTo(page, "my-coach", seededState(), "member-anthony-rivera");
    const hero = page.locator('[data-utility="my-coach"]');
    await expect(hero).toBeVisible({ timeout: 90_000 });
    test.skip(!/Connected to/i.test(await hero.innerText()), "No demo coaching relationship in this environment");
    await page.getByRole("button", { name: "Manage access" }).click();
    await hitsItself(page, "Save access changes");
  });
});
