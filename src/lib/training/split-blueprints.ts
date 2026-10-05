/* ════════════════════════════════════════════════════════════════════════
   PROTOCOL ARCHITECTURE 2.0 — SPLIT BLUEPRINTS
   ------------------------------------------------------------------------
   Every protocol has its own weekly training identity. A blueprint is the
   protocol's IDEAL 7-day structure (Mon…Sun). The resolver then adapts it to
   the member's availability, activity layers, muscle priority, and recovery
   preference — so the same protocol can run as a 6, 5, 4, or 3-day week
   without losing its identity.

   This replaces the single hardcoded RESERVE_WEEK_SPLIT skeleton as the
   source of weekly STRUCTURE. Pure data + deterministic helpers — no medical,
   dosing, hormone, or supplement content.
   ════════════════════════════════════════════════════════════════════════ */

import { selectArchitecture } from "./architecture-select";
import { LEG_EMPHASIS_ARCHETYPE, chooseLegEmphasis } from "./leg-emphasis";
import type { ProtocolRecoInput } from "@/lib/protocol/library";

export type FocusRegion = "upper" | "lower" | "mixed" | "general" | "glutes" | "athletic";

/** Session identity — drives session name, muscle emphasis, and the template lookup. */
export type SessionArchetype =
  // Chest-led
  | "chest-strength" | "chest-hypertrophy" | "chest-detail"
  // Chest + Back combo days (full upper-torso push/pull — strength · volume · pump)
  | "chest-back-strength" | "chest-back-volume" | "chest-back-pump"
  // Back / pull
  | "back-width" | "back-thickness" | "upper-back-posture"
  // Shoulders / arms
  | "delts-arms" | "arms-pump" | "shoulders"
  // Push / pull composites (chest·delts·triceps / back·biceps·traps) — hybrid PPL
  | "push" | "pull"
  // Upper composites
  | "upper-strength" | "upper-hypertrophy" | "upper-tone" | "posture-upper"
  // Lower composites
  | "legs" | "lower-strength" | "lower-power" | "quad-focus"
  | "posterior-chain" | "hamstring-glute"
  // Glute-led (women's identities)
  | "glute-strength" | "glute-shape" | "glute-pump" | "glute-detail" | "abductors"
  | "legs-waistline" | "calves"
  // Athletic / conditioning
  | "full-body-athletic" | "sprint-power" | "explosive"
  | "conditioning" | "sport-conditioning" | "zone2"
  // Outdoor distance (running / track — real lower-body + cardio load, no gym)
  | "outdoor-distance"
  // Core / waist
  | "core" | "waistline"
  // Low-impact / recovery
  | "pilates" | "yoga" | "mobility" | "recovery"
  // Log-only
  | "logged";

export type SessionIntent =
  | "strength" | "hypertrophy" | "power" | "conditioning"
  | "tone" | "sport" | "recovery" | "mobility" | "logged";

export type BlueprintDay = {
  /** Session identity shown in the UI, e.g. "Glute Strength + Hamstrings". */
  title: string;
  archetype: SessionArchetype;
  /** Primary muscle / focus emphasis (drives template emphasis + display). */
  emphasis: string[];
  intent: SessionIntent;
  /** 1 = core identity day (kept first when availability shrinks); higher = more droppable. */
  priority: number;
  recovery?: boolean;
};

export type SplitBlueprint = {
  id: string;
  /** Active Architecture name shown to the member. */
  name: string;
  focusRegion: FocusRegion;
  /** Ideal training days/week this blueprint was authored for. */
  idealTrainingDays: number;
  /** The IDEAL Mon…Sun week (length 7). */
  week: BlueprintDay[];
  /** Day indexes (0=Mon…6=Sun) where an activity layer can be injected. */
  activitySlots?: number[];
  /** Log-only blueprints are never compressed or relabeled. */
  logOnly?: boolean;
};

/* ─── Authoring helpers ──────────────────────────────────────────────────── */
function day(title: string, archetype: SessionArchetype, emphasis: string[], intent: SessionIntent, priority: number): BlueprintDay {
  return { title, archetype, emphasis, intent, priority };
}
function rest(title = "Recovery / Mobility", archetype: SessionArchetype = "recovery"): BlueprintDay {
  return { title, archetype, emphasis: [], intent: "recovery", priority: 99, recovery: true };
}

/* ════════════════════════════════════════════════════════════════════════
   DEFAULT (Reserve Physique) — the fallback for any protocol without its own
   blueprint. Mirrors RESERVE_WEEK_SPLIT: Push → Pull → Legs → Arms → Upper →
   Lower. It used to be the Chest / Back A/B rotation every member saw.
   ════════════════════════════════════════════════════════════════════════ */
const DEFAULT_BLUEPRINT: SplitBlueprint = {
  id: "reserve-physique",
  name: "Reserve Physique Rotation",
  focusRegion: "mixed",
  idealTrainingDays: 6,
  activitySlots: [6],
  /* Push → Pull → Legs → Arms → Upper → Lower. Arm Day is the first day a
     shorter week drops, which leaves PPL + Upper / Lower at five days. */
  week: [
    day("Push", "push", ["chest", "delts", "triceps"], "hypertrophy", 1),
    day("Pull", "pull", ["back", "biceps", "forearms", "traps"], "hypertrophy", 1),
    day("Legs", "legs", ["quads", "hamstrings", "glutes", "calves"], "hypertrophy", 1),
    day("Arm Day", "arms-pump", ["biceps", "triceps", "forearms"], "hypertrophy", 3),
    day("Upper", "upper-strength", ["chest", "back", "delts"], "strength", 2),
    day("Lower", "lower-strength", ["quads", "hamstrings", "glutes"], "strength", 2),
    rest("Recovery", "recovery"),
  ],
};

/* ════════════════════════════════════════════════════════════════════════
   MALE / GENERAL PROTOCOL BLUEPRINTS
   ════════════════════════════════════════════════════════════════════════ */

const CLASSIC_PHYSIQUE: SplitBlueprint = {
  id: "classic-physique-build",
  name: "Classic Symmetry Rotation",
  focusRegion: "mixed",
  idealTrainingDays: 5,
  activitySlots: [6],
  week: [
    day("Push · Chest + Shoulders", "push", ["chest", "delts", "triceps"], "strength", 1),
    day("Lower Strength + Core", "lower-strength", ["quads", "hamstrings", "core"], "strength", 1),
    day("Pull · Back Width", "pull", ["back", "biceps", "forearms", "traps"], "hypertrophy", 1),
    day("Delts + Arms Detail", "delts-arms", ["delts", "arms"], "hypertrophy", 2),
    day("Posterior Chain + Calves", "posterior-chain", ["hamstrings", "glutes", "calves"], "strength", 3),
    rest("Recovery / Mobility"),
    rest("Recovery + Posing"),
  ],
};

