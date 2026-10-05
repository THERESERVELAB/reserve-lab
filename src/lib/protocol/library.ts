/* ════════════════════════════════════════════════════════════════════════
   PROTOCOL LIBRARY — Personal Command operating system

   The member chooses an operating protocol (mission, timeline, commitment).
   The selected protocol becomes the ActiveProtocol that the rest of the
   Reserve OS organizes around (Apex, Strategist, Training, Nutrition,
   Recovery, Physique, Schedule).

   Pure data + deterministic helpers. Organization/coaching support only —
   NO medical claims, NO guaranteed outcomes, NO compound/supplement/hormone
   guidance, NO trademark/endorsement implications.
   ════════════════════════════════════════════════════════════════════════ */

import type { GymEnvironment, TrainingLevel } from "@/lib/training/gym-environment";
import {
  architectureFingerprint,
  capacityScore,
  type CapacityInput,
  type ScoreFactor,
} from "@/lib/training/architecture-profile";
import type { WomensTrack } from "@/lib/physique/types";
import { localDateKey } from "@/lib/dates/local-day";

export type ProtocolCategory =
  | "transformation" | "shred-cut" | "lean-bulk" | "recomp" | "classic-physique"
  | "athletic-performance" | "womens-performance" | "lifestyle-reset" | "vacation-prep"
  | "premium-advanced" | "at-home" | "enhanced-log-only" | "fertility-lifestyle" | "pregnancy-lifestyle"
  | "reserve-athlete" | "hybrid-performance"
  | "powerbuilding" | "strength" | "tactical-hybrid" | "endurance-physique"
  | "foundation" | "recovery-constrained" | "specialization";

export const CATEGORY_LABEL: Record<ProtocolCategory, string> = {
  transformation: "Transformation", "shred-cut": "Shred / Cut", "lean-bulk": "Lean Bulk",
  recomp: "Recomp", "classic-physique": "Classic Physique", "athletic-performance": "Athletic Performance",
  "womens-performance": "Women's Performance", "lifestyle-reset": "Lifestyle Reset", "vacation-prep": "Vacation Prep",
  "premium-advanced": "Premium / Advanced", "at-home": "At-Home", "enhanced-log-only": "Advanced Log-Only",
  "fertility-lifestyle": "Fertility Lifestyle", "pregnancy-lifestyle": "Pregnancy Lifestyle",
  "reserve-athlete": "Reserve Athlete", "hybrid-performance": "Hybrid Performance",
  powerbuilding: "Powerbuilding", strength: "Strength", "tactical-hybrid": "Tactical Hybrid",
  "endurance-physique": "Endurance / Physique", foundation: "Foundation",
  "recovery-constrained": "Recovery-Constrained", specialization: "Weak-Point Specialization",
};

export type CommitmentLevel = "moderate" | "high" | "very-high";
export const COMMITMENT_LABEL: Record<CommitmentLevel, string> = { moderate: "Moderate", high: "High", "very-high": "Very High" };

export type ProtocolDifficulty = "accessible" | "intermediate" | "advanced" | "elite";
export const DIFFICULTY_LABEL: Record<ProtocolDifficulty, string> = { accessible: "Accessible", intermediate: "Intermediate", advanced: "Advanced", elite: "Peak" };

export type GymFit = "any" | "home" | "commercial" | "premium";

export type ProtocolDefinition = {
  id: string;
  name: string;
  category: ProtocolCategory;
  tagline: string;
  description: string;
  idealUser: string;
  /** Weeks. Empty = member-defined / ongoing. */
  durationOptions: number[];
  trainingEmphasis: string;
  nutritionEmphasis: string;
  recoveryEmphasis: string;
  scheduleDemand: string;
  trainingDays: number;
  cardioDays: number;
  mobilityDays: number;
  checkInCadence: string;
  gymFit: GymFit;
  difficulty: ProtocolDifficulty;
  commitment: CommitmentLevel;
  primaryGoal: string;
  secondaryGoals: string[];
  /** What changes in the app when this protocol is active. */
  appChanges: string[];
  safetyNote?: string;
  logOnly?: boolean;
  /** Women's physique architecture activated with this protocol. */
  womensTrack?: WomensTrack;
  /** Reserve Athlete Method archetype activated with this protocol (bodybuilder-first hybrid family). */
  athleteTrack?: "hybrid" | "run-club" | "tactical" | "performance" | "endurance";
};

