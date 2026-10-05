/* ════════════════════════════════════════════════════════════════════════
   UNIFIED DAILY TRAINING CONTEXT — the single source of training truth.

   One member · one protocol · one focus · one active architecture · one
   resolved daily session · one workout-engine key. Apex, Training, the
   calendar, and the workout cockpit all read from here so they can never
   disagree (e.g. architecture "Glute Ascend Protocol" while the cockpit loads
   a chest-back template).

   CRITICAL: display title and engine key are SEPARATE.
     displayTitle = what the member sees ("Glute Strength Priority")
     splitKey     = what the workout cockpit loads ("legs")
     transform    = the focus restructure applied to that template

   Pure + deterministic. No store access. Instruction / organization only —
   no medical claims.
   ════════════════════════════════════════════════════════════════════════ */

import {
  RESERVE_WEEK_SPLIT,
  getSessionProtocol,
  getTrainingDayStatusWithRecords,
  getTodaySplitDay,
  type TrainingWeekDay,
  type WeekRow,
} from "@/lib/training/weekly-split";
import {
  ARCHETYPE_TO_SPLIT,
  chestPriorityFromFocus,
  chestPriorityFromWeakPoints,
  getArchetypeOnlyTemplate,
  lowerPriorityFromFocus,
  resolveSplitKey,
  type ResolvedSplit,
} from "@/lib/training/workout-templates";
import { resolveWeeklyBlueprint, type BlueprintDay, type BlueprintResolveInput, type SessionArchetype } from "@/lib/training/split-blueprints";
import { arrangeWeekAroundRest, getArchitectureForSystem, type SplitArchitecture } from "@/lib/training/split-architectures";
import {
  LEG_EMPHASIS_ARCHETYPE,
  LEG_EMPHASIS_GOAL,
  LEG_EMPHASIS_MUSCLES,
  chooseLegEmphasis,
  type LegEmphasis,
} from "@/lib/training/leg-emphasis";
import { isReserveAthlete } from "@/lib/training/reserve-athlete";
import { resolveFocusArchitecture, type FocusArchitecture } from "@/lib/protocol/architecture";
import type { PhysiqueFocus, WomensTrack } from "@/lib/physique/types";
import { splitActivity } from "@/lib/training/split-activities";
import {
  applySplitCustomization,
  weekDateKeys,
  type ResolvedDayActivity,
  type SplitCustomization,
  type SplitDayEdit,
  type SplitEditScope,
} from "@/lib/training/split-customization";

export type DayTransform =
  | "none"
  | "chest"
  | "glute-strength"
  | "quad-volume"
  | "glute-shape"
  /* Women's layered physique sessions (applyWomensSession). */
  | "glute-strength-waist"
  | "quad-shape-glute-support"
  | "quad-shape-upper-finish"
  | "back-line-delts-conditioning"
  | "glute-hamstring-shape"
  | "upper-sculpt-posture";

/** A resolved training day — superset of WeekRow (so existing display reads of
    `.title` keep working) with the engine key + transform separated out. */
export type ResolvedDay = WeekRow & {
  /** What the member sees. Equals `title` for compatibility. */
  displayTitle: string;
  /** Engine key — the WORKOUT_TEMPLATES split the cockpit loads. */
  splitKey: ResolvedSplit;
  /** Focus restructure applied to the loaded template. */
  transform: DayTransform;
  /** Chest transform needs the upper-chest flag. */
  chestUpper: boolean;
  /** True when this is a recovery / mobility day (no required lift). */
  recovery: boolean;
  /** No program at all: nothing is planned, so nothing can be done or missed. */
  unprogrammed?: boolean;
  /** Blueprint archetype for this day — drives the archetype-specific workout
      identity in the cockpit (Protocol Architecture 2.0 depth layer). Undefined
      on women's-track / muscle-priority days, which carry their own transforms. */
  archetype?: SessionArchetype;
  /** A non-lifting day (track, run, group class…). When set the cockpit renders
      an activity and never a gym session, whatever the title happens to match. */
  activity?: ResolvedDayActivity;
  /** Present when the member changed this day themselves (split-customization). */
  memberEdit?: { scope: SplitEditScope; kind: SplitDayEdit["kind"] };
  /** What a Legs day leads with, when the engine chose it (leg-emphasis.ts). */
  legLead?: LegEmphasis;
};

export type ArchitectureKind =
  | "balanced"
  | "chest-priority"
  | "glute-quad-priority"
  | "glute-priority"
  | "quad-priority"
  | "womens-track";

type DayOverride = {
  title: string;
  splitKey: ResolvedSplit;
  transform: DayTransform;
  recovery?: boolean;
  goal: string;
  reason: string;
  protect: string;
};

function applyOverride(base: WeekRow, o: DayOverride, chestUpper: boolean): ResolvedDay {
  return {
    ...base,
    title: o.title,
    displayTitle: o.title,
    splitKey: o.splitKey,
    transform: o.transform,
    chestUpper,
    recovery: Boolean(o.recovery) || o.splitKey === "recovery",
    goal: o.goal,
    reason: o.reason,
    protect: o.protect,
  };
}

