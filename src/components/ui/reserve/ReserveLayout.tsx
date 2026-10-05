"use client";

import React, { useRef, useSyncExternalStore } from "react";

import { RESERVE, RESERVE_MOTION, alpha } from "@/lib/design/tokens";
import { useIsPhone } from "@/lib/hooks/useMediaQuery";

import { RESERVE_SHELL_SLOT_ID, ReserveShellPortal } from "./ReserveShellPortal";

/* ════════════════════════════════════════════════════════════════════════
   RESERVE LAYOUT PRIMITIVES — the screen grammar.

   Every Reserve screen composes from the same six levels (the hierarchy
   contract):

     1 ENVIRONMENT     the cinematic plate — owned by the shell
     2 IDENTITY        whisper: category / status
     3 PRIMARY MESSAGE the one thing the member needs to know
     4 PRIMARY ACTION  one unmistakable next move
     5 CURRENT STATE   the metrics that change the decision
     6 DETAILS         progressive disclosure

   Levels 2–4 are `ReserveCommandHeader`. Level 5 is `ReserveSection`.
   Level 6 is `ReserveDisclosure`.

   The rhythm here is deliberately NON-UNIFORM (spacing.md rule 2): section
   gaps step rather than repeat, because uniform spacing flattens hierarchy
   and is what makes a screen read as a wall of cards.
   ════════════════════════════════════════════════════════════════════════ */

/* ─── ReservePage ─────────────────────────────────────────────────────────
   The page container. 12px mobile gutters are a rimless-surface decision
   (Bible §06) — panels must read as part of the display, not boxes on a
   page. `max-w` keeps a 1440px desktop from stretching a measure to the
   point where the eye loses the line. */

export function ReservePage({
  children,
  className = "",
  /** `wide` for command boards and rails; `reading` for text-led surfaces. */
  width = "wide",
}: {
  children: React.ReactNode;
  className?: string;
  width?: "wide" | "reading";
}) {
  return (
    <div
      /* Rhythm is STEPPED, not uniform — uniform gaps flatten hierarchy
         (spacing.md rule 2).

         This originally used `clamp(20px, 2.4vw, 34px)`, which was wrong: at
         375–430px, 2.4vw is 9–10px, so the clamp pinned to its 20px floor and
         produced identical spacing at every phone width. The stepped rhythm
         the comment promised only existed above ~833px — i.e. it was flat on
         exactly the viewports that need hierarchy most.

         Breakpoint steps do what the clamp claimed to: the gap grows with
         available room, and the child-based rule below gives the command
         header more clearance than any later section, so the header reads as
         the subject rather than as the first card. */
      className={`fba-page mx-auto flex w-full flex-col gap-5 px-3 pb-10 pt-4 sm:gap-6 sm:px-5 sm:pt-5 lg:gap-8 ${
        width === "wide" ? "max-w-[1400px]" : "max-w-[900px]"
      } ${className}`}
    >
      {children}
    </div>
  );
}

/* ─── ReserveCommandHeader ────────────────────────────────────────────────
   Levels 2 → 3 → 4, in the one order the Bible permits:
   WHISPER → HERO → COMMAND. Never Command above Hero.

   This component is the reason a screen can stop hand-rolling its own
   title block, and it is where the "one dominant action" rule is physically
   enforced: `action` is a single node, not an array. */

export function ReserveCommandHeader({
  whisper,
  hero,
  command,
  action,
  meta,
  accent = RESERVE.gold,
  size = "page",
  phone = "hero",
}: {
  /** Level 2 — category or status. Two or three words. */
  whisper: string;
  /** Level 3 — the statement the screen is designed around. */
  hero: string;
  /** Level 4 — the decision, in calm declarative language. One or two lines. */
  command?: string;
  /** The single primary action. One node — the type is the rule. */
  action?: React.ReactNode;
  /** Small supporting facts that sit beside the hero, never above it. */
  meta?: React.ReactNode;
  accent?: string;
  /** `page` for a destination; `panel` for a major region inside one. */
  size?: "page" | "panel";
  /**
   * How the header reads below `md`. `hero` keeps the full header. `title`
   * is for a room whose own hero carries the statement: the h1 steps down to
   * a small title line and the command line waits for wider screens, so the
   * phone shows one big headline, not two (typography.md: no second hero).
   */
  phone?: "hero" | "title";
}) {
  const titleLine = phone === "title";
  return (
    <header className="relative">
      <p
        className="font-mono uppercase"
        style={{
          fontSize: size === "page" ? "9px" : "8px",
          letterSpacing: "0.3em",
          color: alpha(accent, 0.7),
        }}
      >
        {whisper}
      </p>

      <h1
        /* `!` is required: `.type-hero` is unlayered CSS and outranks a layered utility. */
        className={`${size === "page" ? "type-hero" : "type-page-title"} ${
          titleLine ? "mt-1.5 max-md:text-[20px]! max-md:leading-[1.1]! max-md:tracking-[-0.01em]! md:mt-2.5" : "mt-2.5"
        }`}
        style={{ color: RESERVE.ivory }}
      >
        {hero}
      </h1>

      {command && (
        <p className={`type-command mt-3 max-w-[54ch] ${titleLine ? "hidden md:block" : ""}`}>{command}</p>
      )}

      {(action || meta) && (
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {action && <div className="order-1 sm:order-2">{action}</div>}
          {meta && <div className="order-2 min-w-0 sm:order-1">{meta}</div>}
        </div>
      )}
    </header>
  );
}

