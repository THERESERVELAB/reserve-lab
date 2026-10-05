/* ════════════════════════════════════════════════════════════════════════
   RESERVE VISUAL ASSET MANIFEST — the production contract for imagery.

   Every production visual carries metadata so that the interface can be
   composed AROUND the image rather than the image being cropped blindly
   into whatever box the layout happens to have.

   The two fields that matter most, and that nothing else in the repo
   recorded before this file:

     focalPoint  — what the crop must keep. Desktop and mobile are separate
                   compositions, never the same crop at two sizes.
     uiSafe      — the region of the frame the interface is allowed to sit
                   on top of. This is the field that prevents a headline
                   landing on the brightest part of a plate.

   STATUS is the release gate. DRAFT and REVIEW assets must never be wired
   into production as final imagery — `productionPlate()` refuses them.

   LOOPS live here too, on the plate they animate and under the same id, so
   the motion on screen can only ever be the motion of the still on screen.
   A loop is cut from its approved still — frame 0 IS the plate — and it
   carries its own status, so an approved plate can hold a DRAFT loop while
   the motion is still being judged. `productionLoop()` is the loop's gate.

   DAYPARTS live here as well. A plate may declare a night (or dawn) variant
   of the same room, with its own sources, focal points and status. The day
   plate is the base and the fallback; `productionPlate(id, viewport, daypart)`
   serves a variant only when it is APPROVED.

   ── Honest state at time of writing ─────────────────────────────────────
   9 approved day plates exist in public/brand/backgrounds, each in 16:9 and
   its own 9:16 (2026-09-15: the 16:9 room extended to 9:16 with Adobe
   generative expand, so a phone frames the whole room instead of a crop).
   Approved night plates exist for the Apex, Training, Recovery, Nutrition and
   Schedule rooms, also each in 16:9 and 9:16. A phone is served the 9:16.
   Five rooms have video loops: Apex (16:9 2026-09-14), and Training,
   Recovery, Nutrition and Schedule (16:9 2026-09-16). Each also has its own
   9:16 loop (2026-09-16), cut from that room's 9:16 day plate, and a phone is
   served only that; the 16:9 loop is never served to a phone. Every loop
   belongs to a DAY plate: a night plate is always a still (ReserveEnvironment).
   A phone also keeps the still under Save-Data or a connection slower than 4G
   (lib/cinematic/loop-network).
   `mobileCropShotList()` lists any approved plate still missing its 9:16 —
   today it is empty.
   Detail images live in public/brand/details, each in 2400w and 1200w 16:9
   and its own 4:5 phone crop. See DETAIL_IMAGES. The Schedule and Compound
   rooms have none: the owner rejected Schedule's (2026-09-16) and neither
   replacement exists as a still.

   ── 2026-09-17, the empty-room re-cast ──────────────────────────────────
   Five more plates joined the registry: command-room, training-floor,
   chef-kitchen, recovery-suite and penthouse-study, deliberately empty
   establishing shots, each with its own 9:16 and a daypart variant that is
   the sky rather than the room re-lit (Earth from orbit, a supercell, ocean
   before dawn, aurora, and a first-light ridge at dawn). A room is cast onto
   its new plate by `castRoomPlate` only once that plate carries an APPROVED
   clip of its own — a loop's frame 0 is its own plate, and the rooms must
   never go still. Until then each room keeps its previous plate and loop.
   2026-09-18: the owner's slow kitchen take replaced the first one, still in
   REVIEW — it fails the crossfade join check (see chef-kitchen). No room has
   an approved clip of its new plate yet. Clips of the Earth and ocean night
   plates are recorded, not served.
   The clinical room gained a night (a dark nebula) and the entrance swapped
   its files for the black marble portal under the same id.
   Imagery approved but not cast yet is in `library.ts`, not here.
   ════════════════════════════════════════════════════════════════════════ */

import { ENVIRONMENT_PLATES } from "./visuals";

export type AssetStatus = "DRAFT" | "REVIEW" | "APPROVED" | "RETIRED";

/**
 * The region of the frame the interface may occupy. Named regions rather
 * than coordinates because the composition rule is what needs to survive a
 * re-crop, not a pixel box.
 */
export type UiSafeRegion =
  | "left-column"
  | "lower-left"
  | "lower-third"
  | "centre-band"
  | "upper-left";

/**
 * A seamless ambient loop of the plate that declares it. A plate without one
 * is a still — which, today, is every plate.
 */
export type VisualLoop = {
  /** 16:9 loop, cut from the desktop plate so its first frame matches it. */
  desktopSrc: string | null;
  /**
   * 9:16 loop. `null` until one is produced — and the desktop loop is never
   * served in its place. See `productionLoop()`.
   */
  mobileSrc: string | null;
  /** The loop's OWN release gate, independent of the plate's `status`. */
  status: AssetStatus;
  /** Length of one seamless cycle, as delivered. */
  loopSeconds: number;
  /**
   * How fast the room breathes, as a fraction of the delivered rate. Omitted
   * means `LOOP_PLAYBACK_RATE` (lib/cinematic/loop-crossfade): every room is
   * slowed, because luxury is calm. A room whose delivered motion is already
   * slower or faster than the rest can carry its own value here; nothing is
   * ever re-encoded to change it.
   */
  playbackRate?: number;
};

/** Time of day, resolved from the member's schedule (`resolveDaypart`). */
export type Daypart = "dawn" | "day" | "night";

/** Another light state of the same room. The day plate is the base asset. */
export type VisualDaypartPlate = {
  desktopSrc: string;
  /** 9:16 source. `null` falls back to the variant's desktop source. */
  mobileSrc: string | null;
  focalPoint: { desktop: string; mobile: string };
  /** The variant's OWN release gate, independent of the plate's `status`. */
  status: AssetStatus;
  /**
   * A clip cut from THIS variant's plate, recorded so it is not lost. Never
   * served today: a daypart variant is always a still (`productionLoop` reads
   * only the base plate's loop), so this is a register, not a cast.
   */
  loop?: VisualLoop;
};

export type VisualAsset = {
  /** Stable id. Referenced by ReserveEnvironment, never a raw path. */
  id: string;
  /** Human name, as it appears in the approved visual set. */
  name: string;
  environment: string;

  /** 16:9 source. Always present for an APPROVED asset. */
  desktopSrc: string;
  /**
   * 9:16 source — its own phone composition, never a crop of the 16:9. `null`
   * (none produced yet) falls back to the desktop plate at the mobile focal point.
   */
  mobileSrc: string | null;

  desktopAspectRatio: string;
  mobileAspectRatio: string;

  /** CSS background-position / object-position. Desktop and mobile differ. */
  focalPoint: { desktop: string; mobile: string };
  uiSafe: { desktop: UiSafeRegion; mobile: UiSafeRegion };

  /** Which screens this plate is the environment for. */
  intendedScreens: string[];

  /** Scrim required for interface contrast over this plate. */
  overlay: "vertical-scrim" | "soft-scrim-full" | "vignette-only";

  status: AssetStatus;
  version: number;

  /** Ambient motion for this plate. Absent means the plate is a still. */
  loop?: VisualLoop;

  /** Other dayparts of this room. Absent means the day plate serves all day. */
  dayparts?: Partial<Record<Exclude<Daypart, "day">, VisualDaypartPlate>>;
};

/* ─── The registry ────────────────────────────────────────────────────────
   Desktop focal points are inherited from the shipped cinematic config where
   one existed, so this file does not silently re-art-direct a screen. Where
   the config had no entry, the focal point is derived from the plate's subject
   and recorded here for the first time.

   Mobile focal points are for the 9:16 plates (2026-09-15). The room is fully
   framed in 9:16, so a phone (taller than 9:16) crops only a little from the
   sides: the point is centred, lowered only where the subject sits low. The
   old values anchored a 16:9 plate and would now push the room off-centre. */

