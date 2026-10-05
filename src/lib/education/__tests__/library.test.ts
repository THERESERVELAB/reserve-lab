import { describe, expect, it } from "vitest";

import { TERMINOLOGY } from "@/lib/logging/terminology";

import { CLINICIAN_NOTE, buildEducationLibrary } from "../library";

describe("buildEducationLibrary", () => {
  it("is built only from the real glossary and counts no lessons", () => {
    const library = buildEducationLibrary();
    expect(library.termCount).toBe(TERMINOLOGY.length);
    expect(library.lessonCount).toBe(0);
    expect(library.statement).toBe("No lessons are written yet.");
  });

  it("carries definitions but never the illustrative examples", () => {
    const text = JSON.stringify(buildEducationLibrary());
    for (const entry of TERMINOLOGY) {
      expect(text).not.toContain(entry.example);
    }
  });

  it("puts the clinician line on recovery terms only", () => {
    const library = buildEducationLibrary();
    for (const area of library.areas) {
      for (const term of area.terms) {
        expect(term.note).toBe(area.id === "recovery" ? CLINICIAN_NOTE : undefined);
      }
    }
  });

  it("orders areas by how members meet them and drops empty ones", () => {
    const library = buildEducationLibrary(TERMINOLOGY.filter((entry) => entry.category !== "science"));
    expect(library.areas.map((area) => area.id)).toEqual(["training", "recovery", "nutrition", "physique"]);
  });

  it("is honest when there is nothing to show", () => {
    const library = buildEducationLibrary([]);
    expect(library.termCount).toBe(0);
    expect(library.areas).toEqual([]);
    expect(library.statement).toBe("Nothing is published here yet.");
  });
});
