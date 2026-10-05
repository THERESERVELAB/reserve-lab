import { RESERVE, alpha } from "@/lib/design/tokens";

/* ════════════════════════════════════════════════════════════════════════
   HORIZON LOOK — the visual settings one horizon differs from another by.

   Structure is shared; these are the knobs. Two presets ship:

     APEX_HORIZON_LOOK   the Pit Wall's mission timeline: gold gate, a hot chip
                         that glows, and — since the room-depth pass — the same
                         11px floor the rooms keep.
     roomHorizonLook()   the living rooms (Nutrition, Recovery, Schedule,
                         Training): an amber gate on the room's accent floor,
                         and no text on the strip under 11px.

   The floor is now shared. Apex's tick labels (was 9–10px), lane names (was
   8px) and phone spine meta (was 7.5–8.5px) sat under the Bible §13 11px
   floor; they read at 11–12px here. Apex keeps its own character — the gold
   gate, the glowing due chip, the instrument spacing — so the Pit Wall's
   desktop composition is unchanged apart from the type. Tracking comes down
   as the size goes up, so a label that grew still fits its column: the lane
   column is 84px and the spine's time column 46px, which at 11px hold the
   longest lane name and "12:00" respectively.
   ════════════════════════════════════════════════════════════════════════ */

export type HorizonLook = {
  floor: {
    /** Floor light, receding from the gate. */
    accent: string;
    opacity: number;
    /** The now gate's line. */
    gate: string;
    /** Soft light either side of the gate, or none. */
    gateGlow: number | null;
    /** Keep the lane's dashed light drawn when it is not flowing. */
    dashesWhenStill: boolean;
  };
  tick: { className: string; alpha: (depth: number) => number; fontPx: ((depth: number) => number) | null };
  lane: { rowClass: string; nameClass: string };
  chip: {
    fill: number;
    rangeFill: number;
    settledOpacity: number;
    hotRing: string;
    nextRing: string;
    /** The due chip glows. Rooms hold still and move only with the minute clock. */
    hotPulse: boolean;
    /** Labels that would not fit become dots instead of being truncated. */
    fitLabels: boolean;
  };
  spine: {
    /** Grid columns and gap: time, marker, text. */
    grid: string;
    /** The spine line's left edge, px: the centre of the marker column. */
    lineLeftPx: number;
    timeClass: string;
    /** Print "4:00" over a small "PM". */
    splitMeridiem: boolean;
    statusClass: string;
    hotMarker: string;
    hotGlow: number;
    idleRing: number;
    /** Show the item's supporting line on the row due now. */
    subWhenDue: boolean;
  };
  sheet: { timeClass: string; laneClass: string; laneAlpha: number; statusClass: string };
};

export const APEX_HORIZON_LOOK: HorizonLook = {
  floor: { accent: RESERVE.gold, opacity: 0.075, gate: RESERVE.gold, gateGlow: 0.14, dashesWhenStill: true },
  tick: {
    className: "font-mono tracking-[0.08em]",
    alpha: (depth) => 0.3 + 0.14 * depth,
    /* Depth still reads, but from the near edge of the floor rather than from
       below the legibility floor: 11px at the horizon, 12px at the gate. */
    fontPx: (depth) => 11 + depth,
  },
  lane: {
    rowClass: "flex h-14 flex-col justify-center pr-3",
    nameClass: "font-mono text-[11px] uppercase tracking-[0.12em]",
  },
  chip: {
    fill: 0.16,
    rangeFill: 0.26,
    settledOpacity: 0.55,
    hotRing: `0 0 0 1.5px ${RESERVE.gold}, 0 0 18px ${alpha(RESERVE.gold, 0.35)}`,
    nextRing: `0 0 0 1px ${alpha(RESERVE.amber, 0.6)}`,
    hotPulse: true,
    fitLabels: false,
  },
  spine: {
    grid: "grid-cols-[52px_24px_minmax(0,1fr)] gap-x-1.5",
    lineLeftPx: 64,
    timeClass: "tnum pt-0.5 font-mono text-[11px]",
    /* The meridiem is drawn by the shared spine at a size it owns; stacking it
       under the hour is what forced the time column below the floor. One line
       at 11px reads, and the column grew to 52px to hold "12:00 PM". */
    splitMeridiem: false,
    statusClass: "mt-0.5 block truncate font-mono text-[11px] uppercase tracking-[0.1em]",
    hotMarker: RESERVE.gold,
    hotGlow: 0.7,
    idleRing: 0.55,
    subWhenDue: false,
  },
  sheet: {
    timeClass: "tnum font-mono text-[11px] text-white/55",
    laneClass: "font-mono text-[11px] uppercase tracking-[0.12em]",
    laneAlpha: 0.8,
    statusClass: "font-mono text-[11px] uppercase tracking-[0.1em] text-white/55",
  },
};

/** A living room's horizon: the room's accent on the floor, an amber gate, nothing under 11px. */
export function roomHorizonLook(accent: string, floorOpacity: number): HorizonLook {
  return {
    floor: { accent, opacity: floorOpacity, gate: RESERVE.amber, gateGlow: 0.13, dashesWhenStill: true },
    tick: {
      className: "font-mono text-[11px] tracking-[0.04em]",
      alpha: (depth) => 0.44 + 0.16 * depth,
      fontPx: null,
    },
    lane: {
      rowClass: "flex h-14 items-center pr-3",
      nameClass: "font-mono text-[11px] uppercase tracking-[0.12em]",
    },
    chip: {
      fill: 0.18,
      rangeFill: 0.18,
      settledOpacity: 0.6,
      hotRing: `0 0 0 1.5px ${RESERVE.amber}`,
      nextRing: `0 0 0 1px ${alpha(RESERVE.amber, 0.6)}`,
      hotPulse: false,
      fitLabels: true,
    },
    spine: {
      grid: "grid-cols-[60px_20px_minmax(0,1fr)] gap-x-2",
      lineLeftPx: 78,
      timeClass: "tnum pt-0.5 font-mono text-[11px] leading-tight",
      splitMeridiem: false,
      statusClass: "mt-0.5 block break-words font-mono text-[11px] uppercase leading-snug tracking-[0.06em]",
      hotMarker: RESERVE.amber,
      hotGlow: 0.6,
      idleRing: 0.6,
      subWhenDue: true,
    },
    sheet: {
      timeClass: "tnum font-mono text-[11px] text-white/60",
      laneClass: "font-mono text-[11px] uppercase tracking-[0.14em]",
      laneAlpha: 0.85,
      statusClass: "font-mono text-[11px] uppercase tracking-[0.12em] text-white/55",
    },
  };
}
