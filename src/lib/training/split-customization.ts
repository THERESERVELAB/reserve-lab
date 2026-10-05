/* ════════════════════════════════════════════════════════════════════════
   SPLIT CUSTOMIZATION — the member's hand on their own week.

   A split is a starting point, not a contract. If the plan says Chest on
   Friday and the member wants Legs, that is the member's week. If they
   decide at 6 AM to skip, or a 5:45 AM group class is standing in for leg
   day, the week has to say so — everywhere, including the workout Reserve
   loads.

   Three layers, resolved per day, most specific first:

     1. DATED   — "just this Friday". Wins for that date only.
     2. WEEKLY  — "every Friday". Applies to every week until cleared.
     3. PLAN    — whatever the split / program resolved.

   Applied inside `resolveDailyTrainingContext`, so Apex, Training Command,
   the week rail and the cockpit all read the same edited week and can never
   disagree about what today is.

   LEARNING, honestly. When a member makes the same one-off change on the
   same weekday in at least two of the last four weeks, Reserve offers to
   make it permanent. Clears are recorded too, so a change the member took
   back never counts as evidence. Nothing is applied without the member.

   Pure and deterministic. No store access.
   ════════════════════════════════════════════════════════════════════════ */

import { SPLIT_ACTIVITIES, splitActivity, type SplitActivityKey, type SplitActivityLoad } from "./split-activities";
import { resolveSplitKey, type SplitKey } from "./workout-templates";
import type { ResolvedDay } from "./daily-context";

/* ─── Lifting sessions a member can put on any day ────────────────────── */

export type SplitSessionKey = Extract<
  SplitKey,
  | "push"
  | "pull"
  | "legs"
  | "upper"
  | "lower"
  | "full-body"
  | "arms"
  | "chest"
  | "back"
  | "shoulders"
  | "arms-delts"
  | "lower-posterior"
  | "chest-back"
  | "upper-specialization"
>;

export type SplitSessionDef = {
  key: SplitSessionKey;
  /** MUST resolve to `key` via resolveSplitKey — asserted by the test suite. */
  label: string;
  goal: string;
  /** Pattern days (push/pull/legs…) vs body-part days (chest/back/arms…). */
  group: "pattern" | "region";
};

export const SPLIT_SESSIONS: SplitSessionDef[] = [
  { key: "push", label: "Push", goal: "Chest, delts and triceps", group: "pattern" },
  { key: "pull", label: "Pull", goal: "Back and biceps", group: "pattern" },
  { key: "legs", label: "Legs", goal: "Complete lower session", group: "pattern" },
  { key: "upper", label: "Upper", goal: "Full upper session", group: "pattern" },
  { key: "lower", label: "Lower", goal: "Full lower session", group: "pattern" },
  { key: "full-body", label: "Full Body", goal: "Every major pattern in one session", group: "pattern" },
  /* "Arm Day", never bare "Arms": the template alias table only matches
     "arm day" / "arms day" / "arms only", so "Arms" would load nothing. */
  { key: "arms", label: "Arm Day", goal: "Biceps and triceps", group: "region" },
  { key: "chest", label: "Chest Day", goal: "Chest focus", group: "region" },
  { key: "back", label: "Back Day", goal: "Back width and thickness", group: "region" },
  { key: "shoulders", label: "Shoulders", goal: "Delts focus", group: "region" },
  { key: "arms-delts", label: "Arms / Delts", goal: "Shoulders and arms", group: "region" },
  { key: "lower-posterior", label: "Posterior Legs", goal: "Hamstrings and glutes", group: "region" },
  { key: "chest-back", label: "Chest / Back", goal: "Chest and back paired", group: "region" },
  { key: "upper-specialization", label: "Upper Specialization", goal: "Upper weak-point detail", group: "region" },
];

const SESSION_BY_KEY = new Map(SPLIT_SESSIONS.map((s) => [s.key, s]));

export function splitSession(key: string | null | undefined): SplitSessionDef | null {
  if (!key) return null;
  return SESSION_BY_KEY.get(key as SplitSessionKey) ?? null;
}

