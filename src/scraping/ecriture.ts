import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { Theme } from "../types";
import type { CandidatConverti } from "./ifrap";

function ecrireJson(chemin: string, valeur: unknown): void {
  mkdirSync(dirname(chemin), { recursive: true });
  writeFileSync(chemin, JSON.stringify(valeur, null, 2) + "\n");
}

// Écrit meta.json et propositions.json de chaque candidat dans <racineBase>/programmes/<slug>/ : la même structure
// que la base officielle, donc lue sans code supplémentaire par le moteur et l'interface. Remplace les deux fichiers
// (jamais de cumul) ; les autres fichiers du dossier ne sont pas touchés.
export function ecrireCandidats(racineBase: string, candidats: CandidatConverti[]): void {
  for (const { meta, propositions } of candidats) {
    const dossier = resolve(racineBase, "programmes", meta.slug);
    ecrireJson(resolve(dossier, "meta.json"), meta);
    ecrireJson(resolve(dossier, "propositions.json"), propositions);
  }
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
