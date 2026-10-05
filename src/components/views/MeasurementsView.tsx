"use client";

import { Pencil, Plus, Ruler, Trash2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { useClientNow } from "@/components/safety/useClientNow";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { recordBodyLog } from "@/components/ui/reserve/log-moment/recorders";
import {
  DETAIL_BAND_BLEED,
  ReserveBottomSheet,
  ReserveButton,
  ReserveDetailImage,
  ReserveIconButton,
  ReserveSaveStatus,
  ReserveSectionHeader,
  ReserveSheetClose,
  useDirtySnapshot,
} from "@/components/ui/reserve";
import { useAthleteDashboardStore } from "@/lib/athlete-store";
import { RESERVE } from "@/lib/design/tokens";
import { agoLabel, dayKey, formatDay, formatDayFull, measurementRecord, signed } from "@/lib/physique/record-summary";
import { MEASUREMENT_SITES, type MeasurementSite } from "@/lib/physique/types";

import { RecordEmpty, RecordList, RecordRow } from "./records/RecordRows";
import { RecordHero } from "./records/RecordHero";
import { ViewShell } from "./ViewShell";

/* ════════════════════════════════════════════════════════════════════════
   MEASUREMENTS — the member's own dated check-ins.

   Bible §02 calls this the instrument room: routine going in, trend
   confidence coming out. So the screen shows the newest check-in first,
   then the change against the last check-in that measured the same site,
   then every entry by date. Nothing is estimated and nothing is scored.

   The de-boxing: the latest reading used to be a grid of nine bordered
   tiles, and the history a stack of bordered rows, all inside bordered
   panels — cards inside cards at every width. Both are hairline rows now.
   The logger moved into the shared bottom sheet, which is also what keeps
   one gold action on the screen: the save lives in the sheet's footer.
   ════════════════════════════════════════════════════════════════════════ */

const FIELD =
  "w-full rounded-lg border border-white/[0.12] bg-white/[0.03] px-3 py-2.5 text-[16px] font-semibold text-[#f2eee6] outline-none placeholder:text-white/25 focus:border-[#5fb7d5]/60 sm:text-[13px]";

type DraftMeasurements = Partial<Record<MeasurementSite, string>>;

export function MeasurementsView() {
  const entries = useAthleteDashboardStore((s) => s.physiqueCommand.entries);
  const addPhysiqueEntry = useAthleteDashboardStore((s) => s.addPhysiqueEntry);
  const editPhysiqueEntry = useAthleteDashboardStore((s) => s.editPhysiqueEntry);
  const deletePhysiqueEntry = useAthleteDashboardStore((s) => s.deletePhysiqueEntry);

  /* Null until mount, so "4 days ago" never differs between the server frame
     and the client's — a relative date is the classic hydration mismatch. */
  const now = useClientNow();
  const record = useMemo(() => measurementRecord({ entries }), [entries]);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [date, setDate] = useState("");
  const [weight, setWeight] = useState("");
  const [draft, setDraft] = useState<DraftMeasurements>({});
  const [notes, setNotes] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saved">("idle");
  const sheetDirty = useDirtySnapshot(
    { date, weight, notes, draft: Object.fromEntries(Object.entries(draft).filter(([, v]) => v !== "")) },
    sheetOpen,
  );

  const closeSheet = useCallback(() => {
    setSheetOpen(false);
    setEditingId(null);
  }, []);

  function openBlank() {
    setEditingId(null);
    setDate(dayKey(new Date()));
    setWeight("");
    setDraft({});
    setNotes("");
    setSheetOpen(true);
  }

  function openEdit(id: string) {
    const entry = entries.find((e) => e.id === id);
    if (!entry) return;
    setEditingId(id);
    setDate(entry.date);
    setWeight(String(entry.bodyWeightLb ?? ""));
    setDraft(Object.fromEntries(Object.entries(entry.measurements).map(([k, v]) => [k, String(v)])) as DraftMeasurements);
    setNotes(entry.notes ?? "");
    setSheetOpen(true);
  }

  const weightNumber = parseFloat(weight);
  const canSave = Number.isFinite(weightNumber) && weightNumber > 0;

  function save() {
    if (!canSave) return;
    const measurements: Partial<Record<MeasurementSite, number>> = {};
    for (const site of MEASUREMENT_SITES) {
      const raw = draft[site.id];
      const value = raw != null && raw !== "" ? parseFloat(raw) : NaN;
      if (Number.isFinite(value) && value > 0) measurements[site.id] = value;
    }
    const payload = { date, bodyWeightLb: weightNumber, measurements, notes: notes.trim() || undefined };
    if (editingId) editPhysiqueEntry(editingId, payload);
    else recordBodyLog(() => addPhysiqueEntry(payload));
    closeSheet();
    setSaveState("saved");
    setTimeout(() => setSaveState("idle"), 2400);
  }

  const since = record.newest ? agoLabel(record.newest.date, now) : null;

  return (
    <ViewShell
      label="Measurements"
      title="Measurements"
      icon={Ruler}
      accentColor={RESERVE.steel}
      roomHero
      command="Your dated check-ins, and what changed between them."
      disclaimer="Measurements are your own entries, stored on your device. Reserve shows the change between dated check-ins. It does not estimate body composition, score your physique, or make medical claims."
    >
      <RecordHero
        testId="measurements"
        accent={RESERVE.steel}
        eyebrow={`Instrument room · ${record.entryCount} ${record.entryCount === 1 ? "check-in" : "check-ins"}`}
        statement={record.statement}
        support={
          record.newest
            ? `Measure under the same conditions each time — the trend is only as honest as the method.${since ? ` Last check-in was ${since}.` : ""}`
            : "Your first entry becomes the baseline every later check-in is measured against."
        }
        reads={[
          {
            label: "Body weight",
            value: record.newest ? String(record.newest.bodyWeightLb) : null,
            unit: "lb",
            detail:
              record.weightDeltaLb !== null && record.previous
                ? `${signed(record.weightDeltaLb, "lb")} since ${formatDay(record.previous.date)}`
                : record.newest
                  ? "first check-in · nothing to compare yet"
                  : undefined,
            empty: "Evidence needed · log a check-in",
          },
          {
            label: "Sites measured",
            value: record.sites.length > 0 ? String(record.sites.length) : null,
            detail: record.newest ? `on ${formatDay(record.newest.date)}` : undefined,
            empty: "Evidence needed",
          },
          {
            label: "Span",
            value: record.spanDays !== null ? String(record.spanDays) : null,
            unit: "days",
            detail: record.oldest ? `since ${formatDay(record.oldest.date)}` : undefined,
            empty: "Evidence needed · two check-ins",
          },
        ]}
        action={{ label: "Log Measurements", icon: Plus, onClick: openBlank }}
        secondary={
          record.newest
            ? { label: "Edit Latest", icon: Pencil, onClick: () => openEdit(record.newest!.id) }
            : undefined
        }
      />

      <ReserveSaveStatus state={saveState} className="-mt-2" />

      {/* ── The newest check-in, site by site ── */}
      <GlassPanel accent={RESERVE.steel} phone="flush">
        <ReserveDetailImage id="measurements-suite" className={DETAIL_BAND_BLEED} />
        <ReserveSectionHeader
          label={record.newest ? `Latest check-in · ${formatDayFull(record.newest.date)}` : "Latest check-in"}
          accent={RESERVE.steel}
        />
        {record.newest ? (
          <>
            <RecordList label="Sites on the latest check-in">
              <RecordRow>
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <p className="text-[14.5px] font-semibold text-[#f2eee6]">Body weight</p>
                  <p className="tnum text-[15px] font-semibold text-[#f2eee6]">
                    {record.newest.bodyWeightLb} <span className="text-[12px] font-medium text-white/50">lb</span>
                    {record.weightDeltaLb !== null && (
                      <span className="ml-2.5 font-mono text-[11px] uppercase tracking-[0.12em] text-white/55">
                        {signed(record.weightDeltaLb, "lb")}
                      </span>
                    )}
                  </p>
                </div>
              </RecordRow>
              {record.sites.map((site) => (
                <RecordRow key={site.site}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <p className="text-[14.5px] font-semibold text-[#f2eee6]">{site.label}</p>
                    <p className="tnum text-[15px] font-semibold text-[#f2eee6]">
                      {site.latestIn} <span className="text-[12px] font-medium text-white/50">in</span>
                      {site.deltaIn !== null ? (
                        <span className="ml-2.5 font-mono text-[11px] uppercase tracking-[0.12em] text-white/55">
                          {signed(site.deltaIn, "in")} since {site.previousDate ? formatDay(site.previousDate) : ""}
                        </span>
                      ) : (
                        <span className="ml-2.5 font-mono text-[11px] uppercase tracking-[0.12em] text-white/40">
                          first reading
                        </span>
                      )}
                    </p>
                  </div>
                </RecordRow>
              ))}
            </RecordList>
            {record.newest.notes && (
              <p className="mt-4 max-w-[70ch] text-[12.5px] leading-[1.6] text-white/60">{record.newest.notes}</p>
            )}
            <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.12em] text-white/35">
              From your logged check-ins · nothing estimated
            </p>
          </>
        ) : (
          <RecordEmpty
            headline="No measurements yet"
            body="Log weight and any sites you want to follow. A change appears once the same site is measured on two dated check-ins — never before."
            action={
              <ReserveButton tier="secondary" size="md" accent={RESERVE.steel} icon={Plus} onClick={openBlank}>
                Log Measurements
              </ReserveButton>
            }
          />
        )}
      </GlassPanel>

      {/* ── Every entry, by date ── */}
      {record.entryCount > 0 && (
        <GlassPanel accent={RESERVE.violet} phone="flush">
          <ReserveSectionHeader label={`Check-in history · ${record.entryCount}`} accent={RESERVE.violet} />
          <RecordList label="Measurement history">
            {record.history.map((entry) => {
              const siteCount = Object.keys(entry.measurements).length;
              return (
                <RecordRow key={entry.id}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="tnum text-[14.5px] font-semibold text-[#f2eee6]">
                        {formatDayFull(entry.date)}
                        <span className="ml-2.5 text-[12.5px] font-medium text-white/55">{entry.bodyWeightLb} lb</span>
                      </p>
                      <p className="mt-0.5 text-[12px] leading-snug text-white/50">
                        {siteCount > 0 ? `${siteCount} ${siteCount === 1 ? "site" : "sites"} measured` : "Weight only"}
                        {entry.notes ? ` · ${entry.notes}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <ReserveIconButton
                        icon={Pencil}
                        label={`Edit the ${entry.date} check-in`}
                        accent={RESERVE.slate}
                        size={13}
                        onClick={() => openEdit(entry.id)}
                      />
                      <ReserveIconButton
                        icon={Trash2}
                        label={`Delete the ${entry.date} check-in`}
                        accent={RESERVE.red}
                        size={13}
                        onClick={() => deletePhysiqueEntry(entry.id)}
                      />
                    </div>
                  </div>
                </RecordRow>
              );
            })}
          </RecordList>
        </GlassPanel>
      )}

      {/* ── The logger. In a sheet so the page keeps one gold action and the
             save sits in thumb reach on a phone. ── */}
      <ReserveBottomSheet
        open={sheetOpen}
        onClose={closeSheet}
        title={editingId ? "Edit check-in" : "Log measurements"}
        accent={RESERVE.steel}
        dirty={sheetDirty}
        footer={
          <div className="flex items-center justify-between gap-3">
            <ReserveSheetClose fallback={closeSheet}>
              {(requestClose) => (
                <ReserveButton tier="quiet" size="md" onClick={requestClose}>
                  Cancel
                </ReserveButton>
              )}
            </ReserveSheetClose>
            {canSave ? (
              <ReserveButton tier="primary" size="md" onClick={save}>
                {editingId ? "Save Changes" : "Save Check-In"}
              </ReserveButton>
            ) : (
              <ReserveButton tier="primary" size="md" disabled disabledReason="Enter body weight to save this check-in">
                {editingId ? "Save Changes" : "Save Check-In"}
              </ReserveButton>
            )}
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block font-mono text-[11px] uppercase tracking-[0.16em] text-white/55">Date</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={FIELD} />
          </label>
          <label className="block">
            <span className="mb-1.5 block font-mono text-[11px] uppercase tracking-[0.16em] text-white/55">
              Body weight (lb)
            </span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.1"
              enterKeyHint="next"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="e.g. 185.2"
              className={FIELD}
            />
          </label>
        </div>

        <p className="mb-2 mt-4 font-mono text-[11px] uppercase tracking-[0.16em] text-white/55">
          Sites · inches — leave blank to skip
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
                enterKeyHint="next"
                value={draft[site.id] ?? ""}
                onChange={(e) => setDraft((prev) => ({ ...prev, [site.id]: e.target.value }))}
                placeholder="—"
                className={FIELD}
              />
            </label>
          ))}
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
            enterKeyHint="done"
            placeholder="Conditions, hydration, anything worth remembering"
            className={FIELD}
          />
        </label>

        <p className="mt-3 text-[12px] leading-[1.55] text-white/50">
          Measure at the same time of day, under the same conditions. Consistent method is what makes the trend worth
          reading. Notes written here also appear in your Journal.
        </p>
      </ReserveBottomSheet>
    </ViewShell>
  );
}
