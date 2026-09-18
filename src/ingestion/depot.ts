import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { CandidatMeta, Proposition } from "../types";
import type { PropositionGeneree } from "./schema";

const RACINE_PAR_DEFAUT = resolve(process.cwd(), "data/programmes");

export function cheminPropositions(slug: string, racine: string = RACINE_PAR_DEFAUT): string {
  return resolve(racine, slug, "propositions.json");
}

export function cheminMeta(slug: string, racine: string = RACINE_PAR_DEFAUT): string {
  return resolve(racine, slug, "meta.json");
}

export function cheminAVerifier(slug: string, racine: string = RACINE_PAR_DEFAUT): string {
  return resolve(racine, slug, "_a-verifier.json");
}

export function chargerMeta(slug: string, racine: string = RACINE_PAR_DEFAUT): CandidatMeta {
  return JSON.parse(readFileSync(cheminMeta(slug, racine), "utf-8")) as CandidatMeta;
}

export function chargerPropositions(slug: string, racine: string = RACINE_PAR_DEFAUT): Proposition[] {
  const chemin = cheminPropositions(slug, racine);
  if (!existsSync(chemin)) return [];
  return JSON.parse(readFileSync(chemin, "utf-8")) as Proposition[];
}

export function enregistrerPropositions(slug: string, propositions: Proposition[], racine: string = RACINE_PAR_DEFAUT): void {
  const chemin = cheminPropositions(slug, racine);
  mkdirSync(dirname(chemin), { recursive: true });
  writeFileSync(chemin, JSON.stringify(propositions, null, 2) + "\n");
}

export interface EntreeAVerifier {
  theme: string;
  proposition: PropositionGeneree;
  raison: string;
}

export function chargerAVerifier(slug: string, racine: string = RACINE_PAR_DEFAUT): EntreeAVerifier[] {
  const chemin = cheminAVerifier(slug, racine);
  if (!existsSync(chemin)) return [];
  return JSON.parse(readFileSync(chemin, "utf-8")) as EntreeAVerifier[];
}

export function enregistrerAVerifier(slug: string, entrees: EntreeAVerifier[], racine: string = RACINE_PAR_DEFAUT): void {
  const chemin = cheminAVerifier(slug, racine);
  mkdirSync(dirname(chemin), { recursive: true });
  writeFileSync(chemin, JSON.stringify(entrees, null, 2) + "\n");
}

export function combinaisonDejaCouverte(propositions: Proposition[], themeId: string): boolean {
  return propositions.some((p) => p.theme === themeId);
}
