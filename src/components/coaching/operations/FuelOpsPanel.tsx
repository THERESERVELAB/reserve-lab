"use client";

/* ════════════════════════════════════════════════════════════════════════
   FUEL OPERATIONS — coach workspace for the athlete's complete nutrition
   operation: Nutrition Architecture → Meal Plans → Meal Operations →
   Grocery Command. Coach-entered figures are estimates and structure —
   never lab-precise claims, never live store data.
   ════════════════════════════════════════════════════════════════════════ */

import { useMemo, useState } from "react";
import { CalendarRange, ChefHat, Plus, Send, ShoppingCart, UtensilsCrossed } from "lucide-react";

import { dateKeyOffset, todayKey } from "@/lib/coaching/ids";
import { canSuggest, canView } from "@/lib/coaching/permissions";
import { useCoachingStore } from "@/lib/coaching/store";
import { buildPrepSequence } from "@/lib/coaching/operations/engines";
import {
  GROCERY_CATEGORY_LABELS,
  type DayTargets,
  type GroceryCategory,
  type GroceryItem,
  type GroceryPlan,
  type Meal,
  type MealPlan,
  type MealPlanScope,
  type MealPrepSession,
  type NutritionArchitecture,
  type PreparedMealState,
} from "@/lib/coaching/operations/types";
import type { CoachingRelationship, PermissionCategory } from "@/lib/coaching/types";
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

type FuelSection = "architecture" | "meals" | "prep" | "grocery";

export function FuelOpsPanel({
  athleteId,
  relationship,
}: {
  athleteId: string;
  relationship: CoachingRelationship | null;
}) {
  const [section, setSection] = useState<FuelSection>("architecture");
  return (
    <div className="flex flex-col gap-3">
      <SegmentedControl<FuelSection>
        options={[
          { value: "architecture", label: "Nutrition Architecture" },
          { value: "meals", label: "Meal Plans" },
          { value: "prep", label: "Meal Operations" },
          { value: "grocery", label: "Grocery Command" },
        ]}
        value={section}
        onChange={setSection}
      />
      {section === "architecture" && (
        <Gate relationship={relationship} category="nutritionArchitecture" noun="nutrition-architecture">
          <ArchitectureSection athleteId={athleteId} relationship={relationship} />
        </Gate>
      )}
      {section === "meals" && (
        <Gate relationship={relationship} category="mealPlans" noun="meal-plan">
          <MealPlansSection athleteId={athleteId} relationship={relationship} />
        </Gate>
      )}
      {section === "prep" && (
        <Gate relationship={relationship} category="mealPreparation" noun="meal-preparation">
          <MealOpsSection athleteId={athleteId} relationship={relationship} />
        </Gate>
      )}
      {section === "grocery" && (
        <Gate relationship={relationship} category="grocery" noun="grocery">
          <GrocerySection athleteId={athleteId} relationship={relationship} />
        </Gate>
      )}
    </div>
  );
}

function Gate({
  relationship,
  category,
  noun,
  children,
}: {
  relationship: CoachingRelationship | null;
  category: PermissionCategory;
  noun: string;
  children: React.ReactNode;
}) {
  if (!canView(relationship, category)) {
    return (
      <EmptyState
        title="Access not granted"
        body={`The athlete has not granted ${noun} access. Their records stay private until they grant it.`}
      />
    );
  }
  return <>{children}</>;
}

/* ═══ Nutrition Architecture ════════════════════════════════════════════ */

function ArchitectureSection({
  athleteId,
  relationship,
}: {
  athleteId: string;
  relationship: CoachingRelationship | null;
}) {
  const db = useCoachingStore((s) => s.db);
  const actorId = useCoachingStore((s) => s.actorId);
  const run = useCoachingStore((s) => s.run);
  const [building, setBuilding] = useState(false);
  const maySuggest = canSuggest(relationship, "nutritionArchitecture");

  const architectures = db.nutritionArchitectures
    .filter((a) => a.athleteId === athleteId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <CommandButton
          disabled={!maySuggest}
          disabledReason="The athlete has not granted nutrition-architecture access at the suggest level"
          onClick={() => setBuilding(true)}
        >
          <span className="flex items-center gap-1.5"><Plus size={11} /> New architecture</span>
        </CommandButton>
      </div>
      {building && <ArchitectureBuilder athleteId={athleteId} onClose={() => setBuilding(false)} />}
      {architectures.length === 0 && !building ? (
        <EmptyState
          title="No architecture yet"
          body="Define the complete nutrition structure — targets, day types, rules, and the athlete's real-world context — then send it for their review."
        />
      ) : (
        architectures.map((arch) => (
          <ArchitectureCard
            key={arch.id}
            arch={arch}
            canAct={maySuggest}
            onSend={() => void run((r) => r.ops.nutritionOps.sendArchitecture(arch.id, actorId))}
          />
        ))
      )}
    </div>
  );
}

function TargetsGrid({ label, targets }: { label: string; targets: DayTargets }) {
  return (
    <div className="border-t border-white/[0.06] p-3">
      <MicroLabel tone="champagne">{label}</MicroLabel>
      <div className="mt-2 grid grid-cols-3 gap-x-3 gap-y-1.5 sm:grid-cols-5">
        <Metric label="kcal" value={targets.kcal} />
        <Metric label="Protein" value={`${targets.protein}g`} />
        <Metric label="Carbs" value={`${targets.carbs}g`} />
        <Metric label="Fat" value={`${targets.fat}g`} />
        {targets.fiber !== undefined && <Metric label="Fiber" value={`${targets.fiber}g`} />}
        {targets.waterLiters !== undefined && <Metric label="Water" value={`${targets.waterLiters}L`} />}
        <Metric label="Meals" value={targets.mealCount} />
        {targets.feedingWindow && <Metric label="Window" value={targets.feedingWindow} small />}
      </div>
      {targets.sodiumNote && <p className="mt-2 text-[9px] leading-4 text-white/35">{targets.sodiumNote}</p>}
    </div>
  );
}

function Metric({ label, value, small = false }: { label: string; value: React.ReactNode; small?: boolean }) {
  return (
    <div>
      <div className="font-mono text-[8px] uppercase tracking-[0.14em] text-white/30">{label}</div>
      <div className={`font-black tabular-nums text-[#f2eee6] ${small ? "text-[10px]" : "text-sm"}`}>{value}</div>
    </div>
  );
}

function ArchitectureCard({
  arch,
  canAct,
  onSend,
}: {
  arch: NutritionArchitecture;
  canAct: boolean;
  onSend: () => void;
}) {
  const editable = arch.status === "draft" || arch.status === "revision_requested";
  return (
    <Panel glow={arch.status === "active"}>
      <PanelHeader
        label={`Version ${arch.version} · ${relativeTime(arch.updatedAt)}`}
        title={arch.name}
        right={
          <StatusChip tone={OP_STATUS_TONE[arch.status]} pulse={arch.status === "sent"}>
            {opStatusLabel(arch.status)}
          </StatusChip>
        }
      />
      <div className="flex flex-col gap-3 p-4">
        <div className="grid gap-2.5 lg:grid-cols-2">
          <TargetsGrid label="Training day" targets={arch.trainingDay} />
          <TargetsGrid label="Rest day" targets={arch.restDay} />
          {arch.highOutputDay && <TargetsGrid label="High-output day" targets={arch.highOutputDay} />}
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {arch.flexibleMealRules && <Rule label="Flexible meal rules" body={arch.flexibleMealRules} />}
          {arch.restaurantRules && <Rule label="Restaurant rules" body={arch.restaurantRules} />}
          {arch.travelDayNote && <Rule label="Travel structure" body={arch.travelDayNote} />}
          {arch.refeedNote && <Rule label="Refeed structure" body={arch.refeedNote} />}
          {arch.emergencyFallback && <Rule label="Emergency fallback" body={arch.emergencyFallback} />}
        </div>
        <div className="border-t border-white/[0.06] p-3">
          <MicroLabel>Athlete context</MicroLabel>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <StatusChip tone="neutral">Cooking: {arch.preferences.cookingSkill}</StatusChip>
            <StatusChip tone="neutral">Grocery: {arch.preferences.groceryFrequency.replace(/_/g, " ")}</StatusChip>
            {arch.preferences.weeklyBudget && <StatusChip tone="champagne">Budget {arch.preferences.weeklyBudget}</StatusChip>}
            {arch.preferences.allergies.length > 0 && (
              <StatusChip tone="red">Allergies: {arch.preferences.allergies.join(", ")}</StatusChip>
            )}
            {arch.preferences.dislikedFoods.length > 0 && (
              <StatusChip tone="amber">Avoids: {arch.preferences.dislikedFoods.join(", ")}</StatusChip>
            )}
            {arch.preferences.digestiveLimitations && (
              <StatusChip tone="amber">{arch.preferences.digestiveLimitations}</StatusChip>
            )}
          </div>
          {arch.preferences.prepAvailability && (
            <p className="mt-2 text-[9px] text-white/35">Prep availability: {arch.preferences.prepAvailability}</p>
          )}
          {arch.preferences.hydrationStrategy && (
            <p className="mt-1 text-[9px] text-white/35">Hydration: {arch.preferences.hydrationStrategy}</p>
          )}
        </div>
        {editable && canAct && (
          <div className="flex gap-1.5 border-t border-white/[0.05] pt-3">
            <CommandButton variant="teal" onClick={onSend}>
              <span className="flex items-center gap-1.5"><Send size={11} /> Send for athlete review</span>
            </CommandButton>
          </div>
        )}
      </div>
    </Panel>
  );
}

