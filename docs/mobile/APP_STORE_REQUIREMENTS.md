# App Store and Play Store — what Reserve still needs

Status as of 2026-09-24. The native shell is built and both platform
projects are in the repo; what follows is everything between that and a
listing. Items marked **owner** cannot be done from the codebase — they are
account, payment, legal or design actions.

The honest summary: the engineering to *host* Reserve in a native app is
done. The work left is mostly not engineering. Four of the blockers below
would each, on their own, stop a submission.

---

## 1. Blockers — a submission fails without these

### 1.1 Privacy policy and terms — **owner + engineering**

There is no privacy policy and no terms of service anywhere in the app or
the repo. Both stores require a publicly reachable privacy policy URL before
a listing can be created; it is a form field, not a guideline.

For Reserve specifically this is heavier than the usual boilerplate, because
the app handles lab results, body measurements and — behind the safety
acknowledgement — compound logs. That is health data under Apple's
guideline 5.1.3, Google's Health apps policy, and GDPR Article 9 /
CCPA. The policy has to state what is collected, where it is stored
(Supabase), what leaves the device (per CLAUDE.md, lab files and pasted text
never do — only member-confirmed marker rows), and how deletion works.

This one needs counsel, and counsel is already engaged on the compliance
brief (`docs/compliance/COUNSEL_BRIEF.md`). Add it there.

### 1.2 Sign in with Apple — **engineering**

Reserve offers Google sign-in (`src/components/auth/AuthProvider.tsx`).
App Review guideline 4.8 requires that an app offering a third-party
sign-in service also offer an equivalent option that limits data collection
to name and email and lets the member hide their email. In practice that
means Sign in with Apple on iOS.

Supabase supports the Apple provider, so this is a provider configuration
plus a button — but it also needs an Apple Developer account to exist first,
so it is gated on §2.

Email/password sign-in already exists and is arguably an equivalent option,
but Apple's reviewers apply 4.8 to the *third-party* sign-in specifically and
this is not worth arguing on a first submission.

### 1.3 In-app purchase — **owner decision already taken, engineering pending**

Subscriptions are Stripe today (`src/lib/stripe/`). Guideline 3.1.1 does not
permit unlocking digital content inside an iOS app through anything but
In-App Purchase, and Google Play Billing policy is equivalent. A Stripe
checkout reachable from inside the binary is a rejection, and so is a link
or even a mention pointing members to the web to subscribe.

Decision taken: add IAP through RevenueCat alongside Stripe, and reconcile
both into the existing entitlements layer (`src/lib/entitlements/server.ts`).
Apple and Google take 15–30%.

Not yet started. It is the largest remaining engineering item and wants its
own pass.

### 1.4 App icon and splash — **owner / design**

`mobile/assets/` has the pipeline and the specs but no source files, because
Reserve has no logo mark in the repo — `public/brand/` carries scenes and
textures, not an identity mark. The icon is the most visible brand surface
either store shows and it cannot be changed without a review, so it was
specified rather than improvised. See `mobile/assets/README.md`.

`npm run mobile:doctor` fails a store build until the sources exist.

---

## 2. Accounts and costs — **owner**

Neither of these can be done from here: they need identity verification and
a payment method.

| | Cost | Notes |
|---|---|---|
| Apple Developer Program | $99/year | Enrol as the organization, not as an individual, if Reserve Lab is a registered entity — the listing shows the account name as the seller, and changing it later means transferring the app. An organization enrolment needs a D-U-N-S number, which can take days. |
| Google Play Developer | $25 once | A personal account now requires 12 testers running a closed test for 14 consecutive days before production access. An organization account does not. This is the single most common cause of a surprise multi-week delay. |

Start both early. The Play testing requirement in particular is a calendar
constraint, not a work item.

---

## 3. Store listing content — **owner**

- **Age rating.** Reserve is 18+ by its own safety acknowledgement. Declare
  17+ / Mature accordingly. Under-declaring is a rejection and a policy
  strike.
- **Privacy labels (Apple) / Data safety form (Google).** Must match what
  the app actually does. Reserve collects health and fitness data, email and
  account identifiers; lab files and pasted text are read on-device and not
  uploaded, which is worth stating precisely because it is unusual and
  favourable.