/* Shared support / recovery days for the focus-led lower-body weeks. */
const UPPER_MAINTENANCE: Omit<DayOverride, never> = {
  title: "Upper Maintenance", splitKey: "upper", transform: "none",
  goal: "Upper-body maintenance · structure",
  reason: "Maintain upper-body structure without stealing recovery from the lower-body priority.",
  protect: "Keep volume controlled — the week is built around the lower body.",
};
const UPPER_DETAIL: DayOverride = {
  title: "Upper Detail + Core", splitKey: "arms-delts", transform: "none",
  goal: "Upper detail · core bracing",
  reason: "Low-CNS upper detail and core to round out the frame without spending lower-body recovery.",
  protect: "Sunday is rest — protect sleep tonight.",
};
const RECOVERY_MID: DayOverride = {
  title: "Recovery + Mobility", splitKey: "recovery", transform: "none", recovery: true,
  goal: "Restore output · hips and knees",
  reason: "Recovery day. Protect hips, knees, and lower back before the back half of the week.",
  protect: "Light mobility and clean nutrition prepare the next priority session.",
};
const RECOVERY_END: DayOverride = {
  title: "Recovery / Steps / Mobility", splitKey: "recovery", transform: "none", recovery: true,
  goal: "Restore output · steps and mobility",
  reason: "Recovery day. Easy steps, mobility, and clean nutrition prepare Monday's opener.",
  protect: "Protect sleep to start the next block clean.",
};

const GLUTE_STRENGTH: DayOverride = {
  title: "Glute Strength Priority", splitKey: "legs", transform: "glute-strength",
  goal: "Glute strength · hip-extension lead",
  reason: "Open the week with the heaviest glute strength work while recovery is highest.",
  protect: "Protect hips and lower back — the next lower day needs fresh knees.",
};
const QUAD_VOLUME: DayOverride = {
  title: "Quad Volume Priority", splitKey: "legs", transform: "quad-volume",
  goal: "Quad volume · knee-dominant",
  reason: "Dedicated quad volume with recovery banked from the recovery day.",
  protect: "Hydrate and refuel — the shape day needs the posterior chain fresh.",
};
const GLUTE_HAM_SHAPE: DayOverride = {
  title: "Glute / Hamstring Shape", splitKey: "lower-posterior", transform: "glute-shape",
  goal: "Glute + hamstring shape · lengthened hinge",
  reason: "Close the heavy lower work with lengthened hinge and glute shape.",
  protect: "Wind down tonight — the upper detail day needs fresh shoulders.",
};

/* ── Women's layered physique sessions (shape-frequency architecture) ─────── */
const W_GLUTE_WAIST: DayOverride = {
  title: "Glute Strength + Waist Control", splitKey: "legs", transform: "glute-strength-waist",
  goal: "Glute output · waist control · hip stability",
  reason: "Open the week with glute strength while recovery is highest, with waist control layered in.",
  protect: "Protect hips and lower back — the back-line day needs fresh shoulders.",
};
const W_BACK_LINE: DayOverride = {
  title: "Back Line + Delts + Conditioning", splitKey: "upper", transform: "back-line-delts-conditioning",
  goal: "Back line · posture · delts · conditioning",
  reason: "Build the model frame — back width, posture, delt shape, and a conditioning handoff.",
  protect: "Keep conditioning controlled so the quad day stays fresh.",
};
const W_QUAD_SHAPE: DayOverride = {
  title: "Quad Shape + Glute Support", splitKey: "legs", transform: "quad-shape-glute-support",
  goal: "Quad shape · glute support · knee control",
  reason: "Dedicated quad shape with glute support and calves, recovery banked from the prior day.",
  protect: "Hydrate and refuel — the shape day needs the posterior chain fresh.",
};
const W_QUAD_UPPER_FINISH: DayOverride = {
  title: "Quads + Calves + Upper Finish", splitKey: "legs", transform: "quad-shape-upper-finish",
  goal: "Quad shape · calves · upper-frame finish",
  reason: "Complete the strength week with quad and calf work plus a controlled upper-frame finish, clear of the next sport exposure.",
  protect: "Keep the upper finish controlled — sport load already supplies the high-output conditioning layer.",
};
const W_GLUTE_HAM: DayOverride = {
  title: "Glute / Hamstring Shape", splitKey: "lower-posterior", transform: "glute-hamstring-shape",
  goal: "Glute + hamstring shape · lengthened hinge · core",
  reason: "Close the lower work with lengthened hinge, glute shape, and core control.",
  protect: "Wind down tonight — the upper sculpt day needs fresh shoulders.",
};
const W_UPPER_SCULPT: DayOverride = {
  title: "Upper Sculpt + Posture", splitKey: "upper", transform: "upper-sculpt-posture",
  goal: "Upper sculpt · posture · delts · core",
  reason: "Sculpt the upper frame and posture without spending lower-body recovery.",
  protect: "Protect sleep — the next lower priority opens the week again.",
};
const W_RECOVERY_STEPS: DayOverride = {
  title: "Recovery + Mobility + Steps", splitKey: "recovery", transform: "none", recovery: true,
  goal: "Restore output · hips, knees, steps",
  reason: "Recovery day. Protect hips, knees, pelvis, and the lower back; keep steps and mobility gentle.",
  protect: "Light mobility and clean nutrition prepare the next priority session.",
};
const W_RECOVERY_RESET: DayOverride = {
  title: "Recovery / Reset / Mobility", splitKey: "recovery", transform: "none", recovery: true,
  goal: "Restore output · reset · mobility",
  reason: "Recovery day. Reset, easy steps, and mobility prepare the next training block.",
  protect: "Protect sleep to start the next block clean.",
};

