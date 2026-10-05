import { beforeEach, describe, expect, it } from "vitest";

import {
  hydrateMemberState,
  resetMemberStateToDefaults,
  serializeMemberState,
  useAthleteDashboardStore,
} from "@/lib/athlete-store";
import { ONBOARDING_DRAFT_VERSION } from "@/lib/saas-config";
import { hasMeaningfulProgress } from "@/lib/sync/state-contract";

/**
 * Onboarding draft durability.
 *
 * The production failure these cover: the wizard held every answer in React
 * state and wrote to the store only on the final step, so a refresh returned
 * the member to Step 1 with nothing selected.
 */

const store = () => useAthleteDashboardStore.getState();
const draft = () => store().onboarding.draft;

beforeEach(() => {
  resetMemberStateToDefaults();
});

describe("onboarding draft — persistence", () => {
  it("writes partial answers immediately, long before the wizard completes", () => {
    store().saveOnboardingDraft({ genderIdentity: "male", currentChapter: "lifestyle-transformation" });

    expect(draft()?.answers).toMatchObject({
      genderIdentity: "male",
      currentChapter: "lifestyle-transformation",
    });
    expect(store().onboarding.status).toBe("in-progress");
  });

  it("persists the current step across a remount", () => {
    store().saveOnboardingDraft({ genderIdentity: "male" }, 1);
    // A remount re-reads the store; nothing in React state survives.
    const restored = serializeMemberState().onboarding as { draft?: { step: number } };
    expect(restored.draft?.step).toBe(1);
  });

  it("keeps Step 1 selections after a remount", () => {
    store().saveOnboardingDraft({ genderIdentity: "male", currentChapter: "lifestyle-transformation" }, 1);
    const snapshot = serializeMemberState();

    resetMemberStateToDefaults(); // simulate a fresh page load
    expect(draft()).toBeNull();

    hydrateMemberState(snapshot);
    expect(draft()?.step).toBe(1);
    expect(draft()?.answers).toMatchObject({
      genderIdentity: "male",
      currentChapter: "lifestyle-transformation",
    });
  });

  it("persists partial Step 2 answers", () => {
    store().saveOnboardingDraft({ genderIdentity: "male" }, 1);
    store().saveOnboardingDraft({ genderIdentity: "male", healthNotes: "none" });
    expect(draft()?.answers).toMatchObject({ healthNotes: "none" });
    expect(draft()?.step).toBe(1);
  });

  it("a field edit never rewinds the member to an earlier step", () => {
    store().saveOnboardingDraft({ a: 1 }, 3);
    // Omitting the step is what the wizard's patch() does on every keystroke.
    store().saveOnboardingDraft({ a: 1, b: 2 });
    expect(draft()?.step).toBe(3);
  });

  it("records the new step when the member goes back", () => {
    store().saveOnboardingDraft({ a: 1 }, 3);
    store().saveOnboardingDraft({ a: 1 }, 2);
    expect(draft()?.step).toBe(2);
  });

  it("stamps every write with a fresh updatedAt for conflict resolution", async () => {
    store().saveOnboardingDraft({ a: 1 }, 0);
    const first = draft()!.updatedAt;
    await new Promise((r) => setTimeout(r, 5));
    store().saveOnboardingDraft({ a: 2 }, 0);
    expect(Date.parse(draft()!.updatedAt)).toBeGreaterThanOrEqual(Date.parse(first));
  });

  it("tags the draft with its shape version", () => {
    store().saveOnboardingDraft({ a: 1 }, 0);
    expect(draft()?.version).toBe(ONBOARDING_DRAFT_VERSION);
  });
});

