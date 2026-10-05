import type { UserPersona } from "@/lib/saas-config";
import type { ExercisePrescription, MuscleTarget, RecoveryGate, SessionBlock, TrainingSessionPlan } from "@/lib/contracts/product";
import type { IntelligenceQuery } from "@/lib/schemas/ai";

export type TrainingStyle =
  | "bodybuilding"
  | "powerbuilding"
  | "hybrid"
  | "fat-loss"
  | "female-wellness"
  | "performance";

export type EquipmentType =
  | "barbell"
  | "dumbbell"
  | "machine"
  | "cable"
  | "bodyweight"
  | "cardio"
  | "mobility";

export type ExerciseDefinition = {
  id: string;
  name: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  equipment: EquipmentType[];
  difficulty: "beginner" | "intermediate" | "advanced";
  movementPattern: string;
};

export type TrainingBlockTemplate = {
  style: TrainingStyle;
  persona: UserPersona;
  weeklySessions: number;
  blockLengthWeeks: number;
  progressionModel: "linear" | "double-progression" | "undulating" | "maintenance";
  recoveryBias: "low" | "moderate" | "high";
};

export const TRAINING_BLOCK_TEMPLATES: TrainingBlockTemplate[] = [
  { style: "bodybuilding", persona: "beginner", weeklySessions: 4, blockLengthWeeks: 6, progressionModel: "linear", recoveryBias: "moderate" },
  { style: "bodybuilding", persona: "intermediate", weeklySessions: 5, blockLengthWeeks: 8, progressionModel: "double-progression", recoveryBias: "moderate" },
  { style: "powerbuilding", persona: "advanced", weeklySessions: 5, blockLengthWeeks: 8, progressionModel: "undulating", recoveryBias: "high" },
  { style: "hybrid", persona: "intermediate", weeklySessions: 5, blockLengthWeeks: 6, progressionModel: "undulating", recoveryBias: "high" },
  { style: "fat-loss", persona: "beginner", weeklySessions: 4, blockLengthWeeks: 6, progressionModel: "maintenance", recoveryBias: "moderate" },
  { style: "female-wellness", persona: "intermediate", weeklySessions: 4, blockLengthWeeks: 6, progressionModel: "double-progression", recoveryBias: "moderate" },
  { style: "performance", persona: "advanced", weeklySessions: 6, blockLengthWeeks: 8, progressionModel: "undulating", recoveryBias: "high" },
];

export function selectTrainingTemplate(style: TrainingStyle, persona: UserPersona) {
  return (
    TRAINING_BLOCK_TEMPLATES.find((template) => template.style === style && template.persona === persona) ??
    TRAINING_BLOCK_TEMPLATES.find((template) => template.style === style) ??
    TRAINING_BLOCK_TEMPLATES[0]
  );
}

export function filterExercises(
  exercises: ExerciseDefinition[],
  options: { equipment?: EquipmentType[]; muscle?: string; difficulty?: ExerciseDefinition["difficulty"] },
) {
  return exercises.filter((exercise) => {
    const equipmentMatch = !options.equipment?.length || exercise.equipment.some((item) => options.equipment?.includes(item));
    const muscleMatch = !options.muscle || exercise.primaryMuscles.includes(options.muscle) || exercise.secondaryMuscles.includes(options.muscle);
    const difficultyMatch = !options.difficulty || exercise.difficulty === options.difficulty;
    return equipmentMatch && muscleMatch && difficultyMatch;
  });
}

type ReserveExerciseSeed = {
  name: string;
  bodyGroup: string;
  exactMuscle: string;
  stimulusType: string;
  sets: number;
  reps: string;
  rir: [number, number];
  tempo: string;
  restSeconds: number;
  cue: string;
  substitutions: string[];
  localFatigue: number;
  systemicFatigue: number;
  jointStress: "low" | "moderate" | "high";
};

type ReserveBlockSeed = {
  title: string;
  intent: string;
  estimatedMinutes: number;
  exercises: ReserveExerciseSeed[];
};

type ReserveDaySeed = {
  day: number;
  scheduledDay: string;
  title: string;
  focus: string;
  estimatedDurationMinutes: number;
  cardioMinutes: number;
  saunaMinutes: number;
  phase: "accumulation" | "intensification" | "specialization" | "deload" | "recovery";
  blocks: ReserveBlockSeed[];
};

