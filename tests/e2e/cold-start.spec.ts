import { test, expect, type Page } from "@playwright/test";

/**
 * COLD START — what a member sees in the first seconds, and what it costs.
 *
 * Before this guard the shell was server-rendered from store DEFAULTS: every
 * cold open painted the Apex room with numbers that were not the member's
 * ("Protein 0 / 176 g", "Readiness · Evidence needed"), held them for several
 * seconds, and only then swapped to the member's real room. And every one of
 * the 35 rooms shipped in the first chunk, so nothing was tappable until all
 * of it had been parsed.
 *
 * The contract these tests hold:
 *   1. The server sends no room and no member numbers — only the restoration
 *      screen. Nothing the member did not give is ever painted.
 *   2. The first room ever painted is the member's own room, not Apex.
 *   3. The room's gold action is enabled, not a dead placeholder, and gets
 *      there inside a budget.
 *   4. Rooms are separate chunks: opening Apex must not download the rooms
 *      the member is not in.
 *
 * These run against the dev server, which is 2-3x slower than production and
 * shares this machine, so the time budget is deliberately loose: it is here to
 * catch a structural regression (the whole app back in one chunk), not to
 * measure performance. Real numbers come from the production harness.
 */

const KEY = "final-boss-athlete-settings";

/** Apex's own copy. If this shows while the member's room is elsewhere, the room was guessed. */
const APEX_ONLY = /Private performance briefing/i;
/** Member-shaped numbers that must never reach the browser from the server.
    Word-bounded: React's own `suppressHydrationWarning` is in every document. */
const SERVER_MUST_NOT_SEND = [/\bReadiness\b/i, /\bProtein\b/i, /\bHydration\b/i, /Evidence needed/i, /Apex Command/i];

/** Records what is actually painted, from before the first frame. */
async function watchPaint(page: Page, view: string) {
  await page.addInitScript(
    ({ k, v }) => {
      window.localStorage.setItem("fba-preview-view", v);
      const raw = window.localStorage.getItem(k);
      const parsed = raw ? JSON.parse(raw) : { state: {}, version: 0 };
      parsed.state = {
        ...parsed.state,
        activeView: v,
        onboarding: { ...(parsed.state.onboarding || {}), status: "complete", currentStep: 99, startedAt: "2026-09-01T12:00:00.000Z" },
      };
      window.localStorage.setItem(k, JSON.stringify(parsed));

      const seen: { at: number; text: string }[] = [];
      (window as unknown as { __coldStart: { seen: typeof seen; firstRoom: string | null } }).__coldStart = { seen, firstRoom: null };
      const tick = () => {
        const record = (window as unknown as { __coldStart: { seen: typeof seen; firstRoom: string | null } }).__coldStart;
        const main = document.querySelector("main");
        if (main) {
          const text = (main.innerText || "").replace(/\s+/g, " ").trim();
          if (text && (!seen.length || seen[seen.length - 1].text !== text)) seen.push({ at: Math.round(performance.now()), text });
          /* The restoration screen is not a room: it renders inside the
             shared threshold, so its own heading is skipped here. */
          const h1 = [...document.querySelectorAll("main h1")].find(
            (n) => n.getBoundingClientRect().height > 0 && !n.closest("[data-threshold]"),
          );
          if (h1 && !record.firstRoom) record.firstRoom = (h1 as HTMLElement).innerText.trim();
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    },
    { k: KEY, v: view },
  );
}

test.describe("cold start", () => {
  test("the server sends the restoration screen, never a room built from defaults", async ({ page }) => {
    const res = await page.request.get("/");
    const html = await res.text();
    expect(html).toContain("Restoring your Reserve profile");
    for (const forbidden of SERVER_MUST_NOT_SEND) {
      expect(html, `server HTML must not carry ${forbidden}`).not.toMatch(forbidden);
    }
  });

  test("the first room painted is the member's own room, not Apex", async ({ page }) => {
    /* First pass: let the app write its own persisted state for this profile. */
    await page.goto("/", { waitUntil: "domcontentloaded", timeout: 120_000 });
    await page.locator("main h1").first().waitFor({ timeout: 120_000 });

    await watchPaint(page, "nutrition");
    await page.reload({ waitUntil: "domcontentloaded", timeout: 120_000 });
    await page.getByRole("heading", { level: 1, name: /nutrition command/i }).waitFor({ timeout: 120_000 });

    const record = await page.evaluate(
      () => (window as unknown as { __coldStart: { seen: { at: number; text: string }[]; firstRoom: string | null } }).__coldStart,
    );

    expect(record.firstRoom, "the first room heading painted").toMatch(/nutrition command/i);
    const apexFrames = record.seen.filter((s) => APEX_ONLY.test(s.text));
    expect(apexFrames.map((s) => `${s.at}ms`), "Apex must never paint while the member's room is Fuel").toEqual([]);
  });

  test("the room's gold action arrives enabled, inside the budget", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded", timeout: 120_000 });
    await page.locator("main h1").first().waitFor({ timeout: 120_000 });

    await page.addInitScript(
      ({ k, v }) => {
        window.localStorage.setItem("fba-preview-view", v);
        const raw = window.localStorage.getItem(k);
        const parsed = raw ? JSON.parse(raw) : { state: {}, version: 0 };
        parsed.state = { ...parsed.state, activeView: v };
        window.localStorage.setItem(k, JSON.stringify(parsed));
      },
      { k: KEY, v: "nutrition" },
    );
    const started = Date.now();
    await page.reload({ waitUntil: "domcontentloaded", timeout: 120_000 });

    const gold = page.locator('[data-nutrition="primary-action"] button').first();
    await expect(gold).toBeEnabled({ timeout: 30_000 });
    const elapsed = Date.now() - started;
    /* Loose on purpose — see the file header. A regression that puts the whole
       app back in one chunk lands well past this. */
    expect(elapsed, `gold action took ${elapsed}ms`).toBeLessThan(30_000);
  });

  test("a member in Apex does not download the rooms they are not in", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded", timeout: 120_000 });
    await page.locator("main h1").first().waitFor({ timeout: 120_000 });

    const chunkUrls: string[] = [];
    page.on("request", (r) => {
      if (/\.js(\?|$)/.test(r.url())) chunkUrls.push(r.url());
    });
    await page.reload({ waitUntil: "domcontentloaded", timeout: 120_000 });
    await page.locator("main h1").first().waitFor({ timeout: 120_000 });
    await page.waitForTimeout(2_500);

    /* Dev chunk names carry their source path, so the rooms a member is not in
       are visible by name. Production hashes them; the structural guard for
       that build is the ViewRouter unit test. */
    const strangers = chunkUrls.filter((u) =>
      /CycleCommandView|FertilityCommandView|PregnancyCommandView|MesocyclePlannerView|CommunityView|CoachCommandShell/.test(u),
    );
    expect(strangers, "rooms outside Apex must not load with it").toEqual([]);
  });
});
