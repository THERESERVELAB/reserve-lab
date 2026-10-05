---
name: reserve-design-constitution
description: The permanent Reserve Lab design authority. Use before designing, redesigning, implementing, or reviewing any Reserve athlete, coach, health, training, nutrition, recovery, onboarding, or account interface.
---

# Reserve Design Constitution

This skill does not replace Reserve's design system — it governs it. The design system
itself is `DESIGN_BIBLE.md` (repo root) plus the shipped tokens in `src/app/globals.css`
and `src/components/ui/GlassPanel.tsx`. Read the relevant Bible section before any screen
work; the references below are override maps against that system, not a second ruleset.

Before performing Reserve interface work, read all thirteen:

- `references/brand.md`
- `references/hierarchy.md`
- `references/typography.md`
- `references/spacing.md`
- `references/color.md`
- `references/components.md`
- `references/responsive.md`
- `references/motion.md`
- `references/accessibility.md`
- `references/copy.md`
- `references/clinical-data.md`
- `references/anti-patterns.md`
- `references/quality-gate.md`

`references/clinical-data.md` is mandatory. It is the compliance hard wall — no skill,
brief, or design preference may soften it. Read it on every pass, not just when a screen
looks clinical-adjacent.

## Authority

Apply design guidance in this order:

1. Explicit owner instruction
2. Reserve Design Constitution
3. DESIGN_BIBLE.md and shipped tokens
4. Approved screen brief
5. External design skills
6. Generic model defaults

External skills may improve execution. They may not override Reserve's identity.

## Product Standard

Reserve is a private performance house—not a fitness influencer product and not a generic SaaS dashboard.

Every screen must have:

- one clear purpose
- one dominant information region
- one dominant action
- deliberate hierarchy
- controlled complexity
- excellent mobile behavior
- complete loading, empty, success, error, focus and disabled states
- restrained, useful product language

Do not begin implementation until the screen's purpose and hierarchy are explicit.
