import { test, expect, type Page } from "@playwright/test";
import { BROAD_RULE, nestedSurfaces } from "./support/surface-nesting";
import { GOLD_KIT_SOURCE, type GoldKit } from "./support/gold-action";
import { settleAnimations } from "./support/settle";

/**
 * WAVE: COACH — every Coach Command screen held to the simplified Apex bar.
 *
 * SEEDED is the development demo roster (synthetic clients, labelled as sample
 * data in the shell). FRESH is a coach account with no clients, no invitations
 * and no plans. For both, at 1280×900 and 390×844 with touch:
 *
 *   · exactly one h1
 *   · at most one gold action, by BOTH detections (near-black text on the
 *     primary tier, and a gold background fill), and they agree
 *   · no surface inside another under the BROAD rule (border OR background OR
 *     shadow, rounded ≥ 8px); content behind a closed disclosure is skipped
 *   · no paragraph over 240 characters, no sideways scroll
 *   · every visible button has an accessible name
 *   · on a phone, the end of the page clears the tab bar
 *
 * Plus the phone sheet checks: the composer's Save is on top and reachable,
 * the athlete-view sheet is a labelled modal dialog, and an outside click never
 * discards a typed draft.
 */

const COACH = "member-marcus-hale";
const VIEWS = ["command", "clients", "client", "messages", "reviews", "programs", "nutrition", "schedules", "live", "alerts", "templates"] as const;
type View = (typeof VIEWS)[number];
type CoachState = "seeded" | "fresh";

const VIEWPORTS = [
  { name: "1280", width: 1280, height: 900, touch: false },
  { name: "390", width: 390, height: 844, touch: true },
] as const;

function freshDatabase() {
  const stamp = "2026-09-01T12:00:00.000Z";
  return JSON.stringify({
    version: 2,
    data: {
      members: [{ id: COACH, name: "Coach Test", email: "coach@reserve.test", tier: "premium_coach", handle: "coachtest", createdAt: stamp }],
      coachProfiles: [{ memberId: COACH, displayName: "Coach Test", headline: "Physique preparation", coachCode: "TEST-0001", specialties: [], acceptingClients: true }],
      /* Marked seeded so the development demo never writes over this empty account. */
      seededScenario: "e2e-fresh",
      seededOperations: "e2e-fresh",
    },
  });
}

async function boot(page: Page, view: View, state: CoachState) {
  await page.addInitScript(
    ({ view, fresh, coach }) => {
      if (window.sessionStorage.getItem("wave-coach-init")) return;
      window.sessionStorage.setItem("wave-coach-init", "1");
      window.localStorage.setItem(
        "final-boss-athlete-settings",
        JSON.stringify({ state: { subscriptionTier: "elite", onboarding: { status: "complete", currentStep: 99, startedAt: "2026-09-01T12:00:00.000Z" } }, version: 0 }),
      );
      window.localStorage.setItem(
        "reserve-coaching-ui",
        JSON.stringify({ state: { actorId: coach, workspace: "coach", coachView: view, activeClientId: fresh ? null : "member-anthony-rivera" }, version: 0 }),
      );
      if (fresh) window.localStorage.setItem("reserve.coaching.v1", fresh);
    },
    { view, fresh: state === "fresh" ? freshDatabase() : null, coach: COACH },
  );
  /* `domcontentloaded`: the dev server's HMR socket keeps networkidle from settling. */
  await page.goto("/", { waitUntil: "domcontentloaded", timeout: 120_000 });
  const screen = page.locator(`[data-coach-screen="${view}"]`);
  await expect(async () => {
    if (!(await screen.isVisible())) {
      /* First load can hydrate the coaching store after the shell renders; put the coach back in place. */
      await page.evaluate(
        ({ view, coach }) => {
          const raw = JSON.parse(window.localStorage.getItem("reserve-coaching-ui") || '{"state":{},"version":0}');
          raw.state = { ...raw.state, actorId: coach, workspace: "coach", coachView: view, activeClientId: raw.state.activeClientId ?? "member-anthony-rivera" };
          window.localStorage.setItem("reserve-coaching-ui", JSON.stringify(raw));
        },
        { view, coach: COACH },
      );
      await page.reload({ waitUntil: "domcontentloaded" });
    }
    await expect(screen).toBeVisible({ timeout: 20_000 });
  }).toPass({ timeout: 150_000 });
  await expect(page.locator('[data-coach="hero"] [data-coach-statement]')).not.toBeEmpty();
}

