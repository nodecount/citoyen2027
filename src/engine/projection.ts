import { CHAMP_AUTRE, type Effet } from "../effets";
import type { Profil, Proposition } from "../types";
import { polarite, type Polarite } from "./polarite";

// Indicateur de projection d'un candidat sur un thème pour un citoyen — règles documentées dans
// docs/superpowers/specs/2026-09-24-fil-rouge-themes-projection-design.md et CLAUDE.md.
// Quatre niveaux seulement. Pas de badge (niveau null) quand on ne peut pas trancher honnêtement :
// mieux vaut pas d'indicateur qu'un mauvais indicateur.

export type NiveauProjection = "ameliorant" | "mixte" | "non_concerne" | "degradant";

export type RaisonSansBadge =
  | "informations_manquantes" // un champ du profil utile n'a pas été renseigné
  | "critere_hors_formulaire" // le programme vise un critère que le formulaire ne capture pas
  | "effet_non_determinable" // le programme vise ce profil sans que le sens de l'effet soit établi
  | "aucun_effet_determine"; // aucune mesure du thème n'a d'effet direct déterminé

export interface EffetRetenu {
  propositionId: string;
  effet: Effet;
  polarite: Polarite;
}

export interface Projection {
  niveau: NiveauProjection | null;
  raisons: RaisonSansBadge[];
  champsManquants: string[];
  effetsRetenus: EffetRetenu[];
}

// Une question non répondue vaut « inconnu », JAMAIS « non » : "" ou absent = non répondu.
type ProfilPartiel = Partial<Profil>;

function valeurProfil(profil: ProfilPartiel, champ: string): string | null {
  if (champ === "enfants_a_charge") {
    const n = profil.nombre_enfants;
    if (typeof n !== "number") return null;
    return n > 0 ? "au_moins_un" : "aucun";
  }
  const valeur = (profil as Record<string, unknown>)[champ];
  return typeof valeur === "string" && valeur.length > 0 ? valeur : null;
}

type StatutEffet =
  | { type: "hors_cible" }
  | { type: "applicable" }
  | { type: "a_confirmer"; champsManquants: string[]; horsFormulaire: boolean };

// ET à trois valeurs : un critère faux exclut l'effet même si un autre est inconnu.
function statutEffet(profil: ProfilPartiel, effet: Effet): StatutEffet {
  const champsManquants: string[] = [];
  let horsFormulaire = false;
  for (const critere of effet.cibles) {
    if (critere.champ === CHAMP_AUTRE) {
      horsFormulaire = true;
      continue;
    }
    const valeur = valeurProfil(profil, critere.champ);
    if (valeur === null) {
      champsManquants.push(critere.champ);
    } else if (!critere.valeurs.includes(valeur)) {
      return { type: "hors_cible" };
    }
  }
  if (champsManquants.length > 0 || horsFormulaire) {
    return { type: "a_confirmer", champsManquants, horsFormulaire };
  }
  return { type: "applicable" };
}

export function projeterTheme(profil: ProfilPartiel, propositions: Proposition[]): Projection {
  const effetsRetenus: EffetRetenu[] = [];
  const champsManquants = new Set<string>();
  const raisons = new Set<RaisonSansBadge>();
  let nombreEffets = 0;
  let nombreHorsCible = 0;
  let favorables = 0;
  let defavorables = 0;
  let bloquant = false; // effet qui vise peut-être ce profil sans qu'on puisse conclure

  for (const proposition of propositions) {
    // Même périmètre que l'affichage : une fiche « provisoire » est une recherche inachevée.
    if (proposition.statut === "provisoire") continue;
    for (const effet of proposition.effets ?? []) {
      nombreEffets += 1;
      const statut = statutEffet(profil, effet);
      if (statut.type === "hors_cible") {
        nombreHorsCible += 1;
        continue;
      }
      if (statut.type === "a_confirmer") {
        bloquant = true;
        for (const champ of statut.champsManquants) champsManquants.add(champ);
        if (statut.champsManquants.length > 0) raisons.add("informations_manquantes");
        if (statut.horsFormulaire) raisons.add("critere_hors_formulaire");
        continue;
      }
      const sens = polarite(effet.dimension, effet.sens);
      if (sens === null) {
        bloquant = true;
        raisons.add("effet_non_determinable");
        continue;
      }
      effetsRetenus.push({ propositionId: proposition.id, effet, polarite: sens });
      if (sens === "favorable") favorables += 1;
      else defavorables += 1;
    }
  }

  const resultat = (niveau: NiveauProjection | null): Projection => ({
    niveau,
    raisons: niveau === null ? [...raisons] : [],
    champsManquants: niveau === null ? [...champsManquants] : [],
    effetsRetenus,
  });

  if (nombreEffets === 0) {
    raisons.add("aucun_effet_determine");
    return resultat(null);
  }
  // Le mixte est stable : ajouter des effets (même à confirmer) ne peut pas le défaire.
  if (favorables > 0 && defavorables > 0) return resultat("mixte");
  if (bloquant) return resultat(null);
  if (favorables > 0) return resultat("ameliorant");
  if (defavorables > 0) return resultat("degradant");
  // Tous les effets existants ont été exclus par le ciblage : ce thème ne concerne pas ce profil.
  return nombreHorsCible === nombreEffets ? resultat("non_concerne") : resultat(null);
}
