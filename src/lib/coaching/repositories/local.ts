/* ════════════════════════════════════════════════════════════════════════
   LOCAL REPOSITORIES — production-shaped implementations over CoachingStore.

   These are not mocks: every mutation persists, survives refresh, and
   synchronizes across tabs. Permission checks are enforced HERE (not just
   in the UI) so a coach without photo access never receives photo records
   from the repository — mirroring how Supabase RLS will behave later.
   ════════════════════════════════════════════════════════════════════════ */

import { localDayOf, startsOnLaterDay } from "../effective-date";
import { newConnectionCode, newId, nowIso } from "../ids";
import {
  canManage,
  canSuggest,
  canView,
  canViewPhotos,
  canAnnotatePhotos,
  clonePermissions,
  normalizeCoachingPermissions,
  summarizePermissions,
} from "../permissions";
import type { CoachingDatabase, CoachingStore } from "../storage";
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
  LiveDayTimelineEvent,
  PhysiquePhotoRecord,
  TrendDirection,
  WeeklyCheckIn,
  WeightEntry,
} from "../types";
import {
  CoachingAccessError,
  type AcceptInvitationInput,
  type AthleteConnectInput,
  type CoachingRepository,
  type CreateInvitationInput,
  type CreatePrescriptionInput,
  type LiveDayRepository,
  type MessagingRepository,
  type PrescriptionRepository,
  type ProposeOverrideInput,
  type SendMessageInput,
  type SubmitCheckInInput,
  type TemplateRepository,
  type TrackingRepository,
} from "./contracts";

/* ─── Shared helpers ──────────────────────────────────────────────────── */

function activeRelationship(
  db: CoachingDatabase,
  coachId: string,
  athleteId: string,
): CoachingRelationship | null {
  return (
    db.relationships.find(
      (r) => r.coachId === coachId && r.athleteId === athleteId && r.status === "active",
    ) ?? null
  );
}

/** Relationship through which `requesterId` may see `athleteId` data (or self-access). */
function requesterRelationship(
  db: CoachingDatabase,
  requesterId: string,
  athleteId: string,
): { self: boolean; rel: CoachingRelationship | null } {
  if (requesterId === athleteId) return { self: true, rel: null };
  return { self: false, rel: activeRelationship(db, requesterId, athleteId) };
}

function pushActivity(
  db: CoachingDatabase,
  coachId: string,
  athleteId: string | null,
  kind: CoachingDatabase["activity"][number]["kind"],
  summary: string,
): void {
  db.activity.unshift({ id: newId("act"), coachId, athleteId, at: nowIso(), kind, summary });
  db.activity = db.activity.slice(0, 200);
}

function pushLiveEvent(
  db: CoachingDatabase,
  athleteId: string,
  date: string,
  actor: LiveDayTimelineEvent["actor"],
  actorId: string,
  summary: string,
): void {
  db.liveDayEvents.push({ id: newId("lde"), athleteId, date, at: nowIso(), actor, actorId, summary });
}

function pushActionMessage(
  db: CoachingDatabase,
  relationship: CoachingRelationship,
  senderId: string,
  body: string,
  action: NonNullable<ChatMessage["action"]>,
): void {
  const thread = db.conversations.find((c) => c.relationshipId === relationship.id);
  if (!thread) return;
  const sentAt = nowIso();
  db.messages.push({ id: newId("msg"), threadId: thread.id, senderId, sentAt, body, action });
  thread.lastMessageAt = sentAt;
  thread.lastMessagePreview = action.title;
  thread.lastReadAt[senderId] = sentAt;
}

/* ─── Coaching repository ─────────────────────────────────────────────── */

export class LocalCoachingRepository implements CoachingRepository {
  constructor(private store: CoachingStore) {}

  async listRelationships(memberId: string): Promise<CoachingRelationship[]> {
    const db = this.store.read();
    return db.relationships.filter((r) => r.coachId === memberId || r.athleteId === memberId);
  }

  async getRelationship(id: string): Promise<CoachingRelationship | null> {
    return this.store.read().relationships.find((r) => r.id === id) ?? null;
  }

  async createInvitation(input: CreateInvitationInput): Promise<CoachingInvitation> {
    const db = this.store.read();
    const coach = db.members.find((m) => m.id === input.coachId);
    if (!coach || coach.tier !== "premium_coach") {
      throw new CoachingAccessError("Coach Command access is required to invite athletes.");
    }
    if (!input.athleteName.trim() || !/.+@.+\..+/.test(input.athleteEmail.trim())) {
      throw new CoachingAccessError("A client name and valid email are required.");
    }
    const email = input.athleteEmail.trim().toLowerCase();
    const matchedMember = db.members.find((m) => m.email.toLowerCase() === email);
    // No silent duplicates: one open invitation per email, and no invitations
    // to athletes who already have an active relationship with this coach.
    const openDuplicate = db.invitations.some(
      (i) =>
        i.coachId === input.coachId &&
        i.direction === "coach_to_athlete" &&
        (i.status === "sent" || i.status === "viewed") &&
        i.athleteEmail.toLowerCase() === email &&
        new Date(i.expiresAt).getTime() > Date.now(),
    );
    if (openDuplicate) {
      throw new CoachingAccessError(
        "An open invitation for this email already exists — resend or revoke it from the roster instead.",
      );
    }
    if (
      matchedMember &&
      db.relationships.some(
        (r) => r.coachId === input.coachId && r.athleteId === matchedMember.id && r.status === "active",
      )
    ) {
      throw new CoachingAccessError("This athlete is already an active client.");
    }
    const now = nowIso();
    const id = newId("inv");
    const code = newConnectionCode();
    const invitation: CoachingInvitation = {
      id,
      coachId: input.coachId,
      athleteMemberId: db.members.find(
        (m) => m.email.toLowerCase() === input.athleteEmail.toLowerCase(),
      )?.id,
      athleteName: input.athleteName.trim(),
      athleteEmail: input.athleteEmail.trim(),
      athletePhone: input.athletePhone?.trim() || undefined,
      requestedPermissions: clonePermissions(input.requestedPermissions),
      welcomeNote: input.welcomeNote?.trim() || undefined,
      connectionCode: code,
      invitationLink: `https://reserve.app/connect/${code.toLowerCase()}`,
      status: "sent",
      createdAt: now,
      expiresAt: new Date(Date.now() + 14 * 86_400_000).toISOString(),
      direction: "coach_to_athlete",
      initiatedBy: "coach",
    };
    this.store.write((db) => {
      db.invitations.unshift(invitation);
      pushActivity(db, input.coachId, invitation.athleteMemberId ?? null, "invitation_sent",
        `Invitation sent to ${invitation.athleteName}`);
    });
    return invitation;
  }

