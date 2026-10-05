/* ────────────────────────────────────────────────────────────────────────────
   PHONE TABS — which rooms sit in the phone tab bar, and what goes to More.

   Pure data over the module registry: the tab bar and the More sheet read
   the same resolved groups the Sidebar does, so a room hidden for a member
   never becomes a tab, and a locked room stays locked in both places.
   ──────────────────────────────────────────────────────────────────────── */

import type { DashboardView } from "@/lib/athlete-store";
import type { NavGroupDef, ResolvedModule } from "./registry";

/** The five rooms, in tab order, with their short tab names. */
export const PHONE_TAB_ROOMS: ReadonlyArray<{ moduleId: string; tabLabel: string }> = [
  { moduleId: "dashboard", tabLabel: "Apex" },
  { moduleId: "training", tabLabel: "Training" },
  { moduleId: "nutrition", tabLabel: "Fuel" },
  { moduleId: "recovery", tabLabel: "Recovery" },
  { moduleId: "schedule-command", tabLabel: "Schedule" },
];

export type PhoneTab = ResolvedModule & { tabLabel: string };

export type ResolvedGroup = NavGroupDef & { items: ResolvedModule[] };

/**
 * Splits the member's resolved navigation into tabs and More.
 * A tab room the member cannot see (hidden by profile or a Settings switch)
 * is omitted rather than shown dead; it cannot appear in More either, because
 * it is not in the groups at all.
 */
export function resolvePhoneNavigation(groups: ResolvedGroup[]): {
  tabs: PhoneTab[];
  moreGroups: ResolvedGroup[];
} {
  const visible = new Map<string, ResolvedModule>();
  for (const group of groups) for (const item of group.items) visible.set(item.id, item);

  const tabs: PhoneTab[] = [];
  for (const room of PHONE_TAB_ROOMS) {
    const item = visible.get(room.moduleId);
    if (item) tabs.push({ ...item, tabLabel: room.tabLabel });
  }
  const tabIds = new Set(tabs.map((tab) => tab.id));

  const moreGroups = groups
    .map((group) => ({ ...group, items: group.items.filter((item) => !tabIds.has(item.id)) }))
    .filter((group) => group.items.length > 0);

  return { tabs, moreGroups };
}

/** Whether the view on screen is one of the tab rooms. */
export function isTabView(tabs: PhoneTab[], view: DashboardView): boolean {
  return tabs.some((tab) => tab.view === view);
}
