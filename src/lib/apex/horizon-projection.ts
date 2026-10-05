/* ════════════════════════════════════════════════════════════════════════
   HORIZON PROJECTION — where the Mission Timeline puts each minute.

   Pure geometry for the horizon timeline (Design Bible §13, V1.2). Now is a
   gate near the viewer; the rest of the day recedes toward sleep lock. Time
   after now is mapped through a projective curve, so the next hours are wide
   and the evening is compressed. Time before now sits flat behind the gate.

   Only the track has perspective. Everything this module returns for text
   (font size, chip height) stays flat and has a floor, and every hit area
   stays 44px: lanes converge only as far as 44px rows allow, and items closer
   than a hit area collapse into one control.

   No React, no DOM. The Pit Wall measures the track and hands the width in.
   ════════════════════════════════════════════════════════════════════════ */

import type { ApexLaneItem } from "./today-types";

export const HORIZON = {
  /** Lane row height at the gate. */
  rowPx: 56,
  /** Hour-label band above the lanes. */
  ticksPx: 24,
  /** Minimum hit area for every item. */
  hitPx: 44,
  /** Row spacing at the far end, as a share of the near spacing. 56 × 0.8 = 44.8 ≥ 44. */
  convergence: 0.8,
  /** Point items closer than this (px) collapse into one control. */
  minGapPx: 48,
  /** A chip needs this much width to carry a word. Below it the item is a dot. */
  chipMinPx: 56,
  /** Share of the track the gate sits at, bounded in px. */
  gateShare: 0.2,
  gateMinPx: 72,
  gateMaxPx: 168,
  /** The gate eases out from the track start over the first minutes of the window. */
  pastRampMin: 90,
  /** Track width assumed before the first measurement. */
  defaultTrackPx: 560,
  /** Labels on the tick band need this much room between them. */
  tickLabelGapPx: 44,
} as const;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round = (v: number, step = 0.001) => {
  const r = Math.round(v / step) * step;
  return Object.is(r, -0) ? 0 : Number(r.toFixed(4));
};

/* ─── Frame ────────────────────────────────────────────────────────────── */

export type HorizonFrame = {
  startMin: number;
  endMin: number;
  /** Now, clamped into the window. The gate sits on this minute. */
  anchorMin: number;
  /** 0–1 share of the track where the gate sits. */
  gate: number;
  /** Projective depth strength. Higher = the evening compresses harder. */
  depth: number;
  trackPx: number;
};

function validTrack(trackPx: number): number {
  return Number.isFinite(trackPx) && trackPx > 0 ? trackPx : HORIZON.defaultTrackPx;
}

/**
 * Depth strength for a track width. Narrow tracks (820 tablet, 1280 beside the
 * condition column) get a gentle curve so the evening stays readable; wide
 * tracks get the full horizon.
 */
export function horizonDepthFor(trackPx: number): number {
  const w = validTrack(trackPx);
  return round(clamp(1 + ((w - 420) * 1.6) / 320, 1, 2.6), 0.01);
}

export function horizonFrame(window: { startMin: number; endMin: number }, nowMin: number, trackPx: number): HorizonFrame {
  const w = validTrack(trackPx);
  const startMin = window.startMin;
  const endMin = Math.max(startMin + 1, window.endMin);
  const anchorMin = clamp(nowMin, startMin, endMin);
  const baseGate = Math.min(0.5, clamp(w * HORIZON.gateShare, HORIZON.gateMinPx, HORIZON.gateMaxPx) / w);
  const past = anchorMin - startMin;
  const future = endMin - anchorMin;
  const gate = future <= 0 ? 1 : baseGate * Math.min(1, past / HORIZON.pastRampMin);
  return { startMin, endMin, anchorMin, gate: round(gate), depth: horizonDepthFor(w), trackPx: w };
}

/* ─── Points ───────────────────────────────────────────────────────────── */

export type HorizonPoint = {
  /** 0–1 along the track. */
  x: number;
  /** 1 at the gate (near), 0 at the far end of the window. Behind the gate is 1. */
  depth: number;
  /** Before now. */
  behind: boolean;
};

/**
 * One minute on the horizon. With u = share of the remaining window:
 *   depth = (1 − u) / (1 + k·u)      x = gate + (1 − gate) · (1 − depth)
 * which is a perspective division: equal minutes shrink with distance.
 * Because x and the lane's height are both linear in depth, every lane is a
 * straight line converging toward the far end.
 */
