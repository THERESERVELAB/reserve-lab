/* ════════════════════════════════════════════════════════════════════════
   CAPABILITIES — what an account may use beyond the member feature set.

   Access is a role plus an explicit list of capabilities, decided on the
   server (see access.server.ts). Features ask can(access, capability) —
   never "is this the owner?". No capability may disable, bypass or silence
   a safety system: Owner Mode adds information, never fewer warnings.
   ════════════════════════════════════════════════════════════════════════ */

export const ROLES = ["member", "owner"] as const;
export type Role = (typeof ROLES)[number];

export const CAPABILITIES = [
  /** See Cycle & Safety, the Bloodwork safety panel and "What this measures" while the launch switch hides them for members. */
  "review-pending-safety-tools",
  "advanced-cycle-tracking",
  "custom-cycle-entry",
  "owner-research-tools",
  "raw-lab-analytics",
  "advanced-support-plan",
  "experimental-features",
] as const;
export type Capability = (typeof CAPABILITIES)[number];

export const ROLE_CAPABILITIES: Record<Role, readonly Capability[]> = {
  member: [],
  owner: CAPABILITIES,
};

/** allowlist — verified user on RESERVE_OWNER_USER_IDS · dev-owner — local development flag · default — member */
export type AccessSource = "allowlist" | "dev-owner" | "default";

export type AccessContext = { role: Role; capabilities: readonly Capability[]; source: AccessSource };

export const MEMBER_ACCESS: AccessContext = Object.freeze({ role: "member", capabilities: ROLE_CAPABILITIES.member, source: "default" });

export function accessForRole(role: Role, source: AccessSource): AccessContext {
  return role === "member" ? MEMBER_ACCESS : { role, capabilities: ROLE_CAPABILITIES[role], source };
}

export function can(access: AccessContext | null | undefined, capability: Capability): boolean {
  return Boolean(access?.capabilities.includes(capability));
}

/**
 * Reads the capabilities route's answer. Capabilities are derived from the
 * role — a capabilities array in the payload is never trusted — and anything
 * malformed is member access.
 */
export function parseAccessResponse(value: unknown): AccessContext {
  if (!value || typeof value !== "object") return MEMBER_ACCESS;
  const { role, source } = value as { role?: unknown; source?: unknown };
  if (role !== "owner") return MEMBER_ACCESS;
  if (source !== "allowlist" && source !== "dev-owner") return MEMBER_ACCESS;
  return accessForRole("owner", source);
}
