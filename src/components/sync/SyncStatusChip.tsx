"use client";

import { AlertTriangle, Check, CloudOff, HardDrive, Loader2 } from "lucide-react";

import { SYNC_STATUS_META, useSyncStatusStore, type SyncStatus } from "@/lib/sync/sync-status";
import { useAuth } from "@/components/auth/AuthProvider";

const TONE_STYLES: Record<string, { text: string; border: string; bg: string }> = {
  quiet: { text: "#8ea0b8", border: "rgba(255,255,255,0.08)", bg: "rgba(255,255,255,0.03)" },
  active: { text: "#d5b15f", border: "rgba(213,177,95,0.25)", bg: "rgba(213,177,95,0.06)" },
  warn: { text: "#e8c87a", border: "rgba(232,200,122,0.3)", bg: "rgba(232,200,122,0.07)" },
  bad: { text: "#ef7d55", border: "rgba(239,125,85,0.35)", bg: "rgba(239,125,85,0.08)" },
};

function iconFor(status: SyncStatus) {
  switch (status) {
    case "restoring":
    case "pending":
    case "saving":
      return <Loader2 size={11} className="animate-spin" />;
    case "saved":
      return <Check size={11} />;
    case "offline":
      return <CloudOff size={11} />;
    case "error":
      return <AlertTriangle size={11} />;
    case "local-only":
    default:
      return <HardDrive size={11} />;
  }
}

/**
 * Subtle, always-honest sync indicator. "Saved" renders only after the cloud
 * upsert is confirmed by the sync engine — never optimistically.
 */
export function SyncStatusChip({
  showLabel = false,
}: {
  /** Always show the word, not only from `sm` up (the phone More sheet has the room). */
  showLabel?: boolean;
} = {}) {
  const status = useSyncStatusStore((s) => s.status);
  const detail = useSyncStatusStore((s) => s.detail);
  const { status: authStatus } = useAuth();

  // Signed-out surfaces have their own messaging; the chip is member-shell only.
  if (authStatus === "signed-out" || authStatus === "resolving") return null;

  const meta = SYNC_STATUS_META[status];
  const tone = TONE_STYLES[meta.tone];

  return (
    <div
      className="flex h-6 items-center gap-1.5 rounded-full border px-2.5 text-[10px] font-medium tracking-wide"
      style={{ color: tone.text, borderColor: tone.border, background: tone.bg }}
      title={detail ?? meta.label}
      aria-live="polite"
    >
      {iconFor(status)}
      <span className={showLabel ? undefined : "sr-only sm:not-sr-only"}>{meta.label}</span>
    </div>
  );
}
