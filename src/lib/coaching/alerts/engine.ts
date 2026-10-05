/* ════════════════════════════════════════════════════════════════════════
   CLIENT ALERT ENGINE — deterministic derivation over the coaching database.

   Alerts are DERIVED (same data → same alerts, stable ids) so they never
   drift from the truth; coach dispositions (reviewed/snoozed/dismissed)
   are the only stored state, keyed by alert id.
   ════════════════════════════════════════════════════════════════════════ */

import { canView, canViewPhotos } from "../permissions";
import type { CoachingDatabase } from "../storage";
import type { AlertSeverity, ClientAlert, CoachingRelationship } from "../types";

const DAY_MS = 86_400_000;

export function deriveClientAlerts(db: CoachingDatabase, coachId: string, now: Date): ClientAlert[] {
  const alerts: ClientAlert[] = [];
  const relationships = db.relationships.filter(
    (r) => r.coachId === coachId && r.status === "active",
  );
  for (const rel of relationships) {
    alerts.push(...alertsForRelationship(db, rel, coachId, now));
  }
  const severityRank: Record<AlertSeverity, number> = { urgent: 0, priority: 1, attention: 2, info: 3 };
  return alerts
    .map((a) => ({ ...a, status: db.alertStates[a.id] ?? a.status }))
    .filter((a) => a.status !== "dismissed")
    .sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);
}

