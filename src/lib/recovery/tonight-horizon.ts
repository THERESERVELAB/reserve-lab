/* ════════════════════════════════════════════════════════════════════════
   TONIGHT HORIZON — what the Recovery hero's horizon strip shows.

   Pure and deterministic. Reads the schedule engine's recovery and sleep
   markers (post-session handoff, downshift or evening wind-down, sleep lock)
   and the Recovery Suite as the recovery engine classified it, and returns
   the items that stand between now and sleep lock. No store, no React, no
   clock of its own: `input.now` is the only time it reads.

   Honest by construction:
     - Suite tools carry no time of their own, so each one is anchored to the
       schedule marker it belongs with and says so ("with Evening Wind-Down").
     - Only tools the engine flagged for today, or that the member already
       marked done, appear. A member with no logs gets no suite items at all:
       the caller passes an empty suite rather than a guess.
     - Every item carries at least one real action. Before wake or after
       sleep lock there is no track: a quiet state says why.

   Log-only: actions record what the member did or open an existing screen.
   The minute space matches the Apex day resolver, so both screens place
   sleep lock on the same minute.
   ════════════════════════════════════════════════════════════════════════ */

import type { ApexItemStatus, ApexLaneItem } from "@/lib/apex/today-types";
import {
  buildTodaySchedule,
  formatTime12,
  minutesToTime,
  timeToMinutes,
  type TrainingScheduleContext,
} from "@/lib/schedule/engine";
import type { MemberScheduleProfile } from "@/lib/schedule/types";

import type { RecoverySuiteTool } from "./types";

export type RecoveryHorizonLaneId = "recovery" | "sleep";

/** The only screens the horizon routes to. */
export type RecoveryHorizonView = "training" | "schedule-command";

/** One thing opening an item lets the member do. Described, never bound. */
export type RecoveryHorizonAction =
  | { kind: "toggle-suite-tool"; label: string; toolId: string }
  | { kind: "log-hydration"; label: string; oz: number }
  | { kind: "open-view"; label: string; view: RecoveryHorizonView };

/**
 * An item on tonight's horizon. Shaped as an Apex lane item so the shared
 * horizon projection lays it out; `action` stays null and `actions` carries
 * what the item opens.
 */
export type RecoveryHorizonItem = Omit<ApexLaneItem, "lane"> & {
  lane: RecoveryHorizonLaneId;
  source: "schedule" | "suite";
  actions: RecoveryHorizonAction[];
};

export type RecoveryHorizonClock = { min: number; label: string };

export type RecoveryHorizonLane = { id: RecoveryHorizonLaneId; label: string; items: RecoveryHorizonItem[] };

export type RecoveryHorizon =
  | {
      state: "quiet";
      reason: "before-wake" | "after-sleep-lock";
      nowMin: number;
      headline: string;
      detail: string;
      wake: RecoveryHorizonClock;
      sleepLock: RecoveryHorizonClock;
    }
  | {
      state: "track";
      nowMin: number;
      /** The visible range: a short look back behind now, ending just after sleep lock. */
      window: { startMin: number; endMin: number };
      /** Always recovery, then sleep. */
      lanes: RecoveryHorizonLane[];
      /** Every item on the track in time order: the phone list reads this. */
      items: RecoveryHorizonItem[];
      /** Items from earlier today that fell before the window. */
      earlier: number;
      wake: RecoveryHorizonClock;
      sleepLock: RecoveryHorizonClock;
    };

export type RecoveryHorizonInput = {
  now: Date;
  schedule: MemberScheduleProfile;
  trainingContext: Pick<TrainingScheduleContext, "trainingPlanned" | "direction">;
  /** Today is a recovery day in the program week. */
  recoveryDay: boolean;
  /** The Recovery Suite as the engine classified it. Pass [] when the member has no logged evidence. */
  suite: ReadonlyArray<Pick<RecoverySuiteTool, "id" | "name" | "durationLabel" | "recommendation" | "completed">>;
};

export const RECOVERY_HORIZON = {
  /** Minutes of the day kept visible behind the now gate. */
  lookBackMin: 90,
  /** Minutes drawn past sleep lock, so the lock is never on the track's edge. */
  tailMin: 20,
  /** The amount a hydration check logs. It is in the action's label. */
  hydrationOz: 16,
} as const;

