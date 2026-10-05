/* ════════════════════════════════════════════════════════════════════════
   WEEK GUIDANCE — how to run the week she actually has.

   Members get a split and no advice about placing it. This reads the resolved
   week, her standing commitments and her Double Day arrangement, and reports
   the real collisions in them.

   Every note is DERIVED. Nothing here is generic coaching copy: a note only
   appears when the member's own week contains the thing it describes, and it
   names the day and the session so she can check it herself.

   It reports and it recommends placement. It never moves anything — the
   member's week is hers, and silently rearranging it is the behaviour this
   whole effort exists to remove.

   Training organisation only. No medical content, no dosing, no claim about
   what any arrangement does to a body.
   ════════════════════════════════════════════════════════════════════════ */

import { morningSessionFor, morningsPerWeek, type DoubleDay } from "./double-day";
import { splitActivity } from "./split-activities";
import {
  WEEKDAY_SHORT,
  commitmentsOnDay,
  doesActivity,
  heavyLowerAvoidDays,
  totalSessionsPerWeek,
  type WeekdayIndex,
  type WeeklyCommitment,
} from "./weekly-commitments";

/** The shape this engine needs from a resolved week. Structural, not the
    full ResolvedDay, so the module stays a leaf and testable on its own. */
export type GuidanceDay = {
  dayIndex: number;
  title: string;
  recovery: boolean;
  /** True when the day is a heavy lower-body session. */
  heavyLower: boolean;
  /** True when the day is any lower-body session. */
  lower: boolean;
};

export type GuidanceSeverity = "conflict" | "attention" | "note";

export type GuidanceNote = {
  id: string;
  severity: GuidanceSeverity;
  /** Short enough to be a row heading. */
  title: string;
  /** Names the day and the session, so she can verify it. */
  detail: string;
};

export type WeekGuidance = {
  notes: GuidanceNote[];
  /** One line stating how much is in the week, in total. */
  loadLine: string;
};

const day = (i: number) => WEEKDAY_SHORT[((i % 7) + 7) % 7];

/* ── The collisions worth naming ──────────────────────────────────────────── */

/** A heavy lower session the morning after a high-load leg commitment. */
function legCollisions(week: GuidanceDay[], commitments: WeeklyCommitment[]): GuidanceNote[] {
  const avoid = heavyLowerAvoidDays(commitments);
  const notes: GuidanceNote[] = [];
  for (const d of week) {
    if (!d.heavyLower || d.recovery) continue;
    const idx = d.dayIndex as WeekdayIndex;
    if (!avoid.has(idx)) continue;
    const sameDay = commitmentsOnDay(commitments, idx);
    const prev = commitmentsOnDay(commitments, (((idx - 1) % 7 + 7) % 7) as WeekdayIndex);
    const culprit = sameDay[0] ?? prev[0];
    if (!culprit) continue;
    const label = splitActivity(culprit.activity)?.label ?? culprit.activity;
    notes.push({
      id: `leg-collision-${d.dayIndex}`,
      severity: "conflict",
      title: `${d.title} sits too close to ${label}`,
      detail: sameDay.length > 0
        ? `${label} and ${d.title} both land on ${day(idx)}. Two heavy lower efforts in one day is the week's biggest recovery cost — move one of them if you can.`
        : `${label} is on ${day(idx - 1)} and ${d.title} is on ${day(idx)}. A heavy lower session the day after is the one placement worth changing.`,
    });
  }
  return notes;
}

/** A morning session in front of the heaviest lower day. */
function morningPlacement(week: GuidanceDay[], dd: DoubleDay): GuidanceNote[] {
  const notes: GuidanceNote[] = [];
  for (const d of week) {
    const morning = morningSessionFor(dd, d.dayIndex as WeekdayIndex);
    if (!morning) continue;
    if (d.recovery) {
      notes.push({
        id: `morning-on-rest-${d.dayIndex}`,
        severity: "note",
        title: `${day(d.dayIndex)} is a rest day with a morning session`,
        detail: `${morning.title} runs on ${day(d.dayIndex)}, which has no lift. That is a clean place for it — the session has the whole day to itself.`,
      });
      continue;
    }
    if (d.heavyLower) {
      notes.push({
        id: `morning-before-heavy-${d.dayIndex}`,
        severity: "attention",
        title: `${morning.title} is in front of ${d.title}`,
        detail: `${day(d.dayIndex)} runs ${morning.shape} in the morning and ${d.title} later. Steady-state work before the heaviest lower session of the week costs you on the bar — an upper day is the better morning to pair it with.`,
      });
    }
  }
  return notes;
}

/** Mobility prescribed into a week that already has two studio sessions. */
function redundantMobility(week: GuidanceDay[], commitments: WeeklyCommitment[]): GuidanceNote[] {
  const studio =
    commitments.filter((c) => ["pilates", "reformer-pilates", "barre", "yoga"].includes(c.activity));
  const sessions = totalSessionsPerWeek(studio);
  if (sessions < 2) return [];
  const mobilityDay = week.find((d) => /mobility|yoga|pilates/i.test(d.title));
  if (!mobilityDay) return [];
  const label = splitActivity(studio[0].activity)?.label ?? "studio work";
  return [{
    id: "redundant-mobility",
    severity: "note",
    title: `${mobilityDay.title} may be redundant`,
    detail: `You already do ${label} ${sessions}× a week. The plan still schedules ${mobilityDay.title} on ${day(mobilityDay.dayIndex)} — that day is free for something else if you want it.`,
  }];
}

