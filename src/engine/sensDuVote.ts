import type { Effet, SensEffet } from "../effets";
import { trouverSujet, type PositionMesure } from "../positions";
import type { Proposition } from "../types";

// Une proposition issue d'un vote (`vote`) se lit du côté du citoyen : un candidat qui a voté CONTRE un texte refuse ce que le
// texte fait. Les effets et les positions sont décrits UNE fois, sur le texte ; c'est ici, par le code et jamais par le modèle,
// qu'un vote « contre » les inverse. Un sens indéterminé le reste (aucune polarité inventée). Sans `vote` ou avec « pour »,
// rien ne change : toutes les autres bases passent par ces fonctions sans effet.
const SENS_INVERSE: Record<SensEffet, SensEffet> = { hausse: "baisse", baisse: "hausse", indetermine: "indetermine" };

export function effetsDeLaProposition(proposition: Proposition): Effet[] {
  const effets = proposition.effets ?? [];
  return proposition.vote === "contre" ? effets.map((e) => ({ ...e, sens: SENS_INVERSE[e.sens] })) : effets;
}

// Pour un vote « contre », la position défendue devient l'autre position du sujet. Un sujet qui n'a pas exactement deux positions
// opposées, ou une position inconnue, n'est pas inversé : l'étiquette est omise plutôt que devinée.
export function positionsDeLaProposition(proposition: Proposition): PositionMesure[] {
  const positions = proposition.positions ?? [];
  if (proposition.vote !== "contre") return positions;
  const inversees: PositionMesure[] = [];
  for (const etiquette of positions) {
    const sujet = trouverSujet(etiquette.sujet);
    if (!sujet || sujet.positions.length !== 2) continue;
    const autre = sujet.positions.find((p) => p.id !== etiquette.position);
    if (!autre || !sujet.positions.some((p) => p.id === etiquette.position)) continue;
    inversees.push({ ...etiquette, position: autre.id });
  }
  return inversees;
}
