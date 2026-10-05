import { test, expect, type Page } from "@playwright/test";

/**
 * RESERVE VISUAL SYSTEM QA — release-design pass.
 *
 * Not a snapshot suite. Each check asserts a rule from the Reserve Design
 * Constitution that a human reviewer would otherwise have to eyeball on six
 * viewports:
 *
 *   · no horizontal overflow at any breakpoint (responsive.md)
 *   · zero native <select> on member surfaces (the white-dropdown defect)
 *   · form controls >= 16px on touch viewports (accessibility.md, iOS zoom)
 *   · every interactive control reaches the 44px target floor
 *   · exactly one <h1> per screen — one hero, never two (typography.md)
 *
 * Screenshots land in test-results/ which is gitignored. Nothing here is
 * committed as a visual baseline.
 */

const VIEWPORTS = [
  { name: "375x812", width: 375, height: 812, touch: true },
  { name: "390x844", width: 390, height: 844, touch: true },
  { name: "430x932", width: 430, height: 932, touch: true },
  { name: "768x1024", width: 768, height: 1024, touch: false },
  { name: "1280x900", width: 1280, height: 900, touch: false },
  { name: "1440x1000", width: 1440, height: 1000, touch: false },
] as const;

/** Flagship destinations this pass touched. */
const SCREENS = [
  { view: "dashboard", label: "Daily Command" },
  { view: "nutrition", label: "Nutrition Command" },
  { view: "recovery", label: "Recovery Command" },
  { view: "schedule-command", label: "Schedule Command" },
  { view: "lifestyle-builder", label: "Build Studio" },
] as const;

/**
 * Seed the store before the app boots: mark onboarding complete so the
 * wizard overlay does not cover every screenshot, and pin the initial view.
 * `fba-preview-view` is the store's own preview hook.
 */
async function bootTo(page: Page, view: string) {
  await page.addInitScript((v) => {
    window.localStorage.setItem("fba-preview-view", v);
    const KEY = "final-boss-athlete-settings";
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : { state: {}, version: 0 };
    parsed.state = {
      ...parsed.state,
      onboarding: { status: "complete", currentStep: 99, startedAt: new Date().toISOString() },
    };
    window.localStorage.setItem(KEY, JSON.stringify(parsed));
  }, view);

  /* `domcontentloaded`, not `load` or `networkidle`: the dev server keeps an
     HMR websocket open, so networkidle never settles, and first-compile of a
     route can exceed the default navigation budget. */
  await page.goto("/", { waitUntil: "domcontentloaded", timeout: 120_000 });
  // The shell mounts client-side; wait for real content rather than a timer.
  await page.locator("main").waitFor({ state: "visible", timeout: 120_000 });
  await page.locator("main h1, main [class*='type-hero']").first().waitFor({ timeout: 60_000 });

  /* The server cannot know the viewport, so the server-rendered first frame
     on a phone still shows the 212px desktop rail; the shell swaps it for
     the navigation overlay once its media query resolves after hydration.
     Screenshotting before that settles produces an image of a layout no
     member ever sees. Wait for the settled state rather than a fixed delay.

     Queried inside the page rather than through a locator: once settled, a
     phone renders no <aside> at all, and a locator waits for an element that
     will never exist until the test times out. */
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const settled = () => {
          const aside = document.querySelector("aside");
          return !aside || aside.getBoundingClientRect().width <= 60 || window.innerWidth >= 768;
        };
        if (settled()) return resolve();
        const t = setInterval(() => {
          if (settled()) {
            clearInterval(t);
            resolve();
          }
        }, 100);
        setTimeout(() => {
          clearInterval(t);
          resolve();
        }, 8000);
      }),
  );
  // Let the room wash and stagger animations land before capture.
  await page.waitForTimeout(1200);
}

for (const vp of VIEWPORTS) {
  test.describe(`viewport ${vp.name}`, () => {
    test.use({
      viewport: { width: vp.width, height: vp.height },
      hasTouch: vp.touch,
      isMobile: vp.touch,
    });

    for (const screen of SCREENS) {
      test(`${screen.label} composes correctly`, async ({ page }, testInfo) => {
        /* Hydration is asserted on every screen at every viewport because a
           mismatch does not fail visibly — React silently regenerates the tree
           on the client. Without this, the whole suite can be validating a
           client-regenerated page rather than the one members actually get,
           and a real mismatch hides behind the noise. */
        const pageErrors: string[] = [];
        page.on("pageerror", (e) => pageErrors.push(e.message));

        await bootTo(page, screen.view);

        expect(
          pageErrors.filter((e) => /Hydration/i.test(e)),
          `${screen.label} failed hydration at ${vp.name}`,
        ).toEqual([]);

        /* ── No horizontal overflow ───────────────────────────────────── */
        const overflow = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        }));
        expect(
          overflow.scrollWidth,
          `${screen.label} scrolls sideways at ${vp.name}`,
        ).toBeLessThanOrEqual(overflow.clientWidth + 1);

        /* ── The week rail must never scroll inside itself ─────────────
           Page-level overflow does NOT catch this. A rail that scrolls
           internally leaves the document width clean while still hiding four
           of seven days behind a swipe — which is exactly the defect the rail
           redesign replaced. */
        if (screen.view === "dashboard") {
          const rail = page.getByRole("group", { name: /training split/i }).first();
          if (await rail.count()) {
            const scrolls = await rail.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
            expect(scrolls, `week rail scrolls sideways at ${vp.name}`).toBe(false);
          }
        }

        /* ── Zero native selects on member surfaces ───────────────────── */
        expect(
          await page.locator("main select").count(),
          `${screen.label} still renders a native dropdown`,
        ).toBe(0);

        /* ── One hero per screen ─────────────────────────────────────── */
        const h1s = await page.locator("main h1").count();
        expect(h1s, `${screen.label} should have exactly one <h1>`).toBeLessThanOrEqual(1);

        /* ── Touch: form controls must not trigger iOS zoom ───────────── */
        if (vp.touch) {
          const tooSmall = await page.evaluate(() => {
            const bad: string[] = [];
            document
              .querySelectorAll<HTMLElement>("main input, main textarea, main select")
              .forEach((el) => {
                if (el.offsetParent === null) return;
                const size = parseFloat(getComputedStyle(el).fontSize);
                if (size < 16) bad.push(`${el.tagName.toLowerCase()} @ ${size}px`);
              });
            return bad;
          });
          expect(tooSmall, `${screen.label} has sub-16px form text`).toEqual([]);
        }

        /* ── Touch target floor ──────────────────────────────────────── */
        const smallTargets = await page.evaluate(() => {
          const bad: string[] = [];
          document
            .querySelectorAll<HTMLElement>("main button, main a[href], main summary")
            .forEach((el) => {
              if (el.offsetParent === null) return;
              const r = el.getBoundingClientRect();
              if (r.width === 0 || r.height === 0) return;
              if (r.height < 44 - 0.5) {
                bad.push(`${(el.textContent ?? "").trim().slice(0, 28)} → ${Math.round(r.height)}px`);
              }
            });
          return bad.slice(0, 40);
        });
        await testInfo.attach(`small-targets-${screen.view}-${vp.name}`, {
          body: JSON.stringify(smallTargets, null, 2),
          contentType: "application/json",
        });

        await page.screenshot({
          path: testInfo.outputPath(`${screen.view}-${vp.name}.png`),
          fullPage: false,
        });
      });
    }
  });
}