/** The honest total, so she can see the week before she commits to it. */
function loadLine(week: GuidanceDay[], commitments: WeeklyCommitment[], dd: DoubleDay): string {
  const lifts = week.filter((d) => !d.recovery).length;
  const outside = totalSessionsPerWeek(commitments);
  const mornings = morningsPerWeek(dd);
  const total = lifts + outside + mornings;
  const parts = [`${lifts} planned session${lifts === 1 ? "" : "s"}`];
  /* This counts SESSIONS, not commitments — "Pilates 2x" is one commitment and
     two sessions, and calling it two commitments misreported her own week. */
  if (outside > 0) parts.push(`${outside} standing session${outside === 1 ? "" : "s"}`);
  if (mornings > 0) parts.push(`${mornings} morning${mornings === 1 ? "" : "s"}`);
  return `${parts.join(" · ")} — ${total} sessions in the week.`;
}

/** A week carrying more than it can recover from. Reported, never enforced. */
function volumeWarning(week: GuidanceDay[], commitments: WeeklyCommitment[], dd: DoubleDay): GuidanceNote[] {
  const total = week.filter((d) => !d.recovery).length + totalSessionsPerWeek(commitments) + morningsPerWeek(dd);
  /* A day is only clear when NOTHING lands on it — not a lift, not a standing
     commitment, and not a morning session. Counting mornings as clear was the
     whole mistake: a rest day with a fasted morning on it is not a rest day. */
  const fullRest = week.filter(
    (d) =>
      d.recovery &&
      commitmentsOnDay(commitments, d.dayIndex as WeekdayIndex).length === 0 &&
      !morningSessionFor(dd, d.dayIndex as WeekdayIndex),
  ).length;
  if (total < 11 && fullRest > 0) return [];
  const notes: GuidanceNote[] = [];
  if (total >= 11) {
    notes.push({
      id: "total-volume",
      severity: "attention",
      title: `${total} sessions in a seven-day week`,
      detail: "That is a lot to recover from. It is your call to make, but sleep and food stop being optional at this volume — and the first thing to drop is a morning, not a lift.",
    });
  }
  if (fullRest === 0) {
    notes.push({
      id: "no-full-rest",
      severity: "conflict",
      title: "No day is fully clear",
      detail: "Every day in the week carries a session, a commitment or a morning. A week with nothing in it at all is worth protecting somewhere.",
    });
  }
  return notes;
}

/** Two lower exposures too close together to both be useful. */
function lowerSpacing(week: GuidanceDay[]): GuidanceNote[] {
  const lowerDays = week.filter((d) => d.lower && !d.recovery).map((d) => d.dayIndex).sort((a, b) => a - b);
  if (lowerDays.length < 2) return [];
  const notes: GuidanceNote[] = [];
  for (let i = 1; i < lowerDays.length; i++) {
    if (lowerDays[i] - lowerDays[i - 1] === 1) {
      notes.push({
        id: `lower-spacing-${lowerDays[i]}`,
        severity: "attention",
        title: `Lower days on ${day(lowerDays[i - 1])} and ${day(lowerDays[i])}`,
        detail: "Back-to-back lower sessions mean the second one runs on hips that have not recovered. A day between them gets more out of both.",
      });
      break;
    }
  }
  return notes;
}

/** A fasted morning on the day of her longest commitment. */
function fastedLoadNote(commitments: WeeklyCommitment[], dd: DoubleDay): GuidanceNote[] {
  if (!dd.enabled || !dd.fasted) return [];
  const heavy = commitments.filter((c) => splitActivity(c.activity)?.load === "high");
  const clash = heavy.find((c) => c.days.some((d) => dd.days.includes(d)));
  if (!clash) return [];
  const label = splitActivity(clash.activity)?.label ?? clash.activity;
  const d = clash.days.find((x) => dd.days.includes(x))!;
  return [{
    id: "fasted-before-high-load",
    severity: "attention",
    title: `Fasted morning on a ${label} day`,
    detail: `${day(d)} has a fasted morning session and ${label} on the same day. Eating between the two is the straightforward fix if the second one has been feeling flat.`,
  }];
}

/* ── Entry point ──────────────────────────────────────────────────────────── */

export function buildWeekGuidance(input: {
  week: GuidanceDay[];
  commitments: WeeklyCommitment[];
  doubleDay: DoubleDay;
}): WeekGuidance {
  const { week, commitments, doubleDay } = input;
  const notes = [
    ...legCollisions(week, commitments),
    ...morningPlacement(week, doubleDay),
    ...lowerSpacing(week),
    ...volumeWarning(week, commitments, doubleDay),
    ...redundantMobility(week, commitments),
    ...fastedLoadNote(commitments, doubleDay),
  ];
  const order: Record<GuidanceSeverity, number> = { conflict: 0, attention: 1, note: 2 };
  notes.sort((a, b) => order[a.severity] - order[b.severity]);
  return { notes, loadLine: loadLine(week, commitments, doubleDay) };
}

/** Whether a title reads as a lower-body session, for callers building GuidanceDay. */
export function titleIsLower(title: string): boolean {
  return /glute|leg|lower|hamstring|quad|posterior/i.test(title);
}

/** Whether a title reads as a HEAVY lower session rather than a pump or detail day. */
export function titleIsHeavyLower(title: string): boolean {
  if (!titleIsLower(title)) return false;
  if (/pump|detail|waistline|circuit|conditioning/i.test(title)) return false;
  return /strength|power|squat|posterior chain|lower/i.test(title) || /^legs?$/i.test(title.trim());
}

/** Convenience: a member with nothing set gets no notes rather than a crash. */
export { type WeeklyCommitment, type DoubleDay };
export const EMPTY_GUIDANCE: WeekGuidance = { notes: [], loadLine: "No week resolved yet." };

/** Re-exported so a UI can label days from one import. */
export { WEEKDAY_SHORT, doesActivity };
