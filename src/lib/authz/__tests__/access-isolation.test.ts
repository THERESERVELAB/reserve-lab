import { beforeEach, describe, expect, it } from "vitest";

import { hydrateMemberState, resetMemberStateToDefaults, serializeMemberState, useAthleteDashboardStore } from "@/lib/athlete-store";
import { PRIVATE_DEVICE_KEYS } from "@/lib/auth/device-isolation";
import { MEMBER_ACCESS, parseAccessResponse } from "@/lib/authz/capabilities";
import { MEMBER_STATE_KEYS } from "@/lib/sync/state-contract";

/**
 * Owner access lives only in the server's answer, held in memory. It is never
 * member data: never persisted, synced, restored from a device, or part of the
 * default member experience.
 */

const ACCESS_KEY = /^(role|roles|isOwner|ownerMode|ownerModeEnabled|capabilities|access|privileges?)$/i;
const FORGED = { role: "owner", isOwner: true, ownerModeEnabled: true, capabilities: ["review-pending-safety-tools", "owner-research-tools"] };

beforeEach(() => {
  resetMemberStateToDefaults();
});

describe("owner access stays out of member data", () => {
  it("4. is never a persisted, synced or device key", () => {
    expect(MEMBER_STATE_KEYS.filter((key) => ACCESS_KEY.test(key))).toEqual([]);
    expect(PRIVATE_DEVICE_KEYS.filter((key) => /owner|capabilit|role/i.test(key))).toEqual([]);
  });

  it("3. forged owner fields in saved or synced member state grant nothing and never sync", () => {
    // Hydration may carry unknown top-level keys in memory; nothing reads them for access.
    hydrateMemberState(FORGED);
    const state = useAthleteDashboardStore.getState() as unknown as Record<string, unknown>;
    expect(parseAccessResponse(state)).toBe(MEMBER_ACCESS);
    expect(parseAccessResponse({ ...state, source: "allowlist" })).toMatchObject({ role: "owner" });
    expect(Object.keys(serializeMemberState()).filter((key) => ACCESS_KEY.test(key))).toEqual([]);
  });

  it("8. the default member experience carries no access state", () => {
    const initial = useAthleteDashboardStore.getInitialState() as unknown as Record<string, unknown>;
    expect(Object.keys(initial).filter((key) => ACCESS_KEY.test(key))).toEqual([]);
  });
});
