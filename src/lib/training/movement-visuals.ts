/* ════════════════════════════════════════════════════════════════════════
   RESERVE MOVEMENT MEDIA SYSTEM v2 — image + slow-motion loop, gender-aware.
   ------------------------------------------------------------------------
   Every movement can resolve to a STORED / generated media set (never
   generated at runtime). Each movement carries gender-aware variants
   (male / female / neutral), and each variant carries a static image set AND
   a slow-motion loop (video-first: MP4 + WebM, silent autoloop — the user
   perceives a premium GIF, the app ships efficient video). Reserve branding is
   metadata only; the UI frame draws the watermark (AI-baked logos misspell).

   Selection: female for women's-performance / female identity, male for
   men's-performance / male identity, neutral otherwise. Fallback chain:
   requested-gender → neutral → opposite (only if allowed) → static image →
   anatomy HUD. Support / recovery blocks never show an athlete demo.

   Pure data + deterministic resolvers. No medical/dosing content, no runtime
   AI generation.
   ════════════════════════════════════════════════════════════════════════ */

export type MovementMediaGender = "male" | "female" | "neutral";
export type MovementAspect = "16:9" | "4:5" | "1:1" | "9:16";
export type MovementVisualStyle = "cinematic-4k" | "studio-demo" | "anatomy-hud";
export type MovementVisualKind = "exercise" | "support" | "recovery";
export type MovementVisualCategory =
  | "glute" | "chest" | "back" | "legs" | "arms" | "shoulders" | "core" | "conditioning" | "recovery";
export type LoopPlayback = "slow-loop" | "tempo-demo" | "form-demo";

export type MovementMediaImage = { desktop?: string; tablet?: string; mobile?: string; alt: string };
export type MovementMediaLoop = {
  mp4?: string;
  webm?: string;
  poster?: string;
  alt: string;
  durationSec?: number;
  playback: LoopPlayback;
};
export type MovementMediaVariant = {
  gender: MovementMediaGender;
  image?: MovementMediaImage;
  loop?: MovementMediaLoop;
  /** false → assets not shipped yet; the UI shows the static/pending fallback. */
  ready: boolean;
};

export type ReserveBranding = {
  watermark: boolean;
  position: "top-left" | "bottom-left" | "bottom-right";
  label: "RESERVE LAB" | "THE RESERVE METHOD";
  showInMediaFrame: boolean;
};

export type MovementVisual = {
  movementId: string;
  movementName: string;
  kind: MovementVisualKind;
  visualStyle: MovementVisualStyle;
  category: MovementVisualCategory;
  primaryMuscles: string[];
  equipment?: string;
  aspect: MovementAspect;
  variants: MovementMediaVariant[];
  reserveBranding: ReserveBranding;
  /** Static image prompt (gender filled at generation time). */
  prompt?: string;
  loopPromptMale?: string;
  loopPromptFemale?: string;
  negativePrompt?: string;
  /** Any variant ready. */
  ready?: boolean;
};

export const DEFAULT_RESERVE_BRANDING: ReserveBranding = {
  watermark: true,
  position: "bottom-left",
  label: "RESERVE LAB",
  showInMediaFrame: true,
};

/* ─── Prompt templates (documented for the asset pipeline; never run here) ── */
export const MOVEMENT_NEGATIVE_PROMPT =
  "blurry, low resolution, distorted anatomy, extra limbs, missing limbs, bad hands, warped equipment, unreadable text, misspelled logo, watermark, external brand logo, cartoon, anime, oversexualized, medical gore, unrealistic muscle size, cluttered background, poor lighting, unsafe form, impossible joint position.";

function muscleList(primaryMuscles: string[]): string {
  return primaryMuscles.length ? primaryMuscles.join(", ") : "the target muscles";
}

export function buildLoopPrompt(movementName: string, primaryMuscles: string[], gender: "male" | "female"): string {
  const who = gender === "female" ? "a female athlete" : "a male athlete";
  const respectful = gender === "female" ? "athletic and respectful presentation, " : "";
  return (
    `Ultra-realistic cinematic 4K slow-motion movement demonstration of ${who} performing ${movementName} ` +
    "with perfect form in a dark luxury private performance lab, premium gym equipment, smooth high-end color " +
    "grading, soft rim lighting, subtle gold and teal highlights, clear full-body position, visible target muscle " +
    `engagement: ${muscleList(primaryMuscles)}, professional editorial sports cinematography, clean background, ` +
    "subtle Reserve Lab environment branding, no external logos, no watermark, no on-screen text, realistic human " +
    `proportions, ${respectful}no distortion, no extra limbs, not oversexualized, mobile and desktop friendly ` +
    "composition. Create a seamless slow loop showing the eccentric and concentric phases."
  );
}

