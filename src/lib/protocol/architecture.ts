/* ════════════════════════════════════════════════════════════════════════
   PROTOCOL → TRAINING ARCHITECTURE ADAPTER

   The selected protocol is the source of truth. This pure helper resolves an
   active protocol into the VISIBLE training architecture every surface reads:
   Apex, Training Command, the 7-day split, the session directive, and the
   supporting Nutrition/Recovery context.

   Core principle (Design Bible §13 + the protocol model):
     Protocol  = full mission / user archetype / operating mode
     Architecture = the weekly training architecture the protocol runs
     Session   = today's work
     Movement  = current exercise

   It does NOT fork the training engine. The canonical weekly cadence
   (weekly-split.ts → getTrainingWeekPlan) still decides which days train,
   their durations, muscles, and recovery placement. This adapter REFRAMES the
   session language + architecture name to the protocol family so a Women's /
   Senior / Lifestyle / Home / Student member never sees default bodybuilding
   copy. Physique families (advanced, transformation, recomp, shred, lean mass)
   keep the canonical language and the member's own split name (sacred copy).

   Pure + deterministic. No store access. No medical claims, no dosing, no
   diagnosis — instruction and organization only.
   ════════════════════════════════════════════════════════════════════════ */

import type { ActiveProtocol, NutritionIntent, ProtocolCategory, ProtocolDefinition } from "@/lib/protocol/library";
import type { TrainingWeekDay } from "@/lib/training/weekly-split";
import { musclePriorityLabel, type MusclePriority, type PhysiqueFocus, type WomensTrack } from "@/lib/physique/types";

/* The user archetypes the operating system is built to serve. */
export type ProtocolFamily =
  | "advanced_performance"
  | "women_performance"
  | "lifestyle"
  | "senior_performance"
  | "student_athlete"
  | "young_adult"
  | "home_training"
  | "transformation"
  | "recomp"
  | "shred"
  | "lean_mass"
  | "reserve_athlete"
  | "powerbuilding"
  | "strength"
  | "tactical"
  | "endurance"
  | "foundation"
  | "recovery_constrained"
  | "specialization"
  | "log_only";

type SessionSlot = "lower" | "push" | "pull" | "accessory" | "conditioning" | "recovery" | "general";

type FamilySpec = {
  /** Mission system label, e.g. "Women's Performance System". */
  systemLabel: string;
  /** Active Architecture name, e.g. "Signature Rotation". */
  architecture: string;
  /** One-line weekly rhythm summary. */
  rhythm: string;
  /** Specialized families override the member's generic split label; physique
      families keep the member's own split name (sacred copy). */
  specialized: boolean;
  /** Default to non-adult, non-enhanced framing (students / young adults). */
  minorSafe: boolean;
  /** Session reframing per slot (specialized families only). */
  slotLabels?: Record<SessionSlot, string>;
  /** Session type word per slot (for the directive). */
  typeWord?: Partial<Record<SessionSlot, string>>;
};

const STRENGTH_SLOTS = (lower: string, push: string, pull: string, acc: string, cond: string, rec: string, gen: string): Record<SessionSlot, string> => ({
  lower, push, pull, accessory: acc, conditioning: cond, recovery: rec, general: gen,
});

const FAMILY_SPEC: Record<ProtocolFamily, FamilySpec> = {
  advanced_performance: {
    systemLabel: "Performance Protocol", architecture: "Reserve Physique Rotation",
    rhythm: "High-output physique rotation with recovery placed to protect quality.",
    specialized: false, minorSafe: false,
  },
  reserve_athlete: {
    systemLabel: "Reserve Athlete Method", architecture: "Reserve Athlete Hybrid Rotation",
    rhythm: "A protected bodybuilding core with athletic capacity and recovery layered around it.",
    // Non-specialized: the lifting days keep canonical bodybuilding session copy (bodybuilder first).
    specialized: false, minorSafe: false,
  },
  transformation: {
    systemLabel: "Transformation Protocol", architecture: "Transformation Rotation",
    rhythm: "Structured hypertrophy across the block with weekly evidence check-ins.",
    specialized: false, minorSafe: false,
  },
  recomp: {
    systemLabel: "Recomp Protocol", architecture: "Recomp Performance Rotation",
    rhythm: "Strength retention under a controlled deficit, conditioning placed clear of recovery.",
    specialized: false, minorSafe: false,
  },
  shred: {
    systemLabel: "Shred Protocol", architecture: "Lean-Out Rotation",
    rhythm: "Hypertrophy plus conditioning, timed toward a leaner, tighter look.",
    specialized: false, minorSafe: false,
  },
  lean_mass: {
    systemLabel: "Lean Mass Protocol", architecture: "Lean Mass Rotation",
    rhythm: "Progressive overload on the anchor lifts with recovery protected around them.",
    specialized: false, minorSafe: false,
  },
  powerbuilding: {
    systemLabel: "Powerbuilding Protocol", architecture: "Powerbuilding Rotation",
    rhythm: "Measurable top sets on the anchor lifts with hypertrophy volume built around each pattern.",
    specialized: false, minorSafe: false,
  },
  strength: {
    systemLabel: "Strength Protocol", architecture: "Primary Lift Rotation",
    rhythm: "One primary lift per session, planned intensity exposure, and only the accessories that support it.",
    specialized: false, minorSafe: false,
  },
  tactical: {
    systemLabel: "Tactical Protocol", architecture: "Tactical Durability Rotation",
    rhythm: "Carries, strength endurance, and repeated-effort work organized for output that repeats.",
    specialized: false, minorSafe: false,
  },
  endurance: {
    systemLabel: "Endurance Physique Protocol", architecture: "Endurance Physique Rotation",
    rhythm: "Aerobic development leads the week with resistance work placed to protect muscle.",
    specialized: false, minorSafe: false,
  },
  foundation: {
    systemLabel: "Foundation Protocol", architecture: "Movement Foundation Rotation",
    rhythm: "Repeatable sessions, low complexity, and technique earned before load.",
    specialized: false, minorSafe: false,
  },
  recovery_constrained: {
    systemLabel: "Restored Protocol", architecture: "Restored Rotation",
    rhythm: "Spaced sessions with lower systemic cost and recovery days that stay recovery days.",
    specialized: false, minorSafe: false,
  },
  specialization: {
    systemLabel: "Specialization Protocol", architecture: "Specialization Rotation",
    rhythm: "One region leads the week while everything else is held at maintenance.",
    specialized: false, minorSafe: false,
  },
  women_performance: {
    systemLabel: "Women's Performance System", architecture: "Signature Rotation",
    rhythm: "Goal-driven strength and physique work — intensity follows recovery, never gender.",
    specialized: true, minorSafe: false,
    slotLabels: STRENGTH_SLOTS("Lower Strength", "Upper Strength · Push", "Upper Strength · Pull", "Shoulders + Glute Detail", "Conditioning + Core", "Mobility + Recovery", "Full-Body Strength"),
    typeWord: { lower: "Strength", push: "Strength", pull: "Strength", accessory: "Strength", conditioning: "Conditioning", general: "Strength" },
  },
  senior_performance: {
    systemLabel: "Longevity Performance System", architecture: "Strength, Mobility + Balance Rotation",
    rhythm: "Joint-friendly strength with mobility, balance, and protected recovery.",
    specialized: true, minorSafe: false,
    slotLabels: STRENGTH_SLOTS("Lower Strength + Balance", "Upper Strength · Push", "Upper Strength · Pull", "Mobility + Posture", "Low-Impact Conditioning", "Mobility + Recovery", "Full-Body Strength"),
    typeWord: { conditioning: "Conditioning", general: "Strength" },
  },
  student_athlete: {
    systemLabel: "Student Performance System", architecture: "Strength, Conditioning + Recovery Rotation",
    rhythm: "Strength and conditioning that protects school, sport, and recovery rhythm.",
    specialized: true, minorSafe: true,
    slotLabels: STRENGTH_SLOTS("Lower Power", "Upper Power · Push", "Upper Power · Pull", "Speed + Accessory", "Conditioning", "Recovery + Mobility", "Full-Body Performance"),
    typeWord: { lower: "Power", push: "Power", pull: "Power", conditioning: "Conditioning", general: "Performance" },
  },
  young_adult: {
    systemLabel: "Foundation Performance System", architecture: "Strength Foundation Rotation",
    rhythm: "Build the strength foundation with clean technique and protected recovery.",
    specialized: true, minorSafe: true,
    slotLabels: STRENGTH_SLOTS("Lower Strength", "Upper Strength · Push", "Upper Strength · Pull", "Strength + Detail", "Conditioning", "Mobility + Recovery", "Full-Body Strength"),
    typeWord: { conditioning: "Conditioning", general: "Strength" },
  },
  lifestyle: {
    systemLabel: "Lifestyle Performance System", architecture: "Strength + Recovery Rhythm",
    rhythm: "A sustainable strength-and-recovery rhythm that rebuilds consistency.",
    specialized: true, minorSafe: false,
    slotLabels: STRENGTH_SLOTS("Lower Strength", "Upper Strength · Push", "Upper Strength · Pull", "Strength + Tone", "Conditioning", "Mobility + Recovery", "Full-Body Strength"),
    typeWord: { conditioning: "Conditioning", general: "Strength" },
  },
  home_training: {
    systemLabel: "Home Performance System", architecture: "Dumbbell, Bodyweight + Conditioning Rotation",
    rhythm: "Unilateral work, tempo, and density blocks engineered for home equipment.",
    specialized: true, minorSafe: false,
    slotLabels: STRENGTH_SLOTS("Home Lower Strength", "Home Push", "Home Pull", "Home Accessory + Core", "Home Conditioning", "Mobility + Recovery", "Home Full-Body"),
    typeWord: { conditioning: "Conditioning", general: "Strength" },
  },
  log_only: {
    systemLabel: "Reserve Logbook", architecture: "Member-Defined Logging",
    rhythm: "Log-only organization — Reserve does not prescribe or generate sessions.",
    specialized: true, minorSafe: false,
    slotLabels: STRENGTH_SLOTS("Logged Training", "Logged Training", "Logged Training", "Logged Training", "Logged Training", "Logged Recovery", "Logged Training"),
    typeWord: { recovery: "Recovery", general: "Logged" },
  },
};

