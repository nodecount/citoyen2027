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
  // Effets dont on ne peut pas dire s'ils atteignent le groupe (public hors formulaire, ou ciblé par un autre champ) :
  // exclus du calcul et comptés à part, jamais présumés « hors sujet » (même esprit que `effetsNonPrisEnCompte`).
  effetsIncertains: number;
}

type Portee = "vise" | "exclu" | "incertain";

// Portée d'un effet sur un groupe :
//  - « vise » : cibles vides (tout le monde), ou au moins un critère sur le champ du groupe et TOUS ses critères sur ce
//    champ recoupent au moins une valeur du groupe. Les critères sur d'autres champs (ou « autre ») ne bloquent pas : la
//    mesure atteint alors une partie du groupe (portée partielle assumée).
//  - « exclu » : l'effet cible le champ du groupe mais pas ses valeurs (ex. plus de 5 000 € pour « moins de 1 200 € »).
//  - « incertain » : l'effet ne dit rien du champ du groupe (autre champ, critère « autre »). Il pourrait l'atteindre ou
//    non : on ne devine pas, et surtout on n'affirme JAMAIS « non concerné » à sa place.
function porteeSurGroupe(effet: Effet, groupe: GroupeSocial): Portee {
  if (effet.cibles.length === 0) return "vise";
  const surLeChamp = effet.cibles.filter((c) => c.champ === groupe.critere.champ);
  if (surLeChamp.length === 0) return "incertain";
  return surLeChamp.every((c) => c.valeurs.some((v) => groupe.critere.valeurs.includes(v))) ? "vise" : "exclu";
}

// Sur plusieurs groupes à la fois : l'effet vise l'ensemble s'il vise l'un d'eux ; sinon incertain s'il l'est pour l'un.
function portee(effet: Effet, groupes: GroupeSocial[]): Portee {
  const portees = groupes.map((g) => porteeSurGroupe(effet, g));
  return portees.includes("vise") ? "vise" : portees.includes("incertain") ? "incertain" : "exclu";
}

export function projeterConviction(groupes: GroupeSocial[], propositions: Proposition[]): ConstatSocial {
  const effetsRetenus: EffetRetenu[] = [];
  if (groupes.length === 0) return { niveau: null, effetsRetenus, effetsIncertains: 0 };
  let nombreEffets = 0;
  let favorables = 0;
  let defavorables = 0;
  let indetermines = 0;
  let incertains = 0;
  for (const proposition of propositions) {
    if (proposition.statut === "provisoire") continue;
    for (const effet of proposition.effets ?? []) {
      nombreEffets += 1;
      const p = portee(effet, groupes);
      if (p === "exclu") continue;
      if (p === "incertain") {
        incertains += 1;
        continue;
      }
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
  // « non concerné » seulement si TOUS les effets sont exclus avec certitude ; au moindre doute : pas d'indicateur.
  const niveau: NiveauProjection | null =
    nombreEffets === 0 ? null : favorables > 0 && defavorables > 0 ? "mixte" : favorables > 0 ? "ameliorant" : defavorables > 0 ? "degradant" : indetermines > 0 || incertains > 0 ? null : "non_concerne";
  return { niveau, effetsRetenus, effetsIncertains: incertains };
}
