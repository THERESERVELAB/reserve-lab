"use client";

import { Check, Target, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";

import { GlassPanel } from "@/components/ui/GlassPanel";
import { recordBodyLog } from "@/components/ui/reserve/log-moment/recorders";
import { ReserveBottomSheet, ReserveButton, ReserveSectionHeader, ReserveSelect, ReserveSheetClose, useDirtySnapshot } from "@/components/ui/reserve";
import { useAthleteDashboardStore } from "@/lib/athlete-store";
import { RESERVE, alpha } from "@/lib/design/tokens";
import { baselineEntry, buildComparison, formatDateShort, latestEntry } from "@/lib/physique/engine";
import { dayKey, signed } from "@/lib/physique/record-summary";
import {
  MEASUREMENT_SITES,
  PHOTO_POSES,
  PHOTO_QUALITY_ITEMS,
  WEAK_POINTS,
  type MeasurementSite,
  type PhotoCheckIn,
  type PhotoPoseType,
  type PhotoQualityChecklistItem,
  type PhysiqueEntry,
  type WeakPoint,
} from "@/lib/physique/types";

import { RecordList, RecordRow } from "../records/RecordRows";

/* ════════════════════════════════════════════════════════════════════════
   PHYSIQUE COMMAND — focus, comparison, and the check-in itself.

   The statement, the reads and the one gold action now live in the screen's
   hero (PhysiqueView). What remains here is what the member does: choose a
   focus, compare two of their own check-ins, and log a new one.

   REMOVED IN THIS PASS:
     · The "Physique Momentum — IMPROVING / HOLDING / STALLING" dial. A
       one-word verdict on a body is exactly the evaluative language
       DESIGN_BIBLE §02 bars from an evidence surface.
     · The eight-tile stat grid, including "Data Quality: high" and a
       "Photos: Update Needed" verdict. Cards inside a card, and two of the
       figures were judgements rather than records.
     · The "Physique Guidance" panel: "Strong early progress signal",
       "review nutrition adherence against your goal". Generated opinion
       about the member's body and diet, from two weight readings.
     · The comparison's "Guidance" box, for the same reason. The deltas
       stayed; the commentary went.
     · The bordered history table. Table rules are forbidden (components.md
       rule 4) and the history belongs to the screen, not to this component.

   HONESTY FIX: the check-in drawer used to pre-fill adherence at 85 / 85 /
   80 / 75 and save those numbers with the entry whether or not the member
   ever touched the sliders. Four invented figures, stored as the member's
   own data and then read back as evidence. Adherence is now opt-in and
   starts empty; leave it closed and the entry simply carries none.
   ════════════════════════════════════════════════════════════════════════ */

const ADHERENCE_KEYS = ["training", "nutrition", "hydration", "recovery"] as const;
type AdherenceKey = (typeof ADHERENCE_KEYS)[number];

/* The sheet is opened by the screen's one gold action, which lives in the
   hero — so this component takes the open state rather than owning it, and
   never puts a second primary beside it. */
export function PhysiqueCommandV2({
  checkInOpen,
  onCloseCheckIn,
}: {
  checkInOpen: boolean;
  onCloseCheckIn: () => void;
}) {
  const physique = useAthleteDashboardStore((s) => s.physiqueCommand);
  const addPhysiqueEntry = useAthleteDashboardStore((s) => s.addPhysiqueEntry);
  const addPhotoCheckIn = useAthleteDashboardStore((s) => s.addPhotoCheckIn);
  const setWeakPoints = useAthleteDashboardStore((s) => s.setPhysiqueWeakPoints);

  const base = useMemo(() => baselineEntry(physique), [physique]);
  const latest = useMemo(() => latestEntry(physique), [physique]);
  const sortedEntries = useMemo(
    () => [...physique.entries].sort((a, b) => b.date.localeCompare(a.date)),
    [physique.entries],
  );

  const [compareFrom, setCompareFrom] = useState<string>("");
  const [compareTo, setCompareTo] = useState<string>("");

  const comparison = useMemo(() => {
    const from = physique.entries.find((entry) => entry.id === (compareFrom || base?.id));
    const to = physique.entries.find((entry) => entry.id === (compareTo || latest?.id));
    if (!from || !to || from.id === to.id) return null;
    return buildComparison(from, to);
  }, [compareFrom, compareTo, base, latest, physique.entries]);

  function toggleWeakPoint(weakPoint: WeakPoint) {
    if (physique.weakPoints.includes(weakPoint)) {
      setWeakPoints(physique.weakPoints.filter((w) => w !== weakPoint));
    } else if (physique.weakPoints.length < 3) {
      setWeakPoints([...physique.weakPoints, weakPoint]);
    }
  }

  return (
    <>
      {/* ── Focus. The member's own selection — never Reserve's reading of a
             photograph or a measurement (DESIGN_BIBLE §02). ── */}
      <GlassPanel accent={RESERVE.gold} phone="flush">
        <ReserveSectionHeader label="Weak point focus · up to 3" accent={RESERVE.gold} />
        <p className="max-w-[72ch] text-[12.5px] leading-[1.6] text-white/60">
          You choose what to prioritise. Reserve follows the measurement linked to each choice and shows it beside your
          check-ins — it never decides a muscle group is behind on your behalf.
        </p>
        <div className="mt-3.5 flex flex-wrap gap-2">
          {WEAK_POINTS.map((weakPoint) => {
            const active = physique.weakPoints.includes(weakPoint.id);
            const full = !active && physique.weakPoints.length >= 3;
            return (
              <button
                key={weakPoint.id}
                type="button"
                aria-pressed={active}
                disabled={full}
                title={full ? "Three focuses is the limit — remove one first" : undefined}
                onClick={() => toggleWeakPoint(weakPoint.id)}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-4 text-[13px] font-medium transition disabled:cursor-not-allowed disabled:opacity-40"
                style={{
                  background: active ? alpha(RESERVE.gold, 0.16) : "rgba(255,255,255,0.03)",
                  color: active ? RESERVE.gold : "rgba(255,255,255,0.6)",
                }}
              >
                {active && <Check size={12} aria-hidden="true" />}
                {weakPoint.label}
              </button>
            );
          })}
        </div>
        {physique.weakPoints.length === 0 && (
          <p className="mt-3 flex items-center gap-2 text-[12.5px] text-white/50">
            <Target size={13} aria-hidden="true" />
            Nothing selected yet.
          </p>
        )}
      </GlassPanel>

      {/* ── Comparison between two of the member's own check-ins. ── */}
      <GlassPanel accent={RESERVE.steel} phone="flush">
        <ReserveSectionHeader label="Compare two check-ins" accent={RESERVE.steel} />
        {sortedEntries.length >= 2 ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1.5 block font-mono text-[11px] uppercase tracking-[0.16em] text-white/55">From</span>
                <ReserveSelect
                  srLabel="Compare from"
                  value={compareFrom || base?.id || ""}
                  options={sortedEntries.map((entry) => ({
                    value: entry.id,
                    label: formatDateShort(entry.date),
                    hint: `${entry.bodyWeightLb} lb`,
                  }))}
                  onChange={setCompareFrom}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block font-mono text-[11px] uppercase tracking-[0.16em] text-white/55">To</span>
                <ReserveSelect
                  srLabel="Compare to"
                  value={compareTo || latest?.id || ""}
                  options={sortedEntries.map((entry) => ({
                    value: entry.id,
                    label: formatDateShort(entry.date),
                    hint: `${entry.bodyWeightLb} lb`,
                  }))}
                  onChange={setCompareTo}
                />
              </label>
            </div>

            {comparison ? (
              <RecordList label="Change between the two check-ins" className="mt-4">
                <RecordRow>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <p className="text-[14.5px] font-semibold text-[#f2eee6]">Body weight</p>
                    <p className="tnum text-[15px] font-semibold text-[#f2eee6]">
                      {signed(comparison.weightDeltaLb, "lb")}
                    </p>
                  </div>
                  <p className="tnum mt-1 font-mono text-[11px] uppercase tracking-[0.12em] text-white/45">
                    {formatDateShort(comparison.fromDate)} → {formatDateShort(comparison.toDate)}
                  </p>
                </RecordRow>
                {comparison.measurementDeltas.map((delta) => (
                  <RecordRow key={delta.label}>
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <p className="text-[14.5px] font-semibold text-[#f2eee6]">
                        {MEASUREMENT_SITES.find((site) => site.id === delta.label)?.label ?? delta.label}
                      </p>
                      <p className="tnum text-[15px] font-semibold text-[#f2eee6]">{signed(delta.delta, "in")}</p>
                    </div>
                  </RecordRow>
                ))}
              </RecordList>
            ) : (
              <p className="mt-4 text-[12.5px] leading-[1.55] text-white/55">
                Pick two different check-ins to see the distance between them.
              </p>
            )}
            <p className="mt-3.5 flex items-center gap-2 text-[12px] leading-[1.6] text-white/45">
              <TrendingUp size={13} aria-hidden="true" />
              The distance between two entries you made. What it means is yours and your coach&apos;s to read.
            </p>
          </>
        ) : (
          <p className="max-w-[66ch] text-[12.5px] leading-[1.6] text-white/55">
            Two dated check-ins are needed before anything can be compared. Reserve will not fill the gap with an
            estimate.
          </p>
        )}
      </GlassPanel>

      <CheckInSheet
        open={checkInOpen}
        onClose={onCloseCheckIn}
        weakPoints={physique.weakPoints}
        onSave={(entry, photo) => {
          recordBodyLog(() => {
            addPhysiqueEntry(entry);
            if (photo) addPhotoCheckIn(photo);
          });
          onCloseCheckIn();
        }}
      />
    </>
  );
}

