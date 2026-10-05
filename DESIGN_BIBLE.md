# RESERVE DESIGN BIBLE — V1.8

**The permanent source of truth for Reserve Lab.**

Every future feature, screen, sentence, animation, and image is validated against this
document. If a proposal conflicts with this document, the proposal changes — not the Bible —
unless the Bible itself is revised in a deliberate versioned edit.

This Bible is grounded in the shipped system. Where a rule references a class, component,
engine, or threshold, that artifact exists in this repository today. New work extends those
artifacts; it does not invent parallel ones.

Reference implementations:
- Surface primitive: `src/components/ui/GlassPanel.tsx`
- Type + motion tokens: `src/app/globals.css`
- Apex Command (the Pit Wall): `src/components/apex/pit-wall/`, model `src/components/apex/model/`, day resolver `src/lib/apex/today-resolver.ts`, statement `src/lib/apex/statement.ts`
- Canonical week + day protocol: `src/lib/training/weekly-split.ts`
- Compliance walls: `CLAUDE.md`, `AGENTS.md` (those documents outrank this one on safety)

---

## SECTION 01 — BRAND PHILOSOPHY

### What Reserve Lab is
Reserve Lab is a **Human Performance Operating System**: a private, calm, authoritative
layer that knows the member's condition, mission, limiter, and next move — and directs
performance the way a race engineer directs a driver.

### What Reserve Lab is not
- Not a fitness app. Fitness apps display data and wait. Reserve decides and directs.
- Not a coaching app. Coaching apps talk *at* the member with hype. Reserve speaks once,
  quietly, with authority.
- Not a health tracker. Trackers collect and chart. Reserve converts every signal into a
  decision or it does not show the signal.
- Not productivity software. There are no streak gimmicks, badges, confetti, or guilt loops.
  The reward is the member's own output.
  *Amended 2026-09-16 by owner direction:* recovery logging earns a rank for days on the
  record (`src/lib/recovery/log-rank.ts`), shown as one short full-screen moment. It rewards
  keeping the record, never the numbers or anything to do with compounds; no confetti, no
  sound, no guilt copy for a missed day, and still under reduced motion.
- Not a clinic. Reserve never diagnoses, prescribes, interprets labs, or recommends
  compounds or doses. It organizes, observes trends, and routes to clinicians. This is a
  hard wall, not a style choice (see Section 04, Forbidden Language).

### Mission
Give serious athletes a single operating system that turns training, fuel, recovery,
schedule, physique evidence, and internal markers into one daily directed mission.

### Vision
The member opens Reserve and feels: *Reserve knows my condition. Reserve knows my mission.
Reserve knows my limiter. Reserve knows my next move.* Reserve is not showing data —
Reserve is directing performance.

### Positioning
"Apple Health if built by Rolls-Royce. Whoop if built by Apple Vision Pro. Formula 1
telemetry fused with a private longevity clinic." Public tiers are **Reserve Signature**
and **Reserve Black** — never Core, Basic, Starter, Entry, Lite, Standard, or Beginner in
public copy.

### Luxury principles
1. **Quiet authority.** Luxury never raises its voice. One statement per screen.
2. **Space is the material.** What we remove is the product as much as what we add.
3. **Precision over decoration.** Every pixel and every word earns its place.
4. **Honesty is premium.** Derived values say "derived." Estimates say "est." Projections
   say "projected." Fabricated certainty is the cheapest thing software can do.
5. **The member is the hero.** Reserve is the engineer on the radio, never the star.

### Performance principles
1. Every screen answers: **What is my next best move?**
2. Information that does not change a decision is demoted or deleted.
3. The system reacts to the member's real state — copy, motion, and light all follow
   readiness.
4. Evidence drives confidence: missing data is surfaced as "evidence needed," never
   papered over.

---

## SECTION 02 — EMOTIONAL DESIGN SYSTEM

Each surface has a target emotional arc: what the member feels walking in, and what they
must feel walking out.

| Surface | Atmosphere | Energy | Entering feeling | Leaving feeling | Psychological objective |
|---|---|---|---|---|---|
| **Apex Command** | Mission control, champagne-gold light | Matched to readiness | "What's my status?" | "I know exactly what to do next." | Decisive clarity |
| **Training** | Performance cockpit, focused, armed | High but controlled | Anticipation | Commitment to one target | Mission lock |
| **Recovery** | Dim regeneration suite | Low, restrained | Fatigue or doubt | Permission to restore | Protected, not lazy |
| **Nutrition** | Metabolic command center | Medium, warm | "What do I eat?" | "Fuel is handled." | Strategy, not chores |
| **Bloodwork / Biomarkers** | Private laboratory, steel-blue | Low, precise | Curiosity or worry | Organized, clinician-ready | Stewardship, never fear |
| **Sleep / Evening** | Violet dusk, closing down | Lowest | Day residue | The day is closed | Sleep is a mission asset |
| **Progress Photos** | Studio, neutral light | Low | Self-consciousness | Evidence captured | Documentation, never judgment |
| **Measurements** | Instrument room | Low | Routine | Trend confidence | Precision habit |
| **Community** | Private club lounge | Medium | Belonging-seeking | Belonging-confirmed | Status without comparison shame |
| **Reserve Black** | Deeper black, more gold light | Charged but restrained | Expectation | Ownership | Earned access |
| **AI Strategist** | Quiet war room | Low | Question | Direction | Trust in the read |

