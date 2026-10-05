"use client";

import { CalendarClock, Sparkles } from "lucide-react";
import { useMemo } from "react";

import { ReserveDisclosure } from "@/components/ui/reserve";
import { useAthleteDashboardStore, type DashboardView } from "@/lib/athlete-store";
import { RESERVE } from "@/lib/design/tokens";
import { formatDay, photoRecord, physiqueEvidence } from "@/lib/physique/record-summary";
import { firstUnmet, type Requirement } from "@/lib/records/requirements";

import { RecordHero } from "./records/RecordHero";
import { RequirementsPanel } from "./records/Requirements";
import { ViewShell } from "./ViewShell";

/* ════════════════════════════════════════════════════════════════════════
   PEAK WEEK WORKFLOW — dormant until the member sets a target date.

   What was removed here, and why:

     · A "T-5 to Show" countdown, a 5-Days-Out headline and a seven-day
       task timeline — none of it derived from anything the member entered.
     · Hydration / sodium / carbohydrate meters running against invented
       targets. A target intake is a prescription; Reserve does not set one
       (CLAUDE.md compliance).
     · "Current Body Weight 189.4 · Target 185 · Δ +4.4 lb" — an invented
       reading against an invented goal.
     · A posing reminder that promised "symmetry comparison", a photo
       analysis DESIGN_BIBLE §02 forbids outright.

   What is left is the truth: peak week runs on a date the member sets and
   the logs they keep, and neither exists yet. The screen says so, shows the
   evidence it does have, and offers the one action that starts it.
   ════════════════════════════════════════════════════════════════════════ */

export function PeakPhysiqueView() {
  const setActiveView = useAthleteDashboardStore((s) => s.setActiveView);
  const physique = useAthleteDashboardStore((s) => s.physiqueCommand);

  const evidence = useMemo(() => physiqueEvidence(physique), [physique]);
  const photos = useMemo(() => photoRecord(physique), [physique]);

  /* Peak week has no target-date model yet, so its first requirement can
     never read as met. That is the honest state, and the list says so
     rather than the screen pretending to be waiting on nothing. */
  const requirements: Requirement[] = [
    {
      id: "date",
      label: "A target date",
      have: 0,
      need: 1,
      noun: "target date",
      detail: "A show, shoot or deadline you set in Protocol Command.",
      action: "Set a Target Date",
      view: "protocol-command",
    },
    {
      id: "check-ins",
      label: "Physique check-ins",
      have: Math.min(evidence.entryCount, 2),
      need: 2,
      noun: "check-ins",
      detail: "Your own entries — never a target Reserve invented.",
      action: "Log a Check-In",
      view: "physique",
    },
    {
      id: "photos",
      label: "Photo check-ins",
      have: Math.min(photos.checkInCount, 1),
      need: 1,
      noun: "photo check-in",
      detail: "Dated sets beside the week. Reserve never scores a photo.",
      action: "Add Progress Photo",
      view: "progress-photos",
    },
    {
      id: "hydration",
      label: "Intake you log",
      have: 0,
      need: 1,
      noun: "nutrition log",
      detail: "What you record eating and drinking. It never sets an amount.",
      action: "Open Nutrition Command",
      view: "nutrition",
    },
  ];
  const next = firstUnmet(requirements);

  return (
    <ViewShell
      label="Peak Physique Mode"
      title="Peak Week Workflow"
      icon={Sparkles}
      accentColor={RESERVE.gold}
      badge="Reserve Black"
      roomHero
      command="The final week before a date you set, run on your own logs."
    >
      <RecordHero
        testId="peak-physique"
        accent={RESERVE.gold}
        eyebrow="Peak week · not scheduled"
        statement="No target date is set"
        support="Peak week opens once you give it a date, then counts back using only what you log."
        reads={[
          { label: "Target date", value: null, empty: "Not set" },
          {
            label: "Check-ins",
            value: evidence.entryCount > 0 ? String(evidence.entryCount) : null,
            detail: evidence.spanDays !== null ? `over ${evidence.spanDays} days` : undefined,
            empty: "Evidence needed",
          },
          {
            label: "Photo check-ins",
            value: photos.checkInCount > 0 ? String(photos.checkInCount) : null,
            detail: photos.newest ? `last ${formatDay(photos.newest.date)}` : undefined,
            empty: "Evidence needed",
          },
        ]}
        action={
          next
            ? { label: next.action, icon: CalendarClock, onClick: () => setActiveView(next.view as DashboardView) }
            : { label: "Set a Target Date", icon: CalendarClock, onClick: () => setActiveView("protocol-command") }
        }
      />

      {/* The requirements header is a shared records component whose h2 does
          not shrink; at 390px "What peak week runs on · Evidence needed…" ran
          48px past the screen. It is owned by another wave, so it is allowed
          to wrap here, at the call site, rather than edited. */}
      <div data-peak="requirements" className="min-w-0 [&_h2]:min-w-0 [&_h2]:shrink">
        <RequirementsPanel
          title="What peak week runs on"
          purpose="The final days before your date, read from your own logs. It sets nothing for you."
          requirements={requirements}
          onOpen={(view) => setActiveView(view)}
          accent={RESERVE.gold}
          detail="peak-stage"
        />
      </div>

      {/* One whisper line with the full sentence behind it — the old callout
          box and the footer repeated each other. */}
      <footer data-peak="limits" className="pt-1">
        <ReserveDisclosure summary="Observation only · what peak week will not do">
          <p className="max-w-[70ch] text-[12.5px] leading-[1.55] text-white/55">
            Peak week does not set an amount of water, sodium or carbohydrate, does not manipulate them for you, and does
            not assess a photograph.
          </p>
          <p className="mt-1.5 max-w-[70ch] text-[12.5px] leading-[1.55] text-white/55">
            Intake, check-ins and rehearsal blocks stay yours, your coach&apos;s and your clinician&apos;s.
          </p>
        </ReserveDisclosure>
      </footer>
    </ViewShell>
  );
}
