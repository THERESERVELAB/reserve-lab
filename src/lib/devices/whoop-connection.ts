import "server-only";

/* ════════════════════════════════════════════════════════════════════════
   THE WHOOP CONNECTION — stored, opened, refreshed, and written to.

   Everything here runs with the service role, and every entry point takes an
   already-verified user id. The service role is not authorization: the route
   proves who is asking (`requireRequestUserId`), and this module then acts
   only on that member's rows.

   Tokens are sealed on the way in and opened only in memory. Nothing in this
   file returns a token to a caller that is going to serialise it.
   ════════════════════════════════════════════════════════════════════════ */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database/types";
import type { HealthSourceStatus } from "@/lib/devices/health-sources";
import { getTokenVault } from "@/lib/devices/token-vault";
import {
  refreshAccessToken,
  tokenNeedsRefresh,
  type WhoopTokens,
} from "@/lib/devices/whoop";
import type { WhoopConfig } from "@/lib/devices/whoop-config";

type Admin = SupabaseClient<Database>;

export type SourceRow = Database["public"]["Tables"]["connected_health_sources"]["Row"];

/** What the member is allowed to see about their own connection. No tokens, ever. */
export type WhoopConnectionView = {
  status: HealthSourceStatus;
  connectedAt: string | null;
  lastSuccessfulSyncAt: string | null;
  lastSyncError: string | null;
  grantedScopes: string[];
  vendorDisplayName: string | null;
};

export function toConnectionView(row: SourceRow): WhoopConnectionView {
  return {
    status: row.status as HealthSourceStatus,
    connectedAt: row.created_at,
    lastSuccessfulSyncAt: row.last_successful_sync_at,
    lastSyncError: row.last_sync_error,
    grantedScopes: row.granted_scopes ?? [],
    vendorDisplayName: row.vendor_display_name,
  };
}

export async function findSource(admin: Admin, userId: string): Promise<SourceRow | null> {
  const { data } = await admin
    .from("connected_health_sources")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", "whoop")
    .maybeSingle();
  return (data as SourceRow | null) ?? null;
}

/**
 * Write a completed authorization. Returns null when there is nowhere safe to
 * put the tokens — the caller must then report a failure, never store them
 * anyway.
 */
export async function saveConnection(
  admin: Admin,
  userId: string,
  tokens: WhoopTokens,
  vendor: { userId?: string | null; displayName?: string | null } = {},
): Promise<SourceRow | null> {
  const vault = getTokenVault();
  if (!vault) return null;

  const { data: source, error: sourceError } = await admin
    .from("connected_health_sources")
    .upsert(
      {
        user_id: userId,
        provider: "whoop",
        status: "connected",
        granted_scopes: tokens.grantedScopes,
        vendor_user_id: vendor.userId ?? null,
        vendor_display_name: vendor.displayName ?? null,
        last_sync_error: null,
        synthetic: false,
      },
      { onConflict: "user_id,provider" },
    )
    .select()
    .single();

  if (sourceError || !source) return null;

  const { error: credentialError } = await admin.from("connected_health_credentials").upsert(
    {
      source_id: source.id,
      user_id: userId,
      access_token_sealed: vault.seal(tokens.accessToken),
      refresh_token_sealed: tokens.refreshToken ? vault.seal(tokens.refreshToken) : null,
      access_token_expires_at: tokens.expiresAt,
    },
    { onConflict: "source_id" },
  );

  if (credentialError) {
    // A source without credentials is a connection that cannot read. Say so
    // on the row rather than leaving a green light over an empty socket.
    await admin
      .from("connected_health_sources")
      .update({ status: "error", last_sync_error: "Credentials could not be stored." })
      .eq("id", source.id);
    return null;
  }

  return source as SourceRow;
}

export type AccessToken =
  | { ok: true; accessToken: string }
  | { ok: false; reason: "no-vault" | "not-connected" | "no-refresh-token" | "refresh-failed" };

/**
 * Hand back a usable access token, renewing it first when it is spent or
 * nearly spent. A refresh failure marks the connection `expired`, which is
 * what the Settings row reads — a member should be told to reconnect, not
 * left looking at a connection that quietly stopped working.
 */
