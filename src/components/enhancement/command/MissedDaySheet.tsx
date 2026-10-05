"use client";

import { CheckCircle2 } from "lucide-react";
import { useMemo, useState } from "react";

import { ReserveBottomSheet, ReserveButton } from "@/components/ui/reserve";
import { backdateChoices, missedDayLine, type MissedDay, type MissedDayDose } from "@/lib/compound-command/missed-day";
import { RESERVE, alpha } from "@/lib/design/tokens";

/* ════════════════════════════════════════════════════════════════════════
   PUT A DAY RIGHT — pick the day, tick what was actually taken, log it.

   Doses already recorded for that day are shown as they stand and cannot be
   ticked again. Nothing is written until the member presses the action:
   Reserve never decides that a dose was taken.
   ════════════════════════════════════════════════════════════════════════ */

export function MissedDaySheet({
  open,
  now,
  day,
  onPickDay,
  onClose,
  onLog,
}: {
  open: boolean;
  now: Date;
  /** The chosen day, already rebuilt from that day's own schedule. */
  day: MissedDay;
  onPickDay: (date: string) => void;
  onClose: () => void;
  onLog: (doses: MissedDayDose[]) => void;
}) {
  const choices = useMemo(() => backdateChoices(now), [now]);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  /* A new day, or a new opening, starts with everything open ticked. */
  const [seen, setSeen] = useState(`${open}:${day.date}`);
  if (seen !== `${open}:${day.date}`) {
    setSeen(`${open}:${day.date}`);
    setExcluded(new Set());
  }

  const chosen = day.open.filter((dose) => !excluded.has(dose.id));
  const toggle = (id: string) =>
    setExcluded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <ReserveBottomSheet open={open} onClose={onClose} title="Log a missed day" accent={RESERVE.gold}>
      <div className="flex flex-col gap-4" data-missed-day>
        <p className="text-[12.5px] leading-[1.55] text-white/60">
          The day as your plan had it. Tick what you actually took — nothing is recorded until you log it.
        </p>

        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Which day">
          {choices.map((choice) => {
            const on = choice.date === day.date;
            return (
              <button
                key={choice.date}
                type="button"
                aria-pressed={on}
                onClick={() => onPickDay(choice.date)}
                className="min-h-[36px] rounded-full px-3 text-[12px] transition"
                style={{
                  background: on ? alpha(RESERVE.gold, 0.16) : "rgba(255,255,255,0.03)",
                  boxShadow: `inset 0 0 0 1px ${on ? alpha(RESERVE.gold, 0.45) : "rgba(255,255,255,0.08)"}`,
                  color: on ? RESERVE.ivory : "rgba(255,255,255,0.7)",
                }}
              >
                {choice.label}
              </button>
            );
          })}
        </div>

        <p className="text-[12px] text-white/55" data-missed-day-line>{missedDayLine(day)}</p>

        {day.doses.length > 0 && (
          <ul className="flex flex-col divide-y divide-white/[0.05]">
            {day.doses.map((dose) => {
              const recorded = dose.status !== "open";
              const on = !recorded && !excluded.has(dose.id);
              return (
                <li key={dose.id}>
                  <label className={`flex min-h-[44px] items-center gap-3 py-1 text-[13px] ${recorded ? "" : "cursor-pointer"}`}>
                    <input
                      type="checkbox"
                      checked={on}
                      disabled={recorded}
                      onChange={() => toggle(dose.id)}
                      className="h-4 w-4 accent-[#d4b26a] disabled:opacity-40"
                    />
                    <span className={on ? "" : "text-white/45"} style={on ? { color: RESERVE.ivory } : undefined}>{dose.name}</span>
                    <span className="ml-auto shrink-0 text-[11.5px] text-white/45">
                      {recorded ? (dose.status === "taken" ? "already logged" : "skipped") : dose.timeLabel}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {chosen.length === 0 ? (
            <ReserveButton tier="primary" disabled disabledReason={day.none ? "Nothing was on your plan that day." : "Tick a dose to log it for that day."}>
              Log the day
            </ReserveButton>
          ) : (
            <ReserveButton
              tier="primary"
              icon={CheckCircle2}
              onClick={() => {
                onLog(chosen);
                onClose();
              }}
            >
              Log {chosen.length} dose{chosen.length === 1 ? "" : "s"}
            </ReserveButton>
          )}
          <ReserveButton tier="quiet" onClick={onClose}>Cancel</ReserveButton>
        </div>

        <p className="text-[11.5px] leading-[1.5]" style={{ color: alpha(RESERVE.ivory, 0.45) }}>
          Each dose is recorded against that day at its own planned time, exactly as logging it on the day would have.
        </p>
      </div>
    </ReserveBottomSheet>
  );
}
