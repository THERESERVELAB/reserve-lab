import { describe, expect, it } from "vitest";

import { announcementText, bannedWordIn, detailText, figure, joinDetail, planLogMoment } from "@/lib/ui/log-moment";

const milestone = { key: "streak-7", headline: "7 nights in a row.", intensity: 1.4 };

describe("planLogMoment", () => {
  it("full tier: impact, flow, boom and a count-up; a milestone lands harder and holds longer", () => {
    const plain = planLogMoment({ tier: "full", tone: "log", milestone: null }, "full");
    expect(plain).toMatchObject({ impact: true, flow: true, boom: true, countUp: true, arrivalMs: 720, holdMs: 2600, intensity: 1 });
    const big = planLogMoment({ tier: "full", tone: "log", milestone }, "full");
    expect(big.intensity).toBe(1.4);
    expect(big.holdMs).toBeGreaterThan(plain.holdMs);
    expect(big.haptics?.arrival.length).toBeGreaterThan(plain.haptics?.arrival.length ?? 0);
  });

  it("mark tier: the press, sweep and words, never a flow or a boom", () => {
    const mark = planLogMoment({ tier: "mark", tone: "log", milestone: null }, "full");
    expect(mark).toMatchObject({ impact: true, flow: false, boom: false, animateWords: true, arrivalMs: 120 });
    expect(planLogMoment({ tier: "mark", tone: "log", milestone }, "full").boom).toBe(false);
  });

  it("reduced and static motion: words only, nothing animated, drawn or vibrated", () => {
    for (const motion of ["reduced", "static"] as const) {
      for (const tier of ["full", "mark"] as const) {
        const plan = planLogMoment({ tier, tone: "log", milestone }, motion);
        expect(plan).toMatchObject({ visible: true, impact: false, flow: false, boom: false, countUp: false, animateWords: false, haptics: null, intensity: 0 });
      }
    }
  });
});

describe("words", () => {
  it("joins the detail with the plate separator and announces lead, detail and headline", () => {
    const detail = joinDetail([figure(7.4, 1, 0), " h"], null, "5 nights in a row");
    expect(detailText({ detail })).toBe("7.4 h · 5 nights in a row");
    expect(announcementText({ lead: "Sleep logged", detail, milestone })).toBe("Sleep logged. 7.4 h · 5 nights in a row. 7 nights in a row.");
    expect(announcementText({ lead: "Logged", detail: [], milestone: null })).toBe("Logged.");
  });

  it("the banned list catches praise, direction and health language", () => {
    for (const bad of ["Great work", "Down 2 lb", "Weight up", "Healthy streak", "Safe to continue", "You lost 3 lb", "Nice!"]) {
      expect(bannedWordIn(bad), bad).not.toBeNull();
    }
    for (const ok of ["Weight logged · 188.1 lb", "Hydration target reached.", "Logged", "Operator rank."]) {
      expect(bannedWordIn(ok), ok).toBeNull();
    }
  });
});
