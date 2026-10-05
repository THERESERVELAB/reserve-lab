import { describe, expect, it } from "vitest";

import { horizonFrame } from "@/lib/apex/horizon-projection";

import {
  buildSessionHorizon,
  clockToMinutes,
  layoutHorizonTrack,
  minutesSinceMidnight,
  parseDurationMinutes,
  postSessionWindow,
  sessionHorizonWindow,
  type SessionHorizonInput,
} from "../session-horizon";

/** Tuesday 15 September 2026, 4:12 PM local. */
const NOW = new Date(2026, 8, 15, 16, 12, 0);
const at = (h: number, m: number) => new Date(2026, 8, 15, h, m, 0);

function input(overrides: Partial<SessionHorizonInput> = {}): SessionHorizonInput {
  return {
    mode: "pre",
    now: NOW,
    plannedStart: "17:30",
    startedAt: null,
    endedAt: null,
    primerTime: "5–10 min",
    estimatedLiftingMin: 60,
    work: [
      {
        phase: "primary-output",
        label: "Primary Output",
        movements: [
          { id: "row", sets: 4, restSeconds: 150, loggedSets: 0 },
          { id: "pulldown", sets: 3, restSeconds: 120, loggedSets: 0 },
        ],
      },
      {
        phase: "secondary-volume",
        label: "Stretch-Biased Volume",
        movements: [
          { id: "pullover", sets: 3, restSeconds: 90, loggedSets: 0 },
          { id: "curl", sets: 3, restSeconds: 90, loggedSets: 0 },
        ],
      },
      { phase: "detail-work", label: "Pump Finisher", movements: [{ id: "face-pull", sets: 3, restSeconds: 60, loggedSets: 0 }] },
    ],
    support: [
      { key: "core", label: "Core Command", included: true, duration: "8–10 min", status: "pending" },
      { key: "conditioning", label: "Conditioning Reserve", included: true, duration: "20 min", status: "pending" },
      { key: "recovery", label: "Reserve Recovery Suite", included: true, duration: "8–12 min optional", status: "pending" },
      { key: "handoff", label: "Post-Session Handoff", included: true, duration: "3–5 min", status: "pending" },
    ],
    ...overrides,
  };
}

function contiguous(blocks: { startMin: number; endMin: number }[]) {
  for (let i = 1; i < blocks.length; i += 1) expect(blocks[i].startMin).toBeGreaterThanOrEqual(blocks[i - 1].endMin - 1);
}

describe("readers", () => {
  it("reads clock times, durations and instants", () => {
    expect(clockToMinutes("17:30")).toBe(1050);
    expect(clockToMinutes("7:05")).toBe(425);
    expect(clockToMinutes("25:00")).toBeNull();
    expect(clockToMinutes("evening")).toBeNull();

    expect(parseDurationMinutes("8–10 min")).toBe(9);
    expect(parseDurationMinutes("20 min")).toBe(20);
    expect(parseDurationMinutes("8–12 min optional")).toBe(10);
    expect(parseDurationMinutes("Flexible")).toBeNull();

    expect(minutesSinceMidnight(at(16, 12), NOW)).toBe(972);
    expect(minutesSinceMidnight("not a date", NOW)).toBeNull();
  });

  it("keeps the day planner's post-workout window rule", () => {
    expect(postSessionWindow(1200, 1050)).toEqual({ startMin: 1205, endMin: 1290 });
    /* Sessions starting at 6 PM or later get the longer evening window. */
    expect(postSessionWindow(1200, 1080)).toEqual({ startMin: 1205, endMin: 1320 });
  });
});

