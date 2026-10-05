/* ════════════════════════════════════════════════════════════════════════
   REPOSITORY CONTRACTS — the seam where Supabase lands later.

   Local implementations live in ./local.ts. Future implementations
   (SupabaseCoachingRepository, SupabaseMessagingRepository,
   SupabaseMediaRepository) satisfy these same interfaces; the UI and the
   coaching store depend only on the contracts.
   ════════════════════════════════════════════════════════════════════════ */

import type {
  ActiveDayPlan,
  ChatMessage,
  ClientSummary,
  CoachNote,
  CoachPrescription,
  CoachReview,
  CoachTemplate,
  CoachTemplateAssignment,
  CoachingInvitation,
  CoachingPermissions,
  CoachingRelationship,
  Conversation,
  DayPlanVersion,
  LiveDayOverride,
  LiveDayReason,
  LiveDayTimelineEvent,
  PhysiquePhotoRecord,
  PrescriptionCategory,
  PrescriptionPayload,
  WeeklyCheckIn,
  WeightEntry,
} from "../types";

/* ─── Coaching (relationships, invitations, permissions) ──────────────── */

export type CreateInvitationInput = {
  coachId: string;
  athleteName: string;
  athleteEmail: string;
  athletePhone?: string;
  requestedPermissions: CoachingPermissions;
  welcomeNote?: string;
};

export type AthleteConnectInput = {
  athleteId: string;
  /** Invitation code, coach code, coach email, or coach handle. */
  reference: string;
};

export type AcceptInvitationInput = {
  invitationId: string;
  athleteId: string;
  /** The permissions the athlete actually grants (may differ from requested). */
  grantedPermissions: CoachingPermissions;
};

export interface CoachingRepository {
  listRelationships(memberId: string): Promise<CoachingRelationship[]>;
  getRelationship(id: string): Promise<CoachingRelationship | null>;
  createInvitation(input: CreateInvitationInput): Promise<CoachingInvitation>;
  /** Athlete-initiated pending request — both sides must still approve. */
  requestConnection(input: AthleteConnectInput): Promise<CoachingInvitation>;
  /** Coach approves an athlete-initiated request and returns it to the athlete for final consent. */
  approveConnectionRequest(
    invitationId: string,
    coachId: string,
    requestedPermissions: CoachingPermissions,
  ): Promise<CoachingInvitation>;
  acceptInvitation(input: AcceptInvitationInput): Promise<CoachingRelationship>;
  declineInvitation(id: string, actorId: string): Promise<void>;
  revokeInvitation(id: string, coachId: string): Promise<void>;
  resendInvitation(id: string, coachId: string): Promise<CoachingInvitation>;
  updatePermissions(
    relationshipId: string,
    permissions: CoachingPermissions,
    actorId: string,
  ): Promise<CoachingRelationship>;
  revokeRelationship(relationshipId: string, actorId: string): Promise<void>;
  setRelationshipStatus(
    relationshipId: string,
    status: "active" | "paused" | "archived",
    actorId: string,
  ): Promise<CoachingRelationship>;
  listClients(coachId: string): Promise<ClientSummary[]>;
}

/* ─── Prescriptions ───────────────────────────────────────────────────── */

export type CreatePrescriptionInput = {
  coachId: string;
  athleteId: string;
  category: PrescriptionCategory;
  title: string;
  reason: string;
  summaryOfChanges: string[];
  payload: PrescriptionPayload;
  effectiveDate: string | null;
  /** When revising, links the new draft to its predecessor. */
  previousVersionId?: string;
  /** Optional check-in context used to link a resulting draft to its review. */
  linkedCheckInId?: string;
};

export interface PrescriptionRepository {
  listForAthlete(athleteId: string): Promise<CoachPrescription[]>;
  listForCoach(coachId: string): Promise<CoachPrescription[]>;
  createDraft(input: CreatePrescriptionInput): Promise<CoachPrescription>;
  updateDraft(
    id: string,
    coachId: string,
    changes: Partial<Pick<CoachPrescription, "title" | "reason" | "summaryOfChanges" | "payload" | "effectiveDate">>,
  ): Promise<CoachPrescription>;
  markReadyForReview(id: string, coachId: string): Promise<CoachPrescription>;
  /** Draft → sent (athlete approval) or, with manage permission, straight to active. */
  publish(id: string, coachId: string, mode: "send_for_approval" | "apply_now"): Promise<CoachPrescription>;
  accept(id: string, athleteId: string): Promise<CoachPrescription>;
  reject(id: string, athleteId: string, reason?: string): Promise<CoachPrescription>;
  requestRevision(id: string, athleteId: string, note: string): Promise<CoachPrescription>;
  archive(id: string, coachId: string): Promise<CoachPrescription>;
}

/* ─── Live day ────────────────────────────────────────────────────────── */

