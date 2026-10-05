"use client";

import { useId, useMemo, useState } from "react";

import { ReserveBottomSheet, ReserveButton, useDirtySnapshot, useReportDirty } from "@/components/ui/reserve";
import { markObservationSaved } from "@/components/ui/reserve/log-moment/recorders";
import { useAthleteDashboardStore } from "@/lib/athlete-store";
import { CHECK_IN_SYMPTOMS } from "@/lib/cycle-review/types";
import { RESERVE } from "@/lib/design/tokens";
import { compoundName, supportItemName } from "@/lib/history/change-events";
import { OBSERVATION_EXPLAINER, changeEventTitle } from "@/lib/history/summaries";
import {
  OBSERVATION_LABEL_MAX_LENGTH,
  OBSERVATION_NOTE_MAX_LENGTH,
  type ObservationChangedKind,
  type ObservationNoticedKind,
  type ObservationRef,
} from "@/lib/history/types";
import { isMarkerKey, markerDef, matchMarker, type MarkerKey } from "@/lib/labs/markers";

/* An N=1 observation: what the member says changed, what they noticed, and
   when. Everything is chosen or written by the member; Reserve only records
   it on their timeline. */

type Choice<K extends string> = { value: string; kind: K; ref?: string; label: string; group: string };

const OWN_WORDS = "own-words";

const CHECK_IN_VALUES = [
  { ref: "blood-pressure", label: "Blood pressure" },
  { ref: "resting-hr", label: "Resting heart rate" },
  { ref: "sleep", label: "Sleep" },
  { ref: "bodyweight", label: "Bodyweight" },
  { ref: "mood", label: "Mood" },
  { ref: "recovery", label: "Recovery" },
];

const FIELD =
  "mt-1 min-h-[44px] w-full rounded-[12px] border border-white/[0.08] bg-black/30 px-3 text-[16px] text-[#f2eee6] outline-none placeholder:text-white/25 focus:border-[#5fb7d5]/60 sm:text-[13px]";

function groupsOf<K extends string>(choices: Choice<K>[]): Array<[string, Choice<K>[]]> {
  const map = new Map<string, Choice<K>[]>();
  for (const choice of choices) map.set(choice.group, [...(map.get(choice.group) ?? []), choice]);
  return [...map.entries()];
}

function resolve<K extends string>(value: string, ownWords: string, choices: Choice<K>[]): ObservationRef<K | "text"> | null {
  if (value === OWN_WORDS) return ownWords.trim() ? { kind: "text", label: ownWords } : null;
  const choice = choices.find((c) => c.value === value);
  return choice ? { kind: choice.kind, ref: choice.ref, label: choice.label } : null;
}

export function ObservationSheet({ open, onClose, today }: { open: boolean; onClose: () => void; today: string }) {
  const [dirty, setDirty] = useState(false);
  return (
    <ReserveBottomSheet open={open} onClose={onClose} title="Add an observation" accent={RESERVE.steel} dirty={open && dirty}>
      {open && <ObservationForm today={today} onDone={onClose} onDirtyChange={setDirty} />}
    </ReserveBottomSheet>
  );
}