/* ─── Distance goal ───────────────────────────────────────────────────── */

/** The member's own distance goal for an activity day, e.g. 3 mi on the track.
    Reserve never suggests one — it only records and shows what they set. */
export type SplitDistanceUnit = "mi" | "km";
export type SplitDistance = { value: number; unit: SplitDistanceUnit };

export const SPLIT_DISTANCE_MIN = 0.1;
export const SPLIT_DISTANCE_MAX = 100;

export function isValidSplitDistance(distance: unknown): distance is SplitDistance {
  if (!distance || typeof distance !== "object") return false;
  const d = distance as Record<string, unknown>;
  return (
    typeof d.value === "number" &&
    Number.isFinite(d.value) &&
    d.value >= SPLIT_DISTANCE_MIN &&
    d.value <= SPLIT_DISTANCE_MAX &&
    (d.unit === "mi" || d.unit === "km")
  );
}

/** "3 mi", "5 km", "3.1 mi" — at most two decimals, no trailing zeros. */
export function formatSplitDistance(distance: SplitDistance | null | undefined): string | null {
  if (!isValidSplitDistance(distance)) return null;
  return `${Number(distance.value.toFixed(2))} ${distance.unit}`;
}

/** Parse the member's typed distance. Empty → undefined (no goal); anything
    outside 0.1–100 or not a number → null (reject, do not guess). */
export function parseSplitDistance(raw: string, unit: SplitDistanceUnit): SplitDistance | undefined | null {
  const text = raw.trim().replace(",", ".");
  if (!text) return undefined;
  const value = Number(text);
  const distance = { value: Math.round(value * 100) / 100, unit };
  return isValidSplitDistance(distance) ? distance : null;
}

/* ─── Edits ───────────────────────────────────────────────────────────── */

export type SplitDayEdit =
  | { kind: "session"; session: SplitSessionKey }
  | {
      kind: "activity";
      activity: SplitActivityKey;
      /** "HH:MM" 24h — e.g. "05:45" for an early class. */
      startTime?: string;
      durationMinutes?: number;
      /** The member's own distance goal. Absent on edits saved before it existed. */
      distance?: SplitDistance;
    }
  | { kind: "rest" };

export type SplitEditScope = "once" | "weekly";

export type StoredSplitDayEdit = SplitDayEdit & { updatedAt: string };

export type SplitEditHistoryEntry = {
  /** YYYY-MM-DD the change was made FOR. */
  date: string;
  /** Monday = 0 … Sunday = 6. */
  dayIndex: number;
  scope: SplitEditScope;
  /** null records a clear — the member took the change back. */
  edit: SplitDayEdit | null;
  at: string;
};

export type SplitCustomization = {
  /** Keyed by day index as a string ("0"…"6") — JSON object keys are strings. */
  weekly: Record<string, StoredSplitDayEdit>;
  /** Keyed by YYYY-MM-DD. */
  dated: Record<string, StoredSplitDayEdit>;
  history: SplitEditHistoryEntry[];
};

export const DEFAULT_SPLIT_CUSTOMIZATION: SplitCustomization = { weekly: {}, dated: {}, history: [] };

/** Bounded so persisted + cloud-synced state cannot grow without limit. */
export const SPLIT_EDIT_HISTORY_LIMIT = 120;
/** Dated edits older than this are pruned; they can no longer affect a week. */
export const SPLIT_DATED_RETENTION_DAYS = 60;

export const WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/* ─── Dates (local, Monday-first — matches RESERVE_WEEK_SPLIT) ────────── */

const DAY_MS = 86_400_000;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function mondayDayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

function parseDateKey(key: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return null;
  // Noon avoids DST edges moving the date.
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12);
}

function mondayOf(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - mondayDayIndex(date), 12);
}

/** The seven YYYY-MM-DD keys of the Monday-first week containing `now`. */
export function weekDateKeys(now: Date): string[] {
  const monday = mondayOf(now);
  return Array.from({ length: 7 }, (_, i) =>
    localDateKey(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i, 12)),
  );
}

/* ─── Validation ──────────────────────────────────────────────────────── */

