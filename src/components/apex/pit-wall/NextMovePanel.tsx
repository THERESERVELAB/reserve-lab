"use client";

import { ArrowRight } from "lucide-react";

import { GlassPanel } from "@/components/ui/GlassPanel";
import { ReserveButton } from "@/components/ui/reserve";
import type { ApexLaneItem, ApexNextMove, ApexRiskLevel } from "@/lib/apex/today-types";
import { RESERVE, alpha } from "@/lib/design/tokens";

/** A state that blocks the day (Program unconfirmed, setup incomplete). It replaces the move — never stacks above it. */
export type BlockingMove = {
  label: string;
  headline: string;
  actionLabel: string;
  onAction: () => void;
  /** Supporting detail under the headline, e.g. the setup steps disclosure. */
  detail?: React.ReactNode;
  /** A quiet way to set a non-blocking state aside. */
  dismiss?: { label: string; onDismiss: () => void };
};

export const RISK_TONE: Record<ApexRiskLevel, string> = {
  Low: RESERVE.green,
  Moderate: RESERVE.amber,
  Elevated: RESERVE.red,
  "Sleep compression": RESERVE.red,
};

/* ════════════════════════════════════════════════════════════════════════
   NEXT MOVE — the screen's one gold action, hung off the now-marker.

   On phones the action docks at the true bottom of the screen instead; the
   inline button hides below `md` so the gold action exists exactly once.
   ════════════════════════════════════════════════════════════════════════ */

export function NextMovePanel({
  nextMove,
  risk,
  then,
  blocking,
  onPrimary,
  className = "",
}: {
  nextMove: ApexNextMove;
  risk: { level: ApexRiskLevel; detail: string };
  then: ApexLaneItem | null;
  blocking: BlockingMove | null;
  onPrimary: () => void;
  className?: string;
}) {
  const due = !blocking && nextMove.context.endsWith("Due now");
  const context = blocking ? blocking.label : nextMove.context;
  const title = blocking ? blocking.headline : nextMove.title;
  const actionLabel = blocking ? blocking.actionLabel : nextMove.action?.label ?? null;

  return (
    <GlassPanel accent={RESERVE.gold} phone="flush" className={className}>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between lg:gap-10">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-mono text-[8.5px] uppercase tracking-[0.26em]" style={{ color: alpha(RESERVE.gold, 0.85) }}>
            {due && <span className="fba-pulse h-1.5 w-1.5 rounded-full" style={{ background: RESERVE.gold }} aria-hidden="true" />}
            {blocking ? context : `Next move · ${context}`}
          </p>
          <h2 data-apex="next-move-title" className="mt-2 font-display text-[clamp(22px,2.2vw,30px)] font-extrabold leading-[1.05] tracking-[-0.02em] text-[#f2eee6] [text-wrap:balance]">
            {title}
          </h2>
          {!blocking && <p className="type-command mt-2 max-w-[62ch]">{nextMove.whyNow}</p>}
          {blocking?.detail && <div className="mt-2">{blocking.detail}</div>}

          {!blocking && (
            <p className="mt-3 flex flex-wrap items-baseline gap-x-5 gap-y-1 text-[11.5px] text-white/50">
              {/* On phones the risk sits in the docked action bar — one home per viewport. */}
              <span className="hidden md:inline" data-apex="risk">
                <span className="font-mono text-[8px] uppercase tracking-[0.2em] text-white/35">Risk · </span>
                <b className="font-semibold" style={{ color: RISK_TONE[risk.level] }}>
                  {risk.level}
                </b>
                <span className="text-white/45"> · {risk.detail}</span>
              </span>
              {then && (
                <span className="tnum">
                  <span className="font-mono text-[8px] uppercase tracking-[0.2em] text-white/35">Then · </span>
                  {then.label} · {then.timeLabel}
                </span>
              )}
            </p>
          )}
        </div>

        {(blocking?.dismiss || actionLabel) && (
          <div className={`${blocking?.dismiss ? "flex" : "hidden md:flex"} shrink-0 flex-wrap items-center gap-3`}>
            {/* The quiet dismissal is not a gold action, so phones keep it inline. */}
            {blocking?.dismiss && (
              <ReserveButton tier="quiet" size="md" onClick={blocking.dismiss.onDismiss}>
                {blocking.dismiss.label}
              </ReserveButton>
            )}
            {/* Visibility lives on a wrapper: ReserveButton sets its own display,
                and a `hidden` class passed into it loses to that in the cascade. */}
            {actionLabel && (
              <div className="fba-so-action hidden md:block">
                <ReserveButton tier="primary" size="lg" sheen iconAfter={ArrowRight} onClick={onPrimary}>
                  {actionLabel}
                </ReserveButton>
              </div>
            )}
          </div>
        )}
      </div>
    </GlassPanel>
  );
}