export function projectMinute(min: number, frame: HorizonFrame): HorizonPoint {
  const t = clamp(min, frame.startMin, frame.endMin);
  if (t <= frame.anchorMin) {
    const past = frame.anchorMin - frame.startMin;
    const x = past <= 0 ? 0 : (frame.gate * (t - frame.startMin)) / past;
    return { x: round(x), depth: 1, behind: t < frame.anchorMin };
  }
  const u = (t - frame.anchorMin) / (frame.endMin - frame.anchorMin);
  const depth = (1 - u) / (1 + frame.depth * u);
  return { x: round(frame.gate + (1 - frame.gate) * (1 - depth)), depth: round(depth), behind: false };
}

/* ─── Lanes ────────────────────────────────────────────────────────────── */

/**
 * Vertical position (px from the top of the tick band) of a lane coordinate
 * at a depth. `position` 0 is the top edge of the lanes, `n` the bottom edge,
 * `i + 0.5` the centre of lane i. Lanes converge upward, toward the horizon.
 */
export function laneYPx(position: number, depth: number): number {
  const spread = 1 - (1 - HORIZON.convergence) * (1 - clamp(depth, 0, 1));
  return round(HORIZON.ticksPx + HORIZON.rowPx * position * spread, 0.1);
}

/** How far an item on lane i sits above its row's centre at a depth (≤ 0). */
export function laneShiftPx(laneIndex: number, depth: number): number {
  return round(laneYPx(laneIndex + 0.5, depth) - laneYPx(laneIndex + 0.5, 1), 0.1);
}

/** Flat type and chip metrics at a depth. Text never drops below 11px. */
export function chipMetrics(depth: number): { heightPx: number; fontPx: number; dotPx: number; fill: number } {
  const d = clamp(depth, 0, 1);
  return {
    heightPx: Math.round(26 + 8 * d),
    fontPx: round(11 + 2 * d, 0.5),
    dotPx: Math.round(10 + 6 * d),
    fill: round(0.6 + 0.4 * d, 0.01),
  };
}

/* ─── Ticks ────────────────────────────────────────────────────────────── */

export type HorizonTick = HorizonPoint & { min: number; labelled: boolean };

/** Hourly ticks. A tick carries a label only where it has room to be read. */
export function horizonTicks(frame: HorizonFrame): HorizonTick[] {
  const ticks: HorizonTick[] = [];
  let lastLabelPx = -Infinity;
  for (let t = Math.ceil(frame.startMin / 60) * 60; t < frame.endMin; t += 60) {
    const point = projectMinute(t, frame);
    const px = point.x * frame.trackPx;
    const labelled = px - lastLabelPx >= HORIZON.tickLabelGapPx && frame.trackPx - px >= 20;
    if (labelled) lastLabelPx = px;
    ticks.push({ ...point, min: t, labelled });
  }
  return ticks;
}

/* ─── Lane layout ──────────────────────────────────────────────────────── */

export type HorizonChipMode = "range" | "chip" | "end" | "dot";

/** What the lane layout needs from an item. Every horizon's items carry at least this. */
export type HorizonLaneEntry = Pick<ApexLaneItem, "id" | "startMin" | "endMin">;

export type HorizonChip<T extends HorizonLaneEntry = ApexLaneItem> = {
  key: string;
  items: T[];
  mode: HorizonChipMode;
  /** 0–1 along the track, at the cluster's first minute. */
  x: number;
  depth: number;
  /** Vertical lane convergence at this depth (≤ 0). */
  shiftPx: number;
  /** Range width, px. */
  widthPx: number | null;
  /** Upper bound on a chip's width, px. Chips are at least `hitPx` wide. */
  maxWidthPx: number | null;
  /** Nudge (≤ 0) that keeps a dot's hit area off the control after it. */
  hitShiftPx: number;
  /** The px interval the control may occupy — hit areas never overlap. */
  occupies: [number, number];
};

type Cluster<T extends HorizonLaneEntry> = { key: string; items: T[]; x: number; depth: number; endX: number | null };

