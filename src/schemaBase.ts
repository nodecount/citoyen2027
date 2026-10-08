import schemaAgregateurs from "../data/bases/agregateurs/profils-schema.json";
import schemaOfficielle from "../data/bases/officielle/profils-schema.json";
import type { ChampProfil } from "./types";

// Décision du 2026-10-04 : chaque base de connaissances a SON formulaire (data/bases/<id>/profils-schema.json). Les
// questions, leurs options et les critères que les effets peuvent cibler découlent des mesures de cette base seule :
// une autre source découpe autrement les publics visés, donc pose d'autres questions. Rien n'est partagé entre bases
// sauf ce code. (Les scripts Node ne disposent pas de `import.meta.glob` : les schémas sont importés ici, un test
// vérifie que chaque base déclarée dans bases.json y figure.)
const SCHEMAS: Record<string, ChampProfil[]> = {
  officielle: schemaOfficielle as ChampProfil[],
  agregateurs: schemaAgregateurs as ChampProfil[],
};

export function basesAvecSchema(): string[] {
  return Object.keys(SCHEMAS);
}

export function champsDeBase(baseId: string): ChampProfil[] {
  const champs = SCHEMAS[baseId];
  if (!champs) throw new Error(`Aucun formulaire (profils-schema.json) déclaré pour la base « ${baseId} ».`);
  return champs;
}

// Valeurs ciblables par champ pour CETTE base. Seuls les champs à choix sont ciblables ; `enfants_a_charge` est déduit
// du nombre d'enfants (src/profil.ts) et n'existe que si la base pose la question `nombre_enfants`.
export function valeursParChamp(baseId: string): Record<string, string[]> {
  const champs = champsDeBase(baseId);
  const valeurs: Record<string, string[]> = {};
  for (const champ of champs) {
    if ((champ.type === "enum" || champ.type === "multi") && champ.options) valeurs[champ.id] = champ.options;
  }
  if (champs.some((c) => c.id === "nombre_enfants")) valeurs.enfants_a_charge = ["aucun", "au_moins_un", "trois_ou_plus"];
  return valeurs;
}

// Union des questions de toutes les bases : réservée à ce qui n'est PAS propre à une base (relire des réponses gardées
// dans le navigateur d'un visiteur qui change de base, libellés d'un champ, structure « question conditionnelle »).
// Une définition par identifiant ; les options des bases sont réunies.
export function champsToutesBases(): ChampProfil[] {
  const parId = new Map<string, ChampProfil>();
  for (const champs of Object.values(SCHEMAS)) {
    for (const champ of champs) {
      const deja = parId.get(champ.id);
      if (!deja) {
        parId.set(champ.id, { ...champ, options: champ.options ? [...champ.options] : undefined, libelles: champ.libelles ? { ...champ.libelles } : undefined });
        continue;
      }
      for (const option of champ.options ?? []) {
        if (!deja.options!.includes(option)) {
          deja.options!.push(option);
          if (champ.libelles?.[option]) deja.libelles![option] = champ.libelles[option];
        }
      }
    }
  }
  return [...parId.values()];
}
