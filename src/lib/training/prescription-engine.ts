/* ════════════════════════════════════════════════════════════════════════
   MOVEMENT LIBRARY + PRESCRIPTION ENGINE

   Given a movement pattern / target tissue and the member's training profile
   (gym environment, equipment, level, recovery, weak points), prescribes the
   best AVAILABLE movement plus gym-aware alternatives (premium upgrade, home
   option, recovery-friendly). A dumbbell-home user never gets a pendulum
   squat; a luxury-gym user gets premium plate-loaded options.

   Coaching/organization support only. No medical claims, no rehab
   prescription, no compound/supplement guidance.
   ════════════════════════════════════════════════════════════════════════ */

import type { MovementPattern } from "./plateau-engine";
import {
  isPremiumGym, type EquipmentCategory, type PremiumBrand, type TrainingLevel, type UserTrainingProfile,
} from "./gym-environment";
import type { GoalKey } from "@/lib/nutrition/types";

export type JointStress = "low" | "moderate" | "high";

export type MovementLibraryEntry = {
  id: string;
  name: string;
  pattern: MovementPattern;
  target: string;
  equipment: EquipmentCategory;
  premiumBrand?: PremiumBrand;
  /** Always available regardless of equipment (push-ups, planks, walks). */
  bodyweight?: boolean;
  /** Reachable in a dumbbell-only home (dumbbells / bands / bench / bodyweight). */
  home?: boolean;
  difficulty: TrainingLevel;
  jointStress: JointStress;
  cue: string;
};

