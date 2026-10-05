/* ════════════════════════════════════════════════════════════════════════
   OPERATIONS OVERVIEW — deterministic derivations for the executive
   command surface: operating priorities, execution readiness, behavioral
   momentum, and the operational timeline. Pure functions over the
   database snapshot; the UI renders, never computes.
   ════════════════════════════════════════════════════════════════════════ */

import { dateKeyOffset, todayKey } from "../ids";
import type { CoachingDatabase } from "../storage";
import { detectScheduleConstraints } from "./engines";

/* ─── Operating priorities ────────────────────────────────────────────── */

export type OperationsSectionId =
  | "command" | "protocols" | "fuel" | "lifestyle" | "directive" | "clinical";

export type OperatingPriority = {
  id: string;
  rank: number; // lower = more consequential
  kind:
    | "decision_required"
    | "awaiting_athlete"
    | "schedule_integrity"
    | "grocery_incomplete"
    | "prep_approaching"
    | "supply_low"
    | "adherence_low"
    | "consent_changed"
    | "athlete_flag";
  headline: string;
  detail: string;
  action: string;
  section: OperationsSectionId;
};

export function deriveOperatingPriorities(
  db: CoachingDatabase,
  athleteId: string,
  today: string = todayKey(),
): OperatingPriority[] {
  const priorities: OperatingPriority[] = [];
  const push = (p: Omit<OperatingPriority, "id">) =>
    priorities.push({ ...p, id: `${p.kind}:${priorities.length}` });

  /* Revision requests — the athlete is waiting on the coach. */
  const revisions: Array<{ name: string; section: OperationsSectionId }> = [
    ...db.supplementProtocols.filter((r) => r.athleteId === athleteId && r.status === "revision_requested").map((r) => ({ name: r.name, section: "protocols" as const })),
    ...db.mealPlans.filter((r) => r.athleteId === athleteId && r.status === "revision_requested").map((r) => ({ name: r.name, section: "fuel" as const })),
    ...db.nutritionArchitectures.filter((r) => r.athleteId === athleteId && r.status === "revision_requested").map((r) => ({ name: r.name, section: "fuel" as const })),
    ...db.lifestylePlans.filter((r) => r.athleteId === athleteId && r.status === "revision_requested").map((r) => ({ name: r.name, section: "lifestyle" as const })),
  ];
  for (const item of revisions) {
    push({
      rank: 1,
      kind: "decision_required",
      headline: "Decision Required",
      detail: `${item.name} — the athlete requested a revision.`,
      action: "Open and revise",
      section: item.section,
    });
  }

  /* Unapproved directives waiting on the coach. */
  const draftedDirective = db.dailyDirectives.find(
    (d) => d.athleteId === athleteId && d.date === today && d.status === "drafted",
  );
  if (draftedDirective) {
    push({
      rank: 1,
      kind: "decision_required",
      headline: "Decision Required",
      detail: "Today's directive is drafted and waiting for your approval.",
      action: "Review directive",
      section: "directive",
    });
  }

  /* Items sent and waiting on the athlete. */
  const awaiting: Array<{ name: string; section: OperationsSectionId }> = [
    ...db.supplementProtocols.filter((r) => r.athleteId === athleteId && r.status === "sent").map((r) => ({ name: r.name, section: "protocols" as const })),
    ...db.mealPlans.filter((r) => r.athleteId === athleteId && r.status === "sent").map((r) => ({ name: r.name, section: "fuel" as const })),
    ...db.nutritionArchitectures.filter((r) => r.athleteId === athleteId && r.status === "sent").map((r) => ({ name: r.name, section: "fuel" as const })),
    ...db.lifestylePlans.filter((r) => r.athleteId === athleteId && r.status === "sent").map((r) => ({ name: r.name, section: "lifestyle" as const })),
  ];
  for (const item of awaiting) {
    push({
      rank: 2,
      kind: "awaiting_athlete",
      headline: "Awaiting Athlete Approval",
      detail: item.name,
      action: "View sent version",
      section: item.section,
    });
  }

  /* Athlete meal flags. */
  const flags = db.mealFlags.filter((f) => f.athleteId === athleteId && !f.resolved);
  if (flags.length > 0) {
    push({
      rank: 2,
      kind: "athlete_flag",
      headline: "Athlete Flags Open",
      detail: `${flags.length} meal flag${flags.length === 1 ? "" : "s"} (substitution, dislike, or availability).`,
      action: "Review meal plan",
      section: "fuel",
    });
  }

  /* Schedule integrity. */
  const activeLifestyle = db.lifestylePlans.find((p) => p.athleteId === athleteId && p.status === "active");
  if (activeLifestyle) {
    const attention = detectScheduleConstraints(activeLifestyle.events).filter((c) => c.severity === "attention");
    if (attention.length > 0) {
      push({
        rank: 3,
        kind: "schedule_integrity",
        headline: "Schedule Integrity",
        detail: `${attention.length} structural observation${attention.length === 1 ? "" : "s"} need attention in the operating week.`,
        action: "Open lifestyle week",
        section: "lifestyle",
      });
    }
  }

  /* Grocery incomplete. */
  const grocery = db.groceryPlans
    .filter((p) => p.athleteId === athleteId && p.status !== "complete")
    .sort((a, b) => b.weekOf.localeCompare(a.weekOf))[0];
  if (grocery) {
    const open = grocery.items.filter((i) => i.state === "needed" || i.state === "unavailable");
    if (open.length > 0) {
      push({
        rank: 4,
        kind: "grocery_incomplete",
        headline: "Grocery Incomplete",
        detail: `${open.length} item${open.length === 1 ? "" : "s"} still open for the week of ${grocery.weekOf}.`,
        action: "Open Grocery Command",
        section: "fuel",
      });
    }
  }

  /* Prep session approaching (today or tomorrow, not complete). */
  const prep = db.mealPrepSessions.find(
    (s) => s.athleteId === athleteId && s.status === "planned" &&
      s.prepDate >= today && s.prepDate <= dateKeyOffset(today, 1),
  );
  if (prep) {
    push({
      rank: 4,
      kind: "prep_approaching",
      headline: "Preparation Session Approaching",
      detail: `${prep.prepDate === today ? "Today" : "Tomorrow"} · ${prep.cookingWindow}.`,
      action: "Open Meal Operations",
      section: "fuel",
    });
  }

  /* Supply running low. */
  const activeProtocol = db.supplementProtocols.find((p) => p.athleteId === athleteId && p.status === "active");
  if (activeProtocol) {
    const low = activeProtocol.items.filter((i) => i.runningLow);
    if (low.length > 0) {
      push({
        rank: 5,
        kind: "supply_low",
        headline: "Supply Running Low",
        detail: low.map((i) => i.productName).join(", "),
        action: "Open protocol",
        section: "protocols",
      });
    }
    /* Protocol adherence over the last 7 days. */
    const weekAgo = dateKeyOffset(today, -7);
    const marks = db.protocolAdherence.filter(
      (e) => e.athleteId === athleteId && e.protocolId === activeProtocol.id && e.date >= weekAgo,
    );
    if (marks.length >= 4) {
      const pct = Math.round((marks.filter((m) => m.mark === "taken").length / marks.length) * 100);
      if (pct < 75) {
        push({
          rank: 3,
          kind: "adherence_low",
          headline: "Protocol Adherence Low",
          detail: `${pct}% over the last seven days — a conversation may matter more than a revision.`,
          action: "Review adherence",
          section: "protocols",
        });
      }
    }
  }

  /* Clinical consent changed in the last 7 days. */
  const cutoff = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const consent = db.clinicalConsents.find((c) => c.athleteId === athleteId);
  if (consent && consent.history.some((h) => h.at >= cutoff && h.at !== consent.history[0]?.at)) {
    push({
      rank: 2,
      kind: "consent_changed",
      headline: "Clinical Consent Updated",
      detail: "The athlete changed clinical access recently. Review what is now visible to you.",
      action: "Open Clinical Coordination",
      section: "clinical",
    });
  }

  return priorities.sort((a, b) => a.rank - b.rank);
}

