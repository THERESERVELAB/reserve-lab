"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Baby,
  Briefcase,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleUserRound,
  Clock,
  Crown,
  Dumbbell,
  HeartPulse,
  Plane,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  UserRound,
  Users,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import {
  CoachingProfile,
  MemberGenderIdentity,
  NutritionPrepPreference,
  OnboardingWritePayload,
  PhysiqueGoal,
  useAthleteDashboardStore,
} from "@/lib/athlete-store";
import {
  ONBOARDING_DRAFT_VERSION,
  PUBLIC_PRICING,
  SUBSCRIPTION_TIERS,
  publicTierFor,
  type SubscriptionTier,
  type UserPersona,
} from "@/lib/saas-config";
import { useUpgradeCheckout } from "@/components/subscription/useUpgradeCheckout";
import { productionPlate } from "@/lib/brand/asset-manifest";
import { useIsPhone } from "@/lib/hooks/useMediaQuery";
import type { TrainingWindow } from "@/lib/schedule/types";
import { recommendProtocols, type ProtocolDefinition } from "@/lib/protocol/library";
import { requestSyncFlush } from "@/lib/sync/flush-signal";
import { useSyncStatusStore, type SyncStatus } from "@/lib/sync/sync-status";

type ReserveProfileData = {
  name: string;
  genderIdentity: MemberGenderIdentity | "";
  /** Current Chapter — ONE primary identity (premium card select). */
  currentChapter: string;
  /** Life Context — optional supporting modifiers (refined secondary). */
  lifeContext: string[];
  /** Legacy multi-select kept for storage compat; derived from the two above. */
  lifeStages: string[];
  healthContext: string[];
  healthNotes: string;
  medications: string;
  injuryNotes: string;
  bodyGoals: string[];
  trainingStyles: string[];
  goalStack: string[];
  lifestyle: string[];
  trainingDays: number;
  preferredWindow: string;
  wakeTime: string;
  sleepTime: string;
  motivationStyle: string;
  tier: SubscriptionTier;
  // Operating preferences (Tier-1 personalization captured in one premium pass)
  sessionDuration: number;
  equipmentAccess: EquipmentAccess;
  cardioPreference: string;
  recoveryPreference: string;
  nutritionGoal: string;
  mealStyle: NutritionPrepPreference;
  enhancedTracking: boolean;
  protocolId: string | null;
};

type EquipmentAccess = "luxury-premium" | "commercial-performance" | "home-gym" | "minimal-travel";

type SelectOption = {
  value: string;
  label: string;
  description?: string;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
};

const GOLD = "#d5b15f";
const BLUE = "#7dd3ee";
const GREEN = "#79e3b5";
const VIOLET = "#a78bfa";
const RED = "#ef7d55";

const INITIAL: ReserveProfileData = {
  name: "",
  genderIdentity: "",
  currentChapter: "",
  lifeContext: [],
  lifeStages: [],
  healthContext: [],
  healthNotes: "",
  medications: "",
  injuryNotes: "",
  bodyGoals: [],
  trainingStyles: [],
  goalStack: [],
  lifestyle: [],
  trainingDays: 4,
  preferredWindow: "Evening",
  wakeTime: "6:30 AM",
  sleepTime: "10:30 PM",
  motivationStyle: "Calm precision",
  tier: "core",
  sessionDuration: 60,
  equipmentAccess: "commercial-performance",
  cardioPreference: "Moderate",
  recoveryPreference: "Balanced",
  nutritionGoal: "",
  mealStyle: "cook-fresh",
  enhancedTracking: false,
  protocolId: null,
};

const TOTAL_STEPS = 8;

/* ── Current Chapter — ONE primary identity, presented as premium cards ── */
const CHAPTER_OPTIONS: Array<SelectOption & { impact: string }> = [
  { value: "lifestyle-transformation", label: "Lifestyle Transformation", icon: Sparkles,
    description: "A complete rebuild of how you train, eat, and recover.",
    impact: "Balanced progression, habit anchors, and sustainable volume." },
  { value: "foundation", label: "Starting My Foundation", icon: Target,
    description: "New to structured training — building the base properly.",
    impact: "Patient load ramps, movement mastery first, protected recovery." },
  { value: "returning-strong", label: "Returning Strong", icon: ShieldCheck,
    description: "Coming back after time away — rebuilding with intent.",
    impact: "Re-entry volume, tissue re-conditioning, fast but honest ramp." },
  { value: "former-athlete", label: "Former Athlete", icon: Trophy,
    description: "Competitive history — the engine remembers.",
    impact: "Higher starting capacity, aggressive progression windows." },
  { value: "strength-performance", label: "Strength & Performance", icon: Dumbbell,
    description: "Output first — strength standards and performance markers.",
    impact: "Heavy compound priority, top-set structures, performance tracking." },
  { value: "physique-competitor", label: "Physique Competitor", icon: Crown,
    description: "Stage-level physique work with contest-aware planning.",
    impact: "Weak-point sequencing, contest-prep phases, physique check cadence." },
];

/* ── Life Context — optional supporting modifiers (refined, gender-aware) ── */
const CONTEXT_OPTIONS: Array<SelectOption & { femaleOnly?: boolean; impact: string }> = [
  { value: "busy-professional", label: "Busy Professional", icon: Briefcase,
    impact: "Session-length discipline and schedule-proof programming." },
  { value: "parent-caregiver", label: "Parent or Caregiver", icon: Users,
    impact: "Flexible windows, interruption-tolerant sessions, sleep protection." },
  { value: "frequent-traveler", label: "Frequent Traveler", icon: Plane,
    impact: "Hotel/minimal-equipment substitutions and timezone-aware recovery." },
  { value: "limited-time", label: "Limited Training Time", icon: Clock,
    impact: "Compressed high-yield sessions — nothing decorative." },
  { value: "masters-50", label: "Masters Athlete 50+", icon: ShieldCheck,
    impact: "Longevity strength, joint-first selection, deeper recovery reserve." },
  { value: "reproductive-vitality", label: "Reproductive Vitality", icon: HeartPulse,
    impact: "Recovery, sleep, and stress signals weighted for hormonal health awareness." },
  { value: "maternal-performance", label: "Maternal Performance", icon: Baby, femaleOnly: true,
    impact: "Training and recovery language built around the maternal season." },
  { value: "postpartum", label: "Postpartum Restoration", icon: Baby, femaleOnly: true,
    impact: "Gradual rebuilding, core and pelvic-floor-aware pacing, clinician-guided boundaries." },
];

const HEALTH_OPTIONS: SelectOption[] = [
  { value: "diabetes", label: "Diabetes", description: "Track energy, meals, and clinician-guided routines." },
  { value: "chf", label: "Chronic heart failure", description: "Use conservative planning and clinician guidance." },
  { value: "cancer-history", label: "Cancer history / active treatment", description: "Respect care-team guidance and recovery limits." },
  { value: "high-blood-pressure", label: "High blood pressure", description: "Flag intensity and recovery awareness." },
  { value: "injuries", label: "Injuries", description: "Adapt movement selection and warm-up priorities." },
  { value: "joint-limitations", label: "Joint limitations", description: "Use joint-friendly substitutions and load awareness." },
  { value: "medications", label: "Medications", description: "Record context for planning conversations." },
  { value: "sleep-issues", label: "Sleep issues", description: "Prioritize recovery alerts and sleep consistency." },
  { value: "recovery-limitations", label: "Recovery limitations", description: "Adjust volume, frequency, and intensity flags." },
];

const FEMALE_GOALS = [
  "Hourglass Build",
  "Sculpted & Toned",
  "Lean Pilates Body",
  "Bikini Confidence",
  "Strong Curves",
  "Athletic Definition",
  "Core & Abs Focus",
  "Postpartum Rebuild",
  "Strength Without Bulk",
  "Mobility & Longevity",
];

const FEMALE_STYLES = [
  "Pilates",
  "Yoga",
  "Strength Training",
  "CrossFit",
  "Barre",
  "Glute Growth",
  "Core Sculpting",
  "Conditioning",
  "Mobility",
  "Hybrid Athlete",
];

const MALE_GOALS = [
  "Classic Physique",
  "Lean Muscle",
  "Athletic Build",
  "Strength Reserve",
  "Fat Loss & Definition",
  "V-Taper",
  "Arms / Chest Focus",
  "Performance Body",
  "Longevity Strength",
  "Combat Conditioning",
];

const MALE_STYLES = [
  "Hypertrophy",
  "Strength Training",
  "Powerbuilding",
  "Athletic Conditioning",
  "Combat Conditioning",
  "Mobility",
  "Hybrid Athlete",
  "Classic Bodybuilding",
  "Functional Strength",
  "Longevity Training",
];

const CUSTOM_GOALS = [
  "Strong & Capable",
  "Energy & Confidence",
  "Mobility & Longevity",
  "Body Recomposition",
  "Pain-Aware Strength",
  "Lifestyle Structure",
  "Athletic Definition",
  "Health Marker Support",
  "Core Control",
  "Daily Discipline",
];

const CUSTOM_STYLES = [
  "Strength Training",
  "Mobility",
  "Yoga",
  "Pilates",
  "Conditioning",
  "Home Workouts",
  "Gym Training",
  "Walking",
  "Hybrid Athlete",
  "Low-Impact Training",
];

