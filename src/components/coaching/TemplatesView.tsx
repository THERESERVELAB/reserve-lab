"use client";

/* TEMPLATES — reusable coaching plans as rows. Create and edit happen in a
   sheet; assigning one to a client opens a personalized draft. */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Archive, ArchiveRestore, Copy, Pencil } from "lucide-react";

import { ReserveBottomSheet, ReserveSheetClose, useDirtySnapshot, useReportDirty } from "@/components/ui/reserve";
import { useCoachingStore } from "@/lib/coaching/store";
import type { CoachTemplate, PrescriptionPayload, TemplateCategory } from "@/lib/coaching/types";
import { resolveTemplatesBrief } from "@/lib/coaching/workspace-brief";
import { clearCoachIntent, peekCoachIntent } from "./coach-actions";
import { PrescriptionComposer, type ComposerSeed } from "./PrescriptionComposer";
import { CoachHero, CoachPage, CoachSection, CommandButton, EmptyState, Field, RowList, StatusChip, inputClass } from "./ui";

const CATEGORY_LABELS: Record<TemplateCategory, string> = {
  training_program: "Training program",
  workout: "Workout",
  nutrition_plan: "Nutrition plan",
  meal: "Meal",
  weekly_schedule: "Weekly schedule",
  checkin_form: "Check-in form",
  cardio_plan: "Cardio plan",
  recovery_routine: "Recovery routine",
};

type SheetState = { mode: "create" } | { mode: "edit"; template: CoachTemplate } | { mode: "assign"; template: CoachTemplate } | null;

