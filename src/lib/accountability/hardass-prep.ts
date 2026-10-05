/* ════════════════════════════════════════════════════════════════════════
   HARDASS PREP — today's standard, built only from the member's own logs.

   Owner direction: "I like Hardass Prep more. We need an 'On a Cycle' section
   too — so the Reserve knows we need to be in perfect tip-top discipline
   shape, in and outside the gym." Choosing the Hardass Prep coach voice in
   Settings is what turns this on (`profile.aiCoachStyle === "hardass-prep"`).

   THE STANDARD is a list of checks. Each one reads a log the member already
   keeps, against a target that already exists in their own settings:

     training   the session their plan puts on today, and whether a completed
                session was logged today
     meals      the meal windows on today's plan, and how many were logged
     protein    only when today's planning target is built from the member's
                own bodyweight — never the reference-weight stand-in
     sleep      last night's sleep log, against their Recovery sleep target
     water      today's water logs, against their Recovery water target
     check-in   today's recovery check-in — only when the app can record one

   No target, no number: the check is about logging. Nothing is invented,
   interpolated or scored. A day closes at the member's own sleep time; an
   item still unlogged then is a miss.

   ON A CYCLE. When the member has entries active in their Logbook — the
   existing `live` rule in `lib/enhanced/room-context.ts`, reused, not
   re-detected — the standard has no grace: the headline changes, open items
   read as owed today, and the outside-the-gym checks are named as part of
   the standard. The cycle week, the next lab checkpoint they set, the
   clinician line and any recent warning signs come from that resolver's
   `gated` part and are returned separately, so a caller renders them only
   behind `useSafetyToolsVisible()` AND a current safety acknowledgement.

   COMPLIANCE (CLAUDE.md · constitution clinical-data.md): discipline here is
   about the member's own logging against their own targets. Never an amount,
   a schedule, a duration or a combination for any compound; never start,
   stop, continue or change; never "safe", never a claim that discipline
   protects against anything or makes a cycle safer; no condition names.

   Pure: no React, no store.
   ════════════════════════════════════════════════════════════════════════ */

import type { RedFlagKey } from "@/lib/compound-intelligence/risk-profiles";
import { resolveEnhancedRoomContext, type RoomContextInput } from "@/lib/enhanced/room-context";

export type StandardStatus = "met" | "missed" | "open" | "not-due";
export type StandardWhere = "gym" | "outside";
export type StandardCheckId = "training" | "meals" | "protein" | "sleep" | "water" | "check-in";

/** The real logger a check can open. The caller maps each kind to a working control. */
export type StandardLogger =
  | { kind: "training" }
  | { kind: "meal"; mealId: string }
  | { kind: "sleep" }
  | { kind: "water" };

export type StandardCheck = {
  id: StandardCheckId;
  label: string;
  where: StandardWhere;
  status: StandardStatus;
  line: string;
  /** Present only on a missed or open check whose logger exists. */
  logger: StandardLogger | null;
};

export type HardassPrepInput = {
  now: Date;
  training: {
    /** `isTrainingPlannedToday` — the one rule every room reads. */
    planned: boolean;
    sessionName: string | null;
    /** Dates (ISO or YYYY-MM-DD) of the member's completed session records. */
    completedSessionDates: ReadonlyArray<string>;
  };
  meals: {
    /** Meal windows on today's plan. */
    plannedMealIds: ReadonlyArray<string>;
    /** Meals logged today — callers pass [] when the log belongs to another day. */
    loggedMealIds: ReadonlyArray<string>;
  };
  protein: {
    /** Estimated grams from the meals logged today. */
    loggedG: number;
    /** Today's planning target when it is built from the member's own bodyweight; null otherwise. */
    targetG: number | null;
  };
  sleep: {
    logs: ReadonlyArray<{ date: string; hours: number }>;
    targetHours: number | null;
    /** The member's own wake and sleep times, "HH:MM". */
    wakeTime: string | null;
    sleepTime: string | null;
  };
  water: {
    logs: ReadonlyArray<{ date: string; oz: number }>;
    targetOz: number | null;
  };
  /** Dates of recovery check-ins; null when the app has no way to record one. */
  checkIns: ReadonlyArray<string> | null;
  /** The member's enhanced records, exactly as `resolveEnhancedRoomContext` reads them. */
  records: Omit<RoomContextInput, "now">;
};

export type OnCycleLive = {
  heading: string;
  line: string;
  basis: string;
  outside: string;
};