const CATEGORY_FAMILY: Record<ProtocolCategory, ProtocolFamily> = {
  transformation: "transformation",
  "shred-cut": "shred",
  "lean-bulk": "lean_mass",
  recomp: "recomp",
  "classic-physique": "advanced_performance",
  "athletic-performance": "advanced_performance",
  "premium-advanced": "advanced_performance",
  "vacation-prep": "shred",
  "womens-performance": "women_performance",
  "lifestyle-reset": "lifestyle",
  "at-home": "home_training",
  "enhanced-log-only": "log_only",
  "fertility-lifestyle": "lifestyle",
  "pregnancy-lifestyle": "lifestyle",
  // Reserve Athlete has its own bodybuilder-first family — keeps canonical session copy
  // while carrying its own architecture identity (Reserve Athlete Hybrid Rotation).
  "reserve-athlete": "reserve_athlete",
  // Grand Touring is a hybrid performance architecture; its week is driven by its own
  // blueprint (structural precedence), so the family only informs generic naming.
  "hybrid-performance": "advanced_performance",
  powerbuilding: "powerbuilding",
  strength: "strength",
  "tactical-hybrid": "tactical",
  "endurance-physique": "endurance",
  foundation: "foundation",
  "recovery-constrained": "recovery_constrained",
  specialization: "specialization",
};

export function familyForCategory(category: ProtocolCategory): ProtocolFamily {
  return CATEGORY_FAMILY[category] ?? "advanced_performance";
}

export function isSpecializedFamily(family: ProtocolFamily): boolean {
  return FAMILY_SPEC[family].specialized;
}

export function familyArchitectureName(family: ProtocolFamily): string {
  return FAMILY_SPEC[family].architecture;
}

export function familySystemLabel(family: ProtocolFamily): string {
  return FAMILY_SPEC[family].systemLabel;
}

function slotFromText(text: string, recovery: boolean): SessionSlot {
  if (recovery) return "recovery";
  const t = text.toLowerCase();
  if (/rest|recovery|off day|active recovery/.test(t)) return "recovery";
  if (/leg|quad|hamstring|glute|calf|lower|posterior/.test(t)) return "lower";
  if (/chest|push|press|pec/.test(t)) return "push";
  if (/back|pull|row|lat|deadlift/.test(t)) return "pull";
  if (/delt|shoulder|arm|bicep|tricep/.test(t)) return "accessory";
  if (/condition|cardio|hiit|full|athletic/.test(t)) return "conditioning";
  return "general";
}

function slotOf(day: TrainingWeekDay): SessionSlot {
  return slotFromText(`${day.sessionName} ${day.focus} ${day.muscles.join(" ")}`, day.recovery);
}

/** Reframe a session NAME into a family's language from plain text fields.
    Works for any week model (TrainingWeekDay or WeekRow). Physique families
    keep the original name; only specialized families relabel. */
export function reframeSessionLabel(family: ProtocolFamily, name: string, contextText = ""): string {
  const spec = FAMILY_SPEC[family];
  if (!spec.specialized || !spec.slotLabels) return name;
  const recovery = /rest|recovery|off day/.test(`${name} ${contextText}`.toLowerCase());
  const slot = slotFromText(`${name} ${contextText}`, recovery);
  return spec.slotLabels[slot];
}

/** Reframe one canonical day into the family's language. All structural fields
    (splitDay, muscles, duration, recovery, intensity, status) are preserved so
    the movement engine and live cockpit are unaffected — only labels change. */
function reframeDay(day: TrainingWeekDay, spec: FamilySpec): TrainingWeekDay {
  if (!spec.specialized || !spec.slotLabels) return day;
  const slot = slotOf(day);
  const label = spec.slotLabels[slot];
  return { ...day, sessionName: label, focus: day.recovery ? day.focus : `${label} · ${day.focus}` };
}

