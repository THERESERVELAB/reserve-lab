import { describe, expect, it } from "vitest";

import {
  FULL_ACCESS_PERMISSIONS,
  NO_ACCESS_PERMISSIONS,
  clonePermissions,
} from "@/lib/coaching/permissions";
import type { CoachingPermissions, CoachingRelationship, RelationshipStatus } from "@/lib/coaching/types";

import {
  approvalRequirementFor,
  isAuthoredMode,
  resolveProgramOwnership,
  resolveWhiteGloveAthlete,
  sensitiveItemLabel,
  type OwnershipResolutionInput,
  type ProgramOwnershipMode,
} from "../operating-mode";

/* ─── Helpers ─────────────────────────────────────────────────────────── */

function relationship(
  overrides: {
    status?: RelationshipStatus;
    permissions?: CoachingPermissions;
    id?: string;
  } = {},
): CoachingRelationship {
  return {
    id: overrides.id ?? "rel-1",
    coachId: "coach-1",
    athleteId: "athlete-1",
    status: overrides.status ?? "active",
    permissions: overrides.permissions ?? clonePermissions(FULL_ACCESS_PERMISSIONS),
    overrideAuthority: "coach_suggests",
    startedAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    initiatedBy: "coach",
  };
}

function ownershipInput(over: Partial<OwnershipResolutionInput> = {}): OwnershipResolutionInput {
  return {
    programOperatingMode: null,
    activeProgramSource: null,
    relationship: null,
    persistedMode: null,
    ...over,
  };
}

function viewOnlyTraining(): CoachingPermissions {
  return { ...clonePermissions(NO_ACCESS_PERMISSIONS), training: "view" };
}

function suggestTraining(): CoachingPermissions {
  return { ...clonePermissions(NO_ACCESS_PERMISSIONS), training: "suggest" };
}

/* ═══ Mode derivation ════════════════════════════════════════════════════ */

describe("operating mode derivation", () => {
  it("resolves reserve-designed from a reserve-managed program", () => {
    const r = resolveProgramOwnership(
      ownershipInput({ programOperatingMode: "reserve-managed" }),
    );
    expect(r.mode).toBe("reserve-designed");
  });

  it("resolves member-custom from a member-managed program", () => {
    const r = resolveProgramOwnership(ownershipInput({ programOperatingMode: "member-managed" }));
    expect(r.mode).toBe("member-custom");
  });

  it("resolves reserve-assisted from a hybrid program", () => {
    const r = resolveProgramOwnership(ownershipInput({ programOperatingMode: "hybrid" }));
    expect(r.mode).toBe("reserve-assisted");
  });

  it("treats a member-custom horizon source as authorship evidence", () => {
    const r = resolveProgramOwnership(
      ownershipInput({ programOperatingMode: null, activeProgramSource: "member-custom" }),
    );
    expect(r.mode).toBe("member-custom");
  });

  it("promotes a member-authored protocol to reserve-assisted when review is enabled", () => {
    const r = resolveProgramOwnership(
      ownershipInput({ programOperatingMode: "member-managed", assistedReviewEnabled: true }),
    );
    expect(r.mode).toBe("reserve-assisted");
  });

  it("defaults to reserve-designed with no program recorded, and says so", () => {
    const r = resolveProgramOwnership(ownershipInput());
    expect(r.mode).toBe("reserve-designed");
    expect(r.assumptions.join(" ")).toContain("No active program recorded");
  });
});

/* ═══ Coach authorship ═══════════════════════════════════════════════════ */

