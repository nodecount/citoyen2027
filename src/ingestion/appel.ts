import type { BlocContenuReponse, ClientAnthropicMinimal, ReponseAnthropicMinimale, RequeteGeneration } from "./generate";
import { Budget, estimerAppelUsd } from "./budget";
import { estimerJetons } from "./documents";
import { diagnostiquerArret, ecrireTraceBrute } from "./trace";

// Tout appel API du pipeline passe par ici : timeout imposé, aucune relance automatique, pauses de la
// boucle d'outils reprises, et un bilan complet affiché + une trace brute écrite sur disque.
//
// Pourquoi pas de relance : le SDK relance par défaut deux fois après un timeout ; chaque relance
// repaie tout l'appel (des millions de jetons avec les pages lues) et masque ce qui s'est passé.

export const TIMEOUT_APPEL_MS = 10 * 60_000;
// Une réponse en pause_turn doit être renvoyée telle quelle pour continuer. On borne pour ne jamais
// boucler en payant.
export const MAX_CONTINUATIONS = 4;

// Budget courant : défini par le CLI au démarrage. Tout appel payant du pipeline passe par appeler(), donc le
// plafond s'applique partout (extraction, relecture, synthèse) sans repasser le budget de fonction en fonction.
let budgetCourant: Budget | undefined;

export function definirBudget(budget: Budget | undefined): void {
  budgetCourant = budget;
}

export function budgetActuel(): Budget | undefined {
  return budgetCourant;
}

// Jetons de la requête, séparés entre la partie mise en cache (blocs marqués cache_control) et le reste.
function jetonsRequete(requete: RequeteGeneration): { corpus: number; autres: number } {
  let corpus = 0;
  let autres = estimerJetons(requete.system);
  for (const message of requete.messages) {
    if (typeof message.content === "string") {
      autres += estimerJetons(message.content);
      continue;
    }
    for (const bloc of message.content) {
      const jetons = estimerJetons(bloc.text ?? JSON.stringify(bloc));
      if (bloc.cache_control) corpus += jetons;
      else autres += jetons;
    }
  }
  return { corpus, autres };
}

export interface ContexteAppel {
  phase: string;
  slug: string;
  themeId?: string;
}

export interface ResultatAppel {
  reponse: ReponseAnthropicMinimale;
  dureeMs: number;
  continuations: number;
  cheminTrace?: string;
}

function formaterDuree(dureeMs: number): string {
  const secondes = Math.round(dureeMs / 1000);
  return secondes >= 60 ? `${Math.floor(secondes / 60)} min ${secondes % 60} s` : `${secondes} s`;
}

interface DetailsBilan {
  contexte?: ContexteAppel;
  requete?: RequeteGeneration;
  continuations?: number;
  cheminTrace?: string;
}

export interface ActiviteOutils {
  // Nombre d'appels par outil (web_search, web_fetch).
  parOutil: Record<string, number>;
  requetes: string[];
  // Pages effectivement lues (demandées ET sans erreur) ; les échecs sont listés à part avec leur code.
  urlsLues: string[];
  echecs: Array<{ cible: string; code: string }>;
}

// Ce que le modèle a réellement fait avec ses outils, tiré des blocs de la réponse.
export function extraireActivite(reponse: ReponseAnthropicMinimale): ActiviteOutils {
  const utilisations = reponse.content.filter((bloc) => bloc.type === "server_tool_use");
  const parOutil: Record<string, number> = {};
  const requetes: string[] = [];
  const urlsDemandees: string[] = [];
  for (const bloc of utilisations) {
    const nom = bloc.name ?? "outil";
    parOutil[nom] = (parOutil[nom] ?? 0) + 1;
    const entree = (bloc.input ?? {}) as Record<string, unknown>;
    if (typeof entree.query === "string") requetes.push(entree.query);
    if (typeof entree.url === "string") urlsDemandees.push(entree.url);
  }

  const echecs: Array<{ cible: string; code: string }> = [];
  for (const bloc of reponse.content) {
    const contenu = bloc.content as Record<string, unknown> | null | undefined;
    if (!bloc.tool_use_id || typeof contenu !== "object" || contenu === null || !("error_code" in contenu)) continue;
    const appel = utilisations.find((u) => u.id === bloc.tool_use_id);
    const entree = (appel?.input ?? {}) as Record<string, unknown>;
    echecs.push({ cible: String(entree.url ?? entree.query ?? "?"), code: String(contenu.error_code) });
  }
  const urlsEchouees = new Set(echecs.map((e) => e.cible));
  return { parOutil, requetes, urlsLues: urlsDemandees.filter((u) => !urlsEchouees.has(u)), echecs };
}

