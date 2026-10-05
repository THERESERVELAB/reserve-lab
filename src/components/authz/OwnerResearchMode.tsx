"use client";

import { SAFETY_TOOLS_ENABLED } from "@/lib/launch/safety-tools";

import { useCan } from "./CapabilitiesProvider";

/* Owner research mode — shown only to accounts the server verified as the
   owner. Members never render any of it. Safety warnings, escalation and the
   safety acknowledgement apply to the owner exactly as to every member. */

export const OWNER_MODE_LABEL = "Owner research mode";

/** Settings → Account. */
export function OwnerModeAccountLine() {
  const ownerResearch = useCan("owner-research-tools");
  if (!ownerResearch) return null;
  return (
    <div className="mt-3 border-t border-white/[0.05] pt-3">
      <p className="font-mono text-[8px] uppercase tracking-[0.16em] text-[#e8c87a]">{OWNER_MODE_LABEL}</p>
      <p className="mt-1 text-[10px] leading-4 text-white/55">
        Private self-tracking and experimental analytics. Safety warnings and escalation still apply.
      </p>
    </div>
  );
}

/** Cycle & Safety, while the launch switch hides these tools for members. */
export function OwnerPendingReviewNote() {
  const ownerAccess = useCan("review-pending-safety-tools");
  if (!ownerAccess || SAFETY_TOOLS_ENABLED) return null;
  return (
    <p role="note" className="text-[12px] leading-[1.5] text-white/55">
      <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#e8c87a]">{OWNER_MODE_LABEL}</span>
      {" · "}These tools are pending clinician and counsel review and are hidden for members.
    </p>
  );
}
