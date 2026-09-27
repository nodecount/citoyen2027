// Navigation par adresse, sans bibliothèque : chaque écran a sa propre adresse (partageable, bouton précédent/suivant
// du navigateur fonctionnel), sans recharger la page. « /monitoring » reste un cas à part, géré par App.tsx.

export type Ecran = "accueil" | "simulateur" | "questions-generales" | "a-propos";

const CHEMIN_PAR_ECRAN: Record<Ecran, string> = {
  accueil: "/",
  simulateur: "/simulateur",
  "questions-generales": "/ma-situation",
  "a-propos": "/a-propos",
};

const ECRAN_PAR_CHEMIN: Record<string, Ecran> = Object.fromEntries(
  Object.entries(CHEMIN_PAR_ECRAN).map(([ecran, chemin]) => [chemin, ecran as Ecran]),
);

export function cheminDeLEcran(ecran: Ecran): string {
  return CHEMIN_PAR_ECRAN[ecran];
}

// Une adresse inconnue retombe sur l'accueil plutôt que sur une page blanche.
export function ecranDepuisChemin(chemin: string): Ecran {
  return ECRAN_PAR_CHEMIN[chemin] ?? "accueil";
}

// Un candidat ouvert dans une carte de thème : « /simulateur?candidat=<slug>#theme-<id> » (ancre = la carte du thème).
export interface Ouverture {
  theme: string;
  candidat: string;
}

export function lireOuverture(adresse: string): Ouverture | null {
  try {
    const url = new URL(adresse);
    const theme = url.hash.startsWith("#theme-") ? decodeURIComponent(url.hash.slice("#theme-".length)) : "";
    const candidat = url.searchParams.get("candidat") ?? "";
    return theme && candidat ? { theme, candidat } : null;
  } catch {
    return null;
  }
}

// Change l'écran affiché en changeant l'adresse (garde les paramètres existants, par ex. ?base=) ; ajoute une entrée
// d'historique, pour que le bouton précédent du navigateur revienne à l'écran précédent.
export function naviguerVers(ecran: Ecran, ouverture?: Ouverture): void {
  try {
    const adresse = new URL(window.location.href);
    adresse.pathname = cheminDeLEcran(ecran);
    adresse.searchParams.delete("candidat");
    adresse.hash = "";
    if (ouverture) {
      adresse.searchParams.set("candidat", ouverture.candidat);
      adresse.hash = `theme-${ouverture.theme}`;
    }
    window.history.pushState(null, "", adresse);
  } catch {
    // adresse non modifiable (environnement sans historique) : l'écran change quand même côté React
  }
}
