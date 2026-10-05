/* Store → Response Evidence adapters. These functions only translate logged
   canonical records; they never fill missing measurements with defaults. */

import type { PhysiqueEntry } from "@/lib/physique/types";
import type { EngagementEvent } from "@/lib/retention-config";

import type {
  BodyCompositionInput,
  NutritionEvidenceInput,
  ReadinessEvidenceInput,
} from "./types";

export function readinessEvidenceFromStore(
  events: EngagementEvent[],
  physiqueEntries: PhysiqueEntry[],
): ReadinessEvidenceInput[] {
  const byDate = new Map<string, ReadinessEvidenceInput>();
  for (const entry of physiqueEntries) {
    if (entry.restingHeartRate == null) continue;
    byDate.set(entry.date, {
      id: `physique-readiness:${entry.id}`,
      date: entry.date,
      restingHeartRate: entry.restingHeartRate,
    });
  }
  for (const event of events) {
    if (event.type !== "daily-check-in") continue;
    const readiness = event.metadata?.readiness;
    const date = event.createdAt.slice(0, 10);
    if (typeof readiness !== "number" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const existing = byDate.get(date);
    byDate.set(date, {
      ...existing,
      id: `check-in-readiness:${event.id}`,
      date,
      readinessScore: readiness,
    });
  }
  return [...byDate.values()].sort((a, b) => `${a.date}:${a.id}`.localeCompare(`${b.date}:${b.id}`));
}

export function bodyCompositionEvidenceFromStore(
  entries: PhysiqueEntry[],
): BodyCompositionInput[] {
  return [...entries]
    .sort((a, b) => `${a.date}:${a.id}`.localeCompare(`${b.date}:${b.id}`))
    .map((entry) => ({
      id: entry.id,
      observedAt: `${entry.date}T12:00:00.000Z`,
      bodyWeightLb: entry.bodyWeightLb,
      bodyFatPercent: entry.bodyFatPct,
      waistInches: entry.measurements.waist,
      source: "physique-check-in",
    }));
}

export function nutritionEvidenceFromStore(
  entries: PhysiqueEntry[],
  nutritionPhase?: string,
): NutritionEvidenceInput[] {
  return [...entries]
    .filter((entry) => entry.adherence?.nutrition != null)
    .sort((a, b) => `${a.date}:${a.id}`.localeCompare(`${b.date}:${b.id}`))
    .map((entry) => ({
      id: `nutrition:${entry.id}`,
      observedAt: `${entry.date}T12:00:00.000Z`,
      nutritionPhase,
      // Check-ins store 0–100. The evidence contract uses a 0–1 ratio.
      adherence: Math.max(0, Math.min(1, (entry.adherence?.nutrition ?? 0) / 100)),
      source: "physique-check-in",
    }));
}

