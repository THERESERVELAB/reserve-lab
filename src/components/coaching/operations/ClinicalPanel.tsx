"use client";

/* ════════════════════════════════════════════════════════════════════════
   CLINICAL COORDINATION — coach view. Documentation only.

   A restricted area that exists ONLY under the athlete's explicit
   clinical consent — full coaching access never opens it. The coach can
   view records the athlete disclosed, and add neutral observations only
   when consent allows notes. Coaches can never create, edit, or delete
   clinical records. Reserve does not prescribe, diagnose, dose, or
   recommend compounds — ever.
   ════════════════════════════════════════════════════════════════════════ */

import { useMemo, useState } from "react";
import { Eye, FileLock2, ShieldAlert, Stethoscope } from "lucide-react";

import { CareOptions } from "@/components/safety/CareOptions";
import { canView } from "@/lib/coaching/permissions";
import { EMERGENCY_COPY, ESCALATION_LABEL } from "@/lib/safety/escalation";
import { useCoachingStore } from "@/lib/coaching/store";
import {
  CLINICAL_ACKNOWLEDGEMENT,
  CLINICAL_CATEGORY_LABELS,
  type ClinicalCoordinationRecord,
  type ClinicalObservationKind,
} from "@/lib/coaching/operations/types";
import type { CoachingRelationship } from "@/lib/coaching/types";
import {
  CommandButton,
  EmptyState,
  Field,
  MicroLabel,
  Panel,
  PanelHeader,
  StatusChip,
  inputClass,
  relativeTime,
} from "../ui";

const OBSERVATION_KINDS: Array<{ value: ClinicalObservationKind; label: string }> = [
  { value: "energy", label: "Energy" },
  { value: "sleep", label: "Sleep" },
  { value: "mood", label: "Mood" },
  { value: "appetite", label: "Appetite" },
  { value: "training_performance", label: "Training performance" },
  { value: "resting_heart_rate", label: "Resting heart rate" },
  { value: "blood_pressure", label: "Blood pressure" },
  { value: "digestive", label: "Digestive" },
  { value: "skin", label: "Skin" },
  { value: "injection_site", label: "Injection site" },
  { value: "other", label: "Other" },
];

export function ClinicalPanel({
  athleteId,
  relationship,
}: {
  athleteId: string;
  relationship: CoachingRelationship | null;
}) {
  const db = useCoachingStore((s) => s.db);
  const consent = useMemo(
    () =>
      relationship
        ? db.clinicalConsents.find((c) => c.relationshipId === relationship.id && !c.revokedAt) ?? null
        : null,
    [db.clinicalConsents, relationship],
  );
  const activeConsent = consent && consent.scope !== "none" ? consent : null;
  const permitted = activeConsent !== null && canView(relationship, "clinicalRecords");

  if (!permitted) {
    return (
      <div className="flex flex-col gap-3">
        <Panel>
          <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
            <FileLock2 size={20} className="text-white/25" />
            <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-[#d5b15f]/60">
              Separate consent required
            </div>
            <p className="max-w-md text-xs leading-5 text-white/40">
              Clinical coordination is never part of full coaching access. It opens only when the
              athlete grants explicit clinical consent from their own workspace — and they can revoke
              it at any time. Until then, nothing in this area is visible to you.
            </p>
            <p className="max-w-md border-t border-white/[0.06] pt-3 text-[9px] leading-4 text-white/25">
              {CLINICAL_ACKNOWLEDGEMENT}
            </p>
          </div>
        </Panel>
      </div>
    );
  }

  const records = db.clinicalRecords
    .filter((r) => r.athleteId === athleteId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const accessLog = db.clinicalAccessLog
    .filter((e) => e.recordScopeAthleteId === athleteId)
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 12);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <StatusChip tone="teal">
            <span className="flex items-center gap-1"><Eye size={10} /> Consent: {activeConsent.scope === "view_and_note" ? "View + observations" : "View only"}</span>
          </StatusChip>
          <StatusChip tone="neutral">Granted {relativeTime(activeConsent.grantedAt)}</StatusChip>
        </div>
        <MicroLabel>Documentation only — read access</MicroLabel>
      </div>

      <Panel className="border-white/[0.05]">
        <div className="flex items-start gap-3 px-4 py-3">
          <Stethoscope size={14} className="mt-0.5 shrink-0 text-white/30" />
          <p className="text-[10px] leading-4 text-white/40">
            {CLINICAL_ACKNOWLEDGEMENT} Records here are athlete-owned documentation — you can review
            them and, if consented, add neutral observations. You cannot create, modify, or remove
            records. Every access is logged and visible to the athlete.
          </p>
        </div>
      </Panel>

      {records.length === 0 ? (
        <EmptyState
          title="No disclosed records"
          body="When the athlete documents clinician-directed or self-disclosed clinical information, it appears here under their consent terms."
        />
      ) : (
        records.map((record) => (
          <ClinicalRecordCard
            key={record.id}
            record={record}
            canNote={activeConsent.scope === "view_and_note"}
          />
        ))
      )}

      <Panel>
        <PanelHeader label="Transparency" title="Access log" />
        <div className="flex flex-col gap-1 p-4">
          {accessLog.length === 0 ? (
            <p className="text-[10px] text-white/30">No access recorded yet.</p>
          ) : (
            accessLog.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between text-[10px]">
                <span className="text-white/45 capitalize">
                  {entry.action.replace(/_/g, " ")}
                  {entry.detail ? ` — ${entry.detail.replace(/_/g, " ")}` : ""}
                </span>
                <span className="font-mono text-white/25">{relativeTime(entry.at)}</span>
              </div>
            ))
          )}
        </div>
      </Panel>
    </div>
  );
}

