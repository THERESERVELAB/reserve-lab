/* ════════════════════════════════════════════════════════════════════════
   SESSION BRIDGE — a member-built workout becomes today's REAL session.

   Converts a CustomWorkoutTemplate into the exact frozen-queue shape the
   training cockpit renders (SessionMovement[]) plus the immutable
   SessionGenerationSnapshot that startTrainingSession freezes. The bridge
   EXTENDS the existing snapshot seam — it does not fork it: once started,
   a custom session obeys the same rules as a generated one (resume-only
   while live, rebuild only at zero logged sets, settings changes never
   silently rewrite the queue).

   Honesty rules: no fabricated history. When the member set no load target
   the cockpit shows "Set baseline" (suggestedLoad 0 is the existing
   convention); whyLoad copy never invents a previous session.
   ════════════════════════════════════════════════════════════════════════ */

import type { SessionGenerationSnapshot } from "@/lib/athlete-store";
import type { WorkoutDemandLevel } from "@/lib/training/workout-demand";
import {
  MOVEMENT_LIBRARY,
  type MovementLibraryEntry,
} from "@/lib/training/prescription-engine";
import type {
  EquipmentKind,
  MovementSub,
  SessionMovement,
} from "@/lib/training/session-movement";
import { slotRoleById } from "./movement-ranking";
import type { CustomWorkoutMovement, CustomWorkoutTemplate } from "./types";

const LIB_BY_ID = new Map<string, MovementLibraryEntry>(MOVEMENT_LIBRARY.map((e) => [e.id, e]));

/* ─── Equipment mapping ──────────────────────────────────────────────────── */

function equipmentKindOf(entry: MovementLibraryEntry | undefined): EquipmentKind {
  switch (entry?.equipment) {
    case "barbell": return "barbell";
    case "dumbbells": return "dumbbell";
    case "smith": return "smith";
    case "cables": return "cable";
    default: return "machine";
  }
}

function modeOf(kind: EquipmentKind): SessionMovement["mode"] {
  return kind === "barbell" ? "barbell" : kind === "dumbbell" ? "dumbbell" : "machine";
}

