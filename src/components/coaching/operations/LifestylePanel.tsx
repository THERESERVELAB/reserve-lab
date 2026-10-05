"use client";

/* ════════════════════════════════════════════════════════════════════════
   LIFESTYLE ARCHITECTURE — coach workspace for the athlete's complete
   operating week: anchors, commitments, training, meals, recovery, prep,
   and sleep. Constraint detection stays calm and factual — observations,
   not alarms.
   ════════════════════════════════════════════════════════════════════════ */

import { useMemo, useState } from "react";
import { CalendarDays, Plus, Send } from "lucide-react";

import { canSuggest, canView } from "@/lib/coaching/permissions";
import { useCoachingStore } from "@/lib/coaching/store";
import { detectScheduleConstraints } from "@/lib/coaching/operations/engines";
import {
  CONSTRAINT_LABELS,
  type LifestyleCategory,
  type LifestyleEvent,
  type LifestylePlan,
  type LifestyleWeekKind,
} from "@/lib/coaching/operations/types";
import type { CoachingRelationship } from "@/lib/coaching/types";
import { OP_STATUS_TONE, opStatusLabel } from "./ProtocolsPanel";
import {
  CommandButton,
  EmptyState,
  Field,
  MicroLabel,
  Panel,
  PanelHeader,
  SegmentedControl,
  StatusChip,
  inputClass,
  relativeTime,
} from "../ui";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

const WEEK_KIND_LABELS: Record<LifestyleWeekKind, string> = {
  standard: "Standard",
  alternate: "Alternating",
  travel: "Travel",
  deload: "Deload",
  competition: "Competition",
  shift_work: "Shift work",
};

const CATEGORY_OPTIONS: Array<{ value: LifestyleCategory; label: string }> = [
  { value: "wake", label: "Wake" },
  { value: "morning_prep", label: "Morning preparation" },
  { value: "hydration", label: "Hydration" },
  { value: "meal", label: "Meal" },
  { value: "work", label: "Work" },
  { value: "school", label: "School" },
  { value: "commute", label: "Commute" },
  { value: "training", label: "Training" },
  { value: "cardio", label: "Cardio" },
  { value: "mobility", label: "Mobility" },
  { value: "recovery", label: "Recovery" },
  { value: "sauna", label: "Sauna" },
  { value: "cold_exposure", label: "Cold exposure" },
  { value: "walking", label: "Walking" },
  { value: "supplement_window", label: "Supplement window" },
  { value: "medical_reminder", label: "Medical reminder" },
  { value: "family", label: "Family commitment" },
  { value: "childcare", label: "Childcare" },
  { value: "grocery", label: "Grocery" },
  { value: "meal_prep", label: "Meal prep" },
  { value: "reflection", label: "Reflection" },
  { value: "meditation", label: "Meditation" },
  { value: "reading", label: "Reading" },
  { value: "sleep_prep", label: "Sleep preparation" },
  { value: "bedtime", label: "Bedtime" },
  { value: "custom", label: "Custom" },
];

const CATEGORY_COLOR: Partial<Record<LifestyleCategory, string>> = {
  training: "#d5b15f",
  cardio: "#d5b15f",
  meal: "#5fb7d5",
  meal_prep: "#5fb7d5",
  grocery: "#5fb7d5",
  bedtime: "#a78bfa",
  wake: "#a78bfa",
  sleep_prep: "#a78bfa",
  work: "#94a3b8",
  medical_reminder: "#ef7d55",
};

