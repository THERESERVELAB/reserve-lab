# RESERVE DESIGN BIBLE — V2 PROPOSAL

**Status: proposal, not canon.** `DESIGN_BIBLE.md` V1 remains the shipped source of
truth until this is reviewed. Nothing here overwrites it. On approval, accepted sections
become a versioned edit appended to `DESIGN_BIBLE.md` (new Sections 16–21) exactly as
its own closing line promises: *"Amendments are versioned edits to this file."*

**Why this exists:** `docs/RESERVE_UI_AUDIT.md` found that V1's rules are sound but
under-specified in exactly the places that matter most for *feel* — hero composition,
card discipline, color governance, and environment transitions are described in
principle (Sections 06/07/09) but not enforced with hard numbers or per-screen
assignments. Every screen independently drifted toward the same generic
dial-hero-plus-card-stack shape because nothing in V1 said "no two screens may look like
this same box." This proposal closes that gap and adds two systems V1 never had: a
Firefly bespoke-asset system, and a formal reusable-component catalog.

---

## PROPOSED SECTION 16 — HERO COMPOSITION SYSTEM

### The problem this fixes
Apex, Recovery, and Physique currently share one hero shape: whisper → title → dial or
numeral → colored statement → 2×2 metric grid → one CTA. The Bible promised six
emotionally distinct environments (V1 §02); the component layer only built one template
and relabeled it six times.

### The rule
**No two screens may use the same hero archetype.** Each screen is assigned exactly one
archetype below. An archetype is a *shape*, not a color scheme — swapping the accent hue
does not satisfy this rule.

| Screen | Archetype | Shape |
|---|---|---|
| **Apex** | **Statement Hero** | Text-led. Whisper → one hero line → one command line → the Performance Core (3D object) sits beside or below as the supporting visual, never a second numeral competing with the headline. |
| **Training** | **Cockpit Hero** | HUD status bar, not a card. A horizontal instrument strip (session name, phase, live clock, one readiness chip) pinned near the top; no dial, no 2×2 grid — those are Apex's shape. |
| **Nutrition** | **Kitchen Hero** | A "plate" metaphor — one dominant meal-of-the-moment rendered large (image or illustrated plate composition), macros presented as a single ring or bar beneath it, not four boxes. |
| **Recovery** | **Dial Hero** | Reserve keeps this — it's the only screen with a single-glance restorative number as the emotional center. Everything else must give it up. |
| **Physique** | **Studio Hero** | Imagery-led. A large evidence frame (photo or silhouette composition per V1 §10) is the visual center; numerals sit beside it in a single vertical stat rail, never a 2×2 grid. |
| **Schedule** | **Timeline Hero** | A horizon-line visual — a single horizontal spine with a live now-marker — replaces the dial and the 2×2 grid entirely. This *is* the "Mission Timeline" made literal. |

### Anatomy every hero must obey, regardless of archetype
1. **One environment layer** (ambient backdrop, this screen's assigned colors only —
   see Section 18).
2. **One whisper label.**
3. **One hero statement** (`.type-hero`, V1 §03) — never two hero-weight lines. Apex's
   current "4X RESERVE METHOD" secondary hero is the audit's clearest violation of this;
   it demotes to a whisper-weight architecture tag.
4. **One supporting visual specific to the archetype** (orb / HUD strip / plate / dial /
   photo frame / timeline spine) — this is what makes six screens look like six places.
5. **One primary metric OR one CTA at max visual weight — never both.** If the metric
   *is* the action (Recovery's reserve dial doubling as "here's today's next best
   action" entry point), that's one element serving two jobs, which is allowed; two
   *separate* max-weight elements is not.
6. **Height budget:** the full hero (all five items above) may not exceed ~60% of the
   first viewport on mobile (375×812). Anything currently pushing past that (Apex's
   badge row + live status line + 4-tile grid + CTA + orb, all before scroll) gets
   trimmed by demoting or removing, not shrinking font sizes.

---

## PROPOSED SECTION 17 — CARD PHILOSOPHY

### The problem this fixes
V1 §06 says "kill the box effect" but gives no number. Every audited screen nests boxes
3–5 levels deep because "two visible surface levels" was never operationalized into a
countable rule a component author can check against.

### The rule: One Fact, One Home
Every discrete fact (a macro number, a readiness score, a session name, a limiter) may
appear at full visual weight in **exactly one** place per screen. If a second surface
needs to reference it, it links to the first — it does not re-render it in a new card.
This directly fixes Cross-Cutting Pattern #4 from the audit (Apex's Split Command vs.
hero; Nutrition's four macro displays; Physique's dual cockpit).

