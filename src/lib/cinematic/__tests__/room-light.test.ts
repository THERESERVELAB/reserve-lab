import { describe, expect, it } from "vitest";

import {
  DEPTH_DRIFT,
  LIVING_ROOMS,
  LIVING_ROOM_PROFILES,
  holdRoomLight,
  isLivingRoom,
  parseClock,
  readinessEnergy,
  resolveDaypart,
  resolveDepthDrift,
  resolveLivingRoom,
  resolveRoomLight,
  type LivingRoomInput,
  type RoomLight,
} from "../room-light";
import { resolveShellCinematic, type ShellCinematicInput } from "../view-environment";

const hm = (h: number, m = 0) => h * 60 + m;

describe("parseClock", () => {
  it("reads HH:MM and refuses anything else", () => {
    expect(parseClock("06:30")).toBe(390);
    expect(parseClock("6:05")).toBe(365);
    expect(parseClock("24:00")).toBeNull();
    expect(parseClock("noon")).toBeNull();
    expect(parseClock(undefined)).toBeNull();
  });
});

describe("resolveDaypart", () => {
  const schedule = { wakeTime: "06:30", sleepTarget: "22:30" };

  it("follows the member's wake and sleep targets", () => {
    expect(resolveDaypart(hm(5, 29), schedule)).toBe("night");
    expect(resolveDaypart(hm(5, 30), schedule)).toBe("dawn");
    expect(resolveDaypart(hm(7, 59), schedule)).toBe("dawn");
    expect(resolveDaypart(hm(8, 0), schedule)).toBe("day");
    expect(resolveDaypart(hm(16, 12), schedule)).toBe("day");
    expect(resolveDaypart(hm(20, 29), schedule)).toBe("day");
    expect(resolveDaypart(hm(20, 30), schedule)).toBe("night");
    expect(resolveDaypart(hm(3, 0), schedule)).toBe("night");
  });

  it("handles a sleep target after midnight", () => {
    const late = { wakeTime: "09:00", sleepTarget: "01:00" };
    expect(resolveDaypart(hm(22, 30), late)).toBe("day");
    expect(resolveDaypart(hm(23, 0), late)).toBe("night");
    expect(resolveDaypart(hm(0, 30), late)).toBe("night");
    expect(resolveDaypart(hm(8, 0), late)).toBe("dawn");
    expect(resolveDaypart(hm(10, 29), late)).toBe("dawn");
    expect(resolveDaypart(hm(10, 30), late)).toBe("day");
  });

  it("falls back to sensible defaults for a missing or degenerate schedule", () => {
    expect(resolveDaypart(hm(12), null)).toBe("day");
    expect(resolveDaypart(hm(6), {})).toBe("dawn");
    expect(resolveDaypart(hm(21), { wakeTime: "bad", sleepTarget: "" })).toBe("night");
    expect(resolveDaypart(hm(21), { wakeTime: "07:00", sleepTarget: "07:00" })).toBe("night");
  });

  it("never lets pre-wake dawn reach back past a very late sleep target", () => {
    const shift = { wakeTime: "06:30", sleepTarget: "06:00" };
    expect(resolveDaypart(hm(6, 10), shift)).toBe("dawn");
    expect(resolveDaypart(hm(5, 50), shift)).toBe("night");
  });
});

describe("readinessEnergy", () => {
  it("uses the Bible §08 thresholds", () => {
    expect(readinessEnergy(95)).toBe(1);
    expect(readinessEnergy(78)).toBe(1);
    expect(readinessEnergy(77)).toBe(0.78);
    expect(readinessEnergy(62)).toBe(0.78);
    expect(readinessEnergy(61)).toBe(0.55);
    expect(readinessEnergy(null)).toBe(0.6);
    expect(readinessEnergy(Number.NaN)).toBe(0.6);
  });

  it("composes with the daypart from a real clock", () => {
    expect(
      resolveRoomLight({ now: new Date(2026, 8, 15, 21, 0), schedule: { wakeTime: "06:30", sleepTarget: "22:30" }, readiness: 68 }),
    ).toEqual({ daypart: "night", energy: 0.78 });
  });
});