function Rule({ label, body }: { label: string; body: string }) {
  return (
    <div className="border-t border-white/[0.06] px-3 py-2">
      <MicroLabel>{label}</MicroLabel>
      <p className="mt-0.5 text-[10px] leading-4 text-white/55">{body}</p>
    </div>
  );
}

function ArchitectureBuilder({ athleteId, onClose }: { athleteId: string; onClose: () => void }) {
  const actorId = useCoachingStore((s) => s.actorId);
  const run = useCoachingStore((s) => s.run);
  const [name, setName] = useState("");
  const [training, setTraining] = useState<DayTargets>({ kcal: 2800, protein: 200, carbs: 320, fat: 70, fiber: 35, waterLiters: 3.5, mealCount: 4, feedingWindow: "" });
  const [rest, setRest] = useState<DayTargets>({ kcal: 2500, protein: 200, carbs: 250, fat: 75, fiber: 35, waterLiters: 3, mealCount: 4, feedingWindow: "" });
  const [notes, setNotes] = useState({ travel: "", refeed: "", flexible: "", restaurant: "", emergency: "" });
  const [prefs, setPrefs] = useState({
    liked: "", disliked: "", allergies: "", cultural: "", digestive: "", budget: "",
    cookingSkill: "basic" as NutritionArchitecture["preferences"]["cookingSkill"],
    appliances: "", groceryFrequency: "weekly" as NutritionArchitecture["preferences"]["groceryFrequency"],
    prepAvailability: "", fasting: "", hydration: "",
  });

  const save = async (thenSend: boolean) => {
    const list = (v: string) => v.split(",").map((s) => s.trim()).filter(Boolean);
    const saved = await run(async (r) => {
      const draft = await r.ops.nutritionOps.saveArchitectureDraft({
        coachId: actorId,
        athleteId,
        name: name.trim(),
        trainingDay: training,
        restDay: rest,
        travelDayNote: notes.travel || undefined,
        refeedNote: notes.refeed || undefined,
        flexibleMealRules: notes.flexible || undefined,
        restaurantRules: notes.restaurant || undefined,
        emergencyFallback: notes.emergency || undefined,
        effectiveAt: null,
        preferences: {
          likedFoods: list(prefs.liked),
          dislikedFoods: list(prefs.disliked),
          allergies: list(prefs.allergies),
          culturalPreferences: prefs.cultural || undefined,
          digestiveLimitations: prefs.digestive || undefined,
          weeklyBudget: prefs.budget || undefined,
          cookingSkill: prefs.cookingSkill,
          appliances: list(prefs.appliances),
          groceryFrequency: prefs.groceryFrequency,
          prepAvailability: prefs.prepAvailability || undefined,
          fastingPreference: prefs.fasting || undefined,
          hydrationStrategy: prefs.hydration || undefined,
        },
      });
      if (thenSend) await r.ops.nutritionOps.sendArchitecture(draft.id, actorId);
      return draft;
    });
    if (saved) onClose();
  };

  return (
    <Panel glow className="border-[#d5b15f]/20">
      <PanelHeader label="New draft" title="Nutrition architecture builder" right={<CommandButton variant="ghost" onClick={onClose}>Close</CommandButton>} />
      <div className="flex flex-col gap-4 p-4">
        <Field label="Architecture name">
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Recomp Architecture — Phase II" />
        </Field>
        <div className="grid gap-3 lg:grid-cols-2">
          <TargetsEditor label="Training day targets" value={training} onChange={setTraining} />
          <TargetsEditor label="Rest day targets" value={rest} onChange={setRest} />
        </div>
        <div className="grid gap-2.5 sm:grid-cols-2">
          <Field label="Flexible meal rules"><input className={inputClass} value={notes.flexible} onChange={(e) => setNotes({ ...notes, flexible: e.target.value })} /></Field>
          <Field label="Restaurant rules"><input className={inputClass} value={notes.restaurant} onChange={(e) => setNotes({ ...notes, restaurant: e.target.value })} /></Field>
          <Field label="Travel-day structure"><input className={inputClass} value={notes.travel} onChange={(e) => setNotes({ ...notes, travel: e.target.value })} /></Field>
          <Field label="Refeed structure"><input className={inputClass} value={notes.refeed} onChange={(e) => setNotes({ ...notes, refeed: e.target.value })} /></Field>
          <Field label="Emergency fallback plan"><input className={inputClass} value={notes.emergency} onChange={(e) => setNotes({ ...notes, emergency: e.target.value })} /></Field>
        </div>
        <MicroLabel tone="champagne">Athlete context</MicroLabel>
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Liked foods (comma-separated)"><input className={inputClass} value={prefs.liked} onChange={(e) => setPrefs({ ...prefs, liked: e.target.value })} /></Field>
          <Field label="Disliked foods"><input className={inputClass} value={prefs.disliked} onChange={(e) => setPrefs({ ...prefs, disliked: e.target.value })} /></Field>
          <Field label="Allergies"><input className={inputClass} value={prefs.allergies} onChange={(e) => setPrefs({ ...prefs, allergies: e.target.value })} /></Field>
          <Field label="Cultural preferences"><input className={inputClass} value={prefs.cultural} onChange={(e) => setPrefs({ ...prefs, cultural: e.target.value })} /></Field>
          <Field label="Digestive limitations"><input className={inputClass} value={prefs.digestive} onChange={(e) => setPrefs({ ...prefs, digestive: e.target.value })} /></Field>
          <Field label="Weekly budget"><input className={inputClass} value={prefs.budget} onChange={(e) => setPrefs({ ...prefs, budget: e.target.value })} placeholder="$—" /></Field>
          <Field label="Cooking skill">
            <select className={inputClass} value={prefs.cookingSkill} onChange={(e) => setPrefs({ ...prefs, cookingSkill: e.target.value as typeof prefs.cookingSkill })}>
              <option value="minimal">Minimal</option>
              <option value="basic">Basic</option>
              <option value="confident">Confident</option>
              <option value="advanced">Advanced</option>
            </select>
          </Field>
          <Field label="Available appliances"><input className={inputClass} value={prefs.appliances} onChange={(e) => setPrefs({ ...prefs, appliances: e.target.value })} placeholder="Oven, stovetop, …" /></Field>
          <Field label="Grocery frequency">
            <select className={inputClass} value={prefs.groceryFrequency} onChange={(e) => setPrefs({ ...prefs, groceryFrequency: e.target.value as typeof prefs.groceryFrequency })}>
              <option value="weekly">Weekly</option>
              <option value="twice_weekly">Twice weekly</option>
              <option value="as_needed">As needed</option>
            </select>
          </Field>
          <Field label="Prep availability"><input className={inputClass} value={prefs.prepAvailability} onChange={(e) => setPrefs({ ...prefs, prepAvailability: e.target.value })} /></Field>
          <Field label="Fasting preference"><input className={inputClass} value={prefs.fasting} onChange={(e) => setPrefs({ ...prefs, fasting: e.target.value })} /></Field>
          <Field label="Hydration strategy"><input className={inputClass} value={prefs.hydration} onChange={(e) => setPrefs({ ...prefs, hydration: e.target.value })} /></Field>
        </div>
        <div className="flex flex-wrap gap-1.5 border-t border-white/[0.05] pt-3">
          <CommandButton disabled={!name.trim()} disabledReason="Name the architecture first" onClick={() => void save(false)}>Save draft</CommandButton>
          <CommandButton variant="teal" disabled={!name.trim()} disabledReason="Name the architecture first" onClick={() => void save(true)}>
            <span className="flex items-center gap-1.5"><Send size={11} /> Save &amp; send</span>
          </CommandButton>
        </div>
      </div>
    </Panel>
  );
}