const CHAMPIONSHIP_PHYSIQUE: SplitBlueprint = {
  id: "championship-physique",
  name: "Championship Physique Rotation",
  focusRegion: "mixed",
  idealTrainingDays: 6,
  activitySlots: [6],
  week: [
    day("Push Strength", "push", ["chest", "delts", "triceps"], "strength", 1),
    day("Lower Strength + Core", "lower-strength", ["quads", "hamstrings", "core"], "strength", 1),
    day("Pull Strength", "pull", ["back", "biceps", "forearms", "traps"], "strength", 1),
    day("Delts + Arms Pump", "delts-arms", ["delts", "arms"], "hypertrophy", 2),
    day("Posterior Chain + Athletic Core", "posterior-chain", ["hamstrings", "glutes", "core"], "strength", 2),
    day("Upper Specialization + Detail", "upper-hypertrophy", ["upper-chest", "delts", "arms"], "hypertrophy", 3),
    rest("Recovery + Posing"),
  ],
};

const ATHLETIC_PERFORMANCE: SplitBlueprint = {
  id: "high-performance-hypertrophy",
  name: "Athletic Performance Rotation",
  focusRegion: "athletic",
  idealTrainingDays: 5,
  activitySlots: [5, 6],
  week: [
    day("Lower Power + Sprint Mechanics", "lower-power", ["quads", "glutes", "power"], "power", 1),
    day("Upper Strength", "upper-strength", ["chest", "back", "delts"], "strength", 1),
    day("Conditioning + Core", "conditioning", ["conditioning", "core"], "conditioning", 2),
    day("Posterior Chain + Explosive Work", "posterior-chain", ["hamstrings", "glutes", "power"], "power", 2),
    day("Upper Athletic Hypertrophy", "upper-hypertrophy", ["chest", "back", "arms"], "hypertrophy", 3),
    rest("Zone 2 / Mobility", "zone2"),
    rest("Recovery"),
  ],
};

/* ════════════════════════════════════════════════════════════════════════
   RESERVE ATHLETE METHOD — bodybuilder-first hybrid family.
   The 4 lifting days are priority:1 (the physique floor). The Recovery-Athlete
   day (Wed) and Reserve Athlete day (Sat) are modeled as recovery:true so the
   resolver always preserves them and never counts them as droppable lifting
   slots — athletic capacity is layered AROUND the physique, never replacing
   lifting volume. If availability shrinks below 4, the lowest lift steps down;
   the athletic identity stays intact.
   ════════════════════════════════════════════════════════════════════════ */
const RESERVE_ATHLETE_HYBRID: SplitBlueprint = {
  id: "reserve-athlete-hybrid",
  name: "Reserve Athlete Hybrid Rotation",
  focusRegion: "athletic",
  idealTrainingDays: 4,
  activitySlots: [5],
  week: [
    day("Upper Builder", "upper-strength", ["chest", "back", "delts", "arms"], "strength", 1),
    day("Lower Builder", "lower-strength", ["quads", "hamstrings", "glutes", "calves"], "strength", 1),
    rest("Recovery Athlete", "zone2"),
    day("Upper Hypertrophy", "upper-hypertrophy", ["chest", "back", "delts", "arms"], "hypertrophy", 1),
    day("Lower Hypertrophy + Glute-Ham", "posterior-chain", ["hamstrings", "glutes", "quads", "calves"], "hypertrophy", 1),
    { title: "Reserve Athlete Day", archetype: "full-body-athletic", emphasis: ["full-body", "power", "conditioning"], intent: "sport", priority: 3, recovery: true },
    rest("Recovery + Mobility", "recovery"),
  ],
};

/* ════════════════════════════════════════════════════════════════════════
   RESERVE GRAND TOURING — Private Hybrid Performance Architecture.
   A refined hybrid: physique development (Push / Pull / Upper / Lower) with
   structured conditioning and outdoor distance woven in. Distinct from the
   Reserve Athlete family — its own week, its own identity. The five gym lifts
   are the physique floor; the outdoor-distance and conditioning exposures are
   the hybrid identity and are protected before the "extra" upper/lower volume
   drops when availability shrinks. Never opens on a chest/back combo day.
   ════════════════════════════════════════════════════════════════════════ */
const GRAND_TOURING: SplitBlueprint = {
  id: "reserve-grand-touring",
  name: "Grand Touring Rotation",
  focusRegion: "athletic",
  idealTrainingDays: 6,
  activitySlots: [0, 2],
  week: [
    // Mon — outdoor distance / no gym (real lower-body + cardio load, not complete rest).
    { title: "Outdoor Distance", archetype: "outdoor-distance", emphasis: ["distance", "conditioning", "lower-body"], intent: "conditioning", priority: 2 },
    day("Push · Chest · Shoulders · Triceps", "push", ["chest", "delts", "triceps"], "hypertrophy", 1),
    day("Performance Conditioning", "sport-conditioning", ["conditioning", "power", "core"], "conditioning", 2),
    day("Pull · Back · Biceps · Traps", "pull", ["back", "biceps", "traps"], "hypertrophy", 1),
    day("Posterior Lower", "posterior-chain", ["hamstrings", "glutes", "calves"], "strength", 1),
    day("Upper", "upper-hypertrophy", ["chest", "back", "delts", "arms"], "hypertrophy", 3),
    day("Lower", "lower-strength", ["quads", "glutes", "adductors", "calves"], "strength", 3),
  ],
};

/* ════════════════════════════════════════════════════════════════════════
   POWERBUILDING — each primary pattern owns a day, hypertrophy accessories
   are built around THAT pattern. Distinct from Lean Bulk (which leads with
   heavy work but organizes by body region) and from Strength (which refuses
   the hypertrophy day entirely).
   ════════════════════════════════════════════════════════════════════════ */
const POWERBUILDING: SplitBlueprint = {
  id: "reserve-powerbuilding",
  name: "Powerbuilding Rotation",
  focusRegion: "mixed",
  idealTrainingDays: 5,
  activitySlots: [5, 6],
  week: [
    day("Squat Top Set + Quad Volume", "lower-strength", ["quads", "glutes", "strength"], "strength", 1),
    day("Bench Top Set + Push Volume", "chest-strength", ["chest", "delts", "triceps", "strength"], "strength", 1),
    rest("Recovery / Mobility"),
    day("Hinge Top Set + Pull Volume", "back-thickness", ["hamstrings", "back", "strength"], "strength", 1),
    day("Overhead Press + Upper Hypertrophy", "upper-hypertrophy", ["delts", "chest", "back", "arms"], "hypertrophy", 2),
    day("Lower Hypertrophy + Calves", "quad-focus", ["quads", "hamstrings", "calves"], "hypertrophy", 3),
    rest("Recovery"),
  ],
};

