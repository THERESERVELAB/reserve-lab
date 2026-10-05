"use client";

import { ChevronRight, FlaskConical, Layers, Library } from "lucide-react";
import { useCallback, useState } from "react";

import { GlassPanel } from "@/components/ui/GlassPanel";
import { ReserveBottomSheet, ReserveButton } from "@/components/ui/reserve";
import { useAthleteDashboardStore } from "@/lib/athlete-store";
import type { SupportArrival } from "@/lib/compound-command/command-room";
import { EVIDENCE_GRADE_LABEL } from "@/lib/compound-intelligence/evidence";
import { COVERAGE_STATE_LABEL, SAFETY_LEVEL_LABEL, type SupportPlanReview } from "@/lib/cycle-review/support-plan";
import { RESERVE, alpha } from "@/lib/design/tokens";

import { EvidenceMapBody } from "./EvidenceMapPanel";
import { SupportItemSheet, type SupportItemTarget } from "./SupportItemSheet";
import { SupportLibrarySheet } from "./SupportLibrarySheet";
import { COVERAGE_COLOR, SAFETY_COLOR } from "./support-tokens";

/* ════════════════════════════════════════════════════════════════════════
   SUPPORT STACK — the room pattern. A statement, three readouts, the
   supplements as rows, and everything else one tap away in a sheet.

   What stays on the page no matter what: the line that no supplement offsets
   harm, any "ask a clinician first" reason, possible duplicate intake, and
   what supplements don't address. Cutting the page never hides a warning.

   Cycle Review keeps the full SupportPlanSection; this is Compound Command's.
   ════════════════════════════════════════════════════════════════════════ */

type Row = { id: string; title: string; meta: string; metaColor: string; ask: string | null };

