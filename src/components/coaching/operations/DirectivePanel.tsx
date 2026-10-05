"use client";

/* ════════════════════════════════════════════════════════════════════════
   DAILY DIRECTIVE + COACH AI DRAFTS — coach workspace.

   The directive is a premium behavioral system: deterministic synthesis
   of the athlete's real situation, in the coach's chosen voice. Nothing
   reaches the athlete without coach approval. AI drafts are editable
   suggestions only — labeled, never auto-applied, never auto-sent, and
   never connected to clinical records.
   ════════════════════════════════════════════════════════════════════════ */

import { useState } from "react";
import { ClipboardList, Compass, FileEdit } from "lucide-react";

import { todayKey } from "@/lib/coaching/ids";
import { canManage, canSuggest, canView } from "@/lib/coaching/permissions";
import { useCoachingStore } from "@/lib/coaching/store";
import type {
  AIDraftKind,
  CoachAIDraft,
  DailyDirective,
  DirectiveFocus,
  DirectivePreference,
  DirectiveTone,
} from "@/lib/coaching/operations/types";
import type { CoachingRelationship } from "@/lib/coaching/types";
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

const TONE_OPTIONS: Array<{ value: DirectiveTone; label: string }> = [
  { value: "measured", label: "Measured" },
  { value: "stoic", label: "Stoic" },
  { value: "direct", label: "Direct" },
  { value: "reassuring", label: "Reassuring" },
  { value: "competitive", label: "Competitive" },
  { value: "reflective", label: "Reflective" },
  { value: "high_accountability", label: "High Accountability" },
];

const FOCUS_OPTIONS: Array<{ value: DirectiveFocus; label: string }> = [
  { value: "training_execution", label: "Training Execution" },
  { value: "nutrition_discipline", label: "Nutrition Discipline" },
  { value: "recovery", label: "Recovery" },
  { value: "consistency", label: "Consistency" },
  { value: "confidence", label: "Confidence" },
  { value: "schedule_control", label: "Schedule Control" },
  { value: "competition_preparation", label: "Competition Preparation" },
  { value: "lifestyle_order", label: "Lifestyle Order" },
];

const AI_DRAFT_KINDS: Array<{ value: AIDraftKind; label: string }> = [
  { value: "adherence_summary", label: "Adherence summary" },
  { value: "schedule_friction", label: "Schedule-friction summary" },
];

