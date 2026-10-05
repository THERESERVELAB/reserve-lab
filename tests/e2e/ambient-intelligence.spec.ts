import { test, expect, type Page } from "@playwright/test";
import { asDesktopDevice } from "./support/device-profile";
import { sawTransient, watchForTransient } from "./support/transient";

/**
 * AMBIENT INTELLIGENCE — the shell is awake and answers the member.
 *
 *   · logging water runs the signal trace and announces "Water logged"
 *   · reduced motion: nothing on the ambient layer is running
 *   · the existing pause control makes the ambient layer static
 *   · systems online plays on the first Apex open of a session, not on a
 *     reload inside that session
 *   · the gold action is clickable the moment it is interactive
 *   · no sideways scroll at 375
 *
 * Seeding is the two-phase pattern of hardass-prep.spec.ts: the first load
 * lets the app write its own persisted state, then an init script applies
 * the patch before the app boots on reload.
 */

const KEY = "final-boss-athlete-settings";
/** Tuesday 15 September 2026, 4:12 PM local — a training day. */
const WHEN = new Date(2026, 8, 15, 16, 12, 0);

type SoRecord = {
  marked: boolean;
  animated: boolean;
  minStatementOpacity: number;
  goldSeenMs: number | null;
  goldHitAtSight: boolean | null;
  goldDuringSettle: boolean | null;
};

const DESKTOP = { width: 1440, height: 1000 };
const PHONE = { width: 375, height: 812 };

async function boot(page: Page, view: "dashboard" | "nutrition") {
  /* This spec describes the full composition, so it says which device it
     means rather than inheriting the runner's core count. */
  await asDesktopDevice(page);
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
      return Boolean(state?.recoveryCommand && state?.nutritionPrefs && state?.scheduleProfile && state?.setupProfile);
    },
    KEY,
    { timeout: 30_000 },
  );

  const patched = await page.evaluate(
    ({ k, iso, v }) => {
      const now = new Date(iso);
      const localKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const stamp = now.toISOString();
      const parsed = JSON.parse(window.localStorage.getItem(k) as string);
      const s = parsed.state;
      s.activeView = v;
      s.recoveryCommand = { ...s.recoveryCommand, hydrationTargetOz: 120, hydrationLogs: [] };
      s.nutritionPrefs = { ...s.nutritionPrefs, loggedMealIds: [], latestMealLog: null, nutritionLogDate: localKey };
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
      return JSON.stringify(parsed);
    },
    { k: KEY, iso: WHEN.toISOString(), v: view },
  );
  await page.addInitScript(({ k, v }) => window.localStorage.setItem(k, v), { k: KEY, v: patched });
  await page.reload({ waitUntil: "domcontentloaded", timeout: 120_000 });
  await waitForView(page, view);
}

async function waitForView(page: Page, view: "dashboard" | "nutrition") {
  if (view === "dashboard") {
    await expect(page.locator('[data-apex="next-move-title"]').filter({ visible: true }).first()).toBeVisible({ timeout: 60_000 });
  } else {
    await expect(page.locator('[data-nutrition="primary-action"] button').filter({ visible: true }).first()).toBeVisible({ timeout: 60_000 });
  }
  /* Hydrated: React has attached its props to the room's statement. */
  await page.waitForFunction(
    () => {
      const el = document.querySelector("[data-room-statement]");
      return Boolean(el && Object.keys(el).some((key) => key.startsWith("__reactProps")));
    },
    undefined,
    { timeout: 60_000 },
  );
}

/** Running animations on the ambient layer: the room and every glass edge light. */
const runningAmbientAnimations = (page: Page) =>
  page.evaluate(() =>
    document
      .getAnimations()
      .filter((animation) => {
        const target = (animation.effect as KeyframeEffect | null)?.target as Element | null;
        if (!target || animation.playState !== "running") return false;
        return Boolean(target.closest("[data-ambient-layer]") || target.classList.contains("fba-edge-light"));
      })
      .map((animation) => (animation as CSSAnimation).animationName ?? "animation"),
  );