// Bilan lisible d'un appel : sans lui, un essai de 14 minutes qui ne rend rien est inexplicable
// (combien de jetons ? pourquoi arrêté ? quelles pages lues ? lesquelles inaccessibles ?).
export function resumerAppel(reponse: ReponseAnthropicMinimale, dureeMs: number, details: DetailsBilan = {}): string {
  const activite = extraireActivite(reponse);
  const noms = Object.entries(activite.parOutil);
  const outils = noms.length > 0 ? noms.map(([nom, nombre]) => `${nom} ×${nombre}`).join(", ") : "aucun appel d'outil";
  const echecs = activite.echecs.map((e) => `${e.cible} (${e.code})`);

  const usage = reponse.usage;
  const jetons = usage
    ? `entrée ${usage.input_tokens ?? "?"} · sortie ${usage.output_tokens ?? "?"} · cache écrit ${usage.cache_creation_input_tokens ?? 0} · cache lu ${usage.cache_read_input_tokens ?? 0}`
    : "inconnus";
  const cote = usage?.server_tool_use;
  const declares = cote ? ` (déclarés par l'API : recherches ${cote.web_search_requests ?? 0}, lectures ${cote.web_fetch_requests ?? 0})` : "";
  const maxTokens = details.requete?.max_tokens ?? 0;
  const arret = diagnostiquerArret(reponse.stop_reason, maxTokens);
  const texteFinal = reponse.content.filter((b) => b.type === "text" && b.text).map((b) => b.text as string).join("");

  const titre = details.contexte
    ? `[appel] ${details.contexte.phase} ${details.contexte.slug}${details.contexte.themeId ? ` × ${details.contexte.themeId}` : ""}`
    : "[appel]";
  const lignes = [titre];
  if (details.requete) {
    lignes.push(
      `  modèle ${details.requete.model} · effort ${details.requete.output_config.effort} · max_tokens ${details.requete.max_tokens} · timeout ${TIMEOUT_APPEL_MS / 60_000} min · continuations ${details.continuations ?? 0}`,
    );
  }
  lignes.push(`  durée ${formaterDuree(dureeMs)} · arrêt : ${arret.texte}`);
  lignes.push(`  jetons : ${jetons}`);
  lignes.push(`  outils : ${outils}${declares}`);
  if (echecs.length > 0) lignes.push(`  échecs : ${echecs.join(" ; ")}`);
  lignes.push(`  texte final : ${texteFinal.length > 0 ? `${texteFinal.length} caractères` : "aucun"}`);
  if (details.cheminTrace) lignes.push(`  trace complète : ${details.cheminTrace}`);
  return lignes.join("\n");
}

function additionner(a: ReponseAnthropicMinimale["usage"], b: ReponseAnthropicMinimale["usage"]): ReponseAnthropicMinimale["usage"] {
  if (!a) return b;
  if (!b) return a;
  const somme = (x?: number, y?: number) => (x ?? 0) + (y ?? 0);
  return {
    input_tokens: somme(a.input_tokens, b.input_tokens),
    output_tokens: somme(a.output_tokens, b.output_tokens),
    cache_creation_input_tokens: somme(a.cache_creation_input_tokens, b.cache_creation_input_tokens),
    cache_read_input_tokens: somme(a.cache_read_input_tokens, b.cache_read_input_tokens),
    server_tool_use: {
      web_search_requests: somme(a.server_tool_use?.web_search_requests, b.server_tool_use?.web_search_requests),
      web_fetch_requests: somme(a.server_tool_use?.web_fetch_requests, b.server_tool_use?.web_fetch_requests),
    },
  };
}

function estTimeout(erreur: unknown): boolean {
  return erreur instanceof Error && (erreur.name === "APIConnectionTimeoutError" || /timed? ?out/i.test(erreur.message));
}

// Ne pas imputer à notre limite une coupure qui arrive bien avant elle : un premier essai coupé à
// 5 min 7 s avait été présenté comme « timeout de 10 min atteint », ce qui était faux.
function expliquerTimeout(dureeMs: number, limiteMs: number): string {
  const limite = `${limiteMs / 60_000} min`;
  if (dureeMs >= limiteMs * 0.95) {
    return `TIMEOUT imposé de ${limite} atteint : l'appel a été coupé côté client (il a pu être facturé)`;
  }
  return `Délai dépassé AVANT notre limite de ${limite} : la coupure vient de la connexion ou de l'API, pas de notre timeout (l'appel a pu être facturé)`;
}

