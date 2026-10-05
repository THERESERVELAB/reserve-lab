"use client";

import { Check, ChevronDown } from "lucide-react";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { RADIUS, RESERVE, alpha } from "@/lib/design/tokens";

/* ════════════════════════════════════════════════════════════════════════
   RESERVE SELECT — the replacement for the native dropdown.

   A native <select> can be styled at rest, but the OPEN LIST is painted by
   the operating system. On Windows and Android that list is white. Reserve
   shipped 91 native selects, so 91 places existed where a member could tap a
   control in a black private-institution interface and be shown a white
   Windows menu. That is the single most visible break in the illusion.

   This is a real listbox, not a div with a click handler:

     - Button carries `aria-haspopup="listbox"` and `aria-expanded`.
     - The list is `role="listbox"`, options are `role="option"` with
       `aria-selected`.
     - Full keyboard model: Enter/Space/Arrow opens, Up/Down moves,
       Home/End jumps, typeahead selects, Escape closes and RESTORES focus
       to the trigger, Tab closes.
     - Focus never escapes to the page while the list is open.
     - The trigger and every option meet the 44px target floor.

   THE LIST IS PORTALLED, and that is a correction. This component originally
   rendered the list inline on the stated premise that "Reserve panels do not
   clip their children." That premise was false: `GlassPanel` hardcodes
   `overflow-hidden` to clip its own rounded corners and top-edge shimmer, so
   the list was cut off inside it — and nine files put a ReserveSelect inside
   a GlassPanel. Adding an opt-out prop to GlassPanel would have fixed those
   nine and left every future host to remember; portalling fixes it once, for
   every overflow-hidden ancestor including ReserveBottomSheet.

   Portalling also buys the other half: with the list in the body it can be
   measured against the viewport and FLIPPED above the trigger when there is
   no room below, instead of running off the bottom of a phone screen.
   ════════════════════════════════════════════════════════════════════════ */

export type ReserveSelectOption<T extends string> = {
  value: T;
  label: string;
  /** Optional second line. Keep it to a few words — this is not a paragraph. */
  hint?: string;
  disabled?: boolean;
};

export type ReserveSelectProps<T extends string> = {
  value: T;
  options: ReserveSelectOption<T>[];
  onChange: (value: T) => void;
  /** Visible label. Always provide one, or `aria-label` via `srLabel`. */
  label?: string;
  /** Accessible name when the label is visually elsewhere. */
  srLabel?: string;
  accent?: string;
  disabled?: boolean;
  /** Why the control is disabled. Rendered as `title` — never a dead control. */
  disabledReason?: string;
  className?: string;
  placeholder?: string;
};

