"use client";

import { AlertTriangle, Info, Loader2, X } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { RADIUS, RESERVE, RESERVE_MOTION, alpha } from "@/lib/design/tokens";
import { isTextEntry, useKeyboardViewport } from "@/lib/hooks/useKeyboardViewport";
import { releaseVelocity, shouldDismissSheet } from "@/lib/ui/sheet-drag";

import { DiscardChangesBar, useFormCloseGuard } from "./FormCloseGuard";

/* ════════════════════════════════════════════════════════════════════════
   RESERVE STATE SURFACES — notice, warning, error, loading, stale, sheet.

   Reserve's rule is two visible surface levels maximum: the environment,
   and one glass layer. Nothing here draws a second box inside a panel — a
   notice separates with a single accent rail on its leading edge and a
   feathered tint, never a full border.
   ════════════════════════════════════════════════════════════════════════ */

export type NoticeTone = "info" | "warning" | "error" | "stale";

const TONE: Record<NoticeTone, { color: string; icon: React.ComponentType<{ size?: number }> }> = {
  info: { color: RESERVE.steel, icon: Info },
  warning: { color: RESERVE.amber, icon: AlertTriangle },
  /* Red is a signal, never weather (color.md) — it colours the rail and the
     icon, and nothing else. There are no red panels in Reserve. */
  error: { color: RESERVE.red, icon: AlertTriangle },
  stale: { color: RESERVE.slate, icon: Info },
};

