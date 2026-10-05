"use client";

import type { NutritionAlignment } from "@/lib/nutrition/useNutritionAlignment";
import { WeeklyChallengeCard } from "@/components/apex/WeeklyChallengeCard";
import { ReserveDisclosure } from "@/components/ui/reserve";
import { NutritionAlignmentCard } from "@/components/views/nutrition/NutritionAlignmentCard";

import { AutoReviewBlock, type AutoReviewBlockProps } from "./AutoReviewBlock";
import { BiomarkerBlock, type BiomarkerBlockProps } from "./BiomarkerBlock";
import { EnhancedBlock, type EnhancedBlockProps } from "./EnhancedBlock";
import { PhysiquePriorityBlock, type PhysiquePriorityBlockProps } from "./PhysiquePriorityBlock";
import { SmartBriefBlock, type SmartBriefBlockProps } from "./SmartBriefBlock";
import { SystemLedger, type SystemLedgerProps } from "./SystemLedger";

/* ════════════════════════════════════════════════════════════════════════
   FULL BRIEFING — the Apex panels that no longer belong on the first
   screen, behind one closed disclosure (Bible §11 layer 6). Nothing here is
   deleted; it moves behind the summary.

   Order: Smart Brief + Physique Priority, Weekly Challenge, Nutrition
   Alignment, Biomarker Command, Lab Log Summary, Enhanced Member Command,
   System Status. Props are passed straight through to the blocks.
   ════════════════════════════════════════════════════════════════════════ */

export type FullBriefingProps = SmartBriefBlockProps &
  PhysiquePriorityBlockProps &
  BiomarkerBlockProps &
  AutoReviewBlockProps &
  EnhancedBlockProps &
  SystemLedgerProps & {
    nutritionAlignment: NutritionAlignment;
  };

export function FullBriefing({
  smartBrief,
  confidenceLevel,
  intakeSummary,
  weakPointLabels,
  momentum,
  checkInCadence,
  physiqueEvidence,
  nutritionAlignment,
  biomarkers,
  measurementReview,
  photoReview,
  enhanced,
  enhancedLogOnly,
  onEnableEnhanced,
  canAccessEnhanced,
  canAccessMonitor,
  systems,
  onNavigate,
}: FullBriefingProps) {
  return (
    <ReserveDisclosure summary="Full briefing">
      <div className="flex flex-col gap-4">
        {/* The disclosure summary is a control, not a heading; this names the region for heading navigation. */}
        <h2 className="sr-only">Full briefing</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <SmartBriefBlock smartBrief={smartBrief} confidenceLevel={confidenceLevel} intakeSummary={intakeSummary} onNavigate={onNavigate} />
          <PhysiquePriorityBlock
            weakPointLabels={weakPointLabels}
            momentum={momentum}
            checkInCadence={checkInCadence}
            physiqueEvidence={physiqueEvidence}
            onNavigate={onNavigate}
          />
        </div>
        <WeeklyChallengeCard onOpenNutrition={() => onNavigate("nutrition")} />
        <NutritionAlignmentCard alignment={nutritionAlignment} compact onOpen={() => onNavigate("nutrition")} />
        <BiomarkerBlock biomarkers={biomarkers} onNavigate={onNavigate} />
        <AutoReviewBlock biomarkers={biomarkers} measurementReview={measurementReview} photoReview={photoReview} onNavigate={onNavigate} />
        <EnhancedBlock
          enhanced={enhanced}
          enhancedLogOnly={enhancedLogOnly}
          intakeSummary={intakeSummary}
          biomarkers={biomarkers}
          onNavigate={onNavigate}
          onEnableEnhanced={onEnableEnhanced}
          canAccessEnhanced={canAccessEnhanced}
          canAccessMonitor={canAccessMonitor}
        />
        <SystemLedger systems={systems} onNavigate={onNavigate} />
      </div>
    </ReserveDisclosure>
  );
}