/* ─── The library ─────────────────────────────────────────────────────── */
export const PROTOCOL_LIBRARY: ProtocolDefinition[] = [
  {
    id: "ultimate-summer-shred", name: "Ultimate Summer Shred", category: "shred-cut",
    tagline: "Leaner, tighter, deadline-ready.",
    description: "A structured cut focused on a visible, tighter look for a known date. Hypertrophy work plus conditioning, calorie control, and grocery discipline.",
    idealUser: "Has a vacation or event in 2–4 months and wants to lean out.",
    durationOptions: [8, 12, 16], trainingEmphasis: "Hypertrophy + conditioning",
    nutritionEmphasis: "Calorie control, high protein, grocery structure", recoveryEmphasis: "Sleep + hydration protection",
    scheduleDemand: "5–6 days/week", trainingDays: 5, cardioDays: 4, mobilityDays: 3, checkInCadence: "Weekly",
    gymFit: "any", difficulty: "advanced", commitment: "high", primaryGoal: "Fat loss + visible tightening",
    secondaryGoals: ["Conditioning", "Meal adherence"],
    appChanges: ["Apex mission shifts to deadline-driven execution", "Nutrition prioritizes calorie control + protein", "Recovery protects sleep/hydration", "Weekly photo + measurement check-ins"],
  },
  {
    id: "12-week-physique", name: "12-Week Physique Protocol", category: "transformation",
    tagline: "A visible body transformation in one block.",
    description: "Structured hypertrophy with signature meals, macro structure, and weekly check-ins to drive a clear 12-week change.",
    idealUser: "Wants a focused transformation block with structure.",
    durationOptions: [12], trainingEmphasis: "Structured hypertrophy",
    nutritionEmphasis: "Signature meals, macro structure, weekly check-ins", recoveryEmphasis: "Recovery reserve tracking",
    scheduleDemand: "4–5 days/week", trainingDays: 5, cardioDays: 3, mobilityDays: 3, checkInCadence: "Weekly",
    gymFit: "commercial", difficulty: "intermediate", commitment: "high", primaryGoal: "Visible transformation",
    secondaryGoals: ["Consistency", "Composition trend"],
    appChanges: ["Training runs a structured hypertrophy block", "Nutrition surfaces signature meals + macros", "Physique check-in cadence set weekly"],
  },
  {
    id: "classic-physique-build", name: "Classic Physique Build", category: "classic-physique",
    tagline: "Upper chest, delts, back width, small-waist emphasis.",
    description: "A hypertrophy specialization block built around classic proportions — upper chest, delts, back width, and waist control.",
    idealUser: "Chasing classic proportions and shape.",
    durationOptions: [16, 24], trainingEmphasis: "Hypertrophy specialization (weak-point priority)",
    nutritionEmphasis: "Controlled lean gain or recomp", recoveryEmphasis: "High recovery consistency",
    scheduleDemand: "5–6 days/week", trainingDays: 5, cardioDays: 3, mobilityDays: 4, checkInCadence: "Weekly",
    gymFit: "commercial", difficulty: "advanced", commitment: "high", primaryGoal: "Classic shape + proportion",
    secondaryGoals: ["Weak-point specialization", "Waist control"],
    appChanges: ["Training emphasizes upper chest / delts / back width", "Physique weak-point focus is prioritized", "Nutrition runs controlled lean gain or recomp"],
  },
  {
    id: "championship-physique", name: "Championship Physique Protocol", category: "premium-advanced",
    tagline: "Elite-level structure for serious physique athletes.",
    description: "A high-commitment, stage-ready structure: 5–6x/week with weak-point priority, movement rotation, and premium equipment selection.",
    idealUser: "Advanced lifter with premium gym access and high commitment.",
    durationOptions: [16, 24, 32], trainingEmphasis: "5–6x/week, weak-point priority, movement rotation, premium equipment",
    nutritionEmphasis: "High adherence, detailed check-ins", recoveryEmphasis: "Strict recovery management",
    scheduleDemand: "5–6 days/week", trainingDays: 6, cardioDays: 4, mobilityDays: 4, checkInCadence: "Weekly",
    gymFit: "premium", difficulty: "elite", commitment: "very-high", primaryGoal: "Elite physique structure",
    secondaryGoals: ["Weak-point priority", "Movement rotation", "Stage-ready conditioning"],
    appChanges: ["Training runs 5–6x with rotation + premium machine selection", "Physique check-ins go weekly + photo discipline", "Recovery management tightens"],
    safetyNote: "Not affiliated with or endorsed by any federation, athlete, or organization. Coaching organization only.",
  },
  {
    id: "high-performance-hypertrophy", name: "High-Performance Hypertrophy", category: "athletic-performance",
    tagline: "Build muscle with progression and plateau prevention.",
    description: "Progressive overload with exercise-exposure tracking and smart rotations to keep output moving and prevent plateaus.",
    idealUser: "Wants methodical muscle gain with progression tracking.",
    durationOptions: [12, 16, 24], trainingEmphasis: "Progressive overload, exposure tracking, smart rotations",
    nutritionEmphasis: "Performance meals", recoveryEmphasis: "High recovery consistency",
    scheduleDemand: "4–5 days/week", trainingDays: 5, cardioDays: 2, mobilityDays: 3, checkInCadence: "Bi-weekly",
    gymFit: "commercial", difficulty: "advanced", commitment: "high", primaryGoal: "Muscle gain with progression",
    secondaryGoals: ["Plateau prevention", "Exposure tracking"],
    appChanges: ["Training intelligence surfaces exposure + rotation", "Nutrition runs performance meals", "Recovery weighting increases"],
  },
  {
    id: "reserve-athlete-hybrid", name: "Reserve Athlete Hybrid", category: "reserve-athlete", athleteTrack: "hybrid",
    tagline: "Bodybuilder first. Athlete second.",
    description: "A protected bodybuilding core with athletic capacity, conditioning, and scheduled recovery layered around it — built to sharpen the physique, not spend it. The Reserve Athlete Method.",
    idealUser: "Wants a stage-ready physique that can also run, move, and recover like an athlete.",
    durationOptions: [12, 16, 24], trainingEmphasis: "Hypertrophy + strength core, athletic capacity layered around it",
    nutritionEmphasis: "Year-round lean — nutrient partitioning, fuel matched to the session", recoveryEmphasis: "Recovery as a scheduled, load-adaptive session",
    scheduleDemand: "6 days/week", trainingDays: 4, cardioDays: 2, mobilityDays: 2, checkInCadence: "Weekly",
    gymFit: "premium", difficulty: "advanced", commitment: "high", primaryGoal: "An elite physique that performs",
    secondaryGoals: ["Athletic capacity", "Conditioning", "Recovery discipline", "Longevity"],
    appChanges: [
      "Training runs a protected bodybuilding core with a Recovery-Athlete day and a Reserve Athlete day layered in",
      "Recovery becomes a scheduled, load-adaptive session",
      "Environment intelligence uses available athletic and recovery facilities",
    ],
    safetyNote: "Performance and recovery tracking only. Observational — not medical advice.",
  },
  {
    id: "reserve-grand-touring", name: "Reserve Grand Touring", category: "hybrid-performance",
    tagline: "Physique precision. Distance capacity. A week that moves with you.",
    description: "A refined hybrid architecture combining physique development, structured conditioning, outdoor distance, and intelligent recovery. Grand Touring adapts around your schedule, training environment, and real-life demands without losing the integrity of the week.",
    idealUser: "Athletes who want meaningful muscular development without giving up endurance, conditioning, or movement capacity.",
    durationOptions: [12, 16, 24], trainingEmphasis: "Push / pull / lower physique work with structured conditioning and outdoor distance woven in",
    nutritionEmphasis: "Performance fueling matched to the session — carbs protected around training and conditioning", recoveryEmphasis: "Adaptive recovery that accounts for combined lifting and distance load",
    scheduleDemand: "4–6 gym sessions + 1–2 outdoor / performance sessions", trainingDays: 6, cardioDays: 2, mobilityDays: 2, checkInCadence: "Weekly",
    gymFit: "commercial", difficulty: "advanced", commitment: "high", primaryGoal: "Complete hybrid performance — physique with distance capacity",
    secondaryGoals: ["Physique development", "Conditioning", "Endurance", "Work capacity", "Body composition"],
    appChanges: [
      "Training runs a hybrid week — push / pull / lower with structured conditioning and outdoor distance",
      "Reserve evaluates total training stress, lower-body interference, and session timing before shaping the week",
      "Nutrition follows the session — carbs protected around training and conditioning days",
      "Recovery adapts around combined lifting and distance load",
    ],
    safetyNote: "Performance and recovery organization only. Observational — not medical advice.",
  },
  {
    id: "reserve-powerbuilding", name: "Reserve Powerbuilding", category: "powerbuilding",
    tagline: "Measured strength on the anchor lifts. Muscle built around them.",
    description: "Squat, bench, hinge, and press progress on measurable top sets, with hypertrophy accessories built directly around each primary pattern. Strength accumulation, intensification, and a realization block that tests what the work produced.",
    idealUser: "Wants the anchor lifts to go up and the physique to grow with them.",
    durationOptions: [12, 16], trainingEmphasis: "Primary-lift progression with hypertrophy accessories around each pattern",
    nutritionEmphasis: "Performance fuel — carbs protected around primary-lift days", recoveryEmphasis: "Recovery protected between heavy exposures",
    scheduleDemand: "5 days/week", trainingDays: 5, cardioDays: 2, mobilityDays: 3, checkInCadence: "Bi-weekly",
    gymFit: "commercial", difficulty: "advanced", commitment: "high", primaryGoal: "Strength and size together",
    secondaryGoals: ["Squat / bench / hinge / press progression", "Hypertrophy accessories", "Performance testing"],
    appChanges: [
      "Training runs measurable top sets on the anchor lifts with back-off hypertrophy",
      "Progression tracks primary-lift performance, not session feel",
      "The block finishes with a realization and assessment week",
    ],
  },
  {
    id: "reserve-strength", name: "Reserve Strength", category: "strength",
    tagline: "Fewer lifts. Higher specificity. Measurable output.",
    description: "A specificity-first strength architecture. Each session is built around one primary lift, its supplemental variation, and only the accessories that support that lift. Low exercise variety by design — the skill of the lift is the training effect.",
    idealUser: "Wants measurable strength on specific lifts and accepts lower exercise variety to get it.",
    durationOptions: [12, 16], trainingEmphasis: "Primary-lift specificity, planned intensity exposure, supporting accessories only",
    nutritionEmphasis: "Performance maintenance — fuel matched to intensity exposure", recoveryEmphasis: "Fatigue management between heavy exposures",
    scheduleDemand: "4 days/week", trainingDays: 4, cardioDays: 1, mobilityDays: 3, checkInCadence: "Bi-weekly",
    gymFit: "commercial", difficulty: "advanced", commitment: "high", primaryGoal: "Maximal strength on specific lifts",
    secondaryGoals: ["Lift skill", "Intensity exposure", "Fatigue management", "Testing"],
    appChanges: [
      "Every session opens on one primary lift with a planned intensity exposure",
      "Exercise variety is deliberately low — specificity is the point",
      "The block closes with a realization and testing week",
    ],
  },
  {
    id: "reserve-tactical", name: "Reserve Tactical", category: "tactical-hybrid",
    tagline: "Durability under load. Repeatable output.",
    description: "Loaded carries, strength endurance, repeated-effort conditioning, trunk strength, and running organized into a durability architecture. Built for capacity that repeats day after day rather than a single peak.",
    idealUser: "Needs work capacity, load tolerance, and durability rather than a single-session peak.",
    durationOptions: [12, 16], trainingEmphasis: "Loaded carries, strength endurance, repeated-effort conditioning, trunk strength",
    nutritionEmphasis: "High-output support — carbs and hydration matched to repeated-effort days", recoveryEmphasis: "Impact and load accumulation managed across the week",
    scheduleDemand: "5–6 days/week", trainingDays: 6, cardioDays: 3, mobilityDays: 2, checkInCadence: "Weekly",
    gymFit: "commercial", difficulty: "advanced", commitment: "high", primaryGoal: "Durability and repeatable work capacity",
    secondaryGoals: ["Loaded carries", "Strength endurance", "Repeated-effort conditioning", "Trunk strength"],
    appChanges: [
      "Training runs carries, strength endurance, and repeated-effort conditioning",
      "Reserve tracks impact and load accumulation across the week",
      "The block closes with a work-capacity assessment",
    ],
    safetyNote: "Performance and recovery organization only. Observational — not medical advice.",
  },
  {
    id: "reserve-endurance-physique", name: "Reserve Endurance Physique", category: "endurance-physique",
    tagline: "Aerobic development first. Muscle protected underneath.",
    description: "Endurance leads the week — an aerobic base, a quality session, and a long effort — with resistance work reduced to what protects muscle and strength. Interference is managed by placement, not by hope.",
    idealUser: "Wants real endurance progression without losing the physique built underneath it.",
    durationOptions: [12, 16], trainingEmphasis: "Aerobic base, mileage progression, quality endurance work, muscle-retention resistance training",
    nutritionEmphasis: "Endurance output support — carbohydrate availability around quality and long sessions", recoveryEmphasis: "Aerobic load and lower-body interference managed together",
    scheduleDemand: "5–6 days/week", trainingDays: 6, cardioDays: 4, mobilityDays: 2, checkInCadence: "Weekly",
    gymFit: "any", difficulty: "advanced", commitment: "high", primaryGoal: "Endurance progression with muscle retention",
    secondaryGoals: ["Aerobic base", "Mileage or duration progression", "Muscle retention", "Interference management"],
    appChanges: [
      "Endurance sessions lead the week and resistance work protects muscle underneath",
      "Reserve manages lower-body interference between distance and lifting",
      "Nutrition supports endurance output rather than a physique-only pattern",
    ],
    safetyNote: "Performance and recovery organization only. Observational — not medical advice.",
  },
  {
    id: "reserve-foundation", name: "Reserve Foundation", category: "foundation",
    tagline: "Learn the movements. Build the habit. Earn the load.",
    description: "A movement-first architecture for an early training age. Three manageable sessions, low complexity, technique before load, and clear criteria for when volume is allowed to increase.",
    idealUser: "Early in training. Needs movement quality and consistency before specialization.",
    durationOptions: [8, 12], trainingEmphasis: "Movement learning, technique development, consistency, conservative fatigue",
    nutritionEmphasis: "Simple structure — protein anchor and consistent meals", recoveryEmphasis: "Conservative fatigue with generous recovery",
    scheduleDemand: "3 days/week", trainingDays: 3, cardioDays: 2, mobilityDays: 3, checkInCadence: "Bi-weekly",
    gymFit: "any", difficulty: "accessible", commitment: "moderate", primaryGoal: "Movement quality and consistency",
    secondaryGoals: ["Technique development", "Consistency", "Conservative progression"],
    appChanges: [
      "Training keeps complexity low and repeats the core movement patterns",
      "Volume increases only when the progression criteria are met",
      "No advanced specialization is offered until the base is established",
    ],
  },
  {
    id: "reserve-restored", name: "Reserve Restored", category: "recovery-constrained",
    tagline: "Lower systemic cost. Quality kept intact.",
    description: "Built for a genuinely constrained week — poor sleep, high work stress, current discomfort, or limited recovery. Sessions are spaced, overlapping fatigue is reduced, and volume follows readiness rather than a fixed number.",
    idealUser: "Recovery is the limiter right now, and the plan needs to respect that honestly.",
    durationOptions: [8, 12], trainingEmphasis: "Lower systemic demand, efficient selection, readiness-sensitive volume",
    nutritionEmphasis: "Protein anchor with steady, unaggressive calories", recoveryEmphasis: "Recovery days protected and never quietly reassigned",
    scheduleDemand: "3–4 days/week", trainingDays: 4, cardioDays: 2, mobilityDays: 4, checkInCadence: "Weekly",
    gymFit: "any", difficulty: "accessible", commitment: "moderate", primaryGoal: "Progress under a real recovery ceiling",
    secondaryGoals: ["Reduced systemic demand", "Readiness-sensitive volume", "Recovery-day protection"],
    appChanges: [
      "Training spaces sessions to reduce overlapping fatigue",
      "Volume follows readiness rather than a fixed weekly target",
      "Recovery days are protected and never silently converted to training",
    ],
    safetyNote: "Training organization only. Persistent pain, illness, or fatigue is a clinician conversation, not a programming one.",
  },
  {
    id: "reserve-specialization", name: "Reserve Specialization", category: "specialization",
    tagline: "One region leads. The rest of the physique is held, not abandoned.",
    description: "A specialization block: extra exposure and set allocation for the chosen lagging region, maintenance volume everywhere else, and defined exit criteria so the block ends rather than drifting.",
    idealUser: "Has an established base and a clearly identified lagging region.",
    durationOptions: [8, 12], trainingEmphasis: "Priority-region exposure with maintenance volume elsewhere",
    nutritionEmphasis: "Lean gain or recomp — fuel protected around the priority sessions", recoveryEmphasis: "Fatigue managed so the priority region keeps quality",
    scheduleDemand: "5 days/week", trainingDays: 5, cardioDays: 2, mobilityDays: 3, checkInCadence: "Weekly",
    gymFit: "commercial", difficulty: "advanced", commitment: "high", primaryGoal: "Bring up a lagging region",
    secondaryGoals: ["Priority exposure", "Maintenance volume", "Defined exit criteria"],
    appChanges: [
      "The priority region gets extra weekly exposure and set allocation",
      "Non-priority regions drop to maintenance rather than disappearing",
      "The block has explicit exit criteria instead of running indefinitely",
    ],
  },
  {
    id: "lean-bulk-command", name: "Lean Bulk Command", category: "lean-bulk",
    tagline: "Gain size while controlling fat gain.",
    description: "Hypertrophy plus progressive overload on a controlled surplus, with sleep and recovery-reserve focus.",
    idealUser: "Wants to add size without losing condition.",
    durationOptions: [12, 16, 24], trainingEmphasis: "Hypertrophy + progressive overload",
    nutritionEmphasis: "Controlled surplus", recoveryEmphasis: "Sleep + recovery reserve",
    scheduleDemand: "4–5 days/week", trainingDays: 5, cardioDays: 2, mobilityDays: 3, checkInCadence: "Bi-weekly",
    gymFit: "any", difficulty: "intermediate", commitment: "high", primaryGoal: "Controlled size gain",
    secondaryGoals: ["Strength progression", "Condition retention"],
    appChanges: ["Nutrition targets a controlled surplus", "Training emphasizes overload", "Physique tracks lean-gain trend"],
  },
  {
    id: "recomp-protocol", name: "Recomp Protocol", category: "recomp",
    tagline: "Build muscle while tightening composition.",
    description: "Hypertrophy with a protein anchor and controlled calories to drive recomposition over a focused block.",
    idealUser: "Wants to build and tighten at the same time.",
    durationOptions: [12, 16], trainingEmphasis: "Hypertrophy",
    nutritionEmphasis: "Protein anchor, controlled calories", recoveryEmphasis: "High consistency",
    scheduleDemand: "4–5 days/week", trainingDays: 4, cardioDays: 3, mobilityDays: 3, checkInCadence: "Weekly",
    gymFit: "any", difficulty: "intermediate", commitment: "high", primaryGoal: "Recomposition",
    secondaryGoals: ["Protein adherence", "Composition trend"],
    appChanges: ["Nutrition anchors protein + controls calories", "Physique tracks composition trend", "Weekly check-ins"],
  },
  {
    id: "at-home-warrior", name: "At-Home Warrior Protocol", category: "at-home",
    tagline: "Real progress with dumbbells, bodyweight, and bands.",
    description: "Unilateral work, tempo, and density blocks engineered for home equipment, progressing through reps, load, and time.",
    idealUser: "Trains at home with limited equipment.",
    durationOptions: [8, 12, 16], trainingEmphasis: "Unilateral work, tempo, density blocks",
    nutritionEmphasis: "Structure + adherence", recoveryEmphasis: "Simple recovery rhythm",
    scheduleDemand: "4 days/week", trainingDays: 4, cardioDays: 3, mobilityDays: 3, checkInCadence: "Weekly",
    gymFit: "home", difficulty: "accessible", commitment: "moderate", primaryGoal: "Home-equipment progress",
    secondaryGoals: ["Tempo control", "Density progression"],
    appChanges: ["Training programs dumbbell/bodyweight/band movements", "Nutrition keeps a simple meal rhythm", "Recovery stays simple"],
  },
  {
    id: "premium-gym-operator", name: "Premium Gym Operator", category: "premium-advanced",
    tagline: "Maximize premium machines and specialty equipment.",
    description: "Built to exploit premium plate-loaded and specialty machines with weak-point specialization and performance support.",
    idealUser: "Trains at a luxury/high-performance gym.",
    durationOptions: [12, 16, 24], trainingEmphasis: "Prime/Atlantis/Hammer/Panatta-style selection, weak-point specialization",
    nutritionEmphasis: "Performance support", recoveryEmphasis: "High recovery management",
    scheduleDemand: "5 days/week", trainingDays: 5, cardioDays: 3, mobilityDays: 3, checkInCadence: "Weekly",
    gymFit: "premium", difficulty: "advanced", commitment: "high", primaryGoal: "Maximize premium equipment",
    secondaryGoals: ["Weak-point specialization", "Movement variety"],
    appChanges: ["Training programs premium machine options", "Intelligence highlights premium substitutions", "Weak-point focus prioritized"],
  },
  {
    id: "glute-ascend", name: "Summit", category: "womens-performance", womensTrack: "glute-quad",
    tagline: "Maximum glute priority, built without the bulk.",
    description: "A glute-priority architecture with complete legs, waist control, and balanced upper-frame work.",
    idealUser: "Wants glutes to lead while hamstrings, quads, calves, core, and upper frame stay balanced.",
    durationOptions: [8, 12, 16], trainingEmphasis: "Glute strength, lower-body shape, complete legs", nutritionEmphasis: "Lean gain or recomp alignment", recoveryEmphasis: "Lower-body recovery protected",
    scheduleDemand: "5 days/week", trainingDays: 5, cardioDays: 2, mobilityDays: 3, checkInCadence: "Weekly",
    gymFit: "commercial", difficulty: "intermediate", commitment: "high", primaryGoal: "Glute development and complete lower-body shape", secondaryGoals: ["Hamstring detail", "Waist control", "Upper-frame balance"],
    appChanges: ["Activates Summit architecture", "Protects lower-body fuel", "Tracks lower-body frequency and recovery"],
  },
  {
    id: "glute-crown", name: "Crown", category: "womens-performance", womensTrack: "glute-upper",
    tagline: "Three glute exposures a week — strength, shape, then density.",
    description: "Three glute exposures with hamstring support, upper-frame detail, and controlled conditioning.",
    idealUser: "Wants high-priority glute work without losing posture or upper-frame balance.",
    durationOptions: [8, 12, 16], trainingEmphasis: "Glute strength, shape, and detail", nutritionEmphasis: "Lean gain or recomp alignment", recoveryEmphasis: "High lower-body recovery demand",
    scheduleDemand: "5 days/week", trainingDays: 5, cardioDays: 2, mobilityDays: 3, checkInCadence: "Weekly",
    gymFit: "commercial", difficulty: "advanced", commitment: "very-high", primaryGoal: "Maximum glute priority", secondaryGoals: ["Hamstring support", "Upper-frame balance", "Lockout control"],
    appChanges: ["Activates Crown architecture", "Protects glute-day fuel", "Tracks fatigue across three glute exposures"],
  },
  {
    id: "sculpted-legs", name: "Long Lines", category: "womens-performance", womensTrack: "lean-recomp",
    tagline: "Legs built for length, not thickness.",
    description: "Quad, hamstring, glute, and calf work organized into a complete lower-body rotation.",
    idealUser: "Wants balanced leg development with a polished upper frame and controlled conditioning.",
    durationOptions: [8, 12, 16], trainingEmphasis: "Complete legs and balanced lower-body volume", nutritionEmphasis: "Recomp or lean-gain alignment", recoveryEmphasis: "Leg-day recovery protected",
    scheduleDemand: "5 days/week", trainingDays: 5, cardioDays: 2, mobilityDays: 3, checkInCadence: "Weekly",
    gymFit: "commercial", difficulty: "intermediate", commitment: "high", primaryGoal: "Complete lower-body shape", secondaryGoals: ["Quad sweep", "Hamstring shape", "Calf detail"],
    appChanges: ["Activates Long Lines architecture", "Protects leg-day fuel", "Tracks complete-leg frequency"],
  },
  {
    id: "runway-shape", name: "Runway", category: "womens-performance", womensTrack: "runway",
    tagline: "Shape, posture and waistline for a physique that photographs.",
    description: "Lower-body shape, back-line detail, shoulder line, core control, and conditioning with controlled fatigue.",
    idealUser: "Wants a refined feminine athletic look with posture and waistline control.",
    durationOptions: [8, 12, 16], trainingEmphasis: "Lower-body shape, posture, back line, core", nutritionEmphasis: "Recomp or controlled-cut alignment", recoveryEmphasis: "Moderate, controlled fatigue",
    scheduleDemand: "5 days/week", trainingDays: 5, cardioDays: 2, mobilityDays: 3, checkInCadence: "Weekly",
    gymFit: "any", difficulty: "intermediate", commitment: "high", primaryGoal: "Polished feminine athletic shape", secondaryGoals: ["Posture", "Waistline markers", "Shoulder and back line"],
    appChanges: ["Activates Runway architecture", "Aligns fuel to recomp or controlled cut", "Tracks posture and conditioning consistency"],
  },
  {
    id: "vacation-physique", name: "Resort", category: "womens-performance", womensTrack: "lifestyle-shape",
    tagline: "A sharper look on a schedule that is already full.",
    description: "Efficient lower-body detail, upper-frame finish, core work, and conditioning for a busy schedule.",
    idealUser: "Wants a confident summer physique direction without an overwhelming week.",
    durationOptions: [6, 8, 12], trainingEmphasis: "Lower-body detail, upper finish, conditioning", nutritionEmphasis: "Controlled cut or recomp alignment", recoveryEmphasis: "Busy-week recovery protected",
    scheduleDemand: "5 days/week", trainingDays: 5, cardioDays: 2, mobilityDays: 2, checkInCadence: "Weekly",
    gymFit: "any", difficulty: "accessible", commitment: "high", primaryGoal: "Vacation physique direction", secondaryGoals: ["Waistline trend", "Glute and leg detail", "Conditioning consistency"],
    appChanges: ["Activates Resort architecture", "Blocks bulk-style fuel direction", "Protects recovery on a busy week"],
  },
  {
    id: "athletic-model", name: "Off-Duty", category: "womens-performance", womensTrack: "athletic-model",
    tagline: "A physique that performs as well as it photographs.",
    description: "Athletic lower-body strength, upper-frame detail, core bracing, conditioning, and work capacity.",
    idealUser: "Wants a capable, modern physique with performance and conditioning in the same week.",
    durationOptions: [8, 12, 16], trainingEmphasis: "Athletic strength, work capacity, conditioning", nutritionEmphasis: "Performance recomp alignment", recoveryEmphasis: "High-output fatigue managed",
    scheduleDemand: "5 days/week", trainingDays: 5, cardioDays: 2, mobilityDays: 3, checkInCadence: "Weekly",
    gymFit: "commercial", difficulty: "advanced", commitment: "high", primaryGoal: "Athletic physique and work capacity", secondaryGoals: ["Conditioning output", "Back and shoulder detail", "Core consistency"],
    appChanges: ["Activates Off-Duty architecture", "Matches fuel to conditioning load", "Tracks work capacity and recovery"],
  },
  {
    id: "signature-shape", name: "Signature", category: "womens-performance", womensTrack: "signature-shape",
    tagline: "The complete foundation, before you specialize.",
    description: "Balanced lower body, upper frame, core, posture, and conditioning in a sustainable weekly rhythm.",
    idealUser: "Wants a premium, complete foundation before choosing a sharper specialization.",
    durationOptions: [8, 12, 16], trainingEmphasis: "Balanced shape and complete physique foundation", nutritionEmphasis: "Recomp alignment", recoveryEmphasis: "Sustainable weekly rhythm",
    scheduleDemand: "4–5 days/week", trainingDays: 5, cardioDays: 2, mobilityDays: 3, checkInCadence: "Weekly",
    gymFit: "any", difficulty: "accessible", commitment: "high", primaryGoal: "Balanced feminine physique foundation", secondaryGoals: ["Posture", "Core consistency", "Conditioning rhythm"],
    appChanges: ["Activates Signature architecture", "Aligns fuel to recomp", "Tracks balanced weekly coverage"],
  },
  {
    id: "hybrid-pilates-shape", name: "Studio", category: "womens-performance", womensTrack: "hybrid-pilates",
    tagline: "Gym strength and studio control in one week.",
    description: "Gym-based lower-body strength blended with Pilates-style core, posture, mobility, and low-fatigue volume.",
    idealUser: "Combines gym work with Pilates or wants a lower-fatigue, posture-led week.",
    durationOptions: [8, 12, 16], trainingEmphasis: "Gym strength, Pilates, posture, core", nutritionEmphasis: "Recomp or controlled-cut alignment", recoveryEmphasis: "Low-fatigue refinement",
    scheduleDemand: "5 gym/Pilates days", trainingDays: 5, cardioDays: 2, mobilityDays: 3, checkInCadence: "Weekly",
    gymFit: "any", difficulty: "intermediate", commitment: "high", primaryGoal: "Hybrid Pilates shape", secondaryGoals: ["Core control", "Posture", "Mobility consistency"],
    appChanges: ["Activates Hybrid Pilates architecture", "Counts Pilates as useful activity load", "Reduces unnecessary gym fatigue"],
  },
  {
    id: "sport-strength-shape", name: "Field", category: "womens-performance", womensTrack: "sport-strength",
    tagline: "Strength that holds up in your sport.",
    description: "Strength, lower-body shape, core, and upper-frame work arranged around sport and conditioning demand.",
    idealUser: "Needs physique training to coexist with sport, conditioning, and variable leg fatigue.",
    durationOptions: [8, 12, 16], trainingEmphasis: "Strength around sport and conditioning", nutritionEmphasis: "High-output hybrid support", recoveryEmphasis: "Sport fatigue accounted for",
    scheduleDemand: "5 strength/sport days", trainingDays: 5, cardioDays: 3, mobilityDays: 3, checkInCadence: "Weekly",
    gymFit: "any", difficulty: "advanced", commitment: "high", primaryGoal: "Sport and strength physique balance", secondaryGoals: ["Recovery management", "Core bracing", "Upper-frame balance"],
    appChanges: ["Activates Sport + Strength architecture", "Protects fuel around sport days", "Avoids stacking hard legs before sport"],
  },
  {
    id: "vacation-countdown", name: "Vacation Countdown Protocol", category: "vacation-prep",
    tagline: "Tighten the routine before a known date.",
    description: "Efficient hypertrophy plus conditioning and simple high-adherence meals, organized around a deadline.",
    idealUser: "Has a specific trip/date within ~3 months.",
    durationOptions: [4, 8, 12], trainingEmphasis: "Efficient hypertrophy + conditioning",
    nutritionEmphasis: "Simple high-adherence meals", recoveryEmphasis: "Sleep + hydration protection",
    scheduleDemand: "4–6 days/week", trainingDays: 5, cardioDays: 4, mobilityDays: 2, checkInCadence: "Weekly",
    gymFit: "any", difficulty: "intermediate", commitment: "high", primaryGoal: "Deadline-driven tightening",
    secondaryGoals: ["Routine consistency", "Conditioning"],
    appChanges: ["Apex counts down to the target date", "Nutrition keeps simple high-adherence meals", "Recovery protects sleep/hydration"],
  },
  {
    id: "lifestyle-reset", name: "Lifestyle Reset Protocol", category: "lifestyle-reset",
    tagline: "Rebuild structure, sleep, meals, and consistency.",
    description: "A sustainable reset of training, meal rhythm, and recovery for someone rebuilding momentum.",
    idealUser: "Rebuilding structure after a break.",
    durationOptions: [4, 8, 12], trainingEmphasis: "Sustainable training",
    nutritionEmphasis: "Simple meal rhythm", recoveryEmphasis: "Recovery as the priority",
    scheduleDemand: "3–4 days/week", trainingDays: 3, cardioDays: 3, mobilityDays: 4, checkInCadence: "Weekly",
    gymFit: "any", difficulty: "accessible", commitment: "moderate", primaryGoal: "Rebuild consistency",
    secondaryGoals: ["Sleep rhythm", "Meal rhythm"],
    appChanges: ["Training stays sustainable", "Nutrition keeps a simple rhythm", "Recovery is the lead system"],
  },
  {
    id: "enhanced-logbook", name: "Enhanced Logbook Protocol", category: "enhanced-log-only",
    tagline: "Cleaner organization for advanced tracking.",
    description: "Log-only organization for training, nutrition, bloodwork logs, compound logs, inventory, schedules, and adherence.",
    idealUser: "Advanced user who needs cleaner record-keeping.",
    durationOptions: [], trainingEmphasis: "Member-defined",
    nutritionEmphasis: "Adherence + inventory organization", recoveryEmphasis: "Member-defined",
    scheduleDemand: "Member-defined", trainingDays: 5, cardioDays: 3, mobilityDays: 3, checkInCadence: "Member-defined",
    gymFit: "any", difficulty: "advanced", commitment: "moderate", primaryGoal: "Organized record-keeping",
    secondaryGoals: ["Adherence tracking", "Inventory + schedule organization"], logOnly: true,
    appChanges: ["Surfaces log-only tracking modules", "No prescriptions or guidance generated"],
    safetyNote: "Log-only. Reserve does not prescribe, recommend, or adjust compounds, supplements, medications, or dosages.",
  },
  {
    id: "fertility-lifestyle", name: "Fertility Lifestyle Protocol", category: "fertility-lifestyle",
    tagline: "Lifestyle organization while trying to conceive.",
    description: "Nutrition, hydration, sleep, recovery, and lifestyle adherence organization. Lifestyle support only.",
    idealUser: "Wants lifestyle organization during this phase.",
    durationOptions: [], trainingEmphasis: "Sustainable, member-defined",
    nutritionEmphasis: "Meal + hydration structure", recoveryEmphasis: "Sleep + recovery rhythm",
    scheduleDemand: "Member-defined", trainingDays: 3, cardioDays: 3, mobilityDays: 4, checkInCadence: "Member-defined",
    gymFit: "any", difficulty: "accessible", commitment: "moderate", primaryGoal: "Lifestyle adherence",
    secondaryGoals: ["Hydration", "Sleep rhythm"], logOnly: true,
    appChanges: ["Surfaces lifestyle organization", "No medical or treatment guidance"],
    safetyNote: "Lifestyle organization only. No medical advice, diagnosis, or treatment guidance.",
  },
  {
    id: "pregnancy-lifestyle", name: "Pregnancy Lifestyle Protocol", category: "pregnancy-lifestyle",
    tagline: "Trimester-based lifestyle organization.",
    description: "Meal planning, hydration, recovery, and lifestyle organization by trimester. Lifestyle support only.",
    idealUser: "Wants lifestyle organization through pregnancy.",
    durationOptions: [], trainingEmphasis: "Member-defined, clinician-guided",
    nutritionEmphasis: "Meal planning + hydration", recoveryEmphasis: "Recovery + sleep",
    scheduleDemand: "Member-defined", trainingDays: 3, cardioDays: 2, mobilityDays: 4, checkInCadence: "Member-defined",
    gymFit: "any", difficulty: "accessible", commitment: "moderate", primaryGoal: "Lifestyle organization",
    secondaryGoals: ["Hydration", "Meal planning"], logOnly: true,
    appChanges: ["Surfaces trimester-based lifestyle organization", "No medical or baby-health claims"],
    safetyNote: "Lifestyle organization only. No medical advice, no baby-health claims, follow clinician guidance.",
  },
];

