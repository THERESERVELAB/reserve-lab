"use client";

/* ════════════════════════════════════════════════════════════════════════
   WHOOP — Settings → Data and sync.

   The row draws what the SERVER says is true, and nothing else:

     · no credentials on this deployment → the button is disabled and says
       why. It is never shown as live.
     · not connected → Connect, which opens WHOOP's own consent screen.
     · connected → when it last actually synced, with Sync now and Disconnect.
     · expired → the reconnect prompt, because a connection that silently
       stopped renewing is worse than one that says it stopped.

   Nothing here fabricates a state while it waits for the answer.
   ════════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useState } from "react";
import { Link2, RefreshCw, Unlink } from "lucide-react";

import { useAuth } from "@/components/auth/AuthProvider";
import { ReserveButton } from "@/components/ui/reserve";
import { RESERVE } from "@/lib/design/tokens";
import { consumeWhoopReturn, type WhoopReturn } from "@/lib/devices/whoop-return";
import { authorizedFetch } from "@/lib/supabase/client-auth";

import { SettingRow } from "./SettingsControls";

type Connection = {
  status: "not-connected" | "connecting" | "connected" | "paused" | "permission-limited" | "expired" | "error";
  connectedAt: string | null;
  lastSuccessfulSyncAt: string | null;
  lastSyncError: string | null;
  grantedScopes: string[];
  vendorDisplayName: string | null;
};

type Status = {
  available: boolean;
  reason: string | null;
  missing: string[];
  connection: Connection | null;
};

const TONE_CLASS: Record<WhoopReturn["tone"], string> = {
  good: "text-[#9fd8b4]",
  warn: "text-[#e6c877]",
  bad: "text-[#ef9b7d]",
};

function whenSynced(at: string | null): string {
  if (!at) return "Not synced yet.";
  const when = new Date(at);
  if (Number.isNaN(when.getTime())) return "Not synced yet.";
  return `Last synced ${when.toLocaleString()}.`;
}

export function WhoopConnectionRow() {
  const { status: authStatus, user } = useAuth();
  const signedIn = authStatus === "signed-in" && Boolean(user);

  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState<"connect" | "sync" | "disconnect" | null>(null);
  const [notice, setNotice] = useState<WhoopReturn | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  /* Ask the server what it can actually do. Only the server knows whether this
     deployment holds WHOOP credentials, so the row never decides that itself. */
  const readStatus = useCallback(async (): Promise<Status> => {
    const unavailable: Status = { available: false, reason: null, missing: [], connection: null };
    try {
      const response = await authorizedFetch("/api/integrations/whoop/status");
      // A 401 here means the session went away, not that WHOOP is unavailable.
      if (!response.ok) return unavailable;
      return (await response.json()) as Status;
    } catch {
      return unavailable;
    }
  }, []);

  const loadStatus = useCallback(async () => {
    setStatus(await readStatus());
  }, [readStatus]);

  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;

    void (async () => {
      /* Clearing the callback's query string is an external-system update, and
         belongs here; the banner it produces is applied with the status. */
      const returned = consumeWhoopReturn();
      const next = await readStatus();
      if (cancelled) return;
      if (returned) setNotice(returned);
      setStatus(next);
    })();

    return () => {
      cancelled = true;
    };
  }, [signedIn, readStatus]);

  /* Cloud sign-in is what carries the member's identity to WHOOP and back.
     Without it there is no account to attach a connection to. */
  if (!signedIn) {
    return (
      <SettingRow
        label="WHOOP"
        description="Sign in to Reserve first. A WHOOP connection belongs to an account, not to this device."
      >
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-white/45">Sign in required</span>
      </SettingRow>
    );
  }

  if (!status) {
    return (
      <SettingRow label="WHOOP" description="Checking this deployment's WHOOP configuration.">
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-white/45">Checking</span>
      </SettingRow>
    );
  }

  const connect = async () => {
    setBusy("connect");
    setNotice(null);
    try {
      const response = await authorizedFetch("/api/integrations/whoop/start", {
        method: "POST",
        body: JSON.stringify({}),
      });
      const body = (await response.json()) as { authorizeUrl?: string; error?: string };
      if (!response.ok || !body.authorizeUrl) {
        setNotice({ tone: "bad", message: body.error ?? "Reserve could not start a WHOOP connection." });
        setBusy(null);
        return;
      }
      // Leaving the app; WHOOP returns the member to the callback route.
      window.location.assign(body.authorizeUrl);
    } catch {
      setNotice({ tone: "bad", message: "Reserve could not start a WHOOP connection." });
      setBusy(null);
    }
  };

  const sync = async () => {
    setBusy("sync");
    setNotice(null);
    try {
      const response = await authorizedFetch("/api/integrations/whoop/sync", { method: "POST", body: JSON.stringify({}) });
      const body = (await response.json()) as {
        ok?: boolean;
        error?: string;
        moreHistoryWaiting?: boolean;
        counts?: { observations: number };
      };
      if (!response.ok || !body.ok) {
        setNotice({ tone: "bad", message: body.error ?? "WHOOP could not be synced." });
      } else {
        const written = body.counts?.observations ?? 0;
        setNotice({
          tone: body.moreHistoryWaiting ? "warn" : "good",
          message: body.moreHistoryWaiting
            ? `Brought in ${written} readings. More history is waiting — sync again to continue.`
            : written === 0
              ? "WHOOP had nothing new since the last sync."
              : `Brought in ${written} readings from WHOOP.`,
        });
      }
      await loadStatus();
    } catch {
      setNotice({ tone: "bad", message: "WHOOP could not be reached." });
    } finally {
      setBusy(null);
    }
  };

  const disconnect = async () => {
    setBusy("disconnect");
    setConfirmDisconnect(false);
    setNotice(null);
    try {
      const response = await authorizedFetch("/api/integrations/whoop/disconnect", {
        method: "POST",
        body: JSON.stringify({}),
      });
      const body = (await response.json()) as { ok?: boolean; note?: string | null; error?: string };
      setNotice(
        response.ok && body.ok
          ? {
              tone: body.note ? "warn" : "good",
              message: body.note ?? "WHOOP is disconnected. The readings it already sent stay in your record.",
            }
          : { tone: "bad", message: body.error ?? "WHOOP could not be disconnected." },
      );
      await loadStatus();
    } catch {
      setNotice({ tone: "bad", message: "WHOOP could not be disconnected." });
    } finally {
      setBusy(null);
    }
  };

  const connection = status.connection;
  const connected = connection?.status === "connected";
  const expired = connection?.status === "expired";

  const description = !status.available
    ? status.reason ?? "WHOOP is not available on this deployment."
    : expired
      ? connection?.lastSyncError ?? "This connection stopped renewing. Connect WHOOP again to resume syncing."
      : connected
        ? [
            connection?.vendorDisplayName ? `Connected as ${connection.vendorDisplayName}.` : "Connected.",
            whenSynced(connection?.lastSuccessfulSyncAt ?? null),
            connection?.lastSyncError ?? "",
          ]
            .filter(Boolean)
            .join(" ")
        : "Recovery, sleep, strain and workouts, read from your WHOOP account. WHOOP's own scores stay WHOOP's — they are kept beside Reserve Readiness, never merged into it.";

  return (
    <>
      <SettingRow label="WHOOP" description={description}>
        {!status.available ? (
          <ReserveButton
            tier="secondary"
            accent={RESERVE.slate}
            size="sm"
            icon={Link2}
            disabled
            disabledReason={status.reason ?? "WHOOP is not available on this deployment."}
          >
            Connect WHOOP
          </ReserveButton>
        ) : connected ? (
          <div className="flex flex-wrap items-center gap-2">
            <ReserveButton
              tier="secondary"
              accent={RESERVE.gold}
              size="sm"
              icon={RefreshCw}
              busy={busy === "sync"}
              onClick={() => void sync()}
            >
              {busy === "sync" ? "Syncing" : "Sync now"}
            </ReserveButton>
            {!confirmDisconnect ? (
              <ReserveButton tier="quiet" size="sm" icon={Unlink} onClick={() => setConfirmDisconnect(true)}>
                Disconnect
              </ReserveButton>
            ) : (
              <div role="group" aria-label="Confirm disconnecting WHOOP" className="flex flex-wrap items-center gap-2">
                <span className="text-[13px] text-white/70">Disconnect WHOOP?</span>
                <ReserveButton tier="danger" size="sm" busy={busy === "disconnect"} onClick={() => void disconnect()}>
                  Yes, disconnect
                </ReserveButton>
                <ReserveButton tier="quiet" size="sm" onClick={() => setConfirmDisconnect(false)}>
                  Cancel
                </ReserveButton>
              </div>
            )}
          </div>
        ) : (
          <ReserveButton
            tier="secondary"
            accent={RESERVE.gold}
            size="sm"
            icon={Link2}
            busy={busy === "connect"}
            onClick={() => void connect()}
          >
            {busy === "connect" ? "Opening WHOOP" : expired ? "Reconnect WHOOP" : "Connect WHOOP"}
          </ReserveButton>
        )}
      </SettingRow>

      {notice && (
        <li className="py-2">
          <p role="status" className={`max-w-[64ch] text-[13px] leading-[1.55] ${TONE_CLASS[notice.tone]}`}>
            {notice.message}
          </p>
        </li>
      )}

      {/* The missing variable names are for whoever deploys this, not for a
          member, so they appear in development only. */}
      {process.env.NODE_ENV === "development" && status.missing.length > 0 && (
        <li className="pb-2">
          <p className="font-mono text-[11px] leading-[1.6] text-white/40">Missing: {status.missing.join(", ")}</p>
        </li>
      )}
    </>
  );
}
