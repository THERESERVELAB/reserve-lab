/* ════════════════════════════════════════════════════════════════════════
   PERFORMANCE OPERATIONS — repository contracts (the future Supabase seam).

   Every read and write is permission-enforced at this layer. Clinical
   coordination additionally requires an active athlete consent record —
   a permission level alone never opens clinical data.
   ════════════════════════════════════════════════════════════════════════ */

import type {
  CoachAIDraft,
  ClinicalConsent,
  ClinicalConsentScope,
  ClinicalCoordinationRecord,
  ClinicalObservation,
  DailyDirective,
  DirectivePreference,
  GroceryItem,
  GroceryPlan,
  LifestylePlan,
  MealCompletionMark,
  MealPlan,
  MealPrepSession,
  NutritionArchitecture,
  PantryItem,
  ProtocolAdherenceEntry,
  ScheduleConstraint,
  StoreProfile,
  SupplementProtocol,
  SupplementProtocolItem,
} from "./types";

/* ─── Supplement protocols ────────────────────────────────────────────── */

export type ProtocolDraftInput = {
  coachId: string;
  athleteId: string;
  name: string;
  objective: string;
  coachRationale: string;
  reviewDate: string | null;
  endDate: string | null;
  effectiveAt: string | null;
  items: SupplementProtocolItem[];
  trainingDayItemIds: string[];
  restDayItemIds: string[];
  /** When revising/replacing, the prior record id — history is preserved. */
  supersedesId?: string;
};

export interface ProtocolRepository {
  listForAthlete(athleteId: string, requesterId: string): Promise<SupplementProtocol[]>;
  createDraft(input: ProtocolDraftInput): Promise<SupplementProtocol>;
  updateDraft(id: string, coachId: string, changes: Partial<ProtocolDraftInput>): Promise<SupplementProtocol>;
  send(id: string, coachId: string): Promise<SupplementProtocol>;
  /** Athlete decisions. Accepting activates and marks any prior active protocol replaced. */
  decide(id: string, athleteId: string, decision: "accepted" | "revision_requested" | "declined", note?: string): Promise<SupplementProtocol>;
  pause(id: string, coachId: string): Promise<SupplementProtocol>;
  archive(id: string, coachId: string): Promise<SupplementProtocol>;
  logAdherence(input: Omit<ProtocolAdherenceEntry, "id" | "at">): Promise<ProtocolAdherenceEntry>;
  setItemFlag(protocolId: string, itemId: string, actorId: string, flag: "running_low" | "unavailable" | "restocked"): Promise<SupplementProtocol>;
  listAdherence(athleteId: string, requesterId: string): Promise<ProtocolAdherenceEntry[]>;
}

/* ─── Clinical coordination (consent-gated documentation) ─────────────── */

export type ClinicalRecordInput = Omit<
  ClinicalCoordinationRecord,
  "id" | "createdAt" | "updatedAt" | "auditEvents" | "acknowledgement"
> & {
  /** The saver must have shown and accepted the acknowledgement. */
  acknowledgementAccepted: boolean;
};

export interface ClinicalRepository {
  getConsent(relationshipId: string): Promise<ClinicalConsent | null>;
  /** Only the athlete grants/changes/revokes clinical consent. */
  setConsent(relationshipId: string, athleteId: string, scope: ClinicalConsentScope, acknowledgementAccepted: boolean): Promise<ClinicalConsent>;
  /** Reads are consent + permission gated AND access-logged. */
  listRecords(athleteId: string, requesterId: string): Promise<ClinicalCoordinationRecord[]>;
  createRecord(input: ClinicalRecordInput, actorId: string): Promise<ClinicalCoordinationRecord>;
  updateRecord(id: string, actorId: string, changes: Partial<ClinicalRecordInput>): Promise<ClinicalCoordinationRecord>;
  addObservation(input: Omit<ClinicalObservation, "id" | "at">, actorId: string): Promise<ClinicalObservation>;
  listObservations(recordId: string, requesterId: string): Promise<ClinicalObservation[]>;
  listAccessLog(athleteId: string, requesterId: string): Promise<import("./types").ClinicalAccessLogEntry[]>;
}

/* ─── Nutrition architecture + meal plans ─────────────────────────────── */

export interface NutritionOpsRepository {
  listArchitectures(athleteId: string, requesterId: string): Promise<NutritionArchitecture[]>;
  saveArchitectureDraft(
    input: Pick<NutritionArchitecture, "coachId" | "athleteId" | "name" | "trainingDay" | "restDay" | "highOutputDay" | "travelDayNote" | "refeedNote" | "flexibleMealRules" | "restaurantRules" | "emergencyFallback" | "preferences" | "effectiveAt"> & { id?: string; supersedesId?: string },
  ): Promise<NutritionArchitecture>;
  sendArchitecture(id: string, coachId: string): Promise<NutritionArchitecture>;
  decideArchitecture(id: string, athleteId: string, decision: "accepted" | "revision_requested" | "declined", note?: string): Promise<NutritionArchitecture>;