export const VISUAL_ASSETS: Record<string, VisualAsset> = {
  "apex-command": {
    id: "apex-command",
    name: "Reserve Apex Command",
    environment: "personal-command",
    desktopSrc: ENVIRONMENT_PLATES.apexCommand,
    mobileSrc: ENVIRONMENT_PLATES.apexCommand9x16,
    desktopAspectRatio: "16:9",
    mobileAspectRatio: "9:16",
    /* 9:16: the pedestal under the rings sits just below centre. */
    focalPoint: { desktop: "50% 40%", mobile: "50% 55%" },
    uiSafe: { desktop: "left-column", mobile: "lower-third" },
    intendedScreens: ["Daily Command", "Apex Command"],
    overlay: "vertical-scrim",
    status: "APPROVED",
    version: 2,
    /* Firefly (Veo 3.1 partner model), image-to-video with this plate as the first AND
       last frame (2026-09-14, 1080p, 8s). Measured seam: 2.8/255 mean difference from
       last frame back to first; one slow light breath (~6s) peaking ~25% brighter.
       The phone has its own 9:16 loop (2026-09-16). */
    loop: {
      desktopSrc: "/brand/loops/apex-command-16x9.mp4",
      mobileSrc: "/brand/loops/apex-command-9x16.mp4",
      status: "APPROVED",
      loopSeconds: 8,
    },
    dayparts: {
      /* Owner-approved 2026-09-14 (Pit Wall direction B · Horizon). Same room and
         framing as the day plate, so the desktop focal point is shared; the 9:16
         is its own phone composition, centred on the pedestal under the rings. */
      night: {
        desktopSrc: ENVIRONMENT_PLATES.apexCommandNight,
        mobileSrc: ENVIRONMENT_PLATES.apexCommandNight9x16,
        focalPoint: { desktop: "50% 40%", mobile: "50% 42%" },
        status: "APPROVED",
        /* Firefly Video, 2026-09-30, Static camera preset and no frame
           reference — the combination that finally held. An aurora over a frozen sea, its curtains mirrored in plates of black ice.
           The scene itself never moves; the aurora shifting across the sky and its reflection moving with it on the ice.
           Luminance swing 3%, chroma 18.92. */
        loop: {
          desktopSrc: "/brand/loops/apex-command-night-16x9.mp4",
          mobileSrc: null,
          status: "REVIEW",
          /* PULLED 2026-10-01. Measured through the player, not screened:
             the composite join is 1.899 against this room's own drift of
             0.91, over the bar of max(drift, 1.8) that loop-crossfade
             enforces. The room keeps its night PLATE, which is approved and
             unaffected — night light stays, the movement goes. Restore this
             to APPROVED only with a clip that measures inside the bar. */
          loopSeconds: 5,
        },
      },
    },
  },
  "training-command": {
    id: "training-command",
    name: "Reserve Training Command Room 03",
    environment: "training-command",
    desktopSrc: ENVIRONMENT_PLATES.trainingCommand,
    mobileSrc: ENVIRONMENT_PLATES.trainingCommand9x16,
    desktopAspectRatio: "16:9",
    mobileAspectRatio: "9:16",
    focalPoint: { desktop: "50% 45%", mobile: "50% 50%" },
    uiSafe: { desktop: "left-column", mobile: "lower-third" },
    intendedScreens: ["Training", "Mesocycle Planner", "Program Horizon"],
    overlay: "vertical-scrim",
    status: "APPROVED",
    version: 4,
    /* Firefly (Veo 3.1), image-to-video with the day plate as the first AND last
       frame (2026-09-16, 1920×1080, 8s, 24fps, no audio). Owner-approved. The
       measured seam is larger than Apex's (~7% of pixels differ from last frame
       back to first), so the player's seam crossfade carries it. Its 9:16 phone loop is cut from the 9:16 day plate. */
    loop: {
      desktopSrc: "/brand/loops/training-command-16x9.mp4",
      mobileSrc: "/brand/loops/training-command-9x16.mp4",
      status: "APPROVED",
      loopSeconds: 8,
    },
    dayparts: {
      /* Owner-approved 2026-09-14 (rooms direction, Training + Recovery). Same room and
         framing as the day plate, so the desktop focal point is shared; the 9:16 is its
         own phone composition. During a live session the room holds whatever light it
         had when the session began (resolveLivingRoom), so this never swaps mid-set. */
      night: {
        desktopSrc: ENVIRONMENT_PLATES.trainingCommandNight,
        mobileSrc: ENVIRONMENT_PLATES.trainingCommandNight9x16,
        focalPoint: { desktop: "50% 45%", mobile: "50% 40%" },
        status: "APPROVED",
        /* Firefly Video, 2026-09-30, Static camera preset and no frame
           reference — the combination that finally held. A volcanic fissure on a black basalt plain, molten channels cut through the rock.
           The scene itself never moves; the molten rock creeping along its channels, its bright crust cracking and knitting.
           Luminance swing 17%, chroma 13.73. */
        loop: {
          desktopSrc: "/brand/loops/training-command-night-16x9.mp4",
          mobileSrc: null,
          status: "APPROVED",
          loopSeconds: 5,
        },
      },
    },
  },
  "recovery-chamber": {
    id: "recovery-chamber",
    name: "Reserve Recovery Chamber 02",
    environment: "recovery-chamber",
    desktopSrc: ENVIRONMENT_PLATES.recoveryChamber,
    mobileSrc: ENVIRONMENT_PLATES.recoveryChamber9x16,
    desktopAspectRatio: "16:9",
    mobileAspectRatio: "9:16",
    focalPoint: { desktop: "50% 50%", mobile: "50% 50%" },
    uiSafe: { desktop: "lower-left", mobile: "lower-third" },
    intendedScreens: ["Recovery Command"],
    overlay: "soft-scrim-full",
    status: "APPROVED",
    version: 3,
    /* Firefly (Veo 3.1), image-to-video with the day plate as the first AND last
       frame (2026-09-16, 1920×1080, 8s, 24fps, no audio). Owner-approved. Its 9:16 phone loop is cut from the 9:16 day plate. */
    loop: {
      desktopSrc: "/brand/loops/recovery-chamber-16x9.mp4",
      mobileSrc: "/brand/loops/recovery-chamber-9x16.mp4",
      status: "APPROVED",
      loopSeconds: 8,
    },
    dayparts: {
      /* Owner-approved 2026-09-14 (rooms direction, Training + Recovery). Same room as
         the day plate, so the desktop focal point is shared; the 9:16 is its own phone
         composition. The chamber has no dawn plate: dawn is a faint tint over the day plate. */
      night: {
        desktopSrc: ENVIRONMENT_PLATES.recoveryChamberNight,
        mobileSrc: ENVIRONMENT_PLATES.recoveryChamberNight9x16,
        focalPoint: { desktop: "50% 50%", mobile: "50% 45%" },
        status: "APPROVED",
        /* Firefly Video, 2026-09-30, Static camera preset and no frame
           reference — the combination that finally held. A bioluminescent tide on a dark shore, the breaking edge glowing cobalt.
           The scene itself never moves; long slow swells spreading their glow across the sand.
           Luminance swing 29%, chroma 20.41. */
        loop: {
          desktopSrc: "/brand/loops/recovery-chamber-night-16x9.mp4",
          mobileSrc: null,
          status: "APPROVED",
          loopSeconds: 5,
        },
      },
    },
  },
  "nutrition-command": {
    id: "nutrition-command",
    name: "Reserve Nutrition Command 01",
    environment: "nutrition-atelier",
    desktopSrc: ENVIRONMENT_PLATES.nutritionCommand,
    mobileSrc: ENVIRONMENT_PLATES.nutritionCommand9x16,
    desktopAspectRatio: "16:9",
    mobileAspectRatio: "9:16",
    focalPoint: { desktop: "50% 48%", mobile: "50% 50%" },
    uiSafe: { desktop: "left-column", mobile: "lower-third" },
    intendedScreens: ["Nutrition Command", "Fuel Command", "Prep Command"],
    overlay: "vertical-scrim",
    status: "APPROVED",
    version: 2,
    /* Firefly (Veo 3.1), image-to-video with the day plate as the first AND last
       frame (2026-09-16, 1920×1080, 8s, 24fps, no audio). Owner-approved. Its 9:16 phone loop is cut from the 9:16 day plate. */
    loop: {
      desktopSrc: "/brand/loops/nutrition-command-16x9.mp4",
      mobileSrc: "/brand/loops/nutrition-command-9x16.mp4",
      status: "APPROVED",
      loopSeconds: 8,
    },
    dayparts: {
      /* Owner-approved 2026-09-15 (Nutrition room). An Adobe grade of the day plate,
         same room and framing, so both focal points are the day plate's. Its 9:16 is
         the day 9:16 graded to match the 16:9 night plate. */
      night: {
        desktopSrc: ENVIRONMENT_PLATES.nutritionCommandNight,
        mobileSrc: ENVIRONMENT_PLATES.nutritionCommandNight9x16,
        focalPoint: { desktop: "50% 48%", mobile: "50% 50%" },
        status: "APPROVED",
        /* Firefly Video, 2026-09-30, Static camera preset and no frame
           reference — the combination that finally held. Fireflies over a dark meadow, warm gold points among tall grass.
           The scene itself never moves; the points of light drifting independently, some fading as others come up.
           Luminance swing 15%, chroma 15.28. */
        loop: {
          desktopSrc: "/brand/loops/nutrition-command-night-16x9.mp4",
          mobileSrc: null,
          status: "APPROVED",
          loopSeconds: 5,
        },
      },
    },
  },
  "schedule-command": {
    id: "schedule-command",
    name: "Reserve Schedule Command 02",
    environment: "schedule-command",
    desktopSrc: ENVIRONMENT_PLATES.scheduleCommand,
    mobileSrc: ENVIRONMENT_PLATES.scheduleCommand9x16,
    desktopAspectRatio: "16:9",
    mobileAspectRatio: "9:16",
    /* Previously rendered with the apex-command focal point because no
       schedule entry existed in the cinematic config. Recorded properly here. */
    focalPoint: { desktop: "50% 42%", mobile: "50% 50%" },
    uiSafe: { desktop: "left-column", mobile: "lower-third" },
    intendedScreens: ["Schedule Command", "Daily Operating Plan"],
    overlay: "vertical-scrim",
    status: "APPROVED",
    version: 3,
    /* Firefly (Veo 3.1), image-to-video with the day plate as the first AND last
       frame (2026-09-16, 1920×1080, 8s, 24fps, no audio). Owner-approved. Its 9:16 phone loop is cut from the 9:16 day plate. */
    loop: {
      desktopSrc: "/brand/loops/schedule-command-16x9.mp4",
      mobileSrc: "/brand/loops/schedule-command-9x16.mp4",
      status: "APPROVED",
      loopSeconds: 8,
    },
    dayparts: {
      /* Owner-approved 2026-09-15 (Schedule room). An Adobe grade of the day plate,
         same room and framing, so both focal points are the day plate's. Its 9:16 is
         the day 9:16 graded to match the 16:9 night plate. */
      night: {
        desktopSrc: ENVIRONMENT_PLATES.scheduleCommandNight,
        mobileSrc: ENVIRONMENT_PLATES.scheduleCommandNight9x16,
        focalPoint: { desktop: "50% 42%", mobile: "50% 50%" },
        status: "APPROVED",
        /* Firefly Video, 2026-09-30, Static camera preset and no frame
           reference — the combination that finally held. The core of the Milky Way standing above red desert spires.
           The scene itself never moves; a thin veil of high cloud drifting across the star band.
           Luminance swing 12%, chroma 18.20. */
        loop: {
          desktopSrc: "/brand/loops/schedule-command-night-16x9.mp4",
          mobileSrc: null,
          status: "REVIEW",
          /* PULLED 2026-10-01. Measured through the player, not screened:
             the composite join is 2.09 against this room's own drift of
             1.388, over the bar of max(drift, 1.8) that loop-crossfade
             enforces. The room keeps its night PLATE, which is approved and
             unaffected — night light stays, the movement goes. Restore this
             to APPROVED only with a clip that measures inside the bar. */
          loopSeconds: 5,
        },
      },
    },
  },
  "biomarkers-lab": {
    id: "biomarkers-lab",
    name: "Reserve Biomarkers Lab 02",
    environment: "biomarker-vault",
    desktopSrc: ENVIRONMENT_PLATES.biomarkersLab,
    mobileSrc: ENVIRONMENT_PLATES.biomarkersLab9x16,
    desktopAspectRatio: "16:9",
    mobileAspectRatio: "9:16",
    focalPoint: { desktop: "50% 45%", mobile: "50% 50%" },
    uiSafe: { desktop: "left-column", mobile: "lower-third" },
    intendedScreens: ["Bloodwork Log", "Biomarker Intelligence", "Compound Log"],
    overlay: "vertical-scrim",
    status: "APPROVED",
    version: 3,
    dayparts: {
      /* Owner casting 2026-09-24, second dawn set. A glacier from above at
         first light: a crystalline fracture network running across blue ice.
         Precise and analytical WITHOUT being medical, which is the constraint
         this room is held to — geometry, never clinical imagery.
         Still: no dawn clip exists for any room yet. */
      dawn: {
        desktopSrc: ENVIRONMENT_PLATES.biomarkersLabDawn,
        mobileSrc: ENVIRONMENT_PLATES.biomarkersLabDawn9x16,
        focalPoint: { desktop: "50% 50%", mobile: "50% 50%" },
        status: "APPROVED",
      },
      /* Owner casting 2026-09-17 (Compound Command): a restrained dark
         nebula — mostly black, no clinical or compound imagery of any kind.
         The clinical rooms share one environment, so Bloodwork and Biomarker
         Intelligence take the same night. The day plate is unchanged: the
         wellness-suite still the casting asked for is not in the approved
         set (see the report). */
      night: {
        desktopSrc: ENVIRONMENT_PLATES.biomarkersLabNight,
        mobileSrc: ENVIRONMENT_PLATES.biomarkersLabNight9x16,
        focalPoint: { desktop: "50% 50%", mobile: "50% 50%" },
        status: "APPROVED",
        /* Firefly Video, 2026-09-30, Static camera preset and no frame
           reference — the combination that finally held. A geothermal pool with an aurora reflected in its turquoise water.
           The scene itself never moves; steam rising and leaning off the water, the aurora moving with its reflection.
           Luminance swing 8%, chroma 14.05. */
        loop: {
          desktopSrc: "/brand/loops/biomarkers-lab-night-16x9.mp4",
          mobileSrc: null,
          status: "REVIEW",
          /* PULLED 2026-10-01. Measured through the player, not screened:
             the composite join is 1.888 against this room's own drift of
             0.954, over the bar of max(drift, 1.8) that loop-crossfade
             enforces. The room keeps its night PLATE, which is approved and
             unaffected — night light stays, the movement goes. Restore this
             to APPROVED only with a clip that measures inside the bar. */
          loopSeconds: 5,
        },
      },
    },
  },
  "intelligence-command": {
    id: "intelligence-command",
    name: "Reserve Intelligence Command 02",
    environment: "response-intelligence",
    desktopSrc: ENVIRONMENT_PLATES.intelligenceCommand,
    mobileSrc: ENVIRONMENT_PLATES.intelligenceCommand9x16,
    desktopAspectRatio: "16:9",
    mobileAspectRatio: "9:16",
    focalPoint: { desktop: "50% 45%", mobile: "50% 50%" },
    uiSafe: { desktop: "left-column", mobile: "lower-third" },
    intendedScreens: ["AI Strategist", "Response Profile"],
    overlay: "vertical-scrim",
    status: "APPROVED",
    version: 3,
    dayparts: {
      /* Owner casting 2026-09-24. A black hole accretion disc seen near edge-on, one thin bright
         ring against black. Knowledge at the edge of what is knowable —
         approved 2026-09-17 as `black-hole-disc` and uncast until now.
         A night plate is a still unless it carries its own clip. */
      night: {
        desktopSrc: ENVIRONMENT_PLATES.intelligenceCommandNight,
        mobileSrc: ENVIRONMENT_PLATES.intelligenceCommandNight9x16,
        focalPoint: { desktop: "50% 50%", mobile: "50% 50%" },
        status: "APPROVED",
        /* Firefly Video image-to-video from this plate, 2026-09-30: 1920x1080,
           5.04s, 24fps, silent. Motion is the bright ring of matter rotating slowly around the dark centre, shearing as it turns — the
           subject's own physical movement, never a change in the light.
           Luminance swing 15%.

           A fourth was generated the same day and REJECTED: the wellness
           suite's night is a dark spacecraft interior, and at 179% swing it
           did exactly what two attempts at a dark training room did. An
           interior lit only by one bright source gives a model nothing to
           animate but the light. Compound's night stays a still. */
        loop: {
          desktopSrc: "/brand/loops/intelligence-command-night-16x9.mp4",
          mobileSrc: null,
          status: "APPROVED",
          loopSeconds: 5,
        },
      },
      /* Owner casting 2026-09-24, second dawn set. A sea of cloud with only the highest peaks breaking through,
         first light just reaching their tips. This room's brief asks for
         'structural light resolving, as if something is becoming known'.
         Still: no dawn clip exists for any room yet. */
      dawn: {
        desktopSrc: ENVIRONMENT_PLATES.intelligenceCommandDawn,
        mobileSrc: ENVIRONMENT_PLATES.intelligenceCommandDawn9x16,
        focalPoint: { desktop: "50% 50%", mobile: "50% 50%" },
        status: "APPROVED",
      },
    },
  },
  "physique-scanner": {
    id: "physique-scanner",
    name: "Reserve Physique Scanner 02",
    environment: "physique-studio",
    desktopSrc: ENVIRONMENT_PLATES.physiqueScanner,
    mobileSrc: ENVIRONMENT_PLATES.physiqueScanner9x16,
    desktopAspectRatio: "16:9",
    mobileAspectRatio: "9:16",
    /* Also previously borrowed apex-command's focal point. */
    focalPoint: { desktop: "50% 38%", mobile: "50% 50%" },
    uiSafe: { desktop: "left-column", mobile: "lower-third" },
    intendedScreens: ["Physique", "Progress Photos", "Peak Physique"],
    overlay: "vertical-scrim",
    status: "APPROVED",
    version: 3,
    dayparts: {
      /* Owner casting 2026-09-24. A ringed planet low over the basalt plain of an airless moon.
         Form and silhouette, which is what this room is for — approved
         2026-09-17 as `moon-plain-ringed-planet` and uncast until now.
         A night plate is a still unless it carries its own clip. */
      night: {
        desktopSrc: ENVIRONMENT_PLATES.physiqueScannerNight,
        mobileSrc: ENVIRONMENT_PLATES.physiqueScannerNight9x16,
        focalPoint: { desktop: "50% 50%", mobile: "50% 50%" },
        status: "APPROVED",
        /* Firefly Video, 2026-09-30, Static camera preset and no frame
           reference — the combination that finally held. A ringed planet fixed on the horizon of an alien plain under aurora.
           The scene itself never moves; aurora curtains unfurling across the sky and the ground glow shifting beneath them.
           Luminance swing 3%, chroma 20.68. */
        loop: {
          desktopSrc: "/brand/loops/physique-scanner-night-16x9.mp4",
          mobileSrc: null,
          status: "REVIEW",
          /* PULLED 2026-10-01. Measured through the player, not screened:
             the composite join is 2.014 against this room's own drift of
             1.18, over the bar of max(drift, 1.8) that loop-crossfade
             enforces. The room keeps its night PLATE, which is approved and
             unaffected — night light stays, the movement goes. Restore this
             to APPROVED only with a clip that measures inside the bar. */
          loopSeconds: 5,
        },
      },
      /* Owner casting 2026-09-24, second dawn set. Sculpted sandstone at first light: long wind-carved curves of
         rock, form read purely as light and shadow. The studio the member is
         about to stand in, stated as landscape.
         Still: no dawn clip exists for any room yet. */
      dawn: {
        desktopSrc: ENVIRONMENT_PLATES.physiqueScannerDawn,
        mobileSrc: ENVIRONMENT_PLATES.physiqueScannerDawn9x16,
        focalPoint: { desktop: "50% 50%", mobile: "50% 50%" },
        status: "APPROVED",
      },
    },
  },
  "entrance-gallery": {
    id: "entrance-gallery",
    name: "Reserve Master Environment 02 — Entrance Gallery Clean",
    environment: "reserve-gate",
    desktopSrc: ENVIRONMENT_PLATES.entranceGallery,
    mobileSrc: ENVIRONMENT_PLATES.entranceGallery9x16,
    desktopAspectRatio: "16:9",
    mobileAspectRatio: "9:16",
    /* 9:16: the corridor's vanishing point, where the sculpture stands. */
    /* 2026-09-17: the plate behind both files is now the monolithic black
       marble portal at the end of a dark corridor — the Threshold the
       sign-in screen was designed around. Same id, same paths, new files, so
       nothing that references the entrance by id had to change. The portal
       and the floor's light seam are centred in both cuts; the 9:16 is a real
       crop of the master, not a squash. */
    focalPoint: { desktop: "50% 45%", mobile: "50% 50%" },
    uiSafe: { desktop: "centre-band", mobile: "centre-band" },
    intendedScreens: ["Reserve Entry", "Community"],
    overlay: "vertical-scrim",
    status: "APPROVED",
    version: 4,
    dayparts: {
      /* Owner casting 2026-09-24. A gas giant with razor-thin rings, lit along one edge from its
         night side. The most welcoming of the four — approved 2026-09-17 as
         `ringed-gas-giant` and uncast until now.
         A night plate is a still unless it carries its own clip. */
      night: {
        desktopSrc: ENVIRONMENT_PLATES.entranceGalleryNight,
        mobileSrc: ENVIRONMENT_PLATES.entranceGalleryNight9x16,
        focalPoint: { desktop: "50% 50%", mobile: "50% 50%" },
        status: "APPROVED",
        /* Firefly Video, 2026-09-30, Static camera preset and no frame
           reference — the combination that finally held. A deep space nebula field, layered cloud in magenta, cyan and gold.
           The scene itself never moves; the finest gas veils drifting across the field.
           Luminance swing 27%, chroma 13.70. */
        loop: {
          desktopSrc: "/brand/loops/entrance-gallery-night-16x9.mp4",
          mobileSrc: null,
          status: "REVIEW",
          /* PULLED 2026-10-01. Measured through the player, not screened:
             the composite join is 3.406 against this room's own drift of
             1.052, over the bar of max(drift, 1.8) that loop-crossfade
             enforces. The room keeps its night PLATE, which is approved and
             unaffected — night light stays, the movement goes. Restore this
             to APPROVED only with a clip that measures inside the bar. */
          loopSeconds: 5,
        },
      },
      /* Owner casting 2026-09-24, second dawn set. An open valley with a river running away through it, mist on
         the water. The most generous frame in the set, for the way in.
         Still: no dawn clip exists for any room yet. */
      dawn: {
        desktopSrc: ENVIRONMENT_PLATES.entranceGalleryDawn,
        mobileSrc: ENVIRONMENT_PLATES.entranceGalleryDawn9x16,
        focalPoint: { desktop: "50% 50%", mobile: "50% 50%" },
        status: "APPROVED",
      },
    },
  },

  /* ─── The empty-room set (owner-generated 2026-09-17) ───────────────────
     Registered AFTER the rooms above on purpose: `productionAssetFor` takes
     the first approved plate for an environment, so the cinematic status
     report keeps describing the older, loop-carrying plate. What a member
     actually sees is chosen in `AnimatedBackground`'s ROOM_ENV through
     `castRoomPlate`: one of these once it has an approved clip, otherwise the
     older plate with its loop.

     A loop's frame 0 IS its plate, and the five approved room clips were cut
     from the PREVIOUS day plates, so none of them can be carried over. The
     only clip cut from one of these so far is chef-kitchen's, in REVIEW. */
  "command-room": {
    id: "command-room",
    name: "Reserve Command Room — Empty, Night",
    environment: "personal-command",
    desktopSrc: ENVIRONMENT_PLATES.commandRoom,
    mobileSrc: ENVIRONMENT_PLATES.commandRoom9x16,
    desktopAspectRatio: "16:9",
    mobileAspectRatio: "9:16",
    /* The desk sits just below centre against the glass; the 9:16 keeps the
       desk and the city above it, with the floor left clear for content. */
    focalPoint: { desktop: "50% 48%", mobile: "50% 46%" },
    uiSafe: { desktop: "left-column", mobile: "lower-third" },
    intendedScreens: ["Daily Command", "Apex Command"],
    overlay: "vertical-scrim",
    status: "APPROVED",
    version: 1,
    dayparts: {
      /* Owner casting 2026-09-24: Apex opens the day on a high ridge above a
         valley of mist — the widest view in the dawn set, for the room that
         is the overview. Still: no dawn clip exists for any room yet. */
      dawn: {
        desktopSrc: ENVIRONMENT_PLATES.commandRoomDawn,
        mobileSrc: ENVIRONMENT_PLATES.commandRoomDawn9x16,
        focalPoint: { desktop: "50% 50%", mobile: "50% 50%" },
        status: "APPROVED",
      },
      /* Owner casting 2026-09-17: the room's night is the sky it looks out
         on — the curved limb of Earth from low orbit. */
      night: {
        desktopSrc: ENVIRONMENT_PLATES.commandRoomNight,
        mobileSrc: ENVIRONMENT_PLATES.commandRoomNight9x16,
        focalPoint: { desktop: "50% 50%", mobile: "50% 50%" },
        status: "APPROVED",
        /* Firefly image-to-video from this Earth-from-orbit plate (downloaded
           2026-09-18, 1920×1080, 5.04s, silent). First frame vs the plate:
           6.3/255. Approved 2026-09-24 as Apex's night motion: a night plate
           is no longer forced to be a still, so this clip now serves the hours
           it was cut for. 16:9 only — a phone keeps the 9:16 night still. */
        loop: {
          desktopSrc: "/brand/loops/command-room-night-16x9.mp4",
          mobileSrc: null,
          status: "REVIEW",
          /* PULLED 2026-10-01. Measured through the player, not screened:
             the composite join is 2.117 against this room's own drift of
             1.083, over the bar of max(drift, 1.8) that loop-crossfade
             enforces. The room keeps its night PLATE, which is approved and
             unaffected — night light stays, the movement goes. Restore this
             to APPROVED only with a clip that measures inside the bar. */
          loopSeconds: 5,
        },
      },
    },
  },
  "training-floor": {
    id: "training-floor",
    name: "Reserve Training Floor — Empty, Night",
    environment: "training-command",
    desktopSrc: ENVIRONMENT_PLATES.trainingFloor,
    mobileSrc: ENVIRONMENT_PLATES.trainingFloor9x16,
    desktopAspectRatio: "16:9",
    mobileAspectRatio: "9:16",
    /* The racks run down the left; the 9:16 is cut on them rather than on the
       empty floor to the right. */
    focalPoint: { desktop: "50% 50%", mobile: "50% 52%" },
    uiSafe: { desktop: "left-column", mobile: "lower-third" },
    intendedScreens: ["Training", "Mesocycle Planner", "Program Horizon"],
    overlay: "vertical-scrim",
    status: "APPROVED",
    version: 1,
    dayparts: {
      /* Owner casting 2026-09-24: Training opens on a dune crest — one hard
         line of gold light across cold blue shadow. The most austere frame in
         the dawn set, for the room that asks the most. Still, no dawn clip. */
      dawn: {
        desktopSrc: ENVIRONMENT_PLATES.trainingFloorDawn,
        mobileSrc: ENVIRONMENT_PLATES.trainingFloorDawn9x16,
        focalPoint: { desktop: "50% 50%", mobile: "50% 50%" },
        status: "APPROVED",
      },
      /* RETIRED 2026-09-24 by owner direction: "no useless storms".
         Cast 2026-09-17 as a supercell over the plains at dusk, against a
         request for "lightning over the mountain range" — the approved set had
         no mountain storm, and this stood in. It was never actually on screen:
         until the clock was unpinned the same day, a room with a day loop held
         its day plate at every hour, so this plate had no way to render. The
         first time it did, it was rejected.

         A storm is not Training's night. Nature and the cosmos still are —
         Apex keeps Earth from orbit, Recovery its aurora, Nutrition the ocean
         — the objection is to weather with nothing behind it, not to sky.
         Training's night falls to `training-command-night`: the private
         training floor after hours, which is a room rather than a stand-in.

         The plate and its 9:16 stay on disk; only the casting is withdrawn.
         RETIRED, so `productionPlate` refuses it and `castRoomPlate` scores
         training-floor at 0 for this hour. */
      night: {
        desktopSrc: ENVIRONMENT_PLATES.trainingFloorNight,
        mobileSrc: ENVIRONMENT_PLATES.trainingFloorNight9x16,
        focalPoint: { desktop: "50% 45%", mobile: "50% 45%" },
        /* Back from RETIRED. This room's night was pulled when a supercell
           storm was generated for it against owner direction, and again when a
           dark interior cycled its own lights. The plate below is now frame 0
           of the clip, and the clip is the first of this set to pass every
           check including the raw seam at 3.16. */
        status: "APPROVED",
        /* Firefly Video, 2026-09-30, Static camera preset and no frame
           reference — the combination that finally held. A glacier front at twilight, ice glowing turquoise in near-black water.
           The scene itself never moves; the black water moving in long slow swells around the ice.
           Luminance swing 4%, chroma 13.82. */
        loop: {
          desktopSrc: "/brand/loops/training-floor-night-16x9.mp4",
          mobileSrc: null,
          status: "APPROVED",
          loopSeconds: 5,
        },
      },
    },
  },
  "chef-kitchen": {
    id: "chef-kitchen",
    name: "Reserve Chef Kitchen — Empty, Night",
    environment: "nutrition-atelier",
    desktopSrc: ENVIRONMENT_PLATES.chefKitchen,
    mobileSrc: ENVIRONMENT_PLATES.chefKitchen9x16,
    desktopAspectRatio: "16:9",
    mobileAspectRatio: "9:16",
    focalPoint: { desktop: "50% 50%", mobile: "50% 52%" },
    uiSafe: { desktop: "left-column", mobile: "lower-third" },
    intendedScreens: ["Nutrition Command", "Fuel Command", "Prep Command"],
    overlay: "vertical-scrim",
    status: "APPROVED",
    version: 1,
    /* Firefly image-to-video from THIS plate (downloaded 2026-09-18 18:15,
       1920×1080, 5.04s, silent): the slow take the owner asked for — one
       head of warm bronze light along the under-counter seam and a
       barely-there dolly push ("light should flow like an animation"). First
       frame measured against the plate: 4.4/255 mean difference (every other
       plate 23+). It replaces the 2026-09-17 take, which was never approved
       and pushed in harder. Still REVIEW: its last frame sits far from its
       first (the push), and at 1280 the crossfade join measured 1.05–1.09
       against 0.64–0.86 of the room's own drift (tests/e2e/loop-crossfade),
       so it would read as a pulse. Approving it moves Nutrition onto this
       plate via `castRoomPlate`. 16:9 only: a phone keeps the 9:16 still. */
    loop: {
      desktopSrc: "/brand/loops/chef-kitchen-16x9.mp4",
      mobileSrc: null,
      status: "REVIEW",
      loopSeconds: 5,
    },
    dayparts: {
      /* Owner casting 2026-09-24: a coastline at first light — wet sand taking
         the first warm light, sea mist along the shore. Deliberately water, so
         it carries into the black ocean swell this room already has at night.
         Still, no dawn clip. */
      dawn: {
        desktopSrc: ENVIRONMENT_PLATES.chefKitchenDawn,
        mobileSrc: ENVIRONMENT_PLATES.chefKitchenDawn9x16,
        focalPoint: { desktop: "50% 50%", mobile: "50% 50%" },
        status: "APPROVED",
      },
      /* Owner casting 2026-09-17: black ocean swell before dawn. */
      night: {
        desktopSrc: ENVIRONMENT_PLATES.chefKitchenNight,
        mobileSrc: ENVIRONMENT_PLATES.chefKitchenNight9x16,
        focalPoint: { desktop: "50% 50%", mobile: "50% 50%" },
        status: "APPROVED",
        /* Firefly image-to-video from this ocean plate (downloaded 2026-09-18,
           1920×1080, 5.04s, silent). First frame vs the plate: 5.1/255.
           Approved 2026-09-24 as Nutrition's night motion. Note this is the
           NIGHT clip; the day clip above stays REVIEW on its own evidence.
           16:9 only — a phone keeps the 9:16 night still. */
        loop: {
          desktopSrc: "/brand/loops/chef-kitchen-night-16x9.mp4",
          mobileSrc: null,
          status: "REVIEW",
          /* PULLED 2026-10-01. Measured through the player, not screened:
             the composite join is 1.852 against this room's own drift of
             1.122, over the bar of max(drift, 1.8) that loop-crossfade
             enforces. The room keeps its night PLATE, which is approved and
             unaffected — night light stays, the movement goes. Restore this
             to APPROVED only with a clip that measures inside the bar. */
          loopSeconds: 5,
        },
      },
    },
  },
  "compound-suite": {
    id: "compound-suite",
    name: "Reserve Wellness Suite — Empty, Night",
    environment: "compound-command",
    desktopSrc: ENVIRONMENT_PLATES.compoundSuite,
    /* No 9:16 composition of this room has been generated. A phone falls back
       to the 16:9 at the mobile focal point, and `productionLoop` refuses to
       put the 16:9 clip on a phone, so a phone holds the still. */
    mobileSrc: null,
    desktopAspectRatio: "16:9",
    mobileAspectRatio: "16:9",
    /* The case sits left of centre on the counter; the counter runs out to the
       lower right, which is where content sits. */
    focalPoint: { desktop: "42% 52%", mobile: "42% 50%" },
    uiSafe: { desktop: "lower-left", mobile: "lower-third" },
    intendedScreens: ["Compound Command"],
    overlay: "vertical-scrim",
    status: "APPROVED",
    version: 1,
    /* Compound Command's room, at last. The manifest carried two takes of this
       room from 2026-09-18 that could never ship: they were delivered at
       1280×720 / 720×1280, below the 1920×1080 every room loop is held to, and
       no plate existed for them to open on.

       This is a different composition entirely (frame 0 measured 50.5/255
       against the old take — not a re-render, a new room) delivered at a true
       1920×1080, 8s, silent. Its plate is cut from its own frame 0, which is
       the path this file has always specified for a clip that arrives without
       a still: frame 0 vs the plate measures 0.2/255. Re-encoded to 4.6MB at
       the house rate. The 720p pair is retired and its files removed; nothing
       ever referenced them. */
    loop: {
      desktopSrc: "/brand/loops/compound-suite-16x9.mp4",
      mobileSrc: null,
      status: "APPROVED",
      loopSeconds: 8,
    },
    dayparts: {
      /* Owner casting 2026-09-24. Looking out from inside a dark craft onto deep space. A sealed,
         controlled room looking out on something vast — approved 2026-09-17 as
         `ship-viewport` and uncast until now.
         A night plate is a still unless it carries its own clip. */
      night: {
        desktopSrc: ENVIRONMENT_PLATES.compoundSuiteNight,
        mobileSrc: ENVIRONMENT_PLATES.compoundSuiteNight9x16,
        focalPoint: { desktop: "50% 50%", mobile: "50% 50%" },
        status: "APPROVED",
        /* Firefly Video, 2026-09-30, Static camera preset and no frame
           reference — the combination that finally held. Terraced hot spring pools, mineral basins in turquoise and amber.
           The scene itself never moves; steam leaning off the pools and thin sheets of water slipping over the rims.
           Luminance swing 5%, chroma 14.44. */
        loop: {
          desktopSrc: "/brand/loops/compound-suite-night-16x9.mp4",
          mobileSrc: null,
          status: "APPROVED",
          loopSeconds: 5,
        },
      },
      /* Owner casting 2026-09-24, second dawn set. Mineral salt terraces at
         first light: shallow geometric pans of still water stepping across the
         frame. Measured and controlled, which is this room's whole subject.
         Still: no dawn clip exists for any room yet.

         Note this variant HAS a 9:16 while the base day plate does not, so a
         phone gets a true phone composition at dawn and the wide plate at its
         mobile focal point the rest of the day. That is strictly better than
         the day plate, not a defect — the day 9:16 is still owed, and
         `mobileCropShotList` still reports it. */
      dawn: {
        desktopSrc: ENVIRONMENT_PLATES.compoundSuiteDawn,
        mobileSrc: ENVIRONMENT_PLATES.compoundSuiteDawn9x16,
        focalPoint: { desktop: "50% 50%", mobile: "50% 50%" },
        status: "APPROVED",
      },
    },
  },
  "recovery-suite": {
    id: "recovery-suite",
    name: "Reserve Recovery Suite — Empty, Night",
    environment: "recovery-chamber",
    desktopSrc: ENVIRONMENT_PLATES.recoverySuite,
    mobileSrc: ENVIRONMENT_PLATES.recoverySuite9x16,
    desktopAspectRatio: "16:9",
    mobileAspectRatio: "9:16",
    focalPoint: { desktop: "50% 52%", mobile: "50% 50%" },
    uiSafe: { desktop: "lower-left", mobile: "lower-third" },
    intendedScreens: ["Recovery Command"],
    overlay: "soft-scrim-full",
    status: "APPROVED",
    version: 1,
    dayparts: {
      /* Owner casting 2026-09-24: a glass-calm alpine lake at first light, the
         stillest frame in the dawn set. It is also the same water the aurora
         sits over at night, so this room reads as one place across the day.
         Still, no dawn clip. */
      dawn: {
        desktopSrc: ENVIRONMENT_PLATES.recoverySuiteDawn,
        mobileSrc: ENVIRONMENT_PLATES.recoverySuiteDawn9x16,
        focalPoint: { desktop: "50% 50%", mobile: "50% 50%" },
        status: "APPROVED",
      },
      /* Owner casting 2026-09-17: aurora over a still lake. */
      night: {
        desktopSrc: ENVIRONMENT_PLATES.recoverySuiteNight,
        mobileSrc: ENVIRONMENT_PLATES.recoverySuiteNight9x16,
        focalPoint: { desktop: "50% 50%", mobile: "50% 50%" },
        status: "APPROVED",
        /* Firefly image-to-video from this aurora plate (2026-09-17 18:36,
           1920×1080, 5.04s, silent). First frame vs the plate: 3.1/255 — the
           closest match in the set. Approved 2026-09-24 as Recovery's night
           motion. A second, near-identical take of this clip was delivered
           2026-09-18 (frame 0 within 0.5/255 of this one); it adds nothing and
           was not taken. 16:9 only — a phone keeps the 9:16 night still. */
        loop: {
          desktopSrc: "/brand/loops/recovery-suite-night-16x9.mp4",
          mobileSrc: null,
          status: "REVIEW",
          /* PULLED 2026-10-01. Measured through the player, not screened:
             the composite join is 2.554 against this room's own drift of
             0.856, over the bar of max(drift, 1.8) that loop-crossfade
             enforces. The room keeps its night PLATE, which is approved and
             unaffected — night light stays, the movement goes. Restore this
             to APPROVED only with a clip that measures inside the bar. */
          loopSeconds: 5,
        },
      },
    },
  },
  "penthouse-study": {
    id: "penthouse-study",
    name: "Reserve Penthouse Study — Empty, Night",
    environment: "schedule-command",
    desktopSrc: ENVIRONMENT_PLATES.penthouseStudy,
    mobileSrc: ENVIRONMENT_PLATES.penthouseStudy9x16,
    desktopAspectRatio: "16:9",
    mobileAspectRatio: "9:16",
    focalPoint: { desktop: "50% 48%", mobile: "50% 50%" },
    uiSafe: { desktop: "left-column", mobile: "lower-third" },
    intendedScreens: ["Schedule Command", "Daily Operating Plan"],
    overlay: "vertical-scrim",
    status: "APPROVED",
    version: 1,
    dayparts: {
      /* Owner casting 2026-09-17: the day starts on a ridge at first light.
         The first daypart variant in the product that is not a night. */
      dawn: {
        desktopSrc: ENVIRONMENT_PLATES.penthouseStudyDawn,
        mobileSrc: ENVIRONMENT_PLATES.penthouseStudyDawn9x16,
        focalPoint: { desktop: "50% 50%", mobile: "50% 50%" },
        status: "APPROVED",
      },
    },
  },
};

