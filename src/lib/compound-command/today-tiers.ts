/* ════════════════════════════════════════════════════════════════════════
   TODAY'S TWO TIERS — how Compound Command's Today lays out the member's own
   day: their main compounds up top, their add-ons in a quiet grid below.

   The owner, 2026-09-17: "I'd like to see the main compounds as the main hero
   of the compound section — I don't want it to get lost with the
   supplements. Separate my heroes from my add-ons."

   A tier is ORGANISATIONAL. It is where the member wants an entry to show on
   Today, nothing more: it never says one entry matters more, medically or
   otherwise, and nothing here ranks, recommends or comments on an entry.
   Inside a tier everything is ordered by the member's own planned time only.

   The default comes from the entry's own class and category (hormones,
   peptides, prescription-class entries lead; supplements, vitamins,
   nootropics and recovery items are add-ons). The member's own choice,
   stored on the entry as `todayTier`, always wins.

   Pure: no React, no store.
   ════════════════════════════════════════════════════════════════════════ */

export type TodayTier = "hero" | "add-on";

/** What the classifier reads from an entry. */
export type TierInput = {
  todayTier?: TodayTier;
  compoundClass?: string;
  category?: string;
  route?: string;
};

/** Classes that default to the add-on tier. Every other known class leads. */
const ADD_ON_CLASSES: ReadonlySet<string> = new Set(["supplements", "vitamins", "nootropics", "recovery"]);
const ADD_ON_CATEGORIES: ReadonlySet<string> = new Set(["supplement", "vitamin", "nootropic", "recovery"]);
const HERO_CATEGORIES: ReadonlySet<string> = new Set(["hormone", "peptide", "medication"]);

/**
 * The tier an entry shows under when the member has not chosen one.
 * Class first (the catalog's own key), then category; an entry that is
 * neither ("other" / "custom") leads when it is injectable, else it is an
 * add-on. The member can move any entry either way.
 */
export function defaultTodayTier(entry: TierInput): TodayTier {
  const cls = entry.compoundClass;
  if (cls && cls !== "other") return ADD_ON_CLASSES.has(cls) ? "add-on" : "hero";
  const category = entry.category ?? "";
  if (ADD_ON_CATEGORIES.has(category)) return "add-on";
  if (HERO_CATEGORIES.has(category)) return "hero";
  return entry.route === "injectable" ? "hero" : "add-on";
}

/** The member's choice, else the default. */
export function todayTierFor(entry: TierInput): TodayTier {
  return entry.todayTier === "hero" || entry.todayTier === "add-on" ? entry.todayTier : defaultTodayTier(entry);
}

/** The labels a member sees for the two tiers. Organisational words only. */
export const TIER_COPY = {
  hero: "Compounds",
  addOn: "Add-ons",
  heroHeading: "Your compounds today",
  addOnHeading: "Add-ons today",
  choiceLabel: "Show on Today under",
  upNext: "Up next",
  notToday: "Not today",
  siteNeeded: "Site log needed",
} as const;

/* ─── Time order ──────────────────────────────────────────────────────── */

export function minutesOf(plannedTime: string): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(plannedTime);
  if (!m) return null;
  const minutes = Number(m[1]) * 60 + Number(m[2]);
  return minutes >= 0 && minutes < 24 * 60 ? minutes : null;
}

/** Earliest planned time first, untimed last, then by name. Time is the only order. */
export function byTime<T extends { plannedTime: string; name: string }>(a: T, b: T): number {
  const am = minutesOf(a.plannedTime);
  const bm = minutesOf(b.plannedTime);
  const at = am === null ? Number.POSITIVE_INFINITY : am < 4 * 60 ? am + 24 * 60 : am;
  const bt = bm === null ? Number.POSITIVE_INFINITY : bm < 4 * 60 ? bm + 24 * 60 : bm;
  return at === bt ? a.name.localeCompare(b.name) : at - bt;
}

/** Split today's items into the two tiers, each ordered by time. */
export function splitByTier<T extends { plannedTime: string; name: string; tier: TodayTier }>(items: readonly T[]): { heroes: T[]; addOns: T[] } {
  const heroes = items.filter((item) => item.tier === "hero").sort(byTime);
  const addOns = items.filter((item) => item.tier === "add-on").sort(byTime);
  return { heroes, addOns };
}

/** Where a marker stands today. Display words are the canonical status set. */
export type MarkState = "logged" | "skipped" | "due" | "missed" | "upcoming" | "review" | "paused";

/** "7 of 11 logged", "7 of 11 logged · 1 skipped", or null with nothing scheduled. Skipped never counts as logged. */
export function progressLine(states: readonly MarkState[]): { logged: number; total: number; line: string } | null {
  if (states.length === 0) return null;
  const logged = states.filter((s) => s === "logged").length;
  const skipped = states.filter((s) => s === "skipped").length;
  const line = `${logged} of ${states.length} logged${skipped > 0 ? ` · ${skipped} skipped` : ""}`;
  return { logged, total: states.length, line };
}

/* ─── Dayparts: the add-on tier, one row per part of the day ─────────── */

export type Daypart = "morning" | "midday" | "evening" | "night" | "anytime";

export const DAYPART_LABELS: Record<Daypart, string> = {
  morning: "Morning",
  midday: "Midday",
  evening: "Evening",
  night: "Night",
  anytime: "No set time",
};

const DAYPART_ORDER: Daypart[] = ["morning", "midday", "evening", "night", "anytime"];

/** Morning 4:00–11:59, Midday 12:00–16:59, Evening 17:00–20:59, Night 21:00–3:59; untimed has its own row. */
export function daypartOf(plannedTime: string): Daypart {
  const m = minutesOf(plannedTime);
  if (m === null) return "anytime";
  if (m >= 4 * 60 && m < 12 * 60) return "morning";
  if (m >= 12 * 60 && m < 17 * 60) return "midday";
  if (m >= 17 * 60 && m < 21 * 60) return "evening";
  return "night";
}

export type DaypartGroup<T> = {
  daypart: Daypart;
  label: string;
  items: T[];
  logged: number;
  total: number;
  /** Every item logged or skipped: nothing left to mark. */
  settled: boolean;
  /** "4 of 4 logged", "1 of 2 logged · 1 skipped". */
  line: string;
};

/** The add-ons grouped by daypart, in day order, each in time order. Empty dayparts are left out. */
export function groupByDaypart<T extends { plannedTime: string; name: string; state: MarkState }>(items: readonly T[]): DaypartGroup<T>[] {
  return DAYPART_ORDER.flatMap((daypart) => {
    const inPart = items.filter((item) => daypartOf(item.plannedTime) === daypart).sort(byTime);
    if (inPart.length === 0) return [];
    const progress = progressLine(inPart.map((item) => item.state));
    return [{
      daypart,
      label: DAYPART_LABELS[daypart],
      items: inPart,
      logged: progress?.logged ?? 0,
      total: inPart.length,
      settled: inPart.every((item) => item.state === "logged" || item.state === "skipped"),
      line: progress?.line ?? "",
    }];
  });
}

/** The daypart shown open by default: the first with anything left to mark, else none. */
export function nextDaypart<T>(groups: readonly DaypartGroup<T>[]): Daypart | null {
  return groups.find((group) => !group.settled)?.daypart ?? null;
}
