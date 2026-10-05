/* ════════════════════════════════════════════════════════════════════════
   COACH WORKSPACE BRIEF — one honest statement and at most one gold action
   per coach screen.

   Every line is counted from the coach's real roster: relationships,
   check-ins, live days, plans, threads and derived alerts. With nothing
   there, the brief says what is missing; it never invents a client, a
   number or a pending decision.

   The gold action is the next thing only the coach can do, in this order:

     a live-day conflict        both sides proposed a version of today
     a live change to review    the athlete (or Reserve) proposed it
     a check-in to review       submitted and not yet reviewed
     a plan to revise           the athlete declined or asked for changes
     an athlete request         someone asked to be coached
     no clients at all          invite the first one

   Screens that are honestly read-only (nothing unread, nothing open) carry
   no gold action and say why instead (CLAUDE.md: no dead CTAs).

   Pure: no React, no store, no clock.
   ════════════════════════════════════════════════════════════════════════ */

import type { CoachingDatabase } from "./storage";
import type { ClientAlert, ClientSummary, PrescriptionCategory } from "./types";

/* ─── What a resolver acts on ─────────────────────────────────────────── */

export type CoachPrimaryAction =
  | { kind: "resolve-conflict"; label: string; athleteId: string }
  | { kind: "review-live-change"; label: string; athleteId: string }
  | { kind: "review-check-in"; label: string; athleteId: string; checkInId: string }
  | { kind: "revise-plan"; label: string; athleteId: string; prescriptionId: string; category: PrescriptionCategory }
  | { kind: "send-plan"; label: string; prescriptionId: string }
  | { kind: "finish-draft"; label: string; athleteId: string; prescriptionId: string; category: PrescriptionCategory }
  | { kind: "create-plan"; label: string; category: PrescriptionCategory }
  | { kind: "review-athlete-request"; label: string; invitationId: string }
  | { kind: "invite-client"; label: string }
  | { kind: "open-thread"; label: string; threadId: string }
  | { kind: "alert-action"; label: string; alertId: string }
  | { kind: "create-template"; label: string }
  | { kind: "open-clients"; label: string };

export type CoachBrief = {
  /** The one statement, from real data. Ends with a full stop. */
  statement: string;
  /** One short supporting line. Under 120 characters. */
  support: string;
  primary: CoachPrimaryAction | null;
  /** Why there is no gold action, when there is none. */
  noAction?: string;
};

export type CoachDecisionInput = {
  activeClients: Array<{ athleteId: string; name: string }>;
  /** Coach-to-athlete invitations still waiting on the athlete. */
  pendingInvitations: number;
  /** Athlete-to-coach requests still waiting on the coach. */
  athleteRequests: Array<{ id: string; athleteName: string }>;
  /** Newest first. */
  checkInsAwaiting: Array<{ id: string; athleteId: string; athleteName: string; weekOf: string }>;
  /** Only decisions the coach can make: conflicts, and live changes someone else proposed. */
  liveDecisions: Array<{ athleteId: string; athleteName: string; kind: "conflict" | "change" }>;
  /** Plans the athlete declined or asked to revise. Newest first. */
  plansToRevise: Array<{ id: string; athleteId: string; athleteName: string; title: string; category: PrescriptionCategory }>;
  /** Threads with unread messages from the athlete. Newest first. */
  unreadThreads: Array<{ threadId: string; athleteName: string; unread: number }>;
  /** Open, non-informational alerts. Most severe first. */
  openAlerts: Array<{ id: string; athleteId: string; headline: string; actionLabel: string }>;
};

/* ─── Words ───────────────────────────────────────────────────────────── */

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const first = (name: string) => name.split(" ")[0] || name;

const PLAN_NOUN: Record<PrescriptionCategory, { one: string; many: string }> = {
  training: { one: "program", many: "programs" },
  nutrition: { one: "nutrition plan", many: "nutrition plans" },
  schedule: { one: "schedule", many: "schedules" },
};

