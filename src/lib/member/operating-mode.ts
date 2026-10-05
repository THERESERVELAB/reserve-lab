/* ════════════════════════════════════════════════════════════════════════
   PROGRAM OWNERSHIP — the one answer to "who authored this program?"

   Reserve had two unrelated vocabularies before this module:

     ProgramOperatingMode  reserve-managed | hybrid | member-managed
                           (lib/program/types — the Program Command surface)

     ActiveProgramSource   program-horizon | legacy-migration
                           | member-custom | explicit-fallback
                           (lib/horizon/active-program — where the *projection*
                           came from, which is a provenance fact, not authorship)

   Neither expressed coach authorship, and no surface agreed on which one won.
   This resolver is the single authority. It is pure and deterministic: no
   store access, no React, no persistence. The hook boundary supplies inputs
   and persists the resolved mode.

   The rule that matters most: Reserve never silently demotes authorship.
   A member-custom or coach-authored program stays that way until the owning
   party explicitly changes it. Derivation may only *upgrade* into authorship,
   never quietly strip it.
   ════════════════════════════════════════════════════════════════════════ */

import type { CoachingRelationship } from "@/lib/coaching/types";
import { canManage, canSuggest, canView } from "@/lib/coaching/permissions";
import type { ActiveProgramSource } from "@/lib/horizon/active-program";
import type { ProgramOperatingMode } from "@/lib/program/types";

/* ─── The contract ────────────────────────────────────────────────────── */

export type ProgramOwnershipMode =
  | "reserve-designed"
  | "member-custom"
  | "reserve-assisted"
  | "coach-authored"
  | "coach-assisted";

export const PROGRAM_OWNERSHIP_MODES: ProgramOwnershipMode[] = [
  "reserve-designed",
  "member-custom",
  "reserve-assisted",
  "coach-authored",
  "coach-assisted",
];

export const OWNERSHIP_MODE_LABELS: Record<ProgramOwnershipMode, string> = {
  "reserve-designed": "Reserve Designed",
  "member-custom": "Reserve Custom",
  "reserve-assisted": "Reserve Assisted",
  "coach-authored": "Coach Authored",
  "coach-assisted": "Coach Assisted",
};

export const OWNERSHIP_MODE_DESCRIPTIONS: Record<ProgramOwnershipMode, string> = {
  "reserve-designed":
    "Reserve built the structure from your context. Material changes still need your approval.",
  "member-custom":
    "You authored this protocol. Reserve organises and tracks it without rewriting it.",
  "reserve-assisted":
    "You authored the foundation. Reserve may propose improvements you choose to accept.",
  "coach-authored": "Your coach authors this protocol. Reserve prepares evidence for their review.",
  "coach-assisted":
    "Your coach advises on a protocol you own. Their changes arrive as suggestions.",
};

/** Modes whose authorship belongs to a human and may never be auto-replaced. */
export const AUTHORED_MODES: ProgramOwnershipMode[] = ["member-custom", "coach-authored"];

export function isAuthoredMode(mode: ProgramOwnershipMode): boolean {
  return AUTHORED_MODES.includes(mode);
}

export function isCoachMode(mode: ProgramOwnershipMode): boolean {
  return mode === "coach-authored" || mode === "coach-assisted";
}

/** Does this mode allow Reserve to *propose* structural change? */
export function acceptsReserveProposals(mode: ProgramOwnershipMode): boolean {
  return mode !== "member-custom";
}

/* ─── Resolution ──────────────────────────────────────────────────────── */

export type OwnershipResolutionInput = {
  /** The Program Command surface's mode. Null before a program exists. */
  programOperatingMode: ProgramOperatingMode | null;
  /** Where the live projection came from — provenance, not authorship. */
  activeProgramSource: ActiveProgramSource | null;
  /** The athlete's coaching relationship, if any. Only `active` counts. */
  relationship: CoachingRelationship | null;
  /**
   * The last mode Reserve resolved and persisted for this athlete. Supplying
   * it is what makes authorship sticky across sessions.
   */
  persistedMode: ProgramOwnershipMode | null;
  /**
   * Set when the owning party deliberately changed mode this turn (e.g. the
   * member converted their custom protocol back to Reserve Designed). An
   * explicit change is the only thing allowed to drop authorship.
   */
  explicitModeChange?: ProgramOwnershipMode | null;
  /** Member opted into Reserve Review over a protocol they authored. */
  assistedReviewEnabled?: boolean;
};

