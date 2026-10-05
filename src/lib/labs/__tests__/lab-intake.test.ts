import { describe, expect, it } from "vitest";

import { bannedLanguageIn } from "@/lib/safety/__tests__/compliance-language";

import { HEIC_MESSAGE, MAX_FILE_BYTES, MAX_IMAGES, classifyFile, planIntake } from "../intake";
import { MARKER_GUIDE, MARKER_GUIDE_VERSION, MARKERS_WITH_READING_NOTES, readingNoteSources, whatAffectsReading, whatItMeasures } from "../marker-guide";
import { MARKERS, type MarkerKey } from "../markers";
import { LOW_CONFIDENCE, ocrWordsToLines, type OcrWord } from "../ocr-lines";
import { FAR_FROM_RANGE_FACTOR, READING_CHECK_MESSAGE, readingCheck } from "../reading-check";
import { findCollectedDate, parseLabLine, parseLabReportText } from "../report-parser";

const file = (name: string, type: string, size = 1_000) => ({ name, type, size });

describe("lab report intake", () => {
  it("classifies what Reserve can read", () => {
    expect(classifyFile(file("report.pdf", "application/pdf"))).toBe("pdf");
    expect(classifyFile(file("page1.JPG", ""))).toBe("image");
    expect(classifyFile(file("page1.webp", "image/webp"))).toBe("image");
    expect(classifyFile(file("IMG_0001.HEIC", ""))).toBe("heic");
    expect(classifyFile(file("export.csv", "text/csv"))).toBe("unsupported");
  });

  it("takes one PDF, or up to eight photos of one report, and names every rejection", () => {
    const pdfPlan = planIntake([file("a.pdf", "application/pdf"), file("b.png", "image/png")]);
    expect(pdfPlan.pdf?.name).toBe("a.pdf");
    expect(pdfPlan.rejected).toEqual([{ name: "b.png", reason: "Add one PDF, or photos of one report, per lab record." }]);

    const photos = Array.from({ length: MAX_IMAGES + 1 }, (_, i) => file(`p${i}.jpg`, "image/jpeg"));
    const photoPlan = planIntake(photos);
    expect(photoPlan.images).toHaveLength(MAX_IMAGES);
    expect(photoPlan.rejected[0].reason).toBe("Up to 8 photos per lab record.");

    const mixed = planIntake([file("big.pdf", "application/pdf", MAX_FILE_BYTES + 1), file("IMG.heic", "image/heic"), file("x.docx", "")]);
    expect(mixed.pdf).toBeNull();
    expect(mixed.rejected.map((r) => r.reason)).toEqual(["This file is larger than 25 MB.", HEIC_MESSAGE, "Reserve reads PDF, JPG, PNG or WebP lab reports."]);
  });
});

describe("OCR rows", () => {
  const word = (text: string, x0: number, y0: number, confidence = 95): OcrWord => ({ text, confidence, bbox: { x0, y0, x1: x0 + 40, y1: y0 + 18 } });

  it("rebuilds table rows read column by column, left to right", () => {
    const lines = ocrWordsToLines([
      word("HEMATOCRIT", 20, 100), word("GLUCOSE", 20, 140),
      word("52.1", 300, 102), word("88", 300, 139),
      word("H", 360, 101), word("38.5-50.0", 420, 99), word("65-99", 420, 141),
    ]);
    expect(lines.map((l) => l.text)).toEqual(["HEMATOCRIT 52.1 H 38.5-50.0", "GLUCOSE 88 65-99"]);
  });

  it("marks a row the engine was unsure of", () => {
    const [row] = ocrWordsToLines([word("ALT", 20, 100), word("4l", 300, 100, LOW_CONFIDENCE - 1)]);
    expect(row.lowConfidence).toBe(true);
  });

  it("feeds the same parser as PDFs", () => {
    const text = ocrWordsToLines([word("HEMATOCRIT", 20, 100), word("52.1", 300, 100), word("H", 360, 100), word("38.5-50.0", 420, 100), word("%", 520, 100)])
      .map((l) => l.text)
      .join("\n");
    expect(parseLabReportText(text).markers[0]).toMatchObject({ markerKey: "hematocrit", value: "52.1", labFlag: "H", referenceRange: "38.5-50.0", unit: "%" });
  });
});

