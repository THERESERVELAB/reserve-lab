"use client";

import { AnimatePresence } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { FuelHorizonStrip } from "@/components/nutrition/FuelHorizonStrip";
import { focusNutritionFuelLog } from "@/components/nutrition/fuel-log-anchor";
import { momentMeals, recordMealChange } from "@/components/nutrition/meal-moment/meal-moment-store";
import { MacroDials } from "@/components/nutrition/MacroDials";
import { recordRecoveryLog } from "@/components/recovery/record-recovery-log";
import { RECOVERY_REFERENCE_CLOCK, useRecoveryClock } from "@/components/recovery/useRecoveryClock";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { ReserveButton } from "@/components/ui/reserve";
import { MealConfirmationDrawer } from "@/components/views/nutrition/MealConfirmationDrawer";
import { useAthleteDashboardStore } from "@/lib/athlete-store";
import { RESERVE, alpha } from "@/lib/design/tokens";
import { useActiveProgram } from "@/lib/hooks/useActiveProgram";
import { goalKeyFromString } from "@/lib/nutrition/adapter";
import { buildFuelHorizon, fuelDayClock, type FuelHorizonAction } from "@/lib/nutrition/fuel-horizon";
import { FUEL_REFERENCE_BODYWEIGHT_LB } from "@/lib/nutrition/fuel-plan";
import { fuelPlanForConfirmation, fuelSourceLine, macroDials, waterRead } from "@/lib/nutrition/nutrition-room";
import { resolveNutritionPrimaryAction, type NutritionPrimaryAction } from "@/lib/nutrition/primary-action";
import type { DietStyleKey } from "@/lib/nutrition/types";
import { useNutritionAlignment } from "@/lib/nutrition/useNutritionAlignment";
import { useTodayFuelPlan } from "@/lib/nutrition/useTodayFuelPlan";
import { buildRecoverySnapshot } from "@/lib/recovery/engine";
import { formatTime12, localScheduleDateKey, minutesToTime } from "@/lib/schedule/engine";
import { localDateKey } from "@/lib/dates/local-day";

/* ════════════════════════════════════════════════════════════════════════
   NUTRITION ROOM HERO — the first screen of Nutrition (Bible §11 layers 1–3).

   The statement is the next move itself: the meal that is due and when, from
   the member's own plan. Then the one gold action, the two honest reads and
   the few lines that set today's targets, then today's fuel horizon toward
   sleep lock. Everything inside the first screen at 1440×1000 and 390×844.

     - Protein, carbs, fat and calories are the fuel plan's estimates for the
       meals the member logged ("est."), against today's targets, each with
       what is left said plainly; water is the member's own log. Nothing
       logged shows the targets, never zeros painted as progress.
     - The gold action never logs a meal by itself: it opens the existing meal
       confirmation, where nothing counts until the member confirms. A water
       log prints its amount in its label.
     - Nutrition Alignment, the old second headline and the horizon fuel-demand
       panel are folded into the target lines: calories, the day, what set the
       targets, and the one alignment warning that matters.

   The light is painted, not animated. The strip moves only with the minute clock.
   ════════════════════════════════════════════════════════════════════════ */

/** Log dates match the recovery engine's own date key. Called from handlers only, never during render. */
function todayISO(): string {
  return localDateKey();
}

