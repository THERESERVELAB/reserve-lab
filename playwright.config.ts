import { defineConfig, devices } from "@playwright/test";

/**
 * Minimal local harness for Reserve's own screens. Chromium only, hard-pinned
 * to the LOCAL dev server — never points at a remote or production URL.
 *
 * The port is configurable because this machine runs more than one Next.js
 * project, and 3000 is contended. That contention had two silent failure
 * modes worth naming:
 *
 *   1. `reuseExistingServer` means Playwright attaches to whatever already
 *      answers on this port. With another app there, Reserve's suite would
 *      run against THAT app and report a wall of confusing failures rather
 *      than "wrong server".
 *   2. `next dev` with no explicit port silently auto-increments to 3001 when
 *      3000 is taken, so the server would come up somewhere Playwright was
 *      not waiting, and the run would time out instead.
 *
 * Passing the port explicitly to `next dev` closes both: the server can only
 * come up where the harness is looking, or fail loudly.
 *
 *   RESERVE_E2E_PORT=3100 npx playwright test
 *
 * The HOST stays pinned to 127.0.0.1 — only the port is configurable, so this
 * can never be redirected at a remote or production target.
 */
/* ── One clock, everywhere ────────────────────────────────────────────────
   The specs build their fixed times with the LOCAL-time constructor:

       const NIGHT = new Date(2026, 8, 15, 21, 30, 0);

   That is an absolute instant derived from whatever zone the test process
   happens to be in. On a developer machine in America/New_York it is
   2026-09-16T01:30Z; a GitHub runner is UTC, so the browser renders the same
   instant as 01:30 the NEXT MORNING. "Night" became early morning, "after-
   noon" became evening, and everything keyed to the daypart moved with it:
   which room loop is on screen, which meal window is current, and whether
   the confirmation drawer considers its time changed — a drawer that thinks
   it is dirty ASKS before closing instead of closing, which is why Escape
   appeared not to dismiss it.

   Pinning only the browser is not enough: the Date above is constructed in
   Node, so the two have to agree. TZ is set before anything imports a spec,
   and `timezoneId` gives the page the same zone. UTC is chosen because it is
   the one zone every machine can agree on and has no daylight-saving step.

   This makes the suite read the same clock on every machine. It is set
   unconditionally on purpose — respecting an inherited TZ would reintroduce
   exactly the nondeterminism it exists to remove. */
process.env.TZ = "UTC";

const PORT = process.env.RESERVE_E2E_PORT ?? "3000";
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["html", { open: "never" }]],
  use: {
    baseURL: BASE_URL,
    /* The browser's zone must match the Node process that built the fixed
       times — see "One clock, everywhere" above. */
    timezoneId: "UTC",
    /* On a runner there is no second chance to look: the 27 CI-only failures
       were impossible to diagnose because nothing was kept. A trace and a
       screenshot of the failing moment cost nothing on a green run and are
       the whole story on a red one. Local runs stay clean. */
    trace: process.env.CI ? "retain-on-failure" : "off",
    screenshot: process.env.CI ? "only-on-failure" : "off",
    video: "off",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    // "npm run dev" is package.json's verified local dev command (next dev).
    // The explicit -p pins the server to the port the harness polls.
    command: `npm run dev -- -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
