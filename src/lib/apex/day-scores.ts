/* ════════════════════════════════════════════════════════════════════════
   TODAY'S SCORES — the Apex instrument, as pure arithmetic.

   Three dials and one row of system states, each built only from what the
   member logged or from a derivation of it that says so:

     Readiness  the recovery engine's reserve (derived from logged sleep, water,
                mobility and check-ins; organisational, never a health reading)
     Sleep      last night's logged hours against the member's own target
     Fuel       protein from the meals logged today against today's planning
                estimate (est.), paced by the meals the day has already passed

   A dial with nothing to read is empty and says which log fills it. It never
   shows a placeholder number, and a zero is never drawn as a reading.

   The system row answers "how ready is everything?" in one word per system,
   with a green / amber / grey tone. Amber means "worth a look", never alarm:
   no state here is red.

   Pure: no React, no store, no DOM.
   ════════════════════════════════════════════════════════════════════════ */

export type ScoreTone = "ready" | "steady" | "attention" | "idle";

export type DayRingId = "readiness" | "sleep" | "fuel";

export type DayRingReading = {
  /** The number the dial prints, in the metric's own unit. */
  value: number;
  decimals: number;
  unit: string | null;
  /** How much of the dial is drawn, 0–1. */
  fraction: number;
};

export type DayRing = {
  id: DayRingId;
  label: string;
  provenance: "derived" | "logged" | "est.";
  /** Null: nothing to read. The dial is empty and `empty.prompt` names the log that fills it. */
  reading: DayRingReading | null;
  /** One state word ("Steady", "Met", "Behind", "No log"). */
  word: string;
  tone: ScoreTone;
  /** The dial is full — it earns one gold glint when it lands. */
  complete: boolean;
  empty: { prompt: string } | null;
  /** A qualifier printed with the label: "Mon" for a sleep log from yesterday. */
  qualifier: string | null;
  /** The control's accessible name. */
  ariaLabel: string;
};

export type SystemId = "training" | "fuel" | "recovery" | "sleep" | "hydration" | "schedule";
export type SystemTone = "ready" | "attention" | "idle";

export type SystemState = {
  id: SystemId;
  label: string;
  word: string;
  tone: SystemTone;
  /** Where the word comes from, for the title attribute. */
  source: string;
};

/* ─── Readiness ────────────────────────────────────────────────────────── */

/** Bible §05 thresholds, the same bands the Apex statement uses. */
export const READINESS_BANDS = { ready: 78, steady: 62 } as const;

export type ReadinessInput = {
  /** Enough kinds of log for a reserve (the engine's hasData). */
  hasData: boolean;
  /** Any recovery log at all. */
  hasLogs: boolean;
  reserve: number;
};

export function readinessRing(input: ReadinessInput): DayRing {
  if (!input.hasData) {
    const word = input.hasLogs ? "Limited" : "No log";
    return {
      id: "readiness",
      label: "Readiness",
      provenance: "derived",
      reading: null,
      word,
      tone: "idle",
      complete: false,
      empty: { prompt: input.hasLogs ? "One more log" : "Check in" },
      qualifier: null,
      ariaLabel: `Readiness: evidence needed${input.hasLogs ? " — one more kind of recovery log" : ""}. Open what it is made of.`,
    };
  }
  const value = Math.round(Math.max(0, Math.min(100, input.reserve)));
  const band = value >= READINESS_BANDS.ready ? "ready" : value >= READINESS_BANDS.steady ? "steady" : "attention";
  const word = band === "ready" ? "Ready" : band === "steady" ? "Steady" : "Restore";
  return {
    id: "readiness",
    label: "Readiness",
    provenance: "derived",
    reading: { value, decimals: 0, unit: null, fraction: value / 100 },
    word,
    tone: band,
    complete: false,
    empty: null,
    qualifier: null,
    ariaLabel: `Readiness ${value}, ${word.toLowerCase()}. Derived from your recovery logs. Open what it is made of.`,
  };
}

