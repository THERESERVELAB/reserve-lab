import { describe, expect, it } from "vitest";

import { buildClinicianSummary, buildClinicianSummaryDocument } from "../clinician-summary";
import { renderSummaryText, summaryFileTitle, type SummaryDocument } from "../summary-document";

import { bannedLanguageIn } from "./compliance-language";

describe("summary document", () => {
  const doc: SummaryDocument = {
    title: "TITLE",
    intro: ["Prepared today.", "Not a clinical assessment."],
    sections: [
      {
        heading: "SECTION ONE",
        lines: [
          { kind: "text", text: "Flush left" },
          { kind: "note", text: "None logged." },
          { kind: "item", text: "Item" },
          { kind: "detail", text: "Detail under the item" },
        ],
      },
      { heading: "QUESTIONS", lines: [{ kind: "numbered", n: 1, text: "First?" }, { kind: "numbered", n: 2, text: "Second?" }] },
    ],
    footer: ["Footer line."],
  };

  it("renders plain text with the layout members already copy", () => {
    expect(renderSummaryText(doc)).toBe(
      [
        "TITLE",
        "Prepared today.",
        "Not a clinical assessment.",
        "",
        "SECTION ONE",
        "Flush left",
        "  None logged.",
        "  - Item",
        "      Detail under the item",
        "",
        "QUESTIONS",
        "  1. First?",
        "  2. Second?",
        "",
        "Footer line.",
      ].join("\n"),
    );
  });

  it("trims the trailing blank line when there is no footer", () => {
    expect(renderSummaryText({ ...doc, footer: [] }).endsWith("  2. Second?")).toBe(true);
  });

  it("names the print after the summary and the member's local date", () => {
    expect(summaryFileTitle("Reserve cycle review", new Date(2026, 8, 4, 23, 30))).toBe("Reserve cycle review 2026-09-04");
  });
});

describe("clinician summary document", () => {
  const now = new Date(2026, 8, 14, 9);

  it("keeps the text and the printable document identical in content", () => {
    const input = { generatedAt: now, compounds: [{ name: "Testosterone Cypionate", amount: "200", unit: "mg", isActive: true }] };
    const document = buildClinicianSummaryDocument(input);
    expect(buildClinicianSummary(input)).toBe(renderSummaryText(document));
    expect(document.sections.map((s) => s.heading)).toEqual([
      "COMPOUNDS, MEDICATIONS AND SUPPLEMENTS (as entered by the member)",
      "WHAT TO WATCH AND WHAT TO ASK (by compound, from Reserve's cited risk profiles)",
    ]);
    expect(document.sections[0].lines).toEqual([{ kind: "item", text: "Testosterone Cypionate — 200 mg · active" }]);
  });

  it("prepares any visit: what is watched, the latest result, warning signs and questions to ask", () => {
    const document = buildClinicianSummaryDocument({
      generatedAt: now,
      compounds: [
        { name: "Masteron", isActive: true },
        { name: "Paused Tren", officialName: "Trenbolone", isActive: false },
      ],
    });
    expect(document.intro.join(" ")).toMatch(/urgent care, a telehealth visit or a pharmacist/);
    const prep = document.sections.find((s) => s.heading.startsWith("WHAT TO WATCH"))!;
    const text = prep.lines.map((l) => l.text).join("\n");
    expect(text).toMatch(/^Masteron/m);
    expect(text).not.toMatch(/Paused Tren/);
    expect(text).toMatch(/PSA: not tested/);
    expect(text).toMatch(/Warning signs that need care right away: .*Chest pain/);
    expect(text).toMatch(/Ask: Should my PSA be checked, and how often\?/);
    expect(text).toMatch(/Ask: What are the treatment options for acne or hair loss/);
    for (const line of prep.lines) expect(bannedLanguageIn(line.text), line.text).toEqual([]);
  });

  it("says what the document is, and is not, without instructing", () => {
    const document = buildClinicianSummaryDocument({ generatedAt: now, compounds: [] });
    expect(document.intro.join(" ")).toMatch(/not a clinical assessment/);
    for (const text of [document.title, ...document.intro, ...document.sections.map((s) => s.heading)]) {
      expect(bannedLanguageIn(text), text).toEqual([]);
    }
  });
});