export function ReserveNotice({
  tone = "info",
  title,
  children,
  action,
  className = "",
}: {
  tone?: NoticeTone;
  title?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  const { color, icon: Icon } = TONE[tone];
  return (
    <div
      className={`relative overflow-hidden py-3 pl-4 pr-3.5 ${className}`}
      style={{
        borderRadius: RADIUS.control,
        background: alpha(color, 0.05),
      }}
      /* Errors interrupt; everything else waits its turn. */
      role={tone === "error" ? "alert" : "status"}
    >
      <span
        className="absolute inset-y-0 left-0 w-[2px]"
        style={{ background: alpha(color, 0.5) }}
        aria-hidden="true"
      />
      <div className="flex gap-2.5">
        <Icon size={13} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          {title && (
            <p
              className="font-mono text-[9px] uppercase tracking-[0.2em]"
              style={{ color: alpha(color, 0.85) }}
            >
              {title}
            </p>
          )}
          <div className={`text-[12px] leading-[1.5] text-white/60 ${title ? "mt-1" : ""}`}>
            {children}
          </div>
          {action && <div className="mt-2.5">{action}</div>}
        </div>
      </div>
    </div>
  );
}

/* ─── Loading ─────────────────────────────────────────────────────────────
   Holds the layout at the height the content will occupy, so nothing shifts
   when the real content arrives (motion.md: loading transitions must
   preserve layout stability). */

export function ReserveLoading({
  label = "Loading",
  /** Reserve the final height in px so arrival causes no shift. */
  minHeight = 120,
  className = "",
}: {
  label?: string;
  minHeight?: number;
  className?: string;
}) {
  return (
    <div
      className={`grid place-items-center ${className}`}
      style={{ minHeight }}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2.5 text-white/40">
        {/* Killed by the global reduced-motion block. */}
        <Loader2 size={14} className="animate-spin" aria-hidden="true" />
        <span className="font-mono text-[9px] uppercase tracking-[0.22em]">{label}</span>
      </div>
    </div>
  );
}

/* ─── Save status ─────────────────────────────────────────────────────────
   A polite live region. Confident, never celebratory (motion.md) — a save
   that throws confetti is a save that does not trust itself. */

export function ReserveSaveStatus({
  state,
  className = "",
}: {
  state: "idle" | "saving" | "saved" | "error";
  className?: string;
}) {
  const copy = {
    idle: null,
    saving: "Saving",
    saved: "Saved",
    error: "Not saved — try again",
  }[state];

  return (
    <p
      className={`font-mono text-[9px] uppercase tracking-[0.18em] transition-opacity duration-300 ${className}`}
      style={{
        color:
          state === "error"
            ? alpha(RESERVE.red, 0.85)
            : state === "saved"
              ? alpha(RESERVE.green, 0.75)
              : "rgba(255,255,255,0.4)",
        opacity: copy ? 1 : 0,
      }}
      role="status"
      aria-live="polite"
    >
      {copy ?? " "}
    </p>
  );
}

/* ─── ReserveBottomSheet ──────────────────────────────────────────────────
   The mobile alternative to a giant modal. A sheet rather than a dialog
   because it keeps the member's context visible behind it, and because it
   opens within thumb reach.

   One modal primitive, two sides:
     bottom  (default) rises from the bottom edge; a centred panel from `sm`.
     left    a full-height drawer from the left edge — the phone navigation.

   Accessibility work this component does so no caller has to repeat it:
     - `role="dialog" aria-modal` with a labelled title
     - focus moves in on open and RETURNS to the opener on close
     - focus is trapped while open (Tab cycles, Shift+Tab reverses)
     - Escape closes; backdrop click closes
     - a sheet holding a changed form (`dirty`) never closes on a backdrop
       click; Escape, the X and a drag-dismiss ask first with an inline
       "Discard what you entered?" bar, and Discard closes
     - background scroll is locked while open
     - on phones a bottom sheet drags down to dismiss from its handle area:
       past a quarter of its height (capped) or on a quick flick it leaves,
       otherwise it springs back (thresholds in lib/ui/sheet-drag.ts). Under
       reduced motion it does not follow the finger; a qualifying drag
       closes it at once. The X, the backdrop and Escape remain. */

/* In-sheet Cancel / Done buttons close through the same guard as the X, so
   a changed form asks first wherever the member closes it from. */
const SheetCloseContext = React.createContext<(() => void) | null>(null);

/** The sheet's guarded close, for a Cancel button inside a ReserveBottomSheet
    (its children or footer). Null outside a sheet. */
export function useReserveSheetClose(): (() => void) | null {
  return React.useContext(SheetCloseContext);
}

/** Render-prop form of useReserveSheetClose, for a Cancel written inline in
    the component that renders the sheet. Falls back to `fallback` outside
    a sheet. */
export function ReserveSheetClose({
  fallback,
  children,
}: {
  fallback: () => void;
  children: (requestClose: () => void) => React.ReactNode;
}) {
  const requestClose = React.useContext(SheetCloseContext);
  return <>{children(requestClose ?? fallback)}</>;
}

export function ReserveBottomSheet({
  open,
  onClose,
  title,
  children,
  footer,
  accent = RESERVE.gold,
  side = "bottom",
  bare = false,
  dirty = false,
  onDiscard,
}: {
  open: boolean;
  /** Keep this stable (useCallback): the focus effect re-runs whenever its
      identity changes, and each re-run moves focus back to the panel. */
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  accent?: string;
  /** The edge the sheet belongs to. `left` is a full-height drawer. */
  side?: "bottom" | "left";
  /** For content that brings its own chrome (the Sidebar): no title bar and
      no padding. `title` still names the dialog, and a corner close control
      remains. */
  bare?: boolean;
  /** The sheet holds a form the member has changed. While true, an outside
      click does nothing and every other close gesture asks before discarding
      (FormCloseGuard). Absent or false: closing is unguarded. */
  dirty?: boolean;
  /** What Discard does when the form's state outlives the sheet and must be
      cleared as well as closed. Defaults to `onClose`. */
  onDiscard?: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLButtonElement>(null);
  const restoreTo = useRef<HTMLElement | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startY: number;
    offset: number;
    samples: Array<{ y: number; t: number }>;
    reduce: boolean;
  } | null>(null);

  const guard = useFormCloseGuard(dirty, onClose, { escape: false, backdropClosesWhenClean: true, onDiscard });
  /* Escape reads the guard through a ref so the focus effect below never
     re-runs (and yanks focus to the panel) when `dirty` flips. */
  const requestCloseRef = useRef(guard.requestCloseFrom);
  useEffect(() => {
    requestCloseRef.current = guard.requestCloseFrom;
  });
  /* A sheet that closes (saved, or closed by its caller) reopens without
     the discard bar. */
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (!open) guard.keepEditing();
  }

  const focusables = useCallback(
    () =>
      Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((el) => el.offsetParent !== null),
    [],
  );

  useEffect(() => {
    if (!open) return;

    restoreTo.current = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    /* Focus the panel itself rather than the first control: landing on a
       destructive-looking button is disorienting, and the title should be
       what the screen reader announces first. */
    panelRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        /* An open list inside the sheet (ReserveSelect) claims its own Escape. */
        if (e.defaultPrevented) return;
        e.preventDefault();
        requestCloseRef.current("escape");
        return;
      }
      if (e.key !== "Tab") return;

      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;

      if (e.shiftKey && (active === first || active === panelRef.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
      restoreTo.current?.focus();
    };
  }, [open, onClose, focusables]);

  /* The on-screen keyboard. A bottom sheet rides above it — its Save stays
     reachable — and the field being typed into is kept in view: when it is
     focused, and again whenever the keyboard or the viewport changes size. */
  const keyboard = useKeyboardViewport(open && side === "bottom");
  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;
    let frame = 0;
    const reveal = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const active = document.activeElement;
        if (isTextEntry(active) && panel.contains(active)) active.scrollIntoView({ block: "nearest", inline: "nearest" });
      });
    };
    reveal();
    panel.addEventListener("focusin", reveal);
    return () => {
      cancelAnimationFrame(frame);
      panel.removeEventListener("focusin", reveal);
    };
  }, [open, keyboard.inset, keyboard.visibleHeight]);

  /* Portaled to <body>: any ancestor with a filter, backdrop-filter or transform
     (GlassPanel, the view transition) would otherwise become the containing
     block for `position: fixed`, trapping the sheet inside a card and leaving
     the rest of the screen — including a docked action — operable. */
  if (!open || typeof document === "undefined") return null;

  const left = side === "left";
  const draggable = !left && !bare;

  /* ── Drag to dismiss (bottom sheets, phone layout only) ── */
  const setPanelMotion = (transform: string, transition: string, backdropOpacity: number) => {
    const panel = panelRef.current;
    if (panel) {
      panel.style.transition = transition;
      panel.style.transform = transform;
    }
    const backdrop = backdropRef.current;
    if (backdrop) {
      backdrop.style.transition = transition ? transition.replace("transform", "opacity") : "";
      backdrop.style.opacity = String(backdropOpacity);
    }
  };

  const onDragStart = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if ((event.target as HTMLElement).closest("button, a, input, select, textarea")) return;
    /* From `sm` the sheet is a centred panel with no handle. */
    if (!window.matchMedia("(max-width: 639px)").matches) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      offset: 0,
      samples: [{ y: event.clientY, t: event.timeStamp }],
      reduce: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    };
  };

  const onDragMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    drag.offset = Math.max(0, event.clientY - drag.startY);
    drag.samples.push({ y: event.clientY, t: event.timeStamp });
    if (drag.samples.length > 16) drag.samples.shift();
    const panel = panelRef.current;
    if (drag.reduce || !panel) return;
    const progress = Math.min(1, drag.offset / Math.max(1, panel.offsetHeight));
    setPanelMotion(`translate3d(0, ${drag.offset}px, 0)`, "", 1 - progress * 0.7);
  };

  const onDragEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    const panel = panelRef.current;
    if (!panel) return;
    const dismiss =
      event.type !== "pointercancel" &&
      shouldDismissSheet({
        offsetPx: drag.offset,
        velocityPxPerMs: releaseVelocity(drag.samples),
        sheetHeightPx: panel.offsetHeight,
      });

    if (dismiss && dirty) {
      /* A changed form springs back and asks first. */
      if (!drag.reduce) {
        setPanelMotion(
          "translate3d(0, 0, 0)",
          `transform ${RESERVE_MOTION.interface.enter}ms ${RESERVE_MOTION.easing.cinematic}`,
          1,
        );
      }
      guard.requestCloseFrom("drag");
      return;
    }
    if (drag.reduce) {
      if (dismiss) onClose();
      return;
    }
    if (!dismiss) {
      setPanelMotion(
        "translate3d(0, 0, 0)",
        `transform ${RESERVE_MOTION.interface.enter}ms ${RESERVE_MOTION.easing.cinematic}`,
        1,
      );
      return;
    }
    const exit = RESERVE_MOTION.interface.exit;
    setPanelMotion("translate3d(0, 100%, 0)", `transform ${exit}ms ${RESERVE_MOTION.easing.exit}`, 0);
    window.setTimeout(() => {
      onClose();
      /* A caller that keeps the sheet open gets it back rather than an
         invisible dialog. */
      requestAnimationFrame(() => {
        if (panelRef.current?.isConnected) setPanelMotion("", "", 1);
      });
    }, exit);
  };

  const dragHandlers = draggable
    ? {
        onPointerDown: onDragStart,
        onPointerMove: onDragMove,
        onPointerUp: onDragEnd,
        onPointerCancel: onDragEnd,
      }
    : {};

  /* The drawer slides; the bottom sheet's rendering is unchanged. The slide is
     CSS, not a JS loop: `starting:` compiles to @starting-style, so the
     drawer's first frame sits off-canvas and transitions in on insertion.
     Duration and easing are the motion tokens, inline — and the global
     prefers-reduced-motion block (`transition-duration: 0.001ms !important`)
     outranks an inline duration, so reduced motion gets no slide. */
  const drawerMotion: React.CSSProperties = {
    transitionDuration: `${RESERVE_MOTION.interface.enter}ms`,
    transitionTimingFunction: RESERVE_MOTION.easing.precise,
  };

  return createPortal(
    <SheetCloseContext.Provider value={guard.requestClose}>
    <div
      className={
        left
          ? "fixed inset-0 z-[100] flex"
          : "fixed inset-0 z-[100] flex items-end justify-center sm:items-center"
      }
      /* Lifted with a transform, not padding: it follows the keys up like a
         native sheet, and moves no layout on the way. */
      style={
        left
          ? undefined
          : {
              transform: keyboard.inset > 0 ? `translate3d(0, ${-keyboard.inset}px, 0)` : undefined,
              transition: `transform ${RESERVE_MOTION.interface.enter}ms ${RESERVE_MOTION.easing.precise}`,
            }
      }
      data-keyboard-inset={!left && keyboard.inset > 0 ? keyboard.inset : undefined}
    >
      <button
        ref={backdropRef}
        type="button"
        aria-label="Close"
        onClick={() => guard.requestCloseFrom("backdrop")}
        className={
          left
            ? "absolute inset-0 cursor-default transition-opacity starting:opacity-0"
            : "absolute inset-0 cursor-default"
        }
        style={{
          /* The page behind recedes: a deeper blur and a vignette, so the
             surface in front reads as lifted rather than pasted on. */
          background: "radial-gradient(120% 90% at 50% 100%, rgba(6,7,12,0.62), rgba(3,4,8,0.86))",
          backdropFilter: "blur(14px) saturate(115%)",
          WebkitBackdropFilter: "blur(14px) saturate(115%)",
          ...(left ? drawerMotion : {}),
        }}
        tabIndex={-1}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        /* The guard's current view of the form. A child reports its changes from an effect, so this
           commits a render after the field itself — a test waits on it before an outside click. */
        data-form-dirty={dirty ? "true" : "false"}
        tabIndex={-1}
        className={
          left
            ? /* Full height: the surface runs under the status bar and the home
                 indicator while its content keeps to the safe areas (Bible §06).
                 The menu swings in on its own hinge — the transform lives only
                 in the starting frame, so a drag still owns the settled one. */
              "safe-top safe-bottom relative flex h-full w-[min(86vw,320px)] flex-col overflow-hidden [transform-origin:left_center] transition-[transform,opacity] starting:opacity-0 starting:[transform:perspective(1200px)_translateX(-100%)_rotateY(9deg)]"
            : "safe-bottom relative flex max-h-[88dvh] w-full flex-col overflow-hidden [transform-origin:bottom_center] transition-[transform,opacity] starting:opacity-0 starting:[transform:perspective(1100px)_translateY(12%)_rotateX(5deg)_scale(0.985)] sm:max-w-[520px]"
        }
        style={
          left
            ? {
                borderTopLeftRadius: 0,
                borderTopRightRadius: RADIUS.surface,
                borderBottomLeftRadius: 0,
                borderBottomRightRadius: RADIUS.surface,
                /* Glass: the room's light passes through it (Bible §06 — the
                   rimless contract), with an inset ring instead of a drawn rim. */
                background: "linear-gradient(155deg, rgba(18,20,27,0.82) 0%, rgba(10,11,16,0.9) 100%)",
                backdropFilter: "blur(28px) saturate(135%)",
                WebkitBackdropFilter: "blur(28px) saturate(135%)",
                borderRight: "1px solid rgba(255,255,255,0.055)",
                boxShadow: "24px 0 90px rgba(0,0,0,0.72), inset 0 0 0 1px rgba(255,255,255,0.022)",
                ...drawerMotion,
              }
            : {
                borderTopLeftRadius: RADIUS.surface,
                borderTopRightRadius: RADIUS.surface,
                borderBottomLeftRadius: 0,
                borderBottomRightRadius: 0,
                background: "linear-gradient(168deg, rgba(18,20,27,0.84) 0%, rgba(10,11,16,0.92) 100%)",
                backdropFilter: "blur(28px) saturate(135%)",
                WebkitBackdropFilter: "blur(28px) saturate(135%)",
                border: "1px solid rgba(255,255,255,0.055)",
                boxShadow: "0 -28px 90px rgba(0,0,0,0.72), inset 0 0 0 1px rgba(255,255,255,0.022)",
                transitionDuration: `${RESERVE_MOTION.interface.enter}ms`,
                transitionTimingFunction: RESERVE_MOTION.easing.precise,
                /* Above the keyboard the sheet fits what is still visible, and
                   the home-indicator padding is the keyboard's to cover. */
                ...(keyboard.inset > 0
                  ? { maxHeight: `max(160px, calc(${keyboard.visibleHeight}px - max(12px, env(safe-area-inset-top, 0px))))`, paddingBottom: 0 }
                  : {}),
              }
        }
      >
        {/* Accent light on the leading edge: the edge that faces the page, with
            the room's light travelling slowly along it. The still gradient stays
            underneath, so reduced motion still gets a lit edge. */}
        <span
          className={
            left
              ? "pointer-events-none absolute inset-y-0 right-0 z-10 w-px overflow-hidden"
              : "pointer-events-none absolute inset-x-0 top-0 z-10 h-px overflow-hidden"
          }
          style={{
            background: `linear-gradient(${left ? "180deg" : "90deg"}, transparent, ${alpha(accent, 0.4)}, transparent)`,
          }}
          aria-hidden="true"
        >
          <span
            className={left ? "fba-edge-flow-y absolute inset-x-0 h-1/3" : "fba-edge-flow absolute inset-y-0 w-1/3"}
            style={{
              background: `linear-gradient(${left ? "180deg" : "90deg"}, transparent, ${alpha(accent, 0.95)}, transparent)`,
            }}
          />
        </span>

        {bare ? (
          /* Bare: the content brings its own chrome and its own scroll, so no
             title bar and no padding. The dialog keeps its name (`title`) and
             a corner close control — behind an aria-modal dialog the backdrop
             is out of reach for a touch screen-reader user, so without this
             button they would have no way out. */
          <div className="relative flex min-h-0 flex-1 flex-col">
            <button
              type="button"
              onClick={guard.requestClose}
              aria-label="Close"
              className="absolute right-1.5 top-1.5 z-10 grid min-h-[44px] min-w-[44px] place-items-center text-white/40 transition-colors hover:text-white/80"
            >
              <X size={16} aria-hidden="true" />
            </button>
            <DiscardChangesBar guard={guard} />
            {children}
          </div>
        ) : (
          <>
            {/* The whole header is the drag area on phones: the handle is the
                cue, but a thumb should not have to find a 36px sliver. It
                claims the gesture (touch-action: none) so the page does not
                scroll instead. Buttons inside it keep their taps. */}
            <div
              className="px-5 pb-3 pt-3 sm:pt-4"
              data-sheet-drag={draggable ? "" : undefined}
              style={draggable ? { touchAction: "none" } : undefined}
              {...dragHandlers}
            >
              {/* Grab handle — a bottom-sheet affordance, mobile only. */}
              {!left && (
                <span
                  className="mx-auto mb-2 block h-1 w-9 rounded-full bg-white/20 sm:hidden"
                  aria-hidden="true"
                />
              )}
              <div className="flex items-start justify-between gap-3">
                <h2 className="type-card-title min-w-0 pt-3 sm:pt-0" style={{ color: RESERVE.ivory }}>
                  {title}
                </h2>
                <button
                  type="button"
                  onClick={guard.requestClose}
                  aria-label="Close"
                  className="grid min-h-[44px] min-w-[44px] shrink-0 place-items-center text-white/40 transition-colors hover:text-white/80"
                >
                  <X size={16} aria-hidden="true" />
                </button>
              </div>
            </div>

            <DiscardChangesBar guard={guard} />
            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">{children}</div>
          </>
        )}

        {footer && (
          <div
            className="border-t px-5 py-3.5"
            style={{ borderColor: "rgba(255,255,255,0.05)" }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
    </SheetCloseContext.Provider>,
    document.body,
  );
}
