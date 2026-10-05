import type { EnhancementCategory } from "@/lib/athlete-store";

/**
 * Reserve Compound Catalog
 *
 * Official-name + alias catalog only. NO recommended doses, NO cycle guidance,
 * NO medical claims. Used solely for clean dropdown selection and label
 * normalization in the Compound Command module. Members can also enter a
 * fully custom name; the catalog is a convenience layer, not a gate.
 */

export type CompoundRoute = "oral" | "injectable" | "topical" | "nasal" | "other";
export type CompoundInjectionType = "subq" | "im" | "other" | "none";

export type CompoundClassKey =
  | "peptides_glp1"
  | "peptides_dual_agonists"
  | "peptides_triple_agonists"
  | "growth_hormone"
  | "peptides_growth"
  | "peptides_healing"
  | "peptides_mitochondrial"
  | "cellular_nad"
  | "hormones_testosterone"
  | "hormones_other"
  | "aas"
  | "ancillaries"
  | "sarms"
  | "thyroid"
  | "beta_agonists"
  | "insulin"
  | "melanocortins"
  | "medications"
  | "supplements"
  | "vitamins"
  | "nootropics"
  | "recovery"
  | "other";

export type CompoundCatalogEntry = {
  officialName: string;
  aliases: string[];
  category: EnhancementCategory;
  compoundClass: CompoundClassKey;
  classLabel: string;
  routes: CompoundRoute[];
  units: string[];
  /** Visible safety footer — same string everywhere it surfaces. */
  controlledCopy: string;
};

const SAFETY = "Member/provider-entered schedule only. Reserve does not prescribe or adjust dosing.";

