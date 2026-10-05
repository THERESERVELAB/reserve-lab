import { describe, expect, it } from "vitest";

import { migrateLogSound, useLogSoundStore } from "../log-sound-store";

/* The sounds are a per-device switch. A device that saved one before the
   silent-switch default existed gets the house back: on, and heard. */

describe("the sound switch", () => {
  it("sounds, and plays through the silent switch, on a device that has chosen nothing", () => {
    const state = useLogSoundStore.getState();
    expect(state.enabled).toBe(true);
    expect(state.throughSilent).toBe(true);
  });

  it("hands the sounds back once to a device that saved before this", () => {
    const migrated = migrateLogSound({ enabled: false, throughSilent: false }, 0);
    expect(migrated.enabled).toBe(true);
    expect(migrated.throughSilent).toBe(true);
  });

  it("keeps the member's choice from then on", () => {
    const kept = migrateLogSound({ enabled: false, throughSilent: false }, 1);
    expect(kept.enabled).toBe(false);
  });
});
