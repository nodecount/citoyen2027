import type { Etape } from "./ParcoursSimulateur";

// Dernière étape du simulateur où le visiteur s'est arrêté : gardée dans SON navigateur (localStorage), comme ses réponses et ses
// convictions (voir memoireReponses.ts), jamais transmise. Stockage absent ou refusé : jamais bloquant, on repart de l'étape déduite.
const CLE_ETAPE = "etape-simulateur";
const ETAPES: Etape[] = ["situation", "themes", "convictions", "resultat"];

const estEtape = (v: unknown): v is Etape => typeof v === "string" && (ETAPES as string[]).includes(v);

export function lireEtape(): Etape | null {
  try {
    const v = window.localStorage.getItem(CLE_ETAPE);
    return estEtape(v) ? v : null;
  } catch {
    return null;
  }
}

export function memoriserEtape(etape: Etape): void {
  try {
    window.localStorage.setItem(CLE_ETAPE, etape);
  } catch {
    // sans conséquence : l'étape reste en mémoire pour cette session
  }
}

// Étape d'arrivée dans le simulateur (décision du 2026-10-11, remplace « arrive sur le résultat ») : celle où le visiteur s'était
// arrêté ; à défaut, d'après ce qui est gardé : rien → 1 (situation) ; des réponses → 2 (mesures adaptées) ; des convictions → 3.
// Le résultat (4) n'est mémorisé que s'il est atteignable (réponses gardées) ; on n'y est jamais envoyé sans avoir choisi d'y aller.
export function etapeDeDepart({ memorisee, aDesReponses, aDesConvictions }: { memorisee: Etape | null; aDesReponses: boolean; aDesConvictions: boolean }): Etape {
  if (memorisee && (memorisee !== "resultat" || aDesReponses)) return memorisee;
  if (aDesConvictions) return "convictions";
  if (aDesReponses) return "themes";
  return "situation";
}
