/* ════════════════════════════════════════════════════════════════════════
   COMPOUND COMMAND — what the top of the screen says, which one action is
   gold, and where each of the old twelve tabs now lives.

   The first pass (PR #67) cut a twelve-tab strip to five places and moved
   eight tools under More. The owner still read the room as overloaded, and
   the 2026-09-17 audit says why: thirteen destinations, and the member's own
   three compounds listed over and over — Today, Registry, Schedule,
   Inventory, Injection Map and Labs / Review all drew the same entries in
   six different shapes.

   So the room is now shaped around the four questions a member actually
   arrives with:

     WHAT IS DUE NOW      Today
     WHAT AM I ON, AND
     WHAT IS COMING       Plan — the entries and their week in one place.
                          Everything about one compound (its schedule, what
                          is left, its sites, its markers) lives in that
                          compound's own sheet, not in a place of its own.
     WHAT SHOULD I RAISE  Cycle & Safety (review-pending, launch-switched)
     WHAT DID I LOG       More — the records and the reading

   STATEMENT   one line from the member's own log ("3 compounds tracked ·
               2 due now"), or what is missing ("Nothing tracked yet")
   READOUTS    two or three real values; a readout with nothing behind it
               is left out rather than shown as a zero. The cycle checkpoint
               is NOT one of them — the Cycle Brief sits directly beneath
               and already carries it, and one fact printed twice in one
               screen is the thing the audit kept finding.
   ONE ACTION  Log Next Due when something is due now, otherwise Add
               Compound
   NAVIGATION  three primary places plus More. Every old tab key still
               resolves, so a caller such as the Cycle Brief's
               `onOpen("labs")` lands where it always did.

   THE HARD WALL (CLAUDE.md · constitution clinical-data.md): tracking only.
   Nothing here names an amount, a time to use, or tells a member to start,
   stop or change anything. The fixed copy below is scanned by the
   banned-language suite in `__tests__/command-room.test.ts`, except the two
   shipped place names kept verbatim ("Dose Math", "Support Stack"), which
   are listed apart in `KEPT_PLACE_NAMES`.

   Pure: no React, no store.
   ════════════════════════════════════════════════════════════════════════ */

/* ─── Places ──────────────────────────────────────────────────────────── */

/** Every place in Compound Command. The twelve shipped tab keys are unchanged. */
export type CompoundTabKey =
  | "today"
  | "timeline"
  | "research"
  | "cycle"
  | "registry"
  | "schedule"
  | "dose-math"
  | "injection-map"
  | "inventory"
  | "support"
  | "labs"
  | "education"
  /** The member's compounds and their week, in one place. */
  | "plan"
  /** The records and the reading. */
  | "more";

export type CompoundPrimaryTab = "today" | "plan" | "cycle" | "more";

/** A place listed under More. */
export type CompoundToolKey = "labs" | "support" | "timeline" | "research" | "education";

/**
 * Shipped keys that now open inside Plan. Registry and Schedule became its
 * two views; Inventory, the Injection Map and Dose Math became parts of a
 * compound's own sheet, because every one of them was a second list of the
 * same entries.
 */
const PLAN_KEYS: readonly CompoundTabKey[] = ["plan", "registry", "schedule", "inventory", "injection-map", "dose-math"];

/**
 * Place names already shipped, kept verbatim because members, the Cycle
 * Brief and other screens know them by these names. Two of them contain
 * words the banned-language suite rejects in NEW copy ("Dose", "Stack");
 * they are names of places, not guidance, and are exempted by name only.
 */
export const KEPT_PLACE_NAMES = {
  today: "Today",
  plan: "Plan",
  cycle: "Cycle & Safety",
  "dose-math": "Dose Math",
  "injection-map": "Injection Map",
  inventory: "Inventory",
  support: "Support Stack",
  labs: "Labs / Review",
  timeline: "Timeline",
  research: "Research",
  education: "Education",
  registry: "Registry",
  schedule: "Schedule",
} as const satisfies Record<Exclude<CompoundTabKey, "more">, string>;

export const COMMAND_COPY = {
  more: "More",
  toolsHeading: "Tools & records",
  allTools: "All tools & records",
  navLabel: "Compound Command",
  eyebrow: "Your compound log · tracking only",
  nothingTracked: "Nothing tracked yet",
  freshSupport: "Add what you already use, and Reserve places each reminder around your day.",
  addCompound: "Add Compound",
  logNextDue: "Log Next Due",
  logged: (name: string, time: string) => `Logged ${name} at ${time}`,
  /** Plan's two views. */
  planCompounds: "Compounds",
  planWeek: "Week",
  planEmpty: "Nothing tracked yet. Add what you already use and it appears here on the days you set.",
  /** The one row under Plan's list that opens the converter. */
  doseMathLine: "Converts your own vial, concentration and syringe numbers.",
  /** The compound sheet. */
  sheetSchedule: "Schedule",
  sheetLeft: "What is left",
  sheetSites: "Sites you logged",
  sheetMarkers: "Markers to raise with a clinician",
} as const;