export function getProtocol(id: string): ProtocolDefinition | null {
  return PROTOCOL_LIBRARY.find((p) => p.id === id) ?? null;
}

/* ════════════════════════════════════════════════════════════════════════
   PROTOCOL PRODUCT LAYER — identity, outcome vision, fit, and fuel bias.

   Each protocol is a product the member buys into with hard work and identity.
   This layer gives every protocol a distinct, desirable identity: who it is
   built for, the physique direction it moves toward, the weekly training bias,
   how outside activity (Pilates / yoga / sport) fits, the fuel strategy that
   matches the goal, recovery demand, and honest best-for / not-best-for
   boundaries.

   Safe-language contract (enforced): "potential trend targets",
   "designed to support", "built to move toward", "with consistent execution",
   "the dashboard watches for". NEVER guaranteed outcomes, exact inches /
   pounds / timelines, medical claims, or dosing.
   ════════════════════════════════════════════════════════════════════════ */

export type NutritionIntent =
  | "lean-gain"
  | "recomp"
  | "cut"
  | "performance-maintenance"
  | "high-output-hybrid";

export const NUTRITION_INTENT_LABEL: Record<NutritionIntent, string> = {
  "lean-gain": "Lean Gain",
  recomp: "Recomp",
  cut: "Cut / Lean Phase",
  "performance-maintenance": "Performance Maintenance",
  "high-output-hybrid": "High-Output Hybrid Support",
};

