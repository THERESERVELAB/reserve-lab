import { describe, expect, it } from "vitest";

import { phaseLensVisible } from "@/lib/women/cycle";

import { NAV_GROUPS, RESERVE_MODULES, deriveProfilePath } from "../registry";

/* A woman used to see "Training Command" TWICE in her sidebar — once under
   Foundation, once under Reserve Women. Nutrition, Recovery and Physique were
   duplicated the same way. The four women's rooms existed only to re-sort data
   that already had a home, and a fifth rolled the four of them up.

   Estimated phase is a lens, not a room. These pin the consolidation so the
   duplication cannot come back, and so the strings that merely LOOK like the
   deleted view ids are not collateral damage. */

const RETIRED_VIEWS = ["womens-performance", "womens-training", "womens-nutrition", "womens-recovery", "womens-physique"];

describe("no command appears twice in the nav", () => {
  it("no two modules share a label", () => {
    const seen = new Map<string, string[]>();
    for (const m of RESERVE_MODULES) {
      seen.set(m.label, [...(seen.get(m.label) ?? []), m.id]);
    }
    const duplicated = [...seen.entries()].filter(([, ids]) => ids.length > 1).map(([label, ids]) => `${label} — ${ids.join(", ")}`);
    expect(duplicated).toEqual([]);
  });

  it("no two modules share a view", () => {
    const views = RESERVE_MODULES.map((m) => m.view);
    expect(views.length).toBe(new Set(views).size);
  });

  it("the retired rooms are gone from the registry", () => {
    for (const view of RETIRED_VIEWS) {
      expect(RESERVE_MODULES.find((m) => m.id === view), `${view} is still registered`).toBeUndefined();
    }
  });

  it("nothing is sectioned off by gender any more", () => {
    expect(NAV_GROUPS.map((g) => String(g.id))).not.toContain("reserve-women");
    for (const id of ["womens-cycle", "womens-fertility", "womens-pregnancy"]) {
      const found = RESERVE_MODULES.find((m) => m.id === id);
      expect(found, `${id} is missing`).toBeDefined();
      expect(found!.group, `${id} should sit with the core commands`).toBe("foundation");
    }
  });

  it("the three that remain are still gated to the women's path", () => {
    for (const id of ["womens-cycle", "womens-fertility", "womens-pregnancy"]) {
      expect(RESERVE_MODULES.find((m) => m.id === id)!.requiresFlag).toBe("womens");
    }
  });

  it("a member not on the women's path sees no women's module", () => {
    /* Relocating to Foundation must not expose these to everyone. */
    const gated = RESERVE_MODULES.filter((m) => m.id.startsWith("womens-"));
    expect(gated.length).toBe(3);
    for (const m of gated) expect(m.requiresFlag).toBe("womens");
  });
});

describe("womens-performance survives everywhere it is not a view", () => {
  /* The string means five different things. Deleting the VIEW must not touch
     the other four — three of them are read from shipped member state, so
     breaking one orphans live accounts. */

  it("is still the ProfilePath every female member derives", () => {
    expect(deriveProfilePath("female")).toBe("womens-performance");
  });

  it("is still a labelled, described profile path", async () => {
    const { PROFILE_PATH_LABELS, PROFILE_PATH_DESCRIPTIONS } = await import("../registry");
    expect(PROFILE_PATH_LABELS["womens-performance"]).toBeTruthy();
    expect(PROFILE_PATH_DESCRIPTIONS["womens-performance"]).toBeTruthy();
    /* The copy named an "OS" made of rooms that no longer exist. */
    expect(PROFILE_PATH_DESCRIPTIONS["womens-performance"]).not.toMatch(/Women's Performance OS/i);
  });

  it("is still the protocol category behind every women's protocol", async () => {
    const { PROTOCOL_LIBRARY } = await import("@/lib/protocol/library");
    const womens = PROTOCOL_LIBRARY.filter((p) => p.category === "womens-performance");
    expect(womens.length).toBe(9);
  });
});

describe("the phase lens replaces the rooms it removed", () => {
  it("shows for a member on the women's path with a period start", () => {
    expect(phaseLensVisible({ genderIdentity: "female", starts: ["2026-09-01"] })).toBe(true);
    expect(phaseLensVisible({ womensEnabled: true, starts: ["2026-09-01"] })).toBe(true);
  });

  it("shows nothing without a period start — there is no phase to sort by", () => {
    expect(phaseLensVisible({ genderIdentity: "female", starts: [] })).toBe(false);
    expect(phaseLensVisible({ womensEnabled: true, starts: [] })).toBe(false);
  });

  it("shows nothing to a member not on the women's path, logs or not", () => {
    expect(phaseLensVisible({ genderIdentity: "male", starts: ["2026-09-01"] })).toBe(false);
    expect(phaseLensVisible({ starts: ["2026-09-01"] })).toBe(false);
    expect(phaseLensVisible({ genderIdentity: undefined, womensEnabled: false, starts: ["2026-09-01"] })).toBe(false);
  });
});
