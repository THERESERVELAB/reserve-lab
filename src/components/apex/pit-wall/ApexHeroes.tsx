"use client";

import { AnimatePresence } from "framer-motion";
import { Pencil, Syringe } from "lucide-react";
import { Suspense, lazy, useCallback, useId, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { useSafetyToolsVisible } from "@/components/authz/CapabilitiesProvider";
import {
  MARK_COLORS,
  SettlingGlyph,
  Sweep,
  TodaySlotSheet,
  entryName,
  useLogSweep,
  type TodaySlot,
} from "@/components/enhancement/command/TodayDay";
import { useCompoundToday } from "@/components/enhancement/command/useCompoundToday";
import { ReserveBottomSheet, ReserveButton } from "@/components/ui/reserve";
import { canAccessView } from "@/lib/apex/source-to-view";
import { useAthleteDashboardStore, type EnhancementEntry } from "@/lib/athlete-store";
import { APEX_HERO_COPY, CYCLE_START_COPY, apexCycleLine, apexHeroTiles, type ApexHeroSource, type ApexHeroTile } from "@/lib/compound-command/apex-heroes";
import { isDateKey } from "@/lib/cycle/cycle-period";
import { requestCompoundEntry } from "@/lib/compound-command/open-request";
import { formatPlannedExecution } from "@/lib/compound-command/planned-execution";
import { todayTierFor, type TodayTier } from "@/lib/compound-command/today-tiers";
import { localDateKey } from "@/lib/dates/local-day";
import { RESERVE, alpha } from "@/lib/design/tokens";
import { classLabelFor } from "@/lib/enhancement/catalog";
import { safetyAccess } from "@/lib/safety/acknowledgement";

/* The site log lives with Compound Command; Apex loads it only when an injectable is logged here. */
const InjectionLogModal = lazy(() => import("@/components/views/CompoundCommandView").then((m) => ({ default: m.InjectionLogModal })));

/* ════════════════════════════════════════════════════════════════════════
   YOUR COMPOUNDS — the member's main compounds on Apex.

   Owner, 2026-09-18: "That is the root to all roads — the hero compounds.
   The system should know I'm on week 1 and when week 1 started as well."

   A compact row under today's scores, not a panel: each main compound a
   small named tile carrying Compound Command's own state word and the
   member's own time (Due 4:00 PM, Logged, Next Fri). The tiles come from
   the one hook Compound Command's Today reads (`useCompoundToday`), so both
   rooms always agree. Add-ons never appear here. With no main compound
   logged, nothing renders.

   A tile opens that entry's own Today sheet — the same sheet, the same store
   action, the same neutral "Logged" moment. Edit and full details land in
   Compound Command with the entry already open.

   THE CYCLE LINE follows the gate the rest of Apex's cycle content follows
   (EnhancedRoomContext): the launch switch AND a current safety
   acknowledgement, 18+ included. It states the cycle exactly as the member
   set it — "Week 1 of 12 · started Sep 16", or "Starts Sep 22 · in 4 days".
   Owner, 2026-09-18: "CLIENT CHOOSES WHEN IT STARTS!" Reserve never infers
   or proposes a start from compound dates or logs. "Edit start" opens a date
   field; the member picks any date, and it saves through the cycle's own
   `updateCyclePeriod` store action, recorded in the change history like
   every other cycle edit.

   No amounts here (they stay inside the entry sheet), no ranking, no gold
   fill: "Up next" wears Compound Command's gold outline only.
   ════════════════════════════════════════════════════════════════════════ */

const GOLD = RESERVE.gold;
const AMBER = RESERVE.amber;
const EMPTY_CYCLES: never[] = [];

export function ApexHeroes({ now }: { now: Date | null }) {
  const compoundDay = useCompoundToday(now);
  const { heroItems, read, siteLoggedToday, markSlot, slots } = compoundDay;
  const visible = useSafetyToolsVisible();
  const acknowledgement = useAthleteDashboardStore((s) => s.safetyAcknowledgement);
  const profileAge = useAthleteDashboardStore((s) => s.setupProfile.age);
  const cycles = useAthleteDashboardStore((s) => s.cyclePeriods) ?? EMPTY_CYCLES;
  const updateCyclePeriod = useAthleteDashboardStore((s) => s.updateCyclePeriod);
  const updateEnhancementEntry = useAthleteDashboardStore((s) => s.updateEnhancementEntry);
  const setActiveView = useAthleteDashboardStore((s) => s.setActiveView);
  const tier = useAthleteDashboardStore((s) => s.subscriptionTier);
  const canOpenCommand = canAccessView(tier, "supplements");

  const [openSlotId, setOpenSlotId] = useState<string | null>(null);
  const [siteLogFor, setSiteLogFor] = useState<EnhancementEntry | null>(null);
  const closeSheet = useCallback(() => setOpenSlotId(null), []);
  const closeSiteLog = useCallback(() => setSiteLogFor(null), []);
  /* The dose the site log records, for an entry with several dose times. */
  const [siteLogPlannedTime, setSiteLogPlannedTime] = useState<string | undefined>(undefined);

  const todayKey = now ? localDateKey(now) : null;
  const tiles = useMemo(() => {
    if (!todayKey) return [];
    const sources = heroItems.map((item): ApexHeroSource =>
      item.kind === "today"
        ? {
            kind: "today",
            slotId: item.slot.id,
            entryId: item.slot.entryId,
            name: entryName(item.slot.entry),
            tier: todayTierFor(item.slot.entry),
            plannedTime: item.slot.plannedTime,
            plannedTimeLabel: item.slot.plannedTimeLabel,
            state: item.state,
            upNext: item.upNext,
            siteNeeded: item.siteNeeded,
          }
        : { kind: "off-day", entryId: item.entry.id, name: entryName(item.entry), tier: todayTierFor(item.entry), nextDate: item.nextDate ?? null },
    );
    return apexHeroTiles(sources, todayKey);
  }, [heroItems, todayKey]);

  const showCycle = visible && safetyAccess(acknowledgement, profileAge) === "open";
  const cycleLine = useMemo(() => (now && showCycle ? apexCycleLine({ cycles, now }) : null), [now, showCycle, cycles]);
  const [editingStart, setEditingStart] = useState(false);
  const closeStart = useCallback(() => setEditingStart(false), []);

  const openSlot = openSlotId ? (slots.find((slot) => slot.id === openSlotId) ?? null) : null;
  const openInCommand = useCallback(
    (entryId: string, mode: "details" | "edit") => {
      requestCompoundEntry({ entryId, mode });
      setActiveView("supplements");
    },
    [setActiveView],
  );
  const setTier = useCallback((id: string, todayTier: TodayTier) => updateEnhancementEntry(id, { todayTier }), [updateEnhancementEntry]);

  if (!now || tiles.length === 0) return null;

  const openTile = (tile: ApexHeroTile) => {
    if (tile.slotId) setOpenSlotId(tile.slotId);
    else if (canOpenCommand) openInCommand(tile.entryId, "details");
  };

  return (
    <section aria-label={APEX_HERO_COPY.heading} data-apex="heroes" className="min-w-0">
      {/* The heading and, behind the safety gate, the cycle by the date the member set — with their own control to change it. */}
      <div className="flex min-h-[20px] items-center justify-between gap-x-3">
        <div className="min-w-0">
          <p aria-hidden="true" className="font-mono text-[9px] uppercase tracking-[0.22em] text-white/55">
            {APEX_HERO_COPY.heading}
          </p>
          {cycleLine && (
            <p data-apex="cycle-line" data-cycle-kind={cycleLine.kind} className="tnum mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-white/75">
              {cycleLine.line}
            </p>
          )}
        </div>
        {cycleLine && (
          <ReserveButton tier="quiet" size="sm" accent={RESERVE.steel} icon={Pencil} className="-mr-3 shrink-0" onClick={() => setEditingStart(true)}>
            {CYCLE_START_COPY.edit}
          </ReserveButton>
        )}
      </div>

      <ul
        className="mt-2 grid gap-2"
        style={{ gridTemplateColumns: `repeat(${tiles.length === 4 ? 2 : Math.min(tiles.length, 3)}, minmax(0, 1fr))` }}
      >
        {tiles.map((tile) => (
          <li key={tile.key} className="min-w-0">
            <HeroTile tile={tile} interactive={Boolean(tile.slotId) || canOpenCommand} onOpen={() => openTile(tile)} />
          </li>
        ))}
      </ul>

      <TodaySlotSheet
        slot={openSlot}
        state={openSlot ? (read.states.get(openSlot.id) ?? "upcoming") : null}
        classLabel={openSlot ? classLabelFor(openSlot.entry.compoundClass) : null}
        planned={openSlot ? formatPlannedExecution(openSlot.entry) : null}
        siteLoggedToday={openSlot ? siteLoggedToday(openSlot.entryId) : false}
        tier={openSlot ? todayTierFor(openSlot.entry) : "hero"}
        onClose={closeSheet}
        onMark={(status) => {
          if (openSlot) markSlot(openSlot as TodaySlot, status);
          setOpenSlotId(null);
        }}
        onSiteLog={() => {
          if (openSlot) { setSiteLogPlannedTime(openSlot.plannedTime); setSiteLogFor(openSlot.entry); }
          setOpenSlotId(null);
        }}
        onEdit={canOpenCommand ? () => { if (openSlot) openInCommand(openSlot.entryId, "edit"); setOpenSlotId(null); } : undefined}
        onDetails={canOpenCommand ? () => { if (openSlot) openInCommand(openSlot.entryId, "details"); setOpenSlotId(null); } : undefined}
        onTier={(next) => { if (openSlot) setTier(openSlot.entryId, next); }}
      />

      {cycleLine && (
        <CycleStartSheet
          open={editingStart}
          startDate={cycleLine.startDate}
          onClose={closeStart}
          onSave={(startDate) => {
            updateCyclePeriod(cycleLine.cycleId, { startDate });
            setEditingStart(false);
          }}
        />
      )}

      {typeof document !== "undefined" &&
        createPortal(
          <Suspense fallback={null}>
            <AnimatePresence>{siteLogFor && <InjectionLogModal key={siteLogFor.id} entry={siteLogFor} plannedTime={siteLogPlannedTime} onClose={closeSiteLog} />}</AnimatePresence>
          </Suspense>,
          document.body,
        )}
    </section>
  );
}

function HeroTile({ tile, interactive, onOpen }: { tile: ApexHeroTile; interactive: boolean; onOpen: () => void }) {
  const markState = tile.state === "not-today" ? "upcoming" : tile.state;
  const { sweep, animate } = useLogSweep(markState);
  const quiet = tile.state === "logged" || tile.state === "skipped" || tile.state === "not-today";
  const color = tile.upNext ? GOLD : tile.state === "not-today" ? "rgba(255,255,255,0.5)" : MARK_COLORS[tile.state];
  const className =
    "relative flex min-h-[52px] w-full flex-col justify-between gap-1 overflow-hidden rounded-[14px] border px-2 py-1.5 text-left transition-colors duration-300";
  const style = {
    borderColor: tile.upNext ? alpha(GOLD, 0.5) : tile.state === "not-today" ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.07)",
    background: tile.upNext ? `radial-gradient(120% 140% at 0% 0%, ${alpha(GOLD, 0.07)}, transparent 60%)` : "rgba(255,255,255,0.012)",
  };
  const body = (
    <>
      <Sweep run={sweep} />
      <span lang="en" className={`relative line-clamp-2 text-[12px] font-semibold leading-[1.2] [hyphens:auto] [overflow-wrap:break-word] ${quiet ? "text-white/60" : "text-[#f2eee6]"}`}>
        {tile.name}
      </span>
      <span className="relative flex min-w-0 items-center gap-1">
        {tile.state !== "not-today" && <SettlingGlyph state={markState} animate={animate} size={11} />}
        {/* "Due 4:00 PM" · "Next Fri": word and time as two runs, so a ~90px tile never truncates the time. */}
        <span className="tnum flex min-w-0 items-baseline gap-1 whitespace-nowrap font-mono text-[9px] uppercase tracking-[0.06em]" style={{ color }}>
          <span>{tile.word}</span>
          {tile.when && <span className="truncate">{tile.when}</span>}
        </span>
        {tile.siteNeeded && <Syringe size={10} aria-hidden="true" className="shrink-0" style={{ color: AMBER }} />}
      </span>
    </>
  );
  const data = {
    "data-apex-hero": tile.kind,
    "data-entry-id": tile.entryId,
    "data-state": tile.state,
    "data-up-next": tile.upNext ? "true" : undefined,
  };
  if (!interactive) {
    return (
      <span {...data} aria-label={tile.label} role="group" className={className} style={style}>
        {body}
      </span>
    );
  }
  return (
    <button type="button" {...data} aria-label={tile.label} onClick={onOpen} className={`${className} hover:bg-white/[0.035]`} style={style}>
      {body}
    </button>
  );
}