export type ProtocolNutritionBias = {
  intent: NutritionIntent;
  /** One-line fuel direction aligned to the training goal. Food / timing organization only. */
  summary: string;
  /** Supporting fuel cues — food, protein, hydration, and timing. Never dosing or medical guidance. */
  points: string[];
};

export type ProtocolProduct = {
  /** Who the protocol is built for — the identity statement. */
  builtFor: string;
  /** Short emotional click line — the "happy hormone" hook that makes the
      member want to open this protocol. Safe, aspirational, never guaranteed. */
  desireHook: string;
  /** The physique direction the member is working toward (safe, non-guaranteed). */
  outcomeVision: string;
  /** Potential trend targets the dashboard watches for with consistent execution. */
  visibleTrendTargets: string[];
  /** The progress chase — what the member gets excited tracking week to week. */
  theChase: string;
  /** Weekly frequency proof in one line — the engine behind the look. */
  weeklyEngine: string;
  /** What the training week leans into. */
  weeklyTrainingBias: string;
  /** How outside activity (Pilates / yoga / sport) fits this protocol. */
  activityCompatibility: string;
  /** Fuel strategy aligned to the training goal — read by Nutrition Command + Apex. */
  nutritionBias: ProtocolNutritionBias;
  /** Honest recovery-demand read. */
  recoveryDemand: string;
  /** Best for. */
  bestFor: string;
  /** Not best for — honest fit boundaries. */
  notBestFor: string;
  /** Short weekly-structure preview (kept consistent with the protocol cadence). */
  weeklyStructure: string[];
};