test.describe("signal received", () => {
  for (const vp of [
    { name: "desktop", viewport: DESKTOP, touch: false },
    { name: "375", viewport: PHONE, touch: true },
  ] as const) {
    test.describe(`at ${vp.name}`, () => {
      test.use({ viewport: vp.viewport, hasTouch: vp.touch, isMobile: vp.touch });

      test("logging water runs the trace, lights the room and announces it", async ({ page }) => {
        await boot(page, "nutrition");
        const announcer = page.locator('[data-signal="announcer"]');
        await expect(announcer).toHaveText("");
        /* Nothing fired on load, hydration or rehydration. */
        await expect(page.locator('[data-signal="trace"]')).toHaveCount(0);

        /* The trace lives 650ms and the glow 900ms by design. Polling for them
           after the click asks "are they still running", which on a loaded
           runner they are not — they had already been and gone. Recorded from
           before the click instead, so the assertion keeps its meaning. */
        const traceSelector = vp.name === "desktop"
          ? '[data-signal="trace"]'
          : '[data-shell="tab-bar"] [data-signal="trace"]';
        await watchForTransient(page, [traceSelector, '[data-signal="glow"]']);

        await page.getByRole("button", { name: /log 16 oz water/i }).filter({ visible: true }).first().click();

        await expect
          .poll(() => sawTransient(page, traceSelector), { timeout: 10_000, message: "the trace ran" })
          .toBe(true);
        await expect
          .poll(() => sawTransient(page, '[data-signal="glow"]'), { timeout: 10_000, message: "the room lit" })
          .toBe(true);
        /* The log moment announces the log itself (one polite region), so the
           shell's one-word line stays quiet instead of saying it twice. */
        const moment = page.locator('[data-log-moment="announcer"]');
        await expect(moment).toContainText("Water logged");
        await expect(moment).toHaveAttribute("aria-live", "polite");
        await expect(announcer).toHaveText("");

        /* The trace is a single 600ms pass, not a state. */
        await expect(page.locator('[data-signal="trace"]')).toHaveCount(0, { timeout: 10_000 });

        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, `sideways scroll at ${vp.name}`).toBeLessThanOrEqual(1);
      });
    });
  }
});

test.describe("motion gate", () => {
  test.use({ viewport: DESKTOP });

  test("full motion: the awake light runs on the ambient layer", async ({ page }) => {
    await boot(page, "dashboard");
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.ambient)).toBe("live");
    await expect.poll(async () => (await runningAmbientAnimations(page)).includes("fba-room-breath")).toBe(true);
  });

  test("reduced motion: nothing on the ambient layer is running", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await boot(page, "dashboard");
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.ambient)).toBe("reduced");
    /* One-shot entrances (a clock-bound plate's rise) end within a frame under
       the global kill block; nothing may keep running after that. */
    await expect.poll(() => runningAmbientAnimations(page), { timeout: 3_000 }).toEqual([]);
    await page.waitForTimeout(500);
    expect(await runningAmbientAnimations(page)).toEqual([]);
    /* And systems online never plays. */
    expect(await page.evaluate(() => document.documentElement.getAttribute("data-systems-online"))).toBeNull();
  });

  test("pausing from the top bar makes the ambient layer static", async ({ page }) => {
    await boot(page, "dashboard");
    await page.evaluate(() => {
      try {
        window.localStorage.removeItem("fba-ambient-motion");
      } catch {
        /* storage blocked: the default is unpaused anyway */
      }
    });
    const pause = page.getByRole("button", { name: "Pause background motion" });
    await expect(pause).toBeVisible({ timeout: 30_000 });
    await pause.click();

    await expect(page.getByRole("button", { name: "Play background motion" })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.ambient)).toBe("static");
    await expect.poll(() => runningAmbientAnimations(page), { timeout: 3_000 }).toEqual([]);
    await page.waitForTimeout(500);
    expect(await runningAmbientAnimations(page)).toEqual([]);
  });
});

