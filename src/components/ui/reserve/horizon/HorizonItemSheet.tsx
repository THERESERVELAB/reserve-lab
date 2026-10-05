"use client";

import type { ReactNode } from "react";

import { STATUS_WORD } from "@/components/apex/pit-wall/format";
import { ReserveButton, type ReserveButtonTier } from "@/components/ui/reserve/ReserveButton";
import { ReserveStatusChip, type ReserveStatus } from "@/components/ui/reserve/ReserveData";
import { ReserveBottomSheet } from "@/components/ui/reserve/ReserveSurfaces";
import type { ApexItemStatus } from "@/lib/apex/today-types";
import { alpha } from "@/lib/design/tokens";

import type { HorizonLook } from "./horizon-look";
import type { HorizonItem } from "./horizon-model";

const CHIP_STATUS: Partial<Record<ApexItemStatus, ReserveStatus>> = {
  "due-now": "due-now",
  "due-next": "due-next",
  "past-due": "past-due",
  completed: "completed",
  skipped: "skipped",
};

/** One thing an item lets the member do from its sheet. The sheet closes first, then it runs. */
export type HorizonSheetAction = {
  key: string;
  label: string;
  /** Never primary: the screen's one gold action is its hero's, and a sheet must not compete with it. */
  tier: Extract<ReserveButtonTier, "secondary" | "quiet">;
  accent?: string;
  size?: "sm" | "md" | "lg";
  run: () => void;
};

/**
 * One horizon item, or a cluster of close ones, with what each lets the
 * member do. Rooms supply the words (lane name, notes) and the actions.
 */
export function HorizonItemSheet<T extends HorizonItem>({
  items,
  onClose,
  emptyTitle,
  accent,
  look,
  laneOf,
  badges,
  note,
  actions,
}: {
  items: readonly T[] | null;
  /** Keep this stable (useCallback): the sheet's focus effect re-runs when it changes. */
  onClose: () => void;
  /** The dialog's name while nothing is open. */
  emptyTitle: string;
  accent?: string;
  look: HorizonLook;
  laneOf: (item: T) => { name: string; accent: string };
  badges?: (item: T) => ReactNode;
  note?: (item: T) => ReactNode;
  actions: (item: T) => HorizonSheetAction[];
}) {
  const list = items ?? [];
  const open = list.length > 0;
  const title = list.length === 1 ? list[0].label : list.length > 1 ? `${list.length} items from ${list[0].timeLabel}` : emptyTitle;

  return (
    <ReserveBottomSheet open={open} onClose={onClose} title={title} accent={accent}>
      <ul className="flex flex-col">
        {list.map((item, i) => {
          const chip = CHIP_STATUS[item.status];
          const lane = laneOf(item);
          const itemActions = actions(item);
          return (
            <li key={item.id} className={`py-3 ${i > 0 ? "border-t border-white/[0.06]" : ""}`}>
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <span className={look.sheet.timeClass}>{item.timeLabel}</span>
                <span className={look.sheet.laneClass} style={{ color: alpha(lane.accent, look.sheet.laneAlpha) }}>
                  {lane.name}
                </span>
                {chip ? <ReserveStatusChip status={chip} /> : <span className={look.sheet.statusClass}>{STATUS_WORD[item.status]}</span>}
                {badges?.(item)}
              </div>
              {list.length > 1 && <p className="mt-1.5 text-[14px] font-semibold text-[#f2eee6]">{item.label}</p>}
              {item.sub && <p className="mt-1 text-[13px] leading-[1.5] text-white/60">{item.sub}</p>}
              {note?.(item)}
              {itemActions.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {itemActions.map((action) => (
                    <ReserveButton
                      key={action.key}
                      tier={action.tier}
                      size={action.size}
                      accent={action.accent}
                      onClick={() => {
                        onClose();
                        action.run();
                      }}
                    >
                      {action.label}
                    </ReserveButton>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </ReserveBottomSheet>
  );
}