**Rules**
- Never use fear, shame, or urgency theatrics anywhere. Low readiness reads as *protection*,
  never failure.
- Photos and measurements are evidence surfaces: zero evaluative language about the body
  itself ("lagging delts" comes from the member's own weak-point selections, never from
  Reserve's judgment of an image).
- Bloodwork's emotional ceiling is "organized and ready for my clinician" — never alarm,
  never reassurance about health status.

---

## SECTION 03 — TYPOGRAPHY BIBLE

### The three-layer system (shipped in `globals.css`)

**1. HERO type — the statement.** `.type-hero` / `.type-hero-xl`
- Font: `--font-display` (Inter Tight 900) → the licensed analog of SF Pro Display Heavy /
  Neue Haas Display.
- `clamp(34px, 5vw, 64px)`; XL `clamp(42px, 7vw, 96px)`. Mobile floor ≈ 34–42px.
- Uppercase, `letter-spacing: -0.025em`, `line-height: 0.92`.
- One per screen. It is the screen. Examples: `READY FOR HIGH OUTPUT` ·
  `BUILD UPPER OUTPUT.` · `FUEL THE SYSTEM.` · `PROTECT RECOVERY`.

**2. COMMAND type — the decision.** `.type-command`
- 13px / 1.55, ivory at 78% opacity, weight 500.
- Complete declarative sentences. One to two lines. Example: *"You are 84% ready for high
  output. Hard session approved."*

**3. WHISPER type — the system label.** `.type-whisper`
- `--font-geist-mono`, 7–9px, uppercase, `letter-spacing: 0.2–0.3em`, white at ~38%.
- This is luxury labeling, not dashboard labeling: `PRIVATE PERFORMANCE BRIEFING` ·
  `OUTPUT CAPACITY` · `FUEL WINDOW` · `NEXT MOVE`.

**4. JEWELRY numerals.** `.type-jewel`
- `clamp(44px, 6vw, 84px)`, weight 900, tabular-nums, `letter-spacing: -0.03em`, soft gold
  text-shadow. Key numbers (Readiness, Recovery, Protein, Testosterone-as-logged) are
  presented as objects: big numeral, whisper label above, command line below. The number is
  the product.

**5. System/body text.** Geist Sans, 10.5–12px, `leading-[1.45–1.6]`, white 40–70%.
All timestamps and counters use `tabular-nums` (`.tnum`).

### Hierarchy rules
- Exactly one hero statement per screen. Two giants never compete (when the dynamic
  statement was added to Apex, the split identity was deliberately stepped down to
  `clamp(24px, 3.2vw, 38px)`).
- Whisper → Hero → Command is the canonical vertical stack. Never Command above Hero.
- Numbers outrank words. Words explain numbers; numbers never decorate words.

### Improper usage (forbidden)
- ❌ Paragraphs longer than two lines anywhere above the fold.
- ❌ Mixed-case mono labels, or tracked uppercase at body sizes (>13px tracked uppercase
  reads as shouting).
- ❌ More than three font sizes inside one card.
- ❌ Bold-everything. If everything is bold, nothing is.

### How typography creates luxury
Restraint (few sizes, few weights), generous tracking on tiny labels, tight tracking on
huge statements, tabular numerals, and silence between blocks. Luxury type is the absence
of competition.

---

## SECTION 04 — RESERVE VOCABULARY SYSTEM

### Approved vocabulary (the official language)
Mission Ready · Output Capacity · Recovery Capacity · Recovery Protected · Sleep Secured ·
Sleep Lock · Fuel Status · Fuel Complete · Fuel Window · Fuel Strategy · Live Fuel Log ·
Reserve Available · Recovery Debt · Execution Window · Performance Window · Training
Signal · Recovery Signal · Session Directive · Session Armed · Mission Timeline · Mission
Control · Daily Command Board · Watch List · Next Move · Highest ROI Action · Evidence
Needed · Longevity Signal · Internal Baseline · Win Condition · Performance Target ·
Projected Session Quality (always "derived") · Compound Logbook (log-only) · Private Log.

### Label conversions (locked in)
| Never | Always |
|---|---|
| Readiness Score | Readiness (numeral) + statement |
| Training Load | **Output Capacity** |
| Recovery Reserve (as UI label) | **Recovery Capacity** |
| Nutrition Status | **Fuel Status** |
| Meal Plan | **Fuel Strategy** / **Live Fuel Log** |
| Daily Schedule | **Mission Timeline** |
| Workout Details | **Session Directive** |
| Next Best Action | **Next Move** |

### Discouraged terms
"Dashboard," "stats," "data," "tracker," "log your workout!", "crush," "grind," "beast
mode," "level up," emoji of any kind, exclamation points, "guru," "hack."

### Forbidden terms (hard compliance — outranks all design preference)
- Public tier words: Core, Basic, Starter, Entry, Lite, Standard, Beginner, Pro, Elite
  (public tiers are **Reserve Signature** and **Reserve Black** only).
- Medical/clinical: diagnose, treat, cure, prescription, prescribe, "optimal range,"
  "elevated/low" as a judgment of a lab value, "deficient," disease names attached to
  member data.
- Compound guidance: recommended dose, take this, increase/decrease your dose, cycle plan,
  stack suggestion, protocol optimization (for compounds), safe to use, injection
  instructions, sourcing.
- Outcome guarantees: "guaranteed," "you will lose/gain X."
- Real athlete / coach / federation names in public UI.

### Allowed safety language (the only way Reserve speaks about labs/compounds)
user-entered · log-only · worth reviewing · outside preferred range *only as member-flagged*
· trend deserves attention · review with a medical professional · clinician-review safe ·
monitoring reminder · evidence missing · upload labs · do not adjust without medical
supervision.

---

## SECTION 05 — COPYWRITING SYSTEM

### Voice
A private physician crossed with an F1 race engineer: calm, precise, personal, economical.
Quiet authority. Never sold to. Never shouted at. Never hyped.

### Sentence mechanics
- Declarative. Present tense. Second person implied, named sparingly ("Tony" appears in
  the greeting whisper, not in every sentence).
- Pattern: **WHISPER LABEL → short statement → one consequence or instruction.**
- Cut 30–40% of draft words, then strengthen what remains. If a sentence survives without
  a word, the word goes.
- Every alert carries its action in the same breath. Status without a move is noise.

### The dynamic statement system (shipped thresholds — do not fork)
Readiness reserve drives the Apex statement (`readinessStatement()`):

| State | Hero | Command line |
|---|---|---|
| ≥ 78 | READY FOR HIGH OUTPUT | "You are {n}% ready for high output. Hard session approved." |
| 62–77 | EXECUTE WITH DISCIPLINE | "You are {n}% ready. Training approved — keep volume controlled." |
| 45–61 | RECOVERY TAKES PRIORITY | "You are {n}% ready. Protect the system and reduce load today." |
| < 45 | DO NOT FORCE OUTPUT | "Recovery debt is elevated — sleep and hydration take priority." |
| Recovery day | PROTECT RECOVERY | "Restore the system. Tomorrow's output is built tonight." |
| No data | BRING SYSTEMS ONLINE | "Log a recovery check-in to activate the briefing." |
| Sleep conflict | (modifier) | append: "…close the day early — tonight compresses sleep." |

### Domain examples
- **Fuel, behind:** `HYDRATION BEHIND` — "Drink 24 oz before sleep." *(instruction allowed:
  behavioral, not medical)*
- **Fuel, secured:** `PROTEIN SECURED` — "221 / 210g · supports recovery and lean-mass
  retention."
- **Bloodwork:** `LONGEVITY SIGNAL · CURRENT` — "Hematocrit logged · trend rising — deserves
  attention at review. Review with your clinician." *(never "elevated/high" as a verdict)*
- **Sleep:** `SLEEP LOCK · 9:30 PM` — "Don't let late items push bedtime. Close the day
  early."

### Never write
"You got this!" · "Don't give up!" · "Amazing job!!" · "Your testosterone is excellent" ·
"Time to bulk" · any sentence that would embarrass a Rolls-Royce interior.

---

## SECTION 06 — RIMLESS iOS EXPERIENCE SYSTEM

**Objective:** Reserve must not feel like a website inside a phone. It must feel like the
operating system of the hardware. The user does not launch an app — they *enter Reserve*.

### Shipped foundation (extend, never fork)
- `viewport-fit=cover` + `themeColor #07080c` (`layout.tsx`) — the surface flows under the
  Dynamic Island and home indicator.
- Safe-area utilities `.safe-top / .safe-bottom / .safe-x` applied in `AppShell`.
- **GlassPanel is the only surface primitive.** Rimless contract: `rounded-[22px]`
  (hardware-curvature radius), border at `white/0.04` (near-invisible), inset ring 0.022,
  separation via top-edge light + `0 32px 100px rgba(0,0,0,0.4)` ambient shadow.
- Mobile gutters: 12px (`px-3`) — panels read as part of the display, not boxes on a page.

### Rules
1. **Kill the box effect.** Never card-inside-card-inside-card. Maximum two visible
   surface levels: the environment, and one glass layer. Inner groupings separate with
   light (hairline gradients, spacing) — not drawn borders.
2. **Edges belong to the environment.** Ambient glows, gradients, and light sweeps may
   bleed past content; content itself respects safe areas.
3. **Gradients are never trapped.** A glow clipped visibly by its own card boundary is a
   defect; backdrops live at the panel level and feather to transparency.
4. **Hardware curvature alignment.** Outer panel radius (22px) approximates the display
   corner; never use sharp-cornered full-bleed surfaces.
5. **Liquid over rigid.** Favor soft gradients, atmospheric separation, light hierarchy,
   depth hierarchy. Forbid: heavy outlines, hard edges, sharp separations, table borders.

### The depth stack (VisionOS-inspired)
- **Layer 1 — Ambient environment:** `AnimatedBackground`, drifting orbs (`fba-ambient-a/b`).
- **Layer 2 — Dynamic lighting:** aurora (`fba-aurora`), light sweeps (`fba-sweep`),
  breath glows (`fba-breath`, `fba-breath-slow`), all energy-scaled.
- **Layer 3 — Glass surfaces:** GlassPanel (blur 20px, saturate 120%).
- **Layer 4 — Content:** type system + jewelry numerals.
- **Layer 5 — Live intelligence:** pulses, due-now glows, live counters, rail pulses.

Each layer may move independently; no layer may move fast.

### The No-Website Rule
If a screen could be screenshotted and mistaken for a SaaS dashboard, a data portal, or a
spreadsheet, it fails review. Test: cover the logo — is this obviously Reserve?

### The phone shell (V1.8)
Below 768px Reserve is a native phone shell, not the desktop frame squeezed (owner-approved
2026-09-15; `src/components/AppShell.tsx`, `src/components/nav/`). Desktop and tablet keep their frame.
- **The document scrolls.** No inner scroll box, so the URL bar can collapse. Anything that reads or
  moves the page's scroll asks `src/lib/ui/shell-scroll.ts`, never `<main>` or `window` directly.
- **Top bar:** 48px plus the top safe area, sticky, solid ground. One line: RESERVE and the room's
  registry name, then the avatar and nothing else. Once the page's h1 scrolls away, a compact room
  title takes its place.
- **Tab bar:** Apex · Training · Fuel · Recovery · Schedule · More. 56px plus the bottom safe area,
  ≥44px targets, one gold marker on the active room (`aria-current`). The Sidebar's registry and tier
  gating apply: a room the member cannot see is not a tab, and a locked room stays a locked tab. This
  owner-approved tab bar is the sanctioned exception to the consumer-app caution in the design
  constitution.
- **More** is a bottom sheet holding every other destination, the Coach Command switch, sync status
  and the background-motion pause (WCAG 2.2.2).
- **The bottom stack** is a docked action (`ReserveActionBar`), then the tab bar. It steps aside while
  any sheet or drawer is open and never covers one.
- **Touch:** no grey tap flash; a pressed control dims slightly instead, and focus rings are
  untouched. Bottom sheets drag down from the handle to dismiss; disclosures open and close with
  motion. Inputs stay ≥16px.

### The Threshold — the entry screen (V1.5)
Sign-in (`src/components/auth/ReserveEntry.tsx`) is the front door to the living rooms, and the
OAuth callback and password recovery render through the same composition.
- The `entrance-gallery` plate runs full-bleed through its `reserve-gate` cinematic config. The
  plate renderer paints that config's overlays (`vertical-scrim-bottom` + `vignette`) at its
  content contrast (`src/lib/cinematic/overlays.ts`) in place of the manifest scrim.
- Content is bottom-anchored on the scrim: whisper → `RESERVE LAB` hero → one line, then the
  actions. **No card and no glass at rest.** One GlassPanel appears only when the member acts
  (opens the email path), and the plate quiets beneath it.
- Exactly one gold action in each state: Continue with Google (email inherits the gold when
  Google is off); Sign in inside the email path.
- Motion is a one-time settle, skipped under reduced motion and the member's ambient pause. No
  loop and no breathing plate: the entry has no pause control, so nothing may run past five
  seconds.

---

## SECTION 07 — SPACING SYSTEM

### Philosophy
Cheap products show everything at once. Premium products reveal what matters. Space is not
emptiness — it is the price of focus, paid gladly.

### Rules
1. **One dominant element per viewport-height of content:** one statement, one key metric,
   one next action, one risk signal. Everything else is secondary and lives below.
2. **Vertical rhythm:** sections separate by `gap-4` mobile / `gap-5–7` desktop; inside a
   panel, blocks step by `mt-2 → mt-3.5 → mt-5` (never uniform spacing — rhythm implies
   hierarchy).
3. **Breathing room scales with importance.** Heroes get `mt-5` clearance minimum;
   whispers may sit `mt-0.5` from their content.
4. **Density floors:** rows never tighter than `py-2`; chips never tighter than
   `px-1.5 py-0.5`. Tight is premium; cramped is cheap.
5. **Mobile (375px):** 12px outer gutters, single-column by default, horizontal scroll only
   for deliberate rails (7-Day Split). Zero horizontal page overflow — this is a release
   gate, verified at 375px every pass.
6. **The 30–40% rule applies to layout too:** when a section feels crowded, remove blocks
   before shrinking them.

---

## SECTION 08 — MOTION DESIGN BIBLE

### Philosophy
Motion is the proof the system is alive — a heartbeat, not a performance. Inspiration:
Vision Pro, Rolls-Royce instrumentation, F1 telemetry. Everything breathes; nothing waves
at you.

### Hard rules
1. **CSS-only for ambient motion.** transform / opacity / background-position. No JS
   animation loops for decoration.
2. **All motion dies under `prefers-reduced-motion`** — the global kill in `globals.css`
   covers every utility; new animations must remain inside that umbrella.
3. **Tempo bands (shipped tokens):**
   - *Pulse band* (live signals): `fba-pulse` 3.6s · `fba-glow-pulse` 2.8s ·
     `fba-heartbeat` 3.4s · `fba-rail-pulse` 3.8s · row glows 3.2/4.4s.
   - *Breath band* (ambient life): `fba-breath` 5.5s · `fba-breath-slow` 8.5s ·
     `fba-float` 6s · `fba-label-glow` 4.5s.
   - *Atmosphere band* (environment): `fba-shimmer` 9s · `fba-sweep` 12s · `fba-aurora`
     18s · orbital rings 32–46s · ambient drift 55–72s.
   - Nothing animates faster than 1.6s. Nothing loops faster than the pulse band.
4. **Entry choreography:** `fba-stagger` — 0.55s rise, `cubic-bezier(0.22,1,0.36,1)`,
   50ms cascade. Interaction transitions 200–300ms. View transitions ≤ 550ms.
   On phones a room switch is opacity only: the room steps out in 90ms, the page lands at its
   top, and the new room fades in over 240ms, while the plate keeps its ≥1s cross-fade (V1.8).
   A dragged sheet follows the finger, then leaves or springs back on the interface tokens.
   Under reduced motion none of this animates.
5. **State-driven energy (shipped):** backdrop `energy` follows readiness —
   ≥78 → 1.0, 62–77 → 0.78, below → 0.55, no data → 0.6. High readiness = more
   illumination; low readiness = restrained, dimmer atmosphere. Motion *is* a readout.
   Shipped for the living rooms (Apex V1.2; Training and Recovery V1.3; Nutrition V1.4; Schedule V1.6): plate
   brightness = plate opacity × energy.
6. **CTA sheen** (`fba-cta-sheen`): one quiet light pass every ~7.5s on high-value gold
   actions only. Never on secondary buttons.
7. **Now-marker:** the Apex timeline's now-marker moves with the minute clock only; no
   continuous animation.
8. **Horizon flow (V1.2):** on the horizon timeline the now gate holds still and items advance
   toward it with the minute clock. One light flow runs along each lane toward the gate in the
   atmosphere band (`fba-horizon-flow`, 12s) and stops under reduced motion.

### Forbidden
Fast neon, spinners as decoration, bouncing icons, parallax that exceeds a few pixels,
confetti, anything that competes with reading.

---

## SECTION 09 — ENVIRONMENT SYSTEM

The backdrop is a context engine. One ambient system (`AnimatedBackground` + per-panel
`CinematicBackdrop`) renders different *weather* per destination and daypart.

**Palette tokens:** gold `#d5b15f` · amber `#e8c87a` · steel `#5fb7d5` · green `#6ee7b7` ·
violet `#a78bfa` · slate `#8ea0b8` · red `#ef7d55` (alerts only) · base `#07080c`.

| Environment | Light | Color lead | Depth/Motion | Emotional objective |
|---|---|---|---|---|
| **Morning** | Low warm dawn from screen-left | Gold ramping up | Slow aurora rising | The day is staged |
| **Afternoon** | Even, neutral | Gold + steel balanced | Steady drift | Execution rhythm |
| **Night** | Dim, top-down moonlight | Violet/steel, gold embers | Slowest band only | Close the day |
| **Mission control (Apex)** | Champagne-gold center glow | Gold | Full 5-layer stack, energy-scaled | Decisive clarity |
| **Training** | Focused spotlight, dark edges | Gold + steel accents | Pulse band visible | Armed |
| **Recovery / Sleep** | Lowest light in the product | Steel → violet | Breath band only | Restoration |
| **Nutrition** | Warm hearth glow | Green + gold | Gentle | Strategy, appetite-calm |
| **Schedule** | Low warm dawn from screen-left, a planning desk | Gold + steel | Gentle; the minute clock only | The day is staged |
| **Bloodwork / Longevity** | Cool laboratory rim-light | Steel | Minimal, precise | Stewardship |
| **Community** | Lounge warmth | Gold, low | Subtle | Private club |

**Rules:** environment changes are felt, not announced — opacity/tint shifts over ≥1s;
never hard background swaps. Red exists only as a signal color, never as weather.

**Dayparts and room light (V1.2 Apex; V1.3 Training and Recovery; V1.4 Nutrition; V1.6 Schedule).** `resolveDaypart` (`src/lib/cinematic/room-light.ts`)
reads the member's wake and sleep targets (defaults 06:30 / 22:30): dawn runs from 60 min before
wake to 90 min after, night from 120 min before sleep until dawn, day in between. Dawn is a
subtle gold tint from screen-left over the day plate; night serves the manifest's approved night
plate (16:9, plus its own 9:16 for phones). Plates cross-fade over ≥1s. Plate brightness follows
readiness energy (Section 08 rule 5). Scroll adds 2–4px of depth drift (plate 2px, light 4px,
glass fixed), off under reduced motion and during a live session.

Training holds the light it had when a live session began: no daypart change, brightness shift,
cross-fade or loop while sets are logged. Recovery's dawn tint runs at 40% so it stays the lowest
light in the product. Nutrition's dawn tint runs at 70%: a warm hearth, clearly warmer than Recovery
and calmer than Apex and Training. Schedule's dawn tint runs at 85%: it is the planning desk where the day is staged,
so its dawn warms more than Nutrition's hearth and stays under Apex and Training. Each room's night plate is its own
owner-approved grade of the day plate.

**Phone plates (V1.7).** Every room plate, day and night, has its own 9:16 plate for phones: the
same room extended from the 16:9 with Adobe generative expand (night 9:16s graded to match their
16:9 night plates), never a crop of the desktop plate. A phone frames the whole room, centred on
the room's subject (`focalPoint.mobile` in `src/lib/brand/asset-manifest.ts`). A new plate ships
with its 9:16; the video loop stays desktop-only until a 9:16 loop is approved.

Nutrition's first screen holds one gold action that never logs a meal by itself: it opens the meal
confirmation, where nothing counts until the member confirms, and any amount it records (water) is
printed in its label. Its horizon strip reads the same fuel plan as the Apex fuel lane (meal windows,
the training window when a session is planned, and sleep lock); no meal sits past sleep lock, and
after sleep lock the strip is a quiet state, never an empty track.

Schedule's first screen holds one gold action: the next real thing on today's plan. A session starts
through Training's own launch path, a meal opens the meal confirmation, last night's sleep opens the
Sleep Log, and a sleep conflict ahead of the session opens the training window to adjust; any amount
it records (water) is printed in its label. Its day status reads the one training-day resolver, so a
training day, a recovery day, and a session moved here or moved away read the same as on Apex,
Training and Nutrition. Its horizon strip runs wake, meal windows, the training window and sleep lock
from the schedule engine; no meal sits past sleep lock, and before wake, after sleep lock or before
the member has set their day it is a quiet state, never an empty track or a plan of starting times.

**Future expansion:** a `view → environment` map keyed off `activeView` driving
`AnimatedBackground` tint/energy (the highest-ranked roadmap item from the immersion pass).

---

## SECTION 10 — IMAGE DIRECTION BIBLE

### Categories
1. **Environmental** — architecture of performance: empty private gyms at dawn, lab glass,
   cockpit details, dark water, mountain air.
2. **Material** — macro textures: brushed metal, smoked glass, carbon weave, dark stone.
3. **Hero abstract** — generated light fields and gradients consistent with the
   environment system.
4. **Human (rare)** — anonymous, silhouetted, never posing for the camera, never
   identifiable, never a real athlete's likeness.

### Rules
- Lighting: single-source, low-key, warm-on-dark or steel-on-dark. No flat daylight, no
  ring-light.
- Grade: lifted blacks toward `#07080c`, desaturated mids, one accent hue from the palette.
- Composition: generous negative space; subject occupies ≤ 40% of frame; depth of field
  always present.
- Glass interaction: imagery sits in Layer 1–2 (behind glass), blurred 20px+ when content
  overlays it. Imagery never competes with type.
- **Forbidden:** stock fitness photography, influencer/gym-selfie culture, oiled posing
  shots, motivational poster aesthetics, watermarks, anything that says "supplement brand."
- The bar: would this frame hang in an Aman lobby? If not, it doesn't ship.

---

## SECTION 11 — COMPONENT HIERARCHY SYSTEM

Every major screen follows the six-layer stack, top to bottom:

| Layer | Element | Contract |
|---|---|---|
| 1 | **Hero Statement** | One `.type-hero` line, state-derived (Section 05 table). |
| 2 | **Primary Metric** | One jewelry numeral with whisper label + command line. |
| 3 | **Highest ROI Action** | The Next Move panel: title, "why now," ordered micro-steps, one gold CTA (sheen allowed). |
| 4 | **Risk** | One line: `RISK · Low / Moderate / Elevated / Sleep compression` — derived from real watch state, never fabricated. |
| 5 | **Supporting Intelligence** | Smart Brief lines, lanes, week rail, watch list, reviews. |
| 6 | **Expanded Detail** | History, libraries, editors, settings — reachable, never leading. |

**Behavior rules**
- Layers 1–4 are the fold contract on mobile: Current Mission, Current Score, Current
  Action, Current Risk — visible without scrolling.
- Layers 1–4 are simultaneously visible on the first screen at 1440×900 and 390×844. Side
  by side is allowed; reading order left-to-right, top-to-bottom follows layer order.
- A screen may omit a layer; it may never reorder layers.
- Only navigable elements look interactive. Display-only chips render as `<span>`, disabled
  actions carry a `title` reason — **no fake buttons, no dead CTAs** (standing rule).
- Every list with status uses the canonical set: Due Now · Due Next · Upcoming · Past Due
  (with "still counts" lateness) · Completed · Skipped.

---

## SECTION 12 — AI INTELLIGENCE EXPERIENCE

### How AI appears
Reserve's intelligence is **ambient and deterministic-first**: it reads the member's logged
reality and composes the brief. It never cosplays as a chatbot. No avatars, no typing
indicators, no "How can I help you today?"

### Personas (tone, not characters)
Performance strategist (Apex/Strategist) · private physician's *organizer* (Bloodwork —
organizes for the clinician, never replaces them) · race engineer (Training live) ·
operations advisor (Schedule/Fuel).

