"use client";

import { FlaskConical, Plus } from "lucide-react";
import { useMemo } from "react";

import { GlassPanel } from "@/components/ui/GlassPanel";
import { DETAIL_BAND_BLEED, ReserveDetailImage, ReserveSectionHeader } from "@/components/ui/reserve";
import { useAthleteDashboardStore, type DashboardView } from "@/lib/athlete-store";
import { RESERVE, alpha } from "@/lib/design/tokens";
import { formatDay } from "@/lib/physique/record-summary";
import { labSummary, markerTrends, trendsByPanel, type MarkerTrend } from "@/lib/labs/record-summary";
import { isCriticalLabFlag } from "@/lib/labs/types";
import {
  CLINICAL_COPY,
  biomarkerStatement,
  clinicalPrimary,
  trendDates,
  trendFlag,
  trendRange,
  trendReading,
  trendRoute,
} from "@/lib/records/clinical-records";
import { allMet, type Requirement } from "@/lib/records/requirements";
import { NO_CLINICIAN_LINE } from "@/lib/safety/care-options";

import { EmergencyLine } from "./records/ClinicalRows";
import { EnhancedContext } from "./records/EnhancedContext";
import { RecordEmpty, RecordList, RecordRow } from "./records/RecordRows";
import { RecordHero } from "./records/RecordHero";
import { RequirementsPanel } from "./records/Requirements";
import { ViewShell } from "./ViewShell";

/* ════════════════════════════════════════════════════════════════════════
   BIOMARKER COCKPIT — the member's own results, organized for a review.

   ONE JOB: trends. The dominant region is one marker table grouped by body
   system, each marker showing its own previous → latest value, the range
   its report printed and the flag its lab applied. Nothing else sits above
   it. The enhanced context below is the same compact rows as Bloodwork.

   THE HARD WALL (constitution clinical-data.md):
     · A result is compared only with the range printed on the member's own
       report, and carries the flag their lab printed.
     · A change between two of their own draws is shown as the two numbers.
       It is never a cause, a condition, or something to do.
     · Reserve supplies no range, no verdict and no clearance. Every flagged
       row routes to a human, with or without a clinician.

   Bible §02: the emotional ceiling here is "organized and ready for a
   review" — never alarm, and never reassurance either.
   ════════════════════════════════════════════════════════════════════════ */

const PRIMARY = clinicalPrimary("biomarker-intelligence");

const REQUIREMENTS_PURPOSE =
  "The Biomarker Cockpit groups every result you have logged by body system, dates it, carries the range and flag printed on your own report, and shows how a number moved between your own draws.";

