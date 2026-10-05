/* ════════════════════════════════════════════════════════════════════════
   WEEKLY CYCLE CHECK-IN — since last week.

   Compares the member's newest check-in with the one before it, and with
   their own first check-in as a baseline. Member-rated items (sleep,
   recovery, training, mood, libido, appetite) can read as improved. Vitals
   never do: a lower blood pressure is reported as "lower", not "better" —
   that reading belongs to a clinician.
   ════════════════════════════════════════════════════════════════════════ */

import {
  CHECK_IN_RATING_LABEL,
  CHECK_IN_SYMPTOMS,
  escalatingSymptoms,
  type CheckInRatingKey,
  type CycleCheckIn,
} from "./types";

export type CheckInBucket = "improved" | "stable" | "worth-watching" | "review";

export const CHECK_IN_BUCKET_LABEL: Record<CheckInBucket, string> = {
  improved: "Improved",
  stable: "Stable",
  "worth-watching": "Worth watching",
  review: "Get this reviewed",
};

export type CheckInChange = { id: string; bucket: CheckInBucket; text: string };

export type CheckInComparison = {
  latest: CycleCheckIn;
  previous: CycleCheckIn | null;
  changes: CheckInChange[];
  /** True when the newest check-in includes a symptom that needs care now. */
  needsCare: boolean;
};

/** Days after which a new check-in is due. */
export const CHECK_IN_INTERVAL_DAYS = 7;

const RATING_KEYS: CheckInRatingKey[] = ["training", "recovery", "sleepQuality", "mood", "libido", "appetite"];

