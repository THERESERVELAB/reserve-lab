# Owner Mode — Stage 1: identity and capabilities

**Date:** 2026-09-15 · **Status:** approved by owner direction ("do your thing" on the proposed design)

## Goal

The Reserve recognizes the founder's account as `OWNER` from server-verified identity. Owner Mode unlocks capabilities — never a safety bypass. Stage 1 delivers the role, the capability layer, owner access to review-pending safety tools in production, the Founder Mode badge, and the tests that prove separation. Stages 2 (owner research data) and 3 (owner analytics panels) are separate specs.

**Principle:** Owner Mode bypasses consumer product limitations. It does not disable medical safety monitoring. The owner gets more information, not fewer warnings.

## Decisions

| Decision | Choice |
|---|---|
| Scope | Three stages; this is stage 1 |
| Owner identity | Server-only allowlist `RESERVE_OWNER_USER_IDS` (Supabase user UUIDs) |
| Launch switch | Owner sees review-pending safety tools in production while hidden for members |
| Local testing | Dev-only `RESERVE_DEV_OWNER=true`, honored only outside production builds and when Supabase is not configured |
| Delivery | Dedicated `GET /api/account/capabilities`, held in memory on the client |

## 1. Identity and capabilities (server)

- `src/lib/authz/capabilities.ts` — pure, importable anywhere:
  - `Role = "member" | "owner"`
  - `CAPABILITIES` (explicit list): `review-pending-safety-tools`, `advanced-cycle-tracking`, `custom-cycle-entry`, `owner-research-tools`, `raw-lab-analytics`, `advanced-support-plan`, `experimental-features`
  - `ROLE_CAPABILITIES`: member → none; owner → all
  - `AccessContext = { role, capabilities, source: "allowlist" | "dev-owner" | "default" }`, `MEMBER_ACCESS`
  - `can(access, capability)` — the only check
  - No capability may disable, bypass, skip or silence anything (test-enforced)
- `src/lib/authz/access.server.ts` (`server-only`):
  - `parseOwnerAllowlist(raw)` — comma-separated, trimmed, lowercase UUIDs only; everything else (emails, blanks, junk) is dropped
  - `resolveAccess(request)` — owner iff the verified Supabase user id (`resolveRequestUser`) is on the allowlist; dev owner only when `NODE_ENV !== "production"` **and** Supabase is not configured **and** `RESERVE_DEV_OWNER === "true"`; otherwise member. Never reads role or capabilities from body, query, cookies or any header except `Authorization`.
- `GET /api/account/capabilities` → `{ role, capabilities, source }`, `Cache-Control: no-store`. Unauthenticated callers get member access (200).
- Server env schema gains `RESERVE_OWNER_USER_IDS` and `RESERVE_DEV_OWNER`. Neither is `NEXT_PUBLIC_`.

## 2. In the app

- `CapabilitiesProvider` (inside `AuthProvider`) fetches the route when the signed-in user id changes (sign-in, sign-out, account switch), and once in local mode. State lives in React memory only — not the Zustand store, not `MEMBER_STATE_KEYS`, not localStorage. Loading or any error → `MEMBER_ACCESS`.
- `useAccess()`, `useCan(capability)`.
- `useSafetyToolsVisible()` = `SAFETY_TOOLS_ENABLED || can(access, "review-pending-safety-tools")` replaces the build-time checks in Compound Command (tab list + render) and Bloodwork (safety panel, "What this measures", history descriptions).
- Owner-only UI (not rendered for members):
  - Compound Command header badge: **Owner research mode**
  - Settings account section: **Owner research mode** · Private self-tracking and experimental analytics
  - Cycle & Safety, when the switch is off: "Owner research mode · These tools are pending clinician and counsel review and are hidden for members."
- Local preview launcher for the worktree with `RESERVE_DEV_OWNER=true` (gitignored `.claude/`).

## 3. Safety, isolation, tests, docs

**Safety guarantees**
- Safety modules never import `@/lib/authz`: `src/lib/safety`, `src/lib/labs`, `src/lib/compound-intelligence`, `src/lib/cycle-review`, `src/lib/cycle`, `src/components/safety` (test scans imports).
- The safety acknowledgement (including 18+) still gates the owner. Escalation, red flags, lab flags, interaction and duplicate checks, evidence and uncertainty copy are unchanged.

**Required tests**
1. Allowlisted verified user → owner capabilities.
2. Member → no capabilities.
3. Client manipulation cannot create an owner: role in body/query/headers ignored; persisted `role: "owner"` ignored; dev owner ignored in production and when Supabase is configured; malformed allowlist ignored; `NEXT_PUBLIC_RESERVE_OWNER_USER_IDS` not read.
4. Isolation: access is never persisted or synced; provider resets on user change; no owner field in store defaults.
5. Owner uses Cycle & Safety with the switch off (e2e, dev owner). Custom/private entries: stage 2.
6. Safety still fires for the owner (e2e with dev owner: acknowledgement required, red flag routes to 911, lab flags shown; unit: capability layer never reaches safety modules).
7. Emergency handling cannot be bypassed (import boundary + no-bypass capability names + e2e).
8. Member is the default (fetch failure, unauthenticated, local without dev flag; e2e on the normal local server shows no badge and no Cycle & Safety when the flag is false).

**Docs:** CLAUDE.md safeguard; amendment section; deployment guide env rows; counsel brief question on the owner's own production use of review-pending content.

## Limits

- Client UI gating can be altered by someone editing their own browser code; that only reveals UI over their own local data. Server responses never grant owner capabilities without a verified allowlisted identity.
- Owner research data isolation (stage 2) will add data-specific tests.
