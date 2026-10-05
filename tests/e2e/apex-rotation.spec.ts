import { test, expect, type Page } from "@playwright/test";

/**
 * APEX ROTATION — the command room opens onto the earth and the cosmos.
 *
 *   · the room holds, then an earth clip fades in over it and plays at the
 *     room's calm rate, then hands off to a cosmic still
 *   · the ambient pause and reduced motion keep Apex on its room: no layer,
 *     no library request
 *   · other rooms never mount it
 *
 * Screenshots are written only when ROTATION_SHOTS names a directory.
 */

const KEY = "final-boss-athlete-settings";
/** 4:12 PM — day, so the room's own loop is allowed to play. */
const WHEN = new Date(2026, 8, 15, 16, 12, 0);
/** Screenshots are written only when ROTATION_SHOTS names a directory. */
const SHOTS = process.env.ROTATION_SHOTS;

async function boot(page: Page, view: string, paused = false) {
  await page.clock.install({ time: WHEN });
  await page.addInitScript(
    ({ k, v, p }) => {
      window.localStorage.setItem("fba-preview-view", v);
      window.localStorage.setItem("fba-ambient-motion", JSON.stringify({ state: { paused: p }, version: 0 }));
      const raw = window.localStorage.getItem(k);
      const parsed = raw ? JSON.parse(raw) : { state: {}, version: 0 };
      parsed.state = {
        ...parsed.state,
        activeView: v,
        onboarding: { ...(parsed.state.onboarding || {}), status: "complete", currentStep: 99, startedAt: "2026-09-01T12:00:00.000Z" },
      };
      window.localStorage.setItem(k, JSON.stringify(parsed));
    },
    { k: KEY, v: view, p: paused },
  );
  await page.goto("/", { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.locator("main h1").first().waitFor({ timeout: 120_000 });
}

const libraryRequests = (page: Page) => {
  const urls: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/brand/library/") || /\/brand\/loops\/(salt-flat|cloud-inversion|ice-cave|river-delta)/.test(r.url())) urls.push(r.url());
  });
  return urls;
};

test.describe("apex rotation at 1280", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("the room holds, an earth clip plays, then a cosmic still takes over", async ({ page }) => {
    test.setTimeout(240_000);
    await boot(page, "dashboard");
    const rotation = page.locator("[data-apex-rotation]");
    await expect(rotation).toHaveAttribute("data-apex-rotation", "room", { timeout: 30_000 });

    await page.clock.fastForward(31_000);
    await expect(rotation).toHaveAttribute("data-apex-rotation", "salt-flat-mirror", { timeout: 10_000 });
    const clip = page.locator('[data-rotation-item="salt-flat-mirror"] video');
    await expect.poll(() => clip.evaluate((v: HTMLVideoElement) => !v.paused && v.readyState >= 2), { timeout: 30_000 }).toBe(true);
    expect(await clip.evaluate((v: HTMLVideoElement) => ({ muted: v.muted, rate: v.playbackRate, loop: v.loop }))).toEqual({
      muted: true,
      rate: 0.6,
      loop: false,
    });
    await expect(page.locator('[data-rotation-item="salt-flat-mirror"]')).toHaveCSS("opacity", "1", { timeout: 10_000 });
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/apex-rotation-clip.png` });

    /* The clip hands off near its end (≈8.4s on screen); the cap backs it up. */
    await page.clock.fastForward(12_500);
    await expect(rotation).toHaveAttribute("data-apex-rotation", "black-hole-disc", { timeout: 20_000 });
    const still = page.locator('[data-rotation-item="black-hole-disc"] img');
    await expect.poll(() => still.evaluate((img: HTMLImageElement) => img.naturalWidth), { timeout: 20_000 }).toBeGreaterThan(0);
    if (SHOTS) {
      await expect(page.locator('[data-rotation-item="black-hole-disc"]')).toHaveCSS("opacity", "1", { timeout: 10_000 });
      /* Let the outgoing clip finish fading. */
      await page.waitForTimeout(3_500);
      await page.screenshot({ path: `${SHOTS}/apex-rotation-still.png` });
    }
  });

  test("the ambient pause keeps Apex on its room, with no library request", async ({ page }) => {
    test.setTimeout(240_000);
    const requests = libraryRequests(page);
    await boot(page, "dashboard", true);
    await page.clock.fastForward(40_000);
    await expect(page.locator("[data-apex-rotation]")).toHaveCount(0);
    expect(requests).toEqual([]);
  });

  test("reduced motion keeps Apex on its room", async ({ page }) => {
    test.setTimeout(240_000);
    await page.emulateMedia({ reducedMotion: "reduce" });
    const requests = libraryRequests(page);
    await boot(page, "dashboard");
    await page.clock.fastForward(40_000);
    await expect(page.locator("[data-apex-rotation]")).toHaveCount(0);
    expect(requests).toEqual([]);
  });

  test("another room never mounts it", async ({ page }) => {
    test.setTimeout(240_000);
    await boot(page, "training");
    await page.clock.fastForward(40_000);
    await expect(page.locator("[data-apex-rotation]")).toHaveCount(0);
  });
});