export const PROTOCOL_PRODUCTS: Record<string, ProtocolProduct> = {
  "ultimate-summer-shred": {
    builtFor: "Members who want a leaner, tighter summer physique for a real date on the calendar.",
    desireHook: "For the member chasing the lean, tight summer look they feel the second they catch their own reflection.",
    theChase: "Chase a sharper waistline, harder conditioning days, leaner progress photos, and poolside confidence that builds week over week.",
    weeklyEngine: "Strength 5x, conditioning 4x, mobility 3x, core / waist emphasis, weekly photo + measurement check-in.",
    outcomeVision: "Built to move the body toward a sharper, camera-ready summer shape — a tighter waistline, harder conditioning, and a poolside-confident finish.",
    visibleTrendTargets: ["sharper waistline markers", "tighter midsection conditioning", "leaner overall body-composition trend", "back and shoulder line detail", "improved conditioning output", "vacation-physique readiness"],
    weeklyTrainingBias: "Hypertrophy across the week with conditioning layered in and recovery protected so the look tightens toward the date without losing muscle.",
    activityCompatibility: "Pilates and yoga slot in as low-fatigue core, posture, and recovery support. Recreational sport adds conditioning — keep high-output sport days clear of heavy leg sessions.",
    nutritionBias: {
      intent: "cut",
      summary: "Controlled cut — protein anchored, calories managed toward a leaner trend, carbs timed around training.",
      points: ["Protein anchored at every meal", "Calories controlled toward a leaner look — never an aggressive crash", "Carbs placed around training, lighter on rest days", "Hydration and grocery discipline carry adherence", "No bulk-style meal plan while a summer-lean goal is active"],
    },
    recoveryDemand: "High — 5–6 active days plus conditioning. Sleep and hydration become non-negotiable.",
    bestFor: "A visible lean-out with a fixed date 2–4 months away.",
    notBestFor: "Members chasing maximum muscle or new size right now — leaning out is the priority here.",
    weeklyStructure: ["5 strength sessions across the week", "4 conditioning exposures, placed clear of leg recovery", "3 mobility / recovery touchpoints", "Weekly photo + measurement check-in toward the date"],
  },
  "12-week-physique": {
    builtFor: "Members who want one focused, structured block that produces a clear, visible change.",
    desireHook: "For the member who wants to look in the mirror in twelve weeks and barely recognize where they started.",
    theChase: "Chase fuller muscle shape, a tighter waist, stronger working sets, and weekly evidence that the change is real.",
    weeklyEngine: "Structured hypertrophy 5x, conditioning 3x, mobility 3x, weekly photo + measurement check-in.",
    outcomeVision: "Designed to support a visible 12-week transformation — fuller muscle shape, a tighter waistline, and a more complete, balanced physique.",
    visibleTrendTargets: ["fuller upper-body shape", "sharper waistline markers", "improved muscle definition", "stronger working-set output", "balanced upper / lower development", "consistent weekly progress evidence"],
    weeklyTrainingBias: "Structured hypertrophy across every region with weekly evidence check-ins driving progressive overload through the block.",
    activityCompatibility: "Pilates and yoga support core, posture, and mobility between sessions. Light recreational sport is fine — keep it from cutting into training-day recovery.",
    nutritionBias: {
      intent: "recomp",
      summary: "Recomp — protein anchored with macro structure and signature meals, calories matched to a build-and-tighten trend.",
      points: ["Protein anchored across the day", "Signature meals + macro structure keep adherence high", "Carbs supported around training", "Calories matched to a recomposition trend", "Weekly check-ins read the trend, not a single day"],
    },
    recoveryDemand: "Moderate–high — 4–5 quality days with recovery built in around the build.",
    bestFor: "A first or repeat focused transformation block with full structure.",
    notBestFor: "Members who want an open-ended, no-deadline rhythm — this is a defined 12-week commitment.",
    weeklyStructure: ["5 structured hypertrophy sessions", "3 conditioning exposures", "3 mobility / recovery touchpoints", "Weekly photo + measurement check-in"],
  },
  "classic-physique-build": {
    builtFor: "Members chasing classic proportion — upper-frame detail, shoulder line, and a small-waist look.",
    desireHook: "For the member chasing the timeless V-taper — wide shoulders, a shelf upper chest, and a waist that makes the whole frame look carved.",
    theChase: "Chase shoulder-line width, upper-chest detail, back sweep, a controlled waist, and proportion that photographs from every angle.",
    weeklyEngine: "Hypertrophy 5x with upper-frame priority, conditioning 3x, mobility / posture 4x, weekly check-in.",
    outcomeVision: "Built to move toward the classic line: upper-frame detail, a wider shoulder line, back definition, and a controlled waist for a timeless, proportioned shape.",
    visibleTrendTargets: ["upper-frame detail", "shoulder line / delt width", "back definition", "waistline control markers", "upper-chest shelf development", "balanced proportion"],
    weeklyTrainingBias: "Hypertrophy specialization that prioritizes the upper-frame weak points while the full physique keeps progressing and the waist stays controlled.",
    activityCompatibility: "Pilates supports posture, bracing, and waist control directly. Yoga aids recovery and mobility. Keep heavy sport away from upper-frame recovery on specialization days.",
    nutritionBias: {
      intent: "lean-gain",
      summary: "Controlled lean gain or recomp — protein anchored with calories matched to building the upper frame without softening the waistline.",
      points: ["Protein anchored across the day", "Carbs supported around upper-frame priority sessions", "Calories matched to a controlled lean-gain trend", "Waistline control stays a priority — no aggressive surplus", "Recovery meals after the hardest specialization days"],
    },
    recoveryDemand: "High — 5–6 days with weak-point specialization. Recovery consistency protects the priority tissue.",
    bestFor: "Building classic proportion and upper-frame detail over a longer block.",
    notBestFor: "Members who only want fast fat loss — this is a shape-and-proportion build.",
    weeklyStructure: ["5 hypertrophy sessions with upper-frame priority", "3 conditioning exposures", "4 mobility / posture touchpoints", "Weekly photo + measurement check-in"],
  },
  "championship-physique": {
    builtFor: "Advanced members with premium gym access and the recovery to carry a peak-output structure.",
    desireHook: "For the member who wants to walk into any room looking like the most disciplined, complete physique in it.",
    theChase: "Chase complete development, sharper conditioning, weak-point catch-up, and presentation-ready proportion across the whole frame.",
    weeklyEngine: "High-output training 6x with rotation + weak-point priority, conditioning 4x, mobility 4x, weekly photo discipline.",
    outcomeVision: "Built to move toward a complete, stage-ready physique — full development, sharp conditioning, and disciplined proportion across the whole frame.",
    visibleTrendTargets: ["complete full-body development", "sharper conditioning markers", "upper-frame and back detail", "waistline control", "weak-point catch-up trend", "peak presentation readiness"],
    weeklyTrainingBias: "High-output rotation with weak-point priority and movement variety, recovery placed deliberately so quality never slips at peak volume.",
    activityCompatibility: "Pilates and yoga support recovery, breath control, and posture between heavy days. Sport is optional and best kept light — peak training volume already owns the recovery budget.",
    nutritionBias: {
      intent: "recomp",
      summary: "High-adherence recomp — protein anchored with detailed structure and calories matched to the current phase direction.",
      points: ["Protein anchored at high adherence", "Carbs matched to high-output training days", "Calories matched to the current phase, not a single day", "Hydration and meal timing tightly organized", "Detailed weekly check-ins read the trend"],
    },
    recoveryDemand: "Very high — 6 training days plus conditioning. Strict sleep, hydration, and recovery management required.",
    bestFor: "Advanced members ready for the most demanding Reserve structure.",
    notBestFor: "Newer lifters or anyone with limited recovery — step into a hypertrophy or recomp block first.",
    weeklyStructure: ["6 training sessions with rotation + weak-point priority", "4 conditioning exposures", "4 mobility / recovery touchpoints", "Weekly photo + measurement discipline"],
  },
  "reserve-grand-touring": {
    builtFor: "Athletes who want meaningful muscular development without giving up endurance, conditioning, or movement capacity.",
    desireHook: "For the athlete who refuses to choose between the physique and the engine — a body that looks built and moves like it means it.",
    theChase: "Chase fuller physique development, longer distance capacity, sharper conditioning output, and a week that flexes around real life without losing its shape.",
    weeklyEngine: "Push / pull / lower physique work 4–6x, structured conditioning 1–2x, outdoor distance 1–2x, adaptive recovery, weekly check-in.",
    outcomeVision: "Built to move toward a complete hybrid: fuller muscular development alongside real distance capacity, conditioning, and movement quality — without either side eroding the other.",
    visibleTrendTargets: ["fuller muscular development", "improved distance capacity", "sharper conditioning output", "stronger working-set trends", "controlled body-composition markers", "sustained work capacity"],
    weeklyTrainingBias: "A physique floor — push, pull, and lower — with structured conditioning and outdoor distance woven around it. Reserve evaluates total training stress and lower-body interference before shaping the week.",
    activityCompatibility: "Outdoor distance and conditioning are part of the architecture, not add-ons. Group classes, sport, and studio work integrate through live schedule adjustment rather than disrupting the week.",
    nutritionBias: {
      intent: "high-output-hybrid",
      summary: "High-output hybrid fueling — protein anchored, carbs protected around both lifting and conditioning, hydration matched to distance load.",
      points: ["Protein anchored across the day", "Carbs protected around training and conditioning days", "Hydration and electrolytes matched to outdoor distance load", "Rest-day carbs eased while protein holds", "Fueling follows the session — the phase stays authoritative"],
    },
    recoveryDemand: "Moderate–high — combined lifting and distance load. Recovery adapts to the week's real stress, not a fixed template.",
    bestFor: "Intermediate to advanced athletes who want physique and performance in one coordinated system.",
    notBestFor: "Members who only want maximum size or only want to run — Grand Touring is deliberately both.",
    weeklyStructure: ["4–6 gym sessions — push / pull / lower physique work", "1–2 structured conditioning sessions", "1–2 outdoor or performance sessions", "Adaptive recovery matched to weekly load"],
  },
  "high-performance-hypertrophy": {
    builtFor: "Members who want methodical muscle gain with progression and plateau prevention.",
    desireHook: "For the member who wants to watch the muscle build steadily and the numbers climb without ever stalling out.",
    theChase: "Chase fuller working muscles, stronger anchor lifts, climbing exposure numbers, and progress that refuses to plateau.",
    weeklyEngine: "Progressive-overload training 5x, conditioning 2x, mobility 3x, bi-weekly check-in.",
    outcomeVision: "Designed to support steady, methodical muscle gain — fuller working muscles, stronger output, and continuous progress without stalling.",
    visibleTrendTargets: ["fuller muscle development", "stronger working-set output", "improved progression on anchor lifts", "balanced full-body shape", "reduced plateau stalls", "consistent exposure progress"],
    weeklyTrainingBias: "Progressive overload with exposure tracking and smart movement rotations that keep output climbing and prevent plateaus.",
    activityCompatibility: "Pilates and yoga support mobility and recovery. Recreational sport adds conditioning load — keep heavy sport clear of leg days so progression stays clean.",
    nutritionBias: {
      intent: "lean-gain",
      summary: "Lean gain — protein anchored with performance meals and calories matched to supporting progression.",
      points: ["Protein anchored to support muscle gain", "Carbs supported around training for output", "Calories matched to a controlled lean-gain trend", "Performance meals keep adherence simple", "Hydration consistent for training quality"],
    },
    recoveryDemand: "Moderate–high — 5 days with progression. Recovery weighting increases as load climbs.",
    bestFor: "Methodical muscle gain with progression tracking over a longer block.",
    notBestFor: "Members who need a fast, deadline-driven lean-out — this is a build.",
    weeklyStructure: ["5 progressive-overload sessions", "2 conditioning exposures", "3 mobility / recovery touchpoints", "Bi-weekly check-in cadence"],
  },
  "lean-bulk-command": {
    builtFor: "Members who want to add size while keeping conditioning and avoiding sloppy fat gain.",
    desireHook: "For the member who wants to add real size and still see their abs in the morning.",
    theChase: "Chase fuller muscle bellies, stronger lifts, a controlled scale trend, and conditioning that holds while you grow.",
    weeklyEngine: "Hypertrophy + overload 5x, conditioning 2x, mobility 3x, scale + waist watched together, bi-weekly check-in.",
    outcomeVision: "Built to move toward controlled new size — fuller muscle bellies and stronger lifts while conditioning stays intact.",
    visibleTrendTargets: ["controlled size-gain trend", "fuller muscle development", "stronger anchor-lift output", "retained conditioning", "balanced upper / lower growth", "steady scale trend without softening"],
    weeklyTrainingBias: "Hypertrophy plus progressive overload on the anchor lifts, with recovery protected so the surplus turns into quality size.",
    activityCompatibility: "Pilates and yoga support mobility and posture. Keep sport conditioning moderate — too much output works against the surplus that drives the gain.",
    nutritionBias: {
      intent: "lean-gain",
      summary: "Controlled surplus — protein anchored with calories nudged up just enough to add size while controlling fat gain.",
      points: ["Protein anchored across the day", "Controlled calorie surplus — not a dirty bulk", "Carbs supported around training", "Scale and waist trend watched together", "Recovery meals after the heaviest sessions"],
    },
    recoveryDemand: "Moderate–high — 5 days with overload. Sleep and recovery reserve drive the gain.",
    bestFor: "Adding size without losing condition.",
    notBestFor: "Members who want to lean out for a near-term date.",
    weeklyStructure: ["5 hypertrophy + overload sessions", "2 conditioning exposures to hold condition", "3 mobility / recovery touchpoints", "Bi-weekly check-in cadence"],
  },
  "recomp-protocol": {
    builtFor: "Members who want to build muscle and tighten composition at the same time.",
    desireHook: "For the member who wants the scale to barely move while the mirror completely changes.",
    theChase: "Chase muscle up and waist down at once — fuller shape, sharper conditioning, and measurements that shift while the scale stays steady.",
    weeklyEngine: "Hypertrophy 4x, conditioning 3x, mobility 3x, weekly composition check-in.",
    outcomeVision: "Designed to support recomposition — fuller muscle shape while the waistline tightens and conditioning sharpens together.",
    visibleTrendTargets: ["recomposition trend (muscle up, waist down)", "sharper waistline markers", "fuller muscle shape", "stable scale with changing measurements", "improved conditioning", "stronger output"],
    weeklyTrainingBias: "Hypertrophy with a protein anchor and controlled calories, conditioning placed where it doesn't steal recovery from the build.",
    activityCompatibility: "Pilates and yoga support core, posture, and recovery. Recreational sport is welcome as conditioning — keep it from crushing recovery on training days.",
    nutritionBias: {
      intent: "recomp",
      summary: "Recomp — protein anchored with controlled calories so muscle builds while composition tightens.",
      points: ["Protein anchored at every meal", "Calories controlled — neither aggressive surplus nor crash", "Carbs supported around training", "Composition trend read weekly, not daily", "Hydration consistent across the week"],
    },
    recoveryDemand: "Moderate — 4 days with conditioning. Recovery consistency carries the recomposition.",
    bestFor: "Building and tightening at the same time.",
    notBestFor: "Members who want the fastest possible scale change in either direction.",
    weeklyStructure: ["4 hypertrophy sessions", "3 conditioning exposures", "3 mobility / recovery touchpoints", "Weekly composition check-in"],
  },
  "at-home-warrior": {
    builtFor: "Members training at home with dumbbells, bodyweight, and bands who still want real progress.",
    desireHook: "For the member who wants a physique that proves you never needed the fancy gym.",
    theChase: "Chase fuller muscle on home equipment, stronger unilateral control, better tempo and density, and steady proof the work is paying off.",
    weeklyEngine: "Home strength 4x (dumbbell / bodyweight / band), conditioning 3x, mobility 3x, weekly check-in.",
    outcomeVision: "Built to move toward a stronger, more complete physique on home equipment — fuller muscle, better control, and steady progress without a gym.",
    visibleTrendTargets: ["fuller muscle development at home", "stronger unilateral control", "improved tempo and density output", "balanced full-body shape", "consistent training adherence", "steady progress trend"],
    weeklyTrainingBias: "Unilateral work, tempo, and density blocks engineered for home equipment, progressing through reps, load, and time-under-tension.",
    activityCompatibility: "Pilates and yoga pair naturally with home training for core, mobility, and recovery. Sport adds conditioning — easy to fit around a 4-day home week.",
    nutritionBias: {
      intent: "recomp",
      summary: "Simple recomp — protein anchored with an easy, repeatable meal rhythm that supports steady progress.",
      points: ["Protein anchored across the day", "Simple, repeatable meals carry adherence", "Carbs supported around training", "Calories matched to a steady-progress trend", "Hydration kept consistent"],
    },
    recoveryDemand: "Moderate — 4 days, simple recovery rhythm. Accessible and sustainable.",
    bestFor: "Real progress with limited home equipment.",
    notBestFor: "Members with full gym access chasing maximum machine-driven volume.",
    weeklyStructure: ["4 home strength sessions (dumbbell / bodyweight / band)", "3 conditioning exposures", "3 mobility / recovery touchpoints", "Weekly check-in"],
  },
  "premium-gym-operator": {
    builtFor: "Members training at a luxury / high-performance gym who want to exploit premium equipment.",
    desireHook: "For the member who wants to walk past every machine on the floor and use the ones that actually build the look.",
    theChase: "Chase weak-point catch-up, fuller detailed development, stronger machine-driven output, and proportion from precise tissue targeting.",
    weeklyEngine: "Premium-machine training 5x with weak-point priority, conditioning 3x, mobility 3x, weekly check-in.",
    outcomeVision: "Built to move toward complete, detailed development — using premium plate-loaded and specialty machines to drive weak-point catch-up and full-physique shape.",
    visibleTrendTargets: ["weak-point catch-up trend", "fuller, more detailed development", "stronger machine-driven output", "balanced proportion", "improved upper-frame and leg detail", "consistent progression"],
    weeklyTrainingBias: "Premium plate-loaded and specialty-machine selection with weak-point specialization and movement variety for precise tissue targeting.",
    activityCompatibility: "Pilates and yoga support recovery, posture, and mobility. Keep sport moderate so specialization volume keeps its recovery budget.",
    nutritionBias: {
      intent: "lean-gain",
      summary: "Performance lean gain — protein anchored with calories matched to supporting high-quality machine volume.",
      points: ["Protein anchored across the day", "Carbs supported around specialization sessions", "Calories matched to a controlled lean-gain trend", "Hydration consistent for training quality", "Recovery meals after the heaviest days"],
    },
    recoveryDemand: "High — 5 days with specialization. Recovery management keeps quality high.",
    bestFor: "Members with premium equipment who want to use all of it.",
    notBestFor: "Home or minimal-equipment members — the value is in the machine selection.",
    weeklyStructure: ["5 premium-machine sessions with weak-point priority", "3 conditioning exposures", "3 mobility / recovery touchpoints", "Weekly check-in"],
  },
  "glute-ascend": {
    builtFor: "Members who want glutes to lead while complete legs and the upper frame stay balanced.",
    desireHook: "For the member who wants glutes to lead the physique while hamstrings, quads, calves, core, and upper frame stay balanced.",
    outcomeVision: "Built to move toward stronger lower-body shape, fuller glute trends, hamstring detail, quad support, calf detail, posture, and sharper waistline markers.",
    theChase: "Chase hip-extension output, lockout control, consistent pump and detail days, and progress photos that show trained lower-body shape from every angle.",
    visibleTrendTargets: ["fuller glute trend", "hip-extension output", "hamstring detail", "quad support", "calf detail", "waistline control markers"],
    weeklyEngine: "Glutes 3x · hamstrings 2x · quads 2x · calves 2x · upper frame 2x · core 3–4x · conditioning 2x · recovery protected.",
    weeklyTrainingBias: "One glute-strength day, one glute-and-hamstring shape day, and one glute detail exposure with complete-leg support.",
    activityCompatibility: "Fits Gym Only, Gym + Pilates, Gym + Yoga, and hybrid weeks; outside activity reduces unnecessary accessory fatigue.",
    nutritionBias: { intent: "lean-gain", summary: "Lean gain or recomp bias with protein anchored and carbs protected around lower-body sessions.", points: ["Protein anchored", "Lower-body carbs protected", "Aggressive deficit blocked unless fat loss is explicit", "Rest-day structure stays controlled"] },
    recoveryDemand: "High — three lower-body exposures require protected sleep and managed outside activity.",
    bestFor: "Glute-priority members who still want complete legs and full-body balance.", notBestFor: "Members seeking an upper-body-led build or a low-frequency training week.",
    weeklyStructure: ["Glute strength + hamstrings + core", "Upper frame + posture", "Quads + calves + conditioning", "Recovery layer", "Glute / hamstring shape + core", "Glute detail + upper finish + cardio", "Reset"],
  },
  "glute-crown": {
    builtFor: "Members who want maximum glute priority while keeping the full body balanced.", desireHook: "For the member who wants the glute work to feel unmistakably high-priority.",
    outcomeVision: "Built to move toward consistent glute exposure, hamstring support, refined lower-body detail, and a balanced upper frame.", theChase: "Chase stronger lockout control, pump quality, detail-day consistency, and fewer lower-back takeover cues.",
    visibleTrendTargets: ["glute exposure consistency", "pump quality", "lockout control", "hamstring support", "lower-back takeover cues", "full-body balance"],
    weeklyEngine: "Glutes 3x minimum · hamstrings 2x · quads 2x · calves 2x · upper frame 2x · core 3–4x · conditioning 2x.", weeklyTrainingBias: "A heavy glute day, a glute-and-hamstring day, and a pump/detail day lead the rotation.",
    activityCompatibility: "Pilates and yoga support core, posture, and recovery; high-output sport is placed clear of priority lower days.", nutritionBias: { intent: "lean-gain", summary: "Lean gain or recomp bias with lower-body fuel protected.", points: ["Protein anchored", "Glute-day carbs protected", "Aggressive deficit blocked when glute development leads", "Recovery-day meals stay structured"] },
    recoveryDemand: "High — priority volume is serious and must remain recoverable.", bestFor: "Experienced members ready for three deliberate glute exposures.", notBestFor: "Members needing a low-volume or minimal-equipment week.", weeklyStructure: ["Heavy glute strength", "Upper sculpt", "Quads + calves", "Recovery layer", "Glute / hamstring shape", "Glute detail + back line", "Reset"],
  },
  "sculpted-legs": {
    builtFor: "Members who want complete legs rather than a one-dimensional lower-body plan.", desireHook: "For the member chasing quad sweep, hamstring shape, calf detail, and complete lower-body balance.",
    outcomeVision: "Built to move toward sculpted legs with glute support, balanced upper-frame detail, and controlled conditioning.", theChase: "Chase cleaner quad output, hamstring shape, calf consistency, leg endurance, and balanced lower-body photos.",
    visibleTrendTargets: ["quad sweep", "hamstring shape", "calf detail", "complete-leg balance", "leg endurance", "glute support"], weeklyEngine: "Quads 2x · hamstrings 2x · glutes 3x · calves 2x · upper frame 2x · core 3–4x · conditioning 2x.",
    weeklyTrainingBias: "Quad strength, hamstring shape, glute support, calves, and a complete-leg volume exposure.", activityCompatibility: "Pilates and yoga support posture and mobility; sport load trims redundant leg volume.",
    nutritionBias: { intent: "recomp", summary: "Recomp or lean-gain bias with leg-day carbs protected.", points: ["Protein anchored", "Leg-day carbs protected", "Fuel supports quad and hamstring output", "Rest-day structure matches the goal"] }, recoveryDemand: "Moderate–high — complete-leg volume needs deliberate spacing.",
    bestFor: "Members who want quads, hamstrings, glutes, and calves trained as one complete system.", notBestFor: "Members seeking glutes-only specialization.", weeklyStructure: ["Quad strength + calves + core", "Upper frame", "Glute / hamstring shape + conditioning", "Recovery layer", "Complete legs volume", "Glute detail + shoulders + core", "Reset"],
  },
  "runway-shape": {
    builtFor: "Members chasing a polished feminine athletic look with posture and waistline control.", desireHook: "For the member who wants elegant strength, lower-body shape, and a frame that looks composed from every angle.",
    outcomeVision: "Built to move toward a polished physique with lower-body shape, a sharper waistline, shoulder and back definition, and stronger posture.", theChase: "Chase waistline markers, posture, shoulder and back line, glute detail, and controlled conditioning.",
    visibleTrendTargets: ["waistline markers", "posture", "shoulder line", "back definition", "glute detail", "conditioning consistency"], weeklyEngine: "Glutes 3x · quads 2x · hamstrings 2x · calves 2x · upper frame 2x · core 4x · conditioning 2x.",
    weeklyTrainingBias: "Lower-body shape, back line, shoulders, core control, and moderate conditioning with less fatigue than Crown.", activityCompatibility: "Pilates is a strong fit for posture and core; yoga supports mobility; sport load trims extra conditioning.",
    nutritionBias: { intent: "recomp", summary: "Recomp or controlled-cut bias with protein anchored and carbs timed around leg days.", points: ["Protein anchored", "Leg-day carbs protected", "Bulk-style direction blocked when waistline control leads", "Rest days stay structured"] }, recoveryDemand: "Moderate — enough work to shape the week without burying recovery.",
    bestFor: "Members prioritizing posture, waistline control, lower-body shape, and upper-frame detail.", notBestFor: "Members chasing maximum lower-body volume.", weeklyStructure: ["Glute strength + waist control", "Back line + shoulders + core", "Quads + calves + conditioning", "Pilates / mobility", "Glute / hamstring shape", "Upper frame + glute detail + cardio", "Reset"],
  },
  "vacation-physique": {
    builtFor: "Members who want a sharper visual direction on a busy, lifestyle-friendly week.", desireHook: "For the member chasing poolside confidence, polished vacation photos, and a routine that still fits real life.",
    outcomeVision: "Built to move toward a confident summer physique with lower-body detail, an upper-frame finish, waistline control, and manageable fatigue.", theChase: "Chase waistline trends, glute and leg detail, upper-body finish, and conditioning consistency.",
    visibleTrendTargets: ["waistline trend", "glute detail", "leg detail", "upper-body finish", "conditioning consistency", "manageable fatigue"], weeklyEngine: "Five focused training days · glutes 3x · hamstrings 2x · quads 2x · calves 2x · upper frame 2x · core 4x · conditioning 2x · two recovery layers.",
    weeklyTrainingBias: "Efficient lower-body detail, a controlled hamstring-and-calf exposure, upper-body finish, core, and conditioning with recovery protected.", activityCompatibility: "Pilates, yoga, and steps fit the lighter days; outside activity replaces redundant conditioning.",
    nutritionBias: { intent: "cut", summary: "Controlled cut or recomp bias with protein anchored and tighter rest-day structure.", points: ["Protein anchored", "Training-day carbs timed", "Bulk-style calories blocked", "Rest days stay tighter without underfueling"] }, recoveryDemand: "Moderate — five focused days with two protected recovery layers and controlled accessory volume.",
    bestFor: "Busy members with a summer-lean or vacation direction.", notBestFor: "Members chasing maximum weekly volume.", weeklyStructure: ["Glute strength + core", "Shoulders + back line", "Recovery + steps", "Quads + calves", "Upper finish + core", "Glute / hamstring detail + calves", "Reset"],
  },
  "athletic-model": {
    builtFor: "Members who want a physique that performs and photographs well.", desireHook: "For the member who wants to look athletic because the body is trained to be athletic.", outcomeVision: "Built to move toward an athletic lower frame, shoulder and back detail, consistent core bracing, and stronger work capacity.",
    theChase: "Chase work capacity, conditioning output, lower-body strength, upper-frame detail, and core consistency.", visibleTrendTargets: ["work capacity", "conditioning output", "lower-body strength", "back detail", "shoulder detail", "core consistency"],
    weeklyEngine: "Lower body 3x · upper frame 2x · core 3–4x · conditioning 2x · mobility and recovery protected.", weeklyTrainingBias: "Lower strength, athletic upper-frame work, conditioning, core bracing, and performance finishers.", activityCompatibility: "Sport fits directly; Pilates and yoga support mobility. Heavy sport load reduces redundant gym conditioning.",
    nutritionBias: { intent: "high-output-hybrid", summary: "Performance recomp with carbs matched to conditioning and high-output days.", points: ["Protein anchored", "High-output carbs protected", "Sport load included", "Recovery-day structure remains adequate"] }, recoveryDemand: "High — work capacity and conditioning demand honest recovery management.",
    bestFor: "Members balancing physique direction with athletic output.", notBestFor: "Members seeking a low-output shape-only week.", weeklyStructure: ["Lower strength", "Upper athletic frame + core", "Quads + conditioning", "Mobility", "Lower volume", "Full-body athletic finish", "Reset"],
  },
  "signature-shape": {
    builtFor: "Members who want a balanced feminine physique foundation.", desireHook: "For the member who wants every part of the week to look intentional, polished, and complete.", outcomeVision: "Built to move toward balanced lower-body shape, an elegant upper frame, consistent core work, posture, and conditioning rhythm.",
    theChase: "Chase balanced weekly coverage, posture, lower-body shape, core consistency, and sustainable output.", visibleTrendTargets: ["lower-body shape", "upper-frame balance", "core consistency", "posture", "conditioning rhythm", "recovery consistency"],
    weeklyEngine: "Lower body 3x · upper frame 2x · core 3–4x · conditioning 2x · two recovery layers.", weeklyTrainingBias: "A balanced foundation spanning lower-body shape, upper-frame detail, core, and conditioning.", activityCompatibility: "Compatible with gym-only or hybrid weeks; outside activity trims redundant volume.",
    nutritionBias: { intent: "recomp", summary: "Recomp bias with protein anchored and day-type fuel matched to the active session.", points: ["Protein anchored", "Training-day carbs matched", "Rest-day structure controlled", "No invented macros without body data"] }, recoveryDemand: "Moderate — complete but sustainable.",
    bestFor: "Members building a complete foundation before specialization.", notBestFor: "Members ready for maximum single-muscle specialization.", weeklyStructure: ["Lower strength + core", "Upper frame", "Complete legs + conditioning", "Recovery", "Lower shape", "Upper detail + core", "Reset"],
  },
  "hybrid-pilates-shape": {
    builtFor: "Members combining gym strength with Pilates-style posture, core, and mobility.", desireHook: "For the member who wants strength to feel elegant, controlled, and beautifully aligned.", outcomeVision: "Built to move toward lower-body shape, core control, posture, shoulder line, and mobility consistency with lower fatigue.",
    theChase: "Chase cleaner core control, posture, glute detail, shoulder line, and mobility consistency.", visibleTrendTargets: ["core control", "posture", "glute detail", "shoulder line", "mobility consistency", "waistline markers"],
    weeklyEngine: "Four gym sessions plus one low-fatigue Pilates / upper-detail day · lower body 3x · upper frame 2x · core 4x · conditioning 2x · hybrid activity 2x · recovery / mobility layers 3x.", weeklyTrainingBias: "Gym lower-body work blended with Pilates, posture, core, upper-frame detail, steps, and low-fatigue accessory work.", activityCompatibility: "Built specifically for Gym + Pilates, Pilates + Yoga, and full hybrid weeks.",
    nutritionBias: { intent: "recomp", summary: "Recomp or controlled-cut bias with carbs around gym days and tighter recovery days without underfueling.", points: ["Protein anchored", "Gym-day carbs protected", "Pilates load recognized", "Recovery days stay adequately fueled"] }, recoveryDemand: "Moderate–low — outside activity is counted instead of ignored.",
    bestFor: "Members who value posture, control, mobility, and lower-fatigue shape work.", notBestFor: "Members seeking maximum gym volume.", weeklyStructure: ["Glute strength + core", "Pilates shape + posture", "Quads + calves", "Upper frame", "Glute / hamstring shape", "Pilates + upper detail + steps", "Reset"],
  },
  "sport-strength-shape": {
    builtFor: "Members whose strength plan must account for sport and conditioning load.", desireHook: "For the member who wants strong, sport-ready legs and a balanced physique without training collisions.", outcomeVision: "Built to move toward lower-body strength, recovery-managed conditioning, back and shoulder detail, and sport-ready core control.",
    theChase: "Chase conditioning consistency, lower-body strength, recovery management, upper-frame detail, and core bracing.", visibleTrendTargets: ["conditioning consistency", "lower-body strength", "recovery management", "back detail", "shoulder detail", "core bracing"],
    weeklyEngine: "Strength 3x · sport / conditioning 3x · lower body 3x · upper frame 2x · core 4x · recovery / mobility layers 3x · sport exposures 2x.", weeklyTrainingBias: "Strength organized around sport fatigue, with a controlled upper-frame finish, core and mobility preserved, and hard legs kept clear of sport days.", activityCompatibility: "Built for Gym + Sports and Gym + Pilates + Sports; sport counts as conditioning and leg load.",
    nutritionBias: { intent: "high-output-hybrid", summary: "High-output hybrid support with carbs protected around sport and training days.", points: ["Protein anchored", "Sport-day carbs protected", "Combined activity load counted", "Recovery warnings surface when load is high"] }, recoveryDemand: "High — sport and strength load are managed together.",
    bestFor: "Members balancing sport with serious strength and physique work.", notBestFor: "Members who do not need sport-load adaptation.", weeklyStructure: ["Lower strength + core", "Upper frame", "Sport + mobility", "Glute / hamstring shape", "Quads + calves + upper finish", "Sport + core", "Recovery"],
  },
  "vacation-countdown": {
    builtFor: "Members with a specific trip or date within about three months who want to tighten the routine.",
    desireHook: "For the member who wants to step off the plane already looking like the trip was worth it.",
    theChase: "Chase a tighter waistline, sharper conditioning, an upper-body finish, and a countdown that visibly works as the date approaches.",
    weeklyEngine: "Efficient training 5x, conditioning 4x toward the date, mobility 2x, weekly check-in counting down.",
    outcomeVision: "Built to move toward a tighter, vacation-ready shape by your date — sharper conditioning, a controlled waistline, and poolside confidence.",
    visibleTrendTargets: ["vacation-physique readiness", "sharper waistline markers", "improved conditioning output", "leaner overall trend", "upper-body finish", "manageable, sustainable fatigue"],
    weeklyTrainingBias: "Efficient hypertrophy plus conditioning, organized around the deadline with recovery protected so the look sharpens on schedule.",
    activityCompatibility: "Pilates and yoga support core, posture, and recovery. Sport is fine as conditioning — keep high-output sport clear of the hardest sessions near the date.",
    nutritionBias: {
      intent: "cut",
      summary: "Controlled cut or recomp — higher protein with smart carbs around training and a lighter rest-day structure.",
      points: ["Higher protein to protect muscle", "Smart carbs placed around training", "Lower-calorie rest-day structure", "Hydration and sodium consistency", "No bulk-style meal plan while a lean goal is active"],
    },
    recoveryDemand: "Moderate–high — 4–6 days near the date. Sleep and hydration protect the finish.",
    bestFor: "A short, deadline-driven tightening before a trip.",
    notBestFor: "Members with no date who want a long build — this is timeline-driven.",
    weeklyStructure: ["5 efficient sessions", "4 conditioning exposures toward the date", "2 mobility / recovery touchpoints", "Weekly check-in counting down"],
  },
  "lifestyle-reset": {
    builtFor: "Members rebuilding structure, sleep, meals, and consistency after a break.",
    desireHook: "For the member who wants to feel in control of their body and routine again — and actually keep it this time.",
    theChase: "Chase a consistency streak, better sleep, a steadier meal rhythm, returning strength, and momentum you can feel building.",
    weeklyEngine: "Sustainable strength 3x, conditioning 3x, mobility 4x, weekly check-in.",
    outcomeVision: "Designed to support a sustainable return to form — rebuilt consistency, better sleep and meal rhythm, and steady momentum back toward your shape.",
    visibleTrendTargets: ["consistency and adherence trend", "improved sleep rhythm", "steadier meal rhythm", "returning strength and output", "improved daily energy", "sustainable momentum"],
    weeklyTrainingBias: "A sustainable strength-and-recovery rhythm with recovery as the lead system while consistency rebuilds.",
    activityCompatibility: "Pilates and yoga are ideal here — low-fatigue movement, mobility, and stress management support the reset. Light sport adds enjoyable activity without overloading recovery.",
    nutritionBias: {
      intent: "performance-maintenance",
      summary: "Performance maintenance — a simple, repeatable meal rhythm that supports energy and consistency, not an aggressive phase.",
      points: ["Protein anchored for simplicity", "A simple, repeatable meal rhythm", "Hydration and meal timing rebuilt first", "No aggressive deficit or surplus while resetting", "Consistency valued over precision"],
    },
    recoveryDemand: "Low–moderate — 3–4 days with recovery as the priority. Accessible and sustainable.",
    bestFor: "Rebuilding momentum after time away.",
    notBestFor: "Advanced members ready for high-output specialization — start with a build instead.",
    weeklyStructure: ["3 sustainable strength sessions", "3 conditioning exposures", "4 mobility / recovery touchpoints", "Weekly check-in"],
  },
  "enhanced-logbook": {
    builtFor: "Advanced members who need cleaner organization for self-directed tracking.",
    desireHook: "For the member who already drives their own plan and just wants it organized at a level that matches the effort.",
    theChase: "Chase clean records, a visible adherence trend, organized inventory and schedules, and self-review that's actually clear.",
    weeklyEngine: "Member-defined — Reserve organizes everything you log, on your own cadence.",
    outcomeVision: "Built to keep your own training, nutrition, and records cleanly organized for review — Reserve organizes, you direct.",
    visibleTrendTargets: ["organized training records", "adherence trend visibility", "inventory and schedule clarity", "cleaner self-review", "consistent logging", "member-defined progress markers"],
    weeklyTrainingBias: "Member-defined — Reserve organizes your logged work and does not prescribe or generate sessions.",
    activityCompatibility: "Log any activity you choose — Pilates, yoga, sport, or gym. Reserve organizes the record; the structure stays yours.",
    nutritionBias: {
      intent: "performance-maintenance",
      summary: "Log-only — meal structure stays member-defined; Reserve organizes your entries and never prescribes.",
      points: ["Meal logging stays member-defined", "Reserve organizes, does not generate meal guidance", "Adherence and inventory kept visible", "No prescriptions, targets, or dosing", "Review with a clinician where relevant"],
    },
    recoveryDemand: "Member-defined — Reserve organizes recovery entries for your review.",
    bestFor: "Advanced members who want clean record-keeping without prescriptions.",
    notBestFor: "Members who want Reserve to build and drive the plan — choose a structured protocol instead.",
    weeklyStructure: ["Member-defined training, logged", "Member-defined conditioning, logged", "Member-defined recovery, logged", "Member-defined check-in cadence"],
  },
  "fertility-lifestyle": {
    builtFor: "Members who want lifestyle organization while trying to conceive.",
    desireHook: "For the member who wants this phase to feel organized, calm, and supported in their daily habits.",
    theChase: "Chase consistent meals and hydration, a steady sleep rhythm, recovery adherence, and organized habits to review with a clinician.",
    weeklyEngine: "Member-defined, sustainable movement with recovery and sleep prioritized.",
    outcomeVision: "Built to keep nutrition, hydration, sleep, and recovery cleanly organized through this phase — lifestyle support only, alongside your clinician.",
    visibleTrendTargets: ["meal and hydration consistency", "sleep rhythm", "recovery adherence", "sustainable lifestyle structure", "organized daily habits", "clinician-discussion readiness"],
    weeklyTrainingBias: "Sustainable, member-defined movement with recovery and sleep as the priority. No prescriptions.",
    activityCompatibility: "Pilates and yoga are gentle, supportive options for mobility, posture, and stress. Keep all activity comfortable and clinician-guided.",
    nutritionBias: {
      intent: "performance-maintenance",
      summary: "Lifestyle organization only — meal and hydration structure stays member-defined and clinician-guided.",
      points: ["Meal + hydration structure organized, not prescribed", "Sleep and recovery rhythm prioritized", "No medical, treatment, or supplement guidance", "Habits kept simple and sustainable", "Follow clinician guidance throughout"],
    },
    recoveryDemand: "Low — recovery and sleep lead. Lifestyle organization only.",
    bestFor: "Lifestyle organization during this phase.",
    notBestFor: "Members seeking a performance or transformation build right now.",
    weeklyStructure: ["Member-defined, sustainable movement", "Gentle conditioning as comfortable", "Recovery + sleep prioritized", "Member-defined check-in cadence"],
  },
  "pregnancy-lifestyle": {
    builtFor: "Members who want trimester-based lifestyle organization through pregnancy.",
    desireHook: "For the member who wants meals, hydration, and recovery organized gently, trimester by trimester.",
    theChase: "Chase consistent hydration, trimester-aware meal organization, a steady recovery rhythm, and clear habits to review with a clinician.",
    weeklyEngine: "Member-defined, clinician-guided movement with recovery and sleep prioritized.",
    outcomeVision: "Built to keep meal planning, hydration, recovery, and daily structure organized by trimester — lifestyle support only, always clinician-guided.",
    visibleTrendTargets: ["trimester-based meal organization", "hydration consistency", "recovery and sleep rhythm", "sustainable daily structure", "organized lifestyle habits", "clinician-discussion readiness"],
    weeklyTrainingBias: "Member-defined and clinician-guided. Recovery, sleep, and gentle structure lead. No prescriptions.",
    activityCompatibility: "Pilates and yoga (clinician-approved) can support comfort, posture, and breath. Keep everything gentle and clinician-guided.",
    nutritionBias: {
      intent: "performance-maintenance",
      summary: "Lifestyle organization only — trimester-based meal and hydration structure, member-defined and clinician-guided.",
      points: ["Meal planning + hydration organized by trimester", "Recovery and sleep prioritized", "No medical, treatment, or baby-health claims", "Habits kept gentle and sustainable", "Follow clinician guidance throughout"],
    },
    recoveryDemand: "Low — recovery, sleep, and comfort lead. Lifestyle organization only.",
    bestFor: "Lifestyle organization through pregnancy.",
    notBestFor: "Members seeking a performance or transformation build right now.",
    weeklyStructure: ["Member-defined, clinician-guided movement", "Gentle conditioning as comfortable", "Recovery + sleep prioritized", "Member-defined check-in cadence"],
  },
};

