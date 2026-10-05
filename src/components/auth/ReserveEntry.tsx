"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type InputHTMLAttributes,
  type ReactNode,
  type Ref,
} from "react";
import { ArrowLeft, ArrowRight, Mail } from "lucide-react";

import { GlassPanel } from "@/components/ui/GlassPanel";
import { ReserveEnvironment } from "@/components/ui/ReserveEnvironment";
import { ReserveButton } from "@/components/ui/reserve/ReserveButton";
import { ReserveNotice } from "@/components/ui/reserve/ReserveSurfaces";
import { entryErrorGuidance } from "@/lib/auth/entry-guidance";
import { cinematicConfig } from "@/lib/cinematic/environments";
import { RADIUS, RESERVE, alpha } from "@/lib/design/tokens";
import {
  fetchAuthProviderAvailability,
  UNKNOWN_PROVIDER_AVAILABILITY,
  type AuthProviderAvailability,
} from "@/lib/supabase/providers";
import { useAmbientMotionStore } from "@/lib/ui/ambient-motion-store";
import { useAuth } from "./AuthProvider";

/* ════════════════════════════════════════════════════════════════════════
   THE THRESHOLD — Reserve's front door (owner-approved direction, 2026-08-06).

   The member stands at the entrance of the house, not in front of a form.

     1. ROOM — the `entrance-gallery` plate, full-bleed, through its own
        `reserve-gate` cinematic config. The renderer paints that config's
        overlays (`vertical-scrim-bottom` + `vignette`) at its `elevated`
        content contrast, so contrast comes from the environment, never from
        a box drawn behind the words.
     2. CONTENT — bottom-anchored on the scrim. Whisper → RESERVE LAB → one
        line, then the actions. No card, and no glass at rest.
     3. GLASS — one GlassPanel, and only once the member acts: it appears
        when they open the email path, and the room quiets beneath it
        (the gate's `activeTaskBehavior: "dimmed"`).

   Exactly one gold action in every state: Continue with Google, or email
   when Google is off, or Sign in inside the email path.

   Motion is a one-time settle and nothing more. There is no loop and no
   breathing plate: nothing on this page offers a pause control, so nothing
   may move for longer than five seconds (WCAG 2.2.2). The settle is skipped
   under reduced motion (`reducedMotionBehavior: "static"`) and when the
   member has paused ambient motion on this device.

   NOTHING about the member is on this page. No health, compound or tier
   language, and no promise about results.
   ════════════════════════════════════════════════════════════════════════ */

const GATE = cinematicConfig("reserve-gate");

/** The room's brightness while the member works in the glass. */
const ACTIVE_PLATE_OPACITY = 0.78;

/* Entry copy is a brand decision, reviewed as copy. */
const COPY = {
  whisper: "Members’ entrance",
  statement: "Training, fuel and recovery, read as one brief.",
  privacy: "Nothing about you shows on this page until you sign in.",
} as const;

const MIN_PASSWORD_LENGTH = 8;
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ─── Motion ──────────────────────────────────────────────────────────── */

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
const readReducedMotion = () => window.matchMedia(REDUCED_MOTION_QUERY).matches;
/* The server cannot know; the global reduced-motion block in globals.css
   already stills the settle for that first paint. */
const readServerReducedMotion = () => false;

/** Whether the one-time settle may run. */
function useThresholdSettle(): boolean {
  const paused = useAmbientMotionStore((state) => state.paused);
  useEffect(() => {
    void useAmbientMotionStore.persist.rehydrate();
  }, []);
  const reduced = useSyncExternalStore(subscribeReducedMotion, readReducedMotion, readServerReducedMotion);
  return !paused && !(reduced && GATE.reducedMotionBehavior === "static");
}

/* ─── The threshold ───────────────────────────────────────────────────── */

/**
 * The shared pre-session composition. Sign-in, restoring, unconfigured, the
 * OAuth callback and password recovery all render through it, so the member
 * never changes rooms between them.
 *
 * `active` is true while the member works inside the glass.
 */
