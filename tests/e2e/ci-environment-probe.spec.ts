import { expect, test } from "@playwright/test";

/* ════════════════════════════════════════════════════════════════════════
   CI ENVIRONMENT PROBE — why the suite behaves differently on a runner.

   The e2e job carries 27 known failures that reproduce ONLY in CI. All three
   clusters are about the browser's environment rather than the app:

     11  room loops never play        (crossfade, seam, living-details)
     10  Escape / outside click does not dismiss a sheet
      6  motion timing               (light trace, dials, settling layer)

   Every one of them passes on a developer machine, which is exactly what
   makes them expensive: there is nothing to debug locally. This spec reports
   the handful of facts that would explain each cluster, so one CI run answers
   what no amount of local reproduction can.

   It asserts almost nothing on purpose — a probe that fails tells you less
   than a probe that prints. The one thing it does assert is that the page
   reached the member shell, because every other number is meaningless if it
   did not.
   ════════════════════════════════════════════════════════════════════════ */

test("environment probe: what the runner actually gives the app", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text().slice(0, 160));
  });

  await page.goto("/", { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.locator("main h1").first().waitFor({ timeout: 120_000 });

  const env = await page.evaluate(() => {
    const v = document.createElement("video");
    return {
      /* Cluster 2 + 3: an app that believes it is offscreen suspends motion,
         and rAF does not run in a hidden tab. */
      visibilityState: document.visibilityState,
      documentHasFocus: document.hasFocus(),
      /* Cluster 3: reduced motion turns the light trace and dials off by design. */
      prefersReducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      /* Cluster 1: Chromium without proprietary codecs cannot decode the H.264
         brand loops, so every video stays at readyState 0 forever. */
      canPlayH264: v.canPlayType('video/mp4; codecs="avc1.42E01E"'),
      canPlayMp4: v.canPlayType("video/mp4"),
      saveData: Boolean((navigator as { connection?: { saveData?: boolean } }).connection?.saveData),
      deviceMemory: (navigator as { deviceMemory?: number }).deviceMemory ?? null,
      hardwareConcurrency: navigator.hardwareConcurrency,
      userAgent: navigator.userAgent.slice(0, 120),
      /* The clock the page reads. A spec builds its fixed times with the
         LOCAL-time constructor, so this zone and the test process's zone have
         to agree or "night" lands in the morning. */
      browserTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      browserOffsetMinutes: new Date().getTimezoneOffset(),
    };
  });

  /* The same instant the specs call NIGHT, as Node built it and as the page
     reads it back. When these two disagree, every daypart-keyed surface —
     which room loop plays, which meal window is open — moves with them. */
  const NIGHT_AS_NODE_BUILT_IT = new Date(2026, 8, 15, 21, 30, 0);
  const clock = {
    nodeTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    nodeTZEnv: process.env.TZ ?? "(unset)",
    nightISO: NIGHT_AS_NODE_BUILT_IT.toISOString(),
    nightInBrowser: await page.evaluate(
      (iso) => new Date(iso).toLocaleString("en-US", { hour12: false }),
      NIGHT_AS_NODE_BUILT_IT.toISOString(),
    ),
  };

  /* Does a real brand loop decode and advance? A muted, playsinline video is
     allowed to autoplay; if it stalls, currentTime never moves. */
  const video = await page.evaluate(async () => {
    const el = document.createElement("video");
    el.muted = true;
    el.playsInline = true;
    el.preload = "auto";
    el.src = "/brand/loops/apex-command-16x9.mp4";
    document.body.appendChild(el);
    const settled = await new Promise<string>((resolve) => {
      const done = (why: string) => resolve(why);
      el.addEventListener("loadeddata", () => done("loadeddata"), { once: true });
      el.addEventListener("error", () => done(`error:${el.error?.code ?? "?"}`), { once: true });
      setTimeout(() => done("timeout"), 15_000);
    });
    let played = "not-attempted";
    try {
      await el.play();
      played = "play() resolved";
    } catch (e) {
      played = `play() rejected: ${(e as Error).name}`;
    }
    const t0 = el.currentTime;
    await new Promise((r) => setTimeout(r, 1200));
    const advanced = el.currentTime > t0;
    const out = { settled, played, readyState: el.readyState, networkState: el.networkState, advanced, currentTime: el.currentTime };
    el.remove();
    return out;
  });

  /* Do requestAnimationFrame callbacks actually run, and at what rate? The
     motion-timing cluster and every AnimatePresence exit depend on this. */
  const raf = await page.evaluate(
    () =>
      new Promise<{ frames: number; ms: number }>((resolve) => {
        let frames = 0;
        const start = performance.now();
        const tick = () => {
          frames += 1;
          if (performance.now() - start >= 1000) resolve({ frames, ms: Math.round(performance.now() - start) });
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
  );

  /* How many brand videos the real page mounted, and whether any of them is
     actually decoding. This is the cluster-1 question stated directly. */
  const mounted = await page.evaluate(() => {
    const vids = Array.from(document.querySelectorAll("video"));
    return {
      count: vids.length,
      states: vids.slice(0, 6).map((v) => ({
        src: (v.currentSrc || v.getAttribute("src") || "").split("/").pop() ?? "",
        readyState: v.readyState,
        paused: v.paused,
        currentTime: Number(v.currentTime.toFixed(2)),
      })),
    };
  });

  console.log("\n===== CI ENVIRONMENT PROBE =====");
  console.log("env    ", JSON.stringify(env));
  console.log("clock  ", JSON.stringify(clock));
  console.log("video  ", JSON.stringify(video));
  console.log("rAF    ", JSON.stringify(raf));
  console.log("mounted", JSON.stringify(mounted));
  console.log("console errors:", consoleErrors.length ? JSON.stringify(consoleErrors.slice(0, 5)) : "none");
  console.log("================================\n");

  /* The only real assertion: everything above is meaningless if the app never
     rendered the member shell. */
  await expect(page.locator("main h1").first()).toBeVisible();
});
