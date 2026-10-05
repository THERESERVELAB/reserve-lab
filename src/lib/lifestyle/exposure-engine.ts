/* ════════════════════════════════════════════════════════════════════════
   WEEKLY EXPOSURE ENGINE — how often every muscle group and movement
   pattern is actually touched across the member's real week.

   Reads THREE sources as one system:
   1. Strength days with an assigned custom workout template → real movements
      → direct working sets per muscle + indirect (synergist) exposure.
   2. Strength days without a template → the day's focus tags / title
      keywords ("Upper Body Push") → estimated exposure.
   3. Side activities (track, pickleball, HIIT, running…) → activity load
      profiles → real contribution to the same muscles and to systemic
      fatigue. Monday track is never "a rest day that doesn't count."

   Output feeds the schedule audit and is rendered in the Build Studio.
   Estimates are labeled estimates — no fabricated precision.
   ════════════════════════════════════════════════════════════════════════ */

import { MOVEMENT_LIBRARY, type MovementLibraryEntry } from "@/lib/training/prescription-engine";
import { classifyMovementPattern, type MovementPattern } from "@/lib/training/plateau-engine";
import {
  MUSCLE_GROUPS,
  resolveActivityLoad,
  sprintLoadOf,
  type MuscleGroup,
} from "./activity-load";
import {
  TRAINING_ACTIVITY_TYPES,
  type ActualWeekRecord,
  type CustomWorkoutTemplate,
  type LifestyleSchedule,
} from "./types";
import type { ProgramDefinition } from "@/lib/program/types";

/* ─── Muscle mapping ─────────────────────────────────────────────────────── */

/** Library target strings → muscle group. */
const TARGET_TO_GROUP: Array<{ match: RegExp; group: MuscleGroup }> = [
  { match: /chest/i, group: "chest" },
  { match: /lats?|back/i, group: "back" },
  { match: /quad/i, group: "quads" },
  { match: /hamstring/i, group: "hamstrings" },
  { match: /glute/i, group: "glutes" },
  { match: /delt|shoulder/i, group: "delts" },
  { match: /bicep|tricep|arm/i, group: "arms" },
  { match: /calv|calf/i, group: "calves" },
  { match: /core|abs/i, group: "core" },
  { match: /adductor/i, group: "adductors" },
];

export function muscleGroupOfTarget(target: string): MuscleGroup | null {
  const hit = TARGET_TO_GROUP.find((t) => t.match.test(target));
  return hit?.group ?? null;
}

/** Indirect (synergist) exposure a pattern gives beyond its target. */
const PATTERN_INDIRECT: Partial<Record<MovementPattern, MuscleGroup[]>> = {
  "Horizontal Press": ["delts", "arms"],
  "Incline Press": ["delts", "arms"],
  "Vertical Press": ["arms", "core"],
  "Horizontal Pull": ["arms", "delts"],
  "Vertical Pull": ["arms"],
  "Hip Hinge": ["glutes", "back", "core"],
  "Squat Pattern": ["glutes", "core", "adductors"],
  "Lunge Pattern": ["glutes", "adductors", "core"],
  "Knee Flexion": ["calves"],
  "Hip Extension": ["hamstrings", "core"],
  "Calf Raise": [],
  "Lateral Raise": [],
  "Rear Delt": ["back"],
  Curl: [],
  "Triceps Extension": [],
  "Core Brace": [],
  Conditioning: ["calves", "quads"],
  Isolation: [],
};

/** Day focus tags / title keywords → muscle groups (untemplated strength days). */
const FOCUS_KEYWORDS: Array<{ match: RegExp; groups: MuscleGroup[] }> = [
  { match: /full.?body/i, groups: ["chest", "back", "quads", "hamstrings", "glutes", "delts", "arms", "core"] },
  { match: /upper.*push|push(?!.*pull)/i, groups: ["chest", "delts", "arms"] },
  { match: /upper.*pull|pull(?!.*push)/i, groups: ["back", "arms"] },
  { match: /upper/i, groups: ["chest", "back", "delts", "arms"] },
  { match: /lower|leg/i, groups: ["quads", "hamstrings", "glutes", "calves", "adductors"] },
  { match: /chest/i, groups: ["chest"] },
  { match: /back|lat/i, groups: ["back"] },
  { match: /shoulder|delt/i, groups: ["delts"] },
  { match: /arm|bicep|tricep/i, groups: ["arms"] },
  { match: /quad/i, groups: ["quads"] },
  { match: /hamstring|posterior/i, groups: ["hamstrings", "glutes"] },
  { match: /glute/i, groups: ["glutes"] },
  { match: /calf|calv/i, groups: ["calves"] },
  { match: /core|ab/i, groups: ["core"] },
  { match: /hiit|conditioning|athletic/i, groups: ["quads", "glutes", "core"] },
];

