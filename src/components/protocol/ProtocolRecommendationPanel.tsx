"use client";

/* ════════════════════════════════════════════════════════════════════════
   PERSONAL COMMAND · THE RECOMMENDATION — rows, not a document.

   One protocol, said once: its name, days and weeks, the reasons it fits,
   the two alternatives as rows, and the rows that open the library and the
   missing inputs. Everything else Reserve reasoned (the split, recovery and
   nutrition demand, compromises, risks, what it ruled out) is real and kept,
   inside the screen's one closed Details disclosure (`ProtocolReasoningDetail`).

   The reasoning is computed once per screen (`useProtocolReasoning`) and
   handed to both, so the recommendation and its details can never disagree.
   ════════════════════════════════════════════════════════════════════════ */

import { ChevronRight } from "lucide-react";
import { useMemo } from "react";

import { GlassPanel } from "@/components/ui/GlassPanel";
import { DETAIL_BAND_BLEED, ReserveButton, ReserveDetailImage, ReserveSectionHeader } from "@/components/ui/reserve";
import { useAthleteDashboardStore } from "@/lib/athlete-store";
import { RESERVE } from "@/lib/design/tokens";
import { useProgramHorizon } from "@/lib/hooks/useProgramHorizon";
import { getProtocol, PROTOCOL_LIBRARY } from "@/lib/protocol/library";
import { profileInputsLine } from "@/lib/protocol/personal-command";
import { getProtocolDNA } from "@/lib/training/protocol-dna";
import { buildProtocolExplanation } from "@/lib/training/protocol-explanation";
import { SUITABILITY_LABEL, type ProtocolSuitability, type SuitabilityClass } from "@/lib/training/protocol-suitability";