describe("coach authorship", () => {
  it("resolves coach-authored when the coach manages training", () => {
    const r = resolveProgramOwnership(
      ownershipInput({ programOperatingMode: "reserve-managed", relationship: relationship() }),
    );
    expect(r.mode).toBe("coach-authored");
    expect(r.coachRelationshipId).toBe("rel-1");
  });

  it("resolves coach-assisted when the coach may only suggest training", () => {
    const r = resolveProgramOwnership(
      ownershipInput({
        programOperatingMode: "reserve-managed",
        relationship: relationship({ permissions: suggestTraining() }),
      }),
    );
    expect(r.mode).toBe("coach-assisted");
  });

  it("resolves coach-assisted for a view-only training coach", () => {
    const r = resolveProgramOwnership(
      ownershipInput({
        programOperatingMode: "reserve-managed",
        relationship: relationship({ permissions: viewOnlyTraining() }),
      }),
    );
    expect(r.mode).toBe("coach-assisted");
  });

  it("never makes a coach the author without any training permission", () => {
    const r = resolveProgramOwnership(
      ownershipInput({
        programOperatingMode: "reserve-managed",
        relationship: relationship({ permissions: clonePermissions(NO_ACCESS_PERMISSIONS) }),
      }),
    );
    expect(r.mode).toBe("reserve-designed");
    expect(r.coachRelationshipId).toBeNull();
    expect(r.assumptions.join(" ")).toContain("no training permission");
  });

  it.each<RelationshipStatus>(["pending", "paused", "archived", "revoked"])(
    "ignores a %s relationship for authorship",
    (status) => {
      const r = resolveProgramOwnership(
        ownershipInput({
          programOperatingMode: "reserve-managed",
          relationship: relationship({ status }),
        }),
      );
      expect(r.mode).toBe("reserve-designed");
      expect(r.assumptions.join(" ")).toContain(status);
    },
  );

  it("lets coach authority outrank the member's program-surface toggle", () => {
    const r = resolveProgramOwnership(
      ownershipInput({ programOperatingMode: "member-managed", relationship: relationship() }),
    );
    expect(r.mode).toBe("coach-authored");
  });
});

/* ═══ Authorship protection — the non-negotiable ═════════════════════════ */

describe("authorship protection", () => {
  it("never silently converts member-custom to reserve-designed", () => {
    const r = resolveProgramOwnership(
      ownershipInput({ programOperatingMode: "reserve-managed", persistedMode: "member-custom" }),
    );
    expect(r.mode).toBe("member-custom");
    expect(r.derivedMode).toBe("reserve-designed");
    expect(r.authorshipProtected).toBe(true);
  });

  it("never silently converts coach-authored to reserve-designed when the coach leaves", () => {
    const r = resolveProgramOwnership(
      ownershipInput({
        programOperatingMode: "reserve-managed",
        relationship: relationship({ status: "revoked" }),
        persistedMode: "coach-authored",
      }),
    );
    expect(r.mode).toBe("coach-authored");
    expect(r.authorshipProtected).toBe(true);
    expect(r.assumptions.join(" ")).toContain("no longer active");
  });

  it("allows an explicit owner change to drop authorship", () => {
    const r = resolveProgramOwnership(
      ownershipInput({
        programOperatingMode: "reserve-managed",
        persistedMode: "member-custom",
        explicitModeChange: "reserve-designed",
      }),
    );
    expect(r.mode).toBe("reserve-designed");
    expect(r.authorshipProtected).toBe(false);
  });

  it("does not flag protection when derivation keeps authorship", () => {
    const r = resolveProgramOwnership(
      ownershipInput({ programOperatingMode: "member-managed", persistedMode: "member-custom" }),
    );
    expect(r.mode).toBe("member-custom");
    expect(r.authorshipProtected).toBe(false);
  });

  it("classifies only human-authored modes as authored", () => {
    expect(isAuthoredMode("member-custom")).toBe(true);
    expect(isAuthoredMode("coach-authored")).toBe(true);
    expect(isAuthoredMode("reserve-designed")).toBe(false);
    expect(isAuthoredMode("reserve-assisted")).toBe(false);
    expect(isAuthoredMode("coach-assisted")).toBe(false);
  });
});

/* ═══ White-glove resolution ═════════════════════════════════════════════ */

