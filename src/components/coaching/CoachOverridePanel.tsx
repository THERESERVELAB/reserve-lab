"use client";

/* ADJUST TODAY — the coach's live-day sheet. The coach edits the day, sees
   the day the athlete will get, then sends it for approval or applies it
   directly (which needs manage-level live-day access). Guarded: an outside
   click never discards the edits; Send and Apply sit in the sheet footer,
   above any tab bar. */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ReserveBottomSheet, useDirtySnapshot } from "@/components/ui/reserve";
import { buildAdaptedDay, type AdaptedDayResult } from "@/lib/coaching/live-day/engine";
import { canManage } from "@/lib/coaching/permissions";
import { minutesToTime } from "@/lib/coaching/ids";
import { useCoachingStore } from "@/lib/coaching/store";
import type { LiveDayReason } from "@/lib/coaching/types";
import { DayTimelineView } from "./LiveDayShared";
import { CommandButton, DiffRow, Field, MicroLabel, SegmentedControl, inputClass } from "./ui";

const REASONS: LiveDayReason[] = [
  "custom", "low_readiness", "poor_sleep", "sleep_interrupted", "stress_elevated", "training_time_change",
  "training_canceled", "work_change", "travel_delay", "family_commitment", "equipment_change",
  "grocery_incomplete", "meal_prep_unavailable", "restaurant_meal",
];

