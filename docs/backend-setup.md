# Reserve Lab Backend Setup

The app is offline-safe by design. Local development and builds must work with blank Supabase, Stripe, and OpenAI values. Until live keys are added, API routes return `not_configured` responses or local fallback payloads.

## 1. Create Supabase Project

Create a dedicated Supabase project for Reserve Lab.

After the project is ready, copy:

- Project URL to `NEXT_PUBLIC_SUPABASE_URL`
- Public anon key to `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Service role key to `SUPABASE_SERVICE_ROLE_KEY`

Keep the service role key server-side only.

## 2. Run Migration

Apply every file in `supabase/migrations` in numeric order (`0001` through `0006`).

The migrations create the product schema, canonical athlete/coach ownership,
member-state sync, Row Level Security, private Storage buckets, and owner-folder
Storage policies.

## 3. Verify Private Storage

Migration `0006_real_data_foundations.sql` creates these private buckets:

- `progress-photos`
- `body-scans`
- `bloodwork-uploads`
- `avatars`

Do not make these buckets public. Every object path must begin with the
authenticated owner id (`<auth.uid()>/<object>`). Verify owner upload/read/delete,
cross-user denial, and anonymous denial with `node scripts/verify-rls.mjs` before
accepting real files.

## 4. Add Env Values

Use `.env.local` for local secrets:

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_CORE_PRICE_ID=
STRIPE_PRO_PRICE_ID=
STRIPE_ELITE_PRICE_ID=
OPENAI_API_KEY=
OPENAI_MODEL=
```

Blank values are allowed during local development.

## 5. Configure Stripe Test Products

Create three recurring test prices:

- Core: `$29/month` -> `STRIPE_CORE_PRICE_ID`
- Pro: `$44/month` -> `STRIPE_PRO_PRICE_ID`
- Elite: `$99/month` -> `STRIPE_ELITE_PRICE_ID`

Add the test secret key to `STRIPE_SECRET_KEY` and publishable key to `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.

## 6. Configure Stripe Webhook

Create a webhook endpoint pointing to:

`/api/stripe/webhook`

Subscribe to:

- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

Copy the webhook signing secret to `STRIPE_WEBHOOK_SECRET`.

## 7. Configure Auth

Enable these providers when ready:

- Email/password
- Google OAuth
- Apple OAuth

Auth readiness checklist:

- Confirm Supabase Site URL and Redirect URLs match local and production domains.
- Confirm email templates use Reserve Lab display naming.
- Confirm `/api/auth/bootstrap` creates or updates the app profile after signup/login.
- Confirm profile `current_tier` remains `core` until Stripe webhook entitlement sync upgrades it.
- Confirm service role key is never exposed to browser code.

No live provider config is required for local offline-safe development.

## 8. Add OpenAI Later

Add `OPENAI_API_KEY` and optionally `OPENAI_MODEL` when AI calls should go live. Without a key, `/api/ai/brief` returns a premium local fallback brief with tracking-only, health-awareness copy.

## 9. Run Checks

```powershell
npm run lint
npm run build
```

Both should pass with missing integration keys.

## 10. Test API Routes

Offline-safe expectations:

- `GET /api/backend/health` returns integration status and missing keys.
- `POST /api/auth/bootstrap` returns a local fallback profile without Supabase.
- `POST /api/ai/brief` returns a fallback brief without `OPENAI_API_KEY`.
- `POST /api/ai/training-intelligence` returns tracking-only training observations.
- `POST /api/ai/projection` returns a safe projection scaffold.
- `POST /api/ai/retention-coaching` returns retention guidance without medical claims.
- `POST /api/ai/upgrade-teaser` returns compliant upgrade copy.
- `POST /api/analytics/events` returns `mode: "local_fallback"` without Supabase.
- `POST /api/leads` returns a generated lead id and `mode: "local_fallback"` without Supabase.
- `POST /api/acquisition/attribution` captures campaign, referral, and affiliate context.
- `GET /api/community/channels` returns the static channel catalog without Supabase.
- `GET /api/community/messages` returns an empty local fallback without Supabase.
- `POST /api/community/messages` returns `not_configured` without Supabase.
- `POST /api/stripe/checkout` returns `code: "not_configured"` without Stripe keys.
- `POST /api/stripe/portal` returns `code: "not_configured"` without Stripe keys.
- `POST /api/stripe/webhook` returns `code: "not_configured"` without Stripe keys.

## 11. Deployment Checklist

- Confirm env values are set in hosting provider.
- Confirm Supabase migration ran successfully.
- Confirm storage buckets exist.
- Confirm Stripe webhook uses the deployed domain.
- Confirm checkout creates sessions for Core, Pro, and Elite.
- Confirm billing portal opens for test customers.
- Confirm subscription webhook updates `subscriptions` and profile `current_tier`.
- Confirm AI brief route validates schema and stores AI outputs when Supabase is configured.
- Confirm acquisition attribution writes affiliate rows when affiliate code exists.
- Confirm community messages and reactions work under RLS with authenticated users.
- Confirm enhanced-athlete copy remains observational: track, monitor, health awareness, trend observation, review with clinician.
