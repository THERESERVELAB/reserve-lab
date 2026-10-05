import { describe, expect, it } from "vitest";

import { resolveSafetyTools } from "../safety-tools";

describe("launch switch — safety tools", () => {
  it("stays off in production builds until explicitly turned on", () => {
    expect(resolveSafetyTools(undefined, "production")).toBe(false);
    expect(resolveSafetyTools("", "production")).toBe(false);
    expect(resolveSafetyTools("1", "production")).toBe(false);
    expect(resolveSafetyTools("TRUE", "production")).toBe(false);
    expect(resolveSafetyTools("true", "production")).toBe(true);
  });

  it("stays on in development and tests unless explicitly turned off", () => {
    expect(resolveSafetyTools(undefined, "development")).toBe(true);
    expect(resolveSafetyTools(undefined, "test")).toBe(true);
    expect(resolveSafetyTools("false", "development")).toBe(false);
  });
});
