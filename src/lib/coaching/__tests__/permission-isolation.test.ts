/* ════════════════════════════════════════════════════════════════════════
   COACH PERMISSION ISOLATION.

   The coaching model already enforces most of this; these tests exist to
   PROVE it rather than assume it, and to fail loudly if a future change
   loosens a health boundary. They cover the guarantees a coach relationship
   must never break:

     - health access is off until the athlete explicitly turns it on
     - "full coaching access" is not a back door into clinical records
     - a coach reaches exactly one athlete: their client, and no one else
     - revocation stops access immediately without erasing history
   ════════════════════════════════════════════════════════════════════════ */

import { describe, expect, it } from "vitest";

import { DEMO_IDS, ensureDemoScenario } from "../fixtures";
import { ensureOperationsDemo } from "../operations/fixtures";
import { createOperationsRepositories } from "../operations/local";
import {
  DEFAULT_REQUESTED_PERMISSIONS,
  FULL_ACCESS_PERMISSIONS,
  NO_ACCESS_PERMISSIONS,
  canManage,
  canView,
  clonePermissions,
} from "../permissions";
import { createLocalRepositories } from "../repositories/local";
import { CoachingStore, MemoryAdapter } from "../storage";
import type { CoachingPermissions, ReserveMember } from "../types";

function scenario() {
  const adapter = new MemoryAdapter();
  const store = new CoachingStore(adapter);
  ensureDemoScenario(store);
  ensureOperationsDemo(store);
  return {
    store,
    repos: createLocalRepositories(store),
    ops: createOperationsRepositories(store),
  };
}

function addAthlete(store: CoachingStore, id: string): ReserveMember {
  const member: ReserveMember = {
    id,
    name: "Unrelated Athlete",
    email: `${id}@reserve.demo`,
    tier: "premium_personal",
    createdAt: new Date().toISOString(),
    isDemo: true,
  };
  store.write((db) => db.members.push(member));
  return member;
}

function relationshipFor(store: CoachingStore, athleteId: string) {
  const rel = store
    .read()
    .relationships.find((r) => r.coachId === DEMO_IDS.coach && r.athleteId === athleteId);
  if (!rel) throw new Error(`no relationship for ${athleteId}`);
  return rel;
}

/* ═══ Health defaults ════════════════════════════════════════════════════ */

describe("health access defaults", () => {
  it("grants no clinical access in the default requested permission set", () => {
    expect(DEFAULT_REQUESTED_PERMISSIONS.clinicalRecords).toBe("none");
    expect(DEFAULT_REQUESTED_PERMISSIONS.biomarkers).toBe("none");
  });

  it("keeps clinical records out of full coaching access", () => {
    // The single most important line in the permission model: an athlete
    // choosing "full access" must not be handing over clinical coordination.
    expect(FULL_ACCESS_PERMISSIONS.clinicalRecords).toBe("none");
  });

  it("grants nothing at all in the no-access preset", () => {
    for (const [category, level] of Object.entries(NO_ACCESS_PERMISSIONS)) {
      if (category === "physiquePhotos") continue;
      expect(level, `${category} should default to none`).toBe("none");
    }
    expect(NO_ACCESS_PERMISSIONS.physiquePhotos.access).toBe("none");
    expect(NO_ACCESS_PERMISSIONS.physiquePhotos.mayDownloadOriginals).toBe(false);
  });

  it("never lets a coach manage clinical records even with full access", () => {
    const rel = {
      id: "r",
      coachId: "c",
      athleteId: "a",
      status: "active" as const,
      permissions: clonePermissions(FULL_ACCESS_PERMISSIONS),
      overrideAuthority: "coach_suggests" as const,
      startedAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      initiatedBy: "coach" as const,
    };
    expect(canManage(rel, "clinicalRecords")).toBe(false);
    expect(canView(rel, "clinicalRecords")).toBe(false);
  });
});

/* ═══ Clinical consent gate ══════════════════════════════════════════════ */

describe("clinical records require explicit consent", () => {
  it("blocks a coach with full coaching access but no clinical consent", async () => {
    const { store, ops } = scenario();
    const rel = relationshipFor(store, DEMO_IDS.anthony);
    store.write((db) => {
      const target = db.relationships.find((r) => r.id === rel.id)!;
      target.permissions = clonePermissions(FULL_ACCESS_PERMISSIONS);
      // Remove any consent the demo scenario seeded.
      db.clinicalConsents = db.clinicalConsents.filter((c) => c.relationshipId !== rel.id);
    });

    await expect(ops.clinical.listRecords(DEMO_IDS.anthony, DEMO_IDS.coach)).rejects.toThrow(
      /clinical consent/i,
    );
  });

  it("lets the athlete read their own clinical records unconditionally", async () => {
    const { ops } = scenario();
    await expect(
      ops.clinical.listRecords(DEMO_IDS.anthony, DEMO_IDS.anthony),
    ).resolves.toBeDefined();
  });

  it("requires the acknowledgement before consent can change", async () => {
    const { store, ops } = scenario();
    const rel = relationshipFor(store, DEMO_IDS.anthony);
    await expect(
      ops.clinical.setConsent(rel.id, DEMO_IDS.anthony, "view", false),
    ).rejects.toThrow(/acknowledgement/i);
  });

  it("opens clinical reads only once consent and permission are both present", async () => {
    const { store, ops } = scenario();
    const rel = relationshipFor(store, DEMO_IDS.anthony);

    const withClinicalView: CoachingPermissions = {
      ...clonePermissions(FULL_ACCESS_PERMISSIONS),
      clinicalRecords: "view",
    };
    store.write((db) => {
      db.relationships.find((r) => r.id === rel.id)!.permissions = withClinicalView;
      db.clinicalConsents = db.clinicalConsents.filter((c) => c.relationshipId !== rel.id);
    });

    // Permission alone is not enough.
    await expect(ops.clinical.listRecords(DEMO_IDS.anthony, DEMO_IDS.coach)).rejects.toThrow();

    await ops.clinical.setConsent(rel.id, DEMO_IDS.anthony, "view", true);
    await expect(
      ops.clinical.listRecords(DEMO_IDS.anthony, DEMO_IDS.coach),
    ).resolves.toBeDefined();
  });
});