export const COMPOUND_CATALOG: CompoundCatalogEntry[] = [
  // GLP-1 / metabolic
  { officialName: "Semaglutide", aliases: ["Sema", "Ozempic", "Wegovy"], category: "peptide", compoundClass: "peptides_glp1", classLabel: "GLP-1", routes: ["injectable"], units: ["mg", "mcg"], controlledCopy: SAFETY },
  { officialName: "Liraglutide", aliases: ["Victoza", "Saxenda"], category: "peptide", compoundClass: "peptides_glp1", classLabel: "GLP-1", routes: ["injectable"], units: ["mg", "mcg"], controlledCopy: SAFETY },
  { officialName: "Tirzepatide", aliases: ["Tirz", "Mounjaro", "Zepbound"], category: "peptide", compoundClass: "peptides_dual_agonists", classLabel: "GLP-1 / GIP", routes: ["injectable"], units: ["mg", "mcg"], controlledCopy: SAFETY },
  { officialName: "Retatrutide", aliases: ["Reta", "GLP-3"], category: "peptide", compoundClass: "peptides_triple_agonists", classLabel: "GLP-1 / GIP / Glucagon", routes: ["injectable"], units: ["mg", "mcg"], controlledCopy: SAFETY },
  { officialName: "Exenatide", aliases: ["Byetta", "Bydureon"], category: "peptide", compoundClass: "peptides_glp1", classLabel: "GLP-1", routes: ["injectable"], units: ["mcg"], controlledCopy: SAFETY },
  { officialName: "Dulaglutide", aliases: ["Trulicity"], category: "peptide", compoundClass: "peptides_glp1", classLabel: "GLP-1", routes: ["injectable"], units: ["mg"], controlledCopy: SAFETY },
  { officialName: "Cagrilintide", aliases: ["Cagri"], category: "peptide", compoundClass: "peptides_dual_agonists", classLabel: "Amylin analogue", routes: ["injectable"], units: ["mg", "mcg"], controlledCopy: SAFETY },
  { officialName: "Survodutide", aliases: [], category: "peptide", compoundClass: "peptides_dual_agonists", classLabel: "GLP-1 / Glucagon", routes: ["injectable"], units: ["mg", "mcg"], controlledCopy: SAFETY },
  { officialName: "Mazdutide", aliases: [], category: "peptide", compoundClass: "peptides_dual_agonists", classLabel: "GLP-1 / Glucagon", routes: ["injectable"], units: ["mg", "mcg"], controlledCopy: SAFETY },

  // Growth hormone
  { officialName: "Somatropin", aliases: ["HGH", "GH", "rhGH", "Human Growth Hormone", "Growth Hormone"], category: "hormone", compoundClass: "growth_hormone", classLabel: "Growth hormone", routes: ["injectable"], units: ["iu", "mg"], controlledCopy: SAFETY },
  { officialName: "Sermorelin", aliases: ["GRF 1-29"], category: "peptide", compoundClass: "peptides_growth", classLabel: "Peptide / Growth", routes: ["injectable"], units: ["mcg", "mg"], controlledCopy: SAFETY },

  // Growth / recovery peptides
  { officialName: "Ipamorelin", aliases: ["Ipa"], category: "peptide", compoundClass: "peptides_growth", classLabel: "Peptide / Growth", routes: ["injectable"], units: ["mcg", "mg"], controlledCopy: SAFETY },
  { officialName: "CJC-1295", aliases: ["CJC"], category: "peptide", compoundClass: "peptides_growth", classLabel: "Peptide / Growth", routes: ["injectable"], units: ["mcg", "mg"], controlledCopy: SAFETY },
  { officialName: "CJC-1295 DAC", aliases: ["CJC DAC", "DAC"], category: "peptide", compoundClass: "peptides_growth", classLabel: "Peptide / Growth", routes: ["injectable"], units: ["mcg", "mg"], controlledCopy: SAFETY },
  { officialName: "Tesamorelin", aliases: [], category: "peptide", compoundClass: "peptides_growth", classLabel: "Peptide / Growth", routes: ["injectable"], units: ["mg"], controlledCopy: SAFETY },
  { officialName: "IGF-1 LR3", aliases: ["IGF1-LR3", "IGF LR3", "Long R3 IGF-1"], category: "peptide", compoundClass: "peptides_growth", classLabel: "Peptide / Growth", routes: ["injectable"], units: ["mcg"], controlledCopy: SAFETY },
  { officialName: "IGF-1 DES", aliases: ["IGF DES"], category: "peptide", compoundClass: "peptides_growth", classLabel: "Peptide / Growth", routes: ["injectable"], units: ["mcg"], controlledCopy: SAFETY },
  { officialName: "GHRP-2", aliases: [], category: "peptide", compoundClass: "peptides_growth", classLabel: "Peptide / Growth", routes: ["injectable"], units: ["mcg"], controlledCopy: SAFETY },
  { officialName: "GHRP-6", aliases: [], category: "peptide", compoundClass: "peptides_growth", classLabel: "Peptide / Growth", routes: ["injectable"], units: ["mcg"], controlledCopy: SAFETY },
  { officialName: "Hexarelin", aliases: ["Examorelin"], category: "peptide", compoundClass: "peptides_growth", classLabel: "Peptide / Growth", routes: ["injectable"], units: ["mcg"], controlledCopy: SAFETY },
  { officialName: "AOD-9604", aliases: ["AOD9604", "AOD"], category: "peptide", compoundClass: "peptides_growth", classLabel: "Peptide / Growth", routes: ["injectable"], units: ["mcg", "mg"], controlledCopy: SAFETY },
  { officialName: "HGH Fragment 176-191", aliases: ["HGH Frag", "Frag 176-191", "Fragment 176-191"], category: "peptide", compoundClass: "peptides_growth", classLabel: "Peptide / Growth", routes: ["injectable"], units: ["mcg"], controlledCopy: SAFETY },
  { officialName: "Follistatin-344", aliases: ["Follistatin", "FST-344"], category: "peptide", compoundClass: "peptides_growth", classLabel: "Peptide / Growth", routes: ["injectable"], units: ["mcg"], controlledCopy: SAFETY },
  { officialName: "BPC-157", aliases: [], category: "peptide", compoundClass: "peptides_healing", classLabel: "Peptide / Healing", routes: ["injectable", "oral"], units: ["mcg", "mg"], controlledCopy: SAFETY },
  { officialName: "TB-500", aliases: ["Thymosin Beta-4", "TB500"], category: "peptide", compoundClass: "peptides_healing", classLabel: "Peptide / Healing", routes: ["injectable"], units: ["mg"], controlledCopy: SAFETY },
  { officialName: "GHK-Cu", aliases: ["GHK", "Copper Peptide", "GHK Copper"], category: "peptide", compoundClass: "peptides_healing", classLabel: "Peptide / Healing", routes: ["injectable", "topical"], units: ["mg", "mcg"], controlledCopy: SAFETY },
  { officialName: "KPV", aliases: ["Lysine-Proline-Valine"], category: "peptide", compoundClass: "peptides_healing", classLabel: "Peptide / Healing", routes: ["injectable", "oral", "topical"], units: ["mcg", "mg"], controlledCopy: SAFETY },
  { officialName: "Pentadeca Arginate", aliases: ["PDA", "Pentadecapeptide Arginate", "BPC-157 Arginate"], category: "peptide", compoundClass: "peptides_healing", classLabel: "Peptide / Healing", routes: ["injectable"], units: ["mcg", "mg"], controlledCopy: SAFETY },
  { officialName: "Thymosin Alpha-1", aliases: ["TA-1", "Thymalfasin", "Ta1"], category: "peptide", compoundClass: "peptides_healing", classLabel: "Peptide / Healing", routes: ["injectable"], units: ["mg", "mcg"], controlledCopy: SAFETY },
  { officialName: "ARA-290", aliases: ["Cibinetide"], category: "peptide", compoundClass: "peptides_healing", classLabel: "Peptide / Healing", routes: ["injectable"], units: ["mg", "mcg"], controlledCopy: SAFETY },
  { officialName: "LL-37", aliases: ["Cathelicidin"], category: "peptide", compoundClass: "peptides_healing", classLabel: "Peptide / Healing", routes: ["injectable"], units: ["mcg", "mg"], controlledCopy: SAFETY },
  { officialName: "VIP", aliases: ["Vasoactive Intestinal Peptide"], category: "peptide", compoundClass: "peptides_healing", classLabel: "Peptide / Healing", routes: ["nasal", "injectable"], units: ["mcg"], controlledCopy: SAFETY },
  { officialName: "Epitalon", aliases: ["Epithalon", "Epithalamin"], category: "peptide", compoundClass: "peptides_healing", classLabel: "Peptide / Healing", routes: ["injectable"], units: ["mg", "mcg"], controlledCopy: SAFETY },

  /* Blends: one vial, several peptides. Members buy and log these by the blend
     name, so without an entry every one of them becomes a custom row that
     matches nothing.

     The class label names the components, because a blend name alone tells a
     member nothing and tells a clinician less. Compositions here are the ones
     these blends are commonly sold as — they are not standardised, and a
     member's own vial may differ, which is exactly why the components are
     printed rather than assumed. */
  { officialName: "BPC-157 / TB-500", aliases: ["BPC/TB", "BPC TB500", "BPC-157 TB-500", "Wolverine"], category: "peptide", compoundClass: "peptides_healing", classLabel: "Blend / BPC-157 + TB-500", routes: ["injectable"], units: ["mg", "mcg"], controlledCopy: SAFETY },
  { officialName: "GLOW", aliases: ["Glow Blend", "GLOW Protocol"], category: "peptide", compoundClass: "peptides_healing", classLabel: "Blend / GHK-Cu + BPC-157 + TB-500", routes: ["injectable"], units: ["mg", "mcg"], controlledCopy: SAFETY },
  { officialName: "KLOW", aliases: ["Klow Blend", "KLOW Protocol"], category: "peptide", compoundClass: "peptides_healing", classLabel: "Blend / KPV + GHK-Cu + BPC-157 + TB-500", routes: ["injectable"], units: ["mg", "mcg"], controlledCopy: SAFETY },

  // Mitochondrial / cellular peptides
  { officialName: "MOTS-c", aliases: ["MOT-C", "MOTSc", "MOTS C"], category: "peptide", compoundClass: "peptides_mitochondrial", classLabel: "Peptide / Mitochondrial", routes: ["injectable"], units: ["mg", "mcg"], controlledCopy: SAFETY },
  { officialName: "Elamipretide", aliases: ["SS-31", "SS31"], category: "peptide", compoundClass: "peptides_mitochondrial", classLabel: "Peptide / Mitochondrial", routes: ["injectable"], units: ["mg", "mcg"], controlledCopy: SAFETY },
  { officialName: "Humanin", aliases: ["HNG", "Humanin-G"], category: "peptide", compoundClass: "peptides_mitochondrial", classLabel: "Peptide / Mitochondrial", routes: ["injectable"], units: ["mg", "mcg"], controlledCopy: SAFETY },

  // NAD / cellular support
  { officialName: "Nicotinamide Adenine Dinucleotide", aliases: ["NAD", "NAD+", "NAD Plus"], category: "recovery", compoundClass: "cellular_nad", classLabel: "NAD / Cellular", routes: ["injectable", "oral"], units: ["mg"], controlledCopy: SAFETY },
  { officialName: "NADH", aliases: [], category: "recovery", compoundClass: "cellular_nad", classLabel: "NAD / Cellular", routes: ["oral"], units: ["mg"], controlledCopy: SAFETY },
  { officialName: "NMN (Nicotinamide Mononucleotide)", aliases: ["NMN"], category: "recovery", compoundClass: "cellular_nad", classLabel: "NAD / Cellular", routes: ["oral"], units: ["mg"], controlledCopy: SAFETY },
  { officialName: "NR (Nicotinamide Riboside)", aliases: ["NR", "Niagen"], category: "recovery", compoundClass: "cellular_nad", classLabel: "NAD / Cellular", routes: ["oral"], units: ["mg"], controlledCopy: SAFETY },

  // Hormones — Testosterone
  { officialName: "Testosterone Cypionate", aliases: ["Test Cyp", "Test C", "Cyp", "Depo-Testosterone"], category: "hormone", compoundClass: "hormones_testosterone", classLabel: "Hormone / Testosterone", routes: ["injectable"], units: ["mg", "mL"], controlledCopy: SAFETY },
  { officialName: "Testosterone Enanthate", aliases: ["Test E", "Test Enth", "Xyosted"], category: "hormone", compoundClass: "hormones_testosterone", classLabel: "Hormone / Testosterone", routes: ["injectable"], units: ["mg", "mL"], controlledCopy: SAFETY },
  { officialName: "Testosterone Propionate", aliases: ["Test Prop", "Test P", "Prop"], category: "hormone", compoundClass: "hormones_testosterone", classLabel: "Hormone / Testosterone", routes: ["injectable"], units: ["mg", "mL"], controlledCopy: SAFETY },
  { officialName: "Testosterone Undecanoate", aliases: ["Nebido", "Aveed"], category: "hormone", compoundClass: "hormones_testosterone", classLabel: "Hormone / Testosterone", routes: ["injectable"], units: ["mg", "mL"], controlledCopy: SAFETY },
  { officialName: "Testosterone Gel", aliases: ["Androgel", "Test Gel"], category: "hormone", compoundClass: "hormones_testosterone", classLabel: "Hormone / Testosterone", routes: ["topical"], units: ["mg"], controlledCopy: SAFETY },

  // Hormones — Other
  { officialName: "HCG", aliases: ["Human Chorionic Gonadotropin"], category: "hormone", compoundClass: "hormones_other", classLabel: "Hormone / Other", routes: ["injectable"], units: ["iu"], controlledCopy: SAFETY },
  { officialName: "Clomiphene", aliases: ["Clomid"], category: "medication", compoundClass: "ancillaries", classLabel: "Ancillary", routes: ["oral"], units: ["mg"], controlledCopy: SAFETY },
  { officialName: "Enclomiphene", aliases: [], category: "medication", compoundClass: "ancillaries", classLabel: "Ancillary", routes: ["oral"], units: ["mg"], controlledCopy: SAFETY },

  // AAS — generic names, for a member who does not know or track the ester
  { officialName: "Testosterone", aliases: ["Test", "Testosterone Blend"], category: "hormone", compoundClass: "hormones_testosterone", classLabel: "Hormone / Testosterone", routes: ["injectable", "oral", "topical"], units: ["mg", "mL"], controlledCopy: SAFETY },
  { officialName: "Sustanon 250", aliases: ["Sustanon", "Sust", "Sust 250", "Omnadren"], category: "hormone", compoundClass: "hormones_testosterone", classLabel: "Hormone / Testosterone", routes: ["injectable"], units: ["mg", "mL"], controlledCopy: SAFETY },
  { officialName: "Trenbolone", aliases: ["Tren"], category: "hormone", compoundClass: "aas", classLabel: "AAS", routes: ["injectable"], units: ["mg"], controlledCopy: SAFETY },
  { officialName: "Drostanolone", aliases: ["Masteron", "Mast"], category: "hormone", compoundClass: "aas", classLabel: "AAS", routes: ["injectable"], units: ["mg"], controlledCopy: SAFETY },
  { officialName: "Nandrolone", aliases: ["Nand"], category: "hormone", compoundClass: "aas", classLabel: "AAS", routes: ["injectable"], units: ["mg"], controlledCopy: SAFETY },
  { officialName: "Boldenone", aliases: ["Bold"], category: "hormone", compoundClass: "aas", classLabel: "AAS", routes: ["injectable"], units: ["mg"], controlledCopy: SAFETY },

  // AAS
  { officialName: "Oxandrolone", aliases: ["Anavar", "Var", "Oxandrin", "Oxan"], category: "hormone", compoundClass: "aas", classLabel: "AAS", routes: ["oral"], units: ["mg"], controlledCopy: SAFETY },
  { officialName: "Methenolone", aliases: ["Primo", "Primobolan", "Primobolan Depot", "Methenolone Enanthate", "Methenolone Acetate"], category: "hormone", compoundClass: "aas", classLabel: "AAS", routes: ["injectable", "oral"], units: ["mg"], controlledCopy: SAFETY },
  { officialName: "Nandrolone Decanoate", aliases: ["Deca", "Deca Durabolin", "Deca-Durabolin"], category: "hormone", compoundClass: "aas", classLabel: "AAS", routes: ["injectable"], units: ["mg"], controlledCopy: SAFETY },
  { officialName: "Nandrolone Phenylpropionate", aliases: ["NPP"], category: "hormone", compoundClass: "aas", classLabel: "AAS", routes: ["injectable"], units: ["mg"], controlledCopy: SAFETY },
  { officialName: "Boldenone Undecylenate", aliases: ["Equipoise", "EQ", "Bold Undec"], category: "hormone", compoundClass: "aas", classLabel: "AAS", routes: ["injectable"], units: ["mg"], controlledCopy: SAFETY },
  { officialName: "Drostanolone Propionate", aliases: ["Masteron Propionate", "Mast P", "Drost P"], category: "hormone", compoundClass: "aas", classLabel: "AAS", routes: ["injectable"], units: ["mg"], controlledCopy: SAFETY },
  { officialName: "Drostanolone Enanthate", aliases: ["Masteron Enanthate", "Mast E", "Drost E"], category: "hormone", compoundClass: "aas", classLabel: "AAS", routes: ["injectable"], units: ["mg"], controlledCopy: SAFETY },
  { officialName: "Stanozolol", aliases: ["Winstrol", "Winny", "Winstrol Depot", "Stanz"], category: "hormone", compoundClass: "aas", classLabel: "AAS", routes: ["injectable", "oral"], units: ["mg"], controlledCopy: SAFETY },
  { officialName: "Oxymetholone", aliases: ["Anadrol", "Adrol", "A50", "Anapolon"], category: "hormone", compoundClass: "aas", classLabel: "AAS", routes: ["oral"], units: ["mg"], controlledCopy: SAFETY },
  { officialName: "Methandienone", aliases: ["Dianabol", "Dbol", "D-bol", "Methandrostenolone", "Naposim"], category: "hormone", compoundClass: "aas", classLabel: "AAS", routes: ["oral"], units: ["mg"], controlledCopy: SAFETY },
  { officialName: "Trenbolone Acetate", aliases: ["Tren A", "Tren Ace", "Finaplix"], category: "hormone", compoundClass: "aas", classLabel: "AAS", routes: ["injectable"], units: ["mg"], controlledCopy: SAFETY },
  { officialName: "Trenbolone Enanthate", aliases: ["Tren E", "Tren Enth"], category: "hormone", compoundClass: "aas", classLabel: "AAS", routes: ["injectable"], units: ["mg"], controlledCopy: SAFETY },
  { officialName: "Trenbolone Hexahydrobenzylcarbonate", aliases: ["Tren Hex", "Parabolan"], category: "hormone", compoundClass: "aas", classLabel: "AAS", routes: ["injectable"], units: ["mg"], controlledCopy: SAFETY },
  { officialName: "Chlorodehydromethyltestosterone", aliases: ["Turinabol", "Tbol", "T-bol", "Oral Turinabol"], category: "hormone", compoundClass: "aas", classLabel: "AAS", routes: ["oral"], units: ["mg"], controlledCopy: SAFETY },
  { officialName: "Methasterone", aliases: ["Superdrol", "SD", "Methyldrostanolone"], category: "hormone", compoundClass: "aas", classLabel: "AAS", routes: ["oral"], units: ["mg"], controlledCopy: SAFETY },
  { officialName: "Fluoxymesterone", aliases: ["Halotestin", "Halo"], category: "hormone", compoundClass: "aas", classLabel: "AAS", routes: ["oral"], units: ["mg"], controlledCopy: SAFETY },
  { officialName: "Mesterolone", aliases: ["Proviron"], category: "hormone", compoundClass: "aas", classLabel: "AAS", routes: ["oral"], units: ["mg"], controlledCopy: SAFETY },
  { officialName: "Trestolone Acetate", aliases: ["MENT", "Trestolone"], category: "hormone", compoundClass: "aas", classLabel: "AAS", routes: ["injectable"], units: ["mg"], controlledCopy: SAFETY },
  /* Methenolone's esters and Boldenone Cypionate are deliberately NOT separate
     entries: Methenolone already carries "Methenolone Enanthate" / "Methenolone
     Acetate" / "Primobolan Depot" as aliases, and Dihydroboldenone carries
     "Boldenone Cypionate". Splitting them out makes two entries answer to one
     typed name and the resolver picks arbitrarily. */
  { officialName: "Testosterone Phenylpropionate", aliases: ["Test PP", "TPP"], category: "hormone", compoundClass: "hormones_testosterone", classLabel: "Testosterone", routes: ["injectable"], units: ["mg"], controlledCopy: SAFETY },
  { officialName: "Methyltestosterone", aliases: ["Methyl Test"], category: "hormone", compoundClass: "aas", classLabel: "AAS", routes: ["oral"], units: ["mg"], controlledCopy: SAFETY },
  { officialName: "Mibolerone", aliases: ["Cheque Drops"], category: "hormone", compoundClass: "aas", classLabel: "AAS", routes: ["oral"], units: ["mcg", "mg"], controlledCopy: SAFETY },
  { officialName: "Dihydroboldenone", aliases: ["DHB", "1-Testosterone", "Boldenone Cypionate"], category: "hormone", compoundClass: "aas", classLabel: "AAS", routes: ["injectable"], units: ["mg"], controlledCopy: SAFETY },

  // Ancillaries / support tracking
  { officialName: "Anastrozole", aliases: ["Arimidex"], category: "medication", compoundClass: "ancillaries", classLabel: "Ancillary", routes: ["oral"], units: ["mg"], controlledCopy: SAFETY },
  { officialName: "Exemestane", aliases: ["Aromasin"], category: "medication", compoundClass: "ancillaries", classLabel: "Ancillary", routes: ["oral"], units: ["mg"], controlledCopy: SAFETY },
  { officialName: "Letrozole", aliases: ["Femara"], category: "medication", compoundClass: "ancillaries", classLabel: "Ancillary", routes: ["oral"], units: ["mg"], controlledCopy: SAFETY },
  { officialName: "Tamoxifen", aliases: ["Nolvadex"], category: "medication", compoundClass: "ancillaries", classLabel: "Ancillary", routes: ["oral"], units: ["mg"], controlledCopy: SAFETY },
  { officialName: "Raloxifene", aliases: ["Evista"], category: "medication", compoundClass: "ancillaries", classLabel: "Ancillary", routes: ["oral"], units: ["mg"], controlledCopy: SAFETY },
  { officialName: "Finasteride", aliases: ["Propecia", "Proscar"], category: "medication", compoundClass: "ancillaries", classLabel: "Ancillary", routes: ["oral"], units: ["mg"], controlledCopy: SAFETY },
  { officialName: "Dutasteride", aliases: ["Avodart"], category: "medication", compoundClass: "ancillaries", classLabel: "Ancillary", routes: ["oral"], units: ["mg"], controlledCopy: SAFETY },
  { officialName: "Telmisartan", aliases: ["Micardis"], category: "medication", compoundClass: "ancillaries", classLabel: "Ancillary", routes: ["oral"], units: ["mg"], controlledCopy: SAFETY },
  { officialName: "Tadalafil", aliases: ["Cialis"], category: "medication", compoundClass: "ancillaries", classLabel: "Ancillary", routes: ["oral"], units: ["mg"], controlledCopy: SAFETY },
  /* Sildenafil, Menotropin (HMG), Pramipexole and Ketotifen are the obvious
     remaining ancillary gaps and are NOT added here. `ancillaries` has no
     class-level risk profile, so each needs a named one, and an entry with no
     profile ships a compound whose every safety surface is silent — which
     catalog-names.test.ts correctly refuses. Writing those profiles is authored
     clinical content: cited, and clinician-reviewed before it ships. They wait
     for that, not for a catalog line. */

  { officialName: "Cabergoline", aliases: ["Dostinex", "Caber"], category: "medication", compoundClass: "ancillaries", classLabel: "Ancillary", routes: ["oral"], units: ["mg"], controlledCopy: SAFETY },

  { officialName: "Ibutamoren", aliases: ["MK-677", "MK677", "Nutrobal"], category: "peptide", compoundClass: "peptides_growth", classLabel: "Peptide / Growth", routes: ["oral"], units: ["mg"], controlledCopy: SAFETY },

  // SARMs
  { officialName: "Enobosarm", aliases: ["Ostarine", "MK-2866", "MK2866", "Ostra"], category: "hormone", compoundClass: "sarms", classLabel: "SARM", routes: ["oral"], units: ["mg"], controlledCopy: SAFETY },
  { officialName: "Ligandrol", aliases: ["LGD-4033", "LGD"], category: "hormone", compoundClass: "sarms", classLabel: "SARM", routes: ["oral"], units: ["mg"], controlledCopy: SAFETY },
  { officialName: "Testolone", aliases: ["RAD-140", "RAD140"], category: "hormone", compoundClass: "sarms", classLabel: "SARM", routes: ["oral"], units: ["mg"], controlledCopy: SAFETY },
  { officialName: "Andarine", aliases: ["S-4", "S4"], category: "hormone", compoundClass: "sarms", classLabel: "SARM", routes: ["oral"], units: ["mg"], controlledCopy: SAFETY },
  { officialName: "YK-11", aliases: ["YK11"], category: "hormone", compoundClass: "sarms", classLabel: "SARM", routes: ["oral"], units: ["mg"], controlledCopy: SAFETY },
  { officialName: "S-23", aliases: ["S23"], category: "hormone", compoundClass: "sarms", classLabel: "SARM", routes: ["oral"], units: ["mg"], controlledCopy: SAFETY },
  { officialName: "LGD-3303", aliases: ["LGD3303"], category: "hormone", compoundClass: "sarms", classLabel: "SARM", routes: ["oral"], units: ["mg"], controlledCopy: SAFETY },
  { officialName: "ACP-105", aliases: ["ACP105"], category: "hormone", compoundClass: "sarms", classLabel: "SARM", routes: ["oral"], units: ["mg"], controlledCopy: SAFETY },
  { officialName: "RAD-150", aliases: ["TLB-150", "RAD150"], category: "hormone", compoundClass: "sarms", classLabel: "SARM", routes: ["oral"], units: ["mg"], controlledCopy: SAFETY },
  /* Cardarine and Stenabolic are not SARMs — one is a PPAR-delta agonist, the
     other a Rev-Erb agonist — but members shop for and log them alongside
     SARMs, so they sit here where they will be looked for. The class label
     stays honest about what they are. */
  { officialName: "Cardarine", aliases: ["GW-501516", "GW501516", "GW"], category: "hormone", compoundClass: "sarms", classLabel: "PPAR-delta agonist", routes: ["oral"], units: ["mg"], controlledCopy: SAFETY },
  { officialName: "Stenabolic", aliases: ["SR9009", "SR-9009"], category: "hormone", compoundClass: "sarms", classLabel: "Rev-Erb agonist", routes: ["oral"], units: ["mg"], controlledCopy: SAFETY },

  // Thyroid
  { officialName: "Liothyronine", aliases: ["T3", "Cytomel"], category: "medication", compoundClass: "thyroid", classLabel: "Thyroid hormone", routes: ["oral"], units: ["mcg"], controlledCopy: SAFETY },
  { officialName: "Levothyroxine", aliases: ["T4", "Synthroid"], category: "medication", compoundClass: "thyroid", classLabel: "Thyroid hormone", routes: ["oral"], units: ["mcg"], controlledCopy: SAFETY },

  // Beta-2 agonists
  { officialName: "Clenbuterol", aliases: ["Clen"], category: "medication", compoundClass: "beta_agonists", classLabel: "Beta-2 agonist", routes: ["oral"], units: ["mcg"], controlledCopy: SAFETY },

  // Insulin
  { officialName: "Insulin", aliases: ["Humalog", "Novolog", "Humulin R", "Insulin Lispro", "Insulin Aspart"], category: "medication", compoundClass: "insulin", classLabel: "Insulin", routes: ["injectable"], units: ["iu"], controlledCopy: SAFETY },

  // Melanocortins
  { officialName: "Melanotan II", aliases: ["MT2", "MT-II", "Melanotan 2"], category: "peptide", compoundClass: "melanocortins", classLabel: "Peptide / Melanocortin", routes: ["injectable", "nasal"], units: ["mg", "mcg"], controlledCopy: SAFETY },
  { officialName: "Melanotan I", aliases: ["MT1", "MT-I", "Melanotan 1", "Afamelanotide"], category: "peptide", compoundClass: "melanocortins", classLabel: "Peptide / Melanocortin", routes: ["injectable"], units: ["mg", "mcg"], controlledCopy: SAFETY },
  { officialName: "Kisspeptin-10", aliases: ["Kisspeptin", "KP-10"], category: "peptide", compoundClass: "melanocortins", classLabel: "Peptide / Signalling", routes: ["injectable"], units: ["mcg"], controlledCopy: SAFETY },
  { officialName: "Bremelanotide", aliases: ["PT-141", "PT141", "Vyleesi"], category: "peptide", compoundClass: "melanocortins", classLabel: "Peptide / Melanocortin", routes: ["injectable", "nasal"], units: ["mg"], controlledCopy: SAFETY },

  // Medications
  { officialName: "Metformin", aliases: ["Glucophage"], category: "medication", compoundClass: "medications", classLabel: "Medication", routes: ["oral"], units: ["mg"], controlledCopy: SAFETY },

  // Supplements
  { officialName: "Creatine Monohydrate", aliases: ["Creatine"], category: "supplement", compoundClass: "supplements", classLabel: "Supplement", routes: ["oral"], units: ["g", "mg"], controlledCopy: SAFETY },
  { officialName: "Electrolytes", aliases: ["Electrolyte Mix"], category: "supplement", compoundClass: "supplements", classLabel: "Supplement", routes: ["oral"], units: ["g", "mg"], controlledCopy: SAFETY },
  { officialName: "L-Carnitine", aliases: [], category: "supplement", compoundClass: "supplements", classLabel: "Supplement", routes: ["oral", "injectable"], units: ["mg", "g"], controlledCopy: SAFETY },
  { officialName: "Whey Protein Isolate", aliases: ["Whey", "WPI"], category: "supplement", compoundClass: "supplements", classLabel: "Supplement", routes: ["oral"], units: ["g"], controlledCopy: SAFETY },
  { officialName: "Essential Amino Acids (EAAs)", aliases: ["EAA", "EAAs", "Essential Amino Acids", "Intra-Workout Aminos"], category: "supplement", compoundClass: "supplements", classLabel: "Supplement", routes: ["oral"], units: ["g", "mg"], controlledCopy: SAFETY },
  { officialName: "Beetroot Extract", aliases: ["Beetroot","Beet Juice","Dietary Nitrate","Nitrate"], category: "supplement", compoundClass: "supplements", classLabel: "Supplement", routes: ["oral"], units: ["mg","g"], controlledCopy: SAFETY },
  { officialName: "HMB", aliases: ["Beta-Hydroxy Beta-Methylbutyrate"], category: "supplement", compoundClass: "supplements", classLabel: "Supplement", routes: ["oral"], units: ["g", "mg"], controlledCopy: SAFETY },
  { officialName: "Sodium Bicarbonate", aliases: ["Baking Soda"], category: "supplement", compoundClass: "supplements", classLabel: "Supplement", routes: ["oral"], units: ["g", "mg"], controlledCopy: SAFETY },
  { officialName: "Tart Cherry", aliases: ["Tart Cherry Juice", "Montmorency Cherry"], category: "supplement", compoundClass: "supplements", classLabel: "Supplement", routes: ["oral"], units: ["mg", "g"], controlledCopy: SAFETY },
  { officialName: "Beta-Alanine", aliases: ["Beta Alanine"], category: "supplement", compoundClass: "supplements", classLabel: "Supplement", routes: ["oral"], units: ["g", "mg"], controlledCopy: SAFETY },
  { officialName: "Berberine", aliases: [], category: "supplement", compoundClass: "supplements", classLabel: "Supplement", routes: ["oral"], units: ["mg"], controlledCopy: SAFETY },
  { officialName: "Beta-Sitosterol", aliases: ["Sitosterol","Phytosterol"], category: "supplement", compoundClass: "supplements", classLabel: "Supplement", routes: ["oral"], units: ["mg"], controlledCopy: SAFETY },
  { officialName: "Boswellia", aliases: ["Boswellia Serrata","Indian Frankincense"], category: "supplement", compoundClass: "supplements", classLabel: "Supplement", routes: ["oral"], units: ["mg"], controlledCopy: SAFETY },
  { officialName: "Collagen Peptides", aliases: ["Collagen","Hydrolyzed Collagen"], category: "supplement", compoundClass: "supplements", classLabel: "Supplement", routes: ["oral"], units: ["g"], controlledCopy: SAFETY },
  { officialName: "Garlic Extract", aliases: ["Garlic","Aged Garlic Extract","Allicin"], category: "supplement", compoundClass: "supplements", classLabel: "Supplement", routes: ["oral"], units: ["mg"], controlledCopy: SAFETY },
  { officialName: "L-Citrulline", aliases: ["Citrulline","Citrulline Malate"], category: "supplement", compoundClass: "supplements", classLabel: "Supplement", routes: ["oral"], units: ["g","mg"], controlledCopy: SAFETY },
  { officialName: "Potassium", aliases: ["Potassium Citrate","Potassium Chloride"], category: "supplement", compoundClass: "supplements", classLabel: "Supplement", routes: ["oral"], units: ["mg"], controlledCopy: SAFETY },
  { officialName: "Saw Palmetto", aliases: ["Serenoa Repens"], category: "supplement", compoundClass: "supplements", classLabel: "Supplement", routes: ["oral"], units: ["mg"], controlledCopy: SAFETY },
  { officialName: "Taurine", aliases: [], category: "supplement", compoundClass: "supplements", classLabel: "Supplement", routes: ["oral"], units: ["g","mg"], controlledCopy: SAFETY },
  { officialName: "Fish Oil", aliases: ["Omega-3", "EPA/DHA"], category: "supplement", compoundClass: "supplements", classLabel: "Supplement", routes: ["oral"], units: ["mg", "g"], controlledCopy: SAFETY },
  { officialName: "CoQ10", aliases: ["Ubiquinol", "Coenzyme Q10"], category: "supplement", compoundClass: "supplements", classLabel: "Supplement", routes: ["oral"], units: ["mg"], controlledCopy: SAFETY },
  { officialName: "DHEA", aliases: ["Dehydroepiandrosterone"], category: "supplement", compoundClass: "supplements", classLabel: "Supplement", routes: ["oral"], units: ["mg"], controlledCopy: SAFETY },
  { officialName: "TUDCA", aliases: ["Tauroursodeoxycholic Acid"], category: "supplement", compoundClass: "supplements", classLabel: "Supplement", routes: ["oral"], units: ["mg"], controlledCopy: SAFETY },
  { officialName: "Milk Thistle", aliases: ["Silymarin", "Silybum marianum"], category: "supplement", compoundClass: "supplements", classLabel: "Supplement", routes: ["oral"], units: ["mg"], controlledCopy: SAFETY },
  { officialName: "Green Tea Extract", aliases: ["EGCG", "Green Tea", "Camellia sinensis extract"], category: "supplement", compoundClass: "supplements", classLabel: "Supplement", routes: ["oral"], units: ["mg"], controlledCopy: SAFETY },
  { officialName: "Turmeric", aliases: ["Curcumin", "Curcuma longa"], category: "supplement", compoundClass: "supplements", classLabel: "Supplement", routes: ["oral"], units: ["mg"], controlledCopy: SAFETY },
  { officialName: "Garcinia Cambogia", aliases: ["Hydroxycitric Acid", "HCA"], category: "supplement", compoundClass: "supplements", classLabel: "Supplement", routes: ["oral"], units: ["mg"], controlledCopy: SAFETY },
  { officialName: "Red Yeast Rice", aliases: ["Monascus purpureus", "RYR"], category: "supplement", compoundClass: "supplements", classLabel: "Supplement", routes: ["oral"], units: ["mg"], controlledCopy: SAFETY },
  { officialName: "Niacin", aliases: ["Nicotinic Acid", "Vitamin B3"], category: "vitamin", compoundClass: "vitamins", classLabel: "Vitamin", routes: ["oral"], units: ["mg"], controlledCopy: SAFETY },
  { officialName: "Biotin", aliases: ["Vitamin B7", "D-Biotin"], category: "vitamin", compoundClass: "vitamins", classLabel: "Vitamin", routes: ["oral"], units: ["mcg", "mg"], controlledCopy: SAFETY },
  { officialName: "Licorice Root", aliases: ["Glycyrrhiza glabra", "Glycyrrhizin"], category: "supplement", compoundClass: "supplements", classLabel: "Supplement", routes: ["oral"], units: ["mg"], controlledCopy: SAFETY },
  { officialName: "N-Acetyl Cysteine", aliases: ["NAC", "N-Acetylcysteine"], category: "supplement", compoundClass: "supplements", classLabel: "Supplement", routes: ["oral"], units: ["mg"], controlledCopy: SAFETY },
  { officialName: "Psyllium Husk", aliases: ["Psyllium", "Ispaghula"], category: "supplement", compoundClass: "supplements", classLabel: "Supplement", routes: ["oral"], units: ["g"], controlledCopy: SAFETY },

  // Vitamins / minerals
  { officialName: "Multivitamin", aliases: ["Multi", "Multivitamin/Mineral", "MVM"], category: "vitamin", compoundClass: "vitamins", classLabel: "Vitamin", routes: ["oral"], units: ["tablet", "capsule"], controlledCopy: SAFETY },
  { officialName: "Vitamin D3", aliases: ["D3", "Cholecalciferol"], category: "vitamin", compoundClass: "vitamins", classLabel: "Vitamin", routes: ["oral"], units: ["iu", "mcg"], controlledCopy: SAFETY },
  { officialName: "Vitamin B12 (Methylcobalamin)", aliases: ["B12"], category: "vitamin", compoundClass: "vitamins", classLabel: "Vitamin", routes: ["oral", "injectable"], units: ["mcg", "mg"], controlledCopy: SAFETY },
  { officialName: "Magnesium Glycinate", aliases: ["Magnesium"], category: "vitamin", compoundClass: "vitamins", classLabel: "Vitamin", routes: ["oral"], units: ["mg"], controlledCopy: SAFETY },
  { officialName: "Zinc", aliases: ["Zinc Picolinate"], category: "vitamin", compoundClass: "vitamins", classLabel: "Vitamin", routes: ["oral"], units: ["mg"], controlledCopy: SAFETY },
  { officialName: "Iron", aliases: ["Ferrous Sulfate", "Ferrous Bisglycinate", "Iron Bisglycinate"], category: "vitamin", compoundClass: "vitamins", classLabel: "Mineral", routes: ["oral"], units: ["mg"], controlledCopy: SAFETY },

  // Nootropics
  { officialName: "L-Theanine", aliases: ["Theanine"], category: "nootropic", compoundClass: "nootropics", classLabel: "Nootropic", routes: ["oral"], units: ["mg"], controlledCopy: SAFETY },
  { officialName: "Caffeine", aliases: [], category: "nootropic", compoundClass: "nootropics", classLabel: "Nootropic", routes: ["oral"], units: ["mg"], controlledCopy: SAFETY },
  /* Peptides a member logs for cognition rather than physique. They sit under
     nootropics so they surface where a member looks for them, not buried among
     the growth peptides. */
  { officialName: "Semax", aliases: ["N-Acetyl Semax", "NA-Semax"], category: "peptide", compoundClass: "nootropics", classLabel: "Peptide / Nootropic", routes: ["nasal", "injectable"], units: ["mcg", "mg"], controlledCopy: SAFETY },
  { officialName: "Selank", aliases: ["N-Acetyl Selank", "NA-Selank"], category: "peptide", compoundClass: "nootropics", classLabel: "Peptide / Nootropic", routes: ["nasal", "injectable"], units: ["mcg", "mg"], controlledCopy: SAFETY },
  { officialName: "Dihexa", aliases: [], category: "peptide", compoundClass: "nootropics", classLabel: "Peptide / Nootropic", routes: ["oral", "topical"], units: ["mcg", "mg"], controlledCopy: SAFETY },
  { officialName: "Cerebrolysin", aliases: [], category: "peptide", compoundClass: "nootropics", classLabel: "Peptide / Nootropic", routes: ["injectable"], units: ["mL", "mg"], controlledCopy: SAFETY },

  // Recovery
  { officialName: "Glutathione", aliases: ["GSH"], category: "recovery", compoundClass: "recovery", classLabel: "Recovery", routes: ["injectable", "oral"], units: ["mg"], controlledCopy: SAFETY },
  { officialName: "Melatonin", aliases: [], category: "recovery", compoundClass: "recovery", classLabel: "Recovery", routes: ["oral"], units: ["mg", "mcg"], controlledCopy: SAFETY },
  { officialName: "Ashwagandha", aliases: ["KSM-66"], category: "recovery", compoundClass: "recovery", classLabel: "Recovery", routes: ["oral"], units: ["mg"], controlledCopy: SAFETY },
  { officialName: "Kava", aliases: ["Kava Kava", "Piper Methysticum"], category: "recovery", compoundClass: "recovery", classLabel: "Recovery", routes: ["oral"], units: ["mg"], controlledCopy: SAFETY },
  { officialName: "Vitamin C", aliases: ["Ascorbic Acid"], category: "supplement", compoundClass: "supplements", classLabel: "Supplement", routes: ["oral"], units: ["mg"], controlledCopy: SAFETY },
  { officialName: "Cinnamon", aliases: ["Cassia Cinnamon", "Cinnamon Bark", "Cinnamon Extract"], category: "supplement", compoundClass: "supplements", classLabel: "Supplement", routes: ["oral"], units: ["mg", "g"], controlledCopy: SAFETY },
  { officialName: "Glutamine", aliases: ["L-Glutamine"], category: "recovery", compoundClass: "recovery", classLabel: "Recovery", routes: ["oral"], units: ["g", "mg"], controlledCopy: SAFETY },
  { officialName: "Glycine", aliases: [], category: "recovery", compoundClass: "recovery", classLabel: "Recovery", routes: ["oral"], units: ["g", "mg"], controlledCopy: SAFETY },
];

