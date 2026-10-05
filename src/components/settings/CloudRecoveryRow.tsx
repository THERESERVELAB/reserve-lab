"use client";

/* ════════════════════════════════════════════════════════════════════════
   RECOVER FROM CLOUD HISTORY — Settings → Data and sync.

   The database keeps 30 days of every previous version of the member's record
   (supabase/migrations/0008_member_state_guard.sql). This reads that history,
   surfaces records that are no longer in the account, and restores only the
   ones the member ticks — the self-serve path that used to need a hand-run
   restore. Works even from a new phone, because the history is on the server.

   Nothing is restored on its own; nothing current is ever replaced.
   ════════════════════════════════════════════════════════════════════════ */

import { useMemo, useState } from "react";

import { useSafetyToolsVisible } from "@/components/authz/CapabilitiesProvider";
import { ReserveButton } from "@/components/ui/reserve";
import { RESERVE } from "@/lib/design/tokens";
import { scanCloudHistory } from "@/lib/sync/cloud-recovery";
import { restoreRecords, type RecoverableRecord } from "@/lib/sync/device-recovery";

import { RecoveryResults, type RecoveryResultsCopy } from "./RecoveryResults";
import { SettingRow } from "./SettingsControls";

const RESULTS_COPY: RecoveryResultsCopy = {
  nothingFound: "Nothing to recover from your cloud history. Everything the last 30 days hold is already in your account.",
  intro: "Found in your cloud history and not in your account now. Choose what to bring back.",
  restore: (n: number) => (n === 0 ? "Restore selected" : n === 1 ? "Restore 1 record" : `Restore ${n} records`),
  restoreDisabled: "Choose at least one record to restore.",
  removedOn: (day: string) => `You removed this on ${day}.`,
  sameName: "An entry with this name is in your records now.",
  withChildren: (n: number) => (n === 1 ? "Brings back 1 taken mark or site log with it." : `Brings back ${n} taken marks and site logs with it.`),
  copiedOn: (day: string) => `From a version saved ${day}.`,
  footer: "Your cloud history covers the last 30 days and follows you to any device you sign in on.",
};

const COPY = {
  label: "Recover from cloud history",
  description:
    "Your account keeps 30 days of earlier versions on the server. Check them for anything that isn't in your account now — this works even on a new phone. Nothing comes back unless you choose it.",
  check: "Check cloud history",
  checking: "Checking",
  done: "Close",
  offline: "Couldn't reach your cloud history. Check your connection, make sure you're signed in, and try again.",
  restored: (n: number) =>
    n === 1
      ? "Restored 1 record. It's back in your account and will sync to your other devices."
      : `Restored ${n} records. They're back in your account and will sync to your other devices.`,
} as const;

export function CloudRecoveryRow() {
  const safetyToolsVisible = useSafetyToolsVisible();
  const [records, setRecords] = useState<RecoverableRecord[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const visible = useMemo(
    () => (records ?? []).filter((record) => safetyToolsVisible || record.group !== "cycles"),
    [records, safetyToolsVisible],
  );

  const check = () => {
    setBusy(true);
    setNotice(null);
    setError(null);
    void scanCloudHistory()
      .then((found) => {
        setRecords(found);
        setSelected(new Set());
      })
      .catch(() => setError(COPY.offline))
      .finally(() => setBusy(false));
  };

  const toggle = (key: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const restore = () => {
    const chosen = visible.filter((record) => selected.has(record.key));
    const count = restoreRecords(chosen);
    setNotice(COPY.restored(count));
    setRecords((current) => (current ?? []).filter((record) => !selected.has(record.key)));
    setSelected(new Set());
  };

  const open = records !== null;

  return (
    <>
      <SettingRow label={COPY.label} description={COPY.description}>
        {open ? (
          <ReserveButton tier="quiet" size="sm" onClick={() => { setRecords(null); setSelected(new Set()); }}>
            {COPY.done}
          </ReserveButton>
        ) : (
          <ReserveButton tier="secondary" accent={RESERVE.slate} size="sm" busy={busy} onClick={check}>
            {busy ? COPY.checking : COPY.check}
          </ReserveButton>
        )}
      </SettingRow>

      {error && (
        <li className="py-2">
          <p role="status" className="text-[13px] leading-[1.55] text-[#e7b6a0]">{error}</p>
        </li>
      )}

      {notice && (
        <li className="py-2">
          <p role="status" className="text-[13px] leading-[1.55] text-[#9fd8b4]">{notice}</p>
        </li>
      )}

      {open && (
        <RecoveryResults
          visible={visible}
          selected={selected}
          onToggle={toggle}
          onRestore={restore}
          copy={RESULTS_COPY}
          testId="cloud-recovery-results"
        />
      )}
    </>
  );
}
