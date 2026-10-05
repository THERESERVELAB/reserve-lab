import type { CSSProperties } from "react";

import { STATUS_WORD, chipLabel } from "@/components/apex/pit-wall/format";
import { HORIZON, laneYPx, type HorizonChip } from "@/lib/apex/horizon-projection";
import type { ApexItemStatus } from "@/lib/apex/today-types";

/* ════════════════════════════════════════════════════════════════════════
   HORIZON MODEL — the pure decisions every horizon shares.

   Where a minute lands is `horizon-projection.ts`. This module decides the
   rest, without React: which spine rows a phone shows, whether a chip's
   words fit its room or it becomes a dot, and how its control is placed.
   ════════════════════════════════════════════════════════════════════════ */

/** The least an item on any horizon carries. Apex lane items and every room's items satisfy it. */
export type HorizonItem = {
  id: string;
  label: string;
  sub: string | null;
  startMin: number;
  endMin: number | null;
  /** "4:00 PM". */
  timeLabel: string;
  status: ApexItemStatus;
};

/** Width of the lane-name column beside the track. */
export const HORIZON_LABEL_COL_PX = 84;
/** Rows a phone spine shows before "Show all". */
export const HORIZON_SPINE_ROWS = 5;
/** Height held for a track that has not mounted its clock yet, on phones. */
export const HORIZON_PHONE_HOLD_PX = 96;

/** Width budget for a label: an upper-bound character width at the chip's font size, plus its padding. */
const CHAR_EM = 0.62;
const CHIP_PAD_PX = 22;

export function labelFits(label: string, fontPx: number, maxWidthPx: number | null): boolean {
  if (maxWidthPx === null) return true;
  return label.length * fontPx * CHAR_EM + CHIP_PAD_PX <= maxWidthPx;
}

/** Still ahead: due now, due next or upcoming. */
export function isLiveStatus(status: ApexItemStatus): boolean {
  return status === "due-now" || status === "due-next" || status === "upcoming";
}

/** Nothing left to do on it: done, skipped, or its window has passed. */
export function isSettledStatus(status: ApexItemStatus): boolean {
  return status === "completed" || status === "skipped" || status === "past-due";
}

/** The track's full height for a lane count: tick band plus the lanes at the gate. */
export function horizonTrackHeightPx(laneCount: number): number {
  return laneYPx(Math.max(0, laneCount), 1);
}

export function describeHorizonItems(items: readonly Pick<HorizonItem, "label" | "timeLabel" | "status">[]): string {
  return items.map((item) => `${item.label}, ${item.timeLabel}, ${STATUS_WORD[item.status]}`).join("; ");
}

/* ─── Phone spine ──────────────────────────────────────────────────────── */

export type SpineWindow<T> = {
  shown: readonly T[];
  /** Rows before the first one shown. */
  hiddenBefore: number;
  /** Rows after the last one shown. */
  hiddenAfter: number;
  /** Index in `shown` of the first row still ahead, or -1. Depth fades down from it. */
  liveIndex: number;
};

/**
 * The rows a phone spine shows: from one row before the first item still ahead,
 * `rows` long. With nothing ahead, the last `rows`. Expanded, everything.
 */
export function spineWindow<T extends { status: ApexItemStatus }>(
  items: readonly T[],
  expanded: boolean,
  rows: number = HORIZON_SPINE_ROWS,
): SpineWindow<T> {
  const firstLive = items.findIndex((item) => isLiveStatus(item.status));
  const start = expanded ? 0 : firstLive < 0 ? Math.max(0, items.length - rows) : Math.max(0, firstLive - 1);
  const shown = expanded ? items : items.slice(start, start + rows);
  return {
    shown,
    hiddenBefore: start,
    hiddenAfter: Math.max(0, items.length - start - shown.length),
    liveIndex: shown.findIndex((item) => isLiveStatus(item.status)),
  };
}

/* ─── Track chips ──────────────────────────────────────────────────────── */

export type ChipFace = {
  /** The words on the chip. */
  label: string;
  /** Drawn as a dot: the lane mode says so, or the words would not fit. */
  dot: boolean;
  /** A completed single item carries a tick. */
  tick: boolean;
  /** Where the 44px control sits on its lane. */
  position: CSSProperties;
  /** Moves a dot back onto its minute when the control had to step aside, px. */
  dotShiftPx: number | null;
};

/**
 * How one laid-out chip is drawn.
 *
 * With `fitLabels`, a label that would not fit its room is drawn as a dot,
 * never cut off (the full name stays in the accessible label and the sheet).
 * Without it, the label is shown and truncated by its container.
 */
export function chipFace(chip: HorizonChip<HorizonItem>, fontPx: number, fitLabels: boolean): ChipFace {
  const first = chip.items[0];
  const settled = chip.items.every((item) => isSettledStatus(item.status));
  const tick = first.status === "completed" && settled;
  const name = chip.items.length > 1 ? `${chipLabel(first.label)} +${chip.items.length - 1}` : chipLabel(first.label);
  /* A last item near the end of the day reads backward from its minute, so it keeps its name and time. */
  const endLabel = `${name} · ${first.timeLabel}`;

  let label: string;
  let dot: boolean;
  if (fitLabels) {
    const room = chip.maxWidthPx === null ? null : chip.maxWidthPx - (tick ? fontPx : 0);
    const fits = (text: string) => labelFits(text, fontPx, room);
    label = chip.mode === "end" && fits(endLabel) ? endLabel : name;
    dot = chip.mode === "dot" || (chip.mode !== "range" && !fits(label));
  } else {
    label = chip.mode === "end" ? endLabel : name;
    dot = chip.mode === "dot";
  }

  const half = HORIZON.hitPx / 2;
  const at = `${chip.x * 100}%`;
  let position: CSSProperties;
  let dotShiftPx: number | null = null;
  switch (chip.mode) {
    case "range":
      position = { left: at, width: chip.widthPx ?? undefined };
      break;
    case "chip":
      /* A chip that fell back to a dot keeps its hit area to the right of its minute. */
      position = dot ? { left: `calc(${at} + ${half}px)` } : { left: at, maxWidth: chip.maxWidthPx ?? undefined };
      if (dot) dotShiftPx = -half;
      break;
    case "end":
      position = dot
        ? { left: `calc(${at} - ${half + 6}px)` }
        : { right: `calc(${100 - chip.x * 100}% + 6px)`, maxWidth: chip.maxWidthPx ?? undefined };
      if (dot) dotShiftPx = half + 6;
      break;
    case "dot":
      position = { left: `calc(${at} + ${chip.hitShiftPx}px)` };
      if (chip.hitShiftPx) dotShiftPx = -chip.hitShiftPx;
      break;
  }

  return { label, dot, tick, position, dotShiftPx };
}