/* ─── Execution readiness ─────────────────────────────────────────────── */

export type ReadinessState = "ready" | "attention" | "not_established";

export type ReadinessItem = {
  id: "protocol" | "nutrition" | "schedule" | "preparation" | "adherence";
  label: string;
  state: ReadinessState;
  value: string;
  section: OperationsSectionId;
};

export function deriveExecutionReadiness(
  db: CoachingDatabase,
  athleteId: string,
  today: string = todayKey(),
): ReadinessItem[] {
  const protocol = db.supplementProtocols.find((p) => p.athleteId === athleteId && p.status === "active");
  const architecture = db.nutritionArchitectures.find((a) => a.athleteId === athleteId && a.status === "active");
  const mealPlan = db.mealPlans.find((p) => p.athleteId === athleteId && p.status === "active");
  const lifestyle = db.lifestylePlans.find((p) => p.athleteId === athleteId && p.status === "active");
  const prepOnHand = db.mealPrepSessions
    .filter((s) => s.athleteId === athleteId)
    .flatMap((s) => s.preparedMeals)
    .filter((m) => m.state === "prepared" || m.state === "packed");

  const weekAgo = dateKeyOffset(today, -7);
  const marks = db.protocolAdherence.filter((e) => e.athleteId === athleteId && e.date >= weekAgo);
  const meals = db.mealCompletions.filter((e) => e.athleteId === athleteId && e.date >= weekAgo);
  const executed = marks.filter((m) => m.mark === "taken").length + meals.filter((m) => m.mark === "completed").length;
  const total = marks.length + meals.length;
  const adherencePct = total > 0 ? Math.round((executed / total) * 100) : null;

  const constraints = lifestyle
    ? detectScheduleConstraints(lifestyle.events).filter((c) => c.severity === "attention").length
    : 0;

  return [
    {
      id: "protocol",
      label: "Protocol",
      state: protocol ? "ready" : "not_established",
      value: protocol ? `v${protocol.version} active` : "None active",
      section: "protocols",
    },
    {
      id: "nutrition",
      label: "Nutritional Structure",
      state: architecture && mealPlan ? "ready" : architecture || mealPlan ? "attention" : "not_established",
      value: architecture && mealPlan ? "Architecture + plan active" : architecture ? "Plan not active" : mealPlan ? "No architecture" : "Not established",
      section: "fuel",
    },
    {
      id: "schedule",
      label: "Schedule Integrity",
      state: !lifestyle ? "not_established" : constraints > 0 ? "attention" : "ready",
      value: !lifestyle ? "No operating week" : constraints > 0 ? `${constraints} to resolve` : "Clean",
      section: "lifestyle",
    },
    {
      id: "preparation",
      label: "Preparation",
      state: prepOnHand.length > 0 ? "ready" : "attention",
      value: prepOnHand.length > 0 ? `${prepOnHand.reduce((a, m) => a + m.servings, 0)} portions on hand` : "Nothing prepared",
      section: "fuel",
    },
    {
      id: "adherence",
      label: "Protocol Adherence",
      state: adherencePct === null ? "not_established" : adherencePct >= 80 ? "ready" : "attention",
      value: adherencePct === null ? "No logs yet" : `${adherencePct}% (7-day)`,
      section: "protocols",
    },
  ];
}

