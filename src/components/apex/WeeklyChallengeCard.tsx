"use client";

import { CheckCircle2, Flame, Target, Trophy } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useAthleteDashboardStore } from "@/lib/athlete-store";
import { challengeForWeek, challengeKey } from "@/lib/retention/weekly-challenge";
import { drinkOfTheWeek } from "@/lib/nutrition/hydration-library";
import { resolveGamePlanWeek } from "@/lib/training/game-plan";
import { computeTrainingStreak } from "@/lib/logging/store";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { ReserveButton } from "@/components/ui/reserve";
import { markDone } from "@/components/ui/reserve/log-moment/recorders";

const GOLD = "#d5b15f";
const GREEN = "#79e3b5";
const STEEL = "#7dd3ee";

const CATEGORY_COLOR: Record<string, string> = {
  training: GOLD,
  recovery: "#a78bfa",
  fuel: GREEN,
  discipline: STEEL,
};

/** Weekly Challenge — one earned target per week, a live streak, and the
    week's drink. The daily reason to open Reserve. */
export function WeeklyChallengeCard({ onOpenNutrition }: { onOpenNutrition?: () => void }) {
  const activeProtocol = useAthleteDashboardStore((s) => s.activeProtocol);
  const onboardingCompletedAt = useAthleteDashboardStore((s) => s.onboarding.completedAt);
  const completedChallengeKeys = useAthleteDashboardStore((s) => s.completedChallengeKeys);
  const toggleChallengeComplete = useAthleteDashboardStore((s) => s.toggleChallengeComplete);

  const week = useMemo(
    () => resolveGamePlanWeek(activeProtocol, onboardingCompletedAt).week,
    [activeProtocol, onboardingCompletedAt],
  );
  const challenge = challengeForWeek(week);
  const key = challengeKey(challenge);
  const done = completedChallengeKeys.includes(key);
  const drink = drinkOfTheWeek(week);
  const accent = CATEGORY_COLOR[challenge.category] ?? GOLD;

  // Streak from real completed-session logs (localStorage) — deferred read so
  // SSR and hydration stay clean.
  const [streak, setStreak] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setStreak(computeTrainingStreak()), 0);
    return () => clearTimeout(t);
  }, []);

  return (
    <GlassPanel accent={accent}>
      <div data-log-row="challenge" className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Target size={13} style={{ color: accent }} />
            <p className="font-mono text-[8.5px] uppercase tracking-[0.26em]" style={{ color: `${accent}cc` }}>
              Weekly Challenge · Week {week}
            </p>
            <span className="rounded-full border px-2 py-0.5 font-mono text-[7px] uppercase tracking-[0.16em]" style={{ borderColor: `${accent}40`, background: `${accent}10`, color: accent }}>
              {challenge.category}
            </span>
          </div>
          <h3 className="mt-2 text-lg font-black uppercase tracking-tight text-[#f2eee6]">{challenge.title}</h3>
          <p className="mt-1.5 max-w-xl text-[12px] leading-[1.6] text-white/50">{challenge.detail}</p>
        </div>

        <div className="flex flex-col items-end gap-2">
          {streak > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#e8c87a]/28 bg-[#e8c87a]/[0.08] px-2.5 py-1 font-mono text-[8px] uppercase tracking-[0.16em] text-[#e8c87a]">
              <Flame size={10} />{streak}-day streak
            </span>
          )}
          {done ? (
            <span className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 font-mono text-[8.5px] uppercase tracking-[0.16em]" style={{ borderColor: `${GREEN}40`, background: `${GREEN}10`, color: GREEN }}>
              <Trophy size={12} />Completed
            </span>
          ) : (
            /* Secondary, never gold-filled: Apex has one gold action, the Next Move (Bible §11). */
            <ReserveButton tier="secondary" size="sm" accent={accent} icon={CheckCircle2} onClick={() => {
              toggleChallengeComplete(key);
              markDone({ key: `challenge:${key}`, label: "Challenge", done: true });
            }}>
              Mark Done
            </ReserveButton>
          )}
        </div>
      </div>

      {/* Drink of the week — fresh idea, one tap away */}
      <button
        type="button"
        onClick={onOpenNutrition}
        className="mt-3 flex w-full flex-wrap items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.015] px-3.5 py-2.5 text-left transition hover:border-white/[0.12]"
      >
        <span className="font-mono text-[7.5px] uppercase tracking-[0.2em]" style={{ color: `${STEEL}b0` }}>Drink of the week</span>
        <span className="text-[12px] font-bold text-[#f2eee6]">{drink.name}</span>
        <span className="min-w-0 flex-1 truncate text-[10.5px] text-white/35">{drink.ingredients.join(" · ")}</span>
        <span className="font-mono text-[7.5px] uppercase tracking-[0.16em] text-white/30">Open Hydration Bar →</span>
      </button>
    </GlassPanel>
  );
}
