"use client";

import { Crown, Lock, ShieldCheck, Sparkles } from "lucide-react";
import { useEffect } from "react";

import {
  FEATURE_DEFINITIONS,
  FeatureKey,
  SubscriptionTier,
  SUBSCRIPTION_TIERS,
  tierRequiredFor,
} from "@/lib/saas-config";
import { useAthleteDashboardStore } from "@/lib/athlete-store";
import { sceneForKey } from "@/lib/brand/visuals";
import { useUpgradeCheckout } from "./subscription/useUpgradeCheckout";
import { GlassPanel } from "./ui/GlassPanel";

type LockedPremiumModuleProps = {
  feature: FeatureKey;
  compact?: boolean;
};

const TIER_TREATMENT: Record<SubscriptionTier, {
  accent: string;
  glow: string;
  background: string;
  badgeLabel: string;
  ctaShadow: string;
}> = {
  core: {
    accent: "#5fb7d5",
    glow: "rgba(95,183,213,0.18)",
    background: "radial-gradient(ellipse at top left, rgba(95,183,213,0.06) 0%, transparent 60%)",
    badgeLabel: "Reserve Signature",
    ctaShadow: "0 0 20px rgba(95,183,213,0.18)",
  },
  pro: {
    accent: "#d5b15f",
    glow: "rgba(213,177,95,0.24)",
    background: "radial-gradient(ellipse at top left, rgba(213,177,95,0.08) 0%, transparent 60%)",
    badgeLabel: "Reserve Black",
    ctaShadow: "0 0 24px rgba(213,177,95,0.24)",
  },
  elite: {
    accent: "#e8c87a",
    glow: "rgba(213,177,95,0.38)",
    background: "radial-gradient(ellipse at 14% 50%, rgba(213,177,95,0.12) 0%, transparent 55%)",
    badgeLabel: "Reserve Black",
    ctaShadow: "0 0 36px rgba(213,177,95,0.38)",
  },
};

export function LockedPremiumModule({ feature, compact = false }: LockedPremiumModuleProps) {
  const recordUpgradeIntent = useAthleteDashboardStore((s) => s.recordUpgradeIntent);
  const { startCheckout, pending, error } = useUpgradeCheckout();
  const definition = FEATURE_DEFINITIONS[feature];
  const requiredTier = tierRequiredFor(feature);
  const requiredTierConfig = SUBSCRIPTION_TIERS[requiredTier];
  const tier = TIER_TREATMENT[requiredTier];
  const isElite = requiredTier === "elite";

  useEffect(() => {
    recordUpgradeIntent({ feature, requiredTier, source: "locked-module" });
  }, [feature, recordUpgradeIntent, requiredTier]);

  return (
    <div className={compact ? "" : "flex min-h-full items-center justify-center p-5"}>
      <GlassPanel accent={tier.accent} className={compact ? "w-full" : "w-full max-w-2xl"}>
        {/* Reserve scene plate — heavily scrimmed so copy and CTA stay primary. */}
        <div
          className="pointer-events-none absolute inset-0 bg-cover bg-[center_22%] opacity-[0.22]"
          style={{ backgroundImage: `url(${sceneForKey(feature)})` }}
        />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(5,6,10,0.55)_0%,rgba(5,6,10,0.82)_100%)]" />
        <div className="pointer-events-none absolute inset-0 rounded-2xl" style={{ background: tier.background }} />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-start">
          <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl border"
            style={{
              borderColor: `${tier.accent}38`,
              background: `${tier.accent}14`,
              color: tier.accent,
              boxShadow: `0 0 28px ${tier.glow}`,
            }}>
            {isElite ? <Crown size={20} /> : <Lock size={18} />}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border px-2.5 py-1 font-mono text-[8px] uppercase tracking-[0.2em]"
                style={{ borderColor: `${tier.accent}38`, background: `${tier.accent}14`, color: tier.accent }}>
                {tier.badgeLabel}
              </span>
              <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 font-mono text-[8px] uppercase tracking-[0.2em] text-white/40">
                {requiredTierConfig.price}
              </span>
              {isElite && (
                <span className="inline-flex items-center gap-1 rounded-full border border-[#d5b15f]/30 bg-[#d5b15f]/[0.1] px-2.5 py-1 font-mono text-[8px] uppercase tracking-[0.2em] text-[#d5b15f]/85">
                  <Sparkles size={9} /> Flagship Tier
                </span>
              )}
            </div>

            <h1 className={`mt-4 font-black uppercase tracking-tight text-[#f2eee6] ${compact ? "text-lg" : "text-2xl"}`}>
              {definition.label}
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-white/45">
              {definition.description}
            </p>

            <div className="mt-5 rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4">
              <div className="flex items-start gap-2">
                <ShieldCheck size={14} className="mt-0.5 flex-shrink-0" style={{ color: `${tier.accent}b3` }} />
                <p className="text-xs leading-5 text-white/38">
                  {isElite
                    ? "Reserve Black unlocks the full private command system — Personal Command, advanced protocols, physique cockpit, biomarker log, peak workflows, and the AI Strategist. Observational-only architecture."
                    : `${requiredTierConfig.label} keeps THE RESERVE METHOD in tracking, education, and trend-observation mode. No medical advice generated.`}
                </p>
              </div>
            </div>

            {/* Real Stripe Checkout. This is the unlock button on EVERY gated
                module, and it previously called setSubscriptionTier(requiredTier)
                — one click opened the whole paywall for free, persisted, and
                synced across the member's devices. The upgrade-intent analytics
                still fire; only the free grant is gone. */}
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                recordUpgradeIntent({ feature, requiredTier, source: "locked-module" });
                void startCheckout(requiredTier);
              }}
              className="mt-5 inline-flex min-h-[44px] items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                borderColor: `${tier.accent}38`,
                background: `${tier.accent}14`,
                color: tier.accent,
                boxShadow: tier.ctaShadow,
              }}>
              {isElite ? <Crown size={14} /> : <Sparkles size={14} />}
              {/* "Preview" described the old free grant. It now charges, so the
                  label has to say so — and name the price, because a member
                  should never be surprised by what a button costs. */}
              {pending
                ? "Opening checkout…"
                : `Upgrade to ${requiredTierConfig.label} · ${requiredTierConfig.price}`}
            </button>

            {error && (
              <p role="alert" className="mt-2.5 text-[11px] leading-[1.5] text-[#ef7d55]">
                {error}
              </p>
            )}
          </div>
        </div>
      </GlassPanel>
    </div>
  );
}
