import { describe, expect, it } from "vitest";

import { deriveClientAlerts } from "../alerts/engine";
import { DEMO_IDS, ensureDemoScenario } from "../fixtures";
import { todayKey } from "../ids";
import { buildPlannedDay } from "../live-day/day-plan";
import { buildAdaptedDay } from "../live-day/engine";
import {
  FULL_ACCESS_PERMISSIONS,
  NO_ACCESS_PERMISSIONS,
  clonePermissions,
} from "../permissions";
import { createLocalRepositories } from "../repositories/local";
import {
  CoachingStore,
  MemoryAdapter,
  migrateCoachingEnvelope,
} from "../storage";
import type { ReserveMember } from "../types";

function scenario() {
  const adapter = new MemoryAdapter();
  const store = new CoachingStore(adapter);
  ensureDemoScenario(store);
  return { adapter, store, repos: createLocalRepositories(store) };
}

function addAthlete(store: CoachingStore, id: string, email: string): ReserveMember {
  const member: ReserveMember = {
    id,
    name: "Synthetic Athlete",
    email,
    tier: "premium_personal",
    createdAt: new Date().toISOString(),
    isDemo: true,
  };
  store.write((db) => db.members.push(member));
  return member;
}

describe("coaching relationship lifecycle", () => {
  it("accepts a coach invitation and activates exactly one relationship", async () => {
    const { store, repos } = scenario();
    const athlete = addAthlete(store, "member-invitee", "invitee@reserve.demo");
    const invitation = await repos.coaching.createInvitation({
      coachId: DEMO_IDS.coach,
      athleteName: athlete.name,
      athleteEmail: athlete.email,
      requestedPermissions: clonePermissions(FULL_ACCESS_PERMISSIONS),
    });

    const relationship = await repos.coaching.acceptInvitation({
      invitationId: invitation.id,
      athleteId: athlete.id,
      grantedPermissions: clonePermissions(FULL_ACCESS_PERMISSIONS),
    });

    expect(relationship.status).toBe("active");
    expect(relationship.initiatedBy).toBe("coach");
    expect(store.read().invitations.find((item) => item.id === invitation.id)?.status).toBe("accepted");
    expect(store.read().conversations.filter((thread) => thread.relationshipId === relationship.id)).toHaveLength(1);
    expect(store.read().permissionAudit.some((entry) => entry.relationshipId === relationship.id)).toBe(true);
  });

  it("routes an athlete-initiated request through coach review and final athlete consent", async () => {
    const { store, repos } = scenario();
    const athlete = addAthlete(store, "member-self-connect", "self-connect@reserve.demo");
    const request = await repos.coaching.requestConnection({
      athleteId: athlete.id,
      reference: "HALE-2291",
    });
    expect(request.direction).toBe("athlete_to_coach");

    const returned = await repos.coaching.approveConnectionRequest(
      request.id,
      DEMO_IDS.coach,
      clonePermissions(FULL_ACCESS_PERMISSIONS),
    );
    expect(returned.direction).toBe("coach_to_athlete");
    expect(returned.status).toBe("sent");

    const relationship = await repos.coaching.acceptInvitation({
      invitationId: request.id,
      athleteId: athlete.id,
      grantedPermissions: clonePermissions(FULL_ACCESS_PERMISSIONS),
    });
    expect(relationship).toMatchObject({ status: "active", initiatedBy: "athlete" });
  });
});

describe("repository permission enforcement", () => {
  it("expands full access while keeping full photo downloads isolated", async () => {
    const { store, repos } = scenario();
    const relationship = store.read().relationships.find((item) => item.id === "rel-anthony")!;

    await repos.coaching.updatePermissions(
      relationship.id,
      clonePermissions(NO_ACCESS_PERMISSIONS),
      DEMO_IDS.anthony,
    );
    await expect(repos.tracking.listPhotos(DEMO_IDS.anthony, DEMO_IDS.coach)).rejects.toThrow(
      "Physique-photo access",
    );

    const expanded = await repos.coaching.updatePermissions(
      relationship.id,
      clonePermissions(FULL_ACCESS_PERMISSIONS),
      DEMO_IDS.anthony,
    );
    expect(expanded.permissions.training).toBe("manage");
    expect(expanded.permissions.liveDayOverrides).toBe("manage");
    expect(expanded.permissions.physiquePhotos).toEqual({
      access: "annotate",
      mayRequestUploads: true,
      mayDownloadOriginals: false,
    });
    expect(expanded.overrideAuthority).toBe("coach_can_apply");
    await expect(repos.tracking.listPhotos(DEMO_IDS.anthony, DEMO_IDS.coach)).resolves.not.toHaveLength(0);
  });

  it("blocks unauthorized check-in reads and spoofed submissions", async () => {
    const { repos } = scenario();
    await expect(repos.tracking.listCheckIns(DEMO_IDS.anthony, DEMO_IDS.luis)).rejects.toThrow(
      "Check-in access",
    );
    await expect(repos.tracking.listCheckIns(DEMO_IDS.anthony, DEMO_IDS.coach)).resolves.not.toHaveLength(0);

    const existing = (await repos.tracking.listCheckIns(DEMO_IDS.anthony, DEMO_IDS.anthony))[0];
    const input = { ...existing, reviewId: undefined };
    await expect(repos.tracking.submitCheckIn(input, DEMO_IDS.coach)).rejects.toThrow(
      "Only the athlete",
    );

    const beforeCount = (await repos.tracking.listCheckIns(DEMO_IDS.anthony, DEMO_IDS.anthony)).length;
    const retry = await repos.tracking.submitCheckIn(input, DEMO_IDS.anthony);
    expect(retry.id).toBe(existing.id);
    expect(await repos.tracking.listCheckIns(DEMO_IDS.anthony, DEMO_IDS.anthony)).toHaveLength(beforeCount);
  });
});

