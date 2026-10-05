"use client";

import { History, NotebookPen, Plus, Trash2 } from "lucide-react";
import { useCallback, useId, useMemo, useState } from "react";

import { useClientNow } from "@/components/safety/useClientNow";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { ReserveButton, ReserveSegmented } from "@/components/ui/reserve";
import { recordTimelineNote } from "@/components/ui/reserve/log-moment/recorders";
import { useAthleteDashboardStore } from "@/lib/athlete-store";
import { dateKeyOf } from "@/lib/cycle/cycle-period";
import { RESERVE, alpha } from "@/lib/design/tokens";
import type { ChangeEvent } from "@/lib/history/change-events";
import { CHANGE_KIND_LABEL, OBSERVATION_LABEL, changeEventDetails, changeEventTitle, observationLines } from "@/lib/history/summaries";
import { NOTE_MAX_LENGTH, type Observation, type TimelineNote } from "@/lib/history/types";

import { ObservationSheet } from "./ObservationSheet";

/* ════════════════════════════════════════════════════════════════════════
   TIMELINE — how the member's plan changed, with their own notes and N=1
   observations, day by day. Changes are recorded by Reserve as the member
   makes them; notes and observations are the member's words, shown as
   written. Reserve adds no analysis.
   ════════════════════════════════════════════════════════════════════════ */

export const TimelineIcon = History;

type Filter = "all" | "changes" | "notes" | "observations";

type Item =
  | { kind: "change"; id: string; date: string; stamp: string; event: ChangeEvent }
  | { kind: "note"; id: string; date: string; stamp: string; note: TimelineNote }
  | { kind: "observation"; id: string; date: string; stamp: string; observation: Observation };

const INPUT =
  "mt-1 min-h-[44px] w-full rounded-[12px] border border-white/[0.08] bg-black/30 px-3 text-[16px] text-[#f2eee6] outline-none placeholder:text-white/25 focus:border-[#5fb7d5]/60 sm:text-[13px]";