export function NutritionRoomHero() {
  const scheduleProfile = useAthleteDashboardStore((s) => s.scheduleProfile);
  const profileGoal = useAthleteDashboardStore((s) => s.profile.goal);
  const prefs = useAthleteDashboardStore((s) => s.nutritionPrefs);
  const recoveryCommand = useAthleteDashboardStore((s) => s.recoveryCommand);
  const sessionMode = useAthleteDashboardStore((s) => s.trainingSession.sessionMode);
  const logHydration = useAthleteDashboardStore((s) => s.logHydration);
  const confirmMealLog = useAthleteDashboardStore((s) => s.confirmMealLog);
  const undoLastMealLog = useAthleteDashboardStore((s) => s.undoLastMealLog);
  const toggleLoggedMeal = useAthleteDashboardStore((s) => s.toggleLoggedMeal);
  const setActiveView = useAthleteDashboardStore((s) => s.setActiveView);

  /* ONE clock. Server and first client render read the fixed reference, so the
     markup matches; the real clock arrives after mount and ticks per minute. */
  const now = useRecoveryClock();
  const clock = now ?? RECOVERY_REFERENCE_CLOCK;

  const { dailyPlan, trainingPlanned, today, trainingContext, activeMealPlan } = useTodayFuelPlan(clock);
  const alignment = useNutritionAlignment();
  const { resolution } = useActiveProgram();
  const source = fuelSourceLine({
    horizon: resolution
      ? {
          weekNumber: resolution.currentWeekNumber,
          phaseName: resolution.currentPhaseName,
          demandClass: resolution.dayNutritionDemand.demandClass,
        }
      : null,
    protocolName: alignment.protocolName,
    memberPlanName: activeMealPlan?.name ?? null,
  });
  const alignmentWarning = alignment.resolution.conflictWarnings.find((w) => w.severity === "warning")?.message ?? null;

  const loggedMealIds = prefs.loggedMealIds;
  const hydration = useMemo(() => {
    const snapshot = buildRecoverySnapshot(recoveryCommand, clock);
    return { todayOz: snapshot.hydrationTodayOz, targetOz: snapshot.hydrationTargetOz };
  }, [recoveryCommand, clock]);

  const horizon = useMemo(
    () =>
      now
        ? buildFuelHorizon({
            now,
            schedule: scheduleProfile,
            trainingPlanned,
            sessionLabel: today.sessionName,
            sessionMode,
            meals: dailyPlan.meals,
            loggedMealIds,
          })
        : null,
    [now, scheduleProfile, trainingPlanned, today.sessionName, sessionMode, dailyPlan.meals, loggedMealIds],
  );

  const plan = resolveNutritionPrimaryAction({ now: clock, schedule: scheduleProfile, meals: dailyPlan.meals, loggedMealIds, hydration });

  const day = fuelDayClock(clock, scheduleProfile);
  const sleepLockLabel = formatTime12(minutesToTime(day.sleepMin));

  const macros = macroDials({ meals: dailyPlan.meals, loggedMealIds, targets: dailyPlan.targets });
  const water = waterRead(hydration);

  /* Every meal log or clear here lands as the room's meal moment. */
  const recordMeal = (write: () => void) =>
    recordMealChange({ meals: momentMeals(dailyPlan.meals), proteinTargetG: dailyPlan.targets.proteinG, write });

  /* ── The existing meal confirmation, fed today's fuel plan ── */
  const [confirmMealId, setConfirmMealId] = useState<string | null>(null);
  const closeConfirm = useCallback(() => setConfirmMealId(null), [setConfirmMealId]);
  const confirmPlan = useMemo(
    () =>
      fuelPlanForConfirmation({
        plan: dailyPlan,
        loggedMealIds,
        dietStyle: prefs.dietStyle as DietStyleKey,
        date: localScheduleDateKey(clock),
      }),
    [dailyPlan, loggedMealIds, prefs.dietStyle, clock],
  );
  const confirmTarget = confirmMealId ? (confirmPlan.meals.find((meal) => meal.id === confirmMealId) ?? null) : null;

  function runPrimary(action: NutritionPrimaryAction) {
    switch (action.kind) {
      case "open-meal-log":
        setConfirmMealId(action.mealId);
        break;
      case "log-water":
        recordRecoveryLog("water", () => logHydration({ date: todayISO(), oz: action.oz }));
        break;
      case "review-fuel-log":
        focusNutritionFuelLog();
        break;
      case "open-schedule":
        setActiveView("schedule-command");
        break;
    }
  }

  function runHorizonAction(action: FuelHorizonAction) {
    switch (action.kind) {
      case "open-meal-log":
        setConfirmMealId(action.mealId);
        break;
      case "undo-meal-log":
        if (!loggedMealIds.includes(action.mealId)) break;
        if (prefs.latestMealLog?.mealId === action.mealId) recordMeal(() => undoLastMealLog());
        else recordMeal(() => toggleLoggedMeal(action.mealId));
        break;
      case "open-view":
        setActiveView(action.view);
        break;
    }
  }

  const leadsSomewhere = plan.primary.kind === "open-meal-log" || plan.primary.kind === "review-fuel-log" || plan.primary.kind === "open-schedule";

  return (
    /* Phones: a flush section inside the page gutter, not a card (components.md rule 1). */
    <GlassPanel accent={RESERVE.green} noPad phone="flush" className="md:overflow-hidden">
      <section aria-label="Today's fuel" data-nutrition="hero" className="relative pb-5 pt-4 md:p-6 lg:px-8 lg:py-6">
        {/* Bible §09: Nutrition is a warm hearth, green and gold, painted still. On phones the
            light reaches the screen edge and feathers out downward, never cut by a box. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-x-3 inset-y-0 max-md:[mask-image:linear-gradient(180deg,#000_55%,transparent)] md:inset-x-0"
          style={{
            background: `radial-gradient(110% 90% at 0% 0%, ${alpha(RESERVE.amber, 0.08)}, transparent 55%), radial-gradient(80% 70% at 100% 100%, ${alpha(RESERVE.green, 0.06)}, transparent 60%)`,
          }}
        />

        <div className="relative grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)] lg:items-end lg:gap-12">
          <div className="min-w-0">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/60">
              Fuel status · {trainingPlanned ? `Training day · ${today.sessionName}` : "Recovery day"}
            </p>
            {/* The statement is the next move: the meal that is due and when. */}
            <h2
              data-room-statement
              data-nutrition="action-title"
              className="mt-2.5 font-display text-[26px] font-black uppercase leading-[0.98] tracking-[-0.02em] text-[#f2eee6] [hyphens:none] [text-wrap:balance] sm:text-[32px] lg:text-[38px]"
            >
              {plan.title}
            </h2>
            <p className="mt-3 max-w-[58ch] text-[13px] leading-[1.55] text-white/70">{plan.reason}</p>
            <div className="mt-4 flex flex-wrap items-center gap-2.5">
              {/* The screen's one gold action (Bible §11). */}
              <div data-nutrition="primary-action" className="min-w-0 max-sm:w-full">
                <ReserveButton
                  tier="primary"
                  size="md"
                  fullWidth
                  iconAfter={leadsSomewhere ? ArrowRight : undefined}
                  onClick={() => runPrimary(plan.primary)}
                >
                  {plan.primary.label}
                </ReserveButton>
              </div>
              {plan.secondary && (
                <ReserveButton tier="secondary" size="md" accent={RESERVE.green} onClick={() => runPrimary(plan.secondary!)}>
                  {plan.secondary.label}
                </ReserveButton>
              )}
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-4">
            {/* Today's four macros against today's targets (est.). The meal moment lands on the protein dial. */}
            {macros ? (
              <MacroDials model={macros} />
            ) : (
              <p data-nutrition="protein" className="text-[12.5px] leading-[1.4] text-white/70">Evidence needed · no meal windows set</p>
            )}
            <ul data-nutrition="fuel-context" className="space-y-1.5 border-t border-white/[0.07] pt-3 text-[12px] leading-snug text-white/65">
              <li data-nutrition="water">
                {water ? (
                  <>
                    Water <span className="tnum text-[#f2eee6]">{water.value}</span> {water.unit} · {water.detail.toLowerCase()}
                  </>
                ) : (
                  "Water · evidence needed · no water target set"
                )}
              </li>
              <li>
                <span className="tnum text-[#f2eee6]">{dailyPlan.targets.calories.toLocaleString("en-US")} kcal</span> est. · {alignment.dayLabel} · sleep lock {sleepLockLabel}
              </li>
              <li data-nutrition="fuel-source">{source.text}</li>
              {dailyPlan.targets.basis === "reference-weight" && (
                <li className="flex flex-wrap items-center gap-x-2">
                  <span>Targets assume {FUEL_REFERENCE_BODYWEIGHT_LB} lb until you log your weight.</span>
                  <button
                    type="button"
                    onClick={() => setActiveView("physique")}
                    className="min-h-[44px] font-semibold text-[#e8c87a] underline-offset-4 hover:underline"
                  >
                    Log Weight
                  </button>
                </li>
              )}
              {trainingContext.direction !== "unchanged" && (
                <li>
                  {trainingContext.trainingPlanned
                    ? "Training moved onto today · fuel windows follow it."
                    : "Training moved off today · fuel follows a non-training day."}
                </li>
              )}
              {alignmentWarning && <li className="text-[#e8c87a]">{alignmentWarning}</li>}
            </ul>
          </div>
        </div>
      </section>

      <FuelHorizonStrip horizon={horizon} onAction={runHorizonAction} />

      {/* Portalled to the body: the glass panel's blur and clipping would otherwise
          become the drawer's containing block, cutting it off and scrolling the page. */}
      {now && typeof document !== "undefined" && createPortal(
      <AnimatePresence>
        {confirmTarget && (
          <MealConfirmationDrawer
            key={`hero-meal-confirm-${confirmTarget.id}`}
            target={confirmTarget}
            plan={confirmPlan}
            schedule={scheduleProfile}
            goal={goalKeyFromString(profileGoal)}
            trainingComplete={sessionMode === "complete" || sessionMode === "closed"}
            loggedIds={loggedMealIds}
            nowMinutes={now.getHours() * 60 + now.getMinutes()}
            onConfirm={(event) => recordMeal(() => confirmMealLog(event))}
            onUndo={() => recordMeal(() => undoLastMealLog())}
            onClose={closeConfirm}
            onPickMeal={(id) => setConfirmMealId(id)}
          />
        )}
      </AnimatePresence>,
      document.body,
      )}
    </GlassPanel>
  );
}