### Card elevation tiers (replaces ad-hoc nesting)
| Tier | What it is | Visual treatment | Nesting allowed |
|---|---|---|---|
| **Tier 1 — Surface** | The one glass layer per screen section (V1 §06's "one glass layer") | `GlassPanel`, border `white/0.04`, ambient shadow | May contain Tier 2/3 only |
| **Tier 2 — Group** | A logical grouping inside a surface (e.g. "today's macros") | **No border, no background fill.** Separated by a hairline gradient divider or spacing alone | May contain Tier 3 only |
| **Tier 3 — Element** | A single stat, chip, or row | Type and color only — no container at all | Leaf node, nothing nests inside it |

**The fix for every "box-inside-box" finding in the audit is mechanical:** anywhere a
`rounded-xl border` div currently sits inside a `GlassPanel`, it downgrades to a Tier 2
group (spacing + a hairline divider) unless it is truly a second independent surface
(rare — reserve for things like a genuinely separate embedded card, e.g. a linked
external record).

### Per-screen card budget
No screen may render more than **6 Tier-1 surfaces** in its first two scroll-heights.
Beyond that, additional content is Layer 6 (Expanded Detail, V1 §11) and belongs behind
a drawer, not a 7th–33rd stacked panel. Apex's 33 panels and Training's 53 do not
represent 33–53 ideas — the audit shows most are Tier 2/3 content wrongly promoted to
Tier 1. Applying the tier system alone should collapse Apex toward 6–8 real surfaces.

### The drawer rule
Layer 6 content (settings, libraries, full history, editors) never renders as a
same-weight card in the primary scroll. It lives behind one clearly-labeled affordance
("Manage Preferences," "View Full Library") that opens a sheet/drawer. Nutrition's Diet
Style + Personalization section (V1 audit finding) is the clearest candidate: it moves
behind "Fuel Preferences" as a drawer, not a 250-line mid-scroll section.

---

## PROPOSED SECTION 18 — COLOR HIERARCHY

### The problem this fixes
V1 §09 assigns a "color lead" per environment but nothing enforces it — every audited
screen uses the full gold/green/steel/violet/amber palette regardless of assignment.
Recovery, explicitly reserved for "steel → violet, lowest light," was the single worst
offender in the audit (5 hues in one screenshot).

### The rule: One Dominant + One Accent, hard ceiling
Each screen gets exactly two colors from the palette: one **dominant** (the hero,
primary metric, primary CTA) and one **accent** (used sparingly for a single secondary
signal). No third palette color may appear in the first two scroll-heights except a
**signal color** (amber/red), and only when representing a genuine risk state — never
decoratively.

| Screen | Dominant | Accent | Signal use only |
|---|---|---|---|
| **Apex** | Gold | Steel | Amber (schedule/recovery risk), Red (none by default) |
| **Training** | Gold | Steel | Amber (readiness caution) |
| **Nutrition** | Green | Gold | Amber (behind-pace only) |
| **Recovery** | Steel | Violet | Amber/Red (genuine debt/compromise only — never decorative dials) |
| **Physique** | Steel | Ivory (neutral, near-white) | none — Physique is documentation, not alert-driven (V1 §02) |
| **Schedule** | Gold | Slate | Amber (real sleep compression only, never a full red-tinted panel for mild cases per audit finding) |

This table is the direct fix for Recovery's and Physique's audit findings: Recovery
drops green and amber-as-default entirely (green was being used for "positive," which
V1 never actually assigned to Recovery); Physique drops its 4-color stat grid down to
steel+ivory, which also reinforces the "documentation, not judgment" tone since ivory
carries no evaluative charge the way green/red do.

### Signal-color discipline
Amber and red are reserved for the Bible's own existing rule (V1 §09: "red exists only
as a signal color, never as weather") — this proposal extends that same discipline to
amber. A panel may not be amber-tinted for a mild/cosmetic state (Schedule's Recovery
Window finding); tint intensity should scale with actual severity, and low-severity
states use the screen's own dominant/accent pair, not a signal color.

---

## PROPOSED SECTION 19 — DEPTH LAYERS & ENVIRONMENT TRANSITIONS

### What V1 already has (kept, not replaced)
The five-layer depth stack (V1 §06: Ambient environment → Dynamic lighting → Glass
surfaces → Content → Live intelligence) is sound and stays exactly as specified.

### What's missing: transitions between environments
V1 §09 describes each environment as a fixed "weather" state but never specifies what
happens *between* them — neither screen-to-screen navigation nor in-screen state changes
(Training's Pre-Session → Live is the clearest audit finding: five session states
currently look identical because nothing animates the environment itself).

### The rule
1. **Screen-to-screen navigation:** Layers 1–2 (ambient environment, dynamic lighting)
   cross-fade to the destination screen's dominant/accent pair (Section 18) over
   400–600ms. Layers 3–5 (glass, content, live intelligence) may cut instantly — only
   the *atmosphere* transitions smoothly, not the content, keeping navigation feeling
   responsive rather than sluggish.
2. **In-screen state changes are scene changes, not card swaps.** When Training moves
   Pre-Session → Live, or Recovery's reserve crosses a threshold band, Layers 1–2 shift
   energy/tint over 800ms (matching V1 §08's existing "state-driven energy" rule, now
   explicitly extended to cover discrete state transitions, not just continuous
   readiness values). Training Live should read as "the spotlight tightened and the
   edges went dark," not "a new card appeared below."
3. **Entering the calmest screens dims, it doesn't cut.** Entering Recovery: energy and
   light step down over ≥800ms even coming from a high-energy screen like Training Live.
   Entering Physique: light goes flat and neutral (studio, not mission-control) over the
   same window. This formalizes V1 §02's emotional-arc table into an actual motion spec.

---

## PROPOSED SECTION 20 — THE FIREFLY ASSET SYSTEM

### What this is
V1 §10 (Image Direction Bible) already specifies the *rules* imagery must follow
(single-source low-key lighting, lifted blacks toward `#07080c`, generous negative
space, "would this hang in an Aman lobby") but never specified *what to actually
generate* or *how assets are organized once made*. A prior session staged an asset
folder taxonomy (`public/brand/{backgrounds,cores,gradients,icons,particles,textures}`)
that was never populated — this section adopts and formalizes that taxonomy rather than
inventing a new one, and the concrete generation list lives in the companion
`docs/RESERVE_FIREFLY_ASSET_ROADMAP.md`.

### The six asset categories
| Category | Folder | What lives here | Generation method |
|---|---|---|---|
| **Backgrounds** | `public/brand/backgrounds/` | Full-bleed environmental scenes per V1 §10.1 (empty gyms at dawn, lab glass, cockpit detail) — used behind Layer 1 on hero-heavy screens | Firefly (or equivalent) generative image |
| **Cores** | `public/brand/cores/` | The bespoke centerpiece object per hero archetype (Section 16) — Apex's Performance Core, a future Training HUD emblem, a Physique studio frame motif | Firefly generative + hand-graded |
| **Gradients** | `public/brand/gradients/` | Pre-graded light-field abstracts (V1 §10.3 "hero abstract") matching each screen's dominant/accent pair (Section 18) — replaces CSS-only radial-gradient approximations where a real generated light field reads richer | Firefly generative light field |
| **Icons** | `public/brand/icons/` | Bespoke line-icon set matching the jewelry/whisper type system — NOT a swap for Lucide (functional icons stay Lucide); reserved for brand moments (empty states, onboarding, the Reserve mark itself) | Vector, hand or AI-assisted |
| **Particles** | `public/brand/particles/` | Ambient dust/ember/light-mote sprite sheets for Layer 2 dynamic lighting on hero surfaces, replacing pure-CSS orb drift with actual graded particulate texture | Firefly generative + compositing |
| **Textures** | `public/brand/textures/` | Macro material textures (V1 §10.2: brushed metal, smoked glass, carbon weave, dark stone) as subtle overlay layers on Tier-1 surfaces (Section 17) for screens that want material richness (Training's cockpit, Physique's studio) | Firefly generative texture |

### Generation guardrails (extends V1 §10, does not replace it)
- Every asset is graded to the same black point (`#07080c` lifted blacks) before it
  enters the folder — no asset ships at its raw generated grade.
- Every asset is tagged in its filename with the screen/archetype it belongs to and its
  dominant color (Section 18), e.g. `apex-core-gold-steel-v1.webp`, so the component
  layer can select the right asset without a lookup table drifting out of sync.
- No asset ships without a `.env`-free plain public path and a fallback CSS-only
  treatment — the app must never hard-depend on an asset existing (matches the
  "graceful when signals are missing" discipline already standard across the codebase's
  engines).
- WebP first, PNG fallback only where transparency + wide compatibility is required.

---

## PROPOSED SECTION 21 — REUSABLE PREMIUM COMPONENT CATALOG

### The problem this fixes
V1 names `GlassPanel` as "the only surface primitive" but the codebase has since grown
several more shared primitives (`ReserveGlassCard`, `ReserveCommandHeader`,
`ReserveStatusPill`, `ReserveMetricCluster`, `ReserveAmbientGlow`,
`ReservePerformanceCore`, `ReserveHeroBackground`) with no formal catalog — new
screens either rediscover these by grepping or reinvent them locally (part of why
Nutrition has four different macro-display treatments instead of one shared one).

### The catalog (existing primitives, formally adopted)
| Component | File | Contract |
|---|---|---|
| `GlassPanel` | `components/ui/GlassPanel.tsx` | The one Tier-1 surface primitive (V1 §06, unchanged) |
| `ReserveGlassCard` | `components/reserve/ReserveGlassCard.tsx` | Thin named-tone wrapper over GlassPanel |
| `ReserveCommandHeader` | `components/reserve/ReserveCommandHeader.tsx` | Icon + whisper-label section header |
| `ReserveStatusPill` | `components/reserve/ReserveStatusPill.tsx` | The one status-chip primitive — every "Watch/Protected/Behind/Log Only" badge in the app must use this, not a bespoke span |
| `ReserveMetricCluster` | `components/reserve/ReserveMetricCluster.tsx` | Tile or row metric layout — already supports the Tier-2 "no extra border" pattern (Section 17) via its `rows` variant |
| `ReserveAmbientGlow` | `components/reserve/ReserveAmbientGlow.tsx` | Layer 2 decorative glow |
| `ReservePerformanceCore` | `components/reserve/ReservePerformanceCore.tsx` | Apex's specific Statement-Hero supporting visual (Section 16) — screen-specific, not reused elsewhere by design |
| `ReserveHeroBackground` | `components/reserve/ReserveHeroBackground.tsx` | Layer 1 ambient environment |

### New primitives this proposal requires
| Component | Purpose | Enforces |
|---|---|---|
| **`HeroShell`** | Wraps every screen's hero per Section 16 — takes an `archetype` prop (statement/cockpit/kitchen/dial/studio/timeline) and enforces the height budget + "one metric or one CTA at max weight" rule at the component level, not by convention | Section 16 |
| **`TierGroup`** | Replaces ad-hoc `rounded-xl border` inner divs with a Tier-2 grouping primitive: spacing + hairline divider, no border/background by default | Section 17 |
| **`DrawerSheet`** | The one Layer-6 affordance — settings, libraries, and full history open here, never as a same-weight scroll card | Section 17 |
| **`JewelryNumeral`** | Formalizes V1 §03's `.type-jewel` pattern as an actual component (whisper label above, big numeral, command line below) so every screen's primary metric — Apex's readiness, Recovery's reserve, Physique's momentum — looks identically premium even though the surrounding hero *shape* differs per archetype | Section 16, V1 §03 |
| **`ScreenColorProvider`** | A context/hook that resolves a screen's dominant+accent pair from the Section 18 table, so components never hardcode `C.GOLD`/`C.VIOLET` locally and drift out of sync with the assignment table | Section 18 |

---

## What happens on approval

1. Sections 16–21 above get copy-edited into `DESIGN_BIBLE.md` as a versioned V2 edit
   (new sections appended after current §15, renumbered if needed).
2. `docs/RESERVE_FIREFLY_ASSET_ROADMAP.md` (companion doc) lists the concrete asset
   generation queue against the Section 20 taxonomy.
3. `docs/RESERVE_REDESIGN_STRATEGY.md` (companion doc) applies Sections 16–19 to each of
   the six screens as a concrete, screen-by-screen plan — still no React, per the
   standing instruction for this phase.
4. Implementation proceeds in batches only after this document and its two companions
   are reviewed and approved.