function formatDay(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  if (!y || !m || !d) return key;
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

export function TimelineTab() {
  const now = useClientNow();
  const changeHistory = useAthleteDashboardStore((s) => s.changeHistory);
  const timelineNotes = useAthleteDashboardStore((s) => s.timelineNotes);
  const observations = useAthleteDashboardStore((s) => s.observations);
  const [filter, setFilter] = useState<Filter>("all");
  const [noteOpen, setNoteOpen] = useState(false);
  const [observationOpen, setObservationOpen] = useState(false);
  const closeObservation = useCallback(() => setObservationOpen(false), []);
  const today = now ? dateKeyOf(now) : null;

  const days = useMemo(() => {
    const items: Item[] = [
      ...(filter === "all" || filter === "changes"
        ? (changeHistory ?? []).map((event): Item => ({ kind: "change", id: event.id, date: event.date, stamp: event.at, event }))
        : []),
      ...(filter === "all" || filter === "notes"
        ? (timelineNotes ?? []).map((note): Item => ({ kind: "note", id: note.id, date: note.date, stamp: note.createdAt, note }))
        : []),
      ...(filter === "all" || filter === "observations"
        ? (observations ?? []).map((observation): Item => ({ kind: "observation", id: observation.id, date: observation.date, stamp: observation.createdAt, observation }))
        : []),
    ].sort((a, b) => (a.date === b.date ? b.stamp.localeCompare(a.stamp) : b.date.localeCompare(a.date)));
    const byDay = new Map<string, Item[]>();
    for (const item of items) byDay.set(item.date, [...(byDay.get(item.date) ?? []), item]);
    return [...byDay.entries()];
  }, [changeHistory, timelineNotes, observations, filter]);

  return (
    <section className="grid gap-4">
      <GlassPanel accent={RESERVE.steel}>
        <div className="flex flex-col gap-4">
          <div>
            <p className="type-whisper" style={{ color: alpha(RESERVE.steel, 0.9) }}>Timeline</p>
            <h3 className="type-section-title mt-1.5" style={{ color: RESERVE.ivory }}>How your plan changed</h3>
            <p className="type-supporting mt-1.5 max-w-[620px] text-[12.5px]">
              Changes to your compounds, supplements and cycles are recorded as you make them. Add dated notes and observations in your own words.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ReserveButton tier="secondary" size="sm" icon={NotebookPen} onClick={() => setNoteOpen((open) => !open)}>
              {noteOpen ? "Close note" : "Add note"}
            </ReserveButton>
            <ReserveButton tier="secondary" size="sm" icon={Plus} onClick={() => setObservationOpen(true)}>
              Add observation
            </ReserveButton>
          </div>
          {noteOpen && today && <NoteForm today={today} onDone={() => setNoteOpen(false)} />}
          <ReserveSegmented<Filter>
            label="What to show"
            value={filter}
            onChange={setFilter}
            accent={RESERVE.steel}
            segments={[
              { value: "all", label: "All" },
              { value: "changes", label: "Changes" },
              { value: "notes", label: "Notes" },
              { value: "observations", label: "Observations" },
            ]}
          />
        </div>
      </GlassPanel>

      {days.length === 0 ? (
        <p className="px-1 text-[13px] leading-[1.55] text-white/60">
          Nothing recorded yet. Changes you make to compounds, supplements and cycles appear here, with the notes and observations you add.
        </p>
      ) : (
        <ol aria-label="Timeline entries" className="flex flex-col gap-4">
          {days.map(([date, items]) => (
            <li key={date}>
              <p className="px-1 font-mono text-[9px] uppercase tracking-[0.18em] text-white/45">{formatDay(date)}</p>
              <ul className="mt-1.5 flex flex-col divide-y divide-white/[0.05] rounded-2xl bg-white/[0.02] px-4">
                {items.map((item) => (
                  <TimelineRow key={`${item.kind}-${item.id}`} item={item} />
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}

      {today && <ObservationSheet open={observationOpen} onClose={closeObservation} today={today} />}
    </section>
  );
}

function TimelineRow({ item }: { item: Item }) {
  const removeTimelineNote = useAthleteDashboardStore((s) => s.removeTimelineNote);
  const removeObservation = useAthleteDashboardStore((s) => s.removeObservation);

  if (item.kind === "change") {
    return (
      <li className="py-3">
        <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/45">{CHANGE_KIND_LABEL[item.event.subject.kind]}</p>
        <p className="mt-0.5 text-[13.5px] font-semibold" style={{ color: RESERVE.ivory }}>{changeEventTitle(item.event)}</p>
        {changeEventDetails(item.event).map((line) => (
          <p key={line} className="tnum mt-0.5 text-[12px] text-white/60">{line}</p>
        ))}
      </li>
    );
  }

  if (item.kind === "note") {
    return (
      <li data-timeline-note={item.note.id} className="flex items-start gap-3 py-3">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/45">Note</p>
          <p className="mt-0.5 whitespace-pre-wrap break-words text-[13px] leading-[1.55] text-white/80">{item.note.text}</p>
        </div>
        <DeleteButton label="Delete note" onClick={() => removeTimelineNote(item.note.id)} />
      </li>
    );
  }

  const lines = observationLines(item.observation);
  return (
    <li className="flex items-start gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[9px] uppercase tracking-[0.16em]" style={{ color: alpha(RESERVE.steel, 0.9) }}>{OBSERVATION_LABEL}</p>
        <p className="mt-0.5 break-words text-[13px] text-white/80">{lines.changed}</p>
        <p className="break-words text-[13px] text-white/80">{lines.noticed}</p>
        {item.observation.note && <p className="mt-0.5 whitespace-pre-wrap break-words text-[12.5px] leading-[1.55] text-white/60">{item.observation.note}</p>}
      </div>
      <DeleteButton label="Delete observation" onClick={() => removeObservation(item.observation.id)} />
    </li>
  );
}

function DeleteButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px] text-white/35 transition hover:text-white/75 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#5fb7d5]"
    >
      <Trash2 size={14} aria-hidden="true" />
    </button>
  );
}

function NoteForm({ today, onDone }: { today: string; onDone: () => void }) {
  const addTimelineNote = useAthleteDashboardStore((s) => s.addTimelineNote);
  const [date, setDate] = useState(today);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const dateId = useId();
  const textId = useId();

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    if (recordTimelineNote(() => addTimelineNote({ date, text }), date)) {
      onDone();
    } else {
      setError("Write a note and choose a valid date.");
    }
  };

  return (
    <form onSubmit={save} className="flex flex-col gap-3 rounded-[14px] bg-white/[0.025] px-3.5 py-3">
      <label htmlFor={dateId} className="block text-[11.5px] text-white/55">
        Date
        <input id={dateId} type="date" value={date} onChange={(e) => setDate(e.target.value)} className={INPUT} />
      </label>
      <label htmlFor={textId} className="block text-[11.5px] text-white/55">
        Note
        <textarea
          id={textId}
          rows={3}
          value={text}
          maxLength={NOTE_MAX_LENGTH}
          onChange={(e) => {
            setText(e.target.value);
            setError(null);
          }}
          className={`${INPUT} resize-y py-2`}
        />
      </label>
      {error && (
        <p role="alert" className="text-[12.5px]" style={{ color: RESERVE.red }}>{error}</p>
      )}
      <div>
        {text.trim() ? (
          <ReserveButton tier="primary" size="sm" type="submit">
            Save note
          </ReserveButton>
        ) : (
          <ReserveButton tier="primary" size="sm" disabled disabledReason="Write your note first.">
            Save note
          </ReserveButton>
        )}
      </div>
    </form>
  );
}
