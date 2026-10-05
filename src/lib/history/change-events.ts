/* ════════════════════════════════════════════════════════════════════════
   CHANGE HISTORY — how the member's plan changed, in their own terms.

   Events are created by the store actions that change a compound, a support
   plan item or a cycle, in the same state update — never by hydration, cloud
   sync or a reset. An event carries only values the member entered. It never
   says why something changed or what a change did.
   ════════════════════════════════════════════════════════════════════════ */

import type { EnhancementEntry } from "@/lib/athlete-store";
import { supportOptionByKey } from "@/lib/compound-intelligence/support-options";
import type { CycleCheckpoint, CyclePeriod } from "@/lib/cycle/cycle-period";
import type { SupportPlanItem } from "@/lib/cycle-review/types";

export const CHANGE_HISTORY_LIMIT = 500;

export type ChangeSubjectKind = "compound" | "support-plan" | "cycle";

export type ChangeAction =
  | "added"
  | "edited"
  | "paused"
  | "resumed"
  | "activated"
  | "deactivated"
  | "removed"
  | "ended"
  | "reopened"
  | "checkpoint-added"
  | "checkpoint-removed"
  /** Brought back from a safety copy on one of the member's devices. */
  | "restored";

export type FieldChange = { field: string; label: string; from: string; to: string };

export type ChangeSubject = { kind: ChangeSubjectKind; id: string; name: string };

export type ChangeEvent = {
  id: string;
  /** ISO timestamp of the change. */
  at: string;
  /** The member's local day, YYYY-MM-DD. */
  date: string;
  subject: ChangeSubject;
  action: ChangeAction;
  changes: FieldChange[];
};

