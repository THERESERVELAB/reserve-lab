import { describe, expect, it } from "vitest";

import { DEMO_IDS, ensureDemoScenario } from "../fixtures";
import { todayKey } from "../ids";
import {
  buildPrepSequence,
  composeDailyDirective,
  consolidateGrocery,
  detectScheduleConstraints,
  type DirectiveInputs,
} from "../operations/engines";
import { ensureOperationsDemo } from "../operations/fixtures";
import { createOperationsRepositories } from "../operations/local";
import type {
  DirectivePreference,
  LifestyleEvent,
  Meal,
  MealPlan,
  PantryItem,
} from "../operations/types";
import type { CoachingPermissions } from "../types";
import {
  CoachingStore,
  MemoryAdapter,
  emptyCoachingDatabase,
  migrateCoachingEnvelope,
  type CoachingDatabase,
} from "../storage";

function scenario() {
  const adapter = new MemoryAdapter();
  const store = new CoachingStore(adapter);
  ensureDemoScenario(store);
  ensureOperationsDemo(store);
  return { adapter, store, ops: createOperationsRepositories(store) };
}

/* ═══ Schema v1 → v2 migration ═══════════════════════════════════════════ */

describe("storage schema v1 → v2 migration", () => {
  function v1Snapshot(): Partial<CoachingDatabase> {
    const adapter = new MemoryAdapter();
    const store = new CoachingStore(adapter);
    ensureDemoScenario(store);
    const db = store.read();
    // Strip the v2 permission keys + collections to reproduce a v1 payload.
    const v1Rels = db.relationships.map((rel) => {
      const { supplements, clinicalRecords, nutritionArchitecture, mealPlans,
        mealPreparation, grocery, lifestyleSchedule, dailyDirective, ...rest } =
        rel.permissions as CoachingPermissions;
      void supplements; void clinicalRecords; void nutritionArchitecture; void mealPlans;
      void mealPreparation; void grocery; void lifestyleSchedule; void dailyDirective;
      return { ...rel, permissions: rest as CoachingPermissions };
    });
    return {
      members: db.members,
      relationships: v1Rels,
      checkIns: db.checkIns,
      messages: db.messages,
      conversations: db.conversations,
      invitations: db.invitations,
      seededScenario: db.seededScenario,
    };
  }

  it("preserves existing coaching data and fills operational scopes from prior grants", () => {
    const data = v1Snapshot();
    const migrated = migrateCoachingEnvelope({ version: 1, data });

    expect(migrated.members).toHaveLength(data.members!.length);
    expect(migrated.checkIns).toHaveLength(data.checkIns!.length);
    expect(migrated.messages).toHaveLength(data.messages!.length);
    expect(migrated.relationships).toHaveLength(data.relationships!.length);

    const luis = migrated.relationships.find((r) => r.athleteId === DEMO_IDS.luis)!;
    // Luis had nutrition "manage" in v1 → meal systems inherit that grant.
    expect(luis.permissions.mealPlans).toBe("manage");
    expect(luis.permissions.grocery).toBe("manage");
    // Schedule "suggest" flows to the lifestyle week.
    expect(luis.permissions.lifestyleSchedule).toBe("suggest");
    // Supplements and clinical NEVER auto-grant on migration.
    expect(luis.permissions.supplements).toBe("none");
    expect(luis.permissions.clinicalRecords).toBe("none");
    // New collections exist and start empty.
    expect(migrated.supplementProtocols).toEqual([]);
    expect(migrated.clinicalConsents).toEqual([]);
  });

  it("is idempotent and leaves v2 grants untouched", () => {
    const once = migrateCoachingEnvelope({ version: 1, data: v1Snapshot() });
    const twice = migrateCoachingEnvelope({ version: 2, data: once });
    expect(twice.relationships).toEqual(once.relationships);

    const anthony = twice.relationships.find((r) => r.athleteId === DEMO_IDS.anthony)!;
    anthony.permissions.clinicalRecords = "view";
    const third = migrateCoachingEnvelope({ version: 2, data: twice });
    expect(
      third.relationships.find((r) => r.athleteId === DEMO_IDS.anthony)!.permissions.clinicalRecords,
    ).toBe("view");
  });

  it("survives malformed partial payloads without crashing or wiping unknown fields", () => {
    const malformed = {
      relationships: [{ id: "rel-broken", coachId: "c", athleteId: "a", status: "active" }],
      invitations: [{ id: "inv-broken", coachId: "c" }],
      futureUnknownCollection: [{ keep: true }],
    } as unknown as Partial<CoachingDatabase>;
    const migrated = migrateCoachingEnvelope({ version: 1, data: malformed });
    expect(migrated.relationships[0].permissions.clinicalRecords).toBe("none");
    expect(migrated.relationships[0].permissions.physiquePhotos.access).toBe("none");
    expect((migrated as unknown as Record<string, unknown>).futureUnknownCollection).toEqual([{ keep: true }]);
    expect(migrated.mealPlans).toEqual([]);
  });

  it("keeps an empty database shape valid", () => {
    const migrated = migrateCoachingEnvelope({ version: 1, data: {} });
    expect(migrated).toEqual(emptyCoachingDatabase());
  });
});

