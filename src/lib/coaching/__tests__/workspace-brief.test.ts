import { describe, expect, it } from "vitest";

import { deriveClientAlerts } from "../alerts/engine";
import { DEMO_IDS, ensureDemoScenario } from "../fixtures";
import { createLocalRepositories } from "../repositories/local";
import { CoachingStore, MemoryAdapter } from "../storage";
import {
  buildCoachDecisionInput,
  clientsNeedingDecision,
  resolveAlertsBrief,
  resolveClientBrief,
  resolveCoachCommand,
  resolveLiveBrief,
  resolveMessagesBrief,
  resolvePlansBrief,
  resolveReviewsBrief,
  resolveRosterBrief,
  resolveTemplatesBrief,
  type CoachBrief,
  type CoachDecisionInput,
} from "../workspace-brief";

function empty(overrides: Partial<CoachDecisionInput> = {}): CoachDecisionInput {
  return {
    activeClients: [],
    pendingInvitations: 0,
    athleteRequests: [],
    checkInsAwaiting: [],
    liveDecisions: [],
    plansToRevise: [],
    unreadThreads: [],
    openAlerts: [],
    ...overrides,
  };
}

const ana = { athleteId: "a1", name: "Ana Ruiz" };
const ben = { athleteId: "b1", name: "Ben Ode" };

/** Every brief: a sentence, a short support line, and a reason whenever there is no gold action. */
function wellFormed(brief: CoachBrief) {
  expect(brief.statement).toMatch(/[.!]$/);
  expect(brief.support.length).toBeLessThanOrEqual(120);
  if (!brief.primary) expect(brief.noAction, "a screen without a gold action says why").toBeTruthy();
}

describe("coach command brief", () => {
  it("with no clients, says so and invites the first one", () => {
    const brief = resolveCoachCommand(empty());
    wellFormed(brief);
    expect(brief.statement).toBe("No clients yet.");
    expect(brief.primary).toEqual({ kind: "invite-client", label: "Invite your first client" });
  });

  it("with no clients but an athlete request, reviews the request first", () => {
    const brief = resolveCoachCommand(empty({ athleteRequests: [{ id: "inv-1", athleteName: "Cal" }] }));
    expect(brief.primary).toMatchObject({ kind: "review-athlete-request", invitationId: "inv-1" });
  });

  it("counts distinct clients needing a decision, not decisions", () => {
    const input = empty({
      activeClients: [ana, ben],
      checkInsAwaiting: [
        { id: "c1", athleteId: "a1", athleteName: "Ana Ruiz", weekOf: "2026-09-07" },
        { id: "c2", athleteId: "a1", athleteName: "Ana Ruiz", weekOf: "2026-08-31" },
      ],
      liveDecisions: [{ athleteId: "a1", athleteName: "Ana Ruiz", kind: "change" }],
    });
    expect(clientsNeedingDecision(input)).toBe(1);
    const brief = resolveCoachCommand(input);
    wellFormed(brief);
    expect(brief.statement).toBe("1 client needs a decision today.");
  });

  it("orders the gold action: conflict, live change, check-in, revision, request", () => {
    const checkIn = { id: "c1", athleteId: "b1", athleteName: "Ben Ode", weekOf: "2026-09-07" };
    const base = empty({ activeClients: [ana, ben], checkInsAwaiting: [checkIn] });
    expect(resolveCoachCommand(base).primary).toMatchObject({ kind: "review-check-in", label: "Review next check-in", checkInId: "c1" });
    expect(
      resolveCoachCommand({ ...base, liveDecisions: [{ athleteId: "a1", athleteName: "Ana Ruiz", kind: "change" }] }).primary,
    ).toMatchObject({ kind: "review-live-change", label: "Review Ana's day" });
    expect(
      resolveCoachCommand({
        ...base,
        liveDecisions: [
          { athleteId: "a1", athleteName: "Ana Ruiz", kind: "change" },
          { athleteId: "b1", athleteName: "Ben Ode", kind: "conflict" },
        ],
      }).primary,
    ).toMatchObject({ kind: "resolve-conflict", athleteId: "b1" });
    expect(
      resolveCoachCommand(
        empty({ activeClients: [ana], plansToRevise: [{ id: "p1", athleteId: "a1", athleteName: "Ana Ruiz", title: "Block", category: "nutrition" }] }),
      ).primary,
    ).toMatchObject({ kind: "revise-plan", label: "Revise Ana's nutrition plan" });
  });

  it("with clients and nothing waiting, has no gold action and says why", () => {
    const brief = resolveCoachCommand(empty({ activeClients: [ana] }));
    wellFormed(brief);
    expect(brief.statement).toBe("No client needs a decision.");
    expect(brief.primary).toBeNull();
  });
});

