"use client";

import { useId, useState } from "react";

import { useAthleteDashboardStore } from "@/lib/athlete-store";
import { MIN_MEMBER_AGE } from "@/lib/safety/acknowledgement";

const MAX_AGE = 120;
const AGE_ERROR = `Enter your age as a whole number between 1 and ${MAX_AGE}.`;

function parseAge(raw: string): { age: number | undefined } | { error: string } {
  const text = raw.trim();
  if (!text) return { age: undefined };
  if (!/^\d{1,3}$/.test(text)) return { error: AGE_ERROR };
  const age = Number(text);
  return age >= 1 && age <= MAX_AGE ? { age } : { error: AGE_ERROR };
}

const isUnderAge = (age: number | undefined) => typeof age === "number" && age > 0 && age < MIN_MEMBER_AGE;

/**
 * The member's age, editable after setup. Saved on demand — never per
 * keystroke, so typing "18" never passes through "1". Saving an age under 18
 * closes the adults-only safety tools and withdraws the adult confirmation.
 */
export function ProfileAgeField() {
  const age = useAthleteDashboardStore((s) => s.setupProfile.age);
  const setSetupProfile = useAthleteDashboardStore((s) => s.setSetupProfile);
  const [draft, setDraft] = useState(age ? String(age) : "");
  const [status, setStatus] = useState<string | null>(null);
  const inputId = useId();
  const noteId = useId();

  const parsed = parseAge(draft);
  const changed = "error" in parsed || parsed.age !== age;

  function save(event: React.FormEvent) {
    event.preventDefault();
    if ("error" in parsed || !changed) return;
    const wasUnderAge = isUnderAge(age);
    setSetupProfile({ age: parsed.age });
    if (parsed.age === undefined) setStatus("Age removed.");
    else if (isUnderAge(parsed.age)) setStatus(`Age saved. Cycle monitoring, compound risk information and lab flags are closed for members under ${MIN_MEMBER_AGE}.`);
    else if (wasUnderAge) setStatus(`Age saved. To open cycle and safety tools, confirm you are ${MIN_MEMBER_AGE} or older in Cycle & Safety.`);
    else setStatus("Age saved.");
  }

  return (
    <form onSubmit={save} noValidate>
      {/* Visually the Settings row names the field; the label still gives the input its name. */}
      <label htmlFor={inputId} className="sr-only">
        Age
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          id={inputId}
          data-settings-field="age"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          maxLength={3}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setStatus(null);
          }}
          aria-describedby={noteId}
          aria-invalid={"error" in parsed || undefined}
          placeholder="Years"
          className="min-h-[44px] w-24 rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 text-[16px] text-[#f2eee6] outline-none placeholder:text-white/22 focus:border-[#d5b15f]/50 md:text-[13px]"
        />
        {changed && (
          <button
            type="submit"
            disabled={"error" in parsed}
            className="min-h-[44px] rounded-lg border border-[#d5b15f]/35 bg-[#d5b15f]/[0.1] px-4 font-mono text-[11px] uppercase tracking-[0.16em] text-[#e8c87a] transition hover:bg-[#d5b15f]/[0.16] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Save age
          </button>
        )}
      </div>
      <p id={noteId} className="mt-2 text-[12px] leading-[1.55] text-white/55">
        {"error" in parsed ? (
          <span className="text-[#ef9b7d]">{parsed.error}</span>
        ) : (
          `Cycle monitoring, compound risk information and lab flags are for adults ${MIN_MEMBER_AGE} and older.`
        )}
      </p>
      {status && (
        <p role="status" className="mt-1 text-[12px] leading-[1.55] text-[#e8c87a]">
          {status}
        </p>
      )}
    </form>
  );
}
