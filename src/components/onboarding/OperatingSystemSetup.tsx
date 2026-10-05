"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Activity, Check, ChevronLeft, ChevronRight, Coffee, Dumbbell, FlaskConical,
  ShoppingCart, Sparkles, Target, Utensils, X,
} from "lucide-react";
import { useState } from "react";

import { DiscardChangesBar, useFormCloseGuard } from "@/components/ui/reserve/FormCloseGuard";
import { useAthleteDashboardStore } from "@/lib/athlete-store";
import { SPLIT_SYSTEMS } from "@/lib/training/split-architect";
import { getArchitectureForSystem, legFrequencyLabel } from "@/lib/training/split-architectures";
import { formSnapshot } from "@/lib/ui/form-close-guard";
import { DIET_STYLES } from "@/lib/nutrition/diet-styles";
import { STORES } from "@/lib/nutrition/grocery-engine";

const GOLD = "#d5b15f";
const GOLD_BRIGHT = "#e8c87a";
const STEEL = "#5fb7d5";
const TEAL = "#6ee7b7";
const SOFT = "#f2eee6";

type StepKey = "profile" | "training" | "schedule" | "nutrition" | "grocery" | "enhancement" | "bloodwork" | "baseline" | "confirm";

const STEPS: Array<{ key: StepKey; label: string; icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }> }> = [
  { key: "profile", label: "Body + Goal", icon: Target },
  { key: "training", label: "Training", icon: Dumbbell },
  { key: "schedule", label: "Daily Schedule", icon: Activity },
  { key: "nutrition", label: "Nutrition", icon: Utensils },
  { key: "grocery", label: "Grocery", icon: ShoppingCart },
  { key: "enhancement", label: "Enhancement", icon: Sparkles },
  { key: "bloodwork", label: "Lab Watch", icon: FlaskConical },
  { key: "baseline", label: "Baseline", icon: Activity },
  { key: "confirm", label: "Confirm", icon: Check },
];

const GOALS = ["Cut", "Lean Bulk", "Recomp", "Maintenance", "Performance", "Prep / Peak"];
const PRIORITIES = ["Build muscle", "Lose fat", "Improve symmetry", "Strength output", "Conditioning", "Recovery"];
/* The split list used to be hardcoded here: seven strings mixing real splits
   with single days, exactly one lower-body option, and it wrote
   setupProfile.preferredSplit — a value nothing in the app reads except one
   substring test for "none". Picking "Legs" shaped nothing.

   The real catalog is SPLIT_SYSTEMS, it is filtered by the member's path, it
   states each option's leg frequency, and the choice now writes splitSystem so
   it actually builds her week. */
