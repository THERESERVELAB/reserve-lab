/* ════════════════════════════════════════════════════════════════════════
   CLINICIAN SUMMARY — the member's own records, formatted for whoever reviews
   them: a clinician, urgent care, a telehealth visit or a pharmacist. Many
   members have no regular clinician, so nothing here assumes one.

   A document the member can copy into a patient portal message, or print or
   save as PDF for an appointment. For each compound it also lists what is
   commonly watched, the member's latest result for each, and questions to
   ask — questions for a person, never answers from Reserve. It contains only what the member entered
   or imported, plus Reserve's flags labelled as flags. It is not a clinical
   assessment, and it leaves the device only if the member chooses to share it.
   ════════════════════════════════════════════════════════════════════════ */

import { RED_FLAGS, profilesForCompound, type RiskSystem } from "@/lib/compound-intelligence/risk-profiles";
import { markerDef, type MarkerKey } from "@/lib/labs/markers";
import { CYCLE_PHASE_LABEL, type CycleState } from "@/lib/cycle/cycle-period";
import type { LabSafetyBrief } from "@/lib/labs/lab-safety";
import { LAB_FLAG_LABEL } from "@/lib/labs/types";

import type { RedFlagReport } from "./escalation";
import { renderSummaryText, type SummaryDocument, type SummaryLine, type SummarySection } from "./summary-document";

export type SummaryCompound = {
  name: string;
  officialName?: string;
  compoundClass?: string;
  route?: string;
  /** Exactly as the member entered it. */
  amount?: string;
  unit?: string;
  frequency?: string;
  startDate?: string;
  isActive: boolean;
  clinicianOversight?: boolean;
};

export type ClinicianSummaryInput = {
  generatedAt: Date;
  cycleState?: CycleState | null;
  compounds: SummaryCompound[];
  labBrief?: LabSafetyBrief | null;
  redFlagReports?: RedFlagReport[];
};

export function buildClinicianSummaryDocument(input: ClinicianSummaryInput): SummaryDocument {
  const sections: SummarySection[] = [];

  const cycle = input.cycleState;
  if (cycle) {
    const lines: SummaryLine[] = [
      { kind: "text", text: `${cycle.cycle.name}: ${cycle.cycle.startDate} to ${cycle.plannedEnd} (${cycle.totalWeeks} weeks planned)` },
      {
        kind: "text",
        text: `Status: ${CYCLE_PHASE_LABEL[cycle.phase]}${cycle.phase === "on-cycle" ? `, week ${cycle.weekNumber} of ${cycle.totalWeeks}` : ""}${cycle.cycle.endedOn ? `, ended ${cycle.cycle.endedOn}` : ""}`,
      },
      { kind: "text", text: `Clinician oversight marked by member: ${cycle.cycle.clinicianOversight ? "yes" : "no"}` },
    ];
    if (cycle.checkpoints.length) {
      lines.push({ kind: "text", text: "Lab checkpoints:" });
      for (const checkpoint of cycle.checkpoints) {
        lines.push({ kind: "item", text: `${checkpoint.date} ${checkpoint.label} (${checkpoint.status}${checkpoint.metByLabDate ? `, lab ${checkpoint.metByLabDate}` : ""})` });
      }
    }
    sections.push({ heading: "PLANNED CYCLE (member-stated)", lines });
  }

  const compoundLines: SummaryLine[] = [];
  if (input.compounds.length === 0) compoundLines.push({ kind: "note", text: "None logged." });
  for (const compound of input.compounds) {
    const detail = [
      compound.amount ? `${compound.amount}${compound.unit ? ` ${compound.unit}` : ""}` : null,
      compound.frequency || null,
      compound.route || null,
      compound.startDate ? `since ${compound.startDate}` : null,
      compound.isActive ? "active" : "inactive",
    ].filter(Boolean).join(" · ");
    compoundLines.push({ kind: "item", text: `${compound.name}${detail ? ` — ${detail}` : ""}` });
  }
  sections.push({ heading: "COMPOUNDS, MEDICATIONS AND SUPPLEMENTS (as entered by the member)", lines: compoundLines });

  const prep = visitPrepSection(input);
  if (prep) sections.push(prep);

  const brief = input.labBrief;
  if (brief) {
    const lines: SummaryLine[] = [];
    if (brief.findings.length === 0) lines.push({ kind: "note", text: "No results outside the report's reference ranges." });
    for (const finding of brief.findings) {
      const r = finding.latest;
      const flag = r.labFlag ? ` [lab flag: ${LAB_FLAG_LABEL[r.labFlag]}]` : "";
      const range = r.rangeText ? ` (ref ${r.rangeText})` : "";
      const previous = finding.previous ? `; previous ${finding.previous.valueText} on ${finding.previous.date}` : "";
      lines.push({ kind: "item", text: `${finding.label}: ${r.valueText}${r.unit ? ` ${r.unit}` : ""}${range}${flag} on ${r.date}${previous}` });
    }
    if (brief.untested.length) {
      lines.push({ kind: "text", text: `Commonly watched for logged compounds but not in labs from the last 6 months: ${brief.untested.map((u) => u.label).join(", ")}` });
    }
    sections.push({ heading: `LAB RESULTS FLAGGED${brief.latestLabDate ? ` (latest draw ${brief.latestLabDate})` : ""}`, lines });
  }

  const reports = input.redFlagReports ?? [];
  if (reports.length) {
    sections.push({
      heading: "SYMPTOMS REPORTED IN RESERVE",
      lines: reports.slice(0, 10).map((report) => ({
        kind: "item" as const,
        text: `${report.reportedAt.slice(0, 10)}: ${report.flags.map((flag) => RED_FLAGS[flag]?.label ?? flag).join("; ")}`,
      })),
    });
  }

  return {
    title: "MEMBER HEALTH RECORD SUMMARY",
    intro: [
      `Prepared ${input.generatedAt.toLocaleString("en-US")} from member-entered records in Reserve, for a clinician, urgent care, a telehealth visit or a pharmacist.`,
      "Reserve flags compare results to the reference range printed on the member's own lab report. They are not a clinical assessment.",
    ],
    sections,
    footer: [],
  };
}