export function musclesForFocus(focusOrTitle: string[]): MuscleGroup[] {
  const out = new Set<MuscleGroup>();
  for (const text of focusOrTitle) {
    // Direct group names first ("chest", "quads") then compound keywords.
    for (const { match, groups } of FOCUS_KEYWORDS) {
      if (match.test(text)) {
        groups.forEach((g) => out.add(g));
        break;
      }
    }
  }
  return [...out];
}

/* ─── Report shape ───────────────────────────────────────────────────────── */

export type MuscleExposure = {
  /** Estimated direct working sets from templated strength days. */
  directSets: number;
  indirectSets: number;
  /** Load contributed by side activities (relative units, not sets). */
  activityLoad: number;
  /** Days in the rotation this muscle is meaningfully touched. */
  daysTouched: number[];
  frequency: number;
  /** Smallest gap (days) between two exposures — null when touched <2 times. */
  minGapDays: number | null;
  backToBack: boolean;
  flag: "untouched" | "light" | "balanced" | "high";
};

export type PatternExposure = {
  pattern: MovementPattern;
  count: number;
  daysTouched: number[];
};

export type DayLoadSummary = {
  dayIndex: number;
  /** Systemic fatigue estimate 0..~8 (all activities summed). */
  fatigue: number;
  sprintLoad: number;
  lowerBodyLoad: number;
  hasTraining: boolean;
  isRest: boolean;
};

export type WeeklyExposureReport = {
  perMuscle: Record<MuscleGroup, MuscleExposure>;
  patterns: PatternExposure[];
  days: DayLoadSummary[];
  /** Days with meaningful sprint work (track/sprint at moderate+). */
  sprintDays: number[];
  restDays: number[];
  /** Longest run of consecutive high-fatigue (>=2.2) days. */
  longestHighFatigueStreak: number;
  estimatedWeeklyWorkingSets: number;
};

const LIB_BY_ID = new Map<string, MovementLibraryEntry>(MOVEMENT_LIBRARY.map((e) => [e.id, e]));

/* ─── Derivation ─────────────────────────────────────────────────────────── */