export function BiomarkerIntelligenceView() {
  const setActiveView = useAthleteDashboardStore((s) => s.setActiveView);
  const bloodworkLogs = useAthleteDashboardStore((s) => s.bloodworkLogs);

  const records = useMemo(
    () => bloodworkLogs.map((log) => ({ id: log.id, testDate: log.testDate, labName: log.labName, markers: log.markers })),
    [bloodworkLogs],
  );
  const summary = useMemo(() => labSummary(records), [records]);
  const trends = useMemo(() => markerTrends(records), [records]);
  const panels = useMemo(() => trendsByPanel(trends), [trends]);
  const flagged = trends.filter((trend) => trend.flagged);
  const critical = flagged.some((trend) => isCriticalLabFlag(trend.latest.labFlag));

  /* With no labs logged the requirement list is the first screen — real
     counts, and a way into each line. */
  const requirements: Requirement[] = [
    {
      id: "record",
      label: "A lab panel",
      have: Math.min(summary.recordCount, 1),
      need: 1,
      noun: "lab panel",
      detail: "Import a PDF, photograph the pages, or paste your results. Everything is read on this device.",
      action: "Add Lab Record",
      view: "bloodwork",
    },
    {
      id: "results",
      label: "Results confirmed on it",
      have: Math.min(summary.totalResultCount, 1),
      need: 1,
      noun: "result",
      detail: "Only the rows you confirm are saved — those are the markers this cockpit groups and dates.",
      action: "Add Lab Record",
      view: "bloodwork",
    },
    {
      id: "second",
      label: "A second panel",
      have: Math.min(summary.recordCount, 2),
      need: 2,
      noun: "lab panels",
      detail: "A change needs two of your own draws. Until then a marker shows its value and no direction.",
      action: "Add Lab Record",
      view: "bloodwork",
    },
  ];
  const ready = allMet(requirements);

  return (
    <ViewShell
      label="Biomarker Intelligence"
      title="Biomarker Cockpit"
      icon={FlaskConical}
      accentColor={RESERVE.steel}
      badge="Reserve Black"
      roomHero
      command="Every result you logged, grouped by body system and dated."
      disclaimer="An observational log of your own results, compared only with the range printed on your own report. Reserve does not supply ranges, diagnose or interpret. Have results reviewed by a licensed clinician."
    >
      <RecordHero
        testId="biomarker-intelligence"
        accent={RESERVE.steel}
        eyebrow="Laboratory · log only"
        statement={biomarkerStatement({ recordCount: summary.recordCount, spanDays: summary.spanDays, trends })}
        support={
          summary.recordCount > 0
            ? CLINICAL_COPY.recordSupport
            : "Add a lab record and this cockpit fills with your own markers — grouped by body system, dated, and never invented."
        }
        reads={[
          {
            label: "Lab records",
            value: summary.recordCount > 0 ? String(summary.recordCount) : null,
            detail: summary.newest ? `last ${formatDay(summary.newest.testDate)}` : undefined,
            empty: "Evidence needed · no labs logged",
          },
          {
            label: "Markers",
            value: trends.length > 0 ? String(trends.length) : null,
            detail: trends.length > 0 ? `${summary.totalResultCount} ${summary.totalResultCount === 1 ? "result" : "results"} logged` : undefined,
            empty: "Evidence needed",
          },
          {
            label: "Your lab raised",
            value: summary.recordCount > 0 ? String(flagged.length) : null,
            detail: summary.recordCount > 0 ? "flagged, or outside your report's range" : undefined,
            empty: "Evidence needed",
          },
        ]}
        action={{
          label: PRIMARY.label,
          icon: Plus,
          onClick: () => {
            if (PRIMARY.kind === "view") setActiveView(PRIMARY.view as DashboardView);
          },
        }}
      />

      {!ready && summary.recordCount === 0 && (
        <RequirementsPanel
          purpose={REQUIREMENTS_PURPOSE}
          requirements={requirements}
          onOpen={(view) => setActiveView(view)}
          accent={RESERVE.steel}
          detail="labs-clinic"
        />
      )}

      {/* ── The dominant region: every marker's own trend, by body system ── */}
      {summary.recordCount > 0 && (
      <div data-record="marker-table">
        <GlassPanel accent={RESERVE.steel} phone="flush">
          <ReserveDetailImage id="labs-clinic" className={DETAIL_BAND_BLEED} />
          <ReserveSectionHeader
            label={trends.length > 0 ? `${CLINICAL_COPY.markersLabel} · ${trends.length}` : CLINICAL_COPY.markersLabel}
            accent={RESERVE.steel}
          />
          {trends.length === 0 ? (
            <RecordEmpty headline={CLINICAL_COPY.markersEmptyHeadline} body={CLINICAL_COPY.markersEmptyBody} />
          ) : (
            <div className="flex flex-col gap-6">
              {panels.map(({ panel, trends: panelTrends }) => (
                <section key={panel} aria-label={panel}>
                  <h3 className="font-mono text-[11px] uppercase tracking-[0.18em]" style={{ color: alpha(RESERVE.steel, 0.9) }}>
                    {panel}
                  </h3>
                  <RecordList label={`${panel} markers`} className="mt-2.5">
                    {panelTrends.map((trend) => (
                      <MarkerRow key={`${trend.key ?? trend.label}`} trend={trend} />
                    ))}
                  </RecordList>
                </section>
              ))}

              {/* Every flagged result keeps a visible route to a human. */}
              {flagged.length > 0 && (
                <div data-record="marker-route">
                  <p className="font-mono text-[11px] uppercase tracking-[0.16em]" style={{ color: critical ? RESERVE.red : alpha(RESERVE.amber, 0.9) }}>
                    {trendRoute(flagged.find((t) => isCriticalLabFlag(t.latest.labFlag)) ?? flagged[0])}
                  </p>
                  <p className="mt-1 text-[12.5px] leading-[1.5] text-white/65">{NO_CLINICIAN_LINE}</p>
                </div>
              )}
            </div>
          )}

          <div className="mt-4">
            <p className="text-[12px] leading-[1.55] text-white/50">{CLINICAL_COPY.criticalLine}</p>
            <EmergencyLine />
          </div>
        </GlassPanel>
      </div>
      )}

      {!ready && summary.recordCount > 0 && (
        <RequirementsPanel
          purpose={REQUIREMENTS_PURPOSE}
          requirements={requirements}
          onOpen={(view) => setActiveView(view)}
          accent={RESERVE.steel}
        />
      )}

      {/* Where the member has logged a cycle or compounds: the same compact
          rows as Bloodwork, each opening a sheet. Same launch switch, same
          acknowledgement, no new gate. The marker table above already routes
          each flagged result, so the lab review rows are not repeated; a
          critical lab's same-day item always stays. 911 / 988 is above. */}
      <EnhancedContext showLabReviewRow={false} showEmergencyLine={false} />
    </ViewShell>
  );
}

function MarkerRow({ trend }: { trend: MarkerTrend }) {
  const flag = trendFlag(trend);
  const route = trendRoute(trend);
  return (
    <RecordRow>
      <div data-record="marker-row" className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-1 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_auto]">
        <p className="text-[14.5px] font-semibold text-[#f2eee6]">{trend.label}</p>
        <p className="tnum text-right text-[15px] font-semibold sm:order-last" style={{ color: trend.flagged ? RESERVE.amber : RESERVE.ivory }}>
          {trendReading(trend)}
        </p>
        <p className="tnum col-span-2 text-[12.5px] leading-[1.5] text-white/60 sm:col-span-1">
          {trendDates(trend)} · {trendRange(trend)}
        </p>
      </div>
      {flag && (
        <p className="mt-1 text-[12.5px] leading-[1.5]" style={{ color: RESERVE.amber }}>
          {flag}
          {route ? ` · ${route}` : ""}
        </p>
      )}
    </RecordRow>
  );
}