/* ─── The check-in ────────────────────────────────────────────────────────
   Bodyweight, the sites the member measures, the poses they captured, and —
   only if they open it — adherence. */

type DraftEntry = Omit<PhysiqueEntry, "id">;
type DraftPhoto = Omit<PhotoCheckIn, "id">;

const FIELD =
  "w-full rounded-lg border border-white/[0.12] bg-white/[0.03] px-3 py-2.5 text-[16px] font-semibold text-[#f2eee6] outline-none placeholder:text-white/25 focus:border-[#d5b15f]/60 sm:text-[13px]";

function CheckInSheet({
  open,
  onClose,
  onSave,
  weakPoints,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (entry: DraftEntry, photo: DraftPhoto | null) => void;
  weakPoints: WeakPoint[];
}) {
  const [weight, setWeight] = useState("");
  const [measurements, setMeasurements] = useState<Partial<Record<MeasurementSite, string>>>({});
  const [poses, setPoses] = useState<PhotoPoseType[]>([]);
  const [quality, setQuality] = useState<PhotoQualityChecklistItem[]>([]);
  const [notes, setNotes] = useState("");
  /* Null until the member opens it. An untouched slider must never be saved
     as a figure they reported. */
  const [adherence, setAdherence] = useState<Record<AdherenceKey, number> | null>(null);
  /* The draft outlives the sheet (it is kept when the sheet closes), so dirty
     is measured against the blank check-in, and Discard clears it. */
  const dirty = useDirtySnapshot({
    weight,
    measurements: Object.fromEntries(Object.entries(measurements).filter(([, v]) => v !== "")),
    poses,
    quality,
    notes,
    adherence,
  });

  function clear() {
    setWeight("");
    setMeasurements({});
    setPoses([]);
    setQuality([]);
    setNotes("");
    setAdherence(null);
  }

  const weightNumber = Number(weight);
  const canSave = weight.trim().length > 0 && Number.isFinite(weightNumber) && weightNumber > 0;

  function save() {
    if (!canSave) return;
    const sites: Partial<Record<MeasurementSite, number>> = {};
    for (const site of MEASUREMENT_SITES) {
      const raw = measurements[site.id];
      const value = raw != null && raw !== "" ? Number(raw) : NaN;
      if (Number.isFinite(value) && value > 0) sites[site.id] = value;
    }
    const date = dayKey(new Date());
    const entry: DraftEntry = {
      date,
      bodyWeightLb: weightNumber,
      measurements: sites,
      notes: notes.trim() || undefined,
      ...(adherence ? { adherence: { ...adherence, sleep: adherence.recovery } } : {}),
    };
    const photo: DraftPhoto | null = poses.length
      ? {
          date,
          poses,
          bodyWeightLb: weightNumber,
          consistencyScore: Math.round((quality.length / PHOTO_QUALITY_ITEMS.length) * 100),
          notes: notes.trim() || undefined,
        }
      : null;
    onSave(entry, photo);
    clear();
  }

  return (
    <ReserveBottomSheet
      open={open}
      onClose={onClose}
      title="Physique check-in"
      accent={RESERVE.gold}
      dirty={dirty}
      onDiscard={() => {
        clear();
        onClose();
      }}
      footer={
        <div className="flex items-center justify-between gap-3">
          <ReserveSheetClose fallback={onClose}>
            {(requestClose) => (
              <ReserveButton tier="quiet" size="md" onClick={requestClose}>
                Cancel
              </ReserveButton>
            )}
          </ReserveSheetClose>
          {canSave ? (
            <ReserveButton tier="primary" size="md" icon={Check} onClick={save}>
              Save Check-In
            </ReserveButton>
          ) : (
            <ReserveButton tier="primary" size="md" icon={Check} disabled disabledReason="Enter your body weight to save this check-in">
              Save Check-In
            </ReserveButton>
          )}
        </div>
      }
    >
      <label className="block">
        <span className="mb-1.5 block font-mono text-[11px] uppercase tracking-[0.16em] text-white/55">
          Body weight (lb)
        </span>
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="0.1"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          placeholder="e.g. 184"
          className={FIELD}
        />
      </label>

      <p className="mb-2 mt-4 font-mono text-[11px] uppercase tracking-[0.16em] text-white/55">
        Measurements · inches — leave blank to skip
      </p>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {MEASUREMENT_SITES.map((site) => (
          <label key={site.id} className="block">
            <span className="mb-1 block font-mono text-[11px] uppercase tracking-[0.12em] text-white/50">
              {site.label}
            </span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.1"
              value={measurements[site.id] ?? ""}
              onChange={(e) => setMeasurements((prev) => ({ ...prev, [site.id]: e.target.value }))}
              placeholder="—"
              className={FIELD}
            />
          </label>
        ))}
      </div>

      <p className="mb-2 mt-4 font-mono text-[11px] uppercase tracking-[0.16em] text-white/55">Poses you captured</p>
      <p className="mb-2 text-[12.5px] leading-[1.5] text-white/50">
        Reserve stores the pose labels, not the images.
      </p>
      <div className="flex flex-wrap gap-2">
        {PHOTO_POSES.map((pose) => {
          const active = poses.includes(pose.id);
          return (
            <button
              key={pose.id}
              type="button"
              aria-pressed={active}
              onClick={() => setPoses((prev) => (active ? prev.filter((p) => p !== pose.id) : [...prev, pose.id]))}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium transition"
              style={{
                background: active ? alpha(RESERVE.steel, 0.16) : "rgba(255,255,255,0.03)",
                color: active ? RESERVE.steel : "rgba(255,255,255,0.6)",
              }}
            >
              {active && <Check size={12} aria-hidden="true" />}
              {pose.label}
            </button>
          );
        })}
      </div>

      {poses.length > 0 && (
        <>
          <p className="mb-2 mt-4 font-mono text-[11px] uppercase tracking-[0.16em] text-white/55">
            Conditions you matched
          </p>
          <div className="flex flex-wrap gap-2">
            {PHOTO_QUALITY_ITEMS.map((item) => {
              const active = quality.includes(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setQuality((prev) => (active ? prev.filter((q) => q !== item.id) : [...prev, item.id]))}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium transition"
                  style={{
                    background: active ? alpha(RESERVE.green, 0.12) : "rgba(255,255,255,0.03)",
                    color: active ? RESERVE.green : "rgba(255,255,255,0.6)",
                  }}
                >
                  {active && <Check size={12} aria-hidden="true" />}
                  {item.label}
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Adherence is opt-in. Closed, the entry carries none — rather than
          four numbers the member never gave. */}
      <div className="mt-5">
        {adherence === null ? (
          <ReserveButton
            tier="quiet"
            size="sm"
            onClick={() => setAdherence({ training: 50, nutrition: 50, hydration: 50, recovery: 50 })}
          >
            Add how the week went (optional)
          </ReserveButton>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3">
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/55">How the week went</p>
              <ReserveButton tier="quiet" size="sm" onClick={() => setAdherence(null)}>
                Skip this
              </ReserveButton>
            </div>
            <div className="mt-2 flex flex-col gap-3">
              {ADHERENCE_KEYS.map((key) => (
                <label key={key} className="block">
                  <span className="flex items-center justify-between">
                    <span className="text-[13px] capitalize text-white/70">{key}</span>
                    <span className="tnum font-mono text-[12px] font-semibold" style={{ color: RESERVE.gold }}>
                      {adherence[key]}%
                    </span>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={adherence[key]}
                    onChange={(e) => setAdherence((prev) => (prev ? { ...prev, [key]: Number(e.target.value) } : prev))}
                    className="mt-1.5 w-full accent-[#d5b15f]"
                  />
                </label>
              ))}
            </div>
            <p className="mt-2 text-[12px] leading-[1.5] text-white/45">
              Your own estimate of the week. Reserve records it exactly as you set it.
            </p>
          </>
        )}
      </div>

      <label className="mt-4 block">
        <span className="mb-1.5 block font-mono text-[11px] uppercase tracking-[0.16em] text-white/55">
          Notes (optional)
        </span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Energy, fullness, how the sessions felt…"
          className={`${FIELD} resize-y font-normal`}
        />
      </label>

      {weakPoints.length > 0 && (
        <p className="mt-3 text-[12.5px] leading-[1.55] text-white/50">
          Current focus: {weakPoints.map((w) => WEAK_POINTS.find((x) => x.id === w)?.label).join(" · ")}
        </p>
      )}
    </ReserveBottomSheet>
  );
}
