/* ─── Subscription tiers ─────────────────────────────────────────────────── */

export type SubscriptionTier = "core" | "pro" | "elite";

/** Hierarchy rank — higher = more access. Driven config, future-scalable. */
export const TIER_RANK: Record<SubscriptionTier, number> = {
  core: 0,
  pro: 1,
  elite: 2,
};

/* Public display metadata. The product is premium at every level — there is no
 * "core / basic / starter" tier. Internally we keep the core|pro|elite ranks for
 * feature gating and backward compatibility, but every member-facing surface
 * shows the two-tier elite model: Reserve Signature and Reserve Black.
 *   core  → Reserve Signature ($24/mo)
 *   pro   → Reserve Black ($79/mo)
 *   elite → Reserve Black ($79/mo)  */
export const SUBSCRIPTION_TIERS: Record<
  SubscriptionTier,
  { label: string; price: string; tagline: string; description: string }
> = {
  core: {
    label: "Reserve Signature",
    price: "$24/mo",
    tagline: "Private Daily Performance OS",
    description: "A premium daily performance operating system — the Reserve Lab experience for members who execute every day.",
  },
  pro: {
    label: "Reserve Black",
    price: "$79/mo",
    tagline: "Private Command System",
    description: "The full private performance command system for serious physique execution.",
  },
  elite: {
    label: "Reserve Black",
    price: "$79/mo",
    tagline: "Private Command System",
    description: "The full private performance command system for serious physique execution.",
  },
};

/* ─── Public two-tier pricing (the only tiers shown in member-facing UI) ────── */
export type PublicTier = "signature" | "black";

export type PublicTierPlan = {
  id: PublicTier;
  /** Internal rank this public tier resolves to. */
  internalTier: SubscriptionTier;
  label: string;
  price: string;
  tagline: string;
  description: string;
  flagship?: boolean;
  features: string[];
};

export const PUBLIC_PRICING: PublicTierPlan[] = [
  {
    id: "signature",
    internalTier: "core",
    label: "Reserve Signature",
    price: "$24/mo",
    tagline: "Private Daily Performance OS",
    description: "A premium daily performance operating system for members who want the Reserve Lab experience without the full command layer.",
    features: [
      "Apex Command dashboard",
      "Training Command",
      "Nutrition Command",
      "Schedule Command",
      "Recovery Command",
      "Progress tracking & check-ins",
      "Measurements",
      "Daily execution system",
    ],
  },
  {
    id: "black",
    internalTier: "elite",
    label: "Reserve Black",
    price: "$79/mo",
    tagline: "Full Private Command System",
    description: "The full private performance command system for serious physique execution.",
    flagship: true,
    features: [
      "Everything in Reserve Signature",
      "Personal Command",
      "Advanced Protocols",
      "Advanced Hypertrophy Output",
      "AI Strategist",
      "Progress Photo Vault",
      "Bloodwork Log",
      "Supplement Logbook",
      "Premium dashboard intelligence",
      "Full command-level personalization",
    ],
  },
];

/** Resolve any internal rank to its public-facing plan. pro + elite → Reserve Black. */
export function publicTierFor(tier: SubscriptionTier): PublicTierPlan {
  return tier === "core" ? PUBLIC_PRICING[0] : PUBLIC_PRICING[1];
}

/* ─── Personas ───────────────────────────────────────────────────────────── */

export type UserPersona = "beginner" | "intermediate" | "advanced";

/* ─── Feature catalog ────────────────────────────────────────────────────── */

export type FeatureKey =
  /* Reserve Signature — public $24/mo (internal rank: core) */
  | "command-center"
  | "training"
  | "nutrition"
  | "recovery"
  | "measurements"
  | "journal"
  | "education"
  | "settings"
  | "lifestyle-builder"
  /* Reserve Black — public $79/mo (internal rank: pro) */
  | "physique"
  | "progress-photos"
  | "bloodwork"
  | "enhanced-monitor"
  | "supplements"
  | "avatar-customization"
  | "advanced-analytics"
  /* Reserve Black — public $79/mo (internal rank: elite) */
  | "physique-intelligence"
  | "mesocycle-planner"
  | "biomarker-intelligence"
  | "performance-intelligence"
  | "peak-physique"
  | "ai-strategist"
  /* Community */
  | "community"
  /* Reserve Women */
  | "womens-cycle"
  | "womens-fertility"
  | "womens-pregnancy";

export type FeatureDefinition = {
  key: FeatureKey;
  label: string;
  tier: SubscriptionTier;
  description: string;
};