/* ─── Detail images ───────────────────────────────────────────────────────
   Room plates are the environment BEHIND the glass. Detail images are the
   objects of the room: a training journal, a loaded bar, a cold plunge. They
   sit INSIDE a section as a short atmospheric band (`ReserveDetailImage`),
   one per section at most, never above a room's hero statement or its gold
   primary.

   Each ships in three files under public/brand/details:
     <name>.webp       2400w 16:9 — desktop at high density
     <name>-1200.webp  1200w 16:9 — desktop at 1x, tablets
     <name>-4x5.webp   1080×1350 — its own hand-cropped phone composition
   A phone (< 768px) is only ever served the 4:5; nothing above it is.

   `crop.focalPoint` is object-position AND the origin the living drift
   scales from, so the drift can never walk the subject out of frame.
   `crop.zoom` is a still crop inside the band, for a frame that must lose
   an edge of the picture (hydration-bar: the back bar at far left).

   Every image is decorative where it is used today: it adds atmosphere, not
   information. The alt text is kept so a use that does carry meaning has it. */

export type DetailCrop = {
  /** CSS object-position, also the drift and zoom origin. */
  focalPoint: string;
  /** Still zoom inside the band. Absent = 1 (a plain cover crop). */
  zoom?: number;
};

export type DetailImage = {
  id: string;
  name: string;
  /** 2400w 16:9. */
  src: string;
  /** 1200w 16:9. */
  src1200: string;
  /** 1080×1350 4:5 phone composition. */
  src4x5: string;
  desktopAspectRatio: "16:9";
  mobileAspectRatio: "4:5";
  crop: { desktop: DetailCrop; mobile: DetailCrop };
  /** A tiny WebP data URL painted under the image until it decodes. */
  blurDataURL: string;
  alt: string;
  /** Decorative uses render alt="" and aria-hidden. */
  decorative: boolean;
  /** Where the image is wired, as view · section. */
  intendedSections: string[];
  status: AssetStatus;
  version: number;
  source: string;
};

