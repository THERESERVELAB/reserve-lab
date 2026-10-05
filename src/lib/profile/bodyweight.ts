"use client";

const MIN_BODYWEIGHT_LB = 70;
const MAX_BODYWEIGHT_LB = 700;

export function sanitizeBodyweightLb(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;

  const raw = String(value).trim().toLowerCase();
  if (!raw || raw.includes("%")) return null;

  const match = raw.match(/\d+(?:\.\d+)?/);
  if (!match) return null;

  const parsed = Number(match[0]);
  if (!Number.isFinite(parsed)) return null;
  if (parsed < MIN_BODYWEIGHT_LB || parsed > MAX_BODYWEIGHT_LB) return null;

  return Math.round(parsed * 10) / 10;
}

export type MemberBodyweight = {
  lb: number;
  /** weigh-in: latest logged physique entry · baseline: onboarding baseline · profile: Operating System Setup. */
  source: "weigh-in" | "baseline" | "profile";
};

/**
 * The member's real bodyweight, or null. Never a default: the most recent
 * logged weigh-in wins, then the onboarding baseline, then the weight entered
 * in Operating System Setup. Values outside a plausible range are ignored.
 */
export function resolveMemberBodyweight(input: {
  weighIns?: ReadonlyArray<{ date: string; bodyWeightLb: number }> | null;
  baselineWeightLb?: number | null;
  profileBodyweightLb?: number | null;
}): MemberBodyweight | null {
  const latest = [...(input.weighIns ?? [])]
    .filter((entry) => sanitizeBodyweightLb(entry.bodyWeightLb) !== null)
    .sort((a, b) => a.date.localeCompare(b.date))
    .at(-1);
  if (latest) return { lb: sanitizeBodyweightLb(latest.bodyWeightLb)!, source: "weigh-in" };
  const baseline = sanitizeBodyweightLb(input.baselineWeightLb);
  if (baseline !== null) return { lb: baseline, source: "baseline" };
  const profile = sanitizeBodyweightLb(input.profileBodyweightLb);
  if (profile !== null) return { lb: profile, source: "profile" };
  return null;
}

/** DEFAULT_NUTRITION_PREFS.bodyweightLb once shipped 190 lb for every member. */
export const LEGACY_DEFAULT_BODYWEIGHT_LB = 190;

/**
 * Clears the shipped 190 lb from saved nutrition prefs, ONLY when the member
 * never saved the Operating System Setup profile step — the one place a member
 * enters it. A 190 the member saved there is kept. Pure and idempotent.
 */
export function clearUntouchedDefaultBodyweight<T extends { bodyweightLb?: number | null }>(
  prefs: T,
  completedSetupSteps: readonly string[] | null | undefined,
): T {
  if (prefs.bodyweightLb !== LEGACY_DEFAULT_BODYWEIGHT_LB) return prefs;
  if ((completedSetupSteps ?? []).includes("profile")) return prefs;
  return { ...prefs, bodyweightLb: 0 };
}

export function appendBodyweightParam(params: URLSearchParams, value: unknown) {
  const bodyweight = sanitizeBodyweightLb(value);
  if (bodyweight !== null) {
    params.set("bodyweight", String(bodyweight));
  }
}
