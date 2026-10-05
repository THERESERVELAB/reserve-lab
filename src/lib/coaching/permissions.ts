/* ════════════════════════════════════════════════════════════════════════
   COACHING PERMISSIONS — consent model, presets, and enforcement helpers.

   Repositories call these helpers before returning or mutating data, so
   permission checks live in the domain layer — not just hidden buttons.
   ════════════════════════════════════════════════════════════════════════ */

import type {
  CoachingPermissions,
  CoachingRelationship,
  PermissionCategory,
  PermissionLevel,
  PhotoAccessLevel,
} from "./types";

/* ─── Level ordering ──────────────────────────────────────────────────── */

const LEVEL_RANK: Record<PermissionLevel, number> = {
  none: 0,
  view: 1,
  suggest: 2,
  manage: 3,
};

const PHOTO_RANK: Record<PhotoAccessLevel, number> = {
  none: 0,
  view: 1,
  annotate: 2,
  full: 3,
};

export function levelAtLeast(level: PermissionLevel, min: PermissionLevel): boolean {
  return LEVEL_RANK[level] >= LEVEL_RANK[min];
}

export function photoAccessAtLeast(level: PhotoAccessLevel, min: PhotoAccessLevel): boolean {
  return PHOTO_RANK[level] >= PHOTO_RANK[min];
}

/* ─── Relationship-level checks (repositories use these) ──────────────── */

export function canView(rel: CoachingRelationship | null, category: PermissionCategory): boolean {
  if (!rel || rel.status !== "active") return false;
  return levelAtLeast(rel.permissions[category], "view");
}

export function canSuggest(rel: CoachingRelationship | null, category: PermissionCategory): boolean {
  if (!rel || rel.status !== "active") return false;
  return levelAtLeast(rel.permissions[category], "suggest");
}

export function canManage(rel: CoachingRelationship | null, category: PermissionCategory): boolean {
  if (!rel || rel.status !== "active") return false;
  return levelAtLeast(rel.permissions[category], "manage");
}

export function canViewPhotos(rel: CoachingRelationship | null): boolean {
  if (!rel || rel.status !== "active") return false;
  return photoAccessAtLeast(rel.permissions.physiquePhotos.access, "view");
}

export function canAnnotatePhotos(rel: CoachingRelationship | null): boolean {
  if (!rel || rel.status !== "active") return false;
  return photoAccessAtLeast(rel.permissions.physiquePhotos.access, "annotate");
}

/* ─── Presets ─────────────────────────────────────────────────────────── */

export const NO_ACCESS_PERMISSIONS: CoachingPermissions = {
  training: "none",
  nutrition: "none",
  schedule: "none",
  recovery: "none",
  checkIns: "none",
  weightTrends: "none",
  measurements: "none",
  biomarkers: "none",
  messaging: "none",
  liveDayOverrides: "none",
  supplements: "none",
  clinicalRecords: "none",
  nutritionArchitecture: "none",
  mealPlans: "none",
  mealPreparation: "none",
  grocery: "none",
  lifestyleSchedule: "none",
  dailyDirective: "none",
  physiquePhotos: { access: "none", mayRequestUploads: false, mayDownloadOriginals: false },
};

/**
 * FULL COACHING ACCESS. Photo access stays an explicit sub-permission:
 * "full access" defaults photos to view+annotate, and the athlete opts into
 * full image access (downloads) separately during review.
 */
export const FULL_ACCESS_PERMISSIONS: CoachingPermissions = {
  training: "manage",
  nutrition: "manage",
  schedule: "manage",
  recovery: "manage",
  checkIns: "manage",
  weightTrends: "view",
  measurements: "view",
  biomarkers: "view",
  messaging: "manage",
  liveDayOverrides: "manage",
  supplements: "manage",
  // Clinical coordination is NEVER part of full coaching access — it requires
  // its own explicit consent flow with a separate acknowledgement.
  clinicalRecords: "none",
  nutritionArchitecture: "manage",
  mealPlans: "manage",
  mealPreparation: "manage",
  grocery: "manage",
  lifestyleSchedule: "manage",
  dailyDirective: "manage",
  physiquePhotos: { access: "annotate", mayRequestUploads: true, mayDownloadOriginals: false },
};

/** Sensible default a coach requests when inviting a client. */
export const DEFAULT_REQUESTED_PERMISSIONS: CoachingPermissions = {
  training: "manage",
  nutrition: "manage",
  schedule: "suggest",
  recovery: "view",
  checkIns: "manage",
  weightTrends: "view",
  measurements: "view",
  biomarkers: "none",
  messaging: "manage",
  liveDayOverrides: "suggest",
  supplements: "manage",
  clinicalRecords: "none",
  nutritionArchitecture: "manage",
  mealPlans: "manage",
  mealPreparation: "suggest",
  grocery: "suggest",
  lifestyleSchedule: "suggest",
  dailyDirective: "manage",
  physiquePhotos: { access: "view", mayRequestUploads: true, mayDownloadOriginals: false },
};

