import type { Profil, Proposition, Impact } from "../types";
import { evaluerParDefaut } from "./evaluerParDefaut";

function avecConcerneAffine(
  profil: Profil,
  proposition: Proposition,
  concerne: boolean,
  noteEligibilite: string
): Impact {
  const base = evaluerParDefaut(profil, proposition);
  const explication = `${noteEligibilite} ${base.explication}`;
  return { ...base, concerne, explication };
}

// Seules 5 des 12 propositions réelles disposent ici d'une règle d'éligibilité dédiée ;
// les 7 autres retombent sur le comportement universel/qualitatif par défaut
// (`evaluerParDefaut`). C'est intentionnel : le profil ne comporte pas encore assez de
// granularité pour déterminer l'éligibilité sur ces autres propositions. Cette liste doit
// être étendue au fur et à mesure que de nouvelles conditions deviennent déterminables —
// son état actuel ne doit pas être lu comme une personnalisation « complète ».
export const regles: Record<string, (profil: Profil, proposition: Proposition) => Impact> = {
  "le-pen-fisc-002": (profil, proposition) => {
    const concerne = profil.tranche_age === "moins_30";
    return avecConcerneAffine(
      profil,
      proposition,
      concerne,
      concerne
        ? "Vous avez moins de 30 ans : cette mesure vous concerne directement."
        : "Cette mesure cible les moins de 30 ans."
    );
  },

  "le-pen-pa-002": (profil, proposition) => {
    const concerne = profil.statut_professionnel === "retraite";
    return avecConcerneAffine(
      profil,
      proposition,
      concerne,
      concerne
        ? "Vous êtes retraité : cette mesure vous concerne directement."
        : "Cette mesure concerne les retraités."
    );
  },

  "melenchon-fisc-002": (profil, proposition) => {
    const concerne = profil.tranche_patrimoine === "500k_1_3m" || profil.tranche_patrimoine === "plus_1_3m";
    const nuance =
      profil.tranche_patrimoine === "500k_1_3m"
        ? "Votre tranche de patrimoine peut approcher le seuil retenu par le seul chiffrage indépendant disponible pour cette mesure (1,3 million d'euros — hypothèse de l'Institut Montaigne, le programme ne précisant lui-même aucun seuil), selon votre situation exacte."
        : "Votre patrimoine dépasse le seuil retenu par le seul chiffrage indépendant disponible pour cette mesure (1,3 million d'euros — hypothèse de l'Institut Montaigne, le programme ne précisant lui-même aucun seuil).";
    return avecConcerneAffine(
      profil,
      proposition,
      concerne,
      concerne
        ? nuance
        : "Le volet ISF de cette mesure ne concerne, selon le seul chiffrage indépendant disponible, que les patrimoines dépassant le seuil de 1,3 million d'euros retenu comme hypothèse par l'Institut Montaigne (le programme ne précise lui-même aucun seuil) — votre profil n'est pas dans ce cas selon ce critère. (Le volet suppression de la flat tax, également prévu par cette mesure, n'est pas évalué ici faute de donnée de profil pertinente.)"
    );
  },

  "melenchon-pa-001": (profil, proposition) => {
    const concerne =
      profil.statut_professionnel === "salarie" &&
      (profil.tranche_revenus === "moins_1200" || profil.tranche_revenus === "1200_2000");
    return avecConcerneAffine(
      profil,
      proposition,
      concerne,
      concerne
        ? "Vous êtes salarié avec un revenu proche du SMIC actuel : cette mesure vous concerne directement."
        : "Le volet revalorisation du SMIC concerne les salariés rémunérés au SMIC ou à un niveau proche — votre profil n'est pas dans ce cas. (Le volet indexation des salaires sur l'inflation, également prévu par cette mesure, n'est pas évalué ici faute de donnée de profil pertinente.)"
    );
  },

  "philippe-pa-001": (profil, proposition) => {
    const concerne = ["salarie", "independant", "fonctionnaire"].includes(String(profil.statut_professionnel));
    return avecConcerneAffine(
      profil,
      proposition,
      concerne,
      concerne
        ? "Vous êtes en activité : cette mesure vous concerne directement."
        : "Cette mesure concerne les actifs (salariés, indépendants, fonctionnaires)."
    );
  },
};

// Champs du profil dont chaque règle a besoin : sans eux, la règle n'est pas appliquée (une réponse manquante se lirait
// « non concerné »). L'évaluation retombe alors sur l'explication générale.
export const champsRequis: Record<string, string[]> = {
  "le-pen-fisc-002": ["tranche_age"],
  "le-pen-pa-002": ["statut_professionnel"],
  "melenchon-fisc-002": ["tranche_patrimoine"],
  "melenchon-pa-001": ["statut_professionnel", "tranche_revenus"],
  "philippe-pa-001": ["statut_professionnel"],
};
