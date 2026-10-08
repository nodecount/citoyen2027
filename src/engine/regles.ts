import type { Profil, Proposition, Impact } from "../types";

// Règles d'éligibilité dédiées à UNE mesure (identifiant de proposition → évaluation). Le mécanisme reste (voir
// `evaluerProposition`), mais plus aucune règle n'est attachée aux données : les mesures de tous les candidats sont refaites
// par le pipeline corpus, leurs identifiants ne désignent plus les mêmes mesures qu'à l'époque de la collecte manuelle
// (le 2026-10-06, `melenchon-fisc-002` désignait la refonte de l'impôt sur les sociétés, plus l'ISF), et leurs cibles sont
// portées par `effets`. Une règle ne doit être ajoutée que pour un identifiant vérifié, avec un test sur la mesure réelle.
export const regles: Record<string, (profil: Profil, proposition: Proposition) => Impact> = {};

// Champs du profil dont chaque règle a besoin : sans eux, la règle n'est pas appliquée (une réponse manquante se lirait
// « non concerné »). L'évaluation retombe alors sur l'explication générale.
export const champsRequis: Record<string, string[]> = {};
