"use client";

import { useMemo } from "react";

import { useAthleteDashboardStore } from "@/lib/athlete-store";
import type { MemberSplit } from "@/lib/training/member-split";
import { getArchitectureForSystem } from "@/lib/training/split-architectures";

/** The split the member chose, around their rest day — null until they choose one. */
export function useMemberSplit(): MemberSplit | null {
  const splitSystem = useAthleteDashboardStore((s) => s.splitSystem);
  const trainingDaysPerWeek = useAthleteDashboardStore((s) => s.setupProfile.trainingDaysPerWeek);
  const weakPoints = useAthleteDashboardStore((s) => s.physiqueCommand.weakPoints);

  return useMemo<MemberSplit | null>(() => {
    if (!splitSystem.selectedAt) return null;
    const architecture = getArchitectureForSystem(splitSystem.key, { trainingDaysPerWeek: trainingDaysPerWeek ?? null });
    return architecture
      ? { architecture, restDayIndex: splitSystem.restDayIndex ?? null, musclePriority: weakPoints ?? [] }
      : null;
  }, [splitSystem.key, splitSystem.selectedAt, splitSystem.restDayIndex, trainingDaysPerWeek, weakPoints]);
}