const DETAIL_SOURCE = "Adobe Firefly (Gemini 3.1), owner-generated 2026-09-16";
/** The third set, generated the day after the second. */
const DETAIL_SOURCE_0917 = "Adobe Firefly (Gemini 3.1), owner-generated 2026-09-17";

function detailFiles(name: string): Pick<DetailImage, "src" | "src1200" | "src4x5" | "desktopAspectRatio" | "mobileAspectRatio"> {
  return {
    src: `/brand/details/${name}.webp`,
    src1200: `/brand/details/${name}-1200.webp`,
    src4x5: `/brand/details/${name}-4x5.webp`,
    desktopAspectRatio: "16:9",
    mobileAspectRatio: "4:5",
  };
}

export type DetailImageId =
  | "prep-journal"
  | "dawn-gym"
  | "strength-floor"
  | "fuel-prep"
  | "recovery-plunge"
  | "sleep-suite"
  | "hydration-bar"
  | "posing-room"
  | "protocol-blueprint"
  | "strategist-command"
  | "build-studio"
  | "labs-clinic"
  | "peak-stage"
  | "education-library"
  | "coach-suite"
  | "journal-desk"
  | "women-studio"
  | "women-wellness"
  | "community-lounge"
  | "measurements-suite"
  | "vault-door"
  | "decision-table";