/** Women's physique-track weeks — layered shape-frequency architecture. Each
    week is composed so the real engine delivers the frequencies the protocol
    promises (verified by tools/audit-womens-weeks.ts). Every track keeps the
    leg work complete (glutes / quads / hamstrings / calves) and at least one
    protected recovery day; the LEAD day reflects each protocol's identity. */
const WOMENS_WEEKS: Record<WomensTrack, DayOverride[]> = {
  // Runway Shape — glute-led shape with a clean back line, posture, and waist control.
  runway: [W_GLUTE_WAIST, W_BACK_LINE, W_QUAD_SHAPE, W_RECOVERY_STEPS, W_GLUTE_HAM, W_UPPER_SCULPT, W_RECOVERY_RESET],
  // Glute Ascend — leg-forward (three lower exposures) with light upper-frame balance.
  "glute-quad": [W_GLUTE_WAIST, W_QUAD_SHAPE, W_UPPER_SCULPT, W_RECOVERY_STEPS, W_GLUTE_HAM, W_BACK_LINE, W_RECOVERY_RESET],
  // Sculpted / Complete Legs — QUAD-LED complete legs while leaning, glutes supported.
  "lean-recomp": [W_QUAD_SHAPE, W_BACK_LINE, W_GLUTE_HAM, W_RECOVERY_STEPS, W_GLUTE_WAIST, W_UPPER_SCULPT, W_RECOVERY_RESET],
  // Glute Crown — glutes lead with a doubled upper-line emphasis (sculpt + back line).
  "glute-upper": [W_GLUTE_WAIST, W_UPPER_SCULPT, W_QUAD_SHAPE, W_RECOVERY_STEPS, W_GLUTE_HAM, W_BACK_LINE, W_RECOVERY_RESET],
  // Athletic Model — quad-led, strong and conditioned, two conditioning handoffs.
  "athletic-model": [W_QUAD_SHAPE, W_BACK_LINE, W_GLUTE_WAIST, W_RECOVERY_STEPS, W_GLUTE_HAM, W_UPPER_SCULPT, W_RECOVERY_RESET],
  // Vacation Physique — efficient lower + upper on a busy week, three protected recovery days.
  "lifestyle-shape": [W_GLUTE_WAIST, W_BACK_LINE, W_RECOVERY_STEPS, W_QUAD_SHAPE, W_UPPER_SCULPT, W_GLUTE_HAM, W_RECOVERY_RESET],
  // Signature Shape — balanced five-day foundation.
  "signature-shape": [W_GLUTE_WAIST, W_BACK_LINE, W_QUAD_SHAPE, W_RECOVERY_STEPS, W_GLUTE_HAM, W_UPPER_SCULPT, W_RECOVERY_RESET],
  // Hybrid Pilates — activity layers replace redundant gym fatigue.
  "hybrid-pilates": [W_GLUTE_WAIST, { ...W_RECOVERY_STEPS, title: "Pilates Shape + Posture + Mobility" }, W_QUAD_SHAPE, W_UPPER_SCULPT, W_GLUTE_HAM, { ...W_BACK_LINE, title: "Pilates + Upper Detail + Steps", reason: "Low-fatigue upper detail, posture work, and steps complete the hybrid week without replacing strength work." }, W_RECOVERY_RESET],
  // Sport + Strength — sport days count as conditioning and leg load.
  "sport-strength": [W_GLUTE_WAIST, W_UPPER_SCULPT, { ...W_RECOVERY_STEPS, title: "Sport / Conditioning + Mobility" }, W_GLUTE_HAM, W_QUAD_UPPER_FINISH, { ...W_RECOVERY_STEPS, title: "Sport / Conditioning + Core" }, W_RECOVERY_RESET],
};

/** Whether a resolved day trains the lower body — used to report how many
 *  lower exposures a paused women's track would have given her. */
function isLowerResolvedDay(day: ResolvedDay): boolean {
  if (day.recovery) return false;
  if (day.splitKey === "lower" || day.splitKey === "legs" || day.splitKey === "lower-posterior") return true;
  return /glute|leg|lower|hamstring|quad/i.test(day.displayTitle);
}

export function buildWomensTrackWeek(track: WomensTrack): ResolvedDay[] {
  const overrides = WOMENS_WEEKS[track];
  return RESERVE_WEEK_SPLIT.map((base, i) => applyOverride(base, overrides[i], false));
}

/* ── Protocol Architecture 2.0 — blueprint-driven balanced week ────────────
   When there is no women's track and no explicit muscle priority, the week is
   built from the ACTIVE PROTOCOL's blueprint instead of the legacy skeleton.
   This is what gives every male / general protocol its own weekly identity. */
export function buildBlueprintResolvedWeek(resolve: BlueprintResolveInput): ResolvedDay[] {
  const { week } = resolveWeeklyBlueprint(resolve);
  return buildProjectedWeekResolvedWeek(week);
}

/** Convert the stored Horizon week into the cockpit's resolved-day shape.
    No blueprint or focus resolver runs here: the week has already been
    generated, personalized, revised, and persisted. */
