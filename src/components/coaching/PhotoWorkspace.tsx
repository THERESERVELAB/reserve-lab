"use client";

/* Physique photo workspace — gallery, side-by-side comparison, annotation,
   and retake requests. Rendering is permission-gated upstream AND the
   repository refuses records without access, so this surface only ever
   receives photos the athlete has explicitly shared. */

import { useCallback, useMemo, useState } from "react";
import { Columns2, MessageSquarePlus, RefreshCw, ZoomIn } from "lucide-react";

import { ReserveBottomSheet } from "@/components/ui/reserve";
import { localDayOf } from "@/lib/coaching/effective-date";

import { useCoachingStore } from "@/lib/coaching/store";
import type { PhysiquePhotoRecord, PhotoPose } from "@/lib/coaching/types";
import { CommandButton, EmptyState, Field, MicroLabel, Panel, PanelHeader, StatusChip, dayLabel, inputClass } from "./ui";

const POSE_LABELS: Record<PhotoPose, string> = {
  front_relaxed: "Front relaxed",
  side_relaxed: "Side relaxed",
  back_relaxed: "Back relaxed",
  front_double_biceps: "Front double biceps",
  side_chest: "Side chest",
  back_double_biceps: "Back double biceps",
  custom: "Custom",
};

export function PhotoWorkspace({
  photos,
  canAnnotate,
  canRequestUploads,
  viewerIsCoach,
}: {
  photos: PhysiquePhotoRecord[];
  canAnnotate: boolean;
  canRequestUploads: boolean;
  viewerIsCoach: boolean;
}) {
  const run = useCoachingStore((s) => s.run);
  const actorId = useCoachingStore((s) => s.actorId);
  const [mode, setMode] = useState<"gallery" | "compare">("gallery");
  const [pose, setPose] = useState<PhotoPose>("front_relaxed");
  const [galleryPose, setGalleryPose] = useState<PhotoPose | "all">("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [leftSet, setLeftSet] = useState<string | null>(null);
  const [rightSet, setRightSet] = useState<string | null>(null);
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [noteVisibility, setNoteVisibility] = useState<"athlete_visible" | "private">("athlete_visible");
  const [zoomed, setZoomed] = useState<PhysiquePhotoRecord | null>(null);
  const closeZoom = useCallback(() => setZoomed(null), []);
  const notes = useCoachingStore((s) => s.db.notes);
  const privateNotes = useMemo(
    () => notes.filter(
      (note) => note.coachId === actorId && note.visibility === "private" &&
        photos.some((photo) => photo.athleteId === note.athleteId && photo.setId === note.linkedPhotoSetId),
    ),
    [notes, actorId, photos],
  );

  const sets = useMemo(() => {
    const bySet = new Map<string, PhysiquePhotoRecord[]>();
    for (const photo of photos) {
      bySet.set(photo.setId, [...(bySet.get(photo.setId) ?? []), photo]);
    }
    return [...bySet.entries()].sort((a, b) => b[1][0].date.localeCompare(a[1][0].date));
  }, [photos]);

  if (photos.length === 0) {
    return (
      <EmptyState
        title="No photo sets"
        body="No physique photos have been recorded yet. Sets appear here organized by date, pose, and check-in week."
      />
    );
  }

  const compareLeft = photos.find((p) => p.setId === (leftSet ?? sets[sets.length - 1]?.[0]) && p.pose === pose);
  const compareRight = photos.find((p) => p.setId === (rightSet ?? sets[0]?.[0]) && p.pose === pose);
  const availablePoses = [...new Set(photos.map((p) => p.pose))];
  const visibleSets = sets
    .filter(([setId]) => dateFilter === "all" || setId === dateFilter)
    .map(([setId, records]) => [
      setId,
      galleryPose === "all" ? records : records.filter((record) => record.pose === galleryPose),
    ] as const)
    .filter(([, records]) => records.length > 0);

  const saveNote = async (photoId: string) => {
    const photo = photos.find((record) => record.id === photoId);
    if (!photo) return;
    if (noteVisibility === "private") {
      await run((r) => r.tracking.addNote({
        coachId: actorId,
        athleteId: photo.athleteId,
        category: "photos",
        body: noteDraft,
        visibility: "private",
        linkedPhotoSetId: photo.setId,
      }, actorId));
    } else {
      await run((r) => r.tracking.annotatePhoto(photoId, actorId, noteDraft));
    }
    setNoteFor(null);
    setNoteDraft("");
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1">
          <CommandButton variant={mode === "gallery" ? "primary" : "ghost"} onClick={() => setMode("gallery")}>
            Gallery
          </CommandButton>
          <CommandButton variant={mode === "compare" ? "primary" : "ghost"} onClick={() => setMode("compare")}>
            <span className="flex items-center gap-1.5"><Columns2 size={12} /> Compare</span>
          </CommandButton>
        </div>
        {mode === "compare" && (
          <select
            value={pose}
            onChange={(e) => setPose(e.target.value as PhotoPose)}
            aria-label="Pose to compare"
            className="rounded-lg border border-white/10 bg-[#0b0c12] px-2.5 py-1.5 font-mono text-[10px] text-white/60 outline-none"
          >
            {availablePoses.map((p) => (
              <option key={p} value={p}>{POSE_LABELS[p]}</option>
            ))}
          </select>
        )}
        {mode === "gallery" && (
          <div className="flex flex-wrap gap-1.5">
            <select
              value={dateFilter}
              onChange={(event) => setDateFilter(event.target.value)}
              aria-label="Filter photo sets by date"
              className="rounded-lg border border-white/10 bg-[#0b0c12] px-2.5 py-1.5 font-mono text-[10px] text-white/60 outline-none"
            >
              <option value="all">All dates</option>
              {sets.map(([setId, records]) => (
                <option key={setId} value={setId}>{dayLabel(localDayOf(records[0].date))}</option>
              ))}
            </select>
            <select
              value={galleryPose}
              onChange={(event) => setGalleryPose(event.target.value as PhotoPose | "all")}
              aria-label="Filter photos by pose"
              className="rounded-lg border border-white/10 bg-[#0b0c12] px-2.5 py-1.5 font-mono text-[10px] text-white/60 outline-none"
            >
              <option value="all">All poses</option>
              {availablePoses.map((availablePose) => (
                <option key={availablePose} value={availablePose}>{POSE_LABELS[availablePose]}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {mode === "gallery" ? (
        <div className="flex flex-col gap-4">
          {visibleSets.map(([setId, records]) => (
            <Panel key={setId}>
              <PanelHeader
                label={records[0].checkInWeek ?? "Set"}
                title={dayLabel(localDayOf(records[0].date), { month: "long", day: "numeric" })}
                right={
                  <div className="flex items-center gap-1.5">
                    {records[0].bodyweightLb !== null && (
                      <StatusChip tone="neutral">{records[0].bodyweightLb} lb</StatusChip>
                    )}
                    <StatusChip tone={records[0].lighting === "consistent" ? "green" : "amber"}>
                      {records[0].lighting === "consistent" ? "Consistent light" : "Inconsistent light"}
                    </StatusChip>
                  </div>
                }
              />
              <div className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-3 sm:p-4">
                {records.map((photo) => (
                  <div key={photo.id} className="group flex flex-col gap-1.5">
                    <button
                      type="button"
                      onClick={() => setZoomed(photo)}
                      className="group/image relative overflow-hidden rounded-xl border border-white/[0.06] text-left"
                      aria-label={`Zoom ${POSE_LABELS[photo.pose]}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- local SVG data URIs, not remote assets */}
                      <img src={photo.src} alt={`${POSE_LABELS[photo.pose]} physique photo`} className="w-full" />
                      <span className="absolute bottom-2 right-2 rounded-md border border-white/10 bg-black/50 p-1.5 text-white/45 opacity-0 transition-opacity group-hover/image:opacity-100">
                        <ZoomIn size={12} />
                      </span>
                      {photo.retakeRequested && (
                        <div className="absolute left-2 top-2">
                          <StatusChip tone="amber">Retake requested</StatusChip>
                        </div>
                      )}
                    </button>
                    <MicroLabel>{POSE_LABELS[photo.pose]}</MicroLabel>
                    {photo.athleteNote && (
                      <p className="text-[10px] leading-4 text-white/50">Athlete: {photo.athleteNote}</p>
                    )}
                    {photo.coachVisibleNote && (
                      <p className="text-[10px] leading-4 text-[#d5b15f]/70">Coach: {photo.coachVisibleNote}</p>
                    )}
                    {viewerIsCoach && (
                      <div className="flex flex-wrap gap-x-1">
                        {canAnnotate && (
                          <button
                            type="button"
                            onClick={() => {
                              setNoteVisibility("athlete_visible");
                              setNoteFor(photo.id);
                              setNoteDraft(photo.coachVisibleNote ?? "");
                            }}
                            className="flex min-h-[40px] items-center gap-1 rounded-md px-2 font-mono text-[9px] uppercase tracking-[0.1em] text-white/60 hover:text-[#d5b15f]"
                          >
                            <MessageSquarePlus size={10} /> Note
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setNoteVisibility("private");
                            setNoteFor(photo.id);
                            setNoteDraft("");
                          }}
                          className="flex min-h-[40px] items-center gap-1 rounded-md px-2 font-mono text-[9px] uppercase tracking-[0.1em] text-white/60 hover:text-[#d5b15f]"
                        >
                          <MessageSquarePlus size={10} /> Private note
                        </button>
                        {canRequestUploads && !photo.retakeRequested && (
                          <button
                            type="button"
                            onClick={() => void run((r) => r.tracking.requestRetake(photo.id, actorId))}
                            className="flex min-h-[40px] items-center gap-1 rounded-md px-2 font-mono text-[9px] uppercase tracking-[0.1em] text-white/60 hover:text-[#e8c87a]"
                          >
                            <RefreshCw size={10} /> Retake
                          </button>
                        )}
                      </div>
                    )}
                    {noteFor === photo.id && (
                      <div className="flex flex-col gap-1.5">
                        <Field label={noteVisibility === "private" ? "Private coach note" : "Athlete-visible note"}>
                          <input
                            className={inputClass}
                            value={noteDraft}
                            onChange={(e) => setNoteDraft(e.target.value)}
                            placeholder={noteVisibility === "private" ? "Visible only in Coach Command" : "Visible to the athlete"}
                          />
                        </Field>
                        <div className="flex gap-1.5">
                          <CommandButton onClick={() => void saveNote(photo.id)}>Save</CommandButton>
                          <CommandButton variant="ghost" onClick={() => setNoteFor(null)}>Cancel</CommandButton>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {privateNotes.filter((note) => note.linkedPhotoSetId === setId).length > 0 && (
                <div className="border-t border-white/[0.05] px-4 py-3">
                  <MicroLabel className="mb-1">Private coach notes</MicroLabel>
                  {privateNotes.filter((note) => note.linkedPhotoSetId === setId).map((note) => (
                    <p key={note.id} className="text-[10px] leading-4 text-white/45">{note.body}</p>
                  ))}
                </div>
              )}
            </Panel>
          ))}
        </div>
      ) : (
        <Panel>
          <PanelHeader label="Comparison" title={POSE_LABELS[pose]} />
          <div className="grid grid-cols-2 gap-3 p-3 sm:p-4">
            {[
              { photo: compareLeft, set: leftSet ?? sets[sets.length - 1]?.[0], setter: setLeftSet, label: "Baseline" },
              { photo: compareRight, set: rightSet ?? sets[0]?.[0], setter: setRightSet, label: "Current" },
            ].map((side) => (
              <div key={side.label} className="flex flex-col gap-2">
                <select
                  value={side.set ?? ""}
                  onChange={(e) => side.setter(e.target.value)}
                  aria-label={`${side.label} photo set`}
                  className="rounded-lg border border-white/10 bg-[#0b0c12] px-2.5 py-1.5 font-mono text-[10px] text-white/60 outline-none"
                >
                  {sets.map(([setId, records]) => (
                    <option key={setId} value={setId}>
                      {records[0].checkInWeek ?? setId} · {dayLabel(localDayOf(records[0].date))}
                    </option>
                  ))}
                </select>
                {side.photo ? (
                  <div className="overflow-hidden rounded-xl">
                    {/* eslint-disable-next-line @next/next/no-img-element -- local SVG data URIs, not remote assets */}
                    <img src={side.photo.src} alt={`${side.label} comparison photo`} className="w-full" />
                  </div>
                ) : (
                  <div className="flex aspect-[3/4] items-center justify-center text-[11px] text-white/50">
                    No {POSE_LABELS[pose]} in this set
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <MicroLabel>{side.label}</MicroLabel>
                  {side.photo?.bodyweightLb != null && (
                    <span className="font-mono text-[10px] text-white/45">{side.photo.bodyweightLb} lb</span>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-white/[0.05] px-4 py-2.5">
            <p className="text-[10px] leading-4 text-white/30">
              Visual comparison only — Reserve does not estimate composition from images.
            </p>
          </div>
        </Panel>
      )}
      <ReserveBottomSheet open={zoomed !== null} onClose={closeZoom} title={zoomed ? `${POSE_LABELS[zoomed.pose]} · enlarged` : "Photo"}>
        {zoomed && (
          /* eslint-disable-next-line @next/next/no-img-element -- local synthetic placeholder */
          <img src={zoomed.src} alt={`${POSE_LABELS[zoomed.pose]} physique photo, enlarged`} className="mx-auto max-h-[70dvh] w-auto rounded-xl pb-2" />
        )}
      </ReserveBottomSheet>
    </div>
  );
}
