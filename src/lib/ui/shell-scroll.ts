/* ════════════════════════════════════════════════════════════════════════
   SHELL SCROLL — one answer to "what scrolls the page?"

   Below 768px the document scrolls, so the URL bar can collapse and a swipe
   is never trapped in a box. From 768px up the shell keeps its fixed frame
   and <main> scrolls inside it. Anything that reads or moves the page's
   scroll position asks here instead of assuming either one.
   ════════════════════════════════════════════════════════════════════════ */

function scrollingMain(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  const main = document.querySelector("main");
  if (!main) return null;
  const overflowY = getComputedStyle(main).overflowY;
  return overflowY === "auto" || overflowY === "scroll" ? main : null;
}

/** The element whose scroll position is the page's: <main> on desktop, the document on phones. */
export function getShellScroller(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  return scrollingMain() ?? (document.scrollingElement as HTMLElement | null) ?? document.documentElement;
}

export function getShellScrollTop(): number {
  if (typeof window === "undefined") return 0;
  const main = scrollingMain();
  return main ? main.scrollTop : window.scrollY;
}

/** Moves the page to its top. Instant unless asked otherwise; smooth never runs under reduced motion. */
export function scrollShellToTop(behavior: "instant" | "smooth" = "instant"): void {
  if (typeof window === "undefined") return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const resolved: ScrollBehavior = behavior === "smooth" && !reduce ? "smooth" : "instant";
  const main = scrollingMain();
  if (main) main.scrollTo({ top: 0, behavior: resolved });
  else window.scrollTo({ top: 0, behavior: resolved });
}

/** True when a scroll event came from the page's scroller (either kind). */
export function isShellScrollEvent(event: Event): boolean {
  const target = event.target;
  if (target === document || target === document.documentElement) return true;
  return target instanceof HTMLElement && target.tagName === "MAIN";
}
