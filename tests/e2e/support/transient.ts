import type { Page } from "@playwright/test";

/* ════════════════════════════════════════════════════════════════════════
   THINGS THAT ARE MEANT TO VANISH.

   Some of what Reserve does is deliberately brief. The light trace lives
   650ms (SIGNAL_TRACE_MS + 50), the glow 900ms, an undo window six seconds.
   A test that asserts one of them with `toBeAttached` is not asking "did it
   happen" — it is asking "is it still happening at the moment I looked",
   and on a loaded two-core runner the answer is often no. The element came
   and went between the click resolving and the first poll, and a correct app
   read as a failure.

   So the appearance is RECORDED from before the action rather than polled
   for after it. The assertion keeps its meaning — the trace ran — and stops
   depending on how fast the machine got round to checking.

   Install before the action, read after.
   ════════════════════════════════════════════════════════════════════════ */

/**
 * Start recording whether each selector ever matches a rendered element.
 *
 * "Rendered" means it has a box: an element present but with no client rects
 * is not what a member would have seen, and the specs that use this are about
 * what was on screen.
 */
export async function watchForTransient(page: Page, selectors: readonly string[]): Promise<void> {
  await page.evaluate((sels: string[]) => {
    const w = window as unknown as { __transient?: Record<string, boolean>; __transientObserver?: MutationObserver };
    w.__transient = {};
    for (const s of sels) w.__transient[s] = false;

    const look = () => {
      for (const s of sels) {
        if (w.__transient![s]) continue;
        for (const el of Array.from(document.querySelectorAll(s))) {
          if ((el as HTMLElement).getClientRects().length > 0) {
            w.__transient![s] = true;
            break;
          }
        }
      }
    };

    look();
    w.__transientObserver?.disconnect();
    w.__transientObserver = new MutationObserver(look);
    w.__transientObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
    });
    /* A mutation is not guaranteed for every frame of an animation, and an
       element can be added and removed inside one batch, so the observer is
       backed by a short poll. Cleared well before any test times out. */
    const poll = window.setInterval(look, 25);
    window.setTimeout(() => window.clearInterval(poll), 30_000);
  }, selectors as string[]);
}

/** Whether the selector was ever seen rendered since the watch began. */
export function sawTransient(page: Page, selector: string): Promise<boolean> {
  return page.evaluate(
    (s: string) => Boolean((window as unknown as { __transient?: Record<string, boolean> }).__transient?.[s]),
    selector,
  );
}

/**
 * Record every value an attribute takes on an element, from before the action.
 *
 * `data-log-sound` on <html> names the sound that just played, so it holds
 * only the LAST one. A click that plays a chord can be followed by the UI's
 * own tap, and then the attribute says "ui-tap" — asserting its current value
 * asks "what played most recently", not "did the chord play". On a loaded
 * runner the order of those two is not fixed, so the answer moved.
 */
export async function watchAttribute(page: Page, selector: string, attribute: string): Promise<void> {
  await page.evaluate(
    ({ sel, attr }: { sel: string; attr: string }) => {
      const w = window as unknown as { __attrSeen?: Record<string, string[]>; __attrObserver?: MutationObserver };
      const key = `${sel}|${attr}`;
      w.__attrSeen = w.__attrSeen ?? {};
      w.__attrSeen[key] = [];
      const target = document.querySelector(sel);
      if (!target) return;
      const note = () => {
        const value = target.getAttribute(attr);
        if (value != null && !w.__attrSeen![key].includes(value)) w.__attrSeen![key].push(value);
      };
      note();
      w.__attrObserver?.disconnect();
      w.__attrObserver = new MutationObserver(note);
      w.__attrObserver.observe(target, { attributes: true, attributeFilter: [attr] });
    },
    { sel: selector, attr: attribute },
  );
}

/** Every value the attribute has held since the watch began. */
export function attributeValuesSeen(page: Page, selector: string, attribute: string): Promise<string[]> {
  return page.evaluate(
    ({ sel, attr }: { sel: string; attr: string }) =>
      (window as unknown as { __attrSeen?: Record<string, string[]> }).__attrSeen?.[`${sel}|${attr}`] ?? [],
    { sel: selector, attr: attribute },
  );
}
