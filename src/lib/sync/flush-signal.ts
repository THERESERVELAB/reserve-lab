/**
 * Cycle-free bridge between the athlete store and the sync engine.
 *
 * Store actions call `requestSyncFlush("reason")` after member-critical
 * writes (workout completion, onboarding completion, sleep log, custom plan,
 * meal log). The sync engine registers a listener when it starts. When no
 * engine is running (local mode, signed out) the call is a safe no-op.
 */

export type SyncFlushReason =
  | "workout-complete"
  | "workout-start"
  | "onboarding-complete"
  /** Step navigation inside the wizard — must not wait for the debounce. */
  | "onboarding-draft"
  | "sleep-log"
  /** Water, mobility, steps and check-ins: a member's recovery record must not wait on the debounce. */
  | "recovery-log"
  | "custom-plan-save"
  | "custom-meal-save"
  | "meal-plan-save"
  | "meal-log"
  | "lifestyle-schedule-save"
  | "lifestyle-week-assign"
  | "lifestyle-actual-record"
  | "custom-workout-template-save"
  | "movement-selection"
  | "training-override"
  | "program-mode-change"
  | "program-save"
  | "program-activate"
  | "program-day-save"
  | "program-day-lock"
  | "program-day-restore"
  | "program-day-history"
  | "program-recommendation-preferences"
  | "program-recommendation-decision"
  | "program-import-draft"
  | "program-import-activate"
  | "nutrition-ownership"
  /** Records the member restored from a device backup (Settings → Recover from this device). */
  | "device-restore"
  | "logout"
  | "manual";

type FlushListener = (reason: SyncFlushReason) => void;

let listener: FlushListener | null = null;

export function requestSyncFlush(reason: SyncFlushReason): void {
  listener?.(reason);
}

/** Returns an unsubscribe function. Only one engine listens at a time. */
export function onSyncFlushRequest(next: FlushListener): () => void {
  listener = next;
  return () => {
    if (listener === next) listener = null;
  };
}
