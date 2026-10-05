import type { CoverageState, LabLink, SafetyLevel } from "@/lib/cycle-review/support-plan";
import type { SupportPlanItem } from "@/lib/cycle-review/types";
import { RESERVE } from "@/lib/design/tokens";

/** Red only where the member is routed to a clinician or pharmacist. */
export const SAFETY_COLOR: Record<SafetyLevel, string> = {
  ask: RESERVE.red,
  review: RESERVE.amber,
  "no-known-issue": "rgba(242,238,230,0.7)",
};

export const COVERAGE_COLOR: Record<CoverageState, string> = {
  "monitoring-missing": RESERVE.amber,
  "no-proven-support": RESERVE.slate,
  "support-selected": "rgba(242,238,230,0.85)",
  monitored: "rgba(242,238,230,0.6)",
};

export function arrowFor(direction: LabLink["direction"]): string {
  return direction === "up" ? "↑" : direction === "down" ? "↓" : direction === "steady" ? "→" : "";
}

export function formatDay(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** The member's own entries, joined — or null when nothing was entered. */
export function enteredLine(item: SupportPlanItem): string | null {
  const parts = [
    item.amount ? `${item.amount}${item.unit ? ` ${item.unit}` : ""}` : null,
    item.frequency || null,
    item.brand || null,
    item.startDate ? `since ${formatDay(item.startDate)}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}
