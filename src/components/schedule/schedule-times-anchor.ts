/* The operating-times editor's place on the Schedule screen. "Set Your Day" and
   every "Adjust …" action bring it into view and focus the time they name,
   instead of changing a time on the member's behalf. */

import type { ScheduleTimeField } from "@/lib/schedule/day-horizon";

export const SCHEDULE_TIMES_ID = "schedule-operating-times";

/** Scrolls the editor into view and focuses the named time (or the first one). False when it is not on the page. */
export function focusScheduleTime(field: ScheduleTimeField | null): boolean {
  if (typeof document === "undefined") return false;
  const host = document.getElementById(SCHEDULE_TIMES_ID);
  if (!host) return false;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  host.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  const input =
    (field ? host.querySelector<HTMLElement>(`[data-schedule-field="${field}"]`) : null) ??
    host.querySelector<HTMLElement>("input");
  (input ?? host).focus({ preventScroll: true });
  return true;
}