function TargetsEditor({ label, value, onChange }: { label: string; value: DayTargets; onChange: (t: DayTargets) => void }) {
  const num = (v: string) => (v === "" ? 0 : Number(v));
  return (
    <div className="border-t border-white/[0.06] p-3">
      <MicroLabel tone="champagne">{label}</MicroLabel>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Field label="kcal"><input type="number" className={inputClass} value={value.kcal || ""} onChange={(e) => onChange({ ...value, kcal: num(e.target.value) })} /></Field>
        <Field label="Protein g"><input type="number" className={inputClass} value={value.protein || ""} onChange={(e) => onChange({ ...value, protein: num(e.target.value) })} /></Field>
        <Field label="Carbs g"><input type="number" className={inputClass} value={value.carbs || ""} onChange={(e) => onChange({ ...value, carbs: num(e.target.value) })} /></Field>
        <Field label="Fat g"><input type="number" className={inputClass} value={value.fat || ""} onChange={(e) => onChange({ ...value, fat: num(e.target.value) })} /></Field>
        <Field label="Fiber g"><input type="number" className={inputClass} value={value.fiber ?? ""} onChange={(e) => onChange({ ...value, fiber: e.target.value === "" ? undefined : num(e.target.value) })} /></Field>
        <Field label="Water L"><input type="number" step="0.5" className={inputClass} value={value.waterLiters ?? ""} onChange={(e) => onChange({ ...value, waterLiters: e.target.value === "" ? undefined : Number(e.target.value) })} /></Field>
        <Field label="Meals"><input type="number" className={inputClass} value={value.mealCount || ""} onChange={(e) => onChange({ ...value, mealCount: num(e.target.value) })} /></Field>
        <Field label="Feeding window"><input className={inputClass} value={value.feedingWindow ?? ""} onChange={(e) => onChange({ ...value, feedingWindow: e.target.value || undefined })} placeholder="8:00–20:00" /></Field>
      </div>
    </div>
  );
}

/* ═══ Meal plans ════════════════════════════════════════════════════════ */

const SCOPE_LABELS: Record<MealPlanScope, string> = {
  single_day: "Single day",
  training_day: "Training day",
  rest_day: "Rest day",
  seven_day: "Seven-day plan",
  rotating_two_week: "Rotating two-week",
  custom_phase: "Custom phase",
};

const MEAL_TYPE_LABELS: Record<Meal["mealType"], string> = {
  exact: "Exact",
  flexible: "Flexible",
  macro_based: "Macro-based",
  restaurant: "Restaurant",
  travel: "Travel",
  emergency: "Emergency",
};

function MealPlansSection({
  athleteId,
  relationship,
}: {
  athleteId: string;
  relationship: CoachingRelationship | null;
}) {
  const db = useCoachingStore((s) => s.db);
  const actorId = useCoachingStore((s) => s.actorId);
  const run = useCoachingStore((s) => s.run);
  const [building, setBuilding] = useState<MealPlan | "new" | null>(null);
  const maySuggest = canSuggest(relationship, "mealPlans");

  const plans = db.mealPlans
    .filter((p) => p.athleteId === athleteId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const flags = db.mealFlags.filter((f) => f.athleteId === athleteId && !f.resolved);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        {flags.length > 0 ? (
          <StatusChip tone="amber">{flags.length} unresolved athlete flag{flags.length === 1 ? "" : "s"}</StatusChip>
        ) : <span />}
        <CommandButton
          disabled={!maySuggest}
          disabledReason="The athlete has not granted meal-plan access at the suggest level"
          onClick={() => setBuilding("new")}
        >
          <span className="flex items-center gap-1.5"><Plus size={11} /> New meal plan</span>
        </CommandButton>
      </div>
      {building && (
        <MealPlanBuilder
          athleteId={athleteId}
          editing={building === "new" ? undefined : building}
          onClose={() => setBuilding(null)}
        />
      )}
      {plans.length === 0 && !building ? (
        <EmptyState title="No meal plans yet" body="Build the plan from the architecture — exact meals, flexible slots, alternatives, and prep guidance." />
      ) : (
        plans.map((plan) => (
          <MealPlanCard
            key={plan.id}
            plan={plan}
            flags={flags.filter((f) => f.planId === plan.id)}
            canAct={maySuggest}
            onEdit={() => setBuilding(plan)}
            onSend={() => void run((r) => r.ops.nutritionOps.sendMealPlan(plan.id, actorId))}
          />
        ))
      )}
    </div>
  );
}