/* The Schedule room's detail image was rejected by the owner (2026-09-16) and
   removed until its replacement arrives; Schedule ships without one. The
   2026-09-17 set does not contain it: the penthouse-study still in that set is
   the empty room, now Schedule's PLATE, not a desk still. Compound Command is
   in the same position — the wellness suite with the instrument case exists
   only as video, never as a still. Both stay unwired. */

export const DETAIL_IMAGES: Record<DetailImageId, DetailImage> = {
  "prep-journal": {
    id: "prep-journal",
    name: "Reserve Detail · Prep Journal",
    ...detailFiles("prep-journal"),
    crop: { desktop: { focalPoint: "50% 70%" }, mobile: { focalPoint: "50% 68%" } },
    blurDataURL:
      "data:image/webp;base64,UklGRpYAAABXRUJQVlA4IIoAAAAwBACdASoYAA0APtFWpEwoJKOiMAgBABoJYwCdG1/tv8B4MVrXX+hm64AA/vEjqCEXVN2z3l2CxJZ8miAJva3pfn+qtTMPdqW0AG/kgwYIIKyf2/dDUlrq1tpeLb5lEjwvh267OPJrscALVOwf3sMtwkvg93ELN/n54eUYhU78hhdhFyRZagOAAAA=",
    alt: "A closed training journal, a bronze stopwatch and a bowl of chalk on a dark marble bench in a private gym.",
    decorative: true,
    intendedSections: ["Apex · Hardass Prep standard"],
    status: "APPROVED",
    version: 1,
    source: DETAIL_SOURCE,
  },
  "dawn-gym": {
    id: "dawn-gym",
    name: "Reserve Detail · Dawn Gym",
    ...detailFiles("dawn-gym"),
    crop: { desktop: { focalPoint: "50% 58%" }, mobile: { focalPoint: "50% 62%" } },
    blurDataURL:
      "data:image/webp;base64,UklGRoIAAABXRUJQVlA4IHYAAADwAwCdASoYAA0APtFWo0uoJKMhsAgBABoJYwC7ABulHYL3in4KO0nAAP710pbVxwww4gUlKsdrhiK/yVBAT3mdPhsuAxzYtEdbzG8PN34cDq1aNmvSRGRSERcGcdM8R6v3ELKP8e78AoXNnEucyXJQ6rhgvGwA",
    alt: "An empty private gym before dawn, the city lights below the windows and a towel folded on a bench.",
    decorative: true,
    intendedSections: ["Apex · Hardass Prep standard, On a Cycle"],
    status: "APPROVED",
    version: 1,
    source: DETAIL_SOURCE,
  },
  "strength-floor": {
    id: "strength-floor",
    name: "Reserve Detail · Strength Floor",
    ...detailFiles("strength-floor"),
    crop: { desktop: { focalPoint: "50% 62%" }, mobile: { focalPoint: "50% 58%" } },
    blurDataURL:
      "data:image/webp;base64,UklGRoYAAABXRUJQVlA4IHoAAABQBACdASoYAA0APtFUo0uoJKMhsAgBABoJZQAIEAPyKE4+GnauOOl7yEgAAP7xa9ysPmzZxdKWjYOcUFBcjUgJMbkjpQIPWgNDZlFW2Iw/dJEzqMsZnL3NbfO4jbMMJc6MkGmOQBv6cBe5ImxmDv4o+0HQeLq2UqgAAA==",
    alt: "A loaded barbell resting on a wood and rubber lifting platform in front of a squat rack.",
    decorative: true,
    intendedSections: ["Training · Session Directive"],
    status: "APPROVED",
    version: 1,
    source: DETAIL_SOURCE,
  },
  "fuel-prep": {
    id: "fuel-prep",
    name: "Reserve Detail · Fuel Prep",
    ...detailFiles("fuel-prep"),
    crop: { desktop: { focalPoint: "55% 68%" }, mobile: { focalPoint: "50% 68%" } },
    blurDataURL:
      "data:image/webp;base64,UklGRpYAAABXRUJQVlA4IIoAAAAwBACdASoYAA0APtFWo0uoJKMhsAgBABoJZQCdMoGv/gNsO+2/n4kWPUAA/uwS794h9YLRp3C/EmOo/DLVWaTE/00deUPsE2bY2datyGJPvhxRbHo6kC8zrcmLVXGFgSHe3DWTw3G0orD0xD8HTUgv+4/m2d7pIHxK3T1DKnbNrX+jRCpxw8WAAAA=",
    alt: "Four prepared meal containers lined up on a dark marble kitchen island.",
    decorative: true,
    intendedSections: ["Nutrition · Prep Command"],
    status: "APPROVED",
    version: 1,
    source: DETAIL_SOURCE,
  },
  "recovery-plunge": {
    id: "recovery-plunge",
    name: "Reserve Detail · Recovery Plunge",
    ...detailFiles("recovery-plunge"),
    crop: { desktop: { focalPoint: "55% 62%" }, mobile: { focalPoint: "50% 58%" } },
    blurDataURL:
      "data:image/webp;base64,UklGRpoAAABXRUJQVlA4II4AAAAwBACdASoYAA0APtE4sFMoIiWjmAEAGgllAJ0gTn44CxkWErVEFbT1rNAA/ulfvKDrghMC1TvkhmpPnDUPIZB1ult+xfcnRw5oz8IB2zCiT958a7zdzPCsVp6mQJa/7z4ar4VMg8y5bC6vWpAo9fXeVzNf07f0khOZNIrIe1D82Gp3ngzjRQNSj1qNgAAA",
    alt: "A stone cold plunge beside a wooden bench with a folded towel, an eye mask and a foam roller.",
    decorative: true,
    intendedSections: ["Recovery · Recovery Suite"],
    status: "APPROVED",
    version: 1,
    source: DETAIL_SOURCE,
  },
  "sleep-suite": {
    id: "sleep-suite",
    name: "Reserve Detail · Sleep Suite",
    ...detailFiles("sleep-suite"),
    crop: { desktop: { focalPoint: "40% 58%" }, mobile: { focalPoint: "50% 72%" } },
    blurDataURL:
      "data:image/webp;base64,UklGRmoAAABXRUJQVlA4IF4AAACwAwCdASoYAA0APtFWo0uoJKMhsAgBABoJZQAAXK+d+Z+fabY4gAD+9E7nrkIB2JBNrv7qs4IWKD68D0t7qlKznhjrU5S8bcaPc/2S51aa5c94EKK89bGqekBZZiAA",
    alt: "A dark bedroom set for sleep: a made bed, a sleep mask on the pillow and blackout curtains.",
    decorative: true,
    intendedSections: ["Recovery · Sleep Log"],
    status: "APPROVED",
    version: 1,
    source: DETAIL_SOURCE,
  },
  "hydration-bar": {
    id: "hydration-bar",
    name: "Reserve Detail · Hydration Bar",
    ...detailFiles("hydration-bar"),
    /* The back bar at far left holds green bottles that could read as
       alcohol. Both crops zoom from an edge the bottles are not on: desktop
       keeps the carafes and the sauna door (right), the phone keeps the
       counter (bottom). Verify in a screenshot after any change here. */
    crop: {
      desktop: { focalPoint: "100% 55%", zoom: 1.8 },
      mobile: { focalPoint: "50% 100%", zoom: 1.25 },
    },
    blurDataURL:
      "data:image/webp;base64,UklGRqwAAABXRUJQVlA4IKAAAABQBACdASoYAA0APtFUo0uoJKMhsAgBABoJQBOgMYxcH7t4VQZg3je5oWBAAP7ussRNbNh0VqE7yV3WLTNEVDKXuM5OTdUflrFxYWv2ZbZAhKhg3CfCaEsKE5pVDtkSL4g0ZEgGhf97F8/r/bzupMsCr0v47CI/xNYhk4fePtXloSZeQn3mQY0GQoiOkgEyONJbx72+/IbDXbJ8qAB5MIAA",
    alt: "Glass water carafes on a dark marble counter beside a lit sauna door.",
    decorative: true,
    intendedSections: ["Recovery · Hydration Command"],
    status: "APPROVED",
    version: 1,
    source: DETAIL_SOURCE,
  },
  "posing-room": {
    id: "posing-room",
    name: "Reserve Detail · Posing Room",
    ...detailFiles("posing-room"),
    crop: { desktop: { focalPoint: "55% 55%" }, mobile: { focalPoint: "50% 62%" } },
    blurDataURL:
      "data:image/webp;base64,UklGRm4AAABXRUJQVlA4IGIAAACwAwCdASoYAA0APtFWo0uoJKMhsAgBABoJZwAAV8ApagXWWMvMAAD+8rhUw11di+lN9lZU+1RmnIX3S5IA7GWJYaKit0Qx/bPhL95YWr27VZ6xg57oNPXBdPYLJuOu1x0AAA==",
    alt: "A dark posing room with a floor-to-ceiling mirror wall, a spotlight and a tape measure on a bench.",
    decorative: true,
    intendedSections: ["Physique · Photo check-ins"],
    status: "APPROVED",
    version: 1,
    source: DETAIL_SOURCE,
  },
  "protocol-blueprint": {
    id: "protocol-blueprint",
    name: "Reserve Detail · Protocol Blueprint",
    ...detailFiles("protocol-blueprint"),
    crop: { desktop: { focalPoint: "50% 62%" }, mobile: { focalPoint: "50% 60%" } },
    blurDataURL:
      "data:image/webp;base64,UklGRnwAAABXRUJQVlA4IHAAAADwAwCdASoYAA0APtFUo0uoJKMhsAgBABoJYwCdAB6RrxC+rtTBvUMAAP7pXtozm3695vHzNBqy8GASy9o/QxsZ9lLrMc4ckdYahmVPrNXtwZ9ZyLKy0rHd0QzlM37AA2rWSscjq4WxrG+i25DrASAA",
    alt: "A bronze-lined blueprint on a dark marble desk with a drafting compass, a fountain pen and a steel ruler.",
    decorative: true,
    intendedSections: ["Personal Command · Recommendation"],
    status: "APPROVED",
    version: 1,
    source: DETAIL_SOURCE,
  },
  "strategist-command": {
    id: "strategist-command",
    name: "Reserve Detail · Strategist Command",
    ...detailFiles("strategist-command"),
    crop: { desktop: { focalPoint: "45% 50%" }, mobile: { focalPoint: "50% 55%" } },
    blurDataURL:
      "data:image/webp;base64,UklGRpIAAABXRUJQVlA4IIYAAAAwBACdASoYAA0APtFUo0uoJKMhsAgBABoJZQCsACIG/shimArZ6i7BcUAA/u9PLbEVYlJuqtGH1FjWFMuMH7Dr50k7fxg6fhR/6Yp48+0PInwQrZ9XgTuZO0r6R1u6F5xwdL+Y75zoq9GIsvr5T0IjUkwCOdU/smxF8jEreFKfh1Ea33gAAA==",
    alt: "A dark command room at night: a black marble table under flowing bronze light lines, city lights beyond the glass.",
    decorative: true,
    intendedSections: ["AI Strategist · What is moving your read (or What would build the read)"],
    status: "APPROVED",
    version: 1,
    source: DETAIL_SOURCE,
  },
  "build-studio": {
    id: "build-studio",
    name: "Reserve Detail · Build Studio",
    ...detailFiles("build-studio"),
    /* The cards carry garbled day names; at band size they read as texture. */
    crop: { desktop: { focalPoint: "50% 80%" }, mobile: { focalPoint: "50% 85%" } },
    blurDataURL:
      "data:image/webp;base64,UklGRooAAABXRUJQVlA4IH4AAABQBACdASoYAA0APtFUo0uoJKMhsAgBABoJYwCdACIj9qjD4opn17M4i54AAP7yv8lifj3Cb/twi/Ef2OYhHOcF16AbWnWDgYMgCJbqDAWgWAFi6SUxDdGHxzr0qNagTfG39f7C17/QEURj6OXDIYPAAeMixOIEUoMtA6fgAAA=",
    alt: "A walnut desk with black cards laid out in rows on a leather pad like a week, a bronze pen beside them.",
    decorative: true,
    intendedSections: ["Build Studio · Build"],
    status: "APPROVED",
    version: 1,
    source: DETAIL_SOURCE,
  },
  "labs-clinic": {
    id: "labs-clinic",
    name: "Reserve Detail · Labs Clinic",
    ...detailFiles("labs-clinic"),
    /* Desktop keeps the counter, the folder and the orchid's pot; the phone keeps the flowers too. */
    crop: { desktop: { focalPoint: "72% 70%" }, mobile: { focalPoint: "50% 45%" } },
    blurDataURL:
      "data:image/webp;base64,UklGRpAAAABXRUJQVlA4IIQAAAAQBACdASoYAA0APtFUo0uoJKMhsAgBABoJZQC06CIj3n7mD8z3nnCkAAD6mott3VSF06ckSVia+xNohLJy9QR/JSk6IkR93O7Ohx4+N17Eb6JVPRkuX98UTMN4WdpCkY2OcKGl7XgxMtT6c1s9gA5T1FdgFH26YsXUWh7mN+Ckd/GgAAA=",
    alt: "A private clinic lounge in black marble and walnut, a leather folder on the counter beside a purple orchid.",
    decorative: true,
    intendedSections: ["Bloodwork · Lab history", "Biomarker Cockpit · Markers (or What this needs)"],
    status: "APPROVED",
    version: 1,
    source: DETAIL_SOURCE,
  },
  "peak-stage": {
    id: "peak-stage",
    name: "Reserve Detail · Peak Stage",
    ...detailFiles("peak-stage"),
    /* High on desktop so the portal's crown stays in the short band. */
    crop: { desktop: { focalPoint: "50% 35%" }, mobile: { focalPoint: "50% 50%" } },
    blurDataURL:
      "data:image/webp;base64,UklGRnwAAABXRUJQVlA4IHAAAADQAwCdASoYAA0APtFUo0uoJKMhsAgBABoJYwAAWLgXke/ybuBvOAAA/vV+HQQhE9pHKdV1gqh0afwxhr1N/mPIikmcrGm6mO3E4M1Qxd3dj/ne/uPMrcF2gMUZORY+2+IEMoq2/D12SI/8YrwBwAAA",
    alt: "An empty contemporary stage in haze, framed by a portal of bronze light lines on a black marble wall.",
    decorative: true,
    intendedSections: ["Peak Physique · What peak week runs on"],
    status: "APPROVED",
    version: 1,
    source: DETAIL_SOURCE,
  },
  "education-library": {
    id: "education-library",
    name: "Reserve Detail · Education Library",
    ...detailFiles("education-library"),
    crop: { desktop: { focalPoint: "45% 55%" }, mobile: { focalPoint: "50% 55%" } },
    blurDataURL:
      "data:image/webp;base64,UklGRp4AAABXRUJQVlA4IJIAAAAQBACdASoYAA0APtFWo0uoJKMhsAgBABoJYwCw7CIj6Ka793gPhy8wAAD+704XALyacPRJ05wx7uBjSRQKbxb2DnhcCVySLtKkwT8jLqu3oy1ec6JXEIB4FWc/AqqIY5yzpUEIk7kyDHyMJ6LMAwYN0Uu+0fiSFVUbpmxb0OkfMVywjnRoo3b2oBem1bp4DUAAAA==",
    alt: "A contemporary library lounge: lit walnut shelves of books behind a black leather sofa and a stone table.",
    decorative: true,
    intendedSections: ["Education · Glossary"],
    status: "APPROVED",
    version: 1,
    source: DETAIL_SOURCE,
  },
  "coach-suite": {
    id: "coach-suite",
    name: "Reserve Detail · Coach Suite",
    ...detailFiles("coach-suite"),
    /* Framed high: the chairs and the skyline, with the carafe on the table
       kept to the lower edge. */
    crop: { desktop: { focalPoint: "50% 40%" }, mobile: { focalPoint: "50% 32%" } },
    blurDataURL:
      "data:image/webp;base64,UklGRpoAAABXRUJQVlA4II4AAACwAwCdASoYAA0APtFUo0uoJKMhsAgBABoJQBOgBH2pIJYSjyBA4AD+6jNoMl1LQSt/X04JTjvO9v5gIg+iOzbG2D7PpOonfAT23sXpZTu7sLuCavLF5OZDExZ5IRMDFumNhvxO8V9n3CHn7YRyWn47a5kcso0BA8OH3qbSacjHl/U5xwqtz3ZfroSUsAAA",
    alt: "Two leather chairs facing each other across a marble table, a night skyline through floor-to-ceiling windows.",
    decorative: true,
    intendedSections: ["My Coach · Your coach"],
    status: "APPROVED",
    version: 1,
    source: DETAIL_SOURCE,
  },
  "journal-desk": {
    id: "journal-desk",
    name: "Reserve Detail · Journal Desk",
    ...detailFiles("journal-desk"),
    crop: { desktop: { focalPoint: "45% 55%" }, mobile: { focalPoint: "50% 60%" } },
    blurDataURL:
      "data:image/webp;base64,UklGRqoAAABXRUJQVlA4IJ4AAADQAwCdASoYAA0APtFUo0uoJKMhsAgBABoJZQAAWl2AMp1Ag+6ceZwA/uX3GgIKjDSI7G2ZzBrNdNR5hT7XIcw7EIH2jCvgMK13+c5cTYoaa4OLzjFoa3IQ+bzQNyM3B/N729moWAULIZX9AiP1QPvaGi7semFU3NH3w3C4VDw0iHEWkWCJuq9MKJQPWdGyRsGB8h5JbXMQomlG9/L4AA==",
    alt: "A steel watch beside an open journal and a fountain pen on dark marble, city lights beyond the window.",
    decorative: true,
    intendedSections: ["Journal · Entries"],
    /* Owner approved 2026-09-16: recognizable Patek Philippe Nautilus kept by owner decision; brand name visible on dial. */
    status: "APPROVED",
    version: 1,
    source: DETAIL_SOURCE,
  },
  "women-studio": {
    id: "women-studio",
    name: "Reserve Detail · Women's Studio",
    ...detailFiles("women-studio"),
    crop: { desktop: { focalPoint: "55% 60%" }, mobile: { focalPoint: "50% 65%" } },
    blurDataURL:
      "data:image/webp;base64,UklGRpwAAABXRUJQVlA4IJAAAADQAwCdASoYAA0APtFUo0uoJKMhsAgBABoJYwCw7BxMqa2zx0xIGQAA/pDHFTZG8NPm/x0ZgMfoh2FWOaautulWMyuO0kWVaeN5OaUaql7CIkR5vHkyEutNwLGC+x6AEIX/uXvJPuVMA128qBaXzb7SVejGwV8uTd3mCaiH5u38PEz8gfWw2HRi1Z/XF5KAAAA=",
    alt: "A private strength and pilates studio at dawn: a walnut reformer, bronze dumbbells and a folded towel before sheer curtains.",
    decorative: true,
    intendedSections: ["Women's Training · How training felt, by estimated phase (or What this needs)"],
    status: "APPROVED",
    version: 1,
    source: DETAIL_SOURCE,
  },
  "women-wellness": {
    id: "women-wellness",
    name: "Reserve Detail · Women's Wellness",
    ...detailFiles("women-wellness"),
    crop: { desktop: { focalPoint: "55% 62%" }, mobile: { focalPoint: "50% 75%" } },
    blurDataURL:
      "data:image/webp;base64,UklGRp4AAABXRUJQVlA4IJIAAAAwBACdASoYAA0APtFapEwoJSOiMAgBABoJZAC7AYxE1fyWonvGVOjRzhgA/vK+iV1VXNegzqmsi9JEJIMM7NyI0KCVQxQmU8j84Pspf6sXDXZTOXJ/n0I/yPLv9f9ODFN2rOIhRQr8CzjbmBUq6hr54ewsRl1DB9lpO1ijpBygezzSGHEGxFSG2YTHRqgUEOAAAA==",
    alt: "A stone soaking tub behind lit fluted glass, an ivory robe folded on a walnut bench beside a white orchid.",
    decorative: true,
    intendedSections: ["Women's Recovery · Sleep, by estimated phase (or What this needs)"],
    status: "APPROVED",
    version: 1,
    source: DETAIL_SOURCE,
  },
  "community-lounge": {
    id: "community-lounge",
    name: "Reserve Detail · Community Lounge",
    ...detailFiles("community-lounge"),
    /* Framed high on both cuts so the chairs and the skyline carry the band
       and the tumbler on the table stays at the lower edge. */
    crop: { desktop: { focalPoint: "50% 42%" }, mobile: { focalPoint: "60% 40%" } },
    blurDataURL:
      "data:image/webp;base64,UklGRo4AAABXRUJQVlA4IIIAAABwBACdASoYAA4APulgqE2pJaQiMAgBIB0JQBdmUABqpj6fJ7vzQ+1t3YbekAD+8rFQ2ARfOUrjwUnlB/4LLc1RRAU2uw1h2/9S8qcExUlU5ezzkwGipnxRGS/KPkztpvUNCdDIR5Bluv3UMwCWwyuqTo0naCyl2A66n1priEbJCYAA",
    alt: "Two worn leather armchairs facing a night skyline through the glass of a private club lounge.",
    decorative: true,
    intendedSections: ["Community · Planned channels"],
    status: "APPROVED",
    version: 1,
    source: DETAIL_SOURCE_0917,
  },
  "measurements-suite": {
    id: "measurements-suite",
    name: "Reserve Detail · Measurements Suite",
    ...detailFiles("measurements-suite"),
    /* The tape measure sits right of centre on the counter; the phone crop
       moves further right so it and the folded towels stay in frame. */
    crop: { desktop: { focalPoint: "55% 50%" }, mobile: { focalPoint: "62% 50%" } },
    blurDataURL:
      "data:image/webp;base64,UklGRogAAABXRUJQVlA4IHwAAADwAwCdASoYAA4APulgqU2pJaQiMAgBIB0JagCsOUAAybNF+HUMo1vgAP7QS8lRCaNwRoY2pMVrNkwUmEvC9q9UyBxTQ4Pon0sKf/zKb/5Ef+YZkXr8SMHPRhhVmATNSIjunVuFMQT0vOxMvhFXBOML2T49OcUIRHPyNKwA",
    alt: "A coiled steel tape measure and folded towels on a black marble counter under a backlit mirror.",
    decorative: true,
    intendedSections: ["Measurements · Latest by site"],
    status: "APPROVED",
    version: 1,
    source: DETAIL_SOURCE_0917,
  },
  "vault-door": {
    id: "vault-door",
    name: "Reserve Detail · Vault Door",
    ...detailFiles("vault-door"),
    crop: { desktop: { focalPoint: "50% 50%" }, mobile: { focalPoint: "55% 50%" } },
    blurDataURL:
      "data:image/webp;base64,UklGRoAAAABXRUJQVlA4IHQAAADwAwCdASoYAA4APulgqE0pJaQiMAgBIB0JaQAAV64w1YnHfc21WEgAAP7xgZ3rpC2GLmy3r6ck1zcmhATg2zXts/GnwQllWgZMqPzZNxvirRtvh/2rbpru91SL0oXVrGfitjnaXqNDjhBvoP1NQ2f5OAAAAA==",
    alt: "The machined face of a brushed steel vault door set into black marble, lit by a single bronze line.",
    decorative: true,
    intendedSections: ["Settings · Your account"],
    status: "APPROVED",
    version: 1,
    source: DETAIL_SOURCE_0917,
  },
  "decision-table": {
    id: "decision-table",
    name: "Reserve Detail · Decision Table",
    ...detailFiles("decision-table"),
    crop: { desktop: { focalPoint: "50% 45%" }, mobile: { focalPoint: "50% 45%" } },
    blurDataURL:
      "data:image/webp;base64,UklGRnQAAABXRUJQVlA4IGgAAACwAwCdASoYAA4APulgqU2pJaQiMAgBIB0JQBOgBHptKTddE9kGwAD+8RTIUiHysK0Oo8QF2CyBfkvclbYVydIbHWRw3pd84uWUBIOLBVfe1Uwe6CT27X1MhNv7WQy8eUzwHF8jJWPAAA==",
    alt: "A long black glass conference table in an empty penthouse room at night, one pen left on it.",
    decorative: true,
    intendedSections: ["Decision Log · What Reserve Learned (or What Writes A Record Here)"],
    status: "APPROVED",
    version: 1,
    source: DETAIL_SOURCE_0917,
  },
};

