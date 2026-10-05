"use client";

import { Check, ClipboardPaste, FileText, FlaskConical, Loader2, Plus, Trash2, Upload, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useSafetyToolsVisible } from "@/components/authz/CapabilitiesProvider";
import { LabSafetyPanel } from "@/components/labs/LabSafetyPanel";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { DETAIL_BAND_BLEED, DiscardChangesBar, ReserveBottomSheet, ReserveDetailImage, ReserveNotice, ReserveSectionHeader, useDirtySnapshot, useFormCloseGuard } from "@/components/ui/reserve";
import { localDateKey } from "@/lib/dates/local-day";
import { RESERVE } from "@/lib/design/tokens";
import { labSummary } from "@/lib/labs/record-summary";
import { CLINICAL_COPY, clinicalPrimary } from "@/lib/records/clinical-records";
import { formatDayFull } from "@/lib/physique/record-summary";
import { markLabPanelLogged } from "@/components/ui/reserve/log-moment/recorders";
import { useAthleteDashboardStore, type BloodworkMarkerValue } from "@/lib/athlete-store";
import { planIntake } from "@/lib/labs/intake";
import { readingNoteSources, whatAffectsReading, whatItMeasures } from "@/lib/labs/marker-guide";
import { MARKERS, MARKER_SYSTEM_LABEL, isMarkerKey, markerDef, matchMarker, type MarkerKey } from "@/lib/labs/markers";
import { readImagesOnDevice } from "@/lib/labs/ocr";
import type { OcrLine } from "@/lib/labs/ocr-lines";
import { MAX_SCANNED_PAGES, extractPdfLines, renderPdfPagesForOcr } from "@/lib/labs/pdf-text";
import { READING_CHECK_MESSAGE, readingCheck, type ReadingCheck } from "@/lib/labs/reading-check";
import { parseLabValue, parseReferenceRange, positionInRange } from "@/lib/labs/reference-range";
import { parseLabReportText, type ParsedLabReport } from "@/lib/labs/report-parser";
import { LAB_FLAG_LABEL } from "@/lib/labs/types";

import { EnhancedContext } from "./records/EnhancedContext";
import { RecordHero } from "./records/RecordHero";
import { RecordEmpty, RecordList, RecordRow } from "./records/RecordRows";
import { ViewShell } from "./ViewShell";

const STEEL = "#5fb7d5";
const GREEN = "#6ee7b7";
const VIOLET = "#a78bfa";
const AMBER = "#e8c87a";
const SOFT = "#f2eee6";

const PANELS = [
  { name: "Complete Blood Count (CBC)", markers: ["RBC", "WBC", "Hematocrit", "Hemoglobin", "Platelets"] },
  { name: "Comprehensive Metabolic", markers: ["Glucose", "BUN", "Creatinine", "eGFR", "ALT", "AST"] },
  { name: "Hormone Panel", markers: ["Total Testosterone", "Free Testosterone", "LH", "FSH", "Estradiol", "SHBG"] },
  { name: "Lipid Panel", markers: ["Total Cholesterol", "LDL", "HDL", "Triglycerides"] },
];

const FIELD =
  "min-w-0 rounded-lg border border-white/[0.1] bg-white/[0.03] px-2.5 py-2 text-[16px] text-[#f2eee6] outline-none placeholder:text-white/22 focus:border-[#5fb7d5]/50 sm:text-[11.5px]";

const KNOWN_TESTS = [...MARKERS].sort((a, b) => a.label.localeCompare(b.label));
const UNRECOGNIZED_GROUP = "Not recognized";

type SelectedFile = { name: string; type: string; sizeKb: number; previewUrl: string | null };
type ImportState = "idle" | "reading" | "done" | "failed";
type RowSource = "pdf" | "photo" | "scan" | "paste";
/** A row on the review screen. Only the BloodworkMarkerValue fields are ever saved. */
type DraftRow = BloodworkMarkerValue & { source?: RowSource; check?: ReadingCheck; manualKey?: MarkerKey };

const SOURCE_PHRASE: Record<RowSource, string> = {
  pdf: "your PDF",
  photo: "your photos",
  scan: "your scanned PDF",
  paste: "the pasted text",
};

/** The member's own local day — never the UTC day (lib/dates/local-day). */
function todayIso(): string {
  return localDateKey();
}

const PRIMARY = clinicalPrimary("bloodwork");

/** Out of the report's own range, or flagged by the lab. */
function isFlagged(marker: BloodworkMarkerValue): boolean {
  const position = positionInRange(parseLabValue(marker.value), parseReferenceRange(marker.referenceRange));
  return Boolean(marker.labFlag) || position === "above" || position === "below";
}

function keyForRow(row: DraftRow): MarkerKey | undefined {
  return matchMarker(row.name)?.key ?? (row.manualKey && row.name.trim() ? row.manualKey : undefined);
}

function groupLabel(key: MarkerKey | undefined): string {
  return key ? MARKER_SYSTEM_LABEL[markerDef(key).system] : UNRECOGNIZED_GROUP;
}

