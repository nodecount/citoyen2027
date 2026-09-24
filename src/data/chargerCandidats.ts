import type { CandidatMeta, Proposition } from "../types";
import { extraireSlug } from "../ui/monitoring/couverture";

export interface CandidatCharge {
  meta: CandidatMeta;
  propositions: Proposition[];
}

export interface CandidatsCharges {
  avecDonnees: CandidatCharge[];
  enCoursAnalyse: CandidatMeta[];
}

function aDesPropositionsAffichables(propositions: Proposition[] | undefined): boolean {
  return (propositions ?? []).some((p) => p.statut === "complet" || p.statut === "partiel");
}

// Un candidat n'apparaît dans les résultats que s'il a au moins une proposition affichable
// (complet/partiel). Sinon il serait présenté avec « 0 thème concerné », ce qui se lirait
// comme « ce candidat ne propose rien » alors que son programme n'est simplement pas encore
// analysé. Ces candidats sont donc listés à part (enCoursAnalyse), jamais omis en silence.
// Ordre alphabétique de slug dans les deux listes : aucun ordre de préférence implicite.
export function assemblerCandidats(
  metas: Record<string, CandidatMeta>,
  propositions: Record<string, Proposition[]>
): CandidatsCharges {
  const slugs = Object.keys(metas).sort((a, b) => a.localeCompare(b));
  const avecDonnees: CandidatCharge[] = [];
  const enCoursAnalyse: CandidatMeta[] = [];
  for (const slug of slugs) {
    if (aDesPropositionsAffichables(propositions[slug])) {
      avecDonnees.push({ meta: metas[slug], propositions: propositions[slug] });
    } else {
      enCoursAnalyse.push(metas[slug]);
    }
  }
  return { avecDonnees, enCoursAnalyse };
}

const metaModules = import.meta.glob("../../data/programmes/*/meta.json", { eager: true }) as Record<
  string,
  { default: CandidatMeta }
>;
const propositionsModules = import.meta.glob("../../data/programmes/*/propositions.json", {
  eager: true,
}) as Record<string, { default: Proposition[] }>;

function parSlug<T>(modules: Record<string, { default: T }>): Record<string, T> {
  const resultat: Record<string, T> = {};
  for (const [chemin, module] of Object.entries(modules)) {
    resultat[extraireSlug(chemin)] = module.default;
  }
  return resultat;
}

export function chargerCandidats(): CandidatsCharges {
  return assemblerCandidats(parSlug(metaModules), parSlug(propositionsModules));
}
