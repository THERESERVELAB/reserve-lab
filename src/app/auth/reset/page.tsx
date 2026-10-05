"use client";

/**
 * Password recovery landing pad.
 *
 * A Supabase recovery link returns here and establishes a short-lived
 * recovery session (detectSessionInUrl performs the exchange on client init,
 * and fires PASSWORD_RECOVERY). The member sets a new password, which ends
 * every other session for the account. The link's token never leaves this
 * page and is stripped from the address bar before anything renders.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ReserveRestoring, ReserveThreshold, ThresholdField } from "@/components/auth/ReserveEntry";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { ReserveButton } from "@/components/ui/reserve/ReserveButton";
import { ReserveNotice } from "@/components/ui/reserve/ReserveSurfaces";
import { RESERVE } from "@/lib/design/tokens";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";

const WAIT_FOR_RECOVERY_MS = 12_000;
const MIN_PASSWORD_LENGTH = 8;

type Phase = "waiting" | "ready" | "saving" | "done" | "failed";

/** Read synchronously at mount — the page is client-only, so the prerender sees null. */
function readLinkFailure(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const linkError = params.get("error_description") ?? params.get("error");
  if (linkError) return linkError;
  if (!getBrowserSupabaseClient()) {
    return "Account recovery is not configured for this deployment.";
  }
  return null;
}

export default function PasswordResetPage() {
  const router = useRouter();
  const [initialFailure] = useState(readLinkFailure);
  const [phase, setPhase] = useState<Phase>(() =>
    readLinkFailure() === null ? "waiting" : "failed",
  );
  const [failure, setFailure] = useState<string | null>(initialFailure);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    if (initialFailure) return;

    const supabase = getBrowserSupabaseClient();
    if (!supabase) return;

    let settled = false;
    const arrive = () => {
      if (settled) return;
      settled = true;
      // Never leave a recovery token sitting in the address bar or history.
      window.history.replaceState({}, "", window.location.pathname);
      setPhase("ready");
    };

    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) arrive();
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) arrive();
    });

    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      setFailure("This recovery link has expired or has already been used.");
      setPhase("failed");
    }, WAIT_FOR_RECOVERY_MS);

    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [initialFailure]);

  const canSubmit =
    password.length >= MIN_PASSWORD_LENGTH && password === confirmPassword && phase === "ready";

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const supabase = getBrowserSupabaseClient();
    if (!supabase || !canSubmit) return;

    setPhase("saving");
    setFailure(null);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setFailure(error.message);
      setPhase("ready");
      return;
    }
    setPhase("done");
    setTimeout(() => router.replace("/"), 1600);
  };

  if (phase === "waiting") return <ReserveRestoring label="Verifying your recovery link" />;

  const hint =
    password.length > 0 && password.length < MIN_PASSWORD_LENGTH
      ? `Use at least ${MIN_PASSWORD_LENGTH} characters.`
      : confirmPassword.length > 0 && password !== confirmPassword
        ? "The two passwords don’t match yet."
        : `At least ${MIN_PASSWORD_LENGTH} characters. Setting a new password signs out your other devices.`;
  const disabledReason =
    password.length < MIN_PASSWORD_LENGTH
      ? `Enter a new password of at least ${MIN_PASSWORD_LENGTH} characters.`
      : "Enter the same password in both fields.";

  return (
    <ReserveThreshold statement="Set a new password for your Reserve account." active={phase === "ready" || phase === "saving"}>
      {phase === "failed" ? (
        <div className="flex flex-col gap-4">
          <ReserveNotice tone="error" title="Recovery didn’t complete">
            <p className="text-white/80">
              Request a new link: on sign-in, choose Continue with email, enter your address, then Forgot your password.
            </p>
            <p className="mt-1 text-white/55">{failure}</p>
          </ReserveNotice>
          <ReserveButton tier="primary" size="lg" fullWidth onClick={() => router.replace("/")}>
            Back to sign-in
          </ReserveButton>
        </div>
      ) : phase === "done" ? (
        <ReserveNotice tone="info" title="Password updated">
          <p className="text-white/80">Returning you to Reserve…</p>
        </ReserveNotice>
      ) : (
        <div data-threshold="glass" className="fba-glass-in">
          <GlassPanel noPad accent={RESERVE.gold}>
            <form onSubmit={handleSubmit} aria-labelledby="reset-title" className="relative flex flex-col gap-4 p-5 sm:p-6">
              <h2 id="reset-title" className="type-card-title" style={{ color: RESERVE.ivory }}>
                Set a new password
              </h2>
              <ThresholdField
                id="reset-password"
                label="New password"
                type="password"
                autoComplete="new-password"
                placeholder="New password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <ThresholdField
                id="reset-confirm"
                label="Confirm new password"
                type="password"
                autoComplete="new-password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />

              {failure ? (
                <ReserveNotice tone="error" title="Password not updated">
                  <p className="text-white/80">{failure}</p>
                </ReserveNotice>
              ) : null}

              <p aria-live="polite" className="text-[12px] leading-[1.45] text-white/65">
                {hint}
              </p>

              {canSubmit || phase === "saving" ? (
                <ReserveButton tier="primary" size="lg" type="submit" fullWidth busy={phase === "saving"} busyKeepsFocus>
                  {phase === "saving" ? "Updating…" : "Set new password"}
                </ReserveButton>
              ) : (
                <ReserveButton tier="primary" size="lg" type="submit" fullWidth disabled disabledReason={disabledReason}>
                  Set new password
                </ReserveButton>
              )}
            </form>
          </GlassPanel>
        </div>
      )}
    </ReserveThreshold>
  );
}
