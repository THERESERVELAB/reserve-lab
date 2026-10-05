"use client";

import { useMemo } from "react";

import { CyclePhasePanel, useCyclePhase } from "@/components/women/CyclePhasePanel";
import { useAthleteDashboardStore } from "@/lib/athlete-store";
import { RESERVE } from "@/lib/design/tokens";
import { mealDayKeys } from "@/lib/women/evidence";
import { CYCLE_PHASE_ORDER, estimatePhaseOn, groupByEstimatedPhase } from "@/lib/women/cycle";
import type { CycleLogEntry, CyclePhase } from "@/lib/women/types";
import { energyStressRead, mealDaysRead, sleepRead, trainingFeltRead } from "@/lib/women/summaries";

/* ════════════════════════════════════════════════════════════════════════
   One wrapper per command. Each reads its OWN data and builds its OWN groups,
   so the core views stay composition shells and never learn about cycles.

   These carry what the deleted women's rooms carried, nothing more: the
   grouped read. The hero statements were roll-ups of the same numbers, the
   requirement prompts belong in Cycle Command where she can act on them, and
   the raw entry lists already have homes in the commands that own them.
   ════════════════════════════════════════════════════════════════════════ */

/** Training Command — how training felt, by estimated phase. */
export function TrainingPhasePanel() {
  const { active, cycle, cycleLogs, starts } = useCyclePhase();
  const answered = useMemo(() => cycleLogs.filter((l) => l.trainingPerformance), [cycleLogs]);
  const groups = useMemo(() => groupByEstimatedPhase(answered, cycle, starts), [answered, cycle, starts]);
  return (
    <CyclePhasePanel
      active={active}
      title="How training felt"
      groups={groups}
      need={2}
      noun="days"
      read={trainingFeltRead}
      accent={RESERVE.gold}
    />
  );
}

type PhaseMeals = { mealDays: number; notes: CycleLogEntry[] };

/** Nutrition Command — days with meals logged, beside the cravings noted in that phase. */
export function NutritionPhasePanel() {
  const { active, cycle, cycleLogs, starts } = useCyclePhase();
  const nutritionPrefs = useAthleteDashboardStore((s) => s.nutritionPrefs);

  const days = useMemo(() => {
    const history = nutritionPrefs.nutritionLogHistory ?? {};
    return mealDayKeys({
      loggedMealIds: nutritionPrefs.loggedMealIds,
      nutritionLogDate: nutritionPrefs.nutritionLogDate,
      nutritionLogHistory: history,
    });
  }, [nutritionPrefs.loggedMealIds, nutritionPrefs.nutritionLogDate, nutritionPrefs.nutritionLogHistory]);

  /* Meal days and cycle notes for the same phase, side by side. A phase reads
     only once it holds at least one real meal day. */
  const groups = useMemo(() => {
    const byPhase = new Map<CyclePhase, PhaseMeals>(CYCLE_PHASE_ORDER.map((p) => [p, { mealDays: 0, notes: [] }]));
    for (const date of days) {
      const phase = estimatePhaseOn(date, cycle, starts).phase;
      if (phase) byPhase.get(phase)!.mealDays += 1;
    }
    for (const log of cycleLogs) {
      const phase = estimatePhaseOn(log.date, cycle, starts).phase;
      if (phase) byPhase.get(phase)!.notes.push(log);
    }
    return CYCLE_PHASE_ORDER.map((phase) => {
      const g = byPhase.get(phase)!;
      return { phase, items: g.mealDays > 0 ? [g] : [] };
    });
  }, [days, cycle, cycleLogs, starts]);

  return (
    <CyclePhasePanel
      active={active}
      title="Meal days"
      groups={groups}
      need={1}
      noun="day"
      read={(items) => mealDaysRead(items[0].mealDays, items[0].notes)}
      accent={RESERVE.green}
    />
  );
}

/** Recovery Command — sleep, and energy and stress, each by estimated phase. */
export function RecoveryPhasePanels() {
  const { active, cycle, cycleLogs, starts } = useCyclePhase();
  const sleepLogs = useAthleteDashboardStore((s) => s.recoveryCommand.sleepLogs);

  const sleepGroups = useMemo(() => groupByEstimatedPhase(sleepLogs, cycle, starts), [sleepLogs, cycle, starts]);
  const noteGroups = useMemo(
    () => groupByEstimatedPhase(cycleLogs.filter((l) => l.energy || l.stress), cycle, starts),
    [cycleLogs, cycle, starts],
  );

  return (
    <>
      <CyclePhasePanel
        active={active}
        title="Sleep"
        groups={sleepGroups}
        need={2}
        noun="nights"
        read={sleepRead}
        accent={RESERVE.violet}
      />
      <CyclePhasePanel
        active={active}
        title="Energy and stress"
        groups={noteGroups}
        need={2}
        noun="days"
        read={energyStressRead}
        accent={RESERVE.steel}
      />
    </>
  );
}

/**
 * Physique Command — check-ins by estimated phase.
 *
 * The room this replaces did NOT group: it printed the estimated phase beside
 * every check-in and photo row. Physique Command has no such rows — the per-row
 * lists live in Measurements and Progress Photos — so the read is reshaped into
 * the grouped form the other three use. It answers the same question, "where
 * did my check-ins fall", in the shape the rest of the lens uses.
 */
export function PhysiquePhasePanel() {
  const { active, cycle, starts } = useCyclePhase();
  const entries = useAthleteDashboardStore((s) => s.physiqueCommand.entries);
  const groups = useMemo(() => groupByEstimatedPhase(entries, cycle, starts), [entries, cycle, starts]);

  return (
    <CyclePhasePanel
      active={active}
      title="Check-ins"
      groups={groups}
      need={1}
      noun="check-in"
      read={(items) => ({
        primary: `${items.length} check-in${items.length === 1 ? "" : "s"}`,
        secondary: items.length > 1 ? `${items[items.length - 1].date} to ${items[0].date}` : undefined,
      })}
      accent={RESERVE.violet}
    />
  );
}