export function buildProjectedWeekResolvedWeek(week: BlueprintDay[]): ResolvedDay[] {
  return RESERVE_WEEK_SPLIT.map((base, i) => {
    const d = week[i] ?? null;
    if (!d) {
      return { ...base, displayTitle: base.title, splitKey: resolveSplitKey(base.title), transform: "none", chestUpper: false, recovery: resolveSplitKey(base.title) === "recovery" };
    }
    const splitKey = ARCHETYPE_TO_SPLIT[d.archetype] ?? null;
    // An authored archetype template gives even a low-impact / null-split day its
    // own session identity, so it should NOT collapse into a generic recovery day.
    const hasArchetypeTemplate = Boolean(getArchetypeOnlyTemplate(d.archetype));
    const recovery = Boolean(d.recovery) || d.archetype === "recovery" || (splitKey === null && !hasArchetypeTemplate);
    const nextDay = week[(i + 1) % week.length] ?? null;
    const emphasis = d.emphasis.length
      ? d.emphasis.map((item) => item.replace(/\b\w/g, (character) => character.toUpperCase())).join(" · ")
      : d.intent.replace(/\b\w/g, (character) => character.toUpperCase());
    return {
      ...base,
      title: d.title,
      displayTitle: d.title,
      splitKey: recovery ? "recovery" : splitKey,
      transform: "none",
      chestUpper: false,
      recovery,
      archetype: recovery ? undefined : d.archetype,
      goal: emphasis,
      reason: recovery
        ? `Programmed recovery restores capacity before ${nextDay?.title ?? "the next Horizon session"}.`
        : `${d.title} is the active Horizon's ${base.dayLong} execution slot, emphasizing ${emphasis.toLowerCase()}.`,
      protect: nextDay
        ? `Protect ${nextDay.title} by keeping today's work inside the programmed volume and intensity targets.`
        : "Keep today's work inside the programmed volume and intensity targets.",
    };
  });
}

export function buildExplicitFallbackResolvedWeek(): ResolvedDay[] {
  return RESERVE_WEEK_SPLIT.map((base) => ({
    ...base,
    /* A day with no program is NAMED "Unprogrammed" — it is not named after
       the system deficiency. Every one of these seven days used to carry the
       title "Program Horizon Required", which is why that sentence appeared
       in the hero, in all seven weekday cards, and in Split Command at once,
       making a single missing program read as a broken product.

       The deficiency is a screen-level state, surfaced once by
       resolveSystemState(). The days stay factual. Honesty is preserved where
       it belongs: `reason` below still states that Reserve did not
       substitute a generic workout. */
    title: "No session",
    displayTitle: "No session",
    unprogrammed: true,
    splitKey: "recovery",
    transform: "none",
    chestUpper: false,
    recovery: true,
    goal: "Awaiting program",
    reason: "No executable Program Horizon is available. Reserve did not substitute a generic workout.",
    protect: "Choose an active program before starting a training session.",
  }));
}

/** Build the lower-body-priority week for glutes / quads. */
function buildLowerWeek(kind: "glute-quad-priority" | "glute-priority" | "quad-priority"): DayOverride[] {
  const mon = kind === "quad-priority" ? QUAD_VOLUME : GLUTE_STRENGTH;
  const wed =
    kind === "glute-quad-priority"
      ? QUAD_VOLUME
      : kind === "glute-priority"
        ? GLUTE_HAM_SHAPE
        : { ...QUAD_VOLUME, title: "Quad Strength Priority" };
  const fri =
    kind === "quad-priority"
      ? { ...GLUTE_HAM_SHAPE, title: "Lower Shape + Hamstrings" }
      : kind === "glute-priority"
        ? { ...GLUTE_STRENGTH, title: "Lower Strength + Glutes" }
        : GLUTE_HAM_SHAPE;
  return [mon, UPPER_MAINTENANCE, wed, RECOVERY_MID, fri, UPPER_DETAIL, RECOVERY_END];
}

function architectureKindFromSignals(
  chest: { active: boolean },
  lower: { active: boolean; glutes: boolean; quads: boolean; lead: "glute" | "quad" },
): ArchitectureKind {
  if (lower.active) {
    if (lower.glutes && lower.quads) return "glute-quad-priority";
    return lower.lead === "quad" ? "quad-priority" : "glute-priority";
  }
  if (chest.active) return "chest-priority";
  return "balanced";
}

/** Build the full 7-day resolved week for the active architecture. */
export function buildResolvedWeek(
  kind: ArchitectureKind,
  chest: { active: boolean; upperChest: boolean },
  weekNumber?: number | null,
  musclePriority?: string[] | null,
): ResolvedDay[] {
  if (kind === "glute-quad-priority" || kind === "glute-priority" || kind === "quad-priority") {
    const overrides = buildLowerWeek(kind);
    return RESERVE_WEEK_SPLIT.map((base, i) => applyOverride(base, overrides[i], false));
  }
  // balanced + chest-priority keep the canonical Push → Pull → Legs → Arms →
  // Upper → Lower week. Push already leads with incline pressing, so a chest
  // priority is honored without pairing chest with back.
  const keys = RESERVE_WEEK_SPLIT.map((base) => resolveSplitKey(base.title));
  const lead = legEmphasisFor(keys, weekNumber, musclePriority);
  return RESERVE_WEEK_SPLIT.map((base, i) => {
    const sk = keys[i];
    const legLead = sk === "legs" ? lead : undefined;
    return {
      ...base,
      displayTitle: base.title,
      goal: legLead ? LEG_EMPHASIS_GOAL[legLead] : base.goal,
      splitKey: sk,
      transform: "none" as DayTransform,
      chestUpper: chest.upperChest,
      recovery: sk === "recovery",
      archetype: legLead && legLead !== "full" ? LEG_EMPHASIS_ARCHETYPE[legLead] : undefined,
      legLead,
    };
  });
}