/* ═══ Operations demo seeding ════════════════════════════════════════════ */

describe("operations demo layer", () => {
  it("seeds additively and idempotently on top of the base scenario", () => {
    const adapter = new MemoryAdapter();
    const store = new CoachingStore(adapter);
    ensureDemoScenario(store);
    const before = store.read();
    const baseCounts = {
      members: before.members.length,
      relationships: before.relationships.length,
      messages: before.messages.length,
      checkIns: before.checkIns.length,
    };

    ensureOperationsDemo(store);
    const after = store.read();
    expect(after.members).toHaveLength(baseCounts.members);
    expect(after.relationships).toHaveLength(baseCounts.relationships);
    expect(after.messages).toHaveLength(baseCounts.messages);
    expect(after.checkIns).toHaveLength(baseCounts.checkIns);
    expect(after.supplementProtocols.length).toBeGreaterThan(0);
    expect(after.nutritionArchitectures.length).toBeGreaterThan(0);

    const counts = {
      protocols: after.supplementProtocols.length,
      mealPlans: after.mealPlans.length,
      grocery: after.groceryPlans.length,
      clinical: after.clinicalRecords.length,
    };
    ensureOperationsDemo(store); // second call must be a no-op
    const again = store.read();
    expect(again.supplementProtocols).toHaveLength(counts.protocols);
    expect(again.mealPlans).toHaveLength(counts.mealPlans);
    expect(again.groceryPlans).toHaveLength(counts.grocery);
    expect(again.clinicalRecords).toHaveLength(counts.clinical);
  });

  it("never seeds operations into an empty (non-demo) database", () => {
    const store = new CoachingStore(new MemoryAdapter());
    ensureOperationsDemo(store);
    expect(store.read().supplementProtocols).toHaveLength(0);
    expect(store.read().seededOperations).toBeNull();
  });
});

/* ═══ Clinical consent enforcement ═══════════════════════════════════════ */

