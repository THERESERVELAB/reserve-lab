/* ════════════════════════════════════════════════════════════════════════
   PROFILE-AWARE PRIORITY OPTIONS — Focus Engine option resolver.
   ------------------------------------------------------------------------
   The Muscle Priority / Focus Engine used to render a single female-leaning
   goal list to every member, so a male bodybuilder saw "Grow Glutes",
   "Runway Shape", "Athletic + Feminine", etc. This resolver returns the right
   option set for the member's PROFILE (gender / profile path / active women's
   protocol), while keeping every option editable and the full library
   browsable. Premium, respectful, high-performance on both sides — no pink/blue
   stereotypes, female is never "easy", male is never "only chest and arms".

   Each option maps to canonical store fields (PhysiqueFocus: primary / secondary
   / support / track) so applying it drives the real training architecture. It
   also carries its own premium preview copy so composite identities (V-Taper,
   Strength Density, Runway Shape) read correctly even when several map to the
   same underlying tissue. Pure data + deterministic resolver — no medical,
   dosing, hormone, or supplement content.
   ════════════════════════════════════════════════════════════════════════ */

import type { MusclePriority, WomensTrack } from "@/lib/physique/types";

export type PriorityProfileKind = "male" | "female" | "neutral";

export type PriorityOption = {
  /** Stable id (used as React key + active-state lookup). */
  id: string;
  /** Member-facing chip label. */
  label: string;
  /** Short description (chip tooltip). */
  description: string;
  /** Canonical focus mapping → physiqueCommand.focus. */
  primary?: MusclePriority;
  secondary?: MusclePriority[];
  support?: MusclePriority[];
  /** Women's physique track (premium architecture) — set instead of muscles. */
  track?: WomensTrack;
  /** Matching protocol families / categories / tracks (informational). */
  families: string[];
  /** Preview headline shown in the Architecture Preview panel. */
  previewTitle: string;
  /** Preview body — what the week becomes. */
  previewExplanation: string;
  /** One-line training intent. */
  intent: string;
  /** Optional archetype-template influence (Protocol Architecture 2.0). */
  archetypeInfluence?: string;
};

const W = ["womens-performance"];

