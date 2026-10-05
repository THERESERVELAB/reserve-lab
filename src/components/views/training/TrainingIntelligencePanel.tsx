"use client";

import { ArrowRight, Brain, Dumbbell, Layers, Repeat, ShieldAlert, Zap } from "lucide-react";

import { GlassPanel } from "@/components/ui/GlassPanel";
import type { DashboardView } from "@/lib/athlete-store";
import {
  plateauColor, plateauLabel,
  type TrainingIntelligenceSnapshot,
} from "@/lib/training/plateau-engine";

/** Cards that read the member's logged history — nothing to read without it. */
const HISTORY_CARDS = new Set(["plateau", "exposure", "rotation"]);

const C = {
  GOLD: "#d5b15f", IVORY: "#f2eee6", STEEL: "#5fb7d5", GREEN: "#6ee7b7",
  VIOLET: "#a78bfa", AMBER: "#e8c87a", RED: "#ef7d55", SLATE: "#8ea0b8",
};

export function TrainingIntelligencePanel({ snapshot, onNavigate }: {
  snapshot: TrainingIntelligenceSnapshot;
  onNavigate: (view: DashboardView) => void;
}) {
  const { hasSession, confidence, exposures, supersets, rotation } = snapshot;
  /* Without logged sessions there is no history to read, so the parts built
     from one — plateau risk, exposure weeks, rotation candidates — are not
     shown at all. Fabricated certainty, even labelled "sample", is still
     fabricated (Bible §12). What is left reads today's real session. */
  const noHistory = confidence === "sample";
  const cards = noHistory ? snapshot.cards.filter((c) => !HISTORY_CARDS.has(c.key)) : snapshot.cards;

  return (
    <GlassPanel accent={C.VIOLET}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Brain size={14} style={{ color: C.VIOLET }} />
          <p className="font-mono text-[9px] uppercase tracking-[0.26em]" style={{ color: C.VIOLET }}>Training Intelligence</p>
        </div>
        <span className="rounded-md border px-2 py-0.5 font-mono text-[7.5px] uppercase tracking-[0.14em]"
          style={{ borderColor: `${C.SLATE}40`, color: C.SLATE }}>
          {confidence === "sample" ? "Today's session only" : confidence === "logged" ? "From logged history" : "Data Limited"}
        </span>
      </div>

      {!hasSession ? (
        <p className="text-[11px] leading-[1.5] text-white/45">{cards[0]?.why ?? "Select or generate today's session to activate training intelligence."}</p>
      ) : (
        <>
          {/* Cards grid */}
          {/* Reads on left rules, not tinted tiles inside the panel (no card in a card). */}
          <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((card) => (
              <div key={card.key} className="border-l border-white/[0.08] pl-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11.5px] font-bold text-[#f2eee6]">{card.title}</p>
                  <span className="shrink-0 rounded-md border px-1.5 py-0.5 font-mono text-[7px] uppercase tracking-[0.12em]"
                    style={{ borderColor: `${card.statusColor}40`, background: `${card.statusColor}12`, color: card.statusColor }}>{card.status}</span>
                </div>
                <p className="mt-1.5 min-h-[30px] text-[10px] leading-[1.45] text-white/50">{card.why}</p>
                {card.actionLabel && (
                  <button type="button" onClick={() => card.actionTarget && onNavigate(card.actionTarget as DashboardView)}
                    className="mt-1.5 inline-flex items-center gap-1 font-mono text-[8px] uppercase tracking-[0.16em] text-white/40 transition hover:text-white/70">
                    {card.actionLabel}<ArrowRight size={10} />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Superset intelligence */}
          {(supersets.good.length > 0 || supersets.avoid.length > 0) && (
            <div className="mt-4 grid gap-x-5 gap-y-4 border-t border-white/[0.06] pt-3.5 lg:grid-cols-2">
              <div className="border-l border-white/[0.08] pl-3">
                <div className="mb-2 flex items-center gap-1.5"><Zap size={12} style={{ color: C.GREEN }} /><p className="font-mono text-[8px] uppercase tracking-[0.18em]" style={{ color: C.GREEN }}>Superset Opportunities</p></div>
                {supersets.good.length ? supersets.good.map((s, i) => (
                  <div key={i} className="mb-1.5 last:mb-0">
                    <p className="text-[11px] font-semibold text-[#f2eee6]">{s.a} <span className="text-white/30">+</span> {s.b}</p>
                    <p className="text-[9.5px] text-white/45"><span style={{ color: C.GREEN }}>{s.type}</span> · {s.why}</p>
                  </div>
                )) : <p className="text-[10px] text-white/40">No low-risk pairing stands out today.</p>}
              </div>
              <div className="border-l border-white/[0.08] pl-3">
                <div className="mb-2 flex items-center gap-1.5"><ShieldAlert size={12} style={{ color: C.RED }} /><p className="font-mono text-[8px] uppercase tracking-[0.18em]" style={{ color: C.RED }}>Avoid Pairing</p></div>
                {supersets.avoid.length ? supersets.avoid.map((s, i) => (
                  <div key={i} className="mb-1.5 last:mb-0">
                    <p className="text-[11px] font-semibold text-[#f2eee6]">{s.a} <span className="text-white/30">+</span> {s.b}</p>
                    <p className="text-[9.5px] text-white/45"><span style={{ color: C.RED }}>{s.type}</span> · {s.why}</p>
                  </div>
                )) : <p className="text-[10px] text-white/40">No risky compound stack detected — superset freely on detail work.</p>}
              </div>
            </div>
          )}

          {/* Rotation candidates */}
          {!noHistory && rotation.length > 0 && (
            <div className="mt-4 border-t border-white/[0.06] pt-3.5">
              <div className="mb-2 flex items-center gap-1.5"><Repeat size={12} style={{ color: C.GOLD }} /><p className="font-mono text-[8px] uppercase tracking-[0.18em]" style={{ color: C.GOLD }}>Rotation Suggestions</p></div>
              {rotation.map((r) => (
                <div key={r.movementId} className="mb-2 last:mb-0">
                  <p className="text-[11px] font-semibold text-[#f2eee6]">{r.name} <span className="font-mono text-[8px] uppercase tracking-[0.12em] text-white/35">· {r.reason}</span></p>
                  {r.alternatives.length > 0 && <p className="mt-0.5 text-[9.5px] text-white/45">Try: {r.alternatives.join(" · ")}</p>}
                </div>
              ))}
            </div>
          )}

          {/* Exposure list */}
          {!noHistory && (
          <div className="mt-4 border-t border-white/[0.06] pt-3.5">
            <div className="mb-2 flex items-center gap-1.5"><Layers size={12} style={{ color: C.STEEL }} /><p className="font-mono text-[8px] uppercase tracking-[0.18em]" style={{ color: C.STEEL }}>Movement Exposure</p></div>
            <div className="divide-y divide-white/[0.05]">
              {exposures.map((e) => (
                <div key={e.movementId} className="py-2 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[11px] font-semibold text-white/80">{e.name}{e.weakPointRelevant && <span className="ml-1.5 font-mono text-[7px] uppercase tracking-[0.12em]" style={{ color: C.VIOLET }}>Weak Pt</span>}</p>
                      <p className="font-mono text-[8px] uppercase tracking-[0.1em] text-white/35">{e.pattern} · {e.equipment}{e.premium ? " · Premium" : ""} · {e.weeksActive}w</p>
                    </div>
                    <span className="shrink-0 rounded-md border px-1.5 py-0.5 font-mono text-[7px] uppercase tracking-[0.12em]"
                      style={{ borderColor: `${plateauColor(e.status)}40`, color: plateauColor(e.status) }}>{plateauLabel(e.status)}</span>
                  </div>
                  {(e.premiumUpgrade || e.homeOption || e.recoveryFriendly || e.alternatives.length > 0) && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {e.premiumUpgrade && <span className="rounded border px-1.5 py-0.5 font-mono text-[7px] uppercase tracking-[0.1em]" style={{ borderColor: `${C.VIOLET}33`, color: C.VIOLET }}>Premium · {e.premiumUpgrade}</span>}
                      {e.recoveryFriendly && <span className="rounded border px-1.5 py-0.5 font-mono text-[7px] uppercase tracking-[0.1em]" style={{ borderColor: `${C.STEEL}33`, color: C.STEEL }}>Recovery · {e.recoveryFriendly}</span>}
                      {e.homeOption && <span className="rounded border px-1.5 py-0.5 font-mono text-[7px] uppercase tracking-[0.1em]" style={{ borderColor: `${C.GREEN}33`, color: C.GREEN }}>Home · {e.homeOption}</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <p className="mt-2 font-mono text-[7.5px] uppercase tracking-[0.14em] text-white/25">More logged session history sharpens plateau detection. Suggestions only — Reserve never forces a rotation.</p>
          </div>
          )}

          {noHistory && (
            <p className="mt-4 border-t border-white/[0.06] pt-3.5 text-[11px] leading-[1.5] text-white/45">
              Movement history, plateau risk and rotation candidates need closed sessions. Log a few and they open here.
            </p>
          )}

          <div className="mt-3 flex items-center gap-2">
            <Dumbbell size={11} className="text-white/30" />
            <p className="text-[9.5px] leading-[1.4] text-white/35">Stop with pain and follow clinician guidance. Substitutions preserve target tissue and movement pattern.</p>
          </div>
        </>
      )}
    </GlassPanel>
  );
}
