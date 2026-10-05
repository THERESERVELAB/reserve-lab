import { afterEach, describe, expect, it, vi } from "vitest";

const ENV = {
  NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "publishable-key",
};

vi.mock("@/lib/env/client", () => ({ clientEnv: ENV }));
vi.mock("@/lib/supabase/client", () => ({ isSupabaseBrowserConfigured: () => true }));

async function loadFresh() {
  vi.resetModules();
  return import("@/lib/supabase/providers");
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("auth provider availability", () => {
  it("reports google as unavailable when the project has it disabled", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ external: { email: true, google: false } }) })),
    );
    const { fetchAuthProviderAvailability } = await loadFresh();
    await expect(fetchAuthProviderAvailability()).resolves.toEqual({ google: false, apple: false, email: true });
  });

  it("reports google as available when the project has it enabled", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ external: { email: true, google: true } }) })),
    );
    const { fetchAuthProviderAvailability } = await loadFresh();
    await expect(fetchAuthProviderAvailability()).resolves.toEqual({ google: true, apple: false, email: true });
  });

  it("reports apple as available when the project has it enabled", async () => {
    // Guideline 4.8 makes this the provider a store submission depends on.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ external: { email: true, google: true, apple: true } }) })),
    );
    const { fetchAuthProviderAvailability } = await loadFresh();
    await expect(fetchAuthProviderAvailability()).resolves.toEqual({ google: true, apple: true, email: true });
  });

  it("leaves availability unknown when settings cannot be reached", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    const { fetchAuthProviderAvailability } = await loadFresh();
    // Unknown (null) must NOT disable a provider that may in fact work.
    await expect(fetchAuthProviderAvailability()).resolves.toEqual({ google: null, apple: null, email: null });
  });

  it("queries the settings endpoint only once per session", async () => {
    const spy = vi.fn(async () => ({ ok: true, json: async () => ({ external: { google: true } }) }));
    vi.stubGlobal("fetch", spy);
    const { fetchAuthProviderAvailability } = await loadFresh();
    await fetchAuthProviderAvailability();
    await fetchAuthProviderAvailability();
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
