import { describe, expect, it } from "vitest";

import { PRIVACY_POLICY_URL } from "@/lib/legal/privacy-policy";
import { healthAccessBlocker, nativeHealthProvider, pluginDate } from "../native-health";

/* The plugin calls need a device. What can be pinned here is every decision
   made BEFORE one is issued — which is where a member-facing mistake would
   live: a control offered when it cannot work. */

const POLICY = "https://www.thereservelab.com/privacy";

describe("which health store this device has", () => {
  it("maps each platform to its own provider", () => {
    expect(nativeHealthProvider({ platform: "ios" })).toBe("apple-health");
    expect(nativeHealthProvider({ platform: "android" })).toBe("health-connect");
  });

  it("has no provider in a browser", () => {
    expect(nativeHealthProvider(null)).toBeNull();
  });
});

describe("refusing to offer a control that cannot work", () => {
  it("blocks in a browser and says the app is needed", () => {
    const reason = healthAccessBlocker({ host: null, privacyPolicyUrl: POLICY });
    expect(reason).toMatch(/Reserve app/i);
  });

  it("allows Apple Health inside the iOS app", () => {
    expect(healthAccessBlocker({ host: { platform: "ios" }, privacyPolicyUrl: POLICY })).toBeNull();
  });

  it("allows Health Connect once a privacy policy is published", () => {
    expect(healthAccessBlocker({ host: { platform: "android" }, privacyPolicyUrl: POLICY })).toBeNull();
  });

  it("blocks Health Connect while Reserve has no privacy policy", () => {
    // Health Connect REJECTS the permission request without a reachable
    // policy URL, so offering the control would guarantee a failure.
    // `undefined` is NOT in this list: omitting the argument means "use the
    // published policy". Only an explicitly absent or unusable one blocks.
    for (const url of [null, "", "   ", "http://insecure.example", "not a url"]) {
      const reason = healthAccessBlocker({ host: { platform: "android" }, privacyPolicyUrl: url });
      expect(reason, String(url)).toMatch(/privacy policy/i);
    }
  });

  it("does not require a privacy policy for Apple Health", () => {
    // The requirement is Health Connect's, not HealthKit's. Blocking iOS on
    // it too would withhold a feature that works.
    expect(healthAccessBlocker({ host: { platform: "ios" }, privacyPolicyUrl: null })).toBeNull();
  });

  it("uses the published policy by default, so a caller cannot forget it", () => {
    // Health Connect is now genuinely connectable: the policy is live at
    // PRIVACY_POLICY_URL. Omitting the argument must resolve to it rather
    // than silently blocking a working feature.
    expect(PRIVACY_POLICY_URL).toMatch(/^https:\/\//);
    expect(healthAccessBlocker({ host: { platform: "android" } })).toBeNull();
  });
});

describe("the date format the native parser accepts", () => {
  it("strips fractional seconds, which the parser rejects", () => {
    // The native parser accepts only "yyyy-MM-dd'T'HH:mm:ssZ".
    expect(pluginDate(new Date("2026-09-24T18:05:06.789Z"))).toBe("2026-09-24T18:05:06Z");
  });

  it("emits UTC regardless of the input's zone", () => {
    expect(pluginDate(new Date("2026-09-24T06:00:00+02:00"))).toBe("2026-09-24T04:00:00Z");
  });

  it("never emits a fractional-seconds suffix", () => {
    for (const iso of ["2026-01-01T00:00:00.000Z", "2026-12-31T23:59:59.999Z"]) {
      expect(pluginDate(new Date(iso))).not.toMatch(/\./);
    }
  });
});
