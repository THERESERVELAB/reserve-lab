/* ════════════════════════════════════════════════════════════════════════
   COMPOUND RISK PROFILES — what a compound is known to affect.

   This is Reserve's understanding of a compound's RISKS, built from public
   scientific statements, FDA prescribing information and NIH resources:

     · which body systems it is known to affect
     · which blood markers are commonly watched for it
     · which symptoms mean "get help now"
     · known interactions and its regulatory status

   It deliberately contains NO amounts, schedules, lengths, combinations or
   instructions for use. It informs the member's safety picture and their
   conversation with a clinician — it never tells anyone how to use anything.

   REVIEW: every profile ships as "pending-clinician-review". A licensed
   clinician must review the library before these profiles are presented as
   reviewed. The version string moves whenever any profile's content changes.
   ════════════════════════════════════════════════════════════════════════ */

import { findCatalogEntry, type CompoundClassKey } from "@/lib/enhancement/catalog";
import type { MarkerKey } from "@/lib/labs/markers";

export const RISK_PROFILE_VERSION = "2026.09.17-2";

/* ─── Vocabulary ──────────────────────────────────────────────────────── */

export type RiskSystem =
  | "cardiovascular"
  | "blood"
  | "lipids"
  | "liver"
  | "kidney"
  | "hormonal"
  | "fertility"
  | "metabolic"
  | "prostate"
  | "skin"
  | "mood"
  | "bone"
  | "digestive"
  | "thyroid"
  | "injection"
  | "sourcing";

export const RISK_SYSTEM_LABEL: Record<RiskSystem, string> = {
  cardiovascular: "Heart & blood pressure",
  blood: "Blood",
  lipids: "Cholesterol",
  liver: "Liver",
  kidney: "Kidneys",
  hormonal: "Hormones",
  fertility: "Fertility",
  metabolic: "Blood sugar",
  prostate: "Prostate",
  skin: "Skin & hair",
  mood: "Mood",
  bone: "Bones & joints",
  digestive: "Digestion",
  thyroid: "Thyroid",
  injection: "Injection safety",
  sourcing: "Product quality",
};

export type RegulatoryStatus = "prescription" | "controlled" | "not-approved" | "investigational" | "supplement" | "varies";

export const REGULATORY_LABEL: Record<RegulatoryStatus, string> = {
  prescription: "Prescription drug",
  controlled: "Controlled substance",
  "not-approved": "Not approved for human use",
  investigational: "Investigational",
  supplement: "Dietary supplement",
  varies: "Status varies",
};

export type RedFlagAction = "emergency" | "urgent" | "crisis";

export type RedFlagKey =
  | "chest-pain"
  | "shortness-of-breath"
  | "stroke-signs"
  | "severe-headache"
  | "fainting"
  | "irregular-heartbeat"
  | "severe-abdominal-pain"
  | "jaundice"
  | "dark-urine"
  | "calf-swelling"
  | "priapism"
  | "sudden-vision-change"
  | "severe-allergic-reaction"
  | "low-blood-sugar"
  | "injection-site-infection"
  | "severe-mood-change"
  | "self-harm-thoughts";

export const RED_FLAGS: Record<RedFlagKey, { label: string; action: RedFlagAction }> = {
  "chest-pain": { label: "Chest pain, pressure or tightness", action: "emergency" },
  "shortness-of-breath": { label: "Sudden shortness of breath", action: "emergency" },
  "stroke-signs": { label: "Face drooping, arm or leg weakness, or trouble speaking", action: "emergency" },
  "severe-headache": { label: "A sudden, severe headache", action: "emergency" },
  fainting: { label: "Fainting or nearly fainting", action: "emergency" },
  "irregular-heartbeat": { label: "A racing, pounding or irregular heartbeat that does not settle", action: "urgent" },
  "severe-abdominal-pain": { label: "Severe stomach pain, especially spreading to the back", action: "emergency" },
  jaundice: { label: "Yellowing of the skin or the whites of the eyes", action: "urgent" },
  "dark-urine": { label: "Dark, cola-colored urine", action: "urgent" },
  "calf-swelling": { label: "Painful swelling in one leg or calf", action: "urgent" },
  priapism: { label: "An erection lasting more than 4 hours", action: "emergency" },
  "sudden-vision-change": { label: "Sudden vision loss or change in vision", action: "emergency" },
  "severe-allergic-reaction": { label: "Swelling of the face, lips or throat, or trouble breathing", action: "emergency" },
  "low-blood-sugar": { label: "Confusion, heavy sweating or shaking that could be low blood sugar", action: "emergency" },
  "injection-site-infection": { label: "Hot, spreading redness, pus or fever around an injection site", action: "urgent" },
  "severe-mood-change": { label: "Severe agitation or aggression, or feeling out of control", action: "urgent" },
  "self-harm-thoughts": { label: "Thoughts of harming yourself", action: "crisis" },
};

export type ProfileSource = { label: string; url?: string };

export type ProfileReview = {
  status: "pending-clinician-review" | "clinician-reviewed";
  version: string;
  reviewedBy?: string;
  reviewedOn?: string;
};

export type RiskProfile = {
  key: string;
  title: string;
  /** Official catalog names take precedence over whole classes. */
  appliesTo: { classes?: CompoundClassKey[]; compounds?: string[] };
  summary: string;
  regulatory: RegulatoryStatus;
  regulatoryNote: string;
  systems: Array<{ system: RiskSystem; note: string }>;
  monitoredMarkers: MarkerKey[];
  redFlags: RedFlagKey[];
  interactions: string[];
  sources: ProfileSource[];
  review: ProfileReview;
};

/* ─── Sources ─────────────────────────────────────────────────────────── */