describe("resolveDepthDrift", () => {
  const on = { reducedMotion: false, liveSession: false };

  it("drifts plate and light apart over the first two screens of scroll", () => {
    expect(resolveDepthDrift({ ...on, scrollTop: 0 })).toEqual({ platePx: 0, lightPx: 0 });
    expect(resolveDepthDrift({ ...on, scrollTop: DEPTH_DRIFT.rangePx / 2 })).toEqual({ platePx: -12, lightPx: -20 });
    expect(resolveDepthDrift({ ...on, scrollTop: 10_000 })).toEqual({ platePx: -24, lightPx: -40 });
  });

  it("is off under reduced motion and during a live session", () => {
    expect(resolveDepthDrift({ scrollTop: 900, reducedMotion: true, liveSession: false })).toEqual({ platePx: 0, lightPx: 0 });
    expect(resolveDepthDrift({ scrollTop: 900, reducedMotion: false, liveSession: true })).toEqual({ platePx: 0, lightPx: 0 });
  });
});

/* ═══ Living rooms ═══════════════════════════════════════════════════════ */

const dawn: RoomLight = { daypart: "dawn", energy: 1 };
const night: RoomLight = { daypart: "night", energy: 0.55 };

function living(over: Partial<LivingRoomInput> = {}): LivingRoomInput {
  return {
    room: "apex",
    light: dawn,
    measured: true,
    reducedMotion: false,
    motionPaused: false,
    liveSession: false,
    ...over,
  };
}

describe("the living room set", () => {
  it("is exactly Apex, Training, Nutrition, Recovery and Schedule", () => {
    expect([...LIVING_ROOMS].sort()).toEqual(["apex", "nutrition", "recovery", "schedule", "training"]);
    for (const room of LIVING_ROOMS) expect(isLivingRoom(room)).toBe(true);
    for (const room of ["clinical", "studio", "strategist", "neutral", "violet", ""]) {
      expect(isLivingRoom(room)).toBe(false);
    }
  });

  it("gives all five rooms room light, depth drift and the dawn tint", () => {
    for (const room of LIVING_ROOMS) {
      const state = resolveLivingRoom(living({ room, light: { daypart: "dawn", energy: 0.78 } }));
      expect(state.living).toBe(true);
      expect(state.energy).toBe(0.78);
      expect(state.drift).toBe(true);
      expect(state.dawnTintOpacity).toBeGreaterThan(0);
    }
  });

  it("keeps every other room a fixed still at full strength", () => {
    for (const room of ["clinical", "strategist", "neutral"]) {
      expect(resolveLivingRoom(living({ room, light: night }))).toEqual({
        living: false,
        energy: 1,
        dawnTintOpacity: 0,
        drift: false,
      });
    }
  });

  it("keeps Recovery the calmest room: its dawn tint is the faintest", () => {
    const tint = (room: string) => resolveLivingRoom(living({ room })).dawnTintOpacity;
    expect(tint("recovery")).toBeLessThan(tint("training"));
    expect(tint("recovery")).toBeLessThan(tint("apex"));
    expect(tint("recovery")).toBeLessThan(tint("nutrition"));
    expect(LIVING_ROOM_PROFILES.recovery.dawnTint).toBeLessThanOrEqual(0.5);
  });

  it("warms Nutrition's dawn more than Recovery's and less than Apex's or Training's", () => {
    const tint = (room: string) => resolveLivingRoom(living({ room })).dawnTintOpacity;
    expect(tint("nutrition")).toBeGreaterThan(tint("recovery"));
    expect(tint("nutrition")).toBeLessThan(tint("training"));
    expect(tint("nutrition")).toBeLessThan(tint("apex"));
    expect(LIVING_ROOM_PROFILES.nutrition.dawnTint).toBe(0.7);
  });

  it("stages Schedule's dawn warmer than Nutrition's and under Apex's or Training's", () => {
    const tint = (room: string) => resolveLivingRoom(living({ room })).dawnTintOpacity;
    expect(tint("schedule")).toBeGreaterThan(tint("nutrition"));
    expect(tint("schedule")).toBeGreaterThan(tint("recovery"));
    expect(tint("schedule")).toBeLessThan(tint("training"));
    expect(tint("schedule")).toBeLessThan(tint("apex"));
    expect(LIVING_ROOM_PROFILES.schedule.dawnTint).toBe(0.85);
  });

  it("only tints at dawn, and scales the tint with room light", () => {
    expect(resolveLivingRoom(living({ light: night })).dawnTintOpacity).toBe(0);
    expect(resolveLivingRoom(living({ light: { daypart: "day", energy: 1 } })).dawnTintOpacity).toBe(0);
    expect(resolveLivingRoom(living({ light: { daypart: "dawn", energy: 0.55 } })).dawnTintOpacity).toBe(0.55);
    expect(resolveLivingRoom(living({ light: null })).dawnTintOpacity).toBe(0);
  });

  it("stops drift for reduced motion, the member's pause, a live session, and unmeasured conditions", () => {
    for (const room of LIVING_ROOMS) {
      expect(resolveLivingRoom(living({ room, reducedMotion: true })).drift).toBe(false);
      expect(resolveLivingRoom(living({ room, motionPaused: true })).drift).toBe(false);
      expect(resolveLivingRoom(living({ room, liveSession: true })).drift).toBe(false);
      expect(resolveLivingRoom(living({ room, measured: false })).drift).toBe(false);
    }
  });
});