const WEAK_POINTS = ["Upper chest", "Delts", "Lats", "Arms", "Core", "Quads", "Hamstrings", "Glutes", "Calves", "Conditioning"];
const OCCUPATIONS: Array<[string, string]> = [["sedentary", "Desk / Sedentary"], ["active", "On feet / Active"], ["physical", "Physical / Manual"]];
const EQUIPMENT = ["Full gym", "Home gym", "Dumbbells only", "Machines preferred", "Custom"];
const APPETITE = ["low", "normal", "high"];
const COFFEE = ["iced-coffee", "cold-brew", "espresso", "black-coffee", "coffee-with-milk", "matcha", "tea", "caffeine-free"];
const COFFEE_LABEL: Record<string, string> = { "iced-coffee": "Iced coffee", "cold-brew": "Cold brew", espresso: "Espresso", "black-coffee": "Black coffee", "coffee-with-milk": "Coffee + milk", matcha: "Matcha", tea: "Tea", "caffeine-free": "Caffeine-free" };
const BUDGETS = ["lean", "standard", "premium"];
const BUDGET_LABEL: Record<string, string> = { lean: "Budget-first", standard: "Balanced", premium: "Premium" };
const QUALITY = ["clean-label", "organic", "grass-fed", "pasture-raised", "wild-caught", "local", "bulk-ok", "avoid-seed-oils", "avoid-ultraprocessed"];
const QUALITY_LABEL: Record<string, string> = { "clean-label": "Clean label", organic: "Organic", "grass-fed": "Grass-fed", "pasture-raised": "Pasture-raised", "wild-caught": "Wild-caught", local: "Local produce", "bulk-ok": "Bulk", "avoid-seed-oils": "No seed oils", "avoid-ultraprocessed": "No ultra-processed" };
const ENHANCEMENT_OPTS = ["No", "Supplements only", "Peptides", "Hormones / AAS", "Medications", "Recovery items", "Set up later"];
const ENHANCEMENT_PREFS = ["Reminders", "Inventory", "Site rotation", "Dose math", "Lab watch", "Symptom notes"];
const BLOODWORK_OPTS = ["No", "Yes — recent labs", "Yes — log baseline", "Set up later"];
const MARKER_GROUPS = ["CBC / Hematocrit", "Lipids", "Liver enzymes", "Kidney", "Glucose / Insulin", "Testosterone", "Estradiol", "IGF-1", "Thyroid", "Blood pressure", "Other"];
const CHECKIN_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const CHECKIN_FREQ = ["weekly", "biweekly", "monthly"];