const LANES: ReadonlyArray<{ id: RecoveryHorizonLaneId; label: string }> = [
  { id: "recovery", label: "Recovery" },
  { id: "sleep", label: "Sleep" },
];

const SLEEP_ITEM_ID = "sched-sleep-target";
const WIND_DOWN = "Evening Wind-Down";

const fmt = (min: number): string => formatTime12(minutesToTime(min));

const slug = (label: string): string =>
  label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const sentenceCase = (text: string): string => (text ? text.charAt(0).toUpperCase() + text.slice(1) : text);

/** Same thresholds as the Apex day resolver: over 30 min late, due within 20 min, else upcoming. */
function pointStatus(startMin: number, nowMin: number): ApexItemStatus {
  const delta = startMin - nowMin;
  if (delta < -30) return "past-due";
  if (delta <= 20) return "due-now";
  return "upcoming";
}

/** The earliest upcoming item becomes due-next. Items arrive time-sorted, so the first wins a tie. */
function promoteDueNext(items: readonly RecoveryHorizonItem[]): void {
  const next = items.find((item) => item.status === "upcoming");
  if (next) next.status = "due-next";
}

const openSchedule = (label: string): RecoveryHorizonAction => ({ kind: "open-view", label, view: "schedule-command" });

/** What a schedule marker opens. Every marker gets one: the schedule owns its time. */
function markerActions(scheduleLabel: string): RecoveryHorizonAction[] {
  switch (scheduleLabel) {
    case "Sleep Target":
      return [openSchedule("Adjust Sleep Target")];
    case "Post-Session Handoff":
      return [{ kind: "open-view", label: "Open Training Command", view: "training" }];
    case "Hydration Check":
      return [{ kind: "log-hydration", label: `Log ${RECOVERY_HORIZON.hydrationOz} oz Water`, oz: RECOVERY_HORIZON.hydrationOz }];
    default:
      return [openSchedule("Open Schedule")];
  }
}

/** Suite tools that belong to another room never sit on tonight's recovery horizon. */
const NOT_TONIGHT: ReadonlySet<string> = new Set(["recovery-nutrition"]);

type Anchor = "now" | "first-recovery" | "downshift" | "wind-down";

/** Where a suite tool sits. Unlisted tools sit with the next recovery marker. */
const TOOL_PLACE: Record<string, { anchor: Anchor; lane: RecoveryHorizonLaneId }> = {
  hydration: { anchor: "now", lane: "recovery" },
  "mobility-reset": { anchor: "first-recovery", lane: "recovery" },
  stretching: { anchor: "first-recovery", lane: "recovery" },
  sauna: { anchor: "first-recovery", lane: "recovery" },
  walking: { anchor: "downshift", lane: "recovery" },
  breathwork: { anchor: "downshift", lane: "recovery" },
  "sleep-protection": { anchor: "wind-down", lane: "sleep" },
};