  async requestConnection(input: AthleteConnectInput): Promise<CoachingInvitation> {
    const db = this.store.read();
    const ref = input.reference.trim().toLowerCase();
    if (!ref) throw new CoachingAccessError("Enter an invitation code, coach code, email, or handle.");

    // 1) Does the reference match an open coach→athlete invitation code?
    const invite = db.invitations.find(
      (i) => i.connectionCode.toLowerCase() === ref && (i.status === "sent" || i.status === "viewed"),
    );
    if (invite) {
      if (new Date(invite.expiresAt).getTime() <= Date.now()) {
        this.store.write((d) => {
          const expired = d.invitations.find((i) => i.id === invite.id);
          if (expired) expired.status = "expired";
        });
        throw new CoachingAccessError("This invitation has expired. Ask the coach to resend it.");
      }
      if (invite.direction !== "coach_to_athlete") {
        throw new CoachingAccessError("This connection request is waiting for coach review.");
      }
      if (invite.athleteMemberId && invite.athleteMemberId !== input.athleteId) {
        throw new CoachingAccessError("This invitation belongs to another Reserve member.");
      }
      this.store.write((d) => {
        const viewed = d.invitations.find((i) => i.id === invite.id);
        if (viewed) {
          viewed.athleteMemberId = input.athleteId;
          viewed.status = "viewed";
        }
      });
      return { ...invite, athleteMemberId: input.athleteId, status: "viewed" };
    }

    // 2) Otherwise resolve a coach and create a pending athlete→coach request.
    const coachProfile = db.coachProfiles.find((c) => c.coachCode.toLowerCase() === ref);
    const coachMember =
      db.members.find((m) => m.id === coachProfile?.memberId) ??
      db.members.find(
        (m) =>
          m.email.toLowerCase() === ref ||
          (m.handle && m.handle.toLowerCase() === ref) ||
          (m.handle && `@${m.handle.toLowerCase()}` === ref),
      );
    if (!coachMember || coachMember.tier !== "premium_coach") {
      throw new CoachingAccessError("No Reserve coach matches that reference.");
    }
    const athlete = db.members.find((m) => m.id === input.athleteId);
    const code = newConnectionCode();
    const request: CoachingInvitation = {
      id: newId("inv"),
      coachId: coachMember.id,
      athleteMemberId: input.athleteId,
      athleteName: athlete?.name ?? "Reserve member",
      athleteEmail: athlete?.email ?? "",
      requestedPermissions: normalizeCoachingPermissions(
        // Athlete-initiated requests start with nothing granted; the coach
        // proposes access after accepting, and the athlete reviews it.
        { messaging: "suggest" },
      ),
      connectionCode: code,
      invitationLink: `https://reserve.app/connect/${code.toLowerCase()}`,
      status: "sent",
      createdAt: nowIso(),
      expiresAt: new Date(Date.now() + 14 * 86_400_000).toISOString(),
      direction: "athlete_to_coach",
      initiatedBy: "athlete",
    };
    this.store.write((d) => d.invitations.unshift(request));
    return request;
  }

  async approveConnectionRequest(
    invitationId: string,
    coachId: string,
    requestedPermissions: CoachingPermissions,
  ): Promise<CoachingInvitation> {
    let updated: CoachingInvitation | null = null;
    this.store.write((db) => {
      const invite = db.invitations.find(
        (i) => i.id === invitationId && i.coachId === coachId,
      );
      if (!invite || invite.direction !== "athlete_to_coach") {
        throw new CoachingAccessError("Athlete connection request not found.");
      }
      if (invite.status !== "sent" && invite.status !== "viewed") {
        throw new CoachingAccessError("This connection request is no longer open.");
      }
      invite.direction = "coach_to_athlete";
      invite.requestedPermissions = clonePermissions(requestedPermissions);
      invite.status = "sent";
      invite.createdAt = nowIso();
      invite.expiresAt = new Date(Date.now() + 14 * 86_400_000).toISOString();
      pushActivity(db, coachId, invite.athleteMemberId ?? null, "invitation_sent",
        `Connection request approved for ${invite.athleteName}; athlete consent pending`);
      updated = invite;
    });
    return updated!;
  }

  async acceptInvitation(input: AcceptInvitationInput): Promise<CoachingRelationship> {
    let created: CoachingRelationship | null = null;
    this.store.write((db) => {
      const invite = db.invitations.find((i) => i.id === input.invitationId);
      if (!invite) throw new CoachingAccessError("Invitation not found.");
      if (invite.status !== "sent" && invite.status !== "viewed") {
        throw new CoachingAccessError("This invitation is no longer open.");
      }
      if (invite.direction !== "coach_to_athlete") {
        throw new CoachingAccessError("The coach must review this request before athlete consent.");
      }
      if (new Date(invite.expiresAt).getTime() <= Date.now()) {
        invite.status = "expired";
        throw new CoachingAccessError("This invitation has expired.");
      }
      if (invite.athleteMemberId && invite.athleteMemberId !== input.athleteId) {
        throw new CoachingAccessError("This invitation belongs to another Reserve member.");
      }
      if (!db.members.some((m) => m.id === input.athleteId)) {
        throw new CoachingAccessError("Athlete account not found.");
      }
      if (activeRelationship(db, invite.coachId, input.athleteId)) {
        throw new CoachingAccessError("This coaching relationship is already active.");
      }
      const now = nowIso();
      invite.status = "accepted";
      invite.respondedAt = now;
      invite.athleteMemberId = input.athleteId;
      const rel: CoachingRelationship = {
        id: newId("rel"),
        coachId: invite.coachId,
        athleteId: input.athleteId,
        status: "active",
        permissions: clonePermissions(input.grantedPermissions),
        overrideAuthority:
          input.grantedPermissions.liveDayOverrides === "manage" ? "coach_can_apply" : "coach_suggests",
        startedAt: now,
        updatedAt: now,
        initiatedBy: invite.initiatedBy ?? (invite.direction === "coach_to_athlete" ? "coach" : "athlete"),
        sourceInvitationId: invite.id,
      };
      db.relationships.push(rel);
      db.permissionAudit.push({
        id: newId("aud"),
        relationshipId: rel.id,
        grantedByMemberId: input.athleteId,
        grantedToMemberId: invite.coachId,
        at: now,
        action: "granted",
        snapshot: clonePermissions(input.grantedPermissions),
      });
      // Every relationship gets an operational thread.
      db.conversations.push({
        id: newId("thr"),
        relationshipId: rel.id,
        coachId: rel.coachId,
        athleteId: rel.athleteId,
        createdAt: now,
        lastMessageAt: null,
        lastMessagePreview: null,
        lastReadAt: { [rel.coachId]: now, [rel.athleteId]: now },
      });
      pushActivity(db, invite.coachId, input.athleteId, "invitation_accepted",
        `${invite.athleteName} accepted the coaching invitation`);
      created = rel;
    });
    if (!created) throw new CoachingAccessError("Invitation could not be accepted.");
    return created;
  }

  async declineInvitation(id: string, actorId: string): Promise<void> {
    this.store.write((db) => {
      const invite = db.invitations.find((i) => i.id === id);
      if (!invite) throw new CoachingAccessError("Invitation not found.");
      const mayDecline =
        (invite.direction === "coach_to_athlete" && invite.athleteMemberId === actorId) ||
        (invite.direction === "athlete_to_coach" && invite.coachId === actorId);
      if (!mayDecline) throw new CoachingAccessError("You cannot decline this invitation.");
      invite.status = "declined";
      invite.respondedAt = nowIso();
      invite.athleteMemberId = invite.athleteMemberId ?? actorId;
    });
  }

  async revokeInvitation(id: string, coachId: string): Promise<void> {
    this.store.write((db) => {
      const invite = db.invitations.find((i) => i.id === id && i.coachId === coachId);
      if (!invite) throw new CoachingAccessError("Invitation not found.");
      if (invite.direction !== "coach_to_athlete") {
        throw new CoachingAccessError("Approve the athlete request before resending it.");
      }
      invite.status = "revoked";
    });
  }

