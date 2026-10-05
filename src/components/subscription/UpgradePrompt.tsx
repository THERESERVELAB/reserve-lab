"use client";

import { motion } from "framer-motion";
import { Lock, Zap } from "lucide-react";

import { sceneForKey } from "@/lib/brand/visuals";
import {
  FEATURE_DEFINITIONS,
  FeatureKey,
  SUBSCRIPTION_TIERS,
} from "@/lib/saas-config";
import { useUpgradeCheckout } from "./useUpgradeCheckout";

export function UpgradePrompt({ feature }: { feature: FeatureKey }) {
  const def = FEATURE_DEFINITIONS[feature];
  const { startCheckout, pending, error } = useUpgradeCheckout();

  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-sm"
      >
        <div
          className="relative overflow-hidden rounded-2xl border border-[#d5b15f]/20 bg-[#08090e]"
          style={{ boxShadow: "0 0 60px rgba(213,177,95,0.08)" }}
        >
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#d5b15f]/40 to-transparent" />

          {/* Reserve scene plate — scrimmed backdrop behind the gate copy. */}
          <div
            className="pointer-events-none absolute inset-0 bg-cover bg-[center_22%] opacity-[0.18]"
            style={{ backgroundImage: `url(${sceneForKey(feature)})` }}
          />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(8,9,14,0.5)_0%,rgba(8,9,14,0.86)_100%)]" />

          <div className="p-8 text-center">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#d5b15f]/20 bg-[#d5b15f]/8">
              <Lock size={22} className="text-[#d5b15f]/70" />
            </div>

            <p className="font-mono text-[8px] uppercase tracking-[0.3em] text-[#d5b15f]/60">
              {SUBSCRIPTION_TIERS[def.tier].label} Feature
            </p>
            <h3 className="mt-2 text-[18px] font-semibold text-[#f2eee6]">
              {def.label}
            </h3>
            <p className="mt-3 text-[11px] leading-5 text-white/35">
              {def.description}
            </p>

            <div className="mt-6 rounded-xl border border-[#d5b15f]/12 bg-[#d5b15f]/5 p-4">
              <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#d5b15f]/50">
                {SUBSCRIPTION_TIERS[def.tier].label}
              </p>
              <p className="mt-1 text-[11px] text-white/28">
                {SUBSCRIPTION_TIERS[def.tier].description}
              </p>
            </div>

            {/* Real Stripe Checkout. This button previously called
                setSubscriptionTier(def.tier) and handed the plan over for
                free. */}
            <button
              type="button"
              disabled={pending}
              onClick={() => startCheckout(def.tier)}
              className="mt-5 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-[#d5b15f]/30 bg-[#d5b15f]/10 px-4 py-3 text-[12px] font-semibold text-[#d5b15f] transition-all duration-200 hover:border-[#d5b15f]/50 hover:bg-[#d5b15f]/18 disabled:cursor-not-allowed disabled:opacity-50"
              style={{ boxShadow: "0 0 20px rgba(213,177,95,0.12)" }}
            >
              <Zap size={13} />
              {pending
                ? "Opening checkout…"
                : `Upgrade to ${SUBSCRIPTION_TIERS[def.tier].label} · ${SUBSCRIPTION_TIERS[def.tier].price}`}
            </button>

            {error && (
              <p role="alert" className="mt-2.5 text-[11px] leading-[1.5] text-[#ef7d55]">
                {error}
              </p>
            )}

            <p className="mt-4 text-[9px] text-white/18">
              {SUBSCRIPTION_TIERS.core.label} · {SUBSCRIPTION_TIERS.core.price} includes training, nutrition, recovery &amp; more
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
