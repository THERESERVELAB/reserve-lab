import { MEMBER_ACCESS, accessForRole, type AccessContext } from "./capabilities";

/* Decides access from facts the server already verified. Pure: no request,
   no environment reads — access.server.ts supplies the inputs. */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Supabase user ids only. Emails, blanks and anything else are dropped. */
export function parseOwnerAllowlist(raw: string | null | undefined): Set<string> {
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter((entry) => UUID.test(entry)),
  );
}

export type AccessInputs = {
  /** From a verified Supabase access token — never from the request body. */
  verifiedUserId: string | null;
  ownerAllowlist: string | undefined;
  devOwnerFlag: string | undefined;
  nodeEnv: string | undefined;
  supabaseConfigured: boolean;
};

export function resolveAccess(inputs: AccessInputs): AccessContext {
  if (inputs.verifiedUserId && parseOwnerAllowlist(inputs.ownerAllowlist).has(inputs.verifiedUserId.toLowerCase())) {
    return accessForRole("owner", "allowlist");
  }
  // Local development only: never in a production build, never with real sign-in configured.
  if (inputs.devOwnerFlag === "true" && inputs.nodeEnv !== "production" && !inputs.supabaseConfigured) {
    return accessForRole("owner", "dev-owner");
  }
  return MEMBER_ACCESS;
}
