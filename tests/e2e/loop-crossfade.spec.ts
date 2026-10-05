import { test, expect, type Page } from "@playwright/test";

import { LOOP_CROSSFADE_MS, LOOP_PLAYBACK_RATE } from "../../src/lib/cinematic/loop-crossfade";
import { asDesktopDevice } from "./support/device-profile";

/**
 * LOOP CROSSFADE — the room's loop carried over its own end.
 *
 * A room loop's last frame is not its first: a bare wrap is a cut, and the
 * seam fade traded that cut for a pulse. Two layers of the same clip now
 * dissolve into each other instead. This asserts the behaviour AND measures
 * the result:
 *
 *   · a second layer exists only while a loop is genuinely playing, and never
 *     under reduced motion, the member's pause, a hidden tab, a live session,
 *     the night plate or Save-Data
 *   · both layers play at the slowed rate
 *   · the composite's frame-to-frame difference across the join is no worse
 *     than the worst difference during normal playback (a cut is 6–25x it)
 *   · the second layer is released when the loop stops and when the room goes
 *
 * MEASUREMENT. The room's composite is reconstructed on a canvas at 80ms:
 * the plate, then the loop layers composited as their own group, then that
 * group at the room's opacity. Frame content is read from the elements, but
 * the fading opacity is MODELLED from the layer's role attribute and the
 * declared fade, because Chrome runs that fade on the compositor and only
 * syncs the main thread in steps — `getComputedStyle` shows a staircase where
 * the screen shows a ramp. Both wrap treatments would be reconstructed the
 * same way, so the numbers are comparable.
 */

const KEY = "final-boss-athlete-settings";
/** Tuesday 15 September 2026, 4:12 PM local — a training day, mid-afternoon. */
const WHEN = new Date(2026, 8, 15, 16, 12, 0);
/** 9:30 PM against a 10:30 PM sleep target: the night plate, which is a still. */
const NIGHT = new Date(2026, 8, 15, 21, 30, 0);
/* The drift floor was measured when the room was drawn at 0.2 opacity under
   a heavy scrim. On 2026-09-18 the room was lifted about 3x (plate 0.34 →
   0.72, lighter scrim, narrower readiness band), which scales every pixel
   difference with it — ordinary drift and a bare wrap alike. A bare wrap
   would now measure far above this; the join still sits inside drift. */
const JOIN_FLOOR = 0.6 * 3;

type Room = { name: string; view: string; ready: string; asset: string };

const APEX: Room = { name: "Apex", view: "dashboard", ready: '[data-apex="next-move-title"]', asset: "apex-command" };
const RECOVERY: Room = { name: "Recovery", view: "recovery", ready: '[data-recovery="hero"]', asset: "recovery-chamber" };
/* Training is the room whose environment stills itself for a live session
   (`activeTaskBehavior: "poster-only"`); Apex stays ambient by design. */
const TRAINING: Room = { name: "Training", view: "training", ready: '[data-training="hero"]', asset: "training-command" };

type Seed = { paused?: boolean; when?: Date; live?: boolean; /** Cores to present; omit for desktop-class. */ cores?: number };

