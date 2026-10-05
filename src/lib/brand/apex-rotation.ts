/* ════════════════════════════════════════════════════════════════════════
   APEX ROTATION — the command room opens onto the earth and the cosmos.

   Owner direction 2026-09-19: Apex carries the earth and cosmic library as
   well as its own room, transitioning between them. The room holds first,
   then the set alternates an earth clip with a cosmic still, and returns to
   the room. Every entry is an APPROVED image in `library.ts`; the four earth
   clips were approved for this use by the same direction.

   Paths only — no blur placeholders — so the library's data URLs never reach
   the client bundle through this module.
   ════════════════════════════════════════════════════════════════════════ */

export type ApexRotationItem =
  | { kind: "clip"; id: string; src: string; poster: string; posterSmall: string }
  | { kind: "still"; id: string; src: string; srcSmall: string };

const clip = (id: string): ApexRotationItem => ({
  kind: "clip",
  id,
  src: `/brand/loops/${id}-16x9.mp4`,
  poster: `/brand/library/${id}.webp`,
  posterSmall: `/brand/library/${id}-1200.webp`,
});
const still = (id: string): ApexRotationItem => ({
  kind: "still",
  id,
  src: `/brand/library/${id}.webp`,
  srcSmall: `/brand/library/${id}-1200.webp`,
});

/** After the room: earth clip, cosmic still, alternating.
 *
 *  The river delta held the seventh slot until 2026-09-24, when it was pulled
 *  on owner direction. Its clip is a truncated export — 0.21s of video in a
 *  6.8MB file, registered as 5s — so the slot downloaded 6.8MB to stutter a
 *  third of a second on repeat. The clip is RETIRED in `library.ts`; the
 *  picture stays an approved library image, simply not cast here. Three clips
 *  remain, and the tail of the round is two stills rather than one.
 *
 *  Restoring it is two lines — `clip("river-delta")` back in this list and the
 *  loop back to APPROVED — once the motion has been regenerated. */
export const APEX_ROTATION: readonly ApexRotationItem[] = [
  clip("salt-flat-mirror"),
  still("black-hole-disc"),
  clip("cloud-inversion"),
  still("ringed-gas-giant"),
  clip("ice-cave"),
  still("moon-plain-ringed-planet"),
  still("gas-giant-hull"),
];

/** How long the command room holds before the rotation begins, and between rounds. */
export const APEX_ROOM_HOLD_MS = 30_000;
/** A cosmic still holds this long, drifting in slowly. */
export const APEX_STILL_HOLD_MS = 16_000;
/** An earth clip plays once through at the room's calm rate; this caps it. */
export const APEX_CLIP_MAX_MS = 12_000;
/** Every hand-off is a slow cross-fade — luxury is calm. */
export const APEX_ROTATION_FADE_MS = 3_000;

/** Index -1 is the room itself. */
export function nextRotationIndex(index: number): number {
  return index + 1 >= APEX_ROTATION.length ? -1 : index + 1;
}
