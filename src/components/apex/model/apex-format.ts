/* ════════════════════════════════════════════════════════════════════════
   APEX FORMAT — the small pure helpers the Apex model and the Pit Wall share.
   ════════════════════════════════════════════════════════════════════════ */

/** Server-render reference clock, replaced by the real clock after mount. */
export const FIXED_NOON = new Date(2025, 0, 1, 12, 0, 0);

export const DOW_BY_SHORT: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function hmToMinutes(t: string | null | undefined): number | null {
  if (!t || !/^\d{1,2}:\d{2}$/.test(t)) return null;
  const [h, m] = t.split(":").map((n) => parseInt(n, 10));
  return h * 60 + m;
}

export function formatClock(t: string | null): string {
  const m = hmToMinutes(t);
  if (m === null) return "—";
  const d = new Date();
  d.setHours(Math.floor(m / 60), m % 60, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
