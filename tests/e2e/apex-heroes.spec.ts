import { test, expect, type Page } from "@playwright/test";

import { SAFETY_ACK_VERSION } from "../../src/lib/safety/acknowledgement";
import { goldActions } from "./support/gold-action";
import { BROAD_RULE, nestedSurfaces } from "./support/surface-nesting";

/**
 * APEX · YOUR COMPOUNDS — the member's main compounds and their cycle week.
 *
 * Owner, 2026-09-18: "Make the hero compounds also show on my Apex dashboard
 * as well … The system should know I'm on week 1 and when week 1 started."
 *
 * The owner's own case on Friday 18 September 2026, 3:30 PM: cycle "Winter
 * Recomp Blast" set to start Sep 22 for 12 weeks, linked to Testosterone
 * Enanthate (Tue/Fri, IM, started Sep 16), Somatropin and Drostanolone
 * Enanthate — plus four add-ons.
 *
 *   · the three main compounds render on Apex, in time order; add-ons never do
 *   · a tile opens the same Today sheet; logging from Apex updates Compound
 *     Command too, with the neutral "Logged" moment
 *   · the cycle reads exactly as the member set it ("Starts Sep 22 · in 4
 *     days") — never inferred from Testosterone Enanthate's own Sep 16 start.
 *     Owner: "CLIENT CHOOSES WHEN IT STARTS!" "Edit start" opens a date field;
 *     the date the member picks is the only source of the week number, and it
 *     persists and lands in the change history
 *   · one h1, one gold, no card in a card, 44px targets, phone fit
 */

const KEY = "final-boss-athlete-settings";
/** Friday 18 September 2026, 3:30 PM local. */
const WHEN = new Date(2026, 8, 18, 15, 30, 0);
const DAY = "2026-09-18";
const STAMP = "2026-09-10T12:00:00.000Z";

type Seed = { heroes?: boolean; acknowledged?: boolean; view?: string };

function ownerSeed({ heroes = true, acknowledged = true }: Seed = {}) {
  const e = (id: string, name: string, extra: Record<string, unknown>) => ({
    id, name, doseAmount: "", doseUnit: "", frequency: "daily", frequencyType: "daily", scheduleRule: { type: "daily" },
    timingPreference: "", timeOfDayPreference: "custom", goalAssociation: [], isActive: true, createdAt: STAMP, updatedAt: STAMP, ...extra,
  });
  const sup = (id: string, name: string, time: string, extra: Record<string, unknown> = {}) =>
    e(id, name, { category: "supplement", compoundClass: "supplements", route: "oral", customTime: time, ...extra });
  const heroEntries = [
    e("h-test", "Testosterone Enanthate", {
      officialName: "Testosterone Enanthate", compoundClass: "hormones_testosterone", category: "hormone", route: "injectable", injectionType: "im",
      customTime: "16:00", frequency: "specific_days", frequencyType: "specific_days", daysOfWeek: [2, 5], scheduleRule: { type: "specific_days", daysOfWeek: [2, 5] },
      startDate: "2026-09-16", amountPerLogMg: 250,
    }),
    e("h-gh", "Somatropin", { compoundClass: "growth_hormone", category: "peptide", route: "injectable", injectionType: "subq", customTime: "07:00" }),
    e("h-mast", "Drostanolone Enanthate", {
      compoundClass: "aas", category: "hormone", route: "injectable", injectionType: "im", customTime: "16:00",
      frequency: "specific_days", frequencyType: "specific_days", daysOfWeek: [1, 4], scheduleRule: { type: "specific_days", daysOfWeek: [1, 4] },
    }),
  ];
  return {
    state: {
      subscriptionTier: "elite",
      onboarding: { status: "complete", currentStep: 99, startedAt: STAMP },
      setupProfile: { age: 34, setupComplete: true, completedAt: STAMP },
      safetyAcknowledgement: acknowledged ? { acknowledgedAt: STAMP, version: SAFETY_ACK_VERSION, adultConfirmedAt: STAMP } : null,
      cyclePeriods: [
        {
          id: "cyc-owner", name: "Winter Recomp Blast", startDate: "2026-09-22", plannedWeeks: 12, compoundIds: ["h-test", "h-gh", "h-mast"],
          clinicianOversight: false, checkpoints: [], notes: "TEST + MAST + HGH 12 WEEKS", createdAt: STAMP, updatedAt: STAMP,
        },
      ],
      changeHistory: [],
      trainingSession: {
        enhancementLog: [
          ...(heroes ? heroEntries : []),
          sup("a-fish", "Fish Oil", "08:00"),
          sup("a-d3", "Vitamin D3", "08:00", { category: "vitamin", compoundClass: "vitamins" }),
          sup("a-creatine", "Creatine", "16:00"),
          sup("a-mag", "Magnesium", "21:00"),
        ],
        enhancementAdherence: heroes
          ? [{ id: "adh-gh", entryId: "h-gh", date: DAY, plannedTime: "07:00", takenStatus: "taken", actualTime: "07:05", createdAt: STAMP }]
          : [],
        injectionLogs: heroes
          ? [{ id: "inj-gh", entryId: "h-gh", date: DAY, time: "07:05", site: "Left abdomen", route: "injectable", injectionType: "subq", createdAt: STAMP }]
          : [],
        compoundSupportLinks: [],
        schedulePlan: { wakeTime: "06:30", sleepTime: "22:30", workoutTime: "17:30" },
      },
    },
    version: 0,
  };
}

