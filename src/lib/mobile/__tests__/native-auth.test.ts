import { describe, expect, it, vi } from "vitest";

import { isOAuthCallbackLink, signInWithProviderNative } from "../native-auth";

/* The shell's sign-in path is the same for every third-party provider. These
   pin the parts that decide whether a member gets back into the app at all:
   which provider is asked for, that the webview is never navigated to it,
   and that the return link is recognised. */

function fakeSupabase(result: { url?: string; message?: string }) {
  const signInWithOAuth = vi.fn(async () => ({
    data: result.url ? { url: result.url, provider: "x" } : { url: null, provider: "x" },
    error: result.message ? { message: result.message } : null,
  }));
  // Only auth.signInWithOAuth is reached on this path.
  return { auth: { signInWithOAuth } } as never;
}

describe("starting a provider sign-in from the shell", () => {
  it("asks for the provider it was given", async () => {
    for (const provider of ["google", "apple"] as const) {
      const supabase = fakeSupabase({ url: "https://provider.example/authorize" });
      await signInWithProviderNative(supabase, provider);

      const call = (supabase as unknown as { auth: { signInWithOAuth: { mock: { calls: unknown[][] } } } }).auth
        .signInWithOAuth.mock.calls[0][0] as { provider: string; options: Record<string, unknown> };
      expect(call.provider, provider).toBe(provider);
    }
  });

  it("never lets the webview navigate to the provider", async () => {
    // skipBrowserRedirect is the whole point: Google refuses to render in an
    // embedded webview, and Apple expects a real browser. Losing this flag
    // would strand every native sign-in on a provider error page.
    const supabase = fakeSupabase({ url: "https://provider.example/authorize" });
    await signInWithProviderNative(supabase, "apple");

    const call = (supabase as unknown as { auth: { signInWithOAuth: { mock: { calls: unknown[][] } } } }).auth
      .signInWithOAuth.mock.calls[0][0] as { options: { skipBrowserRedirect: boolean; redirectTo: string } };
    expect(call.options.skipBrowserRedirect).toBe(true);
    expect(call.options.redirectTo).toBe("com.reservelab.app://auth/callback");
  });

  it("reports a provider error instead of silently doing nothing", async () => {
    const supabase = fakeSupabase({ message: "provider disabled" });
    const result = await signInWithProviderNative(supabase, "apple");
    expect(result).toEqual({ ok: false, message: "provider disabled" });
  });

  it("reports a missing authorize URL rather than opening nothing", async () => {
    const supabase = fakeSupabase({});
    const result = await signInWithProviderNative(supabase, "apple");
    expect(result.ok).toBe(false);
  });
});

describe("recognising the return link", () => {
  it("accepts the custom scheme both platforms may produce", () => {
    expect(isOAuthCallbackLink(new URL("com.reservelab.app://auth/callback?code=abc"))).toBe(true);
  });

  it("accepts a universal link into the hosted callback", () => {
    expect(isOAuthCallbackLink(new URL("https://www.thereservelab.com/auth/callback?code=abc"))).toBe(true);
  });

  it("ignores an ordinary content link", () => {
    expect(isOAuthCallbackLink(new URL("https://www.thereservelab.com/privacy"))).toBe(false);
  });
});
