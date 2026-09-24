import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { CandidatMeta } from "../types";
import { detecterErreurReponse, type ClientAnthropicMinimal, type RequeteGeneration } from "./generate";
import { appeler } from "./appel";
import { domainesAutorises, domainesAvecInstitutions, estSourceInstitutionnelle } from "./domaines";
import {
  verifierChiffresPresents,
  verifierDomaineAutorise,
  verifierExtraitPresent,
  verifierUrlDisponible,
  type FetchImpl,
} from "./checks";
import type { PropositionGeneree } from "./schema";

const ICI = dirname(fileURLToPath(import.meta.url));
const MODELE = "claude-sonnet-5";
const MAX_TOKENS = 16000;

export type Verdict = { statut: "PASS" } | { statut: "FAIL"; raison: string };

async function texteDeUrl(url: string, fetchImpl: FetchImpl): Promise<string> {
  const reponse = await fetchImpl(url);
  return reponse.text();
}

export async function verifierControlesDeterministes(
  proposition: PropositionGeneree,
  domaines: string[],
  fetchImpl: FetchImpl = fetch,
): Promise<Verdict> {
  for (const source of proposition.sources) {
    if (!verifierDomaineAutorise(source.url, domaines)) {
      return { statut: "FAIL", raison: `Domaine non autorisé pour la source « ${source.label} »` };
    }
    if (!(await verifierUrlDisponible(source.url, fetchImpl))) {
      return { statut: "FAIL", raison: `URL inaccessible : ${source.url}` };
    }
  }

  // Un document institutionnel (amendement, texte de loi) ne fait que PRÉCISER une position : il
  // faut au moins une source officielle du candidat ou du parti qui confirme que la mesure est
  // toujours défendue, sinon on présenterait une position ancienne comme actuelle.
  if (proposition.sources.every((s) => estSourceInstitutionnelle(s.url))) {
    return {
      statut: "FAIL",
      raison:
        "Aucune source officielle du candidat ou du parti : un document institutionnel seul ne prouve pas que la mesure est toujours défendue",
    };
  }

  const textesSources = await Promise.all(proposition.sources.map((s) => texteDeUrl(s.url, fetchImpl)));
  const texteConcatene = textesSources.join("\n");
  if (!verifierChiffresPresents(proposition.hypotheses_calcul, texteConcatene)) {
    return { statut: "FAIL", raison: "Un chiffre cité dans hypotheses_calcul n'apparaît dans aucune source" };
  }

  // Chaque effet doit être fondé sur un passage réel de la source qu'il cite.
  for (const effet of proposition.effets) {
    const index = proposition.sources.findIndex((s) => s.url === effet.source_url);
    if (index === -1 || !verifierExtraitPresent(effet.extrait, textesSources[index])) {
      return {
        statut: "FAIL",
        raison: `L'extrait cité pour un effet (« ${effet.extrait.slice(0, 80)} ») n'apparaît pas dans la source ${effet.source_url}`,
      };
    }
  }

  return { statut: "PASS" };
}

export function construireRequeteVerification(meta: CandidatMeta, propositions: PropositionGeneree[]): RequeteGeneration {
  const gabarit = readFileSync(resolve(ICI, "prompts/verification.md"), "utf-8");
  const domaines = domainesAvecInstitutions(meta);
  if (domainesAutorises(meta).length === 0) {
    throw new Error(`Aucun domaine officiel exploitable pour ${meta.nom} (slug: ${meta.slug}) — vérifier sources_officielles dans meta.json`);
  }
  return {
    model: MODELE,
    max_tokens: MAX_TOKENS,
    system: gabarit.split("{{CANDIDAT}}").join(meta.nom),
    tools: [{ type: "web_fetch_20260209", name: "web_fetch", allowed_domains: domaines }],
    output_config: {
      format: {
        type: "json_schema",
        schema: {
          type: "array",
          items: {
            type: "object",
            properties: {
              titre: { type: "string" },
              verdict: { type: "string", enum: ["PASS", "FAIL"] },
              raison: { type: "string" },
            },
            required: ["titre", "verdict"],
            additionalProperties: false,
          },
        },
      },
      effort: "high",
    },
    messages: [
      {
        role: "user",
        content: `Vérifie chacune des propositions suivantes en re-consultant leurs sources citées :\n${JSON.stringify(propositions)}`,
      },
    ],
  };
}

async function verifierSemantiquement(
  client: ClientAnthropicMinimal,
  meta: CandidatMeta,
  propositions: PropositionGeneree[],
): Promise<Map<string, Verdict>> {
  const requete = construireRequeteVerification(meta, propositions);
  const { reponse } = await appeler(client, requete, { phase: "vérification", slug: meta.slug });
  if (reponse.stop_reason === "max_tokens") {
    throw new Error(`verifierSemantiquement (${meta.slug}) : sortie tronquée (max_tokens), les verdicts sont incomplets`);
  }
  const erreur = detecterErreurReponse(reponse);
  if (erreur) {
    throw new Error(`verifierSemantiquement (${meta.slug}) : ${erreur}`);
  }
  const resultats = new Map<string, Verdict>();
  const blocTexte = reponse.content.find((bloc) => bloc.type === "text");
  if (!blocTexte?.text) return resultats;

  let brut: unknown;
  try {
    brut = JSON.parse(blocTexte.text);
  } catch {
    return resultats;
  }
  if (!Array.isArray(brut)) return resultats;
  for (const item of brut) {
    if (
      typeof item !== "object" ||
      item === null ||
      typeof (item as Record<string, unknown>).titre !== "string" ||
      ((item as Record<string, unknown>).verdict !== "PASS" && (item as Record<string, unknown>).verdict !== "FAIL")
    ) {
      continue;
    }
    const itemValide = item as { titre: string; verdict: "PASS" | "FAIL"; raison?: string };
    resultats.set(
      itemValide.titre,
      itemValide.verdict === "PASS" ? { statut: "PASS" } : { statut: "FAIL", raison: itemValide.raison ?? "non précisé" },
    );
  }
  return resultats;
}

export async function verifier(
  client: ClientAnthropicMinimal,
  meta: CandidatMeta,
  propositions: PropositionGeneree[],
  fetchImpl: FetchImpl = fetch,
): Promise<Map<string, Verdict>> {
  const domaines = domainesAvecInstitutions(meta);
  const resultats = new Map<string, Verdict>();
  const aVerifierSemantiquement: PropositionGeneree[] = [];

  for (const proposition of propositions) {
    const verdict = await verifierControlesDeterministes(proposition, domaines, fetchImpl);
    if (verdict.statut === "FAIL") {
      resultats.set(proposition.titre, verdict);
    } else {
      aVerifierSemantiquement.push(proposition);
    }
  }

  if (aVerifierSemantiquement.length > 0) {
    const verdictsSemantiques = await verifierSemantiquement(client, meta, aVerifierSemantiquement);
    for (const [titre, verdict] of verdictsSemantiques) {
      resultats.set(titre, verdict);
    }
  }

  return resultats;
}
