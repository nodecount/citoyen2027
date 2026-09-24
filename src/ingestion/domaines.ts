import type { CandidatMeta } from "../types";

// Documents officiels autorisés en plus du domaine du candidat, pour PRÉCISER une position
// (seuils, taux…) que le candidat défend encore mais qui date d'avant 2026 (amendement, texte de
// loi). Ils ne suffisent jamais seuls : voir verifierControlesDeterministes (au moins une source
// officielle du candidat ou du parti doit confirmer que la mesure est toujours défendue).
export const DOMAINES_INSTITUTIONNELS: readonly string[] = [
  "assemblee-nationale.fr",
  "senat.fr",
  "legifrance.gouv.fr",
];

// Domaines officiels du candidat ou de son parti, déclarés dans son meta.json.
export function domainesAutorises(meta: CandidatMeta): string[] {
  const domaines = new Set<string>();
  for (const source of meta.sources_officielles) {
    try {
      domaines.add(new URL(source.url).hostname);
    } catch {
      // URL invalide dans les données existantes : ignorée plutôt que d'interrompre le lot
    }
  }
  return Array.from(domaines);
}

// Ce que les outils web du modèle ont le droit de consulter : domaine officiel + institutions.
export function domainesAvecInstitutions(meta: CandidatMeta): string[] {
  return Array.from(new Set([...domainesAutorises(meta), ...DOMAINES_INSTITUTIONNELS]));
}

export function estSourceInstitutionnelle(url: string): boolean {
  try {
    const hote = new URL(url).hostname;
    return DOMAINES_INSTITUTIONNELS.some((domaine) => hote === domaine || hote.endsWith(`.${domaine}`));
  } catch {
    return false;
  }
}
