# WHOOP — turning the connection on

Reserve can read a member's WHOOP account: recovery, sleep, strain and
workouts, through WHOOP's own OAuth API. The code is in place. What it needs
is a registered WHOOP developer app and four environment variables. Until
those exist the Settings row stays disabled and says why — it does not
pretend.

This is the whole activation. Ten minutes, once.

---

## 1. Create the WHOOP developer app

1. Sign in at **<https://developer.whoop.com>** with your WHOOP account. The
   developer account is separate from the member account only in that you have
   to accept the developer terms; it is the same login.
2. Create a team if you are asked to, then **Create an app**.
3. Fill it in:

   | Field | What to put |
   |---|---|
   | Name | `Reserve Lab` |
   | Contact email | your address |
   | Privacy policy URL | Reserve's privacy page |
   | Redirect URIs | the two below |

4. **Redirect URIs** — add both, exactly, character for character. WHOOP
   compares them as strings; a trailing slash or `http` where you wrote
   `https` is a rejected authorization:

   ```
   http://localhost:3000/api/integrations/whoop/callback
   https://www.thereservelab.com/api/integrations/whoop/callback
   ```

   Reserve's production origin is `www.thereservelab.com` — the apex redirects
   to it, and `app.reservelab.com` (which older copies of
   `docs/VERCEL_PRODUCTION_DEPLOYMENT.md` named) is a domain Reserve does not
   own and does not resolve. Registering that one is a rejected authorization
   with a confusing error.

5. **Scopes** — tick all seven. Six reads, and `offline`:

   ```
   read:profile  read:body_measurement  read:cycles
   read:recovery  read:sleep  read:workout  offline
   ```

   `offline` is not optional. Without it WHOOP issues no refresh token, the
   access token dies after one hour, and the connection can never renew
   itself. Reserve detects this and warns on the Settings row, but the fix is
   here.

6. Save. WHOOP shows a **Client ID** and a **Client Secret**. The secret is
   shown once.

## 2. Generate the credential vault key

Every stored WHOOP token is sealed with AES-256-GCM before it reaches the
database. There is no plaintext fallback: without this key, Reserve refuses to
store a token at all.

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## 3. Set four variables

In `.env.local` for development:

```
RESERVE_TOKEN_ENCRYPTION_KEY=   # the key from step 2
WHOOP_CLIENT_ID=                # from step 1
WHOOP_CLIENT_SECRET=            # from step 1 — server only, never NEXT_PUBLIC_
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

`WHOOP_REDIRECT_URI` is derived from `NEXT_PUBLIC_APP_URL` and does not need
setting unless your callback lives somewhere else. If you do set it, it must
match a registered redirect URI exactly.

In production, set the same four in **Vercel → Settings → Environment Variables,
Production scope**, then redeploy — env is read at server start, so an existing
deployment will not pick them up. `NEXT_PUBLIC_APP_URL` must be
`https://www.thereservelab.com` there, because it is what the redirect URI is
built from. Until all four are set, production shows the honestly-disabled row;
that is the intended state, not a fault.

## 4. Apply the migration

```bash
supabase db push
```

`supabase/migrations/0007_connected_health_sources.sql` adds three tables:

- `connected_health_sources` — the connection. The member can read and delete
  their own.
- `connected_health_credentials` — the sealed tokens. **RLS is enabled with no
  policy at all**, so a request carrying a member's own key reads nothing.
  Only the service role, inside a route that has already verified the caller,
  can open it. Do not add a policy here.
- `connected_health_observations` — the readings, each carrying its provider,
  its measurement type and the permission scope it arrived under.

## 5. Connect

Settings → Data and sync → **WHOOP** → Connect. WHOOP's own consent screen
opens; approving returns you to Reserve with the connection made. Then **Sync
now** pulls the last 30 days.

---

## What actually happens

```
Settings row  ──POST──▶  /api/integrations/whoop/start
                          issues a SIGNED state naming the verified member
       │
       └──browser──▶  WHOOP consent screen
                          │
                          └──redirect──▶  /api/integrations/whoop/callback
                                             verifies the signature
                                             exchanges the code for tokens
                                             seals them, writes the connection
Settings row  ──POST──▶  /api/integrations/whoop/sync
                          refreshes the access token if it is spent
                          reads recovery / cycle / sleep / workout
                          writes observations, de-duplicated
```

The callback is a plain browser redirect and carries no session. The signed
`state` is the only thing tying the returning authorization code to an
account, which is why it is an HMAC over the member id with a ten-minute
expiry and not a random string. A state that does not verify writes nothing.