describe("before the session", () => {
  it("builds the day from the real queue: primer, lifting phases, support, then the meal window", () => {
    const h = buildSessionHorizon(input())!;
    expect(h.startSource).toBe("planned");
    expect(h.startMin).toBe(1050);
    expect(h.blocks.map((b) => b.id)).toEqual([
      "primer",
      "work-primary-output",
      "work-secondary-volume",
      "work-detail-work",
      "support-core",
      "support-conditioning",
      "support-recovery",
      "support-handoff",
      "post-window",
    ]);
    contiguous(h.blocks.slice(0, -1));

    const primer = h.blocks[0];
    expect([primer.startMin, primer.endMin]).toEqual([1042, 1050]);

    /* The lifting phases share the template's own 60-minute estimate. */
    const work = h.blocks.filter((b) => b.kind === "work");
    const liftingMin = work[work.length - 1].endMin - work[0].startMin;
    expect(Math.abs(liftingMin - 60)).toBeLessThanOrEqual(2);
    expect(work[0].endMin - work[0].startMin).toBeGreaterThan(work[2].endMin - work[2].startMin);
    expect(work[0].sub).toBe("2 movements · 7 sets");

    /* Support phases use their authored durations. */
    const core = h.blocks.find((b) => b.id === "support-core")!;
    expect(core.endMin - core.startMin).toBe(9);
    expect(h.blocks.find((b) => b.id === "support-recovery")!.kind).toBe("cooldown");
  });

  it("marks only the next block as due, and nothing as done", () => {
    const h = buildSessionHorizon(input())!;
    expect(h.blocks[0].status).toBe("due-next");
    expect(h.blocks.slice(1).every((b) => b.status === "upcoming")).toBe(true);
  });

  it("starts from now when the planned start has already passed", () => {
    const h = buildSessionHorizon(input({ now: at(18, 0) }))!;
    expect(h.startSource).toBe("now");
    expect(h.blocks[0].startMin).toBe(1080);
    expect(h.blocks[0].status).toBe("due-now");
  });

  it("leaves out the phases today's session mode does not include", () => {
    const h = buildSessionHorizon(
      input({
        support: [
          { key: "core", label: "Core Command", included: true, duration: "8–10 min", status: "pending" },
          { key: "recovery", label: "Reserve Recovery Suite", included: false, duration: "8–12 min", status: "not-included" },
          { key: "handoff", label: "Post-Session Handoff", included: true, duration: "3–5 min", status: "pending" },
        ],
      }),
    )!;
    expect(h.blocks.some((b) => b.supportKey === "recovery")).toBe(false);
  });

  it("has nothing to show without a lifting queue", () => {
    expect(buildSessionHorizon(input({ work: [] }))).toBeNull();
    expect(buildSessionHorizon(input({ work: [{ phase: "primary-output", label: "Primary Output", movements: [] }] }))).toBeNull();
  });

  it("ends the meal window on the evening rule for a late session", () => {
    const h = buildSessionHorizon(input({ plannedStart: "19:00" }))!;
    const post = h.blocks[h.blocks.length - 1];
    const sessionEnd = h.blocks[h.blocks.length - 2].endMin;
    expect([post.startMin, post.endMin]).toEqual([sessionEnd + 5, sessionEnd + 120]);
    expect(h.endMin).toBe(post.endMin);
  });
});

describe("during the session", () => {
  it("holds the block in progress on now, from the sets actually logged", () => {
    const logged = input();
    const primary = logged.work[0];
    const h = buildSessionHorizon({
      ...logged,
      mode: "live",
      now: at(17, 50),
      startedAt: at(17, 30).toISOString(),
      primerTime: null,
      work: [{ ...primary, movements: [{ ...primary.movements[0], loggedSets: 3 }, primary.movements[1]] }, ...logged.work.slice(1)],
    })!;

    expect(h.startSource).toBe("started");
    expect(h.blocks.some((b) => b.kind === "primer")).toBe(false);
    const current = h.blocks[0];
    expect(current.status).toBe("due-now");
    expect(current.startMin).toBeLessThanOrEqual(h.nowMin);
    expect(current.endMin).toBeGreaterThan(h.nowMin);
    expect(current.sub).toBe("3 of 7 sets logged");
    expect(current.firstOpenMovementId).toBe("row");
    expect(h.blocks[1].status).toBe("due-next");
    contiguous(h.blocks.slice(0, -1));
  });

  it("when behind the plan, finished blocks share the time spent and the current block moves to now", () => {
    const base = input();
    const done = (w: (typeof base.work)[number]) => ({ ...w, movements: w.movements.map((m) => ({ ...m, loggedSets: m.sets })) });
    const h = buildSessionHorizon({
      ...base,
      mode: "live",
      now: at(19, 0),
      startedAt: at(17, 30).toISOString(),
      primerTime: null,
      work: [done(base.work[0]), base.work[1], base.work[2]],
    })!;

    expect(h.blocks[0].status).toBe("completed");
    expect(h.blocks[0].startMin).toBe(1050);
    const current = h.blocks[1];
    expect(current.status).toBe("due-now");
    expect(current.startMin).toBe(h.nowMin);
    expect(h.blocks[0].endMin).toBe(current.startMin);
    contiguous(h.blocks.slice(0, -1));
  });
});

