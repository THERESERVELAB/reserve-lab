/* ════════════════════════════════════════════════════════════════════════
   GYM-ENVIRONMENT SUBSTITUTION

   Adapts an already-generated session to the member's gym environment WITHOUT
   touching the premium full-gym experience. Full-arsenal environments
   (luxury-premium, high-performance) return byte-identical templates. For
   home / minimal / limited setups, any movement whose required equipment the
   member does not have is swapped for a REAL authored Reserve movement of the
   same pattern (via prescribeMovement) or the same target tissue (an authored
   home option). When no safe authored substitution exists, the movement is
   PRESERVED and an honest equipment note is attached — never an invented swap.

   Runs LAST in the session pipeline (after intensity / experience / phase /
   core), so role, sets, reps, phase, block, superset pairing, and intensity
   labels are all preserved — only the movement name + equipment change.

   Pure + deterministic. Equipment / logistics only — no medical claims.
   ════════════════════════════════════════════════════════════════════════ */

import type { TemplateMovement, WorkoutTemplate } from "./workout-templates";
import { MOVEMENT_LIBRARY, prescribeMovement, type MovementLibraryEntry } from "./prescription-engine";
import {
  EQUIPMENT_LABEL, GYM_ENVIRONMENT_LABEL,
  type EquipmentCategory, type GymEnvironment, type UserTrainingProfile,
} from "./gym-environment";
import type { GoalKey } from "@/lib/nutrition/types";

/** Environments that carry the full arsenal — the premium experience is never
    altered for these (every authored movement is reachable). */
const FULL_ARSENAL_ENVIRONMENTS: GymEnvironment[] = ["luxury-premium", "commercial-performance"];

/** Classify a template movement's free-text equipment label into an equipment
    category so availability can be checked. Bodyweight / band / unknown labels
    return null (treated as always available — never substituted blindly). */
export function equipmentCategoryFromLabel(label: string): EquipmentCategory | null {
  const e = label.toLowerCase();
  if (/bodyweight|\bband\b|bands/.test(e)) return null;        // always available
  if (/pendulum/.test(e)) return "pendulum-squat";
  if (/hack/.test(e)) return "hack-squat";
  if (/belt squat/.test(e)) return "belt-squat";
  if (/hip thrust machine|hip-thrust machine/.test(e)) return "hip-thrust-machine";
  if (/plate-loaded|plate loaded/.test(e)) return "plate-loaded";
  if (/leg press/.test(e)) return "leg-press";
  if (/leg curl/.test(e)) return "leg-curl";
  if (/leg extension/.test(e)) return "leg-extension";
  if (/calf/.test(e)) return "calf-machine";
  if (/pec deck/.test(e)) return "pec-deck";
  if (/rear-delt|rear delt/.test(e)) return "rear-delt-machine";
  if (/lateral raise machine/.test(e)) return "lateral-raise-machine";
  if (/shoulder press machine/.test(e)) return "shoulder-press";
  if (/incline press machine|incline machine/.test(e)) return "incline-press";
  if (/chest press machine|chest-press/.test(e)) return "chest-press";
  if (/row machine|row-machine/.test(e)) return "row-machine";
  if (/pulldown|pull-down|pull down|lat ?pull/.test(e)) return "pulldown";
  if (/curl machine|machine preacher|preacher.*machine|dip (station|machine)|dip-machine/.test(e)) return "selectorized";
  if (/smith/.test(e)) return "smith";
  if (/cable|rope/.test(e)) return "cables";
  if (/pull-up bar|pull up bar|pullup|chin-up|dip belt/.test(e)) return "pullup-bar";
  if (/t-bar|landmine|trap bar|barbell/.test(e)) return "barbell";
  if (/dumbbell/.test(e)) return "dumbbells";
  if (/kettlebell/.test(e)) return "kettlebells";
  if (/treadmill/.test(e)) return "treadmill";
  if (/stairmaster|stair/.test(e)) return "stairmaster";
  if (/bike/.test(e)) return "bike";
  if (/machine|selectoriz/.test(e)) return "machines";
  if (/bench/.test(e)) return "bench";
  return null;                                                  // unknown → leave as-is
}

function equipmentLabelFor(category: string): string {
  return EQUIPMENT_LABEL[category as EquipmentCategory] ?? category;
}