export type ProposeOverrideInput = {
  athleteId: string;
  date: string;
  source: "athlete" | "coach" | "reserve";
  actorId: string;
  reason: LiveDayReason;
  originalSnapshot: DayPlanVersion;
  proposedSnapshot: DayPlanVersion;
  explanation: string[];
  impactSummary: string[];
  warnings: string[];
  /** "proposed" awaits the other side; "accepted" applies immediately (requires authority). */
  intent: "propose" | "apply";
};

export interface LiveDayRepository {
  getActiveDay(athleteId: string, date: string): Promise<ActiveDayPlan | null>;
  /** Establishes today's plan from the planned day if none exists yet. */
  ensureActiveDay(athleteId: string, date: string, planned: DayPlanVersion): Promise<ActiveDayPlan>;
  listOverrides(athleteId: string, date: string): Promise<LiveDayOverride[]>;
  proposeOverride(input: ProposeOverrideInput): Promise<LiveDayOverride>;
  acceptOverride(overrideId: string, actorId: string): Promise<ActiveDayPlan>;
  rejectOverride(overrideId: string, actorId: string, reason?: string): Promise<LiveDayOverride>;
  /** Conflict resolution: pick one proposal, mark the rest superseded. */
  resolveConflict(
    athleteId: string,
    date: string,
    keepOverrideId: string,
    actorId: string,
  ): Promise<ActiveDayPlan>;
  revertToOriginal(athleteId: string, date: string, actorId: string): Promise<ActiveDayPlan>;
  listTimeline(athleteId: string, date: string): Promise<LiveDayTimelineEvent[]>;
}

/* ─── Messaging ───────────────────────────────────────────────────────── */

export type SendMessageInput = {
  threadId: string;
  senderId: string;
  body: string;
  action?: ChatMessage["action"];
};

export interface MessagingRepository {
  listThreads(userId: string): Promise<Conversation[]>;
  getThread(threadId: string): Promise<Conversation | null>;
  ensureThread(relationshipId: string): Promise<Conversation>;
  listMessages(threadId: string): Promise<ChatMessage[]>;
  sendMessage(input: SendMessageInput): Promise<ChatMessage>;
  markRead(threadId: string, userId: string): Promise<void>;
  unreadCount(userId: string): Promise<number>;
  subscribe(threadId: string, callback: (message: ChatMessage) => void): () => void;
}

/* ─── Tracking (check-ins, reviews, weights, photos, notes) ───────────── */

export type SubmitCheckInInput = Omit<WeeklyCheckIn, "id" | "submittedAt" | "reviewId">;

export interface TrackingRepository {
  listCheckIns(athleteId: string, requesterId: string): Promise<WeeklyCheckIn[]>;
  submitCheckIn(input: SubmitCheckInInput, requesterId: string): Promise<WeeklyCheckIn>;
  listReviews(athleteId: string, requesterId: string): Promise<CoachReview[]>;
  saveReview(review: Omit<CoachReview, "id" | "createdAt">, requesterId: string): Promise<CoachReview>;
  listWeights(athleteId: string, requesterId: string): Promise<WeightEntry[]>;
  addWeight(entry: Omit<WeightEntry, "id">, requesterId: string): Promise<WeightEntry>;
  /** Permission-enforced: throws COACHING_FORBIDDEN without photo access. */
  listPhotos(athleteId: string, requesterId: string): Promise<PhysiquePhotoRecord[]>;
  annotatePhoto(photoId: string, requesterId: string, note: string): Promise<PhysiquePhotoRecord>;
  requestRetake(photoId: string, requesterId: string): Promise<PhysiquePhotoRecord>;
  listNotes(coachId: string, athleteId: string, requesterId: string): Promise<CoachNote[]>;
  addNote(note: Omit<CoachNote, "id" | "createdAt" | "updatedAt">, requesterId: string): Promise<CoachNote>;
}

/* ─── Templates ───────────────────────────────────────────────────────── */

export interface TemplateRepository {
  listTemplates(coachId: string): Promise<CoachTemplate[]>;
  createTemplate(input: Omit<CoachTemplate, "id" | "createdAt" | "updatedAt" | "archived">): Promise<CoachTemplate>;
  duplicateTemplate(id: string, coachId: string): Promise<CoachTemplate>;
  updateTemplate(
    id: string,
    coachId: string,
    changes: Partial<Pick<CoachTemplate, "name" | "description" | "payload">>,
  ): Promise<CoachTemplate>;
  setArchived(id: string, coachId: string, archived: boolean): Promise<CoachTemplate>;
  assignTemplate(id: string, coachId: string, athleteId: string): Promise<CoachTemplateAssignment>;
}

/** Error contract shared by implementations. */
export class CoachingAccessError extends Error {
  readonly code = "COACHING_FORBIDDEN";
  constructor(message: string) {
    super(message);
    this.name = "CoachingAccessError";
  }
}
