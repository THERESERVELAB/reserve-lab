"use client";

import { Camera, Check, Trash2, Upload, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useClientNow } from "@/components/safety/useClientNow";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { recordBodyLog } from "@/components/ui/reserve/log-moment/recorders";
import {
  ReserveBottomSheet,
  ReserveButton,
  ReserveIconButton,
  ReserveSaveStatus,
  ReserveSectionHeader,
  ReserveSheetClose,
  useDirtySnapshot,
} from "@/components/ui/reserve";
import { useAthleteDashboardStore } from "@/lib/athlete-store";
import { RESERVE, alpha } from "@/lib/design/tokens";
import { agoLabel, conditionsMatched, dayKey, formatDay, formatDayFull, photoRecord } from "@/lib/physique/record-summary";
import { PHOTO_POSES, type PhotoPoseType } from "@/lib/physique/types";

import { RecordEmpty, RecordList, RecordRow } from "./records/RecordRows";
import { RecordHero } from "./records/RecordHero";
import { ViewShell } from "./ViewShell";

/* ════════════════════════════════════════════════════════════════════════
   PROGRESS PHOTOS — a studio, not a judgement (DESIGN_BIBLE §02).

   The member walks in self-conscious and leaves with evidence captured.
   Reserve therefore records WHEN a set was taken, WHICH poses it holds and
   WHICH conditions the member matched — and nothing about the body in the
   frame. No analysis, no scoring, no body-fat estimate.

   Two changes worth naming:
     · The stored "Consistency 71%" chip read as a grade on the photograph.
       It is the member's own three-item checklist, so it now prints as the
       count it came from: "2 of 3 conditions matched".
     · The check-in builder moved into the shared bottom sheet, so the page
       keeps one gold action and the save sits within thumb reach.
   ════════════════════════════════════════════════════════════════════════ */

type SelectedPhoto = { id: string; url: string; name: string; sizeKb: number };

const CONSISTENCY_FLAGS = [
  { id: "lighting", label: "Same lighting" },
  { id: "distance", label: "Same distance" },
  { id: "time", label: "Same time of day" },
] as const;

const FIELD =
  "w-full rounded-lg border border-white/[0.12] bg-white/[0.03] px-3 py-2.5 text-[16px] font-semibold text-[#f2eee6] outline-none placeholder:text-white/25 focus:border-[#d5b15f]/60 sm:text-[13px]";

function poseLabel(pose: string): string {
  return PHOTO_POSES.find((p) => p.id === pose)?.label ?? pose;
}

