/* ════════════════════════════════════════════════════════════════════════
   SESSION MOVEMENT — the frozen-queue movement shape the training cockpit
   renders.

   Extracted from TrainingView so it has ONE authoritative definition that
   both the cockpit and the session builders (generated splits AND custom
   workout templates via lib/lifestyle/session-bridge) type-check against.
   A SessionGenerationSnapshot's `movements` array is this shape — JSON-safe
   data only, no JSX, no functions — so a live session can be frozen,
   persisted, and restored without loss.
   ════════════════════════════════════════════════════════════════════════ */

import type { MovementRole } from "./workout-templates";

export type SwapReason =
  | "machine-occupied"
  | "joint-discomfort"
  | "no-equipment"
  | "low-readiness"
  | "need-faster"
  | "home-hotel"
  | "feels-wrong";

export type MovementSub = {
  name: string;
  equipment: string;
  reasons: SwapReason[];
  preservesStimulus: boolean;
  intentLine: string;
  note: string;
};

export type MovementEducation = {
  whyHere: string;
  whatToFeel: string;
  goalConnection: string;
  commonError: string;
  stretchFocus: string;
  contractionFocus: string;
};

export type EquipmentKind = "barbell" | "dumbbell" | "machine" | "cable" | "smith";

export type SessionMovement = {
  id: string;
  name: string;
  purpose: string;
  target: string;
  region: string;
  sets: number;
  reps: string;
  suggestedLoad: number;
  lastLoad?: number;
  lastReps?: number;
  mode: "barbell" | "dumbbell" | "machine";
  equipmentKind: EquipmentKind;
  equipmentName: string;
  setupNote: string;
  rirTargets: string[];
  rest: string;
  restSeconds: number;
  role?: MovementRole;
  roleLabel?: string;
  /** Superset group label (e.g. "A1" / "A2") when paired — surfaced on the card. */
  superset?: string;
  /** The movement this one is paired with, so the card can name what comes next. */
  supersetPartner?: string;
  /** Drop set / rest-pause closing this movement's last working set. */
  finishingTechnique?: import("./workout-templates").FinishingTechnique;
  /** Starting-load estimate basis line — shown only until real history exists. */
  loadBasis?: string;
  /** True when suggestedLoad is an estimate from body data, not logged history. */
  loadIsEstimate?: boolean;
  tempo?: string;
  intensity?: string;
  progressionTarget?: string;
  weakPointTags?: string[];
  phaseTags?: string[];
  cue: string;
  physiqueImpact: string;
  whyLoad: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  stabilizers: string[];
  education: MovementEducation;
  substitutions: MovementSub[];
};
