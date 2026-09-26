import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { pathToFileURL } from "node:url";
import type { CandidatMeta } from "../types";
import { creerClient, type ClientAnthropicMinimal } from "./generate";
import { executerCombinaison, executerRefresh } from "./run";
import { chargerMeta, chargerPropositions, combinaisonDejaCouverte } from "./depot";
import type { FetchImpl } from "./checks";
import themesData from "../../data/bases/officielle/themes.json";

const themes = themesData as Array<{ id: string; libelle: string }>;
const PORT = 5175;

export interface RequeteRelance {
  slug: string;
  themes: string[];
  mode: "insert" | "update";
  cleApi: string;
}

export interface ResultatCombinaisonRelance {
  theme: string;
  statut: "traite" | "saute" | "erreur";
  fusionnees?: number;
  enAttente?: number;
  divergence?: boolean;
  message?: string;
}

export interface ResultatRelance {
  ok: boolean;
  resultats: ResultatCombinaisonRelance[];
}

export interface OptionsServeur {
  racine?: string;
  fetchImpl?: FetchImpl;
  fabriquerClient?: (cleApi: string) => ClientAnthropicMinimal;
}

export async function gererRelance(requete: RequeteRelance, options: OptionsServeur = {}): Promise<ResultatRelance> {
  const fabriquerClient =
    options.fabriquerClient ?? ((cleApi: string) => creerClient(cleApi) as unknown as ClientAnthropicMinimal);
  const client = fabriquerClient(requete.cleApi);
  const meta: CandidatMeta = chargerMeta(requete.slug, options.racine);
  const themesACouvrir = themes.filter((t) => requete.themes.includes(t.id));
  const resultats: ResultatCombinaisonRelance[] = [];

  for (const theme of themesACouvrir) {
    try {
      if (requete.mode === "insert") {
        const propositionsExistantes = chargerPropositions(requete.slug, options.racine);
        if (combinaisonDejaCouverte(propositionsExistantes, theme.id)) {
          resultats.push({ theme: theme.id, statut: "saute" });
          continue;
        }
        const { fusionnees, enAttente } = await executerCombinaison(
          client,
          meta,
          { slug: requete.slug, themeId: theme.id, themeLibelle: theme.libelle },
          propositionsExistantes,
          { racine: options.racine, fetchImpl: options.fetchImpl },
        );
        resultats.push({ theme: theme.id, statut: "traite", fusionnees: fusionnees.length, enAttente: enAttente.length });
      } else {
        const { divergence } = await executerRefresh(client, meta, theme.id, theme.libelle, {
          racine: options.racine,
          fetchImpl: options.fetchImpl,
        });
        resultats.push({ theme: theme.id, statut: "traite", divergence });
      }
    } catch (erreur) {
      resultats.push({
        theme: theme.id,
        statut: "erreur",
        message: erreur instanceof Error ? erreur.message : String(erreur),
      });
    }
  }

  return { ok: resultats.every((r) => r.statut !== "erreur"), resultats };
}

const EN_TETES_CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function lireCorpsJSON(requete: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let donnees = "";
    requete.on("data", (morceau) => {
      donnees += morceau;
    });
    requete.on("end", () => {
      try {
        resolve(donnees ? JSON.parse(donnees) : {});
      } catch (erreur) {
        reject(erreur);
      }
    });
    requete.on("error", reject);
  });
}

function envoyerJSON(reponse: ServerResponse, statut: number, corps: unknown): void {
  reponse.writeHead(statut, {
    "Content-Type": "application/json",
    ...EN_TETES_CORS,
  });
  reponse.end(JSON.stringify(corps));
}

// Le corps de la requête POST /api/relancer arrive comme JSON non typé — le caster directement
// en RequeteRelance (comme le ferait TypeScript sans vérification à l'exécution) laisserait
// passer une clé vide (repli silencieux sur .env, que la spec interdit explicitement) et un slug
// non validé (traversée de répertoire via chargerMeta/chargerPropositions, avec un message
// d'erreur JSON.parse potentiellement révélateur du contenu d'un fichier arbitraire lu).
export function validerRequeteRelance(corps: unknown): RequeteRelance | null {
  if (typeof corps !== "object" || corps === null) return null;
  const c = corps as Record<string, unknown>;
  if (typeof c.slug !== "string" || !/^[a-z0-9-]+$/.test(c.slug)) return null;
  if (typeof c.cleApi !== "string" || c.cleApi.trim().length === 0) return null;
  if (!Array.isArray(c.themes) || !c.themes.every((t) => typeof t === "string")) return null;
  if (c.mode !== "insert" && c.mode !== "update") return null;
  return { slug: c.slug, cleApi: c.cleApi, themes: c.themes as string[], mode: c.mode };
}

export function creerServeur() {
  return createServer(async (requete, reponse) => {
    if (requete.method === "OPTIONS") {
      reponse.writeHead(204, EN_TETES_CORS);
      reponse.end();
      return;
    }
    if (requete.method === "GET" && requete.url === "/api/sante") {
      envoyerJSON(reponse, 200, { statut: "ok" });
      return;
    }
    if (requete.method === "POST" && requete.url === "/api/relancer") {
      try {
        const corpsBrut = await lireCorpsJSON(requete);
        const corps = validerRequeteRelance(corpsBrut);
        if (!corps) {
          envoyerJSON(reponse, 400, {
            ok: false,
            message: "Requête invalide : slug (minuscules/tirets), cleApi (non vide), themes (tableau de chaînes) et mode (\"insert\" ou \"update\") sont requis.",
          });
          return;
        }
        const resultat = await gererRelance(corps);
        envoyerJSON(reponse, 200, resultat);
      } catch (erreur) {
        envoyerJSON(reponse, 500, {
          ok: false,
          message: erreur instanceof Error ? erreur.message : String(erreur),
        });
      }
      return;
    }
    envoyerJSON(reponse, 404, { message: "Route inconnue" });
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = PORT;
  // Liaison explicite à 127.0.0.1 : sans hôte explicite, Node écoute sur toutes les interfaces
  // (0.0.0.0), ce qui rendrait le serveur joignable depuis tout le réseau local — contredisant la
  // prémisse de sécurité qui justifie le CORS permissif ci-dessus ("accessible que depuis localhost").
  creerServeur().listen(port, "127.0.0.1", () => {
    console.log(`Serveur de monitoring local sur http://localhost:${port}`);
  });
}