  async resendInvitation(id: string, coachId: string): Promise<CoachingInvitation> {
    let updated: CoachingInvitation | null = null;
    this.store.write((db) => {
      const invite = db.invitations.find((i) => i.id === id && i.coachId === coachId);
      if (!invite) throw new CoachingAccessError("Invitation not found.");
      invite.status = "sent";
      invite.createdAt = nowIso();
      invite.expiresAt = new Date(Date.now() + 14 * 86_400_000).toISOString();
      updated = invite;
    });
    return updated!;
  }

  async updatePermissions(
    relationshipId: string,
    permissions: CoachingPermissions,
    actorId: string,
  ): Promise<CoachingRelationship> {
    let updated: CoachingRelationship | null = null;
    this.store.write((db) => {
      const rel = db.relationships.find((r) => r.id === relationshipId);
      if (!rel) throw new CoachingAccessError("Relationship not found.");
      // Only the athlete controls what access their coach has.
      if (actorId !== rel.athleteId) {
        throw new CoachingAccessError("Only the athlete can change coaching permissions.");
      }
      rel.permissions = clonePermissions(permissions);
      rel.updatedAt = nowIso();
      rel.overrideAuthority = permissions.liveDayOverrides === "manage"
        ? "coach_can_apply"
        : "coach_suggests";
      db.permissionAudit.push({
        id: newId("aud"),
        relationshipId: rel.id,
        grantedByMemberId: rel.athleteId,
        grantedToMemberId: rel.coachId,
        at: rel.updatedAt,
        action: "updated",
        snapshot: clonePermissions(permissions),
      });
      pushActivity(db, rel.coachId, rel.athleteId, "permission_changed", "Coaching permissions updated");
      updated = rel;
    });
    return updated!;
  }

  async revokeRelationship(relationshipId: string, actorId: string): Promise<void> {
    this.store.write((db) => {
      const rel = db.relationships.find((r) => r.id === relationshipId);
      if (!rel) return;
      if (actorId !== rel.athleteId && actorId !== rel.coachId) {
        throw new CoachingAccessError("Not a member of this relationship.");
      }
      rel.status = "revoked";
      rel.revokedAt = nowIso();
      rel.updatedAt = rel.revokedAt;
      db.permissionAudit.push({
        id: newId("aud"),
        relationshipId: rel.id,
        grantedByMemberId: actorId,
        grantedToMemberId: actorId === rel.athleteId ? rel.coachId : rel.athleteId,
        at: rel.revokedAt,
        action: "revoked",
        snapshot: clonePermissions(rel.permissions),
      });
    });
  }

  async setRelationshipStatus(
    relationshipId: string,
    status: "active" | "paused" | "archived",
    actorId: string,
  ): Promise<CoachingRelationship> {
    let updated: CoachingRelationship | null = null;
    this.store.write((db) => {
      const rel = db.relationships.find((r) => r.id === relationshipId);
      if (!rel) throw new CoachingAccessError("Relationship not found.");
      if (actorId !== rel.coachId && actorId !== rel.athleteId) {
        throw new CoachingAccessError("Not a member of this relationship.");
      }
      rel.status = status;
      rel.updatedAt = nowIso();
      rel.pausedAt = status === "paused" ? rel.updatedAt : undefined;
      updated = rel;
    });
    return updated!;
  }

  async listClients(coachId: string): Promise<ClientSummary[]> {
    const db = this.store.read();
    return db.relationships
      .filter((r) => r.coachId === coachId && r.status !== "revoked")
      .map((rel) => buildClientSummary(db, rel, coachId));
  }
}

function weightTrendFor(db: CoachingDatabase, athleteId: string): {
  direction: TrendDirection;
  weeklyDeltaLb: number | null;
} {
  const entries = db.weightEntries
    .filter((w) => w.athleteId === athleteId)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (entries.length < 8) return { direction: "unknown", weeklyDeltaLb: null };
  const last7 = entries.slice(-7);
  const prev7 = entries.slice(-14, -7);
  if (prev7.length === 0) return { direction: "unknown", weeklyDeltaLb: null };
  const avg = (xs: WeightEntry[]) => xs.reduce((s, w) => s + w.weightLb, 0) / xs.length;
  const delta = Number((avg(last7) - avg(prev7)).toFixed(1));
  return {
    direction: Math.abs(delta) < 0.2 ? "flat" : delta > 0 ? "up" : "down",
    weeklyDeltaLb: delta,
  };
}

function buildClientSummary(
  db: CoachingDatabase,
  rel: CoachingRelationship,
  coachId: string,
): ClientSummary {
  const member = db.members.find((m) => m.id === rel.athleteId);
  const profile = db.athleteProfiles.find((p) => p.memberId === rel.athleteId);
  const checkIns = db.checkIns
    .filter((c) => c.athleteId === rel.athleteId)
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  const latest = checkIns[0] ?? null;
  const thread = db.conversations.find((c) => c.relationshipId === rel.id);
  const unread = thread
    ? db.messages.filter(
        (m) =>
          m.threadId === thread.id &&
          m.senderId !== coachId &&
          m.sentAt > (thread.lastReadAt[coachId] ?? ""),
      ).length
    : 0;
  const day = db.activeDayPlans
    .filter((p) => p.athleteId === rel.athleteId)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  const recentSets = new Set(
    db.photos
      .filter((p) => p.athleteId === rel.athleteId)
      .filter((p) => Date.now() - new Date(p.date).getTime() < 7 * 86_400_000)
      .map((p) => p.setId),
  );
  return {
    relationshipId: rel.id,
    athleteId: rel.athleteId,
    name: member?.name ?? "Reserve member",
    goal: profile?.goal ?? "—",
    phase: profile?.phase ?? "—",
    phaseWeek: profile?.phaseWeek ?? 0,
    phaseTotalWeeks: profile?.phaseTotalWeeks ?? 0,
    programName: profile?.currentProgramName ?? null,
    status: rel.status,
    lastCheckInAt: latest?.submittedAt ?? null,
    weightTrend: canView(rel, "weightTrends")
      ? weightTrendFor(db, rel.athleteId)
      : { direction: "unknown", weeklyDeltaLb: null },
    adherencePct: latest
      ? Math.round((latest.trainingAdherencePct + latest.nutritionAdherencePct) / 2)
      : null,
    recoveryPosture: latest && latest.recovery !== null ? (latest.recovery >= 4 ? "stable" : latest.recovery === 3 ? "stable" : "declining") : "unknown",
    unreadMessages: unread,
    newPhotoSets: canViewPhotos(rel) ? recentSets.size : 0,
    permissionSummary: summarizePermissions(rel.permissions),
    liveDayState: !day
      ? "none"
      : day.status === "awaiting_approval"
        ? "awaiting_review"
        : day.status === "conflict"
          ? "conflict"
          : day.status === "original"
            ? "original"
            : "adapted",
  };
}

/* ─── Prescription repository ─────────────────────────────────────────── */

export class LocalPrescriptionRepository implements PrescriptionRepository {
  constructor(private store: CoachingStore) {}

