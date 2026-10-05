"use client";

/* ════════════════════════════════════════════════════════════════════════
   useProgramWeek — the member's program as one week, read once.

   Training Command, Apex and Nutrition all resolve the day through
   `resolveDailyTrainingContext`. They now all feed it the same program week
   from here, so the rail, the hero, the cockpit and the fuel horizon cannot
   name a different Tuesday.

   Null when no program governs the week being shown. The caller then keeps
   whatever it resolved before, unchanged.
   ════════════════════════════════════════════════════════════════════════ */

import { useMemo } from "react";

import { useAthleteDashboardStore } from "@/lib/athlete-store";
import type { ResolvedDay } from "@/lib/training/daily-context";
import { weekDateKeys } from "@/lib/training/split-customization";

import { buildProgramResolvedWeek } from "./resolved-week";

export function useProgramWeek(now?: Date): ResolvedDay[] | null {
  const programs = useAthleteDashboardStore((s) => s.programs);
  const activeProgramId = useAthleteDashboardStore((s) => s.activeProgramId);
  const assignments = useAthleteDashboardStore((s) => s.weekAssignments);
  const overrides = useAthleteDashboardStore((s) => s.programDayOverrides);

  /* The seven dates of the week on screen. Joined into a key so a new Date()
     on every render cannot re-resolve a week that has not changed. */
  const weekDates = useMemo(() => weekDateKeys(now ?? new Date()), [now]);
  const weekKey = weekDates.join("|");

  return useMemo(
    () => buildProgramResolvedWeek({ programs, activeProgramId, assignments, overrides, weekDates: weekKey.split("|") }),
    [programs, activeProgramId, assignments, overrides, weekKey],
  );
}
