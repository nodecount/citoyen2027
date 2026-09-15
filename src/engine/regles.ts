import type { Profil, Proposition, Impact } from "../types";
import { evaluerParDefaut } from "./evaluerParDefaut";

function avecConcerneAffine(
  profil: Profil,
  proposition: Proposition,
  concerne: boolean,
  noteEligibilite: string
): Impact {
  const base = evaluerParDefaut(profil, proposition);
  const explication = concerne
    ? `${noteEligibilite} ${base.explication}`
    : `${noteEligibilite} Cette mesure ne s'applique donc pas à votre profil tel que renseigné.`;
  return { ...base, concerne, explication };
}

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
        ? "Votre tranche de patrimoine peut approcher le seuil d'entrée de l'ISF proposé (1,3 million d'euros) selon votre situation exacte."
        : "Votre patrimoine dépasse le seuil d'entrée de l'ISF proposé (1,3 million d'euros).";
    return avecConcerneAffine(
      profil,
      proposition,
      concerne,
      concerne ? nuance : "Cette mesure ne concerne que les patrimoines dépassant 1,3 million d'euros."
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
        : "Cette mesure concerne les salariés rémunérés au SMIC ou à un niveau proche."
    );
  },

  "philippe-pa-001": (profil, proposition) => {
    const concerne = ["salarie", "independant", "fonctionnaire"].includes(profil.statut_professionnel);
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
