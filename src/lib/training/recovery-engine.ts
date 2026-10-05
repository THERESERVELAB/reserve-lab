/* ════════════════════════════════════════════════════════════════════════
   RESERVE ATHLETE RECOVERY ENGINE — load-adaptive recovery prescriptions.

   Recovery is a scheduled training component. The prescription is a function of
   the PRIOR session's load type — heavy-lower recovery differs from sprint
   recovery, which differs from upper or conditioning recovery. Modalities are
   gated by the member's available facility amenities so nothing is ever
   surfaced that they can't actually do (no fake CTAs).

   Pure + deterministic. Observational framing only — "supports recovery",
   "trend observation". No medical claims, no dosing, no prescriptions of
   medication/compounds. Stop-with-pain language stays at the view layer.
   ════════════════════════════════════════════════════════════════════════ */

import type { FacilityAmenity } from "@/lib/training/facilities";

/** The kind of load the previous session imposed — drives the recovery emphasis. */
export type SessionLoadType =
  | "heavy-lower" | "heavy-upper" | "hypertrophy" | "sprint-power" | "conditioning" | "rest";

export type RecoveryModality =
  | "sauna" | "steam" | "cold-plunge" | "compression-boots"
  | "mobility" | "stretch" | "breathwork" | "walk"
  | "sleep" | "hydration-electrolytes";

export const RECOVERY_MODALITY_LABEL: Record<RecoveryModality, string> = {
  sauna: "Sauna", steam: "Steam", "cold-plunge": "Cold Plunge", "compression-boots": "Compression Boots",
  mobility: "Mobility", stretch: "Stretch", breathwork: "Breathwork", walk: "Walk",
  sleep: "Sleep", "hydration-electrolytes": "Hydration + Electrolytes",
};

/** Modalities that require a facility amenity. Unlisted modalities are always available. */
const MODALITY_REQUIRES: Partial<Record<RecoveryModality, FacilityAmenity>> = {
  sauna: "sauna",
  steam: "steam-room",
  "cold-plunge": "cold-plunge",
  "compression-boots": "compression-boots",
};

export type RecoveryPrescription = {
  loadType: SessionLoadType;
  /** Modalities the member can actually do, in priority order. */
  modalities: RecoveryModality[];
  /** What this recovery emphasis is protecting. */
  emphasis: string;
  /** Observational framing — never a medical claim or dose. */
  note: string;
};

type LoadProfile = { desired: RecoveryModality[]; emphasis: string };

const LOAD_PROFILES: Record<SessionLoadType, LoadProfile> = {
  "heavy-lower": {
    desired: ["mobility", "compression-boots", "cold-plunge", "walk", "hydration-electrolytes", "sleep"],
    emphasis: "Posterior-chain decompression and circulation after heavy lower output.",
  },
  "heavy-upper": {
    desired: ["mobility", "sauna", "stretch", "breathwork", "sleep"],
    emphasis: "Shoulders and t-spine recovery to keep pressing quality high.",
  },
  hypertrophy: {
    desired: ["mobility", "sauna", "walk", "hydration-electrolytes", "sleep"],
    emphasis: "General tissue recovery to support the next quality pump session.",
  },
  "sprint-power": {
    desired: ["mobility", "cold-plunge", "compression-boots", "breathwork", "sleep"],
    emphasis: "CNS down-regulation and tissue recovery after explosive work.",
  },
  conditioning: {
    desired: ["walk", "mobility", "sauna", "hydration-electrolytes", "sleep"],
    emphasis: "Aerobic flush and hydration to clear conditioning fatigue.",
  },
  rest: {
    desired: ["walk", "stretch", "breathwork", "sleep", "hydration-electrolytes"],
    emphasis: "Full restoration — parasympathetic down-shift and sleep priority.",
  },
};

function isAvailable(modality: RecoveryModality, amenities: FacilityAmenity[]): boolean {
  const required = MODALITY_REQUIRES[modality];
  return required ? amenities.includes(required) : true;
}

/**
 * Build a load-adaptive recovery prescription. Modalities requiring a facility
 * the member doesn't have are dropped, so the member only ever sees recovery
 * work they can actually do.
 */
export function buildRecoveryPrescription(
  loadType: SessionLoadType,
  availableAmenities: FacilityAmenity[] = [],
): RecoveryPrescription {
  const profile = LOAD_PROFILES[loadType];
  const modalities = profile.desired.filter((m) => isAvailable(m, availableAmenities));
  return {
    loadType,
    modalities,
    emphasis: profile.emphasis,
    note: "Recovery support and trend observation only — not medical advice. Review persistent issues with a clinician.",
  };
}
