/* ════════════════════════════════════════════════════════════════════════
   PLAN EFFECTIVE DATE — whether an accepted plan waits for a later day.

   `effectiveDate` is a local calendar day ("YYYY-MM-DD") chosen by the coach.
   It is compared with the athlete's own local day, never the UTC day: in
   every US time zone `toISOString().slice(0, 10)` reads tomorrow from the
   evening on, so a plan effective "tomorrow" would activate at 8pm tonight
   and the Accept button would say "Accept & activate" for a plan that waits.

   The Accept label and the repository's accept() both ask this function, so
   the button always describes what accepting will actually do.
   ════════════════════════════════════════════════════════════════════════ */

import { localDateKey } from "@/lib/dates/local-day";

/** True when the plan starts on a later local day than `now`. */
export function startsOnLaterDay(effectiveDate: string | null | undefined, now: Date = new Date()): boolean {
  if (!effectiveDate) return false;
  return effectiveDate > localDateKey(now);
}

/** The local calendar day an ISO instant falls on, for a record stamped with a full timestamp. */
export function localDayOf(iso: string): string {
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? iso.slice(0, 10) : localDateKey(parsed);
}