export type SessionDirective = {
  title: string;
  type: string;
  objective: string;
  before: string;
  after: string;
  recoveryNote: string;
  nextCheckpoint: string;
};

export type ResolvedArchitecture = {
  hasProtocol: boolean;
  family: ProtocolFamily;
  /** Mission — the selected protocol's name. */
  protocolName: string;
  /** Mission system label (family operating mode). */
  systemLabel: string;
  /** Active Architecture — the weekly training architecture. */
  architectureName: string;
  /** Specialized families override the generic member split label. */
  specialized: boolean;
  minorSafe: boolean;
  logOnly: boolean;
  rhythm: string;
  weeklySplit: TrainingWeekDay[];
  todaySession: TrainingWeekDay;
  focus: string;
  sessionDirective: SessionDirective;
  recoveryContext: string;
  nutritionContext: string;
  evidenceNeeded: string | null;
  /** Set when there is no active protocol — honest fallback. */
  fallbackReason: string | null;
};

export type ResolveArchitectureInput = {
  activeProtocol: ActiveProtocol | null;
  /** The protocol definition (from getProtocol) — supplies real emphasis copy. */
  def: ProtocolDefinition | null;
  /** Canonical week from getTrainingWeekPlan — the cadence source of truth. */
  week: TrainingWeekDay[];
  /** Today's canonical day from getTodayTrainingWeekDay. */
  today: TrainingWeekDay;
  /** Member's own split name (profile.trainingStyle) — sacred for physique families. */
  customSplitName?: string | null;
  /** Member's chosen split-system name (Split Architect), if any. */
  chosenSplitSystemName?: string | null;
  /** Women's path only — whether cycle details have been entered. */
  hasCycleData?: boolean;
  /** Protocol Architecture 2.0 — when true, the week already carries the
      protocol's own identity session names, so family relabeling is skipped. */
  blueprintDriven?: boolean;
};

export function resolveTrainingArchitecture(input: ResolveArchitectureInput): ResolvedArchitecture {
  const { activeProtocol, def, week, today, customSplitName, chosenSplitSystemName, hasCycleData, blueprintDriven } = input;

  /* No protocol — honest fallback to the Reserve default. */
  if (!activeProtocol) {
    const directive = buildDirective(today, FAMILY_SPEC.advanced_performance, null);
    return {
      hasProtocol: false,
      family: "advanced_performance",
      protocolName: "Setup needed",
      systemLabel: "Reserve default",
      architectureName: customSplitName?.trim() || chosenSplitSystemName || "Reserve Default Rotation",
      specialized: false,
      minorSafe: false,
      logOnly: false,
      rhythm: FAMILY_SPEC.advanced_performance.rhythm,
      weeklySplit: week,
      todaySession: today,
      focus: today.recovery ? "Recovery day. Restore the reserve and protect tomorrow's output." : today.focus,
      sessionDirective: directive,
      recoveryContext: "Protect sleep, hydration, and mobility — recovery sets tomorrow's output.",
      nutritionContext: "Map your meal windows so fuel is timed to the day.",
      /* NOT an evidence prompt. "No active protocol" is a blocking system
         state, and resolveSystemState() announces it once at the top of the
         screen with a single action. Emitting it here too put the same
         sentence a third time inside the hero, beside a banner already saying
         it — which is the repetition this slot must stop contributing to.

         `evidenceNeeded` stays reserved for gaps the L0 banner does NOT cover
         (unset focus tissue, missing cycle details), where a hint beside the
         thing it qualifies is genuinely the right place for it.

         `fallbackReason` below still records WHY the default architecture is
         showing, for surfaces that explain their own provenance. */
      evidenceNeeded: null,
      fallbackReason: "No active protocol — showing the Reserve default architecture.",
    };
  }

  const family = familyForCategory(activeProtocol.category);
  const spec = FAMILY_SPEC[family];
  const logOnly = Boolean(def?.logOnly);

  // Blueprint-driven weeks already carry the protocol's own identity names —
  // don't overwrite "Glute Strength + Hamstrings" with a generic family label.
  const weeklySplit = blueprintDriven ? week : week.map((d) => reframeDay(d, spec));
  const todaySession = blueprintDriven ? today : reframeDay(today, spec);

  /* Architecture name: specialized families always assert the family
     architecture (this fixes the bug where a women's protocol showed a
     default bodybuilding label). Physique families keep the member's own
     split name when set. */
  const architectureName = spec.specialized
    ? spec.architecture
    : customSplitName?.trim() || chosenSplitSystemName || spec.architecture;

  const directive = buildDirective(todaySession, spec, def);

  /* Nutrition / Recovery context — composed from the protocol's own emphasis. */
  const nutritionContext = logOnly
    ? "Log-only — Reserve organizes your entries and does not generate meal guidance."
    : def?.nutritionEmphasis
      ? `Fuel Context · ${def.nutritionEmphasis}.`
      : "Fuel Context · protein anchor, hydration, and recovery-timed meals.";

  let recoveryContext = logOnly
    ? "Log-only — recovery entries are organized for your review, not interpreted."
    : def?.recoveryEmphasis
      ? `Recovery Context · ${def.recoveryEmphasis}.`
      : "Recovery Context · sleep, hydration, mobility, and readiness.";

  let evidenceNeeded: string | null = null;

  /* Women's path — cycle-aware organization (estimate-only, never medical). */
  if (family === "women_performance") {
    if (hasCycleData) {
      recoveryContext = "Recovery Context · cycle-aware recovery, sleep, mobility, and readiness (estimate-only organization).";
    } else {
      evidenceNeeded = "Add cycle details to unlock cycle-aware training, fuel, and recovery context.";
    }
  }

  return {
    hasProtocol: true,
    family,
    protocolName: activeProtocol.protocolName,
    systemLabel: spec.systemLabel,
    architectureName,
    specialized: spec.specialized,
    minorSafe: spec.minorSafe,
    logOnly,
    rhythm: def?.scheduleDemand ? `${spec.rhythm} (${def.scheduleDemand})` : spec.rhythm,
    weeklySplit,
    todaySession,
    focus: todaySession.recovery ? "Recovery day. Restore the reserve and protect tomorrow's output." : todaySession.focus,
    sessionDirective: directive,
    recoveryContext,
    nutritionContext,
    evidenceNeeded,
    fallbackReason: null,
  };
}

