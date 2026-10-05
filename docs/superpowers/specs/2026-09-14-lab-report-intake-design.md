# Lab Report Intake — Design

**Date:** 2026-09-14 · **Status:** approved by owner direction ("accept files from the user to understand and comprehend their blood work panels"), in build.

## Goal

A member can hand Reserve their lab report in whatever form they have it and get back an organized, reviewable set of results:
- a text PDF
- a scanned PDF
- one or more photos
- text pasted from a patient portal

Every row goes through the member's confirmation. Nothing leaves the device.

## Boundary (unchanged)

- **On the device only.** Files are read on the member's device and never uploaded. The private `bloodwork-uploads` storage bucket stays unused by the client.
- **What gets saved.** Only rows the member confirms are saved. Patient name, date of birth, account numbers and raw report text are never stored.
- **Where comparisons come from.** Results are compared only against the reference range printed on the member's own report, and carry the lab's own flag.
- **What "understand" means.** A plain-language line on what each recognized test measures, plus grouping by panel. It never interprets the member's value, names a condition, or says what caused a result. The guide ships `pending-clinician-review`.

## Current state (2026-09-14)

**What works:**
- Text-layer PDFs from Quest or Labcorp are parsed, and every row is reviewable before saving.
- Images can be attached, but are never read.

**What doesn't:**
- Scanned PDFs return nothing.
- Text results ("Negative") are dropped.
- Only `M/D/YYYY` dates are recognized.
- There is no file-size limit.
- There is no way to match an unrecognized test name to a known test.

## Intake

| Input | Path |
| --- | --- |
| PDF with a text layer | Existing `unpdf` positioned-text extraction → parser |
| PDF without a text layer (scanned) | Render up to 6 pages with `unpdf.renderPageAsImage` in the browser → OCR → parser |
| JPG / PNG / WebP photos (up to 8, one report) | OCR each image in order → parser |
| HEIC / HEIF | Not decoded; message: "Save or share the photo as JPEG or PNG, then add it." |
| Pasted text | Parser directly |

Limits:
- 25 MB per file, matching the private storage bucket.
- 8 images.
- 30 text pages, which is the existing limit.
- 6 scanned pages.

Any file outside the limits gets a plain message, and the member can still type results.

## On-device OCR

- **Engine.** `tesseract.js` 7 (Apache-2.0), English LSTM (`best_int`). It is loaded lazily, only when a photo or scanned page needs reading.
- **Assets are self-hosted.** `scripts/copy-ocr-assets.mjs` (run on `predev` and `prebuild`) copies these from `node_modules` into `public/ocr/`, which is gitignored:
  - the worker script
  - the LSTM core variants
  - the gzipped English model
- **Worker setup.** `workerPath`, `corePath` and `langPath` point at `/ocr`, with `workerBlobURL: false`. No CDN, and no request carries member data.
- **Lines from positions.** Word boxes become lines by position (`ocrWordsToLines`, pure and unit-tested), then go through the same report parser as PDFs.
- **Progress and cancel.** "Reading photo 2 of 3 on this device…". Cancel terminates the worker, and the worker is also terminated after each run.
- **Confidence.** Rows read by OCR are labeled "Read from a photo — check every digit". A row with any word below confidence 70 is also marked for a closer check.
- **Reading check (`reading-check.ts`).** OCR can misread a digit with high confidence, so each imported row is also compared with its own report. A row is marked for checking when the result and the lab's flag disagree (any source); or, from a photo or scan, when the result reads outside the printed range with no flag on a report that prints flags elsewhere, or sits 10× or more beyond a printed limit. One message per row, in that priority after "unclear". Editing the result or name clears the mark, and the import note counts the marked rows.

## Parser upgrades (`report-parser.ts`)

- **Text results.** Negative, Positive, Reactive, Non-Reactive, Detected, Not Detected, None Seen, Trace, Normal, Abnormal, Clear, Yellow. They are paired with text reference ranges.
- **More flags.** `*`, `!`, `(H)`, `(L)`, `H*`, `L*`.
- **Dates.**
  - `YYYY-MM-DD`
  - `Sep 1, 2026` and `September 1, 2026`
  - `01-Sep-2026` and `1 Sep 2026`
  - the existing `M/D/YYYY`
- **OCR digit repair.** Applied only inside a token that is otherwise numeric: `O`/`o` becomes `0`, and `l`/`I` becomes `1`. A repaired row is marked for a closer check.
- **Split units.** `mg / dL` becomes `mg/dL`.
- **More lab names.** BioReference, Sonic Healthcare, ARUP, Mayo Clinic Laboratories and Ulta Lab Tests, in addition to Quest and Labcorp.

## Understanding the panel

- **Marker guide.** `src/lib/labs/marker-guide.ts` gives every canonical marker a one-sentence "What this measures" and a MedlinePlus source. A test enforces the banned-language list and a no-condition-names list.
- **Review screen.**
  - Rows are grouped by panel (the existing `MARKER_SYSTEM_LABEL`).
  - Each recognized row shows what the test measures.
  - An unrecognized row offers "Match to a known test". The chosen `markerKey` is kept on save, so trends and flags follow it.
- **History.** Each saved record lists results grouped by panel, and each test's description can be opened.

## Tests

- **Unit tests.**
  - Parser: text results, new flags, date formats, digit repair and split units.
  - `ocrWordsToLines` and the confidence marking.
  - Intake validation: types, sizes, counts, HEIC.
  - Marker guide: coverage and compliance.
- **E2E: photo.** A synthetic lab table is rendered to PNG and uploaded; the test checks results are read and recognized, and a row is labeled "Read from a photo".
- **E2E: paste.** Pasted text is parsed.
- **E2E: HEIC.** A HEIC file gets the conversion message.
- **E2E: regression.** The existing Quest PDF test still passes.

## Review packets

- **Clinician packet.** Gains Section H, the marker guide.
- **Counsel packet.** Records that photos and scanned reports are read on-device by an open-source OCR engine. Existing questions 12 (data minimization) and 20 (misreads) now also cover OCR.
