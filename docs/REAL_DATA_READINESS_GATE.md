# Reserve Lab Real-Data Readiness Gate

**Audited:** 2026-07-29  
**Branch:** `claude/operations-production-polish`  
**Audited HEAD:** `e8732190a9b9da91846bb5a5e476bedd7a5b9924`

## Gate result

```ts
type RealDataReadinessGate = {
  authentication: "ready" | "partial" | "missing"
  userOwnership: "ready" | "partial" | "missing"
  rowLevelSecurity: "verified" | "partial" | "missing"
  privateStorage: "verified" | "partial" | "missing"
  multiDeviceRestore: "verified" | "mock-only" | "missing"
  logoutIsolation: "verified" | "partial" | "missing"
  safeToStoreRealClientData: boolean
  blockers: string[]
  evidence: string[]
}

export const realDataReadinessGate: RealDataReadinessGate = {
  authentication: "partial",
  userOwnership: "partial",
  rowLevelSecurity: "partial",
  privateStorage: "missing",
  multiDeviceRestore: "mock-only",
  logoutIsolation: "partial",
  safeToStoreRealClientData: false,
  blockers: [
    "No real Supabase project or production environment is configured in this workspace.",
    "Email login is declared but has no member-facing implementation; Google OAuth has not completed a live round trip.",
    "Profile bootstrap is not invoked from the authenticated client lifecycle, so canonical profile creation is not proven.",
    "Canonical athlete, coach, and coach-client relationship ownership is not implemented in Supabase; coaching data remains device-local.",
    "Community message routes use the service role without request authentication and accept a client-supplied userId.",
    "Community RLS allows every authenticated user to read every undeleted message and allows self-created memberships without an invitation boundary.",
    "Private Storage buckets and storage.objects ownership policies are absent from migrations.",
    "Logout and account switching leave member backups, coaching records, standalone logs, and coaching UI state in localStorage.",
    "Account export and account deletion flows are absent.",
    "Two-user RLS, Storage isolation, session restoration, account switching, and multi-device restoration have not been tested against a live project.",
  ],
  evidence: [
    "npm test: 672/672 passing across 29 files; lint and typecheck pass at the audited HEAD.",
    "src/lib/supabase/client.ts configures persistent PKCE sessions and Google OAuth is wired through AuthProvider.",
    "src/components/AppShell.tsx fails closed in production when public Supabase configuration is absent.",
    "supabase/migrations/0005_member_state.sql defines an auth.users-owned member_state row with select/insert/update own-row RLS.",
    "src/lib/sync/sync-engine.ts implements cloud hydration, local-to-cloud migration, retry, and cross-user detection, but no live project was available to exercise it.",
    "scripts/verify-rls.mjs exits unexecuted because Supabase credentials and two disposable accounts are missing.",
    "supabase/migrations/0001_foundation.sql contains broad authenticated reads for community_messages rather than membership-scoped reads.",
    "src/app/api/community/messages/route.ts and src/lib/community/messages.ts expose service-role reads/writes without the centralized request-auth guard.",
    "docs/backend-setup.md defers private bucket creation and signed object policies to a later manual step; no storage schema policy exists in supabase/migrations.",
    "src/lib/coaching/storage.ts persists the complete coaching database under reserve.coaching.v1 in localStorage.",
    "src/lib/sync/local-backup.ts stores member-state backups under fba-backup:* and AuthProvider does not purge those or the other private caches at logout.",
  ],
}
```

## Required verification statement

| Verification | Result |
|---|---|
| Real Supabase project tested | **No** |
| Authentication tested | **No** — static path review only |
| Two-user isolation tested | **No** |
| RLS tested | **No** — migration review only |
| Storage policy tested | **No** |
| Multi-device tested | **No** |
| Safe for real client data | **No** |

## Audit detail

| Foundation | Result | Evidence and boundary |
|---|---|---|
| Supabase Auth | Partial | Browser client, persistent PKCE sessions, refresh, callback, Google OAuth, and production fail-closed behavior exist. No live provider round trip was possible. |
| Email login | Missing | `AUTH_PROVIDERS` declares email, but the UI only exposes Google OAuth and no password/magic-link flow exists. |
| Google login | Partial | Implemented in code; provider and redirect configuration are unverified. |
| Session restoration | Partial | `getSession`, auth-state subscription, and the restoration screen are wired; no live refresh/expiry/revocation test was possible. |
| Canonical user profile | Partial | `profiles.id` is tied to `auth.users.id` and bootstrap is server-verified, but the signed-in lifecycle never calls bootstrap. |
| Canonical athlete identity | Missing | The member envelope is owned by `auth.users.id`, but there is no canonical athlete record used by both member and coaching domains. |
| Coach identity | Missing | Coach actors are local coaching records/demo identifiers rather than authenticated Supabase-owned identities. |
| Coach-client relationship ownership | Missing | Relationships, invitations, permissions, conversations, photos, and messages live in `reserve.coaching.v1` on the device. |
| Database migrations | Partial | Member-domain tables and own-row policies exist as SQL, but migrations are not linked/applied/verified against a real project. Private network schemas are not production-safe. |
| Row Level Security | Partial | Own-row member policies are present. Live isolation is unexecuted, community reads are overly broad, and private relationship policies are missing. |
| Private Storage buckets | Missing | Bucket names exist only in setup documentation. No bucket migration, object policy, signed upload flow, or signed download flow exists. |
| Storage policies | Missing | No `storage.objects` policies exist in the migration set. |
| Local-to-cloud migration | Partial | Deterministic whole-document migration with backups exists for member state; it has not been live-tested and does not cover coaching or standalone log stores. |
| Multi-device hydration | Mock-only | The sync engine path exists, but there is no real backend proof, browser acceptance, or conflict test across devices. |
| Logout cache isolation | Partial | The main member slices and sync metadata are reset, but private backup, coaching, logging, and coaching UI keys remain. |
| Account switching | Partial | Member-state mismatch detection exists, but it preserves the previous member in a readable device backup and does not isolate other stores. |
| Account export | Missing | No authenticated export endpoint or UI exists. |
| Account deletion | Missing | No authenticated deletion flow exists; `member_state` also has no member DELETE policy. |

## Production order

Do not place real friend, client, conversation, group, or media data into the current implementation. Continue in this order:

1. Canonical authenticated user/profile/athlete ownership and idempotent bootstrap.
2. Canonical coach identity and athlete-owned coach-client relationships.
3. Membership-scoped RLS for every private table, with no service-role trust of client identifiers.
4. Private bucket creation and owner/relationship-scoped `storage.objects` policies.
5. Complete logout and account-switch cache isolation.
6. Local-to-cloud migration for every authoritative private store.
7. Live multi-device restoration and two-user isolation verification.
8. Authenticated account export and deletion.
9. Only then: conversations, trusted friends, private groups, media, Progress Vault, sharing, notifications, and controlled beta enrollment.