describe("clinical coordination consent", () => {
  it("full coaching access does NOT grant clinical reads", async () => {
    const { ops } = scenario();
    // Anthony granted full access — but clinical was never consented.
    await expect(ops.clinical.listRecords(DEMO_IDS.anthony, DEMO_IDS.coach))
      .rejects.toThrow(/explicit clinical consent/i);
  });

  it("view consent allows coach reads and logs every access", async () => {
    const { store, ops } = scenario();
    const records = await ops.clinical.listRecords(DEMO_IDS.luis, DEMO_IDS.coach);
    expect(records).toHaveLength(1);
    expect(records[0].category).toBe("hormone_therapy");
    const log = store.read().clinicalAccessLog.filter(
      (e) => e.recordScopeAthleteId === DEMO_IDS.luis && e.accessorId === DEMO_IDS.coach && e.action === "viewed",
    );
    expect(log.length).toBeGreaterThanOrEqual(1);
  });

  it("view-only consent blocks coach observations; view_and_note allows them", async () => {
    const { ops } = scenario();
    const observation = {
      recordId: "clin-luis-1",
      athleteId: DEMO_IDS.luis,
      authorId: DEMO_IDS.coach,
      authorRole: "coach" as const,
      kind: "training_performance" as const,
      note: "Athlete reports steady session output this week.",
      severity: "routine" as const,
    };
    await expect(ops.clinical.addObservation(observation, DEMO_IDS.coach))
      .rejects.toThrow(/explicit clinical consent/i);

    await ops.clinical.setConsent("rel-luis", DEMO_IDS.luis, "view_and_note", true);
    const saved = await ops.clinical.addObservation(observation, DEMO_IDS.coach);
    expect(saved.authorRole).toBe("coach");
  });

  it("coaches can never create or modify clinical records at any consent scope", async () => {
    const { ops } = scenario();
    await ops.clinical.setConsent("rel-luis", DEMO_IDS.luis, "view_and_note", true);
    await expect(
      ops.clinical.createRecord(
        {
          relationshipId: "rel-luis", athleteId: DEMO_IDS.luis,
          disclosedName: "Coach-entered record", category: "custom_clinical",
          prescriptionStatus: "unspecified", startDate: null, reviewDate: null,
          documentationStatus: "pending_athlete", labReminderDate: null, followUpDate: null,
          status: "active", createdBy: DEMO_IDS.coach, acknowledgementAccepted: true,
        },
        DEMO_IDS.coach,
      ),
    ).rejects.toThrow(/athlete-owned/i);
    await expect(
      ops.clinical.updateRecord("clin-luis-1", DEMO_IDS.coach, { monitoringRequirements: "changed" }),
    ).rejects.toThrow(/athlete-owned/i);
  });

  it("only the athlete changes consent, and the acknowledgement is mandatory", async () => {
    const { ops } = scenario();
    await expect(ops.clinical.setConsent("rel-luis", DEMO_IDS.coach, "view_and_note", true))
      .rejects.toThrow(/only the athlete/i);
    await expect(ops.clinical.setConsent("rel-luis", DEMO_IDS.luis, "view_and_note", false))
      .rejects.toThrow(/acknowledgement/i);
  });

  it("revocation immediately closes coach access and records history", async () => {
    const { store, ops } = scenario();
    await ops.clinical.setConsent("rel-luis", DEMO_IDS.luis, "none", true);
    await expect(ops.clinical.listRecords(DEMO_IDS.luis, DEMO_IDS.coach))
      .rejects.toThrow(/explicit clinical consent/i);
    const rel = store.read().relationships.find((r) => r.id === "rel-luis")!;
    expect(rel.permissions.clinicalRecords).toBe("none");
    const consent = store.read().clinicalConsents.find((c) => c.relationshipId === "rel-luis")!;
    expect(consent.revokedAt).toBeTruthy();
    expect(consent.history[consent.history.length - 1].scope).toBe("none");
    // The athlete always retains access to their own records.
    const own = await ops.clinical.listRecords(DEMO_IDS.luis, DEMO_IDS.luis);
    expect(own).toHaveLength(1);
  });

  it("record saves require the acknowledgement", async () => {
    const { ops } = scenario();
    await expect(
      ops.clinical.createRecord(
        {
          relationshipId: "rel-luis", athleteId: DEMO_IDS.luis,
          disclosedName: "Athlete-disclosed record", category: "prescription_medication",
          prescriptionStatus: "prescribed", startDate: null, reviewDate: null,
          documentationStatus: "documented", labReminderDate: null, followUpDate: null,
          status: "active", createdBy: DEMO_IDS.luis, acknowledgementAccepted: false,
        },
        DEMO_IDS.luis,
      ),
    ).rejects.toThrow(/acknowledgement/i);
  });
});

/* ═══ Permission enforcement on operations repositories ═════════════════ */

