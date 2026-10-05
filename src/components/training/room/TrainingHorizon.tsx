"use client";

import type { CSSProperties } from "react";

import { STATUS_WORD, clockLabel } from "@/components/apex/pit-wall/format";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { ReserveButton } from "@/components/ui/reserve";
import {
  HORIZON_SPINE_ROWS,
  HorizonFloor,
  HorizonNowPill,
  HorizonSpine,
  HorizonTicks,
  isSettledStatus,
  roomHorizonLook,
  useTrackWidth,
  type HorizonLook,
  type SpineFooterState,
} from "@/components/ui/reserve/horizon";
import { HORIZON, chipMetrics, horizonFrame, laneYPx } from "@/lib/apex/horizon-projection";
import { RESERVE, alpha } from "@/lib/design/tokens";
import {
  layoutHorizonTrack,
  sessionHorizonWindow,
  type SessionHorizon,
  type SessionHorizonBlock,
  type SessionHorizonKind,
} from "@/lib/training/session-horizon";

/* ════════════════════════════════════════════════════════════════════════
   TRAINING HORIZON — today's session blocks, receding from now.

   The shared horizon, recomposed for one session: now is a gate near the
   viewer and the session's blocks recede toward the meal window. The floor,
   ticks, now marker and phone spine are the shared horizon's; how the
   back-to-back blocks share the track comes from `session-horizon.ts`.

   Legibility rules held here:
     - Only the floor has perspective. Blocks stay flat and upright, and no
       text on the strip is smaller than 11px.
     - Every block that opens something real is a button with a 44px hit
       area. A block with nowhere to go is plain text, never a fake button.
     - When the blocks cannot all be drawn readable and apart, the strip
       becomes the spine phones use. Phones always get the spine.

   Motion: nothing moves while the session is live — no light flow, no
   transitions, not even a hover fade. Before and after the session, one
   slow light flow runs along the floor, and it stops for reduced motion
   and for the top bar's pause.
   ════════════════════════════════════════════════════════════════════════ */

const KIND_ACCENT: Record<SessionHorizonKind, string> = {
  primer: RESERVE.steel,
  work: RESERVE.gold,
  support: RESERVE.slate,
  cooldown: RESERVE.steel,
  handoff: RESERVE.slate,
  "post-window": RESERVE.green,
};

const SHORT_LABEL: Record<string, string> = {
  "Mobility Primer": "Primer",
  "Primary Output": "Primary",
  "Stretch-Biased Volume": "Volume",
  "Pump Finisher": "Finisher",
  "Core Command": "Core",
  "Conditioning Reserve": "Conditioning",
  "Reserve Recovery Suite": "Recovery",
  "Post-Session Handoff": "Handoff",
  "Post-Workout Meal": "Meal window",
};

/** The room look, with Training's gold gate and no light left on the floor while it holds still. */
const TRAINING_LOOK: HorizonLook = (() => {
  const room = roomHorizonLook(RESERVE.gold, 0.08);
  return {
    ...room,
    floor: { ...room.floor, gate: RESERVE.gold, gateGlow: null, dashesWhenStill: false },
    tick: { className: "tnum font-mono text-[11px]", alpha: (depth) => 0.45 + 0.15 * depth, fontPx: null },
  };
})();

function blockName(b: SessionHorizonBlock): string {
  return `${b.label}, ${clockLabel(b.startMin)} to ${clockLabel(b.endMin)}, ${STATUS_WORD[b.status]}`;
}

