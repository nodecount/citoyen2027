import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Theme } from "../types";
import { appelerClaudeCli, MODELE_CLI, PanneCli } from "./claude-cli";
import { chargerPropositionsCandidat, ecrirePropositionsCandidat } from "./ecriture";
import { listerCandidatsAvecPropositions } from "./orchestration";
import { appliquerAuxMesures, decrireLesTextes, nomFichierTexte, scrutinsDistincts, type JournalTextes, type TexteAStructurer } from "./structuration-textes";

// Usage : npm run scrape:structurer-textes [-- --force --concurrence=3 --plafond-ref=40 --limite=5]
// Base « 2027etmoi » : remplace `scrape:structurer` pour cette base. Chaque loi est lue UNE FOIS, en entier (passage par passage), par
// le modèle (commande `claude -p`, abonnement) ; ses effets sont gardés dans _effets-textes.json et donnés à tous les candidats qui
// l'ont votée. Rejouable : une loi dont le texte et les prompts n'ont pas changé n'est pas relue, et les effets sont toujours
// réappliqués (utile après un nouveau `scrape:2027etmoi`, qui repart du début de la loi). Les textes complets viennent de
// cache/scrape/2027etmoi/textes/, écrits par `scrape:2027etmoi`.

const RACINE = process.cwd();
const BASE = resolve(RACINE, "data/bases/2027etmoi");
const TEXTES = resolve(RACINE, "cache/scrape/2027etmoi/textes");
const JOURNAL = resolve(BASE, "_effets-textes.json");

function valeur(nom: string): string | undefined {
  return process.argv.find((a) => a.startsWith(`--${nom}=`))?.slice(nom.length + 3);
}

const fichierTexte = (urlScrutin: string) => resolve(TEXTES, nomFichierTexte(urlScrutin));

async function main(): Promise<void> {
  const themes = JSON.parse(readFileSync(resolve(BASE, "themes.json"), "utf-8")) as Theme[];
  const libelle = (id: string) => themes.find((t) => t.id === id)?.libelle ?? id;
  const slugs = listerCandidatsAvecPropositions(BASE);
  const parCandidat = new Map(slugs.map((slug) => [slug, chargerPropositionsCandidat(BASE, slug)]));
  const scrutins = scrutinsDistincts([...parCandidat.values()].flat());

  const textes: TexteAStructurer[] = [];
  let sansFichier = 0;
  for (const { url, theme } of scrutins) {
    const fichier = fichierTexte(url);
    if (existsSync(fichier)) textes.push({ url, theme, texte: readFileSync(fichier, "utf-8") });
    else sansFichier += 1;
  }
  const journal: JournalTextes = existsSync(JOURNAL) ? (JSON.parse(readFileSync(JOURNAL, "utf-8")) as JournalTextes) : {};
  console.log(`[plan] ${scrutins.length} loi(s) votée(s) par ${slugs.length} candidat(s) ; ${textes.length} texte(s) complet(s) en cache, ${sansFichier} sans texte`);

  const limite = valeur("limite") !== undefined ? Number(valeur("limite")) : undefined;
  const options = { force: process.argv.includes("--force"), concurrence: Number(valeur("concurrence") ?? 3), plafondRefUsd: Number(valeur("plafond-ref") ?? 40) };
  const aLire = textes.slice(0, limite);
  const outils = { appeler: (prompt: string, systeme: string, schema: object) => appelerClaudeCli(prompt, systeme, schema, { effort: "low" }) };
  const resultat = await decrireLesTextes(aLire, journal, libelle, outils, options, console.log);
  writeFileSync(JOURNAL, JSON.stringify(resultat.journal, null, 2) + "\n");

  for (const [slug, propositions] of parCandidat) ecrirePropositionsCandidat(BASE, slug, appliquerAuxMesures(propositions, resultat.journal));
  const total = [...parCandidat.values()].flat().length;
  const avecEffets = slugs.flatMap((slug) => chargerPropositionsCandidat(BASE, slug)).filter((p) => (p.effets ?? []).length > 0).length;
  console.log(`[terminé] ${resultat.faits} loi(s) lue(s) (${MODELE_CLI}), coût de référence ${resultat.coutReferenceUsd.toFixed(2)} $ ; ${avecEffets} mesure(s) sur ${total} avec effet`);
  for (const e of resultat.erreurs) console.log(`   [erreur] ${e.url} : ${e.message}`);
  if (resultat.arret) console.log(`[arrêt] ${resultat.messageArret} Relancer la même commande reprend là où c'est resté.`);
}

main().catch((erreur) => {
  console.error(`[erreur] ${erreur instanceof PanneCli ? "Panne : " : ""}${erreur instanceof Error ? erreur.message : String(erreur)}`);
  process.exitCode = 1;
});