/* ─── Behavioral momentum ─────────────────────────────────────────────── */

export type MomentumNote = { kind: "win" | "friction" | "opportunity"; text: string };

export function deriveBehavioralMomentum(
  db: CoachingDatabase,
  athleteId: string,
  today: string = todayKey(),
): MomentumNote[] {
  const notes: MomentumNote[] = [];
  const weekAgo = dateKeyOffset(today, -7);

  const latestCheckIn = db.checkIns
    .filter((c) => c.athleteId === athleteId)
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))[0];
  if (latestCheckIn && latestCheckIn.trainingAdherencePct >= 90) {
    notes.push({ kind: "win", text: `${latestCheckIn.trainingAdherencePct}% training adherence reported last check-in.` });
  }

  const marks = db.protocolAdherence.filter((e) => e.athleteId === athleteId && e.date >= weekAgo);
  const skipped = marks.filter((m) => m.mark === "skipped");
  if (skipped.length >= 2) {
    const byItem = new Map<string, number>();
    for (const m of skipped) byItem.set(m.itemId, (byItem.get(m.itemId) ?? 0) + 1);
    const repeated = [...byItem.entries()].find(([, n]) => n >= 2);
    if (repeated) {
      const protocol = db.supplementProtocols.find((p) => p.athleteId === athleteId && p.status === "active");
      const item = protocol?.items.find((i) => i.id === repeated[0]);
      notes.push({
        kind: "friction",
        text: `${item?.productName ?? "One protocol item"} skipped repeatedly this week — the timing may not fit the real day.`,
      });
    } else {
      notes.push({ kind: "friction", text: `${skipped.length} protocol marks skipped this week.` });
    }
  }

  const missedMeals = db.mealCompletions.filter(
    (e) => e.athleteId === athleteId && e.date >= weekAgo && e.mark === "missed",
  );
  if (missedMeals.length >= 2) {
    notes.push({ kind: "friction", text: `${missedMeals.length} planned meals missed this week.` });
  }

  if (latestCheckIn && latestCheckIn.recovery !== null && latestCheckIn.recovery <= 2) {
    notes.push({ kind: "opportunity", text: "Recovery reported low — protect the wind-down window before adding anything." });
  }
  if (notes.length === 0) {
    notes.push({ kind: "win", text: "No structural friction recorded this week — the operation is executing as designed." });
  }
  return notes;
}

