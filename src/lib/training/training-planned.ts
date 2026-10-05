/* ════════════════════════════════════════════════════════════════════════
   TRAINING PLANNED TODAY — one rule for every surface.

   A session is planned today when the schedule context still plans one AND
   either the session was moved onto today, or today is not a recovery day.
   A session moved onto a recovery day is still a session.

   useTodayTrainingDay (Training, Nutrition) and the Apex model both read this,
   so no two screens disagree about whether today trains.
   ════════════════════════════════════════════════════════════════════════ */

import type { TrainingScheduleContext } from "@/lib/schedule/engine";

export function isTrainingPlannedToday(
  context: Pick<TrainingScheduleContext, "trainingPlanned" | "direction">,
  recoveryDay: boolean,
): boolean {
  return context.trainingPlanned && (context.direction === "moved-here" || !recoveryDay);
}
