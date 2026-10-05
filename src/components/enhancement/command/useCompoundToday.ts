"use client";

import { useCallback, useMemo } from "react";

import { markCompoundLogged } from "@/components/ui/reserve/log-moment/recorders";
import { useAthleteDashboardStore } from "@/lib/athlete-store";
import { byPlannedTime, compoundPrimaryAction, type CommandSlot } from "@/lib/compound-command/command-room";
import { splitByTier, todayTierFor } from "@/lib/compound-command/today-tiers";
import { localDateKey } from "@/lib/dates/local-day";
import { computeEntryScheduleState, getEnhancementDailySchedule } from "@/lib/enhancement/schedule";
import { getStackStatus } from "@/lib/enhancement/status";
import { useDoseAnchors } from "@/lib/enhancement/useDoseAnchors";

import { entryName, markStateOf, type HeroItem, type RailItem, type TodaySlot } from "./TodayDay";

/* ════════════════════════════════════════════════════════════════════════
   COMPOUND TODAY — the one read of the member's compound day.

   Compound Command's Today and Apex's "Your compounds" row both read this
   hook, so an entry is never due in one room and upcoming in the other, the
   tiers are the member's own choice in both, and a mark made in either room
   runs the same store action and the same neutral log moment.

   Extracted from CompoundCommandView (PR #109) without changing what it
   computes.
   ════════════════════════════════════════════════════════════════════════ */

const NOW_MINUTES = (now: Date) => now.getHours() * 60 + now.getMinutes();

export function toCommandSlot(slot: TodaySlot): CommandSlot {
  return {
    entryId: slot.entryId,
    name: slot.entry.displayName ?? slot.entry.officialName ?? slot.entry.name,
    plannedTime: slot.plannedTime,
    plannedTimeLabel: slot.plannedTimeLabel,
    injectable: slot.entry.route === "injectable",
    tier: todayTierFor(slot.entry),
  };
}

export type TodayRead = {
  dueNow: CommandSlot[];
  laterToday: CommandSlot[];
  missed: CommandSlot[];
  loggedToday: number;
  /** Every slot's mark, by slot id. */
  states: Map<string, ReturnType<typeof markStateOf>>;
};

export function readToday(slots: TodaySlot[], now: Date | null): TodayRead {
  const minutes = now ? NOW_MINUTES(now) : null;
  const dueNow: CommandSlot[] = [];
  const laterToday: CommandSlot[] = [];
  const missed: CommandSlot[] = [];
  const states = new Map<string, ReturnType<typeof markStateOf>>();
  let loggedToday = 0;
  for (const slot of slots) {
    const state = markStateOf(slot, minutes);
    states.set(slot.id, state);
    if (slot.status === "taken") { loggedToday += 1; continue; }
    if (minutes === null) continue;
    const status = getStackStatus(slot, minutes).status;
    if (status === "due") dueNow.push(toCommandSlot(slot));
    else if (status === "missed") missed.push(toCommandSlot(slot));
    else if (status === "ready") laterToday.push(toCommandSlot(slot));
  }
  return { dueNow: dueNow.sort(byPlannedTime), laterToday, missed, loggedToday, states };
}

