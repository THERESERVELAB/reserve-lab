import { afterEach, describe, expect, it } from "vitest";

import {
  APP_BUNDLE_ID,
  androidAssetLinks,
  androidCertFingerprints,
  appleAppSiteAssociation,
  iosTeamId,
} from "@/lib/mobile/app-links";

const TEAM = "A1B2C3D4E5";
const FINGERPRINT =
  "AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99";

afterEach(() => {
  delete process.env.RESERVE_IOS_TEAM_ID;
  delete process.env.RESERVE_ANDROID_CERT_SHA256;
});

describe("iOS association", () => {
  it("serves nothing when the team id is unset — Apple caches a wrong file", () => {
    expect(iosTeamId()).toBeNull();
    expect(appleAppSiteAssociation()).toBeNull();
  });

  it("refuses a team id that is not ten alphanumeric characters", () => {
    for (const bad of ["TEAMID", "a1b2c3d4e5", "A1B2C3D4E", "A1B2-C3D4E", "YOUR_TEAM_ID"]) {
      process.env.RESERVE_IOS_TEAM_ID = bad;
      expect(`${bad}:${iosTeamId()}`).toBe(`${bad}:null`);
    }
  });

  it("prefixes the bundle id with the team id", () => {
    process.env.RESERVE_IOS_TEAM_ID = TEAM;
    const doc = appleAppSiteAssociation()!;
    expect(doc.applinks.details[0].appIDs).toEqual([`${TEAM}.${APP_BUNDLE_ID}`]);
    expect(doc.webcredentials.apps).toEqual([`${TEAM}.${APP_BUNDLE_ID}`]);
  });

  it("keeps sign-in and the public legal pages out of the app", () => {
    process.env.RESERVE_IOS_TEAM_ID = TEAM;
    const components = appleAppSiteAssociation()!.applinks.details[0].components;
    const excluded = components.filter((c) => c.exclude).map((c) => c["/"]);
    /* The OAuth leg must finish in the browser that started it, and a store
       reviewer has to be able to open /privacy without installing anything. */
    expect(excluded).toContain("/auth/*");
    expect(excluded).toContain("/privacy");
    expect(excluded).toContain("/api/*");
  });

  it("still opens everything else", () => {
    process.env.RESERVE_IOS_TEAM_ID = TEAM;
    const components = appleAppSiteAssociation()!.applinks.details[0].components;
    const catchAll = components[components.length - 1];
    expect(catchAll["/"]).toBe("/*");
    expect(catchAll.exclude).toBeUndefined();
  });

  it("puts every exclusion before the catch-all, or they never apply", () => {
    process.env.RESERVE_IOS_TEAM_ID = TEAM;
    const components = appleAppSiteAssociation()!.applinks.details[0].components;
    const lastExcluded = components.map((c) => Boolean(c.exclude)).lastIndexOf(true);
    expect(lastExcluded).toBeLessThan(components.length - 1);
  });
});

describe("Android association", () => {
  it("serves nothing without a fingerprint", () => {
    expect(androidCertFingerprints()).toEqual([]);
    expect(androidAssetLinks()).toBeNull();
  });

  it("refuses anything that is not a colon-separated SHA-256", () => {
    for (const bad of ["deadbeef", "AA:BB:CC", FINGERPRINT.replace(/:/g, ""), "PUT_YOUR_FINGERPRINT_HERE"]) {
      process.env.RESERVE_ANDROID_CERT_SHA256 = bad;
      expect(`${bad}:${androidCertFingerprints().length}`).toBe(`${bad}:0`);
    }
  });

  it("accepts lower-case input and normalises it", () => {
    process.env.RESERVE_ANDROID_CERT_SHA256 = FINGERPRINT.toLowerCase();
    expect(androidCertFingerprints()).toEqual([FINGERPRINT]);
  });

  it("takes several fingerprints, for an upload key and a Play signing key", () => {
    process.env.RESERVE_ANDROID_CERT_SHA256 = `${FINGERPRINT}, ${FINGERPRINT}`;
    expect(androidAssetLinks()![0].target.sha256_cert_fingerprints).toHaveLength(2);
  });

  it("declares the package and both delegations", () => {
    process.env.RESERVE_ANDROID_CERT_SHA256 = FINGERPRINT;
    const [statement] = androidAssetLinks()!;
    expect(statement.target.package_name).toBe(APP_BUNDLE_ID);
    expect(statement.target.namespace).toBe("android_app");
    expect(statement.relation).toContain("delegate_permission/common.handle_all_urls");
  });
});
