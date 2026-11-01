import type { ChampProfil, Profil } from "./types";

// Profil du visiteur : chaque champ est facultatif. Une question non répondue est ABSENTE du profil (« inconnu »),
// JAMAIS « non ».
export type ProfilPartiel = Partial<Profil>;

function repondu(valeur: unknown): boolean {
  if (typeof valeur === "number") return Number.isFinite(valeur);
  if (Array.isArray(valeur)) return valeur.length > 0;
  return typeof valeur === "string" && valeur.trim().length > 0;
}

// Le visiteur a-t-il donné au moins une information sur lui ? Tant que non, aucun effet n'est appliqué.
export function aDesInformations(profil: ProfilPartiel | null | undefined): boolean {
  return profil !== null && profil !== undefined && Object.values(profil).some(repondu);
}

// Valeurs connues d'un champ, sous forme de liste (un choix = une liste d'un élément), ou null si non répondu.
// `enfants_a_charge` est déduit du nombre d'enfants.
export function valeursDuProfil(profil: ProfilPartiel, champ: string): string[] | null {
  if (champ === "enfants_a_charge") {
    const n = profil.nombre_enfants;
    if (typeof n !== "number" || !Number.isFinite(n)) return null;
    // Trois enfants ou plus : les deux valeurs conviennent (une mesure ciblant « au moins un » vise aussi ces familles).
    return n >= 3 ? ["au_moins_un", "trois_ou_plus"] : n > 0 ? ["au_moins_un"] : ["aucun"];
  }
  const valeur = profil[champ];
  // « Les deux » (héritage déjà reçu ET à venir) : les deux valeurs conviennent, comme « trois enfants ou plus » pour les enfants.
  if (champ === "heritage" && valeur === "les_deux") return ["recu", "a_venir", "les_deux"];
  if (Array.isArray(valeur)) return valeur.length > 0 ? valeur : null;
  return typeof valeur === "string" && valeur.trim().length > 0 ? [valeur] : null;
}

// Une question conditionnelle n'est visible que si la réponse à l'autre champ est l'une des valeurs attendues ;
// tant qu'on ne sait pas (champ non répondu), elle reste masquée.
export function questionVisible(champ: ChampProfil, profil: ProfilPartiel): boolean {
  if (!champ.afficher_si) return true;
  const valeurs = valeursDuProfil(profil, champ.afficher_si.champ);
  return valeurs !== null && valeurs.some((v) => champ.afficher_si!.valeurs.includes(v));
}

// Met à jour UNE réponse à partir de la saisie brute du formulaire. Vide, invalide ou hors options → la réponse est
// retirée (inconnu), jamais devinée. Une réponse devenue sans objet (question conditionnelle masquée) est retirée aussi.
export function mettreAJourReponse(profil: ProfilPartiel, champ: ChampProfil, brut: string | string[], champs: ChampProfil[]): ProfilPartiel {
  const suivant: Record<string, unknown> = { ...profil };
  delete suivant[champ.id];

  if (champ.type === "multi") {
    const choix = (Array.isArray(brut) ? brut : [brut]).filter((v) => (champ.options ?? []).includes(v));
    if (choix.length > 0) suivant[champ.id] = choix;
  } else {
    const valeur = (Array.isArray(brut) ? (brut[0] ?? "") : brut).trim();
    if (valeur !== "") {
      if (champ.type === "number") {
        const n = Number(valeur);
        if (Number.isFinite(n) && n >= 0 && Number.isInteger(n)) suivant[champ.id] = n;
      } else if (champ.type === "enum") {
        if ((champ.options ?? []).includes(valeur)) suivant[champ.id] = valeur;
      } else {
        suivant[champ.id] = valeur;
      }
    }
  }
  return retirerReponsesMasquees(suivant as ProfilPartiel, champs);
}

// Retire les réponses aux questions conditionnelles qui ne sont plus visibles (jusqu'à stabilité : une réponse retirée
// peut en masquer une autre).
export function retirerReponsesMasquees(profil: ProfilPartiel, champs: ChampProfil[]): ProfilPartiel {
  let courant = profil;
  for (let tour = 0; tour <= champs.length; tour += 1) {
    const masquees = champs.filter((c) => c.id in courant && !questionVisible(c, courant));
    if (masquees.length === 0) return courant;
    const suivant: Record<string, unknown> = { ...courant };
    for (const c of masquees) delete suivant[c.id];
    courant = suivant as ProfilPartiel;
  }
  return courant;
}