async function boot(page: Page, seed: Seed = {}) {
  await page.clock.setFixedTime(WHEN);
  await page.addInitScript(
    ({ k, v, view }) => {
      /* Seed once: a reload must read what the member saved, not the seed again. */
      if (window.sessionStorage.getItem("apex-heroes-seeded")) return;
      window.sessionStorage.setItem("apex-heroes-seeded", "1");
      window.localStorage.setItem("fba-preview-view", view);
      window.localStorage.setItem(k, v);
    },
    { k: KEY, v: JSON.stringify(ownerSeed(seed)), view: seed.view ?? "dashboard" },
  );
  await page.goto("/", { waitUntil: "domcontentloaded", timeout: 120_000 });
  /* The dev server's issue badge sits over a phone sheet's footer; it does not exist in production. */
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await expect(page.locator('[data-apex="next-move-title"]').filter({ visible: true }).first()).toBeVisible({ timeout: 120_000 });
}

const row = (page: Page) => page.locator('[data-apex="heroes"]');
const tiles = (page: Page) => row(page).locator("[data-apex-hero]");
const tile = (page: Page, name: string) => tiles(page).filter({ hasText: name }).first();
const cycleLine = (page: Page) => page.locator('[data-apex="cycle-line"]');

async function wired(locator: ReturnType<Page["locator"]>) {
  await expect(locator).toBeVisible({ timeout: 60_000 });
  await expect.poll(() => locator.evaluate((el) => Object.keys(el).some((key) => key.startsWith("__reactProps"))), { timeout: 60_000 }).toBe(true);
}

