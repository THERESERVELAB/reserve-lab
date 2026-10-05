"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, ChevronDown, Clock, ListTree, Pencil, Syringe } from "lucide-react";
import React, { useState } from "react";

import { ReserveBottomSheet, ReserveButton, ReserveSegmented } from "@/components/ui/reserve";
import type { EnhancementEntry } from "@/lib/athlete-store";
import {
  TIER_COPY,
  groupByDaypart,
  nextDaypart,
  progressLine,
  type Daypart,
  type DaypartGroup,
  type MarkState,
  type TodayTier,
} from "@/lib/compound-command/today-tiers";
import type { EmptyTodayRead } from "@/lib/compound-command/today-empty";
import { RESERVE, alpha } from "@/lib/design/tokens";
import { CALCULATION_ONLY_COPY } from "@/lib/enhancement/reconstitution";
import type { EnhancementScheduleSlot } from "@/lib/enhancement/schedule";
import { getStackStatus } from "@/lib/enhancement/status";
import { useAmbientMotion } from "@/lib/ui/use-ambient-motion";

/* ════════════════════════════════════════════════════════════════════════
   TODAY — the member's day as an instrument, not a list.

   TWO TIERS (owner, 2026-09-17: "Separate my heroes from my add-ons")
     HEROES   the member's main compounds, one instrument each, inside the
              room's hero where nothing below can push them down. The one
              the room's gold action logs is marked "Up next".
     ADD-ONS  one quiet panel under the Day Timeline (the one day track,
              owned by the cycle session): a progress ring, then one row per
              daypart (Morning / Midday / Evening / Night). The next daypart
              with anything left to mark is open; the rest read as one line
              ("4 of 4 logged") and open with one tap. Each entry is a small
              marker that changes state IN PLACE when logged.

   A tier is where the member chose to see an entry. Nothing here ranks,
   recommends or comments on an entry; inside a tier the only order is the
   member's own planned time. A compound mark stays a neutral "Logged".

   MOTION: logging lets one slow gold light pass across the marker at an
   even pace (1.6s, the Bible's floor for anything that glides) while its
   glyph settles into the logged state, and the progress ring eases
   forward. Reduced or paused motion: the state simply changes. Nothing
   plays on first render.
   ════════════════════════════════════════════════════════════════════════ */

export type TodaySlot = EnhancementScheduleSlot;

const GOLD = RESERVE.gold;
const GREEN = "#79e3b5";
const RED = "#ef7d55";
const AMBER = RESERVE.amber;
const EASE_OUT = [0.22, 1, 0.36, 1] as const;

/* Two shapes the whole tier shares, so grouping never becomes a drawn box:
   a rule that feathers out at both ends, and a heading in the reading face. */
const SECTION_RULE = "pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.09)_14%,rgba(255,255,255,0.09)_86%,transparent)]";
const SECTION_HEADING = "text-[13px] font-medium tracking-[0.01em] text-white/55";

export function entryName(entry: EnhancementEntry): string {
  return entry.displayName ?? entry.officialName ?? entry.name;
}

/** Where one of today's slots stands at `minutes` after midnight. */
export function markStateOf(slot: TodaySlot, minutes: number | null): MarkState {
  if (slot.status === "taken") return "logged";
  if (slot.status === "skipped") return "skipped";
  if (minutes === null) return "upcoming";
  const status = getStackStatus(slot, minutes).status;
  if (status === "due") return "due";
  if (status === "missed") return "missed";
  if (status === "review") return "review";
  if (status === "not-due") return "paused";
  return "upcoming";
}

/** The canonical status words, carried by text so colour is never alone. */
export const MARK_WORDS: Record<MarkState, string> = {
  logged: "Logged",
  skipped: "Skipped",
  due: "Due",
  missed: "Missed",
  upcoming: "Ready",
  review: "Review",
  paused: "Paused",
};

export const MARK_COLORS: Record<MarkState, string> = {
  logged: GREEN,
  skipped: "rgba(255,255,255,0.5)",
  due: GOLD,
  missed: RED,
  upcoming: "rgba(255,255,255,0.55)",
  review: AMBER,
  paused: "rgba(255,255,255,0.45)",
};

/* ─── Glyph + sweep ───────────────────────────────────────────────────── */

