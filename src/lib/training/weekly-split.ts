/* ════════════════════════════════════════════════════════════════════════
   RESERVE WEEKLY SPLIT — single source of truth for the 7-day training week.

   Both Training Command (WEEK_SPLIT) and Apex Command (7-Day Split Command /
   Split Command / today's session identity) read from RESERVE_WEEK_SPLIT so the
   two surfaces can never drift on day → session naming.

   The week is the canonical Reserve Method split (not a user-entered calendar),
   so anything derived from it is honestly a *projected* week from the active
   split. Focus / duration / advanced output are enriched from the live workout
   templates, so advanced protocols stay accurate.

   Pure data + deterministic helpers — no medical, dosing, or supplement copy.
   ════════════════════════════════════════════════════════════════════════ */

import {
  type IntensityTier,
  type SplitKey,
  type WorkoutTemplate,
  ARCHETYPE_TO_SPLIT,
  WORKOUT_TEMPLATES,
  applyProtocolIntensity,
  getTemplateForArchetype,
  getWorkoutTemplateForSplit,
  isRecoverySplit,
  resolveSplitKey,
  splitDayLabel,
} from "./workout-templates";
import {
  resolveWeeklyBlueprint,
  type BlueprintResolveInput,
  type SessionArchetype,
  type SessionIntent,
} from "./split-blueprints";

/** Canonical week row. dayIndex 0=Mon … 6=Sun; splitDay 1=Mon … 7=Sun (template convention). */
export type WeekRow = {
  dayIndex: number;
  splitDay: number;
  day: string;
  dayLong: string;
  title: string;
  reserve: string;
  goal: string;
  reason: string;
  protect: string;
};

/* The canonical week is Push → Pull → Legs → Arms → Upper → Lower with a
   Sunday rest. It used to open on "Chest / Back A" and return to
   "Chest / Back B" on Thursday, which is why every surface that fell back to it
   showed the same chest/back days. */
export const RESERVE_WEEK_SPLIT: WeekRow[] = [
  {
    dayIndex: 0, splitDay: 1, day: "Mon", dayLong: "Monday", title: "Push",
    reserve: "Strength Reserve",
    goal: "Chest, shoulders and triceps",
    reason: "Pressing leads the rotation while the reserve is full.",
    protect: "Keep pressing volume clean — Pull comes next.",
  },
  {
    dayIndex: 1, splitDay: 2, day: "Tue", dayLong: "Tuesday", title: "Pull",
    reserve: "Growth Reserve",
    goal: "Back, biceps, forearms and traps",
    reason: "Complete pulling with the pressing muscles recovering.",
    protect: "Refuel after the session — Legs comes next.",
  },
  {
    dayIndex: 2, splitDay: 3, day: "Wed", dayLong: "Wednesday", title: "Legs",
    reserve: "Performance Reserve",
    goal: "Legs — front, posterior or complete",
    reason: "Lower body takes its own day at full quality.",
    protect: "Hydrate and refuel — Arm Day comes next.",
  },
  {
    dayIndex: 3, splitDay: 4, day: "Thu", dayLong: "Thursday", title: "Arm Day",
    reserve: "Discipline Reserve",
    goal: "Biceps, triceps and forearms",
    reason: "Arms get a full day rather than leftovers after pressing.",
    protect: "Controlled volume, no junk sets — Upper comes next.",
  },
  {
    dayIndex: 4, splitDay: 5, day: "Fri", dayLong: "Friday", title: "Upper",
    reserve: "Performance Reserve",
    goal: "Upper composite — second exposure",
    reason: "Every upper pattern again, in one dense session.",
    protect: "Keep elbows and shoulders fresh — Lower comes next.",
  },
  {
    dayIndex: 5, splitDay: 6, day: "Sat", dayLong: "Saturday", title: "Lower",
    reserve: "Strength Reserve",
    goal: "Lower composite — second exposure",
    reason: "A second lower exposure balances the Legs session.",
    protect: "Wind down tonight — recovery comes next.",
  },
  {
    dayIndex: 6, splitDay: 7, day: "Sun", dayLong: "Sunday", title: "Recovery",
    reserve: "Recovery Reserve",
    goal: "Restore output · mobility",
    reason: "Recovery day. Restore the reserve before the next rotation.",
    protect: "Light mobility and clean nutrition prepare the next Push.",
  },
];