export const COMPOUND_CLASS_GROUPS: Array<{ key: CompoundClassKey; label: string }> = [
  { key: "peptides_glp1", label: "GLP-1" },
  { key: "peptides_dual_agonists", label: "Dual agonists" },
  { key: "peptides_triple_agonists", label: "Triple agonists" },
  { key: "growth_hormone", label: "Growth hormone" },
  { key: "peptides_growth", label: "Growth / recovery peptides" },
  { key: "peptides_healing", label: "Growth / recovery peptides" },
  { key: "peptides_mitochondrial", label: "Mitochondrial peptides" },
  { key: "cellular_nad", label: "NAD / cellular support" },
  { key: "hormones_testosterone", label: "Hormones / Testosterone" },
  { key: "hormones_other", label: "Hormones / Other" },
  { key: "aas", label: "AAS" },
  { key: "ancillaries", label: "Ancillaries / support" },
  { key: "sarms", label: "SARMs" },
  { key: "thyroid", label: "Thyroid hormones" },
  { key: "beta_agonists", label: "Beta-2 agonists" },
  { key: "insulin", label: "Insulin" },
  { key: "melanocortins", label: "Melanocortin peptides" },
  { key: "medications", label: "Medications" },
  { key: "supplements", label: "Supplements" },
  { key: "vitamins", label: "Vitamins" },
  { key: "nootropics", label: "Nootropics" },
  { key: "recovery", label: "Recovery" },
  { key: "other", label: "Other" },
];

