import { create } from "zustand";

/**
 * Observable sync state for the UI indicator. "saved" is only entered after
 * the cloud upsert is confirmed — never optimistically.
 */
export type SyncStatus =
  /** No cloud configured / signed out — everything stays on this device. */
  | "local-only"
  /** First-login hydration/merge in progress. */
  | "restoring"
  /** Local changes waiting for the debounced push. */
  | "pending"
  /** Upsert in flight. */
  | "saving"
  /** Cloud confirmed the latest state. */
  | "saved"
  /** Browser offline — changes kept in the local copy. */
  | "offline"
  /** Cloud write/read failed; retrying conservatively. */
  | "error";

type SyncStatusStore = {
  status: SyncStatus;
  /** ISO timestamp of the last cloud-confirmed save. */
  lastSavedAt: string | null;
  /** Human-readable detail for the error state. */
  detail: string | null;
  setStatus: (status: SyncStatus, detail?: string | null) => void;
  markSaved: (at: string) => void;
};

export const useSyncStatusStore = create<SyncStatusStore>((set) => ({
  status: "local-only",
  lastSavedAt: null,
  detail: null,
  setStatus: (status, detail = null) => set({ status, detail }),
  markSaved: (at) => set({ status: "saved", lastSavedAt: at, detail: null }),
}));

export const SYNC_STATUS_META: Record<SyncStatus, { label: string; tone: "quiet" | "active" | "warn" | "bad" }> = {
  "local-only": { label: "Local Copy", tone: "quiet" },
  restoring: { label: "Restoring Progress", tone: "active" },
  pending: { label: "Saving…", tone: "active" },
  saving: { label: "Saving…", tone: "active" },
  saved: { label: "Saved", tone: "quiet" },
  offline: { label: "Offline · Local Copy", tone: "warn" },
  error: { label: "Sync Error", tone: "bad" },
};
