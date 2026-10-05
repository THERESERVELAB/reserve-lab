/* The Sleep Log's place on the Recovery screen. The hero's "Log Last Night's
   Sleep" action opens it here instead of logging a guessed value. */

export const RECOVERY_SLEEP_LOG_ID = "recovery-sleep-log";

/** Scrolls the Sleep Log into view and focuses its first field. False when it is not on the page. */
export function focusRecoverySleepLog(): boolean {
  if (typeof document === "undefined") return false;
  const host = document.getElementById(RECOVERY_SLEEP_LOG_ID);
  if (!host) return false;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  host.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  const field = host.querySelector<HTMLElement>("input") ?? host.querySelector<HTMLElement>("button:not([disabled])");
  (field ?? host).focus({ preventScroll: true });
  return true;
}