/** Persisted state can be stale or hand-edited. An edit that no longer
    names a real session or activity is ignored rather than crashing a week. */
export function isValidSplitDayEdit(edit: unknown): edit is SplitDayEdit {
  if (!edit || typeof edit !== "object") return false;
  const e = edit as Record<string, unknown>;
  if (e.kind === "rest") return true;
  if (e.kind === "session") return Boolean(splitSession(e.session as string));
  if (e.kind === "activity") {
    if (!splitActivity(e.activity as string)) return false;
    // Optional; a malformed goal makes the whole edit untrustworthy.
    return e.distance === undefined || isValidSplitDistance(e.distance);
  }
  return false;
}

/** Identity of the CHOICE (Legs, Track, Rest). Time, minutes and distance are
    details of the same choice, so a 3 mi track day and a 5 mi track day are
    the same change for picking and for the weekly-pattern suggestion. */
function editSignature(edit: SplitDayEdit): string {
  if (edit.kind === "session") return `session:${edit.session}`;
  if (edit.kind === "activity") return `activity:${edit.activity}`;
  return "rest";
}

export function sameSplitDayEdit(a: SplitDayEdit | null | undefined, b: SplitDayEdit | null | undefined): boolean {
  if (!a || !b) return false;
  return editSignature(a) === editSignature(b);
}

/** Member-facing name of an edit, e.g. "Legs", "Group Class", "Rest". */
export function describeSplitDayEdit(edit: SplitDayEdit): string {
  if (edit.kind === "session") return splitSession(edit.session)?.label ?? "Session";
  if (edit.kind === "activity") return splitActivity(edit.activity)?.label ?? "Activity";
  return "Rest";
}

/* ─── Applying edits to a resolved week ───────────────────────────────── */

export type ResolvedDayActivity = {
  key: SplitActivityKey;
  label: string;
  load: SplitActivityLoad;
  startTime?: string;
  durationMinutes?: number;
  /** The member's own distance goal — see formatSplitDistance. */
  distance?: SplitDistance;
};

function applyEditToDay(day: ResolvedDay, edit: SplitDayEdit, scope: SplitEditScope): ResolvedDay {
  const memberEdit = { scope, kind: edit.kind };

  if (edit.kind === "rest") {
    return {
      ...day,
      title: "Rest",
      displayTitle: "Rest",
      splitKey: "recovery",
      recovery: true,
      // A stale blueprint archetype (e.g. chest-back-pump) must never survive
      // an edit, or the cockpit would keep loading the old session identity.
      archetype: undefined,
      transform: "none",
      activity: undefined,
      goal: "Rest day — set by you",
      reason: `You set ${day.dayLong} as a rest day.`,
      protect: "Keep it restful. The next session is built tonight.",
      memberEdit,
    };
  }

  if (edit.kind === "session") {
    const def = splitSession(edit.session)!;
    return {
      ...day,
      title: def.label,
      displayTitle: def.label,
      splitKey: resolveSplitKey(def.label),
      recovery: false,
      archetype: undefined,
      transform: "none",
      activity: undefined,
      goal: def.goal,
      reason: `You set ${day.dayLong} to ${def.label}.`,
      protect: "Protect tomorrow's output — quality volume, no junk sets.",
      memberEdit,
    };
  }

  const def = splitActivity(edit.activity)!;
  return {
    ...day,
    title: def.label,
    displayTitle: def.label,
    // No lifting template — an activity day must never load a gym session.
    splitKey: null,
    recovery: false,
    archetype: undefined,
    transform: "none",
    activity: {
      key: def.key,
      label: def.label,
      load: def.load,
      startTime: edit.startTime,
      durationMinutes: edit.durationMinutes ?? def.defaultMinutes,
      ...(edit.distance ? { distance: edit.distance } : {}),
    },
    goal: def.goal,
    reason: `You set ${day.dayLong} to ${def.label}.`,
    protect:
      def.load === "high"
        ? "A hard session — fuel and sleep for it like a lifting day."
        : "Keep the next lifting session in view.",
    memberEdit,
  };
}

