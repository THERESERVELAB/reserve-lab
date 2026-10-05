"use client";

import { useAthleteDashboardStore } from "@/lib/athlete-store";
import { applyMemberModuleLayout, deriveProfilePath, resolveNavGroups } from "@/lib/modules/registry";
import type { ResolvedGroup } from "@/lib/modules/phone-tabs";
import { isFeatureEnabled } from "@/lib/saas-config";

/**
 * The member's navigation: registry visibility, tier locks and their saved
 * layout (pin + reorder). One resolver for every navigation surface — the
 * Sidebar, the phone tab bar and the More sheet — so they cannot disagree.
 */
export function useMemberNavGroups(): ResolvedGroup[] {
  const subscriptionTier = useAthleteDashboardStore((s) => s.subscriptionTier);
  const womens = useAthleteDashboardStore((s) => s.womens);
  const genderIdentity = useAthleteDashboardStore((s) => s.profile.coachingProfile?.genderIdentity);
  const modulePreferences = useAthleteDashboardStore((s) => s.modulePreferences);

  // Profile path drives which modules are relevant. Auto-derive from gender
  // identity until the member chooses a path explicitly in Settings.
  const profilePath = modulePreferences.profilePath ?? deriveProfilePath(genderIdentity);
  // Women's OS surfaces for opted-in members, the women's path, or female identity.
  const womensEnabled = womens.enabled || genderIdentity === "female" || profilePath === "womens-performance";

  return resolveNavGroups(
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
  }));
}
