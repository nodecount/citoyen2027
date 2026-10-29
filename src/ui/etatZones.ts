// État des deux blocs latéraux de l'écran du simulateur (onglets) et de la suggestion centrale. Logique pure, testée à part : la page
// ne fait que la brancher. Le fait d'être « révélé » vit dans `EtatIdeal` (etatIdeal.ts), pas ici.
export type Onglet = "questions" | "candidats";

export interface OngletsZones {
  gauche: Onglet;
  droite: Onglet;
}

export const ONGLETS_QUESTIONS: OngletsZones = { gauche: "questions", droite: "questions" };

export type EtatSuggestion = "vide" | "partiel" | "revele";

// Vide à 0 réponse (bouton inactif), partielle dès une réponse (bouton actif), révélée une fois la confirmation donnée.
export function etatSuggestion(repondues: number, revele: boolean): EtatSuggestion {
  if (revele) return "revele";
  return repondues > 0 ? "partiel" : "vide";
}

// À la révélation, les deux classements s'ouvrent d'eux-mêmes.
export function apresRevelation(): OngletsZones {
  return { gauche: "candidats", droite: "candidats" };
}

// Les onglets sont indépendants ; « Candidats » reste fermé tant que rien n'est révélé.
export function choisirOnglet(onglets: OngletsZones, zone: "gauche" | "droite", onglet: Onglet, revele: boolean): OngletsZones {
  if (onglet === "candidats" && !revele) return onglets;
  return { ...onglets, [zone]: onglet };
}
