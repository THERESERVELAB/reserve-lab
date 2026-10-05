/* ════════════════════════════════════════════════════════════════════════
   RESERVE ENTITLEMENTS — coaching-tier access, centralized.

   UI components never compare tier strings; they ask these functions.
   The coaching tier is carried on the coaching-domain member record and
   maps onto the existing public two-tier pricing (Signature / Black) —
   Coach Command is an eligibility of Reserve Black accounts.
   ════════════════════════════════════════════════════════════════════════ */

import type { ReserveMember, ReserveTier } from "./types";

export const TIER_LABELS: Record<ReserveTier, string> = {
  core: "Reserve",
  premium_personal: "Premium Personal",
  premium_coach: "Premium Coach",
};

export function canAccessCoachCommand(member: ReserveMember | null | undefined): boolean {
  return member?.tier === "premium_coach";
}

export function hasPremiumPersonal(member: ReserveMember | null | undefined): boolean {
  return member?.tier === "premium_personal" || member?.tier === "premium_coach";
}

/** Rank helper for future gating decisions. */
export function tierRank(tier: ReserveTier): number {
  return tier === "premium_coach" ? 2 : tier === "premium_personal" ? 1 : 0;
}
