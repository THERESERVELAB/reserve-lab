"use client";

import { ChevronLeft, ChevronRight, Lock, ShieldCheck } from "lucide-react";

import { useAthleteDashboardStore } from "@/lib/athlete-store";
import { ReserveSignalGlow } from "./ui/reserve/ReserveSignal";
import { SubscriptionTier, tierRequiredFor } from "@/lib/saas-config";
import { FALLBACK_MODULE_ICON, MODULE_ICONS } from "./nav/module-icons";
import { useMemberNavGroups } from "./nav/useMemberNavGroups";

const TIER_BADGE_STYLE: Record<SubscriptionTier, { bg: string; border: string; color: string }> = {
  core:  { bg: "rgba(255,255,255,0.04)",  border: "rgba(255,255,255,0.07)",  color: "rgba(255,255,255,0.45)" },
  pro:   { bg: "rgba(213,177,95,0.08)",    border: "rgba(213,177,95,0.22)",   color: "rgba(213,177,95,0.75)" },
  elite: { bg: "rgba(213,177,95,0.16)",    border: "rgba(213,177,95,0.45)",   color: "#e8c87a" },
};

/** The persistent md+ navigation rail, collapsible to icons. Phones navigate
    with the tab bar and the More sheet instead (AppShell). */
export function Sidebar() {
  const activeView = useAthleteDashboardStore((s) => s.activeView);
  const setActiveView = useAthleteDashboardStore((s) => s.setActiveView);
  const collapsed = useAthleteDashboardStore((s) => s.sidebarCollapsed);
  const subscriptionTier = useAthleteDashboardStore((s) => s.subscriptionTier);
  const toggleSidebar = useAthleteDashboardStore((s) => s.toggleSidebar);

  // Single source of truth: the module registry decides what's visible/locked,
  // with the member's saved layout (pin + reorder) applied inside each group.
  const visibleGroups = useMemberNavGroups();

  return (
    <aside
      style={{
        width: collapsed ? 52 : 212,
        minWidth: collapsed ? 52 : 212,
        transition: "width 0.22s cubic-bezier(0.4,0,0.2,1), min-width 0.22s cubic-bezier(0.4,0,0.2,1)",
      }}
      /* Hidden below md by CSS, so a phone never paints the rail first and then
         drops it after hydration. */
      className="relative flex h-full flex-col overflow-hidden border-r border-white/[0.06] max-md:hidden"
    >
      <div className="absolute inset-0"
        style={{ background: "linear-gradient(180deg, #060709 0%, #07080c 100%)" }}
        aria-hidden="true" />

      {/* ── Brand ── */}
      <div className="relative flex flex-shrink-0 items-center gap-3 border-b border-white/[0.05] px-3"
        style={{ minHeight: 56 }}>
        <div className="relative flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-[#d5b15f]/28 bg-[#d5b15f]/10"
          style={{ boxShadow: "0 0 20px rgba(213,177,95,0.14)" }}>
          <ShieldCheck size={14} className="text-[#d5b15f]" />
          <span className="fba-pulse absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full border border-[#060709] bg-emerald-400" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-[#d5b15f]">
              Reserve Method
            </p>
            <p className="truncate font-mono text-[7.5px] uppercase tracking-[0.18em] text-white/25">
              Member OS · {subscriptionTier === "core" ? "Signature" : "Black"}
            </p>
          </div>
        )}
      </div>

      {/* ── Nav ── */}
      <nav className="relative flex-1 overflow-y-auto overflow-x-hidden py-2" aria-label="Main navigation">
        {visibleGroups.map(({ id, label, flagship, items }) => (
          <div key={id} className="mb-0.5">
            {collapsed ? (
              <div className="mx-3 my-2 h-px"
                style={{ background: flagship ? "rgba(213,177,95,0.18)" : "rgba(255,255,255,0.04)" }} />
            ) : (
              <div className="mb-1 mt-3 flex items-center gap-1.5 px-3">
                <p className="font-mono text-[7.5px] uppercase tracking-[0.24em]"
                  style={{ color: flagship ? "rgba(213,177,95,0.65)" : "rgba(255,255,255,0.22)" }}>
                  {label}
                </p>
                {flagship && (
                  <span className="rounded-md border px-1 py-px font-mono text-[6.5px] uppercase tracking-[0.18em]"
                    style={{
                      borderColor: "rgba(213,177,95,0.4)",
                      background: "rgba(213,177,95,0.14)",
                      color: "#e8c87a",
                    }}>
                    Signature
                  </span>
                )}
              </div>
            )}

            <ul className="flex flex-col gap-0.5 px-1.5">
              {items.map(({ id: moduleId, view, label: itemLabel, feature, locked }) => {
                const active = activeView === view;
                const Icon = MODULE_ICONS[moduleId] ?? FALLBACK_MODULE_ICON;
                const requiredTier = tierRequiredFor(feature);
                const tierBadge = TIER_BADGE_STYLE[requiredTier];

                return (
                  <li key={moduleId}>
                    <button
                      type="button"
                      onClick={() => setActiveView(view)}
                      title={collapsed ? itemLabel : undefined}
                      className={`group relative flex w-full items-center rounded-lg transition-all duration-150 ${
                        collapsed ? "justify-center px-0 py-2.5" : "gap-2.5 px-2.5 py-2"
                      } ${active ? "" : "hover:bg-white/[0.04]"}`}
                    >
                      {active && (
                        <>
                          <span className="absolute inset-0 rounded-lg bg-white/[0.035]" />
                          <span className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full" style={{ background: "#d5b15f" }} />
                        </>
                      )}

                      <span className={`relative flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg transition-all duration-150 ${
                        active ? "bg-[#d5b15f]/[0.12]" : "group-hover:bg-white/[0.04]"
                      }`}>
                        {/* Signal received: a log that landed in this room lights it once. */}
                        <ReserveSignalGlow matches={(room) => room === view} className="-inset-2" />
                        <Icon size={14} className={`relative transition-colors duration-150 ${active ? "text-[#d5b15f]" : "text-white/32 group-hover:text-white/65"}`} />
                      </span>

                      {!collapsed && (
                        <>
                          <span className={`flex-1 truncate text-left text-[11px] font-medium transition-colors duration-150 ${
                            active ? "text-[#d5b15f]" : "text-white/40 group-hover:text-white/72"
                          }`}>
                            {itemLabel}
                          </span>
                          {locked && (
                            <span className="rounded border px-1 py-0.5 font-mono text-[6.5px] uppercase tracking-wider"
                              style={{ borderColor: tierBadge.border, background: tierBadge.bg, color: tierBadge.color }}>
                              Black
                            </span>
                          )}
                        </>
                      )}
                      {collapsed && locked && (
                        <Lock size={9} className="absolute right-1 top-1"
                          style={{ color: requiredTier === "elite" ? "#e8c87a" : "rgba(213,177,95,0.5)" }} />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* ── Bottom: tier status ── */}
      <div className="relative border-t border-white/[0.05] p-2">
        {!collapsed && (
          <div className="mb-2 flex items-center gap-2 rounded-lg bg-white/[0.025] px-2.5 py-2">
            <span className="fba-pulse h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-400" />
            <span className="font-mono text-[7.5px] uppercase tracking-[0.18em] text-white/28">
              {subscriptionTier === "core" ? "Reserve Signature" : "Reserve Black"}
            </span>
          </div>
        )}
        <button type="button" onClick={toggleSidebar}
          className="flex min-h-[44px] w-full items-center justify-center rounded-lg py-1.5 text-white/45 transition-all duration-150 hover:bg-white/[0.04] hover:text-white/50"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
          {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </button>
      </div>
    </aside>
  );
}

export function CollapsibleSidebar() {
  return <Sidebar />;
}