## What Reserve does with the numbers

WHOOP Recovery, WHOOP Strain and WHOOP Sleep Performance are stored as
`vendor-score`, keyed `whoop:recovery`, `whoop:strain` and
`whoop:sleep-performance`. They are WHOOP's measurements on WHOOP's scales —
Strain is 0–21, not a percentage — and they are never merged into Reserve
Readiness. `scoresAreComparable` in `src/lib/devices/health-sources.ts`
enforces that two different score keys are never compared.

Measured values (HRV, resting heart rate, SpO2, skin temperature, time asleep)
are stored as `measured`. A heart-rate-derived calorie burn is stored as
`device-estimated`, because that is what it is. The precedence rules in
`health-sources.ts` then rank a measurement above an estimate above a vendor
score, so a real number always wins over a proprietary one.

## Syncing

Sync is a request, not a daemon: one member, one bounded window, at most eight
pages per collection. The window overlaps the previous one by 36 hours because
WHOOP revises a record after it first appears — a recovery goes from
`PENDING_SCORE` to `SCORED`, a sleep is re-staged. Each reading carries a
stable `dedupe_key`, so a revision replaces the earlier row instead of sitting
beside it as a second, contradictory reading.

If a sync hits the page cap, the connection's sync mark is deliberately **not**
advanced: the member is told more history is waiting, and the next sync
resumes from the same place rather than skipping what was never fetched.

To sync without the member pressing a button, call
`POST /api/integrations/whoop/sync` with their bearer token from a scheduler.
Nothing else needs to change.

## Disconnecting

Disconnect revokes Reserve's access at WHOOP first, then drops the connection
and its credentials. If WHOOP cannot be reached, the local grant is removed
anyway and the member is told to remove Reserve in the WHOOP app — a member
who has asked to disconnect is never trapped by an unreachable vendor.

Readings already gathered stay. They are the member's record. Account deletion
and the data export cover them; `connected_health_credentials` is deliberately
excluded from the export, because sealed tokens are Reserve's key to the
vendor, not the member's data.

## Rotating the vault key

Changing `RESERVE_TOKEN_ENCRYPTION_KEY` makes every stored token unopenable.
Existing connections will fail to refresh, be marked `expired`, and members
will be prompted to reconnect. That is the intended behaviour of a rotation —
nothing silently falls back to a weaker key.

## Troubleshooting

| What you see | What it means |
|---|---|
| Button disabled, "not configured" | One of the four variables is missing. In development the row names them. |
| `redirect_uri_mismatch` on WHOOP's screen | The registered URI and `NEXT_PUBLIC_APP_URL` disagree. Compare character for character. |
| "That connection link had expired" | More than ten minutes passed on the consent screen. Start again. |
| "did not grant offline access" | `offline` was not ticked on the app, or not approved. Fix the app, disconnect, reconnect. |
| "Reserve will not store WHOOP credentials without an encryption key" | `RESERVE_TOKEN_ENCRYPTION_KEY` is missing. The tokens were discarded, not written in the clear. |
| Sync says "More history is waiting" | The page cap was reached. Press Sync again. |

## Where the code is

| Path | What it holds |
|---|---|
| `src/lib/devices/whoop.ts` | The protocol: endpoints, scopes, token exchange, paging, translation to observations. No secrets, no database — unit tested without a network. |
| `src/lib/devices/token-vault.ts` | AES-256-GCM seal and open. Returns null with no key; never falls back to plaintext. |
| `src/lib/devices/oauth-state.ts` | The signed state that survives the redirect. |
| `src/lib/devices/whoop-config.ts` | Whether this deployment can reach WHOOP, and what is missing if not. |
| `src/lib/devices/whoop-connection.ts` | Storage, refresh, and observation writes. Service role, always on an already-verified member. |
| `src/app/api/integrations/whoop/*` | start · callback · status · sync · disconnect. |
| `src/components/settings/WhoopConnectionRow.tsx` | The Settings row, drawn from the server's answer. |

## Not built yet

- **Webhooks.** WHOOP can push `recovery.updated` and friends instead of being
  polled. That needs a public endpoint and signature verification against
  `X-WHOOP-Signature`. Sync covers the same ground today.
- **Scheduled sync.** The route exists; nothing calls it on a timer.
- **Reading the observations back into Reserve Readiness.** The data lands and
  is queryable; no surface consumes it yet. That is a deliberate next step, not
  an oversight — deciding how a WHOOP HRV reading influences Reserve Readiness
  is a modelling decision, not a plumbing one.