function buildDirective(day: TrainingWeekDay, spec: FamilySpec, def: ProtocolDefinition | null): SessionDirective {
  const slot = day.recovery ? "recovery" : slotOf(day);
  const typeWord = day.recovery ? "Recovery" : spec.typeWord?.[slot] ?? "Training";
  const cadence = def?.checkInCadence && def.checkInCadence !== "Member-defined"
    ? `${def.checkInCadence} check-in · photos + measurements.`
    : "Log a check-in to hold the trend.";

  if (day.recovery) {
    return {
      title: day.sessionName,
      type: "Recovery",
      objective: "Restore the reserve and sharpen control before the next push.",
      before: "Hydrate and keep the day low-stress.",
      after: "Mobility, an easy walk, and an early downshift toward sleep.",
      recoveryNote: "Recovery day — protect sleep and let adaptation run.",
      nextCheckpoint: cadence,
    };
  }

  return {
    title: day.sessionName,
    type: typeWord,
    objective: spec.specialized
      ? `Execute ${day.sessionName} clean — quality reps before load.`
      : "Beat last session's first priority movement by one clean rep before adding load.",
    before: "Hydrate, warm up the working joints, and run the readiness check.",
    after: "Refuel with a protein anchor and start the recovery handoff.",
    recoveryNote: def?.recoveryEmphasis ? `${def.recoveryEmphasis}.` : "Protect sleep and hydration after the session.",
    nextCheckpoint: cadence,
  };
}

/* ════════════════════════════════════════════════════════════════════════
   MEMBER MUSCLE PRIORITY → FOCUS ARCHITECTURE

   The member's selected muscle priorities refine the protocol architecture
   into a focus-aware rotation: a chest member and a glute member receive
   different architecture names, weekly bias, session directives, movement
   emphasis, and recovery / nutrition context. Member-specific, never assumed
   from gender. Instruction + organization only — no medical claims.
   ════════════════════════════════════════════════════════════════════════ */

export type FocusRegion = "upper" | "lower" | "mixed" | "general";

export type FocusArchitecture = {
  active: boolean;
  /** "Chest" / "Glutes · Quads" — the member's selected priority, read back. */
  focusLabel: string;
  /** Focus-aware architecture name, e.g. "Glute Priority Rotation". */
  architectureName: string;
  region: FocusRegion;
  /** One-line weekly emphasis summary. */
  weeklyBias: string;
  /** Lead sessions the week is built around. */
  prioritySessions: string[];
  /** Maintained / support sessions. */
  supportSessions: string[];
  /** The lead session directive sentence. */
  sessionDirective: string;
  /** Apex "Today's Directive" short form, e.g. "Chest Priority · Upper chest first · back support". */
  todayDirective: string;
  nutritionContext: string;
  recoveryContext: string;
  /** Set when no primary focus is selected — honest fallback. */
  evidenceNeeded: string | null;
  fallbackReason: string | null;
};

const CHEST: ReadonlySet<MusclePriority> = new Set<MusclePriority>(["chest", "upper-chest"]);
const BACK: ReadonlySet<MusclePriority> = new Set<MusclePriority>(["back-width", "back-thickness"]);

function focusListLabel(items: MusclePriority[]): string {
  return items.map(musclePriorityLabel).join(" · ");
}

const UPPER_NUTRITION = "Upper-body priority day — protein stays distributed and carbs support pressing output.";
const LOWER_NUTRITION = "Lower-body priority day — carbs are placed around the session and protein stays distributed.";
const GENERAL_NUTRITION = "Protein anchor across the day, carbs around your priority session, and hydration on point.";

const UPPER_RECOVERY = "Recovery Context · shoulders, pec tissue, scapula, and t-spine.";
const LOWER_RECOVERY = "Recovery Context · hips, knees, quads, glutes, and lower back.";
const GENERAL_RECOVERY = "Recovery Context · sleep, hydration, mobility, and readiness.";

/* ── Women's Performance physique tracks (shape-frequency architecture) ──────
   Premium model / runway language. No "bikini body", "booty", "tone up", or
   sexualized language; no transformation guarantees. */
export type WomensTrackConfig = {
  track: WomensTrack;
  name: string;
  bodyDirection: string;
  /** Short emotional click line — the "happy hormone" hook that makes the member
      want to open this track. Safe, aspirational, never guaranteed. */
  desireHook: string;
  /** The progress chase — what the member gets excited tracking week to week. */
  theChase: string;
  /** Premium dream layer — the physique direction the member works toward (non-guaranteed). */
  outcomeVision: string;
  /** Potential trend targets the dashboard watches for with consistent execution. */
  visibleTrendTargets: string[];
  /** Real weekly frequency — verified against the engine (tools/audit-womens-weeks.ts). */
  weeklyRhythm: string;
  priorityMuscles: string[];
  trainingBias: string;
  conditioningBias: string;
  nutrition: string;
  /** Structured fuel intent — read by Nutrition Command + Apex. */
  nutritionIntent: NutritionIntent;
  /** How outside activity (Pilates / yoga / sport) fits this track. */
  activityCompatibility: string;
  recovery: string;
  bestFor: string;
  /** Honest fit boundary. */
  notBestFor: string;
  focusLabel: string;
  todayDirective: string;
  prioritySessions: string[];
  supportSessions: string[];
};

const WOMENS_LOWER_RECOVERY = "Recovery Context · protect hips, knees, pelvis, ankles, and the lower back so lower-body output keeps climbing.";

/* Real weekly frequencies below are verified by tools/audit-womens-weeks.ts:
   the engine (daily-context WOMENS_WEEKS + workout-templates WOMENS_SESSIONS)
   produces exactly the counts each weeklyRhythm states. */