/* ─── ReserveSectionHeader ────────────────────────────────────────────────
   A section label that separates with LIGHT rather than a drawn border —
   the hairline fades to transparent at both ends, so nothing on the screen
   ever reads as a table rule. */

export function ReserveSectionHeader({
  label,
  action,
  accent = RESERVE.slate,
}: {
  label: string;
  action?: React.ReactNode;
  accent?: string;
}) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <h2
        /* min-w-0: a long label (a readiness count riding on the title) wraps on a 375px phone instead of running past the edge. */
        className="min-w-0 font-mono text-[9px] uppercase tracking-[0.26em]"
        style={{ color: alpha(accent, 0.75) }}
      >
        {label}
      </h2>
      <span
        className="h-px flex-1"
        style={{
          background:
            "linear-gradient(90deg, rgba(255,255,255,0.09), rgba(255,255,255,0.01))",
        }}
        aria-hidden="true"
      />
      {action}
    </div>
  );
}

/* ─── ReserveSection ──────────────────────────────────────────────────────
   A labelled region. Note what it does NOT do: it draws no surface of its
   own. A section is a grouping in the type and spacing, not another box —
   this is the component that prevents card-inside-card. */

export function ReserveSection({
  label,
  action,
  accent,
  children,
  className = "",
}: {
  label?: string;
  action?: React.ReactNode;
  accent?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={className}>
      {label && <ReserveSectionHeader label={label} action={action} accent={accent} />}
      {children}
    </section>
  );
}

/* ─── ReserveDisclosure ───────────────────────────────────────────────────
   Level 6. Native <details>/<summary>, so it is keyboard-operable and
   screen-reader-correct with no ARIA: the open state is still the element's
   own, and Enter/Space on the summary still toggle it.

   It opens and closes with a short height + opacity motion (interface
   tokens) instead of snapping. The summary's click is taken over only to
   run that motion; a click mid-motion reverses from where it is. Under
   reduced motion, or without the Web Animations API, the click is left
   alone and the native toggle is instant.

   This is the component that makes the information-density target
   achievable without deleting anything: detail moves BEHIND the summary
   rather than off the screen. */

