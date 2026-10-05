"use client";

import { ReserveStatusChip } from "@/components/ui/reserve";
import { APEX_HORIZON_LOOK, HorizonItemSheet } from "@/components/ui/reserve/horizon";
import type { ApexAction, ApexLaneItem } from "@/lib/apex/today-types";
import { LANE_ACCENT, LANE_NAME } from "./format";

/**
 * One timeline item — or a cluster of close ones — with each item's single
 * action, in the shared horizon sheet. Actions here are secondary: the
 * screen's one gold action is the Next Move, and a sheet must not compete
 * with it.
 */
export function LaneItemSheet({
  items,
  onClose,
  onAction,
}: {
  items: ApexLaneItem[] | null;
  onClose: () => void;
  onAction: (action: ApexAction) => void;
}) {
  return (
    <HorizonItemSheet
      items={items}
      onClose={onClose}
      emptyTitle=""
      look={APEX_HORIZON_LOOK}
      laneOf={(item) => ({ name: LANE_NAME[item.lane], accent: LANE_ACCENT[item.lane] })}
      badges={(item) => (item.logOnly ? <ReserveStatusChip status="log-only" /> : null)}
      note={(item) =>
        item.logOnly ? (
          <p className="mt-2 text-[11.5px] leading-[1.55] text-white/45">
            Log-only · user-entered schedule. Reserve does not recommend compounds, supplements, vitamins, amounts, or sites.
          </p>
        ) : null
      }
      actions={(item) => {
        const action = item.action;
        return action ? [{ key: action.kind, label: action.label, tier: "secondary", size: "md", run: () => onAction(action) }] : [];
      }}
    />
  );
}
