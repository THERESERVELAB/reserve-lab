/* ────────────────────────────────────────────────────────────────────────────
   RESERVE MODULE REGISTRY — single source of truth for navigation + gating

   Every BUILT module is declared once here. Navigation, the Settings module
   control center, and profile/tier gating all read from this registry so the
   app behaves like one connected operating system instead of 20 disconnected
   pages. Modules that are not yet built are intentionally absent (no dead
   routes, no broken nav entries).

   This file is pure data — no JSX, no icon imports — so it stays importable
   from both client and any future server context. Icons are mapped by module
   id in the Sidebar.
   ──────────────────────────────────────────────────────────────────────── */

import type { DashboardView } from "@/lib/athlete-store";
import type { FeatureKey, SubscriptionTier } from "@/lib/saas-config";

export type ProfilePath =
  | "general-fitness"
  | "physique"
  | "mens-performance"
  | "womens-performance"
  | "enhanced-log-only";

export const PROFILE_PATH_LABELS: Record<ProfilePath, string> = {
  "general-fitness": "General Fitness",
  physique: "Physique Transformation",
  "mens-performance": "Men's Performance",
  "womens-performance": "Women's Performance",
  "enhanced-log-only": "Enhanced · Log-Only",
};

export const PROFILE_PATH_DESCRIPTIONS: Record<ProfilePath, string> = {
  "general-fitness": "Balanced training, nutrition, and recovery for everyday performance.",
  physique: "Physique transformation focus — measurements, photos, and composition trends.",
  "mens-performance": "Men's performance path. Surfaces Men's Vitality lifestyle tracking when available.",
  "womens-performance": "Women's performance path. Surfaces cycle, fertility and pregnancy tracking alongside the core commands.",
  "enhanced-log-only": "Observational log-only tracking for compounds, bloodwork, and health awareness.",
};

export type NavGroupId =
  | "foundation"
  | "select"
  | "signature"
  | "community"
  | "library";

export type NavGroupDef = {
  id: NavGroupId;
  label: string;
  flagship?: boolean;        // champagne "Signature" treatment
};

export const NAV_GROUPS: NavGroupDef[] = [
  { id: "foundation", label: "Foundation" },
  { id: "select", label: "Reserve Select" },
  { id: "signature", label: "Reserve Signature", flagship: true },
  { id: "community", label: "Community" },
  { id: "library", label: "Library" },
];

/** Behavioral safety scope shown in the Settings module control center. */
export type ModuleSafetyCategory = "log-only" | "estimate-only" | "lifestyle-only";

/** Gating flags resolved from store state. */
export type ModuleFlag = "womens" | "fertility" | "pregnancy" | "enhanced-log-only";

export type ReserveModule = {
  id: string;
  view: DashboardView;
  label: string;
  group: NavGroupId;
  feature: FeatureKey;
  /** Member can enable/disable this in Settings (optional modules only). */
  optional?: boolean;
  /** When set, only these profile paths surface the module (unless overridden). */
  profilePaths?: ProfilePath[];
  /** When set, the module is hidden until the flag is on (unless overridden). */
  requiresFlag?: ModuleFlag;
  safety?: ModuleSafetyCategory;
  description: string;
};

/* ─── The registry — only modules that have a real, built view ──────────── */

