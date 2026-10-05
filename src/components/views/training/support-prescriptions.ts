/* ════════════════════════════════════════════════════════════════════════
   SUPPORT PRESCRIPTIONS — what the day asks for around the lifting.

   The weekly core / cardio / recovery prescription, the conditioning options
   and the recovery suite, lifted out of TrainingView unchanged. Pure: the
   ranking takes the day's facts and returns options, with no React or store.
   ════════════════════════════════════════════════════════════════════════ */

import { Activity, Bike, Flame, Footprints, Minus, Move, Snowflake, Sun, Thermometer, Waves, Wind } from "lucide-react";

export type SupportStatus = "required" | "recommended" | "reduced" | "optional" | "skipped" | "not-included";

export type CoreDayPrescription = {
  style: string;
  duration: string;
  status: SupportStatus;
  reason: string;
  intensity: "hard" | "moderate" | "light";
};

export type CardioDayPrescription = {
  modality: string;
  duration: string;
  targetHR: string;
  intensity: string;
  status: SupportStatus;
  reason: string;
};

export type RecoveryDayPrescription = {
  recommendation: string;
  status: SupportStatus;
  reason: string;
};

export type DaySupportPrescription = {
  dayIndex: number;
  core: CoreDayPrescription;
  cardio: CardioDayPrescription;
  recovery: RecoveryDayPrescription;
  reason: string;
};

export const WEEKLY_SUPPORT_PRESCRIPTION: DaySupportPrescription[] = [
  {
    dayIndex: 0, // Monday — Chest / Back A
    core: { style: "Brace + anti-extension", duration: "6–8 min", status: "recommended", reason: "Supports bracing without stealing pressing strength.", intensity: "moderate" },
    cardio: { modality: "Cooldown walk", duration: "10–15 min", targetHR: "~50–60% max · conversational", intensity: "RPE 2–3", status: "recommended", reason: "Easy cooldown opens the week without taxing the system." },
    recovery: { recommendation: "Sauna option · if hydrated", status: "optional", reason: "Optional downshift if hydration and time allow." },
    reason: "Open the week with upper-torso output. Core supports bracing without stealing pressing strength.",
  },
  {
    dayIndex: 1, // Tuesday — Legs + Abs
    core: { style: "Loaded flexion + lower abs", duration: "12–15 min", status: "required", reason: "Primary ab day · direct loaded flexion and hanging work.", intensity: "hard" },
    cardio: { modality: "Short recovery walk", duration: "8–10 min", targetHR: "~50–55% max · easy", intensity: "RPE 2", status: "reduced", reason: "Avoid aggressive cardio that steals leg recovery." },
    recovery: { recommendation: "Mobility + breath downshift", status: "optional", reason: "Optional downshift after the lower-body block." },
    reason: "Lower-body growth plus direct ab work. Avoid aggressive cardio that steals leg recovery.",
  },
  {
    dayIndex: 2, // Wednesday — Delts / Arms
    core: { style: "Vacuums + anti-rotation", duration: "6–8 min", status: "recommended", reason: "Waist control pairs with specialization day.", intensity: "light" },
    cardio: { modality: "Zone 2", duration: "20–30 min", targetHR: "~60–70% max · nasal/conversational", intensity: "RPE 4–5", status: "recommended", reason: "Specialization day allows conditioning without crushing the CNS." },
    recovery: { recommendation: "Sauna option · if hydrated", status: "recommended", reason: "Reserve allows the full suite — heat + downshift if hydrated." },
    reason: "Specialization day allows conditioning without crushing the nervous system.",
  },
  {
    dayIndex: 3, // Thursday — Chest / Back B
    core: { style: "Brace + contractile abs", duration: "8–10 min", status: "recommended", reason: "Upper-body day pairs cleanly with brace and waist-control work.", intensity: "moderate" },
    cardio: { modality: "Short cooldown / incline walk", duration: "8–10 min", targetHR: "~50–60% max · easy conversational", intensity: "RPE 2–3", status: "reduced", reason: "Posterior legs are next — cooldown only, protect hypertrophy reserve." },
    recovery: { recommendation: "Sauna option · if hydrated", status: "recommended", reason: "Best match for upper-torso session and member preference profile." },
    reason: "Second upper exposure. Secure lifting first, then core, then cooldown. Do not overspend recovery before posterior legs.",
  },
  {
    dayIndex: 4, // Friday — Posterior Legs
    core: { style: "Light bracing only", duration: "5–6 min", status: "optional", reason: "Posterior chain needs output — keep core light.", intensity: "light" },
    cardio: { modality: "Recovery walk", duration: "8–10 min", targetHR: "~50–55% max · conversational", intensity: "RPE 2", status: "reduced", reason: "Hard abs and aggressive cardio can interfere with bracing and recovery." },
    recovery: { recommendation: "Mobility + walking cooldown", status: "optional", reason: "Optional downshift — favor mobility and walking after posterior chain work." },
    reason: "Posterior chain needs output. Hard abs and aggressive cardio can interfere with bracing and recovery.",
  },
  {
    dayIndex: 5, // Saturday — Upper Specialization
    core: { style: "Detail abs + posing control", duration: "8–10 min", status: "recommended", reason: "Lower-CNS upper session gives room for detail and posing.", intensity: "moderate" },
    cardio: { modality: "Zone 2 or StairMaster", duration: "18–25 min", targetHR: "~60–70% max · controlled breathing", intensity: "RPE 4–5", status: "recommended", reason: "Lower-CNS upper session gives room for conditioning when readiness allows." },
    recovery: { recommendation: "Sauna option · if hydrated", status: "optional", reason: "Optional — use sauna if preferred and hydrated." },
    reason: "Lower-CNS upper session gives room for physique detail and conditioning.",
  },
  {
    dayIndex: 6, // Sunday — Recovery + Posing
    core: { style: "Vacuum / posing control only", duration: "5–8 min", status: "optional", reason: "Posing control and vacuums — restore and rehearse.", intensity: "light" },
    cardio: { modality: "Recovery walk", duration: "20–30 min", targetHR: "~50–60% max · conversational", intensity: "RPE 2–3", status: "recommended", reason: "Restore the reserve and rehearse the frame." },
    recovery: { recommendation: "Sauna option · if hydrated", status: "recommended", reason: "Recovery day — sauna pairs cleanly when hydrated." },
    reason: "Restore the reserve, rehearse the frame, and prepare the next week.",
  },
];

