import profilSchema from "../../data/profils-schema.json";
import type { DimensionEffet, Effet } from "../effets";
import type { NiveauProjection, Projection } from "../engine/projection";
import type { ChampProfil, Proposition } from "../types";

// Textes de l'indicateur. Le sens n'est jamais porté par la couleur seule : chaque niveau a un
// libellé ET un symbole distinct (lecture au lecteur d'écran, daltonisme, impression en noir et blanc).
export const NIVEAUX: Record<NiveauProjection, { libelle: string; symbole: string; sens: string }> = {
  ameliorant: {
    libelle: "Améliorant",
    symbole: "▲",
    sens: "Votre situation serait plus favorable sur ce thème.",
  },
  mixte: {
    libelle: "Mixte",
    symbole: "◆",
    sens: "Certaines mesures vous seraient favorables, d'autres non.",
  },
  non_concerne: {
    libelle: "Non concerné",
    symbole: "○",
    sens: "Les mesures de ce candidat sur ce thème ne visent pas votre profil.",
  },
  degradant: {
    libelle: "Dégradant",
    symbole: "▼",
    sens: "Votre situation se compliquerait sur ce thème.",
  },
};

export const DIMENSIONS_LIBELLES: Record<DimensionEffet, string> = {
  revenu_disponible: "Revenu disponible",
  cout_de_la_vie: "Coût de la vie",
  emploi: "Emploi",
  protection_sociale: "Protection sociale",
  acces_aux_services: "Accès aux services",
  droits_et_libertes: "Droits et libertés",
  securite_personnelle: "Sécurité personnelle",
  patrimoine: "Patrimoine",
};

export function decrireEffet(effet: Effet): string {
  const grandeur = DIMENSIONS_LIBELLES[effet.dimension];
  if (effet.sens === "hausse") return `${grandeur} en hausse`;
  if (effet.sens === "baisse") return `${grandeur} en baisse`;
  return `${grandeur}, sens non déterminé`;
}

const LIBELLES_CHAMPS: Record<string, string> = {
  enfants_a_charge: "Enfants à charge",
};
for (const champ of profilSchema as ChampProfil[]) LIBELLES_CHAMPS[champ.id] = champ.label;

export function libelleChamp(champ: string): string {
  return LIBELLES_CHAMPS[champ] ?? champ;
}

// Pourquoi il n'y a pas de badge : on le dit, on ne le devine jamais (CLAUDE.md : mieux vaut pas
// d'indicateur qu'un mauvais indicateur). Ordre stable, indépendant de l'ordre des raisons.
export function messagesSansBadge(projection: Projection, propositions: Proposition[]): string[] {
  if (projection.niveau !== null) return [];
  const messages: string[] = [];
  if (projection.raisons.includes("informations_manquantes")) {
    const champs = projection.champsManquants.map((c) => `« ${libelleChamp(c)} »`).join(", ");
    messages.push(`Renseignez ${champs} pour affiner ce résultat.`);
  }
  if (projection.raisons.includes("critere_hors_formulaire")) {
    messages.push("Le programme vise un public que le formulaire ne permet pas encore d'identifier.");
  }
  if (projection.raisons.includes("effet_non_determinable")) {
    messages.push("Le programme ne permet pas de déterminer l'effet de ces mesures sur votre situation.");
  }
  if (projection.raisons.includes("aucun_effet_determine")) {
    const pasEncoreAnalysees = propositions.every((p) => p.effets === undefined);
    messages.push(
      pasEncoreAnalysees
        ? "Projection pas encore disponible : l'effet de ces mesures sur un citoyen n'a pas encore été analysé."
        : "Le programme publié ne permet pas de dire ce que ces mesures changeraient pour un citoyen.",
    );
  }
  return messages;
}

// « Mixte » par incertitude : on le dit, on dit pourquoi, et on dit quoi préciser. Ce n'est pas un jugement sur les mesures
// mais le constat que le moteur ne sait pas si le visiteur est concerné.
export function messagesIncertitude(projection: Projection): string[] {
  if (!projection.incertain) return [];
  const messages = ["Nous ne savons pas encore si certaines mesures vous concernent : par prudence, le résultat est « mixte »."];
  if (projection.champsManquants.length > 0) {
    const champs = projection.champsManquants.map((c) => `« ${libelleChamp(c)} »`).join(", ");
    messages.push(`Répondez à ${champs} pour le préciser.`);
  }
  if (projection.raisons.includes("critere_hors_formulaire")) {
    messages.push("Certaines mesures visent un public que le formulaire ne permet pas encore d'identifier.");
  }
  return messages;
}

// Effets qu'AUCUNE réponse ne pourra jamais confirmer (public hors formulaire) : exclus du calcul du badge (voir
// `Projection.effetsNonPrisEnCompte`), mais on le dit toujours, y compris quand il y a un badge — jamais l'impression que
// l'indicateur tient compte de tout. Quand il n'y a pas de badge (niveau null), `messagesSansBadge` l'explique déjà.
export function messagesEffetsExclus(projection: Projection): string[] {
  if (projection.niveau === null || projection.effetsNonPrisEnCompte === 0) return [];
  const n = projection.effetsNonPrisEnCompte;
  return [
    n === 1
      ? "Une mesure supplémentaire vise un public que le formulaire ne permet pas encore de décrire : elle n'est pas prise en compte dans ce résultat."
      : `${n} mesures supplémentaires visent un public que le formulaire ne permet pas encore de décrire : elles ne sont pas prises en compte dans ce résultat.`,
  ];
}
