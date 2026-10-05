import type { DashboardView } from "@/lib/athlete-store";
import { isFeatureEnabled, VIEW_FEATURE_MAP, type SubscriptionTier } from "@/lib/saas-config";

/* ════════════════════════════════════════════════════════════════════════
   SOURCE → VIEW — where an Apex link may go, and whether it opens.

   `sourceToView` maps a strategist signal source to its command view. The
   copy that lived in ApexCommandV2 switched on lowercase keys, but the
   strategist emits capitalised `SourceSystem` values ("Recovery",
   "Bloodwork"), so every Watch List link resolved to null and never
   rendered. It now matches the trimmed, lowercased source.

   `canAccessView` is the exact check ViewRouter makes before it renders a
   view: the view's feature from VIEW_FEATURE_MAP against the member's tier
   through isFeatureEnabled. The sidebar's lock reads the same pair through
   the module registry. Callers use it so an action never switches something
   on for a member whose destination would open locked.
   ════════════════════════════════════════════════════════════════════════ */

/** Map a strategist signal source (any letter case, padded or not) to its command view. */
export function sourceToView(source: string): DashboardView | null {
  switch (source.trim().toLowerCase()) {
    case "training": return "training";
    case "nutrition": return "nutrition";
    case "recovery": return "recovery";
    case "schedule": return "schedule-command";
    case "physique": return "physique";
    case "bloodwork": return "bloodwork";
    case "supplements":
    case "compound":
    case "compounds": return "supplements";
    default: return null;
  }
}

/** True when `value` names a view the router can render — for loosely typed targets such as `SystemSignal.target`. */
export function isDashboardView(value: string): value is DashboardView {
  return Object.prototype.hasOwnProperty.call(VIEW_FEATURE_MAP, value);
}

/** Whether a member on `tier` can open `view` — ViewRouter's gate as a pure function. */
export function canAccessView(tier: SubscriptionTier, view: DashboardView): boolean {
  return isFeatureEnabled(tier, VIEW_FEATURE_MAP[view]);
}
