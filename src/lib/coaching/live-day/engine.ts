/* ════════════════════════════════════════════════════════════════════════
   RESERVE LIVE DAY ENGINE — deterministic day recalculation.

   Pure functions: same input, same output, every rule explainable. The
   engine adapts scheduling and training logistics ONLY — it never gives
   medical guidance, never touches medication, and flags impossible
   recovery windows instead of pretending they are optimal.
   ════════════════════════════════════════════════════════════════════════ */

import { minutesToTime, newId, nowIso, timeToMinutes } from "../ids";
import type {
  DayPlanVersion,
  DayTimelineEntry,
  LiveDayReason,
} from "../types";

/* ─── Inputs / outputs ────────────────────────────────────────────────── */

export type AdaptedDayInput = {
  original: DayPlanVersion;
  /** Current clock time "HH:MM" — nothing is ever scheduled before this. */
  nowTime: string;
  reason: LiveDayReason;
  actualWakeTime?: string;
  /** New training time; null explicitly removes today's session. */
  newTrainingTime?: string | null;
  /** Entry ids the athlete has already completed (meals eaten, etc.). */
  completedEntryIds?: string[];
  energyLevel?: "low" | "ok" | "good";
  bedtimeFixed?: boolean;
  /** Coach rule / athlete preference: keep session demand untouched. */
  keepDemand?: boolean;
  sessionDurationMinutes?: number;
  createdBy: "athlete" | "coach" | "reserve";
  customNote?: string;
};

export type DayDiffRow = {
  label: string;
  from: string;
  to: string;
  kind: "time" | "demand" | "removed" | "added" | "text";
};

export type AdaptedDayResult = {
  proposed: DayPlanVersion;
  explanation: string[];
  impactSummary: string[];
  warnings: string[];
  tomorrowImpact: string[];
  changes: DayDiffRow[];
};

const DEMAND_ORDER = ["recovery", "standard", "high", "elite"] as const;
type Demand = (typeof DEMAND_ORDER)[number];

const SESSION_DEFAULT_MINUTES = 75;
const PRE_TRAINING_MEAL_LEAD = 95; // minutes before session
const POST_TRAINING_MEAL_LAG = 50; // minutes after session ends
const MIN_MEAL_SPACING = 110;
const BED_MEAL_BUFFER = 60;
const BED_TRAINING_BUFFER = 150; // training ending inside this window compresses recovery
const MAX_BED_PUSH = 60;

function stepDemandDown(demand: Demand): Demand {
  const i = DEMAND_ORDER.indexOf(demand);
  return DEMAND_ORDER[Math.max(0, i - 1)];
}

/* ─── The calculation ─────────────────────────────────────────────────── */

