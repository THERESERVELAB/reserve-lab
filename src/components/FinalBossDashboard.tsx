"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  Brain,
  ChevronRight,
  Flame,
  FlaskConical,
  Layers,
  Pill,
  User,
  Users,
} from "lucide-react";
import { useState } from "react";

import { useAthleteDashboardStore, type DashboardView } from "@/lib/athlete-store";
import { RESERVE, alpha } from "@/lib/design/tokens";
import { getReserveVoice } from "@/lib/personalization/voice";
import { getSetupGaps, setupProgress } from "@/lib/profile/setup";
import { useActiveProgram } from "@/lib/hooks/useActiveProgram";
import { resolveSystemState } from "@/lib/system-state";
import { getArchitectureForSystem } from "@/lib/training/split-architectures";
import type { BlockingMove } from "@/components/apex/pit-wall/NextMovePanel";
import { ApexErrorBoundary } from "@/components/apex/pit-wall/ApexErrorBoundary";
import { recordDailyCheckIn as recordDailyCheckInMoment } from "@/components/ui/reserve/log-moment/recorders";
import { PitWallView } from "@/components/apex/pit-wall/PitWallView";
import {
  ReserveButton,
  ReserveDisclosure,
  ReservePage,
  ReserveSection,
  ReserveStatusChip,
} from "@/components/ui/reserve";
import { OperatingSystemSetup } from "./onboarding/OperatingSystemSetup";
import { GlassPanel } from "./ui/GlassPanel";

/* ════════════════════════════════════════════════════════════════════════
   DAILY COMMAND — the flagship screen.

   Its one job: the member should open this and feel that Reserve already
   analysed the day.

   Hierarchy is delegated deliberately. Levels 1–5 (condition, the day, the
   one move, the risk) all belong to the Pit Wall, which is the one command
   center. Everything in THIS file is therefore level 6 by definition — it
   supports the day, it does not compete with it.

   What that principle removed in earlier passes, and still holds:

   · The setup prompt shipped five peer actions (Start Setup / Skip / Done /
     one chip per gap). It now has one primary, one quiet dismissal, and the
     gaps as inline links — the count of decisions dropped from 5+ to 2. It
     no longer stacks above the day at all: it replaces the Next Move.

   · The retention strip was three equal-weight GlassPanels ABOVE the
     compliance footer, which is three surfaces competing with the command
     center for the same eye. Streak and Milestones both answer "am I
     consistent?", so they are now one panel, and it sits behind disclosure.

   · The third panel, "12-Week Outlook", rendered three HARD-CODED strings
     ("−4–6% BF at current trajectory", "+12–18 pts with calf focus",
     "+8–14% estimated 1RM gains") as if they were personal projections
     derived from member data. They were not derived from anything. That is
     fabricated provenance (Bible §12) and reads as an outcome promise, so
     the numbers are gone. The route to the real Physique Intelligence
     surface — which computes from actual member state — is kept.
   ════════════════════════════════════════════════════════════════════════ */

/* ─── The blocking move — one decision, never a stacked banner ─────────────
   THE ARBITER. One state reaches the member, chosen by what most blocks
   their day. It replaces the Next Move instead of rendering as a notice above
   the command center, so the screen keeps exactly one gold action.

   `programUnconfirmed` is derived the same way the Apex model derives its
   `requireActiveHorizon`: no resolved Program Horizon and no active protocol.
   Deriving it here keeps the arbiter owned by the page, which is the level
   that can see both states. */
