"use client";

/* ════════════════════════════════════════════════════════════════════════
   AI STRATEGIST — the quiet war room (Bible §02).

   An Intelligence screen, so the order is fixed (program redesign spec):
   the EVIDENCE comes before any finding. The member sees how many entries
   the read is built from, and over what span, before they read the read.

   One ranked list drives the screen (`resolveStrategistRead`): the
   statement, the gold action and the watch list all come from it, so the
   statement can never say "nothing is limiting you" beside a listed debt.
   Hurting ranks first, most severe first; helping follows.

   Removed in the redesign, and not replaced:
     · the "Strategist Confidence" 0–100 coverage ring and the coverage
       percentage. Confidence is a named level beside the real entry count.
     · separate helping / hurting panels (now one ranked list), the morning
       and night briefs that are not current, the nine-chip question cloud
       (three questions behind a disclosure) and the "Open a system" row the
       sidebar and tab bar already provide.

   Every line is deterministic and comes from the member's own logs. No
   projections of body change, no forecasts, no medical or dosing guidance.
   ════════════════════════════════════════════════════════════════════════ */

import { motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, ArrowRight, Brain, CheckCircle2, Moon, Sun, Sunrise } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { GlassPanel } from "@/components/ui/GlassPanel";
import {
  DETAIL_BAND_BLEED,
  ReserveButton,
  ReserveConfidence,
  ReserveDetailImage,
  ReserveDisclosure,
  ReserveSectionHeader,
} from "@/components/ui/reserve";
import { DashboardView, useAthleteDashboardStore } from "@/lib/athlete-store";
import {
  answerStrategicQuestion,
  buildStrategistBriefing,
  resolveStrategistRead,
} from "@/lib/ai-strategist/engine";
import { buildStrategistEvidence } from "@/lib/ai-strategist/evidence";
import type {
  StrategicAnswer,
  StrategicQuestionId,
  SystemMatrixStatus,
} from "@/lib/ai-strategist/types";
import { RESERVE, alpha } from "@/lib/design/tokens";

import { ViewShell } from "./ViewShell";

const STATUS_COLOR: Record<SystemMatrixStatus, string> = {
  strong: RESERVE.green,
  "on-track": RESERVE.steel,
  watch: RESERVE.amber,
  "needs-input": RESERVE.gold,
  "data-limited": RESERVE.slate,
  "log-only": RESERVE.slate,
  "lifestyle-only": RESERVE.violet,
  "estimate-only": RESERVE.violet,
  locked: RESERVE.slate,
};

const STATUS_LABEL: Record<SystemMatrixStatus, string> = {
  strong: "Strong",
  "on-track": "On Track",
  watch: "Watch",
  "needs-input": "Needs Input",
  "data-limited": "Data Limited",
  "log-only": "Log Only",
  "lifestyle-only": "Lifestyle Only",
  "estimate-only": "Estimate Only",
  locked: "Locked",
};

const SEVERITY_COLOR = { high: RESERVE.red, moderate: RESERVE.amber, low: RESERVE.slate } as const;

const BRIEF_ICON = { morning: Sunrise, midday: Sun, night: Moon } as const;

/** The three questions that change a decision. The rest restated the list above. */
const ASK: StrategicQuestionId[] = ["holding-back", "focus-today", "missing-data"];

/* Deterministic pre-mount time so SSR and the first client render agree. */
const FIXED_NOON = new Date(2025, 0, 1, 12, 0, 0);

const DISCLAIMER = "Observations from your own logs — not coaching prescriptions or medical advice.";

/** A readout with no surface of its own — a row in the hero, never a tile. */
function Read({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="min-w-0">
      <dt className="font-mono text-[9px] uppercase tracking-[0.22em] text-white/60">{label}</dt>
      <dd
        className="mt-1.5 text-[13px] font-semibold capitalize leading-snug"
        style={{ color: color ?? RESERVE.ivory }}
      >
        {value}
      </dd>
    </div>
  );
}

