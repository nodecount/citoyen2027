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
import { appeler, extraireActivite, type ActiviteOutils } from "./appel";
import { diagnostiquerArret } from "./trace";

const ICI = dirname(fileURLToPath(import.meta.url));
const MODELE = "claude-sonnet-5";
const MAX_TOKENS = 16000;

// Bornes de coût et de durée. Le premier essai réel (Attal × fiscalité) a pris 14 minutes et environ
// 1,5 million de jetons par appel : les pages lues (jusqu'à ~60 000 jetons chacune) sont renvoyées à
// chaque tour de la boucle d'outils. On borne donc le nombre d'appels d'outil et la taille de page.
export const MAX_RECHERCHES = 8;
export const MAX_LECTURES = 12;
export const MAX_TOKENS_PAGE = 20000;
export const EFFORT = "medium";

const themes = themesData as Array<{ id: string; libelle: string; description: string }>;

// Le périmètre d'un thème vient de data/themes.json : sans lui, le modèle devine (ex : « Travail »
// inclut-il les retraites ?) et le périmètre varierait d'un candidat à l'autre.
function descriptionDuTheme(themeId: string): string {
  return themes.find((t) => t.id === themeId)?.description ?? "(périmètre non précisé)";
}

// split/join plutôt que String.replace : une valeur qui contient « $& » ou « $1 » (titre de mesure,
// libellé) ne doit jamais être interprétée comme un motif de remplacement.
export function remplirGabarit(gabarit: string, valeurs: Record<string, string>): string {
  let texte = gabarit;
  for (const [cle, valeur] of Object.entries(valeurs)) {
    texte = texte.split(`{{${cle}}}`).join(valeur);
  }
  return texte;
}

// Les champs ciblables et leurs valeurs viennent du formulaire citoyen (data/profils-schema.json) :
// une seule source de vérité, donc le prompt suit automatiquement toute évolution du profil.
export function descriptionChampsProfil(): string {
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
  tools: Array<{
    type: string;
    name: string;
    allowed_domains: string[];
    max_uses?: number;
    max_content_tokens?: number;
  }>;
  output_config: { format: unknown; effort: string };
  // `assistant` + blocs : reprise d'une réponse en pause_turn (voir appel.ts).
  messages: Array<{ role: "user" | "assistant"; content: string | BlocContenuReponse[] }>;
}

export interface BlocContenuReponse {
  type: string;
  text?: string;
  content?: unknown;
  id?: string;
  name?: string;
  input?: unknown;
  tool_use_id?: string;
  // Point de coupure du cache de prompt : tout ce qui précède est mis en cache (voir extraction.ts).
  cache_control?: { type: "ephemeral" };
}

export interface ReponseAnthropicMinimale {
  content: BlocContenuReponse[];
  stop_reason?: string | null;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
    server_tool_use?: { web_search_requests?: number; web_fetch_requests?: number };
  };
}

export interface ClientAnthropicMinimal {
  messages: {
    create(
      requete: RequeteGeneration,
      options?: { timeout?: number; maxRetries?: number },
    ): Promise<ReponseAnthropicMinimale>;
  };
}

// Vraies pannes de l'outil : fatales, sinon un thème « vide » pourrait les masquer et se lire comme
// « ce candidat n'a rien proposé ». Toute autre erreur d'outil (page introuvable, URL hors domaine ou
// jamais vue dans la conversation…) est propre à UNE requête du modèle : il tâtonne puis répond avec ce
// qu'il a pu lire. Elle est tolérée mais journalisée, jamais silencieuse.
const PANNES_OUTIL = new Set(["unavailable", "too_many_requests", "max_uses_exceeded"]);

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
      const codeErreur = String((bloc.content as Record<string, unknown>).error_code);
      if (PANNES_OUTIL.has(codeErreur)) return `erreur d'outil serveur (${bloc.type}) : ${codeErreur}`;
      console.warn(`[outil] ${bloc.type} : ${codeErreur} (toléré : erreur propre à une requête du modèle)`);
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
      { type: "web_search_20260209", name: "web_search", allowed_domains: domaines, max_uses: MAX_RECHERCHES },
      {
        type: "web_fetch_20260209",
        name: "web_fetch",
        allowed_domains: domaines,
        max_uses: MAX_LECTURES,
        max_content_tokens: MAX_TOKENS_PAGE,
      },
    ],
    output_config: {
      format: { type: "json_schema", schema: { type: "array", items: SCHEMA_PROPOSITION_GENEREE } },
      effort: EFFORT,
    },
    messages: [
      {
        role: "user",
        content: `Recherche les propositions du programme de ${meta.nom} pour le thème "${themeLibelle}" (id interne : ${themeId}), en te limitant strictement aux domaines autorisés : ${domaines.join(", ")}.`,
      },
    ],
  };
}