/* ─── Visit prep ──────────────────────────────────────────────────────── */

/** Questions a member can put to whoever reviews their records, by the body system a compound affects. */
export const VISIT_QUESTIONS: Partial<Record<RiskSystem, string>> = {
  cardiovascular: "How often should my blood pressure be checked while I use this, and what reading should make me get seen?",
  blood: "Do my hematocrit and hemoglobin need rechecking, and what should happen if they are high?",
  lipids: "Do my cholesterol results change what should be monitored?",
  liver: "Do my liver results need follow-up, and which symptoms mean I should be seen quickly?",
  kidney: "Do my kidney results need follow-up, given creatine use or muscle mass?",
  hormonal: "What should I know about estrogen, prolactin and my own testosterone production?",
  fertility: "What should I know about fertility and recovery of my own testosterone production after use ends?",
  prostate: "Should my PSA be checked, and how often?",
  skin: "What are the treatment options for acne or hair loss from androgens, and how do they affect my blood pressure and heart?",
  mood: "Are the mood or sleep changes I have noticed worth addressing, and where can I get support?",
  metabolic: "Should my glucose or A1c be checked?",
  thyroid: "Do my thyroid results need follow-up?",
};

function visitPrepSection(input: ClinicianSummaryInput): SummarySection | null {
  const active = input.compounds.filter((c) => c.isActive);
  const history = input.labBrief?.history ?? {};
  const lines: SummaryLine[] = [];
  for (const compound of active) {
    const profiles = profilesForCompound({ name: compound.name, officialName: compound.officialName, compoundClass: compound.compoundClass })
      .filter((profile) => profile.regulatory !== "supplement");
    if (profiles.length === 0) continue;

    const markers = [...new Set(profiles.flatMap((profile) => profile.monitoredMarkers))] as MarkerKey[];
    const systems = [...new Set(profiles.flatMap((profile) => profile.systems.map((s) => s.system)))];
    const redFlags = [...new Set(profiles.flatMap((profile) => profile.redFlags))];

    lines.push({ kind: "text", text: compound.name });
    if (markers.length) {
      const readings = markers.map((key) => {
        const latest = history[key]?.[0];
        const label = markerDef(key).label;
        return latest ? `${label} ${latest.valueText}${latest.unit ? ` ${latest.unit}` : ""} (${latest.date})` : `${label}: not tested`;
      });
      lines.push({ kind: "item", text: `Commonly watched: ${readings.join("; ")}` });
    }
    if (redFlags.length) {
      lines.push({ kind: "item", text: `Warning signs that need care right away: ${redFlags.map((flag) => RED_FLAGS[flag]?.label ?? flag).join("; ")}` });
    }
    for (const system of systems) {
      const question = VISIT_QUESTIONS[system];
      if (question) lines.push({ kind: "item", text: `Ask: ${question}` });
    }
  }
  return lines.length ? { heading: "WHAT TO WATCH AND WHAT TO ASK (by compound, from Reserve's cited risk profiles)", lines } : null;
}

export function buildClinicianSummary(input: ClinicianSummaryInput): string {
  return renderSummaryText(buildClinicianSummaryDocument(input));
}
