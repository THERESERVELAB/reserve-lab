/* ════════════════════════════════════════════════════════════════════════
   FACILITY / AMENITY LAYER — Reserve Athlete environment intelligence.

   gym-environment.ts models LIFTING EQUIPMENT. Reserve Athlete also needs
   athletic surfaces and a recovery suite — a running track is not "equipment".
   This is a parallel, additive layer: it reads the existing GymEnvironment but
   does NOT modify gym-environment.ts or the shared UserTrainingProfile. For
   step one it lives inside Reserve Athlete onboarding so existing protocols are
   undisturbed (product decision 2026-06-29); it can fold into the shared
   profile later.

   Pure data + deterministic helpers. Behavioral/logistics only — no medical
   claims, no compound/supplement guidance.
   ════════════════════════════════════════════════════════════════════════ */

import type { GymEnvironment } from "@/lib/training/gym-environment";

export type FacilityAmenity =
  // athletic surfaces + engines
  | "running-track" | "indoor-track" | "turf" | "pool" | "olympic-platform"
  | "sled-track" | "row-erg" | "ski-erg" | "assault-bike"
  // courts / sport
  | "basketball-court" | "tennis-court" | "pickleball-court"
  // recovery suite
  | "sauna" | "steam-room" | "cold-plunge" | "hot-tub" | "compression-boots"
  // studios
  | "stretch-studio" | "group-fitness" | "yoga-studio" | "pilates-studio";

export type AmenityGroup = "athletic-surface" | "court" | "recovery-suite" | "studio";

export const AMENITY_GROUP: Record<FacilityAmenity, AmenityGroup> = {
  "running-track": "athletic-surface", "indoor-track": "athletic-surface", turf: "athletic-surface",
  pool: "athletic-surface", "olympic-platform": "athletic-surface", "sled-track": "athletic-surface",
  "row-erg": "athletic-surface", "ski-erg": "athletic-surface", "assault-bike": "athletic-surface",
  "basketball-court": "court", "tennis-court": "court", "pickleball-court": "court",
  sauna: "recovery-suite", "steam-room": "recovery-suite", "cold-plunge": "recovery-suite",
  "hot-tub": "recovery-suite", "compression-boots": "recovery-suite",
  "stretch-studio": "studio", "group-fitness": "studio", "yoga-studio": "studio", "pilates-studio": "studio",
};

export const AMENITY_GROUP_LABEL: Record<AmenityGroup, string> = {
  "athletic-surface": "Athletic Surfaces & Engines",
  court: "Courts",
  "recovery-suite": "Recovery Suite",
  studio: "Studios",
};

export const FACILITY_AMENITY_LABEL: Record<FacilityAmenity, string> = {
  "running-track": "Running Track", "indoor-track": "Indoor Track", turf: "Turf", pool: "Pool",
  "olympic-platform": "Olympic Platform", "sled-track": "Sled Track", "row-erg": "Row Erg",
  "ski-erg": "Ski Erg", "assault-bike": "Assault Bike",
  "basketball-court": "Basketball Court", "tennis-court": "Tennis Court", "pickleball-court": "Pickleball Court",
  sauna: "Sauna", "steam-room": "Steam Room", "cold-plunge": "Cold Plunge", "hot-tub": "Hot Tub",
  "compression-boots": "Compression Boots",
  "stretch-studio": "Stretch Studio", "group-fitness": "Group Fitness", "yoga-studio": "Yoga Studio",
  "pilates-studio": "Pilates Studio",
};

/** Default amenities implied by an environment. Members refine in onboarding. */
export const ENV_AMENITIES: Record<GymEnvironment, FacilityAmenity[]> = {
  "minimal-travel": [],
  "dumbbell-home": [],
  "home-gym": [],
  "garage-gym": ["sled-track", "assault-bike"],
  "hotel-gym": ["sauna", "steam-room", "hot-tub", "assault-bike"],
  "commercial-standard": ["assault-bike", "sauna", "group-fitness"],
  "commercial-performance": ["turf", "sled-track", "row-erg", "ski-erg", "assault-bike", "sauna", "stretch-studio", "group-fitness", "yoga-studio"],
  "luxury-premium": [
    "indoor-track", "turf", "pool", "olympic-platform", "sled-track", "row-erg", "ski-erg", "assault-bike",
    "basketball-court", "tennis-court", "pickleball-court",
    "sauna", "steam-room", "cold-plunge", "hot-tub", "compression-boots",
    "stretch-studio", "group-fitness", "yoga-studio", "pilates-studio",
  ],
};

export const ALL_FACILITY_AMENITIES: FacilityAmenity[] = Object.keys(FACILITY_AMENITY_LABEL) as FacilityAmenity[];

/** Default amenity set for an environment (the member can add/remove). */
export function amenitiesForEnvironment(env: GymEnvironment): FacilityAmenity[] {
  return ENV_AMENITIES[env];
}

export function hasAmenity(amenities: FacilityAmenity[], amenity: FacilityAmenity): boolean {
  return amenities.includes(amenity);
}

/** Group an amenity list for grouped UI rendering. */
export function amenitiesByGroup(amenities: FacilityAmenity[]): Record<AmenityGroup, FacilityAmenity[]> {
  const out: Record<AmenityGroup, FacilityAmenity[]> = {
    "athletic-surface": [], court: [], "recovery-suite": [], studio: [],
  };
  for (const a of amenities) out[AMENITY_GROUP[a]].push(a);
  return out;
}

/** True if the member can run purposeful sprint/tempo work (track or open surface). */
export function hasRunningSurface(amenities: FacilityAmenity[]): boolean {
  return amenities.some((a) => a === "running-track" || a === "indoor-track" || a === "turf");
}

/** Recovery-suite amenities available for load-adaptive recovery prescriptions. */
export function recoveryAmenities(amenities: FacilityAmenity[]): FacilityAmenity[] {
  return amenities.filter((a) => AMENITY_GROUP[a] === "recovery-suite");
}