/** Group indices by panel, known panels in marker order, unrecognized last. */
function groupRows<T>(rows: T[], keyOf: (row: T) => MarkerKey | undefined): Array<{ label: string; indices: number[] }> {
  const order = [...new Set(MARKERS.map((m) => MARKER_SYSTEM_LABEL[m.system])), UNRECOGNIZED_GROUP];
  const byLabel = new Map<string, number[]>();
  rows.forEach((row, index) => {
    const label = groupLabel(keyOf(row));
    byLabel.set(label, [...(byLabel.get(label) ?? []), index]);
  });
  return order.filter((label) => byLabel.has(label)).map((label) => ({ label, indices: byLabel.get(label)! }));
}

export function BloodworkView() {
  // Launch switch: the safety panel and "What this measures" await review — hidden for members, open to the verified owner.
  const safetyToolsVisible = useSafetyToolsVisible();
  const bloodworkLogs = useAthleteDashboardStore((s) => s.bloodworkLogs);
  const addBloodworkLog = useAthleteDashboardStore((s) => s.addBloodworkLog);
  const removeBloodworkLog = useAthleteDashboardStore((s) => s.removeBloodworkLog);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [files, setFiles] = useState<SelectedFile[]>([]);
  const [testDate, setTestDate] = useState(todayIso);
  const [labName, setLabName] = useState("");
  const [notes, setNotes] = useState("");
  const [markers, setMarkers] = useState<DraftRow[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [importState, setImportState] = useState<ImportState>("idle");
  const [importNote, setImportNote] = useState<string | null>(null);
  const [rejections, setRejections] = useState<Array<{ name: string; reason: string }>>([]);
  const [progress, setProgress] = useState<{ label: string; fraction: number } | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      for (const f of files) if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Latest member-entered value per marker (for the panel grid). */
  const latestMarkerValues = useMemo(() => {
    const map = new Map<string, string>();
    // bloodworkLogs is newest-first — keep first hit per marker.
    for (const log of bloodworkLogs) {
      for (const m of log.markers ?? []) {
        const key = (isMarkerKey(m.markerKey) ? m.markerKey : matchMarker(m.name)?.key) ?? m.name.trim().toLowerCase();
        if (key && !map.has(key)) map.set(key, `${m.value}${m.unit ? ` ${m.unit}` : ""}`);
      }
    }
    return map;
  }, [bloodworkLogs]);

  /* The record read the hero prints: counts of the member's own entries, and
     how many of the latest record's rows their OWN lab raised. Reserve adds
     no range and no reason of its own (constitution clinical-data.md). */
  const summary = useMemo(
    () => labSummary(bloodworkLogs.map((log) => ({ id: log.id, testDate: log.testDate, labName: log.labName, markers: log.markers }))),
    [bloodworkLogs],
  );

  function clearFiles() {
    for (const f of files) if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
    setFiles([]);
  }

  /** Adds parsed rows to the review screen. Nothing is saved until the member saves. */
  function applyReport(report: ParsedLabReport, source: RowSource, lines?: OcrLine[]) {
    const unclear = (name: string) => Boolean(lines?.some((line) => line.lowConfidence && line.text.startsWith(name)));
    if (report.markers.length === 0) {
      setImportState("failed");
      setImportNote(
        source === "photo" || source === "scan"
          ? "Reserve couldn't find results in this image. A sharp, well-lit photo taken straight on reads best — or enter the values below."
          : source === "paste"
            ? "Reserve couldn't find results in the pasted text. Paste the rows with test name, result and range, or enter the values below."
            : "Reserve couldn't find results in this PDF. Enter the values below, or paste them.",
      );
      return;
    }
    const context = { fromImage: source === "photo" || source === "scan", reportUsesFlags: report.markers.some((m) => m.labFlag) };
    const rows: DraftRow[] = report.markers.map((m) => ({
      name: m.name,
      value: m.value,
      unit: m.unit,
      referenceRange: m.referenceRange,
      labFlag: m.labFlag,
      markerKey: m.markerKey,
      source,
      check: readingCheck({ ...m, unclear: unclear(m.name) }, context) ?? undefined,
    }));
    setMarkers((current) => [...current.filter((m) => m.name.trim() || m.value.trim()), ...rows]);
    if (report.collectedDate) setTestDate(report.collectedDate);
    if (report.labName) setLabName((current) => current.trim() || report.labName!);
    setImportState("done");
    const count = `${report.markers.length} ${report.markers.length === 1 ? "result" : "results"}`;
    const unread = report.unreadLineCount
      ? ` ${report.unreadLineCount} more ${report.unreadLineCount === 1 ? "line" : "lines"} couldn't be read — add ${report.unreadLineCount === 1 ? "it" : "them"} below if needed.`
      : "";
    const checkCount = rows.filter((row) => row.check).length;
    const marked = checkCount ? ` ${checkCount} ${checkCount === 1 ? "row is" : "rows are"} marked to check.` : "";
    const check = context.fromImage ? " Photos can be misread — check every digit against your report." : " Check every value against your report before saving.";
    setImportNote(`Read ${count} from ${SOURCE_PHRASE[source]}.${unread}${marked}${check}`);
  }

  async function readWithOcr(images: Blob[], source: "photo" | "scan", extraNote = "") {
    const controller = new AbortController();
    abortRef.current = controller;
    setImportState("reading");
    setImportNote(null);
    const noun = source === "scan" ? "page" : "photo";
    setProgress({ label: `Preparing to read on this device`, fraction: 0 });
    try {
      const pages = await readImagesOnDevice(images, {
        signal: controller.signal,
        onProgress: (p) => setProgress({ label: `Reading ${noun} ${p.page} of ${p.pages} on this device`, fraction: (p.page - 1 + p.fraction) / p.pages }),
      });
      const lines = pages.flat();
      applyReport(parseLabReportText(lines.map((l) => l.text).join("\n")), source, lines);
      if (extraNote) setImportNote((note) => `${note ?? ""} ${extraNote}`.trim());
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setImportState("idle");
        setImportNote("Stopped reading. Enter the values below instead.");
      } else {
        setImportState("failed");
        setImportNote("Reserve couldn't read this image on this device. Enter the values below instead.");
      }
    } finally {
      abortRef.current = null;
      setProgress(null);
    }
  }

  /* A lab report is read on this device only. Nothing is uploaded, and only
     the rows the member keeps are saved. */
  async function importPdf(pdf: File) {
    setImportState("reading");
    setImportNote(null);
    setProgress({ label: "Reading your PDF on this device", fraction: 0 });
    try {
      const lines = await extractPdfLines(pdf);
      if (lines.length > 0) {
        setProgress(null);
        applyReport(parseLabReportText(lines.join("\n")), "pdf");
        return;
      }
      // No text layer: a scanned report. Read its pages as images.
      const { images, totalPages } = await renderPdfPagesForOcr(pdf);
      const extra = totalPages > MAX_SCANNED_PAGES ? `Only the first ${MAX_SCANNED_PAGES} of ${totalPages} scanned pages were read.` : "";
      await readWithOcr(images, "scan", extra);
    } catch {
      setProgress(null);
      setImportState("failed");
      setImportNote("This file couldn't be opened as a PDF. Enter the values below instead.");
    }
  }

  function onFilesSelected(list: FileList | null) {
    const picked = Array.from(list ?? []);
    if (picked.length === 0) return;
    const plan = planIntake(picked);
    setRejections(plan.rejected);
    setFormOpen(true);
    const accepted = plan.pdf ? [plan.pdf] : plan.images;
    if (accepted.length === 0) {
      setImportState("failed");
      setImportNote(null);
      return;
    }
    clearFiles();
    setFiles(
      accepted.map((f) => ({
        name: f.name,
        type: f.type || "file",
        sizeKb: Math.max(1, Math.round(f.size / 1024)),
        previewUrl: f.type.startsWith("image/") ? URL.createObjectURL(f) : null,
      })),
    );
    if (plan.pdf) void importPdf(plan.pdf);
    else void readWithOcr(plan.images, "photo");
  }

  function readPasted() {
    if (!pasteText.trim()) return;
    applyReport(parseLabReportText(pasteText), "paste");
    // The pasted text itself is never kept.
    setPasteText("");
    setPasteOpen(false);
  }

  function updateMarker(i: number, updates: Partial<DraftRow>) {
    setMarkers((prev) => prev.map((m, idx) => (idx === i ? { ...m, ...updates } : m)));
  }

  function resetForm() {
    abortRef.current?.abort();
    clearFiles();
    setLabName("");
    setNotes("");
    setMarkers([]);
    setImportState("idle");
    setImportNote(null);
    setRejections([]);
    setProgress(null);
    setPasteOpen(false);
    setPasteText("");
    setFormOpen(false);
  }

  /* Escape, the backdrop or the X hide the sheet and KEEP the draft — a
     member who closes by accident loses nothing (accessibility.md rule 6).
     Cancel is the control that discards. Stable: the sheet re-runs its focus
     effect whenever onClose changes. */
  const closeForm = useCallback(() => setFormOpen(false), []);
  /* Cancel is the one close that discards, so it asks first once anything is
     entered. (Escape, the backdrop, the X and a drag keep the draft.) */
  const intakeDirty = useDirtySnapshot({ files: files.map((file) => file.name), labName, notes, markers, pasteText });
  const cancelGuard = useFormCloseGuard(intakeDirty, resetForm, { escape: false });
  /* Hidden with the draft kept, the sheet reopens without the question. */
  if (!formOpen && cancelGuard.confirming) cancelGuard.keepEditing();

  function save() {
    const cleanMarkers = markers
      .filter((m) => m.name.trim() && m.value.trim())
      .map((m) => ({
        name: m.name.trim(),
        value: m.value.trim(),
        unit: m.unit?.trim() || undefined,
        referenceRange: m.referenceRange?.trim() || undefined,
        labFlag: m.labFlag,
        // Re-matched on save so an edited name keeps its trend history honest;
        // a test the member matched by hand keeps that match.
        markerKey: keyForRow(m),
      }));
    if (files.length === 0 && cleanMarkers.length === 0 && !notes.trim()) return;
    addBloodworkLog({
      testDate,
      labName: labName.trim() || undefined,
      fileName: files.length === 1 ? files[0].name : files.length > 1 ? `${files.length} photos` : undefined,
      fileType: files.length === 1 ? files[0].type : files.length > 1 ? "image" : undefined,
      fileSizeKb: files.length ? files.reduce((sum, f) => sum + f.sizeKb, 0) : undefined,
      notes: notes.trim() || undefined,
      markers: cleanMarkers.length ? cleanMarkers : undefined,
    });
    /* The room answers this log the way it answers every other one — the
       quiet mark, never a verdict on what the panel says. */
    markLabPanelLogged({ markerCount: cleanMarkers.length, fileCount: files.length, testDate: testDate || null });
    resetForm();
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2200);
  }

  const reading = importState === "reading";
  const canSave = !reading && (files.length > 0 || markers.some((m) => m.name.trim() && m.value.trim()) || Boolean(notes.trim()));
  const groups = groupRows(markers, keyForRow);
  const totalKb = files.reduce((sum, f) => sum + f.sizeKb, 0);

  return (
    <ViewShell
      label="Lab Panels"
      title="Bloodwork Log"
      icon={FlaskConical}
      accentColor={STEEL}
      roomHero
      command="Your own results, read on this device and organized for your clinician."
      disclaimer="Reserve compares results with the reference range printed on your own lab report and shows what to review with a clinician. It does not diagnose, treat, or prescribe."
    >
      <RecordHero
        testId="bloodwork"
        accent={STEEL}
        eyebrow={`Private laboratory · ${summary.recordCount} ${summary.recordCount === 1 ? "record" : "records"}`}
        statement={summary.statement}
        support={
          summary.recordCount > 0
            ? CLINICAL_COPY.recordSupport
            : "Add a PDF, photograph the pages, or paste your results. Everything is read here on your device — nothing is uploaded."
        }
        reads={[
          {
            label: "Lab records",
            value: summary.recordCount > 0 ? String(summary.recordCount) : null,
            detail: summary.spanDays !== null ? `over ${summary.spanDays} days` : undefined,
            empty: "Evidence needed · none logged",
          },
          {
            label: "Results on latest",
            value: summary.newestResultCount > 0 ? String(summary.newestResultCount) : null,
            detail: summary.newest ? formatDayFull(summary.newest.testDate) : undefined,
            empty: "Evidence needed",
          },
          {
            label: "Your lab raised",
            value: summary.recordCount > 0 ? String(summary.newestFlaggedCount) : null,
            detail: summary.recordCount > 0 ? "flagged, or outside your report's range" : undefined,
            empty: "Evidence needed",
          },
        ]}
        action={{ label: PRIMARY.label, icon: Plus, onClick: () => setFormOpen(true) }}
      />

      {savedFlash && (
        <p role="status" className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.18em]" style={{ color: GREEN }}>
          <Check size={12} aria-hidden="true" />
          {CLINICAL_COPY.labRecordLogged}
        </p>
      )}

      {/* Hidden real file input. It stays on the page, outside the sheet, so a
          report handed straight to it opens the sheet with the rows it read. */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="application/pdf,image/jpeg,image/png,image/webp,.heic,.heif"
        className="hidden"
        onChange={(e) => { onFilesSelected(e.target.files); e.target.value = ""; }}
      />

      {/* ── Lab intake, in a sheet. The page used to carry a "Log a lab result"
             section that restated the gold action; its explanation and the
             on-device notice now open with the intake itself. ── */}
      <ReserveBottomSheet open={formOpen} onClose={closeForm} title={CLINICAL_COPY.intakeTitle} accent={STEEL}>
          <div data-record="lab-intake">
            <p className="text-[12.5px] leading-[1.6] text-white/65">{CLINICAL_COPY.intakeExplain}</p>
            <ReserveNotice tone="info" title={CLINICAL_COPY.readOnDeviceTitle} className="mb-4 mt-3">
              {CLINICAL_COPY.readOnDeviceBody}
            </ReserveNotice>
            {/* File lane */}
            {files.length > 0 ? (
              <div className="flex flex-wrap items-center gap-3 rounded-xl bg-white/[0.025] p-3">
                {files.some((f) => f.previewUrl) ? (
                  <div className="flex shrink-0 gap-1.5">
                    {files.filter((f) => f.previewUrl).slice(0, 4).map((f) => (
                      <div key={f.name} className="h-16 w-12 overflow-hidden rounded-lg border border-white/[0.08]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={f.previewUrl!} alt={f.name} className="h-full w-full object-cover" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg border" style={{ borderColor: `${STEEL}33`, background: `${STEEL}10`, color: STEEL }}>
                    {reading ? <Loader2 size={18} className="animate-spin" /> : <FileText size={18} />}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-bold" style={{ color: SOFT }}>
                    {files.length === 1 ? files[0].name : `${files.length} photos of one report`}
                  </p>
                  <p className="font-mono text-[7.5px] uppercase tracking-[0.12em] text-white/35">
                    {progress ? progress.label : `${files.length === 1 ? files[0].type : "images"} · ${totalKb} KB · stays on your device`}
                  </p>
                  {progress && (
                    <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-white/[0.06]" role="progressbar" aria-label={progress.label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress.fraction * 100)}>
                      <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${Math.max(4, Math.round(progress.fraction * 100))}%`, background: STEEL }} />
                    </div>
                  )}
                </div>
                {reading ? (
                  <button type="button" onClick={() => abortRef.current?.abort()} className="min-h-[44px] rounded-lg border border-white/[0.1] px-3 font-mono text-[8px] uppercase tracking-[0.14em] text-white/60 transition hover:text-white">
                    Stop reading
                  </button>
                ) : (
                  <button type="button" onClick={() => { clearFiles(); setImportState("idle"); setImportNote(null); }} aria-label="Remove files" className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-white/[0.08] text-white/40 transition hover:text-white"><X size={12} /></button>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <button type="button" onClick={() => fileInputRef.current?.click()} className="group flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-5 py-6 transition hover:bg-white/[0.025]" style={{ borderColor: `${STEEL}38`, background: `${STEEL}07` }}>
                  <span className="grid h-10 w-10 place-items-center rounded-xl border transition-transform duration-200 group-hover:scale-105" style={{ borderColor: `${STEEL}40`, background: `${STEEL}12`, color: STEEL }}><Upload size={16} /></span>
                  <p className="text-[12px] font-bold" style={{ color: SOFT }}>Add your lab report — a PDF, or photos of the pages</p>
                  <p className="font-mono text-[7.5px] uppercase tracking-[0.14em] text-white/30">PDF, JPG, PNG or WebP · read on your device — nothing is uploaded</p>
                </button>
                {!pasteOpen && (
                  <button type="button" onClick={() => setPasteOpen(true)} className="inline-flex min-h-[44px] items-center justify-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.14em] transition hover:brightness-125" style={{ color: STEEL }}>
                    <ClipboardPaste size={11} />Paste results instead
                  </button>
                )}
              </div>
            )}

            {pasteOpen && (
              <div className="mt-3 rounded-xl bg-white/[0.025] p-3">
                <label className="block">
                  <span className="mb-1.5 block font-mono text-[7.5px] uppercase tracking-[0.16em] text-white/35">Paste results from your patient portal</span>
                  <textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)} rows={6} placeholder={"HEMATOCRIT 52.1 H 38.5-50.0 %\nGLUCOSE 88 65-99 mg/dL"} className="w-full rounded-lg border border-white/[0.12] bg-white/[0.03] px-3 py-2 font-mono text-[16px] text-[#f2eee6] outline-none placeholder:text-white/25 focus:border-[#5fb7d5]/50 sm:text-[12px]" />
                </label>
                <p className="mt-1 text-[11px] text-white/40">Read on this device. The pasted text isn&apos;t saved — only the results you confirm.</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" onClick={readPasted} disabled={!pasteText.trim()} title={pasteText.trim() ? "Read the pasted results" : "Paste your results first"} className="min-h-[44px] rounded-xl border px-3 font-mono text-[8px] uppercase tracking-[0.14em] transition disabled:cursor-not-allowed disabled:opacity-40" style={{ borderColor: `${STEEL}50`, color: STEEL }}>
                    Read pasted results
                  </button>
                  <button type="button" onClick={() => { setPasteOpen(false); setPasteText(""); }} className="min-h-[44px] px-2 font-mono text-[8px] uppercase tracking-[0.14em] text-white/35 transition hover:text-white/65">Cancel</button>
                </div>
              </div>
            )}

            {rejections.length > 0 && (
              <ul className="mt-3 flex flex-col gap-1 rounded-xl px-3 py-2" style={{ background: `${AMBER}12` }}>
                {rejections.map((r) => (
                  <li key={`${r.name}-${r.reason}`} className="text-[12px] leading-[1.5]" style={{ color: AMBER }}>
                    {r.name}: {r.reason}
                  </li>
                ))}
              </ul>
            )}

            {importNote && (
              <p role="status" className="mt-3 rounded-xl px-3 py-2 text-[12px] leading-[1.5]" style={{ background: `${importState === "failed" ? AMBER : STEEL}12`, color: importState === "failed" ? AMBER : `${STEEL}` }}>
                {importNote}
              </p>
            )}

            {/* Details */}
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block font-mono text-[7.5px] uppercase tracking-[0.16em] text-white/35">Test date</span>
                <input type="date" value={testDate} onChange={(e) => setTestDate(e.target.value)} className="w-full rounded-lg border border-white/[0.12] bg-white/[0.03] px-3 py-2 text-[16px] font-semibold text-[#f2eee6] outline-none focus:border-[#5fb7d5]/50 sm:text-[12px]" />
              </label>
              <label className="block">
                <span className="mb-1.5 block font-mono text-[7.5px] uppercase tracking-[0.16em] text-white/35">Lab name (optional)</span>
                <input type="text" value={labName} onChange={(e) => setLabName(e.target.value)} maxLength={60} placeholder="e.g. Quest, Labcorp" className="w-full rounded-lg border border-white/[0.12] bg-white/[0.03] px-3 py-2 text-[16px] text-[#f2eee6] outline-none placeholder:text-white/25 focus:border-[#5fb7d5]/50 sm:text-[12px]" />
              </label>
            </div>

            {/* Marker rows — imported or typed, always reviewable, grouped by panel */}
            <div className="mt-3">
              <div className="mb-1.5 flex items-center justify-between">
                <p className="font-mono text-[7.5px] uppercase tracking-[0.16em] text-white/35">Results · exactly as listed on your report</p>
                <button type="button" onClick={() => setMarkers((prev) => [...prev, { name: "", value: "", unit: "", referenceRange: "" }])} className="inline-flex min-h-[44px] items-center gap-1 font-mono text-[8px] uppercase tracking-[0.14em] transition hover:brightness-125" style={{ color: STEEL }}>
                  <Plus size={10} />Add Result
                </button>
              </div>
              {groups.map((group) => (
                <section key={group.label} aria-label={group.label} className="mt-3 first:mt-0">
                  <p className="mb-1.5 font-mono text-[8px] uppercase tracking-[0.18em]" style={{ color: `${STEEL}bb` }}>{group.label}</p>
                  <div className="space-y-2.5">
                    {group.indices.map((i) => {
                      const m = markers[i];
                      const key = keyForRow(m);
                      const recognized = matchMarker(m.name);
                      const flagged = isFlagged(m);
                      const measures = safetyToolsVisible ? whatItMeasures(key) : null;
                      const affectedBy = safetyToolsVisible ? whatAffectsReading(key) : null;
                      const fromImage = m.source === "photo" || m.source === "scan";
                      return (
                        /* Keeps its radius, sheds its rim: a row inside a panel is
                           not a second card (components.md rule 1). A row worth
                           checking separates with light, not with a heavier box. */
                        <div key={i} className="rounded-xl px-2.5 py-2" style={{ background: m.check || flagged ? `${AMBER}12` : "rgba(255,255,255,0.025)" }}>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <input aria-label="Test name" type="text" value={m.name} onChange={(e) => updateMarker(i, { name: e.target.value, check: undefined })} placeholder="Test (e.g. Hematocrit)" maxLength={60} className={`${FIELD} flex-[1_1_100%] sm:flex-[2_1_160px]`} />
                            <input aria-label="Result" type="text" value={m.value} onChange={(e) => updateMarker(i, { value: e.target.value, check: undefined })} placeholder="Result" maxLength={20} className={`${FIELD} flex-[1_1_120px] sm:flex-[1_1_70px]`} />
                            <input aria-label="Unit" type="text" value={m.unit ?? ""} onChange={(e) => updateMarker(i, { unit: e.target.value })} placeholder="Unit" maxLength={20} className={`${FIELD} flex-[1_1_70px]`} />
                            <input aria-label="Reference range" type="text" value={m.referenceRange ?? ""} onChange={(e) => updateMarker(i, { referenceRange: e.target.value })} placeholder="Range on report" maxLength={24} className={`${FIELD} flex-[1_1_100px]`} />
                            <button type="button" onClick={() => setMarkers((prev) => prev.filter((_, idx) => idx !== i))} aria-label={`Remove ${m.name || "result"}`} className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-white/[0.08] text-white/40 transition hover:text-white"><X size={11} /></button>
                          </div>
                          <p className="mt-1 font-mono text-[8px] uppercase tracking-[0.12em] text-white/35">
                            {key ? `${recognized ? "Recognized" : "Matched"} as ${markerDef(key).label}` : m.name.trim() ? "Not recognized — saved as written" : ""}
                            {m.labFlag ? ` · Lab flag: ${LAB_FLAG_LABEL[m.labFlag]}` : ""}
                            {fromImage ? " · Read from a photo — check every digit" : ""}
                          </p>
                          {m.check && (
                            <p className="mt-1 text-[11.5px] leading-[1.45]" style={{ color: AMBER }}>{READING_CHECK_MESSAGE[m.check]}</p>
                          )}
                          {measures && <p className="mt-1 text-[11.5px] leading-[1.45] text-white/50">What this measures: {measures}</p>}
                          {/* A result can read wrong for reasons that are not the organ it measures. */}
                          {affectedBy && <p className="mt-1 text-[11.5px] leading-[1.45]" style={{ color: AMBER }}>What can change this reading: {affectedBy}</p>}
                          {!recognized && m.name.trim() && (
                            <label className="mt-1.5 flex flex-wrap items-center gap-2">
                              <span className="font-mono text-[8px] uppercase tracking-[0.12em] text-white/40">Match to a known test</span>
                              <select
                                aria-label={`Match ${m.name} to a known test`}
                                value={m.manualKey ?? ""}
                                onChange={(e) => updateMarker(i, { manualKey: isMarkerKey(e.target.value) ? e.target.value : undefined })}
                                className="min-h-[44px] rounded-lg border border-white/[0.1] bg-[#0b0c12] px-2.5 text-[16px] text-[#f2eee6] outline-none focus:border-[#5fb7d5]/50 sm:text-[12px]"
                              >
                                <option value="">Keep as written</option>
                                {KNOWN_TESTS.map((def) => (
                                  <option key={def.key} value={def.key}>{def.label}</option>
                                ))}
                              </select>
                            </label>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>

            <label className="mt-3 block">
              <span className="mb-1.5 block font-mono text-[7.5px] uppercase tracking-[0.16em] text-white/35">Notes (optional)</span>
              <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={140} placeholder="e.g. Fasted draw · review with clinician at next visit" className="w-full rounded-lg border border-white/[0.12] bg-white/[0.03] px-3 py-2 text-[16px] text-[#f2eee6] outline-none placeholder:text-white/25 focus:border-[#5fb7d5]/50 sm:text-[12px]" />
            </label>

            {/* Beside the Cancel it answers, so it is on screen when asked. */}
            <div className="mt-4 empty:hidden"><DiscardChangesBar guard={cancelGuard} /></div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button type="button" onClick={save} disabled={!canSave} title={canSave ? "Save this lab record" : reading ? "Wait for the report to finish reading" : "Attach a file, add a result, or write a note first"} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl px-4 py-2.5 text-[12px] font-bold text-black transition-all duration-200 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40" style={{ background: `linear-gradient(120deg, #8fd3ec, ${STEEL})` }}>
                <Check size={14} />Save Lab Record
              </button>
              <button type="button" onClick={cancelGuard.requestClose} className="min-h-[44px] px-2 font-mono text-[8px] uppercase tracking-[0.14em] text-white/35 transition hover:text-white/65">Cancel</button>
            </div>
          </div>
      </ReserveBottomSheet>

      {/* ── Safety. Gating is unchanged: production hides these until clinician
             and counsel sign-off (src/lib/launch/safety-tools.ts). ── */}
      {safetyToolsVisible && <LabSafetyPanel />}

      {/* The member's own cycle beside their own draws, plus symptom reporting
          and escalation. It renders only when they have logged a compound or a
          cycle, and only behind the same launch switch and acknowledgement.
          The lab panel above already carries the watched markers and the lab
          escalations, so this does not repeat them. */}
      <EnhancedContext showWatchedMarkers={false} showLabEscalations={false} gate={false} />

      {/* ── Record history ── */}
      <GlassPanel accent={VIOLET} phone="flush">
        <ReserveDetailImage id="labs-clinic" className={DETAIL_BAND_BLEED} />
        <ReserveSectionHeader label={`Lab history · ${bloodworkLogs.length}`} accent={RESERVE.violet} />
        {bloodworkLogs.length ? (
          /* Hairline rows, not tinted tiles inside the panel (components.md rule 1). */
          <RecordList label="Lab records, newest first">
            {bloodworkLogs.map((log) => {
              const logMarkers = log.markers ?? [];
              const logKey = (m: BloodworkMarkerValue) => (isMarkerKey(m.markerKey) ? m.markerKey : matchMarker(m.name)?.key);
              const logGroups = groupRows(logMarkers, logKey);
              const described = [...new Set(logMarkers.map(logKey).filter((k): k is MarkerKey => Boolean(k)))];
              /* Results on this record that something the member takes can move. */
              const moveable = described.filter((key) => whatAffectsReading(key));
              return (
                <RecordRow key={log.id}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[12.5px] font-black" style={{ color: SOFT }}>{log.testDate}</p>
                      {log.labName && <span className="font-mono text-[8px] uppercase tracking-[0.12em] text-white/40">{log.labName}</span>}
                      <span className="rounded border px-1.5 py-0.5 font-mono text-[6.5px] uppercase tracking-[0.1em]" style={{ borderColor: `${STEEL}40`, color: STEEL }}>Logged</span>
                    </div>
                    <button type="button" onClick={() => removeBloodworkLog(log.id)} aria-label="Delete this record" className="grid h-11 w-11 place-items-center rounded-lg border border-white/[0.08] text-white/40 transition hover:text-[#ef7d55]"><Trash2 size={12} /></button>
                  </div>
                  {log.fileName && (
                    <p className="mt-1 inline-flex items-center gap-1.5 font-mono text-[7.5px] uppercase tracking-[0.1em] text-white/35"><FileText size={9} />{log.fileName}{log.fileSizeKb ? ` · ${log.fileSizeKb} KB` : ""} · read on your device, not stored</p>
                  )}
                  {logGroups.map((group) => (
                    <div key={group.label} className="mt-2">
                      <p className="mb-1 font-mono text-[7.5px] uppercase tracking-[0.16em] text-white/35">{group.label}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {group.indices.map((i) => {
                          const m = logMarkers[i];
                          const flagged = isFlagged(m);
                          return (
                            /* A result is content the member reads, not a decorative
                               label — it keeps a legible size (accessibility.md). */
                            <span key={i} className="tnum rounded-lg px-2 py-1 text-[12px] text-white/70" style={{ background: flagged ? `${AMBER}14` : "rgba(255,255,255,0.03)" }}>
                              <span className="text-white/55">{m.name} · </span>
                              <span style={{ color: flagged ? AMBER : undefined }}>{m.value}{m.unit ? ` ${m.unit}` : ""}</span>
                              {m.referenceRange && <span className="text-white/45"> · {m.referenceRange}</span>}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  {safetyToolsVisible && described.length > 0 && (
                    <details className="group mt-2">
                      <summary className="flex min-h-[44px] cursor-pointer list-none items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.14em]" style={{ color: `${STEEL}cc` }}>
                        <span aria-hidden="true" className="inline-block transition-transform group-open:rotate-90">›</span>What these tests measure
                      </summary>
                      <ul className="flex flex-col gap-1 pb-1">
                        {described.map((key) => (
                          <li key={key} className="text-[11px] leading-[1.5] text-white/55">
                            <span className="text-white/75">{markerDef(key).label}:</span> {whatItMeasures(key)}
                          </li>
                        ))}
                      </ul>
                      <p className="text-[10px] text-white/35">General descriptions, awaiting clinician review. What your own results mean is a conversation for a clinician, a telehealth visit or a pharmacist.</p>
                      {moveable.length > 0 && (
                        <>
                          <p className="mt-2.5 font-mono text-[8px] uppercase tracking-[0.14em]" style={{ color: `${STEEL}cc` }}>What can change a reading</p>
                          <ul className="mt-1 flex flex-col gap-1.5 pb-1">
                            {moveable.map((key) => (
                              <li key={key} className="text-[11px] leading-[1.5] text-white/55">
                                <span className="text-white/75">{markerDef(key).label}:</span> {whatAffectsReading(key)}
                                <span className="block text-[10px] text-white/35">
                                  {readingNoteSources(key).map((src, i) => (
                                    <span key={src.label}>
                                      {i > 0 && " · "}
                                      {src.url ? (
                                        <a href={src.url} target="_blank" rel="noreferrer" className="underline decoration-white/20 underline-offset-2 hover:text-white/60">{src.label}</a>
                                      ) : (
                                        src.label
                                      )}
                                    </span>
                                  ))}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </>
                      )}
                    </details>
                  )}
                  {log.notes && <p className="mt-1.5 text-[12px] leading-snug text-white/55">{log.notes}</p>}
                </RecordRow>
              );
            })}
          </RecordList>
        ) : (
          /* Names what is missing. The way in is the hero's gold action, not a
             second copy of it here. */
          <RecordEmpty
            headline="No lab records yet"
            body="Needs one lab report: a PDF, photos of the pages, or results pasted from your patient portal. You confirm every row, and what you keep becomes a private, dated record."
          />
        )}
      </GlassPanel>

      {/* ── Latest value per test. Four bordered cards on a dark fill became one
             surface with hairline rows: two surface levels, not three. ── */}
      <GlassPanel accent={STEEL} phone="flush">
        <ReserveSectionHeader label="Latest value by panel" accent={RESERVE.steel} />
        <div className="grid gap-x-10 gap-y-6 lg:grid-cols-2">
          {PANELS.map(({ name, markers: panelMarkers }) => (
            <section key={name} aria-label={name}>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em]" style={{ color: STEEL }}>{name}</p>
              <RecordList label={name} className="mt-2.5">
                {panelMarkers.map((m) => {
                  const v = latestMarkerValues.get(matchMarker(m)?.key ?? m.toLowerCase());
                  return (
                    <RecordRow key={m} className="py-2.5">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="text-[13px] text-[#f2eee6]">{m}</p>
                        <span className="tnum text-[13px]" style={{ color: v ? SOFT : "rgba(255,255,255,0.4)" }}>
                          {v ?? "Not logged"}
                        </span>
                      </div>
                    </RecordRow>
                  );
                })}
              </RecordList>
            </section>
          ))}
        </div>
        <p className="mt-5 max-w-[72ch] text-[12px] leading-[1.6] text-white/45">
          Your latest logged value for each test. Ranges and flags come only from your own lab reports — Reserve supplies
          none of its own, and a row reading &ldquo;Not logged&rdquo; means exactly that.
        </p>
      </GlassPanel>
    </ViewShell>
  );
}
