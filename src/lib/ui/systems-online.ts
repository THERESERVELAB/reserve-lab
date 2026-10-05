/* ════════════════════════════════════════════════════════════════════════
   SYSTEMS ONLINE — the first Apex open of a browser session settles in.

   The decision has to be made before first paint, or the statement would
   paint, vanish and settle. So a tiny inline script in the root layout reads
   the same inputs the motion gate reads — reduced motion, the member's pause
   (this device's `fba-ambient-motion` key), tab visibility — plus a
   sessionStorage flag, and marks <html data-systems-online="play">. CSS
   (globals.css `.fba-so-*`) plays the settle while the mark is present.

   Apex marks the session played and clears the mark once the settle is over.
   The shell clears it the moment the member is on any other room, so a later
   navigation to Apex never plays it. Storage can throw (private windows,
   blocked site data): every access is wrapped, and a failure means no settle.
   ════════════════════════════════════════════════════════════════════════ */

export const SYSTEMS_ONLINE_ATTR = "data-systems-online";
export const SYSTEMS_ONLINE_SESSION_KEY = "fba-systems-online";
/** Longer than the settle's ≤900ms, so the mark never cuts it short. */
export const SYSTEMS_ONLINE_CLEAR_MS = 1000;

export type SystemsOnlineInput = {
  alreadyPlayed: boolean;
  reducedMotion: boolean;
  paused: boolean;
  hidden: boolean;
};

/** Plays only on the first open of a session, and only under full motion. */
export function shouldPlaySystemsOnline({ alreadyPlayed, reducedMotion, paused, hidden }: SystemsOnlineInput): boolean {
  return !alreadyPlayed && !reducedMotion && !paused && !hidden;
}

/**
 * The pre-paint script. Kept dependency-free and in step with
 * `shouldPlaySystemsOnline` (the unit test runs it against the same table).
 */
export const SYSTEMS_ONLINE_SCRIPT = `(function(){try{var d=document.documentElement;var played=!!sessionStorage.getItem("${SYSTEMS_ONLINE_SESSION_KEY}");var reduced=window.matchMedia("(prefers-reduced-motion: reduce)").matches;var paused=false;try{var raw=localStorage.getItem("fba-ambient-motion");paused=!!(raw&&JSON.parse(raw).state&&JSON.parse(raw).state.paused)}catch(e){}var hidden=document.visibilityState==="hidden";if(!played&&!reduced&&!paused&&!hidden)d.setAttribute("${SYSTEMS_ONLINE_ATTR}","play")}catch(e){}})();`;

export function isSystemsOnlinePlaying(): boolean {
  return typeof document !== "undefined" && document.documentElement.getAttribute(SYSTEMS_ONLINE_ATTR) === "play";
}

export function clearSystemsOnline(): void {
  if (typeof document === "undefined") return;
  document.documentElement.removeAttribute(SYSTEMS_ONLINE_ATTR);
}

/**
 * Apex mounted. If the settle is playing, record the session as played and
 * clear the mark after it. Returns a cleanup that clears it early.
 */
export function beginSystemsOnline(): () => void {
  if (!isSystemsOnlinePlaying()) return () => undefined;
  try {
    window.sessionStorage.setItem(SYSTEMS_ONLINE_SESSION_KEY, "1");
  } catch {
    /* No session storage: it may play again on reload, never more than that. */
  }
  const timer = window.setTimeout(clearSystemsOnline, SYSTEMS_ONLINE_CLEAR_MS);
  return () => window.clearTimeout(timer);
}