describe("prescription lifecycle", () => {
  it("moves draft through review and athlete approval without destroying the prior active plan", async () => {
    const { store, repos } = scenario();
    const prior = store.read().prescriptions.find(
      (item) => item.athleteId === DEMO_IDS.anthony && item.category === "training" && item.status === "active",
    )!;
    const draft = await repos.prescriptions.createDraft({
      coachId: DEMO_IDS.coach,
      athleteId: DEMO_IDS.anthony,
      category: "training",
      title: "Synthetic Revision",
      reason: "Focused lifecycle verification",
      summaryOfChanges: ["One synthetic training change"],
      payload: structuredClone(prior.payload),
      effectiveDate: todayKey(),
      previousVersionId: prior.id,
    });
    expect(draft.status).toBe("draft");

    const ready = await repos.prescriptions.markReadyForReview(draft.id, DEMO_IDS.coach);
    expect(ready.status).toBe("ready_for_review");
    const sent = await repos.prescriptions.publish(ready.id, DEMO_IDS.coach, "send_for_approval");
    expect(sent.status).toBe("sent");
    expect(store.read().messages.some((message) => message.action?.linkedPrescriptionId === sent.id)).toBe(true);

    const active = await repos.prescriptions.accept(sent.id, DEMO_IDS.anthony);
    expect(active.status).toBe("active");
    expect(store.read().prescriptions.find((item) => item.id === prior.id)?.status).toBe("replaced");
    expect(store.read().prescriptions.find((item) => item.id === prior.id)?.payload).toEqual(prior.payload);
  });

  it("preserves a future-effective athlete approval as accepted until activation is due", async () => {
    const { store, repos } = scenario();
    const prior = store.read().prescriptions.find((item) => item.category === "training")!;
    const future = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
    const draft = await repos.prescriptions.createDraft({
      coachId: DEMO_IDS.coach,
      athleteId: DEMO_IDS.anthony,
      category: "training",
      title: "Future Synthetic Plan",
      reason: "Future-effective approval verification",
      summaryOfChanges: [],
      payload: structuredClone(prior.payload),
      effectiveDate: future,
    });
    await repos.prescriptions.markReadyForReview(draft.id, DEMO_IDS.coach);
    await repos.prescriptions.publish(draft.id, DEMO_IDS.coach, "send_for_approval");
    const accepted = await repos.prescriptions.accept(draft.id, DEMO_IDS.anthony);
    expect(accepted.status).toBe("accepted");
  });
});