describe("after the session", () => {
  it("settles the lifting between start and close and carries the support phases' own states", () => {
    const base = input();
    const h = buildSessionHorizon({
      ...base,
      mode: "complete",
      now: at(18, 45),
      startedAt: at(17, 30).toISOString(),
      endedAt: at(18, 35).toISOString(),
      primerTime: null,
      work: base.work.map((w) => ({ ...w, movements: w.movements.map((m) => ({ ...m, loggedSets: m.sets })) })),
      support: [
        { key: "core", label: "Core Command", included: true, duration: "8–10 min", status: "completed" },
        { key: "conditioning", label: "Conditioning Reserve", included: true, duration: "20 min", status: "skipped" },
        { key: "handoff", label: "Post-Session Handoff", included: true, duration: "3–5 min", status: "due-now" },
      ],
    })!;

    const work = h.blocks.filter((b) => b.kind === "work");
    expect(work.every((b) => b.status === "completed")).toBe(true);
    expect(work[work.length - 1].endMin).toBe(1115);
    expect(h.blocks.find((b) => b.supportKey === "core")!.status).toBe("completed");
    expect(h.blocks.find((b) => b.supportKey === "conditioning")!.status).toBe("skipped");
    expect(h.blocks.find((b) => b.supportKey === "handoff")!.status).toBe("due-now");
  });
});

describe("the track", () => {
  const h = buildSessionHorizon(input())!;
  const frameAt = (px: number) => horizonFrame(sessionHorizonWindow(h), h.nowMin, px);

  it("opens the window just behind now, and ends after the meal window", () => {
    const win = sessionHorizonWindow(h);
    expect(win.startMin).toBeLessThanOrEqual(h.nowMin);
    expect(win.endMin).toBeGreaterThan(h.endMin);
  });

  it("draws every block readable, apart and inside the track", () => {
    const layout = layoutHorizonTrack(h.blocks, frameAt(1100));
    expect(layout.fits).toBe(true);
    expect(layout.items).toHaveLength(h.blocks.length);
    layout.items.forEach((item, i) => {
      expect(item.widthPx).toBeGreaterThanOrEqual(63);
      expect(item.leftPx).toBeGreaterThanOrEqual(0);
      expect(item.leftPx + item.widthPx).toBeLessThanOrEqual(1100);
      if (i > 0) expect(item.leftPx).toBeGreaterThanOrEqual(layout.items[i - 1].leftPx + layout.items[i - 1].widthPx);
    });
  });

  it("recedes: equal minutes are wider near now than far from it", () => {
    const frame = horizonFrame({ startMin: 960, endMin: 1440 }, 972, 1100);
    const layout = layoutHorizonTrack(
      [
        { startMin: 990, endMin: 1050 },
        { startMin: 1320, endMin: 1380 },
      ],
      frame,
      { minChipPx: 8 },
    );
    expect(layout.items[0].widthPx).toBeGreaterThan(layout.items[1].widthPx);
    expect(layout.items[0].depth).toBeGreaterThan(layout.items[1].depth);
  });

  it("reports that it cannot fit rather than overlapping", () => {
    expect(layoutHorizonTrack(h.blocks, frameAt(320)).fits).toBe(false);
  });

  it("counts blocks that ended before the window", () => {
    const frame = horizonFrame({ startMin: 1100, endMin: 1400 }, 1110, 1000);
    const layout = layoutHorizonTrack(
      [
        { startMin: 1000, endMin: 1060 },
        { startMin: 1060, endMin: 1200 },
      ],
      frame,
    );
    expect(layout.hiddenBefore).toBe(1);
    expect(layout.items.map((i) => i.index)).toEqual([1]);
  });
});
