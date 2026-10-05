"use client";

import { Moon } from "lucide-react";

import { LANE_ACCENT, LANE_NAME, clockLabel } from "@/components/apex/pit-wall/format";
import { ReserveHorizon, type ReserveHorizonView } from "@/components/ui/reserve/horizon";
import { RESERVE, alpha } from "@/lib/design/tokens";
import type { RecoveryHorizon, RecoveryHorizonAction, RecoveryHorizonItem } from "@/lib/recovery/tonight-horizon";

/* ════════════════════════════════════════════════════════════════════════
   RECOVERY HORIZON STRIP — tonight, receding toward sleep lock.

   The shared horizon (`ReserveHorizon`) at the foot of the Recovery hero.
   What sits on the track comes from `tonight-horizon.ts`; this file only says
   what the lanes are called and what each item's sheet says and does.
   ════════════════════════════════════════════════════════════════════════ */

export function RecoveryHorizonStrip({
  horizon,
  onAction,
}: {
  /** Null until the client clock mounts. */
  horizon: RecoveryHorizon | null;
  onAction: (action: RecoveryHorizonAction) => void;
}) {
  const view: ReserveHorizonView<RecoveryHorizonItem> =
    horizon === null
      ? { state: "pending" }
      : horizon.state === "quiet"
        ? { state: "quiet", headline: horizon.headline, detail: horizon.detail, icon: Moon, iconColor: alpha(RESERVE.violet, 0.8) }
        : {
            state: "track",
            window: horizon.window,
            nowMin: horizon.nowMin,
            sleepLockMin: horizon.sleepLock.min,
            items: horizon.items,
            lanes: horizon.lanes.map((lane) => ({
              id: lane.id,
              name: LANE_NAME[lane.id],
              accent: LANE_ACCENT[lane.id],
              ariaLabel: `${LANE_NAME[lane.id]} tonight`,
              items: lane.items,
              empty: <span className="truncate text-[12px] text-white/60">Clear until sleep lock</span>,
            })),
          };

  return (
    <ReserveHorizon
      hook={{ "data-recovery": "horizon" }}
      title="Tonight · toward sleep lock"
      accent={RESERVE.violet}
      meta={horizon ? `Now ${clockLabel(horizon.nowMin)} · Sleep lock ${horizon.sleepLock.label}` : null}
      view={view}
      holdLanes={2}
      noun="tonight"
      floorOpacity={0.09}
      quietTint={0.05}
      opens={(item) => item.actions.length > 0}
      laneOf={(item) => ({ name: LANE_NAME[item.lane], accent: LANE_ACCENT[item.lane] })}
      sheet={{
        note: (item) =>
          item.source === "suite" ? (
            <p className="mt-1.5 text-[12px] leading-[1.5] text-white/55">Recovery Suite · marking it done records it in today&apos;s log.</p>
          ) : null,
        actions: (item) =>
          item.actions.map((action) => ({
            key: `${action.kind}-${action.label}`,
            label: action.label,
            tier: "secondary",
            accent: RESERVE.violet,
            run: () => onAction(action),
          })),
      }}
    />
  );
}