/* ─── Foundation library (major patterns) ─────────────────────────────── */
export const MOVEMENT_LIBRARY: MovementLibraryEntry[] = [
  /* Chest — Incline */
  { id: "prime-incline", name: "Adjustable Plate-Loaded Incline Press", pattern: "Incline Press", target: "Upper Chest", equipment: "plate-loaded", premiumBrand: "prime", difficulty: "intermediate", jointStress: "low", cue: "Drive elbows under the bar path, no shoulder shrug." },
  { id: "hammer-incline", name: "Converging Plate-Loaded Incline Press", pattern: "Incline Press", target: "Upper Chest", equipment: "plate-loaded", premiumBrand: "hammer-strength", difficulty: "intermediate", jointStress: "low", cue: "Stable converging press — squeeze at lockout." },
  { id: "machine-incline", name: "Machine Incline Press", pattern: "Incline Press", target: "Upper Chest", equipment: "incline-press", difficulty: "beginner", jointStress: "low", cue: "Set the seat so the handles meet the upper chest." },
  { id: "smith-incline", name: "Smith Incline Press", pattern: "Incline Press", target: "Upper Chest", equipment: "smith", difficulty: "intermediate", jointStress: "moderate", cue: "Fixed bar path — control the eccentric." },
  { id: "incline-bb", name: "Incline Barbell Press", pattern: "Incline Press", target: "Upper Chest", equipment: "barbell", difficulty: "advanced", jointStress: "high", cue: "Low incline, tuck elbows ~45°." },
  { id: "incline-db", name: "Incline Dumbbell Press", pattern: "Incline Press", target: "Upper Chest", equipment: "dumbbells", home: true, difficulty: "intermediate", jointStress: "moderate", cue: "Deep stretch, control the bottom." },
  { id: "low-cable-press", name: "Low Cable Press", pattern: "Incline Press", target: "Upper Chest", equipment: "cables", difficulty: "beginner", jointStress: "low", cue: "Press low-to-high, meet at the top." },
  { id: "feet-elevated-pushup", name: "Feet-Elevated Push-Up", pattern: "Incline Press", target: "Upper Chest", equipment: "bench", bodyweight: true, home: true, difficulty: "beginner", jointStress: "low", cue: "Full range, ribs down." },
  { id: "band-low-high", name: "Band Low-to-High Press", pattern: "Incline Press", target: "Upper Chest", equipment: "bands", home: true, difficulty: "beginner", jointStress: "low", cue: "Constant tension to the top." },

  /* Chest — Horizontal */
  { id: "machine-chest-press", name: "Machine Chest Press", pattern: "Horizontal Press", target: "Chest", equipment: "chest-press", difficulty: "beginner", jointStress: "low", cue: "Handles at nipple line, squeeze across." },
  { id: "flat-db", name: "Flat Dumbbell Press", pattern: "Horizontal Press", target: "Chest", equipment: "dumbbells", home: true, difficulty: "intermediate", jointStress: "moderate", cue: "Controlled stretch, no bounce." },
  { id: "pec-deck", name: "Pec Deck", pattern: "Horizontal Press", target: "Chest", equipment: "pec-deck", difficulty: "beginner", jointStress: "low", cue: "Elbows slightly soft, squeeze the midline." },
  { id: "cable-fly", name: "Low-to-High Cable Fly", pattern: "Horizontal Press", target: "Chest", equipment: "cables", difficulty: "beginner", jointStress: "low", cue: "Hug the midline, long arc." },
  { id: "pushup", name: "Push-Up", pattern: "Horizontal Press", target: "Chest", equipment: "bench", bodyweight: true, home: true, difficulty: "beginner", jointStress: "low", cue: "Plank-tight, full depth." },

  /* Back — Vertical pull */
  { id: "pulldown", name: "Wide Grip Lat Pulldown", pattern: "Vertical Pull", target: "Lats", equipment: "pulldown", difficulty: "beginner", jointStress: "low", cue: "Drive elbows down and back." },
  { id: "neutral-pulldown", name: "Neutral Grip Pulldown", pattern: "Vertical Pull", target: "Lats", equipment: "pulldown", difficulty: "beginner", jointStress: "low", cue: "Lead with the elbows, no torso swing." },
  { id: "pullup", name: "Weighted Pull-Up", pattern: "Vertical Pull", target: "Lats", equipment: "pullup-bar", bodyweight: true, home: true, difficulty: "advanced", jointStress: "moderate", cue: "Full hang to chest, control down." },
  { id: "band-pulldown", name: "Band Pulldown", pattern: "Vertical Pull", target: "Lats", equipment: "bands", home: true, difficulty: "beginner", jointStress: "low", cue: "Anchor high, drive elbows to ribs." },

  /* Back — Horizontal pull */
  { id: "hammer-row", name: "Converging Plate-Loaded Row", pattern: "Horizontal Pull", target: "Mid-Back", equipment: "plate-loaded", premiumBrand: "hammer-strength", difficulty: "intermediate", jointStress: "low", cue: "Chest on pad, pull to the hips." },
  { id: "chest-supported-row", name: "Chest-Supported Row", pattern: "Horizontal Pull", target: "Mid-Back", equipment: "row-machine", difficulty: "beginner", jointStress: "low", cue: "Pause each rep, no momentum." },
  { id: "seated-cable-row", name: "Seated Cable Row", pattern: "Horizontal Pull", target: "Mid-Back", equipment: "cables", difficulty: "beginner", jointStress: "low", cue: "Tall chest, elbows past the ribs." },
  { id: "barbell-row", name: "Barbell Row", pattern: "Horizontal Pull", target: "Mid-Back", equipment: "barbell", difficulty: "advanced", jointStress: "high", cue: "Hinge ~45°, brace the low back." },
  { id: "db-row", name: "Single-Arm Dumbbell Row", pattern: "Horizontal Pull", target: "Mid-Back", equipment: "dumbbells", home: true, difficulty: "beginner", jointStress: "low", cue: "Long pull, no twisting." },

  /* Delts */
  { id: "prime-lateral", name: "Adjustable Machine Lateral Raise", pattern: "Lateral Raise", target: "Side Delts", equipment: "lateral-raise-machine", premiumBrand: "prime", difficulty: "beginner", jointStress: "low", cue: "Lead with the elbow, slow negative." },
  { id: "machine-lateral", name: "Machine Lateral Raise", pattern: "Lateral Raise", target: "Side Delts", equipment: "lateral-raise-machine", difficulty: "beginner", jointStress: "low", cue: "Pin the torso, no shrug." },
  { id: "cable-lateral", name: "Cable Lateral Raise", pattern: "Lateral Raise", target: "Side Delts", equipment: "cables", difficulty: "beginner", jointStress: "low", cue: "Constant tension, lean away slightly." },
  { id: "db-lateral", name: "Dumbbell Lateral Raise", pattern: "Lateral Raise", target: "Side Delts", equipment: "dumbbells", home: true, difficulty: "beginner", jointStress: "low", cue: "Soft elbows, pour-the-water at the top." },
  { id: "band-lateral", name: "Band Lateral Raise", pattern: "Lateral Raise", target: "Side Delts", equipment: "bands", home: true, difficulty: "beginner", jointStress: "low", cue: "Stand on the band, steady tempo." },
  { id: "rear-machine", name: "Reverse Pec Deck", pattern: "Rear Delt", target: "Rear Delts", equipment: "rear-delt-machine", difficulty: "beginner", jointStress: "low", cue: "Wide arc, squeeze the rear delts." },
  { id: "cable-rear", name: "Rear Delt Cable Fly", pattern: "Rear Delt", target: "Rear Delts", equipment: "cables", difficulty: "beginner", jointStress: "low", cue: "Cross-body to wide, no traps." },
  { id: "db-rear", name: "Bent-Over Dumbbell Reverse Fly", pattern: "Rear Delt", target: "Rear Delts", equipment: "dumbbells", home: true, difficulty: "beginner", jointStress: "low", cue: "Chest down, lift with the elbows." },
  { id: "machine-ohp", name: "Machine Shoulder Press", pattern: "Vertical Press", target: "Front Delts", equipment: "shoulder-press", difficulty: "beginner", jointStress: "low", cue: "Handles at ear height, press tall." },
  { id: "db-ohp", name: "Seated Dumbbell Shoulder Press", pattern: "Vertical Press", target: "Front Delts", equipment: "dumbbells", home: true, difficulty: "intermediate", jointStress: "moderate", cue: "Stack the elbows under the wrists." },
  { id: "smith-ohp", name: "Smith Shoulder Press", pattern: "Vertical Press", target: "Front Delts", equipment: "smith", difficulty: "intermediate", jointStress: "moderate", cue: "Bar to chin, fixed path." },

  /* Legs — Squat pattern */
  { id: "pendulum-squat", name: "Pendulum Squat", pattern: "Squat Pattern", target: "Quads", equipment: "pendulum-squat", premiumBrand: "panatta", difficulty: "intermediate", jointStress: "moderate", cue: "Knees track toes, full depth." },
  { id: "hack-squat", name: "Hack Squat", pattern: "Squat Pattern", target: "Quads", equipment: "hack-squat", difficulty: "intermediate", jointStress: "moderate", cue: "Feet low for quads, control the depth." },
  { id: "leg-press", name: "Leg Press", pattern: "Squat Pattern", target: "Quads", equipment: "leg-press", difficulty: "beginner", jointStress: "moderate", cue: "Full range, knees in line." },
  { id: "smith-squat", name: "Smith Machine Squat", pattern: "Squat Pattern", target: "Quads", equipment: "smith", difficulty: "intermediate", jointStress: "moderate", cue: "Heel-elevated for quad bias." },
  { id: "back-squat", name: "Back Squat", pattern: "Squat Pattern", target: "Quads", equipment: "barbell", difficulty: "advanced", jointStress: "high", cue: "Brace hard, depth before load." },
  { id: "goblet-squat", name: "Goblet Squat", pattern: "Squat Pattern", target: "Quads", equipment: "dumbbells", home: true, difficulty: "beginner", jointStress: "moderate", cue: "Elbows inside knees, tall chest." },
  { id: "leg-extension", name: "Leg Extension", pattern: "Squat Pattern", target: "Quads", equipment: "leg-extension", difficulty: "beginner", jointStress: "low", cue: "Pause at lockout, control down." },

  /* Legs — Hinge / posterior */
  { id: "rdl", name: "Romanian Deadlift", pattern: "Hip Hinge", target: "Hamstrings", equipment: "barbell", difficulty: "advanced", jointStress: "high", cue: "Push hips back, soft knees, neutral spine." },
  { id: "db-rdl", name: "Dumbbell Romanian Deadlift", pattern: "Hip Hinge", target: "Hamstrings", equipment: "dumbbells", home: true, difficulty: "intermediate", jointStress: "moderate", cue: "Drag the bells down the thigh." },
  { id: "back-extension", name: "Back Extension", pattern: "Hip Extension", target: "Glutes", equipment: "machines", bodyweight: true, home: true, difficulty: "beginner", jointStress: "low", cue: "Glute-bias by rounding slightly at the top." },
  { id: "cable-pullthrough", name: "Cable Pull-Through", pattern: "Hip Hinge", target: "Hamstrings", equipment: "cables", difficulty: "beginner", jointStress: "low", cue: "Hinge, snap the hips through." },
  { id: "seated-leg-curl", name: "Seated Leg Curl", pattern: "Knee Flexion", target: "Hamstrings", equipment: "leg-curl", difficulty: "beginner", jointStress: "low", cue: "Pause the squeeze, slow eccentric." },
  { id: "lying-leg-curl", name: "Lying Leg Curl", pattern: "Knee Flexion", target: "Hamstrings", equipment: "leg-curl", difficulty: "beginner", jointStress: "low", cue: "Hips down, no jerking." },
  { id: "nordic-curl", name: "Nordic Curl", pattern: "Knee Flexion", target: "Hamstrings", equipment: "bench", bodyweight: true, home: true, difficulty: "advanced", jointStress: "moderate", cue: "Resist the lower as long as possible." },
  { id: "hip-thrust", name: "Hip Thrust", pattern: "Hip Extension", target: "Glutes", equipment: "barbell", home: true, difficulty: "intermediate", jointStress: "low", cue: "Ribs down, full lockout squeeze." },
  { id: "machine-hip-thrust", name: "Machine Hip Thrust", pattern: "Hip Extension", target: "Glutes", equipment: "hip-thrust-machine", difficulty: "beginner", jointStress: "low", cue: "Drive through the heels, pause at top." },
  { id: "walking-lunge", name: "Walking Lunge", pattern: "Lunge Pattern", target: "Quads", equipment: "dumbbells", home: true, difficulty: "intermediate", jointStress: "moderate", cue: "Long step, vertical shin on the front leg." },
  { id: "split-squat", name: "Bulgarian Split Squat", pattern: "Lunge Pattern", target: "Quads", equipment: "dumbbells", home: true, difficulty: "intermediate", jointStress: "moderate", cue: "Back foot elevated, drop straight down." },

  /* Calves */
  { id: "standing-calf", name: "Standing Calf Raise", pattern: "Calf Raise", target: "Calves", equipment: "calf-machine", difficulty: "beginner", jointStress: "low", cue: "Full stretch, pause at the top." },
  { id: "leg-press-calf", name: "Leg Press Calf Raise", pattern: "Calf Raise", target: "Calves", equipment: "leg-press", difficulty: "beginner", jointStress: "low", cue: "Toes on the platform, full range." },
  { id: "db-calf", name: "Dumbbell Calf Raise", pattern: "Calf Raise", target: "Calves", equipment: "dumbbells", home: true, difficulty: "beginner", jointStress: "low", cue: "Slow, full stretch each rep." },

  /* Arms */
  { id: "cable-curl", name: "Cable Curl", pattern: "Curl", target: "Biceps", equipment: "cables", difficulty: "beginner", jointStress: "low", cue: "Pin the elbows, constant tension." },
  { id: "machine-curl", name: "Machine Preacher Curl", pattern: "Curl", target: "Biceps", equipment: "selectorized", difficulty: "beginner", jointStress: "low", cue: "Full stretch, squeeze the top." },
  { id: "db-curl", name: "Incline Dumbbell Curl", pattern: "Curl", target: "Biceps", equipment: "dumbbells", home: true, difficulty: "beginner", jointStress: "low", cue: "Elbows back, long stretch." },
  { id: "band-curl", name: "Band Curl", pattern: "Curl", target: "Biceps", equipment: "bands", home: true, difficulty: "beginner", jointStress: "low", cue: "Stand on the band, squeeze hard." },
  { id: "rope-pushdown", name: "Rope Triceps Pushdown", pattern: "Triceps Extension", target: "Triceps", equipment: "cables", difficulty: "beginner", jointStress: "low", cue: "Elbows pinned, spread the rope at lockout." },
  { id: "overhead-cable-ext", name: "Overhead Cable Triceps Extension", pattern: "Triceps Extension", target: "Triceps", equipment: "cables", difficulty: "beginner", jointStress: "low", cue: "Long head stretch, full lockout." },
  { id: "machine-dip", name: "Machine Dip", pattern: "Triceps Extension", target: "Triceps", equipment: "selectorized", difficulty: "beginner", jointStress: "low", cue: "Stay upright for triceps emphasis." },
  { id: "db-skull", name: "Dumbbell Skull Crusher", pattern: "Triceps Extension", target: "Triceps", equipment: "dumbbells", home: true, difficulty: "intermediate", jointStress: "moderate", cue: "Elbows steady, lower behind the head." },

  /* Core */
  { id: "cable-crunch", name: "Cable Crunch", pattern: "Core Brace", target: "Abs", equipment: "cables", difficulty: "beginner", jointStress: "low", cue: "Crunch the ribs to the hips, no hip flexion." },
  { id: "hanging-knee-raise", name: "Hanging Knee Raise", pattern: "Core Brace", target: "Abs", equipment: "pullup-bar", bodyweight: true, home: true, difficulty: "intermediate", jointStress: "low", cue: "Posterior tilt, control the swing." },
  { id: "plank", name: "Weighted Plank", pattern: "Core Brace", target: "Core", equipment: "bench", bodyweight: true, home: true, difficulty: "beginner", jointStress: "low", cue: "Ribs down, glutes tight." },
  { id: "pallof", name: "Pallof Press", pattern: "Core Brace", target: "Core", equipment: "cables", difficulty: "beginner", jointStress: "low", cue: "Resist rotation, breathe out at full reach." },

  /* Conditioning */
  { id: "incline-walk", name: "Incline Treadmill Walk", pattern: "Conditioning", target: "Conditioning", equipment: "treadmill", difficulty: "beginner", jointStress: "low", cue: "Steady Zone 2 pace, no hand support." },
  { id: "stairmaster", name: "Stairmaster", pattern: "Conditioning", target: "Conditioning", equipment: "stairmaster", difficulty: "beginner", jointStress: "low", cue: "Upright posture, steady cadence." },
  { id: "bike", name: "Stationary Bike", pattern: "Conditioning", target: "Conditioning", equipment: "bike", difficulty: "beginner", jointStress: "low", cue: "Smooth cadence, controlled effort." },
  { id: "outdoor-walk", name: "Zone 2 Walk", pattern: "Conditioning", target: "Conditioning", equipment: "bands", bodyweight: true, home: true, difficulty: "beginner", jointStress: "low", cue: "Conversational pace, daily steps." },
];

