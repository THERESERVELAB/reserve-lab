/* ────────────────────────────────────────────────────────────────────────────
   RESERVE WOMEN — TRAINING STATUS

   `buildWomensSnapshot` and `recoveryReadout` used to live here. They read
   `womens.recovery`, `womens.nutrition.recentAdherence` and `womens.physique`
   — fields no action anywhere in the product writes — and blended them into a
   "Performance Reserve" (recovery × 0.6 + adherence × 0.4) and a "Physique
   Progress %" of 50 + 4 × pounds moved. Neither was ever the member's own.

   The women's screens now read the member's real logs (Recovery, Nutrition
   and Physique rooms, plus her own cycle log) through `primary-actions.ts`.
   ──────────────────────────────────────────────────────────────────────── */

/** Today's training status from the member's resolved training day — never a fixed "Active". */
export function womensTrainingStatus(trainingPlannedToday: boolean): "Session Today" | "No Session Today" {
  return trainingPlannedToday ? "Session Today" : "No Session Today";
}
