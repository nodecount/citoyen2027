import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { CandidatMeta, Proposition, Theme } from "../types";
import { appelerClaudeCli, MODELE_CLI } from "./claude-cli";
import { chargerPropositionsCandidat, conserverEffets, dossierCandidat, ecrirePropositionsCandidat } from "./ecriture";
import { nomFichierTexte } from "./structuration-textes";
import { trouverTexteAN, trouverTexteSenat } from "./textes-lois";
import { classerScrutins, convertirVotes, restreindreAuxCandidats, retenirScrutins, type ScrutinSource, type TexteLoi } from "./votes2027etmoi";

// Usage : npm run scrape:2027etmoi [-- --candidats=melenchon,le-pen --depuis-cache]
// Base « 2027etmoi » : les votes nominatifs des candidats à l'Assemblée nationale et au Sénat (jeu de données 2027etmoi, Licence
// Ouverte 2.0). Étapes : lire votes.json et candidats.json, garder les scrutins qui portent sur un texte, choisir un thème de la
// base pour chacun (modèle via `claude -p`, abonnement ; réponse gardée dans _themes-scrutins.json), retrouver le texte de la loi
// sur le site officiel, écrire une proposition par candidat et par vote pour ou contre. Les effets viennent ensuite :
// `npm run scrape:structurer -- --base=2027etmoi`. Les pages téléchargées sont gardées dans cache/ (hors dépôt), à raison d'une
// requête par seconde au plus.

const RACINE = process.cwd();
const BASE = resolve(RACINE, "data/bases/2027etmoi");
const CACHE = resolve(RACINE, "cache/scrape/2027etmoi");
const DOSSIER_TEXTES = resolve(CACHE, "textes");
const URL_VOTES ="https://2027etmoi.fr/data/votes.json";
const URL_CANDIDATS = "https://2027etmoi.fr/data/candidats.json";
const URL_JEU_VOTES = "https://www.data.gouv.fr/datasets/votes-au-parlement-des-candidats-a-lelection-presidentielle-2027";
const IDENTIFICATION = "citoyen2027-simulateur (projet non commercial ; contact : voir le dépôt du projet)";
const PAUSE_MS = 1000;
const JOURNAL_THEMES = resolve(BASE, "_themes-scrutins.json");

function valeur(nom: string): string | undefined {
  return process.argv.find((a) => a.startsWith(`--${nom}=`))?.slice(nom.length + 3);
}

let derniereRequete = 0;
async function telecharger(url: string): Promise<string> {
  const fichier = resolve(CACHE, "pages", `${createHash("sha1").update(url).digest("hex")}.html`);
  if (existsSync(fichier)) return readFileSync(fichier, "utf-8");
  const attente = derniereRequete + PAUSE_MS - Date.now();
  if (attente > 0) await new Promise((fini) => setTimeout(fini, attente));
  derniereRequete = Date.now();
  console.log(`[requête] ${url}`);
  const reponse = await fetch(url, { headers: { "User-Agent": IDENTIFICATION } });
  if (!reponse.ok) throw new Error(`${url} répond ${reponse.status}`);
  const corps = await reponse.text();
  mkdirSync(dirname(fichier), { recursive: true });
  writeFileSync(fichier, corps);
  return corps;
}

async function lireJeu<T>(url: string, nom: string, depuisCache: boolean): Promise<T> {
  const fichier = resolve(CACHE, nom);
  if (depuisCache) {
    if (!existsSync(fichier)) throw new Error(`Pas de cache (${fichier}) : lancer sans --depuis-cache.`);
    return JSON.parse(readFileSync(fichier, "utf-8")) as T;
  }
  console.log(`[requête] ${url}`);
  const reponse = await fetch(url, { headers: { "User-Agent": IDENTIFICATION, Accept: "application/json" } });
  if (!reponse.ok) throw new Error(`${url} répond ${reponse.status}`);
  const brut = await reponse.text();
  const donnees = JSON.parse(brut) as T;
  mkdirSync(dirname(fichier), { recursive: true });
  writeFileSync(fichier, brut);
  return donnees;
}

function lireJson<T>(chemin: string, parDefaut: T): T {
  return existsSync(chemin) ? (JSON.parse(readFileSync(chemin, "utf-8")) as T) : parDefaut;
}

const SYSTEME_THEMES = "Tu classes des scrutins parlementaires français par thème de la vie des citoyens. Tu ne réponds que par l'objet demandé.";
const SCHEMA_THEMES = {
  type: "object",
  properties: {
    classement: {
      type: "array",
      items: { type: "object", properties: { id: { type: "string" }, theme: { type: "string" } }, required: ["id", "theme"] },
    },
  },
  required: ["classement"],
};