/* ─── Apex display layer ──────────────────────────────────────────────────── */

/** "none" is a day with no session to do: no program, nothing to complete or miss. */
export type TrainingDayStatus = "today" | "complete" | "upcoming" | "missed" | "none";
export type TrainingDayIntensity = "high" | "moderate" | "recovery";

export type TrainingWeekDay = {
  dayIndex: number;
  splitDay: number;
  day: string;
  sessionName: string;
  focus: string;
  durationMin: number | null;
  recovery: boolean;
  isToday: boolean;
  status: TrainingDayStatus;
  intensity: TrainingDayIntensity;
  advanced: boolean;
  /** Target muscles from the live template (empty on recovery days). */
  muscles: string[];
  /** Session intent line from the template, when available. */
  intent: string | null;
  /** The day's support protocol (cardio / abs / sauna / mobility / posing). */
  protocol: DayProtocol;
  /** Non-lifting day (track, run, class) — see split-activities. Typed inline
      so this display layer does not import the customization module. */
  activity?: {
    key: string;
    label: string;
    load: "low" | "moderate" | "high";
    startTime?: string;
    durationMinutes?: number;
    /** The member's own distance goal, e.g. { value: 3, unit: "mi" }. */
    distance?: { value: number; unit: "mi" | "km" };
  };
  /** Engine template key (push, pull, legs…) — lets the day be moved. */
  splitKey?: string | null;
  /** Present when the member changed this day themselves. */
  memberEdit?: { scope: "once" | "weekly"; kind: "session" | "activity" | "rest" };
};

/* ─── Session protocol — the support stack around the lift ────────────────
   What a session expects beyond the working sets: cardio, abs, sauna,
   mobility, and the recovery handoff. It follows the SESSION, not the
   weekday — a split can put Push on any day and a member chooses their own
   rest day — so Push and Pull always finish with abs, cardio and an optional
   sauna, while Legs, Lower, Upper and Arms end with a cooldown and mobility.
   Training structure only — no medical, dosing, or supplement content. */
export type DayProtocol = {
  splitDay: number;
  /** Conditioning assignment, e.g. "Zone 2 · 20–30 min". */
  cardio: string;
  /** Ab / core assignment, or null when the day keeps core minimal. */
  abs: string | null;
  /** Sauna option when the day supports it (always conditional on hydration). */
  sauna: string | null;
  mobility: string;
  /** Posing work when assigned. */
  posing: string | null;
  /** What nutrition leans into on this day. */
  nutritionFocus: string;
  /** What recovery must protect after this session. */
  recoveryNote: string;
  /** One-line "after session" stack preview. */
  afterSession: string;
};

export type SessionProtocolInput = {
  splitDay: number;
  title?: string | null;
  displayTitle?: string | null;
  splitKey?: string | null;
  archetype?: string | null;
  recovery?: boolean;
  activity?: unknown;
};

type SessionFamily = "push" | "pull" | "lower" | "upper" | "full-body" | "conditioning" | "activity" | "recovery";

const LOWER_KEYS = new Set(["legs", "lower", "lower-posterior"]);
const CONDITIONING_ARCHETYPES = new Set([
  "conditioning", "sport-conditioning", "zone2", "outdoor-distance", "core", "waistline", "pilates", "yoga", "mobility",
]);

function familyFor(session: SessionProtocolInput): SessionFamily {
  const archetypeKey = session.archetype
    ? (ARCHETYPE_TO_SPLIT as Record<string, string | null | undefined>)[session.archetype] ?? null
    : null;
  const titleKey = resolveSplitKey(session.displayTitle ?? session.title ?? null);
  if (session.recovery || session.splitKey === "recovery" || (!session.splitKey && !archetypeKey && titleKey === "recovery")) {
    return "recovery";
  }
  if (session.activity) return "activity";
  if (session.archetype && CONDITIONING_ARCHETYPES.has(session.archetype)) return "conditioning";
  const keys = [session.splitKey ?? null, archetypeKey, titleKey];
  if (keys.includes("push")) return "push";
  if (keys.includes("pull")) return "pull";
  if (keys.some((k) => k !== null && LOWER_KEYS.has(k))) return "lower";
  if (keys.includes("full-body")) return "full-body";
  return "upper";
}

