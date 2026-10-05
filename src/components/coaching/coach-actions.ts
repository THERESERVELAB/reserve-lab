"use client";

/* ════════════════════════════════════════════════════════════════════════
   COACH ACTIONS — where a gold action lands.

   A brief's primary action often belongs to another coach screen (the home
   screen's "Review next check-in" is done in Reviews). The runner switches
   screens and leaves a one-shot intent; the destination reads it once, on
   mount, and opens the exact thing: the check-in's review form, the
   invitation sheet, the plan's revision draft. Nothing is guessed — an
   intent names a real record id or a real flow.
   ════════════════════════════════════════════════════════════════════════ */

import { useCallback, useMemo } from "react";

import { useCoachingStore } from "@/lib/coaching/store";
import {
  buildCoachDecisionInput,
  type CoachDecisionInput,
  type CoachPrimaryAction,
} from "@/lib/coaching/workspace-brief";

export type CoachIntent =
  | { kind: "invite" }
  | { kind: "review-request"; invitationId: string }
  | { kind: "review-check-in"; checkInId: string }
  | { kind: "live"; athleteId: string }
  | { kind: "revise"; prescriptionId: string }
  | { kind: "edit"; prescriptionId: string }
  | { kind: "create-plan" }
  | { kind: "create-template" }
  | { kind: "thread" };

let pending: CoachIntent | null = null;

export function setCoachIntent(intent: CoachIntent | null) {
  pending = intent;
}

/** Read without clearing: safe inside a lazy state initializer. */
export function peekCoachIntent<K extends CoachIntent["kind"]>(kind: K): Extract<CoachIntent, { kind: K }> | null {
  return pending && pending.kind === kind ? (pending as Extract<CoachIntent, { kind: K }>) : null;
}

export function clearCoachIntent(kind: CoachIntent["kind"]) {
  if (pending?.kind === kind) pending = null;
}

/** Scroll a record into view and move focus to it (or its first control). */
export function focusCoachTarget(id: string, selector?: string) {
  if (typeof document === "undefined") return;
  requestAnimationFrame(() => {
    const host = document.getElementById(id);
    if (!host) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    host.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    const control = selector ? host.querySelector<HTMLElement>(selector) : null;
    (control ?? host).focus({ preventScroll: true });
  });
}

/** The roster snapshot every brief reads. */
export function useCoachDecisionInput(): CoachDecisionInput {
  const db = useCoachingStore((s) => s.db);
  const clients = useCoachingStore((s) => s.clients);
  const alerts = useCoachingStore((s) => s.alerts);
  const actorId = useCoachingStore((s) => s.actorId);
  return useMemo(() => buildCoachDecisionInput(db, clients, alerts, actorId), [db, clients, alerts, actorId]);
}

/**
 * Runs a primary action that leaves the current screen. Actions a screen
 * performs in place (open its own sheet) are handled by that screen first.
 */
export function useRunCoachAction() {
  const setCoachView = useCoachingStore((s) => s.setCoachView);
  const openClient = useCoachingStore((s) => s.openClient);
  const setActiveThread = useCoachingStore((s) => s.setActiveThread);
  const alerts = useCoachingStore((s) => s.alerts);
  const db = useCoachingStore((s) => s.db);

  return useCallback(
    (action: CoachPrimaryAction) => {
      switch (action.kind) {
        case "invite-client":
        case "open-clients":
          setCoachIntent({ kind: "invite" });
          setCoachView("clients");
          return;
        case "review-athlete-request":
          setCoachIntent({ kind: "review-request", invitationId: action.invitationId });
          setCoachView("clients");
          return;
        case "review-check-in":
          setCoachIntent({ kind: "review-check-in", checkInId: action.checkInId });
          setCoachView("reviews");
          return;
        case "resolve-conflict":
        case "review-live-change":
          setCoachIntent({ kind: "live", athleteId: action.athleteId });
          setCoachView("live");
          return;
        case "revise-plan":
          setCoachIntent({ kind: "revise", prescriptionId: action.prescriptionId });
          setCoachView(action.category === "training" ? "programs" : action.category === "nutrition" ? "nutrition" : "schedules");
          return;
        case "finish-draft":
          setCoachIntent({ kind: "edit", prescriptionId: action.prescriptionId });
          setCoachView(action.category === "training" ? "programs" : action.category === "nutrition" ? "nutrition" : "schedules");
          return;
        case "open-thread":
          setActiveThread(action.threadId);
          setCoachIntent({ kind: "thread" });
          setCoachView("messages");
          return;
        case "create-template":
          setCoachIntent({ kind: "create-template" });
          setCoachView("templates");
          return;
        case "alert-action": {
          const alert = alerts.find((a) => a.id === action.alertId);
          if (!alert) return;
          switch (alert.recommendedAction.target) {
            case "live_day":
              setCoachIntent({ kind: "live", athleteId: alert.athleteId });
              setCoachView("live");
              return;
            case "checkin":
              setCoachView("reviews");
              return;
            case "messages": {
              const thread = db.conversations.find((c) => c.relationshipId === alert.relationshipId);
              if (thread) setActiveThread(thread.id);
              setCoachIntent({ kind: "thread" });
              setCoachView("messages");
              return;
            }
            default:
              openClient(alert.athleteId);
          }
          return;
        }
        case "create-plan":
        case "send-plan":
          /* Handled in place by the plans screen. */
          return;
      }
    },
    [alerts, db.conversations, openClient, setActiveThread, setCoachView],
  );
}
