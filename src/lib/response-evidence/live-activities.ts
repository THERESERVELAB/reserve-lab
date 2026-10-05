/* ════════════════════════════════════════════════════════════════════════
   LIVE ACTIVITY → RESPONSE EVIDENCE ADAPTER

   Rebuilds dated activity occurrences from the existing Program Horizon,
   recurring-activity state, immutable revisions, execution ledger, and
   Reserve decision ledger. It does not own activity state.
   ════════════════════════════════════════════════════════════════════════ */

import type { ProgramHorizon } from "@/lib/horizon/types";
import type { AthleteActivity } from "@/lib/schedule/activity-reconciliation";
import type {
  ReserveDecisionRecord,
  SessionExecutionRecord,
} from "@/lib/training/session-execution";

import type { ResponseActivity } from "./types";

type ActivitySourceState = {
  activity: AthleteActivity;
  revisionId?: string;
  effectiveWeek?: number;
  programStartDate?: string;
  acceptedAt?: string;
  cancelledAt?: string;
  declined: boolean;
};

export type LiveResponseActivityResolution = {
  activities: ResponseActivity[];
  sourceActivityIds: string[];
  revisionIds: string[];
  excluded: Array<{ activityId: string; reason: string }>;
};

export type LiveResponseActivityInput = {
  horizon: ProgramHorizon | null;
  recurringActivities: AthleteActivity[];
  decisions: ReserveDecisionRecord[];
  executionRecords: SessionExecutionRecord[];
  now: string;
};

const DAY_MS = 86_400_000;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function mondayStart(dateKey: string): number | null {
  const parsed = Date.parse(`${dateKey}T00:00:00.000Z`);
  if (Number.isNaN(parsed)) return null;
  const date = new Date(parsed);
  const day = date.getUTCDay();
  return parsed - (day === 0 ? 6 : day - 1) * DAY_MS;
}

export function activityOccurrenceDate(
  programStartDate: string,
  weekNumber: number,
  dayOfWeek: number,
): string | undefined {
  const start = mondayStart(programStartDate);
  if (start == null || weekNumber < 1 || dayOfWeek < 0 || dayOfWeek > 6) return undefined;
  return new Date(start + ((weekNumber - 1) * 7 + dayOfWeek) * DAY_MS).toISOString().slice(0, 10);
}

function activityTimestamp(activity: AthleteActivity): number | null {
  if (!activity.date) return null;
  const time = activity.startTime && /^\d{2}:\d{2}$/.test(activity.startTime)
    ? activity.startTime
    : "12:00";
  const timestamp = Date.parse(`${activity.date}T${time}:00.000Z`);
  return Number.isNaN(timestamp) ? null : timestamp;
}

function currentWeekFor(startDate: string, now: string, totalWeeks: number): number {
  const start = mondayStart(startDate);
  const current = mondayStart(now.slice(0, 10));
  if (start == null || current == null) return 1;
  return Math.max(1, Math.min(totalWeeks, Math.floor((current - start) / (7 * DAY_MS)) + 1));
}

function materialize(
  source: ActivitySourceState,
  horizon: ProgramHorizon | null,
  now: string,
): ResponseActivity[] {
  const activity = source.activity;
  const nowTime = Date.parse(now);
  const cancelTime = source.cancelledAt ? Date.parse(source.cancelledAt) : null;
  const withinTimeWindow = (candidate: AthleteActivity): boolean => {
    const timestamp = activityTimestamp(candidate);
    if (timestamp == null) return true;
    if (!Number.isNaN(nowTime) && timestamp > nowTime) return false;
    return cancelTime == null || Number.isNaN(cancelTime) || timestamp <= cancelTime;
  };
  const occurrence = (
    candidate: AthleteActivity,
    weekNumber?: number,
  ): ResponseActivity => ({
    ...clone(candidate),
    id: weekNumber == null
      ? candidate.id
      : `${activity.id}:W${weekNumber}:${candidate.date ?? "date-missing"}`,
    sourceActivityId: activity.id,
    revisionId: source.revisionId,
    occurrenceWeekNumber: weekNumber,
  });

  if (activity.recurrence === "one-time") {
    return withinTimeWindow(activity) ? [occurrence(activity, source.effectiveWeek)] : [];
  }

  const startDate = source.programStartDate ?? horizon?.startDate;
  const dayOfWeek = activity.dayOfWeek;
  if (!startDate || dayOfWeek == null || !horizon) {
    // Preserve missing details as missing. One undated observation can remain
    // visible to data-quality surfaces but cannot create proximity evidence.
    return cancelTime == null ? [occurrence({ ...activity, date: undefined })] : [];
  }

  const firstWeek = Math.max(1, source.effectiveWeek ?? 1);
  const lastWeek = currentWeekFor(startDate, now, horizon.totalWeeks);
  const output: ResponseActivity[] = [];
  for (let week = firstWeek; week <= lastWeek; week += 1) {
    if (activity.recurrence === "biweekly" && (week - firstWeek) % 2 !== 0) continue;
    if (activity.recurrence === "custom" && activity.date == null) continue;
    const date = activity.recurrence === "custom" && activity.date
      ? activity.date
      : activityOccurrenceDate(startDate, week, dayOfWeek);
    const candidate = { ...activity, date };
    if (!withinTimeWindow(candidate)) continue;
    output.push(occurrence(candidate, week));
    if (activity.recurrence === "custom") break;
  }
  return output;
}

