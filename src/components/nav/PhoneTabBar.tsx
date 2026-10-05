"use client";

import { Ellipsis, Lock } from "lucide-react";

import type { DashboardView } from "@/lib/athlete-store";
import type { PhoneTab } from "@/lib/modules/phone-tabs";
import { RESERVE } from "@/lib/design/tokens";
import { ReserveSignalGlow, ReserveSignalTrace } from "@/components/ui/reserve/ReserveSignal";

import { FALLBACK_MODULE_ICON, MODULE_ICONS } from "./module-icons";

/* ════════════════════════════════════════════════════════════════════════
   PHONE TAB BAR — the five rooms and More, within thumb reach.

   Rendered on every width and hidden from `md` up by CSS, so a phone's first
   paint already has it (a media-query hook would add it a frame late and
   shift the page). It lives in the shell's fixed bottom stack, under any
   docked action, and the stack hides while a sheet or drawer is open.

   A room the member cannot see is not a tab. A locked room stays a tab and
   opens its locked screen, which says why — never a dead tab.
   ════════════════════════════════════════════════════════════════════════ */

export function PhoneTabBar({
  tabs,
  activeView,
  moreOpen,
  moreHoldsActive,
  onSelect,
  onOpenMore,
}: {
  tabs: PhoneTab[];
  activeView: DashboardView;
  moreOpen: boolean;
  /** The room on screen lives in More, so More carries the marker. */
  moreHoldsActive: boolean;
  onSelect: (view: DashboardView) => void;
  onOpenMore: () => void;
}) {
  return (
    <nav
      aria-label="Rooms"
      data-shell="tab-bar"
      className="relative border-t border-white/[0.06] bg-[#08090e] pb-[env(safe-area-inset-bottom,0px)] md:hidden"
      style={{ boxShadow: "inset 0 1px 0 rgba(213,177,95,0.07)" }}
    >
      {/* Signal received: a member's log runs a light along the bar's top edge. */}
      <ReserveSignalTrace placement="edge" />
      <ul className="safe-x mx-auto flex max-w-[560px]">
        {tabs.map((tab) => {
          const active = tab.view === activeView;
          const Icon = MODULE_ICONS[tab.id] ?? FALLBACK_MODULE_ICON;
          return (
            <li key={tab.id} className="min-w-0 flex-1">
              <TabButton
                glow={(room) => room === tab.view}
                active={active}
                label={tab.tabLabel}
                accessibleName={tab.locked ? `${tab.tabLabel}, requires Reserve Black` : undefined}
                ariaCurrent={active ? "page" : undefined}
                onClick={() => onSelect(tab.view)}
                icon={<Icon size={19} strokeWidth={active ? 2 : 1.6} aria-hidden="true" />}
                badge={tab.locked ? <Lock size={9} aria-hidden="true" /> : null}
              />
            </li>
          );
        })}
        <li className="min-w-0 flex-1">
          <TabButton
            /* A log that landed in a room without a tab lights More, where that room lives. */
            glow={(room) => !tabs.some((tab) => tab.view === room)}
            active={moreOpen || moreHoldsActive}
            label="More"
            ariaHasPopup="dialog"
            ariaExpanded={moreOpen}
            onClick={onOpenMore}
            icon={<Ellipsis size={19} strokeWidth={moreOpen || moreHoldsActive ? 2 : 1.6} aria-hidden="true" />}
          />
        </li>
      </ul>
    </nav>
  );
}

function TabButton({
  glow,
  active,
  label,
  accessibleName,
  ariaCurrent,
  ariaHasPopup,
  ariaExpanded,
  onClick,
  icon,
  badge = null,
}: {
  /** Which rooms' logs light this tab (signal received). */
  glow: (room: DashboardView) => boolean;
  active: boolean;
  label: string;
  accessibleName?: string;
  ariaCurrent?: "page";
  ariaHasPopup?: "dialog";
  ariaExpanded?: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  badge?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={accessibleName}
      aria-current={ariaCurrent}
      aria-haspopup={ariaHasPopup}
      aria-expanded={ariaExpanded}
      data-active={active || undefined}
      className="fba-press relative flex h-14 w-full flex-col items-center justify-center gap-1 px-1 transition-colors duration-200"
      style={{ color: active ? RESERVE.gold : "rgba(255,255,255,0.55)" }}
    >
      {/* The active marker: a short gold light on the bar's top edge. */}
      <span
        className="absolute left-1/2 top-0 h-[2px] w-5 -translate-x-1/2 rounded-full transition-opacity duration-200"
        style={{
          background: RESERVE.gold,
          boxShadow: "0 0 10px rgba(213,177,95,0.55)",
          opacity: active ? 1 : 0,
        }}
        aria-hidden="true"
      />
      <span className="relative">
        <ReserveSignalGlow matches={glow} className="-inset-3" />
        {icon}
        {badge && (
          <span className="absolute -right-2 -top-1" style={{ color: "rgba(213,177,95,0.7)" }}>
            {badge}
          </span>
        )}
      </span>
      <span className="max-w-full truncate text-[10.5px] font-medium leading-none tracking-[0.01em]">{label}</span>
    </button>
  );
}
