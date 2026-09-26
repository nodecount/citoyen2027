import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { ecrireCandidats, mettreAJourStatutsThemes } from "./ecriture";
import { URL_API_IFRAP, convertirIfrap, type DonneesIfrap } from "./ifrap";

// Usage : npm run scrape:ifrap [-- --depuis-cache]
// Une seule requête publique (l'API du comparateur, autorisée par le robots.txt du site) ; la réponse brute est gardée
// dans cache/scrape/ (hors dépôt) pour pouvoir reconvertir sans re-télécharger. Aucun appel à un modèle, aucun coût.

const RACINE_BASE = resolve(process.cwd(), "data/bases/agregateurs");
const CACHE = resolve(process.cwd(), "cache/scrape/ifrap.json");
const IDENTIFICATION = "citoyen2027-simulateur (projet non commercial ; contact : voir le dépôt du projet)";

async function recuperer(depuisCache: boolean): Promise<DonneesIfrap> {
  if (depuisCache) {
    if (!existsSync(CACHE)) throw new Error(`Pas de cache (${CACHE}) : lancer sans --depuis-cache.`);
    console.log(`[cache] lecture de ${CACHE}`);
    return JSON.parse(readFileSync(CACHE, "utf-8")) as DonneesIfrap;
  }
  console.log(`[requête] ${URL_API_IFRAP}`);
  const reponse = await fetch(URL_API_IFRAP, { headers: { "User-Agent": IDENTIFICATION, Accept: "application/json" } });
  if (!reponse.ok) throw new Error(`La source répond ${reponse.status} ${reponse.statusText}`);
  const brut = await reponse.text();
  const donnees = JSON.parse(brut) as DonneesIfrap;
  if (!Array.isArray(donnees.candidates) || !Array.isArray(donnees.content)) throw new Error("Réponse inattendue : la structure de la source a changé, la conversion est à revoir.");
  mkdirSync(dirname(CACHE), { recursive: true });
  writeFileSync(CACHE, brut);
  return donnees;
}

async function main(): Promise<void> {
  const donnees = await recuperer(process.argv.includes("--depuis-cache"));
  const date = new Date().toISOString().slice(0, 10);
  const { candidats, rapport } = convertirIfrap(donnees, date);
  ecrireCandidats(RACINE_BASE, candidats);
  mettreAJourStatutsThemes(RACINE_BASE, candidats);

  console.log(`[terminé] ${rapport.candidats} candidats, ${rapport.propositions} propositions écrites dans ${RACINE_BASE}`);
  for (const c of rapport.parCandidat) console.log(`   ${c.nom.padEnd(24)} ${String(c.propositions).padStart(4)} propositions sur ${c.themes} thème(s)`);
  if (rapport.sansProposition.length > 0) console.log(`[info] sans aucune proposition dans la source : ${rapport.sansProposition.join(", ")}`);
  if (rapport.avecAncienTexte > 0) console.log(`[info] ${rapport.avecAncienTexte} proposition(s) portent un « ancien texte » ignoré par la conversion.`);
}

main().catch((erreur) => {
  console.error(`[erreur] ${erreur instanceof Error ? erreur.message : String(erreur)}`);
  process.exitCode = 1;
});
