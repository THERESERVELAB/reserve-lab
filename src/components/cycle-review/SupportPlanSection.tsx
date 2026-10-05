"use client";

import { Check, FlaskConical, Library, Stethoscope } from "lucide-react";
import { useCallback, useRef, useState } from "react";

import { GlassPanel } from "@/components/ui/GlassPanel";
import { ReserveButton } from "@/components/ui/reserve";
import { useAthleteDashboardStore } from "@/lib/athlete-store";
import { EVIDENCE_GRADE_LABEL } from "@/lib/compound-intelligence/evidence";
import { COVERAGE_STATE_LABEL, SAFETY_LEVEL_LABEL, type CustomPlanEntry, type PlanEntry, type SupportPlanReview } from "@/lib/cycle-review/support-plan";
import { RESERVE, alpha } from "@/lib/design/tokens";

import { EvidenceMapPanel } from "./EvidenceMapPanel";
import { SupportItemSheet, type SupportItemTarget } from "./SupportItemSheet";
import { SupportLibrarySheet } from "./SupportLibrarySheet";
import { COVERAGE_COLOR, SAFETY_COLOR, arrowFor, enteredLine } from "./support-tokens";

/* ════════════════════════════════════════════════════════════════════════
   SUPPORT PLAN — the supplements the member chooses to track, and the honest
   picture around them: evidence strength, alerts, coverage by body system,
   and what no supplement can address. A bigger plan never reads as better.

   Shared by Cycle Review (with a clinician summary to jump to) and Compound
   Command → Support Stack (no cycle needed).
   ════════════════════════════════════════════════════════════════════════ */

function Hairline() {
  return <div aria-hidden="true" className="h-px w-full" style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.08) 20%, rgba(255,255,255,0.08) 80%, transparent)" }} />;
}