/** The only sanctioned way to get a detail image for a production surface: null unless APPROVED. */
export function productionDetail(id: DetailImageId): DetailImage | null {
  const image: DetailImage | undefined = DETAIL_IMAGES[id];
  return image && image.status === "APPROVED" ? image : null;
}

/* ─── Release gate ────────────────────────────────────────────────────────

   NOTE FOR THE OWNER — "Reserve Entrance Master 01":
   That composition is NOT present in this repository, in `public/brand/`, or
   in the `Approved visuals/` set. Nothing to un-wire; it has never shipped.
   The entrance plate in production is "Reserve Master Environment 02 —
   Entrance Gallery Clean", which predates it and is approved. If Master 01 is
   introduced later it enters this registry as DRAFT and the gate below keeps
   it out of production until its status is changed deliberately. */

export function visualAsset(id: string): VisualAsset | null {
  return VISUAL_ASSETS[id] ?? null;
}

/**
 * The only sanctioned way to get a plate path for a production surface.
 * Returns null for DRAFT / REVIEW / RETIRED assets, so visual direction can
 * live in the registry without ever leaking into a member's screen.
 */
export type ProductionPlate = {
  src: string;
  focalPoint: string;
  overlay: VisualAsset["overlay"];
  /** The daypart actually served: "day" whenever no approved variant exists. */
  daypart: Daypart;
};