/* ─── atoms ──────────────────────────────────────── */
function Chip({ label, active, onClick, accent = GOLD }: { label: string; active: boolean; onClick: () => void; accent?: string }) {
  return (
    <button type="button" onClick={onClick}
      className="rounded-lg border px-2.5 py-1.5 font-mono text-[8.5px] uppercase tracking-[0.12em] transition"
      style={active ? { borderColor: `${accent}50`, background: `${accent}14`, color: accent } : { borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)", color: "rgba(255,255,255,0.5)" }}>
      {label}
    </button>
  );
}
function Field({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-mono text-[7.5px] uppercase tracking-[0.18em] text-white/35">{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} inputMode={type === "text" ? undefined : "decimal"}
        className="w-full rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 py-2 text-[13px] text-white/85 outline-none focus:border-white/30" />
    </label>
  );
}
function StepHeading({ kicker, title, sub }: { kicker: string; title: string; sub?: string }) {
  return (
    <div className="mb-4">
      <p className="font-mono text-[8px] uppercase tracking-[0.24em]" style={{ color: `${GOLD}b0` }}>{kicker}</p>
      <h2 className="font-display mt-1 text-[22px] font-extrabold" style={{ color: SOFT }}>{title}</h2>
      {sub && <p className="mt-1 text-[11px] text-white/45">{sub}</p>}
    </div>
  );
}
function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-mono text-[7.5px] uppercase tracking-[0.18em] text-white/30">{label}</span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function toggle(list: string[], v: string): string[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}
function legFrequencyFor(systemKey: string, trainingDays: number): string {
  const arch = getArchitectureForSystem(systemKey, { trainingDaysPerWeek: trainingDays });
  return arch ? legFrequencyLabel(arch) : "—";
}

function splitDescription(systemKey: string): string {
  return SPLIT_SYSTEMS.find((s) => s.key === systemKey)?.tagline ?? "";
}

function csv(s: string): string[] { return s.split(",").map((x) => x.trim()).filter(Boolean); }
function n(s: string): number | undefined { const v = parseFloat(s); return Number.isFinite(v) ? v : undefined; }

/* ════════════════════════════════════════════════════════════════════════
   OPERATING SYSTEM SETUP
   ════════════════════════════════════════════════════════════════════════ */

export function OperatingSystemSetup({ onClose }: { onClose: () => void }) {
  const profile = useAthleteDashboardStore((s) => s.profile);
  const schedulePlan = useAthleteDashboardStore((s) => s.trainingSession.schedulePlan);
  const prefs = useAthleteDashboardStore((s) => s.nutritionPrefs);
  const setupProfile = useAthleteDashboardStore((s) => s.setupProfile);
  const updateProfile = useAthleteDashboardStore((s) => s.updateProfile);
  const updateSchedulePlan = useAthleteDashboardStore((s) => s.updateSchedulePlan);
  const setNutritionPrefs = useAthleteDashboardStore((s) => s.setNutritionPrefs);
  const setSetupProfile = useAthleteDashboardStore((s) => s.setSetupProfile);
  const markSetupStepComplete = useAthleteDashboardStore((s) => s.markSetupStepComplete);
  const markSetupComplete = useAthleteDashboardStore((s) => s.markSetupComplete);
  const setActiveView = useAthleteDashboardStore((s) => s.setActiveView);
  const setSplitSystem = useAthleteDashboardStore((s) => s.setSplitSystem);
  const splitSystem = useAthleteDashboardStore((s) => s.splitSystem);
  const genderIdentity = useAthleteDashboardStore((s) => s.profile.coachingProfile?.genderIdentity);
  const womensEnabled = useAthleteDashboardStore((s) => s.womens.enabled);

  const [stepIdx, setStepIdx] = useState(0);
  const step = STEPS[stepIdx].key;

  // ── working draft seeded from existing stores ──
  const [name, setName] = useState(profile.name);
  const [age, setAge] = useState(setupProfile.age ? String(setupProfile.age) : "");
  const [sex, setSex] = useState<string>(setupProfile.sex ?? "");
  const [heightIn, setHeightIn] = useState(setupProfile.heightIn ? String(setupProfile.heightIn) : "");
  /* Blank until the member enters a weight — no pre-filled 190. */
  const [weight, setWeight] = useState(prefs.bodyweightLb ? String(prefs.bodyweightLb) : "");
  const [targetWeight, setTargetWeight] = useState(setupProfile.targetWeightLb ? String(setupProfile.targetWeightLb) : "");
  const [goal, setGoal] = useState(GOALS.find((g) => profile.goal.toLowerCase().includes(g.toLowerCase().split(" ")[0])) ?? "Recomp");
  const [timeline, setTimeline] = useState(String(setupProfile.targetTimelineWeeks ?? 12));
  const [priorities, setPriorities] = useState<string[]>(setupProfile.priorities ?? []);

  const [split, setSplit] = useState(splitSystem.key || "");
  /* Only the systems this member is actually offered. The lower-led lane is
     authored for the women's path, so it is not shown to anyone else. */
  const womensPath = genderIdentity === "female" || womensEnabled;
  const offeredSplits = SPLIT_SYSTEMS.filter((s) => !s.audience || (s.audience === "womens" && womensPath));
  const [trainDays, setTrainDays] = useState(String(setupProfile.trainingDaysPerWeek ?? 5));
  const [sessionMin, setSessionMin] = useState(String(setupProfile.sessionDurationMin ?? 90));
  const [weakPoints, setWeakPoints] = useState<string[]>(setupProfile.weakPoints ?? []);
  const [occupation, setOccupation] = useState<string>(setupProfile.occupationLoad ?? "");
  const [equipment, setEquipment] = useState(setupProfile.equipmentAccess ?? "Full gym");

  const [wake, setWake] = useState(schedulePlan.wakeTime || "07:00");
  const [sleep, setSleep] = useState(schedulePlan.sleepTime || "23:00");
  const [workStart, setWorkStart] = useState(setupProfile.workStartTime ?? "");
  const [workEnd, setWorkEnd] = useState(setupProfile.workEndTime ?? "");
  const [trainTime, setTrainTime] = useState(schedulePlan.workoutTime || "17:30");

  const [dietStyle, setDietStyle] = useState(prefs.dietStyle);
  const [mealsPerDay, setMealsPerDay] = useState(String(setupProfile.mealsPerDay ?? 5));
  const [disliked, setDisliked] = useState(prefs.dislikedFoods.join(", "));
  const [allergies, setAllergies] = useState(prefs.allergies.join(", "));
  const [dairyAllowed, setDairyAllowed] = useState(prefs.dairyAllowed);
  const [appetite, setAppetite] = useState(prefs.appetiteLevel);
  const [coffee, setCoffee] = useState(prefs.caffeineStyle);

  const [budget, setBudget] = useState(setupProfile.groceryBudgetLevel ?? "standard");
  const [stores, setStores] = useState<string[]>(prefs.preferredStores);
  const [quality, setQuality] = useState<string[]>(prefs.qualityPreferences);

  const [enhancement, setEnhancement] = useState(setupProfile.usesCompounds === false ? "No" : "");
  const [enhPrefs, setEnhPrefs] = useState<string[]>(setupProfile.enhancementTracking ?? []);

  const [bloodwork, setBloodwork] = useState(setupProfile.bloodworkStatus === "none" ? "No" : "");
  const [markers, setMarkers] = useState<string[]>(setupProfile.bloodworkMarkers ?? []);
  const [labCadence, setLabCadence] = useState(String(setupProfile.labReviewCadenceWeeks ?? 12));

  const [baseWeight, setBaseWeight] = useState(setupProfile.baselineWeightLb ? String(setupProfile.baselineWeightLb) : String(prefs.bodyweightLb || ""));
  const [waist, setWaist] = useState(setupProfile.baselineWaistIn ? String(setupProfile.baselineWaistIn) : "");
  const [checkInDay, setCheckInDay] = useState(setupProfile.checkInDay ?? 0);
  const [checkInFreq, setCheckInFreq] = useState<string>(setupProfile.checkInFrequency ?? "weekly");

  /* Next saves the step, so the draft is clean again after it. */
  const draft = formSnapshot({
    name, age, sex, heightIn, weight, targetWeight, goal, timeline, priorities,
    split, trainDays, sessionMin, weakPoints, occupation, equipment,
    wake, sleep, workStart, workEnd, trainTime,
    dietStyle, mealsPerDay, disliked, allergies, dairyAllowed, appetite, coffee,
    budget, stores, quality, enhancement, enhPrefs, bloodwork, markers, labCadence,
    baseWeight, waist, checkInDay, checkInFreq,
  });
  const [savedDraft, setSavedDraft] = useState(draft);
  const guard = useFormCloseGuard(draft !== savedDraft, onClose, { backdropClosesWhenClean: true });

  function persistStep(s: StepKey) {
    switch (s) {
      case "profile":
        updateProfile({ name: name || profile.name, goal });
        setNutritionPrefs({ bodyweightLb: n(weight) ?? prefs.bodyweightLb });
        setSetupProfile({ age: n(age), sex: (sex || undefined) as never, heightIn: n(heightIn), targetWeightLb: n(targetWeight), targetTimelineWeeks: n(timeline), priorities });
        break;
      case "training":
        /* preferredSplit is kept for the one legacy "none" check that reads it;
           splitSystem is what actually resolves her week. */
        setSetupProfile({ preferredSplit: split || undefined, trainingDaysPerWeek: n(trainDays), sessionDurationMin: n(sessionMin), weakPoints, equipmentAccess: equipment, occupationLoad: (occupation || undefined) as never });
        if (split) setSplitSystem(split, "member", splitSystem.restDayIndex ?? null);
        break;
      case "schedule":
        updateSchedulePlan({ wakeTime: wake, sleepTime: sleep, workoutTime: trainTime });
        setSetupProfile({ workStartTime: workStart || undefined, workEndTime: workEnd || undefined });
        break;
      case "nutrition":
        setNutritionPrefs({ dietStyle, dislikedFoods: csv(disliked), allergies: csv(allergies), dairyAllowed, appetiteLevel: appetite as never, caffeineStyle: coffee });
        setSetupProfile({ mealsPerDay: n(mealsPerDay) });
        break;
      case "grocery":
        setNutritionPrefs({ preferredStores: stores as never, qualityPreferences: quality as never });
        setSetupProfile({ groceryBudgetLevel: budget as never });
        break;
      case "enhancement":
        setSetupProfile({ usesCompounds: enhancement === "No" ? false : enhancement && enhancement !== "Set up later" ? true : undefined, enhancementTracking: enhPrefs });
        break;
      case "bloodwork":
        setSetupProfile({ bloodworkStatus: bloodwork === "No" ? "none" : bloodwork.includes("baseline") ? "baseline" : bloodwork.includes("recent") ? "current" : undefined, bloodworkMarkers: markers, labReviewCadenceWeeks: n(labCadence) });
        break;
      case "baseline":
        setSetupProfile({ baselineWeightLb: n(baseWeight), baselineWaistIn: n(waist), baselineLoggedAt: new Date().toISOString(), checkInDay, checkInFrequency: checkInFreq as never });
        break;
      default: break;
    }
    if (s !== "confirm") markSetupStepComplete(s);
  }

  function next() {
    persistStep(step);
    setSavedDraft(draft);
    if (stepIdx < STEPS.length - 1) setStepIdx(stepIdx + 1);
  }
  function back() { if (stepIdx > 0) setStepIdx(stepIdx - 1); }
  function finish() {
    persistStep("baseline");
    markSetupComplete();
    setActiveView("dashboard");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => guard.requestCloseFrom("backdrop")} />
      <motion.div
        className="relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-white/[0.1]"
        style={{ background: "linear-gradient(160deg, #0e0f15 0%, #08090d 100%)", boxShadow: "0 30px 80px rgba(0,0,0,0.6)" }}
        initial={{ opacity: 0, y: 20, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}>
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${GOLD}70, transparent)` }} />

        {/* Header + progress */}
        <div className="flex items-center gap-3 border-b border-white/[0.06] px-6 py-4">
          <Sparkles size={14} style={{ color: GOLD }} />
          <div className="min-w-0">
            <p className="font-mono text-[8px] uppercase tracking-[0.26em]" style={{ color: `${GOLD}b0` }}>Reserve Operating System Setup</p>
            <p className="text-[12px] font-semibold text-white/55">{STEPS[stepIdx].label}</p>
          </div>
          <span className="tnum ml-auto font-mono text-[8px] uppercase tracking-[0.16em] text-white/35">{stepIdx + 1} / {STEPS.length}</span>
          <button type="button" onClick={guard.requestClose} className="text-white/40 hover:text-white/70"><X size={16} /></button>
        </div>
        <DiscardChangesBar guard={guard} />
        <div className="h-1 w-full bg-white/[0.05]">
          <motion.div className="h-full" style={{ background: `linear-gradient(90deg, ${GOLD}, ${GOLD_BRIGHT})` }}
            initial={false} animate={{ width: `${((stepIdx + 1) / STEPS.length) * 100}%` }} transition={{ duration: 0.3 }} />
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          <AnimatePresence mode="wait">
            <motion.div key={step} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.22 }}>

              {step === "profile" && (
                <>
                  <StepHeading kicker="Step 1" title="Body + Goal" sub="The anchors for every macro and projection estimate." />
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <Field label="Preferred name" value={name} onChange={setName} />
                    <Field label="Age" value={age} onChange={setAge} type="number" />
                    <Field label="Height (in)" value={heightIn} onChange={setHeightIn} type="number" />
                    <Field label="Current weight (lb)" value={weight} onChange={setWeight} type="number" />
                    <Field label="Target weight (lb)" value={targetWeight} onChange={setTargetWeight} type="number" />
                  </div>
                  <div className="mt-4 flex flex-col gap-3">
                    <Group label="Sex">{["male", "female", "other"].map((s) => <Chip key={s} label={s} active={sex === s} onClick={() => setSex(s)} />)}</Group>
                    <Group label="Primary goal">{GOALS.map((g) => <Chip key={g} label={g} active={goal === g} onClick={() => setGoal(g)} />)}</Group>
                    <Group label="Timeline (weeks)">{["4", "8", "12", "16"].map((t) => <Chip key={t} label={t} active={timeline === t} onClick={() => setTimeline(t)} />)}</Group>
                    <Group label="Priority">{PRIORITIES.map((p) => <Chip key={p} label={p} active={priorities.includes(p)} onClick={() => setPriorities(toggle(priorities, p))} accent={TEAL} />)}</Group>
                  </div>
                </>
              )}

              {step === "training" && (
                <>
                  <StepHeading kicker="Step 2" title="Training Setup" sub="Your split and focus drive the Mission Runway." />
                  <div className="flex flex-col gap-3">
                    <Group label="Weekly split">
                      {offeredSplits.map((s) => (
                        <Chip
                          key={s.key}
                          label={`${s.name} · ${legFrequencyFor(s.key, n(trainDays) ?? 5)}`}
                          active={split === s.key}
                          onClick={() => setSplit(split === s.key ? "" : s.key)}
                        />
                      ))}
                    </Group>
                    <p className="text-[11px] leading-[1.5] text-white/45">
                      {split
                        ? `${splitDescription(split)} This builds your week — you can change the split or any single day later.`
                        : "Pick one and Reserve builds your week from it. Leave it blank and Reserve recommends one from your goal."}
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Training days / week" value={trainDays} onChange={setTrainDays} type="number" />
                      <Field label="Session length (min)" value={sessionMin} onChange={setSessionMin} type="number" />
                    </div>
                    <Group label="Equipment access">{EQUIPMENT.map((e) => <Chip key={e} label={e} active={equipment === e} onClick={() => setEquipment(e)} accent={STEEL} />)}</Group>
                    <Group label="Weak points (priority)">{WEAK_POINTS.map((w) => <Chip key={w} label={w} active={weakPoints.includes(w)} onClick={() => setWeakPoints(toggle(weakPoints, w))} accent={TEAL} />)}</Group>
                    <Group label="Daily occupation load">{OCCUPATIONS.map(([val, lbl]) => <Chip key={val} label={lbl} active={occupation === val} onClick={() => setOccupation(occupation === val ? "" : val)} accent={STEEL} />)}</Group>
                  </div>
                </>
              )}

              {step === "schedule" && (
                <>
                  <StepHeading kicker="Step 3" title="Daily Schedule" sub="Powers meal timing, review plan, and recovery windows." />
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <Field label="Wake" value={wake} onChange={setWake} type="time" />
                    <Field label="Sleep" value={sleep} onChange={setSleep} type="time" />
                    <Field label="Training time" value={trainTime} onChange={setTrainTime} type="time" />
                    <Field label="Work start" value={workStart} onChange={setWorkStart} type="time" />
                    <Field label="Work end" value={workEnd} onChange={setWorkEnd} type="time" />
                  </div>
                </>
              )}

              {step === "nutrition" && (
                <>
                  <StepHeading kicker="Step 4" title="Nutrition + Diet Style" sub="Tailors meals, swaps, and macro rescue to how you eat." />
                  <div className="flex flex-col gap-3">
                    <Group label="Diet style">{DIET_STYLES.map((d) => <Chip key={d.key} label={d.label} active={dietStyle === d.key} onClick={() => setDietStyle(d.key)} />)}</Group>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Meals per day" value={mealsPerDay} onChange={setMealsPerDay} type="number" />
                    </div>
                    <Field label="Disliked foods (comma separated)" value={disliked} onChange={setDisliked} />
                    <Field label="Allergies (comma separated)" value={allergies} onChange={setAllergies} />
                    <div className="flex flex-col gap-3 sm:flex-row sm:gap-6">
                      <Group label="Dairy">{["Yes", "No"].map((v) => <Chip key={v} label={v} active={dairyAllowed === (v === "Yes")} onClick={() => setDairyAllowed(v === "Yes")} />)}</Group>
                      <Group label="Appetite">{APPETITE.map((a) => <Chip key={a} label={a} active={appetite === a} onClick={() => setAppetite(a as never)} accent={STEEL} />)}</Group>
                    </div>
                    <Group label="Coffee / beverage"><span className="flex flex-wrap gap-1.5">{COFFEE.map((c) => <Chip key={c} label={COFFEE_LABEL[c]} active={coffee === c} onClick={() => setCoffee(c)} accent={STEEL} />)}</span></Group>
                  </div>
                </>
              )}

              {step === "grocery" && (
                <>
                  <StepHeading kicker="Step 5" title="Grocery + Lifestyle" sub="Where you shop and the quality you prefer." />
                  <div className="flex flex-col gap-3">
                    <Group label="Budget">{BUDGETS.map((b) => <Chip key={b} label={BUDGET_LABEL[b]} active={budget === b} onClick={() => setBudget(b as never)} />)}</Group>
                    <Group label="Preferred stores">{STORES.map((s) => <Chip key={s.key} label={s.label} active={stores.includes(s.key)} onClick={() => setStores(toggle(stores, s.key))} accent={STEEL} />)}</Group>
                    <Group label="Quality preferences">{QUALITY.map((q) => <Chip key={q} label={QUALITY_LABEL[q]} active={quality.includes(q)} onClick={() => setQuality(toggle(quality, q))} accent={TEAL} />)}</Group>
                  </div>
                </>
              )}

              {step === "enhancement" && (
                <>
                  <StepHeading kicker="Step 6" title="Enhancement Tracking" sub="Reserve organizes member/provider-entered schedules only." />
                  <div className="flex flex-col gap-3">
                    <Group label="Are you tracking any of these in Reserve?">{ENHANCEMENT_OPTS.map((e) => <Chip key={e} label={e} active={enhancement === e} onClick={() => setEnhancement(e)} />)}</Group>
                    {enhancement && enhancement !== "No" && enhancement !== "Set up later" && (
                      <Group label="What do you want Reserve to organize?">{ENHANCEMENT_PREFS.map((p) => <Chip key={p} label={p} active={enhPrefs.includes(p)} onClick={() => setEnhPrefs(toggle(enhPrefs, p))} accent={TEAL} />)}</Group>
                    )}
                    <p className="font-mono text-[8px] leading-4 text-white/30">Reserve does not prescribe, recommend, approve, or adjust dosing. No protocols or compounds are suggested.</p>
                  </div>
                </>
              )}

              {step === "bloodwork" && (
                <>
                  <StepHeading kicker="Step 7" title="Bloodwork / Lab Watch" sub="For tracking and clinician discussion only." />
                  <div className="flex flex-col gap-3">
                    <Group label="Track bloodwork markers?">{BLOODWORK_OPTS.map((b) => <Chip key={b} label={b} active={bloodwork === b} onClick={() => setBloodwork(b)} />)}</Group>
                    {bloodwork && bloodwork !== "No" && bloodwork !== "Set up later" && (
                      <>
                        <Group label="Marker groups">{MARKER_GROUPS.map((m) => <Chip key={m} label={m} active={markers.includes(m)} onClick={() => setMarkers(toggle(markers, m))} accent={STEEL} />)}</Group>
                        <div className="grid grid-cols-2 gap-3"><Field label="Review cadence (weeks)" value={labCadence} onChange={setLabCadence} type="number" /></div>
                      </>
                    )}
                    <p className="font-mono text-[8px] leading-4 text-white/30">Reserve organizes lab markers for tracking and clinician discussion. It does not interpret lab results or provide medical advice.</p>
                  </div>
                </>
              )}

              {step === "baseline" && (
                <>
                  <StepHeading kicker="Step 8" title="Progress Baseline" sub="A starting point unlocks weekly review and monthly reports." />
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <Field label="Baseline weight (lb)" value={baseWeight} onChange={setBaseWeight} type="number" />
                    <Field label="Waist (in)" value={waist} onChange={setWaist} type="number" />
                  </div>
                  <div className="mt-4 flex flex-col gap-3">
                    <Group label="Check-in day">{CHECKIN_DAYS.map((d, i) => <Chip key={d} label={d} active={checkInDay === i} onClick={() => setCheckInDay(i)} />)}</Group>
                    <Group label="Frequency">{CHECKIN_FREQ.map((f) => <Chip key={f} label={f} active={checkInFreq === f} onClick={() => setCheckInFreq(f)} accent={STEEL} />)}</Group>
                  </div>
                </>
              )}

              {step === "confirm" && (
                <>
                  <StepHeading kicker="Final" title="Reserve Setup Summary" sub="Confirm and enter Apex Command." />
                  <div className="grid gap-2 sm:grid-cols-2">
                    {[
                      ["Goal", `${goal} · ${timeline}wk`],
                      ["Training", `${split || "—"} · ${trainDays}d · ${sessionMin}min`],
                      ["Daily schedule", `Wake ${wake} · Train ${trainTime} · Sleep ${sleep}`],
                      ["Nutrition", `${DIET_STYLES.find((d) => d.key === dietStyle)?.label ?? dietStyle} · ${mealsPerDay} meals`],
                      ["Grocery", `${BUDGET_LABEL[budget]} · ${stores.length} stores`],
                      ["Enhancement", enhancement || "Not set"],
                      ["Bloodwork", bloodwork || "Not set"],
                      ["Check-in", `${CHECKIN_DAYS[checkInDay]} · ${checkInFreq}`],
                    ].map(([k, v]) => (
                      <div key={k} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
                        <p className="font-mono text-[7px] uppercase tracking-[0.18em] text-white/30">{k}</p>
                        <p className="mt-0.5 truncate text-[11px] font-medium" style={{ color: SOFT }}>{v}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <Coffee size={11} style={{ color: `${STEEL}b0` }} />
                    <span className="text-[10px] text-white/40">{COFFEE_LABEL[coffee]} · {dairyAllowed ? "dairy ok" : "dairy-free"}</span>
                  </div>
                </>
              )}

            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer nav */}
        <div className="flex items-center justify-between gap-3 border-t border-white/[0.06] px-6 py-4">
          <button type="button" onClick={back} disabled={stepIdx === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.1] bg-white/[0.02] px-3 py-2 font-mono text-[8.5px] uppercase tracking-[0.16em] text-white/55 transition hover:bg-white/[0.05] disabled:opacity-30">
            <ChevronLeft size={11} /> Back
          </button>
          <button type="button" onClick={guard.requestClose} className="font-mono text-[8px] uppercase tracking-[0.16em] text-white/35 hover:text-white/55">Skip for now</button>
          {step === "confirm" ? (
            <button type="button" onClick={finish}
              className="inline-flex items-center gap-2 rounded-xl border px-5 py-2.5 font-mono text-[9px] font-bold uppercase tracking-[0.18em] transition hover:brightness-110"
              style={{ borderColor: `${GOLD}60`, background: `linear-gradient(120deg, ${GOLD}28, ${GOLD_BRIGHT}18)`, color: GOLD_BRIGHT, boxShadow: `0 0 24px ${GOLD}20` }}>
              <Check size={12} /> Enter Apex Command
            </button>
          ) : (
            <button type="button" onClick={next}
              className="inline-flex items-center gap-2 rounded-xl border px-5 py-2.5 font-mono text-[9px] font-bold uppercase tracking-[0.18em] transition hover:brightness-110"
              style={{ borderColor: `${GOLD}55`, background: `${GOLD}14`, color: GOLD_BRIGHT }}>
              Next <ChevronRight size={12} />
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
