/* ════════════════════════════════════════════════════════════════════════
   RESERVE VISUAL LIBRARY — approved imagery that is not cast yet.

   The asset manifest holds what a screen renders. This holds what the owner
   has approved and not yet placed: the earth, sky and cosmic set generated
   2026-09-17. Registering it here means a later pass can place a picture
   without going back to the raw 5504×3072 masters — the id, the WebP
   variants, the blur placeholder and the honest description already exist.

   WHY ITS OWN MODULE. No client code imports it (the Apex rotation keeps its
   own path list), so its blur placeholders never reach a client bundle. The moment one of these is cast it moves into
   `asset-manifest.ts` as a plate (with its own 9:16 cut) or a detail image
   (with its own 4:5 crop) — a library entry is never rendered from here.

   FILES. Two per image under public/brand/library:
     <id>.webp       2400×1350 16:9 master
     <id>-1200.webp  1200×675
   There is deliberately no 9:16 and no 4:5: a phone composition is a crop
   decision, made when the picture is cast, not in bulk. `penthouse-vista` is
   the one exception on the master: no high-resolution source of it was
   delivered, so its plate is cut from its own clip's frame 0 at 1920×1080.

   LOOPS. Six of these carry an ambient clip (public/brand/loops), 1920×1080
   and silent, 16:9 only. Slowed to the player's 0.6× a 5.04s clip runs ~8.4s
   on screen and an 8s clip ~13.3s, both inside the 6–20s ambient window
   (`effectiveLoopSeconds`). None has a room plate, so `productionLoop` never
   serves one. The ice cave is the owner's approved benchmark ("glacier clip is
   perfect", 2026-09-17); the salt flat and cloud inversion were approved
   2026-09-19 for the Apex rotation (`apex-rotation.ts`), which plays each once
   through over its own still. The river delta's clip is RETIRED — see its
   entry. The two rooms at the end of this file are not in that rotation.

   ROOMS. This file began as landscape only. From 2026-09-24 it also holds
   interiors: rooms that could BE a screen's environment rather than a picture
   inside one, approved and waiting on the owner to say which screen.

   NOT HERE. Six of the 2026-09-17 set were cast the same day and live in the
   asset manifest as plates: Earth from orbit, the supercell, ocean before
   dawn, the aurora lake, the first-light ridge and the dark nebula. An
   eclipse was asked for and is not in the delivered set at all.
   ════════════════════════════════════════════════════════════════════════ */

import type { AssetStatus, VisualLoop } from "./asset-manifest";

export type LibraryImage = {
  id: string;
  name: string;
  /** 2400×1350 16:9 master. */
  src: string;
  /** 1200×675. */
  src1200: string;
  /** A tiny WebP data URL, ready for whichever renderer takes this next. */
  blurDataURL: string;
  /** Honest description of the frame. Every placed use needs one. */
  alt: string;
  set: "earth-sky" | "cosmic" | "nature" | "room";
  /** Ambient clip cut from this frame, where one exists. */
  loop?: VisualLoop;
  status: AssetStatus;
  source: string;
};

const LIBRARY_SOURCE = "Adobe Firefly (Gemini 3.1), owner-generated 2026-09-17";

function libraryFiles(id: string): Pick<LibraryImage, "src" | "src1200"> {
  return { src: `/brand/library/${id}.webp`, src1200: `/brand/library/${id}-1200.webp` };
}

/** A 16:9 ambient clip with no phone cut. Never servable as it stands. */
function clip(id: string, status: AssetStatus, loopSeconds = 5): VisualLoop {
  return {
    desktopSrc: `/brand/loops/${id}-16x9.mp4`,
    /* No 9:16 was generated on 2026-09-17. `productionLoop` refuses to put a
       16:9 clip on a phone, so a phone would keep the still. */
    mobileSrc: null,
    status,
    loopSeconds,
  };
}

