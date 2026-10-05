"use client";

/* ════════════════════════════════════════════════════════════════════════
   ATHLETE OPERATIONS — the athlete's side of Performance Operations.

   Today's directive, the supplement protocol presented as moments of the
   day, meal-plan review and logging, grocery interaction, and clinical
   consent — which the athlete alone owns, grants, limits, and revokes.
   ════════════════════════════════════════════════════════════════════════ */

import { useMemo, useState } from "react";
import { Check, Compass, FileLock2, ShoppingCart, X } from "lucide-react";

import { CareOptions } from "@/components/safety/CareOptions";
import { todayKey } from "@/lib/coaching/ids";
import { EMERGENCY_COPY, ESCALATION_LABEL } from "@/lib/safety/escalation";
import { useCoachingStore } from "@/lib/coaching/store";
import {
  CLINICAL_ACKNOWLEDGEMENT,
  CLINICAL_CATEGORY_LABELS,
  PROTOCOL_MOMENTS,
  PROTOCOL_MOMENT_LABELS,
  type AdherenceMark,
  type ClinicalCategory,
  type ClinicalConsentScope,
  type DailyDirective,
  type MealPlan,
  type SupplementProtocol,
} from "@/lib/coaching/operations/types";
import type { CoachingRelationship } from "@/lib/coaching/types";
import {
  CommandButton,
  Field,
  MicroLabel,
  Panel,
  PanelHeader,
  StatusChip,
  inputClass,
  relativeTime,
} from "../ui";

export function AthleteOperations({ relationship }: { relationship: CoachingRelationship }) {
  const db = useCoachingStore((s) => s.db);
  const actorId = useCoachingStore((s) => s.actorId);

  const directives = db.dailyDirectives.filter((d) => d.athleteId === actorId && d.status === "delivered");
  const todayDirective = directives.find((d) => d.date === todayKey()) ?? null;
  const protocols = db.supplementProtocols.filter((p) => p.athleteId === actorId);
  const sentProtocols = protocols.filter((p) => p.status === "sent");
  const activeProtocol = protocols.find((p) => p.status === "active") ?? null;
  const mealPlans = db.mealPlans.filter((p) => p.athleteId === actorId);
  const sentPlans = mealPlans.filter((p) => p.status === "sent");
  const activePlan = mealPlans.find((p) => p.status === "active") ?? null;
  const groceryPlan = db.groceryPlans
    .filter((p) => p.athleteId === actorId && p.status !== "complete")
    .sort((a, b) => b.weekOf.localeCompare(a.weekOf))[0] ?? null;

  return (
    <div className="flex flex-col gap-4">
      {/* Today's directive */}
      {todayDirective && <TodayDirective directive={todayDirective} />}

      {/* Protocol review inbox */}
      {sentProtocols.map((protocol) => (
        <ProtocolDecision key={protocol.id} protocol={protocol} />
      ))}

      {/* Active protocol — presented as moments, never a spreadsheet */}
      {activeProtocol && <ProtocolMoments protocol={activeProtocol} />}

      {/* Meal plan review inbox */}
      {sentPlans.map((plan) => (
        <MealPlanDecision key={plan.id} plan={plan} />
      ))}

      {/* Active plan — today's logging */}
      {activePlan && <MealPlanToday plan={activePlan} />}

      {/* Grocery quick actions */}
      {groceryPlan && <GroceryQuick planId={groceryPlan.id} />}

      {/* Clinical consent — athlete-owned */}
      <ClinicalOwnership relationship={relationship} />
    </div>
  );
}

/* ─── Today's directive + acknowledgement ─────────────────────────────── */

function formatAckTime(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return sameDay ? `Today, ${time}` : `${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}, ${time}`;
}

