/**
 * FINAL BOSS ATHLETE — Exercise Education Metadata
 *
 * Provides form tips, machine setup notes, muscle target explanations,
 * substitution options, common errors, and safety notes for key exercises.
 *
 * Used for:
 * - Education modals in TrainingView
 * - /api/exercises/metadata endpoint
 * - ExerciseBlock tooltips
 */

export type ExerciseMetadata = {
  id: string;
  name: string;
  aliases: string[];
  bodyGroup: string;
  targetMuscle: string;
  secondaryMuscles: string[];
  equipment: string[];
  difficulty: "beginner" | "intermediate" | "advanced";
  formTips: string[];
  machineSetupNotes?: string;
  muscleTargetExplanation: string;
  substitutions: Array<{ name: string; reason: string }>;
  safetyNotes: string;
  commonErrors: string[];
};

/* ─── Exercise Database ──────────────────────────────── */

export const EXERCISE_METADATA: ExerciseMetadata[] = [
  /* ── CHEST ── */
  {
    id: "incline-smith-press",
    name: "Incline Smith Press",
    aliases: ["Incline Smith Machine Press", "Smith Incline"],
    bodyGroup: "Chest",
    targetMuscle: "Clavicular Pectoralis (upper chest)",
    secondaryMuscles: ["Anterior Deltoid", "Triceps Brachii"],
    equipment: ["smith-machine", "bench"],
    difficulty: "intermediate",
    formTips: [
      "Set bench to 30–45° — steeper than 45° shifts load to front delts",
      "Bar path should contact upper chest, not the chin or sternum",
      "Retract and depress shoulder blades fully before unracking",
      "Elbows at 45–60° to torso — never flare wide under load",
      "1-second pause at the stretch position for peak stimulus",
      "Drive the weight through the chest, not the shoulders",
    ],
    machineSetupNotes:
      "Set safety catches 2–3 inches below full chest contact point. Bench center should align bar with upper chest at bottom of rep. Step away from racking pins before beginning first set.",
    muscleTargetExplanation:
      "The clavicular head of pectoralis major originates at the clavicle and inserts at the humerus. It is best activated when the arm moves from below the horizontal upward — hence the incline angle. At flat or decline angles, the sternal (lower) head dominates. Going beyond 45° incline shifts activation predominantly to the anterior deltoid.",
    substitutions: [
      { name: "Low Incline Dumbbell Press", reason: "Greater ROM and no fixed bar path — better for shoulder mobility issues" },
      { name: "Converging Incline Machine Press", reason: "Machine stability if shoulder noise is present" },
      { name: "Low-to-High Cable Fly", reason: "Constant tension alternative — use as finisher not primary" },
    ],
    safetyNotes:
      "Do not grip too wide — excessive elbow flare under load stresses the AC joint. If anterior shoulder pain develops, reduce the incline angle or switch to dumbbells which allow the path to self-adjust.",
    commonErrors: [
      "Bench angle too steep — shifts all work to anterior delts",
      "Bar contacting chin or mid-chest instead of upper chest",
      "Elbows flaring past 70° under heavy load",
      "Not retracting scapula — losing the stable shoulder base",
      "Touching bar to chest without controlled eccentric",
    ],
  },
  {
    id: "weighted-pull-up",
    name: "Weighted Pull-Up",
    aliases: ["Belt Squat Pull-Up", "Loaded Pull-Up"],
    bodyGroup: "Back",
    targetMuscle: "Latissimus Dorsi — Width and Thickness",
    secondaryMuscles: ["Teres Major", "Rhomboids", "Biceps Brachii", "Rear Deltoid"],
    equipment: ["pull-up-bar", "weight-belt"],
    difficulty: "advanced",
    formTips: [
      "Dead hang start — full scapular protraction at the bottom",
      "Initiate with scapular DEPRESSION before bending elbows",
      "Drive elbows toward back pockets — think 'elbows to hips'",
      "Chest to bar is the target — not just chin over bar",
      "Control the full eccentric — 2+ seconds down, no dropping",
      "Avoid kipping or momentum — every rep must be controlled",
    ],
    machineSetupNotes:
      "Use a dip belt with plates or a weighted vest. Start loading only when 10+ bodyweight reps are achievable with strict form. Attach weight so it hangs directly below hips without swinging.",
    muscleTargetExplanation:
      "Pull-ups load the lat through full shoulder adduction range — from full overhead stretch to elbow-beside-ribs. The dead hang stretch is critical for lat lengthening. Weighted pull-ups beat pulldowns because they load the bodyweight pattern with additional resistance, recruiting more motor units than cable alternatives.",
    substitutions: [
      { name: "Lat Pulldown (Wide Grip)", reason: "Same movement pattern — use when body weight pull-ups limit set quality" },
      { name: "Assisted Pull-Up Machine", reason: "Reduce load while maintaining movement pattern" },
      { name: "Band-Assisted Pull-Up", reason: "Progressive overload tool — reduce band size over time" },
    ],
    safetyNotes:
      "Never pull behind the neck — cervical spine stress. If elbow pain develops, check grip width (try neutral/supinated grip) and reduce load. Ensure grip is secure before adding belt weight.",
    commonErrors: [
      "Using momentum / kipping instead of controlled concentric",
      "Not achieving full dead hang at the bottom",
      "Chin-up instead of chest-up — incomplete ROM",
      "Excessive forward lean that turns it into a row",
      "Dropping rapidly on the eccentric",
    ],
  },
  {
    id: "lat-pulldown-wide",
    name: "Lat Pulldown (Wide Grip)",
    aliases: ["Wide Grip Lat Pulldown", "Cable Pulldown"],
    bodyGroup: "Back",
    targetMuscle: "Latissimus Dorsi — Width (Upper Lat Fibers)",
    secondaryMuscles: ["Teres Major", "Rhomboids", "Biceps (secondary)"],
    equipment: ["cable-machine", "wide-bar"],
    difficulty: "beginner",
    formTips: [
      "Initiate with SCAPULAR DEPRESSION before pulling with arms",
      "Drive elbows toward back pockets, not just straight down",
      "Chest stays high — slight backward lean (15–20°) is correct",
      "Full stretch at the top — let the scapula protract completely",
      "Avoid excessive trunk swing to pull the weight",
      "Pull to upper chest / collar bone — not to the chin or chest",
    ],
    machineSetupNotes:
      "Knee pad should lock thighs firmly in place to prevent body from rising. Grip outside shoulder-width at the V-bend of a standard bar. Adjust seat height so arms are fully extended with slight upward reach at the top.",
    muscleTargetExplanation:
      "The latissimus dorsi is a large fan-shaped muscle. Its primary function is shoulder adduction and extension. Wide-grip pulldowns bias the upper lat and outer fibers responsible for the V-taper appearance. Neutral or close grip shifts emphasis to lower lats and allows more weight.",
    substitutions: [
      { name: "Neutral Grip Pulldown", reason: "Easier on wrists — allows more load" },
      { name: "Weighted Pull-Up", reason: "Bodyweight version — higher motor demand and real-world carryover" },
      { name: "Single-Arm Lat Pulldown", reason: "Fixes dominant-side compensation" },
    ],
    safetyNotes:
      "Never pull behind the neck — cervical spine stress and impingement risk. Always pull to the upper chest or collar bone.",
    commonErrors: [
      "Pulling with biceps instead of initiating with scapular depression",
      "Excessive trunk swing and momentum",
      "Not achieving full scapular protraction at the top",
      "Pulling behind the neck",
      "Knee pad too loose — body lifts during the pull",
    ],
  },
  {
    id: "romanian-deadlift",
    name: "Romanian Deadlift",
    aliases: ["RDL", "Stiff-Leg Deadlift (RDL variation)"],
    bodyGroup: "Legs",
    targetMuscle: "Bicep Femoris + Semitendinosus (Hamstrings — Lengthened)",
    secondaryMuscles: ["Gluteus Maximus", "Spinal Erectors", "Adductors"],
    equipment: ["barbell", "dumbbell"],
    difficulty: "intermediate",
    formTips: [
      "Hip HINGE — push hips back, not down — this is NOT a squat",
      "Bar stays in contact with legs the entire movement",
      "Knees soft (15–20° bend) and fixed — do not squat",
      "Stop when hamstring tension peaks — pelvis neutral, no tuck",
      "Lats tight throughout — think 'protect your armpits'",
      "Drive through heels to return — hips lead the ascent",
    ],
    muscleTargetExplanation:
      "The hamstrings cross both the hip and the knee. The RDL loads them primarily at the hip joint through extension mechanics — creating the lengthened, stretched position that drives hypertrophy. Unlike leg curls (knee flexion), the RDL trains the full hamstring length and is the primary posterior chain mass builder.",
    substitutions: [
      { name: "Dumbbell RDL", reason: "Greater range of motion — easier to learn the hip hinge pattern" },
      { name: "Smith Machine RDL", reason: "Fixed bar path reduces balance demand and helps learn the movement" },
      { name: "Single-Leg RDL", reason: "Eliminates side-to-side compensation — high core demand" },
      { name: "Good Morning", reason: "Bar on upper back version — shifts more load to spinal erectors" },
    ],
    safetyNotes:
      "Never round the lumbar spine — this is the most important technical cue. If lower back stress is felt instead of hamstring tension, the weight is too heavy or the hinge pattern is breaking down. Belt is recommended at 80%+ of working weight.",
    commonErrors: [
      "Squatting instead of hinging — knees bending too much",
      "Letting bar drift away from the legs",
      "Rounding the lumbar spine — most common and most dangerous error",
      "Going past hamstring limit — pelvic posterior tuck",
      "Not engaging lats — bar drifts forward under heavier loads",
    ],
  },
  {
    id: "hip-thrust-barbell",
    name: "Hip Thrust (Barbell)",
    aliases: ["Barbell Hip Thrust", "Bret Contreras Hip Thrust"],
    bodyGroup: "Glutes",
    targetMuscle: "Gluteus Maximus — Short-ROM Peak Contraction",
    secondaryMuscles: ["Hamstrings (distal)", "Adductors", "Spinal Erectors (minimal when done correctly)"],
    equipment: ["barbell", "flat-bench"],
    difficulty: "intermediate",
    formTips: [
      "Bench edge at mid-scapula — not at the neck or lower back",
      "Feet flat, hip-width apart, toes slightly externally rotated",
      "Posterior pelvic tilt at the TOP — SQUEEZE the glutes hard",
      "Knee angle should be approximately 90° at lockout",
      "Do not hyperextend the lumbar spine at the top — pelvis tilts, not spine",
      "Hold 1–2 seconds at peak contraction on all working sets",
    ],
    machineSetupNotes:
      "Always use a barbell pad or foam cushion — bare bar on hip crease causes pain and alters mechanics. Start with bar over hip crease when supine. For heavier loads, consider a Smith machine for easier setup. Banded hip thrust adds resistance at the top where the glute is strongest.",
    muscleTargetExplanation:
      "The gluteus maximus is the largest muscle in the body and its primary function is hip extension. The hip thrust is uniquely effective because it loads the glute maximally in the SHORTENED position (full hip extension) — where squats and RDLs are weakest. This makes it the best glute-specific exercise for adding mass to the upper and lower glute fibers.",
    substitutions: [
      { name: "Machine Hip Thrust", reason: "Faster setup and more consistent loading — good for high volume" },
      { name: "Cable Pull-Through", reason: "Continuous tension — less joint stress — good finisher" },
      { name: "Glute Bridge (Barbell)", reason: "Flat on floor version — less ROM, easier to set up" },
      { name: "Single-Leg Hip Thrust", reason: "Eliminates side-to-side compensation — higher glute demand per side" },
    ],
    safetyNotes:
      "NEVER load without a pad — hip crease bruising and incorrect mechanics result. Do not hyperextend the lumbar spine at lockout — the pelvis should posteriorly tilt, not the back arch. Avoid if SI joint pain is present.",
    commonErrors: [
      "Bench too high — shifts load to hamstrings and reduces glute activation",
      "Lumbar hyperextension at lockout instead of posterior pelvic tilt",
      "Feet too close to the body — reduces ROM significantly",
      "Not achieving full hip extension / not squeezing the glutes at top",
      "No bar pad — pain prevents full contraction",
    ],
  },
  {
    id: "cable-crunch",
    name: "Cable Crunch",
    aliases: ["Kneeling Cable Crunch", "Cable Ab Crunch"],
    bodyGroup: "Abs",
    targetMuscle: "Rectus Abdominis — Full Length",
    secondaryMuscles: ["Obliques", "Hip Flexors (eliminated when done correctly)"],
    equipment: ["cable-machine", "rope-attachment"],
    difficulty: "beginner",
    formTips: [
      "Curl RIBS toward PELVIS — not elbows to knees",
      "Hips stay fixed on heels throughout — movement is purely spinal flexion",
      "Full range: start upright/extended, finish fully rounded and compressed",
      "Hold peak contraction 1 second — feel the abs firing, not the hip flexors",
      "Hands hold rope at forehead — they guide, they do not pull",
      "Resistance pulls from above — keep cable angle consistent",
    ],
    muscleTargetExplanation:
      "The rectus abdominis creates spinal flexion (ribs toward pelvis). The cable crunch is superior to floor crunches because the cable provides continuous resistance through the full ROM — including the shortened position where floor crunches lose tension. Kneeling removes hip flexor contribution.",
    substitutions: [
      { name: "Machine Crunch", reason: "Guided path — useful for learning the spinal flexion pattern" },
      { name: "Weighted Decline Crunch", reason: "No cable required — load with plate on chest" },
      { name: "Ab Wheel Rollout", reason: "Anti-extension variation — different stimulus" },
    ],
    safetyNotes:
      "Avoid neck strain — hands should guide, not pull. If cervical discomfort, cross arms at chest and hold rope at forehead without hand tension. Stop if low back pain occurs — check that hips are fixed and not moving.",
    commonErrors: [
      "Using hip flexors to pull down instead of true spinal flexion",
      "Not achieving full ROM — stopping halfway",
      "Neck strain from pulling with hands",
      "Hips moving up instead of fixed on heels",
      "Rope pulled too far in front — cable angle breaks",
    ],
  },
  {
    id: "lateral-raise-cable",
    name: "Cable Lateral Raise",
    aliases: ["Cable Side Raise", "Low Pulley Lateral Raise"],
    bodyGroup: "Shoulders",
    targetMuscle: "Medial Deltoid Head",
    secondaryMuscles: ["Anterior Deltoid", "Supraspinatus (rotator cuff, low load)"],
    equipment: ["cable-machine", "single-handle"],
    difficulty: "beginner",
    formTips: [
      "Cross-body setup — cable runs in front of the body, not beside it",
      "Slight forward lean (10–15°) loads the medial delt more directly",
      "Lead with the ELBOW, not the wrist — wrist is passive",
      "Pinky slightly higher than thumb at the top (slight internal rotation)",
      "Stop at shoulder height — above shoulder shifts to traps and supraspinatus",
      "Slow controlled negative — resist the cable pulling the arm back down",
    ],
    muscleTargetExplanation:
      "The medial (lateral) deltoid creates shoulder abduction. It is responsible for the 'cap' look and creates shoulder width from the front. Cable provides constant tension through the full arc — including the bottom where dumbbells lose tension. The cross-body cable setup maintains tension in the stretched position.",
    substitutions: [
      { name: "Dumbbell Lateral Raise", reason: "Classic version — no cable required" },
      { name: "Machine Lateral Raise", reason: "Consistent path and peak contraction focus" },
      { name: "Lean-Away Lateral Raise", reason: "Greater stretch in the lengthened position" },
    ],
    safetyNotes:
      "Avoid shrugging — this recruits the upper trapezius and removes work from the medial delt. Keep neck long and relaxed. Reduce load if supraspinatus impingement symptoms appear (pain on abduction between 60–120°).",
    commonErrors: [
      "Shrugging at the top — trapezius takeover",
      "Arm going past shoulder height — supraspinatus load increases",
      "Swinging for momentum instead of controlled concentric",
      "Wrist leading instead of elbow — changes muscle recruitment",
      "Cable running from beside the body — loses cross-body stretch effect",
    ],
  },
  {
    id: "face-pull-rope",
    name: "Face Pull (Rope)",
    aliases: ["Rope Face Pull", "Cable Face Pull"],
    bodyGroup: "Shoulders",
    targetMuscle: "Posterior Deltoid + External Rotators (Infraspinatus, Teres Minor)",
    secondaryMuscles: ["Rhomboids", "Middle Trapezius"],
    equipment: ["cable-machine", "rope-attachment"],
    difficulty: "beginner",
    formTips: [
      "Cable set at or slightly above eye height",
      "Pull rope to face level — hands finish beside ears, not in front",
      "EXTERNALLY ROTATE at peak — thumbs pointing back, elbows high",
      "Initiate with rear delt, not with biceps pulling elbows back",
      "Control the return — resist the cable pulling elbows forward",
      "This is a prehab movement — do not chase max load",
    ],
    muscleTargetExplanation:
      "The face pull trains the posterior deltoid and external rotators simultaneously — the most undertrained muscles in most gym programs. The external rotation component directly counters the internal rotation dominance created by pressing (bench, overhead). This movement is shoulder health insurance.",
    substitutions: [
      { name: "Band Face Pull", reason: "Home/travel alternative — same mechanics with a band" },
      { name: "Chest-Supported Rear Delt Row", reason: "Heavier loading of the same muscle group" },
      { name: "Reverse Pec Deck", reason: "Machine isolation of rear delt" },
    ],
    safetyNotes:
      "This movement should never cause pain. It is a prehab and health exercise. If pain occurs, reduce load dramatically — the goal is neuromuscular activation, not max strength. Never skip this movement in upper body sessions.",
    commonErrors: [
      "Pulling with biceps instead of rear delt and external rotators",
      "No external rotation at peak — just a straight cable row",
      "Going too heavy — turns into a row rather than a targeted movement",
      "Elbow height too low — posterior delt is not loaded",
      "Skipping this exercise — most common error in the gym",
    ],
  },
  {
    id: "leg-press",
    name: "Leg Press",
    aliases: ["Machine Leg Press", "Plate-Loaded Leg Press"],
    bodyGroup: "Legs",
    targetMuscle: "Quadriceps (Rectus Femoris, Vastus Lateralis, VMO)",
    secondaryMuscles: ["Gluteus Maximus", "Hamstrings (partial)"],
    equipment: ["leg-press-machine"],
    difficulty: "beginner",
    formTips: [
      "Foot placement determines emphasis: low/narrow = quad focus; high/wide = glute/ham",
      "Full range of motion — allow knees to travel toward chest without butt lifting",
      "Do NOT lock knees at the top — keep constant tension on quads",
      "Control the eccentric — 3+ seconds down on working sets",
      "Belt is recommended for heavy loading",
      "Depth: thighs at or below parallel — pelvis must not tuck (back flattens off pad)",
    ],
    muscleTargetExplanation:
      "The leg press allows very high loading of the quads with reduced spinal stress compared to squats. It effectively isolates quad sweep and VMO when foot placement is low and narrow. Higher plates shift load to glutes and hamstrings through greater hip flexion.",
    substitutions: [
      { name: "Hack Squat", reason: "Higher quad specificity with more knee travel" },
      { name: "Belt Squat", reason: "Zero spinal compression — quad-biased variation" },
      { name: "Smith Machine Squat", reason: "Fixed path — useful for technique learning" },
    ],
    safetyNotes:
      "Never unrack with safety catches still in place. Do not allow lower back to round off the pad — pelvic tuck under heavy depth indicates limited hip mobility. Reduce ROM until mobility improves. Knee cave inward = reduce load.",
    commonErrors: [
      "Pelvis tucking off the pad at the bottom — lower back stress",
      "Not achieving sufficient depth — only partial quad activation",
      "Locking out knees at top — removes constant tension",
      "Foot placement not matching the intended muscle target",
      "Excessive load at the expense of ROM",
    ],
  },
  {
    id: "vacuum-hold",
    name: "Vacuum Hold",
    aliases: ["Abdominal Vacuum", "Stomach Vacuum"],
    bodyGroup: "Abs",
    targetMuscle: "Transverse Abdominis (TVA) — Abdominal Wall",
    secondaryMuscles: ["Internal Obliques", "Diaphragm"],
    equipment: [],
    difficulty: "intermediate",
    formTips: [
      "Exhale ALL air completely — this is the starting point",
      "Draw navel toward spine — do not suck air in, pull inward",
      "Hold the position while breathing very shallowly or not at all",
      "Start with 10–15 second holds, progress to 30–60 seconds",
      "Can be done standing, kneeling, or on all fours",
      "Posing context: practice while holding mandatory poses",
    ],
    muscleTargetExplanation:
      "The transverse abdominis is the deepest abdominal muscle — it creates a natural corset around the spine and organs. Developing it contributes to the pinched waist aesthetic in bodybuilding and provides core stability. Vacuums are the only direct isolation exercise for the TVA and are a classic bodybuilding drill.",
    substitutions: [
      { name: "Dead Bug Breathing", reason: "More dynamic TVA engagement" },
      { name: "Crocodile Breathing", reason: "360° core activation drill" },
    ],
    safetyNotes:
      "Avoid during pregnancy. Do not perform while under very heavy loads (no vacuum during deadlifts). If dizziness occurs, stop and breathe normally.",
    commonErrors: [
      "Not exhaling fully before initiating the vacuum",
      "Sucking air in instead of drawing navel inward",
      "Holding breath until red-faced — too much",
      "Not holding long enough to challenge the TVA",
      "Skipping this drill — underappreciated movement for physique development",
    ],
  },
];