export const RESERVE_MODULES: ReserveModule[] = [
  // Foundation
  { id: "dashboard", view: "dashboard", label: "Apex Command", group: "foundation", feature: "command-center", description: "Your Reserve operating system at a glance — status, mission, and next best action." },
  { id: "protocol-command", view: "protocol-command", label: "Personal Command", group: "foundation", feature: "command-center", description: "Choose your mission, protocol, timeline, and commitment — the operating path the rest of Reserve organizes around." },
  { id: "program-horizon", view: "program-horizon", label: "Program Horizon", group: "foundation", feature: "command-center", description: "Your complete training direction, projected from today — every week of the block, why it was chosen, and what would change it." },
  { id: "response-profile", view: "response-profile", label: "Response Model", group: "foundation", feature: "command-center", description: "How your body responds — the patterns Reserve has learned from your own completed training, and what it recommends changing." },
  { id: "training", view: "training", label: "Training Command", group: "foundation", feature: "training", description: "Cycle the full session lifecycle — pre-session, primer, live, recovery, and handoff." },
  { id: "nutrition", view: "nutrition", label: "Nutrition Command", group: "foundation", feature: "nutrition", description: "Macros, hydration, signature meals, and grocery adherence." },
  { id: "recovery", view: "recovery", label: "Recovery Command", group: "foundation", feature: "recovery", description: "Sleep, hydration, mobility, stress, and recovery reserve trends." },
  { id: "schedule-command", view: "schedule-command", label: "Schedule Command", group: "foundation", feature: "command-center", description: "Your daily operating plan — training window, meal timing, recovery window, and schedule conflicts." },
  { id: "lifestyle-builder", view: "lifestyle-builder", label: "Build Studio", group: "foundation", feature: "lifestyle-builder", description: "Build your player and your week — custom schedules, custom sessions, and Reserve's ranked recommendations." },
  { id: "my-coach", view: "my-coach", label: "My Coach", group: "foundation", feature: "command-center", description: "Your coaching connection — permissions you control, plans to review, live-day decisions, and the coach channel." },

  // Reserve Select
  { id: "physique", view: "physique", label: "Physique Command", group: "select", feature: "physique", description: "Physique scoring, composition trends, and check-in observations." },
  { id: "progress-photos", view: "progress-photos", label: "Progress Photos", group: "select", feature: "progress-photos", description: "Photo timeline, comparisons, and capture metadata." },
  { id: "measurements", view: "measurements", label: "Measurements", group: "select", feature: "measurements", description: "Body measurements and progress trends." },
  { id: "bloodwork", view: "bloodwork", label: "Bloodwork Log", group: "select", feature: "bloodwork", safety: "log-only", description: "Lab panel logs and biomarker trend storage for clinician review." },
  { id: "supplements", view: "supplements", label: "Compound Command", group: "select", feature: "supplements", safety: "log-only", description: "Observational compound and support-stack logging. No prescriptions or dosing." },
  { id: "enhanced-monitor", view: "enhanced-monitor", label: "Enhanced Monitor", group: "select", feature: "enhanced-monitor", optional: true, requiresFlag: "enhanced-log-only", safety: "log-only", description: "Observational health-awareness tracking for compound history and symptoms. Log-only." },

  // Reserve Signature
  { id: "physique-intelligence", view: "physique-intelligence", label: "Physique Cockpit", group: "signature", feature: "physique-intelligence", description: "Elite physique cockpit — symmetry, lagging-muscle analysis, and composition trends." },
  { id: "mesocycle-planner", view: "mesocycle-planner", label: "Mesocycle Planner", group: "signature", feature: "mesocycle-planner", description: "Block planning, specialization phases, and volume orchestration." },
  { id: "biomarker-intelligence", view: "biomarker-intelligence", label: "Biomarker Cockpit", group: "signature", feature: "biomarker-intelligence", safety: "log-only", description: "Observational biomarker panels. No diagnosis or medical recommendations." },
  { id: "performance-intelligence", view: "performance-intelligence", label: "Decision Log", group: "signature", feature: "performance-intelligence", safety: "log-only", description: "Every plan change Reserve made or you approved, with the evidence behind it. Log-only." },
  { id: "peak-physique", view: "peak-physique", label: "Peak Physique", group: "signature", feature: "peak-physique", description: "Peak-week workflow — hydration, sodium, carb response, and posing cadence." },
  { id: "ai-strategist", view: "ai-strategist", label: "AI Strategist", group: "signature", feature: "ai-strategist", description: "Strategic intelligence that reads the Reserve operating system and converts data into direction." },

  // Community
  { id: "community", view: "community", label: "War Room", group: "community", feature: "community", description: "Community channels for training discussion and accountability." },

  /* Cycle, fertility and pregnancy. They sit in Foundation with every other
     command: four women's rooms used to duplicate Training, Nutrition,
     Recovery and Physique in a gendered section of their own, and the phase
     read they existed for now lives inside those commands. Still gated by
     the womens flag, so a member not on the path sees no change. */
  { id: "womens-cycle", view: "womens-cycle", label: "Cycle Command", group: "foundation", feature: "womens-cycle", requiresFlag: "womens", safety: "estimate-only", description: "Cycle-aware tracking and calendar estimates. Not medical prediction." },
  { id: "womens-fertility", view: "womens-fertility", label: "Fertility Command", group: "foundation", feature: "womens-fertility", optional: true, requiresFlag: "womens", safety: "lifestyle-only", description: "Optional lifestyle-optimization module. No diagnosis, interpretation, or protocols." },
  { id: "womens-pregnancy", view: "womens-pregnancy", label: "Pregnancy Command", group: "foundation", feature: "womens-pregnancy", optional: true, requiresFlag: "womens", safety: "lifestyle-only", description: "Optional lifestyle module — nutrition, hydration, recovery, and milestones by trimester." },

  // Library
  { id: "journal", view: "journal", label: "Journal", group: "library", feature: "journal", description: "Daily notes, subjective context, and check-in history." },
  { id: "education", view: "education", label: "Education", group: "library", feature: "education", description: "Educational content and app guidance." },
  { id: "settings", view: "settings", label: "Settings", group: "library", feature: "settings", description: "Profile, modules, preferences, and local settings." },
];