test.describe("systems online", () => {
  test.use({ viewport: DESKTOP });

  test("plays once per session, never on a reload inside it, and never delays the gold action", async ({ page }) => {
    await boot(page, "dashboard");

    /* A recorder from the first moment of every load: did the settle mark
       appear, did the settle animation run, and was the statement ever hidden? */
    await page.addInitScript(() => {
      const w = window as unknown as { __so: SoRecord };
      w.__so = { marked: false, animated: false, minStatementOpacity: 1, goldSeenMs: null, goldHitAtSight: null, goldDuringSettle: null };
      /* The gold action, on the first frame it is painted: is it the element
         under its own centre, with pointer events, while the settle runs? */
      const watchGold = () => {
        const button = [...document.querySelectorAll<HTMLElement>(".fba-so-action button")].find(
          (candidate) => candidate.getBoundingClientRect().width > 0,
        );
        if (!button) {
          requestAnimationFrame(watchGold);
          return;
        }
        const box = button.getBoundingClientRect();
        const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
        w.__so.goldSeenMs = performance.now();
        w.__so.goldDuringSettle = document.documentElement.getAttribute("data-systems-online") === "play";
        w.__so.goldHitAtSight = Boolean(hit && button.contains(hit)) && getComputedStyle(button).pointerEvents !== "none";
      };
      requestAnimationFrame(watchGold);
      /* Event-driven, not timers: the page clock is faked. */
      document.addEventListener(
        "animationstart",
        (event) => {
          if (!/^fba-so-/.test(event.animationName)) return;
          w.__so.animated = true;
          if (document.documentElement.getAttribute("data-systems-online") === "play") w.__so.marked = true;
          const statement = document.querySelector("[data-room-statement]");
          if (statement) w.__so.minStatementOpacity = Math.min(w.__so.minStatementOpacity, Number(getComputedStyle(statement).opacity));
        },
        true,
      );
    });
    const recorded = () => page.evaluate(() => (window as unknown as { __so: SoRecord }).__so);

    /* A fresh browser session. */
    /* Let the boot's own load finish its settle before starting a new session. */
    await expect
      .poll(() => page.evaluate(() => document.documentElement.getAttribute("data-systems-online")), { timeout: 5_000 })
      .toBeNull();
    await page.evaluate(() => window.sessionStorage.clear());
    await page.reload({ waitUntil: "commit", timeout: 120_000 });
    await expect.poll(async () => (await recorded()).animated, { timeout: 60_000, intervals: [25] }).toBe(true);
    expect((await recorded()).marked).toBe(true);
    await waitForView(page, "dashboard");

    /* The LCP-candidate statement is never hidden at load. */
    expect((await recorded()).minStatementOpacity).toBeGreaterThan(0.9);

    /* The gold action is hit-testable on the very frame it is first painted —
       the settle never covers it or switches off its pointer events… */
    const sight = await recorded();
    expect(sight.goldSeenMs, "the gold action was painted").not.toBeNull();
    expect(sight.goldDuringSettle, "the gold action was first painted while the settle played").toBe(true);
    expect(sight.goldHitAtSight, "the gold action takes a click from its first frame").toBe(true);

    /* …and on the first frame React is attached, a real click reaches it: no
       stability wait, no settle to sit out. (Input latency itself is not
       asserted: in dev it is dominated by hydration work, ~120–210ms measured
       with and without the settle alike.) */
    const ready = await page.waitForFunction(
      () => {
        const button = [...document.querySelectorAll<HTMLElement>(".fba-so-action button")].find(
          (candidate) => candidate.getBoundingClientRect().width > 0,
        );
        if (!button || !Object.keys(button).some((key) => key.startsWith("__reactProps"))) return null;
        const box = button.getBoundingClientRect();
        button.addEventListener("click", () => ((window as unknown as { __goldClicked: boolean }).__goldClicked = true), { once: true });
        return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
      },
      undefined,
      { timeout: 60_000, polling: "raf" },
    );
    const target = (await ready.jsonValue()) as { x: number; y: number };
    await page.mouse.click(target.x, target.y);
    expect(
      await page.evaluate(() => Boolean((window as unknown as { __goldClicked?: boolean }).__goldClicked)),
      "the click reached the gold action",
    ).toBe(true);

    /* Played: the mark clears after the settle… */
    await expect.poll(() => page.evaluate(() => document.documentElement.getAttribute("data-systems-online")), { timeout: 5_000 }).toBeNull();
    expect(await page.evaluate(() => window.sessionStorage.getItem("fba-systems-online"))).toBe("1");

    /* …and a reload inside the same session never plays it again. */
    await page.reload({ waitUntil: "domcontentloaded", timeout: 120_000 });
    await waitForView(page, "dashboard");
    await page.waitForTimeout(1_200);
    expect(await recorded()).toMatchObject({ marked: false, animated: false });
  });
});
