import { CHAMP_AUTRE, type Effet } from "../effets";
import { valeursDuProfil, type ProfilPartiel } from "../profil";
import type { Proposition } from "../types";
import { polarite, type Polarite } from "./polarite";

// Indicateur de projection d'un candidat sur un thème pour un citoyen — règles documentées dans
// docs/superpowers/specs/2026-09-24-fil-rouge-themes-projection-design.md et CLAUDE.md.
// Quatre niveaux seulement. Deux cas sans badge : aucun effet déterminé, ou effet qui vise le visiteur sans que son sens
// soit établi. Quand le moteur ne sait pas si le visiteur est concerné par une réponse manquante mais RÉPONDABLE,
// l'indicateur est « mixte » (à préciser). Un effet qui vise un public que le formulaire ne pourra JAMAIS décrire (critère
// « autre ») ne bloque plus le badge — répondre ne lèverait jamais le doute — mais est signalé à part (voir
// `effetsNonPrisEnCompte`), pour ne pas se prétendre plus complet qu'on ne l'est.

export type NiveauProjection = "ameliorant" | "mixte" | "non_concerne" | "degradant";

export type RaisonSansBadge =
  | "informations_manquantes" // un champ du profil utile n'a pas été renseigné
  | "critere_hors_formulaire" // toutes les mesures du thème visent un critère que le formulaire ne capture pas
  | "effet_non_determinable" // le programme vise ce profil sans que le sens de l'effet soit établi
  | "aucun_effet_determine"; // aucune mesure du thème n'a d'effet direct déterminé

export interface EffetRetenu {
  propositionId: string;
  effet: Effet;
  polarite: Polarite;
}

export interface Projection {
  niveau: NiveauProjection | null;
  // Pourquoi pas de badge (niveau null), ou pourquoi « mixte » par incertitude (incertain) : sinon vide.
  raisons: RaisonSansBadge[];
  // Champs du profil à préciser pour lever l'incertitude (niveau null ou incertain) : sinon vide.
  champsManquants: string[];
  effetsRetenus: EffetRetenu[];
  // Vrai quand « mixte » vient de ce que le moteur ne sait pas si le visiteur est concerné par certaines mesures
  // RÉPONDABLES (réponse manquante à une question du formulaire), et non de mesures qui le favorisent ET le défavorisent.
  incertain: boolean;
  // Nombre d'effets exclus du calcul ci-dessus parce qu'ils visent un public qu'AUCUNE réponse du formulaire ne peut
  // jamais confirmer (un critère « autre » les concerne toujours) : toujours présent, même quand il y a un badge, pour
  // ne jamais laisser croire que l'indicateur tient compte de tout.
  effetsNonPrisEnCompte: number;
}

type StatutEffet =
  | { type: "hors_cible" }
  | { type: "applicable" }
  | { type: "a_confirmer"; champsManquants: string[]; horsFormulaire: boolean };

// ET à trois valeurs : un critère faux exclut l'effet même si un autre est inconnu — y compris un critère « autre » : un
// critère répondable qui exclut déjà le profil prime sur un doute qu'aucune réponse ne lèvera jamais. Une réponse à
// plusieurs choix correspond si l'un de ses choix est visé.
function statutEffet(profil: ProfilPartiel, effet: Effet): StatutEffet {
  const champsManquants: string[] = [];
  let horsFormulaire = false;
  for (const critere of effet.cibles) {
    if (critere.champ === CHAMP_AUTRE) {
      horsFormulaire = true;
      continue;
    }
    const valeurs = valeursDuProfil(profil, critere.champ);
    if (valeurs === null) {
      champsManquants.push(critere.champ);
    } else if (!valeurs.some((v) => critere.valeurs.includes(v))) {
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
  let incertains = 0; // effets à confirmer par une question RÉPONDABLE du formulaire
  let indetermines = 0; // effets qui visent ce profil sans sens établi
  let effetsNonPrisEnCompte = 0; // effets qu'aucune réponse ne peut jamais confirmer (critère « autre »)

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
        if (statut.horsFormulaire) {
          // Répondre à tout le formulaire ne lèverait jamais ce doute : on l'exclut du calcul plutôt que de bloquer
          // indéfiniment l'indicateur, et on le compte à part pour le dire honnêtement.
          effetsNonPrisEnCompte += 1;
          raisons.add("critere_hors_formulaire");
          continue;
        }
        incertains += 1;
        for (const champ of statut.champsManquants) champsManquants.add(champ);
        raisons.add("informations_manquantes");
        continue;
      }
      const sens = polarite(effet.dimension, effet.sens);
      if (sens === null) {
        indetermines += 1;
        raisons.add("effet_non_determinable");
        continue;
      }
      effetsRetenus.push({ propositionId: proposition.id, effet, polarite: sens });
      if (sens === "favorable") favorables += 1;
      else defavorables += 1;
    }
  }

  // Effets sur lesquels le badge peut effectivement se prononcer, un jour ou l'autre.
  const resolvables = nombreEffets - effetsNonPrisEnCompte;

  const resultat = (niveau: NiveauProjection | null, incertain = false): Projection => ({
    niveau,
    raisons: niveau === null || incertain ? [...raisons] : [],
    champsManquants: niveau === null || incertain ? [...champsManquants] : [],
    effetsRetenus,
    incertain,
    effetsNonPrisEnCompte,
  });

  if (nombreEffets === 0) {
    raisons.add("aucun_effet_determine");
    return resultat(null);
  }
  // Toutes les mesures du thème visent un public hors formulaire : rien à calculer, mais on le dit (pas « aucun effet »).
  if (resolvables === 0) return resultat(null);
  // Le mixte « réel » est stable : ajouter des effets (même à confirmer) ne peut pas le défaire.
  if (favorables > 0 && defavorables > 0) return resultat("mixte");
  // On ne sait pas si le visiteur est concerné par une mesure RÉPONDABLE : « mixte », par prudence, avec l'explication.
  if (incertains > 0) return resultat("mixte", true);
  if (indetermines > 0) return resultat(null);
  if (favorables > 0) return resultat("ameliorant");
  if (defavorables > 0) return resultat("degradant");
  // Tous les effets résolvables ont été exclus par le ciblage : ce thème ne concerne pas ce profil.
  return nombreHorsCible === resolvables ? resultat("non_concerne") : resultat(null);
}
