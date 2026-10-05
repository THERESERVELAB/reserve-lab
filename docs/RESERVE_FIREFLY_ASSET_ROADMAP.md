# RESERVE FIREFLY ASSET ROADMAP

Companion to `docs/RESERVE_DESIGN_BIBLE_V2_PROPOSAL.md` Section 20 (The Firefly Asset
System). This is the concrete generation queue: every bespoke visual asset to create
before the screen-by-screen redesign begins, organized by the six asset categories and
prioritized by what blocks the redesign vs. what polishes it after.

All assets follow V1 Bible §10 (Image Direction Bible) without exception: single-source
low-key lighting, blacks lifted toward `#07080c`, one accent hue per asset (from the
Section 18 dominant/accent table), generous negative space, subject ≤40% of frame, no
stock fitness photography, no influencer aesthetic. The test stays: *would this hang in
an Aman lobby?*

Filename convention: `{screen-or-scope}-{category}-{descriptor}-{colors}-v1.webp`.

---

## PRIORITY TIERS

- **P0 — Blocks the redesign.** Without these, Section 16 hero archetypes can't be built
  as designed (e.g. Physique's Studio Hero needs a real frame treatment, not a
  placeholder div).
- **P1 — Per-screen, built alongside that screen's redesign batch.**
- **P2 — Polish pass, after all six screens ship their redesign.**

---

## P0 — FOUNDATION (build before any screen redesign starts)

| Asset | Category | Scope | Brief |
|---|---|---|---|
| `reserve-gradient-gold-steel-v1` | Gradients | Apex, Training | The Statement/Cockpit hero light field — champagne-gold key light from screen-left, steel fill, matches current CSS aurora but as a real generated light field for richer depth |
| `reserve-gradient-steel-violet-v1` | Gradients | Recovery | Dim regeneration light field — the one asset that must read as visibly *darker* and *cooler* than every other gradient in the set, proving the "lowest light in the product" rule at a glance |
| `reserve-gradient-green-gold-v1` | Gradients | Nutrition | Warm hearth light field — the asset most responsible for fixing the audit finding that Nutrition "reads clinical, not warm" |
| `reserve-gradient-steel-ivory-v1` | Gradients | Physique | Neutral studio light field — flat, even, documentary — deliberately the least dramatic gradient in the set (Physique is evidence, not mission control) |
| `reserve-gradient-gold-slate-v1` | Gradients | Schedule | Low-contrast operational light field — quiet, background-only, never competes with the timeline spine |
| `reserve-particles-ember-gold-v1` | Particles | Apex, Training | Slow-drifting light-mote sprite sheet, gold-graded, replaces the CSS `fba-ambient` orbs on hero-heavy screens |
| `reserve-particles-dust-steel-v1` | Particles | Recovery | Slower, sparser, cooler-graded variant — motion must read at half the perceived speed of the Apex/Training set (breath-band only, V1 §08) |
| `reserve-texture-carbon-dark-v1` | Textures | Training | Subtle carbon-weave overlay for the Cockpit Hero HUD strip — the one texture asset that gives Training a "hardware," not "app," feel |
| `reserve-texture-smoked-glass-v1` | Textures | Apex, global | Default Tier-1 surface texture overlay — extremely subtle, applied at ~4% opacity across `GlassPanel` globally once approved |

---

## P0 — CORE OBJECTS (one bespoke centerpiece per hero archetype, Section 16)

| Asset | Category | Scope | Brief |
|---|---|---|---|
| `apex-core-orb-gold-v2` | Cores | Apex | Refined replacement for the current CSS-only Performance Core — a real generated/graded 3D-style object, gold-steel, five system nodes, must survive being screenshotted and read as unmistakably Reserve with the logo covered (V1 §06 "No-Website Rule" test) |
| `training-core-hud-gold-v1` | Cores | Training | The Cockpit Hero's instrument-strip emblem — a small graded object/mark (not a full illustration) anchoring the HUD strip, evokes F1 telemetry per V1 §01 positioning |
| `nutrition-core-plate-green-v1` | Cores | Nutrition | The Kitchen Hero's "plate" visual — a graded abstract composition (not literal food photography) suggesting a plated meal through light and material, matching V1 §10's "no stock food photography" spirit |
| `recovery-core-dial-steel-v1` | Cores | Recovery | A refined dial-face texture/bezel treatment behind the existing numeral — elevates the current flat SVG ring into a graded instrument face |
| `physique-core-frame-ivory-v1` | Cores | Physique | The Studio Hero's evidence-frame motif — a subtle frame/vignette treatment for the photo-led hero, neutral-graded, must never compete with the member's own photo |
| `schedule-core-spine-gold-v1` | Cores | Schedule | The Timeline Hero's horizon-line treatment — a graded gradient spine with a live now-marker glow point |