/** The member's own cycle start, as a date field. Any date, past or future; nothing is proposed. */
function CycleStartSheet({ open, startDate, onClose, onSave }: { open: boolean; startDate: string; onClose: () => void; onSave: (startDate: string) => void }) {
  const [value, setValue] = useState(startDate);
  const [seen, setSeen] = useState({ open, startDate });
  /* Each opening starts from the date currently on the cycle. */
  if (seen.open !== open || seen.startDate !== startDate) {
    setSeen({ open, startDate });
    if (open) setValue(startDate);
  }
  const id = useId();
  const valid = isDateKey(value);
  return (
    <ReserveBottomSheet open={open} onClose={onClose} title={CYCLE_START_COPY.sheetTitle} accent={RESERVE.steel} dirty={open && value !== startDate}>
      <form
        data-apex="cycle-start-form"
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (valid) onSave(value);
        }}
      >
        <p className="text-[12.5px] leading-[1.55] text-white/60">{CYCLE_START_COPY.explainer}</p>
        <label htmlFor={id} className="block text-[11.5px] text-white/55">
          {CYCLE_START_COPY.field}
          <input
            id={id}
            type="date"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            className="mt-1 min-h-[44px] w-full rounded-[12px] border border-white/[0.08] bg-black/30 px-3 text-[16px] text-[#f2eee6] outline-none focus:border-[#5fb7d5]/60 sm:text-[13px]"
          />
        </label>
        {!valid && (
          <p role="alert" className="text-[12.5px]" style={{ color: RESERVE.red }}>
            {CYCLE_START_COPY.invalid}
          </p>
        )}
        <div>
          {valid ? (
            <ReserveButton tier="secondary" type="submit" accent={RESERVE.steel}>
              {CYCLE_START_COPY.save}
            </ReserveButton>
          ) : (
            <ReserveButton tier="secondary" type="submit" accent={RESERVE.steel} disabled disabledReason={CYCLE_START_COPY.invalid}>
              {CYCLE_START_COPY.save}
            </ReserveButton>
          )}
        </div>
      </form>
    </ReserveBottomSheet>
  );
}
