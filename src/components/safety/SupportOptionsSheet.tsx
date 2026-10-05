"use client";

import { Check, Plus } from "lucide-react";
import { useMemo, useState } from "react";

import { AddedTimePrompt } from "@/components/enhancement/command/AddedTimePrompt";
import { compoundIdentity } from "@/components/safety/useSafetyContext";
import { ReserveBottomSheet, ReserveButton, ReserveDisclosure } from "@/components/ui/reserve";
import { useAthleteDashboardStore, type EnhancementEntry } from "@/lib/athlete-store";
import { RISK_SYSTEM_LABEL, type CompoundRiskBrief } from "@/lib/compound-intelligence/risk-profiles";
import {
  EVIDENCE_GRADE_DETAIL,
  EVIDENCE_GRADE_LABEL,
  optionInLog,
  overlapsForOption,
  supportAreasForBrief,
  supportForArea,
  type EvidenceGrade,
  type SupportArea,
  type SupportFinding,
  type SupportOption,
} from "@/lib/compound-intelligence/support-options";
import { RESERVE, alpha } from "@/lib/design/tokens";
import { markerDef } from "@/lib/labs/markers";

/* ════════════════════════════════════════════════════════════════════════
   SUPPORT OPTIONS — one affected area, the options that exist for it, and an
   honest reading of the evidence. The member chooses; Reserve only records
   the choice in their support plan. Alphabetical, never ranked; no amounts,
   no timing.
   ════════════════════════════════════════════════════════════════════════ */

const EMPTY_ENTRIES: EnhancementEntry[] = [];

const GRADE_COLOR: Record<EvidenceGrade, string> = {
  "well-studied": RESERVE.green,
  some: RESERVE.steel,
  limited: "rgba(255,255,255,0.55)",
  "not-shown": "rgba(255,255,255,0.4)",
  uncertain: "rgba(255,255,255,0.4)",
};

function Kicker({ children }: { children: React.ReactNode }) {
  return <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/40">{children}</p>;
}

export function SupportOptionsSheet({
  area,
  brief,
  onClose,
}: {
  area: SupportArea | null;
  brief: CompoundRiskBrief;
  /** Keep stable (useCallback) — ReserveBottomSheet re-focuses when it changes. */
  onClose: () => void;
}) {
  const entries = useAthleteDashboardStore((s) => s.trainingSession.enhancementLog) ?? EMPTY_ENTRIES;
  const identities = useMemo(() => entries.map(compoundIdentity), [entries]);
  const support = area ? supportForArea(area) : null;
  const compoundNames = area ? supportAreasForBrief(brief).find((entry) => entry.area === area)?.compoundNames ?? [] : [];

  return (
    <ReserveBottomSheet
      open={area !== null}
      onClose={onClose}
      title={support ? `${support.label} — support options` : "Support options"}
      accent={RESERVE.steel}
    >
      {support && (
        <div className="flex flex-col gap-4">
          <div>
            {compoundNames.length > 0 && <p className="text-[11.5px] text-white/45">Affected by {compoundNames.join(", ")}</p>}
            <p className="mt-1 max-w-[620px] text-[12.5px] leading-[1.6] text-white/65">
              What the research shows about options people consider for this area. You decide. Some interact with medicines, so review with your clinician before adding anything new.
            </p>
          </div>

          {support.note && (
            <p
              className="rounded-[12px] px-3 py-2.5 text-[12.5px] leading-[1.55]"
              style={{ border: `1px solid ${alpha(RESERVE.amber, 0.3)}`, background: alpha(RESERVE.amber, 0.06), color: RESERVE.ivory }}
            >
              {support.note}
            </p>
          )}

          {support.options.length === 0 ? (
            <p className="text-[12.5px] text-white/55">Reserve has no support options with evidence for this area.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {support.options.map(({ option, finding }) => (
                <li key={option.key}>
                  <OptionCard option={option} finding={finding} brief={brief} inLog={optionInLog(option, identities)} />
                </li>
              ))}
            </ul>
          )}

          <p className="text-[11px] leading-[1.5] text-white/40">
            Listed alphabetically, not by strength. Adding an option puts it in the support plan inside Cycle Review, with no amount or schedule. Reserve never suggests amounts or timing.
          </p>
        </div>
      )}
    </ReserveBottomSheet>
  );
}

