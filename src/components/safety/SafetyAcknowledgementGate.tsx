"use client";

import { ShieldCheck } from "lucide-react";
import { useId, useState } from "react";

import { GlassPanel } from "@/components/ui/GlassPanel";
import { ReserveButton } from "@/components/ui/reserve";
import { useAthleteDashboardStore } from "@/lib/athlete-store";
import { RESERVE, alpha } from "@/lib/design/tokens";
import {
  MIN_MEMBER_AGE,
  SAFETY_ACK_CONFIRM_ADULT,
  SAFETY_ACK_CONFIRM_UNDERSTOOD,
  SAFETY_ACK_POINTS,
  safetyAccess,
} from "@/lib/safety/acknowledgement";

/**
 * Risk profiles, lab flags and cycle monitoring appear only after the member
 * accepts what Reserve is — and is not — and confirms they are 18 or older.
 * A change to the points bumps the version, and the gate returns. A profile
 * age under 18 closes the tools with nothing to accept.
 */
export function SafetyAcknowledgementGate({ children }: { children: React.ReactNode }) {
  const acknowledgement = useAthleteDashboardStore((s) => s.safetyAcknowledgement);
  const profileAge = useAthleteDashboardStore((s) => s.setupProfile.age);
  const acknowledgeSafety = useAthleteDashboardStore((s) => s.acknowledgeSafety);
  const [understood, setUnderstood] = useState(false);
  const [adult, setAdult] = useState(false);
  const understoodId = useId();
  const adultId = useId();

  const access = safetyAccess(acknowledgement, profileAge);
  if (access === "open") return <>{children}</>;

  if (access === "under-age") {
    return (
      <GlassPanel accent={RESERVE.steel}>
        <div className="flex flex-col gap-3">
          <p className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.22em]" style={{ color: alpha(RESERVE.steel, 0.85) }}>
            <ShieldCheck size={11} aria-hidden="true" />
            Adults only
          </p>
          <h2 className="text-[17px] font-bold" style={{ color: RESERVE.ivory }}>
            For adults {MIN_MEMBER_AGE} and older
          </h2>
          <p className="text-[13px] leading-[1.55] text-white/70">
            Cycle monitoring, compound risk information and lab flags are for adults {MIN_MEMBER_AGE} and older. Your profile lists your age as {profileAge}, so
            these tools stay closed.
          </p>
          <p className="text-[13px] leading-[1.55] text-white/70">
            If you have questions about your health, talk with a parent or guardian and a doctor. In an emergency, call 911 or your local emergency
            number.
          </p>
        </div>
      </GlassPanel>
    );
  }

  const ready = understood && adult;

  return (
    <GlassPanel accent={RESERVE.steel}>
      <div className="flex flex-col gap-4">
        <div>
          <p className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.22em]" style={{ color: alpha(RESERVE.steel, 0.85) }}>
            <ShieldCheck size={11} aria-hidden="true" />
            Before you continue
          </p>
          <h2 className="mt-1.5 text-[17px] font-bold" style={{ color: RESERVE.ivory }}>
            How Reserve helps keep you safe
          </h2>
        </div>

        <ul className="flex flex-col gap-2">
          {SAFETY_ACK_POINTS.map((point) => (
            <li key={point} className="flex gap-2.5 text-[13px] leading-[1.55] text-white/70">
              <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full" style={{ background: RESERVE.steel }} aria-hidden="true" />
              {point}
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-1">
          <label htmlFor={understoodId} className="flex min-h-[44px] cursor-pointer items-center gap-3 text-[13px] text-white/75">
            <input
              id={understoodId}
              type="checkbox"
              checked={understood}
              onChange={(e) => setUnderstood(e.target.checked)}
              className="h-5 w-5 shrink-0 accent-[#5fb7d5]"
            />
            {SAFETY_ACK_CONFIRM_UNDERSTOOD}
          </label>
          <label htmlFor={adultId} className="flex min-h-[44px] cursor-pointer items-center gap-3 text-[13px] text-white/75">
            <input id={adultId} type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} className="h-5 w-5 shrink-0 accent-[#5fb7d5]" />
            {SAFETY_ACK_CONFIRM_ADULT}
          </label>
        </div>

        <div>
          {ready ? (
            <ReserveButton tier="primary" onClick={acknowledgeSafety}>
              Continue
            </ReserveButton>
          ) : (
            <ReserveButton tier="primary" disabled disabledReason="Confirm both statements first.">
              Continue
            </ReserveButton>
          )}
        </div>
      </div>
    </GlassPanel>
  );
}