  listMealPlans(athleteId: string, requesterId: string): Promise<MealPlan[]>;
  saveMealPlanDraft(
    input: Pick<MealPlan, "coachId" | "athleteId" | "name" | "scope" | "meals" | "days" | "coachNote" | "effectiveAt"> & { id?: string; architectureId?: string; supersedesId?: string },
  ): Promise<MealPlan>;
  sendMealPlan(id: string, coachId: string): Promise<MealPlan>;
  decideMealPlan(id: string, athleteId: string, decision: "accepted" | "revision_requested" | "declined", note?: string): Promise<MealPlan>;
  logMealCompletion(planId: string, athleteId: string, mealId: string, date: string, mark: MealCompletionMark, note?: string): Promise<void>;
  flagMeal(planId: string, athleteId: string, mealId: string, kind: "substitution_requested" | "disliked" | "unavailable", note?: string): Promise<void>;
}

/* ─── Meal operations ─────────────────────────────────────────────────── */

export interface MealPrepRepository {
  listSessions(athleteId: string, requesterId: string): Promise<MealPrepSession[]>;
  createSession(
    input: Pick<MealPrepSession, "coachId" | "athleteId" | "prepDate" | "cookingWindow" | "planId" | "servingsByMeal" | "notes">,
    actorId: string,
  ): Promise<MealPrepSession>;
  setSessionStatus(id: string, actorId: string, status: MealPrepSession["status"]): Promise<MealPrepSession>;
  setPreparedMealState(sessionId: string, preparedMealId: string, actorId: string, state: import("./types").PreparedMealState): Promise<MealPrepSession>;
}

/* ─── Grocery ─────────────────────────────────────────────────────────── */

export interface GroceryRepository {
  listPlans(athleteId: string, requesterId: string): Promise<GroceryPlan[]>;
  generatePlan(
    input: { coachId: string; athleteId: string; weekOf: string; sourcePlanId: string; servingsByMeal: Record<string, number>; storeProfileId?: string | null; budgetTarget?: string },
    actorId: string,
  ): Promise<GroceryPlan>;
  addItem(planId: string, actorId: string, item: Pick<GroceryItem, "name" | "quantity" | "category" | "required" | "preferredBrand">): Promise<GroceryPlan>;
  setItemState(planId: string, itemId: string, actorId: string, state: GroceryItem["state"], replacementNote?: string): Promise<GroceryPlan>;
  setPlanStatus(planId: string, actorId: string, status: GroceryPlan["status"]): Promise<GroceryPlan>;
  carryoverOpenItems(planId: string, actorId: string, nextWeekOf: string): Promise<GroceryPlan>;
  listPantry(athleteId: string, requesterId: string): Promise<PantryItem[]>;
  upsertPantryItem(athleteId: string, actorId: string, item: Pick<PantryItem, "name" | "quantity" | "runningLow">): Promise<PantryItem>;
  listStores(athleteId: string, requesterId: string): Promise<StoreProfile[]>;
}

/* ─── Lifestyle ───────────────────────────────────────────────────────── */

export interface LifestyleRepository {
  listPlans(athleteId: string, requesterId: string): Promise<LifestylePlan[]>;
  savePlanDraft(
    input: Pick<LifestylePlan, "coachId" | "athleteId" | "name" | "weekKind" | "events" | "effectiveAt"> & { id?: string; supersedesId?: string },
    actorId: string,
  ): Promise<LifestylePlan>;
  sendPlan(id: string, coachId: string): Promise<LifestylePlan>;
  decidePlan(id: string, athleteId: string, decision: "accepted" | "revision_requested" | "declined", note?: string): Promise<LifestylePlan>;
  setEventCompletion(planId: string, eventId: string, athleteId: string, completed: boolean): Promise<LifestylePlan>;
  constraintsFor(planId: string, requesterId: string): Promise<ScheduleConstraint[]>;
}

/* ─── Daily Directive + coach drafts ──────────────────────────────────── */

export interface DirectiveRepository {
  getPreference(relationshipId: string, requesterId: string): Promise<DirectivePreference | null>;
  savePreference(pref: Omit<DirectivePreference, "updatedAt">, actorId: string): Promise<DirectivePreference>;
  /** Composes (deterministically) today's directive as a coach draft. */
  draftToday(relationshipId: string, coachId: string, date: string): Promise<DailyDirective>;
  approve(directiveId: string, coachId: string, editedBody?: string): Promise<DailyDirective>;
  /** The athlete confirms they have seen a delivered directive. Only the
      owning athlete may acknowledge, only delivered directives, and repeat
      calls are idempotent (the first acknowledgement stands). */
  acknowledge(directiveId: string, athleteId: string): Promise<DailyDirective>;
  /** The athlete sees only approved/delivered directives. */
  listForAthlete(athleteId: string, requesterId: string): Promise<DailyDirective[]>;
  listAIDrafts(coachId: string, athleteId?: string): Promise<CoachAIDraft[]>;
  createAIDraft(kind: CoachAIDraft["kind"], coachId: string, athleteId: string): Promise<CoachAIDraft>;
  updateAIDraft(id: string, coachId: string, changes: Partial<Pick<CoachAIDraft, "title" | "body" | "status">>): Promise<CoachAIDraft>;
}