export function CoachOverridePanel({
  athleteId,
  onClose,
}: {
  athleteId: string;
  onClose: () => void;
}) {
  const run = useCoachingStore((s) => s.run);
  const actorId = useCoachingStore((s) => s.actorId);
  const day = useCoachingStore((s) =>
    s.db.activeDayPlans
      .filter((p) => p.athleteId === athleteId)
      .sort((a, b) => b.date.localeCompare(a.date))[0] ?? null,
  );
  const relationship = useCoachingStore((s) =>
    s.db.relationships.find(
      (r) => r.coachId === s.actorId && r.athleteId === athleteId && r.status === "active",
    ) ?? null,
  );
  const athleteName = useCoachingStore(
    (s) => s.db.members.find((m) => m.id === athleteId)?.name ?? "Athlete",
  );

  /* The sheet re-focuses its panel whenever onClose changes identity; hold the caller's in a ref. */
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });
  const close = useCallback(() => onCloseRef.current(), []);

  const base = day?.liveVersion ?? null;
  const [wake, setWake] = useState(base?.wakeTime ?? "06:30");
  const [bed, setBed] = useState(base?.bedTime ?? "22:30");
  const [trainingMode, setTrainingMode] = useState<"keep" | "move" | "remove">("keep");
  const [trainingTime, setTrainingTime] = useState(base?.trainingTime ?? "17:30");
  const [demandMode, setDemandMode] = useState<"keep" | "adapt">("adapt");
  const [reason, setReason] = useState<LiveDayReason>("custom");
  const [note, setNote] = useState("");
  const [previewAthlete, setPreviewAthlete] = useState(false);
  const dirty = useDirtySnapshot({ wake, bed, trainingMode, trainingTime, demandMode, reason, note });

  const mayApply =
    canManage(relationship, "liveDayOverrides") && relationship?.overrideAuthority === "coach_can_apply";

  const result: AdaptedDayResult | null = useMemo(() => {
    if (!day || !base) return null;
    return buildAdaptedDay({
      original: base,
      nowTime: minutesToTime(new Date().getHours() * 60 + new Date().getMinutes()),
      reason,
      actualWakeTime: wake !== base.wakeTime ? wake : undefined,
      newTrainingTime:
        trainingMode === "remove" ? null : trainingMode === "move" ? trainingTime : undefined,
      keepDemand: demandMode === "keep",
      bedtimeFixed: bed === base.bedTime,
      createdBy: "coach",
      customNote: note.trim() || undefined,
    });
  }, [day, base, wake, bed, trainingMode, trainingTime, demandMode, reason, note]);

  const submit = async (intent: "propose" | "apply") => {
    if (!day || !base || !result) return;
    await run((r) =>
      r.liveDay.proposeOverride({
        athleteId,
        date: day.date,
        source: "coach",
        actorId,
        reason,
        originalSnapshot: day.originalVersion,
        proposedSnapshot: result.proposed,
        explanation: result.explanation,
        impactSummary: result.impactSummary,
        warnings: result.warnings,
        intent,
      }),
    );
    // Send the structured card into the operational channel.
    const thread = relationship
      ? useCoachingStore.getState().db.conversations.find((c) => c.relationshipId === relationship.id)
      : null;
    if (thread) {
      await run((r) =>
        r.messaging.sendMessage({
          threadId: thread.id,
          senderId: actorId,
          body: note.trim(),
          action: {
            kind: "live_day_override",
            title: "COACH DAY ADJUSTMENT",
            rows: result.changes.slice(0, 4).map((c) => ({ label: c.label, value: `${c.from} → ${c.to}` })),
            ctaLabel: "REVIEW CHANGES",
            ctaTarget: "live_day",
            status: intent === "apply" ? "actioned" : "pending",
          },
        }),
      );
    }
    close();
  };

  const noChanges = !result || result.changes.length === 0;

  return (
    <ReserveBottomSheet
      open
      onClose={close}
      title={`Adjust today · ${athleteName}`}
      dirty={dirty}
      footer={
        day && base ? (
          <div data-coach="override-footer" className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-2">
              <CommandButton
                variant="teal"
                className="flex-1"
                disabled={noChanges}
                disabledReason="Make at least one change first"
                onClick={() => void submit("propose")}
              >
                Send for approval
              </CommandButton>
              <CommandButton
                className="flex-1"
                disabled={!mayApply || noChanges}
                disabledReason={!mayApply ? "Needs live-day management access granted by the athlete" : "Make at least one change first"}
                onClick={() => void submit("apply")}
              >
                Apply now
              </CommandButton>
            </div>
            <p className="text-center text-[11px] leading-[1.45] text-white/50">
              Applying now still leaves the athlete a visible change record.
            </p>
          </div>
        ) : undefined
      }
    >
      {!day || !base ? (
        <p className="pb-2 text-[12.5px] leading-[1.5] text-white/65">
          No live day exists for this athlete yet. It starts when the athlete opens their day.
        </p>
      ) : (
        <div className="flex flex-col gap-4 pb-2">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Wake time"><input className={inputClass} type="time" value={wake} onChange={(e) => setWake(e.target.value)} /></Field>
            <Field label="Bedtime target"><input className={inputClass} type="time" value={bed} onChange={(e) => setBed(e.target.value)} /></Field>
          </div>

          <div>
            <MicroLabel className="mb-1.5">Training</MicroLabel>
            <SegmentedControl
              label="Training session"
              options={[
                { value: "keep", label: "Keep session" },
                { value: "move", label: "Move" },
                { value: "remove", label: "Remove" },
              ]}
              value={trainingMode}
              onChange={setTrainingMode}
            />
            {trainingMode === "move" && (
              <input className={`${inputClass} mt-2`} aria-label="New training time" type="time" value={trainingTime} onChange={(e) => setTrainingTime(e.target.value)} />
            )}
          </div>

          <div>
            <MicroLabel className="mb-1.5">Session demand</MicroLabel>
            <SegmentedControl
              label="Session demand"
              options={[
                { value: "adapt", label: "Let Reserve adapt" },
                { value: "keep", label: "Keep as planned" },
              ]}
              value={demandMode}
              onChange={setDemandMode}
            />
          </div>

          <Field label="Reason">
            <select className={inputClass} value={reason} onChange={(e) => setReason(e.target.value as LiveDayReason)}>
              {REASONS.map((r) => (
                <option key={r} value={r}>{r.replace(/_/g, " ")}</option>
              ))}
            </select>
          </Field>
          <Field label="Note to athlete (optional)">
            <input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Shown with the adjustment" />
          </Field>

          {result && (
            <div className="border-t border-white/[0.06] pt-3">
              <MicroLabel className="mb-1">Resulting changes</MicroLabel>
              {result.changes.length === 0 ? (
                <p className="text-[12px] text-white/55">No changes yet. Adjust the fields above.</p>
              ) : (
                <div className="flex flex-col">
                  {result.changes.map((change) => (
                    <DiffRow key={`${change.label}-${change.from}`} label={change.label} from={change.from} to={change.to} removed={change.kind === "removed"} />
                  ))}
                </div>
              )}
              {result.warnings.map((warning) => (
                <p key={warning} className="mt-2 border-l-2 border-[#e8c87a]/40 pl-3 text-[12px] leading-[1.45] text-white/75">{warning}</p>
              ))}
            </div>
          )}

          <CommandButton variant="ghost" className="self-start" onClick={() => setPreviewAthlete((v) => !v)}>
            {previewAthlete ? "Hide athlete view" : "Athlete view"}
          </CommandButton>
          {previewAthlete && result && (
            <div className="border-l-2 border-[#5fb7d5]/35 pl-3">
              <MicroLabel tone="teal" className="mb-2">The day {athleteName.split(" ")[0]} will see</MicroLabel>
              <DayTimelineView plan={result.proposed} compact />
            </div>
          )}
        </div>
      )}
    </ReserveBottomSheet>
  );
}