function alertsForRelationship(
  db: CoachingDatabase,
  rel: CoachingRelationship,
  coachId: string,
  now: Date,
): ClientAlert[] {
  const out: ClientAlert[] = [];
  const athleteId = rel.athleteId;
  const name = db.members.find((m) => m.id === athleteId)?.name ?? "Athlete";
  const nowMs = now.getTime();
  const mk = (
    kind: ClientAlert["kind"],
    severity: AlertSeverity,
    headline: string,
    evidence: string[],
    action: ClientAlert["recommendedAction"],
    /** Anchor to the underlying evidence time so "3d ago" is honest — never
        the derivation moment, which would claim everything is "just now". */
    evidenceAt?: string,
  ): ClientAlert => ({
    // Deterministic id: same condition today → same alert id.
    id: `alert:${athleteId}:${kind}`,
    athleteId,
    relationshipId: rel.id,
    kind,
    severity,
    status: "open",
    createdAt: evidenceAt ?? now.toISOString(),
    headline,
    evidence,
    recommendedAction: action,
  });

  /* Check-in cadence (permission-gated). */
  if (canView(rel, "checkIns")) {
    const latest = db.checkIns
      .filter((c) => c.athleteId === athleteId)
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))[0];
    const daysSince = latest ? (nowMs - new Date(latest.submittedAt).getTime()) / DAY_MS : Infinity;
    if (daysSince > 9) {
      out.push(
        mk("checkin_overdue", daysSince > 14 ? "priority" : "attention", `${name} — check-in overdue`,
          [latest ? `Last check-in ${Math.floor(daysSince)} days ago` : "No check-in submitted yet"],
          { label: "REQUEST CHECK-IN", target: "checkin" },
          latest ? new Date(new Date(latest.submittedAt).getTime() + 9 * DAY_MS).toISOString() : rel.startedAt),
      );
    }
    if (latest) {
      if (latest.trainingAdherencePct < 70) {
        out.push(
          mk("training_adherence_decline", "attention", `${name} — training adherence below threshold`,
            [`Reported training adherence ${latest.trainingAdherencePct}%`],
            { label: "OPEN CLIENT", target: "client" }, latest.submittedAt),
        );
      }
      if (latest.nutritionAdherencePct < 70) {
        out.push(
          mk("nutrition_adherence_decline", "attention", `${name} — nutrition adherence below threshold`,
            [`Reported nutrition adherence ${latest.nutritionAdherencePct}%`],
            { label: "OPEN CLIENT", target: "client" }, latest.submittedAt),
        );
      }
      if (latest.recovery !== null && latest.sleepQuality !== null && latest.recovery <= 2 && latest.sleepQuality <= 2) {
        out.push(
          mk("recovery_decline", "priority", `${name} — recovery trend declining`,
            [`Recovery ${latest.recovery}/5 and sleep quality ${latest.sleepQuality}/5 on the latest check-in`],
            { label: "REVIEW CHECK-IN", target: "checkin" }, latest.submittedAt),
        );
      }
      if (latest.questionsForCoach.trim().length > 0 && !latest.reviewId) {
        out.push(
          mk("athlete_requested_help", "priority", `${name} — asked a question in their check-in`,
            [`"${latest.questionsForCoach.slice(0, 90)}"`],
            { label: "REVIEW CHECK-IN", target: "checkin" }, latest.submittedAt),
        );
      }
    }
  }

  /* Weight rate vs. a conservative band (permission-gated). */
  if (canView(rel, "weightTrends")) {
    const entries = db.weightEntries
      .filter((w) => w.athleteId === athleteId)
      .sort((a, b) => a.date.localeCompare(b.date));
    if (entries.length >= 14) {
      const avg = (xs: typeof entries) => xs.reduce((s, w) => s + w.weightLb, 0) / xs.length;
      const delta = avg(entries.slice(-7)) - avg(entries.slice(-14, -7));
      if (Math.abs(delta) > 2.0) {
        out.push(
          mk("weight_rate_out_of_range", "attention", `${name} — weekly weight rate outside configured range`,
            [`Weekly average moved ${delta > 0 ? "+" : ""}${delta.toFixed(1)} lb vs. the prior week`],
            { label: "OPEN CLIENT", target: "client" },
            new Date(`${entries[entries.length - 1].date}T12:00:00`).toISOString()),
        );
      }
    }
  }

  /* Live-day states. */
  const today = db.activeDayPlans
    .filter((p) => p.athleteId === athleteId)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  if (today?.status === "awaiting_approval") {
    const override = db.liveDayOverrides.find((o) => o.id === today.activeOverrideId);
    out.push(
      mk("live_day_awaiting_review", "priority", `${name} — live-day change awaiting review`,
        override
          ? [...override.impactSummary.map((s) => `Impact: ${s}`), "Reserve rebuilt the day"]
          : ["A proposed day change is open"],
        { label: "REVIEW DAY", target: "live_day" },
        override?.createdAt ?? today.lastUpdatedAt),
    );
  }
  if (today?.status === "conflict") {
    out.push(
      mk("live_day_awaiting_review", "urgent", `${name} — conflicting live-day edits`,
        ["Coach and athlete proposed different versions of today", "Both versions preserved"],
        { label: "REVIEW DAY", target: "live_day" }, today.lastUpdatedAt),
    );
  }

  /* New photo sets this week (photo-permission-gated). */
  if (canViewPhotos(rel)) {
    const fresh = new Set(
      db.photos
        .filter((p) => p.athleteId === athleteId && nowMs - new Date(p.date).getTime() < 7 * DAY_MS)
        .map((p) => p.setId),
    );
    if (fresh.size > 0) {
      const newest = db.photos
        .filter((p) => p.athleteId === athleteId && fresh.has(p.setId))
        .map((p) => p.date)
        .sort()
        .pop();
      out.push(
        mk("new_photos", "info", `${name} — new physique photos uploaded`,
          [`${fresh.size} new photo set${fresh.size === 1 ? "" : "s"} this week`],
          { label: "OPEN CLIENT", target: "client" }, newest),
      );
    }
  }

  /* Unread messages. */
  const thread = db.conversations.find((c) => c.relationshipId === rel.id);
  if (thread) {
    const unreadMessages = db.messages.filter(
      (m) => m.threadId === thread.id && m.senderId !== coachId &&
        m.sentAt > (thread.lastReadAt[coachId] ?? ""),
    );
    if (unreadMessages.length > 0) {
      const unread = unreadMessages.length;
      out.push(
        mk("unread_messages", "info", `${name} — ${unread} unread message${unread === 1 ? "" : "s"}`,
          ["Athlete is waiting on a reply"],
          { label: "MESSAGE ATHLETE", target: "messages" },
          unreadMessages[unreadMessages.length - 1].sentAt),
      );
    }
  }

  /* Program approaching expiration. */
  const profile = db.athleteProfiles.find((p) => p.memberId === athleteId);
  if (profile && profile.phaseTotalWeeks > 0 && profile.phaseTotalWeeks - profile.phaseWeek <= 1) {
    out.push(
      mk("program_expiring", "attention", `${name} — program block ending`,
        [`Week ${profile.phaseWeek} of ${profile.phaseTotalWeeks} — next block not yet prescribed`],
        { label: "OPEN CLIENT", target: "client" }),
    );
  }

  return out;
}
