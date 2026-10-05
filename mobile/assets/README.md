# mobile/assets — app icon and splash sources

`npx cap-assets generate` reads this directory and writes every icon and
splash density into `android/` and `ios/`. It is wired up as `npm run
mobile:assets`.

**The sources exist and are generated, not drawn by hand.**
`scripts/generate-mobile-assets.mjs` writes all five from geometry — run
`npm run mobile:icon`, then `npm run mobile:assets` to fan them out.

The mark is a geometric R: a stem, a bowl and a leg, built from stroked
paths rather than typeset, so it carries no font dependency. Terminals are
FLAT and joins mitred — rounded caps made the same skeleton read as a
generic bold app icon; flat cuts read as an instrument, which is the brand. librsvg inside
sharp would silently fall back to Arial if it were text, and the icon would
then differ depending on which machine rendered it. Colour is the product's
own — base `#07080c` with the gold ramp `#d5b15f` -> `#e8c87a`.

> This mark is a PROPOSAL, not an approved identity. Reserve still has no
> brand mark of record. Neither store lets an icon change without a review,
> so replace it before submission if a designed mark is coming.

The generated PNGs are committed alongside the script: the build must not
depend on anyone having run it.

## What `cap-assets` needs

| File | Size | Notes |
|---|---|---|
| `icon.png` | 1024 × 1024 | No transparency, no rounded corners, no alpha channel. Apple rejects icons with alpha. iOS masks the corners itself. |
| `icon-foreground.png` | 1024 × 1024 | Android adaptive icon foreground, transparent. Keep the mark inside the centre 66% — Android crops to circle, squircle and other masks per launcher. |
| `icon-background.png` | 1024 × 1024 | Android adaptive icon background. A flat `#07080c` field matches the product surface. |
| `splash.png` | 2732 × 2732 | Centred mark on `#07080c`. Cropped to every device aspect, so nothing important may sit outside the centre square. |
| `splash-dark.png` | 2732 × 2732 | Reserve is dark-only, so this is normally identical to `splash.png`. |

## Constraints that come from the stores, not from taste

- **No text that reads as a claim.** The icon and splash ship inside the
  signed binary and appear in store listings. Reserve's compliance rules
  (CLAUDE.md) apply to them exactly as they apply to any other surface: no
  medical claims, no compound names, no guaranteed-results language.
- **No real athlete, coach or federation likeness** — the same rule the
  product UI follows.
- **The icon cannot be changed without a store review.** Both stores treat
  it as part of the build.

## Once the sources land

```bash
npm run mobile:assets
```

Then commit the generated `android/app/src/main/res/**` and
`ios/App/App/Assets.xcassets/**` — they are part of the versioned native
projects.
