import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { CandidatMeta } from "../types";
import { domainesAutorises } from "./domaines";
import { SCHEMA_PROPOSITION_GENEREE, validerPropositionGeneree, type PropositionGeneree } from "./schema";

const ICI = dirname(fileURLToPath(import.meta.url));
const MODELE = "claude-opus-5";
const MAX_TOKENS = 8192;

export interface RequeteGeneration {
  model: string;
  max_tokens: number;
  system: string;
  tools: Array<{ type: string; name: string; allowed_domains: string[] }>;
  output_config: { format: unknown; effort: string };
  messages: Array<{ role: "user"; content: string }>;
}

export interface ClientAnthropicMinimal {
  messages: {
    create(requete: RequeteGeneration): Promise<{ content: Array<{ type: string; text?: string }> }>;
  };
}

export function construireRequeteGeneration(
  meta: CandidatMeta,
  themeId: string,
  themeLibelle: string,
  titresExistants: string[],
): RequeteGeneration {
  const gabarit = readFileSync(resolve(ICI, "prompts/generation.md"), "utf-8");
  const domaines = domainesAutorises(meta);
  const listeTitresExistants =
    titresExistants.length > 0
      ? titresExistants.map((titre) => `  - ${titre}`).join("\n")
      : "  (aucune proposition existante pour ce candidat)";

  const system = gabarit
    .split("{{CANDIDAT}}")
    .join(meta.nom)
    .replace("{{TITRES_EXISTANTS}}", listeTitresExistants);

  return {
    model: MODELE,
    max_tokens: MAX_TOKENS,
    system,
    tools: [
      { type: "web_search_20260209", name: "web_search", allowed_domains: domaines },
      { type: "web_fetch_20260209", name: "web_fetch", allowed_domains: domaines },
    ],
    output_config: {
      format: { type: "json_schema", schema: { type: "array", items: SCHEMA_PROPOSITION_GENEREE } },
      effort: "high",
    },
    messages: [
      {
        role: "user",
        content: `Recherche les propositions du programme de ${meta.nom} pour le thème "${themeLibelle}" (id interne : ${themeId}), en te limitant strictement aux domaines autorisés : ${domaines.join(", ")}.`,
      },
    ],
  };
}

export async function genererPropositions(
  client: ClientAnthropicMinimal,
  meta: CandidatMeta,
  themeId: string,
  themeLibelle: string,
  titresExistants: string[],
): Promise<PropositionGeneree[]> {
  const requete = construireRequeteGeneration(meta, themeId, themeLibelle, titresExistants);
  const reponse = await client.messages.create(requete);
  const blocTexte = reponse.content.find((bloc) => bloc.type === "text");
  if (!blocTexte?.text) return [];
  let brut: unknown;
  try {
    brut = JSON.parse(blocTexte.text);
  } catch {
    return [];
  }
  if (!Array.isArray(brut)) return [];
  return brut.filter(validerPropositionGeneree);
}

export function creerClient(): Anthropic {
  return new Anthropic();
}
