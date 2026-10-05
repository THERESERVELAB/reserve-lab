"use client";

import { ChevronDown, ChevronUp, LayoutList, Pin, RotateCcw } from "lucide-react";
import { useMemo } from "react";

import { useAthleteDashboardStore } from "@/lib/athlete-store";
import { isFeatureEnabled } from "@/lib/saas-config";
import {
  applyMemberModuleLayout,
  deriveProfilePath,
  resolveNavGroups,
} from "@/lib/modules/registry";

const GOLD = "#d5b15f";

/** Menu layout — reorder and pin the member's navigation. Order and pins are
    saved to the account layout and applied inside each nav group. */
export function MenuLayoutPanel() {
  const modulePreferences = useAthleteDashboardStore((s) => s.modulePreferences);
  const subscriptionTier = useAthleteDashboardStore((s) => s.subscriptionTier);
  const womens = useAthleteDashboardStore((s) => s.womens);
  const genderIdentity = useAthleteDashboardStore((s) => s.profile.coachingProfile?.genderIdentity);
  const setModuleOrder = useAthleteDashboardStore((s) => s.setModuleOrder);
  const toggleModulePin = useAthleteDashboardStore((s) => s.toggleModulePin);
  const resetModuleLayout = useAthleteDashboardStore((s) => s.resetModuleLayout);

  const profilePath = modulePreferences.profilePath ?? deriveProfilePath(genderIdentity);
  const womensEnabled = womens.enabled || genderIdentity === "female" || profilePath === "womens-performance";

  const groups = useMemo(
    () =>
      resolveNavGroups(
        {
          tier: subscriptionTier,
          profilePath,
          womensEnabled,
          enhancedLogOnly: modulePreferences.enhancedLogOnly,
          overrides: modulePreferences.overrides,
        },
        isFeatureEnabled,
      ).map((group) => ({
        ...group,
        items: applyMemberModuleLayout(group.items, modulePreferences.order ?? [], modulePreferences.pinned ?? []),
      })),
    [subscriptionTier, profilePath, womensEnabled, modulePreferences],
  );

  const hasCustomLayout = (modulePreferences.order?.length ?? 0) > 0 || (modulePreferences.pinned?.length ?? 0) > 0;

  function move(groupId: string, index: number, dir: -1 | 1) {
    const next = groups.map((g) => ({ id: g.id, ids: g.items.map((i) => i.id) }));
    const group = next.find((g) => g.id === groupId);
    if (!group) return;
    const target = index + dir;
    if (target < 0 || target >= group.ids.length) return;
    [group.ids[index], group.ids[target]] = [group.ids[target], group.ids[index]];
    setModuleOrder(next.flatMap((g) => g.ids));
  }

  return (
    /* No surface of its own: it sits inside the Settings "Modules" section,
       and a bordered card there would be a card in a card. */
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <LayoutList size={13} className="text-[#d5b15f]/70" aria-hidden="true" />
          <p className="text-[14px] font-semibold text-[#f2eee6]">Menu layout</p>
        </div>
        <button
          type="button"
          onClick={resetModuleLayout}
          disabled={!hasCustomLayout}
          title={hasCustomLayout ? undefined : "Your menu already uses the default order."}
          className="inline-flex min-h-[44px] items-center gap-1.5 px-2 font-mono text-[11px] uppercase tracking-[0.14em] text-white/55 transition hover:text-white/85 disabled:cursor-not-allowed disabled:opacity-35"
        >
          <RotateCcw size={12} aria-hidden="true" />Reset to default
        </button>
      </div>
      <p className="mt-1 max-w-[64ch] text-[12.5px] leading-[1.55] text-white/60">
        Put your most-used commands first. Pinned modules surface at the top of their section; order saves to your account layout.
      </p>

      <div className="mt-3 grid gap-x-8 gap-y-4 lg:grid-cols-2">
        {groups.map((group) => (
          <div key={group.id}>
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/45">{group.label}</p>
            <ul className="mt-1 flex flex-col divide-y divide-white/[0.05]">
              {group.items.map((item, index) => {
                const pinned = (modulePreferences.pinned ?? []).includes(item.id);
                return (
                  <li key={item.id} className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => toggleModulePin(item.id)}
                      className="grid h-11 w-11 flex-shrink-0 place-items-center transition"
                      title={pinned ? "Unpin" : "Pin to top of section"}
                      aria-label={pinned ? `Unpin ${item.label}` : `Pin ${item.label}`}
                      aria-pressed={pinned}
                    >
                      <Pin size={13} style={{ color: pinned ? GOLD : "rgba(255,255,255,0.3)", fill: pinned ? GOLD : "none" }} />
                    </button>
                    <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-[#f2eee6]/85">{item.label}</span>
                    <button
                      type="button"
                      onClick={() => move(group.id, index, -1)}
                      disabled={index === 0}
                      title={index === 0 ? "Already first in this section." : undefined}
                      className="grid h-11 w-11 place-items-center text-white/45 transition hover:text-white/80 disabled:opacity-20"
                      aria-label={`Move ${item.label} up`}
                    >
                      <ChevronUp size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(group.id, index, 1)}
                      disabled={index === group.items.length - 1}
                      title={index === group.items.length - 1 ? "Already last in this section." : undefined}
                      className="grid h-11 w-11 place-items-center text-white/45 transition hover:text-white/80 disabled:opacity-20"
                      aria-label={`Move ${item.label} down`}
                    >
                      <ChevronDown size={14} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
