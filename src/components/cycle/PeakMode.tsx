"use client";

import { Check, Zap } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { useSafetyToolsVisible } from "@/components/authz/CapabilitiesProvider";
import { useClientNow } from "@/components/safety/useClientNow";
import { useSafetyContext } from "@/components/safety/useSafetyContext";
import { ReserveBottomSheet, ReserveButton, ReserveDisclosure, ReserveSegmented } from "@/components/ui/reserve";
import { useAthleteDashboardStore } from "@/lib/athlete-store";
import { SUPPORT_AREA_LABEL, supportAreasForBrief, supportOptionByKey } from "@/lib/compound-intelligence/support-options";
import { buildFieldManual } from "@/lib/cycle-review/field-manual";
import { BowlBuilder, YourBowls } from "@/components/cycle/BowlBuilder";
import { WeekMenu } from "@/components/cycle/WeekMenu";
import { clearWeek, menuChoices, menuProgress, pickOne, repeatAcrossWeek, surpriseWeek, type MenuDay } from "@/lib/nutrition/peak-menu";
import { bowlsForSlot, type CustomBowl } from "@/lib/nutrition/peak-bowls";
import { nightBefore, prepKey, prepKeys, prepProgress } from "@/lib/nutrition/peak-prep";
import { localDateKey, localDateKeyOffset } from "@/lib/dates/local-day";
import { RESERVE, alpha } from "@/lib/design/tokens";
import {
  AVOID_CHOICES,
  CARB_CHOICES,
  PROTEIN_CHOICES,
  dayPlanFor,
  shoppingList,
  weekDates,
  type PeakAvoidKey,
  type PeakCarbKey,
  type PeakKitchenPrefs,
  type PeakProteinKey,
} from "@/lib/nutrition/peak-kitchen";
import { DRY_THE_RIGHT_WAY, LOOK_GOAL_KEY, PEAK_LOOKS, PEAK_LOOK_ORDER, dayIndexOf, peakMeals, swapOptions, totalsOf, type PeakLook, type PeakMeal, DEFAULT_PEAK_SNACKS, PEAK_SNACK_PERIODS, swapKey } from "@/lib/nutrition/peak-mode";
import { GROUND_FAMILY_LABEL, RATIO_LADDER, RATIO_LAB_MARKERS, type GroundFamily } from "@/lib/nutrition/peak-ratios";
import type { PeakFood } from "@/lib/nutrition/peak-signatures";
import { computeMacroTargets } from "@/lib/nutrition/macro-engine";
import type { DietStyleKey } from "@/lib/nutrition/types";
import { useTodayFuelPlan } from "@/lib/nutrition/useTodayFuelPlan";
import { formatTime12 } from "@/lib/schedule/engine";

function Whisper({ children, color }: { children: React.ReactNode; color?: string }) {
  return <p className="type-whisper" style={color ? { color } : undefined}>{children}</p>;
}

const EMPTY: string[] = [];

const matchColor = (match: number) => (match >= 85 ? RESERVE.green : match >= 70 ? RESERVE.gold : RESERVE.amber);

/**
 * PEAK MODE — one tap, the whole day for the look the member picks: meals
 * built from their own food answers, swappable plates with recipes and a
 * target match, the week's shopping list, training, cardio, sleep and the
 * member's own supplements. The look sets the diet; compound areas only order
 * which of its plates come first.
 */
export function PeakModeLauncher() {
  const [open, setOpen] = useState(false);
  const peakLook = useAthleteDashboardStore((s) => s.nutritionPrefs.peakLook);
  const close = useCallback(() => setOpen(false), []);
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] px-4 py-3" style={{ background: alpha(RESERVE.gold, 0.06), boxShadow: `inset 0 0 0 1px ${alpha(RESERVE.gold, 0.18)}` }}>
        <div className="min-w-0">
          <Whisper color={alpha(RESERVE.gold, 0.9)}>Peak Mode{peakLook ? ` · ${PEAK_LOOKS[peakLook].label}` : ""}</Whisper>
          <p className="mt-1 text-[12.5px] leading-[1.5] text-white/65">Your whole day on one screen: meals and recipes, the week&apos;s shopping list, training, cardio, sleep and your supplements.</p>
        </div>
        <ReserveButton tier="secondary" size="sm" icon={Zap} onClick={() => setOpen(true)}>
          {peakLook ? "Open Peak Mode" : "Enter Peak Mode"}
        </ReserveButton>
      </div>
      <ReserveBottomSheet open={open} onClose={close} title="Peak Mode" accent={RESERVE.gold}>
        {open && <PeakModeBody />}
      </ReserveBottomSheet>
    </>
  );
}

function PeakModeBody() {
  const now = useClientNow();
  if (!now) return null;
  return <PeakModeDay now={now} />;
}

