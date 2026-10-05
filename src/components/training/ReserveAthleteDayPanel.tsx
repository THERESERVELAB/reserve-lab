"use client";

/* ════════════════════════════════════════════════════════════════════════
   RESERVE ATHLETE DAY PANEL — member-facing surface for the Reserve Athlete
   Method inside the daily Training view.

   Self-contained and fully additive: renders NOTHING unless the active protocol
   belongs to the Reserve Athlete Method, so existing protocols are undisturbed.
   Shows the hierarchy, today's signature session (Wednesday Recovery-Athlete /
   Saturday Reserve Athlete Day), and the load-adaptive recovery prescription.

   Observational framing only — no medical claims, no dosing.
   ════════════════════════════════════════════════════════════════════════ */

import { Activity, AlertTriangle, Brain, Gauge, ShieldCheck, Sparkles, Trophy, Waves, Zap } from "lucide-react";

import { GlassPanel } from "@/components/ui/GlassPanel";
import { useAthleteDashboardStore } from "@/lib/athlete-store";
import { useProtocolWeek } from "@/lib/hooks/useProtocolWeek";
import { computeProtocolProgress } from "@/lib/protocol/library";
import { getPhaseForWeek } from "@/lib/training/progression-engine";
import { buildRecoverySnapshot } from "@/lib/recovery/engine";
import { buildPhysiqueGuidance } from "@/lib/physique/engine";
import {
  PILLAR_LABEL,
  RESERVE_ATHLETE_PILLARS,
  RESERVE_ATHLETE_SESSIONS,
  isReserveAthlete,
} from "@/lib/training/reserve-athlete";
import { amenitiesForEnvironment } from "@/lib/training/facilities";
import {
  RECOVERY_MODALITY_LABEL,
  buildRecoveryPrescription,
  type SessionLoadType,
} from "@/lib/training/recovery-engine";
import {
  ATHLETIC_QUALITY_LABEL,
  assessAthleticBoard,
  type AthleticStatus,
} from "@/lib/training/athletic-progression";
import { buildReadinessSignals, computeReadiness, type ReadinessBand } from "@/lib/training/readiness-engine";
import { evaluatePhysiqueProtection } from "@/lib/training/physique-protection";
import { adaptToday } from "@/lib/training/decision-engine";
import { evaluateAthleticBalance } from "@/lib/training/athletic-balance";

const GOLD = "#d5b15f";
const STEEL = "#5fb7d5";
const VIOLET = "#a78bfa";
const GREEN = "#6ee7b7";
const SLATE = "#8ea0b8";
const AMBER = "#e8c87a";
const RED = "#ef7d55";

const READINESS_BAND_COLOR: Record<ReadinessBand, string> = {
  primed: GREEN, ready: GREEN, moderate: STEEL, compromised: AMBER, depleted: RED,
};
const READINESS_BAND_LABEL: Record<ReadinessBand, string> = {
  primed: "Primed", ready: "Ready", moderate: "Moderate", compromised: "Compromised", depleted: "Depleted",
};

function statusColor(s: AthleticStatus): string {
  return s === "progressing" ? GREEN : s === "back-off" ? VIOLET : s === "hold" ? STEEL : SLATE;
}

/** Hybrid-week load by day index (0=Mon … 6=Sun) — drives the recovery emphasis. */
const DAY_LOAD: Record<number, SessionLoadType> = {
  0: "heavy-upper",
  1: "heavy-lower",
  2: "rest",
  3: "hypertrophy",
  4: "heavy-lower",
  5: "sprint-power",
  6: "rest",
};

/** Rough readiness contribution (0..100) of yesterday's session load, used as
    the "trainingLoad" readiness signal — heavier load lowers today's score. */
const LOAD_READINESS: Record<SessionLoadType, number> = {
  "heavy-lower": 55, "heavy-upper": 60, hypertrophy: 70, "sprint-power": 50, conditioning: 65, rest: 95,
};