export function getSessionProtocol(
  session: SessionProtocolInput,
  next?: { title?: string | null; displayTitle?: string | null; sessionName?: string | null } | null,
): DayProtocol {
  const nextName = next ? next.displayTitle ?? next.sessionName ?? next.title ?? null : null;
  const handoff = (lead: string) => (nextName ? `${lead} — ${nextName} is next.` : `${lead}.`);
  const family = familyFor(session);
  const splitDay = session.splitDay;

  switch (family) {
    case "push":
    case "pull":
      return {
        splitDay,
        cardio: "Incline walk or Zone 2 · 15–20 min",
        abs: "8–10 min",
        sauna: "15 min · optional, if hydrated",
        mobility: family === "push" ? "T-spine + shoulders · 5 min" : "Lats + T-spine · 5 min",
        posing: null,
        nutritionFocus: "Protein anchor early · refuel after the session",
        recoveryNote: handoff("Keep today's volume clean"),
        afterSession: "Abs 8–10 min · incline walk 15–20 min · optional sauna 15 min if hydrated",
      };
    case "lower":
      return {
        splitDay,
        cardio: "Recovery walk · 8–10 min",
        abs: null,
        sauna: null,
        mobility: "Hips + ankles · 6 min",
        posing: null,
        nutritionFocus: "Highest-output day · carbs up, hydrate well",
        recoveryNote: handoff("Hydrate and refuel"),
        afterSession: "Recovery walk 8–10 min · hip mobility 6 min",
      };
    case "full-body":
      return {
        splitDay,
        cardio: "Cooldown walk · 10 min",
        abs: null,
        sauna: null,
        mobility: "Hips + shoulders · 6 min",
        posing: null,
        nutritionFocus: "Protein on pace · refuel after the session",
        recoveryNote: handoff("Controlled volume, no junk sets"),
        afterSession: "Cooldown walk 10 min · mobility 6 min",
      };
    case "conditioning":
    case "activity":
      return {
        splitDay,
        cardio: family === "activity" ? "The activity is the conditioning" : "The session is the conditioning",
        abs: null,
        sauna: null,
        mobility: "Hips + T-spine · 6 min",
        posing: null,
        nutritionFocus: "Fuel the session · hydrate",
        recoveryNote: handoff("Keep the effort controlled"),
        afterSession: "Mobility 6 min · hydrate",
      };
    case "recovery":
      return {
        splitDay,
        cardio: "Recovery walk · 20–30 min",
        abs: null,
        sauna: "15 min · optional, if hydrated",
        mobility: "Full-body flow · 15 min",
        posing: null,
        nutritionFocus: "Moderate recovery carbs · clean dinner",
        recoveryNote: nextName ? `Restore the reserve for ${nextName}.` : "Restore the reserve for the next session.",
        afterSession: "Walk 20–30 min · mobility flow 15 min · optional sauna if hydrated",
      };
    case "upper":
    default:
      return {
        splitDay,
        cardio: "Cooldown walk · 10 min",
        abs: null,
        sauna: null,
        mobility: "Shoulders + T-spine · 5 min",
        posing: null,
        nutritionFocus: "Protein on pace · refuel after the session",
        recoveryNote: handoff("Controlled volume, no junk sets"),
        afterSession: "Cooldown walk 10 min · shoulder mobility 5 min",
      };
  }
}

const ADVANCED_TIERS: ReadonlySet<IntensityTier> = new Set<IntensityTier>(["advanced", "specialization", "championship"]);

/** Today's split-day index, 1=Mon … 7=Sun (matches splitDayLabel). */
export function getTodaySplitDay(now: Date = new Date()): number {
  const d = now.getDay();
  return d === 0 ? 7 : d;
}

export function getTrainingDayStatus(splitDay: number, todaySplitDay: number): TrainingDayStatus {
  if (splitDay === todaySplitDay) return "today";
  return splitDay < todaySplitDay ? "complete" : "upcoming";
}

/** Honest day status from real completed-session records: a past training day
    is COMPLETE only when a session record exists for it, otherwise MISSED.
    Recovery days never read as missed. Falls back to the calendar-only status
    when no record set is supplied (legacy behaviour). */
export function getTrainingDayStatusWithRecords(
  splitDay: number,
  todaySplitDay: number,
  completedSplitDays: ReadonlySet<number> | null | undefined,
  recovery: boolean,
): TrainingDayStatus {
  if (!completedSplitDays) return getTrainingDayStatus(splitDay, todaySplitDay);
  if (completedSplitDays.has(splitDay)) return "complete";
  if (splitDay === todaySplitDay) return "today";
  if (splitDay > todaySplitDay) return "upcoming";
  return recovery ? "complete" : "missed";
}

