"use client";

import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";

import { GlassPanel } from "@/components/ui/GlassPanel";
import { useAthleteDashboardStore, type DashboardView } from "@/lib/athlete-store";

/**
 * Honest premium empty state for elite intelligence surfaces.
 *
 * Production members must never see fabricated scores, panels, timelines, or
 * trends. Until the member's own logs exist, these surfaces explain exactly
 * what they will show and route to the logging surface that feeds them.
 */
export function EliteEmptyState({
  icon: Icon,
  accent,
  headline,
  body,
  requirements,
  cta,
}: {
  icon: LucideIcon;
  accent: string;
  headline: string;
  body: string;
  /** What real data unlocks this surface — plain, specific, honest. */
  requirements: string[];
  cta?: { label: string; view: DashboardView };
}) {
  const setActiveView = useAthleteDashboardStore((s) => s.setActiveView);

  return (
    <GlassPanel accent={accent} noPad>
      <div
        className="pointer-events-none absolute inset-0 rounded-2xl"
        style={{ background: `radial-gradient(ellipse at 15% 40%, ${accent}12 0%, transparent 60%)` }}
      />
      <div className="relative p-8">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-2xl border"
          style={{ borderColor: `${accent}35`, background: `${accent}10`, color: accent }}
        >
          <Icon size={20} />
        </div>
        <h2 className="mt-5 max-w-[460px] text-[20px] font-bold leading-snug text-[#f2eee6]">{headline}</h2>
        <p className="mt-2.5 max-w-[520px] text-[11.5px] leading-6 text-white/40">{body}</p>

        <div className="mt-5 space-y-2">
          {requirements.map((req) => (
            <div key={req} className="flex items-start gap-2.5">
              <span
                className="mt-[5px] h-1.5 w-1.5 flex-shrink-0 rounded-full"
                style={{ background: accent, boxShadow: `0 0 6px ${accent}66` }}
              />
              <p className="text-[11px] leading-5 text-white/50">{req}</p>
            </div>
          ))}
        </div>

        {cta && (
          <button
            type="button"
            onClick={() => setActiveView(cta.view)}
            className="group mt-6 inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 font-mono text-[9px] uppercase tracking-[0.16em] transition hover:bg-white/[0.04]"
            style={{ borderColor: `${accent}44`, color: accent }}
          >
            {cta.label}
            <ArrowRight size={12} className="transition-transform duration-200 group-hover:translate-x-0.5" />
          </button>
        )}

        <p className="mt-6 font-mono text-[7.5px] uppercase tracking-[0.2em] text-white/20">
          Reserve never fabricates data — this module activates from your own logs.
        </p>
      </div>
    </GlassPanel>
  );
}