/** Letters and digits only, so "Tren-A", "Tren A" and "trena" are one name. */
function squash(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function findCatalogEntry(name: string): CompoundCatalogEntry | null {
  const lower = name.trim().toLowerCase();
  if (lower.length === 0) return null;
  for (const item of COMPOUND_CATALOG) {
    if (item.officialName.toLowerCase() === lower) return item;
    for (const alias of item.aliases) {
      if (alias.toLowerCase() === lower) return item;
    }
  }
  /* Same name, different punctuation or spacing. Only when it points at one
     compound — Reserve never guesses which compound a member meant. */
  const key = squash(lower);
  if (key.length === 0) return null;
  const matches = COMPOUND_CATALOG.filter(
    (item) => squash(item.officialName) === key || item.aliases.some((alias) => squash(alias) === key),
  );
  return matches.length === 1 ? matches[0] : null;
}

export function classLabelFor(key: string | undefined): string {
  const found = COMPOUND_CLASS_GROUPS.find((g) => g.key === key);
  return found?.label ?? "Other";
}

export function classKeyFromCategory(category: EnhancementCategory): CompoundClassKey {
  switch (category) {
    case "peptide": return "peptides_growth";
    case "hormone": return "hormones_other";
    case "medication": return "medications";
    case "supplement": return "supplements";
    case "vitamin": return "vitamins";
    case "nootropic": return "nootropics";
    case "recovery": return "recovery";
    default: return "other";
  }
}
