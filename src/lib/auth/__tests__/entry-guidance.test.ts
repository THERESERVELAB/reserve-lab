import { describe, expect, it } from "vitest";

import { entryErrorGuidance } from "../entry-guidance";

describe("entry error guidance", () => {
  it("points wrong credentials at the password reset", () => {
    expect(entryErrorGuidance("Invalid login credentials")).toMatch(/forgot your password/i);
  });

  it("points an unconfirmed address at the confirmation email", () => {
    expect(entryErrorGuidance("Email not confirmed")).toMatch(/confirmation email/i);
  });

  it("sends an existing account to sign in", () => {
    expect(entryErrorGuidance("User already registered")).toMatch(/sign in instead/i);
  });

  it("asks for a pause on rate limits", () => {
    expect(entryErrorGuidance("Email rate limit exceeded")).toMatch(/wait a minute/i);
  });

  it("names the connection when the service cannot be reached", () => {
    expect(entryErrorGuidance("Failed to fetch")).toMatch(/connection/i);
  });

  it("always offers a next step, even for an unknown message", () => {
    expect(entryErrorGuidance("Something unexpected")).toMatch(/try again/i);
  });
});