/* ════════════════════════════════════════════════════════════════════════
   STRENGTH — specificity first. One primary lift per session, its
   supplemental variation, and only supporting accessories. Deliberately low
   exercise variety; no hypertrophy day. This is NOT powerbuilding with heavy
   first exercises.
   ════════════════════════════════════════════════════════════════════════ */
const STRENGTH: SplitBlueprint = {
  id: "reserve-strength",
  name: "Primary Lift Rotation",
  focusRegion: "mixed",
  idealTrainingDays: 4,
  activitySlots: [5, 6],
  week: [
    day("Squat Primary + Supplemental", "lower-strength", ["quads", "glutes", "strength"], "strength", 1),
    day("Bench Primary + Supplemental", "chest-strength", ["chest", "triceps", "strength"], "strength", 1),
    rest("Recovery / Mobility"),
    day("Deadlift Primary + Supplemental", "posterior-chain", ["hamstrings", "back", "strength"], "strength", 1),
    day("Press Primary + Supporting Work", "shoulders", ["delts", "triceps", "strength"], "strength", 1),
    rest("Recovery / Mobility"),
    rest("Recovery"),
  ],
};

/* ════════════════════════════════════════════════════════════════════════
   TACTICAL — durability. Carries, strength endurance, repeated effort,
   loaded distance, trunk. Distinct from Performance Hybrid (power/speed led)
   and from Grand Touring (physique led).
   ════════════════════════════════════════════════════════════════════════ */
const TACTICAL: SplitBlueprint = {
  id: "reserve-tactical",
  name: "Tactical Durability Rotation",
  focusRegion: "athletic",
  idealTrainingDays: 6,
  activitySlots: [3],
  week: [
    day("Full-Body Strength + Loaded Carries", "full-body-athletic", ["full-body", "carries", "trunk"], "strength", 1),
    { title: "Loaded Distance", archetype: "outdoor-distance", emphasis: ["distance", "conditioning", "lower-body"], intent: "conditioning", priority: 2 },
    day("Upper Strength Endurance", "upper-strength", ["chest", "back", "delts", "endurance"], "strength", 1),
    day("Repeated-Effort Conditioning", "sport-conditioning", ["conditioning", "power", "core"], "conditioning", 2),
    day("Lower Durability + Trunk", "lower-strength", ["quads", "hamstrings", "glutes", "core"], "strength", 1),
    day("Work Capacity + Carries", "conditioning", ["conditioning", "carries", "full-body"], "conditioning", 3),
    rest("Recovery"),
  ],
};

/* ════════════════════════════════════════════════════════════════════════
   ENDURANCE PHYSIQUE — endurance is the PRIORITY-1 identity (three aerobic
   exposures: easy base, quality, long). Resistance work is the retention
   layer. Grand Touring inverts this: its lifts are priority 1 and distance
   is the hybrid layer.
   ════════════════════════════════════════════════════════════════════════ */
const ENDURANCE_PHYSIQUE: SplitBlueprint = {
  id: "reserve-endurance-physique",
  name: "Endurance Physique Rotation",
  focusRegion: "athletic",
  idealTrainingDays: 6,
  activitySlots: [2],
  week: [
    { title: "Aerobic Base Distance", archetype: "outdoor-distance", emphasis: ["distance", "aerobic", "lower-body"], intent: "conditioning", priority: 1 },
    day("Upper Muscle Retention", "upper-hypertrophy", ["chest", "back", "delts", "arms"], "hypertrophy", 2),
    { title: "Quality Endurance Session", archetype: "outdoor-distance", emphasis: ["distance", "tempo", "lower-body"], intent: "conditioning", priority: 1 },
    day("Lower Muscle Retention", "lower-strength", ["quads", "hamstrings", "glutes"], "strength", 2),
    day("Easy Aerobic + Mobility", "zone2", ["aerobic", "mobility"], "conditioning", 3),
    { title: "Long Distance Effort", archetype: "outdoor-distance", emphasis: ["distance", "aerobic", "endurance"], intent: "conditioning", priority: 1 },
    rest("Recovery"),
  ],
};

/* ════════════════════════════════════════════════════════════════════════
   FOUNDATION — movement learning. Lower / Upper / Full-Body so each pattern
   is repeated at manageable complexity. Distinct from Lifestyle Reset, which
   runs three identical full-body conditioning-biased sessions for habit.
   ════════════════════════════════════════════════════════════════════════ */
const FOUNDATION: SplitBlueprint = {
  id: "reserve-foundation",
  name: "Movement Foundation Rotation",
  focusRegion: "general",
  idealTrainingDays: 3,
  activitySlots: [1, 3, 5],
  week: [
    day("Lower Foundation", "lower-strength", ["quads", "glutes", "hamstrings"], "strength", 1),
    rest("Walk / Mobility", "mobility"),
    day("Upper Foundation", "upper-strength", ["chest", "back", "delts"], "strength", 1),
    rest("Walk / Mobility", "mobility"),
    day("Full-Body Foundation", "full-body-athletic", ["full-body", "core"], "strength", 1),
    rest("Walk / Mobility", "mobility"),
    rest("Recovery"),
  ],
};

/* ════════════════════════════════════════════════════════════════════════
   RESTORED — recovery-constrained. Wide spacing, no back-to-back systemic
   days, efficient composite sessions.
   ════════════════════════════════════════════════════════════════════════ */
const RESTORED: SplitBlueprint = {
  id: "reserve-restored",
  name: "Restored Rotation",
  focusRegion: "general",
  idealTrainingDays: 4,
  activitySlots: [1, 6],
  week: [
    day("Upper Quality", "upper-strength", ["chest", "back", "delts"], "strength", 1),
    rest("Programmed Recovery"),
    day("Lower Quality", "lower-strength", ["quads", "hamstrings", "glutes"], "strength", 1),
    rest("Programmed Recovery"),
    day("Upper Density", "upper-hypertrophy", ["chest", "back", "arms"], "hypertrophy", 2),
    day("Lower Density + Core", "posterior-chain", ["hamstrings", "glutes", "core"], "hypertrophy", 3),
    rest("Recovery"),
  ],
};

/* ════════════════════════════════════════════════════════════════════════
   SPECIALIZATION — a credible upper/lower base carrying TWO priority slots.
   The base is never renamed after the weak point; only the priority days are.
   ════════════════════════════════════════════════════════════════════════ */
