# Apple Health and Health Connect — the native bridge

Reserve reads the member's own health data through the native shell. This is
what it reads, what it deliberately does not, and what still has to be true
before it works on a device.

Built on `@capacitor/health-fitness` (the Capacitor team's own plugin).

---

## What Reserve reads

Eight variables, read-only, listed in `RESERVE_HEALTH_VARIABLES`
(`src/lib/devices/health-normalize.ts`):

| Variable | Reserve category | Unit |
|---|---|---|
| `SLEEP` | sleep | min |
| `HEART_RATE` | heart-rate | bpm |
| `OXYGEN_SATURATION` | blood-oxygen | % |
| `WEIGHT` | body-weight | kg |
| `BODY_FAT_PERCENTAGE` | body-composition | % |
| `STEPS` | steps | count |
| `CALORIES_BURNED` | active-energy | kcal |
| `DISTANCE` | distance | m |

Reserve **writes nothing back**. There is no
`NSHealthUpdateUsageDescription` on iOS and no `WRITE_*` permission on
Android, and the preflight fails the build if either appears.

## What it does not read, and why

**No HRV, and no resting heart rate.** The plugin exposes neither. Both
platforms record HRV natively (HealthKit `heartRateVariabilitySDNN`, Health
Connect `HeartRateVariabilityRmssdRecord`), so this is a gap in the wrapper,
not in the platforms. Reaching them needs native Swift and Kotlin the plugin
does not ship.

The consequence is concrete: **Reserve Readiness gets no HRV input from this
bridge**, and no surface built on it may imply otherwise. Average heart rate
is recorded as `heart-rate`, never as `resting-heart-rate` — taking a daily
minimum and calling it "resting" would be Reserve inventing a measurement
the platform never made.

**No blood pressure, blood glucose, body temperature or basal metabolic
rate.** Reserve has no surface for them. Requesting a permission the product
cannot use is a store-review liability, a Health Connect justification we
could not write, and a thing a member would be right to refuse.

---

## The trap in the plugin's defaults

`@capacitor/health-fitness`'s sync hook **fails open**. Its own source says
so:

```js
// If no permissions set, add all by default
if (numberOfPermissions == 0) { /* read AND write, every type */ }
```

With no `android/healthfitness.config.json`, a single `cap sync` declared
**30 Health Connect permissions** — write access to everything, plus blood
glucose, blood pressure, body temperature and background health reads.

`android/healthfitness.config.json` is therefore **not optional**. It pins
the eight read permissions and switches off background jobs and history
access. Deleting it does not produce an error; it produces a quietly
over-permissioned build, which is why `npm run mobile:doctor` fails on any
health `WRITE_`, any clinical type, and any background or history
permission. That check is the guard against a regression that would never
show up in a diff of Reserve's own source.

---

## Android is blocked on the privacy policy

Health Connect **rejects the permission request outright** unless the app
declares a publicly reachable `https` privacy policy URL, which it then
opens from its own permission screen.

Reserve has no privacy policy (see
[APP_STORE_REQUIREMENTS.md](./APP_STORE_REQUIREMENTS.md) §1.1), so:

- `privacyPolicyUrl` in `android/healthfitness.config.json` is empty.
- `healthAccessBlocker()` disables the Android connect control with a
  member-readable reason instead of offering a control that would fail.
- `npm run mobile:doctor` fails a store build while it is unset.

Setting it is one line once the page is published. **Apple Health is not
affected** — HealthKit has no such requirement, so the iOS half works today.

---

## iOS: two things, two different failures

Both are checked by the preflight because they fail in ways that point
nowhere near the cause.

1. **`NSHealthShareUsageDescription`** in `Info.plist`. Without it iOS
   *terminates the app* the moment it requests HealthKit access. Not an
   error dialog — a crash.
2. **`App.entitlements`** with `com.apple.developer.healthkit`, *and*
   `CODE_SIGN_ENTITLEMENTS` set in both App build configurations. An
   entitlements file the Xcode project does not reference is inert: the
   build succeeds and the upload is rejected for a missing entitlement
   that is sitting right there in the repo.

**Outside the repo:** the HealthKit capability must also be enabled for
`com.reservelab.app` in the Apple Developer portal and be present in the
provisioning profile the build is signed with.

---

## How the code is split, and why

| File | Runs where | Tested |
|---|---|---|
| `src/lib/devices/health-normalize.ts` | anywhere — pure | yes, 20 tests |
| `src/lib/devices/native-health.ts` | the device | partly — every pre-query decision |
| `src/lib/devices/health-sources.ts` | anywhere — pure | yes |

The split is deliberate. Plugin calls cannot run outside a device, so every
decision about what a number *means* was pushed into a pure module where
tests can reach it.

### The rule the normalizer enforces

**A reading that does not parse cleanly is dropped, never guessed.**

The result shape comes from a binary native library (`IONHealthFitnessLib`
on iOS, `io.ionic.libs:ionhealthfitness-android` on Android). It is not
documented in the plugin, not knowable from this repository, and not stable
across versions. So the parser accepts several plausible envelopes and field
casings, and rejects anything else — including values outside what the
platform could physically report, which is how a changed unit announces
itself. Discards are counted and returned, so a shape change surfaces as a
visible number rather than as missing days nobody notices.

---

## Commissioning: what a device must confirm

None of the following can be verified on a Windows machine with no Xcode and
no Android SDK. Check them on the first real device run, in this order.

1. **Units.** `VARIABLE_SPEC` records the canonical HealthKit / Health
   Connect unit for each variable. These are from platform documentation,
   not from a device. A wrong unit is a silently wrong number and is the
   single most likely defect here — check `WEIGHT` (kg vs lb), `DISTANCE`
   (m vs km) and `SLEEP` (minutes vs seconds) first.
2. **The result shape.** Confirm `parseNativeResults` finds the value and
   the timestamp. A non-zero `discarded` count on real data means the field
   names differ from every variant it accepts.
3. **`OperationType`.** Only `SUM` appears in the plugin's README; `AVERAGE`
   is inferred. `readHealthWindow` isolates each variable, so a rejected
   operation shows up in `failed` for that variable alone — check that list
   is empty.
4. **iOS permission reality.** HealthKit deliberately does not tell an app
   which read permissions were granted, so a resolved
   `requestHealthAccess()` means "the sheet was shown", not "access was
   granted". The only honest check is whether a read returns anything.
