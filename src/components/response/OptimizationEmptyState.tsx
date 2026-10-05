import { Activity } from "lucide-react";

import { OPTIMIZATION_EMPTY_BODY, OPTIMIZATION_EMPTY_TITLE } from "@/lib/response-model/optimization-history";

export function OptimizationEmptyState() {
  return (
    <section data-testid="optimization-empty-state" className="rounded-2xl border border-white/[0.08] bg-white/[0.02] px-5 py-10 text-center sm:px-8">
      <Activity size={22} className="mx-auto text-[#d5b15f]/60" />
      <h2 className="mt-4 font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-[#f2eee6]">{OPTIMIZATION_EMPTY_TITLE}</h2>
      <p className="mx-auto mt-2 max-w-md text-[12px] leading-6 text-white/42">{OPTIMIZATION_EMPTY_BODY}</p>
    </section>
  );
}
