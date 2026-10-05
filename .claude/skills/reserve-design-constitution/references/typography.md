# Typography — override map

**Owned by:** `DESIGN_BIBLE.md` Section 03. Tokens ship in `src/app/globals.css`.

## The shipped classes — use these, do not invent

| Class | Role |
|---|---|
| `.type-hero` / `.type-hero-xl` | The statement. `--font-display` (Inter Tight 900), uppercase, `letter-spacing: -0.025em`, `line-height: 0.92`. `clamp(34px, 5vw, 64px)` / `clamp(42px, 7vw, 96px)` |
| `.type-command` | The decision. 13px / 1.55, ivory at 78%, weight 500 |
| `.type-whisper` | The system label. `--font-geist-mono`, 7–9px, uppercase, tracking 0.2–0.3em, white ~38% |
| `.type-jewel` | Jewelry numerals. `clamp(44px, 6vw, 84px)`, weight 900, tabular-nums, tracking `-0.03em`, soft gold shadow |
| `.type-display-xl` `.type-display` `.type-page-title` `.type-section-title` `.type-card-title` `.type-eyebrow` `.type-body` `.type-supporting` `.type-metric-xl` `.type-metric` | The rest of the shipped ramp |
| `.tnum` | Tabular numerals — mandatory on every timestamp and counter |

**Canonical vertical stack: WHISPER → HERO → COMMAND.** Never Command above Hero.

## Forbidden

- Paragraphs longer than two lines anywhere above the fold.
- Mixed-case mono labels.
- Tracked uppercase above 13px — it reads as shouting.
- More than three font sizes inside one card.
- Bold-everything. If everything is bold, nothing is.
- A second hero on the same screen.

## How typography creates luxury here

Few sizes, few weights. Generous tracking on tiny labels, tight tracking on huge statements.
Tabular numerals everywhere numbers align. Silence between blocks. Luxury type is the
absence of competition.

## Overrides against external skills

`typography-audit` ships 78 rules across 10 categories. Most are compatible and valuable —
run it. These specific rules are **overridden by the Bible** and must not be "fixed":

- **Uppercase letter-spacing / all-caps body rules.** Reserve's whisper label is
  intentionally 7–9px uppercase mono at 0.2–0.3em tracking. That is the brand's luxury
  labeling layer, not a violation. Only flag tracked uppercase **above 13px**.
- **"Identifiable body typeface" / brand-typeface rules.** Reserve is locked to Inter Tight
  (display) + Geist Sans (body) + Geist Mono (labels). Do not propose typeface changes;
  a typeface change is a versioned Bible edit.
- **Readable-scale minimums.** Reserve's whisper labels and 10.5–12px system text sit below
  common minimums by design. Judge them against Bible 03, not a generic floor. Do **not**
  apply this exemption to body copy the member must actually read, or to form inputs —
  see `accessibility.md` for the 16px mobile input floor, which is not negotiable.
- **Light/dark pairing rules** assume a light mode exists. Reserve is dark-only.
- **Smart quotes, dashes, primes, tabular figures, widows/orphans, measure and leading**
  — fully in force. These are exactly the details that separate Reserve from a template.