export function getDayPrescription(dayIndex: number): DaySupportPrescription {
  return WEEKLY_SUPPORT_PRESCRIPTION.find((d) => d.dayIndex === dayIndex) ?? WEEKLY_SUPPORT_PRESCRIPTION[0];
}

export function supportStatusLabel(s: SupportStatus): string {
  switch (s) {
    case "required": return "Required";
    case "recommended": return "Recommended";
    case "reduced": return "Reduced";
    case "optional": return "Optional";
    case "skipped": return "Skipped";
    case "not-included": return "Not Included";
  }
}

/* ────────────────────────────────────────────────────────────────────────────
   CARDIO RANKING ENGINE — Conditioning Reserve options with HR/RPE
   ──────────────────────────────────────────────────────────────────────── */

export type CardioOptionStatus = "best-match" | "strong-option" | "optional" | "reduced-today" | "not-recommended-today";

export type CardioOptionDef = {
  id: string;
  name: string;
  icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;
};

export type CardioOption = {
  id: string;
  name: string;
  icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;
  matchScore: number;
  status: CardioOptionStatus;
  duration: string;
  targetHR: string;
  intensity: string;
  reason: string;
  fatigueCost: "low" | "moderate" | "high";
  splitFit: string;
  preferenceMatch: boolean;
  selected: boolean;
};

export const CARDIO_DEFS: CardioOptionDef[] = [
  { id: "stairmaster", name: "StairMaster", icon: Activity },
  { id: "incline-walk", name: "Incline Treadmill Walk", icon: Footprints },
  { id: "bike", name: "Bike", icon: Bike },
  { id: "elliptical", name: "Elliptical", icon: Move },
  { id: "recovery-walk", name: "Recovery Walk", icon: Footprints },
  { id: "cooldown-walk", name: "Short Cooldown Walk", icon: Wind },
  { id: "intervals", name: "Optional Intervals", icon: Flame },
  { id: "skip-conditioning", name: "None / Skip Conditioning", icon: Minus },
];

