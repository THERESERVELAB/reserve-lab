/* ════════════════════════════════════════════════════════════════════════
   RESERVE BRAND VISUAL MANIFEST — approved production asset registry.
   ------------------------------------------------------------------------
   Every path here is an optimized WebP generated from the approved visual
   set (raw sources live outside git in "Approved visuals/"). Environment
   plates are decorative backdrops only — they always render behind a scrim
   so glass panels and type keep contrast. Movement posters are registered
   separately in lib/training/movement-visuals.ts.
   ════════════════════════════════════════════════════════════════════════ */

/** Command-room environment plates. Every room has a 16:9 desktop plate (2400w)
    and its own 9:16 phone plate (1080×1920) — the same room extended with Adobe
    generative expand, so a phone sees the whole room rather than a slice of the 16:9. */
export const ENVIRONMENT_PLATES = {
  apexCommand: "/brand/backgrounds/apex-command.webp",
  apexCommand9x16: "/brand/backgrounds/apex-command-9x16.webp",
  trainingCommand: "/brand/backgrounds/training-command.webp",
  trainingCommand9x16: "/brand/backgrounds/training-command-9x16.webp",
  recoveryChamber: "/brand/backgrounds/recovery-chamber.webp",
  recoveryChamber9x16: "/brand/backgrounds/recovery-chamber-9x16.webp",
  nutritionCommand: "/brand/backgrounds/nutrition-command.webp",
  nutritionCommand9x16: "/brand/backgrounds/nutrition-command-9x16.webp",
  scheduleCommand: "/brand/backgrounds/schedule-command.webp",
  scheduleCommand9x16: "/brand/backgrounds/schedule-command-9x16.webp",
  biomarkersLab: "/brand/backgrounds/biomarkers-lab.webp",
  biomarkersLab9x16: "/brand/backgrounds/biomarkers-lab-9x16.webp",
  intelligenceCommand: "/brand/backgrounds/intelligence-command.webp",
  intelligenceCommand9x16: "/brand/backgrounds/intelligence-command-9x16.webp",
  physiqueScanner: "/brand/backgrounds/physique-scanner.webp",
  physiqueScanner9x16: "/brand/backgrounds/physique-scanner-9x16.webp",
  entranceGallery: "/brand/backgrounds/entrance-gallery.webp",
  entranceGallery9x16: "/brand/backgrounds/entrance-gallery-9x16.webp",
  /** Apex room at night — the same composition as apexCommand, lit for the close of the day. */
  apexCommandNight: "/brand/backgrounds/apex-command-night.webp",
  /** Its own 9:16 phone composition (not a crop of the 16:9). */
  apexCommandNight9x16: "/brand/backgrounds/apex-command-night-9x16.webp",
  /** Recovery chamber at night — the same room as recoveryChamber, at its lowest light. */
  recoveryChamberNight: "/brand/backgrounds/recovery-chamber-night.webp",
  /** Its own 9:16 phone composition (not a crop of the 16:9). */
  recoveryChamberNight9x16: "/brand/backgrounds/recovery-chamber-night-9x16.webp",
  /** Training room at night — the same composition as trainingCommand, lit down for the late session. */
  trainingCommandNight: "/brand/backgrounds/training-command-night.webp",
  /** Its own 9:16 phone composition (not a crop of the 16:9). */
  trainingCommandNight9x16: "/brand/backgrounds/training-command-night-9x16.webp",
  /** Nutrition room at night — an owner-approved grade of nutritionCommand. */
  nutritionCommandNight: "/brand/backgrounds/nutrition-command-night.webp",
  /** Its 9:16 — nutritionCommand9x16 graded to match the 16:9 night plate. */
  nutritionCommandNight9x16: "/brand/backgrounds/nutrition-command-night-9x16.webp",
  /** Schedule room at night — an owner-approved grade of scheduleCommand. */
  scheduleCommandNight: "/brand/backgrounds/schedule-command-night.webp",
  /** Its 9:16 — scheduleCommand9x16 graded to match the 16:9 night plate. */
  scheduleCommandNight9x16: "/brand/backgrounds/schedule-command-night-9x16.webp",

  /* ── The empty-room set (Firefly, owner-generated 2026-09-17) ──────────
     Deliberately empty establishing shots: the room with nobody in it and
     nothing staged in the foreground, so the interface is the only subject.
     Each is a 16:9 master with its own 9:16 cut from the same master — the
     frame's most interesting third, never a squash. These are the plates the
     member rooms render from 2026-09-17; the earlier room plates above stay
     registered and on disk, so re-casting a room is one line in
     `AnimatedBackground`'s ROOM_ENV. */
  commandRoom: "/brand/backgrounds/command-room.webp",
  commandRoom9x16: "/brand/backgrounds/command-room-9x16.webp",
  trainingFloor: "/brand/backgrounds/training-floor.webp",
  trainingFloor9x16: "/brand/backgrounds/training-floor-9x16.webp",
  chefKitchen: "/brand/backgrounds/chef-kitchen.webp",
  chefKitchen9x16: "/brand/backgrounds/chef-kitchen-9x16.webp",
  recoverySuite: "/brand/backgrounds/recovery-suite.webp",
  recoverySuite9x16: "/brand/backgrounds/recovery-suite-9x16.webp",
  penthouseStudy: "/brand/backgrounds/penthouse-study.webp",
  penthouseStudy9x16: "/brand/backgrounds/penthouse-study-9x16.webp",

  /* ── Their night and dawn light (Firefly, owner-generated 2026-09-17) ──
     Owner direction 2026-09-17: the rooms' other dayparts are the sky, not
     the same room re-lit. Each is a still; motion belongs to the day plate. */
  commandRoomNight: "/brand/backgrounds/command-room-night.webp",
  commandRoomNight9x16: "/brand/backgrounds/command-room-night-9x16.webp",
  trainingFloorNight: "/brand/backgrounds/training-floor-night.webp",
  trainingFloorNight9x16: "/brand/backgrounds/training-floor-night-9x16.webp",
  chefKitchenNight: "/brand/backgrounds/chef-kitchen-night.webp",
  chefKitchenNight9x16: "/brand/backgrounds/chef-kitchen-night-9x16.webp",
  recoverySuiteNight: "/brand/backgrounds/recovery-suite-night.webp",
  recoverySuiteNight9x16: "/brand/backgrounds/recovery-suite-night-9x16.webp",
  penthouseStudyDawn: "/brand/backgrounds/penthouse-study-dawn.webp",
  penthouseStudyDawn9x16: "/brand/backgrounds/penthouse-study-dawn-9x16.webp",
  /* ── First light (Firefly Gemini 3.1, owner-generated 2026-09-24) ──────
     Dawn for the four flagship rooms, generated as one set against a single
     brief so they read as one hour rather than four pictures: deep shadow
     holding most of the frame, a band of mist or still water, and the first
     warm light only on the highest edges. No sun disc in any of them.

     They follow the house rule that a room's night and dawn are the sky it
     looks out on, not the room re-lit — the same rule that gives Apex Earth
     from orbit and Recovery its aurora. Masters are 2752×1536; each 9:16 is
     cut from its own master (the frame's most interesting third) rather than
     squashed, then resampled to 1080×1920. */
  commandRoomDawn: "/brand/backgrounds/command-room-dawn.webp",
  commandRoomDawn9x16: "/brand/backgrounds/command-room-dawn-9x16.webp",
  trainingFloorDawn: "/brand/backgrounds/training-floor-dawn.webp",
  trainingFloorDawn9x16: "/brand/backgrounds/training-floor-dawn-9x16.webp",
  chefKitchenDawn: "/brand/backgrounds/chef-kitchen-dawn.webp",
  chefKitchenDawn9x16: "/brand/backgrounds/chef-kitchen-dawn-9x16.webp",
  recoverySuiteDawn: "/brand/backgrounds/recovery-suite-dawn.webp",
  recoverySuiteDawn9x16: "/brand/backgrounds/recovery-suite-dawn-9x16.webp",
  /* Second dawn set, same brief and same day, for the five rooms that had no
     daypart of their own at all. The glacier is the one plate in the product
     over 160KB at 2400w (174KB after a light denoise): high-frequency ice is
     the same subject the library's `glacier-aerial` could not bring under
     budget either. It matches the largest plate already shipping
     (physique-scanner-9x16, 174KB) and reads clean, with no blocking.
     The sandstone's 16:9 is a crop taken from the right of its master rather
     than the whole frame: the generation put a sun disc in the top left,
     which is where the environment title sits. */
  compoundSuiteDawn: "/brand/backgrounds/compound-suite-dawn.webp",
  compoundSuiteDawn9x16: "/brand/backgrounds/compound-suite-dawn-9x16.webp",
  biomarkersLabDawn: "/brand/backgrounds/biomarkers-lab-dawn.webp",
  biomarkersLabDawn9x16: "/brand/backgrounds/biomarkers-lab-dawn-9x16.webp",
  physiqueScannerDawn: "/brand/backgrounds/physique-scanner-dawn.webp",
  physiqueScannerDawn9x16: "/brand/backgrounds/physique-scanner-dawn-9x16.webp",
  intelligenceCommandDawn: "/brand/backgrounds/intelligence-command-dawn.webp",
  intelligenceCommandDawn9x16: "/brand/backgrounds/intelligence-command-dawn-9x16.webp",
  entranceGalleryDawn: "/brand/backgrounds/entrance-gallery-dawn.webp",
  entranceGalleryDawn9x16: "/brand/backgrounds/entrance-gallery-dawn-9x16.webp",
  /* Night for the four rooms that had none, 2026-09-24. These cost nothing to
     make: they are cut from the owner-approved cosmic masters already on disk
     (5504x3072, the 2026-09-17 set), which were registered in `library.ts` as
     approved and never cast. Casting them here is what that register was for.
     Each 9:16 is a true centre cut from the master, not an upscale. */
  compoundSuiteNight: "/brand/backgrounds/compound-suite-night.webp",
  compoundSuiteNight9x16: "/brand/backgrounds/compound-suite-night-9x16.webp",
  physiqueScannerNight: "/brand/backgrounds/physique-scanner-night.webp",
  physiqueScannerNight9x16: "/brand/backgrounds/physique-scanner-night-9x16.webp",
  intelligenceCommandNight: "/brand/backgrounds/intelligence-command-night.webp",
  intelligenceCommandNight9x16: "/brand/backgrounds/intelligence-command-night-9x16.webp",
  entranceGalleryNight: "/brand/backgrounds/entrance-gallery-night.webp",
  entranceGalleryNight9x16: "/brand/backgrounds/entrance-gallery-night-9x16.webp",
  /** The clinical room at night — a restrained dark nebula, no clinical imagery. */
  biomarkersLabNight: "/brand/backgrounds/biomarkers-lab-night.webp",
  biomarkersLabNight9x16: "/brand/backgrounds/biomarkers-lab-night-9x16.webp",
  /** Compound Command's room — a private wellness suite at night. Cut from
      frame 0 of its own clip (Firefly, owner-generated), so it is 1920×1080
      rather than the 2400w of the plates above: no higher-resolution master
      of this composition was delivered. 16:9 only — no phone composition of
      this room exists yet, so a phone falls back to it at the mobile focal
      point. */
  compoundSuite: "/brand/backgrounds/compound-suite.webp",
} as const;

/** Reserve ad scenes 01–04 (1920w · 16:9) — stage/backstage cinematics for
    premium-gate and marketing surfaces. No athlete or federation names. */
export const AD_SCENES = [
  "/brand/scenes/ad-scene-01-backstage-reveal.webp",
  "/brand/scenes/ad-scene-02-spider-curl.webp",
  "/brand/scenes/ad-scene-03-stage-side-biceps.webp",
  "/brand/scenes/ad-scene-04-stage-walkout.webp",
] as const;

/** Deterministic scene pick so every scene ships somewhere stable.
    Tolerates a missing key — a stale persisted view id must never be able
    to crash the shell. */
export function sceneForKey(key: string | undefined | null): string {
  const safe = key ?? "reserve";
  let hash = 0;
  for (let i = 0; i < safe.length; i += 1) hash = (hash * 31 + safe.charCodeAt(i)) | 0;
  return AD_SCENES[Math.abs(hash) % AD_SCENES.length];
}
