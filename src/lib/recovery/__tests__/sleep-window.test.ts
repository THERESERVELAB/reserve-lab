import { describe, expect, it } from "vitest";

import {
  BEDTIME_WINDOW,
  WAKE_WINDOW,
  formatDuration,
  minutesToHours,
  positionToTime,
  sleepMinutes,
  targetLine,
  timeToPosition,
} from "../sleep-window";

describe("sleep window", () => {
  it("reads a night that crosses midnight as one night", () => {
    expect(sleepMinutes("22:30", "06:00")).toBe(450);
    expect(sleepMinutes("00:15", "07:45")).toBe(450);
    expect(sleepMinutes("23:00", "23:00")).toBeNull();
    expect(sleepMinutes("", "06:00")).toBeNull();
  });

  it("says the night the way a person would", () => {
    expect(formatDuration(450)).toBe("7h 30m");
    expect(formatDuration(480)).toBe("8h");
    expect(formatDuration(45)).toBe("45m");
    expect(minutesToHours(450)).toBe(7.5);
    expect(minutesToHours(425)).toBe(7.1);
  });

  it("maps the sliders to real clock times, both ways", () => {
    expect(positionToTime(0, BEDTIME_WINDOW)).toBe("19:00");
    expect(positionToTime(BEDTIME_WINDOW.span, BEDTIME_WINDOW)).toBe("05:00");
    expect(positionToTime(210, BEDTIME_WINDOW)).toBe("22:30");
    expect(positionToTime(300, BEDTIME_WINDOW)).toBe("00:00");
    expect(timeToPosition("22:30", BEDTIME_WINDOW)).toBe(210);
    expect(timeToPosition("01:00", BEDTIME_WINDOW)).toBe(360);
    expect(timeToPosition("06:00", WAKE_WINDOW)).toBe(180);
    /* Snaps to the step and stays inside the track. */
    expect(timeToPosition("22:37", BEDTIME_WINDOW)).toBe(210);
    expect(timeToPosition("18:00", BEDTIME_WINDOW)).toBe(BEDTIME_WINDOW.span);
  });

  it("places the night against the member's own target without judging it", () => {
    expect(targetLine(450, 8)).toBe("30m short of your 8h target");
    expect(targetLine(540, 8)).toBe("1h over your 8h target");
    expect(targetLine(485, 8)).toBe("Right on your 8h target");
    expect(targetLine(450, 0)).toBeNull();
  });
});