/* ─── Availability ────────────────────────────────────────────────────── */
function isAvailable(e: MovementLibraryEntry, profile: UserTrainingProfile): boolean {
  if (profile.dislikedMovements.some((d) => d.toLowerCase() === e.name.toLowerCase())) return false;
  if (e.premiumBrand && !profile.premiumBrands.includes(e.premiumBrand)) return false;
  if (e.bodyweight) return true;
  return profile.equipment.includes(e.equipment);
}

const LEVEL_RANK: Record<TrainingLevel, number> = { beginner: 0, intermediate: 1, advanced: 2 };

/* ─── Prescription ────────────────────────────────────────────────────── */
export type SubstitutionTag =
  | "Same Pattern" | "Same Target Tissue" | "Lower Joint Demand"
  | "Premium Machine" | "Home Option" | "Time Saver" | "Recovery Friendly";

export type PrescribedAlt = { name: string; equipment: string; tags: SubstitutionTag[] };

export type MovementPrescription = {
  pattern: MovementPattern;
  target: string;
  primary: { name: string; equipment: string; jointStress: JointStress; difficulty: TrainingLevel; cue: string } | null;
  why: string;
  alternatives: PrescribedAlt[];
  premiumUpgrade?: { name: string; brand: PremiumBrand };
  homeOption?: { name: string };
  recoveryFriendly?: { name: string };
  confidence: "high" | "moderate" | "limited";
};