const SPECIALIZATION: SplitBlueprint = {
  id: "reserve-specialization",
  name: "Specialization Rotation",
  focusRegion: "mixed",
  idealTrainingDays: 5,
  activitySlots: [6],
  week: [
    day("Priority Exposure", "upper-hypertrophy", ["priority"], "hypertrophy", 1),
    day("Lower Base", "lower-strength", ["quads", "hamstrings", "glutes"], "strength", 1),
    rest("Recovery / Mobility"),
    day("Priority Second Exposure", "upper-hypertrophy", ["priority"], "hypertrophy", 1),
    day("Upper Maintenance", "upper-strength", ["chest", "back", "delts"], "strength", 2),
    day("Posterior Base + Calves", "posterior-chain", ["hamstrings", "glutes", "calves"], "strength", 3),
    rest("Recovery"),
  ],
};

const PREMIUM_OPERATOR: SplitBlueprint = {
  id: "premium-gym-operator",
  name: "Premium Operator Rotation",
  focusRegion: "mixed",
  idealTrainingDays: 5,
  activitySlots: [5, 6],
  week: [
    day("Push Machine Strength", "push", ["chest", "delts", "triceps"], "strength", 1),
    day("Lower Strength + Core", "lower-strength", ["quads", "hamstrings", "core"], "strength", 1),
    day("Pull Machine Strength", "pull", ["back", "biceps", "forearms", "traps"], "strength", 1),
    day("Upper Hypertrophy + Detail", "upper-hypertrophy", ["chest", "back", "delts"], "hypertrophy", 2),
    day("Posterior Chain + Calves", "posterior-chain", ["hamstrings", "glutes", "calves"], "strength", 3),
    rest("Zone 2 / Mobility", "zone2"),
    rest("Recovery"),
  ],
};

const LEAN_BULK: SplitBlueprint = {
  id: "lean-bulk-command",
  name: "Lean Mass Rotation",
  focusRegion: "mixed",
  idealTrainingDays: 5,
  activitySlots: [5, 6],
  week: [
    day("Heavy Push Strength", "chest-strength", ["chest", "delts", "triceps"], "strength", 1),
    day("Heavy Lower Strength", "lower-strength", ["quads", "hamstrings"], "strength", 1),
    day("Heavy Pull Strength", "back-thickness", ["back", "biceps"], "strength", 2),
    day("Upper Hypertrophy Pump", "upper-hypertrophy", ["chest", "back", "arms"], "hypertrophy", 2),
    day("Posterior Chain + Calves", "posterior-chain", ["hamstrings", "glutes", "calves"], "hypertrophy", 3),
    rest("Recovery / Mobility"),
    rest("Recovery"),
  ],
};

const RECOMP: SplitBlueprint = {
  id: "recomp-protocol",
  name: "Recomp Performance Rotation",
  focusRegion: "mixed",
  idealTrainingDays: 4,
  activitySlots: [4, 5],
  week: [
    day("Upper Strength + Conditioning", "upper-strength", ["chest", "back", "delts"], "strength", 1),
    day("Lower Strength + Core", "lower-strength", ["quads", "hamstrings", "core"], "strength", 1),
    rest("Zone 2 / Mobility", "zone2"),
    day("Upper Hypertrophy + Conditioning", "upper-hypertrophy", ["chest", "back", "arms"], "hypertrophy", 2),
    day("Posterior Chain + Conditioning", "posterior-chain", ["hamstrings", "glutes"], "conditioning", 2),
    rest("Recovery / Mobility"),
    rest("Recovery"),
  ],
};

const TRANSFORMATION: SplitBlueprint = {
  id: "12-week-physique",
  name: "Transformation Rotation",
  focusRegion: "mixed",
  idealTrainingDays: 5,
  activitySlots: [5, 6],
  week: [
    day("Upper Strength", "upper-strength", ["chest", "back", "delts"], "strength", 1),
    day("Lower Strength + Core", "lower-strength", ["quads", "hamstrings", "core"], "strength", 1),
    day("Push Hypertrophy", "chest-hypertrophy", ["chest", "delts", "triceps"], "hypertrophy", 2),
    day("Pull Hypertrophy", "back-width", ["back", "biceps"], "hypertrophy", 2),
    day("Posterior Legs + Conditioning", "posterior-chain", ["hamstrings", "glutes"], "conditioning", 3),
    rest("Zone 2 / Mobility", "zone2"),
    rest("Recovery"),
  ],
};

const SHRED: SplitBlueprint = {
  id: "ultimate-summer-shred",
  name: "Lean-Out Rotation",
  focusRegion: "mixed",
  idealTrainingDays: 5,
  activitySlots: [2, 5, 6],
  week: [
    day("Upper Hypertrophy + Conditioning", "upper-hypertrophy", ["chest", "back", "delts"], "conditioning", 1),
    day("Lower + Conditioning", "lower-strength", ["quads", "hamstrings"], "conditioning", 1),
    day("Conditioning + Core", "conditioning", ["conditioning", "core"], "conditioning", 2),
    day("Push Detail + Conditioning", "chest-detail", ["chest", "delts", "arms"], "conditioning", 2),
    day("Posterior + Waistline Conditioning", "posterior-chain", ["hamstrings", "glutes", "core"], "conditioning", 3),
    rest("Zone 2 / Mobility", "zone2"),
    rest("Recovery"),
  ],
};

/* ════════════════════════════════════════════════════════════════════════
   EVENT COUNTDOWN — deliberately NOT the Shred week with a date attached.
   Shred is a five-day hypertrophy-plus-conditioning block that leads with a
   composite upper day and a heavy lower day. Countdown is an upper-frame and
   waistline-led week with two STANDALONE conditioning days, six exposures,
   and a presentation-week taper. Different topology, different lead, and a
   different phase sequence.
   ════════════════════════════════════════════════════════════════════════ */
const VACATION_COUNTDOWN: SplitBlueprint = {
  id: "vacation-countdown",
  name: "Event Countdown Rotation",
  focusRegion: "upper",
  idealTrainingDays: 6,
  activitySlots: [1, 4],
  week: [
    day("Upper Frame + Waistline", "upper-hypertrophy", ["chest", "back", "delts", "core"], "hypertrophy", 1),
    day("Conditioning + Core", "conditioning", ["conditioning", "core"], "conditioning", 1),
    day("Lower Shape + Glutes", "quad-focus", ["quads", "glutes", "hamstrings"], "hypertrophy", 2),
    day("Push Detail + Arms", "chest-detail", ["chest", "delts", "arms"], "hypertrophy", 2),
    day("Conditioning + Waistline", "conditioning", ["conditioning", "core"], "conditioning", 1),
    day("Back Line + Delts", "back-width", ["back", "delts"], "hypertrophy", 3),
    rest("Recovery"),
  ],
};