export type OwnershipResolution = {
  mode: ProgramOwnershipMode;
  /** What drove this answer, for the inspector and the decision record. */
  rationale: string;
  /** The mode plain derivation produced before authorship protection. */
  derivedMode: ProgramOwnershipMode;
  /**
   * True when derivation would have dropped human authorship and the resolver
   * refused. Surfaces this as a conflict rather than silently disagreeing.
   */
  authorshipProtected: boolean;
  /** Active coaching relationship id when a coach mode is in force. */
  coachRelationshipId: string | null;
  assumptions: string[];
};

function relationshipIsLive(rel: CoachingRelationship | null): rel is CoachingRelationship {
  return Boolean(rel && rel.status === "active");
}

/**
 * Coach authorship requires the coach to actually hold training authority.
 * A view-only coach never becomes the author of the athlete's program.
 */
function coachModeFor(rel: CoachingRelationship): ProgramOwnershipMode | null {
  if (canManage(rel, "training")) return "coach-authored";
  if (canSuggest(rel, "training") || canView(rel, "training")) return "coach-assisted";
  return null;
}

function modeFromProgram(
  programOperatingMode: ProgramOperatingMode | null,
  activeProgramSource: ActiveProgramSource | null,
  assistedReviewEnabled: boolean,
): { mode: ProgramOwnershipMode; rationale: string } {
  // Horizon provenance of `member-custom` is authorship evidence on its own —
  // the projection was built from a protocol the member wrote.
  if (activeProgramSource === "member-custom") {
    return {
      mode: assistedReviewEnabled ? "reserve-assisted" : "member-custom",
      rationale: assistedReviewEnabled
        ? "Member-authored protocol with Reserve Review enabled."
        : "Active projection was built from a member-authored protocol.",
    };
  }

  switch (programOperatingMode) {
    case "member-managed":
      return {
        mode: assistedReviewEnabled ? "reserve-assisted" : "member-custom",
        rationale: assistedReviewEnabled
          ? "Member-managed program with Reserve Review enabled."
          : "Program Command is set to member-managed.",
      };
    case "hybrid":
      return {
        mode: "reserve-assisted",
        rationale: "Program Command is set to hybrid — member foundation, Reserve proposals.",
      };
    case "reserve-managed":
      return { mode: "reserve-designed", rationale: "Program Command is set to reserve-managed." };
    default:
      return {
        mode: "reserve-designed",
        rationale: "No program mode recorded yet — defaulting to Reserve Designed.",
      };
  }
}

export function resolveProgramOwnership(input: OwnershipResolutionInput): OwnershipResolution {
  const assumptions: string[] = [];
  const assistedReviewEnabled = input.assistedReviewEnabled ?? false;

  if (!input.programOperatingMode && !input.activeProgramSource) {
    assumptions.push("No active program recorded; ownership derived from defaults only.");
  }

  /* An explicit change by the owning party always wins, and is the only path
     that may drop authorship. */
  if (input.explicitModeChange) {
    return {
      mode: input.explicitModeChange,
      derivedMode: input.explicitModeChange,
      rationale: "Owner explicitly set this operating mode.",
      authorshipProtected: false,
      coachRelationshipId: relationshipIsLive(input.relationship) ? input.relationship.id : null,
      assumptions,
    };
  }

  /* Coach authorship outranks program-surface settings: an active coach with
     training authority is the author regardless of which toggle the member
     last touched on Program Command. */
  let derived: ProgramOwnershipMode;
  let rationale: string;
  let coachRelationshipId: string | null = null;

  const rel = input.relationship;
  const coachMode = relationshipIsLive(rel) ? coachModeFor(rel) : null;

  if (relationshipIsLive(rel) && coachMode) {
    derived = coachMode;
    coachRelationshipId = rel.id;
    rationale =
      coachMode === "coach-authored"
        ? "Active coaching relationship holds training management authority."
        : "Active coaching relationship advises on training without management authority.";
  } else {
    if (rel && rel.status !== "active") {
      assumptions.push(
        `Coaching relationship is ${rel.status}; ownership resolved without coach authority.`,
      );
    } else if (relationshipIsLive(rel) && !coachMode) {
      assumptions.push(
        "Coach relationship is active but holds no training permission; program remains member/Reserve owned.",
      );
    }
    const fromProgram = modeFromProgram(
      input.programOperatingMode,
      input.activeProgramSource,
      assistedReviewEnabled,
    );
    derived = fromProgram.mode;
    rationale = fromProgram.rationale;
  }

  /* Authorship protection. If a human authored the program and derivation now
     wants to hand it back to Reserve, refuse and keep the authored mode. */
  const persisted = input.persistedMode;
  if (persisted && isAuthoredMode(persisted) && !isAuthoredMode(derived)) {
    const coachGone =
      persisted === "coach-authored" && !relationshipIsLive(rel)
        ? "Coaching relationship is no longer active, but the coach-authored program is preserved until the athlete changes it."
        : null;
    if (coachGone) assumptions.push(coachGone);
    return {
      mode: persisted,
      derivedMode: derived,
      rationale: `Preserved ${OWNERSHIP_MODE_LABELS[persisted]} — Reserve never silently reclaims an authored program.`,
      authorshipProtected: true,
      coachRelationshipId,
      assumptions,
    };
  }

  return {
    mode: derived,
    derivedMode: derived,
    rationale,
    authorshipProtected: false,
    coachRelationshipId,
    assumptions,
  };
}

