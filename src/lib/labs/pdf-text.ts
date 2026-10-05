/* ════════════════════════════════════════════════════════════════════════
   PDF TEXT — rebuild the rows of a lab report from positioned text.

   A lab PDF is a table. pdf.js returns each cell as a separate text item, and
   joining them in stream order can run a whole row together
   ("HEMATOCRIT52.1H38.5-50.0%") or interleave columns. Grouping items by
   their vertical position, then ordering each group left to right,
   reconstructs the row a person sees.

   Runs in the browser only. The file never leaves the device.
   ════════════════════════════════════════════════════════════════════════ */

export type PdfTextItem = {
  str: string;
  /** Horizontal position in PDF units. */
  x: number;
  /** Vertical position in PDF units — larger is higher on the page. */
  y: number;
  page: number;
};

/** Items whose baselines sit within this many PDF units share a row. */
export const LINE_TOLERANCE = 2.5;
export const MAX_PDF_PAGES = 30;

export function groupTextItemsIntoLines(items: PdfTextItem[], tolerance = LINE_TOLERANCE): string[] {
  const sorted = items
    .filter((item) => item.str.trim().length > 0)
    .sort((a, b) => a.page - b.page || b.y - a.y || a.x - b.x);

  const lines: string[] = [];
  let row: PdfTextItem[] = [];
  let rowY = 0;
  let rowPage = -1;

  const flush = () => {
    if (row.length === 0) return;
    lines.push(
      row
        .sort((a, b) => a.x - b.x)
        .map((item) => item.str.trim())
        .join(" ")
        .replace(/\s+/g, " "),
    );
    row = [];
  };

  for (const item of sorted) {
    if (row.length > 0 && (item.page !== rowPage || Math.abs(item.y - rowY) > tolerance)) flush();
    if (row.length === 0) {
      rowY = item.y;
      rowPage = item.page;
    }
    row.push(item);
  }
  flush();
  return lines;
}

type PositionedTextItem = { str: string; transform: number[] };

function isPositionedTextItem(item: unknown): item is PositionedTextItem {
  return (
    typeof item === "object" &&
    item !== null &&
    typeof (item as { str?: unknown }).str === "string" &&
    Array.isArray((item as { transform?: unknown }).transform)
  );
}

/** Scanned PDFs are read by OCR one page at a time; this caps the work. */
export const MAX_SCANNED_PAGES = 6;

/**
 * Browser-only. Renders the pages of a PDF with no text layer to PNG images
 * so they can be read by on-device OCR. Nothing leaves the device.
 */
export async function renderPdfPagesForOcr(file: File, maxPages = MAX_SCANNED_PAGES): Promise<{ images: Blob[]; totalPages: number }> {
  const { getDocumentProxy, renderPageAsImage } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()));
  const images: Blob[] = [];
  for (let pageNumber = 1; pageNumber <= Math.min(pdf.numPages, maxPages); pageNumber++) {
    const png = await renderPageAsImage(pdf, pageNumber, { scale: 2 });
    images.push(new Blob([png], { type: "image/png" }));
  }
  return { images, totalPages: pdf.numPages };
}

/** Browser-only. Throws when the file is not a readable PDF. */
export async function extractPdfLines(file: File): Promise<string[]> {
  const { getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()));
  const items: PdfTextItem[] = [];
  const pageCount = Math.min(pdf.numPages, MAX_PDF_PAGES);
  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    for (const item of content.items) {
      if (!isPositionedTextItem(item)) continue;
      items.push({ str: item.str, x: item.transform[4] ?? 0, y: item.transform[5] ?? 0, page: pageNumber });
    }
  }
  return groupTextItemsIntoLines(items);
}