/* ─── MALE — structure · density · strength · power · output ──────────────── */
export const malePriorityOptions: PriorityOption[] = [
  {
    id: "build-chest-dominance", label: "Build Chest Dominance",
    description: "Chest leads — pressing strength + upper-chest detail, back supported.",
    primary: "chest", secondary: ["upper-chest"], support: ["arms", "back-width"],
    families: ["classic-physique", "premium-advanced"],
    previewTitle: "Chest Priority Rotation",
    previewExplanation: "Chest leads the week with upper chest, pressing strength, back support, and recovery-balanced secondary exposure.",
    intent: "Press strength and chest hypertrophy lead; back supports posture and balance.",
    archetypeInfluence: "chest-strength / chest-hypertrophy",
  },
  {
    id: "upper-chest-priority", label: "Upper Chest Priority",
    description: "Incline-biased pressing for the upper shelf.",
    primary: "upper-chest", secondary: ["chest"], support: ["delts", "arms"],
    families: ["classic-physique"],
    previewTitle: "Upper-Chain Chest Priority Rotation",
    previewExplanation: "Upper chest gets first exposure every week — incline pressing and clavicular detail lead, lower chest and triceps support.",
    intent: "Incline-biased pressing to build the upper shelf.",
    archetypeInfluence: "chest-detail / chest-strength",
  },
  {
    id: "back-width", label: "Back Width",
    description: "Pulldowns, pull-ups, and lat width lead.",
    primary: "back-width", secondary: ["back-thickness"], support: ["arms", "core"],
    families: ["classic-physique", "athletic-performance"],
    previewTitle: "Back Width Rotation",
    previewExplanation: "Lat width leads — pulldowns, pull-ups, and lengthened lat work shape the week, with thickness and arms supported.",
    intent: "Vertical pulling and lat isolation for width.",
    archetypeInfluence: "back-width",
  },
  {
    id: "back-thickness", label: "Back Thickness",
    description: "Rows and mid-back density lead.",
    primary: "back-thickness", secondary: ["back-width"], support: ["arms", "core"],
    families: ["lean-bulk", "premium-advanced"],
    previewTitle: "Back Thickness Rotation",
    previewExplanation: "Row volume and mid-back density lead the week, with width work and arms supporting the frame.",
    intent: "Heavy rows and hinges for mid-back density.",
    archetypeInfluence: "back-thickness",
  },
  {
    id: "delts-cap", label: "Delts Cap",
    description: "Overhead and lateral volume for the cap.",
    primary: "delts", secondary: ["arms"], support: ["back-width", "core"],
    families: ["classic-physique", "premium-advanced"],
    previewTitle: "Delt Priority Rotation",
    previewExplanation: "Delts lead — overhead and lateral volume build the cap, with arms and upper back supporting the line.",
    intent: "Lateral and overhead delt volume for shoulder width.",
    archetypeInfluence: "delts-arms / shoulders",
  },
  {
    id: "arms-specialization", label: "Arms Specialization",
    description: "Direct biceps / triceps volume and finishers.",
    primary: "arms", secondary: ["delts"], support: ["chest", "back-width"],
    families: ["classic-physique"],
    previewTitle: "Arm Specialization Rotation",
    previewExplanation: "Biceps and triceps get dedicated specialization volume and finishers, with chest and back maintained.",
    intent: "Direct arm volume and pump density.",
    archetypeInfluence: "arms-pump",
  },
  {
    id: "v-taper", label: "V-Taper",
    description: "Width up top, waist tight — the classic V.",
    primary: "back-width", secondary: ["delts", "upper-chest"], support: ["arms", "core"],
    families: ["classic-physique", "premium-advanced"],
    previewTitle: "V-Taper Architecture",
    previewExplanation: "Back width, delts, upper chest, arms, and conditioning shape the week around structure and stage presence.",
    intent: "Build width up top and hold the waist tight.",
    archetypeInfluence: "back-width / delts-arms",
  },
  {
    id: "classic-physique", label: "Classic Physique",
    description: "Symmetry and proportion across the torso.",
    primary: "chest", secondary: ["back-width", "delts"], support: ["arms", "quads"],
    families: ["classic-physique"],
    previewTitle: "Classic Physique Architecture",
    previewExplanation: "Balanced upper-body proportion leads — chest, back, and delts shaped together with arm detail and a maintained lower body.",
    intent: "Symmetry and proportion across the whole torso.",
    archetypeInfluence: "chest-strength / back-width",
  },
  {
    id: "strength-density", label: "Strength Density",
    description: "Heavy compounds with hypertrophy support.",
    primary: "quads", secondary: ["back-thickness", "chest"], support: ["core"],
    families: ["lean-bulk", "premium-advanced"],
    previewTitle: "Strength Density Block",
    previewExplanation: "Heavy compounds lead the week with enough hypertrophy work to build size without losing performance.",
    intent: "Heavy compound lifting backed by hypertrophy density.",
    archetypeInfluence: "lower-strength / upper-strength",
  },
  {
    id: "athletic-power", label: "Athletic Power",
    description: "Explosive lower-body output and force.",
    primary: "quads", secondary: ["hamstrings", "glutes"], support: ["core", "conditioning"],
    families: ["athletic-performance"],
    previewTitle: "Athletic Power Block",
    previewExplanation: "Explosive lower-body output and posterior power lead, with core and conditioning supporting athletic force.",
    intent: "Power and explosive force production.",
    archetypeInfluence: "lower-power / sprint-power",
  },
  {
    id: "conditioning-shred", label: "Conditioning / Shred",
    description: "Conditioning while training holds muscle.",
    primary: "conditioning", secondary: [], support: ["core", "quads"],
    families: ["shred-cut", "vacation-prep"],
    previewTitle: "Conditioning / Shred Block",
    previewExplanation: "Conditioning and work capacity lead while training holds muscle — intervals, core, and a lean-focused weekly rhythm.",
    intent: "Fat-loss conditioning while protecting muscle.",
    archetypeInfluence: "conditioning / sport-conditioning",
  },
  {
    id: "lean-bulk", label: "Lean Bulk",
    description: "Whole-body hypertrophy for clean size.",
    primary: "chest", secondary: ["back-thickness", "quads"], support: ["arms"],
    families: ["lean-bulk"],
    previewTitle: "Lean Bulk Architecture",
    previewExplanation: "Balanced push, pull, and leg hypertrophy lead a controlled lean-gain week with arm detail layered in.",
    intent: "Whole-body hypertrophy for clean, controlled size.",
    archetypeInfluence: "upper-hypertrophy / lower-strength",
  },
  {
    id: "full-body-performance", label: "Full Body Performance",
    description: "Balanced strength + conditioning + recovery.",
    primary: "conditioning", secondary: ["quads", "back-width"], support: ["core"],
    families: ["athletic-performance", "recomp"],
    previewTitle: "Full Body Performance Week",
    previewExplanation: "Strength, conditioning, mobility, and recovery are balanced around full-body athletic output.",
    intent: "Balanced strength and conditioning for performance.",
    archetypeInfluence: "full-body-athletic",
  },
  {
    id: "posterior-chain-power", label: "Posterior Chain Power",
    description: "Hinge strength and hamstring / glute power.",
    primary: "hamstrings", secondary: ["glutes"], support: ["calves", "core"],
    families: ["athletic-performance", "lean-bulk"],
    previewTitle: "Posterior Chain Power",
    previewExplanation: "Hinge strength and hamstring / glute power lead, with calves and core supporting the posterior chain.",
    intent: "Hinge strength and posterior-chain power.",
    archetypeInfluence: "posterior-chain / hamstring-glute",
  },
  {
    id: "core-abs-detail", label: "Core / Abs Detail",
    description: "Bracing, anti-rotation, and ab detail.",
    primary: "core", secondary: [], support: ["conditioning"],
    families: ["athletic-performance"],
    previewTitle: "Core / Abs Detail Rotation",
    previewExplanation: "Direct core and ab work gets dedicated emphasis inside a complete, balanced week.",
    intent: "Bracing, anti-rotation, and ab detail.",
    archetypeInfluence: "core",
  },
  {
    id: "mobility-recovery", label: "Mobility + Recovery",
    description: "Mobility, tissue quality, and recovery.",
    primary: "mobility", secondary: [], support: ["core"],
    families: ["recomp", "lifestyle-reset"],
    previewTitle: "Mobility + Recovery Rhythm",
    previewExplanation: "Mobility, tissue quality, and recovery lead a restorative week that keeps strength maintained.",
    intent: "Mobility and recovery emphasis.",
    archetypeInfluence: "mobility / recovery",
  },
];

