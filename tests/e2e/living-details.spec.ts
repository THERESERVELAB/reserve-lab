import { test, expect, type Page } from "@playwright/test";

import { SAFETY_ACK_VERSION } from "../../src/lib/safety/acknowledgement";
import { BORDERED_PANEL_RULE, nestedSurfaces } from "./support/surface-nesting";
import { goldActions as findGoldActions } from "./support/gold-action";
import { asDesktopDevice } from "./support/device-profile";

/**
 * LIVING DETAILS — the rooms' detail images, one band per section.
 *
 *   · at 1280×900 and 375×812 touch, every wired room shows its detail
 *     image(s), decoded (naturalWidth > 0)
 *   · a phone (< 768px) is served the 4:5 crop; a desktop never is
 *   · no bordered rounded panel nested in another, exactly one gold action
 *     per room, no sideways scroll at 375
 *   · prefers-reduced-motion: no running animation on any band, band visible
 *   · the member's ambient pause: nothing runs, band visible
 *   · Hardass Prep swaps prep-journal → dawn-gym when the member is on a cycle
 *   · room loops (Training, Recovery, Nutrition, Schedule): at 1280 each mounts
 *     and plays its own muted inline loop, carried over its wrap by a second
 *     layer of the same clip (tests/e2e/loop-crossfade.spec.ts measures it);
 *     at 375 all five rooms (Apex too) mount their 9:16 loop after the plate
 *     paints; Save-Data, 3G, reduced motion, the ambient pause and the night
 *     plate keep the still; document scroll never moves the fixed layer
 *
 * Seeding is the two-phase pattern the room specs use (hardass-prep.spec.ts).
 * Screenshots of every band are written only when LIVING_SHOTS names a directory.
 */

const KEY = "final-boss-athlete-settings";
/** Tuesday 15 September 2026, 4:12 PM local — a training day. */
const WHEN = new Date(2026, 8, 15, 16, 12, 0);
const SHOTS = process.env.LIVING_SHOTS;

type Room = { name: string; view: string; ready: string; images: string[] };

const ROOMS: Room[] = [
  { name: "Apex", view: "dashboard", ready: '[data-apex="next-move-title"]', images: ["prep-journal"] },
  { name: "Training", view: "training", ready: '[data-training="hero"]', images: ["strength-floor"] },
  { name: "Nutrition", view: "nutrition", ready: '[data-nutrition="hero"]', images: ["fuel-prep"] },
  { name: "Recovery", view: "recovery", ready: '[data-recovery="hero"]', /* The plunge band folded behind "Recovery detail" (owner direction 2026-09-19). */ images: ["sleep-suite", "hydration-bar"] },
  /* No detail image until the owner's replacement arrives; its loop tests stay. */
  { name: "Schedule", view: "schedule-command", ready: '[data-schedule="hero"]', images: [] },
  { name: "Physique", view: "physique", ready: '[data-record="physique"]', images: ["posing-room"] },
];

const VIEWPORTS = [
  { name: "1280", width: 1280, height: 900, touch: false },
  { name: "375", width: 375, height: 812, touch: true },
] as const;

const NOT_OURS = ['[data-testid$="-response-context"]', '[data-testid$="-response-context"] *'].join(", ");

type Seed = { enhanced?: boolean; paused?: boolean; when?: Date };

