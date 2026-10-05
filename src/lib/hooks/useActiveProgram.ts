"use client";

import { useMemo } from "react";

import { applyMemberSplitToHorizon, resolveActiveProgram, type ActiveProgramResolution } from "@/lib/horizon/active-program";
import type { MemberSplit } from "@/lib/training/member-split";
import { useMemberSplit } from "./useMemberSplit";
import { useProgramHorizon, type ProgramHorizonResult } from "./useProgramHorizon";

export type ActiveProgramResult = ProgramHorizonResult & {
  resolution: ActiveProgramResolution | null;
  /** The split the member chose, when it sets the program's days. */
  memberSplit: MemberSplit | null;
};

/**
 * Client boundary for every live Program Horizon consumer. Generation and
 * migration stay in useProgramHorizon; week/day/revision/demand resolution
 * stays in the pure active-program resolver.
 *
 * A split the member chose sets the resolved week's days here, once, so every
 * consumer — the rail, Training, nutrition and recovery demand — reads the
 * same week. The program keeps its phase, volume and progression.
 */
export function useActiveProgram(options: { now?: Date; selectedDayIndex?: number } = {}): ActiveProgramResult {
  const horizonResult = useProgramHorizon(options.now);
  const memberSplit = useMemberSplit();

  /* Program screens read the same days: every projected week carries the split. */
  const horizon = useMemo(
    () => horizonResult.horizon ? applyMemberSplitToHorizon(horizonResult.horizon, memberSplit) : null,
    [horizonResult.horizon, memberSplit],
  );

  const resolution = useMemo(
    () => horizonResult.horizon
      ? resolveActiveProgram(
          horizonResult.horizon,
          horizonResult.source,
          options.now,
          options.selectedDayIndex,
          memberSplit,
        )
      : null,
    [horizonResult.horizon, horizonResult.source, options.now, options.selectedDayIndex, memberSplit],
  );

  return { ...horizonResult, horizon, resolution, memberSplit };
}
