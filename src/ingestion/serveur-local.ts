import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { pathToFileURL } from "node:url";
import type { CandidatMeta } from "../types";
import { creerClient, type ClientAnthropicMinimal } from "./generate";
import { executerCombinaison, executerRefresh } from "./run";
import { chargerMeta, chargerPropositions, combinaisonDejaCouverte } from "./depot";
import type { FetchImpl } from "./checks";
import themesData from "../../data/themes.json";

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
        const corps = (await lireCorpsJSON(requete)) as RequeteRelance;
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
  creerServeur().listen(port, () => {
    console.log(`Serveur de monitoring local sur http://localhost:${port}`);
  });
}
