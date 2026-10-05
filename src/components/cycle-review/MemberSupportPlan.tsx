"use client";

import { useMemo } from "react";

import { SafetyAcknowledgementGate } from "@/components/safety/SafetyAcknowledgementGate";
import { useClientNow } from "@/components/safety/useClientNow";
import { compoundIdentity, useSafetyContext } from "@/components/safety/useSafetyContext";
import { ReserveLoading } from "@/components/ui/reserve";
import { useAthleteDashboardStore } from "@/lib/athlete-store";
import type { SupportArrival } from "@/lib/compound-command/command-room";
import { dateKeyOf } from "@/lib/cycle/cycle-period";
import { buildMemberSupportReview } from "@/lib/cycle-review/member-support";

import { SupportStackRoom } from "./SupportStackRoom";

/**
 * The support plan in Compound Command → Support Stack. Works without a
 * cycle, and — like every risk-informed surface — only after the member
 * accepts the safety acknowledgement (including 18+).
 */
export function MemberSupportPlan({ arrival }: { arrival?: SupportArrival | null }) {
  const now = useClientNow();
  if (!now) return <ReserveLoading label="Loading support plan" />;
  return (
    <SafetyAcknowledgementGate>
      <MemberSupportPlanBody now={now} arrival={arrival} />
    </SafetyAcknowledgementGate>
  );
}

function MemberSupportPlanBody({ now, arrival }: { now: Date; arrival?: SupportArrival | null }) {
  const ctx = useSafetyContext(now);
  const checkIns = useAthleteDashboardStore((s) => s.cycleCheckIns);
  const sleepLogs = useAthleteDashboardStore((s) => s.recoveryCommand.sleepLogs);
  const coachingProfile = useAthleteDashboardStore((s) => s.profile.coachingProfile);
  const allergies = useAthleteDashboardStore((s) => s.nutritionPrefs.allergies);
  const plan = useAthleteDashboardStore((s) => s.supportPlan);

  const support = useMemo(
    () =>
      buildMemberSupportReview({
        today: dateKeyOf(now),
        compounds: ctx.compounds.map((entry) => {
          const identity = compoundIdentity(entry);
          return {
            id: entry.id,
            name: identity.name,
            officialName: identity.officialName,
            compoundClass: identity.compoundClass,
            category: entry.category,
            route: entry.route,
            isActive: entry.isActive,
            pausedAt: entry.pausedAt,
            startDate: entry.startDate,
          };
        }),
        labBrief: ctx.labBrief,
        checkIns: checkIns ?? [],
        sleepLogDates: (sleepLogs ?? []).map((log) => log.date.slice(0, 10)),
        medicationsText: coachingProfile?.medications ?? "",
        healthContext: coachingProfile?.healthContext ?? [],
        allergies: allergies ?? [],
        needsCare: ctx.escalation.some((item) => item.level === "crisis" || item.level === "emergency" || item.level === "contact-clinician-today"),
        plan: plan ?? [],
      }),
    [ctx, checkIns, sleepLogs, coachingProfile, allergies, plan, now],
  );

  return <SupportStackRoom support={support} arrival={arrival} />;
}
