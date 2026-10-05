"use client";

import type { LucideIcon } from "lucide-react";
import { useCallback, useId, useMemo, useState, type CSSProperties, type ReactNode } from "react";

import { alpha } from "@/lib/design/tokens";

import { HorizonItemSheet, type HorizonSheetAction } from "./HorizonItemSheet";
import { HorizonSpine, roomSpineFooter } from "./HorizonSpine";
import { HorizonTrack, type HorizonLane } from "./HorizonTrack";
import { roomHorizonLook } from "./horizon-look";
import { HORIZON_PHONE_HOLD_PX, horizonTrackHeightPx, type HorizonItem } from "./horizon-model";

/* ════════════════════════════════════════════════════════════════════════
   RESERVE HORIZON — a living room's day, receding toward sleep lock.

   The Apex horizon (Bible §13), compact, at the foot of a room's hero. A room
   hands it lanes, items and what each item's sheet says and does; this file
   owns the rest, so the rooms cannot drift apart again:

     - Before the clock mounts it holds the track's height: nothing jumps and
       no wrong time is shown.
     - Before wake or after sleep lock (or with no plan set) it is a quiet
       state, never an empty track.
     - md and up: the perspective track. Phones: the vertical spine.
     - Every item that opens something is a real button with a 44px hit area
       that opens its sheet; the sheet's actions are never gold.
     - Phones: the section's top edge is a hairline of light, not a rule.
   ════════════════════════════════════════════════════════════════════════ */

export type ReserveHorizonView<T extends HorizonItem> =
  | { state: "pending" }
  | { state: "quiet"; headline: string; detail: string; icon: LucideIcon; iconColor: string }
  | {
      state: "track";
      window: { startMin: number; endMin: number };
      nowMin: number;
      sleepLockMin: number | null;
      lanes: HorizonLane<T>[];
      /** Every item in time order: the phone spine reads this. */
      items: readonly T[];
    };

export function ReserveHorizon<T extends HorizonItem>({
  hook,
  title,
  accent,
  meta,
  view,
  holdLanes,
  noun,
  opens,
  laneOf,
  sheet,
  floorOpacity = 0.08,
  quietTint = 0.045,
  className = "",
}: {
  /** The room's test hook, e.g. `{ "data-nutrition": "horizon" }`. */
  hook: Record<`data-${string}`, string>;
  title: string;
  accent: string;
  /** "Now 4:12 PM · Sleep lock 10:30 PM", once the clock has mounted. */
  meta: string | null;
  view: ReserveHorizonView<T>;
  /** Lanes the track usually draws: the height held before the clock mounts. */
  holdLanes: number;
  /** "today" or "tonight" — the spine footer and the sheet's empty name. */
  noun: "today" | "tonight";
  opens: (item: T) => boolean;
  laneOf: (item: T) => { name: string; accent: string };
  sheet: { note?: (item: T) => ReactNode; actions: (item: T) => HorizonSheetAction[] };
  floorOpacity?: number;
  quietTint?: number;
  className?: string;
}) {
  const headingId = useId();
  const [sheetItems, setSheetItems] = useState<T[] | null>(null);
  const closeSheet = useCallback(() => setSheetItems(null), []);
  const look = useMemo(() => roomHorizonLook(accent, floorOpacity), [accent, floorOpacity]);
  const footer = useMemo(() => roomSpineFooter(noun), [noun]);

  return (
    <section aria-labelledby={headingId} {...hook} className={`relative pb-4 pt-3.5 md:border-t md:border-white/[0.06] md:px-5 ${className}`}>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px md:hidden"
        style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.08) 30%, rgba(255,255,255,0.08) 70%, transparent)" }}
      />
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id={headingId} className="font-mono text-[11px] uppercase tracking-[0.2em]" style={{ color: alpha(accent, 0.9) }}>
          {title}
        </h2>
        {meta && <p className="tnum font-mono text-[11px] uppercase tracking-[0.1em] text-white/60">{meta}</p>}
      </div>

      {view.state === "pending" ? (
        <div
          className="mt-3 h-[var(--horizon-hold-phone)] md:h-[var(--horizon-hold)]"
          style={{ "--horizon-hold-phone": `${HORIZON_PHONE_HOLD_PX}px`, "--horizon-hold": `${horizonTrackHeightPx(holdLanes)}px` } as CSSProperties}
          aria-hidden="true"
        />
      ) : view.state === "quiet" ? (
        <div className="mt-3 flex items-start gap-3 rounded-[14px] px-4 py-3" style={{ background: alpha(accent, quietTint) }}>
          <view.icon size={16} aria-hidden="true" className="mt-0.5 shrink-0" style={{ color: view.iconColor }} />
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-[#f2eee6]">{view.headline}</p>
            <p className="mt-1 max-w-[62ch] text-[12px] leading-[1.55] text-white/60">{view.detail}</p>
          </div>
        </div>
      ) : (
        <>
          <HorizonTrack
            className="mt-3 hidden md:block"
            window={view.window}
            nowMin={view.nowMin}
            sleepLockMin={view.sleepLockMin}
            lanes={view.lanes}
            look={look}
            opens={(items) => items.some(opens)}
            onOpen={setSheetItems}
          />
          <HorizonSpine
            className="mt-2 md:hidden"
            items={view.items}
            look={look}
            accentOf={(item) => laneOf(item).accent}
            opens={opens}
            onOpen={(item) => setSheetItems([item])}
            footer={footer}
          />
        </>
      )}

      <HorizonItemSheet
        items={sheetItems}
        onClose={closeSheet}
        emptyTitle={noun === "tonight" ? "Tonight" : "Today"}
        accent={accent}
        look={look}
        laneOf={laneOf}
        note={sheet.note}
        actions={sheet.actions}
      />
    </section>
  );
}
