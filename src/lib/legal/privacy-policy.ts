/* ════════════════════════════════════════════════════════════════════════
   PRIVACY POLICY — the content, kept next to the code it describes.

   Both stores require a publicly reachable privacy policy URL before a
   listing can be created. It is a form field, not a guideline.

   ── Why this lives in the repo and not in a CMS ─────────────────────────
   A privacy policy is only true as long as the code matches it. Keeping the
   text beside the code means a change to what Reserve collects shows up in
   the same diff as the sentence that describes it, and the test in
   __tests__/privacy-policy.ts can assert that claims which are checkable
   stay checkable.

   ── Every factual claim below was read out of the code ──────────────────
   Not assumed, not copied from a template:
     · lab files never leave the device        src/lib/labs/report-parser.ts
     · photos are never analysed or scored     src/lib/ai/value-engine.ts
     · what is sent for the AI brief           src/lib/ai/prompts.ts
     · the only vendor API called              src/lib/devices/whoop.ts
     · what Apple Health / Health Connect give src/lib/devices/health-normalize.ts
     · what an export contains                 src/app/api/account/export
     · deletion                                src/app/api/account/delete
     · no analytics SDK in the dependency tree package.json

   ── NOT LEGAL ADVICE ────────────────────────────────────────────────────
   This is an accurate engineering description of the product's behaviour,
   written so counsel has something true to work from. It has NOT been
   reviewed by a lawyer. Reserve handles lab results, body measurements and
   compound logs — health data under Apple 5.1.3, Google's Health apps
   policy, GDPR Article 9 and CCPA. Counsel is already engaged on the
   compliance brief (docs/compliance/COUNSEL_BRIEF.md); this belongs in the
   same review before any store listing is created.
   ════════════════════════════════════════════════════════════════════════ */

/**
 * Where the policy is published.
 *
 * Health Connect opens this URL from its own permission screen and REJECTS
 * the permission request if it is missing or unreachable, so it is a
 * runtime dependency of the Android health bridge, not only a store form
 * field. `android/healthfitness.config.json` carries the same value into
 * the native build; check-mobile-release.mjs fails if the two disagree.
 */
export const PRIVACY_POLICY_URL = "https://www.thereservelab.com/privacy";

export const PRIVACY_POLICY_EFFECTIVE = "2026-09-25";

/** Shown at the top of the page while counsel review is outstanding. */
export const PRIVACY_REVIEW_PENDING = true;

export type PolicySection = {
  id: string;
  heading: string;
  /** Each entry is one paragraph. */
  body: string[];
  /** Optional tighter list under the paragraphs. */
  points?: string[];
};