function PeakModeDay({ now }: { now: Date }) {
  const prefs = useAthleteDashboardStore((s) => s.nutritionPrefs);
  const peakLook = prefs.peakLook ?? null;
  const setNutritionPrefs = useAthleteDashboardStore((s) => s.setNutritionPrefs);
  const setActiveView = useAthleteDashboardStore((s) => s.setActiveView);
  const scheduleProfile = useAthleteDashboardStore((s) => s.scheduleProfile);
  const setupProfile = useAthleteDashboardStore((s) => s.setupProfile);
  const supportPlan = useAthleteDashboardStore((s) => s.supportPlan);
  const safetyToolsVisible = useSafetyToolsVisible();
  const ctx = useSafetyContext(now);
  const { dailyPlan, today, trainingPlanned, memberBodyweight, goal, favoriteInputs, personalization, trainingWeek } = useTodayFuelPlan(now);
  const [view, setView] = useState<"today" | "menu" | "week">("today");
  const [editingPrefs, setEditingPrefs] = useState(false);

  const todayKey = localDateKey(now);
  /* A draft (picks with no answeredAt) keeps every tap without pretending the
     member has finished: the questions stay until they say so. */
  const saved = prefs.peakKitchen ?? null;
  const kitchen = saved?.answeredAt ? saved : null;
  const hidden = prefs.peakHidden ?? EMPTY;
  const peakSwaps = prefs.peakSwaps;
  const snackPeriods = prefs.peakSnacks ?? DEFAULT_PEAK_SNACKS;
  const savedBowls = useMemo(() => prefs.peakBowls ?? EMPTY_BOWLS, [prefs.peakBowls]);
  /* Every bowl as a plate, once: peakMeals and the swap list both read these. */
  const bowlPlates = useMemo(() => savedBowls.flatMap((b) => bowlsForSlot([b], b.slot)), [savedBowls]);
  const [building, setBuilding] = useState(false);
  const closeBuilder = useCallback(() => setBuilding(false), []);
  const saveBowl = useCallback(
    (bowl: CustomBowl) => setNutritionPrefs({ peakBowls: [...(useAthleteDashboardStore.getState().nutritionPrefs.peakBowls ?? []), bowl] }),
    [setNutritionPrefs],
  );
  const removeBowl = useCallback(
    (id: string) => setNutritionPrefs({ peakBowls: (useAthleteDashboardStore.getState().nutritionPrefs.peakBowls ?? []).filter((b) => b.id !== id) }),
    [setNutritionPrefs],
  );
  const safetyOpen = safetyToolsVisible && ctx.acknowledged && ctx.activeCompounds.length > 0;
  const compoundAreas = useMemo(() => (safetyOpen ? supportAreasForBrief(ctx.riskBrief).map((entry) => entry.area) : []), [safetyOpen, ctx]);
  /* Lipid results above the member's own report range, read only where safety content is open. */
  const labLipidsAbove = useMemo(
    () =>
      safetyToolsVisible && ctx.acknowledged && ctx.hasLabs
        ? ctx.labBrief.findings
            .filter((f) => f.markerKey && (RATIO_LAB_MARKERS as readonly string[]).includes(f.markerKey) && f.latest.position === "above")
            .map((f) => f.label)
        : [],
    [safetyToolsVisible, ctx],
  );
  const peakRatios = prefs.peakRatios;
  const ratioOptions = useMemo(
    () => ({ compoundLipids: compoundAreas.includes("lipids"), labLipidsAbove, overrides: peakRatios }),
    [compoundAreas, labLipidsAbove, peakRatios],
  );

  /* Calories, protein, carbs and fat all come from the app's own macro engine, which already
     follows the goal, the day type and the member's diet style. */
  const macrosFor = useCallback(
    (training: boolean) =>
      peakLook
        ? computeMacroTargets({
            goal: LOOK_GOAL_KEY[peakLook],
            bodyweightLb: memberBodyweight?.lb ?? null,
            dayType: training ? "training" : "rest",
            dietStyle: (prefs.dietStyle || "standard") as DietStyleKey,
            bodyProfile: { sex: setupProfile.sex, heightIn: setupProfile.heightIn, age: setupProfile.age },
          })
        : null,
    [peakLook, memberBodyweight, prefs.dietStyle, setupProfile.sex, setupProfile.heightIn, setupProfile.age],
  );
  const mealsForDay = useCallback(
    (date: string, plan: typeof dailyPlan) => {
      if (!peakLook) return [];
      const macros = macrosFor(plan.isTrainingDay);
      return peakMeals(plan, {
        look: peakLook,
        compoundAreas,
        dayIndex: dayIndexOf(date),
        prefs: kitchen,
        swaps: peakSwaps?.[date],
        hidden,
        ratios: ratioOptions,
        dayTargets: macros ? { calories: macros.calories, proteinG: macros.proteinG, carbsG: macros.carbsG, fatG: macros.fatG } : undefined,
        snacks: snackPeriods,
        sleepTime: scheduleProfile.sleepTarget,
        bowls: bowlPlates,
      });
    },
    [peakLook, compoundAreas, kitchen, peakSwaps, hidden, ratioOptions, macrosFor, snackPeriods, scheduleProfile.sleepTarget, bowlPlates],
  );
  const buildDay = useCallback(
    (date: string, training: boolean, sessionName: string) =>
      mealsForDay(date, dayPlanFor(training, sessionName, { goal, scheduleProfile, bodyweightLb: memberBodyweight?.lb ?? null, favorites: favoriteInputs, personalization })),
    [mealsForDay, goal, scheduleProfile, memberBodyweight, favoriteInputs, personalization],
  );
  const meals = useMemo(() => mealsForDay(todayKey, dailyPlan), [mealsForDay, todayKey, dailyPlan]);
  const fittedAreas = [...new Set(meals.flatMap((m) => m.fits.map((f) => SUPPORT_AREA_LABEL[f.area])))];
  const changedCuts = [...new Set(meals.flatMap((m) => m.ratios.filter((r) => r.changedForCholesterol).map((r) => r.family)))];
  const watch = useMemo(() => {
    if (!safetyOpen) return [];
    return buildFieldManual(ctx.riskBrief).sections.flatMap((s) => s.items).filter((i) => i.forYou && i.kind === "limit");
  }, [safetyOpen, ctx]);
  const totals = totalsOf(meals);
  const noRoom = PEAK_SNACK_PERIODS.filter((x) => snackPeriods.includes(x.key) && !meals.some((m) => m.id === `peak-snack-${x.key}`)).map((x) => x.label);
  const dayMacros = macrosFor(trainingPlanned);
  const supplements = supportPlan.map((item) => item.customTitle ?? supportOptionByKey(item.optionKey)?.title ?? item.optionKey);

  const choose = (look: PeakLook) => setNutritionPrefs({ peakLook: look });

  const swap = (date: string, key: string, plateId: string) => {
    const keep = localDateKeyOffset(now, -7);
    const next = Object.fromEntries(Object.entries(peakSwaps ?? {}).filter(([d]) => d >= keep));
    next[date] = { ...(next[date] ?? {}), [key]: plateId };
    setNutritionPrefs({ peakSwaps: next });
  };
  const hide = (plateId: string) => setNutritionPrefs({ peakHidden: [...new Set([...hidden, plateId])] });
  const setRatio = (family: GroundFamily, food: PeakFood | null) => {
    const next = { ...(peakRatios ?? {}) };
    if (food) next[family] = food;
    else delete next[family];
    setNutritionPrefs({ peakRatios: next });
  };

  const optionsFor = useCallback(
    (meal: PeakMeal, training: boolean) =>
      meal.signature && peakLook ? swapOptions(meal, peakLook, kitchen, hidden, compoundAreas, training, ratioOptions, bowlPlates) : [],
    [peakLook, kitchen, hidden, compoundAreas, ratioOptions, bowlPlates],
  );

  /* One meal row, for today or any day of the week: swaps are saved against that day's date. */
  const mealRows = useCallback(
    (date: string, dayMeals: PeakMeal[], training: boolean) =>
      dayMeals.map((meal) => (
        <MealRow
          key={meal.id}
          meal={meal}
          options={meal.signature && peakLook ? swapOptions(meal, peakLook, kitchen, hidden, compoundAreas, training, ratioOptions, bowlPlates) : []}
          onSwap={(plateId) => swap(date, swapKey(meal), plateId)}
          onHide={meal.plateId ? () => hide(meal.plateId!) : undefined}
          onRatio={setRatio}
        />
      )),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [peakLook, kitchen, hidden, compoundAreas, ratioOptions, peakSwaps, bowlPlates],
  );

  if (!peakLook) {
    return (
      <div className="flex flex-col gap-4" data-peak="choose">
        <p className="text-[13px] leading-[1.55] text-white/70">Pick the look you are building. Your meals, fuel targets and Nutrition plan follow it until you change it.</p>
        <ul className="flex flex-col gap-2">
          {PEAK_LOOK_ORDER.map((look) => (
            <li key={look}>
              <button
                type="button"
                onClick={() => choose(look)}
                className="w-full rounded-[16px] px-4 py-3 text-left transition hover:bg-white/[0.05]"
                style={{ boxShadow: `inset 0 0 0 1px ${alpha(RESERVE.gold, 0.2)}` }}
              >
                <span className="block text-[14.5px] font-semibold" style={{ color: RESERVE.ivory }}>{PEAK_LOOKS[look].label}</span>
                <span className="mt-0.5 block text-[12px] leading-[1.5] text-white/55">{PEAK_LOOKS[look].line}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (!kitchen || editingPrefs) {
    return (
      <KitchenQuestions
        initial={saved}
        confirmed={Boolean(kitchen)}
        onDraft={(answers) => setNutritionPrefs({ peakKitchen: answers })}
        onSave={(answers) => {
          setNutritionPrefs({ peakKitchen: answers });
          setEditingPrefs(false);
        }}
        onCancel={kitchen ? () => setEditingPrefs(false) : undefined}
      />
    );
  }

  return (
    <div className="flex flex-col gap-5" data-peak="day">
      <div className="flex flex-col gap-2">
        <ReserveSegmented
          label="Peak look"
          value={peakLook}
          onChange={choose}
          accent={RESERVE.gold}
          size="sm"
          segments={PEAK_LOOK_ORDER.map((look) => ({ value: look, label: PEAK_LOOKS[look].label }))}
        />
        <p className="text-[12.5px] leading-[1.55] text-white/60">{PEAK_LOOKS[peakLook].line}</p>
        <ReserveSegmented
          label="Peak Mode view"
          value={view}
          onChange={setView}
          accent={RESERVE.gold}
          size="sm"
          segments={[{ value: "today", label: "Today" }, { value: "menu", label: "Menu" }, { value: "week", label: "Week & shopping" }]}
        />
      </div>

      {view === "menu" ? (
        <TheWeeksMenu
          now={now}
          todayKey={todayKey}
          todayMeals={meals}
          trainingWeek={trainingWeek}
          buildDay={buildDay}
          optionsFor={optionsFor}
        />
      ) : view === "week" ? (
        <WeekAndShopping now={now} todayKey={todayKey} todayMeals={meals} trainingWeek={trainingWeek} buildDay={buildDay} mealRows={mealRows} />
      ) : (
        <>
          <section aria-label="Peak Mode meals">
            <Whisper color={alpha(RESERVE.gold, 0.9)}>
              {trainingPlanned ? `Training day · ${today.sessionName}` : "Rest day"} · {totals.calories.toLocaleString("en-US")} kcal · {totals.proteinG}P {totals.carbsG}C {totals.fatG}F
            </Whisper>
            {dayMacros && (
              <p className="mt-1 text-[11.5px] leading-[1.5] text-white/55" data-peak-day-target>
                Today&apos;s target: {dayMacros.calories.toLocaleString("en-US")} kcal · {dayMacros.proteinG}P {dayMacros.carbsG}C {dayMacros.fatG}F.
                {" "}Served {Math.round((totals.calories / Math.max(1, dayMacros.calories)) * 100)}% of the calories, {Math.round((totals.proteinG / Math.max(1, dayMacros.proteinG)) * 100)}% of the protein,
                {" "}{Math.round((totals.carbsG / Math.max(1, dayMacros.carbsG)) * 100)}% of the carbs and {Math.round((totals.fatG / Math.max(1, dayMacros.fatG)) * 100)}% of the fat.
              </p>
            )}
            {!memberBodyweight && <p className="mt-1 text-[11.5px] text-white/45">{dailyPlan.targets.note}</p>}
            {trainingPlanned && meals.length > 0 && !meals.some((m) => m.slot === "post-workout") && (
              <p className="mt-1 text-[11.5px] leading-[1.5]" style={{ color: alpha(RESERVE.amber, 0.9) }} data-peak-no-post>
                No post-workout meal fits today: your session starts at {formatTime12(scheduleProfile.preferredTrainingStart)} and lights out is {formatTime12(scheduleProfile.sleepTarget)}, so the recovery plate would land past your bedtime. Move the session earlier in Schedule to get one.
              </p>
            )}
            <p className="mt-1 text-[11.5px] leading-[1.5] text-white/45">
              Reserve signature plates built from your food answers, portions scaled to your targets. Match is how closely a plate&apos;s calories and protein land on that meal&apos;s target.
              {changedCuts.length > 0 ? ` ${changedCuts.length === 1 ? "One cut was" : `${changedCuts.length} cuts were`} changed for cholesterol today — each meal says which, and why.` : ""}
              {fittedAreas.length > 0 ? ` Plates that fit public guidance for ${fittedAreas.join(" and ")} — areas your compounds affect — come first. Food does not offset what a compound does.` : ""}
            </p>
            <div className="mt-3" data-peak-snacks>
              <ChipGroup
                label="Snacks between meals"
                hint="Pick when you want one. Each snack takes a share of the day, so your meals shrink to make room."
                options={PEAK_SNACK_PERIODS.map((x) => ({ key: x.key, label: x.label }))}
                value={[...snackPeriods]}
                onChange={(next) => setNutritionPrefs({ peakSnacks: PEAK_SNACK_PERIODS.map((x) => x.key).filter((k) => next.includes(k)) })}
              />
              {noRoom.length > 0 && (
                <p className="mt-1.5 text-[11.5px] text-white/45" data-peak-snack-no-room>
                  No room today for {noRoom.join(" or ").toLowerCase()} {noRoom.length === 1 ? "snack" : "snacks"}: your meals sit too close together.
                </p>
              )}
            </div>
            <ul className="mt-2 flex flex-col divide-y divide-white/[0.05]">{mealRows(todayKey, meals, trainingPlanned)}</ul>
            <YourBowls bowls={savedBowls} onBuild={() => setBuilding(true)} onRemove={removeBowl} />
            <CookingChecklist now={now} todayKey={todayKey} todayMeals={meals} trainingWeek={trainingWeek} buildDay={buildDay} />
            <div className="mt-1 flex flex-wrap gap-2">
              <ReserveButton tier="quiet" size="sm" onClick={() => setActiveView("nutrition")}>Log meals in Nutrition</ReserveButton>
              <ReserveButton tier="quiet" size="sm" onClick={() => setEditingPrefs(true)}>Edit food answers</ReserveButton>
              {hidden.length > 0 && (
                <ReserveButton tier="quiet" size="sm" onClick={() => setNutritionPrefs({ peakHidden: [] })}>
                  Show {hidden.length} hidden plate{hidden.length === 1 ? "" : "s"}
                </ReserveButton>
              )}
            </div>
          </section>

          <section aria-label="Peak Mode day">
            <Whisper>The rest of the day</Whisper>
            <ul className="mt-2 flex flex-col gap-2 text-[12.5px] leading-[1.55] text-white/70">
              <li>
                <span className="font-semibold" style={{ color: RESERVE.ivory }}>Training · </span>
                {trainingPlanned ? `${today.sessionName}${scheduleProfile.preferredTrainingStart ? ` at ${formatTime12(scheduleProfile.preferredTrainingStart)}` : ""}` : "Recovery day — no session planned."}
              </li>
              <li>
                <span className="font-semibold" style={{ color: RESERVE.ivory }}>Cardio and steps · </span>
                Field Op in Schedule sets today&apos;s walk, heart-rate range and step range.
              </li>
              <li>
                <span className="font-semibold" style={{ color: RESERVE.ivory }}>Sleep · </span>
                {scheduleProfile.sleepTarget ? `Lights out ${formatTime12(scheduleProfile.sleepTarget)}, screens down an hour before.` : "Set a bedtime in Schedule."}
              </li>
              <li>
                <span className="font-semibold" style={{ color: RESERVE.ivory }}>Your supplements · </span>
                {supplements.length ? supplements.join(", ") : "None in your plan yet — the supplement library lists options with their evidence."}
              </li>
            </ul>
            <div className="mt-2 flex flex-wrap gap-2">
              <ReserveButton tier="quiet" size="sm" onClick={() => setActiveView("schedule-command")}>Open Field Op</ReserveButton>
              <ReserveButton tier="quiet" size="sm" onClick={() => setActiveView("training")}>Open Training</ReserveButton>
            </div>
          </section>

          {watch.length > 0 && (
            <section aria-label="Peak Mode watch" className="rounded-[14px] px-3.5 py-3" style={{ background: alpha(RESERVE.amber, 0.06) }}>
              <Whisper color={RESERVE.amber}>Limits your compounds make matter more</Whisper>
              <ul className="mt-1.5 flex flex-col gap-1">
                {watch.map((item) => (
                  <li key={item.key} className="text-[12.5px] leading-[1.5] text-white/70">
                    <span className="font-semibold" style={{ color: RESERVE.ivory }}>{item.title}</span> — {item.forYou?.areaLabels.join(" · ")}
                  </li>
                ))}
              </ul>
              <p className="mt-1.5 text-[11px] text-white/45">From the Field Manual under your Cycle Brief, awaiting clinician review.</p>
            </section>
          )}

          <ReserveDisclosure summary="Dry, the right way" accent={RESERVE.gold}>
            <ul className="flex flex-col gap-2.5">
              {DRY_THE_RIGHT_WAY.map((fact) => (
                <li key={fact.title}>
                  <p className="text-[13px] font-semibold" style={{ color: RESERVE.ivory }}>{fact.title}</p>
                  <p className="mt-0.5 text-[12.5px] leading-[1.5] text-white/65">{fact.text}</p>
                  <p className="mt-0.5 text-[10.5px] text-white/35">{fact.sources.map((s) => s.label).join(" · ")}</p>
                </li>
              ))}
            </ul>
          </ReserveDisclosure>
        </>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <ReserveButton tier="quiet" size="sm" onClick={() => setNutritionPrefs({ peakLook: null })}>Leave Peak Mode</ReserveButton>
        <p className="text-[11px] text-white/40">Macros are planning estimates. Reserve never sets compounds or supplements.</p>
      </div>

      <BowlBuilder open={building} onClose={closeBuilder} onSave={saveBowl} />
    </div>
  );
}

/* ─── The questions ─────────────────────────────────────────────────────── */

function ChipGroup<T extends string>({ label, hint, options, value, onChange }: { label: string; hint: string; options: Array<{ key: T; label: string }>; value: T[]; onChange: (next: T[]) => void }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-[13.5px] font-semibold" style={{ color: RESERVE.ivory }}>{label}</legend>
      <p className="text-[11.5px] text-white/50">{hint}</p>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
        {options.map((o) => {
          const on = value.includes(o.key);
          return (
            <button
              key={o.key}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? value.filter((v) => v !== o.key) : [...value, o.key])}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full px-3.5 text-[12.5px] transition"
              style={{ background: on ? alpha(RESERVE.gold, 0.14) : "rgba(255,255,255,0.03)", boxShadow: `inset 0 0 0 1px ${on ? alpha(RESERVE.gold, 0.45) : "rgba(255,255,255,0.08)"}`, color: on ? RESERVE.ivory : "rgba(255,255,255,0.7)" }}
            >
              {on && <Check size={12} aria-hidden="true" />}
              {o.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function KitchenQuestions({
  initial,
  confirmed,
  onDraft,
  onSave,
  onCancel,
}: {
  initial: PeakKitchenPrefs | null;
  /** True once these answers have been confirmed at least once. */
  confirmed: boolean;
  /** Every pick, kept the moment it is made. */
  onDraft: (answers: PeakKitchenPrefs) => void;
  onSave: (answers: PeakKitchenPrefs) => void;
  onCancel?: () => void;
}) {
  const [carbs, setCarbs] = useState<PeakCarbKey[]>(initial?.carbs ?? []);
  const [proteins, setProteins] = useState<PeakProteinKey[]>(initial?.proteins ?? []);
  const [avoid, setAvoid] = useState<PeakAvoidKey[]>(initial?.avoid ?? []);
  const any = carbs.length > 0 || proteins.length > 0 || avoid.length > 0;

  /* Nothing here waits for a button. A pick is written the moment it is made,
     carrying the stamp it already had: unconfirmed while the member is still
     answering, confirmed once they have. Leaving the screen loses nothing. */
  const keep = (next: { carbs?: PeakCarbKey[]; proteins?: PeakProteinKey[]; avoid?: PeakAvoidKey[] }) => {
    const answers: PeakKitchenPrefs = {
      carbs: next.carbs ?? carbs,
      proteins: next.proteins ?? proteins,
      avoid: next.avoid ?? avoid,
      answeredAt: initial?.answeredAt ?? "",
      ...(initial?.onHand ? { onHand: initial.onHand } : {}),
    };
    if (next.carbs) setCarbs(next.carbs);
    if (next.proteins) setProteins(next.proteins);
    if (next.avoid) setAvoid(next.avoid);
    onDraft(answers);
  };

  return (
    <section aria-label="Build your plates" className="flex flex-col gap-5" data-peak="questions">
      <div>
        <Whisper color={alpha(RESERVE.gold, 0.9)}>Build your plates</Whisper>
        <p className="mt-1.5 text-[13px] leading-[1.55] text-white/70">Three quick questions so every plate is food you actually eat. Plates swap in your picks, matched gram for gram on carbs or protein.</p>
      </div>
      <ChipGroup label="Carbs you like" hint="Pick any. Plates rotate through your picks." options={CARB_CHOICES} value={carbs} onChange={(next) => keep({ carbs: next })} />
      <ChipGroup label="Proteins you like" hint="Pick any. Plates rotate through your picks." options={PROTEIN_CHOICES} value={proteins} onChange={(next) => keep({ proteins: next })} />
      <ChipGroup label="Foods you don't eat" hint="Plates with these never show." options={AVOID_CHOICES} value={avoid} onChange={(next) => keep({ avoid: next })} />
      <div className="flex flex-wrap items-center gap-2">
        <ReserveButton tier="secondary" size="sm" onClick={() => onSave({ carbs, proteins, avoid, answeredAt: new Date().toISOString(), ...(initial?.onHand ? { onHand: initial.onHand } : {}) })}>
          {confirmed ? "Done" : any ? "Build my plates" : "Use Reserve's plates as they are"}
        </ReserveButton>
        {onCancel && <ReserveButton tier="quiet" size="sm" onClick={onCancel}>Cancel</ReserveButton>}
        {any && (
          <span className="text-[11.5px] leading-tight text-white/45" role="status" data-peak-saved>
            {confirmed ? "Saved as you pick." : "Your picks are kept — Build my plates when you're ready."}
          </span>
        )}
      </div>
    </section>
  );
}

/* ─── A meal ────────────────────────────────────────────────────────────── */

function MealRow({ meal, options, onSwap, onHide, onRatio }: { meal: PeakMeal; options: ReturnType<typeof swapOptions>; onSwap: (plateId: string) => void; onHide?: () => void; onRatio: (family: GroundFamily, food: PeakFood | null) => void }) {
  const [swapping, setSwapping] = useState(false);
  const alternatives = options.filter((o) => !o.current);
  return (
    <li className="py-3" data-peak-meal={meal.slot} data-peak-meal-id={meal.id}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[11px] uppercase tracking-[0.16em] text-white/45">{meal.time ? formatTime12(meal.time) : ""} · {meal.windowLabel}{meal.optional ? " · optional" : ""}</p>
        <p className="shrink-0 text-[11px] text-white/45">{meal.macros.calories} kcal · {meal.macros.proteinG}P {meal.macros.carbsG}C {meal.macros.fatG}F</p>
      </div>
      <div className="mt-1 flex items-baseline justify-between gap-3">
        <p className="text-[14px] font-semibold" style={{ color: RESERVE.ivory }} data-peak-name>{meal.name}</p>
        {meal.match !== null && (
          <p className="shrink-0 text-[11.5px] font-semibold" style={{ color: matchColor(meal.match) }} data-peak-match>
            {meal.match}% match
          </p>
        )}
      </div>
      <p className="mt-0.5 text-[12.5px] leading-[1.55] text-white/70">
        {(meal.ingredientsDetailed ?? meal.ingredients.map((name) => ({ name, amount: "" }))).map((i) => (i.amount ? `${i.name} ${i.amount}` : i.name)).join(" · ")}
      </p>
      {meal.swapped.length > 0 && (
        <p className="mt-1 text-[11.5px] text-white/50">Your picks: {meal.swapped.map((s) => `${s.to.replace(" (dry)", "")} in place of ${s.from.replace(" (dry)", "")}`).join(" · ")}</p>
      )}
      {meal.ratios.map((pick) => (
        <div key={pick.family} className="mt-2 rounded-[12px] px-3 py-2.5" style={{ background: alpha(RESERVE.gold, 0.05) }} data-peak-ratio={pick.family}>
          {pick.changedForCholesterol && (
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: RESERVE.amber }} data-peak-ratio-changed={pick.family}>
              Changed for cholesterol · {pick.changedForCholesterol.fromRatio} → {pick.changedForCholesterol.toRatio}
              {pick.changedForCholesterol.satFatSavedG > 0 ? ` · ${pick.changedForCholesterol.satFatSavedG} g less saturated fat` : ""}
            </p>
          )}
          <p className="text-[12.5px] font-semibold" style={{ color: RESERVE.ivory }}>
            {GROUND_FAMILY_LABEL[pick.family]} · {pick.ratio}{pick.kind === "ratio" ? " lean-to-fat" : " cut"}{pick.chosen ? " · your pick" : " · Reserve's pick"}
          </p>
          <p className="mt-0.5 text-[11.5px] text-white/60">
            About {pick.fatG} g fat, {pick.satFatG} g of it saturated, in this portion{pick.ratio !== pick.fattiestRatio ? `, against ${pick.fattiestSatFatG} g saturated at ${pick.fattiestRatio}` : ""}.
          </p>
          <ul className="mt-1 flex flex-col gap-0.5">
            {pick.reasons.map((reason) => (
              <li key={reason} className="text-[11.5px] leading-[1.5] text-white/60">{reason}</li>
            ))}
          </ul>
          <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label={`${GROUND_FAMILY_LABEL[pick.family]} ${pick.kind === "ratio" ? "ratio" : "cut"}`}>
            {RATIO_LADDER[pick.family].map((step) => {
              const on = step.food === pick.food;
              return (
                <button
                  key={step.food}
                  type="button"
                  aria-pressed={on}
                  onClick={() => onRatio(pick.family, step.food === pick.reserveFood ? null : step.food)}
                  className="min-h-[36px] rounded-full px-3 text-[12px] transition"
                  style={{ background: on ? alpha(RESERVE.gold, 0.14) : "rgba(255,255,255,0.03)", boxShadow: `inset 0 0 0 1px ${on ? alpha(RESERVE.gold, 0.45) : "rgba(255,255,255,0.08)"}`, color: on ? RESERVE.ivory : "rgba(255,255,255,0.7)" }}
                >
                  {step.ratio}{step.food === pick.reserveFood ? " ★" : ""}
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-[10.5px] text-white/35">★ Reserve&apos;s pick · {pick.sources.map((s) => s.label).join(" · ")}</p>
        </div>
      ))}
      {meal.fits.map((fit) => (
        <p key={fit.area} className="mt-1 text-[11.5px] leading-[1.5]" style={{ color: alpha(RESERVE.steel, 0.95) }} data-peak-fit={fit.area}>
          {SUPPORT_AREA_LABEL[fit.area]}: {fit.reason}.{" "}
          {fit.sources.map((src, i) => (
            <span key={src.label} className="text-white/35">{i > 0 ? " · " : ""}{src.url ? <a href={src.url} target="_blank" rel="noreferrer" className="underline decoration-white/20 underline-offset-2">{src.label}</a> : src.label}</span>
          ))}
        </p>
      ))}
      {meal.optional ? (
        /* The optional shake is food only and skippable: its own words, no fruit or carb advice on top. */
        <p className="mt-1 text-[11.5px] leading-[1.5] text-white/55" data-peak-shake>{meal.smartRead}</p>
      ) : (
        <>
          <p className="mt-1 text-[11.5px] leading-[1.5]" style={{ color: meal.fruit.kind === "fast" ? alpha(RESERVE.gold, 0.9) : alpha(RESERVE.green, 0.9) }}>
            Fruit here: {meal.fruit.fruits}. {meal.fruit.why}
          </p>
          {meal.carbNote && <p className="mt-1 text-[11.5px] leading-[1.5] text-white/55">{meal.carbNote}</p>}
        </>
      )}


      {meal.signature && (
        <div className="mt-2 flex flex-col gap-2">
          {meal.purposes.length > 0 && (
            <ReserveDisclosure summary="Why each item" accent={RESERVE.gold}>
              <ul className="flex flex-col gap-1" data-peak-purposes>
                {meal.purposes.map((p) => (
                  <li key={p.item} className="text-[12.5px] leading-[1.5] text-white/70">
                    <span className="font-semibold" style={{ color: RESERVE.ivory }}>{p.item}</span> — {p.why}
                  </li>
                ))}
              </ul>
            </ReserveDisclosure>
          )}
          <ReserveDisclosure summary="Recipe" accent={RESERVE.gold}>
            <ol className="flex list-decimal flex-col gap-1 pl-4 text-[12.5px] leading-[1.55] text-white/70">
              {meal.recipe.map((step) => <li key={step}>{step}</li>)}
            </ol>
          </ReserveDisclosure>
          <div className="flex flex-wrap gap-2">
            {alternatives.length > 0 ? (
              <ReserveButton tier="quiet" size="sm" onClick={() => setSwapping((v) => !v)}>
                {swapping ? "Keep this plate" : "Swap this meal"}
              </ReserveButton>
            ) : (
              <ReserveButton tier="quiet" size="sm" disabled disabledReason="No other plate fits this meal for your look and food answers.">Swap this meal</ReserveButton>
            )}
            {onHide && alternatives.length > 0 && <ReserveButton tier="quiet" size="sm" onClick={onHide}>Never show this plate</ReserveButton>}
          </div>
          {swapping && (
            <ul className="flex flex-col gap-1.5" aria-label={`Swap options for ${meal.windowLabel}`}>
              {alternatives.map((o) => (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSwap(o.id);
                      setSwapping(false);
                    }}
                    className="flex w-full items-baseline justify-between gap-3 rounded-[12px] px-3 py-2.5 text-left transition hover:bg-white/[0.05]"
                    style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08)" }}
                  >
                    <span className="min-w-0">
                      <span className="block text-[13px] font-semibold" style={{ color: RESERVE.ivory }}>{o.name}</span>
                      <span className="block text-[11px] text-white/50">
                        {o.macros.calories} kcal · {o.macros.proteinG}P {o.macros.carbsG}C {o.macros.fatG}F
                        {o.fits.length ? ` · fits ${o.fits.map((f) => SUPPORT_AREA_LABEL[f.area]).join(", ")}` : ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-[11.5px] font-semibold" style={{ color: matchColor(o.match) }}>{o.match}% match</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}

/* ─── This week's menu ──────────────────────────────────────────────────── */

function TheWeeksMenu({
  now,
  todayKey,
  todayMeals,
  trainingWeek,
  buildDay,
  optionsFor,
}: {
  now: Date;
  todayKey: string;
  todayMeals: PeakMeal[];
  trainingWeek: Array<{ sessionName: string; recovery: boolean }>;
  buildDay: (date: string, training: boolean, sessionName: string) => PeakMeal[];
  optionsFor: (meal: PeakMeal, training: boolean) => ReturnType<typeof swapOptions>;
}) {
  const swaps = useAthleteDashboardStore((s) => s.nutritionPrefs.peakSwaps);
  const setNutritionPrefs = useAthleteDashboardStore((s) => s.setNutritionPrefs);

  const days = useMemo<MenuDay[]>(
    () =>
      weekDates(now, trainingWeek).map((d) => {
        const dayMeals = d.date === todayKey ? todayMeals : buildDay(d.date, d.training, d.sessionName);
        return {
          ...d,
          meals: dayMeals
            .filter((m) => m.signature || m.plate)
            .map((m) => ({ key: swapKey(m), label: m.windowLabel, time: m.time, slot: m.slot, choices: menuChoices(optionsFor(m, d.training)) })),
        };
      }),
    [now, trainingWeek, todayKey, todayMeals, buildDay, optionsFor],
  );
  const progress = menuProgress(days, swaps);

  return (
    <WeekMenu
      days={days}
      todayKey={todayKey}
      picked={progress.picked}
      total={progress.total}
      onPick={(date, mealKey, plateId) => setNutritionPrefs({ peakSwaps: pickOne(swaps, date, mealKey, plateId) })}
      onRepeat={(mealKey, plateId) => setNutritionPrefs({ peakSwaps: repeatAcrossWeek(swaps, days, mealKey, plateId) })}
      onClear={() => setNutritionPrefs({ peakSwaps: clearWeek(swaps, days) })}
      onSurprise={() => setNutritionPrefs({ peakSwaps: surpriseWeek(days, swaps, new Date().getDate()) })}
    />
  );
}

/* ─── Tonight, for tomorrow ─────────────────────────────────────────────── */

/**
 * What tonight owes tomorrow: meat out of the freezer and the batch worth
 * cooking once. Read from tomorrow's own plates, so it follows every swap.
 */
function CookingChecklist({
  now,
  todayKey,
  todayMeals,
  trainingWeek,
  buildDay,
}: {
  now: Date;
  todayKey: string;
  todayMeals: PeakMeal[];
  trainingWeek: Array<{ sessionName: string; recovery: boolean }>;
  buildDay: (date: string, training: boolean, sessionName: string) => PeakMeal[];
}) {
  const saved = useAthleteDashboardStore((s) => s.nutritionPrefs.peakPrep ?? null);
  const setNutritionPrefs = useAthleteDashboardStore((s) => s.setNutritionPrefs);

  const tomorrowKey = useMemo(() => localDateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)), [now]);
  const plan = useMemo(() => {
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const day = trainingWeek[(tomorrow.getDay() + 6) % 7];
    const meals = buildDay(tomorrowKey, day ? !day.recovery : false, day?.sessionName ?? "");
    const plates = (list: PeakMeal[]) => list.flatMap((m) => (m.plate ? [{ portions: m.plate.portions, scale: m.scale }] : []));
    return { today: nightBefore(plates(todayMeals)), tonight: nightBefore(plates(meals)) };
  }, [now, tomorrowKey, trainingWeek, buildDay, todayMeals]);

  /* Yesterday's ticks never carry over: the list belongs to the day it was made for. */
  const done = useMemo(() => new Set(saved?.day === todayKey ? saved.done : []), [saved, todayKey]);
  const keys = useMemo(() => prepKeys(plan, todayKey, tomorrowKey), [plan, todayKey, tomorrowKey]);
  const progress = prepProgress(keys, done);
  const toggle = (key: string) => {
    const next = new Set(done);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setNutritionPrefs({ peakPrep: { day: todayKey, done: [...next] } });
  };

  if (keys.length === 0) {
    return (
      <div className="mt-4 border-t border-white/[0.06] pt-3" data-peak-tonight>
        <Whisper color={alpha(RESERVE.steel, 0.9)}>Cooking</Whisper>
        <p className="mt-1 text-[11.5px] text-white/50">Nothing to cook ahead — today and tomorrow both go together fresh.</p>
      </div>
    );
  }

  const group = (title: string, items: typeof plan.today.batch, day: string, kind: "cook" | "thaw" | "batch") =>
    items.length === 0 ? null : (
      <div className="mt-2">
        <p className="text-[12px] font-semibold" style={{ color: RESERVE.ivory }}>{title}</p>
        <ul className="mt-1 flex flex-col">
          {items.map((item) => {
            const key = prepKey(day, kind, item.food);
            const on = done.has(key);
            return (
              <li key={key} data-peak-prep={kind} {...{ [`data-peak-${kind === "cook" ? "today" : kind}`]: item.food }}>
                <label className="flex min-h-[40px] cursor-pointer items-center gap-3 text-[12.5px]">
                  <input type="checkbox" checked={on} onChange={() => toggle(key)} className="h-4 w-4 accent-[#d4b26a]" />
                  <span className={on ? "text-white/40 line-through" : "text-white/75"}>{item.name}</span>
                  <span className="ml-auto shrink-0 text-[11.5px] text-white/50">{item.label}</span>
                </label>
              </li>
            );
          })}
        </ul>
      </div>
    );

  return (
    <div className="mt-4 border-t border-white/[0.06] pt-3" data-peak-tonight>
      <Whisper color={alpha(RESERVE.steel, 0.9)}>Cooking · {progress.done} of {progress.total} done</Whisper>
      <p className="mt-1 text-[11.5px] text-white/50">Tick it off as you go. The list is built from today&apos;s and tomorrow&apos;s own plates, so it follows every swap.</p>
      {group("Cooking today", plan.today.batch, todayKey, "cook")}
      {group("Tonight, out of the freezer", plan.tonight.thaw, tomorrowKey, "thaw")}
      {group("Tonight, worth cooking in one batch", plan.tonight.batch, tomorrowKey, "batch")}
    </div>
  );
}

/* ─── What you already have ─────────────────────────────────────────────── */

const EMPTY_FOODS: PeakFood[] = [];
const EMPTY_BOWLS: CustomBowl[] = [];

/**
 * The member ticks what they actually bought. Plates cook what is on hand
 * before they cook a preference, and the shopping list marks it "have it".
 */
function KitchenStock({ onHand, onChange }: { onHand: readonly PeakFood[]; onChange: (foods: PeakFood[]) => void }) {
  const toggle = (food: PeakFood) => onChange(onHand.includes(food) ? onHand.filter((f) => f !== food) : [...onHand, food]);
  const groups: Array<{ label: string; foods: PeakFood[] }> = [
    { label: "Proteins", foods: PROTEIN_CHOICES.map((c) => c.food) },
    { label: "Carbs", foods: CARB_CHOICES.map((c) => c.food) },
  ];
  return (
    <section aria-label="What you already have" data-peak-stock>
      <Whisper color={alpha(RESERVE.green, 0.9)}>What you already have</Whisper>
      <p className="mt-1 text-[11.5px] leading-[1.5] text-white/45">
        Tick what is in the fridge or freezer. Your plates cook what you have first, and the list marks it off.
      </p>
      {groups.map((group) => (
        <div key={group.label} className="mt-2">
          <p className="text-[11px] uppercase tracking-[0.16em] text-white/45">{group.label}</p>
          <div className="mt-1 flex flex-wrap gap-1.5" role="group" aria-label={`${group.label} you have`}>
            {group.foods.map((food) => {
              const on = onHand.includes(food);
              return (
                <button
                  key={food}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(food)}
                  className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full px-3 text-[12px] transition"
                  style={{ background: on ? alpha(RESERVE.green, 0.14) : "rgba(255,255,255,0.03)", boxShadow: `inset 0 0 0 1px ${on ? alpha(RESERVE.green, 0.45) : "rgba(255,255,255,0.08)"}`, color: on ? RESERVE.ivory : "rgba(255,255,255,0.7)" }}
                >
                  {on && <Check size={12} aria-hidden="true" />}
                  {food.replace(" (dry)", "")}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
}

/* ─── Week and shopping ─────────────────────────────────────────────────── */

function WeekAndShopping({
  now,
  todayKey,
  todayMeals,
  trainingWeek,
  buildDay,
  mealRows,
}: {
  now: Date;
  todayKey: string;
  todayMeals: PeakMeal[];
  trainingWeek: Array<{ sessionName: string; recovery: boolean }>;
  buildDay: (date: string, training: boolean, sessionName: string) => PeakMeal[];
  mealRows: (date: string, meals: PeakMeal[], training: boolean) => React.ReactNode;
}) {
  const shopping = useAthleteDashboardStore((s) => s.nutritionPrefs.peakShopping ?? null);
  const kitchen = useAthleteDashboardStore((s) => s.nutritionPrefs.peakKitchen ?? null);
  const setNutritionPrefs = useAthleteDashboardStore((s) => s.setNutritionPrefs);
  const onHand = useMemo(() => kitchen?.onHand ?? EMPTY_FOODS, [kitchen]);

  const days = useMemo(
    () => weekDates(now, trainingWeek).map((d) => ({ ...d, meals: d.date === todayKey ? todayMeals : buildDay(d.date, d.training, d.sessionName) })),
    [now, trainingWeek, todayKey, todayMeals, buildDay],
  );
  const list = useMemo(
    () =>
      shoppingList(
        days.flatMap((d) => d.meals.flatMap((m) => (m.plate ? [{ portions: m.plate.portions, scale: m.scale }] : []))),
        /* The optional pre-session shake: its own food-only ingredients, once per day it appears. */
        days.flatMap((d) => d.meals.flatMap((m) => (m.optional && !m.plate && m.ingredientsDetailed ? [m.ingredientsDetailed] : []))),
        onHand,
      ),
    [days, onHand],
  );
  const checked = new Set(shopping?.weekStart === todayKey ? shopping.checked : []);
  const toggle = (key: string) => {
    const next = new Set(checked);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setNutritionPrefs({ peakShopping: { weekStart: todayKey, checked: [...next] } });
  };
  const itemCount = list.aisles.reduce((n, a) => n + a.items.length, 0);

  return (
    <div className="flex flex-col gap-5">
      <section aria-label="Peak Mode week">
        <Whisper color={alpha(RESERVE.gold, 0.9)}>The next 7 days</Whisper>
        <ul className="mt-2 flex flex-col divide-y divide-white/[0.05]">
          {days.map((d) => (
            <li key={d.date} className="py-1.5" data-peak-day={d.date}>
              <ReserveDisclosure summary={`${d.date === todayKey ? "Today" : d.weekday} · ${d.training ? d.sessionName || "Training" : "Rest"}`} accent={RESERVE.gold}>
                <p className="text-[12px] leading-[1.5] text-white/60">{d.meals.map((m) => m.name).join(" · ")}</p>
                <ul className="mt-1 flex flex-col divide-y divide-white/[0.05]">{mealRows(d.date, d.meals, d.training)}</ul>
              </ReserveDisclosure>
            </li>
          ))}
        </ul>
        <p className="mt-1 text-[11px] text-white/40">Open a day to swap any of its meals. The shopping list follows every swap.</p>
      </section>

      <KitchenStock onHand={onHand} onChange={(foods) => setNutritionPrefs({ peakKitchen: { carbs: [], proteins: [], avoid: [], answeredAt: new Date().toISOString(), ...(kitchen ?? {}), onHand: foods } })} />

      <section aria-label="Peak Mode shopping list">
        <Whisper color={alpha(RESERVE.gold, 0.9)}>Shopping list · {checked.size} of {itemCount} in the cart</Whisper>
        <p className="mt-1 text-[11.5px] text-white/45">Totals for the 7 days, rounded. Meat and fish are listed raw, and rice, grains and pasta dry, so the list is what you buy.</p>
        <div className="mt-2 flex flex-col gap-3">
          {list.aisles.map((aisle) => (
            <div key={aisle.aisle}>
              <p className="text-[11px] uppercase tracking-[0.16em] text-white/45">{aisle.aisle}</p>
              <ul className="mt-1 flex flex-col">
                {aisle.items.map((item) => {
                  const on = checked.has(item.key);
                  return (
                    <li key={item.key}>
                      <label className="flex min-h-[40px] cursor-pointer items-center gap-3 text-[12.5px]">
                        <input type="checkbox" checked={on} onChange={() => toggle(item.key)} className="h-4 w-4 accent-[#d4b26a]" />
                        <span className={on ? "text-white/40 line-through" : ""} style={on ? undefined : { color: RESERVE.ivory }}>{item.name}</span>
                        <span className="ml-auto text-[11.5px] text-white/50">{item.label}</span>
                        {item.onHand && <span className="shrink-0 text-[10.5px] uppercase tracking-[0.14em]" style={{ color: alpha(RESERVE.green, 0.9) }} data-peak-have>have it</span>}
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          {list.toTaste.length > 0 && <p className="text-[11.5px] leading-[1.5] text-white/50">Pantry, to taste: {list.toTaste.join(", ")}.</p>}
        </div>
      </section>
    </div>
  );
}