const GOAL_STACK_OPTIONS = [
  "Physique",
  "Strength",
  "Fat loss",
  "Muscle gain",
  "Energy",
  "Longevity",
  "Mobility",
  "Health markers",
  "Confidence",
  "Athletic performance",
  "Lifestyle structure",
];

const LIFESTYLE_OPTIONS = [
  "Gym",
  "Home workouts",
  "Running",
  "Walking",
  "Hiking",
  "Cycling",
  "Swimming",
  "Pickleball",
  "Basketball",
  "Soccer",
  "Golf",
  "Dancing",
  "Boating / beach lifestyle",
  "Travel",
  "Desk job",
  "Night shift",
  "Busy parent schedule",
];

const WINDOW_OPTIONS = ["Early morning", "Midday", "Afternoon", "Evening", "Late night", "Rotating"];
const MOTIVATION_OPTIONS = ["Calm precision", "High accountability", "Encouraging coach", "Data-driven", "Athlete mindset"];

const SESSION_DURATION_OPTIONS = [30, 45, 60, 75, 90, 120];

const EQUIPMENT_OPTIONS: { value: EquipmentAccess; label: string; description: string }[] = [
  { value: "luxury-premium", label: "Private / luxury facility", description: "Full premium equipment, every machine and free-weight available." },
  { value: "commercial-performance", label: "Full commercial gym", description: "Complete machines, cables, and free weights." },
  { value: "home-gym", label: "Home gym", description: "Core free weights and a few machines or bands." },
  { value: "minimal-travel", label: "Minimal / travel", description: "Bodyweight, bands, and whatever the hotel has." },
];

const CARDIO_OPTIONS = ["Minimal", "Light", "Moderate", "High", "Conditioning-led"];
const RECOVERY_OPTIONS = ["Aggressive", "Balanced", "Protective"];

const FEMALE_NUTRITION_GOALS = ["Sculpt & lean", "Shape & recomp", "Build curves", "Athletic performance", "Lifestyle balance"];
const MALE_NUTRITION_GOALS = ["Fat loss & definition", "Lean recomposition", "Muscle & mass", "Athletic performance", "Lifestyle maintenance"];

const MEAL_STYLE_OPTIONS: { value: NutritionPrepPreference; label: string; description: string }[] = [
  { value: "batch", label: "Batch / meal prep", description: "Cook once, eat through the week." },
  { value: "cook-fresh", label: "Cook fresh", description: "Prepare meals close to when you eat them." },
  { value: "low-prep", label: "Low-prep / fast", description: "Minimal cooking, quick assembly, and grab-and-go." },
];

/** Map a wizard nutrition-goal label to the canonical women's nutrition goal. */
function mapWomensNutritionGoal(label: string): OnboardingWritePayload["womensNutritionGoal"] {
  const t = label.toLowerCase();
  if (t.includes("sculpt") || t.includes("lean") || t.includes("fat")) return "fat-loss";
  if (t.includes("recomp") || t.includes("shape")) return "recomp";
  if (t.includes("curve") || t.includes("build") || t.includes("muscle") || t.includes("mass")) return "muscle-building";
  if (t.includes("athletic") || t.includes("performance")) return "athletic-performance";
  return "lifestyle-fitness";
}

/** Map equipment access to the canonical training gym environment. */
function mapGymEnvironment(access: EquipmentAccess): "luxury-premium" | "commercial-performance" | "home-gym" | "minimal-travel" {
  return access;
}

function toggleSelection(values: string[], value: string) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

/** Module names for the elite step sequence — shown in the header + rail. */
const STEP_META: { label: string; short: string }[] = [
  { label: "Identity + Life Stage", short: "Identity" },
  { label: "Health Context", short: "Health" },
  { label: "Body Goal Path", short: "Goals" },
  { label: "Goal Stack", short: "Stack" },
  { label: "Lifestyle + Schedule", short: "Schedule" },
  { label: "Operating Preferences", short: "Operating" },
  { label: "Member Identity", short: "Name" },
  { label: "Profile Summary", short: "Summary" },
];

