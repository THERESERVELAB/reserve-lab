"use client";

/* ════════════════════════════════════════════════════════════════════════
   DECISION LOG — the auditable record of every change to the plan.

   An Intelligence screen, so the order is fixed (program redesign spec):
   the EVIDENCE comes before any entry. The member sees how many records
   exist and over what span before they read one, and every count is a real
   stored record — decision ledger, Response Model events, Program Horizon
   revisions. Nothing is projected and nothing is seeded.

   This screen is a record, not a control surface: once history exists there
   is no honest "next thing to do" here, so it carries NO gold action. The
   one case that does is the empty one, where logging a session is what
   creates the first record.

   Observational only. No medical, dosage, supplement or compound guidance.
   ════════════════════════════════════════════════════════════════════════ */

import { motion, useReducedMotion } from "framer-motion";
import { Activity, ArrowRight } from "lucide-react";

import { ResponseEventLog } from "@/components/response/ResponseEventLog";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { DETAIL_BAND_BLEED, ReserveButton, ReserveDetailImage, ReserveSectionHeader } from "@/components/ui/reserve";
import { useAthleteDashboardStore } from "@/lib/athlete-store";
import { RESERVE, alpha } from "@/lib/design/tokens";
import { useResponseModel } from "@/lib/hooks/useResponseModel";
import type { ProgramRevision } from "@/lib/horizon/types";
import {
  optimizationEvidenceLine,
  resolveOptimizationHistory,
} from "@/lib/response-model/optimization-history";
import type { ReserveDecisionRecord } from "@/lib/training/session-execution";

import { ViewShell } from "./ViewShell";

const DECISION_LABEL: Record<string, string> = {
  "session-adjustment": "Session Adjusted",
  "schedule-adjustment": "Schedule Adjusted",
  "activity-reconciliation": "Activity Reconciled",
  "pain-adjustment": "Pain Substitution",
  "readiness-adjustment": "Readiness Adjustment",
  "exercise-substitution": "Movement Substituted",
  "week-revision": "Week Revised",
  "protocol-selection": "Program Activated",
  "athlete-decision": "Athlete Decision",
  "coach-decision": "Coach Decision",
  migration: "Migration Completed",
};

const EMPTY_REVISIONS: ProgramRevision[] = [];

function decisionLabel(record: ReserveDecisionRecord): string {
  if (record.category !== "protocol-selection") return DECISION_LABEL[record.category] ?? record.category;
  if (record.athleteDecision === "deferred") return "Protocol Change Deferred";
  if (record.decision.toLowerCase().startsWith("activated")) return "Program Activated";
  return "Protocol Decision";
}

/** A readout with no surface of its own — a row in the hero, never a tile. */
function Read({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="min-w-0">
      <dt className="font-mono text-[9px] uppercase tracking-[0.22em] text-white/60">{label}</dt>
      <dd className="tnum mt-1.5 font-display text-[26px] font-black leading-none text-[#f2eee6] sm:text-[30px]">
        {value}
      </dd>
    </div>
  );
}