/* ─── Record card ─────────────────────────────────────────────────────── */

function ClinicalRecordCard({
  record,
  canNote,
}: {
  record: ClinicalCoordinationRecord;
  canNote: boolean;
}) {
  const db = useCoachingStore((s) => s.db);
  const actorId = useCoachingStore((s) => s.actorId);
  const run = useCoachingStore((s) => s.run);
  const [noting, setNoting] = useState(false);
  const [kind, setKind] = useState<ClinicalObservationKind>("training_performance");
  const [note, setNote] = useState("");

  const observations = db.clinicalObservations
    .filter((o) => o.recordId === record.id)
    .sort((a, b) => b.at.localeCompare(a.at));

  const saveObservation = async () => {
    if (!note.trim()) return;
    const saved = await run((r) =>
      r.ops.clinical.addObservation(
        {
          recordId: record.id,
          athleteId: record.athleteId,
          authorId: actorId,
          authorRole: "coach",
          kind,
          note: note.trim(),
          severity: "routine",
        },
        actorId,
      ),
    );
    if (saved) {
      setNote("");
      setNoting(false);
    }
  };

  return (
    <Panel>
      <PanelHeader
        label={CLINICAL_CATEGORY_LABELS[record.category]}
        title={record.disclosedName}
        right={
          <StatusChip tone={record.status === "active" ? "green" : "neutral"}>
            {record.status.replace(/_/g, " ")}
          </StatusChip>
        }
      />
      <div className="flex flex-col gap-3 p-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <ReadFact label="Clinician / practice" value={record.clinicianOrPractice ?? "—"} />
          <ReadFact label="Prescription status" value={record.prescriptionStatus.replace(/_/g, " ")} />
          <ReadFact label="Documentation" value={record.documentationStatus.replace(/_/g, " ")} />
          <ReadFact label="Started" value={record.startDate ?? "—"} />
          <ReadFact label="Clinician review" value={record.reviewDate ?? "—"} />
          <ReadFact label="Lab reminder" value={record.labReminderDate ?? "—"} />
        </div>
        {record.athleteReportedSchedule && (
          <ReadFact label="Athlete-reported schedule (stored verbatim)" value={record.athleteReportedSchedule} wide />
        )}
        {record.monitoringRequirements && (
          <ReadFact label="Monitoring requirements (clinician-directed)" value={record.monitoringRequirements} wide />
        )}

        {/* Observations */}
        <div className="border-t border-white/[0.05] pt-3">
          <div className="flex items-center justify-between">
            <MicroLabel>Observations ({observations.length})</MicroLabel>
            <CommandButton
              variant="ghost"
              disabled={!canNote}
              disabledReason="The athlete's consent is view-only — observations require expanded consent"
              onClick={() => setNoting((v) => !v)}
            >
              Add observation
            </CommandButton>
          </div>
          {noting && canNote && (
            <div className="mt-2 flex flex-col gap-2 border-t border-white/[0.06] p-3">
              <Field label="Observation type">
                <select className={inputClass} value={kind} onChange={(e) => setKind(e.target.value as ClinicalObservationKind)}>
                  {OBSERVATION_KINDS.map((k) => (
                    <option key={k.value} value={k.value}>{k.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Neutral observation — no interpretation, no guidance" hint="Reserve stores what was observed. Medical decisions stay with the athlete's clinician.">
                <textarea className={`${inputClass} min-h-[52px] resize-none`} value={note} onChange={(e) => setNote(e.target.value)} />
              </Field>
              <div className="flex gap-1.5">
                <CommandButton onClick={() => void saveObservation()}>Save observation</CommandButton>
                <CommandButton variant="ghost" onClick={() => setNoting(false)}>Cancel</CommandButton>
              </div>
            </div>
          )}
          <div className="mt-2 flex flex-col gap-1.5">
            {observations.map((obs) => (
              <div key={obs.id} className="border-t border-white/[0.06] px-3 py-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-white/35">
                    {obs.kind.replace(/_/g, " ")} · {obs.authorRole}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {obs.severity === "urgent" && <StatusChip tone="red">Urgent</StatusChip>}
                    {obs.severity === "notable" && <StatusChip tone="amber">Notable</StatusChip>}
                    <span className="font-mono text-[9px] text-white/25">{relativeTime(obs.at)}</span>
                  </div>
                </div>
                <p className="mt-1 text-[11px] leading-4 text-white/60">{obs.note}</p>
                {obs.severity === "urgent" && (
                  <div className="mt-1.5 border-t border-[#ef7d55]/15 pt-1.5">
                    <p className="flex items-start gap-1.5 text-[12px] leading-[1.45] text-[#ef7d55]">
                      <ShieldAlert size={12} aria-hidden="true" className="mt-0.5 shrink-0" />
                      <span>
                        <strong className="font-semibold">{ESCALATION_LABEL["contact-clinician-today"]}.</strong> {EMERGENCY_COPY.urgent}
                      </span>
                    </p>
                    <p className="mt-1 text-[11.5px] text-white/60">This record is documentation, not an assessment.</p>
                    <CareOptions />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Panel>
  );
}

function ReadFact({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={`border-t border-white/[0.06] px-3 py-2 ${wide ? "col-span-full" : ""}`}>
      <MicroLabel>{label}</MicroLabel>
      <div className="mt-0.5 text-[11px] font-medium capitalize text-[#f2eee6]">{value}</div>
    </div>
  );
}
