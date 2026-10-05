/* ════════════════════════════════════════════════════════════════════════
   EDUCATION LIBRARY — what Reserve can honestly teach today.

   There are no written lessons in the product. The one piece of real
   educational content is the terminology glossary Reserve already uses to
   label its own screens (`lib/logging/terminology.ts`). This module shapes
   that glossary for reading, and nothing more:

     · definitions only. The glossary's worked examples carry illustrative
       numbers (set counts, heart rates, body-fat figures) that would read as
       targets on a learning screen, so they are left out.
     · recovery terms touch on body signals, so each carries the general
       clinician line. Nothing here interprets a member's own reading.
     · no lessons are counted, previewed or promised. When lessons exist
       they are added here as real content, not as titles.

   Pure: no React, no store.
   ════════════════════════════════════════════════════════════════════════ */

import { TERMINOLOGY, type TermCategory, type TermEntry } from "@/lib/logging/terminology";

export type EducationTerm = {
  term: string;
  label: string;
  definition: string;
  /** A general line for terms that touch on health signals. */
  note?: string;
};

export type EducationArea = {
  id: TermCategory;
  label: string;
  purpose: string;
  terms: EducationTerm[];
};

export type EducationLibrary = {
  statement: string;
  support: string;
  termCount: number;
  areas: EducationArea[];
  /** Written lessons available. Zero until real lessons exist. */
  lessonCount: number;
};

const AREA_ORDER: Array<{ id: TermCategory; label: string; purpose: string }> = [
  { id: "training", label: "Training", purpose: "How sets, effort and blocks are described on your training screens." },
  { id: "science", label: "Volume", purpose: "The volume language behind how a week of training is planned." },
  { id: "recovery", label: "Recovery", purpose: "The recovery signals named on your recovery screens." },
  { id: "nutrition", label: "Nutrition", purpose: "The energy and protein terms used on your fuel screens." },
  { id: "physique", label: "Physique", purpose: "The body-composition terms used on your physique records." },
];

export const CLINICIAN_NOTE =
  "General information, not a reading of your own data. Review anything that concerns you with your clinician.";

function toTerm(entry: TermEntry): EducationTerm {
  return {
    term: entry.shorthand,
    label: entry.label,
    definition: entry.definition,
    note: entry.category === "recovery" ? CLINICIAN_NOTE : undefined,
  };
}

export function buildEducationLibrary(entries: TermEntry[] = TERMINOLOGY): EducationLibrary {
  const areas = AREA_ORDER.map((area) => ({
    ...area,
    terms: entries.filter((entry) => entry.category === area.id).map(toTerm),
  })).filter((area) => area.terms.length > 0);

  const termCount = areas.reduce((sum, area) => sum + area.terms.length, 0);

  return {
    statement: termCount > 0 ? "No lessons are written yet." : "Nothing is published here yet.",
    support:
      termCount > 0
        ? `What is here today is the vocabulary Reserve uses on your screens: ${termCount} terms, defined in plain language.`
        : "When lessons and definitions are published, they will appear here.",
    termCount,
    areas,
    lessonCount: 0,
  };
}
