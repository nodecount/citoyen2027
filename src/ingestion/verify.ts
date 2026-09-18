import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { CandidatMeta } from "../types";
import type { ClientAnthropicMinimal, RequeteGeneration } from "./generate";
import { domainesAutorises } from "./domaines";
import { verifierChiffresPresents, verifierDomaineAutorise, verifierUrlDisponible, type FetchImpl } from "./checks";
import type { PropositionGeneree } from "./schema";

const ICI = dirname(fileURLToPath(import.meta.url));
const MODELE = "claude-opus-5";

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

  const textesSources = await Promise.all(proposition.sources.map((s) => texteDeUrl(s.url, fetchImpl)));
  const texteConcatene = textesSources.join("\n");
  if (!verifierChiffresPresents(proposition.hypotheses_calcul, texteConcatene)) {
    return { statut: "FAIL", raison: "Un chiffre cité dans hypotheses_calcul n'apparaît dans aucune source" };
  }

  return { statut: "PASS" };
}

function construireRequeteVerification(meta: CandidatMeta, propositions: PropositionGeneree[]): RequeteGeneration {
  const gabarit = readFileSync(resolve(ICI, "prompts/verification.md"), "utf-8");
  const domaines = domainesAutorises(meta);
  return {
    model: MODELE,
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
  const reponse = await client.messages.create(requete);
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
  for (const item of brut as Array<{ titre: string; verdict: "PASS" | "FAIL"; raison?: string }>) {
    resultats.set(
      item.titre,
      item.verdict === "PASS" ? { statut: "PASS" } : { statut: "FAIL", raison: item.raison ?? "non précisé" },
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
  const domaines = domainesAutorises(meta);
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