export function deriveWeeklyExposure(
  schedule: LifestyleSchedule,
  templates: CustomWorkoutTemplate[],
): WeeklyExposureReport {
  const templateById = new Map(templates.map((t) => [t.id, t]));
  const rotation = Math.max(1, schedule.rotationLengthDays);

  const perMuscle = Object.fromEntries(
    MUSCLE_GROUPS.map((g) => [g, {
      directSets: 0, indirectSets: 0, activityLoad: 0,
      daysTouched: [] as number[], frequency: 0, minGapDays: null as number | null,
      backToBack: false, flag: "untouched" as MuscleExposure["flag"],
    }]),
  ) as Record<MuscleGroup, MuscleExposure>;

  const touch = (g: MuscleGroup, dayIndex: number) => {
    const m = perMuscle[g];
    if (!m.daysTouched.includes(dayIndex)) m.daysTouched.push(dayIndex);
  };

  const patternMap = new Map<MovementPattern, PatternExposure>();
  const touchPattern = (pattern: MovementPattern, dayIndex: number, count: number) => {
    const cur = patternMap.get(pattern) ?? { pattern, count: 0, daysTouched: [] };
    cur.count += count;
    if (!cur.daysTouched.includes(dayIndex)) cur.daysTouched.push(dayIndex);
    patternMap.set(pattern, cur);
  };

  const days: DayLoadSummary[] = Array.from({ length: rotation }, (_, i) => ({
    dayIndex: i, fatigue: 0, sprintLoad: 0, lowerBodyLoad: 0, hasTraining: false, isRest: true,
  }));

  let totalWorkingSets = 0;

  for (const activity of schedule.activities) {
    if (activity.dayIndex < 0 || activity.dayIndex >= rotation) continue;
    const day = days[activity.dayIndex];
    const load = resolveActivityLoad(activity);
    day.fatigue += load.fatigue;
    day.sprintLoad += sprintLoadOf(activity);
    day.lowerBodyLoad += load.lowerBodyDemand;
    if (TRAINING_ACTIVITY_TYPES.has(activity.type)) {
      day.hasTraining = true;
      day.isRest = false;
    } else if (activity.type !== "rest" && load.fatigue > 0.5) {
      day.isRest = false;
    }

    const isLift = activity.type === "strength" || activity.type === "hypertrophy";
    const template = activity.workoutTemplateId ? templateById.get(activity.workoutTemplateId) : undefined;

    if (isLift && template) {
      for (const mv of template.movements) {
        const entry = mv.exerciseId ? LIB_BY_ID.get(mv.exerciseId) : undefined;
        const name = entry?.name ?? mv.customExerciseName ?? "";
        const target = entry?.target ?? name;
        const group = muscleGroupOfTarget(target);
        const pattern = entry?.pattern ?? classifyMovementPattern(name, target);
        const sets = Math.max(0, mv.workingSets);
        totalWorkingSets += sets;
        if (group) {
          perMuscle[group].directSets += sets;
          touch(group, activity.dayIndex);
        }
        for (const ind of PATTERN_INDIRECT[pattern] ?? []) {
          perMuscle[ind].indirectSets += sets * 0.5;
          touch(ind, activity.dayIndex);
        }
        touchPattern(pattern, activity.dayIndex, 1);
      }
    } else if (isLift) {
      // Untemplated lift day — estimate from focus tags / title.
      const groups = musclesForFocus([...(activity.focus ?? []), activity.title]);
      const estimatedSets = groups.length > 0 ? Math.round(16 / groups.length) + 2 : 0;
      for (const g of groups) {
        perMuscle[g].directSets += estimatedSets;
        touch(g, activity.dayIndex);
      }
      totalWorkingSets += estimatedSets * groups.length;
    } else {
      // Side activity — contributes real (non-set) load to the same muscles.
      for (const [g, v] of Object.entries(load.direct) as Array<[MuscleGroup, number]>) {
        perMuscle[g].activityLoad += v * load.fatigue;
        touch(g, activity.dayIndex);
      }
      for (const [g, v] of Object.entries(load.indirect) as Array<[MuscleGroup, number]>) {
        perMuscle[g].activityLoad += v * load.fatigue * 0.5;
      }
      if (activity.type === "track" || activity.type === "sprint" || activity.type === "hiit") {
        touchPattern("Conditioning", activity.dayIndex, 1);
      }
    }
  }

  // Spacing, back-to-back, flags.
  for (const g of MUSCLE_GROUPS) {
    const m = perMuscle[g];
    m.daysTouched.sort((a, b) => a - b);
    m.frequency = m.daysTouched.length;
    if (m.daysTouched.length >= 2) {
      let minGap = Infinity;
      for (let i = 1; i < m.daysTouched.length; i++) {
        minGap = Math.min(minGap, m.daysTouched[i] - m.daysTouched[i - 1]);
      }
      // Rotation wrap (last day → first day of next cycle).
      minGap = Math.min(minGap, m.daysTouched[0] + rotation - m.daysTouched[m.daysTouched.length - 1]);
      m.minGapDays = minGap;
      m.backToBack = minGap <= 1;
    }
    const totalDirect = m.directSets + m.activityLoad;
    m.flag =
      m.frequency === 0 ? "untouched"
      : m.directSets >= 22 || (m.backToBack && m.directSets >= 14) ? "high"
      : totalDirect < 4 ? "light"
      : "balanced";
  }

  const sprintDays = days.filter((d) => d.sprintLoad >= 0.5).map((d) => d.dayIndex);
  const restDays = days.filter((d) => d.isRest).map((d) => d.dayIndex);

  let longest = 0;
  let run = 0;
  // Scan two rotations so streaks that wrap the cycle boundary are caught.
  for (let i = 0; i < rotation * 2; i++) {
    if (days[i % rotation].fatigue >= 2.2) {
      run += 1;
      longest = Math.max(longest, Math.min(run, rotation));
    } else {
      run = 0;
    }
  }

  return {
    perMuscle,
    patterns: [...patternMap.values()].sort((a, b) => b.count - a.count),
    days,
    sprintDays,
    restDays,
    longestHighFatigueStreak: longest,
    estimatedWeeklyWorkingSets: Math.round(totalWorkingSets),
  };
}

