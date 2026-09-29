import { GROUPES_SOCIAUX } from "../convictions";

// Convictions du visiteur : gardées dans SON navigateur (localStorage), jamais transmises, effaçables — mêmes garde-fous
// que les réponses (voir memoireReponses.ts). Stockage absent ou refusé : jamais bloquant.
export interface Convictions {
  // Identifiants de GROUPES_SOCIAUX : « je veux un candidat dont les mesures améliorent la situation de… ».
  groupes: string[];
  // « Je tiens à un candidat sans condamnation définitive » : affiche les faits d'intégrité sourcés.
  exemplarite: boolean;
}

export const CONVICTIONS_VIDES: Convictions = { groupes: [], exemplarite: false };
const CLE_CONVICTIONS = "convictions-visiteur";

export function aDesConvictions(c: Convictions): boolean {
  return c.groupes.length > 0 || c.exemplarite;
}

// Ne garde que ce qui est valide pour le catalogue actuel : un groupe disparu est écarté, jamais deviné.
export function assainirConvictions(brut: unknown): Convictions {
  if (typeof brut !== "object" || brut === null || Array.isArray(brut)) return CONVICTIONS_VIDES;
  const stocke = brut as Record<string, unknown>;
  const connus = new Set(GROUPES_SOCIAUX.map((g) => g.id));
  const groupes = Array.isArray(stocke.groupes) ? [...new Set(stocke.groupes.filter((g): g is string => typeof g === "string" && connus.has(g)))] : [];
  return { groupes, exemplarite: stocke.exemplarite === true };
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
