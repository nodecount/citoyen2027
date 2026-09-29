import type { GroupeSocial } from "../convictions";
import type { Effet } from "../effets";
import type { Proposition } from "../types";
import { polarite } from "./polarite";
import type { EffetRetenu, NiveauProjection } from "./projection";

// Constat « valeurs sociales » d'un candidat sur un thème : ce que ses mesures font aux GROUPES que le visiteur a choisis
// (pas à lui). Mêmes niveaux, même table de polarité que l'indicateur « Ma situation » ; jamais fusionné avec lui.
export interface ConstatSocial {
  niveau: NiveauProjection | null;
  effetsRetenus: EffetRetenu[];
}

// Un effet « vise » un groupe si ses cibles sont vides (tout le monde), ou s'il a au moins un critère sur le champ du
// groupe et que TOUS ses critères sur ce champ recoupent les valeurs du groupe. Les critères sur d'autres champs ne
// bloquent pas : la mesure atteint alors une partie du groupe (portée partielle assumée). Jamais d'élargissement du
// périmètre par approximation : un effet qui ne dit rien du champ du groupe (ou vise « autre ») n'est pas compté.
function viseLeGroupe(effet: Effet, groupe: GroupeSocial): boolean {
  if (effet.cibles.length === 0) return true;
  const surLeChamp = effet.cibles.filter((c) => c.champ === groupe.critere.champ);
  if (surLeChamp.length === 0) return false;
  return surLeChamp.every((c) => c.valeurs.some((v) => groupe.critere.valeurs.includes(v)));
}

export function projeterConviction(groupes: GroupeSocial[], propositions: Proposition[]): ConstatSocial {
  const effetsRetenus: EffetRetenu[] = [];
  if (groupes.length === 0) return { niveau: null, effetsRetenus };
  let nombreEffets = 0;
  let favorables = 0;
  let defavorables = 0;
  let indetermines = 0;
  for (const proposition of propositions) {
    if (proposition.statut === "provisoire") continue;
    for (const effet of proposition.effets ?? []) {
      nombreEffets += 1;
      if (!groupes.some((g) => viseLeGroupe(effet, g))) continue;
      const sens = polarite(effet.dimension, effet.sens);
      if (sens === null) {
        indetermines += 1;
        continue;
      }
      effetsRetenus.push({ propositionId: proposition.id, effet, polarite: sens });
      if (sens === "favorable") favorables += 1;
      else defavorables += 1;
    }
  }
  const niveau: NiveauProjection | null =
    nombreEffets === 0 ? null : favorables > 0 && defavorables > 0 ? "mixte" : favorables > 0 ? "ameliorant" : defavorables > 0 ? "degradant" : indetermines > 0 ? null : "non_concerne";
  return { niveau, effetsRetenus };
}
