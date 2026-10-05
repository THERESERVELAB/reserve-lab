"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { BookMarked, Check, ChefHat, Coffee, Pencil, Plus, RotateCw, Star, Trash2, Wrench, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";

import { useAthleteDashboardStore, type NutritionCookingEquipment, type NutritionPrepPreference } from "@/lib/athlete-store";
import { EnhancedRoomContext } from "@/components/enhanced/EnhancedRoomContext";
import { NutritionPhasePanel } from "@/components/women/phase-panels";
import { NutritionRoomHero } from "@/components/nutrition/NutritionRoomHero";
import { NutritionResponseContext } from "@/components/response/NutritionResponseContext";
import { resolveMemberBodyweight } from "@/lib/profile/bodyweight";
import { dietStyleMeta, DIET_STYLES } from "@/lib/nutrition/diet-styles";
import { buildSignatureGroceryItems, INVENTORY_STATUS_LABEL, STORES, type GroceryCategory, type InventoryStatus, type PurchaseLog, type StoreKey } from "@/lib/nutrition/grocery-engine";
import {
  SIGNATURE_PURPOSES, SIGNATURE_INGREDIENT_ROLES, computeSignatureMacros, signatureIngredientSummary,
  type SignatureMeal, type SignatureIngredient, type SignatureMealPurpose, type SignatureIngredientRole,
} from "@/lib/nutrition/signature-meals";
import {
  buildNutritionCommand, goalKeyFromString, scheduleFromPlan,
} from "@/lib/nutrition/adapter";
import { useNutritionAlignment } from "@/lib/nutrition/useNutritionAlignment";
import { DiscardChangesBar, ReserveButton, ReserveCommandHeader, ReserveDetailImage, ReserveDisclosure, ReservePage, ReserveSectionHeader, ReserveSelect, useDirtySnapshot, useFormCloseGuard } from "@/components/ui/reserve";
import { RESERVE } from "@/lib/design/tokens";
import { FavoriteMealsList, FuelCommandPanel, WeeklyFuelPlanList } from "@/components/views/nutrition/FuelCommandPanel";
import { PrepCommandPanel } from "@/components/views/nutrition/PrepCommandPanel";
import { CustomMealsPanel } from "@/components/views/nutrition/CustomMealsPanel";
import { MyMealPlanPanel } from "@/components/views/nutrition/MyMealPlanPanel";
import { HydrationBarPanel } from "@/components/views/nutrition/HydrationBarPanel";
import type { CarnivoreStrictness, DietStyleKey, DayType } from "@/lib/nutrition/types";
import { localDateKey } from "@/lib/dates/local-day";

/* ─── Palette (luxury restraint) ─────────────────── */
const GOLD = "#d5b15f";
const GOLD_BRIGHT = "#e8c87a";
const STEEL = "#5fb7d5";
const TEAL = "#6ee7b7";
const AMBER = "#e8c87a";
const ORANGE = "#ef7d55";
const SOFT = "#f2eee6";

const STATUS_TINT: Record<InventoryStatus, string> = {
  stocked: TEAL, "low-soon": AMBER, "re-up-needed": ORANGE, overbought: STEEL, "unit-review": GOLD, "not-purchased": "rgba(255,255,255,0.4)",
};

const DIET_IDENTITY: Partial<Record<DietStyleKey, string>> = {
  standard: "chicken · beef · fish · eggs · rice · oats · produce",
  "high-protein": "lean protein · moderate carbs + fats",
  "animal-based": "meat · eggs · fish · fruit · honey · dairy if tolerated",
  carnivore: "beef · eggs · fish · seafood · animal fats",
  pescatarian: "fish · seafood · eggs/dairy · plant carbs",
  mediterranean: "lean meat · fish · olive oil · produce · legumes",
  vegetarian: "eggs/dairy · soy · legumes · grains · produce",
  vegan: "tofu · tempeh · legumes · grains · produce",
  paleo: "meat · fish · eggs · produce · nuts",
  keto: "meat · eggs · fats · low-carb produce",
  "low-fat": "lean protein · higher carbs · low fat",
};

const CARNIVORE_STRICTNESS_META: Array<{ key: CarnivoreStrictness; label: string; allowed: string }> = [
  { key: "strict", label: "Strict Carnivore", allowed: "beef · lamb · bison · fish · eggs · animal fats · bone broth · salt" },
  { key: "dairy_allowed", label: "Carnivore + Dairy", allowed: "strict carnivore · butter/ghee · cheese · Greek yogurt · whey" },
  { key: "animal_based_flex", label: "Animal-Based Flex", allowed: "meat · eggs · dairy · fruit · honey · white rice/potatoes if allowed" },
];

function dietIdentityText(dietStyle: DietStyleKey, strictness: CarnivoreStrictness, fallback: string): string {
  if (dietStyle === "carnivore") {
    return CARNIVORE_STRICTNESS_META.find((m) => m.key === strictness)?.allowed ?? DIET_IDENTITY.carnivore ?? fallback;
  }
  return DIET_IDENTITY[dietStyle] ?? fallback;
}

