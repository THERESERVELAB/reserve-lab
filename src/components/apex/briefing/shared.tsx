import { Minus, TrendingDown, TrendingUp } from "lucide-react";

import type { SystemMatrixStatus } from "@/lib/ai-strategist/types";
import type { MarkerTrend } from "@/lib/apex/command-intelligence";
import { RESERVE } from "@/lib/design/tokens";

/* ════════════════════════════════════════════════════════════════════════
   BRIEFING SHARED — the small pieces the Full briefing blocks reuse, copied
   from ApexCommandV2.

   `C` is the same short alias ApexCommandV2 keeps over the token module, so
   the copied markup reads identically and still cannot drift from the
   palette.
   ════════════════════════════════════════════════════════════════════════ */

export const C = {
  GOLD: RESERVE.gold,
  IVORY: RESERVE.ivory,
  STEEL: RESERVE.steel,
  GREEN: RESERVE.green,
  VIOLET: RESERVE.violet,
  AMBER: RESERVE.amber,
  RED: RESERVE.red,
  SLATE: RESERVE.slate,
} as const;

export const STATUS_COLOR: Record<SystemMatrixStatus, string> = {
  strong: C.GREEN, "on-track": C.STEEL, watch: C.AMBER, "needs-input": C.GOLD,
  "data-limited": C.SLATE, "log-only": C.SLATE, "lifestyle-only": C.VIOLET, "estimate-only": C.VIOLET, locked: C.SLATE,
};

export const STATUS_LABEL: Record<SystemMatrixStatus, string> = {
  strong: "Strong", "on-track": "On Track", watch: "Watch", "needs-input": "Needs Input",
  "data-limited": "Data Limited", "log-only": "Log Only", "lifestyle-only": "Lifestyle Only", "estimate-only": "Estimate Only", locked: "Locked",
};

/** Metric tile — glass surface with a top-edge highlight.

    Display-only, so it carries no hover lift: the ApexCommandV2 original
    raised and re-bordered on hover, which made a static readout look like a
    button (components.md rule 5). */
export function LuxTile({ label, value, color, dot }: { label: string; value: string; color?: string; dot?: string }) {
  return (
    <div className="relative overflow-hidden rounded-xl bg-gradient-to-b from-white/[0.055] to-white/[0.01] px-3 py-2.5">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      <div className="flex items-center gap-1.5">
        {dot && <span className="h-1.5 w-1.5 rounded-full" style={{ background: dot, boxShadow: `0 0 8px ${dot}` }} />}
        <p className="font-mono text-[7px] uppercase tracking-[0.16em] text-white/40">{label}</p>
      </div>
      <p className="mt-1 text-[12px] font-black capitalize leading-tight" style={{ color: color ?? C.IVORY }}>{value}</p>
    </div>
  );
}

/* ─── Trend icon for member-entered marker reads (factual arithmetic only) ── */
export function TrendGlyph({ trend }: { trend: MarkerTrend | null }) {
  if (trend === "up") return <TrendingUp size={10} style={{ color: `${C.GREEN}b0` }} />;
  if (trend === "down") return <TrendingDown size={10} style={{ color: `${C.STEEL}b0` }} />;
  return <Minus size={10} style={{ color: "rgba(255,255,255,0.3)" }} />;
}
