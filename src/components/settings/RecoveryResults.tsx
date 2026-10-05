"use client";

/* ════════════════════════════════════════════════════════════════════════
   Shared recovery results — the grouped, selectable list and restore control
   used by both "Recover from this device" and "Recover from cloud history".
   Purely presentational: the parent owns the records, the selection and the
   restore action, so each source keeps its own scan behaviour.
   ════════════════════════════════════════════════════════════════════════ */

import { ReserveButton } from "@/components/ui/reserve";
import { RESERVE } from "@/lib/design/tokens";
import { formatDay, type RecoverableRecord } from "@/lib/sync/device-recovery";

export type RecoveryResultsCopy = {
  nothingFound: string;
  intro: string;
  restore: (n: number) => string;
  restoreDisabled: string;
  copiedOn: (day: string) => string;
  removedOn: (day: string) => string;
  sameName: string;
  withChildren: (n: number) => string;
  footer: string;
};

export function RecoveryResults({
  visible,
  selected,
  onToggle,
  onRestore,
  copy,
  testId,
}: {
  visible: RecoverableRecord[];
  selected: Set<string>;
  onToggle: (key: string) => void;
  onRestore: () => void;
  copy: RecoveryResultsCopy;
  testId: string;
}) {
  const groups: Array<{ label: string; items: RecoverableRecord[] }> = [];
  for (const record of visible) {
    const last = groups[groups.length - 1];
    if (last && last.label === record.groupLabel) last.items.push(record);
    else groups.push({ label: record.groupLabel, items: [record] });
  }

  return (
    <li className="flex flex-col gap-3 py-3.5" data-testid={testId}>
      {visible.length === 0 ? (
        <p className="text-[13px] leading-[1.55] text-white/70">{copy.nothingFound}</p>
      ) : (
        <>
          <p className="max-w-[64ch] text-[13px] leading-[1.55] text-white/70">{copy.intro}</p>
          {groups.map((group) => (
            <fieldset key={group.label} className="flex flex-col gap-1">
              <legend className="mb-1 font-mono text-[11px] uppercase tracking-[0.16em] text-white/55">{group.label}</legend>
              {group.items.map((record) => {
                const notes = [
                  ...record.facts,
                  record.copiedAt ? copy.copiedOn(formatDay(record.copiedAt)) : "",
                  record.removedAt ? copy.removedOn(formatDay(record.removedAt)) : "",
                  record.sameNameNow ? copy.sameName : "",
                  record.children.length ? copy.withChildren(record.children.length) : "",
                ].filter(Boolean);
                return (
                  <label
                    key={record.key}
                    className="flex min-h-[44px] cursor-pointer items-start gap-3 rounded-lg px-2 py-2 hover:bg-white/[0.03]"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(record.key)}
                      onChange={() => onToggle(record.key)}
                      className="mt-1 h-4 w-4 accent-[#d5b15f]"
                    />
                    <span className="min-w-0">
                      <span className="block text-[14px] font-semibold text-[#f2eee6]">{record.name}</span>
                      {notes.length > 0 && (
                        <span className="mt-0.5 block text-[12.5px] leading-[1.5] text-white/60">{notes.join(" · ")}</span>
                      )}
                    </span>
                  </label>
                );
              })}
            </fieldset>
          ))}
          <div className="flex flex-wrap items-center gap-2">
            {selected.size === 0 ? (
              <ReserveButton tier="secondary" accent={RESERVE.gold} size="sm" disabled disabledReason={copy.restoreDisabled}>
                {copy.restore(0)}
              </ReserveButton>
            ) : (
              <ReserveButton tier="secondary" accent={RESERVE.gold} size="sm" onClick={onRestore}>
                {copy.restore(selected.size)}
              </ReserveButton>
            )}
          </div>
        </>
      )}
      <p className="max-w-[64ch] text-[12.5px] leading-[1.55] text-white/55">{copy.footer}</p>
    </li>
  );
}