async function measure(page: Page) {
  const nested = await nestedSurfaces(page, BROAD_RULE);
  const rest = await page.evaluate((kitSource) => {
    /* The shared gold reader (support/gold-action), rebuilt in the page: any colour format. */
    const kit = new Function(`return (${kitSource})()`)() as GoldKit;
    const main = document.querySelector("main")!;
    const shown = (el: Element) => {
      for (let d = el.closest("details"); d; d = d.parentElement?.closest("details") ?? null) {
        if (!(d as HTMLDetailsElement).open && !(el as HTMLElement).matches?.("summary")) return false;
      }
      return true;
    };
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return false;
      const cs = getComputedStyle(el);
      return cs.visibility !== "hidden" && cs.display !== "none" && shown(el);
    };

    const h1 = [...document.querySelectorAll("h1")].filter(visible).length;
    const goldText = [...document.querySelectorAll("button, a")]
      .filter((b) => visible(b) && kit.isInk(getComputedStyle(b).color))
      .map((b) => (b.textContent ?? "").trim().slice(0, 40));
    const goldish = kit.paintIsGold;
    const goldFill = [...main.querySelectorAll("button, a, [role=button]")]
      .filter((b) => visible(b) && (goldish(getComputedStyle(b).backgroundColor) || goldish(getComputedStyle(b).backgroundImage)))
      .map((b) => (b.textContent ?? "").trim().slice(0, 40));


    const BLOCK = new Set(["block", "list-item", "flex", "grid", "table", "table-cell", "flow-root"]);
    const longParagraphs: string[] = [];
    for (const el of main.querySelectorAll("p, div, li, dd, blockquote, span, td")) {
      if (!visible(el)) continue;
      if (!BLOCK.has(getComputedStyle(el).display) && el.tagName !== "P") continue;
      if ([...el.querySelectorAll("*")].some((c) => c.tagName === "P" || BLOCK.has(getComputedStyle(c).display))) continue;
      const text = (el as HTMLElement).innerText.replace(/\s+/g, " ").trim();
      if (text.length > 240) longParagraphs.push(`${text.length}: ${text.slice(0, 80)}`);
    }

    const unnamed = [...document.querySelectorAll("button, a[href], [role=button], [role=tab]")]
      .filter(visible)
      .filter((b) => !(b.textContent ?? "").trim() && !b.getAttribute("aria-label") && !b.getAttribute("aria-labelledby") && !b.getAttribute("title"))
      .map((b) => b.outerHTML.slice(0, 120));

    return {
      h1,
      goldText,
      goldFill,
      longParagraphs,
      unnamed,
      overflow: Math.max(document.documentElement.scrollWidth - document.documentElement.clientWidth, main.scrollWidth - main.clientWidth),
    };
  }, GOLD_KIT_SOURCE);
  return { ...rest, nested };
}