function clusterLane<T extends HorizonLaneEntry>(items: readonly T[], frame: HorizonFrame): Cluster<T>[] {
  const clusters: Cluster<T>[] = [];
  for (const item of items) {
    if ((item.endMin ?? item.startMin) < frame.startMin) continue;
    const point = projectMinute(item.startMin, frame);
    const last = clusters[clusters.length - 1];
    const ranged = item.endMin !== null;
    if (last && !ranged && last.endX === null && (point.x - last.x) * frame.trackPx < HORIZON.minGapPx) {
      last.items.push(item);
      continue;
    }
    const end = ranged ? projectMinute(item.endMin as number, frame) : null;
    clusters.push({
      key: item.id,
      items: [item],
      x: point.x,
      /* A range reads at its middle, so a long session is not drawn at its near edge only. */
      depth: end ? round((point.depth + end.depth) / 2) : point.depth,
      endX: end ? end.x : null,
    });
  }
  return clusters;
}

/**
 * Clusters one lane and decides how each control is drawn. Laid out from the
 * far end back toward the gate, so every control knows where the next one
 * begins and no two hit areas overlap.
 */
export function layoutHorizonLane<T extends HorizonLaneEntry>(items: readonly T[], laneIndex: number, frame: HorizonFrame): HorizonChip<T>[] {
  const w = frame.trackPx;
  const half = HORIZON.hitPx / 2;
  const clusters = clusterLane(items, frame);
  const out: HorizonChip<T>[] = new Array(clusters.length);
  let nextLeft = w + 6;

  for (let i = clusters.length - 1; i >= 0; i -= 1) {
    const c = clusters[i];
    const px = c.x * w;
    const isLast = i === clusters.length - 1;
    const prevPx = i > 0 ? clusters[i - 1].x * w : null;
    const base = { key: c.key, items: c.items, x: c.x, depth: c.depth, shiftPx: laneShiftPx(laneIndex, c.depth) };

    let chip: HorizonChip<T>;
    if (c.endX !== null) {
      const widthPx = Math.round(Math.max(HORIZON.hitPx, Math.min((c.endX - c.x) * w, nextLeft - px - 4)));
      chip = { ...base, mode: "range", widthPx, maxWidthPx: null, hitShiftPx: 0, occupies: [px, px + widthPx] };
    } else if (nextLeft - px - 6 >= HORIZON.chipMinPx) {
      const maxWidthPx = Math.floor(nextLeft - px - 6);
      chip = { ...base, mode: "chip", widthPx: null, maxWidthPx, hitShiftPx: 0, occupies: [px, px + maxWidthPx] };
    } else {
      /* Near the end of the day, the last item reads backward from its minute
         (sleep lock keeps its name), leaving room for a dot before it. */
      const backSpan = isLast && c.x > 0.6 ? Math.floor(Math.min(150, prevPx === null ? px - 6 : px - prevPx - 6 - half - 4)) : 0;
      if (backSpan >= HORIZON.chipMinPx) {
        chip = { ...base, mode: "end", widthPx: null, maxWidthPx: backSpan, hitShiftPx: 0, occupies: [px - 6 - backSpan, px - 6] };
      } else {
        const hitShiftPx = Math.min(0, Math.floor(nextLeft - 2 - (px + half)));
        chip = { ...base, mode: "dot", widthPx: null, maxWidthPx: null, hitShiftPx, occupies: [px - half + hitShiftPx, px + half + hitShiftPx] };
      }
    }
    out[i] = chip;
    nextLeft = chip.occupies[0];
  }
  return out;
}

/* ─── Phone spine ──────────────────────────────────────────────────────── */

/** The lowest the depth fade goes. */
export const SPINE_FADE_FLOOR = 0.6;

/** Depth fade down the Now Spine: full at now and above it, receding below. */
export function spineFade(rowsAfterNow: number): number {
  if (!Number.isFinite(rowsAfterNow) || rowsAfterNow <= 0) return 1;
  return round(Math.max(SPINE_FADE_FLOOR, 1 - 0.1 * rowsAfterNow), 0.01);
}

/**
 * Text alphas for a spine row. Depth is carried by the marker and a small
 * step in the label, never by dimming a whole row, so every line of text
 * holds AA contrast (4.5:1) on the glass.
 */
export function spineInk(fade: number, settled: boolean): { label: number; meta: number; marker: number } {
  const f = clamp(fade, SPINE_FADE_FLOOR, 1);
  if (settled) return { label: 0.66, meta: 0.58, marker: round(0.5 * f, 0.01) };
  return { label: round(0.8 + 0.2 * f, 0.01), meta: round(0.58 + 0.08 * f, 0.01), marker: f };
}
