# Accessibility — override map

**Baseline:** WCAG 2.2 AA. **Reserve-specific motion rule:** `DESIGN_BIBLE.md` Section 08.

Accessibility is not in tension with Reserve's restraint — restraint is what makes it
achievable. But Reserve's dark, low-opacity, high-atmosphere language creates three real
risk areas, and they are where review effort belongs.

## Non-negotiable

1. **Reduced motion.** `globals.css` ships a global `prefers-reduced-motion: reduce` kill
   block. Every new animation must fall under it. Verify, don't assume.
2. **Keyboard operability.** Every interactive element reachable and operable by keyboard,
   in a logical focus order, with a **visible** focus indicator. Reserve's near-invisible
   borders (`white/0.04`) make weak focus rings genuinely invisible — focus styling must be
   deliberate and must not rely on the default outline against `#07080c`.
3. **Semantics first.** Real `<button>`, `<a>`, `<nav>`, `<main>`, `<h1–h6>`, `<label>`.
   ARIA is a patch for what HTML cannot express, not a substitute for it. Display-only chips
   are `<span>` — which is also the hierarchy rule (no fake buttons).
4. **Touch targets ≥ 44 × 44 CSS px**, including on the 375px floor. Reserve's density
   floors (`py-2` rows, `px-1.5 py-0.5` chips) apply to *visual* padding; the hit area may
   extend beyond the visual bounds to meet 44px.
5. **Form inputs ≥ 16px font-size on mobile** — below that, iOS zooms on focus and breaks
   the rimless illusion. This overrides the small-type license in `typography.md`.
6. **Form errors** are associated with their field (`aria-describedby`), announced, focus
   moves to the first error, and the member's entered data is never lost.
7. **Icon-only controls carry an accessible name.** Reserve uses many small mono icons.
8. **Never color alone** to convey state. Severity chips carry text; status uses the
   canonical word set (Due Now / Past Due / Completed / Skipped).

## The contrast question (read carefully)

Reserve deliberately runs low-opacity text: whisper labels at ~38% white, system text at
40–70%. A contrast checker will flag these.

**The rule:** a low-opacity label is exempt from the AA contrast floor **only when the same
information is carried by an adjacent element that meets AA.** The whisper label
`OUTPUT CAPACITY` above a full-contrast jewelry numeral is decorative reinforcement and
passes. A whisper label carrying information found nowhere else does not pass and must be
raised.

Content the member must actually read — command lines, instructions, error text, form
labels, empty-state guidance, anything actionable — meets **AA (4.5:1 body, 3:1 large)**
with no exemption.

## Overrides against external skills

- **`ui-audit`'s `rules-surface/a11y-*`, `focus-*`, and `forms-*` rules** are the operative
  checklist. Run them; they align with this file.
- **`ui-audit`'s `a11y-color-only-meaning`** is in full force and catches Reserve's most
  likely failure (gold = good, steel = neutral).
- Where an external skill's contrast rule conflicts with the exemption above, apply the
  exemption **only** with the adjacent-element justification stated explicitly in the review.
  "It's decorative" without naming the element that carries the information is not a
  justification, it is a rationalization.
- No external skill may weaken keyboard, focus, target-size, or form-error requirements.
  There is no Reserve override for those.