/** Distinct clients with something only the coach can decide. */
export function clientsNeedingDecision(input: CoachDecisionInput): number {
  return new Set([
    ...input.liveDecisions.map((d) => d.athleteId),
    ...input.checkInsAwaiting.map((c) => c.athleteId),
    ...input.plansToRevise.map((p) => p.athleteId),
  ]).size;
}

/** The single next decision across the roster, in the order above. */
function nextDecision(input: CoachDecisionInput): CoachPrimaryAction | null {
  const conflict = input.liveDecisions.find((d) => d.kind === "conflict");
  if (conflict) return { kind: "resolve-conflict", label: `Resolve ${first(conflict.athleteName)}'s day`, athleteId: conflict.athleteId };
  const change = input.liveDecisions.find((d) => d.kind === "change");
  if (change) return { kind: "review-live-change", label: `Review ${first(change.athleteName)}'s day`, athleteId: change.athleteId };
  const checkIn = input.checkInsAwaiting[0];
  if (checkIn) {
    return { kind: "review-check-in", label: "Review next check-in", athleteId: checkIn.athleteId, checkInId: checkIn.id };
  }
  const plan = input.plansToRevise[0];
  if (plan) {
    return { kind: "revise-plan", label: `Revise ${first(plan.athleteName)}'s ${PLAN_NOUN[plan.category].one}`, athleteId: plan.athleteId, prescriptionId: plan.id, category: plan.category };
  }
  const request = input.athleteRequests[0];
  if (request) return { kind: "review-athlete-request", label: "Review athlete request", invitationId: request.id };
  return null;
}

/* ─── Command (home) ──────────────────────────────────────────────────── */

export function resolveCoachCommand(input: CoachDecisionInput): CoachBrief {
  const clients = input.activeClients.length;
  if (clients === 0) {
    const request = input.athleteRequests[0];
    if (request) {
      return {
        statement: count(input.athleteRequests.length, "athlete wants to be coached.", "athletes want to be coached."),
        support: "Review what they asked for. Nothing is shared until both sides approve.",
        primary: { kind: "review-athlete-request", label: "Review athlete request", invitationId: request.id },
      };
    }
    return {
      statement: "No clients yet.",
      support:
        input.pendingInvitations > 0
          ? `${count(input.pendingInvitations, "invitation is", "invitations are")} waiting on the athlete.`
          : "Invite an athlete. They choose what you can see.",
      primary: { kind: "invite-client", label: "Invite your first client" },
    };
  }

  const deciding = clientsNeedingDecision(input);
  const primary = nextDecision(input);
  if (deciding === 0) {
    return {
      statement: "No client needs a decision.",
      support: `${count(clients, "active client", "active clients")}. ${
        input.unreadThreads.length > 0 ? `${count(input.unreadThreads.length, "thread has", "threads have")} unread messages.` : "Nothing unread."
      }`,
      primary,
      noAction: primary ? undefined : "Nothing is waiting on you. New check-ins and live changes appear here.",
    };
  }
  return {
    statement: `${count(deciding, "client needs", "clients need")} a decision today.`,
    support: `Of ${count(clients, "active client", "active clients")}. Oldest decisions first.`,
    primary,
  };
}

/* ─── Clients ─────────────────────────────────────────────────────────── */