export type OnCycleGated = {
  /** The cycle and its week by the member's own dates, or that none is recorded. */
  cycleLine: string;
  /** The next lab checkpoint the member or their clinician set, with days until; null when none is set. */
  checkpointLine: string | null;
  clinicianLine: string;
  /** Warning signs reported in the recent window — the caller renders the escalation ladder. */
  recentRedFlags: RedFlagKey[];
};

export type HardassPrepStandard = {
  headline: string;
  verdict: string;
  checks: StandardCheck[];
  counts: Record<StandardStatus, number>;
  /** Present only when entries are active in the member's Logbook. */
  onCycle: { live: OnCycleLive; gated: OnCycleGated } | null;
};

/** Fixed member-facing copy. Scanned by the banned-language suite. */
export const HARDASS_COPY = {
  optionLabel: "Hardass Prep",
  optionSub: "No excuses. Every miss called out.",
  settingsNote:
    "Puts today's standard on Apex: training, meals, sleep and water, each checked against what you logged and the targets you set. Every miss is called out. On a cycle — entries active in your Logbook — there are no grace days: anything not logged is owed today, in the gym and outside it.",
  sectionLabel: "Hardass Prep · Today's standard",
  headline: "The standard is today. No excuses.",
  headlineOnCycle: "On a cycle. Every day counts — in the gym and outside it.",
  gymHeading: "In the gym",
  outsideHeading: "Outside the gym",
  onCycleHeading: "On a cycle",
  onCycleLine: "You're on a cycle. The standard is every day.",
  onCycleBasis: "Entries are active in your Logbook, so there are no grace days.",
  cycleHeading: "Your cycle",
  clinicianLine: "Anything unusual gets a medical review today.",
  contactsLabel: "Emergency contacts",
  escalationLabel: "Warning signs you reported",
  emergency: "In an emergency, call 911",
  crisis: "For crisis support, call 988",
  status: { met: "Met", missed: "Missed", open: "Open", "not-due": "Not due" } as Record<StandardStatus, string>,
  statusOwed: "Owed today",
  loggerLabel: {
    training: "Open Training",
    meal: "Log a Meal",
    sleep: "Log Sleep",
    water: (oz: number) => `Log ${oz} oz`,
  },
} as const;

/* ─── Helpers ──────────────────────────────────────────────────────────── */

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** A stored date as the member's local day: YYYY-MM-DD stays as written; an ISO stamp is read in local time. */
function localDayOf(value: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : dayKey(parsed);
}

function minutesOf(time: string | null): number | null {
  const match = time ? /^(\d{1,2}):(\d{2})$/.exec(time.trim()) : null;
  if (!match) return null;
  const minutes = Number(match[1]) * 60 + Number(match[2]);
  return minutes >= 0 && minutes < 1440 ? minutes : null;
}

/** Trims a logged figure without inventing precision: 7 → "7", 7.25 → "7.3". */
function figure(value: number): string {
  return String(Math.round(value * 10) / 10);
}

function positive(value: number | null): value is number {
  return value !== null && Number.isFinite(value) && value > 0;
}

/* ─── Resolver ─────────────────────────────────────────────────────────── */