/* ─── FEMALE — glute architecture · shape · posture · athletic confidence ──── */
export const femalePriorityOptions: PriorityOption[] = [
  {
    id: "build-lower-body-shape", label: "Build Lower Body Shape",
    description: "Glutes, quads, and hamstrings shaped together.",
    primary: "glutes", secondary: ["quads", "hamstrings"], support: ["calves", "core"],
    families: W,
    previewTitle: "Lower Body Shape Rotation",
    previewExplanation: "Lower body leads — glutes, quads, and hamstrings shaped together with calf and core support and recovery rhythm.",
    intent: "Complete, balanced lower-body shape.",
    archetypeInfluence: "glute-strength / quad-focus",
  },
  {
    id: "grow-glutes", label: "Grow Glutes",
    description: "Glutes lead across the week.",
    primary: "glutes", secondary: ["hamstrings"], support: ["calves", "core"],
    families: W,
    previewTitle: "Glute Architecture Rotation",
    previewExplanation: "Glutes lead the week with hamstring support, abductors, posture, waistline, and recovery rhythm.",
    intent: "Glute development trained across the week, not one day.",
    archetypeInfluence: "glute-strength / glute-shape / glute-pump",
  },
  {
    id: "shape-quads-hamstrings", label: "Shape Quads + Hamstrings",
    description: "Knee-dominant and hinge work, glutes supported.",
    primary: "quads", secondary: ["hamstrings"], support: ["glutes", "calves"],
    families: W,
    previewTitle: "Quad + Hamstring Shape Rotation",
    previewExplanation: "Quads and hamstrings shaped together — knee-dominant and hinge work with glute and calf support.",
    intent: "Balanced quad and hamstring shape.",
    archetypeInfluence: "quad-focus / hamstring-glute",
  },
  {
    id: "complete-legs", label: "Complete Legs",
    description: "Full lower-body development.",
    primary: "quads", secondary: ["hamstrings", "glutes"], support: ["calves", "core"],
    families: W,
    previewTitle: "Complete Legs Architecture",
    previewExplanation: "Full lower-body development — quads, hamstrings, and glutes trained completely with calf and core support.",
    intent: "Complete, balanced leg development.",
    archetypeInfluence: "quad-focus / glute-strength",
  },
  {
    id: "tight-waist-strong-lower", label: "Tight Waist + Strong Lower Body",
    description: "Strong lower body with waist control.",
    primary: "glutes", secondary: ["quads"], support: ["core"],
    families: W,
    previewTitle: "Waist + Lower Body Rotation",
    previewExplanation: "Lower-body strength leads with dedicated waistline and core control — strong glutes, tight midsection.",
    intent: "Strong lower body with deliberate waist control.",
    archetypeInfluence: "glute-strength / waistline",
  },
  {
    id: "strength-with-curves", label: "Strength With Curves",
    description: "Lower-body strength with a clean back line.",
    primary: "glutes", secondary: ["quads", "hamstrings"], support: ["back-width", "core"],
    families: W,
    previewTitle: "Strength + Curves Rotation",
    previewExplanation: "Lower-body strength leads with a clean back line and core — strong, shaped, and confident.",
    intent: "Lower-body strength with upper-line support.",
    archetypeInfluence: "glute-strength / posture-upper",
  },
  {
    id: "shoulder-line-posture", label: "Shoulder Line + Posture",
    description: "Delts and back for an elegant upper line.",
    primary: "delts", secondary: ["back-width"], support: ["core"],
    families: W,
    previewTitle: "Shoulder Line + Posture Rotation",
    previewExplanation: "Delts and back lead an elegant upper line — shoulder shape, posture, and core control.",
    intent: "Shoulder shape and posture, not chest-heavy.",
    archetypeInfluence: "posture-upper / upper-tone",
  },
  {
    id: "improve-conditioning-f", label: "Improve Conditioning",
    description: "Conditioning and work capacity with core.",
    primary: "conditioning", secondary: [], support: ["core"],
    families: W,
    previewTitle: "Conditioning Rotation",
    previewExplanation: "Conditioning and work capacity lead with core support inside a balanced week.",
    intent: "Conditioning and core capacity.",
    archetypeInfluence: "conditioning",
  },
  {
    id: "hybrid-pilates-gym", label: "Hybrid Pilates + Gym Shape",
    description: "Pilates and gym shape, low-impact friendly.",
    track: "hybrid-pilates", families: W,
    previewTitle: "Studio",
    previewExplanation: "Pilates, core control, and gym shape work pair into a refined, low-impact-friendly week.",
    intent: "Pilates and gym shape hybrid.",
    archetypeInfluence: "pilates / glute-shape",
  },
  {
    id: "sport-strength-balance", label: "Sport + Strength Balance",
    description: "Athletic lower body, tone, and conditioning.",
    track: "sport-strength", families: W,
    previewTitle: "Field",
    previewExplanation: "Athletic lower body, upper tone, conditioning, and recovery layers support performance without losing shape.",
    intent: "Sport performance balanced with strength and shape.",
    archetypeInfluence: "glute-strength / sport-conditioning",
  },
  {
    id: "runway-shape", label: "Runway Shape",
    description: "Refined lower-body shape, posture, and line.",
    track: "runway", families: W,
    previewTitle: "Runway",
    previewExplanation: "Lower-body shape, shoulder line, posture, core control, and low-impact conditioning build a refined physique rhythm.",
    intent: "A refined, runway-ready physique rhythm.",
    archetypeInfluence: "glute-strength / posture-upper",
  },
  {
    id: "athletic-feminine", label: "Athletic + Feminine",
    description: "Strong, conditioned, athletic shape.",
    track: "athletic-model", families: W,
    previewTitle: "Off-Duty",
    previewExplanation: "Strong, conditioned, athletic training shapes an athletic physique with performance and shape balanced.",
    intent: "Athletic performance and shape together.",
    archetypeInfluence: "quad-focus / sport-conditioning",
  },
  {
    id: "vacation-physique", label: "Vacation Physique",
    description: "Event-ready shape on a busy-week structure.",
    track: "lifestyle-shape", families: W,
    previewTitle: "Resort",
    previewExplanation: "Efficient lower and upper shape with conditioning on a busy-week structure and protected recovery.",
    intent: "Efficient, event-ready shape.",
    archetypeInfluence: "glute-strength / legs-waistline",
  },
  {
    id: "signature-shape", label: "Signature Shape",
    description: "Balanced five-day complete foundation.",
    track: "signature-shape", families: W,
    previewTitle: "Signature",
    previewExplanation: "A balanced five-day foundation — glutes, legs, upper line, and core shaped across a complete week.",
    intent: "Balanced, complete physique foundation.",
    archetypeInfluence: "glute-strength / upper-tone",
  },
  {
    id: "glute-detail", label: "Glute Detail",
    description: "Single-leg, abductors, and shape refinement.",
    primary: "glutes", secondary: ["calves"], support: ["core"],
    families: W,
    previewTitle: "Glute Detail Rotation",
    previewExplanation: "Single-leg work, abductors, and the glute-ham tie-in refine shape and side-to-side balance.",
    intent: "Glute shape refinement and balance.",
    archetypeInfluence: "glute-detail / abductors",
  },
  {
    id: "waistline-core", label: "Waistline + Core",
    description: "Anti-rotation waist control, low-impact.",
    primary: "core", secondary: [], support: ["conditioning"],
    families: W,
    previewTitle: "Waistline + Core Rotation",
    previewExplanation: "Anti-rotation and waist control lead with low-impact conditioning to support a tight midsection.",
    intent: "Waist control and core conditioning.",
    archetypeInfluence: "waistline / core",
  },
  {
    id: "mobility-recovery-f", label: "Mobility + Recovery",
    description: "Mobility, posture, and recovery rhythm.",
    primary: "mobility", secondary: [], support: ["core"],
    families: W,
    previewTitle: "Mobility + Recovery Rhythm",
    previewExplanation: "Mobility, posture, and recovery lead a restorative week that keeps shape maintained.",
    intent: "Mobility and recovery emphasis.",
    archetypeInfluence: "mobility / pilates",
  },
];

