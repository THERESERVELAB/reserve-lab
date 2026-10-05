import { test, expect, type Page } from "@playwright/test";

/**
 * LOG MOMENTS — every member log lands through the shell's one LogMomentHost.
 *
 *   · sleep (full): the words, the nights in a row, the light drawn behind the
 *     plate, the polite announcement
 *   · water (mark): a quiet mark, no flow and no boom; the glass that reaches
 *     the member's own target is the full moment with its milestone
 *   · weight (full): neutral words only, the value and nothing about the last
 *     weigh-in, whichever way the number went
 *   · the day's check-in: seven days in a row is the milestone
 *   · a timeline note (the member's journal): "Note saved"
 *   · a compound mark: "Logged", a mark, no milestone
 *   · reduced motion: the words and a still check; nothing animated or drawn
 *   · at 390: the plate sits above the tab bar, covers no control and takes no
 *     clicks, and nothing scrolls sideways
 */

const KEY = "final-boss-athlete-settings";
const DESKTOP = { width: 1280, height: 800 };
const PHONE = { width: 390, height: 844 };

type Patch = (s: Record<string, any>, day: (offset: number) => string) => void; // eslint-disable-line @typescript-eslint/no-explicit-any

async function boot(page: Page, view: string, patch: Patch) {
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
      return Boolean(state?.recoveryCommand && state?.physiqueCommand && state?.engagement && state?.trainingSession);
    },
    KEY,
    { timeout: 60_000 },
  );
  const seeded = await page.evaluate(
    ({ k, v, src }) => {
      const pad = (n: number) => String(n).padStart(2, "0");
      const day = (offset: number) => {
        const d = new Date();
        d.setDate(d.getDate() + offset);
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      };
      const parsed = JSON.parse(window.localStorage.getItem(k) as string);
      parsed.state.activeView = v;
      new Function("s", "day", `(${src})(s, day);`)(parsed.state, day);
      return JSON.stringify(parsed);
    },
    { k: KEY, v: view, src: patch.toString() },
  );
  await page.addInitScript(({ k, v }) => window.localStorage.setItem(k, v), { k: KEY, v: seeded });
  await page.reload({ waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.locator("main h1").first().waitFor({ timeout: 120_000 });
}

/** Wait until React has wired a control, so the first click is not lost to hydration. */
async function wired(page: Page, locator: ReturnType<Page["locator"]>) {
  await expect(locator).toBeVisible({ timeout: 60_000 });
  await expect
    .poll(() => locator.evaluate((el) => Object.keys(el).some((key) => key.startsWith("__reactProps"))), { timeout: 60_000 })
    .toBe(true);
}

const status = (page: Page) => page.locator('[data-log-moment="status"]');
const announcer = (page: Page) => page.locator('[data-log-moment="announcer"]');

const RECOVERY_BASE: Patch = (s, day) => {
  s.recoveryCommand = {
    ...s.recoveryCommand,
    sleepTargetHours: 8,
    hydrationTargetOz: 120,
    sleepLogs: [1, 2, 3, 4].map((d) => ({ date: day(-d), hours: 7.2 })),
    hydrationLogs: [],
    mobilityLogs: [],
    stressCheckIns: [],
  };
};

/** Log-moment animations still running: tagged Web Animations, and anything inside the moment's layer. */
const runningMomentAnimations = (page: Page) =>
  page.evaluate(() =>
    document
      .getAnimations()
      .filter((a) => {
        if (a.playState !== "running") return false;
        const target = (a.effect as KeyframeEffect | null)?.target as Element | null;
        return String(a.id).startsWith("log-moment") || Boolean(target?.closest("[data-log-moment]"));
      })
      .map((a) => a.id || "animation"),
  );

/** The plate covers no visible button or slider, and takes no clicks. */
async function expectPlateClear(page: Page) {
  const report = await page.evaluate(() => {
    const plate = document.querySelector('[data-log-moment="status"]') as HTMLElement | null;
    if (!plate) return { present: false, pointer: "", covered: [] as string[] };
    const p = plate.getBoundingClientRect();
    const covered = Array.from(document.querySelectorAll<HTMLElement>('main button, main [role="slider"], [data-shell="bottom-stack"] button'))
      .filter((b) => {
        const r = b.getBoundingClientRect();
        if (r.width === 0 || r.height === 0 || r.bottom <= 0 || r.top >= window.innerHeight) return false;
        /* Controls hidden under the sticky top bar are not on screen. */
        const header = document.querySelector("header")?.getBoundingClientRect();
        if (header && r.bottom <= header.bottom) return false;
        return r.left < p.right && r.right > p.left && r.top < p.bottom && r.bottom > p.top;
      })
      .map((b) => b.getAttribute("aria-label") || b.textContent?.trim() || "control");
    return { present: true, pointer: getComputedStyle(plate).pointerEvents, covered };
  });
  expect(report.present, "the plate shows").toBe(true);
  expect(report.pointer, "the plate takes no clicks").toBe("none");
  return report.covered;
}

async function logSleep(page: Page) {
  const asleep = page.getByRole("slider", { name: /Fell asleep/ });
  await asleep.waitFor({ timeout: 120_000 });
  await asleep.scrollIntoViewIfNeeded();
  await asleep.fill("270");
  await page.getByRole("slider", { name: /Woke up/ }).fill("240");
  const save = page.getByRole("button", { name: "Save Sleep" });
  await wired(page, save);
  await save.click();
}

const PRAISE_OR_DIRECTION = /\b(down|up|lost|loss|gain(ed)?|great|nice|good|better|worse|progress|healthy|safe|improv\w*)\b|!|[+-]\s?\d+(\.\d+)?\s?lb/i;

test.describe("log moments · full motion", () => {
  test.use({ viewport: DESKTOP });

  test("sleep lands in full: the words, the run of nights, the light and the announcement", async ({ page }) => {
    test.setTimeout(240_000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await boot(page, "recovery", RECOVERY_BASE);
    await logSleep(page);

    await expect(status(page)).toHaveCount(1);
    await expect(status(page)).toHaveAttribute("data-kind", "sleep");
    await expect(status(page)).toHaveAttribute("data-tier", "full");
    await expect(page.locator('[data-log-moment="lead"]')).toHaveText("Sleep logged");
    await expect(page.locator('[data-log-moment="detail"]')).toHaveText(/^7\.5 h · 5 nights in a row$/i);
    await expect(page.locator('[data-log-moment="canvas"]')).toHaveCount(1);
    await expect(announcer(page)).toHaveText("Sleep logged. 7.5 h · 5 nights in a row.");
    /* The shell's one-word line stays quiet: the moment says it once. */
    await expect(page.locator('[data-signal="announcer"]')).toHaveText("");
    expect(await expectPlateClear(page)).toEqual([]);

    /* It cleans up and leaves on its own. */
    await expect(page.locator('[data-log-moment="canvas"]')).toHaveCount(0, { timeout: 4_000 });
    await expect(status(page)).toHaveCount(0, { timeout: 6_000 });
    expect(errors).toEqual([]);
  });

  test("a glass of water is a quiet mark; the glass that reaches the target is the full milestone", async ({ page }) => {
    test.setTimeout(240_000);
    await boot(page, "recovery", (s, day) => {
      s.recoveryCommand = {
        ...s.recoveryCommand,
        hydrationTargetOz: 120,
        sleepLogs: [0, 1, 2, 3, 4].map((d) => ({ date: day(-d), hours: 7.2 })),
        hydrationLogs: [{ date: day(0), oz: 88 }],
        mobilityLogs: [],
        stressCheckIns: [],
      };
    });
    const add = page.getByRole("button", { name: /^\+ log 16 oz$/i }).filter({ visible: true }).first();
    await add.scrollIntoViewIfNeeded();
    await wired(page, add);

    await add.click();
    await expect(status(page)).toHaveAttribute("data-tier", "mark");
    await expect(status(page)).toHaveAttribute("data-milestone", "");
    await expect(page.locator('[data-log-moment="lead"]')).toHaveText("Water logged");
    await expect(page.locator('[data-log-moment="detail"]')).toHaveText(/^\+16 oz · 104 of 120 oz today$/i);
    await expect(announcer(page)).toHaveText("Water logged. +16 oz · 104 of 120 oz today.");
    /* A mark never flows or booms. */
    await page.waitForTimeout(900);
    await expect(page.locator('[data-log-moment="canvas"]')).toHaveCount(0);
    await expect(page.locator('[data-log-moment="bloom"]')).toHaveCount(0);

    /* The next glass reaches the member's own target: the full moment, and a new log replaces the old one cleanly. */
    await add.click();
    await expect(status(page)).toHaveCount(1);
    await expect(status(page)).toHaveAttribute("data-milestone", "hydration-target");
    await expect(status(page)).toHaveAttribute("data-tier", "full");
    await expect(page.locator('[data-log-moment="headline"]')).toHaveText("Hydration target reached.");
    await expect(page.locator('[data-log-moment="canvas"]')).toHaveCount(1);
    await expect(announcer(page)).toContainText("Hydration target reached.");
  });

  test("weight words are neutral whichever way the number went", async ({ page }) => {
    test.setTimeout(240_000);
    await boot(page, "measurements", (s, day) => {
      s.physiqueCommand = { ...s.physiqueCommand, entries: [{ id: "seed-1", date: day(-7), bodyWeightLb: 190.4, measurements: { waist: 33 } }], photoCheckIns: [] };
    });
    for (const weight of ["188.1", "192.6"]) {
      const open = page.getByRole("button", { name: "Log Measurements" }).filter({ visible: true }).first();
      await wired(page, open);
      await open.click();
      const dialog = page.getByRole("dialog");
      await dialog.getByPlaceholder("e.g. 185.2").fill(weight);
      await dialog.getByRole("button", { name: "Save Check-In" }).click();
      await expect(dialog).toHaveCount(0);

      await expect(status(page)).toHaveAttribute("data-kind", "weight");
      await expect(page.locator('[data-log-moment="lead"]')).toHaveText("Weight logged");
      await expect(page.locator('[data-log-moment="detail"]')).toHaveText(new RegExp(`^${weight.replace(".", "\\.")} lb · 2 weeks in a row$`, "i"));
      const words = `${await status(page).innerText()} ${await announcer(page).innerText()}`;
      expect(words, "no praise, direction or change in the weight words").not.toMatch(PRAISE_OR_DIRECTION);
      await expect(status(page)).toHaveCount(0, { timeout: 6_000 });
    }
  });

  test("the day's check-in: seven days in a row is the milestone", async ({ page }) => {
    test.setTimeout(240_000);
    await boot(page, "dashboard", (s, day) => {
      s.engagement = { ...s.engagement, currentStreak: 6, bestStreak: 6, lastCheckInDate: day(-1) };
    });
    const disclosure = page.locator("summary", { hasText: "Consistency" }).first();
    await disclosure.scrollIntoViewIfNeeded();
    await wired(page, disclosure);
    await disclosure.click();
    const mark = page.getByRole("button", { name: "Mark Today as Checked In" });
    await wired(page, mark);
    await mark.click();

    await expect(status(page)).toHaveAttribute("data-milestone", "streak-7");
    await expect(page.locator('[data-log-moment="headline"]')).toHaveText("7 days in a row.");
    await expect(page.locator('[data-log-moment="lead"]')).toHaveText("Checked in");
    await expect(announcer(page)).toHaveText("Checked in. 7 days in a row.");
    expect(await expectPlateClear(page)).toEqual([]);
  });

  test("a timeline note is the member's journal entry: Note saved", async ({ page }) => {
    test.setTimeout(240_000);
    await boot(page, "supplements", (s) => {
      s.subscriptionTier = "elite";
    });
    const more = page.locator('[data-compound="nav"] button', { hasText: "More" }).first();
    await wired(page, more);
    await more.click();
    await page.locator("li button", { hasText: "Timeline" }).first().click();
    await page.getByRole("button", { name: "Add note" }).first().click();
    await page.getByLabel("Note").fill("Moved training to mornings this week.");
    await page.getByRole("button", { name: "Save note" }).click();

    await expect(status(page)).toHaveAttribute("data-kind", "journal");
    await expect(page.locator('[data-log-moment="lead"]')).toHaveText("Note saved");
    await expect(status(page)).toHaveAttribute("data-milestone", "");
    await expect(announcer(page)).toContainText("Note saved. Timeline");
  });

  test("a filed lab panel is a record, not a result: what was logged and the date, no verdict", async ({ page }) => {
    test.setTimeout(240_000);
    await boot(page, "bloodwork", (s) => {
      s.subscriptionTier = "elite";
    });
    /* The room asks for the safety acknowledgement before it opens the intake. */
    const boxes = page.locator("main input[type=checkbox]");
    const boxCount = await boxes.count();
    if (boxCount > 0) {
      for (let i = 0; i < boxCount; i += 1) await boxes.nth(i).check();
      const acknowledge = page.getByRole("button", { name: "Continue" }).first();
      await wired(page, acknowledge);
      await acknowledge.click();
    }
    const open = page.getByRole("button", { name: "New Lab Record" }).first();
    await wired(page, open);
    await open.click();

    /* The intake is a sheet: the form, and the save, live inside the dialog. */
    const sheet = page.getByRole("dialog", { name: /new lab record/i });
    await expect(sheet).toBeVisible({ timeout: 30_000 });
    await sheet.getByLabel("Test date").fill("2026-03-12");
    await sheet.getByRole("button", { name: /Add Result/i }).click();
    await sheet.getByLabel("Test name").first().fill("Hematocrit");
    await sheet.getByLabel("Result").first().fill("48");
    await sheet.getByRole("button", { name: "Save Lab Record" }).click();

    await expect(status(page)).toHaveAttribute("data-tier", "mark");
    await expect(page.locator('[data-log-moment="lead"]')).toHaveText("Panel logged");
    await expect(page.locator('[data-log-moment="detail"]')).toHaveText("1 marker · Mar 12, 2026");
    await expect(status(page)).toHaveAttribute("data-milestone", "");
    /* The room says what was filed. It never reads the value back, or judges it. */
    await expect(page.locator('[data-log-moment="detail"]')).not.toContainText(/48|hematocrit|high|low|normal/i);
  });

  test("a compound mark is only ever a neutral mark: Logged, no milestone", async ({ page }) => {
    test.setTimeout(240_000);
    await boot(page, "supplements", (s) => {
      const stamp = new Date().toISOString();
      s.subscriptionTier = "elite";
      s.trainingSession = {
        ...s.trainingSession,
        enhancementAdherence: [],
        enhancementLog: [
          {
            id: "e2e-support",
            name: "Creatine",
            officialName: "Creatine Monohydrate",
            category: "supplement",
            doseAmount: "",
            doseUnit: "",
            frequency: "daily",
            timingPreference: "",
            timeOfDayPreference: "custom",
            customTime: "08:00",
            goalAssociation: [],
            isActive: true,
            createdAt: stamp,
            updatedAt: stamp,
          },
        ],
      };
    });
    /* Today's entries are markers now; a marker opens its sheet, and Log Taken lives there. */
    const marker = page.locator("[data-today-entry]", { hasText: "Creatine" }).first();
    await wired(page, marker);
    await marker.click();
    const taken = page.getByRole("dialog", { name: /^Creatine/ }).getByRole("button", { name: /log taken|mark logged/i });
    await wired(page, taken);
    await taken.click();

    await expect(status(page)).toHaveAttribute("data-kind", "compound");
    await expect(status(page)).toHaveAttribute("data-tier", "mark");
    await expect(status(page)).toHaveAttribute("data-milestone", "");
    await expect(page.locator('[data-log-moment="lead"]')).toHaveText("Logged");
    await expect(page.locator('[data-log-moment="headline"]')).toHaveCount(0);
    await expect(page.locator('[data-log-moment="detail"]')).toHaveCount(0);
    await expect(announcer(page)).toHaveText("Logged.");
    await page.waitForTimeout(900);
    await expect(page.locator('[data-log-moment="canvas"]')).toHaveCount(0);
    await expect(page.locator('[data-log-moment="bloom"]')).toHaveCount(0);
  });

  test.describe("at 390", () => {
    test.use({ viewport: PHONE, hasTouch: true, isMobile: true });

    test("the plate sits above the tab bar, covers no control and nothing scrolls sideways", async ({ page }) => {
      test.setTimeout(240_000);
      await boot(page, "recovery", RECOVERY_BASE);
      await logSleep(page);
      await expect(status(page)).toHaveCount(1);
      await expect(page.locator('[data-log-moment="lead"]')).toHaveText("Sleep logged");

      const tabBar = page.locator('[data-shell="bottom-stack"]');
      await expect(tabBar).toBeVisible();
      const plate = await status(page).boundingBox();
      const bar = await tabBar.boundingBox();
      expect(plate && bar && plate.y + plate.height <= bar.y + 1, "the plate clears the tab bar").toBe(true);
      expect(plate && plate.x >= 0 && plate.x + plate.width <= PHONE.width + 1, "the plate fits 390").toBe(true);
      expect(await expectPlateClear(page)).toEqual([]);

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(1);
    });
  });
});

test.describe("log moments · reduced motion", () => {
  test.use({ viewport: DESKTOP });

  test("the words and a still check: nothing animated, drawn or vibrated", async ({ page }) => {
    test.setTimeout(240_000);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addInitScript(() => {
      (window as unknown as { __vibrations: number }).__vibrations = 0;
      navigator.vibrate = () => {
        (window as unknown as { __vibrations: number }).__vibrations += 1;
        return true;
      };
    });
    await boot(page, "recovery", RECOVERY_BASE);
    await logSleep(page);

    await expect(status(page)).toHaveCount(1);
    await expect(page.locator('[data-log-moment="overlay"]')).toHaveAttribute("data-motion", "reduced");
    await expect(page.locator('[data-log-moment="detail"]')).toHaveText(/^7\.5 h · 5 nights in a row$/i);
    await expect(announcer(page)).toContainText("Sleep logged");
    for (const role of ["canvas", "sweep", "bloom"]) await expect(page.locator(`[data-log-moment="${role}"]`)).toHaveCount(0);
    expect(await runningMomentAnimations(page)).toEqual([]);
    await page.waitForTimeout(900);
    expect(await runningMomentAnimations(page)).toEqual([]);
    await expect(page.locator('[data-log-moment="canvas"]')).toHaveCount(0);
    expect(await page.evaluate(() => (window as unknown as { __vibrations: number }).__vibrations)).toBe(0);
  });
});