const AT_HOME: SplitBlueprint = {
  id: "at-home-warrior",
  name: "Home Performance Rotation",
  focusRegion: "mixed",
  idealTrainingDays: 4,
  activitySlots: [4, 5, 6],
  week: [
    day("Home Lower Strength", "lower-strength", ["quads", "glutes", "hamstrings"], "strength", 1),
    day("Home Push + Core", "chest-hypertrophy", ["chest", "delts", "core"], "hypertrophy", 1),
    rest("Mobility + Conditioning", "mobility"),
    day("Home Pull + Arms", "back-width", ["back", "biceps"], "hypertrophy", 2),
    day("Home Full-Body Conditioning", "full-body-athletic", ["full-body", "conditioning"], "conditioning", 2),
    rest("Recovery / Mobility"),
    rest("Recovery"),
  ],
};

const LIFESTYLE_RESET: SplitBlueprint = {
  id: "lifestyle-reset",
  name: "Strength + Recovery Rhythm",
  focusRegion: "general",
  idealTrainingDays: 3,
  activitySlots: [1, 3, 5, 6],
  week: [
    day("Full-Body Strength A", "full-body-athletic", ["full-body"], "strength", 1),
    rest("Walk / Mobility", "mobility"),
    day("Full-Body Strength B", "full-body-athletic", ["full-body"], "strength", 1),
    rest("Walk / Mobility", "mobility"),
    day("Full-Body Strength C", "full-body-athletic", ["full-body", "conditioning"], "conditioning", 2),
    rest("Recovery / Mobility"),
    rest("Recovery"),
  ],
};

const FERTILITY_LIFESTYLE: SplitBlueprint = {
  id: "fertility-lifestyle",
  name: "Lifestyle Strength + Recovery Rhythm",
  focusRegion: "general",
  idealTrainingDays: 3,
  activitySlots: [1, 3, 5, 6],
  week: [
    day("Full-Body Strength A", "full-body-athletic", ["full-body"], "strength", 1),
    rest("Walk / Mobility", "mobility"),
    day("Full-Body Strength B", "full-body-athletic", ["full-body"], "strength", 1),
    rest("Yoga / Mobility", "yoga"),
    day("Low-Impact Conditioning", "conditioning", ["conditioning", "core"], "conditioning", 2),
    rest("Recovery / Mobility"),
    rest("Recovery"),
  ],
};

const PREGNANCY_LIFESTYLE: SplitBlueprint = {
  id: "pregnancy-lifestyle",
  name: "Prenatal Lifestyle Rhythm",
  focusRegion: "general",
  idealTrainingDays: 3,
  activitySlots: [1, 3, 5, 6],
  week: [
    day("Supported Full-Body Strength", "full-body-athletic", ["full-body", "posture"], "strength", 1),
    rest("Walk / Mobility", "mobility"),
    day("Posture + Mobility Strength", "posture-upper", ["posture", "core"], "tone", 1),
    rest("Prenatal Yoga / Mobility", "yoga"),
    day("Low-Impact Walking + Breathing", "zone2", ["conditioning"], "conditioning", 2),
    rest("Recovery / Mobility"),
    rest("Recovery"),
  ],
};

const ENHANCED_LOGBOOK: SplitBlueprint = {
  id: "enhanced-logbook",
  name: "Member-Defined Logging",
  focusRegion: "general",
  idealTrainingDays: 5,
  logOnly: true,
  week: [
    day("Logged Training", "logged", [], "logged", 1),
    day("Logged Training", "logged", [], "logged", 1),
    day("Logged Training", "logged", [], "logged", 1),
    day("Logged Training", "logged", [], "logged", 1),
    day("Logged Training", "logged", [], "logged", 1),
    rest("Logged Recovery", "recovery"),
    rest("Logged Recovery", "recovery"),
  ],
};

/* ════════════════════════════════════════════════════════════════════════
   WOMEN'S PROTOCOL BLUEPRINTS — glute / shape / athletic identities.
   None of these open on chest/back.
   ════════════════════════════════════════════════════════════════════════ */

const GLUTE_CROWN: SplitBlueprint = {
  id: "glute-crown",
  name: "Crown",
  focusRegion: "glutes",
  idealTrainingDays: 5,
  activitySlots: [3, 5, 6],
  week: [
    day("Glute Strength + Hamstrings", "glute-strength", ["glutes", "hamstrings"], "strength", 1),
    day("Upper Tone + Core", "upper-tone", ["back", "delts", "core"], "tone", 2),
    day("Glute Shape + Abductors", "glute-shape", ["glutes", "abductors"], "hypertrophy", 1),
    rest("Pilates / Recovery Conditioning", "pilates"),
    day("Glute Pump + Posterior Legs", "glute-pump", ["glutes", "hamstrings"], "hypertrophy", 2),
    day("Waistline + Cardio", "waistline", ["core", "conditioning"], "conditioning", 3),
    rest("Recovery"),
  ],
};

const GLUTE_ASCEND: SplitBlueprint = {
  id: "glute-ascend",
  name: "Summit",
  focusRegion: "glutes",
  idealTrainingDays: 5,
  activitySlots: [3, 5, 6],
  week: [
    day("Glute Strength + Hamstrings", "glute-strength", ["glutes", "hamstrings"], "strength", 1),
    day("Quad Shape + Glute Support", "quad-focus", ["quads", "glutes"], "hypertrophy", 1),
    day("Upper Tone + Core", "upper-tone", ["back", "delts", "core"], "tone", 2),
    rest("Mobility / Recovery", "mobility"),
    day("Glute Pump + Abductors", "glute-pump", ["glutes", "abductors"], "hypertrophy", 2),
    day("Waistline + Calves + Cardio", "legs-waistline", ["calves", "core", "conditioning"], "conditioning", 3),
    rest("Recovery"),
  ],
};

const SCULPTED_LEGS: SplitBlueprint = {
  id: "sculpted-legs",
  name: "Long Lines",
  focusRegion: "lower",
  idealTrainingDays: 5,
  activitySlots: [3, 5, 6],
  week: [
    day("Quad Shape + Glute Support", "quad-focus", ["quads", "glutes"], "hypertrophy", 1),
    day("Upper Tone + Core", "upper-tone", ["back", "delts", "core"], "tone", 2),
    day("Hamstrings + Glute Shape", "hamstring-glute", ["hamstrings", "glutes"], "hypertrophy", 1),
    rest("Mobility / Recovery", "mobility"),
    day("Quad Detail + Calves", "calves", ["quads", "calves"], "hypertrophy", 2),
    day("Glute Pump + Waistline", "glute-pump", ["glutes", "core"], "conditioning", 3),
    rest("Recovery"),
  ],
};

