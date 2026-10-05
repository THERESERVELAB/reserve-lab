"use client";

import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  Clock,
  Dumbbell,
  Moon,
  Sparkles,
  Sunrise,
  Utensils,
  Waves,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { GlassPanel } from "@/components/ui/GlassPanel";
import { ReserveButton } from "@/components/ui/reserve";
import { useAthleteDashboardStore } from "@/lib/athlete-store";
import {
  buildTodaySchedule,
  detectSleepConflict,
  getScheduleNextAction,
  localScheduleDateKey,
  nextUpcomingIndex,
  resolveTrainingScheduleContext,
  type ScheduleItem,
  type ScheduleKind,
} from "@/lib/schedule/engine";
import type { DashboardView } from "@/lib/athlete-store";

const C = {
  GOLD: "#d5b15f",
  GREEN: "#6ee7b7",
  STEEL: "#5fb7d5",
  VIOLET: "#a78bfa",
  AMBER: "#e8c87a",
  RED: "#ef7d55",
  SLATE: "#8ea0b8",
  IVORY: "#f2eee6",
};

const KIND_META: Record<ScheduleKind, { color: string; icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }> }> = {
  wake: { color: C.AMBER, icon: Sunrise },
  meal: { color: C.GOLD, icon: Utensils },
  prep: { color: C.STEEL, icon: Waves },
  training: { color: C.GOLD, icon: Dumbbell },
  recovery: { color: C.GREEN, icon: Sparkles },
  sleep: { color: C.VIOLET, icon: Moon },
  activity: { color: C.SLATE, icon: Clock },
};

/**
 * Today's Schedule — reusable across Apex/Dashboard, Recovery, etc.
 * `variant="compact"` trims the timeline for tighter surfaces.
 */