for (const vp of VIEWPORTS) {
  test.describe(`coach workspace at ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.touch, isMobile: vp.touch });

    for (const state of ["seeded", "fresh"] as const) {
      for (const view of VIEWS) {
        test(`${view} · ${state}: one h1, ≤1 gold, no nesting, short paragraphs, named buttons`, async ({ page }) => {
          test.setTimeout(240_000);
          const pageErrors: string[] = [];
          page.on("pageerror", (e) => pageErrors.push(e.message));
          await boot(page, view, state);
          const m = await measure(page);

          expect(m.h1, "visible h1 count").toBe(1);
          expect(m.goldText.length, `gold by text colour: ${m.goldText.join(" | ")}`).toBeLessThanOrEqual(1);
          expect(m.goldFill, "gold by fill matches gold by text colour").toEqual(m.goldText);
          const heroAction = page.locator('[data-coach="primary-action"]');
          if (m.goldText.length === 1) await expect(heroAction).toHaveCount(1);
          else await expect(page.locator('[data-coach="no-action"]')).toBeVisible();
          expect(m.nested, "surfaces nested inside another surface (broad rule)").toEqual([]);
          expect(m.longParagraphs, "paragraphs over 240 characters").toEqual([]);
          expect(m.unnamed, "buttons without an accessible name").toEqual([]);
          expect(m.overflow, "sideways scroll").toBeLessThanOrEqual(1);

          if (state === "fresh") {
            /* No sample or invented clients on an empty account. */
            await expect(page.locator("main")).not.toContainText(/Anthony|Jasmine|Luis|Noah/);
            await expect(page.locator('[data-coach="sample-label"]')).toHaveCount(0);
          } else {
            await expect(page.locator('[data-coach="sample-label"]')).toBeVisible();
          }

          if (vp.touch) {
            const clear = await page.evaluate(async () => {
              const bar = document.querySelector('[data-coach="tab-bar"]');
              const main = document.querySelector("main")!;
              const screen = main.querySelector("[data-coach-screen]")!;
              main.scrollTo({ top: main.scrollHeight });
              await new Promise((r) => setTimeout(r, 400));
              const barTop = bar!.getBoundingClientRect().top;
              const kids = [...screen.children].filter((c) => c.getBoundingClientRect().height > 0);
              const bottom = Math.max(...kids.map((c) => c.getBoundingClientRect().bottom));
              return { ok: bottom <= barTop + 1, detail: `content bottom ${bottom} · tab bar top ${barTop}` };
            });
            expect(clear.ok, clear.detail).toBe(true);
          }
          expect(pageErrors.filter((e) => /Hydration/i.test(e)), "hydration errors").toEqual([]);
        });
      }
    }
  });
}

test.describe("coach sheets on a phone", () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });

  test("the composer's Save sits on top of the tab bar and an outside click keeps the draft", async ({ page }) => {
    test.setTimeout(240_000);
    await boot(page, "programs", "seeded");

    const cardSheet = page.locator('[data-coach="prescription"]').first();
    await cardSheet.getByRole("button", { name: /athlete view/i }).click();
    const preview = page.getByRole("dialog", { name: /athlete view/i });
    await expect(preview).toBeVisible();
    await expect(preview).toHaveAttribute("aria-modal", "true");
    const close = preview.getByRole("button", { name: "Close preview" });
    await settleAnimations(page);
    const closeHit = await close.evaluate((button) => {
      const r = button.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return Boolean(hit && button.contains(hit)) && r.bottom <= window.innerHeight;
    });
    expect(closeHit, "the preview's close button is on top and on screen").toBe(true);
    await close.click();
    await expect(preview).toHaveCount(0);

    /* Open a new draft: the plans sheet, then the composer. */
    const card = page.locator('[data-coach="prescription"]').first();
    const edit = card.getByRole("button", { name: "Edit draft" });
    if (await edit.count()) {
      await edit.click();
    } else {
      await page.locator('[data-coach="primary-action"] button').click();
      const picker = page.getByRole("dialog", { name: /new program/i });
      if (await picker.count()) await picker.getByRole("button", { name: "Open draft" }).click();
    }
    const composer = page.getByRole("dialog", { name: /program/i });
    await expect(composer).toBeVisible();
    await expect(composer).toHaveAttribute("aria-modal", "true");

    const title = composer.getByLabel("Title", { exact: true });
    await title.fill("Phone draft title");
    await composer.getByPlaceholder(/weekly average/i).fill("Checking the sheet on a phone");

    const save = composer.locator('[data-coach="composer-footer"]').getByRole("button", { name: /create draft|save draft/i });
    const saveHit = await save.evaluate((button) => {
      const r = button.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { onTop: Boolean(hit && button.contains(hit)), onScreen: r.bottom <= window.innerHeight && r.top >= 0 };
    });
    expect(saveHit.onTop, "Save is not covered").toBe(true);
    expect(saveHit.onScreen, "Save is on screen").toBe(true);
    await expect(page.locator('[data-coach="tab-bar"]')).toBeVisible();

    /* Outside click: the backdrop. A typed draft stays. */
    await page.mouse.click(187, 20);
    await expect(composer).toBeVisible();
    await expect(title).toHaveValue("Phone draft title");
  });
});
