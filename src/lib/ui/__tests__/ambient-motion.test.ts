import { describe, expect, it } from "vitest";

import { resolveAmbientMotion, type AmbientMotion } from "@/lib/ui/ambient-motion";
import { SYSTEMS_ONLINE_SCRIPT, shouldPlaySystemsOnline } from "@/lib/ui/systems-online";

/**
 * The one motion gate: every combination of reduced motion, the member's
 * pause and tab visibility resolves to exactly one mode.
 */
describe("ambient motion gate", () => {
  const table: Array<[reducedMotion: boolean, paused: boolean, hidden: boolean, expected: AmbientMotion]> = [
    [false, false, false, "full"],
    [true, false, false, "reduced"],
    [false, true, false, "static"],
    [true, true, false, "static"],
    [false, false, true, "static"],
    [true, false, true, "static"],
    [false, true, true, "static"],
    [true, true, true, "static"],
  ];

  it.each(table)("reduced=%s paused=%s hidden=%s → %s", (reducedMotion, paused, hidden, expected) => {
    expect(resolveAmbientMotion({ reducedMotion, paused, hidden })).toBe(expected);
  });

  it("pause outranks reduced motion: a paused member is always static", () => {
    expect(resolveAmbientMotion({ reducedMotion: true, paused: true, hidden: false })).toBe("static");
  });
});

describe("systems online decision", () => {
  const cases = [
    { alreadyPlayed: false, reducedMotion: false, paused: false, hidden: false },
    { alreadyPlayed: true, reducedMotion: false, paused: false, hidden: false },
    { alreadyPlayed: false, reducedMotion: true, paused: false, hidden: false },
    { alreadyPlayed: false, reducedMotion: false, paused: true, hidden: false },
    { alreadyPlayed: false, reducedMotion: false, paused: false, hidden: true },
  ];

  it("plays only on the first open, under full motion", () => {
    expect(cases.map(shouldPlaySystemsOnline)).toEqual([true, false, false, false, false]);
  });

  it("the pre-paint script makes the same decision as the table", () => {
    for (const input of cases) {
      const attributes: Record<string, string> = {};
      const env = {
        document: {
          documentElement: { setAttribute: (name: string, value: string) => (attributes[name] = value) },
          visibilityState: input.hidden ? "hidden" : "visible",
        },
        sessionStorage: { getItem: () => (input.alreadyPlayed ? "1" : null) },
        localStorage: { getItem: () => JSON.stringify({ state: { paused: input.paused }, version: 0 }) },
        window: { matchMedia: () => ({ matches: input.reducedMotion }) },
      };
      new Function("document", "sessionStorage", "localStorage", "window", SYSTEMS_ONLINE_SCRIPT)(
        env.document,
        env.sessionStorage,
        env.localStorage,
        env.window,
      );
      expect(attributes["data-systems-online"] === "play").toBe(shouldPlaySystemsOnline(input));
    }
  });

  it("storage that throws means no settle, never an error", () => {
    const attributes: Record<string, string> = {};
    const run = () =>
      new Function("document", "sessionStorage", "localStorage", "window", SYSTEMS_ONLINE_SCRIPT)(
        { documentElement: { setAttribute: (n: string, v: string) => (attributes[n] = v) }, visibilityState: "visible" },
        { getItem: () => { throw new Error("blocked"); } },
        { getItem: () => null },
        { matchMedia: () => ({ matches: false }) },
      );
    expect(run).not.toThrow();
    expect(attributes["data-systems-online"]).toBeUndefined();
  });
});