describe("operations permission enforcement", () => {
  it("rejects reads without an active relationship grant", async () => {
    const { ops } = scenario();
    // Noah's invitation is pending — no active relationship exists.
    await expect(ops.protocols.listForAthlete(DEMO_IDS.noah, DEMO_IDS.coach))
      .rejects.toThrow(/not been granted/i);
  });

  it("a permission downgrade takes effect at the repository layer", async () => {
    const { store, ops } = scenario();
    store.write((db) => {
      const rel = db.relationships.find((r) => r.id === "rel-anthony")!;
      rel.permissions.supplements = "view";
    });
    await expect(
      ops.protocols.createDraft({
        coachId: DEMO_IDS.coach, athleteId: DEMO_IDS.anthony,
        name: "Blocked draft", objective: "n/a", coachRationale: "n/a",
        reviewDate: null, endDate: null, effectiveAt: null,
        items: [], trainingDayItemIds: [], restDayItemIds: [],
      }),
    ).rejects.toThrow(/not been granted/i);
    // View-level reads still work after the downgrade.
    const list = await ops.protocols.listForAthlete(DEMO_IDS.anthony, DEMO_IDS.coach);
    expect(list.length).toBeGreaterThan(0);
  });

  it("athletes always reach their own operational data", async () => {
    const { ops } = scenario();
    const protocols = await ops.protocols.listForAthlete(DEMO_IDS.anthony, DEMO_IDS.anthony);
    expect(protocols.length).toBeGreaterThan(0);
    const plans = await ops.nutritionOps.listMealPlans(DEMO_IDS.jasmine, DEMO_IDS.jasmine);
    expect(plans.length).toBeGreaterThan(0);
  });

  it("adherence and meal logs are athlete-only and re-marks replace, never duplicate", async () => {
    const { store, ops } = scenario();
    await expect(
      ops.protocols.logAdherence({
        protocolId: "prot-anthony", athleteId: DEMO_IDS.jasmine,
        itemId: "pi-a1", date: todayKey(), mark: "taken",
      }),
    ).rejects.toThrow(/protocol's athlete/i);

    const date = todayKey();
    await ops.protocols.logAdherence({ protocolId: "prot-anthony", athleteId: DEMO_IDS.anthony, itemId: "pi-a1", date, mark: "taken" });
    await ops.protocols.logAdherence({ protocolId: "prot-anthony", athleteId: DEMO_IDS.anthony, itemId: "pi-a1", date, mark: "skipped" });
    const entries = store.read().protocolAdherence.filter(
      (e) => e.protocolId === "prot-anthony" && e.itemId === "pi-a1" && e.date === date,
    );
    expect(entries).toHaveLength(1);
    expect(entries[0].mark).toBe("skipped");

    await expect(
      ops.nutritionOps.logMealCompletion("mp-anthony", DEMO_IDS.jasmine, "m-a1", date, "completed"),
    ).rejects.toThrow(/athlete/i);
    await ops.nutritionOps.logMealCompletion("mp-anthony", DEMO_IDS.anthony, "m-a1", date, "partial");
    await ops.nutritionOps.logMealCompletion("mp-anthony", DEMO_IDS.anthony, "m-a1", date, "completed");
    const marks = store.read().mealCompletions.filter((m) => m.mealId === "m-a1" && m.date === date);
    expect(marks).toHaveLength(1);
    expect(marks[0].mark).toBe("completed");
  });
});

/* ═══ Versioned lifecycle ════════════════════════════════════════════════ */

describe("versioned record lifecycle", () => {
  it("accepting a revision replaces the prior active version without deleting it", async () => {
    const { store, ops } = scenario();
    const draft = await ops.protocols.createDraft({
      coachId: DEMO_IDS.coach, athleteId: DEMO_IDS.anthony,
      name: "Mass Phase Support — Block III",
      objective: "Adjust hydration timing for the new work schedule.",
      coachRationale: "Same products; timing moves with the later session.",
      reviewDate: null, endDate: null, effectiveAt: null,
      items: [], trainingDayItemIds: [], restDayItemIds: [],
      supersedesId: "prot-anthony",
    });
    expect(draft.version).toBe(3); // prior active protocol was v2
    expect(draft.supersedesId).toBe("prot-anthony");

    await ops.protocols.send(draft.id, DEMO_IDS.coach);
    const active = await ops.protocols.decide(draft.id, DEMO_IDS.anthony, "accepted");
    expect(active.status).toBe("active");

    const prior = store.read().supplementProtocols.find((p) => p.id === "prot-anthony")!;
    expect(prior.status).toBe("replaced");
    expect(prior.items.length).toBeGreaterThan(0); // history intact
    expect(prior.auditEvents.some((e) => e.event === "replaced_by_new_version")).toBe(true);
  });

  it("athlete decisions only apply to records that were actually sent", async () => {
    const { ops } = scenario();
    const draft = await ops.protocols.createDraft({
      coachId: DEMO_IDS.coach, athleteId: DEMO_IDS.anthony,
      name: "Unsent draft", objective: "n/a", coachRationale: "n/a",
      reviewDate: null, endDate: null, effectiveAt: null,
      items: [], trainingDayItemIds: [], restDayItemIds: [],
    });
    await expect(ops.protocols.decide(draft.id, DEMO_IDS.anthony, "accepted"))
      .rejects.toThrow(/not awaiting/i);
    await expect(ops.protocols.decide("prot-anthony", DEMO_IDS.jasmine, "accepted"))
      .rejects.toThrow(/not awaiting|not your/i);
  });

  it("revision requests reopen the draft for coach edits", async () => {
    const { ops } = scenario();
    const plans = await ops.nutritionOps.listMealPlans(DEMO_IDS.jasmine, DEMO_IDS.coach);
    const sent = plans.find((p) => p.status === "sent")!;
    const returned = await ops.nutritionOps.decideMealPlan(sent.id, DEMO_IDS.jasmine, "revision_requested", "Need one more flexible slot on shift days.");
    expect(returned.status).toBe("revision_requested");
    const edited = await ops.nutritionOps.saveMealPlanDraft({
      id: sent.id, coachId: DEMO_IDS.coach, athleteId: DEMO_IDS.jasmine,
      name: sent.name, scope: sent.scope, meals: sent.meals, days: sent.days,
      coachNote: "Added flexibility per request.", effectiveAt: sent.effectiveAt,
    });
    expect(edited.status).toBe("draft");
  });
});

/* ═══ Deterministic engines ══════════════════════════════════════════════ */

describe("grocery consolidation engine", () => {
  const mkMeal = (id: string, name: string, ingredients: Meal["ingredients"]): Meal => ({
    id, name, timeWindow: "any", mealType: "exact", ingredients,
    alternatives: [], batchPrepEligible: true,
  });
  const plan = {
    meals: [
      mkMeal("m1", "Bowl A", [
        { name: "Chicken breast", portion: "200 g", groceryCategory: "protein" },
        { name: "Rice", portion: "100 g", groceryCategory: "carbohydrates" },
      ]),
      mkMeal("m2", "Bowl B", [
        { name: "chicken breast", portion: "200 g", groceryCategory: "protein" },
        { name: "Spinach", portion: "80 g", groceryCategory: "produce" },
      ]),
    ],
  } as unknown as MealPlan;

  it("merges shared ingredients across meals case-insensitively", () => {
    const items = consolidateGrocery(plan, { m1: 3, m2: 2 }, []);
    const chicken = items.find((i) => i.name.toLowerCase() === "chicken breast")!;
    expect(chicken.quantity).toBe("200 g × 5");
    expect(chicken.usedIn).toEqual(["Bowl A", "Bowl B"]);
    // Category ordering: protein before produce before carbohydrates? No —
    // the fixed order is protein, produce, carbohydrates.
    expect(items.map((i) => i.category)).toEqual(["protein", "produce", "carbohydrates"]);
  });

  it("marks pantry-owned items purchased but keeps running-low items on the list", () => {
    const pantry: PantryItem[] = [
      { id: "p1", athleteId: "a", name: "Rice", quantity: "1 kg", runningLow: false, updatedAt: "now" },
      { id: "p2", athleteId: "a", name: "Spinach", quantity: "a little", runningLow: true, updatedAt: "now" },
    ];
    const items = consolidateGrocery(plan, { m1: 1, m2: 1 }, pantry);
    expect(items.find((i) => i.name === "Rice")!.state).toBe("purchased");
    expect(items.find((i) => i.name === "Spinach")!.state).toBe("needed");
  });

  it("ignores meals with zero servings and is deterministic", () => {
    const a = consolidateGrocery(plan, { m1: 2 }, []);
    const b = consolidateGrocery(plan, { m1: 2 }, []);
    expect(a.map(({ id, ...rest }) => { void id; return rest; }))
      .toEqual(b.map(({ id, ...rest }) => { void id; return rest; }));
    expect(a.some((i) => i.name === "Spinach")).toBe(false);
  });
});

describe("meal-prep sequence engine", () => {
  it("produces the operational kitchen order with correct serving totals", () => {
    const plan = {
      meals: [
        {
          id: "m1", name: "Roast Chicken & Rice", timeWindow: "any", mealType: "exact",
          ingredients: [
            { name: "Chicken", portion: "200 g", groceryCategory: "protein" },
            { name: "Rice", portion: "100 g", groceryCategory: "carbohydrates" },
          ],
          prepInstructions: "Oven-roast the chicken.",
          alternatives: [], batchPrepEligible: true,
        },
        {
          id: "m2", name: "Veg Plate", timeWindow: "any", mealType: "exact",
          ingredients: [{ name: "Broccoli", portion: "150 g", groceryCategory: "produce" }],
          alternatives: [], batchPrepEligible: true,
        },
      ],
    } as unknown as MealPlan;
    const steps = buildPrepSequence(plan, { servingsByMeal: { m1: 4, m2: 3 } });
    const phases = steps.map((s) => s.phase);
    expect(phases[0]).toBe("preheat");
    expect(phases[1]).toBe("long_cook");
    expect(phases[phases.length - 1]).toBe("clean");
    expect(phases.indexOf("portion")).toBeGreaterThan(phases.lastIndexOf("vegetable"));
    expect(steps.find((s) => s.phase === "portion")!.instruction).toContain("7 total servings");
    expect(buildPrepSequence(plan, { servingsByMeal: {} })).toEqual([]);
  });
});

describe("schedule constraint engine", () => {
  const ev = (id: string, day: string, title: string, category: LifestyleEvent["category"], start: string, end: string, extra: Partial<LifestyleEvent> = {}): LifestyleEvent => ({
    id, title, category, day, start, end,
    priority: "standard", flexibility: "movable", required: true, reminderEnabled: false,
    ...extra,
  });

  it("detects overlaps, tight transitions, compressed recovery, and short sleep", () => {
    const events: LifestyleEvent[] = [
      ev("wake", "Mon", "Wake", "wake", "06:30", "06:40"),
      ev("work", "Mon", "Work", "work", "08:00", "17:00"),
      ev("overlap", "Mon", "Errand", "custom", "16:30", "17:30"),
      ev("train", "Mon", "Training", "training", "21:00", "22:15", { travelBufferMinutes: 45 }),
      ev("bed", "Mon", "Bedtime", "bedtime", "23:45", "23:45"),
    ];
    const constraints = detectScheduleConstraints(events);
    const kinds = constraints.map((c) => c.kind);
    expect(kinds).toContain("timing_conflict");
    expect(kinds).toContain("compressed_recovery_window");
    expect(kinds).toContain("missing_post_training_nutrition");
    expect(kinds).toContain("insufficient_sleep_opportunity");
    // Deterministic ids: same input, same output.
    expect(detectScheduleConstraints(events)).toEqual(constraints);
  });

  it("flags meal-prep collisions and elevated density", () => {
    const events: LifestyleEvent[] = [
      ev("prep", "Sun", "Meal prep", "meal_prep", "14:00", "16:00"),
      ev("family", "Sun", "Family visit", "family", "15:00", "18:00"),
      ...Array.from({ length: 9 }, (_, i) =>
        ev(`c${i}`, "Tue", `Commitment ${i}`, "custom", `${String(6 + i).padStart(2, "0")}:00`, `${String(6 + i).padStart(2, "0")}:45`),
      ),
    ];
    const kinds = detectScheduleConstraints(events).map((c) => c.kind);
    expect(kinds).toContain("meal_prep_conflict");
    expect(kinds).toContain("schedule_density_elevated");
  });

  it("stays quiet on a clean, executable day", () => {
    const events: LifestyleEvent[] = [
      ev("wake", "Wed", "Wake", "wake", "06:00", "06:10"),
      ev("train", "Wed", "Training", "training", "07:00", "08:00"),
      ev("meal", "Wed", "Breakfast", "meal", "08:15", "08:45"),
      ev("bed", "Wed", "Bedtime", "bedtime", "22:00", "22:00"),
    ];
    expect(detectScheduleConstraints(events)).toEqual([]);
  });
});

describe("daily directive composer", () => {
  const prefs: DirectivePreference = {
    relationshipId: "rel-x", athleteId: "a", coachId: "c",
    enabled: true, tone: "measured", focus: "consistency", frequency: "daily",
    deliveryWindow: "morning", length: "standard", athleteSensitivity: "standard",
    includeQuotation: "none", updatedAt: "now",
  };
  const inputs: DirectiveInputs = {
    athleteFirstName: "Sam", goal: "Recomposition", phase: "Base",
    todaySummary: ["Training — Lower", "4 meals planned"],
    recentAdherencePct: 88, recoveryPosture: "stable",
    missedActions: ["a planned meal"], recentWins: [], friction: [],
    liveDayChanged: false, date: "2026-07-19",
  };

  it("is deterministic for identical inputs", () => {
    expect(composeDailyDirective(inputs, prefs)).toEqual(composeDailyDirective(inputs, prefs));
  });

  it("softens missed-action language for gentle sensitivity and never shames", () => {
    const standard = composeDailyDirective(inputs, prefs).body;
    const gentle = composeDailyDirective(inputs, { ...prefs, athleteSensitivity: "gentle" }).body;
    expect(standard).toContain("Close what was left open");
    expect(gentle).toContain("simply picks them back up");
    for (const body of [standard, gentle]) {
      expect(body.toLowerCase()).not.toMatch(/shame|fail|lazy|excuse/);
    }
  });

  it("keeps brief directives brief and records its basis", () => {
    const brief = composeDailyDirective(inputs, { ...prefs, length: "brief" });
    expect(brief.body.split(". ").length).toBeLessThanOrEqual(4);
    expect(brief.basis).toContain("Tone: measured");
    expect(brief.basis).toContain("Focus: consistency");
  });
});

/* ═══ Directive repository flow ══════════════════════════════════════════ */

describe("daily directive delivery", () => {
  it("athletes only ever see approved directives; coaches edit before delivery", async () => {
    const { ops } = scenario();
    const draft = await ops.directive.draftToday("rel-jasmine", DEMO_IDS.coach, todayKey());
    expect(draft.status).toBe("drafted");

    // Still invisible to the athlete.
    const beforeApproval = await ops.directive.listForAthlete(DEMO_IDS.jasmine, DEMO_IDS.jasmine);
    expect(beforeApproval.find((d) => d.id === draft.id)).toBeUndefined();

    const delivered = await ops.directive.approve(draft.id, DEMO_IDS.coach, "Edited: one shift at a time today.");
    expect(delivered.status).toBe("delivered");
    expect(delivered.body).toBe("Edited: one shift at a time today.");

    const visible = await ops.directive.listForAthlete(DEMO_IDS.jasmine, DEMO_IDS.jasmine);
    expect(visible.find((d) => d.id === draft.id)).toBeTruthy();
  });

  it("drafting requires enabled preferences", async () => {
    const { store, ops } = scenario();
    store.write((db) => {
      const pref = db.directivePreferences.find((p) => p.relationshipId === "rel-jasmine")!;
      pref.enabled = false;
    });
    await expect(ops.directive.draftToday("rel-jasmine", DEMO_IDS.coach, todayKey()))
      .rejects.toThrow(/not enabled/i);
  });

  it("AI drafts are created as review-required drafts, never auto-approved", async () => {
    const { ops } = scenario();
    const draft = await ops.directive.createAIDraft("adherence_summary", DEMO_IDS.coach, DEMO_IDS.anthony);
    expect(draft.status).toBe("drafted");
    expect(draft.body.length).toBeGreaterThan(0);
    const friction = await ops.directive.createAIDraft("schedule_friction", DEMO_IDS.coach, DEMO_IDS.jasmine);
    expect(friction.status).toBe("drafted");
    expect(friction.title).toContain("Schedule friction");
  });
});

describe("daily directive acknowledgement", () => {
  async function deliverForJasmine() {
    const { store, ops } = scenario();
    const draft = await ops.directive.draftToday("rel-jasmine", DEMO_IDS.coach, todayKey());
    const delivered = await ops.directive.approve(draft.id, DEMO_IDS.coach);
    return { store, ops, delivered };
  }

  it("the owning athlete can acknowledge a delivered directive and the timestamp is saved", async () => {
    const { ops, delivered } = await deliverForJasmine();
    expect(delivered.acknowledgedAt).toBeUndefined();
    const acked = await ops.directive.acknowledge(delivered.id, DEMO_IDS.jasmine);
    expect(acked.acknowledgedAt).toBeTruthy();
    expect(new Date(acked.acknowledgedAt!).toString()).not.toBe("Invalid Date");
    // The athlete sees the acknowledgement persisted in their list.
    const list = await ops.directive.listForAthlete(DEMO_IDS.jasmine, DEMO_IDS.jasmine);
    expect(list.find((d) => d.id === delivered.id)?.acknowledgedAt).toBe(acked.acknowledgedAt);
  });

  it("another athlete cannot acknowledge it", async () => {
    const { ops, delivered } = await deliverForJasmine();
    await expect(ops.directive.acknowledge(delivered.id, DEMO_IDS.anthony))
      .rejects.toThrow(/only the athlete/i);
  });

  it("the coach cannot acknowledge on the athlete's behalf", async () => {
    const { ops, delivered } = await deliverForJasmine();
    await expect(ops.directive.acknowledge(delivered.id, DEMO_IDS.coach))
      .rejects.toThrow(/only the athlete/i);
  });

  it("a drafted (unapproved) directive cannot be acknowledged", async () => {
    const { ops } = scenario();
    const draft = await ops.directive.draftToday("rel-jasmine", DEMO_IDS.coach, todayKey());
    await expect(ops.directive.acknowledge(draft.id, DEMO_IDS.jasmine))
      .rejects.toThrow(/delivered/i);
  });

  it("repeated acknowledgement is idempotent — the first timestamp stands", async () => {
    const { ops, delivered } = await deliverForJasmine();
    const first = await ops.directive.acknowledge(delivered.id, DEMO_IDS.jasmine);
    const second = await ops.directive.acknowledge(delivered.id, DEMO_IDS.jasmine);
    expect(second.acknowledgedAt).toBe(first.acknowledgedAt);
  });

  it("pre-existing delivered directives without acknowledgedAt still load and acknowledge", async () => {
    const { ops } = scenario();
    // The seeded demo directive was delivered before the field existed.
    const seeded = await ops.directive.listForAthlete(DEMO_IDS.anthony, DEMO_IDS.anthony);
    const legacy = seeded.find((d) => d.id === "dir-anthony-today")!;
    expect(legacy).toBeTruthy();
    expect(legacy.acknowledgedAt).toBeUndefined();
    const acked = await ops.directive.acknowledge(legacy.id, DEMO_IDS.anthony);
    expect(acked.acknowledgedAt).toBeTruthy();
  });
});

/* ═══ Grocery repository flow ════════════════════════════════════════════ */

describe("grocery command flow", () => {
  it("generates a consolidated plan from the active meal plan and honors the pantry", async () => {
    const { ops } = scenario();
    const plan = await ops.grocery.generatePlan(
      {
        coachId: DEMO_IDS.coach, athleteId: DEMO_IDS.anthony,
        weekOf: todayKey(), sourcePlanId: "mp-anthony",
        servingsByMeal: { "m-a2": 4, "m-a5": 3 },
        budgetTarget: "$110",
      },
      DEMO_IDS.coach,
    );
    // Jasmine rice is owned in the pantry → marked purchased, not dropped.
    const rice = plan.items.find((i) => i.name.toLowerCase().includes("jasmine rice"))!;
    expect(rice.state).toBe("purchased");
    // Honey is in the pantry but running low → still needed.
    const honey = plan.items.find((i) => i.name.toLowerCase() === "honey")!;
    expect(honey.state).toBe("needed");
    expect(plan.status).toBe("open");
  });

  it("carries unresolved items into the next week and closes the old plan", async () => {
    const { store, ops } = scenario();
    const next = await ops.grocery.carryoverOpenItems("gp-anthony", DEMO_IDS.anthony, "2026-07-27");
    expect(next.weekOf).toBe("2026-07-27");
    expect(next.items.every((i) => i.carryover && i.state === "needed")).toBe(true);
    // Only the open/unavailable items moved; purchased ones stayed behind.
    const old = store.read().groceryPlans.find((p) => p.id === "gp-anthony")!;
    expect(old.status).toBe("complete");
    expect(next.items.length).toBeLessThan(old.items.length);
  });
});
