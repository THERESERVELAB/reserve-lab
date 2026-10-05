/* ════════════════════════════════════════════════════════════════════════
   SPLIT ARCHITECTURE LIBRARY — real coach-designed week structures.

   Each architecture is a 7-slot week whose day titles alias-resolve to the
   authored workout templates (workout-templates.ts) — never invented
   sessions. When a member SAVES an architecture in Personal Command /
   Split Architect it becomes the durable coaching blueprint every future
   week is built from, until the member intentionally changes it.

   The authored week is a CYCLE, not a calendar: the member chooses their rest
   day and the whole cycle turns to meet it (arrangeWeekAroundRest). Day copy
   therefore never names a weekday.

   Weak points still shape emphasis INSIDE a week; they never replace the
   member's chosen structure.
   ════════════════════════════════════════════════════════════════════════ */

import type { SplitActivityKey } from "./split-activities";
import type { SessionArchetype } from "./split-blueprints";

export type ArchitectureDay = {
  /** Human title — MUST alias-resolve via resolveSplitKey unless the day is
      recovery, an activity, or archetype-backed. Asserted by the
      split-customization suite, so a day titled "Arms" cannot ship. */
  title: string;
  /** Optional explicit archetype (conditioning days, rotations, a fixed leg bias). */
  archetype?: SessionArchetype;
  /** A non-lifting day inside the split — a track session, a run, a class.
      The cockpit renders it as an activity and never loads a gym template. */
  activity?: SplitActivityKey;
  recovery?: boolean;
  goal: string;
  reason: string;
};

export type SplitArchitecture = {
  key: string;
  name: string;
  daysPerWeek: number;
  /** Who the architecture is offered to. Absent = everyone. "womens" keeps it
      out of a male member's catalog, recommendation and deeper disclosure. */
  audience?: "womens";
  week: ArchitectureDay[]; // exactly 7 entries — the authored cycle, Monday-first by default
};

const R = (goal: string): ArchitectureDay => ({
  title: "Recovery",
  recovery: true,
  goal,
  reason: "Recovery is programmed, not accidental — the next block is built tonight.",
});

