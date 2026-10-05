import { describe, expect, it } from "vitest";

import { MEMBER_ACCESS } from "../capabilities";
import { parseOwnerAllowlist, resolveAccess, type AccessInputs } from "../resolve-access";

const OWNER = "4f1c2b9e-8d7a-4c3b-9e1f-0a2b3c4d5e6f";
const OTHER = "11111111-2222-4333-8444-555555555555";
const base: AccessInputs = { verifiedUserId: null, ownerAllowlist: OWNER, devOwnerFlag: undefined, nodeEnv: "production", supabaseConfigured: true };

describe("owner allowlist", () => {
  it("accepts only UUIDs, trimmed and case-insensitive", () => {
    expect([...parseOwnerAllowlist(` ${OWNER.toUpperCase()} , owner@example.com, , not-a-uuid,${OTHER}`)]).toEqual([OWNER, OTHER]);
    expect(parseOwnerAllowlist(undefined).size).toBe(0);
    expect(parseOwnerAllowlist("").size).toBe(0);
  });
});

describe("resolveAccess", () => {
  it("1. makes a verified allowlisted user the owner", () => {
    expect(resolveAccess({ ...base, verifiedUserId: OWNER })).toMatchObject({ role: "owner", source: "allowlist" });
  });

  it("2. keeps every other verified user a member", () => {
    expect(resolveAccess({ ...base, verifiedUserId: OTHER })).toBe(MEMBER_ACCESS);
  });

  it("8. is a member when signed out or when no allowlist is set", () => {
    expect(resolveAccess(base)).toBe(MEMBER_ACCESS);
    expect(resolveAccess({ ...base, verifiedUserId: OWNER, ownerAllowlist: undefined })).toBe(MEMBER_ACCESS);
  });

  it("3. never honors the dev owner flag in production or when Supabase is configured", () => {
    expect(resolveAccess({ ...base, devOwnerFlag: "true", nodeEnv: "production", supabaseConfigured: false })).toBe(MEMBER_ACCESS);
    expect(resolveAccess({ ...base, devOwnerFlag: "true", nodeEnv: "development", supabaseConfigured: true })).toBe(MEMBER_ACCESS);
    expect(resolveAccess({ ...base, devOwnerFlag: "1", nodeEnv: "development", supabaseConfigured: false })).toBe(MEMBER_ACCESS);
    expect(resolveAccess({ ...base, devOwnerFlag: "true", nodeEnv: "development", supabaseConfigured: false })).toMatchObject({ role: "owner", source: "dev-owner" });
  });
});