export const WOMENS_TRACKS: Record<WomensTrack, WomensTrackConfig> = {
  runway: {
    track: "runway", name: "Runway",
    bodyDirection: "Lower-body shape, a tighter waist line, a cleaner back line, and stronger posture for a runway-ready frame.",
    desireHook: "For the member chasing a long, athletic, polished look that photographs effortlessly.",
    theChase: "Chase a sharper waistline, stronger posture, a clean shoulder and back line, glute detail, and conditioning that always looks camera-ready.",
    outcomeVision: "Built to move toward a runway-ready frame — lower-body shape, a sharper waistline, a clean back line, and stronger posture.",
    visibleTrendTargets: ["lower-body shape", "sharper waistline markers", "shoulder line / back posture", "glute detail", "conditioning trend", "camera-ready balance"],
    weeklyRhythm: "Glutes 3x, quads 2x, hamstrings 2x, calves 2x, back line / shoulders 2x, core / waist 4x, conditioning 2x. 5 training days, 2 recovery days.",
    priorityMuscles: ["Glutes", "Quads", "Hamstrings", "Back Line"],
    trainingBias: "Three lower-body exposures anchor the week — strength, shape, and a glute/hamstring shape day — while a back-line day and a sculpt day build posture and the shoulder line, and waist control keeps the frame sharp.",
    conditioningBias: "Steps and incline walking integrated daily; two structured conditioning handoffs kept low-to-moderate so they never steal lower-body growth.",
    nutrition: "Fuel Strategy · recomp or controlled cut — protein distributed, carbs protected around lower-body work, calories matched to a tighter-waist body-composition direction.",
    nutritionIntent: "recomp",
    activityCompatibility: "Pilates pairs beautifully here for core, posture, and waist control. Yoga supports recovery and mobility. Recreational sport adds conditioning — the plan eases volume if outside load runs high.",
    recovery: WOMENS_LOWER_RECOVERY,
    bestFor: "Lower-body shape, posture, waist control, and a balanced, runway-ready look.",
    notBestFor: "Members who want a single-muscle split or maximum upper-body mass — this is lower-body shape and balance.",
    focusLabel: "Glutes · Quads · Waist Control · Back Line",
    todayDirective: "Glute Strength + Waist Control",
    prioritySessions: ["Glute Strength + Waist Control", "Quad Shape + Glute Support", "Glute / Hamstring Shape"],
    supportSessions: ["Back Line + Delts + Conditioning", "Upper Sculpt + Posture"],
  },
  "glute-quad": {
    track: "glute-quad", name: "Summit",
    bodyDirection: "Glutes lead the week with complete legs underneath — fuller glutes, stronger quads and hamstrings, an athletic lower frame.",
    desireHook: "For the member who wants glutes to lead the room — without losing waistline control or full-body balance.",
    theChase: "Chase stronger hip-extension output, better lockout control, fuller lower-body photos, cleaner posture, and more consistent pump and detail days.",
    outcomeVision: "Built to move toward glute development with complete legs underneath — fuller glutes, stronger quads and hamstrings, and an athletic lower frame.",
    visibleTrendTargets: ["fuller glute measurement trend", "stronger hip-extension output", "improved hamstring detail", "quad support without stealing recovery", "stronger upper-frame posture", "waistline control markers"],
    weeklyRhythm: "Glutes 3x, quads 2x, hamstrings 2x, calves 2x, upper frame (shoulders / back / arms) 2x, core / waist 4x. 5 training days, 2 recovery days.",
    priorityMuscles: ["Glutes", "Quads", "Hamstrings", "Calves"],
    trainingBias: "Three lower-body exposures anchor the week — a glute strength day, a quad shape day, and a glute/hamstring shape day — with quads, hamstrings, and calves complete underneath, while a sculpt day and an arm/delt detail day keep the upper frame balanced.",
    conditioningBias: "Steps integrated; conditioning placed clear of lower-body recovery so glute and quad growth is protected.",
    nutrition: "Fuel Strategy · lean gain or recomp — carbs placed around lower-body sessions, protein distributed; avoid an aggressive deficit if glute growth is the main goal.",
    nutritionIntent: "lean-gain",
    activityCompatibility: "Pilates and yoga support core, hips, and recovery between lower-body days. Keep high-output sport clear of the three leg exposures so glute and quad recovery stays intact.",
    recovery: WOMENS_LOWER_RECOVERY,
    bestFor: "Lower-body shape, glute growth, complete legs, and upper-frame balance.",
    notBestFor: "Members who want an upper-body-led build — this week is leg-forward.",
    focusLabel: "Glutes · Quads · Hamstrings",
    todayDirective: "Glute Strength + Waist Control",
    prioritySessions: ["Glute Strength + Waist Control", "Quad Shape + Glute Support", "Glute / Hamstring Shape"],
    supportSessions: ["Upper Sculpt + Posture", "Back Line + Delts + Conditioning"],
  },
  "lean-recomp": {
    track: "lean-recomp", name: "Long Lines",
    bodyDirection: "Complete legs — quad sweep, hamstring shape, glutes, and calves — held lean and strong while body fat trends down and the waist stays tight.",
    desireHook: "For the member who wants complete legs — not one-dimensional lower-body work.",
    theChase: "Chase quad sweep, hamstring shape, calf detail, leg endurance, and a complete lower body that looks balanced in shorts, dresses, and training clips.",
    outcomeVision: "Built to move toward complete, sculpted legs — quad sweep, hamstring shape, and calf detail held lean while the waist stays tight.",
    visibleTrendTargets: ["stronger quad sweep", "improved hamstring shape", "calf detail", "complete lower-body balance", "glute support", "improved leg endurance"],
    weeklyRhythm: "Quads 2x, hamstrings 2x, glutes 3x, calves 2x, upper body 2x, core / waist 4x, conditioning 2x. 5 training days, 2 recovery days.",
    priorityMuscles: ["Quads", "Hamstrings", "Glutes", "Calves"],
    trainingBias: "Complete legs LEAD — a quad shape day opens the week, a glute/hamstring shape day and a glute strength day follow, with calves in rotation. Upper-frame work keeps the line balanced and conditioning is structured to protect lower-body growth under a controlled deficit.",
    conditioningBias: "Two structured conditioning handoffs support leanness without stealing lower-body growth.",
    nutrition: "Fuel Strategy · recomp or lean gain depending on your goal — high-protein, carbs protected around lower-body work, recovery meals after leg days, calories matched to a body-fat-down trend.",
    nutritionIntent: "recomp",
    activityCompatibility: "Pilates and yoga support posture, mobility, and recovery. Recreational sport adds conditioning — welcome, but kept from crushing leg recovery.",
    recovery: WOMENS_LOWER_RECOVERY,
    bestFor: "Complete legs and a tighter waist while leaning out and holding strength.",
    notBestFor: "Members who want glutes-only — this leads with complete quad-and-hamstring legs.",
    focusLabel: "Quads · Hamstrings · Glutes · Calves",
    todayDirective: "Quad Shape + Glute Support",
    prioritySessions: ["Quad Shape + Glute Support", "Glute / Hamstring Shape", "Glute Strength + Waist Control"],
    supportSessions: ["Back Line + Delts + Conditioning", "Upper Sculpt + Posture"],
  },
  "glute-upper": {
    track: "glute-upper", name: "Crown",
    bodyDirection: "Glutes lead the week while the upper body stays sculpted, with a strong shoulder line and posture.",
    desireHook: "For the member who wants maximum glute priority while keeping the full body balanced.",
    theChase: "Chase glute exposure consistency, pump and detail quality, stronger lockout control, hamstring support, and a sculpted upper frame underneath.",
    outcomeVision: "Built to move toward glute development crowned by a sculpted shoulder line and strong posture.",
    visibleTrendTargets: ["glute priority exposure", "hamstring detail", "pelvic control / lockout quality", "upper-frame maintenance", "pump / detail day consistency", "lower-back takeover reduction cues"],
    weeklyRhythm: "Glutes 3x, quads 2x, hamstrings 2x, calves 2x, back line / shoulders 2x, core / waist 4x, conditioning 2x. 5 training days, 2 recovery days.",
    priorityMuscles: ["Glutes", "Back Line", "Delts", "Waist Control"],
    trainingBias: "Glutes lead with three exposures while the upper frame is doubled — a sculpt day and a back-line day build the shoulder line and posture — without stealing lower-body recovery.",
    conditioningBias: "Steps integrated; conditioning kept light to protect glute recovery.",
    nutrition: "Fuel Strategy · lean gain or recomp — protein distributed, carbs around glute sessions, calories matched to your goal; avoid an aggressive deficit if glute growth leads.",
    nutritionIntent: "lean-gain",
    activityCompatibility: "Pilates supports core, posture, and the waist line directly. Yoga supports recovery. Keep sport light so glute recovery is protected.",
    recovery: WOMENS_LOWER_RECOVERY,
    bestFor: "Glute development with a sculpted shoulder line and strong posture.",
    notBestFor: "Members who want maximum quad volume — quads are supported, not the lead.",
    focusLabel: "Glutes · Back Line · Delts",
    todayDirective: "Glute Strength + Waist Control",
    prioritySessions: ["Glute Strength + Waist Control", "Glute / Hamstring Shape", "Quad Shape + Glute Support"],
    supportSessions: ["Upper Sculpt + Posture", "Back Line + Delts + Conditioning"],
  },
  "athletic-model": {
    track: "athletic-model", name: "Off-Duty",
    bodyDirection: "Strong, conditioned, and athletic — a lean lower frame with shoulder and back-line detail.",
    desireHook: "For the member who wants a body that both performs and photographs well.",
    theChase: "Chase work capacity, conditioning output, athletic lower-body strength, back and shoulder detail, and core bracing that makes the physique look capable.",
    outcomeVision: "Built to move toward a strong, conditioned, athletic physique — a lean lower frame with shoulder and back-line detail.",
    visibleTrendTargets: ["athletic lower-body strength", "stronger posture", "conditioning output", "back and shoulder detail", "improved work capacity", "core bracing consistency"],
    weeklyRhythm: "Lower body 3x (quads 2x, hamstrings 2x, glutes 3x, calves 2x), upper body 2x, conditioning 2x, core / waist 4x. 5 training days, 2 recovery days.",
    priorityMuscles: ["Glutes", "Hamstrings", "Back Line", "Conditioning"],
    trainingBias: "A quad shape day opens an athletic, conditioned week: three lower exposures build the lower frame, two upper days sharpen the shoulder and back line, and two conditioning handoffs keep it lean.",
    conditioningBias: "Two conditioning handoffs build a strong, athletic, lean look.",
    nutrition: "Fuel Strategy · performance recomp — protein distributed, carbs matched to conditioning and training days, hydration and steps on point.",
    nutritionIntent: "recomp",
    activityCompatibility: "Sport fits naturally — this is the athletic track. Pilates and yoga support mobility and recovery. The plan eases leg volume on weeks with heavy sport load.",
    recovery: WOMENS_LOWER_RECOVERY,
    bestFor: "A strong, conditioned, athletic physique with shoulder and back-line detail.",
    notBestFor: "Members who only want size — this prioritizes conditioning and athletic output too.",
    focusLabel: "Glutes · Hamstrings · Back Line · Conditioning",
    todayDirective: "Quad Shape + Glute Support",
    prioritySessions: ["Quad Shape + Glute Support", "Glute Strength + Waist Control", "Glute / Hamstring Shape"],
    supportSessions: ["Back Line + Delts + Conditioning", "Upper Sculpt + Posture"],
  },
  "lifestyle-shape": {
    track: "lifestyle-shape", name: "Resort",
    bodyDirection: "An efficient, summer-ready shape — lower-body priority with upper detail and manageable fatigue.",
    desireHook: "For the member who wants to feel sharper in summer clothes, vacation photos, pool days, and everyday outfits.",
    theChase: "Chase a tighter waistline, glute and leg detail, an upper-body finish, and conditioning consistency — without burying recovery on a busy week.",
    outcomeVision: "Built to move toward a summer-ready, vacation physique — lower-body priority with upper detail and manageable fatigue.",
    visibleTrendTargets: ["summer physique readiness", "waistline control", "glute / leg detail", "upper-body finish", "conditioning consistency", "manageable fatigue"],
    weeklyRhythm: "Glutes 3x, quads 2x, hamstrings 2x, calves 2x, upper body (back / shoulders) 2x, core / waist 4x, conditioning 2x. 5 training days, 2 protected recovery days.",
    priorityMuscles: ["Glutes", "Quads", "Back Line", "Waist Control"],
    trainingBias: "An efficient lower-plus-upper rotation — glute strength, quad shape, and a controlled glute/hamstring detail day complete the legs while two upper-frame exposures and two recovery days keep fatigue manageable.",
    conditioningBias: "Gentle steps and mobility plus two manageable conditioning handoffs.",
    nutrition: "Fuel Strategy · controlled cut or recomp — simple protein-anchored meals, smart carbs around training, lighter rest-day structure; no bulking meal plan while a summer-lean goal is active.",
    nutritionIntent: "cut",
    activityCompatibility: "Pilates and yoga are ideal partners on the lighter days for core, mobility, and recovery. Sport adds enjoyable conditioning without overloading a busy week.",
    recovery: WOMENS_LOWER_RECOVERY,
    bestFor: "A summer-ready physique with lower-body priority on a busy schedule.",
    notBestFor: "Members with high training availability chasing maximum volume — this is an efficient, busy-week structure.",
    focusLabel: "Glutes · Quads · Waist Control",
    todayDirective: "Glute Strength + Waist Control",
    prioritySessions: ["Glute Strength + Waist Control", "Quad Shape + Glute Support"],
    supportSessions: ["Back Line + Delts + Conditioning", "Upper Sculpt + Posture"],
  },
  "signature-shape": {
    track: "signature-shape", name: "Signature",
    bodyDirection: "A balanced feminine physique foundation spanning lower body, upper frame, core, posture, and conditioning.",
    desireHook: "For the member who wants every part of the week to feel intentional, polished, and complete.",
    theChase: "Chase balanced weekly coverage, posture, lower-body shape, core consistency, and sustainable conditioning.",
    outcomeVision: "Built to move toward balanced lower-body shape, an elegant upper frame, consistent core work, and strong posture.",
    visibleTrendTargets: ["lower-body shape", "upper-frame balance", "core consistency", "posture", "conditioning rhythm", "recovery consistency"],
    weeklyRhythm: "Lower body 3x, upper frame 2x, core / waist 4x, conditioning 2x. 5 training days, 2 recovery days.",
    priorityMuscles: ["Glutes", "Quads", "Hamstrings", "Back Line"],
    trainingBias: "A balanced shape-frequency foundation with complete lower-body coverage, upper-frame detail, core control, and conditioning.",
    conditioningBias: "Two controlled conditioning handoffs support a sustainable weekly rhythm.",
    nutrition: "Fuel Strategy · recomp — protein anchored with day-type fuel matched to the active session.", nutritionIntent: "recomp",
    activityCompatibility: "Gym-only and hybrid weeks both fit; Pilates, yoga, or sport load trims redundant accessory work.",
    recovery: WOMENS_LOWER_RECOVERY, bestFor: "A complete foundation before sharper specialization.", notBestFor: "Maximum single-muscle specialization.",
    focusLabel: "Lower Body · Upper Frame · Core · Posture", todayDirective: "Glute Strength + Waist Control",
    prioritySessions: ["Glute Strength + Waist Control", "Quad Shape + Glute Support", "Glute / Hamstring Shape"], supportSessions: ["Back Line + Delts + Conditioning", "Upper Sculpt + Posture"],
  },
  "hybrid-pilates": {
    track: "hybrid-pilates", name: "Studio",
    bodyDirection: "Gym strength blended with posture, core, mobility, and low-fatigue refinement.",
    desireHook: "For the member who wants strength to feel elegant, controlled, and beautifully aligned.",
    theChase: "Chase cleaner core control, posture, glute detail, shoulder line, and mobility consistency.",
    outcomeVision: "Built to move toward lower-body shape, core control, posture, shoulder line, and mobility consistency with lower fatigue.",
    visibleTrendTargets: ["core control", "posture", "glute detail", "shoulder line", "mobility consistency", "waistline markers"],
    weeklyRhythm: "Lower body 3x, upper frame 2x, core / waist 4x, conditioning 2x, Pilates / hybrid activity 2x, recovery / mobility layers 3x.",
    priorityMuscles: ["Glutes", "Quads", "Core", "Back Line"],
    trainingBias: "Four focused gym sessions pair with a low-fatigue Pilates, upper-detail, and steps day so outside activity contributes without replacing upper-frame or conditioning work.",
    conditioningBias: "Pilates, yoga, and steps provide low-fatigue activity; redundant gym conditioning is removed.",
    nutrition: "Fuel Strategy · recomp or controlled cut — protein anchored, gym-day carbs protected, lighter days structured without underfueling.", nutritionIntent: "recomp",
    activityCompatibility: "Built for Gym + Pilates, Pilates + Yoga, and Full Hybrid Week.", recovery: WOMENS_LOWER_RECOVERY,
    bestFor: "Posture, core control, mobility, and lower-fatigue physique work.", notBestFor: "Maximum gym volume.",
    focusLabel: "Glutes · Core · Posture · Mobility", todayDirective: "Glute Strength + Waist Control",
    prioritySessions: ["Glute Strength + Waist Control", "Quad Shape + Glute Support", "Glute / Hamstring Shape"], supportSessions: ["Pilates Shape + Posture", "Upper Sculpt + Posture"],
  },
  "sport-strength": {
    track: "sport-strength", name: "Field",
    bodyDirection: "Strength and physique work organized around sport, conditioning, and variable leg fatigue.",
    desireHook: "For the member who wants strong, sport-ready legs and a balanced physique without training collisions.",
    theChase: "Chase conditioning consistency, lower-body strength, recovery management, upper-frame detail, and core bracing.",
    outcomeVision: "Built to move toward lower-body strength, recovery-managed conditioning, back and shoulder detail, and sport-ready core control.",
    visibleTrendTargets: ["conditioning consistency", "lower-body strength", "recovery management", "back detail", "shoulder detail", "core bracing"],
    weeklyRhythm: "Strength 3x, sport / conditioning 3x, lower body 3x, upper frame 2x, core 4x, recovery / mobility layers 3x, sport exposures 2x.",
    priorityMuscles: ["Glutes", "Quads", "Hamstrings", "Core"],
    trainingBias: "Strength sessions sit clear of sport load, with a controlled upper-frame finish, core and mobility preserved, and hard leg work never stacked blindly before sport.",
    conditioningBias: "Sport counts as conditioning and leg load; redundant finishers are removed.",
    nutrition: "Fuel Strategy · high-output hybrid support — protein anchored and carbs protected around sport and strength days.", nutritionIntent: "high-output-hybrid",
    activityCompatibility: "Built for Gym + Sports and Gym + Pilates + Sports.", recovery: WOMENS_LOWER_RECOVERY,
    bestFor: "Sport plus serious strength and physique work.", notBestFor: "Members without meaningful sport load.",
    focusLabel: "Lower Strength · Sport · Core · Upper Frame", todayDirective: "Lower Strength + Core",
    prioritySessions: ["Lower Strength + Core", "Glute / Hamstring Shape", "Quad Shape + Glute Support"], supportSessions: ["Upper Sculpt + Posture", "Sport / Conditioning + Mobility"],
  },
};

