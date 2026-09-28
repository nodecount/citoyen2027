import { CHAMPS_PROFIL } from "../questionnaire";
import { mettreAJourReponse, type ProfilPartiel } from "../profil";

// Les réponses du visiteur sont gardées dans SON navigateur (localStorage) pour survivre à un rechargement de la page.
// Elles ne sont jamais envoyées nulle part. « Effacer mes réponses » les supprime. Le stockage peut être absent ou refusé
// (navigation privée, données bloquées) : jamais bloquant, la page fonctionne alors comme avant (en mémoire seulement).
const CLE_STOCKAGE = "reponses-visiteur";

export interface ReponsesMemorisees {
  profil: ProfilPartiel;
  // Le formulaire général a-t-il été enregistré ? (c'est lui qui fait apparaître les indicateurs)
  soumis: boolean;
}

const VIDE: ReponsesMemorisees = { profil: {}, soumis: false };

// Relit un profil stocké en ne gardant que des réponses valides pour les questions actuelles : un champ retiré ou une
// option devenue inconnue (le questionnaire a pu changer depuis) est écarté, jamais deviné.
export function assainirProfil(brut: unknown): ProfilPartiel {
  if (typeof brut !== "object" || brut === null || Array.isArray(brut)) return {};
  const stocke = brut as Record<string, unknown>;
  let profil: ProfilPartiel = {};
  // Deux passes : une question conditionnelle dépend d'une autre réponse, qui peut venir après elle dans la liste.
  for (let passe = 0; passe < 2; passe++) {
    for (const champ of CHAMPS_PROFIL) {
      const valeur = stocke[champ.id];
      if (valeur === undefined) continue;
      const saisie = Array.isArray(valeur) ? valeur.map(String) : String(valeur);
      profil = mettreAJourReponse(profil, champ, saisie, CHAMPS_PROFIL);
    }
  }
  return profil;
}

export function lireReponses(): ReponsesMemorisees {
  try {
    const texte = window.localStorage.getItem(CLE_STOCKAGE);
    if (!texte) return VIDE;
    const donnees = JSON.parse(texte) as { profil?: unknown; soumis?: unknown };
    return { profil: assainirProfil(donnees.profil), soumis: donnees.soumis === true };
  } catch {
    return VIDE;
  }
}

export function memoriserReponses(reponses: ReponsesMemorisees): void {
  try {
    const vide = Object.keys(reponses.profil).length === 0 && !reponses.soumis;
    if (vide) window.localStorage.removeItem(CLE_STOCKAGE);
    else window.localStorage.setItem(CLE_STOCKAGE, JSON.stringify(reponses));
  } catch {
    // sans conséquence : les réponses restent en mémoire pour cette session
  }
}