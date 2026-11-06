import { trouverPosition } from "../positions";
import { valeursDuProfil, type ProfilPartiel } from "../profil";
import type { ChampProfil, Proposition } from "../types";
import { statutEffet } from "./projection";
import { effetsDeLaProposition, positionsDeLaProposition } from "./sensDuVote";

// Nombre de mesures (tous candidats confondus, chacune comptée une fois) dont un effet vise la réponse donnée à CETTE
// question, sans que le reste du profil l'écarte : un effet « hors cible » d'après une autre réponse n'est pas compté,
// pas plus qu'un effet visant un public que le formulaire ne sait pas décrire (le calcul ne le prend pas en compte non plus).
// Null tant que la question n'a pas de réponse. Le nombre d'enfants (réponse numérique) se lit par `enfants_a_charge`.
// Aucune polarité ici : « impactée » veut dire « visée », pas « favorable » ou « défavorable ».
export function compterMesuresImpactees(champ: ChampProfil, profil: ProfilPartiel, propositions: Proposition[]): number | null {
  const champCible = champ.id === "nombre_enfants" ? "enfants_a_charge" : champ.id;
  const reponses = valeursDuProfil(profil, champCible);
  if (reponses === null) return null;
  let compte = 0;
  for (const proposition of propositions) {
    if (proposition.statut === "provisoire") continue;
    const visee = effetsDeLaProposition(proposition).some((effet) => {
      const critere = effet.cibles.find((c) => c.champ === champCible);
      if (!critere || !reponses.some((v) => critere.valeurs.includes(v))) return false;
      const statut = statutEffet(profil, effet);
      return statut.type === "applicable" || (statut.type === "a_confirmer" && !statut.horsFormulaire);
    });
    if (visee) compte += 1;
  }
  return compte;
}

// Convictions : nombre de mesures (tous candidats, chacune une fois) étiquetées avec CETTE position du sujet. Seules les mesures
// étiquetées comptent : une mesure sans étiquette n'est jamais « pour » ni « contre » (src/positions.ts).
export function compterMesuresPosition(sujetId: string, positionId: string, propositions: Proposition[]): number {
  if (!trouverPosition(sujetId, positionId)) return 0;
  return propositions.filter((p) => p.statut !== "provisoire" && positionsDeLaProposition(p).some((e) => e.sujet === sujetId && e.position === positionId)).length;
}