/** Resolve only activities the athlete actually accepted. Declined proposals
    never enter evidence; cancellation closes a recurring series at the real
    cancellation timestamp while preserving earlier occurrences. */
export function resolveLiveResponseActivities(
  input: LiveResponseActivityInput,
): LiveResponseActivityResolution {
  const sources = new Map<string, ActivitySourceState>();
  const excluded: LiveResponseActivityResolution["excluded"] = [];

  for (const revision of input.horizon?.revisions ?? []) {
    if (!revision.activity || !revision.athleteConfirmed) continue;
    sources.set(revision.activity.id, {
      activity: clone(revision.activity),
      revisionId: revision.id,
      effectiveWeek: revision.effectiveWeek,
      programStartDate: input.horizon?.startDate,
      acceptedAt: revision.createdAt,
      declined: false,
    });
  }

  for (const activity of input.recurringActivities) {
    if (sources.has(activity.id)) continue;
    sources.set(activity.id, {
      activity: clone(activity),
      programStartDate: input.horizon?.startDate,
      acceptedAt: input.horizon?.generatedAt,
      declined: false,
    });
  }

  for (const decision of [...input.decisions].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    const metadata = decision.activity;
    if (!metadata) continue;
    const existing = sources.get(metadata.activityId);
    if (metadata.status === "accepted") {
      sources.set(metadata.activityId, {
        activity: clone(metadata.snapshot),
        revisionId: metadata.revisionId,
        effectiveWeek: metadata.effectiveWeek,
        programStartDate: metadata.programStartDate,
        acceptedAt: decision.createdAt,
        cancelledAt: existing?.cancelledAt,
        declined: false,
      });
    } else if (metadata.status === "cancelled") {
      sources.set(metadata.activityId, {
        activity: clone(existing?.activity ?? metadata.snapshot),
        revisionId: existing?.revisionId ?? metadata.revisionId,
        effectiveWeek: existing?.effectiveWeek ?? metadata.effectiveWeek,
        programStartDate: existing?.programStartDate ?? metadata.programStartDate,
        acceptedAt: existing?.acceptedAt,
        cancelledAt: decision.createdAt,
        declined: existing ? existing.declined : false,
      });
    } else if (!existing) {
      sources.set(metadata.activityId, {
        activity: clone(metadata.snapshot),
        revisionId: metadata.revisionId,
        effectiveWeek: metadata.effectiveWeek,
        programStartDate: metadata.programStartDate,
        declined: true,
      });
    }
  }

  const replacementIds = new Set(
    input.executionRecords
      .filter((record) => record.status === "replaced" && record.replacementActivityId)
      .map((record) => record.replacementActivityId as string),
  );

  const activities: ResponseActivity[] = [];
  for (const [activityId, source] of [...sources.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    if (source.declined) {
      excluded.push({ activityId, reason: "The athlete declined the activity reconciliation." });
      continue;
    }
    const occurrences = materialize(source, input.horizon, input.now).map((activity) => ({
      ...activity,
      // Retain the canonical relationship. Replacement linkage is proven by
      // the execution ledger, never inferred from a title.
      relationship: replacementIds.has(activity.sourceActivityId ?? activity.id)
        ? "replace" as const
        : activity.relationship,
    }));
    activities.push(...occurrences);
  }

  const byId = new Map(activities.map((activity) => [activity.id, activity]));
  const resolved = [...byId.values()].sort((a, b) =>
    `${a.date ?? "9999"}:${a.startTime ?? "99:99"}:${a.id}`.localeCompare(
      `${b.date ?? "9999"}:${b.startTime ?? "99:99"}:${b.id}`,
    ),
  );
  return {
    activities: resolved,
    sourceActivityIds: [...new Set(resolved.map((activity) => activity.sourceActivityId ?? activity.id))].sort(),
    revisionIds: [...new Set(resolved.map((activity) => activity.revisionId).filter((id): id is string => Boolean(id)))].sort(),
    excluded,
  };
}
