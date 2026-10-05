/* ════════════════════════════════════════════════════════════════════════
   TIMELINE — the member's own dated notes and N=1 observations.

   Everything here is written by the member and shown exactly as written.
   An observation places two things the member chose side by side in time;
   Reserve never adds analysis, never scores it, and never says one thing
   caused another.
   ════════════════════════════════════════════════════════════════════════ */

import { isDateKey } from "@/lib/cycle/cycle-period";

export const TIMELINE_NOTE_LIMIT = 300;
export const OBSERVATION_LIMIT = 300;
export const NOTE_MAX_LENGTH = 1000;
export const OBSERVATION_LABEL_MAX_LENGTH = 120;
export const OBSERVATION_NOTE_MAX_LENGTH = 500;

export type TimelineNote = {
  id: string;
  /** YYYY-MM-DD, member chosen. */
  date: string;
  text: string;
  createdAt: string;
  updatedAt: string;
};

export type TimelineNoteInput = { date: string; text: string };

/** What the member says changed. */
export type ObservationChangedKind = "compound" | "supplement" | "change" | "text";
/** What the member says they noticed. */
export type ObservationNoticedKind = "marker" | "check-in" | "symptom" | "text";

export type ObservationRef<K extends string> = {
  kind: K;
  /** Id or key of the linked record, when the member picked one. */
  ref?: string;
  /** Shown to the member, exactly as chosen or written. */
  label: string;
};

export type Observation = {
  id: string;
  /** YYYY-MM-DD, member chosen. */
  date: string;
  changed: ObservationRef<ObservationChangedKind>;
  noticed: ObservationRef<ObservationNoticedKind>;
  note?: string;
  /** ISO time the member marked it to come back to. */
  markedForReviewAt?: string;
  createdAt: string;
};

export type ObservationInput = Omit<Observation, "id" | "createdAt">;

const CHANGED_KINDS: ObservationChangedKind[] = ["compound", "supplement", "change", "text"];
const NOTICED_KINDS: ObservationNoticedKind[] = ["marker", "check-in", "symptom", "text"];

export function normalizeNoteInput(input: TimelineNoteInput): TimelineNoteInput | null {
  const text = input.text.trim().slice(0, NOTE_MAX_LENGTH);
  if (!text || !isDateKey(input.date)) return null;
  return { date: input.date, text };
}

function normalizeRef<K extends string>(ref: ObservationRef<K> | undefined, kinds: readonly K[]): ObservationRef<K> | null {
  if (!ref || !kinds.includes(ref.kind)) return null;
  const label = ref.label.trim().slice(0, OBSERVATION_LABEL_MAX_LENGTH);
  if (!label) return null;
  const linked = ref.kind !== "text" && typeof ref.ref === "string" && ref.ref.trim() ? ref.ref.trim() : undefined;
  return linked ? { kind: ref.kind, ref: linked, label } : { kind: ref.kind, label };
}

export function normalizeObservationInput(input: ObservationInput): ObservationInput | null {
  if (!isDateKey(input.date)) return null;
  const changed = normalizeRef(input.changed, CHANGED_KINDS);
  const noticed = normalizeRef(input.noticed, NOTICED_KINDS);
  if (!changed || !noticed) return null;
  const note = input.note?.trim().slice(0, OBSERVATION_NOTE_MAX_LENGTH) || undefined;
  return note ? { date: input.date, changed, noticed, note } : { date: input.date, changed, noticed };
}
