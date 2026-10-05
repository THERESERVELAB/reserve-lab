/* ════════════════════════════════════════════════════════════════════════
   PERFORMANCE OPERATIONS — local repository implementations.

   Production-shaped: every mutation persists, survives refresh, and syncs
   across tabs. Permission checks live HERE (mirroring future Supabase
   RLS): unauthorized reads return errors, not empty UI. Clinical access
   additionally requires an active athlete consent record and every touch
   is written to the clinical access log.
   ════════════════════════════════════════════════════════════════════════ */

import { newId, nowIso } from "../ids";
import { canManage, canSuggest, canView } from "../permissions";
import { CoachingAccessError } from "../repositories/contracts";
import type { CoachingDatabase, CoachingStore } from "../storage";
import type { CoachingRelationship, PermissionCategory } from "../types";
import {
  composeDailyDirective,
  consolidateGrocery,
  detectScheduleConstraints,
  draftAdherenceSummary,
  draftScheduleFriction,
  type DirectiveInputs,
} from "./engines";
import type {
  CoachAIDraft,
  ClinicalAccessLogEntry,
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
  VersionedRecordBase,
  PreparedMealState,
} from "./types";
import { CLINICAL_ACKNOWLEDGEMENT } from "./types";
import type {
  ClinicalRecordInput,
  ClinicalRepository,
  DirectiveRepository,
  GroceryRepository,
  LifestyleRepository,
  MealPrepRepository,
  NutritionOpsRepository,
  ProtocolDraftInput,
  ProtocolRepository,
} from "./contracts";

/* ─── Shared helpers ──────────────────────────────────────────────────── */

function activeRel(db: CoachingDatabase, coachId: string, athleteId: string): CoachingRelationship | null {
  return db.relationships.find(
    (r) => r.coachId === coachId && r.athleteId === athleteId && r.status === "active",
  ) ?? null;
}

/** Self-access for the athlete; otherwise an active relationship with the
    required level. Throws — unauthorized data is never returned. */
function requireAccess(
  db: CoachingDatabase,
  requesterId: string,
  athleteId: string,
  category: PermissionCategory,
  level: "view" | "suggest" | "manage",
): CoachingRelationship | null {
  if (requesterId === athleteId) return null;
  const rel = activeRel(db, requesterId, athleteId);
  const ok = level === "view" ? canView(rel, category) : level === "suggest" ? canSuggest(rel, category) : canManage(rel, category);
  if (!ok) {
    throw new CoachingAccessError(
      `Access to ${category} has not been granted at the required level.`,
    );
  }
  return rel;
}

function baseRecord(
  db: CoachingDatabase,
  coachId: string,
  athleteId: string,
  effectiveAt: string | null,
  supersedes?: VersionedRecordBase,
): VersionedRecordBase {
  const rel = activeRel(db, coachId, athleteId);
  if (!rel) throw new CoachingAccessError("No active coaching relationship.");
  const now = nowIso();
  return {
    id: newId("op"),
    relationshipId: rel.id,
    athleteId,
    coachId,
    status: "draft",
    version: supersedes ? supersedes.version + 1 : 1,
    createdAt: now,
    updatedAt: now,
    effectiveAt,
    createdBy: coachId,
    supersedesId: supersedes?.id,
    athleteDecision: "pending",
    auditEvents: [{ at: now, actorId: coachId, event: "draft_created" }],
  };
}

function pushAudit(record: { auditEvents: VersionedRecordBase["auditEvents"]; updatedAt: string }, actorId: string, event: string, detail?: string): void {
  record.updatedAt = nowIso();
  record.auditEvents.push({ at: record.updatedAt, actorId, event, detail });
}

/** Generic versioned lifecycle: send → athlete decision → activate/replace. */
function applyDecision<T extends VersionedRecordBase>(
  collection: T[],
  record: T,
  athleteId: string,
  decision: "accepted" | "revision_requested" | "declined",
  note?: string,
): void {
  if (record.athleteId !== athleteId) throw new CoachingAccessError("Not your record.");
  if (record.status !== "sent") throw new CoachingAccessError("This item is not awaiting your decision.");
  record.athleteDecision = decision;
  record.athleteDecisionNote = note;
  if (decision === "accepted") {
    // Activation preserves history — the previous active version is marked
    // replaced, never deleted or overwritten.
    for (const prior of collection) {
      if (prior.id !== record.id && prior.athleteId === athleteId && prior.status === "active") {
        prior.status = "replaced";
        pushAudit(prior, athleteId, "replaced_by_new_version", record.id);
      }
    }
    record.status = "active";
    pushAudit(record, athleteId, "accepted_and_activated");
  } else if (decision === "revision_requested") {
    record.status = "revision_requested";
    pushAudit(record, athleteId, "revision_requested", note);
  } else {
    record.status = "declined";
    pushAudit(record, athleteId, "declined", note);
  }
}

/* ─── Supplement protocols ────────────────────────────────────────────── */

export class LocalProtocolRepository implements ProtocolRepository {
  constructor(private store: CoachingStore) {}