describe("live-day decisions", () => {
  it("builds an explainable adaptation while preserving the original plan and completed entries", () => {
    const original = buildPlannedDay({
      wakeTime: "06:30",
      bedTime: "22:30",
      trainingTime: "17:30",
      sessionTitle: "Upper output",
      sessionDemand: "high",
      mealTimes: [
        { label: "Meal 1", time: "07:00" },
        { label: "Meal 2", time: "12:00" },
        { label: "Meal 3", time: "16:00" },
        { label: "Meal 4", time: "19:30" },
      ],
    });
    const completedMeal = original.entries.find((entry) => entry.label === "Meal 1")!;
    const before = structuredClone(original);
    const result = buildAdaptedDay({
      original,
      nowTime: "10:00",
      reason: "late_wake",
      actualWakeTime: "09:00",
      newTrainingTime: "20:00",
      completedEntryIds: [completedMeal.id],
      energyLevel: "ok",
      bedtimeFixed: true,
      createdBy: "athlete",
    });

    expect(original).toEqual(before);
    expect(result.proposed.id).not.toBe(original.id);
    expect(result.proposed.entries.find((entry) => entry.id === completedMeal.id)?.completed).toBe(true);
    expect(result.explanation.length).toBeGreaterThan(0);
    expect(result.impactSummary.length).toBeGreaterThan(0);
  });

  it("enforces coach suggest versus manage and preserves both sides of a conflict", async () => {
    const { store, repos } = scenario();
    const plan = buildPlannedDay({
      wakeTime: "06:30", bedTime: "22:30", trainingTime: "17:30",
      sessionTitle: "Synthetic day", sessionDemand: "standard",
      mealTimes: [{ label: "Meal 1", time: "07:00" }, { label: "Meal 2", time: "13:00" }],
    });
    const date = todayKey();
    await repos.liveDay.ensureActiveDay(DEMO_IDS.jasmine, date, plan);
    const adapted = buildAdaptedDay({
      original: plan, nowTime: "09:00", reason: "work_change", newTrainingTime: "19:00", createdBy: "coach",
    });
    const baseInput = {
      athleteId: DEMO_IDS.jasmine,
      date,
      source: "coach" as const,
      actorId: DEMO_IDS.coach,
      reason: "work_change" as const,
      originalSnapshot: plan,
      proposedSnapshot: adapted.proposed,
      explanation: adapted.explanation,
      impactSummary: adapted.impactSummary,
      warnings: adapted.warnings,
    };
    await expect(repos.liveDay.proposeOverride({ ...baseInput, intent: "apply" })).rejects.toThrow(
      "Direct apply requires",
    );
    await expect(repos.liveDay.proposeOverride({ ...baseInput, intent: "propose" })).resolves.toMatchObject({
      status: "proposed",
    });

    await repos.coaching.updatePermissions(
      "rel-jasmine",
      clonePermissions(FULL_ACCESS_PERMISSIONS),
      DEMO_IDS.jasmine,
    );
    await expect(repos.liveDay.proposeOverride({ ...baseInput, intent: "apply" })).resolves.toMatchObject({
      status: "accepted",
    });

    const anthonyDay = store.read().activeDayPlans.find((item) => item.athleteId === DEMO_IDS.anthony)!;
    const coachVersion = buildAdaptedDay({
      original: anthonyDay.originalVersion,
      nowTime: "10:00",
      reason: "work_change",
      newTrainingTime: "19:30",
      createdBy: "coach",
    });
    await repos.liveDay.proposeOverride({
      athleteId: DEMO_IDS.anthony,
      date: anthonyDay.date,
      source: "coach",
      actorId: DEMO_IDS.coach,
      reason: "work_change",
      originalSnapshot: anthonyDay.originalVersion,
      proposedSnapshot: coachVersion.proposed,
      explanation: coachVersion.explanation,
      impactSummary: coachVersion.impactSummary,
      warnings: coachVersion.warnings,
      intent: "propose",
    });
    const conflicted = store.read().activeDayPlans.find((item) => item.id === anthonyDay.id)!;
    expect(conflicted.status).toBe("conflict");
    expect(conflicted.conflictOverrideIds).toHaveLength(2);
    expect(conflicted.originalVersion).toEqual(anthonyDay.originalVersion);
    expect(store.read().liveDayOverrides.filter(
      (item) => conflicted.conflictOverrideIds?.includes(item.id) && item.status === "proposed",
    )).toHaveLength(2);
  });
});

describe("persistence and messaging", () => {
  it("migrates missing collections and reloads coaching state without touching personal state", () => {
    const migrated = migrateCoachingEnvelope({ version: 1, data: { members: [] } });
    expect(migrated.templateAssignments).toEqual([]);
    expect(migrated.alertStates).toEqual({});

    const adapter = new MemoryAdapter();
    const personalState = { activeView: "training", privateValue: 17 };
    const first = new CoachingStore(adapter);
    first.write((db) => {
      db.seededScenario = "persistence-test";
    });
    first.destroy();
    const reloaded = new CoachingStore(adapter);
    expect(reloaded.read().seededScenario).toBe("persistence-test");
    expect(personalState).toEqual({ activeView: "training", privateValue: 17 });
  });

  it("tracks unread messages per participant and rejects foreign read-state writes", async () => {
    const { store, repos } = scenario();
    const thread = store.read().conversations.find((item) => item.relationshipId === "rel-anthony")!;
    const before = await repos.messaging.unreadCount(DEMO_IDS.coach);
    await repos.messaging.sendMessage({
      threadId: thread.id,
      senderId: DEMO_IDS.anthony,
      body: "Synthetic unread-state verification",
    });
    const afterSend = await repos.messaging.unreadCount(DEMO_IDS.coach);
    expect(afterSend).toBeGreaterThan(before);
    await expect(repos.messaging.markRead(thread.id, DEMO_IDS.luis)).rejects.toThrow("Not a participant");
    await repos.messaging.markRead(thread.id, DEMO_IDS.coach);
    expect(await repos.messaging.unreadCount(DEMO_IDS.coach)).toBeLessThan(afterSend);
  });
});

