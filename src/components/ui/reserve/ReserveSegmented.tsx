"use client";

import { useRef } from "react";

import { RADIUS, RESERVE, alpha } from "@/lib/design/tokens";

/* ════════════════════════════════════════════════════════════════════════
   RESERVE SEGMENTED CONTROL — for 2–4 mutually exclusive views.

   Replaces the row-of-pills pattern, which reads as a chip cloud and gives
   no signal about which pill is a filter, which is a tab, and which is just
   a label.

   Implemented as a real tablist with roving tabindex: exactly one segment is
   in the tab order, and arrow keys move between them. That is the WAI
   pattern, and it is also simply better to use — Tab leaves the control
   instead of walking through every option.
   ════════════════════════════════════════════════════════════════════════ */

export type ReserveSegment<T extends string> = {
  value: T;
  label: string;
  disabled?: boolean;
  /** Why it is disabled. Rendered as `title` — no dead controls. */
  disabledReason?: string;
};

export function ReserveSegmented<T extends string>({
  value,
  segments,
  onChange,
  accent = RESERVE.gold,
  label,
  className = "",
  size = "md",
}: {
  value: T;
  segments: ReserveSegment<T>[];
  onChange: (value: T) => void;
  accent?: string;
  /** Accessible name for the group. Required — a bare tablist is unnavigable. */
  label: string;
  className?: string;
  size?: "sm" | "md";
}) {
  const ref = useRef<HTMLDivElement>(null);

  const move = (from: number, direction: 1 | -1) => {
    const total = segments.length;
    for (let i = 1; i <= total; i += 1) {
      const next = (from + direction * i + total * total) % total;
      if (!segments[next].disabled) {
        onChange(segments[next].value);
        (ref.current?.children[next] as HTMLElement | undefined)?.focus();
        return;
      }
    }
  };

  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      move(index, 1);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      move(index, -1);
    } else if (e.key === "Home") {
      e.preventDefault();
      move(-1, 1);
    } else if (e.key === "End") {
      e.preventDefault();
      move(segments.length, -1);
    }
  };

  return (
    <div
      ref={ref}
      role="tablist"
      aria-label={label}
      className={`inline-flex items-center gap-0.5 p-0.5 ${className}`}
      style={{
        borderRadius: RADIUS.control,
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {segments.map((segment, index) => {
        const active = segment.value === value;
        return (
          <button
            key={segment.value}
            type="button"
            role="tab"
            aria-selected={active}
            /* Roving tabindex — Tab enters and leaves the control once. */
            tabIndex={active ? 0 : -1}
            disabled={segment.disabled}
            title={segment.disabled ? segment.disabledReason : undefined}
            onClick={() => onChange(segment.value)}
            onKeyDown={(e) => onKeyDown(e, index)}
            className={`min-h-[44px] min-w-[44px] whitespace-nowrap px-3 font-mono uppercase tracking-[0.14em] transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-35 ${
              size === "sm" ? "text-[9px]" : "text-[10px]"
            }`}
            style={{
              borderRadius: `calc(${RADIUS.control} - 2px)`,
              background: active ? alpha(accent, 0.14) : "transparent",
              color: active ? accent : "rgba(255,255,255,0.45)",
              fontWeight: active ? 700 : 500,
            }}
          >
            {segment.label}
          </button>
        );
      })}
    </div>
  );
}