/** What the week's Legs days lead with — see leg-emphasis.ts. */
function legEmphasisFor(
  keys: ResolvedSplit[],
  weekNumber: number | null | undefined,
  musclePriority: string[] | null | undefined,
): LegEmphasis {
  const hasLowerDay = keys.some((k) => k === "lower" || k === "lower-posterior");
  return chooseLegEmphasis({ hasLowerDay, weekNumber, musclePriority });
}

/* ── Member-saved split architecture → resolved week ──────────────────────
   When the member explicitly saves an architecture (Personal Command /
   Split Architect) it becomes the durable structural blueprint. Weak-point
   emphasis still rides INSIDE via the chest flags; chest/back days keep the
   week-shifted strength→volume→pump rotation so no week is frozen. */
const DAY_NAMES: Array<[string, string]> = [
  ["Mon", "Monday"], ["Tue", "Tuesday"], ["Wed", "Wednesday"], ["Thu", "Thursday"],
  ["Fri", "Friday"], ["Sat", "Saturday"], ["Sun", "Sunday"],
];

export function buildArchitectureResolvedWeek(
  arch: SplitArchitecture,
  chest: { active: boolean; upperChest: boolean },
  weekNumber?: number | null,
  opts: { restDayIndex?: number | null; musclePriority?: string[] | null } = {},
): ResolvedDay[] {
  const chestBackRotation: SessionArchetype[] = ["chest-back-strength", "chest-back-volume", "chest-back-pump"];
  const weekShift = Math.max(0, Math.round(weekNumber ?? 1) - 1) % chestBackRotation.length;
  let chestBackSeen = 0;
  /* The member's rest day turns the whole cycle; the order never changes. */
  const cycle = arrangeWeekAroundRest(arch.week, opts.restDayIndex);
  /* An activity day (track, run, class) carries no lifting template, and its
     title is never matched against the template alias table. */
  const keys: ResolvedSplit[] = cycle.map((day) =>
    day.recovery ? "recovery" : day.activity ? null : resolveSplitKey(day.title),
  );
  const lead = legEmphasisFor(keys, weekNumber, opts.musclePriority);
  return cycle.map((day, i) => {
    const activityDef = day.activity ? splitActivity(day.activity) : null;
    const sk = keys[i];
    const isChestBack = sk === "chest-back";
    /* A Legs day without an authored bias leads the way the engine chose. */
    const legLead = sk === "legs" && !day.archetype ? lead : undefined;
    const archetype = activityDef
      ? undefined
      : day.archetype
        ?? (legLead && legLead !== "full" ? LEG_EMPHASIS_ARCHETYPE[legLead] : undefined)
        ?? (isChestBack ? chestBackRotation[(chestBackSeen++ + weekShift) % chestBackRotation.length] : undefined);
    return {
      dayIndex: i,
      splitDay: i + 1,
      day: DAY_NAMES[i][0],
      dayLong: DAY_NAMES[i][1],
      title: day.title,
      reserve: day.recovery ? "Recovery Reserve" : `${arch.name}`,
      goal: legLead ? LEG_EMPHASIS_GOAL[legLead] : day.goal,
      reason: day.reason,
      protect: day.recovery
        ? "Light mobility and clean nutrition prepare the next session."
        : "Protect tomorrow's output — quality volume, no junk sets.",
      displayTitle: day.title,
      splitKey: sk,
      transform: "none" as DayTransform,
      chestUpper: chest.upperChest,
      recovery: Boolean(day.recovery),
      archetype,
      legLead,
      activity: activityDef
        ? { key: activityDef.key, label: day.title, load: activityDef.load, durationMinutes: activityDef.defaultMinutes }
        : undefined,
    };
  });
}

const MUSCLES_BY_TRANSFORM: Record<DayTransform, string[]> = {
  "glute-strength": ["Glutes", "Hamstrings"],
  "quad-volume": ["Quads"],
  "glute-shape": ["Glutes", "Hamstrings"],
  chest: ["Upper Chest", "Chest", "Back"],
  none: [],
  "glute-strength-waist": ["Glutes", "Quads", "Core"],
  "quad-shape-glute-support": ["Quads", "Glutes", "Hamstrings", "Calves"],
  "quad-shape-upper-finish": ["Quads", "Hamstrings", "Calves", "Glutes", "Back", "Delts", "Core"],
  "back-line-delts-conditioning": ["Back", "Delts", "Conditioning"],
  "glute-hamstring-shape": ["Glutes", "Hamstrings", "Calves", "Core"],
  "upper-sculpt-posture": ["Back", "Delts", "Posture"],
};

