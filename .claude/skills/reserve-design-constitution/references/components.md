# Components — override map

**Owned by:** `DESIGN_BIBLE.md` Section 06 (Rimless iOS) and Section 11 (Component Hierarchy).

## The surface contract

**`src/components/ui/GlassPanel.tsx` is the only surface primitive.** Its rimless contract:

- `rounded-[22px]` — approximates hardware display curvature
- border `white/0.04` — near-invisible
- inset ring `0.022`
- separation via top-edge light + `0 32px 100px rgba(0,0,0,0.4)` ambient shadow
- blur 20px, saturate 120%

Do not hand-roll a panel, card, or surface. If a new surface behavior is needed, extend
GlassPanel.

## Rules

1. **Kill the box effect.** Never card-inside-card-inside-card. **Maximum two visible
   surface levels:** the environment, and one glass layer. Inner groupings separate with
   light (hairline gradients, spacing) — not drawn borders.
2. **Edges belong to the environment.** Ambient glows and sweeps may bleed past content;
   content respects safe areas (`.safe-top` / `.safe-bottom` / `.safe-x`).
3. **Gradients are never trapped.** A glow visibly clipped by its own card boundary is a
   defect. Backdrops live at the panel level and feather to transparency.
4. **Liquid over rigid.** Soft gradients, atmospheric separation, light and depth hierarchy.
   Forbidden: heavy outlines, hard edges, sharp separations, table borders.
5. **Only navigable elements look interactive.** Display-only chips render as `<span>`.
   Disabled actions carry a `title` explaining why. No fake buttons, no dead CTAs.
6. **The gold CTA is scarce.** One primary action per screen (hierarchy layer 3).
   `.fba-cta-sheen` is permitted on high-value gold actions only, never on secondary buttons.

## The depth stack

Layer 1 ambient environment (`AnimatedBackground`, `fba-ambient-a/b`) → Layer 2 dynamic
lighting (`fba-aurora`, `fba-sweep`, `fba-breath`) → Layer 3 glass surfaces → Layer 4
content (type + jewelry numerals) → Layer 5 live intelligence (pulses, due-now glows).

Each layer may move independently. No layer may move fast.

## Reuse before invention

The most common way a model degrades this codebase is hand-rolling what already exists.
Before building anything, search for the existing component. Reserve already ships:
GlassPanel, the `.type-*` ramp, the `.fba-*` motion utilities, status chip patterns, the
Next Move panel, hero metric tiles, and the week rail.

A bespoke `<div onClick>` beside the project's real button is a defect, not a shortcut.

## Overrides against external skills

- **`interface-design`'s "system → component → token → utility"** ordering matches Reserve's
  reuse rule exactly. Follow it. Its `.interface-design/system.md` memory file is optional;
  if created, it is a **note about** the Bible, never a competing source of truth.
- **`mobile-app-ui-design`** will propose bottom tab bars, FABs, and card-based feeds from
  consumer apps. Reserve's navigation and surfaces already exist; take its touch-target and
  safe-area mechanics only.
- **`designer-frontend-design`** generates components from named aesthetic philosophies
  (Scandinavian, Japanese magazine, Dieter Rams). Reserve's philosophy is already named and
  shipped. Ignore the philosophy-selection step; keep the implementation craft.
- **The No-Website Rule (Bible 06):** if a screen could be screenshotted and mistaken for a
  SaaS dashboard, a data portal, or a spreadsheet, it fails review. Cover the logo — is this
  obviously Reserve?
