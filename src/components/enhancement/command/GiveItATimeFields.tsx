"use client";

import { Clock } from "lucide-react";
import { useState } from "react";

import { ReserveButton } from "@/components/ui/reserve";
import { TIME_CHOICES, choiceLabel, timePatch, type TimeChoiceKey, type TimePatch } from "@/lib/compound-command/give-it-a-time";
import { RESERVE, alpha } from "@/lib/design/tokens";

/* ════════════════════════════════════════════════════════════════════════
   WHEN DO YOU TAKE IT? — the one question, on its own.

   Kept free of any container so it can be asked wherever the member is:
   in a sheet of its own, or inline the moment they add something from the
   library. Not a <form>, so it nests anywhere without breaking one.
   ════════════════════════════════════════════════════════════════════════ */

export function GiveItATimeFields({
  resetKey,
  submitLabel = "Put it in my day",
  secondary,
  onSubmit,
}: {
  /** A fresh question whenever this changes. */
  resetKey: string;
  submitLabel?: string;
  secondary?: React.ReactNode;
  onSubmit: (patch: TimePatch, label: string) => void;
}) {
  const [choice, setChoice] = useState<TimeChoiceKey>("morning");
  const [clock, setClock] = useState("08:00");
  const [touched, setTouched] = useState(false);

  const [seen, setSeen] = useState(resetKey);
  if (seen !== resetKey) {
    setSeen(resetKey);
    setChoice("morning");
    setClock("08:00");
    setTouched(false);
  }

  const patch = timePatch(choice, clock);

  const submit = () => {
    setTouched(true);
    if (!patch) return;
    onSubmit(patch, choiceLabel(choice, clock));
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="When you take it">
        {TIME_CHOICES.map((option) => {
          const on = option.key === choice;
          return (
            <button
              key={option.key}
              type="button"
              aria-pressed={on}
              onClick={() => setChoice(option.key)}
              className="min-h-[40px] rounded-full px-3.5 text-[12.5px] transition"
              style={{
                background: on ? alpha(RESERVE.steel, 0.16) : "rgba(255,255,255,0.03)",
                boxShadow: `inset 0 0 0 1px ${on ? alpha(RESERVE.steel, 0.5) : "rgba(255,255,255,0.08)"}`,
                color: on ? RESERVE.ivory : "rgba(255,255,255,0.7)",
              }}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {choice === "custom" && (
        <label className="block">
          <span className="text-[11.5px] text-white/55">The time you take it</span>
          <input
            type="time"
            value={clock}
            onChange={(e) => setClock(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
            className="mt-1 min-h-[44px] w-[160px] rounded-[12px] border border-white/[0.1] bg-black/30 px-3 text-[16px] text-[#f2eee6] outline-none focus:border-white/30 sm:text-[13px]"
          />
        </label>
      )}

      {touched && !patch && (
        <p role="alert" className="text-[12.5px]" style={{ color: RESERVE.red }}>Give it a time between 00:00 and 23:59.</p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <ReserveButton tier="primary" size="sm" icon={Clock} onClick={submit}>{submitLabel}</ReserveButton>
        {secondary}
      </div>
    </div>
  );
}
