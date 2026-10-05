# Cycle Support Options — Design

**Date:** 2026-09-14 · **Approved direction:** A — linked from the member's own compounds · **Branch:** `claude/cycle-safety-intelligence`

## Goal

A member on a cycle sees what their compounds are known to affect (already built) and, for each affected area, the support options that exist — with an honest, cited evidence grade — so they can choose what to add to their own log. The member decides. Reserve never ranks, never says "you need", never gives amounts, never adds anything on its own.

## The line

| Reserve does | Reserve never does |
| --- | --- |
| List support options for an area the member's compounds affect, alphabetically | Rank options, call one "best", or order them by strength |
| Grade the evidence honestly, including "not shown" | Claim an option protects against, offsets or reverses harm |
| Say plainly where no supplement has evidence (hormone recovery, fertility, hematocrit) | Fill that gap with a product |
| Show each option's own risks and any overlap with the member's compounds | Give amounts, timing, schedules or combinations |
| Add the option to the member's log only when they tap it | Add, prompt, remind or nag |

## Units

- `src/lib/compound-intelligence/support-options.ts` — the library (`SUPPORT_OPTIONS`, `SUPPORT_AREA_NOTES`, `SUPPORT_OPTIONS_VERSION`) and pure resolvers: `supportAreasForBrief`, `supportForArea`, `overlapsForOption`.
- Catalog + risk profiles — new entries (Multivitamin, TUDCA, Milk Thistle, N-Acetyl Cysteine, Psyllium Husk), each with its own risk profile. `RISK_PROFILE_VERSION` bumps.
- `src/components/safety/SupportOptionsSheet.tsx` — bottom sheet for one area: area note, option cards (grade, finding, overlaps, interactions, sources, review status), "Add to my log".
- `RiskProfileCard` — optional per-system "Support options" entry point. `CycleCommandTab` owns the sheet and a "General nutrition" entry point.

## Data flow

Active or cycle-linked compounds → `buildCompoundRiskBrief` → `supportAreasForBrief` (affected areas, excluding sourcing and injection) → member opens an area → `supportForArea` + `overlapsForOption` → member taps Add → `addEnhancementEntry` with catalog identity only (no amount, frequency or timing).

## Safeguards

- Lives inside the existing safety-acknowledgement gate.
- Every option `pending-clinician-review`; version string moves with content.
- All copy passes `bannedLanguageIn`; test enforces it.
- Options are alphabetical; test enforces it.
- Compliance amendment, counsel brief and CLAUDE.md updated with a dated entry.

## Testing

Vitest: catalog targets exist, sources + review status present, banned language, alphabetical order, area derivation excludes sourcing/injection, overlap detection (berberine with insulin → blood sugar), notes present for hormonal/fertility/blood with no options.

## Out of scope (separate sub-project)

GH/insulin-aware Nutrition Command: cycle-phase awareness, glucose-marker trends, low-blood-sugar escalation. Meal timing stays anchored to training and sleep, never to a compound.
