"use client";

import { ShieldCheck } from "lucide-react";
import { useMemo } from "react";

import { CareOptions } from "@/components/safety/CareOptions";
import { useClientNow } from "@/components/safety/useClientNow";
import { compoundIdentity, useSafetyContext } from "@/components/safety/useSafetyContext";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { ReserveButton, ReserveDisclosure } from "@/components/ui/reserve";
import { dateKeyOf } from "@/lib/cycle/cycle-period";
import type { SupportArrival } from "@/lib/compound-command/command-room";
import { buildCycleBrief, type BriefMarker } from "@/lib/cycle-review/cycle-brief";
import { RESERVE, alpha } from "@/lib/design/tokens";

const STATUS: Record<BriefMarker["status"], { label: (m: BriefMarker) => string; color: string }> = {
  flagged: { label: (m) => `${m.latest?.valueText}${m.latest?.unit ? ` ${m.latest.unit}` : ""} · outside your report's range`, color: RESERVE.amber },
  never: { label: () => "Not tested", color: RESERVE.amber },
  stale: { label: (m) => `${m.latest?.valueText}${m.latest?.unit ? ` ${m.latest.unit}` : ""} · ${m.latest?.daysAgo} days ago`, color: "rgba(242,238,230,0.6)" },
  recent: { label: (m) => `${m.latest?.valueText}${m.latest?.unit ? ` ${m.latest.unit}` : ""} · ${m.latest?.daysAgo} days ago`, color: RESERVE.ivory },
};

/** Where a Cycle Brief button sends the member, and what it opens when it lands. */
type CycleBriefOpen = (tab: "cycle" | "support" | "injection-map" | "labs", arrival?: SupportArrival) => void;