- **Screenshots** for every required device size, and a preview video if
  wanted. These are marketing surfaces and Reserve's compliance rules apply
  to them — no medical claims, no guaranteed results, no real athlete or
  federation names.
- **Support URL** and a reachable support contact.
- **Demo account** for App Review. Reviewers will not sign up. Give them a
  working account with data in it, or the app is rejected as "unable to
  review".

---

## 4. The content risk, stated plainly

Reserve's enhanced modules track anabolic compounds. Apple guideline 1.4.3
and Google's Inappropriate Content / dangerous products policies both cover
this ground, and a rejection on drug content is not a neutral event — it
attracts scrutiny to later submissions from the same account.

Decision taken: **v1 ships with the safety tools closed.** That is already
the production default (`src/lib/launch/safety-tools.ts` — production hides
them unless `NEXT_PUBLIC_ENABLE_SAFETY_TOOLS=true`), it matches the pending
clinician and counsel review, and `npm run mobile:doctor` fails a store build
if the flag is on.

One thing to be clear about, because it is easy to get wrong: **the shell
hosts the deployed origin.** What members see in the app is decided by the
*origin's* build flags, not by the binary. Turning the safety tools on in
production turns them on inside the shipped app too, with no store review and
no new build. The preflight cannot catch that. If the apps are live, the
origin's flag is a store-facing decision.

---

## 5. Already satisfied

- **Account deletion in-app** (Apple 5.1.1(v)) — `deleteAccount` exists in
  `AuthProvider` with an API route at `src/app/api/account/delete`. Apple
  requires deletion to be reachable from inside the app, not only by email.
- **Data export** — `src/app/api/account/export`.
- **Open-source notices** — `/open-source`, with the Capacitor packages
  added and `npm run licenses:audit` re-run.
- **Export compliance** — `ITSAppUsesNonExemptEncryption=false` in
  `Info.plist`, so the question is answered once instead of per upload.
- **Minimum functionality (4.2)** — partially. The native shell alone is a
  webview wrapper, which Apple rejects. What answers 4.2 is native capability
  the browser cannot reach; see §6.

---

## 6. Recommended before iOS submission: Apple Health / Health Connect

Guideline 4.2 rejects apps that are a repackaged website. The strongest
answer available to Reserve is the one the codebase was already designed
for: `src/lib/devices/health-sources.ts` declares `apple-health` and
`health-connect` with transport `native-bridge`, and states that no native
host exists. The native host now exists.

Implementing that bridge turns the app into something that genuinely cannot
be a website, and it delivers the feature the architecture was built
around. It is the highest-value next engineering item after IAP.

Note that WHOOP is `cloud-oauth`, not `native-bridge` — the WHOOP
integration in progress in the working tree works from the server and needs
nothing from the shell.

---

## 7. CI secrets

`.github/workflows/mobile-release.yml` builds both binaries on hosted
runners. It fails with a named message when a secret is missing rather than
producing an unsigned artifact.

| Secret | Where it comes from |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | The upload keystore, base64-encoded. Generate once with `keytool`; losing it means losing the ability to update the listing unless Play App Signing key rotation is enabled. Back it up somewhere that is not this repo. |
| `ANDROID_KEYSTORE_PASSWORD` | Set at generation. |
| `ANDROID_KEY_ALIAS` | Set at generation. |
| `ANDROID_KEY_PASSWORD` | Set at generation. |
| `APPLE_CERTIFICATE_BASE64` | Apple Distribution certificate exported as .p12, base64-encoded. |
| `APPLE_CERTIFICATE_PASSWORD` | Set when exporting the .p12. |
| `APPLE_PROVISIONING_PROFILE_BASE64` | App Store provisioning profile for `com.reservelab.app`, base64-encoded. |
| `APPLE_TEAM_ID` | Apple Developer account → Membership. |

The workflow builds and uploads artifacts. It does not submit to either
store — a first submission needs a human in App Store Connect and the Play
Console regardless, and automating submission is a separate decision.

---

## 8. One thing to confirm before the first upload

The bundle id is `com.reservelab.app` (`capacitor.config.ts`). Both stores
treat it as permanent: it cannot be changed after the first upload and
cannot be reused after a deletion. Confirm it before anything is uploaded.
