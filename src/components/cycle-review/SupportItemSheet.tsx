"use client";

import { useState } from "react";

import { ReserveBottomSheet, ReserveButton, useDirtySnapshot, useReportDirty } from "@/components/ui/reserve";
import { useAthleteDashboardStore } from "@/lib/athlete-store";
import { isDateKey } from "@/lib/cycle/cycle-period";
import { SAFETY_LEVEL_LABEL, type PlanEntry } from "@/lib/cycle-review/support-plan";
import type { SupportPlanItem } from "@/lib/cycle-review/types";
import { RESERVE } from "@/lib/design/tokens";

import { SAFETY_COLOR } from "./support-tokens";

const INPUT =
  "mt-1 min-h-[44px] w-full rounded-[12px] border border-white/[0.08] bg-black/30 px-3 text-[16px] text-[#f2eee6] outline-none placeholder:text-white/25 focus:border-[#6ee7b7]/60 sm:text-[13px]";

/** A support plan item opened for details: a library option (with its check) or one the member named. */
export type SupportItemTarget = {
  item: SupportPlanItem;
  title: string;
  check?: PlanEntry["check"];
  timing?: string[];
  /** For a supplement not in the library: what Reserve can and cannot tell. */
  lines?: readonly string[];
};

/**
 * What the member actually takes, in their own words. Reserve stores it as
 * entered and never proposes an amount, frequency or timing.
 */
export function SupportItemSheet({ entry, onClose }: { entry: SupportItemTarget | null; onClose: () => void }) {
  const [dirty, setDirty] = useState(false);
  return (
    <ReserveBottomSheet open={entry !== null} onClose={onClose} title={entry ? `${entry.title} — your details` : "Your details"} accent={RESERVE.green} dirty={entry !== null && dirty}>
      {entry && <DetailsForm key={entry.item.id} entry={entry} onClose={onClose} onDirtyChange={setDirty} />}
    </ReserveBottomSheet>
  );
}

function DetailsForm({ entry, onClose, onDirtyChange }: { entry: SupportItemTarget; onClose: () => void; onDirtyChange: (dirty: boolean) => void }) {
  const updateSupportPlanItem = useAthleteDashboardStore((s) => s.updateSupportPlanItem);
  const removeSupportPlanItem = useAthleteDashboardStore((s) => s.removeSupportPlanItem);
  const { item } = entry;
  const [amount, setAmount] = useState(item.amount ?? "");
  const [unit, setUnit] = useState(item.unit ?? "");
  const [frequency, setFrequency] = useState(item.frequency ?? "");
  const [brand, setBrand] = useState(item.brand ?? "");
  const [startDate, setStartDate] = useState(item.startDate ?? "");
  const [notes, setNotes] = useState(item.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  useReportDirty(useDirtySnapshot({ amount, unit, frequency, brand, startDate, notes }), onDirtyChange);

  const save = () => {
    if (startDate && !isDateKey(startDate)) {
      setError("Choose a valid start date, or leave it blank.");
      return;
    }
    updateSupportPlanItem(item.id, { amount, unit, frequency, brand, startDate, notes });
    onClose();
  };

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <div>
        <p className="type-whisper" style={{ color: RESERVE.green }}>Member entered</p>
        <p className="mt-1 text-[12.5px] leading-[1.55] text-white/60">
          Record what you actually take. Reserve never suggests an amount, frequency or timing, and leaves blanks blank.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="text-[11.5px] text-white/55">Amount</span>
          <input className={INPUT} value={amount} maxLength={20} onChange={(e) => setAmount(e.target.value)} />
        </label>
        <label className="block">
          <span className="text-[11.5px] text-white/55">Unit</span>
          <input className={INPUT} value={unit} maxLength={20} onChange={(e) => setUnit(e.target.value)} />
        </label>
        <label className="col-span-2 block sm:col-span-1">
          <span className="text-[11.5px] text-white/55">Frequency</span>
          <input className={INPUT} value={frequency} maxLength={40} onChange={(e) => setFrequency(e.target.value)} />
        </label>
        <label className="col-span-2 block">
          <span className="text-[11.5px] text-white/55">Brand or product</span>
          <input className={INPUT} value={brand} maxLength={80} onChange={(e) => setBrand(e.target.value)} />
        </label>
        <label className="col-span-2 block sm:col-span-1">
          <span className="text-[11.5px] text-white/55">Start date</span>
          <input className={INPUT} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </label>
        <label className="col-span-2 block sm:col-span-3">
          <span className="text-[11.5px] text-white/55">Notes</span>
          <input className={INPUT} value={notes} maxLength={200} onChange={(e) => setNotes(e.target.value)} />
        </label>
      </div>

      {entry.check ? (
        <div className="rounded-[14px] bg-white/[0.025] px-3.5 py-3">
          <p className="type-whisper">Check against your records</p>
          <p className="mt-1 text-[13px] font-semibold" style={{ color: SAFETY_COLOR[entry.check.level] }}>{SAFETY_LEVEL_LABEL[entry.check.level]}</p>
          {entry.check.reasons.map((reason) => (
            <p key={reason.text} className="mt-1 text-[12px] leading-[1.5] text-white/70">{reason.text}</p>
          ))}
          {(entry.timing ?? []).map((line) => (
            <p key={line} className="mt-1 text-[12px] leading-[1.5] text-white/60">{line}</p>
          ))}
          <p className="mt-1.5 text-[11px] text-white/40">{entry.check.caveats.join(" ")}</p>
        </div>
      ) : (
        entry.lines && (
          <div className="rounded-[14px] bg-white/[0.025] px-3.5 py-3">
            <p className="type-whisper">What Reserve can tell</p>
            {entry.lines.map((line) => (
              <p key={line} className="mt-1 text-[12px] leading-[1.5] text-white/70">{line}</p>
            ))}
          </div>
        )
      )}

      {error && (
        <p role="alert" className="text-[12.5px]" style={{ color: RESERVE.red }}>{error}</p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <ReserveButton tier="primary" type="submit">
          Save details
        </ReserveButton>
        <ReserveButton
          tier="quiet"
          onClick={() => {
            removeSupportPlanItem(item.id);
            onClose();
          }}
        >
          Remove from support plan
        </ReserveButton>
      </div>
    </form>
  );
}