/* ─── Program-aware detailed exposure (v16) ───────────────────────────────
   Completed sets come only from immutable session closeout records. Side
   activity remains a separate coarse load contribution — never fake sets. */

export const DETAILED_MUSCLE_REGIONS = [
  "Chest", "Upper chest", "Back width", "Back thickness", "Traps",
  "Rear delts", "Front delts", "Side delts", "Biceps", "Triceps",
  "Forearms", "Quads", "Hamstrings", "Glutes", "Adductors", "Calves",
  "Core", "Lower back",
] as const;

export type DetailedMuscleRegion = (typeof DETAILED_MUSCLE_REGIONS)[number];

export const DETAILED_MOVEMENT_PATTERNS = [
  "Horizontal press", "Vertical press", "Horizontal pull", "Vertical pull",
  "Squat", "Hinge", "Lunge", "Knee flexion", "Knee extension",
  "Hip extension", "Calf plantar flexion", "Rotation", "Anti-rotation",
  "Anti-extension", "Sprint", "Jump", "Carry",
] as const;

export type DetailedMovementPattern = (typeof DETAILED_MOVEMENT_PATTERNS)[number];

export type DetailedExposureLine = {
  plannedDirectFrequency: number;
  actualDirectFrequency: number;
  plannedIndirectFrequency: number;
  actualIndirectFrequency: number;
  plannedSets: number;
  completedSets: number;
  estimatedIndirectExposure: "none" | "light" | "moderate" | "high";
  minimumRecoverySpacingDays: number | null;
  backToBack: boolean;
  sideActivityContribution: "none" | "light" | "moderate" | "high";
  confidence: "logged" | "derived" | "evidence-needed";
};

export type DetailedProgramExposureReport = {
  regions: Record<DetailedMuscleRegion, DetailedExposureLine>;
  patterns: Record<DetailedMovementPattern, {
    plannedOccurrences: number;
    actualOccurrences: number;
    daysTouched: number[];
  }>;
  missedSessions: number;
  substitutedSessions: number;
};

function detailedRegion(name: string, target: string): DetailedMuscleRegion | null {
  const text = `${name} ${target}`.toLowerCase();
  if (/incline|clavicular|upper chest/.test(text)) return "Upper chest";
  if (/chest|pec/.test(text)) return "Chest";
  if (/lat|pulldown|pull-up|pullover/.test(text)) return "Back width";
  if (/row|mid back|rhomboid/.test(text)) return "Back thickness";
  if (/trap|shrug/.test(text)) return "Traps";
  if (/rear delt|reverse fly|face pull/.test(text)) return "Rear delts";
  if (/front delt|anterior delt/.test(text)) return "Front delts";
  if (/side delt|lateral raise/.test(text)) return "Side delts";
  if (/bicep|curl/.test(text)) return "Biceps";
  if (/tricep|pressdown|extension/.test(text)) return "Triceps";
  if (/forearm|wrist/.test(text)) return "Forearms";
  if (/quad|squat|leg press|leg extension/.test(text)) return "Quads";
  if (/hamstring|leg curl|nordic/.test(text)) return "Hamstrings";
  if (/glute|hip thrust|bridge/.test(text)) return "Glutes";
  if (/adductor/.test(text)) return "Adductors";
  if (/calf|calves/.test(text)) return "Calves";
  if (/lower back|erector|back extension/.test(text)) return "Lower back";
  if (/core|ab|plank|pallof|carry/.test(text)) return "Core";
  return null;
}