/* ─── Sensitive display ───────────────────────────────────────────────── */

export type SensitiveDisplayMode = "full" | "discreet" | "hidden-on-dashboard";

export const SENSITIVE_DISPLAY_LABELS: Record<SensitiveDisplayMode, string> = {
  full: "Show full detail",
  discreet: "Show as a private reminder",
  "hidden-on-dashboard": "Hide from dashboard entirely",
};

/**
 * What a dashboard-level surface is allowed to render for a sensitive item.
 * `label` is safe to display in every mode; callers must not fall back to the
 * real name when the mode is not "full".
 */
export function sensitiveItemLabel(
  mode: SensitiveDisplayMode,
  realLabel: string,
): { visible: boolean; label: string } {
  switch (mode) {
    case "full":
      return { visible: true, label: realLabel };
    case "discreet":
      return { visible: true, label: "Private reminder" };
    case "hidden-on-dashboard":
      return { visible: false, label: "" };
  }
}

/* ─── White-glove athlete resolution ──────────────────────────────────── */

export type ResolutionConfidence = "insufficient" | "emerging" | "moderate" | "established";

export type WhiteGloveAthleteResolution = {
  athleteId: string;
  operatingMode: ProgramOwnershipMode;
  ownership: OwnershipResolution;

  activeProgramId?: string;
  activeHorizonId?: string;
  currentWeek?: number;
  currentPhase?: string;

  today: {
    trainingSessionId?: string;
    nutritionDayId?: string;
    cardioSessionIds: string[];
    supplementScheduleIds: string[];
    scheduleEventIds: string[];
    checkInIds: string[];
    bloodworkReminderIds: string[];
  };

  intelligence: {
    strongestInsightId?: string;
    pendingRecommendationId?: string;
    latestAppliedRevisionId?: string;
    confidence: ResolutionConfidence;
  };

  coaching: {
    coachRelationshipId?: string;
    coachReviewPending: boolean;
    athleteDecisionPending: boolean;
  };

  healthContext: {
    authorized: boolean;
    clinicalReviewItems: string[];
    sensitiveDisplayMode: SensitiveDisplayMode;
  };

  missingRequirements: string[];
};

export type WhiteGloveResolutionInput = {
  athleteId: string;
  ownership: OwnershipResolutionInput;

  activeProgramId?: string | null;
  activeHorizonId?: string | null;
  currentWeek?: number | null;
  currentPhase?: string | null;

  today?: Partial<WhiteGloveAthleteResolution["today"]>;

  strongestInsightId?: string | null;
  pendingRecommendationId?: string | null;
  latestAppliedRevisionId?: string | null;
  confidence?: ResolutionConfidence;

  coachReviewPending?: boolean;
  athleteDecisionPending?: boolean;

  /** Explicit clinical consent — never inferred from coaching permissions. */
  healthContextAuthorized?: boolean;
  clinicalReviewItems?: string[];
  sensitiveDisplayMode?: SensitiveDisplayMode;

  onboardingComplete?: boolean;
};