async function boot(page: Page, room: Room, seed: Seed = {}) {
  /* This spec describes the full composition, so it says which device it
     means rather than inheriting the runner's core count. A test about
     degradation passes its own lower value. */
  await asDesktopDevice(page, seed.cores);
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

  /* `domcontentloaded`: the dev server's HMR socket keeps networkidle from settling. */
  await page.goto("/", { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.locator("main h1").first().waitFor({ timeout: 120_000 });
  await page.waitForFunction(
    (k) => {
      const raw = window.localStorage.getItem(k);
      const state = raw ? JSON.parse(raw).state : null;
      return Boolean(state?.recoveryCommand && state?.scheduleProfile && state?.setupProfile);
    },
    KEY,
    { timeout: 30_000 },
  );

  /* Two-phase seed, as the room specs do it: the patch lands before the app boots on reload. */
  const patched = await page.evaluate(
    ({ k, iso, v, live }) => {
      const now = new Date(iso);
      const dayKey = (offset: number) => {
        const d = new Date(now);
        d.setDate(d.getDate() - offset);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      };
      const parsed = JSON.parse(window.localStorage.getItem(k) as string);
      const s = parsed.state;
      s.activeView = v;
      s.recoveryCommand = {
        ...s.recoveryCommand,
        sleepLogs: [7.2, 6.8, 7.6, 8.1, 7.0, 7.9, 7.4].map((hours, i) => ({ date: dayKey(7 - i), hours })),
        hydrationLogs: [{ date: dayKey(0), oz: 64 }],
        stressCheckIns: [{ date: dayKey(0), stress: 2, energy: 4, mood: 4 }],
      };
      s.scheduleProfile = { ...s.scheduleProfile, wakeTime: "06:30", sleepTarget: "22:30", trainingWindow: "evening" };
      const steps: string[] = (s.setupProfile?.completedSteps ?? []).filter((step: string) => step !== "schedule");
      s.setupProfile = { ...s.setupProfile, setupComplete: true, completedAt: now.toISOString(), completedSteps: [...steps, "schedule"] };
      s.splitSystem = { ...(s.splitSystem || {}), key: "ppl-ul", source: "member", selectedAt: now.toISOString() };
      if (live) s.trainingSession = { ...s.trainingSession, sessionMode: "live" };
      return JSON.stringify(parsed);
    },
    { k: KEY, iso: (seed.when ?? WHEN).toISOString(), v: room.view, live: Boolean(seed.live) },
  );
  await page.addInitScript(({ k, v }) => window.localStorage.setItem(k, v), { k: KEY, v: patched });
  await page.reload({ waitUntil: "domcontentloaded", timeout: 120_000 });
  await expect(page.locator(room.ready).filter({ visible: true }).first(), `the ${room.view} room rendered`).toBeVisible({ timeout: 60_000 });
}

const layer = (page: Page, id: "a" | "b") => page.locator(`video[data-loop-layer="${id}"]`);

/** Waits until the room's loop is genuinely running. */
async function playing(page: Page) {
  await expect(layer(page, "a")).toHaveCount(1, { timeout: 60_000 });
  await expect
    .poll(() => layer(page, "a").evaluate((v: HTMLVideoElement) => !v.paused && v.currentTime > 0), { timeout: 60_000 })
    .toBe(true);
}

/** Every .mp4 the page asks for. */
function mp4Requests(page: Page): string[] {
  const seen: string[] = [];
  page.on("request", (request) => {
    if (/\.mp4(\?|$)/.test(request.url())) seen.push(request.url());
  });
  return seen;
}

type Sample = { ms: number; diff: number; roles: string[]; clocks: number[] };

/**
 * Parks the loop near its end and samples the room's composite across the
 * join. Returns the frame-to-frame differences, and which of them were taken
 * while the room was not in its steady state.
 */
async function sampleJoin(page: Page, fadeMs: number): Promise<Sample[]> {
  await page.evaluate(
    (lead) =>
      new Promise<void>((resolve) => {
        const running = [...document.querySelectorAll("video")].find((v) => !v.paused);
        if (!running || !Number.isFinite(running.duration)) return resolve();
        running.addEventListener("seeked", () => window.setTimeout(resolve, 500), { once: true });
        running.currentTime = Math.max(0, running.duration - lead);
      }),
    2.2,
  );
  await page.waitForTimeout(400);

  return page.evaluate(
    ([period, span, fade]) =>
      new Promise<Sample[]>((resolve) => {
        const width = 192;
        const height = 108;
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
        const group = document.createElement("canvas");
        group.width = width;
        group.height = height;
        const gtx = group.getContext("2d")!;

        const root = document.querySelector('[data-ambient-layer="room"]') ?? document.body;
        const plate = [...root.querySelectorAll("img")].find((img) => img.complete && img.naturalWidth > 0) ?? null;
        const stack = root.querySelector("[data-loop-stack]");
        const order = () =>
          [...root.querySelectorAll("video")]
            .map((video, index) => ({ video, index, z: parseInt(getComputedStyle(video).zIndex, 10) || 0 }))
            .sort((a, b) => a.z - b.z || a.index - b.index)
            .map((entry) => entry.video);

        /* Ancestor opacities, which are not animating while this runs. */
        const chain = (el: Element | null) => {
          let opacity = 1;
          let node: Element | null = el;
          while (node && node !== document.documentElement) {
            const value = parseFloat(getComputedStyle(node).opacity);
            if (Number.isFinite(value)) opacity *= value;
            node = node.parentElement;
          }
          return opacity;
        };
        /* The fade, reconstructed from the role each layer is in. */
        const ease = (p: number) => (p <= 0 ? 0 : p >= 1 ? 1 : p < 0.5 ? 2 * p * p : 1 - 2 * (1 - p) * (1 - p));
        const since = new Map<string, { role: string; at: number }>();
        const alphaOf = (video: HTMLVideoElement, now: number) => {
          const id = video.getAttribute("data-loop-layer") ?? "single";
          const role = video.getAttribute("data-loop-role") ?? "single";
          const held = since.get(id);
          if (!held) since.set(id, { role, at: now - 1e6 });
          else if (held.role !== role) since.set(id, { role, at: now });
          const state = since.get(id)!;
          if (role === "outgoing") return 1 - ease((now - state.at) / fade);
          return role === "parked" ? 0 : 1;
        };

        const samples: Sample[] = [];
        let previous: Uint8ClampedArray | null = null;
        const started = performance.now();
        const pump = () => {
          if (performance.now() - started < span + 500) requestAnimationFrame(pump);
        };
        requestAnimationFrame(pump);

        const tick = () => {
          const now = performance.now();
          const groupAlpha = chain(stack);
          gtx.clearRect(0, 0, width, height);
          const roles: string[] = [];
          const clocks: number[] = [];
          for (const video of order()) {
            const alpha = alphaOf(video, now);
            roles.push(`${video.getAttribute("data-loop-layer")}:${video.getAttribute("data-loop-role")}:${alpha.toFixed(2)}`);
            clocks.push(video.currentTime);
            if (video.readyState < 2 || alpha <= 0.001) continue;
            gtx.globalAlpha = alpha;
            gtx.drawImage(video, 0, 0, width, height);
          }
          ctx.globalAlpha = 1;
          ctx.fillStyle = "#07080c";
          ctx.fillRect(0, 0, width, height);
          if (plate) {
            ctx.globalAlpha = chain(plate);
            ctx.drawImage(plate, 0, 0, width, height);
          }
          ctx.globalAlpha = groupAlpha;
          ctx.drawImage(group, 0, 0, width, height);
          ctx.globalAlpha = 1;

          const pixels = ctx.getImageData(0, 0, width, height).data;
          let diff = 0;
          if (previous) {
            let sum = 0;
            for (let p = 0; p < pixels.length; p += 4) {
              sum +=
                Math.abs(pixels[p] - previous[p]) + Math.abs(pixels[p + 1] - previous[p + 1]) + Math.abs(pixels[p + 2] - previous[p + 2]);
            }
            diff = sum / ((pixels.length / 4) * 3);
          }
          previous = pixels;
          samples.push({ ms: Math.round(now - started), diff, roles, clocks });
          if (now - started >= span) {
            window.clearInterval(handle);
            resolve(samples.slice(1));
          }
        };
        const handle = window.setInterval(tick, period);
        tick();
      }),
    [80, 4200, fadeMs] as const,
  );
}

/** Splits the samples into the join episode and ordinary playback. */
function split(samples: Sample[]) {
  const leading = (s: Sample) => Math.max(...s.clocks);
  const signal = (s: Sample, i: number) =>
    s.roles.some((role) => role.includes(":outgoing:")) || (i > 0 && leading(s) + 0.4 < leading(samples[i - 1]));
  const flags = samples.map(signal);
  const join = flags.map((flag, i) => flag || Boolean(flags[i - 1]) || Boolean(flags[i + 1]));
  const pick = (want: boolean) => samples.filter((_, i) => join[i] === want).map((s) => s.diff);
  return { join: pick(true), normal: pick(false) };
}

test.describe("the loop's wrap at 1280", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  for (const room of [APEX, RECOVERY]) {
    test(`${room.name}: two layers of one clip, both slowed, one playing at rest`, async ({ page }) => {
      test.setTimeout(240_000);
      const requests = mp4Requests(page);
      await boot(page, room);
      await playing(page);

      /* The second layer arrives only after the first has actually played. */
      await expect(layer(page, "b"), "the second layer mounted").toHaveCount(1, { timeout: 30_000 });
      const state = await page.evaluate(() =>
        [...document.querySelectorAll("video")].map((v: HTMLVideoElement) => ({
          id: v.getAttribute("data-loop-layer"),
          src: new URL(v.currentSrc || v.src).pathname,
          rate: v.playbackRate,
          muted: v.muted,
          inline: v.playsInline,
          pip: v.disablePictureInPicture,
          loop: v.loop,
        })),
      );
      expect(state).toHaveLength(2);
      for (const entry of state) {
        expect(entry.src, "both layers are the same clip").toBe(`/brand/loops/${room.asset}-16x9.mp4`);
        expect(entry.rate, "slowed").toBe(LOOP_PLAYBACK_RATE);
        expect({ muted: entry.muted, inline: entry.inline, pip: entry.pip, loop: entry.loop }).toEqual({
          muted: true,
          inline: true,
          pip: true,
          loop: true,
        });
      }
      /* One URL, so the second layer is served from cache, not fetched again. */
      expect(new Set(requests.map((url) => new URL(url).pathname)).size).toBeLessThanOrEqual(1);

      /* At rest exactly one layer runs; the other waits on frame 0, paused. */
      await expect
        .poll(
          () =>
            page.evaluate(() =>
              [...document.querySelectorAll("video")]
                .map((v: HTMLVideoElement) => `${v.getAttribute("data-loop-role")}:${v.paused ? "paused" : "playing"}`)
                .sort()
                .join(","),
            ),
          { timeout: 30_000 },
        )
        .toBe("parked:paused,primary:playing");
    });

    test(`${room.name}: the join is no bigger a change than the room's own drift`, async ({ page }) => {
      test.setTimeout(240_000);
      await boot(page, room);
      await playing(page);
      await expect(layer(page, "b")).toHaveCount(1, { timeout: 30_000 });
      await expect.poll(() => layer(page, "b").evaluate((v: HTMLVideoElement) => v.readyState >= 2), { timeout: 30_000 }).toBe(true);

      const samples = await sampleJoin(page, LOOP_CROSSFADE_MS);
      const { join, normal } = split(samples);
      expect(join.length, "the join was inside the sampled window").toBeGreaterThan(3);
      expect(normal.length, "ordinary playback was sampled too").toBeGreaterThan(5);

      const worst = (values: number[]) => Math.max(...values);
      const trace = samples.map((s) => `${s.ms}ms ${s.diff.toFixed(3)} ${s.roles.join(" ")}`).join("\n");
      /* A bare wrap measured 1.8–4.3 on the old, 3x darker room; ordinary
         drift was under 0.6 (JOIN_FLOOR). The join must stay inside drift. */
      expect(
        worst(join),
        `the join's worst frame-to-frame difference (${worst(join).toFixed(3)}) vs ordinary playback's (${worst(normal).toFixed(3)})\n${trace}`,
      ).toBeLessThanOrEqual(Math.max(worst(normal), JOIN_FLOOR));
    });
  }

  test("the layer it leaves is parked on frame 0, never left running", async ({ page }) => {
    test.setTimeout(240_000);
    await boot(page, APEX);
    await playing(page);
    await expect(layer(page, "b")).toHaveCount(1, { timeout: 30_000 });
    await expect.poll(() => layer(page, "b").evaluate((v: HTMLVideoElement) => v.readyState >= 2), { timeout: 30_000 }).toBe(true);

    await layer(page, "a").evaluate((v: HTMLVideoElement) => {
      v.currentTime = Math.max(0, v.duration - 1.2);
    });
    /* The handover happens, and settles back to one running layer. */
    await expect.poll(() => layer(page, "b").evaluate((v: HTMLVideoElement) => !v.paused), { timeout: 30_000 }).toBe(true);
    await expect
      .poll(
        () =>
          page.evaluate(() =>
            [...document.querySelectorAll("video")]
              .map((v: HTMLVideoElement) => `${v.getAttribute("data-loop-role")}:${v.paused ? "paused" : "playing"}`)
              .sort()
              .join(","),
          ),
        { timeout: 30_000 },
      )
      .toBe("parked:paused,primary:playing");
    expect(await layer(page, "a").evaluate((v: HTMLVideoElement) => v.currentTime)).toBe(0);
  });

  test("the member's pause releases the second layer, and resuming brings it back", async ({ page }) => {
    test.setTimeout(240_000);
    await boot(page, RECOVERY);
    await playing(page);
    await expect(layer(page, "b")).toHaveCount(1, { timeout: 30_000 });

    await page.getByRole("button", { name: "Pause background motion" }).click();
    await expect(layer(page, "b"), "the second decoder is released").toHaveCount(0, { timeout: 15_000 });
    expect(await page.evaluate(() => [...document.querySelectorAll("video")].every((v: HTMLVideoElement) => v.paused))).toBe(true);

    await page.getByRole("button", { name: "Play background motion" }).click();
    await expect(layer(page, "b")).toHaveCount(1, { timeout: 30_000 });
  });

  test("a live session stills the training room: no layers at all", async ({ page }) => {
    test.setTimeout(240_000);
    await boot(page, TRAINING, { live: true });
    await page.waitForTimeout(4_000);
    await expect(page.locator("video")).toHaveCount(0);
  });

  test("night never plays the day clip, whether or not the hour has one of its own", async ({ page }) => {
    test.setTimeout(240_000);
    /* Until 2026-09-24 a room with a day loop kept its DAY plate at every
       hour, so this asserted only that something was playing. The clock is
       unpinned now: Apex is cast to `command-room` after dark.

       It then asserted command-room's night CLIP played. Both of that pair's
       night clips were pulled on 2026-10-01 for their join (see
       asset-manifest), so Apex is honestly still after dark — and the test
       failed on a product that was behaving correctly.

       What holds either way: the day clip never lights the room at 9:30 PM.
       Whatever plays, it is not that. */
    await boot(page, APEX, { when: NIGHT });
    await page.waitForTimeout(4_000);
    const dayClips = await page.evaluate(() =>
      [...document.querySelectorAll("video")]
        .map((v) => new URL((v as HTMLVideoElement).currentSrc || "http://x/").pathname)
        .filter((path) => /\/brand\/loops\//.test(path) && !/-night-/.test(path)),
    );
    expect(dayClips, "a day clip was playing at 9:30 PM").toEqual([]);
  });

  /* The night clips were approved 2026-09-24 on their frame-0-vs-plate number,
     which says nothing about the wrap. The raw delta is not the verdict either
     (the player dissolves it over 800ms); this is.

     On 2026-10-01 all fourteen were measured through this harness. Eight came
     out over max(drift, 1.8) and were pulled; six ship. The two rooms this
     loop originally named — Apex via command-room (2.117) and Recovery via
     recovery-suite (2.554) — are both among the pulled, so naming them here
     would assert a join on a clip nobody is served.

     These two are what Recovery and Training are cast to after dark now, and
     both measured clean: recovery-chamber 1.405, training-command 1.106. Raw
     seam and composite barely correlate — training-command screens at 7.95 and
     composites at 1.106 — which is why this file, not the screening script,
     decides. */
  for (const [label, room, clip] of [
    ["Recovery", RECOVERY, "recovery-chamber-night-16x9"],
    /* Training is cast to `training-floor` after dark, not `training-command`
       — the cast ranks the hour's own light first and motion as the
       tie-breaker, and training-floor has both. Its composite is 0.737, the
       cleanest night clip shipping. */
    ["Training", TRAINING, "training-floor-night-16x9"],
  ] as const) {
    test(`${label} at night: the join is no bigger a change than the room's own drift`, async ({ page }) => {
      test.setTimeout(240_000);
      await boot(page, room, { when: NIGHT });
      await playing(page);
      await expect
        .poll(() => layer(page, "a").evaluate((v: HTMLVideoElement) => new URL(v.currentSrc).pathname), { timeout: 30_000 })
        .toBe(`/brand/loops/${clip}.mp4`);
      await expect(layer(page, "b")).toHaveCount(1, { timeout: 30_000 });
      await expect.poll(() => layer(page, "b").evaluate((v: HTMLVideoElement) => v.readyState >= 2), { timeout: 30_000 }).toBe(true);

      const samples = await sampleJoin(page, LOOP_CROSSFADE_MS);
      const { join, normal } = split(samples);
      expect(join.length, "the join was inside the sampled window").toBeGreaterThan(3);
      expect(normal.length, "ordinary playback was sampled too").toBeGreaterThan(5);

      const worst = (values: number[]) => Math.max(...values);
      const trace = samples.map((s) => `${s.ms}ms ${s.diff.toFixed(3)} ${s.roles.join(" ")}`).join("\n");
      expect(
        worst(join),
        `${clip}: the join's worst frame-to-frame difference (${worst(join).toFixed(3)}) vs ordinary playback's (${worst(normal).toFixed(3)})\n${trace}`,
      ).toBeLessThanOrEqual(Math.max(worst(normal), JOIN_FLOOR));
    });
  }

  test("reduced motion is a still: no layers, no request", async ({ page }) => {
    test.setTimeout(240_000);
    await page.emulateMedia({ reducedMotion: "reduce" });
    const requests = mp4Requests(page);
    await boot(page, APEX);
    await page.waitForTimeout(4_000);
    await expect(page.locator("video")).toHaveCount(0);
    expect(requests).toEqual([]);
  });

  test("a hidden tab pauses both layers", async ({ page }) => {
    test.setTimeout(240_000);
    await boot(page, APEX);
    await playing(page);
    await expect(layer(page, "b")).toHaveCount(1, { timeout: 30_000 });

    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect
      .poll(() => page.evaluate(() => [...document.querySelectorAll("video")].every((v: HTMLVideoElement) => v.paused)), { timeout: 15_000 })
      .toBe(true);
    await expect(layer(page, "b")).toHaveCount(0, { timeout: 15_000 });
  });

  test("leaving the room releases both layers", async ({ page }) => {
    test.setTimeout(240_000);
    await boot(page, APEX);
    await playing(page);
    await expect(layer(page, "b")).toHaveCount(1, { timeout: 30_000 });

    /* Personal Command's environment has no plate, so the room the loop lived
       in unmounts outright. */
    await page.getByRole("button", { name: "Personal Command", exact: true }).first().click();
    await expect(page.locator(`video[data-environment-loop="/brand/loops/${APEX.asset}-16x9.mp4"]`)).toHaveCount(0, { timeout: 30_000 });
  });

  test("a four-core device keeps one layer and the seam fade", async ({ page }) => {
    test.setTimeout(240_000);
    await boot(page, APEX, { cores: 4 });
    await playing(page);
    await page.waitForTimeout(3_000);
    await expect(page.locator("video")).toHaveCount(1);
    await expect(layer(page, "b")).toHaveCount(0);
    await expect(page.locator("[data-loop-stack]")).toHaveAttribute("data-loop-stack", "seam");
    /* Still slowed: calm does not depend on how many cores a phone has. */
    expect(await layer(page, "a").evaluate((v: HTMLVideoElement) => v.playbackRate)).toBe(LOOP_PLAYBACK_RATE);
  });
});

test.describe("the loop's wrap at 390", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  for (const room of [APEX, RECOVERY]) {
    test(`${room.name}: the join is no bigger a change than the room's own drift`, async ({ page }) => {
      test.setTimeout(240_000);
      await boot(page, room);
      await playing(page);
      await expect(layer(page, "b")).toHaveCount(1, { timeout: 30_000 });
      await expect.poll(() => layer(page, "b").evaluate((v: HTMLVideoElement) => v.readyState >= 2), { timeout: 30_000 }).toBe(true);
      expect(await layer(page, "b").evaluate((v: HTMLVideoElement) => new URL(v.currentSrc || v.src).pathname)).toBe(
        `/brand/loops/${room.asset}-9x16.mp4`,
      );

      const samples = await sampleJoin(page, LOOP_CROSSFADE_MS);
      const { join, normal } = split(samples);
      expect(join.length).toBeGreaterThan(3);
      expect(normal.length).toBeGreaterThan(5);
      const worst = (values: number[]) => Math.max(...values);
      const trace = samples.map((s) => `${s.ms}ms ${s.diff.toFixed(3)} ${s.roles.join(" ")}`).join("\n");
      expect(
        worst(join),
        `the join's worst difference (${worst(join).toFixed(3)}) vs ordinary playback's (${worst(normal).toFixed(3)})\n${trace}`,
      ).toBeLessThanOrEqual(Math.max(worst(normal), JOIN_FLOOR));
    });
  }

  test("Save-Data: no layer at all, and no request", async ({ page }) => {
    test.setTimeout(240_000);
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "connection", {
        configurable: true,
        get: () => ({ saveData: true, effectiveType: "4g", addEventListener() {}, removeEventListener() {} }),
      });
    });
    const requests = mp4Requests(page);
    await boot(page, APEX);
    await page.waitForTimeout(4_000);
    await expect(page.locator("video")).toHaveCount(0);
    expect(requests).toEqual([]);
  });
});
