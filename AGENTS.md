# RESERVE LAB — Agent Guide

## Product Identity

RESERVE LAB is a premium dark-mode physique transformation dashboard for serious gym-goers and enhanced athletes.

The product supports tracking, education, health awareness, and trend observation across training, nutrition, physique progress, recovery, photos, measurements, bloodwork, biomarkers, compound history, symptoms, support stack, and AI health-insight surfaces.

**Design source of truth:** `DESIGN_BIBLE.md` (repo root). All UI, copy, motion, vocabulary, hierarchy, and environment decisions are validated against it. Compliance rules in CLAUDE.md outrank it.

## Official Repo

```
C:\Users\antho\OneDrive\Desktop\final-boss-athlete-clean
```

Package slug: `final-boss-athlete`

Do NOT reference old workspace folder names or "final-boss-athlete-clean" as project names. The display name is Reserve Lab. Public product language may use THE RESERVE METHOD where already established.

---

## Safety And Compliance

Enhanced modules are observational tracking only.

**Allowed language:**
- track
- monitor
- health awareness
- trend observation
- review with clinician
- outside / inside the reference range on your report
- commonly watched for (a compound's known risk markers, cited)
- contact your clinician / seek emergency care

Harm-reduction monitoring (cycle tracking, cited compound risk profiles, lab flags against the report's own range, escalation) was added 2026-09-13 by owner direction. See `CLAUDE.md` Compliance and `docs/compliance/HARM_REDUCTION_AMENDMENT.md`.

**Never generate:**
- steroid cycles
- peptide protocols
- dosage recommendations
- medical advice
- best stack suggestions
- cycle planning
- protocol optimization

Avoid directive language such as "take this," "recommended dose," or "increase/decrease dose."

---

## Collaboration Model

**Claude** owns visual exploration, UI richness, and high-polish component passes.

**Codex** owns repo stability, TypeScript quality, architecture boundaries, build health, compliance review, and production readiness.

Before changing enhanced-athlete surfaces, review copy for compliance and keep the feature framed as record keeping, symptom logging, health awareness, trend observation, and clinician discussion.

---

## Architecture Priorities

1. Local app runs.
2. Dashboard renders.
3. Build passes.
4. Structure is clean.
5. Visual polish.
6. Biomarker architecture.
7. Supabase later.

---

## Current Stack

- Next.js 16 App Router
- TypeScript
- Tailwind CSS v4
- Framer Motion
- Recharts
- Zustand
- Lucide React
- Supabase (planned Phase 4)
- Windows PowerShell workflow

---

## Build Checks

Run before any handoff:

```powershell
npm run lint
npm run build
```

Both must pass clean.

---

## Next.js Notes

<!-- BEGIN:nextjs-agent-rules -->
This version has breaking changes — APIs, conventions, and file structure may differ from training data. Read relevant guides before writing code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