function sortNewest(checkIns: CycleCheckIn[]): CycleCheckIn[] {
  return [...checkIns].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

function bp(c: CycleCheckIn): string | null {
  return c.systolic && c.diastolic ? `${c.systolic}/${c.diastolic}` : null;
}

export function compareCheckIns(checkIns: CycleCheckIn[]): CheckInComparison | null {
  const [latest, previous = null] = sortNewest(checkIns);
  if (!latest) return null;
  const baseline = sortNewest(checkIns).at(-1) ?? null;
  const changes: CheckInChange[] = [];
  const needsCare = escalatingSymptoms(latest.symptoms).length > 0;

  if (needsCare) {
    changes.push({ id: "symptoms-care", bucket: "review", text: "This check-in includes symptoms that need medical care now." });
  }

  if (previous) {
    /* Bodyweight — direction only */
    if (latest.bodyweightLb && previous.bodyweightLb) {
      const delta = latest.bodyweightLb - previous.bodyweightLb;
      changes.push({
        id: "bodyweight",
        bucket: "stable",
        text: Math.abs(delta) < 0.5
          ? `Bodyweight steady at ${latest.bodyweightLb} lb.`
          : `Bodyweight ${delta > 0 ? "up" : "down"} ${Math.abs(delta).toFixed(1)} lb (${previous.bodyweightLb} → ${latest.bodyweightLb} lb).`,
      });
    }

    /* Blood pressure — higher is worth watching; lower is only "lower" */
    const latestBp = bp(latest);
    const previousBp = bp(previous);
    if (latestBp && previousBp) {
      const up = latest.systolic! - previous.systolic! >= 5 || latest.diastolic! - previous.diastolic! >= 5;
      const down = previous.systolic! - latest.systolic! >= 5 || previous.diastolic! - latest.diastolic! >= 5;
      const baselineBp = baseline && baseline !== latest ? bp(baseline) : null;
      const aboveBaseline = baseline && baselineBp ? latest.systolic! - baseline.systolic! >= 10 || latest.diastolic! - baseline.diastolic! >= 10 : false;
      changes.push({
        id: "blood-pressure",
        bucket: up ? (aboveBaseline ? "review" : "worth-watching") : "stable",
        text: up
          ? `Average blood pressure higher: ${previousBp} → ${latestBp}.${aboveBaseline ? ` Your first check-in averaged ${baselineBp}.` : ""}`
          : down
            ? `Average blood pressure lower: ${previousBp} → ${latestBp}.`
            : `Average blood pressure steady at ${latestBp}.`,
      });
    }

    /* Resting heart rate */
    if (latest.restingHr && previous.restingHr) {
      const delta = latest.restingHr - previous.restingHr;
      changes.push({
        id: "resting-hr",
        bucket: delta >= 5 ? "worth-watching" : "stable",
        text: Math.abs(delta) < 3
          ? `Resting heart rate steady at ${latest.restingHr} bpm.`
          : `Resting heart rate ${delta > 0 ? "higher" : "lower"}: ${previous.restingHr} → ${latest.restingHr} bpm.`,
      });
    }

    /* Sleep hours */
    if (latest.sleepHours && previous.sleepHours) {
      const delta = latest.sleepHours - previous.sleepHours;
      changes.push({
        id: "sleep-hours",
        bucket: delta >= 0.5 ? "improved" : delta <= -0.75 ? "worth-watching" : "stable",
        text: Math.abs(delta) < 0.5
          ? `Sleep steady at ${latest.sleepHours} h a night.`
          : `Sleep ${delta > 0 ? "up" : "down"} to ${latest.sleepHours} h a night (from ${previous.sleepHours} h).`,
      });
    }

    /* Member ratings, 1–5 */
    for (const key of RATING_KEYS) {
      const now = latest.ratings[key];
      const before = previous.ratings[key];
      if (!now || !before) continue;
      const delta = now - before;
      const label = CHECK_IN_RATING_LABEL[key];
      if (key === "appetite") {
        if (Math.abs(delta) >= 2) changes.push({ id: key, bucket: "worth-watching", text: `${label} changed noticeably: ${before} → ${now} of 5.` });
        continue;
      }
      const bucket: CheckInBucket =
        delta >= 1 ? "improved" : delta <= -2 || (key === "mood" && now === 1) ? "review" : delta === -1 ? "worth-watching" : "stable";
      changes.push({
        id: key,
        bucket: bucket === "review" && key !== "mood" ? "worth-watching" : bucket,
        text: delta === 0 ? `${label} steady at ${now} of 5.` : `${label} ${delta > 0 ? "up" : "down"}: ${before} → ${now} of 5.`,
      });
    }

    /* New symptoms since last week */
    const fresh = latest.symptoms.filter((s) => !previous.symptoms.includes(s) && !CHECK_IN_SYMPTOMS[s].escalateTo);
    if (fresh.length > 0) {
      changes.push({ id: "new-symptoms", bucket: "worth-watching", text: `New since last week: ${fresh.map((s) => CHECK_IN_SYMPTOMS[s].label.toLowerCase()).join(", ")}.` });
    }
    const cleared = previous.symptoms.filter((s) => !latest.symptoms.includes(s));
    if (cleared.length > 0) {
      changes.push({ id: "cleared-symptoms", bucket: "improved", text: `No longer reported: ${cleared.map((s) => CHECK_IN_SYMPTOMS[s].label.toLowerCase()).join(", ")}.` });
    }
  }

  if (latest.newMedications?.trim()) {
    changes.push({ id: "new-medications", bucket: "worth-watching", text: `New medications or supplements noted: ${latest.newMedications.trim()}` });
  }
  if (latest.outsideChanges?.trim()) {
    changes.push({ id: "outside-changes", bucket: "worth-watching", text: `Plan changes made outside Reserve: ${latest.outsideChanges.trim()}` });
  }

  return { latest, previous, changes, needsCare };
}

export function checkInDue(checkIns: CycleCheckIn[], today: string, daysBetween: (a: string, b: string) => number): { due: boolean; daysSince?: number } {
  const [latest] = sortNewest(checkIns);
  if (!latest) return { due: true };
  const daysSince = daysBetween(latest.date, today);
  return { due: daysSince >= CHECK_IN_INTERVAL_DAYS, daysSince };
}