export function LifestylePanel({
  athleteId,
  relationship,
}: {
  athleteId: string;
  relationship: CoachingRelationship | null;
}) {
  const db = useCoachingStore((s) => s.db);
  const actorId = useCoachingStore((s) => s.actorId);
  const run = useCoachingStore((s) => s.run);
  const [building, setBuilding] = useState<LifestylePlan | "new" | null>(null);
  const maySuggest = canSuggest(relationship, "lifestyleSchedule");

  if (!canView(relationship, "lifestyleSchedule")) {
    return (
      <EmptyState
        title="Lifestyle access not granted"
        body="The athlete has not granted lifestyle-schedule access. Their week stays private until they grant it."
      />
    );
  }

  const plans = db.lifestylePlans
    .filter((p) => p.athleteId === athleteId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <CommandButton
          disabled={!maySuggest}
          disabledReason="The athlete has not granted lifestyle access at the suggest level"
          onClick={() => setBuilding("new")}
        >
          <span className="flex items-center gap-1.5"><Plus size={11} /> New week plan</span>
        </CommandButton>
      </div>
      {building && (
        <LifestyleBuilder
          athleteId={athleteId}
          editing={building === "new" ? undefined : building}
          onClose={() => setBuilding(null)}
        />
      )}
      {plans.length === 0 && !building ? (
        <EmptyState
          title="No lifestyle plan"
          body="Design the athlete's complete operating week — anchors, commitments, training, meals, recovery, and sleep — then send it for their review."
        />
      ) : (
        plans.map((plan) => (
          <LifestylePlanCard
            key={plan.id}
            plan={plan}
            canAct={maySuggest}
            onEdit={() => setBuilding(plan)}
            onSend={() => void run((r) => r.ops.lifestyle.sendPlan(plan.id, actorId))}
          />
        ))
      )}
    </div>
  );
}

/* ─── Plan card + week grid + constraints ─────────────────────────────── */

