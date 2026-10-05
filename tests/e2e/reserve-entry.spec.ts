import { test, expect, type Page } from "@playwright/test";

/**
 * The Threshold — Reserve's public, unauthenticated sign-in (ReserveEntry.tsx).
 *
 * No sign-in submission, no password reset, no account creation, no real
 * credentials. Every form interaction here is stopped by client-side
 * validation before anything could reach an auth service.
 *
 * It drives `/dev/entrance` rather than `/`. The entrance only renders at `/`
 * when auth resolves to `signed-out`, and a local dev server runs with
 * Supabase unconfigured — which AppShell treats as local mode, so `/` renders
 * the dashboard instead. The dev route mounts the identical component tree and
 * 404s in production, which makes this suite deterministic without credentials.
 */
const ENTRANCE = "/dev/entrance";
const GOLD = "rgb(213, 177, 95)";

async function open(page: Page, path: string) {
  await page.goto(path, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.getByRole("heading", { name: "RESERVE LAB" }).waitFor({ timeout: 60_000 });
}

const shell = (page: Page) => page.locator('[data-threshold="shell"]');

/* `domcontentloaded` returns before React hydrates, so a click can land on
   markup with no handler yet. Retrying click-and-assert together is the
   deterministic fix; a fixed delay only moves the race. */
async function openEmailPath(page: Page) {
  await expect(async () => {
    await page.getByRole("button", { name: /continue with email/i }).click({ timeout: 2_000 });
    await expect(page.getByPlaceholder("Email address")).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
}

/** Elements inside the threshold that paint glass (a backdrop filter). */
async function glassCount(page: Page) {
  return shell(page).evaluate(
    (root) =>
      Array.from(root.querySelectorAll("*")).filter((el) => {
        const filter = getComputedStyle(el).backdropFilter;
        return Boolean(filter) && filter !== "none";
      }).length,
  );
}

/** Filled gold buttons: the primary tier is the only gradient-filled button. */
async function goldActionCount(page: Page) {
  return shell(page).evaluate(
    (root) =>
      Array.from(root.querySelectorAll("button")).filter((button) => button.style.background.includes("linear-gradient"))
        .length,
  );
}

test("The Threshold renders a usable, compliant sign-in", async ({ page, browser }) => {
  test.setTimeout(300_000);

  await test.step("one h1, the identity and the statement render", async () => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await open(page, ENTRANCE);
    expect(await page.evaluate(() => document.querySelectorAll("h1").length)).toBe(1);
    await expect(page.locator("h1")).toHaveText(/reserve lab/i);
    await expect(page.getByText(/members.{1,2}entrance/i)).toBeVisible();
    await expect(page.getByText("Training, fuel and recovery, read as one brief.")).toBeVisible();
  });

  await test.step("an available provider is a live control and the one gold action", async () => {
    await open(page, `${ENTRANCE}?google=on`);
    const google = page.getByRole("button", { name: /continue with google/i });
    await expect(google).toBeVisible();
    await expect(google).toBeEnabled();
    await expect(google).not.toHaveAttribute("aria-disabled", "true");
    expect(await goldActionCount(page)).toBe(1);
  });

  await test.step("an unavailable provider is removed and email inherits the gold", async () => {
    await open(page, `${ENTRANCE}?google=off`);
    await expect(page.getByRole("button", { name: /continue with google/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /continue with email/i })).toBeVisible();
    expect(await goldActionCount(page)).toBe(1);
  });

  await test.step("the sign-in actions sit inside the first screen", async () => {
    for (const [width, height] of [
      [1440, 1000],
      [390, 844],
      [375, 667],
    ] as const) {
      await page.setViewportSize({ width, height });
      await open(page, `${ENTRANCE}?google=on`);
      for (const name of [/continue with google/i, /continue with email/i]) {
        const box = await page.getByRole("button", { name }).boundingBox();
        expect(box, `${name} at ${width}x${height}`).not.toBeNull();
        expect(box!.y, `${name} top at ${width}x${height}`).toBeGreaterThanOrEqual(0);
        expect(box!.y + box!.height, `${name} bottom at ${width}x${height}`).toBeLessThanOrEqual(height);
      }
    }
  });

  await test.step("no sideways overflow at 1440 and 390, resting or with the glass open", async () => {
    for (const [width, height] of [
      [1440, 1000],
      [390, 844],
    ] as const) {
      await page.setViewportSize({ width, height });
      await open(page, ENTRANCE);
      const measure = () =>
        page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        }));
      const resting = await measure();
      expect(resting.scrollWidth, `resting at ${width}`).toBeLessThanOrEqual(resting.clientWidth);
      await openEmailPath(page);
      const acting = await measure();
      expect(acting.scrollWidth, `email path at ${width}`).toBeLessThanOrEqual(acting.clientWidth);
    }
  });

  await test.step("no card and no glass in the resting state", async () => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await open(page, ENTRANCE);
    await expect(shell(page).locator('[data-threshold="glass"]')).toHaveCount(0);
    expect(await glassCount(page)).toBe(0);
  });

  await test.step("opening the email path brings the glass, visible labels and focus", async () => {
    await openEmailPath(page);
    await expect(shell(page).locator('[data-threshold="glass"]')).toHaveCount(1);
    expect(await glassCount(page)).toBeGreaterThan(0);
    expect(await goldActionCount(page)).toBe(1);

    for (const label of ["Email address", "Password"]) {
      const visibleLabel = shell(page).locator("label", { hasText: new RegExp(`^${label}$`) });
      await expect(visibleLabel).toBeVisible();
      expect((await visibleLabel.boundingBox())!.height).toBeGreaterThan(8);
      await expect(page.getByLabel(label, { exact: true })).toBeVisible();
    }

    const emailInput = page.getByPlaceholder("Email address");
    const passwordInput = page.getByPlaceholder("Password");
    await expect(emailInput).toBeFocused();
    for (const input of [emailInput, passwordInput]) {
      expect(await input.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
    }
  });

  await test.step("errors are announced, tied to their field, and say how to fix them", async () => {
    const emailInput = page.getByPlaceholder("Email address");
    const passwordInput = page.getByPlaceholder("Password");
    const signIn = page.getByRole("button", { name: /^sign in$/i });

    await signIn.click();
    await expect(shell(page).getByRole("alert").first()).toContainText(/enter your email address/i);
    await expect(emailInput).toBeFocused();
    await expect(emailInput).toHaveAttribute("aria-invalid", "true");
    const describedBy = await emailInput.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    await expect(page.locator(`[id="${describedBy}"]`)).toHaveText(/enter your email address/i);

    await emailInput.fill("member@example.com");
    await passwordInput.fill("short");
    await signIn.click();
    await expect(shell(page).getByRole("alert")).toContainText(/at least 8 characters/i);
    await expect(passwordInput).toBeFocused();
    // What the member typed is never cleared by an error.
    await expect(emailInput).toHaveValue("member@example.com");
  });

  await test.step("forgot password is a real 44px control that explains what it needs", async () => {
    const emailInput = page.getByPlaceholder("Email address");
    await emailInput.fill("");
    const forgotPassword = page.getByRole("button", { name: /forgot your password/i });
    await expect(forgotPassword).toBeEnabled();
    expect((await forgotPassword.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    await forgotPassword.click();
    await expect(shell(page).getByRole("alert").first()).toContainText(/enter your email address first/i);
    await expect(emailInput).toBeFocused();
  });

  await test.step("the back control returns to the resting threshold with focus kept", async () => {
    await page.getByRole("button", { name: /back to sign-in options/i }).click();
    await expect(shell(page).locator('[data-threshold="glass"]')).toHaveCount(0);
    await expect(page.getByRole("button", { name: /continue with email/i })).toBeFocused();
  });

  await test.step("keyboard reaches the gold action first, with a visible gold focus ring", async () => {
    await open(page, `${ENTRANCE}?google=on`);
    const google = page.getByRole("button", { name: /continue with google/i });
    for (let i = 0; i < 6 && !(await google.evaluate((el) => el === document.activeElement)); i += 1) {
      await page.keyboard.press("Tab");
    }
    await expect(google).toBeFocused();

    const ring = await google.evaluate((el) => {
      const style = getComputedStyle(el);
      return {
        focusVisible: el.matches(":focus-visible"),
        style: style.outlineStyle,
        width: parseFloat(style.outlineWidth),
      };
    });
    expect(ring.focusVisible).toBe(true);
    expect(ring.style).not.toBe("none");
    expect(ring.width).toBeGreaterThanOrEqual(2);
    /* ReserveButton transitions every property over 200ms, so the ring's
       colour settles to gold a beat after focus lands. */
    await expect.poll(() => google.evaluate((el) => getComputedStyle(el).outlineColor)).toBe(GOLD);

    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: /continue with email/i })).toBeFocused();
  });

  await test.step("the resting threshold stays inside one screen at 1440x900", async () => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, ENTRANCE);
    const overflows = await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight + 1);
    expect(overflows).toBe(false);
  });

  await test.step("a constrained viewport scrolls the document to reach the glass actions", async () => {
    await page.setViewportSize({ width: 375, height: 480 });
    await open(page, ENTRANCE);
    await openEmailPath(page);
    expect(await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight)).toBe(true);
    const signIn = page.getByRole("button", { name: /^sign in$/i });
    await signIn.scrollIntoViewIfNeeded();
    const box = await signIn.boundingBox();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(480);
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  });

  await test.step("the threshold carries no member, health, tier or promise language", async () => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, ENTRANCE);
    const bodyText = await shell(page).innerText();

    // Env var names must never leak into member-facing copy.
    expect(bodyText).not.toMatch(/NEXT_PUBLIC_SUPABASE|SUPABASE_(URL|ANON_KEY|SERVICE_ROLE)/i);
    // No health or compound language on the public page.
    expect(bodyText).not.toMatch(/peptide|testosterone|\bHGH\b|somatropin|injection|dosage|retatrutide|protocol|clinician/i);
    // No outcome promises.
    expect(bodyText).not.toMatch(/guarantee|fully understood|transform/i);
    // No non-public tier words.
    expect(bodyText).not.toMatch(/\b(core|basic|starter|entry|lite|standard|beginner|pro|elite)\b/i);
    // The Reserve Method is a separate property and must not appear here.
    expect(bodyText).not.toMatch(/the reserve method/i);
    // No placeholder legal promise.
    expect(bodyText).not.toMatch(/provided at launch/i);
  });

  await test.step("reduced motion renders a still threshold", async () => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const still = await context.newPage();
    await open(still, ENTRANCE);
    await expect(still.getByRole("heading", { name: "RESERVE LAB" })).toBeVisible();
    await expect
      .poll(() =>
        still.evaluate(
          () =>
            document
              .getAnimations()
              .filter((animation) => animation.playState === "running")
              .filter((animation) => Number(animation.effect?.getComputedTiming().duration ?? 0) > 1).length,
        ),
      )
      .toBe(0);
    await context.close();
  });
});
