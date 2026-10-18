// Rattachement « par parti » (décision du 2026-10-18) : un groupe de l'Assemblée est rattaché au candidat de son parti. C'est une
// correspondance APPROCHÉE, à valider par le porteur du projet : un groupe n'est pas un parti (SOC regroupe le PS et des
// apparentés ; GDR des communistes et des ultramarins ; LFI-NFP des insoumis). Un groupe sans candidat clair (DEM, LIOT, UDDPLR,
// NI, sans groupe) n'est rattaché à personne : ses votes ne produisent aucune mesure. Les candidats sans groupe correspondant
// (Zemmour, Dupont-Aignan, Ruffin, Lisnard…) n'ont aucune mesure dans cette base : c'est une limite de couverture à comparer.
export interface PartiGroupe {
  groupe: string;
  candidat: string;
  parti: string;
  reserve?: string;
}

export const PARTIS_GROUPES: PartiGroupe[] = [
  { groupe: "RN", candidat: "le-pen", parti: "Rassemblement National" },
  { groupe: "EPR", candidat: "attal", parti: "Renaissance" },
  { groupe: "HOR", candidat: "philippe", parti: "Horizons" },
  { groupe: "DR", candidat: "retailleau", parti: "Les Républicains" },
  { groupe: "ECOS", candidat: "tondelier", parti: "Les Écologistes" },
  { groupe: "LFI-NFP", candidat: "melenchon", parti: "La France insoumise" },
  { groupe: "SOC", candidat: "glucksmann", parti: "Parti socialiste", reserve: "Glucksmann est issu de Place publique ; le groupe SOC est celui du Parti socialiste." },
  { groupe: "GDR", candidat: "roussel", parti: "Parti communiste français", reserve: "Le groupe GDR compte aussi des élus ultramarins non communistes." },
];

export interface DecompteGroupe {
  POUR: number;
  CONTRE: number;
  ABSTENTION: number;
  NONVOTANT?: number;
}

export type PositionGroupe = "pour" | "contre" | "partage" | "insuffisant";

// Position d'un groupe sur un scrutin : on ne compte que les suffrages exprimés pour ou contre (abstentions et non-votants
// ne disent rien du fond). « Pour » ou « contre » exige une cohésion d'au moins 70 % de ces suffrages et au moins 5 votants ;
// sinon le groupe est « partagé » (ou « insuffisant » s'il y a moins de 5 votants) et aucune mesure n'en découle.
export const COHESION_MINIMUM = 0.7;
export const VOTANTS_MINIMUM = 5;

export function positionDuGroupe(d: DecompteGroupe): PositionGroupe {
  const exprimes = d.POUR + d.CONTRE;
  if (exprimes < VOTANTS_MINIMUM) return "insuffisant";
  if (d.POUR / exprimes >= COHESION_MINIMUM) return "pour";
  if (d.CONTRE / exprimes >= COHESION_MINIMUM) return "contre";
  return "partage";
}
