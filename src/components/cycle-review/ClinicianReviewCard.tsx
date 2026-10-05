"use client";

import { BookmarkPlus, ClipboardCopy, Printer, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { usePrintSummary } from "@/components/safety/PrintableSummary";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { ReserveButton, ReserveDisclosure } from "@/components/ui/reserve";
import { useAthleteDashboardStore } from "@/lib/athlete-store";
import { buildCycleReviewSummaryDocument } from "@/lib/cycle-review/report";
import { RESERVE, alpha } from "@/lib/design/tokens";
import { renderSummaryText, summaryFileTitle } from "@/lib/safety/summary-document";

import type { CycleReviewModel } from "./useCycleReview";

function formatDay(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatStamp(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

/**
 * Bring this to your clinician — the member's own records and questions,
 * organized for an appointment. Copy it, or keep a dated copy in this cycle's
 * review history. It leaves the device only when the member pastes or prints it.
 */
export function ClinicianReviewCard({ model, now }: { model: CycleReviewModel; now: Date }) {
  const snapshots = useAthleteDashboardStore((s) => s.cycleReviewSnapshots);
  const saveCycleReviewSnapshot = useAthleteDashboardStore((s) => s.saveCycleReviewSnapshot);
  const removeCycleReviewSnapshot = useAthleteDashboardStore((s) => s.removeCycleReviewSnapshot);
  const [status, setStatus] = useState<"idle" | "copied" | "copy-failed" | "saved" | "printing">("idle");
  const { print, printElement } = usePrintSummary();

  const summary = useMemo(() => buildCycleReviewSummaryDocument(model.review, model.input, now), [model, now]);
  const text = useMemo(() => renderSummaryText(summary), [summary]);
  const cycleId = model.cycleState.cycle.id;
  const history = snapshots.filter((s) => s.cycleId === cycleId);
  const { review } = model;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setStatus("copied");
    } catch {
      setStatus("copy-failed");
    }
  };

  const save = () => {
    saveCycleReviewSnapshot(cycleId, text);
    setStatus("saved");
  };

  const facts = [
    { label: "Compounds", value: String(model.compounds.length) },
    { label: "Phase", value: review.weekLine },
    { label: "Latest labs", value: review.lastLabDate ? formatDay(review.lastLabDate) : "None logged" },
    { label: "Questions", value: String(review.questions.length) },
  ];

  return (
    <GlassPanel accent={RESERVE.steel} className="fba-gradient-border">
      <div className="flex flex-col gap-5">
        <div>
          <p className="type-whisper" style={{ color: alpha(RESERVE.steel, 0.9) }}>Bring this to your clinician</p>
          <h3 className="mt-1.5 text-[19px] font-bold leading-tight" style={{ color: RESERVE.ivory }}>
            Your cycle, organized for review
          </h3>
          <p className="mt-1.5 max-w-[560px] text-[12.5px] leading-[1.55] text-white/55">
            Compounds exactly as you entered them, your goal, symptoms, blood pressure, key labs, trends, gaps and your questions. Not a clinical assessment.
          </p>
        </div>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
          {facts.map((fact) => (
            <div key={fact.label}>
              <dt className="type-whisper">{fact.label}</dt>
              <dd className="tnum mt-1 text-[14px] font-semibold" style={{ color: RESERVE.ivory }}>{fact.value}</dd>
            </div>
          ))}
        </dl>

        <div className="flex flex-wrap items-center gap-2">
          <ReserveButton tier="secondary" size="sm" icon={ClipboardCopy} onClick={copy}>
            Copy summary
          </ReserveButton>
          <ReserveButton tier="secondary" size="sm" icon={BookmarkPlus} onClick={save}>
            Save to review history
          </ReserveButton>
          <ReserveButton
            tier="secondary"
            size="sm"
            icon={Printer}
            onClick={() => {
              print(summary, summaryFileTitle("Reserve cycle review", now));
              setStatus("printing");
            }}
          >
            Print or save as PDF
          </ReserveButton>
          <span role="status" className="text-[12px]" style={{ color: status === "copy-failed" ? RESERVE.amber : RESERVE.green }}>
            {status === "copied"
              ? "Copied"
              : status === "saved"
                ? "Saved to this cycle's review history"
                : status === "printing"
                  ? "To keep a file, choose Save as PDF in the print dialog."
                  : status === "copy-failed"
                    ? "Copying isn't available here — select the preview text instead."
                    : ""}
          </span>
        </div>

        <ReserveDisclosure summary="Preview the summary" accent={RESERVE.steel}>
          <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap rounded-[12px] bg-black/30 p-3 font-mono text-[11px] leading-[1.6] text-white/70">
            {text}
          </pre>
        </ReserveDisclosure>

        {history.length > 0 && (
          <ReserveDisclosure summary={`Review history (${history.length})`} accent={RESERVE.slate}>
            <ul className="flex flex-col divide-y divide-white/[0.05]">
              {history.map((snapshot) => (
                <li key={snapshot.id} className="py-2">
                  <div className="flex items-center gap-2">
                    <p className="tnum min-w-0 flex-1 text-[12.5px] text-white/70">Saved {formatStamp(snapshot.savedAt)}</p>
                    <button
                      type="button"
                      onClick={() => removeCycleReviewSnapshot(snapshot.id)}
                      aria-label={`Delete review saved ${formatStamp(snapshot.savedAt)}`}
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px] text-white/35 transition hover:text-white/75 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#5fb7d5]"
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </div>
                  <ReserveDisclosure summary="Show" accent={RESERVE.slate}>
                    <pre className="max-h-[300px] overflow-auto whitespace-pre-wrap rounded-[12px] bg-black/30 p-3 font-mono text-[11px] leading-[1.6] text-white/60">
                      {snapshot.text}
                    </pre>
                  </ReserveDisclosure>
                </li>
              ))}
            </ul>
          </ReserveDisclosure>
        )}
      </div>
      {printElement}
    </GlassPanel>
  );
}