export const SPLIT_ARCHITECTURES: Record<string, SplitArchitecture> = {
  /* ── The mission's elite six-day — chosen by name, never suggested ── */
  "elite-six": {
    key: "elite-six",
    name: "Elite Six-Day Architecture",
    daysPerWeek: 6,
    week: [
      { title: "Chest / Back A", goal: "Upper-torso strength opener", reason: "Heavy press + pull set the week's standard while the reserve is full." },
      { title: "Legs", goal: "Lower-body growth volume", reason: "First lower exposure lands early so the week can recover around it." },
      { title: "Conditioning", archetype: "conditioning", goal: "Engine + work capacity", reason: "Conditioning between the lifting days restores movement quality without stealing recovery." },
      { title: "Arms / Delts", goal: "Specialization volume", reason: "Delts and arms get their own day — not leftovers after pressing." },
      { title: "Legs", archetype: "hamstring-glute", goal: "Posterior-biased second exposure", reason: "Second lower session biases hamstrings/glutes for balanced development." },
      { title: "Chest / Back B", goal: "Upper-torso density", reason: "Second upper exposure runs controlled volume on the recovered frame." },
      R("Restore output · mobility"),
    ],
  },
  /* ── Arnold split — classic 6-day antagonist pairing, chosen by name ── */
  arnold: {
    key: "arnold",
    name: "Arnold Split",
    daysPerWeek: 6,
    week: [
      { title: "Chest / Back A", goal: "Antagonist supersets — press + pull", reason: "The classic pairing: chest and back pump each other while one rests." },
      { title: "Arms / Delts", goal: "Shoulders + arms detail", reason: "Delts and arms take a full day — the Arnold signature." },
      { title: "Legs", goal: "Complete lower session", reason: "Quads, hamstrings, calves in one focused block." },
      { title: "Chest / Back B", goal: "Second antagonist exposure", reason: "Frequency drives the classic upper-body density." },
      { title: "Arms / Delts", goal: "Second delt/arm exposure", reason: "Twice-weekly specialization keeps the frame sharp." },
      { title: "Legs", goal: "Second lower exposure", reason: "Balanced weekly volume across the lower body." },
      R("Full rest · posing / mobility"),
    ],
  },
  /* ── Push / Pull / Legs ×2 ── */
  ppl: {
    key: "ppl",
    name: "Push / Pull / Legs",
    daysPerWeek: 6,
    week: [
      { title: "Push", goal: "Chest, shoulders and triceps — pressing day", reason: "All pressing patterns share one recovery bucket." },
      { title: "Pull", goal: "Back, biceps, forearms and traps — pulling day", reason: "Complete pull patterns with the pressing muscles resting." },
      { title: "Legs", goal: "Complete lower session", reason: "Lower body takes its own day at full quality." },
      { title: "Push", goal: "Second pressing exposure", reason: "Twice-weekly frequency for steady pressing progress." },
      { title: "Pull", goal: "Second pulling exposure", reason: "Back thickness and width both get weekly space." },
      { title: "Legs", goal: "Second lower exposure", reason: "Six quality days, every pattern twice." },
      R("Restore · protect the next push"),
    ],
  },
  /* ── PPL + Upper / Lower (5-day) ── */
  "ppl-ul": {
    key: "ppl-ul",
    name: "PPL + Upper / Lower",
    daysPerWeek: 5,
    week: [
      { title: "Push", goal: "Pressing day", reason: "The cycle opens with the highest-skill pressing work." },
      { title: "Pull", goal: "Pulling day", reason: "Back follows while pressing recovers." },
      { title: "Legs", goal: "Complete lower session", reason: "Lower body takes its own day at full quality." },
      R("Restoration between blocks"),
      { title: "Upper", goal: "Full upper composite", reason: "Second exposure for every upper pattern in one dense session." },
      { title: "Lower", goal: "Second lower exposure", reason: "Posterior-biased finish to balance the first leg session." },
      R("Full rest before the next block"),
    ],
  },
  /* ── Upper / Lower (4-day) ── */
  "upper-lower": {
    key: "upper-lower",
    name: "Upper / Lower",
    daysPerWeek: 4,
    week: [
      { title: "Upper", goal: "Upper strength emphasis", reason: "Heavy press + pull while the week's reserve is full." },
      { title: "Lower", goal: "Lower strength emphasis", reason: "Squat-pattern priority on fresh legs." },
      R("Restoration between blocks"),
      { title: "Upper", goal: "Upper volume emphasis", reason: "Second exposure runs controlled hypertrophy volume." },
      { title: "Lower", goal: "Lower volume emphasis", reason: "Posterior-chain bias balances the week." },
      R("Restoration"),
      R("Full rest · mobility"),
    ],
  },
  /* ── Powerbuilding (5-day) ── */
  powerbuilding: {
    key: "powerbuilding",
    name: "Powerbuilding",
    daysPerWeek: 5,
    week: [
      { title: "Upper", goal: "Top-set strength — press + row", reason: "Heavy top sets first, back-off hypertrophy after." },
      { title: "Lower", goal: "Top-set strength — squat pattern", reason: "Strength work leads while the nervous system is fresh." },
      R("Restoration between blocks"),
      { title: "Push", goal: "Hypertrophy volume — pressing", reason: "Volume day converts the strength work into size." },
      { title: "Pull", goal: "Hypertrophy volume — pulling", reason: "Back volume with the heavy hinge recovered." },
      { title: "Legs", goal: "Hypertrophy volume — lower", reason: "The cycle closes with growth-focused lower volume." },
      R("Full rest"),
    ],
  },
  /* ── Strength-Hypertrophy hybrid (5-day) ── */
  "strength-hypertrophy": {
    key: "strength-hypertrophy",
    name: "Strength-Hypertrophy",
    daysPerWeek: 5,
    /* The hypertrophy half runs Push / Pull / Legs. It used to put a
       "Chest / Back A" day here — one of five library splits that paired chest
       with back without the split's own identity calling for it. */
    week: [
      { title: "Upper", goal: "Strength — heavy press/pull", reason: "Low-rep quality on the anchor lifts." },
      { title: "Lower", goal: "Strength — heavy squat/hinge", reason: "Heavy lower work early in the cycle." },
      R("Restoration between blocks"),
      { title: "Push", goal: "Hypertrophy — pressing volume", reason: "Growth-range pressing with the heavy work banked." },
      { title: "Pull", goal: "Hypertrophy — pulling volume", reason: "Back volume on a recovered frame." },
      { title: "Legs", goal: "Hypertrophy — lower volume", reason: "Growth-rep ranges close the training week." },
      R("Full rest"),
    ],
  },
  /* ── Hybrid athlete (5-day + engine) ── */
  "hybrid-athlete": {
    key: "hybrid-athlete",
    name: "Hybrid Athlete",
    daysPerWeek: 5,
    week: [
      { title: "Full Body", goal: "Athletic strength — compound focus", reason: "Movement-quality strength work opens the cycle." },
      { title: "Conditioning", archetype: "conditioning", goal: "Engine — aerobic base", reason: "Dedicated engine work, separated from lifting." },
      { title: "Lower", goal: "Lower strength + power", reason: "Force production on fresh legs." },
      { title: "Upper", goal: "Upper strength + volume", reason: "Complete upper exposure in one session." },
      { title: "Conditioning", archetype: "sport-conditioning", goal: "Mixed conditioning / sport", reason: "Second engine exposure at higher intensity." },
      R("Restoration + mobility"),
      R("Full rest"),
    ],
  },
  /* ── High-frequency physique (6-day) ── */
  "high-frequency": {
    key: "high-frequency",
    name: "High-Frequency Physique",
    daysPerWeek: 6,
    week: [
      { title: "Push", goal: "Pressing — strength bias", reason: "First of three upper waves this week." },
      { title: "Legs", archetype: "quad-focus", goal: "Lower — quad bias", reason: "First lower wave; quads lead while fresh." },
      { title: "Pull", goal: "Pulling — width bias", reason: "Lat-focused pull with pressing recovering." },
      { title: "Upper", goal: "Upper composite — volume", reason: "Second upper wave at controlled volume." },
      { title: "Lower", goal: "Lower — posterior bias", reason: "Second lower wave, hinge-led." },
      { title: "Upper Specialization", goal: "Detail wave — weak points", reason: "The cycle closes on the member's priority regions." },
      R("Full rest"),
    ],
  },
  /* ── Recovery-constrained (4-day, wide spacing) ── */
  "recovery-constrained": {
    key: "recovery-constrained",
    name: "Recovery-Constrained Split",
    daysPerWeek: 4,
    week: [
      { title: "Upper", goal: "Complete upper — quality first", reason: "Everything upper in one high-quality session." },
      R("Programmed recovery"),
      { title: "Lower", goal: "Complete lower — quality first", reason: "Full lower exposure with a fresh reserve." },
      R("Programmed recovery"),
      { title: "Upper", goal: "Upper density", reason: "Second upper exposure, density-led." },
      { title: "Lower", goal: "Lower volume", reason: "Second lower exposure closes the week." },
      R("Full rest"),
    ],
  },
  /* ── Contest prep (6-day) — pairs chest with back, chosen by name ── */
  "contest-prep": {
    key: "contest-prep",
    name: "Contest Prep Architecture",
    daysPerWeek: 6,
    week: [
      { title: "Chest / Back A", goal: "Upper torso — strength retention", reason: "Holding strength is the prep's honesty check." },
      { title: "Legs", archetype: "quad-focus", goal: "Lower — quad emphasis", reason: "Leg detail early while glycogen is highest." },
      { title: "Arms / Delts", goal: "Delts + arms — cap the frame", reason: "Shoulder line and arm detail for the stage look." },
      { title: "Posterior Legs", goal: "Hamstring / glute detail", reason: "Posterior sweep and glute-ham tie-in work." },
      { title: "Upper Specialization", goal: "Weak-point detail wave", reason: "The member's judged weak points get the closing exposure." },
      { title: "Conditioning", archetype: "conditioning", goal: "Conditioning — look-preserving", reason: "Engine work placed where it can't steal lifting recovery." },
      R("Full rest · posing practice"),
    ],
  },
  /* ── Classic Symmetry (6-day) — proportion without pairing chest and back ── */
  "classic-symmetry": {
    key: "classic-symmetry",
    name: "Classic Symmetry Split",
    daysPerWeek: 6,
    week: [
      { title: "Push", goal: "Chest, shoulders and triceps", reason: "Pressing leads while the reserve is full." },
      { title: "Legs", goal: "Complete lower session", reason: "Lower body takes its own day at full quality." },
      { title: "Pull", goal: "Back, biceps, forearms and traps", reason: "Width and thickness with pressing recovering." },
      { title: "Arms / Delts", goal: "Shoulder line and arm detail", reason: "The classic line is built on delts and arms, so they get their own day." },
      { title: "Lower", goal: "Lower composite — posterior bias", reason: "Hamstrings and glutes balance the first leg session." },
      { title: "Upper Specialization", goal: "Detail wave — weak points", reason: "Proportion closes on the member's priority regions." },
      R("Restore · mobility"),
    ],
  },
  /* ── Event-Ready (6-day) — output now, sharpness near the date ── */
  "event-ready": {
    key: "event-ready",
    name: "Event-Ready Split",
    daysPerWeek: 6,
    week: [
      { title: "Push", goal: "Chest, shoulders and triceps — strength held", reason: "Holding pressing strength keeps the week honest as the date nears." },
      { title: "Legs", goal: "Complete lower session", reason: "Lower body lands while energy is highest." },
      { title: "Pull", goal: "Back, biceps, forearms and traps", reason: "Back width frames the physique." },
      { title: "Conditioning", archetype: "conditioning", goal: "Conditioning — look-preserving", reason: "Engine work placed where it can't steal lifting recovery." },
      { title: "Upper Specialization", goal: "Detail wave — weak points", reason: "The member's priority regions get the closing upper exposure." },
      { title: "Lower", goal: "Lower composite — posterior bias", reason: "Hamstring and glute detail balance the first leg session." },
      R("Full rest"),
    ],
  },
  /* ── Push / Pull / Legs / Arms / Upper / Lower (6-day) ──
     Pattern days first, an arm day, then the two composites. With a
     Wednesday rest day the cycle reads Upper, Lower, Rest, Push, Pull, Legs,
     Arms — the week members asked for. */
  pplula: {
    key: "pplula",
    name: "Push / Pull / Legs / Arms / Upper / Lower",
    daysPerWeek: 6,
    week: [
      { title: "Push", goal: "Chest, shoulders and triceps", reason: "Pressing leads the cycle while the reserve is full." },
      { title: "Pull", goal: "Back, biceps, forearms and traps", reason: "Complete pulling with pressing recovering." },
      { title: "Legs", goal: "Complete lower session", reason: "Lower body takes its own day at full quality." },
      /* "Arm Day", never bare "Arms" — the alias table only matches "arm day". */
      { title: "Arm Day", goal: "Biceps, triceps and forearms", reason: "Arms get a full day rather than leftovers after pressing." },
      { title: "Upper", goal: "Upper composite — second exposure", reason: "Every upper pattern again, in one dense session." },
      { title: "Lower", goal: "Lower composite — second exposure", reason: "A second lower exposure balances the Legs session." },
      R("Restore · protect the next push"),
    ],
  },
  /* ── Classic bodybuilding split (5-day, one region per day) ── */
  "bro-split": {
    key: "bro-split",
    name: "Classic Bodybuilding Split",
    daysPerWeek: 5,
    week: [
      { title: "Chest Day", goal: "Chest — full volume", reason: "One region per day, trained to completion." },
      { title: "Back Day", goal: "Back width and thickness", reason: "The whole back gets the session to itself." },
      { title: "Legs", goal: "Complete lower session", reason: "Lower body between the upper days, recovered on both sides." },
      { title: "Shoulders", goal: "Delts — all three heads", reason: "Shoulders stand alone, not after pressing." },
      { title: "Arm Day", goal: "Biceps and triceps", reason: "Arms close the cycle on fresh elbows." },
      R("Restoration"),
      R("Full rest"),
    ],
  },
  /* ── Full Body ×3 ── */
  "full-body-3": {
    key: "full-body-3",
    name: "Full Body ×3",
    daysPerWeek: 3,
    week: [
      { title: "Full Body", goal: "Every major pattern — strength bias", reason: "Three complete sessions cover the whole week." },
      R("Restoration"),
      { title: "Full Body", goal: "Every major pattern — volume bias", reason: "A full day between exposures protects quality." },
      R("Restoration"),
      { title: "Full Body", goal: "Every major pattern — density bias", reason: "The third exposure closes the cycle." },
      R("Restoration"),
      R("Full rest"),
    ],
  },
  /* ── Hybrid Bodybuilder (6-day) ──
     A physique split with a real track day and a full-body finisher — how
     hybrid athletes actually run their week. */
  "hybrid-bodybuilder": {
    key: "hybrid-bodybuilder",
    name: "Hybrid Bodybuilder",
    daysPerWeek: 6,
    week: [
      { title: "Push", goal: "Chest, shoulders and triceps", reason: "Pressing opens the cycle while the legs stay fresh." },
      { title: "Pull", goal: "Back, biceps, forearms and traps", reason: "Pulling before the track day spares the legs." },
      { title: "Track Session", activity: "track", goal: "Sprint and speed work", reason: "Speed work lands on fresh legs, before the lifting lower day." },
      { title: "Legs", goal: "Complete lower session", reason: "A day after the track, not the day before it." },
      { title: "Upper", goal: "Upper composite", reason: "A second upper exposure in one dense session." },
      { title: "Full Body", goal: "Full-body strength finisher", reason: "The last session closes the cycle with every pattern." },
      R("Full rest · protect the next push"),
    ],
  },
  /* ── Lower-led weeks ──────────────────────────────────────────────────────
     Every one of the architectures above opens on chest, back or push, and
     none is lower-led — so a member whose whole goal is glutes chose between
     Arnold and PPL. These four open on the glutes while the reserve is full,
     carry two upper exposures for the shoulder-and-back line that frames the
     waist, and keep heavy loaded oblique work out of the week. */
  "lower-priority-ul": {
    key: "lower-priority-ul",
    name: "Crown Four",
    daysPerWeek: 4,
    audience: "womens",
    week: [
      { title: "Glute Strength + Hamstrings", archetype: "glute-strength", goal: "Heavy hip extension on a full reserve", reason: "The glutes lead the week while you are freshest — not after two upper days." },
      { title: "Back Line + Delts", archetype: "posture-upper", goal: "Shoulder and back line", reason: "A wider upper line is what makes the waist read smaller." },
      R("Restoration between blocks"),
      { title: "Glute Shape + Hamstrings", archetype: "hamstring-glute", goal: "Lengthened hinge and glute-ham tie-in", reason: "A second lower exposure trains shape where the first trained strength." },
      { title: "Shoulders + Back Width", archetype: "upper-tone", goal: "Upper-frame volume", reason: "Delts and width balance the lower-body priority." },
      R("Restoration"),
      R("Full rest · mobility"),
    ],
  },
  "glute-priority": {
    key: "glute-priority",
    name: "Crown Five",
    daysPerWeek: 5,
    audience: "womens",
    week: [
      { title: "Glute Strength + Hamstrings", archetype: "glute-strength", goal: "Heavy hip extension on a full reserve", reason: "Strength first — the exposure that needs the most out of you goes first." },
      { title: "Back Line + Delts", archetype: "posture-upper", goal: "Shoulder and back line", reason: "Upper-frame work while the hips recover." },
      { title: "Glute Shape + Abductors", archetype: "glute-shape", goal: "Medius and upper glute, controlled tempo", reason: "The second exposure trains the shelf and the side — shape, not load." },
      R("Restoration between blocks"),
      { title: "Shoulders + Back Width", archetype: "upper-tone", goal: "Upper-frame volume", reason: "A second upper exposure keeps the frame balanced against three lower days." },
      { title: "Glute Pump + Waistline", archetype: "glute-pump", goal: "Nine-station circuit, light load, short rest", reason: "The week closes on density and waist control rather than more heavy loading." },
      R("Full rest"),
    ],
  },
  "runway-athletic": {
    key: "runway-athletic",
    name: "Runway Athletic",
    daysPerWeek: 5,
    audience: "womens",
    week: [
      { title: "Glute Strength + Hamstrings", archetype: "glute-strength", goal: "Heavy hip extension on a full reserve", reason: "Glutes lead, same as every lower-led week." },
      { title: "Upper Strength + Core", archetype: "upper-strength", goal: "Press and pull strength", reason: "Real upper strength, not a toning day." },
      { title: "Posterior Chain + Power", archetype: "posterior-chain", goal: "Hinge strength and explosive output", reason: "Explosive work lands on hips the strength day has already recovered from." },
      R("Restoration between blocks"),
      { title: "Glute Pump + Abductors", archetype: "glute-pump", goal: "Nine-station circuit, light load, short rest", reason: "Density after the heavy and the explosive are already banked." },
      { title: "Low-Impact Conditioning", archetype: "zone2", goal: "One steady conversational effort", reason: "Conditioning that keeps you lean without flattening the glutes." },
      R("Full rest"),
    ],
  },
  "glute-crown-six": {
    key: "glute-crown-six",
    name: "Crown Six",
    daysPerWeek: 6,
    audience: "womens",
    week: [
      { title: "Glute Strength + Hamstrings", archetype: "glute-strength", goal: "Heavy hip extension on a full reserve", reason: "The heaviest glute exposure opens the cycle." },
      { title: "Back Line + Delts", archetype: "posture-upper", goal: "Shoulder and back line", reason: "Upper frame between the two hardest lower days." },
      { title: "Glute Shape + Abductors", archetype: "glute-shape", goal: "Medius and upper glute, controlled tempo", reason: "Shape and the hip shelf get their own session." },
      { title: "Shoulders + Arm Day", archetype: "delts-arms", goal: "Delts and arms", reason: "Arms and delts take a day rather than leftovers after pressing." },
      { title: "Glute Pump + Detail", archetype: "glute-pump", goal: "Nine-station circuit, light load, short rest", reason: "The third glute exposure is density — the one that does not need recovery headroom." },
      { title: "Conditioning + Waistline", archetype: "waistline", goal: "Waist control and low-impact conditioning", reason: "Anti-rotation and conditioning close the week without loading the obliques." },
      R("Full rest · protect the next cycle"),
    ],
  },
  /* ── Hybrid Runner (5-day) ── */
  "hybrid-runner": {
    key: "hybrid-runner",
    name: "Hybrid Runner",
    daysPerWeek: 5,
    week: [
      { title: "Upper", goal: "Upper strength", reason: "Lifting leads while the running legs recover." },
      { title: "Run", activity: "run", goal: "Aerobic running", reason: "Easy volume the day after an upper session." },
      { title: "Lower", goal: "Lower strength", reason: "Strength work well clear of the long run." },
      R("Restoration between blocks"),
      { title: "Full Body", goal: "Full-body strength", reason: "Every pattern before the long run." },
      { title: "Long Run", activity: "long-run", goal: "Distance and aerobic base", reason: "The cycle's distance, with lifting kept well clear of it." },
      R("Full rest"),
    ],
  },
};