/** One line per place under More: what the member finds there, in their own terms. */
export const TOOL_LINES: Record<CompoundToolKey, string> = {
  labs: "Entries missing details, and markers to raise with a clinician.",
  support: "Your support plan, and the entries you linked together.",
  timeline: "How your log changed, with your own notes.",
  research: "Your labs and your log, placed side by side in time.",
  education: "What Reserve does with these records, and what it never does.",
};

/** The order places are listed under More. */
export const TOOL_ORDER: readonly CompoundToolKey[] = ["labs", "support", "timeline", "research", "education"];

const PRIMARY_ORDER: readonly CompoundPrimaryTab[] = ["today", "plan", "cycle", "more"];

export function isPrimaryTab(key: CompoundTabKey): key is CompoundPrimaryTab {
  return (PRIMARY_ORDER as readonly string[]).includes(key);
}

/** Which primary segment is selected while `key` is open. */
export function primaryTabFor(key: CompoundTabKey): CompoundPrimaryTab {
  if (PLAN_KEYS.includes(key)) return "plan";
  return isPrimaryTab(key) ? key : "more";
}

/**
 * The primary segments. Cycle & Safety is review-pending and follows the
 * launch switch exactly as the old tab strip did.
 */
export function primaryTabs(safetyToolsVisible: boolean): Array<{ key: CompoundPrimaryTab; label: string }> {
  return PRIMARY_ORDER.filter((key) => key !== "cycle" || safetyToolsVisible).map((key) => ({
    key,
    label: key === "more" ? COMMAND_COPY.more : KEPT_PLACE_NAMES[key],
  }));
}

/**
 * The place that actually opens for a requested key. A hidden Cycle & Safety
 * falls back to Today rather than rendering an empty place; everything that
 * used to be its own list of the member's entries opens Plan.
 */
export function resolvePlace(key: CompoundTabKey, safetyToolsVisible: boolean): CompoundTabKey {
  if (key === "cycle" && !safetyToolsVisible) return "today";
  return PLAN_KEYS.includes(key) ? "plan" : key;
}

export type PlanView = "compounds" | "week";

/** Which of Plan's two views a requested key wants. */
export function planViewFor(key: CompoundTabKey): PlanView {
  return key === "schedule" ? "week" : "compounds";
}

/** Whether a requested key should also open the converter sheet. */
export function opensDoseMath(key: CompoundTabKey): boolean {
  return key === "dose-math";
}

/**
 * What Support Stack opens on arrival. Two buttons elsewhere name a sheet
 * rather than the place — "Evidence for your cycle" in the Cycle Brief and
 * "Supplement library, A–Z" in the Field Manual — and landing on the room
 * with that sheet shut breaks the promise the button made. Nothing else
 * sets it, so the tab strip always lands on the room itself.
 */
export type SupportArrival = "evidence" | "library";

/* ─── The hero ────────────────────────────────────────────────────────── */

/** A scheduled item for today, reduced to what the hero needs. */
export type CommandSlot = {
  entryId: string;
  name: string;
  /** "HH:MM", or "—" when the member set no time. */
  plannedTime: string;
  plannedTimeLabel: string;
  injectable: boolean;
  /** Where the member shows this entry on Today (organisational only). */
  tier?: "hero" | "add-on";
};

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** Earliest planned time first; untimed items last, then by name. */
export function byPlannedTime<T extends Pick<CommandSlot, "plannedTime" | "name">>(a: T, b: T): number {
  const at = /^\d{2}:\d{2}$/.test(a.plannedTime) ? a.plannedTime : "99:99";
  const bt = /^\d{2}:\d{2}$/.test(b.plannedTime) ? b.plannedTime : "99:99";
  return at === bt ? a.name.localeCompare(b.name) : at.localeCompare(bt);
}

/**
 * The member's main compounds first, then their add-ons, each by planned
 * time. A tier is where the member chose to see an entry — never a measure of
 * importance — so a slot with no tier sorts by time alone.
 */
export function byTierThenTime<T extends Pick<CommandSlot, "plannedTime" | "name" | "tier">>(a: T, b: T): number {
  const at = a.tier === "add-on" ? 1 : 0;
  const bt = b.tier === "add-on" ? 1 : 0;
  return at === bt ? byPlannedTime(a, b) : at - bt;
}

/**
 * "3 compounds tracked · 2 due now", "1 compound tracked · nothing due now ·
 * 1 missed", or "Nothing tracked yet".
 *
 * "Tracked" counts the entries in the member's log. The readout beside it
 * counts what has been marked today. The audit found both wearing the word
 * "logged" in the same breath ("3 compounds logged" beside "Logged today 0
 * of 3"), which is two meanings of one word in one sentence.
 */