/**
 * Resolve the member's muscle-priority selection into a focus-aware
 * architecture. Pure + deterministic. `womensActive` only changes the
 * naming prefix (the Women's Performance System owns the protocol context) —
 * the focus itself is always member-selected, never assumed from gender.
 */
export function resolveFocusArchitecture(
  focus: PhysiqueFocus | undefined,
  opts?: { womensActive?: boolean; trainingDays?: number },
): FocusArchitecture {
  /* Women's physique track takes precedence — shape-frequency architecture. */
  if (focus?.track) {
    const t = WOMENS_TRACKS[focus.track];
    return {
      active: true,
      focusLabel: t.focusLabel,
      architectureName: t.name,
      region: "lower",
      weeklyBias: t.trainingBias,
      prioritySessions: t.prioritySessions,
      supportSessions: t.supportSessions,
      sessionDirective: t.trainingBias,
      todayDirective: t.todayDirective,
      nutritionContext: t.nutrition,
      recoveryContext: t.recovery,
      evidenceNeeded: null,
      fallbackReason: null,
    };
  }

  const primary = focus?.primary ?? null;
  const secondary = focus?.secondary ?? [];
  const support = focus?.support ?? [];
  const prefix = opts?.womensActive ? "Women's " : "";

  if (!primary) {
    return {
      active: false,
      focusLabel: "Balanced",
      architectureName: `${prefix}Balanced Architecture`,
      region: "general",
      weeklyBias: "Balanced development — every region progresses together.",
      prioritySessions: [],
      supportSessions: [],
      sessionDirective: "Balanced architecture — no single priority tissue selected.",
      todayDirective: "Balanced architecture",
      nutritionContext: GENERAL_NUTRITION,
      recoveryContext: GENERAL_RECOVERY,
      evidenceNeeded: "Focus tissue not set — Reserve is using balanced architecture. Choose a priority to bias the week.",
      fallbackReason: "No primary focus selected.",
    };
  }

  const focusLabel = [primary, ...secondary].map(musclePriorityLabel).join(" · ");
  const supportLabel = support.length ? focusListLabel(support) : null;

  /* ── Chest / upper-chest priority ── */
  if (CHEST.has(primary)) {
    const upper = primary === "upper-chest" || secondary.includes("upper-chest");
    return {
      active: true,
      focusLabel,
      architectureName: `${prefix}${upper ? "Upper-Chain Chest Priority Rotation" : "Chest Priority Rotation"}`,
      region: "upper",
      weeklyBias: "Chest leads the week — Chest / Back A becomes Chest Priority + Back Support, with a second chest exposure later in the week when schedule and recovery allow.",
      prioritySessions: ["Chest Priority + Back Support", "Second Chest Exposure"],
      supportSessions: ["Delts + Arms", "Lower Body", ...(supportLabel ? [supportLabel] : [])],
      sessionDirective: "Chest leads the week. Upper chest receives first exposure, then back supports posture and width.",
      todayDirective: `Chest Priority · ${upper ? "Upper chest first" : "Chest first"} · back support`,
      nutritionContext: UPPER_NUTRITION,
      recoveryContext: UPPER_RECOVERY,
      evidenceNeeded: null,
      fallbackReason: null,
    };
  }

  /* ── Glute / quad / lower-body priority ── */
  if (primary === "glutes") {
    const quads = secondary.includes("quads");
    return {
      active: true,
      focusLabel,
      architectureName: quads ? "Glute + Quad Priority Rotation" : "Glute Priority Rotation",
      region: "lower",
      weeklyBias: quads
        ? "Glutes lead the architecture with dedicated quad volume — two lower-body priority days, upper body maintained, recovery protecting hips, knees, and lower back."
        : "Glutes lead the architecture — a glute strength day and a glute / hamstring shape day, with upper body maintained and recovery protecting hips and lower back.",
      prioritySessions: ["Glute Strength Priority", ...(quads ? ["Quad Volume Priority"] : []), "Glute / Hamstring Shape"],
      supportSessions: ["Upper Maintenance", "Upper Detail + Core", ...(supportLabel ? [supportLabel] : [])],
      sessionDirective: quads
        ? "Glutes lead the architecture. Quads receive dedicated volume while upper body stays maintained."
        : "Glutes lead the architecture. Upper body stays maintained while recovery protects the hips and lower back.",
      todayDirective: quads ? "Glute Strength Priority / Quad Volume Priority" : "Glute Strength Priority",
      nutritionContext: LOWER_NUTRITION,
      recoveryContext: LOWER_RECOVERY,
      evidenceNeeded: null,
      fallbackReason: null,
    };
  }

  if (primary === "quads") {
    const glutes = secondary.includes("glutes");
    return {
      active: true,
      focusLabel,
      architectureName: glutes ? "Complete Legs Architecture" : "Quad Priority Rotation",
      region: "lower",
      weeklyBias: "Quads lead the architecture — knee-dominant volume prioritized, glutes and hamstrings supported, upper body maintained.",
      prioritySessions: ["Quad Volume Priority", ...(glutes ? ["Glute Strength Priority"] : []), "Lower Shape + Calves"],
      supportSessions: ["Upper Maintenance", "Upper Detail + Core", ...(supportLabel ? [supportLabel] : [])],
      sessionDirective: "Quads lead the architecture. Knee-dominant volume is prioritized while upper body stays maintained.",
      todayDirective: "Quad Volume Priority",
      nutritionContext: LOWER_NUTRITION,
      recoveryContext: LOWER_RECOVERY,
      evidenceNeeded: null,
      fallbackReason: null,
    };
  }

  if (primary === "hamstrings") {
    return {
      active: true, focusLabel,
      architectureName: "Posterior Chain Sculpt",
      region: "lower",
      weeklyBias: "Posterior chain leads — hinge and hamstring volume prioritized, glutes supported, upper body maintained.",
      prioritySessions: ["Posterior Strength Priority", "Hamstring / Glute Shape"],
      supportSessions: ["Upper Maintenance", ...(supportLabel ? [supportLabel] : [])],
      sessionDirective: "The posterior chain leads. Hinge and hamstring volume is prioritized while upper body stays maintained.",
      todayDirective: "Posterior Chain Priority",
      nutritionContext: LOWER_NUTRITION, recoveryContext: LOWER_RECOVERY,
      evidenceNeeded: null, fallbackReason: null,
    };
  }

  /* ── Upper-body non-chest priorities ── */
  if (BACK.has(primary)) {
    const width = primary === "back-width";
    return {
      active: true, focusLabel,
      architectureName: `${prefix}Back Priority Rotation`,
      region: "upper",
      weeklyBias: `Back leads the upper week — ${width ? "width and lat work" : "thickness and row volume"} prioritized, chest and delts supported.`,
      prioritySessions: ["Back Priority + Chest Support", "Second Back Exposure"],
      supportSessions: ["Chest + Delts", "Lower Body", ...(supportLabel ? [supportLabel] : [])],
      sessionDirective: `Back leads the week. ${width ? "Width and lat work" : "Thickness and row volume"} get first exposure while chest stays supported.`,
      todayDirective: `Back Priority · ${width ? "Width first" : "Thickness first"} · chest support`,
      nutritionContext: UPPER_NUTRITION, recoveryContext: UPPER_RECOVERY,
      evidenceNeeded: null, fallbackReason: null,
    };
  }

  if (primary === "delts") {
    return {
      active: true, focusLabel,
      architectureName: `${prefix}Delt Priority Rotation`,
      region: "upper",
      weeklyBias: "Delts lead the upper week — overhead and lateral volume prioritized, chest and back supported.",
      prioritySessions: ["Delt Priority + Press Support", "Lateral Volume Day"],
      supportSessions: ["Chest + Back", "Arms + Core", ...(supportLabel ? [supportLabel] : [])],
      sessionDirective: "Delts lead the week. Overhead and lateral volume get first exposure while chest and back stay supported.",
      todayDirective: "Delt Priority · laterals first · press support",
      nutritionContext: UPPER_NUTRITION, recoveryContext: UPPER_RECOVERY,
      evidenceNeeded: null, fallbackReason: null,
    };
  }

  if (primary === "arms") {
    return {
      active: true, focusLabel,
      architectureName: `${prefix}Arm Specialization Rotation`,
      region: "upper",
      weeklyBias: "Arms get dedicated specialization volume — biceps and triceps prioritized, chest and back maintained.",
      prioritySessions: ["Arm Specialization Priority", "Second Arm Exposure"],
      supportSessions: ["Chest + Back", "Lower Body", ...(supportLabel ? [supportLabel] : [])],
      sessionDirective: "Arms get dedicated specialization. Biceps and triceps lead while chest and back stay maintained.",
      todayDirective: "Arm Specialization · direct volume",
      nutritionContext: UPPER_NUTRITION, recoveryContext: UPPER_RECOVERY,
      evidenceNeeded: null, fallbackReason: null,
    };
  }

  /* ── Calves / core / conditioning / mobility — emphasis layered on balance ── */
  const emphasisName = primary === "calves" ? "Calf Specialization"
    : primary === "core" ? "Core Priority"
    : primary === "conditioning" ? "Conditioning Priority"
    : "Mobility-Forward";
  const lowerish = primary === "calves";
  return {
    active: true, focusLabel,
    architectureName: `${prefix}${emphasisName} Rotation`,
    region: lowerish ? "lower" : "general",
    weeklyBias: `${musclePriorityLabel(primary)} gets dedicated emphasis inside a complete, balanced week.`,
    prioritySessions: [`${musclePriorityLabel(primary)} Emphasis`],
    supportSessions: ["Balanced Upper", "Balanced Lower", ...(supportLabel ? [supportLabel] : [])],
    sessionDirective: `${musclePriorityLabel(primary)} gets extra emphasis inside a complete week — the rest of the physique keeps progressing.`,
    todayDirective: `${musclePriorityLabel(primary)} Emphasis`,
    nutritionContext: lowerish ? LOWER_NUTRITION : GENERAL_NUTRITION,
    recoveryContext: lowerish ? LOWER_RECOVERY : GENERAL_RECOVERY,
    evidenceNeeded: null, fallbackReason: null,
  };
}
