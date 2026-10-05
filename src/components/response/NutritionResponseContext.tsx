"use client";

import { ReserveDisclosure } from "@/components/ui/reserve";
import { useResponseSurfaceResolution } from "@/lib/hooks/useResponseSurfaceResolution";
import { presentNutritionResponse } from "@/lib/response-model/surfaces";

/* ════════════════════════════════════════════════════════════════════════
   NUTRITION RESPONSE CONTEXT — what the response model can say about the
   member's own intake, weight and performance, at the size it deserves.

   With too little evidence it is one line: the model makes no claim, so the
   room does not spend a paragraph saying so. With a real finding it is the
   finding in one line and the rest (what it may mean, the posture, what is
   missing, review) behind a closed disclosure.
   ════════════════════════════════════════════════════════════════════════ */

export function NutritionResponseContext() {
  const resolution = useResponseSurfaceResolution({
    domains: ["body-composition", "nutrition", "adherence", "conditioning", "recovery"],
    nutritionContexts: ["weight-performance", "intake-adherence", "training-demand", "conditioning-demand", "recovery-demand"],
    recoveryContexts: ["conditioning-demand", "recovery-demand"],
  });
  const view = presentNutritionResponse(resolution);
  const insufficient = !view.insightId;

  return (
    <section
      data-testid="nutrition-response-context"
      data-model-version={resolution.modelVersion}
      data-insight-id={view.insightId ?? ""}
      aria-label="Nutrition response"
      className="px-1"
    >
      {insufficient ? (
        <p className="text-[12px] leading-[1.5] text-white/60">
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/50">Nutrition response · evidence needed</span>
          {" · "}
          {view.information}
        </p>
      ) : (
        <>
          <p className="text-[12.5px] leading-[1.5] text-white/70">
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#e8c87a]/80">Nutrition response · {resolution.confidence}</span>
            {" · "}
            {view.observed}
          </p>
          <ReserveDisclosure summary="What it may mean">
            <div className="space-y-2 text-[12px] leading-[1.55] text-white/65">
              <p>{view.meaning}</p>
              <p>{view.posture}</p>
              <p className="text-white/55">{view.information}</p>
              <p className="text-[#e8c87a]/75">{view.review}</p>
            </div>
          </ReserveDisclosure>
        </>
      )}
    </section>
  );
}