async function boot(page: Page, room: Room, seed: Seed = {}) {
  /* This spec describes the full composition, so it says which device it
     means rather than inheriting the runner's core count. */
  await asDesktopDevice(page);
  await page.clock.setFixedTime(seed.when ?? WHEN);
  await page.addInitScript(
    ({ k, v, paused }) => {
      window.localStorage.setItem("fba-preview-view", v);
      window.localStorage.setItem("fba-ambient-motion", JSON.stringify({ state: { paused }, version: 0 }));
      const raw = window.localStorage.getItem(k);
      const parsed = raw ? JSON.parse(raw) : { state: {}, version: 0 };
      parsed.state = {
        ...parsed.state,
        onboarding: { ...(parsed.state.onboarding || {}), status: "complete", currentStep: 99, startedAt: "2026-09-01T12:00:00.000Z" },
      };
      window.localStorage.setItem(k, JSON.stringify(parsed));
    },
    { k: KEY, v: room.view, paused: Boolean(seed.paused) },
  );

  await page.goto("/", { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.locator("main h1").first().waitFor({ timeout: 120_000 });
  await page.waitForFunction(
    (k) => {
      const raw = window.localStorage.getItem(k);
      const state = raw ? JSON.parse(raw).state : null;
      return Boolean(state?.recoveryCommand && state?.nutritionPrefs && state?.scheduleProfile && state?.setupProfile && state?.profile);
    },
    KEY,
    { timeout: 30_000 },
  );

  const patched = await page.evaluate(
    ({ k, iso, v, enhanced, ackVersion }) => {
      const now = new Date(iso);
      const dayKey = (offset: number) => {
        const d = new Date(now);
        d.setDate(d.getDate() + offset);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      };
      const stamp = now.toISOString();
      const parsed = JSON.parse(window.localStorage.getItem(k) as string);
      const s = parsed.state;
      s.activeView = v;
      s.subscriptionTier = "elite";
      s.profile = { ...s.profile, aiCoachStyle: "hardass-prep" };
      /* Logs present: every Recovery section renders. */
      s.recoveryCommand = {
        ...s.recoveryCommand,
        sleepTargetHours: 8,
        hydrationTargetOz: 120,
        sleepLogs: [7.2, 6.8, 7.6, 8.1, 7.0, 7.9, 7.4].map((hours, i) => ({ date: dayKey(i - 7), hours })),
        hydrationLogs: [{ date: dayKey(0), oz: 64 }],
        mobilityLogs: [{ date: dayKey(-1), kind: "recovery", minutes: 10, focus: "Reset" }],
        stressCheckIns: [{ date: dayKey(0), stress: 2, energy: 4, mood: 4 }],
      };
      s.nutritionPrefs = { ...s.nutritionPrefs, loggedMealIds: [], latestMealLog: null, nutritionLogDate: dayKey(0) };
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
      s.safetyAcknowledgement = { acknowledgedAt: stamp, version: ackVersion, adultConfirmedAt: stamp };
      s.trainingSession = { ...s.trainingSession, enhancementLog: [] };
      s.cyclePeriods = [];
      if (enhanced) {
        s.trainingSession.enhancementLog = [
          {
            id: "e2e-test",
            name: "Testosterone Cypionate",
            officialName: "Testosterone Cypionate",
            compoundClass: "hormones_testosterone",
            category: "hormone",
            doseAmount: "",
            doseUnit: "",
            frequency: "",
            timingPreference: "",
            goalAssociation: [],
            isActive: true,
            createdAt: stamp,
            updatedAt: stamp,
          },
        ];
      }
      return JSON.stringify(parsed);
    },
    { k: KEY, iso: (seed.when ?? WHEN).toISOString(), v: room.view, enhanced: Boolean(seed.enhanced), ackVersion: SAFETY_ACK_VERSION },
  );
  await page.addInitScript(({ k, v }) => window.localStorage.setItem(k, v), { k: KEY, v: patched });
  await page.reload({ waitUntil: "domcontentloaded", timeout: 120_000 });
  await expect(page.locator(room.ready).filter({ visible: true }).first(), `the ${room.name} room rendered`).toBeVisible({ timeout: 60_000 });
}

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

const band = (page: Page, id: string) => page.locator(`[data-detail-image="${id}"]`).filter({ visible: true });

/** Scrolls the band in, waits for its image to decode, and reports what was served. */
async function loaded(page: Page, id: string) {
  const el = band(page, id);
  await expect(el, `${id} band present`).toHaveCount(1, { timeout: 30_000 });
  await el.scrollIntoViewIfNeeded();
  await expect
    .poll(() => el.locator("img").evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0), {
      message: `${id} image decoded`,
      timeout: 30_000,
    })
    .toBe(true);
  return el.locator("img").evaluate((img: HTMLImageElement) => ({ src: img.currentSrc, naturalWidth: img.naturalWidth }));
}

/** ReserveButton's primary tier is the only control painted in #0a0b10 text (read in any colour format). */
function goldActions(page: Page) {
  return findGoldActions(page, { selector: "button", match: "text" });
}

/** The redesign-rooms-depth nesting measure: computed border + radius ancestry inside main. */
function nestedPanels(page: Page) {
  return nestedSurfaces(page, BORDERED_PANEL_RULE, { exclude: NOT_OURS, classes: 4 });
}

/** Animations actually running on a band or anything inside it. */
function runningAnimations(page: Page, id: string) {
  return band(page, id).evaluate((el) =>
    el.getAnimations({ subtree: true }).filter((a) => a.playState === "running").length,
  );
}

async function shot(page: Page, id: string, name: string) {
  if (!SHOTS) return;
  const el = band(page, id);
  await el.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1600);
  /* Fixed chrome (tab bar, action bar, ticker) would be painted over an element shot. */
  await page.addStyleTag({ content: '[data-living-shot-hide] { visibility: hidden !important; }' });
  await page.evaluate(() => {
    for (const node of document.querySelectorAll("body *")) {
      const pos = getComputedStyle(node).position;
      if ((pos === "fixed" || pos === "sticky") && !node.closest("main [data-detail-image]")) node.setAttribute("data-living-shot-hide", "");
    }
  });
  /* The band's panel: the band in the section it belongs to. */
  await el.locator("xpath=..").screenshot({ path: `${SHOTS}/${name}.png`, animations: "disabled" });
  await page.evaluate(() => document.querySelectorAll("[data-living-shot-hide]").forEach((n) => n.removeAttribute("data-living-shot-hide")));
}

