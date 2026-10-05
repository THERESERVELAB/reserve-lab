"use client";

import { LifeBuoy } from "lucide-react";

import { GlassPanel } from "@/components/ui/GlassPanel";
import { ReserveButton, ReserveDisclosure } from "@/components/ui/reserve";
import {
  RED_FLAGS,
  REGULATORY_LABEL,
  RISK_SYSTEM_LABEL,
  type RedFlagAction,
  type RiskProfile,
  type RiskSystem,
} from "@/lib/compound-intelligence/risk-profiles";
import type { SupportArea } from "@/lib/compound-intelligence/support-options";
import { RESERVE, alpha } from "@/lib/design/tokens";
import { markerDef } from "@/lib/labs/markers";

const ACTION_LABEL: Record<RedFlagAction, string> = {
  emergency: "Emergency",
  urgent: "Same day",
  crisis: "Crisis line",
};

function Kicker({ children }: { children: React.ReactNode }) {
  return <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/40">{children}</p>;
}

/** One compound risk profile: what it affects up front, the evidence behind a disclosure. */
export function RiskProfileCard({
  profile,
  compoundNames,
  supportAreas,
  onSupport,
}: {
  profile: RiskProfile;
  compoundNames: string[];
  /** Areas with a support sheet. Supplement profiles never open one. */
  supportAreas?: ReadonlySet<SupportArea>;
  onSupport?: (area: SupportArea) => void;
}) {
  const pending = profile.review.status === "pending-clinician-review";
  const canSupport = (system: RiskSystem, index: number) =>
    Boolean(onSupport && supportAreas?.has(system)) &&
    profile.regulatory !== "supplement" &&
    profile.systems.findIndex((entry) => entry.system === system) === index;
  return (
    <GlassPanel accent={RESERVE.steel}>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-mono text-[9px] uppercase tracking-[0.2em]" style={{ color: alpha(RESERVE.steel, 0.85) }}>
              {REGULATORY_LABEL[profile.regulatory]}
            </p>
            <h3 className="mt-1 text-[15px] font-bold" style={{ color: RESERVE.ivory }}>
              {profile.title}
            </h3>
            <p className="mt-0.5 text-[11.5px] text-white/45">For {compoundNames.join(", ")}</p>
          </div>
          {pending && (
            <span className="shrink-0 font-mono text-[8.5px] uppercase tracking-[0.14em]" style={{ color: alpha(RESERVE.amber, 0.85) }}>
              Awaiting clinician review
            </span>
          )}
        </div>

        <p className="text-[12.5px] leading-[1.55] text-white/65">{profile.summary}</p>

        <ul className="flex flex-col gap-1.5">
          {profile.systems.map((entry, index) => (
            <li key={`${entry.system}-${index}`} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <span className="min-w-0 flex-1 text-[12px] leading-[1.5] text-white/60">
                <span style={{ color: RESERVE.ivory }}>{RISK_SYSTEM_LABEL[entry.system]}</span> · {entry.note}
              </span>
              {canSupport(entry.system, index) && onSupport && (
                <ReserveButton tier="quiet" size="sm" icon={LifeBuoy} onClick={() => onSupport(entry.system)}>
                  Support options<span className="sr-only"> for {RISK_SYSTEM_LABEL[entry.system]}</span>
                </ReserveButton>
              )}
            </li>
          ))}
        </ul>

        <ReserveDisclosure summary="Lab markers, warning signs and sources" accent={RESERVE.steel}>
          <div className="flex flex-col gap-3 pt-1">
            <div>
              <Kicker>Commonly watched in labs</Kicker>
              {profile.monitoredMarkers.length > 0 ? (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {profile.monitoredMarkers.map((key) => (
                    <span key={key} className="rounded-[8px] border border-white/[0.08] px-2 py-1 text-[11px] text-white/65">
                      {markerDef(key).label}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-1 text-[12px] text-white/50">No specific blood markers are established.</p>
              )}
            </div>

            {profile.redFlags.length > 0 && (
              <div>
                <Kicker>Warning signs</Kicker>
                <ul className="mt-1.5 flex flex-col gap-1">
                  {profile.redFlags.map((flag) => (
                    <li key={flag} className="text-[12px] leading-[1.5] text-white/60">
                      <span style={{ color: RED_FLAGS[flag].action === "urgent" ? RESERVE.amber : RESERVE.red }}>
                        {ACTION_LABEL[RED_FLAGS[flag].action]}
                      </span>{" "}
                      · {RED_FLAGS[flag].label}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {profile.interactions.length > 0 && (
              <div>
                <Kicker>Interactions</Kicker>
                <ul className="mt-1.5 flex flex-col gap-1">
                  {profile.interactions.map((interaction) => (
                    <li key={interaction} className="text-[12px] leading-[1.5] text-white/60">
                      {interaction}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <Kicker>Regulatory status</Kicker>
              <p className="mt-1 text-[12px] leading-[1.5] text-white/60">{profile.regulatoryNote}</p>
            </div>

            <div>
              <Kicker>Sources</Kicker>
              <ul className="mt-1.5 flex flex-col gap-1">
                {profile.sources.map((source) => (
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
              <p className="mt-2 font-mono text-[8.5px] uppercase tracking-[0.14em] text-white/30">Profile version {profile.review.version}</p>
            </div>
          </div>
        </ReserveDisclosure>
      </div>
    </GlassPanel>
  );
}