export function resolveRosterBrief(input: CoachDecisionInput): CoachBrief {
  const clients = input.activeClients.length;
  const request = input.athleteRequests[0];
  if (request) {
    return {
      statement: count(input.athleteRequests.length, "athlete request to review.", "athlete requests to review."),
      support: clients === 0 ? "No active clients yet." : `${count(clients, "active client", "active clients")}.`,
      primary: { kind: "review-athlete-request", label: "Review athlete request", invitationId: request.id },
    };
  }
  if (clients === 0) {
    return {
      statement: "No clients yet.",
      support:
        input.pendingInvitations > 0
          ? `${count(input.pendingInvitations, "invitation is", "invitations are")} waiting on the athlete.`
          : "An invitation needs the athlete's name and email.",
      primary: { kind: "invite-client", label: "Invite your first client" },
    };
  }
  return {
    statement: `${count(clients, "active client", "active clients")}.`,
    support:
      input.pendingInvitations > 0
        ? `${count(input.pendingInvitations, "invitation is", "invitations are")} waiting on the athlete.`
        : "No invitations outstanding.",
    primary: { kind: "invite-client", label: "Invite a client" },
  };
}

/* ─── Reviews ─────────────────────────────────────────────────────────── */

export function resolveReviewsBrief(input: CoachDecisionInput, reviewedCount: number): CoachBrief {
  const waiting = input.checkInsAwaiting;
  if (waiting.length > 0) {
    return {
      statement: `${count(waiting.length, "check-in", "check-ins")} waiting for review.`,
      support: `Newest first. ${reviewedCount > 0 ? `${reviewedCount} already reviewed.` : "None reviewed yet."}`,
      primary: { kind: "review-check-in", label: `Review ${first(waiting[0].athleteName)}'s check-in`, athleteId: waiting[0].athleteId, checkInId: waiting[0].id },
    };
  }
  if (input.activeClients.length === 0) {
    return {
      statement: "No check-ins yet.",
      support: "Check-ins arrive once a client connects and sends their week.",
      primary: null,
      noAction: "Nothing to review until a client connects.",
    };
  }
  return {
    statement: "Review queue is clear.",
    support: reviewedCount > 0 ? `${count(reviewedCount, "check-in", "check-ins")} reviewed.` : "No check-in has been sent yet.",
    primary: null,
    noAction: "New check-ins appear here the moment a client sends one.",
  };
}

/* ─── Live decisions ──────────────────────────────────────────────────── */

export function resolveLiveBrief(input: CoachDecisionInput, clientsWithADay: number): CoachBrief {
  const decisions = input.liveDecisions;
  const conflict = decisions.find((d) => d.kind === "conflict");
  const change = decisions.find((d) => d.kind === "change");
  if (conflict || change) {
    const target = (conflict ?? change)!;
    return {
      statement: `${count(decisions.length, "live-day decision", "live-day decisions")} waiting.`,
      support: conflict ? "Conflicts first: two versions of the same day." : "Changes the athlete proposed to today.",
      primary: conflict
        ? { kind: "resolve-conflict", label: `Resolve ${first(target.athleteName)}'s day`, athleteId: target.athleteId }
        : { kind: "review-live-change", label: `Review ${first(target.athleteName)}'s day`, athleteId: target.athleteId },
    };
  }
  if (input.activeClients.length === 0) {
    return {
      statement: "No live days yet.",
      support: "A live day starts when a connected client opens their day.",
      primary: null,
      noAction: "Nothing to decide until a client connects.",
    };
  }
  if (clientsWithADay === 0) {
    return {
      statement: "No live days yet.",
      support: "A live day starts when a client opens their day.",
      primary: null,
      noAction: "Nothing to decide until a client opens their day.",
    };
  }
  return {
    statement: "No live-day decision waiting.",
    support: `${count(clientsWithADay, "client has", "clients have")} a live day.`,
    primary: null,
    noAction: "Changes a client proposes appear here for your review.",
  };
}

/* ─── Alerts ──────────────────────────────────────────────────────────── */

export function resolveAlertsBrief(input: CoachDecisionInput, closedCount: number): CoachBrief {
  const open = input.openAlerts;
  if (open.length > 0) {
    return {
      statement: `${count(open.length, "open alert", "open alerts")}.`,
      support: "Most severe first. Each one comes from a client's own entries.",
      primary: { kind: "alert-action", label: open[0].actionLabel, alertId: open[0].id },
    };
  }
  return {
    statement: "No open alerts.",
    support: closedCount > 0 ? `${count(closedCount, "alert", "alerts")} handled.` : input.activeClients.length === 0 ? "Alerts need a connected client." : "Nothing flagged in your clients' entries.",
    primary: null,
    noAction: "Alerts appear when a client's entries call for a look.",
  };
}