export function buildRecoveryHorizon(input: RecoveryHorizonInput): RecoveryHorizon {
  const { schedule } = input;

  /* ── Minute space. A sleep target after midnight counts on past 1440, so a
        clock time before wake on such a day belongs to the end of today. ── */
  const wakeMin = timeToMinutes(schedule.wakeTime);
  const sleepRaw = timeToMinutes(schedule.sleepTarget);
  const sleepMin = sleepRaw < 360 ? sleepRaw + 1440 : sleepRaw;
  const dayMin = (raw: number): number => (raw < wakeMin && sleepMin > 1440 ? raw + 1440 : raw);
  const nowMin = dayMin(input.now.getHours() * 60 + input.now.getMinutes());
  const wake: RecoveryHorizonClock = { min: wakeMin, label: fmt(wakeMin) };
  const sleepLock: RecoveryHorizonClock = { min: sleepMin, label: fmt(sleepMin) };

  /* ── Outside the day: an honest quiet state, never an empty track. ── */
  if (nowMin < wakeMin) {
    return {
      state: "quiet",
      reason: "before-wake",
      nowMin,
      headline: "Before wake",
      detail: `Nothing is due before your ${wake.label} wake. Sleep lock tonight is ${sleepLock.label}.`,
      wake,
      sleepLock,
    };
  }
  if (nowMin >= sleepMin) {
    return {
      state: "quiet",
      reason: "after-sleep-lock",
      nowMin,
      headline: "Past sleep lock",
      detail: `Sleep lock was ${sleepLock.label}. Tonight's horizon is closed; it reopens after your ${wake.label} wake.`,
      wake,
      sleepLock,
    };
  }

  /* ── Schedule markers: the recovery and sleep entries of today's schedule. ── */
  const trainingPlanned = input.trainingContext.trainingPlanned && !input.recoveryDay;
  const markers: RecoveryHorizonItem[] = [];
  for (const entry of buildTodaySchedule(schedule, { trainingPlanned, direction: input.trainingContext.direction })) {
    if (entry.kind !== "recovery" && entry.kind !== "sleep") continue;
    const isSleep = entry.kind === "sleep";
    const startMin = dayMin(entry.minutes);
    markers.push({
      id: `sched-${slug(entry.label)}`,
      lane: isSleep || entry.label === WIND_DOWN ? "sleep" : "recovery",
      label: isSleep ? "Sleep Lock" : entry.label,
      sub: entry.sub ?? null,
      startMin,
      endMin: null,
      timeLabel: fmt(startMin),
      status: pointStatus(startMin, nowMin),
      action: null,
      logOnly: false,
      source: "schedule",
      actions: markerActions(entry.label),
    });
  }

  /* ── Suite tools, each anchored to a marker still ahead of now. ── */
  const ahead = markers.filter((marker) => marker.startMin >= nowMin);
  const recoveryAhead = ahead.filter((marker) => marker.lane === "recovery");
  const windDown = ahead.find((marker) => marker.label === WIND_DOWN) ?? null;
  const sleepMarker = markers.find((marker) => marker.id === SLEEP_ITEM_ID) ?? null;
  const anchorFor = (anchor: Anchor): RecoveryHorizonItem | null => {
    switch (anchor) {
      case "now":
        return null;
      case "first-recovery":
        return recoveryAhead[0] ?? windDown;
      case "downshift":
        return windDown ?? recoveryAhead[recoveryAhead.length - 1] ?? null;
      case "wind-down":
        return windDown ?? sleepMarker;
    }
  };

  const tools: RecoveryHorizonItem[] = [];
  for (const tool of input.suite) {
    if (NOT_TONIGHT.has(tool.id)) continue;
    if (!tool.completed && tool.recommendation !== "recommended") continue;
    const place = TOOL_PLACE[tool.id] ?? { anchor: "first-recovery", lane: "recovery" };
    const marker = anchorFor(place.anchor);
    const startMin = marker ? marker.startMin : nowMin;
    const when = sentenceCase(tool.durationLabel);
    tools.push({
      id: `suite-${tool.id}`,
      lane: place.lane,
      label: tool.name,
      sub: marker ? `${when} · with ${marker.label}` : when,
      startMin,
      endMin: null,
      timeLabel: fmt(startMin),
      status: tool.completed ? "completed" : pointStatus(startMin, nowMin),
      action: null,
      logOnly: false,
      source: "suite",
      actions: [{ kind: "toggle-suite-tool", label: tool.completed ? "Mark Not Done" : "Mark Done", toolId: tool.id }],
    });
  }

  /* ── Window and order: time first, then the schedule marker before the tool anchored to it. ── */
  const window = {
    startMin: Math.max(wakeMin, nowMin - RECOVERY_HORIZON.lookBackMin),
    endMin: sleepMin + RECOVERY_HORIZON.tailMin,
  };
  const all = [...markers, ...tools];
  const items = all
    .filter((item) => item.startMin >= window.startMin)
    .sort((a, b) => a.startMin - b.startMin || (a.source === b.source ? 0 : a.source === "schedule" ? -1 : 1));
  promoteDueNext(items);

  return {
    state: "track",
    nowMin,
    window,
    lanes: LANES.map((lane) => ({ ...lane, items: items.filter((item) => item.lane === lane.id) })),
    items,
    earlier: all.length - items.length,
    wake,
    sleepLock,
  };
}