const DEFAULT_TONY_CONTEXT = {
  name: "Tony",
  persona: "advanced" as UserPersona,
  goal: "Body recomposition with classic physique emphasis",
  trainingStyle: "Reserve Method",
  primaryFocus: "Upper chest, delts, back detail, and core",
  equipment: "Full gym",
};

const TEMPO_PARTS: Record<string, { eccentric: string; pause: string; concentric: string }> = {
  "3-1-1-0": { eccentric: "3 sec controlled eccentric", pause: "1 sec loaded stretch", concentric: "1 sec hard drive" },
  "2-1-2-0": { eccentric: "2 sec controlled eccentric", pause: "1 sec squeeze or stable pause", concentric: "2 sec controlled concentric" },
  "2-0-1-1": { eccentric: "2 sec eccentric", pause: "no bottom pause", concentric: "1 sec drive with 1 sec peak squeeze" },
  "4-1-1-0": { eccentric: "4 sec eccentric", pause: "1 sec positional pause", concentric: "1 sec clean drive" },
};

const RESERVE_METHOD_SPLIT: ReserveDaySeed[] = [
  {
    day: 1,
    scheduledDay: "Monday",
    title: "Reserve Chest/Back A",
    focus: "Upper chest thickness, lat width, and dense torso tension.",
    estimatedDurationMinutes: 132,
    cardioMinutes: 20,
    saunaMinutes: 18,
    phase: "accumulation",
    blocks: [
      {
        title: "Priority Chest",
        intent: "Drive upper-chest stimulus before fatigue leaks into pressing mechanics.",
        estimatedMinutes: 38,
        exercises: [
          ex("Incline Smith Press", "Chest", "clavicular pec fibers", "heavy mechanical tension", 4, "6-9", [1, 2], "3-1-1-0", 150, "Lock shoulder blades down and press through the upper chest path.", ["Incline barbell press", "Incline machine press"], 7, 6, "moderate"),
          ex("Low Incline Dumbbell Press", "Chest", "upper and mid pec", "lengthened hypertrophy", 3, "8-11", [1, 2], "3-1-1-0", 120, "Let the elbows drift slightly below the torso without losing rib control.", ["Converging incline press", "Plate-loaded incline press"], 6, 5, "moderate"),
          ex("Cable Fly Low-to-High", "Chest", "upper pec line", "shortened-position isolation", 3, "12-15", [1, 3], "2-1-2-0", 75, "Finish with hands above sternum and pecs fully shortened.", ["Pec deck high angle", "Incline cable fly"], 5, 3, "low"),
          ex("Weighted Dip Forward Lean", "Chest", "lower pec and sternal pec", "compound pump", 3, "8-12", [2, 3], "2-0-1-1", 120, "Use forward torso angle and stop if shoulder stress climbs.", ["Decline machine press", "Assisted dip"], 6, 5, "moderate"),
        ],
      },
      {
        title: "Priority Back",
        intent: "Pair width and thickness work without turning the session into generic pulling.",
        estimatedMinutes: 36,
        exercises: [
          ex("Neutral-Grip Pulldown", "Back", "lower lats", "lat-biased vertical pull", 4, "8-12", [1, 2], "3-1-1-0", 120, "Pull elbows toward front pockets and keep traps quiet.", ["Assisted neutral-grip pull-up", "One-arm cable pulldown"], 6, 5, "low"),
          ex("Chest-Supported Row", "Back", "mid-back and rhomboids", "stable heavy row", 4, "7-10", [1, 2], "2-1-1-1", 135, "Drive elbows back, pause, and keep the sternum glued to the pad.", ["Seal row", "Machine row"], 7, 5, "low"),
          ex("Single-Arm Cable Lat Row", "Back", "lat sweep", "unilateral line-of-pull correction", 3, "10-13", [1, 3], "3-1-1-0", 90, "Let the shoulder blade reach, then row elbow to hip.", ["One-arm dumbbell row", "Iso-lateral row"], 5, 4, "low"),
          ex("Straight-Arm Cable Pulldown", "Back", "teres major and lats", "constant-tension isolation", 3, "12-16", [2, 3], "2-1-2-0", 60, "Keep arms long and finish with lats, not triceps.", ["Machine pullover", "Dumbbell pullover"], 4, 3, "low"),
        ],
      },
      absBlock(1),
    ],
  },
  {
    day: 2,
    scheduledDay: "Tuesday",
    title: "Legs / Abs / Cardio",
    focus: "Quad output, controlled posterior support, mandatory abs, and conditioning.",
    estimatedDurationMinutes: 138,
    cardioMinutes: 25,
    saunaMinutes: 18,
    phase: "accumulation",
    blocks: [
      {
        title: "Priority Quads",
        intent: "Build quad sweep with stable loading and clean knee travel.",
        estimatedMinutes: 44,
        exercises: [
          ex("Hack Squat", "Legs", "vastus lateralis and quad sweep", "heavy mechanical tension", 4, "6-10", [1, 2], "4-1-1-0", 165, "Keep hips under you and drive knees forward over toes.", ["Pendulum squat", "Leg press high-control stance"], 8, 7, "moderate"),
          ex("Leg Press Narrow Stance", "Legs", "mid-quad", "volume tension", 4, "10-14", [1, 2], "3-1-1-0", 135, "Use deep knee flexion without pelvis tuck.", ["Belt squat", "Smith squat heel-elevated"], 7, 6, "moderate"),
          ex("Heel-Elevated Smith Squat", "Legs", "rectus femoris and VMO", "stable quad bias", 3, "8-12", [1, 2], "3-1-1-0", 135, "Stay tall and let knees own the pattern.", ["Goblet cyclist squat", "Machine squat"], 6, 5, "moderate"),
          ex("Leg Extension", "Legs", "terminal quad contraction", "shortened isolation", 4, "12-18", [1, 3], "2-1-2-1", 75, "Hold the top without swinging the stack.", ["Single-leg extension", "Sissy squat support"], 5, 3, "low"),
        ],
      },
      {
        title: "Secondary Posterior / Calves",
        intent: "Keep posterior-chain signal present without stealing recovery from Friday.",
        estimatedMinutes: 26,
        exercises: [
          ex("Seated Leg Curl", "Legs", "medial hamstrings", "lengthened hamstring work", 3, "10-14", [1, 2], "3-1-1-0", 90, "Lock hips down and curl through the full range.", ["Lying leg curl", "Nordic eccentric"], 5, 4, "low"),
          ex("Machine Hip Thrust", "Glutes", "glute max", "shortened glute tension", 3, "8-12", [2, 3], "2-1-1-1", 105, "Posterior tilt at lockout; no lumbar takeover.", ["Barbell hip thrust", "Cable pull-through"], 5, 4, "low"),
          ex("Standing Calf Raise", "Calves", "gastrocnemius", "loaded stretch plus peak contraction", 4, "8-12", [1, 2], "3-1-2-1", 75, "Own the bottom stretch and finish tall on the big toe.", ["Donkey calf raise", "Leg press calf raise"], 5, 3, "low"),
        ],
      },
      absBlock(2),
    ],
  },
  {
    day: 3,
    scheduledDay: "Wednesday",
    title: "Delts / Arms / Back Detail",
    focus: "Classic-physique shoulder width, arm detail, and upper-back finish.",
    estimatedDurationMinutes: 126,
    cardioMinutes: 20,
    saunaMinutes: 15,
    phase: "specialization",
    blocks: [
      {
        title: "Priority Delts",
        intent: "Bias medial and rear delts before arm work clouds shoulder mechanics.",
        estimatedMinutes: 36,
        exercises: [
          ex("Machine Shoulder Press", "Shoulders", "anterior and medial delts", "stable heavy press", 3, "7-10", [1, 2], "3-1-1-0", 135, "Press slightly forward of the ears and keep ribs stacked.", ["Seated dumbbell press", "Smith shoulder press"], 6, 5, "moderate"),
          ex("Cable Lateral Raise", "Shoulders", "medial delt", "lengthened isolation", 4, "12-18", [1, 3], "2-1-2-0", 60, "Lead with elbows and keep traps quiet.", ["Machine lateral raise", "Dumbbell lateral raise"], 5, 2, "low"),
          ex("Machine Lateral Raise", "Shoulders", "medial delt cap", "shortened pump", 4, "12-20", [1, 3], "2-1-2-1", 60, "Pause where the delt is fully shortened.", ["Cable Y-raise", "Lean-away lateral raise"], 5, 2, "low"),
          ex("Reverse Pec Deck", "Shoulders", "rear delts", "rear-delt isolation", 4, "12-18", [1, 3], "2-1-2-1", 60, "Sweep wide and avoid turning it into a row.", ["Cable rear-delt fly", "Chest-supported rear-delt raise"], 4, 2, "low"),
        ],
      },
      {
        title: "Secondary Arms / Back Detail",
        intent: "Add arm density and upper-back detail without chasing maximal loads.",
        estimatedMinutes: 34,
        exercises: [
          ex("EZ-Bar Curl", "Arms", "biceps brachii", "heavy elbow flexion", 3, "8-12", [1, 2], "3-1-1-0", 90, "Keep elbows pinned and finish without shoulder drift.", ["Cable curl", "Machine preacher curl"], 4, 3, "low"),
          ex("Overhead Cable Triceps Extension", "Arms", "long-head triceps", "lengthened triceps isolation", 3, "10-14", [1, 2], "3-1-1-0", 90, "Let elbows travel high and keep the stretch controlled.", ["Overhead dumbbell extension", "Machine triceps extension"], 4, 3, "low"),
          ex("Face Pull to External Rotation", "Back", "lower traps and rear delts", "postural detail", 3, "12-16", [2, 3], "2-1-2-1", 60, "Pull to eye line and rotate with control.", ["Cable high row", "Band face pull"], 3, 2, "low"),
        ],
      },
      absBlock(3),
    ],
  },
  {
    day: 4,
    scheduledDay: "Thursday",
    title: "Reserve Chest/Back B",
    focus: "Chest density, back thickness, and clean repeatable output.",
    estimatedDurationMinutes: 130,
    cardioMinutes: 20,
    saunaMinutes: 18,
    phase: "intensification",
    blocks: [
      {
        title: "Priority Chest",
        intent: "Use machine stability to push high-quality tension while protecting joints.",
        estimatedMinutes: 36,
        exercises: [
          ex("Converging Chest Press", "Chest", "mid pec", "stable mechanical tension", 4, "7-10", [1, 2], "3-1-1-0", 135, "Let handles converge while ribs stay down.", ["Dumbbell bench press", "Machine flat press"], 7, 5, "moderate"),
          ex("Incline Cable Press", "Chest", "upper pec", "constant-tension press", 3, "9-12", [1, 2], "3-1-1-0", 105, "Press up and in without shrugging.", ["Incline dumbbell press", "Smith incline press"], 6, 4, "low"),
          ex("Pec Deck", "Chest", "sternal pec", "shortened isolation", 3, "12-16", [1, 3], "2-1-2-1", 60, "Bring biceps toward midline and hold the squeeze.", ["Cable fly", "Machine fly"], 4, 2, "low"),
          ex("Push-Up Mechanical Drop", "Chest", "global pec pump", "metabolic finisher", 2, "near technical limit", [2, 3], "2-0-1-0", 60, "Stop before form breaks; keep shoulders packed.", ["Machine press back-off", "Assisted dip pump set"], 4, 3, "low"),
        ],
      },
      {
        title: "Priority Back",
        intent: "Thicken the torso with chest-supported work and lat isolation.",
        estimatedMinutes: 38,
        exercises: [
          ex("T-Bar Row Chest Supported", "Back", "mid-back thickness", "heavy stable row", 4, "6-10", [1, 2], "3-1-1-1", 150, "Pull elbows down and back, then pause the pad contact.", ["Plate-loaded row", "Seal row"], 7, 6, "low"),
          ex("Wide-Grip Pulldown", "Back", "upper lats and teres", "width-biased vertical pull", 4, "8-12", [1, 2], "3-1-1-0", 120, "Keep chest high and pull elbows outside the ribs.", ["Assisted pull-up", "Wide machine pulldown"], 6, 5, "low"),
          ex("Cable Row High-to-Low", "Back", "lower lat line", "lat finish", 3, "10-14", [1, 3], "2-1-2-0", 90, "Pull toward the hip crease and avoid torso swing.", ["Iso-lateral low row", "One-arm cable row"], 5, 3, "low"),
          ex("Machine Pullover", "Back", "lat length and ribcage line", "isolation stretch", 3, "10-15", [2, 3], "3-1-1-0", 75, "Keep elbows soft and drive with the lats.", ["Straight-arm pulldown", "Dumbbell pullover"], 4, 3, "low"),
        ],
      },
      absBlock(4),
    ],
  },
  {
    day: 5,
    scheduledDay: "Friday",
    title: "Posterior Legs / Calves",
    focus: "Hamstrings, glutes, calves, and trunk stiffness.",
    estimatedDurationMinutes: 136,
    cardioMinutes: 20,
    saunaMinutes: 20,
    phase: "intensification",
    blocks: [
      {
        title: "Priority Posterior Chain",
        intent: "Load hinge patterns without letting low-back fatigue become the session.",
        estimatedMinutes: 44,
        exercises: [
          ex("Romanian Deadlift", "Legs", "hamstrings at length", "loaded lengthened tension", 4, "6-9", [1, 2], "4-1-1-0", 165, "Hips back, lats tight, stop at hamstring limit.", ["Smith RDL", "Dumbbell RDL"], 8, 8, "moderate"),
          ex("Lying Leg Curl", "Legs", "distal hamstrings", "knee-flexion hypertrophy", 4, "8-12", [1, 2], "3-1-1-1", 105, "Keep hips heavy and curl through the pad.", ["Seated leg curl", "Single-leg curl"], 6, 4, "low"),
          ex("Back Extension Glute Bias", "Glutes", "glute max and hamstrings", "hip-extension volume", 3, "10-14", [1, 3], "3-1-1-1", 90, "Round upper back slightly and squeeze glutes through lockout.", ["Cable pull-through", "Reverse hyper"], 5, 4, "low"),
          ex("Seated Leg Curl Lengthened Partial", "Legs", "hamstrings at long length", "lengthened finisher", 2, "15-20", [2, 3], "2-1-2-0", 75, "Stay controlled in the stretched half of the rep.", ["Slider curl", "Machine partial curl"], 4, 3, "low"),
        ],
      },
      {
        title: "Priority Calves / Secondary Quads",
        intent: "Treat calves like a physique priority and keep knee-dominant volume present.",
        estimatedMinutes: 30,
        exercises: [
          ex("Seated Calf Raise", "Calves", "soleus", "deep loaded stretch", 4, "10-15", [1, 2], "3-1-2-1", 75, "Pause low, then finish with a full peak contraction.", ["Bent-knee calf press", "Smith seated calf"], 5, 2, "low"),
          ex("Standing Calf Raise", "Calves", "gastrocnemius", "straight-leg calf tension", 4, "8-12", [1, 2], "3-1-2-1", 75, "Keep knees soft and own the top.", ["Donkey calf raise", "Leg press calf"], 5, 2, "low"),
          ex("Walking Lunge", "Legs", "glutes and quads", "secondary unilateral volume", 3, "10-12 each leg", [2, 3], "2-0-1-0", 90, "Long stride, controlled knee path, no bounce.", ["Split squat", "Reverse lunge"], 5, 4, "moderate"),
        ],
      },
      absBlock(5),
    ],
  },
  {
    day: 6,
    scheduledDay: "Saturday",
    title: "Upper Specialization",
    focus: "Upper-chest, delts, arms, and back detail for classic silhouette.",
    estimatedDurationMinutes: 124,
    cardioMinutes: 15,
    saunaMinutes: 15,
    phase: "specialization",
    blocks: [
      {
        title: "Priority Upper Specialization",
        intent: "Drive the exact silhouette muscles that move the visual score fastest.",
        estimatedMinutes: 42,
        exercises: [
          ex("Incline Machine Press", "Chest", "upper pec", "stable upper-chest tension", 3, "8-11", [1, 2], "3-1-1-0", 120, "Keep the line high on the chest and finish clean.", ["Incline Smith press", "Low incline dumbbell press"], 6, 5, "moderate"),
          ex("Cable Y-Raise", "Shoulders", "medial delt and upper delt line", "cable specialization", 4, "12-18", [1, 3], "2-1-2-0", 60, "Raise in the scapular plane and keep neck relaxed.", ["Lean-away lateral raise", "Machine lateral raise"], 4, 2, "low"),
          ex("Preacher Curl Machine", "Arms", "biceps short head", "strict curl tension", 3, "10-14", [1, 2], "3-1-1-0", 75, "Keep the upper arm planted and avoid bouncing the bottom.", ["EZ preacher curl", "Cable preacher curl"], 4, 2, "low"),
          ex("Rope Pressdown", "Arms", "lateral triceps head", "shortened triceps pump", 3, "12-16", [1, 3], "2-1-2-1", 60, "Split the rope and lock out with control.", ["Machine dip", "Cable V-bar pressdown"], 3, 2, "low"),
        ],
      },
      {
        title: "Secondary Back Detail",
        intent: "Finish width and scapular control without overloading the hinge.",
        estimatedMinutes: 28,
        exercises: [
          ex("One-Arm Machine Row", "Back", "lat sweep", "unilateral detail", 3, "9-12", [1, 3], "3-1-1-0", 90, "Pull elbow to hip and hold the shortened lat.", ["Single-arm cable row", "Dumbbell row"], 5, 3, "low"),
          ex("High Cable Rear-Delt Row", "Shoulders", "rear delts", "rear-delt row", 3, "12-16", [1, 3], "2-1-2-1", 60, "Row wide with elbows high and wrists quiet.", ["Reverse pec deck", "Chest-supported rear-delt row"], 4, 2, "low"),
          ex("Cable Pullover", "Back", "lats and teres", "lat isolation", 3, "12-15", [2, 3], "2-1-2-0", 60, "Sweep down with the lats and avoid elbow bend creep.", ["Machine pullover", "Straight-arm pulldown"], 4, 2, "low"),
        ],
      },
      absBlock(6),
    ],
  },
  {
    day: 7,
    scheduledDay: "Sunday",
    title: "Recovery / Posing / Mobility",
    focus: "Tissue quality, easy conditioning, posing practice, and readiness reset.",
    estimatedDurationMinutes: 78,
    cardioMinutes: 25,
    saunaMinutes: 20,
    phase: "recovery",
    blocks: [
      {
        title: "Recovery Practice",
        intent: "Restore positions and keep physique skill work sharp without heavy loading.",
        estimatedMinutes: 33,
        exercises: [
          ex("Posing Round Practice", "Skill", "classic mandatory poses", "skill rehearsal", 4, "45-60 sec holds", [3, 4], "2-1-2-0", 45, "Brace, breathe, and make each transition deliberate.", ["Mirror posing", "Video check-in posing"], 2, 1, "low"),
          ex("Thoracic Mobility Flow", "Mobility", "t-spine and ribcage", "mobility", 3, "8-10 each side", [3, 4], "2-1-2-0", 45, "Move slowly and keep breath deep.", ["Open books", "Foam roller extensions"], 1, 1, "low"),
          ex("Hip Flexor and Hamstring Reset", "Mobility", "hips and hamstrings", "mobility", 3, "45 sec each side", [3, 4], "2-1-2-0", 45, "Find stretch without forcing range.", ["Couch stretch", "Band hamstring floss"], 1, 1, "low"),
        ],
      },
    ],
  },
];