export function productionPlate(
  id: string,
  viewport: "desktop" | "mobile",
  daypart: Daypart = "day",
): ProductionPlate | null {
  const asset = VISUAL_ASSETS[id];
  if (!asset || asset.status !== "APPROVED") return null;

  /* A variant rides on its approved base plate and ships only when approved itself. */
  const variant = daypart === "day" ? undefined : asset.dayparts?.[daypart];
  if (variant && variant.status === "APPROVED") {
    return {
      src: viewport === "mobile" ? (variant.mobileSrc ?? variant.desktopSrc) : variant.desktopSrc,
      focalPoint: viewport === "mobile" ? variant.focalPoint.mobile : variant.focalPoint.desktop,
      overlay: asset.overlay,
      daypart,
    };
  }

  /* A phone gets the plate's own 9:16. A plate without one (none today) falls
     back to the desktop plate at the MOBILE focal point: the crop is wrong but
     the subject is at least anchored where the mobile composition expects it. */
  const src = viewport === "mobile" ? (asset.mobileSrc ?? asset.desktopSrc) : asset.desktopSrc;

  return {
    src,
    focalPoint: viewport === "mobile" ? asset.focalPoint.mobile : asset.focalPoint.desktop,
    overlay: asset.overlay,
    daypart: "day",
  };
}