export type CardioInput = {
  dayIndex: number;
  workoutType: string;
  primaryGoal: string;
  readiness: number | null;
  recoveryReserve?: number;
  sessionDemand?: number;
  timeAvailable?: number;
  memberDislikedCardio?: string[];
  memberPreferredCardio?: string[];
  selectedOptionId?: string | null;
};

export function statusLabelForCardio(s: CardioOptionStatus): string {
  switch (s) {
    case "best-match": return "Best Match";
    case "strong-option": return "Strong Option";
    case "optional": return "Optional";
    case "reduced-today": return "Reduced Today";
    case "not-recommended-today": return "Not Recommended Today";
  }
}

export function getConditioningOptions(input: CardioInput): CardioOption[] {
  const { dayIndex, primaryGoal, readiness, memberDislikedCardio = [], memberPreferredCardio = [], selectedOptionId } = input;
  const goal = primaryGoal.toLowerCase();
  const isFatLoss = /cut|lean|fat|recomp/.test(goal);
  const isMass = /mass|hypertrophy|grow|build/.test(goal);
  const isPerformance = /performance|athletic/.test(goal);

  const day = getDayPrescription(dayIndex);
  const isHeavyLegDay = dayIndex === 1 || dayIndex === 4;
  const posteriorChainNext = dayIndex === 3; // Thu → Fri posterior legs
  const recoveryDay = dayIndex === 6;

  function baseScore(id: string): number {
    if (id === "stairmaster") {
      let s = 60;
      if (isFatLoss) s += 20;
      if (isPerformance) s += 10;
      if (isMass) s -= 10;
      if (readiness !== null && readiness >= 80) s += 8;
      if (readiness !== null && readiness < 60) s -= 18;
      if (isHeavyLegDay) s -= 25;
      if (posteriorChainNext) s -= 18;
      if (recoveryDay) s -= 10;
      if (dayIndex === 5) s += 8; // Saturday upper specialization
      if (memberPreferredCardio.includes("stairmaster")) s += 6;
      if (memberDislikedCardio.includes("stairmaster")) s -= 18;
      return s;
    }
    if (id === "incline-walk") {
      let s = 78;
      if (isFatLoss) s += 8;
      if (isMass) s += 4;
      if (posteriorChainNext) s += 10;
      if (isHeavyLegDay) s -= 6;
      if (readiness !== null && readiness < 60) s += 4;
      if (memberPreferredCardio.includes("incline-walk")) s += 4;
      if (memberDislikedCardio.includes("incline-walk")) s -= 14;
      return s;
    }
    if (id === "bike") {
      let s = 70;
      if (isFatLoss) s += 6;
      if (isHeavyLegDay) s -= 8;
      if (posteriorChainNext) s += 4;
      if (memberPreferredCardio.includes("bike")) s += 4;
      if (memberDislikedCardio.includes("bike")) s -= 14;
      return s;
    }
    if (id === "elliptical") {
      let s = 64;
      if (isFatLoss) s += 4;
      if (memberPreferredCardio.includes("elliptical")) s += 4;
      if (memberDislikedCardio.includes("elliptical")) s -= 14;
      return s;
    }
    if (id === "recovery-walk") {
      let s = 72;
      if (recoveryDay) s += 12;
      if (isHeavyLegDay) s += 8;
      if (posteriorChainNext) s += 6;
      if (readiness !== null && readiness < 60) s += 8;
      return s;
    }
    if (id === "cooldown-walk") {
      let s = 70;
      if (posteriorChainNext) s += 14;
      if (isMass) s += 8;
      if (isFatLoss) s -= 4;
      if (dayIndex === 3) s += 12; // Thursday CB-B
      return s;
    }
    if (id === "intervals") {
      let s = 40;
      if ((readiness !== null && readiness >= 85) && (isPerformance || isFatLoss)) s += 18;
      if (isHeavyLegDay) s -= 30;
      if (posteriorChainNext) s -= 20;
      if (readiness !== null && readiness < 70) s -= 25;
      return s;
    }
    if (id === "skip-conditioning") {
      let s = 38;
      if (readiness !== null && readiness < 55) s += 34;
      if (isHeavyLegDay) s += 10;
      if (posteriorChainNext && !isFatLoss) s += 8;
      if (isFatLoss && (readiness !== null && readiness >= 70)) s -= 12;
      return s;
    }
    return 50;
  }

  function statusForScore(score: number, id: string): CardioOptionStatus {
    if (memberDislikedCardio.includes(id) && score < 70) return "not-recommended-today";
    if (score >= 88) return "best-match";
    if (score >= 78) return "strong-option";
    if (score >= 65) return "optional";
    if (score >= 50) return "reduced-today";
    return "not-recommended-today";
  }

  function detailFor(id: string): { duration: string; targetHR: string; intensity: string; reason: string; fatigueCost: "low" | "moderate" | "high"; splitFit: string } {
    const dayReason = day.reason;
    if (id === "stairmaster") {
      const dur = isFatLoss ? "18–22 min" : "15–18 min";
      const hr = "125–145 bpm · ~65–75% max · controlled breathing";
      const rpe = "RPE 5–6";
      let reason = isFatLoss
        ? "Best match for fat-loss / conditioning goal without stealing upper-body output."
        : isMass
          ? "High demand — short cooldown is the cleaner pairing on muscle-gain days."
          : "Solid conditioning when readiness and legs allow.";
      if (posteriorChainNext) reason = "Skip aggressive stair work — posterior legs are next.";
      if (isHeavyLegDay) reason = "Legs already loaded — heavy stair work would compound fatigue.";
      return { duration: dur, targetHR: hr, intensity: rpe, reason, fatigueCost: "high", splitFit: posteriorChainNext ? "Poor before posterior legs" : dayIndex === 5 ? "Strong upper-specialization fit" : "Use only when legs/readiness allow" };
    }
    if (id === "incline-walk") {
      const dur = posteriorChainNext ? "8–10 min" : isFatLoss ? "20–30 min" : "12–15 min";
      return { duration: dur, targetHR: "105–125 bpm · ~50–60% max · conversational", intensity: "RPE 2–3", reason: posteriorChainNext ? "Chest / Back B is high output and posterior legs are next. Short cooldown protects hypertrophy and recovery." : "Steady Zone 2 supports fat loss without intruding on recovery.", fatigueCost: "low", splitFit: posteriorChainNext ? "Best Thursday cooldown fit" : "Clean post-lift fit" };
    }
    if (id === "bike") {
      return { duration: posteriorChainNext ? "8–10 min" : isFatLoss ? "20–30 min" : "12–18 min", targetHR: posteriorChainNext ? "105–125 bpm · easy conversational pace" : "115–135 bpm · ~60–70% max", intensity: posteriorChainNext ? "RPE 2–3" : "RPE 4–5", reason: posteriorChainNext ? "Easy bike cooldown keeps legs moving without adding stair fatigue before posterior legs." : "Low-impact Zone 2 — easy on the knees, clean conditioning.", fatigueCost: "low", splitFit: posteriorChainNext ? "Strong Thursday cooldown fit" : "Low-impact fit" };
    }
    if (id === "elliptical") {
      return { duration: "15–20 min", targetHR: "110–130 bpm · ~55–65% max", intensity: "RPE 3–4", reason: "Low-impact full-body cardio. Use if knees feel tight or change of stimulus helps adherence.", fatigueCost: "low", splitFit: "Neutral split fit" };
    }
    if (id === "recovery-walk") {
      return { duration: "20–30 min", targetHR: "~50–60% max · conversational pace", intensity: "RPE 2", reason: dayReason, fatigueCost: "low", splitFit: recoveryDay || isHeavyLegDay ? "Best recovery-day fit" : "Low-cost fallback" };
    }
    if (id === "cooldown-walk") {
      return { duration: "8–10 min", targetHR: "105–125 bpm or easy conversational pace", intensity: "RPE 2–3", reason: posteriorChainNext ? "Chest / Back B is high output and posterior legs are next. Short cooldown protects hypertrophy and recovery." : "Short cooldown to seal the session without overspending.", fatigueCost: "low", splitFit: posteriorChainNext ? "Best Thursday protection fit" : "Clean cooldown fit" };
    }
    if (id === "intervals") {
      return { duration: "8–12 min (work + rest)", targetHR: "150–170 bpm peaks", intensity: "RPE 7–8", reason: (readiness !== null && readiness >= 85) && !isHeavyLegDay && !posteriorChainNext ? "Optional intervals only if readiness is high and legs are fresh." : "Skip intervals today — readiness or recovery cost does not support them.", fatigueCost: "high", splitFit: (readiness !== null && readiness >= 85) && !isHeavyLegDay && !posteriorChainNext ? "Optional high-readiness fit" : "Poor fit today" };
    }
    if (id === "skip-conditioning") {
      return { duration: "0 min", targetHR: "No cardio target", intensity: "RPE 0", reason: (readiness !== null && readiness < 55) ? "Readiness is low — skip conditioning and protect recovery." : "Use only when symptoms, schedule, or recovery reserve make conditioning inappropriate.", fatigueCost: "low", splitFit: (readiness !== null && readiness < 55) ? "Best low-readiness fit" : "Fallback only" };
    }
    return { duration: "—", targetHR: "—", intensity: "—", reason: "Adjust by readiness.", fatigueCost: "low", splitFit: "Unknown fit" };
  }

  const options = CARDIO_DEFS.map((def) => {
    const score = Math.max(0, Math.min(99, baseScore(def.id)));
    const status = statusForScore(score, def.id);
    const detail = detailFor(def.id);
    return {
      id: def.id,
      name: def.name,
      icon: def.icon,
      matchScore: score,
      status,
      duration: detail.duration,
      targetHR: detail.targetHR,
      intensity: detail.intensity,
      reason: detail.reason,
      fatigueCost: detail.fatigueCost,
      splitFit: detail.splitFit,
      preferenceMatch: memberPreferredCardio.includes(def.id),
      selected: selectedOptionId === def.id,
    } satisfies CardioOption;
  });

  options.sort((a, b) => b.matchScore - a.matchScore);
  if (!options.some((o) => o.selected) && options.length > 0) {
    options[0].selected = true;
  }
  return options;
}