export function SupportStackRoom({ support, arrival }: { support: SupportPlanReview; arrival?: SupportArrival | null }) {
  const setActiveView = useAthleteDashboardStore((s) => s.setActiveView);
  /* A member who tapped a button naming one of these sheets arrives inside it.
     The room mounts fresh on every arrival, so the opening state is the whole
     mechanism — closing a sheet never reopens it. */
  const [libraryOpen, setLibraryOpen] = useState(arrival === "library");
  const [coverageOpen, setCoverageOpen] = useState(arrival === "evidence");
  const [detailId, setDetailId] = useState<string | null>(null);
  const closeLibrary = useCallback(() => setLibraryOpen(false), []);
  const closeCoverage = useCallback(() => setCoverageOpen(false), []);
  const closeDetail = useCallback(() => setDetailId(null), []);
  const { counts } = support;

  const alerts = counts.interactionAlerts + counts.duplicateAlerts;
  const statement =
    counts.selected === 0
      ? "No supplements tracked"
      : `${counts.selected} supplement${counts.selected === 1 ? "" : "s"} tracked · ${alerts === 0 ? "no alerts" : `${alerts} alert${alerts === 1 ? "" : "s"}`}`;

  const rows: Row[] = [
    ...support.entries.map((entry) => ({
      id: entry.item.id,
      title: entry.option.title,
      meta: `${EVIDENCE_GRADE_LABEL[entry.grade]} · ${SAFETY_LEVEL_LABEL[entry.check.level]}`,
      metaColor: SAFETY_COLOR[entry.check.level],
      ask: entry.check.reasons.find((r) => r.level === "ask" && r.kind !== "duplicate")?.text ?? null,
    })),
    ...support.custom.map((entry) => ({
      id: entry.item.id,
      title: entry.title,
      meta: entry.lines[0] ?? "Entered by you",
      metaColor: "rgba(242,238,230,0.55)",
      ask: null,
    })),
  ].sort((a, b) => a.title.localeCompare(b.title));

  const libraryEntry = support.entries.find((e) => e.item.id === detailId);
  const customEntry = support.custom.find((c) => c.item.id === detailId);
  const detailTarget: SupportItemTarget | null = libraryEntry
    ? { item: libraryEntry.item, title: libraryEntry.option.title, check: libraryEntry.check, timing: libraryEntry.timing }
    : customEntry
      ? { item: customEntry.item, title: customEntry.title, lines: customEntry.lines }
      : null;

  const readouts = [
    { label: "Tracked", value: counts.selected, warn: false },
    { label: "Alerts", value: alerts, warn: alerts > 0 },
    { label: "Areas to watch", value: counts.monitoringAreas, warn: counts.monitoringAreas > 0 },
  ];

  return (
    <>
      <GlassPanel accent={RESERVE.green}>
        <section aria-label="Support plan" className="flex flex-col gap-4" data-support-room>
          <div>
            <p className="type-whisper" style={{ color: alpha(RESERVE.green, 0.9) }}>Support stack · tracking only</p>
            <h3 className="type-section-title mt-1.5" style={{ color: RESERVE.ivory }} data-support-statement>{statement}</h3>
            <p className="type-supporting mt-1.5 max-w-[620px] text-[12.5px]">
              No supplement has been shown to offset harm from anabolic steroids. Supplements can&apos;t make a cycle risk-free or stand in for lab monitoring and medical care.
            </p>
          </div>

          {counts.selected > 0 && (
            <dl className="grid grid-cols-3 gap-4">
              {readouts.map((r) => (
                <div key={r.label}>
                  <dt className="type-whisper">{r.label}</dt>
                  <dd className="tnum mt-1 text-[18px] font-semibold" style={{ color: r.warn ? RESERVE.amber : RESERVE.ivory }}>{r.value}</dd>
                </div>
              ))}
            </dl>
          )}

          {rows.length > 0 && (
            <ul className="flex flex-col divide-y divide-white/[0.05] border-y border-white/[0.05]" aria-label="Supplements you track">
              {rows.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => setDetailId(row.id)}
                    aria-label={`Details for ${row.title}`}
                    className="flex min-h-[48px] w-full items-center gap-3 py-2.5 text-left focus-visible:outline focus-visible:outline-1 focus-visible:outline-white/30"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13.5px] font-semibold" style={{ color: RESERVE.ivory }}>{row.title}</span>
                      <span className="mt-0.5 block text-[11.5px] leading-[1.45]" style={{ color: row.metaColor }}>{row.meta}</span>
                      {row.ask && <span className="mt-0.5 block text-[11.5px] leading-[1.45]" style={{ color: RESERVE.red }}>{row.ask}</span>}
                    </span>
                    <ChevronRight size={15} aria-hidden="true" className="shrink-0 text-white/30" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {support.duplicates.length > 0 && (
            <div>
              <p className="type-whisper" style={{ color: alpha(RESERVE.amber, 0.9) }}>Possible duplicate intake</p>
              <ul className="mt-1.5 flex flex-col gap-1">
                {support.duplicates.map((duplicate) => (
                  <li key={duplicate.nutrient} className="text-[12.5px] leading-[1.5] text-white/80">{duplicate.text}</li>
                ))}
              </ul>
            </div>
          )}

          {/* An empty plan is exactly when a flagged result would otherwise go unanswered. */}
          {support.notAddressed.length > 0 && (
            <div>
              <p className="type-whisper" style={{ color: alpha(RESERVE.amber, 0.9) }}>Supplements don&apos;t address</p>
              <ul className="mt-1.5 flex flex-col gap-1.5">
                {support.notAddressed.map((line) => (
                  <li key={line} className="text-[12.5px] leading-[1.5] text-white/75">{line}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <ReserveButton tier="secondary" size="sm" icon={Library} onClick={() => setLibraryOpen(true)}>
              {counts.selected === 0 ? "Browse supplements" : "Edit supplements"}
            </ReserveButton>
            <ReserveButton tier="quiet" size="sm" icon={Layers} onClick={() => setCoverageOpen(true)}>
              Coverage by system
            </ReserveButton>
            <ReserveButton tier="quiet" size="sm" icon={FlaskConical} onClick={() => setActiveView("bloodwork")}>
              Update labs
            </ReserveButton>
          </div>
          {support.sizeNote && <p className="text-[12px] text-white/50">{support.sizeNote}</p>}
        </section>
      </GlassPanel>

      <ReserveBottomSheet open={coverageOpen} onClose={closeCoverage} title="Coverage by system" accent={RESERVE.green}>
        <div className="flex flex-col gap-5" data-support-coverage>
          {support.covers.length > 0 && (
            <div>
              <p className="type-whisper">Your support plan covers</p>
              <ul className="mt-1.5 flex flex-col gap-1">
                {support.covers.map((line) => (
                  <li key={line} className="text-[12.5px] leading-[1.5] text-white/75">{line}</li>
                ))}
              </ul>
            </div>
          )}
          <section aria-label="Monitoring and support, by system">
            <p className="type-whisper" style={{ color: alpha(RESERVE.steel, 0.9) }}>Monitoring and support, by system</p>
            <ul className="mt-1 flex flex-col divide-y divide-white/[0.05]">
              {support.coverage.map((row) => (
                <li key={row.key} className="flex flex-col gap-0.5 py-2.5">
                  <p className="text-[13.5px] font-semibold" style={{ color: RESERVE.ivory }}>{row.label}</p>
                  <p className="font-mono text-[9px] uppercase tracking-[0.16em]">
                    {row.states.length === 0 ? (
                      <span className="text-white/40">No known load · no support selected</span>
                    ) : (
                      row.states.map((state, index) => (
                        <span key={state} style={{ color: COVERAGE_COLOR[state] }}>
                          {index > 0 && <span className="text-white/25"> · </span>}
                          {COVERAGE_STATE_LABEL[state]}
                        </span>
                      ))
                    )}
                  </p>
                  {row.detail && <p className="type-supporting mt-0.5 text-[12.5px]">{row.detail}</p>}
                </li>
              ))}
            </ul>
          </section>
          {support.evidenceMap && (
            <EvidenceMapBody
              map={support.evidenceMap}
              onBrowse={() => {
                setCoverageOpen(false);
                setLibraryOpen(true);
              }}
            />
          )}
        </div>
      </ReserveBottomSheet>

      <SupportLibrarySheet open={libraryOpen} onClose={closeLibrary} library={support.library} />
      <SupportItemSheet entry={detailTarget} onClose={closeDetail} />
    </>
  );
}