function useBlockingMove(onStartSetup: () => void): BlockingMove | null {
  const setupProfile = useAthleteDashboardStore((s) => s.setupProfile);
  const nutritionPrefs = useAthleteDashboardStore((s) => s.nutritionPrefs);
  const schedulePlan = useAthleteDashboardStore((s) => s.trainingSession.schedulePlan);
  const goal = useAthleteDashboardStore((s) => s.profile.goal);
  const setActiveView = useAthleteDashboardStore((s) => s.setActiveView);
  const activeProtocol = useAthleteDashboardStore((s) => s.activeProtocol);
  const splitSystem = useAthleteDashboardStore((s) => s.splitSystem);
  const activeProgram = useActiveProgram();
  const [dismissed, setDismissed] = useState(false);

  const input = { setupProfile, nutritionPrefs, schedulePlan, goal };
  const gaps = getSetupGaps(input);
  const { total } = setupProgress(input);

  const systemState = resolveSystemState({
    programUnconfirmed:
      !activeProgram.resolution &&
      !activeProtocol &&
      // A member who chose a split has a plan. They are not unconfirmed.
      !(splitSystem.selectedAt && getArchitectureForSystem(splitSystem.key)),
    setupGapCount: gaps.length,
    setupTotal: total,
  });

  if (!systemState || dismissed) return null;

  const isSetup = systemState.id === "setup-incomplete";

  return {
    label: systemState.label,
    headline: systemState.headline,
    actionLabel: systemState.actionLabel,
    onAction: () => {
      if (systemState.actionTarget) setActiveView(systemState.actionTarget);
      else onStartSetup();
    },
    /* Only meaningful for the setup state — the gaps ARE the setup steps.
       Behind disclosure because on a 375px phone an always-visible list of
       five stacked links pushed the day off the first screen, and a setup
       nudge must never out-rank the day. */
    detail: isSetup ? (
      <ReserveDisclosure summary={`Setup steps (${gaps.length})`}>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {gaps.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setActiveView(g.module)}
              className="inline-flex min-h-[44px] items-center gap-1 text-[11px] font-semibold transition-colors hover:brightness-125"
              style={{ color: alpha(RESERVE.gold, 0.85) }}
            >
              {g.label}
              <ChevronRight size={10} aria-hidden="true" />
            </button>
          ))}
        </div>
      </ReserveDisclosure>
    ) : undefined,
    /* Only the non-blocking state is dismissible. A member cannot wave away
       "Reserve cannot plan your week". */
    dismiss: isSetup ? { label: "Not now", onDismiss: () => setDismissed(true) } : undefined,
  };
}

/* ─── Secondary systems ──────────────────────────────────────────────────── */
type SecondaryItem = {
  label: string;
  sub: string;
  view: DashboardView;
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  color: string;
  logOnly?: boolean;
};

const SECONDARY_ITEMS: SecondaryItem[] = [
  { label: "Physique Cockpit", sub: "Symmetry & composition trends", view: "physique-intelligence", icon: User, color: RESERVE.gold },
  { label: "AI Strategist", sub: "Daily intelligence briefing", view: "ai-strategist", icon: Brain, color: RESERVE.violet },
  { label: "Mesocycle Planner", sub: "Block & specialization planning", view: "mesocycle-planner", icon: Layers, color: RESERVE.steel },
  { label: "War Room", sub: "Community channels", view: "community", icon: Users, color: RESERVE.green },
  { label: "Bloodwork Log", sub: "Clinician review", view: "bloodwork", icon: FlaskConical, color: RESERVE.steel, logOnly: true },
  { label: "Compound Log", sub: "Record keeping", view: "supplements", icon: Pill, color: RESERVE.slate, logOnly: true },
];

function SecondarySystems() {
  const setActiveView = useAthleteDashboardStore((s) => s.setActiveView);
  return (
    <ReserveSection label="Secondary Systems">
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {SECONDARY_ITEMS.map((item) => (
          <button
            key={item.view}
            type="button"
            onClick={() => setActiveView(item.view)}
            /* Navigation rows, not cards. A hairline top edge and a hover
               lift carry the affordance — a full border on each of six tiles
               is exactly the wall-of-cards read this section had to lose. */
            className="group relative overflow-hidden rounded-[12px] p-3 text-left transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/[0.04]"
            style={{ background: "rgba(255,255,255,0.018)" }}
          >
            <span
              className="pointer-events-none absolute inset-x-0 top-0 h-px"
              style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.09), transparent)" }}
              aria-hidden="true"
            />
            <div className="flex items-center gap-3">
              <span
                className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px]"
                style={{ background: alpha(item.color, 0.12) }}
                aria-hidden="true"
              >
                <item.icon size={15} style={{ color: item.color }} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-[12.5px] font-bold" style={{ color: RESERVE.ivory }}>
                    {item.label}
                  </p>
                  {item.logOnly && <ReserveStatusChip status="log-only" />}
                </div>
                <p className="mt-0.5 truncate text-[10.5px] text-white/40">{item.sub}</p>
              </div>
              <ChevronRight
                size={14}
                className="shrink-0 text-white/25 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:text-white/55"
                aria-hidden="true"
              />
            </div>
          </button>
        ))}
      </div>
    </ReserveSection>
  );
}

