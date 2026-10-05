"use client";

import { Camera, ClipboardCheck, User } from "lucide-react";
import { useMemo, useState } from "react";

import { GlassPanel } from "@/components/ui/GlassPanel";
import { DETAIL_BAND_BLEED, ReserveButton, ReserveDetailImage, ReserveSectionHeader } from "@/components/ui/reserve";
import { useAthleteDashboardStore, type DashboardView } from "@/lib/athlete-store";
import { RESERVE } from "@/lib/design/tokens";
import { measurementTrends } from "@/lib/physique/engine";
import { formatDay, formatDayFull, measurementRecord, photoRecord, signed } from "@/lib/physique/record-summary";
import { PHOTO_POSES } from "@/lib/physique/types";
import { allMet, firstUnmet, type Requirement } from "@/lib/records/requirements";

import { PhysiqueCommandV2 } from "./physique/PhysiqueCommandV2";
import { RecordHero } from "./records/RecordHero";
import { RecordEmpty, RecordList, RecordRow } from "./records/RecordRows";
import { RequirementsPanel } from "./records/Requirements";
import { ViewShell } from "./ViewShell";

/* ════════════════════════════════════════════════════════════════════════
   PHYSIQUE COMMAND — the member's own record of their own body.

   Below the hero this screen shows only what the member logged: the change
   between their own dated check-ins, their dated photo check-ins, and the
   timeline of both. No zone score, no symmetry index, no body-fat estimate
   from a photograph, and no projection (DESIGN_BIBLE §02 and §12).

   With nothing logged the screen used to be one sentence and an empty
   state. It now names what it needs, shows real progress toward each line,
   and points its one gold action at the first thing missing.
   ════════════════════════════════════════════════════════════════════════ */

function poseLabels(poses: readonly string[]): string {
  const labels = poses.map((pose) => PHOTO_POSES.find((p) => p.id === pose)?.label ?? pose);
  return labels.length > 0 ? labels.join(" · ") : "No poses recorded";
}