for (const vp of VIEWPORTS) {
  test.describe(`living details at ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.touch, isMobile: vp.touch });

    for (const room of ROOMS) {
      test(`${room.name}: detail image loaded, right variant, no card in a card, one gold action`, async ({ page }) => {
        test.setTimeout(240_000);
        await boot(page, room);
        await scrollThrough(page);

        if (room.images.length === 0) {
          await expect(page.locator("main [data-detail-image]"), `${room.name} shows no detail image`).toHaveCount(0);
        }
        for (const id of room.images) {
          const served = await loaded(page, id);
          expect(served.naturalWidth, `${id} naturalWidth`).toBeGreaterThan(0);
          if (vp.width < 768) {
            expect(served.src, `${id} phone variant`).toContain(`/brand/details/${id}-4x5.webp`);
          } else {
            expect(served.src, `${id} desktop variant`).not.toContain("-4x5");
            expect(served.src, `${id} desktop variant`).toContain(`/brand/details/${id}`);
          }
          await expect(band(page, id)).toHaveAttribute("aria-hidden", "true");
          await expect(band(page, id).locator("img")).toHaveAttribute("alt", "");
          await shot(page, id, `${room.name.toLowerCase()}-${id}-${vp.name}`);
        }

        expect(await nestedPanels(page), `bordered rounded panels nested in ${room.name}`).toEqual([]);
        expect(await goldActions(page), `exactly one gold action in ${room.name}`).toHaveLength(1);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, `sideways scroll in ${room.name}`).toBeLessThanOrEqual(1);
      });
    }
  });
}

test.describe("living details motion gates", () => {
  test.use({ viewport: { width: 1280, height: 900 } });
  const recovery = ROOMS.find((r) => r.name === "Recovery")!;

  test("the living layer runs when motion is allowed", async ({ page }) => {
    test.setTimeout(240_000);
    await boot(page, recovery);
    await loaded(page, "hydration-bar");
    await expect.poll(() => runningAnimations(page, "hydration-bar"), { timeout: 10_000 }).toBeGreaterThan(0);
  });

  test("prefers-reduced-motion: no running animation, image visible", async ({ page }) => {
    test.setTimeout(240_000);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await boot(page, recovery);
    await scrollThrough(page);
    for (const id of recovery.images) {
      await loaded(page, id);
      await expect(band(page, id)).toHaveAttribute("data-motion", "still");
      expect(await runningAnimations(page, id), `${id} running animations`).toBe(0);
      expect(await band(page, id).evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
    }
  });

  test("ambient pause: nothing runs, image visible", async ({ page }) => {
    test.setTimeout(240_000);
    await boot(page, recovery, { paused: true });
    await scrollThrough(page);
    for (const id of recovery.images) {
      await loaded(page, id);
      await expect(band(page, id)).toHaveAttribute("data-motion", "paused");
      expect(await runningAnimations(page, id), `${id} running animations`).toBe(0);
      expect(await band(page, id).evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
    }
  });
});

test.describe("Hardass Prep detail", () => {
  test.use({ viewport: { width: 1280, height: 900 } });
  const apex = ROOMS[0];

  test("prep-journal off cycle, dawn-gym on a cycle", async ({ page }) => {
    test.setTimeout(240_000);
    await boot(page, apex, { enhanced: true });
    const section = page.locator("[data-hardass-prep]");
    await expect(section).toHaveAttribute("data-on-cycle", "true");
    await loaded(page, "dawn-gym");
    await expect(section.locator('[data-detail-image="prep-journal"]')).toHaveCount(0);
    await expect(section.locator('[data-detail-image="dawn-gym"]')).toHaveCount(1);
    await shot(page, "dawn-gym", "apex-dawn-gym-1280");
  });
});

/* ═══ Room loops ═════════════════════════════════════════════════════════
   Apex, Training, Recovery, Nutrition and Schedule carry Firefly loops: the
   16:9 cut on desktop, the 9:16 cut on phones (never the other). A still
   under reduced motion, when paused, whenever the night plate is showing, and
   on a phone under Save-Data or a connection slower than 4G. */

const LOOP_ROOMS = [
  { room: ROOMS[1], asset: "training-command" },
  { room: ROOMS[3], asset: "recovery-chamber" },
  { room: ROOMS[2], asset: "nutrition-command" },
  { room: ROOMS[4], asset: "schedule-command" },
];

/* Two layers of one clip carry the loop over its wrap; layer A is the one
   that mounts first and plays first. */
const loopVideo = (page: Page, asset: string) =>
  page.locator(`video[data-loop-layer="a"][data-environment-loop="/brand/loops/${asset}-16x9.mp4"]`);
/** Every loop element on the page is this room's clip, however many there are. */
const loopSources = (page: Page) =>
  page.evaluate(() => [...document.querySelectorAll("video")].map((v: HTMLVideoElement) => new URL(v.currentSrc || v.src).pathname));


/** Every .mp4 the page asks for. */
function mp4Requests(page: Page): string[] {
  const seen: string[] = [];
  page.on("request", (request) => {
    if (/\.mp4(\?|$)/.test(request.url())) seen.push(request.url());
  });
  return seen;
}

test.describe("room loops at 1280", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  for (const { room, asset } of LOOP_ROOMS) {
    test(`${room.name}: mounts and plays its own muted, inline loop`, async ({ page }) => {
      test.setTimeout(240_000);
      await boot(page, room);
      const video = loopVideo(page, asset);
      await expect(video, `${asset} loop mounted`).toHaveCount(1, { timeout: 30_000 });
      expect(new Set(await loopSources(page)), "no other room's loop is mounted").toEqual(
        new Set([`/brand/loops/${asset}-16x9.mp4`]),
      );
      const attrs = await video.evaluate((v: HTMLVideoElement) => ({
        muted: v.muted,
        playsInline: v.playsInline,
        loop: v.loop,
        src: new URL(v.currentSrc || v.src).pathname,
        seam: v.closest("[data-loop-seam]")?.getAttribute("data-loop-seam"),
      }));
      expect(attrs).toEqual({ muted: true, playsInline: true, loop: true, src: `/brand/loops/${asset}-16x9.mp4`, seam: "closed" });
      await expect
        .poll(() => video.evaluate((v: HTMLVideoElement) => !v.paused && v.currentTime > 0), { message: `${asset} playing`, timeout: 30_000 })
        .toBe(true);
    });
  }

  test("a second layer carries the wrap, and the seam never opens", async ({ page }) => {
    test.setTimeout(240_000);
    await boot(page, ROOMS[1]);
    const video = loopVideo(page, "training-command");
    await expect.poll(() => video.evaluate((v: HTMLVideoElement) => !v.paused && v.duration > 0), { timeout: 30_000 }).toBe(true);
    const second = page.locator('video[data-loop-layer="b"]');
    await expect(second, "the second layer mounted once the first was playing").toHaveCount(1, { timeout: 30_000 });
    await expect.poll(() => second.evaluate((v: HTMLVideoElement) => v.readyState >= 2), { timeout: 30_000 }).toBe(true);

    /* The seam is the single-layer fallback's wrap; with two layers it must
       never open, so the room never dips to its plate. */
    await video.evaluate((v: HTMLVideoElement) => {
      const seam = v.closest("[data-loop-seam]")!;
      const seen: string[] = [];
      (window as unknown as { __seam: string[] }).__seam = seen;
      new MutationObserver(() => seen.push(seam.getAttribute("data-loop-seam") ?? "")).observe(seam, {
        attributes: true,
        attributeFilter: ["data-loop-seam"],
      });
      v.currentTime = v.duration - 1.2;
    });
    await expect.poll(() => second.evaluate((v: HTMLVideoElement) => !v.paused), { timeout: 15_000 }).toBe(true);
    expect(await page.evaluate(() => (window as unknown as { __seam: string[] }).__seam)).toEqual([]);
    await expect(page.locator("[data-loop-seam]")).toHaveAttribute("data-loop-seam", "closed");
    /* And the room is still running: one layer leads, the other waits. */
    expect(
      await page.evaluate(() =>
        [...document.querySelectorAll("video")].some((v: HTMLVideoElement) => !v.paused && v.currentTime > 0),
      ),
    ).toBe(true);
  });

  test("reduced motion: no loop plays", async ({ page }) => {
    test.setTimeout(240_000);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await boot(page, ROOMS[1]);
    await page.waitForTimeout(3_000);
    expect(await page.evaluate(() => [...document.querySelectorAll("video")].every((v) => v.paused))).toBe(true);
    await expect(page.locator("video")).toHaveCount(0);
  });

  test("the ambient pause pauses a playing loop", async ({ page }) => {
    test.setTimeout(240_000);
    await boot(page, ROOMS[3]);
    const video = loopVideo(page, "recovery-chamber");
    await expect.poll(() => video.evaluate((v: HTMLVideoElement) => !v.paused), { timeout: 30_000 }).toBe(true);
    await page.getByRole("button", { name: "Pause background motion" }).click();
    await expect
      .poll(() => page.evaluate(() => [...document.querySelectorAll("video")].every((v) => v.paused)), { timeout: 10_000 })
      .toBe(true);
    await expect(page.locator("[data-loop-seam]")).toHaveAttribute("data-loop-seam", "closed");
  });

  test("night: the room serves its own night plate, and the day loop does not play over it", async ({ page }) => {
    test.setTimeout(240_000);
    /* 9:30 PM with sleep at 10:30 PM: inside the night window.

       Owner direction 2026-09-24: the room is ALWAYS the member's real hour,
       and it moves only where that hour has a clip of its own.

       THE RULE IS THE DAY LOOP, not the plate. This asserted the night plate
       image was attached, on the premise that Training had "an approved night
       plate and no night clip" — true when it was written, false since
       2026-09-30 gave every room a night clip. With a clip serving, the still
       is not in the DOM and the test failed while the product was right.

       So it asserts what cannot change: at 9:30 PM the DAY loop never plays,
       and the hour is served by its own night asset — the clip where one
       measures clean, the night still where it does not (eight were pulled on
       2026-10-01; see asset-manifest). */
    await boot(page, ROOMS[1], { when: new Date(2026, 8, 15, 21, 30, 0) });
    await expect(page.locator('video[data-environment-loop="/brand/loops/training-command-16x9.mp4"]')).toHaveCount(0);
    /* Which plate the room is CAST to at night is the cast's business, not
       this test's — Training resolves to `training-floor` after dark, and
       naming `training-command` here is what made this fail on a correct
       product. The rule is the hour: whatever serves is a night asset. */
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const clips = [...document.querySelectorAll("video")]
              .map((v) => new URL((v as HTMLVideoElement).currentSrc || "http://x/").pathname)
              .filter((path) => /\/brand\/loops\//.test(path));
            const plates = [...document.querySelectorAll("img")]
              .map((i) => i.getAttribute("src") ?? "")
              .filter((src) => /\/brand\/(backgrounds|plates)\//.test(src));
            const night = (list: string[]) => list.some((x) => /-night[.-]/.test(x));
            return { anyDayClip: clips.some((c) => !/-night-/.test(c)), served: night(clips) || night(plates) };
          }),
        { timeout: 30_000 },
      )
      .toEqual({ anyDayClip: false, served: true });
  });
});

test.describe("room loops at 375", () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });

  const PHONE_LOOP_ROOMS = [{ room: ROOMS[0], asset: "apex-command" }, ...LOOP_ROOMS];
  const phoneVideo = (page: Page, asset: string) =>
    page.locator(`video[data-loop-layer="a"][data-environment-loop="/brand/loops/${asset}-9x16.mp4"]`);
  const allPaused = (page: Page) => page.evaluate(() => [...document.querySelectorAll("video")].every((v) => v.paused));

  for (const { room, asset } of PHONE_LOOP_ROOMS) {
    test(`${room.name}: mounts its own 9:16 loop, muted and inline, never the 16:9`, async ({ page }) => {
      test.setTimeout(240_000);
      const requests = mp4Requests(page);
      await boot(page, room);
      const video = phoneVideo(page, asset);
      await expect(video, `${asset} 9:16 loop mounted`).toHaveCount(1, { timeout: 30_000 });
      expect(new Set(await loopSources(page)), "no other room's loop is mounted").toEqual(
        new Set([`/brand/loops/${asset}-9x16.mp4`]),
      );
      const attrs = await video.evaluate((v: HTMLVideoElement) => ({
        muted: v.muted,
        playsInline: v.playsInline,
        controls: v.controls,
        preload: v.getAttribute("preload"),
        src: new URL(v.currentSrc || v.src).pathname,
      }));
      expect(attrs).toEqual({ muted: true, playsInline: true, controls: false, preload: "none", src: `/brand/loops/${asset}-9x16.mp4` });
      await expect
        .poll(() => video.evaluate((v: HTMLVideoElement) => !v.paused && v.currentTime > 0), { message: `${asset} playing`, timeout: 30_000 })
        .toBe(true);
      expect(requests.filter((url) => url.includes("16x9"))).toEqual([]);
    });
  }

  test("the loop attaches only after the 9:16 plate has painted", async ({ page }) => {
    test.setTimeout(240_000);
    await boot(page, ROOMS[1]);
    const video = phoneVideo(page, "training-command");
    await expect(video).toHaveCount(1, { timeout: 30_000 });
    const plateDone = await page.evaluate(() => {
      const img = [...document.querySelectorAll<HTMLImageElement>('[data-ambient-layer="room"] img')].find((i) => i.currentSrc.includes("9x16"));
      return Boolean(img && img.complete && img.naturalWidth > 0);
    });
    expect(plateDone, "the 9:16 plate decoded before the loop mounted").toBe(true);
  });

  test("Save-Data: no video element and no video request", async ({ page }) => {
    test.setTimeout(240_000);
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "connection", {
        configurable: true,
        get: () => ({ saveData: true, effectiveType: "4g", addEventListener() {}, removeEventListener() {} }),
      });
    });
    const requests = mp4Requests(page);
    await boot(page, ROOMS[1]);
    await page.waitForTimeout(4_000);
    await expect(page.locator("video")).toHaveCount(0);
    expect(requests).toEqual([]);
  });

  test("a 3G connection: no video element and no video request", async ({ page }) => {
    test.setTimeout(240_000);
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "connection", {
        configurable: true,
        get: () => ({ saveData: false, effectiveType: "3g", addEventListener() {}, removeEventListener() {} }),
      });
    });
    const requests = mp4Requests(page);
    await boot(page, ROOMS[3]);
    await page.waitForTimeout(4_000);
    await expect(page.locator("video")).toHaveCount(0);
    expect(requests).toEqual([]);
  });

  test("reduced motion: a still", async ({ page }) => {
    test.setTimeout(240_000);
    await page.emulateMedia({ reducedMotion: "reduce" });
    const requests = mp4Requests(page);
    await boot(page, ROOMS[1]);
    await page.waitForTimeout(4_000);
    await expect(page.locator("video")).toHaveCount(0);
    expect(requests).toEqual([]);
  });

  test("the ambient pause in More pauses a playing loop", async ({ page }) => {
    test.setTimeout(240_000);
    await boot(page, ROOMS[3]);
    const video = phoneVideo(page, "recovery-chamber");
    await expect.poll(() => video.evaluate((v: HTMLVideoElement) => !v.paused), { timeout: 30_000 }).toBe(true);
    await page.getByRole("navigation", { name: "Rooms" }).getByRole("button", { name: "More" }).click();
    await page.getByRole("dialog", { name: "More" }).getByRole("button", { name: "Pause background motion" }).click();
    await expect.poll(() => allPaused(page), { timeout: 10_000 }).toBe(true);
  });

  test("paused before load: a still, no video request", async ({ page }) => {
    test.setTimeout(240_000);
    const requests = mp4Requests(page);
    await boot(page, ROOMS[2], { paused: true });
    await page.waitForTimeout(4_000);
    expect(await allPaused(page)).toBe(true);
    expect(requests).toEqual([]);
  });

  test("night: the phone serves its own 9:16 night plate instead of the day loop", async ({ page }) => {
    test.setTimeout(240_000);
    /* The phone keeps its 9:16 night still: no night clip is cut 9:16, so a
       phone never moves at night whatever the desktop does. The day loop is
       the thing that must not appear. */
    await boot(page, ROOMS[1], { when: new Date(2026, 8, 15, 21, 30, 0) });
    await expect(phoneVideo(page, "training-command")).toHaveCount(0);
    /* A 9:16 night plate of whichever room the hour casts — see the desktop
       case above for why this does not name one. */
    await expect
      .poll(
        () =>
          page.evaluate(() =>
            [...document.querySelectorAll("img")]
              .map((i) => i.getAttribute("src") ?? "")
              .some((src) => /-night-9x16\.webp/.test(src)),
          ),
        { timeout: 30_000 },
      )
      .toBe(true);
  });

  test("document scroll never moves or resizes the fixed room layer beyond its drift", async ({ page }) => {
    test.setTimeout(240_000);
    await boot(page, ROOMS[1]);
    await expect(phoneVideo(page, "training-command")).toHaveCount(1, { timeout: 30_000 });
    const samples = await page.evaluate(async () => {
      const layer = document.querySelector<HTMLElement>('[data-ambient-layer="room"]')!;
      const video = layer.querySelector("video")!;
      const out: { layerTop: number; layerHeight: number; videoTop: number }[] = [];
      for (const y of [0, 300, 900, 1800, 600, 0]) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 150));
        const l = layer.getBoundingClientRect();
        out.push({ layerTop: l.top, layerHeight: l.height, videoTop: video.getBoundingClientRect().top });
      }
      return { out, position: getComputedStyle(layer).position };
    });
    expect(samples.position).toBe("fixed");
    for (const s of samples.out) {
      expect(s.layerTop).toBe(0);
      expect(s.layerHeight).toBe(samples.out[0].layerHeight);
      /* Depth drift is at most its plate travel (24px) of transform. */
      expect(Math.abs(s.videoTop - samples.out[0].videoTop)).toBeLessThanOrEqual(24);
    }
  });
});