/**
 * Overlay the member's edits on a resolved week.
 *
 * `weekDates` are the seven YYYY-MM-DD keys of the week being shown
 * (see `weekDateKeys`). A dated edit beats a weekly edit for its date.
 */
export function applySplitCustomization(
  week: ResolvedDay[],
  customization: SplitCustomization | null | undefined,
  weekDates: string[],
): ResolvedDay[] {
  if (!customization) return week;
  const weekly = customization.weekly ?? {};
  const dated = customization.dated ?? {};
  if (Object.keys(weekly).length === 0 && Object.keys(dated).length === 0) return week;

  return week.map((day) => {
    const date = weekDates[day.dayIndex];
    const once = date ? dated[date] : undefined;
    if (once && isValidSplitDayEdit(once)) return applyEditToDay(day, once, "once");

    const every = weekly[String(day.dayIndex)];
    if (every && isValidSplitDayEdit(every)) return applyEditToDay(day, every, "weekly");

    return day;
  });
}

/* ─── Recording an edit ───────────────────────────────────────────────── */

export type SplitDayEditInput = {
  dayIndex: number;
  /** The date the member is looking at. Required for "once"; for "weekly" it
      clears any one-off change on that date so the new rule governs it. */
  dateKey: string;
  scope: SplitEditScope;
  /** null clears the change at this scope. */
  edit: SplitDayEdit | null;
};

/** Pure reducer used by the store. */
export function recordSplitDayEdit(
  current: SplitCustomization | null | undefined,
  input: SplitDayEditInput,
  now: Date = new Date(),
): SplitCustomization {
  const at = now.toISOString();
  const weekly = { ...(current?.weekly ?? {}) };
  const dated = { ...(current?.dated ?? {}) };
  const history = [...(current?.history ?? [])];
  const edit = input.edit && isValidSplitDayEdit(input.edit) ? input.edit : null;
  const dayKey = String(input.dayIndex);

  if (input.scope === "weekly") {
    if (edit) weekly[dayKey] = { ...edit, updatedAt: at };
    else delete weekly[dayKey];
    // "Every Friday" means this Friday too. A leftover one-off would otherwise
    // silently keep overriding the rule the member just set.
    delete dated[input.dateKey];
  } else {
    if (edit) dated[input.dateKey] = { ...edit, updatedAt: at };
    else delete dated[input.dateKey];
  }

  history.push({ date: input.dateKey, dayIndex: input.dayIndex, scope: input.scope, edit, at });

  // Prune one-off edits that can no longer affect any week the member sees.
  const cutoff = now.getTime() - SPLIT_DATED_RETENTION_DAYS * DAY_MS;
  for (const key of Object.keys(dated)) {
    const d = parseDateKey(key);
    if (!d || d.getTime() < cutoff) delete dated[key];
  }

  return { weekly, dated, history: history.slice(-SPLIT_EDIT_HISTORY_LIMIT) };
}

/* ─── Move today's session to tomorrow ────────────────────────────────── */

/** The lifting session a resolved day carries, as a key a member can move.
    Null on rest and activity days, and on days whose session has no
    member-selectable equivalent. */
export function movableSessionKey(day: {
  recovery: boolean;
  activity?: unknown;
  splitKey?: string | null;
  title?: string;
}): SplitSessionKey | null {
  if (day.recovery || day.activity) return null;
  return splitSession(day.splitKey)?.key ?? splitSession(resolveSplitKey(day.title))?.key ?? null;
}

/** The YYYY-MM-DD after `dateKey`, and its Monday-first index. Crosses week,
    month and year boundaries (Sunday → next Monday). */
export function nextDay(dateKey: string): { dateKey: string; dayIndex: number } | null {
  const d = parseDateKey(dateKey);
  if (!d) return null;
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 12);
  return { dateKey: localDateKey(next), dayIndex: mondayDayIndex(next) };
}

export type MoveToTomorrowPlan = {
  session: SplitSessionKey;
  today: SplitDayEditInput;
  tomorrow: SplitDayEditInput;
};

