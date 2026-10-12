import { polarite } from "../engine/polarite";
import { valeursParChamp } from "../schemaBase";
import type { Proposition } from "../types";

// Couverture des effets : pour chaque réponse possible à chaque question du formulaire d'une base, combien d'effets (mesures
// distinctes) la ciblent explicitement, du côté favorable et du côté défavorable. Sert à repérer les « trous » : une réponse
// que presque aucun effet ne vise (ex : « chef d'entreprise ») ne peut jamais voir apparaître de mesure qui la dégrade, même si
// des mesures la touchent dans la réalité. Un trou n'est pas forcément une erreur (peu de mesures peuvent viser un public), mais
// c'est la liste de ce qu'il faut relire. Les effets « pour tout le monde » (cibles vides) sont comptés à part : ils touchent
// chaque réponse sans la désigner.
export interface Couverture {
  champ: string;
  valeur: string;
  favorables: number;
  defavorables: number;
}

export interface BilanCouverture {
  parReponse: Couverture[];
  pourTous: { favorables: number; defavorables: number };
}

export function compterCouverture(propositions: Proposition[], baseId: string): BilanCouverture {
  const comptes = new Map<string, { favorables: Set<string>; defavorables: Set<string> }>();
  for (const [champ, valeurs] of Object.entries(valeursParChamp(baseId))) {
    for (const valeur of valeurs) comptes.set(`${champ}|${valeur}`, { favorables: new Set(), defavorables: new Set() });
  }
  const pourTous = { favorables: new Set<string>(), defavorables: new Set<string>() };
  for (const p of propositions) {
    for (const effet of p.effets ?? []) {
      const pol = polarite(effet.dimension, effet.sens);
      if (!pol) continue;
      const cote = pol === "favorable" ? "favorables" : "defavorables";
      if (effet.cibles.length === 0) {
        pourTous[cote].add(p.id);
        continue;
      }
      for (const c of effet.cibles) for (const v of c.valeurs) comptes.get(`${c.champ}|${v}`)?.[cote].add(p.id);
    }
  }
  const parReponse = [...comptes].map(([cle, c]) => {
    const [champ, valeur] = cle.split("|");
    return { champ, valeur, favorables: c.favorables.size, defavorables: c.defavorables.size };
  });
  return { parReponse, pourTous: { favorables: pourTous.favorables.size, defavorables: pourTous.defavorables.size } };
}

// Les réponses dont aucune mesure défavorable n'est ciblée (ou aucune favorable) : à relire en priorité.
export function trous(bilan: BilanCouverture): { sansDefavorable: Couverture[]; sansFavorable: Couverture[] } {
  return {
    sansDefavorable: bilan.parReponse.filter((c) => c.defavorables === 0),
    sansFavorable: bilan.parReponse.filter((c) => c.favorables === 0),
  };
}
