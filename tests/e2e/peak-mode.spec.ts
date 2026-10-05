import { test, expect, type Page } from "@playwright/test";

import { SAFETY_ACK_VERSION } from "@/lib/safety/acknowledgement";

/**
 * PEAK MODE — one tap from Compound Command, a member picks lean, dry and hard
 * and gets the day: meals with foods and times, fruit by meal, training,
 * sleep, their own supplements and the limits their compounds make matter.
 */

function dayKey(offset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function boot(page: Page, acknowledged: boolean) {
  const stamp = new Date().toISOString();
  await page.addInitScript(
    ({ stamp, ack, acknowledged, labDate }) => {
      window.localStorage.setItem("fba-preview-view", "supplements");
      const compound = (id: string, name: string, officialName: string) => ({
        id, name, officialName, compoundClass: "aas", category: "hormone", doseAmount: "", doseUnit: "mg", frequency: "", timingPreference: "", goalAssociation: [], isActive: true, createdAt: stamp, updatedAt: stamp,
      });
      window.localStorage.setItem(
        "final-boss-athlete-settings",
        JSON.stringify({
          state: {
            subscriptionTier: "elite",
            onboarding: { status: "complete", currentStep: 99, startedAt: stamp },
            setupProfile: { age: 34 },
            ...(acknowledged ? { safetyAcknowledgement: { acknowledgedAt: stamp, version: ack, adultConfirmedAt: stamp } } : {}),
            trainingSession: { enhancementLog: [compound("e2e-mast", "Masteron", "Drostanolone"), compound("e2e-test-e", "Testosterone Enanthate", "Testosterone Enanthate")] },
            bloodworkLogs: [
              { id: "brief-lab", testDate: labDate, labName: "Quest", createdAt: stamp, markers: [{ name: "Hematocrit", value: "53.1", unit: "%", referenceRange: "38.5-50.0", labFlag: "H", markerKey: "hematocrit" }] },
            ],
          },
          version: 0,
        }),
      );
    },
    { stamp, ack: SAFETY_ACK_VERSION, acknowledged, labDate: dayKey(-10) },
  );
  await page.goto("/", { waitUntil: "domcontentloaded", timeout: 120_000 });
}

test.describe("peak mode", () => {
  test.setTimeout(240_000);

  for (const vp of [{ name: "phone", width: 390, height: 844 }, { name: "desktop", width: 1280, height: 900 }]) {
    test(`pick a look, answer the food questions and get the whole day — ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await boot(page, true);

      await page.getByRole("button", { name: "Enter Peak Mode" }).click({ timeout: 120_000 });
      const sheet = page.getByRole("dialog", { name: "Peak Mode" });
      await expect(sheet).toBeVisible();
      await sheet.getByRole("button", { name: /Lean · dry · hard/ }).click();

      /* The food questions come first. */
      const questions = sheet.getByRole("region", { name: "Build your plates" });
      await expect(questions).toBeVisible();
      await questions.getByRole("group", { name: "Carbs you like" }).getByRole("button", { name: "Sweet potatoes" }).click();
      await questions.getByRole("group", { name: "Proteins you like" }).getByRole("button", { name: "Chicken breast" }).click();
      await questions.getByRole("group", { name: "Foods you don't eat" }).getByRole("button", { name: "Shellfish" }).click();
      await expect(questions.getByRole("button", { name: "Sweet potatoes" })).toHaveAttribute("aria-pressed", "true");
      await questions.getByRole("button", { name: "Build my plates" }).click();

      const meals = sheet.getByRole("region", { name: "Peak Mode meals" });
      await expect(meals).toBeVisible();
      await expect(meals).not.toContainText(/shrimp/i);
      await expect(meals.locator("[data-peak-match]").first()).toContainText(/[0-9]+% match/);
      await expect(meals).toContainText("Match is how closely");
      await expect(meals.locator("[data-peak-day-target]")).toContainText(/Today.s target: [0-9,]+ kcal · \d+P \d+C \d+F/);
      await expect(meals.locator("[data-peak-day-target]")).toContainText(/% of the carbs and \d+% of the fat/);
      /* Plates that fit guidance for the areas Masteron and testosterone affect, labeled with why. */
      await expect(meals).toContainText("areas your compounds affect");
      await expect(meals).toContainText("Food does not offset what a compound does");
      await expect(meals.locator("[data-peak-fit]").first()).toContainText(/Cholesterol|Heart & blood pressure/);

      /* Recipe and swap on breakfast. */
      const breakfast = meals.locator('[data-peak-meal="breakfast"]');
      await breakfast.getByText("Why each item").click();
      await expect(breakfast.locator("[data-peak-purposes]")).toContainText("—");
      await expect(breakfast).toContainText(/Carbs here are|No session today/);
      await breakfast.getByText("Recipe").click();
      await expect(breakfast.locator("ol li").first()).toBeVisible();
      const before = await breakfast.locator("[data-peak-name]").innerText();
      await breakfast.getByRole("button", { name: "Swap this meal" }).click();
      const options = breakfast.getByRole("list", { name: /Swap options/ });
      await expect(options.getByText(/% match/).first()).toBeVisible();
      await options.getByRole("button").first().click();
      await expect(breakfast.locator("[data-peak-name]")).not.toHaveText(before);
      await page.screenshot({ path: `test-results/peak-mode/${vp.name}.png` });

      /* Snacks between meals: on by default, each its own plate, and every one optional. */
      const snackChoice = meals.getByRole("group", { name: "Snacks between meals" });
      const snackRows = meals.locator('[data-peak-meal-id^="peak-snack-"]');
      await expect(snackChoice.getByRole("button", { name: "Mid-morning" })).toHaveAttribute("aria-pressed", "true");
      await expect(snackChoice.getByRole("button", { name: "Afternoon" })).toHaveAttribute("aria-pressed", "true");
      await expect(snackChoice.getByRole("button", { name: "Evening" })).toHaveAttribute("aria-pressed", "false");
      await snackChoice.getByRole("button", { name: "Evening" }).click();
      await expect(snackChoice.getByRole("button", { name: "Evening" })).toHaveAttribute("aria-pressed", "true");
      /* Every chosen snack is served, or the screen says there is no room for it today. */
      const served = await snackRows.count();
      const noRoom = await meals.locator("[data-peak-snack-no-room]").count();
      expect(served + noRoom).toBeGreaterThan(0);
      if (served > 0) {
        const snack = snackRows.first();
        await expect(snack.locator("[data-peak-name]")).not.toHaveText("");
        await expect(snack.getByRole("button", { name: "Swap this meal" })).toBeVisible();
      }
      await page.screenshot({ path: `test-results/peak-mode/${vp.name}-snacks.png` });
      for (const period of ["Mid-morning", "Afternoon", "Evening"]) await snackChoice.getByRole("button", { name: period }).click();
      await expect(snackRows).toHaveCount(0);
      for (const period of ["Mid-morning", "Afternoon"]) await snackChoice.getByRole("button", { name: period }).click();
      await expect(snackChoice.getByRole("button", { name: "Afternoon" })).toHaveAttribute("aria-pressed", "true");

      /* The member's own bowl: built once, then offered for its meal and swappable in. */
      const bowls = sheet.getByRole("region", { name: "Your meals" });
      await bowls.getByRole("button", { name: "Build a meal" }).click();
      const builder = page.getByRole("dialog", { name: "Build a meal" });
      await expect(builder).toBeVisible();
      await builder.getByLabel("Name it").fill("My Daily Cream of Rice");
      await expect(builder.locator("[data-bowl-macros]")).toContainText(/kcal/);
      await builder.getByRole("button", { name: "Add ingredient" }).click();
      await expect(builder.locator("[data-bowl-row]")).toHaveCount(4);
      await builder.getByRole("button", { name: "Save bowl" }).click();
      await expect(builder).toBeHidden();
      await expect(bowls).toContainText("My Daily Cream of Rice");
      expect(await page.evaluate(() => window.localStorage.getItem("final-boss-athlete-settings") ?? "")).toContain('"peakBowls"');

      /* It turns up as an option on breakfast, and swaps in. */
      await breakfast.getByRole("button", { name: /Swap this meal|Keep this plate/ }).click();
      const mine = breakfast.getByRole("list", { name: /Swap options/ }).getByRole("button", { name: /My Daily Cream of Rice/ });
      await expect(mine).toBeVisible();
      await mine.click();
      await expect(breakfast.locator("[data-peak-name]")).toHaveText("My Daily Cream of Rice");
      await page.screenshot({ path: `test-results/peak-mode/${vp.name}-bowl.png` });

      /* The cooking list: today's batch and tomorrow's thaw, each one tickable, kept per day. */
      const tonight = meals.locator("[data-peak-tonight]");
      const jobs = tonight.locator("[data-peak-prep]");
      const count = await jobs.count();
      if (count === 0) {
        await expect(tonight).toContainText("Nothing to cook ahead");
      } else {
        await expect(tonight).toContainText(`0 of ${count} done`);
        await jobs.first().getByRole("checkbox").check();
        await expect(tonight).toContainText(`1 of ${count} done`);
        expect(await page.evaluate(() => window.localStorage.getItem("final-boss-athlete-settings") ?? "")).toContain('"peakPrep"');
        /* The tick is written to the member record, under the day it belongs to. */
        expect(await page.evaluate(() => JSON.parse(window.localStorage.getItem("final-boss-athlete-settings") as string).state.nutritionPrefs.peakPrep.done.length)).toBe(1);
      }
      await page.screenshot({ path: `test-results/peak-mode/${vp.name}-cooking.png` });

      await expect(sheet.getByRole("region", { name: "Peak Mode day" })).toContainText("Field Op in Schedule");
      await expect(sheet.getByRole("region", { name: "Peak Mode watch" })).toContainText("Saturated fat");

      /* The week's menu: Reserve brings the options, the member picks what they eat. */
      await sheet.getByRole("tab", { name: "Menu", exact: true }).click();
      const menu = sheet.getByRole("region", { name: "This week's menu" });
      await expect(menu).toContainText("chosen by you");
      const menuDay = menu.locator("[data-peak-menu-day]").nth(2);
      await menuDay.getByRole("group").first().click();
      const menuMeal = menuDay.locator("[data-peak-menu-meal]").first();
      const chosen = menuMeal.getByRole("button", { name: /kcal/ }).nth(1);
      const chosenName = (await chosen.innerText()).split("\n")[0].replace(/\s*yours\s*$/i, "").trim();
      await chosen.click();
      /* The plate you chose moves to the top of its own menu, marked as the one on the plan. */
      await expect(menuMeal.getByRole("button", { name: chosenName, exact: false }).first()).toHaveAttribute("aria-pressed", "true");
      await page.screenshot({ path: `test-results/peak-mode/${vp.name}-menu.png` });

      /* The same plate every day of the week, in one tap. */
      await menuMeal.getByRole("button", { name: /every day this week/i }).first().click();
      const picks = await page.evaluate(() => {
        const state = JSON.parse(window.localStorage.getItem("final-boss-athlete-settings") as string).state;
        return Object.values(state.nutritionPrefs.peakSwaps ?? {}).length;
      });
      expect(picks, "every day of the week carries a pick").toBe(7);

      /* The day's plan follows the menu. */
      await sheet.getByRole("tab", { name: "Week & shopping" }).click();
      const dayAfterMenu = sheet.getByRole("region", { name: "Peak Mode week" }).locator("[data-peak-day]").nth(2);
      await expect(dayAfterMenu).toContainText(chosenName.trim());

      /* Surprise me fills every meal left, with variety rather than one plate seven
         times. It lives on the Menu tab, which the week's check just left. */
      await sheet.getByRole("tab", { name: "Menu", exact: true }).click();
      await menu.getByRole("button", { name: "Surprise me" }).click();
      const filled = await page.evaluate(() => {
        const state = JSON.parse(window.localStorage.getItem("final-boss-athlete-settings") as string).state;
        const swaps = state.nutritionPrefs.peakSwaps ?? {};
        const picks = Object.values(swaps).flatMap((day) => Object.values(day as Record<string, string>));
        return { days: Object.keys(swaps).length, picks: picks.length, distinct: new Set(picks).size };
      });
      expect(filled.days, "every day of the week is filled").toBe(7);
      expect(filled.picks).toBeGreaterThan(7);
      expect(filled.distinct, "variety, not one plate all week").toBeGreaterThan(1);
      await page.screenshot({ path: `test-results/peak-mode/${vp.name}-surprise.png` });

      /* Reserve takes the week back when the member asks. */
      await sheet.getByRole("tab", { name: "Menu", exact: true }).click();
      await menu.getByRole("button", { name: "Let Reserve choose the week" }).click();
      await expect(menu).toContainText("0 of");

      /* The week and its shopping list. */
      await sheet.getByRole("tab", { name: "Week & shopping" }).click();
      await expect(sheet.getByRole("region", { name: "Peak Mode week" })).toContainText("Today");
      const shop = sheet.getByRole("region", { name: "Peak Mode shopping list" });
      await expect(shop).toContainText("Protein");
      await expect(shop).toContainText(/chicken breast/i);
      await expect(shop).toContainText(/raw/);
      await expect(shop).not.toContainText(/shrimp/i);
      /* Any day of the week can be opened and its meals swapped, and the shopping list follows. */
      const week = sheet.getByRole("region", { name: "Peak Mode week" });
      const otherDay = week.locator("[data-peak-day]").nth(2);
      await otherDay.getByRole("group").first().click();
      const dayBreakfast = otherDay.locator('[data-peak-meal="breakfast"]');
      const wasNamed = await dayBreakfast.locator("[data-peak-name]").innerText();
      await dayBreakfast.getByRole("button", { name: "Swap this meal" }).click();
      await dayBreakfast.getByRole("list", { name: /Swap options/ }).getByRole("button").first().click();
      await expect(dayBreakfast.locator("[data-peak-name]")).not.toHaveText(wasNamed);
      const dayKeyed = await otherDay.getAttribute("data-peak-day");
      expect(await page.evaluate(() => window.localStorage.getItem("final-boss-athlete-settings") ?? "")).toContain(dayKeyed!);

      /* What the member actually bought: the plan cooks it, and the list marks it off. */
      const stock = sheet.getByRole("region", { name: "What you already have" });
      await expect(stock).toBeVisible();
      await stock.getByRole("group", { name: "Proteins you have" }).getByRole("button", { name: "93% lean ground beef" }).click();
      await expect(stock.getByRole("button", { name: "93% lean ground beef" })).toHaveAttribute("aria-pressed", "true");
      await expect(shop.locator("[data-peak-have]").first()).toBeVisible();
      await expect(shop).toContainText(/93% lean ground beef/i);
      expect(await page.evaluate(() => window.localStorage.getItem("final-boss-athlete-settings") ?? "")).toContain('"onHand"');
      await page.screenshot({ path: `test-results/peak-mode/${vp.name}-kitchen.png` });

      const first = shop.getByRole("checkbox").first();
      await first.check();
      await expect(shop).toContainText(/1 of [0-9]+ in the cart/);
      await page.screenshot({ path: `test-results/peak-mode/${vp.name}-shopping.png` });

      const stored = await page.evaluate(() => window.localStorage.getItem("final-boss-athlete-settings") ?? "");
      expect(stored).toContain('"peakLook":"lean-hard"');
      expect(stored).toContain('"avoid":["shellfish"]');
      expect(stored).toContain('"peakSwaps"');
      expect(stored).toContain('"peakShopping"');
      expect(stored).toContain('"peakSnacks":["mid-morning","afternoon"]');

      await sheet.getByRole("button", { name: "Leave Peak Mode" }).click();
      await expect(sheet.getByRole("button", { name: /Full · hard/ })).toBeVisible();
    });
  }

  test("ground beef takes the leanest ratio when compounds affect cholesterol, and the member can change it", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await boot(page, true);
    await page.getByRole("button", { name: "Enter Peak Mode" }).click({ timeout: 120_000 });
    const sheet = page.getByRole("dialog", { name: "Peak Mode" });
    await sheet.getByRole("button", { name: /Recomp/ }).click();
    const questions = sheet.getByRole("region", { name: "Build your plates" });
    await questions.getByRole("group", { name: "Proteins you like" }).getByRole("button", { name: "Ground beef", exact: true }).click();
    await questions.getByRole("button", { name: "Build my plates" }).click();

    const meals = sheet.getByRole("region", { name: "Peak Mode meals" });
    const lunch = meals.locator("[data-peak-meal=\"lunch\"]");
    if (!(await lunch.locator("[data-peak-ratio=\"beef\"]").count())) {
      await lunch.getByRole("button", { name: "Swap this meal" }).click();
      await lunch.getByRole("button", { name: /Ground Beef/ }).first().click();
    }
    const ratio = lunch.locator("[data-peak-ratio=\"beef\"]");
    await expect(ratio).toContainText("Ground beef · 96/4 lean-to-fat · Reserve's pick");
    await expect(ratio).toContainText("Your compounds affect cholesterol");
    await expect(lunch.locator("[data-peak-ratio-changed=\"beef\"]")).toContainText("Changed for cholesterol · 93/7 → 96/4");
    await expect(meals).toContainText("changed for cholesterol today");
    await expect(ratio).toContainText(/saturated, in this portion, against [0-9.]+ g saturated at 80.20/);
    await ratio.screenshot({ path: "test-results/peak-mode/ratio.png" });

    await ratio.getByRole("button", { name: "85/15" }).click();
    await expect(ratio).toContainText("85/15 lean-to-fat · your pick");
    await expect(ratio).toContainText("You picked 85/15; Reserve's pick is 96/4, which is leaner");
    await ratio.getByRole("button", { name: /^96.4/ }).click();
    await expect(ratio).toContainText("96/4 lean-to-fat · Reserve's pick");
  });
});
