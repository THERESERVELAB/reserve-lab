# Reserve Ambient Shot List

What the rooms still owe, after the 2026-09-24 pass that made every room follow
the member's clock. Ordered by what a member actually notices.

This list is generated from the manifest, not from memory: every "still" below
is a real cell in the coverage matrix, and every source plate named is a file
already in `public/brand/backgrounds`.

---

## The house spec

Every clip on this list is **image-to-video from a plate already in the repo**.
That is not a preference — it is the contract. A loop's first frame IS its
plate, because the plate is the poster the loop fades up from; if they differ,
the hand-off is a visible jump instead of something felt.

| | |
|---|---|
| Source | The named `.webp` plate, at full resolution |
| Size | 1920×1080 for 16:9, 1080×1920 for 9:16. Never 1280×720 |
| Length | 5s or 8s |
| Audio | None. A track on the file fails the test suite |
| Motion | Ambient only — mist, water, cloud. No camera travel, no cuts |
| **Light** | **The lighting level must NOT change across the clip.** Never prompt a room to "breathe", "pulse" or bring light up and down: on repeat it reads as the lights switching on and off. Measured as luminance swing, limit 35% of mean — shipping clips run 13–27%, two rejected attempts at a dark room ran 80% and 112% |
| Subject | No storms or weather. Nature and cosmos are wanted. A near-black room is a bad subject: its lights are the only thing with energy, so the model animates them and the swing rule fails — twice, on explicit instruction not to |
| Loop | First and last frame identical, or the seam reads as a pulse |
| Budget | Under 6MB after encode. Re-encode at CRF 21–27, `-an`, yuv420p |
| First frame | Must measure under ~10/255 against its plate |

Gate every candidate clip BEFORE wiring it in — shape, silence, size, loop
seam, frame-0-vs-plate and luminance swing in one command. Add `--once` for a
clip that plays a single pass in the Apex rotation rather than looping:

```bash
node scripts/check-ambient-clip.mjs <clip.mp4> <plate.webp>
```

Then the suite:

```bash
npx vitest run src/lib/brand
```

---

## 1 · Night motion — 1 room still goes still after dark

Apex, Nutrition, Recovery and now Training all move at night. Schedule is the
last one that does not.