function LifestylePlanCard({
  plan,
  canAct,
  onEdit,
  onSend,
}: {
  plan: LifestylePlan;
  canAct: boolean;
  onEdit: () => void;
  onSend: () => void;
}) {
  const constraints = useMemo(() => detectScheduleConstraints(plan.events), [plan.events]);
  const editable = plan.status === "draft" || plan.status === "revision_requested";
  const attention = constraints.filter((c) => c.severity === "attention");
  /* Mobile / tablet agenda: today-first day selection. */
  const todayShort = DAYS[(new Date().getDay() + 6) % 7];
  const [focusDay, setFocusDay] = useState<(typeof DAYS)[number]>(todayShort);
  const focusEvents = plan.events
    .filter((e) => e.day === focusDay)
    .sort((a, b) => a.start.localeCompare(b.start));
  const focusConstraints = constraints.filter((c) => c.day === focusDay);

  return (
    <Panel glow={plan.status === "active"}>
      <PanelHeader
        label={`${WEEK_KIND_LABELS[plan.weekKind]} week · v${plan.version} · ${relativeTime(plan.updatedAt)}`}
        title={plan.name}
        right={
          <div className="flex items-center gap-1.5">
            {attention.length > 0 && <StatusChip tone="amber">{attention.length} needs attention</StatusChip>}
            <StatusChip tone={OP_STATUS_TONE[plan.status]} pulse={plan.status === "sent"}>{opStatusLabel(plan.status)}</StatusChip>
          </div>
        }
      />
      <div className="flex flex-col gap-3 p-4">
        {/* Desktop week canvas */}
        <div className="hidden lg:block">
          <div className="grid grid-cols-7 gap-1.5">
            {DAYS.map((day) => {
              const events = plan.events
                .filter((e) => e.day === day)
                .sort((a, b) => a.start.localeCompare(b.start));
              return (
                <div key={day} className="border-t border-white/[0.06] p-2">
                  <MicroLabel className="mb-1.5 text-center">{day}</MicroLabel>
                  <div className="flex flex-col gap-1">
                    {events.length === 0 ? (
                      <p className="py-3 text-center text-[9px] text-white/20">Open</p>
                    ) : (
                      events.map((event) => (
                        <div
                          key={event.id}
                          className="rounded-md border-l-2 bg-white/[0.02] px-1.5 py-1"
                          style={{ borderLeftColor: `${CATEGORY_COLOR[event.category] ?? "rgba(255,255,255,0.18)"}66` }}
                          title={`${event.title} · ${event.start}–${event.end}${event.priority === "anchor" ? " · Anchor" : ""}`}
                        >
                          <div className="truncate text-[9px] font-medium leading-3 text-white/70">
                            {event.priority === "anchor" ? "◆ " : ""}{event.title}
                          </div>
                          <div className="font-mono text-[8px] text-white/30">
                            {event.start}{event.end !== event.start ? `–${event.end}` : ""}
                            {event.completed ? " ✓" : ""}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Tablet / mobile agenda — a deliberate composition, not compressed columns */}
        <div className="lg:hidden">
          <div role="tablist" aria-label="Day" className="flex gap-1 overflow-x-auto pb-1">
            {DAYS.map((day) => {
              const count = plan.events.filter((e) => e.day === day).length;
              const hasAttention = constraints.some((c) => c.day === day && c.severity === "attention");
              return (
                <button
                  key={day}
                  type="button"
                  role="tab"
                  aria-selected={focusDay === day}
                  onClick={() => setFocusDay(day)}
                  className={`flex min-w-[52px] flex-col items-center gap-0.5 rounded-xl border px-2.5 py-2 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#d5b15f]/40 ${
                    focusDay === day
                      ? "border-[#d5b15f]/35 bg-[#d5b15f]/10"
                      : "border-white/[0.06] bg-white/[0.015] hover:bg-white/[0.04]"
                  }`}
                >
                  <span className={`font-mono text-[9px] font-bold uppercase tracking-wide ${focusDay === day ? "text-[#d5b15f]" : "text-white/55"}`}>
                    {day}
                  </span>
                  <span className="flex items-center gap-1 font-mono text-[8px] text-white/30">
                    {count}
                    {hasAttention && <span className="h-1 w-1 rounded-full bg-[#e8c87a]" aria-label="Needs attention" />}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex flex-col gap-1.5">
            {focusEvents.length === 0 ? (
              <p className="py-5 text-center text-[10px] text-white/30">
                {focusDay} is open.
              </p>
            ) : (
              focusEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex items-center justify-between gap-3 border-l-2 px-3 py-2.5"
                  style={{ borderLeftColor: `${CATEGORY_COLOR[event.category] ?? "rgba(255,255,255,0.18)"}88` }}
                >
                  <div className="min-w-0">
                    <div className="truncate text-[12px] font-medium text-white/80">
                      {event.priority === "anchor" ? "◆ " : ""}{event.title}
                    </div>
                    {(event.travelBufferMinutes || event.prepBufferMinutes) ? (
                      <div className="text-[9px] text-white/30">
                        {event.travelBufferMinutes ? `${event.travelBufferMinutes}m travel` : ""}
                        {event.travelBufferMinutes && event.prepBufferMinutes ? " · " : ""}
                        {event.prepBufferMinutes ? `${event.prepBufferMinutes}m prep` : ""}
                      </div>
                    ) : null}
                  </div>
                  <span className="shrink-0 font-mono text-[10px] tabular-nums text-white/45">
                    {event.start}{event.end !== event.start ? `–${event.end}` : ""}
                  </span>
                </div>
              ))
            )}
            {focusConstraints.length > 0 && (
              <div className="border-l-2 border-[#e8c87a]/40 px-3 py-2">
                {focusConstraints.map((c) => (
                  <p key={c.id} className="text-[10px] leading-4 text-white/50">
                    <span className="text-[#e8c87a]/80">{CONSTRAINT_LABELS[c.kind]}:</span> {c.detail}
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Constraints — calm observations */}
        {constraints.length > 0 && (
          <div className="border-t border-white/[0.06] p-3">
            <MicroLabel tone="champagne">Structural observations ({constraints.length})</MicroLabel>
            <div className="mt-2 flex flex-col gap-1.5">
              {constraints.map((constraint) => (
                <div key={constraint.id} className="flex items-start justify-between gap-3">
                  <div>
                    <span className={`text-[10px] font-medium ${constraint.severity === "attention" ? "text-[#e8c87a]/90" : "text-white/60"}`}>
                      {constraint.day} · {CONSTRAINT_LABELS[constraint.kind]}
                    </span>
                    <p className="text-[9px] leading-4 text-white/40">{constraint.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {plan.athleteDecisionNote && (
          <p className="border-l-2 border-[#e8c87a]/30 pl-3 text-[10px] italic text-white/50">
            Athlete: “{plan.athleteDecisionNote}”
          </p>
        )}

        {canAct && (
          <div className="flex flex-wrap gap-1.5 border-t border-white/[0.05] pt-3">
            {editable && (
              <>
                <CommandButton onClick={onEdit}>Edit draft</CommandButton>
                <CommandButton variant="teal" onClick={onSend}>
                  <span className="flex items-center gap-1.5"><Send size={11} /> Send for review</span>
                </CommandButton>
              </>
            )}
            {plan.status === "active" && <CommandButton onClick={onEdit}>Draft revision</CommandButton>}
          </div>
        )}
      </div>
    </Panel>
  );
}

/* ─── Builder ─────────────────────────────────────────────────────────── */

const blankEvent = (day: string): LifestyleEvent => ({
  id: `le-${Math.random().toString(36).slice(2, 9)}`,
  title: "",
  category: "custom",
  day,
  start: "08:00",
  end: "09:00",
  priority: "standard",
  flexibility: "movable",
  required: true,
  reminderEnabled: false,
});

function LifestyleBuilder({
  athleteId,
  editing,
  onClose,
}: {
  athleteId: string;
  editing?: LifestylePlan;
  onClose: () => void;
}) {
  const actorId = useCoachingStore((s) => s.actorId);
  const run = useCoachingStore((s) => s.run);
  const relationship = useCoachingStore((s) =>
    s.db.relationships.find((r) => r.athleteId === athleteId && r.status === "active") ?? null,
  );
  const revising = editing && editing.status === "active";
  const [name, setName] = useState(editing ? (revising ? `${editing.name} (revised)` : editing.name) : "");
  const [weekKind, setWeekKind] = useState<LifestyleWeekKind>(editing?.weekKind ?? "standard");
  const [events, setEvents] = useState<LifestyleEvent[]>(editing ? editing.events.map((e) => ({ ...e, completed: undefined })) : []);
  const [activeDay, setActiveDay] = useState<(typeof DAYS)[number]>("Mon");

  const constraints = useMemo(() => detectScheduleConstraints(events), [events]);
  const dayEvents = events.filter((e) => e.day === activeDay).sort((a, b) => a.start.localeCompare(b.start));

  const setEvent = (id: string, patch: Partial<LifestyleEvent>) =>
    setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));

  const copyDayTo = (target: string) => {
    setEvents((prev) => [
      ...prev.filter((e) => e.day !== target),
      ...prev
        .filter((e) => e.day === activeDay)
        .map((e) => ({ ...e, id: `le-${Math.random().toString(36).slice(2, 9)}`, day: target })),
    ]);
  };

  const valid = name.trim() && events.length > 0 && events.every((e) => e.title.trim());

  const save = async (thenSend: boolean) => {
    if (!relationship) return;
    const saved = await run(async (r) => {
      const draft = await r.ops.lifestyle.savePlanDraft(
        {
          id: revising ? undefined : editing?.id,
          coachId: relationship.coachId,
          athleteId,
          name: name.trim(),
          weekKind,
          events,
          effectiveAt: null,
          supersedesId: revising ? editing.id : undefined,
        },
        actorId,
      );
      if (thenSend) await r.ops.lifestyle.sendPlan(draft.id, actorId);
      return draft;
    });
    if (saved) onClose();
  };

  return (
    <Panel glow className="border-[#d5b15f]/20">
      <PanelHeader
        label={revising ? `Revision of v${editing.version}` : editing ? "Editing draft" : "New plan"}
        title="Lifestyle week builder"
        right={<CommandButton variant="ghost" onClick={onClose}>Close</CommandButton>}
      />
      <div className="flex flex-col gap-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Plan name">
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Standard Operating Week" />
          </Field>
          <Field label="Week kind">
            <select className={inputClass} value={weekKind} onChange={(e) => setWeekKind(e.target.value as LifestyleWeekKind)}>
              {(Object.keys(WEEK_KIND_LABELS) as LifestyleWeekKind[]).map((k) => (
                <option key={k} value={k}>{WEEK_KIND_LABELS[k]}</option>
              ))}
            </select>
          </Field>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <SegmentedControl
            size="xs"
            options={DAYS.map((d) => ({ value: d, label: `${d} (${events.filter((e) => e.day === d).length})` }))}
            value={activeDay}
            onChange={setActiveDay}
          />
          <div className="flex items-center gap-1.5">
            <CommandButton variant="ghost" onClick={() => setEvents((prev) => [...prev, blankEvent(activeDay)])}>
              <span className="flex items-center gap-1.5"><Plus size={11} /> Add to {activeDay}</span>
            </CommandButton>
            <select
              className="rounded-lg border border-white/10 bg-[#0b0c12] px-2 py-1.5 font-mono text-[9px] uppercase tracking-[0.1em] text-white/50 outline-none focus-visible:ring-2 focus-visible:ring-[#d5b15f]/45"
              value=""
              onChange={(e) => { if (e.target.value) copyDayTo(e.target.value); e.target.value = ""; }}
              aria-label="Copy day"
            >
              <option value="">Copy {activeDay} to…</option>
              {DAYS.filter((d) => d !== activeDay).map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>

        {dayEvents.length === 0 ? (
          <p className="py-6 text-center text-[10px] text-white/30">
            {activeDay} is open — add wake, meals, training, commitments, and bedtime.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {dayEvents.map((event) => (
              <div key={event.id} className="grid grid-cols-2 items-end gap-2 border-t border-white/[0.06] p-3 sm:grid-cols-4 lg:grid-cols-8">
                <Field label="Title">
                  <input className={inputClass} value={event.title} onChange={(e) => setEvent(event.id, { title: e.target.value })} />
                </Field>
                <Field label="Category">
                  <select className={inputClass} value={event.category} onChange={(e) => setEvent(event.id, { category: e.target.value as LifestyleCategory })}>
                    {CATEGORY_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </Field>
                <Field label="Start"><input type="time" className={inputClass} value={event.start} onChange={(e) => setEvent(event.id, { start: e.target.value })} /></Field>
                <Field label="End"><input type="time" className={inputClass} value={event.end} onChange={(e) => setEvent(event.id, { end: e.target.value })} /></Field>
                <Field label="Priority">
                  <select className={inputClass} value={event.priority} onChange={(e) => setEvent(event.id, { priority: e.target.value as LifestyleEvent["priority"] })}>
                    <option value="anchor">Anchor</option>
                    <option value="standard">Standard</option>
                    <option value="optional">Optional</option>
                  </select>
                </Field>
                <Field label="Flexibility">
                  <select className={inputClass} value={event.flexibility} onChange={(e) => setEvent(event.id, { flexibility: e.target.value as LifestyleEvent["flexibility"] })}>
                    <option value="fixed">Fixed</option>
                    <option value="movable">Movable</option>
                    <option value="flexible">Flexible</option>
                  </select>
                </Field>
                <Field label="Buffers (travel/prep min)">
                  <div className="flex gap-1">
                    <input type="number" min={0} className={inputClass} value={event.travelBufferMinutes ?? ""} placeholder="Trv" onChange={(e) => setEvent(event.id, { travelBufferMinutes: e.target.value === "" ? undefined : Number(e.target.value) })} />
                    <input type="number" min={0} className={inputClass} value={event.prepBufferMinutes ?? ""} placeholder="Prep" onChange={(e) => setEvent(event.id, { prepBufferMinutes: e.target.value === "" ? undefined : Number(e.target.value) })} />
                  </div>
                </Field>
                <div className="flex items-center justify-between gap-1 pb-2">
                  <label className="flex items-center gap-1.5">
                    <input type="checkbox" checked={event.required} onChange={(e) => setEvent(event.id, { required: e.target.checked })} className="accent-[#d5b15f]" />
                    <span className="text-[9px] text-white/40">Required</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setEvents((prev) => prev.filter((e) => e.id !== event.id))}
                    className="font-mono text-[8px] uppercase text-white/30 hover:text-[#ef7d55]"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Live constraint feedback while building */}
        {constraints.length > 0 && (
          <div className="border-l-2 border-[#e8c87a]/40 p-3">
            <MicroLabel tone="champagne">
              <span className="flex items-center gap-1.5"><CalendarDays size={10} /> Live structural check ({constraints.length})</span>
            </MicroLabel>
            <div className="mt-1.5 flex flex-col gap-1">
              {constraints.slice(0, 6).map((c) => (
                <p key={c.id} className="text-[9px] leading-4 text-white/45">
                  <span className="text-[#e8c87a]/80">{c.day} · {CONSTRAINT_LABELS[c.kind]}:</span> {c.detail}
                </p>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-1.5 border-t border-white/[0.05] pt-3">
          <CommandButton disabled={!valid} disabledReason="Name the plan and give every event a title" onClick={() => void save(false)}>Save draft</CommandButton>
          <CommandButton variant="teal" disabled={!valid} disabledReason="Complete the draft before sending" onClick={() => void save(true)}>
            <span className="flex items-center gap-1.5"><Send size={11} /> Save &amp; send</span>
          </CommandButton>
        </div>
      </div>
    </Panel>
  );
}