/* ─── Messages ────────────────────────────────────────────────────────── */

export function resolveMessagesBrief(input: CoachDecisionInput, threadCount: number): CoachBrief {
  const unread = input.unreadThreads;
  if (unread.length > 0) {
    const total = unread.reduce((sum, t) => sum + t.unread, 0);
    return {
      statement: `${count(total, "unread message", "unread messages")}.`,
      support: `From ${count(unread.length, "client", "clients")}. Newest first.`,
      primary: { kind: "open-thread", label: `Reply to ${first(unread[0].athleteName)}`, threadId: unread[0].threadId },
    };
  }
  if (threadCount === 0) {
    return input.activeClients.length === 0
      ? {
          statement: "No conversations yet.",
          support: "A channel opens when an athlete accepts your invitation.",
          primary: { kind: "open-clients", label: "Invite a client" },
        }
      : {
          statement: "No conversations yet.",
          support: "A channel opens when a relationship becomes active.",
          primary: null,
          noAction: "Nothing to open yet.",
        };
  }
  return {
    statement: "No unread messages.",
    support: `${count(threadCount, "conversation", "conversations")}.`,
    primary: null,
    noAction: "Pick a conversation to write in it.",
  };
}

/* ─── Plans (Programs · Nutrition · Schedules) ────────────────────────── */

export type PlanBriefInput = {
  category: PrescriptionCategory;
  plans: Array<{ id: string; athleteId: string; athleteName: string; title: string; status: string }>;
  /** Active clients who granted at least suggest access for this category. */
  clientsWithAccess: number;
};

export function resolvePlansBrief({ category, plans, clientsWithAccess }: PlanBriefInput): CoachBrief {
  const noun = PLAN_NOUN[category];
  const revise = plans.find((p) => p.status === "revision_requested" || p.status === "rejected");
  if (revise) {
    return {
      statement: `${first(revise.athleteName)} asked for changes.`,
      support: `“${revise.title}” needs a revision before it can go back.`,
      primary: { kind: "revise-plan", label: "Create revision", athleteId: revise.athleteId, prescriptionId: revise.id, category },
    };
  }
  const ready = plans.find((p) => p.status === "ready_for_review");
  if (ready) {
    return {
      statement: `A ${noun.one} is ready to send.`,
      support: `“${ready.title}” for ${ready.athleteName}.`,
      primary: { kind: "send-plan", label: "Send for approval", prescriptionId: ready.id },
    };
  }
  const draft = plans.find((p) => p.status === "draft");
  if (draft) {
    return {
      statement: `A ${noun.one} draft is open.`,
      support: `“${draft.title}” for ${draft.athleteName}.`,
      primary: { kind: "finish-draft", label: "Finish draft", athleteId: draft.athleteId, prescriptionId: draft.id, category },
    };
  }
  const awaiting = plans.filter((p) => p.status === "sent").length;
  const active = plans.filter((p) => p.status === "active" || p.status === "accepted").length;
  if (plans.length === 0) {
    if (clientsWithAccess === 0) {
      return {
        statement: `No ${noun.many} yet.`,
        support: `A ${noun.one} needs a client who granted ${category} access.`,
        primary: null,
        noAction: `No client has granted ${category} access yet.`,
      };
    }
    return {
      statement: `No ${noun.many} yet.`,
      support: `${count(clientsWithAccess, "client allows", "clients allow")} ${category} plans.`,
      primary: { kind: "create-plan", label: `Draft a ${noun.one}`, category },
    };
  }
  return {
    statement: awaiting > 0 ? `${count(awaiting, noun.one, noun.many)} waiting on athletes.` : `${count(active, `active ${noun.one}`, `active ${noun.many}`)}.`,
    support: `${count(plans.length, noun.one, noun.many)} in total, newest first.`,
    primary: clientsWithAccess > 0 ? { kind: "create-plan", label: `Draft a ${noun.one}`, category } : null,
    noAction: clientsWithAccess > 0 ? undefined : `No client has granted ${category} access.`,
  };
}