### Rules for machine-generated guidance
1. **Specific or silent.** "Momentum improving — keep going" is banned filler. Every line
   names today's session, time, target, or evidence (the Smart Brief contract:
   Mission / High ROI Move / Limiter / Protect / Avoid / After Training / Next Evidence).
2. **Show the why.** Every recommendation carries "why now" or its source signal.
3. **Honest provenance.** Derived = "derived." Estimated = "est." Sample data = labeled.
   Missing data = "Evidence needed" + the logging action, never a guess.
4. **Severity without theater.** Watch-list items carry low/moderate/high severity chips
   and a deep link — no sirens, no red walls.
5. **Compliance wall** (Section 04) applies to every generated sentence. AI may organize
   compound logs and lab trends; it may never advise on them. Medical-adjacent output
   always terminates in "review with a medical professional."
6. **Behavior, not identity.** AI speaks about the member's actions and signals, never
   about the member's worth, body, or character.

---

## SECTION 13 — APEX COMMAND BIBLE

Apex is the most important screen in Reserve: the member's mission control, and the only
screen guaranteed to be seen daily.

### What Apex does
Answers, in order, within one viewport: **What condition am I in? What is today's mission?
What is holding me back? What is my next move? What is the risk?**

### Above the fold (locked order)
Spatial: regions sit side by side where the viewport allows, and reading order follows this
list (Section 11).
1. Status bus
2. Condition column — whisper + greeting, statement + command line, readiness jewel,
   projected session quality (training days, labelled derived), logged sleep, split line