  async listForAthlete(athleteId: string): Promise<CoachPrescription[]> {
    return this.store
      .read()
      .prescriptions.filter((p) => p.athleteId === athleteId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async listForCoach(coachId: string): Promise<CoachPrescription[]> {
    return this.store
      .read()
      .prescriptions.filter((p) => p.coachId === coachId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async createDraft(input: CreatePrescriptionInput): Promise<CoachPrescription> {
    const db = this.store.read();
    const rel = activeRelationship(db, input.coachId, input.athleteId);
    if (!canSuggest(rel, input.category)) {
      throw new CoachingAccessError(
        `Your ${input.category} permission for this athlete does not allow creating plans.`,
      );
    }
    const now = nowIso();
    const previous = input.previousVersionId
      ? db.prescriptions.find((p) => p.id === input.previousVersionId)
      : undefined;
    const prescription: CoachPrescription = {
      id: newId("rx"),
      lineageId: previous?.lineageId ?? newId("rxl"),
      version: previous ? previous.version + 1 : 1,
      coachId: input.coachId,
      athleteId: input.athleteId,
      category: input.category,
      title: input.title,
      summaryOfChanges: input.summaryOfChanges,
      reason: input.reason,
      status: "draft",
      payload: input.payload,
      createdAt: now,
      updatedAt: now,
      effectiveDate: input.effectiveDate,
      previousVersionId: input.previousVersionId,
      audit: [{ at: now, actorId: input.coachId, event: "draft_created" }],
    };
    this.store.write((d) => {
      d.prescriptions.unshift(prescription);
      if (input.linkedCheckInId) {
        const checkIn = d.checkIns.find((c) => c.id === input.linkedCheckInId);
        const review = checkIn?.reviewId
          ? d.reviews.find((r) => r.id === checkIn.reviewId)
          : undefined;
        if (review && !review.linkedPrescriptionIds.includes(prescription.id)) {
          review.linkedPrescriptionIds.push(prescription.id);
        }
      }
    });
    return prescription;
  }

  async updateDraft(
    id: string,
    coachId: string,
    changes: Partial<Pick<CoachPrescription, "title" | "reason" | "summaryOfChanges" | "payload" | "effectiveDate">>,
  ): Promise<CoachPrescription> {
    let updated: CoachPrescription | null = null;
    this.store.write((db) => {
      const rx = db.prescriptions.find((p) => p.id === id && p.coachId === coachId);
      if (!rx) throw new CoachingAccessError("Prescription not found.");
      if (rx.status !== "draft" && rx.status !== "ready_for_review") {
        throw new CoachingAccessError("Only drafts can be edited — create a revision instead.");
      }
      Object.assign(rx, changes);
      rx.updatedAt = nowIso();
      rx.audit.push({ at: rx.updatedAt, actorId: coachId, event: "draft_updated" });
      updated = rx;
    });
    return updated!;
  }

  async markReadyForReview(id: string, coachId: string): Promise<CoachPrescription> {
    let updated: CoachPrescription | null = null;
    this.store.write((db) => {
      const rx = db.prescriptions.find((p) => p.id === id && p.coachId === coachId);
      if (!rx) throw new CoachingAccessError("Prescription not found.");
      if (rx.status !== "draft") {
        throw new CoachingAccessError("Only a draft can be marked ready for review.");
      }
      rx.status = "ready_for_review";
      rx.updatedAt = nowIso();
      rx.audit.push({ at: rx.updatedAt, actorId: coachId, event: "ready_for_review" });
      updated = rx;
    });
    return updated!;
  }

  async publish(
    id: string,
    coachId: string,
    mode: "send_for_approval" | "apply_now",
  ): Promise<CoachPrescription> {
    let updated: CoachPrescription | null = null;
    this.store.write((db) => {
      const rx = db.prescriptions.find((p) => p.id === id && p.coachId === coachId);
      if (!rx) throw new CoachingAccessError("Prescription not found.");
      if (mode === "send_for_approval" && rx.status !== "ready_for_review") {
        throw new CoachingAccessError("Mark the draft ready for review before sending it.");
      }
      if (mode === "apply_now" && rx.status !== "draft" && rx.status !== "ready_for_review") {
        throw new CoachingAccessError("Only a draft can be applied.");
      }
      const rel = activeRelationship(db, rx.coachId, rx.athleteId);
      if (!rel) throw new CoachingAccessError("An active coaching relationship is required.");
      const now = nowIso();
      if (mode === "apply_now") {
        if (!canManage(rel, rx.category)) {
          throw new CoachingAccessError(
            "Direct apply requires full management permission — send for approval instead.",
          );
        }
        activatePrescription(db, rx, now);
        rx.audit.push({ at: now, actorId: coachId, event: "applied_directly" });
        pushActivity(db, rx.coachId, rx.athleteId, "program_published", `${rx.title} applied (direct manage)`);
        pushActionMessage(db, rel, coachId, "A coach-managed plan was applied without overwriting its prior version.", {
          kind: rx.category === "training" ? "training_plan" : rx.category === "nutrition" ? "nutrition_adjustment" : "schedule_adjustment",
          title: `${rx.category.toUpperCase()} PLAN APPLIED`,
          rows: [{ label: "Plan", value: rx.title }, { label: "Version", value: `v${rx.version}` }],
          ctaLabel: "REVIEW PLAN",
          ctaTarget: "prescription",
          linkedPrescriptionId: rx.id,
          status: "actioned",
        });
      } else {
        if (!canSuggest(rel, rx.category)) {
          throw new CoachingAccessError("You do not have permission to send plans to this athlete.");
        }
        rx.status = "sent";
        rx.sentAt = now;
        rx.audit.push({ at: now, actorId: coachId, event: "sent_for_approval" });
        pushActivity(db, rx.coachId, rx.athleteId, "program_published", `${rx.title} sent for athlete approval`);
        pushActionMessage(db, rel, coachId, "Review this plan in My Coach before it becomes active.", {
          kind: rx.category === "training" ? "training_plan" : rx.category === "nutrition" ? "nutrition_adjustment" : "schedule_adjustment",
          title: `${rx.category.toUpperCase()} PLAN FOR APPROVAL`,
          rows: [{ label: "Plan", value: rx.title }, { label: "Version", value: `v${rx.version}` }],
          ctaLabel: "REVIEW PLAN",
          ctaTarget: "prescription",
          linkedPrescriptionId: rx.id,
          status: "pending",
        });
      }
      rx.updatedAt = now;
      updated = rx;
    });
    return updated!;
  }

  async accept(id: string, athleteId: string): Promise<CoachPrescription> {
    let updated: CoachPrescription | null = null;
    this.store.write((db) => {
      const rx = db.prescriptions.find((p) => p.id === id && p.athleteId === athleteId);
      if (!rx) throw new CoachingAccessError("Prescription not found.");
      if (rx.status !== "sent") throw new CoachingAccessError("This plan is not awaiting your approval.");
      const now = nowIso();
      if (startsOnLaterDay(rx.effectiveDate, new Date(now))) {
        rx.status = "accepted";
        rx.updatedAt = now;
      } else {
        activatePrescription(db, rx, now);
      }
      rx.updatedAt = now;
      rx.respondedAt = now;
      rx.audit.push({ at: now, actorId: athleteId, event: "accepted_by_athlete" });
      pushActivity(db, rx.coachId, rx.athleteId, "schedule_accepted", `${rx.title} accepted and activated`);
      updated = rx;
    });
    return updated!;
  }

  async reject(id: string, athleteId: string, reason?: string): Promise<CoachPrescription> {
    let updated: CoachPrescription | null = null;
    this.store.write((db) => {
      const rx = db.prescriptions.find((p) => p.id === id && p.athleteId === athleteId);
      if (!rx) throw new CoachingAccessError("Prescription not found.");
      if (rx.status !== "sent") throw new CoachingAccessError("This plan is not awaiting your response.");
      const now = nowIso();
      rx.status = "rejected";
      rx.respondedAt = now;
      rx.updatedAt = now;
      rx.athleteResponseNote = reason;
      rx.audit.push({ at: now, actorId: athleteId, event: "rejected_by_athlete", detail: reason });
      updated = rx;
    });
    return updated!;
  }

  async requestRevision(id: string, athleteId: string, note: string): Promise<CoachPrescription> {
    let updated: CoachPrescription | null = null;
    this.store.write((db) => {
      const rx = db.prescriptions.find((p) => p.id === id && p.athleteId === athleteId);
      if (!rx) throw new CoachingAccessError("Prescription not found.");
      if (rx.status !== "sent") throw new CoachingAccessError("This plan is not awaiting your response.");
      const now = nowIso();
      rx.status = "revision_requested";
      rx.respondedAt = now;
      rx.updatedAt = now;
      rx.athleteResponseNote = note;
      rx.audit.push({ at: now, actorId: athleteId, event: "revision_requested", detail: note });
      updated = rx;
    });
    return updated!;
  }

  async archive(id: string, coachId: string): Promise<CoachPrescription> {
    let updated: CoachPrescription | null = null;
    this.store.write((db) => {
      const rx = db.prescriptions.find((p) => p.id === id && p.coachId === coachId);
      if (!rx) throw new CoachingAccessError("Prescription not found.");
      rx.status = "archived";
      rx.updatedAt = nowIso();
      rx.audit.push({ at: rx.updatedAt, actorId: coachId, event: "archived" });
      updated = rx;
    });
    return updated!;
  }
}

/** Activation never silently overwrites: the previous active version in the
    same category is marked "replaced" and stays in history. */
function activatePrescription(db: CoachingDatabase, rx: CoachPrescription, at: string): void {
  db.prescriptions
    .filter(
      (p) =>
        p.athleteId === rx.athleteId &&
        p.category === rx.category &&
        p.id !== rx.id &&
        p.status === "active",
    )
    .forEach((p) => {
      p.status = "replaced";
      p.updatedAt = at;
      p.audit.push({ at, actorId: rx.coachId, event: "replaced_by_new_version", detail: rx.id });
    });
  rx.status = "active";
}

/* ─── Live-day repository ─────────────────────────────────────────────── */

export class LocalLiveDayRepository implements LiveDayRepository {
  constructor(private store: CoachingStore) {}

  async getActiveDay(athleteId: string, date: string): Promise<ActiveDayPlan | null> {
    return (
      this.store.read().activeDayPlans.find((p) => p.athleteId === athleteId && p.date === date) ??
      null
    );
  }

  async ensureActiveDay(
    athleteId: string,
    date: string,
    planned: DayPlanVersion,
  ): Promise<ActiveDayPlan> {
    const existing = await this.getActiveDay(athleteId, date);
    if (existing) return existing;
    const plan: ActiveDayPlan = {
      id: newId("day"),
      athleteId,
      date,
      originalVersion: planned,
      liveVersion: planned,
      status: "original",
      lastUpdatedAt: nowIso(),
      lastUpdatedBy: "reserve",
    };
    this.store.write((db) => db.activeDayPlans.push(plan));
    return plan;
  }

  async listOverrides(athleteId: string, date: string): Promise<LiveDayOverride[]> {
    return this.store
      .read()
      .liveDayOverrides.filter((o) => o.athleteId === athleteId && o.date === date)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async proposeOverride(input: ProposeOverrideInput): Promise<LiveDayOverride> {
    let created: LiveDayOverride | null = null;
    this.store.write((db) => {
      const day = db.activeDayPlans.find(
        (p) => p.athleteId === input.athleteId && p.date === input.date,
      );
      if (!day) throw new CoachingAccessError("No active day plan for that date.");

      if (input.source === "athlete" && input.actorId !== input.athleteId) {
        throw new CoachingAccessError("Only the athlete can submit an athlete live-day change.");
      }
      if (input.source === "reserve" && input.actorId !== "reserve") {
        throw new CoachingAccessError("Reserve-generated changes must come from the Reserve engine.");
      }

      // Coaches need live-day permission; direct apply needs manage + authority.
      if (input.source === "coach") {
        const rel = activeRelationship(db, input.actorId, input.athleteId);
        if (!canSuggest(rel, "liveDayOverrides")) {
          throw new CoachingAccessError("You do not have live-day permission for this athlete.");
        }
        if (
          input.intent === "apply" &&
          !(canManage(rel, "liveDayOverrides") && rel?.overrideAuthority === "coach_can_apply")
        ) {
          throw new CoachingAccessError(
            "Direct apply requires manage-level live-day authority — sending as a suggestion instead.",
          );
        }
      }

      const now = nowIso();
      const override: LiveDayOverride = {
        id: newId("ovr"),
        athleteId: input.athleteId,
        date: input.date,
        source: input.source,
        createdBy: input.actorId,
        reason: input.reason,
        originalSnapshot: input.originalSnapshot,
        proposedSnapshot: input.proposedSnapshot,
        status: "proposed",
        explanation: input.explanation,
        impactSummary: input.impactSummary,
        warnings: input.warnings,
        createdAt: now,
      };
      db.liveDayOverrides.push(override);
      pushLiveEvent(db, input.athleteId, input.date, input.source, input.actorId,
        input.source === "coach" ? "Coach proposed a revised day" :
        input.source === "athlete" ? "Athlete proposed a revised day" : "Reserve prepared a revised day");

      const openProposals = db.liveDayOverrides.filter(
        (o) => o.athleteId === input.athleteId && o.date === input.date && o.status === "proposed",
      );
      const sources = new Set(openProposals.map((o) => o.source));

      if (input.intent === "apply") {
        applyOverride(db, day, override, input.actorId);
      } else if (openProposals.length > 1 && sources.size > 1) {
        // Conflicting live edits from different sides: preserve both, surface it.
        day.status = "conflict";
        day.conflictOverrideIds = openProposals.map((o) => o.id);
        day.lastUpdatedAt = now;
        pushLiveEvent(db, input.athleteId, input.date, "reserve", "reserve",
          "Conflicting changes detected — both versions preserved for review");
      } else {
        day.status = "awaiting_approval";
        day.activeOverrideId = override.id;
        day.lastUpdatedAt = now;
        day.lastUpdatedBy = input.source;
      }
      created = override;
    });
    return created!;
  }

  async acceptOverride(overrideId: string, actorId: string): Promise<ActiveDayPlan> {
    let updatedDay: ActiveDayPlan | null = null;
    this.store.write((db) => {
      const override = db.liveDayOverrides.find((o) => o.id === overrideId);
      if (!override) throw new CoachingAccessError("Override not found.");
      if (override.status !== "proposed") throw new CoachingAccessError("Override is not open.");
      const day = db.activeDayPlans.find(
        (p) => p.athleteId === override.athleteId && p.date === override.date,
      );
      if (!day) throw new CoachingAccessError("No active day plan.");
      // The athlete always may accept. A coach may accept an athlete/reserve
      // proposal only with manage authority.
      if (actorId !== override.athleteId) {
        const rel = activeRelationship(db, actorId, override.athleteId);
        if (!canManage(rel, "liveDayOverrides")) {
          throw new CoachingAccessError("Only the athlete can accept this change.");
        }
      }
      applyOverride(db, day, override, actorId);
      updatedDay = day;
    });
    return updatedDay!;
  }

  async rejectOverride(overrideId: string, actorId: string, reason?: string): Promise<LiveDayOverride> {
    let updated: LiveDayOverride | null = null;
    this.store.write((db) => {
      const override = db.liveDayOverrides.find((o) => o.id === overrideId);
      if (!override) throw new CoachingAccessError("Override not found.");
      if (override.status !== "proposed") throw new CoachingAccessError("Override is not open.");
      if (actorId !== override.athleteId) {
        const rel = activeRelationship(db, actorId, override.athleteId);
        if (!canSuggest(rel, "liveDayOverrides")) {
          throw new CoachingAccessError("You do not have permission to respond to this live-day change.");
        }
      }
      override.status = "rejected";
      override.respondedAt = nowIso();
      override.respondedBy = actorId;
      override.responseNote = reason;
      const day = db.activeDayPlans.find(
        (p) => p.athleteId === override.athleteId && p.date === override.date,
      );
      if (day && day.activeOverrideId === override.id) {
        const stillOpen = db.liveDayOverrides.some(
          (o) => o.athleteId === override.athleteId && o.date === override.date && o.status === "proposed",
        );
        day.status = stillOpen
          ? "awaiting_approval"
          : day.liveVersion.id === day.originalVersion.id
            ? "original"
            : day.lastUpdatedBy === "coach"
              ? "coach_override"
              : "adapted";
        day.activeOverrideId = undefined;
        day.lastUpdatedAt = nowIso();
      }
      pushLiveEvent(db, override.athleteId, override.date,
        actorId === override.athleteId ? "athlete" : "coach", actorId, "Proposed change declined");
      updated = override;
    });
    return updated!;
  }

  async resolveConflict(
    athleteId: string,
    date: string,
    keepOverrideId: string,
    actorId: string,
  ): Promise<ActiveDayPlan> {
    let updatedDay: ActiveDayPlan | null = null;
    this.store.write((db) => {
      const day = db.activeDayPlans.find((p) => p.athleteId === athleteId && p.date === date);
      if (!day) throw new CoachingAccessError("No active day plan.");
      if (actorId !== athleteId) {
        const rel = activeRelationship(db, actorId, athleteId);
        if (!canManage(rel, "liveDayOverrides")) {
          throw new CoachingAccessError("Resolving a conflict requires manage-level live-day access.");
        }
      }
      const winner = db.liveDayOverrides.find((o) => o.id === keepOverrideId);
      if (!winner || winner.athleteId !== athleteId || winner.date !== date || winner.status !== "proposed") {
        throw new CoachingAccessError("Chosen version not found.");
      }
      db.liveDayOverrides
        .filter(
          (o) =>
            o.athleteId === athleteId && o.date === date && o.status === "proposed" && o.id !== keepOverrideId,
        )
        .forEach((o) => {
          o.status = "superseded";
          o.respondedAt = nowIso();
          o.respondedBy = actorId;
        });
      applyOverride(db, day, winner, actorId);
      day.conflictOverrideIds = undefined;
      pushLiveEvent(db, athleteId, date, actorId === athleteId ? "athlete" : "coach", actorId,
        `Conflict resolved — ${winner.source === "coach" ? "coach" : "athlete"} plan applied`);
      updatedDay = day;
    });
    return updatedDay!;
  }

  async revertToOriginal(athleteId: string, date: string, actorId: string): Promise<ActiveDayPlan> {
    let updatedDay: ActiveDayPlan | null = null;
    this.store.write((db) => {
      const day = db.activeDayPlans.find((p) => p.athleteId === athleteId && p.date === date);
      if (!day) throw new CoachingAccessError("No active day plan.");
      if (actorId !== athleteId) {
        const rel = activeRelationship(db, actorId, athleteId);
        if (!canManage(rel, "liveDayOverrides")) {
          throw new CoachingAccessError("Restoring the original requires manage-level live-day access.");
        }
      }
      db.liveDayOverrides
        .filter((o) => o.athleteId === athleteId && o.date === date && o.status === "proposed")
        .forEach((o) => {
          o.status = "superseded";
          o.respondedAt = nowIso();
          o.respondedBy = actorId;
        });
      day.liveVersion = day.originalVersion;
      day.status = "original";
      day.activeOverrideId = undefined;
      day.conflictOverrideIds = undefined;
      day.lastUpdatedAt = nowIso();
      day.lastUpdatedBy = actorId === athleteId ? "athlete" : "coach";
      pushLiveEvent(db, athleteId, date, day.lastUpdatedBy, actorId, "Original plan restored");
      updatedDay = day;
    });
    return updatedDay!;
  }

  async listTimeline(athleteId: string, date: string): Promise<LiveDayTimelineEvent[]> {
    return this.store
      .read()
      .liveDayEvents.filter((e) => e.athleteId === athleteId && e.date === date)
      .sort((a, b) => a.at.localeCompare(b.at));
  }
}

function applyOverride(
  db: CoachingDatabase,
  day: ActiveDayPlan,
  override: LiveDayOverride,
  actorId: string,
): void {
  const now = nowIso();
  override.status = "accepted";
  override.respondedAt = now;
  override.respondedBy = actorId;
  override.finalSnapshot = override.proposedSnapshot;
  day.liveVersion = override.proposedSnapshot;
  day.status = override.source === "coach" ? "coach_override" : "adapted";
  day.activeOverrideId = override.id;
  day.conflictOverrideIds = undefined;
  day.lastUpdatedAt = now;
  day.lastUpdatedBy = override.source;
  // Any other open proposals for the day are superseded by the applied one.
  db.liveDayOverrides
    .filter(
      (o) =>
        o.athleteId === day.athleteId && o.date === day.date && o.status === "proposed" && o.id !== override.id,
    )
    .forEach((o) => {
      o.status = "superseded";
      o.respondedAt = now;
      o.respondedBy = actorId;
    });
  pushLiveEvent(db, day.athleteId, day.date, override.source, actorId,
    override.source === "coach" ? "Coach override applied" : "Live plan applied");
  if (override.source === "coach") {
    pushActivity(db, override.createdBy, day.athleteId, "override_applied", "Live-day override applied");
    pushLiveEvent(db, day.athleteId, day.date, "reserve", "reserve", "Athlete notified");
  }
}

/* ─── Messaging repository ────────────────────────────────────────────── */

export class LocalMessagingRepository implements MessagingRepository {
  constructor(private store: CoachingStore) {}

  async listThreads(userId: string): Promise<Conversation[]> {
    const db = this.store.read();
    return db.conversations.filter((c) => {
      const rel = db.relationships.find((r) => r.id === c.relationshipId) ?? null;
      // Threads of ended relationships leave the active channel list for both
      // sides (message history stays stored, never deleted).
      if (!rel || rel.status === "revoked" || rel.status === "archived") return false;
      if (c.athleteId === userId) return true;
      if (c.coachId !== userId) return false;
      return canView(rel, "messaging");
    })
      .sort((a, b) => (b.lastMessageAt ?? b.createdAt).localeCompare(a.lastMessageAt ?? a.createdAt));
  }

  async getThread(threadId: string): Promise<Conversation | null> {
    return this.store.read().conversations.find((c) => c.id === threadId) ?? null;
  }

  async ensureThread(relationshipId: string): Promise<Conversation> {
    const db = this.store.read();
    const existing = db.conversations.find((c) => c.relationshipId === relationshipId);
    if (existing) return existing;
    const rel = db.relationships.find((r) => r.id === relationshipId);
    if (!rel || rel.status !== "active") throw new CoachingAccessError("Active relationship not found.");
    const now = nowIso();
    const thread: Conversation = {
      id: newId("thr"),
      relationshipId,
      coachId: rel.coachId,
      athleteId: rel.athleteId,
      createdAt: now,
      lastMessageAt: null,
      lastMessagePreview: null,
      lastReadAt: { [rel.coachId]: now, [rel.athleteId]: now },
    };
    this.store.write((d) => d.conversations.push(thread));
    return thread;
  }

  async listMessages(threadId: string): Promise<ChatMessage[]> {
    return this.store
      .read()
      .messages.filter((m) => m.threadId === threadId)
      .sort((a, b) => a.sentAt.localeCompare(b.sentAt));
  }

  async sendMessage(input: SendMessageInput): Promise<ChatMessage> {
    let created: ChatMessage | null = null;
    this.store.write((db) => {
      const thread = db.conversations.find((c) => c.id === input.threadId);
      if (!thread) throw new CoachingAccessError("Conversation not found.");
      if (input.senderId !== thread.coachId && input.senderId !== thread.athleteId) {
        throw new CoachingAccessError("Not a participant in this conversation.");
      }
      const rel = db.relationships.find((r) => r.id === thread.relationshipId) ?? null;
      if (!rel || rel.status !== "active") {
        throw new CoachingAccessError("This coaching relationship is not active.");
      }
      if (input.senderId === thread.coachId && !canSuggest(rel, "messaging")) {
        throw new CoachingAccessError("Messaging access has not been granted.");
      }
      const now = nowIso();
      const message: ChatMessage = {
        id: newId("msg"),
        threadId: input.threadId,
        senderId: input.senderId,
        sentAt: now,
        body: input.body,
        action: input.action,
      };
      db.messages.push(message);
      thread.lastMessageAt = now;
      thread.lastMessagePreview = input.action ? input.action.title : input.body.slice(0, 80);
      thread.lastReadAt[input.senderId] = now;
      created = message;
    });
    return created!;
  }

  async markRead(threadId: string, userId: string): Promise<void> {
    this.store.write((db) => {
      const thread = db.conversations.find((c) => c.id === threadId);
      if (!thread) throw new CoachingAccessError("Conversation not found.");
      if (userId !== thread.coachId && userId !== thread.athleteId) {
        throw new CoachingAccessError("Not a participant in this conversation.");
      }
      if (userId === thread.coachId) {
        const rel = db.relationships.find((r) => r.id === thread.relationshipId) ?? null;
        if (!canView(rel, "messaging")) {
          throw new CoachingAccessError("Messaging access has not been granted.");
        }
      }
      thread.lastReadAt[userId] = nowIso();
    });
  }

  async unreadCount(userId: string): Promise<number> {
    const db = this.store.read();
    return db.conversations
      .filter((c) => c.coachId === userId || c.athleteId === userId)
      .reduce((sum, thread) => {
        const lastRead = thread.lastReadAt[userId] ?? "";
        return (
          sum +
          db.messages.filter(
            (m) => m.threadId === thread.id && m.senderId !== userId && m.sentAt > lastRead,
          ).length
        );
      }, 0);
  }

  subscribe(threadId: string, callback: (message: ChatMessage) => void): () => void {
    let lastSeen = nowIso();
    return this.store.subscribe(() => {
      const fresh = this.store
        .read()
        .messages.filter((m) => m.threadId === threadId && m.sentAt > lastSeen);
      if (fresh.length > 0) {
        lastSeen = fresh[fresh.length - 1].sentAt;
        fresh.forEach(callback);
      }
    });
  }
}

/* ─── Tracking repository ─────────────────────────────────────────────── */

export class LocalTrackingRepository implements TrackingRepository {
  constructor(private store: CoachingStore) {}

  async listCheckIns(athleteId: string, requesterId: string): Promise<WeeklyCheckIn[]> {
    const db = this.store.read();
    const { self, rel } = requesterRelationship(db, requesterId, athleteId);
    if (!self && !canView(rel, "checkIns")) {
      throw new CoachingAccessError("Check-in access has not been granted.");
    }
    return db.checkIns.filter((c) => c.athleteId === athleteId)
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  }

  async submitCheckIn(input: SubmitCheckInInput, requesterId: string): Promise<WeeklyCheckIn> {
    if (requesterId !== input.athleteId) {
      throw new CoachingAccessError("Only the athlete can submit their check-in.");
    }
    const source = this.store.read();
    const rel = source.relationships.find(
      (r) => r.id === input.relationshipId && r.athleteId === input.athleteId && r.status === "active",
    );
    if (!rel) throw new CoachingAccessError("An active coaching relationship is required.");
    const existing = source.checkIns.find(
      (checkIn) =>
        checkIn.athleteId === input.athleteId &&
        checkIn.relationshipId === input.relationshipId &&
        checkIn.weekOf === input.weekOf,
    );
    if (existing) return existing;
    const checkIn: WeeklyCheckIn = { ...input, id: newId("ci"), submittedAt: nowIso() };
    this.store.write((db) => {
      db.checkIns.unshift(checkIn);
      if (input.weightLb !== null) {
        const date = localDayOf(checkIn.submittedAt);
        db.weightEntries = db.weightEntries.filter(
          (w) => !(w.athleteId === input.athleteId && w.date === date),
        );
        db.weightEntries.push({
          id: newId("wt"),
          athleteId: input.athleteId,
          date,
          weightLb: input.weightLb,
          note: "Weekly check-in",
        });
      }
      pushActivity(db, rel.coachId, rel.athleteId, "checkin_submitted",
        `Weekly check-in submitted (week of ${input.weekOf})`);
    });
    return checkIn;
  }

  async listReviews(athleteId: string, requesterId: string): Promise<CoachReview[]> {
    const db = this.store.read();
    const { self, rel } = requesterRelationship(db, requesterId, athleteId);
    if (!self && !canView(rel, "checkIns")) {
      throw new CoachingAccessError("Review access has not been granted.");
    }
    return db.reviews.filter((r) => r.athleteId === athleteId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async saveReview(
    review: Omit<CoachReview, "id" | "createdAt">,
    requesterId: string,
  ): Promise<CoachReview> {
    if (requesterId !== review.coachId) {
      throw new CoachingAccessError("Only the assigned coach can save this review.");
    }
    const source = this.store.read();
    const rel = activeRelationship(source, review.coachId, review.athleteId);
    if (!canManage(rel, "checkIns")) {
      throw new CoachingAccessError("Completing reviews requires manage-level check-in access.");
    }
    const sourceCheckIn = source.checkIns.find(
      (c) => c.id === review.checkInId && c.athleteId === review.athleteId,
    );
    if (!sourceCheckIn) throw new CoachingAccessError("Check-in not found.");
    const saved: CoachReview = { ...review, id: newId("rev"), createdAt: nowIso() };
    this.store.write((db) => {
      db.reviews.unshift(saved);
      const checkIn = db.checkIns.find((c) => c.id === review.checkInId);
      if (checkIn) checkIn.reviewId = saved.id;
      if (saved.completedAt) {
        pushActivity(db, review.coachId, review.athleteId, "review_completed", "Check-in review completed");
      }
    });
    return saved;
  }

  async listWeights(athleteId: string, requesterId: string): Promise<WeightEntry[]> {
    const db = this.store.read();
    const { self, rel } = requesterRelationship(db, requesterId, athleteId);
    if (!self && !canView(rel, "weightTrends")) {
      throw new CoachingAccessError("Weight-trend access has not been granted.");
    }
    return db.weightEntries
      .filter((w) => w.athleteId === athleteId)
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  async addWeight(entry: Omit<WeightEntry, "id">, requesterId: string): Promise<WeightEntry> {
    if (requesterId !== entry.athleteId) {
      throw new CoachingAccessError("Only the athlete can add a weight entry.");
    }
    const saved: WeightEntry = { ...entry, id: newId("wt") };
    this.store.write((db) => {
      db.weightEntries = db.weightEntries.filter(
        (w) => !(w.athleteId === entry.athleteId && w.date === entry.date),
      );
      db.weightEntries.push(saved);
    });
    return saved;
  }

  async listPhotos(athleteId: string, requesterId: string): Promise<PhysiquePhotoRecord[]> {
    const db = this.store.read();
    const { self, rel } = requesterRelationship(db, requesterId, athleteId);
    if (!self && !canViewPhotos(rel)) {
      throw new CoachingAccessError("Physique-photo access has not been granted.");
    }
    return db.photos
      .filter((p) => p.athleteId === athleteId)
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  async annotatePhoto(photoId: string, requesterId: string, note: string): Promise<PhysiquePhotoRecord> {
    let updated: PhysiquePhotoRecord | null = null;
    this.store.write((db) => {
      const photo = db.photos.find((p) => p.id === photoId);
      if (!photo) throw new CoachingAccessError("Photo not found.");
      const { self, rel } = requesterRelationship(db, requesterId, photo.athleteId);
      if (!self && !canAnnotatePhotos(rel)) {
        throw new CoachingAccessError("Annotation requires view-and-annotate photo access.");
      }
      if (self) photo.athleteNote = note;
      else photo.coachVisibleNote = note;
      updated = photo;
    });
    return updated!;
  }

  async requestRetake(photoId: string, requesterId: string): Promise<PhysiquePhotoRecord> {
    let updated: PhysiquePhotoRecord | null = null;
    this.store.write((db) => {
      const photo = db.photos.find((p) => p.id === photoId);
      if (!photo) throw new CoachingAccessError("Photo not found.");
      const { self, rel } = requesterRelationship(db, requesterId, photo.athleteId);
      if (!self && !(canViewPhotos(rel) && rel?.permissions.physiquePhotos.mayRequestUploads)) {
        throw new CoachingAccessError("Requesting retakes requires upload-request permission.");
      }
      photo.retakeRequested = true;
      updated = photo;
    });
    return updated!;
  }

  async listNotes(coachId: string, athleteId: string, requesterId: string): Promise<CoachNote[]> {
    if (requesterId !== coachId) {
      throw new CoachingAccessError("Private coach notes are visible only to their author.");
    }
    return this.store.read().notes.filter((n) => n.coachId === coachId && n.athleteId === athleteId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async addNote(
    note: Omit<CoachNote, "id" | "createdAt" | "updatedAt">,
    requesterId: string,
  ): Promise<CoachNote> {
    if (requesterId !== note.coachId) {
      throw new CoachingAccessError("Only the assigned coach can add this note.");
    }
    if (!activeRelationship(this.store.read(), note.coachId, note.athleteId)) {
      throw new CoachingAccessError("An active coaching relationship is required.");
    }
    const now = nowIso();
    const saved: CoachNote = { ...note, id: newId("note"), createdAt: now, updatedAt: now };
    this.store.write((db) => {
      db.notes.unshift(saved);
      pushActivity(db, note.coachId, note.athleteId, "note_added", "Private note added");
    });
    return saved;
  }
}

/* ─── Template repository ─────────────────────────────────────────────── */

export class LocalTemplateRepository implements TemplateRepository {
  constructor(private store: CoachingStore) {}

  async listTemplates(coachId: string): Promise<CoachTemplate[]> {
    return this.store
      .read()
      .templates.filter((t) => t.coachId === coachId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async createTemplate(
    input: Omit<CoachTemplate, "id" | "createdAt" | "updatedAt" | "archived">,
  ): Promise<CoachTemplate> {
    const now = nowIso();
    const template: CoachTemplate = { ...input, id: newId("tpl"), createdAt: now, updatedAt: now, archived: false };
    this.store.write((db) => db.templates.unshift(template));
    return template;
  }

  async duplicateTemplate(id: string, coachId: string): Promise<CoachTemplate> {
    const source = this.store.read().templates.find((t) => t.id === id && t.coachId === coachId);
    if (!source) throw new CoachingAccessError("Template not found.");
    const now = nowIso();
    const copy: CoachTemplate = {
      ...JSON.parse(JSON.stringify(source)),
      id: newId("tpl"),
      name: `${source.name} (Copy)`,
      createdAt: now,
      updatedAt: now,
      archived: false,
    };
    this.store.write((db) => db.templates.unshift(copy));
    return copy;
  }

  async updateTemplate(
    id: string,
    coachId: string,
    changes: Partial<Pick<CoachTemplate, "name" | "description" | "payload">>,
  ): Promise<CoachTemplate> {
    let updated: CoachTemplate | null = null;
    this.store.write((db) => {
      const template = db.templates.find((t) => t.id === id && t.coachId === coachId);
      if (!template) throw new CoachingAccessError("Template not found.");
      Object.assign(template, changes);
      template.updatedAt = nowIso();
      updated = template;
    });
    return updated!;
  }

  async setArchived(id: string, coachId: string, archived: boolean): Promise<CoachTemplate> {
    let updated: CoachTemplate | null = null;
    this.store.write((db) => {
      const template = db.templates.find((t) => t.id === id && t.coachId === coachId);
      if (!template) throw new CoachingAccessError("Template not found.");
      template.archived = archived;
      template.updatedAt = nowIso();
      updated = template;
    });
    return updated!;
  }

  async assignTemplate(
    id: string,
    coachId: string,
    athleteId: string,
  ): Promise<CoachTemplateAssignment> {
    const db = this.store.read();
    const template = db.templates.find((t) => t.id === id && t.coachId === coachId && !t.archived);
    if (!template) throw new CoachingAccessError("Active template not found.");
    if (!activeRelationship(db, coachId, athleteId)) {
      throw new CoachingAccessError("An active coaching relationship is required.");
    }
    const assignment: CoachTemplateAssignment = {
      id: newId("tpa"),
      templateId: id,
      coachId,
      athleteId,
      assignedAt: nowIso(),
    };
    this.store.write((d) => d.templateAssignments.unshift(assignment));
    return assignment;
  }
}

/* ─── Bundle ──────────────────────────────────────────────────────────── */

export type CoachingRepositories = {
  coaching: CoachingRepository;
  prescriptions: PrescriptionRepository;
  liveDay: LiveDayRepository;
  messaging: MessagingRepository;
  tracking: TrackingRepository;
  templates: TemplateRepository;
};

export function createLocalRepositories(store: CoachingStore): CoachingRepositories {
  return {
    coaching: new LocalCoachingRepository(store),
    prescriptions: new LocalPrescriptionRepository(store),
    liveDay: new LocalLiveDayRepository(store),
    messaging: new LocalMessagingRepository(store),
    tracking: new LocalTrackingRepository(store),
    templates: new LocalTemplateRepository(store),
  };
}