export function ReserveDisclosure({
  summary,
  children,
  accent = RESERVE.slate,
  defaultOpen = false,
}: {
  summary: string;
  children: React.ReactNode;
  accent?: string;
  defaultOpen?: boolean;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const motionRef = useRef<{ animation: Animation; closing: boolean } | null>(null);

  const onSummaryClick = (event: React.MouseEvent<HTMLElement>) => {
    const details = detailsRef.current;
    const body = bodyRef.current;
    if (!details || !body || typeof body.animate !== "function") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    event.preventDefault();

    const running = motionRef.current;
    const showing = details.open && !running?.closing;
    /* Read the in-flight values before cancelling, so a reversal starts
       exactly where the body is. A closed body measures 0. */
    const fromHeight = body.getBoundingClientRect().height;
    const fromOpacity = running ? Number(getComputedStyle(body).opacity) : showing ? 1 : 0;
    running?.animation.cancel();
    body.style.overflow = "hidden";

    const settle = () => {
      motionRef.current = null;
      body.style.overflow = "";
    };

    if (showing) {
      details.setAttribute("data-closing", "");
      const animation = body.animate(
        [
          { height: `${fromHeight}px`, opacity: fromOpacity },
          { height: "0px", opacity: 0 },
        ],
        { duration: RESERVE_MOTION.interface.exit, easing: RESERVE_MOTION.easing.precise },
      );
      motionRef.current = { animation, closing: true };
      animation.onfinish = () => {
        details.open = false;
        details.removeAttribute("data-closing");
        settle();
      };
      return;
    }

    details.removeAttribute("data-closing");
    details.open = true;
    const toHeight = body.scrollHeight;
    const animation = body.animate(
      [
        { height: `${fromHeight}px`, opacity: fromOpacity },
        { height: `${toHeight}px`, opacity: 1 },
      ],
      { duration: RESERVE_MOTION.interface.enter, easing: RESERVE_MOTION.easing.precise },
    );
    motionRef.current = { animation, closing: false };
    animation.onfinish = settle;
  };

  return (
    <details ref={detailsRef} className="fba-disclosure group" open={defaultOpen}>
      <summary
        onClick={onSummaryClick}
        className="flex min-h-[44px] cursor-pointer list-none items-center gap-2 font-mono text-[9px] uppercase tracking-[0.2em] transition-colors duration-150 hover:brightness-125"
        style={{ color: alpha(accent, 0.7) }}
      >
        <span className="fba-disclosure-caret" aria-hidden="true">
          ›
        </span>
        {summary}
      </summary>
      {/* Padding, not margin, so the animated height includes the gap. */}
      <div ref={bodyRef}>
        <div className="pt-3">{children}</div>
      </div>
    </details>
  );
}

/* ─── ReserveActionBar ────────────────────────────────────────────────────
   Sticky bottom action rail. On mobile this is what puts the primary move
   inside thumb reach instead of at the end of a long scroll.

   On phones (`dock="phone"`, the default) the bar leaves the page and docks
   in the shell's bottom slot, which sits directly above the tab bar in the
   shell's fixed bottom stack: always within thumb reach, never under the
   tabs, and stepping aside with them while a sheet is open. The tab bar
   owns the bottom safe area, so the docked bar does not repeat it.
   Everywhere else — and wherever no shell dock exists, so the action can
   never vanish — it is the in-flow sticky bar, which keeps `.safe-bottom`
   for itself (and on a phone stops above the tab bar). */

/* Feathered, not a hard edge — the bar emerges from the environment rather
   than sitting on it as a second surface. */
const ACTION_BAR_FEATHER =
  "linear-gradient(180deg, rgba(7,8,12,0) 0%, rgba(7,8,12,0.86) 42%, rgba(7,8,12,0.97) 100%)";

/* The dock element never changes identity while the shell is mounted, so
   there is nothing to subscribe to (the ReserveShellPortal contract). */
const subscribeToNothing = () => () => undefined;
const readDockHost = () => document.getElementById(RESERVE_SHELL_SLOT_ID.dock);
const readServerDockHost = () => null;

export function ReserveActionBar({
  children,
  className = "",
  dock = "phone",
}: {
  children: React.ReactNode;
  className?: string;
  /** `phone`: below `md`, dock at the true bottom of the screen.
      `never`: always the in-flow sticky bar. */
  dock?: "phone" | "never";
}) {
  const isPhone = useIsPhone();
  const dockHost = useSyncExternalStore(subscribeToNothing, readDockHost, readServerDockHost);

  if (dock === "phone" && isPhone && dockHost) {
    return (
      <ReserveShellPortal slot="dock">
        {/* Static, not sticky: the dock already is the bottom of the screen. */}
        <div
          className={`px-3 pb-3 pt-3 sm:px-5 ${className}`}
          style={{ background: ACTION_BAR_FEATHER, backdropFilter: "blur(12px)" }}
        >
          <div className="mx-auto flex max-w-[1400px] items-center gap-2.5">{children}</div>
        </div>
      </ReserveShellPortal>
    );
  }

  return (
    <div
      className={`fba-actionbar-sticky safe-bottom sticky bottom-0 z-30 -mx-3 mt-2 px-3 pb-3 pt-3 sm:-mx-5 sm:px-5 ${className}`}
      style={{ background: ACTION_BAR_FEATHER, backdropFilter: "blur(12px)" }}
    >
      <div className="mx-auto flex max-w-[1400px] items-center gap-2.5">{children}</div>
    </div>
  );
}

/* ─── ReserveContentRail ──────────────────────────────────────────────────
   Horizontal sequence (week rails, timelines) that scrolls inside its own
   track. The page body must never scroll sideways — `.fba-rail` contains
   the overscroll so a swipe cannot chain out to the document. */

export function ReserveContentRail({
  children,
  className = "",
  label,
}: {
  children: React.ReactNode;
  className?: string;
  /** Accessible name — a scrollable region needs one to be reachable. */
  label: string;
}) {
  return (
    <div
      className={`fba-rail -mx-3 flex gap-2.5 px-3 pb-1 sm:mx-0 sm:px-0 ${className}`}
      role="group"
      aria-label={label}
      /* Keyboard users must be able to scroll the rail without a pointer. */
      tabIndex={0}
    >
      {children}
    </div>
  );
}
