import { resolve } from "node:path";
import { appelerClaudeCli, MODELE_CLI, PanneCli } from "./claude-cli";
import { executerEtiquetage, planifierEtiquetage, type OptionsEtiquetage } from "./orchestration-positions";

// Usage : npm run scrape:positions [-- --base=agregateurs --candidats=a,b --force --dry-run --concurrence=3 --plafond-ref=8 --limite=5]
// Étiquette, avec le modèle (commande `claude -p`, abonnement et non API), la position que défend chaque mesure sur les sujets
// de convictions (src/positions.ts). Rejouable : un groupe dont les textes, les prompts et le catalogue n'ont pas changé est ignoré.

function valeur(nom: string): string | undefined {
  const argument = process.argv.find((a) => a.startsWith(`--${nom}=`));
  return argument?.slice(nom.length + 3);
}

async function main(): Promise<void> {
  const base = valeur("base") ?? "agregateurs";
  const racine = resolve(process.cwd(), "data/bases", base);
  const options: OptionsEtiquetage = {
    candidats: valeur("candidats")?.split(",").filter(Boolean),
    force: process.argv.includes("--force"),
    concurrence: Number(valeur("concurrence") ?? 3),
    plafondRefUsd: Number(valeur("plafond-ref") ?? 8),
    limiteGroupes: valeur("limite") !== undefined ? Number(valeur("limite")) : undefined,
  };
  const groupes = planifierEtiquetage(racine, options);
  const aFaire = groupes.filter((g) => g.aFaire);
  const propositions = aFaire.reduce((somme, g) => somme + g.entrees.length, 0);
  const retenus = options.limiteGroupes !== undefined ? Math.min(options.limiteGroupes, aFaire.length) : aFaire.length;

  console.log(`[plan] base « ${base} » : ${groupes.length} groupe(s) (un candidat, 25 mesures au plus), dont ${aFaire.length} à faire (${propositions} mesures), ${groupes.length - aFaire.length} à jour`);
  console.log(`[plan] ${retenus} groupe(s) lancé(s), ~${retenus * 2} appels de la commande claude (étiquetage puis relecture), concurrence ${options.concurrence}`);
  if (process.argv.includes("--dry-run")) {
    console.log("[dry-run] aucun appel n'a été lancé.");
    return;
  }

  const outils = { appeler: (prompt: string, systeme: string, schema: object) => appelerClaudeCli(prompt, systeme, schema, { effort: "low" }) };
  const resume = await executerEtiquetage(racine, groupes, outils, MODELE_CLI, options);

  console.log(`[terminé] ${resume.groupesFaits} groupe(s), ${resume.etiquetees} mesure(s) étiquetée(s), ${resume.appels} appels, coût de référence ${resume.coutReferenceUsd.toFixed(2)} $`);
  for (const e of resume.erreurs) console.log(`   [erreur] ${e.groupe} : ${e.message}`);
  if (resume.arret) console.log(`[arrêt] ${resume.messageArret} Relancer la même commande reprend là où c'est resté.`);
}

main().catch((erreur) => {
  console.error(`[erreur] ${erreur instanceof PanneCli ? "Panne : " : ""}${erreur instanceof Error ? erreur.message : String(erreur)}`);
  process.exitCode = 1;
});
