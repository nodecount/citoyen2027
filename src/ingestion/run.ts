import type { CandidatMeta, Proposition } from "../types";
import { genererPropositions, type ClientAnthropicMinimal } from "./generate";
import { verifier } from "./verify";
import type { FetchImpl } from "./checks";
import type { PropositionGeneree } from "./schema";
import {
  chargerAVerifier,
  chargerPropositions,
  enregistrerAVerifier,
  enregistrerPropositions,
  type EntreeAVerifier,
} from "./depot";

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

export function genererIdProposition(slug: string, themeId: string, index: number): string {
  return `${slug}-${themeId}-${String(index).padStart(3, "0")}`;
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
  let indexSuivant = propositionsExistantes.length + 1;

  for (const proposition of generees) {
    const verdict = verdicts.get(proposition.titre);
    if (verdict?.statut === "PASS") {
      fusionnees.push({
        ...proposition,
        id: genererIdProposition(meta.slug, combinaison.themeId, indexSuivant),
        candidat: meta.slug,
        theme: combinaison.themeId,
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
  const existantes = chargerPropositions(meta.slug, options.racine).filter((p) => p.theme === themeId);
  const titresExistants = existantes.map((p) => p.titre);
  const fraiches = await genererPropositions(client, meta, themeId, themeLibelle, titresExistants);

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