/* ─── NEUTRAL — premium, goal-based, no forced gendered copy ───────────────── */
export const neutralPriorityOptions: PriorityOption[] = [
  {
    id: "build-strength", label: "Build Strength",
    description: "Heavy compound strength leads.",
    primary: "quads", secondary: ["chest", "back-thickness"], support: ["core"],
    families: ["lean-bulk", "athletic-performance"],
    previewTitle: "Strength Block",
    previewExplanation: "Heavy compound strength leads the week — squat / hinge, press, and pull patterns prioritized with core support.",
    intent: "Full-body compound strength.",
    archetypeInfluence: "lower-strength / upper-strength",
  },
  {
    id: "improve-conditioning", label: "Improve Conditioning",
    description: "Conditioning and work capacity with core.",
    primary: "conditioning", secondary: [], support: ["core"],
    families: ["shred-cut", "athletic-performance"],
    previewTitle: "Conditioning Rotation",
    previewExplanation: "Conditioning and work capacity lead with core support inside a balanced week.",
    intent: "Conditioning and core capacity.",
    archetypeInfluence: "conditioning",
  },
  {
    id: "full-body-shape", label: "Full Body Shape",
    description: "Balanced push, pull, and legs.",
    primary: "chest", secondary: ["back-width", "quads"], support: ["core"],
    families: ["recomp", "transformation"],
    previewTitle: "Full Body Shape Week",
    previewExplanation: "Balanced push, pull, and leg shape across a complete week, organized around your selected goal.",
    intent: "Balanced full-body development.",
    archetypeInfluence: "full-body-athletic",
  },
  {
    id: "upper-body-priority", label: "Upper Body Priority",
    description: "Upper-body strength and shape lead.",
    primary: "chest", secondary: ["back-width", "delts"], support: ["arms"],
    families: ["classic-physique", "lean-bulk"],
    previewTitle: "Upper Body Priority",
    previewExplanation: "Upper-body strength and shape lead the week while lower-body and recovery work stay maintained.",
    intent: "Upper-body strength and shape focus.",
    archetypeInfluence: "upper-strength / chest-hypertrophy",
  },
  {
    id: "lower-body-priority", label: "Lower Body Priority",
    description: "Lower-body strength and shape lead.",
    primary: "quads", secondary: ["glutes", "hamstrings"], support: ["calves", "core"],
    families: ["athletic-performance", "recomp"],
    previewTitle: "Lower Body Priority",
    previewExplanation: "Lower-body strength and shape lead the week while upper body stays maintained.",
    intent: "Lower-body strength and shape focus.",
    archetypeInfluence: "quad-focus / posterior-chain",
  },
  {
    id: "athletic-performance", label: "Athletic Performance",
    description: "Strength, power, and conditioning balanced.",
    primary: "quads", secondary: ["hamstrings", "glutes"], support: ["conditioning", "core"],
    families: ["athletic-performance"],
    previewTitle: "Athletic Performance Week",
    previewExplanation: "Strength, power, and conditioning are balanced for athletic output, with core supporting force transfer.",
    intent: "Athletic output across strength and conditioning.",
    archetypeInfluence: "lower-power / full-body-athletic",
  },
  {
    id: "lean-muscle", label: "Lean Muscle",
    description: "Balanced hypertrophy for clean lean muscle.",
    primary: "chest", secondary: ["back-thickness", "quads"], support: ["arms"],
    families: ["lean-bulk", "recomp"],
    previewTitle: "Lean Muscle Architecture",
    previewExplanation: "Balanced hypertrophy across push, pull, and legs builds clean lean muscle with arm detail layered in.",
    intent: "Balanced hypertrophy for lean muscle.",
    archetypeInfluence: "upper-hypertrophy / lower-strength",
  },
  {
    id: "core-strength", label: "Core Strength",
    description: "Direct core and trunk strength.",
    primary: "core", secondary: [], support: ["conditioning"],
    families: ["athletic-performance"],
    previewTitle: "Core Strength Rotation",
    previewExplanation: "Direct core and trunk strength get dedicated emphasis inside a complete, balanced week.",
    intent: "Trunk strength and bracing.",
    archetypeInfluence: "core",
  },
  {
    id: "mobility-recovery-n", label: "Mobility + Recovery",
    description: "Mobility, tissue quality, and recovery.",
    primary: "mobility", secondary: [], support: ["core"],
    families: ["lifestyle-reset", "recomp"],
    previewTitle: "Mobility + Recovery Rhythm",
    previewExplanation: "Mobility, tissue quality, and recovery lead a restorative week that keeps progress maintained.",
    intent: "Mobility and recovery emphasis.",
    archetypeInfluence: "mobility / recovery",
  },
  {
    id: "sport-performance", label: "Sport Performance",
    description: "Agility, conditioning, and capacity.",
    primary: "conditioning", secondary: ["quads"], support: ["core"],
    families: ["athletic-performance"],
    previewTitle: "Sport Performance Week",
    previewExplanation: "Agility, conditioning, and athletic capacity lead the week with lower-body strength support.",
    intent: "Sport capacity and conditioning.",
    archetypeInfluence: "sport-conditioning",
  },
  {
    id: "hybrid-training", label: "Hybrid Training",
    description: "Strength and conditioning blended.",
    primary: "conditioning", secondary: ["chest", "quads"], support: ["core"],
    families: ["athletic-performance", "recomp"],
    previewTitle: "Hybrid Training Week",
    previewExplanation: "Strength and conditioning blend across a balanced full-body week organized around your goal.",
    intent: "Blended strength and conditioning.",
    archetypeInfluence: "full-body-athletic / conditioning",
  },
];