const MUSCLES_BY_SPLITKEY: Record<string, string[]> = {
  legs: ["Quads", "Hamstrings", "Glutes"],
  "lower-posterior": ["Hamstrings", "Glutes", "Calves"],
  upper: ["Chest", "Back", "Delts"],
  "arms-delts": ["Delts", "Arms"],
  "chest-back": ["Chest", "Back"],
  "upper-specialization": ["Upper Chest", "Delts", "Arms"],
  chest: ["Chest", "Upper Chest"],
  back: ["Back", "Lats"],
  shoulders: ["Delts"],
  arms: ["Biceps", "Triceps", "Forearms"],
  push: ["Chest", "Delts", "Triceps"],
  pull: ["Back", "Biceps", "Forearms", "Traps"],
  lower: ["Quads", "Hamstrings", "Glutes"],
  "full-body": ["Full Body"],
};

/** Convert the resolved week into the Apex 7-day rail shape so Apex and
    Training render the same week, titles, and recovery placement. */
export function toApexWeekDays(weeklyPlan: ResolvedDay[], now: Date, completedSplitDays?: ReadonlySet<number> | null): TrainingWeekDay[] {
  const todaySplitDay = getTodaySplitDay(now);
  return weeklyPlan.map((d, i) => {
    const muscles = d.recovery
      ? []
      : d.transform !== "none"
        ? MUSCLES_BY_TRANSFORM[d.transform]
        : d.legLead
          ? LEG_EMPHASIS_MUSCLES[d.legLead]
          : MUSCLES_BY_SPLITKEY[d.splitKey ?? ""] ?? [];
    /* With no program, a past day is neither done nor missed: there was never
       a session there. It used to read "Done", crediting a member who had not
       trained. */
    const status = d.unprogrammed
      ? (d.splitDay === todaySplitDay ? "today" as const : "none" as const)
      : getTrainingDayStatusWithRecords(d.splitDay, todaySplitDay, completedSplitDays, d.recovery);
    return {
      dayIndex: d.dayIndex,
      splitDay: d.splitDay,
      day: d.day,
      sessionName: d.displayTitle,
      focus: d.recovery ? "Restore output · mobility" : d.goal,
      durationMin: null,
      recovery: d.recovery,
      isToday: d.splitDay === todaySplitDay,
      status,
      intensity: d.recovery ? "recovery" : "moderate",
      advanced: false,
      muscles,
      intent: d.goal,
      /* The support stack follows the session — Push and Pull carry abs,
         cardio and an optional sauna wherever the split puts them. */
      protocol: d.unprogrammed
        /* No session means no support stack: sauna and cardio belong to a
           session this member does not have yet. */
        ? { splitDay: d.splitDay, cardio: "", abs: null, sauna: null, mobility: "", posing: null,
            nutritionFocus: "Normal intake until a plan is set.", recoveryNote: "Nothing to recover from yet.", afterSession: "" }
        : getSessionProtocol(d, weeklyPlan[(i + 1) % weeklyPlan.length]),
      activity: d.activity,
      splitKey: d.splitKey,
      memberEdit: d.memberEdit,
    };
  });
}

export type DailyTrainingContext = {
  activeProtocolName: string | null;
  activeArchitectureName: string;
  activeFocus: string;
  architectureKind: ArchitectureKind;
  weeklyPlan: ResolvedDay[];
  todaySession: ResolvedDay;
  todayDisplayTitle: string;
  /** Engine key for the cockpit — equals todaySplitKey; kept named for clarity. */
  todayEngineKey: ResolvedSplit;
  todaySplitKey: ResolvedSplit;
  todayTransform: DayTransform;
  todayChestUpper: boolean;
  isRecoveryDay: boolean;
  sessionDirective: string;
  objective: string;
  beforeSession: string;
  afterSession: string;
  recoveryContext: string;
  nutritionContext: string;
  focusArch: FocusArchitecture;
  sourceReason: string;
  fallbackReason: string | null;
  /**
   * True when the week resolved to the explicit fallback: no executable
   * Program Horizon and no member-authored program. Feeds resolveSystemState()
   * so the deficiency is announced ONCE, at screen level, instead of being
   * baked into the name of all seven days.
   */
  programUnconfirmed: boolean;
  /** True when the member's explicitly chosen split drives this week. */
  memberArchitectureActive: boolean;
  /**
   * Set when a split the member chose by name has displaced a women's physique
   * track that would otherwise own the week. Her choice still wins — Reserve
   * never silently rewrites a week she picked — but the displacement used to
   * be invisible: she chose "Arnold Split" and three glute exposures became
   * two generic leg days with nothing telling her. Surfaces so the UI can say
   * it out loud and offer the way back.
   */
  pausedWomensTrack: { track: string; architectureName: string; lowerDays: number } | null;
};