const SRC = {
  endocrinePed: { label: "Pope HG Jr, et al. Adverse health consequences of performance-enhancing drugs: an Endocrine Society scientific statement. Endocrine Reviews, 2014." },
  endocrineTestosterone: { label: "Bhasin S, et al. Testosterone therapy in men with hypogonadism: an Endocrine Society clinical practice guideline. J Clin Endocrinol Metab, 2018." },
  dailymed: { label: "FDA prescribing information (DailyMed, U.S. National Library of Medicine)", url: "https://dailymed.nlm.nih.gov" },
  livertox: { label: "LiverTox: Clinical and Research Information on Drug-Induced Liver Injury, NIH" },
  livertoxAshwagandha: { label: "LiverTox: Ashwagandha, NIH", url: "https://www.ncbi.nlm.nih.gov/books/NBK548536/" },
  odsVitaminC: { label: "NIH Office of Dietary Supplements: Vitamin C fact sheet", url: "https://ods.od.nih.gov/factsheets/VitaminC-HealthProfessional/" },
  vitaminCOxalosis: { label: "A case report of renal oxalosis and secondary hyperoxaluria due to chronic high vitamin C consumption, Clinical Nephrology Case Studies 2025", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC11924107/" },
  nccihCinnamon: { label: "NIH National Center for Complementary and Integrative Health: Cinnamon", url: "https://www.nccih.nih.gov/health/cinnamon" },
  nccihKava: { label: "NIH National Center for Complementary and Integrative Health: Kava", url: "https://www.nccih.nih.gov/health/kava" },
  livertoxGreenTea: { label: "LiverTox: Green Tea, NIH", url: "https://www.ncbi.nlm.nih.gov/books/NBK547925/" },
  livertoxTurmeric: { label: "LiverTox: Turmeric, NIH", url: "https://www.ncbi.nlm.nih.gov/books/NBK548561/" },
  livertoxGarcinia: { label: "LiverTox: Garcinia Cambogia, NIH", url: "https://www.ncbi.nlm.nih.gov/books/NBK548087/" },
  livertoxNiacin: { label: "LiverTox: Niacin, NIH", url: "https://www.ncbi.nlm.nih.gov/books/NBK548176/" },
  livertoxRedYeastRice: { label: "LiverTox: Red Yeast Rice, NIH", url: "https://www.ncbi.nlm.nih.gov/books/NBK548168/" },
  livertoxSupplements: { label: "LiverTox: Herbal and Dietary Supplements, NIH", url: "https://www.ncbi.nlm.nih.gov/books/NBK548441/" },
  statpearlsBiotin: { label: "Biotin, StatPearls, NIH National Library of Medicine", url: "https://www.ncbi.nlm.nih.gov/books/NBK554493/" },
  nccihLicorice: { label: "NIH National Center for Complementary and Integrative Health: Licorice Root", url: "https://www.nccih.nih.gov/health/licorice-root" },
  wada: { label: "World Anti-Doping Agency Prohibited List", url: "https://www.wada-ama.org" },
  fdaCompounding: { label: "FDA: Certain bulk drug substances for use in compounding that may present significant safety risks" },
  fdaSarms: { label: "FDA warning on body-building products containing selective androgen receptor modulators (SARMs), 2017" },
  ods: { label: "NIH Office of Dietary Supplements fact sheets", url: "https://ods.od.nih.gov" },
  dea: { label: "U.S. Drug Enforcement Administration controlled substance schedules" },
  nccih: { label: "NIH National Center for Complementary and Integrative Health", url: "https://www.nccih.nih.gov" },
  fdaNac: { label: "FDA guidance: Policy regarding N-acetyl-L-cysteine, 2022" },
  nccihGarlic: { label: "NIH National Center for Complementary and Integrative Health: Garlic", url: "https://www.nccih.nih.gov/health/garlic" },
  statpearlsHyperkalemia: { label: "Hyperkalemia, StatPearls, NIH National Library of Medicine", url: "https://www.ncbi.nlm.nih.gov/books/NBK470284/" },
} satisfies Record<string, ProfileSource>;

const PENDING: ProfileReview = { status: "pending-clinician-review", version: RISK_PROFILE_VERSION };

/* ─── Library ─────────────────────────────────────────────────────────── */

export const RISK_PROFILES: RiskProfile[] = [
  {
    key: "anabolic-steroids",
    title: "Anabolic-androgenic steroids",
    appliesTo: { classes: ["aas"] },
    summary: "Synthetic versions of testosterone. They affect the heart, blood, cholesterol, liver, fertility and mood, and several effects can persist after use ends. Many of these effects are more common and more severe with higher amounts and longer use, and the body's own testosterone production tends to take longer to recover after longer use.",
    regulatory: "controlled",
    regulatoryNote: "Schedule III controlled substances in the United States and prohibited in tested sport.",
    systems: [
      { system: "cardiovascular", note: "Linked to higher blood pressure, thickening of the heart muscle and greater cardiovascular risk." },
      { system: "blood", note: "Can raise red blood cell mass (hematocrit and hemoglobin), which makes the blood thicker." },
      { system: "lipids", note: "Commonly lowers HDL (\"good\") cholesterol and raises LDL cholesterol." },
      { system: "fertility", note: "Shuts down the body's own testosterone and sperm production. Recovery after use can take months and is not guaranteed." },
      { system: "liver", note: "Liver strain is most associated with oral steroids." },
      { system: "mood", note: "Irritability, aggression and depression are reported, including after use stops." },
      { system: "skin", note: "Acne and scalp hair loss. In women, voice deepening and other masculinizing changes that may be permanent." },
    ],
    monitoredMarkers: ["hematocrit", "hemoglobin", "hdl", "ldl", "triglycerides", "alt", "ast", "total-testosterone", "estradiol", "lh", "fsh", "creatinine", "egfr", "psa"],
    redFlags: ["chest-pain", "shortness-of-breath", "stroke-signs", "severe-headache", "calf-swelling", "jaundice", "dark-urine", "severe-mood-change", "self-harm-thoughts", "injection-site-infection"],
    interactions: [
      "Can strengthen the effect of blood thinners such as warfarin.",
      "Can change blood sugar control for people who use diabetes medicines.",
    ],
    sources: [SRC.endocrinePed, SRC.livertox, SRC.dea, SRC.wada],
    review: PENDING,
  },
  {
    key: "oral-17aa-steroids",
    title: "Oral 17-alpha-alkylated steroids",
    appliesTo: { compounds: ["Oxandrolone", "Oxymetholone", "Methandienone", "Stanozolol", "Chlorodehydromethyltestosterone", "Methasterone", "Fluoxymesterone"] },
    summary: "Chemically modified so they survive passage through the liver, which is also why they carry the strongest link to liver injury among steroids.",
    regulatory: "controlled",
    regulatoryNote: "Controlled substances in the United States; several are no longer marketed for medical use.",
    systems: [
      { system: "liver", note: "Linked to blocked bile flow (cholestasis) and, rarely, liver tumors and blood-filled liver cysts (peliosis hepatis). In this pattern ALT and AST can stay close to normal while bilirubin rises, so normal liver enzymes alone do not rule it out." },
      { system: "lipids", note: "Tend to lower HDL cholesterol more sharply than injectable testosterone." },
    ],
    monitoredMarkers: ["alt", "ast", "alk-phos", "bilirubin", "ggt", "hdl", "ldl"],
    redFlags: ["jaundice", "dark-urine", "severe-abdominal-pain"],
    interactions: ["Oxandrolone's prescribing information warns it can greatly strengthen the effect of warfarin."],
    sources: [SRC.livertox, SRC.endocrinePed],
    review: PENDING,
  },
  {
    key: "nandrolone",
    title: "Nandrolone",
    appliesTo: { compounds: ["Nandrolone", "Nandrolone Decanoate", "Nandrolone Phenylpropionate"] },
    summary: "A 19-nortestosterone steroid that also acts on progesterone receptors.",
    regulatory: "controlled",
    regulatoryNote: "Schedule III controlled substance in the United States.",
    systems: [
      { system: "hormonal", note: "Progesterone-like activity can raise prolactin, which is linked to low libido and breast tissue changes." },
      { system: "fertility", note: "Strongly suppresses natural testosterone and sperm production." },
    ],
    monitoredMarkers: ["prolactin", "estradiol"],
    redFlags: [],
    interactions: [],
    sources: [SRC.endocrinePed, SRC.dailymed],
    review: PENDING,
  },
  {
    key: "trenbolone",
    title: "Trenbolone",
    appliesTo: { compounds: ["Trenbolone", "Trenbolone Acetate", "Trenbolone Enanthate", "Trenbolone Hexahydrobenzylcarbonate"] },
    summary: "A veterinary steroid that was never approved for human use, so human safety data is very limited.",
    regulatory: "not-approved",
    regulatoryNote: "Veterinary drug only. Not approved for human use; products sold for people are unregulated.",
    systems: [
      { system: "hormonal", note: "Progesterone-like activity can raise prolactin." },
      { system: "mood", note: "Sleep disruption, anxiety and aggression are commonly reported by users." },
      { system: "sourcing", note: "Products made for human use come from unregulated sources and may be contaminated or mislabeled." },
    ],
    monitoredMarkers: ["prolactin"],
    redFlags: ["severe-mood-change"],
    interactions: [],
    sources: [SRC.endocrinePed, SRC.wada],
    review: PENDING,
  },
  {
    key: "dht-derived-steroids",
    title: "DHT-derived steroids",
    appliesTo: { compounds: ["Drostanolone", "Drostanolone Propionate", "Drostanolone Enanthate", "Mesterolone", "Dihydroboldenone"] },
    summary: "Built from dihydrotestosterone rather than testosterone, so they are not converted to estrogen and act strongly on androgen-sensitive tissue.",
    regulatory: "controlled",
    regulatoryNote: "Controlled substances in the United States. Drostanolone and mesterolone are no longer marketed for medical use in the US; dihydroboldenone was never approved for human use.",
    systems: [
      { system: "lipids", note: "Androgens that are not converted to estrogen are linked to a steeper fall in HDL cholesterol than testosterone alone." },
      { system: "skin", note: "Strong androgenic activity in skin and hair follicles. Acne and male-pattern hair loss are among the most commonly reported effects of this group." },
      { system: "prostate", note: "Dihydrotestosterone is the androgen the prostate responds to most strongly. PSA is commonly watched while any androgen is running." },
      { system: "hormonal", note: "Not converted to estrogen, so an estradiol result while running one of these reflects whatever else is running rather than this compound." },
    ],
    monitoredMarkers: ["hdl", "ldl", "apob", "triglycerides", "psa", "estradiol"],
    redFlags: [],
    interactions: [],
    sources: [SRC.endocrinePed, SRC.dea, SRC.wada],
    review: PENDING,
  },
  {
    key: "boldenone",
    title: "Boldenone",
    appliesTo: { compounds: ["Boldenone", "Boldenone Undecylenate"] },
    summary: "A veterinary steroid. In animals it is given to raise red blood cell production and appetite; it was never approved for people.",
    regulatory: "not-approved",
    regulatoryNote: "Veterinary drug and a controlled substance in the United States. Not approved for human use; products sold for people are unregulated.",
    systems: [
      { system: "blood", note: "Raising red blood cell production is one of its documented effects in animals. Hematocrit and hemoglobin are commonly watched on this group." },
      { system: "hormonal", note: "Converted to estrogen in the body, so estradiol is commonly watched alongside it." },
      { system: "sourcing", note: "Products made for human use come from unregulated sources and may be contaminated or mislabeled." },
    ],
    monitoredMarkers: ["hematocrit", "hemoglobin", "rbc", "estradiol"],
    redFlags: [],
    interactions: [],
    sources: [SRC.endocrinePed, SRC.dea, SRC.wada],
    review: PENDING,
  },
  {
    key: "methenolone",
    title: "Methenolone",
    appliesTo: { compounds: ["Methenolone"] },
    summary: "A dihydrotestosterone-derived steroid. Its oral form is not 17-alpha-alkylated, which is why it is not grouped with the oral steroids most linked to liver injury.",
    regulatory: "controlled",
    regulatoryNote: "Controlled substance in the United States and no longer marketed there for medical use.",
    systems: [
      { system: "lipids", note: "Androgens that are not converted to estrogen are linked to a steeper fall in HDL cholesterol than testosterone alone." },
      { system: "skin", note: "Androgenic activity in skin and hair follicles, so acne and male-pattern hair loss are reported with it." },
      { system: "prostate", note: "PSA is commonly watched while any androgen is running." },
      { system: "sourcing", note: "No longer made for the US medical market, so products come from unregulated sources and may be contaminated or mislabeled." },
    ],
    monitoredMarkers: ["hdl", "ldl", "psa"],
    redFlags: [],
    interactions: [],
    sources: [SRC.endocrinePed, SRC.dea, SRC.wada],
    review: PENDING,
  },
  {
    key: "trestolone",
    title: "Trestolone",
    appliesTo: { compounds: ["Trestolone Acetate"] },
    summary: "A 19-nortestosterone steroid studied in male contraceptive research and never approved for any use.",
    regulatory: "not-approved",
    regulatoryNote: "Not approved for human use anywhere. Products sold for people are unregulated.",
    systems: [
      { system: "hormonal", note: "Like other 19-nortestosterone steroids it has progesterone-like activity, which is linked to raised prolactin." },
      { system: "fertility", note: "Strongly suppresses natural testosterone and sperm production — the effect its contraceptive research was built on." },
      { system: "sourcing", note: "Never manufactured for human medical use, so every product comes from an unregulated source and may be contaminated or mislabeled." },
    ],
    monitoredMarkers: ["prolactin", "lh", "fsh", "total-testosterone"],
    redFlags: [],
    interactions: [],
    sources: [SRC.endocrinePed, SRC.wada],
    review: PENDING,
  },
  {
    key: "testosterone",
    title: "Testosterone",
    appliesTo: { classes: ["hormones_testosterone"] },
    summary: "The primary male sex hormone. The most common lab change it causes is a rise in red blood cell mass.",
    regulatory: "controlled",
    regulatoryNote: "Prescription-only and a Schedule III controlled substance in the United States.",
    systems: [
      { system: "blood", note: "Raises hematocrit and hemoglobin. This is the lab change guidelines most often monitor." },
      { system: "prostate", note: "Clinical guidelines include PSA monitoring for men using testosterone." },
      { system: "fertility", note: "Suppresses the body's own sperm production." },
      { system: "hormonal", note: "Part is converted to estradiol, which can cause breast tissue growth." },
      { system: "skin", note: "Acne and oily skin are common side effects listed in prescribing information." },
      { system: "cardiovascular", note: "Can worsen untreated sleep apnea and raise blood pressure." },
    ],
    monitoredMarkers: ["hematocrit", "hemoglobin", "psa", "total-testosterone", "free-testosterone", "estradiol", "hdl", "ldl", "lh", "fsh"],
    redFlags: ["chest-pain", "shortness-of-breath", "stroke-signs", "calf-swelling", "injection-site-infection"],
    interactions: [
      "Can strengthen the effect of blood thinners such as warfarin.",
      "May change blood sugar control and insulin needs in people with diabetes.",
    ],
    sources: [SRC.endocrineTestosterone, SRC.dailymed, SRC.dea],
    review: PENDING,
  },
  {
    key: "hcg",
    title: "Human chorionic gonadotropin (hCG)",
    appliesTo: { compounds: ["HCG"] },
    summary: "A hormone that signals the testes to make testosterone, which also raises estradiol.",
    regulatory: "prescription",
    regulatoryNote: "Prescription drug. Not approved by the FDA for weight loss.",
    systems: [
      { system: "hormonal", note: "Raises testosterone and estradiol, which can cause breast tenderness or tissue growth." },
      { system: "injection", note: "An injected product: sterile technique and a legitimate source matter." },
    ],
    monitoredMarkers: ["estradiol", "total-testosterone"],
    redFlags: ["severe-allergic-reaction", "injection-site-infection"],
    interactions: [],
    sources: [SRC.dailymed],
    review: PENDING,
  },
  {
    key: "growth-hormone",
    title: "Growth hormone (somatropin)",
    appliesTo: { classes: ["growth_hormone"] },
    summary: "Raises IGF-1 throughout the body. Its best-known risks involve blood sugar, fluid retention and joints.",
    regulatory: "prescription",
    regulatoryNote: "Prescription drug for specific medical conditions. Prohibited in tested sport.",
    systems: [
      { system: "metabolic", note: "Can raise blood sugar and reduce insulin sensitivity." },
      { system: "bone", note: "Fluid retention, joint pain and carpal tunnel symptoms such as hand numbness." },
      { system: "thyroid", note: "Prescribing information notes it can unmask low thyroid function." },
      { system: "cardiovascular", note: "Prescribing information warns of raised pressure inside the skull, felt as headache and vision changes." },
    ],
    monitoredMarkers: ["igf-1", "glucose", "hba1c", "tsh", "free-t4"],
    redFlags: ["severe-headache", "sudden-vision-change", "severe-abdominal-pain", "severe-allergic-reaction"],
    interactions: ["Can change insulin and diabetes medicine needs."],
    sources: [SRC.dailymed, SRC.endocrinePed, SRC.wada],
    review: PENDING,
  },
  {
    key: "gh-secretagogues",
    title: "Growth hormone–releasing peptides",
    appliesTo: { classes: ["peptides_growth"] },
    summary: "Peptides that prompt the body to release more growth hormone. Most have little published human safety data.",
    regulatory: "varies",
    regulatoryNote: "Most are not approved by the FDA for human use; tesamorelin is a prescription drug for one medical use. The FDA has flagged several of these peptides as potential safety risks in compounding.",
    systems: [
      { system: "metabolic", note: "Raising growth hormone and IGF-1 can raise blood sugar." },
      { system: "hormonal", note: "Some, such as GHRP-2 and GHRP-6, can also raise cortisol and prolactin." },
      { system: "sourcing", note: "Products sold outside pharmacies may be mislabeled, underdosed or contaminated." },
      { system: "injection", note: "Non-sterile injectable products carry a real infection risk." },
    ],
    monitoredMarkers: ["igf-1", "glucose", "hba1c", "prolactin", "cortisol"],
    redFlags: ["severe-allergic-reaction", "injection-site-infection"],
    interactions: [],
    sources: [SRC.fdaCompounding, SRC.dailymed, SRC.wada],
    review: PENDING,
  },
  {
    key: "igf-1-analogs",
    title: "IGF-1 analogs",
    appliesTo: { compounds: ["IGF-1 LR3", "IGF-1 DES"] },
    summary: "Modified forms of IGF-1. IGF-1 acts like insulin and can drop blood sugar quickly.",
    regulatory: "not-approved",
    regulatoryNote: "Not approved for human use. Prohibited in tested sport.",
    systems: [
      { system: "metabolic", note: "Can cause low blood sugar (hypoglycemia), which can become an emergency." },
      { system: "sourcing", note: "Research-grade products are unregulated." },
    ],
    monitoredMarkers: ["glucose"],
    redFlags: ["low-blood-sugar", "fainting"],
    interactions: ["Low blood sugar risk rises with insulin or other glucose-lowering medicines."],
    sources: [SRC.wada, SRC.endocrinePed],
    review: PENDING,
  },
  {
    key: "healing-peptides",
    title: "Tissue-repair peptides",
    appliesTo: { classes: ["peptides_healing"] },
    summary: "Peptides such as BPC-157 and TB-500 are studied mainly in animals. Human safety data is very limited.",
    regulatory: "not-approved",
    regulatoryNote: "Not approved by the FDA for human use. The FDA has flagged BPC-157 as a potential safety risk in compounding, and both are prohibited in tested sport.",
    systems: [
      { system: "sourcing", note: "Unregulated products may contain something other than what the label says." },
      { system: "injection", note: "Injecting non-sterile products risks serious infection." },
    ],
    monitoredMarkers: [],
    redFlags: ["severe-allergic-reaction", "injection-site-infection"],
    interactions: [],
    sources: [SRC.fdaCompounding, SRC.wada],
    review: PENDING,
  },
  {
    key: "mitochondrial-peptides",
    title: "Mitochondrial peptides",
    appliesTo: { classes: ["peptides_mitochondrial"] },
    summary: "Investigational peptides studied for cellular energy. Safety data for use outside clinical trials is limited.",
    regulatory: "investigational",
    regulatoryNote: "Investigational or restricted to specific medical uses. Products sold for general use are unregulated.",
    systems: [
      { system: "sourcing", note: "Products sold outside clinical settings are unregulated." },
      { system: "injection", note: "Non-sterile injectable products carry a real infection risk." },
    ],
    monitoredMarkers: [],
    redFlags: ["severe-allergic-reaction", "injection-site-infection"],
    interactions: [],
    sources: [SRC.fdaCompounding],
    review: PENDING,
  },
  {
    key: "glp-1-agonists",
    title: "GLP-1 and related agonists",
    appliesTo: { classes: ["peptides_glp1", "peptides_dual_agonists", "peptides_triple_agonists"] },
    summary: "Medicines that slow digestion and reduce appetite. Their main risks involve the digestive tract, pancreas and gallbladder.",
    regulatory: "prescription",
    regulatoryNote: "Semaglutide, liraglutide and tirzepatide are prescription drugs. Retatrutide is investigational and not approved.",
    systems: [
      { system: "digestive", note: "Nausea, vomiting and constipation are common. Dehydration from vomiting can strain the kidneys." },
      { system: "digestive", note: "Inflammation of the pancreas (pancreatitis) and gallbladder problems such as gallstones have been reported." },
      { system: "thyroid", note: "Boxed warning: thyroid C-cell tumors in rodents. Not for people with a personal or family history of medullary thyroid cancer or MEN 2." },
      { system: "metabolic", note: "Low blood sugar risk rises when combined with insulin or sulfonylureas." },
    ],
    monitoredMarkers: ["lipase", "glucose", "hba1c", "creatinine", "egfr"],
    redFlags: ["severe-abdominal-pain", "jaundice", "low-blood-sugar", "severe-allergic-reaction"],
    interactions: [
      "Slows stomach emptying, which can change how pills are absorbed.",
      "Higher low-blood-sugar risk with insulin or sulfonylureas.",
    ],
    sources: [SRC.dailymed],
    review: PENDING,
  },
  {
    key: "nad",
    title: "NAD+ and precursors",
    appliesTo: { classes: ["cellular_nad"] },
    summary: "Oral precursors are sold as supplements. Injected NAD+ is not an FDA-approved drug.",
    regulatory: "varies",
    regulatoryNote: "Oral forms are sold as dietary supplements; injectable NAD+ is not FDA-approved.",
    systems: [
      { system: "injection", note: "Injected or infused NAD+ commonly causes flushing, nausea and chest tightness." },
      { system: "sourcing", note: "Supplement and clinic products vary in quality." },
    ],
    monitoredMarkers: [],
    redFlags: ["chest-pain", "severe-allergic-reaction"],
    interactions: [],
    sources: [SRC.ods],
    review: PENDING,
  },
  {
    key: "aromatase-inhibitors",
    title: "Aromatase inhibitors",
    appliesTo: { compounds: ["Anastrozole", "Exemestane", "Letrozole"] },
    summary: "Block the conversion of testosterone to estradiol. Estradiol driven too low causes its own problems.",
    regulatory: "prescription",
    regulatoryNote: "Prescription drugs approved for breast cancer. Use in men is off-label.",
    systems: [
      { system: "hormonal", note: "Very low estradiol is linked to joint pain, low libido and low mood." },
      { system: "lipids", note: "Low estradiol can worsen cholesterol." },
      { system: "bone", note: "Long-term low estradiol is linked to bone loss." },
    ],
    monitoredMarkers: ["estradiol", "hdl", "ldl", "total-cholesterol"],
    redFlags: ["severe-allergic-reaction"],
    interactions: [],
    sources: [SRC.dailymed],
    review: PENDING,
  },
  {
    key: "serms",
    title: "Selective estrogen receptor modulators",
    appliesTo: { compounds: ["Tamoxifen", "Raloxifene", "Clomiphene", "Enclomiphene"] },
    summary: "Block estrogen in some tissues. Their most serious known risks are blood clots and, for clomiphene, vision changes.",
    regulatory: "prescription",
    regulatoryNote: "Tamoxifen, raloxifene and clomiphene are prescription drugs. Enclomiphene is not FDA-approved.",
    systems: [
      { system: "cardiovascular", note: "Tamoxifen and raloxifene carry boxed warnings for blood clots and stroke." },
      { system: "hormonal", note: "Raise LH, FSH and testosterone in men." },
      { system: "mood", note: "Mood changes are reported." },
    ],
    monitoredMarkers: ["lh", "fsh", "total-testosterone", "estradiol"],
    redFlags: ["calf-swelling", "shortness-of-breath", "stroke-signs", "sudden-vision-change"],
    interactions: [],
    sources: [SRC.dailymed],
    review: PENDING,
  },
  {
    key: "cabergoline",
    title: "Cabergoline",
    appliesTo: { compounds: ["Cabergoline"] },
    summary: "Lowers prolactin. Long-term, high-level use is linked to heart valve problems.",
    regulatory: "prescription",
    regulatoryNote: "Prescription drug.",
    systems: [
      { system: "cardiovascular", note: "Linked to heart valve thickening with long-term, high-level use, and can cause low blood pressure and dizziness." },
      { system: "mood", note: "Prescribing information warns of impulse-control problems such as compulsive gambling or spending." },
    ],
    monitoredMarkers: ["prolactin"],
    redFlags: ["shortness-of-breath", "fainting"],
    interactions: [],
    sources: [SRC.dailymed],
    review: PENDING,
  },
  {
    key: "5-alpha-reductase-inhibitors",
    title: "5-alpha-reductase inhibitors",
    appliesTo: { compounds: ["Finasteride", "Dutasteride"] },
    summary: "Block conversion of testosterone to DHT. They also change how a PSA result should be read.",
    regulatory: "prescription",
    regulatoryNote: "Prescription drugs.",
    systems: [
      { system: "prostate", note: "Lower PSA by roughly half. Tell whoever reviews a PSA result that you take one." },
      { system: "hormonal", note: "Sexual side effects such as low libido and erectile problems are reported." },
      { system: "mood", note: "Depression has been reported." },
      { system: "fertility", note: "People who are or may become pregnant should not handle crushed or broken tablets — it can harm a male fetus." },
    ],
    monitoredMarkers: ["psa"],
    redFlags: ["self-harm-thoughts"],
    interactions: [],
    sources: [SRC.dailymed],
    review: PENDING,
  },
  {
    key: "telmisartan",
    title: "Telmisartan",
    appliesTo: { compounds: ["Telmisartan"] },
    summary: "A blood pressure medicine (an ARB). It affects potassium and kidney function.",
    regulatory: "prescription",
    regulatoryNote: "Prescription drug with a boxed warning against use in pregnancy.",
    systems: [
      { system: "kidney", note: "Can raise potassium and affect kidney function, especially with dehydration or anti-inflammatory painkillers." },
      { system: "cardiovascular", note: "Can cause low blood pressure and dizziness." },
    ],
    monitoredMarkers: ["potassium", "creatinine", "egfr"],
    redFlags: ["fainting", "severe-allergic-reaction"],
    interactions: [
      "Potassium supplements and potassium-sparing medicines can push potassium too high.",
      "Anti-inflammatory painkillers such as ibuprofen can add strain on the kidneys.",
    ],
    sources: [SRC.dailymed],
    review: PENDING,
  },
  {
    key: "tadalafil",
    title: "Tadalafil",
    appliesTo: { compounds: ["Tadalafil"] },
    summary: "A PDE5 inhibitor. Its most dangerous interaction is with nitrate medicines.",
    regulatory: "prescription",
    regulatoryNote: "Prescription drug.",
    systems: [
      { system: "cardiovascular", note: "Lowers blood pressure. The drop can be dangerous combined with nitrates or alpha-blockers." },
    ],
    monitoredMarkers: [],
    redFlags: ["priapism", "sudden-vision-change", "chest-pain", "fainting"],
    interactions: [
      "Never combine with nitrate medicines such as nitroglycerin, or with \"poppers\" — blood pressure can fall dangerously.",
      "Alpha-blocker blood pressure medicines add to the drop in blood pressure.",
    ],
    sources: [SRC.dailymed],
    review: PENDING,
  },
  {
    key: "metformin",
    title: "Metformin",
    appliesTo: { compounds: ["Metformin"] },
    summary: "A diabetes medicine that lowers glucose production in the liver.",
    regulatory: "prescription",
    regulatoryNote: "Prescription drug.",
    systems: [
      { system: "metabolic", note: "Long-term use can lower vitamin B12." },
      { system: "kidney", note: "A rare, serious build-up of lactic acid is more likely with poor kidney function or heavy drinking." },
      { system: "digestive", note: "Stomach upset and diarrhea are common." },
    ],
    monitoredMarkers: ["vitamin-b12", "creatinine", "egfr", "glucose", "hba1c"],
    redFlags: [],
    interactions: ["Heavy alcohol use raises the risk of lactic acid build-up."],
    sources: [SRC.dailymed],
    review: PENDING,
  },
  {
    key: "sarms",
    title: "Selective androgen receptor modulators (SARMs)",
    appliesTo: { classes: ["sarms"] },
    summary: "Experimental compounds marketed for muscle gain. None is approved for any use.",
    regulatory: "not-approved",
    regulatoryNote: "Not approved by the FDA for any use. The FDA has warned about liver injury and heart attack and stroke risk. Prohibited in tested sport.",
    systems: [
      { system: "liver", note: "Liver injury has been reported." },
      { system: "lipids", note: "Commonly lower HDL cholesterol." },
      { system: "fertility", note: "Suppress the body's own testosterone production." },
      { system: "sourcing", note: "Products are frequently mislabeled or contain other drugs." },
    ],
    monitoredMarkers: ["alt", "ast", "bilirubin", "hdl", "ldl", "total-testosterone", "lh", "fsh"],
    redFlags: ["jaundice", "dark-urine", "chest-pain", "stroke-signs"],
    interactions: [],
    sources: [SRC.fdaSarms, SRC.livertox, SRC.wada],
    review: PENDING,
  },
  {
    key: "thyroid-hormones",
    title: "Thyroid hormones",
    appliesTo: { classes: ["thyroid"] },
    summary: "More thyroid hormone than the body needs speeds up the heart and, over time, weakens bone.",
    regulatory: "prescription",
    regulatoryNote: "Prescription drugs with a boxed warning against use for weight loss.",
    systems: [
      { system: "cardiovascular", note: "Excess causes a fast heart rate and can trigger abnormal heart rhythms." },
      { system: "bone", note: "Long-term excess is linked to bone loss." },
      { system: "thyroid", note: "Suppresses the body's own thyroid signalling." },
    ],
    monitoredMarkers: ["tsh", "free-t4", "free-t3"],
    redFlags: ["irregular-heartbeat", "chest-pain"],
    interactions: ["Can strengthen the effect of blood thinners such as warfarin."],
    sources: [SRC.dailymed],
    review: PENDING,
  },
  {
    key: "clenbuterol",
    title: "Clenbuterol",
    appliesTo: { classes: ["beta_agonists"] },
    summary: "A veterinary airway drug. Poison-center reports link it to heart problems.",
    regulatory: "not-approved",
    regulatoryNote: "Not approved for human use in the United States. Prohibited in tested sport.",
    systems: [
      { system: "cardiovascular", note: "Fast heart rate, palpitations and heart muscle injury are reported." },
      { system: "metabolic", note: "Can lower potassium and raise blood sugar." },
    ],
    monitoredMarkers: ["potassium", "glucose"],
    redFlags: ["chest-pain", "irregular-heartbeat", "fainting"],
    interactions: [],
    sources: [SRC.wada, SRC.endocrinePed],
    review: PENDING,
  },
  {
    key: "insulin",
    title: "Insulin",
    appliesTo: { classes: ["insulin"] },
    summary: "Drives sugar into cells. Non-medical use carries a high risk of severe, life-threatening low blood sugar.",
    regulatory: "prescription",
    regulatoryNote: "Prescription drug for diabetes. Prohibited in tested sport for non-diabetic athletes.",
    systems: [
      { system: "metabolic", note: "Severe low blood sugar can cause seizures, loss of consciousness and death." },
      { system: "kidney", note: "Also lowers blood potassium." },
    ],
    monitoredMarkers: ["glucose", "potassium"],
    redFlags: ["low-blood-sugar", "fainting"],
    interactions: ["Alcohol and other glucose-lowering drugs deepen low blood sugar."],
    sources: [SRC.dailymed, SRC.endocrinePed, SRC.wada],
    review: PENDING,
  },
  {
    key: "melanocortins",
    title: "Melanocortin peptides",
    appliesTo: { classes: ["melanocortins"] },
    summary: "Peptides that act on skin pigmentation and sexual arousal pathways.",
    regulatory: "varies",
    regulatoryNote: "Melanotan II is not approved for human use. Bremelanotide is a prescription drug for one medical use.",
    systems: [
      { system: "skin", note: "Darkening of skin and moles. Any mole that changes shape, size or color needs a doctor's review." },
      { system: "cardiovascular", note: "Can briefly raise blood pressure." },
      { system: "digestive", note: "Nausea and flushing are common." },
    ],
    monitoredMarkers: [],
    redFlags: ["priapism", "chest-pain", "severe-headache"],
    interactions: [],
    sources: [SRC.fdaCompounding, SRC.dailymed],
    review: PENDING,
  },
  {
    key: "dietary-supplements",
    title: "Dietary supplements",
    appliesTo: { classes: ["supplements", "vitamins", "nootropics", "recovery"] },
    summary: "Supplements are not reviewed by the FDA for safety or effectiveness before sale, and label accuracy varies.",
    regulatory: "supplement",
    regulatoryNote: "Sold as dietary supplements. Third-party tested products reduce the risk of contamination.",
    systems: [
      { system: "sourcing", note: "Some supplements have been found to contain undeclared drugs." },
    ],
    monitoredMarkers: [],
    redFlags: [],
    interactions: [],
    sources: [SRC.ods],
    review: PENDING,
  },
  {
    key: "creatine",
    title: "Creatine",
    appliesTo: { compounds: ["Creatine Monohydrate"] },
    summary: "One of the most studied supplements. It raises blood creatinine, which can be mistaken for a kidney problem.",
    regulatory: "supplement",
    regulatoryNote: "Dietary supplement.",
    systems: [
      { system: "kidney", note: "Raises blood creatinine and can lower a calculated eGFR without kidney damage. Cystatin C is not affected by it, so it is the cleaner read. Tell whoever reads your kidney labs that you take it." },
    ],
    monitoredMarkers: ["creatinine", "egfr", "cystatin-c"],
    redFlags: [],
    interactions: [],
    sources: [SRC.ods],
    review: PENDING,
  },
  {
    key: "dhea",
    title: "DHEA",
    appliesTo: { compounds: ["DHEA"] },
    summary: "A hormone precursor the body turns into testosterone and estrogen.",
    regulatory: "supplement",
    regulatoryNote: "Sold as a supplement in the United States. Prohibited in tested sport.",
    systems: [
      { system: "hormonal", note: "Can raise testosterone and estradiol, causing acne and hair changes." },
    ],
    monitoredMarkers: ["dhea-s", "estradiol", "total-testosterone"],
    redFlags: [],
    interactions: [],
    sources: [SRC.ods, SRC.wada],
    review: PENDING,
  },
  {
    key: "vitamin-d",
    title: "Vitamin D",
    appliesTo: { compounds: ["Vitamin D3"] },
    summary: "A fat-soluble vitamin that builds up in the body.",
    regulatory: "supplement",
    regulatoryNote: "Dietary supplement.",
    systems: [
      { system: "kidney", note: "Excess raises blood calcium, which can cause kidney stones and heart rhythm problems." },
    ],
    monitoredMarkers: ["vitamin-d", "calcium"],
    redFlags: [],
    interactions: [],
    sources: [SRC.ods],
    review: PENDING,
  },
  {
    key: "vitamin-b12",
    title: "Vitamin B12",
    appliesTo: { compounds: ["Vitamin B12 (Methylcobalamin)"] },
    summary: "Generally well tolerated. Supplementing raises blood B12, which matters when B12 is tested.",
    regulatory: "supplement",
    regulatoryNote: "Dietary supplement; injectable forms are prescription products.",
    systems: [
      { system: "blood", note: "Tell whoever orders a B12 test that you supplement, so the result is read correctly." },
    ],
    monitoredMarkers: ["vitamin-b12"],
    redFlags: [],
    interactions: [],
    sources: [SRC.ods],
    review: PENDING,
  },
  {
    key: "zinc",
    title: "Zinc",
    appliesTo: { compounds: ["Zinc"] },
    summary: "An essential mineral. Long-term high intake depletes copper.",
    regulatory: "supplement",
    regulatoryNote: "Dietary supplement.",
    systems: [
      { system: "blood", note: "Long-term high intake can cause copper deficiency, which affects blood cells and nerves. A published case of years of high intake produced marked anemia and severe neutropenia, reversing over months after stopping." },
      { system: "lipids", note: "High intake has been shown to lower HDL cholesterol in healthy adults — the same direction anabolic steroids push it." },
    ],
    monitoredMarkers: ["zinc", "hdl", "hemoglobin", "wbc"],
    redFlags: [],
    interactions: ["Can reduce absorption of some antibiotics."],
    sources: [SRC.ods],
    review: PENDING,
  },
  {
    key: "garlic",
    title: "Garlic",
    appliesTo: { compounds: ["Garlic Extract"] },
    summary: "A food and a supplement. Concentrated supplements carry a bleeding risk that the food does not.",
    regulatory: "supplement",
    regulatoryNote: "Dietary supplement.",
    systems: [
      { system: "blood", note: "NCCIH states garlic supplements may increase the risk of bleeding. That matters alongside anything else that thins the blood, and before any surgery or dental work." },
    ],
    monitoredMarkers: ["platelets", "hematocrit"],
    redFlags: [],
    interactions: ["May add to the bleeding risk of anticoagulants and aspirin. Tell your surgeon or dentist before any procedure."],
    sources: [SRC.nccihGarlic],
    review: PENDING,
  },
  {
    key: "potassium",
    title: "Potassium",
    appliesTo: { compounds: ["Potassium"] },
    summary: "An essential mineral cleared by the kidneys. Too much in the blood is a medical emergency.",
    regulatory: "supplement",
    regulatoryNote: "Dietary supplement.",
    systems: [
      { system: "kidney", note: "Potassium supplements are a listed cause of high blood potassium, alongside ACE inhibitors, ARBs, potassium-sparing diuretics and NSAIDs. Reduced kidney filtering raises the risk, and blood potassium climbs once filtering falls far enough." },
      { system: "cardiovascular", note: "High blood potassium can cause a life-threatening heart rhythm. Potassium and kidney markers on your own lab reports are the direct way to see this area." },
    ],
    monitoredMarkers: ["potassium", "creatinine", "egfr"],
    redFlags: ["irregular-heartbeat", "fainting"],
    interactions: ["Adds to the potassium-raising effect of ACE inhibitors, ARBs, potassium-sparing diuretics and NSAIDs."],
    sources: [SRC.statpearlsHyperkalemia],
    review: PENDING,
  },
  {
    key: "magnesium",
    title: "Magnesium",
    appliesTo: { compounds: ["Magnesium Glycinate"] },
    summary: "An essential mineral. The kidneys clear excess, so kidney function matters.",
    regulatory: "supplement",
    regulatoryNote: "Dietary supplement.",
    systems: [
      { system: "kidney", note: "People with reduced kidney function can build up magnesium." },
      { system: "digestive", note: "High supplemental intake commonly causes diarrhea." },
    ],
    monitoredMarkers: ["magnesium", "creatinine"],
    redFlags: [],
    interactions: ["Can reduce absorption of some antibiotics and osteoporosis medicines."],
    sources: [SRC.ods],
    review: PENDING,
  },
  {
    key: "iron",
    title: "Iron",
    appliesTo: { compounds: ["Iron"] },
    summary: "The body has no active way to remove excess iron, so it accumulates.",
    regulatory: "supplement",
    regulatoryNote: "Dietary supplement.",
    systems: [
      { system: "liver", note: "Iron overload can damage the liver, heart and pancreas." },
      { system: "sourcing", note: "Accidental iron overdose is dangerous for children — store it out of reach." },
    ],
    monitoredMarkers: ["ferritin", "iron"],
    redFlags: ["severe-abdominal-pain"],
    interactions: ["Reduces absorption of thyroid medicine and some antibiotics."],
    sources: [SRC.ods],
    review: PENDING,
  },
  {
    key: "fish-oil",
    title: "Fish oil (omega-3)",
    appliesTo: { compounds: ["Fish Oil"] },
    summary: "Generally well tolerated.",
    regulatory: "supplement",
    regulatoryNote: "Dietary supplement; some high-purity forms are prescription drugs.",
    systems: [
      { system: "blood", note: "Can add to bleeding risk alongside blood thinners." },
    ],
    monitoredMarkers: ["triglycerides"],
    redFlags: [],
    interactions: ["Adds to bleeding risk with blood thinners such as warfarin."],
    sources: [SRC.ods],
    review: PENDING,
  },
  {
    key: "coq10",
    title: "Coenzyme Q10",
    appliesTo: { compounds: ["CoQ10"] },
    summary: "Generally well tolerated.",
    regulatory: "supplement",
    regulatoryNote: "Dietary supplement.",
    systems: [
      { system: "blood", note: "May weaken the effect of warfarin." },
    ],
    monitoredMarkers: [],
    redFlags: [],
    interactions: ["May weaken the effect of warfarin."],
    sources: [SRC.ods],
    review: PENDING,
  },
  {
    key: "berberine",
    title: "Berberine",
    appliesTo: { compounds: ["Berberine"] },
    summary: "A plant compound that lowers blood sugar and interacts with many medicines.",
    regulatory: "supplement",
    regulatoryNote: "Dietary supplement.",
    systems: [
      { system: "metabolic", note: "Lowers blood sugar, adding to diabetes medicines." },
    ],
    monitoredMarkers: ["glucose", "hba1c"],
    redFlags: ["low-blood-sugar"],
    interactions: ["Changes how the liver processes many prescription medicines."],
    sources: [SRC.ods],
    review: PENDING,
  },
  {
    key: "electrolytes",
    title: "Electrolyte products",
    appliesTo: { compounds: ["Electrolytes"] },
    summary: "Powders and tablets that supply sodium, potassium and often magnesium.",
    regulatory: "supplement",
    regulatoryNote: "Dietary supplement or food product.",
    systems: [
      { system: "cardiovascular", note: "Added sodium can work against blood pressure." },
      { system: "kidney", note: "Potassium adds to medicines that raise potassium, and kidneys clear both." },
    ],
    monitoredMarkers: ["sodium", "potassium"],
    redFlags: [],
    interactions: ["Potassium adds to blood-pressure medicines that raise potassium, such as telmisartan, lisinopril or spironolactone."],
    sources: [SRC.ods, SRC.dailymed],
    review: PENDING,
  },
  {
    key: "multivitamin",
    title: "Multivitamin",
    appliesTo: { compounds: ["Multivitamin"] },
    summary: "Generally well tolerated. Some nutrients build up when several products overlap.",
    regulatory: "supplement",
    regulatoryNote: "Dietary supplement.",
    systems: [
      { system: "liver", note: "Vitamin A from several overlapping products can build up and affect the liver." },
      { system: "sourcing", note: "Products containing iron are dangerous to children — store them out of reach." },
    ],
    monitoredMarkers: [],
    redFlags: [],
    interactions: ["Vitamin K can weaken the effect of warfarin."],
    sources: [SRC.ods],
    review: PENDING,
  },
  {
    key: "green-tea-extract",
    title: "Green tea extract",
    appliesTo: { compounds: ["Green Tea Extract"] },
    summary: "A concentrated extract found in fat-burner and thermogenic products. It is a well established cause of liver injury. Drinking green tea is not the same thing.",
    regulatory: "supplement",
    regulatoryNote: "Dietary supplement.",
    systems: [
      { system: "liver", note: "More than a hundred published cases of liver injury, typically one to six months after starting. In one US series of 40 cases, a third were severe and around one in twelve needed a liver transplant. There is no clear safe amount, and taking it again after a reaction brings the injury back quickly." },
    ],
    monitoredMarkers: ["alt", "ast", "bilirubin"],
    redFlags: ["jaundice", "dark-urine"],
    interactions: [],
    sources: [SRC.livertoxGreenTea],
    review: PENDING,
  },
  {
    key: "turmeric",
    title: "Turmeric and curcumin",
    appliesTo: { compounds: ["Turmeric"] },
    summary: "Taken for joints and inflammation. LiverTox reports it has become the most common cause of clearly identified herbal liver injury in the United States.",
    regulatory: "supplement",
    regulatoryNote: "Dietary supplement.",
    systems: [
      { system: "liver", note: "Liver injury typically one to four months after starting, with liver enzymes often above 1,000 and jaundice. Deaths and transplants have been reported. Products built for higher absorption, using black pepper or lipid delivery, are the ones most often linked to it." },
    ],
    monitoredMarkers: ["alt", "ast", "bilirubin"],
    redFlags: ["jaundice", "dark-urine"],
    interactions: [],
    sources: [SRC.livertoxTurmeric],
    review: PENDING,
  },
  {
    key: "garcinia-cambogia",
    title: "Garcinia cambogia",
    appliesTo: { compounds: ["Garcinia Cambogia"] },
    summary: "Sold for weight loss. A likely cause of liver injury.",
    regulatory: "supplement",
    regulatoryNote: "Dietary supplement.",
    systems: [
      { system: "liver", note: "Liver injury typically one to four weeks after starting. Severe cases have caused liver failure needing an urgent transplant, and deaths have been reported." },
    ],
    monitoredMarkers: ["alt", "ast", "bilirubin"],
    redFlags: ["jaundice", "dark-urine"],
    interactions: [],
    sources: [SRC.livertoxGarcinia],
    review: PENDING,
  },
  {
    key: "red-yeast-rice",
    title: "Red yeast rice",
    appliesTo: { compounds: ["Red Yeast Rice"] },
    summary: "Sold for cholesterol. It contains monacolin K, which is the same molecule as the prescription statin lovastatin.",
    regulatory: "supplement",
    regulatoryNote: "Sold as a dietary supplement, although what it contains is a statin.",
    systems: [
      { system: "liver", note: "Reported liver injury similar to what happens with lovastatin." },
      { system: "lipids", note: "Lowers LDL cholesterol the way a statin does." },
    ],
    monitoredMarkers: ["alt", "ast", "ldl", "ck"],
    redFlags: ["jaundice", "dark-urine"],
    interactions: ["Tested capsules varied about a hundredfold in how much statin they contained, so what is in a given product is unknown. Some tested products also contained citrinin, which affects the kidneys.", "Carries the same muscle-injury concern as a statin."],
    sources: [SRC.livertoxRedYeastRice],
    review: PENDING,
  },
  {
    key: "niacin-high-dose",
    title: "Niacin at cholesterol amounts",
    appliesTo: { compounds: ["Niacin"] },
    summary: "Vitamin B3. At the amounts sold for cholesterol it behaves like a drug, and it is an established cause of liver injury at those amounts.",
    regulatory: "supplement",
    regulatoryNote: "Sold as a supplement and also prescribed as a medicine at cholesterol amounts.",
    systems: [
      { system: "liver", note: "Liver enzyme rises in up to one in five people taking the larger amounts sold for cholesterol, and more often still at the highest. Slow-release forms cause more injury, and liver failure, transplant and death have been reported." },
      { system: "metabolic", note: "Raises blood sugar and has been linked to new diabetes." },
      { system: "lipids", note: "Raises HDL and lowers LDL, but two large trials found no reduction in heart events." },
    ],
    monitoredMarkers: ["alt", "ast", "bilirubin", "glucose", "hba1c", "hdl", "ldl"],
    redFlags: ["jaundice", "dark-urine"],
    interactions: [],
    sources: [SRC.livertoxNiacin],
    review: PENDING,
  },
  {
    key: "biotin",
    title: "Biotin",
    appliesTo: { compounds: ["Biotin"] },
    summary: "Vitamin B7, sold for hair, skin and nails and included in many multivitamins. It can make blood test results wrong.",
    regulatory: "supplement",
    regulatoryNote: "Dietary supplement.",
    systems: [
      { system: "hormonal", note: "Biotin interferes with many laboratory tests, including hormone and thyroid tests, so results can read falsely high or falsely low. Hair, skin and nail products can contain hundreds of times the amount found in food. Tell the lab and your clinician that you take it." },
    ],
    monitoredMarkers: ["tsh", "free-t4", "free-t3", "total-testosterone", "estradiol"],
    redFlags: [],
    interactions: ["Interferes with laboratory tests that use biotin in the assay, including many hormone and thyroid tests."],
    sources: [SRC.statpearlsBiotin],
    review: PENDING,
  },
  {
    key: "licorice-root",
    title: "Licorice root",
    appliesTo: { compounds: ["Licorice Root"] },
    summary: "A herb found in digestive, throat and adrenal-support products. It raises blood pressure.",
    regulatory: "supplement",
    regulatoryNote: "Dietary supplement.",
    systems: [
      { system: "cardiovascular", note: "Glycyrrhizin raises blood pressure and lowers potassium. Irregular heartbeat and cardiac arrest have been reported, especially with large amounts, long use, a high-salt diet, existing high blood pressure, or heart or kidney conditions." },
    ],
    monitoredMarkers: ["potassium"],
    redFlags: ["chest-pain", "fainting"],
    interactions: ["Reported interactions with corticosteroids."],
    sources: [SRC.nccihLicorice],
    review: PENDING,
  },
  {
    key: "tudca",
    title: "TUDCA",
    appliesTo: { compounds: ["TUDCA"] },
    summary: "A bile acid sold as a supplement, closely related to the prescription drug ursodiol.",
    regulatory: "supplement",
    regulatoryNote: "Sold as a dietary supplement. Its close relative ursodiol is a prescription drug.",
    systems: [
      { system: "digestive", note: "Diarrhea and stomach upset are the most reported effects." },
    ],
    monitoredMarkers: [],
    redFlags: [],
    interactions: ["Bile acid binders and aluminum-based antacids reduce absorption of ursodiol, its close relative."],
    sources: [SRC.livertox],
    review: PENDING,
  },
  {
    key: "milk-thistle",
    title: "Milk thistle",
    appliesTo: { compounds: ["Milk Thistle"] },
    summary: "A plant extract (silymarin). Generally well tolerated in studies.",
    regulatory: "supplement",
    regulatoryNote: "Dietary supplement.",
    systems: [
      { system: "digestive", note: "Stomach upset and loose stools." },
      { system: "metabolic", note: "May lower blood sugar." },
    ],
    monitoredMarkers: [],
    redFlags: ["severe-allergic-reaction"],
    interactions: ["May add to glucose-lowering medicines.", "People allergic to ragweed and related plants can react to it."],
    sources: [SRC.nccih, SRC.livertox],
    review: PENDING,
  },
  {
    key: "n-acetyl-cysteine",
    title: "N-acetyl cysteine (NAC)",
    appliesTo: { compounds: ["N-Acetyl Cysteine"] },
    summary: "An amino acid derivative that is also an approved prescription drug.",
    regulatory: "supplement",
    regulatoryNote: "Also an approved drug. The FDA allows its sale as a dietary supplement under a 2022 enforcement policy.",
    systems: [
      { system: "digestive", note: "Nausea, vomiting and stomach upset." },
      { system: "cardiovascular", note: "Can strengthen the blood-pressure-lowering effect of nitroglycerin." },
      { system: "kidney", note: "Makes a creatinine result read lower than it is by interfering with the test itself, while cystatin C and true kidney filtering are unchanged. It is a measurement effect, not better kidney function." },
    ],
    monitoredMarkers: ["creatinine", "egfr", "cystatin-c"],
    redFlags: ["severe-allergic-reaction"],
    interactions: ["Can strengthen the effect of nitroglycerin, causing low blood pressure and headache."],
    sources: [SRC.fdaNac, SRC.dailymed],
    review: PENDING,
  },
  {
    key: "psyllium",
    title: "Psyllium husk",
    appliesTo: { compounds: ["Psyllium Husk"] },
    summary: "A soluble fiber. It swells with water.",
    regulatory: "supplement",
    regulatoryNote: "Sold as a dietary supplement and as an over-the-counter fiber product.",
    systems: [
      { system: "digestive", note: "Bloating and gas. Without enough fluid it can cause choking or a bowel blockage." },
      { system: "metabolic", note: "Can lower blood sugar after meals." },
    ],
    monitoredMarkers: [],
    redFlags: ["severe-abdominal-pain"],
    interactions: ["Can reduce absorption of medicines swallowed at the same time.", "May add to glucose-lowering medicines."],
    sources: [SRC.ods, SRC.dailymed],
    review: PENDING,
  },
  {
    key: "caffeine",
    title: "Caffeine",
    appliesTo: { compounds: ["Caffeine"] },
    summary: "A stimulant. Concentrated powders and liquids have caused deaths.",
    regulatory: "supplement",
    regulatoryNote: "The FDA has warned against pure and highly concentrated caffeine products.",
    systems: [
      { system: "cardiovascular", note: "High intake raises heart rate and blood pressure and can trigger abnormal rhythms." },
      { system: "mood", note: "Anxiety and poor sleep." },
    ],
    monitoredMarkers: [],
    redFlags: ["irregular-heartbeat", "chest-pain"],
    interactions: ["Stimulants taken together add to the strain on the heart."],
    sources: [SRC.ods],
    review: PENDING,
  },
  {
    key: "melatonin",
    title: "Melatonin",
    appliesTo: { compounds: ["Melatonin"] },
    summary: "A sleep hormone. Actual content often differs from the label.",
    regulatory: "supplement",
    regulatoryNote: "Dietary supplement in the United States.",
    systems: [
      { system: "mood", note: "Next-day drowsiness is common — take care driving." },
    ],
    monitoredMarkers: [],
    redFlags: [],
    interactions: ["Adds to drowsiness from alcohol and sedating medicines."],
    sources: [SRC.ods],
    review: PENDING,
  },
  {
    key: "vitamin-c",
    title: "Vitamin C",
    appliesTo: { compounds: ["Vitamin C"] },
    summary: "An essential vitamin. The body turns part of it into oxalate, which matters for the kidneys at high intake.",
    regulatory: "supplement",
    regulatoryNote: "Dietary supplement.",
    systems: [
      { system: "kidney", note: "High intake over long periods raises oxalate in the urine. The NIH notes a possible link to kidney stones, and published cases describe oxalate crystals damaging the kidneys after years of high intake, where kidney function was already reduced. Creatinine and eGFR on your own lab reports are the direct way to see this area." },
    ],
    monitoredMarkers: ["creatinine", "egfr"],
    redFlags: [],
    interactions: [],
    sources: [SRC.odsVitaminC, SRC.vitaminCOxalosis],
    review: PENDING,
  },
  {
    key: "cinnamon",
    title: "Cinnamon",
    appliesTo: { compounds: ["Cinnamon"] },
    summary: "A spice sold as a supplement for blood sugar. The common kind in the United States carries a liver concern.",
    regulatory: "supplement",
    regulatoryNote: "Dietary supplement.",
    systems: [
      { system: "liver", note: "Cassia cinnamon, the type most sold in the United States, contains coumarin. NCCIH notes coumarin might cause or worsen liver disease in some people. Labels often do not say which type of cinnamon a product uses." },
    ],
    monitoredMarkers: ["alt", "ast", "bilirubin"],
    redFlags: ["jaundice", "dark-urine"],
    interactions: [],
    sources: [SRC.nccihCinnamon],
    review: PENDING,
  },
  {
    key: "kava",
    title: "Kava",
    appliesTo: { compounds: ["Kava"] },
    summary: "A plant sold for relaxation and sleep, often inside blends. It has been linked to severe liver injury.",
    regulatory: "supplement",
    regulatoryNote: "Dietary supplement. The FDA issued a consumer advisory about liver injury in 2002.",
    systems: [
      { system: "liver", note: "Linked to severe liver injury, including hepatitis, liver failure and cases that needed a liver transplant. It is often an ingredient inside sleep and relaxation blends rather than the name on the front." },
      { system: "mood", note: "Adds to drowsiness, which matters for driving and alongside alcohol or sedating medicines." },
    ],
    monitoredMarkers: ["alt", "ast", "bilirubin"],
    redFlags: ["jaundice", "dark-urine"],
    interactions: ["Adds to the effects of alcohol and sedating medicines."],
    sources: [SRC.nccihKava],
    review: PENDING,
  },
  {
    key: "ashwagandha",
    title: "Ashwagandha",
    appliesTo: { compounds: ["Ashwagandha"] },
    summary: "A herb taken for sleep, stress and mood. LiverTox lists it as a likely cause of liver injury.",
    regulatory: "supplement",
    regulatoryNote: "Dietary supplement.",
    systems: [
      { system: "liver", note: "Around two dozen published cases of liver injury with jaundice and itching, typically two to twelve weeks after starting. Most recover in one to four months, but deaths and emergency liver transplants have been reported, particularly with existing liver disease. That window and pattern resemble the liver injury oral steroids cause, so the two can be hard to tell apart." },
    ],
    monitoredMarkers: ["alt", "ast", "bilirubin", "alk-phos"],
    redFlags: ["jaundice", "dark-urine"],
    interactions: ["May interact with thyroid, blood sugar and sedating medicines.", "LiverTox advises against it with cirrhosis or advanced liver disease."],
    sources: [SRC.livertoxAshwagandha, SRC.ods],
    review: PENDING,
  },
];

/* ─── Resolution ──────────────────────────────────────────────────────── */

export type CompoundIdentity = {
  name: string;
  officialName?: string;
  compoundClass?: string;
};

const PROFILE_BY_COMPOUND = new Map<string, RiskProfile[]>();
const PROFILE_BY_CLASS = new Map<string, RiskProfile[]>();
for (const profile of RISK_PROFILES) {
  for (const compound of profile.appliesTo.compounds ?? []) {
    PROFILE_BY_COMPOUND.set(compound.toLowerCase(), [...(PROFILE_BY_COMPOUND.get(compound.toLowerCase()) ?? []), profile]);
  }
  for (const cls of profile.appliesTo.classes ?? []) {
    PROFILE_BY_CLASS.set(cls, [...(PROFILE_BY_CLASS.get(cls) ?? []), profile]);
  }
}

/** Official name and class for a logged compound — catalog first, then the entry's own fields. */
export function resolveCompoundIdentity(compound: CompoundIdentity): { officialName: string | null; compoundClass: string | null } {
  const catalog = findCatalogEntry(compound.officialName ?? "") ?? findCatalogEntry(compound.name);
  return {
    officialName: catalog?.officialName ?? compound.officialName ?? null,
    compoundClass: catalog?.compoundClass ?? compound.compoundClass ?? null,
  };
}

/** Compound-specific profiles first, then the class profile. Never duplicated. */
export function profilesForCompound(compound: CompoundIdentity): RiskProfile[] {
  const { officialName, compoundClass } = resolveCompoundIdentity(compound);
  const out: RiskProfile[] = [];
  const push = (profiles: RiskProfile[] | undefined) => {
    for (const profile of profiles ?? []) if (!out.includes(profile)) out.push(profile);
  };
  if (officialName) push(PROFILE_BY_COMPOUND.get(officialName.toLowerCase()));
  if (compoundClass) push(PROFILE_BY_CLASS.get(compoundClass));
  return out;
}

export type CompoundRiskBrief = {
  profiles: Array<{ profile: RiskProfile; compoundNames: string[] }>;
  /** For each marker, the logged compounds it is commonly watched for. */
  markerLinks: Partial<Record<MarkerKey, string[]>>;
  redFlags: RedFlagKey[];
  /** Logged compounds Reserve has no profile for yet. */
  unprofiledNames: string[];
};

function displayName(compound: CompoundIdentity): string {
  return compound.name.trim() || compound.officialName || "Unnamed compound";
}

export function buildCompoundRiskBrief(compounds: CompoundIdentity[]): CompoundRiskBrief {
  const byProfile = new Map<RiskProfile, string[]>();
  const markerLinks: Partial<Record<MarkerKey, string[]>> = {};
  const redFlags = new Set<RedFlagKey>();
  const unprofiledNames: string[] = [];

  for (const compound of compounds) {
    const name = displayName(compound);
    const profiles = profilesForCompound(compound);
    if (profiles.length === 0) {
      unprofiledNames.push(name);
      continue;
    }
    for (const profile of profiles) {
      const names = byProfile.get(profile) ?? [];
      if (!names.includes(name)) names.push(name);
      byProfile.set(profile, names);
      for (const marker of profile.monitoredMarkers) {
        const linked = markerLinks[marker] ?? [];
        if (!linked.includes(name)) linked.push(name);
        markerLinks[marker] = linked;
      }
      for (const flag of profile.redFlags) redFlags.add(flag);
    }
  }

  return {
    profiles: [...byProfile.entries()].map(([profile, compoundNames]) => ({ profile, compoundNames })),
    markerLinks,
    redFlags: [...redFlags],
    unprofiledNames,
  };
}
