import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

// Trace brute de chaque appel API : requête et réponse COMPLÈTES (blocs de recherche, pages lues,
// usage, stop_reason), pour pouvoir dire après coup pourquoi un appel a rendu ce qu'il a rendu. Le
// dossier logs/ est ignoré par git : une trace contient des pages entières et coûte cher à produire.

const DOSSIER_PAR_DEFAUT = resolve(process.cwd(), "logs/ingestion");

export interface EntreeTrace {
  phase: string;
  slug: string;
  themeId?: string;
  requete: unknown;
  reponse?: unknown;
  erreur?: string;
  dureeMs: number;
}

// Pourquoi l'appel s'est arrêté, en clair. `normal` est faux pour tout arrêt qui rend le résultat
// incomplet ou suspect : troncature, pause de la boucle d'outils, refus, cause inconnue.
export function diagnostiquerArret(
  stopReason: string | null | undefined,
  maxTokens: number,
): { normal: boolean; texte: string } {
  switch (stopReason) {
    case "end_turn":
      return { normal: true, texte: "fin normale (end_turn)" };
    case "stop_sequence":
      return { normal: true, texte: "séquence d'arrêt atteinte (stop_sequence)" };
    case "max_tokens":
      return {
        normal: false,
        texte: `SORTIE TRONQUÉE : la limite max_tokens (${maxTokens}) est atteinte, la réponse est incomplète`,
      };
    case "pause_turn":
      return { normal: false, texte: "PAUSE : la boucle d'outils serveur s'est interrompue avant la fin de la réponse" };
    case "refusal":
      return { normal: false, texte: "REFUS : le modèle a refusé la requête (refusal)" };
    default:
      return { normal: false, texte: `arrêt inconnu (${String(stopReason)})` };
  }
}

// Ne lève jamais : une trace impossible à écrire ne doit pas faire perdre un appel déjà payé.
export function ecrireTraceBrute(entree: EntreeTrace, dossier: string = DOSSIER_PAR_DEFAUT): string | undefined {
  try {
    mkdirSync(dossier, { recursive: true });
    const horodatage = new Date().toISOString().replace(/[:.]/g, "-");
    const nom = [horodatage, entree.phase, entree.slug, entree.themeId].filter(Boolean).join("-") + ".json";
    const chemin = resolve(dossier, nom);
    writeFileSync(
      chemin,
      JSON.stringify(
        {
          phase: entree.phase,
          slug: entree.slug,
          theme: entree.themeId,
          duree_ms: entree.dureeMs,
          erreur: entree.erreur,
          requete: entree.requete,
          reponse: entree.reponse,
        },
        null,
        2,
      ),
    );
    return chemin;
  } catch (erreur) {
    console.warn(`[trace] écriture impossible : ${erreur instanceof Error ? erreur.message : String(erreur)}`);
    return undefined;
  }
}
