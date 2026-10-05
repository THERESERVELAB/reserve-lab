/* ════════════════════════════════════════════════════════════════════════
   COMING BACK FROM WHOOP.

   The callback route redirects into the app with `?whoop=…`. This reads that
   once, turns it into something a member can actually act on, and strips it
   from the address bar so a reload does not replay the same banner.
   ════════════════════════════════════════════════════════════════════════ */

export type WhoopReturn = {
  tone: "good" | "warn" | "bad";
  message: string;
};

const REASONS: Record<string, string> = {
  incomplete: "WHOOP sent Reserve back without an authorization. Nothing was connected. Try again.",
  malformed: "That connection link was not one Reserve issued. Nothing was connected.",
  "bad-signature": "That connection link was not one Reserve issued. Nothing was connected.",
  expired: "That connection link had expired. Start again and finish within ten minutes.",
  not_configured: "WHOOP is not configured on this deployment, so nothing was connected.",
  database_unavailable: "Reserve could not reach its own database, so the connection was not saved.",
  cannot_store_credentials:
    "Reserve will not store WHOOP credentials without an encryption key, so the connection was not saved. Nothing was written in the clear.",
  exchange_failed: "WHOOP declined the exchange. Nothing was connected. Try again.",
};

/** Read the result out of a query string. Pure, so it can be tested directly. */
export function readWhoopReturn(search: string): WhoopReturn | null {
  const params = new URLSearchParams(search);
  const outcome = params.get("whoop");
  if (!outcome) return null;

  if (outcome === "connected") {
    return params.get("limited") === "no_offline_scope"
      ? {
          tone: "warn",
          message:
            "WHOOP is connected, but it did not grant offline access — this connection will stop working within the hour. Disconnect and connect again, allowing all requested permissions.",
        }
      : { tone: "good", message: "WHOOP is connected. Sync to bring in your recent recovery, sleep and strain." };
  }

  if (outcome === "cancelled") {
    return { tone: "warn", message: "WHOOP was not connected. You can start again whenever you like." };
  }

  const reason = params.get("reason") ?? "";
  return { tone: "bad", message: REASONS[reason] ?? "WHOOP could not be connected. Nothing was changed." };
}

/** True when the browser was sent back here by the WHOOP callback. */
export function isWhoopReturn(search: string): boolean {
  return new URLSearchParams(search).has("whoop");
}

/** Take the result and clear it from the URL, so a reload does not repeat it. */
export function consumeWhoopReturn(): WhoopReturn | null {
  if (typeof window === "undefined") return null;
  const result = readWhoopReturn(window.location.search);
  if (!result) return null;

  const url = new URL(window.location.href);
  url.searchParams.delete("whoop");
  url.searchParams.delete("limited");
  url.searchParams.delete("reason");
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);

  return result;
}
