import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import themesData from "../../data/themes.json";
import profilSchema from "../../data/profils-schema.json";
import { VALEURS_PAR_CHAMP } from "../effets";
import type { CandidatMeta } from "../types";
import { DOMAINES_INSTITUTIONNELS, domainesAutorises, domainesAvecInstitutions } from "./domaines";
import { SCHEMA_PROPOSITION_GENEREE, validerPropositionGeneree, type PropositionGeneree } from "./schema";

const ICI = dirname(fileURLToPath(import.meta.url));
const MODELE = "claude-sonnet-5";
const MAX_TOKENS = 16000;

const themes = themesData as Array<{ id: string; libelle: string; description: string }>;

// Le périmètre d'un thème vient de data/themes.json : sans lui, le modèle devine (ex : « Travail »
// inclut-il les retraites ?) et le périmètre varierait d'un candidat à l'autre.
function descriptionDuTheme(themeId: string): string {
  return themes.find((t) => t.id === themeId)?.description ?? "(périmètre non précisé)";
}

// split/join plutôt que String.replace : une valeur qui contient « $& » ou « $1 » (titre de mesure,
// libellé) ne doit jamais être interprétée comme un motif de remplacement.
function remplirGabarit(gabarit: string, valeurs: Record<string, string>): string {
  let texte = gabarit;
  for (const [cle, valeur] of Object.entries(valeurs)) {
    texte = texte.split(`{{${cle}}}`).join(valeur);
  }
  return texte;
}

// Les champs ciblables et leurs valeurs viennent du formulaire citoyen (data/profils-schema.json) :
// une seule source de vérité, donc le prompt suit automatiquement toute évolution du profil.
function descriptionChampsProfil(): string {
  const libelles: Record<string, string> = { enfants_a_charge: "Enfants à charge (déduit du nombre d'enfants)" };
  for (const champ of profilSchema as Array<{ id: string; label: string }>) libelles[champ.id] = champ.label;
  return Object.entries(VALEURS_PAR_CHAMP)
    .map(
      ([champ, valeurs]) =>
        `- \`${champ}\` (${libelles[champ] ?? champ}) : ${valeurs.map((v) => `\`${v}\``).join(" | ")}`,
    )
    .join("\n");
}

export interface RequeteGeneration {
  model: string;
  max_tokens: number;
  system: string;
  tools: Array<{ type: string; name: string; allowed_domains: string[] }>;
  output_config: { format: unknown; effort: string };
  messages: Array<{ role: "user"; content: string }>;
}

export interface BlocContenuReponse {
  type: string;
  text?: string;
  content?: unknown;
}

export interface ReponseAnthropicMinimale {
  content: BlocContenuReponse[];
  stop_reason?: string | null;
}

export interface ClientAnthropicMinimal {
  messages: {
    create(requete: RequeteGeneration): Promise<ReponseAnthropicMinimale>;
  };
}

export function detecterErreurReponse(reponse: ReponseAnthropicMinimale): string | null {
  if (reponse.stop_reason === "refusal") {
    return "le modèle a refusé la requête (stop_reason: refusal)";
  }
  for (const bloc of reponse.content) {
    if (
      (bloc.type === "web_search_tool_result" || bloc.type === "web_fetch_tool_result") &&
      bloc.content !== null &&
      typeof bloc.content === "object" &&
      !Array.isArray(bloc.content) &&
      "error_code" in (bloc.content as Record<string, unknown>)
    ) {
      const codeErreur = (bloc.content as Record<string, unknown>).error_code;
      return `erreur d'outil serveur (${bloc.type}) : ${String(codeErreur)}`;
    }
  }
  return null;
}

export function construireRequeteGeneration(
  meta: CandidatMeta,
  themeId: string,
  themeLibelle: string,
  titresExistants: string[],
): RequeteGeneration {
  const gabarit = readFileSync(resolve(ICI, "prompts/generation.md"), "utf-8");
  // Le domaine officiel du candidat reste obligatoire : les institutions ne peuvent que préciser.
  const domaines = domainesAvecInstitutions(meta);
  if (domainesAutorises(meta).length === 0) {
    throw new Error(`Aucun domaine officiel exploitable pour ${meta.nom} (slug: ${meta.slug}) — vérifier sources_officielles dans meta.json`);
  }
  const listeTitresExistants =
    titresExistants.length > 0
      ? titresExistants.map((titre) => `  - ${titre}`).join("\n")
      : "  (aucune proposition existante pour ce candidat)";

  const system = remplirGabarit(gabarit, {
    CANDIDAT: meta.nom,
    THEME: themeLibelle,
    THEME_DESCRIPTION: descriptionDuTheme(themeId),
    DATE: new Date().toISOString().slice(0, 10),
    DOMAINES_INSTITUTIONNELS: DOMAINES_INSTITUTIONNELS.join(", "),
    CHAMPS_PROFIL: descriptionChampsProfil(),
    TITRES_EXISTANTS: listeTitresExistants,
  });

  const notesSourcesOfficielles = meta.sources_officielles.map((s) => `  - ${s.label}`).join("\n");
  const systemAvecReserves = `${system}\n\nContexte sur les sources officielles disponibles pour ce candidat (avec toute réserve déjà documentée sur leur niveau d'attribution) :\n${notesSourcesOfficielles}\n\nSi une source ci-dessus précise que son contenu est publié par le parti/mouvement plutôt qu'attribué individuellement au candidat, attribue les propositions correspondantes à cette organisation dans resume_factuel — ne les présente jamais comme la position personnelle du candidat sans cette nuance.`;

  return {
    model: MODELE,
    max_tokens: MAX_TOKENS,
    system: systemAvecReserves,
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
  const erreur = detecterErreurReponse(reponse);
  if (erreur) {
    throw new Error(`genererPropositions (${meta.slug} × ${themeId}) : ${erreur}`);
  }
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

export function creerClient(cleApi?: string): Anthropic {
  return cleApi ? new Anthropic({ apiKey: cleApi }) : new Anthropic();
}