describe("screen briefs", () => {
  it("roster: first client, then a request, then an ordinary invite", () => {
    expect(resolveRosterBrief(empty()).primary?.label).toBe("Invite your first client");
    expect(resolveRosterBrief(empty({ pendingInvitations: 2 })).support).toBe("2 invitations are waiting on the athlete.");
    expect(resolveRosterBrief(empty({ activeClients: [ana], athleteRequests: [{ id: "i", athleteName: "Cal" }] })).primary?.kind).toBe("review-athlete-request");
    const brief = resolveRosterBrief(empty({ activeClients: [ana, ben] }));
    wellFormed(brief);
    expect(brief.statement).toBe("2 active clients.");
    expect(brief.primary?.label).toBe("Invite a client");
  });

  it("reviews: names the newest check-in, and is read-only when clear", () => {
    const waiting = resolveReviewsBrief(
      empty({ activeClients: [ana], checkInsAwaiting: [{ id: "c9", athleteId: "a1", athleteName: "Ana Ruiz", weekOf: "2026-09-07" }] }),
      3,
    );
    wellFormed(waiting);
    expect(waiting.statement).toBe("1 check-in waiting for review.");
    expect(waiting.primary).toMatchObject({ kind: "review-check-in", label: "Review Ana's check-in", checkInId: "c9" });
    for (const brief of [resolveReviewsBrief(empty(), 0), resolveReviewsBrief(empty({ activeClients: [ana] }), 2)]) {
      wellFormed(brief);
      expect(brief.primary).toBeNull();
    }
  });

  it("live: conflicts lead; no live day is said plainly", () => {
    const brief = resolveLiveBrief(
      empty({
        activeClients: [ana, ben],
        liveDecisions: [
          { athleteId: "b1", athleteName: "Ben Ode", kind: "conflict" },
          { athleteId: "a1", athleteName: "Ana Ruiz", kind: "change" },
        ],
      }),
      2,
    );
    wellFormed(brief);
    expect(brief.statement).toBe("2 live-day decisions waiting.");
    expect(brief.primary).toMatchObject({ kind: "resolve-conflict", athleteId: "b1" });
    expect(resolveLiveBrief(empty({ activeClients: [ana] }), 0).statement).toBe("No live days yet.");
    expect(resolveLiveBrief(empty({ activeClients: [ana] }), 1).primary).toBeNull();
  });

  it("alerts: the gold action is the most severe alert's own action", () => {
    const brief = resolveAlertsBrief(
      empty({ openAlerts: [{ id: "al-1", athleteId: "a1", headline: "Check-in overdue", actionLabel: "Request check-in" }] }),
      0,
    );
    wellFormed(brief);
    expect(brief.primary).toEqual({ kind: "alert-action", label: "Request check-in", alertId: "al-1" });
    const clear = resolveAlertsBrief(empty(), 4);
    wellFormed(clear);
    expect(clear.statement).toBe("No open alerts.");
    expect(clear.support).toBe("4 alerts handled.");
  });

  it("messages: totals unread across threads and replies to the newest", () => {
    const brief = resolveMessagesBrief(
      empty({
        activeClients: [ana, ben],
        unreadThreads: [
          { threadId: "t2", athleteName: "Ben Ode", unread: 2 },
          { threadId: "t1", athleteName: "Ana Ruiz", unread: 1 },
        ],
      }),
      2,
    );
    wellFormed(brief);
    expect(brief.statement).toBe("3 unread messages.");
    expect(brief.primary).toEqual({ kind: "open-thread", label: "Reply to Ben", threadId: "t2" });
    expect(resolveMessagesBrief(empty(), 0).primary?.kind).toBe("open-clients");
    const quiet = resolveMessagesBrief(empty({ activeClients: [ana] }), 1);
    wellFormed(quiet);
    expect(quiet.primary).toBeNull();
  });

  it("plans: revision, then send, then draft, then create; nothing to create without access", () => {
    const plan = (status: string, id = status) => ({ id, athleteId: "a1", athleteName: "Ana Ruiz", title: "Block II", status });
    expect(resolvePlansBrief({ category: "training", plans: [plan("sent"), plan("revision_requested")], clientsWithAccess: 1 }).primary?.kind).toBe("revise-plan");
    expect(resolvePlansBrief({ category: "training", plans: [plan("draft"), plan("ready_for_review")], clientsWithAccess: 1 }).primary?.kind).toBe("send-plan");
    expect(resolvePlansBrief({ category: "training", plans: [plan("draft")], clientsWithAccess: 1 }).primary?.kind).toBe("finish-draft");
    const none = resolvePlansBrief({ category: "nutrition", plans: [], clientsWithAccess: 0 });
    wellFormed(none);
    expect(none.statement).toBe("No nutrition plans yet.");
    expect(none.primary).toBeNull();
    expect(resolvePlansBrief({ category: "schedule", plans: [], clientsWithAccess: 2 }).primary).toEqual({
      kind: "create-plan",
      label: "Draft a schedule",
      category: "schedule",
    });
    expect(resolvePlansBrief({ category: "training", plans: [plan("sent", "a"), plan("sent", "b")], clientsWithAccess: 1 }).statement).toBe(
      "2 programs waiting on athletes.",
    );
  });

  it("templates: always a real create action", () => {
    expect(resolveTemplatesBrief(0, 0).statement).toBe("No templates yet.");
    expect(resolveTemplatesBrief(3, 1).statement).toBe("3 templates ready to reuse.");
    expect(resolveTemplatesBrief(3, 1).primary?.kind).toBe("create-template");
  });

  it("one client: paused coaching has nothing to act on", () => {
    const base = { name: "Ana Ruiz", liveDecision: null, checkInAwaiting: null, planToRevise: null, threadId: "t1", canMessage: true, unread: 0 };
    const paused = resolveClientBrief({ ...base, relationshipStatus: "paused" }, "a1");
    wellFormed(paused);
    expect(paused.primary).toBeNull();
    expect(resolveClientBrief({ ...base, relationshipStatus: "active", liveDecision: "conflict", checkInAwaiting: { id: "c" } }, "a1").primary?.kind).toBe("resolve-conflict");
    expect(resolveClientBrief({ ...base, relationshipStatus: "active", checkInAwaiting: { id: "c" } }, "a1").primary).toMatchObject({ kind: "review-check-in", checkInId: "c" });
    const calm = resolveClientBrief({ ...base, relationshipStatus: "active" }, "a1");
    wellFormed(calm);
    expect(calm.primary).toEqual({ kind: "open-thread", label: "Message Ana", threadId: "t1" });
    const noChannel = resolveClientBrief({ ...base, relationshipStatus: "active", threadId: null }, "a1");
    wellFormed(noChannel);
    expect(noChannel.primary).toBeNull();
  });
});