export function resolveHardassPrep(input: HardassPrepInput): HardassPrepStandard {
  const today = dayKey(input.now);
  const nowMin = input.now.getHours() * 60 + input.now.getMinutes();

  /* The member's own day. It closes at their sleep time — when that time falls
     after midnight it belongs to tomorrow's date, so today never closes early. */
  const sleepMin = minutesOf(input.sleep.sleepTime);
  const dayClosed = sleepMin !== null && sleepMin >= 360 && nowMin >= sleepMin;
  const wakeMin = minutesOf(input.sleep.wakeTime);
  const awake = wakeMin === null || nowMin >= wakeMin;

  /* On a cycle — the existing live rule: entries active, not paused, in the Logbook. */
  const room = resolveEnhancedRoomContext("training", { now: input.now, ...input.records });
  const enhanced = Boolean(room?.live);

  const openTail = enhanced ? " Owed today." : " Still open.";
  const checks: StandardCheck[] = [];

  /* ── Training ── */
  {
    const name = input.training.sessionName?.trim() || "Today's session";
    const logged = input.training.completedSessionDates.some((date) => localDayOf(date) === today);
    if (logged) {
      checks.push({ id: "training", label: "Training", where: "gym", status: "met", line: `Session logged today.`, logger: null });
    } else if (!input.training.planned) {
      checks.push({ id: "training", label: "Training", where: "gym", status: "not-due", line: "No session planned today.", logger: null });
    } else if (dayClosed) {
      checks.push({ id: "training", label: "Training", where: "gym", status: "missed", line: `${name} was planned and never logged. That's a miss.`, logger: { kind: "training" } });
    } else {
      checks.push({ id: "training", label: "Training", where: "gym", status: "open", line: `${name} is planned and not logged yet.${openTail}`, logger: { kind: "training" } });
    }
  }

  /* ── Meals ── */
  const planned = [...new Set(input.meals.plannedMealIds)];
  const logged = new Set(input.meals.loggedMealIds);
  const nextMeal = planned.find((id) => !logged.has(id)) ?? null;
  const mealLogger: StandardLogger | null = nextMeal ? { kind: "meal", mealId: nextMeal } : null;
  {
    if (planned.length === 0) {
      const count = logged.size;
      checks.push(
        count > 0
          ? { id: "meals", label: "Meals", where: "outside", status: "met", line: `${count} ${count === 1 ? "meal" : "meals"} logged today.`, logger: null }
          : dayClosed
            ? { id: "meals", label: "Meals", where: "outside", status: "missed", line: "No meals logged today. That's a miss.", logger: null }
            : { id: "meals", label: "Meals", where: "outside", status: "open", line: `No meals logged today.${openTail}`, logger: null },
      );
    } else {
      const done = planned.filter((id) => logged.has(id)).length;
      const of = `${done} of ${planned.length} planned meals logged.`;
      if (done === planned.length) {
        checks.push({ id: "meals", label: "Meals", where: "outside", status: "met", line: `All ${planned.length} planned meals logged.`, logger: null });
      } else if (dayClosed) {
        checks.push({ id: "meals", label: "Meals", where: "outside", status: "missed", line: `${of} The rest is a miss.`, logger: mealLogger });
      } else {
        checks.push({ id: "meals", label: "Meals", where: "outside", status: "open", line: `${of}${openTail}`, logger: mealLogger });
      }
    }
  }

  /* ── Protein: only against a target built from the member's own bodyweight ── */
  if (positive(input.protein.targetG)) {
    const target = Math.round(input.protein.targetG);
    const got = Math.max(0, Math.round(input.protein.loggedG));
    if (got >= target) {
      checks.push({ id: "protein", label: "Protein", where: "outside", status: "met", line: `Est. ${got} g logged against today's ${target} g planning target.`, logger: null });
    } else if (dayClosed) {
      checks.push({ id: "protein", label: "Protein", where: "outside", status: "missed", line: `Est. ${got} g of today's ${target} g planning target logged. Short.`, logger: mealLogger });
    } else {
      checks.push({ id: "protein", label: "Protein", where: "outside", status: "open", line: `Est. ${got} g of today's ${target} g planning target logged.${openTail}`, logger: mealLogger });
    }
  }

  /* ── Sleep: last night's log, filed under today ── */
  {
    const night = [...input.sleep.logs].reverse().find((log) => log.date === today);
    const target = positive(input.sleep.targetHours) ? input.sleep.targetHours : null;
    if (night) {
      const hours = figure(night.hours);
      if (target !== null && night.hours < target) {
        checks.push({ id: "sleep", label: "Sleep", where: "outside", status: "missed", line: `${hours} h logged. Your Recovery target is ${figure(target)} h. Short.`, logger: null });
      } else {
        checks.push({
          id: "sleep",
          label: "Sleep",
          where: "outside",
          status: "met",
          line: target !== null ? `${hours} h logged against your ${figure(target)} h Recovery target.` : `${hours} h logged last night.`,
          logger: null,
        });
      }
    } else if (!awake) {
      checks.push({ id: "sleep", label: "Sleep", where: "outside", status: "open", line: "Log last night's sleep when you're up.", logger: { kind: "sleep" } });
    } else {
      checks.push({ id: "sleep", label: "Sleep", where: "outside", status: "missed", line: "No sleep logged last night. That's a miss.", logger: { kind: "sleep" } });
    }
  }

  /* ── Water ── */
  {
    const oz = input.water.logs.filter((log) => log.date === today).reduce((sum, log) => sum + (Number.isFinite(log.oz) ? log.oz : 0), 0);
    const target = positive(input.water.targetOz) ? input.water.targetOz : null;
    const water = (status: StandardStatus, line: string): StandardCheck => ({
      id: "water",
      label: "Water",
      where: "outside",
      status,
      line,
      logger: status === "met" ? null : { kind: "water" },
    });
    if (target !== null) {
      if (oz >= target) checks.push(water("met", `${figure(oz)} oz logged against your ${figure(target)} oz Recovery target.`));
      else if (oz > 0) checks.push(water(dayClosed ? "missed" : "open", `${figure(oz)} of your ${figure(target)} oz Recovery target logged.${dayClosed ? " Short." : openTail}`));
      else checks.push(water(dayClosed ? "missed" : "open", dayClosed ? "No water logged today. That's a miss." : `No water logged today.${openTail}`));
    } else if (oz > 0) {
      checks.push(water("met", `${figure(oz)} oz logged today.`));
    } else {
      checks.push(water(dayClosed ? "missed" : "open", dayClosed ? "No water logged today. That's a miss." : `No water logged today.${openTail}`));
    }
  }

  /* ── Recovery check-in — only when the app can record one ── */
  if (input.checkIns) {
    const done = input.checkIns.some((date) => localDayOf(date) === today);
    checks.push({
      id: "check-in",
      label: "Daily check-in",
      where: "outside",
      status: done ? "met" : dayClosed ? "missed" : "open",
      line: done ? "Check-in logged today." : dayClosed ? "No check-in logged today. That's a miss." : `No check-in logged today.${openTail}`,
      logger: null,
    });
  }

  /* ── Counts and verdict ── */
  const counts: Record<StandardStatus, number> = { met: 0, missed: 0, open: 0, "not-due": 0 };
  for (const check of checks) counts[check.status] += 1;

  const openWord = enhanced ? "owed today" : "still open";
  const verdict =
    counts.missed > 0
      ? `${counts.missed} missed. Every miss is on the record.${counts.open > 0 ? ` ${counts.open} ${openWord}.` : ""}`
      : counts.open > 0
        ? `${counts.open} ${openWord}. Nothing counts until it's logged.`
        : "Every check met today. Do it again tomorrow.";

  /* ── On a cycle ── */
  let onCycle: HardassPrepStandard["onCycle"] = null;
  if (enhanced && room) {
    const outsideLabels = checks.filter((check) => check.where === "outside" && check.id !== "protein").map((check) => check.label.toLowerCase());
    const nutrition = resolveEnhancedRoomContext("nutrition", { now: input.now, ...input.records });
    const checkpoint = nutrition?.gated.facts.find((fact) => fact.id === "checkpoint");
    onCycle = {
      live: {
        heading: HARDASS_COPY.onCycleHeading,
        line: HARDASS_COPY.onCycleLine,
        basis: HARDASS_COPY.onCycleBasis,
        outside: `Outside the gym counts too: ${joinList(outsideLabels)} are part of the standard.`,
      },
      gated: {
        cycleLine: room.gated.statement,
        checkpointLine: checkpoint && checkpoint.label === "Next lab checkpoint" ? `${checkpoint.label} · ${checkpoint.value}` : null,
        clinicianLine: HARDASS_COPY.clinicianLine,
        recentRedFlags: room.gated.recentRedFlags,
      },
    };
  }

  return {
    headline: enhanced ? HARDASS_COPY.headlineOnCycle : HARDASS_COPY.headline,
    verdict,
    checks,
    counts,
    onCycle,
  };
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

/** Every member-facing string a standard can produce — for the banned-language suite. */
export function hardassPrepStrings(standard: HardassPrepStandard): string[] {
  return [
    standard.headline,
    standard.verdict,
    ...standard.checks.flatMap((check) => [check.label, check.line]),
    ...(standard.onCycle
      ? [
          standard.onCycle.live.heading,
          standard.onCycle.live.line,
          standard.onCycle.live.basis,
          standard.onCycle.live.outside,
          standard.onCycle.gated.cycleLine,
          ...(standard.onCycle.gated.checkpointLine ? [standard.onCycle.gated.checkpointLine] : []),
          standard.onCycle.gated.clinicianLine,
        ]
      : []),
  ];
}

/** The fixed copy, flattened — for the banned-language suite. */
export function hardassFixedCopy(): string[] {
  const out: string[] = [];
  for (const value of Object.values(HARDASS_COPY)) {
    if (typeof value === "string") out.push(value);
    else if (typeof value === "object") {
      for (const inner of Object.values(value)) out.push(typeof inner === "function" ? inner(16) : inner);
    }
  }
  return out;
}
