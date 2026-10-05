/* ════════════════════════════════════════════════════════════════════════
   MY COACH PRIMARY ACTION — the athlete side of a coaching connection.

   The connection state is read from the coaching data layer, never assumed:

     none       no coach, no request either way
     requested  the member asked a coach to connect; the coach has not answered
     invited    a coach asked to connect; the member has not answered
     connected  an active relationship

   The one gold action follows what the member can actually do next:

     invited                         → review the request (nothing is shared yet)
     connected · plan awaiting you   → review the coach's plan
     connected · check-in not sent   → start this week's check-in
     connected · a channel exists    → message the coach
     connected · no channel          → manage the coach's access
     requested                       → nothing to do but wait: no gold action
     none                            → connect with a coach

   Coaching is training, nutrition structure, scheduling and accountability.
   Nothing here is clinical. Pure: no React, no store.
   ════════════════════════════════════════════════════════════════════════ */

export type CoachConnection = "none" | "requested" | "invited" | "connected";

export type MyCoachPrimaryAction =
  | { kind: "connect"; label: string }
  | { kind: "review-invitation"; label: string }
  | { kind: "review-plan"; label: string }
  | { kind: "start-check-in"; label: string }
  | { kind: "message-coach"; label: string }
  | { kind: "manage-access"; label: string };

export type MyCoachPrimaryInput = {
  /** Name of the connected coach, when a relationship is active. */
  coachName: string | null;
  /** Coach-to-athlete invitations still waiting on the member. */
  pendingInvitations: number;
  /** Member-to-coach requests still waiting on a coach. */
  outgoingRequests: number;
  /** Coach plans sent to the member and not yet accepted or declined. */
  plansAwaitingApproval: number;
  /** Whether this week's check-in has reached the coach. */
  checkInSubmitted: boolean;
  /** Whether the relationship has a message channel. */
  hasChannel: boolean;
};

export type MyCoachPrimaryPlan = {
  connection: CoachConnection;
  statement: string;
  support: string;
  /** Null only while a member's own request is with a coach: there is nothing to do but wait. */
  primary: MyCoachPrimaryAction | null;
};

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

export function resolveMyCoachPrimaryAction(input: MyCoachPrimaryInput): MyCoachPrimaryPlan {
  const { coachName, pendingInvitations, outgoingRequests, plansAwaitingApproval, checkInSubmitted, hasChannel } = input;

  /* A coach's request comes first even beside an active coach: it is the one
     place something could be shared, and nothing is until the member decides. */
  if (pendingInvitations > 0) {
    return {
      connection: coachName ? "connected" : "invited",
      statement:
        pendingInvitations === 1
          ? "A coach has asked to connect with you."
          : `${plural(pendingInvitations, "coach has", "coaches have")} asked to connect with you.`,
      support: "Nothing is shared until you review the request and choose exactly what the coach can see.",
      primary: { kind: "review-invitation", label: "Review Coach Request" },
    };
  }

  if (coachName) {
    const connected = `Connected to ${coachName}.`;
    if (plansAwaitingApproval > 0) {
      return {
        connection: "connected",
        statement: connected,
        support: `${plural(plansAwaitingApproval, "plan is", "plans are")} waiting for your approval. Nothing changes until you accept.`,
        primary: { kind: "review-plan", label: "Review Coach Plan" },
      };
    }
    if (!checkInSubmitted) {
      return {
        connection: "connected",
        statement: connected,
        support: "This week's check-in has not been sent. Adherence is required; everything else is optional.",
        primary: { kind: "start-check-in", label: "Start Weekly Check-In" },
      };
    }
    if (hasChannel) {
      return {
        connection: "connected",
        statement: connected,
        support: "This week's check-in is with your coach. Questions go through your channel.",
        primary: { kind: "message-coach", label: "Message Your Coach" },
      };
    }
    return {
      connection: "connected",
      statement: connected,
      support: "This week's check-in is with your coach. You control what they can see.",
      primary: { kind: "manage-access", label: "Manage Coach Access" },
    };
  }

  if (outgoingRequests > 0) {
    return {
      connection: "requested",
      statement: "Your request is with the coach.",
      support: "Both sides must approve before anything connects. There is nothing to do until the coach answers.",
      primary: null,
    };
  }

  return {
    connection: "none",
    statement: "No coach is connected.",
    support: "Enter a code, email or handle from your coach. Both sides approve, and you choose what they can see.",
    primary: { kind: "connect", label: "Connect With a Coach" },
  };
}