/* ─── Resolver + matcher ──────────────────────────────────────────────────── */

export type PriorityProfileContext = {
  genderIdentity?: string | null;
  womensEnabled?: boolean;
  profilePath?: string | null;
  protocolCategory?: string | null;
  womensTrack?: string | null;
};

/** Resolve the profile-appropriate option set. Gender is one input among
 *  several (path / active women's protocol / explicit identity); custom /
 *  inclusive / unknown stays goal-based and is never forced into a gendered lane. */
export function getPriorityOptionSet(ctx: PriorityProfileContext): { kind: PriorityProfileKind; options: PriorityOption[] } {
  const g = (ctx.genderIdentity ?? "").toLowerCase();
  const female =
    g === "female" ||
    ctx.womensEnabled === true ||
    ctx.profilePath === "womens-performance" ||
    ctx.protocolCategory === "womens-performance" ||
    Boolean(ctx.womensTrack);
  if (female) return { kind: "female", options: femalePriorityOptions };
  const male = g === "male" || ctx.profilePath === "mens-performance";
  if (male) return { kind: "male", options: malePriorityOptions };
  return { kind: "neutral", options: neutralPriorityOptions };
}

export type PriorityFocusSelection = {
  primary: MusclePriority | null;
  secondary: MusclePriority[];
  support: MusclePriority[];
  track: WomensTrack | null;
};

/** True when a focus selection exactly matches this option (tuple match). */
export function priorityOptionMatches(o: PriorityOption, sel: PriorityFocusSelection): boolean {
  if (o.track) return sel.track === o.track && !sel.primary;
  return (
    !sel.track &&
    sel.primary === (o.primary ?? null) &&
    sel.secondary.join() === (o.secondary ?? []).join() &&
    sel.support.join() === (o.support ?? []).join()
  );
}

/** Find the active option in a set for a given focus selection (or null). */
export function findActivePriorityOption(options: PriorityOption[], sel: PriorityFocusSelection): PriorityOption | null {
  return options.find((o) => priorityOptionMatches(o, sel)) ?? null;
}