export function ReserveThreshold({
  statement = COPY.statement,
  active = false,
  instant = false,
  children,
}: {
  statement?: ReactNode;
  active?: boolean;
  /* A waiting screen carries no settle: the 700ms rise starts at opacity 0,
     so on a phone whose main thread is busy restoring the member's state the
     words would be invisible for the whole wait. The entrance keeps it. */
  instant?: boolean;
  children: ReactNode;
}) {
  const settle = useThresholdSettle() && !instant;
  const plateOpacity = active && GATE.activeTaskBehavior === "dimmed" ? ACTIVE_PLATE_OPACITY : 1;
  const rise = settle ? "fba-entrance-rise" : "";

  return (
    <div
      data-threshold="shell"
      className="relative isolate flex min-h-svh w-full flex-1 flex-col"
      style={{ background: RESERVE.base }}
    >
      {/* ROOM. Fixed, so a short viewport scrolls the content over a still plate. */}
      <div className="pointer-events-none fixed inset-0" aria-hidden="true">
        <ReserveEnvironment assetId="entrance-gallery" environment={GATE} opacity={plateOpacity} priority />
      </div>

      {/* Padding ADDS the safe-area inset: `env()` alone resolves to 0px on a desktop browser. */}
      <main className="relative z-10 mx-auto flex w-full max-w-[1440px] flex-1 flex-col justify-end pb-[calc(1rem+env(safe-area-inset-bottom))] pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] pt-[calc(2rem+env(safe-area-inset-top))] sm:pb-[calc(2.5rem+env(safe-area-inset-bottom))] sm:pl-[max(2.5rem,env(safe-area-inset-left))] sm:pr-[max(2.5rem,env(safe-area-inset-right))] lg:pb-[calc(3.5rem+env(safe-area-inset-bottom))] lg:pl-[max(4rem,env(safe-area-inset-left))] lg:pr-[max(4rem,env(safe-area-inset-right))]">
        <div className="grid w-full gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(0,400px)] lg:items-end lg:gap-16">
          <div className={`min-w-0 px-2 sm:px-0 ${rise}`}>
            {/* The threshold line: the one fine gold rule on the screen. */}
            <span
              aria-hidden="true"
              className="mb-6 block h-px w-full max-w-[520px]"
              style={{ background: `linear-gradient(90deg, ${alpha(RESERVE.gold, 0.45)}, ${alpha(RESERVE.gold, 0)})` }}
            />
            {/* The token whisper ships at 42% white, which fails AA over the
                plate, and nothing else on screen carries this label. */}
            <p className="type-eyebrow" style={{ color: "rgba(255,255,255,0.74)" }}>
              {COPY.whisper}
            </p>
            {/* A waiting screen is not a page: it carries no heading, so the
                room's own h1 is the first one the member (and a screen reader)
                ever meets. The entrance keeps the wordmark as its h1. */}
            {instant ? (
              <p className="type-hero mt-3" style={{ color: RESERVE.ivory }}>
                Reserve Lab
              </p>
            ) : (
              <h1 className="type-hero mt-3" style={{ color: RESERVE.ivory }}>
                Reserve Lab
              </h1>
            )}
            <p className="type-body mt-4 max-w-[40ch]" style={{ color: alpha(RESERVE.ivory, 0.86) }}>
              {statement}
            </p>
          </div>

          <div className={`w-full min-w-0 ${rise}`} style={settle ? { animationDelay: "90ms" } : undefined}>
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}

/* ─── Fields ──────────────────────────────────────────────────────────── */

/**
 * A labelled input for the threshold's glass. The label is visible; the
 * placeholder is kept as well (the e2e suite locates inputs by it). An error
 * is tied to the input, marks it invalid, and is announced.
 */
export function ThresholdField({
  id,
  label,
  error,
  hint,
  ref,
  ...input
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  ref?: Ref<HTMLInputElement>;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "style" | "className">) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = error ? errorId : hint ? hintId : undefined;
  const style: CSSProperties = {
    /* Inline so the global focus ring's radius never overrides it. */
    borderRadius: RADIUS.control,
    border: `1px solid ${error ? alpha(RESERVE.red, 0.6) : "rgba(255,255,255,0.14)"}`,
    background: "rgba(7,8,12,0.42)",
    color: RESERVE.foreground,
  };

  return (
    <div className="flex flex-col">
      <label htmlFor={id} className="text-[13px] font-medium leading-snug" style={{ color: alpha(RESERVE.ivory, 0.88) }}>
        {label}
      </label>
      <input
        ref={ref}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className="mt-2 min-h-[48px] w-full px-4 py-3 text-base outline-none transition-colors duration-200 placeholder:text-white/35"
        style={style}
        {...input}
      />
      {error ? (
        <p id={errorId} role="alert" className="mt-1.5 text-[12.5px] leading-[1.45]" style={{ color: RESERVE.red }}>
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="mt-1.5 text-[12px] leading-[1.45] text-white/60">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/* ─── Entry ───────────────────────────────────────────────────────────── */

/** The Google mark on its own white disc, so the brand mark never sits on gold. */
function GoogleMark({ size = 16 }: { size?: number; style?: CSSProperties }) {
  return (
    <span
      aria-hidden="true"
      className="grid shrink-0 place-items-center rounded-full bg-white"
      style={{ width: size + 8, height: size + 8 }}
    >
      <svg width={size - 2} height={size - 2} viewBox="0 0 48 48">
        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
      </svg>
    </span>
  );
}

/**
 * The Apple mark. Apple's Human Interface Guidelines require the logo to be
 * reproduced exactly and never recoloured, so this is the official glyph in
 * a single fill that follows the button's foreground.
 */
function AppleMark({ size = 18 }: { size?: number; style?: CSSProperties }) {
  return (
    <svg
      aria-hidden="true"
      className="shrink-0"
      width={size}
      height={size}
      viewBox="0 0 814 1000"
      fill="currentColor"
    >
      <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76.5 0-103.7 40.8-165.9 40.8s-105.6-57-155.5-127C46.7 790.7 0 663 0 541.8c0-194.4 126.4-297.5 250.8-297.5 66.1 0 121.2 43.4 162.7 43.4 39.5 0 101.1-46 176.3-46 28.5 0 130.9 2.6 198.3 99.2zm-234-181.5c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.6-55.1 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 135.5-71.3z" />
    </svg>
  );
}

export type ReserveEntryProps = {
  /**
   * DEV HARNESS ONLY — `/dev/entrance`, which 404s in production.
   *
   * A local dev server runs with Supabase unconfigured, so provider discovery
   * resolves every provider to `false` and only the no-Google branch is ever
   * reachable. This lets that route inspect both compositions. The product
   * never passes it; when it is absent, discovery behaves exactly as before.
   */
  providerOverride?: AuthProviderAvailability;
};

type Pending = "google" | "apple" | "sign-in" | "create" | "reset" | null;
type FieldErrors = { email?: string; password?: string };

/* The shell unmounts this screen while a sign-in resolves and remounts it if
   the attempt fails. What the member typed into the email field, and whether
   the email path was open, survive that round trip here. The password never
   does. */
const draft = { email: "", emailOpen: false };

/**
 * Logged-out Reserve entry. No private member data renders behind this gate.
 */
export function ReserveEntry({ providerOverride }: ReserveEntryProps = {}) {
  const {
    signInWithGoogle,
    signInWithApple,
    signInWithEmail,
    signUpWithEmail,
    requestPasswordReset,
    errorMessage,
    noticeMessage,
  } = useAuth();

  const baseId = useId();
  const [pending, setPending] = useState<Pending>(null);
  const [emailOpen, setEmailOpen] = useState(() => draft.emailOpen);
  const [email, setEmail] = useState(() => draft.email);
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [providers, setProviders] = useState<AuthProviderAvailability>(
    providerOverride ?? UNKNOWN_PROVIDER_AVAILABILITY,
  );

  const actionsRef = useRef<HTMLDivElement>(null);
  const emailCtaRef = useRef<HTMLDivElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  /* Where focus lands after the path changes. A remount after a failed email
     sign-in returns the member to their fields. */
  const focusAfterPathChange = useRef<"fields" | "email-cta" | null>(
    draft.emailOpen && errorMessage ? "fields" : null,
  );

  useEffect(() => {
    const target = focusAfterPathChange.current;
    if (!target) return;
    focusAfterPathChange.current = null;
    if (target === "email-cta") {
      emailCtaRef.current?.querySelector("button")?.focus();
    } else if (!emailInputRef.current?.value.trim()) {
      emailInputRef.current?.focus();
    } else {
      passwordInputRef.current?.focus();
    }
  }, [emailOpen]);

  useEffect(() => {
    if (providerOverride) return;
    let active = true;
    void fetchAuthProviderAvailability().then((available) => {
      if (!active) return;
      /* Removing a focused Google button would drop focus to <body>. Hand it
         to the email action, which stays, before Google goes. */
      if (available.google === false && actionsRef.current?.contains(document.activeElement)) {
        emailCtaRef.current?.querySelector("button")?.focus();
      }
      setProviders(available);
    });
    return () => {
      active = false;
    };
  }, [providerOverride]);

  /* A provider that is definitively off is REMOVED, not disabled. While the
     answer is still unknown the button stays live. */
  const googleAvailable = providers.google !== false;
  /* Guideline 4.8 makes this required on iOS, but it can only be offered
     once the provider is actually enabled — otherwise the member lands on a
     raw Supabase error with no way back. */
  const appleAvailable = providers.apple === true;

  const openEmail = () => {
    draft.emailOpen = true;
    focusAfterPathChange.current = "fields";
    setEmailOpen(true);
  };

  const closeEmail = () => {
    draft.emailOpen = false;
    focusAfterPathChange.current = "email-cta";
    setErrors({});
    setEmailOpen(false);
  };

  /** Validates before anything reaches the auth service; focuses the first problem. */
  const validate = (action: "sign-in" | "create" | "reset"): boolean => {
    const address = email.trim();
    const next: FieldErrors = {};

    if (!address) {
      next.email =
        action === "reset"
          ? "Enter your email address first, then choose Forgot your password again."
          : "Enter your email address.";
    } else if (!EMAIL_SHAPE.test(address)) {
      next.email = "Enter a full email address, like name@example.com.";
    }

    if (action !== "reset") {
      if (!password) {
        next.password = action === "create" ? "Choose a password of at least 8 characters." : "Enter your password.";
      } else if (password.length < MIN_PASSWORD_LENGTH) {
        next.password =
          action === "create"
            ? "Use at least 8 characters."
            : "Reserve passwords are at least 8 characters. Check it and try again.";
      }
    }

    setErrors(next);
    if (next.email) emailInputRef.current?.focus();
    else if (next.password) passwordInputRef.current?.focus();
    return !next.email && !next.password;
  };

  const handleGoogle = async () => {
    if (pending) return;
    setPending("google");
    try {
      await signInWithGoogle();
    } finally {
      // On success the browser has navigated away; this only runs on failure.
      setPending(null);
    }
  };

  const handleApple = async () => {
    if (pending) return;
    setPending("apple");
    try {
      await signInWithApple();
    } finally {
      // On success the browser has navigated away; this only runs on failure.
      setPending(null);
    }
  };

  const handleEmail = async (action: "sign-in" | "create") => {
    if (pending || !validate(action)) return;
    const address = email.trim();
    draft.email = address;
    draft.emailOpen = true;
    setPending(action);
    try {
      if (action === "sign-in") await signInWithEmail(address, password);
      else await signUpWithEmail(address, password);
    } finally {
      setPending(null);
    }
  };

  const handleForgotPassword = async () => {
    if (pending || !validate("reset")) return;
    const address = email.trim();
    draft.email = address;
    setPending("reset");
    try {
      await requestPasswordReset(address);
    } finally {
      setPending(null);
    }
  };

  const authError = errorMessage ? (
    <ReserveNotice tone="error" title="Sign-in didn’t go through">
      <p className="text-white/80">{entryErrorGuidance(errorMessage)}</p>
      <p className="mt-1 text-white/55">{errorMessage}</p>
    </ReserveNotice>
  ) : null;

  const notice = noticeMessage ? <ReserveNotice tone="info">{noticeMessage}</ReserveNotice> : null;

  return (
    <ReserveThreshold active={emailOpen}>
      {!emailOpen ? (
        <div className="flex flex-col gap-4">
          {authError}
          {notice}
          <div ref={actionsRef} data-threshold="actions" className="flex flex-col gap-2.5">
            {googleAvailable && (
              <ReserveButton
                tier="primary"
                size="lg"
                fullWidth
                icon={GoogleMark}
                busy={pending === "google"}
                busyKeepsFocus
                onClick={() => void handleGoogle()}
              >
                {pending === "google" ? "Opening Google…" : "Continue with Google"}
              </ReserveButton>
            )}
            {appleAvailable && (
              /* Same size and width as Google, directly beside it: Apple's
                 guidelines ask for equivalent prominence, and it takes the
                 gold itself when Google is the one that is off. */
              <ReserveButton
                tier={googleAvailable ? "secondary" : "primary"}
                accent={googleAvailable ? RESERVE.slate : RESERVE.gold}
                size="lg"
                fullWidth
                icon={AppleMark}
                busy={pending === "apple"}
                busyKeepsFocus
                onClick={() => void handleApple()}
              >
                {pending === "apple" ? "Opening Apple…" : "Continue with Apple"}
              </ReserveButton>
            )}
            <div ref={emailCtaRef}>
              {/* Inherits the gold when both third-party options are off, so
                  there is exactly one gold action in every combination. */}
              <ReserveButton
                tier={googleAvailable || appleAvailable ? "secondary" : "primary"}
                accent={googleAvailable || appleAvailable ? RESERVE.slate : RESERVE.gold}
                size="lg"
                fullWidth
                icon={Mail}
                iconAfter={ArrowRight}
                onClick={openEmail}
              >
                Continue with email
              </ReserveButton>
            </div>
          </div>
          <p className="type-supporting px-2 sm:px-0">{COPY.privacy}</p>
        </div>
      ) : (
        <div data-threshold="glass" className="fba-glass-in">
          <GlassPanel noPad accent={RESERVE.gold}>
            <form
              noValidate
              aria-labelledby={`${baseId}-title`}
              className="relative flex flex-col p-5 sm:p-6"
              onSubmit={(event) => {
                event.preventDefault();
                void handleEmail("sign-in");
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") closeEmail();
              }}
            >
              <h2 id={`${baseId}-title`} className="type-card-title" style={{ color: RESERVE.ivory }}>
                Sign in with email
              </h2>
              <p className="type-supporting mt-1">New to Reserve? Enter an email and password, then choose Create account.</p>

              <div className="mt-5 flex flex-col gap-4">
                <ThresholdField
                  ref={emailInputRef}
                  id={`${baseId}-email`}
                  label="Email address"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  placeholder="Email address"
                  value={email}
                  error={errors.email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    if (errors.email) setErrors((current) => ({ ...current, email: undefined }));
                  }}
                />
                <ThresholdField
                  ref={passwordInputRef}
                  id={`${baseId}-password`}
                  label="Password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Password"
                  value={password}
                  error={errors.password}
                  hint="At least 8 characters."
                  onChange={(event) => {
                    setPassword(event.target.value);
                    if (errors.password) setErrors((current) => ({ ...current, password: undefined }));
                  }}
                />
              </div>

              {authError && <div className="mt-4">{authError}</div>}
              {notice && <div className="mt-4">{notice}</div>}

              <div className="mt-5 flex flex-col gap-2.5">
                <ReserveButton tier="primary" size="lg" type="submit" fullWidth busy={pending === "sign-in"} busyKeepsFocus>
                  {pending === "sign-in" ? "Signing in…" : "Sign in"}
                </ReserveButton>
                <ReserveButton
                  tier="secondary"
                  accent={RESERVE.slate}
                  size="lg"
                  fullWidth
                  busy={pending === "create"}
                  busyKeepsFocus
                  onClick={() => void handleEmail("create")}
                >
                  {pending === "create" ? "Creating account…" : "Create account"}
                </ReserveButton>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4">
                <ReserveButton
                  tier="quiet"
                  size="sm"
                  busy={pending === "reset"}
                  busyKeepsFocus
                  onClick={() => void handleForgotPassword()}
                >
                  Forgot your password?
                </ReserveButton>
                <ReserveButton tier="quiet" size="sm" icon={ArrowLeft} onClick={closeEmail}>
                  Back to sign-in options
                </ReserveButton>
              </div>
            </form>
          </GlassPanel>
        </div>
      )}
    </ReserveThreshold>
  );
}

/* ─── Adjacent pre-session states ─────────────────────────────────────── */

/** Full-screen restoration state while the session and cloud state resolve. */
export function ReserveRestoring({ label = "Restoring your Reserve profile" }: { label?: string }) {
  return (
    <ReserveThreshold instant>
      <div role="status" aria-live="polite" className="px-2 sm:px-0">
        <p className="type-card-title" style={{ color: RESERVE.ivory }}>
          One moment
        </p>
        <p className="type-supporting mt-1">{label}…</p>
        {/* A determinate bar would be a lie about progress we cannot measure. */}
        <div aria-hidden="true" className="mt-4 h-px w-full overflow-hidden" style={{ background: "rgba(255,255,255,0.1)" }}>
          <div
            className="fba-entrance-breath h-full w-1/3"
            style={{ background: `linear-gradient(90deg, transparent, ${alpha(RESERVE.gold, 0.7)}, transparent)` }}
          />
        </div>
      </div>
    </ReserveThreshold>
  );
}

/**
 * Production build reached without Supabase configuration. We refuse to run a
 * "live" product on device-local storage — that would be a dishonest launch.
 */
export function ReserveConfigRequired() {
  return (
    <ReserveThreshold>
      <div role="status" className="px-2 sm:px-0">
        <p className="type-card-title" style={{ color: RESERVE.ivory }}>
          Reserve Lab is being prepared
        </p>
        <p className="type-supporting mt-1">Member sign-in opens once setup is complete. Check back shortly.</p>
      </div>
    </ReserveThreshold>
  );
}