export function ReserveAthleteDayPanel() {
  const activeProtocol = useAthleteDashboardStore((s) => s.activeProtocol);
  const gymEnvironment = useAthleteDashboardStore((s) => s.userTrainingProfile.gymEnvironment);
  const reserveAthleteFacilities = useAthleteDashboardStore((s) => s.reserveAthleteFacilities);
  const recoveryCommand = useAthleteDashboardStore((s) => s.recoveryCommand);
  const physiqueCommand = useAthleteDashboardStore((s) => s.physiqueCommand);
  const { week } = useProtocolWeek();

  // Additive guard: render nothing for any non–Reserve-Athlete protocol.
  if (!isReserveAthlete(activeProtocol?.category, activeProtocol?.protocolId)) return null;

  const today = week.find((d) => d.isToday) ?? null;
  const dayIndex = today?.dayIndex ?? 0;
  const yesterdayIndex = (dayIndex + 6) % 7;
  const todayLoadType = DAY_LOAD[dayIndex] ?? "rest";
  const yesterdayLoadType = DAY_LOAD[yesterdayIndex] ?? null;

  const amenities = reserveAthleteFacilities.length ? reserveAthleteFacilities : amenitiesForEnvironment(gymEnvironment);
  const rx = buildRecoveryPrescription(todayLoadType, amenities);
  const athleticBoard = assessAthleticBoard({});

  /* ── Reserve Athlete Intelligence — the daily decision layer.
        docs/RESERVE_ATHLETE_INTELLIGENCE.md § 3.1/3.2/3.4/3.5. Composes
        existing systems (recovery snapshot, physique guidance, protocol
        progress, the athletic-progression board) — no new tracking. ── */
  const nowForIntel = new Date();
  const recoverySnapshot = buildRecoverySnapshot(recoveryCommand, nowForIntel);
  const physiqueGuidance = buildPhysiqueGuidance(physiqueCommand, nowForIntel);
  const protocolProgress = activeProtocol ? computeProtocolProgress(activeProtocol, nowForIntel) : null;
  const mesoPhase = protocolProgress ? getPhaseForWeek(((protocolProgress.currentWeek - 1) % 8) + 1).phase : null;
  const legGrowthWeek =
    physiqueCommand.focus?.primary === "glutes" ||
    physiqueCommand.focus?.primary === "quads" ||
    (physiqueCommand.weakPoints ?? []).some((w) => w === "glutes" || w === "quads");

  const readinessSignals = buildReadinessSignals({
    recovery: {
      hasData: recoverySnapshot.hasData,
      reserve: recoverySnapshot.reserve,
      sleepAvg7: recoverySnapshot.sleepAvg7,
      sleepConsistency: recoverySnapshot.sleepConsistency,
      stressLoad: recoverySnapshot.stressLoad,
      mobilityThisWeek: recoverySnapshot.mobilityThisWeek,
      mobilityWeeklyTarget: recoverySnapshot.mobilityWeeklyTarget,
      hydrationStatus: recoverySnapshot.hydrationStatus,
    },
    sleepTargetHours: recoveryCommand.sleepTargetHours,
    yesterdayLoadReadiness: yesterdayLoadType ? LOAD_READINESS[yesterdayLoadType] : null,
  });
  const readiness = computeReadiness(readinessSignals);
  const protection = evaluatePhysiqueProtection({
    weightTrend: physiqueGuidance.hasData ? physiqueGuidance.weightTrend : "data-limited",
    weightDeltaLb: physiqueGuidance.weightDeltaLb,
    physiqueMomentum: physiqueGuidance.hasData ? physiqueGuidance.momentum : "needs-data",
    legGrowthWeek,
    hasRecoveryData: recoverySnapshot.hasData,
    recoveryReserve: recoverySnapshot.hasData ? recoverySnapshot.reserve : null,
    mesoPhase,
  });
  const decision = adaptToday({ readiness, protection, todayLoadType, yesterdayLoadType });
  const balance = evaluateAthleticBalance({
    physiqueMomentum: physiqueGuidance.hasData ? physiqueGuidance.momentum : undefined,
    athleticBoard,
    recoveryHasData: recoverySnapshot.hasData,
    recoveryReserve: recoverySnapshot.hasData ? recoverySnapshot.reserve : null,
    mobilityThisWeek: recoverySnapshot.mobilityThisWeek,
    mobilityWeeklyTarget: recoverySnapshot.mobilityWeeklyTarget,
  });

  return (
    <GlassPanel accent={GOLD} noPad className="overflow-hidden">
      <div className="relative p-5">
        <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse at 15% 0%, rgba(213,177,95,0.1) 0%, transparent 55%)" }} />
        <div className="relative">
          {/* Identity */}
          <div className="flex items-center gap-2">
            <Trophy size={13} style={{ color: GOLD }} />
            <p className="font-mono text-[9px] uppercase tracking-[0.26em]" style={{ color: GOLD }}>Reserve Athlete Method</p>
          </div>
          <p className="mt-2 text-[13px] font-bold text-[#f2eee6]">Bodybuilder first. Athlete second.</p>
          <p className="mt-1 text-[11.5px] leading-snug text-white/55">
            Athletic capacity and recovery are layered around a protected physique core — they sharpen the look, never spend it.
          </p>

          {/* Hierarchy strip */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {RESERVE_ATHLETE_PILLARS.map((p, i) => (
              <span key={p} className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[8.5px] uppercase tracking-[0.14em]" style={{ borderColor: "rgba(255,255,255,0.1)", color: "rgba(242,238,230,0.65)" }}>
                <span style={{ color: GOLD }}>{i + 1}</span>{PILLAR_LABEL[p]}
              </span>
            ))}
          </div>

          {/* Reserve Athlete Intelligence — daily readiness + adaptive call +
              physique protection + athletic balance. docs/RESERVE_ATHLETE_INTELLIGENCE.md */}
          <div className="mt-4 rounded-xl p-4" style={{ borderColor: `${GOLD}33`, background: `${GOLD}08` }}>
            <div className="flex flex-wrap items-center gap-2">
              <Brain size={12} style={{ color: GOLD }} />
              <p className="font-mono text-[9px] uppercase tracking-[0.2em]" style={{ color: GOLD }}>Reserve Athlete Intelligence</p>
              <span className="ml-auto rounded-full border px-2 py-0.5 font-mono text-[7.5px] uppercase tracking-[0.14em]" style={{ borderColor: `${READINESS_BAND_COLOR[readiness.band]}45`, color: READINESS_BAND_COLOR[readiness.band] }}>
                {READINESS_BAND_LABEL[readiness.band]} · {readiness.confidence} confidence
              </span>
            </div>

            {/* Today's adaptive call(s) */}
            <div className="mt-3 grid gap-2">
              {decision.map((d) => (
                <div key={d.id} className="rounded-lg bg-white/[0.02] p-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[12px] font-bold text-[#f2eee6]">{d.headline}</p>
                    {d.protectsPhysique && <ShieldCheck size={12} className="mt-0.5 shrink-0" style={{ color: STEEL }} />}
                  </div>
                  <p className="mt-1 text-[10.5px] leading-snug text-white/50">{d.reason}</p>
                </div>
              ))}
            </div>

            {/* Physique protection verdict */}
            <div className="mt-3 flex items-start gap-2 rounded-lg p-2.5" style={{ borderColor: protection.verdict === "intervene" ? `${RED}40` : protection.verdict === "watch" ? `${AMBER}35` : "rgba(255,255,255,0.07)", background: protection.verdict === "intervene" ? `${RED}0d` : "rgba(255,255,255,0.02)" }}>
              {protection.verdict !== "protected" ? (
                <AlertTriangle size={12} className="mt-0.5 shrink-0" style={{ color: protection.verdict === "intervene" ? RED : AMBER }} />
              ) : (
                <ShieldCheck size={12} className="mt-0.5 shrink-0" style={{ color: GREEN }} />
              )}
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-[#f2eee6]">
                  Physique Protection · {protection.verdict === "intervene" ? "Intervene" : protection.verdict === "watch" ? "Watch" : "Protected"}
                </p>
                <p className="mt-0.5 text-[10px] leading-snug text-white/45">
                  {protection.flags.length > 0 ? protection.flags.map((f) => f.label).join(" · ") : "No guardrails active — \"Muscle always wins\" is quiet today."}
                </p>
              </div>
            </div>

            {/* Athletic balance laggard */}
            <div className="mt-3 flex items-center gap-2">
              <Zap size={11} style={{ color: VIOLET }} />
              <p className="text-[10.5px] leading-snug text-white/50">{balance.recommendation}</p>
            </div>

            {readiness.confidence === "limited" && (
              <p className="mt-2.5 text-[9.5px] leading-snug text-white/30">Limited data — log a recovery check-in to sharpen this read.</p>
            )}
          </div>

          {/* Signature days — the system, always visible; today is highlighted. */}
          <div className="mt-4 grid gap-3">
            {RESERVE_ATHLETE_SESSIONS.map((s) => {
              const isToday = s.dayIndex === dayIndex;
              return (
                <div key={s.id} className="rounded-xl p-4" style={{ borderColor: isToday ? `${VIOLET}59` : `${VIOLET}26`, background: `${VIOLET}0d` }}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Sparkles size={12} style={{ color: VIOLET }} />
                      <p className="font-mono text-[9px] uppercase tracking-[0.2em]" style={{ color: VIOLET }}>{s.weekday} · {s.title}</p>
                    </div>
                    {isToday && <span className="rounded-full border px-2 py-0.5 font-mono text-[8px] uppercase tracking-[0.16em]" style={{ borderColor: `${GOLD}59`, background: `${GOLD}18`, color: GOLD }}>Today</span>}
                  </div>
                  <p className="mt-1.5 text-[11.5px] leading-snug text-white/60">{s.identity}</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {s.blocks.map((b) => (
                      <div key={b.label} className="rounded-lg bg-white/[0.02] p-2.5">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="text-[12px] font-bold text-[#f2eee6]">{b.label}</p>
                          <p className="font-mono text-[8.5px] uppercase tracking-[0.12em] text-white/40">{b.detail}</p>
                        </div>
                        <p className="mt-1 text-[10.5px] leading-snug text-white/45">{b.purpose}</p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-2.5 text-[10px] leading-snug text-white/35">{s.note}</p>
                </div>
              );
            })}
          </div>

          {/* Load-adaptive recovery prescription */}
          <div className="mt-4 rounded-xl p-4" style={{ borderColor: `${STEEL}33`, background: `${STEEL}0d` }}>
            <div className="flex items-center gap-2">
              <Waves size={12} style={{ color: STEEL }} />
              <p className="font-mono text-[9px] uppercase tracking-[0.2em]" style={{ color: STEEL }}>Recovery Prescription</p>
              <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-white/35">· {rx.loadType.replace(/-/g, " ")}</span>
            </div>
            <p className="mt-1.5 text-[11.5px] leading-snug text-white/60">{rx.emphasis}</p>
            {rx.modalities.length > 0 ? (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {rx.modalities.map((m) => (
                  <span key={m} className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold" style={{ borderColor: `${GREEN}33`, background: `${GREEN}10`, color: GREEN }}>
                    <Activity size={9} />{RECOVERY_MODALITY_LABEL[m]}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-[10.5px] text-white/40">Add your facilities in Reserve Athlete onboarding to see matched recovery work.</p>
            )}
            <div className="mt-3 flex items-start gap-1.5">
              <ShieldCheck size={11} className="mt-0.5 shrink-0 text-white/30" />
              <p className="text-[9.5px] leading-snug text-white/35">{rx.note}</p>
            </div>
          </div>

          {/* Athletic capacity track — the qualities layered on top of the physique. */}
          <div className="mt-4 rounded-xl p-4" style={{ borderColor: `${GOLD}26`, background: `${GOLD}0a` }}>
            <div className="flex items-center gap-2">
              <Gauge size={12} style={{ color: GOLD }} />
              <p className="font-mono text-[9px] uppercase tracking-[0.2em]" style={{ color: GOLD }}>Athletic Capacity</p>
            </div>
            <p className="mt-1.5 text-[11px] leading-snug text-white/50">
              The qualities Reserve Athlete builds on top of the physique. Log efforts to track the trend — athletic load yields to the physique during specialization.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {athleticBoard.map((a) => (
                <div key={a.quality} className="rounded-lg bg-white/[0.02] p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[12px] font-bold text-[#f2eee6]">{ATHLETIC_QUALITY_LABEL[a.quality]}</p>
                    <span className="rounded-full border px-1.5 py-0.5 font-mono text-[7.5px] uppercase tracking-[0.12em]" style={{ borderColor: `${statusColor(a.status)}44`, color: statusColor(a.status) }}>{a.status}</span>
                  </div>
                  <p className="mt-1 text-[10px] leading-snug text-white/45">{a.target}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </GlassPanel>
  );
}