export function TrainingHorizon({
  horizon,
  emptyMessage,
  live,
  flow,
  actionFor,
}: {
  horizon: SessionHorizon | null;
  /** Why there are no blocks today. */
  emptyMessage: string;
  /** The session is live: the strip holds completely still. */
  live: boolean;
  /** The floor's light flow may run (not live, not reduced, not paused). */
  flow: boolean;
  /** What a block opens, or null when it opens nothing. */
  actionFor: (block: SessionHorizonBlock) => (() => void) | null;
}) {
  /* Measured on the body every size renders, so a hidden track never reads 0. */
  const [bodyRef, width] = useTrackWidth();

  if (!horizon) {
    return (
      <GlassPanel accent={RESERVE.gold} noPad phone="flush" className="pt-4 md:px-5 md:py-4">
        <p className="font-mono text-[9px] uppercase tracking-[0.26em]" style={{ color: alpha(RESERVE.gold, 0.85) }}>
          Session horizon
        </p>
        <p className="mt-1.5 text-[12.5px] leading-[1.5] text-white/65">{emptyMessage}</p>
      </GlassPanel>
    );
  }

  const blocks = horizon.blocks;
  const frame = horizonFrame(sessionHorizonWindow(horizon), horizon.nowMin, width);
  const layout = layoutHorizonTrack(blocks, frame);
  const nowVisible = horizon.nowMin >= frame.startMin && horizon.nowMin <= frame.endMin;
  const sessionBlocks = blocks.filter((b) => b.kind !== "post-window");
  const sessionEnd = sessionBlocks[sessionBlocks.length - 1]?.endMin ?? horizon.endMin;
  const summary =
    horizon.mode === "pre"
      ? `${horizon.startSource === "planned" ? `Starts ${clockLabel(horizon.startMin)}` : "Starts when you begin"} · est. ends ${clockLabel(sessionEnd)}`
      : horizon.mode === "live"
        ? `Started ${clockLabel(horizon.startMin)} · est. ends ${clockLabel(sessionEnd)}`
        : `Closed out · meal window until ${clockLabel(horizon.endMin)}`;

  const spineItems = blocks.map((block) => ({ ...block, timeLabel: clockLabel(block.startMin) }));
  const spineFooter = (state: SpineFooterState) => {
    if (state.total <= HORIZON_SPINE_ROWS) return null;
    const label = state.expanded ? "Show fewer" : `Show all ${state.total} blocks`;
    /* ReserveButton fades on hover; live, even that is held still. */
    return live ? (
      <button
        type="button"
        onClick={state.toggle}
        className="min-h-[44px] px-3 font-mono text-[11px] uppercase tracking-[0.1em] text-white/60 hover:text-white/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e8c87a]"
      >
        {label}
      </button>
    ) : (
      <ReserveButton tier="quiet" size="sm" onClick={state.toggle}>
        {label}
      </ReserveButton>
    );
  };

  return (
    <GlassPanel accent={RESERVE.gold} noPad phone="flush" className="md:overflow-hidden">
      <section aria-label="Session horizon" data-training="horizon" className="pb-4 pt-4 md:px-6">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="font-mono text-[9px] uppercase tracking-[0.26em]" style={{ color: alpha(RESERVE.gold, 0.85) }}>
            Session horizon · {horizon.mode === "pre" ? "today" : horizon.mode === "live" ? "live" : "closed out"}
          </p>
          <p className="tnum font-mono text-[11px] text-white/60">
            {summary}
            {layout.fits && layout.hiddenBefore > 0 && <span className="hidden md:inline"> · earlier {layout.hiddenBefore} done</span>}
          </p>
        </div>

        <div ref={bodyRef} className="relative mt-2">
          {/* The perspective track — md and up, when every block fits readable. */}
          <div className={layout.fits ? "hidden md:block" : "hidden"}>
            <div className="relative" style={{ height: HORIZON.ticksPx + HORIZON.rowPx + 22 }}>
              <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0" style={{ height: HORIZON.ticksPx + HORIZON.rowPx }}>
                <HorizonFloor
                  frame={frame}
                  accents={[RESERVE.gold]}
                  sleepLockMin={null}
                  nowVisible={nowVisible}
                  flow={flow && !live}
                  look={TRAINING_LOOK.floor}
                />
                <HorizonTicks frame={frame} look={TRAINING_LOOK} minPx={24} />
                {nowVisible && (
                  <HorizonNowPill
                    nowMin={horizon.nowMin}
                    className="text-[11px] tracking-[0.1em]"
                    style={{ top: HORIZON.ticksPx + HORIZON.rowPx + 2, left: `max(44px, ${frame.gate * 100}%)` }}
                  />
                )}
              </div>

              <ol className="absolute inset-x-0" style={{ top: HORIZON.ticksPx, height: HORIZON.rowPx }} aria-label="Session blocks">
                {layout.items.map((item) => {
                  const block = blocks[item.index];
                  /* The lane converges toward the horizon; the control stays flat. */
                  const shift = laneYPx(0.5, item.depth) - laneYPx(0.5, 1);
                  const position: CSSProperties = { left: item.leftPx, width: item.widthPx, top: `calc(50% + ${shift}px)` };
                  return (
                    <li key={block.id} className="absolute -translate-y-1/2" style={position}>
                      <TrackBlock block={block} depth={item.depth} action={actionFor(block)} live={live} />
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>

          {/* The spine — phones, and any width where the track cannot stay readable. */}
          <HorizonSpine
            className={layout.fits ? "md:hidden" : ""}
            items={spineItems}
            look={TRAINING_LOOK}
            label="Session blocks"
            accentOf={(block) => KIND_ACCENT[block.kind]}
            opens={(block) => actionFor(block) !== null}
            onOpen={(block) => actionFor(block)?.()}
            dialog={false}
            still={live}
            footer={spineFooter}
          />
        </div>
      </section>
    </GlassPanel>
  );
}

/* ─── Blocks ───────────────────────────────────────────────────────────── */

function statusRing(block: SessionHorizonBlock): string | undefined {
  if (block.status === "due-now") return `0 0 0 1.5px ${RESERVE.gold}`;
  if (block.status === "due-next") return `0 0 0 1px ${alpha(RESERVE.amber, 0.6)}`;
  return undefined;
}

function TrackBlock({ block, depth, action, live }: { block: SessionHorizonBlock; depth: number; action: (() => void) | null; live: boolean }) {
  const metrics = chipMetrics(depth);
  const accent = KIND_ACCENT[block.kind];
  const tint = alpha(accent, (block.kind === "work" ? 0.26 : 0.18) * metrics.fill);
  const face = (
    <span
      className={`flex w-full min-w-0 items-center gap-1.5 rounded-[8px] px-2.5 text-left font-semibold leading-none text-[#f2eee6] ${
        action && !live ? "transition-[filter] duration-200 group-hover:brightness-125" : ""
      }`}
      style={{
        height: metrics.heightPx,
        fontSize: metrics.fontPx,
        /* Opaque base under the tint, so the floor line never runs through the label. */
        background: `linear-gradient(${tint}, ${tint}), ${RESERVE.base}`,
        opacity: isSettledStatus(block.status) ? 0.72 : 1,
        boxShadow: statusRing(block),
      }}
    >
      {block.status === "completed" && <span aria-hidden="true">✓</span>}
      <span className="truncate">{SHORT_LABEL[block.label] ?? block.label}</span>
    </span>
  );

  if (!action) {
    return (
      <div className="flex h-11 w-full items-center" title={blockName(block)}>
        <span className="sr-only">{blockName(block)}</span>
        <span aria-hidden="true" className="flex w-full min-w-0">
          {face}
        </span>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={action}
      aria-label={blockName(block)}
      className="group flex h-11 w-full items-center rounded-[10px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e8c87a]"
    >
      {face}
    </button>
  );
}
