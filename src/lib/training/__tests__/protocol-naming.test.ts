import { describe, expect, it } from "vitest";

import { WOMENS_TRACKS, resolveFocusArchitecture } from "@/lib/protocol/architecture";
import { PROTOCOL_LIBRARY } from "@/lib/protocol/library";

import { femalePriorityOptions, malePriorityOptions, neutralPriorityOptions } from "../priority-options";

/* Renaming the nine women's protocols moved every `name:` field and missed
   three OTHER fields that render the same thing: the goal picker's
   previewTitle, the focus lane's architectureName, and two placeholders. A
   member picked "Crown" on her protocol card and then read "Glute Crown
   Rotation" in the Muscle Focus preview, because both render through
   `activeGoal?.previewTitle ?? preview.architectureName`.

   These pin the shape of the fix rather than the strings themselves, so the
   next rename cannot reopen the same gap. */

/** Display names that were retired. None of them may appear in shipped copy. */
const RETIRED = [
  "Glute Crown Rotation",
  "Glute Ascend Protocol",
  "Sculpted Legs Architecture",
  "Runway Shape Protocol",
  "Vacation Physique Rotation",
  "Athletic Model Rotation",
  "Signature Shape Rotation",
  "Hybrid Pilates Shape Protocol",
  "Sport + Strength Shape Protocol",
];

const WOMENS = PROTOCOL_LIBRARY.filter((p) => p.category === "womens-performance");
const ALL_OPTIONS = [...malePriorityOptions, ...femalePriorityOptions, ...neutralPriorityOptions];

describe("the women's protocols have exactly one name each", () => {
  it("carries no retired display name in any shipped copy field", () => {
    for (const p of WOMENS) {
      const copy = [p.name, p.tagline, p.description, p.idealUser, ...(p.appChanges ?? [])].join(" | ");
      for (const retired of RETIRED) {
        expect(copy, `${p.id} still says "${retired}"`).not.toContain(retired);
      }
    }
  });

  it("names every women's track the same way the protocol library does", () => {
    /* WOMENS_TRACKS[track].name is what the cockpit renders as the active
       architecture. It and the protocol that activates the track are the same
       thing to a member, so they may not disagree. */
    for (const p of WOMENS) {
      if (!p.womensTrack) continue;
      const track = WOMENS_TRACKS[p.womensTrack];
      expect(track, `${p.id} points at a track that does not exist`).toBeDefined();
      expect(track.name, `${p.id} is "${p.name}" but its track is "${track.name}"`).toBe(p.name);
    }
  });
});

describe("the goal picker agrees with the architecture it previews", () => {
  it("previews a track option under that track's own name", () => {
    /* An option that sets a track previews a NAMED architecture, so its title
       is that architecture's name. This is the field the rename missed. */
    for (const option of ALL_OPTIONS) {
      if (!option.track) continue;
      const track = WOMENS_TRACKS[option.track];
      expect(track, `option ${option.id} sets an unknown track`).toBeDefined();
      expect(option.previewTitle, `option ${option.id} previews "${option.previewTitle}" for the ${track.name} track`).toBe(track.name);
    }
  });

  it("carries no retired name in any option's copy", () => {
    for (const option of ALL_OPTIONS) {
      const copy = `${option.label} | ${option.previewTitle} | ${option.previewExplanation} | ${option.intent}`;
      for (const retired of RETIRED) {
        expect(copy, `option ${option.id} still says "${retired}"`).not.toContain(retired);
      }
    }
  });

  it("keeps a trackless option on the descriptive convention", () => {
    /* Options without a track preview a DERIVED rotation, not a named
       architecture. Borrowing a protocol's brand name there is what created
       the drift in the first place. */
    const brandNames = new Set(WOMENS.map((p) => p.name));
    for (const option of ALL_OPTIONS) {
      if (option.track) continue;
      expect(brandNames.has(option.previewTitle), `option ${option.id} borrows the protocol name "${option.previewTitle}"`).toBe(false);
    }
  });
});

describe("the focus lane names a rotation, not a protocol", () => {
  const focus = (primary: string, secondary: string[] = []) =>
    resolveFocusArchitecture({ active: true, primary, secondary, support: [], track: null } as never);

  it("names the glute focus after what it does", () => {
    /* It used to borrow the women's protocol names, so renaming those left a
       member reading "Crown" on her card and "Glute Crown Rotation" here. */
    expect(focus("glutes").architectureName).toBe("Glute Priority Rotation");
    expect(focus("glutes", ["quads"]).architectureName).toBe("Glute + Quad Priority Rotation");
    expect(focus("quads").architectureName).toBe("Quad Priority Rotation");
  });

  it("borrows no protocol brand name for a derived focus rotation", () => {
    const brandNames = new Set(WOMENS.map((p) => p.name));
    for (const [primary, secondary] of [["glutes", []], ["glutes", ["quads"]], ["quads", []], ["quads", ["glutes"]], ["chest", []], ["back", []]] as const) {
      const name = focus(primary, [...secondary]).architectureName;
      expect(brandNames.has(name), `focus ${primary} borrows the protocol name "${name}"`).toBe(false);
    }
  });

  it("still resolves a women's track to that track's own name", () => {
    /* The track lane SHOULD use the brand name — it is the named architecture. */
    const runway = resolveFocusArchitecture({ active: true, primary: null, secondary: [], support: [], track: "runway" } as never);
    expect(runway.architectureName).toBe(WOMENS_TRACKS.runway.name);
  });
});
