"use client";

import { useMemo } from "react";

import { ReserveDisclosure } from "@/components/ui/reserve";
import { PhaseRows } from "@/components/women/phase-lens";
import { useAthleteDashboardStore } from "@/lib/athlete-store";
import { RESERVE } from "@/lib/design/tokens";
import { periodStarts, phaseLensVisible, type PhaseGroup } from "@/lib/women/cycle";

/* ════════════════════════════════════════════════════════════════════════
   BY CYCLE PHASE — the lens, inside the command that owns the data.

   This replaces four rooms. Women's Training, Nutrition, Recovery and
   Physique each existed to re-sort data the member had already logged
   somewhere else, which is why "Training Command" appeared twice in her
   sidebar. The sorting is worth keeping; a parallel room per command is not.

   It renders NOTHING unless both are true:
     1. she is on the women's path, and
     2. a period start has been entered — without one there is no phase to
        estimate, and rows reading "Evidence needed" in a command she opened
        for something else are noise, not help.

   So a member who never logs a cycle sees no change anywhere in the app.

   Collapsed by design. A phase read is secondary information in a command
   whose job is today's session, today's meals or last night's sleep.

   The panel takes PRE-BUILT groups rather than raw entries: Nutrition groups
   meal days against cycle notes in a shape that is not a list of dated rows,
   so grouping belongs to each caller and this component stays presentation
   plus the gate.

   Observational only. It sorts her own entries by the phase ESTIMATED for
   each date. It does not interpret them, does not link them to each other,
   and never says a phase caused anything.
   ════════════════════════════════════════════════════════════════════════ */

/**
 * The shared gate and the inputs a caller needs to group its own data.
 * `active` is false for any member not on the women's path, and for one who
 * has not entered a period start — there is no phase without one.
 */
export function useCyclePhase() {
  const genderIdentity = useAthleteDashboardStore((s) => s.profile.coachingProfile?.genderIdentity);
  const womensEnabled = useAthleteDashboardStore((s) => s.womens.enabled);
  const cycle = useAthleteDashboardStore((s) => s.womens.cycle);
  const cycleLogs = useAthleteDashboardStore((s) => s.womens.cycleLogs);

  const starts = useMemo(() => periodStarts(cycle, cycleLogs), [cycle, cycleLogs]);
  const womensPath = genderIdentity === "female" || womensEnabled;

  return {
    active: phaseLensVisible({ genderIdentity, womensEnabled, starts }),
    womensPath,
    cycle,
    cycleLogs,
    starts,
  };
}

export function CyclePhasePanel<T>({
  title,
  groups,
  read,
  need = 2,
  noun,
  accent = RESERVE.violet,
  active,
}: {
  /** Section title, e.g. "How training felt". */
  title: string;
  groups: PhaseGroup<T>[];
  /** Turns a phase's entries into one honest line. From lib/women/summaries. */
  read: (items: T[]) => { primary: string; secondary?: string };
  /** Entries a phase needs before a number is shown rather than "evidence needed". */
  need?: number;
  /** What the entries are counted in — "days", "nights", "check-ins". */
  noun: string;
  accent?: string;
  /** From useCyclePhase(). Passed in so a caller computes the gate once. */
  active: boolean;
}) {
  if (!active) return null;

  return (
    <ReserveDisclosure summary="By cycle phase" accent={accent}>
      <PhaseRows label={`${title}, by estimated phase`} groups={groups} need={need} noun={noun} read={read} />
      <p className="mt-3 max-w-[72ch] text-[12px] leading-[1.55] text-white/50">
        Sorted by the phase estimated for each date, from the dates you entered. A pattern here describes your own
        entries during the same estimated phase — it does not say what caused them, and Reserve does not change your
        plan from it.
      </p>
    </ReserveDisclosure>
  );
}
