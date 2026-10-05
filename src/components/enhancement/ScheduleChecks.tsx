"use client";

import { CheckCircle2, Clock } from "lucide-react";
import { useEffect, useMemo } from "react";

import { ReserveButton } from "@/components/ui/reserve";
import { supportPlanItemsNotOnSchedule, useAthleteDashboardStore } from "@/lib/athlete-store";
import { RESERVE, alpha } from "@/lib/design/tokens";
import type { EnhancementScheduleSlot } from "@/lib/enhancement/schedule";
import { findScheduleConflicts, type ConflictKind } from "@/lib/enhancement/schedule-conflicts";

const KIND_LABEL: Record<ConflictKind, string> = {
  absorption: "Absorption",
  "stimulant-bedtime": "Sleep",
  "sedating-training": "Training",
  "duplicate-nutrient": "Adds up",
};

/**
 * Checks on the day as the member set it. Names clashes with a source; never
 * a time to use instead. The member moves things — or doesn't.
 */
export function ScheduleChecks({
  slots,
  sleepTime,
  trainingTime,
  onSetTime,
}: {
  slots: EnhancementScheduleSlot[];
  sleepTime?: string;
  trainingTime?: string;
  onSetTime: (entryId: string) => void;
}) {
  const entries = useAthleteDashboardStore((s) => s.trainingSession.enhancementLog);
  const supportPlan = useAthleteDashboardStore((s) => s.supportPlan);
  const syncSupportPlanToSchedule = useAthleteDashboardStore((s) => s.syncSupportPlanToSchedule);
  /* Everything the member chose for their support plan belongs on their schedule too. */
  useEffect(() => {
    syncSupportPlanToSchedule();
  }, [supportPlan, syncSupportPlanToSchedule]);

  /* Whatever is still off the schedule after a sync did not fit in a full log. */
  const skippedFull = useMemo(() => supportPlanItemsNotOnSchedule(supportPlan ?? [], entries).length, [supportPlan, entries]);

  const conflicts = useMemo(() => findScheduleConflicts({ slots, sleepTime, trainingTime }), [slots, sleepTime, trainingTime]);

  /* Plan items on the schedule without a time yet: Reserve never picks one. */
  const needsTime = useMemo(
    () => entries.filter((e) => e.supportPlanItemId && e.isActive && (!e.timeOfDayPreference || e.timeOfDayPreference === "unspecified")),
    [entries],
  );

  if (slots.length === 0 && needsTime.length === 0 && skippedFull === 0) return null;

  return (
    <section aria-label="Checks on your schedule" className="rounded-[16px] px-4 py-3.5" style={{ background: alpha(conflicts.length ? RESERVE.amber : RESERVE.green, 0.05) }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="type-whisper" style={{ color: alpha(conflicts.length ? RESERVE.amber : RESERVE.green, 0.9) }}>
          Checks on your schedule
        </p>
        <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/45">
          {conflicts.length === 0 ? "No clashes found" : `${conflicts.length} ${conflicts.length === 1 ? "clash" : "clashes"} to look at`}
        </p>
      </div>

      {conflicts.length === 0 ? (
        <p className="mt-1.5 flex items-center gap-1.5 text-[12.5px] text-white/65">
          <CheckCircle2 size={13} aria-hidden="true" style={{ color: RESERVE.green }} />
          Nothing on today&apos;s times matches a known absorption, sleep, training or add-up clash.
        </p>
      ) : (
        <ul className="mt-2 flex flex-col gap-2.5">
          {conflicts.map((conflict) => (
            <li key={conflict.id}>
              <p className="flex flex-wrap items-baseline gap-x-2 text-[13px] font-semibold" style={{ color: RESERVE.ivory }}>
                <span className="font-mono text-[8.5px] uppercase tracking-[0.16em]" style={{ color: RESERVE.amber }}>{KIND_LABEL[conflict.kind]}</span>
                {conflict.title}
              </p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-white/70">
                {conflict.items.map((item) => (
                  <span key={`${item.name}-${item.time}`} className="inline-flex items-center gap-1">
                    <Clock size={11} aria-hidden="true" className="text-white/40" />
                    {item.name} · {item.time}
                  </span>
                ))}
              </p>
              <p className="mt-0.5 text-[12px] leading-[1.5] text-white/60">{conflict.detail}</p>
              <p className="mt-0.5 text-[10.5px] text-white/35">
                {conflict.source.url ? <a href={conflict.source.url} target="_blank" rel="noreferrer" className="underline decoration-white/20 underline-offset-2">{conflict.source.label}</a> : conflict.source.label}
              </p>
            </li>
          ))}
          <li className="text-[11.5px] leading-[1.5] text-white/45">You set these times. A pharmacist can go through any clash with you, including your medicines.</li>
        </ul>
      )}

      {needsTime.length > 0 && (
        <div className="mt-3">
          <p className="text-[12px] leading-[1.5] text-white/60">From your support plan, on your schedule without a time. Set when you take each one to include it in these checks.</p>
          <ul className="mt-1.5 flex flex-col gap-1.5">
            {needsTime.map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[12.5px]" style={{ color: RESERVE.ivory }}>{entry.displayName || entry.name}</span>
                <ReserveButton tier="secondary" size="sm" icon={Clock} onClick={() => onSetTime(entry.id)}>
                  Set time
                </ReserveButton>
              </li>
            ))}
          </ul>
        </div>
      )}

      {skippedFull > 0 && (
        <p className="mt-2 text-[11.5px] leading-[1.5]" style={{ color: RESERVE.amber }}>
          {skippedFull} support plan {skippedFull === 1 ? "item isn't" : "items aren't"} on your schedule because your log is full at 40 entries. Remove one you no longer track to make room.
        </p>
      )}
    </section>
  );
}