/**
 * "No Push today — move it to tomorrow, and today is track."
 *
 * Two one-off edits: today becomes the member's pick (an activity or rest),
 * tomorrow becomes today's session. Tomorrow's own plan is replaced for that
 * date only. Returns null when today is not a lifting day, or when the pick is
 * not an activity or rest.
 */
export function planMoveToTomorrow(input: {
  day: { recovery: boolean; activity?: unknown; splitKey?: string | null; title?: string };
  todayKey: string;
  replacement: SplitDayEdit;
}): MoveToTomorrowPlan | null {
  const session = movableSessionKey(input.day);
  if (!session) return null;
  if (input.replacement.kind === "session" || !isValidSplitDayEdit(input.replacement)) return null;
  const today = parseDateKey(input.todayKey);
  const tomorrow = nextDay(input.todayKey);
  if (!today || !tomorrow) return null;
  return {
    session,
    today: { dayIndex: mondayDayIndex(today), dateKey: input.todayKey, scope: "once", edit: input.replacement },
    tomorrow: {
      dayIndex: tomorrow.dayIndex,
      dateKey: tomorrow.dateKey,
      scope: "once",
      edit: { kind: "session", session },
    },
  };
}

/* ─── Learning ────────────────────────────────────────────────────────── */

export type RecurringEditSuggestion = {
  dayIndex: number;
  edit: SplitDayEdit;
  /** Distinct weeks the member made this same change. */
  weeks: number;
  windowWeeks: number;
};

/**
 * Suggest turning a repeated one-off change into a weekly one.
 *
 * Only the member's FINAL decision for each date counts — if they switched
 * Friday to Legs and then took it back, that Friday is not evidence.
 */
export function suggestRecurringEdits(
  customization: SplitCustomization | null | undefined,
  now: Date = new Date(),
  windowWeeks = 4,
): RecurringEditSuggestion[] {
  const history = customization?.history ?? [];
  if (history.length === 0) return [];

  const windowStart = mondayOf(now).getTime() - (windowWeeks - 1) * 7 * DAY_MS;
  const windowEnd = mondayOf(now).getTime() + 7 * DAY_MS;

  // Last one-off decision per date wins.
  const finalByDate = new Map<string, SplitEditHistoryEntry>();
  for (const entry of history) {
    if (entry.scope !== "once") continue;
    finalByDate.set(entry.date, entry);
  }

  const groups = new Map<string, { dayIndex: number; edit: SplitDayEdit; weeks: Set<string> }>();
  for (const entry of finalByDate.values()) {
    if (!entry.edit || !isValidSplitDayEdit(entry.edit)) continue;
    const date = parseDateKey(entry.date);
    if (!date) continue;
    const t = date.getTime();
    if (t < windowStart || t >= windowEnd) continue;

    // Derive the weekday from the date itself rather than trusting the entry.
    const dayIndex = mondayDayIndex(date);
    const groupKey = `${dayIndex}|${editSignature(entry.edit)}`;
    const group = groups.get(groupKey) ?? { dayIndex, edit: entry.edit, weeks: new Set<string>() };
    group.weeks.add(localDateKey(mondayOf(date)));
    groups.set(groupKey, group);
  }

  const bestPerDay = new Map<number, RecurringEditSuggestion>();
  for (const g of groups.values()) {
    if (g.weeks.size < 2) continue;
    // Already the weekly rule — nothing to suggest.
    if (sameSplitDayEdit(customization?.weekly?.[String(g.dayIndex)], g.edit)) continue;
    const suggestion: RecurringEditSuggestion = {
      dayIndex: g.dayIndex,
      edit: g.edit,
      weeks: g.weeks.size,
      windowWeeks,
    };
    const existing = bestPerDay.get(g.dayIndex);
    if (!existing || suggestion.weeks > existing.weeks) bestPerDay.set(g.dayIndex, suggestion);
  }

  return [...bestPerDay.values()].sort((a, b) => b.weeks - a.weeks || a.dayIndex - b.dayIndex);
}

/** Re-exported so UI can offer the full activity list from one import. */
export { SPLIT_ACTIVITIES };