export const PRIVACY_POLICY: PolicySection[] = [
  {
    id: "what-this-is",
    heading: "What this covers",
    body: [
      "Reserve Lab is a training, nutrition and health-awareness tracker. You record what you did and what you measured, and Reserve organises it, shows you trends, and helps you prepare for a conversation with a clinician.",
      "This policy covers the Reserve Lab website and the Reserve Lab iOS and Android apps. The apps display the same product as the website, so what is written here applies to both.",
      "Reserve does not diagnose, treat or advise. It does not tell you what to take, how much, or whether anything is safe. Those are questions for a clinician, and Reserve routes you to one.",
    ],
  },
  {
    id: "what-we-collect",
    heading: "What Reserve collects",
    body: [
      "Only what you enter or explicitly connect. Reserve has no advertising, and there is no analytics or tracking SDK in the app — nothing measures how you use it and reports back.",
    ],
    points: [
      "Account: your email address, and your name if you give one. If you sign in with Google, Reserve receives your email and basic profile from Google — never your Google password.",
      "Training and nutrition: sessions, sets, loads, meals, hydration, sleep and schedule entries you log.",
      "Body: weight, measurements, and progress photos you choose to save.",
      "Health markers: lab values you confirm from a report, and symptoms or observations you write down.",
      "Compound and supplement logs: only if you use those modules, and only after you accept the safety acknowledgement and confirm you are 18 or older.",
      "Connected devices: if you connect WHOOP, the recovery, sleep and strain readings it returns.",
      "Apple Health and Android Health Connect: if you connect them in the Reserve app, and only for what you permit — sleep, heart rate, blood oxygen, weight, body fat, steps, active energy and distance. Reserve reads these; it never writes anything back to Apple Health or Health Connect, and it does not ask for blood pressure, blood glucose or body temperature.",
      "Billing: handled by Stripe. Reserve stores your subscription status, never your card number.",
    ],
  },
  {
    id: "stays-on-device",
    heading: "What never leaves your device",
    body: [
      "Lab reports are read on your device. When you import a PDF, a scan, a photo of a result, or paste text, the file is parsed and the text recognised in your own browser, from Reserve's own servers — the file is never uploaded and the pasted text is never stored.",
      "Only the marker rows you confirm are saved. If you import a ten-page report and confirm four values, Reserve keeps four rows. The report itself is gone when you close the page.",
      "Progress photos are stored so you can compare them over time. They are never analysed, scored or judged, and they are never sent to any third party, including any AI service.",
    ],
  },
  {
    id: "ai",
    heading: "What the AI features send",
    body: [
      "One feature — the daily brief — calls OpenAI. What it sends is deliberately small: your experience level, your plan tier, a readiness score and an adherence score as numbers from 0 to 100, and a short free-text focus line.",
      "It does not send your name, your email, your account identifier, your lab results, your compound logs, your measurements or any photo. If the feature is unavailable, Reserve falls back to a locally generated brief rather than sending more.",
      "Every other insight in Reserve is computed on Reserve's own servers or in your browser from your own data, with no third-party AI involved.",
    ],
  },
  {
    id: "where-it-lives",
    heading: "Where your data is stored",
    body: [
      "Your account and your logs are stored in Supabase, Reserve's database provider. Access is enforced per row: the database itself is configured so one member's queries cannot return another member's data, rather than relying on the app to remember to filter.",
      "The site and the servers run on Vercel. Subscriptions run through Stripe.",
      "WHOOP credentials are sealed before they are written. They are encrypted with AES-256-GCM under a key Reserve holds outside the database, and there is no unencrypted fallback: if the key is unavailable, Reserve refuses to store the credential rather than writing it in the clear.",
    ],
  },
  {
    id: "sharing",
    heading: "Who Reserve shares it with",
    body: [
      "Reserve does not sell your data, and does not share it for advertising.",
      "That applies without exception to anything read from Apple Health or Android Health Connect. It is used to show you your own training, recovery and body trends inside Reserve, and it is never sold, never shared for advertising, and never passed to an AI service.",
      "Data reaches a third party only where that party is providing the service you asked for: Supabase to store it, Vercel to serve it, Stripe to take payment, WHOOP if you connect it, Google if you sign in that way, and OpenAI for the narrow daily-brief fields listed above.",
      "If you work with a coach inside Reserve, that coach sees what the connection you approved allows, and clinical detail stays behind its own consent. You can end the connection.",
    ],
  },
  {
    id: "your-control",
    heading: "What you can do with it",
    body: [
      "You can export everything. Settings gives you a machine-readable copy of your account, training, nutrition, body metrics, lab logs, supplement logs, sessions and saved insights. Sealed device credentials are excluded on purpose — they are Reserve's key to a vendor, not your data, and exporting them in the clear would be a credential leak.",
      "You can delete your account. Deletion removes your data from Reserve's systems. It is not reversible, and an export is the way to keep a copy first.",
      "Depending on where you live you may also have rights to correct your data, to object to processing, or to complain to a regulator. Reserve honours export and deletion for everyone, not only where a law requires it.",
    ],
  },
  {
    id: "children",
    heading: "Age",
    body: [
      "Reserve is not for anyone under 18. The risk-intelligence surfaces stay closed until you accept the safety acknowledgement and confirm you are 18 or older, and a profile age under 18 keeps them closed.",
    ],
  },
  {
    id: "changes",
    heading: "Changes and contact",
    body: [
      "If what Reserve collects changes, this page changes in the same release. The effective date above moves when it does.",
      "For a question about your data, an export, or a deletion, contact Reserve at the support address on the site.",
    ],
  },
];

/** Plain-text rendering, for the store listing form and for counsel review. */
export function privacyPolicyText(): string {
  const out: string[] = [
    "RESERVE LAB — PRIVACY POLICY",
    `Effective ${PRIVACY_POLICY_EFFECTIVE}`,
    "",
  ];
  for (const s of PRIVACY_POLICY) {
    out.push(s.heading.toUpperCase(), "");
    for (const p of s.body) out.push(p, "");
    for (const p of s.points ?? []) out.push(`  - ${p}`);
    if (s.points?.length) out.push("");
  }
  return out.join("\n").trimEnd() + "\n";
}
