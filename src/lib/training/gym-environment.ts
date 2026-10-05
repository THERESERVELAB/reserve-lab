/* ════════════════════════════════════════════════════════════════════════
   GYM ENVIRONMENT + EQUIPMENT MATRIX — User Intelligence (training slice)

   Defines where the member trains and what equipment they can reach, so the
   movement-prescription engine recommends what's actually available — a
   dumbbell-home user never gets a pendulum-squat prescription, and a luxury
   gym user gets premium plate-loaded options.

   Pure data + deterministic helpers. Behavioral/logistics only — no medical
   claims, no compound/supplement guidance.
   ════════════════════════════════════════════════════════════════════════ */

export type GymEnvironment =
  | "home-gym"
  | "dumbbell-home"
  | "garage-gym"
  | "commercial-standard"
  | "commercial-performance"
  | "luxury-premium"
  | "hotel-gym"
  | "minimal-travel";

export const GYM_ENVIRONMENT_LABEL: Record<GymEnvironment, string> = {
  "home-gym": "Home Gym",
  "dumbbell-home": "Dumbbell-Only Home",
  "garage-gym": "Garage Gym",
  "commercial-standard": "Standard Commercial Gym",
  "commercial-performance": "High-Performance Gym",
  "luxury-premium": "Luxury / Premium Gym",
  "hotel-gym": "Hotel Gym",
  "minimal-travel": "Minimal / Travel",
};

export const GYM_ENVIRONMENT_DESC: Record<GymEnvironment, string> = {
  "home-gym": "Mixed home setup — dumbbells, a bench, maybe a barbell and bands.",
  "dumbbell-home": "Dumbbells and bodyweight only.",
  "garage-gym": "Barbell, rack, bench, plates, and dumbbells.",
  "commercial-standard": "Dumbbells, barbells, cables, and the common machines.",
  "commercial-performance": "Full machine selection plus plate-loaded and specialty equipment.",
  "luxury-premium": "Premium plate-loaded and specialty machines with multiple adjustable paths.",
  "hotel-gym": "Dumbbells, a bench, a cable stack if you're lucky, and cardio.",
  "minimal-travel": "Bodyweight, bands, and walking.",
};

/* ─── Equipment matrix ────────────────────────────────────────────────── */
export type EquipmentCategory =
  | "dumbbells" | "barbell" | "bench" | "smith" | "cables" | "bands" | "pullup-bar"
  | "machines" | "plate-loaded" | "selectorized"
  | "leg-press" | "hack-squat" | "pendulum-squat" | "belt-squat" | "hip-thrust-machine"
  | "leg-curl" | "leg-extension" | "calf-machine"
  | "chest-press" | "incline-press" | "shoulder-press" | "row-machine" | "pulldown"
  | "pec-deck" | "rear-delt-machine" | "lateral-raise-machine" | "glute-machine"
  | "treadmill" | "stairmaster" | "bike" | "sled" | "kettlebells";

export const EQUIPMENT_LABEL: Record<EquipmentCategory, string> = {
  dumbbells: "Dumbbells", barbell: "Barbell", bench: "Bench", smith: "Smith Machine",
  cables: "Cables", bands: "Bands", "pullup-bar": "Pull-Up Bar", machines: "Machines",
  "plate-loaded": "Plate-Loaded", selectorized: "Selectorized", "leg-press": "Leg Press",
  "hack-squat": "Hack Squat", "pendulum-squat": "Pendulum Squat", "belt-squat": "Belt Squat",
  "hip-thrust-machine": "Hip Thrust Machine", "leg-curl": "Leg Curl", "leg-extension": "Leg Extension",
  "calf-machine": "Calf Raise", "chest-press": "Chest Press", "incline-press": "Incline Press",
  "shoulder-press": "Shoulder Press", "row-machine": "Row Machine", pulldown: "Pulldown",
  "pec-deck": "Pec Deck", "rear-delt-machine": "Rear Delt Machine", "lateral-raise-machine": "Lateral Raise Machine",
  "glute-machine": "Glute Machine", treadmill: "Treadmill", stairmaster: "Stairmaster",
  bike: "Bike", sled: "Sled", kettlebells: "Kettlebells",
};

/** Bodyweight is always available; not in the matrix. */
const FREE_WEIGHT: EquipmentCategory[] = ["dumbbells", "bench", "bands", "pullup-bar"];
const BARBELL_SET: EquipmentCategory[] = ["barbell", "smith"];
const BASIC_MACHINES: EquipmentCategory[] = ["cables", "machines", "selectorized", "leg-press", "leg-curl", "leg-extension", "calf-machine", "chest-press", "incline-press", "shoulder-press", "row-machine", "pulldown", "pec-deck"];
const SPECIALTY_MACHINES: EquipmentCategory[] = ["plate-loaded", "hack-squat", "pendulum-squat", "belt-squat", "hip-thrust-machine", "rear-delt-machine", "lateral-raise-machine", "glute-machine"];
const CONDITIONING: EquipmentCategory[] = ["treadmill", "stairmaster", "bike"];

