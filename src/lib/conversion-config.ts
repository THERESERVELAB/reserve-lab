import type { FeatureKey, SubscriptionTier } from "@/lib/saas-config";

export type ConversionMomentKey =
  | "first-locked-feature"
  | "second-pro-feature"
  | "weekly-review"
  | "advanced-persona-selected"
  | "bloodwork-interest"
  | "elite-intelligence-interest";

export type ConversionMoment = {
  key: ConversionMomentKey;
  targetTier: SubscriptionTier;
  feature?: FeatureKey;
  trigger: string;
  trustCue: string;
  valueFrame: string;
};

export const CONVERSION_MOMENTS: Record<ConversionMomentKey, ConversionMoment> = {
  "first-locked-feature": {
    key: "first-locked-feature",
    targetTier: "pro",
    trigger: "User opens the first Pro locked module.",
    trustCue: "Clear tracking-only framing before upgrade CTA.",
    valueFrame: "Unlock the next layer when the user has already shown intent.",
  },
  "second-pro-feature": {
    key: "second-pro-feature",
    targetTier: "pro",
    trigger: "User views multiple Pro gates in a short session.",
    trustCue: "Explain what Pro adds without implying outcomes.",
    valueFrame: "Bundle advanced tracking into a serious-lifter operating system.",
  },
  "weekly-review": {
    key: "weekly-review",
    targetTier: "pro",
    trigger: "User completes or opens a weekly review ritual.",
    trustCue: "Summaries are trend observations, not advice.",
    valueFrame: "Make progress feel legible every week.",
  },
  "advanced-persona-selected": {
    key: "advanced-persona-selected",
    targetTier: "pro",
    feature: "advanced-analytics",
    trigger: "User selects the advanced persona.",
    trustCue: "Higher density does not change safety boundaries.",
    valueFrame: "Match the interface to an advanced athlete's workflow.",
  },
  "bloodwork-interest": {
    key: "bloodwork-interest",
    targetTier: "pro",
    feature: "bloodwork",
    trigger: "User opens bloodwork or biomarker surfaces.",
    trustCue: "Labs are logged for health awareness and clinician review.",
    valueFrame: "Create a durable high-trust record.",
  },
  "elite-intelligence-interest": {
    key: "elite-intelligence-interest",
    targetTier: "elite",
    feature: "ai-strategist",
    trigger: "User opens Elite intelligence gates.",
    trustCue: "Strategic synthesis stays observational and non-medical.",
    valueFrame: "Position Elite as the flagship command layer.",
  },
};

export const TRUST_CUES = [
  "Tracking, education, and health-awareness only.",
  "Trend observation language before upgrade pressure.",
  "Clinician-review framing for lab and biomarker surfaces.",
  "No protocols, dosage recommendations, cycle planning, diagnoses, or medical advice.",
];