export function compoundStatement(input: {
  trackedCount: number;
  dueNow: number;
  missed: number;
  /**
   * When given, the log is counted in the member's own two tiers — main
   * compounds and add-ons — so "15 compounds tracked" reads "4 compounds ·
   * 11 add-ons" and the heroes don't get lost among the supplements.
   * `trackedCount` is the whole log either way.
   */
  addOnCount?: number;
}): string {
  if (input.trackedCount === 0) return COMMAND_COPY.nothingTracked;
  const due = input.dueNow > 0 ? `${input.dueNow} due now` : "nothing due now";
  const missed = input.missed > 0 ? ` · ${input.missed} missed` : "";
  if (input.addOnCount === undefined) {
    return `${plural(input.trackedCount, "compound", "compounds")} tracked · ${due}${missed}`;
  }
  const addOns = Math.min(Math.max(input.addOnCount, 0), input.trackedCount);
  const heroes = input.trackedCount - addOns;
  const tiers = [
    heroes > 0 ? plural(heroes, "compound", "compounds") : null,
    addOns > 0 ? plural(addOns, "add-on", "add-ons") : null,
  ].filter(Boolean).join(" · ");
  return `${tiers} · ${due}${missed}`;
}

export type CompoundPrimary =
  | { kind: "log-next-due"; label: string; slot: CommandSlot }
  | { kind: "add-compound"; label: string };

/**
 * Exactly one gold action. Something due now: log it (an injectable opens
 * its site log, which records the entry too). Nothing due: add a compound.
 * With several due, the member's main compounds come first (their own tier
 * choice), then the earliest time.
 */
export function compoundPrimaryAction(dueNow: readonly CommandSlot[]): CompoundPrimary {
  const next = [...dueNow].sort(byTierThenTime)[0];
  return next
    ? { kind: "log-next-due", label: COMMAND_COPY.logNextDue, slot: next }
    : { kind: "add-compound", label: COMMAND_COPY.addCompound };
}

export type CompoundReadout = { label: string; value: string; unit?: string; detail?: string };

/**
 * Two or three readouts from real entries. A readout with nothing behind it
 * is left out — never a zero standing in for a value. The cycle checkpoint
 * is deliberately absent: the Cycle Brief renders directly below the hero
 * and prints the same checkpoint in the member's own cycle sentence.
 */
export function compoundReadouts(input: {
  dueNow: readonly CommandSlot[];
  /** Scheduled later today and not yet logged. */
  laterToday: readonly CommandSlot[];
  /** Scheduled earlier today, still unmarked. */
  missed: readonly CommandSlot[];
  loggedToday: number;
  scheduledToday: number;
}): CompoundReadout[] {
  const reads: CompoundReadout[] = [];
  if (input.dueNow.length > 0) {
    const first = [...input.dueNow].sort(byTierThenTime)[0];
    const more = input.dueNow.length > 1 ? ` · ${input.dueNow.length - 1} more` : "";
    reads.push({ label: "Due now", value: String(input.dueNow.length), detail: `${first.name}${more}` });
  } else if (input.laterToday.length > 0) {
    const next = [...input.laterToday].sort(byTierThenTime)[0];
    reads.push({ label: "Next due", value: next.plannedTimeLabel, detail: next.name });
  }
  if (input.missed.length > 0) {
    const first = [...input.missed].sort(byPlannedTime)[0];
    const more = input.missed.length > 1 ? ` · ${input.missed.length - 1} more` : "";
    reads.push({ label: "Missed", value: String(input.missed.length), detail: `${first.name}${more}` });
  }
  if (input.scheduledToday > 0) {
    reads.push({ label: "Logged today", value: String(input.loggedToday), unit: `of ${input.scheduledToday}` });
  }
  return reads.slice(0, 3);
}

/** The line under the statement. Only a member with nothing tracked needs one. */
export function compoundSupport(trackedCount: number): string | undefined {
  return trackedCount === 0 ? COMMAND_COPY.freshSupport : undefined;
}

/* ─── Summary lines that replace metric strips ────────────────────────── */

/**
 * "2 due now · 1 missed · 14 in the next 7 days". Zero counts are left out;
 * with nothing at all it says so.
 */
export function countsLine(parts: ReadonlyArray<{ count: number; label: string }>, empty: string): string {
  const shown = parts.filter((part) => part.count > 0).map((part) => `${part.count} ${part.label}`);
  return shown.length > 0 ? shown.join(" · ") : empty;
}

/**
 * Plan's one line: "3 compounds · 16 scheduled in the next 7 days".
 *
 * Deliberately no due/missed counts. The hero above already says them, and
 * the old Schedule line read "1 due now · 1 missed · 16 in the next 7 days"
 * where the 16 already contained the other two — three numbers a member
 * could not add up.
 */
export function planLine(input: { trackedCount: number; scheduledNext7: number }): string {
  if (input.trackedCount === 0) return COMMAND_COPY.nothingTracked;
  const tracked = plural(input.trackedCount, "compound", "compounds");
  return input.scheduledNext7 > 0
    ? `${tracked} · ${input.scheduledNext7} scheduled in the next 7 days`
    : `${tracked} · nothing scheduled in the next 7 days`;
}