function ObservationForm({ today, onDone, onDirtyChange }: { today: string; onDone: () => void; onDirtyChange: (dirty: boolean) => void }) {
  const addObservation = useAthleteDashboardStore((s) => s.addObservation);
  const entries = useAthleteDashboardStore((s) => s.trainingSession.enhancementLog);
  const supportPlan = useAthleteDashboardStore((s) => s.supportPlan);
  const changeHistory = useAthleteDashboardStore((s) => s.changeHistory);
  const bloodworkLogs = useAthleteDashboardStore((s) => s.bloodworkLogs);

  const [date, setDate] = useState(today);
  const [changedValue, setChangedValue] = useState("");
  const [changedWords, setChangedWords] = useState("");
  const [noticedValue, setNoticedValue] = useState("");
  const [noticedWords, setNoticedWords] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  useReportDirty(useDirtySnapshot({ date, changedValue, changedWords, noticedValue, noticedWords, note }), onDirtyChange);
  const ids = { date: useId(), changed: useId(), changedWords: useId(), noticed: useId(), noticedWords: useId(), note: useId() };

  const changedChoices = useMemo<Choice<ObservationChangedKind>[]>(
    () => [
      ...(entries ?? []).map((entry) => ({ value: `compound:${entry.id}`, kind: "compound" as const, ref: entry.id, label: compoundName(entry), group: "Compounds and medications" })),
      ...(supportPlan ?? []).map((item) => ({ value: `supplement:${item.id}`, kind: "supplement" as const, ref: item.id, label: supportItemName(item), group: "Support plan" })),
      ...(changeHistory ?? []).slice(0, 20).map((event) => ({
        value: `change:${event.id}`,
        kind: "change" as const,
        ref: event.id,
        label: `${changeEventTitle(event)} (${event.date})`.slice(0, OBSERVATION_LABEL_MAX_LENGTH),
        group: "Recent changes",
      })),
    ],
    [entries, supportPlan, changeHistory],
  );

  const noticedChoices = useMemo<Choice<ObservationNoticedKind>[]>(() => {
    const markerKeys = new Set<MarkerKey>();
    for (const log of bloodworkLogs ?? []) {
      for (const marker of log.markers ?? []) {
        const key = isMarkerKey(marker.markerKey) ? marker.markerKey : matchMarker(marker.name)?.key;
        if (key) markerKeys.add(key);
      }
    }
    return [
      ...[...markerKeys]
        .map((key) => ({ value: `marker:${key}`, kind: "marker" as const, ref: key, label: markerDef(key).label, group: "Your lab markers" }))
        .sort((a, b) => a.label.localeCompare(b.label)),
      ...CHECK_IN_VALUES.map((item) => ({ value: `check-in:${item.ref}`, kind: "check-in" as const, ref: item.ref, label: item.label, group: "Check-in" })),
      ...Object.entries(CHECK_IN_SYMPTOMS).map(([key, def]) => ({ value: `symptom:${key}`, kind: "symptom" as const, ref: key, label: def.label, group: "Symptoms" })),
    ];
  }, [bloodworkLogs]);

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    const changed = resolve(changedValue, changedWords, changedChoices);
    const noticed = resolve(noticedValue, noticedWords, noticedChoices);
    const id = changed && noticed ? addObservation({ date, changed, noticed, note }) : null;
    if (id) {
      markObservationSaved(id);
      onDone();
    } else {
      setError("Choose a date, what changed and what you noticed.");
    }
  };

  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      <p className="text-[12.5px] leading-[1.55] text-white/60">{OBSERVATION_EXPLAINER}</p>

      <label htmlFor={ids.date} className="block text-[11.5px] text-white/55">
        Date
        <input id={ids.date} type="date" value={date} onChange={(e) => setDate(e.target.value)} className={FIELD} />
      </label>

      <div>
        <label htmlFor={ids.changed} className="block text-[11.5px] text-white/55">
          What changed
          <select id={ids.changed} value={changedValue} onChange={(e) => setChangedValue(e.target.value)} className={FIELD}>
            <option value="">Choose…</option>
            {groupsOf(changedChoices).map(([group, choices]) => (
              <optgroup key={group} label={group}>
                {choices.map((choice) => (
                  <option key={choice.value} value={choice.value}>{choice.label}</option>
                ))}
              </optgroup>
            ))}
            <option value={OWN_WORDS}>Something else, in my own words</option>
          </select>
        </label>
        {changedValue === OWN_WORDS && (
          <label htmlFor={ids.changedWords} className="mt-2 block text-[11.5px] text-white/55">
            In your own words
            <input id={ids.changedWords} value={changedWords} maxLength={OBSERVATION_LABEL_MAX_LENGTH} onChange={(e) => setChangedWords(e.target.value)} className={FIELD} />
          </label>
        )}
      </div>

      <div>
        <label htmlFor={ids.noticed} className="block text-[11.5px] text-white/55">
          What you noticed
          <select id={ids.noticed} value={noticedValue} onChange={(e) => setNoticedValue(e.target.value)} className={FIELD}>
            <option value="">Choose…</option>
            {groupsOf(noticedChoices).map(([group, choices]) => (
              <optgroup key={group} label={group}>
                {choices.map((choice) => (
                  <option key={choice.value} value={choice.value}>{choice.label}</option>
                ))}
              </optgroup>
            ))}
            <option value={OWN_WORDS}>Something else, in my own words</option>
          </select>
        </label>
        {noticedValue === OWN_WORDS && (
          <label htmlFor={ids.noticedWords} className="mt-2 block text-[11.5px] text-white/55">
            In your own words
            <input id={ids.noticedWords} value={noticedWords} maxLength={OBSERVATION_LABEL_MAX_LENGTH} onChange={(e) => setNoticedWords(e.target.value)} className={FIELD} />
          </label>
        )}
      </div>

      <label htmlFor={ids.note} className="block text-[11.5px] text-white/55">
        Note (optional)
        <textarea id={ids.note} rows={3} value={note} maxLength={OBSERVATION_NOTE_MAX_LENGTH} onChange={(e) => setNote(e.target.value)} className={`${FIELD} resize-y py-2`} />
      </label>

      {error && (
        <p role="alert" className="text-[12.5px]" style={{ color: RESERVE.red }}>{error}</p>
      )}

      <div>
        <ReserveButton tier="primary" type="submit">
          Save observation
        </ReserveButton>
      </div>
    </form>
  );
}
