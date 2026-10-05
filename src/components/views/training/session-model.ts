import type React from "react";

/* ════════════════════════════════════════════════════════════════════════
   SESSION MODEL — the shapes the Training room's session screens share.

   Lifted out of TrainingView unchanged: what a logged set is, what the live
   session state is, the phases a session runs through, and the three session
   modes. No React, no store.
   ════════════════════════════════════════════════════════════════════════ */

export type IntensityTone = "Controlled" | "Productive" | "Limit";
export type ToneStyle = "stoic" | "refined" | "neutral";

export type SetReview = {
  stimulus: string;
  performance: string;
  coachDecision: string;
  goalImpact: string;
  nextSetRecommendation: string;
  restDirective: string;
};

export type LoggedSet = {
  load: number;
  reps: number;
  intensity: number;
  tone: IntensityTone;
  setNumber: number;
  review?: SetReview;
};

export type LiveSessionState = {
  totalLogged: number;
  totalSets: number;
  completion: number;
  fatigueTrend: "rising" | "stable" | "controlled";
  phase: "warmup" | "early" | "mid" | "late" | "complete";
};

export type SessionPhaseKey =
  | "primer"
  | "primary-output"
  | "secondary-volume"
  | "detail-work"
  | "core-command"
  | "conditioning-reserve"
  | "recovery-chamber"
  | "post-session-handoff";

export type SessionModeKey = "full-reserve" | "express" | "minimum-effective";


export const SESSION_MODES: {
  key: SessionModeKey;
  label: string;
  description: string;
  phases: SessionPhaseKey[];
  movementPhases: Array<"primary-output" | "secondary-volume" | "detail-work">;
}[] = [
  {
    key: "full-reserve",
    label: "Full Reserve Session",
    description: "Every phase. The complete standard.",
    phases: ["primer", "primary-output", "secondary-volume", "detail-work", "core-command", "conditioning-reserve", "recovery-chamber", "post-session-handoff"],
    movementPhases: ["primary-output", "secondary-volume", "detail-work"],
  },
  {
    key: "express",
    label: "Express Session",
    description: "Primary + secondary + core. Trims detail and the optional suite.",
    phases: ["primer", "primary-output", "secondary-volume", "core-command", "conditioning-reserve", "post-session-handoff"],
    movementPhases: ["primary-output", "secondary-volume"],
  },
  {
    key: "minimum-effective",
    label: "Minimum Effective Session",
    description: "Primary output + brace. Floor for a kept standard.",
    phases: ["primer", "primary-output", "core-command", "post-session-handoff"],
    movementPhases: ["primary-output"],
  },
];

export type SupportPhaseSlot = {
  key: "core" | "conditioning" | "recovery" | "handoff";
  label: string;
  color: string;
  icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;
  included: boolean;
  required: boolean;
  requirementLabel: string;
  duration: string;
  dueAfter: string;
  status: SupportPhaseStatusUI;
  statusLabel: string;
  reason: string;
};

export type SupportPhaseStatusUI =
  | "pending"
  | "due-now"
  | "completed"
  | "skipped"
  | "reduced"
  | "optional"
  | "recommended-if-hydrated"
  | "not-included";

export function toneFromIntensity(intensity: number): IntensityTone {
  if (intensity <= 1) return "Limit";
  if (intensity <= 3) return "Productive";
  return "Controlled";
}

export function parseHM(t?: string): { h: number; m: number } | null {
  if (!t) return null;
  const [hh, mm] = t.split(":").map((n) => parseInt(n, 10));
  if (Number.isNaN(hh)) return null;
  return { h: hh || 0, m: mm || 0 };
}

export function formatHM(total: number): string {
  const h = ((Math.floor(total / 60) % 24) + 24) % 24;
  const m = ((total % 60) + 60) % 60;
  const d = new Date();
  d.setHours(h, m);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

