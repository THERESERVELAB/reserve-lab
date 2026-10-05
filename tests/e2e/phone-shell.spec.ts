import { test, expect, type Locator, type Page } from "@playwright/test";

/**
 * PHONE SHELL — the native phone shell contract (docs/superpowers/specs/2026-09-15-phone-shell-design.md, PR 1).
 *
 * At 390×844 with touch:
 *   · the document scrolls (no inner scroll box) and window.scrollY moves
 *   · the tab bar navigates all five rooms, marks the active tab with aria-current,
 *     and a room switch lands at the top
 *   · the top bar is one line, ≤ 48px, and never prints a raw view id
 *   · a scrolled page shows the compact room title
 *   · taps have no grey highlight
 *   · More opens a sheet holding the motion pause; the tab bar steps aside meanwhile
 *   · the sheet closes when dragged down from its handle, and springs back from a nudge
 *   · a docked action sits above the tab bar, never under it
 *   · no horizontal overflow
 * At 1440×1000 the desktop shell keeps its fixed frame with <main> scrolling.
 *
 * Seeding is two-phase, as in nutrition-room.spec.ts: the first load lets the app write
 * its own persisted state, and the patch is applied by an init script BEFORE the app
 * boots on reload. No fixed clock: setFixedTime slows framer-motion entry fades.
 */

const KEY = "final-boss-athlete-settings";

