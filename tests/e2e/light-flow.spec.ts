import { test, expect, type Page } from "@playwright/test";
import { asDesktopDevice } from "./support/device-profile";

/**
 * LIGHT FLOW — the room's own light, running in its architecture.
 *
 *   · the layer is behind every surface and takes no clicks
 *   · a room reads as STILL when it settles: nothing is drawn on arrival
 *   · reduced motion and the member's pause draw no layer at all
 *   · a live session and the member's own night silence it
 *   · a log fires exactly one answer, and never doubles the log moment's
 *     own light
 *   · a phone carries one seam, a wide desktop no more than three
 *
 * Seeding is the two-phase pattern of ambient-intelligence.spec.ts: the first
 * load lets the app write its own persisted state, then an init script applies
 * the patch before the app boots on reload.
 */

const KEY = "final-boss-athlete-settings";
/** Tuesday 15 September 2026, 4:12 PM local — a training day, in daylight. */
const DAY = new Date(2026, 8, 15, 16, 12, 0);
/** The same day at 21:30, which is night against a 22:30 sleep target. */
const NIGHT = new Date(2026, 8, 15, 21, 30, 0);

const DESKTOP = { width: 1280, height: 900 };
const PHONE = { width: 390, height: 844 };

type View = "dashboard" | "nutrition" | "recovery" | "training";
type Patch = (state: Record<string, unknown>) => void;