/* ════════════════════════════════════════════════════════════════════════
   LEG FREQUENCY — derived, never authored.

   No surface used to state how often a split trained legs, so a member could
   choose the classic bodybuilding split (one leg day) over Crown Five (three)
   with nothing telling her the difference. Counted from the authored week so
   the number cannot drift away from the architecture it describes.
   ════════════════════════════════════════════════════════════════════════ */

const LOWER_ARCHETYPES = new Set<SessionArchetype>([
  "legs", "lower-strength", "lower-power", "quad-focus", "posterior-chain", "hamstring-glute",
  "glute-strength", "glute-shape", "glute-pump", "glute-detail", "abductors", "legs-waistline",
  /* A calf / quad-detail day is a lower-body training day — Long Lines
     closes its week on one, and leaving it out undercounted the protocol. */
  "calves",
]);

/** Titles of lower-body days for architectures that name the day rather than
    carrying an explicit archetype ("Legs", "Lower", "Posterior Legs"). */
const LOWER_TITLE = /^(legs|lower|posterior legs)\b/i;

function isLowerDay(day: ArchitectureDay): boolean {
  if (day.recovery || day.activity) return false;
  if (day.archetype && LOWER_ARCHETYPES.has(day.archetype)) return true;
  return LOWER_TITLE.test(day.title);
}

