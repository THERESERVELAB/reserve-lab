/* ════════════════════════════════════════════════════════════════════════
   TIMELINE WORDS — how Reserve describes a change or an observation.

   Plain record-keeping: what changed, from what, to what, and when. Never
   why, never what it did, never whether it was a good idea.
   ════════════════════════════════════════════════════════════════════════ */

import type { ChangeAction, ChangeEvent, FieldChange } from "./change-events";
import type { Observation } from "./types";

const TITLE: Record<ChangeAction, (name: string) => string> = {
  added: (name) => `Added ${name}`,
  edited: (name) => `Edited ${name}`,
  paused: (name) => `Paused ${name}`,
  resumed: (name) => `Resumed ${name}`,
  activated: (name) => `Marked ${name} active`,
  deactivated: (name) => `Marked ${name} inactive`,
  removed: (name) => `Removed ${name}`,
  ended: (name) => `Ended ${name}`,
  reopened: (name) => `Reopened ${name}`,
  "checkpoint-added": (name) => `Added a lab checkpoint to ${name}`,
  "checkpoint-removed": (name) => `Removed a lab checkpoint from ${name}`,
  restored: (name) => `Restored ${name} from a device copy`,
};

export const CHANGE_KIND_LABEL: Record<ChangeEvent["subject"]["kind"], string> = {
  compound: "Compound",
  "support-plan": "Support plan",
  cycle: "Cycle",
};

export function changeEventTitle(event: ChangeEvent): string {
  return TITLE[event.action](event.subject.name);
}

export function fieldChangeText(change: FieldChange): string {
  return `${change.label}: ${change.from || "not set"} → ${change.to || "not set"}`;
}

export function changeEventDetails(event: ChangeEvent): string[] {
  return event.changes.map(fieldChangeText);
}

export const OBSERVATION_LABEL = "Your observation · timing only";

export const OBSERVATION_EXPLAINER =
  "Observations place two things you chose side by side in time. Reserve adds no analysis, and timing alone can't show that one thing changed another.";

export function observationLines(observation: Observation): { changed: string; noticed: string } {
  return { changed: `Changed: ${observation.changed.label}`, noticed: `Noticed: ${observation.noticed.label}` };
}
