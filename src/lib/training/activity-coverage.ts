/* ════════════════════════════════════════════════════════════════════════
   ACTIVITY COVERAGE — what a class, run or sport session actually trained.

   A group class standing in for leg day IS leg day. Until now Reserve knew
   only that the day was an "activity" and said "no lifting today", so the
   session left no trace: the week showed a hole where real work happened,
   and nothing downstream could tell a leg-heavy class from a swim.

   This asks the one question that turns an activity into a training record:
   WHAT DID IT HIT? The member answers in body regions, because that is what
   they actually know walking out of a class. Nobody leaves a 6 AM class
   knowing their hack-squat tonnage; everybody knows their quads are gone.

   ── What this deliberately does NOT do ──────────────────────────────────
   It does not score the session, estimate volume, or decide the class was
   "enough". Reserve did not watch it. The member says what it hit, Reserve
   records it, and the week reads honestly. Suggestions are a starting point
   the member edits — never a silent default, because a suggestion saved
   without being read is Reserve inventing training that may not have
   happened.

   Pure + deterministic. Training record keeping only.
   ════════════════════════════════════════════════════════════════════════ */

import type { SplitActivityKey } from "./split-activities";
import type { ResolvedSplit } from "./workout-templates";

/** The regions a member can say an activity trained. */
export type TrainingRegion =
  | "quads"
  | "hamstrings"
  | "glutes"
  | "calves"
  | "chest"
  | "back"
  | "shoulders"
  | "arms"
  | "core"
  | "conditioning";

export const TRAINING_REGIONS: ReadonlyArray<{ key: TrainingRegion; label: string; group: "lower" | "upper" | "other" }> = [
  { key: "quads", label: "Quads", group: "lower" },
  { key: "hamstrings", label: "Hamstrings", group: "lower" },
  { key: "glutes", label: "Glutes", group: "lower" },
  { key: "calves", label: "Calves", group: "lower" },
  { key: "chest", label: "Chest", group: "upper" },
  { key: "back", label: "Back", group: "upper" },
  { key: "shoulders", label: "Shoulders", group: "upper" },
  { key: "arms", label: "Arms", group: "upper" },
  { key: "core", label: "Core", group: "other" },
  { key: "conditioning", label: "Conditioning", group: "other" },
];

const REGION_LABEL = new Map(TRAINING_REGIONS.map((r) => [r.key, r.label]));

/**
 * A starting point for the picker, by activity. Offered, never saved on the
 * member's behalf — an unopened suggestion is a guess, and a guess written
 * into the training record is indistinguishable from work that happened.
 *
 * A group class returns NOTHING on purpose: it is the one activity whose
 * content genuinely cannot be guessed. A studio class might be legs, might
 * be arms, might be a full-body circuit, and picking one would be wrong most
 * of the time. That is exactly the case the member has to answer.
 */
export function suggestedRegionsFor(activity: SplitActivityKey): TrainingRegion[] {
  switch (activity) {
    case "run":
    case "long-run":
    case "zone2":
      return ["quads", "hamstrings", "calves", "conditioning"];
    case "track":
      return ["quads", "hamstrings", "glutes", "calves", "conditioning"];
    case "cycling":
      return ["quads", "glutes", "conditioning"];
    case "swim":
      return ["back", "shoulders", "core", "conditioning"];
    case "conditioning":
      return ["conditioning"];
    case "yoga":
    case "mobility":
      return ["core"];
    case "sport":
      return ["quads", "hamstrings", "calves", "conditioning"];
    case "group-class":
    default:
      /* Unknowable by design — the member answers this one. */
      return [];
  }
}

/** Which regions a planned lifting day would have trained. */
export function regionsForSplitKey(split: ResolvedSplit | null | undefined): TrainingRegion[] {
  switch (split) {
    case "legs":
    case "lower":
      return ["quads", "hamstrings", "glutes", "calves"];
    case "lower-posterior":
      return ["hamstrings", "glutes"];
    case "push":
      return ["chest", "shoulders", "arms"];
    case "pull":
      return ["back", "arms"];
    case "upper":
    case "upper-specialization":
      return ["chest", "back", "shoulders", "arms"];
    case "chest":
      return ["chest"];
    case "back":
      return ["back"];
    case "shoulders":
      return ["shoulders"];
    case "arms":
    case "arms-delts":
      return ["arms", "shoulders"];
    case "chest-back":
      return ["chest", "back"];
    case "full-body":
      return ["quads", "hamstrings", "glutes", "chest", "back", "shoulders"];
    default:
      return [];
  }
}

/** Stable display order, so the same set always reads the same way. */
export function orderRegions(regions: readonly TrainingRegion[]): TrainingRegion[] {
  const wanted = new Set(regions);
  return TRAINING_REGIONS.filter((r) => wanted.has(r.key)).map((r) => r.key);
}

/** "Quads, hamstrings and calves" — or null when nothing has been said yet. */
export function describeRegions(regions: readonly TrainingRegion[]): string | null {
  const ordered = orderRegions(regions);
  if (ordered.length === 0) return null;
  const labels = ordered.map((r) => REGION_LABEL.get(r) ?? r);
  if (labels.length === 1) return labels[0];
  const lowered = labels.map((l, i) => (i === 0 ? l : l.toLowerCase()));
  return `${lowered.slice(0, -1).join(", ")} and ${lowered[lowered.length - 1]}`;
}

export type CoverageVerdict = {
  /** Regions the planned day wanted that the activity did report. */
  covered: TrainingRegion[];
  /** Regions the planned day wanted that it did not. */
  missed: TrainingRegion[];
  /** True when the activity reported every region the planned day wanted. */
  standsIn: boolean;
};

/**
 * Compare what the member said the activity hit against what the planned
 * lifting day would have trained.
 *
 * This is a factual comparison of two lists, not a judgement. It never says
 * the class was insufficient or that the member should add work — it reports
 * which planned regions went untouched so the member can decide. With no
 * planned lifting day there is nothing to compare, and `standsIn` is false
 * rather than a vacuous true.
 */
export function compareCoverage(
  reported: readonly TrainingRegion[],
  planned: readonly TrainingRegion[],
): CoverageVerdict {
  const said = new Set(reported);
  const covered = orderRegions(planned.filter((r) => said.has(r)));
  const missed = orderRegions(planned.filter((r) => !said.has(r)));
  return { covered, missed, standsIn: planned.length > 0 && missed.length === 0 };
}

/** What the member's own record for one activity day looks like. */
export type ActivityCoverage = {
  /** ISO date, YYYY-MM-DD. */
  date: string;
  activity: SplitActivityKey;
  regions: TrainingRegion[];
  /** Minutes, when the member gave them. */
  minutes?: number;
  /** When the member answered — this is their record, so it carries a time. */
  loggedAt: string;
};

/** Drop anything that is not a known region, so stored data cannot drift. */
export function sanitizeRegions(value: unknown): TrainingRegion[] {
  if (!Array.isArray(value)) return [];
  const known = new Set(TRAINING_REGIONS.map((r) => r.key));
  const seen = new Set<TrainingRegion>();
  for (const v of value) {
    if (typeof v === "string" && known.has(v as TrainingRegion)) seen.add(v as TrainingRegion);
  }
  return orderRegions([...seen]);
}
