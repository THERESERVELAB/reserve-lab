"use client";

import { ArrowRight } from "lucide-react";

import { ReserveBottomSheet, ReserveButton } from "@/components/ui/reserve";
import type { DashboardView } from "@/lib/athlete-store";
import type { DayRing, DayRingId, ReadinessPart } from "@/lib/apex/day-scores";
import { RESERVE } from "@/lib/design/tokens";
import type { MacroDials, MacroState } from "@/lib/nutrition/nutrition-room";

/* ════════════════════════════════════════════════════════════════════════
   WHAT A DIAL IS MADE OF — one sheet per dial, from the member's own data.

   Each sheet names its inputs, says "derived" or "est." where the number is
   one, and routes to the room where the member logs it. The only action is
   secondary: the screen's one gold action stays the Next Move.
   ════════════════════════════════════════════════════════════════════════ */

export type SleepNight = { date: string; hours: number };

export type FuelMealRow = { id: string; label: string; time: string | null; proteinG: number; status: string; logged: boolean };

export type DayRingDetail = {
  readiness: {
    parts: ReadinessPart[];
    trendWord: string | null;
    projectedQuality: number | null;
    loggedKinds: string[];
  };
  sleep: { nights: SleepNight[]; targetHours: number };
  fuel: { meals: FuelMealRow[]; loggedG: number; targetG: number; referenceWeight: string | null; macros: MacroDials | null };
};

const TITLE: Record<DayRingId, string> = { readiness: "Readiness", sleep: "Sleep", fuel: "Fuel" };
const ROOM: Record<DayRingId, { view: DashboardView; label: string }> = {
  readiness: { view: "recovery", label: "Open Recovery" },
  sleep: { view: "recovery", label: "Log Sleep in Recovery" },
  fuel: { view: "nutrition", label: "Open Nutrition" },
};

export function DayRingSheet({
  ring,
  detail,
  onClose,
  onNavigate,
}: {
  ring: DayRing | null;
  detail: DayRingDetail;
  onClose: () => void;
  onNavigate: (view: DashboardView) => void;
}) {
  const open = ring !== null;
  const room = ring ? ROOM[ring.id] : null;
  return (
    <ReserveBottomSheet
      open={open}
      onClose={onClose}
      title={ring ? TITLE[ring.id] : "Today's scores"}
      footer={
        room ? (
          <ReserveButton
            tier="secondary"
            size="md"
            fullWidth
            iconAfter={ArrowRight}
            onClick={() => {
              onNavigate(room.view);
              onClose();
            }}
          >
            {room.label}
          </ReserveButton>
        ) : null
      }
    >
      {ring && (
        <div data-day-ring-sheet={ring.id} className="flex flex-col gap-5">
          <Headline ring={ring} />
          {ring.id === "readiness" && <ReadinessBody ring={ring} detail={detail.readiness} />}
          {ring.id === "sleep" && <SleepBody ring={ring} detail={detail.sleep} />}
          {ring.id === "fuel" && <FuelBody ring={ring} detail={detail.fuel} />}
        </div>
      )}
    </ReserveBottomSheet>
  );
}

function Headline({ ring }: { ring: DayRing }) {
  const provenance = ring.provenance === "logged" ? "logged by you" : ring.provenance === "derived" ? "derived" : "est.";
  return (
    <div className="flex items-end gap-4">
      {ring.reading ? (
        <p className="tnum font-display text-[40px] font-black leading-none tracking-[-0.03em] text-[#f2eee6]">
          {ring.reading.value.toFixed(ring.reading.decimals)}
          {ring.reading.unit && <span className="ml-1 text-[15px] font-semibold text-white/45">{ring.reading.unit}</span>}
        </p>
      ) : (
        <p className="text-[15px] font-semibold text-white/70">Evidence needed</p>
      )}
      <div className="mb-1 flex flex-col gap-1">
        <span className="text-[13px] font-semibold text-[#f2eee6]/85">{ring.word}</span>
        <span className="font-mono text-[8px] uppercase tracking-[0.2em] text-white/45">{provenance}</span>
      </div>
    </div>
  );
}

