/* ════════════════════════════════════════════════════════════════════════
   OCR LINES — rebuild the rows of a photographed lab report.

   OCR engines often read a table column by column. Regrouping every word by
   its vertical position, then ordering each row left to right, gives the
   report parser the same rows a person sees — exactly as pdf-text.ts does for
   PDFs. Words the engine was unsure of mark their row for a closer check.
   ════════════════════════════════════════════════════════════════════════ */

export type OcrWord = {
  text: string;
  /** 0–100, from the OCR engine. */
  confidence: number;
  /** Pixels, top-left origin. */
  bbox: { x0: number; y0: number; x1: number; y1: number };
};

export type OcrLine = { text: string; lowConfidence: boolean };

/** Words below this confidence mark their row "check this row". */
export const LOW_CONFIDENCE = 70;

export function ocrWordsToLines(words: OcrWord[]): OcrLine[] {
  const usable = words
    .map((w) => ({ ...w, text: w.text.trim() }))
    .filter((w) => w.text.length > 0 && w.bbox.y1 > w.bbox.y0);
  if (usable.length === 0) return [];

  const heights = usable.map((w) => w.bbox.y1 - w.bbox.y0).sort((a, b) => a - b);
  const median = heights[Math.floor(heights.length / 2)];
  const tolerance = Math.max(4, median * 0.6);

  const centered = usable
    .map((w) => ({ word: w, cy: (w.bbox.y0 + w.bbox.y1) / 2 }))
    .sort((a, b) => a.cy - b.cy || a.word.bbox.x0 - b.word.bbox.x0);

  const lines: OcrLine[] = [];
  let row: typeof centered = [];
  let rowCenter = 0;

  const flush = () => {
    if (row.length === 0) return;
    const ordered = row.sort((a, b) => a.word.bbox.x0 - b.word.bbox.x0);
    lines.push({
      text: ordered.map((r) => r.word.text).join(" ").replace(/\s+/g, " "),
      lowConfidence: ordered.some((r) => r.word.confidence < LOW_CONFIDENCE),
    });
    row = [];
  };

  for (const item of centered) {
    if (row.length > 0 && Math.abs(item.cy - rowCenter) > tolerance) flush();
    row.push(item);
    rowCenter = row.reduce((sum, r) => sum + r.cy, 0) / row.length;
  }
  flush();
  return lines;
}