/** Strip positional qualifiers so "Upper Chest" ~ "Chest", "Rear Delts" ~ "Delts". */
function baseMuscle(s: string): string {
  return s.toLowerCase().replace(/\b(upper|lower|mid|middle|side|front|rear|outer|inner)\b/g, "").replace(/[-\s]+/g, " ").trim();
}

/** Performable = the member actually has the listed equipment. The library marks
    some bodyweight movements (pull-up, hanging knee raise) WITH an apparatus
    requirement, so we deliberately do NOT shortcut on the bodyweight flag here —
    a bar-less member is never handed a pull-up substitute. */
function performable(e: MovementLibraryEntry, profile: UserTrainingProfile): boolean {
  return profile.equipment.includes(e.equipment);
}

type Substitution = { name: string; equipment: string; basis: "same pattern" | "same target tissue"; cue: string };

/** Find a REAL authored substitute for a movement the member cannot perform. */
function authoredSubstitute(m: TemplateMovement, profile: UserTrainingProfile, goal: GoalKey): Substitution | null {
  const sameName = (n: string) => n.toLowerCase() === m.name.toLowerCase();

  // Path 1 — exact authored name → its pattern → the best available movement for
  // this profile (prescribeMovement ranks by equipment + level + style). Validate
  // the result is genuinely performable before using it.
  const byName = MOVEMENT_LIBRARY.find((e) => sameName(e.name));
  if (byName) {
    const rx = prescribeMovement({ pattern: byName.pattern, target: m.targetMuscle, profile, goal, recoveryLimited: false, weakPointRelevant: false });
    if (rx.primary && !sameName(rx.primary.name)) {
      const entry = MOVEMENT_LIBRARY.find((e) => e.name.toLowerCase() === rx.primary!.name.toLowerCase());
      if (entry && performable(entry, profile)) {
        return { name: rx.primary.name, equipment: equipmentLabelFor(rx.primary.equipment), basis: "same pattern", cue: rx.primary.cue };
      }
    }
  }

  // Path 2 — same target tissue, an authored home option the member can perform.
  const base = baseMuscle(m.targetMuscle);
  const candidates = MOVEMENT_LIBRARY.filter((e) => (e.home || e.bodyweight) && performable(e, profile) && !sameName(e.name));
  const alt =
    candidates.find((e) => e.target.toLowerCase() === m.targetMuscle.toLowerCase()) ??
    candidates.find((e) => baseMuscle(e.target) === base);
  if (alt) {
    return { name: alt.name, equipment: equipmentLabelFor(alt.equipment), basis: "same target tissue", cue: alt.cue };
  }
  return null;
}

/**
 * Apply gym-environment substitutions to a generated session. No-op for full
 * arsenal environments and when equipment data is absent. Preserves every
 * programmed field; only swaps name + equipment (with an honest note), or keeps
 * the movement and attaches an equipment note when no authored swap exists.
 */
export function applyGymEnvironment(
  template: WorkoutTemplate,
  profile: UserTrainingProfile | null | undefined,
  goal: GoalKey = "maintenance",
): WorkoutTemplate {
  if (!profile) return template;
  if (FULL_ARSENAL_ENVIRONMENTS.includes(profile.gymEnvironment)) return template;
  if (!profile.equipment || profile.equipment.length === 0) return template;

  let changed = false;
  const envLabel = GYM_ENVIRONMENT_LABEL[profile.gymEnvironment];
  const phases = template.phases.map((p) => ({
    ...p,
    movements: p.movements.map((m) => {
      const category = equipmentCategoryFromLabel(m.equipment);
      // Available (bodyweight / band / unknown / the member has it) → untouched.
      if (category === null || profile.equipment.includes(category)) return m;

      const sub = authoredSubstitute(m, profile, goal);
      changed = true;
      if (sub) {
        return {
          ...m,
          name: sub.name,
          equipment: sub.equipment,
          swappedFrom: m.name,
          notes: `${envLabel} swap (${sub.basis}) — from ${m.name}. ${sub.cue}`,
        };
      }
      // No safe authored substitution → preserve the movement, honest equipment note.
      return {
        ...m,
        notes: `Requires ${m.equipment} — not in your equipment list. Kept as programmed; add the equipment or substitute a same-tissue movement you can perform.`,
      };
    }),
  }));

  return changed ? { ...template, phases } : template;
}