/** Whether an approved plate has any approved daypart variant, i.e. its plate depends on the clock. */
export function hasDaypartPlates(id: string): boolean {
  const asset = VISUAL_ASSETS[id];
  if (!asset || asset.status !== "APPROVED" || !asset.dayparts) return false;
  return Object.values(asset.dayparts).some((variant) => variant?.status === "APPROVED");
}

export type ProductionLoop = {
  src: string;
  loopSeconds: number;
  /**
   * The room's own rate, when it declares one. Undefined means the shared
   * slowed rate; `loopPlaybackRate` (lib/cinematic/loop-crossfade) resolves
   * it, so the manifest stays a record of assets and nothing else.
   */
  playbackRate?: number;
};

/**
 * The only sanctioned way to get a loop path for a production surface.
 *
 * Returns null unless the plate AND the loop are APPROVED and a loop exists
 * for THIS viewport. It answers "may this loop ship?", never "should it play
 * now?" — a playback decision still has to agree before anything mounts.
 */
export function productionLoop(
  id: string,
  viewport: "desktop" | "mobile",
  daypart: Daypart = "day",
): ProductionLoop | null {
  /* The plate is the loop's poster and its first frame. A loop can never
     reach a member ahead of the still it was cut from. Resolving the plate
     FIRST also settles which daypart is actually served: a variant that is
     not approved falls back to day, and the loop has to follow it. */
  const plate = productionPlate(id, viewport, daypart);
  if (!plate) return null;

  /* The clip of the plate on screen, never another hour's. Owner direction
     2026-09-24: a room follows the clock and moves at whatever hour it has a
     clip for. An hour with no clip of its own is a still of the RIGHT room —
     never the day loop laid over a night plate. */
  const asset = VISUAL_ASSETS[id];
  const loop = plate.daypart === "day" ? asset.loop : asset.dayparts?.[plate.daypart]?.loop;
  if (!loop || loop.status !== "APPROVED") return null;

  /* Deliberately NO fallback, unlike the plate. A 16:9 loop cover-cropped
     onto a phone downloads pixels nobody sees and breaks the 9:16
     composition. The phone keeps its still until its own loop is approved —
     the room is NOT refused: `productionPlate` still serves the phone its
     9:16 plate, and a wide viewport still gets the 16:9 clip. */
  const src = viewport === "mobile" ? loop.mobileSrc : loop.desktopSrc;
  if (!src) return null;

  return { src, loopSeconds: loop.loopSeconds, playbackRate: loop.playbackRate };
}

/**
 * How long one cycle takes ON SCREEN. Loops play slowed (the crossfade
 * player's rate, 0.6× by default), so a 5s clip is ~8.3s of motion. The
 * ambient window (6–20s) is a promise about what the member sees, so this —
 * not the delivered length — is what the window is checked against. The
 * default rate is a parameter so this file never imports the player.
 */
export function effectiveLoopSeconds(loop: Pick<VisualLoop, "loopSeconds" | "playbackRate">, defaultRate: number): number {
  const rate = typeof loop.playbackRate === "number" && loop.playbackRate > 0 ? loop.playbackRate : defaultRate;
  return loop.loopSeconds / rate;
}

/**
 * Which plate a room renders: the preferred (newer) plate once it carries an
 * approved loop of its own, otherwise the fallback plate. A room that has
 * motion today never goes still because a newer still was approved; it moves
 * over the moment that still's own clip is approved.
 *
 * The cast is asked PER DAYPART, so a room is cast to whichever of its two
 * plates actually moves at this hour. The newer plates carry the night clips
 * and the older ones carry the day clips, so a room that would otherwise
 * freeze after dark keeps its motion by being cast to the plate that has it.
 * Both plates are the same room in the product; only the light changes.
 */
export function castRoomPlate(preferred: string, fallback: string, daypart: Daypart = "day"): string {
  /* Scored so the member's hour outranks motion:
       +2  this plate has a composition for THIS hour of its own
       +1  this plate moves at this hour
     The hour is worth more because a moving daytime room at midnight is a
     worse lie than a still one that is honestly dark. Motion breaks the tie,
     so a room that can be both is. An outright tie goes to the PREFERRED
     plate: the newer empty-room set is the direction (owner, 2026-09-17), and
     approving a clip is what promotes a room — a tie that fell back would
     leave the newer plate parked forever behind an equal older one.

     Scoring the hour at all is what makes a daypart plate reachable. Ranking
     on motion alone left `training-floor`'s night and `penthouse-study`'s
     dawn — both approved, both on disk — permanently unrenderable, because a
     plate with no clip could never win however right its light was. */
  const score = (id: string) =>
    (productionPlate(id, "desktop", daypart)?.daypart === daypart ? 2 : 0) +
    (productionLoop(id, "desktop", daypart) ? 1 : 0);
  return score(preferred) >= score(fallback) ? preferred : fallback;
}

/** Assets approved for desktop but still missing their 9:16 companion. */
export function mobileCropShotList(): VisualAsset[] {
  return Object.values(VISUAL_ASSETS).filter(
    (a) => a.status === "APPROVED" && a.mobileSrc === null,
  );
}
