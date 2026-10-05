"use client";

import { useState, type ReactNode } from "react";

import { STATUS_WORD } from "@/components/apex/pit-wall/format";
import { ReserveButton } from "@/components/ui/reserve/ReserveButton";
import { spineFade, spineInk } from "@/lib/apex/horizon-projection";
import { RESERVE, alpha } from "@/lib/design/tokens";

import type { HorizonLook } from "./horizon-look";
import { HORIZON_SPINE_ROWS, spineWindow, type HorizonItem } from "./horizon-model";

/* ════════════════════════════════════════════════════════════════════════
   HORIZON SPINE — a horizon recomposed for a phone.

   Not a squeezed track: the lanes merged into one vertical line of time,
   starting one row before the first item still ahead. Five rows by default,
   everything on request. Depth is a gentle fade down from now, carried by the
   marker and a small step in the text — never by dimming a row below AA.
   ════════════════════════════════════════════════════════════════════════ */

export type SpineFooterState = {
  expanded: boolean;
  total: number;
  hiddenBefore: number;
  hiddenAfter: number;
  toggle: () => void;
};

export function HorizonSpine<T extends HorizonItem>({
  items,
  look,
  accentOf,
  opens,
  onOpen,
  dialog = true,
  still = false,
  label,
  className = "",
  hook,
  footer,
}: {
  /** Every item, in time order. */
  items: readonly T[];
  look: HorizonLook;
  accentOf: (item: T) => string;
  /** A row is a button when it opens something; otherwise it is text. */
  opens: (item: T) => boolean;
  onOpen: (item: T) => void;
  /** Rows open a sheet (`aria-haspopup="dialog"`). False when a row goes somewhere directly. */
  dialog?: boolean;
  /** Hold completely still: no hover transitions. */
  still?: boolean;
  /** The list's accessible name. */
  label?: string;
  className?: string;
  /** A test hook on the spine's root, e.g. `{ "data-apex": "now-spine" }`. */
  hook?: Record<`data-${string}`, string>;
  footer?: (state: SpineFooterState) => ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const win = spineWindow(items, expanded);

  return (
    <div {...hook} className={className}>
      <ol className="relative" aria-label={label}>
        <span
          className="pointer-events-none absolute bottom-3 top-3 w-px bg-gradient-to-b from-white/[0.1] to-white/[0.03]"
          style={{ left: look.spine.lineLeftPx }}
          aria-hidden="true"
        />
        {win.shown.map((item, index) => (
          <li key={item.id}>
            <SpineRow
              item={item}
              accent={accentOf(item)}
              fade={spineFade(win.liveIndex < 0 ? 0 : index - win.liveIndex)}
              look={look}
              dialog={dialog}
              still={still}
              onOpen={opens(item) ? () => onOpen(item) : null}
            />
          </li>
        ))}
      </ol>
      {footer?.({
        expanded,
        total: items.length,
        hiddenBefore: win.hiddenBefore,
        hiddenAfter: win.hiddenAfter,
        toggle: () => setExpanded((value) => !value),
      })}
    </div>
  );
}

/** The living rooms' footer: how many more, and one quiet toggle. */
export function roomSpineFooter(noun: string) {
  function RoomSpineFooter(state: SpineFooterState) {
    if (state.total <= HORIZON_SPINE_ROWS) return null;
    return (
      <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
        <span className="tnum font-mono text-[11px] uppercase tracking-[0.1em] text-white/60">
          {state.expanded ? `All ${state.total} ${noun}` : `+${state.hiddenBefore + state.hiddenAfter} more ${noun}`}
        </span>
        <ReserveButton tier="quiet" size="sm" onClick={state.toggle}>
          {state.expanded ? "Show less" : `Show all ${noun}`}
        </ReserveButton>
      </div>
    );
  }
  return RoomSpineFooter;
}

function SpineRow<T extends HorizonItem>({
  item,
  accent,
  fade,
  look,
  dialog,
  still,
  onOpen,
}: {
  item: T;
  accent: string;
  fade: number;
  look: HorizonLook;
  dialog: boolean;
  still: boolean;
  onOpen: (() => void) | null;
}) {
  const hot = item.status === "due-now";
  const next = item.status === "due-next";
  const done = item.status === "completed" || item.status === "skipped";
  const passed = item.status === "past-due";
  const ink = spineInk(fade, done || passed);
  const meta = `rgba(255,255,255,${ink.meta})`;
  const rowClass = `grid min-h-[48px] w-full ${look.spine.grid} items-start rounded-[12px] py-2 text-left`;
  const showSub = item.sub && (look.spine.subWhenDue || !hot);

  const content = (
    <>
      <span className={look.spine.timeClass} style={{ color: hot ? RESERVE.amber : meta }}>
        {look.spine.splitMeridiem ? (
          <>
            {item.timeLabel.replace(/\s?(AM|PM)$/, "")}
            <span className="block text-[7.5px] tracking-[0.12em]" style={{ color: meta }}>
              {item.timeLabel.slice(-2)}
            </span>
          </>
        ) : (
          item.timeLabel
        )}
      </span>
      <span className="relative grid h-5 place-items-center" aria-hidden="true">
        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{
            opacity: hot ? 1 : ink.marker,
            transform: `scale(${(0.8 + 0.2 * fade).toFixed(2)})`,
            ...(hot
              ? { background: look.spine.hotMarker, boxShadow: `0 0 12px ${alpha(look.spine.hotMarker, look.spine.hotGlow)}` }
              : done
                ? { background: alpha(accent, 0.7) }
                : {
                    boxShadow: `inset 0 0 0 1.5px ${next ? alpha(RESERVE.amber, 0.8) : alpha(accent, look.spine.idleRing)}`,
                    background: RESERVE.base,
                  }),
          }}
        />
      </span>
      <span className="min-w-0">
        <span className="block break-words text-[13.5px] font-semibold leading-snug" style={{ color: `rgba(242,238,230,${ink.label})` }}>
          {item.label}
        </span>
        <span className={look.spine.statusClass} style={{ color: hot ? alpha(RESERVE.amber, 0.9) : meta }}>
          {STATUS_WORD[item.status]}
          {showSub ? ` · ${item.sub}` : ""}
        </span>
      </span>
    </>
  );

  if (!onOpen) return <div className={rowClass}>{content}</div>;

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-haspopup={dialog ? "dialog" : undefined}
      className={`${rowClass} ${still ? "" : "transition-colors hover:bg-white/[0.025]"} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e8c87a]`}
    >
      {content}
    </button>
  );
}