export type PrescribeInput = {
  pattern: MovementPattern;
  target?: string;
  profile: UserTrainingProfile;
  goal: GoalKey;
  recoveryLimited: boolean;
  weakPointRelevant: boolean;
};

function scoreEntry(e: MovementLibraryEntry, input: PrescribeInput): number {
  const { profile, recoveryLimited, weakPointRelevant } = input;
  let s = 0;
  // Level fit — don't hand a beginner an advanced barbell lift.
  const userLvl = LEVEL_RANK[profile.trainingLevel];
  const reqLvl = LEVEL_RANK[e.difficulty];
  if (reqLvl <= userLvl) s += 2; else s -= 2;
  if (e.difficulty === profile.trainingLevel) s += 1;
  // Recovery-limited → favor low joint stress.
  if (recoveryLimited) s += e.jointStress === "low" ? 2 : e.jointStress === "high" ? -2 : 0;
  // Injury / mobility limitations → protect the joints: lift low-stress options,
  // sink high-stress ones so a limited member is never led into a high-demand lift.
  if (profile.movementLimitations.length > 0) s += e.jointStress === "low" ? 2 : e.jointStress === "high" ? -3 : 0;
  // Premium machine on a weak-point movement in a premium gym.
  if (e.premiumBrand && isPremiumGym(profile) && weakPointRelevant) s += 3;
  else if (e.premiumBrand && isPremiumGym(profile)) s += 1;
  // Style preference.
  if (profile.preferredStyle === "machines" && (e.equipment.includes("machine") || e.premiumBrand || e.pattern === "Squat Pattern")) s += 1;
  if (profile.preferredStyle === "free-weights" && (e.equipment === "dumbbells" || e.equipment === "barbell")) s += 1;
  if (profile.preferredStyle === "cables" && e.equipment === "cables") s += 1;
  // Lower setup / time efficiency for short sessions.
  if (profile.sessionDurationMin <= 45 && e.jointStress !== "high") s += 1;
  return s;
}

