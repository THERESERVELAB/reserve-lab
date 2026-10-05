/* ════════════════════════════════════════════════════════════════════════
   JOURNAL — the notes the member has written, gathered in one place.

   Reserve has no free-text journal model. What it does have is every note
   the member typed into a log they already keep: the session review they
   write after training, and the note fields on a measurement check-in, a
   photo check-in and a lab record.

   This module collects exactly those, dated, newest first. It writes
   nothing, invents nothing, and shows no entry the member did not type. If
   they have written none, the screen says so and names the log that takes
   one — it does not print a sample.

   (A dedicated journal entry would need a new persisted model and a new
   store action; that decision is the owner's, not this module's.)

   Pure: no React, no store. Inputs are structural.
   ════════════════════════════════════════════════════════════════════════ */

import { formatDay } from "@/lib/physique/record-summary";

/** Where a note came from, and therefore where the member goes to write another. */
export type JournalSource = "session" | "measurements" | "photos" | "labs";

export const JOURNAL_SOURCE_LABEL: Record<JournalSource, string> = {
  session: "Session review",
  measurements: "Measurement check-in",
  photos: "Photo check-in",
  labs: "Lab record",
};

export type JournalEntry = {
  id: string;
  source: JournalSource;
  /** YYYY-MM-DD, the day the entry is about. */
  date: string;
  dateLabel: string;
  /** What the entry is about, e.g. "Upper Push · Week 6". */
  title: string;
  /** The member's own words. Never generated. */
  body: string;
  /** Short facts the member logged alongside the note. */
  facts: string[];
};

/* ─── Structural inputs ──────────────────────────────────────────────────── */

export type SessionReviewInput = {
  id: string;
  loggedAt: string;
  sessionName: string;
  weekLabel?: string;
  splitName?: string;
  completionLabel?: string;
  bestOutput?: string;
  limiter?: string;
  notes?: string;
};

export type NotedEntryInput = { id: string; date: string; notes?: string };

export type PhysiqueNoteInput = NotedEntryInput & { bodyWeightLb?: number };

export type PhotoNoteInput = NotedEntryInput & { poses?: readonly string[] };

export type LabNoteInput = { id: string; testDate: string; labName?: string; notes?: string };

export type JournalInput = {
  sessionReviews?: readonly SessionReviewInput[];
  measurementEntries?: readonly PhysiqueNoteInput[];
  photoCheckIns?: readonly PhotoNoteInput[];
  labRecords?: readonly LabNoteInput[];
};

/** `loggedAt` is a full ISO timestamp; the journal groups by the local day. */
function dayOf(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  if (Number.isNaN(date.getTime())) return isoTimestamp.slice(0, 10);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function clean(value: string | undefined): string {
  return (value ?? "").trim();
}

/**
 * Every note the member has written, newest first.
 *
 * A session review is included when the member wrote free text in it — its
 * generated fields (best output, limiter) ride along as facts, but they never
 * stand in for a note the member did not write.
 */
export function collectJournalEntries(input: JournalInput): JournalEntry[] {
  const entries: JournalEntry[] = [];

  for (const review of input.sessionReviews ?? []) {
    const body = clean(review.notes);
    if (!body) continue;
    const date = dayOf(review.loggedAt);
    const facts = [clean(review.completionLabel), clean(review.bestOutput) && `Best output · ${clean(review.bestOutput)}`, clean(review.limiter) && `Limiter · ${clean(review.limiter)}`].filter(
      (fact): fact is string => Boolean(fact),
    );
    entries.push({
      id: `session-${review.id}`,
      source: "session",
      date,
      dateLabel: formatDay(date),
      title: [clean(review.sessionName), clean(review.weekLabel)].filter(Boolean).join(" · ") || "Session review",
      body,
      facts,
    });
  }

  for (const entry of input.measurementEntries ?? []) {
    const body = clean(entry.notes);
    if (!body) continue;
    entries.push({
      id: `measurements-${entry.id}`,
      source: "measurements",
      date: entry.date,
      dateLabel: formatDay(entry.date),
      title: "Measurement check-in",
      body,
      facts: entry.bodyWeightLb != null ? [`${entry.bodyWeightLb} lb`] : [],
    });
  }

  for (const checkIn of input.photoCheckIns ?? []) {
    const body = clean(checkIn.notes);
    if (!body) continue;
    const poseCount = checkIn.poses?.length ?? 0;
    entries.push({
      id: `photos-${checkIn.id}`,
      source: "photos",
      date: checkIn.date,
      dateLabel: formatDay(checkIn.date),
      title: "Photo check-in",
      body,
      facts: poseCount ? [`${poseCount} ${poseCount === 1 ? "pose" : "poses"}`] : [],
    });
  }

  for (const record of input.labRecords ?? []) {
    const body = clean(record.notes);
    if (!body) continue;
    entries.push({
      id: `labs-${record.id}`,
      source: "labs",
      date: record.testDate,
      dateLabel: formatDay(record.testDate),
      title: "Lab record",
      body,
      facts: clean(record.labName) ? [clean(record.labName)] : [],
    });
  }

  /* Newest first; a stable tie-break on id so two notes from the same day
     never reorder between renders. */
  return entries.sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
}

/** How many notes came from each log — the honest count behind the statement. */
export function countBySource(entries: readonly JournalEntry[]): Record<JournalSource, number> {
  const counts: Record<JournalSource, number> = { session: 0, measurements: 0, photos: 0, labs: 0 };
  for (const entry of entries) counts[entry.source] += 1;
  return counts;
}

export function journalStatement(entries: readonly JournalEntry[]): string {
  if (entries.length === 0) return "No entries written yet";
  const newest = entries[0];
  return `Last entry ${formatDay(newest.date)} · ${entries.length} ${entries.length === 1 ? "entry" : "entries"}`;
}
