/* ════════════════════════════════════════════════════════════════════════
   SETUP GAP DETECTION
   ------------------------------------------------------------------------
   Derives which Tier-1 personalization steps are still incomplete so the
   dashboard can nudge the member to finish setting up their operating system.
   Setup and personalization only — no medical advice.
   ════════════════════════════════════════════════════════════════════════ */

import type { DashboardView, NutritionPrefsState, SchedulePlan, SetupProfile } from "@/lib/athlete-store";

export type SetupGap = {
  id: string;
  label: string;
  hint: string;
  module: DashboardView;
};

export type SetupGapInput = {
  setupProfile: SetupProfile;
  nutritionPrefs: NutritionPrefsState;
  schedulePlan: SchedulePlan;
  goal: string;
};

/** Ordered list of required Tier-1 setup steps. */
const STEPS: Array<{ id: string; label: string; hint: string; module: DashboardView; isDone: (i: SetupGapInput) => boolean }> = [
  {
    id: "profile",
    label: "Confirm body + goal",
    hint: "Bodyweight, target, and goal sharpen every estimate.",
    module: "settings",
    isDone: (i) => i.setupProfile.completedSteps.includes("profile") || (!!i.setupProfile.targetWeightLb && !!i.setupProfile.age),
  },
  {
    id: "schedule",
    label: "Add work + training times",
    hint: "Wake, sleep, work, and training times build your fuel schedule.",
    module: "settings",
    isDone: (i) => i.setupProfile.completedSteps.includes("schedule") || (!!i.setupProfile.workStartTime && !!i.schedulePlan.workoutTime),
  },
  {
    id: "nutrition",
    label: "Choose diet style + foods",
    hint: "Tailor meals, swaps, and groceries to how you actually eat.",
    module: "nutrition",
    isDone: (i) => i.setupProfile.completedSteps.includes("nutrition"),
  },
  {
    id: "enhancement",
    label: "Set enhancement + lab status",
    hint: "Tell Reserve whether to organize compound schedule and lab watch.",
    module: "supplements",
    isDone: (i) => i.setupProfile.completedSteps.includes("enhancement") || typeof i.setupProfile.usesCompounds === "boolean",
  },
  {
    id: "baseline",
    label: "Log baseline weight + photos",
    hint: "A starting point unlocks weekly review and monthly reports.",
    module: "progress-photos",
    isDone: (i) => i.setupProfile.completedSteps.includes("baseline") || !!i.setupProfile.baselineWeightLb,
  },
];

export function getSetupGaps(input: SetupGapInput): SetupGap[] {
  if (input.setupProfile.setupComplete) return [];
  return STEPS.filter((s) => !s.isDone(input)).map(({ id, label, hint, module }) => ({ id, label, hint, module }));
}

export function setupProgress(input: SetupGapInput): { done: number; total: number } {
  const total = STEPS.length;
  const done = STEPS.filter((s) => s.isDone(input)).length;
  return { done, total };
}
