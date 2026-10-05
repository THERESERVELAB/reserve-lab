import type { Page } from "@playwright/test";

/**
 * Finish everything that is animating, then measure.
 *
 * Headless suspends the frames that would carry an entrance animation to its
 * end, so a sheet can sit part-way up the screen, and a control part-way
 * through its scale, for as long as a test cares to look. Geometry read in
 * that state belongs to the animation, not to the layout: a sheet 29px below
 * where it comes to rest, a 44px control measuring 43, a panel 4.9px short.
 *
 * Every one of those read as a product defect and none of them was. Finishing
 * first is what makes a measurement mean what it says.
 *
 * Playwright's own screenshots disable animations for exactly this reason,
 * which is why a geometry check that followed a screenshot passed and the same
 * check on its own did not.
 */
export async function settleAnimations(page: Page): Promise<void> {
  await page.evaluate(() => {
    for (const animation of document.getAnimations()) {
      try {
        animation.finish();
      } catch {
        /* An infinite ambient loop has no end to jump to, and moves no layout. */
      }
    }
  });
}