export function TemplatesView() {
  const db = useCoachingStore((s) => s.db);
  const actorId = useCoachingStore((s) => s.actorId);
  const run = useCoachingStore((s) => s.run);
  const allClients = useCoachingStore((s) => s.clients);
  const clients = useMemo(() => allClients.filter((c) => c.status === "active"), [allClients]);
  const [sheet, setSheet] = useState<SheetState>(() => (peekCoachIntent("create-template") ? { mode: "create" } : null));
  const [sheetDirty, setSheetDirty] = useState(false);
  const [composer, setComposer] = useState<ComposerSeed | null>(null);
  const closeSheet = useCallback(() => setSheet(null), []);
  const closeComposer = useCallback(() => setComposer(null), []);

  useEffect(() => {
    clearCoachIntent("create-template");
  }, []);

  const mine = db.templates.filter((t) => t.coachId === actorId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const active = mine.filter((t) => !t.archived);
  const archived = mine.filter((t) => t.archived);
  const brief = resolveTemplatesBrief(active.length, archived.length);

  const assign = async (template: CoachTemplate, athleteId: string) => {
    const assignment = await run((r) => r.templates.assignTemplate(template.id, actorId, athleteId));
    if (!assignment) return;
    let initialPayload: PrescriptionPayload | undefined;
    let category: PrescriptionPayload["category"] | null = null;
    if (template.payload.category === "training_program") {
      category = "training";
      initialPayload = { category, training: structuredClone(template.payload.training) };
    } else if (template.payload.category === "nutrition_plan") {
      category = "nutrition";
      initialPayload = { category, nutrition: structuredClone(template.payload.nutrition) };
    } else if (template.payload.category === "weekly_schedule") {
      category = "schedule";
      initialPayload = { category, schedule: structuredClone(template.payload.schedule) };
    }
    setSheet(null);
    if (category && initialPayload) setComposer({ category, athleteId, initialPayload });
  };

  const assignedCount = (id: string) => db.templateAssignments.filter((a) => a.templateId === id).length;

  const row = (template: CoachTemplate) => (
    <li key={template.id} className={`flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between ${template.archived ? "opacity-70" : ""}`}>
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2">
          <span className="text-[14px] font-semibold text-[#f2eee6]">{template.name}</span>
          <StatusChip tone="neutral">{CATEGORY_LABELS[template.category]}</StatusChip>
          {assignedCount(template.id) > 0 && <StatusChip tone="teal">{assignedCount(template.id)} assigned</StatusChip>}
        </p>
        {template.description && <p className="mt-0.5 text-[12px] leading-[1.45] text-white/60">{template.description}</p>}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-1">
        {!template.archived && (
          <CommandButton onClick={() => setSheet({ mode: "assign", template })}>Assign</CommandButton>
        )}
        <IconAction label={`Duplicate ${template.name}`} onClick={() => void run((r) => r.templates.duplicateTemplate(template.id, actorId))}>
          <Copy size={14} aria-hidden="true" />
        </IconAction>
        <IconAction label={`Edit ${template.name}`} onClick={() => setSheet({ mode: "edit", template })}>
          <Pencil size={14} aria-hidden="true" />
        </IconAction>
        <IconAction
          label={template.archived ? `Restore ${template.name}` : `Archive ${template.name}`}
          onClick={() => void run((r) => r.templates.setArchived(template.id, actorId, !template.archived))}
        >
          {template.archived ? <ArchiveRestore size={14} aria-hidden="true" /> : <Archive size={14} aria-hidden="true" />}
        </IconAction>
      </div>
    </li>
  );

  return (
    <CoachPage screen="templates">
      <CoachHero
        title="Templates"
        brief={brief}
        reads={[
          { label: "Ready", value: String(active.length) },
          { label: "Archived", value: String(archived.length) },
        ]}
        onPrimary={() => setSheet({ mode: "create" })}
      />

      <CoachSection label={`Templates · ${active.length}`}>
        {active.length === 0 ? (
          <EmptyState
            title="No templates"
            body="Save a program, nutrition plan or schedule once, then personalize it for any client."
            requirements={["A category", "A name"]}
          />
        ) : (
          <RowList label="Templates">{active.map(row)}</RowList>
        )}
      </CoachSection>

      {archived.length > 0 && (
        <CoachSection label={`Archived · ${archived.length}`}>
          <RowList label="Archived templates">{archived.map(row)}</RowList>
        </CoachSection>
      )}

      <ReserveBottomSheet
        open={sheet !== null}
        onClose={closeSheet}
        dirty={sheetDirty}
        title={sheet?.mode === "create" ? "Create template" : sheet?.mode === "edit" ? `Edit ${sheet.template.name}` : sheet?.mode === "assign" ? `Assign ${sheet.template.name}` : "Template"}
      >
        {sheet?.mode === "assign" ? (
          clients.length === 0 ? (
            <p className="pb-2 text-[12.5px] text-white/65">No active clients to assign to yet.</p>
          ) : (
            <ul className="flex flex-col pb-2 [&>li+li]:border-t [&>li+li]:border-white/[0.05]">
              {clients.map((client) => (
                <li key={client.athleteId}>
                  <button
                    type="button"
                    onClick={() => void assign(sheet.template, client.athleteId)}
                    className="flex min-h-[48px] w-full items-center text-left text-[14px] text-white/80 transition-colors hover:text-[#f2eee6]"
                  >
                    {client.name}
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : sheet ? (
          <TemplateForm
            key={sheet.mode === "edit" ? sheet.template.id : "create"}
            template={sheet.mode === "edit" ? sheet.template : null}
            onDirtyChange={setSheetDirty}
            onCancel={closeSheet}
            onSave={async (values) => {
              const ok =
                sheet.mode === "edit"
                  ? await run((r) => r.templates.updateTemplate(sheet.template.id, actorId, { name: values.name, description: values.description }))
                  : await run((r) =>
                      r.templates.createTemplate({
                        coachId: actorId,
                        category: values.category,
                        name: values.name,
                        description: values.description,
                        payload: defaultTemplatePayload(values.category),
                      }),
                    );
              if (ok) {
                setSheetDirty(false);
                setSheet(null);
              }
            }}
          />
        ) : null}
      </ReserveBottomSheet>

      {composer && <PrescriptionComposer seed={composer} onClose={closeComposer} />}
    </CoachPage>
  );
}

function TemplateForm({
  template,
  onDirtyChange,
  onCancel,
  onSave,
}: {
  template: CoachTemplate | null;
  onDirtyChange: (dirty: boolean) => void;
  onCancel: () => void;
  onSave: (values: { category: TemplateCategory; name: string; description: string }) => void | Promise<void>;
}) {
  const [category, setCategory] = useState<TemplateCategory>(template?.category ?? "training_program");
  const [name, setName] = useState(template?.name ?? "");
  const [description, setDescription] = useState(template?.description ?? "");
  useReportDirty(useDirtySnapshot({ category, name, description }), onDirtyChange);

  return (
    <div className="flex flex-col gap-3 pb-2">
      {!template && (
        <Field label="Category">
          <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value as TemplateCategory)}>
            {(Object.keys(CATEGORY_LABELS) as TemplateCategory[]).map((c) => (
              <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
            ))}
          </select>
        </Field>
      )}
      <Field label="Name">
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Description">
        <input className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      <div className="flex gap-2">
        <ReserveSheetClose fallback={onCancel}>{(close) => <CommandButton variant="ghost" onClick={close}>Cancel</CommandButton>}</ReserveSheetClose>
        <CommandButton
          className="flex-1"
          disabled={!name.trim()}
          disabledReason="Enter a template name"
          onClick={() => void onSave({ category, name: name.trim(), description: description.trim() })}
        >
          Save
        </CommandButton>
      </div>
    </div>
  );
}

function defaultTemplatePayload(category: TemplateCategory): CoachTemplate["payload"] {
  switch (category) {
    case "training_program":
      return {
        category,
        training: {
          programName: "", durationWeeks: 8, splitName: "", daysPerWeek: 4,
          days: [{ dayLabel: "Day 1", title: "", focus: "", demand: "standard", exercises: [] }],
          progressionStrategy: "Double progression", deloadWeek: null,
        },
      };
    case "workout":
      return { category, day: { dayLabel: "Day 1", title: "", focus: "", demand: "standard", exercises: [] } };
    case "nutrition_plan":
      return {
        category,
        nutrition: {
          planName: "", mode: "hybrid",
          trainingDay: { kcal: 0, protein: 0, carbs: 0, fat: 0, mealCount: 4 },
          restDay: { kcal: 0, protein: 0, carbs: 0, fat: 0, mealCount: 4 },
          meals: [],
        },
      };
    case "meal":
      return { category, meal: { name: "", timeWindow: "", foods: [] } };
    case "weekly_schedule":
      return {
        category,
        schedule: {
          planName: "", wakeTarget: "06:30", bedTarget: "22:30", trainingTime: "17:30",
          trainingDays: [], checkInDay: "Sunday", photoDay: null, blocks: [],
        },
      };
    case "checkin_form":
      return { category, fields: ["Weight", "Training adherence", "Nutrition adherence", "Recovery", "Questions"] };
    case "cardio_plan":
      return { category, description: "", sessionsPerWeek: 0 };
    case "recovery_routine":
      return { category, description: "", tasks: [] };
  }
}

function IconAction({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="grid min-h-[44px] min-w-[44px] place-items-center rounded-lg text-white/55 transition-colors hover:text-[#d5b15f]"
    >
      {children}
    </button>
  );
}
