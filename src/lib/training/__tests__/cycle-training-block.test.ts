import { describe, expect, it } from "vitest";

import { bannedLanguageIn } from "../../safety/__tests__/compliance-language";
import { gateWorkoutDemand } from "../workout-demand";
import { resolveCycleState, type CyclePeriod } from "../../cycle/cycle-period";
import {
  blockPlacementLine,
  requestedDemandForToday,
  resolveBlockRelease,
  resolveTrainingBlock,
  type TrainingBlockIntent,
} from "../cycle-training-block";

/* ════════════════════════════════════════════════════════════════════════
   TRAINING AND THE CYCLE, ON ONE CLOCK — AND THE LINE BETWEEN THEM.

   The member can hold a session depth for a span they declared. What reaches
   training is a span and a week number. What must NEVER reach it is a
   compound: no depth may be chosen, raised, lowered or suggested because of
   anything the member is taking, because that would be Reserve claiming a
   substance makes harder training appropriate.

   The last describe block in this file is the one that matters most. It is
   not a behaviour test — it reads the module's own source and fails if the
   compound vocabulary ever appears in it.
   ════════════════════════════════════════════════════════════════════════ */

const NOW = new Date(2026, 8, 29, 12, 0); // 2026-09-29

function cycle(overrides: Partial<CyclePeriod> = {}): CyclePeriod {
  return {
    id: "cycle-1",
    name: "Autumn Block",
    startDate: "2026-09-08", // week 4 of 12 on NOW
    plannedWeeks: 12,
    compoundIds: [],
    clinicianOversight: false,
    checkpoints: [],
    createdAt: "2026-09-08T00:00:00.000Z",
    updatedAt: "2026-09-08T00:00:00.000Z",
    ...overrides,
  };
}

function stateOf(period: CyclePeriod, labDates: string[] = []) {
  return resolveCycleState(period, { now: NOW, compounds: [], labDates });
}

const held: TrainingBlockIntent = { cycleId: "cycle-1", demand: "contest-prep", setAt: "2026-09-08T00:00:00.000Z" };

describe("the block the member declared", () => {
  it("reports placement in their own span, and nothing more", () => {
    const block = resolveTrainingBlock({ cycleState: stateOf(cycle()), intent: null })!;
    expect(block.placement).toBe("Week 4 of 12");
    expect(block.cycleName).toBe("Autumn Block");
    expect(block.demand).toBeNull();
  });

  it("carries a depth the member pinned to THIS block", () => {
    const block = resolveTrainingBlock({ cycleState: stateOf(cycle()), intent: held })!;
    expect(block.demand).toBe("contest-prep");
    expect(blockPlacementLine(block)).toBe("Held for Autumn Block · Week 4 of 12");
  });

  it("does not let one block's depth leak into another", () => {
    const other = resolveTrainingBlock({
      cycleState: stateOf(cycle({ id: "cycle-2", name: "Winter Block" })),
      intent: held,
    })!;
    expect(other.demand).toBeNull();
    expect(blockPlacementLine(other)).toBeNull();
  });

  it("holds nothing before the span starts, after its stated end, or once ended", () => {
    const upcoming = stateOf(cycle({ startDate: "2026-11-01" }));
    const over = stateOf(cycle({ startDate: "2026-01-05" })); // 12 weeks ended long ago
    const ended = stateOf(cycle({ endedOn: "2026-09-20" }));
    for (const state of [upcoming, over, ended]) {
      expect(resolveTrainingBlock({ cycleState: state, intent: held })).toBeNull();
    }
    expect(resolveTrainingBlock({ cycleState: null, intent: held })).toBeNull();
  });
});

describe("handing depth back", () => {
  it("holds while the span the member set is running", () => {
    expect(resolveBlockRelease({ cycleState: stateOf(cycle()), intent: held })).toEqual({ kind: "held" });
  });

  it("returns depth the day the span is past its stated end, and says so", () => {
    const release = resolveBlockRelease({ cycleState: stateOf(cycle({ startDate: "2026-01-05" })), intent: held });
    expect(release.kind).toBe("returned");
    expect(release.kind === "returned" && release.reason).toMatch(/past the end you set/i);
    expect(release.kind === "returned" && release.reason).toMatch(/back to your own setting/i);
  });

  it("returns depth when the member ends the block themselves", () => {
    const release = resolveBlockRelease({ cycleState: stateOf(cycle({ endedOn: "2026-09-20" })), intent: held });
    expect(release.kind).toBe("returned");
    expect(release.kind === "returned" && release.reason).toMatch(/has ended/i);
  });

  it("says nothing when the member never pinned one", () => {
    expect(resolveBlockRelease({ cycleState: stateOf(cycle()), intent: null })).toEqual({ kind: "none" });
  });
});

describe("what depth is requested today", () => {
  it("prefers the held block, then the standing choice, then the default", () => {
    const block = resolveTrainingBlock({ cycleState: stateOf(cycle()), intent: held });
    expect(requestedDemandForToday({ block, standing: "precision", fallback: "high-output" })).toBe("contest-prep");
    expect(requestedDemandForToday({ block: null, standing: "precision", fallback: "high-output" })).toBe("precision");
    expect(requestedDemandForToday({ block: null, standing: null, fallback: "elite-volume" })).toBe("elite-volume");
  });

  it("falls through to the member's own setting when the block holds no depth", () => {
    const unpinned = resolveTrainingBlock({ cycleState: stateOf(cycle()), intent: null });
    expect(requestedDemandForToday({ block: unpinned, standing: "precision", fallback: "high-output" })).toBe("precision");
  });
});

