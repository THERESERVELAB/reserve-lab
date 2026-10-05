/* ════════════════════════════════════════════════════════════════════════
   SETTINGS PRIMARY ACTION — the one gold action on the Settings screen.

   Settings is a utility screen, so its "next thing" is whatever would make
   the member's account more correct right now, in this order:

     1. sync failed            → review sync (their changes are at risk)
     2. offline                → review sync (changes are held on this device)
     3. no age on the profile  → add it (the adults-only tools read it)
     4. no name on the profile → add it (Reserve greets and labels by it)
     5. everything is in place → open Personal Command, where the plan lives

   The statement is the member's own account state in one plain sentence.
   Nothing here is clinical, and nothing claims a sync that did not happen:
   "saved" is only ever the sync store's confirmed state.

   Pure: no React, no store.
   ════════════════════════════════════════════════════════════════════════ */

import type { SyncStatus } from "@/lib/sync/sync-status";

export type SettingsSection =
  | "profile"
  | "training"
  | "schedule"
  | "modules"
  | "notifications"
  | "data"
  | "account"
  | "legal";

export type SettingsPrimaryAction =
  | { kind: "review-sync"; label: string; section: "data" }
  | { kind: "add-age"; label: string; section: "profile" }
  | { kind: "add-name"; label: string; section: "profile" }
  | { kind: "open-personal-command"; label: string };

export type SettingsPrimaryInput = {
  /** True when a cloud account is signed in; false in local mode or signed out. */
  signedIn: boolean;
  syncStatus: SyncStatus;
  /** `setupProfile.age` — undefined when never entered. */
  age: number | undefined;
  /** `profile.name` — blank until onboarding or the account supplies one. */
  name: string;
};

export type SettingsPrimaryPlan = {
  statement: string;
  /** One line under the statement: why this action, from the member's side. */
  support: string;
  primary: SettingsPrimaryAction;
  /** How many of the two profile details Settings owns are filled in. */
  profileDetails: { have: number; need: number };
};

const hasAge = (age: number | undefined) => typeof age === "number" && Number.isFinite(age) && age > 0;

export function resolveSettingsPrimaryAction(input: SettingsPrimaryInput): SettingsPrimaryPlan {
  const { signedIn, syncStatus, age, name } = input;
  const ageSet = hasAge(age);
  const nameSet = name.trim().length > 0;
  const profileDetails = { have: Number(ageSet) + Number(nameSet), need: 2 };

  /* 1 ── A failed sync outranks everything: the member's changes may not be saved. */
  if (signedIn && syncStatus === "error") {
    return {
      statement: "Your latest changes have not reached your account.",
      support: "Reserve keeps them on this device and keeps retrying. Review sync to see where things stand.",
      primary: { kind: "review-sync", label: "Review Sync", section: "data" },
      profileDetails,
    };
  }

  /* 2 ── Offline: nothing is lost, but nothing is confirmed either. */
  if (signedIn && syncStatus === "offline") {
    return {
      statement: "You are offline. Changes are held on this device.",
      support: "They reach your account once you reconnect. Review sync to see the last confirmed save.",
      primary: { kind: "review-sync", label: "Review Sync", section: "data" },
      profileDetails,
    };
  }

  const where = !signedIn || syncStatus === "local-only"
    ? "Your data is stored on this device only."
    : syncStatus === "saved"
      ? "Your account is saved."
      : "Your account is syncing.";

  /* 3 ── Age: the adults-only cycle and lab tools read it. */
  if (!ageSet) {
    return {
      statement: "Your age is not on your profile.",
      support: `${where} Cycle monitoring, compound risk information and lab flags are for adults 18 and older, and read your age.`,
      primary: { kind: "add-age", label: "Add Your Age", section: "profile" },
      profileDetails,
    };
  }

  /* 4 ── Name: Reserve labels your records and greets you by it. */
  if (!nameSet) {
    return {
      statement: "Your name is not on your profile.",
      support: `${where} Reserve uses your name to greet you and to label your own records.`,
      primary: { kind: "add-name", label: "Add Your Name", section: "profile" },
      profileDetails,
    };
  }

  /* 5 ── Set. The plan itself lives in Personal Command, not here. */
  return {
    statement: "Your profile is complete.",
    support: `${where} Your protocol and timeline live in Personal Command.`,
    primary: { kind: "open-personal-command", label: "Open Personal Command" },
    profileDetails,
  };
}
