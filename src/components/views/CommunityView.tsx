"use client";

/* ════════════════════════════════════════════════════════════════════════
   COMMUNITY — a utility screen that tells the truth about itself.

   The previous screen was a staged chat room: invented members with ranks,
   invented posts and PRs, "247 members online", challenge participation
   and a live-looking composer. None of it came from anywhere.

   What is real is the list of planned channels and which of them the
   member's own plan includes. Reading and posting are not built, so this
   screen shows no conversation and offers no action. The hero says so
   plainly instead of carrying a gold button that leads nowhere.
   ════════════════════════════════════════════════════════════════════════ */

import { Users } from "lucide-react";
import { useMemo } from "react";

import { GlassPanel } from "@/components/ui/GlassPanel";
import { DETAIL_BAND_BLEED, ReserveDetailImage, ReserveSectionHeader } from "@/components/ui/reserve";
import { RecordEmpty, RecordList, RecordRow, RecordTag } from "@/components/views/records/RecordRows";
import { useAthleteDashboardStore } from "@/lib/athlete-store";
import { describeCommunity } from "@/lib/community/status";
import { RESERVE } from "@/lib/design/tokens";
import { useCommunityChannels } from "@/lib/hooks/useCommunityChannels";

import { ViewShell } from "./ViewShell";
import { UtilityHero } from "./utility/UtilityHero";

export function CommunityView() {
  const subscriptionTier = useAthleteDashboardStore((s) => s.subscriptionTier);
  const { channels } = useCommunityChannels();
  const status = useMemo(() => describeCommunity({ channels, tier: subscriptionTier }), [channels, subscriptionTier]);

  return (
    <ViewShell
      label="People"
      title="Community"
      icon={Users}
      accentColor={RESERVE.gold}
      roomHero
      command="Where members will talk training, check-ins and progress with each other."
      disclaimer="When Community opens, it will be for training, nutrition, recovery and accountability discussion. It will not carry medical advice or dosage guidance."
    >
      <UtilityHero
        testId="community"
        eyebrow="Community · Not open"
        statement={status.statement}
        support={status.support}
        reads={[
          {
            label: "Channels planned",
            value: status.channelsTotal > 0 ? String(status.channelsTotal) : null,
            empty: "None set up",
          },
          {
            label: "In your plan",
            value: status.channelsTotal > 0 ? `${status.channelsIncluded} of ${status.channelsTotal}` : null,
            empty: "None set up",
          },
          { label: "Posting", value: null, empty: "Not open yet" },
        ]}
        noAction="There is nothing to read or post yet, so there is nothing to do here today."
      />

      <GlassPanel accent={RESERVE.gold} phone="flush">
        <ReserveDetailImage id="community-lounge" className={DETAIL_BAND_BLEED} />
        <section aria-label="Planned channels">
          <ReserveSectionHeader label={`Planned channels · ${status.channelsTotal}`} accent={RESERVE.gold} />
          {status.rows.length === 0 ? (
            <RecordEmpty headline="No channels are set up." body="When channels are created they will be listed here, with the plan each one belongs to." />
          ) : (
            <>
              <p className="max-w-[72ch] text-[13.5px] leading-[1.6] text-white/70">
                {status.fullAccessPlan
                  ? `Your plan includes ${status.channelsIncluded} of ${status.channelsTotal}. The rest are part of ${status.fullAccessPlan}.`
                  : "Every planned channel is part of your plan."}
              </p>
              <RecordList label="Planned channels" className="mt-3.5">
                {status.rows.map((row) => (
                  <RecordRow key={row.slug}>
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <div className="min-w-0 flex-1">
                        <p className="text-[15px] font-semibold text-[#f2eee6]">{row.name}</p>
                        <p className="mt-1 max-w-[64ch] text-[12.5px] leading-[1.55] text-white/60">{row.description}</p>
                      </div>
                      <RecordTag accent={row.included ? RESERVE.green : RESERVE.slate}>{row.access}</RecordTag>
                    </div>
                  </RecordRow>
                ))}
              </RecordList>
            </>
          )}
        </section>
      </GlassPanel>
    </ViewShell>
  );
}
