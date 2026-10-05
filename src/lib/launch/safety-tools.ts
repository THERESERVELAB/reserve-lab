/* ════════════════════════════════════════════════════════════════════════
   LAUNCH SWITCH — safety tools awaiting clinician and counsel review.

   Cycle & Safety (compound risk profiles, support options, Cycle Review,
   red-flag check, clinician summary), the Bloodwork safety panel (lab flags
   against report ranges and escalation) and the "What this measures" lines
   await licensed-clinician and counsel review (docs/compliance).

   Production builds hide them unless NEXT_PUBLIC_ENABLE_SAFETY_TOOLS=true.
   Local development and e2e keep them on unless the flag is "false".
   The value is read at build time: changing it needs a redeploy.

   Lab report reading and logging stay on either way — they are the member's
   own records.
   ════════════════════════════════════════════════════════════════════════ */

export function resolveSafetyTools(flag: string | undefined, nodeEnv: string | undefined): boolean {
  if (flag === "true") return true;
  if (flag === "false") return false;
  return nodeEnv !== "production";
}

export const SAFETY_TOOLS_ENABLED = resolveSafetyTools(process.env.NEXT_PUBLIC_ENABLE_SAFETY_TOOLS, process.env.NODE_ENV);