/** Read the product identity layer for a protocol id. */
export function protocolProduct(id: string | null | undefined): ProtocolProduct | null {
  if (!id) return null;
  return PROTOCOL_PRODUCTS[id] ?? null;
}

/** Read the fuel bias for an active protocol — Nutrition Command + Apex read this so
    nutrition never contradicts the training goal. Returns null when unknown. */
export function protocolNutritionBias(
  active: { protocolId: string } | null | undefined,
): ProtocolNutritionBias | null {
  const p = active ? PROTOCOL_PRODUCTS[active.protocolId] : null;
  return p?.nutritionBias ?? null;
}

/* ─── Phases ──────────────────────────────────────────────────────────── */
export type ProtocolPhase = { index: number; label: string; weekStart: number; weekEnd: number; focus: string };

export function buildPhases(durationWeeks: number): ProtocolPhase[] {
  if (durationWeeks <= 0) return [];
  const mk = (defs: Array<[string, string, number]>): ProtocolPhase[] => {
    // defs: [label, focus, weightFraction]; fractions are normalized to weeks.
    const totalW = defs.reduce((s, d) => s + d[2], 0);
    let week = 1;
    return defs.map((d, i) => {
      const span = i === defs.length - 1 ? durationWeeks - (week - 1) : Math.max(1, Math.round((d[2] / totalW) * durationWeeks));
      const start = week;
      const end = Math.min(durationWeeks, week + span - 1);
      week = end + 1;
      return { index: i, label: d[0], focus: d[1], weekStart: start, weekEnd: end };
    });
  };
  if (durationWeeks <= 8) return mk([["Setup", "Consistency + baseline", 1], ["Build", "Progression", 2], ["Finish", "Refinement", 1]]);
  if (durationWeeks <= 12) return mk([["Setup", "Setup + consistency", 2], ["Progression", "Progressive overload", 4], ["Intensification", "Push the hardest blocks", 4], ["Finish", "Finish + refinement", 2]]);
  if (durationWeeks <= 16) return mk([["Setup", "Setup + consistency", 2], ["Build", "Volume + progression", 6], ["Intensify", "Peak intensity", 5], ["Finish", "Finish + refinement", 3]]);
  return mk([["Foundation", "Base + consistency", 3], ["Build", "Volume + progression", 6], ["Specialize", "Weak-point specialization", 7], ["Refine", "Sharpen + intensify", 5], ["Maintain", "Hold + refine", 3]]);
}

