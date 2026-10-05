/* ════════════════════════════════════════════════════════════════════════
   CARE OPTIONS — the people a member can reach, with or without a clinician.

   Many members run a cycle without a doctor involved. Routing everything to
   "your clinician" leaves them with nowhere to go, so every escalation names
   humans anyone can reach: a pharmacist, urgent care, a telehealth visit, a
   lab they can order from themselves, and emergency services. Reserve still
   never tells anyone what treatment to take; it tells them who can.
   ════════════════════════════════════════════════════════════════════════ */

export type CareOptionKey = "emergency" | "urgent" | "telehealth" | "pharmacist" | "own-labs" | "regular-care";

export type CareOption = { key: CareOptionKey; title: string; forWhat: string };

/** Most urgent first. */
export const CARE_OPTIONS: readonly CareOption[] = [
  {
    key: "emergency",
    title: "911, or call or text 988",
    forWhat: "Chest pain, stroke signs, trouble breathing, a painful swollen calf, yellowing skin, or thoughts of harming yourself. Don't wait and don't drive yourself.",
  },
  {
    key: "urgent",
    title: "Urgent care",
    forWhat: "A result or symptom that needs a look today. No appointment or regular doctor needed, and many can draw labs on the spot.",
  },
  {
    key: "telehealth",
    title: "A telehealth visit",
    forWhat: "A same-day or next-day review of your labs, blood pressure, symptoms or plan from home. Many services can also order lab tests.",
  },
  {
    key: "pharmacist",
    title: "A pharmacist",
    forWhat: "Questions about supplements, medicines and how they interact, including products you already use. Usually free, with no appointment.",
  },
  {
    key: "own-labs",
    title: "Order your own labs",
    forWhat: "In most US states you can order blood tests directly from a lab without a doctor's order, then bring the results to any of the above. A few states restrict this.",
  },
  {
    key: "regular-care",
    title: "Ongoing care",
    forWhat: "A primary care or men's and women's health clinic can follow your labs and blood pressure across a cycle. Being open about what you use helps them catch problems early.",
  },
];

/** One line for places with no room for the whole list. */
export const NO_CLINICIAN_LINE = "No clinician? Urgent care, a telehealth visit or a pharmacist can review this with you.";

/** Who a Reserve summary is for. */
export const SUMMARY_AUDIENCE = "a clinician, urgent care, a telehealth visit or a pharmacist";