describe("report parser — more real-world formats", () => {
  it("reads qualitative results with a printed text range", () => {
    expect(parseLabLine("HEPATITIS C ANTIBODY NON-REACTIVE NON-REACTIVE")).toMatchObject({ name: "HEPATITIS C ANTIBODY", value: "NON-REACTIVE", referenceRange: "NON-REACTIVE" });
    expect(parseLabLine("URINE PROTEIN Negative Negative")).toMatchObject({ value: "Negative", referenceRange: "Negative" });
    expect(parseLabLine("Result Negative")).toBeNull();
  });

  it("reads star, bang and parenthesized flags", () => {
    expect(parseLabLine("HEMATOCRIT 52.1 (H) 38.5-50.0 %")).toMatchObject({ labFlag: "H", referenceRange: "38.5-50.0" });
    expect(parseLabLine("GLUCOSE 110 * 65-99 mg/dL")).toMatchObject({ labFlag: "A" });
    expect(parseLabLine("HDL CHOLESTEROL 32 L* > OR = 40 mg/dL")).toMatchObject({ labFlag: "L", referenceRange: "≥ 40" });
  });

  it("repairs likely OCR digit misreads, and says so", () => {
    expect(parseLabLine("HEMOGLOBIN 1O.2 L 13.2-17.1 g/dL")).toMatchObject({ value: "10.2", repaired: true });
    expect(parseLabLine("HEMOGLOBIN 10.2 L 13.2-17.1 g/dL")?.repaired).toBeUndefined();
  });

  it("joins units split by spaces", () => {
    expect(parseLabLine("GLUCOSE 88 65-99 mg / dL")).toMatchObject({ unit: "mg/dL" });
  });

  it("reads collection dates in the formats portals print", () => {
    expect(findCollectedDate("Collected: 09/01/2026")).toBe("2026-09-01");
    expect(findCollectedDate("Collection Date: 2026-08-15")).toBe("2026-08-15");
    expect(findCollectedDate("Date Collected Sep 1, 2026 7:45 AM")).toBe("2026-09-01");
    expect(findCollectedDate("Specimen Collected: 01-Sep-2026")).toBe("2026-09-01");
    expect(findCollectedDate("Date of Service 3 September 2026")).toBe("2026-09-03");
    expect(findCollectedDate("Reported: 09/05/2026")).toBeUndefined();
  });

  it("names more labs", () => {
    expect(parseLabReportText("BioReference Laboratories\nGLUCOSE 88 65-99 mg/dL").labName).toBe("BioReference");
  });
});

describe("reading check", () => {
  const photo = { fromImage: true, reportUsesFlags: true };

  it("marks a photo row whose result reads outside the range with no flag, on a report that prints flags", () => {
    // Synthetic photo: "ALT 41 9-46" read as "ALT 4 9-46".
    expect(readingCheck({ value: "4", referenceRange: "9-46" }, photo)).toBe("missing-flag");
    expect(readingCheck({ value: "41", referenceRange: "9-46" }, photo)).toBeNull();
    expect(readingCheck({ value: "4", referenceRange: "9-46" }, { fromImage: true, reportUsesFlags: false })).toBeNull();
    expect(readingCheck({ value: "4", referenceRange: "9-46" }, { fromImage: false, reportUsesFlags: true })).toBeNull();
  });

  it("marks a result that disagrees with the lab's own flag, from any source", () => {
    expect(readingCheck({ value: "5.21", referenceRange: "38.5-50.0", labFlag: "H" }, { fromImage: false, reportUsesFlags: true })).toBe("flag-mismatch");
    expect(readingCheck({ value: "45", referenceRange: "38.5-50.0", labFlag: "L" }, photo)).toBe("flag-mismatch");
    expect(readingCheck({ value: "52.1", referenceRange: "38.5-50.0", labFlag: "H" }, photo)).toBeNull();
    expect(readingCheck({ value: "32", referenceRange: "≥ 40", labFlag: "L" }, photo)).toBeNull();
    expect(readingCheck({ value: "110", referenceRange: "65-99", labFlag: "A" }, photo)).toBeNull();
  });

  it("marks a photo result ten times beyond a printed limit as a possible digit misread", () => {
    expect(readingCheck({ value: "521", referenceRange: "38.5-50.0", labFlag: "H" }, photo)).toBe("far-from-range");
    expect(readingCheck({ value: "0.9", referenceRange: "9-46" }, { fromImage: true, reportUsesFlags: false })).toBe("far-from-range");
    expect(readingCheck({ value: `${46 * FAR_FROM_RANGE_FACTOR - 1}`, referenceRange: "9-46", labFlag: "H" }, photo)).toBeNull();
    expect(readingCheck({ value: "521", referenceRange: "38.5-50.0", labFlag: "H" }, { fromImage: false, reportUsesFlags: true })).toBeNull();
  });

  it("puts an unclear reading first, and stays quiet when there is nothing to compare", () => {
    expect(readingCheck({ value: "521", referenceRange: "38.5-50.0", repaired: true }, photo)).toBe("unclear");
    expect(readingCheck({ value: "4", unclear: true }, photo)).toBe("unclear");
    expect(readingCheck({ value: "NON-REACTIVE", referenceRange: "NON-REACTIVE" }, photo)).toBeNull();
    expect(readingCheck({ value: "<0.5", referenceRange: "0.2-4.0", labFlag: "H" }, photo)).toBeNull();
    expect(readingCheck({ value: "88" }, photo)).toBeNull();
  });

  it("asks the member to check the reading — never says what the value means", () => {
    for (const [check, message] of Object.entries(READING_CHECK_MESSAGE)) {
      expect(message, check).toMatch(/^Check this row against your report — /);
      expect(bannedLanguageIn(message), check).toEqual([]);
      expect(message, check).not.toMatch(/\b(wrong|error|normal|abnormal|healthy|concerning|dangerous|means|indicates|caused?)\b/i);
    }
  });
});