/* ─── Templates ───────────────────────────────────────────────────────── */

export function resolveTemplatesBrief(activeTemplates: number, archivedTemplates: number): CoachBrief {
  return activeTemplates === 0
    ? {
        statement: "No templates yet.",
        support: archivedTemplates > 0 ? `${count(archivedTemplates, "template is", "templates are")} archived.` : "A template is a plan you can reuse for any client.",
        primary: { kind: "create-template", label: "Create template" },
      }
    : {
        statement: `${count(activeTemplates, "template", "templates")} ready to reuse.`,
        support: archivedTemplates > 0 ? `${archivedTemplates} archived.` : "Assigning one opens a draft for that client.",
        primary: { kind: "create-template", label: "Create template" },
      };
}

/* ─── One client ──────────────────────────────────────────────────────── */

export type ClientBriefInput = {
  name: string;
  relationshipStatus: string;
  liveDecision: "conflict" | "change" | null;
  checkInAwaiting: { id: string } | null;
  planToRevise: { id: string; title: string; category: PrescriptionCategory } | null;
  threadId: string | null;
  canMessage: boolean;
  unread: number;
};

export function resolveClientBrief(input: ClientBriefInput, athleteId: string): CoachBrief {
  const name = first(input.name);
  if (input.relationshipStatus !== "active") {
    return {
      statement: `Coaching is ${input.relationshipStatus}.`,
      support: `Nothing new reaches you from ${name} until coaching is active again.`,
      primary: null,
      noAction: "Change the status to Active to coach again.",
    };
  }
  if (input.liveDecision === "conflict") {
    return { statement: "Today has two versions.", support: "Both are kept. Choose which one becomes the live plan.", primary: { kind: "resolve-conflict", label: "Resolve today", athleteId } };
  }
  if (input.liveDecision === "change") {
    return { statement: `${name} changed today's plan.`, support: "Review the change before it goes live.", primary: { kind: "review-live-change", label: "Review the change", athleteId } };
  }
  if (input.checkInAwaiting) {
    return {
      statement: "A check-in is waiting for review.",
      support: `Sent by ${name}. Your review note reaches them when you finish.`,
      primary: { kind: "review-check-in", label: "Review check-in", athleteId, checkInId: input.checkInAwaiting.id },
    };
  }
  if (input.planToRevise) {
    return {
      statement: `${name} asked for changes.`,
      support: `“${input.planToRevise.title}” needs a revision.`,
      primary: { kind: "revise-plan", label: "Create revision", athleteId, prescriptionId: input.planToRevise.id, category: input.planToRevise.category },
    };
  }
  if (input.unread > 0 && input.threadId && input.canMessage) {
    return { statement: count(input.unread, "unread message.", "unread messages."), support: `From ${name}.`, primary: { kind: "open-thread", label: `Reply to ${name}`, threadId: input.threadId } };
  }
  return {
    statement: "No decision waiting.",
    support: `${name} is on plan. New check-ins and live changes appear here.`,
    primary: input.threadId && input.canMessage ? { kind: "open-thread", label: `Message ${name}`, threadId: input.threadId } : null,
    noAction: input.threadId && input.canMessage ? undefined : "No message channel is open with this client.",
  };
}

/* ─── Building the input from the coaching snapshot ───────────────────── */

const SEVERITY_RANK: Record<ClientAlert["severity"], number> = { urgent: 0, priority: 1, attention: 2, info: 3 };

