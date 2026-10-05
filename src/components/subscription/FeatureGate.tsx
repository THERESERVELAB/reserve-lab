"use client";

import { useAthleteDashboardStore } from "@/lib/athlete-store";
import { FeatureKey, isFeatureEnabled } from "@/lib/saas-config";
import { LockedPremiumModule } from "@/components/LockedPremiumModule";

export function FeatureGate({
  feature,
  children,
}: {
  feature: FeatureKey;
  children: React.ReactNode;
}) {
  const tier = useAthleteDashboardStore((s) => s.subscriptionTier);
  if (isFeatureEnabled(tier, feature)) return <>{children}</>;
  return <LockedPremiumModule feature={feature} />;
}
