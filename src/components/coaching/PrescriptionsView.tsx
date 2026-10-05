"use client";

/* Coach-wide prescription hub for one category (Programs / Nutrition /
   Schedules): one statement about where the plans stand, one gold action
   (revise, send, finish, or draft), then every client's plans as rows.
   A new draft starts in a sheet: choose the client and a starting point. */

import { useCallback, useEffect, useMemo, useState } from "react";

import { ReserveBottomSheet, ReserveSheetClose } from "@/components/ui/reserve";
import { canSuggest } from "@/lib/coaching/permissions";
import { useCoachingStore } from "@/lib/coaching/store";
import type { CoachPrescription, PrescriptionCategory, PrescriptionPayload } from "@/lib/coaching/types";
import { resolvePlansBrief } from "@/lib/coaching/workspace-brief";
import { clearCoachIntent, focusCoachTarget, peekCoachIntent, useRunCoachAction } from "./coach-actions";
import { PrescriptionCard } from "./PrescriptionCard";
import { PrescriptionComposer, type ComposerSeed } from "./PrescriptionComposer";
import { CoachHero, CoachPage, CoachSection, CommandButton, EmptyState, Field, inputClass } from "./ui";

const CATEGORY_TITLES: Record<PrescriptionCategory, { title: string; noun: string }> = {
  training: { title: "Programs", noun: "program" },
  nutrition: { title: "Nutrition", noun: "nutrition plan" },
  schedule: { title: "Schedules", noun: "schedule" },
};

const ACTIVE = new Set(["active", "accepted"]);

export function PrescriptionsView({ category }: { category: PrescriptionCategory }) {
  const db = useCoachingStore((s) => s.db);
  const actorId = useCoachingStore((s) => s.actorId);
  const run = useCoachingStore((s) => s.run);
  const allClients = useCoachingStore((s) => s.clients);
  const runAction = useRunCoachAction();
  const clients = useMemo(() => allClients.filter((c) => c.status === "active"), [allClients]);
  const meta = CATEGORY_TITLES[category];

  const prescriptions = useMemo(
    () =>
      db.prescriptions
        .filter((p) => p.coachId === actorId && p.category === category)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [db.prescriptions, actorId, category],
  );
  const nameOf = useCallback((athleteId: string) => db.members.find((m) => m.id === athleteId)?.name ?? "Client", [db.members]);

  const accessFor = (athleteId: string) => {
    const rel = db.relationships.find((r) => r.coachId === actorId && r.athleteId === athleteId && r.status === "active") ?? null;
    return canSuggest(rel, category);
  };
  const clientsWithAccess = clients.filter((c) => accessFor(c.athleteId)).length;

  const seedFor = (rx: CoachPrescription, mode: "edit" | "revise"): ComposerSeed =>
    mode === "edit"
      ? { category, athleteId: rx.athleteId, editing: rx }
      : { category, athleteId: rx.athleteId, revisingFrom: rx, initialPayload: rx.payload };

  const [composer, setComposer] = useState<ComposerSeed | null>(() => {
    const revise = peekCoachIntent("revise");
    const edit = peekCoachIntent("edit");
    const rx = prescriptions.find((p) => p.id === (revise?.prescriptionId ?? edit?.prescriptionId));
    return rx ? seedFor(rx, revise ? "revise" : "edit") : null;
  });
  const [creating, setCreating] = useState(false);
  const closeComposer = useCallback(() => setComposer(null), [setComposer]);
  const closeCreating = useCallback(() => setCreating(false), [setCreating]);

  useEffect(() => {
    clearCoachIntent("revise");
    clearCoachIntent("edit");
  }, []);

  const brief = resolvePlansBrief({
    category,
    plans: prescriptions.map((p) => ({ id: p.id, athleteId: p.athleteId, athleteName: nameOf(p.athleteId), title: p.title, status: p.status })),
    clientsWithAccess,
  });

  const onPrimary = () => {
    const action = brief.primary;
    if (!action) return;
    const rx = "prescriptionId" in action ? prescriptions.find((p) => p.id === action.prescriptionId) : undefined;
    switch (action.kind) {
      case "revise-plan":
        if (rx) setComposer(seedFor(rx, "revise"));
        return;
      case "finish-draft":
        if (rx) setComposer(seedFor(rx, "edit"));
        return;
      case "send-plan":
        if (rx) {
          void run((r) => r.prescriptions.publish(rx.id, actorId, "send_for_approval"));
          focusCoachTarget(`rx-${rx.id}`);
        }
        return;
      case "create-plan":
        setCreating(true);
        return;
      default:
        runAction(action);
    }
  };

  const awaiting = prescriptions.filter((p) => p.status === "sent").length;
  const active = prescriptions.filter((p) => ACTIVE.has(p.status)).length;
  const open = prescriptions.filter((p) => !["archived", "replaced"].includes(p.status));
  const closed = prescriptions.filter((p) => ["archived", "replaced"].includes(p.status));

  return (
    <CoachPage screen={category === "training" ? "programs" : category === "nutrition" ? "nutrition" : "schedules"}>
      <CoachHero
        title={meta.title}
        brief={brief}
        reads={[
          { label: "Active", value: String(active) },
          { label: "With athletes", value: String(awaiting) },
          { label: "Clients allowed", value: String(clientsWithAccess) },
        ]}
        onPrimary={onPrimary}
      />

      <CoachSection label={prescriptions.length > 0 ? `${meta.title} · ${open.length}` : meta.title}>
        {prescriptions.length === 0 ? (
          <EmptyState
            title={`No ${meta.title.toLowerCase()} yet`}
            body={`A ${meta.noun} is drafted here, previewed as the athlete sees it, then sent for their approval.`}
            requirements={[`An active client who allows ${category} plans`, "A title and the reason for the plan"]}
          />
        ) : (
          <ul className="flex flex-col gap-4">
            {open.map((rx) => (
              <li key={rx.id}>
                <PrescriptionCard
                  prescription={rx}
                  viewer="coach"
                  athleteName={nameOf(rx.athleteId)}
                  onEdit={(p) => setComposer(seedFor(p, "edit"))}
                  onRevise={(p) => setComposer(seedFor(p, "revise"))}
                />
              </li>
            ))}
          </ul>
        )}
        {closed.length > 0 && (
          <p className="mt-3 text-[12px] text-white/55">
            {closed.length} archived or replaced {closed.length === 1 ? "version is" : "versions are"} kept in each client&apos;s history.
          </p>
        )}
      </CoachSection>

      <ReserveBottomSheet open={creating} onClose={closeCreating} title={`New ${meta.noun}`}>
        {creating && (
          <NewDraftForm
            category={category}
            clients={clients.map((c) => ({ athleteId: c.athleteId, name: c.name, allowed: accessFor(c.athleteId) }))}
            templates={db.templates.filter(
              (t) =>
                t.coachId === actorId &&
                !t.archived &&
                ((category === "training" && t.category === "training_program") ||
                  (category === "nutrition" && t.category === "nutrition_plan") ||
                  (category === "schedule" && t.category === "weekly_schedule")),
            )}
            onCancel={closeCreating}
            onStart={(seed) => {
              setCreating(false);
              setComposer(seed);
            }}
          />
        )}
      </ReserveBottomSheet>

      {composer && <PrescriptionComposer seed={composer} onClose={closeComposer} />}
    </CoachPage>
  );
}