/* ═══ Cross-client isolation ═════════════════════════════════════════════ */

describe("cross-client isolation", () => {
  it("blocks a coach from reading an athlete they have no relationship with", async () => {
    const { store, repos } = scenario();
    addAthlete(store, "member-unrelated");

    await expect(
      repos.tracking.listCheckIns("member-unrelated", DEMO_IDS.coach),
    ).rejects.toThrow();
  });

  it("blocks one client from reading another client of the same coach", async () => {
    const { repos } = scenario();
    await expect(
      repos.tracking.listCheckIns(DEMO_IDS.anthony, DEMO_IDS.jasmine),
    ).rejects.toThrow();
  });

  it("blocks a coach from reading another coach's client clinically", async () => {
    const { store, ops } = scenario();
    addAthlete(store, "member-other-coach-client");
    await expect(
      ops.clinical.listRecords("member-other-coach-client", DEMO_IDS.coach),
    ).rejects.toThrow();
  });

  it("scopes the roster to the requesting coach only", async () => {
    const { store, repos } = scenario();
    addAthlete(store, "member-unrelated");
    const clients = await repos.coaching.listClients(DEMO_IDS.coach);
    expect(clients.map((c) => c.athleteId)).not.toContain("member-unrelated");
  });
});

/* ═══ Revocation ═════════════════════════════════════════════════════════ */

describe("revocation", () => {
  it("stops access immediately once the relationship is revoked", async () => {
    const { store, repos } = scenario();
    const rel = relationshipFor(store, DEMO_IDS.anthony);

    await expect(
      repos.tracking.listCheckIns(DEMO_IDS.anthony, DEMO_IDS.coach),
    ).resolves.toBeDefined();

    await repos.coaching.revokeRelationship(rel.id, DEMO_IDS.anthony);

    await expect(repos.tracking.listCheckIns(DEMO_IDS.anthony, DEMO_IDS.coach)).rejects.toThrow();
  });

  it("preserves the historical record after revocation", async () => {
    const { store, repos } = scenario();
    const rel = relationshipFor(store, DEMO_IDS.anthony);
    const before = store.read().relationships.length;

    await repos.coaching.revokeRelationship(rel.id, DEMO_IDS.anthony);

    const after = store.read().relationships;
    // Revocation is a status change, never a deletion — the history of who
    // had access and when must survive.
    expect(after.length).toBe(before);
    const revoked = after.find((r) => r.id === rel.id)!;
    expect(revoked.status).toBe("revoked");
    expect(revoked.revokedAt).toBeTruthy();
  });

  it("denies every permission check on a revoked relationship", async () => {
    const { store, repos } = scenario();
    const rel = relationshipFor(store, DEMO_IDS.anthony);
    await repos.coaching.revokeRelationship(rel.id, DEMO_IDS.anthony);

    const revoked = store.read().relationships.find((r) => r.id === rel.id)!;
    expect(canView(revoked, "training")).toBe(false);
    expect(canManage(revoked, "training")).toBe(false);
    expect(canView(revoked, "biomarkers")).toBe(false);
  });
});

/* ═══ Permission changes take effect ═════════════════════════════════════ */

describe("permission changes", () => {
  it("applies a downgrade immediately", async () => {
    const { store, repos } = scenario();
    const rel = relationshipFor(store, DEMO_IDS.anthony);

    await repos.coaching.updatePermissions(
      rel.id,
      { ...clonePermissions(rel.permissions), checkIns: "none" },
      DEMO_IDS.anthony,
    );

    await expect(repos.tracking.listCheckIns(DEMO_IDS.anthony, DEMO_IDS.coach)).rejects.toThrow();
  });

  it("records an audit entry for a permission change", async () => {
    const { store, repos } = scenario();
    const rel = relationshipFor(store, DEMO_IDS.anthony);
    const before = store.read().permissionAudit.length;

    await repos.coaching.updatePermissions(
      rel.id,
      { ...clonePermissions(rel.permissions), recovery: "none" },
      DEMO_IDS.anthony,
    );

    expect(store.read().permissionAudit.length).toBeGreaterThan(before);
  });
});
