import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { gunzipSync } from "node:zlib";
import { ecrirePropositionsCandidat } from "../scraping/ecriture";
import { convertir, type ArticleVote } from "./conversion";
import { PARTIS_GROUPES, type DecompteGroupe } from "./groupes";
import { LOIS } from "./lois";
import { articleDuScrutin, decouperArticles, htmlEnTexte } from "./texte";

// Usage : npm run scrape:votes [-- --depuis-cache]
// Base « votes » (lot test de recherche, 2026-10-18) : articles clés (articles ayant eu un scrutin public) de 15 lois de la XVIIe
// législature. Sources : scrutins et votes par député de NosParlementaires (Licence Ouverte 2.0), dossiers législatifs et textes
// adoptés de l'Assemblée nationale (source primaire). Aucun appel à un modèle ici : la structuration des effets est l'étape
// suivante (`npm run scrape:structurer -- --base=votes`). Les fichiers volumineux sont gardés dans cache/ (hors dépôt).

const RACINE = process.cwd();
const BASE = resolve(RACINE, "data/bases/votes");
const CACHE_NP = resolve(RACINE, "cache/scrape/nosparlementaires");
const CACHE_AN = resolve(RACINE, "cache/scrape/assemblee-dossiers");
const CACHE_TEXTES = resolve(RACINE, "cache/scrape/assemblee-textes");
const IDENTIFICATION = "citoyen2027-simulateur (projet non commercial ; contact : voir le dépôt du projet)";
const URL_NP = "https://nosparlementaires.fr/opendata/";
const URL_DOSSIERS = "https://data.assemblee-nationale.fr/static/openData/repository/17/loi/dossiers_legislatifs/Dossiers_Legislatifs.json.zip";

async function telecharger(url: string, destination: string): Promise<void> {
  if (existsSync(destination)) return;
  console.log(`[requête] ${url}`);
  const r = await fetch(url, { headers: { "User-Agent": IDENTIFICATION } });
  if (!r.ok) throw new Error(`${url} répond ${r.status}`);
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, Buffer.from(await r.arrayBuffer()));
}

interface Scrutin { id: string; date: string; title: string; dossier_ref: string; pour: number; contre: number; abstention: number }

function lireDeputes(): Map<string, string> {
  const groupes = new Map<string, string>();
  for (const ligne of readFileSync(resolve(CACHE_NP, "deputes.csv"), "utf-8").split(/\r?\n/).slice(1)) {
    const c = ligne.split(",");
    if (c[0]) groupes.set(c[0], c[4] || "(sans groupe)");
  }
  return groupes;
}

function lireDecomptes(ids: Set<string>, groupes: Map<string, string>): Map<string, Record<string, DecompteGroupe>> {
  const res = new Map<string, Record<string, DecompteGroupe>>();
  for (const ligne of gunzipSync(readFileSync(resolve(CACHE_NP, "votes_an.csv.gz"))).toString("utf-8").split(/\r?\n/)) {
    const [sid, slug, position] = ligne.split(",");
    if (!ids.has(sid)) continue;
    const parGroupe = res.get(sid) ?? {};
    const g = groupes.get(slug) ?? "(inconnu)";
    const d = (parGroupe[g] ??= { POUR: 0, CONTRE: 0, ABSTENTION: 0, NONVOTANT: 0 });
    if (position === "POUR" || position === "CONTRE" || position === "ABSTENTION" || position === "NONVOTANT") d[position] = (d[position] ?? 0) + 1;
    res.set(sid, parGroupe);
  }
  return res;
}

interface TexteAdopte { id: string; date: string }

