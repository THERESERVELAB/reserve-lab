/* ════════════════════════════════════════════════════════════════════════
   ATHLETIC PROGRESSION — Reserve Athlete Method's parallel capacity track.

   The bodybuilding progression engine (`progression-engine.ts`) is untouched.
   This is a SECOND, independent track for athletic qualities (aerobic base,
   tempo, threshold, speed, power, work capacity) that reuses the same
   mesocycle phase clock so physique and athletic blocks stay aligned.

   Hierarchy rule: athletic capacity YIELDS to the physique. During physique
   specialization / peak / deload phases, athletic load trims first
   (`yieldsToPhysique`); physique progression never trims for athletic gains.

   All values are member-LOGGED, never prescribed as a dose. Reserve observes
   the trend and frames targets as quality cues. No medical/dosing content.
   ════════════════════════════════════════════════════════════════════════ */

import type { MesoPhase } from "@/lib/training/progression-engine";

export type AthleticQuality =
  | "aerobic-base" | "tempo" | "threshold" | "speed" | "power" | "work-capacity";

export const ATHLETIC_QUALITIES: AthleticQuality[] = [
  "aerobic-base", "tempo", "threshold", "speed", "power", "work-capacity",
];

export const ATHLETIC_QUALITY_LABEL: Record<AthleticQuality, string> = {
  "aerobic-base": "Aerobic Base",
  tempo: "Tempo",
  threshold: "Threshold",
  speed: "Speed",
  power: "Power",
  "work-capacity": "Work Capacity",
};

/** What the member logs for each quality (unit + how progress reads). */
export const ATHLETIC_QUALITY_METRIC: Record<AthleticQuality, { unit: string; direction: "higher-better" | "lower-better"; example: string }> = {
  "aerobic-base": { unit: "min", direction: "higher-better", example: "Zone 2 duration at an easy pace" },
  tempo: { unit: "min", direction: "higher-better", example: "Sustained tempo duration" },
  threshold: { unit: "min", direction: "higher-better", example: "Time at threshold effort" },
  speed: { unit: "sec", direction: "lower-better", example: "Short sprint time" },
  power: { unit: "cm/reps", direction: "higher-better", example: "Jump height or throw output" },
  "work-capacity": { unit: "reps", direction: "higher-better", example: "Quality reps in a fixed window" },
};

export type AthleticExposure = {
  quality: AthleticQuality;
  /** Most-recent-first member-logged values. Never prescribed. */
  recentValues: number[];
};

export type AthleticStatus = "baseline" | "progressing" | "hold" | "back-off";

export type AthleticAssessment = {
  quality: AthleticQuality;
  status: AthleticStatus;
  /** Coach-style cue for the next effort (no dose). */
  target: string;
  /** True when the physique phase means athletic load trims first. */
  yieldsToPhysique: boolean;
};

/** Physique phases where athletic capacity steps back to protect the physique. */
function physiqueYields(phase: MesoPhase | undefined): boolean {
  return phase === "specialization" || phase === "peak" || phase === "deload";
}

/**
 * Assess one athletic quality from logged exposures. No history → baseline
 * (no fabricated trend). During physique-priority phases, athletic load yields.
 */
export function assessAthleticQuality(
  exposure: AthleticExposure | undefined,
  ctx?: { phase?: MesoPhase },
): AthleticAssessment {
  const quality = exposure?.quality ?? "aerobic-base";
  const yields = physiqueYields(ctx?.phase);

  if (!exposure || exposure.recentValues.length === 0) {
    return {
      quality,
      status: "baseline",
      target: "Log your first effort to set the benchmark.",
      yieldsToPhysique: yields,
    };
  }

  if (yields) {
    return {
      quality,
      status: "back-off",
      target: "Physique phase — hold athletic load and protect recovery.",
      yieldsToPhysique: true,
    };
  }

  const dir = ATHLETIC_QUALITY_METRIC[quality].direction;
  const [latest, prev] = exposure.recentValues;
  const improving = prev === undefined ? false : dir === "higher-better" ? latest > prev : latest < prev;

  if (improving) {
    return {
      quality,
      status: "progressing",
      target: "Progressing — hold quality, nudge the next effort.",
      yieldsToPhysique: false,
    };
  }
  return {
    quality,
    status: "hold",
    target: "Hold and repeat cleanly before pushing.",
    yieldsToPhysique: false,
  };
}

/** Assess all qualities for the member's current capacity board. */
export function assessAthleticBoard(
  exposures: Partial<Record<AthleticQuality, AthleticExposure>>,
  ctx?: { phase?: MesoPhase },
): AthleticAssessment[] {
  return ATHLETIC_QUALITIES.map((q) => assessAthleticQuality(exposures[q] ?? { quality: q, recentValues: [] }, ctx));
}