3. Mission timeline — the dominant region. On md and up it is a horizon: now is a light gate
   near the viewer and the day recedes toward sleep lock. Only the track has perspective;
   labels stay flat and upright, text never drops below 11px, every item stays a ≥44px button
   in list order, and depth compresses on narrow tracks (`src/lib/apex/horizon-projection.ts`).
4. Next Move with risk

Phones are the one sanctioned reordering: the Next Move is read before the Mission Timeline
(the move, then the day), and its action docks at the bottom of the screen within thumb reach.
Phones keep the vertical Now Spine; its depth is a gentle fade down the list that never takes
text below AA contrast.

The Performance Core retires from Apex.

### Never above the fold
History, libraries, settings, empty-state education, weekly retrospectives, anything
log-only.

### Section order below the fold (current canon)
Week rail (first screen on desktop, below the Next Move on phones) → Logbook (log-only, only
when the member has entries) → Watch List + Evidence Needed → Full briefing (closed) →
Secondary Systems → Consistency & Milestones (closed) → footer.

### How Apex derives its reads
- **Condition** — recovery reserve (readiness) via the strategist/recovery engines.
- **Opportunity** — `highestRoiAction` from the strategist briefing (single, not a list).
- **Risk** — sleep compression > high-severity watch signals > moderate > Low.
- **Mission** — canonical week (`RESERVE_WEEK_SPLIT`) + template `sessionIntent` + day
  protocol. Apex and Training read the same source and may never drift.