async function main(): Promise<void> {
  const depuisCache = process.argv.includes("--depuis-cache");
  const slugs = valeur("candidats")?.split(",").filter(Boolean);
  const votes = await lireJeu<{ scrutins: ScrutinSource[] }>(URL_VOTES, "votes.json", depuisCache);
  const candidats = await lireJeu<{ candidats: Array<{ id: string; nom: string; parti: string }> }>(URL_CANDIDATS, "candidats.json", depuisCache);
  if (!Array.isArray(votes.scrutins) || !Array.isArray(candidats.candidats)) throw new Error("Réponse inattendue : la structure du jeu 2027etmoi a changé, la conversion est à revoir.");

  const retenus = restreindreAuxCandidats(retenirScrutins(votes.scrutins), slugs);
  console.log(`[sélection] ${retenus.length} scrutin(s) retenu(s) sur ${votes.scrutins.length}${slugs ? ` (candidats : ${slugs.join(", ")})` : ""}`);

  // Thème de chaque scrutin : choisi une fois par le modèle, gardé et rejouable (supprimer le fichier pour reclasser).
  const themes = lireJson<Theme[]>(resolve(BASE, "themes.json"), []);
  const journal = lireJson<Record<string, string>>(JOURNAL_THEMES, {});
  const aClasser = retenus.filter((s) => journal[s.id] === undefined);
  if (aClasser.length > 0) {
    console.log(`[thèmes] ${aClasser.length} scrutin(s) à classer (modèle ${MODELE_CLI}, abonnement)`);
    const appeler = async (prompt: string): Promise<Record<string, string>> => {
      const sortie = await appelerClaudeCli(prompt, SYSTEME_THEMES, SCHEMA_THEMES, { effort: "low" });
      const liste = (sortie.structure as { classement?: Array<{ id: string; theme: string }> }).classement ?? [];
      return Object.fromEntries(liste.map((x) => [x.id, x.theme]));
    };
    const carte = await classerScrutins(aClasser, themes, appeler);
    for (const s of aClasser) journal[s.id] = carte.get(s.id) ?? "aucun";
    mkdirSync(dirname(JOURNAL_THEMES), { recursive: true });
    writeFileSync(JOURNAL_THEMES, JSON.stringify(journal, null, 2) + "\n");
  }
  const themeParScrutin = new Map(retenus.filter((s) => journal[s.id] !== undefined && journal[s.id] !== "aucun").map((s) => [s.id, journal[s.id]]));
  const classes = retenus.filter((s) => themeParScrutin.has(s.id));
  console.log(`[thèmes] ${classes.length} scrutin(s) rattaché(s) à un thème, ${retenus.length - classes.length} écarté(s) (aucun thème)`);

  // Texte de la loi, une fois par scrutin (les pages sont en cache).
  const textes = new Map<string, TexteLoi | null>();
  for (const s of classes) textes.set(s.id, s.chambre === "AN" ? await trouverTexteAN(s, telecharger) : await trouverTexteSenat(s, telecharger));
  const retrouves = [...textes.values()].filter((t) => t !== null).length;
  // Texte COMPLET de chaque loi, gardé hors dépôt pour `scrape:structurer-textes` (la mesure, elle, n'en affiche que le début).
  mkdirSync(DOSSIER_TEXTES, { recursive: true });
  for (const s of classes) {
    const t = textes.get(s.id);
    if (t) writeFileSync(resolve(DOSSIER_TEXTES, nomFichierTexte(s.url)), t.texte);
  }

  const date = new Date().toISOString().slice(0, 10);
  const noms = Object.fromEntries(candidats.candidats.map((c) => [c.id, c.nom]));
  const { parCandidat, rapport } = convertirVotes(classes, themeParScrutin, textes, noms, date);

  const racineProgrammes = BASE;
  const concernes = slugs ?? [...new Set([...parCandidat.keys(), ...candidats.candidats.map((c) => c.id)])];
  for (const slug of concernes) {
    const propositions: Proposition[] = parCandidat.get(slug) ?? [];
    if (propositions.length === 0) {
      // Un candidat sans vote retenu n'a pas de dossier (il n'apparaît dans aucun thème).
      if (existsSync(dossierCandidat(racineProgrammes, slug))) rmSync(dossierCandidat(racineProgrammes, slug), { recursive: true, force: true });
      continue;
    }
    const source = candidats.candidats.find((c) => c.id === slug)!;
    const meta: CandidatMeta = {
      slug,
      nom: source.nom,
      parti: source.parti,
      sources_officielles: [
        { type: "primaire", label: "Assemblée nationale et Sénat — scrutins publics et textes adoptés", url: "https://data.assemblee-nationale.fr/travaux-parlementaires/votes", nom: "Parlement", annee: Number(date.slice(0, 4)) },
        { type: "secondaire", label: "2027etmoi — votes au Parlement des candidats à l'élection présidentielle 2027 (Licence Ouverte 2.0)", url: URL_JEU_VOTES, nom: "2027etmoi", annee: Number(date.slice(0, 4)) },
      ],
      date_derniere_maj: date,
    };
    const dossier = dossierCandidat(racineProgrammes, slug);
    mkdirSync(dossier, { recursive: true });
    writeFileSync(resolve(dossier, "meta.json"), JSON.stringify(meta, null, 2) + "\n");
    ecrirePropositionsCandidat(racineProgrammes, slug, conserverEffets(propositions, chargerPropositionsCandidat(racineProgrammes, slug)));
  }

  console.log(`[terminé] ${rapport.propositions} proposition(s) pour ${parCandidat.size} candidat(s) ; texte retrouvé pour ${retrouves}/${classes.length} scrutin(s), ${rapport.sansTexte} proposition(s) sans texte ; ${rapport.ignores} vote(s) ignoré(s) (abstention, absence, non-votant)`);
  for (const [slug, propositions] of [...parCandidat.entries()].sort()) {
    const pour = propositions.filter((p) => p.vote === "pour").length;
    console.log(`   ${slug.padEnd(14)} ${String(propositions.length).padStart(3)} proposition(s) : ${pour} pour, ${propositions.length - pour} contre`);
  }
  if (slugs) for (const slug of slugs) if (!parCandidat.has(slug)) console.log(`   ${slug.padEnd(14)} aucun vote retenu : pas de dossier`);
}

main().catch((erreur) => {
  console.error(`[erreur] ${erreur instanceof Error ? erreur.message : String(erreur)}`);
  process.exitCode = 1;
});