/** Explicit no-program rail. This is deliberately not a projected split:
    consumers use it only when no executable Horizon or member-authored
    program exists. */
export function buildExplicitFallbackWeek(now: Date = new Date()): TrainingWeekDay[] {
  const todaySplitDay = getTodaySplitDay(now);
  return RESERVE_WEEK_SPLIT.map((row) => ({
    dayIndex: row.dayIndex,
    splitDay: row.splitDay,
    day: row.day,
    /* Factual, not an alarm. See buildExplicitFallbackResolvedWeek in
       daily-context.ts — the deficiency is surfaced once at screen level, not
       repeated as the name of all seven days. */
    sessionName: "No session",
    focus: "Awaiting program",
    durationMin: null,
    recovery: true,
    isToday: row.splitDay === todaySplitDay,
    /* Nothing was planned, so nothing can be done or missed: a past day here
       used to read "Done", telling a member without a program that they had
       completed a session that never existed. */
    status: row.splitDay === todaySplitDay ? "today" : "none",
    intensity: "recovery",
    advanced: false,
    muscles: [],
    intent: null,
    /* No session means no support stack either — sauna and cardio belong to a
       session the member does not have yet. */
    protocol: {
      splitDay: row.splitDay,
      cardio: "",
      abs: null,
      sauna: null,
      mobility: "",
      posing: null,
      nutritionFocus: "Normal intake until a plan is set.",
      recoveryNote: "Nothing to recover from yet.",
      afterSession: "",
    },
  }));
}

/** The (intensity-adjusted) template for today's split, or null on a recovery day. */
export function getTodayTemplate(tier: IntensityTier, now: Date = new Date()): WorkoutTemplate | null {
  const sd = getTodaySplitDay(now);
  const label = splitDayLabel(sd);
  if (isRecoverySplit(label) || sd === 7) return null;
  const base = getWorkoutTemplateForSplit(label);
  return base ? (tier !== "standard" ? applyProtocolIntensity(base, tier) : base) : null;
}

/** The (intensity-adjusted) workout for a resolved day — the day the member
    actually trains, wherever the split put it. Null on a rest or activity day. */
export function getTemplateForDay(
  day: { recovery: boolean; activity?: unknown; archetype?: string | null; splitKey?: string | null },
  tier: IntensityTier,
): WorkoutTemplate | null {
  if (day.recovery || day.activity) return null;
  const base = day.archetype
    ? getTemplateForArchetype(day.archetype as SessionArchetype)
    : day.splitKey && day.splitKey !== "recovery"
      ? WORKOUT_TEMPLATES[day.splitKey as SplitKey] ?? null
      : null;
  return base ? (tier !== "standard" ? applyProtocolIntensity(base, tier) : base) : null;
}

/**
 * Build the 7-day plan for display. Session names come from the canonical
 * RESERVE_WEEK_SPLIT titles (so Apex and Training match); focus / duration /
 * advanced come from the live templates for accuracy.
 */
export function getTrainingWeekPlan(opts: { tier?: IntensityTier; now?: Date; completedSplitDays?: ReadonlySet<number> | null } = {}): TrainingWeekDay[] {
  const tier = opts.tier ?? "standard";
  const todaySplitDay = getTodaySplitDay(opts.now ?? new Date());
  const advanced = ADVANCED_TIERS.has(tier);
  return RESERVE_WEEK_SPLIT.map((row, i, rows) => {
    const label = splitDayLabel(row.splitDay);
    const recovery = isRecoverySplit(label) || row.splitDay === 7;
    const base = getWorkoutTemplateForSplit(label);
    const tpl = base ? (tier !== "standard" ? applyProtocolIntensity(base, tier) : base) : null;
    const isToday = row.splitDay === todaySplitDay;
    return {
      dayIndex: row.dayIndex,
      splitDay: row.splitDay,
      day: row.day,
      sessionName: row.title,
      focus: recovery ? "Recovery Reserve · mobility" : tpl?.focus ?? row.goal ?? "Training output",
      durationMin: recovery ? null : tpl?.estimatedDurationMin ?? null,
      recovery,
      isToday,
      status: getTrainingDayStatusWithRecords(row.splitDay, todaySplitDay, opts.completedSplitDays, recovery),
      intensity: recovery ? "recovery" : advanced ? "high" : "moderate",
      advanced: advanced && !recovery,
      muscles: recovery ? [] : tpl?.targetMuscles ?? [],
      intent: recovery ? null : tpl?.sessionIntent ?? null,
      protocol: getSessionProtocol({ splitDay: row.splitDay, title: row.title, recovery }, rows[(i + 1) % rows.length]),
    };
  });
}

