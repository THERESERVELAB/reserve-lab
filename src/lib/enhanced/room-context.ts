/* ════════════════════════════════════════════════════════════════════════
   ENHANCED ROOM CONTEXT — the daily rooms recognise an enhanced athlete.

   Owner direction (program redesign, finding #3): "the system must understand
   the user is enhanced across the program." When a member has logged
   compounds or stated a cycle, Apex, Training, Nutrition and Recovery each
   say what the member's OWN records hold, where it is true for that room:

     Apex       one line and a link
     Training   cycle week, logged symptoms, the symptom-check route
     Recovery   the same, with the sleep log and the symptom-check route
     Nutrition  the next lab checkpoint, the latest draw, and any result the
                lab flagged or that sits outside the range on the member's
                own report — carrying that report's range and flag

   TWO PARTS, TWO GATES. The resolver returns them separately so a caller
   cannot render one under the other's gate by accident:

     `live`   the member's active logged entries, by name as logged. This is
              exactly what Apex's Logbook already shows live (active, not
              paused) — no launch switch, no acknowledgement, no tier.
     `gated`  everything derived from the cycle and safety system: cycle
              phase and week, checkpoints, latest draw, symptoms, lab flags,
              escalation routes. Callers render it only when
              `useSafetyToolsVisible()` is true AND the member holds a current
              safety acknowledgement (including the 18+ confirmation).

   COMPLIANCE (CLAUDE.md · constitution clinical-data.md): timing, never
   cause. No amounts, schedules, durations or combinations. Never start,
   stop, continue or change. Never "safe to continue", never a claim that
   anything protects against or reverses harm, never a condition name, never
   Reserve's own reading of a lab value — only the range and flag printed on
   the member's report. Every number in the output is the member's own: a
   value or range they logged, a date they entered, a week counted from
   their own dates, or a count of their own records.

   Pure: no React, no store.
   ════════════════════════════════════════════════════════════════════════ */

import { RED_FLAGS, type RedFlagKey } from "@/lib/compound-intelligence/risk-profiles";
import {
  CYCLE_PHASE_LABEL,
  daysBetween,
  dateKeyOf,
  isDateKey,
  resolveCycleState,
  selectCurrentCycle,
  type CyclePeriod,
  type CycleState,
} from "@/lib/cycle/cycle-period";
import { CHECK_IN_SYMPTOMS, type CheckInSymptomKey } from "@/lib/cycle-review/types";
import { buildLabSafetyBrief, type LabRecordInput } from "@/lib/labs/lab-safety";
import { LAB_FLAG_LABEL } from "@/lib/labs/types";
import { ESCALATION_LABEL } from "@/lib/safety/escalation";
import { formatDayFull } from "@/lib/physique/record-summary";

export type EnhancedRoom = "apex" | "training" | "nutrition" | "recovery";

/** Red-flag symptoms reported within this window count as recent (matches `useSafetyContext`). */
export const ROOM_RECENT_SYMPTOM_HOURS = 72;
/** Nutrition lists at most this many flagged results; the rest are counted and live in the Bloodwork Log. */
export const ROOM_LAB_FLAG_LIMIT = 4;

export type RoomEntryInput = {
  id: string;
  name: string;
  displayName?: string;
  officialName?: string;
  isActive: boolean;
  pausedAt?: string;
};

export type RoomContextInput = {
  now: Date;
  entries: ReadonlyArray<RoomEntryInput>;
  cycles: ReadonlyArray<CyclePeriod>;
  labRecords: ReadonlyArray<LabRecordInput>;
  redFlagReports: ReadonlyArray<{ reportedAt: string; flags: RedFlagKey[] }>;
  checkIns: ReadonlyArray<{ date: string; symptoms: CheckInSymptomKey[] }>;
};

/** Where a room's context can send the member. The caller maps each kind to a real control. */
export type RoomRoute =
  | { kind: "view"; view: "supplements" | "bloodwork"; label: string }
  | { kind: "symptom-check"; label: string }
  | { kind: "sleep-log"; label: string };

export type RoomFact = { id: string; label: string; value: string };

export type RoomLabFlag = {
  id: string;
  marker: string;
  /** The value and unit exactly as logged, with the draw date. */
  reading: string;
  /** The range printed on the member's report, or that none was printed. */
  range: string;
  /** "The lab flagged this High" / "Outside the range on your report". */
  flag: string;
  /** Where it routes. */
  route: string;
  critical: boolean;
};

export type LiveRoomContext = {
  /** Active, not paused, by name as logged — what Apex's Logbook shows. */
  entryNames: string[];
  statement: string;
  routes: RoomRoute[];
  note: string;
};

