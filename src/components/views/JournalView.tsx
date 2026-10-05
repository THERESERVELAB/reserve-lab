"use client";

import { BookOpen, ClipboardCheck, Ruler } from "lucide-react";
import { useMemo } from "react";

import { GlassPanel } from "@/components/ui/GlassPanel";
import { DETAIL_BAND_BLEED, ReserveButton, ReserveDetailImage, ReserveSectionHeader } from "@/components/ui/reserve";
import { useAthleteDashboardStore } from "@/lib/athlete-store";
import { RESERVE } from "@/lib/design/tokens";
import {
  JOURNAL_SOURCE_LABEL,
  collectJournalEntries,
  countBySource,
  journalStatement,
  type JournalSource,
} from "@/lib/journal/entries";
import { formatDayFull } from "@/lib/physique/record-summary";

import { RecordHero } from "./records/RecordHero";
import { RecordEmpty, RecordList, RecordRow, RecordTag } from "./records/RecordRows";
import { ViewShell } from "./ViewShell";

/* ════════════════════════════════════════════════════════════════════════
   JOURNAL — the notes the member has written.

   This screen used to render four hard-coded sample entries ("Sleep was
   solid at 8.2h…") above a dashed "+ New entry" box that did nothing. Both
   are gone: a sample entry is fabricated member data, and the box was a
   dead CTA.

   Reserve has no standalone journal model. What it has is the free text the
   member typed into logs they already keep — the session review, and the
   note field on a measurement check-in, a photo check-in and a lab record.
   This screen gathers exactly those and says plainly where a new one is
   written. Nothing here writes, and nothing is invented.
   ════════════════════════════════════════════════════════════════════════ */

const SOURCE_VIEW: Record<JournalSource, "training" | "measurements" | "progress-photos" | "bloodwork"> = {
  session: "training",
  measurements: "measurements",
  photos: "progress-photos",
  labs: "bloodwork",
};

export function JournalView() {
  const setActiveView = useAthleteDashboardStore((s) => s.setActiveView);
  const trainingJournal = useAthleteDashboardStore((s) => s.trainingSession.trainingJournal);
  const physiqueEntries = useAthleteDashboardStore((s) => s.physiqueCommand.entries);
  const photoCheckIns = useAthleteDashboardStore((s) => s.physiqueCommand.photoCheckIns);
  const bloodworkLogs = useAthleteDashboardStore((s) => s.bloodworkLogs);

  const entries = useMemo(
    () =>
      collectJournalEntries({
        sessionReviews: trainingJournal,
        measurementEntries: physiqueEntries,
        photoCheckIns,
        labRecords: bloodworkLogs,
      }),
    [trainingJournal, physiqueEntries, photoCheckIns, bloodworkLogs],
  );

  const counts = useMemo(() => countBySource(entries), [entries]);
  const newest = entries[0] ?? null;
  const sourcesUsed = (Object.keys(counts) as JournalSource[]).filter((source) => counts[source] > 0);

  return (
    <ViewShell
      label="Journal"
      title="Journal"
      icon={BookOpen}
      accentColor={RESERVE.gold}
      roomHero
      command="Every note you have written, newest first."
      disclaimer="Your notes are yours. Reserve gathers the text you typed into your own logs and stores it on your device. It does not write entries for you, and it does not interpret them."
    >
      <RecordHero
        testId="journal"
        accent={RESERVE.gold}
        eyebrow="Journal · your own words"
        statement={journalStatement(entries)}
        support="Notes come from the logs you already keep — your session review, and the note on a measurement, photo or lab record."
        reads={[
          {
            label: "Entries",
            value: entries.length > 0 ? String(entries.length) : null,
            detail: entries.length > 0 ? `across ${sourcesUsed.length} ${sourcesUsed.length === 1 ? "log" : "logs"}` : undefined,
            empty: "Evidence needed · nothing written yet",
          },
          {
            label: "Last written",
            value: newest ? newest.dateLabel : null,
            detail: newest ? JOURNAL_SOURCE_LABEL[newest.source] : undefined,
            empty: "Evidence needed",
          },
        ]}
        action={{ label: "Write a Session Review", icon: ClipboardCheck, onClick: () => setActiveView("training") }}
        secondary={{ label: "Log Measurements", icon: Ruler, onClick: () => setActiveView("measurements") }}
      />

      <GlassPanel accent={RESERVE.gold} phone="flush">
        <ReserveDetailImage id="journal-desk" className={DETAIL_BAND_BLEED} />
        <ReserveSectionHeader label={entries.length > 0 ? `Entries · ${entries.length}` : "Entries"} accent={RESERVE.gold} />
        {entries.length > 0 ? (
          <RecordList label="Journal entries">
            {entries.map((entry) => (
              <RecordRow key={entry.id}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <p className="text-[15px] font-semibold text-[#f2eee6]">{entry.title}</p>
                  <p className="tnum font-mono text-[11px] uppercase tracking-[0.14em] text-white/50">
                    {formatDayFull(entry.date)} · {JOURNAL_SOURCE_LABEL[entry.source]}
                  </p>
                </div>
                <p className="mt-1.5 max-w-[72ch] text-[13px] leading-[1.6] text-white/70">{entry.body}</p>
                {entry.facts.length > 0 && (
                  <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
                    {entry.facts.map((fact) => (
                      <RecordTag key={fact} accent={RESERVE.slate}>
                        {fact}
                      </RecordTag>
                    ))}
                  </p>
                )}
              </RecordRow>
            ))}
          </RecordList>
        ) : (
          <RecordEmpty
            headline="Nothing written yet"
            body="Reserve shows only what you have typed. The first note usually comes from the review you write after a session — it lands here the moment you save it."
            action={
              <ReserveButton tier="secondary" size="md" icon={ClipboardCheck} onClick={() => setActiveView("training")}>
                Open Training Command
              </ReserveButton>
            }
          />
        )}
      </GlassPanel>

      <GlassPanel accent={RESERVE.slate} phone="flush">
        <ReserveSectionHeader label="Where a note is written" accent={RESERVE.slate} />
        <RecordList label="Logs that take a note">
          {(Object.keys(JOURNAL_SOURCE_LABEL) as JournalSource[]).map((source) => (
            <RecordRow key={source}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-[#f2eee6]">{JOURNAL_SOURCE_LABEL[source]}</p>
                  <p className="tnum mt-0.5 text-[12px] leading-snug text-white/55">
                    {counts[source] > 0
                      ? `${counts[source]} ${counts[source] === 1 ? "note" : "notes"} written here`
                      : "No notes written here yet"}
                  </p>
                </div>
                <ReserveButton tier="quiet" size="sm" onClick={() => setActiveView(SOURCE_VIEW[source])}>
                  Open
                </ReserveButton>
              </div>
            </RecordRow>
          ))}
        </RecordList>

        {/* A plain line under the rows, not a tinted box inside the panel. */}
        <div className="mt-4 border-t border-white/[0.06] pt-3">
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/45">What is missing</p>
          <p className="mt-1 text-[12px] leading-[1.5] text-white/60">
            Reserve does not yet have a standalone journal entry — there is no free-text note that belongs to this screen
            alone. Every entry above was written inside another log, and that is where a new one is written today.
          </p>
        </div>
      </GlassPanel>
    </ViewShell>
  );
}