// Les traces ne sont pas écrites pendant les tests (VITEST est défini par vitest).
function tracer(entree: Parameters<typeof ecrireTraceBrute>[0]): string | undefined {
  return process.env.VITEST ? undefined : ecrireTraceBrute(entree);
}

export async function appeler(
  client: ClientAnthropicMinimal,
  requete: RequeteGeneration,
  contexte: ContexteAppel,
  options: { timeoutMs?: number } = {},
): Promise<ResultatAppel> {
  const limiteMs = options.timeoutMs ?? TIMEOUT_APPEL_MS;
  const etiquette = `${contexte.phase} ${contexte.slug}${contexte.themeId ? ` × ${contexte.themeId}` : ""}`;
  if (budgetCourant) {
    const { corpus, autres } = jetonsRequete(requete);
    const estimation = estimerAppelUsd(budgetCourant.tarifs, {
      jetonsCorpus: corpus,
      jetonsAutres: autres,
      jetonsSortieMax: requete.max_tokens,
      cache: corpus > 0 ? budgetCourant.modeCache() : "aucun",
    });
    budgetCourant.verifierAvant(estimation, etiquette);
  }
  const debutTotal = Date.now();
  const messages = [...requete.messages];
  let contenu: BlocContenuReponse[] = [];
  let usage: ReponseAnthropicMinimale["usage"];
  let derniere: ReponseAnthropicMinimale | undefined;
  let continuations = 0;

  for (;;) {
    let reponse: ReponseAnthropicMinimale;
    try {
      reponse = await client.messages.create({ ...requete, messages }, { timeout: limiteMs, maxRetries: 0 });
    } catch (erreur) {
      const dureeMs = Date.now() - debutTotal;
      const message = erreur instanceof Error ? erreur.message : String(erreur);
      const chemin = tracer({ ...contexte, requete, reponse: derniere && { ...derniere, content: contenu, usage }, erreur: message, dureeMs });
      console.error(
        `[appel] ÉCHEC ${contexte.phase} ${contexte.slug}${contexte.themeId ? ` × ${contexte.themeId}` : ""} après ${formaterDuree(dureeMs)} : ${message}` +
          (estTimeout(erreur) ? `\n  ${expliquerTimeout(dureeMs, limiteMs)}` : "") +
          (chemin ? `\n  trace complète : ${chemin}` : ""),
      );
      throw erreur;
    }
    derniere = reponse;
    contenu = [...contenu, ...reponse.content];
    usage = additionner(usage, reponse.usage);

    if (reponse.stop_reason !== "pause_turn") break;
    if (continuations >= MAX_CONTINUATIONS) {
      const dureeMs = Date.now() - debutTotal;
      const chemin = tracer({ ...contexte, requete, reponse: { ...reponse, content: contenu, usage }, erreur: "pause_turn répété", dureeMs });
      console.error(`[appel] ÉCHEC ${contexte.phase} ${contexte.slug} : ${MAX_CONTINUATIONS} continuations après pause_turn sans fin${chemin ? `\n  trace complète : ${chemin}` : ""}`);
      throw new Error(`pause_turn : la boucle d'outils ne se termine pas après ${MAX_CONTINUATIONS} continuations (${contexte.slug})`);
    }
    continuations += 1;
    messages.push({ role: "assistant", content: reponse.content });
  }

  const dureeMs = Date.now() - debutTotal;
  const fusionnee: ReponseAnthropicMinimale = { content: contenu, stop_reason: derniere?.stop_reason, usage };
  const cheminTrace = tracer({ ...contexte, requete, reponse: fusionnee, dureeMs });
  let ligneCout = "";
  if (budgetCourant) {
    const eur = budgetCourant.enregistrer(usage);
    ligneCout = `\n  coût de l'appel ≈ ${eur.toFixed(2)} € · cumul ${budgetCourant.depenseEur.toFixed(2)} € / plafond ${budgetCourant.plafondEur.toFixed(2)} €`;
  }
  console.log(resumerAppel(fusionnee, dureeMs, { contexte, requete, continuations, cheminTrace }) + ligneCout);
  return { reponse: fusionnee, dureeMs, continuations, cheminTrace };
}