describe("white-glove athlete resolution", () => {
  it("reports missing requirements instead of inventing values", () => {
    const r = resolveWhiteGloveAthlete({
      athleteId: "athlete-1",
      ownership: ownershipInput(),
      onboardingComplete: false,
    });
    expect(r.missingRequirements).toEqual(
      expect.arrayContaining([
        "onboarding-incomplete",
        "no-active-program",
        "no-program-horizon",
        "no-current-week",
      ]),
    );
    expect(r.currentWeek).toBeUndefined();
    expect(r.intelligence.confidence).toBe("insufficient");
  });

  it("carries the resolved operating mode and coach relationship through", () => {
    const r = resolveWhiteGloveAthlete({
      athleteId: "athlete-1",
      ownership: ownershipInput({
        programOperatingMode: "reserve-managed",
        relationship: relationship(),
      }),
      activeProgramId: "prog-1",
      activeHorizonId: "hz-1",
      currentWeek: 4,
      currentPhase: "accumulation",
      confidence: "moderate",
    });
    expect(r.operatingMode).toBe("coach-authored");
    expect(r.coaching.coachRelationshipId).toBe("rel-1");
    expect(r.missingRequirements).toHaveLength(0);
  });

  it("defaults health context to unauthorized", () => {
    const r = resolveWhiteGloveAthlete({
      athleteId: "athlete-1",
      ownership: ownershipInput({ relationship: relationship() }),
    });
    expect(r.healthContext.authorized).toBe(false);
    expect(r.healthContext.sensitiveDisplayMode).toBe("full");
  });
});

/* ═══ Sensitive display ══════════════════════════════════════════════════ */

describe("sensitive display mode", () => {
  it("shows the real label only in full mode", () => {
    expect(sensitiveItemLabel("full", "Testosterone cypionate")).toEqual({
      visible: true,
      label: "Testosterone cypionate",
    });
  });

  it("replaces the label in discreet mode", () => {
    const r = sensitiveItemLabel("discreet", "Testosterone cypionate");
    expect(r.visible).toBe(true);
    expect(r.label).toBe("Private reminder");
    expect(r.label).not.toContain("Testosterone");
  });

  it("hides the item entirely when hidden-on-dashboard", () => {
    const r = sensitiveItemLabel("hidden-on-dashboard", "Testosterone cypionate");
    expect(r.visible).toBe(false);
    expect(r.label).toBe("");
  });
});

/* ═══ Approval policy ════════════════════════════════════════════════════ */

describe("material change approval", () => {
  const modes: ProgramOwnershipMode[] = [
    "reserve-designed",
    "member-custom",
    "reserve-assisted",
    "coach-authored",
    "coach-assisted",
  ];

  it.each(modes)("never auto-applies a material change in %s", (mode) => {
    const r = approvalRequirementFor(mode, "material", "established");
    expect(r.mayAutoApply).toBe(false);
    expect(r.requiresAthleteApproval || r.requiresCoachReview).toBe(true);
  });

  it("routes material coach-mode changes to coach review", () => {
    const r = approvalRequirementFor("coach-authored", "material", "established");
    expect(r.requiresCoachReview).toBe(true);
  });

  it("never auto-applies anything to a member-custom protocol", () => {
    for (const materiality of ["informational", "low-risk", "material"] as const) {
      expect(approvalRequirementFor("member-custom", materiality, "established").mayAutoApply).toBe(
        false,
      );
    }
  });

  it("blocks low-confidence evidence from applying a low-risk change", () => {
    const r = approvalRequirementFor("reserve-designed", "low-risk", "emerging");
    expect(r.mayAutoApply).toBe(false);
    expect(r.reason).toContain("confidence");
  });

  it("allows informational observations to surface with established evidence", () => {
    const r = approvalRequirementFor("reserve-designed", "informational", "established");
    expect(r.mayAutoApply).toBe(true);
  });
});