const RUNWAY_SHAPE: SplitBlueprint = {
  id: "runway-shape",
  name: "Runway",
  focusRegion: "glutes",
  idealTrainingDays: 5,
  activitySlots: [3, 5, 6],
  week: [
    day("Glutes + Hamstrings", "glute-strength", ["glutes", "hamstrings"], "strength", 1),
    day("Posture Upper + Core", "posture-upper", ["back", "delts", "core"], "tone", 1),
    day("Legs + Waistline Conditioning", "legs-waistline", ["quads", "core", "conditioning"], "conditioning", 2),
    rest("Pilates / Mobility", "pilates"),
    day("Glute Detail + Calves", "glute-detail", ["glutes", "calves"], "hypertrophy", 2),
    rest("Low-Impact Cardio + Abs", "zone2"),
    rest("Recovery"),
  ],
};

const VACATION_PHYSIQUE: SplitBlueprint = {
  id: "vacation-physique",
  name: "Resort",
  focusRegion: "glutes",
  idealTrainingDays: 5,
  activitySlots: [3, 5, 6],
  week: [
    day("Glutes + Waistline", "glute-strength", ["glutes", "core"], "strength", 1),
    day("Arms + Shoulders Tone", "upper-tone", ["delts", "arms"], "tone", 2),
    day("Glute Shape + Conditioning", "glute-shape", ["glutes", "conditioning"], "conditioning", 1),
    rest("Pilates / Mobility", "pilates"),
    day("Legs + Waistline Detail", "legs-waistline", ["quads", "core"], "conditioning", 2),
    rest("Low-Impact Cardio + Abs", "zone2"),
    rest("Recovery"),
  ],
};

const ATHLETIC_MODEL: SplitBlueprint = {
  id: "athletic-model",
  name: "Off-Duty",
  focusRegion: "athletic",
  idealTrainingDays: 5,
  activitySlots: [2, 5, 6],
  week: [
    day("Lower Strength + Glutes", "glute-strength", ["glutes", "quads", "hamstrings"], "strength", 1),
    day("Upper Strength + Core", "upper-strength", ["back", "delts", "core"], "strength", 1),
    day("Conditioning + Core", "conditioning", ["conditioning", "core"], "conditioning", 2),
    day("Posterior Chain + Power", "posterior-chain", ["hamstrings", "glutes", "power"], "power", 2),
    day("Full-Body Athletic", "full-body-athletic", ["full-body"], "conditioning", 3),
    rest("Mobility / Zone 2", "zone2"),
    rest("Recovery"),
  ],
};

const SIGNATURE_SHAPE: SplitBlueprint = {
  id: "signature-shape",
  name: "Signature",
  focusRegion: "glutes",
  idealTrainingDays: 5,
  activitySlots: [3, 5, 6],
  week: [
    day("Glutes + Hamstrings", "glute-strength", ["glutes", "hamstrings"], "strength", 1),
    day("Upper Tone + Core", "upper-tone", ["back", "delts", "core"], "tone", 1),
    day("Quad Shape + Glute Support", "quad-focus", ["quads", "glutes"], "hypertrophy", 2),
    // Second upper-frame exposure — the track's documented contract is
    // "upper frame 2x, 5 training days"; a single upper day contradicted it and
    // left the week reading as lower-body-only.
    day("Back Line + Delts + Posture", "posture-upper", ["back", "delts", "posture"], "hypertrophy", 2),
    day("Glute Pump + Waistline", "glute-pump", ["glutes", "core"], "conditioning", 2),
    rest("Low-Impact Conditioning", "zone2"),
    rest("Recovery"),
  ],
};

const HYBRID_PILATES: SplitBlueprint = {
  id: "hybrid-pilates-shape",
  name: "Studio",
  focusRegion: "glutes",
  idealTrainingDays: 5,
  activitySlots: [1, 3, 5, 6],
  week: [
    day("Glutes + Hamstrings Strength", "glute-strength", ["glutes", "hamstrings"], "strength", 1),
    day("Pilates + Core Control", "pilates", ["core", "posture"], "mobility", 1),
    day("Quad Shape + Glute Support", "quad-focus", ["quads", "glutes"], "hypertrophy", 2),
    day("Pilates / Yoga Flow", "yoga", ["mobility", "core"], "mobility", 2),
    day("Glute Pump + Waistline", "glute-pump", ["glutes", "core"], "conditioning", 2),
    rest("Mobility / Recovery", "mobility"),
    rest("Recovery"),
  ],
};

const SPORT_STRENGTH: SplitBlueprint = {
  id: "sport-strength-shape",
  name: "Field",
  focusRegion: "athletic",
  idealTrainingDays: 5,
  activitySlots: [2, 5, 6],
  week: [
    day("Lower Strength + Glutes", "glute-strength", ["glutes", "quads", "hamstrings"], "strength", 1),
    day("Upper Strength + Core", "upper-strength", ["back", "delts", "core"], "strength", 1),
    day("Sport Conditioning", "sport-conditioning", ["conditioning", "sport"], "sport", 2),
    day("Posterior Chain + Power", "posterior-chain", ["hamstrings", "glutes", "power"], "power", 2),
    day("Full-Body Athletic", "full-body-athletic", ["full-body"], "conditioning", 3),
    rest("Mobility / Zone 2", "zone2"),
    rest("Recovery"),
  ],
};

/* ════════════════════════════════════════════════════════════════════════
   REGISTRIES
   ════════════════════════════════════════════════════════════════════════ */

export const PROTOCOL_BLUEPRINTS: Record<string, SplitBlueprint> = {
  // male / general
  "classic-physique-build": CLASSIC_PHYSIQUE,
  "championship-physique": CHAMPIONSHIP_PHYSIQUE,
  "high-performance-hypertrophy": ATHLETIC_PERFORMANCE,
  "reserve-athlete-hybrid": RESERVE_ATHLETE_HYBRID,
  "reserve-grand-touring": GRAND_TOURING,
  "reserve-powerbuilding": POWERBUILDING,
  "reserve-strength": STRENGTH,
  "reserve-tactical": TACTICAL,
  "reserve-endurance-physique": ENDURANCE_PHYSIQUE,
  "reserve-foundation": FOUNDATION,
  "reserve-restored": RESTORED,
  "reserve-specialization": SPECIALIZATION,
  "premium-gym-operator": PREMIUM_OPERATOR,
  "lean-bulk-command": LEAN_BULK,
  "recomp-protocol": RECOMP,
  "12-week-physique": TRANSFORMATION,
  "ultimate-summer-shred": SHRED,
  "vacation-countdown": VACATION_COUNTDOWN,
  "at-home-warrior": AT_HOME,
  "lifestyle-reset": LIFESTYLE_RESET,
  "fertility-lifestyle": FERTILITY_LIFESTYLE,
  "pregnancy-lifestyle": PREGNANCY_LIFESTYLE,
  "enhanced-logbook": ENHANCED_LOGBOOK,
  // women's
  "glute-crown": GLUTE_CROWN,
  "glute-ascend": GLUTE_ASCEND,
  "sculpted-legs": SCULPTED_LEGS,
  "runway-shape": RUNWAY_SHAPE,
  "vacation-physique": VACATION_PHYSIQUE,
  "athletic-model": ATHLETIC_MODEL,
  "signature-shape": SIGNATURE_SHAPE,
  "hybrid-pilates-shape": HYBRID_PILATES,
  "sport-strength-shape": SPORT_STRENGTH,
};

