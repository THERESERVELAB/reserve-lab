/* ════════════════════════════════════════════════════════════════════════
   WEEKLY COMMITMENTS — the things a member already does every week.

   ACTIVITY_STACKS asked one multiple-choice question and offered eight preset
   bundles: "Gym + Pilates", "Full Hybrid Week". It carried no frequency, so a
   member could not say TWICE a week. It carried no days, so she could not say
   TUESDAY AND THURSDAY. And sport was a single value, so "track every week
   AND Pilates twice" was not expressible at all.

   The only thing that could express it was a weekly SplitDayEdit — an
   after-the-fact override. A member built a week blind to her own life and
   then corrected it day by day.

   A commitment is a standing fact about her week, captured BEFORE the week is
   built. Reserve reads them when it places sessions: a heavy lower day is not
   put the morning after track, and a week that already carries two Pilates
   sessions does not also get prescribed a mobility day.

   Leaf module: imports only the activity leaf, so the store, the resolver and
   the UI can all share it without a cycle. Pure and deterministic. Planning
   and organisation only — no medical content, no prescription.
   ════════════════════════════════════════════════════════════════════════ */

import { splitActivity, type SplitActivityKey, type SplitActivityLoad } from "./split-activities";

/** 0 = Monday … 6 = Sunday, matching the rest of the training layer. */
export type WeekdayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const WEEKDAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export type WeeklyCommitment = {
  id: string;
  activity: SplitActivityKey;
  /** How many times a week she does it. 1–7. */
  timesPerWeek: number;
  /**
   * The weekdays it lands on, when they are fixed. Empty means "this many
   * times a week, you pick the days" — a real distinction: a Tuesday class is
   * immovable, four cardio sessions are not.
   */
  days: WeekdayIndex[];
  /** Her own minutes, when she states them. Falls back to the activity default. */
  minutes?: number;
  /** Morning sessions are the ones that pair with an evening lift. */
  partOfDay?: "morning" | "midday" | "evening";
  notes?: string;
};

export const COMMITMENT_MAX_PER_WEEK = 7;

/* ── Validation ───────────────────────────────────────────────────────────── */

export function isValidCommitment(value: unknown): value is WeeklyCommitment {
  if (!value || typeof value !== "object") return false;
  const c = value as Partial<WeeklyCommitment>;
  if (typeof c.id !== "string" || !c.id) return false;
  if (!splitActivity(c.activity as string)) return false;
  if (typeof c.timesPerWeek !== "number" || !Number.isInteger(c.timesPerWeek)) return false;
  if (c.timesPerWeek < 1 || c.timesPerWeek > COMMITMENT_MAX_PER_WEEK) return false;
  if (!Array.isArray(c.days)) return false;
  if (c.days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) return false;
  if (new Set(c.days).size !== c.days.length) return false;
  /* Named days cannot exceed the stated frequency — "twice a week on Mon, Tue,
     Thu" is not a thing, and silently honouring one of the two numbers would
     mislead her about her own week. */
  if (c.days.length > c.timesPerWeek) return false;
  if (c.minutes != null && (typeof c.minutes !== "number" || c.minutes <= 0 || c.minutes > 600)) return false;
  return true;
}

/** Drop anything malformed rather than letting one bad row break a week. */
export function sanitizeCommitments(value: unknown): WeeklyCommitment[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isValidCommitment).slice(0, 12);
}

/* ── Reads ────────────────────────────────────────────────────────────────── */

/** Total committed sessions a week, across every commitment. */
export function totalSessionsPerWeek(commitments: WeeklyCommitment[]): number {
  return commitments.reduce((sum, c) => sum + c.timesPerWeek, 0);
}

const LOAD_WEIGHT: Record<SplitActivityLoad, number> = { low: 0.5, moderate: 1, high: 1.75 };

/**
 * Outside-training load, weighted by what each activity actually costs. Two
 * Pilates sessions and two track sessions are not the same week, and the
 * preset stacks treated both as a single "moderate" or "high" label.
 */
