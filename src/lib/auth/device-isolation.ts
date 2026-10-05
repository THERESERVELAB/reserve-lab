/**
 * Private browser persistence owned by a signed-in Reserve Lab account.
 *
 * Supabase manages its own auth-session key. This registry covers only app
 * data and is purged at explicit logout or an account boundary so the next
 * person using the device cannot recover the previous member's records.
 */

export const PRIVATE_DEVICE_KEYS = [
  "final-boss-athlete-settings",
  "fba-sync-meta",
  "fba.logs.training.v1",
  "fba.logs.nutrition.v1",
  "fba.logs.recovery.v1",
  "fba.logs.pending.v1",
  "final-boss-athlete.analytics.queue",
  "reserve.coaching.v1",
  "reserve-coaching-ui",
] as const;

export const PRIVATE_DEVICE_PREFIXES = ["fba-backup:"] as const;

type StorageBoundary = Pick<Storage, "length" | "key" | "removeItem">;

export function clearPrivateDeviceStorage(storage: StorageBoundary): void {
  for (const key of PRIVATE_DEVICE_KEYS) storage.removeItem(key);

  const prefixedKeys: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key && PRIVATE_DEVICE_PREFIXES.some((prefix) => key.startsWith(prefix))) {
      prefixedKeys.push(key);
    }
  }
  for (const key of prefixedKeys) storage.removeItem(key);
}

export function clearPrivateDeviceState(): void {
  if (typeof window === "undefined") return;
  try {
    clearPrivateDeviceStorage(window.localStorage);
  } catch {
    // Browser privacy/quota restrictions must not prevent Supabase sign-out.
  }
}