export function useCompoundToday(now: Date | null) {
  const entries = useAthleteDashboardStore((s) => s.trainingSession.enhancementLog);
  const adherence = useAthleteDashboardStore((s) => s.trainingSession.enhancementAdherence);
  const schedulePlan = useAthleteDashboardStore((s) => s.trainingSession.schedulePlan);
  const injectionLogs = useAthleteDashboardStore((s) => s.trainingSession.injectionLogs);
  const logEnhancementAdherence = useAthleteDashboardStore((s) => s.logEnhancementAdherence);
  /* The member's meals, wake and sleep target: what a dose set "before breakfast" or "before bed" resolves against. */
  const anchors = useDoseAnchors(now);

  /* Today's schedule, read once — the hero, Today and Plan all read this one list,
     so a compound is never "due now" in one place and "next due" in another. */
  const slots = useMemo(() => getEnhancementDailySchedule({
    entries,
    adherence,
    isTrainingDay: [1, 2, 4, 5].includes(new Date().getDay()),
    wakeTime: schedulePlan.wakeTime,
    sleepTime: schedulePlan.sleepTime,
    preferredGymTime: schedulePlan.workoutTime,
    anchors,
  }), [entries, adherence, schedulePlan, anchors]);

  /* One read of today, shared by the hero, its instruments and the day rail, so the entry the gold logs is the entry marked "Up next". */
  const read = useMemo(() => readToday(slots, now), [slots, now]);
  const primary = compoundPrimaryAction(read.dueNow);
  const upNextSlotId = primary.kind === "log-next-due"
    ? slots.find((slot) => slot.entryId === primary.slot.entryId && slot.plannedTime === primary.slot.plannedTime)?.id ?? null
    : null;
  const today = localDateKey();
  const siteLoggedToday = useCallback(
    (entryId: string) => injectionLogs.some((log) => log.entryId === entryId && log.date === today),
    [injectionLogs, today],
  );
  /* The two tiers, derived from the same slots the Day Timeline and the hero read — never a parallel list. */
  const tiers = useMemo(
    () => splitByTier(slots.map((slot) => ({ slot, name: entryName(slot.entry), plannedTime: slot.plannedTime, tier: todayTierFor(slot.entry) }))),
    [slots],
  );
  const heroItems = useMemo<HeroItem[]>(() => {
    const scheduled = tiers.heroes
      .map(({ slot }): HeroItem => {
        const state = read.states.get(slot.id) ?? "upcoming";
        return {
          kind: "today",
          slot,
          state,
          upNext: slot.id === upNextSlotId,
          siteNeeded: slot.entry.route === "injectable" && state === "logged" && !siteLoggedToday(slot.entryId),
        };
      });
    const onToday = new Set(slots.map((slot) => slot.entryId));
    const offDay = entries
      .filter((entry) => entry.isActive && !entry.pausedAt && !onToday.has(entry.id) && todayTierFor(entry) === "hero")
      .sort((a, b) => entryName(a).localeCompare(entryName(b)))
      .map((entry): HeroItem => {
        const next = computeEntryScheduleState(entry, { wakeTime: schedulePlan.wakeTime, sleepTime: schedulePlan.sleepTime, preferredGymTime: schedulePlan.workoutTime, anchors });
        return {
          kind: "off-day",
          entry,
          nextLabel: next.nextDueLabel,
          nextDate: next.nextDueDate ? localDateKey(next.nextDueDate) : null,
        };
      });
    return [...scheduled, ...offDay];
  }, [tiers, slots, entries, read, upNextSlotId, siteLoggedToday, schedulePlan, anchors]);
  const railItems = useMemo<RailItem[]>(
    () =>
      tiers.addOns.map(({ slot, name, plannedTime }) => ({ slot, name, plannedTime, state: read.states.get(slot.id) ?? "upcoming", upNext: slot.id === upNextSlotId })),
    [tiers, read, upNextSlotId],
  );

  /** A taken or skipped mark from a marker's sheet: the one store action, then the neutral "Logged" moment. */
  const markSlot = useCallback((slot: TodaySlot, status: "taken" | "skipped") => {
    logEnhancementAdherence({
      entryId: slot.entryId,
      date: localDateKey(),
      plannedTime: slot.plannedTime,
      takenStatus: status,
      actualTime: status === "taken" ? new Date().toTimeString().slice(0, 5) : undefined,
    });
    markCompoundLogged();
  }, [logEnhancementAdherence]);

  return { entries, schedulePlan, anchors, slots, read, primary, upNextSlotId, siteLoggedToday, tiers, heroItems, railItems, markSlot };
}
