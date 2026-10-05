/**
 * Recover from cloud history — read the 30-day version history the database
 * keeps for the member (supabase/migrations/0008_member_state_guard.sql) and
 * surface records that are no longer in the member's account, reusing the same
 * pipeline as "Recover from this device" (device-recovery.ts).
 *
 * This is the self-serve path for the data loss that used to need a hand-run
 * SQL restore: the history is on the server, so it survives even when the
 * member switched phones or cleared the device that held the only safety copy.
 *
 * Nothing is restored automatically. The member picks what comes back; a
 * restore merges each record in by its own id, never replaces anything the
 * member has now, clears the tombstone for the chosen record so it outranks the
 * removal on every device, and syncs like any other edit.
 */

import { serializeMemberState } from "@/lib/athlete-store";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";
import { findRecoverableRecords, type RecoverableRecord } from "@/lib/sync/device-recovery";
import type { BackupRecord } from "@/lib/sync/local-backup";

/** How many of the newest history versions to read. 30 days rarely exceeds this. */
export const CLOUD_HISTORY_LIMIT = 80;

type HistoryRow = { id: number | string; state: unknown; replaced_at: unknown };

/**
 * Pure: turn member_state_history rows into the backup shape device-recovery
 * already reads. The stored `state` is the cloud envelope ({ slices, ... });
 * parseBackupSlices handles that shape, so JSON of the envelope is the raw.
 */
export function historyRowsToBackups(rows: HistoryRow[]): BackupRecord[] {
  return rows.map((row) => ({
    key: `cloud-history:${String(row.id)}`,
    tag: "cloud-history",
    takenAt: typeof row.replaced_at === "string" ? row.replaced_at : "",
    raw: JSON.stringify(row.state ?? {}),
  }));
}

/**
 * Scan the member's cloud history for records missing from their account now.
 * Returns [] when offline, signed out, unconfigured, or nothing is recoverable
 * — the caller shows "nothing to recover" either way.
 */
export async function scanCloudHistory(): Promise<RecoverableRecord[]> {
  if (typeof window === "undefined") return [];
  const supabase = getBrowserSupabaseClient();
  if (!supabase) return [];

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  const userId = sessionData.session?.user?.id;
  if (sessionError || !userId) return [];

  const { data, error } = await supabase
    .from("member_state_history")
    .select("id, state, replaced_at")
    .eq("user_id", userId)
    .order("replaced_at", { ascending: false })
    .limit(CLOUD_HISTORY_LIMIT);
  if (error || !data) return [];

  return findRecoverableRecords(historyRowsToBackups(data as HistoryRow[]), serializeMemberState());
}