export type GatedRoomContext = {
  /** The headline: the cycle and its week by the member's own dates, or that no cycle is recorded. */
  statement: string;
  detail: string | null;
  facts: RoomFact[];
  /** Nutrition only. */
  labFlags: RoomLabFlag[];
  /** Flagged results beyond `ROOM_LAB_FLAG_LIMIT`. */
  moreLabFlags: number;
  /** Training and Recovery: red-flag symptoms reported in the recent window, for the escalation ladder. */
  recentRedFlags: RedFlagKey[];
  /** Compounds still active past the member's own planned end — named, routed to a clinician, never told to stop. */
  pastEndNotice: string | null;
  routes: RoomRoute[];
  note: string;
};

export type EnhancedRoomContext = {
  room: EnhancedRoom;
  live: LiveRoomContext | null;
  gated: GatedRoomContext;
  /** The single Apex line — gated and live versions, so the caller picks by gate. */
  apexLine: { gated: string; live: string | null };
};

/* ─── Helpers ──────────────────────────────────────────────────────────── */

export function entryName(entry: RoomEntryInput): string {
  return entry.displayName?.trim() || entry.officialName?.trim() || entry.name.trim();
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

function daysAgo(days: number): string {
  if (days <= 0) return "today";
  return days === 1 ? "1 day ago" : `${days} days ago`;
}

function daysAhead(days: number): string {
  if (days <= 0) return "today";
  return days === 1 ? "in 1 day" : `in ${days} days`;
}

const COMPOUND_ROUTE: RoomRoute = { kind: "view", view: "supplements", label: "Open Compound Command" };
const SYMPTOM_ROUTE: RoomRoute = { kind: "symptom-check", label: "Open Symptom Check" };
const SLEEP_ROUTE: RoomRoute = { kind: "sleep-log", label: "Log Sleep" };
const BLOODWORK_ROUTE: RoomRoute = { kind: "view", view: "bloodwork", label: "Open Bloodwork Log" };

const TIMING_NOTE =
  "The dates and entries you recorded, shown beside each other. Reserve describes timing only — it never says what caused anything, and never states an amount, a schedule or a change to make.";
const LIVE_NOTE = "Exactly as you entered them. Reserve does not suggest what to use, how much, or when.";
const LAB_NOTE =
  "Ranges and flags are the ones printed on your own report. Reserve does not read what a result means — get it reviewed by your clinician, urgent care or a telehealth visit.";

/** Fixed member-facing copy the room section renders around a context. Scanned by the banned-language suite. */
export const ROOM_COPY = {
  cycleHeading: "Your cycle",
  nutritionHeading: "Your labs and cycle",
  logHeading: "Your log",
  activeInLog: "Active in your log",
  labFlagsHeading: "Flagged on your report",
  moreLabFlags: (count: number) => `${count} more flagged in your Bloodwork Log`,
  awaitingAcknowledgement:
    "Your cycle week, lab checkpoints and symptom check appear here once you accept the safety acknowledgement in Compound Command.",
  escalationLabel: "Warning signs you reported",
  contactsLabel: "Emergency contacts",
  emergency: "In an emergency, call 911",
  crisis: "For crisis support, call 988",
} as const;

/* ─── Cycle ────────────────────────────────────────────────────────────── */

function cycleStatement(state: CycleState): string {
  const name = state.cycle.name;
  switch (state.phase) {
    case "on-cycle":
      return `${name} · Week ${state.weekNumber} of ${state.totalWeeks}`;
    case "upcoming":
      return `${name} · ${CYCLE_PHASE_LABEL.upcoming}`;
    case "past-planned-end":
      return `${name} · ${CYCLE_PHASE_LABEL["past-planned-end"]}`;
    default:
      return `${name} · ${CYCLE_PHASE_LABEL.ended}`;
  }
}

function cycleDetail(state: CycleState): string {
  switch (state.phase) {
    case "on-cycle":
      return `By the dates you entered · started ${formatDayFull(state.cycle.startDate)} · planned end ${formatDayFull(state.plannedEnd)}`;
    case "upcoming":
      return `By the dates you entered · starts ${formatDayFull(state.cycle.startDate)} · ${plural(state.totalWeeks, "week", "weeks")} planned`;
    case "past-planned-end":
      return `By the dates you entered · planned end ${formatDayFull(state.plannedEnd)} · ${plural(state.daysPastPlannedEnd, "day", "days")} since`;
    default:
      return `By the dates you entered · started ${formatDayFull(state.cycle.startDate)}`;
  }
}

function checkpointFact(state: CycleState | null): RoomFact {
  const next = state?.nextCheckpoint;
  if (!next) {
    return { id: "checkpoint", label: "Lab checkpoint you set", value: "None set" };
  }
  const by = next.setBy === "clinician" ? "set by your clinician" : "set by you";
  const when = next.status === "due" ? "due now" : daysAhead(next.daysFromToday);
  return { id: "checkpoint", label: "Next lab checkpoint", value: `${next.label} · ${formatDayFull(next.date)} · ${when} · ${by}` };
}

/* ─── Symptoms ─────────────────────────────────────────────────────────── */

function symptomFacts(input: RoomContextInput): { facts: RoomFact[]; recentRedFlags: RedFlagKey[] } {
  const cutoff = input.now.getTime() - ROOM_RECENT_SYMPTOM_HOURS * 3_600_000;
  const recent = input.redFlagReports
    .filter((report) => Date.parse(report.reportedAt) >= cutoff && report.flags.length > 0)
    .sort((a, b) => b.reportedAt.localeCompare(a.reportedAt));
  const recentRedFlags = [...new Set(recent.flatMap((report) => report.flags))].filter((flag) => RED_FLAGS[flag]);

  const facts: RoomFact[] = [];
  const latestReport = recent[0];
  if (latestReport) {
    const labels = [...new Set(latestReport.flags)].filter((flag) => RED_FLAGS[flag]).map((flag) => RED_FLAGS[flag].label);
    facts.push({
      id: "red-flags",
      label: "Warning signs you reported",
      value: `${formatDayFull(dateKeyOf(new Date(latestReport.reportedAt)))} · ${labels.join(" · ")}`,
    });
  }

  const latestCheckIn = [...input.checkIns].filter((c) => isDateKey(c.date)).sort((a, b) => b.date.localeCompare(a.date))[0];
  if (latestCheckIn && latestCheckIn.symptoms.length > 0) {
    const labels = [...new Set(latestCheckIn.symptoms)].filter((key) => CHECK_IN_SYMPTOMS[key]).map((key) => CHECK_IN_SYMPTOMS[key].label);
    facts.push({ id: "check-in", label: "Symptoms at your last check-in", value: `${formatDayFull(latestCheckIn.date)} · ${labels.join(" · ")}` });
  } else if (!latestReport) {
    facts.push({
      id: "symptoms",
      label: "Symptoms you logged",
      value: latestCheckIn ? `None at your ${formatDayFull(latestCheckIn.date)} check-in` : "None logged",
    });
  }
  return { facts, recentRedFlags };
}

/* ─── Labs ─────────────────────────────────────────────────────────────── */

function latestDrawFact(labRecords: ReadonlyArray<LabRecordInput>, today: string): RoomFact {
  const latest = labRecords
    .map((record) => record.testDate)
    .filter(isDateKey)
    .filter((date) => date <= today)
    .sort()
    .at(-1);
  return latest
    ? { id: "latest-draw", label: "Latest draw", value: `${formatDayFull(latest)} · ${daysAgo(daysBetween(latest, today))}` }
    : { id: "latest-draw", label: "Latest draw", value: "No lab record logged" };
}

function labFlags(input: RoomContextInput): RoomLabFlag[] {
  const brief = buildLabSafetyBrief({ records: [...input.labRecords], now: input.now });
  return brief.findings
    /* Only what the report itself supports: the lab's flag, or a value outside
       the range the report printed. Reserve's own "trending toward a limit"
       reading is not a lab flag, so it stays in the Bloodwork safety panel. */
    .filter((finding) => finding.tier === "urgent" || finding.tier === "discuss")
    .map((finding) => {
      const reading = finding.latest;
      const unit = reading.unit ? ` ${reading.unit}` : "";
      const flags: string[] = [];
      if (reading.labFlag) flags.push(`The lab flagged this ${LAB_FLAG_LABEL[reading.labFlag]}`);
      if (reading.position === "above") flags.push("Above the range on your report");
      if (reading.position === "below") flags.push("Below the range on your report");
      const critical = finding.tier === "urgent";
      return {
        id: finding.id,
        marker: finding.label,
        reading: `${reading.valueText}${unit} · ${formatDayFull(reading.date)}`,
        range: reading.rangeText ? `Range on your report ${reading.rangeText}${unit}` : "No range printed on your report",
        flag: flags.join(" · "),
        route: critical ? ESCALATION_LABEL["contact-clinician-today"] : ESCALATION_LABEL["discuss-with-clinician"],
        critical,
      };
    });
}

/* ─── Resolver ─────────────────────────────────────────────────────────── */

/**
 * The context one room shows for the member's own enhanced records, or null
 * when there is nothing to recognise: no active logged entry and no open cycle.
 * Reserve does not ask whether a member is enhanced, and does not assume it.
 */
export function resolveEnhancedRoomContext(room: EnhancedRoom, input: RoomContextInput): EnhancedRoomContext | null {
  const active = input.entries.filter((entry) => entry.isActive && !entry.pausedAt);
  const currentCycle = selectCurrentCycle([...input.cycles], input.now);
  if (active.length === 0 && !currentCycle) return null;

  const today = dateKeyOf(input.now);
  const entryNames = [...new Set(active.map(entryName))];

  /* ── Live: the logged entries, as Apex's Logbook already shows them ── */
  const live: LiveRoomContext | null =
    entryNames.length > 0
      ? {
          entryNames,
          statement: `${plural(entryNames.length, "entry", "entries")} active in your log`,
          routes: [COMPOUND_ROUTE],
          note: LIVE_NOTE,
        }
      : null;

  /* ── Gated: the cycle and safety system ── */
  const state = currentCycle
    ? resolveCycleState(currentCycle, {
        now: input.now,
        compounds: input.entries.map((entry) => ({
          id: entry.id,
          name: entryName(entry),
          isActive: entry.isActive,
          pausedAt: entry.pausedAt,
        })),
        labDates: input.labRecords.map((record) => record.testDate),
      })
    : null;

  const statement = state ? cycleStatement(state) : "No cycle dates recorded";
  const detail = state
    ? cycleDetail(state)
    : "Adding your own start date and planned weeks in Compound Command lets Reserve place your lab draws beside them.";

  const linkedFact: RoomFact | null = state
    ? {
        id: "linked",
        label: "Linked to this cycle",
        value: state.compounds.length > 0 ? state.compounds.map((c) => c.name).join(" · ") : "None linked",
      }
    : null;

  const overdue = state?.overdueCheckpoints ?? [];
  const overdueFact: RoomFact | null =
    overdue.length > 0
      ? {
          id: "overdue",
          label: "Checkpoints with no lab logged",
          value: overdue.map((c) => `${c.label} · ${formatDayFull(c.date)}`).join(" · "),
        }
      : null;

  const facts: RoomFact[] = [];
  let recentRedFlags: RedFlagKey[] = [];
  let flags: RoomLabFlag[] = [];
  let routes: RoomRoute[] = [];

  switch (room) {
    case "training":
    case "recovery": {
      if (linkedFact) facts.push(linkedFact);
      const symptoms = symptomFacts(input);
      facts.push(...symptoms.facts);
      recentRedFlags = symptoms.recentRedFlags;
      routes = room === "recovery" ? [SLEEP_ROUTE, SYMPTOM_ROUTE, COMPOUND_ROUTE] : [SYMPTOM_ROUTE, COMPOUND_ROUTE];
      break;
    }
    case "nutrition": {
      facts.push(checkpointFact(state));
      if (overdueFact) facts.push(overdueFact);
      facts.push(latestDrawFact(input.labRecords, today));
      flags = labFlags(input);
      routes = [BLOODWORK_ROUTE];
      break;
    }
    case "apex": {
      routes = [COMPOUND_ROUTE];
      break;
    }
  }

  const next = state?.nextCheckpoint;
  const apexGated = [statement, next ? `next lab checkpoint ${formatDayFull(next.date)}` : null].filter(Boolean).join(" · ");

  return {
    room,
    live,
    gated: {
      statement,
      detail,
      facts,
      labFlags: flags.slice(0, ROOM_LAB_FLAG_LIMIT),
      moreLabFlags: Math.max(0, flags.length - ROOM_LAB_FLAG_LIMIT),
      recentRedFlags,
      pastEndNotice: state?.stillActivePastEnd
        ? `${state.activePastEndNames.join(" · ")} ${state.activePastEndNames.length === 1 ? "is" : "are"} still marked active in your log, past the end date you entered. Worth getting reviewed.`
        : null,
      routes,
      note: room === "nutrition" ? LAB_NOTE : TIMING_NOTE,
    },
    apexLine: { gated: apexGated, live: live ? `${live.statement} · ${entryNames.join(" · ")}` : null },
  };
}

/** Every member-facing string a context can produce — for the banned-language suite. */
export function roomContextStrings(context: EnhancedRoomContext): string[] {
  const { live, gated, apexLine } = context;
  return [
    ...(live ? [live.statement, live.note, ...live.entryNames, ...live.routes.map((r) => r.label)] : []),
    gated.statement,
    ...(gated.detail ? [gated.detail] : []),
    ...gated.facts.flatMap((fact) => [fact.label, fact.value]),
    ...gated.labFlags.flatMap((flag) => [flag.marker, flag.reading, flag.range, flag.flag, flag.route]),
    ...(gated.pastEndNotice ? [gated.pastEndNotice] : []),
    ...gated.routes.map((r) => r.label),
    gated.note,
    apexLine.gated,
    ...(apexLine.live ? [apexLine.live] : []),
  ];
}