/* ────────────────────────────────────────────────────────────────────────────
   RESERVE RECOVERY SUITE — tools + ranking engine
   ──────────────────────────────────────────────────────────────────────── */

export type RecoverySuiteToolDef = {
  id: string;
  name: string;
  category: "heat" | "cold" | "mobility" | "breath" | "active" | "compression" | "light" | "none";
  atHome: boolean;
  effortLevel: "low" | "moderate" | "high";
  icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;
};

export const RECOVERY_SUITE_TOOLS: RecoverySuiteToolDef[] = [
  { id: "sauna", name: "Sauna", category: "heat", atHome: false, effortLevel: "low", icon: Thermometer },
  { id: "steam-room", name: "Steam Room", category: "heat", atHome: false, effortLevel: "low", icon: Thermometer },
  { id: "cold-plunge", name: "Cold Plunge", category: "cold", atHome: false, effortLevel: "high", icon: Snowflake },
  { id: "cold-shower", name: "Cold Shower", category: "cold", atHome: true, effortLevel: "moderate", icon: Snowflake },
  { id: "contrast", name: "Contrast (Hot/Cold)", category: "cold", atHome: false, effortLevel: "high", icon: Waves },
  { id: "compression-boots", name: "Compression Boots", category: "compression", atHome: true, effortLevel: "low", icon: Footprints },
  { id: "mobility-flow", name: "Mobility Flow", category: "mobility", atHome: true, effortLevel: "moderate", icon: Move },
  { id: "breath-downshift", name: "Breath Downshift", category: "breath", atHome: true, effortLevel: "low", icon: Wind },
  { id: "walking-cooldown", name: "Walking Cooldown", category: "active", atHome: true, effortLevel: "low", icon: Footprints },
  { id: "massage-gun", name: "Massage Gun", category: "mobility", atHome: true, effortLevel: "low", icon: Activity },
  { id: "red-light", name: "Red Light", category: "light", atHome: true, effortLevel: "low", icon: Sun },
  { id: "none-available", name: "None Available", category: "none", atHome: true, effortLevel: "low", icon: Minus },
];