export function prescribeMovement(input: PrescribeInput): MovementPrescription {
  const { pattern, profile, recoveryLimited } = input;
  const target = input.target ?? "";

  const pool = MOVEMENT_LIBRARY.filter((e) => e.pattern === pattern && (!target || e.target.toLowerCase() === target.toLowerCase() || true));
  const available = pool.filter((e) => isAvailable(e, profile));
  const ranked = [...available].sort((a, b) => scoreEntry(b, input) - scoreEntry(a, input));

  const primary = ranked[0] ?? null;
  const resolvedTarget = primary?.target ?? target ?? pattern;

  const premiumEntry = ranked.find((e) => e.premiumBrand);
  const homeEntry = pool.find((e) => (e.home || e.bodyweight));
  const recoveryEntry = [...available].sort((a, b) => (a.jointStress === "low" ? -1 : 1) - (b.jointStress === "low" ? -1 : 1))[0]
    ?? available.find((e) => e.jointStress === "low");

  const alternatives: PrescribedAlt[] = ranked.slice(1, 4).map((e) => {
    const tags: SubstitutionTag[] = ["Same Pattern", "Same Target Tissue"];
    if (e.premiumBrand) tags.push("Premium Machine");
    if (e.home || e.bodyweight) tags.push("Home Option");
    if (primary && e.jointStress === "low" && primary.jointStress !== "low") tags.push("Lower Joint Demand");
    if (profile.sessionDurationMin <= 45) tags.push("Time Saver");
    return { name: e.name, equipment: e.equipment, tags };
  });

  const confidence: MovementPrescription["confidence"] = !profile.configured
    ? "limited"
    : available.length === 0 ? "limited" : available.length >= 2 ? "high" : "moderate";

  const why = primary
    ? `${primary.pattern} for ${resolvedTarget.toLowerCase()} — ${primary.jointStress === "low" ? "low joint demand" : primary.jointStress === "high" ? "high systemic demand" : "moderate demand"}, and it fits your ${profile.configured ? "available equipment" : "default setup"}.${recoveryLimited && primary.jointStress !== "low" ? " Recovery is limited — keep load honest." : ""}`
    : "No matching movement is available for this pattern in your current setup. Add equipment to your training profile or pick a bodyweight option.";

  return {
    pattern, target: resolvedTarget, primary: primary ? { name: primary.name, equipment: primary.equipment, jointStress: primary.jointStress, difficulty: primary.difficulty, cue: primary.cue } : null,
    why, alternatives,
    premiumUpgrade: premiumEntry?.premiumBrand ? { name: premiumEntry.name, brand: premiumEntry.premiumBrand } : undefined,
    homeOption: homeEntry ? { name: homeEntry.name } : undefined,
    recoveryFriendly: recoveryEntry && recoveryEntry.jointStress === "low" && primary && primary.jointStress !== "low" ? { name: recoveryEntry.name } : undefined,
    confidence,
  };
}