export const LIBRARY_IMAGES: Record<string, LibraryImage> = {
  "milky-way-dunes": {
    id: "milky-way-dunes",
    name: "Reserve Library · Milky Way Dunes",
    ...libraryFiles("milky-way-dunes"),
    blurDataURL:
      "data:image/webp;base64,UklGRnQAAABXRUJQVlA4IGgAAADwAwCdASoYAA4APuliqE2pJaOiMAgBIB0JZQDCgB5t8u8v6AVfyR8gAP7s3yj4EV4voZYFzv9wErOxIaM5mwPvJ/z9xDcuWnGJL16QCMnT6zS6Ymc1HRmQ8LcdtFQ4UumEXDn9mXRQAA==",
    alt: "The Milky Way arching over black desert dunes under a clear night sky.",
    set: "earth-sky",
    status: "APPROVED",
    source: LIBRARY_SOURCE,
  },
  "salt-flat-mirror": {
    id: "salt-flat-mirror",
    name: "Reserve Library · Salt Flat Mirror",
    ...libraryFiles("salt-flat-mirror"),
    blurDataURL:
      "data:image/webp;base64,UklGRmAAAABXRUJQVlA4IFQAAAAwBACdASoYAA4APulgqE0pJaQiMAgBIB0JZQDCgCFcCoypq2OzEc1eLIAA/ulYZNgVne0ddjQpS4PJWug2ZzY/tWQ6pTd/TldkUlBoMv67eh6cAAA=",
    alt: "A vast salt flat under a thin film of still water, the night sky mirrored in it.",
    set: "nature",
    loop: clip("salt-flat-mirror", "APPROVED"),
    status: "APPROVED",
    source: LIBRARY_SOURCE,
  },
  "bioluminescent-shore": {
    id: "bioluminescent-shore",
    name: "Reserve Library · Bioluminescent Shore",
    ...libraryFiles("bioluminescent-shore"),
    blurDataURL:
      "data:image/webp;base64,UklGRogAAABXRUJQVlA4IHwAAAAQBACdASoYAA4APulgqE0pJaQiMAgBIB0JYgCw7CHgYUafff/iTYWKAAD+6+td0eUHElSXzHnPao3dJ28t1KquEsyXPzZ4v5AGc/selgIPlJ/3slLPgvFo8TfQrMbgQRPiLLDhF2nl4gPVuTVGjRgQGoCglxdKuwBBbUAA",
    alt: "Bioluminescent plankton lighting the breaking surf along a dark shoreline at night.",
    set: "nature",
    status: "APPROVED",
    source: LIBRARY_SOURCE,
  },
  "lava-veins": {
    id: "lava-veins",
    name: "Reserve Library · Lava Veins",
    ...libraryFiles("lava-veins"),
    blurDataURL:
      "data:image/webp;base64,UklGRpAAAABXRUJQVlA4IIQAAACQBACdASoYAA4APulgqE0pJaQiMAgBIB0JQBOmUDX/wHkZDk00lsMckorcU0AA/vDRlVkUq/IFJdSTMuzbgxdybmXA4dKRroZKPnsiHlqOT+BeJQk4K+SBCfKwwcolkxZJVLmxjr5aw4LSez54XDKb2WlUUgrDR1YbFYN63hlTeICWaAA=",
    alt: "An aerial view at night of molten lava veins glowing bronze and gold through black rock.",
    set: "nature",
    status: "APPROVED",
    source: LIBRARY_SOURCE,
  },
  "river-delta": {
    id: "river-delta",
    name: "Reserve Library · River Delta",
    ...libraryFiles("river-delta"),
    blurDataURL:
      "data:image/webp;base64,UklGRoAAAABXRUJQVlA4IHQAAAAQBACdASoYAA4APulgqE0pJaQiMAgBIB0JYwC7ACFspPMMkGNAL9/ddAD+zgFl1Ow3q6MP83ikzFYS/qSpKQLxcQwISNV9CDuS82UEvXC4y6rfWzWhvvyTh+kGqcTWIej2h61FCVIC24vkRck3KzUlMSQAAA==",
    alt: "An aerial looking straight down at a river delta at dusk, hundreds of branching channels.",
    set: "nature",
    /* RETIRED 2026-09-24. The delivered file is a truncated export: 6.8MB of
       h.264 carrying 0.21 SECONDS of video, not the 5s it was registered as.
       It was APPROVED and live as the seventh item of the Apex rotation, where
       it downloaded 6.8MB to stutter roughly a third of a second on repeat.
       Measured with the repo's own mvhd parser, and the copy still in the
       owner's downloads is byte-identical, so there is no good source to
       re-import — the picture stands, the motion has to be regenerated.
       Removed from `apex-rotation.ts` the same day. */
    loop: clip("river-delta", "RETIRED"),
    status: "APPROVED",
    source: LIBRARY_SOURCE,
  },
  "glacier-aerial": {
    id: "glacier-aerial",
    name: "Reserve Library · Glacier From Above",
    ...libraryFiles("glacier-aerial"),
    blurDataURL:
      "data:image/webp;base64,UklGRngAAABXRUJQVlA4IGwAAABwAwCdASoYAA4APulep00pJSOiMAgBIB0JQBOgBH5r9+JleegA/uzZS7xcMk6gx3e+0EZlOvXTfWpEy2I49LaKcvVa6dnj68oiywB379GeAJjuEVJbj9C2RIAdy6B1h+lfp162mBiRYHOAAAA=",
    /* The one file in this set over the 160KB budget: a frame of pure
       high-frequency ice that WebP cannot bring under it at 2400w without
       visible blocking (247KB at the lowest quality that still reads).
       Nothing serves it today; it must be re-cut before it is cast. */
    alt: "An aerial looking straight down at a glacier at dusk, deep blue ice split by crevasses.",
    set: "nature",
    status: "APPROVED",
    source: LIBRARY_SOURCE,
  },
  "cloud-inversion": {
    id: "cloud-inversion",
    name: "Reserve Library · Cloud Inversion",
    ...libraryFiles("cloud-inversion"),
    blurDataURL:
      "data:image/webp;base64,UklGRpgAAABXRUJQVlA4IIwAAABQBACdASoYAA4APuluq08pJyQiMAgBIB0JYgC7Ef/gPHhb1t1nBnQF7PSAAP5Afz+N0FxU/QXj4jKSjVZWU2dwKD7o/JV8SEEEIND/wSLBLR7VquLQHtgPfH1YCa/ttpOPQIHtmr5qsGGG/UaCf1iweDipbO/3GPEfUCXo/pQXxO2MQ/mTpMPVSOAAAA==",
    alt: "A dawn landscape from a high ridge above a cloud inversion, a sea of cloud filling the valley.",
    set: "earth-sky",
    loop: clip("cloud-inversion", "APPROVED"),
    status: "APPROVED",
    source: LIBRARY_SOURCE,
  },
  "ice-cave": {
    id: "ice-cave",
    name: "Reserve Library · Ice Cave",
    ...libraryFiles("ice-cave"),
    blurDataURL:
      "data:image/webp;base64,UklGRoAAAABXRUJQVlA4IHQAAADwAwCdASoYAA4APulgqE0pJaQiMAgBIB0JaACdABu02ht37O2jgJ3AAP7xEz4ood0q0hbdC1A/M75nb7sTSaI+brHWI2dCmZMrKpfS5kn2x6kzTNkRvZP9CAZBavX2mtgSAWv/47X7eVOVXi99X3Q3BbAAAA==",
    alt: "Inside a glacier ice cave, sculpted deep blue walls curving around a single shaft of daylight.",
    set: "nature",
    /* Owner-approved 2026-09-17: "glacier clip is perfect". Approved as a
       clip, not yet placed: it is 5.04s and 16:9 only, so it needs a 9:16 cut
       and a plate to belong to before anything can serve it. */
    loop: clip("ice-cave", "APPROVED"),
    status: "APPROVED",
    source: LIBRARY_SOURCE,
  },
  "black-hole-disc": {
    id: "black-hole-disc",
    name: "Reserve Library · Accretion Disc",
    ...libraryFiles("black-hole-disc"),
    blurDataURL:
      "data:image/webp;base64,UklGRpQAAABXRUJQVlA4IIgAAAAQBACdASoYAA4APulgqE2pJaOiMAgBIB0JYwCw7CFsGIY46ADIwu0AAAD+8qO2efRvo974UUpTrdfH45WhN6qVmk/vGROXFvmezmN/PGu/9XneI/tZwOOYt3gCi4AAIx5qAnZucZmjBHM9iBrJRAlrDJREG26S2G/CtwksCO0L9CCjLNxVZMAA",
    alt: "A black hole accretion disc seen near edge-on, a thin bright ring against deep space.",
    set: "cosmic",
    status: "APPROVED",
    source: LIBRARY_SOURCE,
  },
  "ringed-gas-giant": {
    id: "ringed-gas-giant",
    name: "Reserve Library · Ringed Gas Giant",
    ...libraryFiles("ringed-gas-giant"),
    blurDataURL:
      "data:image/webp;base64,UklGRnQAAABXRUJQVlA4IGgAAADQAwCdASoYAA4APulgqE0pJaQiMAgBIB0JYwAAXK+j7vWWP/P4HYAA/vQqbnS4ePeQa2eMsCRRzouEIW1eWhIBiKwINLb2dcZEi3XTh8z/R31vcSfVXTbMRuVei5U/kLXfPJdo41gAAA==",
    alt: "A gas giant with razor-thin rings seen from its night side, lit along one edge.",
    set: "cosmic",
    status: "APPROVED",
    source: LIBRARY_SOURCE,
  },
  "deep-field": {
    id: "deep-field",
    name: "Reserve Library · Deep Field",
    ...libraryFiles("deep-field"),
    blurDataURL:
      "data:image/webp;base64,UklGRnQAAABXRUJQVlA4IGgAAADQAwCdASoYAA4APulep00pJSOiMAgBIB0JYwAAW8nEqBKaY/nqxAAA/vKj2tHwMZHY3diTBcZb9v55oy9Zpprjyx9mVN1QyXvZaW3tKfjpnZ9jL5tE25gImShgJzziNhKByS/4eFAAAA==",
    alt: "A vast spiral galaxy seen at an angle, filling the frame against deep space.",
    set: "cosmic",
    /* Owner rejected this one on sight 2026-09-17 — it reads as fake. Kept on
       disk with the set, withdrawn from use. */
    status: "RETIRED",
    source: LIBRARY_SOURCE,
  },
  "gas-giant-hull": {
    id: "gas-giant-hull",
    name: "Reserve Library · Gas Giant From The Hull",
    ...libraryFiles("gas-giant-hull"),
    blurDataURL:
      "data:image/webp;base64,UklGRmYAAABXRUJQVlA4IFoAAADQAwCdASoYAA4APulgqE0pJaOiMAgBIB0JZQAASordRIXJMsCA8JAA/tKvy6eLkkE8QDZHS+AveVTjLzLIW64XEgu7H50BrCQgCav5forDpB20/xLaKMAAAAA=",
    alt: "The churning atmosphere of a gas giant filling the sky above a spacecraft hull, one figure standing on it.",
    set: "cosmic",
    status: "APPROVED",
    source: LIBRARY_SOURCE,
  },
  "moon-plain-ringed-planet": {
    id: "moon-plain-ringed-planet",
    name: "Reserve Library · Ringed Planet Over A Moon Plain",
    ...libraryFiles("moon-plain-ringed-planet"),
    blurDataURL:
      "data:image/webp;base64,UklGRo4AAABXRUJQVlA4IIIAAABQBACdASoYAA4APulgqE0pJaOiMAgBIB0JZwDKAYww36tohgD4FfpDCIesAP7ypQsf4cIvI2mZngW/zl+5u42fIYwEgeLbwwk8EUWYn7nneUjX8Q46x3qVMcSbNb+JfEFpv0QK+h4Kt9I4pfDoR4eGmMPvtAkzva8i1k0q0AvK2KAA",
    alt: "A ringed planet low over the dark basalt plain of an airless moon.",
    set: "cosmic",
    status: "APPROVED",
    source: LIBRARY_SOURCE,
  },
  "ship-viewport": {
    id: "ship-viewport",
    name: "Reserve Library · Ship Viewport",
    ...libraryFiles("ship-viewport"),
    blurDataURL:
      "data:image/webp;base64,UklGRm4AAABXRUJQVlA4IGIAAADwAwCdASoYAA4APuleqE0pJSQiMAgBIB0JaQAAW+m2sqr+Xs8FEB8gAP7ypnwMNsT861bKUj3QLYCXDjwhjQ+SJdfgjus29O59/HEKIyudrHGY9y4XTAHRtj5eo0WwmLkAAA==",
    alt: "Looking out from inside a dark spacecraft through a viewport onto deep space.",
    set: "cosmic",
    status: "APPROVED",
    source: LIBRARY_SOURCE,
  },

  /* ── Rooms, approved and not cast (2026-09-24) ──────────────────────────
     Two interiors found in the 2026-09-18 delivery that match no plate in the
     product (measured against all 64: best 25.0 and 45.9, where a true match
     scores under ~10 with a wide gap to second). They are rooms, not
     landscape, so unlike the set above each one is a candidate to BE a
     screen's environment rather than a picture hung inside one. Neither is
     cast: which screen a room belongs to is the owner's call, and guessing it
     is how a room ends up somewhere it does not mean anything.

     Both carry their clip, and both plates are cut from a real source rather
     than upscaled. */
  "plunge-suite": {
    id: "plunge-suite",
    name: "Reserve Library · Plunge Suite",
    ...libraryFiles("plunge-suite"),
    blurDataURL:
      "data:image/webp;base64,UklGRpoAAABXRUJQVlA4II4AAABwBACdASoYAA4APulmq00pJiQiMAgBIB0JZQC26DbkAB33zV0r+lR+v7Jw4AD++ng+uZ6TSjOVU2677G5lc9Iajhbh1uQLErc0/RY9J3ppMwpdqlaiX6AxM2Za8YYcsI9DkUvfbo2QS6AChQ1vMlcgRoD/0TBsQqK/wcB/xxjX3sAYvhg1yK89+iy8AAAA",
    alt: "A private recovery suite at night: a dark plunge bath, folded towels with a sleep mask on them, and a foam roller on a walnut bench.",
    set: "room",
    /* Cut from the 5504×3072 master delivered with it, so this plate is a
       true 2400×1350 like every other room. Frame 0 of the clip measures
       8.4/255 against it — the generation's own drift from its source still,
       in line with the chef kitchen's shipped 8.0. */
    loop: clip("plunge-suite", "APPROVED"),
    status: "APPROVED",
    source: "Adobe Firefly (Gemini 3.1), owner-generated 2026-09-18",
  },
  "penthouse-vista": {
    id: "penthouse-vista",
    name: "Reserve Library · Penthouse Vista",
    ...libraryFiles("penthouse-vista"),
    blurDataURL:
      "data:image/webp;base64,UklGRrwAAABXRUJQVlA4ILAAAABwBACdASoYAA4APulep00pJSOiMAgBIB0JZACdAYxO5UkPTB8vpN4/o1yg+AD+6gDFIiamWauYxyALfh96osY/C9Q1aZaUS5kpIjdcWujP0xeXk9X2x72V80G2drvOLOI4cal8cC67VzxStHto8sn1/uvSPmfGz1O1BGFtjbpgwya/dm3vWZH/hhl+CPsuE0yro/9Dc26Xs2lTZWXhPEIkXCxabXjMFMekL6Sj4AAAAA==",
    alt: "A penthouse interior at blue hour: a long black-and-gold marble counter running to a wall of windows over a lit city, with mist drifting through a shaft of light.",
    set: "room",
    /* No master was delivered for this one, so its plate is cut from frame 0
       of the clip and is 1920×1080, not 2400×1350 (frame 0 vs plate: 0.3/255).
       The clip is mist-heavy and the most expensive in the set to encode: it
       arrived at 27.6MB and needed CRF 27 to reach 5.7MB, inside the 6MB
       budget but the softest grain of any loop here. Re-cut both from a
       higher-resolution master before casting this room anywhere. */
    loop: clip("penthouse-vista", "APPROVED", 8),
    status: "APPROVED",
    source: "Adobe Firefly (Gemini 3.1), owner-generated 2026-09-18",
  },
};