**Shot 1 delivered 2026-09-24.** Generated in Firefly (Veo 3.1) from
`training-floor-night.webp`, with the plate in BOTH the first- and last-frame
slots — which is the technique to carry forward, because it closes the loop by
construction instead of by asking the model to. It measured frame 0 vs plate
**1.0/255** (the closest in the repo) and a seam of **0.45** (Apex ships at
0.72; the chef kitchen's rejected take is 15.62). 1920×1080, 8s, silent, 2.0MB
as delivered — no re-encode needed. Live as `training-floor-night-16x9.mp4`.

Note what these plates actually are. Following the 2026-09-17 casting, a room's
night is often **the sky it looks out on** rather than the room re-lit — Apex's
night is Earth from orbit, Recovery's is an aurora, Nutrition's is the ocean
before dawn. Training's night is a storm. Schedule's is the only one of the two
that is a room.

| # | Room | Source plate | Shot | State |
|---|---|---|---|---|
| ~~1~~ | ~~**Training Command**~~ | `training-floor-night.webp` — a supercell over the plains at dusk | The storm's slow rotation and the rain curtain drifting. No camera move, no lightning | **done** |
| 2 | **Schedule Command** | `schedule-command-night.webp` — the dark study after hours: a desk, fluted cabinetry, warm light seams, reflections on stone | Warm seam light drifting along the fluting and its reflection travelling on the floor. Locked off. Nothing in the room itself moves | next |

**Settings that produced shot 1**, to repeat for shot 2: Veo 3.1 · Resolution
**1080p** (the default is 720p and must be changed — 1280×720 is what made the
old Compound clips unusable) · Widescreen 16:9 · 24 FPS · 8 seconds · Audio
**off** · References → Frames → the plate in **both** First and Last.

## 2 · Dawn — DONE for the five living rooms (2026-09-24)

All five now open the day on first light, generated as one set against one
brief so they read as a single hour rather than five pictures:

| Room | Dawn plate |
|---|---|
| Apex | `command-room-dawn` — a high ridge above a valley of mist |
| Training | `training-floor-dawn` — one gold crest line across cold shadow |
| Nutrition | `chef-kitchen-dawn` — a coastline, carrying into its ocean night |
| Recovery | `recovery-suite-dawn` — a glass-calm lake, the same water as its aurora |
| Schedule | `penthouse-study-dawn` — the first-light ridge, cast 2026-09-17 |

Masters 2752×1536 (Firefly image, Gemini 3.1, **2K at 16:9** — above the 2400px
a plate needs, so nothing is upscaled, and cheaper than 4K). Each 9:16 is cut
from its own master rather than squashed. All eight files under the 160KB plate
budget. None of them moves yet — see below.

## 2b · Dawn clips — none exist

Every dawn above is a still. Before generating any, read the luminance rule in
the house spec: a dark room cannot carry an ambient clip, but these can, because
mist, water and cloud move without the light level changing.

## 2c · Dawn and night — DONE everywhere (2026-09-24)

Second set, same brief, filling every remaining room:

| Room | Dawn | Night |
|---|---|---|
| Compound | salt terraces | a dark craft's viewport onto deep space |
| Bloodwork | glacier fracture network | the dark nebula (cast 2026-09-17) |
| Physique | sculpted sandstone | ringed planet over a basalt moon plain |
| Strategist | cloud sea, peaks breaking through | a black hole accretion disc |
| Community | an open river valley | a gas giant with razor-thin rings |

**The four nights cost nothing.** They are cut from the owner-approved cosmic
masters already on disk (5504×3072, the 2026-09-17 set) which `library.ts` had
registered as approved and never cast — each 9:16 is a true centre cut from the
master, not an upscale. Casting them is what that register existed for.

**Every room in the registry now changes with the member's clock**, which is
asserted rather than assumed (`leaves no room without a daypart of its own`).

Two encode notes worth keeping:
- The glacier is the one plate that will not come under 160KB at 2400w — the
  same high-frequency-ice problem the library records against `glacier-aerial`.
  It sits at 174KB after a light `hqdn3d` denoise, exactly matching the largest
  plate already shipping, and reads clean with no blocking. The 160KB figure is
  the LIBRARY budget; backgrounds already ran to 174KB before this.
- The sandstone's 16:9 is a crop from the right of its master. The generation
  put a sun disc in the top left, which is where the environment title sits —
  cropping removed it for free rather than spending a re-roll.

## 3 · Phones — every night clip is desktop-only

The 9:16 night *plates* already exist and render. Only the motion is missing,
so a phone sees the right room at the right hour, standing still.

| # | Room | Source plate | Note |
|---|---|---|---|
| 4 | **Apex Command** | `command-room-night-9x16.webp` | Earth from orbit. Pair to the 16:9 that ships |
| 5 | **Nutrition Command** | `chef-kitchen-night-9x16.webp` | Ocean before dawn |
| 6 | **Recovery Command** | `recovery-suite-night-9x16.webp` | Aurora over the lake |
| 7 | **Compound Command** | *none yet* | Needs the 9:16 **plate** first — a phone composition of the wellness suite, not a crop. Then its clip |

A 16:9 clip is never cover-cropped onto a phone by design, so there is no
shortcut here: the phone keeps its still until its own cut exists.

## 4 · Screens with a plate and no motion

Four rooms render a still and have never moved.

| # | Room | Source plate | Shot |
|---|---|---|---|
| 8 | **Bloodwork** | `biomarkers-lab.webp` + `biomarkers-lab-night.webp` | Cool light drifting. No pulsing and no rhythm — nothing in a clinical room may read as an alarm |
| 9 | **Physique / Photos** | `physique-scanner.webp` | The quietest clip in the set. A studio the member is about to stand in |
| 10 | **AI Strategist** | `intelligence-command.webp` | Structured light slowly resolving, as if something is becoming known |
| 11 | **Community** | `entrance-gallery.webp` | The entrance with nobody in it. A slow settle |

## 5 · Rooms with no plate at all

These render on the void. They need a plate before anything else:
**Protocol Command**, **Measurements**, and the **Reserve Women** surfaces
(cycle, fertility, pregnancy).

---

## Already in hand

Two rooms are approved, encoded and registered in `library.ts`, waiting only on
where they go:

- **`plunge-suite`** — a recovery suite at night: plunge bath, folded towels, a
  sleep mask, a foam roller. 2400×1350 plate cut from its 5504×3072 master,
  5.04s clip at 1.6MB. A natural fit for a second Recovery state.
- **`penthouse-vista`** — a penthouse at blue hour: black-and-gold marble
  running to a wall of windows, mist through a shaft of light. Plate is
  1920×1080 (no master was delivered) and the clip is the softest in the set.
  Re-cut from a higher-resolution master before casting it.

## Known exceptions

- **`river-delta`** — the clip is a truncated 0.21s export. RETIRED and pulled
  from the Apex rotation 2026-09-24. Regenerating it restores the slot in two
  lines. The picture itself is fine.
- **`ice-cave`** — 6.32MB, 16KB over the loop budget. It is the owner's
  approved benchmark, so it is recorded as an exception rather than re-encoded.
- **`chef-kitchen`** day clip — REVIEW, on measured evidence: its last frame
  sits far from its first, and the crossfade join reads as a pulse. Approving
  it would promote Nutrition onto that plate by day. Needs a re-cut, not a
  status change.
