"use client";

import React from "react";

import { RESERVE, alpha } from "@/lib/design/tokens";
import { ReserveCommandHeader, ReservePage } from "@/components/ui/reserve";

/* ════════════════════════════════════════════════════════════════════════
   VIEW SHELL — the header 27 destinations share.

   This is the single highest-leverage surface in the product: every change
   here lands on 27 screens at once. It was also, before this pass, the
   clearest example of the drift it now fixes — it hand-rolled its own
   title block (`text-2xl font-black uppercase`), its own gutters, its own
   chip, and its own footer panel, none of which used the shipped type ramp
   or the shipped surface primitive.

   It now composes from ReservePage + ReserveCommandHeader, so all 27 views
   inherit the hierarchy contract:

     WHISPER (label) → HERO (title) → COMMAND (command) → ACTION

   `command` and `action` are new and optional. Views that pass them get a
   real level 3 and level 4; views that do not are unchanged in behaviour
   and simply keep the whisper + hero they already had.
   ════════════════════════════════════════════════════════════════════════ */

export function ViewShell({
  accentColor = RESERVE.gold,
  badge,
  title,
  label,
  icon: Icon,
  children,
  disclaimer,
  command,
  action,
  roomHero = false,
}: {
  accentColor?: string;
  badge?: string;
  title: string;
  /** Level 2 — the whisper. Category or system status. */
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;
  children?: React.ReactNode;
  disclaimer?: string;
  /** Level 3 — the decision. One or two calm declarative lines. */
  command?: string;
  /** Level 4 — THE single primary action for this destination. */
  action?: React.ReactNode;
  /** The room renders its own hero statement: on phones the title steps down to a title line. */
  roomHero?: boolean;
}) {
  return (
    <ReservePage>
      <div className="relative">
        {/* The destination icon is atmosphere, not information — it sits
            behind the type at low opacity rather than competing beside it,
            and it is hidden from assistive tech because the title already
            names the room. */}
        <Icon
          size={72}
          className="pointer-events-none absolute -top-3 right-0 hidden sm:block"
          style={{ color: alpha(accentColor, 0.07) }}
          aria-hidden="true"
        />

        <ReserveCommandHeader
          whisper={badge ? `${label} · ${badge}` : label}
          hero={title}
          command={command}
          action={action}
          accent={accentColor}
          phone={roomHero ? "title" : "hero"}
        />
      </div>

      {children}

      {disclaimer && (
        /* Compliance copy is a footnote, not a panel. Giving it a surface
           made it compete with real content on every clinical screen. */
        <footer className="pt-1">
          <p className="max-w-[70ch] text-[10px] leading-5 text-white/30">{disclaimer}</p>
        </footer>
      )}
    </ReservePage>
  );
}

export function ComingSoonGrid({ items }: { items: string[] }) {
  return (
    <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <div key={item} className="rounded-[12px] bg-white/[0.02] p-4">
          <p className="text-[12.5px] font-semibold" style={{ color: RESERVE.ivory }}>
            {item}
          </p>
          <p className="mt-1 font-mono text-[8px] uppercase tracking-[0.2em] text-white/30">
            Ready to log
          </p>
        </div>
      ))}
    </div>
  );
}
