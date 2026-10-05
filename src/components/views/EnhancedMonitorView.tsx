"use client";

import { Activity } from "lucide-react";
import { useMemo } from "react";

import { GlassPanel } from "@/components/ui/GlassPanel";
import { ReserveButton, ReserveDisclosure, ReserveSectionHeader } from "@/components/ui/reserve";
import { useAthleteDashboardStore, type DashboardView } from "@/lib/athlete-store";
import { RESERVE } from "@/lib/design/tokens";
import { monitorSummary, type MonitorDestination } from "@/lib/enhanced/monitor-summary";
import { CLINICAL_COPY, monitorRows } from "@/lib/records/clinical-records";

import { EmergencyLine } from "./records/ClinicalRows";
import { EnhancedContext } from "./records/EnhancedContext";
import { RecordHero } from "./records/RecordHero";
import { RecordList, RecordRow } from "./records/RecordRows";
import { ViewShell } from "./ViewShell";

/* ════════════════════════════════════════════════════════════════════════
   ENHANCED MONITOR — an index of the member's own observational records.

   ONE JOB: the index. "Your logs" is the dominant region; nothing else sits
   above the fold. The cycle context, commonly watched markers and symptom
   check are one row each (their full detail lives on Bloodwork and Compound
   Command), the review route stays a row, and 911 / 988 stays on screen.

   The gold action is the index's own resolver (`monitorSummary`), and a row
   whose control would only repeat it carries none (`monitorRows`).

   COMPLIANCE: record keeping only. Nothing here states an amount, a
   schedule or a combination, names anything to start, stop or change, or
   interprets a result. Every clinical question routes to a human.
   ════════════════════════════════════════════════════════════════════════ */

const DESTINATION_VIEW: Record<MonitorDestination, DashboardView> = {
  supplements: "supplements",
  bloodwork: "bloodwork",
  physique: "physique",
  measurements: "measurements",
  "progress-photos": "progress-photos",
};

export function EnhancedMonitorView() {
  const setActiveView = useAthleteDashboardStore((s) => s.setActiveView);
  const enhancementLog = useAthleteDashboardStore((s) => s.trainingSession.enhancementLog);
  const cyclePeriods = useAthleteDashboardStore((s) => s.cyclePeriods);
  const bloodworkLogs = useAthleteDashboardStore((s) => s.bloodworkLogs);
  const physiqueEntries = useAthleteDashboardStore((s) => s.physiqueCommand.entries);
  const photoCheckIns = useAthleteDashboardStore((s) => s.physiqueCommand.photoCheckIns);

  const summary = useMemo(
    () =>
      monitorSummary({
        compoundEntryCount: enhancementLog.length,
        cycles: cyclePeriods,
        labRecords: bloodworkLogs.map((log) => ({ testDate: log.testDate })),
        measurementEntries: physiqueEntries.map((entry) => ({ date: entry.date })),
        photoCheckIns: photoCheckIns.map((checkIn) => ({ date: checkIn.date })),
      }),
    [enhancementLog, cyclePeriods, bloodworkLogs, physiqueEntries, photoCheckIns],
  );
  const rows = useMemo(() => monitorRows(summary.lines, summary.primary), [summary]);

  const openCycles = cyclePeriods.filter((cycle) => !cycle.endedOn).length;

  return (
    <ViewShell
      label="Enhanced Module"
      title="Enhanced Monitor"
      icon={Activity}
      accentColor={RESERVE.gold}
      badge="Tracking Only"
      roomHero
      command="Everything you track under this module, in one index."
      disclaimer="This module records personal observations and trends only. No protocols, amounts, schedules, cycle planning, medical advice, or clinical interpretations are generated or provided."
    >
      <RecordHero
        testId="enhanced-monitor"
        accent={RESERVE.gold}
        eyebrow="Observational records · log only"
        statement={summary.statement}
        support="Each line below counts what you entered and opens the log that holds it."
        reads={[
          {
            label: "Records on file",
            value: summary.totalRecords > 0 ? String(summary.totalRecords) : null,
            detail: summary.totalRecords > 0 ? "across your own logs" : undefined,
            empty: "Evidence needed · nothing logged yet",
          },
          {
            label: "Compound entries",
            value: enhancementLog.length > 0 ? String(enhancementLog.length) : null,
            detail: enhancementLog.length > 0 ? "entered by you" : undefined,
            empty: "Evidence needed",
          },
          {
            label: "Cycles stated",
            value: cyclePeriods.length > 0 ? String(cyclePeriods.length) : null,
            detail: cyclePeriods.length > 0 ? `${openCycles} still open` : undefined,
            empty: "Evidence needed",
          },
        ]}
        action={{
          label: summary.primary.label,
          onClick: () => setActiveView(DESTINATION_VIEW[summary.primary.destination]),
        }}
      />

      {/* ── The dominant region: the index ── */}
      <div data-record="monitor-index">
        <GlassPanel accent={RESERVE.gold} phone="flush">
          <ReserveSectionHeader label="Your logs" accent={RESERVE.gold} />
          <RecordList label="Observational logs">
            {rows.map((line) => (
              <RecordRow key={line.id}>
                <div className="flex min-h-[44px] flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[14.5px] font-semibold text-[#f2eee6]">{line.label}</p>
                    <p className="tnum mt-0.5 max-w-[60ch] text-[12.5px] leading-snug text-white/55">{line.detail}</p>
                  </div>
                  {line.showAction && (
                    <ReserveButton tier="quiet" size="sm" onClick={() => setActiveView(DESTINATION_VIEW[line.destination])}>
                      {line.action}
                    </ReserveButton>
                  )}
                </div>
              </RecordRow>
            ))}
          </RecordList>
        </GlassPanel>
      </div>

      {/* One row each for the cycle context, commonly watched markers and the
          symptom check — linking to Compound Command and Bloodwork, where the
          detail lives; the symptom check opens in place. Behind the unchanged
          launch switch and acknowledgement, and only once the member has
          logged a compound or a cycle. This screen shows 911 / 988 below for
          every member, so the rows do not repeat it. */}
      <EnhancedContext rowAction="link" showEmergencyLine={false} />

      <GlassPanel accent={RESERVE.steel} phone="flush">
        <p className="text-[13px] leading-[1.55] text-white/70">{CLINICAL_COPY.trackingLine}</p>
        <EmergencyLine className="mt-1" />
        <div className="mt-2">
          <ReserveDisclosure summary={CLINICAL_COPY.handlesSummary} accent={RESERVE.steel}>
            <p className="text-[12.5px] leading-[1.6] text-white/60">{CLINICAL_COPY.handlesBody}</p>
            <p className="mt-2 text-[12.5px] leading-[1.6] text-white/60">{CLINICAL_COPY.handlesLabs}</p>
          </ReserveDisclosure>
        </div>
      </GlassPanel>
    </ViewShell>
  );
}