/* ─── Active protocol state ───────────────────────────────────────────── */
export type ProtocolStatus = "not-started" | "active" | "paused" | "completed" | "needs-review";

export type ActiveProtocol = {
  protocolId: string;
  protocolName: string;
  category: ProtocolCategory;
  selectedDate: string;
  startDate: string;
  targetDate: string | null;
  durationWeeks: number;
  commitmentLevel: CommitmentLevel;
  trainingDays: number;
  cardioDays: number;
  mobilityDays: number;
  checkInCadence: string;
  nutritionFocus: string;
  recoveryFocus: string;
  goal: string;
  eventName: string | null;
  eventType: EventType | null;
  eventDate: string | null;
  status: ProtocolStatus;
  notes: string;
};

function todayISO(now: Date): string { return localDateKey(now); }
function addWeeks(iso: string, weeks: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + weeks * 7);
  return localDateKey(d);
}

export type ActivateOptions = { durationWeeks?: number; eventName?: string | null; eventType?: EventType | null; eventDate?: string | null; goalOverride?: string; now?: Date };

export function activateProtocol(def: ProtocolDefinition, opts: ActivateOptions = {}): ActiveProtocol {
  const now = opts.now ?? new Date();
  const start = todayISO(now);
  const duration = opts.durationWeeks ?? def.durationOptions[0] ?? 12;
  // If an event date is set, target that; otherwise target start + duration.
  const targetDate = opts.eventDate ?? (def.durationOptions.length ? addWeeks(start, duration) : null);
  return {
    protocolId: def.id, protocolName: def.name, category: def.category,
    selectedDate: start, startDate: start, targetDate, durationWeeks: duration,
    commitmentLevel: def.commitment, trainingDays: def.trainingDays, cardioDays: def.cardioDays,
    mobilityDays: def.mobilityDays, checkInCadence: def.checkInCadence,
    nutritionFocus: def.nutritionEmphasis, recoveryFocus: def.recoveryEmphasis,
    goal: opts.goalOverride ?? def.primaryGoal, eventName: opts.eventName ?? null, eventType: opts.eventType ?? null, eventDate: opts.eventDate ?? null,
    status: "active", notes: "",
  };
}

/* ─── Event / deadline planning ───────────────────────────────────────────
   Deterministic date math + urgency grading for the Personal Command deadline
   planner. No outcome guarantees — purely timeline-aware organization. */
export type EventType =
  | "vacation" | "wedding" | "photoshoot" | "birthday" | "beach-trip"
  | "competition" | "milestone" | "none";

export const EVENT_TYPE_LABEL: Record<EventType, string> = {
  vacation: "Vacation", wedding: "Wedding", photoshoot: "Photoshoot", birthday: "Birthday",
  "beach-trip": "Beach Trip", competition: "Competition / Event", milestone: "Personal Milestone", none: "No Deadline",
};

export type DeadlineUrgency = "none" | "comfortable" | "focused" | "tight" | "very-tight";

export const URGENCY_LABEL: Record<DeadlineUrgency, string> = {
  none: "No Deadline", comfortable: "Comfortable Runway", focused: "Focused Window",
  tight: "Tight Timeline", "very-tight": "Very Tight Timeline",
};

export type DeadlinePlan = {
  daysRemaining: number | null;
  weeksRemaining: number | null;
  urgency: DeadlineUrgency;
  urgencyLabel: string;
  /** Recommended protocol block length (weeks) that fits the runway, or null when open-ended. */
  recommendedLengthWeeks: number | null;
  /** Plain-language timeline note. No outcome promises. */
  note: string;
};

