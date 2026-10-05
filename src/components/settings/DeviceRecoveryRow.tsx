"use client";

/* ════════════════════════════════════════════════════════════════════════
   RECOVER FROM THIS DEVICE — Settings → Data and sync.

   Lists records this device's safety copies still hold that are not in the
   member's account now, and restores only the ones the member ticks. Nothing
   is restored on its own; nothing current is ever replaced.
   ════════════════════════════════════════════════════════════════════════ */

import { useMemo, useState } from "react";

import { useSafetyToolsVisible } from "@/components/authz/CapabilitiesProvider";
import { ReserveButton } from "@/components/ui/reserve";
import { RESERVE } from "@/lib/design/tokens";
import { restoreRecords, scanThisDevice, type RecoverableRecord } from "@/lib/sync/device-recovery";

import { RecoveryResults, type RecoveryResultsCopy } from "./RecoveryResults";
import { SettingRow } from "./SettingsControls";

const RESULTS_COPY: RecoveryResultsCopy = {
  nothingFound: "Nothing to recover on this device. Everything in its safety copies is already in your account.",
  intro: "Found in this device's safety copies and not in your account now. Choose what to bring back.",
  restore: (n: number) => (n === 0 ? "Restore selected" : n === 1 ? "Restore 1 record" : `Restore ${n} records`),
  restoreDisabled: "Choose at least one record to restore.",
  removedOn: (day: string) => `You removed this on ${day}.`,
  sameName: "An entry with this name is in your records now.",
  withChildren: (n: number) => (n === 1 ? "Brings back 1 taken mark or site log with it." : `Brings back ${n} taken marks and site logs with it.`),
  copiedOn: (day: string) => `From a copy saved ${day}.`,
  footer: "Records that were only on another phone or computer stay on that device. Open Settings there, or use Recover from cloud history below.",
};

export const RECOVERY_COPY = {
  label: "Recover from this device",
  description:
    "This device keeps a few safety copies of your records. Check them for anything that isn't in your account now. Nothing comes back unless you choose it.",
  check: "Check this device",
  checking: "Checking",
  done: "Close",
  restored: (n: number) =>
    n === 1
      ? "Restored 1 record. It's back in your account and will sync to your other devices."
      : `Restored ${n} records. They're back in your account and will sync to your other devices.`,
  ...RESULTS_COPY,
} as const;

export function DeviceRecoveryRow() {
  const safetyToolsVisible = useSafetyToolsVisible();
  const [records, setRecords] = useState<RecoverableRecord[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const visible = useMemo(
    () => (records ?? []).filter((record) => safetyToolsVisible || record.group !== "cycles"),
    [records, safetyToolsVisible],
  );

  const check = () => {
    setBusy(true);
    setNotice(null);
    // Reading safety copies is synchronous; let the button show its state first.
    setTimeout(() => {
      setRecords(scanThisDevice());
      setSelected(new Set());
      setBusy(false);
    }, 0);
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
    setNotice(RECOVERY_COPY.restored(count));
    setRecords(scanThisDevice());
    setSelected(new Set());
  };

  const open = records !== null;

  return (
    <>
      <SettingRow label={RECOVERY_COPY.label} description={RECOVERY_COPY.description}>
        {open ? (
          <ReserveButton tier="quiet" size="sm" onClick={() => { setRecords(null); setSelected(new Set()); }}>
            {RECOVERY_COPY.done}
          </ReserveButton>
        ) : (
          <ReserveButton tier="secondary" accent={RESERVE.slate} size="sm" busy={busy} onClick={check}>
            {busy ? RECOVERY_COPY.checking : RECOVERY_COPY.check}
          </ReserveButton>
        )}
      </SettingRow>

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
          testId="device-recovery-results"
        />
      )}
    </>
  );
}
