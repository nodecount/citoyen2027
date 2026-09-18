import { pathToFileURL } from "node:url";
import type { CandidatMeta, Proposition } from "../types";
import { genererPropositions, creerClient, type ClientAnthropicMinimal } from "./generate";
import { verifier } from "./verify";
import type { FetchImpl } from "./checks";
import type { PropositionGeneree } from "./schema";
import {
  chargerAVerifier,
  chargerMeta,
  chargerPropositions,
  combinaisonDejaCouverte,
  enregistrerAVerifier,
  enregistrerPropositions,
  type EntreeAVerifier,
} from "./depot";
import { chargerEnv } from "./env";
import { analyserArguments } from "./cli";
import themesData from "../../data/themes.json";

const themes = themesData as Array<{ id: string; libelle: string }>;

export interface CombinaisonACouvrir {
  slug: string;
  themeId: string;
  themeLibelle: string;
}

export interface OptionsExecution {
  racine?: string;
  fetchImpl?: FetchImpl;
  force?: boolean;
}

const ABREVIATIONS_THEME: Record<string, string> = {
  fiscalite: "fisc",
  "pouvoir-achat": "pa",
  travail: "trav",
  "aides-etat": "aides",
  "libertes-fondamentales": "lib",
  sante: "sante",
  securite: "secu",
  immigration: "immi",
  education: "educ",
  environnement: "envi",
  logement: "logt",
};

export function genererIdProposition(slug: string, themeId: string, index: number): string {
  const abreviation = ABREVIATIONS_THEME[themeId] ?? themeId;
  return `${slug}-${abreviation}-${String(index).padStart(3, "0")}`;
}

export interface ResultatCombinaison {
  fusionnees: Proposition[];
  enAttente: EntreeAVerifier[];
}

export async function executerCombinaison(
  client: ClientAnthropicMinimal,
  meta: CandidatMeta,
  combinaison: CombinaisonACouvrir,
  propositionsExistantes: Proposition[],
  options: OptionsExecution = {},
): Promise<ResultatCombinaison> {
  const titresExistants = propositionsExistantes.map((p) => p.titre);
  const generees = await genererPropositions(
    client,
    meta,
    combinaison.themeId,
    combinaison.themeLibelle,
    titresExistants,
  );
  const verdicts = await verifier(client, meta, generees, options.fetchImpl);

  const fusionnees: Proposition[] = [];
  const enAttente: EntreeAVerifier[] = [];
  let indexSuivant = propositionsExistantes.filter((p) => p.theme === combinaison.themeId).length + 1;

  for (const proposition of generees) {
    const verdict = verdicts.get(proposition.titre);
    if (verdict?.statut === "PASS") {
      fusionnees.push({
        ...proposition,
        id: genererIdProposition(meta.slug, combinaison.themeId, indexSuivant),
        candidat: meta.slug,
        theme: combinaison.themeId,
        date_derniere_verification: new Date().toISOString().slice(0, 10),
      });
      indexSuivant += 1;
    } else {
      enAttente.push({
        theme: combinaison.themeId,
        proposition,
        raison: verdict?.statut === "FAIL" ? verdict.raison : "Aucun verdict reçu",
      });
    }
  }

  if (fusionnees.length > 0) {
    enregistrerPropositions(meta.slug, [...propositionsExistantes, ...fusionnees], options.racine);
  }
  if (enAttente.length > 0) {
    const existantes = chargerAVerifier(meta.slug, options.racine);
    enregistrerAVerifier(meta.slug, [...existantes, ...enAttente], options.racine);
  }

  return { fusionnees, enAttente };
}

export function combinaisonsDiffere(existantes: Proposition[], fraiches: PropositionGeneree[]): boolean {
  if (existantes.length !== fraiches.length) return true;
  const normaliser = (p: { titre: string; resume_factuel: string; hypotheses_calcul: string; sources: { url: string }[] }) =>
    JSON.stringify({
      titre: p.titre,
      resume_factuel: p.resume_factuel,
      hypotheses_calcul: p.hypotheses_calcul,
      sources: p.sources.map((s) => s.url).sort(),
    });
  const existantesTriees = [...existantes].sort((a, b) => a.titre.localeCompare(b.titre)).map(normaliser);
  const fraichesTriees = [...fraiches].sort((a, b) => a.titre.localeCompare(b.titre)).map(normaliser);
  return existantesTriees.some((valeur, i) => valeur !== fraichesTriees[i]);
}