describe("onboarding draft — cloud merge policy", () => {
  it("counts a partially-answered draft as real progress worth protecting", () => {
    store().saveOnboardingDraft({ genderIdentity: "male" }, 1);
    expect(hasMeaningfulProgress(serializeMemberState())).toBe(true);
  });

  it("does not count an empty draft as progress", () => {
    expect(hasMeaningfulProgress(serializeMemberState())).toBe(false);
    store().saveOnboardingDraft({}, 0);
    expect(hasMeaningfulProgress(serializeMemberState())).toBe(false);
  });

  it("lets hydrated cloud state replace a stale local draft", () => {
    store().saveOnboardingDraft({ genderIdentity: "male" }, 0);

    hydrateMemberState({
      onboarding: {
        status: "in-progress",
        currentStep: "welcome",
        completedSteps: [],
        startedAt: new Date().toISOString(),
        completedAt: null,
        draft: {
          step: 4,
          answers: { genderIdentity: "female", lifestyle: ["travel"] },
          version: ONBOARDING_DRAFT_VERSION,
          updatedAt: new Date().toISOString(),
        },
      },
    });

    expect(draft()?.step).toBe(4);
    expect(draft()?.answers).toMatchObject({ genderIdentity: "female" });
  });

  it("default state does not overwrite a hydrated draft", () => {
    hydrateMemberState({
      onboarding: {
        status: "in-progress",
        currentStep: "welcome",
        completedSteps: [],
        startedAt: null,
        completedAt: null,
        draft: {
          step: 2,
          answers: { genderIdentity: "male" },
          version: ONBOARDING_DRAFT_VERSION,
          updatedAt: new Date().toISOString(),
        },
      },
    });
    // Hydrating an unrelated slice must leave the draft intact.
    hydrateMemberState({ subscriptionTier: "pro" });
    expect(draft()?.step).toBe(2);
  });
});

describe("onboarding draft — lifecycle and isolation", () => {
  it("clears the draft once answers reach the canonical slices", () => {
    store().saveOnboardingDraft({ genderIdentity: "male" }, 2);
    store().clearOnboardingDraft();
    expect(draft()).toBeNull();
  });

  it("completing onboarding drops the draft in the same transactional write", () => {
    store().saveOnboardingDraft({ genderIdentity: "male" }, 7);
    store().writeOnboardingProfile({
      profile: { name: "Test Member" },
      completeOnboarding: true,
    });
    expect(store().onboarding.status).toBe("complete");
    expect(draft()).toBeNull();
  });

  it("logout-equivalent reset leaves no draft on the device", () => {
    store().saveOnboardingDraft({ genderIdentity: "male" }, 3);
    resetMemberStateToDefaults();
    expect(draft()).toBeNull();
  });

  it("a member with no draft starts clean at Step 1", () => {
    expect(draft()).toBeNull();
    expect(store().onboarding.status).toBe("not-started");
  });

  it("User B never inherits User A's draft after a reset boundary", () => {
    store().saveOnboardingDraft({ genderIdentity: "male", name: "User A" }, 5);
    const userA = serializeMemberState();

    // Account switch: the sync engine resets before hydrating the next member.
    resetMemberStateToDefaults();
    hydrateMemberState({
      onboarding: {
        status: "in-progress",
        currentStep: "welcome",
        completedSteps: [],
        startedAt: null,
        completedAt: null,
        draft: {
          step: 1,
          answers: { genderIdentity: "female", name: "User B" },
          version: ONBOARDING_DRAFT_VERSION,
          updatedAt: new Date().toISOString(),
        },
      },
    });

    expect(draft()?.answers).toMatchObject({ name: "User B" });
    expect(JSON.stringify(draft())).not.toContain("User A");
    expect((userA.onboarding as { draft: { step: number } }).draft.step).toBe(5);
  });
});

describe("onboarding draft — payload safety", () => {
  it("is carried by the synced member-state envelope", () => {
    store().saveOnboardingDraft({ genderIdentity: "male" }, 1);
    // `onboarding` is a MEMBER_STATE_KEY, so the draft rides the same envelope
    // that RLS already scopes to auth.uid() — no new table, no new policy.
    expect(serializeMemberState()).toHaveProperty("onboarding");
    expect((serializeMemberState().onboarding as { draft: unknown }).draft).not.toBeNull();
  });

  it("carries no credential-shaped values", () => {
    store().saveOnboardingDraft(
      { genderIdentity: "male", name: "Member", trainingDays: 4 },
      1,
    );
    const payload = JSON.stringify(serializeMemberState().onboarding);
    expect(payload).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}/); // JWT
    expect(payload).not.toMatch(/sb_secret_|service_role|sk-[A-Za-z0-9]{16,}/);
    expect(payload).not.toMatch(/password|access_token|refresh_token/i);
  });
});