export function buildCoachDecisionInput(
  db: CoachingDatabase,
  clients: ClientSummary[],
  alerts: ClientAlert[],
  actorId: string,
): CoachDecisionInput {
  const active = clients.filter((c) => c.status === "active");
  const nameOf = (athleteId: string) =>
    clients.find((c) => c.athleteId === athleteId)?.name ?? db.members.find((m) => m.id === athleteId)?.name ?? "Client";
  const activeIds = new Set(active.map((c) => c.athleteId));

  const reviewed = (reviewId: string | undefined | null) =>
    Boolean(reviewId && db.reviews.some((r) => r.id === reviewId && r.completedAt));

  const checkInsAwaiting = db.checkIns
    .filter((c) => activeIds.has(c.athleteId) && !reviewed(c.reviewId))
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
    .map((c) => ({ id: c.id, athleteId: c.athleteId, athleteName: nameOf(c.athleteId), weekOf: c.weekOf }));

  const liveDecisions: CoachDecisionInput["liveDecisions"] = [];
  for (const client of active) {
    const day = db.activeDayPlans
      .filter((p) => p.athleteId === client.athleteId)
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    if (!day) continue;
    if (day.status === "conflict") {
      liveDecisions.push({ athleteId: client.athleteId, athleteName: client.name, kind: "conflict" });
    } else if (day.status === "awaiting_approval") {
      const pending = db.liveDayOverrides.find((o) => o.id === day.activeOverrideId && o.status === "proposed");
      /* A change the coach proposed waits on the athlete, not on the coach. */
      if (pending && pending.source !== "coach") {
        liveDecisions.push({ athleteId: client.athleteId, athleteName: client.name, kind: "change" });
      }
    }
  }

  const plansToRevise = db.prescriptions
    .filter((p) => p.coachId === actorId && activeIds.has(p.athleteId) && (p.status === "revision_requested" || p.status === "rejected"))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((p) => ({ id: p.id, athleteId: p.athleteId, athleteName: nameOf(p.athleteId), title: p.title, category: p.category }));

  const athleteRequests = db.invitations
    .filter((i) => i.coachId === actorId && i.direction === "athlete_to_coach" && (i.status === "sent" || i.status === "viewed"))
    .map((i) => ({ id: i.id, athleteName: i.athleteName }));
  const pendingInvitations = db.invitations.filter(
    (i) => i.coachId === actorId && i.direction !== "athlete_to_coach" && (i.status === "sent" || i.status === "viewed"),
  ).length;

  const unreadThreads = db.conversations
    .filter((t) => t.coachId === actorId)
    .map((t) => {
      const rel = db.relationships.find((r) => r.id === t.relationshipId);
      const unread = db.messages.filter(
        (m) => m.threadId === t.id && m.senderId !== actorId && m.sentAt > (t.lastReadAt[actorId] ?? ""),
      ).length;
      return { t, rel, unread };
    })
    .filter(({ rel, unread }) => unread > 0 && rel && rel.status !== "revoked" && rel.status !== "archived")
    .sort((a, b) => (b.t.lastMessageAt ?? "").localeCompare(a.t.lastMessageAt ?? ""))
    .map(({ t, unread }) => ({ threadId: t.id, athleteName: nameOf(t.athleteId), unread }));

  const openAlerts = alerts
    .filter((a) => a.status === "open" && a.severity !== "info")
    .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity])
    .map((a) => ({ id: a.id, athleteId: a.athleteId, headline: a.headline, actionLabel: a.recommendedAction.label }));

  return {
    activeClients: active.map((c) => ({ athleteId: c.athleteId, name: c.name })),
    pendingInvitations,
    athleteRequests,
    checkInsAwaiting,
    liveDecisions: liveDecisions.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "conflict" ? -1 : 1)),
    plansToRevise,
    unreadThreads,
    openAlerts,
  };
}