/* ─── Consistency — one panel, behind disclosure ─────────────────────────── */
function Consistency() {
  const engagement = useAthleteDashboardStore((s) => s.engagement);
  const recordDailyCheckIn = useAthleteDashboardStore((s) => s.recordDailyCheckIn);
  const genderIdentity = useAthleteDashboardStore((s) => s.profile.coachingProfile?.genderIdentity);
  const voice = getReserveVoice(genderIdentity);
  const reduce = useReducedMotion();

  const milestonesDone = engagement.completedMilestones.length;

  return (
    <GlassPanel accent={RESERVE.gold}>
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
        {/* Streak — the only jewelry numeral in this region. */}
        <div>
          <div className="flex items-center gap-2">
            <Flame size={12} style={{ color: alpha(RESERVE.red, 0.7) }} aria-hidden="true" />
            <p className="font-mono text-[8px] uppercase tracking-[0.24em] text-white/40">
              {voice.consistencyKicker}
            </p>
          </div>
          <div className="mt-2 flex items-end gap-2.5">
            <strong data-log-readout="check-in" className="tnum text-[46px] font-black leading-none tracking-[-0.03em]" style={{ color: RESERVE.ivory }}>
              {engagement.currentStreak}
            </strong>
            <span className="mb-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-white/35">
              day{engagement.currentStreak === 1 ? "" : "s"} · best {engagement.bestStreak}
            </span>
          </div>
        </div>

        {/* Milestones — supporting, so it never gets a jewel numeral. */}
        <div className="min-w-[160px] flex-1">
          <p className="font-mono text-[8px] uppercase tracking-[0.24em] text-white/40">
            Milestones · {milestonesDone} of 8
          </p>
          <div className="mt-2.5 grid grid-cols-8 gap-1" aria-hidden="true">
            {Array.from({ length: 8 }).map((_, i) => (
              <motion.div
                key={i}
                className="h-1 rounded-full"
                style={{ background: i < milestonesDone ? RESERVE.gold : "rgba(255,255,255,0.07)" }}
                initial={reduce ? false : { scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: reduce ? 0 : 0.4, delay: reduce ? 0 : i * 0.04 }}
              />
            ))}
          </div>
        </div>

        {/* This marks today in the streak and milestones only. It records no
            recovery data, and no recovery check-in writes the streak, so the
            label says what the button does rather than promising a check-in. */}
        <ReserveButton
          tier="secondary"
          size="sm"
          onClick={() => recordDailyCheckInMoment(() => recordDailyCheckIn())}
        >
          Mark Today as Checked In
        </ReserveButton>
      </div>
    </GlassPanel>
  );
}

/* ─── Screen ─────────────────────────────────────────────────────────────── */
export function FinalBossDashboard() {
  const [setupOpen, setSetupOpen] = useState(false);
  const blocking = useBlockingMove(() => setSetupOpen(true));

  return (
    <ReservePage>
      {setupOpen && <OperatingSystemSetup onClose={() => setSetupOpen(false)} />}

      {/* Levels 1–5 all live here: condition, the day, the one move, risk. */}
      <ApexErrorBoundary>
        <PitWallView blocking={blocking} />
      </ApexErrorBoundary>

      <SecondarySystems />

      {/* Level 6. Consistency matters, but it is never the reason a member
          opened the app today — so it opens on request. */}
      <ReserveDisclosure summary="Consistency & Milestones">
        <Consistency />
      </ReserveDisclosure>

      <footer className="pt-1">
        <p className="text-[9.5px] leading-5 text-white/28">
          THE RESERVE METHOD records observations and trends only. It does not prescribe,
          diagnose, plan cycles, recommend protocols, or suggest dosages.
        </p>
      </footer>
    </ReservePage>
  );
}
