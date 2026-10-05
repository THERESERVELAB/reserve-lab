/* ════════════════════════════════════════════════════════════════════════
   SAFETY ACKNOWLEDGEMENT — what a member agrees they understand before
   Reserve shows compound risk profiles, lab flags or cycle monitoring.

   Bump SAFETY_ACK_VERSION whenever the points change; members re-acknowledge.

   Age: these tools are for adults. The member confirms they are 18 or older
   as part of the acknowledgement (self-attestation — no document check), and
   a profile age under 18 closes them regardless of any earlier acknowledgement.
   ════════════════════════════════════════════════════════════════════════ */

export const SAFETY_ACK_VERSION = "2026.09.14";

/** Cycle monitoring, compound risk information and lab flags are for adults. */
export const MIN_MEMBER_AGE = 18;

export type SafetyAcknowledgement = {
  acknowledgedAt: string;
  version: string;
  /** When the member confirmed they are 18 or older. */
  adultConfirmedAt?: string;
};

export const SAFETY_ACK_POINTS: string[] = [
  "Reserve is not a medical provider. It does not diagnose, treat or prescribe.",
  "Reserve never tells you how much of anything to use, how long to use it, or whether to start, stop or continue.",
  "Lab flags compare your results to the reference range printed on your own report. They are prompts to talk to a clinician, not a clinical assessment.",
  "Compound information describes known risks from public scientific and FDA sources, and is awaiting review by a licensed clinician.",
  `Cycle monitoring, compound risk information and lab flags are for adults ${MIN_MEMBER_AGE} and older.`,
  "In an emergency, call 911 or your local emergency number.",
];

export const SAFETY_ACK_CONFIRM_UNDERSTOOD = "I understand Reserve is not medical care and does not tell me what to use.";
export const SAFETY_ACK_CONFIRM_ADULT = `I am ${MIN_MEMBER_AGE} or older.`;

/**
 * - `open` — current acknowledgement with the adult confirmation
 * - `acknowledge` — show the acknowledgement
 * - `under-age` — the member's profile age is under 18; nothing to accept
 */
export type SafetyAccess = "open" | "acknowledge" | "under-age";

export function safetyAccess(ack: SafetyAcknowledgement | null | undefined, profileAge?: number | null): SafetyAccess {
  if (typeof profileAge === "number" && Number.isFinite(profileAge) && profileAge > 0 && profileAge < MIN_MEMBER_AGE) return "under-age";
  if (ack?.version === SAFETY_ACK_VERSION && ack.adultConfirmedAt) return "open";
  return "acknowledge";
}

export function hasCurrentSafetyAcknowledgement(ack: SafetyAcknowledgement | null | undefined, profileAge?: number | null): boolean {
  return safetyAccess(ack, profileAge) === "open";
}