function StepProgress({ step }: { step: number }) {
  return (
    <div>
      <div className="flex items-center gap-1.5">
        {Array.from({ length: TOTAL_STEPS }).map((_, index) => {
          const active = index === step;
          const done = index < step;
          return (
            <div key={index} className="relative h-[3px] flex-1 overflow-hidden rounded-full bg-white/[0.06]">
              <motion.div
                className="absolute inset-y-0 left-0 rounded-full"
                initial={false}
                animate={{ width: done ? "100%" : active ? "100%" : "0%" }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                style={{
                  background: active
                    ? `linear-gradient(90deg, ${GOLD}, #e8c87a)`
                    : `${GOLD}80`,
                  boxShadow: active ? `0 0 12px ${GOLD}70` : "none",
                }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 hidden items-center gap-1.5 sm:flex">
        {STEP_META.map((meta, index) => (
          <span
            key={meta.short}
            className="flex-1 truncate text-center font-mono text-[7px] uppercase tracking-[0.14em] transition-colors duration-300"
            style={{ color: index === step ? GOLD : index < step ? "rgba(213,177,95,0.45)" : "rgba(255,255,255,0.18)" }}
          >
            {meta.short}
          </span>
        ))}
      </div>
    </div>
  );
}

function Chip({
  label,
  selected,
  onClick,
  icon: Icon,
  accent = GOLD,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  accent?: string;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.97 }}
      className="relative inline-flex min-h-11 items-center gap-2 overflow-hidden rounded-xl border px-3.5 py-2 text-left text-[12px] font-semibold transition-colors duration-200"
      style={{
        borderColor: selected ? `${accent}5c` : "rgba(255,255,255,0.08)",
        background: selected
          ? `linear-gradient(160deg, ${accent}1e 0%, ${accent}08 100%)`
          : "linear-gradient(160deg, rgba(255,255,255,0.035) 0%, rgba(255,255,255,0.012) 100%)",
        color: selected ? accent : "rgba(255,255,255,0.6)",
        boxShadow: selected
          ? `0 0 24px ${accent}1c, inset 0 1px 0 ${accent}28`
          : "inset 0 1px 0 rgba(255,255,255,0.03)",
      }}
    >
      {Icon && <Icon size={14} />}
      {label}
      {selected && <Check size={12} className="ml-0.5 opacity-80" />}
    </motion.button>
  );
}

function SelectCard({
  label,
  description,
  selected,
  onClick,
  icon: Icon,
  accent = GOLD,
}: {
  label: string;
  description?: string;
  selected: boolean;
  onClick: () => void;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  accent?: string;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.985 }}
      className="relative overflow-hidden rounded-2xl border p-4 text-left transition-colors duration-200"
      style={{
        borderColor: selected ? `${accent}5c` : "rgba(255,255,255,0.07)",
        background: selected
          ? `linear-gradient(165deg, ${accent}16 0%, ${accent}05 60%, transparent 100%)`
          : "linear-gradient(165deg, rgba(255,255,255,0.035) 0%, rgba(255,255,255,0.01) 100%)",
        boxShadow: selected
          ? `0 8px 32px rgba(0,0,0,0.35), 0 0 28px ${accent}14, inset 0 1px 0 ${accent}30`
          : "inset 0 1px 0 rgba(255,255,255,0.04)",
      }}
    >
      {/* Top-edge light for the selected module */}
      {selected && (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px"
          style={{ background: `linear-gradient(90deg, transparent, ${accent}88, transparent)` }}
        />
      )}
      <div className="flex items-start gap-3">
        {Icon && (
          <span
            className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl border transition-colors duration-200"
            style={{
              borderColor: selected ? `${accent}4a` : "rgba(255,255,255,0.08)",
              background: selected ? `${accent}14` : "rgba(255,255,255,0.02)",
              color: selected ? accent : "rgba(255,255,255,0.35)",
              boxShadow: selected ? `0 0 18px ${accent}22` : "none",
            }}
          >
            <Icon size={18} />
          </span>
        )}
        <div className="min-w-0">
          <p className="text-sm font-bold tracking-tight" style={{ color: selected ? accent : "#f2eee6" }}>
            {label}
          </p>
          {description && <p className="mt-1 text-xs font-medium leading-5 text-white/42">{description}</p>}
        </div>
        {selected && (
          <span
            className="ml-auto grid h-5 w-5 flex-shrink-0 place-items-center rounded-full"
            style={{ background: `${accent}22`, color: accent }}
          >
            <Check size={12} />
          </span>
        )}
      </div>
    </motion.button>
  );
}

function StepShell({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="h-px w-8 flex-shrink-0" style={{ background: `linear-gradient(90deg, ${GOLD}90, transparent)` }} />
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#d5b15f]/80">{eyebrow}</p>
      </div>
      <h2 className="mt-3 text-3xl font-black uppercase leading-[1.05] tracking-tight text-[#f2eee6] sm:text-4xl" style={{ fontFamily: "var(--font-display)" }}>
        {title}
      </h2>
      {subtitle && <p className="mt-3 max-w-2xl text-sm font-medium leading-7 text-white/50">{subtitle}</p>}
      <div className="mt-6">{children}</div>
    </div>
  );
}

export function LifeStageSelector({
  data,
  onChange,
}: {
  data: ReserveProfileData;
  onChange: (patch: Partial<ReserveProfileData>) => void;
}) {
  const female = data.genderIdentity === "female";
  // Gender gate: maternal options never render on the male path.
  const contextOptions = CONTEXT_OPTIONS.filter((o) => !o.femaleOnly || female);
  const selectedChapter = CHAPTER_OPTIONS.find((c) => c.value === data.currentChapter);
  const selectedContexts = CONTEXT_OPTIONS.filter((c) => data.lifeContext.includes(c.value));

  return (
    <StepShell
      eyebrow="Private performance consultation"
      title="Which chapter are you in?"
      subtitle="One primary chapter sets the architecture. Optional context refines how Reserve schedules, fuels, and protects you."
    >
      <div className="grid gap-5">
        {/* Identity path — Male / Female. Legacy "customized" values stay valid
            in storage; the member is simply asked to confirm one of the two paths. */}
        <div className="grid gap-3 sm:grid-cols-2">
          <SelectCard
            label="Male"
            description="Male performance path — physique architecture, strength standards, and goal language built for the male frame."
            icon={UserRound}
            selected={data.genderIdentity === "male"}
            onClick={() =>
              onChange({
                genderIdentity: "male",
                bodyGoals: [],
                trainingStyles: [],
                // Never carry maternal options onto the male path.
                lifeContext: data.lifeContext.filter(
                  (v) => !CONTEXT_OPTIONS.find((o) => o.value === v)?.femaleOnly,
                ),
              })
            }
          />
          <SelectCard
            label="Female"
            description="Female performance path — shape architecture, maternal-aware options, and curves / tone programming."
            icon={CircleUserRound}
            accent={VIOLET}
            selected={data.genderIdentity === "female"}
            onClick={() => onChange({ genderIdentity: "female", bodyGoals: [], trainingStyles: [] })}
          />
        </div>

        {/* ── Current Chapter — one primary selection, premium cards ── */}
        <div>
          <div className="mb-3 flex items-center gap-2">
            <span className="h-px w-6" style={{ background: `${GOLD}70` }} />
            <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-white/35">Current Chapter · choose one</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {CHAPTER_OPTIONS.map((option) => (
              <SelectCard
                key={option.value}
                label={option.label}
                description={option.description ?? ""}
                icon={option.icon}
                selected={data.currentChapter === option.value}
                onClick={() => onChange({ currentChapter: option.value })}
              />
            ))}
          </div>
        </div>

        {/* ── Life Context — optional refined modifiers ── */}
        <div className="rounded-3xl border border-white/[0.06] bg-white/[0.018] p-5">
          <div className="flex items-center gap-2">
            <span className="h-px w-6" style={{ background: `${BLUE}70` }} />
            <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-white/35">Life Context · optional, select any</p>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {contextOptions.map((option) => (
              <Chip
                key={option.value}
                label={option.label}
                icon={option.icon}
                selected={data.lifeContext.includes(option.value)}
                onClick={() => onChange({ lifeContext: toggleSelection(data.lifeContext, option.value) })}
              />
            ))}
          </div>

          {/* Live impact preview — what these selections actually change. */}
          {(selectedChapter || selectedContexts.length > 0) && (
            <div className="mt-4 space-y-1.5 rounded-2xl border border-white/[0.05] bg-black/20 p-4">
              <p className="font-mono text-[8px] uppercase tracking-[0.2em] text-white/30">How this shapes your Reserve</p>
              {selectedChapter && (
                <p className="text-[11px] leading-5 text-white/55">
                  <span style={{ color: GOLD }}>{selectedChapter.label}:</span> {selectedChapter.impact}
                </p>
              )}
              {selectedContexts.map((c) => (
                <p key={c.value} className="text-[11px] leading-5 text-white/45">
                  <span style={{ color: BLUE }}>{c.label}:</span> {c.impact}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>
    </StepShell>
  );
}

export function HealthContextIntake({
  data,
  onChange,
}: {
  data: ReserveProfileData;
  onChange: (patch: Partial<ReserveProfileData>) => void;
}) {
  return (
    <StepShell
      eyebrow="Health coach layer"
      title="Set safe coaching context."
      subtitle="This gives your Reserve profile planning awareness around limitations, recovery needs, and clinician-guided boundaries without turning profile setup into a medical form."
    >
      <div className="rounded-2xl border border-[#7dd3ee]/20 bg-[#7dd3ee]/[0.07] p-4">
        <div className="flex gap-3">
          <HeartPulse size={18} className="mt-0.5 flex-shrink-0 text-[#7dd3ee]" />
          <p className="text-sm leading-6 text-white/62">
            The Reserve Method supports coaching, nutrition, habit tracking, and wellness planning. It does not
            diagnose, treat, or replace medical care. Members with medical conditions should follow clinician guidance.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {HEALTH_OPTIONS.map((option) => (
          <SelectCard
            key={option.value}
            label={option.label}
            description={option.description}
            accent={BLUE}
            selected={data.healthContext.includes(option.value)}
            onClick={() => onChange({ healthContext: toggleSelection(data.healthContext, option.value) })}
          />
        ))}
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <TextBox
          label="Injuries / joint limits"
          value={data.injuryNotes}
          onChange={(injuryNotes) => onChange({ injuryNotes })}
          placeholder="e.g. left knee, shoulder history"
        />
        <TextBox
          label="Medications"
          value={data.medications}
          onChange={(medications) => onChange({ medications })}
          placeholder="Optional context only"
        />
        <TextBox
          label="Recovery notes"
          value={data.healthNotes}
          onChange={(healthNotes) => onChange({ healthNotes })}
          placeholder="Sleep, fatigue, care-team notes"
        />
      </div>
    </StepShell>
  );
}

function TextBox({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="block rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
      <span className="font-mono text-[8px] uppercase tracking-[0.2em] text-white/28">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={4}
        maxLength={500}
        className="mt-3 w-full resize-none bg-transparent text-sm leading-6 text-[#f2eee6] outline-none placeholder:text-white/18"
      />
    </label>
  );
}

function goalListsForGender(gender: ReserveProfileData["genderIdentity"]) {
  if (gender === "female") return { goals: FEMALE_GOALS, styles: FEMALE_STYLES, accent: VIOLET };
  if (gender === "male") return { goals: MALE_GOALS, styles: MALE_STYLES, accent: GOLD };
  return { goals: CUSTOM_GOALS, styles: CUSTOM_STYLES, accent: BLUE };
}

export function GenderGoalSelector({
  data,
  onChange,
}: {
  data: ReserveProfileData;
  onChange: (patch: Partial<ReserveProfileData>) => void;
}) {
  const { goals, styles, accent } = goalListsForGender(data.genderIdentity);

  return (
    <StepShell
      eyebrow="Body goal path"
      title="Define the outcome you want to build."
      subtitle="Select the outcomes your Reserve profile should prioritize across training, recovery, nutrition, and daily execution."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <p className="mb-3 font-mono text-[9px] uppercase tracking-[0.22em] text-white/28">Body goal cards</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {goals.map((goal) => (
              <Chip
                key={goal}
                label={goal}
                accent={accent}
                selected={data.bodyGoals.includes(goal)}
                onClick={() => onChange({ bodyGoals: toggleSelection(data.bodyGoals, goal) })}
              />
            ))}
          </div>
        </div>
        <div>
          <p className="mb-3 font-mono text-[9px] uppercase tracking-[0.22em] text-white/28">Training style options</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {styles.map((style) => (
              <Chip
                key={style}
                label={style}
                accent={GREEN}
                selected={data.trainingStyles.includes(style)}
                onClick={() => onChange({ trainingStyles: toggleSelection(data.trainingStyles, style) })}
              />
            ))}
          </div>
        </div>
      </div>
    </StepShell>
  );
}

export function GoalStackSelector({
  data,
  onChange,
}: {
  data: ReserveProfileData;
  onChange: (patch: Partial<ReserveProfileData>) => void;
}) {
  return (
    <StepShell
      eyebrow="Multi-goal stack"
      title="Build your goal stack."
      subtitle="The Reserve system should coach the whole person: body, energy, confidence, mobility, health markers, and daily structure."
    >
      <div className="flex flex-wrap gap-2">
        {GOAL_STACK_OPTIONS.map((goal) => (
          <Chip
            key={goal}
            label={goal}
            accent={goal === "Health markers" ? BLUE : goal === "Confidence" ? VIOLET : GOLD}
            selected={data.goalStack.includes(goal)}
            onClick={() => onChange({ goalStack: toggleSelection(data.goalStack, goal) })}
          />
        ))}
      </div>
    </StepShell>
  );
}

export function LifestyleSelector({
  data,
  onChange,
}: {
  data: ReserveProfileData;
  onChange: (patch: Partial<ReserveProfileData>) => void;
}) {
  return (
    <StepShell
      eyebrow="Lifestyle + schedule"
      title="Build around the actual day."
      subtitle="Your schedule, commute, sleep, work, and lifestyle should shape the plan instead of fighting it."
    >
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div>
          <p className="mb-3 font-mono text-[9px] uppercase tracking-[0.22em] text-white/28">Lifestyle chips</p>
          <div className="flex flex-wrap gap-2">
            {LIFESTYLE_OPTIONS.map((item) => (
              <Chip
                key={item}
                label={item}
                accent={item.includes("Night") || item.includes("Busy") ? RED : BLUE}
                selected={data.lifestyle.includes(item)}
                onClick={() => onChange({ lifestyle: toggleSelection(data.lifestyle, item) })}
              />
            ))}
          </div>
        </div>
        <div className="rounded-3xl border border-white/[0.07] bg-white/[0.025] p-5">
          <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-white/28">Schedule command</p>
          <div className="mt-4 grid grid-cols-7 gap-1.5">
            {[1, 2, 3, 4, 5, 6, 7].map((day) => (
              <button
                key={day}
                type="button"
                onClick={() => onChange({ trainingDays: day })}
                className="rounded-xl border py-3 font-mono text-sm font-black"
                style={{
                  borderColor: data.trainingDays === day ? `${GOLD}66` : "rgba(255,255,255,0.08)",
                  background: data.trainingDays === day ? `${GOLD}16` : "rgba(255,255,255,0.025)",
                  color: data.trainingDays === day ? GOLD : "rgba(255,255,255,0.4)",
                }}
              >
                {day}
              </button>
            ))}
          </div>
          <p className="mt-2 text-center font-mono text-[8px] uppercase tracking-[0.18em] text-white/22">
            training days / week
          </p>
          <div className="mt-5 grid gap-3">
            <InlineField label="Wake" value={data.wakeTime} onChange={(wakeTime) => onChange({ wakeTime })} />
            <InlineField label="Sleep" value={data.sleepTime} onChange={(sleepTime) => onChange({ sleepTime })} />
            <div>
              <p className="mb-2 font-mono text-[8px] uppercase tracking-[0.18em] text-white/28">Training window</p>
              <div className="flex flex-wrap gap-2">
                {WINDOW_OPTIONS.map((window) => (
                  <Chip
                    key={window}
                    label={window}
                    selected={data.preferredWindow === window}
                    onClick={() => onChange({ preferredWindow: window })}
                    accent={GREEN}
                  />
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 font-mono text-[8px] uppercase tracking-[0.18em] text-white/28">Motivation style</p>
              <div className="flex flex-wrap gap-2">
                {MOTIVATION_OPTIONS.map((style) => (
                  <Chip
                    key={style}
                    label={style}
                    selected={data.motivationStyle === style}
                    onClick={() => onChange({ motivationStyle: style })}
                    accent={VIOLET}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </StepShell>
  );
}

function InlineField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid grid-cols-[70px_1fr] items-center gap-3">
      <span className="font-mono text-[8px] uppercase tracking-[0.18em] text-white/28">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-xl border border-white/[0.08] bg-white/[0.035] px-3 py-2 text-sm text-[#f2eee6] outline-none"
      />
    </label>
  );
}

function buildCoachingNotes(data: ReserveProfileData) {
  const notes = [
    `Training split: ${data.trainingDays} days / week with ${data.preferredWindow.toLowerCase()} sessions.`,
    `Exercise selection: bias ${data.trainingStyles.slice(0, 3).join(", ") || "strength and mobility"} with ${data.injuryNotes ? "movement precautions enabled" : "standard progression"}.`,
    `Nutrition targets: support ${data.goalStack.slice(0, 3).join(", ") || "energy, protein, and hydration"} with habit tracking.`,
    `Recovery alerts: sleep window ${data.sleepTime}; wake target ${data.wakeTime}.`,
    `Intensity: ${data.healthContext.length > 0 ? "conservative ramp with clinician-guided boundaries" : "adaptive to readiness and training history"}.`,
    `Motivation style: ${data.motivationStyle}.`,
  ];

  if (data.lifeContext.includes("postpartum")) {
    notes.push("Postpartum Restoration context: prioritize gradual rebuilding, core control, pelvic-floor-aware language, and clinician guidance.");
  }
  if (data.lifeContext.includes("maternal-performance")) {
    notes.push("Maternal Performance context: training and recovery language framed around the maternal season, clinician-guided boundaries respected.");
  }
  if (data.lifeContext.includes("masters-50")) {
    notes.push("Masters Athlete 50+ context: prioritize longevity strength, balance, mobility, and recovery reserve.");
  }
  if (data.lifeContext.includes("reproductive-vitality")) {
    notes.push("Reproductive Vitality context: weight sleep, stress, and recovery signals for hormonal-health awareness (observational only).");
  }
  if (data.lifestyle.includes("Night shift")) {
    notes.push("Night shift context: schedule reminders around sleep protection and consistent meal anchors.");
  }

  return notes;
}

function buildAlertPlan(data: ReserveProfileData) {
  return [
    "Meal reminder based on training window",
    "Drive-to-gym reminder",
    "Pre-workout snack reminder",
    "Electrolyte reminder",
    "Post-workout nutrition reminder",
    "Recovery check reminder",
    `Sleep wind-down near ${data.sleepTime}`,
  ];
}

function previewList(values: string[], fallback: string, limit = 3) {
  return values.length > 0 ? values.slice(0, limit).join(" · ") : fallback;
}

function displayGender(value: ReserveProfileData["genderIdentity"]) {
  if (value === "male") return "Male path";
  if (value === "female") return "Female path";
  if (value === "custom") return "Customized path";
  return "Profile path pending";
}

/** How complete the in-progress profile is — drives the live meter. */
function profileCompletion(data: ReserveProfileData): number {
  const checkpoints = [
    data.genderIdentity !== "",
    data.currentChapter !== "",
    data.bodyGoals.length > 0,
    data.trainingStyles.length > 0,
    data.goalStack.length > 0,
    data.lifestyle.length > 0,
    data.nutritionGoal.trim().length > 0,
    data.name.trim().length > 0,
  ];
  return Math.round((checkpoints.filter(Boolean).length / checkpoints.length) * 100);
}

function ReservePreviewPanel({ data }: { data: ReserveProfileData }) {
  const displayName = data.name.trim() || "Member";
  const tier = SUBSCRIPTION_TIERS[data.tier];
  const female = data.genderIdentity === "female";
  const pathAccent = female ? VIOLET : GOLD;
  const completion = profileCompletion(data);
  const initial = (data.name.trim()[0] || "R").toUpperCase();

  return (
    <aside
      className="relative overflow-hidden rounded-[26px] border p-5 lg:sticky lg:top-6 lg:self-start"
      style={{
        borderColor: `${pathAccent}22`,
        background: "linear-gradient(170deg, rgba(10,11,17,0.92) 0%, rgba(6,7,11,0.96) 100%)",
        boxShadow: "0 24px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)",
        backdropFilter: "blur(20px)",
      }}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${pathAccent}60, transparent)` }} />

      {/* Identity header */}
      <div className="flex items-center gap-3">
        <span
          className="grid h-12 w-12 flex-shrink-0 place-items-center rounded-2xl border text-lg font-black"
          style={{ borderColor: `${pathAccent}40`, background: `${pathAccent}12`, color: pathAccent, boxShadow: `0 0 24px ${pathAccent}1e` }}
        >
          {initial}
        </span>
        <div className="min-w-0">
          <p className="font-mono text-[8px] uppercase tracking-[0.24em]" style={{ color: `${pathAccent}cc` }}>Live Profile Preview</p>
          <h3 className="truncate text-lg font-black tracking-tight text-[#f2eee6]">{displayName}</h3>
          <p className="truncate text-[11px] font-medium text-white/40">{displayGender(data.genderIdentity)} · {tier.label}</p>
        </div>
        <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-[#79e3b5]/24 bg-[#79e3b5]/[0.08] px-2 py-0.5 font-mono text-[8px] uppercase tracking-[0.14em] text-[#79e3b5]">
          <span className="h-1 w-1 animate-pulse rounded-full bg-[#79e3b5]" />Live
        </span>
      </div>

      {/* Completion meter */}
      <div className="mt-4">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[8px] uppercase tracking-[0.2em] text-white/30">Profile calibration</span>
          <span className="font-mono text-[10px] font-bold" style={{ color: pathAccent }}>{completion}%</span>
        </div>
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/[0.06]">
          <motion.div
            className="h-full rounded-full"
            initial={false}
            animate={{ width: `${Math.max(4, completion)}%` }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            style={{ background: `linear-gradient(90deg, ${pathAccent}, #e8c87a)`, boxShadow: `0 0 10px ${pathAccent}60` }}
          />
        </div>
      </div>

      {/* Grouped command layer — compact two-column rows */}
      <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
        <PreviewRow label="Training" value={previewList(data.trainingStyles, "Pending", 2)} />
        <PreviewRow label="Goals" value={previewList(data.goalStack, "Pending", 2)} />
        <PreviewRow label="Outcome" value={previewList(data.bodyGoals, "Pending", 2)} />
        <PreviewRow label="Schedule" value={`${data.trainingDays} days · ${data.preferredWindow}`} />
        <PreviewRow label="Recovery" value={`${data.sleepTime} → ${data.wakeTime}`} />
        <PreviewRow label="Tone" value={data.motivationStyle} />
      </div>

      {/* Planning awareness signal */}
      <div
        className="mt-3 rounded-2xl border p-3.5"
        style={{ borderColor: data.healthContext.length > 0 ? `${RED}26` : `${GREEN}20`, background: data.healthContext.length > 0 ? `${RED}08` : `${GREEN}06` }}
      >
        <p className="font-mono text-[8px] uppercase tracking-[0.2em]" style={{ color: data.healthContext.length > 0 ? `${RED}cc` : `${GREEN}cc` }}>
          Planning awareness
        </p>
        <p className="mt-1.5 text-[12px] font-medium leading-5 text-white/55">
          {data.healthContext.length > 0
            ? "Conservative planning · clinician guidance respected"
            : "Standard readiness-aware planning"}
        </p>
      </div>

      {/* What the system builds from this */}
      <div className="mt-3 grid gap-2 rounded-2xl border border-[#d5b15f]/14 bg-[#d5b15f]/[0.045] p-4">
        <p className="font-mono text-[8px] uppercase tracking-[0.2em] text-[#d5b15f]/80">This profile commands</p>
        {[
          "Session architecture + weekly split",
          "Fuel targets + meal windows",
          "Recovery protection + sleep rhythm",
          `${data.motivationStyle} coaching voice`,
        ].map((line) => (
          <div key={line} className="flex items-center gap-2 text-[12px] font-medium text-white/52">
            <span className="h-1 w-1 flex-shrink-0 rounded-full" style={{ background: `${GOLD}90` }} />
            {line}
          </div>
        ))}
      </div>
    </aside>
  );
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <span className="block font-mono text-[8px] uppercase tracking-[0.18em] text-white/26">{label}</span>
      <span className="mt-0.5 block truncate text-[12.5px] font-semibold leading-5 text-[#f2eee6]/88">{value}</span>
    </div>
  );
}

export function CoachingProfileSummary({
  data,
  onChange,
}: {
  data: ReserveProfileData;
  onChange: (patch: Partial<ReserveProfileData>) => void;
}) {
  const female = data.genderIdentity === "female";
  const accent = female ? VIOLET : GOLD;
  const shouldReduceMotion = useReducedMotion();
  /* Upgrading from the wizard is a real transaction, not a local tier write. */
  const {
    startCheckout,
    pending: billingPending,
    error: billingError,
  } = useUpgradeCheckout();

  const recommended = useMemo(() => recommendForData(data), [data]);

  // Visual default: highlight the top recommendation until the member picks one.
  // The actual fallback is committed in finish() so we never mutate state during render.
  const selectedProtocolId = data.protocolId ?? recommended[0]?.id ?? null;
  const selectedProtocol = recommended.find((p) => p.id === selectedProtocolId) ?? recommended[0];
  const alternates = recommended.filter((p) => p.id !== (selectedProtocol?.id ?? ""));

  const chapter = CHAPTER_OPTIONS.find((c) => c.value === data.currentChapter);
  const firstName = data.name.trim().split(" ")[0] || "Member";

  // The reveal reads as one coherent system — five load-bearing rows, no filler.
  const systemRows: Array<{ label: string; value: string; detail: string }> = [
    {
      label: "Training Architecture",
      value: `${data.trainingDays} days / week · ${data.trainingStyles.slice(0, 2).join(" + ") || "Reserve Method"}`,
      detail: `${data.preferredWindow} sessions, ${data.sessionDuration} min, built around ${chapter?.label.toLowerCase() ?? "your chapter"}.`,
    },
    {
      label: "Nutrition Approach",
      value: data.nutritionGoal || "Performance fueling",
      detail: `Meal timing follows your real ${data.preferredWindow.toLowerCase()} training block — never a template clock.`,
    },
    {
      label: "Recovery Strategy",
      value: `${data.recoveryPreference} recovery posture`,
      detail: `Sleep window ${data.sleepTime} → ${data.wakeTime}, protected by wind-down and readiness checks.`,
    },
    {
      label: "Scheduling Intelligence",
      value: `${data.preferredWindow} training · ${data.trainingDays}×/week`,
      detail: "One schedule truth drives sessions, meals, hydration, and recovery prompts.",
    },
    {
      label: female ? "Physique Outcome" : "Performance Outcome",
      value: data.bodyGoals.slice(0, 2).join(" · ") || data.goalStack.slice(0, 2).join(" · ") || "Complete transformation",
      detail: chapter?.impact ?? "Progression tuned to your chapter and context.",
    },
  ];

  return (
    <StepShell
      eyebrow="Profile reveal"
      title={`Built for you, ${firstName}.`}
      subtitle="This is not a template. Every system below was assembled from your answers."
    >
      {/* ── Identity statement ── */}
      <motion.div
        initial={shouldReduceMotion ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="mb-5 rounded-3xl border p-6"
        style={{ borderColor: `${accent}30`, background: `linear-gradient(135deg, ${accent}12 0%, rgba(0,0,0,0.2) 70%)` }}
      >
        <p className="font-mono text-[9px] uppercase tracking-[0.24em]" style={{ color: accent }}>
          {chapter?.label ?? "Reserve Member"} · {female ? "Female Performance Path" : "Male Performance Path"}
        </p>
        <h2 className="mt-2 text-[26px] font-black leading-tight text-[#f2eee6]">
          {firstName}&apos;s Reserve is assembled.
        </h2>
        <p className="mt-2 max-w-[560px] text-[12px] leading-6 text-white/45">
          {chapter?.impact ?? "Training, nutrition, recovery, and scheduling now operate as one system."}
          {data.lifeContext.length > 0 &&
            ` Context honored: ${data.lifeContext
              .map((v) => CONTEXT_OPTIONS.find((o) => o.value === v)?.label ?? v)
              .join(", ")}.`}
        </p>
      </motion.div>

      {/* ── ONE dominant protocol card + compact alternates ── */}
      {selectedProtocol && (
        <motion.div
          initial={shouldReduceMotion ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: shouldReduceMotion ? 0 : 0.08, ease: [0.22, 1, 0.36, 1] }}
          className="mb-5"
        >
          <div className="rounded-3xl border p-6" style={{ borderColor: `${accent}45`, background: `${accent}0e` }}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono text-[9px] uppercase tracking-[0.24em]" style={{ color: accent }}>
                  Your Operating Protocol
                </p>
                <h3 className="mt-1.5 text-[20px] font-black text-[#f2eee6]">{selectedProtocol.name}</h3>
                <p className="mt-1.5 max-w-[520px] text-[12px] leading-6 text-white/50">{selectedProtocol.tagline}</p>
              </div>
              <span
                className="rounded-full border px-2.5 py-1 font-mono text-[8px] uppercase tracking-[0.18em]"
                style={{ borderColor: `${accent}40`, color: accent, background: `${accent}12` }}
              >
                Selected
              </span>
            </div>
          </div>
          {alternates.length > 0 && (
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {alternates.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onChange({ protocolId: p.id })}
                  className="rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-3 text-left transition hover:border-white/[0.16]"
                >
                  <span className="block text-[12px] font-semibold text-white/70">{p.name}</span>
                  <span className="mt-0.5 block text-[10px] leading-4 text-white/35">{p.tagline}</span>
                </button>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* ── The five systems, revealed in sequence ── */}
      <div className="grid gap-2.5">
        {systemRows.map((row, index) => (
          <motion.div
            key={row.label}
            initial={shouldReduceMotion ? false : { opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: shouldReduceMotion ? 0 : 0.14 + index * 0.06, ease: [0.22, 1, 0.36, 1] }}
            className="grid gap-1 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-5 py-4 sm:grid-cols-[200px_1fr]"
          >
            <p className="font-mono text-[8.5px] uppercase tracking-[0.2em] text-white/32 sm:pt-1">{row.label}</p>
            <div>
              <p className="text-[13px] font-semibold text-[#f2eee6]">{row.value}</p>
              <p className="mt-0.5 text-[11px] leading-5 text-white/38">{row.detail}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ── Access level — value, not a pricing table ── */}
      <motion.div
        initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: shouldReduceMotion ? 0 : 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="mt-5 rounded-3xl border border-[#d5b15f]/20 bg-[#d5b15f]/[0.05] p-5"
      >
        <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-[#d5b15f]">Reserve Access</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {PUBLIC_PRICING.map((plan) => {
            const active = publicTierFor(data.tier).id === plan.id;
            return (
              <button
                key={plan.id}
                type="button"
                /* Selecting a plan no longer writes the tier locally. The
                   member's current plan is inert; anything above it starts
                   real Stripe Checkout. */
                disabled={active || billingPending}
                title={active ? "This is your current plan." : undefined}
                onClick={() => void startCheckout(plan.internalTier)}
                className="rounded-2xl border px-4 py-3.5 text-left transition disabled:cursor-default"
                style={{
                  borderColor: active ? `${GOLD}66` : "rgba(255,255,255,0.08)",
                  background: active ? `${GOLD}14` : "rgba(255,255,255,0.02)",
                }}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-[#f2eee6]">{plan.label}</span>
                  <span className="font-mono text-[10px] text-[#d5b15f]">{plan.price}</span>
                </span>
                <span className="mt-1 block text-[10px] leading-4 text-white/40">
                  {active ? "Your current plan" : plan.tagline}
                </span>
              </button>
            );
          })}
        </div>
        {billingError && (
          <p role="alert" className="mt-2.5 text-[10px] leading-4 text-[#ef7d55]">{billingError}</p>
        )}
      </motion.div>
    </StepShell>
  );
}

export function OperatingPreferences({
  data,
  onChange,
}: {
  data: ReserveProfileData;
  onChange: (patch: Partial<ReserveProfileData>) => void;
}) {
  const female = data.genderIdentity === "female";
  const nutritionGoals = female ? FEMALE_NUTRITION_GOALS : MALE_NUTRITION_GOALS;
  const eyebrow = female ? "Your training & fuel preferences" : "Your training & fuel standards";
  const title = female ? "How you like to train and eat." : "Dial in how you operate.";
  const subtitle = female
    ? "These shape your sessions, recovery rhythm, and fuel plan so everything feels made for you."
    : "These set your session length, equipment, recovery, and fuel so the system commands the right plan.";

  return (
    <StepShell eyebrow={eyebrow} title={title} subtitle={subtitle}>
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-3xl border border-white/[0.07] bg-white/[0.025] p-5">
          <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-white/28">Session length</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {SESSION_DURATION_OPTIONS.map((min) => (
              <Chip
                key={min}
                label={`${min} min`}
                selected={data.sessionDuration === min}
                onClick={() => onChange({ sessionDuration: min })}
              />
            ))}
          </div>

          <p className="mb-2 mt-5 font-mono text-[9px] uppercase tracking-[0.22em] text-white/28">Cardio preference</p>
          <div className="flex flex-wrap gap-2">
            {CARDIO_OPTIONS.map((c) => (
              <Chip key={c} label={c} accent={GREEN} selected={data.cardioPreference === c} onClick={() => onChange({ cardioPreference: c })} />
            ))}
          </div>

          <p className="mb-2 mt-5 font-mono text-[9px] uppercase tracking-[0.22em] text-white/28">Recovery preference</p>
          <div className="flex flex-wrap gap-2">
            {RECOVERY_OPTIONS.map((r) => (
              <Chip key={r} label={r} accent={BLUE} selected={data.recoveryPreference === r} onClick={() => onChange({ recoveryPreference: r })} />
            ))}
          </div>
        </div>

        <div className="grid gap-3">
          <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-white/28">Equipment access</p>
          {EQUIPMENT_OPTIONS.map((opt) => (
            <SelectCard
              key={opt.value}
              label={opt.label}
              description={opt.description}
              selected={data.equipmentAccess === opt.value}
              onClick={() => onChange({ equipmentAccess: opt.value })}
            />
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <div className="rounded-3xl border border-white/[0.07] bg-white/[0.025] p-5">
          <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-white/28">Nutrition goal</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {nutritionGoals.map((g) => (
              <Chip key={g} label={g} accent={female ? VIOLET : GOLD} selected={data.nutritionGoal === g} onClick={() => onChange({ nutritionGoal: g })} />
            ))}
          </div>
          <p className="mb-2 mt-5 font-mono text-[9px] uppercase tracking-[0.22em] text-white/28">Meal style</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {MEAL_STYLE_OPTIONS.map((opt) => (
              <SelectCard
                key={opt.value}
                label={opt.label}
                description={opt.description}
                selected={data.mealStyle === opt.value}
                onClick={() => onChange({ mealStyle: opt.value })}
              />
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-white/[0.07] bg-white/[0.025] p-5">
          <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-white/28">Health-tracking surfaces</p>
          <p className="mt-2 text-xs leading-5 text-white/45">
            Reserve can organize an observational log for compounds, supplements, and lab-marker awareness — record keeping
            and trend observation only, to review with your clinician. No advice, dosing, or protocols.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Chip label="Enable log" accent={GOLD} selected={data.enhancedTracking} onClick={() => onChange({ enhancedTracking: true })} />
            <Chip label="Not now" selected={!data.enhancedTracking} onClick={() => onChange({ enhancedTracking: false })} />
          </div>
        </div>
      </div>
    </StepShell>
  );
}

/** Maps a wizard persona to a canonical training level. */
function personaToLevel(persona: UserPersona): "beginner" | "intermediate" | "advanced" {
  if (persona === "beginner") return "beginner";
  if (persona === "advanced") return "advanced";
  return "intermediate";
}

/** Gender-aware protocol recommendations derived from the in-progress profile. */
function recommendForData(data: ReserveProfileData): ProtocolDefinition[] {
  return recommendProtocols(
    {
      goal: [...data.bodyGoals, ...data.goalStack, data.nutritionGoal].join(" "),
      daysToDeadline: null,
      gymEnvironment: mapGymEnvironment(data.equipmentAccess),
      trainingLevel: personaToLevel(inferPersona(data)),
      genderIdentity: data.genderIdentity || undefined,
      hasWeakPoints: false,
      womensPath: data.genderIdentity === "female",
    },
    3,
  );
}

function inferPersona(data: ReserveProfileData): UserPersona {
  if (data.currentChapter === "foundation") return "beginner";
  if (
    data.currentChapter === "physique-competitor" ||
    data.currentChapter === "strength-performance" ||
    data.currentChapter === "former-athlete"
  ) {
    return "advanced";
  }
  return "intermediate";
}

function inferPhysiqueGoal(data: ReserveProfileData): PhysiqueGoal {
  const joined = [...data.bodyGoals, ...data.goalStack].join(" ").toLowerCase();
  if (joined.includes("classic") || joined.includes("v-taper")) return "classic";
  if (joined.includes("muscle") || joined.includes("curves") || joined.includes("hourglass")) return "mass";
  if (joined.includes("fat loss") || joined.includes("lean") || joined.includes("definition")) return "lean";
  return "athletic";
}

function buildCoachingProfile(data: ReserveProfileData): CoachingProfile {
  return {
    genderIdentity: data.genderIdentity || undefined,
    currentChapter: data.currentChapter || undefined,
    lifeContext: data.lifeContext,
    // Legacy compatibility: downstream logic still reading lifeStages sees
    // the combined selection with canonical new slugs.
    lifeStages: [data.currentChapter, ...data.lifeContext].filter(Boolean),
    healthContext: data.healthContext,
    healthNotes: data.healthNotes,
    medications: data.medications,
    injuryNotes: data.injuryNotes,
    bodyGoals: data.bodyGoals,
    trainingStyles: data.trainingStyles,
    goalStack: data.goalStack,
    lifestyle: data.lifestyle,
    schedule: {
      trainingDays: data.trainingDays,
      preferredWindow: data.preferredWindow,
      wakeTime: data.wakeTime,
      sleepTime: data.sleepTime,
    },
    motivationStyle: data.motivationStyle,
    coachingNotes: buildCoachingNotes(data),
    alertPlan: buildAlertPlan(data),
  };
}

/** Reverse-maps a canonical gym environment to a wizard equipment-access bucket. */
/** Wizard window labels → canonical TrainingWindow. "Rotating" gets a neutral
    evening anchor the member can refine in Schedule Command. */
function mapTrainingWindow(label: string): TrainingWindow {
  switch (label) {
    case "Early morning": return "morning";
    case "Midday": return "midday";
    case "Afternoon": return "afternoon";
    case "Late night": return "night";
    case "Evening":
    case "Rotating":
    default:
      return "evening";
  }
}

function gymEnvToAccess(env: string | undefined): EquipmentAccess {
  if (env === "luxury-premium") return "luxury-premium";
  if (env === "home-gym" || env === "dumbbell-home" || env === "garage-gym") return "home-gym";
  if (env === "minimal-travel" || env === "hotel-gym") return "minimal-travel";
  return "commercial-performance";
}

/** Map legacy multi-select life stages onto the Current Chapter layer. */
function legacyChapterFrom(lifeStages: string[]): string {
  if (lifeStages.includes("physique-competitor")) return "physique-competitor";
  if (lifeStages.includes("strength-athlete")) return "strength-performance";
  if (lifeStages.includes("former-athlete")) return "former-athlete";
  if (lifeStages.includes("beginner")) return "foundation";
  if (lifeStages.includes("lifestyle-transformation")) return "lifestyle-transformation";
  return "";
}

/** Map legacy multi-select life stages onto the Life Context layer. */
function legacyContextFrom(lifeStages: string[]): string[] {
  const out: string[] = [];
  if (lifeStages.includes("busy-professional")) out.push("busy-professional");
  if (lifeStages.includes("parent")) out.push("parent-caregiver");
  if (lifeStages.includes("senior")) out.push("masters-50");
  if (lifeStages.includes("postpartum")) out.push("postpartum");
  return out;
}

/** Build the wizard's working data from any answers already saved to the store. */
function prefillFromStore(): ReserveProfileData {
  const s = useAthleteDashboardStore.getState();
  const cp = s.profile.coachingProfile;
  const plan = s.trainingSession.schedulePlan;
  return {
    ...INITIAL,
    name: s.profile.name && s.profile.name !== "Tony" ? s.profile.name : INITIAL.name,
    genderIdentity: cp?.genderIdentity ?? INITIAL.genderIdentity,
    currentChapter: cp?.currentChapter ?? legacyChapterFrom(cp?.lifeStages ?? []),
    lifeContext: cp?.lifeContext ?? legacyContextFrom(cp?.lifeStages ?? []),
    lifeStages: cp?.lifeStages ?? INITIAL.lifeStages,
    healthContext: cp?.healthContext ?? INITIAL.healthContext,
    healthNotes: cp?.healthNotes ?? INITIAL.healthNotes,
    medications: cp?.medications ?? INITIAL.medications,
    injuryNotes: cp?.injuryNotes ?? INITIAL.injuryNotes,
    bodyGoals: cp?.bodyGoals ?? INITIAL.bodyGoals,
    trainingStyles: cp?.trainingStyles ?? INITIAL.trainingStyles,
    goalStack: cp?.goalStack ?? INITIAL.goalStack,
    lifestyle: cp?.lifestyle ?? INITIAL.lifestyle,
    trainingDays: cp?.schedule?.trainingDays ?? s.setupProfile.trainingDaysPerWeek ?? INITIAL.trainingDays,
    preferredWindow: cp?.schedule?.preferredWindow ?? INITIAL.preferredWindow,
    wakeTime: cp?.schedule?.wakeTime ?? plan?.wakeTime ?? INITIAL.wakeTime,
    sleepTime: cp?.schedule?.sleepTime ?? plan?.sleepTime ?? INITIAL.sleepTime,
    motivationStyle: cp?.motivationStyle ?? INITIAL.motivationStyle,
    tier: s.subscriptionTier ?? INITIAL.tier,
    sessionDuration: s.userTrainingProfile.sessionDurationMin ?? s.setupProfile.sessionDurationMin ?? INITIAL.sessionDuration,
    equipmentAccess: s.userTrainingProfile.configured ? gymEnvToAccess(s.userTrainingProfile.gymEnvironment) : INITIAL.equipmentAccess,
    mealStyle: s.nutritionPrefs.prepPreference ?? INITIAL.mealStyle,
    enhancedTracking: s.profile.enhancedTracking ?? INITIAL.enhancedTracking,
    protocolId: s.activeProtocol?.protocolId ?? INITIAL.protocolId,
  };
}

/**
 * Honest save state for the wizard footer.
 *
 * "Saved" is driven by the sync engine's markSaved, which only fires after the
 * cloud upsert is confirmed — it is never optimistic. A failing write says so
 * instead of quietly claiming success, and a signed-out member is told plainly
 * that their answers are on this device only.
 */
function DraftSaveIndicator({ status }: { status: SyncStatus }) {
  const copy: Record<SyncStatus, { label: string; tone: string }> = {
    restoring: { label: "Restoring your answers…", tone: "rgba(255,255,255,0.42)" },
    pending: { label: "Saving…", tone: "rgba(255,255,255,0.42)" },
    saving: { label: "Saving…", tone: "rgba(255,255,255,0.42)" },
    saved: { label: "Saved", tone: "rgba(125,216,168,0.72)" },
    offline: { label: "Offline — kept on this device", tone: "rgba(232,200,122,0.78)" },
    error: { label: "Unable to save — retrying", tone: "rgba(239,125,85,0.9)" },
    "local-only": { label: "Saved to this device", tone: "rgba(255,255,255,0.3)" },
  };
  const { label, tone } = copy[status];
  return (
    <span
      aria-live="polite"
      className="hidden font-mono text-[8px] uppercase tracking-[0.18em] sm:block"
      style={{ color: tone }}
    >
      {label}
    </span>
  );
}

/**
 * Restore an in-progress wizard from the persisted draft.
 *
 * The draft is part of the `onboarding` slice, so by the time this runs the
 * store already holds whichever copy the sync engine decided was newest —
 * cloud on a second device, local when a write had not landed yet. A draft
 * from an older wizard shape is ignored rather than rendered incorrectly.
 */
function restoreDraft(): { step: number; data: ReserveProfileData } {
  const prefilled = prefillFromStore();
  const draft = useAthleteDashboardStore.getState().onboarding.draft;
  if (!draft || draft.version !== ONBOARDING_DRAFT_VERSION) {
    return { step: 0, data: prefilled };
  }
  const step = Number.isInteger(draft.step)
    ? Math.min(Math.max(draft.step, 0), TOTAL_STEPS - 1)
    : 0;
  // Draft answers layer over the prefill, so a field the member never touched
  // still falls back to whatever their canonical profile already knows.
  return { step, data: { ...prefilled, ...(draft.answers as Partial<ReserveProfileData>) } };
}

export function ReserveProfileFlow() {
  const [restored] = useState(restoreDraft);
  const [step, setStep] = useState(restored.step);
  const [direction, setDirection] = useState(1);
  // Prefill from any previously-saved answers so we never re-ask what the member already gave us.
  const [data, setData] = useState<ReserveProfileData>(restored.data);
  const shouldReduceMotion = useReducedMotion();
  const syncStatus = useSyncStatusStore((s) => s.status);
  const {
    setPersona,
    startOnboarding,
    writeOnboardingProfile,
    saveOnboardingDraft,
    clearOnboardingDraft,
  } = useAthleteDashboardStore();

  /**
   * Persist on every answer. The sync engine debounces the cloud write, so
   * rapid edits collapse into one upsert instead of flooding the database.
   *
   * Deliberately does NOT pass a step: this callback is captured by the
   * memoized step components, so a captured step index would go stale the
   * moment the member navigates. The store keeps the step it already has.
   */
  const patch = useCallback(
    (update: Partial<ReserveProfileData>) => {
      setData((current) => {
        const next = { ...current, ...update };
        saveOnboardingDraft(next as unknown as Record<string, unknown>);
        return next;
      });
    },
    [saveOnboardingDraft],
  );

  const steps = useMemo(
    () => [
      <LifeStageSelector key="life" data={data} onChange={patch} />,
      <HealthContextIntake key="health" data={data} onChange={patch} />,
      <GenderGoalSelector key="gender-goals" data={data} onChange={patch} />,
      <GoalStackSelector key="goal-stack" data={data} onChange={patch} />,
      <LifestyleSelector key="lifestyle" data={data} onChange={patch} />,
      <OperatingPreferences key="operating" data={data} onChange={patch} />,
      <NameStep key="name" data={data} onChange={patch} />,
      <CoachingProfileSummary key="summary" data={data} onChange={patch} />,
    ],
    [data, patch],
  );

  /**
   * Step navigation is a commit point: write the draft with the new step and
   * flush immediately, rather than letting a member close the tab inside the
   * debounce window and lose the move.
   */
  function persistStep(nextStep: number) {
    saveOnboardingDraft(data as unknown as Record<string, unknown>, nextStep);
    requestSyncFlush("onboarding-draft");
  }

  function canAdvance() {
    if (step === 0) return data.genderIdentity !== "" && data.currentChapter !== "";
    if (step === 2) return data.bodyGoals.length > 0 && data.trainingStyles.length > 0;
    if (step === 3) return data.goalStack.length > 0;
    if (step === 4) return data.lifestyle.length > 0;
    if (step === 5) return data.nutritionGoal.trim().length > 0;
    if (step === 6) return data.name.trim().length > 0;
    return true;
  }

  function next() {
    if (!canAdvance()) return;
    if (step === 0) startOnboarding();
    if (step < TOTAL_STEPS - 1) {
      setDirection(1);
      const target = step + 1;
      setStep(target);
      persistStep(target);
      return;
    }
    finish();
  }

  function back() {
    if (step === 0) return;
    setDirection(-1);
    const target = step - 1;
    setStep(target);
    persistStep(target);
  }

  function finish() {
    const persona = inferPersona(data);
    const physiqueGoal = inferPhysiqueGoal(data);
    const coachingProfile = buildCoachingProfile(data);
    const primaryGoal = data.bodyGoals[0] ?? data.goalStack[0] ?? "Lifestyle transformation";
    const style = data.trainingStyles.slice(0, 2).join(" + ") || "Reserve Method";
    const female = data.genderIdentity === "female";
    // Ensure a protocol is always confirmed — fall back to the top recommendation.
    const protocolId = data.protocolId ?? recommendForData(data)[0]?.id ?? null;

    // One transactional write — every answer fans out to its canonical slice.
    writeOnboardingProfile({
      profile: {
        name: data.name.trim(),
        goal: primaryGoal,
        phase: data.lifeContext.includes("postpartum") ? "Postpartum rebuild" : "Active transformation",
        trainingStyle: `${data.trainingDays}x ${style}`,
        primaryFocus: data.goalStack.slice(0, 3).join(" + ") || primaryGoal,
        enhancedTracking: data.enhancedTracking || data.healthContext.length > 0,
        experienceLevel: persona,
        persona,
        densityMode: persona === "advanced" ? "advanced" : persona === "beginner" ? "simple" : "operator",
        physiqueGoal,
        avatarAura: female ? "violet" : data.genderIdentity === "custom" ? "teal" : "gold",
        aiCoachStyle: data.healthContext.length > 0 ? "recovery-scientist" : data.motivationStyle === "High accountability" ? "elite-coach" : "lifestyle-strategist",
        recoveryAggression: data.recoveryPreference === "Protective" || data.healthContext.length > 0 ? "conservative" : data.recoveryPreference === "Aggressive" ? "aggressive" : "moderate",
        fatigueSensitivity: data.recoveryPreference === "Protective" || data.healthContext.length > 0 || data.lifeContext.includes("masters-50") || data.lifeContext.includes("postpartum") ? "high" : "medium",
        coachingProfile,
      },
      persona,
      subscriptionTier: data.tier,
      setupProfile: {
        trainingDaysPerWeek: data.trainingDays,
        sessionDurationMin: data.sessionDuration,
        usesCompounds: data.enhancedTracking,
      },
      // One schedule truth: the store derives the full whole-day schedule
      // (training block + meal windows) and mirrors it into schedulePlan, so
      // a 6:05 AM member never inherits the factory evening meal block.
      scheduleIntent: {
        wakeTime: data.wakeTime,
        sleepTime: data.sleepTime,
        preferredWindow: mapTrainingWindow(data.preferredWindow),
        trainingDaysPerWeek: data.trainingDays,
        sessionDurationMin: data.sessionDuration,
      },
      nutritionPrefs: {
        prepPreference: data.mealStyle,
      },
      userTrainingProfile: {
        gymEnvironment: mapGymEnvironment(data.equipmentAccess),
        trainingLevel: personaToLevel(persona),
        sessionDurationMin: data.sessionDuration,
        configured: true,
      },
      trainingExperience: persona,
      womensNutritionGoal: female ? mapWomensNutritionGoal(data.nutritionGoal) : undefined,
      protocolId,
      // Mark the Tier-1 steps this premium flow now fully covers, so the
      // dashboard never re-asks for body/goal, schedule, nutrition, or enhancement.
      completedSetupSteps: ["profile", "schedule", "nutrition", "enhancement"],
      completeOnboarding: true,
    });
    setPersona(persona);
    /* Onboarding does NOT grant a tier. It used to call
       setSubscriptionTier(data.tier), which meant finishing the wizard with
       "Reserve Black" selected handed over the $79 plan for free.

       Entitlement has exactly one source: `profiles.current_tier`, written by
       the verified Stripe lifecycle and adopted by AuthProvider on bootstrap.
       Acquisition itself happens on the separate landing page; the picker in
       this wizard starts real checkout for members who upgrade here. */
    // Answers now live in the canonical slices; the draft has done its job.
    clearOnboardingDraft();
  }

  /* The wizard mounts only after hydration (AppShell's clientReady), so this
     already reads the real viewport on its first render: a phone requests
     the manifest's mobile source and never the 16:9 first. */
  const isPhone = useIsPhone();
  const entrancePlate = productionPlate("entrance-gallery", isPhone ? "mobile" : "desktop");

  const variants = {
    enter: (dir: number) => ({ x: shouldReduceMotion ? 0 : dir * 26, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: shouldReduceMotion ? 0 : dir * -26, opacity: 0 }),
  };

  return (
    /* A full-screen dialog over the member shell: assistive tech stays inside it,
       and the phone tab bar steps aside while it is open (globals.css). */
    <div role="dialog" aria-modal="true" aria-labelledby="onboarding-title" data-onboarding="wizard" className="fixed inset-0 z-50 overflow-y-auto bg-[#040508] px-4 py-6 text-[#f2eee6]">
      <div className="pointer-events-none fixed inset-0">
        {/* Entrance Gallery plate — the member walks into the Reserve before the first question.
            Through the manifest's release gate: phones get its mobile source at the mobile
            focal point; desktop keeps its established crop. */}
        {entrancePlate && (
          <div
            className={`absolute inset-0 bg-cover opacity-30 ${isPhone ? "" : "bg-[center_30%]"}`}
            style={{
              backgroundImage: `url(${entrancePlate.src})`,
              ...(isPhone ? { backgroundPosition: entrancePlate.focalPoint } : {}),
            }}
          />
        )}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,5,8,0.55)_0%,rgba(4,5,8,0.72)_60%,rgba(4,5,8,0.92)_100%)]" />
        <div className="absolute inset-x-0 top-0 h-[70vh] bg-[radial-gradient(ellipse_at_top,rgba(213,177,95,0.16),transparent_62%)]" />
        <div className="absolute bottom-0 right-0 h-[60vh] w-[55vw] bg-[radial-gradient(ellipse_at_bottom_right,rgba(125,211,238,0.1),transparent_60%)]" />
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.9) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
      </div>

      <div className="relative mx-auto flex min-h-full max-w-7xl flex-col justify-center">
        <div
          className="overflow-hidden rounded-[30px] border border-white/[0.07]"
          style={{
            background: "linear-gradient(172deg, rgba(10,11,17,0.94) 0%, rgba(6,7,11,0.97) 100%)",
            boxShadow: "0 40px 140px rgba(0,0,0,0.78), inset 0 1px 0 rgba(255,255,255,0.05)",
            backdropFilter: "blur(28px) saturate(120%)",
          }}
        >
          {/* ── Induction header ── */}
          <div className="relative border-b border-white/[0.05] p-5 sm:px-7 sm:py-6">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#d5b15f]/45 to-transparent" />
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(213,177,95,0.06),transparent_55%)]" />
            <div className="relative mb-5 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <span
                  className="grid h-11 w-11 place-items-center rounded-2xl border border-[#d5b15f]/32 text-[#d5b15f]"
                  style={{ background: "linear-gradient(160deg, rgba(213,177,95,0.16), rgba(213,177,95,0.04))", boxShadow: "0 0 28px rgba(213,177,95,0.18)" }}
                >
                  <ShieldCheck size={19} />
                </span>
                <div>
                  <p className="font-mono text-[9px] font-bold uppercase tracking-[0.26em] text-[#d5b15f]/82">The Reserve Method · Member Induction</p>
                  <h1 id="onboarding-title" className="mt-0.5 text-xl font-black uppercase tracking-tight text-[#f2eee6]" style={{ fontFamily: "var(--font-display)" }}>
                    Command Profile
                  </h1>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="hidden rounded-full border border-[#7dd3ee]/22 bg-[#7dd3ee]/[0.07] px-3 py-1.5 font-mono text-[8px] uppercase tracking-[0.18em] text-[#7dd3ee]/90 sm:inline-flex">
                  {STEP_META[step].label}
                </span>
                <span className="rounded-full border border-[#d5b15f]/28 bg-[#d5b15f]/[0.08] px-3 py-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-[#d5b15f]">
                  Step {step + 1} / {TOTAL_STEPS}
                </span>
              </div>
            </div>
            <StepProgress step={step} />
          </div>

          {/* ── Step content + live preview rail ── */}
          <div className="min-h-[540px] p-5 sm:p-7 lg:p-8">
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_372px]">
              <AnimatePresence mode="wait" custom={direction}>
                <motion.div
                  key={step}
                  custom={direction}
                  variants={variants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
                  className="min-w-0"
                >
                  {steps[step]}
                </motion.div>
              </AnimatePresence>
              <ReservePreviewPanel data={data} />
            </div>
          </div>

          {/* ── Glass command footer ── */}
          <div
            className="relative flex items-center gap-3 border-t border-white/[0.05] p-4 sm:px-7 sm:py-5"
            style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.015), rgba(0,0,0,0.25))", backdropFilter: "blur(16px)" }}
          >
            <motion.button
              type="button"
              onClick={back}
              disabled={step === 0}
              whileHover={step === 0 ? undefined : { y: -1 }}
              whileTap={step === 0 ? undefined : { scale: 0.97 }}
              className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.025] px-4 py-2.5 text-sm font-semibold text-white/50 transition-colors hover:text-white/78 disabled:cursor-not-allowed disabled:opacity-25"
            >
              <ChevronLeft size={16} />
              Back
            </motion.button>

            <DraftSaveIndicator status={syncStatus} />

            <button
              type="button"
              onClick={finish}
              className="ml-auto font-mono text-[10px] uppercase tracking-[0.18em] text-white/32 underline-offset-4 transition hover:text-white/60 hover:underline"
            >
              Skip for now
            </button>
            <motion.button
              type="button"
              onClick={next}
              disabled={!canAdvance()}
              whileHover={canAdvance() ? { y: -1 } : undefined}
              whileTap={canAdvance() ? { scale: 0.97 } : undefined}
              className="inline-flex min-h-11 items-center gap-2 rounded-2xl px-6 py-2.5 text-sm font-extrabold uppercase tracking-[0.1em] text-black transition disabled:cursor-not-allowed"
              style={{
                background: canAdvance()
                  ? "linear-gradient(160deg, #e8c87a 0%, #d5b15f 55%, #c8a352 100%)"
                  : "rgba(213,177,95,0.22)",
                boxShadow: canAdvance() ? "0 0 32px rgba(213,177,95,0.32), inset 0 1px 0 rgba(255,255,255,0.35)" : "none",
                color: canAdvance() ? "#0a0a0c" : "rgba(0,0,0,0.55)",
              }}
            >
              {step === TOTAL_STEPS - 1 ? "ACTIVATE MY RESERVE" : "Continue"}
              <ChevronRight size={16} />
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
}

function NameStep({
  data,
  onChange,
}: {
  data: ReserveProfileData;
  onChange: (patch: Partial<ReserveProfileData>) => void;
}) {
  return (
    <StepShell
      eyebrow="Member identity"
      title="Personalize your Reserve profile."
      subtitle="This lets the coaching layer speak directly to the member without adding friction."
    >
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <label className="rounded-3xl border border-white/[0.07] bg-white/[0.025] p-5">
          <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-white/30">First name</span>
          <input
            value={data.name}
            onChange={(event) => onChange({ name: event.target.value })}
            autoFocus
            maxLength={32}
            placeholder="Preferred name"
            className="mt-3 w-full bg-transparent text-4xl font-black tracking-tight text-[#f2eee6] outline-none placeholder:text-white/16"
          />
        </label>
        <div className="rounded-3xl border border-[#79e3b5]/18 bg-[#79e3b5]/[0.06] p-5">
          <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-[#79e3b5]">Precision output</p>
          <p className="mt-3 text-sm leading-7 text-white/54">
            Your answers will personalize training split, exercise selection, nutrition targets, recovery alerts,
            calendar reminders, workout intensity, injury precautions, health coaching notes, motivation style,
            daily schedule, and future push alerts.
          </p>
        </div>
      </div>
    </StepShell>
  );
}

export function OnboardingWizard() {
  return <ReserveProfileFlow />;
}
