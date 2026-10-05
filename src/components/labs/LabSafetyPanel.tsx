"use client";

import { FlaskConical } from "lucide-react";

import { CareOptions } from "@/components/safety/CareOptions";
import { EscalationList } from "@/components/safety/EscalationList";
import { SafetyAcknowledgementGate } from "@/components/safety/SafetyAcknowledgementGate";
import { useClientNow } from "@/components/safety/useClientNow";
import { useSafetyContext } from "@/components/safety/useSafetyContext";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { ReserveDisclosure } from "@/components/ui/reserve";
import { EmergencyLine } from "@/components/views/records/ClinicalRows";
import { RESERVE, alpha } from "@/lib/design/tokens";
import type { FindingTier, LabFinding } from "@/lib/labs/lab-safety";
import { LAB_FLAG_LABEL } from "@/lib/labs/types";
import {
  CLINICAL_COPY,
  findingGroups,
  findingReasons,
  labSafetyHeading,
  needsEmergencyLine,
  watchedGroups,
  watchedMarkerStatus,
} from "@/lib/records/clinical-records";
import { NO_CLINICIAN_LINE } from "@/lib/safety/care-options";
import { ESCALATION_LABEL } from "@/lib/safety/escalation";

/* ════════════════════════════════════════════════════════════════════════
   LAB SAFETY — the member's results against their own lab's ranges.

   Leads with the flagged rows: the value, the range and flag the report
   printed, and the previous value. The compounds a group of results is
   commonly watched for are named once, as a heading, not on every row.
   Every flag names the range it was judged against, and every flagged row
   keeps a visible route to a human — with or without a clinician. Findings
   never name a condition or a cause.
   ════════════════════════════════════════════════════════════════════════ */

const TIER: Record<FindingTier, { label: string; color: string }> = {
  urgent: { label: "Marked critical", color: RESERVE.red },
  discuss: { label: "Outside range", color: RESERVE.amber },
  watch: { label: "Watch", color: RESERVE.slate },
};