describe("marker guide", () => {
  it("describes every canonical marker and awaits clinician review", () => {
    for (const def of MARKERS) {
      expect(MARKER_GUIDE[def.key]?.measures, def.key).toBeTruthy();
      expect(MARKER_GUIDE[def.key].review).toEqual({ status: "pending-clinician-review", version: MARKER_GUIDE_VERSION });
    }
    expect(whatItMeasures("hematocrit")).toBe("The share of your blood volume made up of red blood cells.");
    expect(whatItMeasures(undefined)).toBeNull();
  });

  it("explains what a test measures — never a condition, a cause or what a value means", () => {
    for (const [key, entry] of Object.entries(MARKER_GUIDE)) {
      expect(bannedLanguageIn(entry.measures), key).toEqual([]);
      expect(entry.measures, key).not.toMatch(/\b(disease|disorder|deficien|failure|diabetes|cancer|syndrome|infection|anemia|damage|high levels?|low levels?|elevated|abnormal|healthy|normal|risk|means|indicates|caused?)\b/i);
    }
  });
});

describe("what can change a reading", () => {
  it("covers the markers a member is most likely to misread, and nothing without a note", () => {
    /* The two confounds members hit constantly: creatine on kidney rows and
       biotin on every hormone and thyroid immunoassay. */
    expect(MARKERS_WITH_READING_NOTES).toContain("creatinine");
    expect(MARKERS_WITH_READING_NOTES).toContain("egfr");
    expect(MARKERS_WITH_READING_NOTES).toContain("psa");
    const biotinAssays: MarkerKey[] = ["tsh", "free-t4", "free-t3", "total-testosterone", "free-testosterone", "estradiol", "lh", "fsh", "shbg", "cortisol", "ferritin", "vitamin-b12"];
    for (const key of biotinAssays) expect(whatAffectsReading(key), key).toMatch(/^Biotin, /);
    expect(whatAffectsReading("hematocrit")).toBeNull();
    expect(whatAffectsReading(undefined)).toBeNull();
    expect(readingNoteSources("hematocrit")).toEqual([]);
  });

  it("cites every note", () => {
    for (const key of MARKERS_WITH_READING_NOTES) {
      const sources = readingNoteSources(key);
      expect(sources.length, key).toBeGreaterThan(0);
      for (const src of sources) expect(src.label, key).toBeTruthy();
    }
  });

  it("describes the measurement, never a verdict, a condition or a direction to the member", () => {
    for (const key of MARKERS_WITH_READING_NOTES) {
      const note = whatAffectsReading(key) ?? "";
      expect(bannedLanguageIn(note), key).toEqual([]);
      /* No verdict on the member's own number and no condition named. */
      expect(note, key).not.toMatch(/(normal|abnormal|healthy|unhealthy|dangerous|disease|disorder|diagnos|failure|means|indicates)/i);
      /* Never tell anyone to start, stop or change what they take. */
      expect(note, key).not.toMatch(/(should|must|recommend|stop taking|start taking|avoid taking|switch to)/i);
      /* No amounts — that is a dosage instruction however it is framed. */
      expect(note, key).not.toMatch(/d+s*(mg|g|mcg|iu|ml)/i);
    }
    /* Always routes the member to the people who read the result. */
    expect(whatAffectsReading("tsh")).toMatch(/Tell the lab and your clinician/);
  });
});