/** Category-level fallback when a protocol id has no explicit blueprint. */
const CATEGORY_DEFAULT: Record<string, SplitBlueprint> = {
  "shred-cut": SHRED,
  "vacation-prep": VACATION_COUNTDOWN,
  transformation: TRANSFORMATION,
  "classic-physique": CLASSIC_PHYSIQUE,
  "athletic-performance": ATHLETIC_PERFORMANCE,
  "reserve-athlete": RESERVE_ATHLETE_HYBRID,
  "hybrid-performance": GRAND_TOURING,
  powerbuilding: POWERBUILDING,
  strength: STRENGTH,
  "tactical-hybrid": TACTICAL,
  "endurance-physique": ENDURANCE_PHYSIQUE,
  foundation: FOUNDATION,
  "recovery-constrained": RESTORED,
  specialization: SPECIALIZATION,
  "premium-advanced": CHAMPIONSHIP_PHYSIQUE,
  "lean-bulk": LEAN_BULK,
  recomp: RECOMP,
  "at-home": AT_HOME,
  "lifestyle-reset": LIFESTYLE_RESET,
  "womens-performance": SIGNATURE_SHAPE,
  "fertility-lifestyle": FERTILITY_LIFESTYLE,
  "pregnancy-lifestyle": PREGNANCY_LIFESTYLE,
  "enhanced-log-only": ENHANCED_LOGBOOK,
};

/* ════════════════════════════════════════════════════════════════════════
   RESOLVER — adapt a blueprint to the member.
   ════════════════════════════════════════════════════════════════════════ */

export type BlueprintResolveInput = {
  protocolId?: string | null;
  category?: string | null;
  /** Member availability (training days/week). */
  trainingDaysTarget?: number | null;
  /** Activity stack key from onboarding (e.g. "gym-pilates", "gym-sports"). */
  activityStack?: string | null;
  activitySport?: string | null;
  cardioPreference?: string | null;
  recoveryPreference?: string | null;
  /** Weak points / priorities to emphasise inside the week. */
  musclePriority?: string[];
  /** Current game-plan week (1-based) — rotates same-family session emphasis
      across weeks so consecutive weeks never run identical sessions. */
  weekNumber?: number | null;
  /** When no protocol/category is active, the member's profile selects a
      differentiated starting architecture instead of the chest/back default. */
  profileForFallback?: ProtocolRecoInput | null;
};

/* Same-family archetype cycles for week-to-week rotation. Only families whose
   authored day titles stay truthful when the emphasis rotates (chest/back
   combo days) — protocol identity and day naming are never restructured. */
/* Sessions that already train the whole lower body — a Legs day beside one
   can lead with the front or the posterior chain (leg-emphasis.ts). */
const WHOLE_LOWER_ARCHETYPES = new Set<SessionArchetype>(["lower-strength", "lower-power"]);

const WEEK_ROTATION_FAMILIES: SessionArchetype[][] = [
  ["chest-back-strength", "chest-back-volume", "chest-back-pump"],
];

export function getBlueprintForProtocol(
  protocolId?: string | null,
  category?: string | null,
  profileForFallback?: ProtocolRecoInput | null,
): SplitBlueprint {
  if (protocolId && PROTOCOL_BLUEPRINTS[protocolId]) return PROTOCOL_BLUEPRINTS[protocolId];
  if (category && CATEGORY_DEFAULT[category]) return CATEGORY_DEFAULT[category];
  // No active protocol → the profile chooses a differentiated architecture so
  // the member never silently lands on the chest/back default week.
  if (profileForFallback && (profileForFallback.goal || profileForFallback.trainingDaysPerWeek)) {
    const chosen = selectArchitecture(profileForFallback).chosen;
    return PROTOCOL_BLUEPRINTS[chosen.id] ?? CATEGORY_DEFAULT[chosen.category] ?? DEFAULT_BLUEPRINT;
  }
  return DEFAULT_BLUEPRINT;
}

function activityDayFor(stack: string | null | undefined, sport: string | null | undefined): BlueprintDay | null {
  const s = (stack ?? "").toLowerCase();
  if (s.includes("sport")) {
    const label = sport ? `${sportLabel(sport)} Conditioning` : "Sport Conditioning";
    return day(label, "sport-conditioning", ["conditioning", "sport"], "sport", 4);
  }
  if (s.includes("pilates") && s.includes("yoga")) return day("Pilates / Yoga Flow", "pilates", ["core", "mobility"], "mobility", 4);
  if (s.includes("pilates")) return day("Pilates + Core Control", "pilates", ["core", "posture"], "mobility", 4);
  if (s.includes("yoga")) return day("Yoga / Mobility Flow", "yoga", ["mobility", "core"], "mobility", 4);
  return null;
}

function sportLabel(sport: string): string {
  return sport.charAt(0).toUpperCase() + sport.slice(1);
}

/** Map a flagged weak-point region to a dedicated specialization day. Only
    regions with a real specialization template are returned; general "core"
    weak points stay as in-day emphasis (null) rather than a whole day. */
function specializationDayFor(priorities: string[]): BlueprintDay | null {
  const has = (re: RegExp) => priorities.some((p) => re.test(p));
  if (has(/delt|shoulder/)) return day("Delt & Shoulder Specialization", "delts-arms", ["delts", "arms", "priority"], "hypertrophy", 3);
  if (has(/bicep|tricep|\barm/)) return day("Arm Specialization", "arms-pump", ["arms", "priority"], "hypertrophy", 3);
  if (has(/upper[\s-]?chest|chest|pec/)) return day("Chest Detail Specialization", "chest-detail", ["chest", "priority"], "hypertrophy", 3);
  if (has(/back|lat|width/)) return day("Back Width Specialization", "back-width", ["back", "priority"], "hypertrophy", 3);
  if (has(/quad/)) return day("Quad Specialization", "quad-focus", ["quads", "priority"], "hypertrophy", 3);
  if (has(/hamstring|glute|posterior/)) return day("Glute & Hamstring Specialization", "glute-detail", ["glutes", "hamstrings", "priority"], "hypertrophy", 3);
  if (has(/calf|calve/)) return day("Calf Specialization", "calves", ["calves", "priority"], "hypertrophy", 3);
  return null;
}

