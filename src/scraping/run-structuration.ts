import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { appelerClaudeCli, MODELE_CLI, PanneCli } from "./claude-cli";
import { executer, planifier, type OptionsStructuration } from "./orchestration";

// Usage : npm run scrape:structurer [-- --base=agregateurs --candidats=a,b --themes=x,y --force --dry-run --concurrence=3 --plafond-ref=8 --limite=5]
// Décrit, avec le modèle (commande `claude -p`, abonnement et non API), les effets de chaque proposition d'une base sur un
// citoyen (« agregateurs » par défaut ; « votes » pour le lot test de recherche du 2026-10-18, dont le formulaire est une copie
// de celui d'« agregateurs »). Rejouable : un groupe dont les textes et les prompts n'ont pas changé est ignoré.

function valeur(nom: string): string | undefined {
  const argument = process.argv.find((a) => a.startsWith(`--${nom}=`));
  return argument?.slice(nom.length + 3);
}

const BASE = valeur("base") ?? "agregateurs";
const RACINE_BASE = resolve(process.cwd(), "data/bases", BASE);
const libelles = new Map((JSON.parse(readFileSync(resolve(RACINE_BASE, "themes.json"), "utf-8")) as Array<{ id: string; libelle: string }>).map((t) => [t.id, t.libelle]));

async function main(): Promise<void> {
  const options: OptionsStructuration = {
    candidats: valeur("candidats")?.split(",").filter(Boolean),
    themes: valeur("themes")?.split(",").filter(Boolean),
    force: process.argv.includes("--force"),
    concurrence: Number(valeur("concurrence") ?? 3),
    plafondRefUsd: Number(valeur("plafond-ref") ?? 8),
    limiteGroupes: valeur("limite") !== undefined ? Number(valeur("limite")) : undefined,
  };
  const plan = planifier(RACINE_BASE, options);
  const aFaire = plan.groupes.filter((g) => g.aFaire);
  const propositions = aFaire.reduce((somme, g) => somme + g.entrees.length, 0);
  const sansAppel = plan.sansAppel.reduce((somme, s) => somme + s.ids.length, 0);
  const retenus = options.limiteGroupes !== undefined ? Math.min(options.limiteGroupes, aFaire.length) : aFaire.length;

  console.log(`[plan] ${plan.groupes.length} groupe(s) candidat × thème, dont ${aFaire.length} à faire (${propositions} propositions), ${plan.groupes.length - aFaire.length} à jour`);
  console.log(`[plan] ${sansAppel} proposition(s) de thèmes sans effet possible sur un citoyen (défense, Europe et international) : marquées sans appel`);
  console.log(`[plan] ${retenus} groupe(s) lancé(s), ~${retenus * 2} appels de la commande claude (structuration puis relecture), concurrence ${options.concurrence}`);
  console.log(`[plan] plafond de coût de référence : ${options.plafondRefUsd} $ (tarif public, non facturé sur le compte API ; l'usage compte dans l'abonnement)`);
  if (process.argv.includes("--dry-run")) {
    console.log("[dry-run] aucun appel n'a été lancé.");
    return;
  }

  const outils = { appeler: (prompt: string, systeme: string, schema: object) => appelerClaudeCli(prompt, systeme, schema, { effort: "low" }) };
  const resume = await executer(RACINE_BASE, plan, (id) => libelles.get(id) ?? id, outils, MODELE_CLI, options);

  console.log(`[terminé] ${resume.groupesFaits} groupe(s) structuré(s), ${resume.appels} appels, coût de référence ${resume.coutReferenceUsd.toFixed(2)} $`);
  for (const e of resume.erreurs) console.log(`   [erreur] ${e.groupe} : ${e.message}`);
  if (resume.arret) console.log(`[arrêt] ${resume.messageArret} Relancer la même commande reprend là où c'est resté.`);
}

main().catch((erreur) => {
  console.error(`[erreur] ${erreur instanceof PanneCli ? "Panne : " : ""}${erreur instanceof Error ? erreur.message : String(erreur)}`);
  process.exitCode = 1;
});
