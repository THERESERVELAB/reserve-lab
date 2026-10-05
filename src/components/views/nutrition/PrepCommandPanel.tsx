"use client";

import {
  CheckCircle2,
  ChefHat,
  CookingPot,
  Eraser,
  Flame,
  Leaf,
  ListChecks,
  Moon,
  Repeat2,
  ShoppingCart,
  Snowflake,
  Star,
} from "lucide-react";
import { useMemo, useState } from "react";

import { GlassPanel } from "@/components/ui/GlassPanel";
import { favoriteName, plannedToSignature } from "@/components/views/nutrition/FuelCommandPanel";
import { useAthleteDashboardStore } from "@/lib/athlete-store";
import { resolveMemberBodyweight } from "@/lib/profile/bodyweight";
import {
  buildDailyFuelPlan,
  fuelGoalFromString,
  purposeToSlot,
  type PlanFavoriteInput,
} from "@/lib/nutrition/fuel-plan";
import {
  buildPrepGuidance,
  buildWeeklyGroceryList,
  groupGroceryByCategory,
  PREP_CATEGORY_LABEL,
  type PrepDayInput,
  type PrepStep,
} from "@/lib/nutrition/prep-command";
import { useProtocolWeek } from "@/lib/hooks/useProtocolWeek";
import { personalizationFromPrefs } from "@/lib/nutrition/fuel-personalization";
import { weekDateKeys } from "@/lib/training/split-customization";

const C = {
  GOLD: "#d5b15f",
  IVORY: "#f2eee6",
  STEEL: "#5fb7d5",
  GREEN: "#6ee7b7",
  VIOLET: "#a78bfa",
  AMBER: "#e8c87a",
  SLATE: "#8ea0b8",
};

function StepList({ steps }: { steps: PrepStep[] }) {
  if (!steps.length) return <p className="text-[10.5px] text-white/35">Nothing flagged for this week&apos;s plan.</p>;
  return (
    <div className="space-y-2">
      {steps.map((s) => (
        <div key={s.title} className="border-l border-white/[0.1] pl-2.5">
          <p className="text-[11.5px] font-bold" style={{ color: C.IVORY }}>{s.title}</p>
          <p className="mt-0.5 text-[10px] leading-[1.45] text-white/50">{s.detail}</p>
        </div>
      ))}
    </div>
  );
}

