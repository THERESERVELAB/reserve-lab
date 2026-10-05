"use client";

/* ════════════════════════════════════════════════════════════════════════
   SUPPLEMENT PROTOCOLS — coach workspace.

   Structured, versioned protocols of ordinary wellness products. The
   coach drafts, revises, sends; the athlete approves. Reserve records
   coach-entered serving text verbatim and never computes or suggests
   doses. Clinical substances live in Clinical Coordination, never here.
   ════════════════════════════════════════════════════════════════════════ */

import { useMemo, useState } from "react";
import { Archive, ChevronDown, PauseCircle, Pill, Plus, Send, Trash2 } from "lucide-react";

import { dateKeyOffset, todayKey } from "@/lib/coaching/ids";
import { canSuggest, canView } from "@/lib/coaching/permissions";
import { useCoachingStore } from "@/lib/coaching/store";
import type { ProtocolDraftInput } from "@/lib/coaching/operations/contracts";
import {
  PROTOCOL_MOMENTS,
  PROTOCOL_MOMENT_LABELS,
  type ProtocolMoment,
  type SupplementCategory,
  type SupplementProtocol,
  type SupplementProtocolItem,
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

export const OP_STATUS_TONE: Record<string, "neutral" | "champagne" | "teal" | "green" | "amber" | "red"> = {
  draft: "neutral",
  ready_for_review: "champagne",
  sent: "teal",
  active: "green",
  revision_requested: "amber",
  declined: "red",
  paused: "neutral",
  replaced: "neutral",
  archived: "neutral",
};

export const opStatusLabel = (s: string) => s.replace(/_/g, " ");

const CATEGORY_LABELS: Record<SupplementCategory, string> = {
  performance: "Performance",
  recovery: "Recovery",
  hydration: "Hydration",
  sleep: "Sleep",
  digestion: "Digestion",
  general_wellness: "General Wellness",
  pre_training: "Pre-Training",
  intra_training: "Intra-Training",
  post_training: "Post-Training",
  micronutrient: "Micronutrient",
  custom: "Custom",
};

const FREQUENCY_LABELS: Record<SupplementProtocolItem["frequency"], string> = {
  daily: "Daily",
  training_days: "Training days",
  rest_days: "Rest days",
  weekly: "Weekly",
  as_directed_by_coach: "As coach directed",
};

export function ProtocolsPanel({
  athleteId,
  relationship,
}: {
  athleteId: string;
  relationship: CoachingRelationship | null;
}) {
  const db = useCoachingStore((s) => s.db);
  const actorId = useCoachingStore((s) => s.actorId);
  const run = useCoachingStore((s) => s.run);
  const [builder, setBuilder] = useState<BuilderSeed | null>(null);

  const protocols = useMemo(
    () =>
      db.supplementProtocols
        .filter((p) => p.athleteId === athleteId)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [db.supplementProtocols, athleteId],
  );
  const adherence = db.protocolAdherence.filter((e) => e.athleteId === athleteId);
  const mayView = canView(relationship, "supplements");
  const maySuggest = canSuggest(relationship, "supplements");

  if (!mayView) {
    return (
      <EmptyState
        title="Supplement access not granted"
        body="The athlete has not granted supplement-protocol access. Protocols stay private until they grant it."
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="max-w-xl text-[10px] leading-4 text-white/35">
          Ordinary wellness products only — servings are recorded exactly as you write them.
          Reserve never calculates or recommends doses. Clinician-directed compounds belong in
          Clinical Coordination, which requires the athlete&apos;s separate consent.
        </p>
        <CommandButton
          disabled={!maySuggest}
          disabledReason="The athlete has not granted supplement access at the suggest level"
          onClick={() => setBuilder({ athleteId })}
        >
          <span className="flex items-center gap-1.5"><Plus size={11} /> New protocol</span>
        </CommandButton>
      </div>

      {protocols.length === 0 ? (
        <EmptyState
          title="No protocols yet"
          body="Draft a structured supplement protocol, send it for the athlete's review, and monitor adherence once they accept."
        />
      ) : (
        protocols.map((protocol) => (
          <ProtocolCard
            key={protocol.id}
            protocol={protocol}
            adherence={adherence.filter((e) => e.protocolId === protocol.id)}
            canAct={maySuggest}
            onEdit={() => setBuilder({ athleteId, editing: protocol })}
            onRevise={() => setBuilder({ athleteId, revisingFrom: protocol })}
            onSend={() => void run((r) => r.ops.protocols.send(protocol.id, actorId))}
            onPause={() => void run((r) => r.ops.protocols.pause(protocol.id, actorId))}
            onArchive={() => void run((r) => r.ops.protocols.archive(protocol.id, actorId))}
          />
        ))
      )}

      {builder && <ProtocolBuilder seed={builder} onClose={() => setBuilder(null)} />}
    </div>
  );
}

/* ─── Protocol card ───────────────────────────────────────────────────── */

function ProtocolCard({
  protocol,
  adherence,
  canAct,
  onEdit,
  onRevise,
  onSend,
  onPause,
  onArchive,
}: {
  protocol: SupplementProtocol;
  adherence: Array<{ itemId: string; date: string; mark: string }>;
  canAct: boolean;
  onEdit: () => void;
  onRevise: () => void;
  onSend: () => void;
  onPause: () => void;
  onArchive: () => void;
}) {
  const [open, setOpen] = useState(protocol.status === "active" || protocol.status === "sent");
  const weekAgo = dateKeyOffset(todayKey(), -7);
  const recent = adherence.filter((e) => e.date >= weekAgo);
  const adherencePct =
    recent.length === 0 ? null : Math.round((recent.filter((e) => e.mark === "taken").length / recent.length) * 100);
  const runningLow = protocol.items.filter((i) => i.runningLow);
  const editable = protocol.status === "draft" || protocol.status === "revision_requested";

  return (
    <Panel glow={protocol.status === "active"}>
      <PanelHeader
        label={`Version ${protocol.version} · ${relativeTime(protocol.updatedAt)}`}
        title={protocol.name}
        right={
          <div className="flex items-center gap-1.5">
            {adherencePct !== null && (
              <StatusChip tone={adherencePct >= 85 ? "green" : "amber"}>7-day {adherencePct}%</StatusChip>
            )}
            <StatusChip tone={OP_STATUS_TONE[protocol.status]} pulse={protocol.status === "sent"}>
              {opStatusLabel(protocol.status)}
            </StatusChip>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="rounded-md border border-white/[0.08] p-1 text-white/40 transition-colors hover:text-white/70"
              aria-label={open ? "Collapse" : "Expand"}
            >
              <ChevronDown size={12} className={`transition-transform ${open ? "rotate-180" : ""}`} />
            </button>
          </div>
        }
      />
      {open && (
        <div className="flex flex-col gap-3 p-4">
          <p className="text-[11px] leading-5 text-white/55">{protocol.objective}</p>
          {protocol.coachRationale && (
            <p className="border-l-2 border-[#d5b15f]/25 pl-3 text-[10px] italic leading-4 text-white/40">
              {protocol.coachRationale}
            </p>
          )}
          <div className="flex flex-wrap gap-1.5">
            {protocol.reviewDate && <StatusChip tone="neutral">Review {protocol.reviewDate}</StatusChip>}
            {protocol.endDate && <StatusChip tone="neutral">Ends {protocol.endDate}</StatusChip>}
            {runningLow.length > 0 && (
              <StatusChip tone="amber">{runningLow.length} running low</StatusChip>
            )}
            {protocol.athleteDecisionNote && (
              <StatusChip tone="amber">Athlete: “{protocol.athleteDecisionNote}”</StatusChip>
            )}
          </div>

          {/* Items grouped by protocol moment */}
          <div className="flex flex-col gap-2">
            {PROTOCOL_MOMENTS.map((moment) => {
              const items = protocol.items.filter((i) => i.moment === moment);
              if (items.length === 0) return null;
              return (
                <div key={moment} className="border-t border-white/[0.06] p-3">
                  <MicroLabel tone="champagne">{PROTOCOL_MOMENT_LABELS[moment]}</MicroLabel>
                  <div className="mt-2 flex flex-col gap-1.5">
                    {items.map((item) => (
                      <div key={item.id} className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Pill size={11} className="text-white/25" />
                          <span className="text-[11px] font-medium text-[#f2eee6]">{item.productName}</span>
                          <span className="font-mono text-[9px] text-white/40">{item.servingDescription}</span>
                          {item.runningLow && <StatusChip tone="amber">Low</StatusChip>}
                        </div>
                        <span className="font-mono text-[8px] uppercase tracking-[0.12em] text-white/30">
                          {CATEGORY_LABELS[item.category]} · {FREQUENCY_LABELS[item.frequency]}
                          {item.withFood === "with_food" ? " · With food" : item.withFood === "empty_stomach" ? " · Empty stomach" : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Lifecycle actions */}
          <div className="flex flex-wrap gap-1.5 border-t border-white/[0.05] pt-3">
            {editable && canAct && (
              <>
                <CommandButton onClick={onEdit}>Edit draft</CommandButton>
                <CommandButton variant="teal" onClick={onSend}>
                  <span className="flex items-center gap-1.5"><Send size={11} /> Send for review</span>
                </CommandButton>
              </>
            )}
            {protocol.status === "active" && canAct && (
              <>
                <CommandButton onClick={onRevise}>Draft revision</CommandButton>
                <CommandButton variant="ghost" onClick={onPause}>
                  <span className="flex items-center gap-1.5"><PauseCircle size={11} /> Pause</span>
                </CommandButton>
              </>
            )}
            {protocol.status === "paused" && canAct && (
              <CommandButton onClick={onRevise}>Draft revision</CommandButton>
            )}
            {(protocol.status === "declined" || protocol.status === "paused") && canAct && (
              <CommandButton variant="ghost" onClick={onArchive}>
                <span className="flex items-center gap-1.5"><Archive size={11} /> Archive</span>
              </CommandButton>
            )}
          </div>

          {/* Audit trail */}
          <details className="group">
            <summary className="cursor-pointer font-mono text-[8px] uppercase tracking-[0.16em] text-white/25 hover:text-white/50">
              Audit trail ({protocol.auditEvents.length})
            </summary>
            <div className="mt-2 flex flex-col gap-1">
              {protocol.auditEvents.slice().reverse().map((event, i) => (
                <div key={i} className="flex items-center justify-between text-[9px]">
                  <span className="text-white/40">{event.event.replace(/_/g, " ")}{event.detail ? ` — ${event.detail}` : ""}</span>
                  <span className="font-mono text-white/25">{relativeTime(event.at)}</span>
                </div>
              ))}
            </div>
          </details>
        </div>
      )}
    </Panel>
  );
}

/* ─── Builder ─────────────────────────────────────────────────────────── */

type BuilderSeed = {
  athleteId: string;
  editing?: SupplementProtocol;
  revisingFrom?: SupplementProtocol;
};

type DraftItem = Omit<SupplementProtocolItem, "id"> & { id: string };

const blankItem = (): DraftItem => ({
  id: `pi-${Math.random().toString(36).slice(2, 9)}`,
  productName: "",
  isCustomProduct: false,
  category: "general_wellness",
  servingDescription: "",
  moment: "first_meal",
  frequency: "daily",
  purpose: "",
  withFood: "either",
  purchaseStatus: "owned",
  runningLow: false,
  reminderEnabled: true,
});

type BuilderStage = "architecture" | "products" | "timing" | "preview" | "release";

const STAGES: Array<{ id: BuilderStage; label: string }> = [
  { id: "architecture", label: "Architecture" },
  { id: "products", label: "Products" },
  { id: "timing", label: "Timing" },
  { id: "preview", label: "Athlete Preview" },
  { id: "release", label: "Release" },
];

function ProtocolBuilder({ seed, onClose }: { seed: BuilderSeed; onClose: () => void }) {
  const run = useCoachingStore((s) => s.run);
  const actorId = useCoachingStore((s) => s.actorId);
  const source = seed.editing ?? seed.revisingFrom;
  const [stage, setStage] = useState<BuilderStage>("architecture");
  const [name, setName] = useState(source?.name ?? "");
  const [objective, setObjective] = useState(source?.objective ?? "");
  const [rationale, setRationale] = useState(source?.coachRationale ?? "");
  const [reviewDate, setReviewDate] = useState(source?.reviewDate ?? "");
  const [endDate, setEndDate] = useState(source?.endDate ?? "");
  const [items, setItems] = useState<DraftItem[]>(
    source ? source.items.map((i) => ({ ...i })) : [blankItem()],
  );

  const setItem = (id: string, patch: Partial<DraftItem>) =>
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  const architectureDone = Boolean(name.trim() && objective.trim());
  const incompleteProducts = items.filter((i) => !i.productName.trim() || !i.servingDescription.trim() || !i.purpose.trim());
  const productsDone = items.length > 0 && incompleteProducts.length === 0;
  const valid = architectureDone && productsDone;
  const stageDone: Record<BuilderStage, boolean> = {
    architecture: architectureDone,
    products: productsDone,
    timing: productsDone,
    preview: valid,
    release: valid,
  };

  const save = async (thenSend: boolean) => {
    const input: ProtocolDraftInput = {
      coachId: actorId,
      athleteId: seed.athleteId,
      name: name.trim(),
      objective: objective.trim(),
      coachRationale: rationale.trim(),
      reviewDate: reviewDate || null,
      endDate: endDate || null,
      effectiveAt: null,
      items,
      trainingDayItemIds: items.filter((i) => i.frequency === "training_days").map((i) => i.id),
      restDayItemIds: items.filter((i) => i.frequency === "rest_days").map((i) => i.id),
      supersedesId: seed.revisingFrom?.id,
    };
    const saved = await run(async (r) => {
      const draft = seed.editing
        ? await r.ops.protocols.updateDraft(seed.editing.id, actorId, input)
        : await r.ops.protocols.createDraft(input);
      if (thenSend) await r.ops.protocols.send(draft.id, actorId);
      return draft;
    });
    if (saved) onClose();
  };

  return (
    <Panel glow className="border-[#d5b15f]/20">
      <PanelHeader
        label={seed.editing ? "Editing draft" : seed.revisingFrom ? `Revision of v${seed.revisingFrom.version}` : "New protocol"}
        title="Supplement protocol builder"
        right={<CommandButton variant="ghost" onClick={onClose}>Close</CommandButton>}
      />
      {/* Stage rail — the coach always knows what is built and what remains. */}
      <nav aria-label="Builder stages" className="flex flex-wrap gap-1 border-b border-white/[0.05] px-4 py-2.5">
        {STAGES.map((s, i) => (
          <button
            key={s.id}
            type="button"
            aria-current={stage === s.id ? "step" : undefined}
            onClick={() => setStage(s.id)}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.12em] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#d5b15f]/40 ${
              stage === s.id
                ? "border border-[#d5b15f]/35 bg-[#d5b15f]/12 text-[#d5b15f]"
                : "border border-transparent text-white/40 hover:text-white/70"
            }`}
          >
            <span
              className="flex h-3.5 w-3.5 items-center justify-center rounded-full text-[8px]"
              style={{
                background: stageDone[s.id] ? "rgba(110,231,183,0.15)" : "rgba(255,255,255,0.05)",
                color: stageDone[s.id] ? "#6ee7b7" : "rgba(255,255,255,0.35)",
              }}
              aria-hidden
            >
              {stageDone[s.id] ? "✓" : i + 1}
            </span>
            {s.label}
          </button>
        ))}
      </nav>

      <div className="flex flex-col gap-4 p-4">
        {stage === "architecture" && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Protocol name">
                <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Recovery Support — Block I" />
              </Field>
              <Field label="Objective">
                <input className={inputClass} value={objective} onChange={(e) => setObjective(e.target.value)} placeholder="What this protocol supports" />
              </Field>
              <Field label="Review date" hint="When you and the athlete revisit the protocol.">
                <input type="date" className={inputClass} value={reviewDate} onChange={(e) => setReviewDate(e.target.value)} />
              </Field>
              <Field label="End date (optional)">
                <input type="date" className={inputClass} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </Field>
            </div>
            <Field label="Coach rationale — shown to the athlete">
              <textarea className={`${inputClass} min-h-[52px] resize-none`} value={rationale} onChange={(e) => setRationale(e.target.value)} />
            </Field>
            <div className="flex justify-end">
              <CommandButton onClick={() => setStage("products")}>Continue to products</CommandButton>
            </div>
          </>
        )}

        {stage === "products" && (
          <>
            <div className="flex items-center justify-between">
              <MicroLabel tone="champagne">Products ({items.length})</MicroLabel>
              <CommandButton variant="ghost" onClick={() => setItems((prev) => [...prev, blankItem()])}>
                <span className="flex items-center gap-1.5"><Plus size={11} /> Add product</span>
              </CommandButton>
            </div>
            {items.map((item, index) => (
              <div key={item.id} className="border-t border-white/[0.06] p-3">
                <div className="mb-2 flex items-center justify-between">
                  <MicroLabel>{item.productName.trim() || `Product ${index + 1}`}</MicroLabel>
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setItems((prev) => prev.filter((i) => i.id !== item.id))}
                      className="rounded-md p-1.5 text-white/30 outline-none transition-colors hover:text-[#ef7d55] focus-visible:ring-2 focus-visible:ring-[#ef7d55]/40"
                      aria-label={`Remove ${item.productName.trim() || `product ${index + 1}`}`}
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
                <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                  <Field label="Product">
                    <input className={inputClass} value={item.productName} onChange={(e) => setItem(item.id, { productName: e.target.value })} placeholder="Product name" />
                  </Field>
                  <Field label="Serving — recorded exactly as written">
                    <input className={inputClass} value={item.servingDescription} onChange={(e) => setItem(item.id, { servingDescription: e.target.value })} placeholder="e.g. 1 scoop · As labeled" />
                  </Field>
                  <Field label="Purpose">
                    <input className={inputClass} value={item.purpose} onChange={(e) => setItem(item.id, { purpose: e.target.value })} placeholder="Why it's in the protocol" />
                  </Field>
                  <Field label="Category">
                    <select className={inputClass} value={item.category} onChange={(e) => setItem(item.id, { category: e.target.value as SupplementCategory, isCustomProduct: e.target.value === "custom" })}>
                      {(Object.keys(CATEGORY_LABELS) as SupplementCategory[]).map((c) => (
                        <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Brand preference (optional)">
                    <input className={inputClass} value={item.brandPreference ?? ""} onChange={(e) => setItem(item.id, { brandPreference: e.target.value || undefined })} />
                  </Field>
                  <Field label="Purchase status">
                    <SegmentedControl
                      size="xs"
                      options={[
                        { value: "owned", label: "Owned" },
                        { value: "needs_purchase", label: "Needs purchase" },
                        { value: "ordered", label: "Ordered" },
                      ]}
                      value={item.purchaseStatus}
                      onChange={(v) => setItem(item.id, { purchaseStatus: v })}
                    />
                  </Field>
                  <Field label="Coach note (optional)">
                    <input className={inputClass} value={item.coachNote ?? ""} onChange={(e) => setItem(item.id, { coachNote: e.target.value || undefined })} />
                  </Field>
                </div>
              </div>
            ))}
            <div className="flex justify-between">
              <CommandButton variant="ghost" onClick={() => setStage("architecture")}>Back</CommandButton>
              <CommandButton onClick={() => setStage("timing")}>Continue to timing</CommandButton>
            </div>
          </>
        )}

        {stage === "timing" && (
          <>
            <p className="text-[10px] leading-4 text-white/40">
              Place each product in the athlete&apos;s day. Timing is how a protocol survives a real
              schedule — moments, not clock-times.
            </p>
            {items.map((item, index) => (
              <div key={item.id} className="border-t border-white/[0.06] p-3">
                <MicroLabel className="mb-2">{item.productName.trim() || `Product ${index + 1}`}</MicroLabel>
                <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                  <Field label="Moment">
                    <select className={inputClass} value={item.moment} onChange={(e) => setItem(item.id, { moment: e.target.value as ProtocolMoment })}>
                      {PROTOCOL_MOMENTS.map((m) => (
                        <option key={m} value={m}>{PROTOCOL_MOMENT_LABELS[m]}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Frequency">
                    <select className={inputClass} value={item.frequency} onChange={(e) => setItem(item.id, { frequency: e.target.value as DraftItem["frequency"] })}>
                      {(Object.keys(FREQUENCY_LABELS) as Array<DraftItem["frequency"]>).map((f) => (
                        <option key={f} value={f}>{FREQUENCY_LABELS[f]}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="With food">
                    <SegmentedControl
                      size="xs"
                      options={[
                        { value: "with_food", label: "With food" },
                        { value: "empty_stomach", label: "Empty" },
                        { value: "either", label: "Either" },
                      ]}
                      value={item.withFood}
                      onChange={(v) => setItem(item.id, { withFood: v })}
                    />
                  </Field>
                  <label className="flex items-center gap-2 self-end pb-2">
                    <input
                      type="checkbox"
                      checked={item.reminderEnabled}
                      onChange={(e) => setItem(item.id, { reminderEnabled: e.target.checked })}
                      className="accent-[#d5b15f]"
                    />
                    <span className="text-[10px] text-white/45">Athlete reminder</span>
                  </label>
                </div>
              </div>
            ))}
            <div className="flex justify-between">
              <CommandButton variant="ghost" onClick={() => setStage("products")}>Back</CommandButton>
              <CommandButton onClick={() => setStage("preview")}>Continue to athlete preview</CommandButton>
            </div>
          </>
        )}

        {stage === "preview" && (
          <>
            <p className="text-[10px] leading-4 text-white/40">
              Exactly what the athlete will see — the protocol as moments of their day, not a table.
            </p>
            <div className="mx-auto flex w-full max-w-md flex-col gap-2 border-l border-[#d5b15f]/25 py-1 pl-3">
              <MicroLabel tone="champagne">{name.trim() || "Untitled protocol"}</MicroLabel>
              {PROTOCOL_MOMENTS.map((moment) => {
                const momentItems = items.filter((i) => i.moment === moment && i.productName.trim());
                if (momentItems.length === 0) return null;
                return (
                  <div key={moment} className="border-t border-white/[0.06] p-3">
                    <MicroLabel>{PROTOCOL_MOMENT_LABELS[moment]}</MicroLabel>
                    {momentItems.map((item) => (
                      <div key={item.id} className="mt-1.5 flex items-center justify-between">
                        <span className="text-[11px] font-medium text-[#f2eee6]">{item.productName}</span>
                        <span className="font-mono text-[9px] text-white/40">{item.servingDescription}</span>
                      </div>
                    ))}
                  </div>
                );
              })}
              {items.every((i) => !i.productName.trim()) && (
                <p className="py-4 text-center text-[10px] text-white/30">Add products to see the athlete view.</p>
              )}
            </div>
            <div className="flex justify-between">
              <CommandButton variant="ghost" onClick={() => setStage("timing")}>Back</CommandButton>
              <CommandButton onClick={() => setStage("release")}>Continue to release</CommandButton>
            </div>
          </>
        )}

        {stage === "release" && (
          <>
            <div className="border-t border-white/[0.06] p-3">
              <MicroLabel tone="champagne">Release check</MicroLabel>
              <div className="mt-2 flex flex-col gap-1 text-[10px]">
                <ReleaseRow ok={architectureDone} text={architectureDone ? "Architecture complete" : "Name and objective are required"} />
                <ReleaseRow
                  ok={productsDone}
                  text={
                    productsDone
                      ? `${items.length} product${items.length === 1 ? "" : "s"} fully specified`
                      : `${incompleteProducts.length} product${incompleteProducts.length === 1 ? "" : "s"} missing name, serving, or purpose`
                  }
                />
                <ReleaseRow ok={Boolean(reviewDate)} text={reviewDate ? `Review scheduled ${reviewDate}` : "No review date set (optional, recommended)"} soft />
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <CommandButton disabled={!valid} disabledReason="Complete the architecture and products stages first" onClick={() => void save(false)}>
                Save draft
              </CommandButton>
              <CommandButton variant="teal" disabled={!valid} disabledReason="Complete the architecture and products stages first" onClick={() => void save(true)}>
                <span className="flex items-center gap-1.5"><Send size={11} /> Save &amp; send for review</span>
              </CommandButton>
              <CommandButton variant="ghost" onClick={onClose}>Cancel</CommandButton>
            </div>
            <p className="text-[9px] leading-4 text-white/25">
              The athlete reviews, approves, requests revision, or declines. Accepting a revision preserves
              every prior version in history — nothing is overwritten.
            </p>
          </>
        )}
      </div>
    </Panel>
  );
}

function ReleaseRow({ ok, text, soft = false }: { ok: boolean; text: string; soft?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="flex h-3.5 w-3.5 items-center justify-center rounded-full text-[8px]"
        style={{
          background: ok ? "rgba(110,231,183,0.15)" : soft ? "rgba(255,255,255,0.05)" : "rgba(251,191,36,0.12)",
          color: ok ? "#6ee7b7" : soft ? "rgba(255,255,255,0.35)" : "#e8c87a",
        }}
        aria-hidden
      >
        {ok ? "✓" : "!"}
      </span>
      <span className={ok ? "text-white/55" : soft ? "text-white/40" : "text-[#e8c87a]/90"}>{text}</span>
    </div>
  );
}
