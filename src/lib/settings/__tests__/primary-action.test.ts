import { describe, expect, it } from "vitest";

import { resolveSettingsPrimaryAction, type SettingsPrimaryInput } from "../primary-action";

function plan(over: Partial<SettingsPrimaryInput> = {}) {
  return resolveSettingsPrimaryAction({
    signedIn: true,
    syncStatus: "saved",
    age: 34,
    name: "Jordan",
    ...over,
  });
}

describe("resolveSettingsPrimaryAction", () => {
  it("puts a failed sync ahead of everything, even a missing age", () => {
    const result = plan({ syncStatus: "error", age: undefined, name: "" });
    expect(result.primary).toEqual({ kind: "review-sync", label: "Review Sync", section: "data" });
    expect(result.statement).toMatch(/not reached your account/);
  });

  it("sends an offline member to sync without claiming anything was saved", () => {
    const result = plan({ syncStatus: "offline" });
    expect(result.primary.kind).toBe("review-sync");
    expect(result.statement).toBe("You are offline. Changes are held on this device.");
  });

  it("ignores sync state in local mode, where there is no cloud to fail", () => {
    const result = plan({ signedIn: false, syncStatus: "error" });
    expect(result.primary.kind).toBe("open-personal-command");
    expect(result.support).toMatch(/^Your data is stored on this device only\./);
  });

  it("asks for the age first when it is missing", () => {
    const result = plan({ age: undefined, name: "" });
    expect(result.primary).toEqual({ kind: "add-age", label: "Add Your Age", section: "profile" });
    expect(result.profileDetails).toEqual({ have: 0, need: 2 });
  });

  it("treats a zero or non-finite age as missing rather than as an age", () => {
    expect(plan({ age: 0 }).primary.kind).toBe("add-age");
    expect(plan({ age: Number.NaN }).primary.kind).toBe("add-age");
  });

  it("asks for the name once the age is set", () => {
    const result = plan({ name: "   " });
    expect(result.primary.kind).toBe("add-name");
    expect(result.profileDetails).toEqual({ have: 1, need: 2 });
  });

  it("points to Personal Command when the account is in order", () => {
    const result = plan();
    expect(result.primary).toEqual({ kind: "open-personal-command", label: "Open Personal Command" });
    expect(result.statement).toBe("Your profile is complete.");
    expect(result.support).toMatch(/^Your account is saved\./);
    expect(result.profileDetails).toEqual({ have: 2, need: 2 });
  });

  it("only says saved when the sync store confirmed it", () => {
    expect(plan({ syncStatus: "saving" }).support).toMatch(/^Your account is syncing\./);
    expect(plan({ syncStatus: "local-only" }).support).toMatch(/^Your data is stored on this device only\./);
  });
});