function OptionCard({ option, finding, brief, inLog }: { option: SupportOption; finding: SupportFinding; brief: CompoundRiskBrief; inLog: boolean }) {
  const supportPlan = useAthleteDashboardStore((s) => s.supportPlan);
  const addSupportPlanItem = useAthleteDashboardStore((s) => s.addSupportPlanItem);
  const { overlaps, interactions } = useMemo(() => overlapsForOption(option, brief), [option, brief]);
  /* Added here, it lands in the log untimed — so the one question it needs is asked here too. */
  const [justAdded, setJustAdded] = useState<{ entryId: string; name: string } | null>(null);
  const pending = option.review.status === "pending-clinician-review";
  const inPlan = supportPlan.some((item) => item.optionKey === option.key);

  return (
    <div className="flex flex-col gap-2.5 rounded-[14px] border border-white/[0.08] bg-white/[0.02] p-3.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-[14px] font-bold" style={{ color: RESERVE.ivory }}>
            {option.title}
          </h3>
          <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.16em]" style={{ color: GRADE_COLOR[finding.grade] }}>
            {EVIDENCE_GRADE_LABEL[finding.grade]}
          </p>
        </div>
        {inPlan ? (
          <span className="inline-flex min-h-[36px] items-center gap-1.5 text-[12px]" style={{ color: RESERVE.green }}>
            <Check size={13} aria-hidden="true" />
            Added
          </span>
        ) : (
          <ReserveButton
            tier="secondary"
            size="sm"
            icon={Plus}
            onClick={() => {
              const added = addSupportPlanItem(option.key);
              setJustAdded(added?.entryId ? { entryId: added.entryId, name: added.name } : null);
            }}
          >
            Add to my support plan
          </ReserveButton>
        )}
      </div>

      {justAdded && <AddedTimePrompt entryId={justAdded.entryId} name={justAdded.name} onDone={() => setJustAdded(null)} />}

      <p className="text-[12.5px] leading-[1.55] text-white/70">{finding.finding}</p>
      <p className="text-[12px] leading-[1.5] text-white/55">{option.doesNotAddress}</p>

      {inLog && <p className="text-[11.5px] text-white/45">Also in your log.</p>}

      {finding.markers.length > 0 && (
        <p className="text-[11.5px] text-white/45">
          Visible on your own reports as {finding.markers.map((key) => markerDef(key).label).join(", ")}
        </p>
      )}

      {overlaps.length > 0 && (
        <ul className="flex flex-col gap-1">
          {overlaps.map((overlap) => (
            <li key={overlap.system} className="text-[12px] leading-[1.5]" style={{ color: RESERVE.amber }}>
              Also affects {RISK_SYSTEM_LABEL[overlap.system].toLowerCase()}: {overlap.note}{" "}
              <span className="text-white/50">Your {overlap.compoundNames.join(", ")} also {overlap.compoundNames.length === 1 ? "affects" : "affect"} this area.</span>
            </li>
          ))}
        </ul>
      )}

      <ReserveDisclosure summary="Interactions, evidence grade and sources" accent={RESERVE.steel}>
        <div className="flex flex-col gap-3 pt-1">
          {interactions.length > 0 && (
            <div>
              <Kicker>Interactions</Kicker>
              <ul className="mt-1.5 flex flex-col gap-1">
                {interactions.map((interaction) => (
                  <li key={interaction} className="text-[12px] leading-[1.5] text-white/60">
                    {interaction}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <Kicker>{EVIDENCE_GRADE_LABEL[finding.grade]}</Kicker>
            <p className="mt-1 text-[12px] leading-[1.5] text-white/60">{EVIDENCE_GRADE_DETAIL[finding.grade]}</p>
          </div>
          <div>
            <Kicker>Sources</Kicker>
            <ul className="mt-1.5 flex flex-col gap-1">
              {option.sources.map((source) => (
                <li key={source.label} className="text-[11.5px] leading-[1.5] text-white/50">
                  {source.url ? (
                    <a href={source.url} target="_blank" rel="noopener noreferrer" className="underline decoration-white/20 underline-offset-2 hover:text-white/75">
                      {source.label}
                    </a>
                  ) : (
                    source.label
                  )}
                </li>
              ))}
            </ul>
            <p className="mt-2 font-mono text-[8.5px] uppercase tracking-[0.14em] text-white/30">
              {pending ? "Awaiting clinician review · " : ""}Version {option.review.version}
            </p>
          </div>
        </div>
      </ReserveDisclosure>
    </div>
  );
}
