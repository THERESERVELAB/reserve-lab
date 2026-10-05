import { z } from "zod";

const optionalString = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().min(1).optional(),
);

const optionalUrl = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().url().optional(),
);

const serverEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: optionalUrl,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: optionalString,
  SUPABASE_SERVICE_ROLE_KEY: optionalString,
  STRIPE_SECRET_KEY: optionalString,
  STRIPE_WEBHOOK_SECRET: optionalString,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: optionalString,
  STRIPE_CORE_PRICE_ID: optionalString,
  STRIPE_PRO_PRICE_ID: optionalString,
  STRIPE_ELITE_PRICE_ID: optionalString,
  OPENAI_API_KEY: optionalString,
  OPENAI_MODEL: optionalString,
  NEXT_PUBLIC_APP_URL: optionalUrl,
  /** Server-only. Comma-separated Supabase user ids with Owner Mode (src/lib/authz). */
  RESERVE_OWNER_USER_IDS: optionalString,
  /** Server-only, local development only ("true"). Ignored in production builds and when Supabase is configured. */
  RESERVE_DEV_OWNER: optionalString,
  /**
   * Server-only. 32 bytes, base64 or hex. Seals every stored third-party
   * credential (src/lib/devices/token-vault). Without it no health-source
   * token may be stored — there is no plaintext fallback. Rotating it
   * invalidates existing connections, which then have to be reconnected.
   */
  RESERVE_TOKEN_ENCRYPTION_KEY: optionalString,
  /** WHOOP developer app (developer.whoop.com). Client id may be public; the secret never is. */
  WHOOP_CLIENT_ID: optionalString,
  WHOOP_CLIENT_SECRET: optionalString,
  /** Must match a redirect URI registered on the WHOOP app exactly. Derived from NEXT_PUBLIC_APP_URL when unset. */
  WHOOP_REDIRECT_URI: optionalUrl,
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export const serverEnv = serverEnvSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  STRIPE_CORE_PRICE_ID: process.env.STRIPE_CORE_PRICE_ID,
  STRIPE_PRO_PRICE_ID: process.env.STRIPE_PRO_PRICE_ID,
  STRIPE_ELITE_PRICE_ID: process.env.STRIPE_ELITE_PRICE_ID,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_MODEL: process.env.OPENAI_MODEL,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  RESERVE_OWNER_USER_IDS: process.env.RESERVE_OWNER_USER_IDS,
  RESERVE_DEV_OWNER: process.env.RESERVE_DEV_OWNER,
  RESERVE_TOKEN_ENCRYPTION_KEY: process.env.RESERVE_TOKEN_ENCRYPTION_KEY,
  WHOOP_CLIENT_ID: process.env.WHOOP_CLIENT_ID,
  WHOOP_CLIENT_SECRET: process.env.WHOOP_CLIENT_SECRET,
  WHOOP_REDIRECT_URI: process.env.WHOOP_REDIRECT_URI,
});

export function requireServerEnv<K extends keyof ServerEnv>(key: K): NonNullable<ServerEnv[K]> {
  const value = serverEnv[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value as NonNullable<ServerEnv[K]>;
}

export type IntegrationStatus = {
  configured: boolean;
  code: "configured" | "not_configured";
  missing: Array<keyof ServerEnv>;
};

export function getIntegrationStatus(keys: Array<keyof ServerEnv>): IntegrationStatus {
  const missing = keys.filter((key) => !serverEnv[key]);
  return {
    configured: missing.length === 0,
    code: missing.length === 0 ? "configured" : "not_configured",
    missing,
  };
}
