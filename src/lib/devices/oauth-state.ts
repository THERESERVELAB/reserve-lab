import "server-only";

/* ════════════════════════════════════════════════════════════════════════
   OAUTH STATE — who started this authorization, proved on the way back.

   The WHOOP callback arrives as a plain browser redirect. It carries no
   Supabase session, so the only thing tying the returning `code` to a member
   is the `state` Reserve sent out with it. If that value could be forged, one
   member's WHOOP account could be attached to another member's record.

   So state is a signed claim, not a random string: the member id and a nonce,
   with an HMAC over both, and an expiry. Verification is constant-time and
   the claim is short-lived. Nothing is stored server-side — there is no row
   to leak and no row to clean up.

   Single use is enforced downstream: the callback writes the connection, and
   a replayed state lands on an authorization code WHOOP has already spent.
   ════════════════════════════════════════════════════════════════════════ */

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const STATE_TTL_SECONDS = 600;

type StateClaim = {
  /** Supabase user id that began the flow. */
  uid: string;
  /** Random, so two authorizations by the same member never produce one string. */
  n: string;
  /** Unix seconds after which this claim is refused. */
  exp: number;
  /** Where to send the member once the connection is made. */
  r?: string;
};

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createOAuthState(params: {
  userId: string;
  secret: string;
  returnTo?: string;
  now?: Date;
  ttlSeconds?: number;
}): string {
  const now = params.now ?? new Date();
  const claim: StateClaim = {
    uid: params.userId,
    n: randomBytes(9).toString("base64url"),
    exp: Math.floor(now.getTime() / 1000) + (params.ttlSeconds ?? STATE_TTL_SECONDS),
    ...(params.returnTo ? { r: params.returnTo } : {}),
  };
  const payload = b64url(JSON.stringify(claim));
  return `${payload}.${sign(payload, params.secret)}`;
}

export type StateVerification =
  | { ok: true; userId: string; returnTo?: string }
  | { ok: false; reason: "malformed" | "bad-signature" | "expired" };

export function verifyOAuthState(state: string, secret: string, now = new Date()): StateVerification {
  const parts = state.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return { ok: false, reason: "malformed" };

  const expected = sign(parts[0], secret);
  const given = Buffer.from(parts[1], "utf8");
  const wanted = Buffer.from(expected, "utf8");
  if (given.length !== wanted.length || !timingSafeEqual(given, wanted)) {
    return { ok: false, reason: "bad-signature" };
  }

  let claim: StateClaim;
  try {
    claim = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8")) as StateClaim;
  } catch {
    return { ok: false, reason: "malformed" };
  }

  if (typeof claim.uid !== "string" || !claim.uid || typeof claim.exp !== "number") {
    return { ok: false, reason: "malformed" };
  }
  if (claim.exp * 1000 <= now.getTime()) return { ok: false, reason: "expired" };

  return { ok: true, userId: claim.uid, returnTo: claim.r };
}