export type RecoverySuiteOptionStatus = "best-match" | "strong-option" | "optional" | "minimum-effective" | "not-recommended-today";

export type RecoverySuiteOption = {
  id: string;
  name: string;
  icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;
  matchScore: number;
  status: RecoverySuiteOptionStatus;
  duration: string;
  reason: string;
  safetyNote?: string;
  selected: boolean;
  preferenceMatch: boolean;
  available: boolean;
};

export type RecoverySuiteInput = {
  dayIndex: number;
  workoutType: string;
  primaryGoal: string;
  readiness: number | null;
  hydrationReady: boolean;
  timeAvailable?: number;
  preferences: {
    preferredTools: string[];
    dislikedTools: string[];
    availableTools: string[];
    prefersHeat: boolean;
    prefersCold: boolean;
    prefersAtHome: boolean;
    prefersLowEffort: boolean;
  };
  healthContext?: string[];
  selectedOptionId?: string | null;
};

export function statusLabelForRecovery(s: RecoverySuiteOptionStatus): string {
  switch (s) {
    case "best-match": return "Best Match";
    case "strong-option": return "Strong Option";
    case "optional": return "Optional";
    case "minimum-effective": return "Minimum Effective";
    case "not-recommended-today": return "Not Recommended Today";
  }
}

