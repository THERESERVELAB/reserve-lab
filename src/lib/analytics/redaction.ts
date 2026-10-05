/**
 * Analytics metadata guard.
 *
 * Engagement events exist to answer operational questions — which surface,
 * which tier, did it persist, how long did it take. They must never carry
 * private member content: health context, lab values, compound or medication
 * context, symptoms, free-text notes, or any credential.
 *
 * Call sites are reviewed, but review is not a guarantee. This is the single
 * enforcement point every event passes through, so a future call site cannot
 * quietly widen what analytics stores.
 */

/** Metadata keys whose VALUE is dropped and replaced with a marker. */
const SENSITIVE_KEY = new RegExp(
  [
    // Health + enhanced-athlete context
    "hormone", "steroid", "compound", "peptide", "cycle", "dose", "dosage",
    "bloodwork", "biomarker", "lab", "medication", "symptom", "diagnosis",
    "injury", "menstrual", "cyclephase",
    // Body/measurement specifics
    "weight", "bodyfat", "body_fat", "measurement", "circumference", "photo",
    // Free-text and identity
    "note", "notes", "journal", "message", "body", "content", "comment",
    "email", "phone", "address", "name",
    // Credentials
    "token", "password", "secret", "key", "authorization", "cookie", "session",
  ].join("|"),
  "i",
);

/** Values that look like a credential regardless of their key. */
const SECRET_VALUE = /(eyJ[A-Za-z0-9_-]{10,})|(sb_secret_)|(sk-[A-Za-z0-9]{16,})|(service_role)/i;

export const REDACTED = "[redacted]";

/** Keys that are always safe, even if they match a sensitive substring. */
const ALLOWED_KEYS = new Set([
  "tier", "persona", "source", "leadId", "persisted", "featureKey", "channel",
  "surface", "route", "durationMs", "errorCode", "status", "count", "step",
  "variant", "reason", "mode", "attributionId",
]);

export type AnalyticsMetadata = Record<string, string | number | boolean | null>;

export function redactAnalyticsMetadata(metadata: AnalyticsMetadata): AnalyticsMetadata {
  const safe: AnalyticsMetadata = {};

  for (const [key, value] of Object.entries(metadata)) {
    if (ALLOWED_KEYS.has(key)) {
      safe[key] = typeof value === "string" && SECRET_VALUE.test(value) ? REDACTED : value;
      continue;
    }
    if (SENSITIVE_KEY.test(key)) {
      safe[key] = REDACTED;
      continue;
    }
    if (typeof value === "string" && (SECRET_VALUE.test(value) || value.length > 200)) {
      safe[key] = REDACTED;
      continue;
    }
    safe[key] = value;
  }

  return safe;
}

/** Event names and feature keys are identifiers, never member content. */
export function redactAnalyticsLabel(label: string): string {
  return SECRET_VALUE.test(label) ? REDACTED : label.slice(0, 120);
}
