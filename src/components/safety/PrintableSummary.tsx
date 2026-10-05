"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import type { SummaryDocument, SummaryLine } from "@/lib/safety/summary-document";

/* ════════════════════════════════════════════════════════════════════════
   PRINTABLE SUMMARY — print or save a clinician summary as PDF, on device.

   The summary is rendered as a paper page at the end of <body>, hidden on
   screen. While a print is in progress, <html data-reserve-printing> hides
   everything else from the printout. The document title becomes the dated
   summary name, which browsers suggest as the PDF file name. Nothing is
   uploaded: the browser's own print dialog produces the PDF.
   ════════════════════════════════════════════════════════════════════════ */

const PRINT_ATTR = "data-reserve-printing";
const ROOT_CLASS = "reserve-print-summary";

const PRINT_CSS = `
.${ROOT_CLASS} { display: none; }
@media print {
  @page { margin: 16mm 15mm; }
  html[${PRINT_ATTR}] body > *:not(.${ROOT_CLASS}) { display: none !important; }
  html[${PRINT_ATTR}], html[${PRINT_ATTR}] body {
    background: #ffffff !important; color: #111111 !important;
    height: auto !important; min-height: 0 !important; overflow: visible !important;
  }
  html[${PRINT_ATTR}] .${ROOT_CLASS} { display: block !important; }
  .${ROOT_CLASS} {
    color: #111111; font-family: -apple-system, "Segoe UI", Helvetica, Arial, sans-serif;
    font-size: 10.5pt; line-height: 1.45;
  }
  .${ROOT_CLASS} .brand { margin: 0 0 4pt; font-size: 8pt; letter-spacing: 0.18em; text-transform: uppercase; color: #555555; }
  .${ROOT_CLASS} h1 { margin: 0 0 6pt; font-size: 15pt; font-weight: 700; letter-spacing: 0.02em; }
  .${ROOT_CLASS} .intro p { margin: 0 0 3pt; color: #333333; }
  .${ROOT_CLASS} section { margin-top: 12pt; }
  .${ROOT_CLASS} h2 {
    margin: 0 0 4pt; padding-bottom: 3pt; border-bottom: 0.75pt solid #bbbbbb;
    font-size: 9.5pt; font-weight: 700; letter-spacing: 0.1em; break-after: avoid;
  }
  .${ROOT_CLASS} p { margin: 0 0 3pt; }
  .${ROOT_CLASS} .note { color: #444444; }
  .${ROOT_CLASS} ul, .${ROOT_CLASS} ol { margin: 0 0 3pt; padding-left: 16pt; }
  /* The app's CSS reset removes list markers; clinician questions must keep their numbers. */
  .${ROOT_CLASS} ul { list-style: disc outside; }
  .${ROOT_CLASS} ol { list-style: decimal outside; }
  .${ROOT_CLASS} li { margin: 0 0 2.5pt; break-inside: avoid; }
  .${ROOT_CLASS} .detail { margin: 1pt 0 0; font-size: 9.5pt; color: #444444; }
  .${ROOT_CLASS} footer { margin-top: 14pt; padding-top: 6pt; border-top: 0.75pt solid #bbbbbb; font-size: 9pt; color: #444444; }
}
`;

type ListLine = Extract<SummaryLine, { kind: "item" | "numbered" }>;

function renderLines(lines: SummaryLine[]): ReactNode[] {
  const nodes: ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.kind === "item" || line.kind === "numbered") {
      const kind = line.kind;
      const entries: Array<{ line: ListLine; details: string[] }> = [];
      while (i < lines.length) {
        const next = lines[i];
        if (next.kind === kind) entries.push({ line: next, details: [] });
        else if (next.kind === "detail" && entries.length) entries[entries.length - 1].details.push(next.text);
        else break;
        i += 1;
      }
      const items = entries.map((entry, k) => (
        <li key={k} value={entry.line.kind === "numbered" ? entry.line.n : undefined}>
          {entry.line.text}
          {entry.details.map((detail, d) => (
            <p key={d} className="detail">
              {detail}
            </p>
          ))}
        </li>
      ));
      nodes.push(kind === "numbered" ? <ol key={`list-${i}`}>{items}</ol> : <ul key={`list-${i}`}>{items}</ul>);
      continue;
    }
    nodes.push(
      <p key={`line-${i}`} className={line.kind === "note" ? "note" : line.kind === "detail" ? "detail" : undefined}>
        {line.text}
      </p>,
    );
    i += 1;
  }
  return nodes;
}

function PrintableSummary({ summary, fileTitle, onDone }: { summary: SummaryDocument; fileTitle: string; onDone: () => void }) {
  useEffect(() => {
    const html = document.documentElement;
    const previousTitle = document.title;
    let finished = false;
    const restore = () => {
      html.removeAttribute(PRINT_ATTR);
      document.title = previousTitle;
    };
    const finish = () => {
      if (finished) return;
      finished = true;
      window.removeEventListener("afterprint", finish);
      restore();
      onDone();
    };

    document.title = fileTitle;
    html.setAttribute(PRINT_ATTR, "summary");
    window.addEventListener("afterprint", finish);
    // Let the page commit before the dialog opens; print keeps the click's user activation.
    const timer = window.setTimeout(() => window.print(), 0);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("afterprint", finish);
      if (!finished) restore();
    };
  }, [fileTitle, onDone]);

  return createPortal(
    <div className={ROOT_CLASS}>
      <style>{PRINT_CSS}</style>
      <article>
        <p className="brand">Reserve Lab</p>
        <h1>{summary.title}</h1>
        <div className="intro">
          {summary.intro.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
        {summary.sections.map((section, s) => (
          <section key={`${section.heading}-${s}`}>
            <h2>{section.heading}</h2>
            {renderLines(section.lines)}
          </section>
        ))}
        {summary.footer.length > 0 && (
          <footer>
            {summary.footer.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </footer>
        )}
      </article>
    </div>,
    document.body,
  );
}

/**
 * `print(summary, fileTitle)` opens the browser's print dialog for one summary
 * (where the member can choose Save as PDF). Render `printElement` once.
 */
export function usePrintSummary() {
  const [job, setJob] = useState<{ id: number; summary: SummaryDocument; fileTitle: string } | null>(null);
  const print = useCallback((summary: SummaryDocument, fileTitle: string) => {
    setJob({ id: Date.now(), summary, fileTitle });
  }, []);
  const done = useCallback(() => setJob(null), []);
  const printElement = job ? <PrintableSummary key={job.id} summary={job.summary} fileTitle={job.fileTitle} onDone={done} /> : null;
  return { print, printElement };
}