  async listForAthlete(athleteId: string, requesterId: string): Promise<SupplementProtocol[]> {
    const db = this.store.read();
    requireAccess(db, requesterId, athleteId, "supplements", "view");
    return db.supplementProtocols
      .filter((p) => p.athleteId === athleteId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async createDraft(input: ProtocolDraftInput): Promise<SupplementProtocol> {
    let created: SupplementProtocol | null = null;
    this.store.write((db) => {
      requireAccess(db, input.coachId, input.athleteId, "supplements", "suggest");
      const supersedes = input.supersedesId
        ? db.supplementProtocols.find((p) => p.id === input.supersedesId)
        : undefined;
      const protocol: SupplementProtocol = {
        ...baseRecord(db, input.coachId, input.athleteId, input.effectiveAt, supersedes),
        name: input.name,
        objective: input.objective,
        coachRationale: input.coachRationale,
        reviewDate: input.reviewDate,
        endDate: input.endDate,
        items: input.items,
        trainingDayItemIds: input.trainingDayItemIds,
        restDayItemIds: input.restDayItemIds,
      };
      db.supplementProtocols.unshift(protocol);
      created = protocol;
    });
    return created!;
  }

  async updateDraft(id: string, coachId: string, changes: Partial<ProtocolDraftInput>): Promise<SupplementProtocol> {
    let updated: SupplementProtocol | null = null;
    this.store.write((db) => {
      const protocol = db.supplementProtocols.find((p) => p.id === id && p.coachId === coachId);
      if (!protocol) throw new CoachingAccessError("Protocol not found.");
      if (protocol.status !== "draft" && protocol.status !== "revision_requested") {
        throw new CoachingAccessError("Only drafts can be edited — create a revision instead.");
      }
      Object.assign(protocol, {
        name: changes.name ?? protocol.name,
        objective: changes.objective ?? protocol.objective,
        coachRationale: changes.coachRationale ?? protocol.coachRationale,
        reviewDate: changes.reviewDate ?? protocol.reviewDate,
        endDate: changes.endDate ?? protocol.endDate,
        effectiveAt: changes.effectiveAt ?? protocol.effectiveAt,
        items: changes.items ?? protocol.items,
        trainingDayItemIds: changes.trainingDayItemIds ?? protocol.trainingDayItemIds,
        restDayItemIds: changes.restDayItemIds ?? protocol.restDayItemIds,
      });
      if (protocol.status === "revision_requested") protocol.status = "draft";
      pushAudit(protocol, coachId, "draft_updated");
      updated = protocol;
    });
    return updated!;
  }

  async send(id: string, coachId: string): Promise<SupplementProtocol> {
    let updated: SupplementProtocol | null = null;
    this.store.write((db) => {
      const protocol = db.supplementProtocols.find((p) => p.id === id && p.coachId === coachId);
      if (!protocol) throw new CoachingAccessError("Protocol not found.");
      requireAccess(db, coachId, protocol.athleteId, "supplements", "suggest");
      protocol.status = "sent";
      protocol.athleteDecision = "pending";
      pushAudit(protocol, coachId, "sent_for_athlete_review");
      updated = protocol;
    });
    return updated!;
  }

  async decide(id: string, athleteId: string, decision: "accepted" | "revision_requested" | "declined", note?: string): Promise<SupplementProtocol> {
    let updated: SupplementProtocol | null = null;
    this.store.write((db) => {
      const protocol = db.supplementProtocols.find((p) => p.id === id);
      if (!protocol) throw new CoachingAccessError("Protocol not found.");
      applyDecision(db.supplementProtocols, protocol, athleteId, decision, note);
      updated = protocol;
    });
    return updated!;
  }

  async pause(id: string, coachId: string): Promise<SupplementProtocol> {
    return this.setStatus(id, coachId, "paused", "paused_by_coach");
  }

  async archive(id: string, coachId: string): Promise<SupplementProtocol> {
    return this.setStatus(id, coachId, "archived", "archived");
  }

  private async setStatus(id: string, coachId: string, status: SupplementProtocol["status"], event: string): Promise<SupplementProtocol> {
    let updated: SupplementProtocol | null = null;
    this.store.write((db) => {
      const protocol = db.supplementProtocols.find((p) => p.id === id && p.coachId === coachId);
      if (!protocol) throw new CoachingAccessError("Protocol not found.");
      requireAccess(db, coachId, protocol.athleteId, "supplements", "manage");
      protocol.status = status;
      pushAudit(protocol, coachId, event);
      updated = protocol;
    });
    return updated!;
  }

  async logAdherence(input: Omit<ProtocolAdherenceEntry, "id" | "at">): Promise<ProtocolAdherenceEntry> {
    const entry: ProtocolAdherenceEntry = { ...input, id: newId("adh"), at: nowIso() };
    this.store.write((db) => {
      const protocol = db.supplementProtocols.find((p) => p.id === input.protocolId);
      if (!protocol || protocol.athleteId !== input.athleteId) {
        throw new CoachingAccessError("Adherence can only be logged by the protocol's athlete.");
      }
      // One mark per item per day — re-marking replaces the earlier entry.
      db.protocolAdherence = db.protocolAdherence.filter(
        (e) => !(e.protocolId === input.protocolId && e.itemId === input.itemId && e.date === input.date),
      );
      db.protocolAdherence.push(entry);
    });
    return entry;
  }

  async setItemFlag(protocolId: string, itemId: string, actorId: string, flag: "running_low" | "unavailable" | "restocked"): Promise<SupplementProtocol> {
    let updated: SupplementProtocol | null = null;
    this.store.write((db) => {
      const protocol = db.supplementProtocols.find((p) => p.id === protocolId);
      if (!protocol) throw new CoachingAccessError("Protocol not found.");
      if (actorId !== protocol.athleteId) requireAccess(db, actorId, protocol.athleteId, "supplements", "manage");
      const item = protocol.items.find((i) => i.id === itemId);
      if (!item) throw new CoachingAccessError("Item not found.");
      if (flag === "running_low") item.runningLow = true;
      if (flag === "restocked") { item.runningLow = false; item.purchaseStatus = "owned"; }
      if (flag === "unavailable") item.purchaseStatus = "needs_purchase";
      pushAudit(protocol, actorId, `item_${flag}`, item.productName);
      updated = protocol;
    });
    return updated!;
  }

  async listAdherence(athleteId: string, requesterId: string): Promise<ProtocolAdherenceEntry[]> {
    const db = this.store.read();
    requireAccess(db, requesterId, athleteId, "supplements", "view");
    return db.protocolAdherence.filter((e) => e.athleteId === athleteId);
  }
}

/* ─── Clinical coordination ───────────────────────────────────────────── */

function activeConsent(db: CoachingDatabase, relationshipId: string): ClinicalConsent | null {
  const consent = db.clinicalConsents.find((c) => c.relationshipId === relationshipId && !c.revokedAt) ?? null;
  return consent && consent.scope !== "none" ? consent : null;
}

/** Clinical reads/notes require an ACTIVE athlete consent (scope-checked)
    plus the mirrored permission level. Full coaching access never satisfies
    this on its own, and coaches can never manage clinical records at all. */
function requireClinicalAccess(
  db: CoachingDatabase,
  requesterId: string,
  athleteId: string,
  need: "view" | "note",
): void {
  if (requesterId === athleteId) return; // the athlete always owns their records
  const rel = activeRel(db, requesterId, athleteId);
  if (!rel) throw new CoachingAccessError("No active coaching relationship.");
  const consent = activeConsent(db, rel.id);
  const consentOk =
    consent !== null && (need === "view" || consent.scope === "view_and_note");
  if (!consentOk || !canView(rel, "clinicalRecords")) {
    throw new CoachingAccessError(
      "Clinical coordination requires the athlete's explicit clinical consent. It is never part of full coaching access.",
    );
  }
}

function logClinicalAccess(db: CoachingDatabase, athleteId: string, accessorId: string, action: ClinicalAccessLogEntry["action"], detail?: string): void {
  db.clinicalAccessLog.push({ id: newId("cal"), recordScopeAthleteId: athleteId, accessorId, at: nowIso(), action, detail });
  db.clinicalAccessLog = db.clinicalAccessLog.slice(-500);
}

export class LocalClinicalRepository implements ClinicalRepository {
  constructor(private store: CoachingStore) {}

  async getConsent(relationshipId: string): Promise<ClinicalConsent | null> {
    return this.store.read().clinicalConsents.find((c) => c.relationshipId === relationshipId && !c.revokedAt) ?? null;
  }

  async setConsent(relationshipId: string, athleteId: string, scope: ClinicalConsentScope, acknowledgementAccepted: boolean): Promise<ClinicalConsent> {
    if (!acknowledgementAccepted) {
      throw new CoachingAccessError("The clinical acknowledgement must be reviewed before consent changes.");
    }
    let saved: ClinicalConsent | null = null;
    this.store.write((db) => {
      const rel = db.relationships.find((r) => r.id === relationshipId);
      if (!rel || rel.athleteId !== athleteId) {
        throw new CoachingAccessError("Only the athlete can change clinical consent.");
      }
      const now = nowIso();
      const existing = db.clinicalConsents.find((c) => c.relationshipId === relationshipId && !c.revokedAt);
      if (existing) {
        existing.history.push({ at: now, scope, actorId: athleteId });
        if (scope === "none") existing.revokedAt = now;
        existing.scope = scope;
        saved = existing;
      } else {
        const consent: ClinicalConsent = {
          id: newId("cc"),
          relationshipId,
          athleteId,
          coachId: rel.coachId,
          scope,
          grantedAt: now,
          revokedAt: scope === "none" ? now : undefined,
          acknowledgement: CLINICAL_ACKNOWLEDGEMENT,
          history: [{ at: now, scope, actorId: athleteId }],
        };
        db.clinicalConsents.push(consent);
        saved = consent;
      }
      // Keep the permission mirror in sync so summaries stay honest.
      rel.permissions.clinicalRecords = scope === "none" ? "none" : "view";
      logClinicalAccess(db, athleteId, athleteId, "consent_changed", scope);
    });
    return saved!;
  }

  async listRecords(athleteId: string, requesterId: string): Promise<ClinicalCoordinationRecord[]> {
    const db = this.store.read();
    requireClinicalAccess(db, requesterId, athleteId, "view");
    if (requesterId !== athleteId) {
      this.store.write((d) => logClinicalAccess(d, athleteId, requesterId, "viewed"));
    }
    return this.store.read().clinicalRecords
      .filter((r) => r.athleteId === athleteId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async createRecord(input: ClinicalRecordInput, actorId: string): Promise<ClinicalCoordinationRecord> {
    if (!input.acknowledgementAccepted) {
      throw new CoachingAccessError("The clinical acknowledgement must be accepted before saving.");
    }
    let created: ClinicalCoordinationRecord | null = null;
    this.store.write((db) => {
      // Only the athlete documents their own clinical records; a coach never
      // creates or edits them regardless of consent scope (view/note only).
      if (actorId !== input.athleteId) {
        throw new CoachingAccessError("Clinical records are athlete-owned documentation. Coaches may view or add observations only.");
      }
      const now = nowIso();
      const { acknowledgementAccepted, ...rest } = input;
      void acknowledgementAccepted;
      const record: ClinicalCoordinationRecord = {
        ...rest,
        id: newId("clin"),
        createdAt: now,
        updatedAt: now,
        createdBy: actorId,
        acknowledgement: CLINICAL_ACKNOWLEDGEMENT,
        auditEvents: [{ at: now, actorId, event: "record_created" }],
      };
      db.clinicalRecords.unshift(record);
      logClinicalAccess(db, input.athleteId, actorId, "created", record.category);
      created = record;
    });
    return created!;
  }

  async updateRecord(id: string, actorId: string, changes: Partial<ClinicalRecordInput>): Promise<ClinicalCoordinationRecord> {
    let updated: ClinicalCoordinationRecord | null = null;
    this.store.write((db) => {
      const record = db.clinicalRecords.find((r) => r.id === id);
      if (!record) throw new CoachingAccessError("Record not found.");
      if (actorId !== record.athleteId) {
        throw new CoachingAccessError("Clinical records are athlete-owned. Coaches cannot modify them.");
      }
      const { acknowledgementAccepted, ...rest } = changes;
      void acknowledgementAccepted;
      Object.assign(record, rest);
      pushAudit(record, actorId, "record_updated");
      logClinicalAccess(db, record.athleteId, actorId, "updated");
      updated = record;
    });
    return updated!;
  }

  async addObservation(input: Omit<ClinicalObservation, "id" | "at">, actorId: string): Promise<ClinicalObservation> {
    let created: ClinicalObservation | null = null;
    this.store.write((db) => {
      const record = db.clinicalRecords.find((r) => r.id === input.recordId);
      if (!record) throw new CoachingAccessError("Record not found.");
      if (actorId !== record.athleteId) {
        requireClinicalAccess(db, actorId, record.athleteId, "note");
      }
      const observation: ClinicalObservation = { ...input, id: newId("obs"), at: nowIso() };
      db.clinicalObservations.push(observation);
      logClinicalAccess(db, record.athleteId, actorId, "observation_added", input.kind);
      created = observation;
    });
    return created!;
  }

  async listObservations(recordId: string, requesterId: string): Promise<ClinicalObservation[]> {
    const db = this.store.read();
    const record = db.clinicalRecords.find((r) => r.id === recordId);
    if (!record) return [];
    requireClinicalAccess(db, requesterId, record.athleteId, "view");
    return db.clinicalObservations
      .filter((o) => o.recordId === recordId)
      .sort((a, b) => b.at.localeCompare(a.at));
  }

  async listAccessLog(athleteId: string, requesterId: string): Promise<ClinicalAccessLogEntry[]> {
    const db = this.store.read();
    if (requesterId !== athleteId) requireClinicalAccess(db, requesterId, athleteId, "view");
    return db.clinicalAccessLog
      .filter((e) => e.recordScopeAthleteId === athleteId)
      .sort((a, b) => b.at.localeCompare(a.at));
  }
}

/* ─── Nutrition architecture + meal plans ─────────────────────────────── */

export class LocalNutritionOpsRepository implements NutritionOpsRepository {
  constructor(private store: CoachingStore) {}

  async listArchitectures(athleteId: string, requesterId: string): Promise<NutritionArchitecture[]> {
    const db = this.store.read();
    requireAccess(db, requesterId, athleteId, "nutritionArchitecture", "view");
    return db.nutritionArchitectures
      .filter((a) => a.athleteId === athleteId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async saveArchitectureDraft(
    input: Parameters<NutritionOpsRepository["saveArchitectureDraft"]>[0],
  ): Promise<NutritionArchitecture> {
    let saved: NutritionArchitecture | null = null;
    this.store.write((db) => {
      requireAccess(db, input.coachId, input.athleteId, "nutritionArchitecture", "suggest");
      if (input.id) {
        const existing = db.nutritionArchitectures.find((a) => a.id === input.id && a.coachId === input.coachId);
        if (!existing) throw new CoachingAccessError("Architecture not found.");
        if (existing.status !== "draft" && existing.status !== "revision_requested") {
          throw new CoachingAccessError("Only drafts can be edited.");
        }
        Object.assign(existing, { ...input, id: existing.id });
        if (existing.status === "revision_requested") existing.status = "draft";
        pushAudit(existing, input.coachId, "draft_updated");
        saved = existing;
      } else {
        const supersedes = input.supersedesId
          ? db.nutritionArchitectures.find((a) => a.id === input.supersedesId)
          : undefined;
        const architecture: NutritionArchitecture = {
          ...baseRecord(db, input.coachId, input.athleteId, input.effectiveAt ?? null, supersedes),
          name: input.name,
          trainingDay: input.trainingDay,
          restDay: input.restDay,
          highOutputDay: input.highOutputDay,
          travelDayNote: input.travelDayNote,
          refeedNote: input.refeedNote,
          flexibleMealRules: input.flexibleMealRules,
          restaurantRules: input.restaurantRules,
          emergencyFallback: input.emergencyFallback,
          preferences: input.preferences,
        };
        db.nutritionArchitectures.unshift(architecture);
        saved = architecture;
      }
    });
    return saved!;
  }

  async sendArchitecture(id: string, coachId: string): Promise<NutritionArchitecture> {
    let updated: NutritionArchitecture | null = null;
    this.store.write((db) => {
      const architecture = db.nutritionArchitectures.find((a) => a.id === id && a.coachId === coachId);
      if (!architecture) throw new CoachingAccessError("Architecture not found.");
      architecture.status = "sent";
      architecture.athleteDecision = "pending";
      pushAudit(architecture, coachId, "sent_for_athlete_review");
      updated = architecture;
    });
    return updated!;
  }

  async decideArchitecture(id: string, athleteId: string, decision: "accepted" | "revision_requested" | "declined", note?: string): Promise<NutritionArchitecture> {
    let updated: NutritionArchitecture | null = null;
    this.store.write((db) => {
      const architecture = db.nutritionArchitectures.find((a) => a.id === id);
      if (!architecture) throw new CoachingAccessError("Architecture not found.");
      applyDecision(db.nutritionArchitectures, architecture, athleteId, decision, note);
      updated = architecture;
    });
    return updated!;
  }

  async listMealPlans(athleteId: string, requesterId: string): Promise<MealPlan[]> {
    const db = this.store.read();
    requireAccess(db, requesterId, athleteId, "mealPlans", "view");
    return db.mealPlans
      .filter((p) => p.athleteId === athleteId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async saveMealPlanDraft(input: Parameters<NutritionOpsRepository["saveMealPlanDraft"]>[0]): Promise<MealPlan> {
    let saved: MealPlan | null = null;
    this.store.write((db) => {
      requireAccess(db, input.coachId, input.athleteId, "mealPlans", "suggest");
      if (input.id) {
        const existing = db.mealPlans.find((p) => p.id === input.id && p.coachId === input.coachId);
        if (!existing) throw new CoachingAccessError("Meal plan not found.");
        if (existing.status !== "draft" && existing.status !== "revision_requested") {
          throw new CoachingAccessError("Only drafts can be edited.");
        }
        Object.assign(existing, { ...input, id: existing.id });
        if (existing.status === "revision_requested") existing.status = "draft";
        pushAudit(existing, input.coachId, "draft_updated");
        saved = existing;
      } else {
        const supersedes = input.supersedesId ? db.mealPlans.find((p) => p.id === input.supersedesId) : undefined;
        const plan: MealPlan = {
          ...baseRecord(db, input.coachId, input.athleteId, input.effectiveAt ?? null, supersedes),
          name: input.name,
          scope: input.scope,
          architectureId: input.architectureId,
          meals: input.meals,
          days: input.days,
          coachNote: input.coachNote,
        };
        db.mealPlans.unshift(plan);
        saved = plan;
      }
    });
    return saved!;
  }

  async sendMealPlan(id: string, coachId: string): Promise<MealPlan> {
    let updated: MealPlan | null = null;
    this.store.write((db) => {
      const plan = db.mealPlans.find((p) => p.id === id && p.coachId === coachId);
      if (!plan) throw new CoachingAccessError("Meal plan not found.");
      plan.status = "sent";
      plan.athleteDecision = "pending";
      pushAudit(plan, coachId, "sent_for_athlete_review");
      updated = plan;
    });
    return updated!;
  }

  async decideMealPlan(id: string, athleteId: string, decision: "accepted" | "revision_requested" | "declined", note?: string): Promise<MealPlan> {
    let updated: MealPlan | null = null;
    this.store.write((db) => {
      const plan = db.mealPlans.find((p) => p.id === id);
      if (!plan) throw new CoachingAccessError("Meal plan not found.");
      applyDecision(db.mealPlans, plan, athleteId, decision, note);
      updated = plan;
    });
    return updated!;
  }

  async logMealCompletion(planId: string, athleteId: string, mealId: string, date: string, mark: MealCompletionMark, note?: string): Promise<void> {
    this.store.write((db) => {
      const plan = db.mealPlans.find((p) => p.id === planId);
      if (!plan || plan.athleteId !== athleteId) throw new CoachingAccessError("Only the athlete logs meal completion.");
      db.mealCompletions = db.mealCompletions.filter(
        (e) => !(e.planId === planId && e.mealId === mealId && e.date === date),
      );
      db.mealCompletions.push({ id: newId("mc"), planId, athleteId, mealId, date, mark, note, at: nowIso() });
    });
  }

  async flagMeal(planId: string, athleteId: string, mealId: string, kind: "substitution_requested" | "disliked" | "unavailable", note?: string): Promise<void> {
    this.store.write((db) => {
      const plan = db.mealPlans.find((p) => p.id === planId);
      if (!plan || plan.athleteId !== athleteId) throw new CoachingAccessError("Only the athlete flags meals.");
      db.mealFlags.push({ id: newId("mf"), planId, athleteId, mealId, kind, note, at: nowIso(), resolved: false });
    });
  }
}

/* ─── Meal operations ─────────────────────────────────────────────────── */

export class LocalMealPrepRepository implements MealPrepRepository {
  constructor(private store: CoachingStore) {}

  async listSessions(athleteId: string, requesterId: string): Promise<MealPrepSession[]> {
    const db = this.store.read();
    requireAccess(db, requesterId, athleteId, "mealPreparation", "view");
    return db.mealPrepSessions
      .filter((s) => s.athleteId === athleteId)
      .sort((a, b) => b.prepDate.localeCompare(a.prepDate));
  }

  async createSession(
    input: Parameters<MealPrepRepository["createSession"]>[0],
    actorId: string,
  ): Promise<MealPrepSession> {
    let created: MealPrepSession | null = null;
    this.store.write((db) => {
      if (actorId !== input.athleteId) requireAccess(db, actorId, input.athleteId, "mealPreparation", "suggest");
      const rel = activeRel(db, input.coachId, input.athleteId);
      if (!rel) throw new CoachingAccessError("No active coaching relationship.");
      const plan = db.mealPlans.find((p) => p.id === input.planId);
      if (!plan) throw new CoachingAccessError("Source meal plan not found.");
      const now = nowIso();
      const session: MealPrepSession = {
        id: newId("prep"),
        relationshipId: rel.id,
        athleteId: input.athleteId,
        coachId: input.coachId,
        prepDate: input.prepDate,
        cookingWindow: input.cookingWindow,
        planId: input.planId,
        servingsByMeal: input.servingsByMeal,
        preparedMeals: plan.meals
          .filter((meal) => (input.servingsByMeal[meal.id] ?? 0) > 0)
          .map((meal) => ({
            id: newId("pm"),
            sessionId: "", // set below
            mealId: meal.id,
            mealName: meal.name,
            servings: input.servingsByMeal[meal.id],
            storage: "refrigerator" as const,
            state: "planned" as const,
            expiresOn: null,
          })),
        status: "planned",
        createdAt: now,
        updatedAt: now,
        notes: input.notes,
      };
      session.preparedMeals.forEach((pm) => { pm.sessionId = session.id; });
      db.mealPrepSessions.unshift(session);
      created = session;
    });
    return created!;
  }

  async setSessionStatus(id: string, actorId: string, status: MealPrepSession["status"]): Promise<MealPrepSession> {
    let updated: MealPrepSession | null = null;
    this.store.write((db) => {
      const session = db.mealPrepSessions.find((s) => s.id === id);
      if (!session) throw new CoachingAccessError("Session not found.");
      if (actorId !== session.athleteId) requireAccess(db, actorId, session.athleteId, "mealPreparation", "suggest");
      session.status = status;
      session.updatedAt = nowIso();
      updated = session;
    });
    return updated!;
  }

  async setPreparedMealState(sessionId: string, preparedMealId: string, actorId: string, state: PreparedMealState): Promise<MealPrepSession> {
    let updated: MealPrepSession | null = null;
    this.store.write((db) => {
      const session = db.mealPrepSessions.find((s) => s.id === sessionId);
      if (!session) throw new CoachingAccessError("Session not found.");
      if (actorId !== session.athleteId) requireAccess(db, actorId, session.athleteId, "mealPreparation", "suggest");
      const prepared = session.preparedMeals.find((m) => m.id === preparedMealId);
      if (!prepared) throw new CoachingAccessError("Prepared meal not found.");
      prepared.state = state;
      session.updatedAt = nowIso();
      updated = session;
    });
    return updated!;
  }
}

/* ─── Grocery ─────────────────────────────────────────────────────────── */

export class LocalGroceryRepository implements GroceryRepository {
  constructor(private store: CoachingStore) {}

  async listPlans(athleteId: string, requesterId: string): Promise<GroceryPlan[]> {
    const db = this.store.read();
    requireAccess(db, requesterId, athleteId, "grocery", "view");
    return db.groceryPlans
      .filter((p) => p.athleteId === athleteId)
      .sort((a, b) => b.weekOf.localeCompare(a.weekOf));
  }

  async generatePlan(
    input: Parameters<GroceryRepository["generatePlan"]>[0],
    actorId: string,
  ): Promise<GroceryPlan> {
    let created: GroceryPlan | null = null;
    this.store.write((db) => {
      if (actorId !== input.athleteId) requireAccess(db, actorId, input.athleteId, "grocery", "suggest");
      const rel = activeRel(db, input.coachId, input.athleteId);
      if (!rel) throw new CoachingAccessError("No active coaching relationship.");
      const plan = db.mealPlans.find((p) => p.id === input.sourcePlanId);
      if (!plan) throw new CoachingAccessError("Source meal plan not found.");
      const pantry = db.pantryItems.filter((p) => p.athleteId === input.athleteId);
      const items = consolidateGrocery(plan, input.servingsByMeal, pantry);
      const now = nowIso();
      const grocery: GroceryPlan = {
        id: newId("gp"),
        relationshipId: rel.id,
        athleteId: input.athleteId,
        coachId: input.coachId,
        weekOf: input.weekOf,
        sourcePlanId: input.sourcePlanId,
        storeProfileId: input.storeProfileId ?? null,
        budgetTarget: input.budgetTarget,
        items,
        status: "open",
        createdAt: now,
        updatedAt: now,
      };
      db.groceryPlans.unshift(grocery);
      created = grocery;
    });
    return created!;
  }

  async addItem(planId: string, actorId: string, item: Parameters<GroceryRepository["addItem"]>[2]): Promise<GroceryPlan> {
    return this.mutatePlan(planId, actorId, (plan, isAthlete) => {
      plan.items.push({
        id: newId("gi"),
        name: item.name,
        quantity: item.quantity,
        category: item.category,
        usedIn: [],
        preferredBrand: item.preferredBrand,
        addedBy: isAthlete ? "athlete" : "coach",
        required: item.required,
        state: "needed",
        carryover: false,
      });
    });
  }

  async setItemState(planId: string, itemId: string, actorId: string, state: GroceryItem["state"], replacementNote?: string): Promise<GroceryPlan> {
    return this.mutatePlan(planId, actorId, (plan) => {
      const item = plan.items.find((i) => i.id === itemId);
      if (!item) throw new CoachingAccessError("Item not found.");
      item.state = state;
      if (replacementNote !== undefined) item.replacementNote = replacementNote;
    });
  }

  async setPlanStatus(planId: string, actorId: string, status: GroceryPlan["status"]): Promise<GroceryPlan> {
    return this.mutatePlan(planId, actorId, (plan) => { plan.status = status; });
  }

  async carryoverOpenItems(planId: string, actorId: string, nextWeekOf: string): Promise<GroceryPlan> {
    let next: GroceryPlan | null = null;
    this.store.write((db) => {
      const plan = db.groceryPlans.find((p) => p.id === planId);
      if (!plan) throw new CoachingAccessError("Plan not found.");
      if (actorId !== plan.athleteId) requireAccess(db, actorId, plan.athleteId, "grocery", "suggest");
      const open = plan.items.filter((i) => i.state === "needed" || i.state === "unavailable");
      const now = nowIso();
      const carried: GroceryPlan = {
        ...plan,
        id: newId("gp"),
        weekOf: nextWeekOf,
        items: open.map((i) => ({ ...i, id: newId("gi"), state: "needed", carryover: true })),
        status: "open",
        createdAt: now,
        updatedAt: now,
      };
      plan.status = "complete";
      plan.updatedAt = now;
      db.groceryPlans.unshift(carried);
      next = carried;
    });
    return next!;
  }

  async listPantry(athleteId: string, requesterId: string): Promise<PantryItem[]> {
    const db = this.store.read();
    requireAccess(db, requesterId, athleteId, "grocery", "view");
    return db.pantryItems.filter((p) => p.athleteId === athleteId);
  }

  async upsertPantryItem(athleteId: string, actorId: string, item: Pick<PantryItem, "name" | "quantity" | "runningLow">): Promise<PantryItem> {
    let saved: PantryItem | null = null;
    this.store.write((db) => {
      if (actorId !== athleteId) requireAccess(db, actorId, athleteId, "grocery", "suggest");
      const existing = db.pantryItems.find(
        (p) => p.athleteId === athleteId && p.name.toLowerCase() === item.name.toLowerCase(),
      );
      if (existing) {
        Object.assign(existing, item, { updatedAt: nowIso() });
        saved = existing;
      } else {
        const pantryItem: PantryItem = { id: newId("pan"), athleteId, ...item, updatedAt: nowIso() };
        db.pantryItems.push(pantryItem);
        saved = pantryItem;
      }
    });
    return saved!;
  }

  async listStores(athleteId: string, requesterId: string): Promise<StoreProfile[]> {
    const db = this.store.read();
    requireAccess(db, requesterId, athleteId, "grocery", "view");
    return db.storeProfiles.filter((s) => s.athleteId === athleteId);
  }

  private async mutatePlan(planId: string, actorId: string, fn: (plan: GroceryPlan, isAthlete: boolean) => void): Promise<GroceryPlan> {
    let updated: GroceryPlan | null = null;
    this.store.write((db) => {
      const plan = db.groceryPlans.find((p) => p.id === planId);
      if (!plan) throw new CoachingAccessError("Plan not found.");
      const isAthlete = actorId === plan.athleteId;
      if (!isAthlete) requireAccess(db, actorId, plan.athleteId, "grocery", "suggest");
      fn(plan, isAthlete);
      plan.updatedAt = nowIso();
      updated = plan;
    });
    return updated!;
  }
}

/* ─── Lifestyle ───────────────────────────────────────────────────────── */

export class LocalLifestyleRepository implements LifestyleRepository {
  constructor(private store: CoachingStore) {}

  async listPlans(athleteId: string, requesterId: string): Promise<LifestylePlan[]> {
    const db = this.store.read();
    requireAccess(db, requesterId, athleteId, "lifestyleSchedule", "view");
    return db.lifestylePlans
      .filter((p) => p.athleteId === athleteId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async savePlanDraft(
    input: Parameters<LifestyleRepository["savePlanDraft"]>[0],
    actorId: string,
  ): Promise<LifestylePlan> {
    let saved: LifestylePlan | null = null;
    this.store.write((db) => {
      if (actorId !== input.athleteId) requireAccess(db, actorId, input.athleteId, "lifestyleSchedule", "suggest");
      if (input.id) {
        const existing = db.lifestylePlans.find((p) => p.id === input.id);
        if (!existing) throw new CoachingAccessError("Lifestyle plan not found.");
        if (existing.status !== "draft" && existing.status !== "revision_requested") {
          throw new CoachingAccessError("Only drafts can be edited.");
        }
        Object.assign(existing, { ...input, id: existing.id });
        if (existing.status === "revision_requested") existing.status = "draft";
        pushAudit(existing, actorId, "draft_updated");
        saved = existing;
      } else {
        const supersedes = input.supersedesId ? db.lifestylePlans.find((p) => p.id === input.supersedesId) : undefined;
        const plan: LifestylePlan = {
          ...baseRecord(db, input.coachId, input.athleteId, input.effectiveAt ?? null, supersedes),
          name: input.name,
          weekKind: input.weekKind,
          events: input.events,
          exceptions: [],
        };
        db.lifestylePlans.unshift(plan);
        saved = plan;
      }
    });
    return saved!;
  }

  async sendPlan(id: string, coachId: string): Promise<LifestylePlan> {
    let updated: LifestylePlan | null = null;
    this.store.write((db) => {
      const plan = db.lifestylePlans.find((p) => p.id === id && p.coachId === coachId);
      if (!plan) throw new CoachingAccessError("Lifestyle plan not found.");
      plan.status = "sent";
      plan.athleteDecision = "pending";
      pushAudit(plan, coachId, "sent_for_athlete_review");
      updated = plan;
    });
    return updated!;
  }

  async decidePlan(id: string, athleteId: string, decision: "accepted" | "revision_requested" | "declined", note?: string): Promise<LifestylePlan> {
    let updated: LifestylePlan | null = null;
    this.store.write((db) => {
      const plan = db.lifestylePlans.find((p) => p.id === id);
      if (!plan) throw new CoachingAccessError("Lifestyle plan not found.");
      applyDecision(db.lifestylePlans, plan, athleteId, decision, note);
      updated = plan;
    });
    return updated!;
  }

  async setEventCompletion(planId: string, eventId: string, athleteId: string, completed: boolean): Promise<LifestylePlan> {
    let updated: LifestylePlan | null = null;
    this.store.write((db) => {
      const plan = db.lifestylePlans.find((p) => p.id === planId);
      if (!plan || plan.athleteId !== athleteId) throw new CoachingAccessError("Only the athlete marks completion.");
      const event = plan.events.find((e) => e.id === eventId);
      if (!event) throw new CoachingAccessError("Event not found.");
      event.completed = completed;
      plan.updatedAt = nowIso();
      updated = plan;
    });
    return updated!;
  }

  async constraintsFor(planId: string, requesterId: string): Promise<ScheduleConstraint[]> {
    const db = this.store.read();
    const plan = db.lifestylePlans.find((p) => p.id === planId);
    if (!plan) return [];
    requireAccess(db, requesterId, plan.athleteId, "lifestyleSchedule", "view");
    return detectScheduleConstraints(plan.events);
  }
}

/* ─── Daily Directive + coach drafts ──────────────────────────────────── */

export class LocalDirectiveRepository implements DirectiveRepository {
  constructor(private store: CoachingStore) {}

  async getPreference(relationshipId: string, requesterId: string): Promise<DirectivePreference | null> {
    const db = this.store.read();
    const rel = db.relationships.find((r) => r.id === relationshipId);
    if (!rel) return null;
    if (requesterId !== rel.athleteId) requireAccess(db, requesterId, rel.athleteId, "dailyDirective", "view");
    return db.directivePreferences.find((p) => p.relationshipId === relationshipId) ?? null;
  }

  async savePreference(pref: Omit<DirectivePreference, "updatedAt">, actorId: string): Promise<DirectivePreference> {
    let saved: DirectivePreference | null = null;
    this.store.write((db) => {
      requireAccess(db, actorId, pref.athleteId, "dailyDirective", "manage");
      const existing = db.directivePreferences.find((p) => p.relationshipId === pref.relationshipId);
      const next: DirectivePreference = { ...pref, updatedAt: nowIso() };
      if (existing) Object.assign(existing, next);
      else db.directivePreferences.push(next);
      saved = existing ?? next;
    });
    return saved!;
  }

  async draftToday(relationshipId: string, coachId: string, date: string): Promise<DailyDirective> {
    let created: DailyDirective | null = null;
    this.store.write((db) => {
      const rel = db.relationships.find((r) => r.id === relationshipId && r.coachId === coachId);
      if (!rel) throw new CoachingAccessError("Relationship not found.");
      requireAccess(db, coachId, rel.athleteId, "dailyDirective", "suggest");
      const prefs = db.directivePreferences.find((p) => p.relationshipId === relationshipId);
      if (!prefs || !prefs.enabled) {
        throw new CoachingAccessError("Daily Directive is not enabled for this athlete — set preferences first.");
      }
      const member = db.members.find((m) => m.id === rel.athleteId);
      const profile = db.athleteProfiles.find((p) => p.memberId === rel.athleteId);
      const latestCheckIn = db.checkIns
        .filter((c) => c.athleteId === rel.athleteId)
        .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))[0];
      const day = db.activeDayPlans.find((p) => p.athleteId === rel.athleteId && p.date === date);
      const inputs: DirectiveInputs = {
        athleteFirstName: (member?.name ?? "Athlete").split(" ")[0],
        goal: profile?.goal ?? "the goal",
        phase: profile?.phase ?? "current phase",
        todaySummary: day
          ? [
              day.liveVersion.sessionTitle ? `Training — ${day.liveVersion.sessionTitle}` : "No session today",
              `${day.liveVersion.entries.filter((e) => e.kind === "meal").length} meals planned`,
            ]
          : [],
        recentAdherencePct: latestCheckIn
          ? Math.round((latestCheckIn.trainingAdherencePct + latestCheckIn.nutritionAdherencePct) / 2)
          : null,
        recoveryPosture: latestCheckIn && latestCheckIn.recovery !== null ? (latestCheckIn.recovery <= 2 ? "declining" : "stable") : "unknown",
        missedActions: db.mealCompletions
          .filter((m) => m.athleteId === rel.athleteId && m.mark === "missed")
          .slice(-2)
          .map(() => "a planned meal"),
        recentWins: latestCheckIn && latestCheckIn.trainingAdherencePct >= 90
          ? [`${latestCheckIn.trainingAdherencePct}% training adherence last week`]
          : [],
        friction: [],
        liveDayChanged: day ? day.status !== "original" : false,
        date,
      };
      const composed = composeDailyDirective(inputs, prefs);
      const directive: DailyDirective = {
        id: newId("dir"),
        relationshipId,
        athleteId: rel.athleteId,
        coachId,
        date,
        body: composed.body,
        tone: composed.tone,
        focus: composed.focus,
        basis: composed.basis,
        status: "drafted",
        createdAt: nowIso(),
      };
      // One directive per day — a new draft supersedes an unapproved one.
      db.dailyDirectives = db.dailyDirectives.filter(
        (d) => !(d.relationshipId === relationshipId && d.date === date && d.status === "drafted"),
      );
      db.dailyDirectives.push(directive);
      created = directive;
    });
    return created!;
  }

  async approve(directiveId: string, coachId: string, editedBody?: string): Promise<DailyDirective> {
    let updated: DailyDirective | null = null;
    this.store.write((db) => {
      const directive = db.dailyDirectives.find((d) => d.id === directiveId && d.coachId === coachId);
      if (!directive) throw new CoachingAccessError("Directive not found.");
      if (editedBody !== undefined && editedBody.trim().length > 0) directive.body = editedBody.trim();
      directive.status = "delivered";
      directive.approvedAt = nowIso();
      updated = directive;
    });
    return updated!;
  }

  async acknowledge(directiveId: string, athleteId: string): Promise<DailyDirective> {
    let updated: DailyDirective | null = null;
    this.store.write((db) => {
      const directive = db.dailyDirectives.find((d) => d.id === directiveId);
      if (!directive) throw new CoachingAccessError("Directive not found.");
      // Only the owning athlete acknowledges — never the coach, never another athlete.
      if (directive.athleteId !== athleteId) {
        throw new CoachingAccessError("Only the athlete can acknowledge their own directive.");
      }
      if (directive.status !== "delivered") {
        throw new CoachingAccessError("Only a delivered directive can be acknowledged.");
      }
      // Idempotent — the first acknowledgement stands.
      if (!directive.acknowledgedAt) directive.acknowledgedAt = nowIso();
      updated = directive;
    });
    return updated!;
  }

  async listForAthlete(athleteId: string, requesterId: string): Promise<DailyDirective[]> {
    const db = this.store.read();
    if (requesterId !== athleteId) requireAccess(db, requesterId, athleteId, "dailyDirective", "view");
    return db.dailyDirectives
      .filter((d) => d.athleteId === athleteId && (requesterId !== athleteId || d.status === "delivered"))
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  async listAIDrafts(coachId: string, athleteId?: string): Promise<CoachAIDraft[]> {
    return this.store.read().aiDrafts
      .filter((d) => d.coachId === coachId && (!athleteId || d.athleteId === athleteId))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async createAIDraft(kind: CoachAIDraft["kind"], coachId: string, athleteId: string): Promise<CoachAIDraft> {
    let created: CoachAIDraft | null = null;
    this.store.write((db) => {
      const rel = activeRel(db, coachId, athleteId);
      if (!rel) throw new CoachingAccessError("No active coaching relationship.");
      const member = db.members.find((m) => m.id === athleteId);
      const name = member?.name ?? "Athlete";
      const latest = db.checkIns
        .filter((c) => c.athleteId === athleteId)
        .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))[0];
      let content: Pick<CoachAIDraft, "title" | "body" | "basis">;
      if (kind === "schedule_friction") {
        const plan = db.lifestylePlans.find((p) => p.athleteId === athleteId && p.status === "active");
        content = draftScheduleFriction(name, plan ? detectScheduleConstraints(plan.events) : []);
      } else {
        const marks = db.protocolAdherence.filter((e) => e.athleteId === athleteId);
        const meals = db.mealCompletions.filter((e) => e.athleteId === athleteId);
        content = draftAdherenceSummary(
          name,
          latest?.trainingAdherencePct ?? null,
          latest?.nutritionAdherencePct ?? null,
          {
            taken: marks.filter((m) => m.mark === "taken").length,
            skipped: marks.filter((m) => m.mark === "skipped").length,
            unavailable: marks.filter((m) => m.mark === "unavailable").length,
          },
          {
            completed: meals.filter((m) => m.mark === "completed").length,
            partial: meals.filter((m) => m.mark === "partial").length,
            missed: meals.filter((m) => m.mark === "missed").length,
          },
        );
      }
      const now = nowIso();
      const draft: CoachAIDraft = {
        id: newId("aid"),
        coachId,
        athleteId,
        kind,
        ...content,
        status: "drafted",
        createdAt: now,
        updatedAt: now,
      };
      db.aiDrafts.unshift(draft);
      created = draft;
    });
    return created!;
  }

  async updateAIDraft(id: string, coachId: string, changes: Partial<Pick<CoachAIDraft, "title" | "body" | "status">>): Promise<CoachAIDraft> {
    let updated: CoachAIDraft | null = null;
    this.store.write((db) => {
      const draft = db.aiDrafts.find((d) => d.id === id && d.coachId === coachId);
      if (!draft) throw new CoachingAccessError("Draft not found.");
      Object.assign(draft, changes);
      draft.updatedAt = nowIso();
      updated = draft;
    });
    return updated!;
  }
}

/* ─── Bundle ──────────────────────────────────────────────────────────── */

export type OperationsRepositories = {
  protocols: ProtocolRepository;
  clinical: ClinicalRepository;
  nutritionOps: NutritionOpsRepository;
  mealPrep: MealPrepRepository;
  grocery: GroceryRepository;
  lifestyle: LifestyleRepository;
  directive: DirectiveRepository;
};

export function createOperationsRepositories(store: CoachingStore): OperationsRepositories {
  return {
    protocols: new LocalProtocolRepository(store),
    clinical: new LocalClinicalRepository(store),
    nutritionOps: new LocalNutritionOpsRepository(store),
    mealPrep: new LocalMealPrepRepository(store),
    grocery: new LocalGroceryRepository(store),
    lifestyle: new LocalLifestyleRepository(store),
    directive: new LocalDirectiveRepository(store),
  };
}
