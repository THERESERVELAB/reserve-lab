/**
 * POST /api/integrations/whoop/sync
 *
 * Pull this member's WHOOP records since the last successful sync and store
 * them as observations. Deliberately a request the member (or a later
 * scheduler) makes, not a background daemon: one member, one window, bounded
 * pages, and a row on the connection that says when it last actually worked.
 *
 * The window overlaps the previous one, because WHOOP revises a record after
 * it first appears. The overlap re-reads those records and the dedupe key
 * makes the revision replace the earlier reading.
 */

import { NextResponse } from "next/server";

import { readCollection, syncWindow, toObservations, WhoopApiError } from "@/lib/devices/whoop";
import { getWhoopConfig } from "@/lib/devices/whoop-config";
import {
  ensureFreshAccessToken,
  findSource,
  markSyncFailed,
  markSynced,
  recordObservations,
  toConnectionView,
} from "@/lib/devices/whoop-connection";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { requireRequestUserId } from "@/lib/supabase/route-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const REFRESH_FAILURE_MESSAGE: Record<string, string> = {
  "no-vault": "This deployment has no key to open stored credentials with.",
  "not-connected": "WHOOP is not connected.",
  "no-refresh-token": "This connection cannot renew itself. Reconnect WHOOP.",
  "refresh-failed": "WHOOP refused to renew this connection. Reconnect WHOOP.",
};

export async function POST(request: Request) {
  const config = getWhoopConfig();
  if (!config.configured) {
    return NextResponse.json(
      { error: config.reason, code: "not_configured", missing: config.missing },
      { status: 503 },
    );
  }

  const auth = await requireRequestUserId(request);
  if ("response" in auth) return auth.response;

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Reserve cannot reach its own database on this deployment.", code: "database_unavailable" },
      { status: 503 },
    );
  }

  const source = await findSource(admin, auth.userId);
  if (!source) {
    return NextResponse.json({ error: "WHOOP is not connected.", code: "not_connected" }, { status: 409 });
  }

  const token = await ensureFreshAccessToken(admin, source, config.config);
  if (!token.ok) {
    return NextResponse.json(
      { error: REFRESH_FAILURE_MESSAGE[token.reason], code: token.reason, reconnectRequired: true },
      { status: 409 },
    );
  }

  const now = new Date();
  const window = syncWindow(source.last_successful_sync_at, now);
  const accessToken = token.accessToken;

  try {
    const [recovery, cycle, sleep, workout] = await Promise.all([
      readCollection("recovery", { accessToken, start: window.start, end: window.end }),
      readCollection("cycle", { accessToken, start: window.start, end: window.end }),
      readCollection("sleep", { accessToken, start: window.start, end: window.end }),
      readCollection("workout", { accessToken, start: window.start, end: window.end }),
    ]);

    const observations = toObservations(auth.userId, {
      recovery: recovery.records,
      cycle: cycle.records,
      sleep: sleep.records,
      workout: workout.records,
    }, { importedAt: now.toISOString() });

    const written = await recordObservations(
      admin,
      auth.userId,
      source.id,
      observations.map((observation) => ({
        dedupeKey: observation.dedupeKey,
        provider: observation.provider,
        sourceDevice: observation.sourceDevice,
        originalRecordId: observation.originalRecordId,
        category: observation.category,
        measurementType: observation.measurementType,
        value: observation.value,
        unit: observation.unit,
        observedAt: observation.observedAt,
        importedAt: observation.importedAt,
        permissionScope: observation.permissionScope,
        metadata: observation.metadata,
      })),
    );

    if (written.error) {
      await markSyncFailed(admin, source.id, "Readings could not be stored.");
      return NextResponse.json(
        { error: "WHOOP answered, but the readings could not be stored.", code: "write_failed" },
        { status: 502 },
      );
    }

    const truncated = recovery.truncated || cycle.truncated || sleep.truncated || workout.truncated;
    // A truncated read must NOT advance the cursor to now, or the pages that
    // were never fetched would be skipped for good. Leave the mark where it
    // was and let the next sync continue from the same place.
    if (!truncated) {
      await markSynced(admin, source.id, now.toISOString(), null);
    } else {
      await markSyncFailed(admin, source.id, "More history is waiting. Sync again to continue.");
    }

    const updated = await findSource(admin, auth.userId);

    return NextResponse.json({
      ok: true,
      window,
      counts: {
        recovery: recovery.records.length,
        cycle: cycle.records.length,
        sleep: sleep.records.length,
        workout: workout.records.length,
        observations: written.written,
      },
      moreHistoryWaiting: truncated,
      connection: updated ? toConnectionView(updated) : null,
    });
  } catch (error) {
    const status = error instanceof WhoopApiError ? error.status : 502;
    const message =
      status === 401 || status === 403
        ? "WHOOP rejected this connection. Reconnect WHOOP."
        : status === 429
          ? "WHOOP is rate limiting this connection. Try again shortly."
          : "WHOOP could not be reached.";

    await markSyncFailed(admin, source.id, message);
    return NextResponse.json(
      { error: message, code: "whoop_unavailable", reconnectRequired: status === 401 || status === 403 },
      { status: status === 429 ? 429 : 502 },
    );
  }
}
