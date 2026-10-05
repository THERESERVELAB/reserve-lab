/* ════════════════════════════════════════════════════════════════════════
   ESCALATION LADDER — how Reserve acts on what it knows.

   Reserve's action is always to route the member to the right human, at the
   right urgency. It never tells a member to change, start or stop anything.

     crisis                   thoughts of self-harm → 988 and emergency services
     emergency                red-flag symptoms → call emergency services now
     contact-clinician-today  a lab the lab itself marked critical
     discuss-with-clinician   results outside the report's range; past the
                              member's own planned end with compounds active
     note                     trends to watch, overdue lab checkpoints,
                              commonly watched markers missing from labs
   ════════════════════════════════════════════════════════════════════════ */

import { RED_FLAGS, type RedFlagKey } from "@/lib/compound-intelligence/risk-profiles";
import type { CycleState } from "@/lib/cycle/cycle-period";
import type { LabSafetyBrief } from "@/lib/labs/lab-safety";

export type EscalationLevel = "crisis" | "emergency" | "contact-clinician-today" | "discuss-with-clinician" | "note";

export const ESCALATION_ORDER: Record<EscalationLevel, number> = {
  crisis: 0,
  emergency: 1,
  "contact-clinician-today": 2,
  "discuss-with-clinician": 3,
  note: 4,
};

export const ESCALATION_LABEL: Record<EscalationLevel, string> = {
  crisis: "Get support now",
  emergency: "Emergency",
  "contact-clinician-today": "Get a medical review today",
  "discuss-with-clinician": "Get this reviewed",
  note: "Keep an eye on",
};

export const EMERGENCY_COPY = {
  emergency: "Call 911 or your local emergency number now. Do not drive yourself.",
  urgent: "Get medical care today — your clinician, an urgent care clinic, a telehealth visit or an emergency department.",
  crisis: "Call or text 988 to reach the Suicide & Crisis Lifeline (US), or call 911 if you are in immediate danger.",
} as const;

export type EscalationItem = {
  id: string;
  level: EscalationLevel;
  title: string;
  body: string;
  source: "symptom" | "lab" | "cycle";
};

export type RedFlagReport = {
  id: string;
  /** ISO timestamp */
  reportedAt: string;
  flags: RedFlagKey[];
};

function listLabels(labels: string[]): string {
  if (labels.length <= 1) return labels[0] ?? "";
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")} and ${labels.at(-1)}`;
}

function formatDate(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function escalationForSymptoms(flags: RedFlagKey[]): EscalationItem[] {
  const unique = [...new Set(flags)].filter((flag) => RED_FLAGS[flag]);
  const items: EscalationItem[] = [];
  const byAction = (action: "crisis" | "emergency" | "urgent") => unique.filter((flag) => RED_FLAGS[flag].action === action);

  const crisis = byAction("crisis");
  if (crisis.length) {
    items.push({ id: "symptom-crisis", level: "crisis", source: "symptom", title: "You don't have to handle this alone", body: EMERGENCY_COPY.crisis });
  }
  const emergency = byAction("emergency");
  if (emergency.length) {
    items.push({
      id: "symptom-emergency",
      level: "emergency",
      source: "symptom",
      title: "These symptoms need emergency care",
      body: `${listLabels(emergency.map((flag) => RED_FLAGS[flag].label))}. ${EMERGENCY_COPY.emergency}`,
    });
  }
  const urgent = byAction("urgent");
  if (urgent.length) {
    items.push({
      id: "symptom-urgent",
      level: emergency.length ? "emergency" : "contact-clinician-today",
      source: "symptom",
      title: "Get medical care today",
      body: `${listLabels(urgent.map((flag) => RED_FLAGS[flag].label))}. ${EMERGENCY_COPY.urgent}`,
    });
  }
  return items;
}

export function buildEscalation(input: {
  labBrief?: LabSafetyBrief | null;
  cycleState?: CycleState | null;
  recentRedFlags?: RedFlagKey[];
}): EscalationItem[] {
  const items: EscalationItem[] = [...escalationForSymptoms(input.recentRedFlags ?? [])];
  const brief = input.labBrief;

  if (brief) {
    for (const finding of brief.findings.filter((f) => f.tier === "urgent")) {
      const value = `${finding.latest.valueText}${finding.latest.unit ? ` ${finding.latest.unit}` : ""}`;
      items.push({
        id: `lab-urgent-${finding.id}`,
        level: "contact-clinician-today",
        source: "lab",
        title: `${finding.label}: marked critical by the lab`,
        body: `Your ${formatDate(finding.latest.date)} result was ${value}. Have it looked at today: the clinician who ordered the test, your own clinician, urgent care or a telehealth visit. If you feel unwell, seek emergency care.`,
      });
    }
    const discuss = brief.findings.filter((f) => f.tier === "discuss");
    if (discuss.length) {
      items.push({
        id: "lab-discuss",
        level: "discuss-with-clinician",
        source: "lab",
        title: `${discuss.length} ${discuss.length === 1 ? "result is" : "results are"} outside your lab's range`,
        body: `${listLabels(discuss.map((f) => f.label))}. Have these results reviewed soon — by your clinician, or without one, a telehealth or urgent care visit.`,
      });
    }
    for (const finding of brief.findings.filter((f) => f.tier === "watch")) {
      items.push({
        id: `lab-watch-${finding.id}`,
        level: "note",
        source: "lab",
        title: `${finding.label} is trending toward a limit`,
        body: finding.reasons[0] ?? "Moving toward the edge of your lab's range.",
      });
    }
    if (brief.untested.length) {
      items.push({
        id: "lab-untested",
        level: "note",
        source: "lab",
        title: "Not in your recent labs",
        body: `${listLabels(brief.untested.slice(0, 6).map((u) => u.label))} ${brief.untested.length === 1 ? "is" : "are"} commonly watched for compounds you logged. A clinician can say whether testing applies to you.`,
      });
    }
  }

  const cycle = input.cycleState;
  if (cycle) {
    if (cycle.stillActivePastEnd) {
      items.push({
        id: "cycle-past-end",
        level: "discuss-with-clinician",
        source: "cycle",
        title: "Past the end date you planned",
        body: `You planned to finish ${cycle.cycle.name} on ${formatDate(cycle.plannedEnd)}. ${listLabels(cycle.activePastEndNames)} ${cycle.activePastEndNames.length === 1 ? "is" : "are"} still active in your log. Update your plan in Reserve, and have it reviewed by a clinician or a telehealth visit.`,
      });
    }
    for (const checkpoint of cycle.overdueCheckpoints) {
      items.push({
        id: `cycle-checkpoint-${checkpoint.id}`,
        level: "note",
        source: "cycle",
        title: "Bloodwork checkpoint overdue",
        body: `${checkpoint.label} was set for ${formatDate(checkpoint.date)}. No lab from around that date is logged yet.`,
      });
    }
    if (!cycle.cycle.clinicianOversight && (cycle.phase === "on-cycle" || cycle.phase === "past-planned-end")) {
      items.push({
        id: "cycle-no-clinician",
        level: "note",
        source: "cycle",
        title: "No clinician on this cycle",
        body: "Without one, urgent care, a telehealth visit or a pharmacist can still review your labs and plan, and in most states you can order lab tests yourself. Reserve can prepare a summary for any of them.",
      });
    }
  }

  return items.sort((a, b) => ESCALATION_ORDER[a.level] - ESCALATION_ORDER[b.level]);
}