function detailedPattern(name: string, target: string): DetailedMovementPattern | null {
  const text = `${name} ${target}`.toLowerCase();
  if (/sprint|acceleration|flying\s+\d/.test(text)) return "Sprint";
  if (/jump|bound|hop/.test(text)) return "Jump";
  if (/carry|farmer|suitcase/.test(text)) return "Carry";
  if (/pallof|anti.rotation/.test(text)) return "Anti-rotation";
  if (/plank|rollout|anti.extension/.test(text)) return "Anti-extension";
  if (/rotation|woodchop|twist/.test(text)) return "Rotation";
  if (/leg extension/.test(text)) return "Knee extension";
  const pattern = classifyMovementPattern(name, target);
  const map: Partial<Record<MovementPattern, DetailedMovementPattern>> = {
    "Horizontal Press": "Horizontal press",
    "Incline Press": "Horizontal press",
    "Vertical Press": "Vertical press",
    "Horizontal Pull": "Horizontal pull",
    "Vertical Pull": "Vertical pull",
    "Squat Pattern": "Squat",
    "Hip Hinge": "Hinge",
    "Lunge Pattern": "Lunge",
    "Knee Flexion": "Knee flexion",
    "Hip Extension": "Hip extension",
    "Calf Raise": "Calf plantar flexion",
  };
  return map[pattern] ?? null;
}

function level(value: number): "none" | "light" | "moderate" | "high" {
  return value <= 0 ? "none" : value < 2 ? "light" : value < 5 ? "moderate" : "high";
}

const DETAILED_PATTERN_INDIRECT: Partial<Record<DetailedMovementPattern, DetailedMuscleRegion[]>> = {
  "Horizontal press": ["Front delts", "Triceps"],
  "Vertical press": ["Triceps", "Core"],
  "Horizontal pull": ["Biceps", "Rear delts"],
  "Vertical pull": ["Biceps", "Forearms"],
  Squat: ["Glutes", "Adductors", "Core"],
  Hinge: ["Glutes", "Lower back", "Core"],
  Lunge: ["Glutes", "Adductors", "Core"],
  Sprint: ["Hamstrings", "Glutes", "Calves"],
  Carry: ["Forearms", "Core", "Traps"],
};