- **Evidence** — `buildEvidenceWatch`: labs/measurements/photos/recovery, missing or stale.

### Prime directives
One dashboard (no second dashboard inside it), one clock driving all live states, every
number traceable to a logged source or labeled as derived/estimate/sample.

---

## SECTION 14 — RESERVE BLACK EXPERIENCE

### Philosophy
Reserve Black is not louder — it is *deeper*. More access, more intelligence, more light
discipline. The difference between Signature and Black is the difference between a fine
hotel room and the floor you need a separate elevator key for.

### Visual differentiation
- Deeper blacks behind richer gold: Black surfaces may run the amber→gold gradient
  (`#e8c87a → #d5b15f`) on identity chips and advanced-output markers.
- The `Reserve Black` chip (flame + amber rule) marks advanced sessions and capabilities —
  small, mono, never a banner.
- Black-only surfaces get the full five-layer depth stack; Signature surfaces may run a
  reduced stack.
- **Never tacky:** no crowns, no diamonds, no "VIP," no gold-foil textures, no lock icons
  begging to be tapped. Locked features state plainly: what it is, that it is Black, one
  quiet upgrade affordance.

### Experiential differentiation
- Advanced training tiers (higher output sessions), Biomarker Cockpit depth, Enhanced
  Command, advanced reviews.
