"use client";

import { useEffect, useId, useState } from "react";

import { recordRecoveryLog } from "@/components/recovery/record-recovery-log";
import { ReserveBottomSheet, ReserveButton } from "@/components/ui/reserve";
import { useAthleteDashboardStore } from "@/lib/athlete-store";
import { localDateKey } from "@/lib/dates/local-day";
import { RESERVE } from "@/lib/design/tokens";
import { heartRateStatus, type FieldOp } from "@/lib/lifestyle/field-op";

const STATUS_COPY = {
  below: { text: "Below your range", color: RESERVE.steel },
  "in-range": { text: "In your range", color: RESERVE.green },
  above: { text: "Above your range", color: RESERVE.amber },
} as const;

function clock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * Live mode: a running clock, the op's heart-rate range and a place to check a
 * reading against it. Finishing logs the walk. Nothing is saved on close.
 */
export function FieldOpLive({ op, open, onClose }: { op: FieldOp; open: boolean; onClose: () => void }) {
  const logMobility = useAthleteDashboardStore((s) => s.logMobility);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [bpm, setBpm] = useState("");
  const hrId = useId();

  useEffect(() => {
    if (!open || startedAt === null) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [open, startedAt]);

  const elapsed = startedAt === null ? 0 : Math.max(0, Math.floor((now - startedAt) / 1000));
  const walk = op.walk;
  const reading = Number(bpm);
  const status = walk?.heartRate && reading >= 30 && reading <= 230 ? heartRateStatus(reading, walk.heartRate) : null;

  const reset = () => {
    setStartedAt(null);
    setBpm("");
  };
  const close = () => {
    reset();
    onClose();
  };
  const finish = () => {
    const minutes = Math.max(1, Math.round(elapsed / 60));
    recordRecoveryLog("mobility", () => logMobility({ date: localDateKey(), kind: "walk", minutes, focus: "Field Op walk" }));
    close();
  };

  if (!walk) return null;

  return (
    <ReserveBottomSheet open={open} onClose={close} title="Field Op · live" accent={RESERVE.steel} dirty={startedAt !== null} onDiscard={reset}>
      <div className="flex flex-col gap-5" data-field-op="live">
        <div className="text-center">
          <p className="type-whisper">Elapsed · goal {walk.minutes} min · about {walk.miles} mi</p>
          <p aria-live="off" className="tnum mt-1 text-[56px] font-black leading-none tracking-tight" style={{ color: RESERVE.ivory }}>{clock(elapsed)}</p>
        </div>

        {walk.heartRate ? (
          <div className="text-center">
            <p className="type-whisper">Heart-rate range for this walk</p>
            <p className="tnum mt-1 text-[22px] font-bold" style={{ color: RESERVE.ivory }}>{walk.heartRate.low}–{walk.heartRate.high} bpm</p>
            <label htmlFor={hrId} className="mt-3 block text-[12px] text-white/60">Check a reading from your watch</label>
            <input
              id={hrId}
              value={bpm}
              onChange={(e) => setBpm(e.target.value.replace(/[^\d]/g, "").slice(0, 3))}
              inputMode="numeric"
              placeholder="bpm"
              className="mx-auto mt-1.5 block w-28 rounded-[12px] border border-white/[0.1] bg-black/30 px-3 py-2 text-center text-[16px] text-[#f2eee6] outline-none focus:border-[#5fb7d5]/60"
            />
            {status && <p role="status" className="mt-1.5 text-[12.5px] font-semibold" style={{ color: STATUS_COPY[status].color }}>{STATUS_COPY[status].text}</p>}
          </div>
        ) : (
          <p className="text-center text-[12.5px] leading-[1.5] text-white/65">Easy pace, no heart-rate target today.</p>
        )}

        <p className="text-center text-[11.5px] leading-[1.5] text-white/45">
          Stop and get help for chest pain, fainting, severe shortness of breath or a racing, irregular heartbeat — call 911.
        </p>

        <div className="flex flex-col gap-2">
          {startedAt === null ? (
            <ReserveButton tier="secondary" size="lg" onClick={() => { setStartedAt(Date.now()); setNow(Date.now()); }}>
              Start the clock
            </ReserveButton>
          ) : (
            <ReserveButton tier="secondary" size="lg" onClick={finish}>
              Finish and log {Math.max(1, Math.round(elapsed / 60))} min
            </ReserveButton>
          )}
        </div>
      </div>
    </ReserveBottomSheet>
  );
}