/** Library images carrying an ambient clip, with that clip's own status. */
export function libraryClips(): { id: string; loop: VisualLoop }[] {
  return Object.values(LIBRARY_IMAGES)
    .filter((image): image is LibraryImage & { loop: VisualLoop } => Boolean(image.loop))
    .map((image) => ({ id: image.id, loop: image.loop }));
}

/* ─── Clips without a still ──────────────────────────────────────────────
   Motion the owner generated that has no plate of its own in the repo, so it
   cannot be cast: a loop's frame 0 must be the still on screen, and there is
   no still here for it to open on.

   EMPTY as of 2026-09-24, and that is the point of the record.

   It held the two Veo 3.1 takes of a wellness suite at night, made for
   Compound Command's room before the empty-room plates existed. They could
   never have shipped: delivered at 1280×720 and 720×1280, below the 1920×1080
   every room loop is held to, with no plate to open on.

   A newer take of that room arrived 2026-09-18 at a true 1920×1080 — a
   different composition, not a re-render (frame 0 measured 50.5/255 against
   the old one). Its plate was cut from its own frame 0, which is the route
   this block always described, and the room moved into the asset manifest as
   `compound-suite`. The 720p pair was removed with it.

   A clip that arrives without a still belongs here again. The exit is the
   same both times: cut the plate from frame 0, or find the master. */
export type LibraryClip = {
  id: string;
  name: string;
  /** Honest description of the frame. */
  alt: string;
  loop: VisualLoop;
  source: string;
};

export const LIBRARY_CLIPS: Record<string, LibraryClip> = {};