export function clonePermissions(p: CoachingPermissions): CoachingPermissions {
  return { ...p, physiquePhotos: { ...p.physiquePhotos } };
}

/* ─── Presentation vocabulary (used by review + audit UI) ─────────────── */

export const PERMISSION_CATEGORY_LABELS: Record<PermissionCategory, string> = {
  training: "Training",
  nutrition: "Nutrition",
  schedule: "Schedule",
  recovery: "Recovery",
  checkIns: "Check-Ins",
  weightTrends: "Weight Trends",
  measurements: "Measurements",
  biomarkers: "Biomarker Records",
  messaging: "Messaging",
  liveDayOverrides: "Live-Day Overrides",
  supplements: "Supplement Protocols",
  clinicalRecords: "Clinical Coordination",
  nutritionArchitecture: "Nutrition Architecture",
  mealPlans: "Meal Plans",
  mealPreparation: "Meal Preparation",
  grocery: "Grocery",
  lifestyleSchedule: "Lifestyle Schedule",
  dailyDirective: "Daily Directive",
};

export const PERMISSION_LEVEL_LABELS: Record<PermissionLevel, string> = {
  none: "No access",
  view: "View",
  suggest: "View + suggest",
  manage: "Full management",
};

export const PHOTO_ACCESS_LABELS: Record<PhotoAccessLevel, string> = {
  none: "No access",
  view: "View only",
  annotate: "View and annotate",
  full: "Full image access",
};

export const PERMISSION_CATEGORIES: PermissionCategory[] = [
  "training",
  "nutrition",
  "schedule",
  "recovery",
  "checkIns",
  "weightTrends",
  "measurements",
  "biomarkers",
  "messaging",
  "liveDayOverrides",
  "supplements",
  "nutritionArchitecture",
  "mealPlans",
  "mealPreparation",
  "grocery",
  "lifestyleSchedule",
  "dailyDirective",
  // clinicalRecords is intentionally listed last and never bundled into
  // full access; the editor renders it as a separate consent-gated section.
  "clinicalRecords",
];

/** Categories the standard editor renders; clinical is handled separately. */
export const STANDARD_PERMISSION_CATEGORIES: PermissionCategory[] =
  PERMISSION_CATEGORIES.filter((c) => c !== "clinicalRecords");

/** What "GRANT FULL COACHING ACCESS" includes — shown before confirmation. */
export const FULL_ACCESS_DISCLOSURE: string[] = [
  "Training history and active program",
  "Program editing and publishing",
  "Nutrition targets, architecture, and meal plans",
  "Meal preparation and grocery operations",
  "Supplement protocols (ordinary wellness products)",
  "Schedule, lifestyle week, and live-day overrides",
  "Daily Directive coaching messages",
  "Weight history and measurements",
  "Recovery logs and pain observations",
  "Check-ins and progress history",
  "Biomarker records (view)",
  "Messaging",
  "Physique photos (per your image-access selection below)",
  "NOT included: clinical coordination — that always requires its own separate consent",
];

/**
 * Migration for relationships persisted before Performance Operations.
 * New operational scopes inherit the nearest grant the athlete already made
 * (meal systems from nutrition, lifestyle from schedule); supplements and
 * clinical NEVER auto-grant — they start at "none" until reviewed.
 */
export function normalizeCoachingPermissions(
  p: Partial<CoachingPermissions> & { nutrition?: PermissionLevel; schedule?: PermissionLevel },
): CoachingPermissions {
  const base = clonePermissions(NO_ACCESS_PERMISSIONS);
  const merged = { ...base, ...p, physiquePhotos: { ...base.physiquePhotos, ...p.physiquePhotos } };
  if (p.nutritionArchitecture === undefined) merged.nutritionArchitecture = p.nutrition ?? "none";
  if (p.mealPlans === undefined) merged.mealPlans = p.nutrition ?? "none";
  if (p.mealPreparation === undefined) merged.mealPreparation = p.nutrition ?? "none";
  if (p.grocery === undefined) merged.grocery = p.nutrition ?? "none";
  if (p.lifestyleSchedule === undefined) merged.lifestyleSchedule = p.schedule ?? "none";
  if (p.dailyDirective === undefined) {
    merged.dailyDirective = p.messaging && p.messaging !== "none" ? "view" : "none";
  }
  if (p.supplements === undefined) merged.supplements = "none";
  merged.clinicalRecords = p.clinicalRecords ?? "none";
  return merged;
}

export function summarizePermissions(p: CoachingPermissions): "full" | "custom" | "view-only" | "minimal" {
  const levels = PERMISSION_CATEGORIES.map((c) => p[c]);
  const manageCount = levels.filter((l) => l === "manage").length;
  if (manageCount >= 6) return "full";
  if (levels.every((l) => l === "none" || l === "view")) {
    return levels.some((l) => l === "view") ? "view-only" : "minimal";
  }
  return "custom";
}
