"use client";

import { useId, useState } from "react";

import { useAthleteDashboardStore } from "@/lib/athlete-store";

import { SETTINGS_INPUT } from "./SettingsControls";

const MAX_NAME = 60;

/**
 * The member's name, editable after setup. Saved on demand like the age
 * field beside it, so a half-typed name is never what Reserve greets.
 */
export function ProfileNameField() {
  const name = useAthleteDashboardStore((s) => s.profile.name);
  const updateProfile = useAthleteDashboardStore((s) => s.updateProfile);
  const [draft, setDraft] = useState(name);
  const [status, setStatus] = useState<string | null>(null);
  const inputId = useId();
  const noteId = useId();

  const trimmed = draft.trim();
  const tooLong = trimmed.length > MAX_NAME;
  const changed = trimmed !== name.trim();

  function save(event: React.FormEvent) {
    event.preventDefault();
    if (!changed || tooLong) return;
    updateProfile({ name: trimmed });
    setDraft(trimmed);
    setStatus(trimmed ? "Name saved." : "Name removed.");
  }

  return (
    <form onSubmit={save} noValidate>
      <label htmlFor={inputId} className="sr-only">
        Name
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          id={inputId}
          data-settings-field="name"
          type="text"
          autoComplete="name"
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            setStatus(null);
          }}
          aria-describedby={noteId}
          aria-invalid={tooLong || undefined}
          placeholder="Your name"
          className={`${SETTINGS_INPUT} max-w-[280px]`}
        />
        {changed && (
          <button
            type="submit"
            disabled={tooLong}
            title={tooLong ? `Use ${MAX_NAME} characters or fewer.` : undefined}
            className="min-h-[44px] rounded-lg border border-[#d5b15f]/35 bg-[#d5b15f]/[0.1] px-4 font-mono text-[11px] uppercase tracking-[0.16em] text-[#e8c87a] transition hover:bg-[#d5b15f]/[0.16] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Save name
          </button>
        )}
      </div>
      <p id={noteId} className="mt-2 text-[12px] leading-[1.55] text-white/55">
        {tooLong ? <span className="text-[#ef9b7d]">Use {MAX_NAME} characters or fewer.</span> : "Used to greet you and to label your own records."}
      </p>
      {status && (
        <p role="status" className="mt-1 text-[12px] leading-[1.55] text-[#e8c87a]">
          {status}
        </p>
      )}
    </form>
  );
}