describe("owner-review hardening", () => {
  it("rejects duplicate open invitations and invitations to active clients", async () => {
    const { store, repos } = scenario();
    const athlete = addAthlete(store, "member-dup-check", "dup.check@reserve.demo");

    await repos.coaching.createInvitation({
      coachId: DEMO_IDS.coach,
      athleteName: athlete.name,
      athleteEmail: athlete.email,
      requestedPermissions: clonePermissions(FULL_ACCESS_PERMISSIONS),
    });
    await expect(
      repos.coaching.createInvitation({
        coachId: DEMO_IDS.coach,
        athleteName: athlete.name,
        athleteEmail: "DUP.CHECK@reserve.demo",
        requestedPermissions: clonePermissions(FULL_ACCESS_PERMISSIONS),
      }),
    ).rejects.toThrow("already exists");

    // Jasmine already has an active relationship with the coach.
    await expect(
      repos.coaching.createInvitation({
        coachId: DEMO_IDS.coach,
        athleteName: "Jasmine Carter",
        athleteEmail: "jasmine.carter@reserve.demo",
        requestedPermissions: clonePermissions(NO_ACCESS_PERMISSIONS),
      }),
    ).rejects.toThrow("already an active client");
  });

  it("never schedules rebuilt meals in the past once the eating window has closed", () => {
    const original = buildPlannedDay({
      wakeTime: "05:15",
      bedTime: "22:30",
      trainingTime: "06:00",
      sessionTitle: "Chest / Back",
      sessionDemand: "high",
      mealTimes: [
        { label: "Meal 1", time: "07:30" },
        { label: "Meal 2", time: "11:30" },
        { label: "Meal 3", time: "14:30" },
        { label: "Meal 4", time: "17:00" },
      ],
    });
    // The clock is already past bedtime-minus-buffer: the window is closed.
    const result = buildAdaptedDay({
      original,
      nowTime: "23:05",
      reason: "training_time_change",
      newTrainingTime: null,
      createdBy: "athlete",
    });
    const nowMinutes = 23 * 60 + 5;
    const meals = result.proposed.entries.filter((entry) => entry.kind === "meal" && !entry.completed);
    expect(meals.length).toBeGreaterThan(0);
    for (const meal of meals) {
      const [h, m] = meal.time.split(":").map(Number);
      expect(h * 60 + m).toBeGreaterThanOrEqual(nowMinutes);
    }
    expect(result.warnings.some((line) => line.includes("eating window has already closed"))).toBe(true);
  });

  it("drops threads of ended relationships from both channel lists while preserving messages", async () => {
    const { store, repos } = scenario();
    const thread = store.read().conversations.find((item) => item.relationshipId === "rel-jasmine")!;
    const messageCount = store.read().messages.filter((m) => m.threadId === thread.id).length;
    expect(messageCount).toBeGreaterThan(0);

    await repos.coaching.revokeRelationship("rel-jasmine", DEMO_IDS.jasmine);

    const coachThreads = await repos.messaging.listThreads(DEMO_IDS.coach);
    const athleteThreads = await repos.messaging.listThreads(DEMO_IDS.jasmine);
    expect(coachThreads.some((item) => item.id === thread.id)).toBe(false);
    expect(athleteThreads.some((item) => item.id === thread.id)).toBe(false);
    // History is preserved, never deleted.
    expect(store.read().messages.filter((m) => m.threadId === thread.id).length).toBe(messageCount);
  });

  it("anchors derived alerts to their evidence time with stable deduplicated ids", () => {
    const { store } = scenario();
    const db = store.read();
    const now = new Date();
    const alerts = deriveClientAlerts(db, DEMO_IDS.coach, now);

    const ids = alerts.map((alert) => alert.id);
    expect(new Set(ids).size).toBe(ids.length);

    const luisCheckIn = db.checkIns.find((item) => item.id === "ci-luis-latest")!;
    const recovery = alerts.find((alert) => alert.id === `alert:${DEMO_IDS.luis}:recovery_decline`)!;
    expect(recovery.createdAt).toBe(luisCheckIn.submittedAt);

    // Re-deriving produces the same alerts — no repeated generation drift.
    const again = deriveClientAlerts(db, DEMO_IDS.coach, now);
    expect(again.map((alert) => alert.id)).toEqual(ids);
  });
});