/**
 * THE MARK — one ring, in every state.
 *
 * The old set drew seven different shapes (dashes, bars, exclamation dots),
 * which read as a status legend rather than a control. A member scanning the
 * day should see one object repeated, and read its state from how full it is.
 * Ring empty — not yet. Ring filled with a check — logged. A gold centre —
 * this is the one asking. Everything else is the same ring, quieter.
 */
function Glyph({ state, size = 16 }: { state: MarkState; size?: number }) {
  const c = MARK_COLORS[state];
  const ring = state === "logged" ? alpha(GREEN, 0.85) : state === "due" ? c : state === "missed" ? alpha(RED, 0.75) : state === "review" ? alpha(AMBER, 0.7) : "rgba(255,255,255,0.3)";
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" className="shrink-0">
      <circle cx="8" cy="8" r="6.8" fill={state === "logged" ? alpha(GREEN, 0.18) : "none"} stroke={ring} strokeWidth={state === "logged" ? 1.2 : 1} />
      {state === "logged" && (
        <path d="M5 8.2 7.1 10.3 11 6.1" fill="none" stroke={GREEN} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      )}
      {state === "due" && <circle cx="8" cy="8" r="2.6" fill={c} />}
      {state === "missed" && <circle cx="8" cy="8" r="2.2" fill={alpha(RED, 0.8)} />}
      {state === "skipped" && <path d="M5.6 8h4.8" stroke="rgba(255,255,255,0.5)" strokeWidth="1.3" strokeLinecap="round" />}
      {state === "review" && <circle cx="8" cy="8" r="2.2" fill={alpha(AMBER, 0.75)} />}
      {state === "paused" && <path d="M6.7 6v4M9.3 6v4" stroke="rgba(255,255,255,0.45)" strokeWidth="1.1" strokeLinecap="round" />}
    </svg>
  );
}

/**
 * The mark as a control. One tap logs the entry where it sits — no sheet, no
 * second screen. An injectable opens the site log instead, because that is
 * where the site is recorded and the entry with it; the label says so rather
 * than pretending the tap did something it did not.
 */
export function MarkControl({
  state,
  name,
  injectable,
  onLog,
  size = 16,
}: {
  state: MarkState;
  name: string;
  injectable?: boolean;
  onLog: () => void;
  size?: number;
}) {
  const { sweep, animate } = useLogSweep(state);
  const done = state === "logged" || state === "skipped";
  const verb = done ? `${name} · ${MARK_WORDS[state]}` : injectable ? `Open ${name} to log the site` : `Log ${name}`;
  return (
    <button
      type="button"
      onClick={onLog}
      disabled={done}
      data-mark-control={state}
      aria-label={verb}
      title={done ? `${name} · ${MARK_WORDS[state]}` : undefined}
      className="relative -m-2 grid h-11 w-11 shrink-0 place-items-center rounded-full transition-colors duration-300 enabled:hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25 disabled:cursor-default"
    >
      <Sweep run={sweep} />
      {/* The state is already spoken twice — by this button's own name and by
          the row's group label — so it is not repeated in the text layer. */}
      <SettlingGlyph state={state} animate={animate} size={size} />
    </button>
  );
}

/**
 * Remembers the state a marker last showed and returns a counter that ticks
 * each time it turns "logged" while on screen with full motion. The first
 * render never counts, so nothing plays on arrival.
 */
export function useLogSweep(state: MarkState): { sweep: number; animate: boolean } {
  const motionMode = useAmbientMotion();
  const [seen, setSeen] = useState(state);
  const [sweep, setSweep] = useState(0);
  if (seen !== state) {
    setSeen(state);
    if (state === "logged" && motionMode === "full") setSweep((n) => n + 1);
  }
  return { sweep, animate: motionMode === "full" };
}

/** One slow gold light across the marker. Decorative, inert, clipped to the marker. */
export function Sweep({ run }: { run: number }) {
  if (run === 0) return null;
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]" data-log-sweep={run}>
      <motion.span
        key={run}
        className="absolute inset-y-0 left-0 w-[85%]"
        style={{ background: `linear-gradient(90deg, transparent, ${alpha(GOLD, 0.26)} 45%, ${alpha(RESERVE.amber, 0.34)} 55%, transparent)` }}
        initial={{ x: "-100%", opacity: 0 }}
        animate={{ x: "118%", opacity: [0, 1, 1, 0] }}
        transition={{ x: { duration: 1.6, ease: "linear" }, opacity: { duration: 1.6, times: [0, 0.25, 0.7, 1], ease: "easeInOut" } }}
      />
    </span>
  );
}

