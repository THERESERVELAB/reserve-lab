"use client";

import { AnimatePresence } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { recordRecoveryLog } from "@/components/recovery/record-recovery-log";
import { SleepLoggerCard } from "@/components/recovery/SleepLoggerCard";
import { RECOVERY_REFERENCE_CLOCK, useRecoveryClock } from "@/components/recovery/useRecoveryClock";
import { DayHorizonStrip } from "@/components/schedule/DayHorizonStrip";
import { focusScheduleTime } from "@/components/schedule/schedule-times-anchor";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { ReserveBottomSheet, ReserveButton } from "@/components/ui/reserve";
import { MealConfirmationDrawer } from "@/components/views/nutrition/MealConfirmationDrawer";
import { useAthleteDashboardStore } from "@/lib/athlete-store";
import { RESERVE, alpha } from "@/lib/design/tokens";
import { goalKeyFromString } from "@/lib/nutrition/adapter";
import { fuelPlanForConfirmation } from "@/lib/nutrition/nutrition-room";
import type { DietStyleKey } from "@/lib/nutrition/types";
import { useTodayFuelPlan } from "@/lib/nutrition/useTodayFuelPlan";
import { buildRecoverySnapshot } from "@/lib/recovery/engine";
import { buildDayHorizon, type ScheduleAction } from "@/lib/schedule/day-horizon";
import { detectSleepConflict, localScheduleDateKey } from "@/lib/schedule/engine";
import { resolveSchedulePrimaryAction } from "@/lib/schedule/primary-action";
import {
  scheduleDayState,
  scheduleDayStatus,
  scheduleIsSet,
  scheduleStatement,
  scheduleTimesParts,
} from "@/lib/schedule/schedule-room";
import { localDateKey } from "@/lib/dates/local-day";

/* ════════════════════════════════════════════════════════════════════════
   SCHEDULE ROOM HERO — the first screen of Schedule (Bible §11 layers 1–3).

   Day status → statement → the member's own times → the one gold action →
   today's plan horizon toward sleep lock. Everything inside the first screen
   at 1440×1000 and 390×844.

     - The day status is the one training-day resolver's (useTodayTrainingDay,
       through useTodayFuelPlan), so Schedule, Nutrition, Training and Apex
       never name a different day, and training moved here or away says so.
     - A schedule the member has not set is said to be unset. Its starting
       times are never shown as a plan, and the one action is "Set Your Day".
     - The gold action never records a meal or a night by itself: meals open
       the existing meal confirmation, sleep opens the Sleep Log, a session
       goes through Training's own launch path. A water log prints its amount.
     - The meals are the fuel plan the Nutrition screen and the Apex fuel lane
       read, so a meal logged here ticks the same card there.

   The light is painted, not animated. The strip moves only with the minute clock.
   ════════════════════════════════════════════════════════════════════════ */

/** Hydration log dates match the recovery engine's own date key. Called from handlers only, never during render. */
function todayISO(): string {
  return localDateKey();
}

/** A sheet restores focus to its opener as it closes; an editor focus waits until that has happened. */
function focusAfterSheets(action: () => void) {
  setTimeout(action, 60);
}

