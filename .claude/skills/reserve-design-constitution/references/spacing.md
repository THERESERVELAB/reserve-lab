# Spacing — override map

**Owned by:** `DESIGN_BIBLE.md` Section 07.

## Philosophy

Cheap products show everything at once. Premium products reveal what matters. Space is not
emptiness — it is the price of focus, paid gladly.

## Rules

1. **One dominant element per viewport-height of content:** one statement, one key metric,
   one next action, one risk signal. Everything else is secondary and lives below.
2. **Vertical rhythm:** sections separate by `gap-4` mobile / `gap-5–7` desktop. Inside a
   panel, blocks step `mt-2 → mt-3.5 → mt-5`. **Never uniform spacing** — rhythm implies
   hierarchy, and uniform gaps flatten it.
3. **Breathing room scales with importance.** Heroes get `mt-5` clearance minimum; whispers
   may sit `mt-0.5` from their content.
4. **Density floors:** rows never tighter than `py-2`; chips never tighter than
   `px-1.5 py-0.5`. Tight is premium; cramped is cheap.
5. **Mobile gutters are 12px (`px-3`)** so panels read as part of the display rather than
   boxes on a page.
6. **The 30–40% rule applies to layout.** When a section feels crowded, remove blocks
   before shrinking them.

## Overrides against external skills

- **`mobile-app-ui-design`** prescribes a generic 4/8pt spacing scale and consumer-app
  gutters (commonly 16–20px). Reserve's 12px gutter is a rimless-surface decision (Bible 06)
  and wins.
- **`designer-design-tokens`** will offer to generate a spacing scale. Reserve's spacing
  lives in Tailwind's scale as used by the shipped components. Do not emit a parallel scale.
- Any skill recommending "consistent spacing between all sections" is recommending uniform
  rhythm. That is rule 2's exact failure mode. Reject it.