export function ReserveSelect<T extends string>({
  value,
  options,
  onChange,
  label,
  srLabel,
  accent = RESERVE.gold,
  disabled = false,
  disabledReason,
  className = "",
  placeholder = "Select",
}: ReserveSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(() =>
    Math.max(0, options.findIndex((o) => o.value === value)),
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const typeahead = useRef({ buffer: "", at: 0 });

  /** Fixed-viewport coordinates for the portalled list. Null until measured. */
  const [placement, setPlacement] = useState<{
    left: number;
    width: number;
    maxHeight: number;
    top?: number;
    bottom?: number;
  } | null>(null);

  const listId = useId();
  const labelId = useId();
  const selected = options.find((o) => o.value === value) ?? null;

  const close = useCallback((restoreFocus: boolean) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  /* Outside pointer and focus both close. Focus matters as much as pointer:
     tabbing past an open list must not leave it hanging over the page.

     Both handlers test the LIST as well as the root — the portalled list is
     no longer a DOM descendant of rootRef, so a click on an option would
     otherwise read as "outside" and close the list before it could commit. */
  useEffect(() => {
    if (!open) return;
    const isInside = (target: Node | null) =>
      Boolean(rootRef.current?.contains(target ?? null)) ||
      Boolean(listRef.current?.contains(target ?? null));

    const onPointer = (e: PointerEvent) => {
      if (!isInside(e.target as Node)) setOpen(false);
    };
    const onFocusIn = (e: FocusEvent) => {
      if (!isInside(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("focusin", onFocusIn);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("focusin", onFocusIn);
    };
  }, [open]);

  /* ── Viewport-aware placement ──────────────────────────────────────────
     A fixed-position list must be measured against the viewport, not the
     document: it opens downward when there is room, flips above the trigger
     when there is not, and caps its own height to whatever space it lands
     in. Without the cap, a long option list on a 375px phone runs off the
     bottom edge with no way to reach the rest. */
  useLayoutEffect(() => {
    if (!open) return;

    const place = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;

      const rect = trigger.getBoundingClientRect();
      const GAP = 6;
      const MARGIN = 8; // never touch the viewport edge
      const below = window.innerHeight - rect.bottom - GAP - MARGIN;
      const above = rect.top - GAP - MARGIN;

      /* Prefer below. Flip only when below cannot hold a usable list AND
         above is genuinely roomier — flipping for a marginal gain is more
         disorienting than a slightly shorter list. */
      const flip = below < 180 && above > below;
      const maxHeight = Math.max(120, Math.min(320, flip ? above : below));

      setPlacement({
        left: rect.left,
        width: rect.width,
        maxHeight,
        ...(flip
          ? { bottom: window.innerHeight - rect.top + GAP }
          : { top: rect.bottom + GAP }),
      });
    };

    place();

    /* `true` captures scroll from any ancestor scroller, not just the window —
       Reserve's content scrolls inside <main>, so a window-only listener
       would let the list drift away from its trigger. */
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open]);

  /* Move DOM focus onto the active option so screen readers track the
     highlight. aria-activedescendant alone is unreliable across AT here.

     `placement` is a dependency, not decoration: the portalled list only
     mounts once placement has been measured, so on the FIRST open this
     effect would otherwise run against a null listRef and never move focus
     into the list at all. */
  useEffect(() => {
    if (!open || !placement) return;
    const node = listRef.current?.children[activeIndex] as HTMLElement | undefined;
    node?.focus({ preventScroll: true });
    node?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex, placement]);

  const commit = (index: number) => {
    const option = options[index];
    if (!option || option.disabled) return;
    onChange(option.value);
    close(true);
  };

  const step = (from: number, direction: 1 | -1) => {
    const total = options.length;
    for (let i = 1; i <= total; i += 1) {
      const next = (from + direction * i + total * total) % total;
      if (!options[next].disabled) return next;
    }
    return from;
  };

  const openList = (index?: number) => {
    if (disabled) return;
    const start = index ?? Math.max(0, options.findIndex((o) => o.value === value));
    setActiveIndex(options[start]?.disabled ? step(start, 1) : start);
    setOpen(true);
  };

  const onTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openList();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      openList(options.length - 1);
    }
  };

  const onListKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((i) => step(i, 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((i) => step(i, -1));
        break;
      case "Home":
        e.preventDefault();
        setActiveIndex(step(-1, 1));
        break;
      case "End":
        e.preventDefault();
        setActiveIndex(step(options.length, -1));
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        commit(activeIndex);
        break;
      case "Escape":
        e.preventDefault();
        close(true);
        break;
      case "Tab":
        /* Let Tab move on, but do not leave an orphaned open list behind. */
        close(false);
        break;
      default: {
        if (e.key.length !== 1) break;
        const now = Date.now();
        const buffer = now - typeahead.current.at > 700 ? e.key : typeahead.current.buffer + e.key;
        typeahead.current = { buffer, at: now };
        const match = options.findIndex(
          (o) => !o.disabled && o.label.toLowerCase().startsWith(buffer.toLowerCase()),
        );
        if (match >= 0) setActiveIndex(match);
      }
    }
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      {label && (
        <span
          id={labelId}
          className="mb-1.5 block font-mono text-[9px] uppercase tracking-[0.22em] text-white/40"
        >
          {label}
        </span>
      )}

      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        title={disabled ? disabledReason : undefined}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-labelledby={label ? labelId : undefined}
        aria-label={label ? undefined : srLabel}
        onClick={() => (open ? close(false) : openList())}
        onKeyDown={onTriggerKeyDown}
        className="flex min-h-[44px] w-full items-center justify-between gap-3 px-3 py-2 text-left transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-45"
        style={{
          borderRadius: RADIUS.control,
          border: `1px solid ${open ? alpha(accent, 0.4) : "rgba(255,255,255,0.09)"}`,
          background: open ? alpha(accent, 0.06) : "rgba(0,0,0,0.28)",
        }}
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold text-[#f2eee6]">
            {selected ? selected.label : placeholder}
          </span>
          {selected?.hint && (
            <span className="mt-0.5 block truncate text-[11px] text-white/45">{selected.hint}</span>
          )}
        </span>
        <ChevronDown
          size={14}
          className="shrink-0 transition-transform duration-200"
          style={{
            color: open ? accent : "rgba(255,255,255,0.35)",
            transform: open ? "rotate(180deg)" : "none",
          }}
        />
      </button>

      {open && placement && createPortal(
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-labelledby={label ? labelId : undefined}
          aria-label={label ? undefined : srLabel}
          onKeyDown={onListKeyDown}
          className="fba-rail fixed z-[120] overflow-y-auto py-1"
          style={{
            left: placement.left,
            width: placement.width,
            top: placement.top,
            bottom: placement.bottom,
            maxHeight: placement.maxHeight,
            borderRadius: RADIUS.control,
            border: `1px solid ${alpha(accent, 0.22)}`,
            /* Opaque, not translucent: a list stacked over busy glass is the
               readability failure this component exists to end. */
            background: "#0c0d13",
            boxShadow: "0 24px 60px rgba(0,0,0,0.72)",
          }}
        >
          {options.map((option, index) => {
            const isSelected = option.value === value;
            return (
              <li
                key={option.value}
                role="option"
                aria-selected={isSelected}
                aria-disabled={option.disabled || undefined}
                tabIndex={-1}
                onClick={() => commit(index)}
                onMouseEnter={() => !option.disabled && setActiveIndex(index)}
                /* `fba-focus-none` suppresses the global gold ring because the
                   row paints its own indicator below — but the row MUST then
                   actually paint one. It previously fell back to a bare
                   rgba(255,255,255,0.06) wash on #0c0d13, roughly 1.15:1,
                   which is invisible: keyboard users had no way to tell which
                   option was current in any dropdown in the product. */
                className={`fba-focus-none flex min-h-[44px] cursor-pointer items-center gap-2.5 px-3 py-2 outline-none ${
                  option.disabled ? "cursor-not-allowed opacity-40" : ""
                }`}
                style={
                  index === activeIndex
                    ? {
                        background: alpha(accent, 0.16),
                        /* Inset ring rather than outline: it cannot be clipped
                           by the list's own overflow-y-auto scroll container. */
                        boxShadow: `inset 0 0 0 1px ${alpha(accent, 0.85)}`,
                      }
                    : { background: "transparent" }
                }
              >
                <Check
                  size={12}
                  className="shrink-0"
                  style={{ color: isSelected ? accent : "transparent" }}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1">
                  <span
                    className="block truncate text-[13px] font-semibold"
                    style={{ color: isSelected ? accent : "#f2eee6" }}
                  >
                    {option.label}
                  </span>
                  {option.hint && (
                    <span className="mt-0.5 block truncate text-[11px] text-white/45">
                      {option.hint}
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>,
        document.body,
      )}
    </div>
  );
}