export type DailyContextInput = {
  now: Date;
  focus: PhysiqueFocus | undefined;
  weakPoints: string[] | undefined;
  protocolName: string | null;
  /** Protocol-resolved architecture name (used when no focus is set). */
  protocolArchitectureName: string;
  womensActive: boolean;
  /** Optional explicit selected day index (calendar override). */
  selectedDayIndex?: number;
  /** Protocol Architecture 2.0 — active protocol + member adaptation for the
      blueprint-driven balanced week (used only when no track / no priority). */
  protocolId?: string | null;
  protocolCategory?: string | null;
  trainingDaysTarget?: number | null;
  activityStack?: string | null;
  activitySport?: string | null;
  recoveryPreference?: string | null;
  /** Current game-plan week (1-based) — drives week-to-week session rotation. */
  weekNumber?: number | null;
  /** Stored/revised Program Horizon week. When present it is the execution
      authority and bypasses every parallel week generator below. */
  activeHorizonWeek?: BlueprintDay[] | null;
  /** Render an honest no-program state instead of the legacy skeleton. */
  requireActiveHorizon?: boolean;
  /** Member-saved split system (Split Architect / Personal Command). */
  splitSystemKey?: string | null;
  /** True only when the member explicitly selected it (selectedAt set). */
  splitSystemChosen?: boolean;
  /** The weekday the member rests on (0 = Monday … 6 = Sunday); the split turns to meet it. */
  splitRestDayIndex?: number | null;
  /** The member's own day changes — every Friday, or just this Friday. */
  splitCustomization?: SplitCustomization | null;
  /** The member's authored / imported program as a week, when one governs
      these dates (lib/program/resolved-week). It used to be resolved for one
      date inside the cockpit only, so the rail and Apex rendered a different
      week than the session the member was about to start. */
  programWeek?: ResolvedDay[] | null;
};

function dayIndexFor(now: Date): number {
  // Monday = 0 … Sunday = 6, matching RESERVE_WEEK_SPLIT dayIndex.
  return (now.getDay() + 6) % 7;
}