function formatDay(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function withUnit(value: string, unit?: string): string {
  return `${value}${unit ? ` ${unit}` : ""}`;
}

export function LabSafetyPanel() {
  const now = useClientNow();
  if (!now) return null;
  return (
    <SafetyAcknowledgementGate>
      <LabSafety now={now} />
    </SafetyAcknowledgementGate>
  );
}

function FindingRow({ finding }: { finding: LabFinding }) {
  const tier = TIER[finding.tier];
  const { latest, previous } = finding;
  const meta = [
    latest.rangeText ? `Range ${latest.rangeText} on your report` : "No range on your report",
    latest.labFlag ? `Lab flag ${LAB_FLAG_LABEL[latest.labFlag]}` : null,
    formatDay(latest.date),
    previous ? `was ${withUnit(previous.valueText, previous.unit)} on ${formatDay(previous.date)}` : null,
  ].filter(Boolean);
  return (
    <li className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0" data-record="lab-finding">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-[14.5px] font-semibold" style={{ color: RESERVE.ivory }}>
          {finding.label}
        </span>
        <span className="tnum text-[15px] font-bold" style={{ color: tier.color }}>
          {withUnit(latest.valueText, latest.unit)}
        </span>
        <span className="font-mono text-[11px] uppercase tracking-[0.14em]" style={{ color: tier.color }}>
          {tier.label}
        </span>
      </div>
      <p className="tnum text-[12.5px] leading-[1.5] text-white/60">{meta.join(" · ")}</p>
      {findingReasons(finding.reasons).map((reason) => (
        <p key={reason} className="text-[12px] leading-[1.5] text-white/50">
          {reason}
        </p>
      ))}
    </li>
  );
}

function LabSafety({ now }: { now: Date }) {
  const ctx = useSafetyContext(now);
  const { labBrief } = ctx;
  const labEscalations = ctx.escalation.filter((item) => item.source === "lab" && item.level === "contact-clinician-today");

  if (!ctx.hasLabs) {
    return (
      <GlassPanel accent={RESERVE.steel} phone="flush">
        <p className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.22em]" style={{ color: alpha(RESERVE.steel, 0.85) }}>
          <FlaskConical size={11} aria-hidden="true" />
          Lab safety
        </p>
        <p className="mt-1.5 text-[12.5px] leading-[1.55] text-white/55">
          Import or log a lab report to see each result compared with the reference range printed on it.
        </p>
      </GlassPanel>
    );
  }

  const count = labBrief.findings.length;
  const critical = labBrief.findings.filter((finding) => finding.tier === "urgent").length;
  const route = critical > 0 ? ESCALATION_LABEL["contact-clinician-today"] : ESCALATION_LABEL["discuss-with-clinician"];

  return (
    <>
      {/* A critical result keeps its full same-day ladder, as a sibling of the
          panel rather than a card inside it (components.md rule 1). */}
      <EscalationList items={labEscalations} label="Critical lab results" />

      <div data-record="lab-safety">
        <GlassPanel accent={RESERVE.steel} phone="flush">
          <div className="flex flex-col gap-4">
            <div>
              <p className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.22em]" style={{ color: alpha(RESERVE.steel, 0.85) }}>
                <FlaskConical size={11} aria-hidden="true" />
                Lab safety
                {labBrief.latestLabDate ? <span className="text-white/45"> · latest draw {formatDay(labBrief.latestLabDate)}</span> : null}
              </p>
              <h2 className="mt-1 text-[17px] font-bold" style={{ color: RESERVE.ivory }}>
                {labSafetyHeading(count)}
              </h2>
            </div>

            {count > 0 &&
              findingGroups(labBrief.findings).map((group) => (
                <section key={group.heading} aria-label={group.heading}>
                  <h3 className="text-[12.5px] font-semibold text-white/70">{group.heading}</h3>
                  <ul className="mt-2 flex flex-col divide-y divide-white/[0.06]">
                    {group.findings.map((finding) => (
                      <FindingRow key={finding.id} finding={finding} />
                    ))}
                  </ul>
                </section>
              ))}

            {count > 0 && (
              /* Every flagged result keeps a route to a human, on screen. */
              <div data-record="lab-route">
                <p className="font-mono text-[11px] uppercase tracking-[0.16em]" style={{ color: critical > 0 ? RESERVE.red : alpha(RESERVE.amber, 0.9) }}>
                  {route}
                </p>
                <p className="mt-1 text-[12.5px] leading-[1.5] text-white/65">{NO_CLINICIAN_LINE}</p>
              </div>
            )}

            {needsEmergencyLine({ criticalLabCount: critical, recentRedFlagCount: 0 }) && <EmergencyLine />}

            {(labEscalations.length > 0 || count > 0) && <CareOptions defaultOpen={labEscalations.length > 0} />}

            {labBrief.untested.length > 0 && (
              <ReserveDisclosure summary={`Not in your recent labs (${labBrief.untested.length})`} accent={RESERVE.steel}>
                {watchedGroups(labBrief.untested).map((group) => (
                  <div key={group.heading} className="pt-1">
                    <p className="text-[12.5px] font-semibold text-white/75">{group.heading}</p>
                    <ul className="mt-1.5 flex flex-col gap-1">
                      {group.markers.map((item) => (
                        <li key={item.key} className="text-[12px] leading-[1.5] text-white/60">
                          <span style={{ color: RESERVE.ivory }}>{item.label}</span> · {watchedMarkerStatus(item)}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
                <p className="mt-2 text-[11.5px] text-white/45">A clinician, telehealth visit or pharmacist can say whether testing applies to you, and in most states you can order lab tests yourself.</p>
              </ReserveDisclosure>
            )}

            {/* How the rows above were judged, after the rows themselves. */}
            {labBrief.clearCount > 0 && (
              <p className="tnum text-[12px] text-white/45">
                {labBrief.clearCount} other {labBrief.clearCount === 1 ? "marker is inside your lab’s ranges or has" : "markers are inside your lab’s ranges or have"} no printed range.
              </p>
            )}
            <p className="text-[12px] leading-[1.55] text-white/45">{CLINICAL_COPY.labSafetyLead}</p>
          </div>
        </GlassPanel>
      </div>
    </>
  );
}