function Rows({ rows }: { rows: Array<{ key: string; label: string; value: string; muted?: boolean; aside?: string | null }> }) {
  return (
    <dl className="flex flex-col">
      {rows.map((row) => (
        <div key={row.key} className="flex items-baseline justify-between gap-4 border-t border-white/[0.06] py-2.5 first:border-t-0">
          <dt className="shrink-0 font-mono text-[8.5px] uppercase tracking-[0.18em] text-white/50">{row.label}</dt>
          <dd className={`min-w-0 text-right text-[12.5px] leading-[1.45] ${row.muted ? "text-white/40" : "text-[#f2eee6]/85"}`}>
            {row.value}
            {row.aside && <span className="ml-2 font-mono text-[8.5px] uppercase tracking-[0.14em] text-white/35">{row.aside}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function ReadinessBody({ ring, detail }: { ring: DayRing; detail: DayRingDetail["readiness"] }) {
  return (
    <>
      <p className="text-[12.5px] leading-[1.55] text-white/60">
        {ring.reading
          ? "Derived from your own recovery logs, weighted over what you logged. It organises today's plan. It is not a health reading."
          : `Evidence needed. Readiness reads at least two of sleep, water, mobility and check-ins.${detail.loggedKinds.length ? ` Logged so far: ${detail.loggedKinds.join(", ")}.` : ""}`}
      </p>
      <Rows
        rows={detail.parts.map((part) => ({
          key: part.kind,
          label: part.label,
          value: part.reading ?? "Not logged — left out, never counted as zero",
          muted: part.reading === null,
          aside: part.sharePct !== null ? `${part.sharePct}%` : null,
        }))}
      />
      {(detail.trendWord || detail.projectedQuality !== null) && (
        <Rows
          rows={[
            ...(detail.trendWord ? [{ key: "trend", label: "Sleep trend", value: detail.trendWord }] : []),
            ...(detail.projectedQuality !== null ? [{ key: "quality", label: "Session quality", value: `${detail.projectedQuality}% projected`, aside: "derived" }] : []),
          ]}
        />
      )}
    </>
  );
}

function SleepBody({ ring, detail }: { ring: DayRing; detail: DayRingDetail["sleep"] }) {
  const share = ring.reading ? Math.round((ring.reading.value / detail.targetHours) * 100) : null;
  return (
    <>
      <p className="text-[12.5px] leading-[1.55] text-white/60">
        {ring.reading
          ? `${ring.qualifier ? `Your latest log, from ${ring.qualifier}` : "Last night"}: ${ring.reading.value.toFixed(1)} h against your ${detail.targetHours} h target (${share}%). Hours you logged; the target is yours to set in Recovery.`
          : `Last night is not logged yet. Log it in Recovery and this dial reads it against your ${detail.targetHours} h target.`}
      </p>
      <SleepNights nights={detail.nights} targetHours={detail.targetHours} />
    </>
  );
}

function FuelBody({ ring, detail }: { ring: DayRing; detail: DayRingDetail["fuel"] }) {
  return (
    <>
      <p className="text-[12.5px] leading-[1.55] text-white/60">
        {detail.meals.length
          ? `Est. ${detail.loggedG} of ${detail.targetG} g protein, from the meals you logged today against today's planning estimate.${ring.word === "Behind" ? " A planned meal has passed without a log." : ""}`
          : "No meal windows are mapped, so there is no plan to read against. Map them in Nutrition."}
        {detail.referenceWeight ? ` ${detail.referenceWeight}` : ""}
      </p>
      {detail.macros && <MacroRow macros={detail.macros} />}
      {detail.meals.length > 0 && (
        <Rows
          rows={detail.meals.map((meal) => ({
            key: meal.id,
            label: meal.label,
            value: `${meal.time ? `${meal.time} · ` : ""}${meal.proteinG} g est.`,
            aside: meal.status,
            muted: !meal.logged,
          }))}
        />
      )}
    </>
  );
}

/* ─── Today's four macros ─────────────────────────────────────────────────
   The same read as Nutrition's macro dials, as one quiet row: logged against
   today's target, and what is left. Nothing logged shows the targets. */

const MACRO_TONE: Record<MacroState, string> = {
  empty: "rgba(255,255,255,0.5)",
  under: RESERVE.steel,
  "on-target": RESERVE.green,
  over: RESERVE.amber,
};

function MacroRow({ macros }: { macros: MacroDials }) {
  return (
    <dl data-day-ring-macros="" aria-label="Today's macros, estimated from logged meals" className="grid grid-cols-4 gap-3">
      {macros.dials.map((d) => (
        <div key={d.key} data-macro={d.key} data-state={d.state} className="min-w-0">
          <dt className="truncate font-mono text-[8px] uppercase tracking-[0.18em] text-white/50">{d.label}</dt>
          <dd className="mt-1.5 min-w-0">
            <span className="tnum block truncate text-[15px] font-bold leading-none text-[#f2eee6]">
              {macros.empty ? "—" : d.logged.toLocaleString("en-US")}
              <span className="ml-1 text-[10px] font-semibold text-white/45">/ {d.target.toLocaleString("en-US")}{d.unit === "g" ? " g" : ""}</span>
            </span>
            <span className="tnum mt-1 block truncate text-[11px] font-semibold" style={{ color: MACRO_TONE[d.state] }}>
              {macros.empty ? "Target" : d.remaining}
            </span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

/* ─── Logged sleep, last seven nights ─────────────────────────────────────
   Member-entered hours against the member's own target. Fewer than three
   nights is not a week; it says so instead of drawing one. */

function SleepNights({ nights, targetHours }: { nights: SleepNight[]; targetHours: number }) {
  if (nights.length < 3) {
    return <p className="text-[12px] leading-[1.5] text-white/50">Evidence needed · log three nights to see the week.</p>;
  }

  const H = 56;
  const BAR = 18;
  const GAP = 9;
  const W = nights.length * BAR + (nights.length - 1) * GAP;
  const max = Math.max(10, targetHours + 1, ...nights.map((n) => n.hours));
  const y = (hours: number) => H - (hours / max) * H;
  const avg = nights.reduce((sum, n) => sum + n.hours, 0) / nights.length;

  return (
    <figure className="m-0">
      <figcaption className="type-whisper">Last {nights.length} nights logged</figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
        className="mt-3 block overflow-visible"
        role="img"
        aria-label={`Logged sleep, oldest to newest: ${nights.map((n) => `${n.hours.toFixed(1)} hours`).join(", ")}. Target ${targetHours} hours.`}
      >
        <line x1={-3} x2={W + 3} y1={y(targetHours)} y2={y(targetHours)} stroke={RESERVE.violet} strokeOpacity={0.5} strokeWidth={1} strokeDasharray="2 3" />
        {nights.map((n, i) => (
          <rect
            key={n.date}
            x={i * (BAR + GAP)}
            y={y(n.hours)}
            width={BAR}
            height={H - y(n.hours)}
            rx={3}
            fill={RESERVE.violet}
            fillOpacity={i === nights.length - 1 ? 0.85 : 0.36}
          />
        ))}
      </svg>
      <p className="tnum mt-3 font-mono text-[9px] uppercase tracking-[0.14em] text-white/45">
        Avg {avg.toFixed(1)} h · target {targetHours} h
      </p>
    </figure>
  );
}