/**
 * Adapt a blueprint into a final Mon…Sun week the member can actually run.
 * Identity is preserved (highest-priority training days are kept first); only
 * availability, activity layers, priority emphasis, and recovery preference move.
 */
/* ════════════════════════════════════════════════════════════════════════
   LEG FREQUENCY — derived from the authored blueprint.

   No protocol surface stated how often a week trained legs, so Crown already
   delivered three glute exposures and never said so anywhere a member could
   read it. Counted from the blueprint so the number cannot drift.
   ════════════════════════════════════════════════════════════════════════ */

const LOWER_DAY_ARCHETYPES = new Set<SessionArchetype>([
  "legs", "lower-strength", "lower-power", "quad-focus", "posterior-chain", "hamstring-glute",
  "glute-strength", "glute-shape", "glute-pump", "glute-detail", "abductors", "legs-waistline",
  /* A calf / quad-detail day is a lower-body training day — Long Lines
     closes its week on one, and leaving it out undercounted the protocol. */
  "calves",
]);

/** How many lower-body TRAINING days a protocol's authored week contains. */
export function protocolLowerDays(protocolId: string | null | undefined, category?: string | null): number {
  const blueprint = getBlueprintForProtocol(protocolId, category);
  return blueprint.week.filter((d) => !d.recovery && LOWER_DAY_ARCHETYPES.has(d.archetype)).length;
}

/** "3 leg days a week" / "1 leg day a week" — honest cadence copy. */
export function protocolLegFrequency(protocolId: string | null | undefined, category?: string | null): string {
  const n = protocolLowerDays(protocolId, category);
  return `${n} leg ${n === 1 ? "day" : "days"}`;
}

export function resolveWeeklyBlueprint(input: BlueprintResolveInput): { blueprint: SplitBlueprint; week: BlueprintDay[] } {
  const blueprint = getBlueprintForProtocol(input.protocolId, input.category, input.profileForFallback);

  // Log-only is never restructured.
  if (blueprint.logOnly) {
    return { blueprint, week: blueprint.week.map((d) => ({ ...d })) };
  }

  const week: BlueprintDay[] = blueprint.week.map((d) => ({ ...d, emphasis: [...d.emphasis] }));

  // ── Availability: keep the N highest-priority training days, convert the
  //    rest to active recovery. Never exceed the blueprint's authored days. ──
  const trainingIdx = week
    .map((d, i) => ({ i, d }))
    .filter((x) => !x.d.recovery);
  const authored = trainingIdx.length;
  let target = input.trainingDaysTarget ?? blueprint.idealTrainingDays;
  target = Math.max(3, Math.min(authored, target));
  if (target < authored) {
    // Drop lowest-priority (highest number) training days first.
    const ranked = [...trainingIdx].sort((a, b) => b.d.priority - a.d.priority || b.i - a.i);
    const toDrop = ranked.slice(0, authored - target);
    for (const { i } of toDrop) {
      week[i] = rest("Active Recovery / Mobility", "mobility");
    }
  }

  // ── Activity layers: inject the member's selected activity into a designated
  //    activity slot (prefer a recovery/low slot so it adds, not replaces). ──
  const activity = activityDayFor(input.activityStack, input.activitySport);
  if (activity && blueprint.activitySlots?.length) {
    const slot =
      blueprint.activitySlots.find((i) => week[i]?.recovery) ??
      blueprint.activitySlots[0];
    if (slot != null && week[slot]) week[slot] = { ...activity };
  }

  // ── Recovery preference: Protective guarantees a final rest day; Aggressive
  //    upgrades one recovery day to light conditioning. ──
  const recoveryPref = (input.recoveryPreference ?? "").toLowerCase();
  if (recoveryPref.includes("protect")) {
    if (!week[6].recovery) week[6] = rest("Recovery");
  } else if (recoveryPref.includes("aggress")) {
    const firstRec = week.findIndex((d) => d.recovery && d.archetype !== "recovery");
    if (firstRec >= 0) week[firstRec] = day("Conditioning + Mobility", "zone2", ["conditioning"], "conditioning", 4);
  }

  // ── Weak-point priority. Two levels: (1) STRUCTURAL — when a mappable region
  //    is flagged and capacity allows, convert the lowest-priority training day
  //    into a dedicated specialization day; (2) EMPHASIS — tag the first day
  //    that already trains the region so its template leads with it. ──
  const priorities = (input.musclePriority ?? []).map((p) => p.toLowerCase()).filter(Boolean);
  if (priorities.length) {
    const trainingCount = week.filter((d) => !d.recovery).length;
    const spec = specializationDayFor(priorities);
    if (spec && trainingCount >= 4) {
      // Replace the most droppable (highest priority number) training day that
      // isn't already this specialization, keeping the training-day count.
      let targetIdx = -1;
      let worst = -1;
      week.forEach((d, i) => {
        if (d.recovery || d.archetype === spec.archetype) return;
        if (d.priority > worst) { worst = d.priority; targetIdx = i; }
      });
      if (targetIdx >= 0) week[targetIdx] = { ...spec };
    }
    // Emphasis tag (unchanged) — lead the first matching day with the priority.
    for (const d of week) {
      if (d.recovery) continue;
      if (d.emphasis.some((e) => priorities.some((p) => e.toLowerCase().includes(p) || p.includes(e.toLowerCase())))) {
        if (!d.emphasis.includes("priority")) d.emphasis = [...d.emphasis, "priority"];
        break;
      }
    }
  }

  // ── Week-to-week rotation: cycle same-family emphasis by game-plan week so
  //    Week 1 / 2 / 3 load different sessions on the same split day. ──
  const weekShift = Math.max(0, Math.round(input.weekNumber ?? 1) - 1);
  if (weekShift > 0) {
    for (const d of week) {
      if (d.recovery) continue;
      const family = WEEK_ROTATION_FAMILIES.find((f) => f.includes(d.archetype));
      if (!family) continue;
      d.archetype = family[(family.indexOf(d.archetype) + weekShift) % family.length];
    }
  }

  // ── Legs lead: beside a Lower day the week's Legs session leads with the
  //    front or the posterior chain; as the only lower session it stays
  //    complete. ──
  const hasLowerDay = week.some((d) => !d.recovery && WHOLE_LOWER_ARCHETYPES.has(d.archetype));
  const legLead = chooseLegEmphasis({ hasLowerDay, weekNumber: input.weekNumber, musclePriority: input.musclePriority });
  if (legLead !== "full") {
    for (const d of week) {
      if (!d.recovery && d.archetype === "legs") d.archetype = LEG_EMPHASIS_ARCHETYPE[legLead];
    }
  }

  return { blueprint, week };
}