/* ════════════════════════════════════════════════════════════════════════
   PROTOCOL ARCHITECTURE 2.0 — protocol-driven weekly plan.
   Builds the 7-day plan from the active protocol's blueprint (adapted to the
   member) instead of the single canonical skeleton. Falls back to the legacy
   RESERVE_WEEK_SPLIT plan when no protocol/blueprint context is supplied.
   ════════════════════════════════════════════════════════════════════════ */

const DAY_ABBR = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const LOW_IMPACT_ARCHETYPES = new Set(["pilates", "yoga", "mobility", "zone2"]);

function defaultDurationForIntent(intent: SessionIntent): number | null {
  switch (intent) {
    case "strength": return 60;
    case "hypertrophy": return 55;
    case "power": return 55;
    case "tone": return 45;
    case "sport": return 50;
    case "conditioning": return 35;
    case "mobility": return 35;
    default: return null;
  }
}

export function buildProtocolWeek(
  opts: { tier?: IntensityTier; now?: Date; resolve?: BlueprintResolveInput; completedSplitDays?: ReadonlySet<number> | null } = {},
): TrainingWeekDay[] {
  // No protocol AND no profile → preserve the exact legacy behaviour. When a
  // fallback profile is present, fall through to resolveWeeklyBlueprint so the
  // member's profile selects a differentiated architecture.
  if (!opts.resolve || (!opts.resolve.protocolId && !opts.resolve.category && !opts.resolve.profileForFallback)) {
    return getTrainingWeekPlan({ tier: opts.tier, now: opts.now, completedSplitDays: opts.completedSplitDays });
  }

  const tier = opts.tier ?? "standard";
  const todaySplitDay = getTodaySplitDay(opts.now ?? new Date());
  const advanced = ADVANCED_TIERS.has(tier);
  const { week } = resolveWeeklyBlueprint(opts.resolve);

  return week.map((d, i) => {
    const splitDay = i + 1;
    const recovery = Boolean(d.recovery) || d.archetype === "recovery";
    const lowImpact = LOW_IMPACT_ARCHETYPES.has(d.archetype);
    const base = recovery ? null : getTemplateForArchetype(d.archetype);
    const tpl = base ? (tier !== "standard" ? applyProtocolIntensity(base, tier) : base) : null;
    const isToday = splitDay === todaySplitDay;
    return {
      dayIndex: i,
      splitDay,
      day: DAY_ABBR[i],
      sessionName: d.title,
      focus: recovery
        ? "Recovery Reserve · mobility"
        : tpl?.focus ?? (d.emphasis.length ? d.emphasis.join(" · ") : d.title),
      durationMin: recovery ? null : tpl?.estimatedDurationMin ?? defaultDurationForIntent(d.intent),
      recovery,
      isToday,
      status: getTrainingDayStatusWithRecords(splitDay, todaySplitDay, opts.completedSplitDays, recovery),
      intensity: recovery || lowImpact ? "recovery" : advanced ? "high" : "moderate",
      advanced: advanced && !recovery && !lowImpact,
      muscles: recovery ? [] : d.emphasis.length ? d.emphasis : tpl?.targetMuscles ?? [],
      intent: recovery ? null : tpl?.sessionIntent ?? d.title,
      protocol: getSessionProtocol({ splitDay, title: d.title, archetype: d.archetype, recovery }, week[(i + 1) % week.length]),
    };
  });
}

export function getTodayTrainingWeekDay(plan: TrainingWeekDay[]): TrainingWeekDay {
  return plan.find((d) => d.isToday) ?? plan[0];
}

export function getNextTrainingWeekDay(plan: TrainingWeekDay[]): TrainingWeekDay {
  const i = plan.findIndex((d) => d.isToday);
  return plan[(i >= 0 ? i + 1 : 1) % plan.length];
}
