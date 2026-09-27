import { sourcesCitees, type SourceCitee } from "../citations";
import type { CandidatCharge } from "../data/chargerCandidats";
import { projeterTheme, type Projection } from "../engine/projection";
import { aDesInformations, type ProfilPartiel } from "../profil";
import type { CandidatMeta, Proposition, SyntheseTheme, Theme } from "../types";
import { messagesEffetsExclus, messagesIncertitude, messagesSansBadge } from "./projection";

export interface LigneCandidat {
  meta: CandidatMeta;
  propositions: Proposition[];
  // Null tant que le visiteur n'a donné aucune information sur lui : aucun effet n'est alors appliqué.
  projection: Projection | null;
  messagesSansBadge: string[];
  // Quand l'indicateur est « mixte » faute de savoir si le visiteur est concerné : pourquoi, et quoi préciser.
  messagesIncertitude: string[];
  // Effets exclus du badge parce qu'aucune réponse ne peut jamais les confirmer (public hors formulaire).
  messagesEffetsExclus: string[];
  // Null tant qu'elle n'existe pas, ou si elle ne couvre plus exactement les mesures du thème
  // (mesures ajoutées ou changées depuis) : un texte périmé est pire que pas de texte.
  synthese: SyntheseTheme | null;
  sources: SourceCitee[];
}

export interface CardTheme {
  theme: Theme;
  lignes: LigneCandidat[];
  // Candidats analysés, mais sans mesure sur ce thème : nommés, jamais omis en silence.
  absents: CandidatMeta[];
  enCoursAnalyse: boolean;
}

function affichable(p: Proposition): boolean {
  return p.statut === "complet" || p.statut === "partiel";
}

function memesIdentifiants(a: string[], b: string[]): boolean {
  return a.length === b.length && [...a].sort().join("|") === [...b].sort().join("|");
}

// Une card par thème (ordre du référentiel). Dans chaque card, les candidats sont rangés par ordre
// alphabétique de slug — jamais selon leur indicateur — et seulement s'ils ont des mesures sur ce
// thème. Aucun score global : chaque indicateur est propre à un thème.
// `profil` null, vide ou sans aucune réponse : on ne calcule rien (pas de projection) ; dès qu'une information est
// donnée, l'indicateur est calculé avec ce qu'on sait, et s'affine à mesure que le visiteur répond.
export function construireCards(themes: Theme[], candidats: CandidatCharge[], profil: ProfilPartiel | null): CardTheme[] {
  const parSlug = [...candidats].sort((a, b) => a.meta.slug.localeCompare(b.meta.slug));
  const personnalise = aDesInformations(profil);

  return themes.map((theme) => {
    const lignes: LigneCandidat[] = [];
    const absents: CandidatMeta[] = [];

    for (const candidat of parSlug) {
      const propositions = candidat.propositions.filter((p) => p.theme === theme.id && affichable(p));
      if (propositions.length === 0) {
        absents.push(candidat.meta);
        continue;
      }
      const projection = personnalise && profil ? projeterTheme(profil, propositions) : null;
      const synthese =
        candidat.syntheses.find(
          (s) =>
            s.theme === theme.id &&
            memesIdentifiants(
              s.propositions,
              propositions.map((p) => p.id),
            ),
        ) ?? null;
      lignes.push({
        meta: candidat.meta,
        propositions,
        projection,
        messagesSansBadge: projection ? messagesSansBadge(projection, propositions) : [],
        messagesIncertitude: projection ? messagesIncertitude(projection) : [],
        messagesEffetsExclus: projection ? messagesEffetsExclus(projection) : [],
        synthese,
        sources: sourcesCitees(propositions),
      });
    }

    return { theme, lignes, absents, enCoursAnalyse: lignes.length === 0 };
  });
}
