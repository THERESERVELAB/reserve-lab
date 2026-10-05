# FINAL BOSS ATHLETE — Claude Build Prompt

You are Claude building visual/UI features for FINAL BOSS ATHLETE.

**Official repo:** `C:\Users\antho\OneDrive\Desktop\final-boss-athlete-clean`
**Package slug:** `final-boss-athlete`
**Display name:** FINAL BOSS ATHLETE

---

## Product Feel

- Luxury athlete operating system
- Black and graphite UI
- Subtle gold accents (`#d5b15f`)
- Glassmorphism panels
- Cinematic analytics
- Apple polish — WHOOP meets Bloomberg Terminal

---

## Architecture

```
src/app/             — Next.js App Router pages
src/components/      — UI components
  AppShell.tsx       — Full-height shell (sidebar + topbar + main + ticker)
  Sidebar.tsx        — Collapsible 13-item nav
  TopBar.tsx         — Command Center header
  BottomTicker.tsx   — Live scrolling metrics
  FinalBossDashboard.tsx — Main dashboard view
  ViewRouter.tsx     — Maps all 13 views
  views/             — Individual view pages
src/lib/
  athlete-store.ts   — Zustand global state (activeView, sidebarCollapsed)
```

---

## Compliance Rules

Enhanced modules are observational tracking only.

- Do NOT create steroid cycles, peptide protocols, dosage recommendations, medical advice, best stack suggestions, cycle planning, or protocol optimizers.
- Use copy like: track, monitor, health awareness, trend observation, review with clinician.

---

## After UI Changes

Ask Codex to run:

```powershell
npm run lint
npm run build
```

Both must pass clean.
