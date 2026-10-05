# The Reserve Lab mobile app — how it is built and how to run it

The iOS and Android apps are a Capacitor native shell that hosts Reserve's
deployed origin. They are not a separate front end and not a static export.

For what still stands between this and a store listing, see
[APP_STORE_REQUIREMENTS.md](./APP_STORE_REQUIREMENTS.md).

---

## Why a hosted shell rather than a rewrite

Reserve is 40 server routes, Supabase auth, and OCR that must run from
Reserve's own origin because lab files are read on-device and never
uploaded (CLAUDE.md). None of that survives `output: export`, so the
alternative to hosting the origin was a React Native rewrite of ~250
components — including a second OCR implementation that would need its own
compliance review.

Hosting the origin means the webview runs the same code as the web app.
Sessions, RLS queries, sync and the OCR pipeline behave identically, and
there is no second implementation to keep compliant. The native shell adds
what a browser cannot reach.

The trade is that the app needs a network connection to be useful. The
bundled fallback (`mobile/www/offline.html`) is the only screen it can draw
without one.

---

## What is in the repo

| Path | What it is |
|---|---|
| `capacitor.config.ts` | Shell configuration. Refuses to run without `RESERVE_MOBILE_ORIGIN`. |
| `android/`, `ios/` | The native projects. **Versioned on purpose** — they carry the deep-link registration, permissions and signing configuration. |
| `mobile/www/` | The offline fallback. The only web content inside the binary. |
| `mobile/assets/` | Icon and splash sources (specs only — see §Blockers). |
| `src/lib/mobile/native-shell.ts` | Platform detection, status bar, Android back, deep links, external links. Inert on the web. |
| `src/lib/mobile/native-auth.ts` | The native Google sign-in path. |
| `src/components/mobile/NativeShellProvider.tsx` | Installs the shell. Renders nothing. |
| `scripts/check-mobile-release.mjs` | Release preflight (`npm run mobile:doctor`). |
| `.github/workflows/mobile-release.yml` | Builds both signed binaries on hosted runners. |

Every Capacitor import is dynamic and guarded by `isNativeShell()`, so no
plugin code *executes* in a browser — verified on the running app:
`window.Capacitor` is undefined, and the shell provider leaves the document
unmarked.

What that does not mean is zero bytes. In dev the browser still fetches a
785-byte Capacitor module chunk, because the bundler emits a chunk for a
dynamic import whether or not it is taken. The production figure was not
measured cleanly — a dev server writing to the same `.next` made the build
output unreliable to inspect — so treat the web cost as "small but not
nothing" until someone measures it against a clean production build.

---

## The origin is never hardcoded

`RESERVE_MOBILE_ORIGIN` must be set for any sync or build. There is no
default, and `capacitor.config.ts` throws without it.

A wrong origin inside a signed binary points members at the wrong server and
cannot be corrected without a store review. The preflight additionally
compares the origin you pass against the one actually baked into the native
projects, which is what catches the most likely mistake: changing the origin
and forgetting to re-sync.

```bash
# Store build
RESERVE_MOBILE_ORIGIN=https://www.thereservelab.com npm run mobile:sync

# A device pointed at the local dev server
RESERVE_MOBILE_ORIGIN=http://192.168.1.20:3000 \
RESERVE_MOBILE_ALLOW_CLEARTEXT=true npm run mobile:sync
```

---

## Sign-in inside the shell

Email and password need nothing special — they never leave the origin.

Google does. It refuses to render sign-in inside an embedded webview and
answers `disallowed_useragent`, so on native the provider leg runs in the
system browser (SFSafariViewController / Chrome Custom Tabs) and returns
through the custom scheme `com.reservelab.app://auth/callback`.

PKCE makes the hand-back safe: `signInWithOAuth` writes the verifier into
the webview's storage before the browser opens, and the deep link brings the
`?code=` back to that same webview, so the exchange happens where the
verifier already is. The session lands in the origin's storage exactly as on
the web.

**This needs one setting outside the repo.** In Supabase →
Authentication → URL Configuration → Redirect URLs, allow:

```
com.reservelab.app://auth/callback
```

Without it Supabase rejects the redirect and the member is stranded in the
browser sheet with no error in the app. `npm run mobile:doctor` verifies the
scheme is registered on both platforms, but it cannot see the Supabase
dashboard.

---

## Building

This machine runs Windows with no JDK, no Android SDK and no Xcode, so
binaries are built in CI (`.github/workflows/mobile-release.yml`, manual
dispatch). Both platform projects can still be scaffolded, configured and
preflighted here.

```bash
npm run mobile:doctor          # preflight — run this first
npm run mobile:sync            # push config + web assets into the projects
npm run mobile:assets          # regenerate icons/splashes (needs sources)
npm run mobile:open:android    # opens Android Studio, if installed
npm run mobile:open:ios        # macOS only
```

The preflight is the one to trust. It checks the origin, that the native
projects were actually re-synced, the bundle id across all three places,
the OAuth scheme registration on both platforms, the icon sources, and that
the safety tools are not enabled in a store build. Each check has been
exercised against its failure case.

---

## The thing to keep in mind about flags

The shell hosts the deployed origin, so **what members see in the app is
decided by the origin's build, not by the binary.** Turning
`NEXT_PUBLIC_ENABLE_SAFETY_TOOLS` on in production turns it on inside the
shipped apps too, with no new build and no store review.

That is a feature for shipping fixes and a hazard for anything store-facing.
Once the apps are live, a production flag change is a store-facing decision.
