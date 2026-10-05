"use client";

import { ArrowRight, Check, CheckCircle2, Timer, Waves } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { recordRecoveryLog } from "@/components/recovery/record-recovery-log";
import { useAthleteDashboardStore } from "@/lib/athlete-store";
import { localDateKey, type MobilityKind } from "@/lib/recovery/types";
import { useProtocolWeek } from "@/lib/hooks/useProtocolWeek";
import { getSplitSystem } from "@/lib/training/split-architect";
import {
  getTodayTrainingWeekDay,
  type TrainingWeekDay,
} from "@/lib/training/weekly-split";

/* ════════════════════════════════════════════════════════════════════════
   MOBILITY COMMAND — Regeneration Suite mobility flow.
   Reads today's session focus (the same canonical week Apex + Training use)
   and sets a short, specific mobility flow with real instruction.
   Training / recovery instruction only — no medical claims, no diagnosis.
   "Mark Complete" logs a real MobilityLog through the store.
   ════════════════════════════════════════════════════════════════════════ */

const GREEN = "#6ee7b7";
const VIOLET = "#a78bfa";

type Routine = {
  region: string;
  minutes: number;
  why: string;
  steps: string[];
  kind: MobilityKind;
};

const FIXED_NOON = new Date(2026, 0, 1, 12, 0, 0);

function routineFor(session: TrainingWeekDay): Routine {
  const t = `${session.sessionName} ${session.focus} ${session.muscles.join(" ")}`.toLowerCase();
  if (session.recovery) {
    return {
      region: "Hips + Breathing",
      minutes: 6,
      kind: "recovery",
      why: "Recovery day — keep tissue supple and downshift the nervous system.",
      steps: [
        "90/90 hip switches · 8 reps each",
        "Couch stretch · 45 sec each side",
        "Diaphragmatic breathing · 2 minutes",
        "Easy walk · 5–10 minutes",
      ],
    };
  }
  if (/(leg|posterior|hamstring|glute|quad|calf|calves)/.test(t)) {
    return {
      region: "Hips + Hamstrings",
      minutes: 8,
      kind: "post-session",
      why: "Posterior-chain work creates hip and hamstring stiffness.",
      steps: [
        "Couch stretch · 60 sec each side",
        "Hamstring floss · 10 reps each",
        "90/90 hip switches · 8 reps each",
        "Calf wall stretch · 45 sec each",
      ],
    };
  }
  if (/(chest|back|pull|push|lat|row|deadlift)/.test(t)) {
    return {
      region: "T-Spine + Lats",
      minutes: 7,
      kind: "post-session",
      why: "Heavy pressing and pulling loads the thoracic spine and lats.",
      steps: [
        "Open-book rotation · 8 reps each side",
        "Lat wall stretch · 45 sec each",
        "Thread-the-needle · 6 reps each",
        "Pec doorway stretch · 45 sec each",
      ],
    };
  }
  if (/(delt|shoulder|arm|bicep|tricep|press)/.test(t)) {
    return {
      region: "Shoulders + Wrists",
      minutes: 6,
      kind: "post-session",
      why: "Overhead and isolation work tightens the shoulders and wrists.",
      steps: [
        "Shoulder CARs · 5 reps each direction",
        "Banded shoulder dislocates · 10 reps",
        "Wrist rockers · 45 seconds",
        "Cross-body delt stretch · 40 sec each",
      ],
    };
  }
  return {
    region: "Full-Body Reset",
    minutes: 7,
    kind: "post-session",
    why: "Today's session loaded multiple patterns — reset the major joints.",
    steps: [
      "Open-book rotation · 8 reps each side",
      "90/90 hip switches · 8 reps each",
      "Cross-body delt stretch · 40 sec each",
      "Calf wall stretch · 45 sec each",
    ],
  };
}