function equipmentNameOf(entry: MovementLibraryEntry | undefined): string {
  if (!entry) return "Member-specified equipment";
  const words = entry.equipment.replace(/-/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/* ─── Per-set RIR ladder ("2 RIR" … "0-1 RIR") from a single member target ── */

function rirLadder(sets: number, rirTarget: number | undefined, rpeTarget: number | undefined): string[] {
  const finalRir = rirTarget ?? (rpeTarget !== undefined ? Math.max(0, 10 - rpeTarget) : 2);
  return Array.from({ length: Math.max(1, sets) }, (_, i) => {
    const remaining = sets - 1 - i;
    const rir = Math.min(4, finalRir + Math.min(2, remaining));
    return rir <= finalRir ? `${finalRir === 0 ? "0-1" : finalRir} RIR` : `${rir} RIR`;
  });
}

function restLabel(restSeconds: number): string {
  const m = Math.floor(restSeconds / 60);
  const s = restSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/* ─── Session phase map (cockpit grouping) ───────────────────────────────── */

const PRIMARY_PATTERNS = new Set([
  "Horizontal Press", "Incline Press", "Vertical Press", "Vertical Pull",
  "Horizontal Pull", "Squat Pattern", "Hip Hinge",
]);

function phaseFor(entry: MovementLibraryEntry | undefined, slotRole: string, index: number): string {
  const slot = slotRoleById(slotRole);
  const pattern = entry?.pattern;
  if (pattern === "Core Brace" || slot?.id === "core-brace") return "core-command";
  if (pattern === "Conditioning" || slot?.id === "conditioning-finisher") return "conditioning-reserve";
  if (pattern && PRIMARY_PATTERNS.has(pattern)) return index <= 1 ? "primary-output" : "secondary-volume";
  return "detail-work";
}

/* ─── Movement conversion ────────────────────────────────────────────────── */

function toSessionMovement(mv: CustomWorkoutMovement, template: CustomWorkoutTemplate): SessionMovement {
  const entry = mv.exerciseId ? LIB_BY_ID.get(mv.exerciseId) : undefined;
  const slot = slotRoleById(mv.slotRole);
  const name = entry?.name ?? mv.customExerciseName ?? "Custom Movement";
  const target = entry?.target ?? slot?.muscleGroup ?? template.targetMuscles[0] ?? "General";
  const kind = equipmentKindOf(entry);
  const restSeconds = mv.restSeconds ?? 120;
  const reps =
    mv.repMin !== undefined && mv.repMax !== undefined && mv.repMax !== mv.repMin
      ? `${mv.repMin}-${mv.repMax}`
      : String(mv.repMax ?? mv.repMin ?? 10);

  const substitutions: MovementSub[] = mv.substitutionExerciseIds
    .map((id) => LIB_BY_ID.get(id))
    .filter((e): e is MovementLibraryEntry => Boolean(e))
    .map((e) => ({
      name: e.name,
      equipment: equipmentNameOf(e),
      reasons: ["machine-occupied", "feels-wrong"],
      preservesStimulus: e.pattern === entry?.pattern,
      intentLine: e.pattern === entry?.pattern ? "Same pattern · member-saved substitute" : "Member-saved substitute",
      note: e.cue,
    }));

  return {
    id: mv.id,
    name,
    purpose: slot ? `${slot.label} — ${template.sessionObjective}` : template.sessionObjective,
    target,
    region: target,
    sets: Math.max(1, mv.workingSets),
    reps,
    suggestedLoad: mv.loadTarget ?? 0,
    mode: modeOf(kind),
    equipmentKind: kind,
    equipmentName: equipmentNameOf(entry),
    setupNote: mv.notes || entry?.cue || "Set up exactly as you built it — this is your session.",
    rirTargets: rirLadder(mv.workingSets, mv.rirTarget, mv.rpeTarget),
    rest: restLabel(restSeconds),
    restSeconds,
    tempo: mv.tempo,
    intensity: mv.intensityTechnique && mv.intensityTechnique !== "straight-sets" ? mv.intensityTechnique : undefined,
    roleLabel: slot?.label,
    cue: entry?.cue ?? mv.notes ?? "Execute with the intent you built this slot for.",
    physiqueImpact: slot
      ? `${slot.description} Built into your ${template.name} by you.`
      : `Member-built movement inside ${template.name}.`,
    whyLoad: mv.loadTarget
      ? `Your target: ${mv.loadTarget} lb. Member-set — Reserve tracks it, you own it.`
      : "No load target set — establish a baseline this session and Reserve will track it.",
    primaryMuscles: [target],
    secondaryMuscles: [],
    stabilizers: [],
    education: {
      whyHere: slot
        ? `You placed this in the ${slot.label.toLowerCase()} slot for: ${template.sessionObjective}.`
        : `You added this movement for: ${template.sessionObjective}.`,
      whatToFeel: entry ? entry.cue : "The stimulus you designed this slot to deliver.",
      goalConnection: `Part of your member-built session "${template.name}".`,
      commonError: "Drifting from the setup you planned — run the slot the way you built it.",
      stretchFocus: "Control the lengthened position on every rep.",
      contractionFocus: "Own the squeeze — no momentum.",
    },
    substitutions,
  };
}

/* ─── Snapshot builder ───────────────────────────────────────────────────── */

export type CustomSessionBuild = {
  snapshot: SessionGenerationSnapshot;
  firstMovementId: string | null;
};

export function buildCustomSessionSnapshot(
  template: CustomWorkoutTemplate,
  demand: WorkoutDemandLevel,
): CustomSessionBuild {
  const ordered = [...template.movements].sort((a, b) => a.order - b.order);
  const movements = ordered.map((mv) => toSessionMovement(mv, template));
  const phaseMap: Record<string, string> = {};
  ordered.forEach((mv, i) => {
    const entry = mv.exerciseId ? LIB_BY_ID.get(mv.exerciseId) : undefined;
    phaseMap[mv.id] = phaseFor(entry, mv.slotRole, i);
  });

  return {
    snapshot: {
      demandAtGeneration: demand,
      requestedDemand: demand,
      authorizedDemand: demand,
      architectureId: `custom-template:${template.lineageId}`,
      architectureVersion: template.updatedAt,
      architectureName: template.name,
      mesocycleId: `custom:${template.lineageId}:v${template.version}`,
      generatedAt: new Date().toISOString(),
      generationReason: "member-start",
      splitTitle: template.name,
      movements,
      phaseMap,
      changeAcknowledgedAt: null,
    },
    firstMovementId: movements[0]?.id ?? null,
  };
}
