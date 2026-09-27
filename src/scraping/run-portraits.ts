import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

// Usage : npm run portraits [-- --candidats=a,b]
// Portraits des candidats : image principale (P18) de leur fiche Wikidata, hébergée sur Wikimedia Commons. Même règle
// pour tous (aucun choix de photo au cas par cas). Seules les licences libres sont retenues ; chaque photo est
// créditée (auteur, licence, lien) dans data/portraits.json, affiché sur le site. Les fichiers sont copiés dans
// static/candidats/ : le site ne fait aucune requête vers Wikimedia au moment de la visite.
// data/portraits-sources.json permet, par candidat, d'imposer l'élément Wikidata (homonymes) ou le nom de l'auteur
// quand la notice Commons est illisible : { "slug": { "wikidata": "Q…", "auteur": "…" } }.

const RACINE = process.cwd();
const DOSSIER_PHOTOS = resolve(RACINE, "static/candidats");
const MANIFESTE = resolve(RACINE, "data/portraits.json");
const SOURCES = resolve(RACINE, "data/portraits-sources.json");
const AGENT = "citoyen2027-simulateur/0.1 (outil citoyen non commercial, independant des partis)";
const LICENCES_LIBRES = /^(CC BY(-SA)? [\d.]+|CC0|Public domain|PD)/i;
// Entrées de comparateurs qui ne sont pas des personnes.
const PAS_UNE_PERSONNE = new Set(["parti-socialiste"]);

export interface PortraitCandidat {
  fichier: string;
  wikidata: string;
  auteur: string;
  licence: string;
  licence_url: string;
  source_url: string;
}

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Wikimedia limite le débit : une requête à la fois, une pause entre deux, et une reprise sur 429 selon Retry-After.
async function obtenir(url: string, accept: string): Promise<Response> {
  for (let essai = 1; ; essai += 1) {
    await pause(1200);
    const reponse = await fetch(url, { headers: { "User-Agent": AGENT, Accept: accept } });
    if (reponse.status !== 429 || essai >= 5) return reponse;
    const attente = Number(reponse.headers.get("retry-after")) || 10 * essai;
    console.log(`[attente] débit limité par Wikimedia, reprise dans ${attente} s`);
    await pause(attente * 1000);
  }
}

async function json<T>(url: string): Promise<T> {
  const reponse = await obtenir(url, "application/json");
  if (!reponse.ok) throw new Error(`${reponse.status} sur ${url}`);
  return (await reponse.json()) as T;
}