describe("holdRoomLight", () => {
  it("passes the current light through when the room is not stilled", () => {
    expect(holdRoomLight(dawn, night, false)).toBe(night);
    expect(holdRoomLight(null, null, false)).toBeNull();
  });

  it("holds the light it already has while stilled, and holds the current light when it has none", () => {
    expect(holdRoomLight(dawn, night, true)).toBe(dawn);
    expect(holdRoomLight(null, night, true)).toBe(night);
  });
});

/* ═══ Training during a live session ═════════════════════════════════════ */

describe("Training during a live session", () => {
  const shell = (over: Partial<ShellCinematicInput>): ShellCinematicInput => ({
    view: "training",
    assetId: "training-command",
    liveSessionActive: false,
    motionPreference: "full",
    lowPower: false,
    offscreen: false,
    viewport: "desktop",
    ...over,
  });

  it("moves and changes nothing in the environment", () => {
    const cinematic = resolveShellCinematic(shell({ liveSessionActive: true }));
    // The contract stills the room: no loop, no decorative motion.
    expect(cinematic.stilledByTask).toBe(true);
    expect(cinematic.animate).toBe(false);
    expect(cinematic.playback.playVideo).toBe(false);

    // The session began at dawn; the clock and readiness move on to night.
    const shown = holdRoomLight(dawn, night, cinematic.stilledByTask);
    expect(shown).toBe(dawn);

    const state = resolveLivingRoom(living({ room: "training", light: shown, liveSession: true }));
    const before = resolveLivingRoom(living({ room: "training", light: dawn, liveSession: true }));
    // No light shift, no tint change, so no cross-fade; and no drift.
    expect(state).toEqual(before);
    expect(state.drift).toBe(false);
  });

  it("applies the same hold on every training view, on phones too", () => {
    for (const view of ["training", "mesocycle-planner", "performance-intelligence"] as const) {
      for (const viewport of ["desktop", "mobile"] as const) {
        expect(resolveShellCinematic(shell({ view, viewport, liveSessionActive: true })).stilledByTask).toBe(true);
      }
    }
  });

  it("lets the room follow the day again once the session ends", () => {
    const idle = resolveShellCinematic(shell({}));
    expect(idle.stilledByTask).toBe(false);
    expect(holdRoomLight(dawn, night, idle.stilledByTask)).toBe(night);
  });

  it("does not hold Apex or Recovery, whose contracts stay ambient; their drift still stops", () => {
    for (const [view, assetId, room] of [
      ["dashboard", "apex-command", "apex"],
      ["recovery", "recovery-chamber", "recovery"],
    ] as const) {
      const cinematic = resolveShellCinematic(shell({ view, assetId, liveSessionActive: true }));
      expect(cinematic.stilledByTask).toBe(false);
      expect(holdRoomLight(dawn, night, cinematic.stilledByTask)).toBe(night);
      expect(resolveLivingRoom(living({ room, light: night, liveSession: true })).drift).toBe(false);
    }
  });
});