export const FEATURE_DEFINITIONS: Record<FeatureKey, FeatureDefinition> = {
  /* ── Core ── */
  "command-center": {
    key: "command-center", label: "Command Center", tier: "core",
    description: "Personalized adaptive dashboard, readiness signals, and daily operating context.",
  },
  training: {
    key: "training", label: "Training", tier: "core",
    description: "Session logging, workout planning, volume tracking, and progress.",
  },
  nutrition: {
    key: "nutrition", label: "Nutrition", tier: "core",
    description: "Food, macro, hydration, and adherence tracking.",
  },
  recovery: {
    key: "recovery", label: "Recovery", tier: "core",
    description: "Sleep, soreness, HRV notes, and recovery trend tracking.",
  },
  measurements: {
    key: "measurements", label: "Measurements", tier: "core",
    description: "Body measurements and simple progress trends.",
  },
  journal: {
    key: "journal", label: "Journal", tier: "core",
    description: "Daily notes, subjective context, and check-in history.",
  },
  education: {
    key: "education", label: "Education", tier: "core",
    description: "Educational content and app guidance.",
  },
  settings: {
    key: "settings", label: "Settings", tier: "core",
    description: "Profile, preferences, onboarding, and local settings.",
  },
  "lifestyle-builder": {
    key: "lifestyle-builder", label: "Build Studio", tier: "core",
    description: "Build your player and your week — custom schedules, custom sessions, and Reserve's ranked recommendations.",
  },

  /* ── Pro ── */
  physique: {
    key: "physique", label: "Physique", tier: "pro",
    description: "Physique scoring, symmetry notes, and check-in observations.",
  },
  "progress-photos": {
    key: "progress-photos", label: "Progress Photos", tier: "pro",
    description: "Photo timeline, comparisons, and capture metadata.",
  },
  bloodwork: {
    key: "bloodwork", label: "Bloodwork Log", tier: "pro",
    description: "Lab panel logs and biomarker trend observation for clinician review.",
  },
  "enhanced-monitor": {
    key: "enhanced-monitor", label: "Enhanced Monitor", tier: "pro",
    description: "Observational tracking for compound history, symptoms, and health-awareness trends. No protocols or recommendations.",
  },
  supplements: {
    key: "supplements", label: "Supplements", tier: "pro",
    description: "Support stack inventory and adherence logging without dosage guidance.",
  },
  "avatar-customization": {
    key: "avatar-customization", label: "Avatar Customization", tier: "pro",
    description: "Personalized avatar aura, physique target, and focus zone preview.",
  },
  "advanced-analytics": {
    key: "advanced-analytics", label: "Advanced Analytics", tier: "pro",
    description: "Cross-module trend views and higher-density dashboard signals.",
  },

  /* ── Elite ── */
  "physique-intelligence": {
    key: "physique-intelligence", label: "Physique Intelligence", tier: "elite",
    description: "Elite physique cockpit — symmetry scoring, lagging muscle analysis, comparison timeline, body composition trends, and posing workflow.",
  },
  "mesocycle-planner": {
    key: "mesocycle-planner", label: "Mesocycle Planner", tier: "elite",
    description: "Training intelligence — block planning, specialization phases, fatigue management, deload decisions, and volume orchestration.",
  },
  "biomarker-intelligence": {
    key: "biomarker-intelligence", label: "Biomarker Intelligence", tier: "elite",
    description: "Observational biomarker panels — CBC, CMP, lipids, hormones, thyroid, inflammation. No diagnosis or medical recommendations.",
  },
  "performance-intelligence": {
    key: "performance-intelligence", label: "Performance Intelligence", tier: "elite",
    description: "Optimization log architecture — compound logs, observations, administration tracking, subjective notes, and historical records. Log-only, no recommendations.",
  },
  "peak-physique": {
    key: "peak-physique", label: "Peak Physique Mode", tier: "elite",
    description: "Peak week workflow — hydration logging, sodium tracking, carb response observation, physique check cadence, and posing reminders.",
  },
  "ai-strategist": {
    key: "ai-strategist", label: "AI Performance Strategist", tier: "elite",
    description: "Elite strategic intelligence — long-horizon observational synthesis across training, nutrition, recovery, and physique trends.",
  },

  /* ── Community ── */
  community: {
    key: "community", label: "War Room", tier: "core",
    description: "Community channels for training discussion, accountability, and tier-exclusive access.",
  },

  /* ── Reserve Women — Women's Performance OS ── */
  "womens-cycle": {
    key: "womens-cycle", label: "Cycle Command", tier: "core",
    description: "Cycle-aware performance tracking — phase awareness, symptoms, energy, recovery, and calendar estimates. Estimate only, no diagnosis or medical claims.",
  },
  "womens-fertility": {
    key: "womens-fertility", label: "Fertility Command", tier: "pro",
    description: "Optional lifestyle-optimization module — hydration, nutrition, recovery, sleep, stress, and lifestyle habits, plus provider-entered labs. No diagnosis, interpretation, or protocols.",
  },
  "womens-pregnancy": {
    key: "womens-pregnancy", label: "Pregnancy Command", tier: "pro",
    description: "Optional lifestyle module — nutrition, hydration, recovery, meal and grocery planning, and milestone awareness by trimester. No medical guidance or interpretation.",
  },
};

/* ─── View ↔ feature map ─────────────────────────────────────────────────── */

