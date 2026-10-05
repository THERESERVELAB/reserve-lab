/* ════════════════════════════════════════════════════════════════════════
   MEMBER SUPPORT PLAN — the support plan without a cycle.

   The same honest review Cycle Review shows, built from what every member
   has: the compounds they are running now, their full lab history, their
   check-ins and sleep logs. Nothing here needs a cycle, so there is no
   planned end to report and no goal to align with.
   ════════════════════════════════════════════════════════════════════════ */

import { buildCompoundRiskBrief } from "@/lib/compound-intelligence/risk-profiles";
import type { LabSafetyBrief } from "@/lib/labs/lab-safety";

import { buildSystemRows } from "./body-systems";
import { compareCheckIns } from "./check-in";
import type { ReviewCompound } from "./complexity";
import { buildMarkerTrends } from "./lab-trends";
import { buildSupportPlanReview, type SupportPlanReview } from "./support-plan";
import type { CycleCheckIn, SupportPlanItem } from "./types";

export type MemberSupportCompound = {
  id: string;
  name: string;
  officialName?: string;
  compoundClass?: string;
  category: string;
  route?: string;
  isActive: boolean;
  pausedAt?: string;
  /** YYYY-MM-DD, member entered. */
  startDate?: string;
};

export type MemberSupportInput = {
  today: string;
  /** Every entry in the member's log — only running ones count as current load. */
  compounds: MemberSupportCompound[];
  labBrief: LabSafetyBrief;
  checkIns: CycleCheckIn[];
  sleepLogDates: string[];
  /** Free text from the member's profile, exactly as entered. */
  medicationsText: string;
  healthContext: string[];
  allergies: string[];
  /** A warning sign or emergency is open — care comes before any supplement. */
  needsCare: boolean;
  plan: SupportPlanItem[];
};

export function buildMemberSupportReview(input: MemberSupportInput): SupportPlanReview {
  const running = input.compounds.filter((compound) => compound.isActive && !compound.pausedAt);
  const brief = buildCompoundRiskBrief(running.map(({ name, officialName, compoundClass }) => ({ name, officialName, compoundClass })));
  const trends = buildMarkerTrends({ labBrief: input.labBrief, cycle: null, markerLinks: brief.markerLinks });
  const comparison = compareCheckIns(input.checkIns);
  const reviewCompounds: ReviewCompound[] = running.map(({ id, name, officialName, compoundClass, startDate }) => ({ id, name, officialName, compoundClass, startDate }));
  const systems = buildSystemRows({
    compounds: reviewCompounds,
    trends,
    checkIns: input.checkIns,
    comparison,
    sleepLogDates: input.sleepLogDates,
    today: input.today,
  });
  const runningNames = new Set(running.map((compound) => compound.name));

  return buildSupportPlanReview({
    today: input.today,
    brief,
    logged: input.compounds.map((compound) => ({
      name: compound.name,
      officialName: compound.officialName,
      compoundClass: compound.compoundClass,
      category: compound.category,
      route: compound.route,
      isActive: compound.isActive && !compound.pausedAt,
    })),
    medicationsText: input.medicationsText,
    healthContext: input.healthContext,
    allergies: input.allergies,
    goalSetup: null,
    trends,
    checkIns: input.checkIns,
    comparison,
    systems,
    untestedLabels: input.labBrief.untested.filter((marker) => marker.compounds.some((name) => runningNames.has(name))).map((marker) => marker.label),
    needsCare: input.needsCare || Boolean(comparison?.needsCare),
    stillActivePastEnd: false,
    plan: input.plan,
  });
}