export interface DiagnosticGeneration {
  stop_reason: string | null | undefined;
  dureeMs: number;
  continuations: number;
  usage: ReponseAnthropicMinimale["usage"];
  activite: ActiviteOutils;
  // Propositions renvoyées par le modèle mais écartées par la validation du schéma.
  ecartees: number;
  cheminTrace?: string;
}

export interface ResultatGeneration {
  propositions: PropositionGeneree[];
  diagnostic: DiagnosticGeneration;
}

// Un `[]` explicite du modèle est le SEUL cas où « aucune mesure » est une réponse. Tout le reste
// (texte absent, JSON invalide, sortie tronquée, refus, panne d'outil) lève : sinon un arrêt anormal
// se lirait comme « ce candidat n'a rien proposé sur ce thème », faute qu'on puisse le distinguer.
export async function genererPropositionsDetaillee(
  client: ClientAnthropicMinimal,
  meta: CandidatMeta,
  themeId: string,
  themeLibelle: string,
  titresExistants: string[],
): Promise<ResultatGeneration> {
  const requete = construireRequeteGeneration(meta, themeId, themeLibelle, titresExistants);
  const contexte = `genererPropositions (${meta.slug} × ${themeId})`;
  const { reponse, dureeMs, continuations, cheminTrace } = await appeler(client, requete, {
    phase: "génération",
    slug: meta.slug,
    themeId,
  });

  if (reponse.stop_reason === "max_tokens") {
    throw new Error(
      `${contexte} : ${diagnostiquerArret(reponse.stop_reason, requete.max_tokens).texte}. Rien n'est enregistré.`,
    );
  }
  const erreur = detecterErreurReponse(reponse);
  if (erreur) throw new Error(`${contexte} : ${erreur}`);

  // Avec des outils, la réponse contient d'éventuels textes intermédiaires : le JSON est le dernier.
  const texte = [...reponse.content].reverse().find((bloc) => bloc.type === "text" && bloc.text)?.text;
  if (!texte) {
    throw new Error(
      `${contexte} : aucune réponse textuelle (arrêt : ${diagnostiquerArret(reponse.stop_reason, requete.max_tokens).texte})`,
    );
  }
  let brut: unknown;
  try {
    brut = JSON.parse(texte);
  } catch {
    throw new Error(`${contexte} : la réponse n'est pas du JSON valide : « ${texte.slice(0, 200)} »`);
  }
  if (!Array.isArray(brut)) {
    throw new Error(`${contexte} : la réponse est du JSON mais pas un tableau : « ${texte.slice(0, 200)} »`);
  }

  const propositions = brut.filter(validerPropositionGeneree);
  const ecartees = brut.length - propositions.length;
  if (ecartees > 0) {
    console.warn(`[génération] ${contexte} : ${ecartees} proposition(s) écartée(s), schéma ou effets invalides (voir la trace)`);
  }
  return {
    propositions,
    diagnostic: {
      stop_reason: reponse.stop_reason,
      dureeMs,
      continuations,
      usage: reponse.usage,
      activite: extraireActivite(reponse),
      ecartees,
      cheminTrace,
    },
  };
}

export async function genererPropositions(
  client: ClientAnthropicMinimal,
  meta: CandidatMeta,
  themeId: string,
  themeLibelle: string,
  titresExistants: string[],
): Promise<PropositionGeneree[]> {
  return (await genererPropositionsDetaillee(client, meta, themeId, themeLibelle, titresExistants)).propositions;
}

export function creerClient(cleApi?: string): Anthropic {
  return cleApi ? new Anthropic({ apiKey: cleApi }) : new Anthropic();
}
