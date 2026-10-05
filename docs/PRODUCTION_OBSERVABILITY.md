# Production Observability — Reserve Lab

Launch does not require a third-party error service. This documents what visibility already exists, the safety rules for logs, and the recommended next step — without adding a vendor now.

## Already present (verified)

- **Sync status is a first-class, categorized signal** (`src/lib/sync/sync-status.ts` + `sync-engine.ts`): `restoring | saving | pending | saved | offline | error | local-only`, with a human message on `error`. The UI reflects it; failures are visible, not silent.
- **Restore failures are non-destructive and surfaced**: `"Restore failed — your local copy is untouched. (…)"` (`sync-engine.ts:257,344`).
- **Auth callback failures are shown** with a retry path (`auth/callback/page.tsx`).
- **Health endpoint** `GET /api/health` for uptime/synthetic checks (booleans only).
- **Bounded retry with backoff** on transient cloud errors (`[5s,15s,45s,90s]`).

## Logging safety rules (must hold for any added logging)

Never log: access/refresh tokens, OAuth codes, the full member-state document, biomarker values, emails/PII in the clear, service-role keys, or raw stack traces in client-visible output. Prefer: error **category** + short message + non-identifying context (e.g. `sync.push.error`, HTTP status, retry step).

## Recommended next step (post-launch, optional)

1. **Structured client error categories** — a tiny internal helper that tags sync/auth failures with a stable category before they reach `console.error`, so a future sink can aggregate them. No vendor needed.
2. **When you want aggregation**, add one of: Sentry (`@sentry/nextjs`) with `beforeSend` scrubbing tokens/PII, or Vercel's built-in Log Drains / Observability. Gate it behind an env var so local dev stays quiet.
3. **Server routes**: return safe error codes (not internal messages) to clients; log details server-side only.

This is a recommendation, not a blocker. Do not delay launch for a third-party error service.
