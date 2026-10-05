/* ════════════════════════════════════════════════════════════════════════
   RESEARCH WORDS — every sentence the Research tab says in its own voice.

   Placement in time, never meaning: when things happened, what the member
   logged, how strong published evidence is. Never why, never what one thing
   did to another, never what to do next.
   ════════════════════════════════════════════════════════════════════════ */

export const RESEARCH_COPY = {
  tab: "Research",
  heading: "Your records, side by side",
  intro:
    "Your lab results, plan changes and check-ins on the same dates. Reserve shows when things happened. It doesn't say whether one thing changed another.",
  labResponse: "Lab Response",
  labResponseExplainer:
    "Every result you logged for one marker over time, with your plan changes and check-ins on the same dates. Timing alone can't show that one thing changed another.",
  labResponseEmpty: "No lab results logged yet. Add a report in the Bloodwork Log to see it here.",
  otherUnitNote: "Earlier results with a different unit are listed but not drawn.",
  noEvents: "No plan changes or check-ins recorded around these dates.",
  findingDiscuss: "Review this result with your clinician.",
  findingUrgent: "Flagged for prompt review. See the safety alerts at the top of this tab.",
  burdenMap: "Burden Map",
  burdenMapExplainer:
    "For each body system: the compounds you're running that are commonly associated with effects there, how strong the published evidence is, and when you last tested the markers watched for it.",
  burdenPending: "Pending clinician review",
  noLoad: "No compound you're running is commonly associated with effects here.",
  notTested: "Not tested",
  noRunning: "No running compounds logged. Paused and inactive entries aren't included.",
  n1Review: "N=1 Review",
  n1Explainer:
    "Your observations, grouped by what changed. Mark any you want to come back to or bring to your clinician. Reserve adds no analysis.",
  n1Empty: "No observations yet. Add one from the Timeline tab.",
  n1NoneMarked: "Nothing marked for review.",
} as const;