export function resolveDailyTrainingContext(input: DailyContextInput): DailyTrainingContext {
  const { now, focus, weakPoints, protocolName, protocolArchitectureName, womensActive } = input;

  const hasPrimary = Boolean(focus?.primary);
  const chest = hasPrimary
    ? chestPriorityFromFocus(focus!.primary, focus!.secondary)
    : chestPriorityFromWeakPoints(weakPoints);
  const lower = hasPrimary
    ? lowerPriorityFromFocus(focus!.primary, focus!.secondary)
    : { active: false, glutes: false, quads: false, lead: "glute" as const };

  // Women's physique track takes precedence — layered shape-frequency week.
  const track = focus?.track ?? null;
  const muscleKind = architectureKindFromSignals(chest, lower);
  // Reserve Athlete Method defines the weekly STRUCTURE itself. Weak points
  // emphasize INSIDE the Reserve Athlete week (passed through as musclePriority);
  // they never replace it. So its blueprint takes precedence over muscle-focus
  // and any stale women's track for these protocols (bodybuilder-first split).
  const isAthlete = isReserveAthlete(input.protocolCategory, input.protocolId);
  // Hybrid performance architectures (Reserve Athlete, Grand Touring) define the
  // weekly STRUCTURE themselves. Weak-point / muscle focus emphasizes INSIDE the
  // architecture (passed through as musclePriority); it never replaces it — so a
  // member with a chest focus on Grand Touring still gets the hybrid week, not the
  // legacy chest/back split. Their blueprint takes precedence over muscle-lane
  // restructuring and any stale women's track (a chosen hybrid is gender-neutral).
  const isStructuralArchitecture = isAthlete || input.protocolCategory === "hybrid-performance";
  const kind: ArchitectureKind = isStructuralArchitecture ? "balanced" : track ? "womens-track" : muscleKind;
  // A member-SAVED architecture is the durable structural blueprint — it
  // outranks protocol defaults and muscle-lane restructuring (weak points
  // keep shaping emphasis INSIDE it). Women's track still takes precedence
  // for its layered shape-frequency contract.
  const memberArchitecture = input.splitSystemChosen
    ? getArchitectureForSystem(input.splitSystemKey, { trainingDaysPerWeek: input.trainingDaysTarget })
    : null;
  /* A chosen split sits ABOVE the women's track, so choosing one pauses the
     track's week. Reported rather than hidden: she gets to see what she gave
     up and decide, which is the whole difference between a choice and a bug. */
  const pausedWomensTrack =
    memberArchitecture && track && !isStructuralArchitecture
      ? {
          track,
          architectureName: memberArchitecture.name,
          lowerDays: buildWomensTrackWeek(track).filter((d) => !d.recovery && isLowerResolvedDay(d)).length,
        }
      : null;
  /* Resolution priority — as the code below actually orders it. This comment
     used to list the women's track FIRST, which is not what happens and never
     was: a member-saved architecture is resolved above it. The mismatch hid a
     real consequence for months, so the order is stated honestly here and the
     displacement is reported back as pausedWomensTrack.

       1. Member-authored / imported program week → stated explicitly.
       2. Member-saved split architecture → its authored week.
       3. Program Horizon → its projected week.
       4. Women's track → layered shape-frequency week.
       5. Reserve Athlete / hybrid protocol → its blueprint (Architecture 2.0).
       6. Explicit muscle priority (chest / glute / quad) → focus architecture.
       7. Otherwise (balanced) → the ACTIVE PROTOCOL's blueprint.

     A member's explicit choice outranking her protocol is deliberate: she
     chose it by name, and silently overruling it is how the previous bug
     worked. What is NOT acceptable is doing it without telling her. */
  const useBlueprint = Boolean(input.protocolId || input.protocolCategory) && (isStructuralArchitecture || (!track && muscleKind === "balanced"));
  const horizonActive = Boolean(input.activeHorizonWeek?.length);
  /* The one condition under which Reserve refuses to invent a week. Kept
     beside the resolution below so the two can never disagree. A member who
     explicitly chose a split HAS a plan, so they are not unconfirmed. */
  const programUnconfirmed =
    !horizonActive && Boolean(input.requireActiveHorizon) && !memberArchitecture && !input.programWeek?.length;
  /* PRECEDENCE — a member's explicit split choice outranks the no-program
     fallback and the women's track.

     It used to sit BELOW both. Choosing Push / Pull / Legs therefore did
     nothing for a member with no active protocol: the resolver returned the
     "No session" fallback before it ever looked at the choice. Selecting a
     protocol still clears the manual split (see the Grand Touring suite), so a
     protocol chosen later stays authoritative. A split chosen while a program
     runs sets the days too: the program keeps its phase, volume and
     progression (member-split.ts) but no longer overrules the member's week. */
  /* A program the member authored or imported states every day explicitly,
     and the cockpit already loads it over a chosen split (todaySessionOwner:
     member day → horizon → program day → member split). The week now follows
     the same order, so the rail cannot name a different session than the one
     the member is about to start. A program and an active Horizon never
     coexist — resolveProgramDayForDate returns nothing while one runs — so
     this sits above the chosen split and below the Horizon, exactly as the
     cockpit has it. */
  const programWeek = input.programWeek?.length === 7 ? input.programWeek : null;
  const baseWeeklyPlan = programWeek
    ? programWeek
    : memberArchitecture
    ? buildArchitectureResolvedWeek(memberArchitecture, chest, input.weekNumber, {
        restDayIndex: input.splitRestDayIndex,
        musclePriority: weakPoints,
      })
    : horizonActive
      ? buildProjectedWeekResolvedWeek(input.activeHorizonWeek!)
    : input.requireActiveHorizon
      ? buildExplicitFallbackResolvedWeek()
    : (!isStructuralArchitecture && track)
    ? buildWomensTrackWeek(track)
      : useBlueprint
        ? buildBlueprintResolvedWeek({
            protocolId: input.protocolId,
            category: input.protocolCategory,
            trainingDaysTarget: input.trainingDaysTarget,
            activityStack: input.activityStack,
            activitySport: input.activitySport,
            recoveryPreference: input.recoveryPreference,
            musclePriority: weakPoints ?? [],
            weekNumber: input.weekNumber,
          })
        : buildResolvedWeek(muscleKind, chest, input.weekNumber, weakPoints);
  /* The member's own changes sit on top of whatever the plan resolved —
     including a Program Horizon week — so every surface agrees on the day,
     and the cockpit loads what the member actually chose. */
  const weeklyPlan = applySplitCustomization(baseWeeklyPlan, input.splitCustomization, weekDateKeys(now));
  const focusArch = resolveFocusArchitecture(focus, { womensActive });

  const todayIndex = input.selectedDayIndex ?? dayIndexFor(now);
  const todaySession =
    weeklyPlan.find((d) => d.dayIndex === todayIndex) ?? weeklyPlan[0];

  const activeArchitectureName = horizonActive
    ? protocolArchitectureName
    : focusArch.active ? focusArch.architectureName : protocolArchitectureName;
  /* A day the member changed speaks for itself — a focus directive about chest
     priority must not narrate a Friday the member turned into a track day. */
  const objective = todaySession.memberEdit
    ? todaySession.goal
    : todaySession.recovery
    ? "Restore the reserve and protect tomorrow's output."
    : !horizonActive && focusArch.active
      ? focusArch.sessionDirective
      : todaySession.goal;

  return {
    activeProtocolName: protocolName,
    activeArchitectureName,
    activeFocus: focusArch.active ? focusArch.focusLabel : "Balanced",
    architectureKind: kind,
    weeklyPlan,
    todaySession,
    todayDisplayTitle: todaySession.displayTitle,
    todayEngineKey: todaySession.splitKey,
    todaySplitKey: todaySession.splitKey,
    todayTransform: todaySession.transform,
    todayChestUpper: todaySession.chestUpper,
    isRecoveryDay: todaySession.recovery,
    sessionDirective: !todaySession.memberEdit && !horizonActive && focusArch.active ? focusArch.sessionDirective : todaySession.reason,
    objective,
    beforeSession: focusArch.region === "lower"
      ? "Prime hips, knees, and the lower back before the first heavy set."
      : focusArch.region === "upper"
        ? "Prime shoulders, scapula, and the working joints before the first press."
        : "Warm up the working joints and run the readiness check before the first hard set.",
    afterSession: "Refuel with a protein anchor and start the recovery handoff. Stop with pain and follow clinician guidance.",
    recoveryContext: focusArch.recoveryContext,
    nutritionContext: focusArch.nutritionContext,
    focusArch,
    programUnconfirmed,
    memberArchitectureActive: Boolean(memberArchitecture),
    pausedWomensTrack,
    sourceReason: programWeek
      ? "Resolved from your program."
      : memberArchitecture
      ? horizonActive
        ? "Resolved from your chosen split; the active program sets progression."
        : "Resolved from your chosen split."
      : horizonActive
      ? "Resolved from the active stored Program Horizon week."
      : focusArch.active
      ? `Resolved from your selected focus (${focusArch.focusLabel}).`
      : chest.active
        ? "Resolved from your chest weak-point selection."
        : "Resolved from your protocol architecture.",
    fallbackReason: horizonActive
      ? null
      : !focusArch.active && !chest.active ? "No muscle priority selected — using balanced architecture." : null,
  };
}
