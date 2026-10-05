/* ════════════════════════════════════════════════════════════════════════
   RESERVE WOMEN — LIKE-FOR-LIKE CHECK-INS.

   Compares the member's two newest check-ins that fall in the same
   estimated phase. It is a difference between two of her own entries,
   labelled with the phase — never a projection, a target or a cause.

   Pure: no React, no store.
   ════════════════════════════════════════════════════════════════════════ */

import { estimatePhaseOn } from "./cycle";
import type { CyclePhase, CycleProfile } from "./types";

export type DatedWeight = { date: string; bodyWeightLb: number };

export type SamePhaseComparison<T extends DatedWeight> = {
  phase: CyclePhase;
  from: T;
  to: T;
  deltaLb: number;
};

export function samePhaseComparison<T extends DatedWeight>(
  entries: readonly T[],
  cycle: CycleProfile,
  starts: readonly string[],
): SamePhaseComparison<T> | null {
  const newestFirst = [...entries].filter((e) => Number.isFinite(e.bodyWeightLb)).sort((a, b) => b.date.localeCompare(a.date));
  const newest = newestFirst[0];
  if (!newest) return null;
  const phase = estimatePhaseOn(newest.date, cycle, starts).phase;
  if (!phase) return null;
  const earlier = newestFirst.slice(1).find((e) => e.date !== newest.date && estimatePhaseOn(e.date, cycle, starts).phase === phase);
  if (!earlier) return null;
  return { phase, from: earlier, to: newest, deltaLb: Math.round((newest.bodyWeightLb - earlier.bodyWeightLb) * 10) / 10 };
}