/** How many lower-body training days a week of this architecture contains. */
export function lowerDaysPerWeek(architecture: SplitArchitecture): number {
  return architecture.week.filter(isLowerDay).length;
}

/** "3 leg days" / "1 leg day" — the honest label for an architecture card. */
export function legFrequencyLabel(architecture: SplitArchitecture): string {
  const n = lowerDaysPerWeek(architecture);
  return `${n} leg ${n === 1 ? "day" : "days"}`;
}

/** Map the Split Architect identity systems onto real week structures. The
    default Reserve split is fitted to training days in getArchitectureForSystem. */
export const SYSTEM_TO_ARCHITECTURE: Record<string, string> = {
  "reserve-physique": "pplula",
  "advanced-hypertrophy-rotation": "high-frequency",
  "classic-symmetry": "classic-symmetry",
  "lean-mass": "ppl-ul",
  "recomp-performance": "powerbuilding",
  "event-ready": "event-ready",
  // Direct-selection architectures (also exposed as systems in the catalog):
  arnold: "arnold",
  ppl: "ppl",
  "ppl-ul": "ppl-ul",
  "upper-lower": "upper-lower",
  powerbuilding: "powerbuilding",
  "strength-hypertrophy": "strength-hypertrophy",
  "hybrid-athlete": "hybrid-athlete",
  "high-frequency": "high-frequency",
  "recovery-constrained": "recovery-constrained",
  "contest-prep": "contest-prep",
  "elite-six": "elite-six",
  pplula: "pplula",
  "bro-split": "bro-split",
  "full-body-3": "full-body-3",
  "hybrid-bodybuilder": "hybrid-bodybuilder",
  "hybrid-runner": "hybrid-runner",
  // Lower-led (women's lane):
  "lower-priority-ul": "lower-priority-ul",
  "glute-priority": "glute-priority",
  "runway-athletic": "runway-athletic",
  "glute-crown-six": "glute-crown-six",
};

