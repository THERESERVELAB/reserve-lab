"use client";

import { useMemo, useState } from "react";

import { useClientNow } from "@/components/safety/useClientNow";
import { useSafetyContext } from "@/components/safety/useSafetyContext";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { ReserveButton, ReserveSegmented } from "@/components/ui/reserve";
import type { SupportArrival } from "@/lib/compound-command/command-room";
import { buildFieldManual, MANUAL_KIND_LABEL, type ManualKind, type ManualSectionKey } from "@/lib/cycle-review/field-manual";
import { RESERVE, alpha } from "@/lib/design/tokens";

/** Where the Field Manual's one navigation button sends the member, and what it opens. */
type FieldManualOpen = (tab: "support", arrival?: SupportArrival) => void;

const KIND_COLOR: Record<ManualKind, string> = {
  do: RESERVE.green,
  limit: RESERVE.amber,
  swap: RESERVE.steel,
  know: "rgba(242,238,230,0.7)",
};

/**
 * The Field Manual — how to eat, the daily habits with evidence behind them,
 * and the kit for watching your own numbers. General public-health guidance,
 * lit up where the member's compounds touch the same body area. Sits under
 * the Cycle Brief, behind the same launch switch and acknowledgement.
 */
export function FieldManualPanel({ onOpen, compact = false }: { onOpen: FieldManualOpen; compact?: boolean }) {
  const now = useClientNow();
  if (!now) return null;
  return <FieldManualBody now={now} onOpen={onOpen} compact={compact} />;
}

function FieldManualBody({ now, onOpen, compact }: { now: Date; onOpen: FieldManualOpen; compact: boolean }) {
  const ctx = useSafetyContext(now);
  const manual = useMemo(() => buildFieldManual(ctx.activeCompounds.length > 0 ? ctx.riskBrief : null), [ctx]);
  const [section, setSection] = useState<ManualSectionKey>("eat");
  /* Compact: the manual is cited reading, not something that changes today's marks, so on a
     place that already carries the member's own day it opens only when asked. */
  const [open, setOpen] = useState(!compact);

  if (!ctx.acknowledged) return null;
  const current = manual.sections.find((s) => s.key === section) ?? manual.sections[0];
  const itemCount = manual.sections.reduce((sum, s) => sum + s.items.length, 0);
  const summary = `${itemCount} cited items on eating, daily habits and the kit` + (manual.forYouCount > 0 ? `, ${manual.forYouCount} touching an area your compounds affect` : "");

  if (compact && !open) {
    return (
      <GlassPanel accent={RESERVE.green}>
        <section aria-label="Field Manual" className="flex flex-wrap items-center justify-between gap-3" data-field-manual="compact">
          <div className="min-w-0">
            <p className="type-whisper" style={{ color: alpha(RESERVE.green, 0.9) }}>Field Manual · awaiting clinician review</p>
            <p className="mt-1 text-[13px] leading-[1.5] text-white/70">{summary}.</p>
          </div>
          <ReserveButton tier="secondary" size="sm" onClick={() => setOpen(true)}>Open the manual</ReserveButton>
        </section>
      </GlassPanel>
    );
  }

  return (
    <GlassPanel accent={RESERVE.green}>
      <section aria-label="Field Manual" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
          <p className="type-whisper" style={{ color: alpha(RESERVE.green, 0.9) }}>Field Manual · awaiting clinician review</p>
          <h2 className="type-section-title mt-1.5" style={{ color: RESERVE.ivory }}>Eat, live and watch your numbers</h2>
          <p className="mt-1.5 text-[12.5px] leading-[1.55] text-white/60">
            Public guidelines and published research, cited.{" "}
            {manual.forYouCount > 0 ? `${manual.forYouCount} touch an area your compounds affect.` : "Log compounds to see which touch your cycle."}
          </p>
          </div>
          {compact && (
            <ReserveButton tier="quiet" size="sm" onClick={() => setOpen(false)}>Close the manual</ReserveButton>
          )}
        </div>

        <ReserveSegmented
          label="Field Manual section"
          value={section}
          onChange={setSection}
          accent={RESERVE.green}
          size="sm"
          segments={manual.sections.map((s) => ({ value: s.key, label: s.label }))}
        />

        <ul className="flex flex-col divide-y divide-white/[0.05]">
          {current.items.map((item) => (
            <li key={item.key} className="py-3" data-manual-item={item.key}>
              <div className="flex items-baseline gap-2.5">
                <span className="w-[42px] shrink-0 font-mono text-[9px] uppercase tracking-[0.18em]" style={{ color: KIND_COLOR[item.kind] }}>
                  {MANUAL_KIND_LABEL[item.kind]}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-semibold" style={{ color: RESERVE.ivory }}>{item.title}</p>
                  <p className="mt-0.5 text-[12.5px] leading-[1.55] text-white/70">{item.text}</p>
                  {item.forYou && (
                    <p className="mt-1 text-[11.5px] leading-[1.45]" style={{ color: alpha(RESERVE.amber, 0.9) }}>
                      {item.forYou.areaLabels.join(" · ")} — {item.forYou.compoundNames.join(", ")}
                    </p>
                  )}
                  <p className="mt-1 text-[10.5px] leading-[1.45] text-white/35">
                    {item.sources.map((src, i) => (
                      <span key={src.label}>
                        {i > 0 ? " · " : ""}
                        {src.url ? <a href={src.url} target="_blank" rel="noreferrer" className="underline decoration-white/20 underline-offset-2">{src.label}</a> : src.label}
                      </span>
                    ))}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap items-center gap-2">
          <ReserveButton tier="secondary" size="sm" onClick={() => onOpen("support", "library")}>Supplement library, A–Z</ReserveButton>
          <p className="text-[11.5px] text-white/45">Creatine, electrolytes, red yeast rice and more, each with its evidence and cautions.</p>
        </div>
      </section>
    </GlassPanel>
  );
}