export function PerformanceIntelligenceView() {
  const shouldReduceMotion = useReducedMotion();
  const decisions = useAthleteDashboardStore((state) => state.trainingSession.decisionHistory);
  const horizon = useAthleteDashboardStore((state) => state.programHorizon.horizon);
  const setActiveView = useAthleteDashboardStore((state) => state.setActiveView);
  const revisions = horizon?.revisions ?? EMPTY_REVISIONS;
  const { events, model } = useResponseModel();

  const history = resolveOptimizationHistory({ decisions, events, revisions });
  const evidence = optimizationEvidenceLine(history);
  const recent = [...history.decisions].reverse();
  const total = history.counts.decisions + history.counts.events + history.counts.revisions;

  const statement = history.hasHistory
    ? `Reserve has recorded ${total} change${total === 1 ? "" : "s"} to your plan.`
    : "No change to your plan has been recorded yet.";

  return (
    <ViewShell
      label="Decision History"
      title="Decision Log"
      icon={Activity}
      accentColor={RESERVE.gold}
      badge="Reserve Black"
      roomHero
      command="Every change to your plan, who made it, and what it was based on."
      disclaimer="An auditable history of real program, schedule, response and session decisions. Observational only — no medical advice, protocol optimization, or dosing guidance."
    >
      {/* ── HERO ─────────────────────────────────────────────────────────
          Evidence first, then the statement it supports (Bible §12 rule 3). */}
      <GlassPanel accent={RESERVE.gold} noPad phone="flush" className="md:overflow-hidden">
        <section
          aria-label="What this log is built from"
          data-optimization="hero"
          className="relative pb-5 pt-4 md:p-6 lg:px-8 lg:py-6"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -inset-x-3 inset-y-0 max-md:[mask-image:linear-gradient(180deg,#000_55%,transparent)] md:inset-x-0"
            style={{
              background: `radial-gradient(110% 90% at 0% 15%, ${alpha(RESERVE.gold, 0.075)}, transparent 55%)`,
            }}
          />

          <div className="relative grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)] lg:items-end lg:gap-12">
            <div className="min-w-0">
              <p
                data-optimization="evidence"
                className="tnum font-mono text-[9px] uppercase tracking-[0.22em] text-white/60"
              >
                {evidence}
              </p>
              <h2
                data-room-statement
                className="mt-2.5 font-display text-[28px] font-black uppercase leading-[0.95] tracking-[-0.02em] text-[#f2eee6] [hyphens:none] sm:text-[34px] lg:text-[42px]"
              >
                {statement}
              </h2>
              <p className="mt-3 max-w-[58ch] text-[13px] leading-[1.55] text-white/70">
                Every entry below happened. Nothing here is seeded, defaulted or illustrative.
              </p>
            </div>

            <div className="min-w-0">
              <dl className="grid grid-cols-3 gap-4">
                <Read label="Decisions" value={history.counts.decisions} />
                <Read label="Events" value={history.counts.events} />
                <Read label="Revisions" value={history.counts.revisions} />
              </dl>

              {/* The one honest action exists only while the log is empty:
                  closing a session is what writes the first record. Once there
                  is history this screen is read-only and carries no gold CTA. */}
              {!history.hasHistory && (
                <div data-optimization="primary-action" className="mt-4 min-w-0 max-sm:w-full sm:inline-block">
                  <ReserveButton
                    tier="primary"
                    size="md"
                    fullWidth
                    iconAfter={ArrowRight}
                    onClick={() => setActiveView("training")}
                  >
                    Open Training Command
                  </ReserveButton>
                </div>
              )}
              <p className="mt-2.5 font-mono text-[8px] uppercase tracking-[0.2em] text-white/40">
                Model {model.modelVersion}
              </p>
            </div>
          </div>
        </section>
      </GlassPanel>

      {history.hasHistory ? (
        <>
          <GlassPanel noPad phone="flush" className="md:p-5">
            <ReserveDetailImage id="decision-table" className={DETAIL_BAND_BLEED} />
            <ReserveSectionHeader label="What Reserve Learned" />
            <ResponseEventLog />
          </GlassPanel>

          {recent.length > 0 && (
            <GlassPanel noPad phone="flush" className="md:p-5">
              <ReserveSectionHeader label="What Changed, And Why" />
              {/* Hairline-separated rows, not stacked cards: one surface level
                  inside the panel (constitution components.md rule 1). */}
              <div data-testid="optimization-decision-records" className="divide-y divide-white/[0.05]">
                {recent.map((record, index) => (
                  <motion.article
                    key={record.id}
                    initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: shouldReduceMotion ? 0 : Math.min(index, 8) * 0.035 }}
                    className="py-4 first:pt-0"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p
                          className="font-mono text-[9px] uppercase tracking-[0.22em]"
                          style={{ color: alpha(RESERVE.gold, 0.8) }}
                        >
                          {decisionLabel(record)}
                        </p>
                        <p className="mt-1 text-[13px] font-semibold leading-5 text-[#f2eee6]">{record.decision}</p>
                      </div>
                      <time className="tnum shrink-0 font-mono text-[9px] text-white/40">
                        {new Date(record.createdAt).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </time>
                    </div>
                    <p className="mt-3 text-[12px] leading-5 text-white/55">
                      <span className="text-white/35">Observed · </span>
                      {record.observation}
                    </p>
                    <p className="mt-1 text-[12px] leading-5 text-white/55">
                      <span className="text-white/35">Why · </span>
                      {record.reason}
                    </p>
                    <p className="mt-2.5 font-mono text-[8px] uppercase tracking-[0.2em] text-white/40">
                      {[
                        `Initiated by ${record.source.replace("system-migration", "system migration")}`,
                        record.affectedWeekNumbers?.length ? `Week ${record.affectedWeekNumbers.join(", ")}` : null,
                        record.affectedSessionIds?.length
                          ? `${record.affectedSessionIds.length} session${record.affectedSessionIds.length === 1 ? "" : "s"}`
                          : null,
                        record.athleteDecision ? `Athlete · ${record.athleteDecision}` : null,
                        record.activity ? `Activity · ${record.activity.activityId} · ${record.activity.status}` : null,
                      ]
                        .filter(Boolean)
                        .join("  ·  ")}
                    </p>
                  </motion.article>
                ))}
              </div>
            </GlassPanel>
          )}
        </>
      ) : (
        /* An unlocked member never gets a near-empty page: this says exactly
           what writes a record here, as rows rather than an empty box. */
        <GlassPanel noPad phone="flush" className="md:p-5">
          {/* The same band as the history panel: only one of these branches
              renders, so the room still carries exactly one. */}
          <ReserveDetailImage id="decision-table" className={DETAIL_BAND_BLEED} />
          <ReserveSectionHeader label="What Writes A Record Here" accent={RESERVE.gold} />
          <ul className="divide-y divide-white/[0.05]">
            {[
              "Closing a session — Reserve records what it adjusted and why.",
              "Moving, replacing or skipping a planned day, once you confirm it.",
              "Accepting or declining a Response Model recommendation.",
              "Any revision to your Program Horizon, with the original kept beside it.",
            ].map((line) => (
              <li key={line} className="py-2.5 text-[12.5px] leading-[1.55] text-white/60">
                {line}
              </li>
            ))}
          </ul>
          <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.22em] text-white/35">
            Never pre-populated · every entry is a real decision
          </p>
        </GlassPanel>
      )}
    </ViewShell>
  );
}