function ex(
  name: string,
  bodyGroup: string,
  exactMuscle: string,
  stimulusType: string,
  sets: number,
  reps: string,
  rir: [number, number],
  tempo: string,
  restSeconds: number,
  cue: string,
  substitutions: string[],
  localFatigue: number,
  systemicFatigue: number,
  jointStress: "low" | "moderate" | "high",
): ReserveExerciseSeed {
  return { name, bodyGroup, exactMuscle, stimulusType, sets, reps, rir, tempo, restSeconds, cue, substitutions, localFatigue, systemicFatigue, jointStress };
}

function absBlock(day: number): ReserveBlockSeed {
  const rotation = [
    [
      ex("Cable Crunch", "Abs", "rectus abdominis", "loaded spinal flexion", 4, "10-15", [1, 3], "2-1-2-1", 60, "Curl ribs toward pelvis and keep hips still.", ["Machine crunch", "Kneeling band crunch"], 4, 2, "low"),
      ex("Hanging Knee Raise", "Abs", "lower abs and hip flexor control", "posterior pelvic tilt", 3, "10-15", [1, 3], "2-1-2-0", 60, "Tilt pelvis before raising knees.", ["Captain chair raise", "Reverse crunch"], 4, 2, "low"),
      ex("Pallof Press", "Abs", "obliques and anti-rotation", "anti-rotation stability", 3, "10-12 each side", [2, 3], "2-1-2-1", 45, "Do not let the cable rotate your torso.", ["Cable chop hold", "Band Pallof press"], 3, 1, "low"),
    ],
    [
      ex("Weighted Decline Crunch", "Abs", "rectus abdominis", "loaded trunk flexion", 4, "8-12", [1, 2], "3-1-1-1", 60, "Start with ribs high, finish with ribs down.", ["Cable crunch", "Machine crunch"], 4, 2, "low"),
      ex("Ab Wheel Rollout", "Abs", "anterior core", "anti-extension", 3, "6-10", [2, 3], "3-1-1-0", 75, "Stop before the low back extends.", ["Stability ball rollout", "Long-lever plank"], 4, 2, "low"),
      ex("Cable Wood Chop", "Abs", "obliques", "rotational control", 3, "10-12 each side", [2, 3], "2-1-2-0", 45, "Rotate through the trunk under control.", ["Landmine rotation", "Band chop"], 3, 2, "low"),
      ex("Vacuum Practice", "Abs", "transverse abdominis", "waist control", 3, "20-30 sec", [3, 4], "2-1-2-0", 45, "Exhale fully and hold tension without panic breathing.", ["Dead bug breathing", "Crocodile breathing"], 2, 1, "low"),
    ],
  ];

  const exercises = rotation[day % rotation.length];
  return {
    title: "Mandatory Abs",
    intent: "Keep midsection control trained as a physique priority, not an afterthought.",
    estimatedMinutes: exercises.length === 4 ? 24 : 18,
    exercises,
  };
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function defaultSplitDay() {
  const day = new Date().getDay();
  return day === 0 ? 7 : day;
}

function selectReserveMethodDay(splitDay?: number) {
  const day = splitDay ?? defaultSplitDay();
  return RESERVE_METHOD_SPLIT.find((item) => item.day === day) ?? RESERVE_METHOD_SPLIT[0];
}

function buildRecoveryGate(readinessScore?: number): RecoveryGate {
  if (typeof readinessScore !== "number") {
    return {
      status: "green",
      readinessScore: null,
      decision: "No readiness score logged. Run the premium fallback plan and log effort after the session.",
    adjustments: ["Use target RIR limits", "Keep cardio conversational", "Record joint and pump feedback"],
    };
  }

  if (readinessScore < 50) {
    return {
      status: "red",
      readinessScore,
      decision: "Recovery priority. Keep the session to mobility, easy cardio, posing, and symptom-free movement.",
      adjustments: ["Remove heavy compounds", "Keep all work at 3-4 RIR", "Cap cardio at easy Zone 2"],
    };
  }

  if (readinessScore < 70) {
    return {
      status: "yellow",
      readinessScore,
      decision: "Train moderate. Keep the structure but remove one hard set from each priority block.",
      adjustments: ["No failure sets", "Extend rest windows by 30 seconds", "Use substitutions if joints feel noisy"],
    };
  }

  return {
    status: "green",
    readinessScore,
    decision: "Train hard within the written RIR targets. Execution quality is the limiter.",
    adjustments: ["Keep top sets honest", "Progress only when rep quality holds", "Do not chase extra work after the plan"],
  };
}

function toPrescription(seed: ReserveExerciseSeed, blockTitle: string, index: number): ExercisePrescription {
  const tempo = TEMPO_PARTS[seed.tempo] ?? TEMPO_PARTS["3-1-1-0"];
  return {
    exerciseId: `${slug(blockTitle)}-${slug(seed.name)}-${index + 1}`,
    name: seed.name,
    bodyGroup: seed.bodyGroup,
    exactMuscle: seed.exactMuscle,
    stimulusType: seed.stimulusType,
    primaryMuscles: [seed.exactMuscle],
    secondaryMuscles: [],
    sets: seed.sets,
    repRange: seed.reps,
    reps: seed.reps,
    rir: {
      min: seed.rir[0],
      max: seed.rir[1],
      label: `${seed.rir[0]}-${seed.rir[1]} RIR`,
    },
    tempo: {
      notation: seed.tempo,
      eccentric: tempo.eccentric,
      pause: tempo.pause,
      concentric: tempo.concentric,
    },
    rest: {
      seconds: seed.restSeconds,
      range: `${Math.max(30, seed.restSeconds - 15)}-${seed.restSeconds + 15} sec`,
      note: seed.restSeconds >= 120 ? "Full performance rest. Start the next set when output is repeatable." : "Keep pace tight while preserving clean reps.",
    },
    executionCue: seed.cue,
    progressionRule: {
      model: seed.sets >= 4 ? "double-progression" : "rep-quality",
    trigger: "When all planned sets hit the top of the rep range inside the RIR target.",
      nextAction: "Add the smallest practical load next exposure or add one clean rep before load.",
      deloadSignal: "If joint stress rises or reps drop across two exposures, hold load and reduce one set.",
    },
    substitutionOptions: seed.substitutions.map((name) => ({
      name,
      reason: "Use if equipment is taken, setup does not match your frame, or joint feedback is not clean.",
      equipment: "Full gym alternative",
      preservesStimulus: seed.stimulusType,
    })),
    fatigueNotes: `${seed.bodyGroup} fatigue target ${seed.localFatigue}/10; systemic cost ${seed.systemicFatigue}/10. Keep it technical, not reckless.`,
    stimulusFatigueProfile: {
      stimulusType: seed.stimulusType,
      localFatigue: seed.localFatigue,
      systemicFatigue: seed.systemicFatigue,
      jointStress: seed.jointStress,
      recoveryDemand: seed.systemicFatigue >= 7 ? "high" : seed.systemicFatigue >= 4 ? "moderate" : "low",
    },
    intensityTarget: `${seed.rir[0]}-${seed.rir[1]} RIR`,
    restSeconds: seed.restSeconds,
    notes: seed.cue,
  };
}

function buildMuscleTargets(blocks: SessionBlock[]): MuscleTarget[] {
  const targetMap = new Map<string, MuscleTarget>();
  for (const block of blocks) {
    const role = block.title.includes("Priority")
      ? "priority"
      : block.title.includes("Abs")
        ? "abs"
        : block.title.includes("Recovery")
          ? "mobility"
          : "secondary";

    for (const exercise of block.exercises) {
      const key = `${exercise.bodyGroup}:${exercise.exactMuscle}`;
      const current = targetMap.get(key);
      targetMap.set(key, {
        bodyGroup: exercise.bodyGroup ?? "Training",
        exactMuscle: exercise.exactMuscle ?? exercise.name,
        role,
        targetSets: (current?.targetSets ?? 0) + exercise.sets,
        note: role === "priority" ? "Priority muscle exposure for today's split." : "Support work for balance and execution quality.",
      });
    }
  }

  return Array.from(targetMap.values());
}

export function generateReserveMethodTrainingSessionPlan(input: Partial<IntelligenceQuery> = {}): TrainingSessionPlan {
  const day = selectReserveMethodDay(input.splitDay);
  const recoveryGate = buildRecoveryGate(input.readinessScore);
  const blocks = day.blocks.map((block, blockIndex) => ({
    id: `day-${day.day}-block-${blockIndex + 1}-${slug(block.title)}`,
    title: block.title,
    intent: block.intent,
    bodyGroups: Array.from(new Set(block.exercises.map((exercise) => exercise.bodyGroup))),
    estimatedMinutes: block.estimatedMinutes,
    exercises: block.exercises.map((exercise, index) => toPrescription(exercise, block.title, index)),
  })) satisfies SessionBlock[];
  const exercises = blocks.flatMap((block) => block.exercises);
  const readiness = input.readinessScore;
  const isRecoveryDay = day.phase === "recovery" || recoveryGate.status === "red";
  const estimatedDurationMinutes = isRecoveryDay
    ? Math.min(day.estimatedDurationMinutes, 90)
    : Math.max(90, Math.min(150, day.estimatedDurationMinutes));

  return {
    id: `reserve-day-${day.day}-${slug(day.title)}`,
    userId: input.userId,
    title: day.title,
    focus: input.primaryFocus ?? day.focus,
    athleteName: input.name ?? DEFAULT_TONY_CONTEXT.name,
    goal: input.goal ?? DEFAULT_TONY_CONTEXT.goal,
    experienceLevel: input.persona ?? DEFAULT_TONY_CONTEXT.persona,
    splitName: input.trainingStyle ?? DEFAULT_TONY_CONTEXT.trainingStyle,
    splitDay: day.day,
    scheduledDay: day.scheduledDay,
    equipment: DEFAULT_TONY_CONTEXT.equipment,
    estimatedDurationMinutes,
    muscleTargets: buildMuscleTargets(blocks),
    blocks,
    cardioMinutes: day.cardioMinutes,
    saunaMinutes: day.saunaMinutes,
    recoveryGate,
    mesocycleState: {
      week: 6,
      phase: isRecoveryDay ? "recovery" : day.phase,
      volumeBias: isRecoveryDay ? "low" : day.phase === "specialization" ? "high" : "moderate",
      intensityBias: isRecoveryDay ? "moderate" : "high",
      fatigueTrend: typeof readiness === "number" && readiness < 70 ? "watch" : "stable",
    },
    readinessContext: readiness ?? null,
    exercises,
  };
}