/* ─── Sleep ────────────────────────────────────────────────────────────── */

export type SleepLogLike = { date: string; hours: number };

/** At or above this share of the member's target the night reads "Close". */
export const SLEEP_CLOSE_SHARE = 0.85;

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "2026-09-14" → "Mon", read as a calendar date (no time zone shift). */
export function weekdayOf(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return WEEKDAY[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

/** The calendar day before `dateKey`. */
export function previousDateKey(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const prev = new Date(Date.UTC(y, m - 1, d - 1));
  return `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, "0")}-${String(prev.getUTCDate()).padStart(2, "0")}`;
}

/**
 * The night the dial reads. A sleep log is dated the morning the member woke
 * (the sleep logger saves it under today), so today's log is last night.
 * Yesterday's log is still shown, named by its day; anything older is not a
 * read of the current day, and the dial is empty.
 */
export function latestNight(logs: readonly SleepLogLike[], today: string): { log: SleepLogLike; lastNight: boolean } | null {
  const byDate = new Map<string, SleepLogLike>();
  for (const log of logs) if (Number.isFinite(log.hours) && log.hours > 0) byDate.set(log.date, log);
  const tonight = byDate.get(today);
  if (tonight) return { log: tonight, lastNight: true };
  const before = byDate.get(previousDateKey(today));
  return before ? { log: before, lastNight: false } : null;
}

export function sleepRing(input: { logs: readonly SleepLogLike[]; targetHours: number; today: string }): DayRing {
  const night = latestNight(input.logs, input.today);
  if (!night || !(input.targetHours > 0)) {
    return {
      id: "sleep",
      label: "Sleep",
      provenance: "logged",
      reading: null,
      word: "No log",
      tone: "idle",
      complete: false,
      empty: { prompt: "Log sleep" },
      qualifier: null,
      ariaLabel: "Sleep: last night is not logged. Open what it is made of.",
    };
  }
  const hours = Math.round(night.log.hours * 10) / 10;
  const share = hours / input.targetHours;
  const met = share >= 1;
  const word = met ? "Met" : share >= SLEEP_CLOSE_SHARE ? "Close" : "Short";
  const qualifier = night.lastNight ? null : weekdayOf(night.log.date);
  return {
    id: "sleep",
    label: "Sleep",
    provenance: "logged",
    reading: { value: hours, decimals: 1, unit: "h", fraction: Math.min(1, share) },
    word,
    tone: met ? "ready" : share >= SLEEP_CLOSE_SHARE ? "steady" : "attention",
    complete: met,
    empty: null,
    qualifier,
    ariaLabel: `Sleep ${hours.toFixed(1)} hours${qualifier ? `, logged ${qualifier}` : ", last night"}, against your ${input.targetHours} hour target: ${word.toLowerCase()}. Open what it is made of.`,
  };
}

/* ─── Fuel ─────────────────────────────────────────────────────────────── */

export type FuelMealState = "logged" | "past-due" | "due" | "upcoming";

export type FuelInput = {
  /** Today's planned meals, each with its logged / timing state. */
  meals: ReadonlyArray<{ id: string; state: FuelMealState }>;
  /** Estimated protein from the meals logged today (grams). */
  loggedProteinG: number;
  /** Today's planning estimate (grams). */
  proteinTargetG: number;
};

export type FuelPace = { word: string; tone: SystemTone };

/** The day's pace from logs, not from grams: every planned meal logged, a passed meal not logged, or on pace. */
export function fuelPace(input: Pick<FuelInput, "meals">): FuelPace {
  const { meals } = input;
  if (meals.length === 0) return { word: "No plan", tone: "idle" };
  if (meals.every((meal) => meal.state === "logged")) return { word: "Complete", tone: "ready" };
  if (meals.some((meal) => meal.state === "past-due")) return { word: "Behind", tone: "attention" };
  if (!meals.some((meal) => meal.state === "logged")) return { word: "No log", tone: "idle" };
  return { word: "On pace", tone: "ready" };
}

export function fuelRing(input: FuelInput): DayRing {
  const pace = fuelPace(input);
  const logged = input.meals.filter((meal) => meal.state === "logged").length;
  if (input.meals.length === 0 || logged === 0 || !(input.proteinTargetG > 0)) {
    return {
      id: "fuel",
      label: "Fuel",
      provenance: "est.",
      reading: null,
      word: pace.word,
      tone: pace.tone === "attention" ? "attention" : "idle",
      complete: false,
      empty: { prompt: input.meals.length === 0 ? "Map meals" : "Log meal" },
      qualifier: null,
      ariaLabel: input.meals.length === 0
        ? "Fuel: no meal windows are mapped. Open what it is made of."
        : `Fuel: no meal logged today${pace.word === "Behind" ? ", a planned meal has passed" : ""}. Open what it is made of.`,
    };
  }
  const grams = Math.max(0, Math.round(input.loggedProteinG));
  const share = grams / input.proteinTargetG;
  const fraction = Math.min(1, share);
  /* Full only when the grams say so: a logged day short of the estimate is never drawn full. */
  const complete = fraction >= 1;
  return {
    id: "fuel",
    label: "Fuel",
    provenance: "est.",
    reading: { value: grams, decimals: 0, unit: "g", fraction },
    word: pace.word,
    tone: pace.tone,
    complete,
    empty: null,
    qualifier: null,
    ariaLabel: `Fuel, estimated: ${grams} of ${input.proteinTargetG} grams of protein from ${logged} of ${input.meals.length} meals logged: ${pace.word.toLowerCase()}. Open what it is made of.`,
  };
}

/* ─── Systems ──────────────────────────────────────────────────────────── */

export type SessionState = "rest" | "off" | "staged" | "due" | "live" | "done" | "past-due";

export function trainingState(session: SessionState): SystemState {
  const map: Record<SessionState, [string, SystemTone]> = {
    rest: ["Rest", "idle"],
    off: ["Off", "idle"],
    staged: ["Staged", "ready"],
    due: ["Due now", "ready"],
    live: ["Live", "ready"],
    done: ["Done", "ready"],
    "past-due": ["Past due", "attention"],
  };
  const [word, tone] = map[session];
  return { id: "training", label: "Training", word, tone, source: "Today's session on your split." };
}

export function recoveryState(input: { hasData: boolean; debt: "clear" | "building" | "accumulating" }): SystemState {
  if (!input.hasData) return { id: "recovery", label: "Recovery", word: "No data", tone: "idle", source: "Recovery debt needs two kinds of recovery log." };
  const word = input.debt === "clear" ? "Clear" : input.debt === "building" ? "Building" : "Debt";
  return { id: "recovery", label: "Recovery", word, tone: input.debt === "clear" ? "ready" : "attention", source: "Recovery debt, derived from your logged sleep, water, mobility and check-ins." };
}

export function hydrationState(input: { todayOz: number; targetOz: number }): SystemState {
  const source = "Water logged today against your target.";
  if (!(input.todayOz > 0) || !(input.targetOz > 0)) return { id: "hydration", label: "Hydration", word: "No log", tone: "idle", source };
  if (input.todayOz >= input.targetOz) return { id: "hydration", label: "Hydration", word: "Met", tone: "ready", source };
  if (input.todayOz >= input.targetOz * 0.85) return { id: "hydration", label: "Hydration", word: "On target", tone: "ready", source };
  return { id: "hydration", label: "Hydration", word: "Behind", tone: "attention", source };
}

export function scheduleState(input: { sleepCompression: boolean }): SystemState {
  return input.sleepCompression
    ? { id: "schedule", label: "Schedule", word: "Tight", tone: "attention", source: "Training ends close to your sleep target." }
    : { id: "schedule", label: "Schedule", word: "Clear", tone: "ready", source: "No conflict between training and your sleep target." };
}

const ringSystemTone = (tone: ScoreTone): SystemTone => (tone === "idle" ? "idle" : tone === "attention" ? "attention" : "ready");

export type DayScoresInput = {
  readiness: ReadinessInput;
  sleep: { logs: readonly SleepLogLike[]; targetHours: number; today: string };
  fuel: FuelInput;
  session: SessionState;
  recovery: { hasData: boolean; debt: "clear" | "building" | "accumulating" };
  hydration: { todayOz: number; targetOz: number };
  schedule: { sleepCompression: boolean };
};

export type DayScores = { rings: DayRing[]; systems: SystemState[] };

export function buildDayScores(input: DayScoresInput): DayScores {
  const readiness = readinessRing(input.readiness);
  const sleep = sleepRing(input.sleep);
  const fuel = fuelRing(input.fuel);
  return {
    rings: [readiness, sleep, fuel],
    systems: [
      trainingState(input.session),
      { id: "fuel", label: "Fuel", word: fuel.word, tone: ringSystemTone(fuel.tone), source: "Meals logged today against today's plan." },
      recoveryState(input.recovery),
      { id: "sleep", label: "Sleep", word: sleep.word, tone: ringSystemTone(sleep.tone), source: "Last night's logged sleep against your target." },
      hydrationState(input.hydration),
      scheduleState(input.schedule),
    ],
  };
}

/* ─── Readiness, broken down (the dial's sheet) ────────────────────────── */

/** The recovery engine's reserve weights (src/lib/recovery/engine.ts). */
export type ReserveInputKind = "sleep" | "water" | "mobility" | "check-in";

export type ReadinessPart = {
  kind: ReserveInputKind;
  label: string;
  /** Plain reading from the member's logs, or null when that input is not logged. */
  reading: string | null;
  /** This input's share of today's readiness, re-weighted over what was logged (0–100), or null. */
  sharePct: number | null;
};

export function readinessParts(input: {
  weights: Record<ReserveInputKind, number>;
  logged: readonly ReserveInputKind[];
  sleepAvg7: number;
  sleepTargetHours: number;
  hydrationAdherence: number;
  mobilityThisWeek: number;
  mobilityWeeklyTarget: number;
  stressLoadLabel: string;
}): ReadinessPart[] {
  const kinds: ReserveInputKind[] = ["sleep", "water", "mobility", "check-in"];
  const total = kinds.filter((k) => input.logged.includes(k)).reduce((sum, k) => sum + input.weights[k], 0);
  const share = (k: ReserveInputKind) => (input.logged.includes(k) && total > 0 ? Math.round((input.weights[k] / total) * 100) : null);
  const on = (k: ReserveInputKind) => input.logged.includes(k);
  const sleepPct = input.sleepTargetHours > 0 ? Math.round(Math.min(100, (input.sleepAvg7 / input.sleepTargetHours) * 100)) : null;
  return [
    {
      kind: "sleep",
      label: "Sleep",
      reading: on("sleep") ? `${input.sleepAvg7.toFixed(1)} h average, 7 nights${sleepPct !== null ? ` · ${sleepPct}% of your ${input.sleepTargetHours} h target` : ""}` : null,
      sharePct: share("sleep"),
    },
    { kind: "water", label: "Water", reading: on("water") ? `${input.hydrationAdherence}% of your target, 7 days` : null, sharePct: share("water") },
    {
      kind: "mobility",
      label: "Mobility",
      reading: on("mobility") ? `${input.mobilityThisWeek} of ${input.mobilityWeeklyTarget} sessions this week` : null,
      sharePct: share("mobility"),
    },
    { kind: "check-in", label: "Check-ins", reading: on("check-in") ? `Stress load · ${input.stressLoadLabel}` : null, sharePct: share("check-in") },
  ];
}