function TodayDirective({ directive }: { directive: DailyDirective }) {
  const actorId = useCoachingStore((s) => s.actorId);
  const run = useCoachingStore((s) => s.run);
  const [pending, setPending] = useState(false);

  const acknowledge = async () => {
    setPending(true);
    await run((r) => r.ops.directive.acknowledge(directive.id, actorId));
    setPending(false);
  };

  return (
    <Panel glow>
      <PanelHeader
        label="From your coach"
        title="Today's directive"
        right={<Compass size={14} className="text-[#d5b15f]/60" />}
      />
      <div className="flex flex-col gap-3 p-4">
        <p className="type-body text-[#f2eee6]/90">{directive.body}</p>
        <div className="flex items-center justify-between border-t border-white/[0.05] pt-3">
          {directive.acknowledgedAt ? (
            <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-[#6ee7b7]/90">
              <Check size={12} /> Acknowledged · {formatAckTime(directive.acknowledgedAt)}
            </span>
          ) : (
            <>
              <span className="text-[10px] text-white/40">Confirm you&apos;ve seen today&apos;s direction.</span>
              <CommandButton disabled={pending} disabledReason="Saving…" onClick={() => void acknowledge()}>
                {pending ? "Saving…" : "Acknowledge"}
              </CommandButton>
            </>
          )}
        </div>
      </div>
    </Panel>
  );
}

/* ─── Protocol decision (sent → athlete review) ───────────────────────── */

function ProtocolDecision({ protocol }: { protocol: SupplementProtocol }) {
  const run = useCoachingStore((s) => s.run);
  const actorId = useCoachingStore((s) => s.actorId);
  const [revising, setRevising] = useState(false);
  const [note, setNote] = useState("");

  const decide = (decision: "accepted" | "revision_requested" | "declined") =>
    void run((r) => r.ops.protocols.decide(protocol.id, actorId, decision, note.trim() || undefined));

  return (
    <Panel glow className="border-[#5fb7d5]/20">
      <PanelHeader label="Awaiting your approval" title={`Supplement protocol — ${protocol.name}`} right={<StatusChip tone="teal" pulse>Review</StatusChip>} />
      <div className="flex flex-col gap-3 p-4">
        <p className="text-[11px] leading-5 text-white/55">{protocol.objective}</p>
        {protocol.coachRationale && (
          <p className="border-l-2 border-[#d5b15f]/25 pl-3 text-[10px] italic text-white/45">{protocol.coachRationale}</p>
        )}
        <div className="flex flex-col gap-1">
          {protocol.items.map((item) => (
            <div key={item.id} className="flex items-center justify-between border-t border-white/[0.06] px-3 py-1.5">
              <span className="text-[10px] text-white/65">{item.productName} · {item.servingDescription}</span>
              <span className="font-mono text-[8px] uppercase text-white/30">{PROTOCOL_MOMENT_LABELS[item.moment]}</span>
            </div>
          ))}
        </div>
        {revising && (
          <Field label="What should change?">
            <textarea className={`${inputClass} min-h-[48px] resize-none`} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        )}
        <div className="flex flex-wrap gap-1.5">
          {!revising ? (
            <>
              <CommandButton onClick={() => decide("accepted")}>Accept protocol</CommandButton>
              <CommandButton variant="ghost" onClick={() => setRevising(true)}>Request revision</CommandButton>
              <CommandButton variant="danger" onClick={() => decide("declined")}>Decline</CommandButton>
            </>
          ) : (
            <>
              <CommandButton disabled={!note.trim()} disabledReason="Tell your coach what to change" onClick={() => decide("revision_requested")}>Send revision request</CommandButton>
              <CommandButton variant="ghost" onClick={() => setRevising(false)}>Back</CommandButton>
            </>
          )}
        </div>
      </div>
    </Panel>
  );
}

/* ─── Protocol moments (active protocol, daily execution) ─────────────── */

function ProtocolMoments({ protocol }: { protocol: SupplementProtocol }) {
  const db = useCoachingStore((s) => s.db);
  const actorId = useCoachingStore((s) => s.actorId);
  const run = useCoachingStore((s) => s.run);
  const today = todayKey();
  const marks = useMemo(() => {
    const map = new Map<string, AdherenceMark>();
    for (const entry of db.protocolAdherence) {
      if (entry.protocolId === protocol.id && entry.date === today) map.set(entry.itemId, entry.mark);
    }
    return map;
  }, [db.protocolAdherence, protocol.id, today]);

  const mark = (itemId: string, value: AdherenceMark) =>
    void run((r) => r.ops.protocols.logAdherence({ protocolId: protocol.id, athleteId: actorId, itemId, date: today, mark: value }));
  const flag = (itemId: string, value: "running_low" | "unavailable") =>
    void run((r) => r.ops.protocols.setItemFlag(protocol.id, itemId, actorId, value));

  const done = protocol.items.filter((i) => marks.has(i.id)).length;

  return (
    <Panel>
      <PanelHeader
        label={protocol.name}
        title="Today's protocol"
        right={<StatusChip tone={done === protocol.items.length ? "green" : "neutral"}>{done}/{protocol.items.length} logged</StatusChip>}
      />
      <div className="flex flex-col gap-2.5 p-4">
        {PROTOCOL_MOMENTS.map((moment) => {
          const items = protocol.items.filter((i) => i.moment === moment);
          if (items.length === 0) return null;
          return (
            <div key={moment} className="border-t border-white/[0.06] p-3">
              <MicroLabel tone="champagne">{PROTOCOL_MOMENT_LABELS[moment]}</MicroLabel>
              <div className="mt-1.5 flex flex-col gap-1.5">
                {items.map((item) => {
                  const current = marks.get(item.id);
                  return (
                    <div key={item.id} className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className={`text-[11px] font-medium ${current === "taken" ? "text-white/40 line-through" : "text-[#f2eee6]"}`}>
                          {item.productName}
                        </span>
                        <span className="ml-2 font-mono text-[9px] text-white/35">{item.servingDescription}</span>
                        {item.withFood === "with_food" && <span className="ml-1.5 text-[8px] text-white/30">with food</span>}
                        {item.runningLow && <StatusChip tone="amber">Low</StatusChip>}
                      </div>
                      <div className="flex items-center gap-1">
                        <MarkButton active={current === "taken"} tone="green" label="Taken" onClick={() => mark(item.id, "taken")} icon={<Check size={10} />} />
                        <MarkButton active={current === "skipped"} tone="amber" label="Skipped" onClick={() => mark(item.id, "skipped")} icon={<X size={10} />} />
                        <MarkButton active={current === "unavailable"} tone="red" label="Unavailable" onClick={() => { mark(item.id, "unavailable"); flag(item.id, "unavailable"); }} />
                        {!item.runningLow && (
                          <button
                            type="button"
                            onClick={() => flag(item.id, "running_low")}
                            className="rounded-md border border-white/[0.07] px-1.5 py-1 font-mono text-[9px] uppercase tracking-[0.08em] text-white/35 hover:text-[#e8c87a]"
                          >
                            Running low
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function MarkButton({
  active,
  tone,
  label,
  onClick,
  icon,
}: {
  active: boolean;
  tone: "green" | "amber" | "red";
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
}) {
  const colors = { green: "#6ee7b7", amber: "#e8c87a", red: "#ef7d55" };
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="flex items-center gap-1 rounded-md border px-2 py-1.5 font-mono text-[9px] uppercase tracking-[0.08em] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#d5b15f]/45"
      style={{
        borderColor: active ? `${colors[tone]}66` : "rgba(255,255,255,0.07)",
        background: active ? `${colors[tone]}14` : "transparent",
        color: active ? colors[tone] : "rgba(255,255,255,0.35)",
      }}
    >
      {icon}
      {label}
    </button>
  );
}

/* ─── Meal plan decision + today's logging ────────────────────────────── */

function MealPlanDecision({ plan }: { plan: MealPlan }) {
  const run = useCoachingStore((s) => s.run);
  const actorId = useCoachingStore((s) => s.actorId);
  const [revising, setRevising] = useState(false);
  const [note, setNote] = useState("");

  const decide = (decision: "accepted" | "revision_requested" | "declined") =>
    void run((r) => r.ops.nutritionOps.decideMealPlan(plan.id, actorId, decision, note.trim() || undefined));

  return (
    <Panel glow className="border-[#5fb7d5]/20">
      <PanelHeader label="Awaiting your approval" title={`Meal plan — ${plan.name}`} right={<StatusChip tone="teal" pulse>Review</StatusChip>} />
      <div className="flex flex-col gap-3 p-4">
        {plan.coachNote && <p className="border-l-2 border-[#d5b15f]/25 pl-3 text-[10px] italic text-white/45">{plan.coachNote}</p>}
        <div className="flex flex-col gap-1">
          {plan.meals.map((meal) => (
            <div key={meal.id} className="border-t border-white/[0.06] px-3 py-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium text-white/70">{meal.name}</span>
                <span className="font-mono text-[8px] text-white/30">{meal.timeWindow}</span>
              </div>
              <p className="text-[9px] text-white/40">{meal.ingredients.map((i) => `${i.name} ${i.portion}`).join(" · ")}</p>
            </div>
          ))}
        </div>
        {revising && (
          <Field label="What should change?">
            <textarea className={`${inputClass} min-h-[48px] resize-none`} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        )}
        <div className="flex flex-wrap gap-1.5">
          {!revising ? (
            <>
              <CommandButton onClick={() => decide("accepted")}>Accept plan</CommandButton>
              <CommandButton variant="ghost" onClick={() => setRevising(true)}>Request changes</CommandButton>
              <CommandButton variant="danger" onClick={() => decide("declined")}>Decline</CommandButton>
            </>
          ) : (
            <>
              <CommandButton disabled={!note.trim()} disabledReason="Tell your coach what to change" onClick={() => decide("revision_requested")}>Send request</CommandButton>
              <CommandButton variant="ghost" onClick={() => setRevising(false)}>Back</CommandButton>
            </>
          )}
        </div>
      </div>
    </Panel>
  );
}

function MealPlanToday({ plan }: { plan: MealPlan }) {
  const db = useCoachingStore((s) => s.db);
  const actorId = useCoachingStore((s) => s.actorId);
  const run = useCoachingStore((s) => s.run);
  const today = todayKey();
  const completions = useMemo(() => {
    const map = new Map<string, string>();
    for (const entry of db.mealCompletions) {
      if (entry.planId === plan.id && entry.date === today) map.set(entry.mealId, entry.mark);
    }
    return map;
  }, [db.mealCompletions, plan.id, today]);

  const log = (mealId: string, mark: "completed" | "partial" | "missed") =>
    void run((r) => r.ops.nutritionOps.logMealCompletion(plan.id, actorId, mealId, today, mark));
  const flag = (mealId: string, kind: "substitution_requested" | "disliked" | "unavailable") =>
    void run((r) => r.ops.nutritionOps.flagMeal(plan.id, actorId, mealId, kind));

  return (
    <Panel>
      <PanelHeader label={plan.name} title="Today's meals" />
      <div className="flex flex-col gap-1.5 p-4">
        {plan.meals.map((meal) => {
          const current = completions.get(meal.id);
          return (
            <div key={meal.id} className="border-t border-white/[0.06] px-3 py-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className={`text-[11px] font-medium ${current === "completed" ? "text-white/40 line-through" : "text-[#f2eee6]"}`}>{meal.name}</span>
                  <span className="ml-2 font-mono text-[9px] text-white/35">{meal.timeWindow}</span>
                </div>
                <div className="flex items-center gap-1">
                  <MarkButton active={current === "completed"} tone="green" label="Done" onClick={() => log(meal.id, "completed")} icon={<Check size={10} />} />
                  <MarkButton active={current === "partial"} tone="amber" label="Partial" onClick={() => log(meal.id, "partial")} />
                  <MarkButton active={current === "missed"} tone="red" label="Missed" onClick={() => log(meal.id, "missed")} />
                </div>
              </div>
              {meal.alternatives.length > 0 && (
                <p className="mt-1 text-[8px] text-white/30">
                  Approved alternatives: {meal.alternatives.map((a) => a.description).join(" · ")}
                </p>
              )}
              <div className="mt-1.5 flex gap-1.5">
                <button type="button" onClick={() => flag(meal.id, "substitution_requested")} className="font-mono text-[9px] uppercase tracking-[0.08em] text-white/30 hover:text-[#5fb7d5]">Request substitution</button>
                <button type="button" onClick={() => flag(meal.id, "disliked")} className="font-mono text-[9px] uppercase tracking-[0.08em] text-white/30 hover:text-[#e8c87a]">Dislike</button>
                <button type="button" onClick={() => flag(meal.id, "unavailable")} className="font-mono text-[9px] uppercase tracking-[0.08em] text-white/30 hover:text-[#ef7d55]">Unavailable</button>
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

/* ─── Grocery quick actions ───────────────────────────────────────────── */

function GroceryQuick({ planId }: { planId: string }) {
  const db = useCoachingStore((s) => s.db);
  const actorId = useCoachingStore((s) => s.actorId);
  const run = useCoachingStore((s) => s.run);
  const plan = db.groceryPlans.find((p) => p.id === planId);
  if (!plan) return null;
  const open = plan.items.filter((i) => i.state === "needed" || i.state === "unavailable");

  return (
    <Panel>
      <PanelHeader
        label={`Week of ${plan.weekOf}`}
        title="Grocery list"
        right={
          <StatusChip tone={open.length === 0 ? "green" : "neutral"}>
            <span className="flex items-center gap-1"><ShoppingCart size={10} /> {open.length} to buy</span>
          </StatusChip>
        }
      />
      <div className="flex flex-col gap-1 p-4">
        {open.length === 0 ? (
          <p className="text-[10px] text-white/35">Everything on the list is handled.</p>
        ) : (
          open.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-2 border-t border-white/[0.06] px-3 py-1.5">
              <div>
                <span className="text-[10px] text-white/70">{item.name}</span>
                <span className="ml-2 font-mono text-[8px] text-white/35">{item.quantity}</span>
                {item.state === "unavailable" && <StatusChip tone="amber">Unavailable</StatusChip>}
              </div>
              <div className="flex gap-1">
                <MarkButton active={false} tone="green" label="Got it" onClick={() => void run((r) => r.ops.grocery.setItemState(plan.id, item.id, actorId, "purchased"))} icon={<Check size={10} />} />
                {item.state !== "unavailable" && (
                  <MarkButton active={false} tone="amber" label="Not in stock" onClick={() => void run((r) => r.ops.grocery.setItemState(plan.id, item.id, actorId, "unavailable"))} />
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </Panel>
  );
}

/* ─── Clinical ownership — consent, records, observations ─────────────── */

const CONSENT_OPTIONS: Array<{ value: ClinicalConsentScope; label: string; body: string }> = [
  { value: "none", label: "No access", body: "Your coach sees nothing in this area." },
  { value: "view", label: "View only", body: "Your coach can read what you disclose. They can never edit anything." },
  { value: "view_and_note", label: "View + observations", body: "Your coach can also add neutral observations. Records stay yours alone." },
];

function ClinicalOwnership({ relationship }: { relationship: CoachingRelationship }) {
  const db = useCoachingStore((s) => s.db);
  const actorId = useCoachingStore((s) => s.actorId);
  const run = useCoachingStore((s) => s.run);
  const [managing, setManaging] = useState(false);
  const [scope, setScope] = useState<ClinicalConsentScope>("none");
  const [acknowledged, setAcknowledged] = useState(false);
  const [addingRecord, setAddingRecord] = useState(false);

  const consent = db.clinicalConsents.find((c) => c.relationshipId === relationship.id && !c.revokedAt) ?? null;
  const records = db.clinicalRecords.filter((r) => r.athleteId === actorId);
  const currentScope: ClinicalConsentScope = consent?.scope ?? "none";

  const saveConsent = async () => {
    const saved = await run((r) => r.ops.clinical.setConsent(relationship.id, actorId, scope, acknowledged));
    if (saved) {
      setManaging(false);
      setAcknowledged(false);
    }
  };

  return (
    <Panel>
      <PanelHeader
        label="Yours alone"
        title="Clinical Coordination"
        right={
          <StatusChip tone={currentScope === "none" ? "neutral" : "teal"}>
            <span className="flex items-center gap-1">
              <FileLock2 size={10} />
              {CONSENT_OPTIONS.find((o) => o.value === currentScope)?.label}
            </span>
          </StatusChip>
        }
      />
      <div className="flex flex-col gap-3 p-4">
        <p className="text-[10px] leading-4 text-white/40">
          A private place to document clinician-directed or self-disclosed information so your whole
          operation is coordinated. Your coach sees nothing here unless you explicitly consent — full
          coaching access never includes it — and you can revoke at any time. Reserve documents;
          it never prescribes, diagnoses, or determines medical suitability.
        </p>

        {!managing ? (
          <div className="flex flex-wrap gap-1.5">
            <CommandButton variant="ghost" onClick={() => { setScope(currentScope); setManaging(true); }}>
              Manage coach access
            </CommandButton>
            <CommandButton variant="ghost" onClick={() => setAddingRecord((v) => !v)}>
              {addingRecord ? "Close record form" : "Document a record"}
            </CommandButton>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5 border-t border-white/[0.06] p-3">
            {CONSENT_OPTIONS.map((option) => (
              <label key={option.value} className="flex cursor-pointer items-start gap-2.5">
                <input
                  type="radio"
                  name="clinical-consent"
                  checked={scope === option.value}
                  onChange={() => setScope(option.value)}
                  className="mt-0.5 accent-[#d5b15f]"
                />
                <span>
                  <span className="text-[11px] font-medium text-[#f2eee6]">{option.label}</span>
                  <span className="block text-[9px] leading-4 text-white/40">{option.body}</span>
                </span>
              </label>
            ))}
            <label className="flex items-start gap-2 border-t border-white/[0.05] pt-2.5">
              <input type="checkbox" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} className="mt-0.5 accent-[#d5b15f]" />
              <span className="text-[9px] leading-4 text-white/45">{CLINICAL_ACKNOWLEDGEMENT}</span>
            </label>
            <div className="flex gap-1.5">
              <CommandButton disabled={!acknowledged} disabledReason="Review the acknowledgement first" onClick={() => void saveConsent()}>
                Save consent
              </CommandButton>
              <CommandButton variant="ghost" onClick={() => setManaging(false)}>Cancel</CommandButton>
            </div>
          </div>
        )}

        {addingRecord && <ClinicalRecordForm relationshipId={relationship.id} onClose={() => setAddingRecord(false)} />}

        {records.map((record) => (
          <AthleteClinicalRecord key={record.id} recordId={record.id} />
        ))}
      </div>
    </Panel>
  );
}

function ClinicalRecordForm({ relationshipId, onClose }: { relationshipId: string; onClose: () => void }) {
  const actorId = useCoachingStore((s) => s.actorId);
  const run = useCoachingStore((s) => s.run);
  const [form, setForm] = useState({
    disclosedName: "",
    category: "prescription_medication" as ClinicalCategory,
    clinician: "",
    schedule: "",
    monitoring: "",
    labReminder: "",
    followUp: "",
  });
  const [acknowledged, setAcknowledged] = useState(false);

  const save = async () => {
    const saved = await run((r) =>
      r.ops.clinical.createRecord(
        {
          relationshipId,
          athleteId: actorId,
          disclosedName: form.disclosedName.trim(),
          category: form.category,
          clinicianOrPractice: form.clinician.trim() || undefined,
          prescriptionStatus: "athlete_disclosed",
          startDate: null,
          reviewDate: null,
          athleteReportedSchedule: form.schedule.trim() || undefined,
          documentationStatus: "documented",
          monitoringRequirements: form.monitoring.trim() || undefined,
          labReminderDate: form.labReminder || null,
          followUpDate: form.followUp || null,
          status: "active",
          createdBy: actorId,
          acknowledgementAccepted: acknowledged,
        },
        actorId,
      ),
    );
    if (saved) onClose();
  };

  return (
    <div className="flex flex-col gap-2.5 border-t border-white/[0.06] p-3">
      <MicroLabel tone="champagne">New clinical record — documentation only</MicroLabel>
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="Name as disclosed">
          <input className={inputClass} value={form.disclosedName} onChange={(e) => setForm({ ...form, disclosedName: e.target.value })} />
        </Field>
        <Field label="Category">
          <select className={inputClass} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as ClinicalCategory })}>
            {(Object.keys(CLINICAL_CATEGORY_LABELS) as ClinicalCategory[]).map((c) => (
              <option key={c} value={c}>{CLINICAL_CATEGORY_LABELS[c]}</option>
            ))}
          </select>
        </Field>
        <Field label="Clinician or practice (optional)">
          <input className={inputClass} value={form.clinician} onChange={(e) => setForm({ ...form, clinician: e.target.value })} />
        </Field>
        <Field label="Your reported schedule (stored verbatim)">
          <input className={inputClass} value={form.schedule} onChange={(e) => setForm({ ...form, schedule: e.target.value })} placeholder="As directed by clinician" />
        </Field>
        <Field label="Monitoring requirements (clinician-directed)">
          <input className={inputClass} value={form.monitoring} onChange={(e) => setForm({ ...form, monitoring: e.target.value })} />
        </Field>
        <Field label="Lab reminder date">
          <input type="date" className={inputClass} value={form.labReminder} onChange={(e) => setForm({ ...form, labReminder: e.target.value })} />
        </Field>
        <Field label="Follow-up date">
          <input type="date" className={inputClass} value={form.followUp} onChange={(e) => setForm({ ...form, followUp: e.target.value })} />
        </Field>
      </div>
      <label className="flex items-start gap-2 border-t border-white/[0.05] pt-2.5">
        <input type="checkbox" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} className="mt-0.5 accent-[#d5b15f]" />
        <span className="text-[9px] leading-4 text-white/45">{CLINICAL_ACKNOWLEDGEMENT}</span>
      </label>
      <div className="flex gap-1.5">
        <CommandButton
          disabled={!form.disclosedName.trim() || !acknowledged}
          disabledReason="Name the record and review the acknowledgement"
          onClick={() => void save()}
        >
          Save record
        </CommandButton>
        <CommandButton variant="ghost" onClick={onClose}>Cancel</CommandButton>
      </div>
    </div>
  );
}

function AthleteClinicalRecord({ recordId }: { recordId: string }) {
  const db = useCoachingStore((s) => s.db);
  const actorId = useCoachingStore((s) => s.actorId);
  const run = useCoachingStore((s) => s.run);
  const [noting, setNoting] = useState(false);
  const [note, setNote] = useState("");
  const [severity, setSeverity] = useState<"routine" | "notable" | "urgent">("routine");

  const record = db.clinicalRecords.find((r) => r.id === recordId);
  if (!record) return null;
  const observations = db.clinicalObservations
    .filter((o) => o.recordId === recordId)
    .sort((a, b) => b.at.localeCompare(a.at));

  const addObservation = async () => {
    if (!note.trim()) return;
    const saved = await run((r) =>
      r.ops.clinical.addObservation(
        {
          recordId,
          athleteId: actorId,
          authorId: actorId,
          authorRole: "athlete",
          kind: "other",
          note: note.trim(),
          severity,
        },
        actorId,
      ),
    );
    if (saved) {
      setNote("");
      setNoting(false);
      setSeverity("routine");
    }
  };

  return (
    <div className="border-t border-white/[0.06] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="text-[11px] font-medium text-[#f2eee6]">{record.disclosedName}</span>
          <MicroLabel>{CLINICAL_CATEGORY_LABELS[record.category]} · {record.status.replace(/_/g, " ")}</MicroLabel>
        </div>
        <div className="flex items-center gap-1.5">
          {record.labReminderDate && <StatusChip tone="champagne">Labs {record.labReminderDate}</StatusChip>}
          {record.followUpDate && <StatusChip tone="neutral">Follow-up {record.followUpDate}</StatusChip>}
        </div>
      </div>
      {record.monitoringRequirements && (
        <p className="mt-1.5 text-[9px] leading-4 text-white/40">Monitoring: {record.monitoringRequirements}</p>
      )}
      <div className="mt-2 flex items-center justify-between">
        <MicroLabel>Your observations ({observations.length})</MicroLabel>
        <button type="button" onClick={() => setNoting((v) => !v)} className="font-mono text-[8px] uppercase tracking-[0.14em] text-[#d5b15f]/60 hover:text-[#d5b15f]">
          {noting ? "Close" : "Add observation"}
        </button>
      </div>
      {noting && (
        <div className="mt-2 flex flex-col gap-2">
          <textarea className={`${inputClass} min-h-[44px] resize-none`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What you observed — neutrally recorded" />
          <div className="flex items-center justify-between gap-2">
            <select className={`${inputClass} w-auto`} value={severity} onChange={(e) => setSeverity(e.target.value as typeof severity)} aria-label="Severity">
              <option value="routine">Routine</option>
              <option value="notable">Notable</option>
              <option value="urgent">Urgent / severe</option>
            </select>
            <CommandButton onClick={() => void addObservation()}>Save</CommandButton>
          </div>
          {severity === "urgent" && (
            <div className="border-l-2 border-[#ef7d55]/40 px-3 py-2">
              <p className="text-[12px] leading-[1.45] text-[#ef7d55]">
                <strong className="font-semibold">{ESCALATION_LABEL["contact-clinician-today"]}.</strong> {EMERGENCY_COPY.urgent} {EMERGENCY_COPY.emergency}
              </p>
              <p className="mt-1 text-[11.5px] text-white/60">Reserve records your report. It cannot assess it.</p>
              <CareOptions />
            </div>
          )}
        </div>
      )}
      {observations.slice(0, 3).map((obs) => (
        <p key={obs.id} className="mt-1.5 text-[9px] leading-4 text-white/45">
          <span className="font-mono text-white/25">{relativeTime(obs.at)} · {obs.authorRole}</span> — {obs.note}
        </p>
      ))}
    </div>
  );
}