---

## P1 — PER-SCREEN BACKGROUNDS (built with each screen's redesign batch)

| Asset | Category | Scope | Brief |
|---|---|---|---|
| `apex-bg-command-center-gold-v1` | Backgrounds | Apex | "Apex Command Center" — architecture of performance: an empty private command room at dawn, cockpit-glass reflections, per V1 §10.1 environmental category |
| `training-bg-performance-lab-steel-v1` | Backgrounds | Training | "Training Performance Lab" — dark equipment silhouettes, single hard key light, evokes a private gym at 5am, never a populated/stock gym photo |
| `recovery-bg-suite-violet-v1` | Backgrounds | Recovery | "Recovery Suite" — the dimmest background in the set; dark water or steam-glass texture, steel-to-violet grade, must read as calm even at full brightness |
| `nutrition-bg-kitchen-green-v1` | Backgrounds | Nutrition | "Performance Kitchen" — material macro shot (stone counter, warm task light) with zero literal food, matching the "material" category of V1 §10.2 |
| `physique-bg-studio-ivory-v1` | Backgrounds | Physique | "Physique Studio" — neutral seamless-backdrop lighting setup, the photographic-studio reference itself, no human figure |
| `community-bg-lounge-gold-v1` | Backgrounds | Community (V1 §02 "private club lounge") | "Reserve Lounge" — warm low lounge lighting, leather/wood material cues, private-club atmosphere per V1's Community emotional target |

---

## P1 — GLASS & LIGHT PRIMITIVES

| Asset | Category | Scope | Brief |
|---|---|---|---|
| `global-glass-edge-highlight-v1` | Gradients | Global (`GlassPanel`) | A generated top-edge light sweep to replace/enrich the current CSS-only highlight — subtle, must not fight content |
| `global-light-sweep-gold-v1` | Particles/Gradients | Global CTA sheen | Refined light-pass texture for `fba-cta-sheen`, gold-graded, one asset reused everywhere the Bible allows CTA sheen (V1 §08 — gold CTAs only) |
| `global-ambient-overlay-noise-v1` | Textures | Global | Ultra-fine film-grain/noise overlay at ~2% opacity — the single asset most responsible for killing the "flat CSS gradient" look across every screen at once |
| `bloodwork-bg-laboratory-steel-v1` | Backgrounds | Bloodwork/Biomarkers (V1 §02) | "Private laboratory" — cool rim-lit glass and steel, precise and clinical-adjacent without ever looking like a hospital |

---

## P2 — TRANSITION & POLISH ASSETS (after all six redesigns ship)

| Asset | Category | Scope | Brief |
|---|---|---|---|
| `global-transition-crossfade-luts` | Gradients | Global (Section 19 environment transitions) | A small set of graded LUT-style overlays used during the 400–600ms screen-to-screen cross-fade so the transition itself feels graded, not just opacity-blended |
| `apex-icons-brand-mark-set-v1` | Icons | Global brand moments | Bespoke line-icon set for empty states, onboarding, and the Reserve mark — explicitly NOT a replacement for Lucide functional icons (V1 §20 rule) |
| `reserve-black-core-amber-v1` | Cores | Reserve Black identity (V1 §14) | A deeper, richer variant of the Apex core for Reserve Black members — "more light discipline, not louder," per V1 §14's differentiation rule |
| `sleep-bg-dusk-violet-v1` | Backgrounds | Sleep/Evening surfaces (V1 §02) | "Violet dusk, closing down" — the lowest-energy background in the entire set, reserved for true night-mode surfaces |

---

## WHAT'S DELIBERATELY NOT ON THIS LIST

- **No human photography.** V1 §10's "Human (rare)" category stays rare by design; this
  roadmap contains zero human-subject assets. If a future batch needs one, it follows
  V1 §10's rules (anonymous, silhouetted, never posing, never identifiable) and gets
  proposed separately.
- **No per-exercise or per-meal photography.** Movement posters (already shipping in
  `public/movements/`) and meal imagery are a separate content pipeline, not part of the
  environmental/brand asset system this roadmap covers.
- **No icon replacements for functional UI.** Lucide stays the functional icon library
  everywhere except the explicit brand-moment set in P2.

## Sequencing note

P0 assets are a hard dependency for the redesign strategy's Section 16 hero archetypes —
build those first, in the order listed (gradients → particles/textures → core objects),
since later screens' redesign batches assume the foundation set already exists.