export const ENV_EQUIPMENT: Record<GymEnvironment, EquipmentCategory[]> = {
  "dumbbell-home": ["dumbbells", "bench", "bands"],
  "home-gym": [...FREE_WEIGHT, "barbell", "kettlebells", "cables"],
  "garage-gym": [...FREE_WEIGHT, "barbell", "smith", "leg-press", "kettlebells", "cables"],
  "commercial-standard": [...FREE_WEIGHT, ...BARBELL_SET, ...BASIC_MACHINES, ...CONDITIONING, "calf-machine"],
  "commercial-performance": [...FREE_WEIGHT, ...BARBELL_SET, ...BASIC_MACHINES, ...SPECIALTY_MACHINES, ...CONDITIONING, "sled"],
  "luxury-premium": [...FREE_WEIGHT, ...BARBELL_SET, ...BASIC_MACHINES, ...SPECIALTY_MACHINES, ...CONDITIONING, "sled"],
  "hotel-gym": ["dumbbells", "bench", "cables", "treadmill", "bike"],
  "minimal-travel": ["bands"],
};

/** Environments that imply access to premium plate-loaded brands. */
export const PREMIUM_ENVIRONMENTS: GymEnvironment[] = ["luxury-premium"];

export type PremiumBrand = "prime" | "atlantis" | "panatta" | "arsenal" | "hammer-strength" | "nautilus" | "life-fitness" | "technogym" | "cybex";

export const PREMIUM_BRAND_LABEL: Record<PremiumBrand, string> = {
  prime: "Adjustable Plate-Loaded", atlantis: "Specialty Selectorized", panatta: "Pendulum / Lever Line", arsenal: "Heavy Plate-Loaded",
  "hammer-strength": "Converging Plate-Loaded", nautilus: "Classic Selectorized", "life-fitness": "Commercial Selectorized",
  technogym: "Connected Selectorized", cybex: "Strength Circuit",
};

export const ALL_PREMIUM_BRANDS: PremiumBrand[] = ["prime", "atlantis", "panatta", "arsenal", "hammer-strength", "nautilus", "life-fitness", "technogym", "cybex"];

/* ─── User training profile (the gym/equipment slice) ─────────────────── */
export type TrainingLevel = "beginner" | "intermediate" | "advanced";
export type EquipmentStyle = "machines" | "free-weights" | "cables" | "mixed";
export type StructurePreference = "high-structure" | "flexible";

export type UserTrainingProfile = {
  gymEnvironment: GymEnvironment;
  /** Available equipment categories. Defaults to the environment preset; user can refine. */
  equipment: EquipmentCategory[];
  premiumBrands: PremiumBrand[];
  trainingLevel: TrainingLevel;
  sessionDurationMin: number;
  preferredStyle: EquipmentStyle;
  structurePreference: StructurePreference;
  dislikedMovements: string[];
  /** Free-tag joint/movement limitations, e.g. "lower-back", "knees". */
  movementLimitations: string[];
  /** True once the member has explicitly set up their training profile. */
  configured: boolean;
};

export const DEFAULT_USER_TRAINING_PROFILE: UserTrainingProfile = {
  gymEnvironment: "luxury-premium",
  equipment: ENV_EQUIPMENT["luxury-premium"],
  premiumBrands: ["prime", "hammer-strength", "atlantis"],
  trainingLevel: "advanced",
  sessionDurationMin: 90,
  preferredStyle: "mixed",
  structurePreference: "flexible",
  dislikedMovements: [],
  movementLimitations: [],
  configured: false,
};

/** Equipment the environment provides by default (used when the member hasn't refined it). */
export function equipmentForEnvironment(env: GymEnvironment): EquipmentCategory[] {
  return ENV_EQUIPMENT[env];
}

export function hasEquipment(profile: UserTrainingProfile, category: EquipmentCategory): boolean {
  return profile.equipment.includes(category);
}

export function isPremiumGym(profile: UserTrainingProfile): boolean {
  return PREMIUM_ENVIRONMENTS.includes(profile.gymEnvironment) || profile.premiumBrands.length > 0;
}

export function isHomeOrMinimal(profile: UserTrainingProfile): boolean {
  return ["dumbbell-home", "home-gym", "minimal-travel", "hotel-gym", "garage-gym"].includes(profile.gymEnvironment);
}

/* ─── Profile completeness ────────────────────────────────────────────── */
export type ProfileCompleteness = {
  percent: number;
  missing: string[];
  confidence: "high" | "moderate" | "limited";
};

/**
 * Completeness of the training-relevant intelligence profile. Combines the gym
 * slice (this file) with cross-store signals passed in by the caller.
 */
export function computeProfileCompleteness(input: {
  profile: UserTrainingProfile;
  hasGoal: boolean;
  hasWeakPoints: boolean;
  hasSchedule: boolean;
}): ProfileCompleteness {
  const { profile, hasGoal, hasWeakPoints, hasSchedule } = input;
  const checks: Array<{ ok: boolean; label: string }> = [
    { ok: profile.configured, label: "Gym environment" },
    { ok: profile.equipment.length > 0, label: "Equipment access" },
    { ok: hasGoal, label: "Training goal" },
    { ok: hasWeakPoints, label: "Weak point focus" },
    { ok: hasSchedule, label: "Training schedule" },
    { ok: profile.movementLimitations.length >= 0 && profile.configured, label: "Movement limitations" },
    { ok: profile.sessionDurationMin > 0, label: "Session duration" },
  ];
  const done = checks.filter((c) => c.ok).length;
  const percent = Math.round((done / checks.length) * 100);
  const missing = checks.filter((c) => !c.ok).map((c) => c.label);
  const confidence: ProfileCompleteness["confidence"] = percent >= 85 ? "high" : percent >= 55 ? "moderate" : "limited";
  return { percent, missing, confidence };
}
