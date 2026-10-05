"use client";

import { motion } from "framer-motion";
import { CheckCircle2, CupSoda, Star } from "lucide-react";
import { useMemo, useState } from "react";

import { localDateKey } from "@/lib/recovery/types";

import { useAthleteDashboardStore } from "@/lib/athlete-store";
import {
  activeDrinkContexts,
  drinkOfTheWeek,
  suggestDrinks,
  HYDRATION_LIBRARY,
  type HydrationDrink,
} from "@/lib/nutrition/hydration-library";
import { resolveGamePlanWeek } from "@/lib/training/game-plan";
import { useTodayTrainingDay } from "@/lib/training/useTodayTrainingDay";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { markDrinkLogged } from "@/components/ui/reserve/log-moment/recorders";

const GOLD = "#d5b15f";
const STEEL = "#7dd3ee";
const GREEN = "#79e3b5";

function DrinkRow({
  drink,
  favorite,
  loggedToday,
  onToggleFavorite,
  onLog,
  highlight = false,
}: {
  drink: HydrationDrink;
  favorite: boolean;
  loggedToday: boolean;
  onToggleFavorite: () => void;
  onLog: () => void;
  highlight?: boolean;
}) {
  return (
    <div
      className={`flex flex-wrap items-center gap-2 py-2.5 ${highlight ? "border-l pl-3" : ""}`}
      style={highlight ? { borderColor: `${GOLD}66` } : undefined}
    >
      <button type="button" onClick={onToggleFavorite} className="flex-shrink-0" aria-label={favorite ? "Unfavorite" : "Favorite"}>
        <Star size={14} style={{ color: favorite ? GOLD : "rgba(255,255,255,0.2)", fill: favorite ? GOLD : "none" }} />
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-bold text-[#f2eee6]">{drink.name}</p>
        <p className="mt-0.5 truncate text-[10.5px] text-white/40">{drink.ingredients.join(" · ")}</p>
        <p className="mt-0.5 font-mono text-[7.5px] uppercase tracking-[0.14em] text-white/28">
          {drink.est ? `est. ${drink.est.calories} kcal · ${drink.est.proteinG}g protein` : "≈ zero calories"} · {drink.prepMinutes} min
        </p>
      </div>
      {loggedToday ? (
        <span className="inline-flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.16em]" style={{ color: GREEN }}>
          <CheckCircle2 size={12} />Logged
        </span>
      ) : (
        <motion.button
          type="button"
          whileTap={{ scale: 0.96 }}
          onClick={onLog}
          className="rounded-xl border px-3 py-1.5 font-mono text-[8px] uppercase tracking-[0.16em]"
          style={{ borderColor: `${STEEL}38`, background: `${STEEL}0e`, color: STEEL }}
        >
          Log Drink
        </motion.button>
      )}
    </div>
  );
}

/** Hydration Bar — rotating performance-drink and refresh ideas tied to the
    member's day. General wellness support only; estimates, never claims. */
export function HydrationBarPanel() {
  const favorites = useAthleteDashboardStore((s) => s.hydrationFavorites);
  const logs = useAthleteDashboardStore((s) => s.hydrationDrinkLogs);
  const toggleFavorite = useAthleteDashboardStore((s) => s.toggleHydrationFavorite);
  const logDrink = useAthleteDashboardStore((s) => s.logHydrationDrink);
  const activeProtocol = useAthleteDashboardStore((s) => s.activeProtocol);
  const onboardingCompletedAt = useAthleteDashboardStore((s) => s.onboarding.completedAt);

  const [showAll, setShowAll] = useState(false);
  const weekNumber = useMemo(
    () => resolveGamePlanWeek(activeProtocol, onboardingCompletedAt).week,
    [activeProtocol, onboardingCompletedAt],
  );
  /* Today's real day from the shared resolver — a moved, skipped or member-edited
     day reads the same here as on Training, Apex and the rest of Nutrition. */
  const { trainingPlanned: isTrainingDay } = useTodayTrainingDay();

  const todayISO = localDateKey(new Date());
  const loggedTodayIds = useMemo(() => new Set(logs.filter((l) => l.date === todayISO).map((l) => l.drinkId)), [logs, todayISO]);

  const featured = drinkOfTheWeek(weekNumber);
  const suggestions = useMemo(() => {
    const ctx = activeDrinkContexts({ isTrainingDay, hour: new Date().getHours() });
    return suggestDrinks(ctx, 3).filter((d) => d.id !== featured.id);
  }, [isTrainingDay, featured.id]);

  const list = showAll ? HYDRATION_LIBRARY.filter((d) => d.id !== featured.id) : suggestions;

  function handleLog(drink: HydrationDrink) {
    logDrink({ date: todayISO, drinkId: drink.id, name: drink.name, loggedAt: new Date().toISOString() });
    markDrinkLogged(drink.name);
  }

  return (
    <GlassPanel accent={STEEL}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <CupSoda size={13} style={{ color: STEEL }} />
            <p className="font-mono text-[9px] uppercase tracking-[0.26em]" style={{ color: `${STEEL}cc` }}>Hydration Bar</p>
          </div>
          <p className="mt-1.5 max-w-xl text-[11.5px] leading-[1.55] text-white/45">
            Something new to drink every week — hydration, refreshers, and light fuel matched to your day.
            General wellness support; macros are estimates.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="rounded-xl border border-white/[0.1] bg-white/[0.03] px-3 py-1.5 font-mono text-[8px] uppercase tracking-[0.16em] text-white/45 transition hover:text-white/75"
        >
          {showAll ? "Show Suggestions" : "Browse All"}
        </button>
      </div>

      {/* Drink of the week */}
      <div className="mt-4">
        <p className="mb-1.5 font-mono text-[7.5px] uppercase tracking-[0.24em]" style={{ color: `${GOLD}b0` }}>Drink of the Week · {featured.why}</p>
        <DrinkRow
          drink={featured}
          favorite={favorites.includes(featured.id)}
          loggedToday={loggedTodayIds.has(featured.id)}
          onToggleFavorite={() => toggleFavorite(featured.id)}
          onLog={() => handleLog(featured)}
          highlight
        />
      </div>

      <div className="mt-3 divide-y divide-white/[0.05]">
        {list.map((drink) => (
          <DrinkRow
            key={drink.id}
            drink={drink}
            favorite={favorites.includes(drink.id)}
            loggedToday={loggedTodayIds.has(drink.id)}
            onToggleFavorite={() => toggleFavorite(drink.id)}
            onLog={() => handleLog(drink)}
          />
        ))}
      </div>
    </GlassPanel>
  );
}
