"use client";

import { Moon } from "lucide-react";

import { LANE_ACCENT, LANE_NAME, clockLabel } from "@/components/apex/pit-wall/format";
import { ReserveHorizon, type ReserveHorizonView } from "@/components/ui/reserve/horizon";
import { RESERVE, alpha } from "@/lib/design/tokens";
import type { FuelHorizon, FuelHorizonAction, FuelHorizonItem } from "@/lib/nutrition/fuel-horizon";

/* ════════════════════════════════════════════════════════════════════════
   FUEL HORIZON STRIP — today's fuel, receding toward sleep lock.

   The shared horizon (`ReserveHorizon`) at the foot of the Nutrition hero.
   What sits on the track comes from `fuel-horizon.ts`; this file only says
   what the lanes are called and what each item's sheet says and does.
   ════════════════════════════════════════════════════════════════════════ */

const SOURCE_NOTE: Record<FuelHorizonItem["source"], string> = {
  meal: "Today's fuel plan · logging opens a confirmation, and nothing counts until you confirm it.",
  training: "Your training window, from your schedule.",
  sleep: "From your schedule · no meal is planned past sleep lock.",
};

export function FuelHorizonStrip({
  horizon,
  onAction,
}: {
  /** Null until the client clock mounts. */
  horizon: FuelHorizon | null;
  onAction: (action: FuelHorizonAction) => void;
}) {
  const view: ReserveHorizonView<FuelHorizonItem> =
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
              ariaLabel: `${LANE_NAME[lane.id]} today`,
              items: lane.items,
              empty: <span className="text-[12px] text-white/60">Nothing planned until sleep lock</span>,
            })),
          };

  return (
    <ReserveHorizon
      hook={{ "data-nutrition": "horizon" }}
      title="Today's fuel · toward sleep lock"
      accent={RESERVE.green}
      meta={horizon ? `Now ${clockLabel(horizon.nowMin)} · Sleep lock ${horizon.sleepLock.label}` : null}
      view={view}
      holdLanes={2}
      noun="today"
      floorOpacity={0.08}
      className="lg:px-8"
      opens={(item) => item.actions.length > 0}
      laneOf={(item) => ({ name: LANE_NAME[item.lane], accent: LANE_ACCENT[item.lane] })}
      sheet={{
        note: (item) => <p className="mt-1.5 text-[12px] leading-[1.5] text-white/55">{SOURCE_NOTE[item.source]}</p>,
        actions: (item) =>
          item.actions.map((action) => ({
            key: `${action.kind}-${action.label}`,
            label: action.label,
            tier: action.kind === "undo-meal-log" ? "quiet" : "secondary",
            accent: RESERVE.green,
            run: () => onAction(action),
          })),
      }}
    />
  );
}