/* ─── Member layout — pinned + explicit order over registry order ────────
   Pure and stable: pinned modules surface first inside their group, then any
   member-ordered ids (in their saved sequence), then the registry order. */
export function applyMemberModuleLayout<T extends { id: string }>(
  items: T[],
  order: readonly string[],
  pinned: readonly string[],
): T[] {
  if (order.length === 0 && pinned.length === 0) return items;
  const orderIdx = (id: string) => {
    const i = order.indexOf(id);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  return items
    .map((item, registryIdx) => ({ item, registryIdx }))
    .sort((a, b) => {
      const ap = pinned.includes(a.item.id) ? 0 : 1;
      const bp = pinned.includes(b.item.id) ? 0 : 1;
      if (ap !== bp) return ap - bp;
      const ao = orderIdx(a.item.id);
      const bo = orderIdx(b.item.id);
      if (ao !== bo) return ao - bo;
      return a.registryIdx - b.registryIdx;
    })
    .map((x) => x.item);
}

/* ─── Resolution context + helpers ──────────────────────────────────────── */

export type ModuleContext = {
  tier: SubscriptionTier;
  profilePath: ProfilePath;
  womensEnabled: boolean;
  enhancedLogOnly: boolean;
  /** Explicit per-module enable/disable from Settings (optional modules only). */
  overrides: Record<string, boolean>;
};

function flagSatisfied(flag: ModuleFlag, ctx: ModuleContext): boolean {
  switch (flag) {
    case "womens":
    case "fertility":
    case "pregnancy":
      return ctx.womensEnabled;
    case "enhanced-log-only":
      return ctx.enhancedLogOnly;
  }
}

/** Whether a module should appear in navigation for this member. */
export function isModuleVisible(module: ReserveModule, ctx: ModuleContext): boolean {
  // Explicit override always wins for optional modules.
  if (module.optional && Object.prototype.hasOwnProperty.call(ctx.overrides, module.id)) {
    return ctx.overrides[module.id];
  }
  if (module.requiresFlag && !flagSatisfied(module.requiresFlag, ctx)) return false;
  if (module.profilePaths && !module.profilePaths.includes(ctx.profilePath)) return false;
  return true;
}

export type ResolvedModule = ReserveModule & { locked: boolean };

/** Visible modules grouped by nav group, in registry order, with tier-lock state. */
export function resolveNavGroups(
  ctx: ModuleContext,
  isFeatureEnabled: (tier: SubscriptionTier, feature: FeatureKey) => boolean,
): Array<NavGroupDef & { items: ResolvedModule[] }> {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: RESERVE_MODULES.filter((m) => m.group === group.id && isModuleVisible(m, ctx)).map((m) => ({
      ...m,
      locked: !isFeatureEnabled(ctx.tier, m.feature),
    })),
  })).filter((group) => group.items.length > 0);
}

/** The name a view is shown under in the shell (top bar, room title).
    Every built view is in the registry; the fallback only exists so a view
    added without a registry entry still reads as words, never a raw id. */
export function viewLabel(view: DashboardView | string): string {
  const entry = RESERVE_MODULES.find((m) => m.view === view);
  if (entry) return entry.label;
  return String(view)
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** Optional modules a member can toggle in Settings, given their profile. */
export function getOptionalModules(): ReserveModule[] {
  return RESERVE_MODULES.filter((m) => m.optional);
}

/** Derive a default profile path from gender identity when none is chosen. */
export function deriveProfilePath(genderIdentity: string | undefined): ProfilePath {
  if (genderIdentity === "female") return "womens-performance";
  if (genderIdentity === "male") return "mens-performance";
  return "general-fitness";
}