export function ProgressPhotosView() {
  const photoCheckIns = useAthleteDashboardStore((s) => s.physiqueCommand.photoCheckIns);
  const addPhotoCheckIn = useAthleteDashboardStore((s) => s.addPhotoCheckIn);
  const deletePhotoCheckIn = useAthleteDashboardStore((s) => s.deletePhotoCheckIn);
  const setActiveView = useAthleteDashboardStore((s) => s.setActiveView);

  const now = useClientNow();
  const record = useMemo(() => photoRecord({ photoCheckIns }), [photoCheckIns]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<SelectedPhoto[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [date, setDate] = useState(() => dayKey(new Date()));
  const [poses, setPoses] = useState<PhotoPoseType[]>(["front-relaxed"]);
  const [weight, setWeight] = useState("");
  const [notes, setNotes] = useState("");
  const [flags, setFlags] = useState<string[]>([]);
  const [saveState, setSaveState] = useState<"idle" | "saved">("idle");
  /** Session-only previews attached to a saved check-in. Binaries never persist. */
  const [sessionGallery, setSessionGallery] = useState<Record<string, SelectedPhoto[]>>({});

  // Object URLs are revoked on unmount — previews are session-only by design.
  useEffect(() => {
    return () => {
      Object.values(sessionGallery)
        .flat()
        .concat(selected)
        .forEach((photo) => URL.revokeObjectURL(photo.url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const closeSheet = useCallback(() => setSheetOpen(false), []);
  /* The draft outlives the sheet (closing keeps the chosen photos), so dirty
     is measured against an empty check-in — chosen photos count — and
     Discard clears it. */
  const sheetDirty = useDirtySnapshot({ selected: selected.map((photo) => photo.id), weight, notes, flags });

  function discardDraft() {
    selected.forEach((photo) => URL.revokeObjectURL(photo.url));
    setSelected([]);
    setWeight("");
    setNotes("");
    setFlags([]);
    setSheetOpen(false);
  }

  function onFilesSelected(files: FileList | null) {
    if (!files?.length) return;
    const next: SelectedPhoto[] = Array.from(files)
      .filter((file) => file.type.startsWith("image/"))
      .map((file) => ({
        id: `ph-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        url: URL.createObjectURL(file),
        name: file.name,
        sizeKb: Math.max(1, Math.round(file.size / 1024)),
      }));
    if (next.length === 0) return;
    setSelected((prev) => [...prev, ...next]);
    setDate((current) => current || dayKey(new Date()));
    setSheetOpen(true);
  }

  function removeSelected(id: string) {
    setSelected((prev) => {
      const hit = prev.find((photo) => photo.id === id);
      if (hit) URL.revokeObjectURL(hit.url);
      return prev.filter((photo) => photo.id !== id);
    });
  }

  function togglePose(pose: PhotoPoseType) {
    setPoses((prev) => (prev.includes(pose) ? prev.filter((p) => p !== pose) : [...prev, pose]));
  }

  function saveCheckIn() {
    if (!selected.length) return;
    recordBodyLog(() => addPhotoCheckIn({
      date,
      poses: poses.length ? poses : ["custom"],
      bodyWeightLb: Number.isFinite(parseFloat(weight)) && parseFloat(weight) > 0 ? parseFloat(weight) : undefined,
      notes: notes.trim() || undefined,
      consistencyScore: Math.round((flags.length / CONSISTENCY_FLAGS.length) * 100),
    }));
    setSessionGallery((prev) => ({ ...prev, [date]: [...(prev[date] ?? []), ...selected] }));
    setSelected([]);
    setWeight("");
    setNotes("");
    setFlags([]);
    setSheetOpen(false);
    setSaveState("saved");
    setTimeout(() => setSaveState("idle"), 2400);
  }

  const since = record.newest ? agoLabel(record.newest.date, now) : null;

  return (
    <ViewShell
      label="Photos"
      title="Progress Photos"
      icon={Camera}
      accentColor={RESERVE.gold}
      roomHero
      command="Dated sets you captured, kept private on this device."
      disclaimer="Photos stay on your device — previews last for this session only, and Reserve saves the date, poses, conditions and notes you entered. Reserve does not analyse, score, or estimate body composition from a photograph."
    >
      {/* The real file input. Hidden, but it is what every control here opens. */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          onFilesSelected(e.target.files);
          e.target.value = "";
        }}
      />

      <RecordHero
        testId="progress-photos"
        accent={RESERVE.gold}
        eyebrow={`Studio · ${record.checkInCount} ${record.checkInCount === 1 ? "check-in" : "check-ins"}`}
        statement={record.statement}
        support={
          record.newest
            ? `Same lighting, same distance, same time of day — that is what makes two sets comparable.${since ? ` Last set was ${since}.` : ""}`
            : "Your first set becomes the baseline every later set is placed beside. Front, side and back is the usual trio."
        }
        reads={[
          {
            label: "Check-ins",
            value: record.checkInCount > 0 ? String(record.checkInCount) : null,
            detail: record.spanDays !== null ? `over ${record.spanDays} days` : undefined,
            empty: "Evidence needed · no sets yet",
          },
          {
            label: "Last set",
            value: record.newest ? formatDay(record.newest.date) : null,
            detail: record.newest ? `${record.newest.poses.length} ${record.newest.poses.length === 1 ? "pose" : "poses"}` : undefined,
            empty: "Evidence needed",
          },
        ]}
        action={{ label: "Add Progress Photo", icon: Upload, onClick: () => fileInputRef.current?.click() }}
        tertiary={
          record.checkInCount >= 2
            ? { label: "Open Physique Command", onClick: () => setActiveView("physique") }
            : undefined
        }
      />

      <ReserveSaveStatus state={saveState} className="-mt-2" />

      <GlassPanel accent={RESERVE.gold} phone="flush">
        <ReserveSectionHeader
          label={record.checkInCount > 0 ? `Check-in history · ${record.checkInCount}` : "Check-in history"}
          accent={RESERVE.gold}
        />
        {record.checkInCount > 0 ? (
          <RecordList label="Photo check-in history">
            {record.history.map((checkIn) => {
              const previews = sessionGallery[checkIn.date] ?? [];
              const conditions = conditionsMatched(checkIn.consistencyScore, CONSISTENCY_FLAGS.length);
              return (
                <RecordRow key={checkIn.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="tnum text-[14.5px] font-semibold text-[#f2eee6]">
                        {formatDayFull(checkIn.date)}
                        {checkIn.bodyWeightLb != null && (
                          <span className="ml-2.5 text-[12.5px] font-medium text-white/55">{checkIn.bodyWeightLb} lb</span>
                        )}
                      </p>
                      <p className="mt-0.5 text-[12px] leading-snug text-white/55">
                        {checkIn.poses.map(poseLabel).join(" · ")}
                      </p>
                      <p className="tnum mt-0.5 font-mono text-[11px] uppercase tracking-[0.12em] text-white/45">
                        {conditions.matched} of {conditions.total} conditions matched
                      </p>
                      {checkIn.notes && <p className="mt-1.5 max-w-[66ch] text-[12.5px] leading-[1.55] text-white/60">{checkIn.notes}</p>}
                    </div>
                    <ReserveIconButton
                      icon={Trash2}
                      label={`Delete the ${checkIn.date} check-in`}
                      accent={RESERVE.red}
                      size={13}
                      onClick={() => deletePhotoCheckIn(checkIn.id)}
                    />
                  </div>
                  {previews.length > 0 && (
                    <ul className="mt-2.5 flex gap-2 overflow-x-auto pb-1">
                      {previews.map((photo) => (
                        <li key={photo.id} className="h-24 w-[72px] shrink-0 overflow-hidden rounded-lg">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={photo.url} alt={`${checkIn.date} check-in`} className="h-full w-full object-cover" />
                        </li>
                      ))}
                    </ul>
                  )}
                </RecordRow>
              );
            })}
          </RecordList>
        ) : (
          /* No second "Add Progress Photo" here: the hero's gold action is the way in,
             and how photos are handled is said once, in the panel below. */
          <RecordEmpty
            headline="No check-ins yet"
            body="Each set you save is listed here by date, with its poses and the conditions you matched."
          />
        )}
      </GlassPanel>

      <GlassPanel accent={RESERVE.slate} phone="flush">
        <ReserveSectionHeader label="How your photos are handled" accent={RESERVE.slate} />
        {/* Plain text in the panel, not a tinted box inside it. */}
        <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/45">Private by default</p>
        <p className="mt-1 text-[12px] leading-[1.5] text-white/60">
          Previews live for this browsing session only — nothing is uploaded and no image is stored. What is saved is the
          check-in itself: its date, the poses you marked, the conditions you matched, your weight if you entered it, and
          your note.
        </p>
      </GlassPanel>

      {/* ── The check-in builder, opened by choosing photos. ── */}
      <ReserveBottomSheet
        open={sheetOpen}
        onClose={closeSheet}
        title="Save photo check-in"
        accent={RESERVE.gold}
        dirty={sheetDirty}
        onDiscard={discardDraft}
        footer={
          <div className="flex items-center justify-between gap-3">
            <ReserveSheetClose fallback={closeSheet}>
              {(requestClose) => (
                <ReserveButton tier="quiet" size="md" onClick={requestClose}>
                  Cancel
                </ReserveButton>
              )}
            </ReserveSheetClose>
            {selected.length > 0 ? (
              <ReserveButton tier="primary" size="md" icon={Camera} onClick={saveCheckIn}>
                Save Check-In
              </ReserveButton>
            ) : (
              <ReserveButton tier="primary" size="md" icon={Camera} disabled disabledReason="Choose at least one photo to save this check-in">
                Save Check-In
              </ReserveButton>
            )}
          </div>
        }
      >
        {selected.length > 0 ? (
          <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {selected.map((photo) => (
              <li key={photo.id} className="relative aspect-[3/4] overflow-hidden rounded-xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.url} alt={photo.name} className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeSelected(photo.id)}
                  aria-label={`Remove ${photo.name}`}
                  className="absolute right-1 top-1 grid h-11 w-11 place-items-center rounded-lg bg-black/55 text-white/75 transition hover:text-white"
                >
                  <X size={14} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[12.5px] leading-[1.55] text-white/60">
            No photos chosen. Close this and use Add Progress Photo to pick a set.
          </p>
        )}

        <ReserveButton
          tier="quiet"
          size="sm"
          icon={Upload}
          className="mt-2.5"
          onClick={() => fileInputRef.current?.click()}
        >
          Add more photos
        </ReserveButton>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block font-mono text-[11px] uppercase tracking-[0.16em] text-white/55">Date</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={FIELD} />
          </label>
          <label className="block">
            <span className="mb-1.5 block font-mono text-[11px] uppercase tracking-[0.16em] text-white/55">
              Body weight (lb · optional)
            </span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.1"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="e.g. 185.2"
              className={FIELD}
            />
          </label>
        </div>

        <p className="mb-2 mt-4 font-mono text-[11px] uppercase tracking-[0.16em] text-white/55">Poses in this set</p>
        <div className="flex flex-wrap gap-2">
          {PHOTO_POSES.map((pose) => {
            const active = poses.includes(pose.id);
            return (
              <button
                key={pose.id}
                type="button"
                onClick={() => togglePose(pose.id)}
                aria-pressed={active}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium transition"
                style={{
                  background: active ? alpha(RESERVE.gold, 0.14) : "rgba(255,255,255,0.03)",
                  color: active ? RESERVE.gold : "rgba(255,255,255,0.6)",
                }}
              >
                {active && <Check size={12} aria-hidden="true" />}
                {pose.label}
              </button>
            );
          })}
        </div>

        <p className="mb-2 mt-4 font-mono text-[11px] uppercase tracking-[0.16em] text-white/55">
          Conditions you matched
        </p>
        <div className="flex flex-wrap gap-2">
          {CONSISTENCY_FLAGS.map((flag) => {
            const active = flags.includes(flag.id);
            return (
              <button
                key={flag.id}
                type="button"
                aria-pressed={active}
                onClick={() => setFlags((prev) => (active ? prev.filter((f) => f !== flag.id) : [...prev, flag.id]))}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium transition"
                style={{
                  background: active ? alpha(RESERVE.green, 0.12) : "rgba(255,255,255,0.03)",
                  color: active ? RESERVE.green : "rgba(255,255,255,0.6)",
                }}
              >
                {active && <Check size={12} aria-hidden="true" />}
                {flag.label}
              </button>
            );
          })}
        </div>

        <label className="mt-4 block">
          <span className="mb-1.5 block font-mono text-[11px] uppercase tracking-[0.16em] text-white/55">
            Notes (optional)
          </span>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={140}
            placeholder="Conditions, timing, anything worth remembering"
            className={FIELD}
          />
        </label>

        <p className="mt-3 text-[12.5px] leading-[1.55] text-white/50">
          The images are not saved. Reserve keeps this check-in&apos;s date, poses, conditions, weight and note — your
          note also appears in your Journal.
        </p>
      </ReserveBottomSheet>
    </ViewShell>
  );
}
