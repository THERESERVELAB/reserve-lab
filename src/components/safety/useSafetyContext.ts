"use client";

import { useMemo } from "react";

import { useAthleteDashboardStore, type EnhancementEntry } from "@/lib/athlete-store";
import { buildCompoundRiskBrief, type CompoundIdentity } from "@/lib/compound-intelligence/risk-profiles";
import { resolveCycleState, selectCurrentCycle } from "@/lib/cycle/cycle-period";
import { buildLabSafetyBrief } from "@/lib/labs/lab-safety";
import { hasCurrentSafetyAcknowledgement } from "@/lib/safety/acknowledgement";
import { buildEscalation } from "@/lib/safety/escalation";

/** Red-flag symptoms reported within this window stay on the escalation ladder. */
export const RECENT_SYMPTOM_HOURS = 72;

const EMPTY_ENTRIES: EnhancementEntry[] = [];

export function compoundIdentity(entry: EnhancementEntry): CompoundIdentity {
  return {
    name: entry.displayName?.trim() || entry.name,
    officialName: entry.officialName,
    compoundClass: entry.compoundClass,
  };
}

export function isRunning(entry: EnhancementEntry): boolean {
  return entry.isActive && !entry.pausedAt;
}

/**
 * One reading of the member's safety picture, shared by Compound Command and
 * the Bloodwork Log so both always show the same findings and escalations.
 */
export function useSafetyContext(now: Date) {
  const entries = useAthleteDashboardStore((s) => s.trainingSession.enhancementLog) ?? EMPTY_ENTRIES;
  const bloodworkLogs = useAthleteDashboardStore((s) => s.bloodworkLogs);
  const cyclePeriods = useAthleteDashboardStore((s) => s.cyclePeriods);
  const redFlagReports = useAthleteDashboardStore((s) => s.redFlagReports);
  const acknowledgement = useAthleteDashboardStore((s) => s.safetyAcknowledgement);
  const profileAge = useAthleteDashboardStore((s) => s.setupProfile.age);

  return useMemo(() => {
    const activeCompounds = entries.filter(isRunning);
    const riskBrief = buildCompoundRiskBrief(activeCompounds.map(compoundIdentity));

    const currentCycle = selectCurrentCycle(cyclePeriods, now);
    const cycleState = currentCycle
      ? resolveCycleState(currentCycle, {
          now,
          compounds: entries.map((entry) => ({
            id: entry.id,
            name: compoundIdentity(entry).name,
            isActive: entry.isActive,
            pausedAt: entry.pausedAt,
          })),
          labDates: bloodworkLogs.map((log) => log.testDate),
        })
      : null;

    const labBrief = buildLabSafetyBrief({ records: bloodworkLogs, markerLinks: riskBrief.markerLinks, now });

    const cutoff = now.getTime() - RECENT_SYMPTOM_HOURS * 3_600_000;
    const recentRedFlags = redFlagReports
      .filter((report) => Date.parse(report.reportedAt) >= cutoff)
      .flatMap((report) => report.flags);

    return {
      compounds: entries,
      activeCompounds,
      riskBrief,
      cycleState,
      labBrief,
      hasLabs: bloodworkLogs.some((log) => (log.markers?.length ?? 0) > 0),
      redFlagReports,
      escalation: buildEscalation({ labBrief, cycleState, recentRedFlags }),
      acknowledged: hasCurrentSafetyAcknowledgement(acknowledgement, profileAge),
    };
  }, [entries, bloodworkLogs, cyclePeriods, redFlagReports, acknowledgement, profileAge, now]);
}

export type SafetyContext = ReturnType<typeof useSafetyContext>;
