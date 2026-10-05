"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";

import { ReserveButton, ReserveSectionHeader } from "@/components/ui/reserve";
import { useAthleteDashboardStore } from "@/lib/athlete-store";

/* ════════════════════════════════════════════════════════════════════════
   SESSION LEDGER — planned versus done, as rows.

   Lives inside Training's "Session tools" / "Session record" disclosure,
   which already sits in the room's one glass layer. So nothing here draws a
   box: rows and hairlines only (components.md rule 1). Skipping the current
   movement lives on the cockpit; this ledger records, adds work and holds
   the session notes. Once the record is locked it is read-only.
   ════════════════════════════════════════════════════════════════════════ */

const GOLD = "#d5b15f";
const GREEN = "#6ee7b7";

const STATUS_COLOR: Record<string, string> = {
  completed: GREEN,
  partial: GOLD,
  skipped: "#ef9f62",
  replaced: "#a78bfa",
  abandoned: "#ef7d55",
};

/** "not-started" → "Not started". */
function statusWord(status: string): string {
  const words = status.replace(/[-_]/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

const FIELD =
  "min-h-[44px] w-full min-w-0 border-b border-white/[0.1] bg-transparent px-0 py-2 text-base text-[#f2eee6] outline-none transition-colors placeholder:text-white/35 focus:border-[#d5b15f]/60";

export function SessionExecutionLedgerPanel() {
  const record = useAthleteDashboardStore((state) => state.trainingSession.executionRecord);
  const addTrainingMovement = useAthleteDashboardStore((state) => state.addTrainingMovement);
  const logAddedTrainingSet = useAthleteDashboardStore((state) => state.logAddedTrainingSet);
  const updateTrainingExecutionMetrics = useAthleteDashboardStore((state) => state.updateTrainingExecutionMetrics);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [sets, setSets] = useState("1");
  const [reps, setReps] = useState("");
  const [reason, setReason] = useState("");
  const [notesDraft, setNotesDraft] = useState<{ recordId: string | null; value: string }>({ recordId: null, value: "" });
  const savedNotes = record?.sessionMetrics.athleteNotes ?? "";
  const notes = notesDraft.recordId === record?.id ? notesDraft.value : savedNotes;

  const counts = useMemo(() => {
    if (!record) return null;
    const plannedSets = record.movements.reduce((sum, movement) => sum + (movement.plannedPrescription.sets ?? 0), 0);
    const completedSets = record.movements.reduce((sum, movement) => sum + movement.completedSets.filter((set) => set.completed).length, 0);
    const addedSets = record.addedMovements.reduce((sum, movement) => sum + movement.completedSets.filter((set) => set.completed).length, 0);
    return { plannedSets, completedSets, addedSets };
  }, [record]);

  if (!record || !counts) return null;
  const locked = Boolean(record.integrity.completedRecordLockedAt);
  /* Rows for movements with something on the record; the rest are one count. The full queue is the All Movements sheet. */
  const touched = record.movements.filter((movement) => movement.status !== "not-started" || movement.completedSets.length > 0 || movement.performedName !== movement.plannedName);
  const untouched = record.movements.length - touched.length;

  const add = () => {
    const cleanName = name.trim();
    if (!cleanName) return;
    const id = addTrainingMovement({
      name: cleanName,
      sets: Math.max(1, Number(sets) || 1),
      reps: reps.trim() || undefined,
      reason: reason.trim() || undefined,
      insertionIndex: record.movements.length + record.addedMovements.length,
    });
    if (!id) return;
    setName("");
    setSets("1");
    setReps("");
    setReason("");
    setAdding(false);
  };

  const status = [
    statusWord(record.status),
    `${counts.completedSets} of ${counts.plannedSets} sets`,
    counts.addedSets > 0 ? `${counts.addedSets} added` : null,
    record.adjustedSnapshot ? "adjusted" : null,
    locked ? "locked" : "plan preserved",
  ].filter(Boolean).join(" · ");

  return (
    <section aria-label="Planned versus done" data-training="ledger">
      <ReserveSectionHeader label="Planned versus done" accent={GOLD} />
      <p className="text-[12px] leading-[1.5] text-white/55">
        <span style={{ color: STATUS_COLOR[record.status] ?? "rgba(255,255,255,0.75)" }}>{status}</span>
        {record.futureRevisionIds.length > 0 && <> · {record.futureRevisionIds.length} later revision{record.futureRevisionIds.length === 1 ? "" : "s"} apply next time</>}
      </p>

      <ol aria-label="Movements, planned versus done" className="mt-1 flex flex-col divide-y divide-white/[0.05]">
        {touched.map((movement) => (
          <li key={movement.id} className="flex min-h-[40px] items-center gap-3 py-1.5">
            <span className="min-w-0 flex-1 truncate text-[13px] text-white/75">
              {movement.plannedName}
              {movement.performedName !== movement.plannedName && <span className="text-white/50"> → {movement.performedName}</span>}
            </span>
            <span className="tnum shrink-0 font-mono text-[10px] uppercase tracking-[0.12em]" style={{ color: STATUS_COLOR[movement.status] ?? "rgba(255,255,255,0.5)" }}>
              {movement.completedSets.length}/{movement.plannedPrescription.sets ?? "—"} · {statusWord(movement.status)}
            </span>
          </li>
        ))}
        {record.addedMovements.map((movement) => (
          <li key={movement.id} className="flex min-h-[44px] items-center gap-3 py-1.5">
            <span className="min-w-0 flex-1 truncate text-[13px] text-white/75">
              {movement.performedName} <span className="text-white/50">· added{movement.addedReason ? ` · ${movement.addedReason}` : ""}</span>
            </span>
            <span className="tnum shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-white/55">
              {movement.completedSets.filter((set) => set.completed).length} sets
            </span>
            {!locked && (
              <button
                type="button"
                aria-label={`Log a set · ${movement.performedName}`}
                onClick={() => logAddedTrainingSet(movement.id, { completed: true, completedReps: undefined, loadUnit: "bodyweight" })}
                className="min-h-[44px] shrink-0 font-mono text-[10px] uppercase tracking-[0.18em] text-[#79e3b5]"
              >
                Log Set
              </button>
            )}
          </li>
        ))}
        {untouched > 0 && (
          <li className="flex min-h-[40px] items-center py-1.5 text-[12px] text-white/50">
            {touched.length > 0 ? `${untouched} more not started` : `${untouched} movements · none started`}
          </li>
        )}
      </ol>

      {!locked && (
        adding ? (
          <div className="mt-2 grid grid-cols-2 gap-x-4 border-t border-white/[0.06] pt-1">
            <input aria-label="Added movement name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Movement name" className={`${FIELD} col-span-2`} />
            <input aria-label="Added movement sets" value={sets} onChange={(event) => setSets(event.target.value)} inputMode="numeric" placeholder="Sets" className={FIELD} />
            <input aria-label="Added movement reps" value={reps} onChange={(event) => setReps(event.target.value)} placeholder="Reps or time" className={FIELD} />
            <input aria-label="Added movement reason" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Why (optional)" className={`${FIELD} col-span-2`} />
            <div className="col-span-2 mt-2 flex items-center gap-2">
              {name.trim() ? (
                <ReserveButton tier="secondary" size="sm" icon={Plus} onClick={add}>Add Movement</ReserveButton>
              ) : (
                <ReserveButton tier="secondary" size="sm" icon={Plus} disabled disabledReason="Name the movement first.">Add Movement</ReserveButton>
              )}
              <ReserveButton tier="quiet" size="sm" onClick={() => setAdding(false)}>Cancel</ReserveButton>
            </div>
          </div>
        ) : (
          <div className="border-t border-white/[0.06]">
            <ReserveButton tier="quiet" size="sm" icon={Plus} onClick={() => setAdding(true)}>Add Movement</ReserveButton>
          </div>
        )
      )}

      {locked ? (
        savedNotes && (
          <p className="mt-2 border-t border-white/[0.06] pt-2 text-[13px] leading-[1.5] text-white/70">
            <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-white/50">Notes · </span>{savedNotes}
          </p>
        )
      ) : (
        <div className="mt-2 flex items-end gap-3 border-t border-white/[0.06] pt-1">
          <textarea
            aria-label="Session execution notes"
            value={notes}
            onChange={(event) => setNotesDraft({ recordId: record.id, value: event.target.value })}
            rows={1}
            placeholder="Session notes"
            className={`${FIELD} resize-none leading-[1.5]`}
          />
          {notes.trim() === savedNotes.trim() ? (
            <ReserveButton tier="quiet" size="sm" disabled disabledReason="Nothing new to save.">Save</ReserveButton>
          ) : (
            <ReserveButton tier="quiet" size="sm" onClick={() => updateTrainingExecutionMetrics({ athleteNotes: notes.trim() || undefined })}>Save</ReserveButton>
          )}
        </div>
      )}
    </section>
  );
}
