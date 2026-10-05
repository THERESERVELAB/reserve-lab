"use client";

import { ArrowRight, Lock, Pause, Play } from "lucide-react";

import { SyncStatusChip } from "@/components/sync/SyncStatusChip";
import { ReserveBottomSheet } from "@/components/ui/reserve/ReserveSurfaces";
import type { DashboardView } from "@/lib/athlete-store";
import { canAccessCoachCommand } from "@/lib/coaching/entitlements";
import { currentCoachingMember, useCoachingStore } from "@/lib/coaching/store";
import { RESERVE } from "@/lib/design/tokens";
import type { ResolvedGroup } from "@/lib/modules/phone-tabs";
import { useAmbientMotionStore } from "@/lib/ui/ambient-motion-store";

import { FALLBACK_MODULE_ICON, MODULE_ICONS } from "./module-icons";

/* ════════════════════════════════════════════════════════════════════════
   MORE — every destination that is not a tab, plus the shell's controls.

   Same registry, visibility and tier locks as the Sidebar (the groups come
   from one resolver). The phone top bar holds only the avatar, so what used
   to crowd it lives here: the Coach Command switch, sync status, and the
   background-motion pause — which must stay reachable (WCAG 2.2.2).
   ════════════════════════════════════════════════════════════════════════ */

export function MoreSheet({
  open,
  onClose,
  groups,
  activeView,
  onNavigate,
}: {
  open: boolean;
  /** Keep stable (useCallback) — see ReserveBottomSheet. */
  onClose: () => void;
  groups: ResolvedGroup[];
  activeView: DashboardView;
  onNavigate: (view: DashboardView) => void;
}) {
  const coachingMember = useCoachingStore(currentCoachingMember);
  const setWorkspace = useCoachingStore((s) => s.setWorkspace);
  const coachEligible = canAccessCoachCommand(coachingMember);
  const motionPaused = useAmbientMotionStore((s) => s.paused);
  const motionAvailable = useAmbientMotionStore((s) => s.available);
  const toggleMotion = useAmbientMotionStore((s) => s.togglePaused);
  const motionLabel = motionPaused ? "Play background motion" : "Pause background motion";

  return (
    <ReserveBottomSheet
      open={open}
      onClose={onClose}
      title="More"
      footer={
        <div className="flex min-h-[44px] items-center justify-between gap-3">
          <SyncStatusChip showLabel />
          {motionAvailable && (
            <button
              type="button"
              onClick={toggleMotion}
              aria-label={motionLabel}
              className="fba-press -mr-2 flex min-h-[44px] items-center gap-2 rounded-[10px] px-2 text-[12px] font-medium text-white/65 transition-colors hover:text-white/90"
            >
              {motionPaused ? <Play size={13} aria-hidden="true" /> : <Pause size={13} aria-hidden="true" />}
              {motionLabel}
            </button>
          )}
        </div>
      }
    >
      <div className="flex flex-col gap-5 pb-1">
        {coachEligible && (
          <button
            type="button"
            onClick={() => {
              onClose();
              setWorkspace("coach");
            }}
            className="fba-press -mx-2 flex min-h-[48px] items-center justify-between gap-3 rounded-[12px] px-3 text-left"
            style={{ background: "rgba(213,177,95,0.06)" }}
          >
            <span className="min-w-0">
              <span className="block font-mono text-[9px] uppercase tracking-[0.2em]" style={{ color: RESERVE.gold }}>
                Coach Command
              </span>
              <span className="mt-0.5 block text-[12px] text-white/55">Switch to your coaching workspace</span>
            </span>
            <ArrowRight size={14} className="shrink-0" style={{ color: RESERVE.gold }} aria-hidden="true" />
          </button>
        )}

        {groups.map((group) => {
          const headingId = `more-group-${group.id}`;
          return (
            <section key={group.id} aria-labelledby={headingId}>
              <h3
                id={headingId}
                className="mb-1 font-mono text-[9px] uppercase tracking-[0.24em]"
                style={{
                  color: group.flagship ? "rgba(213,177,95,0.7)" : "rgba(255,255,255,0.4)",
                }}
              >
                {group.label}
              </h3>
              <ul className="-mx-2 grid grid-cols-2 gap-x-1">
                {group.items.map((item) => {
                  const active = item.view === activeView;
                  const Icon = MODULE_ICONS[item.id] ?? FALLBACK_MODULE_ICON;
                  return (
                    <li key={item.id} className="min-w-0">
                      <button
                        type="button"
                        onClick={() => onNavigate(item.view)}
                        aria-current={active ? "page" : undefined}
                        aria-label={item.locked ? `${item.label}, requires Reserve Black` : undefined}
                        className="fba-press flex min-h-[44px] w-full items-center gap-2.5 rounded-[10px] px-2 text-left transition-colors duration-150"
                        style={{ background: active ? "rgba(255,255,255,0.04)" : undefined }}
                      >
                        {/* A lock on the icon's corner rather than the rail's
                            "Black" badge: two columns cannot spare the width
                            without cutting room names. The requirement is in
                            the button's accessible name. */}
                        <span className="relative shrink-0">
                          <Icon
                            size={15}
                            aria-hidden="true"
                            className={active ? "text-[#d5b15f]" : "text-white/40"}
                          />
                          {item.locked && (
                            <Lock
                              size={8}
                              className="absolute -right-1.5 -top-1.5"
                              style={{ color: "rgba(213,177,95,0.75)" }}
                              aria-hidden="true"
                            />
                          )}
                        </span>
                        <span
                          className="min-w-0 flex-1 truncate text-[13px] font-medium"
                          style={{ color: active ? RESERVE.gold : "rgba(255,255,255,0.72)" }}
                        >
                          {item.label}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </ReserveBottomSheet>
  );
}
