/* ════════════════════════════════════════════════════════════════════════
   DOSE AMOUNT — the member's own amount, added up across their own times.

   The member enters an amount per time ("1.5", "IU") and how many times on a
   scheduled day. This only multiplies what they entered, so a twice-daily
   entry reads "1.5 IU × 2 · 3 IU a day". It never suggests, rounds toward or
   compares against any amount. Anything that is not a plain number (a range,
   a note) is left alone and shown as entered.

   Pure: no React, no store.
   ════════════════════════════════════════════════════════════════════════ */

import type { EnhancementEntry } from "@/lib/athlete-store";

/** A plain positive number, as the member typed it ("1.5", "0.25", "200"). */
function plainAmount(raw: string | undefined): number | null {
  if (!raw) return null;
  const text = raw.trim();
  if (!/^\d+(\.\d+)?$/.test(text)) return null;
  const n = Number(text);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Up to three decimals, trailing zeros dropped: 3, 0.75, 1.125. */
function plain(n: number): string {
  return String(Math.round(n * 1000) / 1000);
}

/** How many times the member set for a scheduled day (1 when they set none). */
export function timesPerDay(entry: Pick<EnhancementEntry, "scheduleRule">): number {
  const doses = entry.scheduleRule?.doses;
  return doses && doses.length > 0 ? Math.min(doses.length, 4) : 1;
}

/**
 * "1.5 IU × 2 · 3 IU a day" when the member takes it more than once a day,
 * "1.5 IU" once a day, or null when no plain amount is entered.
 */
export function dailyAmountLabel(entry: Pick<EnhancementEntry, "doseAmount" | "doseUnit" | "scheduleRule">): string | null {
  const amount = plainAmount(entry.doseAmount);
  if (amount === null) return null;
  const unit = (entry.doseUnit ?? "").trim();
  const each = unit ? `${plain(amount)} ${unit}` : plain(amount);
  const times = timesPerDay(entry);
  if (times === 1) return each;
  const total = unit ? `${plain(amount * times)} ${unit}` : plain(amount * times);
  return `${each} × ${times} · ${total} a day`;
}