function textesAdoptes(dossier: string): TexteAdopte[] {
  const brut = JSON.parse(readFileSync(resolve(CACHE_AN, "x/json/dossierParlementaire", `${dossier}.json`), "utf-8"));
  const ids = new Set<string>();
  JSON.stringify(brut, (_k, v) => {
    if (typeof v === "string" && /^(PIONANR|PRJLANR)5L17BTA\d+$/.test(v)) ids.add(v);
    return v;
  });
  return [...ids]
    .map((id) => {
      const doc = JSON.parse(readFileSync(resolve(CACHE_AN, "x/json/document", `${id}.json`), "utf-8")).document;
      return { id, date: String(doc?.cycleDeVie?.chrono?.dateCreation ?? "") };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

async function articlesDuTexte(id: string): Promise<Map<string, string>> {
  const chemin = resolve(CACHE_TEXTES, `${id}.html`);
  await telecharger(`https://www.assemblee-nationale.fr/dyn/opendata/${id}.html`, chemin);
  return decouperArticles(htmlEnTexte(readFileSync(chemin, "utf-8")));
}

const numeroTexte = (id: string) => id.replace(/^.*TA0*/, "");
const urlTexte = (id: string) => `https://www.assemblee-nationale.fr/dyn/17/textes/l17t${id.replace(/^.*TA/, "")}_texte-adopte-seance`;

async function main(): Promise<void> {
  await telecharger(`${URL_NP}scrutins_an.json`, resolve(CACHE_NP, "scrutins_an.json"));
  await telecharger(`${URL_NP}deputes.csv`, resolve(CACHE_NP, "deputes.csv"));
  await telecharger(`${URL_NP}votes_an.csv.gz`, resolve(CACHE_NP, "votes_an.csv.gz"));
  if (!existsSync(resolve(CACHE_AN, "x/json/dossierParlementaire"))) {
    throw new Error(`Dossiers législatifs absents : télécharger ${URL_DOSSIERS} puis le décompresser dans ${CACHE_AN}/x (voir docs/recherche-sources-programmes-iFRAP-votes.md).`);
  }

  const scrutins: Scrutin[] = JSON.parse(readFileSync(resolve(CACHE_NP, "scrutins_an.json"), "utf-8"));
  const parLoi = new Map(LOIS.map((l) => [l.dossier, l]));
  const scrutinsArticles = scrutins.filter((s) => parLoi.has(s.dossier_ref) && articleDuScrutin(s.title) !== null);
  const decomptes = lireDecomptes(new Set(scrutinsArticles.map((s) => s.id)), lireDeputes());

  const entrees: ArticleVote[] = [];
  const introuvables: string[] = [];
  const cacheArticles = new Map<string, Map<string, string>>();
  for (const loi of LOIS) {
    const textes = textesAdoptes(loi.dossier);
    for (const s of scrutinsArticles.filter((x) => x.dossier_ref === loi.dossier).sort((a, b) => a.date.localeCompare(b.date))) {
      const article = articleDuScrutin(s.title)!;
      // Texte adopté à l'issue de la lecture où l'article a été voté : le premier texte adopté postérieur au scrutin.
      const candidats = textes.filter((t) => t.date.slice(0, 10) >= s.date.slice(0, 10));
      let trouve = false;
      for (const t of candidats) {
        if (!cacheArticles.has(t.id)) cacheArticles.set(t.id, await articlesDuTexte(t.id));
        const texte = cacheArticles.get(t.id)!.get(article);
        if (texte && texte.length >= 20) {
          entrees.push({ loi, scrutin: s, article, texteArticle: texte, urlTexte: urlTexte(t.id), numeroTexte: `T.A. n° ${numeroTexte(t.id)}`, decomptes: decomptes.get(s.id) ?? {} });
          trouve = true;
          break;
        }
      }
      if (!trouve) introuvables.push(`${loi.dossier} article ${article} (${s.id})`);
    }
  }

  const date = new Date().toISOString().slice(0, 10);
  const { parCandidat, rapport } = convertir(entrees, date);
  rmSync(resolve(BASE, "programmes"), { recursive: true, force: true });
  const nomsAgregateurs = (slug: string): string => {
    const f = resolve(RACINE, "data/bases/agregateurs/programmes", slug, "meta.json");
    return existsSync(f) ? (JSON.parse(readFileSync(f, "utf-8")) as { nom: string }).nom : slug;
  };
  for (const partie of PARTIS_GROUPES) {
    const dossier = resolve(BASE, "programmes", partie.candidat);
    mkdirSync(dossier, { recursive: true });
    const meta = {
      slug: partie.candidat,
      nom: nomsAgregateurs(partie.candidat),
      parti: partie.parti,
      sources_officielles: [
        { type: "primaire", label: "Assemblée nationale — scrutins publics et textes adoptés, XVIIe législature", url: "https://data.assemblee-nationale.fr/travaux-parlementaires/votes", nom: "Assemblée nationale", annee: 2026 },
        { type: "secondaire", label: "NosParlementaires — votes par député (Licence Ouverte 2.0)", url: "https://nosparlementaires.fr/donnees-ouvertes", nom: "NosParlementaires", annee: 2026 },
      ],
      date_derniere_maj: date,
    };
    writeFileSync(resolve(dossier, "meta.json"), JSON.stringify(meta, null, 2) + "\n");
    ecrirePropositionsCandidat(BASE, partie.candidat, parCandidat.get(partie.candidat) ?? []);
  }

  console.log(`[terminé] ${scrutinsArticles.length} scrutins d'article sur ${LOIS.length} lois, ${entrees.length} avec texte retrouvé, ${introuvables.length} introuvable(s), ${rapport.mesures} mesure(s) écrites`);
  for (const p of PARTIS_GROUPES) {
    const c = rapport.parGroupe[p.groupe];
    console.log(`   ${p.groupe.padEnd(8)} ${p.candidat.padEnd(11)} pour ${String(c?.pour ?? 0).padStart(3)} · contre ${String(c?.contre ?? 0).padStart(3)} · partagé ${String(c?.partage ?? 0).padStart(3)} · insuffisant ${String(c?.insuffisant ?? 0).padStart(3)}`);
  }
  console.log(`[info] groupes non rattachés (aucune mesure) :`, rapport.groupesNonRattaches);
  if (introuvables.length > 0) console.log(`[info] articles dont le texte n'a pas été retrouvé :\n   ${introuvables.slice(0, 40).join("\n   ")}`);
}

main().catch((erreur) => {
  console.error(`[erreur] ${erreur instanceof Error ? erreur.message : String(erreur)}`);
  process.exitCode = 1;
});
