/* ════════════════════════════════════════════════════════════════════════
   ON-DEVICE OCR — read photographed or scanned lab reports in the browser.

   The engine (tesseract.js, Apache-2.0) and its English model are served from
   Reserve's own origin (/ocr, copied by scripts/copy-ocr-assets.mjs). Images
   are read inside a Web Worker on the member's device; nothing is uploaded
   and no request carries member data. The worker is shut down after every
   run, and a run can be cancelled.
   ════════════════════════════════════════════════════════════════════════ */

import { ocrWordsToLines, type OcrLine, type OcrWord } from "./ocr-lines";

export type OcrProgress = { page: number; pages: number; fraction: number };

const OCR_BASE = "/ocr";

type TesseractModule = typeof import("tesseract.js");

async function loadTesseract(): Promise<TesseractModule> {
  const mod = (await import("tesseract.js")) as TesseractModule & { default?: TesseractModule };
  return mod.default ?? mod;
}

/** Browser-only. Returns the rows read from each image, in order. Throws an AbortError when cancelled. */
export async function readImagesOnDevice(
  images: Blob[],
  options: { onProgress?: (progress: OcrProgress) => void; signal?: AbortSignal } = {},
): Promise<OcrLine[][]> {
  const Tesseract = await loadTesseract();
  let current = 0;
  const worker = await Tesseract.createWorker("eng", Tesseract.OEM.LSTM_ONLY, {
    workerPath: `${OCR_BASE}/worker.min.js`,
    corePath: `${OCR_BASE}/core`,
    langPath: `${OCR_BASE}/lang`,
    gzip: true,
    workerBlobURL: false,
    logger: (message) => {
      if (message.status === "recognizing text") {
        options.onProgress?.({ page: current + 1, pages: images.length, fraction: message.progress });
      }
    },
  });

  let cancelled = false;
  const cancel = () => {
    cancelled = true;
    void worker.terminate().catch(() => undefined);
  };
  options.signal?.addEventListener("abort", cancel, { once: true });

  try {
    await worker.setParameters({ tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK, preserve_interword_spaces: "1" });
    const pages: OcrLine[][] = [];
    for (let index = 0; index < images.length; index++) {
      if (cancelled || options.signal?.aborted) throw new DOMException("Reading was stopped.", "AbortError");
      current = index;
      options.onProgress?.({ page: index + 1, pages: images.length, fraction: 0 });
      const { data } = await worker.recognize(images[index], {}, { blocks: true });
      const words: OcrWord[] = (data.blocks ?? []).flatMap((block) =>
        block.paragraphs.flatMap((paragraph) =>
          paragraph.lines.flatMap((line) => line.words.map((word) => ({ text: word.text, confidence: word.confidence, bbox: word.bbox }))),
        ),
      );
      pages.push(ocrWordsToLines(words));
    }
    return pages;
  } catch (error) {
    if (cancelled || options.signal?.aborted) throw new DOMException("Reading was stopped.", "AbortError");
    throw error;
  } finally {
    options.signal?.removeEventListener("abort", cancel);
    if (!cancelled) await worker.terminate().catch(() => undefined);
  }
}