function NewDraftForm({
  category,
  clients,
  templates,
  onCancel,
  onStart,
}: {
  category: PrescriptionCategory;
  clients: Array<{ athleteId: string; name: string; allowed: boolean }>;
  templates: ReturnType<typeof useCoachingStore.getState>["db"]["templates"];
  onCancel: () => void;
  onStart: (seed: ComposerSeed) => void;
}) {
  const [athleteChoice, setAthleteChoice] = useState(() => clients.find((c) => c.allowed)?.athleteId ?? "");
  const [templateChoice, setTemplateChoice] = useState("");

  const start = () => {
    if (!athleteChoice) return;
    const template = templates.find((t) => t.id === templateChoice);
    let initialPayload: PrescriptionPayload | undefined;
    if (template) {
      if (template.payload.category === "training_program") {
        initialPayload = { category: "training", training: structuredClone(template.payload.training) };
      } else if (template.payload.category === "nutrition_plan") {
        initialPayload = { category: "nutrition", nutrition: structuredClone(template.payload.nutrition) };
      } else if (template.payload.category === "weekly_schedule") {
        initialPayload = { category: "schedule", schedule: structuredClone(template.payload.schedule) };
      }
    }
    onStart({ category, athleteId: athleteChoice, initialPayload });
  };

  return (
    <div className="flex flex-col gap-3 pb-1">
      <Field label="Client">
        <select className={inputClass} value={athleteChoice} onChange={(e) => setAthleteChoice(e.target.value)}>
          <option value="">Choose a client…</option>
          {clients.map((client) => (
            <option key={client.athleteId} value={client.athleteId} disabled={!client.allowed}>
              {client.name}{client.allowed ? "" : ` — ${category} access not granted`}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Start from">
        <select className={inputClass} value={templateChoice} onChange={(e) => setTemplateChoice(e.target.value)}>
          <option value="">Blank</option>
          {templates.map((template) => (
            <option key={template.id} value={template.id}>{template.name}</option>
          ))}
        </select>
      </Field>
      <div className="flex gap-2">
        <ReserveSheetClose fallback={onCancel}>{(close) => <CommandButton variant="ghost" onClick={close}>Cancel</CommandButton>}</ReserveSheetClose>
        <CommandButton className="flex-1" disabled={!athleteChoice} disabledReason="Choose a client" onClick={start}>
          Open draft
        </CommandButton>
      </div>
    </div>
  );
}
