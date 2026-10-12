import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { Proposition, Theme } from "../types";
import type { CandidatConverti } from "./ifrap";

function ecrireJson(chemin: string, valeur: unknown): void {
  mkdirSync(dirname(chemin), { recursive: true });
  writeFileSync(chemin, JSON.stringify(valeur, null, 2) + "\n");
}

function lireJson<T>(chemin: string, parDefaut: T): T {
  return existsSync(chemin) ? (JSON.parse(readFileSync(chemin, "utf-8")) as T) : parDefaut;
}

export function dossierCandidat(racineBase: string, slug: string): string {
  return resolve(racineBase, "programmes", slug);
}

export function chargerPropositionsCandidat(racineBase: string, slug: string): Proposition[] {
  return lireJson<Proposition[]>(resolve(dossierCandidat(racineBase, slug), "propositions.json"), []);
}

export function ecrirePropositionsCandidat(racineBase: string, slug: string, propositions: Proposition[]): void {
  ecrireJson(resolve(dossierCandidat(racineBase, slug), "propositions.json"), propositions);
}

// Une nouvelle collecte remplace les propositions, mais garde les `effets` déjà structurés d'une proposition dont le
// texte n'a pas changé (même identifiant, même texte) : la structuration est payante en temps d'abonnement, on ne la
// refait que pour ce qui a changé.
export function conserverEffets(nouvelles: Proposition[], anciennes: Proposition[]): Proposition[] {
  const parId = new Map(anciennes.map((p) => [p.id, p]));
  return nouvelles.map((p) => {
    const ancienne = parId.get(p.id);
    return ancienne?.effets !== undefined && ancienne.resume_factuel === p.resume_factuel ? { ...p, effets: ancienne.effets } : p;
  });
}

// Écrit meta.json et propositions.json de chaque candidat dans <racineBase>/programmes/<slug>/ : la même structure
// que la base officielle, donc lue sans code supplémentaire par le moteur et l'interface. Remplace les deux fichiers
// (jamais de cumul) ; les autres fichiers du dossier ne sont pas touchés.
// Parti affiché : celui de la base « officielle » quand le candidat y figure (nom complet et à jour, ex. « Renaissance » et non
// « LREM »), sinon celui de la source. Un comparateur peut garder un ancien nom de parti ou laisser le champ vide.
export function partiDeReference(racineBase: string, slug: string): string | null {
  const chemin = resolve(racineBase, "..", "officielle", "programmes", slug, "meta.json");
  if (!existsSync(chemin)) return null;
  const parti = (JSON.parse(readFileSync(chemin, "utf-8")) as { parti?: unknown }).parti;
  return typeof parti === "string" && parti.trim() !== "" ? parti : null;
}

export function ecrireCandidats(racineBase: string, candidats: CandidatConverti[]): void {
  for (const { meta: metaSource, propositions } of candidats) {
    const meta = { ...metaSource, parti: partiDeReference(racineBase, metaSource.slug) ?? metaSource.parti };
    const dossier = dossierCandidat(racineBase, meta.slug);
    ecrireJson(resolve(dossier, "meta.json"), meta);
    ecrirePropositionsCandidat(racineBase, meta.slug, conserverEffets(propositions, chargerPropositionsCandidat(racineBase, meta.slug)));
  }
}

// Objectif « iso avec la source » (décision du 2026-10-12) : un candidat que la source ne liste plus est retiré de la base, avec ses
// propositions, ses effets et ses étiquettes (l'historique reste dans git). Renvoie les slugs retirés.
export function retirerAbsents(racineBase: string, slugsSource: string[]): string[] {
  const dossier = resolve(racineBase, "programmes");
  if (!existsSync(dossier)) return [];
  const gardes = new Set(slugsSource);
  const retires = readdirSync(dossier, { withFileTypes: true }).filter((d) => d.isDirectory() && !gardes.has(d.name)).map((d) => d.name);
  for (const slug of retires) rmSync(resolve(dossier, slug), { recursive: true, force: true });
  return retires.sort();
}

// Journal de structuration d'un candidat : une entrée par groupe (thème × tranche de propositions), avec l'empreinte
// des textes et des prompts, pour savoir ce qui est à jour et pourquoi une proposition n'a pas d'effet.
export interface EntreeJournalStructuration {
  theme: string;
  groupe: number;
  empreinte: string;
  date: string;
  modele: string;
  propositions: number;
  avec_effets: number;
  sans_effet: number;
  rejetees: Array<{ id: string; raison: string }>;
  cout_reference_usd: number;
  appels: number;
}

export function chargerJournalStructuration(racineBase: string, slug: string): EntreeJournalStructuration[] {
  return lireJson<EntreeJournalStructuration[]>(resolve(dossierCandidat(racineBase, slug), "_structuration.json"), []);
}

export function enregistrerJournalStructuration(racineBase: string, slug: string, entree: EntreeJournalStructuration): void {
  const autres = chargerJournalStructuration(racineBase, slug).filter((e) => !(e.theme === entree.theme && e.groupe === entree.groupe));
  const toutes = [...autres, entree].sort((a, b) => a.theme.localeCompare(b.theme) || a.groupe - b.groupe);
  ecrireJson(resolve(dossierCandidat(racineBase, slug), "_structuration.json"), toutes);
}

// Un thème est « populated » quand au moins un candidat a une proposition dessus, « provisoire » sinon.
export function mettreAJourStatutsThemes(racineBase: string, candidats: CandidatConverti[]): void {
  const chemin = resolve(racineBase, "themes.json");
  if (!existsSync(chemin)) throw new Error(`Référentiel de thèmes introuvable : ${chemin}`);
  const themes = JSON.parse(readFileSync(chemin, "utf-8")) as Theme[];
  const couverts = new Set(candidats.flatMap((c) => c.propositions.map((p) => p.theme)));
  const inconnus = [...couverts].filter((id) => !themes.some((t) => t.id === id));
  if (inconnus.length > 0) throw new Error(`Thème(s) absent(s) de ${chemin} : ${inconnus.join(", ")}`);
  ecrireJson(
    chemin,
    themes.map((t) => ({ ...t, statut: couverts.has(t.id) ? "populated" : "provisoire" })),
  );
}
