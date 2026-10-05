"use client";

/* ════════════════════════════════════════════════════════════════════════
   EDUCATION — a utility screen, and an honest one.

   No lessons are written, so none are listed, previewed or promised (the
   old screen showed nine topic titles, including hormone and supplement
   topics, marked "Ready to log", with nothing behind any of them). What
   the product really has is the vocabulary it already uses on its own
   screens, so that is what this screen teaches.

   Read-only by design: there is no lesson to start, so there is no gold
   action. The hero says so rather than offering a button that goes nowhere.

   One area at a time: the tabs filter the glossary instead of every area
   being open at once, and each definition is a row that opens on tap. The
   general-information note is said once per area, not under every term.
   ════════════════════════════════════════════════════════════════════════ */

import { BookOpen } from "lucide-react";
import { useMemo, useState } from "react";

import { GlassPanel } from "@/components/ui/GlassPanel";
import { DETAIL_BAND_BLEED, ReserveDetailImage, ReserveDisclosure, ReserveSectionHeader, ReserveSegmented } from "@/components/ui/reserve";
import { RecordList, RecordRow } from "@/components/views/records/RecordRows";
import { RESERVE } from "@/lib/design/tokens";
import { buildEducationLibrary } from "@/lib/education/library";
import type { TermCategory } from "@/lib/logging/terminology";

import { ViewShell } from "./ViewShell";
import { UtilityHero } from "./utility/UtilityHero";

export function EducationView() {
  const library = useMemo(() => buildEducationLibrary(), []);
  const [areaId, setAreaId] = useState<TermCategory | null>(null);
  const area = library.areas.find((candidate) => candidate.id === areaId) ?? library.areas[0] ?? null;
  const areaNote = area?.terms.find((term) => term.note)?.note ?? null;

  return (
    <ViewShell
      label="Library"
      title="Education"
      icon={BookOpen}
      accentColor={RESERVE.steel}
      roomHero
      command="Plain-language definitions for the terms Reserve uses on your screens."
      disclaimer="General information about the terms on your screens — not medical advice, and never a reading of your own data."
    >
      <UtilityHero
        testId="education"
        accent={RESERVE.steel}
        eyebrow="Library · Glossary"
        statement={library.statement}
        support={library.support}
        reads={[
          { label: "Terms defined", value: library.termCount > 0 ? String(library.termCount) : null, empty: "None published" },
          { label: "Areas", value: library.areas.length > 0 ? String(library.areas.length) : null, empty: "None published" },
          { label: "Lessons", value: null, empty: "Not written yet" },
        ]}
        noAction="There is no lesson to start yet. The definitions below are everything published today."
      />

      {area && (
        <GlassPanel accent={RESERVE.steel} phone="flush">
          <ReserveDetailImage id="education-library" className={DETAIL_BAND_BLEED} />
          {/* Five areas do not fit a 390px row; the control scrolls inside its
              own track rather than pushing the page sideways. */}
          <div className="-mx-1 max-w-full overflow-x-auto px-1 pb-1">
            <ReserveSegmented
              label="Glossary areas"
              accent={RESERVE.steel}
              size="sm"
              value={area.id}
              onChange={setAreaId}
              segments={library.areas.map((candidate) => ({
                value: candidate.id,
                label: `${candidate.label} ${candidate.terms.length}`,
              }))}
            />
          </div>

          <section id={`education-${area.id}`} data-education-area={area.id} aria-label={area.label} className="mt-4">
            <ReserveSectionHeader label={`${area.label} · ${area.terms.length} terms`} accent={RESERVE.steel} />
            <p className="max-w-[72ch] text-[13px] leading-[1.55] text-white/65">{area.purpose}</p>
            {areaNote && (
              <p data-education-note className="mt-1.5 max-w-[72ch] text-[12px] leading-[1.5] text-white/45">
                {areaNote}
              </p>
            )}

            <RecordList label={`${area.label} terms`} className="mt-2">
              {area.terms.map((term) => (
                <RecordRow key={term.term} className="py-0! first:pt-0 last:pb-0">
                  <ReserveDisclosure
                    summary={term.label !== term.term ? `${term.term} · ${term.label}` : term.term}
                    accent={RESERVE.ivory}
                  >
                    <p className="max-w-[72ch] pb-3 text-[13px] leading-[1.6] text-white/70">{term.definition}</p>
                  </ReserveDisclosure>
                </RecordRow>
              ))}
            </RecordList>
          </section>
        </GlassPanel>
      )}
    </ViewShell>
  );
}