for (const vp of [
  { name: "1280", width: 1280, height: 900, touch: false },
  { name: "390", width: 390, height: 844, touch: true },
  { name: "375", width: 375, height: 812, touch: true },
] as const) {
  test.describe(`apex heroes at ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.touch, isMobile: vp.touch });

    test("the main compounds lead on Apex in time order; add-ons never appear; the bar holds", async ({ page }) => {
      test.setTimeout(240_000);
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
      await boot(page);

      await expect(tiles(page)).toHaveCount(3);
      const texts = await tiles(page).allInnerTexts();
      expect(texts.map((t) => t.match(/Somatropin|Testosterone Enanthate|Drostanolone Enanthate/)?.[0])).toEqual([
        "Somatropin", "Testosterone Enanthate", "Drostanolone Enanthate",
      ]);
      for (const addOn of ["Fish Oil", "Vitamin D3", "Creatine", "Magnesium"]) await expect(row(page)).not.toContainText(addOn);

      /* Compound Command's own state words and the member's own times; no amounts on Apex. */
      await expect(tile(page, "Somatropin")).toHaveAttribute("data-state", "logged");
      await expect(tile(page, "Somatropin")).toContainText(/Logged/i);
      await expect(tile(page, "Testosterone Enanthate")).toHaveAttribute("data-up-next", "true");
      await expect(tile(page, "Testosterone Enanthate")).toContainText(/Due\s*4:00 PM/i);
      await expect(tile(page, "Testosterone Enanthate")).toHaveAttribute("aria-label", "Testosterone Enanthate · Up next · Due · 4:00 PM");
      await expect(tile(page, "Drostanolone Enanthate")).toHaveAttribute("data-state", "not-today");
      await expect(tile(page, "Drostanolone Enanthate")).toContainText(/Next\s*Mon/i);
      await expect(row(page)).not.toContainText(/\bmg\b|mcg|units|\bml\b/i);

      /* The cycle exactly as the member set it — nothing inferred from a compound's own start date. */
      await expect(cycleLine(page)).toHaveAttribute("data-cycle-kind", "upcoming");
      await expect(cycleLine(page)).toHaveText("Starts Sep 22 · in 4 days");
      await expect(row(page)).not.toContainText(/Sep 16|Start cycle on/i);
      await expect(row(page).getByRole("button", { name: "Edit start" })).toBeVisible();

      /* One h1, one gold, no card in a card, no sideways scroll. */
      await expect(page.locator("main h1").filter({ visible: true })).toHaveCount(1);
      const gold = await goldActions(page, { selector: "button", match: "text" });
      expect(gold, `gold actions: ${gold.join(" | ")}`).toHaveLength(1);
      expect(await nestedSurfaces(page.locator("main"), BROAD_RULE, { exclude: '[data-enhanced-room="apex"]' }), "nested surfaces").toEqual([]);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(1);

      /* Every tile and the control are named 44px targets. */
      const small = await row(page).locator("button").evaluateAll((els) =>
        els.filter((el) => { const r = el.getBoundingClientRect(); return r.height < 44 || r.width < 44 || !(el.getAttribute("aria-label") || el.textContent?.trim()); }).map((el) => el.textContent),
      );
      expect(small, "targets under 44px or unnamed").toEqual([]);

      /* Phone: the tiles sit in one row inside the gutter, and scroll clear of the docked action. */
      if (vp.touch) {
        const boxes = await tiles(page).evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON() as DOMRect));
        expect(Math.max(...boxes.map((b) => b.y)) - Math.min(...boxes.map((b) => b.y)), "one row").toBeLessThanOrEqual(1);
        const gutter = (await page.locator("main h1").first().boundingBox())!.x;
        for (const b of boxes) expect(b.x + b.width).toBeLessThanOrEqual(vp.width - gutter + 1);
        await row(page).evaluate((el) => el.scrollIntoView({ block: "end", behavior: "instant" }));
        const bar = await page.locator(".fba-so-action").filter({ visible: true }).first().boundingBox();
        const rowBox = (await row(page).boundingBox())!;
        expect(rowBox.y + rowBox.height, "the row scrolls clear of the docked action").toBeLessThanOrEqual(bar!.y + 1);
        await expect(page.locator('[data-apex="next-move-title"]').filter({ visible: true }).first()).toBeVisible();
      }
      expect(errors.filter((e) => !/Download the React DevTools/.test(e)), "console errors").toEqual([]);
    });
  });
}

test.describe("apex heroes · actions", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("logging a main compound from Apex runs the same log and shows in Compound Command", async ({ page }) => {
    test.setTimeout(240_000);
    await boot(page);
    const testE = tile(page, "Testosterone Enanthate");
    await wired(testE);
    await testE.click();
    const sheet = page.getByRole("dialog", { name: "Testosterone Enanthate" });
    await expect(sheet).toBeVisible();
    /* The member's own planned amount stays inside the sheet. */
    await expect(sheet).toContainText("250 mg");
    /* An injectable's Log Taken opens the site log, which records the entry too. */
    await sheet.getByRole("button", { name: "Log Taken" }).click();
    const siteLog = page.getByRole("dialog", { name: "Injection log" });
    await expect(siteLog).toBeVisible({ timeout: 60_000 });
    await siteLog.getByRole("button", { name: "Save Site Log" }).click();
    await expect(siteLog).toHaveCount(0);

    await expect(testE).toHaveAttribute("data-state", "logged");
    await expect(testE).toContainText(/Logged/i);
    /* The neutral compound mark: Logged, no milestone, no headline. */
    const status = page.locator('[data-log-moment="status"]');
    await expect(status).toHaveAttribute("data-kind", "compound");
    await expect(status).toHaveAttribute("data-milestone", "");
    await expect(page.locator('[data-log-moment="lead"]')).toHaveText("Logged");
    await expect(page.locator('[data-log-moment="headline"]')).toHaveCount(0);

    /* The same record in Compound Command. */
    const stored = await page.evaluate((k) => JSON.parse(window.localStorage.getItem(k) as string).state.trainingSession, KEY);
    expect(stored.enhancementAdherence.filter((r: { entryId: string; date: string; takenStatus: string }) => r.entryId === "h-test" && r.date === DAY && r.takenStatus === "taken")).toHaveLength(1);
    expect(stored.injectionLogs.filter((r: { entryId: string }) => r.entryId === "h-test")).toHaveLength(1);
    await page.evaluate(() => window.localStorage.setItem("fba-preview-view", "supplements"));
    await page.reload({ waitUntil: "domcontentloaded", timeout: 120_000 });
    await expect(page.locator('[data-compound="heroes"]')).toBeVisible({ timeout: 120_000 });
    await expect(page.locator('[data-today-tier="hero"] [data-today-entry]', { hasText: "Testosterone Enanthate" }).first()).toHaveAttribute("data-state", "logged");
  });

  test("Edit start: the date the member picks is the only source of the week, and it persists", async ({ page }) => {
    test.setTimeout(240_000);
    await boot(page);
    await expect(cycleLine(page)).toHaveText("Starts Sep 22 · in 4 days");
    /* Nothing changed on its own. */
    const before = await page.evaluate((k) => JSON.parse(window.localStorage.getItem(k) as string).state.cyclePeriods[0].startDate, KEY);
    expect(before).toBe("2026-09-22");

    const edit = row(page).getByRole("button", { name: "Edit start" });
    await wired(edit);
    await edit.click();
    const sheet = page.getByRole("dialog", { name: "Cycle start" });
    await expect(sheet).toBeVisible();
    const field = sheet.getByLabel("Start date");
    /* The field opens on the member's own date — nothing proposed. */
    await expect(field).toHaveValue("2026-09-22");
    await field.fill("2026-09-16");
    await sheet.getByRole("button", { name: "Save start date" }).click();
    await expect(sheet).toHaveCount(0);

    await expect(cycleLine(page)).toHaveAttribute("data-cycle-kind", "week");
    await expect(cycleLine(page)).toHaveText("Week 1 of 12 · started Sep 16");

    const saved = await page.evaluate((k) => JSON.parse(window.localStorage.getItem(k) as string).state, KEY);
    expect(saved.cyclePeriods[0].startDate).toBe("2026-09-16");
    expect(saved.cyclePeriods[0].plannedWeeks).toBe(12);
    const event = saved.changeHistory.find((ev: { subject?: { kind: string }; action: string }) => ev.subject?.kind === "cycle" && ev.action === "edited");
    expect(event, "recorded in the change history").toBeTruthy();
    expect(event.changes).toEqual(expect.arrayContaining([expect.objectContaining({ field: "startDate", from: "2026-09-22", to: "2026-09-16" })]));

    await page.reload({ waitUntil: "domcontentloaded", timeout: 120_000 });
    await expect(cycleLine(page)).toHaveText("Week 1 of 12 · started Sep 16", { timeout: 120_000 });

    /* Any date the member chooses, earlier too: the week follows it and nothing else. */
    await wired(row(page).getByRole("button", { name: "Edit start" }));
    await row(page).getByRole("button", { name: "Edit start" }).click();
    await page.getByRole("dialog", { name: "Cycle start" }).getByLabel("Start date").fill("2026-09-01");
    await page.getByRole("dialog", { name: "Cycle start" }).getByRole("button", { name: "Save start date" }).click();
    await expect(cycleLine(page)).toHaveText("Week 3 of 12 · started Sep 1");
  });

  test("without the safety acknowledgement the tiles stay and the cycle line does not", async ({ page }) => {
    test.setTimeout(240_000);
    await boot(page, { acknowledged: false });
    await expect(tiles(page)).toHaveCount(3);
    await expect(cycleLine(page)).toHaveCount(0);
  });

  test("with no main compound logged there is no row at all", async ({ page }) => {
    test.setTimeout(240_000);
    await boot(page, { heroes: false });
    await page.waitForTimeout(800);
    await expect(row(page)).toHaveCount(0);
    await expect(page.getByText("Your compounds", { exact: true })).toHaveCount(0);
  });
});