export async function executerRefresh(
  client: ClientAnthropicMinimal,
  meta: CandidatMeta,
  themeId: string,
  themeLibelle: string,
  options: OptionsExecution = {},
): Promise<{ divergence: boolean }> {
  const toutesPropositions = chargerPropositions(meta.slug, options.racine);
  const existantes = toutesPropositions.filter((p) => p.theme === themeId);
  const titresAutresThemes = toutesPropositions.filter((p) => p.theme !== themeId).map((p) => p.titre);
  const fraiches = await genererPropositions(client, meta, themeId, themeLibelle, titresAutresThemes);

  if (!combinaisonsDiffere(existantes, fraiches)) {
    return { divergence: false };
  }

  const entreesAVerifier = fraiches.map((proposition) => ({
    theme: themeId,
    proposition,
    raison: "refresh : divergence avec l'existant",
  }));
  const dejaEnAttente = chargerAVerifier(meta.slug, options.racine);
  enregistrerAVerifier(meta.slug, [...dejaEnAttente, ...entreesAVerifier], options.racine);
  return { divergence: true };
}

export function tirerEchantillon<T>(elements: T[], proportion: number, alea: () => number = Math.random): T[] {
  if (elements.length === 0) return [];
  const nombreATirer = Math.max(0, Math.round(elements.length * proportion));
  const copie = [...elements];
  const resultat: T[] = [];
  for (let i = 0; i < nombreATirer && copie.length > 0; i += 1) {
    const index = Math.floor(alea() * copie.length);
    resultat.push(copie.splice(index, 1)[0]);
  }
  return resultat;
}

export async function executerLot(
  client: ClientAnthropicMinimal,
  combinaisons: CombinaisonACouvrir[],
  options: OptionsExecution = {},
): Promise<void> {
  for (const combinaison of combinaisons) {
    try {
      const meta = chargerMeta(combinaison.slug, options.racine);
      const propositionsExistantes = chargerPropositions(combinaison.slug, options.racine);
      if (!options.force && combinaisonDejaCouverte(propositionsExistantes, combinaison.themeId)) {
        console.log(`[sauté] ${combinaison.slug} × ${combinaison.themeId} déjà couvert`);
        continue;
      }
      console.log(`[en cours] ${combinaison.slug} × ${combinaison.themeId}`);
      const { fusionnees, enAttente } = await executerCombinaison(
        client,
        meta,
        combinaison,
        propositionsExistantes,
        options,
      );
      console.log(
        `[terminé] ${combinaison.slug} × ${combinaison.themeId} : ${fusionnees.length} fusionnée(s), ${enAttente.length} en attente`,
      );
    } catch (erreur) {
      console.error(`[erreur] ${combinaison.slug} × ${combinaison.themeId} :`, erreur);
    }
  }
}

async function main(): Promise<void> {
  chargerEnv();
  const options = analyserArguments(process.argv.slice(2));
  // `ClientAnthropicMinimal` est une interface volontairement minimale (Tasks 1-4), conçue pour
  // rester découplée des types précis du SDK Anthropic afin de permettre des clients factices
  // simples dans les tests. Le SDK réel (`Anthropic`) est structurellement plus strict (types
  // littéraux, champs additionnels) sans être structurellement assignable dans un sens ou dans
  // l'autre. Le seul point de production où le client réel entre dans ce pipeline est ici :
  // l'assertion ci-dessous fait le pont, sans élargir l'interface minimale utilisée partout
  // ailleurs (et donc sans recoupler le reste du code aux types exacts du SDK).
  const client = creerClient() as unknown as ClientAnthropicMinimal;

  if (options.refresh) {
    const meta = chargerMeta(options.refresh.slug);
    const themesACouvrir = options.refresh.theme
      ? themes.filter((t) => t.id === options.refresh!.theme)
      : themes;
    for (const theme of themesACouvrir) {
      try {
        const { divergence } = await executerRefresh(client, meta, theme.id, theme.libelle);
        console.log(`[refresh] ${meta.slug} × ${theme.id} : ${divergence ? "divergence détectée, voir _a-verifier.json" : "inchangé"}`);
      } catch (erreur) {
        console.error(`[erreur refresh] ${meta.slug} × ${theme.id} :`, erreur);
      }
    }
    return;
  }

  const themesACouvrir = options.themes ? themes.filter((t) => options.themes!.includes(t.id)) : themes;
  const combinaisons: CombinaisonACouvrir[] = options.candidats.flatMap((slug) =>
    themesACouvrir.map((theme) => ({ slug, themeId: theme.id, themeLibelle: theme.libelle })),
  );

  await executerLot(client, combinaisons, { force: options.force });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((erreur) => {
    console.error(erreur);
    process.exitCode = 1;
  });
}
