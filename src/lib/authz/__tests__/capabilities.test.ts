import { describe, expect, it } from "vitest";

import { CAPABILITIES, MEMBER_ACCESS, ROLE_CAPABILITIES, accessForRole, can, parseAccessResponse } from "../capabilities";

describe("capabilities", () => {
  it("gives the owner every capability and a member none", () => {
    const owner = accessForRole("owner", "allowlist");
    for (const capability of CAPABILITIES) {
      expect(can(owner, capability), capability).toBe(true);
      expect(can(MEMBER_ACCESS, capability), capability).toBe(false);
    }
    expect(ROLE_CAPABILITIES.member).toEqual([]);
  });

  it("treats missing access as a member", () => {
    expect(can(null, "review-pending-safety-tools")).toBe(false);
    expect(can(undefined, "owner-research-tools")).toBe(false);
  });

  it("never defines a capability that switches safety off", () => {
    for (const capability of CAPABILITIES) {
      expect(capability).not.toMatch(/bypass|disable|skip|silence|suppress|override|mute|hide-warning|no-safety/i);
    }
  });

  it("derives capabilities from a well-formed server answer and ignores anything forged", () => {
    expect(parseAccessResponse({ role: "owner", source: "allowlist", capabilities: [] })).toEqual(accessForRole("owner", "allowlist"));
    expect(parseAccessResponse({ role: "owner", source: "dev-owner" }).role).toBe("owner");
    expect(parseAccessResponse({ role: "member", source: "allowlist", capabilities: [...CAPABILITIES] })).toBe(MEMBER_ACCESS);
    expect(parseAccessResponse({ role: "owner", source: "client" })).toBe(MEMBER_ACCESS);
    expect(parseAccessResponse({ isOwner: true, ownerModeEnabled: true })).toBe(MEMBER_ACCESS);
    expect(parseAccessResponse(null)).toBe(MEMBER_ACCESS);
    expect(parseAccessResponse("owner")).toBe(MEMBER_ACCESS);
  });
});