- Black members see *more derived intelligence per logged signal* — the tier buys depth of
  read, not gimmicks.
- Emotionally: Signature feels *guided*; Black feels *commanded* — the member owns a
  full operations staff.

---

## SECTION 15 — FUTURE VISION (3-YEAR HORIZON)

**Year 1 — The Reactive Surface**
- Environment engine v1: `activeView` + daypart + readiness drive global backdrop tint and
  energy (foundation already shipped as `CinematicBackdrop energy`).
- Pre-dawn quick-fuel state; vertical Mission Timeline spine with live now-marker;
  above-the-fold compression audit across all secondary views.
- Parallax depth: 2–4px independent layer drift on scroll, CSS-only.

**Year 2 — The Sensing System**
- Biometric ingestion (HealthKit / wearable sleep, HRV, resting HR) feeding the same
  readiness statement engine — thresholds stay canonical, inputs get richer.
- Readiness-responsive interface: type scale, motion energy, and section ordering adapt to
  state (low readiness literally reorders the day around recovery).
- AI personalization memory: the brief learns the member's language ("Batman Split" level
  personal vocabulary everywhere), while every compliance wall remains absolute.

**Year 3 — The Spatial Operating System**
- Vision Pro: Apex as a room — the readiness instrument as a physical object, the Mission
  Timeline as a horizon line (brought forward to the Pit Wall in V1.2), training directives pinned in space at the rack.
