import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { CandidatMeta } from "../types";
import { appeler } from "./appel";
import type { Fenetre } from "./extraction";
import { detecterErreurReponse, remplirGabarit, type ClientAnthropicMinimal, type RequeteGeneration } from "./generate";
import type { PropositionGeneree } from "./schema";
import type { Verdict } from "./verify";

// Relecture ciblée : le modèle ne voit que la fiche et les passages du document (fenêtres autour des extraits
// que le code a déjà retrouvés mot pour mot). Pas d'outil, pas de page à aller chercher — quelques milliers
// de jetons, contre ~250 000 et 56 lectures ratées pour l'ancienne relecture par outil web.

const ICI = dirname(fileURLToPath(import.meta.url));
const MODELE = "claude-sonnet-5";
const MAX_TOKENS = 4000;

export interface MesureAVerifier {
  proposition: PropositionGeneree;
  fenetres: Fenetre[];
}

const SCHEMA_VERDICTS = {
  type: "array",
  items: {
    type: "object",
    properties: { titre: { type: "string" }, verdict: { type: "string", enum: ["PASS", "FAIL"] }, raison: { type: "string" } },
    required: ["titre", "verdict"],
    additionalProperties: false,
  },
} as const;

export function construireRequeteVerificationExtraction(meta: CandidatMeta, mesures: MesureAVerifier[]): RequeteGeneration {
  const gabarit = readFileSync(resolve(ICI, "prompts/verification-extraction.md"), "utf-8");
  const donnees = mesures.map(({ proposition: p, fenetres }) => ({
    titre: p.titre,
    resume_factuel: p.resume_factuel,
    hypotheses_calcul: p.hypotheses_calcul,
    sources: p.sources.map((s) => ({ nom: s.nom, annee: s.annee })),
    effets: p.effets.map((e) => ({ cibles: e.cibles, dimension: e.dimension, sens: e.sens, extrait: e.extrait })),
    passages: fenetres.map((f) => ({ document: f.document, page: f.page, texte: f.texte })),
  }));
  return {
    model: MODELE,
    max_tokens: MAX_TOKENS,
    system: remplirGabarit(gabarit, { CANDIDAT: meta.nom }),
    tools: [],
    output_config: { format: { type: "json_schema", schema: SCHEMA_VERDICTS }, effort: "medium" },
    messages: [{ role: "user", content: `Mesures à relire, avec leurs passages :\n${JSON.stringify(donnees, null, 2)}` }],
  };
}

// Une mesure sans verdict reste absente de la carte : à l'appelant de la traiter comme un échec.
export async function verifierMesuresParPassages(
  client: ClientAnthropicMinimal,
  meta: CandidatMeta,
  mesures: MesureAVerifier[],
): Promise<Map<string, Verdict>> {
  const verdicts = new Map<string, Verdict>();
  if (mesures.length === 0) return verdicts;

  const { reponse } = await appeler(client, construireRequeteVerificationExtraction(meta, mesures), {
    phase: "vérification",
    slug: meta.slug,
  });
  if (reponse.stop_reason === "max_tokens") {
    throw new Error(`verifierMesuresParPassages (${meta.slug}) : sortie tronquée (max_tokens), les verdicts sont incomplets`);
  }
  const erreur = detecterErreurReponse(reponse);
  if (erreur) throw new Error(`verifierMesuresParPassages (${meta.slug}) : ${erreur}`);

  const texte = [...reponse.content].reverse().find((b) => b.type === "text" && b.text)?.text;
  let brut: unknown;
  try {
    brut = texte ? JSON.parse(texte) : undefined;
  } catch {
    brut = undefined;
  }
  if (!Array.isArray(brut)) return verdicts;
  for (const element of brut) {
    const v = element as { titre?: unknown; verdict?: unknown; raison?: unknown };
    if (typeof v.titre !== "string") continue;
    if (v.verdict === "PASS") verdicts.set(v.titre, { statut: "PASS" });
    else if (v.verdict === "FAIL") {
      verdicts.set(v.titre, { statut: "FAIL", raison: typeof v.raison === "string" && v.raison ? v.raison : "Aucune raison fournie" });
    }
  }
  return verdicts;
}