export function SupportPlanSection({ support, onClinician }: { support: SupportPlanReview; onClinician?: () => void }) {
  const setActiveView = useAthleteDashboardStore((s) => s.setActiveView);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const closeLibrary = useCallback(() => setLibraryOpen(false), []);
  const closeDetail = useCallback(() => setDetailId(null), []);
  const listRef = useRef<HTMLDivElement>(null);
  const { counts } = support;

  const libraryEntry = support.entries.find((e) => e.item.id === detailId);
  const customEntry = support.custom.find((c) => c.item.id === detailId);
  const detailTarget: SupportItemTarget | null = libraryEntry
    ? { item: libraryEntry.item, title: libraryEntry.option.title, check: libraryEntry.check, timing: libraryEntry.timing }
    : customEntry
      ? { item: customEntry.item, title: customEntry.title, lines: customEntry.lines }
      : null;

  const reviewPlan = () => {
    const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    listRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  };

  const metrics = [
    { label: "Stronger evidence", value: counts.stronger, color: RESERVE.ivory },
    { label: "Limited evidence", value: counts.limited, color: RESERVE.ivory },
    { label: "Evidence not shown", value: counts.notShown, color: RESERVE.ivory },
    { label: "Interaction alerts", value: counts.interactionAlerts, color: counts.interactionAlerts ? RESERVE.amber : RESERVE.ivory },
    { label: "Duplicate ingredient alerts", value: counts.duplicateAlerts, color: counts.duplicateAlerts ? RESERVE.amber : RESERVE.ivory },
    { label: "Areas needing monitoring", value: counts.monitoringAreas, color: counts.monitoringAreas ? RESERVE.amber : RESERVE.ivory },
  ];

  return (
    <>
      <GlassPanel accent={RESERVE.green}>
        <section aria-label="Support plan" className="flex flex-col gap-5">
          <div>
            <p className="type-whisper" style={{ color: alpha(RESERVE.green, 0.9) }}>Support plan</p>
            <h3 className="type-section-title mt-1.5" style={{ color: RESERVE.ivory }}>Your support plan</h3>
            <p className="type-command mt-1.5 max-w-[620px]">Choose the supplements you want to track alongside your current plan.</p>
            <p className="type-supporting mt-1.5 max-w-[620px] text-[12.5px]">
              No supplement has been shown to offset harm from anabolic steroids: no nutritional treatment has ever been studied in people using them. Supplements may support specific health markers, but they cannot make a cycle risk-free or substitute for laboratory monitoring or medical care.
            </p>
          </div>

          {counts.selected === 0 ? (
            <div className="flex flex-col gap-3">
              <p className="text-[13px] text-white/65">No supplements selected. Every option in the library shows why it is listed, what it does not address, and a check against your records.</p>
              <div>
                <ReserveButton tier="secondary" icon={Library} onClick={() => setLibraryOpen(true)}>
                  Browse supplements
                </ReserveButton>
              </div>
              {/* What supplements cannot solve belongs here too — an empty plan is
                  exactly when a flagged result would otherwise go unanswered. */}
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
            </div>
          ) : (
            <>
              {/* Phone: the count on its own row, then a full-width grid. Wider: side by side. */}
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-8">
                <p className="tnum shrink-0">
                  <span className="type-metric" style={{ color: RESERVE.ivory }}>{counts.selected}</span>
                  <span className="ml-2 text-[13px] text-white/55">selected</span>
                </p>
                <dl className="grid w-full grid-cols-2 gap-x-6 gap-y-3 sm:flex-1 sm:grid-cols-3">
                  {metrics.map((metric) => (
                    <div key={metric.label}>
                      <dt className="type-whisper">{metric.label}</dt>
                      <dd className="tnum mt-1 text-[16px] font-semibold" style={{ color: metric.color }}>{metric.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <ReserveButton tier="secondary" size="sm" icon={Check} onClick={reviewPlan}>
                  Review support plan
                </ReserveButton>
                <ReserveButton tier="secondary" size="sm" icon={Library} onClick={() => setLibraryOpen(true)}>
                  Edit supplements
                </ReserveButton>
                <ReserveButton tier="quiet" size="sm" icon={FlaskConical} onClick={() => setActiveView("bloodwork")}>
                  Update labs
                </ReserveButton>
                {onClinician && (
                  <ReserveButton tier="quiet" size="sm" icon={Stethoscope} onClick={onClinician}>
                    Bring to clinician
                  </ReserveButton>
                )}
              </div>

              <Hairline />

              <div ref={listRef} className="flex scroll-mt-4 flex-col gap-4">
                <p className="type-whisper">My support plan</p>
                {support.groups.map((group) => (
                  <div key={group.key}>
                    <p className="font-mono text-[9px] uppercase tracking-[0.18em]" style={{ color: alpha(RESERVE.green, 0.8) }}>{group.label}</p>
                    <ul className="mt-1 flex flex-col divide-y divide-white/[0.05]">
                      {group.entries.map((entry) => (
                        <PlanRow key={entry.item.id} entry={entry} onDetails={() => setDetailId(entry.item.id)} />
                      ))}
                    </ul>
                  </div>
                ))}
                {support.custom.length > 0 && (
                  <div>
                    <p className="font-mono text-[9px] uppercase tracking-[0.18em]" style={{ color: alpha(RESERVE.green, 0.8) }}>Entered by you</p>
                    <ul className="mt-1 flex flex-col divide-y divide-white/[0.05]">
                      {support.custom.map((entry) => (
                        <CustomRow key={entry.item.id} entry={entry} onDetails={() => setDetailId(entry.item.id)} />
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {support.duplicates.length > 0 && (
                <div className="rounded-[14px] px-3.5 py-3" style={{ background: alpha(RESERVE.amber, 0.06) }}>
                  <p className="type-whisper" style={{ color: alpha(RESERVE.amber, 0.9) }}>Possible duplicate intake</p>
                  <ul className="mt-1.5 flex flex-col gap-1">
                    {support.duplicates.map((duplicate) => (
                      <li key={duplicate.nutrient} className="text-[12.5px] leading-[1.5] text-white/80">{duplicate.text}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <p className="type-whisper">Your support plan covers</p>
                  <ul className="mt-1.5 flex flex-col gap-1">
                    {support.covers.map((line) => (
                      <li key={line} className="text-[12.5px] leading-[1.5] text-white/75">{line}</li>
                    ))}
                  </ul>
                </div>
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
              </div>
              {support.sizeNote && <p className="text-[12px] text-white/50">{support.sizeNote}</p>}
            </>
          )}
        </section>
      </GlassPanel>

      {support.evidenceMap && <EvidenceMapPanel map={support.evidenceMap} onBrowse={() => setLibraryOpen(true)} />}

      <GlassPanel>
        <section aria-label="Health support" className="flex flex-col gap-3">
          <div>
            <p className="type-whisper" style={{ color: alpha(RESERVE.steel, 0.9) }}>Health support</p>
            <h3 className="type-section-title mt-1.5" style={{ color: RESERVE.ivory }}>Monitoring and support, by system</h3>
          </div>
          <ul className="flex flex-col divide-y divide-white/[0.05]">
            {support.coverage.map((row) => (
              <li key={row.key} className="flex flex-col gap-0.5 py-2.5 sm:flex-row sm:gap-4">
                <p className="shrink-0 text-[13.5px] font-semibold sm:w-[150px]" style={{ color: RESERVE.ivory }}>{row.label}</p>
                <div className="min-w-0 flex-1">
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
                </div>
              </li>
            ))}
          </ul>
        </section>
      </GlassPanel>

      <SupportLibrarySheet open={libraryOpen} onClose={closeLibrary} library={support.library} />
      <SupportItemSheet entry={detailTarget} onClose={closeDetail} />
    </>
  );
}

function PlanRow({ entry, onDetails }: { entry: PlanEntry; onDetails: () => void }) {
  const removeSupportPlanItem = useAthleteDashboardStore((s) => s.removeSupportPlanItem);
  const entered = enteredLine(entry.item);
  return (
    <li className="flex flex-col gap-1.5 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="min-w-0 flex-1 text-[13.5px] font-semibold" style={{ color: RESERVE.ivory }}>
          <Check size={13} aria-hidden="true" className="-mt-0.5 mr-1.5 inline" style={{ color: RESERVE.green }} />
          {entry.option.title}
        </p>
        <ReserveButton tier="quiet" size="sm" onClick={onDetails}>
          Details<span className="sr-only"> for {entry.option.title}</span>
        </ReserveButton>
        <ReserveButton tier="quiet" size="sm" onClick={() => removeSupportPlanItem(entry.item.id)}>
          Remove<span className="sr-only"> {entry.option.title}</span>
        </ReserveButton>
      </div>
      <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/50">
        {EVIDENCE_GRADE_LABEL[entry.grade]} · <span style={{ color: SAFETY_COLOR[entry.check.level] }}>{SAFETY_LEVEL_LABEL[entry.check.level]}</span>
      </p>
      <p className="text-[12px] text-white/55">{entered ? `Member entered: ${entered}` : "Details not entered."}</p>
      {entry.labLinks.length > 0 && (
        <p className="tnum text-[12px] text-white/60">
          {entry.labLinks.map((link) => `${link.label} ${link.value}${arrowFor(link.direction) ? ` ${arrowFor(link.direction)}` : ""}`).join(" · ")}
        </p>
      )}
      {entry.check.reasons.filter((r) => r.kind !== "duplicate").map((reason) => (
        <p key={reason.text} className="text-[12px] leading-[1.5]" style={{ color: reason.level === "ask" ? RESERVE.red : "rgba(242,238,230,0.68)" }}>
          {reason.text}
        </p>
      ))}
      {entry.timing.map((line) => (
        <p key={line} className="text-[12px] leading-[1.5] text-white/55">{line}</p>
      ))}
    </li>
  );
}

function CustomRow({ entry, onDetails }: { entry: CustomPlanEntry; onDetails: () => void }) {
  const removeSupportPlanItem = useAthleteDashboardStore((s) => s.removeSupportPlanItem);
  const entered = enteredLine(entry.item);
  return (
    <li className="flex flex-col gap-1.5 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="min-w-0 flex-1 text-[13.5px] font-semibold" style={{ color: RESERVE.ivory }}>
          <Check size={13} aria-hidden="true" className="-mt-0.5 mr-1.5 inline" style={{ color: RESERVE.green }} />
          {entry.title}
        </p>
        <ReserveButton tier="quiet" size="sm" onClick={onDetails}>
          Details<span className="sr-only"> for {entry.title}</span>
        </ReserveButton>
        <ReserveButton tier="quiet" size="sm" onClick={() => removeSupportPlanItem(entry.item.id)}>
          Remove<span className="sr-only"> {entry.title}</span>
        </ReserveButton>
      </div>
      <p className="text-[12px] text-white/55">{entered ? `Member entered: ${entered}` : "Details not entered."}</p>
      {entry.lines.map((line) => (
        <p key={line} className="text-[12px] leading-[1.5] text-white/55">{line}</p>
      ))}
    </li>
  );
}