export function buildStaticPrompt(movementName: string, primaryMuscles: string[], gender?: "male" | "female"): string {
  const who = gender === "female" ? "female" : gender === "male" ? "male" : "[male or female]";
  return (
    `Ultra-realistic 4K cinematic fitness movement demonstration of ${movementName}, ${who} athlete performing the ` +
    "exercise with perfect form in a dark luxury private performance lab, premium gym equipment, smooth high-end " +
    "color grading, soft rim lighting, subtle gold and teal highlights, sharp focus, realistic human proportions, " +
    `clear full-body position, visible target muscle engagement: ${muscleList(primaryMuscles)}, professional ` +
    "editorial sports photography, clean background, subtle Reserve Lab environment branding, no external logos, " +
    "no readable on-image text, no watermark, no distortion, no extra limbs, no exaggerated anatomy, no sexualized " +
    "pose, mobile and desktop friendly composition."
  );
}

/* ─── Helpers ─────────────────────────────────────────────────────────────── */
export function normalizeMovementKey(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function categoryForMuscles(primaryMuscles: string[], equipment?: string): MovementVisualCategory {
  const m = primaryMuscles.map((x) => x.toLowerCase()).join(" ");
  const e = (equipment ?? "").toLowerCase();
  if (/glute/.test(m)) return "glute";
  if (/quad|hamstring|calf|calves|adductor|abductor/.test(m)) return "legs";
  if (/upper chest|lower chest|inner chest|\bchest\b|pec/.test(m)) return "chest";
  if (/lat|back|trap|rhomboid/.test(m)) return "back";
  if (/delt|shoulder/.test(m)) return "shoulders";
  if (/bicep|tricep|forearm|arm/.test(m)) return "arms";
  if (/core|ab\b|abs|oblique|waist/.test(m)) return "core";
  if (/conditioning|cardio|power|sprint/.test(m) || /rower|sled|bike|treadmill/.test(e)) return "conditioning";
  if (/recovery|mobility|sauna|breath/.test(m)) return "recovery";
  return "legs";
}

function isSupportMovement(name: string, role?: string): boolean {
  const n = name.toLowerCase();
  return role === "recovery" || /handoff|sauna|optional abs|cardio|cooldown|zone ?2|recovery|mobility flow|breath/.test(n);
}

/* Build a gender variant for a movement slug. Asset tree (per spec):
   public/movements/<slug>/<gender>/{poster,loop}-{16x9,4x5,9x16}.{webp,webm,mp4}

   `shippedPosterExt` is set when a REAL still has been committed for this gender
   (poster only — no loop video yet). It returns a complete, type-safe variant
   with every responsive crop pointing at that single shipped poster, so the
   dashboard renders the image (not a 404ing <video>) and we never mutate an
   optional field after the fact. Without it, the spec'd per-aspect paths are
   used and the variant stays `ready: false` until assets ship. */
function buildVariant(
  slug: string,
  gender: "male" | "female" | "neutral",
  name: string,
  muscles: string[],
  ready: boolean,
  shippedPosterExt?: "webp" | "png" | "jpeg",
): MovementMediaVariant {
  const base = `/movements/${slug}/${gender}`;
  const alt = `${gender === "neutral" ? "" : gender + " "}athlete performing ${name} — target: ${muscleList(muscles)}.`;
  if (shippedPosterExt) {
    const poster = `${base}/poster-16x9.${shippedPosterExt}`;
    // Poster shipped, no loop video yet → image-only variant (renders the still).
    return { gender, image: { desktop: poster, tablet: poster, mobile: poster, alt }, ready };
  }
  return {
    gender,
    image: { desktop: `${base}/poster-16x9.webp`, tablet: `${base}/poster-4x5.webp`, mobile: `${base}/poster-9x16.webp`, alt },
    loop: { mp4: `${base}/loop-16x9.mp4`, webm: `${base}/loop-16x9.webm`, poster: `${base}/poster-16x9.webp`, alt, durationSec: 6, playback: "slow-loop" },
    ready,
  };
}

type SampleSeed = {
  name: string;
  aliases?: string[];
  category: MovementVisualCategory;
  primaryMuscles: string[];
  equipment: string;
  maleReady?: boolean;
  malePosterExt?: "webp" | "png" | "jpeg";
  /* A female poster ships on exactly the same terms as a male one. Until this
     existed the female variant was pinned shut, so a shot of a woman training
     had no route to the dashboard however good it was — and the women's
     movements are the ones where a female demo matters most. */
  femaleReady?: boolean;
  femalePosterExt?: "webp" | "png" | "jpeg";
};

const SAMPLE_SEEDS: SampleSeed[] = [
  { name: "Romanian Deadlift", aliases: ["rdl"], category: "legs", primaryMuscles: ["Hamstrings", "Glutes"], equipment: "Barbell", maleReady: true, malePosterExt: "webp", femaleReady: true, femalePosterExt: "webp" },
  { name: "Hip Thrust", aliases: ["barbell hip thrust"], category: "glute", primaryMuscles: ["Glutes"], equipment: "Barbell", femaleReady: true, femalePosterExt: "webp" },
  { name: "Incline Dumbbell Press", aliases: ["incline db press"], category: "chest", primaryMuscles: ["Upper Chest"], equipment: "Dumbbells · Bench", maleReady: true, malePosterExt: "webp" },
  { name: "Low-to-High Cable Fly", aliases: ["low to high cable fly", "low high cable fly", "low-to-high cable chest fly"], category: "chest", primaryMuscles: ["Upper Chest", "Chest"], equipment: "Cable Stack", maleReady: true, malePosterExt: "webp" },
  { name: "Weighted Pull-Up", aliases: ["weighted pull up", "weighted pullup", "pull-up"], category: "back", primaryMuscles: ["Lats", "Upper Back"], equipment: "Pull-Up Bar · Dip Belt", maleReady: true, malePosterExt: "webp" },
  // Chest — approved poster batch (male, 16:9 WebP)
  { name: "Flat Barbell Press", aliases: ["barbell bench press", "flat bench press", "bench press", "flat barbell bench"], category: "chest", primaryMuscles: ["Chest"], equipment: "Barbell · Bench", maleReady: true, malePosterExt: "webp" },
  { name: "Decline Machine Press", aliases: ["decline chest press machine", "decline press machine"], category: "chest", primaryMuscles: ["Lower Chest"], equipment: "Decline Press Machine", maleReady: true, malePosterExt: "webp" },
  { name: "Pec Deck", aliases: ["pec deck fly", "machine pec fly", "pec deck machine chest fly"], category: "chest", primaryMuscles: ["Chest"], equipment: "Pec Deck", maleReady: true, malePosterExt: "webp" },
  { name: "Plate-Loaded Flat Press", aliases: ["plate loaded flat chest press", "plate-loaded flat chest press"], category: "chest", primaryMuscles: ["Chest"], equipment: "Plate-Loaded Press", maleReady: true, malePosterExt: "webp" },
  { name: "Plate-Loaded Incline Press", aliases: ["plate loaded incline chest press", "plate-loaded incline chest press"], category: "chest", primaryMuscles: ["Upper Chest"], equipment: "Plate-Loaded Incline Press", maleReady: true, malePosterExt: "webp" },
  { name: "Seated Cable Chest Press", aliases: ["seated cable press"], category: "chest", primaryMuscles: ["Chest"], equipment: "Cable Stack", maleReady: true, malePosterExt: "webp" },
  { name: "Cable Squeeze Press", aliases: ["standing cable chest press", "cable chest press"], category: "chest", primaryMuscles: ["Chest", "Inner Chest"], equipment: "Cable Stack", maleReady: true, malePosterExt: "webp" },
  // Back — approved poster batch (male, 16:9 WebP)
  { name: "Chest-Supported Dumbbell Row", aliases: ["chest supported dumbbell row"], category: "back", primaryMuscles: ["Mid-Back", "Lats"], equipment: "Dumbbells · Incline Bench", maleReady: true, malePosterExt: "webp" },
  { name: "T-Bar Row", aliases: ["t bar row", "chest-supported t-bar row"], category: "back", primaryMuscles: ["Mid-Back"], equipment: "T-Bar", maleReady: true, malePosterExt: "webp" },
  { name: "Machine Pullover", aliases: ["pullover machine"], category: "back", primaryMuscles: ["Lats"], equipment: "Pullover Machine", maleReady: true, malePosterExt: "webp" },
  { name: "Single-Arm Cable Row", aliases: ["one-arm cable row", "one-arm cable low row", "one arm cable row"], category: "back", primaryMuscles: ["Lats", "Mid-Back"], equipment: "Cable Stack", maleReady: true, malePosterExt: "webp" },
  { name: "Chest-Supported Row", aliases: ["plate-loaded chest-supported row", "chest supported row"], category: "back", primaryMuscles: ["Mid-Back"], equipment: "Row Machine", maleReady: true, malePosterExt: "webp" },
  { name: "Iso-Lateral Row", aliases: ["plate-loaded iso-lateral row", "iso lateral row", "leverage row"], category: "back", primaryMuscles: ["Lats", "Mid-Back"], equipment: "Plate-Loaded Row", maleReady: true, malePosterExt: "webp" },
  { name: "Seated Cable Row", aliases: ["cable row"], category: "back", primaryMuscles: ["Mid-Back"], equipment: "Cable Stack", maleReady: true, malePosterExt: "webp", femaleReady: true, femalePosterExt: "webp" },
  { name: "Cable Row Mechanical Drop", aliases: ["row mechanical drop", "wide-grip seated cable row", "wide grip seated cable row"], category: "back", primaryMuscles: ["Mid-Back"], equipment: "Cable Stack", maleReady: true, malePosterExt: "webp" },
  { name: "Straight-Arm Pulldown", aliases: ["straight-arm pulldown burnout", "straight arm cable pulldown", "straight-arm cable pulldown"], category: "back", primaryMuscles: ["Lats"], equipment: "Cable Stack", maleReady: true, malePosterExt: "webp" },
  { name: "Cable Glute Kickback", aliases: ["cable kickback", "glute kickback"], category: "glute", primaryMuscles: ["Glutes"], equipment: "Cable Stack", femaleReady: true, femalePosterExt: "webp" },
  // Women's library — Reserve-room batch. Legs, glutes and posterior chain first,
  // because those are the patterns where a female demo does the most work.
  { name: "Standing Calf Raise", aliases: ["calf raise", "standing calf raise machine"], category: "legs", primaryMuscles: ["Calves"], equipment: "Calf Raise Machine", femaleReady: true, femalePosterExt: "webp" },
  { name: "Bulgarian Split Squat", aliases: ["rear foot elevated split squat", "split squat"], category: "legs", primaryMuscles: ["Quads", "Glutes"], equipment: "Dumbbells · Bench", femaleReady: true, femalePosterExt: "webp" },
  { name: "Goblet Squat", aliases: ["kettlebell goblet squat"], category: "legs", primaryMuscles: ["Quads", "Glutes"], equipment: "Kettlebell", femaleReady: true, femalePosterExt: "webp" },
  { name: "Box Step-Up", aliases: ["step up", "dumbbell step-up", "box step up"], category: "legs", primaryMuscles: ["Quads", "Glutes"], equipment: "Dumbbells · Plyo Box", femaleReady: true, femalePosterExt: "webp" },
  { name: "Back Extension", aliases: ["45 degree back extension", "hyperextension", "45-degree hyperextension"], category: "glute", primaryMuscles: ["Glutes", "Hamstrings"], equipment: "Hyperextension Bench", femaleReady: true, femalePosterExt: "webp" },
  { name: "Lat Pulldown", aliases: ["wide grip lat pulldown", "wide-grip lat pulldown", "pulldown"], category: "back", primaryMuscles: ["Lats"], equipment: "Cable Stack", maleReady: true, malePosterExt: "webp", femaleReady: true, femalePosterExt: "webp" },
  { name: "Rear Delt Fly", aliases: ["bent-over rear delt fly", "reverse fly", "rear delt raise"], category: "shoulders", primaryMuscles: ["Rear Delts", "Upper Back"], equipment: "Dumbbells", femaleReady: true, femalePosterExt: "webp" },
  /* "dumbbell lateral raise" used to alias here, but the shipped still for that
     name is a standing raise and this seed's is seated. The alias now lives on
     the standing seed below so the label and the photograph agree; "lateral
     raise" stays here because the seated poster is the one with a woman in it. */
  { name: "Seated Lateral Raise", aliases: ["seated dumbbell lateral raise", "lateral raise"], category: "shoulders", primaryMuscles: ["Side Delts"], equipment: "Dumbbells · Bench", femaleReady: true, femalePosterExt: "webp" },
  { name: "Cable Curl", aliases: ["standing cable curl", "cable bicep curl"], category: "arms", primaryMuscles: ["Biceps"], equipment: "Cable Stack", femaleReady: true, femalePosterExt: "webp" },
  // Legs + posterior chain — first Reserve-room batch. The two female posters are
  // the first women's demos the app has ever been able to serve.
  { name: "Deadlift", aliases: ["barbell deadlift", "conventional deadlift"], category: "legs", primaryMuscles: ["Hamstrings", "Glutes", "Mid-Back"], equipment: "Barbell", maleReady: true, malePosterExt: "webp" },
  { name: "Leg Press", aliases: ["45 degree leg press", "plate-loaded leg press", "leg press machine"], category: "legs", primaryMuscles: ["Quads", "Glutes"], equipment: "Leg Press", maleReady: true, malePosterExt: "webp", femaleReady: true, femalePosterExt: "webp" },
  { name: "Cable Pull-Through", aliases: ["cable pull through", "pull-through"], category: "glute", primaryMuscles: ["Glutes", "Hamstrings"], equipment: "Cable Stack", femaleReady: true, femalePosterExt: "webp" },
  /* The heavy compounds and machines the prescription engine reaches for most
     often and had no demo for at all — squat patterns above everything, since a
     member sees a squat in almost every lower-body session they are given. */
  { name: "Back Squat", aliases: ["barbell back squat", "squat", "barbell squat"], category: "legs", primaryMuscles: ["Quads", "Glutes"], equipment: "Barbell · Power Rack", maleReady: true, malePosterExt: "webp", femaleReady: true, femalePosterExt: "webp" },
  { name: "Hack Squat", aliases: ["machine hack squat", "plate-loaded hack squat"], category: "legs", primaryMuscles: ["Quads", "Glutes"], equipment: "Hack Squat Machine", maleReady: true, malePosterExt: "webp" },
  { name: "Leg Extension", aliases: ["seated leg extension", "machine leg extension"], category: "legs", primaryMuscles: ["Quads"], equipment: "Leg Extension Machine", femaleReady: true, femalePosterExt: "webp" },
  { name: "Lying Leg Curl", aliases: ["prone leg curl", "leg curl", "machine leg curl"], category: "legs", primaryMuscles: ["Hamstrings"], equipment: "Leg Curl Machine", femaleReady: true, femalePosterExt: "webp" },
  { name: "Walking Lunge", aliases: ["dumbbell walking lunge", "lunge", "walking lunges"], category: "legs", primaryMuscles: ["Quads", "Glutes"], equipment: "Dumbbells", femaleReady: true, femalePosterExt: "webp" },
  { name: "Seated Dumbbell Shoulder Press", aliases: ["seated dumbbell press", "dumbbell shoulder press", "seated shoulder press", "overhead press"], category: "shoulders", primaryMuscles: ["Front Delts", "Side Delts"], equipment: "Dumbbells · Bench", maleReady: true, malePosterExt: "webp" },
  { name: "Dumbbell Lateral Raise", aliases: ["standing dumbbell lateral raise", "standing lateral raise"], category: "shoulders", primaryMuscles: ["Side Delts"], equipment: "Dumbbells", maleReady: true, malePosterExt: "webp" },
  { name: "Rope Triceps Pushdown", aliases: ["triceps pushdown", "rope pushdown", "cable triceps pushdown"], category: "arms", primaryMuscles: ["Triceps"], equipment: "Cable Stack", maleReady: true, malePosterExt: "webp" },
  { name: "Cable Crunch", aliases: ["kneeling cable crunch", "rope crunch"], category: "core", primaryMuscles: ["Core"], equipment: "Cable Stack", maleReady: true, malePosterExt: "webp" },
  /* Free-weight and machine staples that sit beside the compounds above in the
     same session — the accessory slots a member fills every single week. */
  { name: "Flat Dumbbell Press", aliases: ["dumbbell bench press", "flat db press", "flat dumbbell bench press"], category: "chest", primaryMuscles: ["Chest"], equipment: "Dumbbells · Bench", maleReady: true, malePosterExt: "webp" },
  { name: "Single-Arm Dumbbell Row", aliases: ["one-arm dumbbell row", "single arm dumbbell row", "dumbbell row"], category: "back", primaryMuscles: ["Lats", "Mid-Back"], equipment: "Dumbbells · Bench", maleReady: true, malePosterExt: "webp" },
  { name: "Machine Shoulder Press", aliases: ["shoulder press machine", "plate-loaded shoulder press"], category: "shoulders", primaryMuscles: ["Front Delts", "Side Delts"], equipment: "Shoulder Press Machine", maleReady: true, malePosterExt: "webp" },
  { name: "Overhead Cable Triceps Extension", aliases: ["overhead triceps extension", "cable overhead extension", "overhead rope extension"], category: "arms", primaryMuscles: ["Triceps"], equipment: "Cable Stack", maleReady: true, malePosterExt: "webp" },
  { name: "Machine Preacher Curl", aliases: ["preacher curl", "machine curl"], category: "arms", primaryMuscles: ["Biceps"], equipment: "Preacher Curl Machine", maleReady: true, malePosterExt: "webp" },
  { name: "Dumbbell Romanian Deadlift", aliases: ["dumbbell rdl", "db romanian deadlift"], category: "legs", primaryMuscles: ["Hamstrings", "Glutes"], equipment: "Dumbbells", femaleReady: true, femalePosterExt: "webp" },
  { name: "Reverse Pec Deck", aliases: ["reverse pec deck fly", "rear delt machine", "machine reverse fly"], category: "shoulders", primaryMuscles: ["Rear Delts", "Upper Back"], equipment: "Pec Deck", femaleReady: true, femalePosterExt: "webp" },
  { name: "Machine Chest Press", aliases: ["chest press machine", "seated machine chest press"], category: "chest", primaryMuscles: ["Chest"], equipment: "Chest Press Machine", maleReady: true, malePosterExt: "webp" },
  { name: "Push-Up", aliases: ["pushup", "press-up"], category: "chest", primaryMuscles: ["Chest", "Core"], equipment: "Bodyweight", femaleReady: true, femalePosterExt: "webp" },
  /* The first conditioning demo. Cardio slots were the one category with no
     picture at all, and an incline walk is the one a member is handed most. */
  { name: "Incline Treadmill Walk", aliases: ["treadmill incline walk", "incline walk", "incline treadmill"], category: "conditioning", primaryMuscles: ["Glutes", "Calves"], equipment: "Treadmill", femaleReady: true, femalePosterExt: "webp" },
  { name: "Neutral Grip Pulldown", aliases: ["neutral grip lat pulldown", "v-bar pulldown", "close grip pulldown"], category: "back", primaryMuscles: ["Lats"], equipment: "Cable Stack", maleReady: true, malePosterExt: "webp" },
  { name: "Dip", aliases: ["parallel bar dip", "bodyweight dip", "chest dip", "triceps dip"], category: "chest", primaryMuscles: ["Lower Chest", "Triceps"], equipment: "Dip Bars", maleReady: true, malePosterExt: "webp" },
  /* Display name stays generic on purpose — the movement is the escalator-style
     stair machine, and the brand name people use for it is only an alias. */
  { name: "Stair Climber", aliases: ["stairmaster", "stair machine", "stepmill", "stair climber machine"], category: "conditioning", primaryMuscles: ["Glutes", "Quads"], equipment: "Stair Climber", femaleReady: true, femalePosterExt: "webp" },
  { name: "Incline Barbell Press", aliases: ["incline bench press", "barbell incline press"], category: "chest", primaryMuscles: ["Upper Chest"], equipment: "Barbell · Incline Bench", maleReady: true, malePosterExt: "webp" },
  { name: "Machine Lateral Raise", aliases: ["lateral raise machine", "adjustable machine lateral raise"], category: "shoulders", primaryMuscles: ["Side Delts"], equipment: "Lateral Raise Machine", femaleReady: true, femalePosterExt: "webp" },
  { name: "Dumbbell Skull Crusher", aliases: ["skull crusher", "lying triceps extension", "dumbbell lying triceps extension"], category: "arms", primaryMuscles: ["Triceps"], equipment: "Dumbbells · Bench", maleReady: true, malePosterExt: "webp" },
  { name: "Pallof Press", aliases: ["anti-rotation press", "cable pallof press"], category: "core", primaryMuscles: ["Core", "Obliques"], equipment: "Cable Stack", femaleReady: true, femalePosterExt: "webp" },
  { name: "Stationary Bike", aliases: ["exercise bike", "upright bike", "bike"], category: "conditioning", primaryMuscles: ["Quads", "Glutes"], equipment: "Stationary Bike", femaleReady: true, femalePosterExt: "webp" },
  /* Outdoor conditioning. These are activity days the split hands a member —
     Track Session, Run, Long Run, Zone 2, Cycling all come from SPLIT_ACTIVITIES
     — and until now the whole outdoor half of the week had no picture at all.
     The Reserve room can't follow them outside, so the *grade* does instead: a
     floodlit track at blue hour and a coastal road at golden hour both give
     amber key light against teal sky, which is what makes these sit beside the
     gym posters rather than looking like a different product. */
  { name: "Track Session", aliases: ["track work", "track day", "sprint", "sprints", "speed work"], category: "conditioning", primaryMuscles: ["Quads", "Hamstrings", "Glutes"], equipment: "Outdoor Track", maleReady: true, malePosterExt: "webp", femaleReady: true, femalePosterExt: "webp" },
  { name: "Run", aliases: ["outdoor run", "easy run", "jog"], category: "conditioning", primaryMuscles: ["Quads", "Calves"], equipment: "Outdoor", maleReady: true, malePosterExt: "webp" },
  { name: "Long Run", aliases: ["outdoor distance", "distance run", "endurance run"], category: "conditioning", primaryMuscles: ["Quads", "Hamstrings", "Calves"], equipment: "Outdoor", femaleReady: true, femalePosterExt: "webp" },
  { name: "Zone 2 Walk", aliases: ["zone 2", "zone 2 cardio", "zone 2 conditioning", "walk", "outdoor walk"], category: "conditioning", primaryMuscles: ["Glutes", "Calves"], equipment: "Outdoor", femaleReady: true, femalePosterExt: "webp" },
  { name: "Cycling", aliases: ["road cycling", "bike session", "outdoor ride", "ride"], category: "conditioning", primaryMuscles: ["Quads", "Glutes"], equipment: "Road Bike", maleReady: true, malePosterExt: "webp" },
  { name: "Hanging Knee Raise", aliases: ["hanging leg raise"], category: "core", primaryMuscles: ["Core"], equipment: "Pull-Up Bar" },
  { name: "Pilates Hundred", category: "core", primaryMuscles: ["Core"], equipment: "Mat" },
];

function seedToVisual(seed: SampleSeed): MovementVisual {
  const slug = normalizeMovementKey(seed.name);
  const maleVariant = buildVariant(
    slug, "male", seed.name, seed.primaryMuscles, Boolean(seed.maleReady),
    seed.maleReady ? seed.malePosterExt : undefined,
  );
  const femaleVariant = buildVariant(
    slug, "female", seed.name, seed.primaryMuscles, Boolean(seed.femaleReady),
    seed.femaleReady ? seed.femalePosterExt : undefined,
  );

  return {
    movementId: slug,
    movementName: seed.name,
    kind: "exercise",
    visualStyle: "cinematic-4k",
    category: seed.category,
    primaryMuscles: seed.primaryMuscles,
    equipment: seed.equipment,
    aspect: "16:9",
    // Male + female variants; shipped posters render in the dashboard when ready.
    variants: [
      maleVariant,
      femaleVariant,
    ],
    reserveBranding: { ...DEFAULT_RESERVE_BRANDING },
    prompt: buildStaticPrompt(seed.name, seed.primaryMuscles),
    loopPromptMale: buildLoopPrompt(seed.name, seed.primaryMuscles, "male"),
    loopPromptFemale: buildLoopPrompt(seed.name, seed.primaryMuscles, "female"),
    negativePrompt: MOVEMENT_NEGATIVE_PROMPT,
    ready: Boolean(seed.maleReady || seed.femaleReady),
  };
}

export const MOVEMENT_VISUAL_REGISTRY: Record<string, MovementVisual> = (() => {
  const map: Record<string, MovementVisual> = {};
  for (const seed of SAMPLE_SEEDS) {
    const visual = seedToVisual(seed);
    map[visual.movementId] = visual;
    for (const alias of seed.aliases ?? []) map[normalizeMovementKey(alias)] = visual;
  }
  return map;
})();

export type MovementVisualInput = { id?: string; name: string; primaryMuscles?: string[]; equipment?: string; role?: string };

/** Resolve the media descriptor for a movement (registry hit or synthesized). */
export function getMovementVisual(movement: MovementVisualInput): MovementVisual {
  const primaryMuscles = movement.primaryMuscles ?? [];
  const slug = normalizeMovementKey(movement.name);

  if (isSupportMovement(movement.name, movement.role)) {
    return {
      movementId: slug, movementName: movement.name, kind: "support", visualStyle: "anatomy-hud",
      category: "recovery", primaryMuscles, equipment: movement.equipment, aspect: "16:9",
      variants: [], reserveBranding: { ...DEFAULT_RESERVE_BRANDING, showInMediaFrame: false }, ready: false,
    };
  }

  const hit = MOVEMENT_VISUAL_REGISTRY[slug] ?? (movement.id ? MOVEMENT_VISUAL_REGISTRY[normalizeMovementKey(movement.id)] : undefined);
  if (hit) return hit;

  // Synthesized — male / female / neutral variants + documented prompts, pending.
  const category = categoryForMuscles(primaryMuscles, movement.equipment);
  return {
    movementId: slug, movementName: movement.name, kind: "exercise", visualStyle: "cinematic-4k",
    category, primaryMuscles, equipment: movement.equipment, aspect: "16:9",
    variants: [
      buildVariant(slug, "male", movement.name, primaryMuscles, false),
      buildVariant(slug, "female", movement.name, primaryMuscles, false),
      buildVariant(slug, "neutral", movement.name, primaryMuscles, false),
    ],
    reserveBranding: { ...DEFAULT_RESERVE_BRANDING },
    prompt: buildStaticPrompt(movement.name, primaryMuscles),
    loopPromptMale: buildLoopPrompt(movement.name, primaryMuscles, "male"),
    loopPromptFemale: buildLoopPrompt(movement.name, primaryMuscles, "female"),
    negativePrompt: MOVEMENT_NEGATIVE_PROMPT,
    ready: false,
  };
}

/* ─── Gender resolution + variant selection ───────────────────────────────── */
export type MediaGenderContext = {
  genderIdentity?: string | null;
  profilePath?: string | null;
  womensEnabled?: boolean;
  womensActive?: boolean;
  womensTrack?: string | null;
};

/** Female for women's-performance / female identity; male for men's-performance /
 *  male identity; neutral otherwise (custom / inclusive / unknown). */
export function resolveMediaGender(ctx: MediaGenderContext): MovementMediaGender {
  const g = (ctx.genderIdentity ?? "").toLowerCase();
  if (g === "female" || ctx.profilePath === "womens-performance" || ctx.womensEnabled || ctx.womensActive || Boolean(ctx.womensTrack)) return "female";
  if (g === "male" || ctx.profilePath === "mens-performance") return "male";
  return "neutral";
}

export type MediaSelection = {
  variant: MovementMediaVariant | null;
  /** The gender we actually resolved to (after fallback). */
  resolvedGender: MovementMediaGender | null;
  /** True when we had to fall back from the requested gender. */
  fellBack: boolean;
};

/**
 * Pick the best variant for a requested gender. Prefers a READY variant in
 * gender order (requested → neutral → opposite-if-allowed); if none ready,
 * returns the best-matching variant anyway so the UI can show its pending
 * state and the documented asset paths.
 */
export function selectMediaVariant(
  visual: MovementVisual,
  gender: MovementMediaGender,
  opts: { allowOpposite?: boolean } = {},
): MediaSelection {
  if (visual.variants.length === 0) return { variant: null, resolvedGender: null, fellBack: false };
  const opposite: MovementMediaGender = gender === "male" ? "female" : "male";
  const order: MovementMediaGender[] =
    gender === "neutral"
      ? ["neutral", "female", "male"]
      : [gender, "neutral", ...(opts.allowOpposite ? [opposite] : [])];

  const find = (g: MovementMediaGender, readyOnly: boolean) =>
    visual.variants.find((v) => v.gender === g && (!readyOnly || v.ready));

  for (const g of order) { const v = find(g, true); if (v) return { variant: v, resolvedGender: g, fellBack: g !== gender }; }
  for (const g of order) { const v = find(g, false); if (v) return { variant: v, resolvedGender: g, fellBack: g !== gender }; }
  return { variant: visual.variants[0], resolvedGender: visual.variants[0].gender, fellBack: visual.variants[0].gender !== gender };
}