describe("building the input from the coaching snapshot", () => {
  it("an empty coach database yields an empty, honest input", () => {
    const store = new CoachingStore(new MemoryAdapter());
    const db = store.read();
    const input = buildCoachDecisionInput(db, [], [], DEMO_IDS.coach);
    expect(input).toEqual(empty());
    expect(resolveCoachCommand(input).statement).toBe("No clients yet.");
  });

  it("reads the demo roster without counting a coach's own proposal as the coach's decision", async () => {
    const store = new CoachingStore(new MemoryAdapter());
    ensureDemoScenario(store);
    const repos = createLocalRepositories(store);
    const clients = await repos.coaching.listClients(DEMO_IDS.coach);
    const db = store.read();
    const alerts = deriveClientAlerts(db, DEMO_IDS.coach, new Date());
    const input = buildCoachDecisionInput(db, clients, alerts, DEMO_IDS.coach);

    expect(input.activeClients.map((c) => c.athleteId).sort()).toEqual([DEMO_IDS.anthony, DEMO_IDS.jasmine, DEMO_IDS.luis].sort());
    for (const decision of input.liveDecisions) {
      const day = db.activeDayPlans.filter((p) => p.athleteId === decision.athleteId).sort((a, b) => b.date.localeCompare(a.date))[0];
      const pending = db.liveDayOverrides.find((o) => o.id === day.activeOverrideId);
      if (decision.kind === "change") expect(pending?.source).not.toBe("coach");
    }
    for (const checkIn of input.checkInsAwaiting) {
      const record = db.checkIns.find((c) => c.id === checkIn.id)!;
      expect(db.reviews.some((r) => r.id === record.reviewId && r.completedAt)).toBe(false);
    }
    expect(input.openAlerts.every((a) => alerts.find((x) => x.id === a.id)?.severity !== "info")).toBe(true);

    /* Coach proposes a change for a client: it waits on the athlete, so it is not a coach decision. */
    const anthonyDay = db.activeDayPlans.find((p) => p.athleteId === DEMO_IDS.anthony)!;
    store.write((d) => {
      const override = d.liveDayOverrides.find((o) => o.id === anthonyDay.activeOverrideId);
      if (override) override.source = "coach";
    });
    const after = buildCoachDecisionInput(store.read(), clients, alerts, DEMO_IDS.coach);
    expect(after.liveDecisions.some((d) => d.athleteId === DEMO_IDS.anthony && d.kind === "change")).toBe(false);
  });
});