/* ─── Small UI atoms ─────────────────────────────── */
function Chip({ children, accent = "rgba(255,255,255,0.4)", active }: { children: React.ReactNode; accent?: string; active?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-lg px-2 py-1 font-mono text-[8px] uppercase tracking-[0.14em]"
      style={active
        ? { borderColor: `${accent}50`, background: `${accent}14`, color: accent }
        : { borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)", color: "rgba(255,255,255,0.5)" }}>
      {children}
    </span>
  );
}

function Panel({ children, accent = GOLD, className = "" }: { children: React.ReactNode; accent?: string; className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border border-white/[0.08] ${className}`}
      style={{ background: "linear-gradient(168deg, rgba(16,18,24,0.92) 0%, rgba(9,10,15,0.96) 100%)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)" }}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${accent}45, transparent)` }} />
      {children}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   NUTRITION COMMAND
   ════════════════════════════════════════════════════════════════════════ */

export function NutritionView() {
  const profile = useAthleteDashboardStore((s) => s.profile);
  // Single cross-app source of truth — the saved Schedule Command profile drives meal timing.
  const scheduleProfile = useAthleteDashboardStore((s) => s.scheduleProfile);
  const weighIns = useAthleteDashboardStore((s) => s.physiqueCommand.entries);
  const baselineWeightLb = useAthleteDashboardStore((s) => s.setupProfile.baselineWeightLb);

  // Protocol-aligned nutrition truth — the SAME resolution the strategy card and
  // FuelCommandPanel render. The meal plan now follows it so the macros on screen
  // and the food on the plate can never disagree.
  const alignment = useNutritionAlignment();

  // Day-kind bridge: rest / recovery days take rest-day meal structure; every other
  // resolved day-kind trains. Replaces the old "Sunday = rest" guess.
  const dayType: DayType = alignment.dayKind === "rest" || alignment.dayKind === "recovery" ? "rest" : "training";
  // The member's resolved session name. The AI service's plan title (and its old
  // "Batman Chest/Back B" sample on failure) no longer overrides it.
  const trainingSplit = alignment.sessionName ?? "";

  // Daily meal rotation: food selection refreshes day-to-day (the macro target stays
  // fixed by the aligned resolution). The grocery list uses a week-stable seed so it
  // does not churn daily. Resolved once per mount (lazy init) so render stays pure.
  const [{ dayEpoch, weekEpoch }] = useState(() => {
    const day = Math.floor(Date.now() / 86_400_000);
    return { dayEpoch: day, weekEpoch: Math.floor(day / 7) };
  });

  // ── Member preferences — persisted single source of truth ──
  const prefs = useAthleteDashboardStore((s) => s.nutritionPrefs);
  const setNutritionPrefs = useAthleteDashboardStore((s) => s.setNutritionPrefs);
  const addNutritionPurchase = useAthleteDashboardStore((s) => s.addNutritionPurchase);
  const signatureMeals = prefs.signatureMeals as SignatureMeal[];
  const addSignatureMeal = useAthleteDashboardStore((s) => s.addSignatureMeal);
  const updateSignatureMeal = useAthleteDashboardStore((s) => s.updateSignatureMeal);
  const removeSignatureMeal = useAthleteDashboardStore((s) => s.removeSignatureMeal);
  const toggleSignatureMealFavorite = useAthleteDashboardStore((s) => s.toggleSignatureMealFavorite);
  const toggleSignatureMealToday = useAthleteDashboardStore((s) => s.toggleSignatureMealToday);
  const toggleSignatureMealRotation = useAthleteDashboardStore((s) => s.toggleSignatureMealRotation);

  const dietStyle = prefs.dietStyle as DietStyleKey;
  const carnivoreStrictness = (prefs.carnivoreStrictness ?? "strict") as CarnivoreStrictness;
  // The member's real bodyweight, resolved exactly as the fuel log does. With none, the
  // macro engine uses the disclosed 185 lb reference and says so in the basis line.
  const bodyweight = useMemo(
    () => resolveMemberBodyweight({ weighIns, baselineWeightLb, profileBodyweightLb: prefs.bodyweightLb })?.lb ?? null,
    [weighIns, baselineWeightLb, prefs.bodyweightLb],
  );
  const dislikedFoods = prefs.dislikedFoods;
  const favoriteFoods = prefs.favoriteFoods;
  const loggedMealIds = prefs.loggedMealIds;
  const purchases = prefs.purchases as unknown as PurchaseLog[];

  const [groceryTab, setGroceryTab] = useState<"this-week" | "purchased" | "inventory" | "restock" | "budget">("this-week");
  const [purchaseDraft, setPurchaseDraft] = useState<{ name: string; category: PurchaseLog["category"] } | null>(null);
  const [showDietPicker, setShowDietPicker] = useState(false);
  const [showMealPrefs, setShowMealPrefs] = useState(false);
  const [proteinInput, setProteinInput] = useState("");
  const [carbInput, setCarbInput] = useState("");
  const [allergyInput, setAllergyInput] = useState("");
  const [sigEditor, setSigEditor] = useState<{ mode: "create" | "edit"; meal: SignatureMeal | null } | null>(null);

  const goal = goalKeyFromString(profile.goal);
  const schedule = useMemo(() => scheduleFromPlan({
    wakeTime: scheduleProfile.wakeTime,
    sleepTime: scheduleProfile.sleepTarget,
    workoutTime: scheduleProfile.preferredTrainingStart,
  }, dayType), [scheduleProfile.wakeTime, scheduleProfile.sleepTarget, scheduleProfile.preferredTrainingStart, dayType]);

  const state = useMemo(() => buildNutritionCommand({
    dayType, goal, bodyweightLb: bodyweight, dietStyle, carnivoreStrictness, schedule, trainingSplit,
    dislikedFoods, favoriteFoods, excludedFoods: prefs.excludedFoods, allergies: prefs.allergies,
    appetiteLevel: prefs.appetiteLevel, loggedMealIds,
    // Aligned protocol macro target drives the meal plan (and, via remainingMacros,
    // the rescue). null → graceful fallback to the bodyweight/goal estimate.
    macroTargetOverride: alignment.todayMacros ?? undefined,
    rotationSeed: dayEpoch, weekRotationSeed: weekEpoch,
    storePrefs: { preferredStores: prefs.preferredStores as never, qualityPreferences: prefs.qualityPreferences as never },
    beverages: { preferredCaffeineStyle: prefs.caffeineStyle as never, dairyAllowed: prefs.dairyAllowed },
    purchases, signatureMeals,
  }), [dayType, goal, bodyweight, dietStyle, carnivoreStrictness, schedule, trainingSplit, dislikedFoods, favoriteFoods, loggedMealIds, purchases, signatureMeals, prefs.excludedFoods, prefs.allergies, prefs.appetiteLevel, prefs.preferredStores, prefs.qualityPreferences, prefs.caffeineStyle, prefs.dairyAllowed, alignment.todayMacros, dayEpoch, weekEpoch]);

  const { grocery, inventory, budget } = state;

  const styleMeta = dietStyleMeta(dietStyle);
  const customMealCount = useAthleteDashboardStore((s) => s.customMeals.length);

  // ── New preference accessors (typed from store) ──────────────────────────
  const favoriteProteinSources = prefs.favoriteProteinSources ?? [];
  const favoriteCarbSources = prefs.favoriteCarbSources ?? [];
  const allergies = prefs.allergies ?? [];
  const prepPreference: NutritionPrepPreference = prefs.prepPreference ?? "cook-fresh";
  const cookingEquipment: NutritionCookingEquipment[] = prefs.cookingEquipment ?? [];
  const groceryBudgetLevel = prefs.groceryBudgetLevel ?? "standard";
  const mealWindowCount = scheduleProfile.mealWindows.filter((w) => w.enabled).length;

  function addProteinSource(value: string) {
    const clean = value.trim().toLowerCase();
    if (!clean || favoriteProteinSources.some((x) => x.toLowerCase() === clean)) return;
    setNutritionPrefs({ favoriteProteinSources: [...favoriteProteinSources, clean] });
  }
  function removeProteinSource(value: string) {
    setNutritionPrefs({ favoriteProteinSources: favoriteProteinSources.filter((x) => x !== value) });
  }
  function addCarbSource(value: string) {
    const clean = value.trim().toLowerCase();
    if (!clean || favoriteCarbSources.some((x) => x.toLowerCase() === clean)) return;
    setNutritionPrefs({ favoriteCarbSources: [...favoriteCarbSources, clean] });
  }
  function removeCarbSource(value: string) {
    setNutritionPrefs({ favoriteCarbSources: favoriteCarbSources.filter((x) => x !== value) });
  }
  function addAllergy(value: string) {
    const clean = value.trim().toLowerCase();
    if (!clean || allergies.some((x) => x.toLowerCase() === clean)) return;
    setNutritionPrefs({ allergies: [...allergies, clean] });
  }
  function removeAllergy(value: string) {
    setNutritionPrefs({ allergies: allergies.filter((x) => x !== value) });
  }
  function toggleEquipment(eq: NutritionCookingEquipment) {
    const next = cookingEquipment.includes(eq)
      ? cookingEquipment.filter((e) => e !== eq)
      : [...cookingEquipment, eq];
    setNutritionPrefs({ cookingEquipment: next });
  }

  return (
    <ReservePage>
      <ReserveCommandHeader
        whisper="Fuel"
        hero="Nutrition Command"
        /* The room hero carries the statement: on phones this is a title line. */
        phone="title"
        command={alignment.protocolName ? `${alignment.dayLabel} · ${alignment.protocolName}` : alignment.dayLabel}
        /* Nutrition's Bible lead is green. */
        accent={RESERVE.green}
      />

      {/* The room's first screen (Bible §11): the meal that is due, the one gold
          action, the two honest reads with the lines that set today's targets,
          and today's fuel horizon toward sleep lock. */}
      <NutritionRoomHero />
      {/* A logged meal lands through the shell's one LogMomentHost. */}

      {/* The member's own lab checkpoints and report flags — only when they logged a cycle or compound. */}
      <EnhancedRoomContext room="nutrition" />

      {/* The days she logged meals, sorted by estimated phase beside the
          cravings she noted. Renders nothing without a logged period start.
          Replaces the separate Women's Nutrition room. */}
      <NutritionPhasePanel />

      {/* The dominant region: today's meals as a timeline of rows. */}
      <FuelCommandPanel />

      <NutritionResponseContext />

      {/* ── Week & prep: planning tools, not today. One band, one line, one disclosure. ── */}
      <section aria-label="Week and prep" data-nutrition="week-prep" className="flex flex-col gap-3">
        <ReserveSectionHeader label="Week & prep" accent={RESERVE.gold} />
        <ReserveDetailImage id="fuel-prep" className="rounded-[14px] md:rounded-[18px]" />
        <p className="text-[12.5px] leading-[1.5] text-white/60">
          {signatureMeals.length + customMealCount} saved meal{signatureMeals.length + customMealCount === 1 ? "" : "s"} · {styleMeta.label} · {mealWindowCount} meal window{mealWindowCount === 1 ? "" : "s"} from your schedule
        </p>
        <ReserveDisclosure summary="Your own plan, the week, groceries, your meals and hydration" accent={RESERVE.gold}>
          <div className="flex flex-col gap-5">
            {/* First: the plan that replaces the generated one. Everything below
                it is the generated day's planning support. */}
            <MyMealPlanPanel />
            <WeeklyFuelPlanList />
            <PrepCommandPanel />
            <FavoriteMealsList />

            {/* ── Signature meals ── */}
      <section id="signature-meals">
        <div className="mb-3 flex items-center justify-between">
          <span className="font-mono text-[8.5px] uppercase tracking-[0.2em] text-white/35">Your signature meals</span>
          <button type="button" onClick={() => setSigEditor({ mode: "create", meal: null })}
            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-mono text-[8px] uppercase tracking-[0.16em] transition hover:brightness-110"
            style={{ borderColor: `${GOLD}45`, background: `${GOLD}10`, color: GOLD }}>
            <Plus size={11} /> Add Custom Meal
          </button>
        </div>
        {signatureMeals.length === 0 ? (
          /* ── Signature Meals empty state ────────────────────────────────── */
          <div className="relative overflow-hidden rounded-2xl text-center" style={{ borderColor: `${GOLD}28`, background: `linear-gradient(165deg, ${GOLD}0a 0%, rgba(9,10,15,0.6) 100%)` }}>
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${GOLD}55, transparent)` }} />
            <div className="px-6 py-8">
              <span className="mx-auto grid h-11 w-11 place-items-center rounded-2xl" style={{ borderColor: `${GOLD}33`, background: `${GOLD}12`, color: GOLD }}>
                <BookMarked size={20} />
              </span>
              <h3 className="mt-4 text-[15px] font-black uppercase tracking-tight text-[#f2eee6]">Build Your Meal Library</h3>
              <p className="mx-auto mt-2 max-w-xs text-[11.5px] leading-[1.6] text-white/45">
                Save the meals you actually eat — they power your macros, grocery list, restock forecast, and weekly rotation.
              </p>
              <div className="mt-4 flex justify-center">
                <ReserveButton tier="secondary" size="sm" icon={Plus} onClick={() => setSigEditor({ mode: "create", meal: null })}>
                  Add Your First Meal
                </ReserveButton>
              </div>
              <p className="mx-auto mt-3 font-mono text-[8px] uppercase leading-[1.5] tracking-[0.12em] text-white/25">
                Macros, ingredients, store preference — all yours
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {signatureMeals.map((m) => (
              <SignatureMealCard key={m.id} meal={m} storePrefs={{ preferredStores: prefs.preferredStores as never, qualityPreferences: prefs.qualityPreferences as never }}
                onAddToday={() => toggleSignatureMealToday(m.id)}
                onRotation={() => toggleSignatureMealRotation(m.id)}
                onFavorite={() => toggleSignatureMealFavorite(m.id)}
                onEdit={() => setSigEditor({ mode: "edit", meal: m })}
                onRemove={() => removeSignatureMeal(m.id)} />
            ))}
          </div>
        )}
      </section>

            <CustomMealsPanel />
            <HydrationBarPanel />

            {/* ── Food rules ── */}
      <section className="flex flex-col gap-3">
        <Panel accent={GOLD} className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="font-mono text-[8px] uppercase tracking-[0.22em]" style={{ color: `${GOLD}b0` }}>Diet Style</p>
              <h3 className="font-display mt-1 text-[18px] font-bold" style={{ color: SOFT }}>
                {styleMeta.label}
                {dietStyle === "carnivore" && (
                  <span className="text-white/40"> · {CARNIVORE_STRICTNESS_META.find((m) => m.key === carnivoreStrictness)?.label}</span>
                )}
              </h3>
              <p className="mt-1 text-[10.5px] text-white/45">Allowed · {dietIdentityText(dietStyle, carnivoreStrictness, styleMeta.blurb)}</p>
              {(dietStyle === "halal" || dietStyle === "kosher") && (
                <p className="mt-1.5 font-mono text-[9px]" style={{ color: `${AMBER}cc` }}>Certification preference can be refined in Food Rules.</p>
              )}
              {dietStyle === "custom" && (
                <p className="mt-1.5 font-mono text-[9px]" style={{ color: `${AMBER}cc` }}>Custom food rules drive this plan — add allowed and excluded foods in Food Rules.</p>
              )}
              {dislikedFoods.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <span className="font-mono text-[7px] uppercase tracking-[0.18em] text-white/30">Avoiding</span>
                  {dislikedFoods.map((d) => <Chip key={d} accent={ORANGE}>{d}</Chip>)}
                </div>
              )}
              {favoriteFoods.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="font-mono text-[7px] uppercase tracking-[0.18em] text-white/30">Favorites</span>
                  {favoriteFoods.map((d) => <Chip key={d} accent={TEAL}>{d}</Chip>)}
                </div>
              )}
              {/* Was a fixed "Iced coffee · almond milk" for every member; now the member's own beverage preferences. */}
              {prefs.caffeineStyle && (
                <div className="mt-3 flex items-center gap-2">
                  <Coffee size={11} style={{ color: `${STEEL}b0` }} />
                  <span className="text-[10px] capitalize text-white/45">{prefs.caffeineStyle.replace(/-/g, " ")}{prefs.dairyAllowed ? "" : " · no dairy"}</span>
                </div>
              )}
            </div>
            <button type="button" onClick={() => setShowDietPicker((v) => !v)}
              className="flex-shrink-0 rounded-xl border px-3 py-2 font-mono text-[8.5px] uppercase tracking-[0.16em] transition hover:brightness-110"
              style={{ borderColor: `${GOLD}40`, background: `${GOLD}10`, color: GOLD }}>
              {showDietPicker ? "Done" : "Edit Food Rules"}
            </button>
          </div>
          <AnimatePresence>
            {showDietPicker && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                className="mt-4 overflow-hidden border-t border-white/[0.06] pt-4">
                <p className="mb-2 font-mono text-[7.5px] uppercase tracking-[0.2em] text-white/30">Choose diet style</p>
                <div className="flex flex-wrap gap-1.5">
                  {DIET_STYLES.map((d) => (
                    <button key={d.key} type="button" onClick={() => setNutritionPrefs({ dietStyle: d.key })}>
                      <Chip accent={GOLD} active={d.key === dietStyle}>{d.label}</Chip>
                    </button>
                  ))}
                </div>
                {dietStyle === "carnivore" && (
                  <div className="mt-4 border-t border-white/[0.06] pt-4">
                    <p className="mb-2 font-mono text-[7.5px] uppercase tracking-[0.2em] text-white/30">Carnivore strictness</p>
                    <div className="flex flex-wrap gap-1.5">
                      {CARNIVORE_STRICTNESS_META.map((m) => (
                        <button key={m.key} type="button" onClick={() => setNutritionPrefs({ carnivoreStrictness: m.key })}>
                          <Chip accent={GOLD_BRIGHT} active={m.key === carnivoreStrictness}>{m.label}</Chip>
                        </button>
                      ))}
                    </div>
                    <p className="mt-2 text-[9.5px] text-white/40">{CARNIVORE_STRICTNESS_META.find((m) => m.key === carnivoreStrictness)?.allowed}</p>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </Panel>

        {/* ── Meal Personalization panel ─────────────────────────────────────── */}
        <Panel accent={GOLD} className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <ChefHat size={12} style={{ color: `${GOLD}b0` }} />
                <p className="font-mono text-[8px] uppercase tracking-[0.22em]" style={{ color: `${GOLD}b0` }}>Meal Personalization</p>
              </div>
              {/* Status chips row */}
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {favoriteProteinSources.length > 0 && (
                  <Chip accent={TEAL} active>{favoriteProteinSources.length} protein pick{favoriteProteinSources.length === 1 ? "" : "s"}</Chip>
                )}
                {favoriteCarbSources.length > 0 && (
                  <Chip accent={STEEL} active>{favoriteCarbSources.length} carb pick{favoriteCarbSources.length === 1 ? "" : "s"}</Chip>
                )}
                {allergies.length > 0 && (
                  <Chip accent={ORANGE} active>{allergies.length} food{allergies.length === 1 ? "" : "s"} you avoid</Chip>
                )}
                <Chip accent={GOLD} active>{prepPreference === "low-prep" ? "Low-prep" : prepPreference === "batch" ? "Batch prep" : "Cook fresh"}</Chip>
                <Chip accent={GOLD_BRIGHT} active>{cookingEquipment.length || "all"} equipment</Chip>
                <Chip accent={STEEL} active>{groceryBudgetLevel} budget</Chip>
                <span className="font-mono text-[7px] uppercase tracking-[0.18em] text-white/28">· {mealWindowCount} meal window{mealWindowCount === 1 ? "" : "s"} from your schedule</span>
              </div>
            </div>
            <button type="button" onClick={() => setShowMealPrefs((v) => !v)}
              className="flex-shrink-0 rounded-xl border px-3 py-2 font-mono text-[8.5px] uppercase tracking-[0.16em] transition hover:brightness-110"
              style={{ borderColor: `${GOLD}40`, background: `${GOLD}10`, color: GOLD }}>
              {showMealPrefs ? "Done" : "Edit"}
            </button>
          </div>
          <AnimatePresence>
            {showMealPrefs && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                className="mt-4 overflow-hidden border-t border-white/[0.06] pt-4">

                {/* Allergies & restrictions */}
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-1.5">
                    <p className="font-mono text-[7.5px] uppercase tracking-[0.2em] text-white/30">Allergies &amp; foods you avoid</p>
                  </div>
                  <p className="mb-2 text-[9.5px] text-white/35">These are foods you&apos;ve listed as ones you avoid — not medical advice. Review any concerns with a qualified clinician.</p>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {allergies.map((a) => (
                      <button key={a} type="button" onClick={() => removeAllergy(a)}
                        className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 font-mono text-[7.5px] uppercase tracking-[0.12em] transition hover:brightness-110"
                        style={{ borderColor: `${ORANGE}45`, background: `${ORANGE}10`, color: ORANGE }}>
                        {a} <X size={9} />
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input value={allergyInput} onChange={(e) => setAllergyInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { addAllergy(allergyInput); setAllergyInput(""); } }}
                      placeholder="e.g. shellfish, peanuts…" className="min-w-0 flex-1 rounded-lg border border-white/[0.12] bg-white/[0.03] px-3 py-1.5 text-[11px] text-white/80 placeholder:text-white/25 focus:border-white/[0.22] focus:outline-none" />
                    <button type="button" onClick={() => { addAllergy(allergyInput); setAllergyInput(""); }}
                      className="rounded-lg border px-3 py-1.5 font-mono text-[8px] uppercase tracking-[0.14em] transition hover:brightness-110"
                      style={{ borderColor: `${ORANGE}40`, background: `${ORANGE}0c`, color: ORANGE }}>Add</button>
                  </div>
                </div>

                {/* Favourite protein sources */}
                <div className="mb-4 border-t border-white/[0.06] pt-4">
                  <p className="mb-1.5 font-mono text-[7.5px] uppercase tracking-[0.2em] text-white/30">Preferred protein sources</p>
                  <p className="mb-2 text-[9.5px] text-white/35">Meals containing these sources are prioritised in your fuel plan.</p>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {favoriteProteinSources.map((src) => (
                      <button key={src} type="button" onClick={() => removeProteinSource(src)}
                        className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 font-mono text-[7.5px] uppercase tracking-[0.12em] transition hover:brightness-110"
                        style={{ borderColor: `${TEAL}45`, background: `${TEAL}10`, color: TEAL }}>
                        {src} <X size={9} />
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input value={proteinInput} onChange={(e) => setProteinInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { addProteinSource(proteinInput); setProteinInput(""); } }}
                      placeholder="e.g. salmon, eggs, chicken…" className="min-w-0 flex-1 rounded-lg border border-white/[0.12] bg-white/[0.03] px-3 py-1.5 text-[11px] text-white/80 placeholder:text-white/25 focus:border-white/[0.22] focus:outline-none" />
                    <button type="button" onClick={() => { addProteinSource(proteinInput); setProteinInput(""); }}
                      className="rounded-lg border px-3 py-1.5 font-mono text-[8px] uppercase tracking-[0.14em] transition hover:brightness-110"
                      style={{ borderColor: `${TEAL}40`, background: `${TEAL}0c`, color: TEAL }}>Add</button>
                  </div>
                </div>

                {/* Favourite carb sources */}
                <div className="mb-4 border-t border-white/[0.06] pt-4">
                  <p className="mb-1.5 font-mono text-[7.5px] uppercase tracking-[0.2em] text-white/30">Preferred carb sources</p>
                  <p className="mb-2 text-[9.5px] text-white/35">Meals containing these carbs are prioritised in your fuel plan.</p>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {favoriteCarbSources.map((src) => (
                      <button key={src} type="button" onClick={() => removeCarbSource(src)}
                        className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 font-mono text-[7.5px] uppercase tracking-[0.12em] transition hover:brightness-110"
                        style={{ borderColor: `${STEEL}45`, background: `${STEEL}10`, color: STEEL }}>
                        {src} <X size={9} />
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input value={carbInput} onChange={(e) => setCarbInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { addCarbSource(carbInput); setCarbInput(""); } }}
                      placeholder="e.g. rice, sweet potato, oats…" className="min-w-0 flex-1 rounded-lg border border-white/[0.12] bg-white/[0.03] px-3 py-1.5 text-[11px] text-white/80 placeholder:text-white/25 focus:border-white/[0.22] focus:outline-none" />
                    <button type="button" onClick={() => { addCarbSource(carbInput); setCarbInput(""); }}
                      className="rounded-lg border px-3 py-1.5 font-mono text-[8px] uppercase tracking-[0.14em] transition hover:brightness-110"
                      style={{ borderColor: `${STEEL}40`, background: `${STEEL}0c`, color: STEEL }}>Add</button>
                  </div>
                </div>

                {/* Meal prep preference */}
                <div className="mb-4 border-t border-white/[0.06] pt-4">
                  <p className="mb-2 font-mono text-[7.5px] uppercase tracking-[0.2em] text-white/30">Meal prep preference</p>
                  <div className="flex flex-wrap gap-1.5">
                    {([
                      ["cook-fresh", "Cook Fresh", "Cooked per meal or same day"],
                      ["batch", "Batch Prep", "Cook once, eat across the week"],
                      ["low-prep", "Low-Prep", "Assemble-only, no-cook preferred"],
                    ] as [NutritionPrepPreference, string, string][]).map(([key, label, desc]) => (
                      <button key={key} type="button" onClick={() => setNutritionPrefs({ prepPreference: key })}
                        className="flex flex-col rounded-xl border px-3 py-2 text-left transition hover:brightness-110"
                        style={prepPreference === key
                          ? { borderColor: `${GOLD}50`, background: `${GOLD}12`, color: GOLD }
                          : { borderColor: "rgba(255,255,255,0.07)", background: "transparent", color: "rgba(255,255,255,0.45)" }}>
                        <span className="font-mono text-[8px] uppercase tracking-[0.14em]">{label}</span>
                        <span className="mt-0.5 text-[9px] text-white/35">{desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Cooking equipment */}
                <div className="mb-4 border-t border-white/[0.06] pt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Wrench size={10} style={{ color: "rgba(255,255,255,0.3)" }} />
                    <p className="font-mono text-[7.5px] uppercase tracking-[0.2em] text-white/30">Cooking equipment</p>
                  </div>
                  <p className="mb-2 text-[9.5px] text-white/35">Meals requiring equipment you don&apos;t have are excluded from suggestions when no other prep method is available.</p>
                  <div className="flex flex-wrap gap-1.5">
                    {([
                      ["stovetop", "Stovetop / Pan"],
                      ["oven", "Oven / Roast"],
                      ["grill", "Grill"],
                      ["air-fryer", "Air Fryer"],
                      ["microwave", "Microwave"],
                      ["slow-cooker", "Slow Cooker"],
                    ] as [NutritionCookingEquipment, string][]).map(([eq, label]) => (
                      <button key={eq} type="button" onClick={() => toggleEquipment(eq)}
                        className="rounded-lg border px-3 py-1.5 font-mono text-[8px] uppercase tracking-[0.14em] transition hover:brightness-110"
                        style={cookingEquipment.includes(eq)
                          ? { borderColor: `${GOLD}50`, background: `${GOLD}12`, color: GOLD }
                          : { borderColor: "rgba(255,255,255,0.07)", background: "transparent", color: "rgba(255,255,255,0.4)" }}>
                        {label}
                      </button>
                    ))}
                  </div>
                  {cookingEquipment.length === 0 && (
                    <p className="mt-1.5 font-mono text-[7.5px] text-white/25">No selection = all methods available.</p>
                  )}
                </div>

                {/* Budget & meal count */}
                <div className="border-t border-white/[0.06] pt-4">
                  <p className="mb-2 font-mono text-[7.5px] uppercase tracking-[0.2em] text-white/30">Grocery budget</p>
                  <div className="flex flex-wrap gap-1.5">
                    {([
                      ["lean", "Lean", "Budget-conscious — staples + basics"],
                      ["standard", "Balanced", "Balanced quality and cost"],
                      ["premium", "Premium", "Whole Foods-tier, quality-first"],
                    ] as ["lean" | "standard" | "premium", string, string][]).map(([key, label, desc]) => (
                      <button key={key} type="button" onClick={() => setNutritionPrefs({ groceryBudgetLevel: key })}
                        className="flex flex-col rounded-xl border px-3 py-2 text-left transition hover:brightness-110"
                        style={groceryBudgetLevel === key
                          ? { borderColor: `${GOLD}50`, background: `${GOLD}12`, color: GOLD }
                          : { borderColor: "rgba(255,255,255,0.07)", background: "transparent", color: "rgba(255,255,255,0.45)" }}>
                        <span className="font-mono text-[8px] uppercase tracking-[0.14em]">{label}</span>
                        <span className="mt-0.5 text-[9px] text-white/35">{desc}</span>
                      </button>
                    ))}
                  </div>
                  <p className="mt-3 text-[9.5px] text-white/35">
                    <span style={{ color: `${GOLD}80` }}>Meal window count</span>{" "}is controlled by your{" "}
                    <span className="font-mono text-[7.5px] uppercase tracking-[0.12em] text-white/45">Daily Schedule</span>{" "}
                    ({mealWindowCount} enabled window{mealWindowCount === 1 ? "" : "s"}) — adjust there to change how many meals appear in your plan.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </Panel>
      </section>

            {/* ── Grocery log ── */}
      <section id="grocery-command">
        <Panel accent={GOLD}>
          <div className="flex flex-wrap gap-1.5 border-b border-white/[0.06] p-3">
            {([["this-week", "This Week"], ["purchased", "Purchased"], ["inventory", "Inventory"], ["restock", "Restock"], ["budget", "Budget"]] as const).map(([key, label]) => (
              <button key={key} type="button" onClick={() => setGroceryTab(key)}
                className="rounded-lg border px-3 py-1.5 font-mono text-[8px] uppercase tracking-[0.16em] transition"
                style={groceryTab === key
                  ? { borderColor: `${GOLD}45`, background: `${GOLD}12`, color: GOLD }
                  : { borderColor: "rgba(255,255,255,0.07)", background: "transparent", color: "rgba(255,255,255,0.4)" }}>
                {label}
              </button>
            ))}
          </div>

          <div className="p-4">
            {groceryTab === "this-week" && (
              <div className="flex flex-col divide-y divide-white/[0.05]">
                {grocery.map((g) => (
                  <div key={g.id} className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11.5px] font-medium" style={{ color: SOFT }}>{g.name}</p>
                      <p className="truncate font-mono text-[8px] uppercase tracking-[0.14em] text-white/35">
                        {g.category} · supports {g.mealsSupported.length} meal{g.mealsSupported.length === 1 ? "" : "s"} · {g.weeklyUses}×/wk
                      </p>
                    </div>
                    <span className="tnum font-mono text-[9px] text-white/45">{g.quantityNeeded}{g.unit}</span>
                    {g.qualityNote && <Chip accent={STEEL}>{g.qualityNote}</Chip>}
                    <span className="tnum font-mono text-[10px] font-semibold" style={{ color: GOLD }}>${g.estimatedCost.toFixed(2)}</span>
                    <button type="button" onClick={() => setPurchaseDraft({ name: g.name, category: g.category })}
                      className="flex-shrink-0 rounded-md border px-2 py-1 font-mono text-[7.5px] uppercase tracking-[0.14em] transition hover:brightness-110"
                      style={{ borderColor: `${GOLD}35`, background: `${GOLD}0c`, color: `${GOLD}cc` }}>Log</button>
                  </div>
                ))}
              </div>
            )}

            {groceryTab === "purchased" && (
              purchases.length === 0
                ? <EmptyLine>Log purchases to activate restock forecasting.</EmptyLine>
                : <div className="flex flex-col divide-y divide-white/[0.05]">
                    {purchases.map((p) => (
                      <div key={p.id} className="flex items-center gap-3 py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[11.5px] font-medium" style={{ color: SOFT }}>{p.itemName}</p>
                          <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-white/35">{STORES.find((s) => s.key === p.store)?.label ?? p.store} · {p.purchaseDate}</p>
                        </div>
                        <span className="tnum font-mono text-[9px] text-white/45">{p.quantityPurchased}{p.unit}</span>
                        <span className="tnum font-mono text-[10px] font-semibold" style={{ color: GOLD }}>${p.pricePaid.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
            )}

            {groceryTab === "inventory" && (
              <div className="grid gap-2 sm:grid-cols-2">
                {inventory.map((inv) => (
                  <div key={inv.itemName} className="rounded-xl bg-white/[0.02] px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-[11px] font-medium" style={{ color: SOFT }}>{inv.itemName}</p>
                      <Chip accent={STATUS_TINT[inv.status]} active>{INVENTORY_STATUS_LABEL[inv.status]}</Chip>
                    </div>
                    <p className="mt-1 text-[9px] text-white/40">{inv.note}</p>
                  </div>
                ))}
              </div>
            )}

            {groceryTab === "restock" && (
              <div className="grid gap-2 sm:grid-cols-2">
                {inventory.filter((i) => i.status !== "stocked").length === 0
                  ? <EmptyLine>Everything is stocked for this week.</EmptyLine>
                  : inventory.filter((i) => i.status !== "stocked").map((inv) => (
                    <div key={inv.itemName} className="rounded-xl px-3 py-2.5" style={{ borderColor: `${STATUS_TINT[inv.status]}24`, background: `${STATUS_TINT[inv.status]}08` }}>
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-[11px] font-medium" style={{ color: SOFT }}>{inv.itemName}</p>
                        <Chip accent={STATUS_TINT[inv.status]} active>{INVENTORY_STATUS_LABEL[inv.status]}</Chip>
                      </div>
                      <p className="mt-1 text-[9px] text-white/45">{inv.restockEstimate} · {inv.note}</p>
                    </div>
                  ))}
              </div>
            )}

            {groceryTab === "budget" && (
              <div className="grid gap-3 sm:grid-cols-3">
                <BudgetCard label="Projected" value={budget.estimatedTotal} accent={GOLD} />
                <BudgetCard label="Actual Spent" value={budget.actualSpent} accent={TEAL} />
                <BudgetCard label="Per Day" value={budget.costPerDay ?? 0} accent={STEEL} />
              </div>
            )}
          </div>
        </Panel>
      </section>
          </div>
        </ReserveDisclosure>
      </section>

      <footer className="px-1 pb-2">
        <p className="text-[11px] leading-5 text-white/45">
          Estimated nutrition targets and meal organization only. Reserve does not provide medical advice.
        </p>
      </footer>

      {/* ── DRAWERS ── */}
      <AnimatePresence>
        {purchaseDraft && (
          <PurchaseDrawer key="purchase" draft={purchaseDraft}
            onClose={() => setPurchaseDraft(null)}
            onSubmit={(p) => { addNutritionPurchase(p); setPurchaseDraft(null); setGroceryTab("inventory"); }} />
        )}
        {sigEditor && (
          <SignatureMealDrawer key="sig-editor" mode={sigEditor.mode} initial={sigEditor.meal}
            onClose={() => setSigEditor(null)}
            onSave={(meal) => {
              if (sigEditor.mode === "edit" && sigEditor.meal) updateSignatureMeal(sigEditor.meal.id, meal);
              else addSignatureMeal(meal);
              setSigEditor(null);
            }} />
        )}
      </AnimatePresence>
    </ReservePage>
  );
}

/* ─── Purchase drawer ────────────────────────────── */
function PurchaseDrawer({ draft, onClose, onSubmit }: {
  draft: { name: string; category: PurchaseLog["category"] };
  onClose: () => void; onSubmit: (p: PurchaseLog) => void;
}) {
  const [qty, setQty] = useState("1");
  const [unit, setUnit] = useState("lb");
  const [store, setStore] = useState<StoreKey>("whole-foods");
  const [price, setPrice] = useState("");
  const guard = useFormCloseGuard(useDirtySnapshot({ qty, unit, store, price }), onClose, { backdropClosesWhenClean: true });

  function submit() {
    onSubmit({
      id: `p-${Date.now()}`, itemName: draft.name, category: draft.category,
      quantityPurchased: parseFloat(qty) || 0, unit, store, pricePaid: parseFloat(price) || 0,
      purchaseDate: localDateKey(),
    });
  }

  const field = "w-full rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 py-2 text-[12px] text-white/80 outline-none focus:border-white/30";
  return (
    <>
      {/* Fades in with CSS, not presence-tracked — an animated backdrop is a
          second exit that can stall and strand the overlay. */}
      <div className="fba-scrim-in fixed inset-0 z-40 bg-black/50" onClick={() => guard.requestCloseFrom("backdrop")} />
      <motion.div role="dialog" aria-modal="true" aria-label={`Log purchase · ${draft.name}`} className="fixed right-0 top-0 z-50 flex h-full w-full max-w-sm flex-col gap-3 border-l border-white/[0.08] p-5"
        style={{ background: "linear-gradient(180deg, #0e0f15 0%, #08090d 100%)" }}
        initial={{ x: "100%" }} animate={{ x: 0 }} transition={{ type: "tween", ease: [0.22, 1, 0.36, 1], duration: 0.32 }}>
        <div className="flex items-center justify-between">
          <p className="font-mono text-[8px] uppercase tracking-[0.24em]" style={{ color: `${GOLD}b0` }}>Log Purchase</p>
          <button type="button" onClick={guard.requestClose} aria-label="Close" className="text-white/40 hover:text-white/70"><X size={16} /></button>
        </div>
        <DiscardChangesBar guard={guard} />
        <h3 className="font-display text-[18px] font-bold" style={{ color: SOFT }}>{draft.name}</h3>

        <label className="mt-2 font-mono text-[7.5px] uppercase tracking-[0.2em] text-white/30">Quantity + unit</label>
        <div className="flex gap-2">
          <input className={field} value={qty} onChange={(e) => setQty(e.target.value)} inputMode="decimal" />
          <ReserveSelect
            srLabel="Unit"
            value={unit}
            options={["lb", "oz", "kg", "g", "count", "container", "bottle", "l", "ml"].map((u) => ({ value: u, label: u }))}
            onChange={setUnit}
          />
        </div>

        <ReserveSelect
          label="Store"
          value={store}
          options={STORES.map((s) => ({ value: s.key, label: s.label }))}
          onChange={(v) => setStore(v as StoreKey)}
        />

        <label className="font-mono text-[7.5px] uppercase tracking-[0.2em] text-white/30">Price paid ($)</label>
        <input className={field} value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" placeholder="0.00" />

        <button type="button" onClick={submit}
          className="mt-3 w-full rounded-xl border px-4 py-2.5 font-mono text-[8.5px] uppercase tracking-[0.16em] transition hover:brightness-110"
          style={{ borderColor: `${GOLD}50`, background: `linear-gradient(120deg, ${GOLD}22, ${GOLD_BRIGHT}14)`, color: GOLD_BRIGHT }}>
          Save to Inventory
        </button>
        <p className="font-mono text-[8px] text-white/25">Quality + clean-label preferences are member choices. Reserve does not rank stores medically.</p>
      </motion.div>
    </>
  );
}

/* ─── Signature meal card ────────────────────────── */
function SignatureMealCard({ meal, storePrefs, onAddToday, onRotation, onFavorite, onEdit, onRemove }: {
  meal: SignatureMeal;
  storePrefs: { preferredStores?: StoreKey[]; qualityPreferences?: string[] };
  onAddToday: () => void; onRotation: () => void; onFavorite: () => void; onEdit: () => void; onRemove: () => void;
}) {
  const reduce = useReducedMotion();
  const { macros, complete } = computeSignatureMacros(meal);
  const purposeLabel = SIGNATURE_PURPOSES.find((p) => p.key === meal.purpose)?.label ?? meal.purpose;
  const groceryImpact = useMemo(() => buildSignatureGroceryItems([meal], storePrefs as never), [meal, storePrefs]);
  const storeLabel = meal.storePreference ? STORES.find((s) => s.key === meal.storePreference)?.label : null;
  const accent = meal.addedToday ? TEAL : GOLD;
  return (
    <motion.div className="relative overflow-hidden rounded-2xl p-4"
      style={{ borderColor: `${accent}22`, background: "linear-gradient(165deg, rgba(255,255,255,0.025), rgba(255,255,255,0.008))" }}
      initial={reduce ? false : { opacity: 0, y: 8 }} animate={reduce ? undefined : { opacity: 1, y: 0 }}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${accent}55, transparent)` }} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="font-mono text-[7.5px] uppercase tracking-[0.2em] text-white/35">{purposeLabel}</p>
            {meal.favorite && <Star size={9} style={{ color: TEAL }} fill={TEAL} />}
          </div>
          <h3 className="font-display mt-0.5 text-[15px] font-bold leading-tight" style={{ color: SOFT }}>{meal.name}</h3>
        </div>
        <div className="flex flex-shrink-0 items-center gap-1.5">
          {meal.inRotation && <Chip accent={GOLD_BRIGHT} active>In Rotation</Chip>}
          {meal.addedToday && <Chip accent={TEAL} active>Today</Chip>}
        </div>
      </div>

      <p className="mt-2 text-[10px] leading-[1.5] text-white/50">{signatureIngredientSummary(meal)}</p>

      {complete ? (
        <p className="tnum mt-2 font-mono text-[9px]" style={{ color: `${accent}c0` }}>{macros.proteinG}P · {macros.carbsG}C · {macros.fatG}F · {macros.calories}kcal</p>
      ) : (
        <p className="mt-2 font-mono text-[9px]" style={{ color: AMBER }}>Manual macro entry needed</p>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {storeLabel && <Chip accent={STEEL}>{storeLabel}</Chip>}
        {(meal.qualityPreference ?? []).slice(0, 2).map((q) => <Chip key={q} accent={STEEL}>{q}</Chip>)}
        <Chip accent={GOLD}>{meal.frequencyPerWeek}×/week</Chip>
      </div>

      <p className="mt-2 font-mono text-[8px] text-white/35">
        Grocery impact · {groceryImpact.length} item{groceryImpact.length === 1 ? "" : "s"}{meal.inRotation ? " · in weekly list" : " · not in weekly list yet"}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/[0.05] pt-3">
        <button type="button" onClick={onAddToday}
          className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-mono text-[8px] uppercase tracking-[0.16em] transition hover:brightness-110"
          style={{ borderColor: `${accent}40`, background: `${accent}12`, color: accent }}>
          <Check size={10} /> {meal.addedToday ? "On Today" : "Add to Today"}
        </button>
        <button type="button" onClick={onRotation}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.1] bg-white/[0.02] px-3 py-1.5 font-mono text-[8px] uppercase tracking-[0.16em] text-white/55 transition hover:bg-white/[0.05]">
          <RotateCw size={10} /> {meal.inRotation ? "In Rotation" : "Add to Rotation"}
        </button>
        <button type="button" onClick={onEdit} title="Edit meal"
          className="inline-flex items-center justify-center rounded-lg border border-white/[0.1] bg-white/[0.02] px-2 py-1.5 text-white/45 transition hover:text-white/80">
          <Pencil size={11} />
        </button>
        <button type="button" onClick={onFavorite} title="Favorite"
          className="inline-flex items-center justify-center rounded-lg border border-white/[0.1] bg-white/[0.02] px-2 py-1.5 text-white/45 transition hover:text-[#6ee7b7]">
          <Star size={11} fill={meal.favorite ? TEAL : "none"} style={{ color: meal.favorite ? TEAL : undefined }} />
        </button>
        <button type="button" onClick={onRemove} title="Remove meal"
          className="ml-auto inline-flex items-center justify-center rounded-lg border border-white/[0.1] bg-white/[0.02] px-2 py-1.5 text-white/35 transition hover:text-[#ef7d55]">
          <Trash2 size={11} />
        </button>
      </div>
    </motion.div>
  );
}

/* ─── Signature meal editor drawer ───────────────── */
const SIG_UNITS = ["count", "g", "oz", "slice", "scoop", "tbsp", "tsp", "cup", "ml", "container", "shot"];
const SIG_CATEGORIES: GroceryCategory[] = ["protein", "carb", "fat", "fruit", "vegetable", "dairy", "coffee", "hydration", "seasoning", "pantry", "frozen", "supplement", "smoothie"];

function SignatureMealDrawer({ mode, initial, onClose, onSave }: {
  mode: "create" | "edit";
  initial: SignatureMeal | null;
  onClose: () => void;
  onSave: (meal: Omit<SignatureMeal, "id" | "createdAt">) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [purpose, setPurpose] = useState<SignatureMealPurpose>(initial?.purpose ?? "morning-anchor");
  const [frequency, setFrequency] = useState(String(initial?.frequencyPerWeek ?? 4));
  const [store, setStore] = useState<StoreKey>(initial?.storePreference ?? "whole-foods");
  const [manualMacros, setManualMacros] = useState(initial?.manualMacros ?? false);
  const [mCal, setMCal] = useState(String(initial?.macros?.calories ?? ""));
  const [mP, setMP] = useState(String(initial?.macros?.proteinG ?? ""));
  const [mC, setMC] = useState(String(initial?.macros?.carbsG ?? ""));
  const [mF, setMF] = useState(String(initial?.macros?.fatG ?? ""));
  const [rows, setRows] = useState<SignatureIngredient[]>(() =>
    initial?.ingredients?.length
      ? initial.ingredients
      : [{ id: "ing-new-0", name: "", amount: 1, unit: "count", role: "protein", groceryCategory: "protein" }],
  );
  const rowSeed = useRef(1);
  const guard = useFormCloseGuard(
    useDirtySnapshot({ name, purpose, frequency, store, manualMacros, mCal, mP, mC, mF, rows }),
    onClose,
    { backdropClosesWhenClean: true },
  );

  const field = "w-full rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 py-2 text-[12px] text-white/80 outline-none focus:border-white/30";
  const miniField = "w-full rounded-md border border-white/[0.1] bg-white/[0.03] px-2 py-1.5 text-[11px] text-white/80 outline-none focus:border-white/30";

  function updateRow(i: number, patch: Partial<SignatureIngredient>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function addRow() {
    const id = `ing-new-${rowSeed.current++}`;
    setRows((prev) => [...prev, { id, name: "", amount: 1, unit: "count", role: "protein", groceryCategory: "protein" }]);
  }
  function removeRow(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  }

  function submit() {
    const cleanRows = rows.filter((r) => r.name.trim().length > 0);
    const meal: Omit<SignatureMeal, "id" | "createdAt"> = {
      name: name.trim() || "Untitled Meal",
      purpose,
      ingredients: cleanRows,
      manualMacros,
      macros: manualMacros
        ? { calories: parseFloat(mCal) || 0, proteinG: parseFloat(mP) || 0, carbsG: parseFloat(mC) || 0, fatG: parseFloat(mF) || 0 }
        : (initial?.macros ?? null),
      storePreference: store,
      qualityPreference: initial?.qualityPreference ?? ["clean-label"],
      frequencyPerWeek: Math.max(1, Math.round(parseFloat(frequency) || 1)),
      favorite: initial?.favorite ?? false,
      addedToday: initial?.addedToday ?? false,
      inRotation: initial?.inRotation ?? false,
      notes: initial?.notes,
      lastUsedAt: initial?.lastUsedAt,
    };
    onSave(meal);
  }

  return (
    <>
      {/* Fades in with CSS, not presence-tracked — an animated backdrop is a
          second exit that can stall and strand the overlay. */}
      <div className="fba-scrim-in fixed inset-0 z-40 bg-black/50" onClick={() => guard.requestCloseFrom("backdrop")} />
      <motion.div role="dialog" aria-modal="true" aria-label={mode === "edit" ? "Edit signature meal" : "New signature meal"} className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col gap-3 overflow-y-auto border-l border-white/[0.08] p-5"
        style={{ background: "linear-gradient(180deg, #0e0f15 0%, #08090d 100%)" }}
        initial={{ x: "100%" }} animate={{ x: 0 }} transition={{ type: "tween", ease: [0.22, 1, 0.36, 1], duration: 0.32 }}>
        <div className="flex items-center justify-between">
          <p className="font-mono text-[8px] uppercase tracking-[0.24em]" style={{ color: `${GOLD}b0` }}>{mode === "edit" ? "Edit Signature Meal" : "New Signature Meal"}</p>
          <button type="button" onClick={guard.requestClose} aria-label="Close" className="text-white/40 hover:text-white/70"><X size={16} /></button>
        </div>
        <DiscardChangesBar guard={guard} />

        <label className="font-mono text-[7.5px] uppercase tracking-[0.2em] text-white/30">Meal name</label>
        <input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="Sniper Breakfast Build" />

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="font-mono text-[7.5px] uppercase tracking-[0.2em] text-white/30">Purpose</label>
            <ReserveSelect
              srLabel="Purpose"
              value={purpose}
              options={SIGNATURE_PURPOSES.map((p) => ({ value: p.key, label: p.label }))}
              onChange={(v) => setPurpose(v as SignatureMealPurpose)}
            />
          </div>
          <div>
            <label className="font-mono text-[7.5px] uppercase tracking-[0.2em] text-white/30">Times / week</label>
            <input className={field} value={frequency} onChange={(e) => setFrequency(e.target.value)} inputMode="numeric" />
          </div>
        </div>

        <ReserveSelect
          label="Preferred store"
          value={store}
          options={STORES.map((s) => ({ value: s.key, label: s.label }))}
          onChange={(v) => setStore(v as StoreKey)}
        />

        <div className="mt-1 flex items-center justify-between">
          <label className="font-mono text-[7.5px] uppercase tracking-[0.2em] text-white/30">Ingredients</label>
          <button type="button" onClick={addRow} className="inline-flex items-center gap-1 font-mono text-[8px] uppercase tracking-[0.14em]" style={{ color: GOLD }}><Plus size={10} /> Add</button>
        </div>
        <div className="flex flex-col gap-2">
          {rows.map((r, i) => (
            <div key={r.id} className="rounded-lg bg-white/[0.015] p-2.5">
              <div className="flex items-center gap-2">
                <input className={miniField} value={r.name} onChange={(e) => updateRow(i, { name: e.target.value })} placeholder="Ingredient" />
                <button type="button" onClick={() => removeRow(i)} className="flex-shrink-0 text-white/30 hover:text-[#ef7d55]"><Trash2 size={13} /></button>
              </div>
              <div className="mt-1.5 grid grid-cols-4 gap-1.5">
                <input className={miniField} value={String(r.amount ?? "")} onChange={(e) => updateRow(i, { amount: parseFloat(e.target.value) || 0 })} inputMode="decimal" placeholder="Amt" />
                {/* Ingredient rows repeat, so each control needs a name that
                    says WHICH row it belongs to — otherwise a screen reader
                    announces "Unit" eight times with no way to tell them apart. */}
                <ReserveSelect
                  srLabel={`Unit for ingredient ${i + 1}`}
                  value={r.unit ?? "count"}
                  options={SIG_UNITS.map((u) => ({ value: u, label: u }))}
                  onChange={(v) => updateRow(i, { unit: v })}
                />
                <ReserveSelect
                  srLabel={`Role for ingredient ${i + 1}`}
                  value={r.role}
                  options={SIGNATURE_INGREDIENT_ROLES.map((role) => ({ value: role, label: role }))}
                  onChange={(v) => updateRow(i, { role: v as SignatureIngredientRole })}
                />
                <ReserveSelect
                  srLabel={`Grocery category for ingredient ${i + 1}`}
                  value={r.groceryCategory}
                  options={SIG_CATEGORIES.map((c) => ({ value: c, label: c }))}
                  onChange={(v) => updateRow(i, { groceryCategory: v as GroceryCategory })}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-1 flex items-center gap-2">
          <button type="button" onClick={() => setManualMacros((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-mono text-[8px] uppercase tracking-[0.14em] transition"
            style={manualMacros ? { borderColor: `${GOLD}45`, background: `${GOLD}12`, color: GOLD } : { borderColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)" }}>
            <Check size={10} /> Manual macros
          </button>
          <span className="font-mono text-[8px] text-white/30">Off = summed from ingredient macros</span>
        </div>
        {manualMacros && (
          <div className="grid grid-cols-4 gap-1.5">
            <div><label className="font-mono text-[7px] uppercase tracking-[0.16em] text-white/30">kcal</label><input className={miniField} value={mCal} onChange={(e) => setMCal(e.target.value)} inputMode="numeric" /></div>
            <div><label className="font-mono text-[7px] uppercase tracking-[0.16em] text-white/30">Protein</label><input className={miniField} value={mP} onChange={(e) => setMP(e.target.value)} inputMode="numeric" /></div>
            <div><label className="font-mono text-[7px] uppercase tracking-[0.16em] text-white/30">Carbs</label><input className={miniField} value={mC} onChange={(e) => setMC(e.target.value)} inputMode="numeric" /></div>
            <div><label className="font-mono text-[7px] uppercase tracking-[0.16em] text-white/30">Fats</label><input className={miniField} value={mF} onChange={(e) => setMF(e.target.value)} inputMode="numeric" /></div>
          </div>
        )}

        <button type="button" onClick={submit}
          className="mt-3 w-full rounded-xl border px-4 py-2.5 font-mono text-[8.5px] uppercase tracking-[0.16em] transition hover:brightness-110"
          style={{ borderColor: `${GOLD}50`, background: `linear-gradient(120deg, ${GOLD}22, ${GOLD_BRIGHT}14)`, color: GOLD_BRIGHT }}>
          {mode === "edit" ? "Save Changes" : "Save Signature Meal"}
        </button>
        <p className="font-mono text-[8px] text-white/25">Signature meals feed your macros, grocery list, restock, and rotation. Quality + store preferences are member choices.</p>
      </motion.div>
    </>
  );
}

/* ─── helpers ────────────────────────────────────── */
function BudgetCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="rounded-xl bg-white/[0.02] px-4 py-3">
      <p className="font-mono text-[8px] uppercase tracking-[0.2em] text-white/35">{label}</p>
      <p className="tnum font-display mt-1 text-[22px] font-extrabold" style={{ color: accent }}>${value.toFixed(2)}</p>
    </div>
  );
}

function EmptyLine({ children }: { children: React.ReactNode }) {
  return <p className="py-4 text-center text-[10.5px] text-white/35">{children}</p>;
}