/* ─── Operational timeline ────────────────────────────────────────────── */

export type TimelineEntry = {
  date: string; // YYYY-MM-DD
  label: string;
  kind: "review" | "prep" | "grocery" | "monitoring" | "follow_up" | "check_in";
  section: OperationsSectionId;
};

export function deriveOperationalTimeline(
  db: CoachingDatabase,
  athleteId: string,
  today: string = todayKey(),
  limit = 6,
): TimelineEntry[] {
  const entries: TimelineEntry[] = [];

  const protocol = db.supplementProtocols.find((p) => p.athleteId === athleteId && p.status === "active");
  if (protocol?.reviewDate && protocol.reviewDate >= today) {
    entries.push({ date: protocol.reviewDate, label: `Protocol review — ${protocol.name}`, kind: "review", section: "protocols" });
  }
  for (const session of db.mealPrepSessions.filter((s) => s.athleteId === athleteId && s.prepDate >= today && s.status !== "complete")) {
    entries.push({ date: session.prepDate, label: `Preparation session · ${session.cookingWindow}`, kind: "prep", section: "fuel" });
  }
  for (const plan of db.groceryPlans.filter((p) => p.athleteId === athleteId && p.status !== "complete" && p.weekOf >= dateKeyOffset(today, -6))) {
    const groceryDay = plan.weekOf >= today ? plan.weekOf : today;
    entries.push({ date: groceryDay, label: `Grocery window — week of ${plan.weekOf}`, kind: "grocery", section: "fuel" });
  }
  for (const record of db.clinicalRecords.filter((r) => r.athleteId === athleteId && r.status === "active")) {
    if (record.labReminderDate && record.labReminderDate >= today) {
      entries.push({ date: record.labReminderDate, label: "Monitoring reminder (clinician-directed labs)", kind: "monitoring", section: "clinical" });
    }
    if (record.followUpDate && record.followUpDate >= today) {
      entries.push({ date: record.followUpDate, label: "Clinician follow-up", kind: "follow_up", section: "clinical" });
    }
  }
  return entries.sort((a, b) => a.date.localeCompare(b.date)).slice(0, limit);
}
