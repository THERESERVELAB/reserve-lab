import { describe, expect, it } from "vitest";

import { resolveMyCoachPrimaryAction, type MyCoachPrimaryInput } from "../primary-action";

function plan(over: Partial<MyCoachPrimaryInput> = {}) {
  return resolveMyCoachPrimaryAction({
    coachName: null,
    pendingInvitations: 0,
    outgoingRequests: 0,
    plansAwaitingApproval: 0,
    checkInSubmitted: false,
    hasChannel: false,
    ...over,
  });
}

describe("resolveMyCoachPrimaryAction", () => {
  it("says plainly that no coach is connected and offers the connection", () => {
    const result = plan();
    expect(result.connection).toBe("none");
    expect(result.statement).toBe("No coach is connected.");
    expect(result.primary).toEqual({ kind: "connect", label: "Connect With a Coach" });
  });

  it("offers no gold action while the member's own request waits on a coach", () => {
    const result = plan({ outgoingRequests: 1 });
    expect(result.connection).toBe("requested");
    expect(result.primary).toBeNull();
  });

  it("puts a coach's request first, and says nothing is shared yet", () => {
    const result = plan({ pendingInvitations: 1, outgoingRequests: 1 });
    expect(result.connection).toBe("invited");
    expect(result.primary?.kind).toBe("review-invitation");
    expect(result.support).toMatch(/Nothing is shared/);
  });

  it("counts several coach requests", () => {
    expect(plan({ pendingInvitations: 2 }).statement).toBe("2 coaches have asked to connect with you.");
  });

  it("reviews a waiting plan before the check-in", () => {
    const result = plan({ coachName: "Morgan Reyes", plansAwaitingApproval: 2 });
    expect(result.statement).toBe("Connected to Morgan Reyes.");
    expect(result.primary?.kind).toBe("review-plan");
    expect(result.support).toMatch(/^2 plans are waiting/);
  });

  it("asks for this week's check-in, naming adherence as the only required part", () => {
    const result = plan({ coachName: "Morgan Reyes" });
    expect(result.primary).toEqual({ kind: "start-check-in", label: "Start Weekly Check-In" });
    expect(result.support).toMatch(/Adherence is required/);
  });

  it("moves to the channel once the check-in is in", () => {
    expect(plan({ coachName: "Morgan Reyes", checkInSubmitted: true, hasChannel: true }).primary?.kind).toBe("message-coach");
  });

  it("falls back to access control when there is no channel", () => {
    expect(plan({ coachName: "Morgan Reyes", checkInSubmitted: true }).primary?.kind).toBe("manage-access");
  });
});