async function boot(page: Page, view = "dashboard") {
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

  /* `domcontentloaded`: the dev server's HMR socket keeps networkidle from settling. */
  await page.goto("/", { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.locator("main h1").first().waitFor({ timeout: 120_000 });
  await page.waitForFunction(
    (k) => {
      const raw = window.localStorage.getItem(k);
      const state = raw ? JSON.parse(raw).state : null;
      return Boolean(state?.scheduleProfile && state?.setupProfile);
    },
    KEY,
    { timeout: 30_000 },
  );

  const patched = await page.evaluate((k) => {
    const parsed = JSON.parse(window.localStorage.getItem(k) as string);
    const s = parsed.state;
    const now = new Date().toISOString();
    s.setupProfile = { ...s.setupProfile, setupComplete: true, completedAt: now };
    s.splitSystem = { ...(s.splitSystem || {}), key: "ppl-ul", source: "member", selectedAt: now };
    return JSON.stringify(parsed);
  }, KEY);
  await page.addInitScript(({ k, v }) => window.localStorage.setItem(k, v), { k: KEY, v: patched });
  await page.reload({ waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.locator("main h1").filter({ visible: true }).first().waitFor({ timeout: 120_000 });
  /* The dev server's own indicator floats over the bottom-left corner — the Apex tab —
     and takes the tap. It does not exist in a production build. */
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
}

const visibleH1 = (page: Page) => page.locator("main h1").filter({ visible: true }).first();
const tabBar = (page: Page) => page.getByRole("navigation", { name: "Rooms" });

async function expectNoSidewaysScroll(page: Page, where: string) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `sideways scroll on ${where}`).toBeLessThanOrEqual(1);
}

async function expectOneLineTopBar(page: Page, where: string) {
  const bar = await page.evaluate(() => {
    const header = document.querySelector("header");
    const row = document.querySelector<HTMLElement>('[data-shell="topbar-phone"]');
    const labels = row ? [...row.querySelectorAll<HTMLElement>("span")].filter((s) => s.children.length === 0) : [];
    return {
      height: header?.getBoundingClientRect().height ?? 0,
      text: header?.innerText ?? "",
      tallestLabel: Math.max(0, ...labels.map((s) => s.getBoundingClientRect().height)),
    };
  });
  /* Emulation has no safe-area inset, so the bar is exactly its 48px. */
  expect(bar.height, `top bar height on ${where}`).toBeLessThanOrEqual(48.5);
  expect(bar.tallestLabel, `top bar label is one line on ${where}`).toBeLessThanOrEqual(22);
  expect(bar.text, `top bar text on ${where}`).not.toMatch(/[a-z]+-[a-z]+/i);
}

/**
 * A bottom sheet slides in and is anchored to the bottom, so its header keeps
 * moving for a few frames. Wait until the handle has held still.
 */
async function settledBox(page: Page, locator: Locator) {
  let last = await locator.boundingBox();
  let stable = 0;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    await page.waitForTimeout(50);
    const next = await locator.boundingBox();
    const same = last && next && Math.abs(next.y - last.y) < 0.5 && Math.abs(next.height - last.height) < 0.5;
    stable = same ? stable + 1 : 0;
    last = next;
    if (stable >= 4) return next!;
  }
  return last!;
}

/**
 * `mouse.move(..., { steps })` dispatches every move in one go, and the sheet
 * reads a drag across frames. One move per frame is the same drag, seen.
 */
async function dragBy(page: Page, x: number, y: number, distance: number, steps: number) {
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let step = 1; step <= steps; step += 1) {
    await page.mouse.move(x, y + (distance * step) / steps);
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
}

test.describe("phone shell at 390x844", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("the document scrolls, not a box inside the page", async ({ page }) => {
    await boot(page);

    const layout = await page.evaluate(() => ({
      scrollHeight: document.documentElement.scrollHeight,
      mainOverflowY: getComputedStyle(document.querySelector("main")!).overflowY,
    }));
    expect(layout.scrollHeight).toBeGreaterThan(844);
    expect(layout.mainOverflowY, "<main> is not a scroll container on phones").toBe("visible");

    await page.mouse.move(195, 500);
    await page.mouse.wheel(0, 700);
    await expect.poll(() => page.evaluate(() => window.scrollY), { timeout: 10_000 }).toBeGreaterThan(0);

    /* Once the h1 is under the bar, the compact room title takes over. */
    await page.evaluate(() => window.scrollTo({ top: 900, behavior: "instant" }));
    await expect(page.locator('[data-shell="topbar-phone"] p')).toHaveCSS("opacity", "1", { timeout: 10_000 });
    await expectOneLineTopBar(page, "scrolled Apex");
  });

  test("the tab bar moves between all five rooms and lands each at the top", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (e) => pageErrors.push(e.message));
    await boot(page);

    const bar = tabBar(page);
    await expect(bar).toBeVisible();
    for (const target of await bar.getByRole("button").all()) {
      const box = await target.boundingBox();
      expect(Math.round(box!.height), "tab target height").toBeGreaterThanOrEqual(44);
      expect(Math.round(box!.width), "tab target width").toBeGreaterThanOrEqual(44);
    }

    await expect(bar.getByRole("button", { name: "Apex" })).toHaveAttribute("aria-current", "page");
    await expectOneLineTopBar(page, "Apex");
    await expectNoSidewaysScroll(page, "Apex");

    const rooms = [
      { tab: "Training", label: "Training Command" },
      { tab: "Fuel", label: "Nutrition Command" },
      { tab: "Recovery", label: "Recovery Command" },
      { tab: "Schedule", label: "Schedule Command" },
      { tab: "Apex", label: "Apex Command" },
    ];
    let previousH1 = (await visibleH1(page).innerText()).trim();

    for (const room of rooms) {
      /* Leave the current room scrolled, so the switch has to bring the page back up. */
      await page.evaluate(() => window.scrollTo({ top: 500, behavior: "instant" }));
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);

      const tab = bar.getByRole("button", { name: room.tab, exact: true });
      await tab.click();

      await expect(tab).toHaveAttribute("aria-current", "page");
      await expect(bar.locator('[aria-current="page"]')).toHaveCount(1);
      await expect(page.locator('[data-shell="topbar-phone"]')).toContainText(room.label, { ignoreCase: true });
      await expect.poll(async () => (await visibleH1(page).innerText()).trim(), { timeout: 60_000 }).not.toBe(previousH1);
      previousH1 = (await visibleH1(page).innerText()).trim();

      await expect.poll(() => page.evaluate(() => window.scrollY), { message: `${room.tab} lands at the top` }).toBe(0);
      await expectOneLineTopBar(page, room.tab);
      await expectNoSidewaysScroll(page, room.tab);
    }

    expect(pageErrors.filter((e) => /hydrat/i.test(e))).toEqual([]);
  });

  test("taps have no grey highlight", async ({ page }) => {
    await boot(page);
    const highlight = await tabBar(page)
      .getByRole("button")
      .first()
      .evaluate((el) => getComputedStyle(el).getPropertyValue("-webkit-tap-highlight-color"));
    expect(highlight).toBe("rgba(0, 0, 0, 0)");
  });

  test("a docked action sits above the tab bar", async ({ page }) => {
    await boot(page);
    const dock = page.locator("#reserve-slot-dock");
    await expect(dock.locator("button").first()).toBeVisible({ timeout: 60_000 });
    const dockBox = await dock.boundingBox();
    const barBox = await tabBar(page).boundingBox();
    expect(dockBox!.y + dockBox!.height).toBeLessThanOrEqual(barBox!.y + 1);
    expect(barBox!.y + barBox!.height).toBeLessThanOrEqual(844 + 1);
  });

  test("More holds the other destinations and the motion pause, and drags away", async ({ page }) => {
    await boot(page);

    const more = tabBar(page).getByRole("button", { name: "More" });
    await expect(more).toHaveAttribute("aria-expanded", "false");
    await more.click();

    const sheet = page.getByRole("dialog", { name: "More" });
    await expect(sheet).toBeVisible();
    /* The bar is hidden while the sheet is open, so role queries cannot see it; read the attribute directly. */
    await expect(page.locator('nav[data-shell="tab-bar"] button[aria-haspopup="dialog"]')).toHaveAttribute("aria-expanded", "true");
    await expect(sheet.getByRole("button", { name: /^(Pause|Play) background motion$/ })).toBeVisible({ timeout: 30_000 });
    await expect(sheet.getByRole("button", { name: "Settings" })).toBeVisible();
    /* The five rooms are tabs, not More rows. */
    await expect(sheet.getByRole("button", { name: "Nutrition Command" })).toHaveCount(0);
    /* The tab bar steps out of the sheet's way. */
    await expect(tabBar(page)).toBeHidden();

    const handle = sheet.locator("[data-sheet-drag]");
    /* The sheet is still sliding in, and it is anchored to the bottom: a handle
       box read too early sends the press below the header, where the sheet never
       sees the gesture and simply stays open. */
    const box = (await settledBox(page, handle))!;
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;

    /* A nudge springs back. */
    await dragBy(page, x, y, 12, 4);
    await page.waitForTimeout(400);
    await expect(sheet).toBeVisible();

    /* A real drag dismisses. */
    await dragBy(page, x, y, 320, 12);
    await expect(sheet).toHaveCount(0, { timeout: 5_000 });
    await expect(tabBar(page)).toBeVisible();

    /* More leads somewhere real. */
    await more.click();
    await page.getByRole("dialog", { name: "More" }).getByRole("button", { name: "Settings" }).click();
    await expect(page.getByRole("dialog", { name: "More" })).toHaveCount(0);
    await expect(page.locator('[data-shell="topbar-phone"]')).toContainText("Settings", { ignoreCase: true });
    await expect(more).toHaveAttribute("data-active", "true");
    await expectNoSidewaysScroll(page, "Settings");
  });
});

test.describe("desktop shell at 1440x1000", () => {
  test.use({ viewport: { width: 1440, height: 1000 } });

  test("keeps its fixed frame with <main> scrolling and no tab bar", async ({ page }) => {
    await boot(page);
    const layout = await page.evaluate(() => ({
      scrollHeight: document.documentElement.scrollHeight,
      mainOverflowY: getComputedStyle(document.querySelector("main")!).overflowY,
      headerHeight: document.querySelector("header")!.getBoundingClientRect().height,
    }));
    expect(layout.scrollHeight).toBeLessThanOrEqual(1001);
    expect(layout.mainOverflowY).toBe("auto");
    expect(layout.headerHeight).toBe(52);
    await expect(tabBar(page)).toBeHidden();
    await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Toggle sidebar" })).toBeVisible();
  });
});