describe("the day still outranks the block", () => {
  /* A block is a ceiling the member asked for, never a floor. If it could
     survive low readiness, a discomfort report or a deload week, Reserve
     would be letting a declared span override the evidence in front of it. */
  const heldDepth = () => {
    const block = resolveTrainingBlock({ cycleState: stateOf(cycle()), intent: held });
    return requestedDemandForToday({ block, standing: null, fallback: "high-output" });
  };

  it("steps a held depth down for low readiness, with a reason", () => {
    const gate = gateWorkoutDemand(heldDepth(), {
      trainingAge: "advanced", readiness: 40, activePainFlags: 0, deload: false,
    });
    expect(heldDepth()).toBe("contest-prep");
    expect(gate.effective).toBe("elite-volume");
    expect(gate.limited).toBe(true);
    expect(gate.reason).toBeTruthy();
  });

  it("pulls a held depth to Precision in a deload week", () => {
    expect(gateWorkoutDemand(heldDepth(), {
      trainingAge: "advanced", readiness: null, activePainFlags: 0, deload: true,
    }).effective).toBe("precision");
  });

  it("steps a held depth down on an active discomfort report", () => {
    expect(gateWorkoutDemand(heldDepth(), {
      trainingAge: "advanced", readiness: null, activePainFlags: 1, deload: false,
    }).effective).toBe("elite-volume");
  });

  it("never lets a block lift a member above their own training history", () => {
    expect(gateWorkoutDemand(heldDepth(), {
      trainingAge: "beginner", readiness: 100, activePainFlags: 0, deload: false,
    }).effective).toBe("high-output");
  });
});

describe("checkpoints the member or their clinician set", () => {
  it("surfaces a lab date that passed without a lab, as a date and nothing else", () => {
    const withCheckpoint = cycle({
      checkpoints: [{ id: "cp-1", date: "2026-09-01", label: "Mid-block panel", setBy: "clinician" }],
    });
    const block = resolveTrainingBlock({ cycleState: stateOf(withCheckpoint), intent: null })!;
    expect(block.overdue).toHaveLength(1);
    expect(block.overdue[0].label).toBe("Mid-block panel");
    expect(block.overdue[0].daysOverdue).toBe(28);
  });

  it("says nothing once a lab in the window satisfied it", () => {
    const withCheckpoint = cycle({
      checkpoints: [{ id: "cp-1", date: "2026-09-01", label: "Mid-block panel", setBy: "clinician" }],
    });
    const block = resolveTrainingBlock({ cycleState: stateOf(withCheckpoint, ["2026-09-03"]), intent: null })!;
    expect(block.overdue).toHaveLength(0);
  });

  it("never gates the session on a checkpoint — depth is unchanged either way", () => {
    const withCheckpoint = cycle({
      checkpoints: [{ id: "cp-1", date: "2026-09-01", label: "Mid-block panel", setBy: "member" }],
    });
    const overdue = resolveTrainingBlock({ cycleState: stateOf(withCheckpoint), intent: held })!;
    const clean = resolveTrainingBlock({ cycleState: stateOf(cycle()), intent: held })!;
    expect(overdue.demand).toBe(clean.demand);
  });
});

describe("the line this module must not cross", () => {
  /* Read the source, not the behaviour. A future edit that starts reasoning
     from what the member is taking would pass every test above and fail here,
     which is exactly the point: the constraint is on what the code may look
     at, and CLAUDE.md forbids medical claims about a substance. */
  const source = new URL("../cycle-training-block.ts", import.meta.url);

  it("never reads a compound, a dose, or anything about what the member takes", async () => {
    const { readFileSync } = await import("node:fs");
    const text = readFileSync(source, "utf8");
    /* Strip the comment header, which discusses the ban in order to state it. */
    const code = text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    for (const banned of [/\bdose/i, /\bdosage/i, /\bmg\b/i, /compound/i, /\bdrug/i, /steroid/i, /testosterone/i, /\bpeptide/i]) {
      expect(code, `banned term ${banned} reached the training block engine`).not.toMatch(banned);
    }
  });

  it("does not depend on how many compounds are running", () => {
    const state = resolveCycleState(cycle({ compoundIds: ["a", "b", "c"] }), {
      now: NOW,
      compounds: [
        { id: "a", name: "A", isActive: true },
        { id: "b", name: "B", isActive: true },
        { id: "c", name: "C", isActive: true },
      ],
    });
    const many = resolveTrainingBlock({ cycleState: state, intent: held })!;
    const none = resolveTrainingBlock({ cycleState: stateOf(cycle()), intent: held })!;
    expect(many.demand).toBe(none.demand);
    expect(many.placement).toBe(none.placement);
  });

  it("passes the banned-language suite every safety surface is held to", () => {
    const shown = [
      blockPlacementLine(resolveTrainingBlock({ cycleState: stateOf(cycle()), intent: held }))!,
      (resolveBlockRelease({ cycleState: stateOf(cycle({ startDate: "2026-01-05" })), intent: held }) as { reason: string }).reason,
      (resolveBlockRelease({ cycleState: stateOf(cycle({ endedOn: "2026-09-20" })), intent: held }) as { reason: string }).reason,
      resolveTrainingBlock({ cycleState: stateOf(cycle()), intent: null })!.placement,
    ];
    for (const text of shown) {
      expect(bannedLanguageIn(text), `banned language in "${text}"`).toEqual([]);
    }
  });

  it("never states a reason for the depth — only where it sits in time", () => {
    const line = blockPlacementLine(resolveTrainingBlock({ cycleState: stateOf(cycle()), intent: held }))!;
    expect(line).not.toMatch(/because|so you can|supports|recover|safe|allows|ready/i);
    expect(line).toMatch(/^Held for .+ · Week \d+ of \d+$/);
  });
});