export function DirectivePanel({
  athleteId,
  relationship,
}: {
  athleteId: string;
  relationship: CoachingRelationship | null;
}) {
  const db = useCoachingStore((s) => s.db);
  const actorId = useCoachingStore((s) => s.actorId);
  const run = useCoachingStore((s) => s.run);
  const [editingPrefs, setEditingPrefs] = useState(false);

  if (!canView(relationship, "dailyDirective")) {
    return (
      <EmptyState
        title="Directive access not granted"
        body="The athlete has not granted Daily Directive access. Direction stays off until they grant it."
      />
    );
  }

  const prefs = relationship
    ? db.directivePreferences.find((p) => p.relationshipId === relationship.id) ?? null
    : null;
  const directives = db.dailyDirectives
    .filter((d) => d.athleteId === athleteId)
    .sort((a, b) => b.date.localeCompare(a.date));
  const todayDirective = directives.find((d) => d.date === todayKey()) ?? null;
  const mayManage = canManage(relationship, "dailyDirective");
  const maySuggest = canSuggest(relationship, "dailyDirective");

  const draftToday = () => {
    if (!relationship) return;
    void run((r) => r.ops.directive.draftToday(relationship.id, actorId, todayKey()));
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
      <div className="flex flex-col gap-3">
        {/* Today */}
        <Panel glow={todayDirective?.status === "drafted"}>
          <PanelHeader
            label={todayKey()}
            title="Today's directive"
            right={
              todayDirective ? (
                <StatusChip tone={todayDirective.status === "delivered" ? "green" : "champagne"} pulse={todayDirective.status === "drafted"}>
                  {todayDirective.status === "delivered" ? "Delivered" : "Awaiting your approval"}
                </StatusChip>
              ) : (
                <StatusChip tone="neutral">Not drafted</StatusChip>
              )
            }
          />
          <div className="flex flex-col gap-3 p-4">
            {!prefs?.enabled ? (
              <EmptyState
                title="Directive not configured"
                body="Set the voice, focus, and cadence first — the directive is composed from the athlete's real situation in your chosen tone."
                action={mayManage ? <CommandButton onClick={() => setEditingPrefs(true)}>Configure directive</CommandButton> : undefined}
              />
            ) : todayDirective ? (
              <DirectiveReview directive={todayDirective} canApprove={maySuggest} />
            ) : (
              <div className="flex flex-col items-start gap-2">
                <p className="text-[11px] leading-5 text-white/45">
                  Compose today&apos;s directive from the athlete&apos;s schedule, adherence, recovery posture,
                  and live-day state. You review and edit before anything is delivered.
                </p>
                <CommandButton disabled={!maySuggest} disabledReason="Directive suggest access required" onClick={draftToday}>
                  <span className="flex items-center gap-1.5"><Compass size={11} /> Draft today&apos;s directive</span>
                </CommandButton>
              </div>
            )}
          </div>
        </Panel>

        {/* History */}
        {directives.length > 0 && (
          <Panel>
            <PanelHeader label="History" title="Delivered direction" />
            <div className="flex flex-col gap-2 p-4">
              {directives.filter((d) => d.status === "delivered").slice(0, 7).map((d) => (
                <div key={d.id} className="border-t border-white/[0.06] px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <MicroLabel>{d.date} · {d.tone.replace(/_/g, " ")} · {d.focus.replace(/_/g, " ")}</MicroLabel>
                    {d.acknowledgedAt ? (
                      <StatusChip tone="green">Acknowledged {relativeTime(d.acknowledgedAt)}</StatusChip>
                    ) : (
                      <StatusChip tone="neutral">Awaiting athlete acknowledgement</StatusChip>
                    )}
                  </div>
                  <p className="mt-1 text-[10px] leading-4 text-white/55">{d.body}</p>
                </div>
              ))}
            </div>
          </Panel>
        )}

        {/* AI drafts */}
        <AIDraftsSection athleteId={athleteId} />
      </div>

      {/* Preferences */}
      <div className="flex flex-col gap-3">
        <Panel>
          <PanelHeader
            label="Coach controls"
            title="Directive configuration"
            right={
              mayManage && prefs && !editingPrefs ? (
                <CommandButton variant="ghost" onClick={() => setEditingPrefs(true)}>Edit</CommandButton>
              ) : undefined
            }
          />
          <div className="p-4">
            {editingPrefs || !prefs ? (
              mayManage ? (
                <PreferenceEditor
                  relationship={relationship!}
                  existing={prefs}
                  onDone={() => setEditingPrefs(false)}
                />
              ) : (
                <p className="text-[10px] text-white/35">Directive configuration requires manage access.</p>
              )
            ) : (
              <div className="flex flex-col gap-1.5">
                <PrefRow label="Status" value={prefs.enabled ? "Enabled" : "Paused"} />
                <PrefRow label="Tone" value={TONE_OPTIONS.find((t) => t.value === prefs.tone)?.label ?? prefs.tone} />
                <PrefRow label="Focus" value={FOCUS_OPTIONS.find((f) => f.value === prefs.focus)?.label ?? prefs.focus} />
                <PrefRow label="Frequency" value={prefs.frequency.replace(/_/g, " ")} />
                <PrefRow label="Delivery window" value={prefs.deliveryWindow} />
                <PrefRow label="Length" value={prefs.length} />
                <PrefRow label="Sensitivity" value={prefs.athleteSensitivity} />
                <PrefRow label="Quotation" value={prefs.includeQuotation === "none" ? "No quotation" : prefs.includeQuotation} />
                {prefs.privateCoachInstruction && (
                  <div className="mt-1 border-t border-white/[0.06] px-3 py-2">
                    <MicroLabel>Private instruction — never athlete-visible</MicroLabel>
                    <p className="mt-0.5 text-[10px] leading-4 text-white/50">{prefs.privateCoachInstruction}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </Panel>
        <p className="px-1 text-[9px] leading-4 text-white/25">
          Directives never shame the athlete and never use medical or physique data as emotional
          leverage. Every directive is composed deterministically and delivered only after your approval.
        </p>
      </div>
    </div>
  );
}

function PrefRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-[10px] text-white/45">{label}</span>
      <span className="font-mono text-[9px] uppercase tracking-wide text-white/65">{value}</span>
    </div>
  );
}

/* ─── Directive review / approval ─────────────────────────────────────── */

function DirectiveReview({ directive, canApprove }: { directive: DailyDirective; canApprove: boolean }) {
  const actorId = useCoachingStore((s) => s.actorId);
  const run = useCoachingStore((s) => s.run);
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(directive.body);

  if (directive.status === "delivered") {
    return (
      <div>
        <p className="text-[12px] leading-6 text-[#f2eee6]/90">{directive.body}</p>
        <MicroLabel className="mt-2">Delivered {relativeTime(directive.approvedAt ?? directive.createdAt)}</MicroLabel>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap gap-1">
        {directive.basis.map((b) => <StatusChip key={b} tone="neutral">{b}</StatusChip>)}
      </div>
      {editing ? (
        <textarea
          className={`${inputClass} min-h-[96px] resize-none text-[12px] leading-6`}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      ) : (
        <p className="border-t border-white/[0.06] p-3 text-[12px] leading-6 text-[#f2eee6]/90">
          {directive.body}
        </p>
      )}
      <div className="flex flex-wrap gap-1.5">
        <CommandButton
          disabled={!canApprove}
          disabledReason="Directive access required"
          onClick={() => void run((r) => r.ops.directive.approve(directive.id, actorId, editing ? body : undefined))}
        >
          {editing ? "Approve edited version" : "Approve & deliver"}
        </CommandButton>
        <CommandButton variant="ghost" onClick={() => setEditing((v) => !v)}>
          {editing ? "Discard edits" : "Edit before delivery"}
        </CommandButton>
      </div>
    </div>
  );
}

/* ─── Preference editor ───────────────────────────────────────────────── */

function PreferenceEditor({
  relationship,
  existing,
  onDone,
}: {
  relationship: CoachingRelationship;
  existing: DirectivePreference | null;
  onDone: () => void;
}) {
  const actorId = useCoachingStore((s) => s.actorId);
  const run = useCoachingStore((s) => s.run);
  const [draft, setDraft] = useState<Omit<DirectivePreference, "updatedAt">>(
    existing ?? {
      relationshipId: relationship.id,
      athleteId: relationship.athleteId,
      coachId: relationship.coachId,
      enabled: true,
      tone: "measured",
      focus: "consistency",
      frequency: "daily",
      deliveryWindow: "morning",
      length: "standard",
      athleteSensitivity: "standard",
      includeQuotation: "none",
    },
  );

  const save = async () => {
    const saved = await run((r) => r.ops.directive.savePreference(draft, actorId));
    if (saved) onDone();
  };

  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={draft.enabled} onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })} className="accent-[#d5b15f]" />
        <span className="text-[11px] text-white/60">Daily Directive enabled for this athlete</span>
      </label>
      <Field label="Tone">
        <select className={inputClass} value={draft.tone} onChange={(e) => setDraft({ ...draft, tone: e.target.value as DirectiveTone })}>
          {TONE_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </Field>
      <Field label="Focus">
        <select className={inputClass} value={draft.focus} onChange={(e) => setDraft({ ...draft, focus: e.target.value as DirectiveFocus })}>
          {FOCUS_OPTIONS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Frequency">
          <select className={inputClass} value={draft.frequency} onChange={(e) => setDraft({ ...draft, frequency: e.target.value as DirectivePreference["frequency"] })}>
            <option value="daily">Daily</option>
            <option value="training_days">Training days</option>
            <option value="weekly">Weekly</option>
          </select>
        </Field>
        <Field label="Delivery window">
          <select className={inputClass} value={draft.deliveryWindow} onChange={(e) => setDraft({ ...draft, deliveryWindow: e.target.value as DirectivePreference["deliveryWindow"] })}>
            <option value="morning">Morning</option>
            <option value="midday">Midday</option>
            <option value="evening">Evening</option>
          </select>
        </Field>
      </div>
      <Field label="Length">
        <SegmentedControl
          size="xs"
          options={[{ value: "brief", label: "Brief" }, { value: "standard", label: "Standard" }]}
          value={draft.length}
          onChange={(v) => setDraft({ ...draft, length: v })}
        />
      </Field>
      <Field label="Athlete sensitivity" hint="Gentle softens missed-action language. Direction, never shame.">
        <SegmentedControl
          size="xs"
          options={[{ value: "standard", label: "Standard" }, { value: "gentle", label: "Gentle" }]}
          value={draft.athleteSensitivity}
          onChange={(v) => setDraft({ ...draft, athleteSensitivity: v })}
        />
      </Field>
      <Field label="Quotation">
        <SegmentedControl
          size="xs"
          options={[
            { value: "none", label: "No quotation" },
            { value: "quotation", label: "Quotation" },
            { value: "scripture", label: "Scripture" },
          ]}
          value={draft.includeQuotation}
          onChange={(v) => setDraft({ ...draft, includeQuotation: v })}
        />
      </Field>
      <Field label="Private coach instruction — never shown to the athlete">
        <textarea
          className={`${inputClass} min-h-[52px] resize-none`}
          value={draft.privateCoachInstruction ?? ""}
          onChange={(e) => setDraft({ ...draft, privateCoachInstruction: e.target.value || undefined })}
        />
      </Field>
      <div className="flex gap-1.5">
        <CommandButton onClick={() => void save()}>Save configuration</CommandButton>
        <CommandButton variant="ghost" onClick={onDone}>Cancel</CommandButton>
      </div>
    </div>
  );
}

/* ─── AI drafts (labeled, editable, approval-required) ────────────────── */

function AIDraftsSection({ athleteId }: { athleteId: string }) {
  const db = useCoachingStore((s) => s.db);
  const actorId = useCoachingStore((s) => s.actorId);
  const run = useCoachingStore((s) => s.run);
  const drafts = db.aiDrafts
    .filter((d) => d.athleteId === athleteId && d.coachId === actorId && d.status !== "discarded")
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return (
    <Panel>
      <PanelHeader
        label="AI assistance"
        title="Coach drafts"
        right={
          <div className="flex gap-1.5">
            {AI_DRAFT_KINDS.map((kind) => (
              <CommandButton
                key={kind.value}
                variant="ghost"
                onClick={() => void run((r) => r.ops.directive.createAIDraft(kind.value, actorId, athleteId))}
              >
                <span className="flex items-center gap-1.5"><ClipboardList size={10} /> {kind.label}</span>
              </CommandButton>
            ))}
          </div>
        }
      />
      <div className="flex flex-col gap-2 p-4">
        <p className="text-[9px] leading-4 text-white/30">
          Deterministic syntheses of this athlete&apos;s recorded data. Every draft is labeled, editable,
          and requires your approval — nothing auto-applies, nothing auto-sends, and drafts never touch
          clinical records.
        </p>
        {drafts.length === 0 ? (
          <p className="text-[10px] text-white/30">No drafts yet.</p>
        ) : (
          drafts.map((draft) => <AIDraftCard key={draft.id} draft={draft} />)
        )}
      </div>
    </Panel>
  );
}

function AIDraftCard({ draft }: { draft: CoachAIDraft }) {
  const actorId = useCoachingStore((s) => s.actorId);
  const run = useCoachingStore((s) => s.run);
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(draft.body);

  const update = (changes: Partial<Pick<CoachAIDraft, "title" | "body" | "status">>) =>
    void run((r) => r.ops.directive.updateAIDraft(draft.id, actorId, changes));

  return (
    <div className="border-t border-white/[0.06] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-[#f2eee6]">{draft.title}</span>
        <div className="flex items-center gap-1.5">
          <StatusChip tone="champagne">Drafted for Coach Review</StatusChip>
          <StatusChip tone={draft.status === "approved" ? "green" : "neutral"}>
            {draft.status === "approved" ? "Approved" : "Requires Coach Approval"}
          </StatusChip>
        </div>
      </div>
      {editing ? (
        <textarea
          className={`${inputClass} mt-2 min-h-[80px] resize-none`}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      ) : (
        <p className="mt-2 whitespace-pre-line text-[10px] leading-4 text-white/55">{draft.body}</p>
      )}
      <div className="mt-1.5 flex flex-wrap gap-1">
        {draft.basis.map((b) => (
          <span key={b} className="font-mono text-[9px] uppercase tracking-[0.14em] text-white/25">{b}</span>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {draft.status !== "approved" && (
          <>
            {editing ? (
              <CommandButton onClick={() => { update({ body, status: "edited" }); setEditing(false); }}>Save edits</CommandButton>
            ) : (
              <CommandButton variant="ghost" onClick={() => setEditing(true)}>
                <span className="flex items-center gap-1.5"><FileEdit size={10} /> Edit</span>
              </CommandButton>
            )}
            <CommandButton onClick={() => update({ status: "approved" })}>Approve</CommandButton>
          </>
        )}
        <CommandButton variant="ghost" onClick={() => update({ status: "discarded" })}>Discard</CommandButton>
      </div>
    </div>
  );
}
