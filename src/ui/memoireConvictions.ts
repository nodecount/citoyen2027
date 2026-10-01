import { trouverPosition, type ChoixPositions } from "../positions";

// Convictions du visiteur : gardées dans SON navigateur (localStorage), jamais transmises, effaçables — mêmes garde-fous
// que les réponses (voir memoireReponses.ts). Stockage absent ou refusé : jamais bloquant.
export interface Convictions {
  // Position choisie par sujet (voir src/positions.ts). Un sujet absent = « pas d'avis ».
  positions: ChoixPositions;
  // « Je tiens à un candidat sans condamnation définitive » : écarte du résultat « convictions » les candidats concernés.
  exemplarite: boolean;
}

export const CONVICTIONS_VIDES: Convictions = { positions: {}, exemplarite: false };
const CLE_CONVICTIONS = "convictions-visiteur";

export function aDesConvictions(c: Convictions): boolean {
  return Object.keys(c.positions).length > 0 || c.exemplarite;
}

// Ne garde que ce qui est valide pour le catalogue actuel : un sujet ou une position disparus sont écartés, jamais devinés
// (les anciens choix « par groupes » d'une version précédente sont donc simplement ignorés).
export function assainirConvictions(brut: unknown): Convictions {
  if (typeof brut !== "object" || brut === null || Array.isArray(brut)) return CONVICTIONS_VIDES;
  const stocke = brut as Record<string, unknown>;
  const positions: ChoixPositions = {};
  if (typeof stocke.positions === "object" && stocke.positions !== null && !Array.isArray(stocke.positions)) {
    for (const [sujet, position] of Object.entries(stocke.positions as Record<string, unknown>)) {
      if (typeof position === "string" && trouverPosition(sujet, position)) positions[sujet] = position;
    }
  }
  return { positions, exemplarite: stocke.exemplarite === true };
}

export function lireConvictions(): Convictions {
  try {
    const texte = window.localStorage.getItem(CLE_CONVICTIONS);
    return texte ? assainirConvictions(JSON.parse(texte)) : CONVICTIONS_VIDES;
  } catch {
    return CONVICTIONS_VIDES;
  }
}

export function memoriserConvictions(convictions: Convictions): void {
  try {
    if (aDesConvictions(convictions)) window.localStorage.setItem(CLE_CONVICTIONS, JSON.stringify(convictions));
    else window.localStorage.removeItem(CLE_CONVICTIONS);
  } catch {
    // sans conséquence : les convictions restent en mémoire pour cette session
  }
}
