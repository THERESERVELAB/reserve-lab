# Color — override map

**Owned by:** `DESIGN_BIBLE.md` Section 09 (Environment System).

## The palette — complete and closed

| Token | Value | Role |
|---|---|---|
| base | `#07080c` (`--background`) | The environment. Also `themeColor`. |
| foreground | `#ece8df` (`--foreground`) | Ivory text |
| gold | `#d5b15f` (`--gold`) | Primary accent, high-value actions, Apex light |
| amber | `#e8c87a` | Gradient partner to gold; Reserve Black identity |
| steel | `#5fb7d5` (`--teal`) | Laboratory, bloodwork, recovery |
| green | `#6ee7b7` | Fuel, secured states |
| violet | `#a78bfa` | Evening, sleep, dusk |
| slate | `#8ea0b8` | Neutral supporting signal |
| red | `#ef7d55` | **Alerts only.** Never used as weather, never as a surface tint. |

Surfaces: `--card-bg: #0d0e14`, `--sidebar-bg: #08090e`.

**This palette is closed.** Adding a hue is a versioned Bible edit, not a screen decision.

## Rules

- **Color leads environment, not decoration.** Each destination has a color lead (Bible 09
  table): Apex gold · Training gold+steel · Recovery/Sleep steel→violet · Nutrition
  green+gold · Bloodwork steel · Community low gold.
- **Environment changes are felt, not announced** — opacity/tint shifts over ≥1s. Never a
  hard background swap.
- **Text opacity is the hierarchy tool**, not hue: ivory 78% for command, white 40–70% for
  system text, white ~38% for whisper.
- **Red is a signal, never a mood.** No red walls, no red-tinted panels, no alarm framing.
  Bloodwork's emotional ceiling is "organized and ready for my clinician" (Bible 02).
- Borders are near-invisible (`white/0.04`). Separation comes from light, not lines.

## Overrides against external skills

- **Rainbow status colors are an anti-pattern here.** Severity uses low/moderate/high chips
  within the closed palette. Any skill proposing a green/yellow/orange/red status spectrum
  is proposing a dashboard. Reject it.
- **`designer-design-tokens`** generates light + dark palettes. Reserve is dark-only.
  Never emit a light palette or a `prefers-color-scheme: light` branch.
- **`interface-design`** advocates semantic token names over `--gray-700`-style names.
  Reserve agrees, and already complies. Do not rename shipped tokens to satisfy a
  suggestion; extend with the same naming spirit.
- **Contrast tooling** may flag whisper text (white ~38% on `#07080c`) and other decorative
  low-opacity labels. See `accessibility.md`: decorative labels are exempt from the AA
  contrast floor **only** when the same information is carried by an adjacent element that
  meets it. Content the member must read is never exempt.
