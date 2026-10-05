import type { ApexItemStatus, ApexLaneId, ApexLaneItem } from "@/lib/apex/today-types";
import { RESERVE } from "@/lib/design/tokens";
import { formatTime12, minutesToTime } from "@/lib/schedule/engine";

/* ════════════════════════════════════════════════════════════════════════
   PIT WALL FORMAT — the words and hues every Pit Wall surface shares, so a
   lane reads the same in the timeline, the phone spine and the item sheet.
   ════════════════════════════════════════════════════════════════════════ */

/** Bible §11 canonical status words. */
export const STATUS_WORD: Record<ApexItemStatus, string> = {
  "due-now": "Due now",
  "due-next": "Due next",
  upcoming: "Upcoming",
  "past-due": "Past due",
  completed: "Completed",
  skipped: "Skipped",
};

/** One colour lead per lane (Bible §09): training gold, fuel green, recovery steel, sleep violet. */
export const LANE_ACCENT: Record<ApexLaneId, string> = {
  training: RESERVE.gold,
  fuel: RESERVE.green,
  recovery: RESERVE.steel,
  sleep: RESERVE.violet,
  logbook: RESERVE.slate,
};

export const LANE_NAME: Record<ApexLaneId, string> = {
  training: "Training",
  fuel: "Fuel",
  recovery: "Recovery",
  sleep: "Sleep",
  logbook: "Logbook",
};

/** "4:12 PM" from minutes past midnight (after-midnight values wrap). */
export function clockLabel(min: number): string {
  return formatTime12(minutesToTime(min));
}

/** "4 PM" — timeline tick labels. */
export function hourLabel(min: number): string {
  const h24 = Math.floor((((min % 1440) + 1440) % 1440) / 60);
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12} ${h24 < 12 ? "AM" : "PM"}`;
}

const CHIP_LABEL: Record<string, string> = {
  "Post-Session Handoff": "Handoff",
  "Recovery Downshift": "Downshift",
  "Pre-Session Command": "Pre-session",
  "Mobility Primer": "Primer",
  "Evening Wind-Down": "Wind-down",
  "Hydration Check": "Hydration",
  "Sleep Lock": "Sleep lock",
};

/** The short name a timeline chip can carry. The full name stays in the accessible label and the sheet. */
export function chipLabel(label: string): string {
  return CHIP_LABEL[label] ?? label.replace(/\s+Meal$/i, "");
}

/** Nothing left to do on it: done, skipped, or its window has passed. */
export function isSettled(item: Pick<ApexLaneItem, "status">): boolean {
  return item.status === "completed" || item.status === "skipped" || item.status === "past-due";
}