export function planDeadline(eventDateISO: string | null, now: Date = new Date()): DeadlinePlan {
  if (!eventDateISO) {
    return { daysRemaining: null, weeksRemaining: null, urgency: "none", urgencyLabel: URGENCY_LABEL.none, recommendedLengthWeeks: null, note: "Run this protocol without a deadline, or add a target date to make it timeline-aware." };
  }
  const days = daysBetween(todayISO(now), new Date(`${eventDateISO}T00:00:00`));
  const weeks = Math.max(0, Math.ceil(days / 7));
  if (days < 0) {
    return { daysRemaining: days, weeksRemaining: 0, urgency: "very-tight", urgencyLabel: "Date Passed", recommendedLengthWeeks: null, note: "That date has passed. Pick a new target date or run without a deadline." };
  }
  let urgency: DeadlineUrgency;
  if (weeks >= 16) urgency = "comfortable";
  else if (weeks >= 10) urgency = "focused";
  else if (weeks >= 5) urgency = "tight";
  else urgency = "very-tight";
  // Fit a standard block to the runway.
  const recommendedLengthWeeks = weeks >= 24 ? 24 : weeks >= 16 ? 16 : weeks >= 12 ? 12 : weeks >= 8 ? 8 : Math.max(1, weeks);
  const note = urgency === "comfortable"
    ? `${weeks} weeks out — comfortable runway for a full structured block.`
    : urgency === "focused"
      ? `${weeks} weeks out — a focused window. Reserve will prioritize consistency.`
      : urgency === "tight"
        ? `${weeks} weeks out — tight timeline. Reserve will prioritize adherence and realistic execution.`
        : `${weeks} weeks out — very tight. Reserve will prioritize consistency over aggressive targets.`;
  return { daysRemaining: days, weeksRemaining: weeks, urgency, urgencyLabel: URGENCY_LABEL[urgency], recommendedLengthWeeks, note };
}

/* ─── Progress ────────────────────────────────────────────────────────── */
export type ProtocolPace = "ahead" | "on-pace" | "short-timeline" | "no-deadline";

export type ProtocolProgress = {
  currentWeek: number;
  totalWeeks: number;
  phase: ProtocolPhase | null;
  phases: ProtocolPhase[];
  daysToTarget: number | null;
  weeksRemaining: number | null;
  percentComplete: number;
  timelineLabel: string;
  pace: ProtocolPace;
};

function daysBetween(fromISO: string, now: Date): number {
  const from = new Date(`${fromISO}T00:00:00`).getTime();
  const cur = new Date(localDateKey(now) + "T00:00:00").getTime();
  return Math.round((cur - from) / 86_400_000);
}

export function computeProtocolProgress(active: ActiveProtocol, now: Date = new Date()): ProtocolProgress {
  const phases = buildPhases(active.durationWeeks);
  const elapsedDays = Math.max(0, daysBetween(active.startDate, now));
  const totalWeeks = active.durationWeeks || 0;
  const currentWeek = totalWeeks > 0 ? Math.min(totalWeeks, Math.floor(elapsedDays / 7) + 1) : Math.floor(elapsedDays / 7) + 1;
  const phase = phases.find((p) => currentWeek >= p.weekStart && currentWeek <= p.weekEnd) ?? phases[phases.length - 1] ?? null;

  const targetISO = active.eventDate ?? active.targetDate;
  const daysToTarget = targetISO ? -daysBetween(targetISO, now) : null;
  const weeksRemaining = daysToTarget != null ? Math.max(0, Math.ceil(daysToTarget / 7)) : null;
  const percentComplete = totalWeeks > 0 ? Math.min(100, Math.round(((currentWeek - 1) / totalWeeks) * 100)) : 0;

  let pace: ProtocolPace = "no-deadline";
  if (daysToTarget != null) {
    if (daysToTarget <= 0) pace = "short-timeline";
    else if (totalWeeks > 0 && daysToTarget < totalWeeks * 7 * 0.5) pace = "short-timeline";
    else pace = "on-pace";
  }

  const timelineLabel = active.eventName && daysToTarget != null
    ? `${active.eventName} · ${Math.max(0, daysToTarget)} days`
    : daysToTarget != null
      ? `Target · ${Math.max(0, daysToTarget)} days`
      : totalWeeks > 0 ? `Week ${currentWeek} / ${totalWeeks}` : "Ongoing";

  return { currentWeek, totalWeeks, phase, phases, daysToTarget, weeksRemaining, percentComplete, timelineLabel, pace };
}

/* ─── Recommendation engine ───────────────────────────────────────────── */
export type ProtocolRecoInput = CapacityInput & {
  goal: string;
  daysToDeadline: number | null;
  gymEnvironment: GymEnvironment;
  trainingLevel: TrainingLevel;
  genderIdentity?: string;
  hasWeakPoints: boolean;
  womensPath: boolean;
};

function envFit(def: ProtocolDefinition, env: GymEnvironment): number {
  const home = ["dumbbell-home", "home-gym", "minimal-travel"].includes(env);
  const premium = env === "luxury-premium";
  if (def.gymFit === "any") return 1;
  if (def.gymFit === "home") return home ? 3 : -2;
  if (def.gymFit === "premium") return premium ? 3 : env === "commercial-performance" ? 1 : -1;
  if (def.gymFit === "commercial") return home ? -1 : 1;
  return 0;
}

/* ─── Goal lanes — shared vocabulary both genders use ─────────────────────
   A goal can match more than one lane; scoring is additive, so a layered goal
   ("lean sculpted glutes") simply surfaces the protocol that fits most lanes. */
export type GoalLanes = {
  cut: boolean;
  bulk: boolean;
  recomp: boolean;
  classic: boolean;
  athletic: boolean;
  conditioning: boolean;
  glutes: boolean;
  runway: boolean;
  pilates: boolean;
  /** Explicit studio modality (Pilates / yoga / barre) — leads its own lane so a
   *  named modality outranks general "lean / toned" runway language. */
  studio: boolean;
};

function detectGoalLanes(g: string): GoalLanes {
  return {
    cut: /cut|shred|lean[\s-]?out|fat\b|fat loss|get lean|definition|defined/.test(g),
    bulk: /bulk|size|mass|gain|grow/.test(g),
    recomp: /recomp|recompos|body recomp/.test(g),
    classic: /classic|proportion|aesthetic|v[\s-]?taper|symmetry|physique|chest|back|arms|delts|upper/.test(g),
    athletic: /athlet|perform|strength|power|sport|functional|output|hybrid/.test(g),
    conditioning: /conditioning|combat|work capacity|capacity|engine|endurance|cardio/.test(g),
    glutes: /glute|booty|curv|hourglass|round|posterior|lower body/.test(g),
    runway: /runway|stage|bikini|sculpt|lean|vacation|beach|slim|toned|tone\b|waist/.test(g),
    pilates: /pilates|yoga|barre|mobility|posture|low[\s-]?impact|longevity|core/.test(g),
    studio: /pilates|yoga|barre/.test(g),
  };
}

/** Goal bonus for a women's-performance protocol, by its physique track, so the
 *  member's stated goal selects the RIGHT female protocol (not just "a" female
 *  protocol). Signature is the balanced default when nothing else matches. */
function womensGoalBonus(track: WomensTrack | undefined, lanes: GoalLanes): number {
  switch (track) {
    case "glute-quad":      // Summit — leg-forward glute development
    case "glute-upper":     // Crown — glutes + upper-line emphasis
      return lanes.glutes ? 4 : 0;
    case "runway":          // Runway — lean, sculpted, stage-ready line
      return lanes.runway ? 4 : 0;
    case "lifestyle-shape": // Resort — efficient lean/event shape
      return lanes.runway ? 3 : 0;
    case "lean-recomp":     // Long Lines — complete-leg sculpt while leaning
      return lanes.runway || lanes.recomp ? 3 : 0;
    case "athletic-model":  // Off-Duty — strong, conditioned, athletic
    case "sport-strength":  // Field — performance + strength
      return lanes.athletic || lanes.conditioning ? 4 : 0;
    case "hybrid-pilates":  // Studio — pilates / tone / mobility
      return lanes.studio ? 5 : lanes.pilates ? 4 : 0;
    case "signature-shape": // Signature — balanced five-day foundation
      return lanes.pilates ? 2 : 1;
    default:
      return 0;
  }
}

/**
 * Score one protocol against the athlete input, returning the numeric score
 * AND the named factors that produced it (for explainability). Goal / gender /
 * environment / level terms are unchanged from the original recommender;
 * capacity terms (frequency, recovery, duration, weak-point specialization,
 * occupation, injury) are additive and contribute ZERO when their inputs are
 * absent — so callers that don't yet supply capacity data score identically.
 */
export function scoreProtocol(d: ProtocolDefinition, input: ProtocolRecoInput): { score: number; factors: ScoreFactor[] } {
  const g = (input.goal || "").toLowerCase();
  const lanes = detectGoalLanes(g);
  const levelRank: Record<TrainingLevel, number> = { beginner: 0, intermediate: 1, advanced: 2 };
  const female = input.womensPath || (input.genderIdentity || "").toLowerCase() === "female";
  const isWomens = d.category === "womens-performance";

  const factors: ScoreFactor[] = [];
  const push = (label: string, delta: number) => { if (delta !== 0) factors.push({ label, delta }); };

  push("Environment fit", envFit(d, input.gymEnvironment));

  if (input.daysToDeadline != null && input.daysToDeadline <= 120) {
    if (d.category === "vacation-prep" || d.category === "shred-cut") push("Deadline-driven", 3);
    if (d.id === "12-week-physique" && input.daysToDeadline >= 70) push("Fits the block length", 1);
  } else if (d.category === "vacation-prep") {
    push("No deadline", -1);
  }

  if (lanes.cut && (d.category === "shred-cut" || d.category === "vacation-prep")) push("Goal favors a cut", 2);
  if (lanes.bulk && d.category === "lean-bulk") push("Goal favors size", 2);
  if (lanes.recomp && d.category === "recomp") push("Goal favors recomp", 2);
  if (lanes.classic && d.category === "classic-physique") push("Goal favors classic proportion", 2);
  if (lanes.athletic && d.category === "athletic-performance") push("Goal favors performance", 2);
  if (lanes.conditioning) {
    if (d.category === "athletic-performance") push("Conditioning → performance", 2);
    if (d.category === "recomp") push("Conditioning → recomp", 1);
    if (d.category === "shred-cut") push("Conditioning → cut", 1);
  }

  const reqLvl = d.difficulty === "elite" ? 2 : d.difficulty === "advanced" ? 2 : d.difficulty === "intermediate" ? 1 : 0;
  if (reqLvl <= levelRank[input.trainingLevel]) push("Within training level", 1); else push("Above training level", -2);
  if (d.difficulty === "elite" && input.trainingLevel !== "advanced") push("Elite structure gated", -2);

  if (female) {
    if (isWomens) {
      push("Women's-performance architecture", 6);
      push("Women's goal fit", womensGoalBonus(d.womensTrack, lanes));
    } else {
      push("Non-women's split for a female member", -6);
    }
  } else if (isWomens) {
    push("Women's architecture for a non-female member", -6);
  }

  if (input.hasWeakPoints && /weak-point/i.test(d.trainingEmphasis)) push("Weak-point emphasis", 1);

  // ── Capacity: frequency / recovery / duration / weak-point spec / occupation / injury. ──
  const cap = capacityScore(architectureFingerprint(d), input);
  for (const f of cap.factors) factors.push(f);

  return { score: factors.reduce((a, f) => a + f.delta, 0), factors };
}

export function recommendProtocols(input: ProtocolRecoInput, limit = 3): ProtocolDefinition[] {
  const g = (input.goal || "").toLowerCase();
  const female = input.womensPath || (input.genderIdentity || "").toLowerCase() === "female";

  const scored = PROTOCOL_LIBRARY
    .filter((d) => !d.logOnly || /log|organi|enhanced/.test(g)) // hide log-only/lifestyle unless relevant
    .filter((d) => d.category !== "fertility-lifestyle" && d.category !== "pregnancy-lifestyle")
    .map((d) => ({ d, s: scoreProtocol(d, input).score }))
    .sort((a, b) => b.s - a.s);

  let result = scored.slice(0, limit).map((x) => x.d);

  // Patch 4 — defensive fallback: a female member must never default into a male
  // split because a goal failed to score. Guarantee a women's-performance lead.
  if (female && !result.some((d) => d.category === "womens-performance")) {
    const topWomens = scored.find((x) => x.d.category === "womens-performance")?.d;
    if (topWomens) result = [topWomens, ...result.filter((d) => d.id !== topWomens.id)].slice(0, limit);
  }

  return result;
}

/* ─── Command profile completeness ────────────────────────────────────── */
export type CommandCompleteness = { percent: number; missing: string[]; confidence: "high" | "moderate" | "limited" };

export function computeCommandCompleteness(signals: Record<string, boolean>): CommandCompleteness {
  const labels: Record<string, string> = {
    schedule: "Schedule", goal: "Goal", protocol: "Protocol", gymEnvironment: "Gym environment",
    equipment: "Equipment access", weakPoints: "Weak point focus", nutrition: "Nutrition preference",
    mealTiming: "Meal timing", recovery: "Recovery target", checkIn: "Check-in cadence",
  };
  const keys = Object.keys(labels);
  const done = keys.filter((k) => signals[k]).length;
  const percent = Math.round((done / keys.length) * 100);
  const missing = keys.filter((k) => !signals[k]).map((k) => labels[k]);
  const confidence: CommandCompleteness["confidence"] = percent >= 85 ? "high" : percent >= 55 ? "moderate" : "limited";
  return { percent, missing, confidence };
}