export function TodaysScheduleCard({ compact = false }: { compact?: boolean }) {
  const profile = useAthleteDashboardStore((s) => s.scheduleProfile);
  const trainingOverrides = useAthleteDashboardStore((s) => s.trainingOverrides);
  const setActiveView = useAthleteDashboardStore((s) => s.setActiveView);

  // Re-evaluate "now" on mount + every minute so the highlight/next-action stay live.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setNow(new Date()));
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => {
      cancelAnimationFrame(frame);
      clearInterval(id);
    };
  }, []);
  const safeNow = now ?? new Date(0);

  const trainingContext = useMemo(
    () => now ? resolveTrainingScheduleContext(trainingOverrides, localScheduleDateKey(now)) : undefined,
    [trainingOverrides, now],
  );
  const items = useMemo(() => buildTodaySchedule(profile, trainingContext), [profile, trainingContext]);
  const conflict = useMemo(() => detectSleepConflict(profile, trainingContext), [profile, trainingContext]);
  const nextAction = useMemo(
    () => now ? getScheduleNextAction(profile, now, trainingContext) : null,
    [profile, now, trainingContext],
  );
  const upcomingIdx = now ? nextUpcomingIndex(items, safeNow) : -1;

  const cur = now ? safeNow.getHours() * 60 + safeNow.getMinutes() : -1;
  const nextItem = upcomingIdx >= 0 ? items[upcomingIdx] : null;
  const minsToNext = nextItem && cur >= 0 ? nextItem.minutes - cur : null;
  const gapLabel = minsToNext != null && minsToNext > 0
    ? minsToNext < 60 ? `${minsToNext}m` : `${Math.floor(minsToNext / 60)}h ${minsToNext % 60}m`
    : null;

  const shown: ScheduleItem[] = compact && upcomingIdx >= 0 ? items.slice(Math.max(0, upcomingIdx - 1), upcomingIdx + 3) : items;

  return (
    <GlassPanel accent={C.GOLD} noPad className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-3">
        <div className="flex items-center gap-2">
          <Clock size={13} style={{ color: C.GOLD }} />
          <p className="font-mono text-[9px] uppercase tracking-[0.26em]" style={{ color: C.GOLD }}>Mission Timeline</p>
        </div>
        {now ? (
          <span className="inline-flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.16em] text-white/40">
            <span className="fba-pulse h-1.5 w-1.5 rounded-full bg-emerald-400" />
            {nextAction ? `Now · next in ${gapLabel ?? "—"}` : `${profile.trainingDaysPerWeek}x / week`}
          </span>
        ) : (
          <span className="font-mono text-[8px] uppercase tracking-[0.16em] text-white/35">{profile.trainingDaysPerWeek}x / week · {profile.trainingWindow}</span>
        )}
      </div>

      {/* Next best action (time-aware) */}
      {nextAction && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] bg-white/[0.015] px-5 py-3">
          <div className="min-w-0">
            <p className="font-mono text-[8px] uppercase tracking-[0.2em]" style={{ color: C.GOLD }}>Next Move · {nextAction.windowLabel}</p>
            <p className="mt-0.5 text-[13px] font-bold" style={{ color: C.IVORY }}>{nextAction.label}</p>
            <p className="mt-0.5 text-[10.5px] leading-[1.4] text-white/45">{nextAction.reason}</p>
          </div>
          {nextAction.target && (
            /* Secondary, not gold. This card renders inside Training, whose one
               gold action is the room hero's Start Session (Bible §11: the gold
               CTA is scarce, one per screen). A second filled-gold control here
               made the screen offer two equal "do this now" moves. */
            <ReserveButton
              tier="secondary"
              size="sm"
              iconAfter={ArrowRight}
              onClick={() => setActiveView(nextAction.target as DashboardView)}
            >
              Go
            </ReserveButton>
          )}
        </div>
      )}

      {/* Sleep conflict banner */}
      {conflict.conflict && (
        <div className="flex items-start gap-2.5 border-b border-white/[0.06] px-5 py-2.5" style={{ background: `${C.AMBER}0c` }}>
          <AlertTriangle size={13} className="mt-0.5 shrink-0" style={{ color: C.AMBER }} />
          <div>
            <p className="font-mono text-[8px] uppercase tracking-[0.2em]" style={{ color: C.AMBER }}>Schedule Conflict</p>
            <p className="mt-0.5 text-[10.5px] leading-[1.45] text-white/55">{conflict.message}</p>
          </div>
        </div>
      )}

      {/* Timeline */}
      <ul className="divide-y divide-white/[0.04]">
        {shown.map((it, i) => {
          const meta = KIND_META[it.kind];
          const Icon = meta.icon;
          const isNext = now !== null && items[upcomingIdx]?.minutes === it.minutes && upcomingIdx >= 0;
          const isPast = cur >= 0 && !isNext && it.minutes <= cur;
          return (
            <motion.li
              key={`${it.time}-${it.label}`}
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.28, delay: Math.min(i * 0.03, 0.2) }}
              className="flex items-center gap-3 px-5 py-2.5"
              style={isNext ? { background: `${C.GOLD}0e` } : undefined}
            >
              <span className="w-[68px] shrink-0 font-mono text-[10px] tabular-nums" style={{ color: isNext ? C.GOLD : isPast ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.5)" }}>{it.timeLabel}</span>
              {/* Honesty: a time that has passed is not a block that was done. Nothing here
                  reads a log, so a passed item says "Passed", never "Done" with a check. */}
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg" style={{ borderColor: `${meta.color}${isPast ? "18" : "30"}`, background: `${meta.color}${isPast ? "08" : "12"}`, color: meta.color, opacity: isPast ? 0.6 : 1 }}>
                <Icon size={13} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-semibold" style={{ color: isNext ? C.IVORY : isPast ? "rgba(242,238,230,0.45)" : "rgba(242,238,230,0.82)" }}>{it.label}</p>
                {it.sub && <p className="text-[9.5px] leading-[1.3] text-white/38">{it.sub}</p>}
              </div>
              {isNext && <span className="shrink-0 rounded-full border px-2 py-0.5 font-mono text-[7px] uppercase tracking-[0.18em]" style={{ borderColor: `${C.GOLD}45`, color: C.GOLD }}>Next</span>}
              {isPast && <span className="shrink-0 font-mono text-[7px] uppercase tracking-[0.18em] text-white/40">Passed</span>}
            </motion.li>
          );
        })}
      </ul>
    </GlassPanel>
  );
}