function Lines({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="space-y-1.5 text-[13px] leading-relaxed text-white/70">
      {items.map((t, i) => (
        <li key={i} className="flex gap-2.5">
          <span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-current opacity-45" aria-hidden="true" />
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

export function protocolName(id: string): string {
  return getProtocol(id)?.name ?? id;
}

function fitLabel(classification: SuitabilityClass, isTopPick: boolean): string {
  if (isTopPick) return "Recommended";
  if (classification === "excellent-fit" || classification === "strong-fit") return "Good alternative";
  return SUITABILITY_LABEL[classification];
}

function SubHead({ children }: { children: React.ReactNode }) {
  return <p className="mb-1.5 mt-4 font-mono text-[10px] uppercase tracking-[0.16em] text-white/50 first:mt-0">{children}</p>;
}

/** One chevron row: a label, a value, and where it goes. */
export function CommandRow({
  label,
  value,
  action,
  onClick,
  haspopup,
  data,
}: {
  label: string;
  value: string;
  action?: string;
  onClick?: () => void;
  haspopup?: boolean;
  data?: string;
}) {
  const body = (
    <>
      <span className="w-[92px] shrink-0 font-mono text-[10px] uppercase tracking-[0.16em] text-white/50">{label}</span>
      <span className="min-w-0 flex-1 text-[13px] leading-snug text-white/80">{value}</span>
      {onClick && (
        <span className="inline-flex shrink-0 items-center gap-1 font-mono text-[10px] uppercase tracking-[0.14em] text-white/50">
          {action}
          <ChevronRight size={14} aria-hidden="true" />
        </span>
      )}
    </>
  );
  return onClick ? (
    <button
      type="button"
      data-protocol={data}
      onClick={onClick}
      aria-haspopup={haspopup ? "dialog" : undefined}
      className="flex min-h-[48px] w-full items-center gap-3 py-2 text-left transition-colors hover:text-white"
    >
      {body}
    </button>
  ) : (
    <div data-protocol={data} className="flex min-h-[48px] items-center gap-3 py-2">
      {body}
    </div>
  );
}

/** The reasoning behind the active protocol, or the recommendation when none is running. */
export function useProtocolReasoning() {
  const { snapshot, profile, ranking, horizon } = useProgramHorizon();
  const activeProtocol = useAthleteDashboardStore((s) => s.activeProtocol);

  const active: ProtocolSuitability | null = useMemo(
    () => (activeProtocol ? ranking.all.find((s) => s.protocolId === activeProtocol.protocolId) ?? null : null),
    [activeProtocol, ranking.all],
  );
  const subject = active ?? ranking.recommended;
  const explanation = useMemo(() => {
    if (horizon && active) return horizon.personalizedExplanation;
    const dna = getProtocolDNA(subject.protocolId);
    if (!dna) return null;
    return buildProtocolExplanation(dna, subject, snapshot, profile, {
      protocolName: protocolName(subject.protocolId),
      athleteChoseManually: Boolean(active) && subject.protocolId !== ranking.recommended.protocolId,
    });
  }, [horizon, active, subject, snapshot, profile, ranking.recommended.protocolId]);

  return {
    ranking,
    subject,
    explanation,
    isActive: Boolean(active),
    isManualChoice: Boolean(active) && subject.protocolId !== ranking.recommended.protocolId,
    alternatives: [ranking.recommended, ...ranking.alternatives].filter((a) => a.protocolId !== subject.protocolId).slice(0, 2),
  };
}

export type ProtocolReasoning = ReturnType<typeof useProtocolReasoning>;

export function ProtocolRecommendationPanel({
  reasoning,
  onActivate,
  onBrowse,
}: {
  reasoning: ProtocolReasoning;
  /** Opens the chooser on this protocol's confirmation. */
  onActivate: (protocolId: string) => void;
  /** Opens the chooser on the protocol library. */
  onBrowse: () => void;
}) {
  const setActiveView = useAthleteDashboardStore((s) => s.setActiveView);
  const { subject, ranking, alternatives } = reasoning;

  return (
    <GlassPanel accent={RESERVE.gold} phone="flush">
      <section aria-label="Reserve recommends" data-protocol="recommendation">
        <ReserveDetailImage id="protocol-blueprint" size="strip" className={DETAIL_BAND_BLEED} />

        <ReserveSectionHeader
          label="Reserve recommends"
          accent={RESERVE.gold}
          action={
            <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-white/55">
              {fitLabel(subject.classification, subject.protocolId === ranking.recommended.protocolId)}
            </span>
          }
        />

        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div className="min-w-0">
            <h2 data-protocol="recommended-name" className="font-display text-[24px] font-semibold leading-tight tracking-tight text-[#f2eee6] sm:text-[28px]">
              {protocolName(subject.protocolId)}
            </h2>
            <p className="tnum mt-1 text-[13px] text-white/65">
              {subject.recommendedFrequency} days a week · {subject.recommendedDurationWeeks} weeks
            </p>
          </div>
          <ReserveButton tier="secondary" size="md" onClick={() => onActivate(subject.protocolId)}>
            Activate
          </ReserveButton>
        </div>

        {subject.whyItFits.length > 0 && (
          <div className="mt-4">
            <Lines items={subject.whyItFits.slice(0, 3)} />
          </div>
        )}

        <ul className="mt-4 divide-y divide-white/[0.06] border-t border-white/[0.06]">
          {alternatives.map((alt) => (
            <li key={alt.protocolId} data-protocol="alternative" className="flex min-h-[48px] items-center gap-3 py-1.5">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-semibold text-[#f2eee6]">{protocolName(alt.protocolId)}</span>
                <span className="block text-[12px] text-white/55">
                  {alt.recommendedFrequency} days a week · {fitLabel(alt.classification, alt.protocolId === ranking.recommended.protocolId)}
                </span>
              </span>
              <ReserveButton tier="quiet" size="sm" onClick={() => onActivate(alt.protocolId)}>
                Activate
              </ReserveButton>
            </li>
          ))}
          <li>
            <CommandRow label="Library" value={`${PROTOCOL_LIBRARY.length} protocols`} action="Browse" onClick={onBrowse} haspopup />
          </li>
          <li>
            <CommandRow
              label="Inputs"
              value={profileInputsLine({ missingCount: subject.missingInformation.length })}
              action="Settings"
              onClick={() => setActiveView("settings")}
              data="profile-inputs"
            />
          </li>
        </ul>
      </section>
    </GlassPanel>
  );
}

/** Everything Reserve reasoned about the protocol — the body of the screen's one Details disclosure. */
export function ProtocolReasoningDetail({ reasoning }: { reasoning: ProtocolReasoning }) {
  const { subject, explanation, ranking, isManualChoice } = reasoning;

  /* A running block keeps only what can change the member's mind about it.
     The week, recovery and nutrition reasoning lives in Program Horizon, and
     the program's own split description would contradict a split they chose. */
  if (reasoning.isActive) {
    return (
      <div className="text-[13px] leading-relaxed text-white/70">
        {isManualChoice && (
          <p className="mb-3 text-[#e8c87a]/85">
            You chose this over Reserve&rsquo;s recommendation ({protocolName(ranking.recommended.protocolId)}).
          </p>
        )}
        {subject.whyItFits.length > 0 && (
          <>
            <SubHead>Why it fits</SubHead>
            <Lines items={subject.whyItFits.slice(0, 3)} />
          </>
        )}
        {subject.compromises.length > 0 && (
          <>
            <SubHead>Compromises</SubHead>
            <Lines items={subject.compromises.slice(0, 2)} />
          </>
        )}
        {subject.risks.length > 0 && (
          <>
            <SubHead>Risks</SubHead>
            <Lines items={subject.risks.slice(0, 2)} />
          </>
        )}
      </div>
    );
  }

  return (
    <div className="text-[13px] leading-relaxed text-white/70">
      {isManualChoice && (
        <p className="mb-3 text-[#e8c87a]/85">
          You chose this over Reserve&rsquo;s recommendation ({protocolName(ranking.recommended.protocolId)}). Frequency and volume are adapted to your profile.
        </p>
      )}
      {explanation && <p className="text-white/75">{explanation.summary}</p>}
      {(reasoning.isActive ? subject.whyItFits : subject.whyItFits.slice(3)).length > 0 && (
        <>
          <SubHead>{reasoning.isActive ? "Why it fits" : "More reasons it fits"}</SubHead>
          <Lines items={reasoning.isActive ? subject.whyItFits : subject.whyItFits.slice(3)} />
        </>
      )}
      {subject.whatTheSplitWillDo.length > 0 && (
        <>
          <SubHead>What the split will do</SubHead>
          <Lines items={subject.whatTheSplitWillDo} />
        </>
      )}
      <SubHead>Recovery demand</SubHead>
      <Lines items={subject.recoveryRequirements} />
      <SubHead>Nutrition demand</SubHead>
      <Lines items={subject.nutritionRequirements} />
      {subject.compromises.length > 0 && (
        <>
          <SubHead>Compromises</SubHead>
          <Lines items={subject.compromises} />
        </>
      )}
      {subject.risks.length > 0 && (
        <>
          <SubHead>Risks</SubHead>
          <Lines items={subject.risks} />
        </>
      )}
      {ranking.notRecommended.length > 0 && (
        <>
          <SubHead>Not currently appropriate</SubHead>
          <Lines items={ranking.notRecommended.slice(0, 4).map((n) => `${protocolName(n.protocolId)} · ${n.contraindications[0] ?? "ruled out for your profile"}`)} />
        </>
      )}
    </div>
  );
}

export { SubHead as ProtocolSubHead, Lines as ProtocolLines };
