/* Audit the ACTUAL weekly muscle frequency the engine produces for each
   women's physique architecture. Counts a muscle group as "trained" on a day
   if any non-recovery movement in that day's built session targets it.
   Sessions are built at full spec ("when recovery and schedule allow"). */
import {
  WORKOUT_TEMPLATES,
  applyWomensSession,
  allTemplateMovements,
  type WomensSessionKind,
  type WorkoutTemplate,
} from "../src/lib/training/workout-templates";

type Tok = "GW" | "QS" | "GH" | "BL" | "US" | "AD" | "REC";

const KIND: Partial<Record<Tok, WomensSessionKind>> = {
  GW: "glute-strength-waist",
  QS: "quad-shape-glute-support",
  GH: "glute-hamstring-shape",
  BL: "back-line-delts-conditioning",
  US: "upper-sculpt-posture",
};

const LEG_BASE = WORKOUT_TEMPLATES["legs"];
const UPPER_BASE = WORKOUT_TEMPLATES["upper"];
const ARMS_DELTS = WORKOUT_TEMPLATES["arms-delts"];

function sessionFor(tok: Tok): WorkoutTemplate | null {
  if (tok === "REC") return null;
  if (tok === "AD") return ARMS_DELTS;
  const kind = KIND[tok]!;
  const base = tok === "BL" || tok === "US" ? UPPER_BASE : LEG_BASE;
  return applyWomensSession(base, kind, "strong");
}

function group(m: string): string | null {
  const s = m.toLowerCase();
  if (/glute/.test(s)) return "Glutes";
  if (/quad/.test(s)) return "Quads";
  if (/hamstring/.test(s)) return "Hamstrings";
  if (/calf|calve|soleus|gastro/.test(s)) return "Calves";
  if (/lat|back|trap/.test(s)) return "Back";
  if (/delt|shoulder/.test(s)) return "Delts";
  if (/chest|pec/.test(s)) return "Chest";
  if (/bicep|tricep|\barm|forearm/.test(s)) return "Arms";
  if (/core|\bab|oblique|waist/.test(s)) return "Core";
  if (/condition|cardio/.test(s)) return "Conditioning";
  return null;
}

const WEEKS: Record<string, Tok[]> = {
  "Runway Shape (runway)": ["GW", "BL", "QS", "REC", "GH", "US", "REC"],
  "Glute Ascend (glute-quad)": ["GW", "QS", "US", "REC", "GH", "AD", "REC"],
  "Sculpted/Complete Legs (lean-recomp)": ["QS", "BL", "GH", "REC", "GW", "US", "REC"],
  "Glute Crown (glute-upper)": ["GW", "US", "QS", "REC", "GH", "BL", "REC"],
  "Athletic Model (athletic-model)": ["QS", "BL", "GW", "REC", "GH", "US", "REC"],
  "Vacation Physique (lifestyle-shape)": ["GW", "BL", "REC", "QS", "US", "REC", "REC"],
};

const ORDER = ["Glutes", "Quads", "Hamstrings", "Calves", "Back", "Delts", "Chest", "Arms", "Core", "Conditioning"];

for (const [name, toks] of Object.entries(WEEKS)) {
  const counts: Record<string, number> = {};
  let trainingDays = 0;
  let recoveryDays = 0;
  for (const tok of toks) {
    if (tok === "REC") { recoveryDays++; continue; }
    trainingDays++;
    const t = sessionFor(tok)!;
    const seen = new Set<string>();
    for (const mv of allTemplateMovements(t)) {
      if (mv.role === "recovery") continue;
      const g = group(mv.targetMuscle);
      if (g) seen.add(g);
    }
    for (const g of seen) counts[g] = (counts[g] ?? 0) + 1;
  }
  const line = ORDER.filter((g) => counts[g]).map((g) => `${g} ${counts[g]}x`).join(" · ");
  console.log(`\n${name}  [${trainingDays} train · ${recoveryDays} recovery]`);
  console.log("  " + line);
}
