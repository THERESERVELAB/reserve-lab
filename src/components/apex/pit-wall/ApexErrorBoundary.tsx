"use client";

import React from "react";

import { GlassPanel } from "@/components/ui/GlassPanel";
import { ReserveButton } from "@/components/ui/reserve";
import { RESERVE, alpha } from "@/lib/design/tokens";

type State = { failed: boolean };

/**
 * Today's read is derivation-heavy — time math, lane clustering, engine output.
 * If any of it throws, the failure stays inside Apex: the shell and navigation
 * keep working, and the member gets one honest way forward instead of a blank app.
 */
export class ApexErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error("Apex Command failed to render", error);
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <GlassPanel accent={RESERVE.gold}>
        <p className="font-mono text-[8.5px] uppercase tracking-[0.26em]" style={{ color: alpha(RESERVE.gold, 0.85) }}>
          Apex Command
        </p>
        <h2 className="mt-2 font-display text-[22px] font-extrabold leading-tight tracking-[-0.01em] text-[#f2eee6]">
          Today&apos;s read didn&apos;t load.
        </h2>
        <p className="type-command mt-2 max-w-[52ch]">Nothing you logged was changed. Reload to rebuild the day from your logs.</p>
        <div className="mt-4">
          <ReserveButton tier="secondary" onClick={() => window.location.reload()}>
            Reload Apex
          </ReserveButton>
        </div>
      </GlassPanel>
    );
  }
}