export function ScheduleRoomHero() {
  const scheduleProfile = useAthleteDashboardStore((s) => s.scheduleProfile);
  const completedSteps = useAthleteDashboardStore((s) => s.setupProfile.completedSteps);
  const profileGoal = useAthleteDashboardStore((s) => s.profile.goal);
  const prefs = useAthleteDashboardStore((s) => s.nutritionPrefs);
  const recoveryCommand = useAthleteDashboardStore((s) => s.recoveryCommand);
  const sessionMode = useAthleteDashboardStore((s) => s.trainingSession.sessionMode);
  const logHydration = useAthleteDashboardStore((s) => s.logHydration);
  const confirmMealLog = useAthleteDashboardStore((s) => s.confirmMealLog);
  const undoLastMealLog = useAthleteDashboardStore((s) => s.undoLastMealLog);
  const toggleLoggedMeal = useAthleteDashboardStore((s) => s.toggleLoggedMeal);
  const requestTrainingLaunch = useAthleteDashboardStore((s) => s.requestTrainingLaunch);
  const setActiveView = useAthleteDashboardStore((s) => s.setActiveView);

  /* ONE clock. Server and first client render read the fixed reference, so the
     markup matches; the real clock arrives after mount and ticks per minute. */
  const now = useRecoveryClock();
  const clock = now ?? RECOVERY_REFERENCE_CLOCK;

  const { dailyPlan, trainingPlanned, today, trainingContext } = useTodayFuelPlan(clock);
  const scheduleSet = scheduleIsSet(completedSteps);
  const loggedMealIds = prefs.loggedMealIds;
  const dateKey = localScheduleDateKey(clock);
  const sleepLoggedToday = recoveryCommand.sleepLogs.some((log) => log.date === dateKey);
  const sleepConflict = detectSleepConflict(scheduleProfile, { trainingPlanned }).severity;
  const hydration = useMemo(() => {
    const snapshot = buildRecoverySnapshot(recoveryCommand, clock);
    return { todayOz: snapshot.hydrationTodayOz, targetOz: snapshot.hydrationTargetOz };
  }, [recoveryCommand, clock]);

  const dayInput = {
    schedule: scheduleProfile,
    scheduleSet,
    trainingPlanned,
    direction: trainingContext.direction,
    sessionLabel: today.sessionName,
    sessionMode,
    meals: dailyPlan.meals,
    loggedMealIds,
    sleepLoggedToday,
  };

  const horizon = now ? buildDayHorizon({ ...dayInput, now }) : null;
  const plan = resolveSchedulePrimaryAction({ ...dayInput, now: clock, sleepConflict, hydration });
  const state = scheduleDayState({ now: clock, schedule: scheduleProfile, scheduleSet, trainingPlanned, sessionMode, sleepConflict });
  const statement = scheduleStatement({ state, trainingPlanned });
  const dayStatus = scheduleDayStatus({ trainingPlanned, context: trainingContext, sessionLabel: today.sessionName });

  /* ── The existing meal confirmation, fed today's fuel plan ── */
  const [confirmMealId, setConfirmMealId] = useState<string | null>(null);
  const closeConfirm = useCallback(() => setConfirmMealId(null), []);
  const confirmPlan = useMemo(
    () => fuelPlanForConfirmation({ plan: dailyPlan, loggedMealIds, dietStyle: prefs.dietStyle as DietStyleKey, date: dateKey }),
    [dailyPlan, loggedMealIds, prefs.dietStyle, dateKey],
  );
  const confirmTarget = confirmMealId ? (confirmPlan.meals.find((meal) => meal.id === confirmMealId) ?? null) : null;

  /* ── The existing Sleep Log, in a sheet ── */
  const [sleepLogOpen, setSleepLogOpen] = useState(false);
  const closeSleepLog = useCallback(() => setSleepLogOpen(false), []);
  const [sleepLogDirty, setSleepLogDirty] = useState(false);

  function run(action: ScheduleAction) {
    switch (action.kind) {
      case "open-meal-log":
        setConfirmMealId(action.mealId);
        break;
      case "undo-meal-log":
        if (!loggedMealIds.includes(action.mealId)) break;
        if (prefs.latestMealLog?.mealId === action.mealId) undoLastMealLog();
        else toggleLoggedMeal(action.mealId);
        break;
      case "start-session":
        requestTrainingLaunch();
        setActiveView("training");
        break;
      case "review-session":
        setActiveView("training");
        break;
      case "open-sleep-log":
        setSleepLogOpen(true);
        break;
      case "log-water":
        recordRecoveryLog("water", () => logHydration({ date: todayISO(), oz: action.oz }));
        break;
      case "edit-time": {
        const field = action.field;
        focusAfterSheets(() => focusScheduleTime(field));
        break;
      }
      case "set-day":
        focusAfterSheets(() => focusScheduleTime(null));
        break;
    }
  }

  const arrow = plan.primary.kind !== "log-water";

  return (
    /* Phones: a flush section inside the page gutter, not a card (components.md rule 1). */
    <GlassPanel accent={RESERVE.gold} noPad phone="flush" className="md:overflow-hidden">
      <section aria-label="Today's plan" data-schedule="hero" className="relative pb-5 pt-4 md:p-6 lg:px-8 lg:py-6">
        {/* Bible §09: Schedule is the planning desk, lit from screen-left like the staged day. Painted still.
            On phones the light reaches the screen edge and feathers out downward, never cut by a box. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-x-3 inset-y-0 max-md:[mask-image:linear-gradient(180deg,#000_55%,transparent)] md:inset-x-0"
          style={{
            background: `radial-gradient(110% 90% at 0% 20%, ${alpha(RESERVE.amber, 0.085)}, transparent 55%), radial-gradient(80% 70% at 100% 100%, ${alpha(RESERVE.steel, 0.045)}, transparent 60%)`,
          }}
        />

        <div className="relative grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)] lg:items-end lg:gap-12">
          <div className="min-w-0">
            <p data-schedule="day-status" className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/60">
              Day status · {dayStatus}
            </p>
            <h2 data-room-statement className="mt-2.5 font-display text-[28px] font-black uppercase leading-[0.95] tracking-[-0.02em] text-[#f2eee6] [hyphens:none] sm:text-[34px] lg:text-[42px]">
              {statement}
            </h2>
            <p data-schedule="times" className="tnum mt-3 max-w-[58ch] text-[13px] leading-[1.55] text-white/70">
              {scheduleSet
                ? scheduleTimesParts({ schedule: scheduleProfile, trainingPlanned }).map((part, i) => (
                    /* Each time wraps as a whole, never mid-phrase. */
                    <span key={part}>
                      {i > 0 && " · "}
                      <span className="whitespace-nowrap">{part}</span>
                    </span>
                  ))
                : "No operating times set yet"}
            </p>
          </div>

          <div className="min-w-0">
            <p data-schedule="action-title" className="text-[14px] font-semibold leading-snug text-[#f2eee6] [text-wrap:balance]">
              {plan.title}
            </p>
            <p className="mt-1 max-w-[56ch] text-[12.5px] leading-[1.5] text-white/60">{plan.reason}</p>
            {/* The screen's one gold action (Bible §11). */}
            <div data-schedule="primary-action" className="mt-3 min-w-0 max-sm:w-full sm:inline-block">
              <ReserveButton tier="primary" size="md" fullWidth iconAfter={arrow ? ArrowRight : undefined} onClick={() => run(plan.primary)}>
                {plan.primary.label}
              </ReserveButton>
            </div>
          </div>
        </div>
      </section>

      <DayHorizonStrip horizon={horizon} onAction={run} />

      <ReserveBottomSheet open={sleepLogOpen} onClose={closeSleepLog} title="Sleep Log" accent={RESERVE.violet} dirty={sleepLogOpen && sleepLogDirty}>
        <SleepLoggerCard onDirtyChange={setSleepLogDirty} />
      </ReserveBottomSheet>

      {/* Portalled to the body: the glass panel's blur and clipping would otherwise
          become the drawer's containing block, cutting it off and scrolling the page. */}
      {now && typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          {confirmTarget && (
            <MealConfirmationDrawer
              key={`schedule-meal-confirm-${confirmTarget.id}`}
              target={confirmTarget}
              plan={confirmPlan}
              schedule={scheduleProfile}
              goal={goalKeyFromString(profileGoal)}
              trainingComplete={sessionMode === "complete" || sessionMode === "closed"}
              loggedIds={loggedMealIds}
              nowMinutes={now.getHours() * 60 + now.getMinutes()}
              onConfirm={(event) => confirmMealLog(event)}
              onUndo={() => undoLastMealLog()}
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