export function deriveDetailedProgramExposure(input: {
  program: ProgramDefinition;
  templates: CustomWorkoutTemplate[];
  schedule?: LifestyleSchedule | null;
  actualWeeks: ActualWeekRecord[];
}): DetailedProgramExposureReport {
  const templates = new Map(input.templates.map((template) => [template.id, template]));
  const regionDays = new Map<DetailedMuscleRegion, Set<number>>();
  const actualRegionDates = new Map<DetailedMuscleRegion, Set<string>>();
  const actualIndirectDates = new Map<DetailedMuscleRegion, Set<string>>();
  const indirect = new Map<DetailedMuscleRegion, number>();
  const side = new Map<DetailedMuscleRegion, number>();
  const regions = Object.fromEntries(DETAILED_MUSCLE_REGIONS.map((region) => [region, {
    plannedDirectFrequency: 0,
    actualDirectFrequency: 0,
    plannedIndirectFrequency: 0,
    actualIndirectFrequency: 0,
    plannedSets: 0,
    completedSets: 0,
    estimatedIndirectExposure: "none",
    minimumRecoverySpacingDays: null,
    backToBack: false,
    sideActivityContribution: "none",
    confidence: "evidence-needed",
  }])) as Record<DetailedMuscleRegion, DetailedExposureLine>;
  const patterns = Object.fromEntries(DETAILED_MOVEMENT_PATTERNS.map((pattern) => [pattern, {
    plannedOccurrences: 0,
    actualOccurrences: 0,
    daysTouched: [] as number[],
  }])) as DetailedProgramExposureReport["patterns"];

  for (const day of input.program.days) {
    const template = day.workoutTemplateId ? templates.get(day.workoutTemplateId) : undefined;
    for (const movement of template?.movements ?? []) {
      const entry = movement.exerciseId ? LIB_BY_ID.get(movement.exerciseId) : undefined;
      const name = entry?.name ?? movement.customExerciseName ?? "";
      const target = entry?.target ?? name;
      const region = detailedRegion(name, target);
      if (region) {
        regions[region].plannedSets += movement.workingSets;
        const days = regionDays.get(region) ?? new Set<number>();
        days.add(day.dayIndex);
        regionDays.set(region, days);
      }
      const pattern = detailedPattern(name, target);
      if (pattern) {
        patterns[pattern].plannedOccurrences += 1;
        if (!patterns[pattern].daysTouched.includes(day.dayIndex)) patterns[pattern].daysTouched.push(day.dayIndex);
        for (const indirectRegion of DETAILED_PATTERN_INDIRECT[pattern] ?? []) {
          indirect.set(indirectRegion, (indirect.get(indirectRegion) ?? 0) + 1);
        }
      }
    }
  }

  for (const activity of input.schedule?.activities ?? []) {
    if (activity.type === "strength" || activity.type === "hypertrophy") continue;
    const load = resolveActivityLoad(activity);
    const groupMap: Partial<Record<MuscleGroup, DetailedMuscleRegion[]>> = {
      chest: ["Chest"], back: ["Back width", "Back thickness"], quads: ["Quads"],
      hamstrings: ["Hamstrings"], glutes: ["Glutes"], delts: ["Front delts", "Side delts", "Rear delts"],
      arms: ["Biceps", "Triceps"], calves: ["Calves"], core: ["Core"], adductors: ["Adductors"],
    };
    for (const [group, value] of Object.entries(load.direct) as Array<[MuscleGroup, number]>) {
      for (const region of groupMap[group] ?? []) side.set(region, (side.get(region) ?? 0) + value * load.fatigue);
    }
    if (activity.type === "track" || activity.type === "sprint") {
      patterns.Sprint.plannedOccurrences += 1;
      if (!patterns.Sprint.daysTouched.includes(activity.dayIndex)) patterns.Sprint.daysTouched.push(activity.dayIndex);
    }
  }

  let missedSessions = 0;
  let substitutedSessions = 0;
  for (const week of input.actualWeeks) {
    for (const record of week.records) {
      if (record.status === "skipped") missedSessions += 1;
      if (record.status === "moved" || record.substitutedFromActivityId) substitutedSessions += 1;
      const template = record.sourceWorkoutTemplateId ? templates.get(record.sourceWorkoutTemplateId) : undefined;
      if (!template || !record.completedSetsByMovement) continue;
      for (const movement of template.movements) {
        const completed = record.completedSetsByMovement[movement.id] ?? 0;
        if (completed <= 0) continue;
        const entry = movement.exerciseId ? LIB_BY_ID.get(movement.exerciseId) : undefined;
        const name = entry?.name ?? movement.customExerciseName ?? "";
        const target = entry?.target ?? name;
        const region = detailedRegion(name, target);
        if (region) {
          regions[region].completedSets += completed;
          const dates = actualRegionDates.get(region) ?? new Set<string>();
          dates.add(record.date);
          actualRegionDates.set(region, dates);
        }
        const pattern = detailedPattern(name, target);
        if (pattern) {
          patterns[pattern].actualOccurrences += 1;
          for (const indirectRegion of DETAILED_PATTERN_INDIRECT[pattern] ?? []) {
            const dates = actualIndirectDates.get(indirectRegion) ?? new Set<string>();
            dates.add(record.date);
            actualIndirectDates.set(indirectRegion, dates);
          }
        }
      }
    }
  }

  for (const region of DETAILED_MUSCLE_REGIONS) {
    const days = [...(regionDays.get(region) ?? new Set<number>())].sort((a, b) => a - b);
    regions[region].plannedDirectFrequency = days.length;
    regions[region].actualDirectFrequency = actualRegionDates.get(region)?.size ?? 0;
    regions[region].plannedIndirectFrequency = indirect.get(region) ?? 0;
    regions[region].actualIndirectFrequency = actualIndirectDates.get(region)?.size ?? 0;
    regions[region].estimatedIndirectExposure = level(indirect.get(region) ?? 0);
    regions[region].sideActivityContribution = level(side.get(region) ?? 0);
    regions[region].confidence = regions[region].completedSets > 0
      ? "logged"
      : regions[region].plannedSets > 0 || (side.get(region) ?? 0) > 0 ? "derived" : "evidence-needed";
    if (days.length > 1) {
      let minimum = input.program.rotationLengthDays;
      days.forEach((day, index) => {
        const next = days[(index + 1) % days.length] + (index === days.length - 1 ? input.program.rotationLengthDays : 0);
        minimum = Math.min(minimum, next - day);
      });
      regions[region].minimumRecoverySpacingDays = minimum;
      regions[region].backToBack = minimum <= 1;
    }
  }

  return { regions, patterns, missedSessions, substitutedSessions };
}