/* ─── Lookup Helpers ─────────────────────────────────── */

export function getExerciseMetadata(name: string): ExerciseMetadata | null {
  const lower = name.toLowerCase().trim();
  return (
    EXERCISE_METADATA.find(
      (meta) =>
        meta.name.toLowerCase() === lower ||
        meta.id === lower ||
        meta.aliases.some((alias) => alias.toLowerCase() === lower),
    ) ?? null
  );
}

export function getExercisesByBodyGroup(bodyGroup: string): ExerciseMetadata[] {
  const lower = bodyGroup.toLowerCase();
  return EXERCISE_METADATA.filter(
    (meta) => meta.bodyGroup.toLowerCase() === lower,
  );
}

export function searchExerciseMetadata(query: string): ExerciseMetadata[] {
  const lower = query.toLowerCase().trim();
  return EXERCISE_METADATA.filter(
    (meta) =>
      meta.name.toLowerCase().includes(lower) ||
      meta.targetMuscle.toLowerCase().includes(lower) ||
      meta.bodyGroup.toLowerCase().includes(lower) ||
      meta.aliases.some((a) => a.toLowerCase().includes(lower)),
  );
}

export function getSubstitutionOptions(exerciseName: string): Array<{ name: string; reason: string }> {
  const meta = getExerciseMetadata(exerciseName);
  return meta?.substitutions ?? [];
}