export async function ensureFreshAccessToken(
  admin: Admin,
  source: SourceRow,
  config: WhoopConfig,
  now = new Date(),
): Promise<AccessToken> {
  const vault = getTokenVault();
  if (!vault) return { ok: false, reason: "no-vault" };

  const { data: credentials } = await admin
    .from("connected_health_credentials")
    .select("*")
    .eq("source_id", source.id)
    .maybeSingle();

  if (!credentials) return { ok: false, reason: "not-connected" };

  if (!tokenNeedsRefresh(credentials.access_token_expires_at, now)) {
    return { ok: true, accessToken: vault.open(credentials.access_token_sealed) };
  }

  if (!credentials.refresh_token_sealed) {
    await markExpired(admin, source.id, "WHOOP did not grant offline access, so this connection could not renew itself.");
    return { ok: false, reason: "no-refresh-token" };
  }

  try {
    const renewed = await refreshAccessToken({
      refreshToken: vault.open(credentials.refresh_token_sealed),
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      now,
    });

    await admin
      .from("connected_health_credentials")
      .update({
        access_token_sealed: vault.seal(renewed.accessToken),
        // WHOOP rotates the refresh token; keeping the old one would break the next renewal.
        refresh_token_sealed: renewed.refreshToken
          ? vault.seal(renewed.refreshToken)
          : credentials.refresh_token_sealed,
        access_token_expires_at: renewed.expiresAt,
      })
      .eq("source_id", source.id);

    if (source.status !== "connected") {
      await admin
        .from("connected_health_sources")
        .update({ status: "connected", last_sync_error: null })
        .eq("id", source.id);
    }

    return { ok: true, accessToken: renewed.accessToken };
  } catch {
    await markExpired(admin, source.id, "WHOOP refused to renew this connection. Reconnect to continue syncing.");
    return { ok: false, reason: "refresh-failed" };
  }
}

async function markExpired(admin: Admin, sourceId: string, reason: string): Promise<void> {
  await admin
    .from("connected_health_sources")
    .update({ status: "expired", last_sync_error: reason })
    .eq("id", sourceId);
}

/* ─── Writing observations ────────────────────────────────────────────── */

type ObservationInsert = Database["public"]["Tables"]["connected_health_observations"]["Insert"];

export type ObservationDraft = {
  dedupeKey: string;
  provider: string;
  sourceDevice?: string;
  originalRecordId?: string;
  category: string;
  measurementType: string;
  value: number | string | boolean;
  unit?: string;
  observedAt: string;
  importedAt: string;
  permissionScope: string;
  metadata: Record<string, unknown>;
};

/**
 * Upsert on (user_id, provider, dedupe_key). WHOOP revises a record after it
 * first appears — a recovery goes from PENDING_SCORE to SCORED, a sleep is
 * re-staged — and the revision has to replace the earlier reading rather than
 * sit beside it.
 */
export async function recordObservations(
  admin: Admin,
  userId: string,
  sourceId: string,
  drafts: ObservationDraft[],
): Promise<{ written: number; error: string | null }> {
  if (drafts.length === 0) return { written: 0, error: null };

  const rows: ObservationInsert[] = drafts.map((draft) => ({
    user_id: userId,
    source_id: sourceId,
    provider: draft.provider,
    source_device: draft.sourceDevice ?? null,
    original_record_id: draft.originalRecordId ?? null,
    dedupe_key: draft.dedupeKey,
    category: draft.category,
    measurement_type: draft.measurementType,
    value_numeric: typeof draft.value === "number" ? draft.value : null,
    value_text: typeof draft.value === "number" ? null : String(draft.value),
    unit: draft.unit ?? null,
    observed_at: draft.observedAt,
    imported_at: draft.importedAt,
    permission_scope: draft.permissionScope,
    metadata: draft.metadata as ObservationInsert["metadata"],
  }));

  // Chunked so one long first sync cannot outgrow a single statement.
  const CHUNK = 200;
  let written = 0;
  for (let index = 0; index < rows.length; index += CHUNK) {
    const chunk = rows.slice(index, index + CHUNK);
    const { error } = await admin
      .from("connected_health_observations")
      .upsert(chunk, { onConflict: "user_id,provider,dedupe_key" });
    if (error) return { written, error: error.message };
    written += chunk.length;
  }

  return { written, error: null };
}

export async function markSynced(
  admin: Admin,
  sourceId: string,
  syncedAt: string,
  cursor: string | null,
): Promise<void> {
  await admin
    .from("connected_health_sources")
    .update({
      status: "connected",
      last_successful_sync_at: syncedAt,
      last_cursor: cursor,
      last_sync_error: null,
    })
    .eq("id", sourceId);
}

export async function markSyncFailed(admin: Admin, sourceId: string, reason: string): Promise<void> {
  await admin.from("connected_health_sources").update({ last_sync_error: reason }).eq("id", sourceId);
}

/** Remove the connection and its credentials. Observations already gathered are kept. */
export async function deleteConnection(admin: Admin, sourceId: string): Promise<void> {
  // Credentials cascade from the source row.
  await admin.from("connected_health_sources").delete().eq("id", sourceId);
}