export function buildAdaptedDay(input: AdaptedDayInput): AdaptedDayResult {
  const { original } = input;
  const explanation: string[] = [];
  const warnings: string[] = [];
  const tomorrowImpact: string[] = [];
  const completed = new Set(input.completedEntryIds ?? []);
  const now = timeToMinutes(input.nowTime);
  const sessionMinutes = input.sessionDurationMinutes ?? SESSION_DEFAULT_MINUTES;

  const wake = input.actualWakeTime ?? original.wakeTime;
  const wakeMin = timeToMinutes(wake);
  const originalWakeMin = timeToMinutes(original.wakeTime);
  const wakeDelayMin = wakeMin - originalWakeMin;

  /* Training placement. undefined = keep original; null = session removed. */
  const trainingRemoved = input.newTrainingTime === null;
  const trainingTime = trainingRemoved
    ? null
    : input.newTrainingTime ?? original.trainingTime;
  const trainingMin = trainingTime ? timeToMinutes(trainingTime) : null;
  const trainingEndMin = trainingMin !== null ? trainingMin + sessionMinutes : null;

  /* Bedtime. Push only when the evening is genuinely compressed and the
     athlete said bedtime is flexible — capped, never silently unbounded. */
  let bedMin = timeToMinutes(original.bedTime);
  if (trainingEndMin !== null && trainingEndMin + BED_TRAINING_BUFFER > bedMin) {
    if (input.bedtimeFixed) {
      warnings.push(
        "Training ends close to your fixed bedtime — the recovery window tonight is compressed. Reserve is flagging this rather than pretending it is optimal.",
      );
    } else {
      const push = Math.min(MAX_BED_PUSH, trainingEndMin + BED_TRAINING_BUFFER - bedMin);
      bedMin += push;
      explanation.push(`Bedtime moved ${push} minutes later to protect a wind-down window after training.`);
      tomorrowImpact.push("Later bedtime tonight — expect tomorrow's wake or readiness to be affected.");
    }
  }
  if (wakeDelayMin >= 120) {
    tomorrowImpact.push("Tomorrow's plan is unchanged for now — review it in the morning rather than shifting it silently.");
  }

  /* Session demand suggestion — logistics-based, one step, explainable. */
  let demand = original.sessionDemand;
  if (!input.keepDemand && demand && !trainingRemoved) {
    const lowEnergy = input.energyLevel === "low";
    const shortNight = input.reason === "poor_sleep" || wakeDelayMin >= 150;
    const lateCompressed =
      trainingEndMin !== null && trainingEndMin + BED_TRAINING_BUFFER > timeToMinutes(original.bedTime);
    if ((lowEnergy || shortNight || input.reason === "low_readiness") && demand !== "recovery") {
      demand = stepDemandDown(demand as Demand);
      explanation.push(
        `Session demand suggested one step lower (${original.sessionDemand} → ${demand}) based on today's reported ${lowEnergy ? "energy" : "sleep disruption"} — the session itself is preserved.`,
      );
    } else if (lateCompressed && demand === "elite") {
      demand = "high";
      explanation.push(
        "Elite-demand output this late compresses tonight's recovery window — demand suggested at High with the session intent preserved.",
      );
    }
  }
  if (input.reason === "pain_observation") {
    warnings.push(
      "Pain observation logged. Reserve adjusts logistics only — avoid aggravating movements and review persistent pain with a clinician.",
    );
  }

  /* Rebuild the timeline. Completed entries are preserved verbatim. */
  const entries: DayTimelineEntry[] = [];
  const originalMeals = original.entries.filter((e) => e.kind === "meal");
  const completedMeals = originalMeals.filter((e) => completed.has(e.id));
  const remainingMeals = originalMeals.filter((e) => !completed.has(e.id));

  for (const entry of original.entries) {
    if (completed.has(entry.id)) {
      entries.push({ ...entry, completed: true });
      continue;
    }
    switch (entry.kind) {
      case "wake":
        entries.push({ ...entry, time: wake });
        break;
      case "bed":
        entries.push({ ...entry, time: minutesToTime(bedMin) });
        break;
      case "work":
        // Fixed obligations are respected, never moved.
        entries.push({ ...entry });
        break;
      case "training":
        if (trainingRemoved) break; // removal is surfaced in the diff, not hidden
        entries.push({
          ...entry,
          time: minutesToTime(trainingMin ?? timeToMinutes(entry.time)),
          detail: demand && demand !== original.sessionDemand ? `Demand: ${demand}` : entry.detail,
        });
        break;
      case "meal":
        // Placed in the redistribution pass below.
        break;
      case "cardio": {
        // Cardio yields when the evening is compressed; flagged, not deleted silently.
        const compressed =
          trainingEndMin !== null && trainingEndMin + BED_TRAINING_BUFFER > timeToMinutes(original.bedTime);
        if (compressed || trainingRemoved === false && trainingMin !== null && trainingMin >= 19 * 60) {
          explanation.push("Cardio removed today — the compressed evening protects training and the recovery window.");
        } else if (timeToMinutes(entry.time) < now) {
          const slot = Math.max(now + 30, wakeMin + 60);
          entries.push({ ...entry, time: minutesToTime(slot) });
          explanation.push("Cardio moved forward — its original slot has already passed.");
        } else {
          entries.push({ ...entry });
        }
        break;
      }
      case "mobility":
      case "recovery": {
        const t = timeToMinutes(entry.time);
        if (t < now) {
          const anchor = trainingEndMin !== null ? trainingEndMin + 10 : now + 30;
          entries.push({ ...entry, time: minutesToTime(Math.min(anchor, bedMin - 45)) });
        } else {
          entries.push({ ...entry });
        }
        break;
      }
      default: {
        const t = timeToMinutes(entry.time);
        entries.push(t < now ? { ...entry, time: minutesToTime(Math.max(t, now)) } : { ...entry });
      }
    }
  }

  /* Meal redistribution: remaining meals spread across what is left of the
     day. Total daily targets are preserved — only timing moves. Nothing is
     scheduled in the past; nothing already eaten is duplicated. */
  const firstSlot = Math.max(now, wakeMin + 30);
  const lastSlot = bedMin - BED_MEAL_BUFFER;
  const mealTimes = planMealTimes(remainingMeals.length, firstSlot, lastSlot, trainingMin, trainingEndMin);
  remainingMeals.forEach((meal, i) => {
    const tags: string[] = [];
    if (trainingMin !== null && Math.abs(mealTimes[i] - (trainingMin - PRE_TRAINING_MEAL_LEAD)) < 30) {
      tags.push("Pre-training");
    }
    if (trainingEndMin !== null && Math.abs(mealTimes[i] - (trainingEndMin + POST_TRAINING_MEAL_LAG)) < 30) {
      tags.push("Post-training");
    }
    entries.push({
      ...meal,
      time: minutesToTime(mealTimes[i]),
      detail: tags.length > 0 ? tags.join(" · ") : meal.detail,
    });
  });
  if (remainingMeals.length > 0) {
    explanation.push(
      `${remainingMeals.length} remaining meal${remainingMeals.length === 1 ? "" : "s"} redistributed across the rest of the day — daily targets unchanged${completedMeals.length > 0 ? `, ${completedMeals.length} already-eaten meal${completedMeals.length === 1 ? "" : "s"} untouched` : ""}.`,
    );
  }
  if (remainingMeals.length > 0 && lastSlot <= firstSlot) {
    warnings.push(
      "The planned eating window has already closed — remaining meals are anchored to right now. Log what you actually eat rather than forcing the full plan this late.",
    );
  } else if (remainingMeals.length > 0 && lastSlot - firstSlot < remainingMeals.length * 60) {
    warnings.push("The remaining eating window is tight — meals are spaced as evenly as the day allows.");
  }

  entries.sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));

  const proposed: DayPlanVersion = {
    id: newId("dpv"),
    createdAt: nowIso(),
    createdBy: input.createdBy,
    wakeTime: wake,
    bedTime: minutesToTime(bedMin),
    trainingTime: trainingRemoved ? null : trainingTime,
    sessionTitle: trainingRemoved ? null : original.sessionTitle,
    sessionDemand: trainingRemoved ? null : demand,
    entries,
  };

  if (input.actualWakeTime && wakeDelayMin > 0) {
    explanation.unshift(
      `Wake time moved from ${original.wakeTime} to ${wake} — the whole day rebuilt around the real start, not the planned one.`,
    );
  }
  if (input.newTrainingTime && original.trainingTime && input.newTrainingTime !== original.trainingTime) {
    explanation.unshift(`Training moved to ${input.newTrainingTime}; session intent preserved.`);
  }
  if (trainingRemoved && original.trainingTime) {
    explanation.unshift("Today's session removed — nothing else was silently rescheduled to compensate.");
  }
  if (input.customNote) explanation.push(`Reported: ${input.customNote}`);

  const changes = diffDayPlans(original, proposed);
  const impactSummary = buildImpactSummary(changes, warnings);

  return { proposed, explanation, impactSummary, warnings, tomorrowImpact, changes };
}

