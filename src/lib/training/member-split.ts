/* ════════════════════════════════════════════════════════════════════════
   MEMBER SPLIT — the split a member chose, and the week it gives them.

   A member's chosen split sets the days; an active program keeps its phase,
   volume, intensity and progression. The chosen split therefore resolves
   exactly as the week rail resolves it — turned around the member's rest day,
   with the engine's Legs lead — and, while a program is running, is expressed
   in the program's session vocabulary so demand, nutrition and recovery read
   the day the member actually trains.

   Pure and deterministic.
   ════════════════════════════════════════════════════════════════════════ */

import { buildArchitectureResolvedWeek, toApexWeekDays, type ResolvedDay } from "./daily-context";
import type { SplitActivityKey } from "./split-activities";
import type { SplitArchitecture } from "./split-architectures";
import type { BlueprintDay, SessionArchetype, SessionIntent } from "./split-blueprints";
import type { TrainingWeekDay } from "./weekly-split";

export type MemberSplit = {
  architecture: SplitArchitecture;
  /** 0 = Monday … 6 = Sunday. Null keeps the split's own rest day. */
  restDayIndex: number | null;
  /** The member's weak points — they decide what Legs leads with. */
  musclePriority: string[];
};

const NO_CHEST = { active: false, upperChest: false };

/** How each split day reads as a program session. */
const SESSION_BY_SPLIT_KEY: Record<string, { archetype: SessionArchetype; emphasis: string[] }> = {
  push: { archetype: "push", emphasis: ["chest", "delts", "triceps"] },
  pull: { archetype: "pull", emphasis: ["back", "biceps", "forearms", "traps"] },
  legs: { archetype: "legs", emphasis: ["quads", "hamstrings", "glutes", "calves"] },
  lower: { archetype: "lower-strength", emphasis: ["quads", "hamstrings", "glutes"] },
  "lower-posterior": { archetype: "posterior-chain", emphasis: ["hamstrings", "glutes", "calves"] },
  upper: { archetype: "upper-strength", emphasis: ["chest", "back", "delts"] },
  "upper-specialization": { archetype: "upper-hypertrophy", emphasis: ["upper-chest", "delts", "arms"] },
  arms: { archetype: "arms-pump", emphasis: ["biceps", "triceps", "forearms"] },
  "arms-delts": { archetype: "delts-arms", emphasis: ["delts", "arms"] },
  shoulders: { archetype: "shoulders", emphasis: ["delts"] },
  chest: { archetype: "chest-strength", emphasis: ["chest"] },
  back: { archetype: "back-width", emphasis: ["back"] },
  "chest-back": { archetype: "chest-back-strength", emphasis: ["chest", "back"] },
  "full-body": { archetype: "full-body-athletic", emphasis: ["full-body"] },
};

/** Emphasis for sessions the engine or the split names directly. */
const EMPHASIS_BY_ARCHETYPE: Partial<Record<SessionArchetype, string[]>> = {
  "quad-focus": ["quads"],
  "hamstring-glute": ["hamstrings", "glutes"],
  conditioning: ["conditioning"],
  "sport-conditioning": ["conditioning", "sport"],
};

/** Non-lifting days carry real load — they read as conditioning or mobility. */
const SESSION_BY_ACTIVITY: Record<SplitActivityKey, { archetype: SessionArchetype; intent: SessionIntent }> = {
  track: { archetype: "sprint-power", intent: "conditioning" },
  run: { archetype: "outdoor-distance", intent: "conditioning" },
  "long-run": { archetype: "outdoor-distance", intent: "conditioning" },
  "group-class": { archetype: "sport-conditioning", intent: "conditioning" },
  sport: { archetype: "sport-conditioning", intent: "sport" },
  conditioning: { archetype: "conditioning", intent: "conditioning" },
  zone2: { archetype: "zone2", intent: "conditioning" },
  swim: { archetype: "zone2", intent: "conditioning" },
  cycling: { archetype: "zone2", intent: "conditioning" },
  yoga: { archetype: "yoga", intent: "mobility" },
  mobility: { archetype: "mobility", intent: "mobility" },
  /* Pilates and barre are real sessions with their own identity — they resolve
     to their own templates rather than being flattened into a group class. */
  pilates: { archetype: "pilates", intent: "mobility" },
  "reformer-pilates": { archetype: "pilates", intent: "mobility" },
  barre: { archetype: "pilates", intent: "tone" },
  walk: { archetype: "zone2", intent: "conditioning" },
  hike: { archetype: "zone2", intent: "conditioning" },
  "strength-class": { archetype: "full-body-athletic", intent: "conditioning" },
};

const CONDITIONING_ARCHETYPES = new Set<SessionArchetype>(["conditioning", "sport-conditioning"]);

function toProgramDay(day: ResolvedDay): BlueprintDay {
  if (day.recovery) {
    return { title: day.title, archetype: "recovery", emphasis: [], intent: "recovery", priority: 99, recovery: true };
  }
  if (day.activity) {
    const session = SESSION_BY_ACTIVITY[day.activity.key as SplitActivityKey] ?? { archetype: "conditioning", intent: "conditioning" };
    return { title: day.title, archetype: session.archetype, emphasis: [day.activity.key], intent: session.intent, priority: 1 };
  }
  const bySplit = day.splitKey ? SESSION_BY_SPLIT_KEY[day.splitKey] : undefined;
  const archetype = day.archetype ?? bySplit?.archetype ?? "full-body-athletic";
  const emphasis = (day.archetype ? EMPHASIS_BY_ARCHETYPE[day.archetype] : undefined) ?? bySplit?.emphasis ?? [];
  const intent: SessionIntent = CONDITIONING_ARCHETYPES.has(archetype) ? "conditioning" : "hypertrophy";
  return { title: day.title, archetype, emphasis: [...emphasis], intent, priority: 1 };
}

/** The split's week in the program's terms — replaces a running program week's days. */
export function memberSplitWeekStructure(split: MemberSplit, weekNumber: number): BlueprintDay[] {
  return buildArchitectureResolvedWeek(split.architecture, NO_CHEST, weekNumber, {
    restDayIndex: split.restDayIndex,
    musclePriority: split.musclePriority,
  }).map(toProgramDay);
}

/** The rest day a split authors — the one a member moves (0 = Monday … 6 = Sunday). */
export function authoredRestDayIndex(architecture: SplitArchitecture): number | null {
  const index = architecture.week.map((d) => Boolean(d.recovery)).lastIndexOf(true);
  return index >= 0 ? index : null;
}

/** The week a member would train with a split, drawn the way the rail draws it. */
export function splitPreviewWeek(
  split: MemberSplit,
  opts: { weekNumber?: number | null; now?: Date } = {},
): TrainingWeekDay[] {
  const week = buildArchitectureResolvedWeek(split.architecture, NO_CHEST, opts.weekNumber ?? 1, {
    restDayIndex: split.restDayIndex,
    musclePriority: split.musclePriority,
  });
  return toApexWeekDays(week, opts.now ?? new Date());
}
