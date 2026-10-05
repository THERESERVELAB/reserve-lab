/* ════════════════════════════════════════════════════════════════════════
   CHALLENGE ENGINE — real "last time / today's target / next progression".
   ------------------------------------------------------------------------
   Reads the member's own completed-session logs (offline logging store) and
   turns them into per-movement exposure history for the anti-plateau engine,
   honest challenge targets on movement cards, and PR detection at closeout.
   It never invents history: no logs → no "last time" line, clean baseline.

   Pure + deterministic. Training programming only — no medical content.
   ════════════════════════════════════════════════════════════════════════ */

import type { TrainingSessionLog } from "@/lib/logging/schemas";
import type { MovementExposure } from "./progression-engine";
import { normalizeMovementKey } from "./movement-visuals";

export type MovementHistoryRead = {
  exposure: MovementExposure;
  /** "Jul 1" — when the movement last ran. */
  lastDateLabel: string;
  /** "185 lb × 8" or "12 reps" for unloaded work. */
  lastLine: string;
  /** Coach-style challenge, e.g. "Beat it: 9 reps at 185, or +5 lb clean." */
  targetLine: string;
};

export type MovementHistoryMap = Record<string, MovementHistoryRead>;

type TopSet = { load: number; reps: number };

function topSetOf(sets: { weight: number | null; reps: number | null }[]): TopSet | null {
  let best: TopSet | null = null;
  for (const s of sets) {
    const load = s.weight ?? 0;
    const reps = s.reps ?? 0;
    if (reps <= 0 && load <= 0) continue;
    if (!best || load > best.load || (load === best.load && reps > best.reps)) {
      best = { load, reps };
    }
  }
  return best;
}

function dateLabel(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function lastLineFor(top: TopSet): string {
  return top.load > 0 ? `${top.load} lb × ${top.reps}` : `${top.reps} reps`;
}

function targetLineFor(top: TopSet): string {
  if (top.load > 0) return `Beat it: ${top.reps + 1} reps at ${top.load}, or +5 lb clean.`;
  return `Beat it: ${top.reps + 1} clean reps.`;
}

/**
 * Build per-movement history from completed session logs (newest first or any
 * order — sorted internally). Keys are normalized movement slugs.
 */
export function buildMovementHistory(logs: TrainingSessionLog[]): MovementHistoryMap {
  const sorted = [...logs].sort((a, b) => (a.date < b.date ? 1 : -1)); // newest first
  const out: MovementHistoryMap = {};
  const repsSeen: Record<string, number[]> = {};
  const appearances: Record<string, number> = {};

  for (const log of sorted) {
    for (const ex of log.exerciseLogs ?? []) {
      const key = normalizeMovementKey(ex.exerciseName);
      const top = topSetOf(ex.sets ?? []);
      if (!top) continue;
      appearances[key] = (appearances[key] ?? 0) + 1;
      (repsSeen[key] ??= []).push(top.reps);
      if (!out[key]) {
        out[key] = {
          exposure: {
            lastTopLoad: top.load,
            lastTopReps: top.reps,
            recentTopReps: [],
            consecutiveExposures: 0,
          },
          lastDateLabel: dateLabel(log.date),
          lastLine: lastLineFor(top),
          targetLine: targetLineFor(top),
        };
      }
    }
  }
  for (const key of Object.keys(out)) {
    out[key].exposure.recentTopReps = (repsSeen[key] ?? []).slice(0, 4);
    out[key].exposure.consecutiveExposures = Math.min(appearances[key] ?? 0, 8);
  }
  return out;
}

/** Look up a movement's history by display name (normalized internally). */
export function historyForMovement(map: MovementHistoryMap, movementName: string): MovementHistoryRead | undefined {
  return map[normalizeMovementKey(movementName)];
}

/* ─── PR detection ─────────────────────────────────────────────────────── */

export type PrResult = {
  movementName: string;
  kind: "load" | "reps";
  line: string; // "Flat Barbell Press — 190 lb × 6 (load PR)"
};

/**
 * Compare today's logged top sets against history. A load PR beats the last
 * top load; a rep PR matches the load and adds reps. No history → no PR call
 * (first exposure is a baseline, not a record).
 */
export function detectSessionPRs(
  map: MovementHistoryMap,
  todaySets: { movementName: string; sets: { load: number; reps: number }[] }[],
): PrResult[] {
  const out: PrResult[] = [];
  for (const entry of todaySets) {
    const read = historyForMovement(map, entry.movementName);
    if (!read) continue;
    const top = topSetOf(entry.sets.map((s) => ({ weight: s.load, reps: s.reps })));
    if (!top) continue;
    const prev = read.exposure;
    if (top.load > prev.lastTopLoad && prev.lastTopLoad > 0) {
      out.push({ movementName: entry.movementName, kind: "load", line: `${entry.movementName} — ${top.load} lb × ${top.reps} (load PR)` });
    } else if (top.load === prev.lastTopLoad && top.reps > prev.lastTopReps) {
      out.push({ movementName: entry.movementName, kind: "reps", line: `${entry.movementName} — ${top.reps} reps at ${top.load || "bodyweight"} (rep PR)` });
    }
  }
  return out;
}