export function PhysiqueView() {
  const setActiveView = useAthleteDashboardStore((s) => s.setActiveView);
  const physique = useAthleteDashboardStore((s) => s.physiqueCommand);

  const [checkInOpen, setCheckInOpen] = useState(false);

  const record = useMemo(() => measurementRecord(physique), [physique]);
  const photos = useMemo(() => photoRecord(physique), [physique]);
  const trends = useMemo(() => measurementTrends(physique), [physique]);

  const requirements: Requirement[] = [
    {
      id: "baseline",
      label: "A baseline check-in",
      have: Math.min(record.entryCount, 1),
      need: 1,
      noun: "check-in",
      detail: "Your weight today, and any sites you want to follow. Everything on this screen is measured from it.",
      action: "Log a Check-In",
      view: "physique",
    },
    {
      id: "second",
      label: "A second check-in",
      have: Math.min(record.entryCount, 2),
      need: 2,
      noun: "check-ins",
      detail: "A change needs two dated entries. Reserve will not estimate what happened between them.",
      action: "Log a Check-In",
      view: "physique",
    },
    {
      id: "photos",
      label: "A photo check-in",
      have: Math.min(photos.checkInCount, 1),
      need: 1,
      noun: "photo check-in",
      detail: "A dated set to sit beside the numbers. Reserve records the date and poses, and never reads the image.",
      action: "Add Progress Photo",
      view: "progress-photos",
    },
  ];

  const next = firstUnmet(requirements);
  const ready = allMet(requirements);

  const openRequirement = (view: DashboardView) =>
    view === "physique" ? setCheckInOpen(true) : setActiveView(view);

  return (
    <ViewShell
      label="Physique"
      title="Physique Command"
      icon={User}
      accentColor={RESERVE.gold}
      roomHero
      command="Your dated check-ins, and the distance between them."
      disclaimer="Physique Command tracks the measurements and photo check-ins you log. It does not score your physique, estimate body fat from photos, project results, diagnose, or make medical claims. Your photos are private and stored on your device."
    >
      <RecordHero
        testId="physique"
        accent={RESERVE.gold}
        eyebrow={`Your record · ${record.entryCount} ${record.entryCount === 1 ? "check-in" : "check-ins"}`}
        statement={record.entryCount === 0 ? "No check-ins logged yet" : record.statement}
        support={
          record.entryCount === 0
            ? "Physique Command runs entirely on entries you make. Below is exactly what it needs, and how far you have got."
            : "Every figure here is one you entered. Reserve reports the distance between two of them and leaves the conclusion to you."
        }
        reads={[
          {
            label: "Body weight",
            value: record.newest ? String(record.newest.bodyWeightLb) : null,
            unit: "lb",
            detail:
              record.weightDeltaLb !== null && record.previous
                ? `${signed(record.weightDeltaLb, "lb")} since ${formatDay(record.previous.date)}`
                : undefined,
            empty: "Evidence needed · log a check-in",
          },
          {
            label: "Sites trending",
            value: trends.length > 0 ? String(trends.length) : null,
            detail: trends.length > 0 ? "measured on two or more check-ins" : undefined,
            empty: "Evidence needed · two check-ins",
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
            ? {
                label: next.action,
                icon: next.view === "physique" ? ClipboardCheck : Camera,
                onClick: () => openRequirement(next.view as DashboardView),
              }
            : { label: "Log a Check-In", icon: ClipboardCheck, onClick: () => setCheckInOpen(true) }
        }
      />

      {!ready && (
        <RequirementsPanel
          purpose="Physique Command follows your own measurements and photo check-ins over time — what changed, by how much, and between which dates."
          requirements={requirements}
          onOpen={openRequirement}
          accent={RESERVE.gold}
        />
      )}

      {/* ── What changed, between real entries only. ── */}
      <GlassPanel accent={RESERVE.steel} phone="flush">
        <ReserveSectionHeader
          label={trends.length > 0 ? `Measurement change · ${trends.length} sites` : "Measurement change"}
          accent={RESERVE.steel}
        />
        {trends.length > 0 ? (
          <>
            <RecordList label="Measurement change by site">
              {trends.map((row) => (
                <RecordRow key={row.site}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <p className="text-[14.5px] font-semibold text-[#f2eee6]">{row.label}</p>
                    <p className="tnum text-[15px] font-semibold text-[#f2eee6]">
                      {row.latestIn} <span className="text-[12px] font-medium text-white/50">in</span>
                      <span className="ml-2.5 font-mono text-[11px] uppercase tracking-[0.12em] text-white/55">
                        {signed(row.deltaIn, "in")}
                      </span>
                    </p>
                  </div>
                  <p className="tnum mt-1 font-mono text-[11px] uppercase tracking-[0.12em] text-white/45">
                    {row.firstIn} in on {formatDay(row.firstDate)} → {row.latestIn} in on {formatDay(row.latestDate)} ·{" "}
                    {row.entries} check-ins
                  </p>
                </RecordRow>
              ))}
            </RecordList>
            <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.12em] text-white/35">
              From your logged check-ins · nothing estimated
            </p>
          </>
        ) : (
          <RecordEmpty
            headline="No site has two readings yet"
            body="A change appears once the same site is measured on two dated check-ins. A site measured once is left out rather than guessed at."
            action={
              <ReserveButton tier="secondary" size="md" accent={RESERVE.steel} icon={ClipboardCheck} onClick={() => setCheckInOpen(true)}>
                Log a Check-In
              </ReserveButton>
            }
          />
        )}
      </GlassPanel>

      {/* ── Photo check-ins: dated entries, never analysed. ── */}
      <GlassPanel accent={RESERVE.gold} phone="flush">
        <ReserveDetailImage id="posing-room" className={DETAIL_BAND_BLEED} />
        <ReserveSectionHeader
          label={photos.checkInCount > 0 ? `Photo check-ins · ${photos.checkInCount}` : "Photo check-ins"}
          accent={RESERVE.gold}
        />
        {photos.checkInCount > 0 ? (
          <RecordList label="Photo check-ins">
            {photos.history.slice(0, 8).map((photo) => (
              <RecordRow key={photo.id}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <p className="tnum text-[14.5px] font-semibold text-[#f2eee6]">{formatDayFull(photo.date)}</p>
                  <p className="text-[12.5px] text-white/60">{poseLabels(photo.poses)}</p>
                </div>
              </RecordRow>
            ))}
          </RecordList>
        ) : (
          <RecordEmpty
            headline="No photo check-ins yet"
            body="Photos are dated records. Reserve keeps the date, the poses and the conditions you matched — it does not analyse or score them."
            action={
              <ReserveButton tier="secondary" size="md" icon={Camera} onClick={() => setActiveView("progress-photos")}>
                Add Progress Photo
              </ReserveButton>
            }
          />
        )}
      </GlassPanel>

      {/* ── Focus, comparison and the check-in sheet. ── */}
      <PhysiqueCommandV2 checkInOpen={checkInOpen} onCloseCheckIn={() => setCheckInOpen(false)} />

      {/* ── The dated timeline. ── */}
      {record.entryCount > 0 && (
        <GlassPanel accent={RESERVE.violet} phone="flush">
          <ReserveSectionHeader label={`Check-in history · ${record.entryCount}`} accent={RESERVE.violet} />
          <RecordList label="Check-in history">
            {record.history.map((entry) => {
              const siteCount = Object.keys(entry.measurements).length;
              return (
                <RecordRow key={entry.id}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <p className="tnum text-[14.5px] font-semibold text-[#f2eee6]">{formatDayFull(entry.date)}</p>
                    <p className="tnum text-[13px] text-white/60">
                      {entry.bodyWeightLb} lb · {siteCount} {siteCount === 1 ? "site" : "sites"}
                    </p>
                  </div>
                  {entry.notes && <p className="mt-1 max-w-[66ch] text-[12.5px] leading-[1.55] text-white/60">{entry.notes}</p>}
                </RecordRow>
              );
            })}
          </RecordList>
        </GlassPanel>
      )}
    </ViewShell>
  );
}