- Dynamic daily worlds: the environment system graduates from weather to place — dawn
  garage, night lab, recovery suite — generated, graded, and lit to this Bible.
- The phone becomes the remote; Reserve becomes the environment.

**Constitutional clause:** every future capability, including all of the above, remains
subject to Section 04's forbidden language and the compliance walls in `CLAUDE.md`. The
more intelligent Reserve becomes, the more its restraint *is* the luxury.

---

*Reserve Design Bible V1 — created 2026-06-12. Amendments are versioned edits to this
file, validated against the shipped system and the standing compliance rules.*

*V1.1 — 2026-09-13: Apex becomes the Pit Wall; Performance Core retired from Apex; layers 1–4 simultaneously visible (owner-approved direction A).*

*V1.2 — 2026-09-14: Mission Timeline becomes a horizon on md and up; the Apex room gains dayparts (owner-approved night plate), readiness room light and scroll depth drift (owner-approved direction B).*

*V1.3 — 2026-09-14: Training and Recovery become living rooms (owner-approved night plates, room light, depth drift); each gains a horizon strip, with Training's static during live logging.*

*V1.4 — 2026-09-15: Nutrition becomes a living room (owner-approved 16:9 night plate, 70% dawn tint, room light, depth drift); its hero gains one honest gold action and a fuel horizon strip toward sleep lock.*

*V1.5 — 2026-09-15: The Threshold becomes the entry screen (owner-approved direction, 2026-08-06): full-bleed reserve-gate plate with its own overlays, bottom-anchored content, no card or glass at rest, glass only when the member acts.*

*V1.6 — 2026-09-15: Schedule becomes a living room (owner-approved 16:9 night plate, 85% dawn tint, room light, depth drift); its hero gains one honest gold action and a day horizon from wake to sleep lock.*

*V1.7 — 2026-09-15: Phone plates. Every room's day plate, and the Nutrition and Schedule night plates, gain their own 9:16 (Adobe generative expand from the 16:9), so a phone frames the whole room instead of a crop of the desktop plate.*

*V1.8 — 2026-09-15: The phone shell (owner-approved "Native phone shell"): document scroll on phones, a slim single-line top bar, a bottom tab bar for the five rooms plus More, drag-to-dismiss sheets, no tap flash, and a quick fade between rooms.*