export function localDateOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function makeChangeEvent(input: { at: Date; subject: ChangeSubject; action: ChangeAction; changes?: FieldChange[] }): ChangeEvent {
  return {
    id: `chg-${input.at.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
    at: input.at.toISOString(),
    date: localDateOf(input.at),
    subject: input.subject,
    action: input.action,
    changes: input.changes ?? [],
  };
}

/** Newest first, never more than the limit. Events from one action keep their order, newest on top. */
export function appendChangeEvents(history: ChangeEvent[] | undefined, events: ChangeEvent[]): ChangeEvent[] {
  return [...[...events].reverse(), ...(history ?? [])].slice(0, CHANGE_HISTORY_LIMIT);
}

/* ─── Fields the member entered ───────────────────────────────────────── */

type Field<T> = { field: string; label: string; read: (value: T) => string };

const text = (value: unknown) => (value === undefined || value === null ? "" : String(value).trim());

function diff<T>(before: T, after: T, fields: Field<T>[]): FieldChange[] {
  return fields.flatMap((f) => {
    const from = f.read(before);
    const to = f.read(after);
    return from === to ? [] : [{ field: f.field, label: f.label, from, to }];
  });
}

export function compoundName(entry: Pick<EnhancementEntry, "name" | "displayName" | "officialName">): string {
  return (entry.displayName || entry.officialName || entry.name || "Compound").trim();
}

export function supportItemName(item: Pick<SupportPlanItem, "optionKey" | "customTitle">): string {
  return item.customTitle?.trim() || supportOptionByKey(item.optionKey)?.title || item.optionKey;
}

const COMPOUND_FIELDS: Field<EnhancementEntry>[] = [
  { field: "name", label: "Name", read: compoundName },
  { field: "doseAmount", label: "Amount", read: (e) => text(e.doseAmount) },
  { field: "doseUnit", label: "Unit", read: (e) => text(e.doseUnit) },
  { field: "frequency", label: "Frequency", read: (e) => text(e.frequency) },
  { field: "route", label: "Route", read: (e) => text(e.route) },
  { field: "startDate", label: "Start date", read: (e) => text(e.startDate) },
  { field: "timeOfDayPreference", label: "Time of day", read: (e) => text(e.timeOfDayPreference) },
];

const CYCLE_FIELDS: Field<CyclePeriod>[] = [
  { field: "name", label: "Name", read: (c) => text(c.name) },
  { field: "startDate", label: "Start date", read: (c) => text(c.startDate) },
  { field: "plannedWeeks", label: "Planned weeks", read: (c) => text(c.plannedWeeks) },
  { field: "compoundIds", label: "Linked compounds", read: (c) => String(c.compoundIds.length) },
  { field: "clinicianOversight", label: "Clinician oversight", read: (c) => (c.clinicianOversight ? "yes" : "no") },
];

const SUPPORT_FIELDS: Field<SupportPlanItem>[] = [
  { field: "amount", label: "Amount", read: (i) => text(i.amount) },
  { field: "unit", label: "Unit", read: (i) => text(i.unit) },
  { field: "frequency", label: "Frequency", read: (i) => text(i.frequency) },
  { field: "brand", label: "Product", read: (i) => text(i.brand) },
  { field: "startDate", label: "Start date", read: (i) => text(i.startDate) },
];

/* ─── Event builders ──────────────────────────────────────────────────── */

export function compoundEvent(entry: EnhancementEntry, action: ChangeAction, at: Date): ChangeEvent {
  return makeChangeEvent({ at, subject: { kind: "compound", id: entry.id, name: compoundName(entry) }, action });
}

export function compoundUpdateEvents(before: EnhancementEntry, after: EnhancementEntry, at: Date): ChangeEvent[] {
  const subject: ChangeSubject = { kind: "compound", id: after.id, name: compoundName(after) };
  const events: ChangeEvent[] = [];
  const wasPaused = Boolean(before.pausedAt);
  const isPaused = Boolean(after.pausedAt);
  if (!wasPaused && isPaused) events.push(makeChangeEvent({ at, subject, action: "paused" }));
  if (wasPaused && !isPaused) events.push(makeChangeEvent({ at, subject, action: "resumed" }));
  if (before.isActive !== after.isActive) events.push(makeChangeEvent({ at, subject, action: after.isActive ? "activated" : "deactivated" }));
  const changes = diff(before, after, COMPOUND_FIELDS);
  if (changes.length) events.push(makeChangeEvent({ at, subject, action: "edited", changes }));
  return events;
}

export function cycleEvent(cycle: Pick<CyclePeriod, "id" | "name">, action: ChangeAction, at: Date, changes?: FieldChange[]): ChangeEvent {
  return makeChangeEvent({ at, subject: { kind: "cycle", id: cycle.id, name: cycle.name }, action, changes });
}

export function cycleUpdateEvents(before: CyclePeriod, after: CyclePeriod, at: Date): ChangeEvent[] {
  const changes = diff(before, after, CYCLE_FIELDS);
  return changes.length ? [cycleEvent(after, "edited", at, changes)] : [];
}

export function checkpointEvent(cycle: Pick<CyclePeriod, "id" | "name">, checkpoint: Pick<CycleCheckpoint, "date" | "label">, action: "checkpoint-added" | "checkpoint-removed", at: Date): ChangeEvent {
  const value = `${checkpoint.date} ${checkpoint.label}`.trim();
  const change: FieldChange =
    action === "checkpoint-added" ? { field: "checkpoint", label: "Checkpoint", from: "", to: value } : { field: "checkpoint", label: "Checkpoint", from: value, to: "" };
  return cycleEvent(cycle, action, at, [change]);
}

export function supportEvent(item: SupportPlanItem, action: ChangeAction, at: Date): ChangeEvent {
  return makeChangeEvent({ at, subject: { kind: "support-plan", id: item.id, name: supportItemName(item) }, action });
}

export function supportUpdateEvents(before: SupportPlanItem, after: SupportPlanItem, name: string, at: Date): ChangeEvent[] {
  const changes = diff(before, after, SUPPORT_FIELDS);
  return changes.length ? [makeChangeEvent({ at, subject: { kind: "support-plan", id: after.id, name }, action: "edited", changes })] : [];
}
