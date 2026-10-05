import { describe, expect, it } from "vitest";

import { groupTextItemsIntoLines } from "../pdf-text";
import { parseLabLine, parseLabReportText } from "../report-parser";

/* Synthetic reports in the shape of real Quest and Labcorp PDFs. No real
   patient data. */

const QUEST = [
  "Quest Diagnostics Incorporated",
  "Patient: TEST PATIENT DOB: 01/02/1980 Age: 45",
  "Collected: 09/01/2026 07:45 Received: 09/01/2026",
  "Test Name In Range Out Of Range Reference Range Lab",
  "HEMATOCRIT 52.1 H 38.5-50.0 % 01",
  "HEMOGLOBIN 17.4 H 13.2-17.1 g/dL 01",
  "TESTOSTERONE, TOTAL, MS 1,250 H 250-1100 ng/dL 02",
  "HDL CHOLESTEROL 32 L > OR = 40 mg/dL 01",
  "CHOLESTEROL, TOTAL 212 H <200 mg/dL 01",
  "GLUCOSE 88 65-99 mg/dL 01",
  "EGFR 95 > OR = 60 mL/min/1.73m2 01",
  "EGFR AFRICAN AMERICAN 110 > OR = 60 mL/min/1.73m2 01",
  "IGF 1, LC/MS 180 88-240 ng/mL 02",
  "VITAMIN D,25-OH,TOTAL,IA 32 30-100 ng/mL 01",
  "POTASSIUM 6.9 HH 3.5-5.3 mmol/L 01",
  "Page 1 of 3",
].join("\n");

const LABCORP = [
  "LabCorp",
  "Date Collected: 08/15/2026",
  "Hematocrit 01 52.1 High 37.5-51.0 %",
  "WBC 01 6.1 5.9 01/02/2025 x10E3/uL 3.4-10.8",
  "LDL Chol Calc (NIH) 01 162 High 0-99 mg/dL",
  "Testosterone 01 1250 High 264-916 ng/dL",
  "Free Testosterone(Direct) 01 25.1 High 8.7-25.1 pg/mL",
].join("\n");

describe("parseLabReportText — Quest", () => {
  const report = parseLabReportText(QUEST);
  const byKey = (key: string) => report.markers.find((m) => m.markerKey === key);

  it("reads the lab and collection date", () => {
    expect(report.labName).toBe("Quest Diagnostics");
    expect(report.collectedDate).toBe("2026-09-01");
  });

  it("reads every result row and nothing else", () => {
    expect(report.markers.map((m) => m.markerKey)).toEqual([
      "hematocrit", "hemoglobin", "total-testosterone", "hdl", "total-cholesterol",
      "glucose", "egfr", "igf-1", "vitamin-d", "potassium",
    ]);
  });

  it("carries value, flag, range and unit exactly", () => {
    expect(byKey("hematocrit")).toMatchObject({ value: "52.1", labFlag: "H", referenceRange: "38.5-50.0", unit: "%" });
    expect(byKey("total-testosterone")).toMatchObject({ value: "1,250", labFlag: "H", referenceRange: "250-1100", unit: "ng/dL" });
    expect(byKey("hdl")).toMatchObject({ value: "32", labFlag: "L", referenceRange: "≥ 40", unit: "mg/dL" });
    expect(byKey("total-cholesterol")).toMatchObject({ referenceRange: "<200" });
    expect(byKey("glucose")?.labFlag).toBeUndefined();
    expect(byKey("potassium")?.labFlag).toBe("HH");
    expect(byKey("egfr")).toMatchObject({ value: "95", unit: "mL/min/1.73m2" });
  });

  it("reads a marker whose name contains a number", () => {
    expect(byKey("igf-1")).toMatchObject({ value: "180", referenceRange: "88-240" });
    expect(byKey("vitamin-d")).toMatchObject({ value: "32" });
  });

  it("keeps the first of a repeated test", () => {
    expect(report.markers.filter((m) => m.markerKey === "egfr")).toHaveLength(1);
  });
});

describe("parseLabReportText — Labcorp", () => {
  const report = parseLabReportText(LABCORP);
  const byKey = (key: string) => report.markers.find((m) => m.markerKey === key);

  it("reads the lab and collection date", () => {
    expect(report.labName).toBe("Labcorp");
    expect(report.collectedDate).toBe("2026-08-15");
  });

  it("skips the lab code and reads a word flag", () => {
    expect(byKey("hematocrit")).toMatchObject({ value: "52.1", labFlag: "H", referenceRange: "37.5-51.0", unit: "%" });
  });

  it("finds units and range past a previous-result column", () => {
    expect(byKey("wbc")).toMatchObject({ value: "6.1", unit: "x10E3/uL", referenceRange: "3.4-10.8" });
  });

  it("maps Labcorp names to canonical markers", () => {
    expect(byKey("ldl")).toMatchObject({ value: "162", labFlag: "H" });
    expect(byKey("total-testosterone")).toMatchObject({ value: "1250" });
    expect(byKey("free-testosterone")).toMatchObject({ value: "25.1", unit: "pg/mL" });
  });
});

describe("parseLabLine", () => {
  it("keeps an unknown test only when it prints a range", () => {
    const unknown = parseLabLine("HOMOCYSTEINE 14.2 H <11.4 umol/L 01");
    expect(unknown).toMatchObject({ name: "HOMOCYSTEINE", value: "14.2", labFlag: "H", referenceRange: "<11.4", unit: "umol/L" });
    expect(unknown?.markerKey).toBeUndefined();
    expect(parseLabLine("HOMOCYSTEINE 14.2")).toBeNull();
  });

  it("rejects headers, addresses and page numbers", () => {
    expect(parseLabLine("Page 2 of 4")).toBeNull();
    expect(parseLabLine("Account Number 123456 Phone 555-1212")).toBeNull();
    expect(parseLabLine("Patient Age 45 Sex M")).toBeNull();
  });
});

describe("groupTextItemsIntoLines", () => {
  it("rebuilds a table row from separately positioned cells", () => {
    const lines = groupTextItemsIntoLines([
      { str: "38.5-50.0", x: 300, y: 700.4, page: 1 },
      { str: "HEMATOCRIT", x: 40, y: 700, page: 1 },
      { str: "52.1", x: 200, y: 699.2, page: 1 },
      { str: "H", x: 240, y: 700, page: 1 },
      { str: "GLUCOSE", x: 40, y: 680, page: 1 },
      { str: "88", x: 200, y: 680, page: 1 },
      { str: "TSH", x: 40, y: 700, page: 2 },
    ]);
    expect(lines).toEqual(["HEMATOCRIT 52.1 H 38.5-50.0", "GLUCOSE 88", "TSH"]);
  });
});
