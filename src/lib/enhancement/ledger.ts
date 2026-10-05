import type { DoseAnchors } from "@/lib/enhancement/dose-timing";
import {
  EnhancementAdherenceRecord,
  EnhancementEntry,
  InjectionLogRecord,
} from "@/lib/athlete-store";
import { computeInventory } from "@/lib/enhancement/inventory";
import {
  getEnhancementDailySchedule,
  resolveScheduleRuleForDate,
  todayDateString,
} from "@/lib/enhancement/schedule";

export type CompoundLedgerStatus =
  | "Upcoming"
  | "Due Now"
  | "Completed"
  | "Skipped"
  | "Missed"
  | "Rescheduled"
  | "Manual Only"
  | "Review Required"
  | "Inventory Alert"
  | "Site Log Needed";

export type CompoundScheduleLedgerEvent = {
  eventId: string;
  entryId: string;
  entry: EnhancementEntry;
  plannedDate: string;
  plannedTime: string;
  plannedTimeLabel: string;
  status: CompoundLedgerStatus;
  loggedAt?: string;
  skippedAt?: string;
  isMissed: boolean;
  isUpcoming: boolean;
  needsSiteLog: boolean;
  inventoryImpact: string;
  reviewReason?: string;
};

type LedgerInput = {
  entries: EnhancementEntry[];
  adherence: EnhancementAdherenceRecord[];
  injectionLogs: InjectionLogRecord[];
  dateRange: { start: Date; days: number };
  wakeTime?: string;
  sleepTime?: string;
  preferredGymTime?: string;
  trainingDaysOfWeek?: number[];
  now?: Date;
  /** The member's day for dose rules set against a meal, waking or bed (useDoseAnchors). */
  anchors?: DoseAnchors;
};

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function timeToMinutes(value: string): number | null {
  if (!value || value === "—") return null;
  const [hh, mm] = value.split(":").map((part) => parseInt(part, 10));
  if (!Number.isFinite(hh)) return null;
  return hh * 60 + (Number.isFinite(mm) ? mm : 0);
}

function statusForEvent(input: {
  entry: EnhancementEntry;
  plannedDate: string;
  plannedTime: string;
  adherence?: EnhancementAdherenceRecord;
  now: Date;
  needsSiteLog: boolean;
  inventoryAlert: boolean;
  reviewReason?: string;
}): CompoundLedgerStatus {
  if (input.entry.scheduleRule?.type === "manual_only" || input.entry.frequencyType === "custom") return "Manual Only";
  if (input.reviewReason) return "Review Required";
  if (input.adherence?.takenStatus === "taken") return input.needsSiteLog ? "Site Log Needed" : input.inventoryAlert ? "Inventory Alert" : "Completed";
  if (input.adherence?.takenStatus === "skipped") return "Skipped";

  const today = todayDateString();
  const plannedMinutes = timeToMinutes(input.plannedTime);
  const nowMinutes = input.now.getHours() * 60 + input.now.getMinutes();
  if (input.plannedDate < today) return "Missed";
  if (input.plannedDate > today) return "Upcoming";
  if (plannedMinutes === null) return "Review Required";
  if (nowMinutes - plannedMinutes > 60) return "Missed";
  if (Math.abs(nowMinutes - plannedMinutes) <= 90) return "Due Now";
  return "Upcoming";
}

export function buildCompoundScheduleLedger(input: LedgerInput): CompoundScheduleLedgerEvent[] {
  const now = input.now ?? new Date();
  const events: CompoundScheduleLedgerEvent[] = [];

  for (let i = 0; i < input.dateRange.days; i += 1) {
    const date = new Date(input.dateRange.start);
    date.setDate(date.getDate() + i);
    date.setHours(0, 0, 0, 0);
    const plannedDate = dateKey(date);
    const slots = getEnhancementDailySchedule({
      entries: input.entries,
      adherence: input.adherence,
      date: plannedDate,
      wakeTime: input.wakeTime,
      sleepTime: input.sleepTime,
      preferredGymTime: input.preferredGymTime,
      trainingDaysOfWeek: input.trainingDaysOfWeek,
      anchors: input.anchors,
    });

    for (const slot of slots) {
      const review = resolveScheduleRuleForDate(slot.entry.scheduleRule, date, input.trainingDaysOfWeek, slot.entry.startDate);
      const hasSiteLog = input.injectionLogs.some((log) => log.entryId === slot.entryId && log.date === plannedDate);
      const needsSiteLog = slot.entry.route === "injectable" && slot.status === "taken" && !hasSiteLog;
      const inventory = computeInventory({ entry: slot.entry, adherence: input.adherence, today: now });
      const inventoryAlert = inventory.configured && ["reorder-now", "reorder-soon", "out"].includes(inventory.status);
      const status = statusForEvent({
        entry: slot.entry,
        plannedDate,
        plannedTime: slot.plannedTime,
        adherence: slot.adherence,
        now,
        needsSiteLog,
        inventoryAlert,
        reviewReason: review?.reviewRequired ? review.reviewReason ?? "Schedule Review Required" : slot.entry.scheduleReviewReason,
      });

      events.push({
        eventId: `${slot.entryId}-${plannedDate}-${slot.plannedTime}`,
        entryId: slot.entryId,
        entry: slot.entry,
        plannedDate,
        plannedTime: slot.plannedTime,
        plannedTimeLabel: slot.plannedTimeLabel,
        status,
        loggedAt: slot.adherence?.takenStatus === "taken" ? slot.adherence.actualTime ?? slot.adherence.createdAt : undefined,
        skippedAt: slot.adherence?.takenStatus === "skipped" ? slot.adherence.actualTime ?? slot.adherence.createdAt : undefined,
        isMissed: status === "Missed",
        isUpcoming: status === "Upcoming",
        needsSiteLog,
        inventoryImpact: inventory.configured
          ? `${slot.status === "taken" ? "Decremented" : "Preview"} · ${inventory.remainingMg !== null ? `${inventory.remainingMg.toFixed(1)} mg remaining` : "configured"}`
          : "Not configured",
        reviewReason: status === "Review Required" ? review?.reviewReason ?? slot.entry.scheduleReviewReason ?? "Schedule Review Required" : undefined,
      });
    }
  }

  return events.sort((a, b) => `${a.plannedDate}T${a.plannedTime}`.localeCompare(`${b.plannedDate}T${b.plannedTime}`));
}
