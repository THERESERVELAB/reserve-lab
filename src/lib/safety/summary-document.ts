/* ════════════════════════════════════════════════════════════════════════
   SUMMARY DOCUMENT — one structure behind every clinician summary.

   The same document renders as plain text (copy, review history) and as a
   printable page (print or save as PDF), so what a member copies and what
   they print never differ. Lines keep their meaning — a list item, a
   numbered question, a detail under an item — instead of being flattened
   into indentation.
   ════════════════════════════════════════════════════════════════════════ */

export type SummaryLine =
  /** Flush-left text. */
  | { kind: "text"; text: string }
  /** An indented note, such as "None logged." */
  | { kind: "note"; text: string }
  /** A bulleted item. */
  | { kind: "item"; text: string }
  /** A numbered item, such as a question for the clinician. */
  | { kind: "numbered"; n: number; text: string }
  /** Detail belonging to the item above it. */
  | { kind: "detail"; text: string };

export type SummarySection = { heading: string; lines: SummaryLine[] };

export type SummaryDocument = {
  title: string;
  intro: string[];
  sections: SummarySection[];
  footer: string[];
};

function lineText(line: SummaryLine): string {
  switch (line.kind) {
    case "text":
      return line.text;
    case "note":
      return `  ${line.text}`;
    case "item":
      return `  - ${line.text}`;
    case "numbered":
      return `  ${line.n}. ${line.text}`;
    case "detail":
      return `      ${line.text}`;
  }
}

/** Plain text for copying and review history. */
export function renderSummaryText(doc: SummaryDocument): string {
  const out: string[] = [doc.title, ...doc.intro, ""];
  for (const section of doc.sections) {
    out.push(section.heading, ...section.lines.map(lineText), "");
  }
  out.push(...doc.footer);
  return out.join("\n").trimEnd();
}

/** The print title, which browsers use as the suggested PDF file name. */
export function summaryFileTitle(label: string, date: Date): string {
  const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  return `${label} ${key}`;
}
