import type { CandidatMeta, Proposition, StatutProposition, Theme } from "../../types";
import type { EntreeAVerifier } from "../../ingestion/depot";

export function extraireSlug(cheminModule: string): string {
  const correspondance = cheminModule.match(/data\/programmes\/([^/]+)\//);
  return correspondance ? correspondance[1] : cheminModule;
}

export interface CouvertureTheme {
  themeId: string;
  libelle: string;
  parStatut: Record<StatutProposition, number>;
  dateVerificationRecente: string | null;
}

export interface CouvertureCandidat {
  slug: string;
  nom: string;
  dateDerniereMaj: string;
  parTheme: CouvertureTheme[];
  enAttente: EntreeAVerifier[];
}

export function calculerCouverture(
  themes: Theme[],
  metasParSlug: Record<string, CandidatMeta>,
  propositionsParSlug: Record<string, Proposition[]>,
  aVerifierParSlug: Record<string, EntreeAVerifier[]>,
): CouvertureCandidat[] {
  return Object.entries(metasParSlug)
    .map(([slug, meta]) => {
      const propositions = propositionsParSlug[slug] ?? [];
      const parTheme: CouvertureTheme[] = themes.map((theme) => {
        const propositionsDuTheme = propositions.filter((p) => p.theme === theme.id);
        const parStatut: Record<StatutProposition, number> = { complet: 0, partiel: 0, provisoire: 0 };
        let dateVerificationRecente: string | null = null;
        for (const p of propositionsDuTheme) {
          parStatut[p.statut] += 1;
          if (dateVerificationRecente === null || p.date_derniere_verification > dateVerificationRecente) {
            dateVerificationRecente = p.date_derniere_verification;
          }
        }
        return { themeId: theme.id, libelle: theme.libelle, parStatut, dateVerificationRecente };
      });
      return {
        slug,
        nom: meta.nom,
        dateDerniereMaj: meta.date_derniere_maj,
        parTheme,
        enAttente: aVerifierParSlug[slug] ?? [],
      };
    })
    .sort((a, b) => a.slug.localeCompare(b.slug));
}
