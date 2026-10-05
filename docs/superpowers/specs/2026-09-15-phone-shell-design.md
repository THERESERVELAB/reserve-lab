# Phone Shell & Rooms Design (owner-approved 2026-09-15)

Owner brief: "Make the phone a lot more seamless — it looks clunky on phone."
Approach chosen: **Native phone shell**, delivered as two PRs built in parallel.
Scope: viewports below 768px. Desktop and tablet stay as they are.

## Evidence
- The shell root is `h-screen overflow-hidden` and `<main>` is `overflow-y-auto`. Every phone page reports a document height of 844, so the URL bar never collapses and scrolling is trapped in a box.
- There is no `-webkit-tap-highlight-color` reset, so every tap flashes grey.
- Card-in-card appears 254 times across 74 files (constitution `components.md` rule 1). Training has ~93 nested panels on phone.
- The TopBar label map misses about 20 views and prints raw ids ("SCHEDULE-COMMAND"). The label wraps to two lines, and the avatar is clipped at 390px.
- The only way between rooms is a 15-item hamburger drawer.
- Each room shows two big headlines on phone: the page title, then the hero statement.
- There are five near-duplicate horizon strips, already drifting.
- The sheet grab handle is decorative (no drag). `<details>` snaps open. `scroll-behavior` is inert on `<main>`.

## PR 1 — Phone shell (`claude/phone-shell`)
1. **Scrolling.** Below 768px the document scrolls; the shell uses `min-h-dvh` with no inner scroll box. Desktop keeps `h-dvh` plus inner scroll. Everything that listened to `<main>` scrolling is migrated to the phone scroller:
   - AnimatedBackground depth drift
   - scroll-to anchors (e.g. `schedule-times-anchor`)
   - IntersectionObserver roots
   - sticky elements
   - the docked `ReserveActionBar`

   Smooth scrolling is on, except under reduced motion.
2. **Top bar.**
   - 48px plus the top safe area, sticky, with a solid (not heavy blur) ground.
   - One line, truncated. The label comes from the module registry, so no view can render a raw id.
   - A compact room title fades in once the page h1 scrolls out of view.
   - The right side holds the avatar only. Sync status, the motion pause, and Coach switching move to More.
3. **Bottom tab bar.**
   - Tabs: Apex · Training · Fuel · Recovery · Schedule · More.
   - Height 56px plus the bottom safe area, with a gold active marker and 44px+ targets.
   - `ReserveActionBar` docks above it.
   - It hides while a bottom sheet or drawer is open, and never covers a sheet.
4. **More sheet.** A bottom sheet holding:
   - every other destination (same registry and tier gating as the Sidebar)
   - Coach switch
   - sync status
   - the motion pause (it must stay reachable — WCAG 2.2.2)
5. **Touch polish.**
   - Global `-webkit-tap-highlight-color: transparent`, with Reserve's own `:active` pressed state instead.
   - `ReserveBottomSheet` drags to dismiss from the handle, or offers no handle.
   - `ReserveDisclosure` animates open and close (instant under reduced motion).
   - Inputs are ≥16px on phone.
6. **Room switch.** Content cross-fades in about 240ms and the new room lands at the top. The background plate keeps its existing ≥1s cross-fade.

## PR 2 — Rooms on phone (`claude/phone-rooms`)
1. **One headline per room on phone.** The page header (eyebrow + "X Command" + subtitle) collapses to a small title line. The hero statement is the visual headline. Semantics stay intact: exactly one h1, which may remain the room name, styled small.
2. **No card-in-card in the five rooms on phone.**
   - The hero and below-fold sections of Apex, Training, Nutrition, Recovery and Schedule render as full-width sections separated by hairlines and stepped spacing.
   - Nested bordered tiles become rows.
   - Desktop keeps its glass panels.
3. **One horizon component.** A shared `ReserveHorizon` (track + phone spine list + item sheet) is configured per room with lane data. The five room strips migrate to it with no visual regression on desktop or phone.

## Testing
- New `tests/e2e/phone-shell.spec.ts` at 390×844 (touch) checks:
  - document scrollHeight > viewport, and `window.scrollY` changes on scroll
  - the tab bar navigates between all five rooms, marking the active tab with `aria-current`
  - the top bar is a single line (≤ 48px plus safe area) with no raw ids
  - computed tap-highlight is transparent
  - More opens a sheet containing the motion pause
  - a sheet closes when dragged down
  - no horizontal overflow
- All five room specs, `apex-pit-wall` and `reserve-entry` still pass.
- Desktop 1440×1000 screenshots before and after show no change to the shell.

## Out of scope
- Horizontal swipe between rooms and pull-to-refresh (rejected "Full app feel").
- 9:16 phone plates and loops: project 2, done separately with Adobe/Firefly.
- De-boxing screens outside the five rooms.
