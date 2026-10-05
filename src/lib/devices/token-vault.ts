import "server-only";

/* ════════════════════════════════════════════════════════════════════════
   TOKEN VAULT — a member's WHOOP tokens, encrypted before they are stored.

   A refresh token is a standing key to a member's health record. Reserve
   stores it only as ciphertext, sealed with a key that lives in the server
   environment and never in the database. Whoever reads the table without the
   key reads nothing.

   AES-256-GCM, a fresh 96-bit IV per value, and the auth tag kept alongside:
   a tampered row fails to open rather than opening to something else.

   When `RESERVE_TOKEN_ENCRYPTION_KEY` is absent, `getTokenVault()` returns
   null and every caller must refuse to store a token. It must never fall
   back to plaintext.
   ════════════════════════════════════════════════════════════════════════ */

import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from "node:crypto";

import { serverEnv } from "@/lib/env/server";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const KEY_BYTES = 32;
const VERSION = "v1";

export type TokenVault = {
  seal: (plaintext: string) => string;
  open: (sealed: string) => string;
};

function decodeKey(raw: string): Buffer | null {
  const trimmed = raw.trim();
  // Accept base64 (the documented form) or 64 hex characters.
  const buffer = /^[0-9a-fA-F]{64}$/.test(trimmed)
    ? Buffer.from(trimmed, "hex")
    : Buffer.from(trimmed, "base64");
  return buffer.length === KEY_BYTES ? buffer : null;
}

/**
 * Build a vault from a raw key. Exported for tests; production callers use
 * `getTokenVault()` so the key comes from the environment and nowhere else.
 */
export function createTokenVault(rawKey: string): TokenVault | null {
  const key = decodeKey(rawKey);
  if (!key) return null;

  return {
    seal(plaintext: string): string {
      const iv = randomBytes(IV_BYTES);
      const cipher = createCipheriv(ALGORITHM, key, iv);
      const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
      const tag = cipher.getAuthTag();
      return [VERSION, iv.toString("base64"), tag.toString("base64"), ciphertext.toString("base64")].join(".");
    },

    open(sealed: string): string {
      const parts = sealed.split(".");
      if (parts.length !== 4 || parts[0] !== VERSION) {
        throw new Error("Stored credential is not in a format this build can open.");
      }
      const iv = Buffer.from(parts[1], "base64");
      const tag = Buffer.from(parts[2], "base64");
      const ciphertext = Buffer.from(parts[3], "base64");
      if (iv.length !== IV_BYTES || tag.length !== 16) {
        throw new Error("Stored credential is malformed.");
      }
      const decipher = createDecipheriv(ALGORITHM, key, iv);
      decipher.setAuthTag(tag);
      // `final()` throws when the tag does not verify — a tampered row cannot open.
      return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
    },
  };
}

export function getTokenVault(): TokenVault | null {
  const raw = serverEnv.RESERVE_TOKEN_ENCRYPTION_KEY;
  if (!raw) return null;
  return createTokenVault(raw);
}

/** Constant-time comparison for secrets that arrive from outside. */
export function secretsMatch(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/** A key in the documented form, for the setup instructions. */
export function generateEncryptionKey(): string {
  return randomBytes(KEY_BYTES).toString("base64");
}
