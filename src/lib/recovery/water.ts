/* ════════════════════════════════════════════════════════════════════════
   WATER — the member's own targets, pour sizes, and the small reads that
   make logging a glass feel like something: the level, the next milestone,
   and how many days in a row the member reached their own number.

   The target is always the member's own. Reserve offers round numbers to
   pick from and never says what anyone should drink.
   ════════════════════════════════════════════════════════════════════════ */

import type { HydrationLog } from "./types";

/** Glass and bottle sizes a member can pour with one tap. */
export const POUR_SIZES = [8, 12, 16, 20, 24, 32] as const;
export const DEFAULT_POUR_OZ = 16;

/** Round numbers to pick from — the member's choice, never a recommendation. */
export const WATER_TARGET_CHOICES = [64, 80, 100, 120, 140, 160] as const;
export const WATER_TARGET_MIN = 32;
export const WATER_TARGET_MAX = 256;
export const WATER_TARGET_STEP = 8;

export const MOBILITY_TARGET_MIN = 1;
export const MOBILITY_TARGET_MAX = 14;

export function clampWaterTarget(oz: number): number {
  if (!Number.isFinite(oz)) return 120;
  return Math.min(WATER_TARGET_MAX, Math.max(WATER_TARGET_MIN, Math.round(oz)));
}

export function clampMobilityTarget(sessions: number): number {
  if (!Number.isFinite(sessions)) return 5;
  return Math.min(MOBILITY_TARGET_MAX, Math.max(MOBILITY_TARGET_MIN, Math.round(sessions)));
}

export function clampPour(oz: number): number {
  if (!Number.isFinite(oz)) return DEFAULT_POUR_OZ;
  return Math.min(64, Math.max(1, Math.round(oz)));
}

export function ozOn(logs: readonly HydrationLog[], date: string): number {
  return logs.reduce((sum, l) => (l.date === date ? sum + l.oz : sum), 0);
}

const MILESTONES = [
  { at: 0.25, label: "A quarter of the way" },
  { at: 0.5, label: "Halfway there" },
  { at: 0.75, label: "Three quarters in" },
  { at: 1, label: "Target hit" },
] as const;

/** The milestone a pour just crossed, if any: "Halfway there", "Target hit". */
export function milestoneCrossed(beforeOz: number, afterOz: number, targetOz: number): string | null {
  if (targetOz <= 0) return null;
  const before = beforeOz / targetOz;
  const after = afterOz / targetOz;
  const crossed = MILESTONES.filter((m) => before < m.at && after >= m.at);
  return crossed.length ? crossed[crossed.length - 1].label : null;
}

/** What is left, said plainly: "40 oz to go", "Target hit · 8 oz over". */
export function remainingLine(todayOz: number, targetOz: number): string {
  const left = targetOz - todayOz;
  if (left > 0) return `${left} oz to go`;
  return left === 0 ? "Target hit" : `Target hit · ${-left} oz over`;
}

function previousDay(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d - 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/**
 * Days in a row the member reached their own target. Today counts once it is
 * reached; a today still under way never breaks the run.
 */
export function waterStreak(logs: readonly HydrationLog[], targetOz: number, today: string): number {
  if (targetOz <= 0) return 0;
  let streak = ozOn(logs, today) >= targetOz ? 1 : 0;
  for (let day = previousDay(today), i = 0; i < 366 && ozOn(logs, day) >= targetOz; day = previousDay(day), i += 1) streak += 1;
  return streak;
}