/** Even meal spacing that snaps the nearest slots to pre/post-training anchors. */
function planMealTimes(
  count: number,
  firstSlot: number,
  lastSlot: number,
  trainingMin: number | null,
  trainingEndMin: number | null,
): number[] {
  if (count === 0) return [];
  // Degenerate case: the eating window has already closed (e.g. the day is
  // effectively over). Nothing is ever scheduled in the past — the window
  // floor wins over the bedtime ceiling, and the caller's tight-window
  // warning tells the athlete to log what they actually eat.
  if (lastSlot <= firstSlot) lastSlot = firstSlot;
  const span = Math.max(0, lastSlot - firstSlot);
  const times: number[] = [];
  if (count === 1) {
    times.push(firstSlot + span / 2);
  } else {
    const gap = Math.min(Math.max(span / (count - 1), 45), Math.max(MIN_MEAL_SPACING, span / (count - 1)));
    for (let i = 0; i < count; i += 1) times.push(firstSlot + Math.min(gap * i, span));
  }
  // Snap the closest meals onto training anchors when a session exists.
  if (trainingMin !== null && trainingEndMin !== null && count >= 2) {
    const pre = trainingMin - PRE_TRAINING_MEAL_LEAD;
    const post = trainingEndMin + POST_TRAINING_MEAL_LAG;
    if (pre >= firstSlot) snapNearest(times, pre);
    if (post <= lastSlot) snapNearest(times, post);
  }
  times.sort((a, b) => a - b);
  // Enforce minimum forward spacing after snapping.
  for (let i = 1; i < times.length; i += 1) {
    if (times[i] - times[i - 1] < 45) times[i] = Math.min(times[i - 1] + 45, lastSlot);
  }
  // Clamp with the floor applied last: firstSlot (never the past) beats lastSlot.
  return times.map((t) => Math.round(Math.max(Math.min(t, lastSlot), firstSlot)));
}