export function AIStrategistView() {
  const schedule = useAthleteDashboardStore((s) => s.scheduleProfile);
  const recovery = useAthleteDashboardStore((s) => s.recoveryCommand);
  const physique = useAthleteDashboardStore((s) => s.physiqueCommand);
  const womens = useAthleteDashboardStore((s) => s.womens);
  const enhancedLogOnly = useAthleteDashboardStore((s) => s.modulePreferences.enhancedLogOnly);
  const trainingSessionMode = useAthleteDashboardStore((s) => s.trainingSession.sessionMode);
  const setActiveView = useAthleteDashboardStore((s) => s.setActiveView);
  const reduceMotion = useReducedMotion();

  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setNow(new Date()));
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => {
      cancelAnimationFrame(frame);
      clearInterval(id);
    };
  }, []);

  const briefing = useMemo(
    () =>
      buildStrategistBriefing({
        schedule,
        recovery,
        physique,
        womens,
        enhancedLogOnly,
        trainingSessionMode,
        now: now ?? FIXED_NOON,
      }),
    [schedule, recovery, physique, womens, enhancedLogOnly, trainingSessionMode, now],
  );

  /* The evidence status line — entries and span, from the member's own logs. */
  const evidence = useMemo(
    () =>
      buildStrategistEvidence({
        sleepDates: recovery.sleepLogs.map((log) => log.date),
        hydrationDates: recovery.hydrationLogs.map((log) => log.date),
        checkInDates: recovery.stressCheckIns.map((entry) => entry.date),
        physiqueDates: physique.entries.map((entry) => entry.date),
      }),
    [recovery.sleepLogs, recovery.hydrationLogs, recovery.stressCheckIns, physique.entries],
  );

  const read = useMemo(() => resolveStrategistRead(briefing), [briefing]);

  const [activeQuestion, setActiveQuestion] = useState<StrategicQuestionId | null>(null);
  const answer: StrategicAnswer | null = useMemo(
    () => (activeQuestion ? answerStrategicQuestion(activeQuestion, briefing) : null),
    [activeQuestion, briefing],
  );

  const metric = (label: string) => briefing.heroMetrics.find((m) => m.label === label) ?? null;
  const mission = metric("Mission Status");
  const reserveRead = metric("Recovery Reserve");
  const momentum = metric("Physique Momentum");

  const confidenceLevel = briefing.confidence.level === "limited" ? "low" : briefing.confidence.level;
  const currentBrief = briefing.briefs.find((brief) => brief.active) ?? briefing.briefs[0];
  const questions = briefing.questions.filter((question) => ASK.includes(question.id));

  const onTrack = briefing.systemMatrix.filter((s) => s.status === "strong" || s.status === "on-track").length;
  const watching = briefing.systemMatrix.filter((s) => s.status === "watch" || s.status === "needs-input").length;
  const systemsSummary = `All systems · ${onTrack} on track${watching ? ` · ${watching} to watch` : ""}`;

  return (
    <ViewShell
      label="AI Performance Strategist"
      title="AI Strategist"
      icon={Brain}
      accentColor={RESERVE.violet}
      badge="Reserve Black"
      roomHero
      command="One read of your logged systems, and the one move it points to."
      disclaimer={DISCLAIMER}
    >
      {/* ── HERO ─────────────────────────────────────────────────────────
          Evidence first, then the statement it supports (Bible §12 rule 3). */}
      <GlassPanel accent={RESERVE.violet} noPad phone="flush" className="md:overflow-hidden">
        <section aria-label="Today's read" data-strategist="hero" className="relative pb-5 pt-4 md:p-6 lg:px-8 lg:py-6">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -inset-x-3 inset-y-0 max-md:[mask-image:linear-gradient(180deg,#000_55%,transparent)] md:inset-x-0"
            style={{
              background: `radial-gradient(110% 90% at 0% 15%, ${alpha(RESERVE.violet, 0.09)}, transparent 55%), radial-gradient(80% 70% at 100% 100%, ${alpha(RESERVE.steel, 0.04)}, transparent 60%)`,
            }}
          />

          <div className="relative grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)] lg:items-end lg:gap-12">
            <div className="min-w-0">
              <p
                data-strategist="evidence"
                className="tnum font-mono text-[9px] uppercase tracking-[0.22em] text-white/60"
              >
                {evidence.line}
              </p>
              <h2
                data-room-statement
                className="mt-2.5 font-display text-[28px] font-black uppercase leading-[0.95] tracking-[-0.02em] text-[#f2eee6] [hyphens:none] sm:text-[34px] lg:text-[42px]"
              >
                {read.statement}
              </h2>
              <div className="mt-3">
                <ReserveConfidence level={confidenceLevel} />
              </div>
            </div>

            <div className="min-w-0">
              <dl className="grid grid-cols-3 gap-4">
                <Read label="Mission" value={mission?.value ?? "—"} color={mission?.color} />
                <Read label="Recovery" value={reserveRead?.value ?? "—"} color={reserveRead?.color} />
                <Read label="Momentum" value={momentum?.value ?? "—"} color={momentum?.color} />
              </dl>

              <p data-strategist="action-title" className="mt-4 text-[14px] font-semibold leading-snug text-[#f2eee6] [text-wrap:balance]">
                {read.action.title}
              </p>
              <p className="mt-1 max-w-[56ch] text-[12.5px] leading-[1.5] text-white/60">{read.action.reason}</p>
              {/* The screen's one gold action (Bible §11) — the limiting room, or
                  the highest-ROI move when nothing in the logs is limiting. */}
              {read.action.target && (
                <div data-strategist="primary-action" className="mt-3 min-w-0 max-sm:w-full sm:inline-block">
                  <ReserveButton
                    tier="primary"
                    size="md"
                    fullWidth
                    iconAfter={ArrowRight}
                    onClick={() => setActiveView(read.action.target as DashboardView)}
                  >
                    {read.action.label}
                  </ReserveButton>
                </div>
              )}
            </div>
          </div>
        </section>
      </GlassPanel>

      {!briefing.hasData ? (
        <GlassPanel noPad phone="flush" className="md:p-5">
          <ReserveDetailImage id="strategist-command" className={DETAIL_BAND_BLEED} />
          <ReserveSectionHeader label="What would build the read" accent={RESERVE.violet} />
          <ul className="divide-y divide-white/[0.05]">
            {[
              "A recovery check-in — sleep, hydration and stress are the base of every read.",
              "A physique baseline, so momentum has something to compare against.",
              "A closed training session, so completed work counts, not just plans.",
            ].map((line) => (
              <li key={line} className="py-2.5 text-[12.5px] leading-[1.55] text-white/60">
                {line}
              </li>
            ))}
          </ul>
        </GlassPanel>
      ) : (
        <>
          {/* ── THE WATCH LIST — one ranked list, hurting first ─────────── */}
          <GlassPanel noPad phone="flush" className="md:p-5">
            <ReserveDetailImage id="strategist-command" className={DETAIL_BAND_BLEED} />
            <section data-strategist="watch-list" aria-label="What is moving your read">
              <ReserveSectionHeader label={`What is moving your read · ${read.watchList.length}`} accent={RESERVE.violet} />
              {read.watchList.length ? (
                <ol className="divide-y divide-white/[0.05]">
                  {read.watchList.map((item) => {
                    const hurting = item.kind === "hurting";
                    const color = hurting ? SEVERITY_COLOR[item.severity ?? "low"] : RESERVE.green;
                    const Icon = hurting ? AlertTriangle : CheckCircle2;
                    return (
                      <li key={item.id} data-watch-kind={item.kind} className="py-3 first:pt-0 last:pb-0">
                        <div className="flex items-start justify-between gap-3">
                          <p className="flex min-w-0 items-center gap-1.5 text-[12.5px] font-bold text-white/80">
                            <Icon size={12} style={{ color }} aria-hidden="true" className="shrink-0" />
                            {item.title}
                          </p>
                          {/* Never colour alone — the word is present. */}
                          <span className="shrink-0 font-mono text-[8px] uppercase tracking-[0.18em]" style={{ color }}>
                            {hurting ? item.severity : "Helping"} · {item.source}
                          </span>
                        </div>
                        <p className="mt-1 text-[12px] leading-[1.5] text-white/50">{item.detail}</p>
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <p className="text-[12px] text-white/45">Evidence needed — nothing in your logs is named as helping or hurting yet.</p>
              )}

              <div className="mt-3 border-t border-white/[0.05] pt-1">
                <ReserveDisclosure summary={systemsSummary} accent={RESERVE.steel}>
                  <ul data-strategist="systems" className="divide-y divide-white/[0.05]">
                    {briefing.systemMatrix.map((system) => {
                      const color = STATUS_COLOR[system.status];
                      return (
                        <li key={system.system} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 first:pt-0">
                          <p className="text-[12.5px] font-bold text-[#f2eee6]">{system.system}</p>
                          <span className="font-mono text-[8px] uppercase tracking-[0.18em]" style={{ color }}>
                            {STATUS_LABEL[system.status]}
                          </span>
                          <p className="w-full text-[12px] leading-[1.5] text-white/50 sm:w-auto sm:flex-1">{system.note}</p>
                          {system.target && (
                            <button
                              type="button"
                              onClick={() => setActiveView(system.target as DashboardView)}
                              className="inline-flex min-h-[44px] items-center gap-1 font-mono text-[8px] uppercase tracking-[0.2em] text-white/45 transition hover:text-white/80"
                            >
                              {system.actionLabel ?? "Open"}
                              <ArrowRight size={11} aria-hidden="true" />
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </ReserveDisclosure>
              </div>
            </section>
          </GlassPanel>

          {/* ── THE CURRENT BRIEF, AND THREE QUESTIONS ─────────────────── */}
          {currentBrief && (
            <GlassPanel noPad phone="flush" className="md:p-5">
              <section data-strategist="brief" aria-label={currentBrief.label}>
                <ReserveSectionHeader label={`${currentBrief.label} · now`} accent={RESERVE.gold} />
                <p className="flex gap-2 text-[12.5px] leading-[1.55] text-white/65">
                  {(() => {
                    const Icon = BRIEF_ICON[currentBrief.type];
                    return <Icon size={13} style={{ color: RESERVE.slate }} aria-hidden="true" className="mt-0.5 shrink-0" />;
                  })()}
                  <span>{currentBrief.body}</span>
                </p>

                <div className="mt-3 border-t border-white/[0.05] pt-1">
                  <ReserveDisclosure summary={`Ask the strategist · ${questions.length} questions`} accent={RESERVE.violet}>
                    <div className="flex flex-wrap gap-2">
                      {questions.map((question) => {
                        const active = activeQuestion === question.id;
                        return (
                          <button
                            key={question.id}
                            type="button"
                            aria-pressed={active}
                            onClick={() => setActiveQuestion(active ? null : question.id)}
                            className="min-h-[44px] rounded-xl px-3 text-[12px] font-medium transition"
                            style={{
                              background: active ? alpha(RESERVE.violet, 0.16) : "rgba(255,255,255,0.03)",
                              color: active ? RESERVE.violet : "rgba(255,255,255,0.6)",
                            }}
                          >
                            {question.label}
                          </button>
                        );
                      })}
                    </div>
                    {answer && (
                      <motion.div
                        initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.28 }}
                        data-strategist="answer"
                        className="mt-4 border-l-2 pl-3.5"
                        style={{ borderColor: alpha(RESERVE.violet, 0.5) }}
                      >
                        <p className="text-[13px] leading-[1.6] text-white/70">{answer.answer}</p>
                        <p className="mt-2 font-mono text-[8px] uppercase tracking-[0.2em] text-white/45">
                          Next · {answer.nextAction} · {answer.confidence} confidence
                        </p>
                      </motion.div>
                    )}
                  </ReserveDisclosure>
                </div>
              </section>
            </GlassPanel>
          )}
        </>
      )}
    </ViewShell>
  );
}
