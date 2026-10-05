/* ════════════════════════════════════════════════════════════════════════
   APEX TODAY — the contract between the day resolver and the Pit Wall.

   One clock, one decision. `resolveApexToday()` (today-resolver.ts) is the
   only producer of this shape; the Pit Wall is its only reader. The shape is
   presentation-ready but UI-free: no icons, no colours, no closures. Actions
   are described, never bound — the view decides how to carry them out.
   ════════════════════════════════════════════════════════════════════════ */

import type { StrategistSignal } from "@/lib/ai-strategist/types";
import type { SessionMode } from "@/lib/athlete-store";
import type { EnhancementScheduleSlot } from "@/lib/enhancement/schedule";
import type { PlannedFuelMeal } from "@/lib/nutrition/fuel-plan";
import type { TrainingScheduleContext } from "@/lib/schedule/engine";
import type { MemberScheduleProfile } from "@/lib/schedule/types";
import type { TrainingWeekDay } from "@/lib/training/weekly-split";

export type ApexLaneId = "training" | "fuel" | "recovery" | "sleep" | "logbook";

/** Bible §11 canonical status set. */
export type ApexItemStatus = "due-now" | "due-next" | "upcoming" | "past-due" | "completed" | "skipped";

/** The only destinations the day resolver routes to. */
export type ApexTargetView = "training" | "nutrition" | "recovery" | "schedule-command" | "supplements";

/** An item's one action. Described, never bound. */
export type ApexAction =
  | { kind: "log-meal"; label: string; mealId: string }
  | { kind: "undo-meal-log"; label: string; mealId: string }
  | { kind: "start-session"; label: string }
  | { kind: "review-session"; label: string }
  | { kind: "mark-logged"; label: string; entryId: string; plannedTime: string }
  | { kind: "open-view"; label: string; view: ApexTargetView };

export type ApexLaneItem = {
  /** Stable id: `meal-{mealId}`, `session`, `protocol-{key}`, `sched-{label-slug}`, `log-{slotId}`. */
  id: string;
  lane: ApexLaneId;
  /** What the item is — "Pre-Workout", "Legs + Abs", "Sauna". */
  label: string;
  /** One supporting line — the meal's name, "90 min", "After-session protocol". */
  sub: string | null;
  /** Minutes from midnight. Items after midnight carry values above 1440. */
  startMin: number;
  /** End of a ranged item (the session); null for a point in time. */
  endMin: number | null;
  /** "4:00 PM". */
  timeLabel: string;
  status: ApexItemStatus;
  action: ApexAction | null;
  /** Member-entered logbook item. Never drives the Next Move, the risk line, or any colour grade. */
  logOnly: boolean;
};

export type ApexLane = {
  id: ApexLaneId;
  label: string;
  items: ApexLaneItem[];
  /** Why the lane is empty, and the one move that fills it. Null when the lane has items. */
  empty: { message: string; action: ApexAction | null } | null;
};

export type ApexRiskLevel = "Low" | "Moderate" | "Elevated" | "Sleep compression";

export type ApexNextMove = {
  title: string;
  /** Specific, never filler: names the window, the time, or the meal. */
  whyNow: string;
  /** Whisper context — "Fuel window · Due now". */
  context: string;
  /** The lane item this move comes from, when it has one. */
  itemId: string | null;
  action: ApexAction | null;
};

export type ApexToday = {
  /** Now, in the lanes' minute space (after-midnight adjusted). */
  nowMin: number;
  /** True only when a session is planned today: not a recovery day, not moved away or set aside. */
  trainingPlanned: boolean;
  /** The visible range of the timeline. */
  window: { startMin: number; endMin: number };
  /** Actionable day items that fell before the window. */
  earlier: { done: number; total: number };
  /** Always training, fuel, recovery, sleep — then logbook only when the member has intake entries. */
  lanes: ApexLane[];
  nextMove: ApexNextMove;
  /** The day item after the Next Move's item, for "Then · …". */
  then: ApexLaneItem | null;
  risk: { level: ApexRiskLevel; detail: string };
  sleepLock: { min: number; label: string };
};

export type ApexTodayInput = {
  now: Date;
  schedule: MemberScheduleProfile;
  trainingContext: Pick<TrainingScheduleContext, "trainingPlanned" | "direction">;
  /** The edit-aware day — the same day the week rail renders. */
  today: Pick<TrainingWeekDay, "recovery" | "sessionName" | "durationMin" | "protocol" | "activity">;
  sessionMode: SessionMode;
  meals: ReadonlyArray<Pick<PlannedFuelMeal, "id" | "windowLabel" | "time" | "name" | "isSnack" | "optional">>;
  loggedMealIds: readonly string[];
  intakeSlots: ReadonlyArray<
    Pick<EnhancementScheduleSlot, "id" | "entryId" | "plannedTime" | "plannedTimeLabel" | "status"> & {
      entry: Pick<EnhancementScheduleSlot["entry"], "name" | "displayName" | "officialName">;
    }
  >;
  watchSignals: ReadonlyArray<Pick<StrategistSignal, "title" | "severity">>;
};
