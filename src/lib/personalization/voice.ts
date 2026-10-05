/* ════════════════════════════════════════════════════════════════════════
   RESERVE VOICE — gender-aware vocabulary layer
   ------------------------------------------------------------------------
   Centralizes the premium male / female / inclusive lexicon so the
   difference between experiences is expressed through language and emphasis
   rather than colour stereotypes. Every voice stays premium, respectful,
   and professional. Setup / personalization only — no medical claims.
   ════════════════════════════════════════════════════════════════════════ */

import type { MemberGenderIdentity } from "@/lib/athlete-store";

export type ReserveVoice = {
  /** Short label for the experience surface. */
  surface: string;
  /** Hero kicker shown above the greeting. */
  heroKicker: string;
  /** Consistency card kicker + title. */
  consistencyKicker: string;
  streakTitle: string;
  /** Activation card kicker. */
  activationKicker: string;
  /** A single word describing the member's work this season. */
  buildWord: string;
  /** Verb the system uses when motivating the member. */
  driveWord: string;
};

const MALE_VOICE: ReserveVoice = {
  surface: "Performance Command",
  heroKicker: "Performance Command",
  consistencyKicker: "Discipline",
  streakTitle: "Daily Streak",
  activationKicker: "Output",
  buildWord: "structure",
  driveWord: "command",
};

const FEMALE_VOICE: ReserveVoice = {
  surface: "Performance Studio",
  heroKicker: "Performance Studio",
  consistencyKicker: "Rhythm",
  streakTitle: "Daily Rhythm",
  activationKicker: "Progress",
  buildWord: "shape",
  driveWord: "sculpt",
};

const INCLUSIVE_VOICE: ReserveVoice = {
  surface: "Performance Lab",
  heroKicker: "Performance Lab",
  consistencyKicker: "Consistency",
  streakTitle: "Daily Streak",
  activationKicker: "Activation",
  buildWord: "progress",
  driveWord: "build",
};

/** Resolve the active voice from the member's gender identity. */
export function getReserveVoice(gender: MemberGenderIdentity | undefined): ReserveVoice {
  if (gender === "male") return MALE_VOICE;
  if (gender === "female") return FEMALE_VOICE;
  return INCLUSIVE_VOICE;
}