const EMPTY_TODAY: WhiteGloveAthleteResolution["today"] = {
  cardioSessionIds: [],
  supplementScheduleIds: [],
  scheduleEventIds: [],
  checkInIds: [],
  bloodworkReminderIds: [],
};

/**
 * The single member-level resolution every major surface reads. Pure: callers
 * gather the inputs, this decides. No surface may derive operating mode itself.
 */
export function resolveWhiteGloveAthlete(
  input: WhiteGloveResolutionInput,
): WhiteGloveAthleteResolution {
  const ownership = resolveProgramOwnership(input.ownership);
  const missingRequirements: string[] = [];

  if (input.onboardingComplete === false) missingRequirements.push("onboarding-incomplete");
  if (!input.activeProgramId) missingRequirements.push("no-active-program");
  if (!input.activeHorizonId) missingRequirements.push("no-program-horizon");
  if (input.currentWeek == null) missingRequirements.push("no-current-week");

  const confidence = input.confidence ?? "insufficient";

  return {
    athleteId: input.athleteId,
    operatingMode: ownership.mode,
    ownership,

    activeProgramId: input.activeProgramId ?? undefined,
    activeHorizonId: input.activeHorizonId ?? undefined,
    currentWeek: input.currentWeek ?? undefined,
    currentPhase: input.currentPhase ?? undefined,

    today: { ...EMPTY_TODAY, ...(input.today ?? {}) },

    intelligence: {
      strongestInsightId: input.strongestInsightId ?? undefined,
      pendingRecommendationId: input.pendingRecommendationId ?? undefined,
      latestAppliedRevisionId: input.latestAppliedRevisionId ?? undefined,
      confidence,
    },

    coaching: {
      coachRelationshipId: ownership.coachRelationshipId ?? undefined,
      coachReviewPending: input.coachReviewPending ?? false,
      athleteDecisionPending: input.athleteDecisionPending ?? false,
    },

    healthContext: {
      authorized: input.healthContextAuthorized ?? false,
      clinicalReviewItems: input.clinicalReviewItems ?? [],
      sensitiveDisplayMode: input.sensitiveDisplayMode ?? "full",
    },

    missingRequirements,
  };
}

/* ─── Material-change policy ──────────────────────────────────────────── */

export type ChangeMateriality = "informational" | "low-risk" | "material";

export type ApprovalRequirement = {
  requiresAthleteApproval: boolean;
  requiresCoachReview: boolean;
  mayAutoApply: boolean;
  reason: string;
};

/**
 * Who must sign off before a proposed change takes effect. Material structural
 * change always needs a human; low-confidence evidence can never auto-apply.
 */
export function approvalRequirementFor(
  mode: ProgramOwnershipMode,
  materiality: ChangeMateriality,
  confidence: ResolutionConfidence,
): ApprovalRequirement {
  if (materiality === "material") {
    return {
      requiresAthleteApproval: !isCoachMode(mode),
      requiresCoachReview: isCoachMode(mode),
      mayAutoApply: false,
      reason: "Material structural changes always require explicit approval.",
    };
  }

  if (mode === "member-custom") {
    return {
      requiresAthleteApproval: true,
      requiresCoachReview: false,
      mayAutoApply: false,
      reason: "Member-authored protocols are never modified without the author's approval.",
    };
  }

  if (confidence === "insufficient" || confidence === "emerging") {
    return {
      requiresAthleteApproval: !isCoachMode(mode),
      requiresCoachReview: isCoachMode(mode),
      mayAutoApply: false,
      reason: "Evidence confidence is too low to apply a change without review.",
    };
  }

  if (materiality === "informational") {
    return {
      requiresAthleteApproval: false,
      requiresCoachReview: false,
      mayAutoApply: true,
      reason: "Informational observations change nothing on their own.",
    };
  }

  return {
    requiresAthleteApproval: !isCoachMode(mode),
    requiresCoachReview: isCoachMode(mode),
    mayAutoApply: false,
    reason: "Low-risk changes still surface for a decision before they take effect.",
  };
}