function sansBalises(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function candidats(filtre?: string[]): Array<{ slug: string; nom: string }> {
  const vus = new Map<string, string>();
  for (const base of readdirSync(resolve(RACINE, "data/bases"), { withFileTypes: true }).filter((d) => d.isDirectory())) {
    const dossier = resolve(RACINE, "data/bases", base.name, "programmes");
    if (!existsSync(dossier)) continue;
    for (const slug of readdirSync(dossier)) {
      const meta = resolve(dossier, slug, "meta.json");
      if (existsSync(meta) && !vus.has(slug)) vus.set(slug, (JSON.parse(readFileSync(meta, "utf-8")) as { nom: string }).nom);
    }
  }
  return [...vus]
    .filter(([slug]) => !PAS_UNE_PERSONNE.has(slug) && (!filtre || filtre.includes(slug)))
    .map(([slug, nom]) => ({ slug, nom }))
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

async function trouverElement(nom: string): Promise<{ id: string; description: string } | null> {
  const url = `https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&language=fr&uselang=fr&type=item&limit=7&search=${encodeURIComponent(nom)}`;
  const r = await json<{ search: Array<{ id: string; description?: string }> }>(url);
  const trouve = r.search.find((e) => /politi|d'État|ministre|député|sénat|président|maire/i.test(e.description ?? ""));
  return trouve ? { id: trouve.id, description: trouve.description ?? "" } : null;
}

async function imagePrincipale(qid: string): Promise<string | null> {
  const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=claims&ids=${qid}`;
  const r = await json<{ entities: Record<string, { claims?: Record<string, Array<{ mainsnak: { datavalue?: { value: string } } }>> }> }>(url);
  return r.entities[qid]?.claims?.P18?.[0]?.mainsnak.datavalue?.value ?? null;
}

async function infosCommons(fichier: string) {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=320&titles=${encodeURIComponent(`File:${fichier}`)}`;
  const r = await json<{ query: { pages: Record<string, { imageinfo?: Array<{ thumburl: string; descriptionurl: string; extmetadata: Record<string, { value: string }> }> }> } }>(url);
  const info = Object.values(r.query.pages)[0]?.imageinfo?.[0];
  if (!info) return null;
  const m = info.extmetadata;
  return {
    vignette: info.thumburl,
    source_url: info.descriptionurl,
    auteur: sansBalises(m.Artist?.value ?? "") || "auteur non indiqué",
    licence: sansBalises(m.LicenseShortName?.value ?? ""),
    licence_url: m.LicenseUrl?.value ?? "",
  };
}

async function main(): Promise<void> {
  const filtre = process.argv.find((a) => a.startsWith("--candidats="))?.slice("--candidats=".length).split(",");
  const imposes: Record<string, { wikidata?: string; auteur?: string }> = existsSync(SOURCES) ? JSON.parse(readFileSync(SOURCES, "utf-8")) : {};
  const manifeste: Record<string, PortraitCandidat> = existsSync(MANIFESTE) ? JSON.parse(readFileSync(MANIFESTE, "utf-8")) : {};
  mkdirSync(DOSSIER_PHOTOS, { recursive: true });

  for (const { slug, nom } of candidats(filtre)) {
    try {
      const impose = imposes[slug] ?? {};
      const element = impose.wikidata ? { id: impose.wikidata, description: "(imposé dans portraits-sources.json)" } : await trouverElement(nom);
      if (!element) {
        console.log(`[absent] ${nom} : aucun élément Wikidata « politique » trouvé`);
        continue;
      }
      const fichier = await imagePrincipale(element.id);
      if (!fichier) {
        console.log(`[absent] ${nom} (${element.id}, ${element.description}) : pas d'image principale`);
        continue;
      }
      const info = await infosCommons(fichier);
      if (!info) {
        console.log(`[absent] ${nom} : fichier Commons introuvable (${fichier})`);
        continue;
      }
      if (!LICENCES_LIBRES.test(info.licence)) {
        console.log(`[refusé] ${nom} : licence non libre ou inconnue (« ${info.licence} »)`);
        continue;
      }
      const extension = (info.vignette.match(/\.(jpe?g|png|webp)(?:$|\?)/i)?.[1] ?? "jpg").toLowerCase().replace("jpeg", "jpg");
      const chemin = `candidats/${slug}.${extension}`;
      const image = await obtenir(info.vignette, "image/*");
      if (!image.ok) throw new Error(`${image.status} sur la vignette`);
      writeFileSync(resolve(RACINE, "static", chemin), Buffer.from(await image.arrayBuffer()));
      // Notice illisible (un paragraphe entier au lieu d'un nom) : on exige un auteur imposé plutôt que d'afficher n'importe quoi.
      const auteur = impose.auteur ?? (info.auteur.length <= 80 ? info.auteur : "voir la page de la photo");
      manifeste[slug] = { fichier: chemin, wikidata: element.id, auteur, licence: info.licence, licence_url: info.licence_url, source_url: info.source_url };
      console.log(`[ok] ${nom} ← ${element.id} (${element.description}) · ${info.licence} · ${info.auteur}`);
    } catch (erreur) {
      console.log(`[erreur] ${nom} : ${erreur instanceof Error ? erreur.message : String(erreur)}`);
    }
  }
  const trie = Object.fromEntries(Object.entries(manifeste).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(MANIFESTE, JSON.stringify(trie, null, 2) + "\n");
  console.log(`[terminé] ${Object.keys(trie).length} portrait(s) dans ${MANIFESTE}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
