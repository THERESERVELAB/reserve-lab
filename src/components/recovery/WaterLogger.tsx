"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Undo2 } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { useRecoveryClock } from "@/components/recovery/useRecoveryClock";

import { recordRecoveryLog } from "@/components/recovery/record-recovery-log";
import { ReserveButton } from "@/components/ui/reserve";
import { useAthleteDashboardStore } from "@/lib/athlete-store";
import { RESERVE, alpha } from "@/lib/design/tokens";
import { localDateKey } from "@/lib/recovery/types";
import { DEFAULT_POUR_OZ, POUR_SIZES, milestoneCrossed, ozOn, remainingLine, waterStreak } from "@/lib/recovery/water";
import { useAmbientMotion } from "@/lib/ui/use-ambient-motion";

const WATER = "#5fb7d5";
const FULL = "#6ee7b7";

/**
 * WATER, POURED — a bottle that fills as the member logs, one-tap pour sizes,
 * the next milestone, their run of days at their own target, and an undo for
 * a mistaken pour. The fill moves in full motion and simply sits at its level
 * in reduced or static mode.
 */
export function WaterLogger({ onEditTargets }: { onEditTargets: () => void }) {
  const logs = useAthleteDashboardStore((s) => s.recoveryCommand.hydrationLogs);
  const target = useAthleteDashboardStore((s) => s.recoveryCommand.hydrationTargetOz);
  const pour = useAthleteDashboardStore((s) => s.recoveryCommand.waterPourOz ?? DEFAULT_POUR_OZ);
  const logHydration = useAthleteDashboardStore((s) => s.logHydration);
  const undoLastHydration = useAthleteDashboardStore((s) => s.undoLastHydration);
  const setWaterPour = useAthleteDashboardStore((s) => s.setWaterPour);
  const animate = useAmbientMotion() === "full";

  /* The screen's own day: read after mount so server and client markup match. */
  const now = useRecoveryClock();
  const today = now ? localDateKey(now) : null;
  const todayOz = today ? ozOn(logs, today) : 0;
  const pct = target > 0 ? Math.min(1, todayOz / target) : 0;
  const hit = target > 0 && todayOz >= target;
  const streak = today ? waterStreak(logs, target, today) : 0;

  const [splash, setSplash] = useState<{ id: number; oz: number; milestone: string | null } | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const timer = useRef<number | null>(null);
  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  const pourNow = () => {
    const day = localDateKey();
    const before = ozOn(useAthleteDashboardStore.getState().recoveryCommand.hydrationLogs, day);
    recordRecoveryLog("water", () => logHydration({ date: day, oz: pour }));
    setSplash({ id: Date.now(), oz: pour, milestone: milestoneCrossed(before, before + pour, target) });
    setCanUndo(true);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setSplash(null);
      setCanUndo(false);
    }, 6000);
  };

  const undo = () => {
    undoLastHydration(localDateKey());
    setSplash(null);
    setCanUndo(false);
  };

  const color = hit ? FULL : WATER;

  return (
    <div className="flex items-center gap-4" data-water-logger>
      <Bottle pct={pct} color={color} animate={animate} />

      <div className="min-w-0 flex-1">
        <div className="relative inline-block">
          <p data-log-readout="water" className="text-2xl font-black leading-none" style={{ color }}>
            {todayOz}
            <span className="text-sm text-white/40"> / {target} oz</span>
          </p>
          <AnimatePresence>
            {splash && (
              <motion.span
                key={splash.id}
                aria-hidden="true"
                className="pointer-events-none absolute left-full top-0 ml-2 whitespace-nowrap text-[13px] font-black"
                style={{ color }}
                initial={animate ? { y: 0, opacity: 1 } : { opacity: 1 }}
                animate={animate ? { y: -22, opacity: 0 } : { opacity: 0 }}
                transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
              >
                +{splash.oz} oz
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        <p className="mt-1 text-[12px] font-semibold" style={{ color: hit ? FULL : RESERVE.ivory }} role="status" aria-live="polite" data-water-status>
          {splash?.milestone ?? remainingLine(todayOz, target)}
        </p>
        <p className="mt-0.5 text-[11px] text-white/45">
          {streak > 1 ? `${streak} days in a row at your target` : streak === 1 ? "At your target today" : "Your target, your number"}
          {" · "}
          <button type="button" onClick={onEditTargets} className="underline decoration-white/25 underline-offset-2 hover:text-white/70">
            Edit target
          </button>
        </p>

        <div className="mt-2.5 flex flex-wrap gap-1.5" role="group" aria-label="Pour size">
          {POUR_SIZES.map((oz) => {
            const on = oz === pour;
            return (
              <button
                key={oz}
                type="button"
                aria-pressed={on}
                onClick={() => setWaterPour(oz)}
                className="min-h-[32px] rounded-full px-2.5 text-[11.5px] transition"
                style={{ background: on ? alpha(WATER, 0.16) : "rgba(255,255,255,0.03)", boxShadow: `inset 0 0 0 1px ${on ? alpha(WATER, 0.5) : "rgba(255,255,255,0.08)"}`, color: on ? RESERVE.ivory : "rgba(255,255,255,0.6)" }}
              >
                {oz} oz
              </button>
            );
          })}
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <motion.button
            type="button"
            whileTap={animate ? { scale: 0.95 } : undefined}
            onClick={pourNow}
            className="min-h-[44px] rounded-xl border px-4 font-mono text-[10px] uppercase tracking-[0.16em]"
            style={{ borderColor: alpha(WATER, 0.45), background: alpha(WATER, 0.1), color: WATER }}
          >
            + Log {pour} oz
          </motion.button>
          {canUndo && (
            <ReserveButton tier="quiet" size="sm" icon={Undo2} onClick={undo}>
              Undo
            </ReserveButton>
          )}
        </div>
      </div>
    </div>
  );
}

/** The bottle: fills to today's share of the target, with a surface that moves in full motion. */
function Bottle({ pct, color, animate }: { pct: number; color: string; animate: boolean }) {
  const clip = useId().replace(/:/g, "");
  const H = 112;
  const top = 18;
  const inner = H - top - 4;
  const level = top + inner * (1 - pct);
  return (
    <svg width="56" height={H} viewBox={`0 0 56 ${H}`} aria-hidden="true" className="shrink-0">
      <defs>
        <clipPath id={`bottle-${clip}`}>
          <path d={`M20 4 h16 v10 q10 4 12 14 v76 q0 6 -6 6 h-28 q-6 0 -6 -6 v-76 q2 -10 12 -14 z`} />
        </clipPath>
      </defs>
      <g clipPath={`url(#bottle-${clip})`}>
        <rect x="0" y="0" width="56" height={H} fill="rgba(255,255,255,0.03)" />
        <motion.g initial={false} animate={{ y: level }} transition={animate ? { type: "spring", stiffness: 70, damping: 14 } : { duration: 0 }}>
          <motion.path
            d="M-56 6 q7 -6 14 0 t14 0 t14 0 t14 0 t14 0 t14 0 t14 0 t14 0 v120 h-112 z"
            fill={alpha(color, 0.55)}
            animate={animate ? { x: [0, 28] } : { x: 0 }}
            transition={animate ? { duration: 2.4, repeat: Infinity, ease: "linear" } : undefined}
          />
          <rect x="0" y="8" width="56" height={H} fill={alpha(color, 0.35)} />
        </motion.g>
        {[0.25, 0.5, 0.75].map((m) => (
          <line key={m} x1="42" x2="48" y1={top + inner * (1 - m)} y2={top + inner * (1 - m)} stroke="rgba(255,255,255,0.22)" strokeWidth="1" />
        ))}
      </g>
      <path d={`M20 4 h16 v10 q10 4 12 14 v76 q0 6 -6 6 h-28 q-6 0 -6 -6 v-76 q2 -10 12 -14 z`} fill="none" stroke={alpha(color, 0.6)} strokeWidth="1.5" />
    </svg>
  );
}
