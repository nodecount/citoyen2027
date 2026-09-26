import type { Profil } from "./types";

// Profil du visiteur : chaque champ est facultatif. Une question non répondue est « inconnu », JAMAIS « non ».
export type ProfilPartiel = Partial<Profil>;

function repondu(valeur: unknown): boolean {
  if (typeof valeur === "number") return Number.isFinite(valeur);
  return typeof valeur === "string" && valeur.trim().length > 0;
}

// Le visiteur a-t-il donné au moins une information sur lui ? Tant que non, aucun effet n'est appliqué et aucun
// indicateur n'est affiché : on présente seulement les programmes.
export function aDesInformations(profil: ProfilPartiel | null | undefined): boolean {
  return profil !== null && profil !== undefined && Object.values(profil).some(repondu);
}

export function profilComplet(profil: ProfilPartiel): profil is Profil {
  const cles: Array<keyof Profil> = [
    "statut_professionnel",
    "tranche_revenus",
    "situation_familiale",
    "nombre_enfants",
    "logement",
    "secteur_activite",
    "region",
    "tranche_age",
    "tranche_patrimoine",
  ];
  return cles.every((cle) => repondu(profil[cle]));
}