export const VIEW_FEATURE_MAP = {
  dashboard:                "command-center",
  training:                 "training",
  nutrition:                "nutrition",
  physique:                 "physique",
  recovery:                 "recovery",
  "progress-photos":        "progress-photos",
  measurements:             "measurements",
  bloodwork:                "bloodwork",
  "enhanced-monitor":       "enhanced-monitor",
  supplements:              "supplements",
  journal:                  "journal",
  education:                "education",
  settings:                 "settings",
  "schedule-command":       "command-center",
  "my-coach":               "command-center",
  "protocol-command":       "command-center",
  "program-horizon":        "command-center",
  "response-profile":       "command-center",
  "lifestyle-builder":      "lifestyle-builder",
  /* Elite */
  "physique-intelligence":  "physique-intelligence",
  "mesocycle-planner":      "mesocycle-planner",
  "biomarker-intelligence": "biomarker-intelligence",
  "performance-intelligence": "performance-intelligence",
  "peak-physique":          "peak-physique",
  "ai-strategist":          "ai-strategist",
  community:                "community",
  /* Reserve Women */
  "womens-cycle":           "womens-cycle",
  "womens-fertility":       "womens-fertility",
  "womens-pregnancy":       "womens-pregnancy",
} as const satisfies Record<string, FeatureKey>;

/* ─── Persona config ─────────────────────────────────────────────────────── */

export type PersistentSettings = {
  units: "imperial" | "metric";
  theme: "dark" | "graphite";
  dateFormat: "us" | "iso";
  notificationsEnabled: boolean;
  dashboardDensity: "focused" | "operator" | "dense";
  dataRetention: "local-only" | "cloud-ready";
};

export type PersonaConfig = {
  label: string;
  description: string;
  dashboardDensity: PersistentSettings["dashboardDensity"];
  defaultFeatures: FeatureKey[];
};

export const USER_PERSONA_CONFIG: Record<UserPersona, PersonaConfig> = {
  beginner: {
    label: "Foundation",
    description: "Foundation transformation dashboard. Focus on consistency, habits, and progress.",
    dashboardDensity: "focused",
    defaultFeatures: ["command-center", "training", "nutrition", "recovery", "journal", "education"],
  },
  intermediate: {
    label: "Intermediate",
    description: "Performance dashboard. Structured training, analytics, and progression intelligence.",
    dashboardDensity: "operator",
    defaultFeatures: ["command-center", "training", "nutrition", "recovery", "measurements", "journal", "education"],
  },
  advanced: {
    label: "Advanced",
    description: "Elite cockpit. Multi-instrument optimization layer for serious physique and performance work.",
    dashboardDensity: "dense",
    defaultFeatures: ["command-center", "training", "nutrition", "recovery", "measurements", "journal", "education"],
  },
};

/* ─── Onboarding state ───────────────────────────────────────────────────── */

export type OnboardingStep =
  | "welcome" | "profile" | "persona" | "goals" | "settings" | "complete";

/**
 * Partial onboarding progress, saved continuously while the member answers.
 *
 * This lives inside the `onboarding` slice on purpose: that slice is already a
 * MEMBER_STATE_KEY, so the draft inherits the cloud envelope, RLS ownership by
 * auth.uid(), logout clearing, and the account-switch guard without any new
 * table or migration. Cloud is authoritative; localStorage is only the cache
 * that keeps the wizard responsive between confirmed writes.
 *
 * `answers` is deliberately untyped here — its shape belongs to the wizard, and
 * this module must not depend on a component. `version` lets a future wizard
 * discard a draft it can no longer read instead of rendering it wrong.
 */
export type OnboardingDraft = {
  /** Wizard step index the member was last on. */
  step: number;
  /** Partial answers collected so far. */
  answers: Record<string, unknown>;
  /** Draft shape version — bump when the wizard's answer shape changes. */
  version: number;
  /** ISO timestamp of the last local change to this draft. */
  updatedAt: string;
};

/** Current draft shape. Bump to invalidate drafts the wizard can no longer read. */
export const ONBOARDING_DRAFT_VERSION = 1;

export type OnboardingState = {
  status: "not-started" | "in-progress" | "complete";
  currentStep: OnboardingStep;
  completedSteps: OnboardingStep[];
  startedAt: string | null;
  completedAt: string | null;
  /** In-progress answers. Null once onboarding completes or has not begun. */
  draft: OnboardingDraft | null;
};

export const DEFAULT_ONBOARDING_STATE: OnboardingState = {
  status: "not-started",
  currentStep: "welcome",
  completedSteps: [],
  startedAt: null,
  completedAt: null,
  draft: null,
};

export const DEFAULT_PERSISTENT_SETTINGS: PersistentSettings = {
  units: "imperial",
  theme: "dark",
  dateFormat: "us",
  notificationsEnabled: true,
  dashboardDensity: "operator",
  dataRetention: "local-only",
};

/* ─── Access check ───────────────────────────────────────────────────────── */

export function isFeatureEnabled(tier: SubscriptionTier, feature: FeatureKey): boolean {
  const featureDef = FEATURE_DEFINITIONS[feature];
  if (!featureDef) return false;
  return TIER_RANK[tier] >= TIER_RANK[featureDef.tier];
}

/** What's the lowest tier that unlocks this feature? Used by upsell UI. */
export function tierRequiredFor(feature: FeatureKey): SubscriptionTier {
  return FEATURE_DEFINITIONS[feature]?.tier ?? "core";
}