/** "2026-09-25" as "Sep 25", the way the rest of the room writes a date. */
function shortDate(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  if (!y || !m || !d) return key;
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function Whisper({ children, color }: { children: React.ReactNode; color?: string }) {
  return <p className="type-whisper" style={color ? { color } : undefined}>{children}</p>;
}

/**
 * The Cycle Brief — everything to know while on a cycle, from the member's
 * own running compounds, cycle and labs. Review-pending safety content: shown
 * only where safety tools are visible and after the safety acknowledgement.
 */
export function CycleBriefPanel({ onOpen }: { onOpen: CycleBriefOpen }) {
  const now = useClientNow();
  if (!now) return null;
  return <CycleBriefBody now={now} onOpen={onOpen} />;
}

function CycleBriefBody({ now, onOpen }: { now: Date; onOpen: CycleBriefOpen }) {
  const ctx = useSafetyContext(now);
  const brief = useMemo(
    () =>
      buildCycleBrief({
        today: dateKeyOf(now),
        compoundNames: ctx.activeCompounds.map((entry) => compoundIdentity(entry).name),
        brief: ctx.riskBrief,
        labBrief: ctx.hasLabs ? ctx.labBrief : null,
        cycleState: ctx.cycleState,
      }),
    [ctx, now],
  );

  if (!brief) return null;

  if (!ctx.acknowledged) {
    return (
      <GlassPanel accent={RESERVE.steel}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Whisper color={alpha(RESERVE.steel, 0.9)}>Cycle Brief</Whisper>
            <p className="mt-1 text-[13px] text-white/70">Your Cycle Brief opens after the safety acknowledgement in Cycle &amp; Safety.</p>
          </div>
          <ReserveButton tier="secondary" size="sm" icon={ShieldCheck} onClick={() => onOpen("cycle")}>
            Open Cycle &amp; Safety
          </ReserveButton>
        </div>
      </GlassPanel>
    );
  }

  const { glance } = brief;
  const needsAttention = brief.watch.filter((m) => m.status === "flagged" || m.status === "never");

  return (
    <GlassPanel accent={RESERVE.steel}>
      <section aria-label="Cycle Brief" className="flex flex-col gap-5">
        <div>
          <Whisper color={alpha(RESERVE.steel, 0.9)}>Cycle Brief · awaiting clinician review</Whisper>
          <h2 className="type-section-title mt-1.5" style={{ color: RESERVE.ivory }}>
            {glance.cycle
              ? glance.cycle.pastEnd
                ? `${glance.cycle.name} · past your planned end`
                : `${glance.cycle.name} · week ${glance.cycle.weekNumber} of ${glance.cycle.totalWeeks}`
              : "What to know while these are running"}
          </h2>
          <p className="type-supporting mt-1.5 text-[12.5px]">
            {glance.compoundNames.join(", ")}
            {glance.cycle && !glance.cycle.pastEnd ? ` · ${glance.cycle.daysRemaining} days to your planned end` : ""}
            {glance.nextCheckpoint ? ` · next lab checkpoint ${glance.nextCheckpoint.label} on ${shortDate(glance.nextCheckpoint.date)}` : ""}
          </p>
          <p className="mt-2 text-[12.5px] leading-[1.55] text-white/60">
            Built from what you logged, with cited sources. Never what to take, how much or when.
          </p>
        </div>

        <div>
          <Whisper color={needsAttention.length ? alpha(RESERVE.amber, 0.9) : undefined}>
            What gets watched · {glance.flaggedResults} outside range · {glance.neverTested} never tested
          </Whisper>
          <ul className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2">
            {brief.watch.map((marker) => (
              <li key={marker.key} className="flex items-baseline justify-between gap-3 text-[12.5px]">
                <span style={{ color: RESERVE.ivory }}>{marker.label}</span>
                <span className="text-right text-[11.5px]" style={{ color: STATUS[marker.status].color }}>{STATUS[marker.status].label(marker)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11.5px] leading-[1.5] text-white/45">
            Commonly checked before, during and after a cycle. In most US states you can order them yourself.
          </p>
          <div className="mt-2">
            <ReserveButton tier="quiet" size="sm" onClick={() => onOpen("labs")}>Log or review labs</ReserveButton>
          </div>
        </div>

        <div>
          <Whisper>What these compounds affect</Whisper>
          <ul className="mt-2 flex flex-col divide-y divide-white/[0.05]">
            {brief.systems.map((system) => (
              <li key={system.system} className="flex flex-col gap-1 py-2.5 sm:flex-row sm:gap-4">
                <div className="shrink-0 sm:w-[170px]">
                  <p className="text-[13.5px] font-semibold" style={{ color: RESERVE.ivory }}>{system.label}</p>
                  <p className="mt-0.5 text-[11px] text-white/40">{system.compoundNames.join(", ")}</p>
                </div>
                <div className="min-w-0 flex-1">
                  {system.notes.map((note) => (
                    <p key={note} className="text-[12.5px] leading-[1.5] text-white/70">{note}</p>
                  ))}
                  {system.markers.length > 0 && (
                    <p className="mt-1 text-[11.5px] text-white/45">
                      Your latest: {system.markers.map((m) => (m.latest ? `${m.label} ${m.latest.valueText}${m.latest.unit ? ` ${m.latest.unit}` : ""}` : `${m.label} not tested`)).join(" · ")}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="border-t pt-3" style={{ borderColor: alpha(RESERVE.red, 0.25) }}>
          <Whisper color={RESERVE.red}>Warning signs</Whisper>
          {brief.warningSigns.emergency.length > 0 && (
            <p className="mt-1.5 text-[12.5px] leading-[1.5] text-white/75">
              <span className="font-semibold" style={{ color: RESERVE.ivory }}>Call 911: </span>{brief.warningSigns.emergency.join("; ")}.
            </p>
          )}
          {brief.warningSigns.crisis.length > 0 && (
            <p className="mt-1 text-[12.5px] leading-[1.5] text-white/75">
              <span className="font-semibold" style={{ color: RESERVE.ivory }}>Call or text 988: </span>{brief.warningSigns.crisis.join("; ")}.
            </p>
          )}
          {brief.warningSigns.urgent.length > 0 && (
            <p className="mt-1 text-[12.5px] leading-[1.5] text-white/75">
              <span className="font-semibold" style={{ color: RESERVE.ivory }}>Get care today: </span>{brief.warningSigns.urgent.join("; ")}.
            </p>
          )}
        </div>

        {brief.interactions.length > 0 && (
          <div>
            <Whisper>Known interactions</Whisper>
            <ul className="mt-1.5 flex flex-col gap-1">
              {brief.interactions.map((line) => (
                <li key={line} className="text-[12.5px] leading-[1.5] text-white/70">{line}</li>
              ))}
            </ul>
          </div>
        )}

        <ReserveDisclosure summary="Harm-reduction facts" accent={RESERVE.steel}>
          <ul className="flex flex-col gap-2.5">
            {brief.harmReduction.map((fact) => (
              <li key={fact.title}>
                <p className="text-[13px] font-semibold" style={{ color: RESERVE.ivory }}>{fact.title}</p>
                <p className="mt-0.5 text-[12.5px] leading-[1.5] text-white/65">{fact.text}</p>
                <p className="mt-0.5 text-[10.5px] text-white/35">
                  {fact.source.url ? <a href={fact.source.url} target="_blank" rel="noreferrer" className="underline decoration-white/20 underline-offset-2">{fact.source.label}</a> : fact.source.label}
                </p>
              </li>
            ))}
          </ul>
        </ReserveDisclosure>

        {brief.afterCycle.length > 0 && (
          <ReserveDisclosure summary="After the cycle" accent={RESERVE.steel}>
            <ul className="flex flex-col gap-1.5">
              {brief.afterCycle.map((line) => (
                <li key={line} className="text-[12.5px] leading-[1.5] text-white/70">{line}</li>
              ))}
            </ul>
            <p className="mt-2 text-[11.5px] leading-[1.5] text-white/45">Hormone and fertility recovery can be followed with LH, FSH, testosterone and a semen analysis, reviewed by a clinician or a telehealth visit.</p>
          </ReserveDisclosure>
        )}

        <CareOptions />

        <div className="flex flex-wrap gap-2">
          <ReserveButton tier="secondary" size="sm" onClick={() => onOpen("support", "evidence")}>Evidence for your cycle</ReserveButton>
          <ReserveButton tier="secondary" size="sm" onClick={() => onOpen("cycle")}>Visit summary</ReserveButton>
          <ReserveButton tier="quiet" size="sm" onClick={() => onOpen("injection-map")}>Injection site log</ReserveButton>
        </div>
      </section>
    </GlassPanel>
  );
}