async function boot(page: Page, view: View, options: { when?: Date; patch?: Patch } = {}) {
  /* This spec describes the full composition, so it says which device it
     means rather than inheriting the runner's core count. */
  await asDesktopDevice(page);
  const when = options.when ?? DAY;
  await page.clock.setFixedTime(when);
  await page.addInitScript(
    ({ k, v }) => {
      window.localStorage.setItem("fba-preview-view", v);
      const raw = window.localStorage.getItem(k);
      const parsed = raw ? JSON.parse(raw) : { state: {}, version: 0 };
      parsed.state = {
        ...parsed.state,
        onboarding: {
          ...((parsed.state.onboarding as Record<string, unknown>) || {}),
          status: "complete",
          currentStep: 99,
          startedAt: "2026-09-01T12:00:00.000Z",
        },
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
    ({ k, v, live }) => {
      const parsed = JSON.parse(window.localStorage.getItem(k) as string);
      const s = parsed.state;
      s.activeView = v;
      s.scheduleProfile = { ...s.scheduleProfile, wakeTime: "06:30", sleepTarget: "22:30" };
      s.splitSystem = { ...(s.splitSystem || {}), key: "ppl-ul", source: "member", selectedAt: new Date().toISOString() };
      if (live) s.trainingSession = { ...(s.trainingSession || {}), sessionMode: "live" };
      return JSON.stringify(parsed);
    },
    { k: KEY, v: view, live: false },
  );
  await page.addInitScript(({ k, v }) => window.localStorage.setItem(k, v), { k: KEY, v: patched });
  if (options.patch) {
    await page.addInitScript(
      ({ k, source }) => {
        const parsed = JSON.parse(window.localStorage.getItem(k) as string);
        new Function("state", `(${source})(state)`)(parsed.state);
        window.localStorage.setItem(k, JSON.stringify(parsed));
      },
      { k: KEY, source: options.patch.toString() },
    );
  }
  await page.reload({ waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.locator("main h1").filter({ visible: true }).first().waitFor({ timeout: 120_000 });
  /* Hydrated: React has attached its props to the room's own statement. */
  await page.waitForFunction(
    () => {
      const el = document.querySelector("main h1");
      return Boolean(el && Object.keys(el).some((key) => key.startsWith("__reactProps")));
    },
    undefined,
    { timeout: 60_000 },
  );
}

/** Everything the light flow has drawn right now. */
const layerState = (page: Page) =>
  page.evaluate(() => ({
    reason: document.documentElement.dataset.lightFlow ?? null,
    layers: document.querySelectorAll('[data-light-flow="layer"]').length,
    seams: document.querySelectorAll("[data-light-flow-seam]").length,
    horizons: document.querySelectorAll('[data-light-flow-part="horizon"]').length,
    running: document
      .getAnimations()
      .filter((a) => {
        const name = (a as CSSAnimation).animationName;
        return typeof name === "string" && name.startsWith("fba-lf") && a.playState === "running";
      })
      .map((a) => (a as CSSAnimation).animationName),
  }));

/**
 * How long a room is watched to prove the layer stays away. Longer than the
 * settle, the layer's own retries and the first pass put together.
 */
const SILENCE_WATCH = 6_000;

/**
 * The layer reaches its live state on its own, from a room that has booted.
 *
 * Polled rather than slept through: the layer measures the room and can need
 * more than one look at it (a hero that arrives late, a box not yet laid
 * out), and a fixed wait turned that into a pass here and a failure on a
 * slower machine. Reaching "live" IS the assertion.
 */
async function waitForLive(page: Page) {
  await expect.poll(async () => (await layerState(page)).reason, { timeout: 20_000 }).toBe("live");
}

test.describe("the layer", () => {
  test.use({ viewport: DESKTOP });

  test("is behind every surface, takes no clicks, and is hidden from screen readers", async ({ page }) => {
    await boot(page, "recovery");
    await waitForLive(page);
    const layer = page.locator('[data-light-flow="layer"]');
    await expect(layer).toHaveCount(1);

    const geometry = await layer.evaluate((svg) => {
      const rect = svg.getBoundingClientRect();
      const room = svg.closest("[data-ambient-layer]") as HTMLElement | null;
      const content = document.querySelector("main") as HTMLElement;
      const zOf = (el: Element | null) => (el ? getComputedStyle(el).zIndex : null);
      return {
        pointerEvents: getComputedStyle(svg).pointerEvents,
        roomPointerEvents: room ? getComputedStyle(room).pointerEvents : null,
        inRoomLayer: Boolean(room),
        hidden: svg.getAttribute("aria-hidden"),
        roomZ: zOf(room),
        contentZ: zOf(content.closest(".relative") ?? content),
        /* What is actually under the middle of the layer? */
        hit: (() => {
          const el = document.elementFromPoint(rect.width / 2, rect.height / 2);
          return el ? el.closest('[data-light-flow="layer"]') !== null : false;
        })(),
      };
    });

    expect(geometry.inRoomLayer, "the layer lives inside the one room layer").toBe(true);
    expect(geometry.roomPointerEvents).toBe("none");
    expect(geometry.hidden).toBe("true");
    expect(geometry.hit, "nothing is ever hit-tested onto the light layer").toBe(false);
    /* The content stack sits above the room layer, which has no stacking order. */
    expect(geometry.contentZ).toBe("10");

    /* And the room still works: its own primary action is clickable. */
    const action = page.locator("main button").filter({ visible: true }).first();
    await expect(action).toBeVisible();
    const clickable = await action.evaluate((button) => {
      const box = button.getBoundingClientRect();
      const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      return Boolean(hit && button.contains(hit));
    });
    expect(clickable).toBe(true);
  });

  test("draws nothing at all while the screen is settling", async ({ page }) => {
    await boot(page, "dashboard");
    /* The first settled frame: the room has painted, and the layer has not. */
    const arrival = await layerState(page);
    expect(arrival.layers, "no light layer on arrival").toBe(0);
    expect(arrival.seams).toBe(0);
    expect(arrival.running, "nothing of the layer is animating on arrival").toEqual([]);
    expect(arrival.reason === null || arrival.reason === "settling").toBe(true);

    /* …and it arrives later, on its own. */
    await waitForLive(page);
    await expect.poll(async () => (await layerState(page)).layers).toBe(1);
  });

  test("lights the horizon and at most three seams on a wide desktop", async ({ page }) => {
    await boot(page, "dashboard");
    await waitForLive(page);
    const state = await layerState(page);
    expect(state.horizons).toBe(1);
    expect(state.seams).toBeGreaterThan(0);
    expect(state.seams, "density cap at 1280").toBeLessThanOrEqual(3);
  });
});

test.describe("room changes", () => {
  test.use({ viewport: DESKTOP });

  test("keeps every ambient child's identity: no duplicate keys, and the light re-settles in the new room", async ({ page }) => {
    /* The light layer is keyed by room so a new room starts its own settle.
       It is a SIBLING of the room wash, which is keyed by the bare room too:
       sharing that key once left React free to keep the old room's wash —
       and the loops inside it — mounted after the member had left. */
    const duplicateKeys: string[] = [];
    page.on("console", (message) => {
      if (/same key/i.test(message.text())) duplicateKeys.push(message.text().slice(0, 160));
    });

    await boot(page, "dashboard");
    await waitForLive(page);
    await page.getByRole("button", { name: "Personal Command", exact: true }).first().click();
    await expect(page.locator("main h1").filter({ visible: true }).first()).not.toHaveText(/execute|discipline/i, { timeout: 30_000 });

    /* The new room settles and lights on its own… */
    await waitForLive(page);
    await expect(page.locator('[data-light-flow="layer"]')).toHaveCount(1);
    /* …and nothing in the ambient layer ever shared a key with a sibling. */
    expect(duplicateKeys, "siblings in the room layer must never share a key").toEqual([]);
  });
});

test.describe("density", () => {
  test.use({ viewport: PHONE, hasTouch: true, isMobile: true });

  test("a phone carries exactly one seam", async ({ page }) => {
    await boot(page, "dashboard");
    await waitForLive(page);
    const state = await layerState(page);
    expect(state.seams, "density cap at 390").toBe(1);
    expect(state.horizons).toBe(1);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, "the layer never widens the page").toBeLessThanOrEqual(1);
  });
});

test.describe("silence", () => {
  test.use({ viewport: DESKTOP });

  test("reduced motion draws no layer and runs nothing", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await boot(page, "dashboard");
    await page.waitForTimeout(SILENCE_WATCH);
    const state = await layerState(page);
    expect(state.reason).toBe("reduced");
    expect(state.layers).toBe(0);
    expect(state.seams).toBe(0);
    expect(state.horizons).toBe(0);
    expect(state.running).toEqual([]);
  });

  test("the member's pause draws no layer and runs nothing", async ({ page }) => {
    await boot(page, "dashboard");
    await waitForLive(page);
    await expect.poll(async () => (await layerState(page)).layers).toBe(1);

    const pause = page.getByRole("button", { name: "Pause background motion" });
    await expect(pause).toBeVisible({ timeout: 30_000 });
    await pause.click();
    await expect(page.getByRole("button", { name: "Play background motion" })).toBeVisible();

    await expect.poll(async () => (await layerState(page)).reason).toBe("paused");
    const state = await layerState(page);
    expect(state.layers).toBe(0);
    expect(state.seams).toBe(0);
    expect(state.running).toEqual([]);
  });

  test("the member's own night is dark", async ({ page }) => {
    await boot(page, "recovery", { when: NIGHT });
    await page.waitForTimeout(SILENCE_WATCH);
    const state = await layerState(page);
    expect(state.reason).toBe("night");
    expect(state.layers).toBe(0);
    expect(state.running).toEqual([]);
  });

  test("a live session stills the room outright", async ({ page }) => {
    await boot(page, "training", {
      patch: (state) => {
        const session = (state.trainingSession as Record<string, unknown>) || {};
        state.trainingSession = { ...session, sessionMode: "live" };
      },
    });
    await page.waitForTimeout(SILENCE_WATCH);
    const state = await layerState(page);
    expect(state.reason, "a live session outranks everything but the member's own settings").toBe("live-session");
    expect(state.layers).toBe(0);
    expect(state.seams).toBe(0);
    expect(state.running).toEqual([]);
  });
});

test.describe("the surge", () => {
  test.use({ viewport: DESKTOP });

  test("a log fires exactly one answer, and never doubles the log moment", async ({ page }) => {
    await boot(page, "nutrition");
    await waitForLive(page);
    await expect(page.locator('[data-light-flow="surge"]')).toHaveCount(0);

    /* Watch for the whole life of both answers: the room's own surge, and
       the log moment's light. Neither may run a traveller while the other does. */
    await page.evaluate(() => {
      const w = window as unknown as { __lf: { surges: number; maxSurges: number; overlap: number } };
      w.__lf = { surges: 0, maxSurges: 0, overlap: 0 };
      const seen = new Set<Element>();
      const tick = () => {
        const surges = document.querySelectorAll('[data-light-flow="surge"]');
        for (const node of surges) {
          if (!seen.has(node)) {
            seen.add(node);
            w.__lf.surges += 1;
          }
        }
        w.__lf.maxSurges = Math.max(w.__lf.maxSurges, surges.length);
        const momentLight = document.querySelectorAll('[data-log-moment="canvas"], [data-meal-moment="canvas"]').length;
        const ourTraveller = document.querySelectorAll('[data-light-flow-part="traveller"]').length;
        if (momentLight > 0 && ourTraveller > 0) w.__lf.overlap += 1;
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });

    await page.getByRole("button", { name: /log 16 oz water/i }).filter({ visible: true }).first().click();

    /* The room answers. */
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __lf: { surges: number } }).__lf.surges), { timeout: 6_000 })
      .toBeGreaterThan(0);
    /* Let the moment and the answer both finish. */
    await page.waitForTimeout(4_000);

    const record = await page.evaluate(() => (window as unknown as { __lf: { surges: number; maxSurges: number; overlap: number } }).__lf);
    expect(record.surges, "one log, one answer").toBe(1);
    expect(record.maxSurges, "answers never stack").toBe(1);
    expect(record.overlap, "the room never runs a light across the log moment's own").toBe(0);

    /* And the answer takes itself down. */
    await expect(page.locator('[data-light-flow="surge"]')).toHaveCount(0, { timeout: 4_000 });
  });

  test("a log at night is answered in words alone", async ({ page }) => {
    await boot(page, "nutrition", { when: NIGHT });
    await page.waitForTimeout(SILENCE_WATCH);
    expect((await layerState(page)).reason).toBe("night");

    await page.getByRole("button", { name: /log 16 oz water/i }).filter({ visible: true }).first().click();
    /* The moment still announces it; the room draws nothing. */
    await expect(page.locator('[data-log-moment="announcer"]')).toContainText(/logged/i, { timeout: 5_000 });
    await page.waitForTimeout(1_500);
    await expect(page.locator('[data-light-flow="surge"]')).toHaveCount(0);
  });
});
