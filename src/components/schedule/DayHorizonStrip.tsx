"use client";

import { CalendarClock, Moon } from "lucide-react";

import { LANE_ACCENT, clockLabel } from "@/components/apex/pit-wall/format";
import { ReserveHorizon, type ReserveHorizonView } from "@/components/ui/reserve/horizon";
import { RESERVE, alpha } from "@/lib/design/tokens";
import type { DayHorizon, DayHorizonItem, ScheduleAction } from "@/lib/schedule/day-horizon";

/* ════════════════════════════════════════════════════════════════════════
   DAY HORIZON STRIP — today's plan, receding toward sleep lock.

   The shared horizon (`ReserveHorizon`) at the foot of the Schedule hero.
   What sits on the track comes from `day-horizon.ts`; this file only says
   what the lanes are called and what each item's sheet says and does. An
   unset schedule is a quiet state, never a plan drawn from starting times.
   ════════════════════════════════════════════════════════════════════════ */

const LANE_WORD: Record<DayHorizonItem["lane"], string> = { training: "Training", fuel: "Fuel", sleep: "Sleep" };

const SOURCE_NOTE: Record<DayHorizonItem["source"], string> = {
  wake: "Your wake time, from your schedule · the Sleep Log saves nothing until you set the times.",
  meal: "Today's fuel plan, timed from your schedule · logging opens a confirmation, and nothing counts until you confirm it.",
  training: "Your training window, from your schedule · starting opens Training.",
  sleep: "Your sleep target, from your schedule · no meal is planned past sleep lock.",
};

export function DayHorizonStrip({
  horizon,
  onAction,
}: {
  /** Null until the client clock mounts. */
  horizon: DayHorizon | null;
  onAction: (action: ScheduleAction) => void;
}) {
  const unset = horizon?.state === "quiet" && horizon.reason === "not-set";

  const view: ReserveHorizonView<DayHorizonItem> =
    horizon === null
      ? { state: "pending" }
      : horizon.state === "quiet"
        ? {
            state: "quiet",
            headline: horizon.headline,
            detail: horizon.detail,
            icon: horizon.reason === "not-set" ? CalendarClock : Moon,
            iconColor: horizon.reason === "not-set" ? alpha(RESERVE.gold, 0.85) : alpha(RESERVE.violet, 0.8),
          }
        : {
            state: "track",
            window: horizon.window,
            nowMin: horizon.nowMin,
            sleepLockMin: horizon.sleepLock.min,
            items: horizon.items,
            lanes: horizon.lanes.map((lane) => ({
              id: lane.id,
              name: lane.label,
              accent: LANE_ACCENT[lane.id],
              ariaLabel: `${lane.label} today`,
              items: lane.items,
              empty: <span className="text-[12px] text-white/60">{lane.empty ?? "Nothing planned until sleep lock"}</span>,
            })),
          };

  return (
    <ReserveHorizon
      hook={{ "data-schedule": "horizon" }}
      title="Today's plan · toward sleep lock"
      accent={RESERVE.gold}
      meta={horizon ? `Now ${clockLabel(horizon.nowMin)}${unset ? "" : ` · Sleep lock ${horizon.sleepLock.label}`}` : null}
      view={view}
      holdLanes={3}
      noun="today"
      floorOpacity={0.07}
      className="lg:px-8"
      opens={(item) => item.actions.length > 0}
      laneOf={(item) => ({ name: LANE_WORD[item.lane], accent: LANE_ACCENT[item.lane] })}
      sheet={{
        note: (item) => <p className="mt-1.5 text-[12px] leading-[1.5] text-white/55">{SOURCE_NOTE[item.source]}</p>,
        actions: (item) =>
          item.actions.map((action) => ({
            key: `${action.kind}-${action.label}`,
            label: action.label,
            tier: action.kind === "undo-meal-log" || action.kind === "edit-time" ? "quiet" : "secondary",
            accent: RESERVE.gold,
            run: () => onAction(action),
          })),
      }}
    />
  );
}