/** The glyph, settling from one state into the next. */
export function SettlingGlyph({ state, animate, size }: { state: MarkState; animate: boolean; size?: number }) {
  return (
    <span className="relative grid shrink-0 place-items-center">
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={state}
          className="grid place-items-center"
          initial={animate ? { opacity: 0, scale: 0.72 } : false}
          animate={{ opacity: 1, scale: 1 }}
          exit={animate ? { opacity: 0, scale: 0.9, transition: { duration: 0.18 } } : { opacity: 0, transition: { duration: 0 } }}
          /* The ring settles under the finger: a spring, starting at once. */
          transition={animate ? { type: "spring", stiffness: 420, damping: 26, mass: 0.7 } : { duration: 0 }}
        >
          <Glyph state={state} size={size} />
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/* ─── Heroes: the member's main compounds ─────────────────────────────── */

export type HeroItem =
  | { kind: "today"; slot: TodaySlot; state: MarkState; upNext: boolean; siteNeeded: boolean }
  | { kind: "off-day"; entry: EnhancementEntry; nextLabel: string; /** YYYY-MM-DD of the next scheduled day. */ nextDate?: string | null };

export function HeroCompounds({
  items,
  empty,
  onOpenSlot,
  onOpenEntry,
  onOpenPlan,
  onAdd,
  onLog,
}: {
  items: HeroItem[];
  /** Why there is nothing to show, when there is nothing to show. */
  empty?: EmptyTodayRead;
  onOpenSlot: (slot: TodaySlot) => void;
  onOpenEntry: (entryId: string) => void;
  onOpenPlan?: () => void;
  onAdd?: () => void;
  /** Marks the slot taken where it sits. Absent where only the sheet may log. */
  onLog?: (slot: TodaySlot) => void;
}) {
  /* An empty list says why. A section that simply vanishes reads as a broken app. */
  if (items.length === 0) {
    if (!empty) return null;
    return (
      <div data-today-tier="hero" data-compound="heroes" className="relative mt-5 pt-4 lg:mt-6" data-today-empty>
        <span aria-hidden="true" className={SECTION_RULE} />
        <p className={SECTION_HEADING}>{TIER_COPY.heroHeading}</p>
        <p className="mt-2 max-w-[52ch] text-[12.5px] leading-[1.55] text-white/60">{empty.line}</p>
        {empty.action === "add" && onAdd && (
          <div className="mt-2">
            <ReserveButton tier="secondary" size="sm" onClick={onAdd}>Add compound</ReserveButton>
          </div>
        )}
        {empty.action === "open-plan" && onOpenPlan && (
          <div className="mt-2">
            <ReserveButton tier="secondary" size="sm" onClick={onOpenPlan}>Open Plan</ReserveButton>
          </div>
        )}
      </div>
    );
  }
  return (
    <div data-today-tier="hero" data-compound="heroes" className="relative mt-5 pt-4 lg:mt-6">
      {/* Grouping by light: a rule that fades at both ends, never a drawn edge. */}
      <span aria-hidden="true" className={SECTION_RULE} />
      <p className={SECTION_HEADING}>{TIER_COPY.heroHeading}</p>
      <ul className={`mt-3 grid grid-cols-2 gap-2 ${items.length >= 4 ? "lg:grid-cols-4" : items.length === 3 ? "lg:grid-cols-3" : "lg:grid-cols-4"}`}>
        {items.map((item) =>
          item.kind === "today" ? (
            <li key={item.slot.id}>
              <HeroInstrument item={item} onOpen={() => onOpenSlot(item.slot)} onLog={onLog ? () => onLog(item.slot) : undefined} />
            </li>
          ) : (
            <li key={`off-${item.entry.id}`}>
              <OffDayInstrument entry={item.entry} nextLabel={item.nextLabel} onOpen={() => onOpenEntry(item.entry.id)} />
            </li>
          ),
        )}
      </ul>
    </div>
  );
}

function HeroInstrument({ item, onOpen, onLog }: { item: Extract<HeroItem, { kind: "today" }>; onOpen: () => void; onLog?: () => void }) {
  const { slot, state, upNext, siteNeeded } = item;
  const name = entryName(slot.entry);
  const quiet = state === "logged" || state === "skipped";
  const injectable = slot.entry.route === "injectable";
  return (
    <div
      data-today-entry="hero"
      data-compound-row="today-slot"
      data-state={state}
      data-up-next={upNext ? "true" : undefined}
      /* The row holds two controls — the mark and the details — so it is a named
         group rather than one button pretending to do both. */
      role="group"
      aria-label={[name, slot.plannedTimeLabel, slot.timingLabel, upNext ? TIER_COPY.upNext : MARK_WORDS[state], siteNeeded ? TIER_COPY.siteNeeded : null].filter(Boolean).join(" · ")}
      className="group relative flex min-h-[78px] w-full items-start gap-2.5 rounded-[16px] px-2 py-2.5 transition-colors duration-300 hover:bg-white/[0.022]"
    >
      {/* One tap logs it where it sits. A gold ring around the mark is the whole "up next" signal. */}
      <span className="relative mt-0.5 grid shrink-0 place-items-center rounded-full" style={upNext ? { boxShadow: `0 0 0 1px ${alpha(GOLD, 0.55)}` } : undefined}>
        <MarkControl state={state} name={name} injectable={injectable} size={18} onLog={() => (onLog ? onLog() : onOpen())} />
      </span>
      <button
        type="button"
        onClick={onOpen}
        className="min-w-0 flex-1 rounded-[12px] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
        aria-label={[name, slot.plannedTimeLabel, slot.timingLabel, upNext ? TIER_COPY.upNext : MARK_WORDS[state], siteNeeded ? TIER_COPY.siteNeeded : null].filter(Boolean).join(" · ")}
      >
        <span className={`line-clamp-2 block text-[15px] font-semibold leading-[1.25] transition-colors duration-500 ${quiet ? "text-white/55" : "text-[#f2eee6]"}`}>{name}</span>
        <span className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="tnum text-[12px] leading-tight text-white/45">{slot.plannedTimeLabel}</span>
          {/* Only the states that ask something carry a word. Logged and skipped read from the mark. */}
          {upNext ? (
            <span className="text-[12px] leading-tight" style={{ color: GOLD }}>{TIER_COPY.upNext}</span>
          ) : state === "missed" || state === "review" ? (
            <span className="text-[12px] leading-tight" style={{ color: MARK_COLORS[state] }}>{MARK_WORDS[state]}</span>
          ) : null}
        </span>
        {slot.timingLabel && slot.timingLabel !== "Set time" && (
          <span className="mt-0.5 block truncate text-[11px] leading-tight text-white/40" data-dose-rule>{slot.timingLabel}</span>
        )}
        {siteNeeded && (
          <span className="mt-1 inline-flex items-center gap-1 text-[11px] leading-none" style={{ color: AMBER }}>
            <Syringe size={11} aria-hidden="true" />
            {TIER_COPY.siteNeeded}
          </span>
        )}
      </button>
    </div>
  );
}

function OffDayInstrument({ entry, nextLabel, onOpen }: { entry: EnhancementEntry; nextLabel: string; onOpen: () => void }) {
  const name = entryName(entry);
  return (
    <button
      type="button"
      onClick={onOpen}
      data-today-entry="off-day"
      aria-label={`${name} · ${TIER_COPY.notToday} · ${nextLabel}`}
      className="relative flex min-h-[78px] w-full flex-col justify-end gap-1 rounded-[16px] px-2 py-2.5 text-left transition-colors duration-300 hover:bg-white/[0.022]"
    >
      <span className="line-clamp-2 text-[15px] font-semibold leading-[1.25] text-white/50">{name}</span>
      <span className="flex flex-wrap items-baseline gap-x-2 text-[12px] leading-tight text-white/38">
        <span>{TIER_COPY.notToday}</span>
        <span className="tnum truncate">{nextLabel}</span>
      </span>
    </button>
  );
}

/* ─── Add-ons: one quiet grid under the day track ─────────────────────── */

export type RailItem = { slot: TodaySlot; name: string; plannedTime: string; state: MarkState; upNext: boolean };

/**
 * The add-on tier. The day itself — every entry placed by time, with wake,
 * training and lights out around it — is the Day Timeline above; this is not
 * a second timeline. One progress ring, then one row per daypart: the next
 * daypart with anything left to mark is open, the rest read as one line and
 * open with a tap. Markers change state where they sit.
 *
 * Which daypart opens is settled once, when the add-ons first arrive, so a
 * log never folds a row shut under the member's finger. A daypart holding
 * the entry marked Up next is always open.
 */
export function AddOnGrid({ items, onOpenSlot, onLog }: { items: RailItem[]; onOpenSlot: (slot: TodaySlot) => void; onLog?: (slot: TodaySlot) => void }) {
  const progress = progressLine(items.map((item) => item.state));
  const groups = groupByDaypart(items);
  const [defaultOpen, setDefaultOpen] = useState<Daypart | null | undefined>(undefined);
  if (defaultOpen === undefined && items.length > 0) setDefaultOpen(nextDaypart(groups));
  const [toggled, setToggled] = useState<Partial<Record<Daypart, boolean>>>({});
  const isOpen = (group: DaypartGroup<RailItem>) =>
    group.items.some((item) => item.upNext) || (toggled[group.daypart] ?? group.daypart === (defaultOpen ?? nextDaypart(groups)));
  return (
    <div data-today-tier="add-on">
      {progress && (
        <div className="flex items-center gap-3.5" data-compound="today-progress">
          <ProgressRing logged={progress.logged} total={progress.total} />
          <p className="tnum text-[14px] leading-snug text-white/75" aria-live="polite">
            {progress.line}
          </p>
        </div>
      )}
      {/* Dayparts separate with spacing and one feathered rule each — no table lines. */}
      <div aria-label={TIER_COPY.addOnHeading} role="group" data-compound="add-on-grid" className="mt-3 flex flex-col gap-0.5">
        {groups.map((group) => (
          <DaypartRow
            key={group.daypart}
            group={group}
            open={isOpen(group)}
            onToggle={() => setToggled((t) => ({ ...t, [group.daypart]: !isOpen(group) }))}
            onOpenSlot={onOpenSlot}
            onLog={onLog}
          />
        ))}
      </div>
    </div>
  );
}

/** One daypart: a one-line header that opens and closes it, and its markers when open. */
function DaypartRow({
  group,
  open,
  onToggle,
  onOpenSlot,
  onLog,
}: {
  group: DaypartGroup<RailItem>;
  open: boolean;
  onToggle: () => void;
  onOpenSlot: (slot: TodaySlot) => void;
  onLog?: (slot: TodaySlot) => void;
}) {
  const motionMode = useAmbientMotion();
  const animate = motionMode === "full";
  const listId = `add-on-${group.daypart}`;
  return (
    <section className="relative pt-0.5" data-daypart={group.daypart} data-open={open ? "true" : "false"} data-settled={group.settled ? "true" : "false"}>
      <span aria-hidden="true" className={SECTION_RULE} />
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={onToggle}
        className="flex min-h-[44px] w-full items-center gap-3 rounded-[12px] px-2 text-left transition-colors duration-300 hover:bg-white/[0.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
      >
        <span className={`w-[72px] shrink-0 text-[13px] font-medium ${group.settled ? "text-white/45" : "text-white/70"}`}>{group.label}</span>
        <span className={`tnum min-w-0 flex-1 truncate text-[12.5px] ${group.settled ? "text-white/40" : "text-white/55"}`} data-daypart-line>
          {group.line}
        </span>
        <ChevronDown
          size={14}
          aria-hidden="true"
          className={`shrink-0 text-white/40 ${animate ? "transition-transform duration-300" : ""} ${open ? "rotate-180" : ""}`}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.ul
            id={listId}
            key="list"
            aria-label={group.label}
            className="grid grid-cols-2 gap-x-2 gap-y-0 pb-1 2xl:grid-cols-3"
            initial={animate ? { opacity: 0, y: -4 } : false}
            animate={{ opacity: 1, y: 0 }}
            exit={animate ? { opacity: 0, transition: { duration: 0.15 } } : { opacity: 0, transition: { duration: 0 } }}
            transition={{ duration: animate ? 0.28 : 0, ease: EASE_OUT }}
          >
            {group.items.map((item) => (
              <li key={item.slot.id} className="min-w-0">
                <DayMarker item={item} onOpen={() => onOpenSlot(item.slot)} onLog={onLog ? () => onLog(item.slot) : undefined} />
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </section>
  );
}

function DayMarker({ item, onOpen, onLog }: { item: RailItem; onOpen: () => void; onLog?: () => void }) {
  const { state, upNext, name, slot } = item;
  const quiet = state === "logged" || state === "skipped";
  const injectable = slot.entry.route === "injectable";
  return (
    <div
      data-today-entry="add-on"
      data-compound-row="today-slot"
      data-state={state}
      data-up-next={upNext ? "true" : undefined}
      role="group"
      aria-label={[name, slot.plannedTimeLabel, slot.timingLabel, upNext ? TIER_COPY.upNext : MARK_WORDS[state]].filter(Boolean).join(" · ")}
      className="group relative flex min-h-[46px] w-full items-center gap-1.5 rounded-[12px] px-1.5 transition-colors duration-300 hover:bg-white/[0.022]"
    >
      <span className="relative grid shrink-0 place-items-center rounded-full" style={upNext ? { boxShadow: `0 0 0 1px ${alpha(GOLD, 0.5)}` } : undefined}>
        <MarkControl state={state} name={name} injectable={injectable} onLog={() => (onLog ? onLog() : onOpen())} />
      </span>
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 flex-col justify-center rounded-[10px] py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 sm:flex-row sm:items-baseline sm:gap-2"
        aria-label={[name, slot.plannedTimeLabel, slot.timingLabel, upNext ? TIER_COPY.upNext : MARK_WORDS[state]].filter(Boolean).join(" · ")}
      >
        <span className={`min-w-0 flex-1 truncate text-[13.5px] font-medium leading-tight transition-colors duration-500 ${quiet ? "text-white/50" : "text-[#f2eee6]"}`}>{name}</span>
        {/* Time and word share one line, so a word arriving or leaving never
            changes the row's height — the panel cannot jump under a finger. */}
        <span className="flex shrink-0 items-baseline gap-1.5 leading-tight">
          <span className="tnum text-[11.5px] leading-tight text-white/40">{slot.plannedTimeLabel}</span>
          {upNext ? (
            <span className="text-[11.5px] leading-tight" style={{ color: GOLD }}>{TIER_COPY.upNext}</span>
          ) : state === "missed" || state === "review" ? (
            <span className="text-[11.5px] leading-tight" style={{ color: MARK_COLORS[state] }}>{MARK_WORDS[state]}</span>
          ) : null}
        </span>
      </button>
    </div>
  );
}

/** Logged over scheduled, as an arc. The arc eases forward on a log; reduced motion jumps. */
function ProgressRing({ logged, total }: { logged: number; total: number }) {
  const motionMode = useAmbientMotion();
  const r = 20;
  const fraction = total > 0 ? logged / total : 0;
  return (
    <span className="relative grid h-[48px] w-[48px] shrink-0 place-items-center" role="img" aria-label={`${logged} of ${total} logged`}>
      <svg width="48" height="48" viewBox="0 0 48 48" aria-hidden="true" className="absolute inset-0 -rotate-90">
        <circle cx="24" cy="24" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2" />
        <motion.circle
          cx="24"
          cy="24"
          r={r}
          fill="none"
          stroke={GOLD}
          strokeOpacity={0.85}
          strokeWidth="2"
          strokeLinecap="round"
          initial={false}
          animate={{ pathLength: fraction, opacity: fraction > 0 ? 1 : 0 }}
          transition={{ duration: motionMode === "full" ? 1.2 : 0, ease: EASE_OUT, delay: motionMode === "full" ? 0.3 : 0 }}
        />
      </svg>
      <span className="tnum relative text-[15px] font-semibold leading-none text-[#f2eee6]" aria-hidden="true">
        {logged}
        <span className="text-[11px] font-normal text-white/45">/{total}</span>
      </span>
    </span>
  );
}

/* ─── The sheet a marker opens ────────────────────────────────────────── */

export function TodaySlotSheet({
  slot,
  state,
  classLabel,
  planned,
  siteLoggedToday,
  tier,
  onClose,
  onMark,
  onSiteLog,
  onEdit,
  onDetails,
  onGiveTime,
  onTier,
}: {
  slot: TodaySlot | null;
  state: MarkState | null;
  classLabel?: string | null;
  /** The member's own planned amount, as they entered it. */
  planned?: string | null;
  siteLoggedToday: boolean;
  tier: TodayTier;
  onClose: () => void;
  onMark: (status: "taken" | "skipped") => void;
  onSiteLog: () => void;
  /** Absent where the editor cannot open (Apex, with Compound Command locked): the button is left out, never dead. */
  onEdit?: () => void;
  onDetails?: () => void;
  /** Offered for a slot with no time: the one question that puts it in the day. */
  onGiveTime?: () => void;
  onTier: (tier: TodayTier) => void;
}) {
  const entry = slot?.entry;
  const injectable = entry?.route === "injectable";
  const done = state === "logged" || state === "skipped";
  return (
    <ReserveBottomSheet
      open={Boolean(slot)}
      onClose={onClose}
      title={entry ? entryName(entry) : "Today"}
      accent={RESERVE.steel}
      footer={
        slot && (
          <div className="flex flex-wrap items-center gap-2">
            {/* An entry with no time never lands on a day. One question fixes it. */}
            {onGiveTime && slot.plannedTime === "—" && (
              <ReserveButton tier="secondary" size="sm" accent={RESERVE.steel} icon={Clock} onClick={onGiveTime}>
                Set a time
              </ReserveButton>
            )}
            {!done && (
              <ReserveButton
                tier="secondary"
                size="sm"
                accent={GREEN}
                icon={injectable ? Syringe : CheckCircle2}
                onClick={() => (injectable ? onSiteLog() : onMark("taken"))}
              >
                Log Taken
              </ReserveButton>
            )}
            {!done && (
              <ReserveButton tier="quiet" size="sm" onClick={() => onMark("skipped")}>
                Skip
              </ReserveButton>
            )}
            {injectable && state === "logged" && !siteLoggedToday && (
              <ReserveButton tier="quiet" size="sm" icon={Syringe} onClick={onSiteLog}>
                Add Site Log
              </ReserveButton>
            )}
            {onEdit && (
              <ReserveButton tier="quiet" size="sm" icon={Pencil} onClick={onEdit}>
                Edit entry
              </ReserveButton>
            )}
          </div>
        )
      }
    >
      {slot && entry && state && (
        <div className="flex flex-col gap-4" data-compound="today-sheet" data-state={state}>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[10px] uppercase tracking-[0.18em] text-white/55">
            <Glyph state={state} size={13} />
            <span style={{ color: MARK_COLORS[state] }}>{MARK_WORDS[state]}</span>
            <span>· {slot.plannedTimeLabel}</span>
            {classLabel ? <span>· {classLabel}</span> : null}
          </p>
          {slot.adherence?.actualTime && state === "logged" && (
            <p className="text-[13px] text-white/65">Logged at {slot.adherence.actualTime}.</p>
          )}
          {planned && (
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/45">Planned · member entered</p>
              <p className="tnum mt-1 text-[15px] font-semibold text-[#f2eee6]">{planned}</p>
              <p className="mt-1 text-[11px] leading-[1.5] text-white/40">{CALCULATION_ONLY_COPY}</p>
            </div>
          )}
          {injectable && (
            <p className="text-[12.5px] leading-[1.5]" style={{ color: siteLoggedToday ? "rgba(255,255,255,0.6)" : AMBER }}>
              {siteLoggedToday ? "Site logged today." : state === "logged" ? "Site log needed." : "Log Taken opens the site log, which records this entry too."}
            </p>
          )}
          <div className="flex flex-wrap items-end justify-between gap-3">
            <TierChoice tier={tier} onTier={onTier} />
            {/* Everything else about this entry — schedule, what is left, sites, markers, Dose Math — is in its own sheet. */}
            {onDetails && (
              <ReserveButton tier="quiet" size="sm" icon={ListTree} onClick={onDetails}>
                All details
              </ReserveButton>
            )}
          </div>
        </div>
      )}
    </ReserveBottomSheet>
  );
}

/** The member's own choice of tier. Organisational only. */
export function TierChoice({ tier, onTier }: { tier: TodayTier; onTier: (tier: TodayTier) => void }) {
  return (
    <div data-compound="tier-choice">
      <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.2em] text-white/45">{TIER_COPY.choiceLabel}</p>
      <ReserveSegmented<TodayTier>
        label={TIER_COPY.choiceLabel}
        value={tier}
        onChange={onTier}
        accent={RESERVE.steel}
        size="sm"
        segments={[
          { value: "hero", label: TIER_COPY.hero },
          { value: "add-on", label: TIER_COPY.addOn },
        ]}
      />
    </div>
  );
}