/** The default Reserve split, fitted to the days a member actually trains. */
function reservePhysiqueArchitecture(trainingDaysPerWeek: number | null | undefined): string {
  if (!trainingDaysPerWeek || trainingDaysPerWeek >= 6) return "pplula";
  if (trainingDaysPerWeek === 5) return "ppl-ul";
  if (trainingDaysPerWeek === 4) return "upper-lower";
  return "full-body-3";
}

export function getArchitectureForSystem(
  systemKey: string | null | undefined,
  opts: { trainingDaysPerWeek?: number | null } = {},
): SplitArchitecture | null {
  if (!systemKey) return null;
  const archKey = systemKey === "reserve-physique"
    ? reservePhysiqueArchitecture(opts.trainingDaysPerWeek)
    : SYSTEM_TO_ARCHITECTURE[systemKey];
  return archKey ? SPLIT_ARCHITECTURES[archKey] ?? null : null;
}

/**
 * Turn a split's cycle so its main rest day lands on the weekday the member
 * chose (0 = Monday … 6 = Sunday). Order and spacing never change — the whole
 * cycle turns, which is how a Wednesday rest makes the week run Upper, Lower,
 * Rest, Push, Pull, Legs, Arms. The main rest day is the last one the split
 * authors. With no choice, the authored week stands.
 */
export function arrangeWeekAroundRest<T extends { recovery?: boolean }>(
  week: T[],
  restDayIndex: number | null | undefined,
): T[] {
  const anchor = week.map((d) => Boolean(d.recovery)).lastIndexOf(true);
  const valid = restDayIndex != null && Number.isInteger(restDayIndex) && restDayIndex >= 0 && restDayIndex < week.length;
  if (!valid || anchor < 0) return [...week];
  const n = week.length;
  const shift = anchor - restDayIndex;
  return week.map((_, i) => week[(((i + shift) % n) + n) % n]);
}