export function commitmentLoadScore(commitments: WeeklyCommitment[]): number {
  return commitments.reduce((sum, c) => {
    const def = splitActivity(c.activity);
    return sum + c.timesPerWeek * LOAD_WEIGHT[def?.load ?? "moderate"];
  }, 0);
}

export type CommitmentLoad = "light" | "moderate" | "heavy";

export function commitmentLoad(commitments: WeeklyCommitment[]): CommitmentLoad {
  const score = commitmentLoadScore(commitments);
  if (score >= 6) return "heavy";
  if (score >= 2.5) return "moderate";
  return "light";
}

/** Weekdays that carry at least one fixed commitment. */
export function committedDays(commitments: WeeklyCommitment[]): Set<WeekdayIndex> {
  const days = new Set<WeekdayIndex>();
  for (const c of commitments) for (const d of c.days) days.add(d);
  return days;
}

/** The activities on a given weekday, in the order she entered them. */
export function commitmentsOnDay(commitments: WeeklyCommitment[], day: WeekdayIndex): WeeklyCommitment[] {
  return commitments.filter((c) => c.days.includes(day));
}

/** Whether she already does this activity, at any frequency. */
export function doesActivity(commitments: WeeklyCommitment[], activity: SplitActivityKey): boolean {
  return commitments.some((c) => c.activity === activity);
}

/**
 * Days that should not carry a heavy lower-body session, because a high-load
 * commitment lands on them or on the day before. Placement only — it reports
 * the conflict and never silently moves anything.
 */
export function heavyLowerAvoidDays(commitments: WeeklyCommitment[]): Set<WeekdayIndex> {
  const avoid = new Set<WeekdayIndex>();
  const LEG_HEAVY: SplitActivityKey[] = ["track", "sport", "long-run", "run", "hike", "strength-class"];
  for (const c of commitments) {
    if (!LEG_HEAVY.includes(c.activity)) continue;
    const def = splitActivity(c.activity);
    if (def?.load === "low") continue;
    for (const d of c.days) {
      avoid.add(d);
      avoid.add(((d + 1) % 7) as WeekdayIndex);
    }
  }
  return avoid;
}

/**
 * Derive the legacy ActivityStack key from the real commitments, so the
 * existing blueprint layer keeps working while the member answers one
 * question instead of two. Returns null when she has no commitments, which
 * means gym-only.
 */
export function deriveActivityStackKey(commitments: WeeklyCommitment[]): string {
  if (commitments.length === 0) return "gym-only";
  const pilates = doesActivity(commitments, "pilates") || doesActivity(commitments, "reformer-pilates") || doesActivity(commitments, "barre");
  const yoga = doesActivity(commitments, "yoga");
  const sport = ["sport", "track", "run", "long-run", "swim", "cycling", "hike"].some((a) =>
    doesActivity(commitments, a as SplitActivityKey),
  );
  if (pilates && yoga && sport) return "full-hybrid";
  if (pilates && sport) return "gym-pilates-sports";
  if (pilates && yoga) return "gym-pilates-yoga";
  if (sport) return "gym-sports";
  if (pilates) return "gym-pilates";
  if (yoga) return "gym-yoga";
  return "gym-only";
}

/** One honest sentence describing her committed week. No advice. */
export function commitmentSummary(commitments: WeeklyCommitment[]): string {
  if (commitments.length === 0) return "No standing commitments — the whole week is Reserve's to plan.";
  const parts = commitments.map((c) => {
    const label = splitActivity(c.activity)?.label ?? c.activity;
    const days = c.days.length === c.timesPerWeek && c.days.length > 0
      ? ` on ${c.days.slice().sort((a, b) => a - b).map((d) => WEEKDAY_SHORT[d]).join(" and ")}`
      : "";
    return `${label} ${c.timesPerWeek}×${days}`;
  });
  const list = parts.length === 1
    ? parts[0]
    : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
  return `${list} — ${totalSessionsPerWeek(commitments)} sessions a week outside the gym plan.`;
}