function MealPlanCard({
  plan,
  flags,
  canAct,
  onEdit,
  onSend,
}: {
  plan: MealPlan;
  flags: Array<{ id: string; mealId: string; kind: string; note?: string }>;
  canAct: boolean;
  onEdit: () => void;
  onSend: () => void;
}) {
  const [open, setOpen] = useState(plan.status === "active" || plan.status === "sent");
  const editable = plan.status === "draft" || plan.status === "revision_requested";
  const totals = plan.meals.reduce(
    (acc, meal) => {
      if (!meal.estMacros) return acc;
      return {
        kcal: acc.kcal + meal.estMacros.kcal,
        protein: acc.protein + meal.estMacros.protein,
        carbs: acc.carbs + meal.estMacros.carbs,
        fat: acc.fat + meal.estMacros.fat,
      };
    },
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );

  return (
    <Panel glow={plan.status === "active"}>
      <PanelHeader
        label={`${SCOPE_LABELS[plan.scope]} · v${plan.version} · ${relativeTime(plan.updatedAt)}`}
        title={plan.name}
        right={
          <div className="flex items-center gap-1.5">
            {flags.length > 0 && <StatusChip tone="amber">{flags.length} flag{flags.length === 1 ? "" : "s"}</StatusChip>}
            <StatusChip tone={OP_STATUS_TONE[plan.status]} pulse={plan.status === "sent"}>{opStatusLabel(plan.status)}</StatusChip>
            <button type="button" onClick={() => setOpen((v) => !v)} className="rounded-md border border-white/[0.08] px-2 py-1 font-mono text-[8px] uppercase tracking-[0.14em] text-white/40 hover:text-white/70">
              {open ? "Collapse" : "Expand"}
            </button>
          </div>
        }
      />
      {open && (
        <div className="flex flex-col gap-3 p-4">
          <div className="flex flex-wrap gap-1.5">
            <StatusChip tone="neutral">≈{totals.kcal} kcal/day</StatusChip>
            <StatusChip tone="neutral">P {totals.protein}g · C {totals.carbs}g · F {totals.fat}g (est.)</StatusChip>
            {plan.days.map((d) => <StatusChip key={d.dayLabel} tone="neutral">{d.dayLabel}</StatusChip>)}
          </div>
          {plan.athleteDecisionNote && (
            <p className="border-l-2 border-[#e8c87a]/30 pl-3 text-[10px] italic text-white/50">Athlete: “{plan.athleteDecisionNote}”</p>
          )}
          <div className="flex flex-col gap-2">
            {plan.meals.map((meal) => (
              <div key={meal.id} className="border-t border-white/[0.06] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <UtensilsCrossed size={11} className="text-white/25" />
                    <span className="text-[11px] font-medium text-[#f2eee6]">{meal.name}</span>
                    <StatusChip tone="neutral">{MEAL_TYPE_LABELS[meal.mealType]}</StatusChip>
                    {meal.batchPrepEligible && <StatusChip tone="teal">Batch-prep</StatusChip>}
                    {flags.some((f) => f.mealId === meal.id) && <StatusChip tone="amber">Flagged</StatusChip>}
                  </div>
                  <span className="font-mono text-[9px] text-white/35">{meal.timeWindow}</span>
                </div>
                <p className="mt-1.5 text-[10px] text-white/45">
                  {meal.ingredients.map((i) => `${i.name} ${i.portion}`).join(" · ")}
                </p>
                {meal.estMacros && (
                  <p className="mt-1 font-mono text-[9px] text-white/30">
                    ≈{meal.estMacros.kcal} kcal · P{meal.estMacros.protein} C{meal.estMacros.carbs} F{meal.estMacros.fat}
                  </p>
                )}
                {meal.alternatives.length > 0 && (
                  <div className="mt-1.5 flex flex-col gap-0.5">
                    {meal.alternatives.map((alt, i) => (
                      <p key={i} className="text-[9px] text-white/35">
                        <span className="uppercase text-[#5fb7d5]/70">{alt.kind}:</span> {alt.description}
                      </p>
                    ))}
                  </div>
                )}
                {(meal.storageGuidance || meal.reheatingGuidance) && (
                  <p className="mt-1 text-[9px] text-white/30">
                    {[meal.storageGuidance, meal.reheatingGuidance].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
            ))}
          </div>
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
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}

/* ─── Meal plan builder ───────────────────────────────────────────────── */

const blankMeal = (): Meal => ({
  id: `m-${Math.random().toString(36).slice(2, 9)}`,
  name: "",
  timeWindow: "",
  mealType: "exact",
  ingredients: [{ name: "", portion: "", groceryCategory: "protein" }],
  alternatives: [],
  batchPrepEligible: false,
});

function MealPlanBuilder({
  athleteId,
  editing,
  onClose,
}: {
  athleteId: string;
  editing?: MealPlan;
  onClose: () => void;
}) {
  const actorId = useCoachingStore((s) => s.actorId);
  const run = useCoachingStore((s) => s.run);
  const db = useCoachingStore((s) => s.db);
  const [name, setName] = useState(editing?.name ?? "");
  const [scope, setScope] = useState<MealPlanScope>(editing?.scope ?? "seven_day");
  const [coachNote, setCoachNote] = useState(editing?.coachNote ?? "");
  const [meals, setMeals] = useState<Meal[]>(editing ? editing.meals.map((m) => ({ ...m, ingredients: m.ingredients.map((i) => ({ ...i })), alternatives: m.alternatives.map((a) => ({ ...a })) })) : [blankMeal()]);
  const [showPreview, setShowPreview] = useState(false);
  const architecture = db.nutritionArchitectures.find((a) => a.athleteId === athleteId && a.status === "active");

  const setMeal = (id: string, patch: Partial<Meal>) =>
    setMeals((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));

  const valid = name.trim() && meals.every((m) => m.name.trim() && m.timeWindow.trim() && m.ingredients.every((i) => i.name.trim() && i.portion.trim()));

  const save = async (thenSend: boolean) => {
    const days = scope === "rotating_two_week"
      ? [{ dayLabel: "Week A", mealIds: meals.map((m) => m.id) }, { dayLabel: "Week B", mealIds: meals.map((m) => m.id) }]
      : scope === "seven_day"
        ? ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((dayLabel) => ({ dayLabel, mealIds: meals.map((m) => m.id) }))
        : [{ dayLabel: SCOPE_LABELS[scope], mealIds: meals.map((m) => m.id) }];
    const saved = await run(async (r) => {
      const draft = await r.ops.nutritionOps.saveMealPlanDraft({
        id: editing?.id,
        coachId: actorId,
        athleteId,
        name: name.trim(),
        scope,
        meals,
        days,
        coachNote: coachNote || undefined,
        architectureId: architecture?.id,
        effectiveAt: null,
      });
      if (thenSend) await r.ops.nutritionOps.sendMealPlan(draft.id, actorId);
      return draft;
    });
    if (saved) onClose();
  };

  return (
    <Panel glow className="border-[#d5b15f]/20">
      <PanelHeader
        label={editing ? "Editing draft" : "New plan"}
        title="Meal plan builder"
        right={<CommandButton variant="ghost" onClick={onClose}>Close</CommandButton>}
      />
      <div className="flex flex-col gap-4 p-4">
        {architecture && (
          <p className="text-[9px] text-white/35">
            Building against <span className="text-[#d5b15f]/80">{architecture.name}</span> — training day ≈{architecture.trainingDay.kcal} kcal · P{architecture.trainingDay.protein}.
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Plan name">
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Scope">
            <select className={inputClass} value={scope} onChange={(e) => setScope(e.target.value as MealPlanScope)}>
              {(Object.keys(SCOPE_LABELS) as MealPlanScope[]).map((s) => (
                <option key={s} value={s}>{SCOPE_LABELS[s]}</option>
              ))}
            </select>
          </Field>
          <Field label="Coach note (athlete-visible)">
            <input className={inputClass} value={coachNote} onChange={(e) => setCoachNote(e.target.value)} />
          </Field>
        </div>

        <div className="flex items-center justify-between">
          <MicroLabel tone="champagne">Meals ({meals.length})</MicroLabel>
          <CommandButton variant="ghost" onClick={() => setMeals((prev) => [...prev, blankMeal()])}>
            <span className="flex items-center gap-1.5"><Plus size={11} /> Add meal</span>
          </CommandButton>
        </div>

        {meals.map((meal, index) => (
          <MealEditor
            key={meal.id}
            meal={meal}
            index={index}
            removable={meals.length > 1}
            onChange={(patch) => setMeal(meal.id, patch)}
            onRemove={() => setMeals((prev) => prev.filter((m) => m.id !== meal.id))}
          />
        ))}

        {showPreview && (
          <div className="mx-auto flex w-full max-w-md flex-col gap-2 border-l border-[#d5b15f]/25 py-1 pl-3">
            <MicroLabel tone="champagne">Athlete preview — {name.trim() || "Untitled plan"}</MicroLabel>
            {meals.filter((m) => m.name.trim()).map((meal) => (
              <div key={meal.id} className="border-t border-white/[0.06] px-3 py-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-[#f2eee6]">{meal.name}</span>
                  <span className="font-mono text-[9px] text-white/35">{meal.timeWindow}</span>
                </div>
                <p className="mt-1 text-[9px] leading-4 text-white/45">
                  {meal.ingredients.filter((i) => i.name.trim()).map((i) => `${i.name} ${i.portion}`).join(" · ")}
                </p>
                {meal.alternatives.filter((a) => a.description.trim()).length > 0 && (
                  <p className="mt-1 text-[8px] text-white/30">
                    Alternatives: {meal.alternatives.filter((a) => a.description.trim()).map((a) => a.description).join(" · ")}
                  </p>
                )}
              </div>
            ))}
            {meals.every((m) => !m.name.trim()) && (
              <p className="py-4 text-center text-[10px] text-white/30">Name at least one meal to see the athlete view.</p>
            )}
            <p className="text-center text-[8px] text-white/25">
              This is what the athlete reviews before accepting, requesting changes, or declining.
            </p>
          </div>
        )}

        <div className="flex flex-wrap gap-1.5 border-t border-white/[0.05] pt-3">
          <CommandButton variant="ghost" onClick={() => setShowPreview((v) => !v)}>
            {showPreview ? "Hide athlete preview" : "Athlete preview"}
          </CommandButton>
          <CommandButton disabled={!valid} disabledReason="Every meal needs a name, time window, and complete ingredients" onClick={() => void save(false)}>Save draft</CommandButton>
          <CommandButton variant="teal" disabled={!valid} disabledReason="Complete the draft before sending" onClick={() => void save(true)}>
            <span className="flex items-center gap-1.5"><Send size={11} /> Save &amp; send</span>
          </CommandButton>
        </div>
      </div>
    </Panel>
  );
}

function MealEditor({
  meal,
  index,
  removable,
  onChange,
  onRemove,
}: {
  meal: Meal;
  index: number;
  removable: boolean;
  onChange: (patch: Partial<Meal>) => void;
  onRemove: () => void;
}) {
  const setIngredient = (i: number, patch: Partial<Meal["ingredients"][number]>) => {
    const ingredients = meal.ingredients.map((ing, idx) => (idx === i ? { ...ing, ...patch } : ing));
    onChange({ ingredients });
  };
  return (
    <div className="border-t border-white/[0.06] p-3">
      <div className="mb-2 flex items-center justify-between">
        <MicroLabel>Meal {index + 1}</MicroLabel>
        {removable && (
          <button type="button" onClick={onRemove} className="font-mono text-[8px] uppercase tracking-[0.14em] text-white/30 hover:text-[#ef7d55]">Remove</button>
        )}
      </div>
      <div className="grid gap-2.5 sm:grid-cols-3">
        <Field label="Meal name"><input className={inputClass} value={meal.name} onChange={(e) => onChange({ name: e.target.value })} /></Field>
        <Field label="Time window"><input className={inputClass} value={meal.timeWindow} onChange={(e) => onChange({ timeWindow: e.target.value })} placeholder="7:30–8:15 AM" /></Field>
        <Field label="Meal type">
          <select className={inputClass} value={meal.mealType} onChange={(e) => onChange({ mealType: e.target.value as Meal["mealType"] })}>
            {(Object.keys(MEAL_TYPE_LABELS) as Array<Meal["mealType"]>).map((t) => (
              <option key={t} value={t}>{MEAL_TYPE_LABELS[t]}</option>
            ))}
          </select>
        </Field>
      </div>
      <MicroLabel className="mt-2.5">Ingredients</MicroLabel>
      <div className="mt-1.5 flex flex-col gap-1.5">
        {meal.ingredients.map((ing, i) => (
          <div key={i} className="grid grid-cols-[2fr_1fr_1.4fr_auto] items-center gap-1.5">
            <input className={inputClass} value={ing.name} onChange={(e) => setIngredient(i, { name: e.target.value })} placeholder="Ingredient" />
            <input className={inputClass} value={ing.portion} onChange={(e) => setIngredient(i, { portion: e.target.value })} placeholder="180 g" />
            <select className={inputClass} value={ing.groceryCategory} onChange={(e) => setIngredient(i, { groceryCategory: e.target.value as GroceryCategory })}>
              {(Object.keys(GROCERY_CATEGORY_LABELS) as GroceryCategory[]).map((c) => (
                <option key={c} value={c}>{GROCERY_CATEGORY_LABELS[c]}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => onChange({ ingredients: meal.ingredients.filter((_, idx) => idx !== i) })}
              disabled={meal.ingredients.length === 1}
              className="rounded-md p-1 text-white/25 hover:text-[#ef7d55] disabled:opacity-30"
              aria-label="Remove ingredient"
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => onChange({ ingredients: [...meal.ingredients, { name: "", portion: "", groceryCategory: "protein" }] })}
          className="w-fit font-mono text-[8px] uppercase tracking-[0.16em] text-[#d5b15f]/60 hover:text-[#d5b15f]"
        >
          + Ingredient
        </button>
      </div>
      <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Est. kcal"><input type="number" className={inputClass} value={meal.estMacros?.kcal ?? ""} onChange={(e) => onChange({ estMacros: { kcal: Number(e.target.value) || 0, protein: meal.estMacros?.protein ?? 0, carbs: meal.estMacros?.carbs ?? 0, fat: meal.estMacros?.fat ?? 0 } })} /></Field>
        <Field label="Protein g"><input type="number" className={inputClass} value={meal.estMacros?.protein ?? ""} onChange={(e) => onChange({ estMacros: { kcal: meal.estMacros?.kcal ?? 0, protein: Number(e.target.value) || 0, carbs: meal.estMacros?.carbs ?? 0, fat: meal.estMacros?.fat ?? 0 } })} /></Field>
        <Field label="Carbs g"><input type="number" className={inputClass} value={meal.estMacros?.carbs ?? ""} onChange={(e) => onChange({ estMacros: { kcal: meal.estMacros?.kcal ?? 0, protein: meal.estMacros?.protein ?? 0, carbs: Number(e.target.value) || 0, fat: meal.estMacros?.fat ?? 0 } })} /></Field>
        <Field label="Fat g"><input type="number" className={inputClass} value={meal.estMacros?.fat ?? ""} onChange={(e) => onChange({ estMacros: { kcal: meal.estMacros?.kcal ?? 0, protein: meal.estMacros?.protein ?? 0, carbs: meal.estMacros?.carbs ?? 0, fat: Number(e.target.value) || 0 } })} /></Field>
        <Field label="Preparation instructions"><input className={inputClass} value={meal.prepInstructions ?? ""} onChange={(e) => onChange({ prepInstructions: e.target.value || undefined })} /></Field>
        <Field label="Storage guidance"><input className={inputClass} value={meal.storageGuidance ?? ""} onChange={(e) => onChange({ storageGuidance: e.target.value || undefined })} /></Field>
        <Field label="Reheating guidance"><input className={inputClass} value={meal.reheatingGuidance ?? ""} onChange={(e) => onChange({ reheatingGuidance: e.target.value || undefined })} /></Field>
        <Field label="Allergy note"><input className={inputClass} value={meal.allergyNote ?? ""} onChange={(e) => onChange({ allergyNote: e.target.value || undefined })} /></Field>
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={meal.batchPrepEligible} onChange={(e) => onChange({ batchPrepEligible: e.target.checked })} className="accent-[#d5b15f]" />
          <span className="text-[10px] text-white/45">Batch-prep eligible</span>
        </label>
        <button
          type="button"
          onClick={() => onChange({ alternatives: [...meal.alternatives, { kind: "substitution", description: "" }] })}
          className="font-mono text-[8px] uppercase tracking-[0.16em] text-[#5fb7d5]/60 hover:text-[#5fb7d5]"
        >
          + Alternative
        </button>
      </div>
      {meal.alternatives.length > 0 && (
        <div className="mt-2 flex flex-col gap-1.5">
          {meal.alternatives.map((alt, i) => (
            <div key={i} className="grid grid-cols-[1fr_3fr_auto] items-center gap-1.5">
              <select
                className={inputClass}
                value={alt.kind}
                onChange={(e) => onChange({ alternatives: meal.alternatives.map((a, idx) => (idx === i ? { ...a, kind: e.target.value as typeof a.kind } : a)) })}
              >
                <option value="substitution">Substitution</option>
                <option value="travel">Travel</option>
                <option value="restaurant">Restaurant</option>
                <option value="budget">Budget</option>
              </select>
              <input
                className={inputClass}
                value={alt.description}
                onChange={(e) => onChange({ alternatives: meal.alternatives.map((a, idx) => (idx === i ? { ...a, description: e.target.value } : a)) })}
                placeholder="Approved alternative"
              />
              <button type="button" onClick={() => onChange({ alternatives: meal.alternatives.filter((_, idx) => idx !== i) })} className="rounded-md p-1 text-white/25 hover:text-[#ef7d55]" aria-label="Remove alternative">×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══ Meal Operations ═══════════════════════════════════════════════════ */

const PREPARED_STATES: Array<{ value: PreparedMealState; label: string }> = [
  { value: "planned", label: "Planned" },
  { value: "prepared", label: "Prepared" },
  { value: "packed", label: "Packed" },
  { value: "consumed", label: "Consumed" },
  { value: "expired", label: "Expired" },
];

const PREPARED_STATE_COLOR: Record<PreparedMealState, string> = {
  planned: "#8a8f98",
  prepared: "#d5b15f",
  packed: "#5fb7d5",
  consumed: "#6ee7b7",
  expired: "#ef7d55",
};

function MealOpsSection({
  athleteId,
  relationship,
}: {
  athleteId: string;
  relationship: CoachingRelationship | null;
}) {
  const db = useCoachingStore((s) => s.db);
  const actorId = useCoachingStore((s) => s.actorId);
  const run = useCoachingStore((s) => s.run);
  const [creating, setCreating] = useState(false);
  const maySuggest = canSuggest(relationship, "mealPreparation");

  const sessions = db.mealPrepSessions
    .filter((s) => s.athleteId === athleteId)
    .sort((a, b) => b.prepDate.localeCompare(a.prepDate));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <CommandButton
          disabled={!maySuggest}
          disabledReason="The athlete has not granted meal-preparation access at the suggest level"
          onClick={() => setCreating(true)}
        >
          <span className="flex items-center gap-1.5"><ChefHat size={11} /> Plan prep session</span>
        </CommandButton>
      </div>
      {creating && <PrepSessionCreator athleteId={athleteId} onClose={() => setCreating(false)} />}
      {sessions.length === 0 && !creating ? (
        <EmptyState title="No preparation sessions" body="Plan a prep day from the active meal plan — batch quantities, container assignments, and an operational cooking sequence." />
      ) : (
        sessions.map((session) => (
          <PrepSessionCard
            key={session.id}
            session={session}
            plan={db.mealPlans.find((p) => p.id === session.planId) ?? null}
            onStatus={(status) => void run((r) => r.ops.mealPrep.setSessionStatus(session.id, actorId, status))}
            onMealState={(pmId, state) => void run((r) => r.ops.mealPrep.setPreparedMealState(session.id, pmId, actorId, state))}
          />
        ))
      )}
    </div>
  );
}

function PrepSessionCard({
  session,
  plan,
  onStatus,
  onMealState,
}: {
  session: MealPrepSession;
  plan: MealPlan | null;
  onStatus: (s: MealPrepSession["status"]) => void;
  onMealState: (preparedMealId: string, state: PreparedMealState) => void;
}) {
  const [showSequence, setShowSequence] = useState(false);
  const today = todayKey();
  const totalServings = Object.values(session.servingsByMeal).reduce((a, b) => a + b, 0);
  const remaining = session.preparedMeals.filter((m) => m.state === "prepared" || m.state === "packed");
  const expiringSoon = session.preparedMeals.filter(
    (m) => m.expiresOn && m.state !== "consumed" && m.state !== "expired" && m.expiresOn <= dateKeyOffset(today, 1),
  );
  const sequence = plan ? buildPrepSequence(plan, session) : [];

  return (
    <Panel glow={session.status === "in_progress"}>
      <PanelHeader
        label={`${session.prepDate} · ${session.cookingWindow}`}
        title={plan ? `Prep — ${plan.name}` : "Preparation session"}
        right={
          <div className="flex items-center gap-1.5">
            {expiringSoon.length > 0 && <StatusChip tone="amber">{expiringSoon.length} expiring</StatusChip>}
            <StatusChip
              tone={session.status === "complete" ? "green" : session.status === "in_progress" ? "teal" : session.status === "disrupted" ? "amber" : "neutral"}
              pulse={session.status === "in_progress"}
            >
              {session.status.replace(/_/g, " ")}
            </StatusChip>
          </div>
        }
      />
      <div className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap gap-1.5">
          <StatusChip tone="neutral">{totalServings} servings planned</StatusChip>
          {remaining.length > 0 && <StatusChip tone="teal">{remaining.reduce((a, m) => a + m.servings, 0)} portions on hand</StatusChip>}
        </div>
        <div className="flex flex-col gap-1.5">
          {session.preparedMeals.map((pm) => (
            <div key={pm.id} className="flex flex-col gap-2 border-t border-white/[0.06] px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <span className="text-[11px] font-medium text-[#f2eee6]">{pm.mealName}</span>
                <MicroLabel>
                  {pm.servings} serving{pm.servings === 1 ? "" : "s"} · {pm.storage}
                  {pm.container ? ` · ${pm.container}` : ""}
                  {pm.expiresOn ? ` · Use by ${pm.expiresOn}` : ""}
                </MicroLabel>
              </div>
              <div className="flex flex-wrap gap-1 sm:justify-end" role="group" aria-label={`${pm.mealName} state`}>
                {PREPARED_STATES.map((s) => {
                  const active = pm.state === s.value;
                  const color = PREPARED_STATE_COLOR[s.value];
                  return (
                    <button
                      key={s.value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => onMealState(pm.id, s.value)}
                      className="rounded-md border px-2 py-1 font-mono text-[9px] uppercase tracking-[0.08em] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#d5b15f]/45"
                      style={{
                        borderColor: active ? `${color}55` : "rgba(255,255,255,0.08)",
                        background: active ? `${color}14` : "transparent",
                        color: active ? color : "rgba(255,255,255,0.4)",
                      }}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {sequence.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setShowSequence((v) => !v)}
              className="font-mono text-[8px] uppercase tracking-[0.16em] text-[#d5b15f]/60 hover:text-[#d5b15f]"
            >
              {showSequence ? "Hide" : "Show"} preparation sequence ({sequence.length} steps)
            </button>
            {showSequence && (
              <ol className="mt-2 flex flex-col gap-1">
                {sequence.map((step) => (
                  <li key={step.order} className="flex gap-2.5 text-[10px] leading-4 text-white/55">
                    <span className="font-mono text-[9px] text-[#d5b15f]/70">{String(step.order).padStart(2, "0")}</span>
                    {step.instruction}
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-1.5 border-t border-white/[0.05] pt-3">
          {session.status === "planned" && <CommandButton variant="teal" onClick={() => onStatus("in_progress")}>Start session</CommandButton>}
          {session.status === "in_progress" && <CommandButton onClick={() => onStatus("complete")}>Mark complete</CommandButton>}
          {session.status !== "complete" && session.status !== "disrupted" && (
            <CommandButton variant="ghost" onClick={() => onStatus("disrupted")}>Mark disrupted</CommandButton>
          )}
          {session.status === "disrupted" && (
            <CommandButton variant="teal" onClick={() => onStatus("planned")}>Rebuild as planned</CommandButton>
          )}
        </div>
      </div>
    </Panel>
  );
}

function PrepSessionCreator({ athleteId, onClose }: { athleteId: string; onClose: () => void }) {
  const db = useCoachingStore((s) => s.db);
  const actorId = useCoachingStore((s) => s.actorId);
  const run = useCoachingStore((s) => s.run);
  const plans = db.mealPlans.filter((p) => p.athleteId === athleteId && (p.status === "active"));
  const [planId, setPlanId] = useState(plans[0]?.id ?? "");
  const [prepDate, setPrepDate] = useState(todayKey());
  const [cookingWindow, setCookingWindow] = useState("14:00–16:30");
  const [servings, setServings] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState("");
  const plan = plans.find((p) => p.id === planId) ?? null;
  const relationship = useCoachingStore((s) =>
    s.db.relationships.find((r) => r.athleteId === athleteId && r.status === "active") ?? null,
  );

  const create = async () => {
    if (!plan || !relationship) return;
    const saved = await run((r) =>
      r.ops.mealPrep.createSession(
        {
          coachId: relationship.coachId,
          athleteId,
          prepDate,
          cookingWindow,
          planId: plan.id,
          servingsByMeal: servings,
          notes: notes || undefined,
        },
        actorId,
      ),
    );
    if (saved) onClose();
  };

  const anyServings = Object.values(servings).some((v) => v > 0);

  return (
    <Panel glow className="border-[#d5b15f]/20">
      <PanelHeader label="New session" title="Plan a preparation session" right={<CommandButton variant="ghost" onClick={onClose}>Close</CommandButton>} />
      <div className="flex flex-col gap-3 p-4">
        {plans.length === 0 ? (
          <EmptyState title="No accepted meal plan" body="Prep sessions build from an accepted meal plan. Send one for athlete review first." />
        ) : (
          <>
            <div className="grid gap-2.5 sm:grid-cols-3">
              <Field label="Source meal plan">
                <select className={inputClass} value={planId} onChange={(e) => { setPlanId(e.target.value); setServings({}); }}>
                  {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </Field>
              <Field label="Prep date"><input type="date" className={inputClass} value={prepDate} onChange={(e) => setPrepDate(e.target.value)} /></Field>
              <Field label="Cooking window"><input className={inputClass} value={cookingWindow} onChange={(e) => setCookingWindow(e.target.value)} placeholder="14:00–16:30" /></Field>
            </div>
            {plan && (
              <div>
                <MicroLabel>Batch servings per meal</MicroLabel>
                <div className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
                  {plan.meals.filter((m) => m.batchPrepEligible).map((meal) => (
                    <div key={meal.id} className="flex items-center justify-between gap-2 border-t border-white/[0.06] px-3 py-2">
                      <span className="text-[10px] text-white/55">{meal.name}</span>
                      <input
                        type="number"
                        min={0}
                        className="w-16 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1 text-right text-xs text-[#f2eee6] outline-none"
                        value={servings[meal.id] ?? ""}
                        onChange={(e) => setServings((prev) => ({ ...prev, [meal.id]: Number(e.target.value) || 0 }))}
                        aria-label={`${meal.name} servings`}
                      />
                    </div>
                  ))}
                </div>
                {plan.meals.every((m) => !m.batchPrepEligible) && (
                  <p className="mt-1.5 text-[10px] text-white/35">No meals in this plan are marked batch-prep eligible.</p>
                )}
              </div>
            )}
            <Field label="Session note (optional)"><input className={inputClass} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
            <div className="flex gap-1.5">
              <CommandButton disabled={!anyServings} disabledReason="Set servings for at least one meal" onClick={() => void create()}>Create session</CommandButton>
            </div>
          </>
        )}
      </div>
    </Panel>
  );
}

/* ═══ Grocery Command ═══════════════════════════════════════════════════ */

const ITEM_STATE_TONE: Record<GroceryItem["state"], "neutral" | "green" | "amber" | "teal"> = {
  needed: "neutral",
  purchased: "green",
  unavailable: "amber",
  replaced: "teal",
};

function GrocerySection({
  athleteId,
  relationship,
}: {
  athleteId: string;
  relationship: CoachingRelationship | null;
}) {
  const db = useCoachingStore((s) => s.db);
  const actorId = useCoachingStore((s) => s.actorId);
  const run = useCoachingStore((s) => s.run);
  const [generating, setGenerating] = useState(false);
  const maySuggest = canSuggest(relationship, "grocery");

  const plans = db.groceryPlans
    .filter((p) => p.athleteId === athleteId)
    .sort((a, b) => b.weekOf.localeCompare(a.weekOf));
  const pantry = db.pantryItems.filter((p) => p.athleteId === athleteId);
  const stores = db.storeProfiles.filter((s) => s.athleteId === athleteId);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="max-w-lg text-[9px] leading-4 text-white/30">
          Generated from the meal plan and consolidated by category. Spend figures are your estimates —
          Reserve does not claim live prices, inventory, or checkout.
        </p>
        <CommandButton
          disabled={!maySuggest}
          disabledReason="The athlete has not granted grocery access at the suggest level"
          onClick={() => setGenerating(true)}
        >
          <span className="flex items-center gap-1.5"><ShoppingCart size={11} /> Generate plan</span>
        </CommandButton>
      </div>
      {generating && <GroceryGenerator athleteId={athleteId} stores={stores} onClose={() => setGenerating(false)} />}
      {plans.length === 0 && !generating ? (
        <EmptyState title="No grocery plans" body="Generate the week's consolidated list from the active meal plan and prep servings." />
      ) : (
        plans.map((plan) => (
          <GroceryPlanCard
            key={plan.id}
            plan={plan}
            storeName={stores.find((s) => s.id === plan.storeProfileId)?.name}
            onItemState={(itemId, state, note) => void run((r) => r.ops.grocery.setItemState(plan.id, itemId, actorId, state, note))}
            onStatus={(status) => void run((r) => r.ops.grocery.setPlanStatus(plan.id, actorId, status))}
            onCarryover={() => void run((r) => r.ops.grocery.carryoverOpenItems(plan.id, actorId, dateKeyOffset(plan.weekOf, 7)))}
            onAddItem={(item) => void run((r) => r.ops.grocery.addItem(plan.id, actorId, item))}
          />
        ))
      )}

      {pantry.length > 0 && (
        <Panel>
          <PanelHeader label="Pantry" title="On hand" />
          <div className="flex flex-wrap gap-1.5 p-4">
            {pantry.map((item) => (
              <StatusChip key={item.id} tone={item.runningLow ? "amber" : "neutral"}>
                {item.name} · {item.quantity}{item.runningLow ? " · low" : ""}
              </StatusChip>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}

function GroceryPlanCard({
  plan,
  storeName,
  onItemState,
  onStatus,
  onCarryover,
  onAddItem,
}: {
  plan: GroceryPlan;
  storeName?: string;
  onItemState: (itemId: string, state: GroceryItem["state"], note?: string) => void;
  onStatus: (status: GroceryPlan["status"]) => void;
  onCarryover: () => void;
  onAddItem: (item: Pick<GroceryItem, "name" | "quantity" | "category" | "required" | "preferredBrand">) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [newItem, setNewItem] = useState({ name: "", quantity: "", category: "protein" as GroceryCategory, required: false });
  const [replacingId, setReplacingId] = useState<string | null>(null);
  const [replacementNote, setReplacementNote] = useState("");
  const categories = useMemo(() => {
    const map = new Map<GroceryCategory, GroceryItem[]>();
    for (const item of plan.items) {
      map.set(item.category, [...(map.get(item.category) ?? []), item]);
    }
    return [...map.entries()];
  }, [plan.items]);
  const openCount = plan.items.filter((i) => i.state === "needed" || i.state === "unavailable").length;

  return (
    <Panel glow={plan.status === "shopping"}>
      <PanelHeader
        label={`Week of ${plan.weekOf}${storeName ? ` · ${storeName}` : ""}`}
        title="Grocery Command"
        right={
          <div className="flex items-center gap-1.5">
            {plan.budgetTarget && <StatusChip tone="champagne">Target {plan.budgetTarget}</StatusChip>}
            {plan.estimatedSpend && <StatusChip tone="neutral">Est. {plan.estimatedSpend}</StatusChip>}
            <StatusChip tone={plan.status === "complete" ? "green" : plan.status === "shopping" ? "teal" : "neutral"} pulse={plan.status === "shopping"}>
              {plan.status}
            </StatusChip>
          </div>
        }
      />
      <div className="flex flex-col gap-3 p-4">
        {categories.map(([category, items]) => (
          <div key={category}>
            <MicroLabel tone="champagne">{GROCERY_CATEGORY_LABELS[category]}</MicroLabel>
            <div className="mt-1.5 flex flex-col gap-1">
              {items.map((item) => (
                <div key={item.id} className="border-t border-white/[0.06] px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className={`text-[11px] ${item.state === "purchased" ? "text-white/35 line-through" : "text-[#f2eee6]"}`}>{item.name}</span>
                      <span className="font-mono text-[9px] text-white/35">{item.quantity}</span>
                      {item.carryover && <StatusChip tone="teal">Carryover</StatusChip>}
                      {item.required && <StatusChip tone="champagne">Coach-required</StatusChip>}
                      {item.addedBy === "athlete" && <StatusChip tone="neutral">Athlete-added</StatusChip>}
                      {item.preferredBrand && <span className="text-[9px] text-white/25">{item.preferredBrand}</span>}
                    </div>
                    <div className="flex items-center gap-1" role="group" aria-label={`${item.name} state`}>
                      {(["needed", "purchased", "unavailable", "replaced"] as const).map((state) => {
                        const active = item.state === state;
                        const tone = ITEM_STATE_TONE[state];
                        const color = tone === "green" ? "#6ee7b7" : tone === "amber" ? "#e8c87a" : tone === "teal" ? "#5fb7d5" : "rgba(255,255,255,0.55)";
                        return (
                          <button
                            key={state}
                            type="button"
                            aria-pressed={active}
                            onClick={() => {
                              if (state === "replaced") {
                                setReplacingId(replacingId === item.id ? null : item.id);
                                setReplacementNote(item.replacementNote ?? "");
                              } else {
                                setReplacingId(null);
                                onItemState(item.id, state);
                              }
                            }}
                            className="rounded-md border px-2 py-1.5 font-mono text-[9px] uppercase tracking-[0.08em] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#d5b15f]/40"
                            style={{
                              borderColor: active ? `${color}55` : "rgba(255,255,255,0.07)",
                              background: active ? `${color}14` : "transparent",
                              color: active ? color : "rgba(255,255,255,0.35)",
                            }}
                          >
                            {state}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  {item.replacementNote && replacingId !== item.id && (
                    <p className="mt-1 text-[9px] italic text-[#5fb7d5]/70">Replacement: {item.replacementNote}</p>
                  )}
                  {replacingId === item.id && (
                    <div className="mt-2 flex items-center gap-1.5">
                      <input
                        className={inputClass}
                        value={replacementNote}
                        onChange={(e) => setReplacementNote(e.target.value)}
                        placeholder="What was used instead?"
                        aria-label={`${item.name} replacement`}
                      />
                      <CommandButton
                        onClick={() => { onItemState(item.id, "replaced", replacementNote.trim() || undefined); setReplacingId(null); }}
                      >
                        Save
                      </CommandButton>
                      <CommandButton variant="ghost" onClick={() => setReplacingId(null)}>Cancel</CommandButton>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        {item_usage_note(plan)}

        {adding ? (
          <div className="grid grid-cols-[2fr_1fr_1.4fr_auto_auto] items-end gap-1.5 border-t border-white/[0.06] p-3">
            <Field label="Item"><input className={inputClass} value={newItem.name} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} /></Field>
            <Field label="Quantity"><input className={inputClass} value={newItem.quantity} onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })} /></Field>
            <Field label="Category">
              <select className={inputClass} value={newItem.category} onChange={(e) => setNewItem({ ...newItem, category: e.target.value as GroceryCategory })}>
                {(Object.keys(GROCERY_CATEGORY_LABELS) as GroceryCategory[]).map((c) => (
                  <option key={c} value={c}>{GROCERY_CATEGORY_LABELS[c]}</option>
                ))}
              </select>
            </Field>
            <CommandButton
              disabled={!newItem.name.trim() || !newItem.quantity.trim()}
              disabledReason="Name and quantity required"
              onClick={() => { onAddItem(newItem); setAdding(false); setNewItem({ name: "", quantity: "", category: "protein", required: false }); }}
            >
              Add
            </CommandButton>
            <CommandButton variant="ghost" onClick={() => setAdding(false)}>Cancel</CommandButton>
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5 border-t border-white/[0.05] pt-3">
            <CommandButton variant="ghost" onClick={() => setAdding(true)}>
              <span className="flex items-center gap-1.5"><Plus size={11} /> Add item</span>
            </CommandButton>
            {plan.status === "open" && <CommandButton variant="teal" onClick={() => onStatus("shopping")}>Start shopping</CommandButton>}
            {plan.status === "shopping" && <CommandButton onClick={() => onStatus("complete")}>Complete</CommandButton>}
            {openCount > 0 && plan.status !== "complete" && (
              <CommandButton variant="ghost" onClick={onCarryover}>
                <span className="flex items-center gap-1.5"><CalendarRange size={11} /> Carry {openCount} open into next week</span>
              </CommandButton>
            )}
          </div>
        )}
      </div>
    </Panel>
  );
}

function item_usage_note(plan: GroceryPlan) {
  const used = plan.items.filter((i) => i.usedIn.length > 0);
  if (used.length === 0) return null;
  return (
    <p className="text-[8px] leading-4 text-white/25">
      Items trace back to their meals — e.g. {used[0].name} → {used[0].usedIn.join(", ")}.
    </p>
  );
}

function GroceryGenerator({
  athleteId,
  stores,
  onClose,
}: {
  athleteId: string;
  stores: Array<{ id: string; name: string }>;
  onClose: () => void;
}) {
  const db = useCoachingStore((s) => s.db);
  const actorId = useCoachingStore((s) => s.actorId);
  const run = useCoachingStore((s) => s.run);
  const plans = db.mealPlans.filter((p) => p.athleteId === athleteId && (p.status === "active"));
  const relationship = db.relationships.find((r) => r.athleteId === athleteId && r.status === "active") ?? null;
  const [planId, setPlanId] = useState(plans[0]?.id ?? "");
  const [weekOf, setWeekOf] = useState(todayKey());
  const [storeId, setStoreId] = useState(stores[0]?.id ?? "");
  const [budget, setBudget] = useState("");
  const [servings, setServings] = useState<Record<string, number>>({});
  const plan = plans.find((p) => p.id === planId) ?? null;

  const generate = async () => {
    if (!plan || !relationship) return;
    const saved = await run((r) =>
      r.ops.grocery.generatePlan(
        {
          coachId: relationship.coachId,
          athleteId,
          weekOf,
          sourcePlanId: plan.id,
          servingsByMeal: servings,
          storeProfileId: storeId || null,
          budgetTarget: budget || undefined,
        },
        actorId,
      ),
    );
    if (saved) onClose();
  };

  return (
    <Panel glow className="border-[#d5b15f]/20">
      <PanelHeader label="Generate" title="Weekly grocery plan" right={<CommandButton variant="ghost" onClick={onClose}>Close</CommandButton>} />
      <div className="flex flex-col gap-3 p-4">
        {plans.length === 0 ? (
          <EmptyState title="No accepted meal plan" body="Grocery plans consolidate from an accepted meal plan." />
        ) : (
          <>
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Source meal plan">
                <select className={inputClass} value={planId} onChange={(e) => { setPlanId(e.target.value); setServings({}); }}>
                  {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </Field>
              <Field label="Week of"><input type="date" className={inputClass} value={weekOf} onChange={(e) => setWeekOf(e.target.value)} /></Field>
              <Field label="Store">
                <select className={inputClass} value={storeId} onChange={(e) => setStoreId(e.target.value)}>
                  <option value="">No store preference</option>
                  {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </Field>
              <Field label="Budget target"><input className={inputClass} value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="$—" /></Field>
            </div>
            {plan && (
              <div>
                <MicroLabel>Servings to shop for, per meal</MicroLabel>
                <div className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
                  {plan.meals.map((meal) => (
                    <div key={meal.id} className="flex items-center justify-between gap-2 border-t border-white/[0.06] px-3 py-2">
                      <span className="text-[10px] text-white/55">{meal.name}</span>
                      <input
                        type="number"
                        min={0}
                        className="w-16 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1 text-right text-xs text-[#f2eee6] outline-none"
                        value={servings[meal.id] ?? ""}
                        onChange={(e) => setServings((prev) => ({ ...prev, [meal.id]: Number(e.target.value) || 0 }))}
                        aria-label={`${meal.name} servings`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-1.5">
              <CommandButton
                disabled={!Object.values(servings).some((v) => v > 0)}
                disabledReason="Set servings for at least one meal"
                onClick={() => void generate()}
              >
                Generate consolidated list
              </CommandButton>
            </div>
          </>
        )}
      </div>
    </Panel>
  );
}