function snapNearest(times: number[], target: number): void {
  let best = 0;
  for (let i = 1; i < times.length; i += 1) {
    if (Math.abs(times[i] - target) < Math.abs(times[best] - target)) best = i;
  }
  times[best] = target;
}

/* ─── Diffing ─────────────────────────────────────────────────────────── */

export function diffDayPlans(a: DayPlanVersion, b: DayPlanVersion): DayDiffRow[] {
  const rows: DayDiffRow[] = [];
  if (a.wakeTime !== b.wakeTime) rows.push({ label: "Wake", from: a.wakeTime, to: b.wakeTime, kind: "time" });
  if ((a.trainingTime ?? "—") !== (b.trainingTime ?? "—")) {
    rows.push({
      label: "Training",
      from: a.trainingTime ?? "—",
      to: b.trainingTime ?? "Removed",
      kind: b.trainingTime ? "time" : "removed",
    });
  }
  if ((a.sessionDemand ?? "—") !== (b.sessionDemand ?? "—") && b.trainingTime) {
    rows.push({
      label: "Session demand",
      from: a.sessionDemand ?? "—",
      to: b.sessionDemand ?? "—",
      kind: "demand",
    });
  }
  const aMeals = a.entries.filter((e) => e.kind === "meal");
  const bMealById = new Map(b.entries.filter((e) => e.kind === "meal").map((e) => [e.id, e]));
  for (const meal of aMeals) {
    const moved = bMealById.get(meal.id);
    if (moved && moved.time !== meal.time && !moved.completed) {
      rows.push({ label: meal.label, from: meal.time, to: moved.time, kind: "time" });
    }
  }
  const aCardio = a.entries.filter((e) => e.kind === "cardio");
  const bCardioIds = new Set(b.entries.filter((e) => e.kind === "cardio").map((e) => e.id));
  for (const cardio of aCardio) {
    if (!bCardioIds.has(cardio.id)) {
      rows.push({ label: cardio.label, from: cardio.time, to: "Removed", kind: "removed" });
    } else {
      const moved = b.entries.find((e) => e.id === cardio.id);
      if (moved && moved.time !== cardio.time) {
        rows.push({ label: cardio.label, from: cardio.time, to: moved.time, kind: "time" });
      }
    }
  }
  if (a.bedTime !== b.bedTime) rows.push({ label: "Bedtime", from: a.bedTime, to: b.bedTime, kind: "time" });
  return rows;
}

function buildImpactSummary(changes: DayDiffRow[], warnings: string[]): string[] {
  const impact: string[] = [];
  if (changes.some((c) => c.label === "Training")) impact.push("Training time");
  if (changes.some((c) => c.kind === "demand")) impact.push("Training demand");
  if (changes.some((c) => c.label.toLowerCase().includes("meal"))) impact.push("Meal timing");
  if (changes.some((c) => c.kind === "removed" && c.label !== "Training")) impact.push("Cardio disposition");
  if (changes.some((c) => c.label === "Bedtime")) impact.push("Recovery window");
  if (warnings.length > 0) impact.push("Flagged constraints");
  return impact;
}