export function PrepCommandPanel() {
  const profile = useAthleteDashboardStore((s) => s.profile);
  const scheduleProfile = useAthleteDashboardStore((s) => s.scheduleProfile);
  const activeProtocol = useAthleteDashboardStore((s) => s.activeProtocol);
  const nutritionPrefs = useAthleteDashboardStore((s) => s.nutritionPrefs);
  const signatureMeals = nutritionPrefs.signatureMeals;
  const addSignatureMeal = useAthleteDashboardStore((s) => s.addSignatureMeal);
  const weighIns = useAthleteDashboardStore((s) => s.physiqueCommand.entries);
  const baselineWeightLb = useAthleteDashboardStore((s) => s.setupProfile.baselineWeightLb);
  /* Real bodyweight or none — the plan discloses a reference estimate when none. */
  const bodyweightLb = useMemo(
    () => resolveMemberBodyweight({ weighIns, baselineWeightLb, profileBodyweightLb: nutritionPrefs.bodyweightLb })?.lb ?? null,
    [weighIns, baselineWeightLb, nutritionPrefs.bodyweightLb],
  );

  /** Consolidated personalization — the one reading every fuel plan uses. */
  const personalization = useMemo(() => personalizationFromPrefs(nutritionPrefs), [nutritionPrefs]);

  const goal = useMemo(() => fuelGoalFromString(activeProtocol?.goal ?? profile.goal), [activeProtocol?.goal, profile.goal]);

  const { week: protocolWeek } = useProtocolWeek();

  const favoriteInputs: PlanFavoriteInput[] = useMemo(
    () => (signatureMeals ?? []).filter((m) => m.favorite).map((m) => ({
      id: m.id,
      name: m.name,
      slot: purposeToSlot(m.purpose),
      macros: m.macros ? { calories: m.macros.calories, proteinG: m.macros.proteinG, carbsG: m.macros.carbsG, fatG: m.macros.fatG } : null,
      ingredients: m.ingredients.map((i) => (i.amount != null && i.unit ? `${i.amount}${i.unit} ${i.name}` : i.name)),
    })),
    [signatureMeals],
  );

  /* The same per-day fuel plans the Weekly Fuel Plan is projected from. */
  const prepDays: PrepDayInput[] = useMemo(() => {
    const week = protocolWeek;
    const windows = scheduleProfile.mealWindows.map((w) => ({ id: w.id, label: w.label, time: w.time, enabled: w.enabled }));
    /* Each day's own rotation (the week runs Monday first), so the list buys what the week serves. */
    const dates = weekDateKeys(new Date());
    return week.map((d, i) => ({
      day: d.day,
      recovery: d.recovery,
      sessionName: d.sessionName,
      meals: buildDailyFuelPlan({
        goal, isTrainingDay: !d.recovery, sessionName: d.sessionName,
        mealWindows: windows, bodyweightLb, favorites: favoriteInputs,
        personalization,
        date: dates[i],
      }).meals,
    }));
  }, [protocolWeek, scheduleProfile.mealWindows, goal, favoriteInputs, personalization, bodyweightLb]);

  const grocery = useMemo(() => buildWeeklyGroceryList(prepDays), [prepDays]);
  const grouped = useMemo(() => groupGroceryByCategory(grocery), [grocery]);
  const guidance = useMemo(() => buildPrepGuidance(prepDays, grocery), [prepDays, grocery]);

  /* Session-local shopping state — permanent purchase records live in
     Grocery Command's purchase log below. */
  const [listBuilt, setListBuilt] = useState(false);
  const [boughtKeys, setBoughtKeys] = useState<string[]>([]);

  const existingFavNames = useMemo(() => new Set((signatureMeals ?? []).map((m) => m.name)), [signatureMeals]);
  const trainingDayCount = prepDays.filter((d) => !d.recovery).length;

  function buildList() {
    setListBuilt(true);
    setBoughtKeys([]);
  }
  function toggleBought(key: string) {
    setBoughtKeys((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  return (
    <GlassPanel accent={C.GOLD} noPad phone="flush" className="md:overflow-hidden">
      <div className="py-4 md:p-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CookingPot size={15} style={{ color: C.GOLD }} />
            <p className="font-mono text-[8.5px] uppercase tracking-[0.24em]" style={{ color: `${C.GOLD}cc` }}>Prep Command</p>
          </div>
          <span className="rounded-full border px-2.5 py-1 font-mono text-[7.5px] uppercase tracking-[0.14em]" style={{ borderColor: `${C.GOLD}40`, color: C.GOLD }}>
            {trainingDayCount} training · {prepDays.length - trainingDayCount} recovery days
          </span>
        </div>
        <h3 className="mt-2.5 text-[18px] font-black leading-tight tracking-tight text-[#f2eee6] sm:text-[21px]">
          Shop once. Prep with intent.
        </h3>
        <p className="mt-1.5 max-w-xl text-[11.5px] leading-[1.5] text-white/50">
          Grocery list and kitchen plan generated from your Weekly Fuel Plan — {grocery.length} items across {grouped.length}{" "}categories. Quantities are shopping estimates from the plan&apos;s own ingredient amounts.
        </p>

        {/* GROCERY LIST */}
        <div className="mt-4">
          {!listBuilt ? (
            <button
              type="button"
              onClick={buildList}
              className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] transition hover:brightness-110"
              style={{ borderColor: `${C.GOLD}55`, background: `linear-gradient(120deg, ${C.GOLD}22, ${C.AMBER}12)`, color: C.AMBER }}
            >
              <ShoppingCart size={13} /> Build Grocery List
            </button>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ListChecks size={13} style={{ color: C.GOLD }} />
                  <p className="font-mono text-[8px] uppercase tracking-[0.18em] text-white/45">Weekly Grocery List · {boughtKeys.length} of {grocery.length} bought</p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button type="button" onClick={buildList}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.1] px-2.5 py-1.5 text-[9.5px] font-semibold text-white/55 transition hover:bg-white/[0.04] hover:text-white/80">
                    <ShoppingCart size={11} /> Rebuild List
                  </button>
                  <button type="button" onClick={() => setBoughtKeys([])} disabled={boughtKeys.length === 0}
                    title={boughtKeys.length === 0 ? "No items marked bought yet" : "Reset all bought marks"}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.1] px-2.5 py-1.5 text-[9.5px] font-semibold text-white/55 transition hover:bg-white/[0.04] hover:text-white/80 disabled:cursor-not-allowed disabled:opacity-35">
                    <Eraser size={11} /> Clear Bought Items
                  </button>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
                {grouped.map((group) => (
                  <div key={group.category} className="border-t border-white/[0.06] pt-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="font-mono text-[8px] uppercase tracking-[0.18em]" style={{ color: `${C.GOLD}bb` }}>{PREP_CATEGORY_LABEL[group.category]}</p>
                      <span className="font-mono text-[7.5px] uppercase tracking-[0.12em] text-white/30">{group.items.length} item{group.items.length === 1 ? "" : "s"}</span>
                    </div>
                    <div className="space-y-1.5">
                      {group.items.map((item) => {
                        const bought = boughtKeys.includes(item.key);
                        return (
                          <div key={item.key} className="flex items-center justify-between gap-2 py-1.5">
                            <div className="min-w-0">
                              <p className={`truncate text-[11.5px] font-semibold ${bought ? "line-through opacity-50" : ""}`} style={{ color: bought ? C.GREEN : C.IVORY }}>{item.name}</p>
                              <p className="mt-0.5 truncate font-mono text-[7.5px] uppercase tracking-[0.1em] text-white/35">
                                {item.quantityEstimate ?? `× ${item.weeklyUses} meal${item.weeklyUses === 1 ? "" : "s"}`} · {item.mealsSupported.slice(0, 2).join(" · ")}{item.mealsSupported.length > 2 ? " +" : ""}
                              </p>
                            </div>
                            <button type="button" onClick={() => toggleBought(item.key)}
                              className="shrink-0 inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[9px] font-semibold transition hover:bg-white/[0.04]"
                              style={{ borderColor: bought ? `${C.GREEN}45` : "rgba(255,255,255,0.12)", color: bought ? C.GREEN : "rgba(255,255,255,0.55)" }}>
                              {bought ? <><CheckCircle2 size={10} />Bought</> : <>Mark Bought</>}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-2 font-mono text-[7.5px] uppercase tracking-[0.12em] text-white/30">
                Checklist resets when you leave this view — log actual purchases in the grocery log for inventory and budget.
              </p>
            </>
          )}
        </div>

        {/* MEAL PREP GUIDANCE */}
        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          <div>
            <div className="mb-2 flex items-center gap-1.5"><ChefHat size={12} style={{ color: C.GOLD }} /><p className="font-mono text-[8px] uppercase tracking-[0.18em]" style={{ color: `${C.GOLD}bb` }}>Cook First</p></div>
            <StepList steps={guidance.cookFirst} />
          </div>
          <div>
            <div className="mb-2 flex items-center gap-1.5"><CookingPot size={12} style={{ color: C.AMBER }} /><p className="font-mono text-[8px] uppercase tracking-[0.18em]" style={{ color: `${C.AMBER}bb` }}>Batch Prep</p></div>
            <StepList steps={guidance.batchPrep} />
          </div>
          <div>
            <div className="mb-2 flex items-center gap-1.5"><Snowflake size={12} style={{ color: C.STEEL }} /><p className="font-mono text-[8px] uppercase tracking-[0.18em]" style={{ color: `${C.STEEL}bb` }}>Keep Fresh</p></div>
            <StepList steps={guidance.keepFresh} />
          </div>
          <div>
            <div className="mb-2 flex items-center gap-1.5"><Flame size={12} style={{ color: C.GOLD }} /><p className="font-mono text-[8px] uppercase tracking-[0.18em]" style={{ color: `${C.GOLD}bb` }}>High-Output Day Prep</p></div>
            <StepList steps={guidance.trainingDayPrep} />
          </div>
          <div>
            <div className="mb-2 flex items-center gap-1.5"><Moon size={12} style={{ color: C.STEEL }} /><p className="font-mono text-[8px] uppercase tracking-[0.18em]" style={{ color: `${C.STEEL}bb` }}>Recovery Day Prep</p></div>
            <StepList steps={guidance.recoveryDayPrep} />
          </div>
          <div>
            <div className="mb-2 flex items-center gap-1.5"><Repeat2 size={12} style={{ color: C.VIOLET }} /><p className="font-mono text-[8px] uppercase tracking-[0.18em]" style={{ color: `${C.VIOLET}bb` }}>Repeat-Friendly Meals</p></div>
            {guidance.repeatable.length ? (
              <div className="space-y-2">
                {guidance.repeatable.map((r) => {
                  const saved = existingFavNames.has(favoriteName(r.meal));
                  return (
                    <div key={r.name} className="border-l border-white/[0.1] pl-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="min-w-0 truncate text-[11.5px] font-bold" style={{ color: C.IVORY }}>{r.name}</p>
                        <span className="shrink-0 rounded border px-1.5 py-0.5 font-mono text-[6.5px] uppercase tracking-[0.1em]" style={{ borderColor: `${C.VIOLET}40`, color: C.VIOLET }}>×{r.count} / week</span>
                      </div>
                      <div className="mt-1.5 flex items-center justify-between gap-2">
                        <p className="text-[9.5px] leading-snug text-white/45">Already repeats in the plan — batch it without losing variety.</p>
                        {saved ? (
                          <span className="inline-flex shrink-0 items-center gap-1 font-mono text-[7.5px] uppercase tracking-[0.12em]" style={{ color: C.VIOLET }}><Star size={9} />Saved</span>
                        ) : (
                          <button type="button" onClick={() => addSignatureMeal(plannedToSignature(r.meal))}
                            className="inline-flex shrink-0 items-center gap-1 rounded-lg border px-2 py-1 text-[9px] font-semibold transition hover:bg-white/[0.04]"
                            style={{ borderColor: `${C.VIOLET}40`, color: C.VIOLET }}>
                            <Star size={10} /> Add to Favorites
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-[10.5px] text-white/35">No meal repeats this week — variety is already high.</p>
            )}
          </div>
        </div>

        <p className="mt-4 flex items-start gap-1.5 text-[9.5px] leading-[1.5] text-white/30">
          <Leaf size={11} className="mt-0.5 shrink-0" />
          Food planning and kitchen logistics only. Quantities are shopping estimates, not intake targets.
        </p>
      </div>
    </GlassPanel>
  );
}