export function getRecoverySuiteOptions(input: RecoverySuiteInput): RecoverySuiteOption[] {
  const { dayIndex, readiness, hydrationReady, preferences, healthContext = [], selectedOptionId } = input;
  const heatFlagged = healthContext.some((h) => /heart|cardio|hyperten|blood pressure|pregnan/i.test(h));
  const noToolsAvailable = preferences.availableTools.length === 0;

  const posteriorChainDay = dayIndex === 4;
  const heavyLegDay = dayIndex === 1;
  const recoveryDay = dayIndex === 6;

  if (noToolsAvailable) {
    return [
      {
        id: "walking-breath-downshift",
        name: "Walking Cooldown + Breath Downshift",
        icon: Wind,
        /* Ordering weight only, never rendered. These were 72 and 45 — fixed
           percentages shown to every member as if something had measured them.
           The list still leads with the fallback that needs no equipment. */
        matchScore: 2,
        status: "minimum-effective",
        duration: "6–10 min",
        reason: "No tools selected. Minimum effective fallback keeps the closeout simple without heat, cold, or equipment.",
        selected: selectedOptionId === "walking-breath-downshift" || selectedOptionId === null,
        preferenceMatch: true,
        available: true,
      },
      {
        id: "none-available",
        name: "None Available",
        icon: Minus,
        matchScore: 1,
        status: "optional",
        duration: "0 min",
        reason: "Use this only to record that no Recovery Suite tool is available today.",
        selected: selectedOptionId === "none-available",
        preferenceMatch: false,
        available: true,
      },
    ];
  }

  function baseScore(tool: RecoverySuiteToolDef): number {
    let s = 55;
    const liked = preferences.preferredTools.includes(tool.id);
    const disliked = preferences.dislikedTools.includes(tool.id);

    if (tool.category === "heat") {
      s += 18;
      if (preferences.prefersHeat) s += 12;
      if (heatFlagged) s -= 50;
      if (!hydrationReady) s -= 25;
      if (readiness !== null && readiness < 55) s -= 18;
    }
    if (tool.category === "cold") {
      s += 6;
      if (preferences.prefersCold) s += 18;
      if (!preferences.prefersCold) s -= 14;
    }
    if (tool.category === "mobility") {
      s += 14;
      if (heavyLegDay || posteriorChainDay) s += 8;
      if (preferences.prefersLowEffort) s += 4;
    }
    if (tool.category === "active") {
      s += 12;
      if (heavyLegDay || posteriorChainDay || recoveryDay) s += 10;
    }
    if (tool.category === "breath") {
      s += 10;
      if (preferences.prefersLowEffort) s += 6;
    }
    if (tool.category === "compression") {
      s += 10;
      if (heavyLegDay || posteriorChainDay) s += 14;
    }
    if (tool.category === "light") {
      s += 6;
    }
    if (tool.category === "none") {
      s -= 15;
    }

    if (liked) s += 14;
    if (disliked) s -= 22;
    if (preferences.prefersAtHome && !tool.atHome) s -= 8;
    if (preferences.prefersLowEffort && tool.effortLevel === "high") s -= 6;
    if (!preferences.availableTools.includes(tool.id)) s -= 30;

    return s;
  }

  function statusForScore(score: number, tool: RecoverySuiteToolDef, available: boolean): RecoverySuiteOptionStatus {
    if (!available) return "not-recommended-today";
    if (preferences.dislikedTools.includes(tool.id) && score < 70) return "not-recommended-today";
    if (score >= 88) return "best-match";
    if (score >= 78) return "strong-option";
    if (score >= 65) return "optional";
    if (score >= 50) return "minimum-effective";
    return "not-recommended-today";
  }

  function reasonFor(tool: RecoverySuiteToolDef): { reason: string; safetyNote?: string } {
    if (tool.category === "heat") {
      const safety = "Use only if hydrated. Stop with dizziness, chest discomfort, unusual symptoms, or clinician restrictions.";
      if (preferences.preferredTools.includes(tool.id)) return { reason: "Best match for today's split and preference profile. Optional downshift.", safetyNote: safety };
      return { reason: "Heat option for downshift. Optional and based on tolerance.", safetyNote: safety };
    }
    if (tool.category === "cold") {
      const safety = "Skip if you dislike cold exposure or have clinician restrictions.";
      if (preferences.prefersCold) return { reason: "Cold option supports recovery preference. Optional.", safetyNote: safety };
      return { reason: "Preference mismatch — not recommended unless manually selected.", safetyNote: safety };
    }
    if (tool.category === "mobility") return { reason: "Mobility flow supports tissue quality without further fatigue." };
    if (tool.category === "active") return { reason: "Walking cooldown seals the session and supports parasympathetic shift." };
    if (tool.category === "breath") return { reason: "Breath downshift moves the system toward rest without effort cost." };
    if (tool.category === "compression") return { reason: "Compression boots help drain leg load — strong fit on hard lower-body days." };
    if (tool.category === "light") return { reason: "Optional red-light exposure for low-effort recovery." };
    if (tool.category === "none") return { reason: "Records that no Recovery Suite tool is available today. Use walking and breath if possible." };
    return { reason: "Optional recovery tool." };
  }

  function durationFor(tool: RecoverySuiteToolDef): string {
    if (tool.category === "heat") return "8–12 min";
    if (tool.category === "cold") return "Brief exposure only";
    if (tool.category === "mobility") return "6–10 min";
    if (tool.category === "active") return "6–10 min";
    if (tool.category === "breath") return "3–5 min";
    if (tool.category === "compression") return "10–15 min";
    if (tool.category === "light") return "8–10 min";
    return "0 min";
  }

  const options = RECOVERY_SUITE_TOOLS.map((tool) => {
    const available = preferences.availableTools.includes(tool.id);
    const score = Math.max(0, Math.min(99, baseScore(tool)));
    const status = statusForScore(score, tool, available);
    const { reason, safetyNote } = reasonFor(tool);
    return {
      id: tool.id,
      name: tool.name,
      icon: tool.icon,
      matchScore: score,
      status,
      duration: durationFor(tool),
      reason,
      safetyNote,
      selected: selectedOptionId === tool.id,
      preferenceMatch: preferences.preferredTools.includes(tool.id),
      available,
    } satisfies RecoverySuiteOption;
  });

  options.sort((a, b) => b.matchScore - a.matchScore);
  if (!options.some((o) => o.selected) && options.length > 0) {
    const firstAvailable = options.find((o) => o.available) ?? options[0];
    firstAvailable.selected = true;
  }
  return options;
}