export function MobilityCommand() {
  const activeProtocol = useAthleteDashboardStore((s) => s.activeProtocol);
  const splitSystem = useAthleteDashboardStore((s) => s.splitSystem);
  const mobilityLogs = useAthleteDashboardStore((s) => s.recoveryCommand.mobilityLogs);
  const logMobility = useAthleteDashboardStore((s) => s.logMobility);

  /* Clock — keeps SSR + first client render identical (no mismatch), then a
     setTimeout (not a sync effect setState) resolves to the real day/time so
     "tonight" and today's session are true. Mirrors Apex's clock pattern. */
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const t = setTimeout(() => setNow(new Date()), 0);
    return () => clearTimeout(t);
  }, []);
  const clock = now ?? FIXED_NOON;
  const mounted = now !== null;

  const { week: protocolWeek } = useProtocolWeek(clock);
  const todaySession = useMemo(() => getTodayTrainingWeekDay(protocolWeek), [protocolWeek]);

  const routine = useMemo(() => routineFor(todaySession), [todaySession]);

  const todayKey = localDateKey(clock);
  const loggedToday = mounted && mobilityLogs.some((m) => m.date === todayKey);

  const [started, setStarted] = useState(false);
  const [justLogged, setJustLogged] = useState(false);
  const done = loggedToday || justLogged;

  const evening = mounted && clock.getHours() >= 17;
  const splitName = getSplitSystem(splitSystem.key)?.name ?? activeProtocol?.protocolName ?? null;

  function markComplete() {
    recordRecoveryLog("mobility", () => logMobility({ date: todayKey, kind: routine.kind, minutes: routine.minutes, focus: routine.region }));
    setJustLogged(true);
    setStarted(false);
  }

  return (
    <section
      className="relative overflow-hidden rounded-[22px] border border-white/[0.05] p-5 sm:p-6"
      style={{
        background: `linear-gradient(150deg, ${VIOLET}0c 0%, rgba(255,255,255,0.012) 38%, ${GREEN}08 100%)`,
        boxShadow: "0 0 0 1px rgba(255,255,255,0.022) inset, 0 28px 80px rgba(0,0,0,0.4)",
      }}
    >
      {/* Dusk halo — Regeneration Suite atmosphere */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${VIOLET}55 40%, ${GREEN}44 60%, transparent)` }} />
      <div className="fba-breath-slow pointer-events-none absolute -right-12 -top-10 h-44 w-44 rounded-full blur-3xl" style={{ background: `radial-gradient(circle, ${VIOLET}1c 0%, transparent 70%)` }} />

      <div className="relative">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[8.5px] uppercase tracking-[0.22em]" style={{ borderColor: `${VIOLET}40`, background: `${VIOLET}12`, color: VIOLET }}>
            <Waves size={11} />{evening ? "Tonight's Mobility" : "Today's Mobility"}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[8px] uppercase tracking-[0.16em] text-white/55" style={{ borderColor: "rgba(255,255,255,0.12)" }}>
            <Timer size={10} />{routine.minutes} min
          </span>
          {done && (
            <span className="ml-auto inline-flex items-center gap-1 font-mono text-[8px] uppercase tracking-[0.16em]" style={{ color: GREEN }}>
              <CheckCircle2 size={11} />Logged
            </span>
          )}
        </div>

        {/* The prescription region — the statement of this card */}
        <h3 className="mt-3 text-[clamp(22px,3vw,30px)] font-black uppercase leading-[0.96] tracking-tight text-[#f2eee6]">{routine.region}</h3>
        <p className="mt-2 max-w-md text-[12px] leading-[1.5] text-white/55">
          <span className="font-mono text-[7.5px] uppercase tracking-[0.16em] text-white/30">Why · </span>
          {routine.why}
        </p>
        {splitName && (
          <p className="mt-1 font-mono text-[8px] uppercase tracking-[0.16em] text-white/30">
            From · {todaySession.recovery ? "recovery day" : todaySession.sessionName}
          </p>
        )}

        {/* Ordered movements — real instruction */}
        <ol className="mt-4 space-y-1.5">
          {routine.steps.map((step, i) => (
            <li
              key={step}
              className="flex items-center gap-3 rounded-xl px-3 py-2 transition-colors"
              style={{
                borderColor: done ? `${GREEN}26` : started ? `${VIOLET}30` : "rgba(255,255,255,0.06)",
                background: done ? `${GREEN}08` : started ? `${VIOLET}0a` : "rgba(255,255,255,0.015)",
              }}
            >
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full font-mono text-[8px] font-bold" style={{ background: done ? `${GREEN}1f` : `${VIOLET}1f`, color: done ? GREEN : VIOLET }}>
                {done ? <Check size={11} /> : i + 1}
              </span>
              <span className={`text-[12px] ${done ? "text-white/45 line-through decoration-white/20" : "text-white/75"}`}>{step}</span>
            </li>
          ))}
        </ol>

        {/* Command actions — both do real work */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {done ? (
            <span className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-[12px] font-bold" style={{ borderColor: `${GREEN}45`, background: `${GREEN}12`, color: GREEN }}>
              <CheckCircle2 size={14} />Mobility logged · {routine.minutes} min
            </span>
          ) : !started ? (
            <button
              type="button"
              onClick={() => setStarted(true)}
              className="group inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-[12px] font-bold transition-all duration-200 hover:bg-white/[0.04]"
              style={{ borderColor: `${VIOLET}55`, background: `linear-gradient(120deg, ${VIOLET}1f, ${GREEN}10)`, color: VIOLET }}
            >
              <Waves size={13} />Start Mobility
              <ArrowRight size={13} className="transition-transform duration-200 group-hover:translate-x-0.5" />
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={markComplete}
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[12px] font-bold text-black shadow-[0_8px_24px_-10px_rgba(110,231,183,0.55)] transition-all duration-200 hover:brightness-105"
                style={{ background: `linear-gradient(120deg, ${GREEN}, #8ef0c6)` }}
              >
                <Check size={14} />Mark Complete
              </button>
              <button
                type="button"
                onClick={() => setStarted(false)}
                className="rounded-xl border border-white/[0.1] px-3 py-2.5 font-mono text-[8.5px] uppercase tracking-[0.16em] text-white/45 transition hover:bg-white/[0.04] hover:text-white/70"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
